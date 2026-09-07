import * as manualDraftCustomer from '../../src/shared/domain/order/manualDraftCustomer';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { runInNewContext } from 'node:vm';
import test from 'node:test';
import ts from 'typescript';
import * as domain from '../../src/shared/domain/order/historicalOrder';

const baseline = () => ({
  id: 17, order_number: '#17', entry_source: 'manual', is_historical: true, is_draft: true, deleted_at: null,
  original_reference_system: 'Old ERP', original_reference: 'INV/2018/24',
  created_at: '2018-03-10T00:00:00.000Z', recorded_at: '2026-09-07T10:00:00.000Z',
  historical_fulfilled_at: null, historical_payment_at: null, historical_revision: '0', pricing_revision: 2,
  customer_type: 'individual', organization_name: null, order_code: 'N-PRESERVED-PUBLIC-CODE',
  status: 'received', payment_status: 'unpaid', contact_name: 'Historical test', subtotal: '100.00', tax: '22.00', shipping: '0.00',
  total: '122.00', merchandise_refund_net: null, refund_history_complete: false, contract_status: 'pending_seller_acceptance', commitment_status: 'binding'
});
test('historical facts preserve missing dates, costs and refund coverage; finalization is explicit', () => {
  const result = domain.normalizeHistoricalFacts({ expectedHistoricalRevision: '0', historicalStatus: 'finished', historicalPaymentStatus: 'paid' }, baseline());
  assert.equal(result.complete, false);assert.equal(result.fulfilledAt, null);assert.equal(result.paymentAt, null);
  assert.equal(result.refund, null);assert.equal(result.refundComplete, false);assert.equal(result.orderDate, baseline().created_at);
  assert.equal(Object.hasOwn(result, 'historicalUnitCost'), false);
});
test('references require both members; source names and references retain their original spelling', () => {
  assert.deepEqual(domain.historicalReference(' Old ERP ', ' INV/2018/24 '), { originalReferenceSystem: 'Old ERP', originalReference: 'INV/2018/24' });
  assert.throws(() => domain.historicalReference('ERP', null), domain.HistoricalOrderInputError);
  assert.throws(() => domain.historicalReference(null, null, true), domain.HistoricalOrderInputError);
});
test('invalid dates, future dates, precision and claimed complete refunds are rejected', () => {
  assert.throws(() => domain.historicalDate('2019-02-30', 'Datum'), domain.HistoricalOrderInputError);
  assert.throws(() => domain.historicalDate('2019-02-30T10:00:00.000Z', 'Datum'), domain.HistoricalOrderInputError);
  assert.throws(() => domain.historicalDate('2999-01-01', 'Datum'), domain.HistoricalOrderInputError);
  assert.throws(() => domain.historicalMoney('1.001', 'Znesek'), domain.HistoricalOrderInputError);
  assert.equal(domain.historicalMoney('1,20', 'Znesek'), '1.20');
  assert.throws(() => domain.normalizeHistoricalFacts({ expectedHistoricalRevision: '0', historicalRefundHistoryComplete: true }, baseline()), domain.HistoricalOrderInputError);
});
type Handler = (request: Request, orderId: number, body: Record<string, unknown>) => Promise<Response | null>;
const compiled=ts.transpileModule(readFileSync(resolve('src/shared/server/historicalOrders.ts'),'utf8'), { compilerOptions: {module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022} }).outputText;
function setup(options: { auditFailure?: boolean; duplicate?: boolean; numberConflict?: boolean; numberRace?: boolean; itemCount?: number; canonicalAddress?: Record<string, unknown>; row?: Record<string, unknown> } = {}) {
  let row: Record<string, unknown> = { ...baseline(), ...options.row }, before = { ...row };
  const sql: string[] = [];const history: unknown[][] = [];const revalidated: number[] = [];
  const client = {
    async query(query: string, params: unknown[] = []) {
      sql.push(query);
      if(query==='begin')before={...row};
      if(query==='rollback')row={...before};
      if(query.startsWith('select * from orders'))return{rows:[{...row}]};
      if(query.startsWith('select is_historical'))return{rows:[{is_historical:row.is_historical}]};
      if(query.startsWith('select count(*)'))return{rows:[{count:options.itemCount ?? 1}]};
      if(query.startsWith('select 1 from order_stock_holds'))return{rows:[],rowCount:0};
      if(query.startsWith('update orders')){
        if(options.numberRace)throw Object.assign(new Error('duplicate order number'),{code:'23505',constraint:'orders_order_number_key'});
        if(options.duplicate)throw Object.assign(new Error('duplicate'),{code:'23505',constraint:'orders_original_reference_unique'});
        const customerPatch=JSON.parse(String(params[15] ?? '{}'));
        row={...row,...customerPatch,pricing_revision:Number(row.pricing_revision)+(Number(row.shipping)!==Number(params[8]) ? 1 : 0),total:Number(row.subtotal)+Number(row.tax)+Number(params[8]),original_reference_system:params[1],original_reference:params[2],created_at:params[3],
          historical_fulfilled_at:params[4],historical_payment_at:params[5],status:params[6],payment_status:params[7],shipping:params[8],
          merchandise_refund_net:params[9],refund_history_complete:params[10],is_draft:!params[11],
          historical_revision:String(Number(row.historical_revision)+1),admin_order_notes:params[14]};
        return{rows:[{...row}]};
      }
      if(query.startsWith('insert into order_historical_changes')){
        if(options.auditFailure)throw new Error('mandatory history unavailable');
        history.push(params);
      }
      return{rows:[],rowCount:0};
    },release(){}
  };
  const modules:Record<string,unknown>={
    '@/shared/domain/order/manualDraftCustomer': manualDraftCustomer,
    'server-only':{},'next/server':{NextResponse:{json:(body:unknown,init?:ResponseInit)=>Response.json(body,init)}},
    './db':{getPool:async()=>({connect:async()=>client,query:client.query})},
    './orders':{getOrderNumberAvailability:async(value:string)=>({normalizedOrderNumber:/^#?\d+$/.test(value) ? Number(value.replace('#','')) : null,formattedOrderNumber:'#'+value.replace('#',''),isAvailable:!options.numberConflict})},
    './gursAddresses':{getGursAddressById:async()=>options.canonicalAddress ?? null},
    './audit':{getAuditActor:async()=>({actor_id:'admin:test'}),insertAuditEventForRequest:async()=>null},
    './revalidateAdminOrders':{revalidateAdminOrderPaths:(id:number)=>revalidated.push(id)},
    '@/shared/domain/order/historicalOrder':domain
  };
  const exports:{handleHistoricalOrderDetails?:Handler;rejectHistoricalOrderOperation?:(id:number)=>Promise<Response|null>}={};
  runInNewContext(compiled,{exports,require:(name:string)=>{assert(name in modules,'Unexpected lifecycle dependency '+name);return modules[name];}});
  return{send:(body:Record<string,unknown>)=>exports.handleHistoricalOrderDetails!(new Request('http://localhost/test'),17,body),
    block:()=>exports.rejectHistoricalOrderOperation!(17),state:()=>row,sql,history,revalidated};
}
test('metadata saves do not finalize; explicit completion writes original facts and mandatory history atomically',async()=>{
  const normal=setup();assert.equal((await normal.send({expectedHistoricalRevision:'0',historicalStatus:'finished'}))?.status,200);assert.equal(normal.state().is_draft,true);
  const final=setup();const response=await final.send({expectedHistoricalRevision:'0',expectedPricingRevision:2,historicalComplete:true,historicalStatus:'finished',historicalPaymentStatus:'paid',historicalShippingGross:'3,00'});
  assert.equal(response?.status,200);assert.equal(final.state().is_draft,false);assert.equal(final.state().historical_fulfilled_at,null);
  assert.equal(final.state().historical_payment_at,null);assert.equal(final.state().shipping,'3.00');assert.equal(final.state().recorded_at,baseline().recorded_at);
  assert.equal(final.history.length,1);assert(final.sql.indexOf('commit')>final.sql.findIndex(s=>s.startsWith('insert into order_historical_changes')));
  assert.equal(final.sql.some(s=>/update catalog_item_variants|insert into order_email_jobs|insert into order_documents/i.test(s)),false);
});
test('stale metadata and changed item totals reject completion before writes',async()=>{
  for(const body of [{expectedHistoricalRevision:'9',historicalComplete:true,expectedPricingRevision:2},{expectedHistoricalRevision:'0',historicalComplete:true,expectedPricingRevision:1}]){
    const h=setup();assert.equal((await h.send(body))?.status,409);assert.equal(h.sql.some(s=>s.startsWith('update orders')),false);assert.equal(h.history.length,0);
  }
});
test('mandatory history failure rolls back metadata even when ordinary audit is disabled',async()=>{
  const h=setup({auditFailure:true});await assert.rejects(h.send({expectedHistoricalRevision:'0',historicalStatus:'finished'}),/mandatory history unavailable/);
  assert.equal(h.state().status,'received');assert.equal(h.state().historical_revision,'0');assert.deepEqual(h.revalidated,[]);
});
test('duplicate original reference becomes actionable409 and rolls back',async()=>{
  const h=setup({duplicate:true});const response=await h.send({expectedHistoricalRevision:'0',historicalStatus:'finished'});
  assert.equal(response?.status,409);assert.equal((await response!.json()).code,'ORDER_ORIGINAL_REFERENCE_DUPLICATE');assert.equal(h.state().status,'received');
});
test('ordinary orders continue through existing details workflow; historical operational actions are blocked',async()=>{
  const live=setup({row:{is_historical:false}});assert.equal(await live.send({contactName:'Example'}),null);assert.equal(await live.block(),null);
  const historical=setup();assert.equal((await historical.block())?.status,409);
  assert.equal(await historical.send({contactName:'Draft customer'}),null);
  const completed=setup({row:{is_draft:false}});assert.equal((await completed.send({contactName:'Unreviewed change'}))?.status,409);
});

test('historical notes are audited with the same revision while original facts remain unchanged',async()=>{
  const h=setup({row:{is_draft:false,status:'finished',payment_status:'paid',admin_order_notes:'Old'}});
  assert.equal((await h.send({expectedHistoricalRevision:'0',historicalNotes:'New note'}))?.status,200);
  assert.equal(h.state().admin_order_notes,'New note');assert.equal(h.state().status,'finished');assert.equal(h.state().payment_status,'paid');
  assert.equal(h.state().historical_fulfilled_at,null);assert.equal(h.state().created_at,baseline().created_at);
  assert.equal(JSON.parse(h.history[0][3] as string).admin_order_notes,'Old');assert.equal(JSON.parse(h.history[0][4] as string).admin_order_notes,'New note');
  const invalid=setup();assert.equal((await invalid.send({expectedHistoricalRevision:'0',historicalNotes:'x'.repeat(10001)}))?.status,400);
});

test('date-only historical facts use Ljubljana midnight including the early local day and summer offset', context => {
  context.mock.method(Date, 'now', () => Date.parse('2026-09-06T22:30:00.000Z'));
  assert.equal(domain.historicalDate('2026-09-07', 'Datum'), '2026-09-06T22:00:00.000Z');
  assert.equal(domain.historicalDate('2018-03-12', 'Datum'), '2018-03-11T23:00:00.000Z');
  assert.equal(domain.historicalDate('2018-07-12', 'Datum'), '2018-07-11T22:00:00.000Z');
  assert.equal(domain.historicalDate('2018-07-12T15:00:00Z', 'Datum'), '2018-07-12T15:00:00.000Z');
});


test('finalized historical customer and visible facts save atomically while omitted evidence and public code stay unchanged', async () => {
  const h = setup({ row: {
    is_draft: false, historical_fulfilled_at: '2018-03-12T10:00:00.000Z', historical_payment_at: '2018-03-13T11:00:00.000Z',
    merchandise_refund_net: '12.00', refund_history_complete: true, admin_order_notes: 'Keep admin note',
    address_line1: 'Old street', postal_code: '1000', city: 'Ljubljana', country_code: 'SI', gurs_house_number_id: 'old-gurs'
  }});
  const response = await h.send({ expectedHistoricalRevision: '0', orderNumber: '42', customerType: 'company',
    organizationName: ' Original company ', contactName: ' Ana Novak ', email: ' ana@example.test ',
    addressLine1: 'New street 2', addressLine2: 'Floor 1', postalCode: '2000', city: 'Maribor', countryCode: 'si',
    reference: 'Customer reference', notes: 'Customer message', originalReferenceSystem: 'Old ERP 2', originalReference: 'INV/24',
    orderDate: '2018-03-11', historicalStatus: 'cancelled', historicalPaymentStatus: 'refunded', historicalShippingGross: '4,50' });
  assert.equal(response?.status, 200);
  assert.deepEqual(await response!.json(), {success:true,isDraft:false,historicalRevision:'1',pricingRevision:3});
  const row = h.state();
  assert.equal(row.order_number, '#42'); assert.equal(row.order_code, baseline().order_code);
  assert.equal(row.customer_type, 'company'); assert.equal(row.organization_name, 'Original company'); assert.equal(row.contact_name, 'Ana Novak');
  assert.equal(row.email, 'ana@example.test'); assert.equal(row.address_line1, 'New street 2'); assert.equal(row.address_line2, 'Floor 1');
  assert.equal(row.postal_code, '2000'); assert.equal(row.city, 'Maribor'); assert.equal(row.country_code, 'SI'); assert.equal(row.gurs_house_number_id, null);
  assert.equal(row.reference, 'Customer reference'); assert.equal(row.notes, 'Customer message'); assert.equal(row.admin_order_notes, 'Keep admin note');
  assert.equal(row.status, 'cancelled'); assert.equal(row.payment_status, 'refunded'); assert.equal(row.shipping, '4.50'); assert.equal(row.total,126.5);
  assert.equal(row.original_reference_system, 'Old ERP 2'); assert.equal(row.original_reference, 'INV/24');
  assert.equal(row.created_at, '2018-03-10T23:00:00.000Z'); assert.equal(row.recorded_at, baseline().recorded_at);
  assert.equal(row.historical_fulfilled_at, '2018-03-12T10:00:00.000Z'); assert.equal(row.historical_payment_at, '2018-03-13T11:00:00.000Z');
  assert.equal(row.merchandise_refund_net, '12.00'); assert.equal(row.refund_history_complete, true);
  assert.equal(h.history.length, 1);
  assert.equal(JSON.parse(h.history[0][3] as string).order_number, '#17'); assert.equal(JSON.parse(h.history[0][4] as string).contact_name, 'Ana Novak');
  assert.equal(h.sql.some(sql => /update catalog_item_variants|insert into order_email_jobs|insert into order_documents/i.test(sql)), false);
});

test('historical finalization validates the customer in the same transaction and preserves ordinary omissions', async () => {
  const h=setup({row:{contact_name:'Osnutek',email:'keep@example.test'}});
  const response=await h.send({expectedHistoricalRevision:'0',expectedPricingRevision:2,historicalComplete:true,contactName:'Ana Novak'});
  assert.equal(response?.status,200);assert.equal(h.state().is_draft,false);assert.equal(h.state().contact_name,'Ana Novak');assert.equal(h.state().email,'keep@example.test');
  assert.equal(h.state().pricing_revision,2);
  const empty=setup({row:{is_draft:false}});
  assert.equal((await empty.send({expectedHistoricalRevision:'0',contactName:''}))?.status,400);assert.equal(empty.history.length,0);
});

test('stale combined edits and invalid or duplicate order numbers cannot partially save customer data', async () => {
  for(const options of [{numberConflict:true},{numberRace:true}]) {
    const h=setup(options);const response=await h.send({expectedHistoricalRevision:'0',orderNumber:'42',contactName:'Changed'});
    assert.equal(response?.status,409);assert.equal((await response!.json()).code,'ORDER_NUMBER_DUPLICATE');assert.equal(h.state().contact_name,baseline().contact_name);assert.equal(h.history.length,0);
  }
  const invalid=setup();assert.equal((await invalid.send({expectedHistoricalRevision:'0',orderNumber:'invalid',contactName:'Changed'}))?.status,400);assert.equal(invalid.history.length,0);
  const stale=setup();assert.equal((await stale.send({expectedHistoricalRevision:'99',historicalShippingGross:'8.00',contactName:'Changed'}))?.status,409);
  assert.equal(stale.state().shipping,'0.00');assert.equal(stale.state().contact_name,baseline().contact_name);
  const failure=setup({auditFailure:true});await assert.rejects(failure.send({expectedHistoricalRevision:'0',contactName:'Changed'}),/mandatory history unavailable/);
  assert.equal(failure.state().contact_name,baseline().contact_name);
});

test('historical customer addresses keep canonical GURS validation and reject unsupported country or type', async () => {
  const canonicalAddress={addressLine1:'Street 1',postalCode:'1000',postalName:'Ljubljana',gursHouseNumberId:'gurs-1'};
  const body={expectedHistoricalRevision:'0',addressLine1:'Street 1',postalCode:'1000',city:'Ljubljana',countryCode:'SI',gursHouseNumberId:'gurs-1'};
  const h=setup({canonicalAddress});assert.equal((await h.send(body))?.status,200);assert.equal(h.state().gurs_house_number_id,'gurs-1');
  const blankCountry=setup();assert.equal((await blankCountry.send({expectedHistoricalRevision:'0',countryCode:''}))?.status,200);assert.equal(blankCountry.state().country_code,'');
  for(const patch of [{addressLine1:'Different 2'},{countryCode:'AT'},{countryCode:null},{customerType:'invalid'},{gursHouseNumberId:45}]) {
    const invalid=setup({canonicalAddress});assert.equal((await invalid.send({...body,...patch}))?.status,400);assert.equal(invalid.history.length,0);
  }
});

test('same displayed historical date preserves its exact stored instant', () => {
  const current={...baseline(),created_at:'2018-03-10T15:12:13.456Z'};
  const next=domain.normalizeHistoricalFacts({expectedHistoricalRevision:'0',orderDate:'2018-03-10'},current);
  assert.equal(next.orderDate,current.created_at);
});

test('editing the visible order date preserves omitted hidden dispatch evidence even when it is earlier', async () => {
  const row={is_draft:false,historical_fulfilled_at:'2018-03-12T10:00:00.000Z'};
  const h=setup({row});const response=await h.send({expectedHistoricalRevision:'0',orderDate:'2018-03-15'});
  assert.equal(response?.status,200);assert.equal(h.state().historical_fulfilled_at,row.historical_fulfilled_at);
  assert.equal(h.state().created_at,'2018-03-14T23:00:00.000Z');
  const explicit=setup({row});assert.equal((await explicit.send({expectedHistoricalRevision:'0',orderDate:'2018-03-15',historicalFulfilledAt:'2018-03-12'}))?.status,400);
  assert.equal(explicit.history.length,0);
});

test('blank and legacy generated historical customers cannot finalize, while real Osnutek identities can', async () => {
  for (const contactName of ['', 'Osnutek']) {
    const h=setup({row:{customer_type:'company',contact_name:contactName,email:''}});
    const response=await h.send({expectedHistoricalRevision:'0',expectedPricingRevision:2,historicalComplete:true});
    assert.equal(response?.status,400);assert.equal(h.state().is_draft,true);assert.equal(h.history.length,0);
  }
  const actual=setup({row:{customer_type:'company',contact_name:'Osnutek',email:'person@example.test',address_line1:'Real street 2'}});
  assert.equal((await actual.send({expectedHistoricalRevision:'0',expectedPricingRevision:2,historicalComplete:true}))?.status,200);
  assert.equal(actual.state().contact_name,'Osnutek');
});
