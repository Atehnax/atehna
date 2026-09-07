import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { runInNewContext } from 'node:vm';
import * as crypto from 'node:crypto';
import test from 'node:test';
import ts from 'typescript';
import * as historicalDomain from '../../src/shared/domain/order/historicalOrder';
import { isLegacyManualDraftCustomer, normalizeManualDraftCustomer } from '../../src/shared/domain/order/manualDraftCustomer';

const legacyOrder={customer_type:'company',contact_name:'Osnutek',organization_name:null,email:'draft@atehna.si',entry_source:'manual',is_draft:true};
const legacyQuote={customer_type:'company',contact_name:'Osnutek',organization_name:'Osnutek',email:'draft@atehna.si',intake_source:'admin_email',status:'received'};

test('legacy names are cleared only on generated unfinished manual customer signatures', () => {
  for (const [kind,row] of [['order',legacyOrder],['order',{...legacyOrder,is_historical:true,email:''}],['quote',legacyQuote]] as const) {
    assert.equal(isLegacyManualDraftCustomer(row,kind),true);
    const normalized=normalizeManualDraftCustomer(row,kind);
    assert.equal(normalized.contact_name,'');assert.equal(normalized.organization_name,null);assert.equal(row.contact_name,'Osnutek');
  }
  for (const patch of [{email:'real@example.test'},{address_line1:'Real street 1'},{gurs_house_number_id:'actual-gurs'},{reference:'Actual recipient'},{organization_name:'Real company'},{contact_name:'osnutek'}]) {
    for (const [kind,row] of [['order',legacyOrder],['quote',legacyQuote]] as const) {
      const original={...row,...patch};assert.equal(normalizeManualDraftCustomer(original,kind),original);
    }
  }
  for (const patch of [{is_draft:false},{entry_source:'website'},{entry_source:null},{source_quote_offer_version_id:5}]) {
    const row={...legacyOrder,...patch};assert.equal(normalizeManualDraftCustomer(row,'order'),row);
  }
  for (const patch of [{intake_source:'website'},{status:'offer_issued'},{latest_offer_status:'issued'}]) {
    const row={...legacyQuote,...patch};assert.equal(normalizeManualDraftCustomer(row,'quote'),row);
  }
});

