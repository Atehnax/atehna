import type { RefObject, ReactNode } from 'react';
import { DndContext, closestCenter, type DragEndEvent } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { AdminCheckbox } from '@/shared/ui/checkbox';
import AuditHistoryDrawer from '@/admin/components/AuditHistoryDrawer';
import { IconButton } from '@/shared/ui/icon-button';
import { MenuItem, MenuPanel } from '@/shared/ui/menu';
import {
  adminTableCardClassName,
  adminTableCardStyle,
  adminTableHeaderButtonClassName,
  adminTableNeutralIconButtonClassName,
  AdminTablePrimaryActionButton,
  adminTableSearchIconClassName,
  adminTableSearchInputClassName,
  adminTableSelectedDangerIconButtonClassName,
  adminTableSelectedSuccessIconButtonClassName,
  adminTableToolbarActionsClassName,
  adminTableToolbarGroupClassName,
  adminTableToolbarSearchWrapperClassName,
  AdminTableLayout
} from '@/shared/ui/admin-table';
import { ActionRestoreIcon, ActionUndoIcon, TrashCanIcon } from '@/shared/ui/icons/AdminActionIcons';
import { Spinner } from '@/shared/ui/loading';
import { AdminSearchInput } from '@/shared/ui/admin-search-input';
import type { CategoryStatus, CategoriesView } from '../common/types';

const treeRowHeight = 48;
const treeButtonDiameter = 28;
const treeIndent = 32;
const categoryTableColumnWidths = {
  select: 50,
  category: 315,
  description: 208,
  subcategories: 116,
  items: 100,
  visibility: 116,
  actions: 72
} as const;
const categoryTableTotalWidth = Object.values(categoryTableColumnWidths).reduce((sum, width) => sum + width, 0);
const categoryTableFixedWidthWithoutDescription = categoryTableTotalWidth - categoryTableColumnWidths.description;
const categoriesTableHeaderClassName = 'px-5 pt-4 pb-8 [&>div:last-child]:!mt-0';

type CategorySortKey = 'category' | 'subcategories' | 'items';
type CategorySortDirection = 'asc' | 'desc';


