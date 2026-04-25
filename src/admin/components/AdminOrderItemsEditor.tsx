'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AdminCheckbox } from '@/shared/ui/checkbox';
import { AdminSearchInput } from '@/shared/ui/admin-search-input';
import {
  adminTableInlineActionRowClassName,
  adminTableInlineCancelButtonClassName,
  adminTableInlineCancelIconClassName,
  adminTableInlineConfirmButtonClassName,
  adminTableInlineConfirmIconClassName,
  adminTableInlineEditInputClassName,
  adminTableNeutralIconButtonClassName,
  adminTableSearchIconClassName,
  adminTableSearchInputClassName,
  adminTableSearchWrapperClassName,
  adminTableSelectedDangerIconButtonClassName,
  adminWindowCardClassName,
  adminWindowCardStyle
} from '@/shared/ui/admin-table';
import { IconButton } from '@/shared/ui/icon-button';
import { CheckIcon, CloseIcon, PencilIcon, PlusIcon, TrashCanIcon } from '@/shared/ui/icons/AdminActionIcons';
import { adminTableRowToneClasses } from '@/shared/ui/theme/tokens';
import { useToast } from '@/shared/ui/toast';
import type { OrderItemInput } from '@/shared/domain/order/orderTypes';

type CatalogChoice = {
  sku: string;
  name: string;
  unit: string;
  unitPrice: number;
};

type EditableItem = {
  id: string;
  persistedId?: number;
  sku: string;
  name: string;
  unit: string;
  quantity: number;
  unitPrice: number;
  discountPercentage: number;
};

type ItemsSectionMode = 'read' | 'edit';

