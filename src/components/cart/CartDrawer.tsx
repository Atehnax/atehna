'use client';

import Link from 'next/link';
import { useCartStore } from '@/lib/cart/store';

export default function CartDrawer() {
  const items = useCartStore((state) => state.items);
  const isOpen = useCartStore((state) => state.isOpen);
  const closeDrawer = useCartStore((state) => state.closeDrawer);
  const setQuantity = useCartStore((state) => state.setQuantity);
  const removeItem = useCartStore((state) => state.removeItem);

  const formatter = new Intl.NumberFormat('sl-SI', {
    style: 'currency',
    currency: 'EUR'
  });

  const total = items.reduce(
    (sum, item) => sum + (item.unitPrice ?? 0) * item.quantity,
    0
  );

  return (
    <div
      className={`fixed inset-0 z-50 transition ${isOpen ? 'visible' : 'invisible'}`}
      aria-hidden={!isOpen}
    >
      <div
        className={`absolute inset-0 bg-slate-900/40 transition-opacity ${
          isOpen ? 'opacity-100' : 'opacity-0'
        }`}
        onClick={closeDrawer}
      />
      <aside
        className={`absolute right-0 top-0 h-full w-full max-w-md transform bg-white shadow-xl transition-transform ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
        aria-label="Košarica"
      >
        <div className="flex h-full flex-col">
          <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
            <div>
              <p className="text-lg font-semibold text-slate-900">Košarica</p>
              <p className="text-sm text-slate-500">Priprava naročila za šolo.</p>
            </div>
            <button
              type="button"
              onClick={closeDrawer}
              className="text-sm font-semibold text-slate-500 hover:text-slate-700"
            >
              Zapri
            </button>
          </div>

          <div className="flex-1 space-y-4 overflow-y-auto px-6 py-4">
            {items.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center text-sm text-slate-600">
                Košarica je prazna. Dodajte izdelke iz posameznih kategorij.
              </div>
            ) : (
              items.map((item) => (
                <div
                  key={item.sku}
                  className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{item.name}</p>
                      <p className="text-xs text-slate-500">SKU: {item.sku}</p>
                      <p className="mt-1 text-xs text-slate-500">
                        Cena: {item.unitPrice != null ? formatter.format(item.unitPrice) : '—'}
                      </p>
                      {item.unit && (
                        <p className="mt-1 text-xs text-slate-500">Enota: {item.unit}</p>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => removeItem(item.sku)}
                      className="text-xs font-semibold text-slate-400 hover:text-slate-600"
                    >
                      Odstrani
                    </button>
                  </div>

                  <div className="mt-3 flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setQuantity(item.sku, item.quantity - 1)}
                      className="h-8 w-8 rounded-full border border-slate-200 text-sm font-semibold text-slate-600"
                    >
                      −
                    </button>
                    <input
                      type="number"
                      min={1}
                      value={item.quantity}
                      onChange={(event) => {
                        const next = Number.parseInt(event.target.value, 10);
                        setQuantity(item.sku, Number.isNaN(next) ? item.quantity : next);
                      }}
                      className="w-16 rounded-lg border border-slate-200 px-2 py-1 text-center text-sm font-semibold text-slate-700"
                    />
                    <button
                      type="button"
                      onClick={() => setQuantity(item.sku, item.quantity + 1)}
                      className="h-8 w-8 rounded-full border border-slate-200 text-sm font-semibold text-slate-600"
                    >
                      +
                    </button>
                    <span className="ml-auto text-sm font-semibold text-slate-900">
                      {formatter.format((item.unitPrice ?? 0) * item.quantity)}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="border-t border-slate-200 px-6 py-4">
            <div className="mb-4 flex items-center justify-between text-sm font-semibold text-slate-900">
              <span>Skupaj</span>
              <span>{formatter.format(total)}</span>
            </div>
            <div className="flex flex-col gap-3">
              <button
                type="button"
                onClick={closeDrawer}
                className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-brand-200 hover:text-brand-600"
              >
                Nadaljuj z brskanjem
              </button>
              <Link
                href="/order"
                onClick={closeDrawer}
                className="rounded-full bg-brand-600 px-4 py-2 text-center text-sm font-semibold text-white shadow-sm transition hover:bg-brand-700"
              >
                Nadaljuj na naročilo
              </Link>
            </div>
          </div>
        </div>
      </aside>
    </div>
  );
}
