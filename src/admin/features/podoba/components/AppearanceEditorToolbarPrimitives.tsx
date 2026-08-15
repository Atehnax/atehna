'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type Ref,
  type RefObject
} from 'react';
import { createPortal } from 'react-dom';
import type { ProductCanvasDevice } from '@/shared/domain/style/productAppearance';
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

export type AppearanceEditorToolbarTone = 'light' | 'dark';
export type AppearanceEditorToolbarPlacement = 'top' | 'bottom';
export type AppearanceEditorToolbarPopoverPlacement =
  | 'inline'
  | AppearanceEditorToolbarPlacement;

export const appearanceEditorDarkGlassFrameClassName =
  'border-white/15 shadow-[0_16px_40px_rgba(30,41,53,0.38),0_3px_12px_rgba(30,41,53,0.28)] backdrop-blur-xl';

export const appearanceEditorToolbarPopoverSurfaceClassName =
  `rounded-xl border bg-black/90 ${appearanceEditorDarkGlassFrameClassName}`;

export const appearanceEditorContextToolbarBaseClassName =
  'w-max max-w-full rounded-xl border p-1 backdrop-blur-xl';

export const appearanceEditorContextToolbarDarkSurfaceClassName =
  `${appearanceEditorContextToolbarBaseClassName} bg-black/90 ${appearanceEditorDarkGlassFrameClassName}`;

const AppearanceEditorToolbarToneContext =
  createContext<AppearanceEditorToolbarTone>('light');
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
