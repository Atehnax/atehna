'use client';
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { useRouter } from 'next/navigation';
import { formatSlCount } from '@/shared/domain/formatting';
import { calculatePricingStockRow, normalizePricingStockCell, normalizePricingStockModel, parsePricingStockPaste, validatePricingStockModel, type PricingStockModel, type PricingStockValues, type PricingStockBulkPreview } from '@/shared/domain/pricingStock';
import type { PricingStockState, PricingStockRow, PricingStockBatchRequest, PricingStockConflict, PricingStockRowChange } from '@/shared/domain/pricingStock/api';
import { UnsavedChangesDialog } from '@/shared/ui/unsaved-changes-dialog';
import { useArticleNavigationGuard, type ArticleNavigationGuard } from '../ArticleNavigationGuard';
import PricingModelCard from './PricingModelCard';
import PricingStockGrid, { type CellDrafts, type CellErrors } from './PricingStockGrid';
import { EDITABLE_FIELDS, decimalText, messageOf, rowLabel, valuesOf, type EditableField } from './viewHelpers';
import styles from './PricingStock.module.css';
type ApiReply = Partial<PricingStockState & Omit<PricingStockConflict,'code'>> & {code?:string;message?:string;errors?:Array<string|{message:string}>};
async function reply(response:Response):Promise<ApiReply>{try{return await response.json() as ApiReply;}catch{return {};}}
function apiMessage(body:ApiReply,fallback:string){const first=body.errors?.[0];return typeof first==='string'?first:first?.message||body.message||fallback;}
function isState(body:ApiReply):body is PricingStockState {return Array.isArray(body.rows)&&!!body.model&&typeof body.stockEnforcementEnabled==='boolean'&&!!body.capabilities;}
export default function PricingStockWorkspace(){
  const router=useRouter(),root=useRef<HTMLDivElement>(null),pendingNavigation=useRef<(()=>void)|null>(null);
  const [state,setState]=useState<PricingStockState|null>(null),[model,setModel]=useState<PricingStockModel|null>(null),[drafts,setDrafts]=useState<CellDrafts>({}),[selected,setSelected]=useState<Set<number>>(new Set());
  const [busy,setBusy]=useState(false),[modelSaving,setModelSaving]=useState(false),[loading,setLoading]=useState(true),[error,setError]=useState(''),[notice,setNotice]=useState(''),[conflict,setConflict]=useState<PricingStockConflict|null>(null),[navigationLabel,setNavigationLabel]=useState<string|null>(null),[height,setHeight]=useState(650);
  const load=useCallback(async(signal?:AbortSignal)=>{setLoading(true);try{const response=await fetch('/api/admin/pricing-stock',{cache:'no-store',signal}),body=await reply(response);if(!response.ok||!isState(body))throw new Error(apiMessage(body,'Cen in zaloge ni mogoče naložiti.'));setState(body);setModel(body.model);setError('');}catch(cause){if(!signal?.aborted)setError(messageOf(cause));}finally{if(!signal?.aborted)setLoading(false);}},[]);
  useEffect(()=>{const controller=new AbortController();void load(controller.signal);return()=>controller.abort();},[load]);
  useEffect(()=>{
    const scope=root.current?.closest<HTMLElement>('.admin-scope');
    scope?.classList.add(styles.pricingShell);
    const update=()=>{if(!root.current)return;let bottom=0;for(let ancestor=root.current.parentElement;ancestor;ancestor=ancestor.parentElement){const style=getComputedStyle(ancestor);bottom+=parseFloat(style.paddingBottom)||0;bottom+=parseFloat(style.borderBottomWidth)||0;}setHeight(Math.max(360,window.innerHeight-root.current.getBoundingClientRect().top-bottom));};
    update();window.addEventListener('resize',update);const observer=new ResizeObserver(update);if(root.current)observer.observe(root.current);
    return()=>{window.removeEventListener('resize',update);observer.disconnect();scope?.classList.remove(styles.pricingShell);};
  },[loading]);
  const evaluated=useMemo(()=>{
    const errors:CellErrors={},changed=new Set<number>(),patches:PricingStockRowChange[]=[];
    const rows=(state?.rows??[]).map(row=>{const values=valuesOf(row),patch:Partial<PricingStockValues>={};for(const field of EDITABLE_FIELDS){const raw=drafts[row.variantId]?.[field];if(raw===undefined)continue;try{const normalized=normalizePricingStockCell(field,raw),value=field==='inventory'?Number(normalized):normalized;if(field==='inventory')values.inventory=value as number;else values[field]=value as string|null;if(value!==row[field]){if(field==='inventory')patch.inventory=value as number;else patch[field]=value as string|null;}}catch(cause){errors[`${row.variantId}:${field}`]=messageOf(cause);changed.add(row.variantId);if(field!=='inventory')values[field]=null;}}
      if(Object.keys(patch).length){changed.add(row.variantId);patches.push({variantId:row.variantId,...('inventory'in patch?{expectedStockRevision:row.stockRevision}:{}),...(Object.keys(patch).some(key=>key!=='inventory')?{expectedPricingRevision:row.pricingRevision}:{}),patch});}
      return {...row,...values,available:values.inventory,calculation:model?calculatePricingStockRow(values,model):row.calculation};});
    return {rows,errors,changed,patches};
  },[state,model,drafts]);
  const modelDirty=!!state&&!!model&&JSON.stringify(state.model)!==JSON.stringify(model),dirty=modelDirty||evaluated.changed.size>0;
  const modelIssues=model?validatePricingStockModel(model):[];
  const calculationIssues=evaluated.rows.flatMap(row=>row.calculation.errors.filter(issue=>issue.code!=='MISSING_VALUE').map(issue=>({variantId:row.variantId,message:(row.sku||rowLabel(row))+': '+issue.message})));
  const savedRowCalculationInvalid=!!model&&!!state&&state.rows.some(row=>calculatePricingStockRow(valuesOf(row),model).errors.some(issue=>issue.code!=='MISSING_VALUE'));
  const invalid=Object.keys(evaluated.errors).length>0||modelIssues.length>0||calculationIssues.length>0;
  const requestNavigation=useCallback<ArticleNavigationGuard>((label,navigate)=>{if(!dirty){navigate();return;}pendingNavigation.current=navigate;setNavigationLabel(label);},[dirty]);
  useArticleNavigationGuard(requestNavigation);
  useEffect(()=>{if(!dirty)return;const beforeUnload=(event:BeforeUnloadEvent)=>{event.preventDefault();event.returnValue='';};const click=(event:MouseEvent)=>{if(event.defaultPrevented||event.button!==0||event.ctrlKey||event.metaKey||event.altKey||event.shiftKey)return;const anchor=event.target instanceof Element?event.target.closest<HTMLAnchorElement>('a[href]'):null;if(!anchor||anchor.download||(anchor.target&&anchor.target!=='_self'))return;const target=new URL(anchor.href,location.href);if(target.origin!==location.origin||target.href===location.href)return;event.preventDefault();event.stopPropagation();requestNavigation('zapustitvijo strani',()=>router.push(target.pathname+target.search+target.hash));};window.addEventListener('beforeunload',beforeUnload);document.addEventListener('click',click,true);return()=>{window.removeEventListener('beforeunload',beforeUnload);document.removeEventListener('click',click,true);};},[dirty,requestNavigation,router]);
  useEffect(()=>{
    if(!dirty)return;
    const currentUrl=location.href,currentState=history.state;
    const navigation=(window as Window & {navigation?:{currentEntry?:{index:number}}}).navigation;
    const currentIndex=navigation?.currentEntry?.index;
    let restoring=false,approved=false,pendingDelta=0;
    const pop=(event:PopStateEvent)=>{
      if(approved)return;
      if(restoring){
        event.stopImmediatePropagation();restoring=false;
        requestNavigation('premikom po zgodovini',()=>{approved=true;history.go(pendingDelta);});
        return;
      }
      if(location.href===currentUrl)return;
      const destination=location.pathname+location.search+location.hash;
      event.stopImmediatePropagation();
      const targetIndex=navigation?.currentEntry?.index;
      if(currentIndex!==undefined&&targetIndex!==undefined&&targetIndex!==currentIndex){
        pendingDelta=targetIndex-currentIndex;restoring=true;history.go(-pendingDelta);
      }else{
        // Older browsers expose no history position. Keep the draft mounted before confirmation.
        history.pushState(currentState,'',currentUrl);
        requestNavigation('premikom po zgodovini',()=>router.replace(destination));
      }
    };
    window.addEventListener('popstate',pop,true);
    return()=>window.removeEventListener('popstate',pop,true);
  },[dirty,requestNavigation,router]);
  const receiveConflict=(body:ApiReply)=>{if(body.code==='PRICING_STOCK_DISABLED'){setState(current=>current?{...current,stockEnforcementEnabled:false}:current);}if(body.code==='PRICING_STOCK_CONFLICT'&&body.model){setConflict({code:body.code,message:body.message||'Podatki so se spremenili.',model:body.model,currentRows:body.currentRows??[],conflicts:body.conflicts??[]});}setError(apiMessage(body,'Podatki so se spremenili. Osnutek je ohranjen.'));};
  const saveModel=async():Promise<PricingStockModel|null>=>{if(!state||!model)return null;if(savedRowCalculationInvalid||modelIssues.length){setError('Enačba ni veljavna za shranjene podatke. Enačbo in popravljene vrstice shranite skupaj z gumbom »Shrani spremembe«.');return null;}if(!modelDirty)return state.model;setModelSaving(true);try{const normalized=normalizePricingStockModel(model);const response=await fetch('/api/admin/pricing-stock/model',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({expectedRevision:state.model.revision,model:normalized})}),body=await reply(response);if(response.status===409){receiveConflict(body);return null;}if(!response.ok||!body.model)throw new Error(apiMessage(body,'Enačbe ni mogoče shraniti.'));setState(current=>current?{...current,model:body.model!}:current);setModel(body.model);setNotice('Enačba in parametri so shranjeni. Prodajne cene so ostale enake.');setError('');return body.model;}catch(cause){setError(messageOf(cause));return null;}finally{setModelSaving(false);}};
  const save=async():Promise<boolean>=>{if(!state||!model||busy||modelSaving)return false;if(invalid){setError('Preverite označene vnose in enačbo pred shranjevanjem.');return false;}if(evaluated.patches.length>500){setError('Hkrati lahko shranite največ 500 različic. Zmanjšajte obseg osnutka.');return false;}setBusy(true);setError('');setNotice('');try{if(evaluated.patches.length===0)return !!(await saveModel());const payload:PricingStockBatchRequest={expectedModelRevision:state.model.revision,rows:evaluated.patches,...(modelDirty?{model:normalizePricingStockModel(model)}:{})};const response=await fetch('/api/admin/pricing-stock',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)}),body=await reply(response);if(response.status===409){receiveConflict(body);return false;}if(!response.ok||!isState(body))throw new Error(apiMessage(body,'Sprememb ni mogoče shraniti.'));setState(body);setModel(body.model);setDrafts({});setConflict(null);setNotice(modelDirty?'Model, cene in zaloga so shranjeni skupaj.':'Cene in zaloga so shranjene.');return true;}catch(cause){setError(messageOf(cause));return false;}finally{setBusy(false);}};
  const edit=(id:number,field:EditableField,value:string)=>{setDrafts(current=>({...current,[id]:{...current[id],[field]:value}}));setNotice('');};
  const applyPaste=(id:number,field:EditableField,text:string,ordered:PricingStockRow[],fields:EditableField[])=>{try{const fieldIndex=fields.indexOf(field),start=ordered.findIndex(row=>row.variantId===id);if(fieldIndex<0||start<0)throw new Error('Ciljne celice ni mogoče najti.');const parsed=parsePricingStockPaste(text,fields.slice(fieldIndex));if(parsed.errors.length)throw new Error(parsed.errors.map(issue=>`Vrstica ${issue.rowIndex+1}, stolpec ${issue.columnIndex+1}: ${issue.message}`).slice(0,5).join(' '));if(parsed.rows.length>500)throw new Error('Hkrati lahko prilepite največ 500 vrstic.');if(start+parsed.rows.length>ordered.length)throw new Error('Prilepljeni podatki segajo čez zadnjo filtrirano različico.');const targetIds=new Set([...evaluated.changed,...ordered.slice(start,start+parsed.rows.length).map(row=>row.variantId)]);if(targetIds.size>500)throw new Error('Osnutek lahko vsebuje največ 500 različnih vrstic.');setDrafts(current=>{const next={...current};parsed.rows.forEach((patch,index)=>{const target=ordered[start+index].variantId;next[target]={...next[target],...Object.fromEntries(Object.entries(patch).map(([key,value])=>[key,decimalText(value)]))};});return next;});setNotice(`Prilepljeno: ${formatSlCount(parsed.rows.length,{one:'vrstica',two:'vrstici',few:'vrstice',other:'vrstic'})}. Spremembe so v osnutku.`);setError('');}catch(cause){setError(messageOf(cause));}};
  const applyBulk=(rows:PricingStockBulkPreview['rows'])=>{if(new Set([...evaluated.changed,...rows.filter(row=>row.changed).map(row=>row.variantId)]).size>500){setError('Osnutek lahko vsebuje največ 500 različnih vrstic.');return;}setDrafts(current=>{const next={...current};for(const row of rows)if(row.changed)next[row.variantId]={...next[row.variantId],[row.field]:decimalText(row.proposed)};return next;});setNotice('Skupinska sprememba je pripravljena v osnutku.');setError('');};
  const rebase=(takeCurrentStock:boolean)=>{if(!state||!conflict)return;const updates=new Map(conflict.currentRows.map(row=>[row.variantId,row]));setState({...state,model:conflict.model,rows:state.rows.map(row=>updates.get(row.variantId)??row)});setModel(current=>current&&modelDirty?{...current,revision:conflict.model.revision}:conflict.model);if(takeCurrentStock)setDrafts(current=>Object.fromEntries(Object.entries(current).map(([id,patch])=>{const next={...patch};if(updates.has(Number(id)))delete next.inventory;return[id,next];})));setConflict(null);setError('');setNotice(takeCurrentStock?'Prevzeta je trenutna zaloga. Drugi vnosi so ostali v osnutku.':'Osnova je posodobljena, vaši vnosi so ohranjeni. Pred ponovnim shranjevanjem preglejte spremembe.');};
  const reset=()=>{setDrafts({});setModel(state?.model??null);setConflict(null);setError('');setNotice('Neshranjene spremembe modela in vrstic so razveljavljene.');};
  const stockToggle=(enabled:boolean)=>requestNavigation('spremembo omejevanja zaloge',()=>{void(async()=>{setBusy(true);try{const response=await fetch('/api/admin/inventory-policy',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({config:{stockEnforcementEnabled:enabled}})}),body=await reply(response);if(!response.ok)throw new Error(apiMessage(body,'Nastavitve zaloge ni mogoče shraniti.'));await load();setNotice(enabled?'Omejevanje zaloge je vključeno.':'Zaloga je informativna; urejanje zaloge je izključeno.');}catch(cause){setError(messageOf(cause));}finally{setBusy(false);}})();});
  const continueNavigation=()=>{const next=pendingNavigation.current;pendingNavigation.current=null;setNavigationLabel(null);next?.();};
  const sample=evaluated.rows.find(row=>selected.has(row.variantId))??evaluated.rows[0]??null;
  if(loading&&!state)return <div role="status" className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-500">Nalaganje cen in zaloge …</div>;
  if(!state||!model)return <div className={styles.error} role="alert">{error||'Podatki niso na voljo.'}<button type="button" className={styles.button} onClick={()=>void load()}>Poskusi znova</button></div>;
  return <div ref={root} className={styles.workspace} style={{'--pricing-workspace-height':height+'px'} as CSSProperties} data-testid="pricing-stock-workspace">
    <PricingModelCard model={model} savedModel={state.model} sample={sample} onChange={next=>{setModel(next);setNotice('');}} onSave={()=>void saveModel()} saving={modelSaving} disabled={!state.capabilities.editModel||busy} calculationInvalid={savedRowCalculationInvalid}/>
    {modelDirty&&savedRowCalculationInvalid&&calculationIssues.length===0&&modelIssues.length===0&&<div className={styles.notice}>Enačba potrebuje tudi popravke vrstic. Model in vrstice shranite skupaj z gumbom »Shrani spremembe«.</div>}
    {calculationIssues.length>0&&modelIssues.length===0&&<div className={styles.error} role="alert">{calculationIssues.slice(0,3).map((issue,index)=><p key={index}>{issue.message}</p>)}{calculationIssues.length>3&&<p>Preverite še preostale označene izračune.</p>}</div>}
    {error&&<div className={styles.error} role="alert">{error}</div>}
    {notice&&<div className={styles.notice} role="status">{notice}</div>}
    {!state.stockEnforcementEnabled&&evaluated.patches.some(row=>'inventory'in row.patch)&&<div className={styles.notice}>Urejanje zaloge je izključeno. Drugi vnosi so ohranjeni. <button type="button" className={styles.button} onClick={()=>{setDrafts(current=>Object.fromEntries(Object.entries(current).map(([id,patch])=>{const next={...patch};delete next.inventory;return[id,next];})));setError('');}}>Odstrani spremembe zaloge iz osnutka</button></div>}
    {conflict&&<section className={styles.notice} aria-label="Primerjava spremenjenih podatkov"><p className="mb-1 font-medium">Osnutek je ohranjen. Primerjajte trenutno stanje pred ponovnim shranjevanjem.</p><div className="max-h-20 overflow-auto">{conflict.currentRows.map(row=><p key={row.variantId}>{row.sku||rowLabel(row)} · trenutna zaloga: <strong>{row.inventory}</strong>{drafts[row.variantId]?.inventory!==undefined?` · vaš vnos: ${drafts[row.variantId]?.inventory}`:''} · prodajna cena: {decimalText(row.saleNet)} €</p>)}</div><div className={`${styles.actions} mt-2`}><button type="button" className={styles.button} onClick={()=>rebase(true)}>Prevzemi trenutno zalogo</button><button type="button" className={styles.button} onClick={()=>rebase(false)}>Posodobi osnovo in ohrani osnutek</button></div></section>}
    <PricingStockGrid rows={evaluated.rows} drafts={drafts} errors={evaluated.errors} changed={evaluated.changed} modelDirty={modelDirty} model={model} selected={selected} onSelect={setSelected} stockEnabled={state.stockEnforcementEnabled} canEditPrices={state.capabilities.editPrices} canEditCosts={state.capabilities.editCosts} canEditStock={state.capabilities.editStock} busy={busy||modelSaving} onStockToggle={stockToggle} onEdit={edit} onPaste={applyPaste} onBulk={applyBulk} onSave={()=>void save()} onReset={reset} saveDisabled={busy||modelSaving||!dirty||invalid||!!conflict||(!state.stockEnforcementEnabled&&evaluated.patches.some(row=>'inventory'in row.patch))} onOpen={row=>requestNavigation('odhodom na urejanje artikla',()=>router.push('/admin/artikli/'+encodeURIComponent(row.itemSlug)+'?tab=sales'))}/>
    <UnsavedChangesDialog open={navigationLabel!==null} label={navigationLabel??undefined} isSaving={busy||modelSaving} saveDisabled={invalid||!!conflict} onSave={()=>{void save().then(saved=>{if(saved)continueNavigation();});}} onContinueEditing={()=>{pendingNavigation.current=null;setNavigationLabel(null);}} onDiscard={()=>{setDrafts({});setModel(state.model);setConflict(null);setError('');continueNavigation();}}/>
  </div>;
}
