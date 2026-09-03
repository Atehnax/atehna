import { createDecipheriv, createHash, randomUUID } from 'node:crypto';
import {
  expect,
  test,
  type APIRequestContext,
  type Browser,
  type BrowserContext
} from '@playwright/test';
import pg, { type Pool as PgPool } from 'pg';
import { toDisplayOrderNumber } from '@/admin/features/orders/components/adminOrdersTableUtils';
import { cloneDefaultOrderEmailSettings } from '@/shared/domain/order/orderEmailSettings';
import { cloneDefaultQuoteEmailSettings } from '@/shared/domain/quote/quoteEmailSettings';
import {
  DEFAULT_QUOTE_DELIVERY_TERMS,
  DEFAULT_QUOTE_PAYMENT_TERMS
} from '@/shared/domain/quote/quoteTypes';
import { ADMIN_STORAGE_STATE_PATH, E2E_BASE_URL } from './support/auth';

const { Pool } = pg;
const VARIANT_ID = 920001;
const QUOTE_ACCESS_BOOTSTRAP_KEY =
  'e2e-only-quote-bootstrap-key-with-at-least-32-characters';
const QUOTE_CRON_SECRET =
  'e2e-only-quote-cron-secret-with-at-least-32-characters';
const ORIGIN_HEADERS = { Origin: E2E_BASE_URL };
const CUSTOMER_EMAIL_CONFIRMATION_REQUIRED =
  'CUSTOMER_EMAIL_CONFIRMATION_REQUIRED';

type StoredSettingsRow = { config_json: unknown; updated_at: Date };
type Estimate = {
  quoteFingerprint: string;
  shippingConfigurationVersion: number;
};
type QuoteRequestFixture = {
  context: BrowserContext;
  quoteRequestId: number;
  requestNumber: string;
  accessId: string;
  draftOfferVersionId: number;
  email: string;
  customerType: 'individual' | 'school';
};
type IssuedOffer = QuoteRequestFixture & {
  quoteOfferVersionId: number;
  offerNumber: string;
  versionNumber: number;
  contentHash: string;
  termsHash: string;
  validUntil: string;
};
type OfferSession = { accessId: string; csrfToken: string };
type EmailEnvelope = { message?: { text?: string } };
type EncryptedQuoteEmailEnvelope = {
  version: 1;
  algorithm: 'aes-256-gcm';
  ciphertext: string;
  initializationVector: string;
  authenticationTag: string;
};

const tinyPdf = Buffer.from(
  '%PDF-1.4\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n' +
    '2 0 obj\n<< /Type /Pages /Count 0 /Kids [] >>\nendobj\n' +
    'trailer\n<< /Root 1 0 R >>\n%%EOF\n',
  'ascii'
);

let database: PgPool;
let originalOrderEmailSettings: StoredSettingsRow | null = null;
let originalQuoteEmailSettings: StoredSettingsRow | null = null;

function mutationHeaders(session: OfferSession) {
  return {
    ...ORIGIN_HEADERS,
    'X-Quote-Access-Id': session.accessId,
    'X-Quote-CSRF-Token': session.csrfToken
  };
}

function decryptQuoteEmailEnvelopeForTest(
  value: unknown,
  binding: { jobId: string; requestId: number; offerVersionId: number | null }
): string {
  const envelope = value as Partial<EncryptedQuoteEmailEnvelope> | null;
  if (
    envelope?.version !== 1 ||
    envelope.algorithm !== 'aes-256-gcm' ||
    typeof envelope.ciphertext !== 'string' ||
    typeof envelope.initializationVector !== 'string' ||
    typeof envelope.authenticationTag !== 'string'
  ) {
    throw new Error('Invalid encrypted quote email envelope in E2E fixture.');
  }
  const key = createHash('sha256')
    .update('atehna/quote-email-envelope/key/aes-256-gcm/v1', 'utf8')
    .update('\0', 'utf8')
    .update(QUOTE_ACCESS_BOOTSTRAP_KEY, 'utf8')
    .digest();
  const aad = Buffer.from(
    `atehna/quote-email-envelope/aad/v1\0${binding.jobId.toLowerCase()}\0${binding.requestId}\0${binding.offerVersionId ?? ''}`,
    'utf8'
  );
  const decipher = createDecipheriv(
    'aes-256-gcm',
    key,
    Buffer.from(envelope.initializationVector, 'base64url')
  );
  decipher.setAAD(aad);
  decipher.setAuthTag(Buffer.from(envelope.authenticationTag, 'base64url'));
  return Buffer.concat([
    decipher.update(Buffer.from(envelope.ciphertext, 'base64url')),
    decipher.final()
  ]).toString('utf8');
}

async function requireOk(
  response: {
    ok(): boolean;
    status(): number;
    text(): Promise<string>;
  },
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

async function inventory(): Promise<number> {
  const result = await database.query<{ inventory: string | number }>(
    'select inventory from catalog_item_variants where id = $1',
    [VARIANT_ID]
  );
  return Number(result.rows[0]?.inventory);
}

async function restoreInventory(value: number) {
  await database.query(
    'update catalog_item_variants set inventory = $1, updated_at = now() where id = $2',
    [value, VARIANT_ID]
  );
}

async function processQuoteWorkflow(request: APIRequestContext) {
  const response = await request.get('/api/admin/quote-workflow/process', {
    headers: { Authorization: `Bearer ${QUOTE_CRON_SECRET}` }
  });
  await requireOk(response, 'quote workflow worker');
  return response.json() as Promise<{
    expiry?: { expired?: number };
    documents?: { completed?: number };
    email?: { claimed?: number; failed?: number; retried?: number };
  }>;
}

async function createQuoteRequest(
  browser: Browser,
  input: {
    customerType?: 'individual' | 'school';
    quantity?: number;
    label: string;
  }
): Promise<QuoteRequestFixture> {
  const customerType = input.customerType ?? 'individual';
  const quantity = input.quantity ?? 1;
  const context = await browser.newContext({
    baseURL: E2E_BASE_URL,
    storageState: { cookies: [], origins: [] }
  });
  const networkSeed = randomUUID().replaceAll('-', '');
  const networkSubject = [
    '2001',
    'db8',
    ...Array.from({ length: 6 }, (_, index) =>
      networkSeed.slice(index * 4, (index + 1) * 4)
    )
  ].join(':');
  const email = `quote-${input.label}-${randomUUID()}@example.com`;
  const customerName =
    customerType === 'school' ? 'E2E javni zavod' : 'E2E kupec';
  const contactName = customerType === 'school' ? 'Ana Novak' : customerName;
  const estimateResponse = await context.request.post('/api/orders/estimate', {
    data: {
      customerName,
      customerLabels:
        customerType === 'school' ? [customerName, contactName] : [],
      items: [{ variantId: VARIANT_ID, quantity }]
    }
  });
  await requireOk(estimateResponse, 'quote estimate');
  const estimate = (await estimateResponse.json()) as Estimate;
  expect(estimate.quoteFingerprint).toMatch(
    /^order-(?:estimate|quote)-v1:[a-f0-9]{64}$/u
  );

  const response = await context.request.post('/api/quote-requests', {
    headers: {
      ...ORIGIN_HEADERS,
      'X-Forwarded-For': networkSubject,
      'Idempotency-Key': `quote-request-${randomUUID()}`
    },
    data: {
      customerType,
      customerName,
      organizationName: customerType === 'school' ? customerName : '',
      contactName,
      email,
      addressLine1: 'Testna ulica 1',
      city: 'Ljubljana',
      postalCode: '1000',
      countryCode: 'SI',
      reference: `E2E-${input.label}`,
      quoteReason: 'formal_offer',
      quoteMessage: `E2E ${input.label}`,
      shippingConfigurationVersion: estimate.shippingConfigurationVersion,
      estimateFingerprint: estimate.quoteFingerprint,
      items: [{ variantId: VARIANT_ID, quantity }]
    }
  });
  await requireOk(response, 'quote request');
  expect(response.status()).toBe(201);
  const payload = (await response.json()) as {
    accessId?: string;
    requestNumber?: unknown;
  };
  expect(payload.accessId).toMatch(/^[0-9a-f-]{36}$/u);
  expect(payload).not.toHaveProperty('requestNumber');

  const stored = await database.query<{
    id: string | number;
    request_number: string;
    draft_offer_version_id: string | number;
    delivery_terms: string;
    payment_terms: string;
  }>(
    `
      select
        request.id,
        request.request_number,
        offer.id as draft_offer_version_id,
        offer.delivery_terms,
        offer.payment_terms
      from quote_requests request
      join quote_offer_versions offer
        on offer.quote_request_id = request.id
       and offer.status = 'draft'
      where request.email = $1
    `,
    [email]
  );
  expect(stored.rowCount).toBe(1);
  expect(stored.rows[0]).toMatchObject({
    delivery_terms: DEFAULT_QUOTE_DELIVERY_TERMS,
    payment_terms: DEFAULT_QUOTE_PAYMENT_TERMS
  });
  return {
    context,
    quoteRequestId: Number(stored.rows[0].id),
    requestNumber: String(stored.rows[0].request_number),
    accessId: String(payload.accessId),
    draftOfferVersionId: Number(stored.rows[0].draft_offer_version_id),
    email,
    customerType
  };
}

async function issueOffer(
  adminRequest: APIRequestContext,
  fixture: QuoteRequestFixture,
  input: {
    validUntil?: string;
    processDocument?: boolean;
    termsVersion?: string;
  } = {}
): Promise<IssuedOffer> {
  const state = await database.query<{
    request_state_version: string | number;
    offer_state_version: string | number;
  }>(
    `
      select
        request.state_version as request_state_version,
        offer.state_version as offer_state_version
      from quote_requests request
      join quote_offer_versions offer on offer.id = $2
      where request.id = $1
    `,
    [fixture.quoteRequestId, fixture.draftOfferVersionId]
  );
  const validUntil =
    input.validUntil ?? new Date(Date.now() + 15 * 86_400_000).toISOString();
  const termsVersion = input.termsVersion ?? 'e2e-quote-terms-v1';
  const termsText =
    'Sprejem ponudbe je zavezujoč in povzroči obveznost plačila v skladu z navedenimi plačilnimi pogoji.';

  const draftResponse = await adminRequest.put(
    `/api/admin/quote-requests/${fixture.quoteRequestId}/draft`,
    {
      data: {
        offerVersionId: fixture.draftOfferVersionId,
        expectedStateVersion: Number(state.rows[0].offer_state_version),
        validUntil,
        shipping: 0,
        confirmFreeShipping: true,
        deliveryTerms: 'Dobava v petih delovnih dneh.',
        paymentTerms: 'Plačilo v 30 dneh.',
        sellerMessage: 'E2E izdana ponudba',
        customerVisibleNotes: 'Cene in pogoji so zamrznjeni v tej različici.',
        termsText,
        termsVersion,
        acceptanceMethod:
          fixture.customerType === 'school' ? 'purchase_order' : 'online'
      }
    }
  );
  await requireOk(draftResponse, 'save quote draft');
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
    shippingReason: 'E2E izrecna potrditev brezplačne dostave.'
  };
  const challengeResponse = await adminRequest.post(issuePath, {
    data: issueData
  });
  const customerEmailConfirmationToken =
    await readCustomerEmailConfirmationToken(
      challengeResponse,
      'issue quote offer'
    );
  const issueResponse = await adminRequest.post(issuePath, {
    data: { ...issueData, customerEmailConfirmationToken }
  });
  await requireOk(issueResponse, 'issue quote offer');
  expect(issueResponse.status()).toBe(201);
  const issued = (await issueResponse.json()) as {
    quoteOfferVersionId: number;
    offerNumber: string;
    versionNumber: number;
    contentHash: string;
    termsHash: string;
    validUntil: string;
  };
  const result: IssuedOffer = {
    ...fixture,
    quoteOfferVersionId: issued.quoteOfferVersionId,
    offerNumber: issued.offerNumber,
    versionNumber: issued.versionNumber,
    contentHash: issued.contentHash,
    termsHash: issued.termsHash,
    validUntil: issued.validUntil
  };

  if (input.processDocument !== false) {
    await processQuoteWorkflow(adminRequest);
    await expect.poll(
      async () => {
        const document = await database.query(
          `
            select 1
            from quote_offer_versions offer
            join quote_documents document
              on document.quote_offer_version_id = offer.id
             and document.document_type = 'offer'
            where offer.id = $1
              and offer.document_sha256 is not null
          `,
          [issued.quoteOfferVersionId]
        );
        return document.rowCount;
      },
      {
        message: `immutable PDF for ${issued.offerNumber} should be bound`,
        timeout: 20_000
      }
    ).toBe(1);
  }
  return result;
}

async function extractOfferToken(offer: IssuedOffer): Promise<{
  jobId: string;
  token: string;
}> {
  const result = await database.query<{
    id: string;
    payload_json: unknown;
  }>(
    `
      select id, payload_json
      from quote_email_jobs
      where quote_request_id = $1
        and quote_offer_version_id = $2
        and event_type = 'quote_issued'
        and audience = 'customer'
      order by created_at desc
      limit 1
    `,
    [offer.quoteRequestId, offer.quoteOfferVersionId]
  );
  expect(result.rowCount).toBe(1);
  const row = result.rows[0];
  const envelope = JSON.parse(
    decryptQuoteEmailEnvelopeForTest(row.payload_json, {
      jobId: row.id,
      requestId: offer.quoteRequestId,
      offerVersionId: offer.quoteOfferVersionId
    })
  ) as EmailEnvelope;
  const match = envelope.message?.text?.match(
    /#token=(ath_quote_[A-Za-z0-9_-]{43})/u
  );
  expect(match?.[1]).toBeTruthy();
  return { jobId: row.id, token: String(match?.[1]) };
}

async function openOfferSession(
  offer: IssuedOffer,
  token: string
): Promise<{ session: OfferSession; snapshot: Record<string, unknown> }> {
  const exchangeResponse = await offer.context.request.post(
    '/api/quote-requests/access-session',
    {
      headers: ORIGIN_HEADERS,
      data: { token, purpose: 'offer' }
    }
  );
  await requireOk(exchangeResponse, 'quote access exchange');
  const exchange = (await exchangeResponse.json()) as {
    accessId?: string;
    csrfToken?: string;
  };
  expect(exchange.accessId).toMatch(/^[0-9a-f-]{36}$/u);
  expect(exchange.csrfToken).toMatch(/^[A-Za-z0-9_-]{43}$/u);
  const session = {
    accessId: String(exchange.accessId),
    csrfToken: String(exchange.csrfToken)
  };
  const offerResponse = await offer.context.request.get(
    '/api/quote-requests/offer',
    { headers: mutationHeaders(session) }
  );
  await requireOk(offerResponse, 'quote offer review');
  const snapshot = (await offerResponse.json()) as Record<string, unknown>;
  expect(snapshot).toMatchObject({
    offerNumber: offer.offerNumber,
    versionNumber: offer.versionNumber,
    status: 'issued',
    isCurrent: true,
    responseEnabled: true
  });
  return { session, snapshot };
}

async function verifyOfferEmail(offer: IssuedOffer, session: OfferSession) {
  const requestResponse = await offer.context.request.post(
    '/api/quote-requests/offer/otp/request',
    { headers: mutationHeaders(session), data: {} }
  );
  await requireOk(requestResponse, 'request quote OTP');
  const otp = (await requestResponse.json()) as {
    verificationId?: string;
  };
  expect(otp.verificationId).toMatch(/^[0-9a-f-]{36}$/u);
  const otpJob = await database.query<{
    id: string;
    payload_json: unknown;
  }>(
    `
      select id, payload_json
      from quote_email_jobs
      where quote_request_id = $1
        and quote_offer_version_id = $2
        and event_key = $3
        and event_type = 'quote_access_otp'
        and audience = 'customer'
      order by created_at desc
      limit 1
    `,
    [
      offer.quoteRequestId,
      offer.quoteOfferVersionId,
      `quote-access-otp:${otp.verificationId}`
    ]
  );
  expect(otpJob.rowCount).toBe(1);
  const otpEnvelope = JSON.parse(
    decryptQuoteEmailEnvelopeForTest(otpJob.rows[0].payload_json, {
      jobId: otpJob.rows[0].id,
      requestId: offer.quoteRequestId,
      offerVersionId: offer.quoteOfferVersionId
    })
  ) as EmailEnvelope;
  const code = otpEnvelope.message?.text?.match(/\b(\d{6})\b/u)?.[1];
  expect(code).toMatch(/^\d{6}$/u);
  const verifyResponse = await offer.context.request.post(
    '/api/quote-requests/offer/otp/verify',
    {
      headers: mutationHeaders(session),
      data: {
        verificationId: otp.verificationId,
        code
      }
    }
  );
  await requireOk(verifyResponse, 'verify quote OTP');
  await expect(verifyResponse.json()).resolves.toMatchObject({ verified: true });
  return String(otp.verificationId);
}

