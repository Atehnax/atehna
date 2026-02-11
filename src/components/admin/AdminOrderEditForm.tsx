'use client';

import { useEffect, useMemo, useState } from 'react';

type OrderItemInput = {
  id: number;
  sku: string;
  name: string;
  unit: string | null;
  quantity: number;
  unit_price: number | null;
  total_price: number | null;
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

type Props = {
  orderId: number;
  customerType: string;
  organizationName: string | null;
  contactName: string;
  email: string;
  phone: string | null;
  deliveryAddress: string | null;
  reference: string | null;
  notes: string | null;
  items: OrderItemInput[];
};

const customerTypeOptions = [
  { value: 'individual', label: 'Fizična oseba' },
  { value: 'company', label: 'Podjetje' },
  { value: 'school', label: 'Šola / javni zavod' }
];

const TAX_RATE = 0.22;

const toMoney = (value: number) => Math.round(value * 100) / 100;

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('sl-SI', { style: 'currency', currency: 'EUR' }).format(value);

const lineBase = (item: EditableItem) => item.quantity * item.unitPrice;
const lineTotal = (item: EditableItem) => toMoney(lineBase(item) * (1 - item.discountPercentage / 100));

export default function AdminOrderEditForm({
  orderId,
  customerType,
  organizationName,
  contactName,
  email,
  phone,
  deliveryAddress,
  reference,
  notes,
  items
}: Props) {
  const [formData, setFormData] = useState({
    customerType,
    organizationName: organizationName ?? '',
    contactName,
    email,
    phone: phone ?? '',
    deliveryAddress: deliveryAddress ?? '',
    reference: reference ?? '',
    notes: notes ?? ''
  });
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
  const [message, setMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isDirty, setIsDirty] = useState(false);

  useEffect(() => {
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!isDirty) return;
      event.preventDefault();
      event.returnValue = '';
    };

    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [isDirty]);

  const totals = useMemo(() => {
    const subtotal = toMoney(editableItems.reduce((sum, item) => sum + lineTotal(item), 0));
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

  const markDirty = () => {
    setIsDirty(true);
    setMessage(null);
  };

  const updateItem = (id: string, updates: Partial<EditableItem>) => {
    setEditableItems((currentItems) =>
      currentItems.map((item) => {
        if (item.id !== id) return item;
        const updatedItem = { ...item, ...updates };
        const safeQuantity = Number.isFinite(updatedItem.quantity)
          ? Math.max(1, Math.floor(updatedItem.quantity))
          : 1;
        const safeUnitPrice = Number.isFinite(updatedItem.unitPrice) ? Math.max(0, updatedItem.unitPrice) : 0;
        const safeDiscount = Number.isFinite(updatedItem.discountPercentage)
          ? Math.min(100, Math.max(0, updatedItem.discountPercentage))
          : 0;
        return {
          ...updatedItem,
          quantity: safeQuantity,
          unitPrice: safeUnitPrice,
          discountPercentage: safeDiscount
        };
      })
    );
    markDirty();
  };

  const removeItem = (id: string) => {
    setEditableItems((currentItems) => currentItems.filter((item) => item.id !== id));
    markDirty();
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
      const existingItem = currentItems.find((item) => item.sku === choice.sku);
      if (existingItem) {
        return currentItems.map((item) =>
          item.id === existingItem.id ? { ...item, quantity: item.quantity + 1 } : item
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
    markDirty();
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (editableItems.length === 0) {
      setMessage('Naročilo mora vsebovati vsaj eno postavko.');
      return;
    }

    setMessage(null);
    setIsSaving(true);
    try {
      const detailsResponse = await fetch(`/api/admin/orders/${orderId}/details`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      if (!detailsResponse.ok) {
        const error = await detailsResponse.json().catch(() => ({}));
        throw new Error(error.message || 'Shranjevanje kontaktnih podatkov ni uspelo.');
      }

      const itemsResponse = await fetch(`/api/admin/orders/${orderId}/items`, {
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

      if (!itemsResponse.ok) {
        const error = await itemsResponse.json().catch(() => ({}));
        throw new Error(error.message || 'Shranjevanje postavk ni uspelo.');
      }

      setMessage('Podatki naročila so posodobljeni. Ustvarite novo verzijo PDF dokumentov po potrebi.');
      setIsDirty(false);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Napaka pri shranjevanju.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="text-lg font-semibold text-slate-900">Uredi naročilo</h2>
      {isDirty && (
        <p className="mt-2 text-xs font-medium text-amber-700">
          Imate neshranjene spremembe. Pred odhodom shranite obrazec.
        </p>
      )}

      <form className="mt-4 space-y-6" onSubmit={handleSubmit}>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="md:col-span-2">
            <label className="text-sm font-medium text-slate-700" htmlFor="customerType">
              Tip naročnika
            </label>
            <select
              id="customerType"
              value={formData.customerType}
              onChange={(event) => {
                setFormData((previousValue) => ({ ...previousValue, customerType: event.target.value }));
                markDirty();
              }}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            >
              {customerTypeOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          {[
            ['organizationName', 'Naziv organizacije'],
            ['contactName', 'Kontaktna oseba'],
            ['email', 'Email'],
            ['phone', 'Telefon'],
            ['reference', 'Sklic']
          ].map(([fieldName, label]) => (
            <div key={fieldName} className={fieldName === 'organizationName' ? 'md:col-span-2' : ''}>
              <label className="text-sm font-medium text-slate-700" htmlFor={fieldName}>
                {label}
              </label>
              <input
                id={fieldName}
                type={fieldName === 'email' ? 'email' : 'text'}
                value={formData[fieldName as keyof typeof formData]}
                onChange={(event) => {
                  setFormData((previousValue) => ({ ...previousValue, [fieldName]: event.target.value }));
                  markDirty();
                }}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
          ))}

          <div className="md:col-span-2">
            <label className="text-sm font-medium text-slate-700" htmlFor="deliveryAddress">
              Naslov dostave
            </label>
            <input
              id="deliveryAddress"
              value={formData.deliveryAddress}
              onChange={(event) => {
                setFormData((previousValue) => ({ ...previousValue, deliveryAddress: event.target.value }));
                markDirty();
              }}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </div>

          <div className="md:col-span-2">
            <label className="text-sm font-medium text-slate-700" htmlFor="notes">
              Opombe
            </label>
            <textarea
              id="notes"
              rows={3}
              value={formData.notes}
              onChange={(event) => {
                setFormData((previousValue) => ({ ...previousValue, notes: event.target.value }));
                markDirty();
              }}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
        </div>

        <div className="rounded-xl border border-slate-200">
          <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
            <h3 className="text-sm font-semibold text-slate-900">Postavke</h3>
            <button
              type="button"
              onClick={openAddItem}
              className="rounded-full border border-slate-300 px-3 py-1 text-xs font-semibold text-slate-700 transition hover:border-brand-300 hover:text-brand-700"
            >
              + Dodaj artikel
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full text-xs">
              <thead className="bg-slate-50 text-slate-600">
                <tr>
                  <th className="px-3 py-2 text-left">Artikel</th>
                  <th className="px-2 py-2 text-center">Količina</th>
                  <th className="px-2 py-2 text-right">Cena</th>
                  <th className="px-2 py-2 text-center">Popust %</th>
                  <th className="px-2 py-2 text-right">Skupaj</th>
                  <th className="px-2 py-2" aria-label="Dejanje" />
                </tr>
              </thead>
              <tbody>
                {editableItems.map((item) => (
                  <tr key={item.id} className="border-t border-slate-100">
                    <td className="px-3 py-2">
                      <p className="font-medium text-slate-900">{item.name}</p>
                      <p className="text-[11px] text-slate-500">{item.sku}</p>
                    </td>
                    <td className="px-2 py-2 text-center">
                      <input
                        type="number"
                        min={1}
                        value={item.quantity}
                        onChange={(event) =>
                          updateItem(item.id, { quantity: Number(event.target.value) || 1 })
                        }
                        className="h-8 w-16 rounded border border-slate-300 px-2 text-center"
                      />
                    </td>
                    <td className="px-2 py-2 text-right">
                      <input
                        type="number"
                        min={0}
                        step="0.01"
                        value={item.unitPrice}
                        onChange={(event) =>
                          updateItem(item.id, { unitPrice: Number(event.target.value) || 0 })
                        }
                        className="h-8 w-24 rounded border border-slate-300 px-2 text-right"
                      />
                    </td>
                    <td className="px-2 py-2 text-center">
                      <input
                        type="number"
                        min={0}
                        max={100}
                        step="0.01"
                        value={item.discountPercentage}
                        onChange={(event) =>
                          updateItem(item.id, { discountPercentage: Number(event.target.value) || 0 })
                        }
                        className="h-8 w-20 rounded border border-slate-300 px-2 text-center"
                      />
                    </td>
                    <td className="px-2 py-2 text-right font-semibold text-slate-900">
                      {formatCurrency(lineTotal(item))}
                    </td>
                    <td className="px-2 py-2 text-right">
                      <button
                        type="button"
                        onClick={() => removeItem(item.id)}
                        className="rounded-md border border-rose-200 px-2 py-1 text-[11px] font-medium text-rose-600 hover:bg-rose-50"
                      >
                        Odstrani
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="space-y-1 border-t border-slate-200 px-4 py-3 text-xs text-slate-700">
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

        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={isSaving}
            className="rounded-full bg-brand-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400"
          >
            {isSaving ? 'Shranjevanje...' : 'Shrani spremembe'}
          </button>
          {message && <span className="text-sm text-slate-600">{message}</span>}
        </div>
      </form>

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
                  <span>
                    <span className="font-medium text-slate-900">{choice.name}</span>
                    <span className="ml-2 text-xs text-slate-500">{choice.sku}</span>
                  </span>
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
