import {
  expect,
  test,
  type APIRequestContext,
  type APIResponse
} from '@playwright/test';
import pg, { type Pool as PgPool } from 'pg';
import type {
  ShippingCalculation,
  ShippingConfiguration
} from '@/shared/domain/shipping/shipping';
import { deletePrivateOrderDocumentBlob } from '@/shared/server/blob';

const { Pool } = pg;
const SETTINGS_KEY = 'default';
const VARIANT_ID = 920001;

type AdminState = {
  configuration: ShippingConfiguration;
  revision: number;
  updatedAt: string | null;
};

type SettingsBackup = {
  version: number;
  revision: number;
  configuration: ShippingConfiguration;
  updatedAt: Date;
  auditIds: string[];
};

type CatalogBackup = {
  price: string;
  weight: string | null;
  length: string | null;
  width: string | null;
  height: string | null;
  inventory: number;
  updatedAt: Date;
};

type Quote = {
  items: Array<{ variantId: number; snapshot: Record<string, unknown> }>;
  totals: {
    net: number;
    tax: number;
    shipping: number | null;
    gross: number | null;
    currency: 'EUR';
  };
  shipping: ShippingCalculation;
  shippingConfigurationVersion: number;
  quoteFingerprint: string;
};

type DocumentSnapshot = {
  id: string;
  type: string;
  filename: string;
  blob_pathname: string;
  version_number: number;
  order_pricing_revision: number;
  document_number: string;
  issued_at: string;
  content_sha256: string;
  legal_status: string;
  format_marker: string;
  deleted_at: string | null;
};

async function json<T>(response: APIResponse): Promise<T> {
  return await response.json() as T;
}

async function adminState(request: APIRequestContext): Promise<AdminState> {
  const response = await request.get('/api/admin/shipping');
  expect(response.status()).toBe(200);
  const payload = await json<{ state?: AdminState }>(response);
  expect(payload.state).toBeDefined();
  return payload.state!;
}

async function backUpSettings(database: PgPool): Promise<SettingsBackup> {
  const [settings, audits] = await Promise.all([
    database.query<{
      version: number;
      revision: number;
      config_json: ShippingConfiguration;
      updated_at: Date;
    }>(
      'select version, revision, config_json, updated_at from shipping_settings where key = $1',
      [SETTINGS_KEY]
    ),
    database.query<{ id: string }>(
      "select id from audit_events where entity_type = 'system' and entity_id = 'shipping-configuration'"
    )
  ]);
  const row = settings.rows[0];
  if (!row) throw new Error('The deterministic shipping settings row is missing.');
  return {
    version: Number(row.version),
    revision: Number(row.revision),
    configuration: row.config_json,
    updatedAt: row.updated_at,
    auditIds: audits.rows.map((entry) => entry.id)
  };
}

async function restoreSettings(database: PgPool, backup: SettingsBackup) {
  const client = await database.connect();
  try {
    await client.query('begin');
    await client.query(
      'update shipping_settings set version = $2, revision = $3, config_json = $4::jsonb, updated_at = $5 where key = $1',
      [
        SETTINGS_KEY,
        backup.version,
        backup.revision,
        JSON.stringify(backup.configuration),
        backup.updatedAt
      ]
    );
    await client.query(
      "delete from audit_events where entity_type = 'system' and entity_id = 'shipping-configuration' and not (id = any($1::uuid[]))",
      [backup.auditIds]
    );
    await client.query('commit');
  } catch (error) {
    await client.query('rollback');
    throw error;
  } finally {
    client.release();
  }
}

async function backUpCatalog(database: PgPool): Promise<CatalogBackup> {
  const result = await database.query<{
    price: string;
    weight: string | null;
    length: string | null;
    width: string | null;
    height: string | null;
    inventory: number;
    updated_at: Date;
  }>(
    'select price::text, shipping_weight_grams::text as weight, shipping_length_mm::text as length, shipping_width_mm::text as width, shipping_height_mm::text as height, inventory, updated_at from catalog_item_variants where id = $1',
    [VARIANT_ID]
  );
  const row = result.rows[0];
  if (!row) throw new Error('The deterministic shipping variant is missing.');
  return {
    price: row.price,
    weight: row.weight,
    length: row.length,
    width: row.width,
    height: row.height,
    inventory: Number(row.inventory),
    updatedAt: row.updated_at
  };
}

