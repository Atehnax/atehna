import type { RefObject, ReactNode } from 'react';
import Selecto from 'react-selecto';
import { Button } from '@/shared/ui/button';
import { IconButton } from '@/shared/ui/icon-button';
import { MenuItem, MenuPanel } from '@/shared/ui/menu';
import { Input } from '@/shared/ui/input';

const padTwoDigits = (value: number) => String(value).padStart(2, '0');

const formatMillerDate = (value?: string) => {
  const parsedDate = value ? new Date(value) : new Date();
  const safeDate = Number.isNaN(parsedDate.getTime()) ? new Date() : parsedDate;

  const day = padTwoDigits(safeDate.getDate());
  const month = padTwoDigits(safeDate.getMonth() + 1);
  const year = safeDate.getFullYear();

  return `${day}-${month}-${year}`;
};

const millerRowGridClass = 'grid grid-cols-3 items-center gap-x-3';

const getMillerNameColumnLabel = (column: MillerColumn) => {
  if (column.kind === 'items') return 'Artikel';
  if (column.key === 'categories') return 'Kategorija';
  return 'Podkategorija';
};

type MillerColumn = {
  key: string;
  title: string;
  ids: string[];
  kind: 'categories' | 'subcategories' | 'items';
  rows: Array<{
    id: string;
    label: string;
    tone: string;
    isInactive?: boolean;
    createdAt?: string;
    updatedAt?: string;
    kind: 'category' | 'subcategory' | 'item';
    onClick: (event: import('react').MouseEvent<HTMLButtonElement>) => void;
    onDragStart: () => void;
    onDropTarget: string;
  }>;
};

