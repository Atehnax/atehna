'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { DANGER_OUTLINE_BUTTON_CLASS } from './adminButtonStyles';
import { useRouter } from 'next/navigation';
import { MenuItem, MenuPanel } from '@/shared/ui/menu';
import { ConfirmDialog } from '@/shared/ui/confirm-dialog';
import { useToast } from '@/shared/ui/toast';
import { EmptyState, Table, TBody, TD, THead, TH, TR, TableShell } from '@/shared/ui/table';

type ArchiveEntry = {
  id: number;
  item_type: 'order' | 'pdf';
  order_id: number | null;
  document_id: number | null;
  label: string;
  deleted_at: string;
  expires_at: string;
};

type DisplayRow = {
  entry: ArchiveEntry;
  isChild: boolean;
  parentOrderId: number | null;
};

type TypeFilterValue = 'all' | 'order' | 'pdf';

const TYPE_FILTER_OPTIONS: Array<{ value: TypeFilterValue; label: string }> = [
  { value: 'all', label: 'Vse vrste' },
  { value: 'order', label: 'Naročila' },
  { value: 'pdf', label: 'PDF datoteke' }
];

const formatDateTime = (value: string) =>
  new Date(value).toLocaleString('sl-SI', {
    dateStyle: 'medium',
    timeStyle: 'short'
  });

export default function AdminDeletedArchiveTable({
  initialEntries
}: {
  initialEntries: ArchiveEntry[];
}) {
  const router = useRouter();
  const [entries, setEntries] = useState(initialEntries);
  const [selected, setSelected] = useState<number[]>([]);
  const [typeFilter, setTypeFilter] = useState<TypeFilterValue>('all');
  const [isDeleting, setIsDeleting] = useState(false);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const { toast } = useToast();

  const [isTypeFilterMenuOpen, setIsTypeFilterMenuOpen] = useState(false);
  const typeFilterMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isTypeFilterMenuOpen) return;

    const handleOutsideClick = (event: MouseEvent) => {
      const target = event.target as Node;
      if (!typeFilterMenuRef.current?.contains(target)) {
        setIsTypeFilterMenuOpen(false);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsTypeFilterMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleOutsideClick);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isTypeFilterMenuOpen]);

  const selectedTypeFilterLabel =
    TYPE_FILTER_OPTIONS.find((option) => option.value === typeFilter)?.label ?? 'Vse vrste';

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

    return rows;
  }, [filtered, typeFilter]);

  const visibleIds = useMemo(() => displayRows.map((row) => row.entry.id), [displayRows]);
  const allSelected = visibleIds.length > 0 && visibleIds.every((id) => selected.includes(id));

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
            selected.includes(entry.id) && entriesArray.findIndex((candidate) => candidate.id === entry.id) === index
        ),
    [displayRows, selected]
  );

  const toggleOne = (row: DisplayRow) => {
    const { entry, isChild, parentOrderId } = row;

    if (isChild && parentOrderId !== null) {
      const parentRowId = parentRowIdByOrder.get(parentOrderId);
      if (!parentRowId || !selected.includes(parentRowId)) return;
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
      if (allSelected) return previousSelected.filter((id) => !visibleIds.includes(id));

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
    <TableShell className="border-slate-200 bg-white p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div className="relative min-w-[140px]" ref={typeFilterMenuRef}>
          <button
            type="button"
            onClick={() => setIsTypeFilterMenuOpen((previousOpen) => !previousOpen)}
            className="inline-flex h-8 w-full min-w-[140px] items-center justify-between rounded-xl border border-slate-300 bg-white px-3 text-left text-xs font-semibold text-slate-700 shadow-sm transition hover:border-slate-400 focus:border-[#5d3ed6] focus:outline-none focus:ring-0 focus-visible:border-[#5d3ed6] focus-visible:outline-none focus-visible:ring-0"
            aria-haspopup="menu"
            aria-expanded={isTypeFilterMenuOpen}
          >
            <span className="truncate">{selectedTypeFilterLabel}</span>
            <span className="ml-2 text-slate-500">▾</span>
          </button>

          {isTypeFilterMenuOpen && (
            <div role="menu">
              <MenuPanel className="absolute left-0 top-9 z-30 w-[180px]">
                {TYPE_FILTER_OPTIONS.map((option) => (
                  <MenuItem
                    key={option.value}
                    onClick={() => {
                      setTypeFilter(option.value);
                      setIsTypeFilterMenuOpen(false);
                    }}
                  >
                    {option.label}
                  </MenuItem>
                ))}
              </MenuPanel>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={bulkRestore}
            disabled={selected.length === 0 || isRestoring || isDeleting}
            className="h-8 rounded-lg border border-emerald-200 bg-[#f8f7fc] px-3 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-50 disabled:cursor-not-allowed disabled:border-slate-200 disabled:text-slate-400"
          >
            {isRestoring ? 'Obnavljam ...' : 'Obnovi'}
          </button>
          <button
            type="button"
            onClick={bulkDelete}
            disabled={selected.length === 0 || isDeleting || isRestoring}
            className={DANGER_OUTLINE_BUTTON_CLASS}
          >
            {isDeleting ? 'Brišem ...' : 'Trajno izbriši'}
          </button>
        </div>
      </div>

      <ConfirmDialog
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

      <div className="overflow-x-auto">
        <Table className="w-full table-fixed border-collapse text-sm">
          <THead>
            <TR className="border-b border-slate-200 text-xs uppercase text-slate-500">
              <TH className="w-10 px-0 py-2 text-center">
                <input type="checkbox" checked={allSelected} onChange={toggleAll} aria-label="Izberi vse" />
              </TH>
              <TH className="w-28 px-0 py-2 text-left">Vrsta</TH>
              <TH className="px-0 py-2 text-left">Element</TH>
              <TH className="w-44 px-0 py-2 text-left">Izbrisano</TH>
              <TH className="w-44 px-0 py-2 text-left">Poteče</TH>
            </TR>
          </THead>
          <TBody>
            {displayRows.map((row) => {
              const { entry, isChild, parentOrderId } = row;
              const parentSelected =
                !isChild || parentOrderId === null
                  ? true
                  : (() => {
                      const parentRowId = parentRowIdByOrder.get(parentOrderId);
                      return parentRowId ? selected.includes(parentRowId) : false;
                    })();

              return (
                <TR key={entry.id} className="border-b border-slate-100 hover:bg-[#ede8ff]">
                  <TD className="px-0 py-2 text-center">
                    <input
                      type="checkbox"
                      className="disabled:cursor-not-allowed disabled:opacity-50"
                      checked={selected.includes(entry.id)}
                      onChange={() => toggleOne(row)}
                      disabled={isChild && !parentSelected}
                      aria-label={`Izberi zapis ${entry.label}`}
                    />
                  </TD>
                  <TD className="px-0 py-2 text-xs font-semibold text-slate-700">
                    {entry.item_type === 'order' ? 'Naročilo' : 'PDF datoteka'}
                  </TD>
                  <TD className={`px-0 py-2 text-slate-800 ${isChild ? 'pl-6' : ''}`}>
                    {entry.item_type === 'order' && entry.order_id ? (
                      <a href={`/admin/orders/${entry.order_id}`} className="font-medium text-brand-700 hover:text-brand-800">
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
      </div>
    </TableShell>
  );
}