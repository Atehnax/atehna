'use client';

import type {
  ProductOptionAxisDraft,
  ProductOptionValueDraft,
  Variant
} from '@/admin/features/artikli/lib/familyModel';

type Props = {
  editable: boolean;
  axes: ProductOptionAxisDraft[];
  variants: Variant[];
  onAxesChange: (axes: ProductOptionAxisDraft[]) => void;
  onVariantChange: (variantId: string, updates: Partial<Variant>) => void;
};

function createLocalId(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

const inputClass =
  'h-9 w-full rounded-md border border-slate-300 bg-white px-2.5 text-xs text-slate-900 outline-none transition focus:border-[color:var(--blue-500)] disabled:bg-slate-50 disabled:text-slate-500';
const smallButtonClass =
  'inline-flex h-8 items-center justify-center rounded-md border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 focus-visible:border-[color:var(--blue-500)] focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50';

export default function ProductVariantOptionsCard({
  editable,
  axes,
  variants,
  onAxesChange,
  onVariantChange
}: Props) {
  const updateAxis = (axisId: string, updates: Partial<ProductOptionAxisDraft>) => {
    onAxesChange(axes.map((axis) => (axis.id === axisId ? { ...axis, ...updates } : axis)));
  };

  const addAxis = () => {
    const axisId = createLocalId('axis');
    onAxesChange([
      ...axes,
      {
        id: axisId,
        name: '',
        slug: '',
        position: axes.length,
        values: []
      }
    ]);
  };

  const removeAxis = (axisId: string) => {
    onAxesChange(
      axes
        .filter((axis) => axis.id !== axisId)
        .map((axis, index) => ({ ...axis, position: index }))
    );
  };

  const addValue = (axis: ProductOptionAxisDraft) => {
    const nextValue: ProductOptionValueDraft = {
      id: createLocalId('value'),
      value: '',
      slug: '',
      swatch: null,
      position: axis.values.length
    };
    updateAxis(axis.id, { values: [...axis.values, nextValue] });
  };

  const updateValue = (
    axis: ProductOptionAxisDraft,
    valueId: string,
    updates: Partial<ProductOptionValueDraft>
  ) => {
    updateAxis(axis.id, {
      values: axis.values.map((value) => (value.id === valueId ? { ...value, ...updates } : value))
    });
  };

  const removeValue = (axis: ProductOptionAxisDraft, valueId: string) => {
    updateAxis(axis.id, {
      values: axis.values
        .filter((value) => value.id !== valueId)
        .map((value, index) => ({ ...value, position: index }))
    });
  };

  return (
    <section
      className="mb-4 overflow-hidden rounded-lg border border-slate-200 bg-slate-50/40"
      aria-labelledby="variant-options-title"
    >
      <div className="flex flex-wrap items-start justify-between gap-3 px-4 py-3">
        <div>
          <h3 id="variant-options-title" className="text-xs font-semibold text-slate-900">
            Izbirne lastnosti
          </h3>
          <p className="mt-1 text-[11px] leading-4 text-slate-500">
            Neobvezne osi, kot sta barva ali napetost. Vrednosti različicam dodelite v razdelku pod definicijami.
          </p>
        </div>
        <button type="button" className={smallButtonClass} disabled={!editable} onClick={addAxis}>
          Dodaj lastnost
        </button>
      </div>

      {axes.length > 0 ? (
        <div className="space-y-3 border-t border-slate-200 p-4">
          {axes.map((axis, axisIndex) => (
            <div key={axis.id} className="rounded-lg border border-slate-200 bg-white p-4">
              <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
                <label>
                  <span className="mb-1 block text-[11px] font-semibold text-slate-600">Naziv lastnosti</span>
                  <input
                    className={inputClass}
                    value={axis.name}
                    disabled={!editable}
                    placeholder="npr. Barva"
                    onChange={(event) => {
                      const name = event.target.value;
                      const previousAutoSlug = slugify(axis.name);
                      updateAxis(axis.id, {
                        name,
                        slug: !axis.slug || axis.slug === previousAutoSlug ? slugify(name) : axis.slug
                      });
                    }}
                  />
                </label>
                <label>
                  <span className="mb-1 block text-[11px] font-semibold text-slate-600">Ključ (slug)</span>
                  <input
                    className={inputClass}
                    value={axis.slug}
                    disabled={!editable}
                    placeholder="barva"
                    onChange={(event) => updateAxis(axis.id, { slug: slugify(event.target.value) })}
                  />
                </label>
                <button
                  type="button"
                  className={`${smallButtonClass} self-end border-rose-200 text-rose-700 hover:bg-rose-50`}
                  disabled={!editable}
                  onClick={() => removeAxis(axis.id)}
                >
                  Odstrani
                </button>
              </div>

              <div className="mt-3 overflow-x-auto">
                <table className="min-w-full text-xs">
                  <thead>
                    <tr className="text-left text-[11px] font-semibold text-slate-500">
                      <th className="pb-1.5 pr-2">Vrednost</th>
                      <th className="pb-1.5 pr-2">Ključ</th>
                      <th className="pb-1.5 pr-2">Barvni vzorec (neobvezno)</th>
                      <th className="w-20 pb-1.5 text-right">Dejanje</th>
                    </tr>
                  </thead>
                  <tbody>
                    {axis.values.map((value) => (
                      <tr key={value.id}>
                        <td className="py-1 pr-2">
                          <input
                            className={inputClass}
                            value={value.value}
                            disabled={!editable}
                            placeholder="npr. Modra"
                            onChange={(event) => {
                              const nextValue = event.target.value;
                              const previousAutoSlug = slugify(value.value);
                              updateValue(axis, value.id, {
                                value: nextValue,
                                slug: !value.slug || value.slug === previousAutoSlug
                                  ? slugify(nextValue)
                                  : value.slug
                              });
                            }}
                          />
                        </td>
                        <td className="py-1 pr-2">
                          <input
                            className={inputClass}
                            value={value.slug}
                            disabled={!editable}
                            placeholder="modra"
                            onChange={(event) => updateValue(axis, value.id, { slug: slugify(event.target.value) })}
                          />
                        </td>
                        <td className="py-1 pr-2">
                          <div className="flex items-center gap-2">
                            <input
                              type="color"
                              className="h-9 w-11 rounded-md border border-slate-300 bg-white p-1 disabled:opacity-50"
                              value={/^#[0-9a-f]{6}$/i.test(value.swatch ?? '') ? value.swatch ?? '#000000' : '#000000'}
                              disabled={!editable}
                              onChange={(event) => updateValue(axis, value.id, { swatch: event.target.value })}
                              aria-label={`Barvni vzorec za ${value.value || `vrednost ${axisIndex + 1}`}`}
                            />
                            <input
                              className={inputClass}
                              value={value.swatch ?? ''}
                              disabled={!editable}
                              placeholder="#1f6feb ali prazno"
                              onChange={(event) => updateValue(axis, value.id, { swatch: event.target.value || null })}
                            />
                          </div>
                        </td>
                        <td className="py-1 text-right">
                          <button
                            type="button"
                            className="text-xs font-semibold text-rose-700 hover:underline disabled:opacity-50"
                            disabled={!editable}
                            onClick={() => removeValue(axis, value.id)}
                          >
                            Izbriši
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <button
                type="button"
                className={`${smallButtonClass} mt-2`}
                disabled={!editable}
                onClick={() => addValue(axis)}
              >
                Dodaj vrednost
              </button>
            </div>
          ))}
          {variants.length > 0 ? (
            <details className="rounded-lg border border-slate-200 bg-white">
              <summary className="cursor-pointer select-none px-4 py-3 text-xs font-semibold text-slate-900">
                Dodelitve različicam
                <span className="ml-2 font-normal text-slate-500">
                  ({variants.length} {variants.length === 1 ? 'različica' : 'različic'})
                </span>
              </summary>
              <div className="space-y-2 border-t border-slate-200 p-3">
                {variants.map((variant, variantIndex) => (
                  <div
                    key={variant.id}
                    className="grid gap-2 rounded-md border border-slate-200 bg-slate-50/50 p-2 lg:grid-cols-[minmax(180px,0.7fr)_minmax(0,2fr)]"
                  >
                    <div className="min-w-0 self-center">
                      <div
                        className="truncate text-[11px] font-semibold text-slate-800"
                        title={variant.label || variant.sku || `Različica ${variantIndex + 1}`}
                      >
                        {variant.label || variant.sku || `Različica ${variantIndex + 1}`}
                      </div>
                      {variant.sku && variant.sku !== variant.label ? (
                        <div className="truncate text-[10px] text-slate-500" title={variant.sku}>
                          {variant.sku}
                        </div>
                      ) : null}
                    </div>
                    <div className="grid min-w-0 gap-2 sm:grid-cols-2 xl:grid-cols-3">
                      {axes.map((axis) => (
                        <label key={axis.id} className="min-w-0">
                          <span className="mb-1 block truncate text-[10px] font-semibold text-slate-500" title={axis.name || 'Izbirna lastnost'}>
                            {axis.name || 'Izbirna lastnost'}
                          </span>
                          <select
                            className={inputClass}
                            value={variant.optionSelections?.[axis.id] ?? ''}
                            disabled={!editable}
                            aria-label={`${axis.name || 'Izbirna lastnost'} za ${variant.label || variant.sku || `različico ${variantIndex + 1}`}`}
                            onChange={(event) => {
                              const optionSelections = { ...(variant.optionSelections ?? {}) };
                              if (event.target.value) optionSelections[axis.id] = event.target.value;
                              else delete optionSelections[axis.id];
                              onVariantChange(variant.id, { optionSelections });
                            }}
                          >
                            <option value="">Ni izbrano</option>
                            {axis.values.map((value) => (
                              <option key={value.id} value={value.id}>
                                {value.value || value.slug || 'Neimenovana vrednost'}
                              </option>
                            ))}
                          </select>
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </details>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
