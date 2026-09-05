import { randomUUID } from 'node:crypto';
import { expect, test, type APIRequestContext, type Browser } from '@playwright/test';
import pg, { type Pool as PgPool } from 'pg';
import { cloneDefaultQuoteEmailSettings } from '@/shared/domain/quote/quoteEmailSettings';
import { E2E_BASE_URL } from './support/auth';

const { Pool } = pg;
const VARIANT_ID = 920001;
const QUOTE_CRON_SECRET =
  'e2e-only-quote-cron-secret-with-at-least-32-characters';
const ORIGIN_HEADERS = { Origin: E2E_BASE_URL };
const CUSTOMER_EMAIL_CONFIRMATION_REQUIRED =
  'CUSTOMER_EMAIL_CONFIRMATION_REQUIRED';

let database: PgPool;
let originalQuoteEmailSettings: StoredSettingsRow | null = null;

type StoredSettingsRow = { config_json: unknown; updated_at: Date };
type Fixture = {
  quoteRequestId: number;
  draftOfferVersionId: number;
  email: string;
};
type Issued = {
  quoteOfferVersionId: number;
  offerNumber: string;
  versionNumber: number;
  contentHash: string;
};

async function requireOk(
  response: { ok(): boolean; status(): number; text(): Promise<string> },
  label: string
) {
  if (response.ok()) return;
  throw new Error(
    `${label} failed with ${response.status()}: ${await response.text()}`
  );
}

async function readCustomerEmailConfirmationToken(
  response: { status(): number; json(): Promise<unknown> },
  label: string
): Promise<string> {
  expect(response.status(), `${label} must require explicit confirmation`).toBe(428);
  const challenge = await response.json() as {
    code?: unknown;
    confirmationToken?: unknown;
  };
  expect(challenge).toMatchObject({
    code: CUSTOMER_EMAIL_CONFIRMATION_REQUIRED,
    confirmationToken: expect.any(String)
  });
  return String(challenge.confirmationToken);
}

async function createQuote(browser: Browser): Promise<Fixture> {
  const context = await browser.newContext({
    baseURL: E2E_BASE_URL,
    storageState: { cookies: [], origins: [] }
  });
  const email = `quote-correction-${randomUUID()}@example.test`;
  try {
    const estimateResponse = await context.request.post('/api/orders/estimate', {
      data: {
        customerName: 'E2E prvotni kupec',
        items: [{ variantId: VARIANT_ID, quantity: 1 }]
      }
    });
    await requireOk(estimateResponse, 'quote estimate');
    const estimate = (await estimateResponse.json()) as {
      quoteFingerprint: string;
      shippingConfigurationVersion: number;
    };
    const createResponse = await context.request.post('/api/quote-requests', {
      headers: {
        ...ORIGIN_HEADERS,
        'X-Forwarded-For': '2001:db8:ee2e:cc01::1',
        'Idempotency-Key': `quote-correction-${randomUUID()}`
      },
      data: {
        customerType: 'individual',
        customerName: 'E2E prvotni kupec',
        organizationName: '',
        contactName: 'E2E prvotni kupec',
        email,
        addressLine1: 'Testna ulica 1',
        city: 'Ljubljana',
        postalCode: '1000',
        countryCode: 'SI',
        reference: `E2E-CORRECTION-${randomUUID().slice(0, 8)}`,
        quoteReason: 'formal_offer',
        quoteMessage: 'E2E preverjanje popravka izdane ponudbe.',
        shippingConfigurationVersion: estimate.shippingConfigurationVersion,
        estimateFingerprint: estimate.quoteFingerprint,
        items: [{ variantId: VARIANT_ID, quantity: 1 }]
      }
    });
    await requireOk(createResponse, 'quote request');
    expect(createResponse.status()).toBe(201);
    const stored = await database.query<{
      id: string | number;
      draft_id: string | number;
    }>(
      `select request.id, offer.id as draft_id
       from quote_requests request
       join quote_offer_versions offer
         on offer.quote_request_id = request.id and offer.status = 'draft'
       where request.email = $1`,
      [email]
    );
    expect(stored.rowCount).toBe(1);
    return {
      quoteRequestId: Number(stored.rows[0].id),
      draftOfferVersionId: Number(stored.rows[0].draft_id),
      email
    };
  } finally {
    await context.close();
  }
}

