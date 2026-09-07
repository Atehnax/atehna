'use client';
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ClipboardEvent, type KeyboardEvent, type CSSProperties } from 'react';
import { SlidersHorizontal } from 'lucide-react';
import { adminTableTextStackClassName, adminTablePrimaryTextClassName, adminTableSecondaryTextClassName, AdminTableLayout, ColumnVisibilityControl, adminTableCardClassName, adminTableCardStyle, adminTableContentClassName, adminTableSearchInputClassName, adminTableSearchIconClassName, adminTableHeaderButtonClassName, adminTableHeaderContentClassName, adminTableHeaderClassName, adminTableNeutralIconButtonClassName, adminTableInlineActionRowClassName, adminTableInlineConfirmButtonClassName, adminTableInlineCancelButtonClassName, adminTableInlineConfirmIconClassName, adminTableInlineCancelIconClassName } from '@/shared/ui/admin-table';
import { AdminSearchInput } from '@/shared/ui/admin-search-input';
import { AdminSaveStatus } from '@/shared/ui/admin-save-status';
import { adminTextButtonTypographyTokenClasses, filterPillClearGlyph, filterPillTokenClasses } from '@/shared/ui/theme/tokens';
import { AdminCheckbox } from '@/shared/ui/checkbox';
import { EuiTablePagination } from '@/shared/ui/pagination';
import { HEADER_FILTER_BUTTON_CLASS, HeaderFilterPortal, getHeaderPopoverStyle, useHeaderFilterDismiss } from '@/shared/ui/admin-header-filter';
import { ColumnFilterIcon, DownloadIcon, PencilIcon, OpenArticleIcon, CheckIcon, CloseIcon, adminActionIconSizeClassName } from '@/shared/ui/icons/AdminActionIcons';
import AdminRangeFilterPanel from '@/shared/ui/admin-range-filter-panel';
import SegmentedControl from '@/shared/ui/segmented/segmented-control';
import { isNumericRangeActive, matchesNumericRange, validateNumericRange, type NumericFilterKey, type NumericRange } from '@/shared/domain/pricingStock/numericFilters';
import { ArticleTableNumber } from '../ArticleTableNumber';
import { RowActionsDropdown } from '@/shared/ui/table';
import { IconButton } from '@/shared/ui/icon-button';
import { Spinner } from '@/shared/ui/loading';
import { UnsavedChangesDialog } from '@/shared/ui/unsaved-changes-dialog';
import { downloadTableAsCsv } from '@/shared/utils/table-export';
import { comparePricingStockDecimals, type PricingStockModel, type PricingStockBulkPreview } from '@/shared/domain/pricingStock';
import type { PricingStockRow } from '@/shared/domain/pricingStock/api';
import PricingStockColumnActions from './PricingStockColumnActions';
import { decimalText, fieldLabels, getMissingFormulaFields, money, percent, rowLabel, timestamp, workMinutesText, workMinutesTitle, type EditableField } from './viewHelpers';
import { formatSlCount } from '@/shared/domain/formatting';
import styles from './PricingStock.module.css';
export type CellDrafts = Record<number, Partial<Record<EditableField,string>>>;
export type CellErrors = Record<string,string>;
type PricingEditableField = Exclude<EditableField,'inventory'>;
type PricingNumericFilterKey = Exclude<NumericFilterKey,'inventory'>;
type Column = {key:string;label:string;width:number;editable?:PricingEditableField;optional?:boolean;sort?:boolean};
const columns:Column[]=[
  {key:'identity',label:'Artikel',width:265,sort:true},
  {key:'purchaseNet',label:'Nabavna cena',width:138,editable:'purchaseNet',sort:true},{key:'saleNet',label:'Prodajna cena',width:138,editable:'saleNet',sort:true},
  {key:'rvc',label:'RVC',width:92,sort:true},{key:'workMinutes',label:'Delo / kos',width:120,editable:'workMinutes',sort:true},
  {key:'otherCosts',label:'Drugi stroški',width:138,editable:'otherCosts',optional:true,sort:true},{key:'targetRvc',label:'Ciljna RVC',width:116,sort:true},
  {key:'coveragePercent',label:'Pokritje',width:167,sort:true},{key:'recommendedPrice',label:'Priporočena cena',width:116,optional:true,sort:true},
  {key:'purchaseUpdatedAt',label:'Posodobljeno',width:120,optional:true,sort:true},{key:'reserved',label:'Rezervirano',width:95,optional:true,sort:true},
  {key:'available',label:'Razpoložljivo',width:100,optional:true,sort:true},{key:'edit',label:'Uredi',width:96}
];
const coverageOptions=[['all','Vsa pokritja'],['below','Pod pragom'],['borderline','Na meji'],['adequate','Ustrezno'],['missing','Ni podatkov']];
const numericFilterLabels:Record<PricingNumericFilterKey,{label:string;title:string}>={
  purchaseNet:{label:'Filtriraj po nabavni ceni',title:'Nabavna cena brez DDV (€)'},
  saleNet:{label:'Filtriraj po prodajni ceni',title:'Prodajna cena brez DDV (€)'},
  rvc:{label:'Filtriraj po RVC',title:'RVC (€)'},
  rvcPercent:{label:'Filtriraj po deležu RVC',title:'RVC (%)'},
  workMinutes:{label:'Filtriraj po delu na kos',title:'Delo / kos (min)'},
  targetRvc:{label:'Filtriraj po ciljni RVC',title:'Ciljna RVC (€)'}
};
type HeaderFilter='category'|'coverage'|PricingNumericFilterKey;
const isNumericFilter=(key:string|null):key is PricingNumericFilterKey=>key!==null&&Object.hasOwn(numericFilterLabels,key);
const emptyRange:NumericRange={min:'',max:''};
const normalized=(value:string)=>value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('sl-SI');
function sortValue(row:PricingStockRow,key:string):string|number|null {if(key==='identity')return rowLabel(row);if(key==='purchaseUpdatedAt')return row.purchaseUpdatedAt;if(['rvc','rvcPercent','targetRvc','coveragePercent','recommendedPrice'].includes(key))return row.calculation[key as 'rvc'];return row[key as 'purchaseNet'|'saleNet'|'workMinutes'|'otherCosts'|'reserved'|'available'];}
type Props={rows:PricingStockRow[];drafts:CellDrafts;errors:CellErrors;changed:Set<number>;modelDirty:boolean;model:PricingStockModel;selected:Set<number>;onSelect:(ids:Set<number>)=>void;canEditPrices:boolean;canEditCosts:boolean;canEditStock:boolean;busy:boolean;onEdit:(id:number,field:EditableField,value:string)=>void;onPaste:(id:number,field:EditableField,text:string,ordered:PricingStockRow[],fields:EditableField[])=>void;onBulk:(rows:PricingStockBulkPreview['rows'])=>boolean;onSave:()=>void;onReset:()=>void;onSaveRow:(id:number)=>Promise<boolean>;onRestoreRow:(id:number,snapshot:CellDrafts[number]|undefined)=>void;editSessionVersion:number;rowSaveDisabledReason?:string;saveDisabled:boolean;onOpen:(row:PricingStockRow)=>void};
export default function PricingStockGrid(props:Props){
  const {rows,drafts,errors,changed,modelDirty,selected,onSelect,model,canEditPrices,canEditCosts,busy}=props;
  const [editSession,setEditSession]=useState<{variantId:number;snapshot:CellDrafts[number]|undefined}|null>(null);
  const [pendingEditId,setPendingEditId]=useState<number|null>(null);
  const [typingMinutesId,setTypingMinutesId]=useState<number|null>(null);
  useEffect(()=>{setEditSession(null);setPendingEditId(null);setTypingMinutesId(null);},[props.editSessionVersion]);
  const [search,setSearch]=useState(''),[category,setCategory]=useState('all'),[coverage,setCoverage]=useState('all'),[page,setPage]=useState(1),[pageSize,setPageSize]=useState(25);
  const [visible,setVisible]=useState<Record<string,boolean>>(()=>Object.fromEntries(columns.map(column=>[column.key,!column.optional]))),[sort,setSort]=useState<{key:string;direction:1|-1}|null>(null),[filter,setFilter]=useState<HeaderFilter|null>(null);
  const [numericRanges,setNumericRanges]=useState<Partial<Record<PricingNumericFilterKey,NumericRange>>>({});
  const [draftRange,setDraftRange]=useState<NumericRange>(emptyRange);
  const [rvcFilterKey,setRvcFilterKey]=useState<'rvc'|'rvcPercent'>('rvc');
  const numericFilterKey=filter==='rvc'?rvcFilterKey:isNumericFilter(filter)?filter:null;
  const rangeError=validateNumericRange(draftRange);
  const anchor=useRef<HTMLElement|null>(null),table=useRef<HTMLTableElement>(null),filterPanel=useRef<HTMLDivElement>(null);
  const [filterStyle,setFilterStyle]=useState<CSSProperties>({visibility:'hidden'});
  const editingId=editSession?.variantId;
  useEffect(()=>{
    if(editingId===undefined)return;
    const frame=requestAnimationFrame(()=>{
      const input=table.current?.querySelector<HTMLInputElement>(`tr[data-variant-id="${editingId}"] input[data-pricing-cell]:not(:disabled)`);
      input?.focus();input?.select();
    });
    return()=>cancelAnimationFrame(frame);
  },[editingId]);
  useHeaderFilterDismiss({isOpen:filter!==null,onClose:()=>setFilter(null)});
  useEffect(() => {
    const content = table.current?.parentElement;
    const card = content?.parentElement;
    const workspace = card?.parentElement;
    if (!content || !card || !workspace) return;
    let frame = 0;
    const update = () => {
      const footerHeight = content.nextElementSibling?.getBoundingClientRect().height ?? 0;
      let bottomSpacing = 0;
      for (let ancestor: HTMLElement | null = card; ancestor; ancestor = ancestor.parentElement) {
        const style = getComputedStyle(ancestor);
        bottomSpacing += (parseFloat(style.paddingBottom) || 0) + (parseFloat(style.borderBottomWidth) || 0);
      }
      // Cap long lists, but reserve a header and one full row on short viewports.
      // This is a maximum only: a short list keeps its natural content height.
      const headerHeight = table.current?.tHead?.getBoundingClientRect().height ?? 48;
      const minimum = headerHeight + 48 + Math.max(0, content.offsetHeight - content.clientHeight);
      const maximum = Math.max(minimum, window.innerHeight - content.getBoundingClientRect().top - footerHeight - bottomSpacing);
      const value = `${Math.floor(maximum)}px`;
      if (content.style.maxHeight !== value) content.style.maxHeight = value;
    };
    const schedule = () => { cancelAnimationFrame(frame); frame = requestAnimationFrame(update); };
    update();
    const observer = new ResizeObserver(schedule);
    observer.observe(workspace);
    if (table.current?.tHead) observer.observe(table.current.tHead);
    for (const child of workspace.children) observer.observe(child);
    if (card.firstElementChild) observer.observe(card.firstElementChild);
    if (content.nextElementSibling) observer.observe(content.nextElementSibling);
    window.addEventListener('resize', schedule);
    return () => { observer.disconnect(); cancelAnimationFrame(frame); window.removeEventListener('resize', schedule); };
  }, []);

  const shownColumns=columns.filter(column=>visible[column.key]),editableColumns=shownColumns.flatMap(column=>column.editable&&(column.editable==='saleNet'?canEditPrices:canEditCosts)?[column.editable]:[]);
  const filtered=useMemo(()=>rows.filter(row=>{const query=normalized(search);return(!query||normalized(rowLabel(row)+' '+(row.sku??'')).includes(query))&&(category==='all'||(row.categoryId??'uncategorized')===category)&&Object.entries(numericRanges).every(([key,range])=>matchesNumericRange(sortValue(row,key),range))&&(coverage==='all'||row.calculation.status===coverage);}).sort((a,b)=>{if(!sort)return 0;const x=sortValue(a,sort.key),y=sortValue(b,sort.key);if(x===null||x===undefined)return y===null||y===undefined?0:1;if(y===null||y===undefined)return-1;return(sort.key==='identity'||sort.key==='purchaseUpdatedAt'?String(x).localeCompare(String(y),'sl-SI'):comparePricingStockDecimals(String(x),String(y)))*sort.direction;}),[rows,search,category,numericRanges,coverage,sort]);
  const pageCount=Math.max(1,Math.ceil(filtered.length/pageSize)),safePage=Math.min(page,pageCount),visibleRows=filtered.slice((safePage-1)*pageSize,safePage*pageSize),selectedRows=rows.filter(row=>selected.has(row.variantId));
  const categories=useMemo(()=>Array.from(new Map(rows.map(row=>[row.categoryId??'uncategorized',row.categoryLabel||'Brez kategorije'])).entries()).sort((a,b)=>a[1].localeCompare(b[1],'sl-SI')),[rows]);
  useLayoutEffect(() => {
    if (!filter) return;
    const panel=filterPanel.current, trigger=anchor.current;
    if (!panel || !trigger) return;
    const position=() => {
      const rect=trigger.getBoundingClientRect(), padding=8, gap=6;
      const width=Math.min(240,Math.max(0,window.innerWidth-padding*2));
      const desiredHeight=Math.min(300,panel.scrollHeight+2);
      const below=Math.max(0,window.innerHeight-rect.bottom-gap-padding);
      const above=Math.max(0,rect.top-gap-padding);
      const flip=below<desiredHeight&&above>below;
      const maxHeight=Math.min(300,Math.max(24,flip?above:below),window.innerHeight-padding*2);
      const height=Math.min(desiredHeight,maxHeight);
      const top=Math.max(padding,Math.min(flip?rect.top-gap-height:rect.bottom+gap,window.innerHeight-height-padding));
      setFilterStyle({...getHeaderPopoverStyle(trigger,width),top,maxHeight,visibility:'visible'});
    };
    position();
    const observer=new ResizeObserver(position);
    observer.observe(panel);
    observer.observe(trigger);
    window.addEventListener('resize',position);
    window.addEventListener('scroll',position,true);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize',position);
      window.removeEventListener('scroll',position,true);
    };
  },[filter,categories.length]);
  const allSelected=visibleRows.length>0&&visibleRows.every(row=>selected.has(row.variantId));
  const toggleRow=(id:number)=>{const next=new Set(selected);if(next.has(id))next.delete(id);else next.add(id);onSelect(next);};
  const rowSaveReason=(id:number)=>props.rowSaveDisabledReason||Object.entries(errors).find(([key])=>key.startsWith(id+':'))?.[1]||rows.find(row=>row.variantId===id)?.calculation.errors.find(issue=>issue.code!=='MISSING_VALUE')?.message||'';
  const startEditing=(id:number)=>{setTypingMinutesId(null);setEditSession({variantId:id,snapshot:drafts[id]?{...drafts[id]}:undefined});setPendingEditId(null);};
  const sessionChanged=!!editSession&&Object.keys({...editSession.snapshot,...drafts[editSession.variantId]}).some(field=>editSession.snapshot?.[field as EditableField]!==drafts[editSession.variantId]?.[field as EditableField]);
  const requestEditing=(id:number)=>{
    if(busy||editSession?.variantId===id)return;
    if(editSession&&sessionChanged){setPendingEditId(id);return;}
    startEditing(id);
  };
  const cancelEditing=()=>{
    if(!editSession||busy)return;
    props.onRestoreRow(editSession.variantId,editSession.snapshot);
    setEditSession(null);setPendingEditId(null);
  };
  const saveEditing=async()=>{
    if(!editSession||busy||rowSaveReason(editSession.variantId))return false;
    const id=editSession.variantId;
    const saved=await props.onSaveRow(id);
    if(saved)setEditSession(current=>current?.variantId===id?null:current);
    return saved;
  };
  const keyDown=(event:KeyboardEvent<HTMLInputElement>)=>{
    if(event.nativeEvent.isComposing)return;
    if(event.key==='Escape'){event.preventDefault();cancelEditing();return;}
    if(event.key==='Enter'&&!event.shiftKey&&!event.ctrlKey&&!event.metaKey&&!event.altKey){event.preventDefault();void saveEditing();return;}
    if(event.key!=='Tab'||event.ctrlKey||event.metaKey||event.altKey)return;
    const inputs=Array.from(table.current?.querySelectorAll<HTMLInputElement>('input[data-pricing-cell]:not(:disabled)')??[]),index=inputs.indexOf(event.currentTarget),next=inputs[index+(event.shiftKey?-1:1)];
    if(next){event.preventDefault();next.focus();next.select();}
  };
  const paste=(event:ClipboardEvent<HTMLInputElement>,row:PricingStockRow,field:EditableField)=>{const text=event.clipboardData.getData('text/plain');if(!text.includes('\t')&&!/[\r\n]/.test(text))return;event.preventDefault();props.onPaste(row.variantId,field,text,filtered,editableColumns);};
  const openFilter=(kind:HeaderFilter,target:HTMLElement)=>{
    anchor.current=target;
    if(isNumericFilter(kind))setDraftRange(numericRanges[kind==='rvc'?rvcFilterKey:kind]??emptyRange);
    setFilter(filter===kind?null:kind);
  };
  const applyRange=(range:NumericRange)=>{
    if(!numericFilterKey||validateNumericRange(range))return;
    setNumericRanges(current=>{const next={...current};if(isNumericRangeActive(range))next[numericFilterKey]=range;else delete next[numericFilterKey];return next;});
    setPage(1);setFilter(null);
  };
  const filterChips: Array<{key:string;title:string;value:string;clear:()=>void}> = [];
  if(search.trim())filterChips.push({key:'search',title:'Iskanje:',value:search.trim(),clear:()=>setSearch('')});
  if(category!=='all')filterChips.push({key:'category',title:'Kategorija:',value:categories.find(([key])=>key===category)?.[1]??category,clear:()=>setCategory('all')});
  for(const [key,range] of Object.entries(numericRanges)){
    if(!range||!isNumericRangeActive(range))continue;
    const min=decimalText(range.min.trim()),max=decimalText(range.max.trim());
    const value=(min&&max?`${min} – ${max}`:min?`≥ ${min}`:`≤ ${max}`)+(key==='workMinutes'?' min':key==='rvcPercent'?' %':' €');
    filterChips.push({key,title:(columns.find(column=>column.key===(key==='rvcPercent'?'rvc':key))?.label??key)+':',value,clear:()=>setNumericRanges(current=>{const next={...current};delete next[key as PricingNumericFilterKey];return next;})});
  }
  if(coverage!=='all')filterChips.push({key:'coverage',title:'Pokritje:',value:coverageOptions.find(([key])=>key===coverage)?.[1]??coverage,clear:()=>setCoverage('all')});
  const exportRows=()=>{const source=selectedRows.length?selectedRows:filtered;downloadTableAsCsv([['Artikel','SKU','Nabavna cena brez DDV','Prodajna cena brez DDV','RVC','Ciljna RVC','Pokritje %'],...source.map(row=>[rowLabel(row),row.sku??'',row.purchaseNet??'',row.saleNet??'',row.calculation.rvc??'',row.calculation.targetRvc??'',row.calculation.coveragePercent??''])],'cene-in-zaloga.csv');};
  const dirty = changed.size > 0 || modelDirty;
  const dirtyDescription = [changed.size ? formatSlCount(changed.size, {one:'neshranjena vrstica',two:'neshranjeni vrstici',few:'neshranjene vrstice',other:'neshranjenih vrstic'}) : '', modelDirty ? 'Neshranjen model' : ''].filter(Boolean).join(' · ');
  const cycleSort = (key: string) => {
    setSort(current => !current || current.key !== key ? {key, direction:1} : current.direction === 1 ? {key, direction:-1} : null);
    setPage(1);
  };
  const pagination = <EuiTablePagination page={safePage} pageCount={pageCount} onPageChange={setPage} itemsPerPage={pageSize} onChangeItemsPerPage={next=>{setPageSize(next);setPage(1);}} itemsPerPageOptions={[25,50,100]}/>;
  const options=filter==='category'?[['all','Vse kategorije'],...categories]:coverageOptions;
  const activeFilter=filter==='category'?category:coverage;
  const selectFilter=(value:string)=>{if(filter==='category')setCategory(value);if(filter==='coverage')setCoverage(value);setPage(1);setFilter(null);};
  return <><AdminTableLayout className={`${adminTableCardClassName} ${styles.tableCard}`} style={adminTableCardStyle} headerClassName={adminTableHeaderClassName} contentClassName={`${adminTableContentClassName} ${styles.tableContent}`}
    headerLeft={<div className="flex min-w-0 flex-1 items-center gap-3"><AdminSearchInput value={search} onChange={e=>{setSearch(e.target.value);setPage(1);}} placeholder="Poišči artikel ali SKU …" aria-label="Poišči artikel ali SKU" wrapperClassName="!h-9 min-w-0 !w-full max-w-[390px] !rounded-md !bg-slate-50" inputClassName={adminTableSearchInputClassName} iconClassName={adminTableSearchIconClassName}/></div>}
    headerRight={<div className={styles.actions}>
      <AdminSaveStatus dirty={dirty} saving={busy} className="mx-1" testId="pricing-stock-save-status" title={dirtyDescription||undefined}/>
      <ColumnVisibilityControl options={columns.filter(c=>c.key!=='edit').map(c=>({key:c.key,label:c.label,disabled:c.key==='identity'}))} visibleMap={visible} onToggle={key=>setVisible(current=>({...current,[key]:!current[key]}))} showLabel={false} icon={<SlidersHorizontal className={adminActionIconSizeClassName} strokeWidth={1.5}/>} triggerClassName={adminTableNeutralIconButtonClassName}/>
      <button type="button" className={adminTableNeutralIconButtonClassName} onClick={exportRows} title="Izvoz prikazanih ali izbranih vrstic" aria-label="Izvozi cene"><DownloadIcon/></button>
      <button type="button" className={`${styles.button} ${adminTextButtonTypographyTokenClasses}`} disabled={busy||!dirty} onClick={props.onReset}>Razveljavi</button>
      <button type="button" className={styles.primary} disabled={props.saveDisabled} onClick={props.onSave}>{busy?'Shranjujem …':'Shrani spremembe'}</button>
    </div>}
    filterRowLeft={filterChips.length>0?<div className="flex flex-wrap items-center gap-2" aria-label="Aktivni filtri" data-testid="pricing-stock-active-filters">
      {filterChips.map(chip=><span key={chip.key} className={filterPillTokenClasses.base}>
        <span>{chip.title}{' '}<span className="font-semibold">{chip.value}</span></span>
        <button type="button" onClick={()=>{chip.clear();setPage(1);}} className={filterPillTokenClasses.clear} aria-label={`Odstrani filter ${chip.title} ${chip.value}`}>{filterPillClearGlyph}</button>
      </span>)}
    </div>:null}
    filterRowRight={pagination} showDivider={false}
    footerRight={pagination}>
    <table ref={table} className={styles.table} style={{minWidth:shownColumns.reduce((sum,column)=>sum+column.width,36)}} aria-label="Cene in zaloga različic" data-testid="pricing-stock-table">
      <colgroup><col style={{width:36}}/>{shownColumns.map(column=><col key={column.key} style={{width:column.key==='edit'?column.width:((column.width/(shownColumns.filter(c=>c.key!=='edit').reduce((sum,c)=>sum+c.width,0)))*100)+'%'}}/>)}</colgroup>
      <thead><tr>
        <th className={styles.selection}><AdminCheckbox checked={allSelected} aria-label="Izberi prikazane različice" onChange={()=>{const next=new Set(selected);visibleRows.forEach(row=>{if(allSelected)next.delete(row.variantId);else next.add(row.variantId);});onSelect(next);}}/></th>
        {shownColumns.map(column=>{
          const filterKind:HeaderFilter|null=column.key==='identity'?'category':isNumericFilter(column.key)?column.key:column.key==='coveragePercent'?'coverage':null;
          const filterActive=filterKind==='category'?category!=='all':filterKind==='coverage'?coverage!=='all':isNumericFilter(filterKind)&&(isNumericRangeActive(numericRanges[filterKind]??emptyRange)||(filterKind==='rvc'&&isNumericRangeActive(numericRanges.rvcPercent??emptyRange)));
          const alignment=column.editable?(filterKind?styles.filteredInputHeader:styles.inputHeader):['rvc','targetRvc','recommendedPrice','reserved','available'].includes(column.key)?styles.numberHeader:column.key==='coveragePercent'?styles.coverageHeader:column.key==='edit'?styles.editHeader:'';
          return <th key={column.key} className={column.key==='identity'?styles.identity:undefined} aria-sort={sort?.key===column.key?(sort.direction===1?'ascending':'descending'):'none'}>
            <div className={`${styles.headerControl} ${alignment}`}>
              <div className={adminTableHeaderContentClassName}>
                {column.sort?<button type="button" className={`${adminTableHeaderButtonClassName} ${styles.sortButton} ${sort?.key===column.key?'underline underline-offset-2 !text-[#1982bf]':''}`} onClick={()=>cycleSort(column.key)} title={sort?.key===column.key?(sort.direction===1?'Razvrsti padajoče':'Ponastavi vrstni red'):'Razvrsti naraščajoče'}>
                  {['purchaseNet','saleNet'].includes(column.key)?<span className={adminTableTextStackClassName}><span className={adminTablePrimaryTextClassName}>{column.label}</span><small className={adminTableSecondaryTextClassName}>brez DDV</small></span>:<span>{column.label}</span>}
                </button>:<span className={adminTableHeaderButtonClassName}>{column.label}</span>}
                {filterKind&&<button type="button" data-header-filter-root="true" className={HEADER_FILTER_BUTTON_CLASS} data-active={filterActive} aria-label={filterKind==='category'?'Filtriraj po kategoriji':filterKind==='coverage'?'Filtriraj po pokritju':numericFilterLabels[filterKind].label} aria-expanded={filter===filterKind} onClick={event=>openFilter(filterKind,event.currentTarget)}><ColumnFilterIcon className="!h-[12px] !w-[12px]"/></button>}
              </div>
            </div>
          </th>;
        })}
      </tr>
        <PricingStockColumnActions rows={rows} filteredRows={filtered} columns={shownColumns.map(column=>column.key)} selected={selected} errors={errors} canEditPrices={canEditPrices} canEditCosts={canEditCosts} disabled={busy} onApply={props.onBulk}/>
      </thead>
      <tbody>{visibleRows.map(row=><tr key={row.variantId} className={changed.has(row.variantId)?styles.changed:selected.has(row.variantId)?styles.selected:undefined} data-variant-id={row.variantId} data-editing={editSession?.variantId===row.variantId||undefined}><td className={styles.selection}><AdminCheckbox checked={selected.has(row.variantId)} aria-label={'Izberi '+rowLabel(row)} onChange={()=>toggleRow(row.variantId)}/></td>{shownColumns.map(column=>{
        if(column.key==='identity')return <td key={column.key} className={styles.identity} title={rowLabel(row)+' · '+row.categoryLabel}><div className={adminTableTextStackClassName}><strong className={adminTablePrimaryTextClassName}>{rowLabel(row)}</strong><small className={adminTableSecondaryTextClassName}>{row.sku||'Brez SKU'}</small></div></td>;
        if(column.editable){
          const field=column.editable,error=errors[`${row.variantId}:${field}`],permitted=field==='saleNet'?canEditPrices:canEditCosts,isEditing=editSession?.variantId===row.variantId&&permitted,unit=field==='workMinutes'?'min':'€';
          const value=drafts[row.variantId]?.[field]??row[field],raw=decimalText(value);
          const formatted=field==='workMinutes'?workMinutesText(value):decimalText(value);
          const display=(error?raw:field==='workMinutes'?formatted:decimalText(row[field]))||'—',inputValue=field==='workMinutes'&&typingMinutesId!==row.variantId&&!error?formatted:raw;
          return <td key={column.key} className={isNumericFilter(field)?styles.filteredInputNumber:undefined} data-pricing-field={field} data-pricing-empty={!isEditing&&display==='—'||undefined} data-pricing-read={isEditing?undefined:`${row.variantId}:${field}`} title={error||(field==='workMinutes'?workMinutesTitle(value):field==='purchaseNet'?'Trenutna nabavna cena brez DDV na enoto. Posodobljeno: '+timestamp(row.purchaseUpdatedAt):field==='otherCosts'?'Drugi spremenljivi stroški na kos brez DDV. Če jih ni, vnesite 0.':fieldLabels[field])}>
            <ArticleTableNumber editing={isEditing} invalid={!!error} unit={isEditing||display!=='—'?unit:undefined} data-pricing-cell={`${row.variantId}:${field}`} inputMode="decimal" aria-label={`${fieldLabels[field]} · ${row.sku||rowLabel(row)}`} aria-invalid={!!error} disabled={busy} value={isEditing?inputValue:display} placeholder="—" onFocus={e=>e.currentTarget.select()} onChange={e=>{if(field==='workMinutes')setTypingMinutesId(row.variantId);props.onEdit(row.variantId,field,e.target.value);}} onBlur={()=>{if(field==='workMinutes')setTypingMinutesId(null);}} onKeyDown={keyDown} onPaste={e=>{paste(e,row,field);if(e.isDefaultPrevented())setTypingMinutesId(null);}}/>
          </td>;
        }
        if(column.key==='rvc')return <td key={column.key} className={`${styles.number} ${styles.filteredNumber}`}><div className={adminTableTextStackClassName}><span className={adminTablePrimaryTextClassName}>{money(row.calculation.rvc)}</span><small className={adminTableSecondaryTextClassName}>{percent(row.calculation.rvcPercent)}</small></div></td>;
        if(column.key==='targetRvc'){
          const missing=getMissingFormulaFields(row,model),description=missing.length?'Manjka: '+missing.map(field=>fieldLabels[field]).join(', ')+'. Če stroškov ali dela ni, vnesite 0.':row.calculation.errors.map(issue=>issue.message).join(' ')||'Izračun iz veljavne enačbe, parametrov modela in podatkov te različice.';
          return <td key={column.key} className={`${styles.number} ${styles.filteredNumber}`} title={description} data-target-rvc={row.variantId}>
            {money(row.calculation.targetRvc)}
          </td>;
        }
        if(column.key==='recommendedPrice')return <td key={column.key} className={styles.number}>{money(row.calculation.recommendedPrice)}</td>;
        if(column.key==='coveragePercent')return <td key={column.key} title={row.calculation.errors.filter(issue=>issue.code!=='MISSING_VALUE').map(issue=>issue.message).join(' ')||(row.calculation.status==='missing'?'Za izračun vnesite ceni, čas dela in druge stroške. Druge stroške vključite z izbiro stolpcev.':'RVC / ciljna RVC; razlika je RVC minus ciljna RVC.')}><div className={`${styles.coverage} ${styles[row.calculation.status]}`}><i aria-hidden="true"/><div className={adminTableTextStackClassName}><span className={adminTablePrimaryTextClassName}>{row.calculation.coveragePercent!==null?percent(row.calculation.coveragePercent)+' · ':''}{row.calculation.statusLabel}</span><small className={adminTableSecondaryTextClassName}>{money(row.calculation.difference)}</small></div></div></td>;
        if(column.key==='purchaseUpdatedAt')return <td key={column.key} className="text-[12px] text-slate-500" title="Čas zadnje spremembe nabavne cene">{timestamp(row.purchaseUpdatedAt)}</td>;
        if(column.key==='reserved'||column.key==='available')return <td key={column.key} className={styles.number} title={row.reservationNote??(column.key==='available'?'Razpoložljiva zaloga za nova naročila.':'Potrjene odprte rezervacije.')}>{row[column.key]===null?'—':row[column.key]}</td>;
        const label=row.sku||rowLabel(row),reason=rowSaveReason(row.variantId);
        return <td key={column.key} className="text-center" data-pricing-actions={row.variantId}>
          {editSession?.variantId===row.variantId?<div className={adminTableInlineActionRowClassName}>
            <span title={reason||'Shrani'}><IconButton type="button" tone="neutral" size="sm" className={adminTableInlineConfirmButtonClassName} aria-label={'Shrani urejanje za '+label} disabled={busy||!!reason||!changed.has(row.variantId)} onClick={()=>void saveEditing()}>{busy?<Spinner size="sm" className="text-[#1982bf]"/>:<CheckIcon className={adminTableInlineConfirmIconClassName} strokeWidth={2.2}/>}</IconButton></span>
            <IconButton type="button" tone="neutral" size="sm" className={adminTableInlineCancelButtonClassName} aria-label={'Prekliči urejanje za '+label} title="Prekliči" disabled={busy} onClick={cancelEditing}><CloseIcon className={adminTableInlineCancelIconClassName} strokeWidth={1.9}/></IconButton>
          </div>:<RowActionsDropdown label={'Možnosti za '+label} editScope={'pricing:'+row.variantId} menuWidth={160} menuClassName="w-40" items={[
            {key:'quick-edit',label:'Hitro urejanje',icon:<PencilIcon/>,disabled:busy||(!canEditPrices&&!canEditCosts),onSelect:()=>requestEditing(row.variantId)},
            {key:'open',label:'Odpri artikel',icon:<OpenArticleIcon/>,disabled:busy,onSelect:()=>props.onOpen(row)}
          ]}/>}
        </td>;
      })}</tr>)}{visibleRows.length===0&&<tr><td colSpan={shownColumns.length+1} className={styles.empty}>Nobena različica ne ustreza izbranim filtrom.</td></tr>}</tbody>
    </table>
    <HeaderFilterPortal open={filter!==null}>
      {numericFilterKey?<div ref={filterPanel} role="dialog" className={styles.numericFilterPanel} style={filterStyle} aria-label={numericFilterLabels[numericFilterKey].title} onKeyDown={event=>{if(event.key==='Enter'&&event.target instanceof HTMLInputElement){event.preventDefault();applyRange(draftRange);}}}>
        <AdminRangeFilterPanel title={numericFilterLabels[numericFilterKey].title}
          titleAccessory={filter==='rvc'?<SegmentedControl size="sm" value={rvcFilterKey} options={[
            {value:'rvc',label:'€',activeClassName:'!bg-[color:var(--blue-500)] !text-white'},
            {value:'rvcPercent',label:'%',activeClassName:'!bg-[color:var(--blue-500)] !text-white'}
          ]} onChange={value=>{
            if(value!=='rvc'&&value!=='rvcPercent')return;
            setRvcFilterKey(value);setDraftRange(numericRanges[value]??emptyRange);
          }}/>:undefined} draftRange={draftRange} onDraftChange={setDraftRange} decimalInput error={rangeError} onConfirm={()=>applyRange(draftRange)} onReset={()=>applyRange(emptyRange)}/>
      </div>:<div ref={filterPanel} role="menu" className={styles.filterPanel} style={filterStyle} aria-label={filter==='category'?'Kategorija':'Pokritje'}>{options.map(([value,label])=><button key={value} type="button" role="menuitemradio" aria-checked={activeFilter===value} className={activeFilter===value?styles.filterActive:undefined} onClick={()=>selectFilter(value)}>{label}</button>)}</div>}
    </HeaderFilterPortal>
  </AdminTableLayout>
  <UnsavedChangesDialog open={pendingEditId!==null} label="urejanjem druge različice" isSaving={busy} saveDisabled={!!editSession&&!!rowSaveReason(editSession.variantId)} validationMessage={editSession?rowSaveReason(editSession.variantId)||undefined:undefined}
    onSave={()=>{const next=pendingEditId;void saveEditing().then(saved=>{if(saved&&next!==null)startEditing(next);});}}
    onContinueEditing={()=>{if(!busy)setPendingEditId(null);}}
    onDiscard={()=>{if(busy)return;if(editSession)props.onRestoreRow(editSession.variantId,editSession.snapshot);if(pendingEditId!==null)startEditing(pendingEditId);}}
  /></>;
}
