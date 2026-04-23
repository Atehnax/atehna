'use client';

import { useEffect, useMemo, useState } from 'react';
import { ConfirmDialog } from '@/shared/ui/confirm-dialog';
import { AdminCheckbox } from '@/shared/ui/checkbox';
import { IconButton } from '@/shared/ui/icon-button';
import { AdminSearchInput } from '@/shared/ui/admin-search-input';
import {
  adminTableCardClassName,
  adminTableCardStyle,
  adminTableContentClassName,
  adminTableHeaderClassName,
  adminTableNeutralIconButtonClassName,
  adminTableSearchIconClassName,
  adminTableSearchInputClassName,
  adminTableSearchWrapperClassName,
  adminTableSelectedDangerIconButtonClassName,
  adminTableSelectedSuccessIconButtonClassName,
  adminTableToolbarActionsClassName,
  adminTableToolbarGroupClassName,
  AdminTableLayout
} from '@/shared/ui/admin-table';
import { ActionRestoreIcon, TrashCanIcon } from '@/shared/ui/icons/AdminActionIcons';
import { adminTableRowToneClasses } from '@/shared/ui/theme/tokens';
import { EmptyState, Table, TBody, TD, THead, TH, TR } from '@/shared/ui/table';

const STORAGE_KEY = 'admin-items-crud-v2';

type Item = {
  id: string;
  name: string;
  category: string;
  sku: string;
  price: number;
  discountPct: number;
  active: boolean;
  archivedAt?: string | null;
};

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('sl-SI', { style: 'currency', currency: 'EUR' }).format(value);

const formatDateTime = (value?: string | null) => {
  if (!value) return '—';
  return new Date(value).toLocaleString('sl-SI', { dateStyle: 'medium', timeStyle: 'short' });
};

