'use client';

import { useMemo, useState } from 'react';
import { EuiFieldText } from '@elastic/eui';
import { IconButton } from '@/shared/ui/icon-button';
import { PencilIcon, PlusIcon, SaveIcon, TrashCanIcon } from '@/shared/ui/icons/AdminActionIcons';
import { useToast } from '@/shared/ui/toast';

type OrderItemInput = {
  id: number;
  sku: string;
  name: string;
  unit: string | null;
  quantity: number;
  unit_price: number | null;
  discount_percentage?: number;
};

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

export default function AdminOrderItemsEditor({
  orderId,
  items,
  initialSubtotal = 0,
  initialTax = 0,
  initialTotal = 0
}: {
  orderId: number;
  items: OrderItemInput[];
  initialSubtotal?: number;
  initialTax?: number;
  initialTotal?: number;
}) {
  const initialMappedItems = useMemo(() => mapIncomingItems(items), [items]);
  const [itemsSectionMode, setItemsSectionMode] = useState<ItemsSectionMode>('read');
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

  const isItemsDirty = useMemo(
    () => !areEditableItemsEqual(draftItems, persistedItems) || toMoney(draftShipping) !== toMoney(persistedShipping),
    [draftItems, persistedItems, draftShipping, persistedShipping]
  );

  const itemsEditable = itemsSectionMode === 'edit';
  const itemsSaveDisabled = !itemsEditable || isItemsSaving;
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
    if (itemsSectionMode === 'edit') {
      setDraftItems(cloneEditableItems(persistedItems));
      setDraftShipping(persistedShipping);
      setSelectedDraftItemIds([]);
      setItemsSectionMode('read');
      return;
    }

    setDraftItems(cloneEditableItems(persistedItems));
    setDraftShipping(persistedShipping);
    setSelectedDraftItemIds([]);
    setItemsSectionMode('edit');
  };

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

  const saveItems = async () => {
    if (itemsSaveDisabled) return;

    if (!isItemsDirty) {
      setItemsSectionMode('read');
      return;
    }

    if (draftItems.length === 0) {
      toast.error('Naročilo mora vsebovati vsaj eno postavko.');
      return;
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
      setItemsSectionMode('read');
      toast.success('Postavke so posodobljene.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Napaka pri shranjevanju postavk.');
    } finally {
      setIsItemsSaving(false);
    }
  };

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
    <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="text-lg font-semibold text-slate-900">Uredi naročilo</h2>

      <div className="mt-4 min-h-[340px] overflow-hidden rounded-2xl border border-slate-200 bg-slate-50/50">
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
          <h3 className="text-sm font-semibold text-slate-900">Postavke</h3>
          <div className="ml-auto flex items-center gap-1.5">
            <IconButton
              type="button"
              aria-label="Uredi postavke"
              onClick={startItemsEdit}
              title="Uredi"
              tone="neutral"
              disabled={isItemsSaving}
            >
              <PencilIcon />
            </IconButton>

            <IconButton
              type="button"
              aria-label="Shrani postavke"
              onClick={() => void saveItems()}
              title="Shrani"
              tone="neutral"
              disabled={itemsSaveDisabled}
            >
              <SaveIcon />
            </IconButton>

            <IconButton
              type="button"
              aria-label="Dodaj postavko"
              onClick={() => void openAddItem()}
              title="Dodaj"
              tone="neutral"
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
              disabled={!itemsEditable || !hasSelectedDraftItems}
            >
              <TrashCanIcon />
            </IconButton>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-[11px] leading-4">
            <colgroup>
              <col style={{ width: '4%' }} />
              <col style={{ width: '53%' }} />
              <col style={{ width: '10%' }} />
              <col style={{ width: '10%' }} />
              <col style={{ width: '10%' }} />
              <col style={{ width: '13%' }} />
            </colgroup>
            <thead className="bg-white text-slate-600">
              <tr>
                <th className="px-1 py-2 text-center" aria-label="Izbira">
                  <input
                    type="checkbox"
                    checked={itemsEditable ? areAllActiveItemsSelected : false}
                    disabled={!itemsEditable}
                    onChange={toggleAllDraftItems}
                    className="h-3.5 w-3.5 rounded border-slate-300 text-[color:var(--blue-500)] focus:ring-0 disabled:cursor-default disabled:opacity-45"
                    aria-label="Izberi vse postavke"
                  />
                </th>
                <th className="px-3 py-2 text-left">Artikel</th>
                <th className="px-2 py-2 text-center">Količina</th>
                <th className="px-2 py-2 text-center">Cena</th>
                <th className="px-2 py-2 text-center">Popust %</th>
                <th className="px-2 py-2 text-right">Skupaj</th>
              </tr>
            </thead>
            <tbody>
              {activeItems.map((item) => {
                const lineTotal = toMoney(item.quantity * item.unitPrice * (1 - item.discountPercentage / 100));
                return (
                  <tr key={item.id} className="border-t border-slate-200/80 bg-white/80 align-middle">
                    <td className="px-1 py-1.5 align-middle text-center">
                      <input
                        type="checkbox"
                        checked={selectedDraftItemIds.includes(item.id)}
                        disabled={!itemsEditable}
                        onChange={() => toggleSelectedDraftItem(item.id)}
                        className="h-3.5 w-3.5 rounded border-slate-300 text-[color:var(--blue-500)] focus:ring-0 disabled:cursor-default disabled:opacity-45"
                        aria-label={`Izberi postavko ${item.name}`}
                      />
                    </td>
                    <td className="px-3 py-1.5 align-middle">
                      <p className="text-[11px] leading-4 font-medium text-slate-900">{item.name}</p>
                    </td>
                    <td className="px-2 py-1.5 align-middle text-center">
                      {itemsEditable ? (
                        <input
                          type="number"
                          min={1}
                          value={item.quantity}
                          onChange={(event) => updateItem(item.id, { quantity: Number(event.target.value) || 1 })}
                          aria-label="Količina"
                          className="h-5 w-10 rounded-md border border-slate-300 bg-white px-0.5 text-center text-[11px] leading-4 outline-none transition focus:border-[#3e67d6] focus:ring-0"
                        />
                      ) : (
                        <span className="inline-flex h-5 w-10 items-center justify-center text-[11px] leading-4 text-slate-900">
                          {item.quantity}
                        </span>
                      )}
                    </td>
                    <td className="px-2 py-1.5 align-middle text-center">
                      <span className="inline-flex w-[60px] items-center justify-center gap-1">
                        {itemsEditable ? (
                          <input
                            type="text"
                            inputMode="decimal"
                            value={formatDecimalInput(item.unitPrice)}
                            onChange={(event) => updateItem(item.id, { unitPrice: parseLocaleNumber(event.target.value) })}
                            aria-label="Cena"
                            className="h-5 w-14 rounded-md border border-slate-300 bg-white px-0.5 text-center text-[11px] leading-4 outline-none transition focus:border-[#3e67d6] focus:ring-0"
                          />
                        ) : (
                          <span className="inline-flex h-5 w-14 items-center justify-center text-[11px] leading-4 text-slate-900">
                            {formatDecimalInput(item.unitPrice)}
                          </span>
                        )}
                        <span className="text-[11px] leading-4 text-slate-900">€</span>
                      </span>
                    </td>
                    <td className="px-2 py-1.5 align-middle text-center">
                      <span className="inline-flex w-[45px] items-center justify-center gap-1">
                        {itemsEditable ? (
                          <input
                            type="text"
                            inputMode="decimal"
                            value={formatDecimalInput(item.discountPercentage)}
                            onChange={(event) =>
                              updateItem(item.id, { discountPercentage: parseLocaleNumber(event.target.value) })
                            }
                            aria-label="Popust"
                            className="h-5 w-10 rounded-md border border-slate-300 bg-white px-0.5 text-center text-[11px] leading-4 outline-none transition focus:border-[#3e67d6] focus:ring-0"
                          />
                        ) : (
                          <span className="inline-flex h-5 w-10 items-center justify-center text-[11px] leading-4 text-slate-900">
                            {formatDecimalInput(item.discountPercentage)}
                          </span>
                        )}
                        <span className="text-[11px] leading-4 text-slate-900">%</span>
                      </span>
                    </td>
                    <td className="px-2 py-1.5 align-middle text-right font-semibold text-slate-900">{formatCurrency(lineTotal)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="space-y-1 border-t border-slate-200 px-2 py-3 text-[11px] text-slate-700">
          <div className="flex items-center justify-between">
            <span>Vmesni seštevek</span>
            <span className="inline-flex w-[13%] justify-end font-semibold">{formatCurrency(totals.subtotal)}</span>
          </div>
          <div className="flex h-5 items-center justify-between">
            <span>Poštnina</span>
            <span className="inline-flex w-[13%] justify-end">
              {itemsEditable ? (
                <span className="inline-flex h-5 items-center justify-end gap-1">
                  <input
                    type="text"
                    inputMode="decimal"
                    value={formatDecimalInput(draftShipping)}
                    onChange={(event) => {
                      const sanitized = event.target.value.replace(/[^0-9,]/g, '').slice(0, 5);
                      setDraftShipping(Math.max(0, parseLocaleNumber(sanitized)));
                    }}
                    aria-label="Poštnina"
                    className="h-5 w-[38px] rounded-md border border-slate-300 bg-white px-0.5 text-right text-[11px] leading-4 outline-none transition focus:border-[#3e67d6] focus:ring-0"
                  />
                  <span className="text-[11px] leading-4 text-slate-900">€</span>
                </span>
              ) : (
                <span className="inline-flex h-5 items-center font-semibold">{formatCurrency(totals.shipping)}</span>
              )}
            </span>
          </div>
          <div className="flex items-center justify-between text-slate-500">
            <span>DDV (22 %)</span>
            <span className="inline-flex w-[13%] justify-end font-semibold">{formatCurrency(totals.taxIncludedInfo)}</span>
          </div>
          <hr className="border-slate-200" />
          <div className="flex items-center justify-between text-sm font-semibold text-slate-900">
            <span>Skupaj</span>
            <span className="inline-flex w-[13%] justify-end">{formatCurrency(totals.total)}</span>
          </div>
        </div>
      </div>

      {isPickerOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="w-full max-w-2xl rounded-xl bg-white p-4 shadow-xl">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-900">Dodaj artikel</h3>
              <button
                type="button"
                className="text-xs text-slate-500 hover:text-slate-700"
                onClick={() => setIsPickerOpen(false)}
              >
                Zapri
              </button>
            </div>
            <EuiFieldText
              value={catalogQuery}
              onChange={(event) => setCatalogQuery(event.target.value)}
              placeholder="Išči po nazivu ali šifri"
              aria-label="Išči artikel"
              className="mt-3 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
            <div className="mt-3 max-h-[360px] overflow-y-auto rounded-lg border border-slate-200">
              {filteredChoices.map((choice) => (
                <button
                  key={choice.sku}
                  type="button"
                  onClick={() => addCatalogItem(choice)}
                  className="flex w-full items-center justify-between border-b border-slate-100 px-3 py-2 text-left text-sm hover:bg-[color:var(--hover-neutral)]"
                >
                  <span className="font-medium text-slate-900">{choice.name}</span>
                  <span className="text-xs text-slate-600">{formatCurrency(choice.unitPrice)}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
