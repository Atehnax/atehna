import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { Pool, type PoolClient } from 'pg';
import { readE2eEnvironment } from './e2e-database.mjs';
import { loadManifest, verifyDatabaseContract, verifyRepositoryContract } from './check-database-schema.mjs';

// The existing E2E URL is only an in-memory locator for a known loopback server.
// This script never connects to or alters that source database.
const environment=readE2eEnvironment();
assert.match(environment.databaseName,/^atehna_e2e_pricing_stock_[a-z0-9_]+$/u);
assert.equal(environment.databaseIdentity.serverPort,55434);
const targetName='atehna_e2e_pricing_stock_upgrade_'+randomUUID().replaceAll('-','').slice(0,20);
assert.match(targetName,/^atehna_e2e_pricing_stock_upgrade_[a-f0-9]{20}$/u);
assert.notEqual(targetName,environment.databaseName);
const maintenanceUrl=new URL(environment.databaseUrl);maintenanceUrl.pathname='/postgres';
const targetUrl=new URL(environment.databaseUrl);targetUrl.pathname='/'+targetName;
const admin=new Pool({connectionString:maintenanceUrl.toString(),ssl:false,max:1,connectionTimeoutMillis:5000});
let target:Pool|undefined;let client:PoolClient|undefined;let createdOid:string|undefined;
const baselineRef=process.argv[2]==='--baseline' ? process.argv[3] : 'HEAD';
assert.ok(baselineRef==='HEAD'||(typeof baselineRef==='string'&&/^[a-f0-9]{40}$/u.test(baselineRef)),'Baseline must be HEAD or an explicitly reviewed full commit SHA.');
assert.ok(process.argv.length==2||(process.argv.length===4&&process.argv[2]==='--baseline'),'Usage: check-pricing-stock-upgrade.ts [--baseline <full-pre-feature-commit-sha>]');
const baseline=execFileSync('git',['show',baselineRef+':database/schema.sql'],{cwd:process.cwd(),encoding:'utf8',maxBuffer:8*1024*1024});
assert.match(baseline,/20260905\.analytics-v4/u,'HEAD must be the reviewed pre-feature canonical schema.');
assert.doesNotMatch(baseline,/create table(?: if not exists)? pricing_stock_model/u,'Refuse to call a post-feature schema the upgrade baseline.');
const newColumns=['work_minutes','other_costs','purchase_updated_at','stock_revision','pricing_revision'];
async function snapshot(connection:PoolClient) {
  const output:Record<string,unknown>={};
  // Static table names only. Capture all original columns, not merely counts.
  for(const table of ['catalog_items','catalog_item_variants','orders','order_items','order_line_snapshots','order_status_logs','order_stock_holds'] as const) {
    const value=table==='catalog_item_variants'?'to_jsonb(source_row)-$1::text[]':'to_jsonb(source_row)';
    const result=await connection.query(`select count(*)::text as count, md5(coalesce(jsonb_agg(${value} order by id)::text,'[]')) as fingerprint from ${table} source_row`,table==='catalog_item_variants'?[newColumns]:undefined);
    output[table]=result.rows[0];
  }
  return output;
}
try {
  const server=(await admin.query('select current_database() as database,current_user as username,host(inet_server_addr()) as address,inet_server_port() as port')).rows[0];
  assert.equal(server.database,'postgres');assert.equal(server.username,environment.databaseIdentity.effectiveUser);
  assert.ok(['127.0.0.1','::1'].includes(server.address));assert.equal(Number(server.port),55434);
  assert.equal((await admin.query('select 1 from pg_database where datname=$1',[targetName])).rowCount,0);
  await admin.query(`create database "${targetName}" template template0 encoding 'UTF8'`);
  createdOid=String((await admin.query('select oid::text from pg_database where datname=$1',[targetName])).rows[0].oid);
  target=new Pool({connectionString:targetUrl.toString(),ssl:false,max:1,connectionTimeoutMillis:5000});
  client=await target.connect();
  const identity=(await client.query('select current_database() as database,current_user as username,host(inet_server_addr()) as address')).rows[0];
  assert.equal(identity.database,targetName);assert.equal(identity.username,server.username);assert.equal(identity.address,server.address);
  await client.query(baseline);
  const itemId=Number((await client.query("insert into catalog_items(item_name,item_type,status,slug) values('Upgrade fixture','unit','inactive','pricing-stock-upgrade-fixture') returning id")).rows[0].id);
  const variantIds=(await client.query(`insert into catalog_item_variants(item_id,variant_name,variant_sku,price,cost_net,inventory,status)
    values($1,'Known','UPGRADE-KNOWN',12.50,7.35,13,'inactive'),($1,'Unknown','UPGRADE-UNKNOWN',0,null,0,'inactive') returning id`,[itemId])).rows.map(row=>Number(row.id));
  const orderId=Number((await client.query(`insert into orders(order_number,customer_type,organization_name,contact_name,email,address_line1,city,postal_code,country_code,subtotal,tax,shipping,total,is_draft,commitment_status)
    values('pricing-upgrade-fixture','school','Upgrade fixture','Fixture','upgrade@example.test','Test 1','Ljubljana','1000','SI',37.5,8.25,0,45.75,false,'binding') returning id`)).rows[0].id);
  const lineId=Number((await client.query(`insert into order_items(order_id,catalog_item_id,catalog_variant_id,sku,name,quantity,base_unit_net,unit_net,unit_tax,unit_gross,line_net,line_tax,line_gross,tax_rate)
    values($1,$2,$3,'UPGRADE-KNOWN','Upgrade fixture',3,12.5,12.5,2.75,15.25,37.5,8.25,45.75,0.22) returning id`,[orderId,itemId,variantIds[0]])).rows[0].id);
  await client.query("insert into order_stock_holds(order_id,catalog_variant_id,quantity,state,committed_at,committed_by_actor_type,committed_by_actor_id) values($1,$2,3,'held',now(),'admin','upgrade-fixture')",[orderId,variantIds[0]]);
  await client.query('update catalog_item_variants set inventory=inventory-3 where id=$1',[variantIds[0]]);
  const before=await snapshot(client);
  const migration=await readFile('database/migrations/20260906_pricing_stock.sql','utf8');
  await client.query(migration);
  assert.deepEqual(await snapshot(client),before,'First additive migration must preserve every original row/value.');
  const originals=await client.query('select purchase_updated_at,work_minutes,other_costs,stock_revision::text,pricing_revision::text from catalog_item_variants');
  for(const row of originals.rows)assert.deepEqual(row,{purchase_updated_at:null,work_minutes:null,other_costs:null,stock_revision:'0',pricing_revision:'0'});
  // A repeated migration must not reset an administrator's saved model.
  await client.query("update pricing_stock_model set revision=4,config_json=jsonb_set(config_json,'{parameters,targetProfit}','\"2100.00\"'::jsonb) where key='default'");
  const savedModel=(await client.query("select * from pricing_stock_model where key='default'")).rows[0];
  await client.query(migration);
  assert.deepEqual(await snapshot(client),before,'Repeated migration must preserve original money, stock, reservations and order history.');
  assert.deepEqual((await client.query("select * from pricing_stock_model where key='default'")).rows[0],savedModel);
  assert.equal(Number((await client.query('select count(*) as count from pricing_stock_history')).rows[0].count),0,'Migration must not fabricate operational audit changes.');
  await client.query(await readFile('database/migrations/20260906_schema_contract_v5.sql','utf8'));
  assert.deepEqual(await snapshot(client),before,'Terminal verification must not mutate business rows.');
  const manifest=await loadManifest();await verifyRepositoryContract(manifest);
  await client.query('begin read only');await verifyDatabaseContract(client,manifest);await client.query('rollback');
  // Only a real new purchase-cost change gets a timestamp; history stays historical.
  await client.query('update catalog_item_variants set cost_net=8.20 where id=$1',[variantIds[0]]);
  const changed=(await client.query('select purchase_updated_at,stock_revision::text,pricing_revision::text from catalog_item_variants where id=$1',[variantIds[0]])).rows[0];
  assert.ok(changed.purchase_updated_at instanceof Date);assert.equal(changed.stock_revision,'0');assert.equal(changed.pricing_revision,'1');
  assert.equal((await client.query('select historical_unit_cost_net from order_items where id=$1',[lineId])).rows[0].historical_unit_cost_net,'7.35');
  assert.equal((await client.query('select purchase_updated_at from catalog_item_variants where id=$1',[variantIds[1]])).rows[0].purchase_updated_at,null);
  await client.query('update catalog_item_variants set price=13 where id=$1',[variantIds[0]]);
  assert.deepEqual((await client.query('select purchase_updated_at from catalog_item_variants where id=$1',[variantIds[0]])).rows[0].purchase_updated_at,changed.purchase_updated_at);
  const inserted=(await client.query("insert into catalog_item_variants(item_id,variant_name,price,cost_net,inventory,status) values($1,'New',5,1.50,0,'inactive') returning purchase_updated_at,stock_revision::text,pricing_revision::text",[itemId])).rows[0];
  assert.ok(inserted.purchase_updated_at instanceof Date);assert.equal(inserted.stock_revision,'0');assert.equal(inserted.pricing_revision,'0');
  console.info('Pricing-stock upgrade verified: pre-feature HEAD schema, original row fingerprints/counts preserved, migration twice, saved model preserved, existing purchase timestamps unknown, new cost timestamps accurate, immutable order costs and live v5 schema contract.');
}finally{
  if(client){await client.query('rollback').catch(()=>{});client.release();}
  if(target)await target.end();
  if(createdOid){
    // Drop only the exact OID created by this run; never the source E2E database.
    assert.match(targetName,/^atehna_e2e_pricing_stock_upgrade_[a-f0-9]{20}$/u);
    assert.notEqual(targetName,environment.databaseName);
    const current=(await admin.query('select oid::text from pg_database where datname=$1',[targetName])).rows[0];
    assert.equal(current?.oid,createdOid,'Disposable database identity changed; automatic cleanup refused.');
    await admin.query(`drop database "${targetName}"`);
    console.info('The uniquely owned upgrade database was removed; the existing E2E database was not connected to or changed.');
  }
  await admin.end();
}
