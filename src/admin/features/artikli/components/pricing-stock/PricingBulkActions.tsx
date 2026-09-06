'use client';
import { useMemo, useState } from 'react';
import Dialog from '@/shared/ui/dialog/dialog';
import { previewPricingStockBulk, type PricingStockModel } from '@/shared/domain/pricingStock';
import type { PricingStockRow } from '@/shared/domain/pricingStock/api';
import { decimalText, fieldLabels, rowLabel } from './viewHelpers';
import styles from './PricingStock.module.css';
type Operation = Parameters<typeof previewPricingStockBulk>[2];
type Proposal = ReturnType<typeof previewPricingStockBulk>;
const operations: Array<{value:Operation['kind'];label:string;unit?:string}> = [
  {value:'inventory-set',label:'Nastavi zalogo',unit:'kos'}, {value:'inventory-adjust',label:'Spremeni zalogo za',unit:'kos'},
  {value:'sale-adjust-money',label:'Spremeni prodajno ceno za',unit:'€'}, {value:'sale-adjust-percent',label:'Spremeni prodajno ceno za',unit:'%'},
  {value:'work-set',label:'Nastavi čas dela',unit:'min'}, {value:'recommended-price',label:'Uporabi priporočeno ceno'}
];
export default function PricingBulkActions({rows,model,stockEnabled,canEditPrices,canEditCosts,disabled,onApply}:{rows:PricingStockRow[];model:PricingStockModel;stockEnabled:boolean;canEditPrices:boolean;canEditCosts:boolean;disabled:boolean;onApply:(rows:Proposal['rows'])=>void}) {
  const [kind,setKind]=useState<Operation['kind']>('sale-adjust-percent'),[value,setValue]=useState(''),[previewOpen,setPreviewOpen]=useState(false);
  const operation=useMemo<Operation>(()=>kind==='recommended-price'?{kind}:{kind,value},[kind,value]);
  const proposal=useMemo(()=>previewPricingStockBulk(rows,model,operation),[rows,model,operation]);
  const allowed=(value:Operation['kind'])=>value.startsWith('inventory')?stockEnabled:value==='work-set'?canEditCosts:canEditPrices;
  const blocked=disabled||rows.length===0||!allowed(kind);
  return <><div className={styles.bulk} data-testid="pricing-stock-bulk"><span>Izbrano: {rows.length}</span><select aria-label="Skupinsko dejanje" value={kind} disabled={disabled} onChange={e=>setKind(e.target.value as Operation['kind'])}>{operations.map(item=><option key={item.value} value={item.value} disabled={!allowed(item.value)}>{item.label}{item.unit?' ('+item.unit+')':''}</option>)}</select>{kind!=='recommended-price'&&<input aria-label="Vrednost skupinske spremembe" inputMode="decimal" placeholder="Vrednost" value={value} disabled={disabled} onChange={e=>setValue(e.target.value)}/>}<button type="button" className={styles.button} disabled={blocked} onClick={()=>setPreviewOpen(true)}>Predogled</button></div>
    <Dialog open={previewOpen} onOpenChange={setPreviewOpen} isDismissable title="Predogled skupinske spremembe" panelClassName="!max-w-3xl" footer={<div className={styles.actions}><button type="button" className={styles.button} onClick={()=>setPreviewOpen(false)}>Prekliči</button><button type="button" className={styles.primary} disabled={blocked||proposal.errors.length>0||!proposal.rows.some(row=>row.changed)} onClick={()=>{onApply(proposal.rows);setPreviewOpen(false);}}>Uporabi v osnutku</button></div>}>
      <p className="mb-3 text-xs leading-5 text-slate-600">Spremembe se shranijo šele z gumbom »Shrani spremembe«. Število decimalnih mest pri zaokroževanju: {proposal.decimalPlaces}; polovice stran od ničle.</p>
      {!!proposal.errors.length&&<div className={styles.error} role="alert">{proposal.errors.map((error,index)=><p key={index}>{rowLabel(rows.find(row=>row.variantId===error.variantId)!)}: {error.message}</p>)}</div>}
      <div className="max-h-[50vh] overflow-auto"><table className={styles.previewTable}><thead><tr><th>Artikel / SKU</th><th>Polje</th><th>Trenutno</th><th>Predlagano</th></tr></thead><tbody>{proposal.rows.map(row=>{const item=rows.find(item=>item.variantId===row.variantId)!;return <tr key={row.variantId}><td>{rowLabel(item)}<small className="block text-slate-500">{item.sku||'Brez SKU'}</small></td><td>{fieldLabels[row.field]}</td><td>{row.previous===null?'—':decimalText(row.previous)}</td><td className={row.changed?'font-semibold text-blue-700':''}>{row.proposed===null?'—':decimalText(row.proposed)}</td></tr>})}</tbody></table></div>
    </Dialog>
  </>;
}
