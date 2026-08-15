import 'server-only';

import { randomUUID } from 'node:crypto';
import { unstable_noStore as noStore } from 'next/cache';
import type { Pool, PoolClient } from 'pg';
import {
  CUSTOMER_DIRECTORY_MAX_ARRAY_LENGTH,
  CUSTOMER_DIRECTORY_MAX_BATCH_SIZE,
  CUSTOMER_DIRECTORY_MAX_TEXT_LENGTH,
  type CustomerDirectoryData,
  type CustomerDirectoryEditableFields,
  type CustomerDirectoryMutation,
  type CustomerDirectoryRow
} from '@/shared/domain/customerDirectory';
import {
  getDatabaseUrl,
  getPool,
  isDatabaseUnavailableError
} from '@/shared/server/db';

const ID_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,79}$/;
const DUPLICATE_NAME_SUFFIX = ' kopija';
const EDITABLE_FIELD_KEYS = [
  'name',
  'address',
  'postalCode',
  'city',
  'contacts',
  'emails'
] as const;

const tableSql = `
  create table if not exists customer_directory_profiles (
    id text primary key,
    source_customer_key text,
    name text not null default '',
    address text not null default '',
    postal_code text not null default '',
    city text not null default '',
    contacts text[] not null default array[]::text[],
    emails text[] not null default array[]::text[],
    overridden_fields text[] not null default array[]::text[],
    archived_at timestamptz,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
  );

  alter table customer_directory_profiles
    add column if not exists overridden_fields text[];

  update customer_directory_profiles
  set overridden_fields = array['name', 'address', 'postalCode', 'city', 'contacts', 'emails']::text[]
  where overridden_fields is null;

  alter table customer_directory_profiles
    alter column overridden_fields set default array[]::text[],
    alter column overridden_fields set not null;

  create unique index if not exists customer_directory_profiles_source_key_unique_idx
    on customer_directory_profiles (source_customer_key)
    where source_customer_key is not null;

  create index if not exists customer_directory_profiles_active_idx
    on customer_directory_profiles (archived_at, created_at, id);
`;

