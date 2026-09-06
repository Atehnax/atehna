import { randomUUID } from 'node:crypto';
import { expect, test, type APIRequestContext, type Page } from '@playwright/test';
import pg from 'pg';
import type { PricingStockState, PricingStockRow } from '@/shared/domain/pricingStock/api';
import { E2E_BASE_URL } from './support/auth';
const { Pool } = pg;
const variantId=920001, otherVariantId=920002;
const headers={origin:E2E_BASE_URL};
async function state(request:APIRequestContext):Promise<PricingStockState> {const response=await request.get('/api/admin/pricing-stock');expect(response.status()).toBe(200);return response.json();}
async function change(request:APIRequestContext, snapshot:PricingStockState, id:number, patch:Record<string,unknown>) {const row=snapshot.rows.find(r=>r.variantId===id)!;return request.patch('/api/admin/pricing-stock',{headers,data:{expectedModelRevision:snapshot.model.revision,rows:[{variantId:id,expectedStockRevision:row.stockRevision,expectedPricingRevision:row.pricingRevision,patch}]}});}
function cell(page:Page,id:number,field:string) {return page.locator(`input[data-pricing-cell="${id}:${field}"]`);}
async function open(page:Page) {await page.goto('/admin/artikli?view=pricing-stock');await expect(page.getByTestId('pricing-stock-table')).toBeVisible({timeout:45000});}
async function save(page:Page,combined=false) {const response=page.waitForResponse(r=>r.url().endsWith('/api/admin/pricing-stock')&&r.request().method()==='PATCH');await page.getByRole('button',{name:'Shrani spremembe',exact:true}).first().click();expect((await response).status()).toBe(200);await expect(page.getByText(combined?'Model, cene in zaloga so shranjeni skupaj.':'Cene in zaloga so shranjene.',{exact:true})).toBeVisible();}

