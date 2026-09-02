import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';
import {
  cloneDefaultQuoteEmailSettings,
  normalizeQuoteEmailSettings,
  validateQuoteEmailSettings
} from '../../src/shared/domain/quote/quoteEmailSettings';

const source = (relativePath: string) =>
  readFileSync(resolve(process.cwd(), relativePath), 'utf8');

test('quote stock acceptance defaults to manual and only opts into automatic mode explicitly', () => {
  assert.equal(cloneDefaultQuoteEmailSettings().stockAcceptanceMode, 'manual');
  assert.equal(normalizeQuoteEmailSettings(undefined).stockAcceptanceMode, 'manual');
  assert.equal(
    normalizeQuoteEmailSettings({ stockAcceptanceMode: 'manual' })
      .stockAcceptanceMode,
    'manual'
  );
  assert.equal(
    normalizeQuoteEmailSettings({ stockAcceptanceMode: 'automatic' })
      .stockAcceptanceMode,
    'automatic'
  );

  for (const invalid of [true, false, '', 'legacy', 1, null, {}]) {
    assert.equal(
      normalizeQuoteEmailSettings({ stockAcceptanceMode: invalid })
        .stockAcceptanceMode,
      'manual',
      `unexpected mode ${JSON.stringify(invalid)} must fail closed to manual`
    );
  }
});

test('both supported stock acceptance modes remain valid quote settings', () => {
  for (const stockAcceptanceMode of ['manual', 'automatic'] as const) {
    const settings = cloneDefaultQuoteEmailSettings();
    settings.stockAcceptanceMode = stockAcceptanceMode;
    assert.deepEqual(validateQuoteEmailSettings(settings), []);
  }
});

test('quote email settings persistence stores and audits the selected stock acceptance mode', () => {
  const settings = source('src/shared/server/quoteEmailSettings.ts');

  assert.match(
    settings,
    /const normalized = normalizeQuoteEmailSettings\(value\)[\s\S]*?JSON\.stringify\(stored\)/u
  );
  assert.match(settings, /stock_acceptance_mode:\s*normalized\.stockAcceptanceMode/u);
});

test('stock acceptance mode lookup fails closed to manual when settings are unavailable', () => {
  const settings = source('src/shared/server/quoteEmailSettings.ts');
  const start = settings.indexOf(
    'export async function getQuoteStockAcceptanceMode'
  );
  const end = settings.indexOf('\nfunction iso', start);
  assert.ok(start >= 0 && end > start);
  const lookup = settings.slice(start, end);

  assert.match(lookup, /to_regclass\('public\.quote_email_settings'\)/u);
  assert.match(lookup, /if \(readiness\.rows\[0\]\?\.ready !== true\) return 'manual'/u);
  assert.match(
    lookup,
    /normalizeQuoteEmailSettings\([\s\S]*?result\.rows\[0\]\?\.config_json[\s\S]*?\)\.stockAcceptanceMode/u
  );
});

test('public quote acceptance makes sticky blocking and notification automatic-only', () => {
  const acceptance = source(
    'src/commercial/api/quote-requests/accept/route.ts'
  );

  assert.match(acceptance, /getQuoteStockAcceptanceMode\(client\)/u);
  assert.match(
    acceptance,
    /stockAcceptanceMode === 'automatic'[\s\S]*?acceptance_blocked_by_stock/u
  );

  const conflictStart = acceptance.indexOf(
    'if (error instanceof OrderStockConflictError)'
  );
  const conflictEnd = acceptance.indexOf('\n      throw error;', conflictStart);
  assert.ok(conflictStart >= 0 && conflictEnd > conflictStart);
  const conflict = acceptance.slice(conflictStart, conflictEnd);
  const manualStart = conflict.indexOf(
    "if (stockAcceptanceMode === 'manual')"
  );
  const durableBlockEvent = conflict.indexOf(
    "'acceptance_blocked_stock', 'system'"
  );
  const durableBlockStart = conflict.lastIndexOf(
    'await client.query(',
    durableBlockEvent
  );
  assert.ok(manualStart >= 0);
  assert.ok(durableBlockEvent > manualStart);
  assert.ok(durableBlockStart > manualStart);

  const manual = conflict.slice(manualStart, durableBlockStart);
  assert.match(conflict, /httpStatus:\s*409/u);
  assert.match(manual, /status:\s*409/u);
  assert.match(manual, /completeQuoteResponseIdempotency/u);
  assert.match(manual, /await client\.query\('commit'\)/u);
  assert.match(manual, /return NextResponse\.json/u);
  assert.doesNotMatch(manual, /insert into quote_events/u);
  assert.doesNotMatch(manual, /enqueueQuoteEmailEvent/u);
  assert.doesNotMatch(manual, /scheduleQuoteEmailJobs/u);

  const automatic = conflict.slice(durableBlockStart);
  assert.match(automatic, /enqueueQuoteEmailEvent/u);
  assert.match(automatic, /eventType: 'quote_acceptance_blocked_stock'/u);
  assert.match(automatic, /scheduleQuoteEmailJobs\(pool\)/u);
});

test('school quote acceptance ignores sticky blocks in manual mode and persists them only in automatic mode', () => {
  const acceptance = source(
    'src/shared/server/schoolOrderSellerAcceptance.ts'
  );

  assert.match(acceptance, /getQuoteStockAcceptanceMode\(client\)/u);
  assert.match(
    acceptance,
    /stockEnforcementEnabled &&[\s\S]*?stockAcceptanceMode === 'automatic' &&[\s\S]*?sourceQuote\.stockBlocked/u
  );

  const conflictStart = acceptance.indexOf(
    'if (!(error instanceof OrderStockConflictError)) throw error;'
  );
  const conflictEnd = acceptance.indexOf(
    '\n  const acceptedAt = new Date().toISOString();',
    conflictStart
  );
  assert.ok(conflictStart >= 0 && conflictEnd > conflictStart);
  const conflict = acceptance.slice(conflictStart, conflictEnd);
  const manualStart = conflict.indexOf(
    "if (stockAcceptanceMode === 'manual')"
  );
  const automaticStart = conflict.indexOf(
    "await requireOutcomeConfirmation('quote_acceptance_blocked_stock')"
  );
  assert.ok(manualStart >= 0);
  assert.ok(automaticStart > manualStart);

  const manual = conflict.slice(manualStart, automaticStart);
  assert.match(manual, /status:\s*409/u);
  assert.match(manual, /persistConflictOutcome:\s*false/u);
  assert.match(manual, /quoteEmailQueued:\s*false/u);
  assert.doesNotMatch(manual, /insert into quote_events/u);
  assert.doesNotMatch(manual, /enqueueQuoteEmailEvent/u);

  const automatic = conflict.slice(automaticStart);
  assert.match(
    automatic,
    /'acceptance_blocked_stock', 'system'/u
  );
  assert.match(automatic, /enqueueQuoteEmailEvent/u);
  assert.match(automatic, /eventType: 'quote_acceptance_blocked_stock'/u);
  assert.match(automatic, /persistConflictOutcome:\s*true/u);
});
