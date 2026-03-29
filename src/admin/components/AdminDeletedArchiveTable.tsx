'use client';

import dynamic from 'next/dynamic';
import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/shared/ui/button';
import { CustomSelect } from '@/shared/ui/select';
import { useToast } from '@/shared/ui/toast';
import { Spinner } from '@/shared/ui/loading';
import { EmptyState, Table, TBody, TD, THead, TH, TR } from '@/shared/ui/table';
import { AdminTableLayout } from '@/shared/ui/admin-table';
import { ActionRestoreIcon, TrashCanIcon } from '@/shared/ui/icons/AdminActionIcons';
import { adminTableRowToneClasses, getAdminStripedRowToneClass } from '@/shared/ui/theme/tokens';

type ArchiveEntry = {
  id: number;
  item_type: 'order' | 'pdf';
  order_id: number | null;
  document_id: number | null;
  label: string;
  deleted_at: string;
  expires_at: string;
};
type ArchiveEntryTuple = readonly [id: number, itemType: 'order' | 'pdf', orderId: number | null, documentId: number | null, label: string, deletedAt: string, expiresAt: string];

type DisplayRow = {
  entry: ArchiveEntry;
  isChild: boolean;
  parentOrderId: number | null;
};

type TypeFilterValue = 'all' | 'order' | 'pdf';


type ArchiveSortKey = 'deleted_at' | 'expires_at';
type ArchiveSortDirection = 'asc' | 'desc';

const TYPE_FILTER_OPTIONS: Array<{ value: TypeFilterValue; label: string }> = [
  { value: 'all', label: 'Vse vrste' },
  { value: 'order', label: 'Naročila' },
  { value: 'pdf', label: 'PDF datoteke' }
];
const LazyConfirmDialog = dynamic(
  () => import('@/shared/ui/confirm-dialog').then((module) => module.ConfirmDialog),
  { ssr: false }
);

const archiveDateTimeFormatter = new Intl.DateTimeFormat('sl-SI', {
  timeZone: 'Europe/Ljubljana',
  dateStyle: 'medium',
  timeStyle: 'short'
});

const formatDateTime = (value: string) =>
  archiveDateTimeFormatter.format(new Date(value));

const tupleToArchiveEntry = (entry: ArchiveEntryTuple): ArchiveEntry => ({
  id: entry[0],
  item_type: entry[1],
  order_id: entry[2],
  document_id: entry[3],
  label: entry[4],
  deleted_at: entry[5],
  expires_at: entry[6]
});

