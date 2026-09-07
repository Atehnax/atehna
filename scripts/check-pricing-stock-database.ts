import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { Pool, type PoolClient } from 'pg';
import { readE2eEnvironment } from './e2e-database.mjs';
import { commitPricingStockBatch, commitPricingStockModel, readPricingStockModel, readPricingStockRows, PricingStockError, type PricingStockDatabase } from '../src/shared/server/pricingStockTransaction';
import { createDefaultPricingStockModel, PricingStockValidationError, previewPricingStockColumn } from '../src/shared/domain/pricingStock';
import { CatalogVariantConcurrencyConflictError, upsertCatalogItem, quickPatchCatalogVariantByIdentifier } from '../src/shared/server/catalogItems';
import { getPool } from '../src/shared/server/db';
import { commitOrderStockHolds, releaseOrderStockHolds } from '../src/shared/server/orderStockHolds';

// Explicit disposable loopback environment only; no .env loading or remote DBs.
const environment=readE2eEnvironment();
assert.match(environment.databaseName,/pricing_stock/u,'Use a dedicated pricing-stock E2E database.');
const pool=new Pool({connectionString:environment.databaseUrl,ssl:false,max:3});
const client=await pool.connect();const writer=await pool.connect();
const actor={actorId:'pricing-stock-fixture',actorName:'Test',source:'pricing-stock-database-test',requestId:randomUUID()};
let itemId:number|undefined;let ids:number[]=[];
const read=async()=>readPricingStockRows(client,await readPricingStockModel(client),ids);
const patch=async(row:Awaited<ReturnType<typeof read>>[number],values:Record<string,unknown>,revision?:string)=>commitPricingStockBatch(client,{expectedModelRevision:revision??(await readPricingStockModel(client)).revision,rows:[{variantId:row.variantId,expectedStockRevision:row.stockRevision,expectedPricingRevision:row.pricingRevision,patch:values}]},actor);
function savepointAdapter(connection:PoolClient):PricingStockDatabase {
  return {query:(sql,values)=>{
    if(sql==='begin')return connection.query('savepoint pricing_stock_operation');
    if(sql==='commit')return connection.query('release savepoint pricing_stock_operation');
    if(sql==='rollback')return connection.query('rollback to savepoint pricing_stock_operation');
    return connection.query(sql,values);
  }};
}
try {
  const identity=await client.query('select current_database() as name, host(inet_server_addr()) as address');
  assert.equal(identity.rows[0].name,environment.databaseName);
  assert.ok(['127.0.0.1','::1'].includes(identity.rows[0].address));
  const token=randomUUID();
  itemId=Number((await client.query("insert into catalog_items(item_name,item_type,status,slug) values($1,'unit','inactive',$2) returning id",['Pricing-stock fixture',`pricing-stock-${token}`])).rows[0].id);
  ids=(await client.query(`insert into catalog_item_variants(item_id,variant_name,variant_sku,price,cost_net,inventory,work_minutes,other_costs,status)
    values($1,'A',$2,20,5,10,6,1,'inactive'),($1,'B',$3,30,null,20,null,null,'inactive') returning id`,[itemId,`TEST-A-${token}`,`TEST-B-${token}`])).rows.map(row=>Number(row.id));
  await client.query("insert into catalog_item_editor_details(item_id,product_type) values($1,'dimensions')",[itemId]);
  await client.query("update catalog_items set shape='plošča',material='jeklo' where id=$1",[itemId]);
  await client.query('update catalog_item_variants set length=case when id=$1 then 100 else 50 end,width=20,thickness=5,weight=case when id=$1 then 1 else 0.5 end where item_id=$2',[ids[0],itemId]);
  let rows=await read();assert.equal(rows.length,2);
  assert.deepEqual(rows[0].sizing,{productType:'dimensions',lengthMm:'100.000',widthMm:'20.000',thicknessMm:'5.000',weightKg:'1.000',shape:'plošča',material:'jeklo'});
  const proportionalPreview=previewPricingStockColumn(rows[0],[rows[1]],'saleNet','proportional');
  assert.equal(proportionalPreview.rows[0].proposed,'10.00');assert.deepEqual(proportionalPreview.rows[0].ratio,{numerator:'1',denominator:'2'});
  assert.equal((await read())[1].saleNet,'30.00','Column preview must not write canonical values.');assert.equal(rows[1].purchaseNet,null);assert.equal(rows[1].workMinutes,null);assert.equal(rows[1].calculation.status,'missing');
  const original=rows[0];
  // A real competing transaction reserves/decrements stock while a price edit waits.
  await writer.query('begin');await writer.query('update catalog_item_variants set inventory=inventory-2 where id=$1',[ids[0]]);
  let sawRowLock!:()=>void;const rowLockAttempted=new Promise<void>(resolve=>{sawRowLock=resolve;});
  const observed:PricingStockDatabase={query:(sql,values)=>{if(sql.startsWith('select id, stock_revision::text'))sawRowLock();return client.query(sql,values);}};
  const priceSave=commitPricingStockBatch(observed,{expectedModelRevision:(await readPricingStockModel(writer)).revision,rows:[{variantId:original.variantId,expectedPricingRevision:original.pricingRevision,patch:{saleNet:'22.25'}}]},actor);
  await rowLockAttempted;await writer.query('commit');await priceSave;
  rows=await read();assert.equal(rows[0].inventory,8,'Price-only save must not overwrite concurrent stock.');assert.equal(rows[0].saleNet,'22.25');assert.notEqual(rows[0].stockRevision,original.stockRevision);
  await assert.rejects(patch(original,{inventory:15}),error=>error instanceof PricingStockError&&error.status===409&&error.details.currentRows!==undefined);
  assert.equal((await read())[0].inventory,8);
  // The existing article editor's item timestamp does not change for checkout stock;
  // its variant revision must still reject a stale full save.
  const itemVersion=(await client.query('select updated_at from catalog_items where id=$1',[itemId])).rows[0].updated_at.toISOString();
  await assert.rejects(upsertCatalogItem({id:itemId,expectedUpdatedAt:itemVersion,itemName:'Pricing-stock fixture',itemType:'unit',productType:'simple',status:'inactive',categoryPath:[],slug:`pricing-stock-${token}`,variants:[{id:ids[0],variantName:'A',price:Number((await read())[0].saleNet),inventory:original.inventory,costNet:5,expectedStockRevision:original.stockRevision,expectedPricingRevision:(await read())[0].pricingRevision}],media:[]}),error=>error instanceof CatalogVariantConcurrencyConflictError);
  await assert.rejects(quickPatchCatalogVariantByIdentifier(String(itemId),ids[0],{inventory:15,expectedStockRevision:original.stockRevision}),error=>error instanceof CatalogVariantConcurrencyConflictError);
  // ABA (8 -> 7 -> 8) still invalidates a stale stock revision.
  const beforeAba=(await read())[0];await client.query('update catalog_item_variants set inventory=7 where id=$1',[ids[0]]);await client.query('update catalog_item_variants set inventory=8 where id=$1',[ids[0]]);
  await assert.rejects(patch(beforeAba,{inventory:9}),error=>error instanceof PricingStockError&&error.status===409);
  // A conflicting row rolls back all other rows in one batch.
  rows=await read();const priceBefore=rows[1].saleNet;
  await assert.rejects(commitPricingStockBatch(client,{expectedModelRevision:(await readPricingStockModel(client)).revision,rows:[{variantId:ids[0],expectedStockRevision:beforeAba.stockRevision,patch:{inventory:9}},{variantId:ids[1],expectedPricingRevision:rows[1].pricingRevision,patch:{saleNet:'99'}}]},actor),error=>error instanceof PricingStockError&&error.status===409);
  assert.equal((await read())[1].saleNet,priceBefore);
  // Mandatory DB history survives disabled optional audit; purchase date changes only with acquisition cost.
  await client.query('begin');await client.query("update audit_settings set is_enabled=false where key='global'");
  const adapter=savepointAdapter(client);rows=await read();const purchaseBefore=rows[0].purchaseUpdatedAt;
  await commitPricingStockBatch(adapter,{expectedModelRevision:(await readPricingStockModel(client)).revision,rows:[{variantId:ids[0],expectedPricingRevision:rows[0].pricingRevision,patch:{purchaseNet:'6.10',workMinutes:'0',otherCosts:null}}]},actor);
  rows=await read();assert.equal(rows[0].purchaseNet,'6.10');assert.equal(rows[0].workMinutes,'0.0000');assert.equal(rows[0].otherCosts,null);assert.notEqual(rows[0].purchaseUpdatedAt,purchaseBefore);
  const history=(await client.query("select actor_id,source,before_json,after_json from pricing_stock_history where entity_id=$1 and source=$2 order by id desc limit 1",[String(ids[0]),actor.source])).rows[0];
  assert.equal(history.actor_id,actor.actorId);assert.equal(history.before_json.purchaseNet,'5.00');assert.equal(history.after_json.purchaseNet,'6.10');
  const costTimestamp=rows[0].purchaseUpdatedAt;
  await commitPricingStockBatch(adapter,{expectedModelRevision:(await readPricingStockModel(client)).revision,rows:[{variantId:ids[0],expectedPricingRevision:rows[0].pricingRevision,patch:{saleNet:'23'}}]},actor);
  assert.equal((await read())[0].purchaseUpdatedAt,costTimestamp);
  // Order stock limiting does not disable inventory maintenance or its safeguards.
  await client.query("update inventory_policy_settings set config_json='{\"stockEnforcementEnabled\":false}' where key='default'");
  rows=await read();const beforePolicyOffStock=rows[0];
  const savedWithPolicyOff=await commitPricingStockBatch(adapter,{expectedModelRevision:(await readPricingStockModel(client)).revision,rows:[{variantId:ids[0],expectedStockRevision:beforePolicyOffStock.stockRevision,patch:{inventory:9}}]},actor);
  const savedStock=savedWithPolicyOff.rows.find(row=>row.variantId===ids[0])!;
  assert.equal(savedStock.inventory,9);assert.equal(savedWithPolicyOff.stockEnforcementEnabled,false);assert.equal(savedWithPolicyOff.capabilities.editStock,true);
  assert.equal(BigInt(savedStock.stockRevision),BigInt(beforePolicyOffStock.stockRevision)+1n);
  assert.equal(savedStock.pricingRevision,beforePolicyOffStock.pricingRevision);
  const stockAudit=(await client.query("select actor_id,source,before_json,after_json from pricing_stock_history where entity_type='variant' and entity_id=$1 order by id desc limit 1",[String(ids[0])])).rows[0];
  assert.equal(stockAudit.actor_id,actor.actorId);assert.equal(stockAudit.source,actor.source);assert.equal(stockAudit.before_json.inventory,beforePolicyOffStock.inventory);assert.equal(stockAudit.after_json.inventory,9);
  await assert.rejects(commitPricingStockBatch(adapter,{expectedModelRevision:savedWithPolicyOff.model.revision,rows:[{variantId:ids[0],expectedStockRevision:beforePolicyOffStock.stockRevision,patch:{inventory:11}}]},actor),error=>error instanceof PricingStockError&&error.status===409);
  assert.equal((await read())[0].inventory,9,'Stale inventory is still rejected while order stock limiting is off.');
  assert.equal((await client.query("select config_json from inventory_policy_settings where key='default'")).rows[0].config_json.stockEnforcementEnabled,false,'Inventory maintenance must not enable order stock limiting.');
  await client.query('rollback');
  // Model and row drafts are one atomic operation: sale 0 -> 10 makes 1/sale valid.
  await client.query('begin');
  await client.query('update catalog_item_variants set price=1 where price=0');
  await client.query('update catalog_item_variants set price=0 where id=$1',[ids[0]]);
  const combinedPrevious=await readPricingStockModel(client);
  rows=await read();
  const combinedState=await commitPricingStockBatch(adapter,{expectedModelRevision:combinedPrevious.revision,model:{...combinedPrevious,formula:'1 / prodajna_cena'},rows:[{variantId:ids[0],expectedPricingRevision:rows[0].pricingRevision,patch:{saleNet:'10'}}]},actor);
  assert.equal(combinedState.model.formula,'1 / prodajna_cena');
  assert.equal(BigInt(combinedState.model.revision),BigInt(combinedPrevious.revision)+1n);
  const combinedRow=combinedState.rows.find(row=>row.variantId===ids[0])!;
  assert.equal(combinedRow.saleNet,'10.00');assert.equal(combinedRow.calculation.errors.length,0);
  const combinedHistory=(await client.query("select entity_type,model_revision::text from pricing_stock_history where request_id=$1 order by id desc limit 2",[actor.requestId])).rows;
  assert.deepEqual(combinedHistory.map(row=>row.entity_type),['variant','model']);
  assert.ok(combinedHistory.every(row=>row.model_revision===combinedState.model.revision),'Row history must reference the newly committed model.');
  // A concurrent stock change must reject both proposed model and row edits.
  await client.query('update catalog_item_variants set inventory=inventory-1 where id=$1',[ids[0]]);
  const combinedHistorySnapshot=async()=>({model:await readPricingStockModel(client),rows:await read(),history:(await client.query("select count(*)::text as count,encode(digest(coalesce(jsonb_agg(to_jsonb(h) order by id)::text,'[]'),'sha256'),'hex') as sha256 from pricing_stock_history h")).rows[0]});
  const beforeCombinedConflict=await combinedHistorySnapshot();
  await assert.rejects(commitPricingStockBatch(adapter,{expectedModelRevision:combinedState.model.revision,model:{...combinedState.model,formula:'2 / prodajna_cena'},rows:[{variantId:ids[0],expectedPricingRevision:combinedRow.pricingRevision,expectedStockRevision:combinedRow.stockRevision,patch:{saleNet:'11',inventory:12}}]},actor),error=>error instanceof PricingStockError&&error.status===409);
  assert.deepEqual(await combinedHistorySnapshot(),beforeCombinedConflict,'Combined conflict must preserve model, values, and mandatory history.');
  // A global formula also validates unpatched SKUs, with no partially saved model.
  await client.query('update catalog_item_variants set price=0 where id=$1',[ids[1]]);
  const beforeInvalidRemaining=await combinedHistorySnapshot();rows=await read();
  await assert.rejects(commitPricingStockBatch(adapter,{expectedModelRevision:combinedState.model.revision,model:{...combinedState.model,formula:'3 / prodajna_cena'},rows:[{variantId:ids[0],expectedPricingRevision:rows[0].pricingRevision,patch:{saleNet:'12'}}]},actor),error=>error instanceof PricingStockValidationError&&error.issues.some(issue=>issue.code==='DIVISION_BY_ZERO'));
  assert.deepEqual(await combinedHistorySnapshot(),beforeInvalidRemaining,'Invalid unpatched SKU must roll back the whole proposed save.');
  await client.query('rollback');
  // Model CAS and row-dependent division-by-zero validation do not persist global settings.
  await client.query('begin');const model=await readPricingStockModel(client);
  await client.query('update catalog_item_variants set price=0 where id=$1',[ids[0]]);
  await assert.rejects(commitPricingStockModel(adapter,{expectedRevision:model.revision,model:{...model,formula:'1 / prodajna_cena'}},actor),error=>error instanceof PricingStockValidationError&&error.issues.some(issue=>issue.code==='DIVISION_BY_ZERO'));
  await client.query('update catalog_item_variants set price=20 where id=$1',[ids[0]]);
  // Restrict the formula probe to positive sale prices throughout the disposable fixture catalogue.
  await client.query('update catalog_item_variants set price=1 where price=0');
  const savedModel=await commitPricingStockModel(adapter,{expectedRevision:model.revision,model:{...model,formula:'1 / prodajna_cena'}},actor);
  assert.equal(BigInt(savedModel.revision),BigInt(model.revision)+1n);
  await assert.rejects(commitPricingStockModel(adapter,{expectedRevision:model.revision,model:createDefaultPricingStockModel(model.revision)},actor),error=>error instanceof PricingStockError&&error.status===409);
  rows=await read();await assert.rejects(commitPricingStockBatch(adapter,{expectedModelRevision:savedModel.revision,rows:[{variantId:ids[0],expectedPricingRevision:rows[0].pricingRevision,patch:{saleNet:'0'}}]},actor),error=>error instanceof PricingStockValidationError&&error.issues.some(issue=>issue.code==='DIVISION_BY_ZERO'));
  await client.query('rollback');
  // Existing durable holds still deduct/release once; available does not subtract reservations twice.
  await client.query('begin');
  const orderId=Number((await client.query(`insert into orders(order_number,customer_type,contact_name,email,address_line1,city,postal_code,country_code,subtotal,tax,shipping,total,is_draft,commitment_status)
    values($1,'school','Fixture','pricing-fixture@example.test','Test 1','Ljubljana','1000','SI',20,4.4,0,24.4,false,'binding') returning id`,[`pricing-fixture-${token}`])).rows[0].id);
  const lineId=Number((await client.query(`insert into order_items (order_id,catalog_item_id,catalog_variant_id,sku,name,quantity,base_unit_net,unit_net,unit_tax,unit_gross,line_net,line_tax,line_gross,tax_rate)
    values($1,$2,$3,'FIXTURE','Fixture',3,20,20,4.4,24.4,60,13.2,73.2,0.22) returning id`,[orderId,itemId,ids[0]])).rows[0].id);
  assert.equal((await client.query('select historical_unit_cost_net from order_items where id=$1',[lineId])).rows[0].historical_unit_cost_net,'5.00');
  await client.query('update catalog_item_variants set cost_net=99 where id=$1',[ids[0]]);
  assert.equal((await client.query('select historical_unit_cost_net from order_items where id=$1',[lineId])).rows[0].historical_unit_cost_net,'5.00','Current purchase cost must never rewrite submitted order history.');
  await commitOrderStockHolds(client,orderId,[{variantId:ids[0],quantity:3}],{type:'admin',id:actor.actorId});
  rows=await read();assert.equal(rows[0].inventory,5);assert.equal(rows[0].available,5);assert.equal(rows[0].reserved,3);
  await commitOrderStockHolds(client,orderId,[{variantId:ids[0],quantity:3}],{type:'admin',id:actor.actorId});assert.equal((await read())[0].inventory,5);
  await releaseOrderStockHolds(client,orderId,'fixture cancelled',{type:'admin',id:actor.actorId});assert.equal((await read())[0].inventory,8);
  await releaseOrderStockHolds(client,orderId,'fixture cancelled',{type:'admin',id:actor.actorId});assert.equal((await read())[0].inventory,8);
  await client.query('rollback');
  console.info('Pricing-stock database verification passed: concurrent stock/price writes, stale and ABA rejection, atomic batch rollback, nullable inputs, mandatory history, cost timestamp, model CAS/evaluation, combined model/row success and conflict/invalid rollback, canonical sizing/column preview, historical order-cost preservation, inventory editing with order stock limiting disabled, hold deduction/release and no double subtraction.');
}finally{
  await writer.query('rollback').catch(()=>{});await client.query('rollback').catch(()=>{});
  if(itemId!==undefined)await client.query('delete from catalog_items where id=$1',[itemId]);
  client.release();writer.release();await pool.end();await(await getPool()).end();
}
