'use client';

import { useMemo, useState } from 'react';

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

const TAX_RATE = 0.22;
const toMoney = (value: number) => Math.round(value * 100) / 100;
const formatCurrency = (value: number) =>
  new Intl.NumberFormat('sl-SI', { style: 'currency', currency: 'EUR' }).format(value);

const parseLocaleNumber = (value: string) => {
  const trimmed = value.trim();
  const normalized = trimmed.includes(',') ? trimmed.replace(/\./g, '').replace(',', '.') : trimmed;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
};

const formatDecimalInput = (value: number) =>
  new Intl.NumberFormat('sl-SI', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);

function SaveIcon() {
  return (
    <svg viewBox="0 0 20 20" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M4 3h9l3 3v11H4z" />
      <path d="M7 3v5h6V3" />
      <path d="M7 13h6" />
    </svg>
  );
}

function PencilIcon() {
  return (
    <svg viewBox="0 0 20 20" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M4 14.5l.5-3L13.5 2.5l3 3L7.5 14.5z" />
      <path d="M11.5 4.5l3 3" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg viewBox="0 0 20 20" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M10 4v12M4 10h12" />
    </svg>
  );
}

export default function AdminOrderItemsEditor({ orderId, items }: { orderId: number; items: OrderItemInput[] }) {
  const [editableItems, setEditableItems] = useState<EditableItem[]>(
    items.map((item) => ({
      id: `saved-${item.id}`,
      persistedId: item.id,
      sku: item.sku,
      name: item.name,
      unit: item.unit ?? 'kos',
      quantity: item.quantity,
      unitPrice: item.unit_price ?? 0,
      discountPercentage: item.discount_percentage ?? 0
    }))
  );
  const [catalogChoices, setCatalogChoices] = useState<CatalogChoice[]>([]);
  const [catalogQuery, setCatalogQuery] = useState('');
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const totals = useMemo(() => {
    const subtotal = toMoney(
      editableItems.reduce((sum, item) => sum + item.quantity * item.unitPrice * (1 - item.discountPercentage / 100), 0)
    );
    const tax = toMoney(subtotal * TAX_RATE);
    const total = toMoney(subtotal + tax);
    return { subtotal, tax, total };
  }, [editableItems]);

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
    setEditableItems((currentItems) =>
      currentItems.map((item) => {
        if (item.id !== id) return item;
        const updated = { ...item, ...updates };
        return {
          ...updated,
          quantity: Math.max(1, Number.isFinite(updated.quantity) ? Math.floor(updated.quantity) : 1),
          unitPrice: Math.max(0, Number.isFinite(updated.unitPrice) ? updated.unitPrice : 0),
          discountPercentage: Math.min(100, Math.max(0, Number.isFinite(updated.discountPercentage) ? updated.discountPercentage : 0))
        };
      })
    );
    setMessage(null);
  };

  const removeItem = (id: string) => {
    setEditableItems((currentItems) => currentItems.filter((item) => item.id !== id));
    setMessage(null);
  };

  const openAddItem = async () => {
    setIsPickerOpen(true);
    if (catalogChoices.length > 0) return;
    const response = await fetch('/api/admin/catalog-items');
    if (!response.ok) return;
    const payload = (await response.json()) as { items: CatalogChoice[] };
    setCatalogChoices(payload.items ?? []);
  };

  const addCatalogItem = (choice: CatalogChoice) => {
    setEditableItems((currentItems) => {
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
    setMessage(null);
  };

  const saveItems = async (): Promise<boolean> => {
    if (editableItems.length === 0) {
      setMessage('Naročilo mora vsebovati vsaj eno postavko.');
      return false;
    }

    setIsSaving(true);
    setMessage(null);
    try {
      const response = await fetch(`/api/admin/orders/${orderId}/items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: editableItems.map((item) => ({
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

      setMessage('Postavke so posodobljene.');
      setIsEditing(false);
      return true;
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Napaka pri shranjevanju postavk.');
      return false;
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="text-lg font-semibold text-slate-900">Uredi naročilo</h2>

      <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200 bg-slate-50/50">
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
          <h3 className="text-sm font-semibold text-slate-900">Postavke</h3>
          <div className="ml-auto flex items-center gap-1.5">
            <button
              type="button"
              aria-label="Dodaj postavko"
              onClick={openAddItem}
              disabled={!isEditing}
              className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-slate-200 text-slate-600 hover:bg-slate-100 disabled:cursor-not-allowed disabled:text-slate-300"
            >
              <PlusIcon />
            </button>
            <button
              type="button"
              aria-label="Uredi postavke"
              onClick={() => {
                if (isEditing) {
                  void saveItems();
                  return;
                }
                setIsEditing(true);
                setMessage(null);
              }}
              disabled={isSaving}
              className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-slate-200 text-slate-600 hover:bg-slate-100 disabled:cursor-not-allowed disabled:text-slate-300"
            >
              {isEditing ? <SaveIcon /> : <PencilIcon />}
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-[11px]">
            <thead className="bg-white text-slate-600">
              <tr>
                <th className="px-3 py-2 text-left">Artikel</th>
                <th className="px-2 py-2 text-center">Količina</th>
                <th className="px-2 py-2 text-center">Cena</th>
                <th className="px-2 py-2 text-center">Popust %</th>
                <th className="px-2 py-2 text-right">Skupaj</th>
                <th className="px-2 py-2" aria-label="Dejanje" />
              </tr>
            </thead>
            <tbody>
              {editableItems.map((item) => {
                const lineTotal = toMoney(item.quantity * item.unitPrice * (1 - item.discountPercentage / 100));
                return (
                  <tr key={item.id} className="border-t border-slate-200/80 bg-white/80">
                    <td className="px-3 py-2">
                      <p className="font-medium text-slate-900">{item.name}</p>
                    </td>
                    <td className="px-2 py-2 text-center">
                      <input
                        type="number"
                        min={1}
                        value={item.quantity}
                        disabled={!isEditing}
                        onChange={(event) => updateItem(item.id, { quantity: Number(event.target.value) || 1 })}
                        className="h-9 w-16 rounded-lg border border-slate-300 bg-white px-2 text-center shadow-sm outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
                      />
                    </td>
                    <td className="px-2 py-2 text-center">
                      <input
                        type="text"
                        inputMode="decimal"
                        value={formatDecimalInput(item.unitPrice)}
                        disabled={!isEditing}
                        onChange={(event) => updateItem(item.id, { unitPrice: parseLocaleNumber(event.target.value) })}
                        className="h-9 w-24 rounded-lg border border-slate-300 bg-white px-2 text-center shadow-sm outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
                      />
                    </td>
                    <td className="px-2 py-2 text-center">
                      <input
                        type="text"
                        inputMode="decimal"
                        value={formatDecimalInput(item.discountPercentage)}
                        disabled={!isEditing}
                        onChange={(event) =>
                          updateItem(item.id, { discountPercentage: parseLocaleNumber(event.target.value) })
                        }
                        className="h-9 w-20 rounded-lg border border-slate-300 bg-white px-2 text-center shadow-sm outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
                      />
                    </td>
                    <td className="px-2 py-2 text-right font-semibold text-slate-900">{formatCurrency(lineTotal)}</td>
                    <td className="px-2 py-2 text-right">
                      <button
                        type="button"
                        onClick={() => removeItem(item.id)}
                        disabled={!isEditing}
                        className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-rose-300 text-base font-semibold leading-none text-rose-600 hover:bg-rose-50 disabled:cursor-not-allowed disabled:border-slate-200 disabled:text-slate-300"
                        aria-label="Odstrani postavko"
                        title="Odstrani"
                      >
                        ×
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="space-y-1 border-t border-slate-200 bg-white px-4 py-3 text-[11px] text-slate-700">
          <div className="flex items-center justify-between">
            <span>Vmesni seštevek</span>
            <span className="font-semibold">{formatCurrency(totals.subtotal)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span>DDV</span>
            <span className="font-semibold">{formatCurrency(totals.tax)}</span>
          </div>
          <div className="flex items-center justify-between text-sm font-semibold text-slate-900">
            <span>Skupaj</span>
            <span>{formatCurrency(totals.total)}</span>
          </div>
        </div>
      </div>

      {message && <p className="mt-3 text-[12px] text-slate-600">{message}</p>}

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
            <input
              value={catalogQuery}
              onChange={(event) => setCatalogQuery(event.target.value)}
              placeholder="Išči po nazivu ali šifri"
              className="mt-3 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
            <div className="mt-3 max-h-[360px] overflow-y-auto rounded-lg border border-slate-200">
              {filteredChoices.map((choice) => (
                <button
                  key={choice.sku}
                  type="button"
                  onClick={() => addCatalogItem(choice)}
                  className="flex w-full items-center justify-between border-b border-slate-100 px-3 py-2 text-left text-sm hover:bg-slate-50"
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
