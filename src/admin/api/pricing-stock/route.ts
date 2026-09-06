import { normalizePricingStockBatch } from '@/shared/server/pricingStockTransaction';
import { getPricingStockState, savePricingStockRows } from '@/shared/server/pricingStock';
import { authorizePricingStockRequest, pricingStockErrorResponse, pricingStockPrivateHeaders, readPricingStockBody } from '@/shared/server/pricingStockRequest';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function GET(request:Request) {
  try {authorizePricingStockRequest(request);return Response.json(await getPricingStockState(),{headers:pricingStockPrivateHeaders});}catch(error){return pricingStockErrorResponse(error);}
}
export async function PATCH(request:Request) {
  try {
    authorizePricingStockRequest(request);
    const input=normalizePricingStockBatch(await readPricingStockBody(request));
    if(input.model)authorizePricingStockRequest(request,'editModel');
    if(input.rows.some(row=>'inventory' in row.patch))authorizePricingStockRequest(request,'editStock');
    if(input.rows.some(row=>'saleNet' in row.patch))authorizePricingStockRequest(request,'editPrices');
    if(input.rows.some(row=>['purchaseNet','workMinutes','otherCosts'].some(key=>key in row.patch)))authorizePricingStockRequest(request,'editCosts');
    return Response.json(await savePricingStockRows(input,request),{headers:pricingStockPrivateHeaders});
  }catch(error){return pricingStockErrorResponse(error);}
}