async function issueInitial(
  request: APIRequestContext,
  fixture: Fixture
): Promise<Issued> {
  const versions = await database.query<{
    offer_state_version: string | number;
  }>(
    `select offer.state_version as offer_state_version
     from quote_offer_versions offer where offer.id = $1`,
    [fixture.draftOfferVersionId]
  );
  const validUntil = new Date(Date.now() + 30 * 86_400_000).toISOString();
  const termsText =
    'Sprejem ponudbe je zavezujoč in povzroči obveznost plačila.';
  const termsVersion = 'e2e-customer-correction-v1';
  const draftResponse = await request.put(
    `/api/admin/quote-requests/${fixture.quoteRequestId}/draft`,
    {
      data: {
        offerVersionId: fixture.draftOfferVersionId,
        expectedStateVersion: Number(versions.rows[0].offer_state_version),
        validUntil,
        shipping: 3,
        confirmFreeShipping: true,
        deliveryTerms: 'Dobava v petih delovnih dneh.',
        paymentTerms: 'Plačilo v 30 dneh.',
        sellerMessage: 'E2E izdana ponudba pred popravkom.',
        customerVisibleNotes: 'Izdana različica mora ostati nespremenjena.',
        termsText,
        termsVersion,
        acceptanceMethod: 'online'
      }
    }
  );
  await requireOk(draftResponse, 'save initial quote draft');
  const draft = (await draftResponse.json()) as {
    quoteOfferVersionId: number;
    stateVersion: number;
  };
  const requestState = await database.query<{ state_version: string | number }>(
    'select state_version from quote_requests where id = $1',
    [fixture.quoteRequestId]
  );
  const issuePath =
    `/api/admin/quote-requests/${fixture.quoteRequestId}/issue`;
  const issueData = {
    actionId: randomUUID(),
    offerVersionId: draft.quoteOfferVersionId,
    expectedStateVersion: draft.stateVersion,
    expectedRequestStateVersion: Number(requestState.rows[0].state_version),
    validUntil,
    termsText,
    termsVersion,
    freeShippingConfirmed: true,
    shippingReason: 'E2E začetna poštnina.'
  };
  const challengeResponse = await request.post(issuePath, { data: issueData });
  const customerEmailConfirmationToken =
    await readCustomerEmailConfirmationToken(
      challengeResponse,
      'issue initial quote'
    );
  const issueResponse = await request.post(issuePath, {
    data: { ...issueData, customerEmailConfirmationToken }
  });
  await requireOk(issueResponse, 'issue initial quote');
  expect(issueResponse.status()).toBe(201);
  return issueResponse.json() as Promise<Issued>;
}

async function processDocuments(request: APIRequestContext) {
  const response = await request.get('/api/admin/quote-workflow/process', {
    headers: { Authorization: `Bearer ${QUOTE_CRON_SECRET}` }
  });
  await requireOk(response, 'quote document worker');
}

async function restoreQuoteEmailSettings() {
  if (!originalQuoteEmailSettings) {
    await database.query(
      `delete from quote_email_settings where key = 'default'`
    );
    return;
  }
  await database.query(
    `
      insert into quote_email_settings (key, config_json, updated_at)
      values ('default', $1::jsonb, $2)
      on conflict (key)
      do update set config_json = excluded.config_json,
                    updated_at = excluded.updated_at
    `,
    [
      JSON.stringify(originalQuoteEmailSettings.config_json),
      originalQuoteEmailSettings.updated_at
    ]
  );
}

test.describe.configure({ mode: 'serial' });

