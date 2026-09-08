import { savePricingStockModel } from '@/shared/server/pricingStock';
import { authorizePricingStockRequest, pricingStockErrorResponse, pricingStockPrivateHeaders, readPricingStockBody } from '@/shared/server/pricingStockRequest';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function PUT(request:Request) {
  try {await authorizePricingStockRequest(request,'editModel');return Response.json({model:await savePricingStockModel(await readPricingStockBody(request),request)},{headers:pricingStockPrivateHeaders});}catch(error){return pricingStockErrorResponse(error);}
}
