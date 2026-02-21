'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

type PresetKey =
  | 'today'
  | 'yesterday'
  | 'last7'
  | 'last30'
  | 'last3m'
  | 'last6m'
  | 'last12m';

const PRESETS: Array<{ key: PresetKey; label: string }> = [
  { key: 'today', label: 'Danes' },
  { key: 'yesterday', label: 'Včeraj' },
  { key: 'last7', label: 'Zadnjih 7 dni' },
  { key: 'last30', label: 'Zadnjih 30 dni' },
  { key: 'last3m', label: 'Zadnje 3 mesece' },
  { key: 'last6m', label: 'Zadnjih 6 mesecev' },
  { key: 'last12m', label: 'Zadnje leto' }
];

const toYmd = (date: Date) => date.toISOString().slice(0, 10);

const atMidnight = (date: Date) => {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
};

const addDays = (date: Date, days: number) => {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
};

const formatDisplayDate = (value: string) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('sl-SI', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  }).format(date);
};

const getPresetRange = (key: PresetKey): { from: string; to: string } => {
  const today = atMidnight(new Date());

  if (key === 'today') {
    const ymd = toYmd(today);
    return { from: ymd, to: ymd };
  }

  if (key === 'yesterday') {
    const yesterday = addDays(today, -1);
    const ymd = toYmd(yesterday);
    return { from: ymd, to: ymd };
  }

  if (key === 'last7') return { from: toYmd(addDays(today, -6)), to: toYmd(today) };
  if (key === 'last30') return { from: toYmd(addDays(today, -29)), to: toYmd(today) };
  if (key === 'last3m') return { from: toYmd(addDays(today, -89)), to: toYmd(today) };
  if (key === 'last6m') return { from: toYmd(addDays(today, -179)), to: toYmd(today) };

  return { from: toYmd(addDays(today, -364)), to: toYmd(today) };
};

export default function AdminDateRangePicker() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const fromParam = searchParams.get('from') ?? '';
  const toParam = searchParams.get('to') ?? '';

  const [isOpen, setIsOpen] = useState(false);
  const [draftFrom, setDraftFrom] = useState(fromParam);
  const [draftTo, setDraftTo] = useState(toParam);

  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setDraftFrom(fromParam);
    setDraftTo(toParam);
  }, [fromParam, toParam]);

  useEffect(() => {
    const onPointerDown = (event: MouseEvent) => {
      if (!containerRef.current) return;
      if (!containerRef.current.contains(event.target as Node)) setIsOpen(false);
    };

    const onEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsOpen(false);
    };

    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onEscape);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onEscape);
    };
  }, []);

  const label = useMemo(() => {
    if (!fromParam && !toParam) return 'Vsi datumi';
    if (fromParam && toParam) {
      return `${formatDisplayDate(fromParam)} – ${formatDisplayDate(toParam)}`;
    }
    if (fromParam) return `Od ${formatDisplayDate(fromParam)}`;
    return `Do ${formatDisplayDate(toParam)}`;
  }, [fromParam, toParam]);

  const pushRange = (fromValue: string, toValue: string) => {
    const nextParams = new URLSearchParams(searchParams.toString());

    if (fromValue) nextParams.set('from', fromValue);
    else nextParams.delete('from');

    if (toValue) nextParams.set('to', toValue);
    else nextParams.delete('to');

    const queryString = nextParams.toString();
    router.push(queryString ? `${pathname}?${queryString}` : pathname, { scroll: false });
  };

  const applyDraft = () => {
    pushRange(draftFrom, draftTo);
    setIsOpen(false);
  };

  const clearRange = () => {
    setDraftFrom('');
    setDraftTo('');
    pushRange('', '');
    setIsOpen(false);
  };

  const applyPreset = (key: PresetKey) => {
    const range = getPresetRange(key);
    setDraftFrom(range.from);
    setDraftTo(range.to);
    pushRange(range.from, range.to);
    setIsOpen(false);
  };

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setIsOpen((previousOpen) => !previousOpen)}
        className="flex h-8 w-full items-center justify-between gap-3 rounded-lg border border-slate-300 bg-white px-3 text-left text-sm text-slate-700 hover:border-slate-400"
        aria-haspopup="dialog"
        aria-expanded={isOpen}
      >
        <span className="truncate">{label}</span>
        <span className="text-slate-400">▾</span>
      </button>

      {isOpen && (
        <div className="absolute z-40 mt-2 w-[560px] rounded-xl border border-slate-200 bg-white p-4 shadow-xl">
          <div className="grid grid-cols-[180px_1fr] gap-4">
            <div className="space-y-1 border-r border-slate-200 pr-3">
              {PRESETS.map((preset) => (
                <button
                  key={preset.key}
                  type="button"
                  onClick={() => applyPreset(preset.key)}
                  className="block w-full rounded-md px-2 py-1.5 text-left text-sm text-slate-700 hover:bg-[#ede8ff]"
                >
                  {preset.label}
                </button>
              ))}

              <button
                type="button"
                onClick={clearRange}
                className="mt-2 block w-full rounded-md px-2 py-1.5 text-left text-sm font-semibold text-slate-600 hover:bg-[#ede8ff]"
              >
                Počisti datum
              </button>
            </div>

            <div>
              <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                Obdobje po meri
              </p>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase text-slate-500">Od</label>
                  <input
                    type="date"
                    value={draftFrom}
                    onChange={(event) => setDraftFrom(event.target.value)}
                    className="h-8 w-full rounded-lg border border-slate-300 px-3 text-sm focus:border-[#5d3ed6] focus:ring-0 focus:ring-[#5d3ed6]"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase text-slate-500">Do</label>
                  <input
                    type="date"
                    value={draftTo}
                    onChange={(event) => setDraftTo(event.target.value)}
                    className="h-8 w-full rounded-lg border border-slate-300 px-3 text-sm focus:border-[#5d3ed6] focus:ring-0 focus:ring-[#5d3ed6]"
                  />
                </div>
              </div>

              <div className="mt-4 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-[#ede8ff]"
                >
                  Prekliči
                </button>
                <button
                  type="button"
                  onClick={applyDraft}
                  className="rounded-lg bg-brand-600 px-3 py-2 text-sm font-semibold text-white hover:bg-brand-700"
                >
                  Uporabi
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
