import type { RefObject, ReactNode } from 'react';
import { DndContext, closestCenter, type DragEndEvent } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { Button } from '@/shared/ui/button';
import { AdminCheckbox } from '@/shared/ui/checkbox';
import { IconButton } from '@/shared/ui/icon-button';
import { MenuItem, MenuPanel } from '@/shared/ui/menu';
import { AdminTableLayout } from '@/shared/ui/admin-table';
import { ActionRestoreIcon, ActionUndoIcon, TrashCanIcon } from '@/shared/ui/icons/AdminActionIcons';
import { Spinner } from '@/shared/ui/loading';
import { AdminSearchInput } from '@/shared/ui/admin-search-input';
import type { CategoryStatus, CategoriesView } from '../common/types';

const treeRowHeight = 48;
const treeButtonDiameter = 28;
const categoryTableColumnWidths = {
  select: 50,
  category: 315,
  description: 208,
  subcategories: 116,
  items: 100,
  visibility: 116,
  actions: 144
} as const;
const categoryTableTotalWidth = Object.values(categoryTableColumnWidths).reduce((sum, width) => sum + width, 0);
const categoryTableFixedWidthWithoutDescription = categoryTableTotalWidth - categoryTableColumnWidths.description;

type CategorySortKey = 'category' | 'subcategories' | 'items';
type CategorySortDirection = 'asc' | 'desc';


