'use client';

import { useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { AdminUnitInput } from '@/shared/ui/admin-controls/AdminUnitInput';
import { AdminSaveStatus } from '@/shared/ui/admin-save-status';
import { adminTextButtonTypographyTokenClasses } from '@/shared/ui/theme/tokens';
import {
  calculatePricingStockRow, DEFAULT_PRICING_STOCK_FORMULA,
  PRICING_STOCK_FORMULA_SYMBOLS,
  pricingFormulaDraftToCanonical, pricingFormulaDraftToShort,
  validatePricingStockModel, type PricingStockModel, type PricingStockValues
} from '@/shared/domain/pricingStock';
import { formatExactDecimal, parseExactDecimal } from '@/shared/domain/pricingStock/decimal';
import { decimalText, fieldLabels, getMissingFormulaFields, money } from './viewHelpers';
import { PricingFormulaMath } from './PricingFormulaMath';
import styles from './PricingStock.module.css';
import card from './PricingModelCard.module.css';

const SHORT_FORMULA_HELP = 'Uporabite simbole iz legende, +, −, *, / in oklepaje. Funkcije: abs(t), min(v; 2), max(v; 2), round(v; 2). Decimalno ločilo je pika ali vejica; argumente ločite s podpičjem.';

const fields: Array<{key:keyof PricingStockModel['parameters'];label:string;unit?:string;help:string}> = [
  {key:'headcount',label:'Število zaposlenih',help:'n: skupno število zaposlenih v mesečnem modelu ekipe, na primer 5. To ni število ljudi za posamezen artikel.'},
  {key:'employeeCost',label:'Mesečni strošek / zaposlenega',unit:'€',help:'c: celotni mesečni strošek enega zaposlenega za podjetje, na primer 2.650 €. Skupni strošek ekipe je n × c.'},
  {key:'availableHours',label:'Razpoložljive ure / zaposlenega',unit:'h',help:'h: mesečne ure enega zaposlenega pred upoštevanjem izkoriščenosti, na primer 128 h. To ni čas za en artikel.'},
  {key:'utilizationPercent',label:'Izkoriščenost',unit:'%',help:'u: 96 ur neposrednega dela od 128 razpoložljivih ur pomeni 75 % oziroma 0,75 v enačbi. Velja za zmogljivost zaposlenega oziroma ekipe pri vseh delih skupaj.'},
  {key:'fixedCosts',label:'Fiksni stroški / mesec',unit:'€',help:'f: skupni drugi mesečni fiksni stroški ekipe, na primer 2.400 €. Stroškov zaposlenih ne vštevajte ponovno.'},
  {key:'targetProfit',label:'Ciljni dobiček / mesec',unit:'€',help:'p: skupni želeni mesečni dobiček, na primer 2.000 €. To je upravljavska razširitev TDABC, ne dobiček posameznega artikla.'},
  {key:'adequacyThresholdPercent',label:'Prag ustreznosti',unit:'%',help:'Skupni prag oznake pokritja, privzeto 120 %. Vpliva na oznako artikla, ne na ciljno RVC ali urno stopnjo.'}
];
type Definition = {scope:string;unit:string;description:string;example:string;legend:string};
const definitions: Record<string,Definition> = {
  n:{scope:'Ekipa · skupno',unit:'zaposleni',description:'Število zaposlenih v istem mesečnem modelu. Njihovi stroški in ure veljajo za vsa dela skupaj.',example:'5 zaposlenih; ne število ljudi na artiklu.',legend:'zaposleni'},
  c:{scope:'Zaposleni · na mesec',unit:'€ / zaposlenega',description:'Celotni mesečni strošek enega zaposlenega za podjetje. Skupni strošek ekipe je n × c.',example:'2.650 € na zaposlenega; pri n = 5 skupaj 13.250 €.',legend:'strošek / zaposlenega'},
  h:{scope:'Zaposleni · na mesec',unit:'h / zaposlenega',description:'Razpoložljive mesečne ure enega zaposlenega pred upoštevanjem izkoriščenosti. Ni čas posameznega artikla.',example:'128 h na zaposlenega v mesecu.',legend:'ure / zaposlenega'},
  u:{scope:'Zaposleni oziroma ekipa · na mesec',unit:'delež 0–1',description:'Delež razpoložljivih ur za neposredno delo pri vseh delih skupaj. V polje vnesete odstotek, enačba pa uporabi delež.',example:'96 h od 128 h = 75 %; v enačbi u = 0,75.',legend:'izkoriščenost'},
  f:{scope:'Ekipa · skupaj na mesec',unit:'€ / mesec',description:'Drugi mesečni fiksni stroški, ki jih želite razporediti na delovne ure. Stroškov zaposlenih ne dodajte ponovno.',example:'2.400 € skupnih mesečnih stroškov.',legend:'fiksni stroški'},
  p:{scope:'Ekipa · skupaj na mesec',unit:'€ / mesec',description:'Želeni skupni mesečni dobiček, ki ga privzeti model razporedi na ure. Upravljavska razširitev TDABC.',example:'2.000 € za ves mesec; ne 2.000 € za vsak artikel.',legend:'ciljni dobiček'},
  t:{scope:'Ta SKU · ena prodajna enota',unit:'min / enoto',description:'Seštevek delovnih minut vseh sodelujočih za eno prodajno enoto te različice. Urejate ga v stolpcu Delo / kos.',example:'2 zaposlena × 3 min = 6 delovnih minut na enoto. Serija z 30 delovnimi minutami za 10 enot pomeni 3 min na enoto.',legend:'minute / enoto'},
  v:{scope:'Ta SKU · ena prodajna enota',unit:'€ / enoto',description:'Drugi spremenljivi stroški za eno enoto, na primer embalaža ali potrošni material. Stolpec Drugi stroški vključite z izbiro stolpcev. Ne vključite ponovno nabavne cene ali dela.',example:'0,50 € embalaže na enoto. Če stroškov ni, vnesite 0.',legend:'drugi stroški / enoto'},
  b:{scope:'Ta SKU · ena prodajna enota',unit:'€ / enoto brez DDV',description:'Nabavna cena ene prodajne enote različice. Uporabi se pri dejanski RVC in priporočeni ceni.',example:'Nabavna cena 7,00 € na kos.',legend:'nabavna cena / enoto'},
  s:{scope:'Ta SKU · ena prodajna enota',unit:'€ / enoto brez DDV',description:'Prodajna cena ene prodajne enote različice. Urejate jo v tabeli; model je ne spreminja samodejno.',example:'Prodajna cena 12,00 € na kos; dejanska RVC je 12 − 7 = 5 €.',legend:'prodajna cena / enoto'}
};

type Props = {
  model:PricingStockModel;savedModel:PricingStockModel;sample:PricingStockValues|null;sampleLabel?:string;
  onChange:(model:PricingStockModel)=>void;onSave:()=>void;
  saving:boolean;disabled:boolean;calculationInvalid:boolean;
};

export default function PricingModelCard({model,savedModel,sample,sampleLabel,onChange,onSave,saving,disabled,calculationInvalid}:Props) {
  const [definitionsOpen,setDefinitionsOpen]=useState(false),[tokensOpen,setTokensOpen]=useState(false),[formulaOpen,setFormulaOpen]=useState(false);
  const formula=useRef<HTMLTextAreaElement>(null);
  const issues=validatePricingStockModel(model),dirty=JSON.stringify(model)!==JSON.stringify(savedModel);
  const shortFormula=pricingFormulaDraftToShort(model.formula);
  const preview=calculatePricingStockRow(sample??{inventory:0,purchaseNet:null,saleNet:null,workMinutes:null,otherCosts:null},model);
  const missing=sample?getMissingFormulaFields(sample,model):[];
  const previewLabel=sampleLabel||'izbrana različica';
  const missingLabels=missing.map(field=>fieldLabels[field]).join(', ');
  const capacity=preview.capacityRate===null?null:formatExactDecimal(parseExactDecimal(preview.capacityRate),2);
  const changeFormula=(value:string)=>onChange({...model,formula:pricingFormulaDraftToCanonical(value)});
  const insert=(token:string)=>{
    const input=formula.current,start=input?.selectionStart??shortFormula.length,end=input?.selectionEnd??start;
    changeFormula(shortFormula.slice(0,start)+token+shortFormula.slice(end));
    requestAnimationFrame(()=>{input?.focus();input?.setSelectionRange(start+token.length,start+token.length);});
  };
  return <div className={card.sections}>
    <section className={card.model} aria-labelledby="pricing-model-title" data-testid="pricing-stock-model">
      <div className={card.heading}>
        <div className={card.title}><h2 id="pricing-model-title">Model ciljne RVC (TDABC)</h2></div>
        <div className={styles.actions}>
          <AdminSaveStatus dirty={dirty} saving={saving} testId="pricing-model-save-status"/>
          <button type="button" className={`${styles.button} ${adminTextButtonTypographyTokenClasses}`} disabled={disabled||saving} onClick={()=>onChange({...model,formula:DEFAULT_PRICING_STOCK_FORMULA})}>Ponastavi</button>
            <button type="button" className={styles.primary} disabled={disabled||saving||!dirty||issues.length>0||calculationInvalid} onClick={onSave}>{saving?'Shranjujem …':'Shrani enačbo'}</button>
        </div>
      </div>
      <div id="pricing-model-body">
          <p className={card.description}>Časovno vodeno obračunavanje stroškov po artiklu. Skupni mesečni parametri ekipe določijo urno stopnjo; vsaka različica uporabi svoj čas in druge stroške za eno prodajno enoto.</p>
          <div className={card.equationRow}><div className={card.equation} data-testid="pricing-model-equation"><PricingFormulaMath formula={model.formula}/></div><button type="button" className={card.toggle} aria-expanded={formulaOpen} aria-controls="pricing-formula-editor-body" onClick={()=>setFormulaOpen(open=>!open)}>{formulaOpen?'Skrij urejanje enačbe':'Uredi enačbo'}<ChevronDown size={13} className={card.chevron}/></button></div>
          <div id="pricing-formula-editor-body" className={card.collapse} data-open={formulaOpen} aria-hidden={!formulaOpen} inert={!formulaOpen}><div className={card.collapseContent}>
          <div className={card.formulaLabel}><label htmlFor="pricing-formula">Enačba ciljne RVC</label><button type="button" className={card.toggle} onClick={()=>setTokensOpen(open=>!open)} aria-expanded={tokensOpen} aria-controls="pricing-formula-tokens">fx · Vstavi simbol<ChevronDown size={13} className={card.chevron}/></button></div>
          <textarea id="pricing-formula" ref={formula} className={card.formulaEditor} spellCheck={false} value={shortFormula} disabled={disabled||saving} onChange={event=>changeFormula(event.target.value)} aria-invalid={issues.length>0} aria-describedby={issues.length?'pricing-model-errors':'pricing-symbol-legend'}/>
          {tokensOpen&&<div id="pricing-formula-tokens"><p className={card.formulaHelp}>{SHORT_FORMULA_HELP}</p><div className={card.tokens}>{PRICING_STOCK_FORMULA_SYMBOLS.map(symbol=><button key={symbol.alias} type="button" className={card.token} title={symbol.label} disabled={disabled||saving} onClick={()=>insert(symbol.alias)}><var>{symbol.alias}</var> {definitions[symbol.alias].legend}</button>)}</div></div>}
          </div></div>
          <div id="pricing-symbol-legend" className={card.symbolLegend} aria-label="Legenda simbolov enačbe">{PRICING_STOCK_FORMULA_SYMBOLS.map(symbol=><span key={symbol.alias} title={definitions[symbol.alias].scope+' · '+definitions[symbol.alias].unit}><var>{symbol.alias}</var> {definitions[symbol.alias].legend}</span>)}</div>
          <div className={card.parameters}>{fields.map(field=><div key={field.key} className={card.parameter}>
            <label htmlFor={'pricing-model-'+field.key} title={field.help}>{field.label}</label>
            <AdminUnitInput id={'pricing-model-'+field.key} unit={field.unit} className="h-9 w-full" inputClassName="leading-[36px]" inputMode="decimal" value={decimalText(model.parameters[field.key])} disabled={disabled||saving} title={field.help} onChange={event=>onChange({...model,parameters:{...model.parameters,[field.key]:event.target.value.replace(',','.')}})}/>
          </div>)}
            <div className={card.capacity}><span>Stroškovna stopnja zmogljivosti</span><strong>{money(capacity)}{capacity!==null?' / h':''}</strong><small title={'Izračun za eno prodajno enoto: '+previewLabel}>Ciljna RVC za {previewLabel}: {money(preview.targetRvc)}</small></div>
          </div>
          <div className={card.previewNote} aria-live="polite" data-testid="pricing-model-preview-note">
            {!sample?'Za predogled potrebujete različico artikla.':missing.length?<>Za {previewLabel} dopolnite: <strong>{missingLabels}</strong>. {missing.includes('otherCosts')?'Če drugih stroškov ni, vnesite 0.':''}</>:preview.targetRvc===null?'Izračun ni na voljo. Preverite enačbo in označene vnose.':`Predogled: ${previewLabel}, ena prodajna enota. Prodajna cena ostane nespremenjena.`}
          </div>
          {issues.length>0&&<p id="pricing-model-errors" role="alert" className={styles.error}>{issues.map(issue=>issue.message).join(' ')}</p>}
      </div>
    </section>
    <section className={card.definitions} aria-labelledby="pricing-definitions-title" data-testid="pricing-stock-definitions">
      <div className={card.heading}><h2 id="pricing-definitions-title">Razlaga modela in spremenljivk</h2><button type="button" className={`${card.toggle} ${card.visibilityToggle}`} aria-label={definitionsOpen?'Skrij razlago':'Prikaži razlago'} title={definitionsOpen?'Skrij razlago':'Prikaži razlago'} aria-expanded={definitionsOpen} aria-controls="pricing-model-definitions-body" onClick={()=>setDefinitionsOpen(open=>!open)}><svg viewBox="0 0 24 24" width={18} height={18} fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M1.5 12s3.75-6.75 10.5-6.75S22.5 12 22.5 12s-3.75 6.75-10.5 6.75S1.5 12 1.5 12Z"/>
        <circle cx="12" cy="12" r="3"/>
        {!definitionsOpen&&<path d="M3.5 3.5 20.5 20.5"/>}
      </svg></button></div>
      <div id="pricing-model-definitions-body" className={card.collapse} data-open={definitionsOpen} aria-hidden={!definitionsOpen} inert={!definitionsOpen}>
        <div className={card.collapseContent}>
          <div className={card.definitionsBody}>
            <div className={card.scopeExplanation}>
              <h3>Od skupnega meseca do ene prodajne enote</h3>
              <p><strong>Ekipa:</strong> n, c, h, u, f in p so skupni mesečni parametri. Nanašajo se na isto vključeno ekipo in iste vire; stroškov nepovezanih oddelkov ne prištevajte. Iz njihovih mesečnih stroškov in uporabnih ur dobimo urno stopnjo. Vse različice v tej tabeli uporabljajo isti model.</p>
              <p><strong>Izkoriščenost:</strong> 96 ur neposrednega dela od 128 razpoložljivih ur: 96 ÷ 128 × 100 = 75 %. V polje vnesete 75, enačba uporabi u = 0,75. Pri 5 zaposlenih je skupna mesečna zmogljivost 5 × 128 × 0,75 = 480 ur za vsa dela skupaj. To ni delež posameznega artikla in ni število artiklov.</p>
              <p><strong>Posamezen SKU:</strong> ena enota porabi svoj čas t v delovnih minutah vseh sodelujočih. t / 60 pretvori te minute v delovne ure; ta delež ure pomnožimo z urno stopnjo in prištejemo lastne druge stroške v. Delež stroška posameznega artikla določa njegov t, ne u ali število artiklov. Mesečne izkoriščenosti ne vnašate za vsak artikel posebej.</p>
            </div>
            <dl className={card.variableDefinitions}>{PRICING_STOCK_FORMULA_SYMBOLS.map(symbol=>{const definition=definitions[symbol.alias];return <div key={symbol.alias}><dt><var>{symbol.alias}</var> {symbol.label}<small>{definition.scope} · {definition.unit}</small></dt><dd>{definition.description}<p className={card.example}>Primer: {definition.example}</p></dd></div>;})}</dl>
            <div className={card.itemExample}>
              <h3>Primer ene prodajne enote pri urni stopnji 30 € / h</h3>
              <p>t = 6 min in v = 0,50 €: ena enota porabi 0,1 ure dela, torej 3,00 € dela in 0,50 € drugih stroškov.</p>
              <p><strong>Ciljna RVC = 3,50 € / enoto.</strong> Pri prodajni ceni s = 12,00 € in nabavni ceni b = 7,00 € je dejanska RVC = 5,00 € / enoto. Pokritje je 5 / 3,50 × 100 = 142,86 %.</p>
            </div>
            <dl className={card.metrics}>
              <div><dt>Dejanska RVC = s − b</dt><dd>Prodajna minus nabavna cena ene enote brez DDV. Razlika v ceni še ni dobiček. RVC % = (s − b) / s × 100; pri s = 12 € in b = 7 € znaša 41,67 %.</dd></div>
              <div><dt>Ciljna RVC</dt><dd>Izračunani ciljni znesek na eno enoto po enačbi, ne ročni vnos in ne mesečni strošek artikla. Prazen podatek ni ničla: če enačba potrebuje manjkajočo vrednost, je rezultat —. Uredite zahtevani podatek v tabeli; za ničelne druge stroške vnesite 0.</dd></div>
              <div><dt>Pokritje in prag ustreznosti</dt><dd>Dejanska RVC / ciljna RVC × 100. Pod 100 %: Pod pragom; od 100 % do nastavljenega praga: Na meji; od praga naprej: Ustrezno. Privzeti prag je 120 %. Pri ciljni RVC 0 ali manj pokritje ni izračunano.</dd></div>
              <div><dt>Prilagojena enačba</dt><dd>Privzeta enačba je v + (t / 60) × (n × c + f + p) / (n × h × u). Spremenjena enačba uporablja samo v njej navedene simbole. Sprememba modela nikoli sama ne spremeni prodajne cene s.</dd></div>
            </dl>
            <p className={card.explanation}>{SHORT_FORMULA_HELP}</p>
          </div>
        </div>
      </div>
    </section>
  </div>;
}
