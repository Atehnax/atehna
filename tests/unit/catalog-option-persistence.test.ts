import assert from 'node:assert/strict';
import test from 'node:test';
import type { PoolClient } from 'pg';
import type { CatalogItemOptionAxisPayload } from '../../src/shared/domain/catalog/catalogAdminTypes';
import { loadBoundServerModule } from './support/loadBoundServerModule';

const { syncCatalogOptionAxes } = loadBoundServerModule<{
  syncCatalogOptionAxes: (client: PoolClient, itemId: number, axes: CatalogItemOptionAxisPayload[]) => Promise<void>;
}>('src/shared/server/catalogItems.ts', {});

type Row = Record<string, string | number | null> & { id: number; slug: string };

class OptionDatabase {
  axes: Row[] = [{ id: 1, item_id: 7, name: 'Dimenzije', slug: 'dimenzije', position: 0 }];
  values: Row[] = [
    { id: 10, axis_id: 1, value: 'Small', slug: 'small', swatch: null, position: 0 },
    { id: 11, axis_id: 1, value: 'Large', slug: 'large', swatch: null, position: 1 }
  ];
  mutations = 0;
  nextAxisId = 100;
  nextValueId = 1000;

  private checkUnique(rows: Row[], row: Row, owner: string) {
    if (rows.some((existing) => existing.id !== row.id && existing[owner] === row[owner] && existing.slug === row.slug)) {
      throw new Error('duplicate key value violates unique constraint');
    }
  }

  async query(rawSql: string, parameters: unknown[] = []) {
    const sql = rawSql.replace(/\s+/g, ' ').trim();
    const [a, b, c, d, e, f] = parameters;
    if (sql.startsWith('select id, slug from catalog_option_axes')) {
      return { rows: this.axes.filter((row) => row.item_id === a).map(({ id, slug }) => ({ id, slug })) };
    }
    if (sql.startsWith('select id, slug from catalog_option_values')) {
      return { rows: this.values.filter((row) => row.axis_id === a).map(({ id, slug }) => ({ id, slug })) };
    }
    this.mutations += 1;
    const staging = /^update (catalog_option_axes|catalog_option_values) set slug = \$1 where/.exec(sql);
    if (staging) {
      const isAxis = staging[1] === 'catalog_option_axes';
      const rows = isAxis ? this.axes : this.values;
      const owner = isAxis ? 'item_id' : 'axis_id';
      const row = rows.find((entry) => entry.id === b && entry[owner] === c);
      if (!row) return { rows: [] };
      const next = { ...row, slug: String(a) };
      this.checkUnique(rows, next, owner);
      Object.assign(row, next);
      return { rows: [] };
    }
    if (sql.startsWith('delete from catalog_option_axes')) {
      const retained = new Set(b as number[]);
      const deleted = new Set(this.axes.filter((row) => row.item_id === a && !retained.has(row.id)).map((row) => row.id));
      this.axes = this.axes.filter((row) => !deleted.has(row.id));
      this.values = this.values.filter((row) => !deleted.has(row.axis_id as number));
      return { rows: [] };
    }
    if (sql.startsWith('delete from catalog_option_values')) {
      const retained = new Set(b as number[]);
      this.values = this.values.filter((row) => row.axis_id !== a || retained.has(row.id));
      return { rows: [] };
    }
    if (sql.startsWith('update catalog_option_axes set name')) {
      const row = this.axes.find((entry) => entry.id === d && entry.item_id === e);
      if (!row) return { rows: [] };
      const next = { ...row, name: String(a), slug: String(b), position: Number(c) };
      this.checkUnique(this.axes, next, 'item_id');
      Object.assign(row, next);
      return { rows: [{ id: row.id }] };
    }
    if (sql.startsWith('insert into catalog_option_axes')) {
      const row = { id: this.nextAxisId++, item_id: Number(a), name: String(b), slug: String(c), position: Number(d) };
      this.checkUnique(this.axes, row, 'item_id');
      this.axes.push(row);
      return { rows: [{ id: row.id }] };
    }
    if (sql.startsWith('update catalog_option_values set value')) {
      const row = this.values.find((entry) => entry.id === e && entry.axis_id === f);
      if (!row) return { rows: [] };
      const next = { ...row, value: String(a), slug: String(b), swatch: c === null ? null : String(c), position: Number(d) };
      this.checkUnique(this.values, next, 'axis_id');
      Object.assign(row, next);
      return { rows: [{ id: row.id }] };
    }
    if (sql.startsWith('insert into catalog_option_values')) {
      assert.ok(this.axes.some((row) => row.id === a), 'value axis must exist');
      const row = { id: this.nextValueId++, axis_id: Number(a), value: String(b), slug: String(c), swatch: d === null ? null : String(d), position: Number(e) };
      this.checkUnique(this.values, row, 'axis_id');
      this.values.push(row);
      return { rows: [{ id: row.id }] };
    }
    throw new Error(`Unhandled persistence query: ${sql}`);
  }

