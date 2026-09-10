'use client';

import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import type { CatalogBulkActivationResult } from '@/shared/domain/catalog/catalogActivation';

type Props = {
  result: CatalogBulkActivationResult;
  onDismiss: () => void;
  onOpenItem: (identifier: string) => void;
};

export default function CatalogActivationResultNotice({ result, onDismiss, onOpenItem }: Props) {
  const noticeRef = useRef<HTMLElement>(null);
  useEffect(() => {
    noticeRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [result]);

  return (
    <section ref={noticeRef} role="status" aria-label="Ni bilo aktivirano" className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-[13px] text-amber-950">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="font-semibold">Ni bilo aktivirano</h2>
          <p className="mt-1">Aktivirani artikli: {result.activatedItemCount}. Aktivirane različice: {result.activatedVariantCount}.</p>
          <p className="mt-1">Spodnji artikli oziroma različice niso bili aktivirani. Dopolnite navedene podatke in poskusite znova.</p>
        </div>
        <button type="button" aria-label="Zapri obvestilo o aktivaciji" onClick={onDismiss} className="shrink-0 rounded-md p-1 text-amber-800 hover:bg-amber-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-700">
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
      <ul className="mt-3 max-h-96 space-y-3 overflow-y-auto overscroll-contain pr-2">
        {result.skipped.map(target => (
          <li key={target.itemId + ':' + (target.variantId ?? 'item')}>
            <a href={'/admin/artikli/' + encodeURIComponent(target.itemIdentifier)} onClick={event => { event.preventDefault(); onOpenItem(target.itemIdentifier); }} className="font-semibold underline underline-offset-2 hover:text-amber-700">{target.itemName}</a>
            {target.variantName ? <span> · {target.variantName}</span> : null}
            {target.variantSku || target.itemSku ? <span className="ml-2 text-[12px] text-amber-800">({target.variantSku || target.itemSku})</span> : null}
            <p className="mt-0.5">{target.reasons.join(' ')}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
