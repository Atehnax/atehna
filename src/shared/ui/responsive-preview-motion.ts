'use client';

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState
} from 'react';
import { flushSync } from 'react-dom';

export const appearancePreviewTransitionDurationMs = 420;
export const appearancePreviewTransitionEasing = 'cubic-bezier(0.4, 0, 0.2, 1)';
export const appearancePreviewMotionEventName = 'appearance-preview-motion';

export type AppearancePreviewGeometry = {
  logicalWidth: number;
  renderedWidth: number;
};

export type AppearancePreviewTransitionPhase = 'idle' | 'animating';

function cubicBezierCoordinate(
  progress: number,
  controlPoint1: number,
  controlPoint2: number
) {
  const inverse = 1 - progress;
  return 3 * inverse * inverse * progress * controlPoint1
    + 3 * inverse * progress * progress * controlPoint2
    + progress * progress * progress;
}

export function easeAppearancePreviewProgress(progress: number) {
  const clampedProgress = Math.min(1, Math.max(0, progress));
  let lower = 0;
  let upper = 1;
  let parameter = clampedProgress;

  for (let iteration = 0; iteration < 12; iteration += 1) {
    parameter = (lower + upper) / 2;
    const x = cubicBezierCoordinate(parameter, 0.4, 0.2);
    if (x < clampedProgress) lower = parameter;
    else upper = parameter;
  }

  return cubicBezierCoordinate(parameter, 0, 1);
}

export function interpolateAppearancePreviewValue(
  start: number,
  end: number,
  progress: number
) {
  return start + (end - start) * progress;
}

export function roundAppearancePreviewValue(value: number) {
  return Math.round(value * 1_000) / 1_000;
}

export function preserveAdjacentAppearancePreviewDevice<Device extends string>({
  currentDevice,
  candidateGeometry,
  startGeometry,
  targetGeometry,
  orderedDevices,
  resolveDevice
}: {
  currentDevice: Device;
  candidateGeometry: AppearancePreviewGeometry;
  startGeometry: AppearancePreviewGeometry;
  targetGeometry: AppearancePreviewGeometry;
  orderedDevices: readonly Device[];
  resolveDevice: (logicalWidth: number) => Device;
}) {
  const candidateDevice = resolveDevice(candidateGeometry.logicalWidth);
  const currentIndex = orderedDevices.indexOf(currentDevice);
  const candidateIndex = orderedDevices.indexOf(candidateDevice);
  if (
    currentIndex < 0
    || candidateIndex < 0
    || Math.abs(candidateIndex - currentIndex) <= 1
  ) {
    return {
      geometry: candidateGeometry,
      device: candidateDevice,
      transitionProgress: null,
      heldIntermediateDevice: false
    } as const;
  }

  const direction = Math.sign(candidateIndex - currentIndex);
  const nextIndex = currentIndex + direction;
  const nextDevice = orderedDevices[nextIndex] ?? candidateDevice;
  let beforeBoundary = 0;
  let afterBoundary = 1;

  // Locate the first point on this transition that resolves to the adjacent
  // device. Holding both its geometry and renderer for one painted frame keeps
  // a delayed animation frame from flashing a tablet layout at mobile width.
  for (let iteration = 0; iteration < 20; iteration += 1) {
    const progress = (beforeBoundary + afterBoundary) / 2;
    const logicalWidth = interpolateAppearancePreviewValue(
      startGeometry.logicalWidth,
      targetGeometry.logicalWidth,
      progress
    );
    const resolvedIndex = orderedDevices.indexOf(resolveDevice(logicalWidth));
    const reachedNextDevice = resolvedIndex >= 0 && (
      direction > 0 ? resolvedIndex >= nextIndex : resolvedIndex <= nextIndex
    );
    if (reachedNextDevice) afterBoundary = progress;
    else beforeBoundary = progress;
  }

  const logicalDirection = Math.sign(
    targetGeometry.logicalWidth - startGeometry.logicalWidth
  );
  let boundaryLogicalWidth = roundAppearancePreviewValue(
    interpolateAppearancePreviewValue(
      startGeometry.logicalWidth,
      targetGeometry.logicalWidth,
      afterBoundary
    )
  );
  for (
    let nudge = 0;
    nudge < 4 && resolveDevice(boundaryLogicalWidth) !== nextDevice;
    nudge += 1
  ) {
    boundaryLogicalWidth = roundAppearancePreviewValue(
      boundaryLogicalWidth + logicalDirection * 0.001
    );
  }
  if (resolveDevice(boundaryLogicalWidth) !== nextDevice) {
    return {
      geometry: candidateGeometry,
      device: candidateDevice,
      transitionProgress: null,
      heldIntermediateDevice: false
    } as const;
  }
  const logicalDistance = targetGeometry.logicalWidth - startGeometry.logicalWidth;
  const boundaryProgress = logicalDistance === 0
    ? afterBoundary
    : Math.min(1, Math.max(
        0,
        (boundaryLogicalWidth - startGeometry.logicalWidth) / logicalDistance
      ));

  return {
    geometry: {
      logicalWidth: boundaryLogicalWidth,
      renderedWidth: roundAppearancePreviewValue(interpolateAppearancePreviewValue(
        startGeometry.renderedWidth,
        targetGeometry.renderedWidth,
        boundaryProgress
      ))
    },
    device: nextDevice,
    transitionProgress: boundaryProgress,
    heldIntermediateDevice: true
  } as const;
}