const customerDirectorySql = `
  with eligible_orders as (
    select
      orders.id,
      orders.created_at,
      orders.customer_type,
      orders.status,
      orders.commitment_status,
      coalesce(nullif(btrim(orders.organization_name), ''), nullif(btrim(orders.contact_name), '')) as customer_name,
      coalesce(nullif(btrim(orders.organization_name), ''), '') as organization_name,
      coalesce(nullif(btrim(orders.contact_name), ''), '') as contact_name,
      coalesce(nullif(btrim(orders.email), ''), '') as email,
      coalesce(nullif(btrim(orders.address_line1), ''), '') as address_line1,
      coalesce(nullif(btrim(orders.delivery_address), ''), '') as delivery_address,
      coalesce(nullif(btrim(orders.postal_code), ''), '') as postal_code,
      coalesce(nullif(btrim(orders.city), ''), '') as city,
      coalesce(
        orders.total::numeric,
        coalesce(orders.subtotal::numeric, 0::numeric)
          + coalesce(orders.tax::numeric, 0::numeric)
          + coalesce(orders.shipping::numeric, 0::numeric),
        0::numeric
      ) as purchase_value
    from orders
    where orders.deleted_at is null
      and not coalesce(orders.is_draft, false)
  ),
  normalized_orders as (
    select
      eligible_orders.*,
      coalesce(
        nullif(address_line1, ''),
        nullif(btrim(regexp_replace(delivery_address, ',?\\s*[0-9]{4}\\s+.*$', '', 'i')), ''),
        ''
      ) as identity_street,
      coalesce(
        nullif(postal_code, ''),
        (regexp_match(delivery_address, '([0-9]{4})'))[1],
        ''
      ) as identity_postal_code,
      coalesce(
        nullif(city, ''),
        nullif(btrim((regexp_match(delivery_address, '[0-9]{4}\\s+([^,]+)$'))[1]), ''),
        ''
      ) as identity_city,
      commitment_status = 'binding' and status <> 'cancelled' as is_purchase
    from eligible_orders
  ),
  identified_orders as (
    select
      normalized_orders.*,
      case
        when customer_type in ('company', 'school')
          and organization_name <> ''
          and identity_postal_code <> '' then
          'organization:'
          || customer_type
          || '|'
          || lower(regexp_replace(organization_name, '\\s+', ' ', 'g'))
          || '|'
          || lower(regexp_replace(identity_postal_code, '\\s+', '', 'g'))
        when customer_type in ('company', 'school')
          and organization_name <> ''
          and email <> ''
          and lower(email) <> 'draft@atehna.si' then
          'organization-email:'
          || customer_type
          || '|'
          || lower(regexp_replace(organization_name, '\\s+', ' ', 'g'))
          || '|'
          || lower(regexp_replace(email, '\\s+', '', 'g'))
        when email <> ''
          and lower(email) <> 'draft@atehna.si'
          and contact_name <> '' then
          'person:'
          || customer_type
          || '|'
          || lower(regexp_replace(email, '\\s+', '', 'g'))
          || '|'
          || lower(regexp_replace(contact_name, '\\s+', ' ', 'g'))
        when customer_name <> ''
          and identity_street <> ''
          and (identity_postal_code <> '' or identity_city <> '') then
          'profile:'
          || customer_type
          || '|'
          || lower(regexp_replace(customer_name, '\\s+', ' ', 'g'))
          || '|'
          || lower(regexp_replace(identity_street, '\\s+', ' ', 'g'))
          || '|'
          || lower(regexp_replace(identity_postal_code, '\\s+', '', 'g'))
          || '|'
          || lower(regexp_replace(identity_city, '\\s+', ' ', 'g'))
        when email <> '' and lower(email) <> 'draft@atehna.si' then
          'email:'
          || customer_type
          || '|'
          || lower(regexp_replace(email, '\\s+', '', 'g'))
        else 'order:' || id::text
      end as customer_key
    from normalized_orders
  ),
  ranked_orders as (
    select
      identified_orders.*,
      row_number() over (
        partition by customer_key
        order by (
          (customer_name <> '')::int
            + (coalesce(nullif(address_line1, ''), nullif(delivery_address, '')) is not null)::int
            + (coalesce(nullif(postal_code, ''), nullif(identity_postal_code, '')) is not null)::int
            + (coalesce(nullif(city, ''), nullif(identity_city, '')) is not null)::int
        ) desc,
        created_at desc,
        id desc
      ) as profile_rank
    from identified_orders
  ),
  customer_profiles as (
    select
      customer_key,
      customer_name,
      identity_street as address,
      identity_postal_code as postal_code,
      identity_city as city
    from ranked_orders
    where profile_rank = 1
  ),
  customer_aggregates as (
    select
      customer_key,
      coalesce(
        array_agg(distinct contact_name order by contact_name) filter (where contact_name <> ''),
        array[]::text[]
      ) as contacts,
      coalesce(
        array_agg(distinct email order by email) filter (where email <> ''),
        array[]::text[]
      ) as emails,
      count(*) filter (where is_purchase)::int as purchase_count,
      min(created_at) filter (where is_purchase) as first_purchase_at,
      max(created_at) filter (where is_purchase) as last_purchase_at,
      round(avg(purchase_value) filter (where is_purchase), 2) as average_purchase_value,
      round(coalesce(sum(purchase_value) filter (where is_purchase), 0::numeric), 2) as total_purchase_value
    from ranked_orders
    group by customer_key
  ),
  derived_rows as (
    select
      md5(customer_profiles.customer_key) as row_id,
      coalesce(customer_profiles.customer_name, 'Neznana stranka') as name,
      customer_profiles.address,
      customer_profiles.postal_code,
      customer_profiles.city,
      customer_aggregates.contacts,
      customer_aggregates.emails,
      customer_aggregates.purchase_count,
      customer_aggregates.first_purchase_at,
      customer_aggregates.last_purchase_at,
      customer_aggregates.average_purchase_value,
      customer_aggregates.total_purchase_value
    from customer_profiles
    join customer_aggregates using (customer_key)
  ),
  visible_derived_rows as (
    select
      derived_rows.row_id as id,
      case
        when overrides.id is not null and 'name' = any(overrides.overridden_fields)
          then overrides.name
        else derived_rows.name
      end as name,
      case
        when overrides.id is not null and 'address' = any(overrides.overridden_fields)
          then overrides.address
        else derived_rows.address
      end as address,
      case
        when overrides.id is not null and 'postalCode' = any(overrides.overridden_fields)
          then overrides.postal_code
        else derived_rows.postal_code
      end as postal_code,
      case
        when overrides.id is not null and 'city' = any(overrides.overridden_fields)
          then overrides.city
        else derived_rows.city
      end as city,
      case
        when overrides.id is not null and 'contacts' = any(overrides.overridden_fields)
          then overrides.contacts
        else derived_rows.contacts
      end as contacts,
      case
        when overrides.id is not null and 'emails' = any(overrides.overridden_fields)
          then overrides.emails
        else derived_rows.emails
      end as emails,
      derived_rows.purchase_count,
      derived_rows.first_purchase_at,
      derived_rows.last_purchase_at,
      derived_rows.average_purchase_value,
      derived_rows.total_purchase_value,
      'orders'::text as origin,
      overrides.updated_at as revision
    from derived_rows
    left join customer_directory_profiles as overrides
      on overrides.source_customer_key = derived_rows.row_id
    where overrides.id is null or overrides.archived_at is null
  ),
  visible_manual_rows as (
    select
      manual.id,
      manual.name,
      manual.address,
      manual.postal_code,
      manual.city,
      manual.contacts,
      manual.emails,
      0::integer as purchase_count,
      null::timestamptz as first_purchase_at,
      null::timestamptz as last_purchase_at,
      0::numeric as average_purchase_value,
      0::numeric as total_purchase_value,
      'manual'::text as origin,
      manual.updated_at as revision
    from customer_directory_profiles as manual
    where manual.source_customer_key is null
      and manual.archived_at is null
  ),
  visible_rows as (
    select * from visible_derived_rows
    union all
    select * from visible_manual_rows
  )
  select *
  from visible_rows
  order by lower(name), id
`;

