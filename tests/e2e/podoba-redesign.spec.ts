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
    Math.abs(after.heroContentLogicalTop - before.heroContentLogicalTop),
    `${boundaryLabel}: hero content inset jumped`
  ).toBeLessThanOrEqual(Math.max(2, widthStep * 0.12));
  expect(
    Math.abs(after.heroContentLogicalLeft - before.heroContentLogicalLeft),
    `${boundaryLabel}: hero content horizontal inset jumped`
  ).toBeLessThanOrEqual(Math.max(2, widthStep * 0.12));
  expect(
    Math.abs(after.heroLogicalTop - before.heroLogicalTop),
    `${boundaryLabel}: hero top position jumped`
  ).toBeLessThanOrEqual(Math.max(1, widthStep * 0.05));
  expect(
    Math.abs(after.titleLogicalTop - before.titleLogicalTop),
    `${boundaryLabel}: title top position jumped`
  ).toBeLessThanOrEqual(Math.max(2, widthStep * 0.12));
  expect(
    Math.abs(after.titleLogicalLeft - before.titleLogicalLeft),
    `${boundaryLabel}: title horizontal position jumped`
  ).toBeLessThanOrEqual(Math.max(2, widthStep * 0.12));
  if (before.titleLineCount === after.titleLineCount) {
    expect(
      Math.abs(after.titleLogicalHeight - before.titleLogicalHeight),
      `${boundaryLabel}: title height was an outlier without a natural rewrap`
    ).toBeLessThanOrEqual(Math.max(2, widthStep * 0.1));
  }
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
  test('landing editor is preview-focused and updates the toolbar for a selected hero element', async ({ page }) => {
    await page.goto('/admin/podoba/glavna-stran');

    const toolbar = page.getByTestId('homepage-context-toolbar');
    await expect(toolbar).toBeVisible({ timeout: 15_000 });

    await expect(page.getByRole('tab', { name: 'Sekcije', exact: true })).toHaveCount(0);
    await expect(page.getByRole('tab', { name: 'Nastavitve strani', exact: true })).toHaveCount(0);

    await expect(toolbar.getByRole('button', { name: 'Dodaj besedilo, gumb ali sekcijo' })).toBeVisible();
    await expect(toolbar.getByRole('button', { name: 'Podvoji', exact: true })).toHaveCount(0);

    const categoriesSection = page.locator('[data-homepage-section="categories"]');
    const categoryImages = categoriesSection.locator('[data-homepage-category-image]');
    await expect(categoriesSection).toBeVisible();
    await expect(categoryImages.first()).toHaveCSS('filter', 'none');
    await expect(categoryImages.nth(1)).toHaveCSS('filter', 'none');

    const categoriesSectionBox = await categoriesSection.boundingBox();
    expect(categoriesSectionBox).not.toBeNull();
    await categoriesSection.click({ position: { x: (categoriesSectionBox?.width ?? 4) - 2, y: 2 } });
    await page.mouse.move(0, 0);
    await expect(categoriesSection).toHaveAttribute('data-admin-editor-selection-frame', 'true');
    for (const image of await categoryImages.all()) {
      await expect(image).toHaveCSS('filter', 'none');
    }
    const sectionOutline = await categoriesSection.evaluate((element) => {
      const style = getComputedStyle(element);
      return {
        outlineStyle: style.outlineStyle,
        outlineWidth: style.outlineWidth,
        outlineOffset: style.outlineOffset,
        radii: [
          style.borderTopLeftRadius,
          style.borderTopRightRadius,
          style.borderBottomRightRadius,
          style.borderBottomLeftRadius
        ]
      };
    });
    expect(sectionOutline.outlineStyle).toBe('solid');
    expect(sectionOutline.outlineWidth).toBe('2px');
    expect(sectionOutline.outlineOffset).toBe('-2px');
    expect(new Set(sectionOutline.radii).size).toBe(1);
    expect(parseFloat(sectionOutline.radii[0] ?? '0')).toBeGreaterThan(0);

    const firstCategoryCard = categoriesSection.locator('[data-homepage-category-card]').first();
    const firstCategoryImageCanvas = firstCategoryCard.locator(
      '[data-homepage-canvas-element][data-canvas-element-id^="categories:image:"]'
    );
    await firstCategoryImageCanvas.click();
    const categoryActionStack = firstCategoryCard.getByTestId('homepage-category-action-stack');
    const categoryActions = categoryActionStack.locator('button[data-canvas-action][aria-label]');
    await expect(categoryActions).toHaveCount(5);
    await expect(categoryActions.nth(0)).toHaveAttribute('aria-label', /^Odstrani sliko/);
    await expect(categoryActions.nth(1)).toHaveAttribute('aria-label', /^Dodaj ali zamenjaj sliko/);
    await expect(categoryActions.nth(2)).toHaveAttribute('aria-label', /^Uredi slog kategorije/);
    await expect(categoryActions.nth(3)).toHaveAttribute('aria-label', /^Skrij kategorijo/);
    await expect(categoryActions.nth(4)).toHaveAttribute('aria-label', /^Premakni kategorijo/);
    const categoryActionRail = await categoryActions.evaluateAll((actions) => {
      const stack = actions[0]?.parentElement as HTMLElement;
      const tile = actions[0]?.closest('[data-testid="category-showcase-tile"]') as HTMLElement;
      const tileRect = tile.getBoundingClientRect();
      const buttonRects = actions.map((action) => action.getBoundingClientRect());
      return {
        direction: getComputedStyle(stack).flexDirection,
        gap: getComputedStyle(stack).gap,
        outsideMedia: actions[0]?.closest('[data-testid="category-showcase-media"]') === null,
        xPositions: buttonRects.map((rect) => Math.round(rect.x * 10) / 10),
        yPositions: buttonRects.map((rect) => rect.y),
        topInset: buttonRects[0].top - tileRect.top,
        rightInset: tileRect.right - Math.max(...buttonRects.map((rect) => rect.right)),
        bottomInset: tileRect.bottom - buttonRects.at(-1)!.bottom
      };
    });
    expect(categoryActionRail.direction).toBe('column');
    expect(categoryActionRail.gap).toBe('3px');
    expect(categoryActionRail.outsideMedia).toBe(true);
    expect(new Set(categoryActionRail.xPositions).size).toBe(1);
    expect(categoryActionRail.yPositions).toEqual([...categoryActionRail.yPositions].sort((first, second) => first - second));
    expect(Math.abs(categoryActionRail.topInset - categoryActionRail.bottomInset)).toBeLessThanOrEqual(1);
    expect(categoryActionRail.topInset).toBeGreaterThanOrEqual(10);
    expect(categoryActionRail.bottomInset).toBeGreaterThanOrEqual(10);
    expect(categoryActionRail.rightInset).toBeGreaterThanOrEqual(8);

    const firstCategoryTitle = categoriesSection.locator('[data-canvas-element-id^="categories:title:"]').first();
    await expect(firstCategoryTitle.locator('h3')).not.toHaveAttribute('contenteditable', 'true');
    await categoryActions.nth(2).click();
    await expect(toolbar.getByRole('button', { name: 'Slog besedila', exact: true })).toBeVisible();
    await expect(toolbar.getByRole('button', { name: 'Podvoji', exact: true })).toBeDisabled();

    const heroTitle = page.locator(
      '[data-homepage-canvas-element][data-canvas-element-id="hero:title"]'
    );
    await expect(heroTitle).toBeVisible();
    await heroTitle.click();

    await expect(toolbar.getByRole('button', { name: 'Podvoji', exact: true })).toBeVisible();
    await expect(toolbar.getByRole('button', { name: 'Slog besedila', exact: true })).toBeVisible();
    await expect(toolbar.getByRole('button', { name: 'Skrij', exact: true })).toBeVisible();

    await toolbar.getByRole('button', { name: 'Slog besedila', exact: true }).click();
    const fontSelect = page.getByRole('combobox', { name: 'Pisava', exact: true });
    await expect(fontSelect.getByRole('option', { name: 'IBM Plex Sans · priporočeno', exact: true })).toHaveCount(1);
    await expect(fontSelect.getByRole('option', { name: 'Source Sans 3', exact: true })).toHaveCount(1);
    await expect(fontSelect.getByRole('option', { name: 'Space Grotesk', exact: true })).toHaveCount(1);
    await expect(categoryImages.first()).toHaveCSS('filter', 'none');
  });

  test('category title edit scope keeps canonical labels read-only and responsive overrides independent', async ({ page }) => {
    await page.setViewportSize({ width: 1600, height: 1000 });
    await page.goto('/admin/podoba/glavna-stran');

    const stage = page.getByTestId('homepage-preview-stage');
    const toolbar = page.getByTestId('homepage-context-toolbar');
    const categoryTitles = page.locator(
      '[data-homepage-canvas-element][data-canvas-element-id^="categories:title:"]'
    );
    await expect(stage).toHaveAttribute('data-preview-ready', 'true', { timeout: 15_000 });
    await expect(categoryTitles.first()).toBeVisible({ timeout: 15_000 });

    const titleIdentity = await categoryTitles.evaluateAll((elements) => elements.map((element) => {
      const id = element.getAttribute('data-canvas-element-id') ?? '';
      return {
        id,
        slug: id.slice('categories:title:'.length),
        labelSlug: element.getAttribute('data-homepage-category-label') ?? '',
        text: element.querySelector('h3')?.textContent?.trim() ?? ''
      };
    }));
    expect(titleIdentity.length).toBeGreaterThan(1);
    expect(new Set(titleIdentity.map(({ id }) => id)).size).toBe(titleIdentity.length);
    for (const title of titleIdentity) {
      expect(title.id).toBe(`categories:title:${title.slug}`);
      expect(title.slug).not.toBe('');
      expect(title.labelSlug).toBe(title.slug);
      expect(title.text).not.toBe('');
    }

    const firstTitle = page.locator(
      `[data-homepage-canvas-element][data-canvas-element-id="${titleIdentity[0].id}"]`
    );
    const canonicalTitle = titleIdentity[0].text;
    await firstTitle.click();
    await firstTitle.locator('h3').dblclick();
    await expect(firstTitle.locator('h3')).not.toHaveAttribute('contenteditable', 'true');
    await expect(firstTitle.locator('[contenteditable="true"]')).toHaveCount(0);
    await expect(firstTitle.locator('h3')).toHaveText(canonicalTitle);

    const readMetrics = () => categoryTitles.evaluateAll((elements) => elements.map((element) => {
      const wrapperStyle = getComputedStyle(element);
      const label = element.querySelector('h3') ?? element;
      const labelStyle = getComputedStyle(label);
      const matrix = wrapperStyle.transform === 'none'
        ? new DOMMatrixReadOnly()
        : new DOMMatrixReadOnly(wrapperStyle.transform);
      return {
        id: element.getAttribute('data-canvas-element-id') ?? '',
        fontSize: Math.round(Number.parseFloat(labelStyle.fontSize) * 100) / 100,
        x: Math.round(matrix.m41 * 100) / 100
      };
    }));
    const expectMetrics = async (fontSizes: number[], xPositions?: number[]) => {
      await expect.poll(async () => (await readMetrics()).map(({ fontSize }) => fontSize)).toEqual(fontSizes);
      if (xPositions) {
        await expect.poll(async () => (await readMetrics()).map(({ x }) => x)).toEqual(xPositions);
      }
    };

    const titleCount = titleIdentity.length;
    const desktopAllFontSize = 22;
    const desktopSelectedFontSize = 29;
    const desktopAllX = 11;
    const desktopSelectedX = 27;
    const tabletSelectedFontSize = 18;
    const tabletSelectedX = -13;

    await toolbar.getByRole('button', { name: 'Slog besedila', exact: true }).click();
    let dialog = page.getByRole('dialog');
    await dialog.getByTestId('homepage-category-title-scope-all').click();
    await dialog.getByRole('spinbutton', { name: 'Velikost px', exact: true }).fill(String(desktopAllFontSize));
    await expectMetrics(Array(titleCount).fill(desktopAllFontSize));
    await dialog.getByRole('button', { name: 'Zapri', exact: true }).click();

    await toolbar.getByRole('button', { name: 'Mere in poravnava', exact: true }).click();
    dialog = page.getByRole('dialog');
    await dialog.getByTestId('homepage-category-title-scope-all').click();
    await dialog.getByRole('spinbutton', { name: 'X px', exact: true }).fill(String(desktopAllX));
    await expectMetrics(
      Array(titleCount).fill(desktopAllFontSize),
      Array(titleCount).fill(desktopAllX)
    );
    await dialog.getByRole('button', { name: 'Zapri', exact: true }).click();

    await toolbar.getByRole('button', { name: 'Slog besedila', exact: true }).click();
    dialog = page.getByRole('dialog');
    await dialog.getByTestId('homepage-category-title-scope-selected').click();
    await dialog.getByRole('spinbutton', { name: 'Velikost px', exact: true }).fill(String(desktopSelectedFontSize));
    await expectMetrics([
      desktopSelectedFontSize,
      ...Array(titleCount - 1).fill(desktopAllFontSize)
    ]);
    await dialog.getByRole('button', { name: 'Zapri', exact: true }).click();

    await toolbar.getByRole('button', { name: 'Mere in poravnava', exact: true }).click();
    dialog = page.getByRole('dialog');
    await dialog.getByTestId('homepage-category-title-scope-selected').click();
    await dialog.getByRole('spinbutton', { name: 'X px', exact: true }).fill(String(desktopSelectedX));
    await expectMetrics(
      [desktopSelectedFontSize, ...Array(titleCount - 1).fill(desktopAllFontSize)],
      [desktopSelectedX, ...Array(titleCount - 1).fill(desktopAllX)]
    );
    await dialog.getByRole('button', { name: 'Zapri', exact: true }).click();

    await page.getByRole('button', { name: 'Tablica', exact: true }).click();
    await expect(stage).toHaveAttribute('data-preview-target-device', 'tablet');
    await expect(stage).toHaveAttribute('data-preview-transitioning', 'false', { timeout: 2_000 });
    await expect(toolbar.getByText(canonicalTitle, { exact: true })).toBeVisible();
    const tabletBaseline = await readMetrics();

    await toolbar.getByRole('button', { name: 'Slog besedila', exact: true }).click();
    dialog = page.getByRole('dialog');
    await dialog.getByTestId('homepage-category-title-scope-selected').click();
    await dialog.getByRole('spinbutton', { name: 'Velikost px', exact: true }).fill(String(tabletSelectedFontSize));
    await dialog.getByRole('button', { name: 'Zapri', exact: true }).click();
    await toolbar.getByRole('button', { name: 'Mere in poravnava', exact: true }).click();
    dialog = page.getByRole('dialog');
    await dialog.getByTestId('homepage-category-title-scope-selected').click();
    await dialog.getByRole('spinbutton', { name: 'X px', exact: true }).fill(String(tabletSelectedX));
    await expectMetrics(
      [tabletSelectedFontSize, ...tabletBaseline.slice(1).map(({ fontSize }) => fontSize)],
      [tabletSelectedX, ...tabletBaseline.slice(1).map(({ x }) => x)]
    );
    await dialog.getByRole('button', { name: 'Zapri', exact: true }).click();

    await page.getByRole('button', { name: 'Desktop', exact: true }).click();
    await expect(stage).toHaveAttribute('data-preview-target-device', 'desktop');
    await expect(stage).toHaveAttribute('data-preview-transitioning', 'false', { timeout: 2_000 });
    await expectMetrics(
      [desktopSelectedFontSize, ...Array(titleCount - 1).fill(desktopAllFontSize)],
      [desktopSelectedX, ...Array(titleCount - 1).fill(desktopAllX)]
    );
    await expect(firstTitle.locator('h3')).toHaveText(canonicalTitle);

    const groupHeading = page.locator(
      '[data-homepage-canvas-element][data-canvas-element-id="categories:heading"]'
    );
    const readGroupHeadingX = () => groupHeading.evaluate((element) => {
      const transform = getComputedStyle(element).transform;
      return Math.round((transform === 'none' ? 0 : new DOMMatrixReadOnly(transform).m41) * 100) / 100;
    });
    await expect(groupHeading).toBeVisible();
    await groupHeading.click();
    await toolbar.getByRole('button', { name: 'Mere in poravnava', exact: true }).click();
    dialog = page.getByRole('dialog');
    await dialog.getByRole('spinbutton', { name: 'X px', exact: true }).fill('17');
    await expect.poll(readGroupHeadingX).toBe(17);
    await dialog.getByRole('button', { name: 'Zapri', exact: true }).click();

    await page.getByRole('button', { name: 'Tablica', exact: true }).click();
    await expect(stage).toHaveAttribute('data-preview-transitioning', 'false', { timeout: 2_000 });
    await groupHeading.click();
    await toolbar.getByRole('button', { name: 'Mere in poravnava', exact: true }).click();
    dialog = page.getByRole('dialog');
    await dialog.getByRole('spinbutton', { name: 'X px', exact: true }).fill('-9');
    await expect.poll(readGroupHeadingX).toBe(-9);
    await dialog.getByRole('button', { name: 'Zapri', exact: true }).click();

    await page.getByRole('button', { name: 'Desktop', exact: true }).click();
    await expect(stage).toHaveAttribute('data-preview-transitioning', 'false', { timeout: 2_000 });
    await expect.poll(readGroupHeadingX).toBe(17);
  });

  test('footer logo and description are independent responsive canvas elements', async ({ page }) => {
    await page.setViewportSize({ width: 1600, height: 1000 });
    await page.goto('/admin/podoba/glavna-stran');

    const toolbar = page.getByTestId('homepage-context-toolbar');
    const logo = page.locator('[data-canvas-element-id="footer:logo"]');
    const description = page.locator('[data-canvas-element-id="footer:description"]');
    await expect(page.getByTestId('homepage-preview-stage')).toHaveAttribute('data-preview-ready', 'true', { timeout: 15_000 });
    await page.getByTestId('homepage-preview-scroll-region').evaluate((element) => {
      element.scrollTop = element.scrollHeight;
    });
    await expect(logo).toBeVisible({ timeout: 15_000 });
    await expect(description).toBeVisible();
    await expect(logo).toHaveCount(1);
    await expect(description).toHaveCount(1);

    await description.click();
    await expect(toolbar.getByText('Opis noge', { exact: true })).toBeVisible();
    await expect(toolbar.getByRole('button', { name: 'Podvoji', exact: true })).toBeDisabled();
    await toolbar.getByRole('button', { name: 'Slog besedila', exact: true }).click();
    await page.getByRole('button', { name: 'Ležeče', exact: true }).click();
    await page.getByRole('button', { name: 'Podčrtano', exact: true }).click();
    await expect(description.locator('p')).toHaveCSS('font-style', 'italic');
    await expect(description).toHaveCSS('text-decoration-line', 'underline');
    await expect(page.getByRole('spinbutton', { name: 'Višina vrstice', exact: true })).toBeVisible();
    await expect(page.getByRole('spinbutton', { name: 'Razmik črk px', exact: true })).toBeVisible();

    await page.getByRole('button', { name: 'Zapri', exact: true }).click();
    await toolbar.getByRole('button', { name: 'Mere in poravnava', exact: true }).click();
    await expect(page.getByRole('spinbutton', { name: 'X px', exact: true })).toBeVisible();
    await expect(page.getByRole('spinbutton', { name: 'Y px', exact: true })).toBeVisible();

    await page.getByRole('button', { name: 'Zapri', exact: true }).click();
    await logo.click();
    await expect(toolbar.getByText('Logotip noge', { exact: true })).toBeVisible();
    await expect(toolbar.getByRole('button', { name: 'Slog besedila', exact: true })).toHaveCount(0);
    await expect(toolbar.getByRole('button', { name: 'Podvoji', exact: true })).toBeDisabled();
    await toolbar.getByRole('button', { name: 'Mere in poravnava', exact: true }).click();
    await page.getByRole('spinbutton', { name: 'Višina px', exact: true }).fill('56');

    const resizedLogo = await logo.evaluate((element) => {
      const svg = element.querySelector('svg');
      return {
        elementHeight: (element as HTMLElement).offsetHeight,
        svgHeight: svg?.getBoundingClientRect().height ?? 0,
        elementRenderedHeight: element.getBoundingClientRect().height
      };
    });
    expect(resizedLogo.elementHeight).toBe(56);
    expect(Math.abs(resizedLogo.svgHeight - resizedLogo.elementRenderedHeight)).toBeLessThan(1.5);

    await page.getByRole('button', { name: 'Zapri', exact: true }).click();
    const logoTransformBeforeDrag = await logo.evaluate((element) => getComputedStyle(element).transform);
    const logoBox = await logo.boundingBox();
    expect(logoBox).not.toBeNull();
    await page.mouse.move(logoBox!.x + logoBox!.width / 2, logoBox!.y + logoBox!.height / 2);
    await page.mouse.down();
    await page.mouse.move(logoBox!.x + logoBox!.width / 2 + 24, logoBox!.y + logoBox!.height / 2 + 16);
    await page.mouse.up();
    await expect.poll(() => logo.evaluate((element) => getComputedStyle(element).transform)).not.toBe(logoTransformBeforeDrag);

    await page.getByRole('button', { name: 'Tablica', exact: true }).click();
    await expect(page.getByTestId('homepage-preview-stage')).toHaveAttribute('data-preview-transitioning', 'false', { timeout: 2_000 });
    expect(await logo.evaluate((element) => (element as HTMLElement).offsetHeight)).not.toBe(56);
  });

  test('inline footer description edits save through the canonical navigation footer patch', async ({ page }) => {
    let navigationPatch: { footer: { description: string } } | undefined;
    let landingSaveCount = 0;

    await page.route('**/api/admin/site-navigation', async (route) => {
      if (route.request().method() !== 'PATCH') {
        await route.continue();
        return;
      }
      navigationPatch = route.request().postDataJSON() as { footer: { description: string } };
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ config: { footer: navigationPatch.footer } })
      });
    });
    await page.route('**/api/admin/landing-page', async (route) => {
      if (route.request().method() !== 'PUT') {
        await route.continue();
        return;
      }
      landingSaveCount += 1;
      const requestBody = route.request().postDataJSON() as { config: Record<string, unknown> };
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ config: requestBody.config })
      });
    });

    await page.goto('/admin/podoba/glavna-stran');
    const description = page.locator('[data-canvas-element-id="footer:description"]');
    const editableText = description.locator('p');
    const nextDescription = 'Posodobljen opis podjetja za vse javne strani.';
    await expect(page.getByTestId('homepage-preview-stage')).toHaveAttribute('data-preview-ready', 'true', { timeout: 15_000 });
    await page.getByTestId('homepage-preview-scroll-region').evaluate((element) => {
      element.scrollTop = element.scrollHeight;
    });
    await description.click();
    await expect(editableText).toHaveAttribute('contenteditable', 'true');
    await editableText.fill(nextDescription);
    await page.getByRole('button', { name: 'Dodaj besedilo, gumb ali sekcijo' }).click();

    const saveButton = page.getByRole('button', { name: 'Shrani spremembe', exact: true });
    await expect(saveButton).toBeEnabled();
    await saveButton.click();
    await expect.poll(() => navigationPatch?.footer.description).toBe(nextDescription);
    expect(landingSaveCount).toBe(0);
    await expect(page.getByText('Objavljeno', { exact: true })).toBeVisible();
    await expect(saveButton).toBeDisabled();
  });

  test('public category showcase stays coloured and animates only the editorial object', async ({ page }) => {
    await page.goto('/');

    const categoryCards = page.locator('[data-homepage-category-card]');
    const categoryImages = page.locator('[data-homepage-category-image]');
    await expect(categoryCards.first()).toBeVisible({ timeout: 15_000 });
    await expect(categoryCards).toHaveCount(8);
    await expect(categoryImages.first()).toHaveCSS('filter', 'none');
    await expect(categoryImages.nth(1)).toHaveCSS('filter', 'none');

    const firstFourBoxes = await Promise.all(
      [0, 1, 2, 3].map((index) => categoryCards.nth(index).boundingBox())
    );
    const fifthBox = await categoryCards.nth(4).boundingBox();
    firstFourBoxes.forEach((box) => expect(box).not.toBeNull());
    expect(fifthBox).not.toBeNull();
    expect(Math.max(...firstFourBoxes.map((box) => box?.y ?? 0)) - Math.min(...firstFourBoxes.map((box) => box?.y ?? 0))).toBeLessThanOrEqual(1);
    expect(Math.abs((fifthBox?.x ?? 0) - (firstFourBoxes[0]?.x ?? 0))).toBeLessThanOrEqual(1);
    expect((fifthBox?.y ?? 0)).toBeGreaterThan((firstFourBoxes[0]?.y ?? 0) + (firstFourBoxes[0]?.height ?? 0));

    const firstCard = categoryCards.first();
    const firstCardBoxBeforeHover = await firstCard.boundingBox();
    const firstCardBackgroundBeforeHover = await firstCard.evaluate(
      (element) => getComputedStyle(element).backgroundColor
    );
    const mediaMotionLayer = firstCard.locator('[data-testid="category-showcase-media"] > div');
    const mediaTransformBeforeHover = await mediaMotionLayer.evaluate(
      (element) => getComputedStyle(element).transform
    );
    const rule = firstCard.locator(':scope > div:nth-child(2) > span[aria-hidden="true"]').nth(1);
    const ruleWidthBeforeHover = await rule.evaluate((element) => element.getBoundingClientRect().width);

    await firstCard.hover();
    await expect.poll(() => mediaMotionLayer.evaluate(
      (element) => getComputedStyle(element).transform
    )).not.toBe(mediaTransformBeforeHover);
    await expect.poll(() => firstCard.evaluate(
      (element) => getComputedStyle(element).backgroundColor
    )).not.toBe(firstCardBackgroundBeforeHover);
    await expect.poll(() => rule.evaluate(
      (element) => element.getBoundingClientRect().width
    )).toBeGreaterThan(ruleWidthBeforeHover);
    await expect(categoryImages.first()).toHaveCSS('filter', 'none');
    await expect(categoryImages.nth(1)).toHaveCSS('filter', 'none');

    const firstCardBoxAfterHover = await firstCard.boundingBox();
    expect(firstCardBoxBeforeHover).not.toBeNull();
    expect(firstCardBoxAfterHover).not.toBeNull();
    expect(Math.abs((firstCardBoxAfterHover?.x ?? 0) - (firstCardBoxBeforeHover?.x ?? 0))).toBeLessThanOrEqual(0.5);
    expect(Math.abs((firstCardBoxAfterHover?.y ?? 0) - (firstCardBoxBeforeHover?.y ?? 0))).toBeLessThanOrEqual(0.5);
    expect(Math.abs((firstCardBoxAfterHover?.width ?? 0) - (firstCardBoxBeforeHover?.width ?? 0))).toBeLessThanOrEqual(0.5);
    expect(Math.abs((firstCardBoxAfterHover?.height ?? 0) - (firstCardBoxBeforeHover?.height ?? 0))).toBeLessThanOrEqual(0.5);

    await page.mouse.move(0, 0);
    await expect.poll(() => mediaMotionLayer.evaluate(
      (element) => getComputedStyle(element).transform
    )).toBe(mediaTransformBeforeHover);
    await expect(categoryImages.first()).toHaveCSS('filter', 'none');

    await page.setViewportSize({ width: 900, height: 1000 });
    const tabletBoxes = await Promise.all(
      [0, 1, 2].map((index) => categoryCards.nth(index).boundingBox())
    );
    tabletBoxes.forEach((box) => expect(box).not.toBeNull());
    expect(Math.abs((tabletBoxes[0]?.y ?? 0) - (tabletBoxes[1]?.y ?? 0))).toBeLessThanOrEqual(1);
    expect((tabletBoxes[2]?.y ?? 0)).toBeGreaterThan((tabletBoxes[0]?.y ?? 0) + (tabletBoxes[0]?.height ?? 0));

    await page.setViewportSize({ width: 430, height: 1000 });
    const mobileFirstBox = await categoryCards.first().boundingBox();
    const mobileSecondBox = await categoryCards.nth(1).boundingBox();
    expect(mobileFirstBox).not.toBeNull();
    expect(mobileSecondBox).not.toBeNull();
    expect(Math.abs((mobileFirstBox?.x ?? 0) - (mobileSecondBox?.x ?? 0))).toBeLessThanOrEqual(1);
    expect((mobileSecondBox?.y ?? 0)).toBeGreaterThan((mobileFirstBox?.y ?? 0) + (mobileFirstBox?.height ?? 0));
  });

  test('public category showcase has a visible focus state and respects reduced motion', async ({ page }) => {
    await page.goto('/');

    const firstCard = page.locator('[data-homepage-category-card]').first();
    const firstCardLink = firstCard.getByRole('link');
    await expect(firstCardLink).toBeVisible({ timeout: 15_000 });
    await firstCardLink.focus();
    await expect(firstCardLink).toBeFocused();
    await expect.poll(() => firstCardLink.evaluate(
      (element) => getComputedStyle(element).boxShadow
    )).not.toBe('none');

    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.reload();
    const reducedMotionCard = page.locator('[data-homepage-category-card]').first();
    const reducedMotionLayer = reducedMotionCard.locator('[data-testid="category-showcase-media"] > div');
    await expect(reducedMotionCard).toBeVisible({ timeout: 15_000 });
    await reducedMotionCard.hover();
    await expect(reducedMotionLayer).toHaveCSS('transform', 'none');
    await expect(reducedMotionLayer).toHaveCSS('transition-property', 'none');
  });

  test('both category editors expose the shared media controls and persist the same presentation shape', async ({ page }) => {
    await page.setViewportSize({ width: 1600, height: 1000 });
    type CategoryPresentationPatch = {
      updates: Array<{
        categoryId?: string;
        categorySlug: string;
        image?: string | null;
        presentation: {
          backgroundColor: string;
          crop: { x: number; y: number; width: number; height: number };
          fit: string;
          focalPoint: { x: number; y: number };
          offsetX: number;
          offsetY: number;
          scale: number;
        };
      }>;
    };

    const presentationPatches: CategoryPresentationPatch[] = [];
    await page.route('**/api/admin/categories/images', async (route) => {
      if (route.request().method() !== 'PATCH') {
        await route.continue();
        return;
      }

      const payload = route.request().postDataJSON() as CategoryPresentationPatch;
      presentationPatches.push(payload);
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true, updates: payload.updates })
      });
    });
    await page.route('**/api/admin/categories', async (route) => {
      if (route.request().method() !== 'PATCH') {
        await route.continue();
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true })
      });
    });

    await page.goto('/admin/podoba/glavna-stran');
    const homepageToolbar = page.getByTestId('homepage-context-toolbar');
    const homepageCategoryImage = page.locator(
      '[data-homepage-canvas-element][data-canvas-element-id^="categories:image:"]'
    ).first();
    await expect(homepageCategoryImage).toHaveCount(1);
    await homepageCategoryImage.evaluate((element) => (element as HTMLElement).click());
    await homepageToolbar.getByRole('button', {
      name: 'Obrez, fokus in postavitev slike',
      exact: true
    }).click();

    const homepageMediaControls = page.locator('[data-category-media-controls]');
    await expect(homepageMediaControls).toBeVisible();
    const homepageEditorCapabilities = (await page
      .locator('[data-category-showcase-editor="homepage"]')
      .getAttribute('data-category-showcase-capabilities'))?.split(' ') ?? [];
    expect(homepageEditorCapabilities).toEqual(expect.arrayContaining([
      'media',
      'crop',
      'focalPoint',
      'scale',
      'offsets',
      'fit',
      'background',
      'categoryTitleTypography',
      'categoryTitlePosition',
      'groupTitlePosition'
    ]));
    const homepageMediaControlLabels = await homepageMediaControls.locator('input[aria-label]').evaluateAll(
      (inputs) => inputs.map((input) => input.getAttribute('aria-label')).filter(Boolean).sort()
    );
    await homepageMediaControls.locator('input[aria-label^="Odmik X"]').fill('19');
    const homepageSave = page.getByRole('button', { name: 'Shrani spremembe', exact: true });
    await expect(homepageSave).toBeEnabled();
    await homepageSave.click();
    await expect.poll(() => presentationPatches.length).toBe(1);

    await page.goto('/admin/kategorije/predogled');
    const categoryPreviewTile = page.getByTestId('category-showcase-tile').first();
    await expect(categoryPreviewTile).toBeVisible({ timeout: 15_000 });
    await categoryPreviewTile.hover();
    await page.getByRole('button', { name: 'Uredi predstavitev slike', exact: true }).first().click();

    const categoryPreviewMediaControls = page.locator('[data-category-media-controls]');
    await expect(categoryPreviewMediaControls).toBeVisible();
    const categoryPreviewEditorCapabilities = (await page
      .locator('[data-category-showcase-editor="category-preview"]')
      .getAttribute('data-category-showcase-capabilities'))?.split(' ') ?? [];
    expect(categoryPreviewEditorCapabilities).toEqual(expect.arrayContaining([
      'media',
      'crop',
      'focalPoint',
      'scale',
      'offsets',
      'fit',
      'background'
    ]));
    expect(categoryPreviewEditorCapabilities).not.toContain('categoryTitleTypography');
    expect(categoryPreviewEditorCapabilities).not.toContain('categoryTitlePosition');
    expect(categoryPreviewEditorCapabilities).not.toContain('groupTitlePosition');
    const categoryPreviewMediaControlLabels = await categoryPreviewMediaControls.locator('input[aria-label]').evaluateAll(
      (inputs) => inputs.map((input) => input.getAttribute('aria-label')).filter(Boolean).sort()
    );
    expect(categoryPreviewMediaControlLabels).toEqual(homepageMediaControlLabels);
    await categoryPreviewMediaControls.locator('input[aria-label^="Odmik X"]').fill('23');

    const categoryPreviewSave = page.getByRole('button', { name: 'Shrani', exact: true }).first();
    await expect(categoryPreviewSave).toBeEnabled();
    await categoryPreviewSave.click();
    const saveDialog = page.getByRole('dialog');
    await expect(saveDialog.getByText('Predstavitev in slike kategorij', { exact: true })).toBeVisible();
    await saveDialog.getByRole('button', { name: 'Shrani', exact: true }).click();
    await expect.poll(() => presentationPatches.length).toBe(2);

    const homepageUpdate = presentationPatches[0]?.updates[0];
    const categoryPreviewUpdate = presentationPatches[1]?.updates[0];
    expect(homepageUpdate).toBeDefined();
    expect(categoryPreviewUpdate).toBeDefined();
    expect(categoryPreviewUpdate?.categorySlug).toBe(homepageUpdate?.categorySlug);
    expect(homepageUpdate?.presentation.offsetX).toBe(19);
    expect(categoryPreviewUpdate?.presentation.offsetX).toBe(23);
    expect(Object.keys(categoryPreviewUpdate?.presentation ?? {}).sort()).toEqual(
      Object.keys(homepageUpdate?.presentation ?? {}).sort()
    );
    expect(Object.keys(homepageUpdate?.presentation.crop ?? {}).sort()).toEqual(['height', 'width', 'x', 'y']);
    expect(Object.keys(homepageUpdate?.presentation.focalPoint ?? {}).sort()).toEqual(['x', 'y']);
    expect(homepageUpdate?.presentation).not.toHaveProperty('categoryTitlePosition');
    expect(homepageUpdate?.presentation).not.toHaveProperty('categoryTitleTypography');
    expect(homepageUpdate?.presentation).not.toHaveProperty('groupTitlePosition');
  });

  test('a saved category presentation reloads from the same record in both admin routes', async ({ page }) => {
    await page.setViewportSize({ width: 1600, height: 1000 });
    const readPresentation = async (controls: ReturnType<typeof page.locator>) => {
      const readNumber = async (labelPrefix: string) => Number(await controls.locator(`input[aria-label^="${labelPrefix}"]`).inputValue());
      const fitLabel = (await controls.locator('[role="group"][aria-label="Prileganje slike"] button[aria-pressed="true"]').textContent())?.trim();
      const fit = fitLabel === 'Zapolni' ? 'cover' : fitLabel === 'Raztegni' ? 'fill' : 'contain';
      return {
        crop: {
          x: (await readNumber('Levo')) / 100,
          y: (await readNumber('Zgoraj')) / 100,
          width: (await readNumber('Širina')) / 100,
          height: (await readNumber('Višina')) / 100
        },
        focalPoint: {
          x: (await readNumber('Fokus X')) / 100,
          y: (await readNumber('Fokus Y')) / 100
        },
        scale: await readNumber('Povečava'),
        offsetX: await readNumber('Odmik X'),
        offsetY: await readNumber('Odmik Y'),
        fit,
        backgroundColor: await controls.locator('input[aria-label="Barva ozadja HEX"]').inputValue()
      };
    };

    await page.goto('/admin/podoba/glavna-stran');
    const homepageCategoryImage = page.locator(
      '[data-homepage-canvas-element][data-canvas-element-id^="categories:image:"]'
    ).first();
    await expect(homepageCategoryImage).toHaveCount(1);
    const imageElementId = await homepageCategoryImage.getAttribute('data-canvas-element-id');
    const categorySlug = imageElementId?.slice('categories:image:'.length);
    expect(categorySlug).toBeTruthy();

    await homepageCategoryImage.evaluate((element) => (element as HTMLElement).click());
    await page.getByTestId('homepage-context-toolbar').getByRole('button', {
      name: 'Obrez, fokus in postavitev slike',
      exact: true
    }).click();
    const homepageControls = page.locator('[data-category-media-controls]');
    await expect(homepageControls).toBeVisible();
    const originalPresentation = await readPresentation(homepageControls);
    const changedOffsetX = originalPresentation.offsetX >= 95
      ? originalPresentation.offsetX - 1
      : originalPresentation.offsetX + 1;
    let persistedChange = false;

    try {
      await homepageControls.locator('input[aria-label^="Odmik X"]').fill(String(changedOffsetX));
      const saveResponsePromise = page.waitForResponse((response) =>
        response.url().includes('/api/admin/categories/images')
        && response.request().method() === 'PATCH'
      );
      await page.getByRole('button', { name: 'Shrani spremembe', exact: true }).click();
      const saveResponse = await saveResponsePromise;
      expect(saveResponse.ok()).toBeTruthy();
      persistedChange = true;

      await page.goto('/admin/kategorije/predogled');
      const categoryTile = page.locator(`[data-category-slug="${categorySlug}"]`).first();
      await expect(categoryTile).toBeVisible({ timeout: 15_000 });
      await categoryTile.hover();
      await categoryTile.getByRole('button', { name: 'Uredi predstavitev slike', exact: true }).click();
      const categoryPreviewControls = page.locator('[data-category-media-controls]');
      await expect(categoryPreviewControls).toBeVisible();
      await expect(categoryPreviewControls.locator('input[aria-label^="Odmik X"]')).toHaveValue(String(changedOffsetX));

      await page.goto('/');
      const publicCategoryTile = page.locator(`[data-category-slug="${categorySlug}"]`).first();
      await expect(publicCategoryTile).toBeVisible({ timeout: 15_000 });
      const publicPresentationLayer = publicCategoryTile.locator(
        '[data-testid="category-showcase-media"] > div > div'
      );
      await expect.poll(() => publicPresentationLayer.evaluate(
        (element) => (element as HTMLElement).style.transform
      )).toContain(`translate3d(${changedOffsetX}%,`);
    } finally {
      if (persistedChange && categorySlug) {
        const restoreResponse = await page.request.patch('/api/admin/categories/images', {
          data: {
            updates: [{
              categorySlug,
              presentation: originalPresentation
            }]
          }
        });
        expect.soft(restoreResponse.ok()).toBeTruthy();
      }
    }
  });

  test('landing editor preserves edits made during a save and re-enables saving afterwards', async ({ page }) => {
    await page.setViewportSize({ width: 1600, height: 1000 });
    const savedPayloads: Array<{ config: Record<string, unknown> }> = [];
    let releaseFirstSave: (() => void) | undefined;
    let signalFirstSaveStarted: (() => void) | undefined;
    const firstSaveGate = new Promise<void>((resolve) => { releaseFirstSave = resolve; });
    const firstSaveStarted = new Promise<void>((resolve) => { signalFirstSaveStarted = resolve; });

    await page.route('**/api/admin/landing-page', async (route) => {
      if (route.request().method() !== 'PUT') {
        await route.continue();
        return;
      }

      const requestBody = route.request().postDataJSON() as { config: Record<string, unknown> };
      savedPayloads.push(requestBody);
      if (savedPayloads.length === 1) {
        signalFirstSaveStarted?.();
        await firstSaveGate;
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          config: {
            ...requestBody.config,
            updatedAt: `2026-07-18T12:00:0${savedPayloads.length}.000Z`
          }
        })
      });
    });

    await page.goto('/admin/podoba/glavna-stran');
    const toolbar = page.getByTestId('homepage-context-toolbar');
    const previewStage = page.getByTestId('homepage-preview-stage');
    await expect(previewStage).toHaveAttribute('data-preview-ready', 'true', { timeout: 15_000 });
    await expect(toolbar).toBeVisible({ timeout: 15_000 });
    await page.locator('[data-canvas-element-id="hero:title"]').click();
    await toolbar.getByRole('button', { name: 'Slog besedila', exact: true }).click();

    const fontSizeInput = page.getByRole('spinbutton', { name: 'Velikost px', exact: true });
    const saveButton = page.getByRole('button', { name: 'Shrani spremembe', exact: true });
    const initialFontSize = Number(await fontSizeInput.inputValue());
    const firstFontSize = initialFontSize >= 239 ? initialFontSize - 1 : initialFontSize + 1;
    const newerFontSize = initialFontSize >= 238 ? initialFontSize - 2 : initialFontSize + 2;

    await fontSizeInput.fill(String(firstFontSize));
    await expect(saveButton).toBeEnabled();

    const firstSaveClick = saveButton.click();
    await firstSaveStarted;
    await firstSaveClick;
    await expect(saveButton).toBeDisabled();

    await toolbar.getByRole('button', { name: 'Slog besedila', exact: true }).click();
    await fontSizeInput.fill(String(newerFontSize));
    await expect(fontSizeInput).toHaveValue(String(newerFontSize));
    releaseFirstSave?.();

    await expect(page.getByText('Neshranjeno', { exact: true })).toBeVisible();
    await expect(fontSizeInput).toHaveValue(String(newerFontSize));
    await expect(saveButton).toBeEnabled();

    await saveButton.click();
    await expect.poll(() => savedPayloads.length).toBe(2);
    await expect(page.getByText('Objavljeno', { exact: true })).toBeVisible();
    await expect(saveButton).toBeDisabled();

    const secondConfig = savedPayloads[1].config as {
      hero: { responsive: { desktop: { titleFontSizePx: number } } };
      canvas: { elements: Record<string, { responsive: { desktop: { fontSizePx: number } } }> };
    };
    expect(secondConfig.hero.responsive.desktop.titleFontSizePx).toBe(newerFontSize);
    expect(secondConfig.canvas.elements['hero:title'].responsive.desktop.fontSizePx).toBe(newerFontSize);

    await toolbar.getByRole('button', { name: 'Slog besedila', exact: true }).click();
    const letterSpacingInput = page.getByRole('spinbutton', { name: 'Razmik črk px', exact: true });
    const currentLetterSpacing = Number(await letterSpacingInput.inputValue());
    await letterSpacingInput.fill(String(currentLetterSpacing + 0.25));
    await expect(saveButton).toBeEnabled();
  });

  test('a pending section rename enables save before blur and is included in the payload', async ({ page }) => {
    let savedConfig: { sectionTitles: Record<string, string> } | undefined;
    await page.route('**/api/admin/landing-page', async (route) => {
      if (route.request().method() !== 'PUT') {
        await route.continue();
        return;
      }
      const requestBody = route.request().postDataJSON() as {
        config: { sectionTitles: Record<string, string> };
      };
      savedConfig = requestBody.config;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ config: requestBody.config })
      });
    });

    await page.goto('/admin/podoba/glavna-stran');
    const toolbar = page.getByTestId('homepage-context-toolbar');
    await expect(toolbar).toBeVisible({ timeout: 15_000 });
    await toolbar.getByRole('button', { name: 'Struktura strani', exact: true }).click();
    await page.getByRole('button', { name: 'Možnosti sekcije', exact: true }).first().click();
    await page.getByRole('button', { name: 'Preimenuj', exact: true }).click();

    const renameInput = page.getByRole('textbox', { name: 'Ime sekcije', exact: true });
    const renamedSection = 'Preizkusna sekcija';
    await renameInput.fill(renamedSection);
    await expect(renameInput).toBeFocused();

    const saveButton = page.getByRole('button', { name: 'Shrani spremembe', exact: true });
    await expect(saveButton).toBeEnabled();
    await saveButton.click();

    await expect.poll(() => savedConfig).toBeDefined();
    expect(Object.values(savedConfig!.sectionTitles)).toContain(renamedSection);
    await expect(page.getByText('Objavljeno', { exact: true })).toBeVisible();
    await expect(saveButton).toBeDisabled();
  });

  test('viewport switching continuously resizes one live responsive renderer across all breakpoints', async ({ page }) => {
    await page.setViewportSize({ width: 1600, height: 1000 });
    await page.goto('/admin/podoba/glavna-stran');

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
    const initialToolbarBox = await toolbar.boundingBox();
    const initialWindowScrollY = await page.evaluate(() => window.scrollY);
    const initialWindowScrollX = await page.evaluate(() => window.scrollX);
    expect(initialStageBox).not.toBeNull();
    expect(initialToolbarBox).not.toBeNull();

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
        expect(first.logicalWidth, transitionLabel).toBeCloseTo(previewPresetWidths[transition.from], 2);
        expect(last.logicalWidth, transitionLabel).toBeCloseTo(previewPresetWidths[transition.to], 2);

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
          expect(sample.interactiveRendererCount, transitionLabel).toBe(1);
          expect(sample.livePointerEvents, transitionLabel).not.toBe('none');
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
          expect(sample.fluidHeroHeight, transitionLabel).toBeCloseTo(sample.heroLogicalHeight, 0);
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
    expect(finalToolbarBox).not.toBeNull();
    expect(finalToolbarBox!.x).toBeCloseTo(initialToolbarBox!.x, 1);
    expect(finalToolbarBox!.y).toBeCloseTo(initialToolbarBox!.y, 1);
    expect(finalToolbarBox!.width).toBeCloseTo(initialToolbarBox!.width, 1);
    expect(finalToolbarBox!.height).toBeCloseTo(initialToolbarBox!.height, 1);
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

    const { samples } = await captureViewportSwitch(page, 'Tablica', 60);
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
      expect(sample.interactiveRendererCount).toBe(1);
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
      expect(sample.renderDevice).not.toBe('mobile');
    }
    const firstSettledTabletSample = retargetSamples.find((sample) => sample.phase === 'idle');
    expect(firstSettledTabletSample).toBeDefined();
    expect(firstSettledTabletSample!.timestamp - firstTabletSample!.timestamp)
      .toBeLessThanOrEqual(previewTransitionDurationMs + 60);

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

    const controls = page.getByRole('group', { name: 'Odzivni predogled' });
    const stage = page.getByTestId('homepage-preview-stage');
    const scrollRegion = page.getByTestId('homepage-preview-scroll-region');
    const sequence = [
      { button: 'Tablica' as const, device: 'tablet', width: '1024.000' },
      { button: 'Mobilno' as const, device: 'mobile', width: '390.000' },
      { button: 'Desktop' as const, device: 'desktop', width: '1440.000' },
      { button: 'Mobilno' as const, device: 'mobile', width: '390.000' },
      { button: 'Tablica' as const, device: 'tablet', width: '1024.000' },
      { button: 'Desktop' as const, device: 'desktop', width: '1440.000' }
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

  test('Logotip is the third podoba tab and the legacy visual route redirects', async ({ page }) => {
    await page.goto('/admin/podoba/glavna-stran');

    const logoTab = page.getByRole('tab', { name: 'Logotip' });
    await expect(logoTab).toBeVisible();
    await logoTab.click();
    await expect(page).toHaveURL(/\/admin\/podoba\/logotip\/?$/);
    await expect(page.getByRole('tab', { name: 'Logotip' })).toHaveAttribute('aria-selected', 'true');

    await page.goto('/admin/podoba/vizualno');
    await expect(page).toHaveURL(/\/admin\/podoba\/logotip\/?$/);
  });

  test('logo outputs are purpose-based and independently overridable', async ({ page }) => {
    await page.goto('/admin/podoba/logotip');

    const masters = page.getByTestId('logo-master-variants');
    const catalogue = page.getByTestId('logo-purpose-catalogue');
    await expect(masters.locator('[data-logo-master]')).toHaveCount(5);
    await expect(catalogue.getByRole('tab')).toHaveCount(4);
    await expect(page.getByText('Barva logotipa', { exact: true })).toHaveCount(0);
    await expect(page.getByText('Pisava logotipa', { exact: true })).toHaveCount(0);
    await expect(page.getByText('Filter', { exact: true })).toHaveCount(0);

    await catalogue.getByRole('tab', { name: /^Ikone in aplikacija/ }).click();
    const favicon = page.locator('[data-logo-placement="favicon"]');
    const apple = page.locator('[data-logo-placement="apple-touch-icon"]');
    const pwa = page.locator('[data-logo-placement="pwa-maskable"]');
    await expect(favicon).toBeVisible();
    await expect(apple).toBeVisible();
    await expect(pwa).toBeVisible();

    const faviconToggle = favicon.locator('button[aria-label^="Skrij"], button[aria-label^="Prikaži"]');
    const appleToggle = apple.locator('button[aria-label^="Skrij"], button[aria-label^="Prikaži"]');
    const faviconBefore = await faviconToggle.getAttribute('aria-label');
    const appleBefore = await appleToggle.getAttribute('aria-label');
    await faviconToggle.click();
    await expect(faviconToggle).not.toHaveAttribute('aria-label', faviconBefore ?? '');
    await expect(appleToggle).toHaveAttribute('aria-label', appleBefore ?? '');
    await expect(page.getByRole('button', { name: 'Shrani', exact: true })).toBeEnabled();

    await page.getByRole('button', { name: 'Zavrzi neshranjene spremembe' }).click();
    await expect(page.getByRole('button', { name: 'Shrani', exact: true })).toBeDisabled();
  });

  test('logo masters are optically analysed and remain non-destructive', async ({ page }) => {
    await page.goto('/admin/podoba/logotip');
    const master = page.locator('[data-logo-master="full-lockup"]');
    await master.locator('input[type="file"]').setInputFiles({
      name: 'atehna-lockup.svg',
      mimeType: 'image/svg+xml',
      buffer: Buffer.from(
        '<svg xmlns="http://www.w3.org/2000/svg" width="600" height="200" viewBox="0 0 600 200"><g fill="#111827"><rect x="130" y="60" width="80" height="80" rx="12"/><text x="235" y="125" font-size="72" font-family="Arial">Atehna</text></g></svg>'
      )
    });

    await expect(master.locator('img')).toBeVisible();
    await expect(page.getByText('1 / 5 naloženih', { exact: true })).toBeVisible();
    await expect(page.getByText('Neshranjeno', { exact: true })).toBeVisible();
    const desktopOutput = page.locator('[data-logo-placement="header-desktop"]');
    const tabletOutput = page.locator('[data-logo-placement="header-tablet"]');
    await expect(desktopOutput.getByText('Samodejno', { exact: true })).toBeVisible();
    await expect(tabletOutput.getByText('Samodejno', { exact: true })).toBeVisible();

    await desktopOutput.getByRole('slider', { name: /Velikost logotipa/ }).fill('126');
    await expect(desktopOutput.getByText('Ročno', { exact: true })).toBeVisible();
    await expect(tabletOutput.getByText('Samodejno', { exact: true })).toBeVisible();
    await desktopOutput.getByRole('button', { name: 'Samodejno prileganje' }).click();
    await expect(desktopOutput.getByText('Samodejno', { exact: true })).toBeVisible();
  });

  test('Globalni parametri is the fourth podoba tab and its route loads', async ({ page }) => {
    await page.goto('/admin/podoba/glavna-stran');

    const tabs = page.getByRole('tab');
    await expect(tabs).toHaveCount(4);
    await expect(tabs.nth(0)).toHaveText('Glavna stran');
    await expect(tabs.nth(1)).toHaveText('Navigacija');
    await expect(tabs.nth(2)).toHaveText('Logotip');
    await expect(tabs.nth(3)).toHaveText('Globalni parametri');

    await tabs.nth(3).click();
    await expect(page).toHaveURL(/\/admin\/podoba\/globalni-parametri\/?$/);
    await expect(page.getByRole('heading', { level: 1, name: 'Globalni parametri' })).toBeVisible({
      timeout: 15_000
    });
    await expect(page.getByRole('tab', { name: 'Globalni parametri' })).toHaveAttribute('aria-selected', 'true');

    const elementTabs = page.getByRole('tablist', { name: 'Elementi globalnih parametrov' });
    await elementTabs.getByRole('tab', { name: /^Osnovno besedilo/ }).click();
    const bodyFontSelect = page.getByRole('combobox', { name: 'Osnovna pisava', exact: true });
    await expect(bodyFontSelect.getByRole('option', { name: 'IBM Plex Sans · priporočeno', exact: true })).toHaveCount(1);
    await expect(bodyFontSelect.getByRole('option', { name: 'Manrope', exact: true })).toHaveCount(1);
    await expect(bodyFontSelect.getByRole('option', { name: 'Bitter', exact: true })).toHaveCount(1);
  });

  test('global parameters use an element-centric live editor and the legacy route redirects', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/admin/podoba/globalni-slog');
    await expect(page).toHaveURL(/\/admin\/podoba\/globalni-parametri\/?$/);

    await expect(page.getByRole('tablist', { name: 'Skupine globalnih parametrov' })).toHaveCount(0);

    const elementSidebar = page.getByTestId('global-parameter-element-list');
    const workspace = page.getByTestId('global-parameter-workspace');
    const settings = workspace.getByTestId('global-parameter-settings');
    const preview = workspace.locator('[data-global-parameters-preview]');
    const elementTabs = elementSidebar.getByRole('tablist', { name: 'Elementi globalnih parametrov' });

    await expect(elementSidebar).toBeVisible();
    await expect(workspace).toBeVisible();
    await expect(settings).toBeVisible();
    await expect(preview).toBeVisible();
    await expect(elementTabs.getByRole('tab')).toHaveCount(18);

    const [sidebarBox, workspaceBox] = await Promise.all([
      elementSidebar.boundingBox(),
      workspace.boundingBox()
    ]);
    expect(sidebarBox).not.toBeNull();
    expect(workspaceBox).not.toBeNull();
    expect(workspaceBox!.x).toBeGreaterThan(sidebarBox!.x);
    expect(workspaceBox!.width).toBeGreaterThan(sidebarBox!.width * 2);

    const reachableSettingPaths: string[] = [];
    for (const elementTab of await elementTabs.getByRole('tab').all()) {
      await elementTab.click();
      const visiblePaths = await settings.locator('[data-global-style-setting]').evaluateAll((elements) => (
        elements.map((element) => element.getAttribute('data-global-style-setting')).filter((value): value is string => Boolean(value))
      ));
      reachableSettingPaths.push(...visiblePaths);
    }
    expect(reachableSettingPaths).toHaveLength(86);
    expect(new Set(reachableSettingPaths).size).toBe(86);

    const buttonTab = elementTabs.getByRole('tab', { name: /^Gumb/ });
    await buttonTab.click();
    await expect(buttonTab).toHaveAttribute('aria-selected', 'true');
    await expect(preview).toHaveAttribute('data-active-global-element', 'button');

    const buttonHeightSetting = settings.locator('[data-global-style-setting="buttons.heightPx"]');
    const buttonHeightInput = buttonHeightSetting.getByRole('spinbutton');
    await expect(buttonHeightSetting).toBeVisible();

    const nextButtonHeight = Number(await buttonHeightInput.inputValue()) === 61 ? 62 : 61;
    await buttonHeightInput.fill(String(nextButtonHeight));
    await expect(buttonHeightInput).toHaveValue(String(nextButtonHeight));
    await expect.poll(async () => preview.evaluate((element) => (
      getComputedStyle(element).getPropertyValue('--site-button-height').trim()
    ))).toBe(`${nextButtonHeight}px`);
    await expect(page.getByText('Neshranjeno', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Shrani', exact: true })).toBeEnabled();

    const formFieldTab = elementTabs.getByRole('tab', { name: /^Vnosno polje/ });
    await formFieldTab.click();
    await expect(formFieldTab).toHaveAttribute('aria-selected', 'true');
    await expect(preview).toHaveAttribute('data-active-global-element', 'form-field');
    await expect(page.getByText('Fokusni obroč', { exact: true })).toHaveCount(0);

    const heightField = settings.locator('[data-global-style-setting="forms.heightPx"]').getByRole('spinbutton');
    await heightField.focus();
    await expect(heightField.locator('..')).toHaveCSS('box-shadow', 'none');
    await expect(preview.getByText('Fokusirano polje', { exact: true })).toHaveCSS('box-shadow', 'none');
  });

  test('navigation top-bar X cells show start-end ranges and keep width editable', async ({ page }) => {
    await page.setViewportSize({ width: 1600, height: 1000 });
    await page.goto('/admin/podoba/navigacija');

    const selectAll = page.getByRole('checkbox', { name: 'Izberi vse elemente v vrstici', exact: true });
    const tableHeader = selectAll.locator('..').locator('..');
    const xInput = page.getByRole('textbox', { name: 'X za Košarica', exact: true });
    const widthInput = page.getByRole('spinbutton', { name: 'Širina za Košarica', exact: true });
    const xUnit = xInput.locator('..').locator(':scope > span');
    const widthUnit = widthInput.locator('..').locator(':scope > span');

    await expect(selectAll).toBeVisible({ timeout: 15_000 });
    await expect(tableHeader.getByText('Širina', { exact: true })).toBeVisible();
    await expect(xInput).toBeVisible();
    await expect(xInput).toBeEditable();
    await expect(widthInput).toBeVisible();
    await expect(widthInput).toBeEditable();
    await expect(xUnit).toHaveText('px');
    await expect(widthUnit).toHaveText('px');

    const initialRange = (await xInput.inputValue()).match(/^(\d+)-(\d+)$/);
    expect(initialRange).not.toBeNull();
    const initialStart = Number(initialRange?.[1]);
    const initialEnd = Number(initialRange?.[2]);
    const initialWidth = Number(await widthInput.inputValue());
    expect(initialEnd - initialStart).toBe(initialWidth);

    const nextWidth = initialWidth >= 1192 ? initialWidth - 8 : initialWidth + 8;
    await widthInput.fill(String(nextWidth));
    await expect(widthInput).toHaveValue(String(nextWidth));
    await expect.poll(async () => {
      const range = (await xInput.inputValue()).match(/^(\d+)-(\d+)$/);
      return range ? Number(range[2]) - Number(range[1]) : null;
    }).toBe(nextWidth);

    const resizedRange = (await xInput.inputValue()).match(/^(\d+)-(\d+)$/);
    expect(resizedRange).not.toBeNull();
    const nextStart = Math.max(0, Number(resizedRange?.[1]) - 2);
    await xInput.fill(`${nextStart}-${nextStart + nextWidth}`);
    await xInput.press('Enter');
    await expect(xInput).toHaveValue(`${nextStart}-${nextStart + nextWidth}`);
    await expect(widthInput).toHaveValue(String(nextWidth));

    await xInput.fill(`${nextStart}-${nextStart + nextWidth + 7}`);
    await xInput.press('Enter');
    await expect(xInput).toHaveValue(`${nextStart}-${nextStart + nextWidth}`);
    await expect(widthInput).toHaveValue(String(nextWidth));
    await expect(xUnit).toHaveText('px');
    await expect(widthUnit).toHaveText('px');
  });

  test('navigation top-bar accepts a zero gutter shorthand and aligns X zero to the content edge', async ({ page }) => {
    await page.setViewportSize({ width: 1600, height: 1000 });
    await page.goto('/admin/podoba/navigacija');

    const gutterInput = page.getByRole('textbox', { name: 'Min in Max odmik', exact: true });
    await expect(gutterInput).toBeVisible({ timeout: 15_000 });
    await gutterInput.fill('0');
    await gutterInput.press('Enter');
    await expect(gutterInput).toHaveValue('0-0');

    const edgeDelta = await page.evaluate(() => {
      const renderer = document.querySelector('[data-technical-topbar-renderer="true"]');
      const placementBounds = renderer?.querySelector('.topbar-placement-bounds');
      const logoLink = renderer?.querySelector('a[aria-label="Atehna home"]');
      const visibleBrand = logoLink?.querySelector(':scope > span');
      const cartButton = renderer?.querySelector('button[aria-label^="Ko"]');
      const cartWrapper = cartButton?.parentElement;
      if (
        !(placementBounds instanceof HTMLElement) ||
        !(logoLink instanceof HTMLElement) ||
        !(visibleBrand instanceof HTMLElement) ||
        !(cartButton instanceof HTMLElement) ||
        !(cartWrapper instanceof HTMLElement)
      ) {
        throw new Error('Predogled zgornje vrstice nima pričakovane geometrije.');
      }
      const boundsRect = placementBounds.getBoundingClientRect();
      return {
        link: Math.abs(logoLink.getBoundingClientRect().left - boundsRect.left),
        brand: Math.abs(visibleBrand.getBoundingClientRect().left - boundsRect.left),
        cartWrapper: Math.abs(cartWrapper.getBoundingClientRect().right - boundsRect.right),
        cartButton: Math.abs(cartButton.getBoundingClientRect().right - boundsRect.right)
      };
    });

    expect(edgeDelta.link).toBeLessThanOrEqual(1);
    expect(edgeDelta.brand).toBeLessThanOrEqual(1);
    expect(edgeDelta.cartWrapper).toBeLessThanOrEqual(1);
    expect(edgeDelta.cartButton).toBeLessThanOrEqual(1);

    const previewToggle = page.getByRole('switch', { name: 'Predogled', exact: true });
    await previewToggle.check();
    const pageLevelPreview = page.locator('[data-admin-site-header-preview="true"][data-preview-device="desktop"]');
    await expect(pageLevelPreview).toBeVisible();

    const pageLevelEdgeDelta = await page.evaluate(() => {
      const preview = document.querySelector('[data-admin-site-header-preview="true"][data-preview-device="desktop"]');
      const placementBounds = preview?.querySelector('.topbar-placement-bounds');
      const logoLink = preview?.querySelector('a[aria-label="Atehna home"]');
      const cartButton = preview?.querySelector('button[aria-label^="Ko"]');
      const adminContentLane = document.querySelector('main main > div.mx-auto');
      if (
        !(placementBounds instanceof HTMLElement)
        || !(logoLink instanceof HTMLElement)
        || !(cartButton instanceof HTMLElement)
        || !(adminContentLane instanceof HTMLElement)
      ) {
        throw new Error('Predogled strani nima pričakovane geometrije zgornje vrstice.');
      }

      const boundsRect = placementBounds.getBoundingClientRect();
      const contentLaneRect = adminContentLane.getBoundingClientRect();
      return {
        logoToBounds: Math.abs(logoLink.getBoundingClientRect().left - boundsRect.left),
        cartToBounds: Math.abs(cartButton.getBoundingClientRect().right - boundsRect.right),
        boundsToLaneLeft: Math.abs(boundsRect.left - contentLaneRect.left),
        boundsToLaneRight: Math.abs(boundsRect.right - contentLaneRect.right)
      };
    });

    expect(pageLevelEdgeDelta.logoToBounds).toBeLessThanOrEqual(1);
    expect(pageLevelEdgeDelta.cartToBounds).toBeLessThanOrEqual(1);
    expect(pageLevelEdgeDelta.boundsToLaneLeft).toBeLessThanOrEqual(1);
    expect(pageLevelEdgeDelta.boundsToLaneRight).toBeLessThanOrEqual(1);
    await expect(page.getByRole('textbox', { name: 'X za Logotip', exact: true })).toHaveValue('0-88');

    const selectedWidthText = await page.getByText(/^Vsebina: \d+ px$/).first().textContent();
    const selectedWidthPx = Number(selectedWidthText?.match(/(\d+)/)?.[1]);
    const cartXInput = page.getByRole('textbox', { name: 'X za Košarica', exact: true });
    const cartRange = (await cartXInput.inputValue()).match(/^(\d+)-(\d+)$/);

    expect(Number.isFinite(selectedWidthPx)).toBe(true);
    expect(cartRange).not.toBeNull();
    expect(Number(cartRange?.[2])).toBe(selectedWidthPx);

    const movedCartStartXPx = Math.max(0, Number(cartRange?.[1]) - 8);
    await cartXInput.fill(`${movedCartStartXPx}-${movedCartStartXPx + 32}`);
    await cartXInput.press('Enter');
    await expect(cartXInput).toHaveValue(`${movedCartStartXPx}-${movedCartStartXPx + 32}`);

    await cartXInput.fill(`${selectedWidthPx - 32}-${selectedWidthPx}`);
    await cartXInput.press('Enter');
    await expect(cartXInput).toHaveValue(`${selectedWidthPx - 32}-${selectedWidthPx}`);
  });

  test('navigation top-bar offsets match the rendered Search, AI and Cart control boxes', async ({ page }) => {
    await page.setViewportSize({ width: 1600, height: 1000 });
    await page.goto('/admin/podoba/navigacija');

    const gutterInput = page.getByRole('textbox', { name: 'Min in Max odmik', exact: true });
    const searchXInput = page.getByRole('textbox', { name: 'X za Iskanje', exact: true });
    const aiXInput = page.getByRole('textbox', { name: 'X za Vprašaj AI', exact: true });
    const cartXInput = page.getByRole('textbox', { name: 'X za Košarica', exact: true });
    await expect(gutterInput).toBeVisible({ timeout: 15_000 });
    const headerPreviewSwitch = page.getByRole('switch', { name: 'Predogled', exact: true });
    await headerPreviewSwitch.check();
    await expect(headerPreviewSwitch).toBeChecked();

    await gutterInput.fill('0');
    await gutterInput.press('Enter');
    await searchXInput.fill('1050-1082');
    await searchXInput.press('Enter');
    await aiXInput.fill('1097-1213');
    await aiXInput.press('Enter');
    await cartXInput.fill('1228-1260');
    await cartXInput.press('Enter');

    await expect(page.getByRole('spinbutton', { name: 'Levi odmik za Vprašaj AI', exact: true })).toHaveValue('15');
    await expect(page.getByRole('spinbutton', { name: 'Desni odmik za Vprašaj AI', exact: true })).toHaveValue('15');
    await expect(
      page.locator('[data-admin-site-header-preview="true"] button[aria-label="Išči"]')
    ).toBeVisible();
    await expect(
      page.locator('[data-technical-topbar-renderer="true"] button[aria-label="Išči"]')
    ).toBeVisible();

    const renderedGaps = await page.evaluate(() => {
      const measure = (renderer: Element | null) => {
        const placementBounds = renderer?.querySelector('.topbar-placement-bounds');
        const searchButton = renderer?.querySelector('button[aria-label="Išči"]');
        const aiLink = renderer?.querySelector('a[href="/contact"]');
        const cartButton = renderer?.querySelector('button[aria-label^="Košarica"]');
        if (
          !(placementBounds instanceof HTMLElement)
          || !(searchButton instanceof HTMLElement)
          || !(aiLink instanceof HTMLElement)
          || !(cartButton instanceof HTMLElement)
        ) {
          throw new Error('Predogled nima pričakovanih kontrol zgornje vrstice.');
        }

        const boundsRect = placementBounds.getBoundingClientRect();
        const searchRect = searchButton.getBoundingClientRect();
        const aiRect = aiLink.getBoundingClientRect();
        const cartRect = cartButton.getBoundingClientRect();
        const previewScale = boundsRect.width / 1260;

        return {
          searchWidth: searchRect.width / previewScale,
          leftGap: (aiRect.left - searchRect.right) / previewScale,
          rightGap: (cartRect.left - aiRect.right) / previewScale
        };
      };

      return {
        pageLevel: measure(document.querySelector('[data-admin-site-header-preview="true"]')),
        technical: measure(document.querySelector('[data-technical-topbar-renderer="true"]'))
      };
    });

    for (const gaps of [renderedGaps.pageLevel, renderedGaps.technical]) {
      expect(Math.abs(gaps.searchWidth - 32)).toBeLessThan(0.25);
      expect(Math.abs(gaps.leftGap - 15)).toBeLessThan(0.25);
      expect(Math.abs(gaps.rightGap - 15)).toBeLessThan(0.25);
    }
  });

  test('navigation save preserves an edit made in flight and completes a second save', async ({ page }) => {
    type TopBarLayoutPayload = {
      responsive: {
        desktop: {
          items: Array<{ id: string; widthPx: number }>;
        };
      };
    };
    type NavigationPayload = {
      config: Record<string, unknown> & {
        topBarLayout: TopBarLayoutPayload;
        topBarInitialLayout: TopBarLayoutPayload;
      };
    };

    const savedPayloads: NavigationPayload[] = [];
    let releaseFirstSave: (() => void) | undefined;
    let signalFirstSaveStarted: (() => void) | undefined;
    const firstSaveGate = new Promise<void>((resolve) => { releaseFirstSave = resolve; });
    const firstSaveStarted = new Promise<void>((resolve) => { signalFirstSaveStarted = resolve; });

    await page.route('**/api/admin/site-navigation', async (route) => {
      if (route.request().method() !== 'PUT') {
        await route.continue();
        return;
      }

      const requestBody = route.request().postDataJSON() as NavigationPayload;
      savedPayloads.push(requestBody);
      if (savedPayloads.length === 1) {
        signalFirstSaveStarted?.();
        await firstSaveGate;
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          config: {
            ...requestBody.config,
            updatedAt: `2026-07-18T13:00:0${savedPayloads.length}.000Z`
          }
        })
      });
    });

    await page.setViewportSize({ width: 1600, height: 1000 });
    await page.goto('/admin/podoba/navigacija');

    const widthInput = page.getByRole('spinbutton', { name: 'Širina za Košarica', exact: true });
    const saveButton = page.getByRole('button', { name: 'Shrani', exact: true });
    const setDefaultsButton = page.getByRole('button', { name: 'Nastavi kot privzete nastavitve', exact: true });
    await expect(widthInput).toBeVisible({ timeout: 15_000 });
    await expect(saveButton).toBeDisabled();

    const initialWidth = Number(await widthInput.inputValue());
    const firstWidth = initialWidth >= 1192 ? initialWidth - 8 : initialWidth + 8;
    const newerWidth = firstWidth >= 1196 ? firstWidth - 4 : firstWidth + 4;

    await widthInput.fill(String(firstWidth));
    await expect(saveButton).toBeEnabled();

    const firstSaveClick = saveButton.click();
    await firstSaveStarted;
    await firstSaveClick;
    await expect(saveButton).toBeDisabled();
    await expect(setDefaultsButton).toBeDisabled();

    await widthInput.fill(String(newerWidth));
    await expect(widthInput).toHaveValue(String(newerWidth));
    releaseFirstSave?.();

    await expect(setDefaultsButton).toBeEnabled();
    await expect(widthInput).toHaveValue(String(newerWidth));
    await expect(saveButton).toBeEnabled();

    const firstSavedCart = savedPayloads[0]?.config.topBarLayout.responsive.desktop.items.find((item) => item.id === 'cart');
    expect(firstSavedCart?.widthPx).toBe(firstWidth);

    await saveButton.click();
    await expect.poll(() => savedPayloads.length).toBe(2);
    await expect(setDefaultsButton).toBeEnabled();
    await expect(widthInput).toHaveValue(String(newerWidth));
    await expect(saveButton).toBeDisabled();

    const secondSavedCart = savedPayloads[1]?.config.topBarLayout.responsive.desktop.items.find((item) => item.id === 'cart');
    expect(secondSavedCart?.widthPx).toBe(newerWidth);
  });

  test('setting the current navigation top bar as defaults persists the reset baseline', async ({ page }) => {
    type TopBarLayoutPayload = {
      responsive: {
        desktop: {
          items: Array<{ id: string; widthPx: number }>;
        };
      };
    };
    type NavigationPayload = {
      config: Record<string, unknown> & {
        topBarLayout: TopBarLayoutPayload;
        topBarInitialLayout: TopBarLayoutPayload;
      };
    };

    const savedPayloads: NavigationPayload[] = [];
    await page.route('**/api/admin/site-navigation', async (route) => {
      if (route.request().method() !== 'PUT') {
        await route.continue();
        return;
      }

      const requestBody = route.request().postDataJSON() as NavigationPayload;
      savedPayloads.push(requestBody);
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          config: {
            ...requestBody.config,
            updatedAt: '2026-07-18T13:10:00.000Z'
          }
        })
      });
    });

    await page.setViewportSize({ width: 1600, height: 1000 });
    await page.goto('/admin/podoba/navigacija');

    const topBarHeader = page.getByRole('heading', { level: 2, name: 'Zgornja vrstica', exact: true }).locator('..').locator('..');
    const resetTopBarButton = topBarHeader.getByRole('button', { name: 'Privzete nastavitve', exact: true });
    const setDefaultsButton = topBarHeader.getByRole('button', { name: 'Nastavi kot privzete nastavitve', exact: true });
    const saveButton = page.getByRole('button', { name: 'Shrani', exact: true });
    const widthInput = page.getByRole('spinbutton', { name: 'Širina za Košarica', exact: true });
    await expect(widthInput).toBeVisible({ timeout: 15_000 });

    const initialWidth = Number(await widthInput.inputValue());
    const defaultWidth = initialWidth >= 1190 ? initialWidth - 10 : initialWidth + 10;
    const temporaryWidth = defaultWidth >= 1195 ? defaultWidth - 5 : defaultWidth + 5;

    await widthInput.fill(String(defaultWidth));
    await expect(saveButton).toBeEnabled();
    await setDefaultsButton.click();

    await expect.poll(() => savedPayloads.length).toBe(1);
    await expect(page.getByText('Privzete nastavitve zgornje vrstice so shranjene.', { exact: true })).toBeVisible();
    await expect(setDefaultsButton).toBeEnabled();
    await expect(saveButton).toBeDisabled();

    const savedConfig = savedPayloads[0]!.config;
    const savedCart = savedConfig.topBarLayout.responsive.desktop.items.find((item) => item.id === 'cart');
    expect(savedCart?.widthPx).toBe(defaultWidth);
    expect(savedConfig.topBarInitialLayout).toEqual(savedConfig.topBarLayout);

    await widthInput.fill(String(temporaryWidth));
    await expect(widthInput).toHaveValue(String(temporaryWidth));
    await expect(saveButton).toBeEnabled();
    await resetTopBarButton.click();

    await expect(widthInput).toHaveValue(String(defaultWidth));
    await expect(saveButton).toBeDisabled();
    expect(savedPayloads).toHaveLength(1);
  });

  test('footer legal row uses a top divider without a surrounding outline', async ({ page }) => {
    await page.goto('/admin/podoba/navigacija');

    const footerPreview = page.getByTestId('site-footer-editor-preview');
    const copyrightButton = footerPreview.getByRole('button', { name: /^© \d{4} Atehna d\.o\.o\./ });
    await expect(copyrightButton).toBeVisible({ timeout: 15_000 });

    const borderWidths = await copyrightButton.evaluate((node) => {
      const row = node.closest('.site-divider');
      if (!(row instanceof HTMLElement)) throw new Error('Spodnja vrstica noge manjka.');
      const style = getComputedStyle(row);
      return {
        top: style.borderTopWidth,
        right: style.borderRightWidth,
        bottom: style.borderBottomWidth,
        left: style.borderLeftWidth
      };
    });

    expect(Number.parseFloat(borderWidths.top)).toBeGreaterThan(0);
    expect(borderWidths.right).toBe('0px');
    expect(borderWidths.bottom).toBe('0px');
    expect(borderWidths.left).toBe('0px');
  });

  test('navigation editor provides a visual footer editor and saves nested content', async ({ page }) => {
    await page.route('**/api/admin/site-navigation', async (route) => {
      if (route.request().method() !== 'PUT') {
        await route.continue();
        return;
      }

      const requestBody = route.request().postDataJSON() as { config: unknown };
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ config: requestBody.config })
      });
    });
    await page.goto('/admin/podoba/navigacija', { waitUntil: 'networkidle' });

    const footerEditor = page.getByTestId('site-footer-links-editor');
    const footerPreview = footerEditor.getByTestId('site-footer-editor-preview');
    await expect(footerEditor).toBeVisible({ timeout: 15_000 });
    await expect(footerEditor.getByRole('heading', { level: 2, name: 'Noga spletnega mesta' })).toBeVisible();
    await expect(footerPreview).toBeVisible();
    await expect(footerEditor.getByText(/^Kliknite besedilo za neposredno urejanje\./)).toHaveCount(0);

    const previewRadiusContract = await footerPreview.evaluate((frame) => {
      const surface = frame.querySelector<HTMLElement>('[data-admin-editor-preview-surface="true"]');
      const footer = surface?.querySelector<HTMLElement>(':scope > footer');
      const content = footer?.querySelector<HTMLElement>(':scope > .site-container');
      if (!surface || !footer || !content) throw new Error('Footer preview radius layers are missing.');

      const snapshot = (element: HTMLElement) => {
        const style = getComputedStyle(element);
        return {
          overflow: style.overflow,
          radii: [
            style.borderTopLeftRadius,
            style.borderTopRightRadius,
            style.borderBottomRightRadius,
            style.borderBottomLeftRadius
          ]
        };
      };

      return {
        frame: snapshot(frame as HTMLElement),
        surface: snapshot(surface),
        footer: snapshot(footer),
        content: snapshot(content)
      };
    });
    const frameRadii = previewRadiusContract.frame.radii;
    expect(previewRadiusContract.frame.overflow).toBe('visible');
    expect(new Set(frameRadii).size).toBe(1);
    expect(parseFloat(frameRadii[0] ?? '0')).toBeGreaterThan(0);
    for (const layer of [
      previewRadiusContract.surface,
      previewRadiusContract.footer,
      previewRadiusContract.content
    ]) {
      expect(layer.radii).toEqual(frameRadii);
    }

    const footerColumns = footerPreview.getByRole('navigation', { name: 'Povezave v nogi' });
    const footerColumnMoveButtons = footerColumns.getByRole('button', { name: /^Premakni stolpec / });
    const footerColumnOptionButtons = footerColumns.getByRole('button', { name: /^Možnosti stolpca / });
    const footerLinkMoveButtons = footerColumns.getByRole('button', { name: /^Premakni (?!stolpec )/ });
    const footerLinkOptionButtons = footerColumns.getByRole('button', { name: /^Možnosti povezave v nogi / });
    await expect(footerColumnMoveButtons).toHaveCount(0);
    await expect(footerColumnOptionButtons).toHaveCount(3);
    await expect(footerLinkMoveButtons).toHaveCount(9);
    await expect(footerLinkOptionButtons).toHaveCount(9);
    for (const columnTitle of ['Izdelki', 'Podpora', 'O nas']) {
      await expect(footerColumns.getByRole('button', { name: columnTitle, exact: true })).toBeVisible();
    }

    const columnTitleButtons = footerColumns.getByRole('button', { name: /^(Izdelki|Podpora|O nas)$/ });
    const addFooterColumnButton = footerPreview.getByRole('button', { name: 'Dodaj stolpec v nogo' });
    await expect(columnTitleButtons).toHaveCount(3);
    await expect(addFooterColumnButton).toBeVisible();
    const [columnTitleBoxes, columnMenuBoxes, columnsNavBox, addFooterColumnBox] = await Promise.all([
      columnTitleButtons.evaluateAll((nodes) => nodes.map((node) => {
        const box = node.getBoundingClientRect();
        return { x: box.x, y: box.y, width: box.width, height: box.height };
      })),
      footerColumnOptionButtons.evaluateAll((nodes) => nodes.map((node) => {
        const box = node.getBoundingClientRect();
        return { x: box.x, y: box.y, width: box.width, height: box.height };
      })),
      footerColumns.boundingBox(),
      addFooterColumnButton.boundingBox()
    ]);
    expect(columnsNavBox).not.toBeNull();
    expect(addFooterColumnBox).not.toBeNull();
    if (!columnsNavBox || !addFooterColumnBox) throw new Error('Kontrole stolpcev noge nimajo merljive geometrije.');
    const addFooterColumnCenterY = addFooterColumnBox.y + addFooterColumnBox.height / 2;
    columnTitleBoxes.forEach((titleBox, index) => {
      const menuBox = columnMenuBoxes[index];
      if (!menuBox) throw new Error('Stolpec noge nima menijske kontrole.');
      const titleCenterY = titleBox.y + titleBox.height / 2;
      const menuCenterY = menuBox.y + menuBox.height / 2;
      expect(Math.abs(menuCenterY - titleCenterY)).toBeLessThanOrEqual(4);
      expect(Math.abs(addFooterColumnCenterY - titleCenterY)).toBeLessThanOrEqual(4);
    });
    expect(addFooterColumnBox.x).toBeGreaterThanOrEqual(columnsNavBox.x + columnsNavBox.width - 1);

    for (const columnTitle of ['Izdelki', 'Podpora', 'O nas']) {
      const columnEditor = footerColumns
        .getByRole('button', { name: columnTitle, exact: true })
        .locator(
          'xpath=ancestor::div[contains(concat(" ", normalize-space(@class), " "), " group/footer-column ")][1]'
        );
      const headingMenu = columnEditor.getByRole('button', { name: `Možnosti stolpca ${columnTitle}` });
      const linkMenus = columnEditor.getByRole('button', { name: /^Možnosti povezave v nogi / });
      const [headingMenuBox, linkMenuBoxes] = await Promise.all([
        headingMenu.boundingBox(),
        linkMenus.evaluateAll((nodes) => nodes.map((node) => {
          const box = node.getBoundingClientRect();
          return { x: box.x, width: box.width };
        }))
      ]);

      expect(headingMenuBox).not.toBeNull();
      if (!headingMenuBox) throw new Error(`Meni stolpca ${columnTitle} nima merljive geometrije.`);
      const headingMenuCenterX = headingMenuBox.x + headingMenuBox.width / 2;
      linkMenuBoxes.forEach((linkMenuBox) => {
        const linkMenuCenterX = linkMenuBox.x + linkMenuBox.width / 2;
        expect(Math.abs(linkMenuCenterX - headingMenuCenterX)).toBeLessThanOrEqual(1);
      });
    }

    const expectPersistentFooterOptions = async (buttons: typeof footerColumnOptionButtons) => {
      const visibleStates = await buttons.evaluateAll((nodes) => nodes.map((node) => {
        let current: Element | null = node;
        while (current) {
          const style = getComputedStyle(current);
          if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) === 0) return false;
          if (current.getAttribute('data-testid') === 'site-footer-editor-preview') break;
          current = current.parentElement;
        }
        return true;
      }));
      expect(visibleStates.every(Boolean)).toBe(true);
    };
    await page.mouse.move(0, 0);
    await expectPersistentFooterOptions(footerColumnOptionButtons);
    await expectPersistentFooterOptions(footerLinkOptionButtons);

    const catalogMoveButton = footerColumns.getByRole('button', { name: 'Premakni Katalog' });
    const projectsMoveButton = footerColumns.getByRole('button', { name: 'Premakni Projekti' });
    await catalogMoveButton.scrollIntoViewIfNeeded();
    const [catalogMoveBox, catalogRowBox, projectsMoveBox] = await Promise.all([
      catalogMoveButton.boundingBox(),
      catalogMoveButton.locator('..').boundingBox(),
      projectsMoveButton.boundingBox()
    ]);
    expect(catalogMoveBox).not.toBeNull();
    expect(catalogRowBox).not.toBeNull();
    expect(projectsMoveBox).not.toBeNull();
    if (!catalogMoveBox || !catalogRowBox || !projectsMoveBox) throw new Error('Povezav v nogi ni mogoče premakniti.');
    expect(Math.abs(catalogMoveBox.x - catalogRowBox.x)).toBeLessThanOrEqual(1);
    expect(Math.abs(catalogMoveBox.y - catalogRowBox.y)).toBeLessThanOrEqual(1);
    expect(Math.abs(catalogMoveBox.width - catalogRowBox.width)).toBeLessThanOrEqual(2);
    expect(Math.abs(catalogMoveBox.height - catalogRowBox.height)).toBeLessThanOrEqual(2);
    await expect(catalogMoveButton).toHaveAttribute('aria-roledescription', 'sortable');
    await expect(catalogMoveButton).toHaveAttribute('aria-describedby', /site-footer-column-links-/);

    const dragStart = {
      x: catalogMoveBox.x + catalogMoveBox.width - 36,
      y: catalogMoveBox.y + catalogMoveBox.height / 2
    };
    const dragEnd = {
      x: projectsMoveBox.x + projectsMoveBox.width - 36,
      y: projectsMoveBox.y + projectsMoveBox.height * 0.75
    };
    await page.mouse.move(dragStart.x, dragStart.y);
    await page.mouse.down();
    for (let step = 1; step <= 20; step += 1) {
      const progress = step / 20;
      await page.mouse.move(
        dragStart.x + (dragEnd.x - dragStart.x) * progress,
        dragStart.y + (dragEnd.y - dragStart.y) * progress
      );
      await page.waitForTimeout(16);
    }
    await page.mouse.up();
    await expect(footerColumns.getByRole('button', { name: /^(Katalog|Za šole|Projekti)$/ })).toHaveText([
      'Za šole',
      'Projekti',
      'Katalog'
    ]);
    await expect(footerColumns.getByRole('heading', { level: 2 })).toHaveText(['Izdelki', 'Podpora', 'O nas']);

    const catalogFooterLink = footerColumns.getByRole('button', { name: 'Katalog', exact: true });
    await catalogFooterLink.hover();
    await expect(catalogFooterLink).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
    await expect(catalogFooterLink.locator('..')).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');

    await expect(footerPreview.getByRole('button', { name: 'info@atehna.si', exact: true })).toBeVisible();
    const phoneValue = '+386 1 234 56 78';
    const phoneEditor = footerPreview.getByRole('button', { name: phoneValue, exact: true });
    await expect(phoneEditor).toBeVisible();
    await expect(footerPreview.getByRole('link', { name: phoneValue, exact: true })).toHaveCount(0);
    await expect(footerPreview.locator('a[href^="tel:"]')).toHaveCount(0);
    await expect(phoneEditor).not.toHaveClass(/(?:^|\s)site-link(?:\s|$)/);
    await phoneEditor.click();
    const phoneInput = footerPreview.getByRole('textbox', { name: 'Telefon', exact: true });
    await expect(phoneInput).toHaveValue(phoneValue);
    await phoneInput.fill('+386 1 234 56 79');
    await phoneInput.press('Escape');
    await expect(phoneEditor).toBeVisible();
    await expect(phoneEditor).toHaveText(phoneValue);
    await expect(footerPreview.getByRole('button', { name: 'Ulica in kraj', exact: true })).toBeVisible();
    await expect(footerPreview.getByRole('button', { name: 'Pon-Pet 8:00-16:00', exact: true })).toBeVisible();
    await expect(footerPreview.getByRole('heading', { level: 2, name: 'Spremljajte nas' })).toBeVisible();
    const socialRegion = footerPreview.getByRole('region', { name: 'Spremljajte nas' });
    const socialMoveButtons = socialRegion.getByRole('button', { name: /^Premakni družbeno omrežje / });
    const socialOptionButtons = socialRegion.getByRole('button', { name: /^Možnosti družbenega omrežja / });
    const addSocialButton = socialRegion.getByRole('button', { name: 'Dodaj družbeni profil' });
    await expect(socialMoveButtons).toHaveCount(4);
    await expect(socialOptionButtons).toHaveCount(4);
    await expectPersistentFooterOptions(socialOptionButtons);
    await page.evaluate(async () => { await document.fonts.ready; });

    const socialBrandIcons = socialRegion.locator('svg[data-social-brand-icon="true"][data-social-type]');
    await expect(socialBrandIcons).toHaveCount(4);
    expect(await socialBrandIcons.evaluateAll((nodes) => nodes.map((node) => node.getAttribute('data-social-type'))))
      .toEqual(['facebook', 'instagram', 'youtube', 'linkedin']);
    await expect(socialRegion.locator('svg.lucide-globe-2')).toHaveCount(0);
    const socialBrandGeometry = await socialBrandIcons.evaluateAll((nodes) => nodes.map((node) => (
      node.innerHTML.replace(/\s+/g, ' ').trim()
    )));
    expect(socialBrandGeometry.every((geometry) => geometry.length > 0)).toBe(true);
    expect(new Set(socialBrandGeometry).size).toBe(4);

    const socialIconSurfaces = socialBrandIcons.locator('xpath=parent::*');
    const [socialMoveBoxes, socialIconSurfaceBoxes, socialMenuBoxes, lastSocialRowBox, addSocialBox] = await Promise.all([
      socialMoveButtons.evaluateAll((nodes) => nodes.map((node) => {
        const box = node.getBoundingClientRect();
        return { x: box.x, y: box.y, width: box.width, height: box.height };
      })),
      socialIconSurfaces.evaluateAll((nodes) => nodes.map((node) => {
        const box = node.getBoundingClientRect();
        return { x: box.x, y: box.y, width: box.width, height: box.height };
      })),
      socialOptionButtons.evaluateAll((nodes) => nodes.map((node) => {
        const box = node.getBoundingClientRect();
        return { x: box.x, y: box.y, width: box.width, height: box.height };
      })),
      socialMoveButtons.last().locator('..').boundingBox(),
      addSocialButton.boundingBox()
    ]);
    expect(lastSocialRowBox).not.toBeNull();
    expect(addSocialBox).not.toBeNull();
    if (!lastSocialRowBox || !addSocialBox) throw new Error('Kontrole družbenih omrežij nimajo merljive geometrije.');
    expect(socialMoveBoxes).toHaveLength(4);
    expect(socialIconSurfaceBoxes).toHaveLength(4);
    expect(socialMenuBoxes).toHaveLength(4);
    socialMoveBoxes.forEach((moveBox, index) => {
      const iconBox = socialIconSurfaceBoxes[index];
      const menuBox = socialMenuBoxes[index];
      if (!iconBox || !menuBox) throw new Error('Družbeni profil nima vseh kontrol.');
      const iconCenterY = iconBox.y + iconBox.height / 2;
      const menuCenterY = menuBox.y + menuBox.height / 2;
      const menuGap = menuBox.x - (iconBox.x + iconBox.width);
      expect(Math.abs(menuCenterY - iconCenterY)).toBeLessThanOrEqual(1);
      expect(menuGap).toBeGreaterThanOrEqual(0);
      expect(menuGap).toBeLessThanOrEqual(8);
      expect(moveBox.x).toBeLessThanOrEqual(iconBox.x);
      expect(moveBox.y).toBeLessThanOrEqual(iconBox.y);
      expect(moveBox.x + moveBox.width).toBeGreaterThanOrEqual(menuBox.x + menuBox.width);
      expect(moveBox.y + moveBox.height).toBeGreaterThanOrEqual(menuBox.y + menuBox.height);
    });
    const lastSocialBox = socialMoveBoxes.at(-1)!;
    expect(Math.abs(lastSocialBox.x - lastSocialRowBox.x)).toBeLessThanOrEqual(1);
    expect(Math.abs(lastSocialBox.y - lastSocialRowBox.y)).toBeLessThanOrEqual(1);
    expect(Math.abs(lastSocialBox.width - lastSocialRowBox.width)).toBeLessThanOrEqual(2);
    expect(Math.abs(lastSocialBox.height - lastSocialRowBox.height)).toBeLessThanOrEqual(2);
    expect(addSocialBox.x).toBeGreaterThan(lastSocialBox.x + lastSocialBox.width);
    expect(Math.abs(
      (addSocialBox.y + addSocialBox.height / 2) - (lastSocialBox.y + lastSocialBox.height / 2)
    )).toBeLessThanOrEqual(1);

    await socialOptionButtons.first().click();
    await socialRegion.getByRole('button', { name: 'Skrij', exact: true }).click();
    await expect(socialRegion.getByText('Skrito', { exact: true })).toHaveCount(1);
    await socialOptionButtons.first().click();
    await socialRegion.getByRole('button', { name: 'Prikaži', exact: true }).click();
    await expect(socialRegion.getByText('Skrito', { exact: true })).toHaveCount(0);

    await addSocialButton.click();
    await expect(socialMoveButtons).toHaveCount(5);
    await socialRegion.getByRole('button', { name: 'Možnosti družbenega omrežja Nov profil' }).click();
    await socialRegion.getByRole('button', { name: 'Izbriši', exact: true }).click();
    await expect(socialMoveButtons).toHaveCount(4);
    await expect(footerPreview.getByRole('button', { name: 'Dodaj pravno povezavo' })).toBeVisible();
    await expect(footerPreview.getByRole('button', { name: /^© \d{4} Atehna d\.o\.o\./ })).toBeVisible();
    const legalEditor = footerPreview.getByLabel('Urejanje pravnih povezav');
    const legalMoveButtons = legalEditor.getByRole('button', { name: /^Premakni / });
    const legalOptionButtons = legalEditor.getByRole('button', { name: /^Možnosti povezave v nogi / });
    await expect(legalMoveButtons).toHaveCount(3);
    await expect(legalOptionButtons).toHaveCount(3);
    await expectPersistentFooterOptions(legalOptionButtons);
    await expect(footerPreview.getByRole('button', { name: /^Ikona za/ })).toHaveCount(0);

    const copyrightButton = footerPreview.getByRole('button', { name: /^© \d{4} Atehna d\.o\.o\./ });
    const termsButton = legalEditor.getByRole('button', { name: 'Pogoji uporabe', exact: true });
    const privacyButton = legalEditor.getByRole('button', { name: 'Zasebnost', exact: true });
    const cookiesButton = legalEditor.getByRole('button', { name: 'Piškotki', exact: true });
    const addLegalButton = footerPreview.getByRole('button', { name: 'Dodaj pravno povezavo' });
    const legalBoxes = await Promise.all([
      copyrightButton.boundingBox(),
      termsButton.boundingBox(),
      privacyButton.boundingBox(),
      cookiesButton.boundingBox(),
      legalOptionButtons.last().boundingBox(),
      addLegalButton.boundingBox()
    ]);
    const [copyrightBox, termsBox, privacyBox, cookiesBox, lastLegalOptionsBox, addLegalBox] = legalBoxes.map((box) => {
      expect(box).not.toBeNull();
      if (!box) throw new Error('Element spodnje vrstice noge nima merljive geometrije.');
      return box;
    });
    const legalCenters = [copyrightBox, termsBox, privacyBox, cookiesBox, lastLegalOptionsBox, addLegalBox]
      .map((box) => box.y + box.height / 2);
    legalCenters.slice(1).forEach((center) => {
      expect(Math.abs(center - legalCenters[0])).toBeLessThanOrEqual(1);
    });
    const legalRowCenterY = await copyrightButton.evaluate((node) => {
      const row = node.closest('.site-divider');
      if (!(row instanceof HTMLElement)) throw new Error('Spodnja vrstica noge manjka.');
      const box = row.getBoundingClientRect();
      const style = getComputedStyle(row);
      const usableTop = box.top + (Number.parseFloat(style.borderTopWidth) || 0);
      const usableBottom = box.bottom - (Number.parseFloat(style.borderBottomWidth) || 0);
      return (usableTop + usableBottom) / 2;
    });
    const legalRowBorders = await copyrightButton.evaluate((node) => {
      const row = node.closest('.site-divider');
      if (!(row instanceof HTMLElement)) throw new Error('Spodnja vrstica noge manjka.');
      const style = getComputedStyle(row);
      return {
        top: style.borderTopWidth,
        right: style.borderRightWidth,
        bottom: style.borderBottomWidth,
        left: style.borderLeftWidth
      };
    });
    expect(Number.parseFloat(legalRowBorders.top)).toBeGreaterThan(0);
    expect(legalRowBorders.right).toBe('0px');
    expect(legalRowBorders.bottom).toBe('0px');
    expect(legalRowBorders.left).toBe('0px');
    legalCenters.forEach((center) => {
      expect(Math.abs(center - legalRowCenterY)).toBeLessThanOrEqual(1);
    });
    expect(addLegalBox.width).toBe(28);
    expect(addLegalBox.height).toBe(28);
    expect(termsBox.x).toBeGreaterThan(copyrightBox.x + copyrightBox.width);
    expect(privacyBox.x).toBeGreaterThan(termsBox.x + termsBox.width);
    expect(cookiesBox.x).toBeGreaterThan(privacyBox.x + privacyBox.width);
    const legalAddGap = addLegalBox.x - (lastLegalOptionsBox.x + lastLegalOptionsBox.width);
    expect(legalAddGap).toBeGreaterThanOrEqual(4);
    expect(legalAddGap).toBeLessThanOrEqual(12);

    const nextEmail = 'footer-test@atehna.si';
    await footerPreview.getByRole('button', { name: 'info@atehna.si', exact: true }).click();
    await footerPreview.getByRole('textbox', { name: 'E-pošta', exact: true }).fill(nextEmail);
    await footerColumns.getByRole('button', { name: /^Dodaj povezavo v / }).first().click();
    await expect(footerColumns.getByRole('button', { name: /^Možnosti povezave v nogi / })).toHaveCount(10);

    await footerColumns.getByRole('button', { name: 'Nova povezava', exact: true }).click();
    const newLinkLabel = 'Testna povezava v nogi';
    const linkLabelInput = footerColumns.getByRole('textbox', { name: 'Naziv povezave v nogi' });
    await linkLabelInput.fill(newLinkLabel);
    await linkLabelInput.press('Enter');

    const saveButton = page.getByRole('button', { name: 'Shrani', exact: true });
    await expect(saveButton).toBeEnabled();
    const saveRequestPromise = page.waitForRequest((request) => (
      request.method() === 'PUT' && request.url().includes('/api/admin/site-navigation')
    ));
    await saveButton.click();
    const saveRequest = await saveRequestPromise;
    const savedPayload = saveRequest.postDataJSON() as {
      config: {
        footer: {
          contact: { email: string };
          columns: Array<{ links: Array<{ label: string; position: number }> }>;
        };
      };
    };

    expect(savedPayload.config.footer.contact.email).toBe(nextEmail);
    const savedFirstColumnLinks = savedPayload.config.footer.columns[0]?.links ?? [];
    expect(savedFirstColumnLinks.map((link) => link.label)).toEqual([
      'Za šole',
      'Projekti',
      'Katalog',
      newLinkLabel
    ]);
    expect(savedFirstColumnLinks.map((link) => link.position)).toEqual([0, 1, 2, 3]);
    expect(savedPayload.config.footer.columns.flatMap((column) => column.links.map((link) => link.label))).toContain(newLinkLabel);
  });
});