export default function AdminArchivedItemsTable() {
  const [items, setItems] = useState<Item[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [search, setSearch] = useState('');
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);

  useEffect(() => {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw) as Item[];
      if (Array.isArray(parsed)) {
        setItems(parsed.map((item) => ({ ...item, archivedAt: item.archivedAt ?? null })));
      }
    } catch {
      // ignore malformed state
    }
  }, []);

  const archivedItems = useMemo(
    () => items.filter((item) => item.archivedAt).sort((a, b) => (b.archivedAt ?? '').localeCompare(a.archivedAt ?? '')),
    [items]
  );

  const filteredArchivedItems = useMemo(() => {
    const query = search.trim().toLocaleLowerCase('sl');
    if (!query) return archivedItems;

    return archivedItems.filter((item) =>
      [item.name, item.sku, item.category]
        .filter(Boolean)
        .some((value) => value.toLocaleLowerCase('sl').includes(query))
    );
  }, [archivedItems, search]);

  const allSelected =
    filteredArchivedItems.length > 0 && filteredArchivedItems.every((item) => selectedIds.includes(item.id));

  const persist = (next: Item[]) => {
    setItems(next);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  };

  const restoreSelected = () => {
    if (selectedIds.length === 0) return;
    const selectedSet = new Set(selectedIds);
    const next = items.map((item) => (selectedSet.has(item.id) ? { ...item, archivedAt: null } : item));
    persist(next);
    setSelectedIds([]);
  };

  const hardDeleteSelected = () => {
    if (selectedIds.length === 0) return;
    setIsDeleteConfirmOpen(true);
  };

  const confirmHardDeleteSelected = () => {
    const selectedSet = new Set(selectedIds);
    const next = items.filter((item) => !selectedSet.has(item.id));
    persist(next);
    setSelectedIds([]);
    setIsDeleteConfirmOpen(false);
  };

  return (
    <AdminTableLayout
      className={`w-full ${adminTableCardClassName}`}
      style={adminTableCardStyle}
      headerClassName={adminTableHeaderClassName}
      contentClassName={adminTableContentClassName}
      headerLeft={
        <div className={adminTableToolbarGroupClassName}>
          <div className="min-w-0 w-full">
            <AdminSearchInput
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Poišči arhivirane artikle"
              aria-label="Poišči arhivirane artikle"
              wrapperClassName={`${adminTableSearchWrapperClassName} sm:!flex-none sm:!w-[40%] sm:min-w-[20rem] sm:max-w-[30rem]`}
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
            tone={selectedIds.length > 0 ? 'success' : 'neutral'}
            className={selectedIds.length > 0 ? adminTableSelectedSuccessIconButtonClassName : `${adminTableNeutralIconButtonClassName} !transition-none`}
            onClick={restoreSelected}
            disabled={selectedIds.length === 0}
            aria-label="Obnovi izbrane artikle"
            title="Obnovi"
          >
            <ActionRestoreIcon />
          </IconButton>
          <IconButton
            type="button"
            size="sm"
            tone={selectedIds.length > 0 ? 'danger' : 'neutral'}
            className={selectedIds.length > 0 ? adminTableSelectedDangerIconButtonClassName : `${adminTableNeutralIconButtonClassName} !transition-none`}
            onClick={hardDeleteSelected}
            disabled={selectedIds.length === 0}
            aria-label="Trajno izbriši izbrane artikle"
            title="Trajno izbriši"
          >
            <TrashCanIcon />
          </IconButton>
        </div>
      }
    >
      {isDeleteConfirmOpen ? (
        <ConfirmDialog
          open={isDeleteConfirmOpen}
          title="Trajni izbris"
          description="Ali želite trajno izbrisati izbrane arhivirane artikle?"
          confirmLabel="Izbriši"
          cancelLabel="Prekliči"
          isDanger
          onCancel={() => setIsDeleteConfirmOpen(false)}
          onConfirm={confirmHardDeleteSelected}
        />
      ) : null}

      <Table className="w-full table-fixed border-collapse text-[12px] font-['Inter',system-ui,sans-serif]">
        <colgroup>
          <col className="w-[44px]" />
          <col className="w-[34%]" />
          <col className="w-[18%]" />
          <col className="w-[20%]" />
          <col className="w-[14%]" />
          <col className="w-[24%]" />
        </colgroup>
        <THead className="border-t border-slate-200 bg-[color:var(--admin-table-header-bg)]">
          <TR>
            <TH className="w-[44px] border-b border-slate-200 py-4 text-center">
              <AdminCheckbox
                checked={allSelected}
                onChange={() => setSelectedIds(allSelected ? [] : filteredArchivedItems.map((item) => item.id))}
                aria-label="Izberi vse"
              />
            </TH>
            <TH className="border-b border-slate-200 px-3 py-4 text-left text-[12px] font-semibold text-slate-700">Naziv</TH>
            <TH className="border-b border-slate-200 px-3 py-4 text-left text-[12px] font-semibold text-slate-700">SKU</TH>
            <TH className="border-b border-slate-200 px-3 py-4 text-left text-[12px] font-semibold text-slate-700">Kategorija</TH>
            <TH className="border-b border-slate-200 px-3 py-4 text-left text-[12px] font-semibold text-slate-700">Cena</TH>
            <TH className="border-b border-slate-200 px-3 py-4 text-left text-[12px] font-semibold text-slate-700">Arhivirano</TH>
          </TR>
        </THead>
        <TBody>
          {filteredArchivedItems.length === 0 ? (
            <TR>
              <TD colSpan={6} className="px-3 py-8">
                <EmptyState
                  title={archivedItems.length === 0 ? 'Ni arhiviranih artiklov' : 'Ni zadetkov za iskani niz'}
                  description={
                    archivedItems.length === 0
                      ? 'Ko arhivirate artikel, se bo prikazal tukaj.'
                      : 'Poskusite z drugim iskalnim izrazom.'
                  }
                />
              </TD>
            </TR>
          ) : null}

          {filteredArchivedItems.map((item) => (
            <TR key={item.id} className={`border-t border-slate-200/90 bg-white text-[12px] transition-colors ${adminTableRowToneClasses.hover}`}>
              <TD className="px-0 py-3 text-center">
                <AdminCheckbox
                  checked={selectedIds.includes(item.id)}
                  onChange={() =>
                    setSelectedIds((current) =>
                      current.includes(item.id)
                        ? current.filter((entry) => entry !== item.id)
                        : [...current, item.id]
                    )
                  }
                  aria-label={`Izberi ${item.name}`}
                />
              </TD>
              <TD className="px-3 py-3 font-medium text-slate-900">{item.name}</TD>
              <TD className="px-3 py-3 text-slate-600">{item.sku}</TD>
              <TD className="px-3 py-3 text-slate-600">{item.category}</TD>
              <TD className="px-3 py-3 text-slate-600">
                {formatCurrency(item.price * (1 - (item.discountPct ?? 0) / 100))}
              </TD>
              <TD className="px-3 py-3 text-slate-600">{formatDateTime(item.archivedAt)}</TD>
            </TR>
          ))}
        </TBody>
      </Table>
    </AdminTableLayout>
  );
}