type RawCustomerDirectoryRow = {
  id: string;
  name: string | null;
  address: string | null;
  postal_code: string | null;
  city: string | null;
  contacts: string[] | null;
  emails: string[] | null;
  purchase_count: number | string;
  first_purchase_at: Date | string | null;
  last_purchase_at: Date | string | null;
  average_purchase_value: number | string | null;
  total_purchase_value: number | string | null;
  origin: string;
  revision: Date | string | null;
};

export type CustomerDirectoryMutationResult = {
  row?: CustomerDirectoryRow;
  rows?: CustomerDirectoryRow[];
  deletedRowIds?: string[];
};

type RequestedSnapshot = {
  rowId: string;
  expectedFields: CustomerDirectoryEditableFields;
};

export class CustomerDirectoryValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CustomerDirectoryValidationError';
  }
}

export class CustomerDirectoryConflictError extends Error {
  readonly row?: CustomerDirectoryRow;
  readonly rows: CustomerDirectoryRow[];
  readonly missingRowIds: string[];

  constructor(
    message: string,
    rows: CustomerDirectoryRow | CustomerDirectoryRow[] = [],
    missingRowIds: string[] = []
  ) {
    super(message);
    this.name = 'CustomerDirectoryConflictError';
    this.rows = Array.isArray(rows) ? rows : [rows];
    this.row = this.rows[0];
    this.missingRowIds = missingRowIds;
  }
}

let customerDirectoryReadyPromise: Promise<Pool> | null = null;

const toText = (value: unknown) => typeof value === 'string' ? value : '';

