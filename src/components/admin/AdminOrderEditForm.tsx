'use client';

import { type ReactNode, useEffect, useMemo, useState } from 'react';

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
  createdAt: string;
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

const parseLocaleNumber = (value: string) => {
  const trimmed = value.trim();
  const normalized = trimmed.includes(',')
    ? trimmed.replace(/\./g, '').replace(',', '.')
    : trimmed;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
};

const formatDecimalInput = (value: number) =>
  new Intl.NumberFormat('sl-SI', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);

const isFilled = (value: unknown) => {
  if (typeof value === 'string') return value.trim().length > 0;
  if (typeof value === 'number') return Number.isFinite(value);
  return false;
};
const toDateInputValue = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return new Date().toISOString().slice(0, 10);
  return date.toISOString().slice(0, 10);
};


type FloatingInputProps = {
  id: string;
  label: string;
  type?: string;
  value: string;
  onChange: (value: string) => void;
};

function FloatingInput({ id, label, type = 'text', value, onChange }: FloatingInputProps) {
  return (
    <div className="group relative" data-filled={isFilled(value) ? 'true' : 'false'}>
      <input
        id={id}
        type={type}
        value={value}
        placeholder=" "
        onChange={(event) => onChange(event.target.value)}
        className="h-11 w-full rounded-xl border border-slate-300 bg-white px-3 pb-1 pt-4 text-[12px] text-slate-900 shadow-sm outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
      />
      <label
        htmlFor={id}
        className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[12px] text-slate-400 transition-all duration-150 group-focus-within:top-1.5 group-focus-within:translate-y-0 group-focus-within:bg-white group-focus-within:px-1 group-focus-within:text-[10px] group-focus-within:text-slate-600 group-data-[filled=true]:top-1.5 group-data-[filled=true]:translate-y-0 group-data-[filled=true]:bg-white group-data-[filled=true]:px-1 group-data-[filled=true]:text-[10px] group-data-[filled=true]:text-slate-600"
      >
        {label}
      </label>
    </div>
  );
}

type FloatingTextareaProps = {
  id: string;
  label: string;
  value: string;
  rows?: number;
  onChange: (value: string) => void;
};

function FloatingTextarea({ id, label, value, rows = 3, onChange }: FloatingTextareaProps) {
  return (
    <div className="group relative" data-filled={isFilled(value) ? 'true' : 'false'}>
      <textarea
        id={id}
        rows={rows}
        value={value}
        placeholder=" "
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-xl border border-slate-300 bg-white px-3 pb-2 pt-5 text-[12px] text-slate-900 shadow-sm outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
      />
      <label
        htmlFor={id}
        className="pointer-events-none absolute left-3 top-5 -translate-y-1/2 text-[12px] text-slate-400 transition-all duration-150 group-focus-within:top-1.5 group-focus-within:translate-y-0 group-focus-within:bg-white group-focus-within:px-1 group-focus-within:text-[10px] group-focus-within:text-slate-600 group-data-[filled=true]:top-1.5 group-data-[filled=true]:translate-y-0 group-data-[filled=true]:bg-white group-data-[filled=true]:px-1 group-data-[filled=true]:text-[10px] group-data-[filled=true]:text-slate-600"
      >
        {label}
      </label>
    </div>
  );
}
type StaticFloatingSelectProps = {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  children: ReactNode;
};

