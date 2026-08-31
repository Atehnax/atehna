import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

const source = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');

test('admin email page exposes the standardized settings, orders, and quotes tabs', () => {
  const ui = source(
    'src/admin/features/email/components/AdminOrderEmailSettingsPageClient.tsx'
  );

  const settingsTab = ui.indexOf('value: "settings"');
  const ordersTab = ui.indexOf('value: "orders"');
  const quotesTab = ui.indexOf('value: "quotes"');
  assert.ok(settingsTab > 0 && settingsTab < ordersTab && ordersTab < quotesTab);
  assert.match(ui, /value: "settings",\s+label: "Nastavitve"/u);
  assert.match(ui, /value: "orders",\s+label: "Naročila"/u);
  assert.match(ui, /value: "quotes",\s+label: "Ponudbe"/u);
  assert.doesNotMatch(ui, /label: "Predloge"/u);
  assert.doesNotMatch(ui, /Ta razdelek vsebuje/u);
  assert.match(ui, /tabClassName="!min-w-0 flex-1 !px-2/u);
});

test('email sections are assigned to compact persistent tab panels without losing drafts', () => {
  const ui = source(
    'src/admin/features/email/components/AdminOrderEmailSettingsPageClient.tsx'
  );
  const settingsPanel = ui.indexOf('id="order-email-settings-panel"');
  const ordersPanel = ui.indexOf('id="order-email-orders-panel"');
  const quotesPanel = ui.indexOf('id="order-email-quotes-panel"');
  assert.ok(settingsPanel > 0 && settingsPanel < ordersPanel && ordersPanel < quotesPanel);

  const settingsSource = ui.slice(settingsPanel, ordersPanel);
  assert.match(settingsSource, /title="Pošiljanje"/u);
  assert.match(settingsSource, /title="Pošiljatelj in povezave"/u);
  assert.match(settingsSource, /title="Prejemniki za administracijo"/u);
  assert.doesNotMatch(settingsSource, /title="Dogodki naročila"/u);
  assert.match(settingsSource, /xl:grid-cols-4/u);

  const ordersSource = ui.slice(ordersPanel, quotesPanel);
  for (const title of [
    'Dogodki naročila',
    'Preizkus pošiljanja',
    'Čakalna vrsta pošiljanja',
    'Skupna vsebina',
    'Predloge sporočil'
  ]) {
    assert.match(ordersSource, new RegExp(`title="${title}"`, 'u'));
  }

  const quotesSource = ui.slice(quotesPanel);
  assert.match(quotesSource, /AdminQuoteEmailSettingsSection/u);
  assert.match(ui, /hidden=\{activeTab !== "settings"\}/u);
  assert.match(ui, /hidden=\{activeTab !== "orders"\}/u);
  assert.match(ui, /hidden=\{activeTab !== "quotes"\}/u);
  assert.match(ui, /adminWindowCardClassName/u);
  assert.match(ui, /activeTab === "quotes" \? undefined/u);
  assert.doesNotMatch(
    ui,
    /activeTab === "quotes" \? \(\s*<div[\s\S]*?AdminQuoteEmailSettingsSection/u
  );
});
