import { randomUUID } from 'node:crypto';
import { expect, test, type APIRequestContext, type Page } from '@playwright/test';
import pg from 'pg';
import type { PricingStockState, PricingStockRow } from '@/shared/domain/pricingStock/api';
import { E2E_BASE_URL } from './support/auth';
import { pricingCell as cell, pricingReadCell as readCell, editPricingRow as editRow, expectPricingCellValue as expectCellValue } from './support/pricing-stock-ui';
const { Pool } = pg;
const variantId=920001, otherVariantId=920002;
const headers={origin:E2E_BASE_URL};
async function state(request:APIRequestContext):Promise<PricingStockState> {const response=await request.get('/api/admin/pricing-stock');expect(response.status()).toBe(200);return response.json();}
async function change(request:APIRequestContext, snapshot:PricingStockState, id:number, patch:Record<string,unknown>) {const row=snapshot.rows.find(r=>r.variantId===id)!;return request.patch('/api/admin/pricing-stock',{headers,data:{expectedModelRevision:snapshot.model.revision,rows:[{variantId:id,expectedStockRevision:row.stockRevision,expectedPricingRevision:row.pricingRevision,patch}]}});}
async function expectNoInventoryControls(page:Page) {
 await expect(page.getByRole('columnheader',{name:'Zaloga',exact:true})).toHaveCount(0);
 await expect(page.locator('input[data-pricing-cell$=":inventory"]')).toHaveCount(0);
 await expect(page.getByRole('button',{name:'Filtriraj po zalogi',exact:true})).toHaveCount(0);
 for(const mode of ['copy','proportional'])await expect(page.getByTestId('pricing-column-'+mode+'-inventory')).toHaveCount(0);
}
async function open(page:Page) {await page.goto('/admin/artikli?view=pricing-stock');await expect(page.getByTestId('pricing-stock-table')).toBeVisible({timeout:45000});await expectNoInventoryControls(page);}
async function openFormula(page:Page) {const toggle=page.getByRole('button',{name:'Uredi enačbo',exact:true});if(await toggle.isVisible())await toggle.click();}
async function save(page:Page) {const response=page.waitForResponse(r=>r.url().endsWith('/api/admin/pricing-stock')&&r.request().method()==='PATCH');await page.getByRole('button',{name:'Shrani spremembe',exact:true}).first().click();expect((await response).status()).toBe(200);await expect(page.getByTestId('pricing-stock-save-status')).toHaveText('Shranjeno');await expect(page.locator('input[data-pricing-cell]')).toHaveCount(0);}

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

 test('pricing columns and CSV omit stock while optional reservation information remains available',async({page})=>{
  await open(page);await page.getByRole('button',{name:'Filtriraj stolpce',exact:true}).click();
  const menu=page.getByRole('menu',{name:'Filtriraj stolpce',exact:true});
  await expect(menu.getByRole('checkbox',{name:'Zaloga',exact:true})).toHaveCount(0);
  for(const label of ['Rezervirano','Razpoložljivo'])await expect(menu.getByRole('checkbox',{name:label,exact:true})).toBeVisible();
  await menu.press('Escape');
  const downloaded=page.waitForEvent('download');await page.getByRole('button',{name:'Izvozi cene',exact:true}).click();
  const download=await downloaded,stream=await download.createReadStream();expect(stream).not.toBeNull();
  let csv='';for await(const chunk of stream!)csv+=String(chunk);
  const heading=csv.split(/\r?\n/,1)[0];expect(heading).toContain('Nabavna cena brez DDV');expect(heading).not.toContain('Zaloga');
 });

 test('variant-only comma edits save, reload and record actor/value audit',async({page,request})=>{
  const before=await state(request);const sibling=before.rows.find(r=>r.variantId===otherVariantId)!;
  await open(page);await editRow(page,variantId);await cell(page,variantId,'purchaseNet').fill('3,10');await cell(page,variantId,'saleNet').fill('5,00');await cell(page,variantId,'workMinutes').fill('4');
  await cell(page,variantId,'purchaseNet').focus();await page.keyboard.press('Tab');await expect(cell(page,variantId,'saleNet')).toBeFocused();await page.keyboard.press('Shift+Tab');await expect(cell(page,variantId,'purchaseNet')).toBeFocused();
  await save(page);await page.reload();await expectCellValue(page,variantId,'purchaseNet','3,10');
  const after=await state(request),row=after.rows.find(r=>r.variantId===variantId)!;
  expect(row).toMatchObject({purchaseNet:'3.10',saleNet:'5.00',workMinutes:'4.0000',calculation:{rvc:'1.90',targetRvc:'4.45',status:'below'}});
  expect(after.rows.find(r=>r.variantId===otherVariantId)).toMatchObject({saleNet:sibling.saleNet,purchaseNet:sibling.purchaseNet,inventory:sibling.inventory});
  expect(row.purchaseUpdatedAt).not.toBeNull();
  const audit=await database.query("select actor_name,source,before_json,after_json,sku from pricing_stock_history where entity_type='variant' and entity_id=$1 and source='admin/pricing-stock' order by id desc limit 1",[String(variantId)]);
  expect(audit.rows[0]).toMatchObject({actor_name:process.env.E2E_ADMIN_USERNAME,source:'admin/pricing-stock',sku:'MAT-KOV-ALU-100',before_json:{purchaseNet:'2.10'},after_json:{purchaseNet:'3.10',saleNet:'5.00',workMinutes:'4.0000'}});
 });

 test('Excel paste and selected-row edits remain drafts until saved',async({page,request})=>{
  await open(page);const before=await state(request);
  await editRow(page,variantId);await cell(page,variantId,'purchaseNet').evaluate((input,text)=>{const data=new DataTransfer();data.setData('text/plain',text);input.dispatchEvent(new ClipboardEvent('paste',{clipboardData:data,bubbles:true,cancelable:true}));},'3,10\t5,00\t4\n4,20\t9,90\t6');
  await expectCellValue(page,variantId,'purchaseNet','3,10');await expectCellValue(page,otherVariantId,'saleNet','9,90');
  expect((await state(request)).rows.find(r=>r.variantId===variantId)!.saleNet).toBe(before.rows.find(r=>r.variantId===variantId)!.saleNet);
  const row=page.getByTestId('pricing-stock-table').locator('tbody tr').filter({hasText:'MAT-KOV-ALU-100'});await row.getByRole('checkbox').check();
  await expect(page.getByTestId('pricing-stock-bulk')).toHaveCount(0);await expect(page.getByLabel('Skupinsko dejanje',{exact:true})).toHaveCount(0);await expect(page.getByLabel('Vrednost skupinske spremembe',{exact:true})).toHaveCount(0);await expect(page.getByRole('button',{name:'Predogled',exact:true})).toHaveCount(0);
  await expect(page.getByTestId('pricing-column-actions-row')).toBeVisible();
  for(const action of ['pricing-column-copy-saleNet','pricing-column-proportional-saleNet']){await expect(page.getByTestId(action)).toBeVisible();await expect(page.getByTestId(action)).toBeEnabled();}
  await cell(page,variantId,'saleNet').fill('5,50');await expectCellValue(page,otherVariantId,'saleNet','9,90');expect((await state(request)).rows).toEqual(before.rows);
  await save(page);await page.reload();await expectCellValue(page,variantId,'saleNet','5,50');await expectCellValue(page,otherVariantId,'saleNet','9,90');
  const after=await state(request);expect(after.rows.find(r=>r.variantId===variantId)).toMatchObject({purchaseNet:'3.10',saleNet:'5.50',workMinutes:'4.0000'});expect(after.rows.find(r=>r.variantId===otherVariantId)).toMatchObject({purchaseNet:'4.20',saleNet:'9.90',workMinutes:'6.0000'});
 });

 test('source controls require one visible valid source and share status-first presentation',async({page,request})=>{
  const before=await state(request);await open(page);
  await page.getByRole('button',{name:'Filtriraj po nabavni ceni',exact:true}).click();
  const priceFilter=page.getByRole('dialog',{name:'Nabavna cena brez DDV (€)',exact:true});
  const filterBounds=await priceFilter.locator('input,button').evaluateAll(controls=>controls.map(control=>{const rect=control.getBoundingClientRect();return {top:rect.top,bottom:rect.bottom,viewport:innerHeight};}));
  expect(filterBounds.length).toBe(4);for(const bounds of filterBounds){expect(bounds.top).toBeGreaterThanOrEqual(0);expect(bounds.bottom).toBeLessThanOrEqual(bounds.viewport);}
  await priceFilter.getByRole('button',{name:'Ponastavi',exact:true}).click();
  const actionRow=page.getByTestId('pricing-column-actions-row'),copy=page.getByTestId('pricing-column-copy-purchaseNet'),product=page.getByTestId('pricing-column-proportional-purchaseNet');
  const source=page.locator(`tr[data-variant-id="${variantId}"]`).getByRole('checkbox'),target=page.locator(`tr[data-variant-id="${otherVariantId}"]`).getByRole('checkbox');
  const expectClosedActions=async()=>{
   await expect(actionRow).toHaveCount(1);await expect(actionRow).toHaveAttribute('data-open','false');
   await expect(actionRow).toHaveAttribute('aria-hidden','true');await expect(actionRow).toHaveAttribute('inert','');
   await expect.poll(()=>actionRow.evaluate(row=>row.getBoundingClientRect().height)).toBeLessThanOrEqual(1);
  };
  await expectClosedActions();
  await source.check();await expect(actionRow).toHaveAttribute('data-open','true');await expect(actionRow).toHaveAttribute('aria-hidden','false');await expect(actionRow).not.toHaveAttribute('inert');
  await expect(actionRow).toBeVisible();await expect(copy).toBeEnabled();await expect(product).toBeEnabled();
  await expect(actionRow.getByText('Počisti',{exact:true})).toHaveCount(0);
  await expect(actionRow.getByRole('button')).toHaveCount(6);
  const sizes=await actionRow.getByRole('button').evaluateAll(buttons=>buttons.map(button=>{const outer=button.getBoundingClientRect(),icon=button.querySelector('svg')!.getBoundingClientRect();return {width:outer.width,height:outer.height,iconWidth:icon.width,iconHeight:icon.height};}));
  for(const size of sizes){expect(size.width).toBeCloseTo(27,1);expect(size.height).toBeCloseTo(27,1);expect(size.iconWidth).toBeCloseTo(13.5,1);expect(size.iconHeight).toBeCloseTo(13.5,1);}
  await target.check();await expectClosedActions();await target.uncheck();await expect(actionRow).toHaveAttribute('data-open','true');await expect(actionRow).toBeVisible();await expect(copy).toBeEnabled();
  await expectNoInventoryControls(page);
  const search=page.getByLabel('Poišči artikel ali SKU',{exact:true});await search.fill('MAT-KOV-ALU-200');await expect(actionRow).toBeVisible();await expect(copy).toBeDisabled();await expect(product).toBeDisabled();await expect(copy).toHaveAttribute('title',/ni med filtriranimi rezultati/);await search.fill('');
  const presentation=[];
  for(const id of ['pricing-model-save-status','pricing-stock-save-status']){
   const status=page.getByTestId(id);await expect(status).toHaveText('Shranjeno');
   presentation.push(await status.evaluate(element=>{const style=getComputedStyle(element),dot=element.firstElementChild!,rect=element.getBoundingClientRect(),buttons=Array.from(element.parentElement!.querySelectorAll('button'));return {fontSize:style.fontSize,fontWeight:style.fontWeight,gap:style.gap,dotWidth:dot.getBoundingClientRect().width,dotHeight:dot.getBoundingClientRect().height,beforeButtons:buttons.every(button=>rect.right<=button.getBoundingClientRect().left+1)};}));
  }
  expect(presentation[0]).toEqual(presentation[1]);expect(presentation[0].beforeButtons).toBe(true);
  await editRow(page,otherVariantId);await cell(page,otherVariantId,'purchaseNet').fill('napačno');await expect(cell(page,otherVariantId,'purchaseNet')).toHaveAttribute('aria-invalid','true');
  await copy.click();await expectCellValue(page,otherVariantId,'purchaseNet',before.rows.find(row=>row.variantId===variantId)!.purchaseNet!.replace('.',','));await expect(cell(page,otherVariantId,'purchaseNet')).not.toHaveAttribute('aria-invalid','true');await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByRole('button',{name:'Razveljavi',exact:true}).click();
  await editRow(page,variantId);await cell(page,variantId,'purchaseNet').fill('napačno');await expect(copy).toBeDisabled();
  await cell(page,variantId,'purchaseNet').fill(before.rows.find(row=>row.variantId===variantId)!.purchaseNet!);await cell(page,variantId,'workMinutes').fill('');
  const copyWork=page.getByTestId('pricing-column-copy-workMinutes'),productWork=page.getByTestId('pricing-column-proportional-workMinutes');await expect(copyWork).toBeDisabled();await expect(productWork).toBeDisabled();
  await cell(page,variantId,'workMinutes').fill('0');await expect(copyWork).toBeEnabled();await expect(productWork).toBeEnabled();await copyWork.click();await expectCellValue(page,otherVariantId,'workMinutes','0,0000');await expect(page.getByRole('dialog')).toHaveCount(0);
  await source.uncheck();await expectClosedActions();await expectCellValue(page,otherVariantId,'workMinutes','0,0000');
  expect((await state(request)).rows).toEqual(before.rows);
 });

 test('source copy stages each requested column only for filtered targets and preserves other drafts',async({page,request})=>{
  await database.query('update catalog_item_variants set cost_net=0 where id=920003');
  const before=await state(request),source=before.rows.find(row=>row.variantId===variantId)!,target=before.rows.find(row=>row.variantId===otherVariantId)!;
  await open(page);await page.getByLabel('Poišči artikel ali SKU',{exact:true}).fill('MAT-KOV-ALU');
  await page.getByRole('button',{name:'Filtriraj po nabavni ceni',exact:true}).click();await page.getByRole('dialog',{name:'Nabavna cena brez DDV (€)',exact:true}).getByRole('textbox',{name:'Od',exact:true}).fill('1');await page.getByRole('dialog',{name:'Nabavna cena brez DDV (€)',exact:true}).getByRole('button',{name:'Potrdi',exact:true}).click();
  await page.locator(`tr[data-variant-id="${variantId}"]`).getByRole('checkbox').check();
  await editRow(page,otherVariantId);await cell(page,otherVariantId,'workMinutes').fill('7,1234');await expect(cell(page,otherVariantId,'workMinutes')).toHaveValue('7,1234');
  const expected:Record<string,string>={purchaseNet:source.purchaseNet!,saleNet:source.saleNet!,workMinutes:source.workMinutes!};
  for(const field of ['purchaseNet','saleNet','workMinutes']){
   await page.getByTestId('pricing-column-copy-'+field).click();await expectCellValue(page,otherVariantId,field,expected[field].replace('.',','));
   await expect(page.getByRole('dialog')).toHaveCount(0);await expect(page.locator('tr[data-variant-id="920003"]')).toHaveCount(0);
   if(field==='purchaseNet')await expect(cell(page,otherVariantId,'workMinutes')).toHaveValue('7');
  }
  const unchanged=await state(request);expect(unchanged.rows.find(row=>row.variantId===otherVariantId)!.pricingRevision).toBe(target.pricingRevision);expect(unchanged.rows.find(row=>row.variantId===variantId)).toEqual(source);
  await save(page);await page.reload();const after=await state(request);expect(after.rows.find(row=>row.variantId===variantId)).toEqual(source);
  expect(after.rows.find(row=>row.variantId===otherVariantId)).toMatchObject({purchaseNet:source.purchaseNet,saleNet:source.saleNet,workMinutes:source.workMinutes,inventory:target.inventory,stockRevision:target.stockRevision});
  for(const row of before.rows.filter(row=>row.variantId!==otherVariantId))expect(after.rows.find(current=>current.variantId===row.variantId)).toEqual(row);
  await expectCellValue(page,otherVariantId,'workMinutes',source.workMinutes!.replace('.',','));
 });

 test('dimensional source proportions persist exact prices and work without scaling inventory',async({page,request})=>{
  await database.query('update catalog_item_variants set cost_net=0 where id=920003');
  const before=await state(request),source=before.rows.find(row=>row.variantId===variantId)!,target=before.rows.find(row=>row.variantId===otherVariantId)!;
  await open(page);await page.getByLabel('Poišči artikel ali SKU',{exact:true}).fill('MAT-KOV-ALU');
  await page.getByRole('button',{name:'Filtriraj po nabavni ceni',exact:true}).click();await page.getByRole('dialog',{name:'Nabavna cena brez DDV (€)',exact:true}).getByRole('textbox',{name:'Od',exact:true}).fill('1');await page.getByRole('dialog',{name:'Nabavna cena brez DDV (€)',exact:true}).getByRole('button',{name:'Potrdi',exact:true}).click();
  await page.locator(`tr[data-variant-id="${variantId}"]`).getByRole('checkbox').check();
  // Seeded dimensions are100x100x0.5 and200x200x0.5: the volume ratio is exactly4.
  const expected={purchaseNet:'8.40',saleNet:'19.60',workMinutes:'24.0000'};
  for(const field of ['purchaseNet','saleNet','workMinutes'] as const){
   await page.getByTestId('pricing-column-proportional-'+field).click();await expectCellValue(page,otherVariantId,field,expected[field].replace('.',','));await expect(page.getByRole('dialog')).toHaveCount(0);
  }
  await expectNoInventoryControls(page);await expect(page.locator('tr[data-variant-id="920003"]')).toHaveCount(0);
  const unchanged=await state(request);expect(unchanged.rows.find(row=>row.variantId===otherVariantId)!.pricingRevision).toBe(target.pricingRevision);
  let payload:Record<string,unknown>|undefined;page.on('request',req=>{if(new URL(req.url()).pathname==='/api/admin/pricing-stock'&&req.method()==='PATCH')payload=req.postDataJSON();});
  await save(page);expect(payload).toMatchObject({expectedModelRevision:before.model.revision,rows:[{variantId:otherVariantId,expectedPricingRevision:target.pricingRevision,patch:expected}]});
  expect((payload!.rows as Array<{patch:Record<string,unknown>}>)[0].patch).not.toHaveProperty('inventory');
  await page.reload();const after=await state(request);expect(after.rows.find(row=>row.variantId===variantId)).toEqual(source);
  expect(after.rows.find(row=>row.variantId===otherVariantId)).toMatchObject({...expected,inventory:target.inventory,stockRevision:target.stockRevision});
  for(const row of before.rows.filter(row=>row.variantId!==otherVariantId))expect(after.rows.find(current=>current.variantId===row.variantId)).toEqual(row);
  const audit=await database.query("select actor_name,after_json from pricing_stock_history where entity_type='variant' and entity_id=$1 and source='admin/pricing-stock' order by id desc limit 1",[String(otherVariantId)]);
  expect(audit.rows[0]).toMatchObject({actor_name:process.env.E2E_ADMIN_USERNAME,after_json:expected});
 });

 test('editable formula persists, audits and never rewrites sale prices; invalid expressions fail',async({page,request})=>{
  await open(page);const before=await state(request);const formula='drugi_spremenljivi_stroški_artikla + čas_artikla_v_minutah';await openFormula(page);await page.getByLabel('Enačba ciljne RVC',{exact:true}).fill('v + t');await expect(page.getByTestId('pricing-model-equation').getByTestId('pricing-formula-math')).toHaveAttribute('aria-label','Ciljna RVC: v + t');const savedModel=page.waitForResponse(r=>new URL(r.url()).pathname==='/api/admin/pricing-stock/model'&&r.request().method()==='PUT',{timeout:45000});await page.getByRole('button',{name:'Shrani enačbo',exact:true}).click();expect((await savedModel).status()).toBe(200);await expect(page.getByTestId('pricing-stock-save-status')).toHaveText('Shranjeno');await page.reload();await openFormula(page);await expect(page.getByLabel('Enačba ciljne RVC',{exact:true})).toHaveValue('v + t');
  const after=await state(request);expect(after.model.formula).toBe(formula);expect(after.rows.map(r=>r.saleNet)).toEqual(before.rows.map(r=>r.saleNet));expect(after.rows.find(r=>r.variantId===variantId)!.calculation.targetRvc).toBe('8.00');
  const audit=await database.query("select before_json,after_json,actor_name from pricing_stock_history where entity_type='model' order by id desc limit 1");expect(audit.rows[0].after_json.formula).toBe(formula);expect(audit.rows[0].actor_name).toBe(process.env.E2E_ADMIN_USERNAME);
  for(const invalid of ['process.exit(1)','prodajna_cena; DROP TABLE orders','neznana_spremenljivka','(1 + 2','1 / 0','ciljna_rvc + 1']){const r=await request.put('/api/admin/pricing-stock/model',{headers,data:{expectedRevision:after.model.revision,model:{...after.model,formula:invalid}}});expect(r.status(),invalid).toBe(400);}
  const zero=await request.put('/api/admin/pricing-stock/model',{headers,data:{expectedRevision:after.model.revision,model:{...after.model,parameters:{...after.model.parameters,headcount:'0'}}}});expect(zero.status()).toBe(400);
  expect((await state(request)).model.revision).toBe(after.model.revision);
 });

 test('model-only undo is accurate and a coupled formula/price draft saves atomically',async({page,request})=>{
  const before=await state(request);expect((await change(request,before,variantId,{saleNet:'0.00'})).status()).toBe(200);
  await open(page);await openFormula(page);const formula=page.getByLabel('Enačba ciljne RVC',{exact:true});const savedFormula=await formula.inputValue();
  await formula.fill('2');await expect(page.getByTestId('pricing-stock-save-status')).toHaveText('Neshranjeno');
  await expect(page.getByRole('button',{name:'Razveljavi',exact:true})).toBeEnabled();await page.getByRole('button',{name:'Razveljavi',exact:true}).click();await expect(formula).toHaveValue(savedFormula);await expect(page.getByTestId('pricing-stock-save-status')).toHaveText('Shranjeno');
  await editRow(page,variantId);await cell(page,variantId,'saleNet').fill('10,00');await formula.fill('1 / prodajna_cena');
  await expect(page.getByRole('button',{name:'Shrani enačbo',exact:true})).toBeDisabled();await expect(page.getByText('Enačba potrebuje tudi popravke vrstic.',{exact:false})).toBeVisible();
  const writes:string[]=[];page.on('request',r=>{if(r.url().includes('/api/admin/pricing-stock')&&['PATCH','PUT'].includes(r.method()))writes.push(r.method()+' '+new URL(r.url()).pathname);});
  await save(page);expect(writes).toEqual(['PATCH /api/admin/pricing-stock']);await page.reload();await openFormula(page);await expect(formula).toHaveValue('1 / s');await expectCellValue(page,variantId,'saleNet','10,00');
  const after=await state(request);expect(after.rows.find(row=>row.variantId===variantId)!.calculation.targetRvc).toBe('0.10');
  const history=await database.query("select entity_type,model_revision::text from pricing_stock_history where source='admin/pricing-stock' and model_revision=$1 and (entity_type='model' or entity_id=$2)",[after.model.revision,String(variantId)]);
  expect(history.rows.some(row=>row.entity_type==='model')).toBe(true);expect(history.rows.some(row=>row.entity_type==='variant')).toBe(true);
 });

 test('real order stock movement rejects a stale API batch without invalidating price-only drafts',async({page,request})=>{
  test.setTimeout(90000);await open(page);const before=await state(request),original=before.rows.find(r=>r.variantId===variantId)!;let orderId:number|undefined;
  await editRow(page,variantId);await cell(page,variantId,'purchaseNet').fill('3,33');
  try {
   const estimateResponse=await request.post('/api/orders/estimate',{data:{customerName:'E2E sočasna zaloga',items:[{variantId,quantity:1}]}});expect(estimateResponse.status()).toBe(200);const estimate=await estimateResponse.json();const email=`pricing-stock-${randomUUID()}@example.test`;
   const placed=await request.post('/api/orders',{headers:{'Idempotency-Key':'pricing-stock-'+randomUUID()},data:{customerType:'individual',customerName:'E2E sočasna zaloga',organizationName:'',contactName:'E2E sočasna zaloga',email,addressLine1:'Testna ulica 1',city:'Ljubljana',postalCode:'1000',countryCode:'SI',reference:'E2E-PRICING',notes:'',shippingConfigurationVersion:estimate.shippingConfigurationVersion,quoteFingerprint:estimate.quoteFingerprint,items:[{variantId,quantity:1}]}});expect(placed.status()).toBe(201);
   orderId=Number((await database.query('select id from orders where email=$1',[email])).rows[0].id);
   const current=(await state(request)).rows.find(r=>r.variantId===variantId)!;expect(current.inventory).toBe(original.inventory-1);expect(current.reserved).toBe(1);expect(current.available).toBe(current.inventory);
   const rejected=await change(request,before,variantId,{inventory:original.inventory+5,purchaseNet:'3.33'});expect(rejected.status()).toBe(409);
   const conflict=await rejected.json();expect(conflict).toMatchObject({code:'PRICING_STOCK_CONFLICT'});
   expect(conflict.currentRows.find((row:PricingStockRow)=>row.variantId===variantId)).toMatchObject({inventory:current.inventory,purchaseNet:original.purchaseNet});
   expect(conflict.conflicts).toContainEqual({variantId,fields:['inventory']});
   await expectNoInventoryControls(page);await expectCellValue(page,variantId,'purchaseNet','3,33');
   expect((await state(request)).rows.find(r=>r.variantId===variantId)).toMatchObject({inventory:current.inventory,purchaseNet:original.purchaseNet});
   // A stock-only revision change must not block or overwrite this price-only draft.
   await save(page);
   const final=(await state(request)).rows.find(r=>r.variantId===variantId)!;expect(final.inventory).toBe(current.inventory);expect(final.stockRevision).toBe(current.stockRevision);expect(final.purchaseNet).toBe('3.33');
  } finally {if(orderId)await archiveFixtureOrder(request,orderId);}
 });

 test('concurrent price changes preserve the browser draft for explicit conflict review',async({page,request})=>{
  await open(page);const before=await state(request);await editRow(page,variantId);await cell(page,variantId,'purchaseNet').fill('3,33');
  expect((await change(request,before,variantId,{purchaseNet:'4.44'})).status()).toBe(200);
  const conflictResponse=page.waitForResponse(r=>r.url().endsWith('/api/admin/pricing-stock')&&r.request().method()==='PATCH');
  await page.getByRole('button',{name:'Shrani spremembe',exact:true}).click();expect((await conflictResponse).status()).toBe(409);
  await expect(page.getByRole('region',{name:'Primerjava spremenjenih podatkov'})).toBeVisible();
  await expectCellValue(page,variantId,'purchaseNet','3,33');expect((await state(request)).rows.find(row=>row.variantId===variantId)!.purchaseNet).toBe('4.44');
  await page.getByRole('button',{name:'Posodobi osnovo in ohrani osnutek',exact:true}).click();
  await expectCellValue(page,variantId,'purchaseNet','3,33');await save(page);
  expect((await state(request)).rows.find(row=>row.variantId===variantId)).toMatchObject({purchaseNet:'3.33',inventory:before.rows.find(row=>row.variantId===variantId)!.inventory});
 });

 test('stock API editing remains available without changing order enforcement policy or exposing a pricing cell',async({page,request})=>{
  await database.query("update inventory_policy_settings set config_json=jsonb_build_object('stockEnforcementEnabled',false) where key='default'");
  await open(page);await expect(page.getByRole('switch',{name:'Omejevanje zaloge pri naročanju'})).toHaveCount(0);await expectNoInventoryControls(page);
  const before=await state(request);expect(before.stockEnforcementEnabled).toBe(false);
  const original=before.rows.find(row=>row.variantId===variantId)!;
  expect((await change(request,before,variantId,{inventory:original.inventory+7})).status()).toBe(200);await page.reload();await expectNoInventoryControls(page);
  const after=await state(request);expect(after.stockEnforcementEnabled).toBe(false);
  expect(after.rows.find(row=>row.variantId===variantId)!.inventory).toBe(original.inventory+7);
  expect(after.rows.find(row=>row.variantId===variantId)!.pricingRevision).toBe(original.pricingRevision);
  expect(after.rows.find(row=>row.variantId===variantId)!.stockRevision).not.toBe(original.stockRevision);
  const stale=await change(request,before,variantId,{inventory:original.inventory+8});expect(stale.status()).toBe(409);
  expect((await state(request)).rows.find(row=>row.variantId===variantId)!.inventory).toBe(original.inventory+7);
 });

 test('one top save status and undo accompany the visible model and explanation disclosure',async({page,request})=>{
  await open(page);const before=await state(request),status=page.getByTestId('pricing-stock-save-status');
  const saveButton=page.getByRole('button',{name:'Shrani spremembe',exact:true}),undo=page.getByRole('button',{name:'Razveljavi',exact:true});
  await expect(saveButton).toHaveCount(1);await expect(undo).toHaveCount(1);await expect(status).toHaveText('Shranjeno');
  await expect(page.getByText('Vse spremembe so shranjene',{exact:true})).toHaveCount(0);
  await expect(page.getByText(/različic[aei]? · RVC je razlika/)).toHaveCount(0);
  const bounds=await Promise.all([status.boundingBox(),undo.boundingBox(),saveButton.boundingBox(),page.getByTestId('pricing-stock-table').boundingBox()]);
  for(const box of bounds.slice(0,3))expect(box!.y+box!.height).toBeLessThanOrEqual(bounds[3]!.y);
  expect(Math.abs(bounds[0]!.y+bounds[0]!.height/2-bounds[2]!.y-bounds[2]!.height/2)).toBeLessThan(3);
  await expect(page.getByRole('button',{name:/^(Skrij|Prikaži) model$/u})).toHaveCount(0);
  await expect(page.locator('#pricing-model-body')).toBeVisible();
  const explanation=page.getByRole('button',{name:'Prikaži razlago',exact:true});
  await expect(explanation).toHaveText('');await expect(explanation.locator('svg')).toHaveCount(1);await expect(explanation).toHaveAttribute('aria-expanded','false');
  await explanation.click();await expect(page.locator('#pricing-model-definitions-body')).toBeVisible();
  await expect(page.locator('#pricing-model-body')).toBeVisible();await page.getByRole('button',{name:'Skrij razlago',exact:true}).click();
  await expect(page.locator('#pricing-model-definitions-body')).toBeHidden();await expect(page.locator('#pricing-model-body')).toBeVisible();
  await openFormula(page);const formula=page.getByLabel('Enačba ciljne RVC',{exact:true});const originalFormula=await formula.inputValue();
  await formula.fill('2');await editRow(page,variantId);await cell(page,variantId,'saleNet').fill('7,55');await expect(status).toHaveText('Neshranjeno');await expect(undo).toBeEnabled();
  await expect(page.locator('#pricing-model-body')).toBeVisible();await expect(status).toHaveText('Neshranjeno');await undo.click();
  await expect(status).toHaveText('Shranjeno');await expect(saveButton).toBeDisabled();await expect(undo).toBeDisabled();
  await expect(page.locator('#pricing-model-body')).toBeVisible();await expect(formula).toHaveValue(originalFormula);
  expect((await state(request)).model.revision).toBe(before.model.revision);
  expect((await state(request)).rows.find(row=>row.variantId===variantId)!.saleNet).toBe(before.rows.find(row=>row.variantId===variantId)!.saleNet);
 });

 test('target RVC recalculates from parameter and row drafts and identifies missing inputs',async({page,request})=>{
  await open(page);const before=await state(request),row=page.locator(`tr[data-variant-id="${variantId}"]`);
  const targetIndex=await page.getByTestId('pricing-stock-table').locator('thead th').evaluateAll(headers=>headers.findIndex(header=>header.textContent?.trim()==='Ciljna RVC'));
  expect(targetIndex).toBeGreaterThan(0);const target=row.locator('td').nth(targetIndex);
  await openFormula(page);await page.getByLabel('Enačba ciljne RVC',{exact:true}).fill('t * p / 1000');
  await expect(page.getByTestId('pricing-model-equation').getByTestId('pricing-formula-math')).toHaveAttribute('aria-label','Ciljna RVC: t * p / 1000');await expect(page.getByTestId('pricing-model-equation').getByTestId('pricing-formula-math').locator('mfrac')).toHaveCount(1);
  await page.locator('#pricing-model-targetProfit').fill('2000');await editRow(page,variantId);await cell(page,variantId,'workMinutes').fill('6');await expect(target).toHaveText('12,00 €');
  await page.locator('#pricing-model-targetProfit').fill('3000');await expect(target).toHaveText('18,00 €');
  await cell(page,variantId,'workMinutes').fill('4');await expect(target).toHaveText('12,00 €');
  await cell(page,variantId,'workMinutes').fill('');await expect(target).toHaveText('—');await expect(target.getByRole('button')).toHaveCount(0);await expect(target).toHaveAttribute('title',/Delo \/ kos/);
  await expect(page.getByTestId('pricing-model-preview-note')).toContainText('Delo / kos');
  await expect(page.getByRole('button',{name:/Dopolni podatke/})).toHaveCount(0);
  await cell(page,variantId,'workMinutes').fill('4');await expect(target).toHaveText('12,00 €');
  const after=await state(request);expect(after.model.revision).toBe(before.model.revision);expect(after.rows.find(r=>r.variantId===variantId)!.workMinutes).toBe(before.rows.find(r=>r.variantId===variantId)!.workMinutes);
  await page.getByRole('button',{name:'Razveljavi',exact:true}).click();
 });

 test('shared top and bottom pagers stay synchronized and third sort click restores API order',async({page,request})=>{
  const snapshot=await state(request);await open(page);
  const table=page.getByTestId('pricing-stock-table'),pagers=page.locator('[aria-label="Paginacija tabele"]');await expect(pagers).toHaveCount(2);
  const ids=()=>table.locator('tbody tr[data-variant-id]').evaluateAll(rows=>rows.map(row=>Number((row as HTMLElement).dataset.variantId)));
  await expect.poll(ids).toEqual(snapshot.rows.slice(0,25).map(row=>row.variantId));
  await expect.poll(()=>table.evaluate(node=>node.parentElement!.clientHeight)).toBeGreaterThanOrEqual(96);
  const price=page.getByRole('columnheader',{name:/^Prodajna cena/}),priceSort=price.getByRole('button',{name:/^Prodajna cena\s*brez DDV$/});await expect(table.locator('th[aria-sort="ascending"], th[aria-sort="descending"]')).toHaveCount(0);
  const byPrice=[...snapshot.rows].sort((a,b)=>{const left=BigInt(a.saleNet!.replace('.','')),right=BigInt(b.saleNet!.replace('.',''));return left<right?-1:left>right?1:0;});
  await priceSort.click();await expect(price).toHaveAttribute('aria-sort','ascending');await expect.poll(ids).toEqual(byPrice.slice(0,25).map(row=>row.variantId));
  await priceSort.click();await expect(price).toHaveAttribute('aria-sort','descending');
  const descending=[...snapshot.rows].sort((a,b)=>{const left=BigInt(a.saleNet!.replace('.','')),right=BigInt(b.saleNet!.replace('.',''));return left>right?-1:left<right?1:0;});
  await expect.poll(ids).toEqual(descending.slice(0,25).map(row=>row.variantId));
  await priceSort.click();await expect(table.locator('th[aria-sort="ascending"], th[aria-sort="descending"]')).toHaveCount(0);await expect.poll(ids).toEqual(snapshot.rows.slice(0,25).map(row=>row.variantId));
  await expect(priceSort.locator('svg')).toHaveCount(0);
  await pagers.first().getByRole('button',{name:/^25/}).click();await page.getByRole('option',{name:'50',exact:true}).click();
  for(const pager of [pagers.first(),pagers.last()])await expect(pager.getByRole('button',{name:/^50/})).toBeVisible();
  await expect.poll(ids).toEqual(snapshot.rows.slice(0,50).map(row=>row.variantId));
  await pagers.last().getByRole('button',{name:/^50/}).click();await page.getByRole('option',{name:'25',exact:true}).click();
  for(const pager of [pagers.first(),pagers.last()])await expect(pager.getByRole('button',{name:/^25/})).toBeVisible();
 });

 test('tabs persist through reload/back, dirty tab exit is guarded, and responsive tables remain usable',async({page})=>{
  test.setTimeout(90000);const listHydrated=page.waitForResponse(r=>new URL(r.url()).pathname==='/api/admin/categories/paths');await page.goto('/admin/artikli');expect((await listHydrated).status()).toBe(200);await page.getByRole('tab',{name:'Razlika v ceni',exact:true}).click();await expect(page).toHaveURL(/view=pricing-stock/,{timeout:45000});await expect(page.getByTestId('pricing-stock-table')).toBeVisible();await page.reload();await expect(page.getByRole('tab',{name:'Razlika v ceni',exact:true})).toHaveAttribute('aria-selected','true');
  await editRow(page,variantId);await cell(page,variantId,'saleNet').fill('7,55');await page.getByRole('tab',{name:'Seznam artiklov',exact:true}).click();const dialog=page.getByRole('dialog');await expect(dialog).toBeVisible();await dialog.getByRole('button',{name:'Nadaljuj urejanje'}).click();await expectCellValue(page,variantId,'saleNet','7,55');await page.getByRole('button',{name:'Razveljavi',exact:true}).click();
  await page.getByRole('tab',{name:'Seznam artiklov',exact:true}).click();await expect(page.getByTestId('admin-inventory-policy-control')).toBeVisible();await page.goBack();await expect(page.getByTestId('pricing-stock-table')).toBeVisible();
  for(const size of [{width:1920,height:960},{width:1366,height:768}]){
   await page.setViewportSize(size);await expect.poll(()=>page.getByTestId('pricing-stock-table').evaluate(node=>node.parentElement!.clientHeight)).toBeGreaterThanOrEqual(96);
   await readCell(page,variantId,'saleNet').scrollIntoViewIfNeeded();await expect(readCell(page,variantId,'saleNet')).toBeInViewport();
   await expect(page.locator('#pricing-model-body')).toBeVisible();
   await expect(page.getByRole('button',{name:/^(Skrij|Prikaži) model$/u})).toHaveCount(0);
   await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth)).toBeLessThanOrEqual(2);
   const saveButton=page.getByRole('button',{name:'Shrani spremembe',exact:true});await saveButton.scrollIntoViewIfNeeded();
   await expect(saveButton).toBeInViewport();await page.screenshot({path:`test-results/pricing-stock-${size.width}.png`,animations:'disabled'});
  }
 });
});