async function createDirectOrder(
  request: APIRequestContext,
  label: string
): Promise<number> {
  const email = `direct-${label}-${randomUUID()}@example.com`;
  const estimateResponse = await request.post('/api/orders/estimate', {
    data: {
      customerName: 'E2E neposredni kupec',
      items: [{ variantId: VARIANT_ID, quantity: 1 }]
    }
  });
  await requireOk(estimateResponse, 'direct order estimate');
  const estimate = (await estimateResponse.json()) as Estimate;
  const createResponse = await request.post('/api/orders', {
    headers: { 'Idempotency-Key': `direct-order-${randomUUID()}` },
    data: {
      customerType: 'individual',
      customerName: 'E2E neposredni kupec',
      organizationName: '',
      contactName: 'E2E neposredni kupec',
      email,
      addressLine1: 'Testna ulica 1',
      city: 'Ljubljana',
      postalCode: '1000',
      countryCode: 'SI',
      reference: `DIRECT-${label}`,
      notes: '',
      items: [{ variantId: VARIANT_ID, quantity: 1 }],
      shippingConfigurationVersion: estimate.shippingConfigurationVersion,
      quoteFingerprint: estimate.quoteFingerprint
    }
  });
  await requireOk(createResponse, 'direct order creation');
  expect(createResponse.status()).toBe(201);
  const stored = await database.query<{ id: string | number }>(
    'select id from orders where email = $1 order by id desc limit 1',
    [email]
  );
  expect(stored.rowCount).toBe(1);
  return Number(stored.rows[0].id);
}

async function restoreSettings(
  table: 'order_email_settings' | 'quote_email_settings',
  key: string,
  original: StoredSettingsRow | null
) {
  if (!original) {
    await database.query(`delete from ${table} where key = $1`, [key]);
    return;
  }
  await database.query(
    `
      insert into ${table} (key, config_json, updated_at)
      values ($1, $2::jsonb, $3)
      on conflict (key)
      do update set config_json = excluded.config_json,
                    updated_at = excluded.updated_at
    `,
    [key, JSON.stringify(original.config_json), original.updated_at]
  );
}

test.use({ storageState: ADMIN_STORAGE_STATE_PATH });
test.describe.configure({ mode: 'serial' });

