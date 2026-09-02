import type { Pool } from 'pg';

import {
  buildAuthoritativeOrderEstimate,
  OrderCommerceError
} from '@/shared/server/orderCommerce';

type CatalogOverrides = Partial<{
  product_status: string;
  variant_status: string;
  category_id: string | null;
  category_is_active: boolean | null;
}>;

type ScenarioResult = {
  outcome: 'accepted' | 'rejected';
  errorCode?: string;
  issueCodes?: string[];
  availableStock?: number;
  shippingStatus?: string;
};

function catalogRow(overrides: CatalogOverrides = {}) {
  return {
    variant_id: 101,
    product_id: 10,
    product_slug: 'inventory-policy-probe',
    product_name: 'Inventory policy probe',
    product_type: 'simple',
    editor_product_type: 'simple',
    product_status: 'active',
    product_sku: 'POLICY-PROBE',
    product_unit: 'kos',
    brand: null,
    material: null,
    colour: null,
    shape: null,
    catalog_tax_rate: '0.22',
    category_id: 'probe-category',
    category_path: 'Probe',
    category_is_active: true,
    variant_name: 'Standard',
    variant_status: 'active',
    variant_sku: 'POLICY-PROBE-STD',
    variant_unit: 'kos',
    item_shipping_weight_grams: 100,
    item_shipping_length_mm: 100,
    item_shipping_width_mm: 100,
    item_shipping_height_mm: 100,
    variant_shipping_weight_grams: null,
    variant_shipping_length_mm: null,
    variant_shipping_width_mm: null,
    variant_shipping_height_mm: null,
    length: null,
    width: null,
    thickness: null,
    weight: null,
    error_tolerance: null,
    price: '10.00',
    discount_pct: '0',
    inventory: 0,
    min_order: 1,
    badge: null,
    image_url: null,
    option_assignments: [],
    quantity_discounts: [],
    ...overrides
  };
}

function fakeDatabase(
  stockEnforcementEnabled: boolean,
  overrides: CatalogOverrides = {}
): Pick<Pool, 'query'> {
  return {
    async query(queryText: unknown) {
      const sql = String(queryText).replace(/\s+/gu, ' ').trim().toLowerCase();

      if (sql.includes("to_regclass('public.inventory_policy_settings')")) {
        return { rows: [{ ready: true }], rowCount: 1 };
      }

      if (sql.includes('from inventory_policy_settings')) {
        return {
          rows: [{
            config_json: { stockEnforcementEnabled },
            updated_at: new Date('2026-09-02T00:00:00.000Z')
          }],
          rowCount: 1
        };
      }

      if (sql.includes('from catalog_item_variants civ')) {
        return { rows: [catalogRow(overrides)], rowCount: 1 };
      }

      // Shipping is outside this focused policy probe. The production estimate
      // deliberately falls back to a manual quote for non-database configuration
      // failures, after all catalog orderability checks have completed.
      throw new Error(`Unexpected focused-probe query: ${sql.slice(0, 80)}`);
    }
  } as unknown as Pick<Pool, 'query'>;
}

async function runScenario(
  stockEnforcementEnabled: boolean,
  overrides: CatalogOverrides = {}
): Promise<ScenarioResult> {
  try {
    const estimate = await buildAuthoritativeOrderEstimate(
      fakeDatabase(stockEnforcementEnabled, overrides),
      [{ variantId: 101, quantity: 2 }]
    );
    return {
      outcome: 'accepted',
      availableStock: estimate.items[0]?.availableStock,
      shippingStatus: estimate.shipping.status
    };
  } catch (error) {
    if (!(error instanceof OrderCommerceError)) throw error;
    return {
      outcome: 'rejected',
      errorCode: error.code,
      issueCodes: error.issues.map((issue) => issue.code)
    };
  }
}

const result = {
  enabledOverstock: await runScenario(true),
  disabledOverstock: await runScenario(false),
  disabledInactiveProduct: await runScenario(false, { product_status: 'inactive' }),
  disabledInactiveVariant: await runScenario(false, { variant_status: 'inactive' }),
  disabledInactiveCategory: await runScenario(false, { category_is_active: false })
};

process.stdout.write(JSON.stringify(result));
