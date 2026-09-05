import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import pg, { type Pool as PgPool } from 'pg';

const { Pool } = pg;

let database: PgPool;
const prefixMigration = readFileSync(
  resolve(
    process.cwd(),
    'database/migrations/20260903_gurs_address_prefix_search.sql'
  ),
  'utf8'
);
const postalLookupIndexesMigration = readFileSync(
  resolve(
    process.cwd(),
    'database/migrations/20260904_gurs_postal_lookup_indexes.sql'
  ),
  'utf8'
);
const postalNameLookalikeIndex =
  'gurs_addresses_postal_name_lookalike_e2e_idx';

type PostalLookupIndexRow = {
  index_name: string;
  index_definition: string;
  lookup_kind: 'postalCode' | 'postalName';
};

const equivalentPostalLookupIndexesSql = `
  select installed_index.relname as index_name,
         pg_get_indexdef(installed.indexrelid) as index_definition,
         case
           when installed.indexprs is null then 'postalCode'
           else 'postalName'
         end as lookup_kind
  from pg_index installed
  join pg_class installed_index
    on installed_index.oid = installed.indexrelid
  join pg_am access_method
    on access_method.oid = installed_index.relam
  where installed.indrelid = 'public.gurs_addresses'::regclass
    and installed.indisvalid
    and installed.indisready
    and not installed.indisunique
    and access_method.amname = 'btree'
    and installed.indpred is null
    and (
      (
        installed.indnkeyatts = 2
        and installed.indnatts = 2
        and installed.indexprs is null
        and pg_get_indexdef(installed.indexrelid, 1, true) = 'postal_code'
        and pg_get_indexdef(installed.indexrelid, 2, true) = 'postal_name'
        and installed.indcollation[0] = to_regcollation('pg_catalog."C"')
        and installed.indcollation[1] = to_regcollation('pg_catalog."C"')
      )
      or (
        installed.indnkeyatts = 3
        and installed.indnatts = 3
        and installed.indexprs is not null
        and pg_get_indexdef(installed.indexrelid, 1, false) = pg_get_indexdef(
          to_regclass('pg_temp.e2e_postal_lookup_reference_name_idx'),
          1,
          false
        )
        and pg_get_indexdef(installed.indexrelid, 2, true) = 'postal_code'
        and pg_get_indexdef(installed.indexrelid, 3, true) = 'postal_name'
        and installed.indcollation[0] = to_regcollation('pg_catalog."C"')
        and installed.indcollation[1] = to_regcollation('pg_catalog."C"')
        and installed.indcollation[2] = to_regcollation('pg_catalog."C"')
      )
    )
  order by lookup_kind, index_name
`;

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

  test('prefix migration is idempotent, lease-safe, and planner-usable', async () => {
    const client = await database.connect();
    const state = await client.query<{
      lock_token: string | null;
      lock_expires_at: Date | null;
      last_failure_at: Date | null;
      last_error: string | null;
    }>(
      `select lock_token, lock_expires_at, last_failure_at, last_error
       from gurs_address_sync_state
       where key = 'active'`
    );
    let runId: string | null = null;

    try {
      await client.query(
        'drop index if exists public.gurs_addresses_search_text_prefix_idx'
      );
      const run = await client.query<{ id: string }>(
        `insert into gurs_address_sync_runs (status)
         values ('running')
         returning id::text as id`
      );
      runId = run.rows[0]?.id ?? null;
      await client.query(
        `update gurs_address_sync_state
         set lock_token = 'expired-prefix-migration-test',
             lock_expires_at = now() - interval '1 minute'
         where key = 'active'`
      );

      await client.query(prefixMigration);
      await client.query(prefixMigration);

      const clearedLease = await client.query<{
        lock_token: string | null;
        lock_expires_at: Date | null;
      }>(
        `select lock_token, lock_expires_at
         from gurs_address_sync_state
         where key = 'active'`
      );
      expect(clearedLease.rows[0]).toEqual({
        lock_token: null,
        lock_expires_at: null
      });
      const failedRun = await client.query<{ status: string }>(
        'select status from gurs_address_sync_runs where id = $1',
        [runId]
      );
      expect(failedRun.rows[0]?.status).toBe('failed');

      const equivalentIndexes = await client.query<{ index_name: string }>(
        `select installed_index.relname as index_name
         from pg_index installed
         join pg_class installed_index
           on installed_index.oid = installed.indexrelid
         join pg_am access_method
           on access_method.oid = installed_index.relam
         where installed.indrelid = 'public.gurs_addresses'::regclass
           and installed.indisvalid
           and installed.indisready
           and not installed.indisunique
           and access_method.amname = 'btree'
           and installed.indnkeyatts = 4
           and installed.indnatts = 4
           and installed.indpred is null
           and installed.indexprs is null
           and pg_get_indexdef(installed.indexrelid, 1, true) = 'search_text'
           and pg_get_indexdef(installed.indexrelid, 2, true) = 'address_line_1'
           and installed.indcollation[0] = to_regcollation('pg_catalog."C"')
           and installed.indcollation[1] = to_regcollation('pg_catalog."C"')
           and pg_get_indexdef(installed.indexrelid, 3, true) = 'postal_code'
           and pg_get_indexdef(installed.indexrelid, 4, true)
             = 'gurs_house_number_id'`
      );
      expect(equivalentIndexes.rows).toHaveLength(1);
      expect(equivalentIndexes.rows[0]?.index_name).toMatch(
        /^gurs_addresses_search_prefix_\d+_idx$/u
      );

      await client.query('set enable_seqscan = off');
      const explained = await client.query<{ 'QUERY PLAN': unknown }>(
        `explain (analyze, buffers, format json)
         select gurs_house_number_id,
                address_line_1,
                postal_code,
                postal_name,
                settlement_name,
                municipality_name
         from gurs_addresses
         where search_text collate "C" like $1
         order by search_text collate "C",
                  address_line_1 collate "C",
                  postal_code,
                  gurs_house_number_id
         limit 8`,
        ['c%']
      );
      const plan = JSON.stringify(explained.rows[0]?.['QUERY PLAN']);
      expect(plan).toContain('Index Scan');
      expect(plan).toContain(equivalentIndexes.rows[0]!.index_name);

      await client.query(
        `update gurs_address_sync_state
         set lock_token = 'live-prefix-migration-test',
             lock_expires_at = now() + interval '5 minutes'
         where key = 'active'`
      );
      await expect(client.query(prefixMigration)).rejects.toThrow(
        'A GURS synchronization is active'
      );
      await client.query('rollback');
    } finally {
      await client.query('rollback').catch(() => undefined);
      await client.query('reset enable_seqscan').catch(() => undefined);
      const original = state.rows[0];
      await client.query(
        `update gurs_address_sync_state
         set lock_token = $1,
             lock_expires_at = $2,
             last_failure_at = $3,
             last_error = $4
         where key = 'active'`,
        [
          original?.lock_token ?? null,
          original?.lock_expires_at ?? null,
          original?.last_failure_at ?? null,
          original?.last_error ?? null
        ]
      );
      if (runId) {
        await client.query('delete from gurs_address_sync_runs where id = $1', [
          runId
        ]);
      }
      client.release();
    }
  });

  test('postal lookup index migration is idempotent, lease-safe, and planner-usable', async () => {
    const client = await database.connect();
    await client.query(
      `create temporary table e2e_postal_lookup_reference (
         postal_name text not null,
         postal_code text not null
       ) on commit preserve rows;
       create index e2e_postal_lookup_reference_name_idx
         on e2e_postal_lookup_reference (
           (
             regexp_replace(
               translate(lower(postal_name), 'čšž', 'csz'),
               '[^a-z0-9]+',
               ' ',
               'g'
             )
           ) collate "C",
           postal_code collate "C",
           postal_name collate "C"
         )`
    );
    const state = await client.query<{
      lock_token: string | null;
      lock_expires_at: Date | null;
      last_failure_at: Date | null;
      last_error: string | null;
    }>(
      `select lock_token, lock_expires_at, last_failure_at, last_error
       from gurs_address_sync_state
       where key = 'active'`
    );
    const originalIndexes = await client.query<PostalLookupIndexRow>(
      equivalentPostalLookupIndexesSql
    );
    let runId: string | null = null;

    const dropIndexes = async (indexes: PostalLookupIndexRow[]) => {
      for (const index of indexes) {
        const quotedName = '"' + index.index_name.replaceAll('"', '""') + '"';
        await client.query('drop index public.' + quotedName);
      }
    };

    try {
      await dropIndexes(originalIndexes.rows);
      await client.query(
        `create index ${postalNameLookalikeIndex}
           on gurs_addresses (
             (
               regexp_replace(
                 translate(lower(postal_name), 'čšž', 'csx'),
                 '[^a-z0-9]+',
                 ' ',
                 'g'
               )
             ) collate "C",
             postal_code collate "C",
             postal_name collate "C"
           )`
      );
      const run = await client.query<{ id: string }>(
        `insert into gurs_address_sync_runs (status)
         values ('running')
         returning id::text as id`
      );
      runId = run.rows[0]?.id ?? null;
      await client.query(
        `update gurs_address_sync_state
         set lock_token = 'expired-postal-index-migration-test',
             lock_expires_at = now() - interval '1 minute'
         where key = 'active'`
      );

      await client.query(postalLookupIndexesMigration);
      await client.query(postalLookupIndexesMigration);

      const clearedLease = await client.query<{
        lock_token: string | null;
        lock_expires_at: Date | null;
      }>(
        `select lock_token, lock_expires_at
         from gurs_address_sync_state
         where key = 'active'`
      );
      expect(clearedLease.rows[0]).toEqual({
        lock_token: null,
        lock_expires_at: null
      });
      const failedRun = await client.query<{ status: string }>(
        'select status from gurs_address_sync_runs where id = $1',
        [runId]
      );
      expect(failedRun.rows[0]?.status).toBe('failed');

      const equivalentIndexes = await client.query<PostalLookupIndexRow>(
        equivalentPostalLookupIndexesSql
      );
      const postalCodeIndexes = equivalentIndexes.rows.filter(
        (index) => index.lookup_kind === 'postalCode'
      );
      const postalNameIndexes = equivalentIndexes.rows.filter(
        (index) => index.lookup_kind === 'postalName'
      );
      expect(postalCodeIndexes).toHaveLength(1);
      expect(postalNameIndexes).toHaveLength(1);

      const postalCodeIndexName = postalCodeIndexes[0]!.index_name;
      const postalNameIndexName = postalNameIndexes[0]!.index_name;
      expect(postalCodeIndexName).toMatch(
        /^gurs_addresses_postal_code_\d+_idx$/u
      );
      expect(postalNameIndexName).toMatch(
        /^gurs_addresses_postal_name_\d+_idx$/u
      );
      expect(
        equivalentIndexes.rows.some(
          (index) => index.index_name === postalNameLookalikeIndex
        )
      ).toBe(false);
      const lookalikeStillInstalled = await client.query<{ installed: boolean }>(
        `select to_regclass('public.${postalNameLookalikeIndex}') is not null
                as installed`
      );
      expect(lookalikeStillInstalled.rows[0]?.installed).toBe(true);

      await client.query('set enable_seqscan = off');
      const postalCodeExplain = await client.query<{ 'QUERY PLAN': unknown }>(
        `explain (format json)
         select postal_code, postal_name
         from gurs_addresses
         where postal_code collate "C" like $1
         order by postal_code collate "C", postal_name collate "C"
         limit 12`,
        ['1%']
      );
      const postalCodePlan = JSON.stringify(
        postalCodeExplain.rows[0]?.['QUERY PLAN']
      );
      expect(postalCodePlan).toMatch(
        /"Node Type":"(?:Index Scan|Index Only Scan|Bitmap Index Scan)"/u
      );
      expect(postalCodePlan).toContain(
        '"Index Name":"' + postalCodeIndexName + '"'
      );

      const postalNameExplain = await client.query<{ 'QUERY PLAN': unknown }>(
        `explain (format json)
         select postal_code, postal_name
         from gurs_addresses
         where (
           regexp_replace(
             translate(lower(postal_name), 'čšž', 'csz'),
             '[^a-z0-9]+',
             ' ',
             'g'
           )
         ) collate "C" like $1
         order by (
           regexp_replace(
             translate(lower(postal_name), 'čšž', 'csz'),
             '[^a-z0-9]+',
             ' ',
             'g'
           )
         ) collate "C",
         postal_code collate "C",
         postal_name collate "C"
         limit 12`,
        ['lj%']
      );
      const postalNamePlan = JSON.stringify(
        postalNameExplain.rows[0]?.['QUERY PLAN']
      );
      expect(postalNamePlan).toMatch(
        /"Node Type":"(?:Index Scan|Index Only Scan|Bitmap Index Scan)"/u
      );
      expect(postalNamePlan).toContain(
        '"Index Name":"' + postalNameIndexName + '"'
      );

      const indexesBeforeLiveLease = await client.query<PostalLookupIndexRow>(
        equivalentPostalLookupIndexesSql
      );
      const liveLease = await client.query<{
        lock_token: string;
        lock_expires_at: Date;
      }>(
        `update gurs_address_sync_state
         set lock_token = 'live-postal-index-migration-test',
             lock_expires_at = now() + interval '5 minutes'
         where key = 'active'
         returning lock_token, lock_expires_at`
      );
      await expect(client.query(postalLookupIndexesMigration)).rejects.toThrow(
        'A GURS synchronization is active'
      );
      await client.query('rollback');

      const leaseAfterRejectedMigration = await client.query<{
        lock_token: string | null;
        lock_expires_at: Date | null;
      }>(
        `select lock_token, lock_expires_at
         from gurs_address_sync_state
         where key = 'active'`
      );
      expect(leaseAfterRejectedMigration.rows[0]?.lock_token).toBe(
        liveLease.rows[0]?.lock_token
      );
      expect(
        leaseAfterRejectedMigration.rows[0]?.lock_expires_at?.toISOString()
      ).toBe(liveLease.rows[0]?.lock_expires_at.toISOString());

      const indexesAfterRejectedMigration =
        await client.query<PostalLookupIndexRow>(
          equivalentPostalLookupIndexesSql
        );
      expect(indexesAfterRejectedMigration.rows).toEqual(
        indexesBeforeLiveLease.rows
      );
    } finally {
      await client.query('rollback').catch(() => undefined);
      await client.query('reset enable_seqscan').catch(() => undefined);

      const installedIndexes = await client
        .query<PostalLookupIndexRow>(equivalentPostalLookupIndexesSql)
        .catch(() => ({ rows: [] as PostalLookupIndexRow[] }));
      await dropIndexes(installedIndexes.rows);
      await client.query(
        `drop index if exists public.${postalNameLookalikeIndex}`
      );
      for (const index of originalIndexes.rows) {
        await client.query(index.index_definition);
      }

      const original = state.rows[0];
      await client.query(
        `update gurs_address_sync_state
         set lock_token = $1,
             lock_expires_at = $2,
             last_failure_at = $3,
             last_error = $4
         where key = 'active'`,
        [
          original?.lock_token ?? null,
          original?.lock_expires_at ?? null,
          original?.last_failure_at ?? null,
          original?.last_error ?? null
        ]
      );
      if (runId) {
        await client.query('delete from gurs_address_sync_runs where id = $1', [
          runId
        ]);
      }
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
