import { useMemo, type RefObject, type ReactNode } from 'react';
import Selecto from 'react-selecto';
import AuditHistoryDrawer from '@/admin/components/AuditHistoryDrawer';
import { IconButton } from '@/shared/ui/icon-button';
import { ActionRestoreIcon, ActionUndoIcon, TrashCanIcon } from '@/shared/ui/icons/AdminActionIcons';
import { AdminSearchInput } from '@/shared/ui/admin-search-input';
import AdminBreadcrumbPath from '@/shared/ui/admin-breadcrumb-path';
import {
  AdminTablePrimaryActionButton,
  adminTableCardClassName,
  adminTableNeutralIconButtonClassName,
  adminTableSelectedSuccessIconButtonClassName,
  adminTableSelectedDangerIconButtonClassName,
  adminTableSearchIconClassName,
  adminTableSearchInputClassName,
  adminTableSearchWrapperClassName
} from '@/shared/ui/admin-table';

const padTwoDigits = (value: number) => String(value).padStart(2, '0');

const formatMillerDate = (value?: string, mode: 'full' | 'compact' | 'narrow' = 'full') => {
  const parsedDate = value ? new Date(value) : new Date();
  const safeDate = Number.isNaN(parsedDate.getTime()) ? new Date() : parsedDate;

  const day = padTwoDigits(safeDate.getDate());
  const month = padTwoDigits(safeDate.getMonth() + 1);
  const year = safeDate.getFullYear();

  if (mode === 'narrow') return `${day}.${month}`;
  if (mode === 'compact') return `${day}.${month}.`;
  return `${day}.${month}.${year}`;
};

const MILLER_COMPACT_COLUMN_COUNT = 5;
const MILLER_ACTIVE_MIN_WIDTH_PERCENT = 25;
const millerRowGridClass = 'grid items-center gap-x-3';

const getMillerNameColumnLabel = (
  column: MillerColumn,
  mode: 'full' | 'compact' | 'narrow' = 'full'
) => {
  if (mode === 'full') {
    if (column.kind === 'items') return 'Artikel';
    if (column.key === 'categories') return 'Kategorija';
    return 'Podkategorija';
  }

  if (column.kind === 'items') return mode === 'narrow' ? 'A.' : 'Art.';
  if (column.key === 'categories') return 'K.';
  return 'P.';
};