export function AdminCategoriesTableView({
  activeView,
  query,
  onQueryChange,
  onBulkDelete,
  selectedRows,
  isBulkDeleting,
  onRequestSave,
  tableDirty,
  saving,
  canUndoStagedChanges,
  onUndo,
  canRestoreCommittedHistory,
  hasPendingStagedChanges,
  onRestore,
  sensors,
  onTreeDragEnd,
  visibleRowIds,
  selectAllRef,
  allRowsSelected,
  onToggleSelectAll,
  allExpanded,
  onToggleAllExpanded,
  statusHeaderMenuRef,
  onToggleStatusHeaderMenu,
  isStatusHeaderMenuOpen,
  statusByRow,
  onStageStatusChange,
  treeRows,
  sortState,
  onSort
}: {
  activeView: CategoriesView;
  query: string;
  onQueryChange: (value: string) => void;
  onBulkDelete: () => void;
  selectedRows: string[];
  isBulkDeleting: boolean;
  onRequestSave: () => void;
  tableDirty: boolean;
  saving: boolean;
  canUndoStagedChanges: boolean;
  onUndo: () => void;
  canRestoreCommittedHistory: boolean;
  hasPendingStagedChanges: boolean;
  onRestore: () => void;
  sensors: ReturnType<typeof import('@dnd-kit/core').useSensors>;
  onTreeDragEnd: (event: DragEndEvent) => void;
  visibleRowIds: string[];
  selectAllRef: RefObject<HTMLInputElement>;
  allRowsSelected: boolean;
  onToggleSelectAll: () => void;
  allExpanded: boolean;
  onToggleAllExpanded: () => void;
  statusHeaderMenuRef: RefObject<HTMLDivElement>;
  onToggleStatusHeaderMenu: () => void;
  isStatusHeaderMenuOpen: boolean;
  statusByRow: Record<string, CategoryStatus>;
  onStageStatusChange: (nextStatuses: Record<string, CategoryStatus>) => void;
  treeRows: ReactNode;
  sortState: { key: CategorySortKey; direction: CategorySortDirection } | null;
  onSort: (key: CategorySortKey) => void;
}) {
  const canUseRestore = canRestoreCommittedHistory && !hasPendingStagedChanges;
  const hasSelectedRows = selectedRows.length > 0;

  const getSortHeaderClassName = (key: CategorySortKey) => {
    const isActive = sortState?.key === key;
    return `inline-flex items-center text-[11px] font-semibold transition-colors ${
      isActive ? 'text-slate-900 underline underline-offset-2' : 'text-slate-700 hover:text-[color:var(--blue-500)]'
    }`;
  };

  return (
    <div className={activeView === 'table' ? 'w-full space-y-4' : 'hidden'}>
      <section>
        <AdminTableLayout
          className="w-full border shadow-sm"
          style={{ background: '#ffffff', borderColor: '#e2e8f0', boxShadow: '0 10px 24px rgba(15,23,42,0.06)' }}
          headerClassName="!bg-white"
          contentClassName="overflow-x-auto overflow-y-visible bg-white"
          headerLeft={
            <div className="flex h-7 w-full items-stretch">
              <div className="min-w-0 w-full rounded-md border border-slate-200 bg-white transition-colors focus-within:border-[#3e67d6]">
                <AdminSearchInput
                  id="categories-table-search"
                  name="categoriesTableSearch"
                  value={query}
                  showIcon={false}
                  onChange={(event) => onQueryChange(event.target.value)}
                  placeholder="Poišči kategorije"
                  aria-label="Poišči kategorije"
                  className="!m-0 !h-7 min-w-0 w-full flex-1 !rounded-md !border-0 !bg-transparent !shadow-none !outline-none ring-0 transition-colors placeholder:text-slate-400 [--euiFormControlStateWidth:0px] focus:[--euiFormControlStateWidth:0px] focus-visible:[--euiFormControlStateWidth:0px] focus:!border-0 focus:!shadow-none focus:!outline-none focus-visible:!border-0 focus-visible:!shadow-none focus-visible:!outline-none"
                />
              </div>
            </div>
          }
          headerRight={
            <>
              <IconButton
                type="button"
                size="sm"
                tone="neutral"
                aria-label="Razveljavi"
                title="Razveljavi"
                onClick={onUndo}
                disabled={!canUndoStagedChanges}
              >
                <ActionUndoIcon />
              </IconButton>
              <IconButton
                type="button"
                size="sm"
                tone="neutral"
                aria-label="Obnovi"
                title="Obnovi"
                className={canUseRestore ? '!border-emerald-300 !bg-emerald-50/70 !text-emerald-700 !transition-none' : '!transition-none'}
                onClick={onRestore}
                disabled={!canUseRestore}
              >
                <ActionRestoreIcon />
              </IconButton>
              <IconButton
                type="button"
                size="sm"
                tone={hasSelectedRows ? 'danger' : 'neutral'}
                aria-label="Izbriši"
                title="Izbriši"
                className={hasSelectedRows ? '!border-rose-300 !bg-rose-50/70 !text-rose-700 !transition-none' : '!transition-none'}
                onClick={onBulkDelete}
                disabled={!hasSelectedRows || isBulkDeleting}
              >
                {isBulkDeleting ? <Spinner size="sm" className="text-[var(--danger-600)]" /> : <TrashCanIcon />}
              </IconButton>
              <Button
                variant="primary"
                size="toolbar"
                className="!h-7 !rounded-md !px-3 !text-[11px]"
                onClick={onRequestSave}
                disabled={!tableDirty || saving}
              >
                Shrani
              </Button>
            </>
          }
        >
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onTreeDragEnd}>
            <SortableContext items={visibleRowIds} strategy={verticalListSortingStrategy}>
              <table className="w-full table-fixed border-collapse text-[11px] font-['Inter',system-ui,sans-serif]" style={{ width: '100%', minWidth: `${categoryTableTotalWidth}px` }}>
                <colgroup>
                  <col style={{ width: `${categoryTableColumnWidths.select}px` }} />
                  <col style={{ width: `${categoryTableColumnWidths.category}px` }} />
                  <col style={{ width: `calc(100% - ${categoryTableFixedWidthWithoutDescription}px)` }} />
                  <col style={{ width: `${categoryTableColumnWidths.subcategories}px` }} />
                  <col style={{ width: `${categoryTableColumnWidths.items}px` }} />
                  <col style={{ width: `${categoryTableColumnWidths.visibility}px` }} />
                  <col style={{ width: `${categoryTableColumnWidths.actions}px` }} />
                </colgroup>
                <thead>
                  <tr>
                    <th className="h-11 border-b border-slate-200 bg-[color:var(--ui-neutral-bg)] px-2 py-2 text-center text-[11px] font-semibold text-slate-600"><AdminCheckbox id="categories-select-all" name="categoriesSelectAll" ref={selectAllRef} checked={allRowsSelected} onChange={onToggleSelectAll} aria-label="Izberi vse" /></th>
                    <th className="h-11 border-b border-slate-200 bg-[color:var(--ui-neutral-bg)] px-2.5 py-0 text-left text-[11px] font-semibold text-slate-600 align-middle">
                      <div className="relative flex h-12 items-center gap-2 overflow-visible px-1">
                        <div className="relative shrink-0 overflow-visible" style={{ width: `${treeButtonDiameter}px`, height: `${treeRowHeight}px` }}>
                          <div className="absolute inset-y-0 z-10 flex items-center justify-center" style={{ left: 0, width: `${treeButtonDiameter}px` }}>
                            <button type="button" onClick={onToggleAllExpanded} className="inline-grid h-4 w-4 place-items-center rounded-[2px] border border-slate-300 text-slate-600" aria-label="Razširi/skrij vse kategorije">
                              {allExpanded ? <svg viewBox="0 0 16 16" className="h-2.5 w-2.5" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path d="M3 8h10" /></svg> : <svg viewBox="0 0 16 16" className="h-2.5 w-2.5" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path d="M3 8h10M8 3v10" /></svg>}
                            </button>
                          </div>
                        </div>
                        <button type="button" onClick={() => onSort('category')} className={getSortHeaderClassName('category')}>
                          Kategorija
                        </button>
                      </div>
                    </th>
                    <th className="h-11 border-b border-slate-200 bg-[color:var(--ui-neutral-bg)] px-2.5 py-2 text-left text-[11px] font-semibold text-slate-600">Opis</th>
                    <th className="h-11 border-b border-slate-200 bg-[color:var(--ui-neutral-bg)] px-2.5 py-2 text-center text-[11px] font-semibold text-slate-600">
                      <button type="button" onClick={() => onSort('subcategories')} className={getSortHeaderClassName('subcategories')}>
                        Podkategorije
                      </button>
                    </th>
                    <th className="h-11 border-b border-slate-200 bg-[color:var(--ui-neutral-bg)] px-2.5 py-2 text-center text-[11px] font-semibold text-slate-600">
                      <button type="button" onClick={() => onSort('items')} className={getSortHeaderClassName('items')}>
                        Izdelki
                      </button>
                    </th>
                    <th className="h-11 border-b border-slate-200 bg-[color:var(--ui-neutral-bg)] px-2.5 py-0 text-center text-[11px] font-semibold text-slate-600 align-middle">
                      <div className="relative flex h-8 items-center justify-center" ref={statusHeaderMenuRef}>
                        <button type="button" onClick={onToggleStatusHeaderMenu} className={`inline-flex h-6 items-center rounded-md border px-2 text-[11px] font-semibold ${selectedRows.length > 0 ? 'border-slate-300 bg-white text-slate-700 hover:bg-[color:var(--hover-neutral)]' : 'border-transparent bg-transparent text-slate-500 cursor-default'}`} aria-haspopup="menu" aria-expanded={selectedRows.length > 0 ? isStatusHeaderMenuOpen : false} disabled={selectedRows.length === 0}>
                          {selectedRows.length > 0 ? `Vidnost ▾ (${selectedRows.length})` : 'Vidnost'}
                        </button>
                        {selectedRows.length > 0 && isStatusHeaderMenuOpen ? (
                          <MenuPanel className="absolute left-1/2 top-8 z-20 w-36 -translate-x-1/2">
                            <MenuItem onClick={() => onStageStatusChange({ ...statusByRow, ...Object.fromEntries(selectedRows.map((rowId) => [rowId, 'active' as CategoryStatus])) })}>Aktivna</MenuItem>
                            <MenuItem onClick={() => onStageStatusChange({ ...statusByRow, ...Object.fromEntries(selectedRows.map((rowId) => [rowId, 'inactive' as CategoryStatus])) })}>Neaktivna</MenuItem>
                          </MenuPanel>
                        ) : null}
                      </div>
                    </th>
                    <th className="h-11 border-b border-slate-200 bg-[color:var(--ui-neutral-bg)] px-2.5 py-2 text-center text-[11px] font-semibold text-slate-600">Uredi</th>
                  </tr>
                </thead>
                <tbody>{treeRows}</tbody>
              </table>
            </SortableContext>
          </DndContext>
        </AdminTableLayout>
      </section>
    </div>
  );
}
