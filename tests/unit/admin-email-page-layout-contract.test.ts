import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import { isolateEmailPreviewHtml } from "../../src/admin/features/email/components/EmailMessagePreview";
import { getEmailTemplateActivity } from "../../src/admin/features/email/components/EmailTemplateWorkspace";

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
  assert.match(ui, /value: "settings",\s+label: "Osnovne nastavitve"/u);
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
  assert.equal(settingsSource.match(/<SettingsCard>/gu)?.length, 4);
  assert.match(settingsSource, /className="space-y-3 outline-none"/u);
  assert.match(settingsSource, /title="Pošiljatelj in povezave"/u);
  const senderSettings = settingsSource.indexOf(
    'testId="order-email-sender-settings"',
  );
  const customerConfirmation = settingsSource.indexOf(
    'data-testid="order-email-customer-confirmation-settings"',
  );
  assert.ok(
    senderSettings > 0 &&
      senderSettings < customerConfirmation,
  );
  assert.doesNotMatch(settingsSource, /title="Skupna vsebina"/u);
  assert.doesNotMatch(
    settingsSource,
    /order-email-(?:shared-content|subject-prefix|header|footer|image-attachment)/u,
  );
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
  assert.match(orderTemplateSource, /sharedContent=\{sharedContent\}/u);
  assert.match(orderTemplateSource, /presentation: selectedTemplate\.presentation/u);
  assert.match(orderTemplateSource, /systemLines: \{/u);
  assert.match(orderTemplateSource, /lines: selectedTemplateSystemLines/u);
  assert.match(orderTemplateSource, /available: selectedTemplateSystemFields/u);

  const quotesSource = ui.slice(quotesPanel);
  assert.match(quotesSource, /AdminQuoteEmailSettingsSection/u);
  const quoteEvents = quoteUi.indexOf('id="quote-email-events-heading"');
  const quoteTemplates = quoteUi.indexOf(
    'testId="quote-email-message-templates"',
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
    quoteUi,
    /<EmailTemplateWorkspace<QuoteEmailTemplateAudience>/u,
  );
  assert.match(quoteTemplateSource, /audiences=\{quoteEmailPreviewAudienceOptions\}/u);
  assert.match(quoteTemplateSource, /activeAudience=\{quotePreviewAudience\}/u);
  assert.match(quoteTemplateSource, /onAudienceChange=\{setQuotePreviewAudience\}/u);
  assert.match(
    quoteTemplateSource,
    /updateTemplate\(quotePreviewAudience, 'subject', value\)[\s\S]*?updateTemplate\(quotePreviewAudience, 'contentHtml', value\)[\s\S]*?resetTemplate\(quotePreviewAudience\)/u,
  );
  assert.match(quoteTemplateSource, /presentation: selectedAudienceTemplate\.presentation/u);
  assert.match(quoteTemplateSource, /updateTemplatePresentation\(quotePreviewAudience, presentation\)/u);
  assert.match(quoteTemplateSource, /sharedContent=\{sharedContent\}/u);
  assert.match(quotesSource, /sharedContent=\{sharedContent\}/u);
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
    /quoteEmailSaveState\.enabled[\s\S]*?Izklopi e-pošto za ponudbe[\s\S]*?Vključi e-pošto za ponudbe/u,
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
  const templateWorkspace = source(
    "src/admin/features/email/components/EmailTemplateWorkspace.tsx",
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
  assert.match(ui, /<EmailTemplateWorkspace<TemplateAudience>/u);
  assert.match(templateWorkspace, /<EuiTabs/u);
  assert.match(templateWorkspace, /surface="panel"/u);
  assert.match(templateWorkspace, /variant="secondary"/u);
  assert.match(
    templateWorkspace,
    /className="!h-9 !min-w-0 shrink-0 self-end rounded-md px-3"/u,
  );
  assert.match(templateWorkspace, /contentHtml: EmailTemplateWorkspaceField;/u);
  assert.doesNotMatch(
    templateWorkspace,
    /greeting: EmailTemplateWorkspaceField|heading: EmailTemplateWorkspaceField|body: EmailTemplateWorkspaceField/u,
  );
  assert.match(
    templateWorkspace,
    /import EmailTemplateContextToolbar/u,
  );
  assert.match(templateWorkspace, /const \[selectedBlockId, setSelectedBlockId\] = useState/u);
  assert.match(
    templateWorkspace,
    /className="min-w-0 flex-1 overflow-x-auto overflow-y-hidden"/u,
  );
  assert.match(
    templateWorkspace,
    /previewVariableValues = useMemo\([\s\S]*?preview\.variables\.map/u,
  );
  assert.match(templateWorkspace, /<EmailMessagePreview[\s\S]*?variant="workspace"[\s\S]*?editor=\{\{/u);
  assert.match(templateWorkspace, /<EmailTemplateContextToolbar/u);
  assert.match(templateWorkspace, /presentation=\{editor\.presentation\}/u);
  assert.match(templateWorkspace, /onPresentationChange=\{editor\.onPresentationChange\}/u);
  assert.match(templateWorkspace, /sharedContent=\{sharedContent\}/u);
  assert.match(templateWorkspace, /systemLines=\{editor\.systemLines\}/u);
  assert.doesNotMatch(templateWorkspace, /data-testid=[^\n]*-editor-panel/u);
  assert.doesNotMatch(templateWorkspace, /<Input|<AdminRichTextEditor/u);
  assert.match(templateWorkspace, /export function EmailTemplateRecipientToggle/u);
  assert.match(templateWorkspace, /role="switch"/u);
  assert.match(templateWorkspace, /aria-checked=\{checked\}/u);
  assert.doesNotMatch(templateWorkspace, /Namizje|Mobilno/u);
  assert.match(templateWorkspace, /headingLevel\?: 2 \| 3/u);
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

test("template activity reflects both the master switch and selected recipients", () => {
  assert.equal(getEmailTemplateActivity(true, true, true).label, "Aktivno");
  assert.equal(
    getEmailTemplateActivity(true, true, false).label,
    "Delno aktivno",
  );
  assert.equal(getEmailTemplateActivity(true, false, false).label, "Neaktivno");
  assert.equal(
    getEmailTemplateActivity(false, true, true).label,
    "Začasno izklopljeno",
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

test("order events keep lifecycle tones while templates expose delivery activity", () => {
  const ui = source(
    "src/admin/features/email/components/AdminOrderEmailSettingsPageClient.tsx",
  );

  assert.match(ui, /data-testid="order-email-event-table"/u);
  assert.match(ui, /getOrderEmailEventStatusPresentation\(eventKey\)/u);
  assert.match(ui, /order-email-event-row-/u);
  assert.match(ui, /data-status-tone=\{statusPresentation\.tone\}/u);
  assert.match(ui, /getEmailTemplateActivity\(/u);
  assert.match(ui, /activity=\{selectedTemplateActivity\}/u);
  assert.match(ui, /<EmailTemplateRecipientToggle/u);
  assert.doesNotMatch(ui, /selectedTemplateStatusPresentation/u);
});

test("order email settings keep permanent fields accessible while template fields move into the contextual editor", () => {
  const ui = source(
    "src/admin/features/email/components/AdminOrderEmailSettingsPageClient.tsx",
  );
  const contextToolbar = source(
    "src/admin/features/email/components/EmailTemplateContextToolbar.tsx",
  );

  for (const [id, label] of [
    ["order-email-sender-name", "Ime pošiljatelja"],
    ["order-email-from-address", "E-poštni naslov pošiljatelja"],
    ["order-email-reply-to", "Naslov za odgovore"],
    ["order-email-site-url", "Naslov spletnega mesta"],
    ["order-email-test-recipient", "Prejemnik testa"],
  ] as const) {
    assert.match(ui, new RegExp(`id="${id}"\\s+aria-label="${label}"`, "u"));
  }

  assert.match(ui, /subject: \{[\s\S]*?label: "Zadeva"/u);
  assert.match(
    ui,
    /contentHtml: \{[\s\S]*?label: "Vsebina sporočila"/u,
  );
  assert.match(contextToolbar, /id=\{`\$\{idPrefix\}-subject`\}/u);
  assert.match(contextToolbar, /ariaLabel="Vsebina sporočila"/u);
  assert.match(contextToolbar, /toolbarVariant="compact"/u);
  assert.doesNotMatch(ui, /greeting: \{|heading: \{|body: \{/u);
  assert.doesNotMatch(ui, /Predpona zadeve se doda samodejno\./u);
  assert.doesNotMatch(
    ui,
    /Oblikujte celotno uvodno vsebino sporočila\./u,
  );
  assert.match(
    ui,
    /id=\{`order-email-admin-\$\{index\}`\}\s+aria-label=\{`E-poštni naslov administratorja \$\{index \+ 1\}`\}/u,
  );
  assert.doesNotMatch(ui, /id="order-email-(?:subject-prefix|header|footer)"/u);
  assert.match(contextToolbar, /aria-label=[\s\S]*?'Besedilo glave'/u);
  assert.match(contextToolbar, /'Dodatno besedilo v nogi'/u);
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
  assert.match(ui, /onImageSelected: handleImageAttachmentSelected/u);
  assert.match(ui, /onImageRemove: removeImageAttachment/u);
  assert.match(ui, /imageAttachment: displayedImageAttachment/u);
  assert.match(
    ui,
    /testing \|\|\s+saving \|\|\s+uploadingImageAttachment \|\|\s+stagedImageAttachment !== null/u,
  );
});

test("email message previews isolate rendered HTML while providing a bounded, zoomable workspace", () => {
  const preview = source(
    "src/admin/features/email/components/EmailMessagePreview.tsx",
  );

  assert.match(preview, /<iframe/u);
  assert.match(preview, /sandbox="allow-same-origin"/u);
  assert.equal(preview.match(/allow-same-origin/gu)?.length, 2);
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
  assert.doesNotMatch(preview, /allow-scripts/u);
  assert.match(preview, /frameRef\.current\?\.contentDocument/u);
  assert.match(preview, /frameDocument\.documentElement\.style\.overflow = "hidden"/u);
  assert.match(preview, /frameBody\.style\.overflow = "hidden"/u);
  assert.match(
    preview,
    /setWorkspaceFrameHeight\(Math\.max\(320, Math\.ceil\(frameBody\.scrollHeight\) \+ 2\)\)/u,
  );
  assert.match(preview, /const observer = new ResizeObserver\(updateHeight\)/u);
  assert.match(preview, /observer\.observe\(frameBody\)/u);
  assert.match(preview, /const WORKSPACE_PREVIEW_DEFAULT_SCALE = 0\.9/u);
  assert.match(preview, /const WORKSPACE_PREVIEW_MIN_SCALE = 0\.5/u);
  assert.match(preview, /const WORKSPACE_PREVIEW_MAX_SCALE = 1\.5/u);
  assert.match(preview, /const WORKSPACE_PREVIEW_SCALE_STEP = 0\.1/u);
  assert.doesNotMatch(preview, /Predogled uporablja spodnje testne podatke/u);
  assert.match(preview, /const WORKSPACE_PREVIEW_DESKTOP_QUERY = "\(min-width: 1024px\)"/u);
  assert.match(preview, /useSyncExternalStore\(/u);
  assert.match(preview, /workspaceUsesDesktopDefault[\s\S]*?WORKSPACE_PREVIEW_DEFAULT_SCALE[\s\S]*?: 1/u);
  assert.match(
    preview,
    /role="group"\s+aria-label="Povečava predogleda"/u,
  );
  assert.match(preview, /aria-label="Pomanjšaj predogled"/u);
  assert.match(preview, /aria-label="Povečaj predogled"/u);
  assert.match(preview, /aria-label=\{`\$\{workspacePreviewPercent\} %; ponastavi povečavo na \$\{workspaceDefaultPercent\} %`\}/u);
  assert.match(preview, /workspacePreviewScaleOverride[\s\S]*?\?\? workspaceDefaultScale/u);
  assert.match(
    preview,
    /<output aria-live="polite">\{workspacePreviewPercent\} %<\/output>/u,
  );
  assert.match(
    preview,
    /role="region"[\s\S]*?tabIndex=\{0\}[\s\S]*?aria-label="Območje predogleda sporočila"/u,
  );
  assert.match(preview, /h-\[37rem\]/u);
  assert.match(preview, /workspace && !error/u);
  assert.match(preview, /workspacePreviewPercent/u);
  assert.match(preview, /height: workspaceRenderedFrameHeight/u);
  assert.match(preview, /transformOrigin: "top left"/u);
  assert.match(preview, /scrolling="no"/u);
  assert.match(preview, /scrolling="auto"/u);
  assert.match(preview, /onLoad=\{sizeWorkspaceFrame\}/u);
  assert.match(
    preview,
    /\{!workspace \? <aside[\s\S]*?data-testid=\{`\$\{testId\}-variables`\}[\s\S]*?<\/aside> : null\}/u,
  );
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
  assert.match(orderUi, /imageUrl: ORDER_EMAIL_PREVIEW_IMAGE_URL/u);
  assert.match(orderUi, /buildOrderEmailMessage\(payload, \{ editorPreview: true \}\)/u);
  assert.match(
    orderUi,
    /message\.html\.replaceAll\([\s\S]*?ORDER_EMAIL_PREVIEW_IMAGE_URL,[\s\S]*?ORDER_EMAIL_PREVIEW_IMAGE_DATA_URL/u,
  );
  assert.match(orderUi, /"data:image\/svg\+xml/u);
  assert.match(orderUi, /testId: "order-email-preview"/u);
  assert.match(orderUi, /activeAudience=\{orderPreviewAudience\}/u);
  assert.match(orderUi, /onAudienceChange=\{\(audience\) => \{/u);
  assert.match(orderUi, /Šola \/ javni zavod/u);
  for (const label of ["Fiz. oseba", "Podjetje", "Šola / javni zavod", "Admin"]) {
    assert.match(orderUi, new RegExp(`label: "${label.replace('/', '\\/')}"`, "u"));
    assert.match(quoteUi, new RegExp(`label: '${label.replace('/', '\\/')}'`, "u"));
  }
  assert.match(orderUi, /sharedSettings=\{draft\}/u);
  assert.match(orderUi, /sharedContent=\{sharedContent\}/u);
  assert.match(orderUi, /resolveOrderEmailSystemLines/u);

  assert.match(quoteUi, /buildQuoteEmailMessage/u);
  assert.match(quoteUi, /\{ editorPreview: true \}/u);
  assert.match(quoteUi, /quoteSettings: draft/u);
  assert.match(quoteUi, /\.\.\.sharedSettings/u);
  assert.match(quoteUi, /testId: 'quote-email-preview'/u);
  assert.match(quoteUi, /activeAudience=\{quotePreviewAudience\}/u);
  assert.match(quoteUi, /onAudienceChange=\{setQuotePreviewAudience\}/u);
  assert.match(quoteUi, /presentation: selectedAudienceTemplate\.presentation/u);
  assert.match(quoteUi, /sharedContent=\{sharedContent\}/u);
  assert.doesNotMatch(orderUi, /order-email-preview-audience/u);
  assert.doesNotMatch(quoteUi, /quote-email-preview-audience/u);
  assert.doesNotMatch(
    orderUi,
    /fetch\(["']\/api\/admin\/order-email-settings\/preview/u,
  );
  assert.doesNotMatch(
    quoteUi,
    /fetch\(["']\/api\/admin\/quote-email-settings\/preview/u,
  );
});
