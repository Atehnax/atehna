'use client';

import Image from 'next/image';
import { useMemo } from 'react';
import { useCartStore } from '@/lib/cart/store';

type ProductItem = {
  sku: string;
  name: string;
  unit?: string;
  image?: string;
};

type ProductListProps = {
  items: ProductItem[];
  category: string;
};

export default function ProductList({ items, category }: ProductListProps) {
  const addItem = useCartStore((state) => state.addItem);
  const openDrawer = useCartStore((state) => state.openDrawer);

  const sortedItems = useMemo(
    () => [...items].sort((a, b) => a.name.localeCompare(b.name, 'sl')),
    [items]
  );

  if (sortedItems.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-6 text-sm text-slate-600">
        Seznam izdelkov za to kategorijo je v pripravi. Kontaktirajte nas za trenutno ponudbo.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {sortedItems.map((item) => (
        <div
          key={item.sku}
          className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="flex items-center gap-4">
            {item.image && (
              <div className="relative h-12 w-12 overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
                <Image src={item.image} alt={item.name} fill className="object-cover" />
              </div>
            )}
            <div>
              <p className="text-sm font-semibold text-slate-900">{item.name}</p>
              <p className="text-xs text-slate-500">SKU: {item.sku}</p>
              {item.unit && <p className="text-xs text-slate-500">Enota: {item.unit}</p>}
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              addItem({ sku: item.sku, name: item.name, unit: item.unit, category });
              openDrawer();
            }}
            className="rounded-full bg-brand-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-700"
          >
            Dodaj v naročilo
          </button>
        </div>
      ))}
    </div>
  );
}