test.describe('issued quote customer correction revision', () => {
  test.beforeAll(async () => {
    const databaseUrl = process.env.E2E_DATABASE_URL?.trim();
    if (!databaseUrl) {
      throw new Error('[e2e-preflight] E2E_DATABASE_URL is required.');
    }
    database = new Pool({ connectionString: databaseUrl, ssl: false });

    const existingSettings = await database.query<StoredSettingsRow>(
      `select config_json, updated_at from quote_email_settings where key = 'default'`
    );
    originalQuoteEmailSettings = existingSettings.rows[0] ?? null;

    const quoteEmail = cloneDefaultQuoteEmailSettings();
    quoteEmail.enabled = true;
    for (const eventType of Object.keys(quoteEmail.events)) {
      quoteEmail.events[eventType as keyof typeof quoteEmail.events] = {
        customer: false,
        admins: false
      };
    }
    quoteEmail.events.quote_issued.customer = true;
    const { updatedAt: _updatedAt, ...storedQuoteEmail } = quoteEmail;
    await database.query(
      `
        insert into quote_email_settings (key, config_json, updated_at)
        values ('default', $1::jsonb, now())
        on conflict (key)
        do update set config_json = excluded.config_json, updated_at = now()
      `,
      [JSON.stringify(storedQuoteEmail)]
    );
  });

  test.afterAll(async () => {
    if (!database) return;
    try {
      await restoreQuoteEmailSettings();
    } finally {
      await (database as PgPool & { end: () => Promise<void> }).end();
    }
  });

  test('keeps V1 and its PDF immutable while a corrected V2 is staged and issued', async ({
    browser,
    page,
    request
  }) => {
    test.setTimeout(120_000);
    await page.setViewportSize({ width: 1440, height: 1000 });
    const fixture = await createQuote(browser);
    const original = await issueInitial(request, fixture);
    await processDocuments(request);

    await expect.poll(async () => {
      const result = await database.query(
        `select 1 from quote_documents
         where quote_offer_version_id = $1 and document_type = 'offer'`,
        [original.quoteOfferVersionId]
      );
      return result.rowCount;
    }, { timeout: 20_000 }).toBe(1);

    const issuedBefore = await database.query<{
      state_version: string | number;
      status: string;
      is_current: boolean;
      customer_snapshot_json: Record<string, unknown>;
      billing_snapshot_json: Record<string, unknown>;
      content_hash: string;
      document_sha256: string;
      acceptance_method: string;
    }>(
      `select state_version, status, is_current, customer_snapshot_json,
              billing_snapshot_json, content_hash, document_sha256,
              acceptance_method
       from quote_offer_versions where id = $1`,
      [original.quoteOfferVersionId]
    );
    const documentBefore = await database.query<{
      id: string | number;
      filename: string;
      blob_pathname: string;
      document_number: string;
      content_sha256: string;
      offer_content_hash: string;
      terms_hash: string;
    }>(
      `select id, filename, blob_pathname, document_number, content_sha256,
              offer_content_hash, terms_hash
       from quote_documents
       where quote_offer_version_id = $1 and document_type = 'offer'`,
      [original.quoteOfferVersionId]
    );
    expect(issuedBefore.rows[0]).toMatchObject({
      status: 'issued',
      is_current: true,
      acceptance_method: 'online',
      content_hash: original.contentHash
    });
    expect(issuedBefore.rows[0].customer_snapshot_json).toMatchObject({
      customerType: 'individual',
      organizationName: null,
      contactName: 'E2E prvotni kupec'
    });

    await page.goto(`/admin/orders/quotes/${fixture.quoteRequestId}`);
    const requestCard = page.getByTestId('quote-request-details-card');
    await expect(requestCard).toBeVisible();
    await requestCard
      .getByRole('button', { name: 'Uredi podatke povpraševanja' })
      .click();
    await expect(
      page.getByTestId('quote-customer-correction-revision-notice')
    ).toContainText('novo različico');
    await requestCard.getByRole('button', { name: 'Tip naročnika' }).click();
    await page
      .getByRole('option', { name: 'Šola / javni zavod', exact: true })
      .click();
    await requestCard
      .getByLabel('Naziv organizacije', { exact: true })
      .fill('E2E popravljeni javni zavod');
    await requestCard
      .getByLabel('Kontaktna oseba', { exact: true })
      .fill('E2E popravljena kontaktna oseba');

    const correctionPromise = page.waitForResponse(
      (response) =>
        response.request().method() === 'PUT'
        && response.url().endsWith(
          `/api/admin/quote-requests/${fixture.quoteRequestId}/details`
        )
    );
    await page.getByRole('button', { name: 'Shrani', exact: true }).click();
    const correctionResponse = await correctionPromise;
    await requireOk(correctionResponse, 'save issued customer correction');
    const correction = (await correctionResponse.json()) as {
      quoteOfferVersionId: number;
      draftVersionNumber: number;
      revisionCreated: boolean;
      correctionScope: string;
      issuedOfferVersionId: number;
      status: string;
    };
    expect(correction).toMatchObject({
      revisionCreated: true,
      correctionScope: 'draft_revision',
      issuedOfferVersionId: original.quoteOfferVersionId,
      draftVersionNumber: original.versionNumber + 1,
      status: 'in_preparation'
    });
    expect(correction.quoteOfferVersionId).not.toBe(original.quoteOfferVersionId);

    await expect(
      requestCard.getByLabel('Naziv organizacije', { exact: true })
    ).toHaveCount(0);
    await expect(requestCard).toContainText('E2E popravljeni javni zavod');
    await expect(requestCard).toContainText('E2E popravljena kontaktna oseba');
    await expect(requestCard).toContainText('Šola');

    const staged = await database.query<{
      request_customer_type: string;
      request_organization_name: string | null;
      request_contact_name: string;
      request_status: string;
      old_state_version: string | number;
      old_status: string;
      old_is_current: boolean;
      old_customer_snapshot_json: Record<string, unknown>;
      old_billing_snapshot_json: Record<string, unknown>;
      old_content_hash: string;
      old_document_sha256: string;
      draft_status: string;
      draft_is_current: boolean;
      draft_customer_snapshot_json: Record<string, unknown>;
      draft_acceptance_method: string;
    }>(
      `select request.customer_type as request_customer_type,
              request.organization_name as request_organization_name,
              request.contact_name as request_contact_name,
              request.status as request_status,
              old.state_version as old_state_version,
              old.status as old_status, old.is_current as old_is_current,
              old.customer_snapshot_json as old_customer_snapshot_json,
              old.billing_snapshot_json as old_billing_snapshot_json,
              old.content_hash as old_content_hash,
              old.document_sha256 as old_document_sha256,
              draft.status as draft_status,
              draft.is_current as draft_is_current,
              draft.customer_snapshot_json as draft_customer_snapshot_json,
              draft.acceptance_method as draft_acceptance_method
       from quote_requests request
       join quote_offer_versions old on old.id = $2
       join quote_offer_versions draft on draft.id = $3
       where request.id = $1`,
      [
        fixture.quoteRequestId,
        original.quoteOfferVersionId,
        correction.quoteOfferVersionId
      ]
    );
    expect(staged.rows[0]).toMatchObject({
      request_customer_type: 'individual',
      request_organization_name: null,
      request_contact_name: 'E2E prvotni kupec',
      request_status: 'in_preparation',
      old_state_version: issuedBefore.rows[0].state_version,
      old_status: 'issued',
      old_is_current: true,
      old_customer_snapshot_json: issuedBefore.rows[0].customer_snapshot_json,
      old_billing_snapshot_json: issuedBefore.rows[0].billing_snapshot_json,
      old_content_hash: issuedBefore.rows[0].content_hash,
      old_document_sha256: issuedBefore.rows[0].document_sha256,
      draft_status: 'draft',
      draft_is_current: false,
      draft_acceptance_method: 'purchase_order'
    });
    expect(staged.rows[0].draft_customer_snapshot_json).toMatchObject({
      customerType: 'school',
      organizationName: 'E2E popravljeni javni zavod',
      contactName: 'E2E popravljena kontaktna oseba'
    });

    const stagedDocument = await database.query(
      `select id, filename, blob_pathname, document_number, content_sha256,
              offer_content_hash, terms_hash
       from quote_documents
       where quote_offer_version_id = $1 and document_type = 'offer'`,
      [original.quoteOfferVersionId]
    );
    expect(stagedDocument.rows).toEqual(documentBefore.rows);

    const event = await database.query<{ metadata_json: Record<string, unknown> }>(
      `select metadata_json from quote_events
       where quote_request_id = $1
         and event_type = 'quote_request_details_changed'
       order by occurred_at desc limit 1`,
      [fixture.quoteRequestId]
    );
    expect(event.rows[0].metadata_json).toMatchObject({
      correctionScope: 'draft_revision',
      revisionCreated: true,
      issuedOfferVersionId: original.quoteOfferVersionId,
      issuedSnapshotPreserved: true,
      previousCustomerType: 'individual',
      nextCustomerType: 'school'
    });
    const audit = await database.query<{ metadata_json: Record<string, unknown> }>(
      `select metadata_json from audit_events
       where entity_type = 'system' and entity_id = $1 and action = 'updated'
       order by occurred_at desc limit 1`,
      [`quote:${fixture.quoteRequestId}`]
    );
    expect(audit.rows[0].metadata_json).toMatchObject({
      correction_scope: 'draft_revision',
      revision_created: true,
      issued_offer_version_id: original.quoteOfferVersionId,
      issued_snapshot_preserved: true,
      previous_customer_type: 'individual',
      next_customer_type: 'school'
    });

    const replacementConfirmationPromise = page.waitForResponse(
      (response) =>
        response.request().method() === 'POST'
        && response.status() === 428
        && response.url().endsWith(
          `/api/admin/quote-requests/${fixture.quoteRequestId}/issue`
        )
    );
    const replacementPromise = page.waitForResponse(
      (response) =>
        response.request().method() === 'POST'
        && response.status() === 201
        && response.url().endsWith(
          `/api/admin/quote-requests/${fixture.quoteRequestId}/issue`
        )
    );
    await page
      .getByRole('button', { name: 'Izdaj ponudbo' })
      .click();
    const issueDialog = page.getByTestId('quote-issue-dialog');
    await expect(issueDialog).toBeVisible();
    await page.getByTestId('quote-issue-confirm').click();
    const replacementConfirmation = await replacementConfirmationPromise;
    const customerEmailConfirmationToken =
      await readCustomerEmailConfirmationToken(
        replacementConfirmation,
        'issue corrected replacement'
      );
    const customerEmailDialog = page.getByRole('dialog', {
      name: 'Pošljem e-pošto stranki?'
    });
    await expect(customerEmailDialog).toBeVisible();
    await customerEmailDialog
      .getByRole('button', { name: 'Potrdi in nadaljuj' })
      .click();
    const replacementResponse = await replacementPromise;
    await requireOk(replacementResponse, 'issue corrected replacement');
    expect(replacementResponse.status()).toBe(201);
    expect(replacementResponse.request().postDataJSON()).toMatchObject({
      customerEmailConfirmationToken
    });
    const replacement = (await replacementResponse.json()) as Issued;
    expect(replacement).toMatchObject({
      quoteOfferVersionId: correction.quoteOfferVersionId,
      versionNumber: original.versionNumber + 1
    });
    expect(replacement.contentHash).not.toBe(original.contentHash);
    await expect(page.getByTestId('quote-workflow-status')).toContainText('Izdano');

    await processDocuments(request);
    await expect.poll(async () => {
      const result = await database.query(
        `select 1 from quote_documents
         where quote_offer_version_id = $1 and document_type = 'offer'`,
        [replacement.quoteOfferVersionId]
      );
      return result.rowCount;
    }, { timeout: 20_000 }).toBe(1);

    const finalState = await database.query<{
      request_customer_type: string;
      request_organization_name: string | null;
      request_contact_name: string;
      request_status: string;
      old_state_version: string | number;
      old_status: string;
      old_is_current: boolean;
      old_customer_snapshot_json: Record<string, unknown>;
      old_billing_snapshot_json: Record<string, unknown>;
      old_content_hash: string;
      old_document_sha256: string;
      new_status: string;
      new_is_current: boolean;
      new_customer_snapshot_json: Record<string, unknown>;
      new_acceptance_method: string;
      new_content_hash: string;
    }>(
      `select request.customer_type as request_customer_type,
              request.organization_name as request_organization_name,
              request.contact_name as request_contact_name,
              request.status as request_status,
              old.state_version as old_state_version,
              old.status as old_status, old.is_current as old_is_current,
              old.customer_snapshot_json as old_customer_snapshot_json,
              old.billing_snapshot_json as old_billing_snapshot_json,
              old.content_hash as old_content_hash,
              old.document_sha256 as old_document_sha256,
              replacement.status as new_status,
              replacement.is_current as new_is_current,
              replacement.customer_snapshot_json as new_customer_snapshot_json,
              replacement.acceptance_method as new_acceptance_method,
              replacement.content_hash as new_content_hash
       from quote_requests request
       join quote_offer_versions old on old.id = $2
       join quote_offer_versions replacement on replacement.id = $3
       where request.id = $1`,
      [
        fixture.quoteRequestId,
        original.quoteOfferVersionId,
        replacement.quoteOfferVersionId
      ]
    );
    expect(finalState.rows[0]).toMatchObject({
      request_customer_type: 'school',
      request_organization_name: 'E2E popravljeni javni zavod',
      request_contact_name: 'E2E popravljena kontaktna oseba',
      request_status: 'offer_issued',
      old_status: 'superseded',
      old_is_current: false,
      old_customer_snapshot_json: issuedBefore.rows[0].customer_snapshot_json,
      old_billing_snapshot_json: issuedBefore.rows[0].billing_snapshot_json,
      old_content_hash: issuedBefore.rows[0].content_hash,
      old_document_sha256: issuedBefore.rows[0].document_sha256,
      new_status: 'issued',
      new_is_current: true,
      new_acceptance_method: 'purchase_order',
      new_content_hash: replacement.contentHash
    });
    expect(Number(finalState.rows[0].old_state_version)).toBe(
      Number(issuedBefore.rows[0].state_version) + 1
    );
    expect(finalState.rows[0].new_customer_snapshot_json).toMatchObject({
      customerType: 'school',
      organizationName: 'E2E popravljeni javni zavod',
      contactName: 'E2E popravljena kontaktna oseba'
    });

    const documents = await database.query<{
      quote_offer_version_id: string | number;
      id: string | number;
      filename: string;
      blob_pathname: string;
      document_number: string;
      content_sha256: string;
      offer_content_hash: string;
      terms_hash: string;
    }>(
      `select quote_offer_version_id, id, filename, blob_pathname,
              document_number, content_sha256, offer_content_hash, terms_hash
       from quote_documents
       where quote_offer_version_id = any($1::bigint[])
         and document_type = 'offer'`,
      [[original.quoteOfferVersionId, replacement.quoteOfferVersionId]]
    );
    expect(documents.rows).toHaveLength(2);
    const oldDocument = documents.rows.find(
      (row) => Number(row.quote_offer_version_id) === original.quoteOfferVersionId
    );
    expect(oldDocument).toMatchObject(documentBefore.rows[0]);
    const newDocument = documents.rows.find(
      (row) => Number(row.quote_offer_version_id) === replacement.quoteOfferVersionId
    );
    expect(newDocument?.offer_content_hash).toBe(replacement.contentHash);
    expect(newDocument?.id).not.toBe(documentBefore.rows[0].id);

    const events = await database.query<{ event_type: string }>(
      'select event_type from quote_events where quote_request_id = $1',
      [fixture.quoteRequestId]
    );
    const eventTypes = new Set(events.rows.map((row) => row.event_type));
    for (const eventType of [
      'quote_request_details_changed',
      'offer_superseded',
      'new_version_issued',
      'offer_issued'
    ]) {
      expect(eventTypes.has(eventType), `missing ${eventType}`).toBe(true);
    }
  });
});
