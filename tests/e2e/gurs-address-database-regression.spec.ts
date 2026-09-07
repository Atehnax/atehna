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

  test('canonical street prefix index supports the bounded ordered lookup', async () => {
    const client = await database.connect();
    try {
      await client.query('begin read only');
      // Tiny E2E fixtures naturally prefer sequential scans. This checks index
      // eligibility, not a claim about production planner choice or latency.
      await client.query('set local enable_seqscan = off');
      const explained = await client.query<{ 'QUERY PLAN': unknown }>(
        `explain (analyze, buffers, format json)
         select gurs_house_number_id, address_line_1, postal_code, postal_name,
                settlement_name, municipality_name
         from gurs_addresses
         where search_text collate "C" like $1
         order by search_text collate "C", address_line_1 collate "C",
                  postal_code, gurs_house_number_id
         limit 8`,
        ['c%']
      );
      const plan = JSON.stringify(explained.rows[0]?.['QUERY PLAN']);
      expect(plan).toContain('Index Scan');
      expect(plan).toMatch(/gurs_addresses_search_(?:text_prefix|prefix_\d+)_idx/u);
      await client.query('commit');
    } finally {
      await client.query('rollback').catch(() => undefined);
      client.release();
    }
  });

  test('canonical postal indexes support bounded code and normalized place lookup', async () => {
    const client = await database.connect();
    try {
      await client.query('begin read only');
      await client.query('set local enable_seqscan = off');
      const lookups = [
        {
          sql: `select postal_code, postal_name from gurs_addresses
                where postal_code collate "C" like $1
                order by postal_code collate "C", postal_name collate "C"
                limit 12`,
          prefix: '1%',
          index: /gurs_addresses_postal_code_(?:prefix|\d+)_idx/u
        },
        {
          sql: `select postal_code, postal_name from gurs_addresses
                where regexp_replace(translate(lower(postal_name), 'čšž', 'csz'),
                      '[^a-z0-9]+', ' ', 'g') collate "C" like $1
                order by regexp_replace(translate(lower(postal_name), 'čšž', 'csz'),
                         '[^a-z0-9]+', ' ', 'g') collate "C",
                         postal_code collate "C", postal_name collate "C"
                limit 12`,
          prefix: 'lj%',
          index: /gurs_addresses_postal_name_(?:prefix|\d+)_idx/u
        }
      ];
      for (const lookup of lookups) {
        const explained = await client.query<{ 'QUERY PLAN': unknown }>(
          'explain (format json) ' + lookup.sql, [lookup.prefix]
        );
        const plan = JSON.stringify(explained.rows[0]?.['QUERY PLAN']);
        expect(plan).toMatch(/"Node Type":"(?:Index Scan|Index Only Scan|Bitmap Index Scan)"/u);
        expect(plan).toMatch(lookup.index);
      }
      await client.query('commit');
    } finally {
      await client.query('rollback').catch(() => undefined);
      client.release();
    }
  });

  test('short-word refinements retain indexed prefix results', async ({
    request
  }) => {
    const gursHouseNumberId = 'e2e-short-token-' + crypto.randomUUID();
    await database.query(
      `insert into gurs_addresses (
         gurs_house_number_id, street_name, settlement_name, house_number,
         postal_code, postal_name, municipality_name, address_line_1,
         search_text, source_updated_at
       ) values ($1, $2, $3, $4, $5, $6, $7, $8, $9, now())`,
      [
        gursHouseNumberId,
        'Na vasi',
        'Preskusna vas',
        '1',
        '1000',
        'Ljubljana',
        'Ljubljana',
        'Na vasi 1',
        'na vasi 1 preskusna vas 1000 ljubljana'
      ]
    );

    try {
      for (const query of ['na', 'na v', 'na vas']) {
        const response = await request.get(
          '/api/addresses/search?query=' + encodeURIComponent(query)
        );
        expect(response.ok()).toBeTruthy();
        const payload = (await response.json()) as {
          results: Array<{ gursHouseNumberId: string }>;
        };
        expect(payload.results).toContainEqual(
          expect.objectContaining({ gursHouseNumberId })
        );
      }
    } finally {
      await database.query(
        'delete from gurs_addresses where gurs_house_number_id = $1',
        [gursHouseNumberId]
      );
    }
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
