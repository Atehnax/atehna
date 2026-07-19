'use client';

import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { ImagePlus, RotateCcw, Trash2, X } from 'lucide-react';
import {
  DEFAULT_CATEGORY_SHOWCASE_MEDIA_SETTINGS,
  normalizeCategoryShowcaseMediaSettings,
  type CategoryShowcaseItem,
  type CategoryShowcaseMediaSettings
} from './categoryShowcaseSchema';

const classNames = (...values: Array<string | false | null | undefined>) => values.filter(Boolean).join(' ');

export type CategoryShowcaseEditorCapabilities = {
  media: boolean;
  crop: boolean;
  focalPoint: boolean;
  scale: boolean;
  offsets: boolean;
  fit: boolean;
  background: boolean;
  categoryTitleTypography?: boolean;
  categoryTitlePosition?: boolean;
  groupTitlePosition?: boolean;
};

export const CATEGORY_SHOWCASE_BASE_CAPABILITIES: CategoryShowcaseEditorCapabilities = {
  media: true,
  crop: true,
  focalPoint: true,
  scale: true,
  offsets: true,
  fit: true,
  background: true
};

export const CATEGORY_SHOWCASE_HOMEPAGE_CAPABILITIES: CategoryShowcaseEditorCapabilities = {
  ...CATEGORY_SHOWCASE_BASE_CAPABILITIES,
  categoryTitleTypography: true,
  categoryTitlePosition: true,
  groupTitlePosition: true
};

type NumberControlProps = {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  suffix?: string;
  resetValue?: number;
  onChange: (value: number) => void;
};

function NumberControl({ label, value, min, max, step = 1, suffix, resetValue, onChange }: NumberControlProps) {
  const inputId = useId();
  const spokenLabel = `${label.slice(0, 1).toLocaleLowerCase('sl')}${label.slice(1)}`;
  const resetLabel = resetValue === undefined ? '' : `Nastavi ${spokenLabel} na ${resetValue}`;
  const isResetValue = resetValue !== undefined && Math.abs(value - resetValue) < Number.EPSILON;

  return (
    <div className="grid grid-cols-[minmax(78px,1fr)_minmax(0,1.35fr)] items-center gap-3">
      <label htmlFor={inputId} className="text-[11px] font-medium text-slate-500">{label}</label>
      <span className="flex h-8 min-w-0 overflow-hidden rounded-lg border border-slate-200 bg-slate-50/70 focus-within:border-[color:var(--blue-500)] focus-within:bg-white">
        <input
          id={inputId}
          type="number"
          aria-label={`${label}${suffix ? ` ${suffix}` : ''}`}
          value={Number(value.toFixed(step < 1 ? 2 : 0))}
          min={min}
          max={max}
          step={step}
          className="h-full min-w-0 flex-1 bg-transparent px-2.5 text-right text-[12px] text-slate-800 outline-none"
          onChange={(event) => onChange(Math.min(max, Math.max(min, Number(event.target.value) || 0)))}
        />
        {resetValue !== undefined ? (
          <button
            type="button"
            aria-label={resetLabel}
            title={resetLabel}
            disabled={isResetValue}
            className="grid min-w-8 place-items-center border-l border-slate-200 bg-white px-2 text-[11px] font-semibold text-slate-600 transition-colors hover:bg-slate-100 disabled:cursor-default disabled:bg-transparent disabled:text-slate-300"
            onClick={() => onChange(resetValue)}
          >
            {resetValue}
          </button>
        ) : null}
        {suffix ? <span className="grid min-w-8 place-items-center border-l border-slate-200 px-2 text-[11px] text-slate-400">{suffix}</span> : null}
      </span>
    </div>
  );
}

