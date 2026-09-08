import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, test } from 'node:test';
import { loadBoundServerModule } from './support/loadBoundServerModule';
import {
  DEFAULT_INVENTORY_POLICY_SETTINGS,
  cloneDefaultInventoryPolicySettings,
  normalizeInventoryPolicySettings,
  stockEnforcementAppliedAfterDraftFinalization,
  toStoredInventoryPolicySettings,
  validateInventoryPolicySettingsInput
} from '@/shared/domain/inventory/inventoryPolicy';

describe('global inventory policy settings', () => {
  test('keeps current stock enforcement enabled for missing and legacy values', () => {
    assert.equal(DEFAULT_INVENTORY_POLICY_SETTINGS.stockEnforcementEnabled, true);
    assert.equal(
      normalizeInventoryPolicySettings(undefined).stockEnforcementEnabled,
      true
    );
    assert.equal(
      normalizeInventoryPolicySettings({}).stockEnforcementEnabled,
      true
    );
    assert.equal(
      normalizeInventoryPolicySettings({ stockEnforcementEnabled: 'false' })
        .stockEnforcementEnabled,
      true
    );
  });

  test('only an explicit false disables stock enforcement', () => {
    assert.equal(
      normalizeInventoryPolicySettings({ stockEnforcementEnabled: false })
        .stockEnforcementEnabled,
      false
    );
    assert.deepEqual(
      toStoredInventoryPolicySettings({
        stockEnforcementEnabled: false,
        updatedAt: '2026-09-01T00:00:00.000Z'
      }),
      { stockEnforcementEnabled: false }
    );
    const clone = cloneDefaultInventoryPolicySettings();
    clone.stockEnforcementEnabled = false;
    assert.equal(DEFAULT_INVENTORY_POLICY_SETTINGS.stockEnforcementEnabled, true);
  });

  test('requires an explicit boolean on writes', () => {
    assert.deepEqual(
      validateInventoryPolicySettingsInput({ stockEnforcementEnabled: true }),
      []
    );
    assert.deepEqual(
      validateInventoryPolicySettingsInput({ stockEnforcementEnabled: false }),
      []
    );
    for (const invalid of [undefined, {}, { stockEnforcementEnabled: 'false' }]) {
      assert.equal(validateInventoryPolicySettingsInput(invalid).length, 1);
    }
  });

  test('draft finalization derives its durable marker from policy or active holds', () => {
    const schoolAcceptedDraftAfterPolicyDisable =
      stockEnforcementAppliedAfterDraftFinalization({
        stockEnforcementEnabled: false,
        hasActiveStockHolds: false
      });
    assert.equal(schoolAcceptedDraftAfterPolicyDisable, false);

    const directAcceptedDraftWithCommittedHold =
      stockEnforcementAppliedAfterDraftFinalization({
        stockEnforcementEnabled: false,
        hasActiveStockHolds: true
      });
    assert.equal(directAcceptedDraftWithCommittedHold, true);

    const draftWithStockPolicyDisabledThroughout =
      stockEnforcementAppliedAfterDraftFinalization({
        stockEnforcementEnabled: false,
        hasActiveStockHolds: false
      });
    assert.equal(draftWithStockPolicyDisabledThroughout, false);
  });

  test('policy API awaits an active server session before reading settings', async () => {
    let reads = 0;
    const api = loadBoundServerModule<{ GET: (request: Request) => Promise<Response> }>(
      'src/admin/api/inventory-policy/route.ts',
      {
        NextResponse: Response,
        hasValidAdminSession: async (request: Request) => request.headers.get('x-test-session') === 'active',
        getInventoryPolicySettings: async () => { reads++; return { stockEnforcementEnabled: true }; },
        isDatabaseUnavailableError: () => false
      }
    );
    const url = 'https://atehna.test/api/admin/inventory-policy';
    const denied = await api.GET(new Request(url));
    assert.equal(denied.status, 401);
    assert.equal(reads, 0);
    const allowed = await api.GET(new Request(url, { headers: { 'x-test-session': 'active' } }));
    assert.equal(allowed.status, 200);
    assert.equal(reads, 1);
  });

  test('persists one authoritative row and exposes an authenticated GET/PUT API', () => {
    const schema = readFileSync('database/schema.sql', 'utf8');
    const server = readFileSync('src/shared/server/inventoryPolicy.ts', 'utf8');
    const route = readFileSync('src/admin/api/inventory-policy/route.ts', 'utf8');

    assert.match(schema, /create table inventory_policy_settings/u);
    assert.match(
      schema,
      /"stockEnforcementEnabled": true[\s\S]*?jsonb_typeof\(config_json -> 'stockEnforcementEnabled'\) = 'boolean'/u
    );
    assert.match(server, /getInventoryPolicySettings/u);
    assert.match(server, /isStockEnforcementEnabled/u);
    assert.match(server, /to_regclass\('public\.inventory_policy_settings'\)/u);
    assert.match(route, /hasValidAdminSession\(request\)/u);
    assert.match(route, /export async function GET\(request: Request\)/u);
    assert.match(route, /export async function PUT\(request: Request\)/u);
  });
});