export function usePrefersReducedMotion() {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useLayoutEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const updatePreference = () => setPrefersReducedMotion(mediaQuery.matches);

    updatePreference();
    mediaQuery.addEventListener('change', updatePreference);
    return () => mediaQuery.removeEventListener('change', updatePreference);
  }, []);

  return prefersReducedMotion;
}

type AppearancePreviewMotionState<Device extends string> = {
  geometry: AppearancePreviewGeometry;
  renderDevice: Device;
  phase: AppearancePreviewTransitionPhase;
};

export function useAppearanceResponsivePreviewMotion<Device extends string>({
  selectedDevice,
  orderedDevices,
  getTargetGeometry,
  resolveDevice
}: {
  selectedDevice: Device;
  orderedDevices: readonly Device[];
  getTargetGeometry: (
    device: Device,
    availableWidth: number
  ) => AppearancePreviewGeometry;
  resolveDevice: (logicalWidth: number) => Device;
}) {
  const prefersReducedMotion = usePrefersReducedMotion();
  const stageElementRef = useRef<HTMLDivElement | null>(null);
  const frameElementRef = useRef<HTMLDivElement | null>(null);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);
  const fallbackResizeCleanupRef = useRef<(() => void) | null>(null);
  const cancelAnimationRef = useRef<(() => void) | null>(null);
  const initializedRef = useRef(false);
  const selectedDeviceRef = useRef(selectedDevice);
  const reducedMotionRef = useRef(prefersReducedMotion);
  const [availableWidth, setAvailableWidth] = useState(0);
  const initialGeometry = getTargetGeometry(selectedDevice, 0);
  const geometryRef = useRef(initialGeometry);
  const renderDeviceRef = useRef<Device>(selectedDevice);
  const phaseRef = useRef<AppearancePreviewTransitionPhase>('idle');
  const [state, setState] = useState<AppearancePreviewMotionState<Device>>({
    geometry: initialGeometry,
    renderDevice: selectedDevice,
    phase: 'idle'
  });

  selectedDeviceRef.current = selectedDevice;
  reducedMotionRef.current = prefersReducedMotion;

  const applyMotionAttributes = useCallback((
    geometry: AppearancePreviewGeometry,
    renderDevice: Device,
    phase: AppearancePreviewTransitionPhase
  ) => {
    const targets = [stageElementRef.current, frameElementRef.current].filter(
      (element): element is HTMLDivElement => Boolean(element)
    );
    const scale = geometry.logicalWidth > 0
      ? geometry.renderedWidth / geometry.logicalWidth
      : 1;

    for (const element of targets) {
      element.dataset.previewSelectedDevice = selectedDeviceRef.current;
      element.dataset.previewTargetDevice = selectedDeviceRef.current;
      element.dataset.previewRenderDevice = renderDevice;
      element.dataset.previewResponsiveMode = renderDevice;
      element.dataset.previewLogicalWidth = geometry.logicalWidth.toFixed(3);
      element.dataset.previewRenderedWidth = geometry.renderedWidth.toFixed(3);
      element.dataset.previewScale = scale.toFixed(6);
      element.dataset.previewTransitioning = phase === 'animating' ? 'true' : 'false';
      element.dataset.previewTransitionPhase = phase;
      element.dataset.previewTransitionDurationMs = (
        phase === 'animating' ? appearancePreviewTransitionDurationMs : 0
      ).toString();
      element.dataset.previewTransitionEasing = appearancePreviewTransitionEasing;
      element.dataset.previewReducedMotion = reducedMotionRef.current ? 'true' : 'false';
      element.dataset.previewReady = availableWidth > 0 ? 'true' : 'false';
    }

    const frame = frameElementRef.current;
    if (!frame) return;
    frame.style.width = geometry.renderedWidth > 0
      ? `${geometry.renderedWidth}px`
      : '100%';
    frame.style.willChange = phase === 'animating' ? 'width' : 'auto';
    frame.style.pointerEvents = phase === 'animating' ? 'none' : 'auto';
    frame.dispatchEvent(new Event(appearancePreviewMotionEventName));
  }, [availableWidth]);

  const setStageElement = useCallback((element: HTMLDivElement | null) => {
    resizeObserverRef.current?.disconnect();
    resizeObserverRef.current = null;
    fallbackResizeCleanupRef.current?.();
    fallbackResizeCleanupRef.current = null;
    stageElementRef.current = element;
    if (!element) return;

    const updateAvailableWidth = () => {
      const width = roundAppearancePreviewValue(element.getBoundingClientRect().width);
      setAvailableWidth((currentWidth) => (
        Math.abs(currentWidth - width) <= 0.01 ? currentWidth : width
      ));
    };

    updateAvailableWidth();
    if (typeof ResizeObserver !== 'undefined') {
      const observer = new ResizeObserver(updateAvailableWidth);
      observer.observe(element);
      resizeObserverRef.current = observer;
    } else {
      window.addEventListener('resize', updateAvailableWidth);
      fallbackResizeCleanupRef.current = () => {
        window.removeEventListener('resize', updateAvailableWidth);
      };
    }
  }, []);

  const setFrameElement = useCallback((element: HTMLDivElement | null) => {
    frameElementRef.current = element;
    if (element) {
      applyMotionAttributes(
        geometryRef.current,
        renderDeviceRef.current,
        phaseRef.current
      );
    }
  }, [applyMotionAttributes]);

  useLayoutEffect(() => {
    if (availableWidth <= 0) return undefined;

    cancelAnimationRef.current?.();
    cancelAnimationRef.current = null;
    const targetGeometry = getTargetGeometry(selectedDevice, availableWidth);
    const targetDevice = selectedDevice;
    const startGeometry = geometryRef.current;
    const alreadySettled =
      Math.abs(startGeometry.logicalWidth - targetGeometry.logicalWidth) <= 0.01
      && Math.abs(startGeometry.renderedWidth - targetGeometry.renderedWidth) <= 0.01;

    if (!initializedRef.current || prefersReducedMotion || alreadySettled) {
      initializedRef.current = true;
      geometryRef.current = targetGeometry;
      renderDeviceRef.current = targetDevice;
      phaseRef.current = 'idle';
      setState({ geometry: targetGeometry, renderDevice: targetDevice, phase: 'idle' });
      applyMotionAttributes(targetGeometry, targetDevice, 'idle');
      return undefined;
    }

    initializedRef.current = true;
    phaseRef.current = 'animating';
    setState((currentState) => ({ ...currentState, phase: 'animating' }));
    applyMotionAttributes(startGeometry, renderDeviceRef.current, 'animating');
    const startTime = performance.now();
    let animationFrame = 0;
    let cancelled = false;

    const animate = (timestamp: number) => {
      if (cancelled) return;
      const progress = Math.min(
        1,
        Math.max(0, (timestamp - startTime) / appearancePreviewTransitionDurationMs)
      );
      const easedProgress = easeAppearancePreviewProgress(progress);
      const geometry = {
        logicalWidth: roundAppearancePreviewValue(interpolateAppearancePreviewValue(
          startGeometry.logicalWidth,
          targetGeometry.logicalWidth,
          easedProgress
        )),
        renderedWidth: roundAppearancePreviewValue(interpolateAppearancePreviewValue(
          startGeometry.renderedWidth,
          targetGeometry.renderedWidth,
          easedProgress
        ))
      };
      const adjacentStep = preserveAdjacentAppearancePreviewDevice({
        currentDevice: renderDeviceRef.current,
        candidateGeometry: geometry,
        startGeometry,
        targetGeometry,
        orderedDevices,
        resolveDevice
      });
      const nextGeometry = adjacentStep.geometry;
      const nextRenderDevice = adjacentStep.device;

      geometryRef.current = nextGeometry;
      if (nextRenderDevice !== renderDeviceRef.current) {
        renderDeviceRef.current = nextRenderDevice;
        flushSync(() => {
          setState({ geometry: nextGeometry, renderDevice: nextRenderDevice, phase: 'animating' });
        });
      }
      applyMotionAttributes(nextGeometry, nextRenderDevice, 'animating');

      if (progress < 1 || adjacentStep.heldIntermediateDevice) {
        animationFrame = window.requestAnimationFrame(animate);
        return;
      }

      geometryRef.current = targetGeometry;
      renderDeviceRef.current = targetDevice;
      phaseRef.current = 'idle';
      flushSync(() => {
        setState({ geometry: targetGeometry, renderDevice: targetDevice, phase: 'idle' });
      });
      applyMotionAttributes(targetGeometry, targetDevice, 'idle');
      cancelAnimationRef.current = null;
    };

    animationFrame = window.requestAnimationFrame(animate);
    const cancel = () => {
      cancelled = true;
      window.cancelAnimationFrame(animationFrame);
    };
    cancelAnimationRef.current = cancel;
    return cancel;
  }, [
    applyMotionAttributes,
    availableWidth,
    getTargetGeometry,
    orderedDevices,
    prefersReducedMotion,
    resolveDevice,
    selectedDevice
  ]);

  useEffect(() => () => {
    cancelAnimationRef.current?.();
    resizeObserverRef.current?.disconnect();
    fallbackResizeCleanupRef.current?.();
  }, []);

  return {
    ...state,
    geometry: geometryRef.current,
    availableWidth,
    frameRef: frameElementRef,
    prefersReducedMotion,
    setStageElement,
    setFrameElement
  };
}