function HexColorControl({
  value,
  onChange
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const [draft, setDraft] = useState(value);

  useEffect(() => {
    setDraft(value);
  }, [value]);

  const commit = (nextValue: string) => {
    const normalized = nextValue.trim().toUpperCase();
    if (/^#[0-9A-F]{6}$/.test(normalized)) onChange(normalized);
  };

  return (
    <span className="flex h-8 overflow-hidden rounded-lg border border-slate-300 bg-white focus-within:border-[color:var(--blue-500)]">
      <input
        type="color"
        aria-label="Izberi barvo ozadja"
        value={value}
        className="h-full w-9 cursor-pointer border-0 bg-transparent p-1"
        onChange={(event) => {
          setDraft(event.target.value.toUpperCase());
          onChange(event.target.value);
        }}
      />
      <input
        type="text"
        aria-label="Barva ozadja HEX"
        value={draft}
        maxLength={7}
        className="min-w-0 flex-1 bg-transparent px-2 text-[12px] uppercase text-slate-700 outline-none"
        onChange={(event) => {
          const nextValue = event.target.value;
          setDraft(nextValue);
          commit(nextValue);
        }}
        onBlur={() => {
          commit(draft);
          setDraft(/^#[0-9A-F]{6}$/i.test(draft.trim()) ? draft.trim().toUpperCase() : value);
        }}
      />
    </span>
  );
}

export function CategoryMediaControls({
  item,
  capabilities = CATEGORY_SHOWCASE_BASE_CAPABILITIES,
  onChange,
  onImageChange,
  onImageRemove,
  onReset,
  onClose,
  className
}: {
  item: CategoryShowcaseItem;
  capabilities?: CategoryShowcaseEditorCapabilities;
  onChange: (updates: Partial<CategoryShowcaseMediaSettings>) => void;
  onImageChange?: (file: File) => void;
  onImageRemove?: () => void;
  onReset?: () => void;
  onClose?: () => void;
  className?: string;
}) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const settings = normalizeCategoryShowcaseMediaSettings(item.presentation);
  const updateCrop = (updates: Partial<CategoryShowcaseMediaSettings['crop']>) => onChange({
    crop: { ...settings.crop, ...updates }
  });
  const updateFocal = (updates: Partial<CategoryShowcaseMediaSettings['focalPoint']>) => onChange({
    focalPoint: { ...settings.focalPoint, ...updates }
  });

  return (
    <div
      className={classNames('w-[300px] max-w-full space-y-3 rounded-2xl border border-slate-200/80 bg-white/95 p-3 shadow-[0_16px_40px_rgba(15,23,42,0.12)] backdrop-blur-xl', className)}
      data-category-media-controls={item.slug}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-[12px] font-semibold text-slate-900">{item.title}</p>
          <p className="text-[10px] text-slate-500">Predstavitev slike</p>
        </div>
        <div className="flex items-center gap-1">
          {capabilities.media && onImageChange ? (
            <>
              <button type="button" className="grid h-8 w-8 place-items-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50" aria-label={`Dodaj ali zamenjaj sliko za ${item.title}`} onClick={() => fileInputRef.current?.click()}>
                <ImagePlus className="h-4 w-4" />
              </button>
              <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={(event) => {
                const file = event.target.files?.[0];
                event.target.value = '';
                if (file) onImageChange(file);
              }} />
            </>
          ) : null}
          {capabilities.media && item.image && onImageRemove ? (
            <button type="button" className="grid h-8 w-8 place-items-center rounded-lg border border-rose-200 text-rose-600 hover:bg-rose-50" aria-label={`Odstrani sliko za ${item.title}`} onClick={onImageRemove}>
              <Trash2 className="h-4 w-4" />
            </button>
          ) : null}
          {onReset ? (
            <button type="button" className="grid h-8 w-8 place-items-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50" aria-label={`Ponastavi predstavitev za ${item.title}`} onClick={onReset}>
              <RotateCcw className="h-4 w-4" />
            </button>
          ) : null}
          {onClose ? (
            <button type="button" className="grid h-8 w-8 place-items-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50" aria-label={`Zapri nastavitve za ${item.title}`} onClick={onClose}>
              <X className="h-4 w-4" />
            </button>
          ) : null}
        </div>
      </div>

      {capabilities.scale ? <NumberControl label="Povečava" value={settings.scale} min={0.5} max={3} step={0.05} suffix="×" onChange={(scale) => onChange({ scale })} /> : null}
      {capabilities.offsets ? (
        <div className="grid gap-2">
          <NumberControl label="Odmik X" value={settings.offsetX} min={-100} max={100} suffix="%" resetValue={0} onChange={(offsetX) => onChange({ offsetX })} />
          <NumberControl label="Odmik Y" value={settings.offsetY} min={-100} max={100} suffix="%" resetValue={0} onChange={(offsetY) => onChange({ offsetY })} />
        </div>
      ) : null}

      {capabilities.fit ? (
        <div className="grid grid-cols-[minmax(78px,1fr)_minmax(0,1.35fr)] items-center gap-3">
          <span className="text-[11px] font-medium text-slate-500">Prileganje</span>
          <div className="grid grid-cols-3 rounded-lg bg-slate-100 p-0.5" role="group" aria-label="Prileganje slike">
            {(['contain', 'cover', 'fill'] as const).map((fit) => (
              <button key={fit} type="button" aria-pressed={settings.fit === fit} className={classNames('h-7 rounded-md px-1 text-[10px] font-semibold transition', settings.fit === fit ? 'bg-white text-[color:var(--blue-600)] shadow-sm' : 'text-slate-500 hover:text-slate-800')} onClick={() => onChange({ fit })}>
                {fit === 'contain' ? 'Vsebuj' : fit === 'cover' ? 'Zapolni' : 'Raztegni'}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {capabilities.focalPoint ? (
        <details className="group rounded-xl bg-slate-50/80 px-2.5 py-2">
          <summary className="cursor-pointer list-none text-[11px] font-semibold text-slate-700">Fokusna točka</summary>
          <div className="mt-2 grid gap-2">
            <NumberControl label="Fokus X" value={settings.focalPoint.x * 100} min={0} max={100} suffix="%" onChange={(x) => updateFocal({ x: x / 100 })} />
            <NumberControl label="Fokus Y" value={settings.focalPoint.y * 100} min={0} max={100} suffix="%" onChange={(y) => updateFocal({ y: y / 100 })} />
          </div>
        </details>
      ) : null}

      {capabilities.crop ? (
        <details className="group rounded-xl bg-slate-50/80 px-2.5 py-2">
          <summary className="cursor-pointer list-none text-[11px] font-semibold text-slate-700">Obrez</summary>
          <div className="mt-2 grid gap-2">
            <NumberControl label="Levo" value={settings.crop.x * 100} min={0} max={95} suffix="%" onChange={(x) => updateCrop({ x: x / 100 })} />
            <NumberControl label="Zgoraj" value={settings.crop.y * 100} min={0} max={95} suffix="%" onChange={(y) => updateCrop({ y: y / 100 })} />
            <NumberControl label="Širina" value={settings.crop.width * 100} min={5} max={100} suffix="%" onChange={(width) => updateCrop({ width: width / 100 })} />
            <NumberControl label="Višina" value={settings.crop.height * 100} min={5} max={100} suffix="%" onChange={(height) => updateCrop({ height: height / 100 })} />
          </div>
        </details>
      ) : null}

      {capabilities.background ? (
        <label className="grid grid-cols-[minmax(78px,1fr)_minmax(0,1.35fr)] items-center gap-3">
          <span className="text-[11px] font-medium text-slate-500">Ozadje</span>
          <HexColorControl value={settings.backgroundColor} onChange={(backgroundColor) => onChange({ backgroundColor })} />
        </label>
      ) : null}
    </div>
  );
}

export function CategoryShowcaseEditor({
  context,
  capabilities,
  selectedItem,
  controlsOpen = true,
  onPresentationChange,
  onImageChange,
  onImageRemove,
  onReset,
  onClose,
  children,
  controlsClassName
}: {
  context: 'category-preview' | 'homepage';
  capabilities: CategoryShowcaseEditorCapabilities;
  selectedItem: CategoryShowcaseItem | null;
  controlsOpen?: boolean;
  onPresentationChange: (updates: Partial<CategoryShowcaseMediaSettings>) => void;
  onImageChange?: (file: File) => void;
  onImageRemove?: () => void;
  onReset?: () => void;
  onClose?: () => void;
  children: ReactNode;
  controlsClassName?: string;
}) {
  return (
    <div className="relative min-w-0" data-category-showcase-editor={context} data-category-showcase-capabilities={Object.entries(capabilities).filter(([, enabled]) => enabled).map(([key]) => key).join(' ')}>
      {children}
      {controlsOpen && selectedItem ? (
        <CategoryMediaControls
          item={selectedItem}
          capabilities={capabilities}
          onChange={onPresentationChange}
          onImageChange={onImageChange}
          onImageRemove={onImageRemove}
          onReset={onReset ?? (() => onPresentationChange(DEFAULT_CATEGORY_SHOWCASE_MEDIA_SETTINGS))}
          onClose={onClose}
          className={controlsClassName}
        />
      ) : null}
    </div>
  );
}
