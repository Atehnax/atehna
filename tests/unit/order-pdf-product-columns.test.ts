import assert from 'node:assert/strict';
import test from 'node:test';
import type { Pool } from 'pg';
import { buildPdfContext } from '../../src/shared/server/pdfGeneration';

test('PDF items use immutable order-line SKU, product text, quantity, unit, and net prices', async () => {
  const queries: string[] = [];
  const pool = {
    async query(sql: string) {
      queries.push(sql);
      if (/from orders/iu.test(sql)) {
        return {
          rows: [{
            id: 42,
            order_number: '2026-0042',
            public_code_base: '7K3M4X9P2D6R8H4Q',
            customer_type: 'company',
            organization_name: 'Preizkusno podjetje d.o.o.',
            contact_name: 'Ana Novak',
            email: 'ana@example.test',
            address_line1: 'Testna cesta 1',
            postal_code: '1000',
            city: 'Ljubljana',
            country_code: 'SI',
            subtotal: '35.17',
            tax: '7.74',
            tax_rate: '0.22',
            shipping: '0',
            total: '42.91',
            created_at: '2026-08-20T10:00:00.000Z'
          }]
        };
      }
      if (/from order_items/iu.test(sql)) {
        return {
          rows: [{
            sku: 'MAT-KOV-ALU-0P3X100X100',
            name: 'Aluminijasta plošča 0,3 × 100 × 100 mm',
            unit: 'kos',
            quantity: '3',
            unitPrice: '11.7225',
            lineTotal: '35.1675',
            taxRate: '0.22',
            discountPercentage: '5',
            shipLater: true
          }]
        };
      }
      throw new Error(`Unexpected query: ${sql}`);
    }
  } as unknown as Pool;

  const result = await buildPdfContext(pool, 42);

  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.deepEqual(result.itemsForPdf, [{
    sku: 'MAT-KOV-ALU-0P3X100X100',
    name: 'Aluminijasta plošča 0,3 × 100 × 100 mm',
    unit: 'kos',
    quantity: 3,
    unitPrice: 11.7225,
    lineTotal: 35.1675,
    taxRate: 0.22,
    discountPercentage: 5,
    shipLater: true
  }]);
  assert.equal(result.orderForPdf.subtotal, 35.17);
  assert.equal(result.orderForPdf.tax, 7.74);
  assert.equal(result.orderForPdf.total, 42.91);

  const itemQuery = queries.find((sql) => /from order_items/iu.test(sql));
  assert.ok(itemQuery);
  assert.match(itemQuery, /unit_net\s+as\s+"unitPrice"/iu);
  assert.match(itemQuery, /line_net\s+as\s+"lineTotal"/iu);
  assert.match(itemQuery, /ship_later\s+as\s+"shipLater"/iu);
  assert.doesNotMatch(itemQuery, /catalog_items|catalog_item_variants/iu);
});