const TAX_RATE = 0.22;
const toMoney = (value: number) => Math.round(value * 100) / 100;
const currencyFormatter = new Intl.NumberFormat('sl-SI', { style: 'currency', currency: 'EUR' });
const decimalFormatter = new Intl.NumberFormat('sl-SI', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const formatCurrency = (value: number) => currencyFormatter.format(value);

const parseLocaleNumber = (value: string) => {
  const trimmed = value.trim();
  const normalized = trimmed.includes(',') ? trimmed.replace(/\./g, '').replace(',', '.') : trimmed;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
};

const formatDecimalInput = (value: number) => decimalFormatter.format(value);

const mapIncomingItems = (sourceItems: OrderItemInput[]): EditableItem[] =>
  sourceItems.map((item) => ({
    id: `saved-${item.id}`,
    persistedId: item.id,
    sku: item.sku,
    name: item.name,
    unit: item.unit ?? 'kos',
    quantity: item.quantity,
    unitPrice: item.unit_price ?? 0,
    discountPercentage: item.discount_percentage ?? 0
  }));

const cloneEditableItems = (sourceItems: EditableItem[]): EditableItem[] =>
  sourceItems.map((item) => ({ ...item }));

const areEditableItemsEqual = (left: EditableItem[], right: EditableItem[]) => {
  if (left.length !== right.length) return false;
  for (let index = 0; index < left.length; index += 1) {
    const leftItem = left[index];
    const rightItem = right[index];
    if (
      leftItem.id !== rightItem.id ||
      leftItem.persistedId !== rightItem.persistedId ||
      leftItem.sku !== rightItem.sku ||
      leftItem.name !== rightItem.name ||
      leftItem.unit !== rightItem.unit ||
      leftItem.quantity !== rightItem.quantity ||
      leftItem.unitPrice !== rightItem.unitPrice ||
      leftItem.discountPercentage !== rightItem.discountPercentage
    ) {
      return false;
    }
  }
  return true;
};

const orderItemsEditInputClassName =
  `${adminTableInlineEditInputClassName} !h-8 !px-2 !text-[12px] !leading-none`;

const centeredEditInputClassName = `${orderItemsEditInputClassName} !text-center`;
const rightAlignedEditInputClassName = `${orderItemsEditInputClassName} !text-right`;
const readonlyCellFrameClassName =
  'inline-flex h-8 items-center justify-center rounded-md border border-transparent px-2 text-[12px] text-slate-900';

export default function AdminOrderItemsEditor({
  orderId,
  items,
  initialSubtotal = 0,
  initialTax = 0,
  initialTotal = 0,
  externalEditMode,
  hideSectionEditControls = false,
  onDirtyChange,
  onSavingChange,
  onRegisterSave
}: {
  orderId: number;
  items: OrderItemInput[];
  initialSubtotal?: number;
  initialTax?: number;
  initialTotal?: number;
  externalEditMode?: boolean;
  hideSectionEditControls?: boolean;
  onDirtyChange?: (isDirty: boolean) => void;
  onSavingChange?: (isSaving: boolean) => void;
  onRegisterSave?: (handler: () => Promise<boolean>) => void | (() => void);
}) {
  const initialMappedItems = useMemo(() => mapIncomingItems(items), [items]);
  const hasExternalEditMode = typeof externalEditMode === 'boolean';
  const [itemsSectionMode, setItemsSectionMode] = useState<ItemsSectionMode>(externalEditMode ? 'edit' : 'read');
  const [persistedItems, setPersistedItems] = useState<EditableItem[]>(initialMappedItems);
  const [draftItems, setDraftItems] = useState<EditableItem[]>(() => cloneEditableItems(initialMappedItems));
  const initialShipping = Math.max(0, toMoney(initialTotal - initialSubtotal - initialTax));
  const [persistedShipping, setPersistedShipping] = useState(initialShipping);
  const [draftShipping, setDraftShipping] = useState(initialShipping);
  const [isItemsSaving, setIsItemsSaving] = useState(false);
  const [selectedDraftItemIds, setSelectedDraftItemIds] = useState<string[]>([]);
  const [catalogChoices, setCatalogChoices] = useState<CatalogChoice[]>([]);
  const [catalogQuery, setCatalogQuery] = useState('');
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const { toast } = useToast();
  const saveItemsRef = useRef<() => Promise<boolean>>(async () => true);

  const itemsEditable = hasExternalEditMode ? Boolean(externalEditMode) : itemsSectionMode === 'edit';

  const isItemsDirty = useMemo(
    () => !areEditableItemsEqual(draftItems, persistedItems) || toMoney(draftShipping) !== toMoney(persistedShipping),
    [draftItems, persistedItems, draftShipping, persistedShipping]
  );

  const itemsSaveDisabled = !itemsEditable || isItemsSaving || !isItemsDirty;
  const addItemDisabled = !itemsEditable || isItemsSaving;
  const activeItems = itemsEditable ? draftItems : persistedItems;
  const hasSelectedDraftItems = selectedDraftItemIds.length > 0;
  const areAllActiveItemsSelected =
    activeItems.length > 0 && activeItems.every((item) => selectedDraftItemIds.includes(item.id));

  const totals = useMemo(() => {
    const subtotal = toMoney(
      activeItems.reduce((sum, item) => sum + item.quantity * item.unitPrice * (1 - item.discountPercentage / 100), 0)
    );
    const taxIncludedInfo = toMoney((subtotal * TAX_RATE) / (1 + TAX_RATE));
    const shipping = toMoney(itemsEditable ? draftShipping : persistedShipping);
    const total = toMoney(subtotal + shipping);
    return { subtotal, taxIncludedInfo, shipping, total };
  }, [activeItems, draftShipping, itemsEditable, persistedShipping]);

  const filteredChoices = useMemo(() => {
    const normalizedQuery = catalogQuery.trim().toLocaleLowerCase('sl');
    return catalogChoices.filter((choice) =>
      !normalizedQuery
        ? true
        : choice.name.toLocaleLowerCase('sl').includes(normalizedQuery) ||
          choice.sku.toLocaleLowerCase('sl').includes(normalizedQuery)
    );
  }, [catalogChoices, catalogQuery]);

  const updateItem = (id: string, updates: Partial<EditableItem>) => {
    if (!itemsEditable) return;
    setDraftItems((currentItems) =>
      currentItems.map((item) => {
        if (item.id !== id) return item;
        const updated = { ...item, ...updates };
        return {
          ...updated,
          quantity: Math.max(1, Number.isFinite(updated.quantity) ? Math.floor(updated.quantity) : 1),
          unitPrice: Math.max(0, Number.isFinite(updated.unitPrice) ? updated.unitPrice : 0),
          discountPercentage: Math.min(
            100,
            Math.max(0, Number.isFinite(updated.discountPercentage) ? updated.discountPercentage : 0)
          )
        };
      })
    );
  };

  const startItemsEdit = () => {
    setDraftItems(cloneEditableItems(persistedItems));
    setDraftShipping(persistedShipping);
    setSelectedDraftItemIds([]);
    setItemsSectionMode('edit');
  };

  const cancelItemsEdit = useCallback(() => {
    setDraftItems(cloneEditableItems(persistedItems));
    setDraftShipping(persistedShipping);
    setSelectedDraftItemIds([]);
    setItemsSectionMode('read');
    setIsPickerOpen(false);
    setCatalogQuery('');
  }, [persistedItems, persistedShipping]);

  const openAddItem = async () => {
    if (addItemDisabled) return;

    setIsPickerOpen(true);
    if (catalogChoices.length > 0) return;
    const response = await fetch('/api/admin/catalog-items');
    if (!response.ok) return;
    const payload = (await response.json()) as { items: CatalogChoice[] };
    setCatalogChoices(payload.items ?? []);
  };

  const addCatalogItem = (choice: CatalogChoice) => {
    if (!itemsEditable) return;

    setDraftItems((currentItems) => {
      const existing = currentItems.find((item) => item.sku === choice.sku);
      if (existing) {
        return currentItems.map((item) =>
          item.id === existing.id ? { ...item, quantity: item.quantity + 1 } : item
        );
      }
      return [
        ...currentItems,
        {
          id: `new-${Date.now()}-${choice.sku}`,
          sku: choice.sku,
          name: choice.name,
          unit: choice.unit,
          quantity: 1,
          unitPrice: choice.unitPrice,
          discountPercentage: 0
        }
      ];
    });
    setIsPickerOpen(false);
    setCatalogQuery('');
  };

  const saveItems = useCallback(async (): Promise<boolean> => {
    if (!itemsEditable || isItemsSaving) return true;

    if (!isItemsDirty) {
      if (!hasExternalEditMode) cancelItemsEdit();
      return true;
    }

    if (draftItems.length === 0) {
      toast.error('Naročilo mora vsebovati vsaj eno postavko.');
      return false;
    }

    setIsItemsSaving(true);
    try {
      const response = await fetch(`/api/admin/orders/${orderId}/items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shipping: toMoney(draftShipping),
          items: draftItems.map((item) => ({
            id: item.persistedId,
            sku: item.sku,
            name: item.name,
            unit: item.unit,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            discountPercentage: item.discountPercentage
          }))
        })
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.message || 'Shranjevanje postavk ni uspelo.');
      }

      const nextItems = cloneEditableItems(draftItems);
      setPersistedItems(nextItems);
      setPersistedShipping(toMoney(draftShipping));
      setDraftItems(cloneEditableItems(nextItems));
      setSelectedDraftItemIds([]);
      if (!hasExternalEditMode) {
        setItemsSectionMode('read');
        toast.success('Postavke so posodobljene.');
      }
      return true;
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Napaka pri shranjevanju postavk.');
      return false;
    } finally {
      setIsItemsSaving(false);
    }
  }, [
    draftItems,
    draftShipping,
    cancelItemsEdit,
    hasExternalEditMode,
    isItemsDirty,
    isItemsSaving,
    itemsEditable,
    orderId,
    toast
  ]);

  useEffect(() => {
    if (!hasExternalEditMode) return;

    setDraftItems(cloneEditableItems(persistedItems));
    setDraftShipping(persistedShipping);
    setSelectedDraftItemIds([]);
    setItemsSectionMode(externalEditMode ? 'edit' : 'read');
    if (!externalEditMode) {
      setIsPickerOpen(false);
      setCatalogQuery('');
    }
  }, [externalEditMode, hasExternalEditMode, persistedItems, persistedShipping]);

  useEffect(() => {
    onDirtyChange?.(isItemsDirty);
  }, [isItemsDirty, onDirtyChange]);

  useEffect(() => {
    onSavingChange?.(isItemsSaving);
  }, [isItemsSaving, onSavingChange]);

  useEffect(() => {
    saveItemsRef.current = saveItems;
  }, [saveItems]);

  useEffect(() => {
    if (!onRegisterSave) return undefined;
    return onRegisterSave(() => saveItemsRef.current());
  }, [onRegisterSave]);

  useEffect(() => {
    if (hasExternalEditMode || !itemsEditable || isPickerOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const isTextEntry =
        target?.tagName === 'INPUT' ||
        target?.tagName === 'TEXTAREA' ||
        target?.getAttribute('contenteditable') === 'true';

      if (event.key === 'Escape') {
        event.preventDefault();
        cancelItemsEdit();
        return;
      }

      if (event.key === 'Enter' && isTextEntry && !event.shiftKey) {
        event.preventDefault();
        void saveItems();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [cancelItemsEdit, hasExternalEditMode, itemsEditable, isPickerOpen, saveItems]);

  const toggleSelectedDraftItem = (itemId: string) => {
    if (!itemsEditable) return;
    setSelectedDraftItemIds((previous) =>
      previous.includes(itemId) ? previous.filter((id) => id !== itemId) : [...previous, itemId]
    );
  };

  const toggleAllDraftItems = () => {
    if (!itemsEditable) return;
    if (areAllActiveItemsSelected) {
      setSelectedDraftItemIds([]);
      return;
    }
    setSelectedDraftItemIds(activeItems.map((item) => item.id));
  };

  const deleteSelectedDraftItems = () => {
    if (!itemsEditable || selectedDraftItemIds.length === 0) return;
    const selectedSet = new Set(selectedDraftItemIds);
    setDraftItems((previous) => previous.filter((item) => !selectedSet.has(item.id)));
    setSelectedDraftItemIds([]);
  };

  return (
    <section className={`${adminWindowCardClassName} flex flex-col p-6`} style={adminWindowCardStyle}>
      <h2 className="text-lg font-semibold text-slate-900">Uredi naročilo</h2>

      <div className="mt-4 overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="flex items-center justify-between px-4 py-3">
          <h3 className="text-[13px] font-semibold text-slate-900">Postavke</h3>
          <div className="ml-auto flex items-center gap-1.5">
            {!hideSectionEditControls ? (
              itemsEditable ? (
              <div className={adminTableInlineActionRowClassName}>
                <IconButton
                  type="button"
                  tone="neutral"
                  size="sm"
                  className={adminTableInlineConfirmButtonClassName}
                  disabled={itemsSaveDisabled}
                  aria-label="Shrani postavke"
                  title={isItemsDirty ? 'Shrani spremembe' : 'Ni sprememb za shranjevanje'}
                  onClick={() => {
                    void saveItems();
                  }}
                >
                  <CheckIcon className={adminTableInlineConfirmIconClassName} strokeWidth={2.2} />
                </IconButton>
                <IconButton
                  type="button"
                  tone="neutral"
                  size="sm"
                  className={adminTableInlineCancelButtonClassName}
                  aria-label="Prekliči urejanje postavk"
                  title="Prekliči"
                  onClick={cancelItemsEdit}
                >
                  <CloseIcon className={adminTableInlineCancelIconClassName} strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" />
                </IconButton>
              </div>
            ) : (
              <IconButton
                type="button"
                aria-label="Hitro urejanje postavk"
                onClick={startItemsEdit}
                title="Hitro urejanje"
                tone="neutral"
                className={adminTableNeutralIconButtonClassName}
                disabled={isItemsSaving}
              >
                <PencilIcon />
              </IconButton>
              )
            ) : null}

            <IconButton
              type="button"
              aria-label="Dodaj postavko"
              onClick={() => {
                void openAddItem();
              }}
              title="Dodaj"
              tone="neutral"
              className={adminTableNeutralIconButtonClassName}
              disabled={addItemDisabled}
            >
              <PlusIcon />
            </IconButton>

            <IconButton
              type="button"
              aria-label="Odstrani izbrane postavke"
              onClick={deleteSelectedDraftItems}
              title="Izbriši izbrane"
              tone={hasSelectedDraftItems ? 'danger' : 'neutral'}
              className={hasSelectedDraftItems ? adminTableSelectedDangerIconButtonClassName : `${adminTableNeutralIconButtonClassName} !transition-none`}
              disabled={!itemsEditable || !hasSelectedDraftItems}
            >
              <TrashCanIcon />
            </IconButton>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full table-fixed text-[12px] leading-5">
            <colgroup>
              <col style={{ width: '7%' }} />
              <col style={{ width: '45%' }} />
              <col style={{ width: '12%' }} />
              <col style={{ width: '13%' }} />
              <col style={{ width: '11%' }} />
              <col style={{ width: '12%' }} />
            </colgroup>
            <thead className="border-t border-slate-200 bg-[color:var(--admin-table-header-bg)] text-slate-600">
              <tr>
                <th className="border-b border-slate-200 py-4 pl-4 pr-2 text-left align-middle" aria-label="Izbira">
                  <AdminCheckbox
                    checked={itemsEditable ? areAllActiveItemsSelected : false}
                    disabled={!itemsEditable}
                    onChange={toggleAllDraftItems}
                    aria-label="Izberi vse postavke"
                  />
                </th>
                <th className="border-b border-slate-200 px-3 py-4 text-left text-[12px] font-semibold align-middle">Artikel</th>
                <th className="border-b border-slate-200 px-2 py-4 text-center text-[12px] font-semibold align-middle">Količina</th>
                <th className="border-b border-slate-200 px-2 py-4 text-center text-[12px] font-semibold align-middle">Cena</th>
                <th className="border-b border-slate-200 px-2 py-4 text-center text-[12px] font-semibold align-middle">Popust %</th>
                <th className="border-b border-slate-200 py-4 pl-2 pr-4 text-right text-[12px] font-semibold align-middle">Skupaj</th>
              </tr>
            </thead>
            <tbody>
              {activeItems.map((item) => {
                const lineTotal = toMoney(item.quantity * item.unitPrice * (1 - item.discountPercentage / 100));
                return (
                  <tr key={item.id} className={`border-t border-slate-200/90 bg-white align-middle ${adminTableRowToneClasses.hover}`}>
                    <td className="py-3 pl-4 pr-2 text-left">
                      <AdminCheckbox
                        checked={selectedDraftItemIds.includes(item.id)}
                        disabled={!itemsEditable}
                        onChange={() => toggleSelectedDraftItem(item.id)}
                        aria-label={`Izberi postavko ${item.name}`}
                      />
                    </td>
                    <td className="px-3 py-3 align-middle">
                      <div className="grid gap-0.5">
                        <p className="truncate text-[12px] font-medium text-slate-900">{item.name}</p>
                        <p className="truncate text-[11px] text-slate-500">{item.sku}</p>
                      </div>
                    </td>
                    <td className="px-2 py-3 text-center">
                      {itemsEditable ? (
                        <input
                          type="number"
                          min={1}
                          value={item.quantity}
                          onChange={(event) => updateItem(item.id, { quantity: Number(event.target.value) || 1 })}
                          aria-label="Količina"
                          className={`${centeredEditInputClassName} mx-auto w-14`}
                        />
                      ) : (
                        <span className={`${readonlyCellFrameClassName} w-14`}>{item.quantity}</span>
                      )}
                    </td>
                    <td className="px-2 py-3 text-center">
                      {itemsEditable ? (
                        <span className="mx-auto inline-flex w-[88px] items-center justify-center gap-1">
                          <input
                            type="text"
                            inputMode="decimal"
                            value={formatDecimalInput(item.unitPrice)}
                            onChange={(event) => updateItem(item.id, { unitPrice: parseLocaleNumber(event.target.value) })}
                            aria-label="Cena"
                            className={`${centeredEditInputClassName} w-[62px]`}
                          />
                          <span className="text-[12px] text-slate-700">€</span>
                        </span>
                      ) : (
                        <span className={`${readonlyCellFrameClassName} justify-center gap-1`}>{formatDecimalInput(item.unitPrice)} €</span>
                      )}
                    </td>
                    <td className="px-2 py-3 text-center">
                      {itemsEditable ? (
                        <span className="mx-auto inline-flex w-[80px] items-center justify-center gap-1">
                          <input
                            type="text"
                            inputMode="decimal"
                            value={formatDecimalInput(item.discountPercentage)}
                            onChange={(event) => updateItem(item.id, { discountPercentage: parseLocaleNumber(event.target.value) })}
                            aria-label="Popust"
                            className={`${centeredEditInputClassName} w-[54px]`}
                          />
                          <span className="text-[12px] text-slate-700">%</span>
                        </span>
                      ) : (
                        <span className={`${readonlyCellFrameClassName} justify-center gap-1`}>{formatDecimalInput(item.discountPercentage)} %</span>
                      )}
                    </td>
                    <td className="py-3 pl-2 pr-4 text-right font-semibold text-slate-900">{formatCurrency(lineTotal)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className={`space-y-2 bg-slate-50/50 px-4 py-4 text-[12px] text-slate-700 ${activeItems.length > 0 ? 'border-t border-slate-200' : ''}`}>
          <div className="flex items-center justify-between">
            <span>Vmesni seštevek</span>
            <span className="font-semibold">{formatCurrency(totals.subtotal)}</span>
          </div>
          <div className="flex min-h-8 items-center justify-between">
            <span>Poštnina</span>
            <span className="inline-flex w-[60px] items-center justify-end gap-1">
              {itemsEditable ? (
                <input
                  type="text"
                  inputMode="decimal"
                  value={formatDecimalInput(draftShipping)}
                  onChange={(event) => {
                    const sanitized = event.target.value.replace(/[^0-9,]/g, '').slice(0, 5);
                    setDraftShipping(Math.max(0, parseLocaleNumber(sanitized)));
                  }}
                  aria-label="Poštnina"
                  className={`${rightAlignedEditInputClassName} !w-[44px]`}
                />
              ) : (
                <span className="inline-flex h-8 w-[44px] items-center justify-end rounded-md border border-transparent px-0 text-right text-[12px] font-semibold text-slate-700">
                  {formatDecimalInput(totals.shipping)}
                </span>
              )}
              <span className={`text-[12px] text-slate-700 ${itemsEditable ? '' : 'font-semibold'}`}>€</span>
            </span>
          </div>
          <div className="flex items-center justify-between text-slate-500">
            <span>DDV (22 %)</span>
            <span className="font-semibold">{formatCurrency(totals.taxIncludedInfo)}</span>
          </div>
          <div className="border-t border-slate-200 pt-2">
            <div className="flex items-center justify-between text-[13px] font-semibold text-slate-900">
              <span>Skupaj</span>
              <span>{formatCurrency(totals.total)}</span>
            </div>
          </div>
        </div>
      </div>

      {isPickerOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="w-full max-w-2xl rounded-xl border border-slate-200 bg-white p-4 shadow-[0_14px_34px_rgba(15,23,42,0.08),0_2px_6px_rgba(15,23,42,0.05)]">
            <div className="flex items-center justify-between">
              <h3 className="text-[13px] font-semibold text-slate-900">Dodaj artikel</h3>
              <button
                type="button"
                className="text-[12px] text-slate-500 hover:text-slate-700"
                onClick={() => setIsPickerOpen(false)}
              >
                Zapri
              </button>
            </div>

            <div className="mt-3">
              <AdminSearchInput
                value={catalogQuery}
                onChange={(event) => setCatalogQuery(event.target.value)}
                placeholder="Išči po nazivu ali šifri"
                aria-label="Išči artikel"
                wrapperClassName={adminTableSearchWrapperClassName}
                inputClassName={adminTableSearchInputClassName}
                iconClassName={adminTableSearchIconClassName}
              />
            </div>

            <div className="mt-3 max-h-[360px] overflow-y-auto rounded-md border border-slate-200">
              {filteredChoices.map((choice) => (
                <button
                  key={choice.sku}
                  type="button"
                  onClick={() => addCatalogItem(choice)}
                  className="flex w-full items-center justify-between border-b border-slate-200/80 px-3 py-3 text-left text-[12px] text-slate-700 transition-colors hover:bg-[color:var(--admin-table-row-hover)] last:border-b-0"
                >
                  <span className="font-medium text-slate-900">{choice.name}</span>
                  <span className="text-[12px] text-slate-600">{formatCurrency(choice.unitPrice)}</span>
                </button>
              ))}
              {filteredChoices.length === 0 ? (
                <div className="px-3 py-6 text-center text-[12px] text-slate-500">Ni ujemajočih artiklov.</div>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