function StaticFloatingSelect({ id, label, value, onChange, children }: StaticFloatingSelectProps) {
  return (
    <div className="relative">
      <select
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-11 w-full appearance-none rounded-xl border border-slate-300 bg-white px-3 pb-1 pt-4 text-[12px] text-slate-900 shadow-sm outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
      >
        {children}
      </select>
      <label
        htmlFor={id}
        className="pointer-events-none absolute left-3 top-1.5 bg-white px-1 text-[10px] text-slate-600"
      >
        {label}
      </label>
      <svg
        viewBox="0 0 20 20"
        className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
      >
        <path d="M5 7.5l5 5 5-5" />
      </svg>
    </div>
  );
}


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
  createdAt,
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
    notes: notes?.trim() ? notes : '/',
    orderDate: toDateInputValue(createdAt)
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

      setMessage('Podatki naročila so posodobljeni. Ustvarite novo verzijo PDF dokumentov.');
      setIsDirty(false);
      window.dispatchEvent(
        new CustomEvent('admin-order-details-updated', {
          detail: {
            organizationName: formData.organizationName,
            contactName: formData.contactName,
            customerType: formData.customerType,
            email: formData.email,
            deliveryAddress: formData.deliveryAddress,
            notes: formData.notes.trim() ? formData.notes : '/'
          }
        })
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Napaka pri shranjevanju.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="text-base font-semibold text-slate-900">Uredi naročilo</h2>
      {isDirty && (
        <p className="mt-2 text-xs font-medium text-amber-700">
          Imate neshranjene spremembe. Pred odhodom shranite obrazec.
        </p>
      )}

      <form className="mt-4 space-y-6 text-[12px]" onSubmit={handleSubmit}>
        <div className="space-y-4">
          <section className="rounded-2xl border border-slate-200 bg-slate-50/40 p-4">
            <h3 className="text-sm font-semibold text-slate-900">Uredi naslov</h3>
            <div className="mt-3 grid gap-4 md:grid-cols-2">
              {[
                ['organizationName', 'Naziv organizacije'],
                ['contactName', 'Kontaktna oseba'],
                ['email', 'Email']
              ].map(([fieldName, label]) => (
                <div key={fieldName} className={fieldName === 'organizationName' ? 'md:col-span-2' : ''}>
                  <FloatingInput
                    id={fieldName}
                    type={fieldName === 'email' ? 'email' : 'text'}
                    label={label}
                    value={String(formData[fieldName as keyof typeof formData] ?? '')}
                    onChange={(value) => {
                      setFormData((previousValue) => ({ ...previousValue, [fieldName]: value }));
                      markDirty();
                    }}
                  />
                </div>
              ))}

              <div className="md:col-span-2">
                <FloatingInput
                  id="deliveryAddress"
                  label="Naslov dostave"
                  value={formData.deliveryAddress}
                  onChange={(value) => {
                    setFormData((previousValue) => ({ ...previousValue, deliveryAddress: value }));
                    markDirty();
                  }}
                />
              </div>
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-slate-50/40 p-4">
            <h3 className="text-sm font-semibold text-slate-900">Uredi naročilo</h3>
            <div className="mt-3 grid gap-4 md:grid-cols-2">
              <div className="md:col-span-1">
                <div className="relative">
                  <label className="pointer-events-none absolute left-2.5 top-1.5 bg-white px-1 text-[10px] text-slate-600">Datum</label>
                  <input
                    type="date"
                    lang="sl-SI"
                    value={formData.orderDate}
                    onChange={(event) => {
                      setFormData((previousValue) => ({ ...previousValue, orderDate: event.target.value }));
                      markDirty();
                    }}
                    className="h-10 w-full rounded-xl border border-slate-300 bg-white px-2.5 pt-4 text-xs"
                  />
                </div>
              </div>

              <div className="md:col-span-1">
                <StaticFloatingSelect
                  id="customerType"
                  label="Tip naročila"
                  value={formData.customerType}
                  onChange={(value) => {
                    setFormData((previousValue) => ({ ...previousValue, customerType: value }));
                    markDirty();
                  }}
                >
                  {customerTypeOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </StaticFloatingSelect>
              </div>

              <div className="md:col-span-2">
                <FloatingTextarea
                  id="notes"
                  label="Opombe"
                  rows={3}
                  value={formData.notes}
                  onChange={(value) => {
                    setFormData((previousValue) => ({ ...previousValue, notes: value }));
                    markDirty();
                  }}
                />
              </div>
            </div>
          </section>
        </div>

        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-50/50">
          <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
            <h3 className="text-sm font-semibold text-slate-900">Postavke</h3>
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
                {editableItems.map((item) => (
                  <tr key={item.id} className="border-t border-slate-200/80 bg-white/80">
                    <td className="px-3 py-2">
                      <p className="font-medium text-slate-900">{item.name}</p>
                    </td>
                    <td className="px-2 py-2 text-center">
                      <input
                        type="number"
                        min={1}
                        value={item.quantity}
                        onChange={(event) =>
                          updateItem(item.id, { quantity: Number(event.target.value) || 1 })
                        }
                        className="h-9 w-16 rounded-lg border border-slate-300 bg-white px-2 text-center shadow-sm outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
                      />
                    </td>
                    <td className="px-2 py-2 text-center">
                      <input
                        type="text"
                        inputMode="decimal"
                        value={formatDecimalInput(item.unitPrice)}
                        onChange={(event) =>
                          updateItem(item.id, { unitPrice: parseLocaleNumber(event.target.value) })
                        }
                        className="h-9 w-24 rounded-lg border border-slate-300 bg-white px-2 text-center shadow-sm outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
                      />
                    </td>
                    <td className="px-2 py-2 text-center">
                      <input
                        type="text"
                        inputMode="decimal"
                        value={formatDecimalInput(item.discountPercentage)}
                        onChange={(event) =>
                          updateItem(item.id, { discountPercentage: parseLocaleNumber(event.target.value) })
                        }
                        className="h-9 w-20 rounded-lg border border-slate-300 bg-white px-2 text-center shadow-sm outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
                      />
                    </td>
                    <td className="px-2 py-2 text-right font-semibold text-slate-900">
                      {formatCurrency(lineTotal(item))}
                    </td>
                    <td className="px-2 py-2 text-right">
                      <button
                        type="button"
                        onClick={() => removeItem(item.id)}
                        className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-rose-300 text-base font-semibold leading-none text-rose-600 hover:bg-rose-50"
                        aria-label="Odstrani postavko"
                        title="Odstrani"
                      >
                        ×
                      </button>
                    </td>
                  </tr>
                ))}
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

        <div className="grid gap-3 md:grid-cols-2">
          <button
            type="button"
            onClick={openAddItem}
            className="w-full rounded-xl bg-brand-600 px-4 py-2 text-[12px] font-semibold text-white shadow-sm transition hover:bg-brand-700"
          >
            Dodaj
          </button>
          <button
            type="submit"
            disabled={isSaving}
            className="w-full whitespace-nowrap rounded-xl bg-brand-600 px-4 py-2 text-[12px] font-semibold text-white shadow-sm transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400"
          >
            {isSaving ? 'Shranjevanje...' : 'Shrani spremembe'}
          </button>
          {message && <span className="text-[12px] text-slate-600 md:col-span-2">{message}</span>}
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