const toIsoTimestamp = (value: Date | string | null) => {
  if (value === null) return '';
  const parsedValue = value instanceof Date ? value : new Date(value);
  return Number.isNaN(parsedValue.getTime()) ? '' : parsedValue.toISOString();
};

const toNullableIsoTimestamp = (value: Date | string | null) => {
  const timestamp = toIsoTimestamp(value);
  return timestamp || null;
};

const toFiniteNumber = (value: unknown) => {
  const parsedValue = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsedValue) ? parsedValue : 0;
};

const toStoredTextArray = (value: string[] | null) => Array.isArray(value)
  ? value.map((entry) => String(entry))
  : [];

const mapCustomerDirectoryRow = (row: RawCustomerDirectoryRow): CustomerDirectoryRow => ({
  id: String(row.id),
  name: toText(row.name),
  address: toText(row.address),
  postalCode: toText(row.postal_code),
  city: toText(row.city),
  contacts: toStoredTextArray(row.contacts),
  emails: toStoredTextArray(row.emails),
  origin: row.origin === 'manual' ? 'manual' : 'orders',
  revision: toNullableIsoTimestamp(row.revision),
  purchaseCount: Math.max(0, Math.floor(toFiniteNumber(row.purchase_count))),
  firstPurchaseAt: toIsoTimestamp(row.first_purchase_at),
  lastPurchaseAt: toIsoTimestamp(row.last_purchase_at),
  averagePurchaseValue: toFiniteNumber(row.average_purchase_value),
  totalPurchaseValue: toFiniteNumber(row.total_purchase_value)
});

async function prepareCustomerDirectory(): Promise<Pool> {
  const pool = await getPool();
  await pool.query(tableSql);
  return pool;
}

async function ensureCustomerDirectory(): Promise<Pool> {
  customerDirectoryReadyPromise ??= prepareCustomerDirectory().catch((error) => {
    customerDirectoryReadyPromise = null;
    throw error;
  });
  return customerDirectoryReadyPromise;
}

async function readCustomerDirectoryRows(
  queryable: Pool | PoolClient
): Promise<CustomerDirectoryRow[]> {
  const result = await queryable.query<RawCustomerDirectoryRow>(customerDirectorySql);
  return result.rows.map(mapCustomerDirectoryRow);
}

export async function fetchCustomerDirectory(): Promise<CustomerDirectoryRow[]> {
  noStore();
  const pool = await ensureCustomerDirectory();
  return readCustomerDirectoryRows(pool);
}

export async function getCustomerDirectory(): Promise<CustomerDirectoryData> {
  noStore();
  if (!getDatabaseUrl()) {
    return {
      rows: [],
      warningMessage: 'Povezava z bazo ni nastavljena.',
      persistenceAvailable: false
    };
  }

  try {
    return {
      rows: await fetchCustomerDirectory(),
      warningMessage: null,
      persistenceAvailable: true
    };
  } catch (error) {
    if (!isDatabaseUnavailableError(error)) {
      console.error('Failed to load customer directory', error);
    }
    return {
      rows: [],
      warningMessage: 'Podatkov o strankah trenutno ni mogoče naložiti.',
      persistenceAvailable: false
    };
  }
}

const assertRecord = (value: unknown, message: string): Record<string, unknown> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new CustomerDirectoryValidationError(message);
  }
  return value as Record<string, unknown>;
};

const assertId = (value: unknown, label: string) => {
  if (typeof value !== 'string' || !ID_PATTERN.test(value)) {
    throw new CustomerDirectoryValidationError(`${label} ni veljaven.`);
  }
  return value;
};

const normalizeTextField = (value: unknown, label: string) => {
  if (typeof value !== 'string' || value.length > CUSTOMER_DIRECTORY_MAX_TEXT_LENGTH) {
    throw new CustomerDirectoryValidationError(
      `${label} mora biti besedilo z največ ${CUSTOMER_DIRECTORY_MAX_TEXT_LENGTH} znaki.`
    );
  }
  return value;
};

