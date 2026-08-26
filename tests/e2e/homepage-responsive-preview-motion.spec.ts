import { expect, test, type Page } from '@playwright/test';

type PreviewFrameSample = {
  timestamp: number;
  selectedDevice: string;
  logicalWidth: number;
  renderedWidth: number;
  reportedScale: number;
  renderDevice: string;
  responsiveMode: string;
  targetDevice: string;
  transitioning: boolean;
  phase: string;
  transitionDurationMs: number;
  transitionEasing: string;
  layoutCovered: boolean;
  opacityTarget: number;
  headerDevice: string;
  homepageDevice: string;
  frameLeft: number;
  frameRight: number;
  frameWidth: number;
  viewportWidth: number;
  actualLogicalWidth: number;
  actualScale: number;
  stageLeft: number;
  stageRight: number;
  stageTop: number;
  stageHeight: number;
  stageWidth: number;
  documentOverflow: number;
  previewScrollTop: number;
  windowScrollX: number;
  windowScrollY: number;
  selectedElementId: string;
  activeElementPreserved: boolean;
  frameNodePreserved: boolean;
  viewportNodePreserved: boolean;
  scrollRegionNodePreserved: boolean;
  headerNodePreserved: boolean;
  homepageNodePreserved: boolean;
  heroNodePreserved: boolean;
  editableNodePreserved: boolean;
  selectionPreserved: boolean;
  frameOpacity: number;
  liveOpacity: number;
  viewportOpacity: number;
  rendererOpacity: number;
  rendererCount: number;
  interactiveRendererCount: number;
  livePointerEvents: string;
  titleFontSize: number;
  titleRenderedFontSize: number;
  titleLineHeight: number;
  titleRenderedLineHeight: number;
  titleFontWeight: number;
  titleLetterSpacing: number;
  titleOpacity: number;
  titleLineCount: number;
  titleLogicalTop: number;
  titleLogicalLeft: number;
  titleLogicalWidth: number;
  titleLogicalHeight: number;
  heroContentLogicalTop: number;
  heroContentLogicalLeft: number;
  heroLogicalTop: number;
  heroLogicalHeight: number;
  headerLogicalHeight: number;
  fluidTitleSize: number;
  fluidTitleRenderedSize: number;
  fluidHeaderHeight: number;
  fluidHeroHeight: number;
  frameTransitionDurationMs: number;
  stageTransitionDurationMs: number;
  viewportTransitionDurationMs: number;
};

type PreviewSwitchCapture = {
  samples: PreviewFrameSample[];
};

const previewPresetWidths = {
  desktop: 1440,
  tablet: 1024,
  mobile: 390
} as const;
type PreviewDevice = keyof typeof previewPresetWidths;

const previewTransitionDurationMs = 420;
const previewPostDurationBufferMs = 120;
const commercialStorefrontScale = 0.75;

function classifyPreviewWidth(width: number): PreviewDevice {
  if (width > 1024) return 'desktop';
  if (width > 767) return 'tablet';
  return 'mobile';
}

function compactDeviceSequence(devices: string[]) {
  return devices.filter((device, index) => index === 0 || device !== devices[index - 1]);
}

function findBreakpointBracket(samples: PreviewFrameSample[], breakpoint: 767 | 1024) {
  for (let index = 1; index < samples.length; index += 1) {
    const previous = samples[index - 1];
    const current = samples[index];
    if (
      (previous.logicalWidth <= breakpoint && current.logicalWidth > breakpoint)
      || (previous.logicalWidth > breakpoint && current.logicalWidth <= breakpoint)
    ) {
      return [previous, current] as const;
    }
  }
  return null;
}

function expectBreakpointStylesToBeContinuous(
  samples: PreviewFrameSample[],
  breakpoint: 767 | 1024,
  transitionLabel: string
) {
  const bracket = findBreakpointBracket(samples, breakpoint);
  expect(bracket, `${transitionLabel}: missing ${breakpoint}/${breakpoint + 1} breakpoint bracket`).not.toBeNull();
  const [before, after] = bracket!;
  const widthStep = Math.max(1, Math.abs(after.logicalWidth - before.logicalWidth));
  const boundaryLabel = `${transitionLabel}: ${breakpoint}/${breakpoint + 1} style continuity`;

  expect(
    Math.abs(after.titleRenderedFontSize - before.titleRenderedFontSize),
    `${boundaryLabel}: rendered title size jumped`
  ).toBeLessThanOrEqual(Math.max(0.75, widthStep * 0.05));
  expect(
    Math.abs(after.titleRenderedLineHeight - before.titleRenderedLineHeight),
    `${boundaryLabel}: rendered title line height jumped`
  ).toBeLessThanOrEqual(Math.max(1, widthStep * 0.07));
  expect(
    Math.abs(after.titleFontWeight - before.titleFontWeight),
    `${boundaryLabel}: title weight switched discretely`
  ).toBeLessThanOrEqual(Math.max(4, widthStep * 0.8));
  expect(
    Math.abs(after.titleLetterSpacing - before.titleLetterSpacing),
    `${boundaryLabel}: title letter spacing jumped`
  ).toBeLessThanOrEqual(Math.max(0.15, widthStep * 0.01));
  expect(
    Math.abs(after.headerLogicalHeight - before.headerLogicalHeight),
    `${boundaryLabel}: header height jumped`
  ).toBeLessThanOrEqual(Math.max(1, widthStep * 0.05));
  expect(
    Math.abs(after.heroLogicalHeight - before.heroLogicalHeight),
    `${boundaryLabel}: hero height jumped`
  ).toBeLessThanOrEqual(Math.max(2, widthStep * 0.15));
  expect(
    Math.abs(after.fluidTitleRenderedSize - before.fluidTitleRenderedSize),
    `${boundaryLabel}: fluid rendered title metric jumped`
  ).toBeLessThanOrEqual(Math.max(0.75, widthStep * 0.05));
  expect(
    Math.abs(after.fluidHeaderHeight - before.fluidHeaderHeight),
    `${boundaryLabel}: fluid header metric jumped`
  ).toBeLessThanOrEqual(Math.max(1, widthStep * 0.05));
  expect(
    Math.abs(after.fluidHeroHeight - before.fluidHeroHeight),
    `${boundaryLabel}: fluid hero metric jumped`
  ).toBeLessThanOrEqual(Math.max(2, widthStep * 0.15));
  expect(
    Math.abs(after.heroLogicalTop - before.heroLogicalTop),
    `${boundaryLabel}: hero top position jumped`
  ).toBeLessThanOrEqual(Math.max(1, widthStep * 0.05));
  // The public renderer swaps complete responsive settings and content lanes at
  // both breakpoints. Derived content/title boxes may reflow; the controller-
  // owned fluid metrics above are the continuity contract.
  expect(before.titleOpacity, boundaryLabel).toBe(1);
  expect(after.titleOpacity, boundaryLabel).toBe(1);
  expect(before.editableNodePreserved, boundaryLabel).toBe(true);
  expect(after.editableNodePreserved, boundaryLabel).toBe(true);
}