export default function AdminDeletedArchiveTable({
  initialEntries
}: {
  initialEntries: ArchiveEntryTuple[];
}) {
  const normalizedInitialEntries = useMemo(() => initialEntries.map(tupleToArchiveEntry), [initialEntries]);
  const router = useRouter();
  const [entries, setEntries] = useState(normalizedInitialEntries);
  const [selected, setSelected] = useState<number[]>([]);
  const [typeFilter, setTypeFilter] = useState<TypeFilterValue>('all');
  const [sortKey, setSortKey] = useState<ArchiveSortKey>('deleted_at');
  const [sortDirection, setSortDirection] = useState<ArchiveSortDirection>('desc');
  const [isDeleting, setIsDeleting] = useState(false);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const { toast } = useToast();

  const filtered = useMemo(
    () => entries.filter((entry) => (typeFilter === 'all' ? true : entry.item_type === typeFilter)),
    [entries, typeFilter]
  );

  const displayRows = useMemo<DisplayRow[]>(() => {
    if (typeFilter === 'pdf') {
      return filtered
        .filter((entry) => entry.item_type === 'pdf')
        .map((entry) => ({ entry, isChild: false, parentOrderId: null }));
    }

    const rows: DisplayRow[] = [];
    const orderRows = filtered.filter((entry) => entry.item_type === 'order');
    const deletedOrderIds = new Set(
      orderRows.map((entry) => entry.order_id).filter((orderId): orderId is number => typeof orderId === 'number')
    );

    const pdfByOrder = new Map<number, ArchiveEntry[]>();
    filtered
      .filter((entry) => entry.item_type === 'pdf' && typeof entry.order_id === 'number' && deletedOrderIds.has(entry.order_id))
      .forEach((entry) => {
        const orderId = entry.order_id as number;
        const existingList = pdfByOrder.get(orderId) ?? [];
        existingList.push(entry);
        pdfByOrder.set(orderId, existingList);
      });

    orderRows.forEach((entry) => {
      rows.push({ entry, isChild: false, parentOrderId: null });
      if (typeFilter !== 'all') return;

      const childEntries = pdfByOrder.get(entry.order_id ?? -1) ?? [];
      childEntries
        .sort((leftEntry, rightEntry) => new Date(rightEntry.deleted_at).getTime() - new Date(leftEntry.deleted_at).getTime())
        .forEach((childEntry) => rows.push({ entry: childEntry, isChild: true, parentOrderId: entry.order_id ?? null }));
    });

    if (typeFilter === 'all') {
      filtered
        .filter(
          (entry) =>
            entry.item_type === 'pdf' &&
            (!entry.order_id || !deletedOrderIds.has(entry.order_id))
        )
        .forEach((entry) => rows.push({ entry, isChild: false, parentOrderId: null }));
    }

    const timestampByRowId = new Map<number, number>();
    rows.forEach((row) => {
      const parsed = new Date(row.entry[sortKey]).getTime();
      const stamp = Number.isNaN(parsed) ? 0 : parsed;
      timestampByRowId.set(row.entry.id, stamp);
    });

    return rows.sort((leftRow, rightRow) => {
      const leftValue = timestampByRowId.get(leftRow.entry.id) ?? 0;
      const rightValue = timestampByRowId.get(rightRow.entry.id) ?? 0;
      const multiplier = sortDirection === 'asc' ? 1 : -1;
      return (leftValue - rightValue) * multiplier;
    });
  }, [filtered, sortDirection, sortKey, typeFilter]);

  const visibleIds = useMemo(() => displayRows.map((row) => row.entry.id), [displayRows]);
  const selectedIdSet = useMemo(() => new Set(selected), [selected]);
  const allSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedIdSet.has(id));
  const hasSelectedRows = selected.length > 0;

  const groupedChildIdsByOrder = useMemo(() => {
    const groupedChildIds = new Map<number, number[]>();
    displayRows.forEach((row) => {
      if (!row.isChild || row.parentOrderId === null) return;
      const existingList = groupedChildIds.get(row.parentOrderId) ?? [];
      existingList.push(row.entry.id);
      groupedChildIds.set(row.parentOrderId, existingList);
    });
    return groupedChildIds;
  }, [displayRows]);

  const parentRowIdByOrder = useMemo(() => {
    const parentIdsByOrder = new Map<number, number>();
    displayRows.forEach((row) => {
      if (row.isChild) return;
      if (row.entry.item_type !== 'order' || row.entry.order_id === null) return;
      parentIdsByOrder.set(row.entry.order_id, row.entry.id);
    });
    return parentIdsByOrder;
  }, [displayRows]);

  const selectedEntriesFromRows = useMemo(
    () =>
      displayRows
        .map((row) => row.entry)
        .filter(
          (entry, index, entriesArray) =>
            selectedIdSet.has(entry.id) && entriesArray.findIndex((candidate) => candidate.id === entry.id) === index
        ),
    [displayRows, selectedIdSet]
  );

  const toggleOne = (row: DisplayRow) => {
    const { entry, isChild, parentOrderId } = row;

    if (isChild && parentOrderId !== null) {
      const parentRowId = parentRowIdByOrder.get(parentOrderId);
      if (!parentRowId || !selectedIdSet.has(parentRowId)) return;
    }

    setSelected((previousSelected) => {
      if (isChild && parentOrderId !== null) {
        return previousSelected.includes(entry.id)
          ? previousSelected.filter((itemId) => itemId !== entry.id)
          : [...previousSelected, entry.id];
      }

      const nextSelected = new Set(previousSelected);
      const isCurrentlySelected = nextSelected.has(entry.id);
      const childIds =
        entry.item_type === 'order' && entry.order_id !== null
          ? groupedChildIdsByOrder.get(entry.order_id) ?? []
          : [];

      if (isCurrentlySelected) {
        nextSelected.delete(entry.id);
        childIds.forEach((childId) => nextSelected.delete(childId));
      } else {
        nextSelected.add(entry.id);
        childIds.forEach((childId) => nextSelected.add(childId));
      }

      return Array.from(nextSelected);
    });
  };

  const toggleAll = () => {
    setSelected((previousSelected) => {
      if (allSelected) {
        const visibleIdSet = new Set(visibleIds);
        return previousSelected.filter((id) => !visibleIdSet.has(id));
      }

      const mergedSelection = new Set(previousSelected);
      displayRows.forEach((row) => {
        mergedSelection.add(row.entry.id);
        if (!row.isChild && row.entry.item_type === 'order' && row.entry.order_id !== null) {
          const childIds = groupedChildIdsByOrder.get(row.entry.order_id) ?? [];
          childIds.forEach((childId) => mergedSelection.add(childId));
        }
      });

      return Array.from(mergedSelection);
    });
  };

  const bulkRestore = async () => {
    const selectedEntries = selectedEntriesFromRows;
    const restorableIds = selectedEntries.filter((entry) => entry.id > 0).map((entry) => entry.id);
    const targets = selectedEntries
      .filter((entry) => entry.id <= 0)
      .map((entry) => ({
        item_type: entry.item_type,
        order_id: entry.order_id,
        document_id: entry.document_id
      }));

    if (restorableIds.length === 0 && targets.length === 0) {
      toast.info('Ni izbranih zapisov za obnovo.');
      return;
    }

    setIsRestoring(true);
    try {
      const response = await fetch('/api/admin/archive', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: restorableIds, targets })
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        toast.error(body.message || 'Obnova ni uspela.');
        return;
      }

      setEntries((previousEntries) => previousEntries.filter((entry) => !selected.includes(entry.id)));
      setSelected([]);
      toast.success('Izbrani zapisi so obnovljeni.');
      router.refresh();
    } finally {
      setIsRestoring(false);
    }
  };

  const bulkDelete = () => {
    const deletableIds = selected.filter((id) => id > 0);
    if (deletableIds.length === 0) {
      toast.info('Izbrani zapisi nimajo arhivske postavke za trajni izbris.');
      return;
    }

    setIsDeleteConfirmOpen(true);
  };


  const handleSort = (nextSortKey: ArchiveSortKey) => {
    const isSameColumn = sortKey === nextSortKey;
    if (isSameColumn) {
      setSortDirection((previousDirection) => (previousDirection === 'asc' ? 'desc' : 'asc'));
      return;
    }

    setSortKey(nextSortKey);
    setSortDirection('desc');
  };

  const sortIndicator = (nextSortKey: ArchiveSortKey) => {
    if (sortKey !== nextSortKey) return <span className="ml-1 text-slate-300">↕</span>;
    return <span className="ml-1 text-slate-500">{sortDirection === 'asc' ? '↑' : '↓'}</span>;
  };

  const confirmBulkDelete = async () => {
    const deletableIds = selected.filter((id) => id > 0);
    if (deletableIds.length === 0) {
      toast.info('Izbrani zapisi nimajo arhivske postavke za trajni izbris.');
      setIsDeleteConfirmOpen(false);
      return;
    }

    setIsDeleteConfirmOpen(false);
    setIsDeleting(true);
    try {
      const response = await fetch('/api/admin/archive', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: deletableIds })
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        toast.error(body.message || 'Trajni izbris ni uspel.');
        return;
      }

      setEntries((previousEntries) => previousEntries.filter((entry) => !deletableIds.includes(entry.id)));
      setSelected([]);
      toast.success('Izbrani zapisi so trajno izbrisani.');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <AdminTableLayout
      className="w-full border-slate-200 bg-white"
      headerLeft={
        <div className="relative min-w-[140px]">
          <CustomSelect
            value={typeFilter}
            onChange={(next) => setTypeFilter(next as TypeFilterValue)}
            options={TYPE_FILTER_OPTIONS}
            className="h-7 min-w-[130px] px-2.5 py-0 text-[11px] font-semibold"
          />
        </div>
      }
      headerRight={
        <>
          <Button
            type="button"
            variant={hasSelectedRows ? 'restore' : 'default'}
            onClick={bulkRestore}
            disabled={!hasSelectedRows || isRestoring || isDeleting}
            aria-label="Obnovi izbrano"
            title="Obnovi"
          >
            {isRestoring ? (
              <Spinner size="sm" className="text-slate-500" />
            ) : (
              <ActionRestoreIcon />
            )}
          </Button>
          <Button
            type="button"
            variant={hasSelectedRows ? 'danger' : 'default'}
            onClick={bulkDelete}
            disabled={!hasSelectedRows || isDeleting || isRestoring}
            aria-label="Trajno izbriši izbrano"
            title="Trajno izbriši"
          >
            {isDeleting ? (
              <Spinner size="sm" className="text-rose-700" />
            ) : (
              <TrashCanIcon />
            )}
          </Button>
        </>
      }
      contentClassName="overflow-x-auto"
    >
      {isDeleteConfirmOpen ? (
        <LazyConfirmDialog
          open={isDeleteConfirmOpen}
          title="Trajni izbris"
          description="Ali ste prepričani, da želite trajno izbrisati izbrane zapise?"
          confirmLabel="Izbriši"
          cancelLabel="Prekliči"
          isDanger
          onCancel={() => setIsDeleteConfirmOpen(false)}
          onConfirm={() => {
            void confirmBulkDelete();
          }}
          confirmDisabled={isDeleting}
        />
      ) : null}

      <Table className="w-full table-fixed border-collapse text-[11px]">
          <THead>
            <TR>
              <TH className="w-10 text-center">
                <input type="checkbox" checked={allSelected} onChange={toggleAll} aria-label="Izberi vse" />
              </TH>
              <TH className="w-24 text-[11px]">Vrsta</TH>
              <TH className="text-[11px]">Element</TH>
              <TH className="w-40 text-[11px]">
                <button type="button" onClick={() => handleSort('deleted_at')} className="inline-flex items-center font-semibold hover:text-slate-700">
                  Izbrisano {sortIndicator('deleted_at')}
                </button>
              </TH>
              <TH className="w-40 text-[11px]">
                <button type="button" onClick={() => handleSort('expires_at')} className="inline-flex items-center font-semibold hover:text-slate-700">
                  Poteče {sortIndicator('expires_at')}
                </button>
              </TH>
            </TR>
          </THead>
          <TBody>
            {displayRows.map((row, index) => {
              const { entry, isChild, parentOrderId } = row;
              const parentSelected =
                !isChild || parentOrderId === null
                  ? true
                  : (() => {
                      const parentRowId = parentRowIdByOrder.get(parentOrderId);
                      return parentRowId ? selectedIdSet.has(parentRowId) : false;
                    })();

              return (
                <TR key={entry.id} className={`border-b border-slate-100 transition-colors ${getAdminStripedRowToneClass(index)} ${adminTableRowToneClasses.hover}`}>
                  <TD className="px-0 py-2 text-center">
                    <input
                      type="checkbox"
                      className="disabled:cursor-default disabled:opacity-50"
                      checked={selectedIdSet.has(entry.id)}
                      onChange={() => toggleOne(row)}
                      disabled={isChild && !parentSelected}
                      aria-label={`Izberi zapis ${entry.label}`}
                    />
                  </TD>
                  <TD className="px-0 py-2 text-[11px] font-semibold text-slate-700">
                    {entry.item_type === 'order' ? 'Naročilo' : 'PDF datoteka'}
                  </TD>
                  <TD className={`px-0 py-2 text-slate-800 ${isChild ? 'pl-6' : ''}`}>
                    {entry.item_type === 'order' && entry.order_id ? (
                      <a href={`/admin/orders/${entry.order_id}`} className="font-medium text-[color:var(--blue-500)] hover:text-[color:var(--blue-600)]">
                        {entry.label}
                      </a>
                    ) : (
                      <span>{isChild ? `↳ ${entry.label}` : entry.label}</span>
                    )}
                  </TD>
                  <TD className="px-0 py-2 text-xs text-slate-500">{formatDateTime(entry.deleted_at)}</TD>
                  <TD className="px-0 py-2 text-xs text-slate-500">{formatDateTime(entry.expires_at)}</TD>
                </TR>
              );
            })}
            {displayRows.length === 0 ? (
              <TR>
                <TD colSpan={5} className="py-8 text-center text-sm text-slate-500">
                  <EmptyState title="Arhiv je prazen." />
                </TD>
              </TR>
            ) : null}
          </TBody>
        </Table>

    </AdminTableLayout>
  );
}
