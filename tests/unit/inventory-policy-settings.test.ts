import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, test } from 'node:test';
import {
  ADMIN_SESSION_COOKIE,
  createAdminSessionToken,
  getAdminAuthConfig,
  hasValidAdminSession
} from '@/shared/auth/adminSession';
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

  test('validates the signed admin cookie used by the policy API', () => {
    const config = getAdminAuthConfig();
    assert.ok(config);
    const session = createAdminSessionToken(config);
    const authenticated = new Request('http://localhost/api/admin/inventory-policy', {
      headers: {
        cookie: `${ADMIN_SESSION_COOKIE}=${encodeURIComponent(session.token)}`
      }
    });
    const anonymous = new Request('http://localhost/api/admin/inventory-policy');
    assert.equal(hasValidAdminSession(authenticated), true);
    assert.equal(hasValidAdminSession(anonymous), false);
  });

  test('persists one authoritative row and exposes an authenticated GET/PUT API', () => {
    const schema = readFileSync('database/schema.sql', 'utf8');
    const migration = readFileSync(
      'database/migrations/20260901_inventory_policy_settings.sql',
      'utf8'
    );
    const server = readFileSync('src/shared/server/inventoryPolicy.ts', 'utf8');
    const route = readFileSync('src/admin/api/inventory-policy/route.ts', 'utf8');

    assert.match(schema, /create table inventory_policy_settings/u);
    assert.match(
      schema,
      /"stockEnforcementEnabled": true[\s\S]*?jsonb_typeof\(config_json -> 'stockEnforcementEnabled'\) = 'boolean'/u
    );
    assert.match(migration, /insert into inventory_policy_settings[\s\S]*?'default'/u);
    assert.match(server, /getInventoryPolicySettings/u);
    assert.match(server, /isStockEnforcementEnabled/u);
    assert.match(server, /to_regclass\('public\.inventory_policy_settings'\)/u);
    assert.match(route, /hasValidAdminSession\(request\)/u);
    assert.match(route, /export async function GET\(request: Request\)/u);
    assert.match(route, /export async function PUT\(request: Request\)/u);
  });
});