export function AdminCategoriesMiller({
  activeView,
  millerDirty,
  breadcrumbs,
  searchQuery,
  onSearchQueryChange,
  activeColumnKind,
  onRequestSave,
  saving,
  millerHistoryMenuRef,
  isHistoryMenuOpen,
  onToggleHistoryMenu,
  canUndoStagedChanges,
  onUndo,
  canRestoreCommittedHistory,
  hasPendingStagedChanges,
  onRestore,
  millerError,
  millerViewportRef,
  onSelectIds,
  millerColumns,
  plusIcon,
  onAddNode,
  onRequestDelete,
  millerSelection,
  millerDropTarget,
  rootId,
  setMillerDropTarget,
  applyMillerMove,
  millerRename,
  setMillerRename,
  applyMillerRename
}: {
  activeView: 'table' | 'miller';
  millerDirty: boolean;
  breadcrumbs: Array<{ label: string; onClick?: () => void; isCurrent: boolean }>;
  searchQuery: string;
  onSearchQueryChange: (value: string) => void;
  activeColumnKind: 'categories' | 'subcategories' | 'items';
  onRequestSave: () => void;
  saving: boolean;
  millerHistoryMenuRef: RefObject<HTMLDivElement>;
  isHistoryMenuOpen: boolean;
  onToggleHistoryMenu: () => void;
  canUndoStagedChanges: boolean;
  onUndo: () => void;
  canRestoreCommittedHistory: boolean;
  hasPendingStagedChanges: boolean;
  onRestore: () => void;
  millerError: string | null;
  millerViewportRef: RefObject<HTMLDivElement>;
  onSelectIds: (ids: string[]) => void;
  millerColumns: MillerColumn[];
  plusIcon: ReactNode;
  onAddNode: (column: 'categories' | 'subcategories' | 'items') => void;
  onRequestDelete: (column: 'categories' | 'subcategories' | 'items') => void;
  millerSelection: string[];
  millerDropTarget: string | null;
  rootId: string;
  setMillerDropTarget: (id: string | null) => void;
  applyMillerMove: (targetId: string) => void;
  millerRename: { id: string; value: string } | null;
  setMillerRename: (rename: { id: string; value: string } | null) => void;
  applyMillerRename: () => void;
}) {
  const millerWindowStyles = (() => {
    const count = millerColumns.length;
    if (count <= 1) {
      return [{ width: '100%', marginLeft: '0%', zIndex: 1 }];
    }

    if (count === 2) {
      return [
        { width: '45%', marginLeft: '0%', zIndex: 1 },
        { width: '55%', marginLeft: '0%', zIndex: 2 }
      ];
    }

    const currentWidth = 33;
    const historyWidth = 67;
    const previousCount = count - 1;
    const overlap = Math.max(2.2, Math.min(5, historyWidth / (previousCount * 5)));
    const previousWidth = Math.max(12, (historyWidth + overlap * (previousCount - 1)) / previousCount);

    const styles = Array.from({ length: previousCount }, (_, index) => ({
      width: `${previousWidth}%`,
      marginLeft: index === 0 ? '0%' : `-${overlap}%`,
      zIndex: index + 1
    }));

    styles.push({ width: `${currentWidth}%`, marginLeft: '0%', zIndex: count + 1 });
    return styles;
  })();

  return (
    <section className={activeView === 'miller' ? 'rounded-2xl border border-slate-200 bg-white p-3 shadow-sm' : 'hidden'}>
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="ml-[30px] min-w-0 text-xs text-slate-600">
          <nav className="truncate whitespace-nowrap text-sm text-slate-700" aria-label="Breadcrumb">
            {breadcrumbs.map((crumb, index) => (
              <span key={`${crumb.label}-${index}`}>
                {index > 0 ? <span className="mx-1 text-slate-400">/</span> : null}
                {crumb.onClick && !crumb.isCurrent ? (
                  <button
                    type="button"
                    onClick={crumb.onClick}
                    className="text-slate-600 hover:text-slate-900 focus-visible:outline-none focus-visible:underline"
                  >
                    {crumb.label}
                  </button>
                ) : (
                  <span className={crumb.isCurrent ? 'font-semibold text-slate-900' : ''}>{crumb.label}</span>
                )}
              </span>
            ))}
          </nav>
        </div>
        <div className="flex items-center gap-2">
          <Input
            value={searchQuery}
            onChange={(event) => onSearchQueryChange(event.target.value)}
            placeholder="Išči"
            className="h-8 w-40"
            aria-label="Išči v Miller stolpcih"
          />
          <Button type="button" variant="primary" size="toolbar" onClick={onRequestSave} disabled={!millerDirty || saving}>
            Shrani spremembe
          </Button>
          <IconButton type="button" tone="neutral" aria-label="Dodaj" onClick={() => onAddNode(activeColumnKind)}>
            {plusIcon}
          </IconButton>
          <IconButton
            type="button"
            tone="danger"
            aria-label="Izbriši"
            onClick={() => onRequestDelete(activeColumnKind)}
            disabled={!millerSelection.some((id) => millerColumns.find((column) => column.kind === activeColumnKind)?.ids.includes(id))}
          >
            ✕
          </IconButton>
          <div className="relative" ref={millerHistoryMenuRef}>
            <IconButton type="button" tone="neutral" aria-label="Zgodovina" onClick={onToggleHistoryMenu}>⋮</IconButton>
            {isHistoryMenuOpen ? (
              <MenuPanel className="absolute right-0 top-9 z-20 w-40">
                <MenuItem
                  disabled={!canUndoStagedChanges}
                  onClick={() => {
                    if (!canUndoStagedChanges) return;
                    onUndo();
                  }}
                >
                  Razveljavi
                </MenuItem>

                <MenuItem
                  disabled={!canRestoreCommittedHistory || hasPendingStagedChanges}
                  onClick={() => {
                    if (!canRestoreCommittedHistory || hasPendingStagedChanges) return;
                    onRestore();
                  }}
                >
                  Obnovi
                </MenuItem>
              </MenuPanel>
            ) : null}
          </div>
        </div>
      </div>

      {millerError ? <p className="mb-3 rounded-lg border border-[var(--danger-300)] bg-[var(--danger-100)] px-3 py-2 text-xs text-[var(--danger-700)]">{millerError}</p> : null}

      <Selecto
        container={millerViewportRef.current ?? undefined}
        selectableTargets={['.miller-select-item']}
        selectByClick={false}
        selectFromInside={false}
        hitRate={0}
        onSelectEnd={(event: { selected: Element[] }) => {
          const ids = event.selected
            .map((node: Element) => (node as HTMLElement).dataset.millerId)
            .filter((id: string | undefined): id is string => Boolean(id));
          if (ids.length > 0) onSelectIds(ids);
        }}
      />

      <div ref={millerViewportRef} className="flex items-stretch overflow-x-auto pb-1">
        {millerColumns.map((column, index) => (
          <div
            key={column.key}
            className="min-w-0 overflow-hidden rounded-xl border border-slate-200 bg-white"
            style={millerWindowStyles[index]}
          >
            <div className="flex items-center justify-between border-b border-slate-200 bg-white px-2.5 py-2">
              <h3 className="text-xs font-semibold text-slate-700">{column.title}</h3>
            </div>

            <div
              className={`h-[520px] space-y-0 overflow-auto p-1.5 ${millerDropTarget === (column.kind === 'categories' ? rootId : column.rows[0]?.onDropTarget) ? 'ring-2 ring-[#3e67d6]/40' : ''}`}
              onDragOver={(event) => {
                event.preventDefault();
                setMillerDropTarget(column.kind === 'categories' ? rootId : column.rows[0]?.onDropTarget ?? null);
              }}
              onDrop={(event) => {
                event.preventDefault();
                const dropTarget = column.kind === 'categories' ? rootId : column.rows[0]?.onDropTarget ?? rootId;
                applyMillerMove(dropTarget);
                setMillerDropTarget(null);
              }}
            >
              {column.rows.length === 0 ? <p className="px-2 py-3 text-xs text-slate-500">Ni zapisov.</p> : (
                <>
                  <div className={`${millerRowGridClass} px-2 py-1 text-[11px] font-semibold text-slate-500`}>
                    <span>{getMillerNameColumnLabel(column)}</span>
                    <span className="text-center">Ustvarjeno</span>
                    <span className="text-center">Spremenjeno</span>
                  </div>
                  {column.rows.filter((row) => row.label.toLowerCase().includes(searchQuery.trim().toLowerCase())).map((row) => (
                    millerRename?.id === row.id && row.kind !== 'item' ? (
                      <input
                        key={row.id}
                        value={millerRename.value}
                        onChange={(event) => setMillerRename({ id: row.id, value: event.target.value })}
                        onBlur={applyMillerRename}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter') applyMillerRename();
                          if (event.key === 'Escape') setMillerRename(null);
                        }}
                        className="block w-full rounded-md border border-[#3e67d6]/40 bg-white px-2 py-1 text-xs font-medium text-slate-700 outline-none"
                        autoFocus
                      />
                    ) : (
                      <button
                        key={row.id}
                        type="button"
                        data-miller-id={row.id}
                        className={`miller-select-item ${millerRowGridClass} w-full rounded-md px-2 py-1 text-left text-xs font-medium transition ${millerSelection.includes(row.id) || row.tone === 'focused' ? `${row.isInactive ? 'text-slate-400' : 'text-[#1f3f93]'} bg-[#f0f4ff]` : `${row.isInactive ? 'text-slate-400' : 'text-slate-700'} bg-white hover:bg-slate-100`}`}
                        onClick={row.onClick}
                        onDoubleClick={() => {
                          if (row.kind === 'item') return;
                          setMillerRename({ id: row.id, value: row.label });
                        }}
                        onContextMenu={(event) => {
                          if (row.kind === 'item') return;
                          event.preventDefault();
                          setMillerRename({ id: row.id, value: row.label });
                        }}
                        draggable
                        onDragStart={(event) => { event.dataTransfer.setData('text/plain', row.id); row.onDragStart(); }}
                        onDragEnd={() => setMillerDropTarget(null)}
                        onDragOver={(event) => {
                          event.preventDefault();
                          setMillerDropTarget(row.id);
                        }}
                        onDrop={(event) => {
                          event.preventDefault();
                          applyMillerMove(row.id);
                        }}
                      >
                        <span className="min-w-0 truncate whitespace-nowrap" style={row.isInactive ? { color: '#94a3b8' } : undefined}>{row.label}</span>
                        <span className="truncate whitespace-nowrap text-center text-[11px] font-normal">{formatMillerDate(row.createdAt)}</span>
                        <span className="truncate whitespace-nowrap text-center text-[11px] font-normal">{formatMillerDate(row.updatedAt)}</span>
                      </button>
                    )
                  ))}
                </>
              )}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
