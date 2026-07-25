'use client';

import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode
} from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, ImagePlus, RotateCcw, Trash2, X } from 'lucide-react';
import {
  CATEGORY_SHOWCASE_CONSTRAINTS,
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
  title: boolean;
  background: boolean;
  ordinal: boolean;
};

export const CATEGORY_SHOWCASE_BASE_CAPABILITIES: CategoryShowcaseEditorCapabilities = {
  media: true,
  crop: true,
  focalPoint: true,
  scale: true,
  offsets: true,
  fit: true,
  title: true,
  background: true,
  ordinal: true
};

type NumberControlProps = {
  label: string;
  hideLabel?: boolean;
  inputLabel?: string;
  field?: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  suffix?: string;
  zeroAction?: {
    axis: 'x' | 'y';
    label: string;
    onClick: () => void;
  };
  onChange: (value: number) => void;
};

function NumberControl({
  label,
  hideLabel = false,
  inputLabel,
  field,
  value,
  min,
  max,
  step = 1,
  suffix,
  zeroAction,
  onChange
}: NumberControlProps) {
  const inputId = useId();
  const isAtZero = Math.abs(value) < Number.EPSILON;

  return (
    <div className="min-w-0">
      <label
        htmlFor={inputId}
        className={hideLabel ? 'sr-only' : 'mb-1 block truncate text-[10px] font-semibold text-[color:var(--category-control-muted,#64748b)]'}
      >
        {label}
      </label>
      <span className="flex h-8 min-w-0 overflow-hidden rounded-lg border border-[color:var(--category-control-field-border,#e2e8f0)] bg-[color:var(--category-control-field-bg,#f8fafc)] transition focus-within:border-[color:var(--category-control-field-border-focus,var(--blue-500))] focus-within:bg-[color:var(--category-control-field-focus,#ffffff)] focus-within:ring-1 focus-within:ring-[color:var(--category-control-focus-ring,var(--blue-100))]">
        <input
          id={inputId}
          type="number"
          aria-label={inputLabel ?? `${label}${suffix ? ` ${suffix}` : ''}`}
          data-category-media-field={field}
          value={Number(value.toFixed(step < 1 ? 2 : 0))}
          min={min}
          max={max}
          step={step}
          className="h-full min-w-0 flex-1 bg-transparent px-2 text-right text-[12px] font-medium tabular-nums text-[color:var(--category-control-field-text,#1e293b)] outline-none"
          onChange={(event) => onChange(Math.min(max, Math.max(min, Number(event.target.value) || 0)))}
        />
        {zeroAction ? (
          <button
            type="button"
            aria-label={zeroAction.label}
            title={zeroAction.label}
            data-category-offset-calibrate={zeroAction.axis}
            disabled={isAtZero}
            className="grid w-7 shrink-0 place-items-center border-l border-[color:var(--category-control-field-border,#e2e8f0)] bg-[color:var(--category-control-field-strong,#ffffff)] text-[10px] font-bold text-[color:var(--category-control-field-muted,#475569)] transition-colors hover:bg-[color:var(--category-control-hover,#f1f5f9)] disabled:cursor-default disabled:bg-transparent disabled:opacity-40"
            onClick={zeroAction.onClick}
          >
            0
          </button>
        ) : null}
        {suffix ? <span className="grid w-7 shrink-0 place-items-center border-l border-[color:var(--category-control-field-border,#e2e8f0)] text-[10px] text-[color:var(--category-control-field-muted,#94a3b8)]">{suffix}</span> : null}
      </span>
    </div>
  );
}

