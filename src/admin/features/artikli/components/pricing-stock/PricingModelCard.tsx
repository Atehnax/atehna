'use client';
import { useRef, useState } from 'react';
import { calculatePricingStockRow, DEFAULT_PRICING_STOCK_FORMULA, PRICING_STOCK_FORMULA_TOKENS, PRICING_STOCK_FORMULA_HELP, validatePricingStockModel, type PricingStockModel, type PricingStockValues } from '@/shared/domain/pricingStock';
import { formatExactDecimal, parseExactDecimal } from '@/shared/domain/pricingStock/decimal';
import { decimalText, money } from './viewHelpers';
import styles from './PricingStock.module.css';
const fields: Array<{key:keyof PricingStockModel['parameters'];label:string;unit?:string;help?:string}> = [
  {key:'headcount',label:'Število zaposlenih'},
  {key:'employeeCost',label:'Mesečni strošek / zaposlenega',unit:'€'},
  {key:'availableHours',label:'Razpoložljive ure / zaposlenega',unit:'h'},
  {key:'utilizationPercent',label:'Izkoriščenost',unit:'%'},
  {key:'fixedCosts',label:'Fiksni stroški / mesec',unit:'€'},
  {key:'targetProfit',label:'Ciljni dobiček / mesec',unit:'€',help:'Ciljni dobiček je upravljavska razširitev metode TDABC (Time-Driven Activity-Based Costing). RVC sama po sebi ni dobiček.'},
  {key:'adequacyThresholdPercent',label:'Prag ustreznosti',unit:'%'}
];
export default function PricingModelCard({model,savedModel,sample,onChange,onSave,saving,disabled,calculationInvalid}:{model:PricingStockModel;savedModel:PricingStockModel;sample:PricingStockValues|null;onChange:(model:PricingStockModel)=>void;onSave:()=>void;saving:boolean;disabled:boolean;calculationInvalid:boolean}) {
  const [tokensOpen,setTokensOpen]=useState(false),formula=useRef<HTMLTextAreaElement>(null);
  const issues=validatePricingStockModel(model),dirty=JSON.stringify(model)!==JSON.stringify(savedModel);
  const preview=calculatePricingStockRow(sample??{inventory:0,purchaseNet:null,saleNet:null,workMinutes:null,otherCosts:null},model);
  const insert=(token:string)=>{const input=formula.current,start=input?.selectionStart??model.formula.length,end=input?.selectionEnd??start;onChange({...model,formula:model.formula.slice(0,start)+token+model.formula.slice(end)});requestAnimationFrame(()=>{input?.focus();input?.setSelectionRange(start+token.length,start+token.length);});};
  return <section className={styles.model} aria-labelledby="pricing-model-title" data-testid="pricing-stock-model">
    <div className={styles.modelHeading}><div><h2 id="pricing-model-title">Model ciljne RVC (TDABC)</h2><p>Časovno vodeno obračunavanje stroškov po artiklu. Enačba ne spreminja prodajnih cen.</p></div><div className={styles.actions}>
      <button type="button" className={styles.button} disabled={disabled||saving} onClick={()=>onChange({...model,formula:DEFAULT_PRICING_STOCK_FORMULA})}>Ponastavi</button>
      <button type="button" className={styles.primary} disabled={disabled||saving||!dirty||issues.length>0||calculationInvalid} onClick={onSave}>{saving?'Shranjujem …':'Shrani enačbo'}</button>
    </div></div>
    <div className={styles.formulaLabel}><label htmlFor="pricing-formula" title={PRICING_STOCK_FORMULA_HELP}>Enačba ciljne RVC ⓘ</label><button type="button" className={styles.tokenButton} onClick={()=>setTokensOpen(v=>!v)} aria-expanded={tokensOpen} aria-controls="pricing-formula-tokens">fx · Vstavi spremenljivko</button></div>
    <textarea id="pricing-formula" ref={formula} className={styles.formula} spellCheck={false} value={model.formula} disabled={disabled||saving} onChange={e=>onChange({...model,formula:e.target.value})} aria-invalid={issues.length>0} aria-describedby={issues.length?'pricing-model-errors':undefined}/>
    {tokensOpen&&<p className="mb-1 text-[10px] text-slate-500">{PRICING_STOCK_FORMULA_HELP}</p>}
    {tokensOpen&&<div id="pricing-formula-tokens" className={styles.tokens}>{PRICING_STOCK_FORMULA_TOKENS.map(token=><button key={token.value} type="button" className={styles.token} title={token.label} disabled={disabled||saving} onClick={()=>insert(token.value)}>{token.value}</button>)}</div>}
    <div className={styles.parameters}>{fields.map(field=><div key={field.key} className={styles.parameter}><label htmlFor={'pricing-model-'+field.key} title={field.help}>{field.label}{field.help?' ⓘ':''}</label><div className={styles.inputShell}><input id={'pricing-model-'+field.key} inputMode="decimal" value={decimalText(model.parameters[field.key])} disabled={disabled||saving} onChange={e=>onChange({...model,parameters:{...model.parameters,[field.key]:e.target.value.replace(',','.')}})}/>{field.unit&&<span>{field.unit}</span>}</div></div>)}
      <div className={styles.capacity}><span>Stroškovna stopnja zmogljivosti</span><strong>{money(preview.capacityRate===null?null:formatExactDecimal(parseExactDecimal(preview.capacityRate),2))}{preview.capacityRate!==null?' / h':''}</strong><small title="Izračun za prvo izbrano oziroma prvo različico v seznamu">Predogled ciljne RVC: {money(preview.targetRvc)}</small></div>
    </div>
    {issues.length>0&&<p id="pricing-model-errors" role="alert" className={styles.error} style={{marginTop:7}}>{issues.map(issue=>issue.message).join(' ')}</p>}
  </section>;
}
