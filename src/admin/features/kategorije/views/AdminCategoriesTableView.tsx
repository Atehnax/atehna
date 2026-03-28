import type { RefObject, ReactNode } from 'react';
import { DndContext, closestCenter, type DragEndEvent } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { Button } from '@/shared/ui/button';
import { IconButton } from '@/shared/ui/icon-button';
import { MenuItem, MenuPanel } from '@/shared/ui/menu';
import { AdminTableLayout } from '@/shared/ui/admin-table';
import { ADMIN_CONTROL_HEIGHT, ADMIN_CONTROL_PADDING_X } from '@/shared/ui/admin-controls/controlSizes';
import { Spinner } from '@/shared/ui/loading';
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

export function AdminCategoriesTableView({
  activeView,
  query,
  onQueryChange,
  onBulkDelete,
  selectedRows,
  isBulkDeleting,
  bulkDeleteButtonClass,
  onRequestSave,
  tableDirty,
  saving,
  tableHistoryMenuRef,
  isHistoryMenuOpen,
  onToggleHistoryMenu,
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
  treeRows
}: {
  activeView: CategoriesView;
  query: string;
  onQueryChange: (value: string) => void;
  onBulkDelete: () => void;
  selectedRows: string[];
  isBulkDeleting: boolean;
  bulkDeleteButtonClass: string;
  onRequestSave: () => void;
  tableDirty: boolean;
  saving: boolean;
  tableHistoryMenuRef: RefObject<HTMLDivElement>;
  isHistoryMenuOpen: boolean;
  onToggleHistoryMenu: () => void;
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
}) {
  return (
    <div className={activeView === 'table' ? 'w-full space-y-4' : 'hidden'}>
      <section>
        <AdminTableLayout
          className="border"
          contentClassName="overflow-x-auto"
          headerLeft={
            <input
              id="categories-table-search"
              name="categoriesTableSearch"
              value={query}
              onChange={(event) => onQueryChange(event.target.value)}
              placeholder="Išči po kategoriji ali opisu ..."
              className={`${ADMIN_CONTROL_HEIGHT} min-w-[240px] flex-1 rounded-xl border border-slate-300 ${ADMIN_CONTROL_PADDING_X} text-[11px] text-slate-700 outline-none focus:border-[#3e67d6] focus:ring-0 focus:ring-[#3e67d6]`}
            />
          }
          headerRight={
            <>
              <button type="button" onClick={onBulkDelete} disabled={selectedRows.length === 0 || isBulkDeleting} className={bulkDeleteButtonClass}>
                {isBulkDeleting ? (
                  <span className="inline-flex items-center gap-1.5">
                    <Spinner size="sm" className="text-[var(--danger-600)]" />
                    Brisanje...
                  </span>
                ) : (
                  'Izbriši'
                )}
              </button>
              <Button variant="primary" size="toolbar" onClick={onRequestSave} disabled={!tableDirty || saving}>Shrani spremembe</Button>
              <div className="relative" ref={tableHistoryMenuRef}>
                <IconButton type="button" size="md" tone="neutral" aria-label="Zgodovina" onClick={onToggleHistoryMenu}>⋮</IconButton>
                {isHistoryMenuOpen ? (
                  <MenuPanel className="absolute right-0 top-9 z-20 w-40">
                    <MenuItem disabled={!canUndoStagedChanges} onClick={() => { if (!canUndoStagedChanges) return; onUndo(); }}>Razveljavi</MenuItem>
                    <MenuItem disabled={!canRestoreCommittedHistory || hasPendingStagedChanges} onClick={() => { if (!canRestoreCommittedHistory || hasPendingStagedChanges) return; onRestore(); }}>Obnovi</MenuItem>
                  </MenuPanel>
                ) : null}
              </div>
            </>
          }
        >
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onTreeDragEnd}>
            <SortableContext items={visibleRowIds} strategy={verticalListSortingStrategy}>
              <table className="table-fixed border-separate border-spacing-0 border-x border-b border-slate-200 text-[11px]" style={{ width: '100%', minWidth: `${categoryTableTotalWidth}px` }}>
                <colgroup>
                  <col style={{ width: `${categoryTableColumnWidths.select}px` }} />
                  <col style={{ width: `${categoryTableColumnWidths.category}px` }} />
                  <col style={{ width: `calc(100% - ${categoryTableFixedWidthWithoutDescription}px)` }} />
                  <col style={{ width: `${categoryTableColumnWidths.subcategories}px` }} />
                  <col style={{ width: `${categoryTableColumnWidths.items}px` }} />
                  <col style={{ width: `${categoryTableColumnWidths.visibility}px` }} />
                  <col style={{ width: `${categoryTableColumnWidths.actions}px` }} />
                </colgroup>
                <thead className="bg-slate-50/90">
                  <tr>
                    <th className="border-b border-slate-200 px-2 py-2 text-center text-[11px] font-semibold text-slate-600"><input id="categories-select-all" name="categoriesSelectAll" ref={selectAllRef} type="checkbox" checked={allRowsSelected} onChange={onToggleSelectAll} aria-label="Izberi vse" /></th>
                    <th className="border-b border-slate-200 px-2.5 py-0 text-left text-[11px] font-semibold text-slate-600 align-middle">
                      <div className="relative flex h-12 items-center gap-2 overflow-visible px-1">
                        <div className="relative shrink-0 overflow-visible" style={{ width: `${treeButtonDiameter}px`, height: `${treeRowHeight}px` }}>
                          <div className="absolute inset-y-0 z-10 flex items-center justify-center" style={{ left: 0, width: `${treeButtonDiameter}px` }}>
                            <button type="button" onClick={onToggleAllExpanded} className="inline-grid h-4 w-4 place-items-center rounded-[2px] border border-slate-300 text-slate-600" aria-label="Razširi/skrij vse kategorije">
                              {allExpanded ? <svg viewBox="0 0 16 16" className="h-2.5 w-2.5" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path d="M3 8h10" /></svg> : <svg viewBox="0 0 16 16" className="h-2.5 w-2.5" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path d="M3 8h10M8 3v10" /></svg>}
                            </button>
                          </div>
                        </div>
                        <span>Kategorija</span>
                      </div>
                    </th>
                    <th className="border-b border-slate-200 px-2.5 py-2 text-left text-[11px] font-semibold text-slate-600">Opis</th>
                    <th className="border-b border-slate-200 px-2.5 py-2 text-center text-[11px] font-semibold text-slate-600">Podkategorije</th>
                    <th className="border-b border-slate-200 px-2.5 py-2 text-center text-[11px] font-semibold text-slate-600">Izdelki</th>
                    <th className="h-11 border-b border-slate-200 px-2.5 py-0 text-center text-[11px] font-semibold text-slate-600 align-middle">
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
                    <th className="border-b border-slate-200 px-2.5 py-2 text-center text-[11px] font-semibold text-slate-600">Uredi</th>
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