test.describe('persistent SKU prices, TDABC and safe stock',()=>{
 let database:InstanceType<typeof Pool>;
 let originalRows:PricingStockRow[],originalModel:PricingStockState['model'];
 let originalPolicy:{config_json:unknown;updated_at:Date}|undefined;
 test.beforeAll(async({request})=>{
  const databaseUrl=process.env.E2E_DATABASE_URL?.trim();
  if(!databaseUrl)throw new Error('[e2e-preflight] E2E_DATABASE_URL is required.');
  database=new Pool({connectionString:databaseUrl,ssl:false});
  const policy=await database.query<{config_json:unknown;updated_at:Date}>("select config_json,updated_at from inventory_policy_settings where key='default'");
  originalPolicy=policy.rows[0];
  if(!originalPolicy)throw new Error('The deterministic inventory-policy row is missing.');
  const s=await state(request);originalRows=s.rows;originalModel=s.model;
 });
 test.beforeEach(async()=>{
  await database.query("update inventory_policy_settings set config_json=jsonb_build_object('stockEnforcementEnabled',true) where key='default'");
  await database.query("update pricing_stock_model set config_json=$1::jsonb,revision=revision+1 where key='default'",[JSON.stringify(originalModel)]);
  for(const row of originalRows)await database.query('update catalog_item_variants set price=$1,cost_net=$2,inventory=$3,work_minutes=$4,other_costs=$5 where id=$6',[row.saleNet,row.purchaseNet,row.inventory,row.variantId===variantId?'6':row.workMinutes,row.variantId===variantId?'2':row.otherCosts,row.variantId]);
 });
 test.afterAll(async()=>{
  if(!database)return;
  try {
   for(const row of originalRows??[])await database.query('update catalog_item_variants set price=$1,cost_net=$2,inventory=$3,work_minutes=$4,other_costs=$5 where id=$6',[row.saleNet,row.purchaseNet,row.inventory,row.workMinutes,row.otherCosts,row.variantId]);
   if(originalModel)await database.query("update pricing_stock_model set config_json=$1::jsonb,revision=revision+1 where key='default'",[JSON.stringify(originalModel)]);
  } finally {
   try {
    if(originalPolicy)await database.query("update inventory_policy_settings set config_json=$1::jsonb,updated_at=$2 where key='default'",[JSON.stringify(originalPolicy.config_json),originalPolicy.updated_at]);
   } finally {await database.end();}
  }
 });
 async function archiveFixtureOrder(request:APIRequestContext,id:number) {
  const existing=await database.query<{status:string;deleted_at:Date|null}>('select status,deleted_at from orders where id=$1',[id]);
  if(!existing.rows[0]||existing.rows[0].deleted_at)return;
  if(existing.rows[0].status!=='cancelled') {
   const cancel=await request.post(`/api/admin/orders/${id}/status`,{data:{status:'cancelled'}});
   expect(cancel.status()).toBe(200);
  }
  await database.query("update orders set commitment_status='rejected' where id=$1",[id]);
  const archived=await request.delete(`/api/admin/orders/${id}`);
  expect(archived.status()).toBe(200);
  // Durable stock holds intentionally remain behind the normal archive guard.
  // Archived fixtures are excluded from analytics and active order/reservation lists.
  expect((await database.query('select deleted_at from orders where id=$1',[id])).rows[0]?.deleted_at).not.toBeNull();
 }


 test('private costs and writes require the admin session and same origin',async({playwright,request})=>{
  const anonymous=await playwright.request.newContext({baseURL:E2E_BASE_URL,storageState:{cookies:[],origins:[]}});
  try {for(const method of ['get','patch'] as const){const r=await anonymous[method]('/api/admin/pricing-stock');expect(r.status()).toBe(401);expect(await r.text()).not.toContain('purchaseNet');}}finally{await anonymous.dispose();}
  const s=await state(request);const r=await request.patch('/api/admin/pricing-stock',{headers:{origin:'https://example.test','sec-fetch-site':'cross-site'},data:{expectedModelRevision:s.model.revision,rows:[{variantId,expectedPricingRevision:s.rows.find(row=>row.variantId===variantId)!.pricingRevision,patch:{saleNet:'99.99'}}]}});expect(r.status(),await r.text()).toBe(403);expect((await state(request)).rows.find(row=>row.variantId===variantId)!.saleNet).toBe(s.rows.find(row=>row.variantId===variantId)!.saleNet);
  const authenticated=await request.get('/api/admin/pricing-stock');expect(authenticated.headers()['cache-control']).toContain('no-store');
 });

 test('variant-only comma edits save, reload and record actor/value audit',async({page,request})=>{
  const before=await state(request);const sibling=before.rows.find(r=>r.variantId===otherVariantId)!;
  await open(page);await cell(page,variantId,'purchaseNet').fill('3,10');await cell(page,variantId,'saleNet').fill('5,00');await cell(page,variantId,'workMinutes').fill('4');
  await cell(page,variantId,'purchaseNet').focus();await page.keyboard.press('Tab');await expect(cell(page,variantId,'saleNet')).toBeFocused();await page.keyboard.press('Shift+Tab');await expect(cell(page,variantId,'purchaseNet')).toBeFocused();
  await save(page);await page.reload();await expect(cell(page,variantId,'purchaseNet')).toHaveValue('3,10');
  const after=await state(request),row=after.rows.find(r=>r.variantId===variantId)!;
  expect(row).toMatchObject({purchaseNet:'3.10',saleNet:'5.00',workMinutes:'4.0000',calculation:{rvc:'1.90',targetRvc:'4.45',status:'below'}});
  expect(after.rows.find(r=>r.variantId===otherVariantId)).toMatchObject({saleNet:sibling.saleNet,purchaseNet:sibling.purchaseNet,inventory:sibling.inventory});
  expect(row.purchaseUpdatedAt).not.toBeNull();
  const audit=await database.query("select actor_name,source,before_json,after_json,sku from pricing_stock_history where entity_type='variant' and entity_id=$1 and source='admin/pricing-stock' order by id desc limit 1",[String(variantId)]);
  expect(audit.rows[0]).toMatchObject({actor_name:process.env.ADMIN_USERNAME,source:'admin/pricing-stock',sku:'MAT-KOV-ALU-100',before_json:{purchaseNet:'2.10'},after_json:{purchaseNet:'3.10',saleNet:'5.00',workMinutes:'4.0000'}});
 });

 test('Excel paste and bulk preview remain drafts until saved',async({page,request})=>{
  await open(page);const before=await state(request);
  await cell(page,variantId,'purchaseNet').evaluate((input,text)=>{const data=new DataTransfer();data.setData('text/plain',text);input.dispatchEvent(new ClipboardEvent('paste',{clipboardData:data,bubbles:true,cancelable:true}));},'3,10\t5,00\t4\n4,20\t9,90\t6');
  await expect(cell(page,variantId,'purchaseNet')).toHaveValue('3,10');await expect(cell(page,otherVariantId,'saleNet')).toHaveValue('9,90');
  expect((await state(request)).rows.find(r=>r.variantId===variantId)!.saleNet).toBe(before.rows.find(r=>r.variantId===variantId)!.saleNet);
  const row=page.getByTestId('pricing-stock-table').locator('tbody tr').filter({hasText:'MAT-KOV-ALU-100'});await row.getByRole('checkbox').check();
  await page.getByLabel('Skupinsko dejanje').selectOption('sale-adjust-percent');await page.getByLabel('Vrednost skupinske spremembe').fill('10');await page.getByRole('button',{name:'Predogled',exact:true}).click();
  const preview=page.getByRole('dialog');await expect(preview).toContainText('Trenutno');await expect(preview).toContainText('Predlagano');await expect(preview).toContainText(/zaokroževanj/iu);await expect(preview).toContainText('5,50');await preview.getByRole('button',{name:'Uporabi v osnutku'}).click();
  await expect(cell(page,variantId,'saleNet')).toHaveValue('5,50');await save(page);expect((await state(request)).rows.find(r=>r.variantId===variantId)!.saleNet).toBe('5.50');
 });

 test('editable formula persists, audits and never rewrites sale prices; invalid expressions fail',async({page,request})=>{
  await open(page);const before=await state(request);const formula='drugi_spremenljivi_stroški_artikla + čas_artikla_v_minutah';await page.getByLabel('Enačba ciljne RVC ⓘ',{exact:true}).fill(formula);const savedModel=page.waitForResponse(r=>new URL(r.url()).pathname==='/api/admin/pricing-stock/model'&&r.request().method()==='PUT',{timeout:45000});await page.getByRole('button',{name:'Shrani enačbo',exact:true}).click();expect((await savedModel).status()).toBe(200);await expect(page.getByText('Enačba in parametri so shranjeni. Prodajne cene so ostale enake.',{exact:true})).toBeVisible();await page.reload();await expect(page.getByLabel('Enačba ciljne RVC ⓘ',{exact:true})).toHaveValue(formula);
  const after=await state(request);expect(after.rows.map(r=>r.saleNet)).toEqual(before.rows.map(r=>r.saleNet));expect(after.rows.find(r=>r.variantId===variantId)!.calculation.targetRvc).toBe('8.00');
  const audit=await database.query("select before_json,after_json,actor_name from pricing_stock_history where entity_type='model' order by id desc limit 1");expect(audit.rows[0].after_json.formula).toBe(formula);expect(audit.rows[0].actor_name).toBe(process.env.ADMIN_USERNAME);
  for(const invalid of ['process.exit(1)','prodajna_cena; DROP TABLE orders','neznana_spremenljivka','(1 + 2','1 / 0','ciljna_rvc + 1']){const r=await request.put('/api/admin/pricing-stock/model',{headers,data:{expectedRevision:after.model.revision,model:{...after.model,formula:invalid}}});expect(r.status(),invalid).toBe(400);}
  const zero=await request.put('/api/admin/pricing-stock/model',{headers,data:{expectedRevision:after.model.revision,model:{...after.model,parameters:{...after.model.parameters,headcount:'0'}}}});expect(zero.status()).toBe(400);
  expect((await state(request)).model.revision).toBe(after.model.revision);
 });

 test('model-only undo is accurate and a coupled formula/price draft saves atomically',async({page,request})=>{
  const before=await state(request);expect((await change(request,before,variantId,{saleNet:'0.00'})).status()).toBe(200);
  await open(page);const formula=page.getByLabel('Enačba ciljne RVC ⓘ',{exact:true});const savedFormula=await formula.inputValue();
  await formula.fill('2');await expect(page.getByText('Neshranjen model',{exact:true})).toBeVisible();
  await expect(page.getByRole('button',{name:'Razveljavi',exact:true})).toBeEnabled();await page.getByRole('button',{name:'Razveljavi',exact:true}).click();await expect(formula).toHaveValue(savedFormula);await expect(page.getByText('Neshranjen model',{exact:true})).toHaveCount(0);
  await cell(page,variantId,'saleNet').fill('10,00');await formula.fill('1 / prodajna_cena');
  await expect(page.getByRole('button',{name:'Shrani enačbo',exact:true})).toBeDisabled();await expect(page.getByText('Enačba potrebuje tudi popravke vrstic.',{exact:false})).toBeVisible();
  const writes:string[]=[];page.on('request',r=>{if(r.url().includes('/api/admin/pricing-stock')&&['PATCH','PUT'].includes(r.method()))writes.push(r.method()+' '+new URL(r.url()).pathname);});
  await save(page,true);expect(writes).toEqual(['PATCH /api/admin/pricing-stock']);await page.reload();await expect(formula).toHaveValue('1 / prodajna_cena');await expect(cell(page,variantId,'saleNet')).toHaveValue('10,00');
  const after=await state(request);expect(after.rows.find(row=>row.variantId===variantId)!.calculation.targetRvc).toBe('0.10');
  const history=await database.query("select entity_type,model_revision::text from pricing_stock_history where source='admin/pricing-stock' and model_revision=$1 and (entity_type='model' or entity_id=$2)",[after.model.revision,String(variantId)]);
  expect(history.rows.some(row=>row.entity_type==='model')).toBe(true);expect(history.rows.some(row=>row.entity_type==='variant')).toBe(true);
 });

 test('real order stock movement rejects stale batch and preserves other drafts for review',async({page,request})=>{
  test.setTimeout(90000);await open(page);const before=await state(request),original=before.rows.find(r=>r.variantId===variantId)!;let orderId:number|undefined;
  await cell(page,variantId,'inventory').fill(String(original.inventory+5));await cell(page,variantId,'purchaseNet').fill('3,33');
  try {
   const estimateResponse=await request.post('/api/orders/estimate',{data:{customerName:'E2E sočasna zaloga',items:[{variantId,quantity:1}]}});expect(estimateResponse.status()).toBe(200);const estimate=await estimateResponse.json();const email=`pricing-stock-${randomUUID()}@example.test`;
   const placed=await request.post('/api/orders',{headers:{'Idempotency-Key':'pricing-stock-'+randomUUID()},data:{customerType:'individual',customerName:'E2E sočasna zaloga',organizationName:'',contactName:'E2E sočasna zaloga',email,addressLine1:'Testna ulica 1',city:'Ljubljana',postalCode:'1000',countryCode:'SI',reference:'E2E-PRICING',notes:'',shippingConfigurationVersion:estimate.shippingConfigurationVersion,quoteFingerprint:estimate.quoteFingerprint,items:[{variantId,quantity:1}]}});expect(placed.status()).toBe(201);
   orderId=Number((await database.query('select id from orders where email=$1',[email])).rows[0].id);
   const current=(await state(request)).rows.find(r=>r.variantId===variantId)!;expect(current.inventory).toBe(original.inventory-1);expect(current.reserved).toBe(1);expect(current.available).toBe(current.inventory);
   const conflictResponse=page.waitForResponse(r=>r.url().endsWith('/api/admin/pricing-stock')&&r.request().method()==='PATCH');await page.getByRole('button',{name:'Shrani spremembe',exact:true}).first().click();expect((await conflictResponse).status()).toBe(409);
   await expect(page.getByRole('region',{name:'Primerjava spremenjenih podatkov'})).toContainText(String(current.inventory));await expect(cell(page,variantId,'purchaseNet')).toHaveValue('3,33');expect((await state(request)).rows.find(r=>r.variantId===variantId)!.purchaseNet).toBe(original.purchaseNet);
   await page.getByRole('button',{name:'Prevzemi trenutno zalogo'}).click();await expect(cell(page,variantId,'inventory')).toHaveValue(String(current.inventory));await expect(cell(page,variantId,'purchaseNet')).toHaveValue('3,33');await save(page);
   const final=(await state(request)).rows.find(r=>r.variantId===variantId)!;expect(final.inventory).toBe(current.inventory);expect(final.purchaseNet).toBe('3.33');
  } finally {if(orderId)await archiveFixtureOrder(request,orderId);}
 });

 test('stock toggle can be disabled and re-enabled and API rejects stock editing while off',async({page,request})=>{
  await open(page);const toggle=page.getByRole('switch');await toggle.click();await expect(cell(page,variantId,'inventory')).toBeDisabled();const s=await state(request);expect(s.stockEnforcementEnabled).toBe(false);expect((await change(request,s,variantId,{inventory:50})).status()).toBe(409);await expect(toggle).toBeEnabled();await toggle.click();await expect(cell(page,variantId,'inventory')).toBeEnabled();expect((await state(request)).stockEnforcementEnabled).toBe(true);
 });

 test('tabs persist through reload/back, dirty tab exit is guarded, and desktop layouts scroll only table',async({page})=>{
  const listHydrated=page.waitForRequest(r=>new URL(r.url()).pathname==='/api/admin/categories/paths');await page.goto('/admin/artikli');await listHydrated;await page.getByRole('tab',{name:'Cene in zaloga',exact:true}).click();await expect(page).toHaveURL(/view=pricing-stock/);await expect(page.getByTestId('pricing-stock-table')).toBeVisible();await page.reload();await expect(page.getByRole('tab',{name:'Cene in zaloga',exact:true})).toHaveAttribute('aria-selected','true');
  await cell(page,variantId,'saleNet').fill('7,55');await page.getByRole('tab',{name:'Seznam artiklov',exact:true}).click();const dialog=page.getByRole('dialog');await expect(dialog).toBeVisible();await dialog.getByRole('button',{name:'Nadaljuj urejanje'}).click();await expect(cell(page,variantId,'saleNet')).toHaveValue('7,55');await page.getByRole('button',{name:'Razveljavi',exact:true}).click();
  await page.getByRole('tab',{name:'Seznam artiklov',exact:true}).click();await expect(page.getByTestId('admin-inventory-policy-control')).toBeVisible();await page.goBack();await expect(page.getByTestId('pricing-stock-table')).toBeVisible();
  for(const size of [{width:1920,height:960},{width:1366,height:768}]){await page.setViewportSize(size);await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollHeight-document.documentElement.clientHeight)).toBeLessThanOrEqual(2);await expect(page.getByRole('button',{name:'Shrani spremembe',exact:true}).first()).toBeInViewport();await expect(cell(page,variantId,'saleNet')).toBeInViewport();await page.screenshot({path:`test-results/pricing-stock-${size.width}.png`});}
 });
});