function HexColorControl({
  value,
  pickerLabel = 'Izberi barvo ozadja',
  inputLabel = 'Barva ozadja HEX',
  field = 'background',
  onChange
}: {
  value: string;
  pickerLabel?: string;
  inputLabel?: string;
  field?: string;
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
    <span className="flex h-8 overflow-hidden rounded-lg border border-[color:var(--category-control-field-border,#cbd5e1)] bg-[color:var(--category-control-field-bg,#ffffff)] transition focus-within:border-[color:var(--category-control-field-border-focus,var(--blue-500))] focus-within:bg-[color:var(--category-control-field-focus,#ffffff)] focus-within:ring-1 focus-within:ring-[color:var(--category-control-focus-ring,var(--blue-100))]">
      <input
        type="color"
        aria-label={pickerLabel}
        value={value}
        className="h-full w-9 cursor-pointer border-0 bg-transparent p-1"
        onChange={(event) => {
          setDraft(event.target.value.toUpperCase());
          onChange(event.target.value);
        }}
      />
      <input
        type="text"
        aria-label={inputLabel}
        data-category-media-field={field}
        value={draft}
        maxLength={7}
        className="min-w-0 flex-1 bg-transparent px-2 text-[12px] uppercase text-[color:var(--category-control-field-text,#334155)] outline-none"
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

const CATEGORY_FIT_OPTIONS = [
  {
    value: 'contain',
    label: 'Cela slika',
    description: 'Prikaže celotno sliko; ob robovih lahko ostane ozadje.'
  },
  {
    value: 'cover',
    label: 'Zapolni',
    description: 'Zapolni celoten okvir; robovi slike se lahko odrežejo.'
  },
  {
    value: 'fill',
    label: 'Raztegni',
    description: 'Zapolni okvir z raztegom; razmerja slike se lahko spremenijo.'
  }
] as const;

export function CategoryMediaControls({
  item,
  capabilities = CATEGORY_SHOWCASE_BASE_CAPABILITIES,
  onChange,
  onImageChange,
  onImageRemove,
  onReset,
  onClose,
  tone = 'light',
  className
}: {
  item: CategoryShowcaseItem;
  capabilities?: CategoryShowcaseEditorCapabilities;
  onChange: (updates: Partial<CategoryShowcaseMediaSettings>) => void;
  onImageChange?: (file: File) => void;
  onImageRemove?: () => void;
  onReset?: () => void;
  onClose?: () => void;
  tone?: 'light' | 'dark';
  className?: string;
}) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const fitDescriptionId = useId();
  const ordinalGroupId = useId();
  const settings = normalizeCategoryShowcaseMediaSettings(item.presentation);
  const primaryControlCount = Number(capabilities.scale) + (capabilities.offsets ? 2 : 0);
  const selectedFit = CATEGORY_FIT_OPTIONS.find((option) => option.value === settings.fit) ?? CATEGORY_FIT_OPTIONS[0];
  const updateCrop = (updates: Partial<CategoryShowcaseMediaSettings['crop']>) => onChange({
    crop: { ...settings.crop, ...updates }
  });
  const updateFocal = (updates: Partial<CategoryShowcaseMediaSettings['focalPoint']>) => onChange({
    focalPoint: { ...settings.focalPoint, ...updates }
  });

  return (
    <div
      className={classNames('w-[380px] max-w-full space-y-2 rounded-2xl border border-slate-200/80 bg-[color:var(--category-control-surface,#ffffff)] p-3 shadow-[0_18px_48px_rgba(15,23,42,0.16)] backdrop-blur-xl', className)}
      data-category-media-controls={item.slug}
      data-category-media-controls-tone={tone}
      style={tone === 'dark' ? {
        '--category-control-surface': 'rgba(70,81,94,0.95)',
        '--category-control-strong': 'rgba(255,255,255,0.92)',
        '--category-control-muted': 'rgba(255,255,255,0.75)',
        '--category-control-border': 'rgba(255,255,255,0.15)',
        '--category-control-hover': 'rgba(255,255,255,0.1)',
        '--category-control-field-bg': 'rgba(47,59,72,0.96)',
        '--category-control-field-focus': 'rgba(42,53,65,1)',
        '--category-control-field-strong': 'rgba(47,59,72,1)',
        '--category-control-field-border': 'rgba(255,255,255,0.15)',
        '--category-control-field-border-focus': 'rgba(255,255,255,0.34)',
        '--category-control-focus-ring': 'rgba(255,255,255,0.12)',
        '--category-control-field-text': 'rgba(255,255,255,0.94)',
        '--category-control-field-muted': 'rgba(255,255,255,0.62)',
        '--category-control-subsurface': 'rgba(47,59,72,0.62)',
        '--category-control-selected-bg': 'rgba(255,255,255,0.14)',
        '--category-control-selected-text': 'rgba(255,255,255,0.96)',
        '--category-control-divider': 'rgba(255,255,255,0.14)'
      } as CSSProperties : undefined}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-[12px] font-semibold text-[color:var(--category-control-strong,#0f172a)]">{item.title}</p>
          <p className="text-[10px] text-[color:var(--category-control-muted,#64748b)]">Slika, naslov, številka in ozadje</p>
        </div>
        <div className="flex items-center gap-1">
          {capabilities.media && onImageChange ? (
            <>
              <button type="button" className="grid h-8 w-8 place-items-center rounded-lg border border-[color:var(--category-control-border,#e2e8f0)] text-[color:var(--category-control-muted,#475569)] hover:bg-[color:var(--category-control-hover,#f8fafc)] hover:text-[color:var(--category-control-strong,#334155)]" aria-label={`Dodaj ali zamenjaj sliko za ${item.title}`} onClick={() => fileInputRef.current?.click()}>
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
            <button type="button" className="grid h-8 w-8 place-items-center rounded-lg border border-[color:var(--category-control-border,#e2e8f0)] text-[color:var(--category-control-muted,#475569)] hover:bg-[color:var(--category-control-hover,#f8fafc)] hover:text-[color:var(--category-control-strong,#334155)]" aria-label={`Ponastavi predstavitev za ${item.title}`} onClick={onReset}>
              <RotateCcw className="h-4 w-4" />
            </button>
          ) : null}
          {onClose ? (
            <button type="button" className="grid h-8 w-8 place-items-center rounded-lg border border-[color:var(--category-control-border,#e2e8f0)] text-[color:var(--category-control-muted,#475569)] hover:bg-[color:var(--category-control-hover,#f8fafc)] hover:text-[color:var(--category-control-strong,#334155)]" aria-label={`Zapri nastavitve za ${item.title}`} onClick={onClose}>
              <X className="h-4 w-4" />
            </button>
          ) : null}
        </div>
      </div>

      {primaryControlCount > 0 ? (
        <fieldset>
          <legend className="sr-only">Položaj in velikost slike</legend>
          <div
            className="grid gap-2"
            data-category-media-primary-controls
            style={{ gridTemplateColumns: `repeat(${primaryControlCount}, minmax(0, 1fr))` }}
          >
            {capabilities.scale ? (
              <NumberControl
                label="Povečava"
                inputLabel="Povečava ×"
                field="scale"
                value={settings.scale}
                min={CATEGORY_SHOWCASE_CONSTRAINTS.scale.min}
                max={CATEGORY_SHOWCASE_CONSTRAINTS.scale.max}
                step={CATEGORY_SHOWCASE_CONSTRAINTS.scale.step}
                suffix="×"
                onChange={(scale) => onChange({ scale })}
              />
            ) : null}
            {capabilities.offsets ? (
              <>
                <NumberControl
                  label="Odmik X"
                  inputLabel="Odmik X %"
                  field="offset-x"
                  value={settings.offsetX}
                  min={CATEGORY_SHOWCASE_CONSTRAINTS.offsetPercent.min - settings.offsetOriginX}
                  max={CATEGORY_SHOWCASE_CONSTRAINTS.offsetPercent.max - settings.offsetOriginX}
                  suffix="%"
                  zeroAction={{
                    axis: 'x',
                    label: 'Nastavi trenutno lego X kot 0',
                    onClick: () => onChange({
                      offsetOriginX: settings.offsetOriginX + settings.offsetX,
                      offsetX: 0
                    })
                  }}
                  onChange={(offsetX) => onChange({ offsetX })}
                />
                <NumberControl
                  label="Odmik Y"
                  inputLabel="Odmik Y %"
                  field="offset-y"
                  value={settings.offsetY}
                  min={CATEGORY_SHOWCASE_CONSTRAINTS.offsetPercent.min - settings.offsetOriginY}
                  max={CATEGORY_SHOWCASE_CONSTRAINTS.offsetPercent.max - settings.offsetOriginY}
                  suffix="%"
                  zeroAction={{
                    axis: 'y',
                    label: 'Nastavi trenutno lego Y kot 0',
                    onClick: () => onChange({
                      offsetOriginY: settings.offsetOriginY + settings.offsetY,
                      offsetY: 0
                    })
                  }}
                  onChange={(offsetY) => onChange({ offsetY })}
                />
              </>
            ) : null}
          </div>
        </fieldset>
      ) : null}

      {capabilities.fit || capabilities.ordinal ? (
        <div className={classNames(
          'grid items-start gap-2',
          capabilities.fit && capabilities.ordinal && 'grid-cols-[minmax(0,1fr)_112px]'
        )}>
          {capabilities.fit ? (
            <div className="min-w-0 space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[10px] font-semibold text-[color:var(--category-control-muted,#64748b)]">Prileganje slike</span>
                <span className="text-[9px] text-[color:var(--category-control-muted,#94a3b8)]">zapolnitev okvirja</span>
              </div>
              <div className="grid grid-cols-3 rounded-lg bg-[color:var(--category-control-subsurface,#f1f5f9)] p-0.5" role="group" aria-label="Prileganje slike">
                {CATEGORY_FIT_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    aria-pressed={settings.fit === option.value}
                    aria-describedby={`${fitDescriptionId}-${option.value}`}
                    data-category-media-fit={option.value}
                    className={classNames(
                      'h-7 rounded-md px-1 text-[10px] font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--blue-400)]',
                      settings.fit === option.value
                        ? 'bg-[color:var(--category-control-selected-bg,#ffffff)] text-[color:var(--category-control-selected-text,#2563eb)] shadow-sm'
                        : 'text-[color:var(--category-control-muted,#64748b)] hover:text-[color:var(--category-control-strong,#1e293b)]'
                    )}
                    onClick={() => onChange({ fit: option.value })}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
              {CATEGORY_FIT_OPTIONS.map((option) => (
                <span key={option.value} id={`${fitDescriptionId}-${option.value}`} className="sr-only">
                  {option.description}
                </span>
              ))}
              <p className="text-[9px] leading-3.5 text-[color:var(--category-control-muted,#64748b)]" data-category-media-fit-description>
                {selectedFit.description}
              </p>
            </div>
          ) : null}

          {capabilities.ordinal ? (
            <div
              className="min-w-0 space-y-1.5"
              data-category-media-section="ordinal-size"
              role="group"
              aria-labelledby={ordinalGroupId}
            >
              <span id={ordinalGroupId} className="block truncate text-[10px] font-semibold text-[color:var(--category-control-muted,#64748b)]">Velikost številke</span>
              <NumberControl
                label="Velikost"
                hideLabel
                inputLabel="Velikost številke kategorije v slikovnih pikah"
                field="ordinal-font-size"
                value={settings.ordinalFontSizePx}
                min={CATEGORY_SHOWCASE_CONSTRAINTS.ordinalFontSizePx.min}
                max={CATEGORY_SHOWCASE_CONSTRAINTS.ordinalFontSizePx.max}
                suffix="px"
                onChange={(ordinalFontSizePx) => onChange({ ordinalFontSizePx })}
              />
            </div>
          ) : null}
        </div>
      ) : null}

      {capabilities.title || capabilities.ordinal || capabilities.background ? (
        <div
          className="grid grid-cols-[64px_minmax(0,1fr)_minmax(0,1fr)] items-center gap-x-1.5 gap-y-1.5 rounded-xl bg-[color:var(--category-control-subsurface,#f8fafc)] px-2.5 py-2"
          data-category-media-section="colors"
        >
          <span className="text-[10px] font-semibold text-[color:var(--category-control-strong,#334155)]">Barve</span>
          <span className="text-center text-[9px] font-medium text-[color:var(--category-control-muted,#64748b)]">Običajno</span>
          <span className="text-center text-[9px] font-medium text-[color:var(--category-control-muted,#64748b)]">Ob lebdenju</span>

          {capabilities.title ? (
            <>
              <span className="text-[10px] font-semibold text-[color:var(--category-control-muted,#64748b)]">Naslov</span>
              <HexColorControl
                value={settings.titleColor}
                pickerLabel="Izberi barvo naslova kategorije"
                inputLabel="Barva naslova kategorije (HEX)"
                field="title-color"
                onChange={(titleColor) => onChange({ titleColor })}
              />
              <HexColorControl
                value={settings.titleHoverColor}
                pickerLabel="Izberi barvo naslova kategorije ob lebdenju"
                inputLabel="Barva naslova kategorije ob lebdenju (HEX)"
                field="title-hover-color"
                onChange={(titleHoverColor) => onChange({ titleHoverColor })}
              />
            </>
          ) : null}

          {capabilities.ordinal ? (
            <>
              <span className="text-[10px] font-semibold text-[color:var(--category-control-muted,#64748b)]">Številka</span>
              <HexColorControl
                value={settings.ordinalColor}
                pickerLabel="Izberi barvo številke kategorije"
                inputLabel="Barva številke kategorije (HEX)"
                field="ordinal-color"
                onChange={(ordinalColor) => onChange({ ordinalColor })}
              />
              <HexColorControl
                value={settings.ordinalHoverColor}
                pickerLabel="Izberi barvo številke oziroma puščice ob lebdenju"
                inputLabel="Barva številke kategorije ob lebdenju (HEX)"
                field="ordinal-hover-color"
                onChange={(ordinalHoverColor) => onChange({ ordinalHoverColor })}
              />
            </>
          ) : null}

          {capabilities.background ? (
            <>
              <span className="text-[10px] font-semibold text-[color:var(--category-control-muted,#64748b)]">Ozadje</span>
              <HexColorControl
                value={settings.backgroundColor}
                pickerLabel="Izberi barvo ozadja kartice"
                inputLabel="Barva ozadja kartice (HEX)"
                field="background"
                onChange={(backgroundColor) => onChange({ backgroundColor })}
              />
              <HexColorControl
                value={settings.backgroundHoverColor}
                pickerLabel="Izberi barvo ozadja kartice ob lebdenju"
                inputLabel="Barva ozadja kartice ob lebdenju (HEX)"
                field="background-hover"
                onChange={(backgroundHoverColor) => onChange({ backgroundHoverColor })}
              />
            </>
          ) : null}
        </div>
      ) : null}

      {capabilities.focalPoint || capabilities.crop ? (
        <div className="grid grid-cols-2 gap-2">
          {capabilities.focalPoint ? (
            <details className="group min-w-0 rounded-xl border border-[color:var(--category-control-divider,#f1f5f9)] bg-[color:var(--category-control-subsurface,#f8fafc)] open:col-span-2" data-category-media-section="focus">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-2 rounded-xl px-2.5 py-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[color:var(--blue-300)]">
                <span className="min-w-0">
                  <span className="block text-[10px] font-semibold text-[color:var(--category-control-strong,#334155)]">Fokus slike</span>
                  <span className="block truncate text-[9px] leading-3.5 text-[color:var(--category-control-muted,#64748b)]">Vidni del pri »Zapolni«</span>
                </span>
                <ChevronDown aria-hidden="true" className="h-3.5 w-3.5 shrink-0 text-[color:var(--category-control-muted,#94a3b8)] transition-transform group-open:rotate-180" />
              </summary>
              <div className="grid grid-cols-2 gap-2 border-t border-[color:var(--category-control-divider,#f1f5f9)] px-2.5 pb-2.5 pt-2">
                <NumberControl label="Vodoravno" inputLabel="Fokus X %" field="focal-x" value={settings.focalPoint.x * 100} min={CATEGORY_SHOWCASE_CONSTRAINTS.focalPoint.min * 100} max={CATEGORY_SHOWCASE_CONSTRAINTS.focalPoint.max * 100} suffix="%" onChange={(x) => updateFocal({ x: x / 100 })} />
                <NumberControl label="Navpično" inputLabel="Fokus Y %" field="focal-y" value={settings.focalPoint.y * 100} min={CATEGORY_SHOWCASE_CONSTRAINTS.focalPoint.min * 100} max={CATEGORY_SHOWCASE_CONSTRAINTS.focalPoint.max * 100} suffix="%" onChange={(y) => updateFocal({ y: y / 100 })} />
              </div>
            </details>
          ) : null}

          {capabilities.crop ? (
            <details className="group min-w-0 rounded-xl border border-[color:var(--category-control-divider,#f1f5f9)] bg-[color:var(--category-control-subsurface,#f8fafc)] open:col-span-2" data-category-media-section="crop">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-2 rounded-xl px-2.5 py-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[color:var(--blue-300)]">
                <span className="min-w-0">
                  <span className="block text-[10px] font-semibold text-[color:var(--category-control-strong,#334155)]">Območje obreza</span>
                  <span className="block truncate text-[9px] leading-3.5 text-[color:var(--category-control-muted,#64748b)]">Vidno območje slike</span>
                </span>
                <ChevronDown aria-hidden="true" className="h-3.5 w-3.5 shrink-0 text-[color:var(--category-control-muted,#94a3b8)] transition-transform group-open:rotate-180" />
              </summary>
              <div className="grid grid-cols-2 gap-2 border-t border-[color:var(--category-control-divider,#f1f5f9)] px-2.5 pb-2.5 pt-2">
                <NumberControl label="Levi rob" inputLabel="Levo %" field="crop-x" value={settings.crop.x * 100} min={0} max={(CATEGORY_SHOWCASE_CONSTRAINTS.crop.maxSize - settings.crop.width) * 100} suffix="%" onChange={(x) => updateCrop({ x: x / 100 })} />
                <NumberControl label="Zgornji rob" inputLabel="Zgoraj %" field="crop-y" value={settings.crop.y * 100} min={0} max={(CATEGORY_SHOWCASE_CONSTRAINTS.crop.maxSize - settings.crop.height) * 100} suffix="%" onChange={(y) => updateCrop({ y: y / 100 })} />
                <NumberControl label="Širina" inputLabel="Širina %" field="crop-width" value={settings.crop.width * 100} min={CATEGORY_SHOWCASE_CONSTRAINTS.crop.minSize * 100} max={(CATEGORY_SHOWCASE_CONSTRAINTS.crop.maxSize - settings.crop.x) * 100} suffix="%" onChange={(width) => updateCrop({ width: width / 100 })} />
                <NumberControl label="Višina" inputLabel="Višina %" field="crop-height" value={settings.crop.height * 100} min={CATEGORY_SHOWCASE_CONSTRAINTS.crop.minSize * 100} max={(CATEGORY_SHOWCASE_CONSTRAINTS.crop.maxSize - settings.crop.y) * 100} suffix="%" onChange={(height) => updateCrop({ height: height / 100 })} />
              </div>
            </details>
          ) : null}
        </div>
      ) : null}

    </div>
  );
}

const CATEGORY_CONTROLS_WIDTH_PX = 380;
const CATEGORY_CONTROLS_GAP_PX = 10;
const CATEGORY_CONTROLS_VIEWPORT_MARGIN_PX = 8;

type CategoryControlsPlacement = 'right' | 'left' | 'below' | 'above';

type AnchoredCategoryControls = {
  placement: CategoryControlsPlacement;
  style: CSSProperties;
};

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

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
  controlsTone = 'light',
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
  controlsTone?: 'light' | 'dark';
  controlsClassName?: string;
}) {
  const editorRef = useRef<HTMLDivElement | null>(null);
  const anchoredControlsRef = useRef<HTMLDivElement | null>(null);
  const [portalReady, setPortalReady] = useState(false);
  const [anchoredControls, setAnchoredControls] = useState<AnchoredCategoryControls | null>(null);
  const selectedSlug = selectedItem?.slug ?? null;
  const anchored = context === 'category-preview';

  useEffect(() => {
    setPortalReady(true);
  }, []);

  const updateAnchoredPosition = useCallback(() => {
    if (!anchored || !controlsOpen || !selectedSlug || typeof window === 'undefined') {
      setAnchoredControls(null);
      return;
    }

    const editor = editorRef.current;
    const controls = anchoredControlsRef.current;
    const tile = editor
      ? Array.from(editor.querySelectorAll<HTMLElement>('[data-category-showcase-selected="true"]'))
        .find((candidate) => candidate.dataset.categorySlug === selectedSlug)
      : null;
    if (!editor || !controls || !tile) {
      setAnchoredControls(null);
      return;
    }

    const editorRect = editor.getBoundingClientRect();
    const tileRect = tile.getBoundingClientRect();
    const controlsRect = controls.getBoundingClientRect();
    const width = Math.min(
      CATEGORY_CONTROLS_WIDTH_PX,
      Math.max(0, window.innerWidth - CATEGORY_CONTROLS_VIEWPORT_MARGIN_PX * 2)
    );
    const measuredHeight = controlsRect.height;
    const height = Math.min(
      measuredHeight,
      Math.max(0, window.innerHeight - CATEGORY_CONTROLS_VIEWPORT_MARGIN_PX * 2)
    );
    const viewportRight = window.innerWidth - CATEGORY_CONTROLS_VIEWPORT_MARGIN_PX;
    const editorLeft = Math.max(editorRect.left, CATEGORY_CONTROLS_VIEWPORT_MARGIN_PX);
    const editorRight = Math.min(editorRect.right, viewportRight);
    const rightLeft = tileRect.right + CATEGORY_CONTROLS_GAP_PX;
    const leftLeft = tileRect.left - CATEGORY_CONTROLS_GAP_PX - width;
    const fitsRight = rightLeft + width <= editorRight;
    const fitsLeft = leftLeft >= editorLeft;
    let placement: CategoryControlsPlacement;
    let left: number;
    let top: number;

    if (fitsRight) {
      placement = 'right';
      left = rightLeft;
      top = tileRect.top;
    } else if (fitsLeft) {
      placement = 'left';
      left = leftLeft;
      top = tileRect.top;
    } else {
      const belowTop = tileRect.bottom + CATEGORY_CONTROLS_GAP_PX;
      const aboveTop = tileRect.top - CATEGORY_CONTROLS_GAP_PX - height;
      const fitsBelow = belowTop + height <= window.innerHeight - CATEGORY_CONTROLS_VIEWPORT_MARGIN_PX;
      const fitsAbove = aboveTop >= CATEGORY_CONTROLS_VIEWPORT_MARGIN_PX;
      placement = !fitsBelow && fitsAbove ? 'above' : 'below';
      left = clamp(
        tileRect.left,
        CATEGORY_CONTROLS_VIEWPORT_MARGIN_PX,
        Math.max(CATEGORY_CONTROLS_VIEWPORT_MARGIN_PX, viewportRight - width)
      );
      top = placement === 'above' ? aboveTop : belowTop;
    }

    top = clamp(
      top,
      CATEGORY_CONTROLS_VIEWPORT_MARGIN_PX,
      Math.max(
        CATEGORY_CONTROLS_VIEWPORT_MARGIN_PX,
        window.innerHeight - CATEGORY_CONTROLS_VIEWPORT_MARGIN_PX - height
      )
    );

    const next: AnchoredCategoryControls = {
      placement,
      style: {
        position: 'fixed',
        top: Math.round(top),
        left: Math.round(left),
        width,
        maxHeight: `calc(100dvh - ${CATEGORY_CONTROLS_VIEWPORT_MARGIN_PX * 2}px)`,
        overflowY: 'auto',
        zIndex: 90,
        visibility: 'visible',
        transformOrigin: placement === 'left'
          ? 'top right'
          : placement === 'right'
            ? 'top left'
            : placement === 'above'
              ? 'bottom left'
              : 'top left'
      }
    };

    setAnchoredControls((current) => {
      if (
        current?.placement === next.placement
        && current.style.top === next.style.top
        && current.style.left === next.style.left
        && current.style.width === next.style.width
        && current.style.maxHeight === next.style.maxHeight
      ) {
        return current;
      }
      return next;
    });
  }, [anchored, controlsOpen, selectedSlug]);

  useLayoutEffect(() => {
    if (!portalReady || !anchored || !controlsOpen || !selectedSlug) {
      setAnchoredControls(null);
      return;
    }
    updateAnchoredPosition();
  }, [anchored, controlsOpen, portalReady, selectedSlug, updateAnchoredPosition]);

  useEffect(() => {
    if (!portalReady || !anchored || !controlsOpen || !selectedSlug) return;

    const editor = editorRef.current;
    const controls = anchoredControlsRef.current;
    const tile = editor
      ? Array.from(editor.querySelectorAll<HTMLElement>('[data-category-showcase-selected="true"]'))
        .find((candidate) => candidate.dataset.categorySlug === selectedSlug)
      : null;
    window.addEventListener('resize', updateAnchoredPosition);
    window.addEventListener('scroll', updateAnchoredPosition, true);
    const resizeObserver = typeof ResizeObserver === 'undefined'
      ? null
      : new ResizeObserver(updateAnchoredPosition);
    if (editor) resizeObserver?.observe(editor);
    if (tile) resizeObserver?.observe(tile);
    if (controls) resizeObserver?.observe(controls);

    return () => {
      window.removeEventListener('resize', updateAnchoredPosition);
      window.removeEventListener('scroll', updateAnchoredPosition, true);
      resizeObserver?.disconnect();
    };
  }, [anchored, controlsOpen, portalReady, selectedSlug, updateAnchoredPosition]);

  useEffect(() => {
    if (!anchored || !controlsOpen || !selectedSlug || !onClose) return;
    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [anchored, controlsOpen, onClose, selectedSlug]);

  const controls = controlsOpen && selectedItem ? (
    <CategoryMediaControls
      item={selectedItem}
      capabilities={capabilities}
      onChange={onPresentationChange}
      onImageChange={onImageChange}
      onImageRemove={onImageRemove}
      onReset={onReset ?? (() => onPresentationChange(DEFAULT_CATEGORY_SHOWCASE_MEDIA_SETTINGS))}
      onClose={onClose}
      tone={controlsTone}
      className={anchored
        ? 'max-w-none !w-full border-slate-200/90 shadow-[0_18px_48px_rgba(15,23,42,0.18)]'
        : controlsClassName}
    />
  ) : null;

  return (
    <div ref={editorRef} className="relative min-w-0" data-category-showcase-editor={context} data-category-showcase-capabilities={Object.entries(capabilities).filter(([, enabled]) => enabled).map(([key]) => key).join(' ')}>
      {children}
      {!anchored ? controls : null}
      {anchored && portalReady && controls && typeof document !== 'undefined'
        ? createPortal(
          <div
            ref={anchoredControlsRef}
            role="dialog"
            aria-label={`Nastavitve kategorije: ${selectedItem?.title ?? 'kategorija'}`}
            data-category-media-controls-placement={anchoredControls?.placement}
            className="w-[380px] max-w-[calc(100vw-16px)] rounded-2xl"
            style={anchoredControls?.style ?? {
              position: 'fixed',
              top: 0,
              left: 0,
              width: CATEGORY_CONTROLS_WIDTH_PX,
              visibility: 'hidden'
            }}
          >
            {controls}
          </div>,
          document.body
        )
        : null}
    </div>
  );
}
