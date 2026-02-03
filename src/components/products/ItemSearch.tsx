'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import type { CatalogSearchItem } from '@/lib/catalog';

type ItemSearchProps = {
  items: CatalogSearchItem[];
  placeholder?: string;
};

const normalize = (value: string) =>
  value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

export default function ItemSearch({
  items,
  placeholder = 'Poiščite izdelek...'
}: ItemSearchProps) {
  const [query, setQuery] = useState('');
  const normalizedQuery = normalize(query);

  const results = useMemo(() => {
    if (!normalizedQuery) return [];
    const tokens = normalizedQuery.split(' ').filter(Boolean);
    return items
      .map((item) => ({
        ...item,
        haystack: normalize(`${item.name} ${item.description}`)
      }))
      .filter((item) => tokens.every((token) => item.haystack.includes(token)))
      .slice(0, 8);
  }, [items, normalizedQuery]);

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <label className="text-xs font-semibold uppercase tracking-widest text-slate-500">
        Hitro iskanje
      </label>
      <input
        type="search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder={placeholder}
        className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
      />
      {normalizedQuery && (
        <div className="mt-3 space-y-2">
          {results.length === 0 ? (
            <p className="text-sm text-slate-500">Ni zadetkov za vpisan pojem.</p>
          ) : (
            results.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="block rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700 transition hover:border-brand-200 hover:text-brand-600"
              >
                <p className="font-semibold text-slate-900">{item.name}</p>
                <p className="text-xs text-slate-500">{item.description}</p>
              </Link>
            ))
          )}
        </div>
      )}
    </div>
  );
}
