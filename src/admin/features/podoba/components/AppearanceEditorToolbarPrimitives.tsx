'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type Ref,
  type RefObject
} from 'react';
import { createPortal } from 'react-dom';
import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  Check,
  ChevronDown,
  Minus
} from 'lucide-react';
import type { ProductCanvasDevice } from '@/shared/domain/style/productAppearance';
import { useDropdownDismiss } from '@/shared/ui/dropdown/use-dropdown-dismiss';
import { adminControlFocusTokenClasses } from '@/shared/ui/theme/tokens';

const classNames = (...parts: Array<string | false | null | undefined>) =>
  parts.filter(Boolean).join(' ');

type AppearanceEditorNumberInputProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  'defaultValue' | 'onChange' | 'onInput' | 'type' | 'value'
> & {
  value: number;
  onValueChange: (value: number) => void;
};

export function clampAppearanceEditorNumberInput(
  value: number,
  min?: number | string,
  max?: number | string
) {
  const minimum = min === undefined ? Number.NEGATIVE_INFINITY : Number(min);
  const maximum = max === undefined ? Number.POSITIVE_INFINITY : Number(max);
  return Math.min(
    Number.isFinite(maximum) ? maximum : Number.POSITIVE_INFINITY,
    Math.max(
      Number.isFinite(minimum) ? minimum : Number.NEGATIVE_INFINITY,
      value
    )
  );
}

/**
 * Keeps the user's in-progress string separate from the normalized appearance
 * value. Appearance settings often clamp numbers immediately, so binding the
 * input straight to that normalized value makes multi-digit typing jump (for
 * example, an initial `4` can become `8` before the second `4` is entered).
 */
export function AppearanceEditorNumberInput({
  value,
  onValueChange,
  min,
  max,
  onBlur,
  onFocus,
  onKeyDown,
  ...inputProps
}: AppearanceEditorNumberInputProps) {
  const focusedRef = useRef(false);
  const skipNextBlurCommitRef = useRef(false);
  const [draftValue, setDraftValue] = useState(() => String(value));

  useEffect(() => {
    if (!focusedRef.current) setDraftValue(String(value));
  }, [value]);

  const resolveDraft = useCallback((candidate: string) => {
    if (candidate.trim() === '') return null;
    const parsed = Number(candidate);
    if (!Number.isFinite(parsed)) return null;
    return clampAppearanceEditorNumberInput(parsed, min, max);
  }, [max, min]);

  const commitDraft = useCallback((candidate: string) => {
    const nextValue = resolveDraft(candidate);
    if (nextValue === null) {
      setDraftValue(String(value));
      return;
    }
    setDraftValue(String(nextValue));
    onValueChange(nextValue);
  }, [onValueChange, resolveDraft, value]);

  return (
    <input
      {...inputProps}
      type="number"
      min={min}
      max={max}
      value={draftValue}
      onFocus={(event) => {
        focusedRef.current = true;
        onFocus?.(event);
      }}
      onBlur={(event) => {
        if (skipNextBlurCommitRef.current) {
          skipNextBlurCommitRef.current = false;
        } else {
          commitDraft(event.currentTarget.value);
        }
        focusedRef.current = false;
        onBlur?.(event);
      }}
      onChange={(event) => {
        const candidate = event.target.value;
        setDraftValue(candidate);
        const nextValue = resolveDraft(candidate);
        if (nextValue !== null) onValueChange(nextValue);
      }}
      onKeyDown={(event) => {
        onKeyDown?.(event);
        if (event.defaultPrevented) return;
        if (event.key === 'Enter') {
          event.preventDefault();
          commitDraft(event.currentTarget.value);
          skipNextBlurCommitRef.current = true;
          event.currentTarget.blur();
        } else if (event.key === 'Escape') {
          event.preventDefault();
          setDraftValue(String(value));
          skipNextBlurCommitRef.current = true;
          event.currentTarget.blur();
        }
      }}
    />
  );
}

export type AppearanceEditorCompactSelectOption<Value extends string> = {
  value: Value;
  label: string;
  disabled?: boolean;
};

export type AppearanceEditorToolbarTone = 'light' | 'dark';
const AppearanceEditorToolbarToneContext =
  createContext<AppearanceEditorToolbarTone>('light');

/**
 * A themed portal listbox for appearance inspectors. Native option popups
 * ignore the inspector theme on Windows; this keeps every option visible without a
 * nested scroll region and preserves keyboard and focus behaviour.
 */
