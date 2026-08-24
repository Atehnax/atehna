import { expect, test } from '@playwright/test';
import pg, { type Pool as PgPool } from 'pg';

const { Pool } = pg;

const TEST_GURS_ADDRESS = {
  gursHouseNumberId: '9223372036854775808',
  postalCode: '6000',
  postalName: 'Koper - Capodistria',
  addressLine1: 'Cankarjeva ulica 27a'
} as const;

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
    const email = `gurs-canonical-${Date.now()}@example.com`;
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
        gursHouseNumberId: TEST_GURS_ADDRESS.gursHouseNumberId,
        countryCode: 'SI',
        notes: '',
        items: [{ variantId: 920001, quantity: 1 }]
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
      address_line1: TEST_GURS_ADDRESS.addressLine1,
      address_line2: '2. nadstropje',
      city: TEST_GURS_ADDRESS.postalName,
      postal_code: TEST_GURS_ADDRESS.postalCode,
      gurs_house_number_id: TEST_GURS_ADDRESS.gursHouseNumberId,
      country_code: 'SI'
    });

    // The disposable E2E database is reset by the harness. Retaining this school
    // order lets its asynchronous summary job finish without deleting underneath it.
  });
});