function expectNoStyleSpike(
  samples: PreviewFrameSample[],
  field: 'titleRenderedFontSize' | 'titleRenderedLineHeight',
  transitionLabel: string
) {
  const firstValue = samples[0][field];
  const lastValue = samples.at(-1)![field];
  const direction = Math.sign(lastValue - firstValue);
  const tolerance = field === 'titleRenderedFontSize' ? 0.35 : 0.5;
  const endpointMin = Math.min(firstValue, lastValue) - tolerance;
  const endpointMax = Math.max(firstValue, lastValue) + tolerance;

  for (let index = 1; index < samples.length; index += 1) {
    const previous = samples[index - 1][field];
    const current = samples[index][field];
    expect(current, `${transitionLabel}: ${field} overshot its endpoints`).toBeGreaterThanOrEqual(endpointMin);
    expect(current, `${transitionLabel}: ${field} overshot its endpoints`).toBeLessThanOrEqual(endpointMax);
    if (direction !== 0) {
      expect(
        (current - previous) * direction,
        `${transitionLabel}: ${field} reversed direction`
      ).toBeGreaterThanOrEqual(-tolerance);
    }
  }
}

async function captureViewportSwitch(
  page: Page,
  buttonName: 'Desktop' | 'Tablica' | 'Mobilno',
  sampleRateHz: 30 | 60
): Promise<PreviewSwitchCapture> {
  const stage = page.getByTestId('homepage-preview-stage');

  await stage.evaluate((stageElement, { rateHz }) => {
    const browserWindow = window as typeof window & {
      __homepagePreviewCapture?: {
        done: boolean;
        initialTarget: string;
        started: boolean;
        startedAt: number;
        lastSampleAt: number;
        samples: PreviewFrameSample[];
      };
    };
    const frame = stageElement.querySelector<HTMLElement>('[data-testid="homepage-preview-frame"]');
    const liveLayer = stageElement.querySelector<HTMLElement>('[data-testid="homepage-preview-live-layer"]');
    const viewport = liveLayer?.querySelector<HTMLElement>('[data-testid="homepage-preview-viewport"]');
    const scrollRegion = liveLayer?.querySelector<HTMLElement>('[data-testid="homepage-preview-scroll-region"]');
    const header = liveLayer?.querySelector<HTMLElement>('[data-preview-header-device]');
    const homepage = liveLayer?.querySelector<HTMLElement>('[data-preview-homepage-device]');
    const hero = liveLayer?.querySelector<HTMLElement>('[data-homepage-section="hero"]');
    const editable = liveLayer?.querySelector<HTMLElement>('[data-canvas-element-id="hero:title"] h1');
    if (!frame || !liveLayer || !viewport || !scrollRegion || !header || !homepage || !hero || !editable) {
      throw new Error('Preview instrumentation is incomplete.');
    }

    const nativeRequestAnimationFrame = window.requestAnimationFrame.bind(window);
    const nativeCancelAnimationFrame = window.cancelAnimationFrame.bind(window);
    let restoreFrameScheduler = () => undefined;
    if (rateHz === 30) {
      const callbacks = new Map<number, FrameRequestCallback>();
      const frameIntervalMs = 1_000 / rateHz;
      let nextCallbackId = 1;
      let nativeFrameId: number | null = null;
      let lastDeliveredAt = Number.NEGATIVE_INFINITY;

      const scheduleNativeFrame = () => {
        if (nativeFrameId !== null || callbacks.size === 0) return;
        nativeFrameId = nativeRequestAnimationFrame((timestamp) => {
          nativeFrameId = null;
          if (timestamp - lastDeliveredAt < frameIntervalMs - 1) {
            scheduleNativeFrame();
            return;
          }

          lastDeliveredAt = timestamp;
          const frameCallbacks = [...callbacks.entries()];
          callbacks.clear();
          for (const [, callback] of frameCallbacks) callback(timestamp);
          scheduleNativeFrame();
        });
      };

      window.requestAnimationFrame = (callback: FrameRequestCallback) => {
        const callbackId = nextCallbackId;
        nextCallbackId += 1;
        callbacks.set(callbackId, callback);
        scheduleNativeFrame();
        return callbackId;
      };
      window.cancelAnimationFrame = (callbackId: number) => {
        if (callbacks.delete(callbackId)) return;
        nativeCancelAnimationFrame(callbackId);
      };
      restoreFrameScheduler = () => {
        if (nativeFrameId !== null) nativeCancelAnimationFrame(nativeFrameId);
        nativeFrameId = null;
        const pendingCallbacks = [...callbacks.values()];
        callbacks.clear();
        window.requestAnimationFrame = nativeRequestAnimationFrame;
        window.cancelAnimationFrame = nativeCancelAnimationFrame;
        if (pendingCallbacks.length > 0) {
          nativeRequestAnimationFrame((timestamp) => {
            for (const callback of pendingCallbacks) callback(timestamp);
          });
        }
      };
    }

    const initialActiveElement = document.activeElement;
    const initialFrame = frame;
    const initialViewport = viewport;
    const initialScrollRegion = scrollRegion;
    const initialHeader = header;
    const initialHomepage = homepage;
    const initialHero = hero;
    const initialEditable = editable;
    const sampleIntervalMs = 1_000 / rateHz;
    const capture = {
      done: false,
      initialTarget: stageElement.getAttribute('data-preview-target-device') ?? '',
      started: false,
      startedAt: performance.now(),
      lastSampleAt: Number.NEGATIVE_INFINITY,
      samples: [] as PreviewFrameSample[]
    };
    browserWindow.__homepagePreviewCapture = capture;

    const readTransitionDurationMs = (style: CSSStyleDeclaration) => {
      const durations = style.transitionDuration.split(',').map((duration) => {
        const normalizedDuration = duration.trim();
        return normalizedDuration.endsWith('ms')
          ? Number.parseFloat(normalizedDuration)
          : Number.parseFloat(normalizedDuration) * 1_000;
      });
      return Math.max(...durations, 0);
    };

    const recordSample = (timestamp: number) => {
      const currentFrame = stageElement.querySelector<HTMLElement>('[data-testid="homepage-preview-frame"]');
      const currentLiveLayer = stageElement.querySelector<HTMLElement>('[data-testid="homepage-preview-live-layer"]');
      const currentViewport = currentLiveLayer?.querySelector<HTMLElement>('[data-testid="homepage-preview-viewport"]');
      const currentScrollRegion = currentLiveLayer?.querySelector<HTMLElement>('[data-testid="homepage-preview-scroll-region"]');
      const currentHeader = currentLiveLayer?.querySelector<HTMLElement>('[data-preview-header-device]');
      const currentHomepage = currentLiveLayer?.querySelector<HTMLElement>('[data-preview-homepage-device]');
      const currentHero = currentLiveLayer?.querySelector<HTMLElement>('[data-homepage-section="hero"]');
      const currentEditable = currentLiveLayer?.querySelector<HTMLElement>('[data-canvas-element-id="hero:title"] h1');
      const currentHeroRoot = currentHero?.querySelector<HTMLElement>('[data-homepage-hero-root]');
      const currentTitleLayer = currentEditable?.closest<HTMLElement>('[data-canvas-element-id="hero:title"]');
      const currentHeroContent = currentTitleLayer?.parentElement;
      if (
        !currentFrame
        || !currentLiveLayer
        || !currentViewport
        || !currentScrollRegion
        || !currentHeader
        || !currentHomepage
        || !currentHero
        || !currentHeroRoot
        || !currentEditable
        || !currentTitleLayer
        || !currentHeroContent
      ) {
        capture.done = true;
        return;
      }

      const frameRect = currentFrame.getBoundingClientRect();
      const viewportRect = currentViewport.getBoundingClientRect();
      const stageRect = stageElement.getBoundingClientRect();
      const renderers = Array.from(stageElement.querySelectorAll<HTMLElement>('[data-preview-homepage-device]'));
      const interactiveRenderers = Array.from(
        stageElement.querySelectorAll<HTMLElement>('[data-preview-renderer="interactive"]')
      ).filter((renderer) => {
        const style = getComputedStyle(renderer);
        return renderer.dataset.previewInteractive === 'true'
          && style.pointerEvents !== 'none'
          && Number.parseFloat(style.opacity) > 0.99
          && renderer.closest('[inert]') === null;
      });
      const viewportStyle = getComputedStyle(currentViewport);
      const viewportTransform = viewportStyle.transform;
      const actualScale = viewportTransform === 'none'
        ? 1
        : new DOMMatrixReadOnly(viewportTransform).a;
      const heroRootRect = currentHeroRoot.getBoundingClientRect();
      const titleRect = currentEditable.getBoundingClientRect();
      const heroContentRect = currentHeroContent.getBoundingClientRect();
      const headerRect = currentHeader.getBoundingClientRect();
      const titleStyle = getComputedStyle(currentEditable);
      const titleFontSize = Number.parseFloat(titleStyle.fontSize);
      const parsedLineHeight = Number.parseFloat(titleStyle.lineHeight);
      const titleLineHeight = Number.isFinite(parsedLineHeight) ? parsedLineHeight : titleFontSize * 1.2;
      const parsedLetterSpacing = Number.parseFloat(titleStyle.letterSpacing);
      const titleLetterSpacing = Number.isFinite(parsedLetterSpacing) ? parsedLetterSpacing : 0;
      const titleRange = document.createRange();
      titleRange.selectNodeContents(currentEditable);
      const lineTops: number[] = [];
      for (const rect of Array.from(titleRange.getClientRects())) {
        if (rect.width <= 0 || rect.height <= 0) continue;
        if (!lineTops.some((top) => Math.abs(top - rect.top) < 1)) lineTops.push(rect.top);
      }
      const readFluidMetric = (attribute: string, fallback: number) => {
        const value = currentViewport.getAttribute(attribute) ?? stageElement.getAttribute(attribute);
        if (value === null) return fallback;
        const parsedValue = Number.parseFloat(value);
        return Number.isFinite(parsedValue) ? parsedValue : fallback;
      };
      const selectionAnchor = window.getSelection()?.anchorNode ?? null;
      const targetDevice = stageElement.getAttribute('data-preview-target-device') ?? '';
      const transitioning = stageElement.getAttribute('data-preview-transitioning') === 'true';
      capture.samples.push({
        timestamp,
        selectedDevice: stageElement.getAttribute('data-preview-selected-device') ?? '',
        logicalWidth: Number(stageElement.getAttribute('data-preview-logical-width')),
        renderedWidth: Number(stageElement.getAttribute('data-preview-rendered-width')),
        reportedScale: Number(stageElement.getAttribute('data-preview-scale')),
        renderDevice: stageElement.getAttribute('data-preview-render-device') ?? '',
        responsiveMode: stageElement.getAttribute('data-preview-responsive-mode') ?? '',
        targetDevice,
        transitioning,
        phase: stageElement.getAttribute('data-preview-transition-phase') ?? '',
        transitionDurationMs: Number(stageElement.getAttribute('data-preview-transition-duration-ms')),
        transitionEasing: stageElement.getAttribute('data-preview-transition-easing') ?? '',
        layoutCovered: stageElement.getAttribute('data-preview-layout-covered') === 'true',
        opacityTarget: Number(stageElement.getAttribute('data-preview-opacity-target')),
        headerDevice: currentHeader.getAttribute('data-preview-header-device') ?? '',
        homepageDevice: currentHomepage.getAttribute('data-preview-homepage-device') ?? '',
        frameLeft: frameRect.left,
        frameRight: frameRect.right,
        frameWidth: frameRect.width,
        viewportWidth: viewportRect.width,
        actualLogicalWidth: Number.parseFloat(viewportStyle.width),
        actualScale,
        stageLeft: stageRect.left,
        stageRight: stageRect.right,
        stageTop: stageRect.top,
        stageHeight: stageRect.height,
        stageWidth: stageRect.width,
        documentOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        previewScrollTop: currentScrollRegion.scrollTop,
        windowScrollX: window.scrollX,
        windowScrollY: window.scrollY,
        selectedElementId: stageElement.getAttribute('data-selected-element-id') ?? '',
        activeElementPreserved: document.activeElement === initialActiveElement,
        frameNodePreserved: currentFrame === initialFrame,
        viewportNodePreserved: currentViewport === initialViewport,
        scrollRegionNodePreserved: currentScrollRegion === initialScrollRegion,
        headerNodePreserved: currentHeader === initialHeader,
        homepageNodePreserved: currentHomepage === initialHomepage,
        heroNodePreserved: currentHero === initialHero,
        editableNodePreserved: currentEditable === initialEditable && initialEditable.isConnected,
        selectionPreserved: selectionAnchor !== null && initialEditable.contains(selectionAnchor),
        frameOpacity: Number.parseFloat(getComputedStyle(currentFrame).opacity),
        liveOpacity: Number.parseFloat(getComputedStyle(currentLiveLayer).opacity),
        viewportOpacity: Number.parseFloat(viewportStyle.opacity),
        rendererOpacity: Number.parseFloat(getComputedStyle(currentHomepage).opacity),
        rendererCount: renderers.length,
        interactiveRendererCount: interactiveRenderers.length,
        livePointerEvents: getComputedStyle(currentLiveLayer).pointerEvents,
        titleFontSize,
        titleRenderedFontSize: titleFontSize * actualScale,
        titleLineHeight,
        titleRenderedLineHeight: titleLineHeight * actualScale,
        titleFontWeight: Number.parseFloat(titleStyle.fontWeight),
        titleLetterSpacing,
        titleOpacity: Number.parseFloat(titleStyle.opacity),
        titleLineCount: Math.max(1, lineTops.length),
        titleLogicalTop: (titleRect.top - heroRootRect.top) / actualScale,
        titleLogicalLeft: (titleRect.left - heroRootRect.left) / actualScale,
        titleLogicalWidth: titleRect.width / actualScale,
        titleLogicalHeight: titleRect.height / actualScale,
        heroContentLogicalTop: (heroContentRect.top - heroRootRect.top) / actualScale,
        heroContentLogicalLeft: (heroContentRect.left - heroRootRect.left) / actualScale,
        heroLogicalTop: (heroRootRect.top - viewportRect.top) / actualScale,
        heroLogicalHeight: heroRootRect.height / actualScale,
        headerLogicalHeight: headerRect.height / actualScale,
        fluidTitleSize: readFluidMetric('data-preview-fluid-title-size', titleFontSize),
        fluidTitleRenderedSize: readFluidMetric('data-preview-fluid-title-rendered-size', titleFontSize * actualScale),
        fluidHeaderHeight: readFluidMetric('data-preview-fluid-header-height', headerRect.height / actualScale),
        fluidHeroHeight: readFluidMetric('data-preview-fluid-hero-height', heroRootRect.height / actualScale),
        frameTransitionDurationMs: readTransitionDurationMs(getComputedStyle(currentFrame)),
        stageTransitionDurationMs: readTransitionDurationMs(getComputedStyle(stageElement)),
        viewportTransitionDurationMs: readTransitionDurationMs(getComputedStyle(currentViewport))
      });
    };

    const finishCapture = () => {
      capture.done = true;
      restoreFrameScheduler();
    };

    const sample = (timestamp: number) => {
      const targetDevice = stageElement.getAttribute('data-preview-target-device') ?? '';
      const renderDevice = stageElement.getAttribute('data-preview-render-device') ?? '';
      const phase = stageElement.getAttribute('data-preview-transition-phase') ?? '';
      if (!capture.started && (targetDevice !== capture.initialTarget || phase !== 'idle')) {
        capture.started = true;
        capture.startedAt = timestamp;
      }

      const settledPastDuration = capture.started
        && phase === 'idle'
        && targetDevice === renderDevice
        && targetDevice !== capture.initialTarget
        && performance.now() - capture.startedAt >= 420 + 120;
      if (timestamp - capture.lastSampleAt >= sampleIntervalMs - 1 || settledPastDuration) {
        recordSample(timestamp);
        capture.lastSampleAt = timestamp;
      }

      if (settledPastDuration || performance.now() - capture.startedAt > 2_000) {
        finishCapture();
        return;
      }
      requestAnimationFrame(sample);
    };

    recordSample(performance.now());
    requestAnimationFrame(sample);
  }, { rateHz: sampleRateHz });

  await page.getByRole('group', { name: 'Odzivni predogled' }).getByRole('button', { name: buttonName, exact: true }).click();
  await expect.poll(() => page.evaluate(() => (
    (window as typeof window & { __homepagePreviewCapture?: { done: boolean } }).__homepagePreviewCapture?.done ?? false
  ))).toBe(true);

  return page.evaluate((): PreviewSwitchCapture => (
    (window as typeof window & {
      __homepagePreviewCapture?: PreviewSwitchCapture;
    }).__homepagePreviewCapture ?? { samples: [] }
  ));
}

