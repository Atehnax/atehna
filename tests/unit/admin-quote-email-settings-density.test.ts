import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

const section = readFileSync(
  resolve(
    process.cwd(),
    'src/admin/features/email/components/AdminQuoteEmailSettingsSection.tsx'
  ),
  'utf8'
);

test('Ponudbe email settings use a dense neutral admin workspace', () => {
  assert.match(section, /data-testid="quote-email-settings-section"/u);
  assert.match(section, /<section className="space-y-4"/u);
  assert.match(section, /rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm/u);
  assert.match(section, /Samodejna e-pošta ponudb/u);
  assert.match(section, /Uporablja isti profil pošiljatelja/u);
  assert.doesNotMatch(section, /border-blue-200 bg-blue-50 p-5/u);
  assert.doesNotMatch(section, /\bp-5\b|\bgap-5\b|\bh-10\b|\bmin-h-32\b/u);
});

test('events, templates, and queue use compact responsive grids', () => {
  assert.match(section, /data-testid="quote-email-editor-card"/u);
  assert.match(
    section,
    /grid gap-2 p-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4[^>]*data-testid="quote-email-event-grid"/u
  );
  assert.match(section, /data-testid="quote-email-template-grid"/u);
  assert.match(section, /grid gap-3 p-3 lg:grid-cols-2/u);
  assert.match(section, /data-testid="quote-email-queue-grid"/u);
  assert.match(section, /grid grid-cols-2 gap-2 p-3 sm:grid-cols-4/u);
  assert.match(section, /h-8 w-full rounded-md border border-slate-300/u);
  assert.match(section, /min-h-24 w-full resize-y rounded-md/u);
});

test('density refactor preserves quote email behavior and accessible controls', () => {
  assert.match(section, /QUOTE_EMAIL_EDITABLE_EVENT_DEFINITIONS\.map/u);
  assert.match(section, /aria-label=\{`\$\{definition\.label\}: stranka`\}/u);
  assert.match(section, /aria-label=\{`\$\{definition\.label\}: admin`\}/u);
  assert.match(section, /aria-label=\{`Uredi predlogo: \$\{definition\.label\}`\}/u);
  assert.match(section, /aria-pressed=\{selected\}/u);
  assert.match(section, /updateEvent\(definition\.value/u);
  assert.match(section, /updateTemplate\(audience, 'subject'/u);
  assert.match(section, /updateTemplate\(audience, 'body'/u);
  assert.match(section, /fetch\('\/api\/admin\/quote-email-settings'/u);
  assert.match(section, /fetch\(`\/api\/admin\/quote-email-jobs\/\$\{jobId\}\/retry`/u);
  assert.match(section, /disabled=\{!hasChanges \|\| saving \|\| mutationsDisabled\}/u);
});