const normalizeTextArray = (value: unknown, label: string) => {
  if (!Array.isArray(value) || value.length > CUSTOMER_DIRECTORY_MAX_ARRAY_LENGTH) {
    throw new CustomerDirectoryValidationError(
      `${label} lahko vsebuje največ ${CUSTOMER_DIRECTORY_MAX_ARRAY_LENGTH} vrednosti.`
    );
  }
  return value.map((entry) => normalizeTextField(entry, label));
};

const normalizeEditableFields = (value: unknown): CustomerDirectoryEditableFields => {
  const fields = assertRecord(value, 'Podatki stranke niso veljavni.');
  const keys = Object.keys(fields);
  if (
    keys.length !== EDITABLE_FIELD_KEYS.length
    || EDITABLE_FIELD_KEYS.some((key) => !Object.hasOwn(fields, key))
  ) {
    throw new CustomerDirectoryValidationError(
      'Podatki stranke morajo vsebovati vsa urejevalna polja.'
    );
  }

  return {
    name: normalizeTextField(fields.name, 'Naziv'),
    address: normalizeTextField(fields.address, 'Naslov'),
    postalCode: normalizeTextField(fields.postalCode, 'Poštna številka'),
    city: normalizeTextField(fields.city, 'Pošta'),
    contacts: normalizeTextArray(fields.contacts, 'Kontakti'),
    emails: normalizeTextArray(fields.emails, 'E-naslovi')
  };
};

const assertUniqueIds = (ids: string[], label: string) => {
  if (new Set(ids).size !== ids.length) {
    throw new CustomerDirectoryValidationError(`${label} se ne smejo ponavljati.`);
  }
};

function normalizeMutation(value: unknown): CustomerDirectoryMutation {
  const mutation = assertRecord(value, 'Dejanje ni veljavno.');
  const operation = mutation.operation;

  if (operation === 'update-row') {
    return {
      operation,
      rowId: assertId(mutation.rowId, 'Stranka'),
      fields: normalizeEditableFields(mutation.fields),
      expectedFields: normalizeEditableFields(mutation.expectedFields)
    };
  }

  if (operation === 'add-row') {
    return {
      operation,
      rowId: assertId(mutation.rowId, 'Stranka'),
      fields: normalizeEditableFields(mutation.fields)
    };
  }

  if (operation === 'duplicate-rows') {
    if (
      !Array.isArray(mutation.rows)
      || !mutation.rows.length
      || mutation.rows.length > CUSTOMER_DIRECTORY_MAX_BATCH_SIZE
    ) {
      throw new CustomerDirectoryValidationError('Stranke za podvajanje niso veljavne.');
    }
    const rows = mutation.rows.map((value) => {
      const row = assertRecord(value, 'Stranke za podvajanje niso veljavne.');
      return {
        sourceRowId: assertId(row.sourceRowId, 'Izvorna stranka'),
        newRowId: assertId(row.newRowId, 'Nova stranka'),
        expectedFields: normalizeEditableFields(row.expectedFields)
      };
    });
    assertUniqueIds(rows.map((row) => row.sourceRowId), 'Izvorne stranke');
    assertUniqueIds(rows.map((row) => row.newRowId), 'Nove stranke');
    return { operation, rows };
  }

  if (operation === 'delete-rows') {
    if (
      !Array.isArray(mutation.rows)
      || !mutation.rows.length
      || mutation.rows.length > CUSTOMER_DIRECTORY_MAX_BATCH_SIZE
    ) {
      throw new CustomerDirectoryValidationError('Stranke za brisanje niso veljavne.');
    }
    const rows = mutation.rows.map((value) => {
      const row = assertRecord(value, 'Stranke za brisanje niso veljavne.');
      return {
        rowId: assertId(row.rowId, 'Stranka'),
        expectedFields: normalizeEditableFields(row.expectedFields)
      };
    });
    assertUniqueIds(rows.map((row) => row.rowId), 'Stranke');
    return { operation, rows };
  }

  throw new CustomerDirectoryValidationError('Neznano dejanje.');
}

