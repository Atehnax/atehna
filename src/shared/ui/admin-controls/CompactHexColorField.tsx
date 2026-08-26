'use client';

import {
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent
} from 'react';
import { createPortal } from 'react-dom';
import { HexAlphaColorPicker, HexColorPicker } from 'react-colorful';
import {
  ADMIN_HEX_COLOR_PALETTE,
  normalizeHexColor,
  normalizeHexColorPalette
} from './hexColor';

export { normalizeHexColor } from './hexColor';

export type CompactHexColorInputAttributes = {
  'aria-label'?: string;
  'aria-describedby'?: string;
} & Partial<Record<`data-${string}`, string | number | boolean>>;

export type CompactHexColorFieldProps = {
  id?: string;
  label: string;
  value: string;
  marker?: string;
  onChange: (value: string) => void;
  palette?: readonly string[];
  tone?: 'dark' | 'light';
  layout?: 'compact' | 'inline';
  disabled?: boolean;
  allowAlpha?: boolean;
  allowClear?: boolean;
  clearLabel?: string;
  inheritedColor?: string;
  className?: string;
  inputAttributes?: CompactHexColorInputAttributes;
};

type PalettePosition = {
  left: number;
  top: number;
  placement: 'above' | 'below';
  ready: boolean;
};

const PALETTE_GAP_PX = 6;
const VIEWPORT_MARGIN_PX = 8;
const FALLBACK_PALETTE_WIDTH_PX = 208;
const FALLBACK_PALETTE_HEIGHT_PX = 330;

const emptyPosition: PalettePosition = {
  left: 0,
  top: 0,
  placement: 'below',
  ready: false
};

const transparentSwatchStyle: CSSProperties = {
  backgroundColor: '#FFFFFF',
  backgroundImage:
    'linear-gradient(45deg,#CBD5E1 25%,transparent 25%),linear-gradient(-45deg,#CBD5E1 25%,transparent 25%),linear-gradient(45deg,transparent 75%,#CBD5E1 75%),linear-gradient(-45deg,transparent 75%,#CBD5E1 75%)',
  backgroundPosition: '0 0,0 5px,5px -5px,-5px 0',
  backgroundSize: '10px 10px'
};

