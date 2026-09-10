'use client';

import { useState } from 'react';
import { ConfirmDialog } from '@/shared/ui/confirm-dialog';
import type { CatalogActivationMode } from '@/shared/domain/catalog/catalogActivation';

type Props = {
  open: boolean;
  itemCount: number;
  selectedVariantCount?: number;
  busy?: boolean;
  onCancel: () => void;
  onConfirm: (mode: CatalogActivationMode) => void;
};

export default function CatalogActivationDialog({ open, itemCount, selectedVariantCount = 0, busy = false, onCancel, onConfirm }: Props) {
  const [mode, setMode] = useState<CatalogActivationMode>('all');
  return (
    <ConfirmDialog open={open} title="Aktivacija artiklov" description={
      'Izbrani glavni artikli: ' + itemCount + '. Izberite, katere njihove različice želite aktivirati.'
    } confirmLabel={busy ? 'Aktiviranje …' : 'Aktiviraj'} confirmDisabled={busy} onCancel={() => { if (!busy) onCancel(); }} onConfirm={() => onConfirm(mode)} panelClassName="max-w-lg">
      <fieldset className="mt-4 space-y-2" disabled={busy}>
        <legend className="sr-only">Način aktivacije različic</legend>
        <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-slate-200 p-3 text-[13px]">
          <input type="radio" name="catalog-activation-mode" value="all" checked={mode === 'all'} onChange={() => setMode('all')} className="mt-0.5 accent-[color:var(--blue-500)]" />
          <span><span className="block font-semibold">Glavni artikli in vse različice</span><span className="mt-1 block text-slate-600">Aktivirajo se vse različice izbranih artiklov.</span></span>
        </label>
        <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-slate-200 p-3 text-[13px]">
          <input type="radio" name="catalog-activation-mode" value="first" checked={mode === 'first'} onChange={() => setMode('first')} className="mt-0.5 accent-[color:var(--blue-500)]" />
          <span><span className="block font-semibold">Glavni artikli in prve različice</span><span className="mt-1 block text-slate-600">Pri vsakem artiklu se aktivira prva različica v trenutnem vrstnem redu. Že aktivne različice ostanejo aktivne.</span></span>
        </label>
      </fieldset>
      {selectedVariantCount > 0 ? <p className="mt-3 text-[12px] text-slate-600">Posebej izbrane različice se aktivirajo pri obeh možnostih ({selectedVariantCount}).</p> : null}
    </ConfirmDialog>
  );
}