const rowEditableFields = (row: CustomerDirectoryRow): CustomerDirectoryEditableFields => ({
  name: row.name,
  address: row.address,
  postalCode: row.postalCode,
  city: row.city,
  contacts: [...row.contacts],
  emails: [...row.emails]
});

const arraysMatch = (left: string[], right: string[]) =>
  left.length === right.length && left.every((entry, index) => entry === right[index]);

type EditableFieldKey = (typeof EDITABLE_FIELD_KEYS)[number];

const editableFieldMatches = (
  key: EditableFieldKey,
  left: CustomerDirectoryEditableFields,
  right: CustomerDirectoryEditableFields
) => {
  if (key === 'contacts') return arraysMatch(left.contacts, right.contacts);
  if (key === 'emails') return arraysMatch(left.emails, right.emails);
  return left[key] === right[key];
};

const editableFieldsMatch = (
  current: CustomerDirectoryEditableFields,
  expected: CustomerDirectoryEditableFields
) => EDITABLE_FIELD_KEYS.every((key) => editableFieldMatches(key, current, expected));

const changedEditableFieldKeys = (
  current: CustomerDirectoryEditableFields,
  next: CustomerDirectoryEditableFields
) => EDITABLE_FIELD_KEYS.filter((key) => !editableFieldMatches(key, current, next));

function getSnapshotConflicts(
  requestedRows: RequestedSnapshot[],
  currentRowsById: Map<string, CustomerDirectoryRow>
) {
  const conflictingRows: CustomerDirectoryRow[] = [];
  const missingRowIds: string[] = [];

  requestedRows.forEach((requestedRow) => {
    const currentRow = currentRowsById.get(requestedRow.rowId);
    if (!currentRow) {
      missingRowIds.push(requestedRow.rowId);
      return;
    }
    if (!editableFieldsMatch(rowEditableFields(currentRow), requestedRow.expectedFields)) {
      conflictingRows.push(currentRow);
    }
  });

  return { conflictingRows, missingRowIds };
}

function assertNoSnapshotConflicts(
  message: string,
  requestedRows: RequestedSnapshot[],
  currentRowsById: Map<string, CustomerDirectoryRow>
) {
  const { conflictingRows, missingRowIds } = getSnapshotConflicts(
    requestedRows,
    currentRowsById
  );
  if (conflictingRows.length || missingRowIds.length) {
    throw new CustomerDirectoryConflictError(message, conflictingRows, missingRowIds);
  }
}

async function assertNewRowIdsAvailable(
  client: PoolClient,
  rowIds: string[],
  currentRowsById: Map<string, CustomerDirectoryRow>
) {
  if (rowIds.some((rowId) => currentRowsById.has(rowId))) {
    throw new CustomerDirectoryValidationError('Ena ali več novih strank že obstaja.');
  }

  const result = await client.query(
    `select id
     from customer_directory_profiles
     where id = any($1::text[])
       or source_customer_key = any($1::text[])
     limit 1`,
    [rowIds]
  );
  if (result.rowCount) {
    throw new CustomerDirectoryValidationError('Ena ali več novih strank že obstaja.');
  }
}

async function upsertDerivedProfile(
  client: PoolClient,
  rowId: string,
  fields: CustomerDirectoryEditableFields,
  overriddenFields: readonly EditableFieldKey[],
  archived: boolean
) {
  await client.query(
    `insert into customer_directory_profiles (
       id, source_customer_key, name, address, postal_code, city, contacts, emails,
       overridden_fields, archived_at
     ) values (
       $1, $2, $3, $4, $5, $6, $7::text[], $8::text[], $9::text[],
       case when $10 then now() else null end
     )
     on conflict (source_customer_key) where source_customer_key is not null
     do update set
       name = excluded.name,
       address = excluded.address,
       postal_code = excluded.postal_code,
       city = excluded.city,
       contacts = excluded.contacts,
       emails = excluded.emails,
       overridden_fields = coalesce(
         (
           select array_agg(distinct field_name)
           from unnest(
             customer_directory_profiles.overridden_fields || excluded.overridden_fields
           ) as field_name
         ),
         array[]::text[]
       ),
       archived_at = excluded.archived_at,
       updated_at = now()`,
    [
      randomUUID(),
      rowId,
      fields.name,
      fields.address,
      fields.postalCode,
      fields.city,
      fields.contacts,
      fields.emails,
      overriddenFields,
      archived
    ]
  );
}

