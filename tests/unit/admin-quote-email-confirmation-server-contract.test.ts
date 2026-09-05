import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const root = process.cwd();
const read = (relativePath: string) =>
  readFileSync(path.join(root, relativePath), 'utf8');

const resolver = read(
  'src/shared/server/adminCustomerEmailConfirmation.ts'
);
const issueRoute = read(
  'src/admin/api/quote-requests/[quoteRequestId]/issue/route.ts'
);
const clarificationRoute = read(
  'src/admin/api/quote-requests/[quoteRequestId]/clarification/route.ts'
);
const withdrawRoute = read(
  'src/admin/api/quote-requests/[quoteRequestId]/withdraw/route.ts'
);
const closeRoute = read(
  'src/admin/api/quote-requests/[quoteRequestId]/close/route.ts'
);
const orderStatusRoute = read(
  'src/admin/api/orders/[orderId]/status/route.ts'
);
const schoolAcceptance = read(
  'src/shared/server/schoolOrderSellerAcceptance.ts'
);
const retryRoute = read(
  'src/admin/api/quote-email-jobs/[jobId]/retry/route.ts'
);
const quoteEmailJobs = read('src/shared/server/quoteEmailJobs.ts');
const routeUtils = read(
  'src/admin/api/quote-requests/quoteAdminRouteUtils.ts'
);

test('quote confirmation resolver uses live global, quote, event, and recipient policy', () => {
  assert.match(
    resolver,
    /export async function requireQuoteCustomerEmailConfirmation/u
  );
  assert.match(resolver, /getOrderEmailSettings\(client\)/u);
  assert.match(
    resolver,
    /select config_json from quote_email_settings where key = 'default'/u
  );
  assert.match(
    resolver,
    /select email from quote_requests where id = \$1/u
  );
  assert.match(
    resolver,
    /confirmCustomerEmails: sharedSettings\.confirmCustomerEmails/u
  );
  assert.match(resolver, /masterEmailEnabled: quoteSettings\.enabled/u);
  assert.match(
    resolver,
    /quoteSettings\.events\[eventType\]\?\.customer === true/u
  );
});

test('admin quote lifecycle routes challenge before their first mutation', () => {
  const cases = [
    {
      source: issueRoute,
      eventType: 'quote_issued',
      firstMutation: "update quote_offer_versions\n          set status = 'superseded'"
    },
    {
      source: withdrawRoute,
      eventType: 'quote_withdrawn',
      firstMutation: 'update quote_offer_versions'
    },
    {
      source: closeRoute,
      eventType: 'quote_request_closed',
      firstMutation: 'update quote_requests'
    }
  ];

  for (const { source, eventType, firstMutation } of cases) {
    const gateIndex = source.indexOf('await requireQuoteCustomerEmailConfirmation');
    assert.ok(gateIndex >= 0, `${eventType} route is missing its gate`);
    assert.match(source, new RegExp(`eventType: '${eventType}'`, 'u'));
    assert.match(
      source,
      /customerEmailConfirmationToken:\s*\n?\s*parsed\.body\.customerEmailConfirmationToken/u
    );
    assert.match(
      source,
      /NextResponse\.json\(confirmationChallenge, \{ status: 428 \}\)/u
    );
    assert.ok(
      gateIndex < source.indexOf(firstMutation),
      `${eventType} gate must precede its first update`
    );
  }
});

