'use client';

import {
  useLayoutEffect,
  useState,
  type RefObject
} from 'react';

type ProductCanvasMeasurement = {
  left: number;
  top: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
  centerX: number;
  centerY: number;
  alignedCenterX: boolean;
  alignedCenterY: boolean;
  nearest: number | null;
};

const findSelectedElement = (
  root: HTMLElement,
  selectedElementId: string
) =>
  Array.from(
    root.querySelectorAll<HTMLElement>('[data-product-canvas-element]')
  ).find(
    (node) => node.dataset.productCanvasElement === selectedElementId
  ) ?? null;

export default function ProductCanvasGuidesOverlay({
  rootRef,
  selectedElementId,
  enabled,
  changeToken
}: {
  rootRef: RefObject<HTMLElement | null>;
  selectedElementId: string | null;
  enabled: boolean;
  changeToken?: unknown;
}) {
  const [measurement, setMeasurement] =
    useState<ProductCanvasMeasurement | null>(null);

  useLayoutEffect(() => {
    if (!enabled || !selectedElementId) {
      setMeasurement(null);
      return undefined;
    }

    let disposed = false;
    let connectFrame = 0;
    let measurementFrame = 0;
    let retryCount = 0;
    let resizeObserver: ResizeObserver | null = null;
    let mutationObserver: MutationObserver | null = null;
    let connectedRoot: HTMLElement | null = null;
    let connectedSelectedNode: HTMLElement | null = null;

    const updateMeasurement = () => {
      cancelAnimationFrame(measurementFrame);
      measurementFrame = requestAnimationFrame(() => {
        const root = connectedRoot;
        const selectedNode = connectedSelectedNode;
        if (disposed || !root || !selectedNode) return;
        const rootRect = root.getBoundingClientRect();
        const selectedRect = selectedNode.getBoundingClientRect();
        const logicalWidth = Math.max(1, root.offsetWidth);
        const logicalHeight = Math.max(1, root.offsetHeight);
        const scaleX = rootRect.width > 0 ? rootRect.width / logicalWidth : 1;
        const scaleY = rootRect.height > 0 ? rootRect.height / logicalHeight : scaleX;
        const selectedLogical = {
          left: (selectedRect.left - rootRect.left) / (scaleX || 1),
          top: (selectedRect.top - rootRect.top) / (scaleY || 1),
          right: (selectedRect.right - rootRect.left) / (scaleX || 1),
          bottom: (selectedRect.bottom - rootRect.top) / (scaleY || 1)
        };
        const width = Math.max(0, selectedLogical.right - selectedLogical.left);
        const height = Math.max(0, selectedLogical.bottom - selectedLogical.top);
        const centerX = selectedLogical.left + width / 2;
        const centerY = selectedLogical.top + height / 2;
        const nearestDistances: number[] = [];

        root
          .querySelectorAll<HTMLElement>('[data-product-canvas-element]')
          .forEach((candidate) => {
            if (
              candidate === selectedNode ||
              candidate.dataset.productCanvasHidden === 'true' ||
              candidate.contains(selectedNode) ||
              selectedNode.contains(candidate)
            ) {
              return;
            }
            const candidateRect = candidate.getBoundingClientRect();
            const candidateLogical = {
              left: (candidateRect.left - rootRect.left) / (scaleX || 1),
              top: (candidateRect.top - rootRect.top) / (scaleY || 1),
              right: (candidateRect.right - rootRect.left) / (scaleX || 1),
              bottom: (candidateRect.bottom - rootRect.top) / (scaleY || 1)
            };
            const horizontalGap = Math.max(
              candidateLogical.left - selectedLogical.right,
              selectedLogical.left - candidateLogical.right,
              0
            );
            const verticalGap = Math.max(
              candidateLogical.top - selectedLogical.bottom,
              selectedLogical.top - candidateLogical.bottom,
              0
            );
            const gap = Math.max(horizontalGap, verticalGap);
            if (gap > 0) nearestDistances.push(gap);
          });

        setMeasurement({
          left: Math.max(0, Math.round(selectedLogical.left)),
          top: Math.max(0, Math.round(selectedLogical.top)),
          right: Math.max(0, Math.round(logicalWidth - selectedLogical.right)),
          bottom: Math.max(0, Math.round(logicalHeight - selectedLogical.bottom)),
          width: Math.max(0, Math.round(width)),
          height: Math.max(0, Math.round(height)),
          centerX,
          centerY,
          alignedCenterX: Math.abs(centerX - logicalWidth / 2) <= 1,
          alignedCenterY: Math.abs(centerY - logicalHeight / 2) <= 1,
          nearest:
            nearestDistances.length > 0
              ? Math.round(Math.min(...nearestDistances))
              : null
        });
      });
    };

    const connect = () => {
      if (disposed) return;
      const root = rootRef.current;
      const selectedNode = root
        ? findSelectedElement(root, selectedElementId)
        : null;
      if (!root || !selectedNode) {
        retryCount += 1;
        if (retryCount < 60) {
          connectFrame = requestAnimationFrame(connect);
        } else {
          setMeasurement(null);
        }
        return;
      }

      connectedRoot = root;
      connectedSelectedNode = selectedNode;
      updateMeasurement();
      resizeObserver =
        typeof ResizeObserver === 'undefined'
          ? null
          : new ResizeObserver(updateMeasurement);
      resizeObserver?.observe(root);
      resizeObserver?.observe(selectedNode);
      mutationObserver =
        typeof MutationObserver === 'undefined'
          ? null
          : new MutationObserver(updateMeasurement);
      mutationObserver?.observe(selectedNode, {
        attributes: true,
        attributeFilter: ['class', 'style']
      });
      window.addEventListener('pointermove', updateMeasurement);
      window.addEventListener('resize', updateMeasurement);
    };

    connectFrame = requestAnimationFrame(connect);
    return () => {
      disposed = true;
      cancelAnimationFrame(connectFrame);
      cancelAnimationFrame(measurementFrame);
      resizeObserver?.disconnect();
      mutationObserver?.disconnect();
      window.removeEventListener('pointermove', updateMeasurement);
      window.removeEventListener('resize', updateMeasurement);
    };
  }, [changeToken, enabled, rootRef, selectedElementId]);

  if (!enabled || !measurement) return null;

  return (
    <>
      <div
        aria-hidden="true"
        data-product-editor-aid="guides"
        className="pointer-events-none absolute inset-0 z-[63] text-[9px] font-bold text-fuchsia-700"
        style={{
          textShadow:
            '0 1px 2px rgba(255,255,255,.95), 0 0 4px rgba(255,255,255,.8)'
        }}
      >
        <span className="absolute inset-y-0 left-1/2 w-px bg-fuchsia-500/25" />
        <span className="absolute inset-x-0 top-1/2 h-px bg-fuchsia-500/25" />
        {measurement.alignedCenterX ? (
          <>
            <span
              className="absolute inset-y-0 w-px bg-fuchsia-500/80"
              style={{ left: measurement.centerX }}
            />
            <span
              className="absolute top-3 translate-x-2 whitespace-nowrap"
              style={{ left: measurement.centerX }}
            >
              {Math.round(measurement.centerX)} px
            </span>
          </>
        ) : null}
        {measurement.alignedCenterY ? (
          <>
            <span
              className="absolute inset-x-0 h-px bg-fuchsia-500/80"
              style={{ top: measurement.centerY }}
            />
            <span
              className="absolute left-3 whitespace-nowrap"
              style={{
                top: measurement.centerY,
                transform: 'translateY(calc(-100% - 6px))'
              }}
            >
              {Math.round(measurement.centerY)} px
            </span>
          </>
        ) : null}
      </div>

      <div
        aria-hidden="true"
        data-product-editor-aid="measurements"
        className="pointer-events-none absolute inset-0 z-[64] text-[10px] font-bold leading-none text-sky-700"
        style={{
          textShadow:
            '0 1px 2px rgba(255,255,255,.98), 0 0 4px rgba(255,255,255,.85)'
        }}
      >
        <span
          className="absolute whitespace-nowrap rounded bg-white/80 px-1 py-0.5"
          style={{
            left: measurement.left,
            top: Math.max(2, measurement.top - 18)
          }}
        >
          {measurement.width} × {measurement.height} px
        </span>
        <span
          className="absolute h-px border-t border-dashed border-sky-500/55"
          style={{
            left: 0,
            top: measurement.top + measurement.height / 2,
            width: measurement.left
          }}
        />
        <span
          className="absolute h-px border-t border-dashed border-sky-500/55"
          style={{
            left: measurement.left + measurement.width,
            right: 0,
            top: measurement.top + measurement.height / 2
          }}
        />
        <span
          className="absolute w-px border-l border-dashed border-sky-500/55"
          style={{
            left: measurement.left + measurement.width / 2,
            top: 0,
            height: measurement.top
          }}
        />
        <span
          className="absolute w-px border-l border-dashed border-sky-500/55"
          style={{
            left: measurement.left + measurement.width / 2,
            top: measurement.top + measurement.height,
            bottom: 0
          }}
        />
        <span
          className="absolute whitespace-nowrap"
          style={{
            left: Math.max(22, measurement.left / 2),
            top: measurement.top + measurement.height / 2 - 14,
            transform: 'translateX(-50%)'
          }}
        >
          {measurement.left}px
        </span>
        <span
          className="absolute whitespace-nowrap"
          style={{
            right: Math.max(22, measurement.right / 2),
            top: measurement.top + measurement.height / 2 - 14,
            transform: 'translateX(50%)'
          }}
        >
          {measurement.right}px
        </span>
        <span
          className="absolute whitespace-nowrap"
          style={{
            left: measurement.left + measurement.width / 2 + 6,
            top: Math.max(14, measurement.top / 2),
            transform: 'translateY(-50%)'
          }}
        >
          {measurement.top}px
        </span>
        <span
          className="absolute whitespace-nowrap"
          style={{
            left: measurement.left + measurement.width / 2 + 6,
            bottom: Math.max(14, measurement.bottom / 2),
            transform: 'translateY(50%)'
          }}
        >
          {measurement.bottom}px
        </span>
        {measurement.nearest !== null ? (
          <span className="absolute bottom-2 right-2 rounded bg-white/85 px-1.5 py-1">
            Najbližje: {measurement.nearest}px
          </span>
        ) : null}
      </div>
    </>
  );
}
