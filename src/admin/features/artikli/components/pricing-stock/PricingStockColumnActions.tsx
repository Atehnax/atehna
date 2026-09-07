'use client';

import { useMemo, useState } from 'react';
import { ApplyToAllIcon, ProductSymbolIcon } from '@/shared/ui/icons/AdminActionIcons';
import { adminTableNeutralIconButtonClassName } from '@/shared/ui/admin-table';
import { previewPricingStockColumn, type PricingStockBulkPreview } from '@/shared/domain/pricingStock';
import type { PricingStockColumnField, PricingStockColumnMode, PricingStockColumnPreview } from '@/shared/domain/pricingStock/columnActions';
import type { PricingStockRow } from '@/shared/domain/pricingStock/api';
import { fieldLabels, rowLabel } from './viewHelpers';
import styles from './PricingStock.module.css';
import actions from './PricingStockColumnActions.module.css';

type Props = {
  rows:readonly PricingStockRow[];
  filteredRows:readonly PricingStockRow[];
  columns:readonly string[];
  selected:ReadonlySet<number>;
  errors:Readonly<Record<string,string>>;
  canEditPrices:boolean;canEditCosts:boolean;
  disabled?:boolean;
  onApply:(rows:PricingStockBulkPreview['rows'])=>boolean;
};
type Action = {mode:PricingStockColumnMode;reason:string;preview:PricingStockColumnPreview|null};
type Feedback = {error:string};
type ActionField=Exclude<PricingStockColumnField,'inventory'>;
const FIELDS:readonly ActionField[]=['purchaseNet','saleNet','workMinutes'];
const isActionField=(key:string):key is ActionField=>FIELDS.includes(key as ActionField);

export default function PricingStockColumnActions(props:Props) {
  const source=props.selected.size===1?props.rows.find(row=>props.selected.has(row.variantId)):undefined;
  // Retain the last source while closing so its cells can animate out together.
  const [lastSource,setLastSource]=useState(source);
  if(source&&source!==lastSource)setLastSource(source);
  const retainedSource=source??lastSource??props.rows[0];
  return retainedSource?<ColumnActionRow {...props} source={retainedSource} open={!!source}/>:null;
}

function ColumnActionRow({source,open,filteredRows,columns,errors,canEditPrices,canEditCosts,disabled=false,onApply}:Props&{source:PricingStockRow;open:boolean}) {
  const [feedback,setFeedback]=useState<(Feedback&{sourceId:number})|null>(null);
  if(feedback&&(!open||feedback.sourceId!==source.variantId))setFeedback(null);
  const targets=useMemo(()=>filteredRows.filter(row=>row.variantId!==source.variantId),[filteredRows,source.variantId]);
  const sourceVisible=filteredRows.some(row=>row.variantId===source.variantId);
  const choices=useMemo(()=>Object.fromEntries(FIELDS.map(field=>{
    const permitted=field==='saleNet'?canEditPrices:canEditCosts;
    const baseReason=!open?'Izberite eno izvorno različico.':disabled?'Počakajte, da se shranjevanje konča.':!sourceVisible?'Izbrana izvorna različica ni med filtriranimi rezultati.':!permitted?'Za urejanje tega stolpca nimate dovoljenja.':errors[`${source.variantId}:${field}`]||(source[field]===null?'V izvorni različici manjka ta vrednost. Vnesite podatek; 0 je dovoljen.':targets.length===0?'Med filtriranimi rezultati ni drugih različic.':'');
    const modes:PricingStockColumnMode[]=['copy','proportional'];
    return [field,modes.map(mode=>{
      if(baseReason)return {mode,reason:baseReason,preview:null};
      const proposal=previewPricingStockColumn(source,targets,field,mode);
      const preview={...proposal,rows:proposal.rows.map(row=>({...row,changed:row.changed||!!errors[`${row.variantId}:${row.field}`]}))};
      const changed=preview.rows.filter(row=>row.changed).length;
      const reason=preview.errors.length?preview.errors[0].message:preview.rows.length===0?'Ni združljivih filtriranih različic z veljavnimi merami ali maso in isto prodajno enoto.':changed>500?'Hkrati lahko spremenite največ 500 različic. Omejite filtre.':changed===0?'Vse ciljne različice že imajo te vrednosti.':'';
      return {mode,reason,preview};
    })];
  })) as Record<ActionField,Action[]>,[source,sourceVisible,targets,errors,canEditPrices,canEditCosts,disabled,open]);
  const apply=(action:Action)=>{
    if(!open||action.reason||!action.preview)return;
    const {preview}=action;
    if(!onApply(preview.rows)){
      setFeedback({sourceId:source.variantId,error:'Spremembe niso bile uporabljene. Osnutek lahko vsebuje največ 500 različnih vrstic. Omejite filtre ali najprej shranite obstoječe spremembe.'});
      return;
    }
    setFeedback(null);
  };
  return <>
    <tr className={actions.row} data-testid="pricing-column-actions-row" data-open={open} aria-hidden={!open} inert={!open}>
      <td className={styles.selection}/>
      {columns.map(key=><td key={key} className={key==='identity'?styles.identity:undefined} data-column-action-cell={key}>
        <div className={actions.collapse} data-open={open}><div className={actions.collapseContent}><div className={actions.cellContent}>
        {key==='identity'?<div className={actions.source}><span title={'Vir: '+rowLabel(source)}>Vir: <strong>{source.sku||rowLabel(source)}</strong></span></div>:isActionField(key)?<div className={actions.buttons}>
          {choices[key].map(action=>{
            const label=(action.mode==='copy'?'Enaka vrednost':'Sorazmerni izračun')+' · '+fieldLabels[key];
            const precision=key==='workMinutes'?'Prikaz je v celih minutah; osnutek in izračun ohranita natančnost časa.':'Zaokroževanje: 2 decimalni mesti, polovice stran od ničle.';
            const help=action.reason||`${label}: uporabi vrednost iz ${source.sku||rowLabel(source)} za druge filtrirane različice. ${precision}${key==='workMinutes'&&action.mode==='proportional'?' Čas je sorazmerna ocena po velikosti ali masi.':''}`;
            return <span key={action.mode} className={actions.triggerWrap} title={help}><button type="button" className={adminTableNeutralIconButtonClassName+' '+actions.trigger} aria-label={label} title={help} disabled={!!action.reason} data-testid={`pricing-column-${action.mode}-${key}`} onClick={()=>apply(action)}>{action.mode==='copy'?<ApplyToAllIcon/>:<ProductSymbolIcon/>}</button></span>;
          })}
        </div>:null}
        </div></div></div>
      </td>)}
    </tr>
    {open&&feedback&&feedback.sourceId===source.variantId&&<tr className={actions.feedbackRow}><td colSpan={columns.length+1}>
      <p role="alert" className={styles.error}>{feedback.error}</p>
    </td></tr>}
  </>;
}