export function AppearanceEditorCompactSelect<Value extends string>({
  value,
  options,
  onValueChange,
  ariaLabel,
  placeholder = 'Izberite',
  marker,
  testId,
  disabled = false,
  tone,
  className,
  triggerClassName
}: {
  value: Value | '';
  options: readonly AppearanceEditorCompactSelectOption<Value>[];
  onValueChange: (value: Value) => void;
  ariaLabel: string;
  placeholder?: string;
  marker?: string;
  testId?: string;
  disabled?: boolean;
  tone?: AppearanceEditorToolbarTone;
  className?: string;
  triggerClassName?: string;
}) {
  const inheritedTone = useContext(AppearanceEditorToolbarToneContext);
  const resolvedTone = tone ?? inheritedTone;
  const dark = resolvedTone === 'dark';
  const generatedId = useId();
  const listboxId = `${generatedId}-appearance-select`;
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);
  const dismissRefs = useMemo(() => [triggerRef], []);
  const portalRefs = useMemo(() => [listRef], []);
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState({
    left: 0,
    top: 0,
    width: 0,
    columns: options.length > 8 ? 2 : 1,
    ready: false
  });
  const selected = options.find((option) => option.value === value);
  const controlMarker = marker ?? ariaLabel;

  useDropdownDismiss({
    open,
    refs: dismissRefs,
    portalRefs,
    returnFocusRef: triggerRef,
    dismissGroup: 'appearance-compact-select',
    onClose: () => setOpen(false)
  });

  const openListbox = useCallback(() => {
    if (!disabled && options.some((option) => !option.disabled)) {
      setPosition((current) => ({ ...current, ready: false }));
      setOpen(true);
    }
  }, [disabled, options]);

  useLayoutEffect(() => {
    if (!open || !triggerRef.current || !listRef.current) return;
    const trigger = triggerRef.current.getBoundingClientRect();
    const viewportGap = 8;
    const rowsPerColumn = Math.max(1, Math.floor((window.innerHeight - viewportGap * 2 - 12) / 32));
    const columns = Math.min(
      Math.max(1, options.length),
      Math.max(options.length > 8 ? 2 : 1, Math.ceil(options.length / rowsPerColumn))
    );
    const width = Math.min(
      window.innerWidth - viewportGap * 2,
      Math.max(trigger.width, columns * 156, 190)
    );
    listRef.current.style.width = `${width}px`;
    listRef.current.style.gridTemplateColumns = `repeat(${columns}, minmax(0, 1fr))`;
    const list = listRef.current.getBoundingClientRect();
    const left = Math.min(
      Math.max(trigger.left, viewportGap),
      Math.max(viewportGap, window.innerWidth - width - viewportGap)
    );
    const spaceBelow = window.innerHeight - trigger.bottom - viewportGap;
    const top = spaceBelow >= list.height + 6
      ? trigger.bottom + 4
      : Math.max(viewportGap, trigger.top - list.height - 4);
    setPosition({ left, top, width, columns, ready: true });
  }, [open, options.length]);

  useEffect(() => {
    if (!open) return undefined;
    const closeForViewportChange = () => setOpen(false);
    window.addEventListener('resize', closeForViewportChange);
    window.addEventListener('scroll', closeForViewportChange, true);
    return () => {
      window.removeEventListener('resize', closeForViewportChange);
      window.removeEventListener('scroll', closeForViewportChange, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    window.requestAnimationFrame(() => {
      const selectedOption = listRef.current?.querySelector<HTMLButtonElement>(
        '[role="option"][aria-selected="true"]:not(:disabled)'
      );
      const firstOption = listRef.current?.querySelector<HTMLButtonElement>(
        '[role="option"]:not(:disabled)'
      );
      (selectedOption ?? firstOption)?.focus();
    });
  }, [open]);

  return (
    <div className={classNames('min-w-0', className)} data-appearance-editor-compact-select={controlMarker}>
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listboxId}
        data-appearance-editor-compact-select-trigger={controlMarker}
        data-appearance-editor-compact-select-value={value || undefined}
        data-appearance-editor-compact-select-tone={resolvedTone}
        data-testid={testId}
        onClick={() => open ? setOpen(false) : openListbox()}
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown' || event.key === 'ArrowUp' || event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            openListbox();
          } else if (event.key === 'Escape' && open) {
            event.preventDefault();
            event.stopPropagation();
            setOpen(false);
          }
        }}
        className={classNames(
          `flex h-8 w-full min-w-0 items-center justify-between gap-2 rounded-lg border px-2.5 text-left text-[11px] outline-none transition disabled:cursor-not-allowed disabled:opacity-45 ${adminControlFocusTokenClasses}`,
          dark
            ? 'border-white/15 bg-slate-800 font-semibold text-slate-100 hover:border-white/25 hover:bg-slate-700 focus:border-blue-300 focus:ring-1 focus:ring-blue-300/35'
            : 'border-slate-300 bg-white font-normal text-slate-700 hover:border-slate-300 hover:bg-white focus:border-[color:var(--blue-500)] focus:bg-white focus:ring-0',
          triggerClassName
        )}
      >
        <span className={classNames(
          'min-w-0 flex-1 truncate',
          !selected && (dark ? 'text-white/45' : 'text-slate-400')
        )}>
          {selected?.label ?? placeholder}
        </span>
        <ChevronDown className={classNames('h-3.5 w-3.5 shrink-0 transition', open && 'rotate-180')} />
      </button>
      {open && typeof document !== 'undefined' ? createPortal(
        <div
          ref={listRef}
          id={listboxId}
          role="listbox"
          aria-label={ariaLabel}
          data-appearance-editor-compact-select-portal={controlMarker}
          data-appearance-editor-compact-select-columns={position.columns}
          data-appearance-editor-compact-select-tone={resolvedTone}
          className={classNames(
            'fixed z-[2147483647] grid gap-1 border p-1.5',
            dark
              ? 'rounded-xl border-white/15 bg-slate-950/95 text-white shadow-[0_18px_50px_rgba(15,23,42,.55)] backdrop-blur-xl'
              : 'rounded-md border-slate-200 bg-white text-slate-700 shadow-[0_14px_34px_rgba(15,23,42,0.08),0_2px_6px_rgba(15,23,42,0.05)]'
          )}
          style={{
            left: position.left,
            top: position.top,
            width: position.width || undefined,
            gridTemplateColumns: `repeat(${position.columns}, minmax(0, 1fr))`,
            opacity: position.ready ? 1 : 0,
            visibility: position.ready ? 'visible' : 'hidden'
          }}
          onPointerDown={(event) => event.stopPropagation()}
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              event.preventDefault();
              event.stopPropagation();
              setOpen(false);
              triggerRef.current?.focus();
              return;
            }
            if (event.key === 'Tab') {
              setOpen(false);
              return;
            }
            if (!['ArrowDown', 'ArrowUp', 'ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
            const buttons = Array.from(
              listRef.current?.querySelectorAll<HTMLButtonElement>('[role="option"]:not(:disabled)') ?? []
            );
            if (buttons.length === 0) return;
            event.preventDefault();
            const current = buttons.indexOf(document.activeElement as HTMLButtonElement);
            const currentIndex = Math.max(0, current);
            const delta = event.key === 'ArrowDown'
              ? position.columns
              : event.key === 'ArrowUp'
                ? -position.columns
                : event.key === 'ArrowLeft' ? -1 : 1;
            const next = event.key === 'Home'
              ? 0
              : event.key === 'End'
                ? buttons.length - 1
                : (currentIndex + delta + buttons.length) % buttons.length;
            buttons[next]?.focus();
          }}
        >
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              role="option"
              aria-selected={option.value === value}
              data-appearance-editor-compact-select-option={option.value}
              disabled={option.disabled}
              className={classNames(
                'flex h-7 min-w-0 items-center gap-2 px-2 text-left text-[10px] outline-none transition focus-visible:ring-2 disabled:opacity-30',
                dark
                  ? 'rounded-lg font-semibold focus-visible:ring-blue-300'
                  : 'rounded-md font-normal focus-visible:ring-[color:var(--blue-500)]/25',
                dark
                  ? option.value === value
                    ? 'bg-blue-500/30 text-blue-100'
                    : 'text-white/75 hover:bg-white/10 hover:text-white'
                  : option.value === value
                    ? 'bg-[color:var(--hover-neutral)] text-[color:var(--blue-500)]'
                    : 'text-slate-700 hover:bg-[color:var(--hover-neutral)] hover:text-[color:var(--blue-500)]'
              )}
              onClick={() => {
                onValueChange(option.value);
                setOpen(false);
                triggerRef.current?.focus();
              }}
            >
              <Check className={classNames('h-3 w-3 shrink-0', option.value === value ? 'opacity-100' : 'opacity-0')} />
              <span className="truncate">{option.label}</span>
            </button>
          ))}
        </div>,
        document.body
      ) : null}
    </div>
  );
}

