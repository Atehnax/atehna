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
const queueMetricCard = readFileSync(
  resolve(
    process.cwd(),
    'src/admin/features/email/components/EmailQueueMetricCard.tsx'
  ),
  'utf8'
);

test('Ponudbe email settings use the shared neutral admin workspace', () => {
  assert.match(section, /data-testid="quote-email-settings-section"/u);
  assert.ok(
    section.includes(
      `<section className="font-['Inter',system-ui,sans-serif]"`
    )
  );
  assert.match(section, /adminWindowCardClassName/u);
  assert.match(section, /adminWindowCardStyle/u);
  assert.match(section, /divide-y divide-slate-200 bg-white/u);
  assert.doesNotMatch(section, /Pošiljanje ponudb/u);
  assert.doesNotMatch(section, /Uporablja isti profil pošiljatelja/u);
  assert.match(section, /mt-1 max-w-3xl text-sm leading-5/u);
  assert.doesNotMatch(section, /Zastavici: admin|Poslovna e-pošta ponudb/u);
  assert.equal(section.match(/adminWindowCardClassName/gu)?.length, 2);
  assert.equal(section.match(/adminWindowCardStyle/gu)?.length, 2);
  assert.equal(section.includes('text-[10px]'), false);
  assert.equal(section.includes('text-[11px]'), false);
  assert.doesNotMatch(section, /rounded-xl border border-slate-200 bg-white[^\n]*shadow-sm/u);
});