function creationRoute(kind:'order'|'quote') {
  const statements:Array<{sql:string;params:unknown[]}>=[];
  const query=async(sql:string,params:unknown[]=[])=>{
    statements.push({sql,params});
    if(sql.includes('insert into quote_number_counters'))return {rows:[{last_request_sequence:1}]};
    if(sql.includes('insert into quote_requests'))return {rows:[{id:24,request_number:'POV-24',created_at:'2024-01-01T10:00:00Z'}]};
    if(sql.includes('insert into orders'))return {rows:[{id:24,order_number:'#24'}]};
    return {rows:[]};
  };
  const client={query,release(){}};
  const modules:Record<string,unknown>={
    'node:crypto':crypto,'next/server':{NextResponse:{json:(value:unknown,init?:ResponseInit)=>Response.json(value,init)}},
    '@/shared/domain/order/historicalOrder':historicalDomain,
    '@/shared/server/db':{getPool:async()=>({query,connect:async()=>client})},
    '@/shared/server/revalidateAdminOrders':{revalidateAdminOrderPaths(){}},
    '@/shared/server/revalidateAdminQuotes':{revalidateAdminQuotePaths(){}},
    '@/shared/server/audit':{insertAuditEventForRequest:async()=>null},
    '@/shared/server/commercePublicCode':{insertWithGeneratedCommercePublicCodeBase:async(insert:(code:string)=>Promise<{rows:unknown[]}>)=>({row:(await insert('23456789ABCDEFGH')).rows[0]})},
    '@/shared/server/quoteFeatureFlags':{isQuoteAdminEnabled:()=>true},
    '@/shared/server/requestJson':{readRequiredJsonRecord:async(request:Request)=>({ok:true,body:await request.json()})},
    '@/shared/server/orderCommerce':{normalizeOrderQuoteCustomerLabels:(labels:unknown[])=>labels.filter(Boolean),OrderCommerceError:class extends Error{}},
    '@/admin/api/quote-requests/quoteAdminRouteUtils':{hasValidQuoteAdminSession:()=>true,quoteAdminEvidence:async()=>({actorId:'admin:test',requestId:'fixture'}),appendQuoteEvent:async()=>null}
  };
  const path=kind==='order'?'src/admin/api/orders/route.ts':'src/admin/api/quote-requests/route.ts';
  const compiled=ts.transpileModule(readFileSync(resolve(path),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  const exports:{POST?:(request:Request)=>Promise<Response>}={};
  runInNewContext(compiled,{exports,require:(name:string)=>{assert(name in modules,'Unexpected creation dependency '+name);return modules[name];}});
  return {statements,send:(body:Record<string,unknown>)=>exports.POST!(new Request('http://localhost/test',{method:'POST',body:JSON.stringify(body)}))};
}

test('normal and historical manual order creation send blank contact names to persistence',async()=>{
  for(const isHistorical of [false,true]) {
    const h=creationRoute('order');const response=await h.send({isHistorical});assert.equal(response.status,200);
    const insert=h.statements.find(row=>row.sql.includes('insert into orders'))!;
    assert.equal(insert.params[5],'');assert.equal(insert.params[1],isHistorical);
    assert.match(insert.sql,/customer_type,[\s\S]*?contact_name,[\s\S]*?'company',\s*\$6,/);
    assert.match(insert.sql,/case when \$2 then '' else 'draft@atehna.si' end/);
  }
});

test('manual inquiry creation has empty customer names in both request and billing snapshot',async()=>{
  const h=creationRoute('quote');const response=await h.send({mode:'draft'});assert.equal(response.status,201,JSON.stringify(await response.clone().json()));
  const insert=h.statements.find(row=>row.sql.includes('insert into quote_requests'))!;
  assert.equal(insert.params[2],null);assert.equal(insert.params[3],'');assert.equal(insert.params[4],'draft@atehna.si');
  const snapshot=JSON.parse(String(insert.params[12]));assert.equal(snapshot.organizationName,null);assert.equal(snapshot.contactName,'');
  assert.equal(h.statements.some(row=>/insert into quote_email_jobs|insert into quote_access_tokens|insert into orders/.test(row.sql)),false);
});

test('quote issuance requires customer details but permits a real person and organization named Osnutek',()=>{
  const source=readFileSync(resolve('src/admin/api/quote-requests/[quoteRequestId]/issue/route.ts'),'utf8');
  const expression=/const customerDetailsComplete =([\s\S]*?);/.exec(source)![1];
  const complete={customerType:'company',contactName:'Osnutek',organizationName:'Osnutek',email:'real@example.test',addressLine1:'Street 1',postalCode:'1000',city:'Ljubljana',countryCode:'SI'};
  const check=(patch:Record<string,unknown>)=>runInNewContext(expression,{...complete,...patch,EMAIL_PATTERN:/^[^\s@]+@[^\s@]+\.[^\s@]+$/u,POSTAL_CODE_PATTERN:/^\d{4}$/u,ADMIN_DRAFT_EMAIL:'draft@atehna.si'});
  assert.equal(check({}),true);assert.equal(check({contactName:''}),false);assert.equal(check({organizationName:''}),false);
  assert.equal(check({email:'draft@atehna.si'}),false);assert.equal(check({addressLine1:''}),false);
});

test('normal order completion rejects blank names while preserving real Osnutek recipients',()=>{
  const source=readFileSync(resolve('src/admin/api/orders/[orderId]/details/route.ts'),'utf8');
  const segment=source.slice(source.indexOf('let draftFinalizationBlock'));
  const expression=segment.slice(segment.indexOf('isDraft &&'),segment.indexOf('? {')).trim();
  const customer={isDraft:true,normalizedContactName:'Osnutek',normalizedEmail:'real@example.test',nextAddressLine1:'Street 1',nextPostalCode:'1000',nextCity:'Ljubljana',nextCountryCode:'SI'};
  const incomplete=(patch:Record<string,unknown>)=>runInNewContext(expression,{...customer,...patch});
  assert.equal(incomplete({}),false);assert.equal(incomplete({normalizedContactName:''}),true);
  assert.equal(incomplete({normalizedEmail:'draft@atehna.si'}),true);assert.equal(incomplete({nextAddressLine1:''}),true);
});
