'use client';

import {
  Fragment,
  useRef,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode
} from 'react';
import {
  PRODUCT_PRIMARY_ACTION_MIN_HEIGHT_PX,
  PRODUCT_PRIMARY_ACTION_MIN_WIDTH_PX,
  type ProductCanvasElementDeviceSettings,
  type ProductCanvasShadow
} from '@/shared/domain/style/productAppearance';
import CanvasHiddenElementFlag from '@/shared/ui/product-canvas/CanvasHiddenElementFlag';

const shadowBySize: Record<ProductCanvasShadow, string> = {
  none: 'none',
  sm: '0 2px 8px rgba(15, 23, 42, 0.08)',
  md: '0 10px 28px rgba(15, 23, 42, 0.12)',
  lg: '0 20px 48px rgba(15, 23, 42, 0.18)'
};

type Interaction = {
  kind: 'move' | 'resize-width' | 'resize-height' | 'resize-both';
  pointerId: number;
  startClientX: number;
  startClientY: number;
  startOffsetX: number;
  startOffsetY: number;
  startWidth: number;
  startHeight: number;
  moved: boolean;
};

export type ProductCanvasResizeAxis = 'width' | 'height' | 'both';

export function getProductCanvasElementResizeMinimums(elementId: string) {
  return elementId === 'product-primary-action'
    ? {
        minimumWidth: PRODUCT_PRIMARY_ACTION_MIN_WIDTH_PX,
        minimumHeight: PRODUCT_PRIMARY_ACTION_MIN_HEIGHT_PX
      }
    : { minimumWidth: 24, minimumHeight: 24 };
}

export function resolveProductCanvasResize({
  startWidth,
  startHeight,
  nextWidth,
  nextHeight,
  axis,
  aspectRatioLocked,
  minimumWidth = 24,
  minimumHeight = 24
}: {
  startWidth: number;
  startHeight: number;
  nextWidth: number;
  nextHeight: number;
  axis: ProductCanvasResizeAxis;
  aspectRatioLocked: boolean;
  minimumWidth?: number;
  minimumHeight?: number;
}): Partial<
  Pick<ProductCanvasElementDeviceSettings, 'widthPx' | 'heightPx'>
> {
  const safeMinimumWidth = Math.max(24, minimumWidth);
  const safeMinimumHeight = Math.max(24, minimumHeight);
  const safeStartWidth = Math.max(24, startWidth);
  const safeStartHeight = Math.max(24, startHeight);
  const safeNextWidth = Math.max(safeMinimumWidth, nextWidth);
  const safeNextHeight = Math.max(safeMinimumHeight, nextHeight);

  if (!aspectRatioLocked) {
    if (axis === 'width') return { widthPx: Math.round(safeNextWidth) };
    if (axis === 'height') return { heightPx: Math.round(safeNextHeight) };
    return {
      widthPx: Math.round(safeNextWidth),
      heightPx: Math.round(safeNextHeight)
    };
  }

  const ratio = safeStartWidth / safeStartHeight;
  if (axis === 'height') {
    const heightPx = Math.max(
      safeMinimumHeight,
      Math.ceil(safeMinimumWidth / ratio),
      Math.round(nextHeight)
    );
    return {
      widthPx: Math.max(safeMinimumWidth, Math.round(heightPx * ratio)),
      heightPx
    };
  }
  if (axis === 'width') {
    const widthPx = Math.max(
      safeMinimumWidth,
      Math.ceil(safeMinimumHeight * ratio),
      Math.round(nextWidth)
    );
    return {
      widthPx,
      heightPx: Math.max(safeMinimumHeight, Math.round(widthPx / ratio))
    };
  }

  const widthScale = Math.max(24, nextWidth) / safeStartWidth;
  const heightScale = Math.max(24, nextHeight) / safeStartHeight;
  const requestedScale = Math.abs(widthScale - 1) >= Math.abs(heightScale - 1)
    ? widthScale
    : heightScale;
  const scale = Math.max(
    requestedScale,
    safeMinimumWidth / safeStartWidth,
    safeMinimumHeight / safeStartHeight
  );
  return {
    widthPx: Math.max(
      safeMinimumWidth,
      Math.round(safeStartWidth * scale)
    ),
    heightPx: Math.max(
      safeMinimumHeight,
      Math.round(safeStartHeight * scale)
    )
  };
}