async function restoreCatalog(database: PgPool, backup: CatalogBackup) {
  await database.query(
    'update catalog_item_variants set price = $2, shipping_weight_grams = $3, shipping_length_mm = $4, shipping_width_mm = $5, shipping_height_mm = $6, inventory = $7, updated_at = $8 where id = $1',
    [
      VARIANT_ID,
      backup.price,
      backup.weight,
      backup.length,
      backup.width,
      backup.height,
      backup.inventory,
      backup.updatedAt
    ]
  );
}

function quotePayload() {
  return {
    customerName: 'E2E šola poštnine',
    customerLabels: ['E2E šola poštnine', 'Ana Novak'],
    items: [{ variantId: VARIANT_ID, quantity: 1 }]
  };
}

function orderPayload(
  email: string,
  quote: Pick<Quote, 'shippingConfigurationVersion' | 'quoteFingerprint'>
) {
  return {
    customerType: 'school',
    customerName: 'E2E šola poštnine',
    organizationName: 'E2E šola poštnine',
    contactName: 'Ana Novak',
    email,
    addressLine1: 'Cankarjeva ulica 27',
    city: 'Ljubljana',
    postalCode: '1000',
    countryCode: 'SI',
    notes: '',
    shippingConfigurationVersion: quote.shippingConfigurationVersion,
    quoteFingerprint: quote.quoteFingerprint,
    items: [{ variantId: VARIANT_ID, quantity: 1 }]
  };
}

