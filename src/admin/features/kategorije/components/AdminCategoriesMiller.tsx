import type { RefObject, ReactNode } from 'react';
import Selecto from 'react-selecto';
import { Button } from '@/shared/ui/button';
import { IconButton } from '@/shared/ui/icon-button';
import { MenuItem, MenuPanel } from '@/shared/ui/menu';

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
    kind: 'category' | 'subcategory' | 'item';
    onClick: (event: import('react').MouseEvent<HTMLButtonElement>) => void;
    onDragStart: () => void;
    onDropTarget: string;
  }>;
};

export function AdminCategoriesMiller({
  activeView,
  millerDirty,
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
  return (
    <section className={activeView === 'miller' ? 'rounded-2xl border border-slate-200 bg-white p-3 shadow-sm' : 'hidden'}>
      <div className="mb-3 flex items-center justify-between">
        <div className="text-xs text-slate-600">{millerDirty ? 'Neshranjene spremembe' : ''}</div>
        <div className="flex items-center gap-2">
          <Button type="button" variant="primary" size="toolbar" onClick={onRequestSave} disabled={!millerDirty || saving}>
            Shrani spremembe
          </Button>
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

      <div
        ref={millerViewportRef}
        className="grid auto-cols-[320px] grid-flow-col gap-3 overflow-x-auto"
      >
        {millerColumns.map((column) => (
          <div key={column.key} className="w-[320px] overflow-hidden rounded-xl border border-slate-200 bg-slate-50/40">
            <div className="flex items-center justify-between border-b border-slate-200 bg-white px-2.5 py-2">
              <h3 className="text-xs font-semibold text-slate-700">{column.title}</h3>
              <div className="flex items-center gap-1">
                <IconButton type="button" tone="neutral" aria-label="Dodaj" onClick={() => onAddNode(column.kind)}>
                  {plusIcon}
                </IconButton>
                <IconButton
                  type="button"
                  tone="danger"
                  aria-label="Izbriši"
                  onClick={() => onRequestDelete(column.kind)}
                  disabled={!millerSelection.some((id) => column.ids.includes(id))}
                >
                  ✕
                </IconButton>
              </div>
            </div>

            <div
              className={`h-[520px] space-y-1 overflow-auto p-1.5 ${millerDropTarget === (column.kind === 'categories' ? rootId : column.rows[0]?.onDropTarget) ? 'ring-2 ring-[#3e67d6]/40' : ''}`}
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
              {column.rows.length === 0 ? <p className="px-2 py-3 text-xs text-slate-500">Ni zapisov.</p> : column.rows.map((row) => (
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
                    className={`miller-select-item block w-full rounded-md border px-2 py-1 text-left text-xs font-medium transition ${millerSelection.includes(row.id) || row.tone === 'focused' ? `border-[#3e67d6]/50 bg-[#f0f4ff] ${row.isInactive ? 'text-slate-400' : 'text-[#1f3f93]'}` : `border-transparent bg-white ${row.isInactive ? 'text-slate-400' : 'text-slate-700'} hover:border-slate-200 hover:bg-slate-100`}`}
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
                    <span
                      style={row.isInactive ? { color: '#94a3b8' } : undefined}
                    >
                      {row.label}
                    </span>
                  </button>
                )
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