const getActiveColumnWidthPercent = (count: number) => {
  if (count <= 0) return 100;
  if (count <= 4) return 100 / count;
  return MILLER_ACTIVE_MIN_WIDTH_PERCENT;
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

type MillerDropLocation = {
  parentId: string;
  index: number;
  columnKey: string;
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
  activeView: 'table' | 'preview' | 'miller';
  millerDirty: boolean;
  breadcrumbs: Array<{ label: string; onClick?: () => void; isCurrent: boolean }>;
  searchQuery: string;
  onSearchQueryChange: (value: string) => void;
  activeColumnKind: 'categories' | 'subcategories' | 'items';
  onRequestSave: () => void;
  saving: boolean;
  canUndoStagedChanges: boolean;
  onUndo: () => void;
  canRestoreCommittedHistory: boolean;
  hasPendingStagedChanges: boolean;
  onRestore: () => void;
  millerError: string | null;
  millerViewportRef: RefObject<HTMLDivElement | null>;
  onSelectIds: (ids: string[]) => void;
  millerColumns: MillerColumn[];
  plusIcon: ReactNode;
  onAddNode: (column: 'categories' | 'subcategories' | 'items') => void;
  onRequestDelete: (column: 'categories' | 'subcategories' | 'items') => void;
  millerSelection: string[];
  millerDropTarget: MillerDropLocation | null;
  rootId: string;
  setMillerDropTarget: (target: MillerDropLocation | null) => void;
  applyMillerMove: (target: MillerDropLocation | null) => void;
  millerRename: { id: string; value: string } | null;
  setMillerRename: (rename: { id: string; value: string } | null) => void;
  applyMillerRename: () => void;
}) {
  const millerWindowStyles = useMemo(() => {
    const count = millerColumns.length;
    if (count <= 0) {
      return [];
    }

    if (count <= 4) {
      return Array.from({ length: count }, (_, index) => ({
        width: `${100 / count}%`,
        flex: `0 0 ${100 / count}%`,
        zIndex: index + 1
      }));
    }

    const activeColumnWidth = getActiveColumnWidthPercent(count);
    const previousColumnWidth = (100 - activeColumnWidth) / (count - 1);

    return Array.from({ length: count }, (_, index) => {
      const width = index === count - 1 ? activeColumnWidth : previousColumnWidth;
      return {
        width: `${width}%`,
        flex: `0 0 ${width}%`,
        maxWidth: `${width}%`,
        zIndex: index + 1
      };
    });
  }, [millerColumns.length]);

  const renderDropMarker = (columnKey: string, index: number) =>
    millerDropTarget?.columnKey === columnKey && millerDropTarget.index === index ? (
      <div className="px-2 py-0.5" aria-hidden="true">
        <div className="h-[1.5px] rounded-full bg-[#3e67d6] shadow-[0_0_0_1px_rgba(62,103,214,0.12)]" />
      </div>
    ) : null;

  const hasColumnSelection = millerSelection.some((id) =>
    millerColumns.find((column) => column.kind === activeColumnKind)?.ids.includes(id)
  );
  const canUseRestore = canRestoreCommittedHistory && !hasPendingStagedChanges;

  return (
    <section className={activeView === 'miller' ? `w-full rounded-2xl bg-white p-3 ${adminTableCardClassName}` : 'hidden'}>
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="ml-[14px] min-w-0 text-xs text-slate-600">
          <AdminBreadcrumbPath items={breadcrumbs} />
        </div>
        <div className="flex items-center gap-1.5" data-miller-selection-toolbar="true">
          <div className="w-[320px] max-w-[36vw] min-w-0">
            <div className="min-w-0 w-full">
              <AdminSearchInput
                id="miller-search"
                name="millerSearch"
                value={searchQuery}
                wrapperClassName={adminTableSearchWrapperClassName}
                onChange={(event) => onSearchQueryChange(event.target.value)}
                placeholder="Išči po kategorijah"
                aria-label="Išči v Miller stolpcih"
                inputClassName={adminTableSearchInputClassName}
                iconClassName={adminTableSearchIconClassName}
              />
            </div>
          </div>
          <IconButton type="button" size="sm" tone="neutral" className={adminTableNeutralIconButtonClassName} aria-label="Dodaj" onClick={() => onAddNode(activeColumnKind)}>
            {plusIcon}
          </IconButton>
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
          <AuditHistoryDrawer entityType="category" entityLabel="Kategorije" />
          <IconButton
            type="button"
            size="sm"
            tone="neutral"
            className={canUseRestore ? adminTableSelectedSuccessIconButtonClassName : `${adminTableNeutralIconButtonClassName} !transition-none`}
            aria-label="Obnovi"
            title="Obnovi"
            onClick={onRestore}
            disabled={!canUseRestore}
          >
            <ActionRestoreIcon />
          </IconButton>
          <IconButton
            type="button"
            size="sm"
            tone={hasColumnSelection ? 'danger' : 'neutral'}
            className={hasColumnSelection ? adminTableSelectedDangerIconButtonClassName : adminTableNeutralIconButtonClassName}
            aria-label="Izbriši"
            title="Izbriši"
            onClick={() => onRequestDelete(activeColumnKind)}
            disabled={!hasColumnSelection}
          >
            <TrashCanIcon />
          </IconButton>
          <AdminTablePrimaryActionButton type="button" onClick={onRequestSave} disabled={!millerDirty || saving}>
            Shrani
          </AdminTablePrimaryActionButton>
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
        className="flex items-stretch overflow-hidden pb-1"
        onMouseDown={(event) => {
          const target = event.target as HTMLElement;
          if (!target.closest('[data-miller-id]')) onSelectIds([]);
        }}
      >
        {millerColumns.map((column, index) => (
          (() => {
            const isLastColumn = index === millerColumns.length - 1;
            const canUseFullColumnLabels = isLastColumn || millerColumns.length <= 4;
            const compactLabelMode =
              !isLastColumn && millerColumns.length >= 7
                ? 'narrow'
                : !isLastColumn && millerColumns.length >= MILLER_COMPACT_COLUMN_COUNT
                  ? 'compact'
                  : 'full';
            const gridDateWidth = canUseFullColumnLabels
              ? 72
              : millerColumns.length === 5
                ? 52
                : millerColumns.length === 6
                  ? 42
                  : millerColumns.length === 7
                    ? 36
                    : 32;
            const rowGridTemplate = `minmax(0,1fr) ${gridDateWidth}px ${gridDateWidth}px`;
            const dateHeaderMode = canUseFullColumnLabels
              ? 'full'
              : millerColumns.length >= 7
                ? 'narrow'
                : 'compact';
            const dateDisplayMode = canUseFullColumnLabels
              ? 'full'
              : millerColumns.length >= 7
                ? 'narrow'
                : 'compact';
            const dateTextClassName =
              canUseFullColumnLabels || millerColumns.length <= 5 ? 'text-[11px]' : 'text-[10px]';

            return (
          <div
            key={column.key}
            className="min-w-0 overflow-hidden rounded-xl border border-slate-200 bg-white"
            style={millerWindowStyles[index]}
          >
            <div className="flex items-center justify-between border-b border-slate-200 bg-white px-2.5 py-2">
              <h3 className="truncate text-[11px] font-bold text-slate-800" title={column.title}>{column.title}</h3>
            </div>

            <div
              className={`h-[500px] space-y-0 overflow-auto p-1.5 ${millerDropTarget?.columnKey === column.key ? 'ring-2 ring-[#3e67d6]/30' : ''}`}
              onDragOver={(event) => {
                event.preventDefault();
                const parentId = column.kind === 'categories' ? rootId : column.rows[0]?.onDropTarget ?? rootId;
                const rowElements = Array.from(event.currentTarget.querySelectorAll<HTMLElement>('[data-miller-row="true"]'));
                if (rowElements.length === 0) {
                  setMillerDropTarget({ parentId, index: 0, columnKey: column.key });
                  return;
                }

                const firstRowBounds = rowElements[0].getBoundingClientRect();
                if (event.clientY <= firstRowBounds.top) {
                  setMillerDropTarget({ parentId, index: 0, columnKey: column.key });
                  return;
                }

                const lastRowBounds = rowElements.at(-1)?.getBoundingClientRect();
                if (lastRowBounds && event.clientY >= lastRowBounds.bottom) {
                  setMillerDropTarget({ parentId, index: column.rows.length, columnKey: column.key });
                }
              }}
              onDrop={(event) => {
                event.preventDefault();
                applyMillerMove(millerDropTarget?.columnKey === column.key ? millerDropTarget : { parentId: column.kind === 'categories' ? rootId : column.rows[0]?.onDropTarget ?? rootId, index: column.rows.length, columnKey: column.key });
                setMillerDropTarget(null);
              }}
            >
              {column.rows.length === 0 ? <p className="px-2 py-3 text-xs text-slate-500">Ni zapisov.</p> : (
                <>
                  <div
                    className={`${millerRowGridClass} border-b border-slate-200 px-2 py-1 text-[11px] font-bold text-slate-600`}
                    style={{ gridTemplateColumns: rowGridTemplate }}
                  >
                    <span className="min-w-0 truncate" title={getMillerNameColumnLabel(column, 'full')}>{getMillerNameColumnLabel(column, compactLabelMode)}</span>
                    <span className="truncate text-center" title="Ustvarjeno">
                      {dateHeaderMode === 'full' ? 'Ustvarjeno' : dateHeaderMode === 'compact' ? 'Ustv.' : 'U.'}
                    </span>
                    <span className="truncate text-center" title="Spremenjeno">
                      {dateHeaderMode === 'full' ? 'Spremenjeno' : dateHeaderMode === 'compact' ? 'Sprem.' : 'S.'}
                    </span>
                  </div>
                  {renderDropMarker(column.key, 0)}
                  {column.rows.map((row, rowIndex) => (
                    millerRename?.id === row.id && row.kind !== 'item' ? (
                      <input
                        id={`miller-rename-${row.id}`}
                        name={`millerRename-${row.id}`}
                        key={row.id}
                        value={millerRename.value}
                        onChange={(event) => setMillerRename({ id: row.id, value: event.target.value })}
                        onBlur={applyMillerRename}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter') applyMillerRename();
                          if (event.key === 'Escape') setMillerRename(null);
                        }}
                        className="block w-full rounded-md border border-[#3e67d6]/40 bg-white px-2 py-1 text-[11px] font-medium text-slate-700 outline-none"
                        placeholder="Ime"
                        aria-label="Preimenuj"
                        autoFocus
                      />
                    ) : (
                      <div key={row.id} data-miller-row="true">
                        <button
                          type="button"
                          data-miller-id={row.id}
                          className={`miller-select-item ${millerRowGridClass} w-full rounded-md px-2 py-1 text-left text-[11px] font-medium transition ${millerSelection.includes(row.id) || row.tone === 'focused' ? `${row.isInactive ? 'text-slate-400' : 'text-[#1f3f93]'} bg-[#f0f4ff]` : `${row.isInactive ? 'text-slate-400' : 'text-slate-700'} bg-white hover:bg-slate-100`}`}
                          style={{ gridTemplateColumns: rowGridTemplate }}
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
                            event.stopPropagation();
                            const bounds = event.currentTarget.getBoundingClientRect();
                            const insertAfter = event.clientY >= bounds.top + bounds.height / 2;
                            const index = insertAfter ? rowIndex + 1 : rowIndex;
                            setMillerDropTarget({ parentId: row.onDropTarget, index, columnKey: column.key });
                          }}
                          onDrop={(event) => {
                            event.preventDefault();
                            event.stopPropagation();
                            applyMillerMove(millerDropTarget?.columnKey === column.key ? millerDropTarget : { parentId: row.onDropTarget, index: rowIndex, columnKey: column.key });
                          }}
                        >
                          <span className="min-w-0 truncate whitespace-nowrap" title={row.label} style={row.isInactive ? { color: '#94a3b8' } : undefined}>{row.label}</span>
                          <span className={`whitespace-nowrap text-center font-normal ${dateTextClassName}`}>{formatMillerDate(row.createdAt, dateDisplayMode)}</span>
                          <span className={`whitespace-nowrap text-center font-normal ${dateTextClassName}`}>{formatMillerDate(row.updatedAt, dateDisplayMode)}</span>
                        </button>
                        {renderDropMarker(column.key, rowIndex + 1)}
                      </div>
                    )
                  ))}
                </>
              )}
            </div>
          </div>
            );
          })()
        ))}
      </div>
    </section>
  );
}
