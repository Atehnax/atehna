import 'server-only';
import { hasValidAdminSession } from '@/shared/auth/adminSession';
import { requestOriginMatchesHost } from '@/shared/server/requestSecurity';
import { PricingStockValidationError } from '@/shared/domain/pricingStock';
import { PricingStockError } from './pricingStockTransaction';
export const pricingStockPrivateHeaders={'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','X-Robots-Tag':'noindex, nofollow'};
// The application currently has one administrator identity, with all four capabilities.
// Keep this explicit boundary so future roles cannot accidentally expose acquisition costs.
export function authorizePricingStockRequest(request:Request,capability:'viewCosts'|'editCosts'|'editPrices'|'editStock'|'editModel'='viewCosts') {
  if(!hasValidAdminSession(request))throw new PricingStockError('Za dostop je potrebna prijava.',401,'UNAUTHORIZED');
  if(capability!=='viewCosts' && (request.headers.get('sec-fetch-site')==='cross-site'||!requestOriginMatchesHost(request)))throw new PricingStockError('Zahtevek mora izvirati iz te administracije.',403,'FORBIDDEN');
}
export async function readPricingStockBody(request:Request):Promise<unknown> {
  const max=256*1024;const length=request.headers.get('content-length');
  if(length&&(!/^\d+$/u.test(length)||Number(length)>max))throw new PricingStockError('Zahtevek je prevelik.',413);
  if(!request.body)throw new PricingStockError('Vsebina zahtevka manjka.');
  const reader=request.body.getReader();const chunks:Uint8Array[]=[];let total=0;
  try{while(true){const {done,value}=await reader.read();if(done)break;total+=value.byteLength;if(total>max){await reader.cancel();throw new PricingStockError('Zahtevek je prevelik.',413);}chunks.push(value);}}finally{reader.releaseLock();}
  try{return JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch{throw new PricingStockError('Vsebina zahtevka mora biti veljaven JSON.');}
}
export function pricingStockErrorResponse(error:unknown):Response {
  if(error instanceof PricingStockError)return Response.json({code:error.code,message:error.message,...error.details},{status:error.status,headers:pricingStockPrivateHeaders});
  if(error instanceof PricingStockValidationError)return Response.json({code:'PRICING_STOCK_INVALID',message:error.message,issues:error.issues},{status:400,headers:pricingStockPrivateHeaders});
  const databaseCode=error&&typeof error==='object'&&'code'in error?String(error.code):'';
  if(databaseCode==='40001'||databaseCode==='40P01'||databaseCode==='55P03')return Response.json({code:'PRICING_STOCK_RETRY',message:'Podatke trenutno spreminja drug postopek. Spremembe so ohranjene; poskusite znova.'},{status:409,headers:pricingStockPrivateHeaders});
  console.error('Pricing-stock request failed',{error:error instanceof Error?error.name:'UnknownError',databaseCode:/^[A-Z0-9]{5}$/u.test(databaseCode)?databaseCode:undefined});
  return Response.json({code:'PRICING_STOCK_UNAVAILABLE',message:'Podatkov trenutno ni mogoče varno prebrati ali shraniti. Poskusite znova.'},{status:503,headers:pricingStockPrivateHeaders});
}