export function AdminCategoriesTableView({
  activeView,
  query,
  onQueryChange,
  onBulkDelete,
  onRequestCreateCategory,
  selectedRows,
  isBulkDeleting,
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
  onRequestCreateCategory: () => void;
  selectedRows: string[];
  isBulkDeleting: boolean;
  canUndoStagedChanges: boolean;
  onUndo: () => void;
  canRestoreCommittedHistory: boolean;
  hasPendingStagedChanges: boolean;
  onRestore: () => void;
  sensors: ReturnType<typeof import('@dnd-kit/core').useSensors>;
  onTreeDragEnd: (event: DragEndEvent) => void;
  visibleRowIds: string[];
  selectAllRef: RefObject<HTMLInputElement | null>;
  allRowsSelected: boolean;
  onToggleSelectAll: () => void;
  allExpanded: boolean;
  onToggleAllExpanded: () => void;
  statusHeaderMenuRef: RefObject<HTMLDivElement | null>;
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
    return `${adminTableHeaderButtonClassName} ${
      isActive
        ? 'text-slate-900 underline underline-offset-2 hover:text-[color:var(--blue-500)]'
        : ''
    }`;
  };

  return (
    <div className={activeView === 'table' ? 'w-full space-y-4' : 'hidden'}>
      <section>
        <AdminTableLayout
          className={`w-full ${adminTableCardClassName}`}
          style={adminTableCardStyle}
          headerClassName={categoriesTableHeaderClassName}
          contentClassName="overflow-x-auto overflow-y-visible bg-white"
          headerLeft={
            <div className={adminTableToolbarGroupClassName}>
              <div className="min-w-0 w-full">
                <AdminSearchInput
                  id="categories-table-search"
                  name="categoriesTableSearch"
                  value={query}
                  wrapperClassName={adminTableToolbarSearchWrapperClassName}
                  onChange={(event) => onQueryChange(event.target.value)}
                  placeholder="Poišči kategorije"
                  aria-label="Poišči kategorije"
                  inputClassName={adminTableSearchInputClassName}
                  iconClassName={adminTableSearchIconClassName}
                />
              </div>
            </div>
          }
          headerRight={
            <div className={adminTableToolbarActionsClassName}>
              <IconButton
                type="button"
                size="sm"
                tone="neutral"
                className={adminTableNeutralIconButtonClassName}
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
                className={canUseRestore ? adminTableSelectedSuccessIconButtonClassName : `${adminTableNeutralIconButtonClassName} !transition-none`}
                onClick={onRestore}
                disabled={!canUseRestore}
              >
                <ActionRestoreIcon />
              </IconButton>
              <AuditHistoryDrawer entityType="category" entityLabel="Kategorije" />
              <IconButton
                type="button"
                size="sm"
                tone={hasSelectedRows ? 'danger' : 'neutral'}
                aria-label="Izbriši"
                title="Izbriši"
                className={hasSelectedRows ? adminTableSelectedDangerIconButtonClassName : `${adminTableNeutralIconButtonClassName} !transition-none`}
                onClick={onBulkDelete}
                disabled={!hasSelectedRows || isBulkDeleting}
              >
                {isBulkDeleting ? <Spinner size="sm" className="text-[var(--danger-600)]" /> : <TrashCanIcon />}
              </IconButton>
              <AdminTablePrimaryActionButton
                aria-label="Nova kategorija"
                onClick={onRequestCreateCategory}
              >
                Nova kategorija
              </AdminTablePrimaryActionButton>
            </div>
          }
        >
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onTreeDragEnd}>
            <SortableContext items={visibleRowIds} strategy={verticalListSortingStrategy}>
              <table className="w-full table-fixed border-collapse text-[12px] font-['Inter',system-ui,sans-serif]" style={{ width: '100%', minWidth: `${categoryTableTotalWidth}px` }}>
                <colgroup>
                  <col style={{ width: `${categoryTableColumnWidths.select}px` }} />
                  <col style={{ width: `${categoryTableColumnWidths.category}px` }} />
                  <col style={{ width: `calc(100% - ${categoryTableFixedWidthWithoutDescription}px)` }} />
                  <col style={{ width: `${categoryTableColumnWidths.subcategories}px` }} />
                  <col style={{ width: `${categoryTableColumnWidths.items}px` }} />
                  <col style={{ width: `${categoryTableColumnWidths.visibility}px` }} />
                  <col style={{ width: `${categoryTableColumnWidths.actions}px` }} />
                </colgroup>
                <thead className="border-t border-slate-200 bg-[color:var(--admin-table-header-bg)]">
                  <tr>
                    <th className="relative h-11 overflow-visible border-b border-slate-200 px-2 py-4 text-center text-[12px] font-semibold text-slate-700">
                      <div className="absolute top-1/2 z-20" style={{ left: '100%', transform: 'translateY(-50%)' }}>
                        <AdminCheckbox id="categories-select-all" name="categoriesSelectAll" ref={selectAllRef} checked={allRowsSelected} onChange={onToggleSelectAll} aria-label="Izberi vse" />
                      </div>
                    </th>
                    <th className="h-11 border-b border-slate-200 px-2.5 py-0 text-left text-[12px] font-semibold text-slate-700 align-middle">
                      <div className="relative flex h-12 items-center gap-2 overflow-visible px-1">
                        <div className="relative shrink-0 overflow-visible" style={{ width: `${treeIndent + treeButtonDiameter}px`, height: `${treeRowHeight}px` }}>
                          <div className="absolute inset-y-0 z-10 flex items-center justify-center" style={{ left: `${treeIndent}px`, width: `${treeButtonDiameter}px` }}>
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
                    <th className="h-11 border-b border-slate-200 px-2.5 py-4 text-left text-[12px] font-semibold text-slate-700">Opis</th>
                    <th className="h-11 border-b border-slate-200 px-2.5 py-4 text-center text-[12px] font-semibold text-slate-700">
                      <button type="button" onClick={() => onSort('subcategories')} className={getSortHeaderClassName('subcategories')}>
                        Podkategorije
                      </button>
                    </th>
                    <th className="h-11 border-b border-slate-200 px-2.5 py-4 text-center text-[12px] font-semibold text-slate-700">
                      <button type="button" onClick={() => onSort('items')} className={getSortHeaderClassName('items')}>
                        Izdelki
                      </button>
                    </th>
                    <th className="h-11 border-b border-slate-200 px-2.5 py-0 text-center text-[12px] font-semibold text-slate-700 align-middle">
                      <div className="relative flex h-8 items-center justify-center" ref={statusHeaderMenuRef}>
                        <button type="button" onClick={onToggleStatusHeaderMenu} className={`inline-flex h-8 items-center rounded-md border px-2.5 text-[12px] font-semibold ${selectedRows.length > 0 ? 'border-slate-300 bg-white text-slate-700 hover:bg-[color:var(--hover-neutral)]' : 'border-transparent bg-transparent text-slate-500 cursor-default'}`} aria-haspopup="menu" aria-expanded={selectedRows.length > 0 ? isStatusHeaderMenuOpen : false} disabled={selectedRows.length === 0}>
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
                    <th className="h-11 border-b border-slate-200 px-2.5 py-4 text-center text-[12px] font-semibold text-slate-700">Uredi</th>
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
