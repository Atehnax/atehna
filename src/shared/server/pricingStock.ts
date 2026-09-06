import 'server-only';
import { getPool } from '@/shared/server/db';
import { getAuditActor, getAuditRequestContext } from '@/shared/server/audit';
import { revalidateTag } from '@/shared/server/diagnostics/cache';
import { CATALOG_PUBLIC_TAG, CATALOG_ADMIN_TAG } from '@/shared/server/catalogCache';
import { commitPricingStockBatch, commitPricingStockModel, readPricingStockState, type PricingStockAuditContext } from './pricingStockTransaction';

async function auditContext(request:Request):Promise<PricingStockAuditContext> {
  const actor=await getAuditActor(request);const context=getAuditRequestContext(request);
  return {actorId:actor.actor_id,actorName:actor.actor_name,source:'admin/pricing-stock',requestId:context.requestId};
}
export async function getPricingStockState() {
  const client=await (await getPool()).connect();
  try {await client.query('begin isolation level repeatable read read only');const result=await readPricingStockState(client);await client.query('commit');return result;}
  catch(error){await client.query('rollback');throw error;}finally{client.release();}
}
export async function savePricingStockRows(input:unknown,request:Request) {
  const context=await auditContext(request);const client=await(await getPool()).connect();
  try {
    const result=await commitPricingStockBatch(client,input,context);
    try {revalidateTag(CATALOG_PUBLIC_TAG,{expire:0});revalidateTag(CATALOG_ADMIN_TAG,{expire:0});} catch {console.error('Pricing-stock cache refresh failed after committed save');}
    return result;
  }finally{client.release();}
}
export async function savePricingStockModel(input:unknown,request:Request) {
  const context=await auditContext(request);const client=await(await getPool()).connect();
  try{return await commitPricingStockModel(client,input,context);}finally{client.release();}
}