export const PRODUCT_CANVAS_PROTECTED_ELEMENT_IDS = new Set([
  'product-purchase',
  'product-price',
  'product-primary-action',
  'cart-summary',
  'cart-primary-action'
]);

export function getProductCanvasElementStyle(
  settings: ProductCanvasElementDeviceSettings,
  active = true
): CSSProperties {
  if (!active) return {};
  return {
    position: settings.zIndex !== 0 ? 'relative' : undefined,
    boxSizing: 'border-box',
    minWidth: 0,
    maxWidth: '100%',
    transform: settings.offsetXPx !== 0 || settings.offsetYPx !== 0
      ? `translate3d(${settings.offsetXPx}px, ${settings.offsetYPx}px, 0)`
      : undefined,
    width: settings.widthPx > 0 ? `${settings.widthPx}px` : undefined,
    height: settings.heightPx > 0 ? `${settings.heightPx}px` : undefined,
    paddingTop: settings.paddingTopPx,
    paddingRight: settings.paddingRightPx,
    paddingBottom: settings.paddingBottomPx,
    paddingLeft: settings.paddingLeftPx,
    marginTop: settings.marginTopPx,
    marginRight: settings.marginRightPx,
    marginBottom: settings.marginBottomPx,
    marginLeft: settings.marginLeftPx,
    zIndex: settings.zIndex !== 0 ? settings.zIndex : undefined,
    opacity: settings.opacity,
    color: settings.color || undefined,
    backgroundColor: settings.backgroundColor || undefined,
    borderColor: settings.borderColor || undefined,
    borderStyle: settings.borderWidthPx > 0 ? 'solid' : undefined,
    borderWidth: settings.borderWidthPx,
    borderRadius: settings.borderRadiusPx,
    boxShadow: shadowBySize[settings.shadow],
    fontFamily: settings.fontFamily || undefined,
    fontSize: settings.fontSizePx > 0 ? `${settings.fontSizePx}px` : undefined,
    lineHeight: settings.lineHeight > 0 ? settings.lineHeight : undefined,
    letterSpacing: settings.letterSpacingPx !== 0 ? `${settings.letterSpacingPx}px` : undefined,
    fontWeight: settings.fontWeight > 0 ? settings.fontWeight : undefined,
    textAlign: settings.textAlign === 'inherit' ? undefined : settings.textAlign
  };
}

