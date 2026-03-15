import type { ReactNode, RefObject } from 'react';
import { DndContext, closestCenter, type DragEndEvent } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { Button } from '@/shared/ui/button';
import { IconButton } from '@/shared/ui/icon-button';
import { MenuItem, MenuPanel } from '@/shared/ui/menu';
import { AdminTableLayout } from '@/shared/ui/admin-table';
import { Spinner } from '@/shared/ui/loading';
import { ADMIN_CONTROL_HEIGHT, ADMIN_CONTROL_PADDING_X } from '@/shared/ui/admin-controls/controlSizes';

type CategoryStatus = 'active' | 'inactive';

export function AdminCategoriesMainTable({
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
  statusHeaderMenuRef,
  onToggleStatusHeaderMenu,
  isStatusHeaderMenuOpen,
  statusByRow,
  onStageStatusChange,
  treeRows
}: {
  activeView: 'table' | 'miller';
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
  statusHeaderMenuRef: RefObject<HTMLDivElement>;
  onToggleStatusHeaderMenu: () => void;
  isStatusHeaderMenuOpen: boolean;
  statusByRow: Record<string, CategoryStatus>;
  onStageStatusChange: (nextStatuses: Record<string, CategoryStatus>) => void;
  treeRows: ReactNode;
}) {
  return (
    <div className={activeView === 'table' ? 'space-y-5' : 'hidden'}>
      <section>
        <AdminTableLayout
          className="border"
          contentClassName="overflow-x-auto"
          headerLeft={
            <>
              <input
                value={query}
                onChange={(event) => onQueryChange(event.target.value)}
                placeholder="Išči po kategoriji ali opisu ..."
                className={`${ADMIN_CONTROL_HEIGHT} min-w-[260px] flex-1 rounded-xl border border-slate-300 ${ADMIN_CONTROL_PADDING_X} text-xs text-slate-700 outline-none focus:border-[#3e67d6] focus:ring-0 focus:ring-[#3e67d6]`}
              />
            </>
          }
          headerRight={
            <>
              <button
                type="button"
                onClick={onBulkDelete}
                disabled={selectedRows.length === 0 || isBulkDeleting}
                className={bulkDeleteButtonClass}
              >
                {isBulkDeleting ? (
                  <span className="inline-flex items-center gap-1.5">
                    <Spinner size="sm" className="text-[var(--danger-600)]" />
                    Brisanje...
                  </span>
                ) : (
                  'Izbriši'
                )}
              </button>

              <Button variant="primary" size="toolbar" onClick={onRequestSave} disabled={!tableDirty || saving}>
                Shrani spremembe
              </Button>

              <div className="relative" ref={tableHistoryMenuRef}>
                <IconButton type="button" tone="neutral" aria-label="Zgodovina" onClick={onToggleHistoryMenu}>
                  ⋮
                </IconButton>
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
            </>
          }
        >
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onTreeDragEnd}>
            <SortableContext items={visibleRowIds} strategy={verticalListSortingStrategy}>
              <table className="min-w-full table-fixed border-separate border-spacing-0 border-x border-b border-slate-200">
                <colgroup>
                  <col className="w-14" />
                  <col className="w-[420px]" />
                  <col className="w-[320px]" />
                  <col className="w-32" />
                  <col className="w-28" />
                  <col className="w-32" />
                  <col className="w-40" />
                </colgroup>

                <thead className="bg-slate-50/90">
                  <tr>
                    <th className="border-b border-slate-200 px-2 py-2 text-center text-xs font-semibold text-slate-500">
                      <input
                        ref={selectAllRef}
                        type="checkbox"
                        checked={allRowsSelected}
                        onChange={onToggleSelectAll}
                        aria-label="Izberi vse"
                      />
                    </th>
                    <th className="border-b border-slate-200 px-3 py-2 text-left text-xs font-semibold text-slate-500">Kategorija</th>
                    <th className="border-b border-slate-200 px-3 py-2 text-left text-xs font-semibold text-slate-500">Opis</th>
                    <th className="border-b border-slate-200 px-3 py-2 text-center text-xs font-semibold text-slate-500">Podkategorije</th>
                    <th className="border-b border-slate-200 px-3 py-2 text-center text-xs font-semibold text-slate-500">Izdelki</th>
                    <th className="h-11 border-b border-slate-200 px-3 py-0 text-center text-xs font-semibold text-slate-500 align-middle">
                      <div className="relative flex h-8 items-center justify-center" ref={statusHeaderMenuRef}>
                        <button
                          type="button"
                          onClick={onToggleStatusHeaderMenu}
                          className={`inline-flex h-7 items-center rounded-full border px-2 text-xs font-semibold ${
                            selectedRows.length > 0
                              ? 'border-slate-300 bg-white text-slate-700 hover:bg-[color:var(--hover-neutral)]'
                              : 'border-transparent bg-transparent text-slate-500 cursor-default'
                          }`}
                          aria-haspopup="menu"
                          aria-expanded={selectedRows.length > 0 ? isStatusHeaderMenuOpen : false}
                          disabled={selectedRows.length === 0}
                        >
                          {selectedRows.length > 0 ? `Status ▾ (${selectedRows.length})` : 'Status'}
                        </button>

                        {selectedRows.length > 0 && isStatusHeaderMenuOpen ? (
                          <MenuPanel className="absolute left-1/2 top-8 z-20 w-36 -translate-x-1/2">
                            <MenuItem
                              onClick={() => {
                                const nextStatuses = {
                                  ...statusByRow,
                                  ...Object.fromEntries(selectedRows.map((rowId) => [rowId, 'active' as CategoryStatus]))
                                };
                                onStageStatusChange(nextStatuses);
                              }}
                            >
                              Aktivna
                            </MenuItem>
                            <MenuItem
                              onClick={() => {
                                const nextStatuses = {
                                  ...statusByRow,
                                  ...Object.fromEntries(selectedRows.map((rowId) => [rowId, 'inactive' as CategoryStatus]))
                                };
                                onStageStatusChange(nextStatuses);
                              }}
                            >
                              Neaktivna
                            </MenuItem>
                          </MenuPanel>
                        ) : null}
                      </div>
                    </th>
                    <th className="border-b border-slate-200 px-3 py-2 text-center text-xs font-semibold text-slate-500">Uredi</th>
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