test('clarification gates only email-requesting new and replay enqueue paths', () => {
  assert.equal(
    clarificationRoute.match(
      /await requireQuoteCustomerEmailConfirmation\(/gu
    )?.length,
    2
  );
  assert.ok(
    clarificationRoute.indexOf('await requireQuoteCustomerEmailConfirmation') <
      clarificationRoute.indexOf(
        'replayEmailQueued = await enqueueQuoteEmailIsolated'
      )
  );
  const newGateIndex = clarificationRoute.lastIndexOf(
    'await requireQuoteCustomerEmailConfirmation'
  );
  assert.ok(
    clarificationRoute.lastIndexOf('if (sendEmail)', newGateIndex) <
      newGateIndex
  );
  assert.ok(
    newGateIndex < clarificationRoute.indexOf('await appendQuoteEvent(client')
  );
  assert.match(
    clarificationRoute,
    /eventType: 'quote_clarification_requested'/u
  );
});

test('school quote acceptance challenges the actual stock outcome before mutation', () => {
  const gateIndex = schoolAcceptance.indexOf(
    'await requireOutcomeConfirmation'
  );
  assert.ok(gateIndex >= 0);
  assert.match(
    orderStatusRoute,
    /automaticallyAcceptsSchoolOrder[\s\S]*?sourceQuoteRequestIdForAcceptance !== null/u
  );
  assert.match(
    schoolAcceptance,
    /requireOrderAndQuoteCustomerEmailConfirmation/u
  );
  assert.match(schoolAcceptance, /requireOutcomeConfirmation\('quote_accepted'\)/u);
  assert.match(
    schoolAcceptance,
    /requireOutcomeConfirmation\('quote_acceptance_blocked_stock'\)/u
  );
  assert.ok(
    schoolAcceptance.indexOf(
      "requireOutcomeConfirmation('quote_accepted')"
    ) < schoolAcceptance.indexOf('await commitOrderStockHolds')
  );
  assert.ok(
    schoolAcceptance.indexOf(
      "requireOutcomeConfirmation('quote_acceptance_blocked_stock')"
    ) < schoolAcceptance.indexOf("'acceptance_blocked_stock', 'system'")
  );
});

test('quote issue binds confirmation to the draft snapshot recipient', () => {
  assert.match(issueRoute, /const email = text\(snapshotValue\('email'/u);
  assert.match(
    issueRoute,
    /eventType: 'quote_issued'[\s\S]*?recipientEmail: email/u
  );
});

test('quote issue confirmation-only preflight is read-only and snapshot-authoritative', () => {
  const start = issueRoute.indexOf(
    'if (parsed.body.confirmationOnly === true)'
  );
  const end = issueRoute.indexOf('const acceptanceMethod', start);
  assert.ok(start >= 0, 'issue route is missing confirmation-only preflight');
  assert.ok(end > start, 'issue preflight must finish before issuance validation');
  const preflight = issueRoute.slice(start, end);

  assert.match(preflight, /await requireQuoteCustomerEmailConfirmation/u);
  assert.match(preflight, /eventType: 'quote_issued'/u);
  assert.match(preflight, /recipientEmail: email/u);
  assert.match(preflight, /await client\.query\('rollback'\)/u);
  assert.match(preflight, /status: 428/u);
  assert.match(preflight, /confirmationRequired: false/u);
  assert.doesNotMatch(preflight, /update |insert into|enqueueQuoteEmailEvent/u);
});

test('failed quote retry honors live policy and signed customer confirmation', () => {
  assert.match(retryRoute, /normalizeQuoteEmailSettings/u);
  assert.match(retryRoute, /QUOTE_EMAIL_POLICY_DISABLED/u);
  assert.match(retryRoute, /settings\.events\[eventType\]\.customer/u);
  assert.match(retryRoute, /settings\.events\[eventType\]\.admins/u);
  assert.match(retryRoute, /immutableRecipientEmail !==[\s\S]*?job\.recipient_email/u);
  assert.match(retryRoute, /request\.email as request_email/u);
  assert.match(retryRoute, /getOrderEmailSettings\(client\)/u);
  assert.match(
    retryRoute,
    /audience === 'admin'[\s\S]*?adminRecipients[\s\S]*?currentAdminRecipients\.has\(immutableRecipientEmail\)[\s\S]*?QUOTE_EMAIL_RECIPIENT_STALE/u
  );
  assert.match(
    retryRoute,
    /audience === 'customer'[\s\S]*?immutableRecipientEmail !==[\s\S]*?job\.request_email[\s\S]*?QUOTE_EMAIL_RECIPIENT_STALE/u
  );
  assert.match(retryRoute, /recipientEmail: immutableRecipientEmail/u);
  assert.match(retryRoute, /action: `retry_quote_email:\$\{jobId\}`/u);
  assert.match(
    retryRoute,
    /customerEmailConfirmationToken:\s*\n?\s*parsed\.body\.customerEmailConfirmationToken/u
  );
  assert.ok(
    retryRoute.indexOf('QUOTE_EMAIL_RECIPIENT_STALE') <
      retryRoute.indexOf('await requireQuoteCustomerEmailConfirmation')
  );
  assert.ok(
    retryRoute.indexOf('await requireQuoteCustomerEmailConfirmation') <
      retryRoute.indexOf('update quote_email_jobs')
  );
});

test('persisted master toggle blocks every quote email including OTP', () => {
  assert.match(
    quoteEmailJobs,
    /if \(!settings\.enabled\) \{[\s\S]*?return \[\];/u
  );
  assert.match(
    quoteEmailJobs,
    /if \(!quoteEmailEnabled\) \{[\s\S]*?return \{ claimed: 0, sent: 0, retried: 0, failed: 0 \};/u
  );
  assert.doesNotMatch(
    quoteEmailJobs,
    /otpOnly|input\.eventType !== 'quote_access_otp'|input\.eventType === 'quote_access_otp' \|\| configuredEvent\.customer/u
  );
});

test('quote queue audiences remain settings-authoritative without route overrides', () => {
  for (const source of [
    routeUtils,
    clarificationRoute,
    withdrawRoute,
    closeRoute
  ]) {
    assert.doesNotMatch(source, /forceCustomer|suppressAdmin/u);
  }
});
