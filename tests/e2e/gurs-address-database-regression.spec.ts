import { expect, test } from '@playwright/test';
import pg, { type Pool as PgPool } from 'pg';

const { Pool } = pg;

let database: PgPool;

test.describe('GURS order address canonicalization', () => {
  test.beforeAll(() => {
    const databaseUrl = process.env.E2E_DATABASE_URL?.trim();
    if (!databaseUrl) {
      throw new Error('[e2e-preflight] E2E_DATABASE_URL is required.');
    }
    database = new Pool({ connectionString: databaseUrl, ssl: false });
  });

  test.afterAll(async () => {
    if (!database) return;
    await (
      database as PgPool & { end: () => Promise<void> }
    ).end();
  });

  test('order creation replaces tampered text with the address selected by GURS ID', async ({
    request
  }) => {
    const addressResult = await database.query<{
      gurs_house_number_id: string;
      postal_code: string;
      postal_name: string;
      address_line_1: string;
    }>(
      'select gurs_house_number_id, postal_code, postal_name, address_line_1 ' +
        'from gurs_addresses ' +
        'where address_line_1 = $1 and postal_code = $2 ' +
        'order by gurs_house_number_id limit 1',
      ['Cankarjeva ulica 27a', '6000']
    );
    const addressRow = addressResult.rows[0];
    expect(addressRow).toBeTruthy();
    if (!addressRow) throw new Error('The local GURS register is unavailable.');
    const testGursAddress = {
      gursHouseNumberId: addressRow.gurs_house_number_id,
      postalCode: addressRow.postal_code,
      postalName: addressRow.postal_name,
      addressLine1: addressRow.address_line_1
    };
    const email = `gurs-canonical-${Date.now()}@example.com`;
    const items = [{ variantId: 920001, quantity: 1 }];
    const estimateResponse = await request.post('/api/orders/estimate', {
      data: {
        customerName: 'E2E šola',
        customerLabels: ['E2E šola', 'Ana Novak'],
        items
      }
    });
    expect(estimateResponse.ok()).toBeTruthy();
    const estimate = await estimateResponse.json() as {
      shippingConfigurationVersion: number;
      quoteFingerprint: string;
    };
    const response = await request.post('/api/orders', {
      headers: {
        'Idempotency-Key': `gurs-canonical-${crypto.randomUUID()}`
      },
      data: {
        customerType: 'school',
        customerName: 'E2E šola',
        organizationName: 'E2E šola',
        contactName: 'Ana Novak',
        email,
        addressLine1: 'Ponarejen naslov 999',
        addressLine2: '2. nadstropje',
        city: 'Napačen kraj',
        postalCode: '9999',
        gursHouseNumberId: testGursAddress.gursHouseNumberId,
        countryCode: 'SI',
        notes: '',
        items,
        shippingConfigurationVersion: estimate.shippingConfigurationVersion,
        quoteFingerprint: estimate.quoteFingerprint
      }
    });

    expect(response.status()).toBe(201);
    const orderResult = await database.query<{
      address_line1: string;
      address_line2: string | null;
      city: string;
      postal_code: string;
      gurs_house_number_id: string | null;
      country_code: string;
    }>(
      `select address_line1,
              address_line2,
              city,
              postal_code,
              gurs_house_number_id,
              country_code
       from orders
       where email = $1
       order by id desc
       limit 1`,
      [email]
    );

    expect(orderResult.rows[0]).toEqual({
      address_line1: testGursAddress.addressLine1,
      address_line2: '2. nadstropje',
      city: testGursAddress.postalName,
      postal_code: testGursAddress.postalCode,
      gurs_house_number_id: testGursAddress.gursHouseNumberId,
      country_code: 'SI'
    });

    // The disposable E2E database is reset by the harness. Retaining this school
    // order lets its asynchronous summary job finish without deleting underneath it.
  });
});