export type AppearanceEditorToolbarPlacement = 'top' | 'bottom';
export type AppearanceEditorToolbarPopoverPlacement =
  | 'inline'
  | AppearanceEditorToolbarPlacement;

export type AppearanceEditorAlignment = 'inherit' | 'left' | 'center' | 'right' | 'justify';

const appearanceEditorAlignmentMeta: Record<AppearanceEditorAlignment, {
  label: string;
  icon: typeof AlignLeft;
}> = {
  inherit: { label: 'Samodejno', icon: Minus },
  left: { label: 'Poravnaj levo', icon: AlignLeft },
  center: { label: 'Poravnaj na sredino', icon: AlignCenter },
  right: { label: 'Poravnaj desno', icon: AlignRight },
  justify: { label: 'Obojestranska poravnava', icon: AlignJustify }
};

export function AppearanceEditorAlignmentControl<Value extends AppearanceEditorAlignment>({
  value,
  onValueChange,
  options,
  ariaLabel = 'Poravnava',
  mixed = false,
  tone = 'dark',
  className
}: {
  value: Value;
  onValueChange: (value: Value) => void;
  options: readonly Value[];
  ariaLabel?: string;
  mixed?: boolean;
  tone?: AppearanceEditorToolbarTone;
  className?: string;
}) {
  const dark = tone === 'dark';
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      data-appearance-editor-alignment-control
      data-appearance-editor-alignment-mixed={mixed || undefined}
      className={classNames(
        'inline-flex h-8 min-w-0 items-center gap-0.5 rounded-lg border p-0.5',
        dark ? 'border-white/15 bg-white/5' : 'border-slate-200 bg-slate-100/80',
        className
      )}
    >
      {options.map((option) => {
        const meta = appearanceEditorAlignmentMeta[option];
        const Icon = meta.icon;
        const active = !mixed && option === value;
        return (
          <button
            key={option}
            type="button"
            title={meta.label}
            aria-label={meta.label}
            role="radio"
            aria-checked={active}
            tabIndex={active || (mixed && option === options[0]) ? 0 : -1}
            data-appearance-editor-alignment={option}
            onClick={() => onValueChange(option)}
            onKeyDown={(event) => {
              if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(event.key)) return;
              event.preventDefault();
              const currentIndex = options.indexOf(option);
              const nextIndex = event.key === 'Home'
                ? 0
                : event.key === 'End'
                  ? options.length - 1
                  : (currentIndex + (event.key === 'ArrowLeft' || event.key === 'ArrowUp' ? -1 : 1) + options.length) % options.length;
              const nextValue = options[nextIndex];
              if (!nextValue) return;
              onValueChange(nextValue);
              const radios = event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('[role="radio"]');
              window.requestAnimationFrame(() => radios?.[nextIndex]?.focus());
            }}
            className={classNames(
              `grid h-6 min-w-6 flex-1 place-items-center rounded-md px-1.5 transition ${adminControlFocusTokenClasses}`,
              dark
                ? active ? 'bg-white/20 text-white shadow-sm' : 'text-white/55 hover:bg-white/10 hover:text-white'
                : active ? 'bg-white text-[color:var(--blue-600)] shadow-sm' : 'text-slate-500 hover:bg-white/70 hover:text-slate-800'
            )}
          >
            <Icon className="h-3.5 w-3.5" />
          </button>
        );
      })}
    </div>
  );
}