  save(axes: CatalogItemOptionAxisPayload[]) {
    return syncCatalogOptionAxes(this as unknown as PoolClient, 7, axes);
  }
}

function dimensionAxis(values: CatalogItemOptionAxisPayload['values']): CatalogItemOptionAxisPayload {
  return { id: 1, name: 'Dimenzije', slug: 'dimenzije', values };
}

function isValidationError(error: unknown) {
  const candidate = error as { name?: string; statusCode?: number };
  return candidate.name === 'CatalogItemValidationError' && candidate.statusCode === 400;
}

test('repeated ID-less axis/value saves reuse persisted slugs and preserve IDs', async () => {
  const database = new OptionDatabase();
  const input: CatalogItemOptionAxisPayload[] = [{
    name: ' Dimenzije ', slug: ' dimenzije ',
    values: [
      { value: ' Small updated ', slug: ' small ' },
      { value: 'New', slug: 'new' }
    ]
  }];
  const before = structuredClone(input);
  await database.save(input);
  const first = structuredClone({ axes: database.axes, values: database.values });
  await database.save(input);
  assert.deepEqual({ axes: database.axes, values: database.values }, first);
  assert.equal(database.axes[0].id, 1);
  assert.equal(database.values.find((row) => row.slug === 'small')?.id, 10);
  assert.equal(database.values.find((row) => row.slug === 'new')?.id, 1000);
  assert.deepEqual(input, before);
});

test('replaying a new ID-less axis also reuses its new persisted ID', async () => {
  const database = new OptionDatabase();
  const input = [{ name: 'Barva', slug: 'barva', values: [{ value: 'Modra', slug: 'modra' }] }];
  await database.save(input);
  const first = structuredClone({ axes: database.axes, values: database.values });
  await database.save(input);
  assert.deepEqual({ axes: database.axes, values: database.values }, first);
});

test('value slug swaps preserve both IDs without temporary uniqueness violations', async () => {
  const database = new OptionDatabase();
  await database.save([dimensionAxis([
    { id: 10, value: 'Now large', slug: 'large' },
    { id: 11, value: 'Now small', slug: 'small' }
  ])]);
  assert.deepEqual(database.values.map((row) => [row.id, row.slug]), [[10, 'large'], [11, 'small']]);
  assert.ok(database.values.every((row) => !row.slug.startsWith('__catalog_sync_')));
});

test('renaming a retained value can reuse the slug of an omitted value', async () => {
  const database = new OptionDatabase();
  await database.save([dimensionAxis([{ id: 10, value: 'Now large', slug: 'large' }])]);
  assert.deepEqual(database.values.map((row) => [row.id, row.slug]), [[10, 'large']]);
});

test('explicit value IDs are reserved before matching earlier ID-less values by slug', async () => {
  const database = new OptionDatabase();
  await database.save([dimensionAxis([
    { value: 'New small', slug: 'small' },
    { id: 10, value: 'Retained now large', slug: 'large' }
  ])]);
  assert.equal(database.values.find((row) => row.slug === 'large')?.id, 10);
  assert.equal(database.values.find((row) => row.slug === 'small')?.id, 1000);
});

