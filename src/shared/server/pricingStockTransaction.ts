import type { QueryResult } from 'pg';
import { calculatePricingStockRow, normalizePricingStockCell, normalizePricingStockModel, PricingStockValidationError } from '@/shared/domain/pricingStock';
import type { PricingStockModel, PricingStockEditableField, PricingStockValues } from '@/shared/domain/pricingStock';
import type { PricingStockBatchRequest, PricingStockRowChange, PricingStockRow, PricingStockState } from '@/shared/domain/pricingStock/api';

export type PricingStockDatabase = { query: (sql: string, values?: unknown[]) => Promise<QueryResult<Record<string, unknown>>> };
export type PricingStockAuditContext = { actorId: string | null; actorName: string | null; source: string; requestId: string; modelRevision?: string };
export class PricingStockError extends Error {
  constructor(message: string, public readonly status = 400, public readonly code = 'PRICING_STOCK_INVALID', public readonly details: Record<string, unknown> = {}) { super(message); this.name = 'PricingStockError'; }
}
const fields = { saleNet: 'price', purchaseNet: 'cost_net', inventory: 'inventory', workMinutes: 'work_minutes', otherCosts: 'other_costs' } as const;
const decimal = (value: unknown) => value === null || value === undefined ? null : String(value);
const iso = (value: unknown) => value instanceof Date ? value.toISOString() : String(value ?? '');
const object = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value);
export function requirePricingStockRevision(value: unknown): string {
  if (typeof value !== 'string' || !/^(0|[1-9]\d{0,18})$/u.test(value) || BigInt(value) > 9223372036854775807n) throw new PricingStockError('Manjka veljavna različica podatkov. Osvežite podatke.');
  return value;
}
export function normalizePricingStockBatch(input: unknown): PricingStockBatchRequest {
  if (!object(input) || Object.keys(input).some(key => !['expectedModelRevision', 'rows', 'model'].includes(key))) throw new PricingStockError('Zahtevek za shranjevanje ni veljaven.');
  const expectedModelRevision = requirePricingStockRevision(input.expectedModelRevision);
  if (!Array.isArray(input.rows) || !input.rows.length || input.rows.length > 500) throw new PricingStockError('Hkrati lahko shranite od 1 do 500 različic.');
  const ids = new Set<number>();
  const rows = input.rows.map((raw): PricingStockRowChange => {
    if (!object(raw) || Object.keys(raw).some(key => !['variantId','expectedStockRevision','expectedPricingRevision','patch'].includes(key)) || !Number.isSafeInteger(raw.variantId) || Number(raw.variantId) <= 0 || ids.has(Number(raw.variantId)) || !object(raw.patch)) throw new PricingStockError('Različica ali seznam sprememb ni veljaven.');
    ids.add(Number(raw.variantId));
    const keys = Object.keys(raw.patch);
    if (!keys.length || keys.some(key => !Object.hasOwn(fields, key))) throw new PricingStockError('Spremeniti je mogoče le ceno, nabavno ceno, zalogo, čas in druge stroške.');
    const patch: Partial<PricingStockValues> = {};
    for (const key of keys as PricingStockEditableField[]) {
      const value = raw.patch[key];
      if (key === 'inventory' && (typeof value !== 'number' || !Number.isSafeInteger(value))) throw new PricingStockError('Zaloga mora biti celo število.');
      if (key !== 'inventory' && value !== null && typeof value !== 'string') throw new PricingStockError('Denarne in časovne vrednosti morajo biti decimalna besedila.');
      const normalized = normalizePricingStockCell(key, value === null ? null : String(value));
      if (key === 'inventory') patch.inventory = Number(normalized);
      else patch[key] = normalized;
    }
    return { variantId: Number(raw.variantId), patch,
      ...(keys.includes('inventory') ? { expectedStockRevision: requirePricingStockRevision(raw.expectedStockRevision) } : {}),
      ...(keys.some(key => key !== 'inventory') ? { expectedPricingRevision: requirePricingStockRevision(raw.expectedPricingRevision) } : {}) };
  }).sort((a,b) => a.variantId-b.variantId);
  return { expectedModelRevision, rows, ...(Object.hasOwn(input, 'model') ? { model: normalizePricingStockModel(input.model) } : {}) };
}
export async function readPricingStockModel(db: PricingStockDatabase, lock: '' | 'share' | 'update' = ''): Promise<PricingStockModel> {
  const result = await db.query(`select revision::text, config_json from pricing_stock_model where key = 'default' ${lock ? 'for ' + lock : ''}`);
  const row = result.rows[0];
  if (!row) throw new PricingStockError('Podatkovna shema cen in zaloge še ni pripravljena.', 503, 'PRICING_STOCK_SCHEMA_NOT_READY');
  return normalizePricingStockModel({ ...(row.config_json as object), revision: String(row.revision) });
}
export async function readPricingStockRows(db: PricingStockDatabase, model: PricingStockModel, ids?: number[]): Promise<PricingStockRow[]> {
  const result = await db.query(`
    select v.id, v.item_id, i.item_name as item_name, i.slug as item_slug, v.variant_name, v.variant_sku,
      coalesce(v.unit,i.unit,'kos') as unit, i.category_id, coalesce(c.title,'Brez kategorije') as category_label,
      case when i.status='active' and v.status='active' then 'active' else 'inactive' end as status,
      v.price::text, v.cost_net::text, v.inventory, v.work_minutes::text, v.other_costs::text,
      v.length::text as length_mm, v.width::text as width_mm, v.thickness::text as thickness_mm, v.weight::text as weight_kg,
      editor.product_type, i.shape, i.material,
      v.stock_revision::text, v.pricing_revision::text, v.purchase_updated_at, v.updated_at,
      coalesce(reservations.reserved,0)::text as reserved, coalesce(reservations.uncertain,false) or exists (
        select 1 from order_items line join orders o on o.id=line.order_id
        where line.catalog_variant_id=v.id and not o.is_draft and o.deleted_at is null
          and o.status not in ('sent','finished','cancelled') and o.commitment_status='binding'
          and (o.stock_enforcement_applied=false or not exists (select 1 from order_stock_holds h where h.order_id=o.id and h.catalog_variant_id=v.id))
      ) as reservation_uncertain
    from catalog_item_variants v join catalog_items i on i.id=v.item_id
    left join catalog_categories c on c.id=i.category_id
    left join catalog_item_editor_details editor on editor.item_id=i.id
    left join lateral (
      select sum(h.quantity) filter (where h.state='held') as reserved,
        bool_or(h.state='legacy_unknown' or o.status='partially_sent') as uncertain
      from order_stock_holds h join orders o on o.id=h.order_id
      where h.catalog_variant_id=v.id and h.state in ('held','legacy_unknown') and not o.is_draft
        and o.deleted_at is null and o.status not in ('sent','finished','cancelled')
    ) reservations on true
    where i.status <> 'deleted' ${ids ? 'and v.id=any($1::bigint[])' : ''}
    order by i.position,i.id,v.position,v.id`, ids ? [ids] : undefined);
  return result.rows.map(raw => {
    const values: PricingStockValues = { saleNet: decimal(raw.price), purchaseNet: decimal(raw.cost_net), inventory: Number(raw.inventory), workMinutes: decimal(raw.work_minutes), otherCosts: decimal(raw.other_costs) };
    return { ...values, sizing:{productType:raw.product_type==='simple'||raw.product_type==='dimensions'||raw.product_type==='weight'||raw.product_type==='unique_machine'?raw.product_type:null,lengthMm:decimal(raw.length_mm),widthMm:decimal(raw.width_mm),thicknessMm:decimal(raw.thickness_mm),weightKg:decimal(raw.weight_kg),shape:decimal(raw.shape),material:decimal(raw.material)}, variantId:Number(raw.id),itemId:Number(raw.item_id),itemName:String(raw.item_name),itemSlug:String(raw.item_slug),variantName:String(raw.variant_name),sku:decimal(raw.variant_sku),unit:String(raw.unit),categoryId:decimal(raw.category_id),categoryLabel:String(raw.category_label),status:raw.status==='active'?'active':'inactive',stockRevision:String(raw.stock_revision),pricingRevision:String(raw.pricing_revision),purchaseUpdatedAt:raw.purchase_updated_at?iso(raw.purchase_updated_at):null,updatedAt:iso(raw.updated_at),reserved:raw.reservation_uncertain ? null : Number(raw.reserved),available:values.inventory,reservationNote:raw.reservation_uncertain ? 'Rezervacij ni mogoče zanesljivo določiti za delno poslana ali neevidentirana naročila.' : 'Evidentirane enote v aktivnih naročilih. Zaloga je že zmanjšana za te rezervacije.',calculation:calculatePricingStockRow(values,model) };
  });
}
export async function readPricingStockState(db: PricingStockDatabase): Promise<PricingStockState> {
  const model=await readPricingStockModel(db);
  const policy=await db.query("select config_json from inventory_policy_settings where key='default'");
  const stockEnforcementEnabled=(policy.rows[0]?.config_json as {stockEnforcementEnabled?:boolean}|undefined)?.stockEnforcementEnabled!==false;
  return {model,rows:await readPricingStockRows(db,model),stockEnforcementEnabled,capabilities:{viewCosts:true,editCosts:true,editPrices:true,editStock:true,editModel:true}};
}
export async function setPricingStockAuditContext(db: PricingStockDatabase, context: PricingStockAuditContext) {
  await db.query("select set_config('atehna.pricing_stock_audit',$1,true)",[JSON.stringify(context)]);
}
async function lockPricingStockModelInputs(db: PricingStockDatabase) {
  // A global formula is validated against every SKU. Freeze inserts and all old
  // catalogue/checkout writers too, so validation and commit see the same inputs.
  await db.query('lock table catalog_items, catalog_item_variants in share row exclusive mode');
}
async function persistPricingStockModel(db: PricingStockDatabase, previous: PricingStockModel, model: PricingStockModel, context: PricingStockAuditContext): Promise<PricingStockModel> {
  const config={formulaVersion:model.formulaVersion,formula:model.formula,parameters:model.parameters};
  const next=await db.query("update pricing_stock_model set config_json=$1::jsonb,revision=revision+1,updated_at=clock_timestamp() where key='default' returning revision::text",[JSON.stringify(config)]);
  const saved={...model,revision:String(next.rows[0].revision)};
  await db.query(`insert into pricing_stock_history (entity_type,entity_id,actor_id,actor_name,source,request_id,model_revision,before_json,after_json)
    values ('model','default',$1,$2,$3,$4,$5,$6::jsonb,$7::jsonb)`,[context.actorId,context.actorName,context.source,context.requestId,saved.revision,JSON.stringify(previous),JSON.stringify(saved)]);
  return saved;
}
export async function commitPricingStockBatch(db: PricingStockDatabase, raw: unknown, context: PricingStockAuditContext): Promise<PricingStockState> {
  const input=normalizePricingStockBatch(raw);
  await db.query('begin');
  try {
    const model=await readPricingStockModel(db,input.model?'update':'share');
    const ids=input.rows.map(row=>row.variantId);
    if (input.expectedModelRevision!==model.revision) throw new PricingStockError('Model je bil medtem spremenjen. Preglejte nov izračun pred shranjevanjem.',409,'PRICING_STOCK_CONFLICT',{model,currentRows:await readPricingStockRows(db,model,ids),conflicts:[]});
    if(input.model)await lockPricingStockModelInputs(db);
    // Match full article saves: parent rows first, then variants in ID order.
    await db.query('select id from catalog_items where id in (select item_id from catalog_item_variants where id=any($1::bigint[])) order by id for update',[ids]);
    const locked=await db.query('select id, stock_revision::text, pricing_revision::text from catalog_item_variants where id=any($1::bigint[]) order by id for update',[ids]);
    const lockedById=new Map(locked.rows.map(row=>[Number(row.id),row]));
    const currentRows=await readPricingStockRows(db,model,ids);
    const currentById=new Map(currentRows.map(row=>[row.variantId,row]));
    const conflicts=input.rows.flatMap(row=>{
      const current=lockedById.get(row.variantId);
      const changed:string[]=[];
      if(!current || !currentById.has(row.variantId)) changed.push('missing');
      else {
        if('inventory' in row.patch && row.expectedStockRevision!==String(current.stock_revision)) changed.push('inventory');
        if(Object.keys(row.patch).some(key=>key!=='inventory') && row.expectedPricingRevision!==String(current.pricing_revision)) changed.push('pricing');
      }
      return changed.length?[{variantId:row.variantId,fields:changed}]:[];
    });
    if(conflicts.length) throw new PricingStockError('Nekateri podatki so bili medtem spremenjeni. Vaše spremembe niso bile shranjene.',409,'PRICING_STOCK_CONFLICT',{model,currentRows,conflicts});
    const candidateModel=input.model??model;
    const changesById=new Map(input.rows.map(row=>[row.variantId,row.patch]));
    const rowsToValidate=input.model?await readPricingStockRows(db,candidateModel):currentRows;
    const issues=rowsToValidate.flatMap(row=>calculatePricingStockRow({...row,...changesById.get(row.variantId)},candidateModel).errors
      .filter(issue=>issue.code!=='MISSING_VALUE').map(issue=>({...issue,field:`rows.${row.variantId}.${issue.field}`})));
    if(issues.length)throw new PricingStockValidationError(issues.slice(0,100));
    const savedModel=input.model?await persistPricingStockModel(db,model,input.model,context):model;
    await setPricingStockAuditContext(db,{...context,modelRevision:savedModel.revision});
    for(const row of input.rows) {
      const entries=Object.entries(row.patch) as Array<[keyof typeof fields,string|number|null]>;
      const params:unknown[]=entries.map(([,value])=>value); params.push(row.variantId);
      await db.query(`update catalog_item_variants set ${entries.map(([key],index)=>fields[key]+'=$'+(index+1)).join(',')} where id=$${params.length}`,params);
      // Canonical columns govern editor hydration; mark the article version stale.
      await db.query('update catalog_items set updated_at=clock_timestamp() where id=(select item_id from catalog_item_variants where id=$1)',[row.variantId]);
    }
    const state=await readPricingStockState(db);
    await db.query('commit'); return state;
  } catch(error) { await db.query('rollback'); throw error; }
}
export async function commitPricingStockModel(db: PricingStockDatabase, raw: unknown, context: PricingStockAuditContext): Promise<PricingStockModel> {
  if(!object(raw) || Object.keys(raw).some(key=>!['expectedRevision','model'].includes(key))) throw new PricingStockError('Model ni veljaven.');
  const expectedRevision=requirePricingStockRevision(raw.expectedRevision);
  const model=normalizePricingStockModel(raw.model);
  await db.query('begin');
  try {
    const previous=await readPricingStockModel(db,'update');
    if(previous.revision!==expectedRevision) throw new PricingStockError('Model je bil medtem spremenjen. Osvežite model.',409,'PRICING_STOCK_CONFLICT',{model:previous,currentRows:[],conflicts:[]});
    await lockPricingStockModelInputs(db);
    const proposedRows = await readPricingStockRows(db, model);
    const issues = proposedRows.flatMap(row => row.calculation.errors.filter(issue => issue.code !== 'MISSING_VALUE').map(issue => ({ ...issue, field: `rows.${row.variantId}.${issue.field}` })));
    if (issues.length) throw new PricingStockValidationError(issues.slice(0,100));
    const saved=await persistPricingStockModel(db,previous,model,context);
    await db.query('commit');return saved;
  }catch(error){await db.query('rollback');throw error;}
}