export const appearanceEditorDarkGlassFrameClassName =
  'border-white/15 shadow-[0_16px_40px_rgba(30,41,53,0.38),0_3px_12px_rgba(30,41,53,0.28)] backdrop-blur-xl';

export const appearanceEditorToolbarPopoverSurfaceClassName =
  `rounded-xl border bg-black/90 ${appearanceEditorDarkGlassFrameClassName}`;

export const appearanceEditorContextToolbarBaseClassName =
  'w-max max-w-full rounded-xl border p-1 backdrop-blur-xl';

export const appearanceEditorContextToolbarDarkSurfaceClassName =
  `${appearanceEditorContextToolbarBaseClassName} bg-black/90 ${appearanceEditorDarkGlassFrameClassName}`;

const AppearanceEditorToolbarPlacementContext =
  createContext<AppearanceEditorToolbarPopoverPlacement>('inline');

export function AppearanceEditorToolbarToneProvider({
  tone,
  children
}: {
  tone: AppearanceEditorToolbarTone;
  children: ReactNode;
}) {
  return (
    <AppearanceEditorToolbarToneContext.Provider value={tone}>
      {children}
    </AppearanceEditorToolbarToneContext.Provider>
  );
}

export function useAppearanceEditorToolbarPlacement() {
  return useContext(AppearanceEditorToolbarPlacementContext);
}


export type AppearanceEditorToolbarPopoverSize = 'compact' | 'wide';

export type AppearanceEditorToolbarPopoverPositionInput = {
  anchorRect: Pick<DOMRectReadOnly, 'bottom' | 'left' | 'top'>;
  panelSize: { height: number; width: number };
  viewportRect: { height: number; left: number; top: number; width: number };
  preferredPlacement: AppearanceEditorToolbarPlacement;
  gapPx?: number;
  marginPx?: number;
};

export type AppearanceEditorToolbarPopoverPosition = {
  left: number;
  top: number;
  placement: AppearanceEditorToolbarPlacement;
};

const appearanceEditorToolbarPopoverGapPx = 6;
const appearanceEditorToolbarPopoverMarginPx = 8;

export function resolveAppearanceEditorToolbarPopoverPosition({
  anchorRect,
  panelSize,
  viewportRect,
  preferredPlacement,
  gapPx = appearanceEditorToolbarPopoverGapPx,
  marginPx = appearanceEditorToolbarPopoverMarginPx
}: AppearanceEditorToolbarPopoverPositionInput): AppearanceEditorToolbarPopoverPosition {
  const panelWidth = Math.max(1, panelSize.width);
  const panelHeight = Math.max(1, panelSize.height);
  const viewportRight = viewportRect.left + Math.max(1, viewportRect.width);
  const viewportBottom = viewportRect.top + Math.max(1, viewportRect.height);
  const minimumLeft = viewportRect.left + marginPx;
  const maximumLeft = Math.max(minimumLeft, viewportRight - panelWidth - marginPx);
  const minimumTop = viewportRect.top + marginPx;
  const maximumTop = Math.max(minimumTop, viewportBottom - panelHeight - marginPx);
  const availableTop = Math.max(0, anchorRect.top - gapPx - minimumTop);
  const availableBottom = Math.max(0, viewportBottom - marginPx - anchorRect.bottom - gapPx);
  const alternatePlacement = preferredPlacement === 'top' ? 'bottom' : 'top';
  const availableByPlacement = {
    top: availableTop,
    bottom: availableBottom
  } satisfies Record<AppearanceEditorToolbarPlacement, number>;
  const placement = availableByPlacement[preferredPlacement] >= panelHeight
    || availableByPlacement[preferredPlacement] >= availableByPlacement[alternatePlacement]
    ? preferredPlacement
    : alternatePlacement;
  const requestedTop = placement === 'top'
    ? anchorRect.top - gapPx - panelHeight
    : anchorRect.bottom + gapPx;

  return {
    left: Math.round(Math.min(Math.max(anchorRect.left, minimumLeft), maximumLeft)),
    top: Math.round(Math.min(Math.max(requestedTop, minimumTop), maximumTop)),
    placement
  };
}

export type AppearanceEditorToolbarPopoverProps = {
  children: ReactNode;
  ariaLabel: string;
  size?: AppearanceEditorToolbarPopoverSize;
  className?: string;
};

/**
 * A compact settings surface anchored to its parent toolbar. It measures its
 * own content before choosing a side, clamps itself to the visual viewport and
 * only introduces internal vertical scrolling when the viewport is too short.
 */