async function readSettledPreviewContract(page: Page) {
  return page.getByTestId('homepage-preview-stage').evaluate((stageElement) => {
    const frame = stageElement.querySelector<HTMLElement>('[data-testid="homepage-preview-frame"]');
    const liveLayer = stageElement.querySelector<HTMLElement>('[data-testid="homepage-preview-live-layer"]');
    const viewport = stageElement.querySelector<HTMLElement>('[data-testid="homepage-preview-viewport"]');
    const homepage = stageElement.querySelector<HTMLElement>('[data-preview-homepage-device]');
    if (!frame || !liveLayer || !viewport || !homepage) {
      throw new Error('Preview settlement instrumentation is incomplete.');
    }

    const renderers = Array.from(stageElement.querySelectorAll<HTMLElement>('[data-preview-homepage-device]'));
    const interactiveRenderers = Array.from(
      stageElement.querySelectorAll<HTMLElement>('[data-preview-renderer="interactive"]')
    ).filter((renderer) => {
      const style = getComputedStyle(renderer);
      return renderer.dataset.previewInteractive === 'true'
        && style.pointerEvents !== 'none'
        && Number.parseFloat(style.opacity) > 0.99
        && renderer.closest('[inert]') === null;
    });
    const viewportStyle = getComputedStyle(viewport);
    const transform = viewportStyle.transform;
    return {
      frameWidth: frame.getBoundingClientRect().width,
      viewportWidth: viewport.getBoundingClientRect().width,
      logicalWidth: Number(stageElement.getAttribute('data-preview-logical-width')),
      renderedWidth: Number(stageElement.getAttribute('data-preview-rendered-width')),
      reportedScale: Number(stageElement.getAttribute('data-preview-scale')),
      actualLogicalWidth: Number.parseFloat(viewportStyle.width),
      actualScale: transform === 'none' ? 1 : new DOMMatrixReadOnly(transform).a,
      frameOpacity: Number.parseFloat(getComputedStyle(frame).opacity),
      liveOpacity: Number.parseFloat(getComputedStyle(liveLayer).opacity),
      viewportOpacity: Number.parseFloat(viewportStyle.opacity),
      rendererOpacity: Number.parseFloat(getComputedStyle(homepage).opacity),
      rendererCount: renderers.length,
      interactiveRendererCount: interactiveRenderers.length,
      livePointerEvents: getComputedStyle(liveLayer).pointerEvents,
      previewAnimationIds: stageElement.getAnimations({ subtree: true })
        .filter((animation) => animation.id.startsWith('homepage-preview-'))
        .map((animation) => animation.id),
      documentOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth
    };
  });
}