test('axes support slug swaps and reserve explicit axis IDs before matching ID-less rows', async () => {
  const database = new OptionDatabase();
  database.axes.push({ id: 2, item_id: 7, name: 'Barva', slug: 'barva', position: 1 });
  database.values.push({ id: 20, axis_id: 2, value: 'Modra', slug: 'modra', swatch: null, position: 0 });
  await database.save([
    { id: 1, name: 'Barva', slug: 'barva', values: [{ id: 10, value: 'Small', slug: 'small' }] },
    { id: 2, name: 'Dimenzije', slug: 'dimenzije', values: [{ id: 20, value: 'Modra', slug: 'modra' }] }
  ]);
  assert.deepEqual(database.axes.map((row) => [row.id, row.slug]), [[1, 'barva'], [2, 'dimenzije']]);
  await database.save([
    { name: 'New barva', slug: 'barva', values: [{ value: 'New', slug: 'new' }] },
    { id: 1, name: 'Moved', slug: 'moved', values: [{ id: 10, value: 'Small', slug: 'small' }] }
  ]);
  assert.equal(database.axes.find((row) => row.slug === 'moved')?.id, 1);
  assert.equal(database.axes.find((row) => row.slug === 'barva')?.id, 100);
});

test('temporary slug staging avoids collisions with stored and requested temporary-looking names', async () => {
  const database = new OptionDatabase();
  database.values.push({ id: 12, axis_id: 1, value: 'Reserved', slug: '__catalog_sync_10', position: 2, swatch: null });
  await database.save([dimensionAxis([
    { id: 10, value: 'Renamed', slug: '__catalog_sync_10_1' },
    { id: 12, value: 'Reserved', slug: '__catalog_sync_10' }
  ])]);
  assert.equal(database.values.find((row) => row.id === 10)?.slug, '__catalog_sync_10_1');
  assert.equal(database.values.find((row) => row.id === 12)?.slug, '__catalog_sync_10');
});

test('foreign axis/value IDs are validation errors and never fall back to matching slugs', async () => {
  const database = new OptionDatabase();
  database.axes.push({ id: 2, item_id: 99, name: 'Foreign', slug: 'dimenzije', position: 0 });
  database.values.push({ id: 20, axis_id: 2, value: 'Foreign', slug: 'small', swatch: null, position: 0 });
  await assert.rejects(database.save([{ id: 2, name: 'Dimenzije', slug: 'dimenzije', values: [{ value: 'Small', slug: 'small' }] }]), isValidationError);
  await assert.rejects(database.save([dimensionAxis([{ id: 20, value: 'Small', slug: 'small' }])]), isValidationError);
  assert.equal(database.mutations, 0);
  assert.equal(database.values.find((row) => row.id === 20)?.value, 'Foreign');
});

test('duplicate trimmed slugs or explicit IDs fail before persistence changes', async () => {
  const requests: CatalogItemOptionAxisPayload[][] = [
    [dimensionAxis([{ value: 'Small', slug: 'small' }, { value: 'Duplicate', slug: ' small ' }])],
    [dimensionAxis([{ id: 10, value: 'Small', slug: 'small' }, { id: 10, value: 'Other', slug: 'other' }])],
    [dimensionAxis([{ value: 'Small', slug: 'small' }]), { name: 'Duplicate', slug: ' dimenzije ', values: [{ value: 'Other', slug: 'other' }] }],
    [dimensionAxis([{ value: 'Small', slug: 'small' }]), { id: 1, name: 'Other', slug: 'other', values: [{ value: 'Other', slug: 'other' }] }]
  ];
  for (const request of requests) {
    const database = new OptionDatabase();
    await assert.rejects(database.save(request), isValidationError);
    assert.equal(database.mutations, 0);
  }
});
