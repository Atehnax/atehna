'use client';

import { X } from 'lucide-react';
import { useRef } from 'react';
import { normalizeCatalogSpecificationToken } from '@/shared/domain/catalog/catalogSpecification';
import {
  adminControlFocusTokenClasses,
  adminInputFocusTokenClasses
} from '@/shared/ui/theme/tokens';

type VariantSpecificationsEditorProps = {
  specifications: Record<string, string>;
  onChange: (specifications: Record<string, string>) => void;
  onLabelChange?: (previousLabel: string, nextLabel: string) => void;
  disabled?: boolean;
  surface?: 'article-editor' | 'appearance-editor';
  reservedLabels?: readonly string[];
};

export const CANONICAL_VARIANT_SPECIFICATION_LABELS = [
  'Material',
  'Barva',
  'Oblika',
  'Dimenzije',
  'Debelina',
  'Dolžina',
  'Širina',
  'Teža',
  'Toleranca',
  'SKU'
] as const;

const inputClassName =
  `h-8 min-w-0 w-full rounded-lg border border-slate-200 bg-white px-2.5 text-[11px] text-slate-800 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400 ${adminInputFocusTokenClasses}`;

function nextSpecificationLabel(
  specifications: Record<string, string>,
  reservedLabels: readonly string[]
) {
  const usedTokens = new Set(
    [...Object.keys(specifications), ...reservedLabels]
      .map(normalizeCatalogSpecificationToken)
      .filter(Boolean)
  );
  let label = 'Nova lastnost';
  let suffix = 2;
  while (usedTokens.has(normalizeCatalogSpecificationToken(label))) {
    label = `Nova lastnost ${suffix++}`;
  }
  return label;
}

export default function VariantSpecificationsEditor({
  specifications,
  onChange,
  onLabelChange,
  disabled = false,
  surface = 'article-editor',
  reservedLabels = []
}: VariantSpecificationsEditorProps) {
  const entries = Object.entries(specifications);
  const labelAtFocusRef = useRef<Record<number, string>>({});
  const protectedLabels = [
    ...CANONICAL_VARIANT_SPECIFICATION_LABELS,
    ...reservedLabels
  ];

  const updateLabel = (index: number, nextLabel: string) => {
    const currentEntry = entries[index];
    if (!currentEntry) return;
    const normalizedNextLabel = normalizeCatalogSpecificationToken(nextLabel);
    const currentLabelToken = normalizeCatalogSpecificationToken(currentEntry[0]);
    const duplicate = normalizedNextLabel.length > 0 && (
      entries.some(
        ([candidate], candidateIndex) => (
          candidateIndex !== index
          && normalizeCatalogSpecificationToken(candidate) === normalizedNextLabel
        )
      )
      || (
        normalizedNextLabel !== currentLabelToken
        && protectedLabels.some(
          (reservedLabel) => (
            normalizeCatalogSpecificationToken(reservedLabel) === normalizedNextLabel
          )
        )
      )
    );
    if (duplicate) return;
    const nextEntries = [...entries];
    nextEntries[index] = [nextLabel, currentEntry[1]];
    onChange(Object.fromEntries(nextEntries));
  };

  const updateValue = (index: number, nextValue: string) => {
    const currentEntry = entries[index];
    if (!currentEntry) return;
    const nextEntries = [...entries];
    nextEntries[index] = [currentEntry[0], nextValue];
    onChange(Object.fromEntries(nextEntries));
  };

  const remove = (index: number) => {
    onChange(Object.fromEntries(entries.filter((_, entryIndex) => entryIndex !== index)));
  };

  return (
    <div
      data-testid="variant-specifications-editor"
      data-variant-specifications-surface={surface}
      className="grid gap-2"
    >
      {entries.length > 0 ? entries.map(([label, value], index) => (
        <div
          key={`variant-specification-${index}`}
          data-testid="variant-specification-row"
          className="grid grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)_30px] gap-2"
        >
          <input
            value={label}
            disabled={disabled}
            aria-label={`Naziv specifikacije ${index + 1}`}
            onFocus={() => {
              labelAtFocusRef.current[index] = label;
            }}
            onChange={(event) => updateLabel(index, event.target.value)}
            onBlur={() => {
              const previousLabel = labelAtFocusRef.current[index] ?? label;
              delete labelAtFocusRef.current[index];
              if (!label.trim()) {
                updateLabel(index, previousLabel);
                return;
              }
              if (previousLabel !== label) {
                onLabelChange?.(previousLabel, label);
              }
            }}
            className={inputClassName}
            placeholder="Lastnost"
            maxLength={100}
          />
          <input
            value={value}
            disabled={disabled}
            aria-label={`Vrednost specifikacije ${index + 1}`}
            onChange={(event) => updateValue(index, event.target.value)}
            className={inputClassName}
            placeholder="Vrednost"
            maxLength={500}
          />
          <button
            type="button"
            disabled={disabled}
            aria-label={`Odstrani specifikacijo ${index + 1}`}
            onClick={() => remove(index)}
            className={`grid h-8 w-8 place-items-center rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-40 ${adminControlFocusTokenClasses}`}
          >
            <X aria-hidden="true" className="h-3.5 w-3.5" />
          </button>
        </div>
      )) : (
        <p className="rounded-lg border border-dashed border-slate-200 px-3 py-2 text-center text-[10px] leading-4 text-slate-500">
          Ta različica nima dodatnih specifikacij.
        </p>
      )}
      <button
        type="button"
        disabled={disabled}
        onClick={() => {
          const label = nextSpecificationLabel(specifications, protectedLabels);
          onChange({ ...specifications, [label]: '' });
        }}
        className={`h-8 rounded-lg border border-dashed border-slate-300 text-[10px] font-semibold text-slate-600 hover:border-[color:var(--blue-300)] hover:text-[color:var(--blue-700)] disabled:cursor-not-allowed disabled:opacity-40 ${adminControlFocusTokenClasses}`}
      >
        Dodaj specifikacijo
      </button>
    </div>
  );
}