test('events use the canonical admin table while templates and queue retain responsive shared controls', () => {
  const eventsIndex = section.indexOf('id="quote-email-events-heading"');
  const templatesIndex = section.indexOf(
    'data-testid="quote-email-message-templates"'
  );
  const queueIndex = section.indexOf('data-testid="quote-email-queue-card"');
  assert.ok(
    eventsIndex > 0 &&
      eventsIndex < templatesIndex &&
      templatesIndex < queueIndex
  );
  assert.match(section, /data-testid="quote-email-editor-card"/u);
  assert.match(section, /data-testid="quote-email-event-grid"/u);
  assert.match(section, /data-testid="quote-email-event-table"/u);
  for (const primitive of ['Table', 'THead', 'TBody', 'TR', 'TH', 'TD']) {
    assert.ok(section.includes(`<${primitive}`), `${primitive} must be used`);
  }
  assert.match(section, /adminTableHeaderCellLeftClassName/u);
  assert.match(section, /adminTableHeaderCellCenterClassName/u);
  assert.match(section, /adminTableBodyCellLeftClassName/u);
  assert.match(section, /adminTableBodyCellCenterClassName/u);
  assert.match(section, /adminTableRowHeightClassName/u);
  assert.match(section, /getQuoteEmailEventStatusPresentation/u);
  assert.match(section, />Dogodek<\/TH>/u);
  assert.match(section, />Stranka<\/TH>/u);
  assert.match(section, />Administratorji<\/TH>/u);
  assert.doesNotMatch(section, />Predloga<\/TH>/u);
  assert.match(section, /min-w-\[640px\] table-fixed text-\[12px\]/u);
  assert.match(section, /definition\.description/u);
  assert.match(section, /quote-email-event-row-/u);
  assert.match(section, /data-status-tone/u);
  assert.match(section, /<CustomSelect<EditableEvent>/u);
  assert.match(section, /testId="quote-email-template-event"/u);
  assert.match(section, /ariaLabel="Dogodek ponudbe"/u);
  assert.match(section, /onChange=\{setSelectedEvent\}/u);
  assert.match(section, /data-testid="quote-email-message-templates"/u);
  assert.doesNotMatch(
    section.slice(templatesIndex, queueIndex),
    /Pošiljanje ponudb/u
  );
  assert.match(section, /data-testid="quote-email-template-grid"/u);
  assert.match(section, /mt-3 grid min-w-0 gap-3 lg:grid-cols-2/u);
  assert.match(section, /data-testid="quote-email-queue-grid"/u);
  assert.match(section, />Čakalna vrsta ponudb<\/h3>/u);
  assert.match(section, /grid grid-cols-2 gap-3 sm:grid-cols-4/u);
  assert.match(section, />Čakajoča sporočila<\/h4>/u);
  assert.match(section, /data-testid="quote-email-pending-table"/u);
  assert.match(section, /state\.queue\.pendingJobs\.map/u);
  assert.match(section, /data-testid=\{`quote-email-cancel-\$\{job\.id\}`\}/u);
  assert.match(section, />Nedavne napake<\/h4>/u);
  assert.match(section, /data-testid="quote-email-failure-table"/u);
  for (const column of [
    'Občinstvo',
    'Prejemnik',
    'Poskusi',
    'Napaka',
    'Posodobljeno',
    'Dejanje'
  ]) {
    assert.match(section, new RegExp(`>${column}<\\/TH>`, 'u'));
  }
  assert.doesNotMatch(section, /<article\b/u);
  assert.match(section, /<EmailQueueMetricCard/u);
  assert.match(
    queueMetricCard,
    /rounded-lg border border-slate-200 bg-slate-50\/60 px-3 py-2\.5/u
  );
  assert.match(
    queueMetricCard,
    /text-base font-semibold tabular-nums text-slate-900/u
  );
  assert.match(queueMetricCard, /text-xs text-slate-500/u);
  assert.match(section, /inputClassName[^\n]*mt-1\.5/u);
  assert.match(section, /min-h-24 w-full resize-y rounded-md/u);
  assert.match(section, /<AdminCheckbox/u);
  assert.match(section, /<Button/u);
  assert.match(section, /<IconButton/u);
  assert.match(section, /<TrashCanIcon/u);
  assert.match(section, /<RefreshCw/u);
  assert.match(section, /<ConfirmDialog/u);
  assert.doesNotMatch(section, /<AdminTablePrimaryActionButton/u);
  assert.match(section, /variant="default"[^>]*size="toolbar"[^>]*className=\{adminTableBulkHeaderButtonClassName\}/u);
  assert.match(section, /<QuoteTemplateEditorCard/u);
  assert.match(section, /Ponastavi privzeto/u);
  assert.match(section, /Dovoljene spremenljivke/u);
  assert.match(section, /data-testid=\{`quote-email-template-\$\{audience\}`\}/u);
  assert.match(section, /audience: 'customer' \| 'admin'/u);
  assert.match(section, /title=\{audience === 'customer' \? 'Stranka' : 'Administrator'\}/u);
  assert.match(section, /aria-label=\{`Zadeva za \$\{audienceLabel\}`\}/u);
  assert.match(section, /aria-label=\{`Vsebina za \$\{audienceLabel\}`\}/u);
  assert.match(
    section,
    /aria-label=\{`Ponastavi privzeto predlogo za \$\{audienceLabel\}`\}/u
  );
  assert.match(
    section,
    /aria-label=\{`Dovoljene spremenljivke za \$\{audienceLabel\}`\}/u
  );
  assert.match(section, /QUOTE_EMAIL_TEMPLATE_VARIABLES\.map/u);
  assert.match(section, /buildQuoteEmailMessage/u);
  assert.match(section, /sharedSettings: OrderEmailSettings/u);
  assert.match(section, /quoteSettings: draft/u);
  assert.match(section, /testId="quote-email-preview"/u);
  assert.match(section, /testId="quote-email-preview-audience"/u);
  assert.match(section, /<CustomSelect<QuoteEmailAudience>/u);
  assert.match(
    section,
    /\(\['customer', 'admin'\] as const\)\.map\(\(audience\)[\s\S]*?updateTemplate\(audience, 'subject', value\)[\s\S]*?updateTemplate\(audience, 'body', value\)[\s\S]*?resetTemplate\(audience\)/u
  );
  assert.doesNotMatch(
    section.slice(templatesIndex, queueIndex),
    /order-email-(?:shared-content|subject-prefix|header|footer|image-attachment)/u
  );
  assert.doesNotMatch(section, /<input\b|<button\b/u);
});

test('density refactor preserves quote email behavior and accessible controls', () => {
  assert.match(section, /QUOTE_EMAIL_EDITABLE_EVENT_DEFINITIONS\.map/u);
  assert.match(section, /aria-label=\{`\$\{definition\.label\}: stranka`\}/u);
  assert.match(section, /aria-label=\{`\$\{definition\.label\}: admin`\}/u);
  assert.doesNotMatch(section, /Uredi predlogo|aria-pressed|aria-selected/u);
  assert.match(section, /data-testid=\{`quote-email-event-\$\{definition\.value\}-customer`\}/u);
  assert.match(section, /data-testid=\{`quote-email-event-\$\{definition\.value\}-admins`\}/u);
  assert.match(section, /updateEvent\(definition\.value/u);
  assert.match(section, /const updateTemplate = \([\s\S]*?audience: 'customer' \| 'admin'/u);
  assert.match(section, /updateTemplate\(audience, 'subject', value\)/u);
  assert.match(section, /updateTemplate\(audience, 'body', value\)/u);
  assert.match(section, /Zadeva za \$\{audienceLabel\}/u);
  assert.match(section, /fetch\('\/api\/admin\/quote-email-settings'/u);
  assert.match(section, /fetch\(`\/api\/admin\/quote-email-jobs\/\$\{jobId\}\/retry`/u);
  assert.match(section, /fetch\(`\/api\/admin\/quote-email-jobs\/\$\{candidate\.id\}`[\s\S]*?method: 'DELETE'/u);
  assert.match(section, /aria-label=\{`Odstrani iz čakalne vrste:/u);
  assert.match(section, /aria-label=\{`Ponovi pošiljanje:/u);
  assert.doesNotMatch(section, />Ponovi<\/Button>/u);
  assert.match(section, /forwardRef<[\s\S]*?AdminQuoteEmailSettingsHandle/u);
  assert.match(section, /useImperativeHandle\(ref,[\s\S]*?save: \(\) => save\(\)/u);
  assert.match(section, /setEnabled: \(enabled\)[\s\S]*?setDraft/u);
  assert.match(
    section,
    /setStockAcceptanceMode: \(stockAcceptanceMode\)[\s\S]*?setDraft/u
  );
  assert.match(section, /enabled: draft\.enabled/u);
  assert.match(
    section,
    /stockAcceptanceMode: draft\.stockAcceptanceMode/u
  );
  assert.match(section, /mutationsDisabled/u);
  assert.match(
    section,
    /const submittedComparable = comparable\(submittedConfig\)[\s\S]*?comparable\(current\) === submittedComparable/u
  );
  assert.match(section, /const saveDisabled = !hasChanges \|\| saving \|\| mutationsDisabled/u);
  assert.match(section, /onSaveStateChange\?\.\(\{[\s\S]*?updatedAt: state\.config\.updatedAt/u);
});