export function CompactHexColorField({
  id,
  label,
  value,
  marker,
  onChange,
  palette = ADMIN_HEX_COLOR_PALETTE,
  tone = 'dark',
  layout = 'compact',
  disabled = false,
  allowAlpha = false,
  allowClear = false,
  clearLabel = 'Podeduj',
  inheritedColor,
  className = '',
  inputAttributes
}: CompactHexColorFieldProps) {
  const generatedId = useId();
  const stableId = generatedId.replaceAll(':', '');
  const inputId = id ?? `admin-hex-${stableId}`;
  const popoverId = `${inputId}-palette`;
  const paletteLabelId = `${popoverId}-label`;
  const [draft, setDraft] = useState(value);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [focusIndex, setFocusIndex] = useState(0);
  const [palettePosition, setPalettePosition] = useState<PalettePosition>(emptyPosition);
  const editingRef = useRef(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const popoverRef = useRef<HTMLDivElement | null>(null);
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const normalizeOptions = useMemo(() => ({ allowAlpha }), [allowAlpha]);
  const paletteOptions = useMemo(
    () => normalizeHexColorPalette(palette, normalizeOptions),
    [normalizeOptions, palette]
  );
  const normalizedValue = normalizeHexColor(value, normalizeOptions);
  const normalizedDraft = normalizeHexColor(draft, normalizeOptions);
  const normalizedInheritedColor = inheritedColor
    ? normalizeHexColor(inheritedColor, normalizeOptions)
    : null;
  const effectiveColor = normalizedDraft ?? normalizedValue ?? normalizedInheritedColor;
  const inherited = allowClear && !normalizedValue && !draft.trim();

  useEffect(() => {
    if (!editingRef.current) setDraft(value);
  }, [value]);

  useEffect(() => {
    if (!disabled) return;
    setPaletteOpen(false);
  }, [disabled]);

  useLayoutEffect(() => {
    if (!paletteOpen || typeof window === 'undefined') return undefined;

    const updatePosition = () => {
      const trigger = triggerRef.current;
      if (!trigger) return;
      const triggerRect = trigger.getBoundingClientRect();
      const paletteRect = popoverRef.current?.getBoundingClientRect();
      const width = paletteRect?.width || FALLBACK_PALETTE_WIDTH_PX;
      const height = paletteRect?.height || FALLBACK_PALETTE_HEIGHT_PX;
      const viewportWidth = window.visualViewport?.width ?? window.innerWidth;
      const viewportHeight = window.visualViewport?.height ?? window.innerHeight;
      const roomBelow = viewportHeight - triggerRect.bottom - VIEWPORT_MARGIN_PX;
      const roomAbove = triggerRect.top - VIEWPORT_MARGIN_PX;
      const placement = roomBelow >= height || roomBelow >= roomAbove ? 'below' : 'above';
      const left = Math.min(
        Math.max(VIEWPORT_MARGIN_PX, triggerRect.right - width),
        Math.max(VIEWPORT_MARGIN_PX, viewportWidth - width - VIEWPORT_MARGIN_PX)
      );
      const requestedTop = placement === 'below'
        ? triggerRect.bottom + PALETTE_GAP_PX
        : triggerRect.top - height - PALETTE_GAP_PX;
      const top = Math.min(
        Math.max(VIEWPORT_MARGIN_PX, requestedTop),
        Math.max(VIEWPORT_MARGIN_PX, viewportHeight - height - VIEWPORT_MARGIN_PX)
      );
      setPalettePosition({ left, top, placement, ready: true });
    };

    updatePosition();
    const frame = window.requestAnimationFrame(updatePosition);
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);
    window.visualViewport?.addEventListener('resize', updatePosition);
    window.visualViewport?.addEventListener('scroll', updatePosition);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
      window.visualViewport?.removeEventListener('resize', updatePosition);
      window.visualViewport?.removeEventListener('scroll', updatePosition);
    };
  }, [paletteOpen]);

  useEffect(() => {
    if (!paletteOpen || !palettePosition.ready) return undefined;
    const frame = window.requestAnimationFrame(() => {
      const arbitraryPickerControl = popoverRef.current?.querySelector<HTMLElement>(
        '.react-colorful [role="slider"]'
      );
      if (arbitraryPickerControl) arbitraryPickerControl.focus();
      else optionRefs.current.find((candidate) => candidate)?.focus();
    });
    return () => window.cancelAnimationFrame(frame);
  }, [paletteOpen, palettePosition.ready]);

  useEffect(() => {
    if (!paletteOpen) return undefined;
    const closeOutside = (event: PointerEvent | FocusEvent) => {
      if (!(event.target instanceof Node)) return;
      if (rootRef.current?.contains(event.target)) return;
      if (popoverRef.current?.contains(event.target)) return;
      setPaletteOpen(false);
    };
    document.addEventListener('pointerdown', closeOutside, true);
    document.addEventListener('focusin', closeOutside, true);
    return () => {
      document.removeEventListener('pointerdown', closeOutside, true);
      document.removeEventListener('focusin', closeOutside, true);
    };
  }, [paletteOpen]);

  const emitNormalized = (normalized: string) => {
    setDraft(normalized);
    if (normalized !== normalizedValue) onChange(normalized);
  };

  const commit = (candidate: string) => {
    if (allowClear && !candidate.trim()) {
      setDraft('');
      if (value !== '') onChange('');
      return;
    }
    const normalized = normalizeHexColor(candidate, normalizeOptions);
    if (!normalized) {
      setDraft(normalizedValue ?? (allowClear ? '' : '#000000'));
      return;
    }
    emitNormalized(normalized);
  };

  const updateDraft = (candidate: string) => {
    setDraft(candidate);
    if (allowClear && !candidate.trim()) {
      if (value !== '') onChange('');
      return;
    }
    const normalized = normalizeHexColor(candidate, normalizeOptions);
    if (normalized && normalized !== normalizedValue) onChange(normalized);
  };

  const openPalette = () => {
    if (disabled) return;
    const selectedIndex = effectiveColor
      ? paletteOptions.indexOf(effectiveColor)
      : -1;
    setFocusIndex(Math.max(0, selectedIndex));
    setPalettePosition(emptyPosition);
    setPaletteOpen(true);
  };

  const closePalette = (restoreTriggerFocus = false) => {
    setPaletteOpen(false);
    if (restoreTriggerFocus) {
      window.requestAnimationFrame(() => triggerRef.current?.focus());
    }
  };

  const movePaletteFocus = (
    event: ReactKeyboardEvent<HTMLButtonElement>,
    index: number
  ) => {
    const columns = 6;
    const lastIndex = paletteOptions.length - 1;
    let nextIndex = index;
    if (event.key === 'ArrowRight') nextIndex = Math.min(lastIndex, index + 1);
    else if (event.key === 'ArrowLeft') nextIndex = Math.max(0, index - 1);
    else if (event.key === 'ArrowDown') nextIndex = Math.min(lastIndex, index + columns);
    else if (event.key === 'ArrowUp') nextIndex = Math.max(0, index - columns);
    else if (event.key === 'Home') nextIndex = 0;
    else if (event.key === 'End') nextIndex = lastIndex;
    else return;
    event.preventDefault();
    setFocusIndex(nextIndex);
    optionRefs.current[nextIndex]?.focus();
  };

  const rootToneClasses = tone === 'dark'
    ? 'border-white/10 bg-white/5 text-white'
    : 'border-slate-200 bg-white text-slate-900';
  const labelClasses = tone === 'dark' ? 'text-white/75' : 'text-slate-600';
  const inputClasses = tone === 'dark'
    ? 'border-white/15 bg-slate-800 text-slate-100 placeholder:text-slate-500 hover:border-white/25 focus:border-blue-300 focus:bg-slate-700 focus:ring-blue-300/35'
    : 'border-slate-300 bg-slate-50 text-slate-900 placeholder:text-slate-400 hover:border-slate-400 focus:border-blue-500 focus:bg-white focus:ring-blue-500/20';
  const popoverClasses = tone === 'dark'
    ? 'border-white/15 bg-slate-900 text-white shadow-black/35'
    : 'border-slate-200 bg-white text-slate-900 shadow-slate-900/15';
  const mutedClasses = tone === 'dark' ? 'text-white/55' : 'text-slate-500';
  const rootLayoutClasses = layout === 'inline'
    ? 'inline-flex items-center gap-2'
    : `flex items-center justify-between gap-3 rounded-lg border px-2.5 py-2 ${rootToneClasses}`;
  const inlineToneClasses = tone === 'dark' ? 'text-white' : 'text-slate-900';
  const customInputAriaLabel = inputAttributes?.['aria-label'];

  const palettePopover = paletteOpen && typeof document !== 'undefined'
    ? createPortal(
        <div
          ref={popoverRef}
          id={popoverId}
          role="dialog"
          aria-modal="false"
          aria-labelledby={paletteLabelId}
          data-admin-color-palette-portal
          data-admin-color-palette-popover
          data-admin-color-palette-placement={palettePosition.placement}
          className={`fixed z-[2147483600] w-52 rounded-xl border p-2.5 shadow-2xl ${popoverClasses}`}
          style={{
            left: palettePosition.left,
            top: palettePosition.top,
            opacity: palettePosition.ready ? 1 : 0,
            visibility: palettePosition.ready ? 'visible' : 'hidden',
            pointerEvents: palettePosition.ready ? 'auto' : 'none'
          }}
          onKeyDownCapture={(event) => {
            if (event.key !== 'Escape') return;
            event.preventDefault();
            event.stopPropagation();
            closePalette(true);
          }}
        >
          <div className="mb-2 flex items-center justify-between gap-2">
            <p id={paletteLabelId} className="truncate text-[10px] font-semibold">
              {label}
            </p>
            <button
              type="button"
              onClick={() => closePalette(true)}
              className={`grid h-6 w-6 place-items-center rounded-md text-sm leading-none transition ${tone === 'dark' ? 'text-white/60 hover:bg-white/10 hover:text-white' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900'}`}
              aria-label="Zapri barvno paleto"
            >
              ×
            </button>
          </div>
          <div data-admin-color-picker-arbitrary>
            {allowAlpha ? (
              <HexAlphaColorPicker
                color={effectiveColor ?? '#000000FF'}
                onChange={(candidate) => {
                  const normalized = normalizeHexColor(candidate, normalizeOptions);
                  if (normalized) emitNormalized(normalized);
                }}
                className="!h-36 !w-full"
              />
            ) : (
              <HexColorPicker
                color={effectiveColor ?? '#000000'}
                onChange={(candidate) => {
                  const normalized = normalizeHexColor(candidate, normalizeOptions);
                  if (normalized) emitNormalized(normalized);
                }}
                className="!h-36 !w-full"
              />
            )}
          </div>
          <div className={`mt-2 flex items-center gap-2 border-b pb-2 ${tone === 'dark' ? 'border-white/10' : 'border-slate-200'}`}>
            <span className={`text-[9px] font-medium ${mutedClasses}`}>Izbrana HEX</span>
            <output
              htmlFor={inputId}
              aria-live="polite"
              data-admin-color-palette-value
              className="ml-auto font-mono text-[10px] font-bold uppercase tracking-[0.04em]"
            >
              {inherited && effectiveColor
                ? `${clearLabel} · ${effectiveColor}`
                : effectiveColor ?? clearLabel}
            </output>
            {allowClear ? (
              <button
                type="button"
                data-admin-color-palette-clear
                aria-pressed={inherited}
                onClick={() => {
                  setDraft('');
                  if (value !== '') onChange('');
                }}
                className={`h-6 rounded-md border px-1.5 text-[8px] font-semibold transition ${tone === 'dark' ? 'border-white/15 text-white/65 hover:bg-white/10 hover:text-white' : 'border-slate-200 text-slate-600 hover:bg-slate-100 hover:text-slate-900'}`}
              >
                {clearLabel}
              </button>
            ) : null}
          </div>
          <p className={`mb-1.5 mt-2 text-[8px] font-semibold uppercase tracking-[0.08em] ${mutedClasses}`}>
            Hitre izbire
          </p>
          <div
            role="listbox"
            aria-label={`Hitre barvne izbire: ${label}`}
            className="grid grid-cols-6 gap-1.5"
            data-admin-color-palette-grid
          >
            {paletteOptions.map((color, index) => {
              const selected = effectiveColor === color;
              return (
                <button
                  key={color}
                  ref={(node) => { optionRefs.current[index] = node; }}
                  type="button"
                  role="option"
                  aria-selected={selected}
                  aria-label={`${label}: ${color}`}
                  data-admin-color-palette-option={color}
                  data-admin-color-palette-selected={selected || undefined}
                  tabIndex={index === focusIndex ? 0 : -1}
                  onClick={() => {
                    setFocusIndex(index);
                    emitNormalized(color);
                  }}
                  onKeyDown={(event) => movePaletteFocus(event, index)}
                  className={`h-6 w-6 rounded-md border shadow-inner outline-none transition hover:scale-110 focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-1 ${selected ? 'border-blue-300 ring-2 ring-blue-400/70' : tone === 'dark' ? 'border-white/20' : 'border-slate-300'}`}
                  style={{ backgroundColor: color }}
                  title={color}
                />
              );
            })}
          </div>
        </div>,
        document.body
      )
    : null;

  return (
    <div
      ref={rootRef}
      className={`${rootLayoutClasses} ${layout === 'inline' ? inlineToneClasses : ''} ${className}`}
      data-admin-hex-color-field
      data-admin-hex-color-tone={tone}
      data-admin-hex-color-layout={layout}
      data-logo-presentation-control={marker}
    >
      <label htmlFor={inputId} className={`min-w-0 text-[10px] font-medium ${labelClasses}`}>
        {label}
      </label>
      <span className="flex min-w-0 items-center gap-1.5">
        <button
          ref={triggerRef}
          type="button"
          disabled={disabled}
          aria-label={`Odpri barvno paleto: ${label}`}
          aria-haspopup="dialog"
          aria-expanded={paletteOpen}
          aria-controls={popoverId}
          data-admin-color-palette-trigger
          onClick={() => paletteOpen ? closePalette() : openPalette()}
          onKeyDown={(event) => {
            if (event.key !== 'Escape' || !paletteOpen) return;
            event.preventDefault();
            closePalette();
          }}
          className={`h-6 w-6 shrink-0 overflow-hidden rounded-md border shadow-inner outline-none transition hover:scale-105 focus-visible:ring-2 focus-visible:ring-blue-400 disabled:cursor-not-allowed disabled:opacity-45 ${tone === 'dark' ? 'border-white/25' : 'border-slate-300'}`}
          title={`Barvna paleta · ${effectiveColor ?? clearLabel}`}
        >
          <span
            className="block h-full w-full"
            style={effectiveColor ? { backgroundColor: effectiveColor } : transparentSwatchStyle}
            aria-hidden="true"
          />
        </button>
        <input
          {...inputAttributes}
          id={inputId}
          type="text"
          value={draft}
          disabled={disabled}
          data-admin-hex-color-input
          data-logo-hex-color-control={marker}
          onFocus={() => { editingRef.current = true; }}
          onChange={(event) => updateDraft(event.currentTarget.value)}
          onBlur={(event) => {
            editingRef.current = false;
            commit(event.currentTarget.value);
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              commit(event.currentTarget.value);
            } else if (event.key === 'Escape') {
              event.preventDefault();
              event.stopPropagation();
              setDraft(value);
              closePalette();
            }
          }}
          className={`h-7 w-[6.6rem] rounded-md border px-2 font-mono text-[10px] font-semibold uppercase tracking-[0.04em] outline-none transition focus:ring-1 disabled:cursor-not-allowed disabled:opacity-45 ${inputClasses}`}
          aria-label={customInputAriaLabel ?? `${label} (HEX)`}
          placeholder={allowAlpha ? '#RRGGBBAA' : '#RRGGBB'}
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
        />
      </span>
      {palettePopover}
    </div>
  );
}