export function AppearanceEditorToolbarPopover({
  children,
  ariaLabel,
  size = 'compact',
  className
}: AppearanceEditorToolbarPopoverProps) {
  const toolbarPlacement = useAppearanceEditorToolbarPlacement();
  const preferredPlacement: AppearanceEditorToolbarPlacement = toolbarPlacement === 'top'
    ? 'top'
    : 'bottom';
  const panelRef = useRef<HTMLDivElement | null>(null);
  const scheduledFrameRef = useRef<number | null>(null);
  const [position, setPosition] = useState<AppearanceEditorToolbarPopoverPosition & {
    maxHeight: number | null;
    ready: boolean;
  }>({
    left: 0,
    top: 0,
    placement: preferredPlacement,
    maxHeight: null,
    ready: false
  });

  const updatePosition = useCallback(() => {
    const panel = panelRef.current;
    const anchor = panel?.parentElement;
    if (!panel || !anchor || typeof window === 'undefined') return;

    const anchorRect = anchor.getBoundingClientRect();
    const panelRect = panel.getBoundingClientRect();
    const visualViewport = window.visualViewport;
    const viewportRect = {
      left: visualViewport?.offsetLeft ?? 0,
      top: visualViewport?.offsetTop ?? 0,
      width: visualViewport?.width ?? window.innerWidth,
      height: visualViewport?.height ?? window.innerHeight
    };
    const preferredAvailableHeight = preferredPlacement === 'top'
      ? anchorRect.top - appearanceEditorToolbarPopoverGapPx
        - (viewportRect.top + appearanceEditorToolbarPopoverMarginPx)
      : viewportRect.top + viewportRect.height - appearanceEditorToolbarPopoverMarginPx
        - anchorRect.bottom - appearanceEditorToolbarPopoverGapPx;
    const constrainedPanelHeight = Math.max(
      1,
      Math.min(panelRect.height, preferredAvailableHeight)
    );
    const viewportPosition = resolveAppearanceEditorToolbarPopoverPosition({
      anchorRect,
      panelSize: { width: panelRect.width, height: constrainedPanelHeight },
      viewportRect,
      preferredPlacement
    });
    const availableHeight = viewportPosition.placement === 'top'
      ? anchorRect.top - appearanceEditorToolbarPopoverGapPx
        - (viewportRect.top + appearanceEditorToolbarPopoverMarginPx)
      : viewportRect.top + viewportRect.height - appearanceEditorToolbarPopoverMarginPx
        - anchorRect.bottom - appearanceEditorToolbarPopoverGapPx;
    const offsetParent = panel.offsetParent instanceof HTMLElement ? panel.offsetParent : null;
    const offsetParentRect = offsetParent?.getBoundingClientRect();
    const nextPosition = {
      left: viewportPosition.left - (offsetParentRect?.left ?? 0) + (offsetParent?.scrollLeft ?? 0),
      top: viewportPosition.top - (offsetParentRect?.top ?? 0) + (offsetParent?.scrollTop ?? 0),
      placement: viewportPosition.placement,
      maxHeight: Math.max(
        1,
        Math.min(
          viewportRect.height - appearanceEditorToolbarPopoverMarginPx * 2,
          availableHeight
        )
      ),
      ready: true
    };

    setPosition((current) => (
      Math.abs(current.left - nextPosition.left) < 0.5
      && Math.abs(current.top - nextPosition.top) < 0.5
      && current.placement === nextPosition.placement
      && current.maxHeight === nextPosition.maxHeight
      && current.ready === nextPosition.ready
        ? current
        : nextPosition
    ));
  }, [preferredPlacement]);

  const schedulePosition = useCallback(() => {
    if (scheduledFrameRef.current !== null || typeof window === 'undefined') return;
    scheduledFrameRef.current = window.requestAnimationFrame(() => {
      scheduledFrameRef.current = null;
      updatePosition();
    });
  }, [updatePosition]);

  useLayoutEffect(() => {
    const panel = panelRef.current;
    const anchor = panel?.parentElement;
    if (!panel || !anchor || typeof window === 'undefined') return undefined;

    updatePosition();
    const observer = typeof ResizeObserver === 'undefined'
      ? null
      : new ResizeObserver(schedulePosition);
    observer?.observe(anchor);
    observer?.observe(panel);
    window.addEventListener('resize', schedulePosition);
    window.addEventListener('scroll', schedulePosition, true);
    window.visualViewport?.addEventListener('resize', schedulePosition);
    window.visualViewport?.addEventListener('scroll', schedulePosition);
    schedulePosition();

    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', schedulePosition);
      window.removeEventListener('scroll', schedulePosition, true);
      window.visualViewport?.removeEventListener('resize', schedulePosition);
      window.visualViewport?.removeEventListener('scroll', schedulePosition);
      if (scheduledFrameRef.current !== null) {
        window.cancelAnimationFrame(scheduledFrameRef.current);
        scheduledFrameRef.current = null;
      }
    };
  }, [schedulePosition, size, updatePosition]);

  return (
    <div
      ref={panelRef}
      role="dialog"
      aria-label={ariaLabel}
      aria-modal="false"
      data-appearance-editor-toolbar-popover
      data-appearance-editor-toolbar-popover-size={size}
      data-appearance-editor-toolbar-popover-placement={position.placement}
      data-appearance-editor-toolbar-popover-preferred-placement={preferredPlacement}
      data-appearance-editor-toolbar-popover-ready={position.ready ? 'true' : 'false'}
      data-appearance-editor-settings-surface
      data-settings-scroll="internal"
      className={classNames(
        appearanceEditorToolbarPopoverSurfaceClassName,
        'absolute z-[220] overflow-x-hidden overflow-y-auto overscroll-contain p-2 text-left',
        size === 'wide'
          ? 'w-[min(440px,calc(100dvw-16px))]'
          : 'w-[min(360px,calc(100dvw-16px))]',
        className
      )}
      style={{
        left: position.left,
        top: position.top,
        maxHeight: position.maxHeight ?? 'calc(100dvh - 16px)',
        opacity: position.ready ? 1 : 0,
        visibility: position.ready ? 'visible' : 'hidden',
        pointerEvents: position.ready ? 'auto' : 'none'
      }}
    >
      {children}
    </div>
  );
}

export type AppearanceEditorToolbarButtonProps = Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  'aria-label' | 'aria-pressed' | 'children' | 'popover' | 'title'
> & {
  label: string;
  title?: string;
  children: ReactNode;
  tone?: AppearanceEditorToolbarTone;
  active?: boolean;
  danger?: boolean;
  popover?: boolean;
  pressed?: boolean;
  testId?: string;
};