test.describe('admin podoba redesign', () => {
  test('viewport switching continuously resizes one live responsive renderer across all breakpoints', async ({ page }) => {
    await page.setViewportSize({ width: 1600, height: 1000 });
    await page.goto('/admin/podoba/glavna-stran');
    const expectedPreviewWidths = {
      ...previewPresetWidths,
      desktop: await page.evaluate(() => document.documentElement.clientWidth)
    };

    const stage = page.getByTestId('homepage-preview-stage');
    const frame = page.getByTestId('homepage-preview-frame');
    const viewport = page.getByTestId('homepage-preview-viewport');
    const scrollRegion = page.getByTestId('homepage-preview-scroll-region');
    const toolbar = page.getByTestId('homepage-context-toolbar');
    await expect(stage).toHaveAttribute('data-preview-ready', 'true', { timeout: 15_000 });
    await expect(stage).toHaveAttribute('data-preview-target-device', 'desktop');
    await expect(stage).toHaveAttribute('data-preview-transitioning', 'false');
    await expect(stage).toHaveAttribute('data-preview-transition-phase', 'idle');

    const heroTitleLayer = page.locator('[data-testid="homepage-preview-live-layer"] [data-canvas-element-id="hero:title"]');
    await heroTitleLayer.dblclick();
    const editableTitle = heroTitleLayer.locator('h1');
    await expect(editableTitle).toHaveAttribute('contenteditable', 'true');
    await expect(editableTitle).toBeFocused();
    const editableTitleHandle = await editableTitle.elementHandle();
    expect(editableTitleHandle).not.toBeNull();

    await scrollRegion.evaluate((element) => { element.scrollTop = 120; });
    await expect.poll(() => scrollRegion.evaluate((element) => element.scrollTop)).toBe(120);

    const initialStageBox = await stage.boundingBox();
    const initialWindowScrollY = await page.evaluate(() => window.scrollY);
    const initialWindowScrollX = await page.evaluate(() => window.scrollX);
    expect(initialStageBox).not.toBeNull();

    const transitionSequence: Array<{
      from: PreviewDevice;
      button: 'Desktop' | 'Tablica' | 'Mobilno';
      to: PreviewDevice;
    }> = [
      { from: 'desktop', button: 'Tablica', to: 'tablet' },
      { from: 'tablet', button: 'Mobilno', to: 'mobile' },
      { from: 'mobile', button: 'Desktop', to: 'desktop' },
      { from: 'desktop', button: 'Mobilno', to: 'mobile' },
      { from: 'mobile', button: 'Tablica', to: 'tablet' },
      { from: 'tablet', button: 'Desktop', to: 'desktop' }
    ];
    for (const sampleRateHz of [60, 30] as const) {
      for (const transition of transitionSequence) {
        const transitionLabel = `${transition.from} -> ${transition.to} at ${sampleRateHz} Hz`;
        await expect(stage).toHaveAttribute('data-preview-target-device', transition.from);
        const { samples } = await captureViewportSwitch(page, transition.button, sampleRateHz);
        expect(samples.length, transitionLabel).toBeGreaterThan(8);

        const first = samples[0];
        const last = samples.at(-1)!;
        const captureSamplingToleranceMs = 1_000 / sampleRateHz + 8;
        expect(last.timestamp - first.timestamp, transitionLabel).toBeGreaterThanOrEqual(
          previewTransitionDurationMs + previewPostDurationBufferMs - captureSamplingToleranceMs
        );
        expect(first.renderDevice, transitionLabel).toBe(transition.from);
        expect(last.renderDevice, transitionLabel).toBe(transition.to);
        expect(first.logicalWidth, transitionLabel).toBeCloseTo(expectedPreviewWidths[transition.from], 2);
        expect(last.logicalWidth, transitionLabel).toBeCloseTo(expectedPreviewWidths[transition.to], 2);

        const firstSelectedSample = samples.find((sample) => sample.selectedDevice === transition.to);
        expect(firstSelectedSample, transitionLabel).toBeDefined();
        expect(
          Math.abs(firstSelectedSample!.logicalWidth - first.logicalWidth),
          `${transitionLabel}: first painted logical width jumped to the target`
        ).toBeLessThan(Math.abs(firstSelectedSample!.logicalWidth - last.logicalWidth));
        expect(
          Math.abs(firstSelectedSample!.renderedWidth - first.renderedWidth),
          `${transitionLabel}: first painted frame width jumped to the target`
        ).toBeLessThan(Math.abs(firstSelectedSample!.renderedWidth - last.renderedWidth));
        if (
          Math.abs(firstSelectedSample!.logicalWidth - first.logicalWidth) <= 0.5
          && Math.abs(firstSelectedSample!.renderedWidth - first.renderedWidth) <= 0.5
        ) {
          expect(firstSelectedSample!.renderDevice, `${transitionLabel}: mode swapped while geometry was unchanged`)
            .toBe(transition.from);
        }

        for (const sample of samples) {
          const classifiedMode = classifyPreviewWidth(sample.logicalWidth);
          expect(sample.responsiveMode, transitionLabel).toBe(classifiedMode);
          expect(sample.renderDevice, transitionLabel).toBe(classifiedMode);
          expect(sample.headerDevice, transitionLabel).toBe(classifiedMode);
          expect(sample.homepageDevice, transitionLabel).toBe(classifiedMode);
          expect(sample.targetDevice, transitionLabel).toBe(sample.selectedDevice);
          expect(sample.logicalWidth, transitionLabel).toBeCloseTo(sample.actualLogicalWidth, 1);
          expect(sample.renderedWidth, transitionLabel).toBeCloseTo(sample.frameWidth, 1);
          expect(sample.viewportWidth, transitionLabel).toBeCloseTo(sample.renderedWidth, 1);
          expect(sample.reportedScale, transitionLabel).toBeCloseTo(sample.actualScale, 4);
          expect(sample.actualScale, transitionLabel).toBeCloseTo(sample.renderedWidth / sample.logicalWidth, 4);
          expect(sample.frameOpacity, transitionLabel).toBe(1);
          expect(sample.liveOpacity, transitionLabel).toBe(1);
          expect(sample.viewportOpacity, transitionLabel).toBe(1);
          expect(sample.rendererOpacity, transitionLabel).toBe(1);
          expect(sample.opacityTarget, transitionLabel).toBe(1);
          expect(sample.layoutCovered, transitionLabel).toBe(false);
          expect(sample.rendererCount, transitionLabel).toBe(1);
          expect(sample.interactiveRendererCount, transitionLabel).toBe(
            sample.phase === 'animating' ? 0 : 1
          );
          if (sample.phase === 'animating') {
            expect(sample.livePointerEvents, transitionLabel).toBe('none');
          } else {
            expect(sample.livePointerEvents, transitionLabel).not.toBe('none');
          }
          expect(sample.titleOpacity, transitionLabel).toBe(1);
          expect(sample.titleLineCount, transitionLabel).toBeGreaterThanOrEqual(1);
          for (const metric of [
            sample.titleFontSize,
            sample.titleRenderedFontSize,
            sample.titleLineHeight,
            sample.titleRenderedLineHeight,
            sample.titleFontWeight,
            sample.titleLetterSpacing,
            sample.titleLogicalTop,
            sample.titleLogicalLeft,
            sample.titleLogicalWidth,
            sample.titleLogicalHeight,
            sample.heroContentLogicalTop,
            sample.heroContentLogicalLeft,
            sample.heroLogicalTop,
            sample.heroLogicalHeight,
            sample.headerLogicalHeight,
            sample.fluidTitleSize,
            sample.fluidTitleRenderedSize,
            sample.fluidHeaderHeight,
            sample.fluidHeroHeight
          ]) {
            expect(Number.isFinite(metric), `${transitionLabel}: preview style metric is not finite`).toBe(true);
          }
          expect(sample.fluidTitleSize, transitionLabel).toBeCloseTo(sample.titleFontSize, 1);
          expect(sample.fluidTitleRenderedSize, transitionLabel).toBeCloseTo(sample.titleRenderedFontSize, 1);
          expect(sample.fluidHeaderHeight, transitionLabel).toBeCloseTo(sample.headerLogicalHeight, 0);
          expect(
            sample.fluidHeroHeight * commercialStorefrontScale,
            transitionLabel
          ).toBeCloseTo(sample.heroLogicalHeight, 0);
          expect(sample.transitionEasing, transitionLabel).toBe('cubic-bezier(0.4, 0, 0.2, 1)');
          expect(sample.transitioning, transitionLabel).toBe(sample.phase === 'animating');
          expect(sample.transitionDurationMs, transitionLabel).toBe(
            sample.phase === 'animating' ? previewTransitionDurationMs : 0
          );

          expect(
            Math.abs((sample.frameLeft + sample.frameRight) / 2 - (sample.stageLeft + sample.stageRight) / 2),
            transitionLabel
          ).toBeLessThanOrEqual(1);
          expect(sample.stageTop, transitionLabel).toBeCloseTo(initialStageBox!.y, 1);
          expect(sample.stageHeight, transitionLabel).toBeCloseTo(initialStageBox!.height, 1);
          expect(sample.documentOverflow, transitionLabel).toBeLessThanOrEqual(0);
          expect(sample.previewScrollTop, transitionLabel).toBe(120);
          expect(sample.windowScrollX, transitionLabel).toBe(initialWindowScrollX);
          expect(sample.windowScrollY, transitionLabel).toBe(initialWindowScrollY);
          expect(sample.selectedElementId, transitionLabel).toBe('hero:title');
          expect(sample.activeElementPreserved, transitionLabel).toBe(true);
          expect(sample.frameNodePreserved, transitionLabel).toBe(true);
          expect(sample.viewportNodePreserved, transitionLabel).toBe(true);
          expect(sample.scrollRegionNodePreserved, transitionLabel).toBe(true);
          expect(sample.headerNodePreserved, transitionLabel).toBe(true);
          expect(sample.homepageNodePreserved, transitionLabel).toBe(true);
          expect(sample.heroNodePreserved, transitionLabel).toBe(true);
          expect(sample.editableNodePreserved, transitionLabel).toBe(true);
          expect(sample.selectionPreserved, transitionLabel).toBe(true);
          expect(sample.frameTransitionDurationMs, transitionLabel).toBe(0);
          expect(sample.stageTransitionDurationMs, transitionLabel).toBe(0);
          expect(sample.viewportTransitionDurationMs, transitionLabel).toBe(0);
        }

        const animationSamples = samples.filter((sample) => sample.phase === 'animating');
        expect(animationSamples.length, transitionLabel).toBeGreaterThan(3);
        for (const sample of animationSamples) {
          const logicalProgress = (sample.logicalWidth - first.logicalWidth) / (last.logicalWidth - first.logicalWidth);
          const renderedProgress = (sample.renderedWidth - first.renderedWidth) / (last.renderedWidth - first.renderedWidth);
          expect(logicalProgress, transitionLabel).toBeGreaterThanOrEqual(-0.002);
          expect(logicalProgress, transitionLabel).toBeLessThanOrEqual(1.002);
          expect(renderedProgress, transitionLabel).toBeCloseTo(logicalProgress, 2);
        }

        expectNoStyleSpike(samples, 'titleRenderedFontSize', transitionLabel);
        expectNoStyleSpike(samples, 'titleRenderedLineHeight', transitionLabel);
        for (const breakpoint of [767, 1024] as const) {
          const crossesBreakpoint = Math.min(first.logicalWidth, last.logicalWidth) <= breakpoint
            && Math.max(first.logicalWidth, last.logicalWidth) > breakpoint;
          if (crossesBreakpoint) {
            expectBreakpointStylesToBeContinuous(samples, breakpoint, transitionLabel);
          }
        }

        for (const field of ['logicalWidth', 'renderedWidth'] as const) {
          const significantDirections = new Set<number>();
          for (let index = 1; index < samples.length; index += 1) {
            const difference = samples[index][field] - samples[index - 1][field];
            if (Math.abs(difference) > 0.5) significantDirections.add(Math.sign(difference));
          }
          expect(significantDirections.size, `${transitionLabel}: ${field} reversed`).toBeLessThanOrEqual(1);
        }
        const endpointFrameWidths = [first.frameWidth, last.frameWidth];
        for (const sample of samples) {
          expect(sample.frameWidth, transitionLabel).toBeGreaterThanOrEqual(Math.min(...endpointFrameWidths) - 1);
          expect(sample.frameWidth, transitionLabel).toBeLessThanOrEqual(Math.max(...endpointFrameWidths) + 1);
        }

        const expectedModeSequence: Record<string, PreviewDevice[]> = {
          'desktop-tablet': ['desktop', 'tablet'],
          'tablet-mobile': ['tablet', 'mobile'],
          'mobile-desktop': ['mobile', 'tablet', 'desktop'],
          'desktop-mobile': ['desktop', 'tablet', 'mobile'],
          'mobile-tablet': ['mobile', 'tablet'],
          'tablet-desktop': ['tablet', 'desktop']
        };
        expect(
          compactDeviceSequence(samples.map((sample) => sample.responsiveMode)),
          `${transitionLabel}: responsive breakpoint order`
        ).toEqual(expectedModeSequence[`${transition.from}-${transition.to}`]);

        await expect(stage).toHaveAttribute('data-preview-target-device', transition.to);
        await expect(stage).toHaveAttribute('data-preview-render-device', transition.to);
        await expect(stage).toHaveAttribute('data-preview-transitioning', 'false');
        await expect(stage).toHaveAttribute('data-preview-transition-phase', 'idle');
        await expect(stage).toHaveAttribute('data-selected-element-id', 'hero:title');
        await expect(page.getByTestId('homepage-preview-live-layer')).toBeVisible();
        const settled = await readSettledPreviewContract(page);
        expect(settled.frameOpacity, transitionLabel).toBe(1);
        expect(settled.liveOpacity, transitionLabel).toBe(1);
        expect(settled.viewportOpacity, transitionLabel).toBe(1);
        expect(settled.rendererOpacity, transitionLabel).toBe(1);
        expect(settled.rendererCount, transitionLabel).toBe(1);
        expect(settled.interactiveRendererCount, transitionLabel).toBe(1);
        expect(settled.livePointerEvents, transitionLabel).not.toBe('none');
        expect(settled.previewAnimationIds, transitionLabel).toEqual([]);
        expect(settled.frameWidth, transitionLabel).toBeCloseTo(settled.renderedWidth, 1);
        expect(settled.viewportWidth, transitionLabel).toBeCloseTo(settled.renderedWidth, 1);
        expect(settled.logicalWidth, transitionLabel).toBeCloseTo(settled.actualLogicalWidth, 1);
        expect(settled.reportedScale, transitionLabel).toBeCloseTo(settled.actualScale, 4);
        expect(settled.actualScale, transitionLabel)
          .toBeCloseTo(settled.renderedWidth / settled.logicalWidth, 4);
        expect(settled.documentOverflow, transitionLabel).toBeLessThanOrEqual(0);
        expect(await editableTitleHandle!.evaluate((element) => element.isConnected)).toBe(true);
        await expect(editableTitle).toHaveAttribute('contenteditable', 'true');
        await expect(editableTitle).toBeFocused();
        await expect.poll(() => scrollRegion.evaluate((element) => element.scrollTop)).toBe(120);
      }
    }

    const finalToolbarBox = await toolbar.boundingBox();
    const finalFrameBox = await frame.boundingBox();
    const finalAnchorBox = await heroTitleLayer.boundingBox();
    expect(finalToolbarBox).not.toBeNull();
    expect(finalFrameBox).not.toBeNull();
    expect(finalAnchorBox).not.toBeNull();
    await expect(toolbar).toHaveAttribute('data-homepage-toolbar-anchor-id', 'hero:title');
    await expect(toolbar).toHaveAttribute('data-toolbar-ready', 'true');
    const finalToolbarPlacement = await toolbar.getAttribute('data-toolbar-placement');
    expect(['top', 'bottom']).toContain(finalToolbarPlacement);
    expect(finalToolbarBox!.x).toBeGreaterThanOrEqual(finalFrameBox!.x - 2);
    expect(finalToolbarBox!.x + finalToolbarBox!.width)
      .toBeLessThanOrEqual(finalFrameBox!.x + finalFrameBox!.width + 2);
    if (finalToolbarPlacement === 'top') {
      expect(finalToolbarBox!.y + finalToolbarBox!.height).toBeLessThanOrEqual(finalAnchorBox!.y + 3);
    } else {
      expect(finalToolbarBox!.y).toBeGreaterThanOrEqual(finalAnchorBox!.y + finalAnchorBox!.height - 3);
    }
    expect(await page.evaluate(() => window.scrollY)).toBe(initialWindowScrollY);
    for (const element of [stage, frame, viewport]) {
      await expect(element).toHaveCSS('transition-duration', '0s');
    }
  });

  test('rapid Desktop to Mobilno to Tablica switching cancels and retargets the active motion', async ({ page }) => {
    await page.setViewportSize({ width: 1600, height: 1000 });
    await page.goto('/admin/podoba/glavna-stran');
    const controls = page.getByRole('group', { name: 'Odzivni predogled' });
    const stage = page.getByTestId('homepage-preview-stage');
    const scrollRegion = page.getByTestId('homepage-preview-scroll-region');
    const mobileButton = controls.getByRole('button', { name: 'Mobilno', exact: true });
    const tabletButton = controls.getByRole('button', { name: 'Tablica', exact: true });
    await expect(stage).toHaveAttribute('data-preview-ready', 'true', { timeout: 15_000 });
    await expect(stage).toHaveAttribute('data-preview-target-device', 'desktop');

    const heroTitleLayer = page.locator('[data-testid="homepage-preview-live-layer"] [data-canvas-element-id="hero:title"]');
    await heroTitleLayer.dblclick();
    const editableTitle = heroTitleLayer.locator('h1');
    await expect(editableTitle).toBeFocused();
    await scrollRegion.evaluate((element) => { element.scrollTop = 120; });

    await mobileButton.click();
    await expect(stage).toHaveAttribute('data-preview-transition-phase', 'animating');
    await expect.poll(
      () => stage.getAttribute('data-preview-logical-width').then((value) => Number(value)),
      { timeout: 1_000, intervals: [16, 16, 16] }
    ).toBeLessThan(1360);

    const sampleRateHz = 60;
    const { samples } = await captureViewportSwitch(page, 'Tablica', sampleRateHz);
    const last = samples.at(-1)!;
    const firstTabletSampleIndex = samples.findIndex((sample) => sample.selectedDevice === 'tablet');
    const firstTabletSample = samples[firstTabletSampleIndex];
    const preRetargetSample = samples[firstTabletSampleIndex - 1];
    expect(firstTabletSample).toBeDefined();
    expect(preRetargetSample).toBeDefined();
    expect(firstTabletSample.logicalWidth).toBeCloseTo(preRetargetSample.logicalWidth, 2);
    expect(firstTabletSample.renderedWidth).toBeCloseTo(preRetargetSample.renderedWidth, 2);

    for (const sample of samples) {
      expect(sample.renderDevice).toBe(classifyPreviewWidth(sample.logicalWidth));
      expect(sample.responsiveMode).toBe(sample.renderDevice);
      expect(sample.headerDevice).toBe(sample.renderDevice);
      expect(sample.homepageDevice).toBe(sample.renderDevice);
      expect(sample.actualScale).toBeCloseTo(sample.renderedWidth / sample.logicalWidth, 4);
      expect(sample.reportedScale).toBeCloseTo(sample.actualScale, 4);
      expect(sample.frameOpacity).toBe(1);
      expect(sample.liveOpacity).toBe(1);
      expect(sample.viewportOpacity).toBe(1);
      expect(sample.rendererOpacity).toBe(1);
      expect(sample.rendererCount).toBe(1);
      expect(sample.interactiveRendererCount).toBe(sample.phase === 'animating' ? 0 : 1);
      expect(sample.activeElementPreserved).toBe(true);
      expect(sample.selectionPreserved).toBe(true);
      expect(sample.previewScrollTop).toBe(120);
      expect(sample.documentOverflow).toBeLessThanOrEqual(0);
    }

    const retargetSamples = samples.filter((sample) => sample.selectedDevice === 'tablet');
    for (const sample of retargetSamples) {
      expect(sample.logicalWidth).toBeGreaterThanOrEqual(
        Math.min(previewPresetWidths.tablet, preRetargetSample.logicalWidth) - 1
      );
      expect(sample.logicalWidth).toBeLessThanOrEqual(
        Math.max(previewPresetWidths.tablet, preRetargetSample.logicalWidth) + 1
      );
      expect(sample.renderedWidth).toBeGreaterThanOrEqual(
        Math.min(last.renderedWidth, preRetargetSample.renderedWidth) - 1
      );
      expect(sample.renderedWidth).toBeLessThanOrEqual(
        Math.max(last.renderedWidth, preRetargetSample.renderedWidth) + 1
      );
      if (preRetargetSample.renderDevice !== 'mobile') {
        expect(sample.renderDevice).not.toBe('mobile');
      }
    }
    const firstSettledTabletSample = retargetSamples.find((sample) => sample.phase === 'idle');
    expect(firstSettledTabletSample).toBeDefined();
    const frameSamplingToleranceMs = Math.ceil(1_000 / sampleRateHz);
    expect(firstSettledTabletSample!.timestamp - firstTabletSample!.timestamp)
      .toBeLessThanOrEqual(
        previewTransitionDurationMs + previewPostDurationBufferMs + frameSamplingToleranceMs
      );

    await expect(stage).toHaveAttribute('data-preview-target-device', 'tablet');
    await expect(stage).toHaveAttribute('data-preview-render-device', 'tablet');
    await expect(stage).toHaveAttribute('data-preview-transitioning', 'false');
    await expect(stage).toHaveAttribute('data-preview-logical-width', '1024.000');
    await expect(tabletButton).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByTestId('homepage-preview-live-layer')).toBeVisible();
    const settled = await readSettledPreviewContract(page);
    expect(settled.frameOpacity).toBe(1);
    expect(settled.liveOpacity).toBe(1);
    expect(settled.viewportOpacity).toBe(1);
    expect(settled.rendererOpacity).toBe(1);
    expect(settled.rendererCount).toBe(1);
    expect(settled.interactiveRendererCount).toBe(1);
    expect(settled.previewAnimationIds).toEqual([]);
    expect(settled.frameWidth).toBeCloseTo(settled.renderedWidth, 1);
    expect(settled.viewportWidth).toBeCloseTo(settled.renderedWidth, 1);
    expect(settled.documentOverflow).toBeLessThanOrEqual(0);
    await expect(editableTitle).toBeFocused();
    await expect.poll(() => scrollRegion.evaluate((element) => element.scrollTop)).toBe(120);
  });

  test('reduced motion commits every live viewport endpoint atomically', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.setViewportSize({ width: 1600, height: 1000 });
    await page.goto('/admin/podoba/glavna-stran');
    const desktopWidth = await page.evaluate(() => document.documentElement.clientWidth);

    const controls = page.getByRole('group', { name: 'Odzivni predogled' });
    const stage = page.getByTestId('homepage-preview-stage');
    const scrollRegion = page.getByTestId('homepage-preview-scroll-region');
    const sequence = [
      { button: 'Tablica' as const, device: 'tablet', width: '1024.000' },
      { button: 'Mobilno' as const, device: 'mobile', width: '390.000' },
      { button: 'Desktop' as const, device: 'desktop', width: desktopWidth.toFixed(3) },
      { button: 'Mobilno' as const, device: 'mobile', width: '390.000' },
      { button: 'Tablica' as const, device: 'tablet', width: '1024.000' },
      { button: 'Desktop' as const, device: 'desktop', width: desktopWidth.toFixed(3) }
    ];

    await expect(stage).toHaveAttribute('data-preview-ready', 'true', { timeout: 15_000 });
    await expect(stage).toHaveAttribute('data-preview-reduced-motion', 'true');

    const heroTitleLayer = page.locator('[data-testid="homepage-preview-live-layer"] [data-canvas-element-id="hero:title"]');
    await heroTitleLayer.dblclick();
    const editableTitle = heroTitleLayer.locator('h1');
    const editableTitleHandle = await editableTitle.elementHandle();
    expect(editableTitleHandle).not.toBeNull();
    await scrollRegion.evaluate((element) => { element.scrollTop = 120; });

    for (const target of sequence) {
      await controls.getByRole('button', { name: target.button, exact: true }).click();
      await expect(stage).toHaveAttribute('data-preview-selected-device', target.device);
      await expect(stage).toHaveAttribute('data-preview-target-device', target.device);
      await expect(stage).toHaveAttribute('data-preview-render-device', target.device);
      await expect(stage).toHaveAttribute('data-preview-responsive-mode', target.device);
      await expect(stage).toHaveAttribute('data-preview-logical-width', target.width);
      await expect(stage).toHaveAttribute('data-preview-transitioning', 'false');
      await expect(stage).toHaveAttribute('data-preview-transition-phase', 'idle');
      await expect(stage).toHaveAttribute('data-preview-transition-duration-ms', '0');
      await expect(page.getByTestId('homepage-preview-live-layer')).toBeVisible();

      const settled = await readSettledPreviewContract(page);
      expect(settled.logicalWidth, target.device).toBe(Number.parseFloat(target.width));
      expect(settled.actualLogicalWidth, target.device).toBeCloseTo(settled.logicalWidth, 1);
      expect(settled.frameOpacity, target.device).toBe(1);
      expect(settled.liveOpacity, target.device).toBe(1);
      expect(settled.viewportOpacity, target.device).toBe(1);
      expect(settled.rendererOpacity, target.device).toBe(1);
      expect(settled.rendererCount, target.device).toBe(1);
      expect(settled.interactiveRendererCount, target.device).toBe(1);
      expect(settled.livePointerEvents, target.device).not.toBe('none');
      expect(settled.previewAnimationIds, target.device).toEqual([]);
      expect(settled.frameWidth, target.device).toBeCloseTo(settled.renderedWidth, 1);
      expect(settled.viewportWidth, target.device).toBeCloseTo(settled.renderedWidth, 1);
      expect(settled.reportedScale, target.device).toBeCloseTo(settled.actualScale, 4);
      expect(settled.actualScale, target.device)
        .toBeCloseTo(settled.renderedWidth / settled.logicalWidth, 4);
      expect(settled.documentOverflow, target.device).toBeLessThanOrEqual(0);
      expect(await editableTitleHandle!.evaluate((element) => element.isConnected), target.device).toBe(true);
      await expect(editableTitle).toBeFocused();
      await expect.poll(() => scrollRegion.evaluate((element) => element.scrollTop)).toBe(120);
    }
  });
});