async function insertManualRows(
  client: PoolClient,
  rows: Array<{ id: string; fields: CustomerDirectoryEditableFields }>
) {
  const result = await client.query(
    `insert into customer_directory_profiles (
       id, source_customer_key, name, address, postal_code, city, contacts, emails
     )
     select
       entry.id,
       null,
       entry.name,
       entry.address,
       entry.postal_code,
       entry.city,
       array(select jsonb_array_elements_text(entry.contacts)),
       array(select jsonb_array_elements_text(entry.emails))
     from jsonb_to_recordset($1::jsonb) as entry(
       id text,
       name text,
       address text,
       postal_code text,
       city text,
       contacts jsonb,
       emails jsonb
     )`,
    [JSON.stringify(rows.map(({ id, fields }) => ({
      id,
      name: fields.name,
      address: fields.address,
      postal_code: fields.postalCode,
      city: fields.city,
      contacts: fields.contacts,
      emails: fields.emails
    })))]
  );
  if (result.rowCount !== rows.length) {
    throw new Error('Not all customer directory rows were inserted.');
  }
}

async function applyMutation(
  client: PoolClient,
  mutation: CustomerDirectoryMutation
): Promise<CustomerDirectoryMutationResult> {
  const currentRows = await readCustomerDirectoryRows(client);
  const currentRowsById = new Map(currentRows.map((row) => [row.id, row]));

  if (mutation.operation === 'update-row') {
    assertNoSnapshotConflicts(
      'Stranko je med urejanjem spremenil drug uporabnik.',
      [{ rowId: mutation.rowId, expectedFields: mutation.expectedFields }],
      currentRowsById
    );
    const currentRow = currentRowsById.get(mutation.rowId);
    if (!currentRow) {
      throw new CustomerDirectoryConflictError(
        'Stranka ne obstaja več.',
        [],
        [mutation.rowId]
      );
    }

    if (currentRow.origin === 'orders') {
      await upsertDerivedProfile(
        client,
        currentRow.id,
        mutation.fields,
        changedEditableFieldKeys(rowEditableFields(currentRow), mutation.fields),
        false
      );
    } else {
      const result = await client.query(
        `update customer_directory_profiles
         set
           name = $2,
           address = $3,
           postal_code = $4,
           city = $5,
           contacts = $6::text[],
           emails = $7::text[],
           updated_at = now()
         where id = $1
           and source_customer_key is null
           and archived_at is null`,
        [
          currentRow.id,
          mutation.fields.name,
          mutation.fields.address,
          mutation.fields.postalCode,
          mutation.fields.city,
          mutation.fields.contacts,
          mutation.fields.emails
        ]
      );
      if (result.rowCount !== 1) {
        throw new CustomerDirectoryConflictError(
          'Stranka ne obstaja več.',
          [],
          [currentRow.id]
        );
      }
    }

    const updatedRows = await readCustomerDirectoryRows(client);
    const updatedRow = updatedRows.find((row) => row.id === currentRow.id);
    if (!updatedRow) throw new Error('Updated customer directory row was not returned.');
    return { row: updatedRow };
  }

  if (mutation.operation === 'add-row') {
    await assertNewRowIdsAvailable(client, [mutation.rowId], currentRowsById);
    await insertManualRows(client, [{ id: mutation.rowId, fields: mutation.fields }]);
    const updatedRows = await readCustomerDirectoryRows(client);
    const row = updatedRows.find((entry) => entry.id === mutation.rowId);
    if (!row) throw new Error('Added customer directory row was not returned.');
    return { row };
  }

  if (mutation.operation === 'duplicate-rows') {
    const requestedRows = mutation.rows.map((row) => ({
      rowId: row.sourceRowId,
      expectedFields: row.expectedFields
    }));
    assertNoSnapshotConflicts(
      'Ena ali več strank se je pred podvajanjem spremenilo.',
      requestedRows,
      currentRowsById
    );
    const newRowIds = mutation.rows.map((row) => row.newRowId);
    await assertNewRowIdsAvailable(client, newRowIds, currentRowsById);

    const rowsToInsert = mutation.rows.map((requestedRow) => {
      const sourceRow = currentRowsById.get(requestedRow.sourceRowId);
      if (!sourceRow) {
        throw new CustomerDirectoryConflictError(
          'Izvorna stranka ne obstaja več.',
          [],
          [requestedRow.sourceRowId]
        );
      }
      return {
        id: requestedRow.newRowId,
        fields: normalizeEditableFields({
          ...rowEditableFields(sourceRow),
          name: `${sourceRow.name}${DUPLICATE_NAME_SUFFIX}`
        })
      };
    });
    await insertManualRows(client, rowsToInsert);
    const updatedRows = await readCustomerDirectoryRows(client);
    const updatedRowsById = new Map(updatedRows.map((row) => [row.id, row]));
    return {
      rows: newRowIds.map((rowId) => {
        const row = updatedRowsById.get(rowId);
        if (!row) throw new Error('Duplicated customer directory row was not returned.');
        return row;
      })
    };
  }

  const requestedRows = mutation.rows.map((row) => ({
    rowId: row.rowId,
    expectedFields: row.expectedFields
  }));
  assertNoSnapshotConflicts(
    'Ena ali več strank se je pred brisanjem spremenilo.',
    requestedRows,
    currentRowsById
  );

  const manualRowIds: string[] = [];
  const derivedRows: CustomerDirectoryRow[] = [];
  mutation.rows.forEach(({ rowId }) => {
    const row = currentRowsById.get(rowId);
    if (!row) {
      throw new CustomerDirectoryConflictError(
        'Stranka ne obstaja več.',
        [],
        [rowId]
      );
    }
    if (row.origin === 'manual') manualRowIds.push(row.id);
    else derivedRows.push(row);
  });

  if (manualRowIds.length) {
    const result = await client.query(
      `update customer_directory_profiles
       set archived_at = now(), updated_at = now()
       where id = any($1::text[])
         and source_customer_key is null
         and archived_at is null`,
      [manualRowIds]
    );
    if (result.rowCount !== manualRowIds.length) {
      throw new CustomerDirectoryConflictError(
        'Ene ali več strank ni bilo mogoče izbrisati.',
        [],
        manualRowIds
      );
    }
  }

  for (const row of derivedRows) {
    await upsertDerivedProfile(client, row.id, rowEditableFields(row), [], true);
  }

  return { deletedRowIds: mutation.rows.map((row) => row.rowId) };
}

export async function mutateCustomerDirectory(
  rawMutation: CustomerDirectoryMutation | unknown
): Promise<CustomerDirectoryMutationResult> {
  const mutation = normalizeMutation(rawMutation);
  const pool = await ensureCustomerDirectory();
  const client = await pool.connect();
  try {
    await client.query('begin');
    await client.query("select pg_advisory_xact_lock(hashtext('customer-directory-mutations'))");
    // Keep the order-derived snapshot stable until the profile mutation commits.
    // SHARE still allows ordinary order reads while briefly blocking order writes.
    await client.query('lock table orders in share mode');
    const result = await applyMutation(client, mutation);
    await client.query('commit');
    return result;
  } catch (error) {
    await client.query('rollback');
    throw error;
  } finally {
    client.release();
  }
}
