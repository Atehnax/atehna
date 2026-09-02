export const INVENTORY_POLICY_SETTINGS_KEY = 'default';

export type InventoryPolicySettings = {
  stockEnforcementEnabled: boolean;
  updatedAt: string;
};

export const DEFAULT_INVENTORY_POLICY_SETTINGS = Object.freeze({
  stockEnforcementEnabled: true,
  updatedAt: ''
}) satisfies Readonly<InventoryPolicySettings>;

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

export function cloneDefaultInventoryPolicySettings(): InventoryPolicySettings {
  return { ...DEFAULT_INVENTORY_POLICY_SETTINGS };
}

/**
 * Missing and legacy settings fail closed: stock enforcement stays enabled
 * unless an administrator explicitly persisted `false`.
 */
export function normalizeInventoryPolicySettings(
  value: unknown
): InventoryPolicySettings {
  const source = asRecord(value);
  return {
    stockEnforcementEnabled: source?.stockEnforcementEnabled !== false,
    updatedAt: typeof source?.updatedAt === 'string' ? source.updatedAt : ''
  };
}

export function toStoredInventoryPolicySettings(value: unknown): {
  stockEnforcementEnabled: boolean;
} {
  const normalized = normalizeInventoryPolicySettings(value);
  return {
    stockEnforcementEnabled: normalized.stockEnforcementEnabled
  };
}

export function validateInventoryPolicySettingsInput(value: unknown): string[] {
  const source = asRecord(value);
  if (!source || typeof source.stockEnforcementEnabled !== 'boolean') {
    return ['Nastavitev omejevanja naročanja glede na zalogo ni veljavna.'];
  }
  return [];
}

export function stockEnforcementAppliedAfterDraftFinalization(input: {
  stockEnforcementEnabled: boolean;
  hasActiveStockHolds: boolean;
}): boolean {
  return input.stockEnforcementEnabled || input.hasActiveStockHolds;
}
