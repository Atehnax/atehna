'use client';

import { useState } from 'react';
import { CompactHexColorField } from '@/shared/ui/admin-controls/CompactHexColorField';
import type { ProductOptionAxisDraft, Variant } from '@/admin/features/artikli/lib/familyModel';

export function optionSlug(value: string) {
  return value.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '').replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

function localId(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function uniqueSlug(label: string, used: string[]) {
  const base = optionSlug(label) || 'vrednost';
  let slug = base;
  let index = 2;
  while (used.includes(slug)) slug = `${base}-${index++}`;
  return slug;
}

/** Entering a row value reuses existing values and never changes other variants. */
export function applyVariantOptionValue(
  axes: ProductOptionAxisDraft[], variants: Variant[], axisId: string, variantId: string, input: string
): { axes: ProductOptionAxisDraft[]; variants: Variant[] } {
  const axis = axes.find((entry) => entry.id === axisId);
  if (!axis || !variants.some((variant) => variant.id === variantId)) return { axes, variants };
  const text = input.trim();
  const existing = axis.values.find((entry) => entry.value.toLocaleLowerCase('sl') === text.toLocaleLowerCase('sl'));
  const value = text ? existing ?? {
    id: localId('value'), value: text,
    slug: uniqueSlug(text, axis.values.map((entry) => entry.slug)),
    swatch: null, position: axis.values.length
  } : null;
  return {
    axes: value && !existing ? axes.map((entry) => entry.id === axisId ? { ...entry, values: [...entry.values, value] } : entry) : axes,
    variants: variants.map((variant) => {
      if (variant.id !== variantId) return variant;
      const optionSelections = { ...variant.optionSelections };
      if (value) optionSelections[axisId] = value.id;
      else delete optionSelections[axisId];
      return { ...variant, optionSelections };
    })
  };
}

const fieldClass = 'h-[30px] min-w-0 w-full rounded-md border border-slate-300 bg-white px-2 text-xs text-slate-900 outline-none focus:border-[color:var(--blue-500)] disabled:bg-slate-50 disabled:text-slate-500';
const buttonClass = 'inline-flex h-[30px] shrink-0 items-center justify-center rounded-md border border-slate-300 bg-white px-2 text-[11px] font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50';

type ToolbarProps = {
  editable: boolean;
  axes: ProductOptionAxisDraft[];
  onAxesChange: (axes: ProductOptionAxisDraft[]) => void;
};

/** Compact table toolbar; attribute values are edited in the variant rows. */
export default function ProductVariantOptionsCard({ editable, axes, onAxesChange }: ToolbarProps) {
  const [name, setName] = useState('');
  const [editing, setEditing] = useState(false);
  const add = () => {
    const label = name.trim();
    if (!label || axes.some((axis) => axis.name.toLocaleLowerCase('sl') === label.toLocaleLowerCase('sl'))) return;
    onAxesChange([...axes, { id: localId('axis'), name: label, slug: uniqueSlug(label, axes.map((axis) => axis.slug)), position: axes.length, values: [] }]);
    setName('');
  };
  return (
    <div className="flex min-w-0 flex-wrap items-center gap-2" aria-label="Lastnosti različic">
      {editable ? <>
        <input className={`${fieldClass} !w-36`} aria-label="Nova lastnost različic" value={name} placeholder="npr. Barva, Izvedba" onChange={(event) => setName(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); add(); } }} />
        <button type="button" className={buttonClass} disabled={!name.trim()} onClick={add}>Dodaj lastnost</button>
        {axes.length > 0 ? <button type="button" className={buttonClass} aria-expanded={editing} onClick={() => setEditing((current) => !current)}>Uredi lastnosti</button> : null}
      </> : null}
      {editing && editable ? (
        <div className="flex w-full flex-wrap gap-2">
          {axes.map((axis) => <div key={axis.id} className="space-y-2 rounded-md border border-slate-200 p-2"><div className="flex items-center gap-1">
            <input className={`${fieldClass} !w-36`} aria-label={`Naziv lastnosti ${axis.name}`} value={axis.name} onChange={(event) => onAxesChange(axes.map((entry) => entry.id === axis.id ? { ...entry, name: event.target.value } : entry))} />
            <button type="button" className={`${buttonClass} text-rose-700`} aria-label={`Odstrani lastnost ${axis.name}`} onClick={() => onAxesChange(axes.filter((entry) => entry.id !== axis.id).map((entry, position) => ({ ...entry, position })))}>×</button>
          </div>
          {axis.values.length > 0 ? <details>
            <summary className="cursor-pointer text-[11px] text-slate-600">Barvni vzorci (neobvezno)</summary>
            <div className="mt-2 space-y-2">{axis.values.map((value) => <CompactHexColorField
              key={value.id} label={value.value} value={value.swatch ?? ''}
              marker={`product-option-${axis.id}-${value.id}`} tone="light" allowClear clearLabel="Brez" inheritedColor="#000000"
              disabled={!editable}
              onChange={(swatch) => onAxesChange(axes.map((entry) => entry.id === axis.id ? { ...entry, values: entry.values.map((option) => option.id === value.id ? { ...option, swatch: swatch || null } : option) } : entry))}
              inputAttributes={{ 'aria-label': `Barvni vzorec za ${value.value}` }}
            />)}</div>
          </details> : null}
          </div>)}
        </div>
      ) : null}
    </div>
  );
}

type ValueProps = {
  editable: boolean;
  axis: ProductOptionAxisDraft;
  variant: Variant;
  onCommit: (value: string) => void;
};

export function VariantOptionValueField({ editable, axis, variant, onCommit }: ValueProps) {
  const selected = axis.values.find((value) => value.id === variant.optionSelections?.[axis.id]);
  const [value, setValue] = useState(selected?.value ?? '');
  const listId = `variant-options-${variant.id}-${axis.id}`;
  return <>
    <input
      className={fieldClass}
      aria-label={`${axis.name} za ${variant.label || variant.sku || 'različico'}`}
      disabled={!editable}
      value={value}
      placeholder="Vnesite vrednost"
      list={listId}
      onChange={(event) => setValue(event.target.value)}
      onBlur={() => onCommit(value)}
      onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); event.currentTarget.blur(); } }}
    />
    <datalist id={listId}>{axis.values.map((entry) => <option key={entry.id} value={entry.value} />)}</datalist>
  </>;
}