export default function ProductCanvasElement({
  elementId,
  label,
  settings,
  active = true,
  interactive = false,
  selected = false,
  forceVisible = false,
  gridSizePx = 8,
  snapToGrid = true,
  scale = 1,
  className = '',
  onSelect,
  onChange,
  children
}: {
  elementId: string;
  label: string;
  settings: ProductCanvasElementDeviceSettings;
  active?: boolean;
  interactive?: boolean;
  selected?: boolean;
  forceVisible?: boolean;
  gridSizePx?: number;
  snapToGrid?: boolean;
  scale?: number;
  className?: string;
  onSelect?: (elementId: string) => void;
  onChange?: (
    elementId: string,
    updates: Partial<ProductCanvasElementDeviceSettings>
  ) => void;
  children: ReactNode;
}) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const interactionRef = useRef<Interaction | null>(null);
  const suppressClickRef = useRef(false);
  if (!active && !interactive) return <Fragment>{children}</Fragment>;

  const effectiveSettings = forceVisible && !interactive
    ? {
        ...settings,
        visible: true,
        opacity: Math.max(0.65, settings.opacity),
        offsetXPx: Math.max(-64, Math.min(64, settings.offsetXPx)),
        offsetYPx: Math.max(-64, Math.min(64, settings.offsetYPx))
      }
    : settings;
  const visible = effectiveSettings.visible;

  if (active && !interactive && !visible) return null;
  if (interactive && !settings.visible) {
    return (
      <CanvasHiddenElementFlag
        elementId={elementId}
        label={label}
        kind="product"
        onRestore={() => onChange?.(elementId, { visible: true })}
      />
    );
  }

  const snap = (value: number) => (
    snapToGrid && gridSizePx > 0
      ? Math.round(value / gridSizePx) * gridSizePx
      : Math.round(value)
  );
  const resizeMinimums = getProductCanvasElementResizeMinimums(elementId);

  const beginInteraction = (
    kind: Interaction['kind'],
    event: ReactPointerEvent<HTMLElement>
  ) => {
    const root = rootRef.current;
    if (
      !interactive
      || settings.locked
      || !onChange
      || !root
      || event.button !== 0
    ) {
      return;
    }
    const target = event.target instanceof Element ? event.target : null;
    const moveHandle = target?.closest('[data-product-canvas-move-handle]');
    if (
      kind === 'move'
      && !moveHandle
      && target?.closest(
        'button, input, select, textarea, a, [role="button"], [data-product-canvas-resize]'
      )
    ) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    onSelect?.(elementId);
    root.setPointerCapture?.(event.pointerId);
    interactionRef.current = {
      kind,
      pointerId: event.pointerId,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startOffsetX: effectiveSettings.offsetXPx,
      startOffsetY: effectiveSettings.offsetYPx,
      startWidth: effectiveSettings.widthPx > 0
        ? effectiveSettings.widthPx
        : root.getBoundingClientRect().width / Math.max(scale, 0.01),
      startHeight: effectiveSettings.heightPx > 0
        ? effectiveSettings.heightPx
        : root.getBoundingClientRect().height / Math.max(scale, 0.01),
      moved: false
    };
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const interaction = interactionRef.current;
    if (
      !interaction
      || interaction.pointerId !== event.pointerId
      || !onChange
    ) {
      return;
    }
    const safeScale = Math.max(scale, 0.01);
    const deltaX = (event.clientX - interaction.startClientX) / safeScale;
    const deltaY = (event.clientY - interaction.startClientY) / safeScale;
    if (Math.abs(deltaX) + Math.abs(deltaY) > 2) interaction.moved = true;
    if (interaction.kind === 'move') {
      onChange(elementId, {
        offsetXPx: snap(interaction.startOffsetX + deltaX),
        offsetYPx: snap(interaction.startOffsetY + deltaY)
      });
      return;
    }
    const axis: ProductCanvasResizeAxis = interaction.kind === 'resize-width'
      ? 'width'
      : interaction.kind === 'resize-height'
        ? 'height'
        : 'both';
    onChange(
      elementId,
      resolveProductCanvasResize({
        startWidth: interaction.startWidth,
        startHeight: interaction.startHeight,
        nextWidth: snap(interaction.startWidth + deltaX),
        nextHeight: snap(interaction.startHeight + deltaY),
        axis,
        aspectRatioLocked: effectiveSettings.aspectRatioLocked,
        ...resizeMinimums
      })
    );
  };

  const endInteraction = (event: ReactPointerEvent<HTMLDivElement>) => {
    const interaction = interactionRef.current;
    if (!interaction || interaction.pointerId !== event.pointerId) return;
    suppressClickRef.current = interaction.moved;
    interactionRef.current = null;
    if (rootRef.current?.hasPointerCapture?.(event.pointerId)) {
      rootRef.current.releasePointerCapture(event.pointerId);
    }
  };

  const cancelInteraction = (event: ReactPointerEvent<HTMLDivElement>) => {
    const interaction = interactionRef.current;
    if (!interaction || interaction.pointerId !== event.pointerId) return;
    interactionRef.current = null;
    suppressClickRef.current = false;
    if (rootRef.current?.hasPointerCapture?.(event.pointerId)) {
      rootRef.current.releasePointerCapture(event.pointerId);
    }
  };
  const handleResizeKeyDown = (
    axis: ProductCanvasResizeAxis,
    event: ReactKeyboardEvent<HTMLElement>
  ) => {
    if (!onChange || settings.locked) return;
    const horizontal =
      event.key === 'ArrowRight' || event.key === 'ArrowLeft';
    const vertical =
      event.key === 'ArrowDown' || event.key === 'ArrowUp';
    if (
      (!horizontal && !vertical)
      || (axis === 'width' && !horizontal)
      || (axis === 'height' && !vertical)
    ) {
      return;
    }
    event.preventDefault();
    const step = event.shiftKey ? 10 : 1;
    const rect = rootRef.current?.getBoundingClientRect();
    const safeScale = Math.max(scale, 0.01);
    const width = effectiveSettings.widthPx > 0
      ? effectiveSettings.widthPx
      : (rect?.width ?? 24) / safeScale;
    const height = effectiveSettings.heightPx > 0
      ? effectiveSettings.heightPx
      : (rect?.height ?? 24) / safeScale;
    const nextWidth = horizontal
      ? width + (event.key === 'ArrowRight' ? step : -step)
      : width;
    const nextHeight = vertical
      ? height + (event.key === 'ArrowDown' ? step : -step)
      : height;
    onChange(
      elementId,
      resolveProductCanvasResize({
        startWidth: width,
        startHeight: height,
        nextWidth,
        nextHeight,
        axis: axis === 'both' ? (horizontal ? 'width' : 'height') : axis,
        aspectRatioLocked: effectiveSettings.aspectRatioLocked,
        ...resizeMinimums
      })
    );
  };
  const handleMoveKeyDown = (event: ReactKeyboardEvent<HTMLElement>) => {
    if (!onChange || settings.locked) return;
    const horizontal = event.key === 'ArrowRight' || event.key === 'ArrowLeft';
    const vertical = event.key === 'ArrowDown' || event.key === 'ArrowUp';
    if (!horizontal && !vertical) return;
    event.preventDefault();
    event.stopPropagation();
    onSelect?.(elementId);
    const step = snapToGrid && gridSizePx > 0
      ? gridSizePx * (event.shiftKey ? 5 : 1)
      : event.shiftKey
        ? 10
        : 1;
    onChange(elementId, {
      offsetXPx: effectiveSettings.offsetXPx + (
        event.key === 'ArrowRight' ? step : event.key === 'ArrowLeft' ? -step : 0
      ),
      offsetYPx: effectiveSettings.offsetYPx + (
        event.key === 'ArrowDown' ? step : event.key === 'ArrowUp' ? -step : 0
      )
    });
  };
  const elementStyle = getProductCanvasElementStyle(effectiveSettings, active);

  return (
    <div
      ref={rootRef}
      data-product-canvas-element={elementId}
      data-product-canvas-selected={selected || undefined}
      data-product-canvas-hidden={!visible || undefined}
      data-product-canvas-aspect-locked={
        effectiveSettings.aspectRatioLocked || undefined
      }
      data-product-canvas-fixed-width={
        effectiveSettings.widthPx > 0 || undefined
      }
      data-product-canvas-fixed-height={
        effectiveSettings.heightPx > 0 || undefined
      }
      data-product-canvas-custom-color={active && Boolean(effectiveSettings.color) || undefined}
      data-product-canvas-custom-font-family={active && Boolean(effectiveSettings.fontFamily) || undefined}
      data-product-canvas-custom-font-size={active && effectiveSettings.fontSizePx > 0 || undefined}
      data-product-canvas-custom-font-weight={active && effectiveSettings.fontWeight > 0 || undefined}
      data-product-canvas-custom-line-height={active && effectiveSettings.lineHeight > 0 || undefined}
      data-product-canvas-custom-letter-spacing={active && effectiveSettings.letterSpacingPx !== 0 || undefined}
      data-product-canvas-custom-text-align={active && effectiveSettings.textAlign !== 'inherit' || undefined}
      className={`product-canvas-element ${className} ${
        interactive ? 'touch-none' : ''
      } ${
        selected
          ? 'outline outline-2 outline-offset-2 outline-[color:var(--blue-500)]'
          : ''
      }`.trim()}
      style={{
        ...elementStyle,
        position: interactive ? 'relative' : elementStyle.position,
        opacity: active ? effectiveSettings.opacity : undefined,
        cursor: interactive && !settings.locked ? 'move' : undefined
      }}
      onPointerDown={(event) => beginInteraction('move', event)}
      onPointerMove={handlePointerMove}
      onPointerUp={endInteraction}
      onPointerCancel={cancelInteraction}
      onLostPointerCapture={(event) => {
        if (interactionRef.current?.pointerId === event.pointerId) {
          interactionRef.current = null;
          suppressClickRef.current = false;
        }
      }}
      onClickCapture={(event) => {
        if (
          interactive
          && event.target instanceof Element
          && event.target.closest('a')
        ) {
          event.preventDefault();
        }
      }}
      onClick={(event) => {
        if (!interactive) return;
        event.preventDefault();
        event.stopPropagation();
        if (suppressClickRef.current) {
          suppressClickRef.current = false;
          return;
        }
        onSelect?.(elementId);
      }}
    >
      {active && effectiveSettings.heightPx > 0 ? (
        <div className="product-canvas-element-content h-full overflow-auto overscroll-contain [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
          {children}
        </div>
      ) : children}
      {interactive && selected ? (
        <>
          <span
            data-product-canvas-editor-chrome
            data-product-canvas-move-handle
            role="button"
            tabIndex={settings.locked ? -1 : 0}
            aria-label={`Premakni: ${label}`}
            title={settings.locked
              ? `${label} je zaklenjen`
              : 'Povlecite ali uporabite puščice za premik'}
            className={`absolute -top-6 left-0 z-[80] whitespace-nowrap rounded bg-[color:var(--blue-600)] px-1.5 py-0.5 text-[9px] font-semibold leading-4 text-white shadow ${
              settings.locked ? 'cursor-not-allowed' : 'cursor-move'
            }`}
            onPointerDown={(event) => beginInteraction('move', event)}
            onKeyDown={handleMoveKeyDown}
          >
            {label}
          </span>
          {!settings.locked ? (
            <>
              <span
                data-product-canvas-editor-chrome
                data-product-canvas-resize
                data-product-canvas-resize-axis="width"
                role="button"
                tabIndex={0}
                aria-label={`Spremeni širino: ${label}`}
                title={effectiveSettings.aspectRatioLocked
                  ? 'Povleci za sorazmerno spremembo velikosti'
                  : 'Povleci za spremembo širine'}
                className="absolute -right-1.5 top-1/2 z-[81] h-8 w-3 -translate-y-1/2 cursor-ew-resize rounded-full border-2 border-white bg-[color:var(--blue-500)] shadow"
                onPointerDown={(event) =>
                  beginInteraction('resize-width', event)
                }
                onKeyDown={(event) => handleResizeKeyDown('width', event)}
              />
              <span
                data-product-canvas-editor-chrome
                data-product-canvas-resize
                data-product-canvas-resize-axis="height"
                role="button"
                tabIndex={0}
                aria-label={`Spremeni višino: ${label}`}
                title={effectiveSettings.aspectRatioLocked
                  ? 'Povleci za sorazmerno spremembo velikosti'
                  : 'Povleci za spremembo višine'}
                className="absolute -bottom-1.5 left-1/2 z-[81] h-3 w-8 -translate-x-1/2 cursor-ns-resize rounded-full border-2 border-white bg-[color:var(--blue-500)] shadow"
                onPointerDown={(event) =>
                  beginInteraction('resize-height', event)
                }
                onKeyDown={(event) => handleResizeKeyDown('height', event)}
              />
              <span
                data-product-canvas-editor-chrome
                data-product-canvas-resize
                data-product-canvas-resize-axis="both"
                role="button"
                tabIndex={0}
                aria-label={`Spremeni širino in višino: ${label}`}
                title={effectiveSettings.aspectRatioLocked
                  ? 'Povleci za sorazmerno spremembo velikosti'
                  : 'Povleci za hkratno spremembo širine in višine'}
                className="absolute -bottom-1.5 -right-1.5 z-[82] h-3.5 w-3.5 cursor-nwse-resize rounded-[3px] border-2 border-white bg-[color:var(--blue-600)] shadow"
                onPointerDown={(event) =>
                  beginInteraction('resize-both', event)
                }
                onKeyDown={(event) => handleResizeKeyDown('both', event)}
              />
            </>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
