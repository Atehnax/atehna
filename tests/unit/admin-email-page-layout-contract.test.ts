import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import { isolateEmailPreviewHtml } from "../../src/admin/features/email/components/EmailMessagePreview";

const source = (path: string) =>
  readFileSync(resolve(process.cwd(), path), "utf8");

test("admin email page exposes the standardized settings, orders, and quotes tabs", () => {
  const ui = source(
    "src/admin/features/email/components/AdminOrderEmailSettingsPageClient.tsx",
  );

  const settingsTab = ui.indexOf('value: "settings"');
  const ordersTab = ui.indexOf('value: "orders"');
  const quotesTab = ui.indexOf('value: "quotes"');
  assert.ok(
    settingsTab > 0 && settingsTab < ordersTab && ordersTab < quotesTab,
  );
  assert.match(ui, /value: "settings",\s+label: "Nastavitve"/u);
  assert.match(ui, /value: "orders",\s+label: "Naročila"/u);
  assert.match(ui, /value: "quotes",\s+label: "Ponudbe"/u);
  assert.doesNotMatch(ui, /label: "Predloge"/u);
  assert.doesNotMatch(ui, /Ta razdelek vsebuje/u);
  assert.match(ui, /tabClassName="!min-w-0 flex-1 !px-2/u);
});

test("email sections are assigned to compact persistent tab panels without losing drafts", () => {
  const ui = source(
    "src/admin/features/email/components/AdminOrderEmailSettingsPageClient.tsx",
  );
  const quoteUi = source(
    "src/admin/features/email/components/AdminQuoteEmailSettingsSection.tsx",
  );
  const settingsPanel = ui.indexOf('id="order-email-settings-panel"');
  const ordersPanel = ui.indexOf('id="order-email-orders-panel"');
  const quotesPanel = ui.indexOf('id="order-email-quotes-panel"');
  assert.ok(
    settingsPanel > 0 &&
      settingsPanel < ordersPanel &&
      ordersPanel < quotesPanel,
  );

  const settingsSource = ui.slice(settingsPanel, ordersPanel);
  assert.match(settingsSource, /title="Pošiljanje"/u);
  assert.match(settingsSource, /Pošiljanje naročil/u);
  assert.match(settingsSource, /Pošiljanje ponudb/u);
  assert.match(settingsSource, /data-testid="quote-email-delivery-settings"/u);
  assert.match(settingsSource, /data-testid="quote-stock-acceptance-policy"/u);
  assert.match(settingsSource, /Samodejna blokada sprejema zaradi zaloge/u);
  assert.match(settingsSource, /Ročni način \(privzeto\)/u);
  assert.match(settingsSource, /Samodejni način/u);
  assert.equal(
    ui.match(/data-testid="quote-email-delivery-settings"/gu)?.length,
    1,
  );
  assert.equal(settingsSource.match(/<SettingsCard>/gu)?.length, 5);
  assert.match(settingsSource, /className="space-y-3 outline-none"/u);
  assert.match(settingsSource, /title="Pošiljatelj in povezave"/u);
  const senderSettings = settingsSource.indexOf(
    'testId="order-email-sender-settings"',
  );
  const sharedContent = settingsSource.indexOf(
    'testId="order-email-shared-content"',
  );
  const customerConfirmation = settingsSource.indexOf(
    'data-testid="order-email-customer-confirmation-settings"',
  );
  assert.ok(
    senderSettings > 0 &&
      senderSettings < sharedContent &&
      sharedContent < customerConfirmation,
  );
  assert.match(settingsSource, /title="Skupna vsebina"/u);
  assert.match(settingsSource, /id="order-email-subject-prefix"/u);
  assert.match(settingsSource, /id="order-email-header"/u);
  assert.match(settingsSource, /id="order-email-footer"/u);
  assert.match(settingsSource, /id="order-email-image-attachment"/u);
  assert.match(
    settingsSource,
    /grid items-stretch gap-0 lg:grid-cols-\[minmax\(0,1\.15fr\)_minmax\(20rem,0\.85fr\)\]/u,
  );
  assert.match(settingsSource, /min-w-0 space-y-3 lg:pr-5/u);
  assert.match(settingsSource, /lg:border-l lg:border-t-0 lg:pl-5/u);
  assert.match(settingsSource, /Samodejna vsebina e-pošte/u);
  assert.match(settingsSource, /data-testid="order-email-image-empty-state"/u);
  assert.doesNotMatch(settingsSource, /lg:row-span-2/u);
  assert.match(
    settingsSource,
    /accept="image\/png,image\/jpeg,image\/webp,image\/gif"/u,
  );
  assert.equal(ui.match(/testId="order-email-shared-content"/gu)?.length, 1);
  assert.match(settingsSource, /title="Potrditve in prejemniki"/u);
  assert.match(settingsSource, /Potrditev e-pošte stranki/u);
  assert.match(settingsSource, /order-email-customer-confirmation-settings/u);
  assert.match(settingsSource, /draft\.confirmCustomerEmails/u);
  assert.match(settingsSource, /Prejemniki za administracijo/u);
  assert.match(settingsSource, /Preizkus pošiljanja/u);
  assert.match(settingsSource, /data-testid="order-email-test-delivery"/u);
  assert.doesNotMatch(settingsSource, /title="Dogodki naročila"/u);
  assert.match(settingsSource, /xl:grid-cols-4/u);

  const ordersSource = ui.slice(ordersPanel, quotesPanel);
  const orderEvents = ordersSource.indexOf('testId="order-email-event-matrix"');
  const orderTemplates = ordersSource.indexOf(
    'testId="order-email-message-templates"',
  );
  const orderQueue = ordersSource.indexOf('testId="order-email-queue"');
  assert.ok(
    orderEvents > 0 &&
      orderEvents < orderTemplates &&
      orderTemplates < orderQueue,
  );
  assert.match(ordersSource, /title="Dogodki naročila"/u);
  assert.match(ordersSource, /title="Predloge sporočil"/u);
  assert.match(ordersSource, /title="Čakalna vrsta naročil"/u);
  assert.doesNotMatch(ordersSource, /title="Preizkus pošiljanja"/u);
  assert.doesNotMatch(ordersSource, /title="Skupna (?:vsebina|raba)"/u);
  const orderTemplateSource = ordersSource.slice(orderTemplates, orderQueue);
  assert.doesNotMatch(
    orderTemplateSource,
    /order-email-(?:shared-content|subject-prefix|header|footer|image-attachment)/u,
  );

  const quotesSource = ui.slice(quotesPanel);
  assert.match(quotesSource, /AdminQuoteEmailSettingsSection/u);
  const quoteEvents = quoteUi.indexOf('id="quote-email-events-heading"');
  const quoteTemplates = quoteUi.indexOf(
    'data-testid="quote-email-message-templates"',
  );
  const quoteQueue = quoteUi.indexOf('data-testid="quote-email-queue-card"');
  assert.ok(
    quoteEvents > 0 &&
      quoteEvents < quoteTemplates &&
      quoteTemplates < quoteQueue,
  );
  assert.doesNotMatch(quoteUi, /Pošiljanje ponudb/u);
  const quoteTemplateSource = quoteUi.slice(quoteTemplates, quoteQueue);
  assert.match(
    quoteTemplateSource,
    /\(\['customer', 'admin'\] as const\)\.map\(\(audience\)/u,
  );
  assert.match(
    quoteTemplateSource,
    /audience=\{audience\}[\s\S]*?title=\{audience === 'customer' \? 'Stranka' : 'Administrator'\}/u,
  );
  assert.match(
    quoteTemplateSource,
    /updateTemplate\(audience, 'subject', value\)[\s\S]*?updateTemplate\(audience, 'body', value\)[\s\S]*?resetTemplate\(audience\)/u,
  );
  assert.doesNotMatch(
    quoteTemplateSource,
    /order-email-(?:shared-content|subject-prefix|header|footer|image-attachment)/u,
  );
  assert.match(ui, /hidden=\{activeTab !== "settings"\}/u);
  assert.match(ui, /hidden=\{activeTab !== "orders"\}/u);
  assert.match(ui, /hidden=\{activeTab !== "quotes"\}/u);
  assert.match(ui, /adminWindowCardClassName/u);
  assert.match(ui, /activeTab === "quotes" \? \(/u);
  assert.match(ui, /data-testid="quote-email-save-status"/u);
  assert.match(ui, /data-testid="quote-email-settings-save"/u);
  assert.match(ui, /quoteEmailSettingsRef\.current\?\.save\(\)/u);
  assert.match(
    quotesSource,
    /ref=\{quoteEmailSettingsRef\}[\s\S]*?onSaveStateChange=\{setQuoteEmailSaveState\}/u,
  );
});

test("settings toggles keep accessible names without redundant visible state labels", () => {
  const ui = source(
    "src/admin/features/email/components/AdminOrderEmailSettingsPageClient.tsx",
  );
  const settingsPanel = ui.indexOf('id="order-email-settings-panel"');
  const ordersPanel = ui.indexOf('id="order-email-orders-panel"');
  const settingsSource = ui.slice(settingsPanel, ordersPanel);

  assert.doesNotMatch(settingsSource, /"Vklopljeno"|"Izklopljeno"/u);
  assert.match(
    settingsSource,
    /draft\.enabled[\s\S]*?ariaLabel=\{\s*draft\.enabled\s*\?\s*"Izklopi samodejno pošiljanje"\s*:\s*"Vklopi samodejno pošiljanje"/u,
  );
  assert.match(
    settingsSource,
    /draft\.confirmCustomerEmails[\s\S]*?ariaLabel="Zahtevaj dodatno potrditev pred dejanji, ki pošljejo e-pošto stranki"/u,
  );
  assert.match(
    settingsSource,
    /quoteEmailSaveState\.enabled[\s\S]*?Izklopi poslovno e-pošto za ponudbe[\s\S]*?Vključi poslovno e-pošto za ponudbe/u,
  );
  assert.match(
    settingsSource,
    /setQuoteEmailSaveState\(\(current\) => \(\{[\s\S]*?enabled,[\s\S]*?quoteEmailSettingsRef\.current\?\.setEnabled\(enabled\)/u,
  );
  assert.match(
    settingsSource,
    /quoteEmailSaveState\.stockAcceptanceMode === "automatic"/u,
  );
  assert.match(
    settingsSource,
    /const stockAcceptanceMode = automatic[\s\S]*?\? "automatic"[\s\S]*?: "manual";[\s\S]*?setQuoteEmailSaveState\(\(current\) => \(\{[\s\S]*?stockAcceptanceMode,[\s\S]*?setStockAcceptanceMode\(\s*stockAcceptanceMode/u,
  );
  assert.match(
    settingsSource,
    /Preklopi blokado sprejema zaradi zaloge na ročni način[\s\S]*?Preklopi blokado sprejema zaradi zaloge na samodejni način/u,
  );
  assert.match(
    settingsSource,
    /disabled=\{[\s\S]*?quoteEmailSaveState\.saving \|\|[\s\S]*?quoteEmailSaveState\.mutationsDisabled[\s\S]*?\}/u,
  );
});

test("email workspace uses shared admin controls, typography, and save-state presentation", () => {
  const ui = source(
    "src/admin/features/email/components/AdminOrderEmailSettingsPageClient.tsx",
  );

  assert.ok(ui.includes("font-['Inter',system-ui,sans-serif]"));
  assert.match(ui, /AdminTablePrimaryActionButton/u);
  assert.match(ui, /data-testid="order-email-client-surface"/u);
  assert.match(ui, /data-client-ready=\{isClientReady \? "true" : "false"\}/u);
  assert.match(ui, /disabled=\{!isClientReady\}/u);
  assert.match(ui, /adminTableBulkHeaderButtonClassName/u);
  assert.match(ui, /adminTableSelectedDangerIconButtonClassName/u);
  assert.match(ui, /<Input/u);
  assert.match(ui, /<Button/u);
  assert.match(ui, /<IconButton/u);
  assert.match(ui, /<TrashCanIcon/u);
  assert.match(ui, /<CustomSelect<EventKey>/u);
  for (const primitive of ["Table", "THead", "TBody", "TR", "TH", "TD"]) {
    assert.ok(ui.includes(`<${primitive}`), `${primitive} must be used`);
  }
  assert.match(ui, /adminTableHeaderCellLeftClassName/u);
  assert.match(ui, /adminTableBodyCellLeftClassName/u);
  assert.match(ui, /adminTableRowHeightClassName/u);
  assert.match(ui, /table-fixed text-\[12px\]/u);
  assert.match(ui, /rounded-lg border border-slate-200 bg-slate-50\/60 p-4/u);
  assert.match(ui, /<EmailQueueMetricCard/u);
  assert.match(ui, /data-testid="order-email-save-status"/u);
  assert.match(ui, /data-testid="quote-email-save-status"/u);
  assert.match(ui, /data-testid="quote-email-settings-save"/u);
  assert.ok(ui.includes('nonQuoteHasChanges ? "Neshranjeno" : "Shranjeno"'));
  assert.match(
    ui,
    /activeTab === "settings"[\s\S]*?hasChanges \|\| quoteEmailSaveState\.hasChanges/u,
  );
  assert.match(
    ui,
    /activeTab === "settings"[\s\S]*?quoteEmailSettingsRef\.current\?\.save\(\)/u,
  );
  assert.ok(ui.includes("className={`min-w-0 px-5 py-4 ${className}`}"));
  assert.match(
    ui,
    /flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between/u,
  );
  assert.match(ui, /mt-1 max-w-3xl text-sm leading-5/u);
  assert.doesNotMatch(ui, /primaryButtonClassName|secondaryButtonClassName/u);
  assert.equal(ui.includes("<input"), false);
  assert.equal(ui.includes("<button"), false);
  assert.doesNotMatch(
    ui,
    /<table\b|<thead\b|<tbody\b|<tr\b|<th\b|<td\b|<select\b/u,
  );
});

test("template event CustomSelect keeps the visible label target and stable test hook", () => {
  const ui = source(
    "src/admin/features/email/components/AdminOrderEmailSettingsPageClient.tsx",
  );
  const customSelect = source("src/shared/ui/select/custom-select.tsx");

  assert.match(ui, /htmlFor="order-email-template-event"/u);
  assert.match(ui, /id="order-email-template-event"/u);
  assert.match(ui, /testId="order-email-template-event"/u);
  assert.match(ui, /ariaLabel="Dogodek naročila"/u);
  assert.match(
    ui,
    /onChange=\{\(value\) => \{[\s\S]*?setSelectedTemplateEvent\(value\)/u,
  );
  assert.match(customSelect, /id\?: string;/u);
  assert.match(customSelect, /testId\?: string;/u);
  assert.match(customSelect, /id=\{id\}/u);
  assert.match(customSelect, /data-testid=\{testId\}/u);
});

test("order email events and selected template section use shared lifecycle tones", () => {
  const ui = source(
    "src/admin/features/email/components/AdminOrderEmailSettingsPageClient.tsx",
  );

  assert.match(ui, /data-testid="order-email-event-table"/u);
  assert.match(ui, /getOrderEmailEventStatusPresentation\(eventKey\)/u);
  assert.match(ui, /order-email-event-row-/u);
  assert.match(ui, /data-status-tone=\{statusPresentation\.tone\}/u);
  assert.match(
    ui,
    /className=\{selectedTemplateStatusPresentation\.sectionClassName\}/u,
  );
  assert.match(ui, /statusTone=\{selectedTemplateStatusPresentation\.tone\}/u);
});

test("converted order email Inputs keep accessible names aligned with their visible labels", () => {
  const ui = source(
    "src/admin/features/email/components/AdminOrderEmailSettingsPageClient.tsx",
  );

  for (const [id, label] of [
    ["order-email-sender-name", "Ime pošiljatelja"],
    ["order-email-from-address", "E-poštni naslov pošiljatelja"],
    ["order-email-reply-to", "Naslov za odgovore"],
    ["order-email-site-url", "Naslov spletnega mesta"],
    ["order-email-test-recipient", "Prejemnik testa"],
    ["order-email-subject-prefix", "Predpona zadeve"],
  ] as const) {
    assert.match(ui, new RegExp(`id="${id}"\\s+aria-label="${label}"`, "u"));
  }

  assert.match(
    ui,
    /id=\{subjectId\}\s+aria-label=\{`Zadeva za \$\{audienceLabel\}`\}/u,
  );
  assert.match(
    ui,
    /id=\{`order-email-admin-\$\{index\}`\}\s+aria-label=\{`E-poštni naslov administratorja \$\{index \+ 1\}`\}/u,
  );
  assert.match(ui, /id="order-email-header"\s+aria-label="Besedilo glave"/u);
  assert.match(
    ui,
    /id="order-email-footer"\s+aria-label="Dodatno besedilo v nogi"/u,
  );
});

test("shared email image attachment stages locally, uploads on save, and blocks test send until persisted", () => {
  const ui = source(
    "src/admin/features/email/components/AdminOrderEmailSettingsPageClient.tsx",
  );

  assert.match(ui, /uploadAdminPublicMedia/u);
  assert.match(ui, /\{ scope: "email-shared-image" \}/u);
  assert.match(ui, /ORDER_EMAIL_IMAGE_ATTACHMENT_MAX_BYTES/u);
  assert.match(ui, /URL\.createObjectURL\(file\)/u);
  assert.match(ui, /URL\.revokeObjectURL\(previewUrl\)/u);
  assert.match(ui, /stagedImageAttachment !== null \|\|/u);
  assert.match(
    ui,
    /submittedConfig = \{\s+\.\.\.submittedDraft,\s+imageAttachment,/u,
  );
  assert.match(ui, /JSON\.stringify\(\{ config: submittedConfig \}\)/u);
  assert.match(ui, /data-testid="order-email-image-upload"/u);
  assert.match(ui, /data-testid="order-email-image-replace"/u);
  assert.match(ui, /data-testid="order-email-image-remove"/u);
  assert.match(ui, /data-testid="order-email-image-preview"/u);
  assert.match(
    ui,
    /testing \|\|\s+saving \|\|\s+uploadingImageAttachment \|\|\s+stagedImageAttachment !== null/u,
  );
});

test("email message previews isolate rendered HTML without script, network, navigation, or same-origin privileges", () => {
  const preview = source(
    "src/admin/features/email/components/EmailMessagePreview.tsx",
  );

  assert.match(preview, /<iframe/u);
  assert.match(preview, /sandbox=""/u);
  assert.match(preview, /referrerPolicy="no-referrer"/u);
  assert.match(preview, /srcDoc=\{isolatedHtml\}/u);
  assert.match(preview, /Content-Security-Policy/u);
  assert.match(preview, /default-src 'none'/u);
  assert.match(preview, /connect-src 'none'/u);
  assert.match(preview, /form-action 'none'/u);
  assert.match(preview, /base-uri 'none'/u);
  assert.match(preview, /aria-disabled="true"/u);
  assert.match(preview, /data-testid=\{`\$\{testId\}-subject`\}/u);
  assert.match(preview, /data-testid=\{`\$\{testId\}-variables`\}/u);
  assert.doesNotMatch(preview, /allow-scripts|allow-same-origin/u);
  assert.doesNotMatch(preview, /dangerouslySetInnerHTML/u);
});

test("email preview isolation removes navigation and installs its CSP at runtime", () => {
  const isolated = isolateEmailPreviewHtml(
    '<!doctype html><html lang="sl"><body><a href="https://example.invalid/private">Odpri</a></body></html>',
  );

  assert.match(isolated, /<head><meta http-equiv="Content-Security-Policy"/u);
  assert.match(isolated, /default-src 'none'/u);
  assert.match(isolated, /connect-src 'none'/u);
  assert.match(isolated, /<a aria-disabled="true">Odpri<\/a>/u);
  assert.doesNotMatch(isolated, /\shref\s*=/iu);
  assert.doesNotMatch(isolated, /example\.invalid\/private/u);
});

test("order and quote templates expose live audience previews from their unsaved drafts", () => {
  const orderUi = source(
    "src/admin/features/email/components/AdminOrderEmailSettingsPageClient.tsx",
  );
  const quoteUi = source(
    "src/admin/features/email/components/AdminQuoteEmailSettingsSection.tsx",
  );

  assert.match(orderUi, /buildOrderEmailMessage/u);
  assert.match(orderUi, /toStoredOrderEmailSettings/u);
  assert.match(orderUi, /buildOrderEmailPreviewMessage\(\s*draft,/u);
  assert.match(orderUi, /imageUrl: null/u);
  assert.match(orderUi, /testId="order-email-preview"/u);
  assert.match(orderUi, /testId="order-email-preview-audience"/u);
  assert.match(orderUi, /Šola \/ javni zavod/u);
  assert.match(orderUi, /sharedSettings=\{draft\}/u);

  assert.match(quoteUi, /buildQuoteEmailMessage/u);
  assert.match(quoteUi, /quoteSettings: draft/u);
  assert.match(quoteUi, /\.\.\.sharedSettings/u);
  assert.match(quoteUi, /testId="quote-email-preview"/u);
  assert.match(quoteUi, /testId="quote-email-preview-audience"/u);
  assert.doesNotMatch(
    orderUi,
    /fetch\(["']\/api\/admin\/order-email-settings\/preview/u,
  );
  assert.doesNotMatch(
    quoteUi,
    /fetch\(["']\/api\/admin\/quote-email-settings\/preview/u,
  );
});