export function AppearanceEditorToolbarButton({
  label,
  title,
  children,
  tone: explicitTone,
  active = false,
  danger = false,
  popover = false,
  pressed,
  testId,
  className,
  ...buttonProps
}: AppearanceEditorToolbarButtonProps) {
  const inheritedTone = useContext(AppearanceEditorToolbarToneContext);
  const tone = explicitTone ?? inheritedTone;
  const dark = tone === 'dark';

  return (
    <button
      type="button"
      {...buttonProps}
      aria-label={label}
      title={title ?? label}
      data-testid={testId}
      data-active={active || undefined}
      aria-haspopup={popover ? 'dialog' : undefined}
      aria-expanded={popover ? active : undefined}
      aria-pressed={pressed}
      className={classNames(
        `grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-transparent transition disabled:cursor-not-allowed disabled:opacity-35 ${adminControlFocusTokenClasses}`,
        dark
          ? active
            ? 'bg-white/20 text-white shadow-[inset_0_0_0_1px_rgba(255,255,255,0.2)]'
            : danger
              ? 'bg-transparent text-rose-200 hover:bg-rose-500/20 hover:text-rose-100'
              : 'bg-transparent text-white/80 hover:bg-white/15 hover:text-white'
          : active
            ? 'bg-[color:var(--blue-50)] text-[color:var(--blue-600)] shadow-[inset_0_0_0_1px_rgba(37,99,235,0.16)]'
            : danger
              ? 'bg-transparent text-rose-600 hover:bg-rose-50 hover:text-rose-700'
              : 'bg-transparent text-slate-600 hover:bg-slate-100/80 hover:text-[color:var(--blue-600)]',
        className
      )}
    >
      {children}
    </button>
  );
}

export function AppearanceEditorToolbarDivider({
  tone: explicitTone,
  className
}: {
  tone?: AppearanceEditorToolbarTone;
  className?: string;
}) {
  const inheritedTone = useContext(AppearanceEditorToolbarToneContext);
  const tone = explicitTone ?? inheritedTone;

  return (
    <span
      className={classNames(
        'mx-1 h-5 w-px shrink-0',
        tone === 'dark' ? 'bg-white/20' : 'bg-slate-200',
        className
      )}
      aria-hidden="true"
    />
  );
}

export function AppearanceEditorPreviewDeviceIcon({
  device,
  className = 'h-4 w-4'
}: {
  device: ProductCanvasDevice;
  className?: string;
}) {
  if (device === 'mobile') {
    return (
      <svg
        viewBox="0 0 20 20"
        className={className}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        aria-hidden="true"
      >
        <rect x="6.5" y="2.5" width="7" height="15" rx="1.5" />
        <path d="M9 15.5h2" />
      </svg>
    );
  }

  if (device === 'tablet') {
    return (
      <svg
        viewBox="0 0 20 20"
        className={className}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        aria-hidden="true"
      >
        <rect x="4.5" y="3" width="11" height="14" rx="1.7" />
        <path d="M9 14.5h2" />
      </svg>
    );
  }

  return (
    <svg
      viewBox="0 0 20 20"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      aria-hidden="true"
    >
      <rect x="3" y="4" width="14" height="10" rx="1.5" />
      <path d="M8 17h4M10 14v3" />
    </svg>
  );
}

export type AppearanceEditorToolbarAnchorResolver = (
  viewport: HTMLElement,
  anchorId: string
) => HTMLElement | null;

const appearanceEditorAnchorAttributes = [
  'data-appearance-editor-anchor-id',
  'data-product-canvas-element',
  'data-product-canvas-element-id',
  'data-canvas-element-id'
] as const;

export const findAppearanceEditorToolbarAnchor: AppearanceEditorToolbarAnchorResolver = (
  viewport,
  anchorId
) => {
  const selector = appearanceEditorAnchorAttributes
    .map((attribute) => `[${attribute}]`)
    .join(', ');

  const matches = Array.from(viewport.querySelectorAll<HTMLElement>(selector)).filter((element) =>
    appearanceEditorAnchorAttributes.some(
      (attribute) => element.getAttribute(attribute) === anchorId
    )
  );

  return matches.find((element) => (
    element.getAttribute('data-product-canvas-selected') === 'true'
    || element.getAttribute('data-canvas-element-selected') === 'true'
  ))
    ?? matches[0]
    ?? null;
};

type AppearanceEditorToolbarPosition = {
  left: number;
  top: number;
  maxWidth: number;
  placement: AppearanceEditorToolbarPlacement;
  ready: boolean;
};

function assignRef<T>(ref: Ref<T> | undefined, value: T | null) {
  if (typeof ref === 'function') {
    ref(value);
    return;
  }
  if (ref) ref.current = value;
}

export type FloatingAppearanceEditorContextToolbarProps = {
  anchorId: string | null;
  frameRef: RefObject<HTMLElement | null>;
  viewportRef: RefObject<HTMLElement | null>;
  scrollRegionRef?: RefObject<HTMLElement | null>;
  toolbarRef?: Ref<HTMLDivElement>;
  resolveAnchor?: AppearanceEditorToolbarAnchorResolver;
  transitioning?: boolean;
  edgeGapPx?: number;
  anchorGapPx?: number;
  ariaLabel?: string;
  testId?: string;
  className?: string;
  onDismiss?: () => void;
  children: ReactNode;
};

