'use client';

import { ChevronDown, ChevronRight, EyeOff, Layers3, Lock, Search, Type, X } from 'lucide-react';
import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react';
import type { OrderDocumentCanvasSelectionEntry } from '../lib/orderDocumentCanvasSelection';
import { filterOrderDocumentTemplateLayers, type OrderDocumentTemplateLayer } from '../lib/orderDocumentTemplateLayers';

export type OrderDocumentTemplateLayersPanelProps = {
  items: readonly OrderDocumentTemplateLayer[];
  selectedKeys: readonly string[];
  currentPage?: number;
  className?: string;
  onSelect: (entry: OrderDocumentCanvasSelectionEntry, options: { additive: boolean; pageNumber?: number }) => void;
};

const focusClass = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400';

export default function OrderDocumentTemplateLayersPanel({
  items, selectedKeys, currentPage, className = '', onSelect
}: OrderDocumentTemplateLayersPanelProps) {
  const [query, setQuery] = useState('');
  const [collapsed, setCollapsed] = useState<ReadonlyMap<string, string | undefined>>(new Map());
  const searchId = useId();
  const rowRefs = useRef(new Map<string, HTMLButtonElement>());
  const navRef = useRef<HTMLElement>(null);
  const selected = useMemo(() => new Set(selectedKeys), [selectedKeys]);
  const filtered = useMemo(() => filterOrderDocumentTemplateLayers(items, query), [items, query]);
  const itemByKey = useMemo(() => new Map(items.map((item) => [item.key, item])), [items]);
  const selectedAncestors = useMemo(() => {
    const result = new Set<string>();
    for (const key of selectedKeys) {
      let parentKey = itemByKey.get(key)?.parentKey;
      while (parentKey && !result.has(parentKey)) {
        result.add(parentKey);
        parentKey = itemByKey.get(parentKey)?.parentKey;
      }
    }
    return result;
  }, [itemByKey, selectedKeys]);
  const primaryKey = selectedKeys.at(-1);

  useEffect(() => {
    const row = primaryKey ? rowRefs.current.get(primaryKey) : undefined;
    const nav = navRef.current;
    if (!row || !nav) return;
    // Scroll this navigation pane only; changing canvas selection must not move the page.
    const rowBounds = row.getBoundingClientRect();
    const navBounds = nav.getBoundingClientRect();
    if (rowBounds.top < navBounds.top) nav.scrollTop -= navBounds.top - rowBounds.top;
    else if (rowBounds.bottom > navBounds.bottom) nav.scrollTop += rowBounds.bottom - navBounds.bottom;
  }, [primaryKey, filtered]);

  const renderScope = (parentKey: string | null, depth = 0): ReactNode => {
    const siblings = filtered.filter((item) => item.parentKey === parentKey);
    if (!siblings.length) return null;
    return <ul className="grid min-w-0 gap-0.5">
      {siblings.map((item) => {
        const hasChildren = filtered.some((child) => child.parentKey === item.key);
        const expanded = Boolean(query.trim()) || !collapsed.has(item.key) || (selectedAncestors.has(item.key) && collapsed.get(item.key) !== primaryKey);
        const isSelected = selected.has(item.key);
        const pageNumber = currentPage && item.pages.includes(currentPage) ? currentPage : item.pages[0];
        return <li key={item.key} className="min-w-0" data-order-document-layer={item.key} data-order-document-layer-parent={item.parentKey ?? 'root'} data-order-document-layer-selected={isSelected || undefined}>
          <div className={`flex min-w-0 items-center gap-0.5 rounded-lg border ${isSelected ? 'border-blue-200 bg-blue-50 text-blue-800' : 'border-transparent text-slate-600 hover:border-slate-200 hover:bg-slate-50'}`} style={{ paddingLeft: depth * 10 }}>
            {hasChildren ? <button
              type="button"
              aria-label={`${expanded ? 'Strni' : 'Razširi'} plast: ${item.label}`}
              aria-expanded={expanded}
              onClick={() => setCollapsed((current) => {
                const next = new Map(current);
                if (expanded) next.set(item.key, primaryKey); else next.delete(item.key);
                return next;
              })}
              className={`grid h-7 w-5 shrink-0 place-items-center rounded text-slate-400 hover:text-slate-700 ${focusClass}`}
            >{expanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}</button> : <span className="w-5 shrink-0" />}
            <button
              ref={(node) => { if (node) rowRefs.current.set(item.key, node); else rowRefs.current.delete(item.key); }}
              type="button"
              aria-label={`Izberi plast: ${item.label}${item.value ? ` — ${item.value}` : ''}`}
              aria-pressed={isSelected}
              title={[item.label, item.value, item.pages.length ? `Stran ${item.pages.join(', ')}` : '', !item.visible ? 'Skrito' : '', item.locked ? 'Zaklenjeno' : ''].filter(Boolean).join(' · ')}
              onClick={(event) => onSelect(item.selection, { additive: event.ctrlKey || event.metaKey, pageNumber })}
              className={`flex min-w-0 flex-1 items-center gap-1.5 rounded-md py-1.5 pr-1.5 text-left ${focusClass}`}
            >
              <span className="shrink-0 text-slate-400" aria-hidden="true">{item.selection.kind === 'element' ? <Layers3 className="h-3 w-3" /> : <Type className="h-3 w-3" />}</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[10px] font-semibold leading-4">{item.label}</span>
                {item.value ? <span className="block truncate text-[9px] leading-3 text-slate-500">{item.value}</span> : null}
              </span>
              {item.pages.length ? <span className="shrink-0 text-[8px] tabular-nums text-slate-400" aria-label={`Stran ${item.pages.join(', ')}`}>{item.pages.join(', ')}</span> : null}
              {!item.visible ? <EyeOff className="h-3 w-3 shrink-0 text-slate-400" aria-label="Skrito" /> : null}
              {item.locked ? <Lock className="h-3 w-3 shrink-0 text-slate-400" aria-label="Zaklenjeno" /> : null}
            </button>
          </div>
          {hasChildren && expanded ? renderScope(item.key, depth + 1) : null}
        </li>;
      })}
    </ul>;
  };

  return <aside className={`min-w-0 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm ${className}`} data-order-document-layers-panel>
    <div className="border-b border-slate-200 px-3 py-2.5">
      <h3 className="flex items-center gap-1.5 text-xs font-semibold text-slate-900"><Layers3 className="h-3.5 w-3.5" aria-hidden="true" />Plasti</h3>
      <p className="mt-1 text-[9px] leading-3 text-slate-500">Izberite element ali besedilo za urejanje.</p>
      <label htmlFor={searchId} className="sr-only">Poišči plast ali besedilo</label>
      <div className="relative mt-2">
        <Search className="pointer-events-none absolute left-2 top-2 h-3 w-3 text-slate-400" aria-hidden="true" />
        <input id={searchId} type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Poišči plast ali besedilo …" className={`h-7 w-full rounded-md border border-slate-200 bg-slate-50 pl-7 pr-7 text-[10px] text-slate-800 placeholder:text-slate-400 ${focusClass}`} data-order-document-layers-search />
        {query ? <button type="button" onClick={() => setQuery('')} aria-label="Počisti iskanje plasti" className={`absolute right-1 top-1 grid h-5 w-5 place-items-center rounded text-slate-400 hover:text-slate-700 ${focusClass}`}><X className="h-3 w-3" /></button> : null}
      </div>
    </div>
    <p className="border-b border-slate-100 px-3 py-1.5 text-[9px] text-slate-400">Ctrl/Cmd + klik izbere več plasti</p>
    <nav ref={navRef} aria-label="Plasti dokumenta PDF" className="max-h-[min(700px,calc(100vh-260px))] overflow-y-auto overscroll-contain p-1.5" data-appearance-editor-scroll-purpose="navigation">
      {filtered.length ? renderScope(null) : <p className="px-2 py-8 text-center text-[10px] text-slate-400" role="status">Ni plasti za »{query}«.</p>}
    </nav>
  </aside>;
}

