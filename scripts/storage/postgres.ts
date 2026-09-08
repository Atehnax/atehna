import { rootCertificates } from 'node:tls';
import pg, { type Client } from 'pg';
import { canonical, ensure, hash, matchesOutboxTarget, type Config, type ObjectInfo, type OutboxIntent, type PreparedObject, type Scan } from './lifecycle';
const quote = (value: string) => `"${value.replaceAll('"', '""')}"`;
type Column = {
    name: string;
    type: string;
};
type Table = {
    schema: string;
    name: string;
    kind: string;
    columns: Column[];
};
export function databaseOptions(config: Config, database: string, environment: Record<string, string | undefined> = process.env) {
    ensure(config.databases.includes(database), 'DATABASE_NOT_IN_DECLARED_SCOPE');
    const value = environment[config.connectionEnv];
    ensure(value, 'DATABASE_CONNECTION_ENV_MISSING');
    const url = new URL(value);
    ensure(['postgres:', 'postgresql:'].includes(url.protocol) && url.hostname === config.expectedHost && Number(url.port || 5432) === config.expectedPort && config.databases.includes(decodeURIComponent(url.pathname.slice(1))), 'DATABASE_CONNECTION_IDENTITY_CHANGED');
    const local = ['127.0.0.1', 'localhost', '::1'].includes(url.hostname);
    return { host: url.hostname, port: config.expectedPort, database, user: decodeURIComponent(url.username), password: decodeURIComponent(url.password), ssl: local ? false as const : { rejectUnauthorized: true, ca: rootCertificates.join('\n') }, connectionTimeoutMillis: 15000, application_name: 'atehna-storage-lifecycle', options: '-c default_transaction_read_only=on -c statement_timeout=60000 -c lock_timeout=3000' };
}
async function connect(config: Config, database: string) {
    const options = databaseOptions(config, database), client = new pg.Client(options);
    await client.connect();
    try {
        const row = (await client.query('select current_database() as database')).rows[0];
        ensure(row.database === database, 'DATABASE_IDENTITY_MISMATCH');
        if (options.ssl !== false) {
            const stream = (client as unknown as {
                connection: {
                    stream: {
                        encrypted?: boolean;
                        authorized?: boolean;
                    };
                };
            }).connection.stream;
            ensure(stream.encrypted && stream.authorized, 'DATABASE_TLS_NOT_VERIFIED');
        }
        return client;
    }
    catch (error) {
        await client.end();
        throw error;
    }
}
export function patterns(objects: ObjectInfo[]) {
    const result: {
        id: string;
        value: string;
        mode: 'exact' | 'contains';
        possible: boolean;
    }[] = [];
    for (const object of objects) {
        const values = new Set([object.pathname, `/${object.pathname}`, object.url]);
        const url = new URL(object.url);
        values.add(`${url.origin}/${object.pathname.split('/').map(encodeURIComponent).join('/')}`);
        for (const value of [...values]) {
            values.add(encodeURIComponent(value));
            values.add(encodeURI(value));
            values.add(encodeURIComponent(encodeURIComponent(value)));
            values.add(value.replaceAll('/', '\\/'));
            values.add(Buffer.from(value).toString('base64'));
            values.add(Buffer.from(value).toString('base64url'));
        }
        for (const value of values) {
            result.push({ id: object.id, value, mode: 'exact', possible: false });
            // Strings embedded in snapshots, HTML and stored JSON must retain their objects too.
            if (value.includes('/') || value.includes('%'))
                result.push({ id: object.id, value, mode: 'contains', possible: false });
        }
        for (const id of new Set(object.pathname.match(/[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}/giu) ?? []))
            result.push({ id: object.id, value: id, mode: 'contains', possible: true });
    }
    return result;
}
export function referenceSql(source: string) {
    return `with records as materialized (${source}),
    leaves as materialized (select r.ordinal, v #>> '{}' as value from records r cross join lateral jsonb_path_query(r.payload,'strict $.** ? (@.type() == "string")') v
      union all select r.ordinal,k from records r cross join lateral jsonb_path_query(r.payload,'strict $.** ? (@.type() == "object")') o cross join lateral jsonb_object_keys(o) k),
    known as materialized (select * from jsonb_to_recordset($1::jsonb) as x(id text,value text,mode text,possible boolean)),
    matches as (select l.ordinal,k.id,k.possible from leaves l join known k on k.mode='exact' and l.value=k.value
      union select l.ordinal,k.id,k.possible from leaves l join known k on k.mode='contains' and strpos(l.value,k.value)>0)
    select id,count(distinct ordinal)::int as rows,bool_or(possible) as possible from matches group by id order by id`;
}
function officialAddresses(table: Table) {
    const required = ['gurs_house_number_id', 'street_name', 'settlement_name', 'house_number', 'house_suffix', 'postal_code', 'postal_name', 'municipality_name', 'address_line_1', 'search_text', 'source_updated_at', 'imported_at'];
    const optional = ['official_address_id', 'municipality_id', 'region_id', 'easting', 'northing'];
    return table.schema === 'public' && table.name === 'gurs_addresses' && required.every(name => table.columns.some(column => column.name === name)) && table.columns.every(column => [...required, ...optional].includes(column.name) && (['source_updated_at', 'imported_at'].includes(column.name) ? column.type === 'timestamp with time zone' : ['easting', 'northing'].includes(column.name) ? column.type === 'numeric' : column.type === 'text'));
}
async function sourceFor(client: Client, table: Table, database: string, exclusions: NonNullable<Scan['exclusions']>) {
    const relation = `${quote(table.schema)}.${quote(table.name)}`;
    let geographic = false;
    if (table.schema === 'public' && table.name === 'analytics_geography_references' && ['full_geometry_json', 'render_geometry_json'].every(name => table.columns.some(column => column.name === name && column.type === 'jsonb'))) {
        const invalid = await client.query(`select count(*)::int as rows from ${relation} where ${['full_geometry_json', 'render_geometry_json'].map(column => `jsonb_typeof(${column}->'features') is distinct from 'array' or jsonb_path_exists(${column},'lax $.features[*].geometry ? (@.type() != "object")') or jsonb_path_exists(${column},'lax $.features[*].geometry.coordinates.** ? (@.type() != "array" && @.type() != "number")')`).join(' or ')}`);
        geographic = invalid.rows[0].rows === 0;
        if (geographic)
            exclusions.push({ database, table: `${table.schema}.${table.name}`, reason: 'Coordinate leaves verified numeric; all other geography metadata retained in scan.' });
    }
    const columns = table.columns.map(column => geographic && ['full_geometry_json', 'render_geometry_json'].includes(column.name)
        ? `(t.${quote(column.name)}-'features') || jsonb_build_object('features',(select jsonb_agg((f-'geometry') || jsonb_build_object('geometry',(f->'geometry')-'coordinates')) from jsonb_array_elements(t.${quote(column.name)}->'features') f)) as ${quote(column.name)}`
        : `t.${quote(column.name)}`);
    return `select row_number() over () as ordinal,to_jsonb(r) as payload from (select ${columns.join(',')} from ${relation} t) r`;
}
const outboxPayload = (alias: string) => `to_jsonb(${alias}) || jsonb_build_object('id',${alias}.id::text,'source_order_id',${alias}.source_order_id::text,'source_document_id',${alias}.source_document_id::text,'source_product_id',${alias}.source_product_id::text)`;
export async function scanDatabases(config: Config, objects: ObjectInfo[]): Promise<Scan> {
    const result: Scan = { complete: true, issues: [], databases: [], references: {}, intents: {}, unresolvedIntents: [], exclusions: [] };
    const known = JSON.stringify(patterns(objects));
    for (const database of config.databases) {
        let client: Client | undefined;
        try {
            client = await connect(config, database);
            await client.query('begin isolation level repeatable read read only');
            await client.query("set local search_path=pg_catalog");
            await client.query('set local row_security=off');
            ensure((await client.query("select current_setting('transaction_read_only') as read_only")).rows[0].read_only === 'on', 'READ_ONLY_REQUIRED');
            const connected = (await client.query("select datname from pg_database where not datistemplate and datallowconn and has_database_privilege(datname,'CONNECT') order by datname")).rows.map(row => row.datname as string);
            if (connected.some(name => !config.databases.includes(name)))
                result.issues.push(`${database}:UNDECLARED_SHARED_CLUSTER_DATABASE`);
            const rows = (await client.query("select n.nspname as schema,c.relname as name,c.relkind as kind,a.attname as column,format_type(a.atttypid,a.atttypmod) as type from pg_class c join pg_namespace n on n.oid=c.relnamespace left join pg_attribute a on a.attrelid=c.oid and a.attnum>0 and not a.attisdropped where n.nspname<>'information_schema' and n.nspname!~'^pg_' and c.relkind in ('r','p','m','f') order by n.nspname,c.relname,a.attnum")).rows;
            const tables: Table[] = [];
            for (const row of rows) {
                let table = tables.find(table => table.schema === row.schema && table.name === row.name);
                if (!table) {
                    table = { schema: row.schema, name: row.name, kind: row.kind, columns: [] };
                    tables.push(table);
                }
                if (row.column)
                    table.columns.push({ name: row.column, type: row.type });
            }
            for (const table of tables) {
                if (officialAddresses(table)) {
                    result.exclusions!.push({ database, table: `${table.schema}.${table.name}`, reason: 'Exact official GURS source schema; address/reference values not inspected.' });
                    continue;
                }
                if (table.kind === 'f' || table.columns.some(column => !/^(?:text|jsonb?|boolean|smallint|integer|bigint|real|double precision|uuid|date|name|oid|inet|cidr|numeric(?:\(\d+(?:,\d+)?\))?|character(?: varying)?(?:\(\d+\))?|timestamp(?:\(\d+\))? (?:with|without) time zone|time(?:\(\d+\))? (?:with|without) time zone|interval)(?:\[\])*$/u.test(column.type)) || table.columns.length === 0) {
                    result.issues.push(`${database}:${table.schema}.${table.name}:UNSUPPORTED_REFERENCE_SCOPE`);
                    continue;
                }
                if (table.schema === 'public' && table.name === 'archive_blob_deletion_outbox') {
                    // Only queue rows are returned privately. Bigint IDs remain decimal strings, without JSON precision loss.
                    const targets = (await client.query(`select ${outboxPayload('t')} as row from public.archive_blob_deletion_outbox t order by id`)).rows as {
                        row: OutboxIntent['row'];
                    }[];
                    for (const { row } of targets) {
                        const exact = objects.filter(object => matchesOutboxTarget(row.blob_target, String(row.source_item_type), object));
                        if (exact.length === 1)
                            (result.intents[exact[0].id] ??= []).push({ database, row });
                        else {
                            result.unresolvedIntents!.push({ database, id: String(row.id), targetSha256: hash(row.blob_target) });
                            // Ambiguous store/path composition is a blocker, never permission to acknowledge another target.
                            for (const object of objects)
                                if (patterns([object]).some(pattern => pattern.mode === 'exact' ? row.blob_target === pattern.value : row.blob_target.includes(pattern.value)))
                                    (result.references[object.id] ??= []).push({ database, table: 'public.archive_blob_deletion_outbox.unresolved_target', rows: 1, possible: true });
                        }
                    }
                    continue;
                }
                const references = await client.query(referenceSql(await sourceFor(client, table, database, result.exclusions!)), [known]);
                for (const reference of references.rows)
                    (result.references[reference.id] ??= []).push({ database, table: `${table.schema}.${table.name}`, rows: reference.rows, possible: reference.possible });
            }
            const definitions = `select row_number() over () as ordinal,to_jsonb(r) as payload from (
        select pg_get_viewdef(c.oid,true) as definition from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname<>'information_schema' and n.nspname!~'^pg_' and c.relkind in ('v','m')
        union all select pg_get_functiondef(p.oid) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname<>'information_schema' and n.nspname!~'^pg_' and p.prokind in ('f','p')
        union all select pg_get_expr(a.adbin,a.adrelid) from pg_attrdef a join pg_class c on c.oid=a.adrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname<>'information_schema' and n.nspname!~'^pg_'
        union all select pg_get_constraintdef(k.oid,true) from pg_constraint k join pg_namespace n on n.oid=k.connamespace where n.nspname<>'information_schema' and n.nspname!~'^pg_'
        union all select pg_get_triggerdef(t.oid,true) from pg_trigger t join pg_class c on c.oid=t.tgrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname<>'information_schema' and n.nspname!~'^pg_' and not t.tgisinternal
        union all select pg_get_ruledef(r.oid,true) from pg_rewrite r join pg_class c on c.oid=r.ev_class join pg_namespace n on n.oid=c.relnamespace where n.nspname<>'information_schema' and n.nspname!~'^pg_'
        union all select coalesce(pg_get_expr(p.polqual,p.polrelid),'') || coalesce(pg_get_expr(p.polwithcheck,p.polrelid),'') from pg_policy p join pg_class c on c.oid=p.polrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname<>'information_schema' and n.nspname!~'^pg_'
      ) r`;
            for (const reference of (await client.query(referenceSql(definitions), [known])).rows)
                (result.references[reference.id] ??= []).push({ database, table: 'catalog.persisted_sql_definitions', rows: reference.rows, possible: reference.possible });
            result.databases.push({ database, tables: tables.length, readOnly: true, tlsVerified: !['127.0.0.1', 'localhost', '::1'].includes(config.expectedHost) });
            await client.query('rollback');
        }
        catch {
            result.issues.push(`${database}:REFERENCE_SCAN_FAILED`);
        }
        finally {
            if (client) {
                try {
                    await client.query('rollback');
                }
                catch { }
                await client.end();
            }
        }
    }
    result.complete = result.issues.length === 0 && result.databases.length === config.databases.length;
    return result;
}
export async function acknowledgeOutbox(config: Config, object: PreparedObject) {
    for (const database of new Set(object.intents.map(intent => intent.database))) {
        const client = await connect(config, database);
        try {
            await client.query('begin isolation level serializable read write');
            for (const intent of object.intents.filter(intent => intent.database === database)) {
                const found = await client.query(`select ${outboxPayload('t')} as row from public.archive_blob_deletion_outbox t where id=$1 for update`, [intent.row.id]);
                if (!found.rowCount)
                    continue; // Already acknowledged by a prior partial apply.
                ensure(canonical({ ...found.rows[0].row, id: String(found.rows[0].row.id) }) === canonical(intent.row), 'OUTBOX_ROW_CHANGED_PRESERVE_IT');
                await client.query('delete from public.archive_blob_deletion_outbox where id=$1 and blob_target=$2', [intent.row.id, intent.row.blob_target]);
            }
            await client.query('commit');
        }
        catch (error) {
            await client.query('rollback');
            throw error;
        }
        finally {
            await client.end();
        }
    }
}