export function FloatingAppearanceEditorContextToolbar({
  anchorId,
  frameRef,
  viewportRef,
  scrollRegionRef,
  toolbarRef,
  resolveAnchor = findAppearanceEditorToolbarAnchor,
  transitioning = false,
  edgeGapPx = 8,
  anchorGapPx = 8,
  ariaLabel = 'Orodna vrstica izbranega elementa',
  testId = 'appearance-editor-context-toolbar',
  className,
  onDismiss,
  children
}: FloatingAppearanceEditorContextToolbarProps) {
  const toolbarElementRef = useRef<HTMLDivElement | null>(null);
  const scheduledFrameRef = useRef<number | null>(null);
  const [portalReady, setPortalReady] = useState(false);
  const [toolbarMounted, setToolbarMounted] = useState(false);
  const [position, setPosition] = useState<AppearanceEditorToolbarPosition>({
    left: 0,
    top: 0,
    maxWidth: 0,
    placement: 'bottom',
    ready: false
  });

  const setToolbarElement = useCallback((element: HTMLDivElement | null) => {
    toolbarElementRef.current = element;
    assignRef(toolbarRef, element);
    if (element) setToolbarMounted(true);
  }, [toolbarRef]);

  const updatePosition = useCallback(() => {
    const frame = frameRef.current;
    const viewport = viewportRef.current;
    const toolbar = toolbarElementRef.current;
    if (!anchorId || !frame || !viewport || !toolbar) return;

    const frameRect = frame.getBoundingClientRect();
    if (frameRect.width <= 0 || frameRect.height <= 0) return;

    const anchor = resolveAnchor(viewport, anchorId);
    const anchorRect = anchor?.getBoundingClientRect() ?? null;
    if (!anchorRect) {
      setPosition((current) => current.ready ? { ...current, ready: false } : current);
      return;
    }

    const boundsLeft = Math.max(frameRect.left, edgeGapPx);
    const boundsRight = Math.min(frameRect.right, window.innerWidth - edgeGapPx);
    const boundsTop = Math.max(frameRect.top, edgeGapPx);
    const boundsBottom = Math.min(frameRect.bottom, window.innerHeight - edgeGapPx);
    const maxWidth = Math.max(1, boundsRight - boundsLeft - edgeGapPx * 2);
    const toolbarWidth = Math.min(Math.max(1, toolbar.scrollWidth), maxWidth);
    const toolbarHeight = Math.max(1, toolbar.getBoundingClientRect().height);

    if (
      anchorRect.right <= boundsLeft
      || anchorRect.left >= boundsRight
      || anchorRect.bottom <= boundsTop
      || anchorRect.top >= boundsBottom
    ) {
      setPosition((current) => current.ready ? { ...current, ready: false } : current);
      return;
    }

    const availableAbove = anchorRect.top - boundsTop;
    const availableBelow = boundsBottom - anchorRect.bottom;
    const requiredSpace = toolbarHeight + anchorGapPx + edgeGapPx;
    const placement: AppearanceEditorToolbarPlacement = availableAbove >= requiredSpace
      ? 'top'
      : availableBelow >= requiredSpace
        ? 'bottom'
        : availableAbove >= availableBelow ? 'top' : 'bottom';
    const toolbarLeft = anchorRect.left + (anchorRect.width - toolbarWidth) / 2;
    const toolbarTop = placement === 'top'
      ? anchorRect.top - toolbarHeight - anchorGapPx
      : anchorRect.bottom + anchorGapPx;

    const minimumLeft = boundsLeft + edgeGapPx;
    const maximumLeft = boundsRight - toolbarWidth - edgeGapPx;
    const minimumTop = boundsTop + edgeGapPx;
    const maximumTop = boundsBottom - toolbarHeight - edgeGapPx;
    const nextPosition = {
      left: Math.round(
        Math.min(Math.max(toolbarLeft, minimumLeft), Math.max(minimumLeft, maximumLeft))
      ),
      top: Math.round(
        Math.min(Math.max(toolbarTop, minimumTop), Math.max(minimumTop, maximumTop))
      ),
      maxWidth: Math.round(maxWidth),
      placement,
      ready: true
    } satisfies AppearanceEditorToolbarPosition;

    setPosition((current) => (
      current.left === nextPosition.left
      && current.top === nextPosition.top
      && current.maxWidth === nextPosition.maxWidth
      && current.placement === nextPosition.placement
      && current.ready === nextPosition.ready
        ? current
        : nextPosition
    ));
  }, [
    anchorGapPx,
    anchorId,
    edgeGapPx,
    frameRef,
    resolveAnchor,
    viewportRef
  ]);

  const schedulePosition = useCallback(() => {
    if (scheduledFrameRef.current !== null) return;
    scheduledFrameRef.current = window.requestAnimationFrame(() => {
      scheduledFrameRef.current = null;
      updatePosition();
    });
  }, [updatePosition]);

  useLayoutEffect(() => {
    if (!portalReady || !toolbarMounted) return;
    if (scheduledFrameRef.current !== null) {
      window.cancelAnimationFrame(scheduledFrameRef.current);
      scheduledFrameRef.current = null;
    }
    updatePosition();
    return () => {
      if (scheduledFrameRef.current !== null) {
        window.cancelAnimationFrame(scheduledFrameRef.current);
        scheduledFrameRef.current = null;
      }
    };
  }, [children, portalReady, toolbarMounted, updatePosition]);

  useEffect(() => {
    setPortalReady(true);
  }, []);

  useEffect(() => {
    const frame = frameRef.current;
    const viewport = viewportRef.current;
    const toolbar = toolbarElementRef.current;
    const scrollRegion = scrollRegionRef?.current;
    if (
      !anchorId
      || !portalReady
      || !toolbarMounted
      || !frame
      || !viewport
      || !toolbar
    ) {
      return undefined;
    }

    const resizeObserver = typeof ResizeObserver === 'undefined'
      ? null
      : new ResizeObserver(schedulePosition);
    const observeCurrentTargets = () => {
      resizeObserver?.disconnect();
      resizeObserver?.observe(frame);
      resizeObserver?.observe(viewport);
      resizeObserver?.observe(toolbar);
      const currentAnchor = resolveAnchor(viewport, anchorId);
      if (currentAnchor) resizeObserver?.observe(currentAnchor);
    };
    observeCurrentTargets();

    const mutationObserver = typeof MutationObserver === 'undefined'
      ? null
      : new MutationObserver(() => {
        observeCurrentTargets();
        schedulePosition();
      });
    mutationObserver?.observe(viewport, {
      attributes: true,
      childList: true,
      subtree: true,
      attributeFilter: [
        'style',
        'class',
        'data-canvas-element-selected',
        'data-product-canvas-selected',
        ...appearanceEditorAnchorAttributes
      ]
    });

    scrollRegion?.addEventListener('scroll', schedulePosition, { passive: true });
    viewport.addEventListener('pointermove', schedulePosition, { passive: true });
    window.addEventListener('resize', schedulePosition);
    window.addEventListener('scroll', schedulePosition, true);
    window.visualViewport?.addEventListener('resize', schedulePosition);
    window.visualViewport?.addEventListener('scroll', schedulePosition);
    schedulePosition();

    return () => {
      resizeObserver?.disconnect();
      mutationObserver?.disconnect();
      scrollRegion?.removeEventListener('scroll', schedulePosition);
      viewport.removeEventListener('pointermove', schedulePosition);
      window.removeEventListener('resize', schedulePosition);
      window.removeEventListener('scroll', schedulePosition, true);
      window.visualViewport?.removeEventListener('resize', schedulePosition);
      window.visualViewport?.removeEventListener('scroll', schedulePosition);
    };
  }, [
    anchorId,
    frameRef,
    portalReady,
    resolveAnchor,
    schedulePosition,
    scrollRegionRef,
    toolbarMounted,
    viewportRef
  ]);

  useEffect(() => {
    if (!anchorId || !portalReady || !toolbarMounted || position.ready) return undefined;

    let attempts = 0;
    let retryTimer = 0;
    const retryUntilMeasured = () => {
      updatePosition();
      attempts += 1;
      if (attempts < 40) retryTimer = window.setTimeout(retryUntilMeasured, 50);
    };
    retryUntilMeasured();

    return () => window.clearTimeout(retryTimer);
  }, [
    anchorId,
    portalReady,
    position.ready,
    toolbarMounted,
    updatePosition
  ]);

  useEffect(() => {
    if (!anchorId || !portalReady || !toolbarMounted) return undefined;
    if (!transitioning) {
      schedulePosition();
      return undefined;
    }

    let animationFrame = 0;
    const followTransition = () => {
      updatePosition();
      animationFrame = window.requestAnimationFrame(followTransition);
    };
    animationFrame = window.requestAnimationFrame(followTransition);
    return () => window.cancelAnimationFrame(animationFrame);
  }, [
    anchorId,
    portalReady,
    schedulePosition,
    toolbarMounted,
    transitioning,
    updatePosition
  ]);

  useEffect(() => () => {
    if (scheduledFrameRef.current !== null) {
      window.cancelAnimationFrame(scheduledFrameRef.current);
      scheduledFrameRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!anchorId || !portalReady || !toolbarMounted || !onDismiss) return undefined;

    const dismissOutside = (event: PointerEvent) => {
      const target = event.target;
      const viewport = viewportRef.current;
      const toolbar = toolbarElementRef.current;
      const anchor = viewport ? resolveAnchor(viewport, anchorId) : null;
      const node = target instanceof Node ? target : null;
      if (
        !node
        || toolbar?.contains(node)
        || anchor?.contains(node)
      ) {
        return;
      }
      const element = target instanceof Element ? target : null;
      if (element?.closest(
        '[data-product-canvas-element], [data-product-appearance-layers-panel], [data-product-preview-controls], [data-product-page-controls], [data-product-page-toolbar], [data-admin-color-palette-portal], [data-appearance-editor-compact-select-portal]'
      )) {
        return;
      }
      onDismiss();
    };

    window.addEventListener('pointerdown', dismissOutside, true);
    return () => window.removeEventListener('pointerdown', dismissOutside, true);
  }, [
    anchorId,
    onDismiss,
    portalReady,
    resolveAnchor,
    toolbarMounted,
    viewportRef
  ]);

  if (!anchorId || !portalReady || typeof document === 'undefined') return null;

  return createPortal(
    <div
      ref={setToolbarElement}
      data-testid={testId}
      data-toolbar-anchor-id={anchorId}
      data-product-toolbar-anchor-id={anchorId}
      data-toolbar-placement={position.placement}
      data-toolbar-ready={position.ready ? 'true' : 'false'}
      data-toolbar-mode="floating"
      role="toolbar"
      aria-label={ariaLabel}
      className={classNames(
        appearanceEditorContextToolbarDarkSurfaceClassName,
        'fixed z-[200] transition-[opacity,box-shadow] duration-150',
        className
      )}
      style={{
        left: position.left,
        top: position.top,
        maxWidth: position.maxWidth > 0 ? position.maxWidth : undefined,
        opacity: position.ready ? 1 : 0,
        visibility: position.ready ? 'visible' : 'hidden',
        pointerEvents: position.ready ? 'auto' : 'none'
      }}
    >
      <AppearanceEditorToolbarPlacementContext.Provider value={position.placement}>
        {children}
      </AppearanceEditorToolbarPlacementContext.Provider>
    </div>,
    document.body
  );
}
