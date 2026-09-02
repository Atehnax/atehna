import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';
import {
  CUSTOMER_EMAIL_CONFIRMATION_REQUIRED,
  parseCustomerEmailConfirmationRequired
} from '../../src/admin/features/email/customerEmailConfirmation';

const source = (path: string) =>
  readFileSync(resolve(process.cwd(), path), 'utf8');

const sliceBetween = (value: string, startMarker: string, endMarker: string) => {
  const start = value.indexOf(startMarker);
  assert.notEqual(start, -1, `Expected to find start marker: ${startMarker}`);
  const end = value.indexOf(endMarker, start + startMarker.length);
  assert.notEqual(end, -1, `Expected to find end marker: ${endMarker}`);
  return value.slice(start, end);
};

test('customer email confirmation parser accepts nested and top-level 428 shapes', () => {
  const details = {
    scope: 'quote',
    eventType: 'quote_withdrawn',
    eventLabel: 'Ponudba umaknjena',
    actionLabel: 'Umakni izdano ponudbo',
    action: 'Umakni izdano ponudbo',
    recipientEmail: 'customer@example.com',
    confirmationToken: 'payload.signature',
    expiresAt: '2099-01-01T00:00:00.000Z',
    deliveries: [{
      scope: 'quote' as const,
      entityId: 7,
      eventType: 'quote_withdrawn',
      eventLabel: 'Ponudba umaknjena',
      recipientEmail: 'customer@example.com'
    }]
  };

  assert.deepEqual(
    parseCustomerEmailConfirmationRequired({
      code: CUSTOMER_EMAIL_CONFIRMATION_REQUIRED,
      confirmation: details
    }),
    details
  );
  assert.deepEqual(
    parseCustomerEmailConfirmationRequired({
      code: CUSTOMER_EMAIL_CONFIRMATION_REQUIRED,
      ...details
    }),
    details
  );
  assert.equal(
    parseCustomerEmailConfirmationRequired({
      code: 'SOME_OTHER_ERROR',
      confirmation: details
    }),
    null
  );
});

test('shared customer email confirmation flow uses the standard ConfirmDialog', () => {
  const hook = source(
    'src/admin/features/email/useCustomerEmailConfirmation.ts'
  );
  const dialog = source(
    'src/admin/features/email/components/CustomerEmailConfirmationDialog.tsx'
  );
  const cancelSource = sliceBetween(
    hook,
    'const cancelConfirmation',
    'const confirm'
  );

  assert.match(hook, /response\.status !== 428/u);
  assert.match(hook, /parseCustomerEmailConfirmationRequired\(payload\)/u);
  assert.match(hook, /setPending\(\{ details, onConfirm \}\)/u);
  assert.match(cancelSource, /setPending\(null\)/u);
  assert.doesNotMatch(cancelSource, /onConfirm|callback|fetch\(/u);

  assert.match(dialog, /import \{ ConfirmDialog \}/u);
  assert.match(dialog, /title="Pošljem e-pošto stranki\?"/u);
  assert.match(dialog, /confirmLabel="Potrdi in nadaljuj"/u);
  assert.match(dialog, /confirmation\.deliveries\.map/u);
  assert.match(dialog, /delivery\.recipientEmail/u);
  assert.match(dialog, /max-h-\[calc\(100dvh-3rem\)\]/u);
});

test('quote issue and clarification retry only with a server-issued token', () => {
  const detail = source(
    'src/admin/features/quotes/components/AdminQuoteDetailClient.tsx'
  );
  const confirmIssue = sliceBetween(
    detail,
    'const confirmIssue',
    'const resetClarificationDialog'
  );
  const clarification = sliceBetween(
    detail,
    'const requestClarification',
    'const retryEmail'
  );

  assert.match(
    confirmIssue,
    /callAction\('issue'\)/u
  );
  assert.doesNotMatch(confirmIssue, /customerEmailConfirmed/u);
  assert.match(
    clarification,
    /sendEmail && customerEmailConfirmationToken[\s\S]*?customerEmailConfirmationToken/u
  );
  assert.match(
    clarification,
    /handleCustomerEmailConfirmationRequired\([\s\S]*?requestClarification\(true, confirmationToken\)/u
  );
  assert.match(
    detail,
    /onRecordOnly=\{\(\) => void requestClarification\(false\)\}/u
  );
  assert.match(
    detail,
    /onRecordAndSend=\{\(\) => void requestClarification\(true\)\}/u
  );
});

test('dirty quote issuance confirms before persisting any draft edits', () => {
  const detail = source(
    'src/admin/features/quotes/components/AdminQuoteDetailClient.tsx'
  );
  const actionRequest = sliceBetween(
    detail,
    'const callAction = async',
    'const requestLifecycleAction'
  );
  const preflightIndex = actionRequest.indexOf('confirmationOnly: true');
  const persistIndex = actionRequest.indexOf(
    'const saved = await persistDraft(draft)'
  );

  assert.ok(preflightIndex >= 0, 'dirty issue is missing its confirmation preflight');
  assert.ok(persistIndex >= 0, 'dirty issue is missing draft persistence');
  assert.ok(
    preflightIndex < persistIndex,
    'confirmation preflight must happen before dirty draft persistence'
  );
  assert.match(
    actionRequest.slice(preflightIndex, persistIndex),
    /handleCustomerEmailConfirmationRequired\([\s\S]*?customerEmailConfirmationToken: confirmationToken/u
  );
  assert.match(
    actionRequest.slice(0, persistIndex),
    /confirmationOnly: true,[\s\S]*?options\.customerEmailConfirmationToken[\s\S]*?customerEmailConfirmationToken:[\s\S]*?options\.customerEmailConfirmationToken/u
  );
  assert.doesNotMatch(
    actionRequest.slice(0, preflightIndex),
    /!options\.customerEmailConfirmationToken/u
  );
});

test('quote withdraw and close ask the server before showing email confirmation', () => {
  const detail = source(
    'src/admin/features/quotes/components/AdminQuoteDetailClient.tsx'
  );
  const lifecycleRequest = sliceBetween(
    detail,
    'const requestLifecycleAction',
    'const handleRequestStatusSelection'
  );
  const actionRequest = sliceBetween(
    detail,
    'const callAction = async',
    'const requestLifecycleAction'
  );

  assert.match(lifecycleRequest, /window\.prompt\(/u);
  assert.match(
    lifecycleRequest,
    /void callAction\(action, \{ reason: reason\.trim\(\) \}\)/u
  );
  assert.doesNotMatch(
    lifecycleRequest,
    /customerEmailConfirmed|requestCustomerEmailConfirmation|fetch\(/u
  );
  assert.match(
    actionRequest,
    /handleCustomerEmailConfirmationRequired\([\s\S]*?callAction\(action, \{[\s\S]*?customerEmailConfirmationToken: confirmationToken/u
  );
  assert.doesNotMatch(
    actionRequest,
    /Ponudba ne bo več veljavna[\s\S]*?window\.confirm|Povpraševanje bo zaključeno[\s\S]*?window\.confirm/u
  );
  assert.match(
    detail,
    /<CustomerEmailConfirmationDialog[\s\S]*?onCancel=\{cancelCustomerEmailConfirmation\}[\s\S]*?onConfirm=\{confirmCustomerEmail\}/u
  );
});
