'use client';

import type { CatalogItemEditorHydration } from '@/shared/domain/catalog/catalogAdminTypes';
import type { ProductAppearanceConfig } from '@/shared/domain/style/productAppearance';
import { adminControlFocusTokenClasses, adminInputFocusTokenClasses } from '@/shared/ui/theme/tokens';
import { AppearanceEditorCompactSelect } from './AppearanceEditorToolbarPrimitives';

export default function ProductMinimumOrderSettings({
  product, selectedVariantId, purchaseArea, onVariantChange, onChange
}: {
  product: CatalogItemEditorHydration;
  selectedVariantId: number | null;
  purchaseArea: ProductAppearanceConfig['purchaseArea'];
  onVariantChange: (id: number | null) => void;
  onChange: (updates: Partial<ProductAppearanceConfig['purchaseArea']>) => void;
}) {
  const variant = product.variants.find(entry => entry.id === selectedVariantId)
    ?? product.variants.find(entry => entry.id === product.defaultVariantId)
    ?? product.variants[0];
  const minimum = variant?.minOrder ?? 1;
  const fieldClassName = 'h-8 min-w-0 rounded-md border border-slate-300 bg-white px-2 text-[11px] text-slate-700 ' + adminInputFocusTokenClasses;
  return (
    <section aria-label="Minimalno naročilo" className="rounded-xl border border-slate-200 bg-white p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-xs font-semibold text-slate-800">Minimalno naročilo</h2>
        <label className="inline-flex items-center gap-2 text-[11px] text-slate-600">
          <input type="checkbox" checked={purchaseArea.showMinimumOrder}
            onChange={event => onChange({ showMinimumOrder: event.target.checked })}
            className={adminControlFocusTokenClasses} />
          Prikaži obvestilo na strani artikla
        </label>
      </div>
      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        <label className="grid gap-1 text-[10px] text-slate-500">
          Različica v predogledu
          <AppearanceEditorCompactSelect
            ariaLabel="Različica v predogledu"
            value={variant?.id != null ? String(variant.id) : ''}
            options={product.variants.map((entry, index) => ({
              value: entry.id != null ? String(entry.id) : '',
              label: (entry.variantName || entry.variantSku || ('Različica ' + (index + 1)))
                + (entry.status === 'inactive' ? ' · neaktivna' : '')
            }))}
            onValueChange={value => onVariantChange(value ? Number(value) : null)}
          />
        </label>
        <div className="grid content-start gap-1 text-[10px] text-slate-500">
          <span>Najmanjša količina iz Artikli</span>
          <p className="flex min-h-8 items-center gap-3 text-[11px] text-slate-700">
            <span data-testid="product-preview-minimum-order">{minimum} {variant?.unit || product.unit || 'kos'}</span>
            <a href={'/admin/artikli/' + encodeURIComponent(product.slug) + '#product-measurements'}
              target="_blank" rel="noopener noreferrer" className="text-[color:var(--blue-600)] hover:underline">
              Uredi količino
            </a>
          </p>
        </div>
        <label className="grid gap-1 text-[10px] text-slate-500">
          Besedilo obvestila · vsi artikli
          <input aria-label="Besedilo minimalnega naročila" value={purchaseArea.copy.minimumOrderLabel}
            maxLength={120} onChange={event => onChange({ copy: { ...purchaseArea.copy, minimumOrderLabel: event.target.value } })}
            className={fieldClassName} />
        </label>
      </div>
      <p className="mt-2 text-[10px] leading-4 text-slate-500">
        {minimum > 1
          ? 'Predogled uporablja najmanjšo količino izbrane različice.'
          : 'Pri najmanjši količini 1 se obvestilo kupcu ne prikaže.'}
        {' '}Skrita oznaka ne spremeni najmanjše količine v košarici ali naročilu.
      </p>
    </section>
  );
}