test.describe('quote and seller-contract workflow', () => {
  test.beforeAll(async () => {
    const databaseUrl = process.env.E2E_DATABASE_URL?.trim();
    if (!databaseUrl) {
      throw new Error('[e2e-preflight] E2E_DATABASE_URL is required.');
    }
    database = new Pool({ connectionString: databaseUrl, ssl: false });

    const [orderSettings, quoteSettings] = await Promise.all([
      database.query<StoredSettingsRow>(
        `select config_json, updated_at from order_email_settings where key = 'order-email-notifications'`
      ),
      database.query<StoredSettingsRow>(
        `select config_json, updated_at from quote_email_settings where key = 'default'`
      )
    ]);
    originalOrderEmailSettings = orderSettings.rows[0] ?? null;
    originalQuoteEmailSettings = quoteSettings.rows[0] ?? null;

    const sharedEmail = cloneDefaultOrderEmailSettings();
    sharedEmail.enabled = false;
    sharedEmail.senderName = 'Atehna E2E';
    sharedEmail.fromEmail = 'quotes@e2e.example.com';
    sharedEmail.replyToEmail = 'support@e2e.example.com';
    sharedEmail.adminRecipients = [];
    sharedEmail.siteUrl = 'https://www.atehna-test.site';
    const { updatedAt: _sharedUpdatedAt, ...storedSharedEmail } = sharedEmail;

    const quoteEmail = cloneDefaultQuoteEmailSettings();
    quoteEmail.enabled = true;
    quoteEmail.stockAcceptanceMode = 'automatic';
    for (const event of Object.keys(quoteEmail.events)) {
      quoteEmail.events[event as keyof typeof quoteEmail.events] = {
        customer: false,
        admins: false
      };
    }
    quoteEmail.events.quote_issued.customer = true;
    quoteEmail.events.quote_access_otp.customer = true;
    quoteEmail.events.quote_clarification_requested.customer = true;
    const { updatedAt: _quoteUpdatedAt, ...storedQuoteEmail } = quoteEmail;

    await database.query(
      `
        insert into order_email_settings (key, config_json, updated_at)
        values ('order-email-notifications', $1::jsonb, now())
        on conflict (key)
        do update set config_json = excluded.config_json, updated_at = now()
      `,
      [JSON.stringify(storedSharedEmail)]
    );
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
    await restoreSettings(
      'order_email_settings',
      'order-email-notifications',
      originalOrderEmailSettings
    );
    await restoreSettings(
      'quote_email_settings',
      'default',
      originalQuoteEmailSettings
    );
    await (database as PgPool & { end: () => Promise<void> }).end();
  });

  test('quote list mirrors order selection and safe toolbar controls', async ({
    browser,
    page,
    request
  }) => {
    test.setTimeout(90_000);
    await page.setViewportSize({ width: 1440, height: 1000 });
    const token = `table-parity-${randomUUID()}`;
    const first = await createQuoteRequest(browser, {
      label: `${token}-first`
    });
    const second = await createQuoteRequest(browser, {
      label: `${token}-second`
    });

    try {
      await issueOffer(request, first);
      await page.goto(
        `/admin/orders?view=quotes&q=${encodeURIComponent(`E2E-${token}`)}`
      );

      const table = page.getByTestId('admin-quotes-table');
      const toolbar = page.getByTestId('quote-table-toolbar-actions');
      const selectAll = page.getByTestId('quote-table-select-all');
      const firstSelection = page.getByTestId(
        `quote-table-select-${first.quoteRequestId}`
      );
      const secondSelection = page.getByTestId(
        `quote-table-select-${second.quoteRequestId}`
      );
      const firstRow = page.getByTestId(
        `quote-table-row-${first.quoteRequestId}`
      );
      const downloadAll = toolbar.getByRole('button', {
        name: 'Prenesi vse dokumente'
      });
      const columnsButton = toolbar.getByRole('button', {
        name: 'Filtriraj stolpce'
      });
      const deleteSelected = toolbar.getByTestId(
        'quote-table-delete-selected'
      );

      await expect(table).toBeVisible();
      await expect(firstSelection).not.toBeChecked();
      await expect(secondSelection).not.toBeChecked();
      await expect(selectAll).not.toBeChecked();
      await expect(deleteSelected).toBeVisible();
      await expect(deleteSelected).toBeDisabled();

      const [downloadBox, columnsBox] = await Promise.all([
        downloadAll.boundingBox(),
        columnsButton.boundingBox()
      ]);
      expect(downloadBox).not.toBeNull();
      expect(columnsBox).not.toBeNull();
      expect(Math.abs((downloadBox?.height ?? 0) - (columnsBox?.height ?? 0))).toBeLessThanOrEqual(1);
      expect(Math.abs((downloadBox?.y ?? 0) - (columnsBox?.y ?? 0))).toBeLessThanOrEqual(1);
      expect(
        (columnsBox?.x ?? 0) -
          ((downloadBox?.x ?? 0) + (downloadBox?.width ?? 0))
      ).toBeGreaterThanOrEqual(4);

      await firstSelection.check();
      await expect(firstSelection).toBeChecked();
      await expect(firstRow).toHaveClass(/admin-table-row-selected/u);
      expect(
        await selectAll.evaluate(
          (element: HTMLInputElement) => element.indeterminate
        )
      ).toBe(true);
      await expect(
        toolbar.getByRole('button', { name: 'Prenesi izbrane (1)' })
      ).toBeVisible();
      await expect(deleteSelected).toBeEnabled();

      await selectAll.check();
      await expect(firstSelection).toBeChecked();
      await expect(secondSelection).toBeChecked();
      await expect(deleteSelected).toBeEnabled();
      await selectAll.uncheck();
      await expect(firstSelection).not.toBeChecked();
      await expect(secondSelection).not.toBeChecked();
      await expect(deleteSelected).toBeDisabled();

      await columnsButton.click();
      const columnsMenu = page.getByRole('menu', {
        name: 'Filtriraj stolpce'
      });
      await expect(
        columnsMenu.getByRole('checkbox', { name: 'Rezultat' })
      ).toHaveCount(0);
      await expect(
        table.getByRole('columnheader', { name: 'Rezultat' })
      ).toHaveCount(0);
      await columnsButton.click();

      await firstSelection.check();
      const selectedDownload = toolbar.getByRole('button', {
        name: 'Prenesi izbrane (1)'
      });
      const [download] = await Promise.all([
        page.waitForEvent('download'),
        selectedDownload.click()
      ]);
      expect(download.suggestedFilename()).toMatch(/\.pdf$/u);

      const search = table.getByRole('searchbox', {
        name: 'Poišči povpraševanja in ponudbe'
      });
      await search.fill(second.email);
      await expect(secondSelection).toBeVisible();
      await expect(firstSelection).toHaveCount(0);
      await expect(selectAll).not.toBeChecked();
      await expect(
        toolbar.getByRole('button', { name: 'Prenesi vse dokumente' })
      ).toBeVisible();
    } finally {
      await Promise.all([first.context.close(), second.context.close()]);
    }
  });

  test('admin quote detail matches order styling and persists customer edits and catalog item selection', async ({
    browser,
    page
  }, testInfo) => {
    test.setTimeout(90_000);
    await page.setViewportSize({ width: 1440, height: 1000 });
    const fixture = await createQuoteRequest(browser, { label: 'admin-detail-edit' });
    try {
      const confirmationPage = await fixture.context.newPage();
      await confirmationPage.addInitScript((accessId) => {
        window.sessionStorage.setItem('atehna-quote-access-id-v1', accessId);
      }, fixture.accessId);
      const confirmationResponsePromise = confirmationPage.waitForResponse(
        (response) =>
          response.request().method() === 'GET' &&
          response.url().endsWith('/api/quote-requests/confirmation')
      );
      await confirmationPage.goto('/quote-request/confirmation');
      await expect(
        confirmationPage.getByTestId('quote-request-submission-status')
      ).toBeVisible();

      const confirmationResponse = await confirmationResponsePromise;
      await requireOk(confirmationResponse, 'quote confirmation');
      const confirmationSnapshot = (await confirmationResponse.json()) as {
        requestNumber?: unknown;
        customer?: {
          customerType?: unknown;
          organizationName?: unknown;
          contactName?: unknown;
          email?: unknown;
          addressLine1?: unknown;
          addressLine2?: unknown;
          city?: unknown;
          postalCode?: unknown;
        };
        items?: Array<{ imageUrl?: string | null }>;
      };
      expect(confirmationSnapshot).not.toHaveProperty('requestNumber');
      expect(confirmationSnapshot.customer).toEqual({
        customerType: 'individual',
        organizationName: null,
        contactName: 'E2E kupec',
        email: fixture.email,
        addressLine1: 'Testna ulica 1',
        addressLine2: null,
        city: 'Ljubljana',
        postalCode: '1000'
      });
      expect(confirmationSnapshot.items?.[0]?.imageUrl).toBe(
        '/images/categories/materiali.png'
      );
      const confirmationMedia = confirmationPage
        .getByTestId('quote-request-confirmation-item-media')
        .first();
      await expect(confirmationMedia.locator('img')).toBeVisible();
      await expect(confirmationMedia.locator('img')).toHaveAttribute(
        'src',
        /materiali/u
      );
      const customerSection = confirmationPage.getByTestId(
        'quote-request-confirmation-customer-section'
      );
      await expect(
        customerSection.getByRole('heading', {
          name: 'Podatki o povpraševanju',
          exact: true
        })
      ).toBeVisible();
      await expect(customerSection).toContainText(fixture.email);
      await expect(customerSection).toContainText('Testna ulica 1');
      await expect(customerSection).toContainText('1000 Ljubljana');
      const confirmationShippingRows = confirmationPage.locator(
        '[data-summary-row="shipping"]'
      );
      await expect(confirmationShippingRows).toHaveCount(1);
      await expect(
        confirmationShippingRows.getByText('Poštnina', { exact: true })
      ).toBeVisible();
      await expect(
        confirmationPage.getByText('Osnovna poštnina', { exact: true })
      ).toHaveCount(0);
      await expect(
        confirmationPage.getByText('Samodejno izračunana poštnina', {
          exact: true
        })
      ).toHaveCount(0);
      await expect(confirmationPage.locator('body')).not.toContainText(
        fixture.requestNumber
      );
      await confirmationPage.close();

      await page.goto(`/admin/orders/quotes/${fixture.quoteRequestId}`);
      await expect(page.getByTestId('admin-quote-detail')).toBeVisible();

      const requestCard = page.getByTestId('quote-request-details-card');
      const offerCard = page.getByTestId('quote-offer-card');
      const documentsCard = page.getByTestId('quote-documents-card');
      const customerAccessCard = page.getByTestId(
        'quote-customer-access-card'
      );
      const workflowStatus = page.getByTestId('quote-workflow-status');
      const workflowStatusControl = page.getByTestId(
        'quote-workflow-status-control'
      );
      const workflowStatusEditButton = page.getByTestId(
        'quote-header-status-edit'
      );
      const quoteDetailHeader = page.getByTestId('quote-detail-header');
      const activityTimeline = quoteDetailHeader.getByTestId(
        'quote-activity-timeline'
      );
      await expect(requestCard).toBeVisible();
      await expect(offerCard).toBeVisible();
      await expect(documentsCard).toBeVisible();
      await expect(customerAccessCard).toHaveCount(1);
      await expect(customerAccessCard).toBeVisible();
      await expect(
        customerAccessCard.getByRole('heading', {
          name: 'Stranka in dostop',
          exact: true
        })
      ).toBeVisible();
      const accessSummary = customerAccessCard.locator('dl').first();
      for (const label of [
        'Dostop stranke',
        'Aktivne povezave',
        'Velja do',
        'Zadnja uporaba'
      ]) {
        await expect(
          accessSummary.getByText(label, { exact: true })
        ).toBeVisible();
      }
      await expect(
        accessSummary.getByText('Omogočen', { exact: true })
      ).toBeVisible();
      await expect(
        accessSummary
          .getByText('Aktivne povezave', { exact: true })
          .locator('..')
      ).toContainText('1');
      const emailEvidence = customerAccessCard.getByTestId(
        'quote-email-evidence'
      );
      await expect(emailEvidence).toBeVisible();
      await expect(
        emailEvidence.getByRole('heading', { name: 'E-pošta', exact: true })
      ).toBeVisible();
      await expect(emailEvidence).toContainText(
        'E-poštnih opravil še ni.'
      );
      await expect(page.getByTestId('quote-email-card')).toHaveCount(0);
      await expect(activityTimeline).toBeVisible();
      const compactActivityLabels = activityTimeline.locator(
        '[data-activity-compact-label]'
      );
      await expect(
        compactActivityLabels.filter({ hasText: 'Osnutek ·' }).first()
      ).toBeVisible();
      await expect(activityTimeline).not.toContainText('Osnutek ponudbe ustvarjen');
      await expect(activityTimeline).not.toContainText('Osnutek ponudbe spremenjen');
      await expect(activityTimeline.locator('[title^="Osnutek ponudbe ustvarjen"]').first()).toBeVisible();
      await expect(
        page.locator('aside [data-testid="quote-activity-timeline"]')
      ).toHaveCount(0);
      const eventGeometry = await activityTimeline.locator('li').evaluateAll((items) =>
        items.map((item) => {
          const bounds = item.getBoundingClientRect();
          return { x: bounds.x, y: bounds.y };
        })
      );
      expect(eventGeometry.length).toBeGreaterThan(1);
      expect(eventGeometry.length).toBeLessThanOrEqual(5);
      for (let index = 1; index < eventGeometry.length; index += 1) {
        expect(eventGeometry[index]!.x).toBeGreaterThan(eventGeometry[index - 1]!.x);
        expect(
          Math.abs(eventGeometry[index]!.y - eventGeometry[0]!.y)
        ).toBeLessThanOrEqual(1);
      }
      const requestDetailRows = requestCard.locator('[data-quote-detail-row]');
      const requestDetailRow = (label: string) =>
        requestCard.locator(`[data-quote-detail-row="${label}"]`);
      const requestEditButton = requestCard.getByRole('button', {
        name: 'Uredi podatke povpraševanja'
      });
      const offerEditAction = offerCard.locator(
        '[data-admin-card-edit-action="quote-offer"]'
      );
      const adminNotesCard = page.getByTestId('quote-admin-notes-card');
      const notesEditAction = adminNotesCard.locator(
        '[data-admin-card-edit-action="quote-admin-notes"]'
      );
      const editPencils = [
        workflowStatusEditButton,
        requestEditButton,
        offerEditAction,
        notesEditAction
      ];
      for (const pencil of editPencils) {
        await expect(pencil).toBeVisible();
        await expect(pencil).toBeEnabled();
        await expect(pencil.locator('svg')).toHaveCount(1);
        expect((await pencil.textContent())?.trim()).toBe('');
      }
      const pencilVisuals = await Promise.all(
        editPencils.map((pencil) => pencil.evaluate((element) => ({
          color: getComputedStyle(element).color,
          opacity: getComputedStyle(element).opacity
        })))
      );
      expect(new Set(pencilVisuals.map((visual) => visual.color)).size).toBe(1);
      expect(pencilVisuals.every((visual) => visual.opacity === '1')).toBe(true);
      await expect(
        requestCard.getByRole('heading', { name: 'Podatki povpraševanja' })
      ).toBeVisible();
      await expect(requestDetailRows).toHaveCount(8);
      await expect(requestCard.locator('input, select, textarea')).toHaveCount(0);
      await expect(requestDetailRow('Naslov')).toContainText('Testna ulica 1');
      await expect(requestDetailRow('Naslov')).toContainText('1000 Ljubljana');
      await expect(requestDetailRow('Naslov')).toContainText('SI');
      await expect(requestDetailRow('Kaj potrebuje?')).toContainText(
        'Formalno ponudbo za izbrane artikle'
      );
      await expect(requestEditButton).toBeVisible();
      await expect(offerEditAction).toBeVisible();
      await expect(offerEditAction).toHaveAttribute('aria-label', 'Uredi ponudbo');
      const offerDocumentRow = page.getByTestId('quote-document-type-offer');
      const purchaseOrderDocumentRow = page.getByTestId(
        'quote-document-type-purchase_order'
      );
      await expect(offerDocumentRow).toContainText('Ponudba');
      const uploadOfferDocument = offerDocumentRow.getByRole('button', {
        name: 'Naloži ponudbo',
        exact: true
      });
      const offerDocumentActions = offerDocumentRow.getByRole('button', {
        name: 'Dejanja za Ponudba'
      });
      await expect(uploadOfferDocument).toBeVisible();
      await expect(uploadOfferDocument).toHaveText('Naloži');
      await expect(uploadOfferDocument).toBeEnabled();
      await expect(
        offerDocumentRow.getByRole('link', {
          name: 'Odpri PDF ponudbe',
          exact: true
        })
      ).toHaveCount(0);
      await expect(offerDocumentActions).toBeVisible();
      await offerDocumentActions.click();
      const preIssueOfferDocumentMenu = page.getByRole('menu', {
        name: 'Dejanja za Ponudba'
      });
      await expect(preIssueOfferDocumentMenu).toBeVisible();
      await expect(
        preIssueOfferDocumentMenu.getByRole('menuitem', {
          name: 'Ustvari uradni PDF',
          exact: true
        })
      ).toBeDisabled();
      await expect(
        preIssueOfferDocumentMenu.getByRole('menuitem', {
          name: 'Naloži PDF',
          exact: true
        })
      ).toBeEnabled();
      await expect(
        preIssueOfferDocumentMenu.getByRole('menuitem', {
          name: 'Prenesi',
          exact: true
        })
      ).toHaveCount(0);
      await offerDocumentActions.click();
      await expect(preIssueOfferDocumentMenu).toHaveCount(0);
      await expect(purchaseOrderDocumentRow).toContainText(
        'Naročilnico lahko naloži administrator ali stranka'
      );
      await expect(
        purchaseOrderDocumentRow.getByRole('link', { name: /^Odpri/u })
      ).toHaveCount(0);
      const uploadPurchaseOrderDocument = purchaseOrderDocumentRow.getByRole(
        'button',
        { name: 'Naloži naročilnico', exact: true }
      );
      const purchaseOrderDocumentActions = purchaseOrderDocumentRow.getByRole(
        'button',
        { name: 'Dejanja za Naročilnica' }
      );
      await expect(uploadPurchaseOrderDocument).toBeVisible();
      await expect(uploadPurchaseOrderDocument).toHaveText('Naloži');
      await expect(uploadPurchaseOrderDocument).toBeEnabled();
      await expect(purchaseOrderDocumentActions).toBeVisible();
      await purchaseOrderDocumentActions.click();
      const preIssuePurchaseOrderDocumentMenu = page.getByRole('menu', {
        name: 'Dejanja za Naročilnica'
      });
      await expect(
        preIssuePurchaseOrderDocumentMenu.getByRole('menuitem', {
          name: 'Naloži PDF',
          exact: true
        })
      ).toBeEnabled();
      await expect(
        preIssuePurchaseOrderDocumentMenu.getByRole('menuitem', {
          name: 'Prenesi',
          exact: true
        })
      ).toHaveCount(0);
      await purchaseOrderDocumentActions.click();
      await expect(preIssuePurchaseOrderDocumentMenu).toHaveCount(0);
      await expect(workflowStatus).toContainText('Prejeto');
      await expect(workflowStatus).not.toContainText('Osnutek');
      await expect(workflowStatus).toHaveAttribute(
        'title',
        /Povpraševanje je prejeto/u
      );
      await expect(workflowStatus).not.toHaveAttribute('title', /samodejno/u);
      await expect(
        quoteDetailHeader.getByText('Status', { exact: true })
      ).toHaveCount(0);
      await workflowStatusControl.click();
      await expect(page.getByRole('menu')).toHaveCount(0);
      await expect(page.getByTestId('quote-action-close-without-offer')).toBeVisible();
      await expect(page.getByTestId('quote-action-withdraw-offer')).toHaveCount(0);
      expect(await requestCard.evaluate((element) => getComputedStyle(element).borderRadius)).toBe('16px');
      expect(await offerCard.evaluate((element) => getComputedStyle(element).borderRadius)).toBe('16px');

      const readRequestCardBox = await requestCard.boundingBox();
      const readRequestRowGeometry = await requestDetailRows.evaluateAll((rows) =>
        rows.map((row) => {
          const bounds = row.getBoundingClientRect();
          return {
            label: row.getAttribute('data-quote-detail-row'),
            x: bounds.x,
            y: bounds.y,
            width: bounds.width,
            height: bounds.height
          };
        })
      );
      expect(readRequestRowGeometry).toHaveLength(8);
      for (const row of readRequestRowGeometry) {
        expect(Math.abs(row.height - 35)).toBeLessThanOrEqual(1);
      }
      const normalRequestRow = readRequestRowGeometry.find(
        (row) => row.label === 'Tip naročnika'
      );
      const addressRequestRow = readRequestRowGeometry.find(
        (row) => row.label === 'Naslov'
      );
      const customerMessageRequestRow = readRequestRowGeometry.find(
        (row) => row.label === 'Sporočilo stranke'
      );
      expect(addressRequestRow?.width ?? 0).toBeGreaterThan(
        (normalRequestRow?.width ?? 0) * 1.9
      );
      expect(
        Math.abs(
          (addressRequestRow?.width ?? 0) - (customerMessageRequestRow?.width ?? 0)
        )
      ).toBeLessThanOrEqual(1);

      const comparisonTable = offerCard.getByTestId('quote-items-comparison-table');
      const requestedItemRow = comparisonTable.locator('tr[data-item-row="requested"]').first();
      const offeredItemRow = comparisonTable.locator('tr[data-item-row="offered"]').first();
      await expect(comparisonTable).toBeVisible();
      await expect(page.locator('table')).toHaveCount(1);
      await expect(offerCard.locator('table')).toHaveCount(1);
      await expect(comparisonTable.getByRole('columnheader', { name: 'SKU', exact: true })).toHaveCount(0);
      const comparisonOverflow = await comparisonTable.evaluate((table) => {
        const container = table.parentElement;
        return {
          clientWidth: container?.clientWidth ?? 0,
          scrollWidth: container?.scrollWidth ?? Number.POSITIVE_INFINITY
        };
      });
      expect(comparisonOverflow.scrollWidth).toBeLessThanOrEqual(comparisonOverflow.clientWidth + 1);
      await expect(requestedItemRow).toContainText('Aluminijasta plošča');
      await expect(requestedItemRow.locator('input')).toHaveCount(0);
      const nestedSku = requestedItemRow.getByText('SKU: MAT-KOV-ALU-100', { exact: true });
      await expect(nestedSku).toBeVisible();
      expect(await nestedSku.evaluate((element) => getComputedStyle(element).fontSize)).toBe('10px');
      const [requestedRowBox, offeredRowBox] = await Promise.all([
        requestedItemRow.boundingBox(),
        offeredItemRow.boundingBox()
      ]);
      expect(offeredRowBox?.y).toBeGreaterThan(requestedRowBox?.y ?? 0);
      await expect(
        offeredItemRow.locator('input:not([type="checkbox"])')
      ).toHaveCount(0);
      await expect(
        offeredItemRow.getByRole('checkbox', {
          name: /^Izberi ponujeno postavko/u
        })
      ).toBeDisabled();
      const offerDetails = offerCard.getByTestId('quote-offer-details');
      const offerActionBar = offerCard.getByTestId('quote-offer-action-bar');
      await expect(offerDetails.locator('input, textarea, select')).toHaveCount(0);
      await page.evaluate(() => document.fonts.ready);
      const captureOfferLayout = () => offerCard.evaluate((card) => {
        const dimensions = ['x', 'y', 'width', 'height'] as const;
        const box = (element: Element | null) => {
          if (!element) throw new Error('Expected stable quote offer element.');
          const bounds = element.getBoundingClientRect();
          return Object.fromEntries(
            dimensions.map((dimension) => [dimension, bounds[dimension]])
          ) as Record<(typeof dimensions)[number], number>;
        };
        return {
          card: box(card),
          details: box(card.querySelector('[data-testid="quote-offer-details"]')),
          actionBar: box(card.querySelector('[data-testid="quote-offer-action-bar"]')),
          fields: Array.from(card.querySelectorAll('[data-quote-offer-field]')).map((field) => ({
            key: field.getAttribute('data-quote-offer-field'),
            ...box(field)
          })),
          items: Array.from(card.querySelectorAll('[data-item-row]')).map((row, index) => ({
            key: `${row.getAttribute('data-item-row')}:${index}`,
            ...box(row)
          }))
        };
      });
      const readOfferLayout = await captureOfferLayout();
      await expect(offerDetails).toBeVisible();
      await expect(offerActionBar).toBeVisible();
      await offerEditAction.click();
      await expect(page.getByLabel('Velja do')).toBeVisible();
      await page.evaluate(() => document.fonts.ready);
      const editOfferLayout = await captureOfferLayout();
      const expectSameBox = (
        readBox: Record<'x' | 'y' | 'width' | 'height', number>,
        editBox: Record<'x' | 'y' | 'width' | 'height', number>
      ) => {
        for (const dimension of ['x', 'y', 'width', 'height'] as const) {
          expect(Math.abs(editBox[dimension] - readBox[dimension])).toBeLessThanOrEqual(1);
        }
      };
      expectSameBox(readOfferLayout.card, editOfferLayout.card);
      expectSameBox(readOfferLayout.details, editOfferLayout.details);
      expectSameBox(readOfferLayout.actionBar, editOfferLayout.actionBar);
      expect(editOfferLayout.fields).toHaveLength(readOfferLayout.fields.length);
      expect(editOfferLayout.items).toHaveLength(readOfferLayout.items.length);
      for (const [index, editField] of editOfferLayout.fields.entries()) {
        const readField = readOfferLayout.fields[index]!;
        expect(editField.key).toBe(readField.key);
        expectSameBox(readField, editField);
      }
      for (const [index, editItem] of editOfferLayout.items.entries()) {
        const readItem = readOfferLayout.items[index]!;
        expect(editItem.key).toBe(readItem.key);
        expectSameBox(readItem, editItem);
      }
      await expect(offerEditAction).toHaveAttribute(
        'aria-label',
        'Končaj urejanje ponudbe'
      );
      const offeredCatalogSelect = offeredItemRow.getByLabel(/^Ponujeni artikel /u);
      await expect(offeredCatalogSelect).toBeVisible();
      await expect(offeredCatalogSelect).toBeEnabled();
      await expect(offeredItemRow.getByLabel(/^Naziv artikla /u)).toHaveCount(0);
      await expect(offeredItemRow.getByLabel(/^Naziv različice /u)).toHaveCount(0);
      await expect(offeredItemRow.getByLabel(/^Količina /u)).toHaveAttribute('step', '1');
      await expect(offeredItemRow.getByLabel(/^Neto cena /u)).toBeVisible();
      await expect(offeredItemRow.getByLabel(/^Popust /u)).toBeVisible();

      const assertNumericFieldsCentered = async (row: typeof requestedItemRow) => {
        const fieldGeometry = await row.locator('[data-item-field]').evaluateAll((fields) =>
          fields.map((field) => {
            const cell = field.closest('td');
            if (!cell) throw new Error('Numeric quote item field must be inside a table cell.');
            const fieldBounds = field.getBoundingClientRect();
            const cellBounds = cell.getBoundingClientRect();
            return {
              field: field.getAttribute('data-item-field'),
              horizontalOffset: Math.abs(
                fieldBounds.left + fieldBounds.width / 2 -
                (cellBounds.left + cellBounds.width / 2)
              ),
              verticalOffset: Math.abs(
                fieldBounds.top + fieldBounds.height / 2 -
                (cellBounds.top + cellBounds.height / 2)
              )
            };
          })
        );
        expect(fieldGeometry.map((entry) => entry.field)).toEqual([
          'quantity',
          'unit-net',
          'discount'
        ]);
        for (const field of fieldGeometry) {
          expect(field.horizontalOffset).toBeLessThanOrEqual(1);
          expect(field.verticalOffset).toBeLessThanOrEqual(1);
        }
      };
      await assertNumericFieldsCentered(requestedItemRow);
      await assertNumericFieldsCentered(offeredItemRow);

      const deliveryTerms = page.getByLabel('Dobavni pogoji');
      const paymentTerms = page.getByLabel('Plačilni pogoji');
      const [deliveryBox, paymentBox] = await Promise.all([
        deliveryTerms.boundingBox(),
        paymentTerms.boundingBox()
      ]);
      expect(deliveryBox?.height).toBeLessThanOrEqual(44);
      expect(paymentBox?.height).toBe(deliveryBox?.height);
      expect(
        Math.abs((paymentBox?.y ?? 0) - (deliveryBox?.y ?? 0) - 35)
      ).toBeLessThanOrEqual(1);

      const draftStateBeforeStatusChange = await database.query(
        'select state_version from quote_offer_versions where id = $1',
        [fixture.draftOfferVersionId]
      );
      await requestEditButton.click();
      await expect(
        requestCard.getByRole('button', { name: 'Končaj urejanje povpraševanja' })
      ).toBeVisible();
      await expect(requestCard.getByLabel('Poštna številka')).toBeVisible();
      await expect(requestCard.getByLabel('Kraj')).toBeVisible();
      await expect(requestCard.getByLabel('Država')).toBeVisible();
      await expect(requestCard.getByLabel('Kaj potrebuje?')).toBeVisible();
      const editRequestCardBox = await requestCard.boundingBox();
      const editRequestRowGeometry = await requestDetailRows.evaluateAll((rows) =>
        rows.map((row) => {
          const bounds = row.getBoundingClientRect();
          return {
            label: row.getAttribute('data-quote-detail-row'),
            x: bounds.x,
            y: bounds.y,
            width: bounds.width,
            height: bounds.height
          };
        })
      );
      expect(
        Math.abs(
          (editRequestCardBox?.height ?? 0) - (readRequestCardBox?.height ?? 0)
        )
      ).toBeLessThanOrEqual(1);
      expect(editRequestRowGeometry).toHaveLength(readRequestRowGeometry.length);
      for (const [index, editRow] of editRequestRowGeometry.entries()) {
        const readRow = readRequestRowGeometry[index];
        expect(editRow.label).toBe(readRow?.label);
        expect(Math.abs(editRow.x - (readRow?.x ?? 0))).toBeLessThanOrEqual(1);
        expect(Math.abs(editRow.y - (readRow?.y ?? 0))).toBeLessThanOrEqual(1);
        expect(Math.abs(editRow.width - (readRow?.width ?? 0))).toBeLessThanOrEqual(1);
        expect(Math.abs(editRow.height - (readRow?.height ?? 0))).toBeLessThanOrEqual(1);
      }
      await workflowStatusEditButton.click();
      await expect(workflowStatusEditButton).toHaveAttribute('aria-pressed', 'true');
      await workflowStatusControl.click();
      const statusMenu = page.getByRole('menu');
      await expect(statusMenu).toBeVisible();
      await expect(statusMenu.getByRole('menuitem')).toHaveCount(6);
      const blockedIssuedStatus = statusMenu.getByRole('menuitem', {
        name: /^Izdano/u
      });
      await expect(blockedIssuedStatus).toHaveAttribute(
        'aria-disabled',
        'true'
      );
      await expect(blockedIssuedStatus).toHaveAccessibleDescription(
        'Ponudbo izdajte z gumbom »Izdaj ponudbo«.'
      );
      await expect(
        statusMenu.getByRole('menuitem', { name: /^Naročeno/u })
      ).toHaveAccessibleDescription(
        'Status »Naročeno« lahko nastane samo s sprejemom stranke ali s potrditvijo naročilnice v administrativnem pregledu.'
      );
      await expect(
        statusMenu.getByRole('menuitem', { name: /^Zavrnjeno/u })
      ).toHaveAccessibleDescription(
        'Uporabite dejanje »Zaključi brez izdaje ponudbe«; zavrnitev stranke se zabeleži iz njenega odgovora.'
      );
      await expect(
        statusMenu.getByRole('menuitem', { name: /^Poteklo/u })
      ).toHaveAccessibleDescription(
        'Najprej izdajte ponudbo z datumom »Velja do«; status se nato nastavi samodejno ob poteku.'
      );
      await statusMenu.getByRole('menuitem', { name: 'V pripravi' }).click();
      await expect(workflowStatus).toContainText('V pripravi');

      const statusResponsePromise = page.waitForResponse((response) =>
        response.url().endsWith(`/api/admin/quote-requests/${fixture.quoteRequestId}/status`) &&
        response.request().method() === 'POST'
      );
      await page.getByRole('button', { name: 'Shrani', exact: true }).click();
      const statusResponse = await statusResponsePromise;
      await requireOk(statusResponse, 'save quote request status');
      const statusPayload = await statusResponse.json() as {
        status?: string;
        stateVersion?: number;
      };
      expect(statusPayload.status).toBe('in_preparation');
      expect(statusPayload.stateVersion).toBeGreaterThan(1);
      expect(statusResponse.request().postDataJSON()).toMatchObject({
        status: 'in_preparation',
        expectedRequestStateVersion: expect.any(Number)
      });

      const [requestAfterStatusChange, draftAfterStatusChange] =
        await Promise.all([
          database.query(
            'select status from quote_requests where id = $1',
            [fixture.quoteRequestId]
          ),
          database.query(
            'select state_version from quote_offer_versions where id = $1',
            [fixture.draftOfferVersionId]
          )
        ]);
      expect(requestAfterStatusChange.rows[0]?.status).toBe('in_preparation');
      expect(Number(draftAfterStatusChange.rows[0]?.state_version)).toBe(
        Number(draftStateBeforeStatusChange.rows[0]?.state_version)
      );

      await page.reload();
      await expect(workflowStatus).toContainText('V pripravi');
      await workflowStatusControl.click();
      await expect(page.getByRole('menu')).toHaveCount(0);

      await requestCard.getByRole('button', { name: 'Uredi podatke povpraševanja' }).click();
      await page.getByRole('button', { name: 'Tip naročnika' }).click();
      await page.getByRole('option', { name: 'Podjetje' }).click();
      await page.getByLabel('Naziv organizacije').fill('E2E urejen naročnik');
      await page.getByLabel('Kontaktna oseba').fill('E2E urejen kontakt');
      await page.getByLabel('Naslov', { exact: true }).fill('Urejena ulica 7');
      await page.getByLabel('Dodatni naslov').fill('2. nadstropje');
      await page.getByLabel('Poštna številka').fill('2000');
      await page.getByLabel('Kraj').fill('Maribor');
      await page.getByLabel('Referenca').fill('E2E-UREJENO');
      await page.getByLabel('Sporočilo stranke').fill('Urejeno v administraciji.');

      const detailsResponsePromise = page.waitForResponse((response) =>
        response.url().endsWith(`/api/admin/quote-requests/${fixture.quoteRequestId}/details`) &&
        response.request().method() === 'PUT'
      );
      await page.getByRole('button', { name: 'Shrani', exact: true }).click();
      const detailsResponse = await detailsResponsePromise;
      await requireOk(detailsResponse, 'save quote request details');
      expect(detailsResponse.ok()).toBe(true);

      await page.reload();
      await expect(requestDetailRow('Naziv organizacije')).toContainText('E2E urejen naročnik');
      await expect(offerEditAction).toHaveAttribute('aria-pressed', 'false');
      await offerEditAction.click();
      await expect(offerEditAction).toHaveAttribute('aria-pressed', 'true');
      const catalogSelect = page.getByLabel(/^Ponujeni artikel /u).first();
      await expect(catalogSelect).toBeEnabled();
      await catalogSelect.click();
      await page.getByRole('option', { name: /MAT-KOV-ALU-200/u }).click();
      await expect(catalogSelect).toContainText('MAT-KOV-ALU-200');
      await expect(offeredItemRow.locator('[data-item-sku]')).toHaveText(
        'SKU: MAT-KOV-ALU-200'
      );
      await page.getByLabel(/^Popust /u).first().fill('10');
      await page.getByLabel('Velja do').fill('2099-12-31');
      await page.getByLabel('Pogoji sprejema ponudbe').fill('E2E pogoji sprejema ponudbe.');
      const freeShippingConfirmation = page.getByRole('checkbox', {
        name: /Izrecno potrjujem brezplačno dostavo/u
      });
      if (await freeShippingConfirmation.count()) {
        await freeShippingConfirmation.check();
      }
      const draftResponsePromise = page.waitForResponse((response) =>
        response.url().endsWith(`/api/admin/quote-requests/${fixture.quoteRequestId}/draft`) &&
        response.request().method() === 'PUT'
      );
      await page.getByRole('button', { name: 'Shrani osnutek' }).click();
      const draftResponse = await draftResponsePromise;
      await requireOk(draftResponse, 'save edited quote draft');
      expect(draftResponse.ok()).toBe(true);

      await page.reload();
      await expect(workflowStatus).toContainText('V pripravi');
      await expect(workflowStatus).not.toContainText('Osnutek');
      await expect(requestCard.locator('input, select, textarea')).toHaveCount(0);
      await expect(requestDetailRow('Naziv organizacije')).toContainText('E2E urejen naročnik');
      await expect(requestDetailRow('Kontaktna oseba')).toContainText('E2E urejen kontakt');
      await expect(requestDetailRow('Naslov')).toContainText('Urejena ulica 7');
      await expect(requestDetailRow('Naslov')).toContainText('2. nadstropje');
      await expect(requestDetailRow('Naslov')).toContainText('2000 Maribor');
      await expect(requestDetailRow('Naslov')).toContainText('SI');
      await expect(requestDetailRow('Kaj potrebuje?')).toContainText(
        'Formalno ponudbo za izbrane artikle'
      );
      await expect(
        offeredItemRow.locator('input:not([type="checkbox"])')
      ).toHaveCount(0);
      await expect(
        offeredItemRow.getByRole('checkbox', {
          name: /^Izberi ponujeno postavko/u
        })
      ).toBeDisabled();
      await expect(offeredItemRow).toContainText('Aluminijasta plošča');
      await expect(offeredItemRow).toContainText('200 × 200 × 0,5 mm');
      await expect(offeredItemRow.locator('[data-item-sku]')).toHaveText(
        'SKU: MAT-KOV-ALU-200'
      );
      const titleSkuGaps = await comparisonTable.locator('tr[data-item-row]').evaluateAll((rows) =>
        rows.map((row) => {
          const title = row.querySelector('[data-item-title]');
          const sku = row.querySelector('[data-item-sku]');
          if (!title || !sku) throw new Error('Quote item title and SKU markers are required.');
          return sku.getBoundingClientRect().top - title.getBoundingClientRect().bottom;
        })
      );
      expect(titleSkuGaps).toHaveLength(2);
      expect(Math.abs(titleSkuGaps[0]! - titleSkuGaps[1]!)).toBeLessThanOrEqual(1);
      await assertNumericFieldsCentered(requestedItemRow);
      await assertNumericFieldsCentered(offeredItemRow);
      await offerEditAction.click();
      await expect(page.getByLabel(/^Ponujeni artikel /u).first()).toContainText(
        'MAT-KOV-ALU-200'
      );
      await expect(page.getByLabel(/^Naziv artikla /u)).toHaveCount(0);
      await expect(page.getByLabel(/^Naziv različice /u)).toHaveCount(0);
      await expect(page.getByLabel(/^Popust /u).first()).toHaveValue('10');
      await expect(page.getByLabel('Različica pogojev')).toHaveCount(0);

      const pageCountBeforePreview = page.context().pages().length;
      const previewButton = page.getByRole('button', { name: 'Predogled', exact: true });
      const previewResponsePromise = page.waitForResponse((response) =>
        response.url().endsWith(`/api/admin/quote-requests/${fixture.quoteRequestId}/preview`) &&
        response.request().method() === 'POST'
      );
      await previewButton.click();
      const previewResponse = await previewResponsePromise;
      await requireOk(previewResponse, 'preview saved quote draft');
      expect(previewResponse.headers()['content-type']).toContain('application/pdf');
      const previewDialog = page.getByRole('dialog', { name: 'Predogled ponudbe' });
      await expect(previewDialog).toBeVisible();
      await expect(page.getByTestId('quote-offer-preview-frame')).toHaveAttribute('src', /^blob:/u);
      await expect(page.getByRole('button', { name: 'Zapri predogled' })).toBeFocused();
      expect(await page.evaluate(() => document.body.style.overflow)).toBe('hidden');
      expect(page.context().pages()).toHaveLength(pageCountBeforePreview);
      await testInfo.attach('quote-detail-preview-dialog', {
        body: await page.screenshot({ type: 'jpeg', quality: 60 }),
        contentType: 'image/jpeg'
      });
      await page.keyboard.press('Escape');
      await expect(previewDialog).toBeHidden();
      expect(await page.evaluate(() => document.body.style.overflow)).not.toBe('hidden');

      await testInfo.attach('quote-detail-customer-layout', {
        body: await page.screenshot({ type: 'jpeg', quality: 55 }),
        contentType: 'image/jpeg'
      });
      await offerCard.scrollIntoViewIfNeeded();
      await testInfo.attach('quote-detail-offer-layout', {
        body: await page.screenshot({ type: 'jpeg', quality: 55 }),
        contentType: 'image/jpeg'
      });

      const persisted = await database.query<{
        organization_name: string;
        contact_name: string;
        address_line1: string;
        product_name: string;
        variant_name: string;
        catalog_item_id: string | number;
        catalog_variant_id: string | number;
        sku: string;
        discount_pct: string | number;
        requested_product_name: string;
        requested_sku: string;
      }>(
        `
          select request.organization_name, request.contact_name,
                 request.address_line1, item.product_name, item.variant_name,
                 item.catalog_item_id, item.catalog_variant_id, item.sku,
                 item.discount_pct,
                 requested_item.product_name as requested_product_name,
                 requested_item.sku as requested_sku
          from quote_requests request
          join quote_offer_versions offer
            on offer.quote_request_id = request.id and offer.status = 'draft'
          join quote_offer_version_items item
            on item.quote_offer_version_id = offer.id
          join quote_request_items requested_item
            on requested_item.quote_request_id = request.id
           and requested_item.line_number = item.line_number
          where request.id = $1
          order by item.line_number
          limit 1
        `,
        [fixture.quoteRequestId]
      );
      expect(persisted.rows[0]).toMatchObject({
        organization_name: 'E2E urejen naročnik',
        contact_name: 'E2E urejen kontakt',
        address_line1: 'Urejena ulica 7',
        product_name: 'Aluminijasta plošča',
        variant_name: '200 × 200 × 0,5 mm',
        sku: 'MAT-KOV-ALU-200',
        requested_product_name: 'Aluminijasta plošča',
        requested_sku: 'MAT-KOV-ALU-100'
      });
      expect(Number(persisted.rows[0]?.catalog_item_id)).toBe(910001);
      expect(Number(persisted.rows[0]?.catalog_variant_id)).toBe(920002);
      expect(Number(persisted.rows[0]?.discount_pct)).toBe(10);
    } finally {
      await Promise.race([
        fixture.context.close().catch(() => undefined),
        new Promise<void>((resolve) => {
          setTimeout(resolve, 2_000);
        })
      ]);
    }
  });

  test('clarification dialog cancels, confirms email, logs evidence, and survives browser history', async ({
    browser,
    page
  }) => {
    test.setTimeout(60_000);
    const fixture = await createQuoteRequest(browser, {
      label: `clarification-dialog-${randomUUID()}`
    });
    const detailUrl = `/admin/orders/quotes/${fixture.quoteRequestId}`;
    const endpoint =
      `/api/admin/quote-requests/${fixture.quoteRequestId}/clarification`;
    const clarification =
      'Prosimo, potrdite želene dimenzije in količino artikla.';
    let clarificationRequestCount = 0;

    page.on('request', (request) => {
      if (
        request.method() === 'POST' &&
        new URL(request.url()).pathname === endpoint
      ) {
        clarificationRequestCount += 1;
      }
    });

    try {
      const requestBefore = await database.query<{
        state_version: string | number;
        status: string;
      }>(
        'select state_version, status from quote_requests where id = $1',
        [fixture.quoteRequestId]
      );
      expect(requestBefore.rowCount).toBe(1);
      const initialRequestStateVersion = Number(
        requestBefore.rows[0]!.state_version
      );

      await page.goto(detailUrl);
      await expect(page.getByTestId('admin-quote-detail')).toBeVisible();

      const trigger = page.getByRole('button', {
        name: 'Prosi za pojasnilo',
        exact: true
      });
      const dialogBody = page.getByTestId('quote-clarification-dialog');
      const textarea = page.getByTestId('quote-clarification-textarea');
      const advance = page.getByTestId('quote-clarification-advance');

      await trigger.click();
      await expect(
        page.getByRole('dialog', { name: 'Zahteva za pojasnilo' })
      ).toBeVisible();
      await expect(dialogBody).toBeVisible();
      await expect(textarea).toBeFocused();
      await expect(advance).toBeDisabled();
      await textarea.fill('Ta osnutek mora biti preklican.');
      await page.getByTestId('quote-clarification-cancel').click();
      await expect(dialogBody).toHaveCount(0);
      await expect(trigger).toBeFocused();
      expect(clarificationRequestCount).toBe(0);

      await trigger.click();
      await textarea.fill(clarification);
      await advance.click();

      const confirmDialog = page.getByRole('dialog', {
        name: 'E-poštno obvestilo stranki'
      });
      await expect(confirmDialog).toBeVisible();
      await expect(confirmDialog).toContainText(fixture.email);
      await expect(confirmDialog).toContainText(clarification);
      await expect(
        page.getByTestId('quote-clarification-record-only')
      ).toBeVisible();
      await expect(
        page.getByTestId('quote-clarification-record-and-send')
      ).toBeFocused();

      await page.keyboard.press('Escape');
      await expect(confirmDialog).toBeVisible();

      await page.getByTestId('quote-clarification-back').click();
      await expect(
        page.getByRole('dialog', { name: 'Zahteva za pojasnilo' })
      ).toBeVisible();
      await expect(textarea).toHaveValue(clarification);
      await advance.click();
      await expect(confirmDialog).toBeVisible();

      const clarificationConfirmationResponsePromise = page.waitForResponse(
        (response) =>
          response.request().method() === 'POST' &&
          new URL(response.url()).pathname === endpoint &&
          response.status() === 428
      );
      const clarificationResponsePromise = page.waitForResponse(
        (response) =>
          response.request().method() === 'POST' &&
          new URL(response.url()).pathname === endpoint &&
          response.status() === 200
      );
      await page
        .getByTestId('quote-clarification-record-and-send')
        .click();
      const clarificationConfirmationResponse =
        await clarificationConfirmationResponsePromise;
      const clarificationConfirmationToken =
        await readCustomerEmailConfirmationToken(
          clarificationConfirmationResponse,
          'record and send clarification'
        );
      const customerEmailDialog = page.getByRole('dialog', {
        name: 'Pošljem e-pošto stranki?'
      });
      await expect(customerEmailDialog).toBeVisible();
      await expect(customerEmailDialog).toContainText(fixture.email);
      await customerEmailDialog
        .getByRole('button', { name: 'Potrdi in nadaljuj' })
        .click();
      const clarificationResponse = await clarificationResponsePromise;
      await requireOk(
        clarificationResponse,
        'record and send clarification'
      );
      expect(clarificationResponse.status()).toBe(200);
      expect(clarificationRequestCount).toBe(2);

      const requestPayload = clarificationResponse.request().postDataJSON() as {
        offerVersionId?: number | null;
        expectedRequestStateVersion?: number;
        clarification?: string;
        sendEmail?: boolean;
        actionId?: string;
        customerEmailConfirmationToken?: string;
      };
      expect(requestPayload).toMatchObject({
        offerVersionId: fixture.draftOfferVersionId,
        expectedRequestStateVersion: initialRequestStateVersion,
        clarification,
        sendEmail: true,
        customerEmailConfirmationToken: clarificationConfirmationToken
      });
      expect(requestPayload.actionId).toMatch(/^[0-9a-f-]{36}$/u);

      await expect(clarificationResponse.json()).resolves.toMatchObject({
        quoteRequestId: fixture.quoteRequestId,
        quoteOfferVersionId: fixture.draftOfferVersionId,
        reference: fixture.requestNumber,
        recorded: true,
        replayed: false,
        emailRequested: true,
        emailQueued: true,
        emailStatus: 'pending',
        stateChanged: false
      });
      await expect(dialogBody).toHaveCount(0);
      await expect(trigger).toBeFocused();

      const clarificationEvent = await database.query<{
        quote_offer_version_id: string | number | null;
        event_key: string;
        actor_type: string;
        correlation_id: string;
        reason: string | null;
        metadata_json: Record<string, unknown>;
      }>(
        `
          select
            quote_offer_version_id,
            event_key,
            actor_type,
            correlation_id,
            reason,
            metadata_json
          from quote_events
          where quote_request_id = $1
            and event_type = 'clarification_requested'
            and reason = $2
          order by id desc
          limit 1
        `,
        [fixture.quoteRequestId, clarification]
      );
      expect(clarificationEvent.rowCount).toBe(1);
      const event = clarificationEvent.rows[0]!;
      expect(Number(event.quote_offer_version_id)).toBe(
        fixture.draftOfferVersionId
      );
      expect(event.actor_type).toBe('admin');
      expect(event.reason).toBe(clarification);
      expect(event.correlation_id).toBe(requestPayload.actionId);
      expect(event.event_key).toBe(
        `clarification-requested:${fixture.quoteRequestId}:${requestPayload.actionId}`
      );
      expect(event.metadata_json).toMatchObject({
        actionId: requestPayload.actionId,
        channel: 'email_queue',
        emailRequested: true,
        reference: fixture.requestNumber,
        commercialStateChanged: false
      });

      const queuedEmail = await database.query<{
        id: string;
        quote_offer_version_id: string | number | null;
        event_key: string;
        event_type: string;
        audience: string;
        recipient_email: string;
        status: string;
      }>(
        `
          select
            id,
            quote_offer_version_id,
            event_key,
            event_type,
            audience,
            recipient_email,
            status
          from quote_email_jobs
          where quote_request_id = $1
            and event_type = 'quote_clarification_requested'
            and audience = 'customer'
          order by created_at desc, id desc
          limit 1
        `,
        [fixture.quoteRequestId]
      );
      expect(queuedEmail.rowCount).toBe(1);
      const emailJob = queuedEmail.rows[0]!;
      expect(Number(emailJob.quote_offer_version_id)).toBe(
        fixture.draftOfferVersionId
      );
      expect(emailJob).toMatchObject({
        event_key:
          `quote-clarification-requested:${fixture.quoteRequestId}:${requestPayload.actionId}`,
        event_type: 'quote_clarification_requested',
        audience: 'customer',
        recipient_email: fixture.email
      });
      expect(['pending', 'processing', 'sent', 'failed']).toContain(
        emailJob.status
      );

      const queuedEvent = await database.query<{
        event_type: string;
        metadata_json: Record<string, unknown>;
      }>(
        `
          select event_type, metadata_json
          from quote_events
          where event_key = $1
        `,
        [`${emailJob.event_key}:queued`]
      );
      expect(queuedEvent.rows).toEqual([
        {
          event_type: 'quote_email_queued',
          metadata_json: {
            emailEventType: 'quote_clarification_requested',
            jobCount: 1
          }
        }
      ]);

      const requestAfter = await database.query<{
        state_version: string | number;
        status: string;
      }>(
        'select state_version, status from quote_requests where id = $1',
        [fixture.quoteRequestId]
      );
      expect(Number(requestAfter.rows[0]!.state_version)).toBe(
        initialRequestStateVersion
      );
      expect(requestAfter.rows[0]!.status).toBe(
        requestBefore.rows[0]!.status
      );

      await page.reload();
      const timeline = page
        .getByTestId('quote-detail-header')
        .getByTestId('quote-activity-timeline');
      await expect(
        timeline
          .locator('[data-activity-compact-label]')
          .filter({ hasText: 'Pojasnilo' })
      ).toHaveCount(0);

      await page.getByRole('button', {
        name: /^Odpri dnevnik sprememb za Povpraševanje /u
      }).click();
      const historyDialog = page.getByRole('dialog', {
        name: 'Dnevnik sprememb'
      });
      await expect(historyDialog).toBeVisible();
      await expect(
        historyDialog.getByRole('heading', {
          name: 'Celoten potek ponudbe',
          exact: true
        })
      ).toBeVisible();
      await expect(
        historyDialog.getByText('Zahtevano pojasnilo', { exact: true }).first()
      ).toBeVisible();
      await expect(
        historyDialog
          .getByText('E-pošta uvrščena v čakalno vrsto', { exact: true })
          .first()
      ).toBeVisible();
      await page.keyboard.press('Escape');
      await expect(historyDialog).toHaveCount(0);

      const emailEvidence = page
        .getByTestId('quote-customer-access-card')
        .getByTestId('quote-email-evidence');
      const emailRow = emailEvidence.getByTestId(
        `quote-email-job-${emailJob.id}`
      );
      await expect(emailRow).toBeVisible();
      await expect(emailRow).toContainText(
        'Zahteva za pojasnilo · stranka'
      );
      await expect(emailRow).toContainText(fixture.email);
      await expect(emailRow.getByTestId('quote-email-status')).toHaveText(
        /^(?:Čaka|V obdelavi|Poslano|Napaka)$/u
      );

      await page
        .getByTestId('admin-quote-detail')
        .locator('a[href="/admin/orders?view=quotes"]')
        .first()
        .click();
      await expect(page).toHaveURL(/\/admin\/orders\?view=quotes$/u);
      await expect(page.getByTestId('admin-quotes-table')).toBeVisible();

      await page.goBack();
      await expect(page).toHaveURL(new RegExp(`${detailUrl}$`, 'u'));
      await expect(page.getByTestId(`quote-email-job-${emailJob.id}`)).toBeVisible();

      await page.goForward();
      await expect(page).toHaveURL(/\/admin\/orders\?view=quotes$/u);
      await expect(page.getByTestId('admin-quotes-table')).toBeVisible();

      await page.goBack();
      await expect(page).toHaveURL(new RegExp(`${detailUrl}$`, 'u'));
      await expect(page.getByTestId(`quote-email-job-${emailJob.id}`)).toBeVisible();
    } finally {
      await fixture.context.close();
    }
  });
  test('master save retries only request metadata after the offer draft already persisted', async ({
    browser,
    page
  }) => {
    test.setTimeout(60_000);
    const fixture = await createQuoteRequest(browser, {
      label: 'admin-partial-master-save'
    });
    const changedContact = 'E2E kontakt po delnem shranjevanju';
    const changedDeliveryTerms = 'Dobava v sedmih delovnih dneh.';
    const failureMessage =
      'E2E namerna prehodna napaka pri shranjevanju podatkov.';
    const draftPath =
      `/api/admin/quote-requests/${fixture.quoteRequestId}/draft`;
    const detailsPath =
      `/api/admin/quote-requests/${fixture.quoteRequestId}/details`;

    type StoredState = {
      contact_name: string;
      request_state_version: string | number;
      delivery_terms: string;
      offer_state_version: string | number;
      snapshot_contact_name: string;
    };
    const readStoredState = async () => {
      const result = await database.query<StoredState>(
        `
          select
            request.contact_name,
            request.state_version as request_state_version,
            offer.delivery_terms,
            offer.state_version as offer_state_version,
            offer.customer_snapshot_json ->> 'contactName' as snapshot_contact_name
          from quote_requests request
          join quote_offer_versions offer on offer.id = $2
          where request.id = $1
        `,
        [fixture.quoteRequestId, fixture.draftOfferVersionId]
      );
      expect(result.rowCount).toBe(1);
      return result.rows[0]!;
    };

    const draftBodies: Array<Record<string, unknown>> = [];
    const detailsBodies: Array<Record<string, unknown>> = [];
    await page.route(`**${draftPath}`, async (route) => {
      if (route.request().method() !== 'PUT') {
        await route.continue();
        return;
      }
      draftBodies.push(
        route.request().postDataJSON() as Record<string, unknown>
      );
      await route.continue();
    });
    await page.route(`**${detailsPath}`, async (route) => {
      if (route.request().method() !== 'PUT') {
        await route.continue();
        return;
      }
      detailsBodies.push(
        route.request().postDataJSON() as Record<string, unknown>
      );
      if (detailsBodies.length === 1) {
        await route.fulfill({
          status: 503,
          contentType: 'application/json',
          body: JSON.stringify({ message: failureMessage })
        });
        return;
      }
      await route.continue();
    });

    try {
      const before = await readStoredState();
      await page.goto(`/admin/orders/quotes/${fixture.quoteRequestId}`);
      await expect(page.getByTestId('admin-quote-detail')).toBeVisible();

      const masterEdit = page.getByTestId('quote-header-status-edit');
      const saveButton = page.getByRole('button', {
        name: 'Shrani',
        exact: true
      });
      await masterEdit.click();
      await expect(masterEdit).toHaveAttribute('aria-pressed', 'true');
      await page.getByLabel('Kontaktna oseba').fill(changedContact);
      await page.getByLabel('Dobavni pogoji').fill(changedDeliveryTerms);
      await expect(saveButton).toBeEnabled();

      const firstDraftPromise = page.waitForResponse((response) =>
        response.url().endsWith(draftPath) &&
        response.request().method() === 'PUT'
      );
      const failedDetailsPromise = page.waitForResponse((response) =>
        response.url().endsWith(detailsPath) &&
        response.request().method() === 'PUT'
      );
      await saveButton.click();
      const [firstDraftResponse, failedDetailsResponse] = await Promise.all([
        firstDraftPromise,
        failedDetailsPromise
      ]);
      await requireOk(firstDraftResponse, 'partial master save offer draft');
      expect(failedDetailsResponse.status()).toBe(503);
      const savedDraft = await firstDraftResponse.json() as {
        stateVersion: number;
        requestStateVersion: number;
      };

      await expect(
        page.getByText(failureMessage, { exact: true })
      ).toBeVisible();
      await expect(masterEdit).toHaveAttribute('aria-pressed', 'true');
      await expect(page.getByLabel('Kontaktna oseba')).toHaveValue(
        changedContact
      );
      await expect(page.getByLabel('Dobavni pogoji')).toHaveValue(
        changedDeliveryTerms
      );
      await expect(saveButton).toBeEnabled();
      expect(draftBodies).toHaveLength(1);
      expect(detailsBodies).toHaveLength(1);
      expect(detailsBodies[0]).toMatchObject({
        expectedRequestStateVersion: savedDraft.requestStateVersion,
        contactName: changedContact
      });

      const afterFailure = await readStoredState();
      expect(afterFailure.delivery_terms).toBe(changedDeliveryTerms);
      expect(afterFailure.contact_name).toBe(before.contact_name);
      expect(afterFailure.snapshot_contact_name).toBe(
        before.snapshot_contact_name
      );
      expect(Number(afterFailure.offer_state_version)).toBe(
        Number(before.offer_state_version) + 1
      );
      expect(Number(afterFailure.request_state_version)).toBe(
        Number(before.request_state_version) + 1
      );

      const retryDetailsPromise = page.waitForResponse((response) =>
        response.url().endsWith(detailsPath) &&
        response.request().method() === 'PUT'
      );
      await saveButton.click();
      const retryDetailsResponse = await retryDetailsPromise;
      await requireOk(
        retryDetailsResponse,
        'retry master save request metadata'
      );
      const retriedDetails = await retryDetailsResponse.json() as {
        stateVersion: number;
        draftStateVersion: number;
      };

      await expect(masterEdit).toHaveAttribute('aria-pressed', 'false');
      await expect(page.getByLabel('Kontaktna oseba')).toHaveCount(0);
      expect(draftBodies).toHaveLength(1);
      expect(detailsBodies).toHaveLength(2);
      expect(detailsBodies[1]).toMatchObject({
        expectedRequestStateVersion: savedDraft.requestStateVersion,
        contactName: changedContact
      });

      const afterRetry = await readStoredState();
      expect(afterRetry.contact_name).toBe(changedContact);
      expect(afterRetry.snapshot_contact_name).toBe(changedContact);
      expect(afterRetry.delivery_terms).toBe(changedDeliveryTerms);
      expect(Number(afterRetry.request_state_version)).toBe(
        retriedDetails.stateVersion
      );
      expect(Number(afterRetry.offer_state_version)).toBe(
        retriedDetails.draftStateVersion
      );
      expect(Number(afterRetry.request_state_version)).toBe(
        Number(before.request_state_version) + 2
      );
      expect(Number(afterRetry.offer_state_version)).toBe(
        Number(before.offer_state_version) + 2
      );

      const events = await database.query<{
        draft_changes: string | number;
        details_changes: string | number;
      }>(
        `
          select
            count(*) filter (where event_type = 'draft_changed') as draft_changes,
            count(*) filter (
              where event_type = 'quote_request_details_changed'
            ) as details_changes
          from quote_events
          where quote_request_id = $1
        `,
        [fixture.quoteRequestId]
      );
      expect(Number(events.rows[0]?.draft_changes)).toBe(1);
      expect(Number(events.rows[0]?.details_changes)).toBe(1);
    } finally {
      await fixture.context.close().catch(() => undefined);
    }
  });
  test('issue action saves the current form before freezing and sending the offer', async ({
    browser,
    page
  }) => {
    test.setTimeout(60_000);
    const fixture = await createQuoteRequest(browser, { label: 'admin-direct-issue' });
    try {
      await page.goto(`/admin/orders/quotes/${fixture.quoteRequestId}`);
      await expect(page.getByTestId('admin-quote-detail')).toBeVisible();

      await page.getByTestId('quote-offer-card').getByRole('button', {
        name: 'Uredi ponudbo'
      }).click();
      const catalogSelect = page.getByLabel(/^Ponujeni artikel /u).first();
      await expect(catalogSelect).toBeEnabled();
      await catalogSelect.click();
      await page.getByRole('option', { name: /MAT-KOV-ALU-200/u }).click();
      await page.getByLabel('Velja do').fill('2099-12-31');
      await page.getByRole('spinbutton', { name: 'Poštnina', exact: true }).fill('12.34');
      await page.getByLabel('Dobavni pogoji').fill('Dobava v treh delovnih dneh.');
      await page.getByLabel('Plačilni pogoji').fill('Plačilo v 15 dneh.');
      await page.getByLabel('Sporočilo stranki').fill('E2E enotno sporočilo stranki.');
      await page.getByLabel('Pogoji sprejema ponudbe').fill(
        'E2E pogoji za neposredno izdajo ponudbe.'
      );

      const draftResponsePromise = page.waitForResponse((response) =>
        response.url().endsWith(`/api/admin/quote-requests/${fixture.quoteRequestId}/draft`) &&
        response.request().method() === 'PUT'
      );
      const confirmationResponsePromise = page.waitForResponse((response) =>
        response.url().endsWith(`/api/admin/quote-requests/${fixture.quoteRequestId}/issue`) &&
        response.request().method() === 'POST' &&
        response.status() === 428
      );
      const issueResponsePromise = page.waitForResponse((response) =>
        response.url().endsWith(`/api/admin/quote-requests/${fixture.quoteRequestId}/issue`) &&
        response.request().method() === 'POST' &&
        response.status() === 201
      );
      await page.getByRole('button', { name: 'Izdaj ponudbo' }).click();

      const issueDialog = page.getByTestId('quote-issue-dialog');
      await expect(issueDialog).toBeVisible();
      await expect(page.getByTestId('quote-issue-reference')).toBeVisible();
      await expect(page.getByTestId('quote-issue-total')).toContainText('€');
      await expect(page.getByTestId('quote-issue-recipient')).toHaveText(
        fixture.email
      );
      await expect(page.getByTestId('quote-issue-cancel')).toBeFocused();
      await page.getByTestId('quote-issue-cancel').click();
      await expect(issueDialog).toBeHidden();

      await page.getByRole('button', { name: 'Izdaj ponudbo' }).click();
      await expect(issueDialog).toBeVisible();
      await page.getByTestId('quote-issue-confirm').click();

      const confirmationResponse = await confirmationResponsePromise;
      const customerEmailConfirmationToken =
        await readCustomerEmailConfirmationToken(
          confirmationResponse,
          'direct UI quote issue'
        );
      const customerEmailDialog = page.getByRole('dialog', {
        name: 'Pošljem e-pošto stranki?'
      });
      await expect(customerEmailDialog).toBeVisible();
      await customerEmailDialog
        .getByRole('button', { name: 'Potrdi in nadaljuj' })
        .click();

      const draftResponse = await draftResponsePromise;
      await requireOk(draftResponse, 'automatic draft save before issue');
      const savedDraft = await draftResponse.json() as {
        quoteOfferVersionId?: number;
        stateVersion?: number;
        requestStateVersion?: number;
      };
      expect(savedDraft.quoteOfferVersionId).toBe(fixture.draftOfferVersionId);
      expect(savedDraft.stateVersion).toBeGreaterThan(1);
      expect(savedDraft.requestStateVersion).toBeGreaterThan(1);

      const issueResponse = await issueResponsePromise;
      await requireOk(issueResponse, 'direct UI quote issue');
      expect(issueResponse.status()).toBe(201);
      expect(issueResponse.request().postDataJSON()).toMatchObject({
        customerEmailConfirmationToken
      });
      await expect(page.getByTestId('quote-workflow-status')).toContainText(
        'Izdano'
      );
      await expect(page.getByTestId('quote-action-withdraw-offer')).toHaveText(
        'Umakni izdano ponudbo'
      );
      await expect(page.getByTestId('quote-action-close-without-offer')).toHaveCount(0);

      const issuedWorkflowStatusEditButton = page.getByTestId('quote-header-status-edit');
      const issuedWorkflowStatusControl = page.getByTestId('quote-workflow-status-control');
      await issuedWorkflowStatusEditButton.click();
      await expect(issuedWorkflowStatusEditButton).toHaveAttribute('aria-pressed', 'true');
      await issuedWorkflowStatusControl.click();
      const issuedStatusMenu = page.getByRole('menu');
      await expect(issuedStatusMenu).toBeVisible();
      await expect(issuedStatusMenu.getByRole('menuitem')).toHaveCount(6);
      await expect(
        issuedStatusMenu.getByRole('menuitem', { name: /^Izdano/u })
      ).not.toHaveAttribute('aria-disabled', 'true');
      for (const label of ['V pripravi', 'Prejeto']) {
        const blockedManualStatus = issuedStatusMenu.getByRole('menuitem', {
          name: new RegExp(`^${label}`, 'u')
        });
        await expect(blockedManualStatus).toHaveAttribute(
          'aria-disabled',
          'true'
        );
        await expect(blockedManualStatus).toHaveAccessibleDescription(
          'Po izdaji se statusa ne da ročno vrniti. Uporabite dejanje »Pripravi novo različico«.'
        );
      }
      await expect(
        issuedStatusMenu.getByRole('menuitem', { name: /^Zavrnjeno/u })
      ).toHaveAccessibleDescription(
        'Uporabite dejanje »Umakni izdano ponudbo«; zavrnitev stranke se zabeleži iz njenega odgovora.'
      );
      await issuedWorkflowStatusControl.click();
      await expect(issuedStatusMenu).toHaveCount(0);
      await issuedWorkflowStatusEditButton.click();

      await expect
        .poll(async () => {
          const result = await database.query(
            `
              select id
              from quote_documents
              where quote_offer_version_id = $1
                and document_type = 'offer'
            `,
            [fixture.draftOfferVersionId]
          );
          return result.rowCount;
        })
        .toBe(1);
      await page.reload();
      const offerDocumentRow = page.getByTestId('quote-document-type-offer');
      const openOfferDocument = offerDocumentRow.getByRole('link', {
        name: 'Odpri PDF ponudbe',
        exact: true
      });
      const offerDocumentActions = offerDocumentRow.getByRole('button', {
        name: 'Dejanja za Ponudba'
      });
      await expect(openOfferDocument).toBeVisible();
      await expect(openOfferDocument).toHaveText('Odpri');
      await expect(openOfferDocument).toHaveAttribute(
        'href',
        new RegExp(
          `/api/admin/quote-requests/${fixture.quoteRequestId}/documents/\\d+`,
          'u'
        )
      );
      await expect(
        offerDocumentRow.getByRole('button', {
          name: 'Ustvari PDF ponudbe',
          exact: true
        })
      ).toHaveCount(0);
      await expect(offerDocumentActions).toBeVisible();
      await offerDocumentActions.click();
      const issuedOfferDocumentMenu = page.getByRole('menu', {
        name: 'Dejanja za Ponudba'
      });
      await expect(issuedOfferDocumentMenu).toBeVisible();
      await expect(
        issuedOfferDocumentMenu.getByRole('menuitem', {
          name: 'Prenesi',
          exact: true
        })
      ).toBeEnabled();
      await expect(
        issuedOfferDocumentMenu.getByRole('menuitem', {
          name: 'Ustvari PDF',
          exact: true
        })
      ).toHaveCount(0);
      await offerDocumentActions.click();
      await expect(issuedOfferDocumentMenu).toHaveCount(0);
      await expect(offerDocumentRow.getByRole('link', { name: /\.pdf$/u })).toHaveAttribute(
        'href',
        new RegExp(
          `/api/admin/quote-requests/${fixture.quoteRequestId}/documents/\\d+`,
          'u'
        )
      );

      const idempotentGeneration = await page.request.post(
        `/api/admin/quote-requests/${fixture.quoteRequestId}/documents`,
        {
          headers: ORIGIN_HEADERS,
          data: { offerVersionId: fixture.draftOfferVersionId }
        }
      );
      await requireOk(idempotentGeneration, 'idempotent quote PDF generation');
      expect(idempotentGeneration.status()).toBe(200);
      const generatedDocumentCount = await database.query(
        `
          select count(*)::int as count
          from quote_documents
          where quote_offer_version_id = $1
            and document_type = 'offer'
        `,
        [fixture.draftOfferVersionId]
      );
      expect(Number(generatedDocumentCount.rows[0]?.count)).toBe(1);

      const persisted = await database.query<{
        status: string;
        shipping: string | number;
        delivery_terms: string;
        payment_terms: string;
        seller_message: string | null;
        customer_visible_notes: string;
        product_name: string;
      }>(
        `
          select offer.status, offer.shipping, offer.delivery_terms,
                 offer.payment_terms, offer.seller_message,
                 offer.customer_visible_notes, item.product_name
          from quote_offer_versions offer
          join quote_offer_version_items item
            on item.quote_offer_version_id = offer.id
          where offer.id = $1
          order by item.line_number
          limit 1
        `,
        [fixture.draftOfferVersionId]
      );
      expect(persisted.rows[0]).toMatchObject({
        status: 'issued',
        delivery_terms: 'Dobava v treh delovnih dneh.',
        payment_terms: 'Plačilo v 15 dneh.',
        seller_message: null,
        customer_visible_notes: 'E2E enotno sporočilo stranki.',
        product_name: 'Aluminijasta plošča'
      });
      expect(Number(persisted.rows[0]?.shipping)).toBe(12.34);
    } finally {
      await fixture.context.close();
    }
  });

  test('received quote can be saved, issued, and withdrawn without commercial side effects', async ({
    browser,
    page,
    request
  }) => {
    test.setTimeout(60_000);
    const startingInventory = await inventory();
    const fixture = await createQuoteRequest(browser, {
      label: 'issued-withdrawn'
    });
    try {
      await page.goto(`/admin/orders/quotes/${fixture.quoteRequestId}`);
      await expect(page.getByTestId('admin-quote-detail')).toBeVisible();

      const workflowStatus = page.getByTestId('quote-workflow-status');
      const workflowStatusControl = page.getByTestId(
        'quote-workflow-status-control'
      );
      const workflowStatusEditButton = page.getByTestId(
        'quote-header-status-edit'
      );
      await expect(workflowStatus).toContainText('Prejeto');

      await workflowStatusEditButton.click();
      await expect(workflowStatusEditButton).toHaveAttribute(
        'aria-pressed',
        'true'
      );
      await workflowStatusControl.click();
      const statusMenu = page.getByRole('menu');
      await expect(statusMenu).toBeVisible();
      await statusMenu.getByRole('menuitem', { name: /^V pripravi/u }).click();
      await expect(workflowStatus).toContainText('V pripravi');

      const statusResponsePromise = page.waitForResponse((response) =>
        response.url().endsWith(
          `/api/admin/quote-requests/${fixture.quoteRequestId}/status`
        ) && response.request().method() === 'POST'
      );
      await page.getByRole('button', { name: 'Shrani', exact: true }).click();
      const statusResponse = await statusResponsePromise;
      await requireOk(statusResponse, 'save quote request preparation status');
      await expect(statusResponse.json()).resolves.toMatchObject({
        status: 'in_preparation'
      });

      const savedDraft = await database.query<{
        request_status: string;
        offer_status: string;
        is_current: boolean;
      }>(
        `
          select request.status as request_status,
                 offer.status as offer_status,
                 offer.is_current
          from quote_requests request
          join quote_offer_versions offer on offer.id = $2
          where request.id = $1
        `,
        [fixture.quoteRequestId, fixture.draftOfferVersionId]
      );
      expect(savedDraft.rows[0]).toEqual({
        request_status: 'in_preparation',
        offer_status: 'draft',
        is_current: false
      });
      expect(await inventory()).toBe(startingInventory);

      const offer = await issueOffer(request, fixture);
      const { token } = await extractOfferToken(offer);
      await openOfferSession(offer, token);

      const immutableBefore = await database.query<{
        content_hash: string;
        terms_hash: string;
        document_sha256: string;
        document_count: number;
      }>(
        `
          select offer.content_hash, offer.terms_hash, offer.document_sha256,
                 (select count(*)::int
                    from quote_documents document
                   where document.quote_offer_version_id = offer.id
                     and document.document_type = 'offer') as document_count
          from quote_offer_versions offer
          where offer.id = $1
        `,
        [offer.quoteOfferVersionId]
      );
      expect(immutableBefore.rows[0]).toMatchObject({
        content_hash: offer.contentHash,
        terms_hash: offer.termsHash,
        document_count: 1
      });
      expect(immutableBefore.rows[0]?.document_sha256).toMatch(
        /^[a-f0-9]{64}$/u
      );

      await page.reload();
      await expect(page.getByTestId('admin-quote-detail')).toBeVisible();
      await expect(workflowStatus).toContainText('Izdano');
      const withdrawButton = page.getByTestId(
        'quote-action-withdraw-offer'
      );
      await expect(withdrawButton).toHaveText('Umakni izdano ponudbo');

      const withdrawalReason = 'E2E ponudba je bila izdana pomotoma.';
      const dialogEvidence: Array<{ type: string; message: string }> = [];
      page.on('dialog', async (dialog) => {
        dialogEvidence.push({
          type: dialog.type(),
          message: dialog.message()
        });
        await dialog.accept(
          dialog.type() === 'prompt' ? withdrawalReason : undefined
        );
      });

      const withdrawResponsePromise = page.waitForResponse((response) =>
        response.url().endsWith(
          `/api/admin/quote-requests/${fixture.quoteRequestId}/withdraw`
        ) && response.request().method() === 'POST'
      );
      await withdrawButton.click();
      const withdrawResponse = await withdrawResponsePromise;
      await requireOk(
        withdrawResponse,
        'withdraw issued quote through admin UI'
      );
      await expect(withdrawResponse.json()).resolves.toMatchObject({
        quoteRequestId: fixture.quoteRequestId,
        quoteOfferVersionId: offer.quoteOfferVersionId,
        status: 'withdrawn',
        offerStatus: 'withdrawn'
      });
      expect(dialogEvidence).toEqual([
        {
          type: 'prompt',
          message: expect.stringContaining(
            'Razlog umika izdane ponudbe'
          )
        }
      ]);
      await expect(workflowStatus).toContainText('Zavrnjeno');
      await expect(withdrawButton).toHaveCount(0);

      const withdrawn = await database.query<{
        request_status: string;
        offer_status: string;
        is_current: boolean;
        withdrawal_reason: string;
        content_hash: string;
        terms_hash: string;
        document_sha256: string;
        document_count: number;
        orders: number;
        acceptances: number;
        holds: number;
      }>(
        `
          select request.status as request_status,
                 offer.status as offer_status,
                 offer.is_current,
                 offer.withdrawal_reason,
                 offer.content_hash,
                 offer.terms_hash,
                 offer.document_sha256,
                 (select count(*)::int
                    from quote_documents document
                   where document.quote_offer_version_id = offer.id
                     and document.document_type = 'offer') as document_count,
                 (select count(*)::int
                    from orders source_order
                   where source_order.source_quote_offer_version_id = offer.id) as orders,
                 (select count(*)::int
                    from quote_offer_acceptances acceptance
                   where acceptance.quote_offer_version_id = offer.id) as acceptances,
                 (select count(*)::int
                    from order_stock_holds hold
                    join orders source_order on source_order.id = hold.order_id
                   where source_order.source_quote_offer_version_id = offer.id) as holds
          from quote_requests request
          join quote_offer_versions offer on offer.id = $2
          where request.id = $1
        `,
        [offer.quoteRequestId, offer.quoteOfferVersionId]
      );
      expect(withdrawn.rows[0]).toMatchObject({
        request_status: 'withdrawn',
        offer_status: 'withdrawn',
        is_current: false,
        withdrawal_reason: withdrawalReason,
        content_hash: immutableBefore.rows[0]?.content_hash,
        terms_hash: immutableBefore.rows[0]?.terms_hash,
        document_sha256: immutableBefore.rows[0]?.document_sha256,
        document_count: immutableBefore.rows[0]?.document_count,
        orders: 0,
        acceptances: 0,
        holds: 0
      });

      const revokedContext = await browser.newContext({
        baseURL: E2E_BASE_URL
      });
      try {
        const revokedExchange = await revokedContext.request.post(
          '/api/quote-requests/access-session',
          {
            headers: ORIGIN_HEADERS,
            data: { token, purpose: 'offer' }
          }
        );
        expect(revokedExchange.status()).toBe(401);
      } finally {
        await revokedContext.close();
      }

      const withdrawnEvent = await database.query(
        `
          select 1
          from quote_events
          where quote_request_id = $1
            and quote_offer_version_id = $2
            and event_type = 'offer_withdrawn'
        `,
        [offer.quoteRequestId, offer.quoteOfferVersionId]
      );
      expect(withdrawnEvent.rowCount).toBe(1);
      expect(await inventory()).toBe(startingInventory);
    } finally {
      await restoreInventory(startingInventory);
      await fixture.context.close();
    }
  });
  test('request -> issue -> verified acceptance creates one frozen accepted order and traceable retry evidence', async ({
    browser,
    page,
    request
  }) => {
    test.setTimeout(60_000);
    const startingInventory = await inventory();
    const fixture = await createQuoteRequest(browser, { label: 'accepted' });
    try {
      const preOffer = await database.query(
        'select id from orders where email = $1',
        [fixture.email]
      );
      expect(preOffer.rowCount).toBe(0);
      expect(await inventory()).toBe(startingInventory);

      const offer = await issueOffer(request, fixture);
      const { jobId, token } = await extractOfferToken(offer);
      const { session, snapshot } = await openOfferSession(offer, token);
      expect(snapshot.canAccept).toBe(true);
      expect(snapshot.emailVerificationRequired).toBe(true);
      expect(Array.isArray(snapshot.documents)).toBe(true);
      expect((snapshot.documents as unknown[]).length).toBe(1);

      await expect.poll(async () => {
        const job = await database.query<{ status: string }>(
          'select status from quote_email_jobs where id = $1',
          [jobId]
        );
        return job.rows[0]?.status;
      }).not.toBe('processing');
      await database.query(
        `
          update quote_email_jobs
          set status = 'pending', attempts = 7, next_attempt_at = now(),
              claim_id = null, locked_at = null, updated_at = now()
          where id = $1
        `,
        [jobId]
      );
      await processQuoteWorkflow(request);
      const terminalJob = await database.query<{
        status: string;
        attempts: number;
        last_error: string | null;
      }>(
        'select status, attempts, last_error from quote_email_jobs where id = $1',
        [jobId]
      );
      expect(terminalJob.rows[0]).toMatchObject({
        status: 'failed',
        attempts: 8
      });
      expect(terminalJob.rows[0].last_error).toContain('RESEND_API_KEY');

      await page.goto(`/admin/orders/quotes/${offer.quoteRequestId}`);
      await expect(page.getByTestId('admin-quote-detail')).toBeVisible();
      const mergedAccessCard = page.getByTestId('quote-customer-access-card');
      const emailEvidence = mergedAccessCard.getByTestId(
        'quote-email-evidence'
      );
      const failedEmailJob = emailEvidence.getByTestId(
        `quote-email-job-${jobId}`
      );
      await expect(failedEmailJob).toBeVisible();
      await expect(failedEmailJob).toContainText('Ponudba izdana · stranka');
      await expect(failedEmailJob).toContainText(fixture.email);
      await expect(failedEmailJob).toContainText('poskusi 8');
      await expect(failedEmailJob).toContainText('Napaka');
      await expect(
        failedEmailJob.getByTestId('quote-email-last-error')
      ).toContainText('RESEND_API_KEY');
      const retryEmailButton = failedEmailJob.getByRole('button', {
        name: `Ponovi pošiljanje: Ponudba izdana · ${fixture.email}`
      });
      await expect(retryEmailButton).toBeVisible();
      await expect(retryEmailButton).toHaveText('Ponovi pošiljanje');
      const retryConfirmationResponsePromise = page.waitForResponse(
        (response) =>
          response.request().method() === 'POST' &&
          response.url().endsWith(
            `/api/admin/quote-email-jobs/${jobId}/retry`
          ) &&
          response.status() === 428
      );
      const retryResponsePromise = page.waitForResponse(
        (response) =>
          response.request().method() === 'POST' &&
          response.url().endsWith(
            `/api/admin/quote-email-jobs/${jobId}/retry`
          ) &&
          response.status() === 200
      );
      await retryEmailButton.click();
      const retryConfirmationResponse =
        await retryConfirmationResponsePromise;
      const retryConfirmationToken = await readCustomerEmailConfirmationToken(
        retryConfirmationResponse,
        'manual quote email retry'
      );
      const retryConfirmationDialog = page.getByRole('dialog', {
        name: 'Pošljem e-pošto stranki?'
      });
      await expect(retryConfirmationDialog).toBeVisible();
      await expect(retryConfirmationDialog).toContainText(fixture.email);
      await retryConfirmationDialog
        .getByRole('button', { name: 'Potrdi in nadaljuj' })
        .click();
      const retryResponse = await retryResponsePromise;
      await requireOk(retryResponse, 'manual quote email retry');
      expect(retryResponse.request().postDataJSON()).toEqual({
        customerEmailConfirmationToken: retryConfirmationToken
      });
      await expect(retryResponse.json()).resolves.toMatchObject({
        jobId,
        status: 'pending'
      });
      await expect.poll(async () => {
        const retry = await database.query<{ status: string }>(
          'select status from quote_email_jobs where id = $1',
          [jobId]
        );
        return retry.rows[0]?.status;
      }).toBe('pending');

      const verificationId = await verifyOfferEmail(offer, session);
      const idempotencyKey = `quote-accept-${randomUUID()}`;
      const acceptanceBody = {
        offerNumber: offer.offerNumber,
        versionNumber: offer.versionNumber,
        idempotencyKey
      };
      const acceptResponse = await offer.context.request.post(
        '/api/quote-requests/accept',
        {
          headers: {
            ...mutationHeaders(session),
            'Idempotency-Key': idempotencyKey
          },
          data: acceptanceBody
        }
      );
      await requireOk(acceptResponse, 'quote acceptance');
      expect(acceptResponse.status()).toBe(201);
      const accepted = (await acceptResponse.json()) as {
        status: string;
        orderAccessId: string;
      };
      expect(accepted).toMatchObject({ status: 'accepted' });
      expect(accepted.orderAccessId).toMatch(/^[0-9a-f-]{36}$/u);

      const replay = await offer.context.request.post(
        '/api/quote-requests/accept',
        {
          headers: {
            ...mutationHeaders(session),
            'Idempotency-Key': idempotencyKey
          },
          data: acceptanceBody
        }
      );
      await requireOk(replay, 'idempotent quote acceptance replay');
      expect(replay.status()).toBe(201);

      const order = await database.query<{
        id: string | number;
        order_number: string;
        contract_status: string;
        commitment_status: string;
        source_quote_offer_version_id: string | number;
        subtotal: string;
        tax: string;
        shipping: string;
        total: string;
      }>(
        `
          select id, order_number, contract_status, commitment_status,
                 source_quote_offer_version_id, subtotal, tax, shipping, total
          from orders
          where source_quote_offer_version_id = $1
        `,
        [offer.quoteOfferVersionId]
      );
      expect(order.rowCount).toBe(1);
      expect(order.rows[0]).toMatchObject({
        contract_status: 'accepted',
        commitment_status: 'binding',
        source_quote_offer_version_id: String(offer.quoteOfferVersionId)
      });
      const frozen = await database.query<{
        subtotal: string;
        tax: string;
        shipping: string;
        total: string;
        content_hash: string;
        terms_hash: string;
        document_sha256: string;
        accepted_document_sha256: string;
        actor_id: string;
      }>(
        `
          select
            offer.subtotal, offer.tax, offer.shipping, offer.total,
            offer.content_hash, offer.terms_hash, offer.document_sha256,
            acceptance.document_sha256 as accepted_document_sha256,
            acceptance.actor_id
          from quote_offer_versions offer
          join quote_offer_acceptances acceptance
            on acceptance.quote_offer_version_id = offer.id
          where offer.id = $1
        `,
        [offer.quoteOfferVersionId]
      );
      expect(order.rows[0].subtotal).toBe(frozen.rows[0].subtotal);
      expect(order.rows[0].tax).toBe(frozen.rows[0].tax);
      expect(order.rows[0].shipping).toBe(frozen.rows[0].shipping);
      expect(order.rows[0].total).toBe(frozen.rows[0].total);
      expect(frozen.rows[0].content_hash).toBe(offer.contentHash);
      expect(frozen.rows[0].terms_hash).toBe(offer.termsHash);
      expect(frozen.rows[0].accepted_document_sha256).toBe(
        frozen.rows[0].document_sha256
      );
      expect(frozen.rows[0].actor_id).toBe(verificationId);
      expect(await inventory()).toBe(startingInventory - 1);

      const hold = await database.query<{ state: string; quantity: number }>(
        `select state, quantity from order_stock_holds where order_id = $1`,
        [order.rows[0].id]
      );
      expect(hold.rows).toEqual([{ state: 'held', quantity: 1 }]);
      const events = await database.query<{ event_type: string }>(
        `select event_type from quote_events where quote_request_id = $1`,
        [offer.quoteRequestId]
      );
      const eventTypes = new Set(events.rows.map((row) => row.event_type));
      for (const eventType of [
        'request_received',
        'draft_changed',
        'offer_issued',
        'offer_viewed',
        'quote_email_provider_failed',
        'quote_email_queued',
        'customer_acceptance_attempted',
        'customer_accepted',
        'order_created'
      ]) {
        expect(eventTypes.has(eventType), `missing ${eventType}`).toBe(true);
      }
      const audit = await database.query(
        `
          select 1 from audit_events
          where entity_type = 'system' and entity_id = $1
        `,
        [`quote:${offer.quoteRequestId}`]
      );
      expect(audit.rowCount).toBeGreaterThan(0);

      await page.goto(`/admin/orders/quotes/${offer.quoteRequestId}`);
      await expect(page.getByTestId('admin-quote-detail')).toBeVisible();
      await expect(
        page.getByRole('heading', { name: offer.requestNumber })
      ).toBeVisible();
      await expect(
        page.getByRole('link', {
          name: new RegExp(String(order.rows[0].order_number), 'u')
        })
      ).toBeVisible();
      await expect(page.getByTestId('quote-workflow-status')).toContainText(
        'Naročeno'
      );
      await expect(page.getByTestId('quote-offer-card')).toContainText(
        'Stanje: Sprejeta'
      );
    } finally {
      await restoreInventory(startingInventory);
      await fixture.context.close();
    }
  });

  test('verified decline creates no order, while issuing V2 supersedes immutable V1 and revokes its link', async ({
    browser,
    request
  }) => {
    test.setTimeout(60_000);
    const startingInventory = await inventory();
    const declinedFixture = await createQuoteRequest(browser, {
      label: 'declined'
    });
    const revisionFixture = await createQuoteRequest(browser, {
      label: 'revision'
    });
    try {
      const declinedOffer = await issueOffer(request, declinedFixture);
      const declinedToken = (await extractOfferToken(declinedOffer)).token;
      const declinedSession = await openOfferSession(
        declinedOffer,
        declinedToken
      );
      await verifyOfferEmail(declinedOffer, declinedSession.session);
      const declineKey = `quote-decline-${randomUUID()}`;
      const declineResponse = await declinedOffer.context.request.post(
        '/api/quote-requests/decline',
        {
          headers: {
            ...mutationHeaders(declinedSession.session),
            'Idempotency-Key': declineKey
          },
          data: {
            offerNumber: declinedOffer.offerNumber,
            versionNumber: declinedOffer.versionNumber,
            reason: 'another_offer',
            idempotencyKey: declineKey
          }
        }
      );
      await requireOk(declineResponse, 'quote decline');
      await expect(declineResponse.json()).resolves.toMatchObject({
        status: 'declined'
      });
      const declinedState = await database.query<{
        request_status: string;
        offer_status: string;
        is_current: boolean;
        orders: number;
      }>(
        `
          select request.status as request_status,
                 offer.status as offer_status,
                 offer.is_current,
                 (select count(*)::int from orders where source_quote_offer_version_id = offer.id) as orders
          from quote_requests request
          join quote_offer_versions offer on offer.id = $2
          where request.id = $1
        `,
        [declinedOffer.quoteRequestId, declinedOffer.quoteOfferVersionId]
      );
      expect(declinedState.rows[0]).toEqual({
        request_status: 'declined',
        offer_status: 'declined',
        is_current: false,
        orders: 0
      });
      expect(await inventory()).toBe(startingInventory);

      const v1 = await issueOffer(request, revisionFixture);
      const v1Token = (await extractOfferToken(v1)).token;
      const beforeRevision = await database.query<{
        state_version: string | number;
        document_sha256: string;
        content_hash: string;
        terms_hash: string;
      }>(
        `
          select state_version, document_sha256, content_hash, terms_hash
          from quote_offer_versions where id = $1
        `,
        [v1.quoteOfferVersionId]
      );
      const requestState = await database.query<{ state_version: string | number }>(
        'select state_version from quote_requests where id = $1',
        [v1.quoteRequestId]
      );
      const reviseResponse = await request.post(
        `/api/admin/quote-requests/${v1.quoteRequestId}/revise`,
        {
          data: {
            offerVersionId: v1.quoteOfferVersionId,
            expectedStateVersion: Number(beforeRevision.rows[0].state_version),
            expectedRequestStateVersion: Number(
              requestState.rows[0].state_version
            )
          }
        }
      );
      await requireOk(reviseResponse, 'prepare V2');
      expect(reviseResponse.status()).toBe(201);
      const v2Draft = (await reviseResponse.json()) as {
        quoteOfferVersionId: number;
        versionNumber: number;
      };
      expect(v2Draft.versionNumber).toBe(2);
      const v2 = await issueOffer(
        request,
        {
          ...revisionFixture,
          draftOfferVersionId: v2Draft.quoteOfferVersionId
        },
        { termsVersion: 'e2e-quote-terms-v2' }
      );
      expect(v2.versionNumber).toBe(2);
      expect(v2.offerNumber).toMatch(/-V2$/u);

      const versions = await database.query<{
        id: string | number;
        version_number: number;
        status: string;
        is_current: boolean;
        document_sha256: string | null;
        content_hash: string;
        terms_hash: string;
      }>(
        `
          select id, version_number, status, is_current, document_sha256,
                 content_hash, terms_hash
          from quote_offer_versions
          where quote_request_id = $1
          order by version_number
        `,
        [v1.quoteRequestId]
      );
      expect(versions.rows).toHaveLength(2);
      expect(versions.rows[0]).toMatchObject({
        id: String(v1.quoteOfferVersionId),
        version_number: 1,
        status: 'superseded',
        is_current: false,
        document_sha256: beforeRevision.rows[0].document_sha256,
        content_hash: beforeRevision.rows[0].content_hash,
        terms_hash: beforeRevision.rows[0].terms_hash
      });
      expect(versions.rows[1]).toMatchObject({
        id: String(v2.quoteOfferVersionId),
        version_number: 2,
        status: 'issued',
        is_current: true
      });
      expect(versions.rows[1].content_hash).not.toBe(
        versions.rows[0].content_hash
      );

      const obsoleteContext = await browser.newContext({
        baseURL: E2E_BASE_URL
      });
      try {
        const obsoleteExchange = await obsoleteContext.request.post(
          '/api/quote-requests/access-session',
          {
            headers: ORIGIN_HEADERS,
            data: { token: v1Token, purpose: 'offer' }
          }
        );
        expect(obsoleteExchange.status()).toBe(401);
      } finally {
        await obsoleteContext.close();
      }
      const supersededEvent = await database.query(
        `
          select 1 from quote_events
          where quote_request_id = $1
            and quote_offer_version_id = $2
            and event_type = 'offer_superseded'
        `,
        [v1.quoteRequestId, v1.quoteOfferVersionId]
      );
      expect(supersededEvent.rowCount).toBe(1);
    } finally {
      await restoreInventory(startingInventory);
      await declinedFixture.context.close();
      await revisionFixture.context.close();
    }
  });

  test('expiry removes response scope and stock conflict creates neither order nor inventory movement', async ({
    browser,
    request
  }) => {
    test.setTimeout(60_000);
    const startingInventory = await inventory();
    const expiryFixture = await createQuoteRequest(browser, { label: 'expiry' });
    const conflictFixture = await createQuoteRequest(browser, {
      label: 'stock-conflict'
    });
    try {
      const expiring = await issueOffer(request, expiryFixture, {
        validUntil: new Date(Date.now() + 8_000).toISOString(),
        processDocument: false
      });
      await expect.poll(
        () => Date.now() >= new Date(expiring.validUntil).getTime(),
        { timeout: 15_000 }
      ).toBe(true);
      const lifecycle = await processQuoteWorkflow(request);
      expect(Number(lifecycle.expiry?.expired ?? 0)).toBeGreaterThanOrEqual(1);
      const expired = await database.query<{
        request_status: string;
        offer_status: string;
        is_current: boolean;
        scopes: string[];
      }>(
        `
          select request.status as request_status,
                 offer.status as offer_status,
                 offer.is_current,
                 access.scopes
          from quote_requests request
          join quote_offer_versions offer on offer.id = $2
          join quote_access_tokens access
            on access.quote_offer_version_id = offer.id
          where request.id = $1
        `,
        [expiring.quoteRequestId, expiring.quoteOfferVersionId]
      );
      expect(expired.rows[0]).toMatchObject({
        request_status: 'expired',
        offer_status: 'expired',
        is_current: false
      });
      expect(expired.rows[0].scopes).not.toContain('offer_response');
      expect(expired.rows[0].scopes).not.toContain('purchase_order');

      const conflicting = await issueOffer(request, conflictFixture);
      const conflictToken = (await extractOfferToken(conflicting)).token;
      const conflictSession = await openOfferSession(
        conflicting,
        conflictToken
      );
      await verifyOfferEmail(conflicting, conflictSession.session);
      await restoreInventory(0);
      const conflictKey = `quote-conflict-${randomUUID()}`;
      const conflictResponse = await conflicting.context.request.post(
        '/api/quote-requests/accept',
        {
          headers: {
            ...mutationHeaders(conflictSession.session),
            'Idempotency-Key': conflictKey
          },
          data: {
            offerNumber: conflicting.offerNumber,
            versionNumber: conflicting.versionNumber,
            idempotencyKey: conflictKey
          }
        }
      );
      expect(conflictResponse.status()).toBe(409);
      await expect(conflictResponse.json()).resolves.toMatchObject({
        code: 'STOCK_CHANGED'
      });
      const conflictState = await database.query<{
        request_status: string;
        offer_status: string;
        is_current: boolean;
        orders: number;
        acceptances: number;
        holds: number;
      }>(
        `
          select request.status as request_status,
                 offer.status as offer_status,
                 offer.is_current,
                 (select count(*)::int from orders where source_quote_offer_version_id = offer.id) as orders,
                 (select count(*)::int from quote_offer_acceptances where quote_offer_version_id = offer.id) as acceptances,
                 (select count(*)::int from order_stock_holds hold join orders source_order on source_order.id = hold.order_id where source_order.source_quote_offer_version_id = offer.id) as holds
          from quote_requests request
          join quote_offer_versions offer on offer.id = $2
          where request.id = $1
        `,
        [conflicting.quoteRequestId, conflicting.quoteOfferVersionId]
      );
      expect(conflictState.rows[0]).toEqual({
        request_status: 'offer_issued',
        offer_status: 'issued',
        is_current: true,
        orders: 0,
        acceptances: 0,
        holds: 0
      });
      const blockedEvent = await database.query(
        `
          select 1 from quote_events
          where quote_offer_version_id = $1
            and event_type = 'acceptance_blocked_stock'
        `,
        [conflicting.quoteOfferVersionId]
      );
      expect(blockedEvent.rowCount).toBe(1);
      expect(await inventory()).toBe(0);
    } finally {
      await restoreInventory(startingInventory);
      await expiryFixture.context.close();
      await conflictFixture.context.close();
    }
  });

  test('direct orders are accepted automatically and cancellation restores stock exactly once', async ({
    request
  }) => {
    test.setTimeout(45_000);
    const startingInventory = await inventory();
    try {
      const acceptedOrderId = await createDirectOrder(request, 'accepted');
      expect(await inventory()).toBe(startingInventory - 1);
      const automaticallyAccepted = await database.query<{
        contract_status: string;
        contract_accepted_actor_type: string;
        commitment_status: string;
        hold_state: string;
      }>(
        `
          select orders.contract_status,
                 orders.contract_accepted_actor_type,
                 orders.commitment_status,
                 hold.state as hold_state
          from orders
          join order_stock_holds hold on hold.order_id = orders.id
          where orders.id = $1
        `,
        [acceptedOrderId]
      );
      expect(automaticallyAccepted.rows[0]).toEqual({
        contract_status: 'accepted',
        contract_accepted_actor_type: 'system',
        commitment_status: 'binding',
        hold_state: 'held'
      });
      expect(await inventory()).toBe(startingInventory - 1);

      const cancelledOrderId = await createDirectOrder(request, 'cancelled');
      expect(await inventory()).toBe(startingInventory - 2);
      const cancelResponse = await request.post(
        `/api/admin/orders/${cancelledOrderId}/status`,
        { data: { status: 'cancelled' } }
      );
      await requireOk(cancelResponse, 'admin cancels accepted direct order');
      await expect(cancelResponse.json()).resolves.toMatchObject({
        status: 'cancelled'
      });
      expect(await inventory()).toBe(startingInventory - 1);

      const cancelled = await database.query<{
        contract_status: string;
        order_status: string;
        state: string;
        release_reason: string;
        released_quantity: number;
      }>(
        `
          select orders.contract_status, orders.status as order_status,
                 hold.state, hold.release_reason,
                 hold.quantity as released_quantity
          from orders
          join order_stock_holds hold on hold.order_id = orders.id
          where orders.id = $1
        `,
        [cancelledOrderId]
      );
      expect(cancelled.rows[0]).toMatchObject({
        contract_status: 'accepted',
        order_status: 'cancelled',
        state: 'released',
        release_reason: 'order_cancelled',
        released_quantity: 1
      });
      const replay = await request.post(
        `/api/admin/orders/${cancelledOrderId}/status`,
        { data: { status: 'cancelled' } }
      );
      await requireOk(replay, 'idempotent admin cancellation');
      await expect(replay.json()).resolves.toMatchObject({
        status: 'cancelled'
      });
      expect(await inventory()).toBe(startingInventory - 1);
      const orderAudit = await database.query(
        `
          select entity_id from audit_events
          where entity_type = 'order'
            and entity_id = $1
        `,
        [String(cancelledOrderId)]
      );
      expect(orderAudit.rowCount).toBeGreaterThanOrEqual(1);
    } finally {
      await restoreInventory(startingInventory);
    }
  });

  test('school PO upload creates a non-binding linked order and admin validation atomically accepts quote and stock', async ({
    browser,
    request,
    page
  }) => {
    test.setTimeout(60_000);
    const startingInventory = await inventory();
    const fixture = await createQuoteRequest(browser, {
      customerType: 'school',
      label: 'school-po'
    });
    try {
      const offer = await issueOffer(request, fixture);
      const token = (await extractOfferToken(offer)).token;
      const { session, snapshot } = await openOfferSession(offer, token);
      expect(snapshot.canAccept).toBe(false);
      expect(snapshot.canUploadPurchaseOrder).toBe(true);
      await verifyOfferEmail(offer, session);
      const uploadKey = `school-po-${randomUUID()}`;
      const uploadResponse = await offer.context.request.post(
        '/api/quote-requests/purchase-order',
        {
          headers: {
            ...mutationHeaders(session),
            'Idempotency-Key': uploadKey
          },
          multipart: {
            offerNumber: offer.offerNumber,
            versionNumber: String(offer.versionNumber),
            idempotencyKey: uploadKey,
            file: {
              name: 'e2e-narocilnica.pdf',
              mimeType: 'application/pdf',
              buffer: tinyPdf
            }
          }
        }
      );
      await requireOk(uploadResponse, 'school purchase-order upload');
      expect(uploadResponse.status()).toBe(201);
      await expect(uploadResponse.json()).resolves.toMatchObject({
        status: 'awaiting_purchase_order_review'
      });

      const pending = await database.query<{
        id: string | number;
        order_number: string | number;
        commitment_status: string;
        contract_status: string;
        request_status: string;
        offer_status: string;
      }>(
        `
          select orders.id, orders.order_number, orders.commitment_status, orders.contract_status,
                 request.status as request_status,
                 offer.status as offer_status
          from orders
          join quote_offer_versions offer
            on offer.id = orders.source_quote_offer_version_id
          join quote_requests request on request.id = offer.quote_request_id
          where offer.id = $1
        `,
        [offer.quoteOfferVersionId]
      );
      expect(pending.rowCount).toBe(1);
      expect(pending.rows[0]).toMatchObject({
        commitment_status: 'pending_confirmation',
        contract_status: 'pending_seller_acceptance',
        request_status: 'awaiting_purchase_order_review',
        offer_status: 'issued'
      });
      expect(await inventory()).toBe(startingInventory);

      const orderId = Number(pending.rows[0].id);
      const displayOrderNumber = toDisplayOrderNumber(
        String(pending.rows[0].order_number)
      );
      const processingResponse = await request.post(
        `/api/admin/orders/${orderId}/status`,
        { data: { status: 'in_progress' } }
      );
      await requireOk(processingResponse, 'admin school PO validation');
      await expect(processingResponse.json()).resolves.toMatchObject({
        status: 'in_progress',
        commitmentStatus: 'binding',
        contractStatus: 'accepted'
      });
      expect(await inventory()).toBe(startingInventory - 1);
      const accepted = await database.query<{
        status: string;
        commitment_status: string;
        contract_status: string;
        request_status: string;
        offer_status: string;
        is_current: boolean;
        channel: string;
        acceptance_wording: string;
        hold_state: string;
        active_access_token_count: number;
      }>(
        `
          select orders.status, orders.commitment_status, orders.contract_status,
                 request.status as request_status,
                 offer.status as offer_status, offer.is_current,
                 acceptance.channel, acceptance.acceptance_wording,
                 hold.state as hold_state,
                 (select count(*)::int
                  from quote_access_tokens access
                  where access.quote_request_id = request.id
                    and access.revoked_at is null) as active_access_token_count
          from orders
          join quote_offer_versions offer
            on offer.id = orders.source_quote_offer_version_id
          join quote_requests request on request.id = offer.quote_request_id
          join quote_offer_acceptances acceptance
            on acceptance.quote_offer_version_id = offer.id
          join order_stock_holds hold on hold.order_id = orders.id
          where orders.id = $1
        `,
        [orderId]
      );
      expect(accepted.rows[0]).toMatchObject({
        status: 'in_progress',
        commitment_status: 'binding',
        contract_status: 'accepted',
        request_status: 'converted_to_order',
        offer_status: 'accepted',
        is_current: false,
        channel: 'purchase_order_validation',
        acceptance_wording: 'V obdelavi',
        hold_state: 'held',
        active_access_token_count: 0
      });
      const eventResult = await database.query<{ event_type: string }>(
        `select event_type from quote_events where quote_request_id = $1`,
        [offer.quoteRequestId]
      );
      const events = new Set(eventResult.rows.map((row) => row.event_type));
      for (const eventType of [
        'customer_purchase_order_uploaded',
        'admin_purchase_order_validated',
        'customer_accepted',
        'order_created'
      ]) {
        expect(events.has(eventType), `missing ${eventType}`).toBe(true);
      }
      const replay = await request.post(
        `/api/admin/orders/${orderId}/status`,
        { data: { status: 'in_progress' } }
      );
      await requireOk(replay, 'idempotent school PO validation');
      await expect(replay.json()).resolves.toMatchObject({
        status: 'in_progress',
        commitmentStatus: 'binding',
        contractStatus: 'accepted'
      });
      expect(await inventory()).toBe(startingInventory - 1);
      const legacyBinding = await request.post(
        `/api/admin/orders/${orderId}/commitment-status`,
        { data: { commitmentStatus: 'binding' } }
      );
      expect(legacyBinding.status()).toBe(409);
      await expect(legacyBinding.json()).resolves.toMatchObject({
        code: 'ORDER_STATUS_SELLER_ACCEPTANCE_REQUIRED'
      });
      expect(await inventory()).toBe(startingInventory - 1);
      await page.goto(
        `/admin/orders?view=quotes&q=${encodeURIComponent(fixture.email)}`
      );
      await page.waitForLoadState('networkidle');
      const quoteRow = page.getByTestId(
        `quote-table-row-${fixture.quoteRequestId}`
      );
      const linkedOrder = quoteRow.getByTestId(
        `quote-linked-order-${fixture.quoteRequestId}`
      );
      await expect(
        page.getByRole('columnheader', { name: 'Rezultat' })
      ).toHaveCount(0);
      await expect(linkedOrder).toContainText(displayOrderNumber);
      await expect(linkedOrder).toHaveAccessibleName(
        `Odpri povezano naročilo ${displayOrderNumber}`
      );
      await expect(linkedOrder).toHaveAttribute(
        'href',
        `/admin/orders/${orderId}`
      );
      await linkedOrder.click();
      await expect(page).toHaveURL(`/admin/orders/${orderId}`);
    } finally {
      await restoreInventory(startingInventory);
      await fixture.context.close();
    }
  });

  test('admin manually uploads both quote PDF types without changing or blocking the offer lifecycle', async ({
    browser,
    page,
    request
  }) => {
    test.setTimeout(120_000);
    await page.setViewportSize({ width: 1329, height: 920 });
    const token = `manual-documents-${randomUUID()}`;
    const fixture = await createQuoteRequest(browser, { label: token });
    const endpoint =
      `/api/admin/quote-requests/${fixture.quoteRequestId}/documents`;
    const multipart = (
      type: 'offer' | 'purchase_order',
      buffer: Buffer,
      name: string,
      mimeType = 'application/pdf'
    ) => ({
      file: { name, mimeType, buffer },
      type,
      offerVersionId: String(fixture.draftOfferVersionId)
    });

    try {
      const lifecycleBefore = await database.query<{
        request_status: string;
        request_state_version: string | number;
        offer_status: string;
        offer_state_version: string | number;
        document_sha256: string | null;
      }>(
        `
          select
            request.status as request_status,
            request.state_version as request_state_version,
            offer.status as offer_status,
            offer.state_version as offer_state_version,
            offer.document_sha256
          from quote_requests request
          join quote_offer_versions offer on offer.id = $2
          where request.id = $1
        `,
        [fixture.quoteRequestId, fixture.draftOfferVersionId]
      );
      expect(lifecycleBefore.rowCount).toBe(1);

      const unauthenticated = await fixture.context.request.post(endpoint, {
        headers: ORIGIN_HEADERS,
        multipart: multipart(
          'offer',
          tinyPdf,
          `unauthenticated-${token}.pdf`
        )
      });
      expect(unauthenticated.status()).toBe(401);

      const crossOrigin = await request.post(endpoint, {
        headers: { Origin: 'https://cross-origin.invalid' },
        multipart: multipart('offer', tinyPdf, `cross-origin-${token}.pdf`)
      });
      expect(crossOrigin.status()).toBe(403);

      const wrongType = await request.post(endpoint, {
        headers: ORIGIN_HEADERS,
        multipart: multipart(
          'offer',
          tinyPdf,
          `not-a-pdf-${token}.txt`,
          'text/plain'
        )
      });
      expect(wrongType.status()).toBe(400);

      const invalidSignature = await request.post(endpoint, {
        headers: ORIGIN_HEADERS,
        multipart: multipart(
          'purchase_order',
          Buffer.from('This is not a PDF.', 'utf8'),
          `invalid-${token}.pdf`
        )
      });
      expect(invalidSignature.status()).toBe(400);

      const oversized = await request.post(endpoint, {
        headers: ORIGIN_HEADERS,
        multipart: multipart(
          'offer',
          Buffer.alloc(10 * 1024 * 1024 + 1, 0x20),
          `oversized-${token}.pdf`
        )
      });
      expect(oversized.status()).toBe(400);

      const rejectedRows = await database.query(
        `select id from quote_manual_documents where quote_request_id = $1`,
        [fixture.quoteRequestId]
      );
      expect(rejectedRows.rowCount).toBe(0);

      await page.goto(
        `/admin/orders/quotes/${fixture.quoteRequestId}`
      );
      const documentsCard = page.getByTestId('quote-documents-card');
      const offerRow = page.getByTestId('quote-document-type-offer');
      const purchaseOrderRow = page.getByTestId(
        'quote-document-type-purchase_order'
      );
      const offerInput = page.getByTestId(
        'quote-document-upload-input-offer'
      );
      const purchaseOrderInput = page.getByTestId(
        'quote-document-upload-input-purchase_order'
      );

      await expect(documentsCard).toBeVisible();
      await expect(offerInput).toHaveCount(1);
      await expect(offerInput).toHaveAttribute('accept', 'application/pdf,.pdf');
      await expect(purchaseOrderInput).toHaveCount(1);
      await expect(purchaseOrderInput).toHaveAttribute(
        'accept',
        'application/pdf,.pdf'
      );
      await expect(
        offerRow.getByRole('button', {
          name: 'Naloži ponudbo',
          exact: true
        })
      ).toBeVisible();
      await expect(
        purchaseOrderRow.getByRole('button', {
          name: 'Naloži naročilnico',
          exact: true
        })
      ).toBeVisible();

      const manualOfferName = `rocna-ponudba-${token}.pdf`;
      const offerUploadResponsePromise = page.waitForResponse(
        (response) =>
          response.request().method() === 'POST' &&
          response.url().endsWith(endpoint)
      );
      await offerInput.setInputFiles({
        name: manualOfferName,
        mimeType: 'application/pdf',
        buffer: tinyPdf
      });
      const offerUploadResponse = await offerUploadResponsePromise;
      expect(offerUploadResponse.status()).toBe(201);
      const offerUpload = (await offerUploadResponse.json()) as {
        created?: boolean;
        document?: {
          id?: number;
          documentType?: string;
          filename?: string;
          url?: string;
        };
      };
      expect(offerUpload).toMatchObject({
        created: true,
        document: { documentType: 'offer' }
      });
      expect(offerUpload.document?.filename).toEqual(expect.any(String));
      await expect(offerRow).toContainText(
        String(offerUpload.document?.filename)
      );

      const manualPurchaseOrderName = `rocna-narocilnica-${token}.pdf`;
      const purchaseOrderUploadResponsePromise = page.waitForResponse(
        (response) =>
          response.request().method() === 'POST' &&
          response.url().endsWith(endpoint)
      );
      await purchaseOrderInput.setInputFiles({
        name: manualPurchaseOrderName,
        mimeType: 'application/pdf',
        buffer: tinyPdf
      });
      const purchaseOrderUploadResponse =
        await purchaseOrderUploadResponsePromise;
      expect(purchaseOrderUploadResponse.status()).toBe(201);
      const purchaseOrderUpload =
        (await purchaseOrderUploadResponse.json()) as {
          created?: boolean;
          document?: {
            id?: number;
            documentType?: string;
            filename?: string;
            url?: string;
          };
        };
      expect(purchaseOrderUpload).toMatchObject({
        created: true,
        document: { documentType: 'purchase_order' }
      });
      expect(purchaseOrderUpload.document?.filename).toEqual(
        expect.any(String)
      );
      await expect(purchaseOrderRow).toContainText(
        String(purchaseOrderUpload.document?.filename)
      );

      for (const documentUrl of [
        offerUpload.document?.url,
        purchaseOrderUpload.document?.url
      ]) {
        expect(documentUrl).toEqual(expect.any(String));
        const download = await request.get(String(documentUrl));
        expect(download.status()).toBe(200);
        expect(download.headers()['content-type']).toContain(
          'application/pdf'
        );
        expect(download.headers()['cache-control']).toContain('no-store');
      }

      const storedManualDocuments = await database.query<{
        document_type: string;
        created_by_actor_type: string;
        content_sha256: string;
      }>(
        `
          select document_type, created_by_actor_type, content_sha256
          from quote_manual_documents
          where quote_request_id = $1
          order by document_type
        `,
        [fixture.quoteRequestId]
      );
      expect(storedManualDocuments.rows).toEqual([
        {
          document_type: 'offer',
          created_by_actor_type: 'admin',
          content_sha256: createHash('sha256').update(tinyPdf).digest('hex')
        },
        {
          document_type: 'purchase_order',
          created_by_actor_type: 'admin',
          content_sha256: createHash('sha256').update(tinyPdf).digest('hex')
        }
      ]);

      const lifecycleAfterUpload = await database.query(
        `
          select
            request.status as request_status,
            request.state_version as request_state_version,
            offer.status as offer_status,
            offer.state_version as offer_state_version,
            offer.document_sha256
          from quote_requests request
          join quote_offer_versions offer on offer.id = $2
          where request.id = $1
        `,
        [fixture.quoteRequestId, fixture.draftOfferVersionId]
      );
      expect(lifecycleAfterUpload.rows[0]).toEqual(
        lifecycleBefore.rows[0]
      );
      const canonicalBeforeIssue = await database.query(
        `
          select id
          from quote_documents
          where quote_offer_version_id = $1
        `,
        [fixture.draftOfferVersionId]
      );
      expect(canonicalBeforeIssue.rowCount).toBe(0);

      const issued = await issueOffer(request, fixture);
      expect(issued.quoteOfferVersionId).toBe(
        fixture.draftOfferVersionId
      );

      const documentsAfterIssue = await database.query<{
        manual_count: string | number;
        generated_count: string | number;
        generated_actor: string;
        generated_hash: string;
        bound_hash: string;
      }>(
        `
          select
            (
              select count(*)
              from quote_manual_documents manual
              where manual.quote_request_id = $1
            ) as manual_count,
            (
              select count(*)
              from quote_documents generated
              where generated.quote_offer_version_id = $2
                and generated.document_type = 'offer'
            ) as generated_count,
            generated.created_by_actor_type as generated_actor,
            generated.content_sha256 as generated_hash,
            offer.document_sha256 as bound_hash
          from quote_offer_versions offer
          join quote_documents generated
            on generated.quote_offer_version_id = offer.id
           and generated.document_type = 'offer'
          where offer.id = $2
        `,
        [fixture.quoteRequestId, fixture.draftOfferVersionId]
      );
      expect(documentsAfterIssue.rowCount).toBe(1);
      expect(Number(documentsAfterIssue.rows[0].manual_count)).toBe(2);
      expect(Number(documentsAfterIssue.rows[0].generated_count)).toBe(1);
      expect(documentsAfterIssue.rows[0].generated_actor).toBe('system');
      expect(documentsAfterIssue.rows[0].bound_hash).toBe(
        documentsAfterIssue.rows[0].generated_hash
      );

      const globallyUniqueDocumentIds = await database.query<{
        total_count: string | number;
        distinct_count: string | number;
      }>(
        `
          select count(*) as total_count, count(distinct id) as distinct_count
          from (
            select id
            from quote_manual_documents
            where quote_request_id = $1
            union all
            select generated.id
            from quote_documents generated
            join quote_offer_versions offer
              on offer.id = generated.quote_offer_version_id
            where offer.quote_request_id = $1
          ) all_documents
        `,
        [fixture.quoteRequestId]
      );
      expect(
        Number(globallyUniqueDocumentIds.rows[0].distinct_count)
      ).toBe(Number(globallyUniqueDocumentIds.rows[0].total_count));

      await page.reload();
      const generatedOfferLink = page
        .getByTestId('quote-document-type-offer')
        .getByRole('link', {
          name: 'Odpri PDF ponudbe',
          exact: true
        });
      await expect(generatedOfferLink).toBeVisible();
      await expect(generatedOfferLink).toHaveAttribute(
        'href',
        new RegExp(
          `/api/admin/quote-requests/${fixture.quoteRequestId}/documents/\\d+`,
          'u'
        )
      );
    } finally {
      await fixture.context.close();
    }
  });
});