test.describe.serial('shipping persistence and order authority', () => {
  let database: PgPool;

  test.beforeAll(() => {
    const databaseUrl = process.env.E2E_DATABASE_URL?.trim();
    if (!databaseUrl) {
      throw new Error('[e2e-preflight] E2E_DATABASE_URL is required.');
    }
    database = new Pool({ connectionString: databaseUrl, ssl: false });
  });

  test.afterAll(async () => {
    if (!database) return;
    await (
      database as PgPool & { end: () => Promise<void> }
    ).end();
  });

  test('persists draft-only edits without changing checkout version and rejects a stale revision', async ({
    request
  }) => {
    const backup = await backUpSettings(database);
    const draftId = 'e2e-draft-' + crypto.randomUUID();

    try {
      const original = await adminState(request);
      expect(original).toMatchObject({
        revision: backup.revision,
        configuration: { version: backup.version }
      });

      const now = new Date().toISOString();
      const changed: ShippingConfiguration = {
        ...original.configuration,
        draftRules: [
          ...original.configuration.draftRules,
          {
            id: draftId,
            name: 'E2E osnutek pravila',
            note: 'Trajni zapis brez vpliva na izračun.',
            status: 'draft',
            createdAt: now,
            updatedAt: now
          }
        ]
      };
      const save = await request.put('/api/admin/shipping', {
        data: {
          configuration: changed,
          expectedVersion: original.configuration.version,
          expectedRevision: original.revision
        }
      });
      expect(save.status()).toBe(200);
      const saved = (await json<{ state: AdminState }>(save)).state;
      expect(saved.configuration.version).toBe(original.configuration.version);
      expect(saved.revision).toBe(original.revision + 1);
      expect(saved.configuration.draftRules).toContainEqual(
        expect.objectContaining({ id: draftId })
      );

      const persisted = await adminState(request);
      expect(persisted).toEqual({
        configuration: saved.configuration,
        revision: saved.revision,
        updatedAt: saved.updatedAt
      });
      const persistedRow = await database.query<{
        version: number;
        revision: number;
        config_json: ShippingConfiguration;
      }>(
        'select version, revision, config_json from shipping_settings where key = $1',
        [SETTINGS_KEY]
      );
      expect(persistedRow.rows[0]).toMatchObject({
        version: original.configuration.version,
        revision: original.revision + 1
      });
      expect(persistedRow.rows[0]?.config_json.draftRules).toContainEqual(
        expect.objectContaining({ id: draftId })
      );

      const staleSave = await request.put('/api/admin/shipping', {
        data: {
          configuration: {
            ...changed,
            draftRules: changed.draftRules.map((draft) =>
              draft.id === draftId
                ? { ...draft, note: 'Zastarela sprememba se ne sme zapisati.' }
                : draft
            )
          },
          expectedVersion: original.configuration.version,
          expectedRevision: original.revision
        }
      });
      expect(staleSave.status()).toBe(409);
      expect(await json(staleSave)).toMatchObject({
        code: 'SHIPPING_CONFIGURATION_CHANGED',
        configuration: {
          version: original.configuration.version,
          draftRules: expect.arrayContaining([
            expect.objectContaining({
              id: draftId,
              note: 'Trajni zapis brez vpliva na izračun.'
            })
          ])
        }
      });
      expect(await adminState(request)).toEqual(persisted);
    } finally {
      await restoreSettings(database, backup);
    }

    const restored = await adminState(request);
    expect(restored.configuration).toEqual(backup.configuration);
    expect(restored.revision).toBe(backup.revision);
  });

  test('rejects same-version catalog and config races while freezing accepted totals', async ({
    request
  }) => {
    const settingsBackup = await backUpSettings(database);
    const catalogBackup = await backUpCatalog(database);
    const acceptedEmail =
      'shipping-authority-' + crypto.randomUUID() + '@example.com';
    const catalogStaleEmail =
      'shipping-catalog-stale-' + crypto.randomUUID() + '@example.com';
    const staleEmail = 'shipping-stale-' + crypto.randomUUID() + '@example.com';

    try {
      const quoteResponse = await request.post('/api/orders/quote', {
        data: quotePayload()
      });
      expect(quoteResponse.status()).toBe(200);
      const quoted = await json<Quote>(quoteResponse);
      expect(quoted.shipping).toMatchObject({
        status: 'calculated',
        source: 'automatic',
        configurationVersion: settingsBackup.version,
        combinedWeightGrams: 14,
        largestDimensionMm: 100,
        finalAmountCents: 300
      });
      expect(quoted.totals.shipping).toBe(3);
      expect(quoted.quoteFingerprint).toMatch(
        /^order-quote-v1:[a-f0-9]{64}$/u
      );

      const acceptedResponse = await request.post('/api/orders', {
        headers: {
          'Idempotency-Key': 'shipping-authority-' + crypto.randomUUID()
        },
        data: {
          ...orderPayload(acceptedEmail, quoted),
          shipping: 0,
          shippingAmount: 0,
          total: 0,
          totals: {
            net: 0,
            tax: 0,
            shipping: 0,
            gross: 0,
            currency: 'EUR'
          }
        }
      });
      expect(acceptedResponse.status()).toBe(201);
      const accepted = await json<{ accessId: string }>(acceptedResponse);
      expect(accepted.accessId).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u
      );

      const stored = await database.query<{
        subtotal: string;
        tax: string;
        shipping: string;
        automatic_shipping: string;
        total: string;
        shipping_snapshot_json: ShippingCalculation;
      }>(
        'select subtotal::text, tax::text, shipping::text, automatic_shipping::text, total::text, shipping_snapshot_json from orders where email = $1 order by id desc limit 1',
        [acceptedEmail]
      );
      const acceptedOrder = stored.rows[0];
      expect(acceptedOrder).toBeDefined();
      expect(Number(acceptedOrder?.subtotal)).toBe(quoted.totals.net);
      expect(Number(acceptedOrder?.tax)).toBe(quoted.totals.tax);
      expect(Number(acceptedOrder?.shipping)).toBe(quoted.totals.shipping);
      expect(Number(acceptedOrder?.automatic_shipping)).toBe(
        quoted.totals.shipping
      );
      expect(Number(acceptedOrder?.total)).toBe(quoted.totals.gross);
      expect(acceptedOrder?.shipping_snapshot_json).toEqual(quoted.shipping);

      await database.query(
        'update catalog_item_variants set price = price + 1.00, shipping_weight_grams = 5001, shipping_length_mm = 1201, shipping_width_mm = 400, shipping_height_mm = 50, updated_at = now() where id = $1',
        [VARIANT_ID]
      );
      const catalogStaleResponse = await request.post('/api/orders', {
        headers: {
          'Idempotency-Key': 'shipping-catalog-stale-' + crypto.randomUUID()
        },
        data: orderPayload(catalogStaleEmail, quoted)
      });
      expect(catalogStaleResponse.status()).toBe(409);
      const catalogStale = await json<{
        code: string;
        quote: Quote;
      }>(catalogStaleResponse);
      expect(catalogStale.code).toBe('SHIPPING_QUOTE_CHANGED');
      expect(catalogStale.quote.shippingConfigurationVersion).toBe(
        quoted.shippingConfigurationVersion
      );
      expect(catalogStale.quote.quoteFingerprint).not.toBe(
        quoted.quoteFingerprint
      );
      expect(catalogStale.quote.totals.net).not.toBe(quoted.totals.net);
      expect(catalogStale.quote.shipping).toMatchObject({
        combinedWeightGrams: 5001,
        largestDimensionMm: 1201,
        finalAmountCents: 1000
      });
      const catalogRejected = await database.query<{ count: number }>(
        'select count(*)::integer as count from orders where email = $1',
        [catalogStaleEmail]
      );
      expect(catalogRejected.rows[0]?.count).toBe(0);
      await restoreCatalog(database, catalogBackup);

      const beforeUpdate = await adminState(request);
      const changed: ShippingConfiguration = {
        ...beforeUpdate.configuration,
        weightBands: beforeUpdate.configuration.weightBands.map((band, index) =>
          index === 0 ? { ...band, priceCents: band.priceCents + 137 } : band
        )
      };
      const updateResponse = await request.put('/api/admin/shipping', {
        data: {
          configuration: changed,
          expectedVersion: beforeUpdate.configuration.version,
          expectedRevision: beforeUpdate.revision
        }
      });
      expect(updateResponse.status()).toBe(200);
      const updated = (await json<{ state: AdminState }>(updateResponse)).state;
      expect(updated.configuration.version).toBe(
        beforeUpdate.configuration.version + 1
      );
      expect(updated.revision).toBe(beforeUpdate.revision + 1);

      const staleResponse = await request.post('/api/orders', {
        headers: {
          'Idempotency-Key': 'shipping-stale-' + crypto.randomUUID()
        },
        data: orderPayload(staleEmail, quoted)
      });
      expect(staleResponse.status()).toBe(409);
      expect(await json(staleResponse)).toMatchObject({
        code: 'SHIPPING_QUOTE_CHANGED',
        quote: {
          shippingConfigurationVersion: updated.configuration.version,
          totals: { shipping: 4.37 },
          shipping: {
            status: 'calculated',
            configurationVersion: updated.configuration.version,
            finalAmountCents: 437
          }
        }
      });
      const rejected = await database.query<{ count: number }>(
        'select count(*)::integer as count from orders where email = $1',
        [staleEmail]
      );
      expect(rejected.rows[0]?.count).toBe(0);

      await database.query(
        'update catalog_item_variants set shipping_weight_grams = 5001, shipping_length_mm = 1201, shipping_width_mm = 400, shipping_height_mm = 50, updated_at = now() where id = $1',
        [VARIANT_ID]
      );
      const currentQuoteResponse = await request.post('/api/orders/quote', {
        data: quotePayload()
      });
      expect(currentQuoteResponse.status()).toBe(200);
      const currentQuote = await json<Quote>(currentQuoteResponse);
      expect(currentQuote.shipping).toMatchObject({
        status: 'calculated',
        configurationVersion: updated.configuration.version,
        combinedWeightGrams: 5001,
        largestDimensionMm: 1201,
        finalAmountCents: 1000
      });
      expect(currentQuote.totals.shipping).toBe(10);

      const confirmationResponse = await request.get(
        '/api/orders/confirmation',
        { headers: { 'x-order-access-id': accepted.accessId } }
      );
      expect(confirmationResponse.status()).toBe(200);
      const confirmation = await json<{
        totals: Quote['totals'];
        shipping: ShippingCalculation;
        items: Array<{ snapshot: Record<string, unknown> }>;
      }>(confirmationResponse);
      expect(confirmation.totals).toEqual(quoted.totals);
      expect(confirmation.shipping).toEqual(quoted.shipping);
      expect(confirmation.items[0]?.snapshot).toMatchObject({
        shippingMeasurement: {
          weightGrams: 14,
          lengthMm: 100,
          widthMm: 100,
          heightMm: 0.5
        }
      });
    } finally {
      await Promise.all([
        restoreSettings(database, settingsBackup),
        restoreCatalog(database, catalogBackup),
        database.query(
          'delete from orders where email = any($1::text[])',
          [[acceptedEmail, catalogStaleEmail, staleEmail]]
        )
      ]);
    }

    const restored = await adminState(request);
    expect(restored.configuration).toEqual(settingsBackup.configuration);
    expect(restored.revision).toBe(settingsBackup.revision);
  });

  test('allows a shipping override after a current PDF without rewriting the historical document', async ({
    request
  }) => {
    const email = `shipping-issued-document-${crypto.randomUUID()}@example.com`;
    let orderId: number | null = null;
    let documentBlobPath: string | null = null;

    try {
      const quoteResponse = await request.post('/api/orders/quote', {
        data: quotePayload()
      });
      expect(quoteResponse.status()).toBe(200);
      const quoted = await json<Quote>(quoteResponse);
      if (quoted.shipping.status !== 'calculated') {
        throw new Error('Expected calculated shipping for the document-history fixture.');
      }
      const automaticAmountCents = quoted.shipping.automaticAmountCents;

      const createResponse = await request.post('/api/orders', {
        headers: {
          'Idempotency-Key': `shipping-issued-document-${crypto.randomUUID()}`
        },
        data: orderPayload(email, quoted)
      });
      expect(createResponse.status()).toBe(201);

      const orderResult = await database.query<{
        id: string;
        pricing_revision: string | number;
      }>(
        'select id::text, pricing_revision from orders where email = $1 order by id desc limit 1',
        [email]
      );
      orderId = Number(orderResult.rows[0]?.id);
      expect(Number.isSafeInteger(orderId) && orderId > 0).toBe(true);
      const pricingRevisionBefore = Number(orderResult.rows[0]?.pricing_revision);

      await expect.poll(
        async () => {
          const result = await database.query<{
            attempts: number;
            status: string;
          }>(
            `select attempts, status
             from order_document_jobs
             where order_id = $1
               and document_type = 'order_summary'
             limit 1`,
            [orderId]
          );
          const job = result.rows[0];
          return Boolean(job && job.attempts >= 1 && job.status !== 'processing');
        },
        {
          message: 'initial order-summary worker should settle before the override',
          timeout: 10_000
        }
      ).toBe(true);

      const existingDocument = await database.query<DocumentSnapshot>(
        `select id::text, type, filename, blob_pathname, version_number,
                order_pricing_revision, document_number, issued_at::text,
                content_sha256, legal_status, format_marker, deleted_at::text
         from order_documents
         where order_id = $1
           and type = 'order_summary'
           and order_pricing_revision = $2
           and deleted_at is null
         order by id desc
         limit 1`,
        [orderId, pricingRevisionBefore]
      );
      let documentBefore = existingDocument.rows[0];
      if (!documentBefore) {
        const documentResult = await database.query<DocumentSnapshot>(
          `insert into order_documents (
             order_id, type, filename, blob_pathname, version_number,
             order_pricing_revision, document_number, issued_at,
             content_sha256, legal_status, format_marker
           )
           values (
             $1, 'order_summary', 'e2e-order-summary.pdf', $2, 1,
             $3, $4, now(), $5, 'operational', 'atehna-template-pdf-v3'
           )
           returning id::text, type, filename, blob_pathname, version_number,
                     order_pricing_revision, document_number, issued_at::text,
                     content_sha256, legal_status, format_marker, deleted_at::text`,
          [
            orderId,
            `e2e/shipping-issued-document/${crypto.randomUUID()}.pdf`,
            pricingRevisionBefore,
            `PN-E2E-${orderId}-V1`,
            'a'.repeat(64)
          ]
        );
        documentBefore = documentResult.rows[0];
      }
      if (!documentBefore) {
        throw new Error('Failed to create the document-history fixture.');
      }
      documentBlobPath = documentBefore.blob_pathname;

      const overrideAmountCents = automaticAmountCents + 125;
      const reason = 'E2E popravek po izdaji dokumenta';
      const overrideResponse = await request.post(
        `/api/admin/orders/${orderId}/shipping`,
        {
          data: { action: 'override', amountCents: overrideAmountCents, reason }
        }
      );
      expect(overrideResponse.status()).toBe(200);
      expect(await json(overrideResponse)).toMatchObject({
        action: 'override',
        shippingCents: overrideAmountCents,
        automaticAmountCents,
        shippingOverride: { overrideAmountCents, reason },
        pricingRevision: pricingRevisionBefore + 1
      });

      const [orderAfter, documentAfter] = await Promise.all([
        database.query<{
          shipping: string;
          automatic_shipping: string;
          pricing_revision: string | number;
          shipping_override_json: {
            overrideAmountCents: number;
            reason: string;
          };
        }>(
          `select shipping::text, automatic_shipping::text, pricing_revision,
                  shipping_override_json
           from orders where id = $1`,
          [orderId]
        ),
        database.query<DocumentSnapshot>(
          `select id::text, type, filename, blob_pathname, version_number,
                  order_pricing_revision, document_number, issued_at::text,
                  content_sha256, legal_status, format_marker, deleted_at::text
           from order_documents where id = $1`,
          [documentBefore.id]
        )
      ]);
      expect(Math.round(Number(orderAfter.rows[0]?.shipping) * 100)).toBe(
        overrideAmountCents
      );
      expect(Math.round(Number(orderAfter.rows[0]?.automatic_shipping) * 100)).toBe(
        automaticAmountCents
      );
      expect(Number(orderAfter.rows[0]?.pricing_revision)).toBe(
        pricingRevisionBefore + 1
      );
      expect(orderAfter.rows[0]?.shipping_override_json).toMatchObject({
        overrideAmountCents,
        reason
      });
      expect(documentAfter.rows[0]).toEqual(documentBefore);
    } finally {
      if (orderId !== null) {
        await database.query('delete from order_documents where order_id = $1', [orderId]);
        if (documentBlobPath) {
          await deletePrivateOrderDocumentBlob(documentBlobPath).catch(() => undefined);
        }
        await database.query(
          "delete from audit_events where entity_type = 'order' and entity_id = $1",
          [String(orderId)]
        );
        await database.query('delete from orders where id = $1', [orderId]);
      } else {
        await database.query('delete from orders where email = $1', [email]);
      }
    }
  });

  test('persists a manual-quote draft, accepts an explicit zero override, and only then finalizes', async ({
    request
  }) => {
    const catalogBackup = await backUpCatalog(database);
    let draftOrderId: number | null = null;

    try {
      await database.query(
        'update catalog_item_variants set shipping_weight_grams = 30001, updated_at = now() where id = $1',
        [VARIANT_ID]
      );
      const variantResult = await database.query<{
        catalog_item_id: number;
        sku: string | null;
        name: string;
        unit: string | null;
        price: string;
        discount_pct: string;
      }>(
        `
          select
            ci.id as catalog_item_id,
            civ.variant_sku as sku,
            ci.item_name as name,
            civ.unit,
            civ.price::text,
            civ.discount_pct::text
          from catalog_item_variants civ
          join catalog_items ci on ci.id = civ.item_id
          where civ.id = $1
        `,
        [VARIANT_ID]
      );
      const variant = variantResult.rows[0];
      expect(variant).toBeDefined();

      const createResponse = await request.post('/api/admin/orders');
      expect(createResponse.status()).toBe(200);
      draftOrderId = (await json<{ orderId: number }>(createResponse)).orderId;

      const saveResponse = await request.post(
        `/api/admin/orders/${draftOrderId}/items`,
        {
          data: {
            items: [
              {
                catalogItemId: Number(variant!.catalog_item_id),
                catalogVariantId: VARIANT_ID,
                sku: variant!.sku ?? `E2E-${VARIANT_ID}`,
                name: variant!.name,
                unit: variant!.unit,
                quantity: 1,
                unitPrice: Number(variant!.price),
                discountPercentage: Number(variant!.discount_pct)
              }
            ]
          }
        }
      );
      expect(saveResponse.status()).toBe(200);
      expect(await json(saveResponse)).toMatchObject({
        totals: {
          shipping: 0,
          automaticShipping: null,
          shippingSource: 'manual_quote',
          shippingOverrideStale: false
        }
      });

      const finalizePayload = {
        customerType: 'company',
        organizationName: 'E2E ročna poštnina d.o.o.',
        contactName: 'Ana Novak',
        email: `shipping-draft-${crypto.randomUUID()}@example.com`,
        addressLine1: 'Cankarjeva ulica 27',
        postalCode: '1000',
        city: 'Ljubljana',
        reference: '',
        notes: ''
      };
      const prematureFinalize = await request.post(
        `/api/admin/orders/${draftOrderId}/details`,
        { data: finalizePayload }
      );
      expect(prematureFinalize.status()).toBe(200);
      expect(await json(prematureFinalize)).toMatchObject({
        success: true,
        isDraft: true,
        finalized: false,
        finalizationBlock: {
          code: 'ORDER_DRAFT_SHIPPING_INCOMPLETE'
        }
      });

      const overrideResponse = await request.post(
        `/api/admin/orders/${draftOrderId}/shipping`,
        {
          data: {
            action: 'override',
            amountCents: 0,
            reason: 'E2E dogovorjen osebni prevzem'
          }
        }
      );
      expect(overrideResponse.status()).toBe(200);
      expect(await json(overrideResponse)).toMatchObject({
        action: 'override',
        shippingCents: 0,
        automaticAmountCents: null,
        shippingOverrideStale: false
      });

      const finalizeResponse = await request.post(
        `/api/admin/orders/${draftOrderId}/details`,
        { data: finalizePayload }
      );
      expect(finalizeResponse.status()).toBe(200);

      const storedResult = await database.query<{
        is_draft: boolean;
        automatic_shipping: string | null;
        shipping: string;
        shipping_override_stale: boolean;
        shipping_snapshot_json: ShippingCalculation;
        shipping_override_json: { overrideAmountCents: number; reason: string };
        pricing_revision: number;
      }>(
        'select is_draft, automatic_shipping::text, shipping::text, shipping_override_stale, shipping_snapshot_json, shipping_override_json, pricing_revision from orders where id = $1',
        [draftOrderId]
      );
      expect(storedResult.rows[0]).toMatchObject({
        is_draft: false,
        automatic_shipping: null,
        shipping: '0.00',
        shipping_override_stale: false,
        shipping_snapshot_json: { status: 'manual_quote' },
        shipping_override_json: {
          overrideAmountCents: 0,
          reason: 'E2E dogovorjen osebni prevzem'
        },
        pricing_revision: 3
      });
    } finally {
      if (draftOrderId) {
        const durableHold = await database.query(
          'select 1 from order_stock_holds where order_id = $1 limit 1',
          [draftOrderId]
        );
        if (durableHold.rowCount === 1) {
          const cancelResponse = await request.post(
            `/api/admin/orders/${draftOrderId}/status`,
            { data: { status: 'cancelled' } }
          );
          expect(cancelResponse.ok()).toBeTruthy();
          const archiveResponse = await request.delete(
            `/api/admin/orders/${draftOrderId}`
          );
          expect(archiveResponse.ok()).toBeTruthy();
        } else {
          await database.query('delete from orders where id = $1', [draftOrderId]);
        }
        await database.query(
          "delete from audit_events where entity_type = 'order' and entity_id = $1",
          [String(draftOrderId)]
        );
      }
      await restoreCatalog(database, catalogBackup);
    }
  });
});
