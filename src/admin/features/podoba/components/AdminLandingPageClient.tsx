'use client';

import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState, type ChangeEvent, type CSSProperties, type ReactNode, type RefObject } from 'react';
import { createPortal, flushSync } from 'react-dom';
import { useRouter } from 'next/navigation';
import { uploadAdminPublicMedia } from '@/shared/client/publicMediaUpload';
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent
} from '@dnd-kit/core';
import { SortableContext, arrayMove, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  ArrowDown,
  ArrowUp,
  Bold,
  ChevronDown,
  Copy,
  Eye,
  EyeClosed,
  Grid3X3,
  GripVertical,
  Images,
  Italic,
  Layers3,
  Link as LinkIcon,
  Lock,
  Magnet,
  Maximize2,
  MoreVertical,
  MousePointer2,
  Pencil,
  Plus,
  Ruler,
  Save,
  SlidersHorizontal,
  SquareDashed,
  Trash2,
  Underline,
  Unlock,
  Upload,
  X
} from 'lucide-react';
import HomepageRenderer, {
  DEFAULT_HOMEPAGE_CANVAS_EDITOR_OPTIONS,
  HOMEPAGE_CATEGORY_TITLE_SHARED_CANVAS_ELEMENT_ID,
  type HomepageCanvasEditorOptions
} from '@/commercial/components/landing/HomepageRenderer';
import { COMMERCIAL_STOREFRONT_SCALE, toCommercialStorefrontLogicalPx } from '@/commercial/components/commercialStorefrontScale';
import SiteHeader from '@/commercial/components/SiteHeader';
import {
  HOMEPAGE_BUTTON_STYLES,
  HOMEPAGE_CATEGORY_CARD_SIZES,
  HOMEPAGE_CATEGORY_CARD_STYLES,
  HOMEPAGE_CATEGORY_ORDER_MODES,
  HOMEPAGE_CONTAINER_WIDTHS,
  HOMEPAGE_FOOTER_SPACINGS,
  HOMEPAGE_HERO_FONT_FAMILIES,
  HOMEPAGE_INFO_ICONS,
  HOMEPAGE_INFO_ICON_POSITIONS,
  HOMEPAGE_INFO_STYLES,
  MAX_HOMEPAGE_HERO_SLIDES,
  HOMEPAGE_PREVIEW_DEVICES,
  HOMEPAGE_PREVIEW_PROFILES,
  HOMEPAGE_SECTION_IDS,
  HOMEPAGE_SECTION_RADII,
  HOMEPAGE_SECTION_SPACINGS,
  DEFAULT_HOMEPAGE_CANVAS_ELEMENT_DEVICE_SETTINGS,
  createDefaultHomepageCategoryTitleCanvasSettings,
  homepageButtonStyleLabels,
  homepageCategoryCardSizeLabels,
  homepageCategoryCardStyleLabels,
  homepageCategoryOrderModeLabels,
  homepageContainerWidthLabels,
  homepageFooterSpacingLabels,
  homepageInfoIconLabels,
  homepageInfoIconPositionLabels,
  homepageInfoStyleLabels,
  homepagePreviewDeviceLabels,
  homepageSectionLabels,
  homepageSectionRadiusLabels,
  homepageSectionSpacingLabels,
  getHomepagePreviewDeviceForViewport,
  isDeletableHomepageCanvasElementId,
  normalizeLandingPageConfig,
  orderHomepageCategories,
  removeDeletableHomepageCanvasElement,
  resolveHomepageSectionLabel,
  resolveHomepageCanvasElementDeviceSettings,
  toStoredLandingPageConfig,
  type HomepageCanvasElementDeviceSettings,
  type HomepageCategoryCardData,
  type HomepageCategoriesDeviceSettings,
  type HomepageFooterDeviceSettings,
  type HomepageHeroDeviceSettings,
  type HomepageHeroFontFamily,
  type HomepageHeroSlide,
  type HomepageHeroTextBlock,
  type HomepageInfoBlocksDeviceSettings,
  type HomepageInfoBlockItem,
  type HomepagePageDeviceSettings,
  type HomepagePreviewDevice,
  type HomepageSectionId,
  type HomepageSettings
} from '@/shared/domain/landing/landingPage';
import { getWebsiteFontFamilyLabel } from '@/shared/domain/style/fontFamilies';
import { toGlobalStyleCssVariables, type GlobalStyleConfig } from '@/shared/domain/style/globalStyle';
import { normalizeSiteNavigationConfig, type SiteNavigationConfig } from '@/shared/domain/navigation/siteNavigation';
import {
  CATEGORY_SHOWCASE_BASE_CAPABILITIES,
  CategoryShowcaseEditor
} from '@/shared/features/category-showcase/CategoryShowcaseEditor';
import { useCategoryShowcaseEditor } from '@/shared/features/category-showcase/useCategoryShowcaseEditor';
import {
  fetchCategoryShowcaseUpdates,
  mergeCategoryDataChangeMessages,
  subscribeToCategoryDataChanges,
  type CategoryDataChangeMessage
} from '@/shared/features/category-showcase/categoryShowcaseSync';
import type { CategoryShowcaseMediaSettings } from '@/shared/features/category-showcase/categoryShowcaseSchema';
import { AdminPageHeader } from '@/shared/ui/admin-primitives';
import { Button } from '@/shared/ui/button';
import {
  appearancePreviewTransitionDurationMs as previewViewportTransitionDurationMs,
  appearancePreviewTransitionEasing as previewFrameTransitionEasing,
  easeAppearancePreviewProgress as easePreviewViewportProgress,
  interpolateAppearancePreviewValue as lerpPreviewWidth,
  preserveAdjacentAppearancePreviewDevice,
  roundAppearancePreviewValue as roundPreviewWidth,
  usePrefersReducedMotion
} from '@/shared/ui/responsive-preview-motion';
import { CompactHexColorField } from '@/shared/ui/admin-controls/CompactHexColorField';
import { useDropdownDismiss } from '@/shared/ui/dropdown/use-dropdown-dismiss';
import { Input } from '@/shared/ui/input';
import {
  adminTablePrimaryButtonClassName
} from '@/shared/ui/admin-table/standards';
import {
  adminControlFocusTokenClasses,
  adminControlFocusWithinTokenClasses,
  adminInputFocusTokenClasses,
  adminMiniIconButtonTokenClasses
} from '@/shared/ui/theme/tokens';
import { useToast } from '@/shared/ui/toast';
import AdminPodobaTabs from './AdminPodobaTabs';
import {
  AppearanceEditorAlignmentControl,
  AppearanceEditorCompactSelect,
  AppearanceEditorNumberInput
} from './AppearanceEditorToolbarPrimitives';

const classNames = (...parts: Array<string | false | null | undefined>) => parts.filter(Boolean).join(' ');

const panelClassName = 'rounded-xl border border-slate-200 bg-white';
const labelClassName =
  'text-[10px] font-medium leading-3.5 text-[color:var(--homepage-inspector-muted,#64748b)]';
const inspectorFieldRowClassName = 'grid min-w-0 grid-cols-[minmax(68px,0.72fr)_minmax(0,1.28fr)] items-center gap-2';
const inputClassName =
  `h-7 w-full rounded-md border !border-[color:var(--homepage-inspector-input-border,#e2e8f0)] !bg-[color:var(--homepage-inspector-input-bg,#f8fafc)] px-2 text-[11px] leading-[1.2] !text-[color:var(--homepage-inspector-input-text,#1e293b)] font-['Inter',system-ui,sans-serif] transition placeholder:!text-[color:var(--homepage-inspector-input-placeholder,#94a3b8)] hover:!border-[color:var(--homepage-inspector-input-border-hover,#cbd5e1)] hover:!bg-[color:var(--homepage-inspector-input-hover,#ffffff)] focus:!bg-[color:var(--homepage-inspector-input-focus,#ffffff)] ${adminInputFocusTokenClasses}`;
const textareaClassName = `${inputClassName} min-h-[52px] resize-y py-1.5 leading-4`;
const segmentedControlClassName = 'flex items-center gap-0.5 rounded-md bg-[color:var(--homepage-inspector-control-bg,#f1f5f9)] p-0.5';
const homepageDarkGlassFrameClassName =
  'border-white/15 shadow-[0_16px_40px_rgba(30,41,53,0.38),0_3px_12px_rgba(30,41,53,0.28)] backdrop-blur-xl';
const homepageToolbarPopoverSurfaceClassName =
  `rounded-xl border bg-black/90 ${homepageDarkGlassFrameClassName}`;
const topActionSaveButtonClassName =
  `gap-2 ${adminTablePrimaryButtonClassName} !h-9 !leading-none disabled:!border-transparent disabled:!bg-[color:var(--blue-500)] disabled:!text-white disabled:!opacity-50`;

type HeroTypographyUpdates = Partial<
  Pick<
    HomepageHeroDeviceSettings,
    | 'titleFontFamily'
    | 'titleFontSizePx'
    | 'titleBold'
    | 'titleItalic'
    | 'titleUnderline'
    | 'titleHighlight'
    | 'titleHighlightColor'
    | 'descriptionFontFamily'
    | 'descriptionFontSizePx'
    | 'descriptionBold'
    | 'descriptionItalic'
    | 'descriptionUnderline'
    | 'descriptionHighlight'
    | 'descriptionHighlightColor'
  >
>;
type HeroPositionUpdates = Partial<
  Pick<
    HomepageHeroDeviceSettings,
    | 'contentOffsetXPx'
    | 'contentOffsetYPx'
    | 'titleOffsetXPx'
    | 'titleOffsetYPx'
    | 'descriptionOffsetXPx'
    | 'descriptionOffsetYPx'
    | 'primaryButtonOffsetXPx'
    | 'primaryButtonOffsetYPx'
    | 'secondaryButtonOffsetXPx'
    | 'secondaryButtonOffsetYPx'
  >
>;
type HeroTextContentUpdates = Partial<Pick<HomepageSettings['hero'], 'title' | 'description'>>;
type CategoryTextUpdates = Partial<Pick<HomepageSettings['categories'], 'title' | 'subtitle' | 'showAllLabel'>>;
type HeroTextBlockUpdates = Partial<HomepageHeroTextBlock>;

type ToolbarPopover = 'create' | 'structure' | 'section' | 'carousel' | 'page' | 'style' | 'layout' | 'spacing' | 'link' | 'view' | 'media' | null;
type HomepageToolbarHost = 'inline' | 'floating';
type CategoryTitleEditScope = 'all' | 'selected';
type Option<Value extends string> = { value: Value; label: string };

const categoryTitleCanvasElementPrefix = 'categories:title:';
const categoryTitleScopedStyleKeys = new Set<keyof HomepageCanvasElementDeviceSettings>([
  'offsetXPx',
  'offsetYPx',
  'widthPx',
  'heightPx',
  'paddingTopPx',
  'paddingRightPx',
  'paddingBottomPx',
  'paddingLeftPx',
  'marginTopPx',
  'marginRightPx',
  'marginBottomPx',
  'marginLeftPx',
  'horizontalAlign',
  'textAlign',
  'color',
  'fontFamily',
  'fontSizePx',
  'lineHeight',
  'letterSpacingPx',
  'fontWeight',
  'italic',
  'underline'
]);

function isCategoryTitleCanvasElement(elementId: string | null | undefined) {
  return Boolean(
    elementId?.startsWith(categoryTitleCanvasElementPrefix)
    && elementId !== HOMEPAGE_CATEGORY_TITLE_SHARED_CANVAS_ELEMENT_ID
  );
}

function comparable(config: HomepageSettings) {
  return JSON.stringify(toStoredLandingPageConfig(config));
}

function withSectionTitle(config: HomepageSettings, sectionId: HomepageSectionId, title: string) {
  const trimmedTitle = title.trim();
  const sectionTitles = { ...config.sectionTitles };

  if (!trimmedTitle || trimmedTitle === homepageSectionLabels[sectionId]) {
    delete sectionTitles[sectionId];
  } else {
    sectionTitles[sectionId] = trimmedTitle;
  }

  return { ...config, sectionTitles };
}

function cloneConfig<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function createId(prefix: string) {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return `${prefix}-${crypto.randomUUID()}`;
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function getFileBaseName(fileName: string) {
  return fileName.replace(/\.[^.]+$/, '').trim();
}

function detectHeroMediaTypeFromSource(source: string, fallback: HomepageHeroSlide['type'] = 'image'): HomepageHeroSlide['type'] {
  const cleanSource = source.split(/[?#]/)[0]?.toLowerCase() ?? '';
  if (/\.(mp4|webm|ogg|ogv|mov|m4v|avi|mkv)$/.test(cleanSource)) return 'video';
  if (/\.(jpg|jpeg|png|gif|webp|avif|svg|bmp|tiff)$/.test(cleanSource)) return 'image';
  return fallback;
}

function detectHeroMediaTypeFromFile(file: File): HomepageHeroSlide['type'] {
  const mimeType = file.type.toLowerCase();
  if (mimeType.startsWith('video/')) return 'video';
  if (mimeType.startsWith('image/')) return 'image';
  return detectHeroMediaTypeFromSource(file.name, 'image');
}

function createOptions<Value extends string>(values: readonly Value[], labels: Record<Value, string>): Array<Option<Value>> {
  return values.map((value) => ({ value, label: labels[value] }));
}

function useMeasuredElementWidth<T extends HTMLElement>() {
  const elementRef = useRef<T | null>(null);
  const [width, setWidth] = useState(0);

  const measureRef = useCallback((node: T | null) => {
    elementRef.current = node;
    if (node) setWidth(Math.round(node.getBoundingClientRect().width));
  }, []);

  useLayoutEffect(() => {
    const element = elementRef.current;
    if (!element) return undefined;

    const updateWidth = () => {
      setWidth(Math.round(element.getBoundingClientRect().width));
    };

    updateWidth();
    const animationFrame = window.requestAnimationFrame(updateWidth);

    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', updateWidth);
      return () => {
        window.cancelAnimationFrame(animationFrame);
        window.removeEventListener('resize', updateWidth);
      };
    }

    const resizeObserver = new ResizeObserver((entries) => {
      const entry = entries[0];
      setWidth(Math.round(entry?.contentRect.width ?? element.getBoundingClientRect().width));
    });

    resizeObserver.observe(element);

    return () => {
      window.cancelAnimationFrame(animationFrame);
      resizeObserver.disconnect();
    };
  }, []);

  return [measureRef, width] as const;
}

function useCurrentDesktopPreviewWidth() {
  const [width, setWidth] = useState(HOMEPAGE_PREVIEW_PROFILES.desktop.viewportWidth);

  useLayoutEffect(() => {
    const minimumDesktopWidth = HOMEPAGE_PREVIEW_PROFILES.tablet.viewportWidth + 1;
    const updateWidth = () => {
      const currentViewportWidth = document.documentElement.clientWidth || window.innerWidth;
      const nextWidth = Math.max(minimumDesktopWidth, Math.round(currentViewportWidth));
      setWidth((currentWidth) => (currentWidth === nextWidth ? currentWidth : nextWidth));
    };

    updateWidth();
    window.addEventListener('resize', updateWidth);

    if (typeof ResizeObserver === 'undefined') {
      return () => window.removeEventListener('resize', updateWidth);
    }

    const resizeObserver = new ResizeObserver(updateWidth);
    resizeObserver.observe(document.documentElement);

    return () => {
      window.removeEventListener('resize', updateWidth);
      resizeObserver.disconnect();
    };
  }, []);

  return width;
}

function formatZoomLabel(scale: number) {
  const scaleNumberLabel = scale === 1 ? '1' : scale.toFixed(2).replace('.', ',');
  return `${scaleNumberLabel}x zoom`;
}

type HomepagePreviewStorefrontStyle = CSSProperties & Record<`--${string}`, string | number>;

function createHomepagePreviewHeroStorefrontStyle(
  globalStyle: GlobalStyleConfig,
  device: HomepagePreviewDevice
): HomepagePreviewStorefrontStyle {
  const variables = toGlobalStyleCssVariables(globalStyle, toCommercialStorefrontLogicalPx(1));
  const gutter = device === 'mobile'
    ? variables['--site-gutter-mobile']
    : device === 'tablet'
      ? variables['--site-gutter-tablet']
      : variables['--site-gutter-desktop'];
  const sectionSpacing = device === 'mobile'
    ? variables['--site-section-space-mobile']
    : device === 'tablet'
      ? variables['--site-section-space-tablet']
      : variables['--site-section-space-desktop'];

  return {
    ...variables,
    '--site-content-max-width': variables['--site-global-max-width'],
    '--site-gutter-min': variables['--site-gutter-mobile'],
    '--site-gutter-max': variables['--site-gutter-desktop'],
    '--site-gutter': gutter,
    '--site-section-space-current': sectionSpacing,
    '--site-admin-content-lane-start': '128px',
    '--site-admin-content-lane-end': '37.3333px',
    '--site-admin-content-lane-shift': '45.3333px',
    minHeight: 0
  };
}

type PreviewViewportGeometry = {
  logicalWidth: number;
  renderedWidth: number;
};

type HomepagePreviewFluidMetrics = {
  headerInnerHeightPx: number;
  headerShellHeightPx: number;
  heroHeightPx: number;
  heroOverlayStrength: number;
  heroMediaWidthPercent: number;
  heroContentOffsetXPx: number;
  heroContentOffsetYPx: number;
  heroTextWidthPx: number;
  heroContentPaddingBlockPx: number;
  titleOffsetXPx: number;
  titleOffsetYPx: number;
  titleFontSizePx: number;
  titleLineHeight: number;
  titleLetterSpacingPx: number;
  titleFontWeight: number;
  descriptionOffsetXPx: number;
  descriptionOffsetYPx: number;
  descriptionFontSizePx: number;
  descriptionLineHeight: number;
  descriptionLetterSpacingPx: number;
  descriptionFontWeight: number;
  descriptionGapPx: number;
  actionsGapTopPx: number;
  actionsGapInlinePx: number;
  primaryButtonOffsetXPx: number;
  primaryButtonOffsetYPx: number;
  secondaryButtonOffsetXPx: number;
  secondaryButtonOffsetYPx: number;
};

type HomepagePreviewFluidEndpoints = Record<HomepagePreviewDevice, HomepagePreviewFluidMetrics>;

const previewFluidCssProperties: ReadonlyArray<[
  keyof HomepagePreviewFluidMetrics,
  `--preview-${string}`,
  '' | 'px' | '%'
]> = [
  ['headerInnerHeightPx', '--preview-header-inner-height', 'px'],
  ['headerShellHeightPx', '--preview-header-shell-height', 'px'],
  ['heroHeightPx', '--preview-hero-height', 'px'],
  ['heroOverlayStrength', '--preview-hero-overlay-strength', ''],
  ['heroMediaWidthPercent', '--preview-hero-media-width', '%'],
  ['heroContentOffsetXPx', '--preview-hero-content-x', 'px'],
  ['heroContentOffsetYPx', '--preview-hero-content-y', 'px'],
  ['heroTextWidthPx', '--preview-hero-text-width', 'px'],
  ['heroContentPaddingBlockPx', '--preview-hero-content-padding-block', 'px'],
  ['titleOffsetXPx', '--preview-title-offset-x', 'px'],
  ['titleOffsetYPx', '--preview-title-offset-y', 'px'],
  ['titleFontSizePx', '--preview-title-size', 'px'],
  ['titleLineHeight', '--preview-title-line-height', ''],
  ['titleLetterSpacingPx', '--preview-title-letter-spacing', 'px'],
  ['titleFontWeight', '--preview-title-weight', ''],
  ['descriptionOffsetXPx', '--preview-description-offset-x', 'px'],
  ['descriptionOffsetYPx', '--preview-description-offset-y', 'px'],
  ['descriptionFontSizePx', '--preview-description-size', 'px'],
  ['descriptionLineHeight', '--preview-description-line-height', ''],
  ['descriptionLetterSpacingPx', '--preview-description-letter-spacing', 'px'],
  ['descriptionFontWeight', '--preview-description-weight', ''],
  ['descriptionGapPx', '--preview-description-gap', 'px'],
  ['actionsGapTopPx', '--preview-actions-gap-top', 'px'],
  ['actionsGapInlinePx', '--preview-actions-gap-inline', 'px'],
  ['primaryButtonOffsetXPx', '--preview-primary-button-offset-x', 'px'],
  ['primaryButtonOffsetYPx', '--preview-primary-button-offset-y', 'px'],
  ['secondaryButtonOffsetXPx', '--preview-secondary-button-offset-x', 'px'],
  ['secondaryButtonOffsetYPx', '--preview-secondary-button-offset-y', 'px']
];

function getPreviewFluidLayerMetrics(
  settings: HomepageSettings,
  elementId: string,
  device: HomepagePreviewDevice
) {
  const configured = Boolean(settings.canvas.elements[elementId]);
  return configured
    ? resolveHomepageCanvasElementDeviceSettings(settings, elementId, device)
    : null;
}

function createHomepagePreviewFluidEndpoints(
  settings: HomepageSettings,
  navigation: SiteNavigationConfig
): HomepagePreviewFluidEndpoints {
  const normalizedSettings = normalizeLandingPageConfig(settings);
  const normalizedNavigation = normalizeSiteNavigationConfig(navigation);

  return Object.fromEntries(HOMEPAGE_PREVIEW_DEVICES.map((device) => {
    const hero = normalizedSettings.hero.responsive[device];
    const titleLayer = getPreviewFluidLayerMetrics(normalizedSettings, 'hero:title', device);
    const descriptionLayer = getPreviewFluidLayerMetrics(normalizedSettings, 'hero:description', device);
    const headerInnerHeightPx = normalizedNavigation.topBarLayout.responsive[device].settings.height;

    return [device, {
      headerInnerHeightPx,
      headerShellHeightPx: headerInnerHeightPx * COMMERCIAL_STOREFRONT_SCALE,
      heroHeightPx: hero.heightPx,
      heroOverlayStrength: normalizedSettings.hero.darkenBackground ? hero.overlayStrength / 100 : 0,
      heroMediaWidthPercent: hero.mediaWidthPercent,
      heroContentOffsetXPx: hero.contentOffsetXPx,
      heroContentOffsetYPx: hero.contentOffsetYPx,
      heroTextWidthPx: hero.textWidthPx,
      heroContentPaddingBlockPx: 64,
      titleOffsetXPx: hero.titleOffsetXPx,
      titleOffsetYPx: hero.titleOffsetYPx,
      titleFontSizePx: titleLayer?.fontSizePx ?? hero.titleFontSizePx,
      titleLineHeight: titleLayer?.lineHeight ?? 1.08,
      titleLetterSpacingPx: titleLayer?.letterSpacingPx ?? 0,
      titleFontWeight: titleLayer?.fontWeight ?? (hero.titleBold ? 800 : 600),
      descriptionOffsetXPx: hero.descriptionOffsetXPx,
      descriptionOffsetYPx: hero.descriptionOffsetYPx,
      descriptionFontSizePx: descriptionLayer?.fontSizePx ?? hero.descriptionFontSizePx,
      descriptionLineHeight: descriptionLayer?.lineHeight ?? 1.65,
      descriptionLetterSpacingPx: descriptionLayer?.letterSpacingPx ?? 0,
      descriptionFontWeight: descriptionLayer?.fontWeight ?? (hero.descriptionBold ? 700 : 400),
      descriptionGapPx: 20,
      actionsGapTopPx: 32,
      actionsGapInlinePx: 12,
      primaryButtonOffsetXPx: hero.primaryButtonOffsetXPx,
      primaryButtonOffsetYPx: hero.primaryButtonOffsetYPx,
      secondaryButtonOffsetXPx: hero.secondaryButtonOffsetXPx,
      secondaryButtonOffsetYPx: hero.secondaryButtonOffsetYPx
    } satisfies HomepagePreviewFluidMetrics];
  })) as HomepagePreviewFluidEndpoints;
}

function getHomepagePreviewFluidSegment(
  logicalWidth: number,
  desktopViewportWidth = HOMEPAGE_PREVIEW_PROFILES.desktop.viewportWidth
) {
  const mobileWidth = HOMEPAGE_PREVIEW_PROFILES.mobile.viewportWidth;
  const tabletWidth = HOMEPAGE_PREVIEW_PROFILES.tablet.viewportWidth;
  const desktopWidth = Math.max(tabletWidth + 1, desktopViewportWidth);
  const from = logicalWidth <= tabletWidth ? 'mobile' : 'tablet';
  const to = logicalWidth <= tabletWidth ? 'tablet' : 'desktop';
  const startWidth = from === 'mobile' ? mobileWidth : tabletWidth;
  const endWidth = to === 'tablet' ? tabletWidth : desktopWidth;
  const progress = Math.min(1, Math.max(0, (logicalWidth - startWidth) / (endWidth - startWidth)));

  return { from, to, progress } as const;
}

function interpolateHomepagePreviewFluidMetrics(
  endpoints: HomepagePreviewFluidEndpoints,
  geometry: PreviewViewportGeometry,
  availableWidth: number,
  desktopViewportWidth: number
): HomepagePreviewFluidMetrics {
  const { from, to, progress } = getHomepagePreviewFluidSegment(
    geometry.logicalWidth,
    desktopViewportWidth
  );
  const fromMetrics = endpoints[from];
  const toMetrics = endpoints[to];
  const metrics = Object.fromEntries(
    previewFluidCssProperties.map(([key]) => [
      key,
      lerpPreviewWidth(fromMetrics[key], toMetrics[key], progress)
    ])
  ) as HomepagePreviewFluidMetrics;

  // The preview is often scaled on Desktop but not on Tablet/Mobile. Interpolate
  // the perceived endpoint sizes, then derive their logical sizes from the one
  // authoritative geometry scale. This prevents the old grow-then-contract spike.
  const currentScale = geometry.logicalWidth > 0 && geometry.renderedWidth > 0
    ? geometry.renderedWidth / geometry.logicalWidth
    : 1;
  const endpointScale = (device: HomepagePreviewDevice) => {
    const width = device === 'desktop'
      ? desktopViewportWidth
      : HOMEPAGE_PREVIEW_PROFILES[device].viewportWidth;
    return availableWidth > 0 ? Math.min(width, availableWidth) / width : 1;
  };
  const interpolateRenderedSize = (key: 'titleFontSizePx' | 'descriptionFontSizePx') =>
    lerpPreviewWidth(
      fromMetrics[key] * endpointScale(from),
      toMetrics[key] * endpointScale(to),
      progress
    );

  metrics.titleFontSizePx = interpolateRenderedSize('titleFontSizePx') / currentScale;
  metrics.descriptionFontSizePx = interpolateRenderedSize('descriptionFontSizePx') / currentScale;
  return metrics;
}

type PreviewViewportTransitionPhase = 'idle' | 'animating';

type PreviewFluidFontTransition = {
  startTitleRenderedSizePx: number;
  targetTitleRenderedSizePx: number;
  startDescriptionRenderedSizePx: number;
  targetDescriptionRenderedSizePx: number;
};

function getPreviewViewportGeometry(
  device: HomepagePreviewDevice,
  availableWidth: number,
  desktopViewportWidth = HOMEPAGE_PREVIEW_PROFILES.desktop.viewportWidth
): PreviewViewportGeometry {
  const logicalWidth = device === 'desktop'
    ? desktopViewportWidth
    : HOMEPAGE_PREVIEW_PROFILES[device].viewportWidth;
  return {
    logicalWidth,
    renderedWidth: availableWidth > 0 ? Math.min(logicalWidth, availableWidth) : 0
  };
}

function preserveAdjacentPreviewMode(
  currentMode: HomepagePreviewDevice,
  candidateGeometry: PreviewViewportGeometry,
  startGeometry: PreviewViewportGeometry,
  targetGeometry: PreviewViewportGeometry
) {
  const adjacentStep = preserveAdjacentAppearancePreviewDevice({
    currentDevice: currentMode,
    candidateGeometry,
    startGeometry,
    targetGeometry,
    orderedDevices: HOMEPAGE_PREVIEW_DEVICES,
    resolveDevice: getHomepagePreviewDeviceForViewport
  });
  return {
    geometry: adjacentStep.geometry,
    mode: adjacentStep.device,
    progress: adjacentStep.transitionProgress,
    heldIntermediateMode: adjacentStep.heldIntermediateDevice
  } as const;
}

function useLiveResponsivePreviewViewport({
  selectedViewport,
  availableWidth,
  desktopViewportWidth,
  prefersReducedMotion,
  fluidEndpoints,
  stageRef,
  frameRef,
  liveLayerRef,
  viewportRef,
  contentSizerRef,
  scrollRegionRef,
  statusLabelRef
}: {
  selectedViewport: HomepagePreviewDevice;
  availableWidth: number;
  desktopViewportWidth: number;
  prefersReducedMotion: boolean;
  fluidEndpoints: HomepagePreviewFluidEndpoints;
  stageRef: RefObject<HTMLDivElement | null>;
  frameRef: RefObject<HTMLDivElement | null>;
  liveLayerRef: RefObject<HTMLDivElement | null>;
  viewportRef: RefObject<HTMLDivElement | null>;
  contentSizerRef: RefObject<HTMLDivElement | null>;
  scrollRegionRef: RefObject<HTMLDivElement | null>;
  statusLabelRef: RefObject<HTMLSpanElement | null>;
}) {
  const initialGeometry = getPreviewViewportGeometry(
    selectedViewport,
    availableWidth,
    desktopViewportWidth
  );
  const [responsiveMode, setResponsiveMode] = useState<HomepagePreviewDevice>(() =>
    getHomepagePreviewDeviceForViewport(initialGeometry.logicalWidth)
  );
  const [, setRenderRevision] = useState(0);
  const responsiveModeRef = useRef(responsiveMode);
  const geometryRef = useRef(initialGeometry);
  const initializedRef = useRef(false);
  const animationFrameRef = useRef<number | null>(null);
  const transitionTokenRef = useRef(0);
  const transitionPhaseRef = useRef<PreviewViewportTransitionPhase>('idle');
  const lastFluidMetricsRef = useRef<HomepagePreviewFluidMetrics | null>(null);
  const fluidFontTransitionRef = useRef<PreviewFluidFontTransition | null>(null);

  const syncContentSizerHeight = useCallback((geometry: PreviewViewportGeometry, mode: HomepagePreviewDevice) => {
    const viewport = viewportRef.current;
    const contentSizer = contentSizerRef.current;
    if (!viewport || !contentSizer) return;

    const scrollRegion = scrollRegionRef.current;
    const scrollTop = scrollRegion?.scrollTop ?? 0;
    const scale = geometry.logicalWidth > 0 ? geometry.renderedWidth / geometry.logicalWidth : 1;
    const logicalHeight = Math.max(
      viewport.scrollHeight,
      HOMEPAGE_PREVIEW_PROFILES[mode].fallbackHeight
    );
    const scrollPreservingHeight = scrollRegion ? scrollTop + scrollRegion.clientHeight : 0;
    contentSizer.style.height = `${Math.max(Math.ceil(logicalHeight * scale), scrollPreservingHeight)}px`;
    if (scrollRegion && scrollRegion.scrollTop !== scrollTop) scrollRegion.scrollTop = scrollTop;
  }, [contentSizerRef, scrollRegionRef, viewportRef]);

  const applyGeometry = useCallback((
    geometry: PreviewViewportGeometry,
    mode: HomepagePreviewDevice,
    phase: PreviewViewportTransitionPhase,
    targetViewport: HomepagePreviewDevice,
    transitionProgress?: number
  ) => {
    geometryRef.current = geometry;
    transitionPhaseRef.current = phase;
    const scale = geometry.logicalWidth > 0 && geometry.renderedWidth > 0
      ? geometry.renderedWidth / geometry.logicalWidth
      : 1;
    const frame = frameRef.current;
    const viewport = viewportRef.current;
    const liveLayer = liveLayerRef.current;
    const fluidMetrics = phase === 'idle'
      ? { ...fluidEndpoints[mode] }
      : interpolateHomepagePreviewFluidMetrics(
          fluidEndpoints,
          geometry,
          availableWidth,
          desktopViewportWidth
        );
    const fontTransition = fluidFontTransitionRef.current;
    if (phase === 'animating' && fontTransition && transitionProgress !== undefined) {
      fluidMetrics.titleFontSizePx = lerpPreviewWidth(
        fontTransition.startTitleRenderedSizePx,
        fontTransition.targetTitleRenderedSizePx,
        transitionProgress
      ) / scale;
      fluidMetrics.descriptionFontSizePx = lerpPreviewWidth(
        fontTransition.startDescriptionRenderedSizePx,
        fontTransition.targetDescriptionRenderedSizePx,
        transitionProgress
      ) / scale;
    }
    lastFluidMetricsRef.current = fluidMetrics;

    if (frame) {
      frame.style.width = `${geometry.renderedWidth}px`;
      frame.style.willChange = phase === 'animating' ? 'width' : 'auto';
    }
    if (viewport) {
      viewport.style.width = `${geometry.logicalWidth}px`;
      viewport.style.transform = `scale(${scale})`;
      viewport.style.transformOrigin = 'top left';
      viewport.style.willChange = phase === 'animating' ? 'width, transform' : 'auto';
      for (const [key, property, unit] of previewFluidCssProperties) {
        viewport.style.setProperty(property, `${fluidMetrics[key]}${unit}`);
      }
    }
    if (liveLayer) {
      liveLayer.style.opacity = '1';
      liveLayer.style.pointerEvents = phase === 'animating' ? 'none' : 'auto';
      liveLayer.dataset.previewInteractive = phase === 'animating' ? 'false' : 'true';
    }

    syncContentSizerHeight(geometry, mode);

    const transitionDuration = phase === 'animating' ? previewViewportTransitionDurationMs : 0;
    const attributeTargets = [stageRef.current, frame, liveLayer, viewport].filter(
      (element): element is HTMLDivElement => Boolean(element)
    );
    for (const element of attributeTargets) {
      element.dataset.previewSelectedViewport = targetViewport;
      element.dataset.previewSelectedDevice = targetViewport;
      element.dataset.previewTargetDevice = targetViewport;
      element.dataset.previewRenderDevice = mode;
      element.dataset.previewResponsiveMode = mode;
      element.dataset.previewLogicalWidth = geometry.logicalWidth.toFixed(3);
      element.dataset.previewRenderedWidth = geometry.renderedWidth.toFixed(3);
      element.dataset.previewScale = scale.toFixed(6);
      element.dataset.previewTransitioning = phase === 'animating' ? 'true' : 'false';
      element.dataset.previewTransitionPhase = phase;
      element.dataset.previewLayoutCovered = 'false';
      element.dataset.previewOpacityTarget = '1.000';
      element.dataset.previewTransitionDurationMs = transitionDuration.toString();
      element.dataset.previewTransitionEasing = previewFrameTransitionEasing;
      element.dataset.previewReducedMotion = prefersReducedMotion ? 'true' : 'false';
      element.dataset.previewReady = availableWidth > 0 ? 'true' : 'false';
      element.dataset.previewFluidTitleSize = fluidMetrics.titleFontSizePx.toFixed(3);
      element.dataset.previewFluidTitleRenderedSize = (fluidMetrics.titleFontSizePx * scale).toFixed(3);
      element.dataset.previewFluidHeaderHeight = fluidMetrics.headerShellHeightPx.toFixed(3);
      element.dataset.previewFluidHeroHeight = fluidMetrics.heroHeightPx.toFixed(3);
    }

    if (statusLabelRef.current) {
      statusLabelRef.current.textContent = `${homepagePreviewDeviceLabels[mode]} · viewport: ${Math.round(geometry.logicalWidth)} px · ${formatZoomLabel(scale)}`;
    }
  }, [availableWidth, desktopViewportWidth, fluidEndpoints, frameRef, liveLayerRef, prefersReducedMotion, stageRef, statusLabelRef, syncContentSizerHeight, viewportRef]);

  useLayoutEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport || typeof ResizeObserver === 'undefined') return undefined;

    const resizeObserver = new ResizeObserver(() => {
      if (transitionPhaseRef.current === 'animating') return;
      syncContentSizerHeight(geometryRef.current, responsiveModeRef.current);
    });
    resizeObserver.observe(viewport);
    return () => resizeObserver.disconnect();
  }, [syncContentSizerHeight, viewportRef]);

  useLayoutEffect(() => {
    if (availableWidth <= 0) return undefined;

    transitionTokenRef.current += 1;
    const token = transitionTokenRef.current;
    if (animationFrameRef.current !== null) {
      window.cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    const targetGeometry = getPreviewViewportGeometry(
      selectedViewport,
      availableWidth,
      desktopViewportWidth
    );
    const targetMode = getHomepagePreviewDeviceForViewport(targetGeometry.logicalWidth);
    const commitImmediately = !initializedRef.current || prefersReducedMotion;
    initializedRef.current = true;

    if (commitImmediately) {
      fluidFontTransitionRef.current = null;
      geometryRef.current = targetGeometry;
      responsiveModeRef.current = targetMode;
      transitionPhaseRef.current = 'idle';
      applyGeometry(targetGeometry, targetMode, 'idle', selectedViewport);
      setResponsiveMode(targetMode);
      setRenderRevision((revision) => revision + 1);
      return undefined;
    }

    const startGeometry = geometryRef.current;
    const alreadySettled =
      Math.abs(startGeometry.logicalWidth - targetGeometry.logicalWidth) <= 0.01
      && Math.abs(startGeometry.renderedWidth - targetGeometry.renderedWidth) <= 0.01;
    if (alreadySettled) {
      fluidFontTransitionRef.current = null;
      applyGeometry(targetGeometry, targetMode, 'idle', selectedViewport);
      return undefined;
    }

    transitionPhaseRef.current = 'animating';
    const startScale = startGeometry.logicalWidth > 0 && startGeometry.renderedWidth > 0
      ? startGeometry.renderedWidth / startGeometry.logicalWidth
      : 1;
    const targetScale = targetGeometry.logicalWidth > 0 && targetGeometry.renderedWidth > 0
      ? targetGeometry.renderedWidth / targetGeometry.logicalWidth
      : 1;
    const startFluidMetrics = lastFluidMetricsRef.current
      ?? { ...fluidEndpoints[responsiveModeRef.current] };
    const targetFluidMetrics = { ...fluidEndpoints[targetMode] };
    fluidFontTransitionRef.current = {
      startTitleRenderedSizePx: startFluidMetrics.titleFontSizePx * startScale,
      targetTitleRenderedSizePx: targetFluidMetrics.titleFontSizePx * targetScale,
      startDescriptionRenderedSizePx: startFluidMetrics.descriptionFontSizePx * startScale,
      targetDescriptionRenderedSizePx: targetFluidMetrics.descriptionFontSizePx * targetScale
    };
    applyGeometry(startGeometry, responsiveModeRef.current, 'animating', selectedViewport, 0);
    const startTime = performance.now();

    const animateFrame = (timestamp: number) => {
      if (token !== transitionTokenRef.current) return;

      const progress = Math.min(1, Math.max(0, (timestamp - startTime) / previewViewportTransitionDurationMs));
      const easedProgress = easePreviewViewportProgress(progress);
      const candidateGeometry = {
        logicalWidth: roundPreviewWidth(
          lerpPreviewWidth(startGeometry.logicalWidth, targetGeometry.logicalWidth, easedProgress)
        ),
        renderedWidth: roundPreviewWidth(
          lerpPreviewWidth(startGeometry.renderedWidth, targetGeometry.renderedWidth, easedProgress)
        )
      };
      const adjacentStep = preserveAdjacentPreviewMode(
        responsiveModeRef.current,
        candidateGeometry,
        startGeometry,
        targetGeometry
      );
      const nextGeometry = adjacentStep.geometry;
      const appliedProgress = adjacentStep.progress ?? easedProgress;
      geometryRef.current = nextGeometry;
      const nextMode = adjacentStep.mode;

      if (nextMode !== responsiveModeRef.current) {
        responsiveModeRef.current = nextMode;
        flushSync(() => setResponsiveMode(nextMode));
      }
      applyGeometry(nextGeometry, nextMode, 'animating', selectedViewport, appliedProgress);

      if (progress < 1 || adjacentStep.heldIntermediateMode) {
        animationFrameRef.current = window.requestAnimationFrame(animateFrame);
        return;
      }

      animationFrameRef.current = null;
      transitionPhaseRef.current = 'idle';
      fluidFontTransitionRef.current = null;
      geometryRef.current = targetGeometry;
      responsiveModeRef.current = targetMode;
      flushSync(() => {
        setResponsiveMode(targetMode);
        setRenderRevision((revision) => revision + 1);
      });
      applyGeometry(targetGeometry, targetMode, 'idle', selectedViewport);
    };

    animationFrameRef.current = window.requestAnimationFrame(animateFrame);
    return () => {
      if (token !== transitionTokenRef.current) return;
      transitionTokenRef.current += 1;
      if (animationFrameRef.current !== null) {
        window.cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
    };
  }, [applyGeometry, availableWidth, desktopViewportWidth, fluidEndpoints, prefersReducedMotion, selectedViewport]);

  useEffect(() => () => {
    transitionTokenRef.current += 1;
    if (animationFrameRef.current !== null) {
      window.cancelAnimationFrame(animationFrameRef.current);
    }
  }, []);

  return {
    responsiveMode,
    geometry: geometryRef.current,
    phase: transitionPhaseRef.current,
    transitionDurationMs: transitionPhaseRef.current === 'animating' ? previewViewportTransitionDurationMs : 0
  };
}

function withPositions<T>(items: T[]) {
  return [...items];
}

function SelectControl<Value extends string>({
  value,
  options,
  onChange,
  ariaLabel
}: {
  value: Value;
  options: Array<Option<Value>>;
  onChange: (value: Value) => void;
  ariaLabel: string;
}) {
  return (
    <AppearanceEditorCompactSelect
      value={value}
      tone="dark"
      options={options}
      onValueChange={onChange}
      ariaLabel={ariaLabel}
      marker={`homepage-${ariaLabel}`}
    />
  );
}

function SelectField<Value extends string>({
  label,
  value,
  options,
  onChange
}: {
  label: string;
  value: Value;
  options: Array<Option<Value>>;
  onChange: (value: Value) => void;
}) {
  return (
    <div className={inspectorFieldRowClassName} data-homepage-compact-setting={label}>
      <span className={labelClassName}>{label}</span>
      <SelectControl value={value} options={options} onChange={onChange} ariaLabel={label} />
    </div>
  );
}

function TextField({
  label,
  value,
  onChange,
  placeholder,
  type = 'text'
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <label className={inspectorFieldRowClassName}>
      <span className={labelClassName}>{label}</span>
      <Input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={inputClassName}
        placeholder={placeholder}
      />
    </label>
  );
}

function TextareaField({
  label,
  value,
  onChange,
  placeholder
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="grid min-w-0 gap-1 py-0.5">
      <span className={labelClassName}>{label}</span>
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={textareaClassName}
        placeholder={placeholder}
      />
    </label>
  );
}

function NumberField({
  label,
  value,
  onChange,
  min,
  max,
  step = 1,
  suffix,
  inputAriaLabel
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  suffix?: string;
  inputAriaLabel?: string;
}) {
  return (
    <label className={inspectorFieldRowClassName}>
      <span className={labelClassName}>{label}</span>
      <span className={`flex h-7 min-w-0 overflow-hidden rounded-md border border-[color:var(--homepage-inspector-input-border,#e2e8f0)] bg-[color:var(--homepage-inspector-input-bg,#f8fafc)] transition hover:border-[color:var(--homepage-inspector-input-border-hover,#cbd5e1)] hover:bg-[color:var(--homepage-inspector-input-hover,#ffffff)] focus-within:bg-[color:var(--homepage-inspector-input-focus,#ffffff)] ${adminControlFocusWithinTokenClasses}`}>
        <AppearanceEditorNumberInput
          value={value}
          min={min}
          max={max}
          step={step}
          aria-label={inputAriaLabel}
          onValueChange={onChange}
          className={`h-full min-w-0 flex-1 appearance-none border-0 bg-transparent px-2 text-[11px] text-[color:var(--homepage-inspector-input-text,#1e293b)] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none ${adminInputFocusTokenClasses}`}
        />
        {suffix ? (
          <span className="grid min-w-7 place-items-center px-1.5 text-[10px] font-medium text-[color:var(--homepage-inspector-input-muted,#94a3b8)]">
            {suffix}
          </span>
        ) : null}
      </span>
    </label>
  );
}

function ColorField({
  label,
  value,
  onChange
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <CompactHexColorField
      label={label}
      value={value}
      marker={`homepage-${label}`}
      tone="light"
      onChange={onChange}
      inputAttributes={{ 'aria-label': label }}
      className="min-w-0"
    />
  );
}

function ToggleRow({
  label,
  description,
  checked,
  onChange
}: {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="group flex min-h-8 min-w-0 cursor-pointer items-center justify-between gap-2 rounded-md px-1.5 py-1 transition hover:bg-[color:var(--homepage-inspector-hover,#f8fafc)]">
      <span className="grid min-w-0 flex-1 gap-0.5">
        <span className="text-[11px] font-medium text-[color:var(--homepage-inspector-strong,#1e293b)]">{label}</span>
        {description ? <span className="text-[10px] leading-3.5 text-[color:var(--homepage-inspector-muted,#64748b)]">{description}</span> : null}
      </span>
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} className="peer sr-only" />
      <span className="relative h-5 w-8 shrink-0 rounded-full border border-transparent bg-[color:var(--homepage-inspector-toggle-bg,#e2e8f0)] transition peer-checked:bg-[color:var(--blue-500)] peer-focus-visible:border-[color:var(--blue-500)]" aria-hidden="true">
        <span className={classNames('absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-transform', checked && 'translate-x-3')} />
      </span>
    </label>
  );
}

function FieldBlock({
  title,
  children,
  defaultOpen = true
}: {
  title: string;
  children: ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);

  useEffect(() => {
    setOpen(defaultOpen);
  }, [defaultOpen, title]);

  return (
    <section className="min-w-0 border-b border-[color:var(--homepage-inspector-divider,#f1f5f9)] pb-1 last:border-b-0 last:pb-0">
      <button
        type="button"
        className={`flex w-full min-w-0 items-center justify-between gap-2 rounded-md border border-transparent px-1.5 py-1.5 text-left transition hover:bg-[color:var(--homepage-inspector-hover,#f8fafc)] ${adminControlFocusTokenClasses}`}
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        <span className="min-w-0 truncate text-[11px] font-semibold text-[color:var(--homepage-inspector-strong,#1e293b)]">{title}</span>
        <ChevronDown className={classNames('h-3.5 w-3.5 shrink-0 text-[color:var(--homepage-inspector-muted,#94a3b8)] transition-transform', !open && '-rotate-90')} />
      </button>
      {open ? (
        <div className="min-w-0 space-y-1.5 px-1.5 pb-1.5 pt-0.5">
          {children}
        </div>
      ) : null}
    </section>
  );
}

function SmallIconButton({
  label,
  title,
  children,
  onClick,
  tone = 'neutral',
  disabled,
  testId
}: {
  label: string;
  title?: string;
  children: ReactNode;
  onClick: () => void;
  tone?: 'neutral' | 'danger';
  disabled?: boolean;
  testId?: string;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={title ?? label}
      onClick={onClick}
      disabled={disabled}
      data-testid={testId}
      className={classNames(
        `grid h-7 w-7 shrink-0 place-items-center rounded-md border border-transparent text-[color:var(--homepage-inspector-muted,#64748b)] transition hover:bg-[color:var(--homepage-inspector-hover,#f1f5f9)] hover:text-[color:var(--homepage-inspector-strong,var(--blue-600))] disabled:cursor-not-allowed disabled:opacity-35 ${adminControlFocusTokenClasses}`,
        tone === 'danger' && 'text-rose-400 hover:bg-rose-500/15 hover:text-rose-300'
      )}
    >
      {children}
    </button>
  );
}

const HomepageToolbarToneContext = createContext<'light' | 'dark'>('light');
const HomepageToolbarPopoverPlacementContext = createContext<'inline' | 'top' | 'bottom'>('inline');

function ToolbarButton({
  label,
  children,
  onClick,
  active = false,
  disabled = false,
  danger = false,
  popover = false,
  pressed,
  testId
}: {
  label: string;
  children: ReactNode;
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  danger?: boolean;
  popover?: boolean;
  pressed?: boolean;
  testId?: string;
}) {
  const tone = useContext(HomepageToolbarToneContext);
  const dark = tone === 'dark';
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      data-testid={testId}
      data-active={active || undefined}
      aria-haspopup={popover ? 'dialog' : undefined}
      aria-expanded={popover ? active : undefined}
      aria-pressed={pressed}
      disabled={disabled}
      onClick={onClick}
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
              : 'bg-transparent text-slate-600 hover:bg-slate-100/80 hover:text-[color:var(--blue-600)]'
      )}
    >
      {children}
    </button>
  );
}

function ToolbarDivider() {
  const tone = useContext(HomepageToolbarToneContext);
  return <span className={classNames('mx-1 h-5 w-px shrink-0', tone === 'dark' ? 'bg-white/20' : 'bg-slate-200')} aria-hidden="true" />;
}

function ToolbarPopoverPanel({
  title,
  description,
  children,
  onClose,
  wide = false
}: {
  title: string;
  description?: string;
  children: ReactNode;
  onClose: () => void;
  wide?: boolean;
}) {
  const toolbarPlacement = useContext(HomepageToolbarPopoverPlacementContext);
  const panelRef = useRef<HTMLDivElement | null>(null);
  // A floating toolbar already sits beside the selected canvas anchor. Open
  // away from that anchor so even a constrained panel can never cover it.
  const preferredSide = toolbarPlacement === 'top' ? 'above' : 'below';
  const [panelLayout, setPanelLayout] = useState<{ side: 'above' | 'below'; maxHeight: number }>({
    side: preferredSide,
    maxHeight: 540
  });

  const updatePanelLayout = useCallback(() => {
    const panel = panelRef.current;
    const toolbar = panel?.parentElement;
    if (!panel || !toolbar || typeof window === 'undefined') return;

    const toolbarRect = toolbar.getBoundingClientRect();
    const visualViewport = window.visualViewport;
    const viewportTop = visualViewport?.offsetTop ?? 0;
    const viewportHeight = visualViewport?.height ?? window.innerHeight;
    const viewportBottom = viewportTop + viewportHeight;
    const viewportMargin = 8;
    const anchorGap = 6;
    const available = {
      above: Math.max(1, toolbarRect.top - viewportTop - viewportMargin - anchorGap),
      below: Math.max(1, viewportBottom - toolbarRect.bottom - viewportMargin - anchorGap)
    };
    const side = preferredSide;
    const maxHeight = Math.min(540, available[side]);

    setPanelLayout((current) => current.side === side && Math.abs(current.maxHeight - maxHeight) < 0.5
      ? current
      : { side, maxHeight });
  }, [preferredSide]);

  useLayoutEffect(() => {
    updatePanelLayout();
    const panel = panelRef.current;
    if (!panel || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(updatePanelLayout);
    const toolbar = panel.parentElement;
    if (toolbar) observer.observe(toolbar);
    observer.observe(panel);
    const body = panel.querySelector<HTMLElement>('[data-testid="homepage-toolbar-popover-body"]');
    if (body) observer.observe(body);
    window.addEventListener('resize', updatePanelLayout);
    window.addEventListener('scroll', updatePanelLayout, true);
    window.visualViewport?.addEventListener('resize', updatePanelLayout);
    window.visualViewport?.addEventListener('scroll', updatePanelLayout);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', updatePanelLayout);
      window.removeEventListener('scroll', updatePanelLayout, true);
      window.visualViewport?.removeEventListener('resize', updatePanelLayout);
      window.visualViewport?.removeEventListener('scroll', updatePanelLayout);
    };
  }, [title, updatePanelLayout, wide]);

  return (
    <div
      ref={panelRef}
      role="dialog"
      aria-label={title}
      data-testid="homepage-toolbar-popover"
      data-homepage-toolbar-popover-surface
      data-homepage-toolbar-popover-size={wide ? 'wide' : 'standard'}
      data-homepage-toolbar-popover-placement={panelLayout.side}
      className={classNames(
        homepageToolbarPopoverSurfaceClassName,
        'absolute left-0 z-[120] flex flex-col overflow-hidden text-left',
        panelLayout.side === 'above' ? 'bottom-[calc(100%+6px)]' : 'top-[calc(100%+6px)]',
        wide ? 'w-[min(440px,calc(100vw-32px))]' : 'w-[min(360px,calc(100vw-32px))]'
      )}
      style={{
        maxHeight: panelLayout.maxHeight,
        '--homepage-inspector-strong': 'rgba(255,255,255,0.92)',
        '--homepage-inspector-muted': 'rgba(255,255,255,0.75)',
        '--homepage-inspector-divider': 'rgba(255,255,255,0.15)',
        '--homepage-inspector-hover': 'rgba(255,255,255,0.1)',
        '--homepage-inspector-input-bg': 'rgba(47,59,72,0.96)',
        '--homepage-inspector-input-hover': 'rgba(54,67,81,0.98)',
        '--homepage-inspector-input-focus': 'rgba(42,53,65,1)',
        '--homepage-inspector-input-border': 'rgba(255,255,255,0.15)',
        '--homepage-inspector-input-border-hover': 'rgba(255,255,255,0.28)',
        '--homepage-inspector-input-text': 'rgba(255,255,255,0.94)',
        '--homepage-inspector-input-placeholder': 'rgba(255,255,255,0.58)',
        '--homepage-inspector-input-muted': 'rgba(255,255,255,0.62)',
        '--homepage-inspector-control-bg': 'rgba(47,59,72,0.78)',
        '--homepage-inspector-subsurface': 'rgba(47,59,72,0.62)',
        '--homepage-inspector-subsurface-strong': 'rgba(47,59,72,0.9)',
        '--homepage-inspector-selected-bg': 'rgba(255,255,255,0.14)',
        '--homepage-inspector-selected-text': 'rgba(255,255,255,0.96)',
        '--homepage-inspector-toggle-bg': 'rgba(30,41,53,0.82)'
      } as CSSProperties}
      onPointerDown={(event) => event.stopPropagation()}
    >
      <div data-testid="homepage-toolbar-popover-header" className="flex shrink-0 items-start justify-between gap-2.5 px-3 pb-1.5 pt-2">
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-[12px] font-semibold leading-4 text-white" title={title}>{title}</h2>
          {description ? <p className="mt-0.5 truncate text-[10px] leading-3.5 text-white/75" title={description}>{description}</p> : null}
        </div>
        <button type="button" aria-label="Zapri" title="Zapri" className={`grid h-6 w-6 shrink-0 place-items-center rounded-md border border-transparent text-white/75 transition hover:bg-white/10 hover:text-white ${adminControlFocusTokenClasses}`} onClick={onClose}>
          <X className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      </div>
      <div data-testid="homepage-toolbar-popover-body" data-appearance-settings-panel="glavna-stran-popover" data-appearance-editor-settings-surface data-homepage-toolbar-popover-scroll-region data-settings-scroll="internal" className="min-h-0 overflow-y-auto overscroll-contain border-t border-white/15 px-2.5 py-2">
        {children}
      </div>
    </div>
  );
}

function PreviewDeviceIcon({ device }: { device: HomepagePreviewDevice }) {
  if (device === 'mobile') {
    return (
      <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
        <rect x="6.5" y="2.5" width="7" height="15" rx="1.5" />
        <path d="M9 15.5h2" />
      </svg>
    );
  }

  if (device === 'tablet') {
    return (
      <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
        <rect x="4.5" y="3" width="11" height="14" rx="1.7" />
        <path d="M9 14.5h2" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
      <rect x="3" y="4" width="14" height="10" rx="1.5" />
      <path d="M8 17h4M10 14v3" />
    </svg>
  );
}

type HomepageToolbarPlacement = 'top' | 'bottom';

type HomepageToolbarPosition = {
  left: number;
  top: number;
  maxWidth: number;
  placement: HomepageToolbarPlacement;
  ready: boolean;
};

const homepageToolbarEdgeGapPx = 8;
const homepageToolbarAnchorGapPx = 8;
const homepageContextToolbarBaseClassName =
  'w-max max-w-full rounded-xl border p-1 backdrop-blur-xl';
const homepageContextToolbarDarkSurfaceClassName =
  `${homepageContextToolbarBaseClassName} bg-black/90 ${homepageDarkGlassFrameClassName}`;
const homepageToolbarNestedPortalSelector =
  '[data-admin-color-palette-portal], [data-appearance-editor-compact-select-portal]';
const homepageCanvasSelectionTargetSelector =
  '[data-homepage-canvas-element], [data-homepage-section], [data-canvas-action], [data-canvas-hidden-flag], [data-canvas-hidden-popover]';
const homepageSelectionPersistentControlSelector =
  '[data-homepage-preview-controls], [data-homepage-page-toolbar], [data-homepage-selection-persistent-control]';

function findHomepageToolbarAnchor(viewport: HTMLElement, selectedElementId: string | null) {
  if (!selectedElementId) return null;
  if (selectedElementId.startsWith('section:')) {
    const sectionId = selectedElementId.slice('section:'.length);
    return Array.from(viewport.querySelectorAll<HTMLElement>('[data-homepage-section]'))
      .find((element) => element.dataset.homepageSection === sectionId) ?? null;
  }

  return Array.from(viewport.querySelectorAll<HTMLElement>('[data-canvas-element-id]'))
    .find((element) => element.dataset.canvasElementId === selectedElementId) ?? null;
}

function FloatingHomepageContextToolbar({
  selectedElementId,
  transitioning,
  frameRef,
  viewportRef,
  scrollRegionRef,
  externalRef,
  onDismiss,
  children
}: {
  selectedElementId: string | null;
  transitioning: boolean;
  frameRef: RefObject<HTMLDivElement | null>;
  viewportRef: RefObject<HTMLDivElement | null>;
  scrollRegionRef: RefObject<HTMLDivElement | null>;
  externalRef: RefObject<HTMLDivElement | null>;
  onDismiss?: () => void;
  children: ReactNode;
}) {
  const toolbarElementRef = useRef<HTMLDivElement | null>(null);
  const scheduledFrameRef = useRef<number | null>(null);
  const onDismissRef = useRef(onDismiss);
  const [portalReady, setPortalReady] = useState(false);
  const [toolbarMounted, setToolbarMounted] = useState(false);
  const [position, setPosition] = useState<HomepageToolbarPosition>({
    left: 0,
    top: 0,
    maxWidth: 0,
    placement: 'bottom',
    ready: false
  });

  const setToolbarElement = useCallback((element: HTMLDivElement | null) => {
    toolbarElementRef.current = element;
    externalRef.current = element;
    if (element) setToolbarMounted(true);
  }, [externalRef]);

  const updatePosition = useCallback(() => {
    const frame = frameRef.current;
    const viewport = viewportRef.current;
    const toolbar = toolbarElementRef.current;
    if (!frame || !viewport || !toolbar) return;

    const frameRect = frame.getBoundingClientRect();
    if (frameRect.width <= 0 || frameRect.height <= 0) return;

    const boundsLeft = Math.max(frameRect.left, homepageToolbarEdgeGapPx);
    const boundsRight = Math.min(frameRect.right, window.innerWidth - homepageToolbarEdgeGapPx);
    const boundsTop = Math.max(frameRect.top, homepageToolbarEdgeGapPx);
    const boundsBottom = Math.min(frameRect.bottom, window.innerHeight - homepageToolbarEdgeGapPx);
    const maxWidth = Math.max(1, boundsRight - boundsLeft - homepageToolbarEdgeGapPx * 2);
    const toolbarWidth = Math.min(Math.max(1, toolbar.scrollWidth), maxWidth);
    const toolbarHeight = Math.max(1, toolbar.getBoundingClientRect().height);
    const anchor = findHomepageToolbarAnchor(viewport, selectedElementId);
    const anchorRect = anchor?.getBoundingClientRect() ?? null;

    if (
      anchorRect
      && (
        anchorRect.right <= frameRect.left
        || anchorRect.left >= frameRect.right
        || anchorRect.bottom <= frameRect.top
        || anchorRect.top >= frameRect.bottom
      )
    ) {
      setPosition((current) => current.ready ? { ...current, ready: false } : current);
      return;
    }

    let placement: HomepageToolbarPlacement = 'bottom';
    let toolbarLeft = frameRect.left + (frameRect.width - toolbarWidth) / 2;
    let toolbarTop = boundsTop + homepageToolbarEdgeGapPx;

    if (anchorRect) {
      const availableAbove = anchorRect.top - frameRect.top;
      const availableBelow = frameRect.bottom - anchorRect.bottom;
      const requiredSpace = toolbarHeight + homepageToolbarAnchorGapPx + homepageToolbarEdgeGapPx;
      placement = availableAbove >= requiredSpace
        ? 'top'
        : availableBelow >= requiredSpace
          ? 'bottom'
          : availableAbove >= availableBelow ? 'top' : 'bottom';
      toolbarLeft = anchorRect.left + (anchorRect.width - toolbarWidth) / 2;
      toolbarTop = placement === 'top'
        ? anchorRect.top - toolbarHeight - homepageToolbarAnchorGapPx
        : anchorRect.bottom + homepageToolbarAnchorGapPx;
    }

    const minimumLeft = boundsLeft + homepageToolbarEdgeGapPx;
    const maximumLeft = boundsRight - toolbarWidth - homepageToolbarEdgeGapPx;
    const minimumTop = boundsTop + homepageToolbarEdgeGapPx;
    const maximumTop = boundsBottom - toolbarHeight - homepageToolbarEdgeGapPx;
    const nextPosition = {
      left: Math.round(Math.min(Math.max(toolbarLeft, minimumLeft), Math.max(minimumLeft, maximumLeft))),
      top: Math.round(Math.min(Math.max(toolbarTop, minimumTop), Math.max(minimumTop, maximumTop))),
      maxWidth: Math.round(maxWidth),
      placement,
      ready: true
    } satisfies HomepageToolbarPosition;

    setPosition((current) => (
      current.left === nextPosition.left
      && current.top === nextPosition.top
      && current.maxWidth === nextPosition.maxWidth
      && current.placement === nextPosition.placement
      && current.ready === nextPosition.ready
        ? current
        : nextPosition
    ));
  }, [frameRef, selectedElementId, viewportRef]);

  const latestUpdatePositionRef = useRef(updatePosition);
  useLayoutEffect(() => {
    latestUpdatePositionRef.current = updatePosition;
  }, [updatePosition]);

  const schedulePosition = useCallback(() => {
    if (scheduledFrameRef.current !== null) return;
    scheduledFrameRef.current = window.requestAnimationFrame(() => {
      scheduledFrameRef.current = null;
      latestUpdatePositionRef.current();
    });
  }, []);

  useLayoutEffect(() => {
    if (!portalReady || !toolbarMounted) return;
    updatePosition();
  }, [children, portalReady, toolbarMounted, updatePosition]);

  useEffect(() => {
    setPortalReady(true);
  }, []);

  useEffect(() => {
    onDismissRef.current = onDismiss;
  }, [onDismiss]);

  useEffect(() => {
    if (!portalReady || !toolbarMounted || !selectedElementId) return undefined;

    const handlePointerDown = (event: PointerEvent) => {
      const viewport = viewportRef.current;
      const toolbar = toolbarElementRef.current;
      if (!viewport || !toolbar) return;

      const path = event.composedPath();
      const target = event.target instanceof Element ? event.target : null;
      const anchor = findHomepageToolbarAnchor(viewport, selectedElementId);
      if (path.includes(toolbar) || Boolean(anchor && path.includes(anchor))) return;
      if (target?.closest(homepageToolbarNestedPortalSelector)) return;
      if (target?.closest(homepageCanvasSelectionTargetSelector)) return;
      if (target?.closest(homepageSelectionPersistentControlSelector)) return;

      onDismissRef.current?.();
    };

    window.addEventListener('pointerdown', handlePointerDown, true);
    return () => window.removeEventListener('pointerdown', handlePointerDown, true);
  }, [portalReady, selectedElementId, toolbarMounted, viewportRef]);

  useEffect(() => {
    const frame = frameRef.current;
    const viewport = viewportRef.current;
    const toolbar = toolbarElementRef.current;
    const scrollRegion = scrollRegionRef.current;
    if (!portalReady || !toolbarMounted || !frame || !viewport || !toolbar || !scrollRegion) return undefined;

    const anchor = findHomepageToolbarAnchor(viewport, selectedElementId);
    const resizeObserver = typeof ResizeObserver === 'undefined'
      ? null
      : new ResizeObserver(schedulePosition);
    resizeObserver?.observe(frame);
    resizeObserver?.observe(viewport);
    resizeObserver?.observe(toolbar);
    if (anchor) resizeObserver?.observe(anchor);

    const mutationObserver = typeof MutationObserver === 'undefined'
      ? null
      : new MutationObserver(schedulePosition);
    mutationObserver?.observe(viewport, {
      attributes: true,
      childList: true,
      subtree: true,
      attributeFilter: ['style', 'class', 'data-canvas-element-selected']
    });

    scrollRegion.addEventListener('scroll', schedulePosition, { passive: true });
    viewport.addEventListener('pointermove', schedulePosition, { passive: true });
    window.addEventListener('resize', schedulePosition);
    window.addEventListener('scroll', schedulePosition, true);
    window.visualViewport?.addEventListener('resize', schedulePosition);
    window.visualViewport?.addEventListener('scroll', schedulePosition);
    schedulePosition();

    return () => {
      resizeObserver?.disconnect();
      mutationObserver?.disconnect();
      scrollRegion.removeEventListener('scroll', schedulePosition);
      viewport.removeEventListener('pointermove', schedulePosition);
      window.removeEventListener('resize', schedulePosition);
      window.removeEventListener('scroll', schedulePosition, true);
      window.visualViewport?.removeEventListener('resize', schedulePosition);
      window.visualViewport?.removeEventListener('scroll', schedulePosition);
    };
  }, [frameRef, portalReady, schedulePosition, scrollRegionRef, selectedElementId, toolbarMounted, viewportRef]);

  useEffect(() => {
    if (!portalReady || !toolbarMounted || position.ready) return undefined;

    let attempts = 0;
    let retryTimer = 0;
    const retryUntilMeasured = () => {
      updatePosition();
      attempts += 1;
      if (attempts < 40) retryTimer = window.setTimeout(retryUntilMeasured, 50);
    };
    retryUntilMeasured();

    return () => window.clearTimeout(retryTimer);
  }, [portalReady, position.ready, toolbarMounted, updatePosition]);

  useEffect(() => {
    if (!portalReady || !toolbarMounted) return undefined;
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
  }, [portalReady, schedulePosition, toolbarMounted, transitioning, updatePosition]);

  useEffect(() => () => {
    if (scheduledFrameRef.current !== null) {
      window.cancelAnimationFrame(scheduledFrameRef.current);
      scheduledFrameRef.current = null;
    }
  }, []);

  if (!portalReady || typeof document === 'undefined') return null;

  return createPortal(
    <div
      ref={setToolbarElement}
      data-testid="homepage-context-toolbar"
      data-selected-element-id={selectedElementId ?? ''}
      data-homepage-toolbar-anchor-id={selectedElementId ?? 'page'}
      data-toolbar-placement={position.placement}
      data-toolbar-ready={position.ready ? 'true' : 'false'}
      data-toolbar-mode="floating"
      role="toolbar"
      aria-label="Orodna vrstica predogleda"
      className={`${homepageContextToolbarDarkSurfaceClassName} fixed z-[200] transition-[opacity,box-shadow] duration-150`}
      style={{
        left: position.left,
        top: position.top,
        maxWidth: position.maxWidth > 0 ? position.maxWidth : undefined,
        opacity: position.ready ? 1 : 0,
        visibility: position.ready ? 'visible' : 'hidden',
        pointerEvents: position.ready ? 'auto' : 'none'
      }}
    >
      <HomepageToolbarPopoverPlacementContext.Provider value={position.placement}>
        {children}
      </HomepageToolbarPopoverPlacementContext.Provider>
    </div>,
    document.body
  );
}

function ScaledHomepagePreview({
  selectedViewport,
  settings,
  categories,
  navigation,
  globalStyle,
  selectedSectionId,
  selectedElementId,
  onSelectSection,
  onSelectElement,
  onHeroTextPositionChange,
  onHeroTextContentChange,
  onHeroTextBlockChange,
  onFooterDescriptionChange,
  onCategoryTextChange,
  onCategoryImageChange,
  onCategoryImageRemove,
  onEditCategoryAppearance,
  onCategoryPresentationChange,
  onCategoryMove,
  onCanvasElementStyleChange,
  onRestoreHiddenElement,
  onMoveSection,
  editorOptionsByDevice,
  contextToolbar,
  contextToolbarRef
}: {
  selectedViewport: HomepagePreviewDevice;
  settings: HomepageSettings;
  categories: HomepageCategoryCardData[];
  navigation: SiteNavigationConfig;
  globalStyle: GlobalStyleConfig;
  selectedSectionId?: HomepageSectionId;
  selectedElementId: string | null;
  onSelectSection: (sectionId: HomepageSectionId) => void;
  onSelectElement: (elementId: string | null) => void;
  onHeroTextPositionChange: (device: HomepagePreviewDevice, updates: HeroPositionUpdates) => void;
  onHeroTextContentChange: (updates: HeroTextContentUpdates) => void;
  onHeroTextBlockChange: (blockId: string, updates: HeroTextBlockUpdates) => void;
  onFooterDescriptionChange: (description: string) => void;
  onCategoryTextChange: (updates: CategoryTextUpdates) => void;
  onCategoryImageChange: (categorySlug: string, file: File) => void;
  onCategoryImageRemove: (categorySlug: string) => void;
  onEditCategoryAppearance: (categorySlug: string) => void;
  onCategoryPresentationChange: (categorySlug: string, updates: Partial<CategoryShowcaseMediaSettings>) => void;
  onCategoryMove: (sourceSlug: string, targetSlug: string) => void;
  onCanvasElementStyleChange: (
    device: HomepagePreviewDevice,
    elementId: string,
    updates: Partial<HomepageCanvasElementDeviceSettings>
  ) => void;
  onRestoreHiddenElement: (elementId: string) => void;
  onMoveSection: (sectionId: HomepageSectionId, direction: -1 | 1) => void;
  editorOptionsByDevice: Record<HomepagePreviewDevice, HomepageCanvasEditorOptions>;
  contextToolbar: ReactNode;
  contextToolbarRef: RefObject<HTMLDivElement | null>;
}) {
  const [measureRef, availableWidth] = useMeasuredElementWidth<HTMLDivElement>();
  const desktopViewportWidth = useCurrentDesktopPreviewWidth();
  const stageRef = useRef<HTMLDivElement | null>(null);
  const frameRef = useRef<HTMLDivElement | null>(null);
  const liveLayerRef = useRef<HTMLDivElement | null>(null);
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const contentSizerRef = useRef<HTMLDivElement | null>(null);
  const statusLabelRef = useRef<HTMLSpanElement | null>(null);
  const scrollRegionRef = useRef<HTMLDivElement | null>(null);
  const prefersReducedMotion = usePrefersReducedMotion();
  const fluidEndpoints = useMemo(
    () => createHomepagePreviewFluidEndpoints(settings, navigation),
    [navigation, settings]
  );
  const viewportTransition = useLiveResponsivePreviewViewport({
    selectedViewport,
    availableWidth,
    desktopViewportWidth,
    prefersReducedMotion,
    fluidEndpoints,
    stageRef,
    frameRef,
    liveLayerRef,
    viewportRef,
    contentSizerRef,
    scrollRegionRef,
    statusLabelRef
  });
  const setStageElement = useCallback((element: HTMLDivElement | null) => {
    stageRef.current = element;
    measureRef(element);
  }, [measureRef]);
  const viewportWidth = viewportTransition.geometry.logicalWidth;
  const renderedWidth = viewportTransition.geometry.renderedWidth;
  const scale = viewportWidth > 0 && renderedWidth > 0 ? renderedWidth / viewportWidth : 1;
  const renderDevice = viewportTransition.responsiveMode;
  const editorOptions = editorOptionsByDevice[renderDevice];
  const heroPreviewStorefrontStyle = useMemo(
    () => createHomepagePreviewHeroStorefrontStyle(globalStyle, renderDevice),
    [globalStyle, renderDevice]
  );
  const scaledHeight = Math.ceil(HOMEPAGE_PREVIEW_PROFILES[renderDevice].fallbackHeight * scale);
  const zoomLabel = availableWidth > 0 ? formatZoomLabel(scale) : 'prilagajanje širini';
  const isTransitioning = viewportTransition.phase === 'animating';

  const previewStateAttributes = {
    'data-preview-selected-viewport': selectedViewport,
    'data-preview-selected-device': selectedViewport,
    'data-preview-target-device': selectedViewport,
    'data-preview-render-device': renderDevice,
    'data-preview-responsive-mode': renderDevice,
    'data-preview-logical-width': viewportWidth.toFixed(3),
    'data-preview-rendered-width': renderedWidth.toFixed(3),
    'data-preview-scale': scale.toFixed(6),
    'data-preview-transitioning': isTransitioning ? 'true' : 'false',
    'data-preview-transition-phase': viewportTransition.phase,
    'data-preview-layout-covered': 'false',
    'data-preview-opacity-target': '1.000',
    'data-preview-transition-duration-ms': viewportTransition.transitionDurationMs.toString(),
    'data-preview-transition-easing': previewFrameTransitionEasing,
    'data-preview-reduced-motion': prefersReducedMotion ? 'true' : 'false',
    'data-preview-ready': availableWidth > 0 ? 'true' : 'false',
    'data-selected-element-id': selectedElementId ?? '',
    'data-selected-section-id': selectedSectionId ?? ''
  };

  return (
    <div className="w-full min-w-0">
      <div className="mb-2 flex flex-wrap items-center gap-1.5 text-[11px] font-medium text-slate-500">
        <span ref={statusLabelRef}>
          {homepagePreviewDeviceLabels[renderDevice]} · viewport: {Math.round(viewportWidth)} px · {zoomLabel}
        </span>
      </div>
      <div
        ref={setStageElement}
        data-testid="homepage-preview-stage"
        className="relative flex h-[clamp(480px,calc(100dvh-280px),760px)] w-full min-w-0 items-start justify-center overflow-x-clip"
        {...previewStateAttributes}
      >
        <div
          ref={frameRef}
          data-testid="homepage-preview-frame"
          data-homepage-preview-bounds
          className="relative h-full shrink-0 overflow-hidden rounded-xl bg-white shadow-[0_22px_60px_rgba(15,23,42,0.12)]"
          style={{
            width: renderedWidth,
            visibility: availableWidth > 0 ? 'visible' : 'hidden'
          }}
          {...previewStateAttributes}
        >
          <div
            ref={liveLayerRef}
            data-testid="homepage-preview-live-layer"
            data-preview-renderer="interactive"
            data-preview-interactive="true"
            className="absolute inset-0 z-10"
            style={{
              opacity: 1,
              pointerEvents: 'auto'
            }}
          >
            <div
              ref={scrollRegionRef}
              data-testid="homepage-preview-scroll-region"
              className="absolute inset-0 overflow-x-hidden overflow-y-auto overscroll-contain [overflow-anchor:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
              data-appearance-editor-scroll-purpose="preview"
            >
              <div
                ref={contentSizerRef}
                className="relative w-full overflow-x-clip"
                style={{ height: scaledHeight }}
              >
                <div
                  ref={viewportRef}
                  data-testid="homepage-preview-viewport"
                  className="homepage-preview-fluid absolute left-0 top-0 overflow-hidden rounded-xl bg-white"
                  style={{
                    width: viewportWidth,
                    transform: `scale(${scale})`,
                    transformOrigin: 'top left'
                  }}
                  {...previewStateAttributes}
                >
                  <ScaledSiteHeaderPreview navigation={navigation} device={renderDevice} viewportWidth={viewportWidth} />
                  <HomepageRenderer
                    settings={settings}
                    categories={categories}
                    canonicalFooter={navigation.footer}
                    selectedSectionId={selectedElementId?.startsWith('section:') ? selectedSectionId : undefined}
                    editorSectionId={selectedSectionId}
                    selectedElementId={selectedElementId}
                    onSelectSection={onSelectSection}
                    onSelectElement={onSelectElement}
                    onHeroTextPositionChange={(updates) => onHeroTextPositionChange(renderDevice, updates)}
                    onHeroTextContentChange={onHeroTextContentChange}
                    onHeroTextBlockChange={onHeroTextBlockChange}
                    onFooterDescriptionChange={onFooterDescriptionChange}
                    onCategoryTextChange={onCategoryTextChange}
                    onCategoryImageChange={onCategoryImageChange}
                    onCategoryImageRemove={onCategoryImageRemove}
                    onEditCategoryAppearance={onEditCategoryAppearance}
                    onCategoryPresentationChange={onCategoryPresentationChange}
                    onCategoryMove={onCategoryMove}
                    onCanvasElementStyleChange={(elementId, updates) =>
                      onCanvasElementStyleChange(renderDevice, elementId, updates)}
                    onRestoreHiddenElement={onRestoreHiddenElement}
                    onMoveSection={onMoveSection}
                    editorOptions={editorOptions}
                    previewDevice={renderDevice}
                    previewViewportWidth={viewportWidth}
                    previewHeroStorefrontStyle={heroPreviewStorefrontStyle}
                    preview
                  />
                </div>
              </div>
            </div>
          </div>
          <div className="pointer-events-none absolute inset-0 z-30 rounded-xl ring-1 ring-inset ring-slate-200" />
        </div>
        {selectedElementId ? (
          <FloatingHomepageContextToolbar
            selectedElementId={selectedElementId}
            transitioning={isTransitioning}
            frameRef={frameRef}
            viewportRef={viewportRef}
            scrollRegionRef={scrollRegionRef}
            externalRef={contextToolbarRef}
            onDismiss={() => onSelectElement(null)}
          >
            {contextToolbar}
          </FloatingHomepageContextToolbar>
        ) : null}
      </div>
    </div>
  );
}

function ScaledSiteHeaderPreview({
  navigation,
  device,
  viewportWidth
}: {
  navigation: SiteNavigationConfig;
  device: HomepagePreviewDevice;
  viewportWidth: number;
}) {
  const normalizedNavigation = useMemo(() => normalizeSiteNavigationConfig(navigation), [navigation]);
  const rendererViewportWidth = viewportWidth / COMMERCIAL_STOREFRONT_SCALE;
  const headerHeight = normalizedNavigation.topBarLayout.responsive[device].settings.height * COMMERCIAL_STOREFRONT_SCALE;

  return (
    <div
      className="relative bg-white"
      data-preview-header-device={device}
      style={{ width: '100%', height: `var(--preview-header-shell-height, ${headerHeight}px)` }}
    >
      <div
        className="absolute left-0 top-0 overflow-visible"
        style={{
          width: `${100 / COMMERCIAL_STOREFRONT_SCALE}%`,
          transform: `scale(${COMMERCIAL_STOREFRONT_SCALE})`,
          transformOrigin: 'top left'
        }}
      >
        <SiteHeader
          navigation={navigation}
          previewMode="inline"
          previewDevice={device}
          previewViewportWidth={rendererViewportWidth}
        />
      </div>
    </div>
  );
}

function SortableSectionRow({
  sectionId,
  index,
  label,
  selected,
  visible,
  canDelete,
  menuOpen,
  renaming,
  renameValue,
  onSelect,
  onToggleVisibility,
  onDelete,
  onToggleMenu,
  onStartRename,
  onRenameValueChange,
  onRenameCommit,
  onRenameCancel
}: {
  sectionId: HomepageSectionId;
  index: number;
  label: string;
  selected: boolean;
  visible: boolean;
  canDelete: boolean;
  menuOpen: boolean;
  renaming: boolean;
  renameValue: string;
  onSelect: () => void;
  onToggleVisibility: () => void;
  onDelete: () => void;
  onToggleMenu: () => void;
  onStartRename: () => void;
  onRenameValueChange: (value: string) => void;
  onRenameCommit: () => void;
  onRenameCancel: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: sectionId });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={classNames(
        'grid grid-cols-[28px_22px_minmax(0,1fr)_34px] items-center gap-2 rounded-lg px-2 py-1.5 text-[12px] transition',
        selected
          ? 'bg-[color:var(--blue-50)] text-[color:var(--blue-700)] shadow-[inset_0_0_0_1px_rgba(37,99,235,0.12)]'
          : 'text-[color:var(--homepage-inspector-strong,#334155)] hover:bg-[color:var(--homepage-inspector-hover,#f8fafc)]',
        isDragging && 'relative z-20 bg-white opacity-90 shadow-lg'
      )}
    >
      <button
        type="button"
        className={`${adminMiniIconButtonTokenClasses} cursor-grab !text-[color:var(--homepage-inspector-muted,#94a3b8)] active:cursor-grabbing`}
        aria-label="Premakni sekcijo"
        title="Premakni sekcijo"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-4 w-4" />
      </button>
      <span className="text-center text-[11px] font-semibold text-[color:var(--homepage-inspector-muted,#94a3b8)]">{index + 1}</span>
      {renaming ? (
        <form
          className="min-w-0"
          onSubmit={(event) => {
            event.preventDefault();
            onRenameCommit();
          }}
        >
          <Input
            autoFocus
            value={renameValue}
            onChange={(event) => onRenameValueChange(event.target.value)}
            onBlur={onRenameCommit}
            onKeyDown={(event) => {
              if (event.key === 'Escape') {
                event.preventDefault();
                onRenameCancel();
              }
            }}
            onPointerDown={(event) => event.stopPropagation()}
            className={`${inputClassName} h-7 px-2 py-1 text-[12px] font-semibold`}
            aria-label="Ime sekcije"
          />
        </form>
      ) : (
        <button
          type="button"
          onClick={onSelect}
          className={classNames(
            'min-w-0 truncate rounded-md px-1 py-1 text-left font-semibold',
            !visible && 'text-[color:var(--homepage-inspector-muted,#94a3b8)] line-through decoration-slate-300'
          )}
        >
          {label}
        </button>
      )}
      <div className="relative justify-self-end" data-homepage-section-menu>
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onToggleMenu();
          }}
          className={`grid h-7 w-7 place-items-center rounded-lg border border-transparent text-[color:var(--homepage-inspector-muted,#64748b)] transition hover:bg-[color:var(--homepage-inspector-hover,#fff)] hover:text-[color:var(--homepage-inspector-strong,var(--blue-600))] ${adminControlFocusTokenClasses}`}
          aria-label="Možnosti sekcije"
          aria-expanded={menuOpen}
          title="Možnosti sekcije"
        >
          <MoreVertical className="h-4 w-4" />
        </button>
        {menuOpen ? (
          <div className="absolute right-0 top-8 z-40 w-44 overflow-hidden rounded-lg border border-[color:var(--homepage-inspector-input-border,#e2e8f0)] bg-[color:var(--homepage-inspector-subsurface-strong,#ffffff)] p-1 text-[color:var(--homepage-inspector-strong,#334155)] shadow-lg">
            <button
              type="button"
              className={`flex w-full items-center gap-2 rounded-lg border border-transparent px-2.5 py-2 text-left text-[12px] font-medium transition hover:bg-[color:var(--homepage-inspector-hover,#f8fafc)] ${adminControlFocusTokenClasses}`}
              onClick={onToggleVisibility}
            >
              {visible ? <Eye className="h-3.5 w-3.5" /> : <EyeClosed className="h-3.5 w-3.5" />}
              <span>{visible ? 'Skrij sekcijo' : 'Prikaži sekcijo'}</span>
            </button>
            <button
              type="button"
              className={`flex w-full items-center gap-2 rounded-lg border border-transparent px-2.5 py-2 text-left text-[12px] font-medium transition hover:bg-[color:var(--homepage-inspector-hover,#f8fafc)] ${adminControlFocusTokenClasses}`}
              onClick={onStartRename}
            >
              <Pencil className="h-3.5 w-3.5" />
              <span>Preimenuj</span>
            </button>
            <div className="my-1 h-px bg-slate-100" />
            <button
              type="button"
              disabled={!canDelete}
              className={`flex w-full items-center gap-2 rounded-lg border border-transparent px-2.5 py-2 text-left text-[12px] font-medium text-rose-600 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:text-slate-300 disabled:hover:bg-transparent ${adminControlFocusTokenClasses}`}
              onClick={onDelete}
            >
              <Trash2 className="h-3.5 w-3.5" />
              <span>Odstrani</span>
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function SortableCategoryRow({
  category,
  index
}: {
  category: HomepageCategoryCardData;
  index: number;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: category.slug });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={classNames(
        'grid grid-cols-[26px_24px_minmax(0,1fr)] items-center gap-2 rounded-lg px-2 py-1.5 text-[12px] transition hover:bg-[color:var(--homepage-inspector-hover,#f8fafc)]',
        isDragging && 'relative z-20 bg-white opacity-90 shadow-lg'
      )}
    >
      <button
        type="button"
        className={`${adminMiniIconButtonTokenClasses} cursor-grab !text-[color:var(--homepage-inspector-muted,#94a3b8)] active:cursor-grabbing`}
        aria-label="Premakni kategorijo"
        title="Premakni kategorijo"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-4 w-4" />
      </button>
      <span className="text-center text-[11px] font-semibold text-[color:var(--homepage-inspector-muted,#94a3b8)]">{index + 1}</span>
      <span className="truncate font-medium text-[color:var(--homepage-inspector-strong,#334155)]">{category.title}</span>
    </div>
  );
}

function SlidePreview({ slide }: { slide: HomepageHeroSlide }) {
  if (slide.type === 'video') {
    return (
      <div className="grid h-10 w-16 place-items-center overflow-hidden rounded border border-slate-200 bg-slate-900 text-[9px] font-semibold text-white">
        VIDEO
      </div>
    );
  }

  if (!slide.src) {
    return <div className="grid h-10 w-16 place-items-center rounded border border-dashed border-slate-300 bg-slate-50 text-[9px] text-slate-400">Medij</div>;
  }

  return (
    <div
      className="h-10 w-16 rounded border border-slate-200 bg-cover bg-center"
      role="img"
      aria-label={slide.alt || slide.title || 'Predogled diapozitiva'}
      style={{ backgroundImage: `url("${slide.src}")` }}
    />
  );
}

function SortableSlideEditor({
  slide,
  index,
  uploading,
  controlsDisabled,
  canMoveUp,
  canMoveDown,
  onChange,
  onDelete,
  onMoveUp,
  onMoveDown,
  onUpload
}: {
  slide: HomepageHeroSlide;
  index: number;
  uploading: boolean;
  controlsDisabled: boolean;
  canMoveUp: boolean;
  canMoveDown: boolean;
  onChange: (updates: Partial<HomepageHeroSlide>) => void;
  onDelete: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onUpload: (file: File) => void;
}) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [mediaDetailsOpen, setMediaDetailsOpen] = useState(false);
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: slide.id,
    disabled: controlsDisabled
  });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      data-testid="homepage-hero-carousel-slide"
      data-slide-id={slide.id}
      data-slide-index={index}
      data-uploading={uploading ? 'true' : 'false'}
      className={classNames(
        'rounded-lg border border-[color:var(--homepage-inspector-input-border,#e2e8f0)] bg-[color:var(--homepage-inspector-subsurface,#f8fafc)] p-1.5 transition',
        uploading && 'border-[color:var(--blue-200)] bg-[color:var(--blue-50)]/45',
        isDragging && 'relative z-20 bg-white opacity-90 shadow-lg'
      )}
    >
      <div className="grid min-w-0 gap-1.5 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
        <div className="flex min-w-0 items-center gap-1.5">
          <button
            type="button"
            className={`${adminMiniIconButtonTokenClasses} cursor-grab active:cursor-grabbing disabled:cursor-not-allowed disabled:opacity-35`}
            aria-label="Premakni diapozitiv"
            title="Premakni diapozitiv"
            disabled={controlsDisabled}
            data-testid="homepage-hero-carousel-slide-handle"
            {...attributes}
            {...listeners}
          >
            <GripVertical className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => setMediaDetailsOpen((open) => !open)}
            className={`group relative rounded-md border border-transparent transition ${adminControlFocusTokenClasses}`}
            aria-label="Uredi medij diapozitiva"
            aria-expanded={mediaDetailsOpen}
            title="Uredi medij"
          >
            <SlidePreview slide={slide} />
            <span className="pointer-events-none absolute right-1 top-1 grid h-5 w-5 place-items-center rounded bg-white/90 text-slate-600 opacity-0 shadow-sm ring-1 ring-slate-200 transition group-hover:opacity-100 group-focus-visible:opacity-100">
              <Pencil className="h-3 w-3" />
            </span>
          </button>
          <div className="min-w-0">
            <p className="flex min-w-0 items-center gap-1 truncate text-[11px] font-semibold text-[color:var(--homepage-inspector-strong,#1e293b)]">
              <span className="truncate">Diapozitiv {index + 1}</span>
              {uploading ? <span className="shrink-0 text-[10px] font-medium text-[color:var(--blue-600)]">Nalaganje ...</span> : null}
            </p>
            <p className="truncate text-[10px] text-[color:var(--homepage-inspector-muted,#64748b)]">{slide.title || slide.src || 'Brez medija'}</p>
          </div>
        </div>
        <div className="flex min-w-0 flex-wrap items-center gap-0.5 sm:justify-end">
          <SmallIconButton
            label="Premakni diapozitiv navzgor"
            onClick={onMoveUp}
            disabled={controlsDisabled || !canMoveUp}
            testId="homepage-hero-carousel-slide-up"
          >
            <ArrowUp className="h-4 w-4" />
          </SmallIconButton>
          <SmallIconButton
            label="Premakni diapozitiv navzdol"
            onClick={onMoveDown}
            disabled={controlsDisabled || !canMoveDown}
            testId="homepage-hero-carousel-slide-down"
          >
            <ArrowDown className="h-4 w-4" />
          </SmallIconButton>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,video/*"
            className="hidden"
            data-testid="homepage-hero-carousel-replace-input"
            disabled={controlsDisabled}
            onChange={(event: ChangeEvent<HTMLInputElement>) => {
              const file = event.target.files?.[0];
              event.target.value = '';
              if (file) onUpload(file);
            }}
          />
          <SmallIconButton label="Zamenjaj medij" onClick={() => fileInputRef.current?.click()} disabled={controlsDisabled}>
            <Upload className="h-4 w-4" />
          </SmallIconButton>
          <SmallIconButton label="Odstrani" tone="danger" onClick={onDelete} disabled={controlsDisabled}>
            <Trash2 className="h-4 w-4" />
          </SmallIconButton>
        </div>
      </div>

      {mediaDetailsOpen ? (
        <div className="mt-1.5 grid gap-2 rounded-md border border-[color:var(--homepage-inspector-input-border,#e2e8f0)] bg-[color:var(--homepage-inspector-subsurface-strong,#ffffff)] p-2">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[12px] font-semibold text-[color:var(--homepage-inspector-strong,#1e293b)]">Medij</span>
              <button
                type="button"
                onClick={() => setMediaDetailsOpen(false)}
                className="text-[11px] font-semibold text-[color:var(--homepage-inspector-muted,#64748b)] transition hover:text-white"
              >
                Zapri
              </button>
            </div>
            <TextField label="Medij URL" value={slide.src} onChange={(src) => onChange({ src, type: detectHeroMediaTypeFromSource(src, slide.type) })} placeholder="/images/..." />
            <TextField label="Alt besedilo" value={slide.alt} onChange={(alt) => onChange({ alt })} />
            {slide.type === 'video' ? (
              <TextField label="Poster slika" value={slide.poster} onChange={(poster) => onChange({ poster })} placeholder="/images/..." />
            ) : null}
        </div>
      ) : null}
    </div>
  );
}

function AdminLandingPageClient({
  initialConfig,
  initialDefaults,
  initialCategories,
  navigation,
  globalStyle
}: {
  initialConfig: HomepageSettings;
  initialDefaults: HomepageSettings;
  initialCategories: HomepageCategoryCardData[];
  navigation: SiteNavigationConfig;
  globalStyle: GlobalStyleConfig;
}) {
  const { toast } = useToast();
  const router = useRouter();
  const normalizedInitialConfig = useMemo(() => normalizeLandingPageConfig(initialConfig), [initialConfig]);
  const normalizedInitialConfigKey = useMemo(() => comparable(normalizedInitialConfig), [normalizedInitialConfig]);
  const normalizedInitialDefaults = useMemo(() => normalizeLandingPageConfig(initialDefaults), [initialDefaults]);
  const normalizedInitialDefaultsKey = useMemo(() => comparable(normalizedInitialDefaults), [normalizedInitialDefaults]);
  const normalizedInitialNavigation = useMemo(() => normalizeSiteNavigationConfig(navigation), [navigation]);
  const initialFooterDescription = normalizedInitialNavigation.footer.description;
  const normalizedInitialCategories = useMemo(
    () => initialCategories,
    [initialCategories]
  );
  const normalizedInitialCategoriesKey = useMemo(() => JSON.stringify(normalizedInitialCategories), [normalizedInitialCategories]);
  const [config, setConfig] = useState(normalizedInitialConfig);
  const [savedConfig, setSavedConfig] = useState(normalizedInitialConfig);
  const [savedDefaults, setSavedDefaults] = useState(normalizedInitialDefaults);
  const [categories, setCategories] = useState<HomepageCategoryCardData[]>(normalizedInitialCategories);
  const applyPersistedCategoryUpdates = useCallback((updates: Array<{
    categorySlug: string;
    image?: string | null;
    presentation: CategoryShowcaseMediaSettings;
    revision?: string;
  }>) => {
    const bySlug = new Map(updates.map((update) => [update.categorySlug, update]));
    setCategories((current) => current.map((category) => {
      const update = bySlug.get(category.slug);
      if (!update) return category;
      return {
        ...category,
        ...(Object.prototype.hasOwnProperty.call(update, 'image') ? { image: update.image ?? null } : {}),
        presentation: update.presentation,
        ...(update.revision ? { revision: update.revision } : {})
      };
    }));
  }, []);
  const categoryShowcaseEditor = useCategoryShowcaseEditor({
    items: categories,
    onPersisted: applyPersistedCategoryUpdates
  });
  const [footerDescription, setFooterDescription] = useState(initialFooterDescription);
  const [savedFooterDescription, setSavedFooterDescription] = useState(initialFooterDescription);
  const [selectedSectionId, setSelectedSectionId] = useState<HomepageSectionId>(normalizedInitialConfig.sectionOrder[0] ?? 'hero');
  const [selectedElementId, setSelectedElementId] = useState<string | null>(null);
  const [categoryTitleEditScope, setCategoryTitleEditScope] = useState<CategoryTitleEditScope>('selected');
  const [activeToolbarPopover, setActiveToolbarPopover] = useState<ToolbarPopover>(null);
  const [activeToolbarHost, setActiveToolbarHost] = useState<HomepageToolbarHost | null>(null);
  const [previewDevice, setPreviewDevice] = useState<HomepagePreviewDevice>('desktop');
  const [editorOptionsByDevice, setEditorOptionsByDevice] = useState<Record<HomepagePreviewDevice, HomepageCanvasEditorOptions>>(() => ({
    desktop: { ...DEFAULT_HOMEPAGE_CANVAS_EDITOR_OPTIONS },
    tablet: { ...DEFAULT_HOMEPAGE_CANVAS_EDITOR_OPTIONS, gridSize: 8 },
    mobile: { ...DEFAULT_HOMEPAGE_CANVAS_EDITOR_OPTIONS, gridSize: 4 }
  }));
  const [isSaving, setIsSaving] = useState(false);
  const [uploadingSlideId, setUploadingSlideId] = useState<string | null>(null);
  const addHeroSlideInputRef = useRef<HTMLInputElement | null>(null);
  const [addSectionMenuOpen, setAddSectionMenuOpen] = useState(false);
  const [openSectionMenuId, setOpenSectionMenuId] = useState<HomepageSectionId | null>(null);
  const [renamingSectionId, setRenamingSectionId] = useState<HomepageSectionId | null>(null);
  const [sectionRenameValue, setSectionRenameValue] = useState('');
  const inlineToolbarRef = useRef<HTMLDivElement | null>(null);
  const floatingToolbarRef = useRef<HTMLDivElement | null>(null);
  const addSectionMenuRef = useRef<HTMLDivElement | null>(null);
  const toolbarPopoverDismissRefs = useMemo(
    () => [inlineToolbarRef, floatingToolbarRef],
    []
  );
  const addSectionMenuDismissRefs = useMemo(() => [addSectionMenuRef], []);
  const appliedInitialConfigKeyRef = useRef(normalizedInitialConfigKey);
  const appliedInitialDefaultsKeyRef = useRef(normalizedInitialDefaultsKey);
  const appliedInitialFooterDescriptionRef = useRef(initialFooterDescription);
  const appliedInitialCategoriesKeyRef = useRef(normalizedInitialCategoriesKey);
  const saveInFlightRef = useRef(false);
  const isDirtyRef = useRef(false);
  const pendingRemoteCategoryChangeRef = useRef<CategoryDataChangeMessage | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  useDropdownDismiss({
    open: Boolean(activeToolbarPopover),
    refs: toolbarPopoverDismissRefs,
    ignoreSelector: homepageToolbarNestedPortalSelector,
    ignoreEscapeSelector: homepageToolbarNestedPortalSelector,
    dismissGroup: 'homepage-toolbar-popover',
    onClose: () => {
      setActiveToolbarPopover(null);
      setActiveToolbarHost(null);
      setAddSectionMenuOpen(false);
    }
  });
  useDropdownDismiss({
    open: Boolean(openSectionMenuId),
    ignoreSelector: '[data-homepage-section-menu]',
    dismissGroup: 'homepage-section-menu',
    onClose: () => setOpenSectionMenuId(null)
  });
  useDropdownDismiss({
    open: addSectionMenuOpen,
    refs: addSectionMenuDismissRefs,
    dismissGroup: 'homepage-add-section-menu',
    onClose: () => setAddSectionMenuOpen(false)
  });

  useEffect(() => {
    if (appliedInitialConfigKeyRef.current === normalizedInitialConfigKey) return;
    appliedInitialConfigKeyRef.current = normalizedInitialConfigKey;
    setConfig(normalizedInitialConfig);
    setSavedConfig(normalizedInitialConfig);
    setSelectedSectionId((current) => normalizedInitialConfig.sectionOrder.includes(current) ? current : normalizedInitialConfig.sectionOrder[0] ?? 'hero');
    setSelectedElementId(null);
    setCategoryTitleEditScope('selected');
    setActiveToolbarPopover(null);
    setOpenSectionMenuId(null);
    setRenamingSectionId(null);
    setSectionRenameValue('');
  }, [normalizedInitialConfig, normalizedInitialConfigKey]);

  useEffect(() => {
    if (appliedInitialDefaultsKeyRef.current === normalizedInitialDefaultsKey) return;
    appliedInitialDefaultsKeyRef.current = normalizedInitialDefaultsKey;
    setSavedDefaults(normalizedInitialDefaults);
  }, [normalizedInitialDefaults, normalizedInitialDefaultsKey]);

  useEffect(() => {
    if (appliedInitialFooterDescriptionRef.current === initialFooterDescription) return;
    appliedInitialFooterDescriptionRef.current = initialFooterDescription;
    setFooterDescription(initialFooterDescription);
    setSavedFooterDescription(initialFooterDescription);
  }, [initialFooterDescription]);

  useEffect(() => {
    if (appliedInitialCategoriesKeyRef.current === normalizedInitialCategoriesKey) return;
    appliedInitialCategoriesKeyRef.current = normalizedInitialCategoriesKey;
    categoryShowcaseEditor.resetAll();
    setCategories(normalizedInitialCategories);
  }, [categoryShowcaseEditor, normalizedInitialCategories, normalizedInitialCategoriesKey]);

  const configWithPendingEdits = useMemo(
    () => renamingSectionId
      ? normalizeLandingPageConfig(withSectionTitle(config, renamingSectionId, sectionRenameValue))
      : config,
    [config, renamingSectionId, sectionRenameValue]
  );
  const landingIsDirty = useMemo(
    () => comparable(configWithPendingEdits) !== comparable(savedConfig),
    [configWithPendingEdits, savedConfig]
  );
  const footerDescriptionIsDirty = footerDescription !== savedFooterDescription;
  const categoryPresentationIsDirty = categoryShowcaseEditor.isDirty;
  const isDirty = landingIsDirty || footerDescriptionIsDirty || categoryPresentationIsDirty;

  useEffect(() => {
    isDirtyRef.current = isDirty;
  }, [isDirty]);

  const applyRemoteCategoryChange = useCallback(async (message: CategoryDataChangeMessage) => {
    if (message.scope !== 'showcase' || message.changedSlugs.length === 0) {
      router.refresh();
      return;
    }

    try {
      const updates = await fetchCategoryShowcaseUpdates(message.changedSlugs);
      if (isDirtyRef.current || document.visibilityState !== 'visible') {
        pendingRemoteCategoryChangeRef.current = mergeCategoryDataChangeMessages(
          pendingRemoteCategoryChangeRef.current,
          message
        );
        return;
      }
      applyPersistedCategoryUpdates(updates);
    } catch {
      if (isDirtyRef.current || document.visibilityState !== 'visible') {
        pendingRemoteCategoryChangeRef.current = mergeCategoryDataChangeMessages(
          pendingRemoteCategoryChangeRef.current,
          message
        );
        return;
      }
      router.refresh();
    }
  }, [applyPersistedCategoryUpdates, router]);

  useEffect(() => {
    const refreshIfReady = () => {
      const pendingChange = pendingRemoteCategoryChangeRef.current;
      if (
        pendingChange === null
        || isDirtyRef.current
        || document.visibilityState !== 'visible'
      ) {
        return;
      }

      pendingRemoteCategoryChangeRef.current = null;
      void applyRemoteCategoryChange(pendingChange);
    };

    const unsubscribe = subscribeToCategoryDataChanges((message) => {
      pendingRemoteCategoryChangeRef.current = mergeCategoryDataChangeMessages(
        pendingRemoteCategoryChangeRef.current,
        message
      );
      refreshIfReady();
    });
    const handleFocus = () => refreshIfReady();
    const handleVisibilityChange = () => refreshIfReady();

    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      unsubscribe();
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [applyRemoteCategoryChange]);

  useEffect(() => {
    const pendingChange = pendingRemoteCategoryChangeRef.current;
    if (
      isDirty
      || pendingChange === null
      || document.visibilityState !== 'visible'
    ) {
      return;
    }

    pendingRemoteCategoryChangeRef.current = null;
    void applyRemoteCategoryChange(pendingChange);
  }, [applyRemoteCategoryChange, isDirty]);
  const previewNavigation = useMemo(
    () => normalizeSiteNavigationConfig({
      ...normalizedInitialNavigation,
      footer: { ...normalizedInitialNavigation.footer, description: footerDescription }
    }),
    [footerDescription, normalizedInitialNavigation]
  );
  const sectionIds = config.sectionOrder;
  const availableSectionIds = HOMEPAGE_SECTION_IDS.filter((sectionId) => !sectionIds.includes(sectionId));

  useEffect(() => {
    if (availableSectionIds.length === 0) setAddSectionMenuOpen(false);
  }, [availableSectionIds.length]);

  useEffect(() => {
    if (!isDirty) return undefined;
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isDirty]);

  function updateConfig(updater: (current: HomepageSettings) => HomepageSettings) {
    setConfig((current) => normalizeLandingPageConfig(updater(current)));
  }

  function updateHero(updates: Partial<HomepageSettings['hero']>) {
    updateConfig((current) => ({ ...current, hero: { ...current.hero, ...updates } }));
  }

  function updateCategories(updates: Partial<HomepageSettings['categories']>) {
    updateConfig((current) => ({ ...current, categories: { ...current.categories, ...updates } }));
  }

  function replaceCategoryImage(categorySlug: string, file: File) {
    categoryShowcaseEditor.stageImage(categorySlug, file);
    setSelectedSectionId('categories');
    setSelectedElementId(`categories:image:${categorySlug}`);
  }

  function removeCategoryImage(categorySlug: string) {
    if (!window.confirm('Odstranim sliko te kategorije? Sprememba bo potrjena ob shranjevanju.')) return;
    categoryShowcaseEditor.stageImage(categorySlug, null);
    setSelectedSectionId('categories');
    setSelectedElementId(`categories:image:${categorySlug}`);
  }

  function editCategoryAppearance(categorySlug: string) {
    setSelectedSectionId('categories');
    setSelectedElementId(`categories:image:${categorySlug}`);
    setActiveToolbarHost('floating');
    setActiveToolbarPopover('media');
  }

  function updateInfoBlocks(updates: Partial<HomepageSettings['infoBlocks']>) {
    updateConfig((current) => ({ ...current, infoBlocks: { ...current.infoBlocks, ...updates } }));
  }

  function updateFooter(updates: Partial<HomepageSettings['footer']>) {
    updateConfig((current) => ({ ...current, footer: { ...current.footer, ...updates } }));
  }

  function updatePage(updates: Partial<HomepageSettings['page']>) {
    updateConfig((current) => ({ ...current, page: { ...current.page, ...updates } }));
  }

  function getSectionLabel(sectionId: HomepageSectionId) {
    return resolveHomepageSectionLabel(sectionId, config.sectionTitles);
  }

  function setSectionTitle(sectionId: HomepageSectionId, title: string) {
    updateConfig((current) => withSectionTitle(current, sectionId, title));
  }

  function startSectionRename(sectionId: HomepageSectionId) {
    setSelectedSectionId(sectionId);
    setOpenSectionMenuId(null);
    setRenamingSectionId(sectionId);
    setSectionRenameValue(getSectionLabel(sectionId));
  }

  function commitSectionRename(sectionId: HomepageSectionId) {
    if (renamingSectionId !== sectionId) return;
    setSectionTitle(sectionId, sectionRenameValue);
    setRenamingSectionId(null);
    setSectionRenameValue('');
  }

  function cancelSectionRename() {
    setRenamingSectionId(null);
    setSectionRenameValue('');
  }

  function updateHeroViewForDevice(
    device: HomepagePreviewDevice,
    updates: Partial<HomepageHeroDeviceSettings>
  ) {
    updateConfig((current) => ({
      ...current,
      hero: {
        ...current.hero,
        responsive: {
          ...current.hero.responsive,
          [device]: { ...current.hero.responsive[device], ...updates }
        }
      }
    }));
  }

  function updateHeroView(updates: Partial<HomepageHeroDeviceSettings>) {
    updateHeroViewForDevice(previewDevice, updates);
  }

  function addHeroTextBlock(kind: HomepageHeroTextBlock['kind'] = 'text') {
    const blockId = createId(kind === 'button' ? 'hero-button' : 'hero-text');
    const desktopDefaults = {
      xPx: 240,
      yPx: Math.min(Math.max(heroViewSettings.heightPx - 210, 230), 360),
      widthPx: 360,
      fontFamily: 'Inter' as const,
      fontSizePx: 24,
      bold: false,
      italic: false,
      underline: false
    };
    const block: HomepageHeroTextBlock = {
      id: blockId,
      kind,
      text: kind === 'button' ? 'Nov gumb' : 'Novo besedilo',
      visible: true,
      href: kind === 'button' ? '#' : '',
      ...desktopDefaults,
      responsive: {
        desktop: desktopDefaults,
        tablet: { ...desktopDefaults, xPx: 120, yPx: 260, widthPx: 320, fontSizePx: 22 },
        mobile: { ...desktopDefaults, xPx: 24, yPx: 250, widthPx: 300, fontSizePx: 18 }
      }
    };

    updateHero({ textBlocks: [...config.hero.textBlocks, block] });
    setSelectedSectionId('hero');
    setSelectedElementId(`hero:textBlock:${blockId}`);
    setActiveToolbarHost('floating');
    setActiveToolbarPopover(kind === 'button' ? 'link' : 'style');
    return blockId;
  }

  function updateHeroTextBlock(blockId: string, updates: HeroTextBlockUpdates) {
    updateConfig((current) => ({
      ...current,
      hero: {
        ...current.hero,
        textBlocks: current.hero.textBlocks.map((block) => (block.id === blockId ? { ...block, ...updates } : block))
      }
    }));
  }

  function updateCategoriesView(updates: Partial<HomepageCategoriesDeviceSettings>) {
    updateCategories({
      responsive: {
        ...config.categories.responsive,
        [previewDevice]: { ...config.categories.responsive[previewDevice], ...updates }
      }
    });
  }

  function updateInfoBlocksView(updates: Partial<HomepageInfoBlocksDeviceSettings>) {
    updateInfoBlocks({
      responsive: {
        ...config.infoBlocks.responsive,
        [previewDevice]: { ...config.infoBlocks.responsive[previewDevice], ...updates }
      }
    });
  }

  function updateFooterView(updates: Partial<HomepageFooterDeviceSettings>) {
    updateFooter({
      responsive: {
        ...config.footer.responsive,
        [previewDevice]: { ...config.footer.responsive[previewDevice], ...updates }
      }
    });
  }

  function updatePageView(updates: Partial<HomepagePageDeviceSettings>) {
    updatePage({
      responsive: {
        ...config.page.responsive,
        [previewDevice]: { ...config.page.responsive[previewDevice], ...updates }
      }
    });
  }

  function withSectionVisibility(current: HomepageSettings, sectionId: HomepageSectionId, visible: boolean): HomepageSettings {
    if (sectionId === 'hero') return { ...current, hero: { ...current.hero, visible } };
    if (sectionId === 'categories') return { ...current, categories: { ...current.categories, visible } };
    if (sectionId === 'infoBlocks') return { ...current, infoBlocks: { ...current.infoBlocks, visible } };
    return { ...current, footer: { ...current.footer, visible } };
  }

  function setSectionVisible(sectionId: HomepageSectionId, visible: boolean) {
    updateConfig((current) => withSectionVisibility(current, sectionId, visible));
    setOpenSectionMenuId(null);
  }

  function isSectionVisible(sectionId: HomepageSectionId) {
    if (sectionId === 'hero') return config.hero.visible;
    if (sectionId === 'categories') return config.categories.visible;
    if (sectionId === 'infoBlocks') return config.infoBlocks.visible;
    return config.footer.visible;
  }

  function addSection(sectionId: HomepageSectionId) {
    if (sectionIds.includes(sectionId)) return;
    updateConfig((current) => {
      if (current.sectionOrder.includes(sectionId)) return current;
      return withSectionVisibility({ ...current, sectionOrder: [...current.sectionOrder, sectionId] }, sectionId, true);
    });
    setSelectedSectionId(sectionId);
    setSelectedElementId(`section:${sectionId}`);
    setActiveToolbarHost('floating');
    setActiveToolbarPopover('section');
    setAddSectionMenuOpen(false);
  }

  function deleteSection(sectionId: HomepageSectionId) {
    if (sectionIds.length <= 1) return;
    const sectionIndex = sectionIds.indexOf(sectionId);
    const nextSectionIds = sectionIds.filter((currentSectionId) => currentSectionId !== sectionId);
    updateConfig((current) => {
      const sectionTitles = { ...current.sectionTitles };
      delete sectionTitles[sectionId];
      return {
        ...current,
        sectionTitles,
        sectionOrder: current.sectionOrder.filter((currentSectionId) => currentSectionId !== sectionId)
      };
    });
    setOpenSectionMenuId(null);
    if (renamingSectionId === sectionId) cancelSectionRename();
    if (selectedSectionId === sectionId) {
      setSelectedSectionId(nextSectionIds[Math.min(sectionIndex, nextSectionIds.length - 1)] ?? nextSectionIds[0] ?? 'hero');
    }
    if (selectedElementId === `section:${sectionId}`) {
      setSelectedElementId(null);
      setActiveToolbarPopover(null);
    }
  }

  function moveSection(sectionId: HomepageSectionId, direction: -1 | 1) {
    updateConfig((current) => {
      const currentIndex = current.sectionOrder.indexOf(sectionId);
      const nextIndex = Math.min(current.sectionOrder.length - 1, Math.max(0, currentIndex + direction));
      if (currentIndex < 0 || nextIndex === currentIndex) return current;
      return { ...current, sectionOrder: arrayMove(current.sectionOrder, currentIndex, nextIndex) };
    });
  }

  function handleSectionDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    updateConfig((current) => {
      const oldIndex = current.sectionOrder.indexOf(active.id as HomepageSectionId);
      const newIndex = current.sectionOrder.indexOf(over.id as HomepageSectionId);
      if (oldIndex < 0 || newIndex < 0) return current;
      return { ...current, sectionOrder: withPositions(arrayMove(current.sectionOrder, oldIndex, newIndex)) };
    });
  }

  function handleSlideDragEnd(event: DragEndEvent) {
    if (uploadingSlideId !== null) return;
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = config.hero.slides.findIndex((slide) => slide.id === active.id);
    const newIndex = config.hero.slides.findIndex((slide) => slide.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    updateHero({ slides: arrayMove(config.hero.slides, oldIndex, newIndex) });
  }

  function moveSlide(slideId: string, direction: -1 | 1) {
    if (uploadingSlideId !== null) return;
    const currentIndex = config.hero.slides.findIndex((slide) => slide.id === slideId);
    const nextIndex = currentIndex + direction;
    if (currentIndex < 0 || nextIndex < 0 || nextIndex >= config.hero.slides.length) return;
    updateHero({ slides: arrayMove(config.hero.slides, currentIndex, nextIndex) });
  }

  function handleCategoryDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    moveCategory(String(active.id), String(over.id));
  }

  function moveCategory(sourceSlug: string, targetSlug: string) {
    const orderedSlugs = orderHomepageCategories(categories, config.categories).map((category) => category.slug);
    const oldIndex = orderedSlugs.indexOf(sourceSlug);
    const newIndex = orderedSlugs.indexOf(targetSlug);
    if (oldIndex < 0 || newIndex < 0) return;
    updateCategories({
      categoryOrderMode: 'custom',
      categoryOrder: arrayMove(orderedSlugs, oldIndex, newIndex)
    });
  }

  function updateCategoryOrderMode(categoryOrderMode: HomepageSettings['categories']['categoryOrderMode']) {
    if (categoryOrderMode === 'catalog') {
      updateCategories({ categoryOrderMode, categoryOrder: [] });
      return;
    }

    updateCategories({
      categoryOrderMode,
      categoryOrder: orderHomepageCategories(categories, config.categories).map((category) => category.slug)
    });
  }

  function updateSlide(slideId: string, updates: Partial<HomepageHeroSlide>) {
    updateConfig((current) => ({
      ...current,
      hero: {
        ...current.hero,
        slides: current.hero.slides.map((slide) => (slide.id === slideId ? { ...slide, ...updates } : slide))
      }
    }));
  }

  function deleteSlide(slideId: string) {
    if (config.hero.slides.length <= 1) {
      toast.error('Hero potrebuje vsaj en diapozitiv.');
      return;
    }
    updateHero({ slides: config.hero.slides.filter((slide) => slide.id !== slideId) });
  }

  async function uploadSlideMedia(slideId: string, file: File, options: { removeOnFailure?: boolean } = {}) {
    if (uploadingSlideId !== null) return;
    const fallbackMediaType = detectHeroMediaTypeFromFile(file);
    const fileBaseName = getFileBaseName(file.name);

    setUploadingSlideId(slideId);
    try {
      const uploaded = await uploadAdminPublicMedia(file, {
        scope: 'landing-media',
        elementId: `hero-${slideId}`,
        mediaKind: fallbackMediaType
      });
      const mediaType = uploaded.mediaKind === 'video' ? 'video' : 'image';
      updateSlide(slideId, {
        type: mediaType,
        src: uploaded.url,
        title: fileBaseName,
        alt: mediaType === 'image' ? fileBaseName : ''
      });
      updateHero({ backgroundType: mediaType });
      toast.success(mediaType === 'video' ? 'Video je naložen.' : 'Slika je naložena.');
    } catch (error) {
      if (options.removeOnFailure) {
        updateConfig((current) => ({
          ...current,
          hero: {
            ...current.hero,
            slides: current.hero.slides.length > 1 ? current.hero.slides.filter((slide) => slide.id !== slideId) : current.hero.slides
          }
        }));
      }
      toast.error(error instanceof Error ? error.message : 'Nalaganje medija ni uspelo.');
    } finally {
      setUploadingSlideId(null);
    }
  }

  function uploadNewSlideMedia(file: File) {
    if (uploadingSlideId !== null) return;
    if (config.hero.slides.length >= MAX_HOMEPAGE_HERO_SLIDES) {
      toast.error(`Dodate lahko največ ${MAX_HOMEPAGE_HERO_SLIDES} diapozitivov.`);
      return;
    }
    const mediaType = detectHeroMediaTypeFromFile(file);
    const fileBaseName = getFileBaseName(file.name);
    const slideId = createId('slide');
    const slide: HomepageHeroSlide = {
      id: slideId,
      type: mediaType,
      src: '',
      alt: mediaType === 'image' ? fileBaseName : '',
      title: fileBaseName || (mediaType === 'video' ? 'Nov video' : 'Nova slika'),
      poster: ''
    };

    updateConfig((current) => ({
      ...current,
      hero: {
        ...current.hero,
        backgroundType: mediaType,
        slides: [...current.hero.slides, slide]
      }
    }));
    void uploadSlideMedia(slideId, file, { removeOnFailure: true });
  }

  function addInfoItem() {
    const item: HomepageInfoBlockItem = {
      id: createId('info'),
      icon: 'badge-check',
      title: 'Nov element',
      description: '',
      href: ''
    };
    updateInfoBlocks({ items: [...config.infoBlocks.items, item] });
  }

  function updateInfoItem(itemId: string, updates: Partial<HomepageInfoBlockItem>) {
    updateInfoBlocks({
      items: config.infoBlocks.items.map((item) => (item.id === itemId ? { ...item, ...updates } : item))
    });
  }

  function deleteInfoItem(itemId: string) {
    updateInfoBlocks({ items: config.infoBlocks.items.filter((item) => item.id !== itemId) });
  }

  function setInfoItemCount(count: number) {
    const nextCount = Math.min(12, Math.max(1, Math.round(count)));
    const items = [...config.infoBlocks.items];
    while (items.length < nextCount) {
      items.push({
        id: createId('info'),
        icon: 'badge-check',
        title: 'Nov element',
        description: '',
        href: ''
      });
    }
    updateInfoBlocks({ items: items.slice(0, nextCount) });
  }

  function createCanvasStyleSeed(current: HomepageSettings, elementId: string, device: HomepagePreviewDevice): HomepageCanvasElementDeviceSettings {
    const base = {
      ...DEFAULT_HOMEPAGE_CANVAS_ELEMENT_DEVICE_SETTINGS,
      zIndex: elementId.startsWith('hero:') ? 20 : DEFAULT_HOMEPAGE_CANVAS_ELEMENT_DEVICE_SETTINGS.zIndex
    };
    const hero = { ...current.hero, ...current.hero.responsive[device] };

    if (elementId === 'hero:title') {
      return { ...base, color: '#ffffff', fontFamily: hero.titleFontFamily, fontSizePx: hero.titleFontSizePx, lineHeight: 1.08, fontWeight: hero.titleBold ? 800 : 600, horizontalAlign: hero.contentAlign, textAlign: hero.contentAlign };
    }
    if (elementId === 'hero:description') {
      return { ...base, color: '#ffffff', fontFamily: hero.descriptionFontFamily, fontSizePx: hero.descriptionFontSizePx, lineHeight: 1.65, fontWeight: hero.descriptionBold ? 700 : 400, horizontalAlign: hero.contentAlign, textAlign: hero.contentAlign };
    }
    if (elementId === 'hero:primaryButton' || elementId === 'hero:secondaryButton') {
      return { ...base, color: '#ffffff', fontFamily: 'Inter', fontSizePx: 15, lineHeight: 1.2, fontWeight: 600 };
    }
    if (elementId.startsWith('hero:textBlock:')) {
      const blockId = elementId.slice('hero:textBlock:'.length);
      const block = current.hero.textBlocks.find((candidate) => candidate.id === blockId);
      const resolved = block ? { ...block, ...block.responsive[device] } : null;
      return {
        ...base,
        visible: block?.visible ?? true,
        widthPx: resolved?.widthPx ?? 0,
        color: '#ffffff',
        fontFamily: resolved?.fontFamily ?? 'Inter',
        fontSizePx: resolved?.fontSizePx ?? (block?.kind === 'button' ? 15 : 24),
        lineHeight: block?.kind === 'button' ? 1.2 : 1.25,
        fontWeight: resolved?.bold ? 800 : block?.kind === 'button' ? 600 : 500
      };
    }
    if (elementId === 'categories:heading') {
      return { ...base, color: '#111827', fontFamily: 'Noto Sans', fontSizePx: 16, lineHeight: 1.5, fontWeight: 400, zIndex: 2 };
    }
    if (elementId.startsWith('categories:title:')) {
      return createDefaultHomepageCategoryTitleCanvasSettings();
    }
    if (elementId === 'categories:subtitle') {
      return { ...base, color: '#536070', fontFamily: 'Noto Sans', fontSizePx: 16, lineHeight: 1.5, fontWeight: 400, zIndex: 2 };
    }
    if (elementId === 'categories:showAll') {
      return { ...base, color: '#111827', fontFamily: 'Noto Sans', fontSizePx: 16, lineHeight: 1.5, fontWeight: 400, zIndex: 3 };
    }
    if (elementId.startsWith('categories:image:')) return { ...base, zIndex: 1 };
    if (elementId.startsWith('categories:card:')) return { ...base, zIndex: 0 };
    if (elementId === 'footer:logo') {
      return { ...base, fontSizePx: 40, lineHeight: 1, horizontalAlign: 'left', textAlign: 'left', zIndex: 10 };
    }
    if (elementId === 'footer:description') {
      return {
        ...base,
        color: '',
        fontFamily: 'Inter',
        fontSizePx: 13,
        lineHeight: 1.85,
        fontWeight: 400,
        horizontalAlign: 'left',
        textAlign: 'left',
        zIndex: 10
      };
    }
    return base;
  }

  function resolveCanvasStyleForDevice(
    current: HomepageSettings,
    elements: HomepageSettings['canvas']['elements'],
    elementId: string,
    device: HomepagePreviewDevice
  ) {
    const canvas = { ...current.canvas, elements };
    if (elements[elementId]) {
      return resolveHomepageCanvasElementDeviceSettings(canvas, elementId, device);
    }
    if (
      isCategoryTitleCanvasElement(elementId)
      && elements[HOMEPAGE_CATEGORY_TITLE_SHARED_CANVAS_ELEMENT_ID]
    ) {
      return resolveHomepageCanvasElementDeviceSettings(
        canvas,
        HOMEPAGE_CATEGORY_TITLE_SHARED_CANVAS_ELEMENT_ID,
        device
      );
    }
    return createCanvasStyleSeed(current, elementId, device);
  }

  function applyCanvasElementStyleUpdates(
    current: HomepageSettings,
    elements: HomepageSettings['canvas']['elements'],
    device: HomepagePreviewDevice,
    elementId: string,
    updates: Partial<HomepageCanvasElementDeviceSettings>
  ) {
    const existing = elements[elementId];
    const responsive = existing?.responsive ?? {
      desktop: resolveCanvasStyleForDevice(current, elements, elementId, 'desktop'),
      tablet: resolveCanvasStyleForDevice(current, elements, elementId, 'tablet'),
      mobile: resolveCanvasStyleForDevice(current, elements, elementId, 'mobile')
    };
    const nextResponsive = {
      ...responsive,
      [device]: { ...responsive[device], ...updates }
    };

    return {
      ...(existing ?? nextResponsive.desktop),
      ...(device === 'desktop' ? updates : {}),
      responsive: nextResponsive
    };
  }

  function getAllCategoryTitleElementIds() {
    return Array.from(new Set([
      HOMEPAGE_CATEGORY_TITLE_SHARED_CANVAS_ELEMENT_ID,
      ...categories.map((category) => `${categoryTitleCanvasElementPrefix}${category.slug}`)
    ]));
  }

  function updateCanvasElementStyleForDevice(
    device: HomepagePreviewDevice,
    elementId: string,
    updates: Partial<HomepageCanvasElementDeviceSettings>
  ) {
    updateConfig((current) => {
      const updateKeys = Object.keys(updates) as Array<keyof HomepageCanvasElementDeviceSettings>;
      const appliesToAllCategoryTitles = categoryTitleEditScope === 'all'
        && isCategoryTitleCanvasElement(elementId)
        && updateKeys.length > 0
        && updateKeys.every((key) => categoryTitleScopedStyleKeys.has(key));
      const targetElementIds = appliesToAllCategoryTitles
        ? getAllCategoryTitleElementIds()
        : [elementId];
      let elements = current.canvas.elements;

      targetElementIds.forEach((targetElementId) => {
        const nextElement = applyCanvasElementStyleUpdates(
          current,
          elements,
          device,
          targetElementId,
          updates
        );
        elements = { ...elements, [targetElementId]: nextElement };
      });

      return {
        ...current,
        canvas: {
          ...current.canvas,
          elements
        }
      };
    });
  }

  function updateCanvasElementStyleFromPreview(
    device: HomepagePreviewDevice,
    elementId: string,
    updates: Partial<HomepageCanvasElementDeviceSettings>
  ) {
    const updateKeys = Object.keys(updates) as Array<keyof HomepageCanvasElementDeviceSettings>;
    const movingAllCategoryTitles = categoryTitleEditScope === 'all'
      && isCategoryTitleCanvasElement(elementId)
      && updateKeys.length > 0
      && updateKeys.every((key) => key === 'offsetXPx' || key === 'offsetYPx');

    if (!movingAllCategoryTitles) {
      updateCanvasElementStyleForDevice(device, elementId, updates);
      return;
    }

    updateConfig((current) => {
      const originalElements = current.canvas.elements;
      const selectedStyle = resolveCanvasStyleForDevice(current, originalElements, elementId, device);
      const deltaX = updates.offsetXPx === undefined ? 0 : updates.offsetXPx - selectedStyle.offsetXPx;
      const deltaY = updates.offsetYPx === undefined ? 0 : updates.offsetYPx - selectedStyle.offsetYPx;
      let elements = originalElements;

      getAllCategoryTitleElementIds().forEach((targetElementId) => {
        const targetStyle = resolveCanvasStyleForDevice(current, originalElements, targetElementId, device);
        const nextElement = applyCanvasElementStyleUpdates(
          current,
          elements,
          device,
          targetElementId,
          {
            ...(updates.offsetXPx !== undefined ? { offsetXPx: targetStyle.offsetXPx + deltaX } : {}),
            ...(updates.offsetYPx !== undefined ? { offsetYPx: targetStyle.offsetYPx + deltaY } : {})
          }
        );
        elements = { ...elements, [targetElementId]: nextElement };
      });

      return {
        ...current,
        canvas: { ...current.canvas, elements }
      };
    });
  }

  function updateCanvasElementStyle(elementId: string, updates: Partial<HomepageCanvasElementDeviceSettings>) {
    updateCanvasElementStyleForDevice(previewDevice, elementId, updates);
  }

  function updateEditorOptions(updates: Partial<HomepageCanvasEditorOptions>) {
    setEditorOptionsByDevice((current) => ({
      ...current,
      [previewDevice]: { ...current[previewDevice], ...updates }
    }));
  }

  function selectCanvasElement(elementId: string | null) {
    setSelectedElementId(elementId);
    setActiveToolbarPopover(null);
    if (!elementId) return;
    if (elementId.startsWith('section:')) {
      const sectionId = elementId.slice('section:'.length) as HomepageSectionId;
      if (HOMEPAGE_SECTION_IDS.includes(sectionId)) setSelectedSectionId(sectionId);
    } else if (elementId.startsWith('hero:')) {
      setSelectedSectionId('hero');
    } else if (elementId.startsWith('categories:')) {
      setSelectedSectionId('categories');
    } else if (elementId.startsWith('footer:')) {
      setSelectedSectionId('footer');
    }
  }

  function updateSelectedTypography(updates: {
    fontFamily?: HomepageHeroFontFamily;
    fontSizePx?: number;
    bold?: boolean;
    italic?: boolean;
    underline?: boolean;
  }) {
    if (!selectedElementId) return;
    if (selectedElementId === 'hero:title') {
      updateHeroView({
        titleFontFamily: updates.fontFamily ?? heroViewSettings.titleFontFamily,
        titleFontSizePx: updates.fontSizePx ?? heroViewSettings.titleFontSizePx,
        titleBold: updates.bold ?? heroViewSettings.titleBold,
        titleItalic: updates.italic ?? heroViewSettings.titleItalic,
        titleUnderline: updates.underline ?? heroViewSettings.titleUnderline
      });
      return;
    }
    if (selectedElementId === 'hero:description') {
      updateHeroView({
        descriptionFontFamily: updates.fontFamily ?? heroViewSettings.descriptionFontFamily,
        descriptionFontSizePx: updates.fontSizePx ?? heroViewSettings.descriptionFontSizePx,
        descriptionBold: updates.bold ?? heroViewSettings.descriptionBold,
        descriptionItalic: updates.italic ?? heroViewSettings.descriptionItalic,
        descriptionUnderline: updates.underline ?? heroViewSettings.descriptionUnderline
      });
      return;
    }
    if (
      selectedElementId === 'categories:heading'
      || selectedElementId === 'categories:subtitle'
      || selectedElementId === 'categories:showAll'
      || isCategoryTitleCanvasElement(selectedElementId)
    ) {
      const styleElementId = isCategoryTitleCanvasElement(selectedElementId) && categoryTitleEditScope === 'all'
        ? HOMEPAGE_CATEGORY_TITLE_SHARED_CANVAS_ELEMENT_ID
        : selectedElementId;
      const currentStyle = resolveCanvasStyleForDevice(config, config.canvas.elements, styleElementId, previewDevice);
      updateCanvasElementStyle(selectedElementId, {
        fontFamily: updates.fontFamily ?? currentStyle.fontFamily,
        fontSizePx: updates.fontSizePx ?? currentStyle.fontSizePx,
        fontWeight: updates.bold === undefined ? currentStyle.fontWeight : updates.bold ? 700 : 400,
        italic: updates.italic ?? currentStyle.italic,
        underline: updates.underline ?? currentStyle.underline
      });
      return;
    }
    if (selectedElementId === 'footer:description') {
      const currentStyle = config.canvas.elements[selectedElementId]
        ? resolveHomepageCanvasElementDeviceSettings(config.canvas, selectedElementId, previewDevice)
        : createCanvasStyleSeed(config, selectedElementId, previewDevice);
      updateCanvasElementStyle(selectedElementId, {
        fontFamily: updates.fontFamily ?? currentStyle.fontFamily,
        fontSizePx: updates.fontSizePx ?? currentStyle.fontSizePx,
        fontWeight: updates.bold === undefined ? currentStyle.fontWeight : updates.bold ? 700 : 400,
        italic: updates.italic ?? currentStyle.italic,
        underline: updates.underline ?? currentStyle.underline
      });
      return;
    }
    if (!selectedElementId.startsWith('hero:textBlock:')) return;
    const blockId = selectedElementId.slice('hero:textBlock:'.length);
    const block = config.hero.textBlocks.find((candidate) => candidate.id === blockId);
    if (!block) return;
    updateHeroTextBlock(blockId, {
      responsive: {
        ...block.responsive,
        [previewDevice]: { ...block.responsive[previewDevice], ...updates }
      }
    });
  }

  function duplicateSelectedElement() {
    if (!selectedElementId || selectedElementId.startsWith('section:') || selectedElementId.startsWith('footer:') || selectedElementId.startsWith('categories:')) return;
    const newId = createId(selectedElementId.includes('Button') ? 'hero-button' : 'hero-text');
    updateConfig((current) => {
      const sourceBlockId = selectedElementId.startsWith('hero:textBlock:')
        ? selectedElementId.slice('hero:textBlock:'.length)
        : null;
      const sourceBlock = sourceBlockId ? current.hero.textBlocks.find((block) => block.id === sourceBlockId) : null;
      const sourceKind: HomepageHeroTextBlock['kind'] = sourceBlock?.kind ?? (selectedElementId.toLowerCase().includes('button') ? 'button' : 'text');
      const sourceText = sourceBlock?.text
        ?? (selectedElementId === 'hero:title'
          ? current.hero.title
          : selectedElementId === 'hero:description'
            ? current.hero.description
            : selectedElementId === 'hero:primaryButton'
              ? current.hero.primaryButton.label
              : current.hero.secondaryButton.label);
      const sourceHref = sourceBlock?.href
        ?? (selectedElementId === 'hero:primaryButton'
          ? current.hero.primaryButton.href
          : selectedElementId === 'hero:secondaryButton'
            ? current.hero.secondaryButton.href
            : '');
      const defaults = {
        xPx: 260,
        yPx: Math.min(current.hero.responsive.desktop.heightPx - 160, 390),
        widthPx: sourceBlock?.responsive.desktop.widthPx ?? 360,
        fontFamily: sourceBlock?.responsive.desktop.fontFamily ?? current.hero.responsive.desktop.titleFontFamily,
        fontSizePx: sourceBlock?.responsive.desktop.fontSizePx ?? (sourceKind === 'button' ? 15 : 24),
        bold: sourceBlock?.responsive.desktop.bold ?? sourceKind === 'button',
        italic: sourceBlock?.responsive.desktop.italic ?? false,
        underline: sourceBlock?.responsive.desktop.underline ?? false
      };
      const cloneBlock: HomepageHeroTextBlock = sourceBlock
        ? {
            ...cloneConfig(sourceBlock),
            id: newId,
            responsive: {
              desktop: { ...sourceBlock.responsive.desktop, xPx: sourceBlock.responsive.desktop.xPx + 16, yPx: sourceBlock.responsive.desktop.yPx + 16 },
              tablet: { ...sourceBlock.responsive.tablet, xPx: sourceBlock.responsive.tablet.xPx + 16, yPx: sourceBlock.responsive.tablet.yPx + 16 },
              mobile: { ...sourceBlock.responsive.mobile, xPx: sourceBlock.responsive.mobile.xPx + 12, yPx: sourceBlock.responsive.mobile.yPx + 12 }
            }
          }
        : {
            id: newId,
            kind: sourceKind,
            text: sourceText || (sourceKind === 'button' ? 'Nov gumb' : 'Novo besedilo'),
            visible: true,
            href: sourceHref || (sourceKind === 'button' ? '#' : ''),
            ...defaults,
            responsive: {
              desktop: defaults,
              tablet: { ...defaults, xPx: 120, yPx: 280, widthPx: Math.min(defaults.widthPx, 320), fontSizePx: Math.min(defaults.fontSizePx, 22) },
              mobile: { ...defaults, xPx: 24, yPx: 260, widthPx: Math.min(defaults.widthPx, 300), fontSizePx: Math.min(defaults.fontSizePx, 18) }
            }
          };
      const sourceCanvas = current.canvas.elements[selectedElementId];
      const nextElements = sourceCanvas
        ? { ...current.canvas.elements, [`hero:textBlock:${newId}`]: cloneConfig(sourceCanvas) }
        : current.canvas.elements;
      return {
        ...current,
        hero: { ...current.hero, textBlocks: [...current.hero.textBlocks, cloneBlock] },
        canvas: { ...current.canvas, elements: nextElements }
      };
    });
    setSelectedElementId(`hero:textBlock:${newId}`);
  }

  function deleteSelectedElement() {
    if (!selectedElementId) return;
    if (selectedElementId.startsWith('categories:image:')) {
      removeCategoryImage(selectedElementId.slice('categories:image:'.length));
      setSelectedElementId(null);
      setActiveToolbarPopover(null);
      return;
    }
    if (selectedElementId.startsWith('section:')) {
      deleteSection(selectedElementId.slice('section:'.length) as HomepageSectionId);
      return;
    }
    if (!isDeletableHomepageCanvasElementId(selectedElementId)) return;
    updateConfig((current) => removeDeletableHomepageCanvasElement(current, selectedElementId));
    setSelectedElementId(null);
    setActiveToolbarPopover(null);
  }

  function selectedElementLink() {
    if (selectedElementId === 'hero:primaryButton') return config.hero.primaryButton.href;
    if (selectedElementId === 'hero:secondaryButton') return config.hero.secondaryButton.href;
    if (selectedElementId?.startsWith('hero:textBlock:')) {
      return config.hero.textBlocks.find((block) => block.id === selectedElementId.slice('hero:textBlock:'.length))?.href ?? '';
    }
    if (selectedElementId === 'categories:showAll') return config.categories.showAllHref;
    return '';
  }

  function updateSelectedElementLink(href: string) {
    if (selectedElementId === 'hero:primaryButton') updateHero({ primaryButton: { ...config.hero.primaryButton, href } });
    else if (selectedElementId === 'hero:secondaryButton') updateHero({ secondaryButton: { ...config.hero.secondaryButton, href } });
    else if (selectedElementId?.startsWith('hero:textBlock:')) updateHeroTextBlock(selectedElementId.slice('hero:textBlock:'.length), { href });
    else if (selectedElementId === 'categories:showAll') updateCategories({ showAllHref: href });
  }

  function restoreHiddenElement(elementId: string) {
    if (elementId.startsWith('section:')) {
      const sectionId = elementId.slice('section:'.length) as HomepageSectionId;
      if (!isSectionVisible(sectionId)) {
        updateConfig((current) => {
          const responsive = Object.fromEntries(HOMEPAGE_PREVIEW_DEVICES.map((device) => [
            device,
            {
              ...(current.canvas.elements[elementId]?.responsive[device]
                ?? createCanvasStyleSeed(current, elementId, device)),
              visible: device === previewDevice
            }
          ])) as HomepageSettings['canvas']['elements'][string]['responsive'];
          const globallyVisible = withSectionVisibility(current, sectionId, true);
          return {
            ...globallyVisible,
            canvas: {
              ...globallyVisible.canvas,
              elements: {
                ...globallyVisible.canvas.elements,
                [elementId]: { ...responsive.desktop, responsive }
              }
            }
          };
        });
        return;
      }
      updateCanvasElementStyle(elementId, { visible: true });
      return;
    }

    if (elementId.startsWith('hero:textBlock:')) {
      const blockId = elementId.slice('hero:textBlock:'.length);
      const block = config.hero.textBlocks.find((candidate) => candidate.id === blockId);
      if (block && !block.visible) {
        updateConfig((current) => {
          const responsive = Object.fromEntries(HOMEPAGE_PREVIEW_DEVICES.map((device) => [
            device,
            {
              ...(current.canvas.elements[elementId]?.responsive[device]
                ?? createCanvasStyleSeed(current, elementId, device)),
              visible: device === previewDevice
            }
          ])) as HomepageSettings['canvas']['elements'][string]['responsive'];
          return {
            ...current,
            hero: {
              ...current.hero,
              textBlocks: current.hero.textBlocks.map((candidate) => (
                candidate.id === blockId ? { ...candidate, visible: true } : candidate
              ))
            },
            canvas: {
              ...current.canvas,
              elements: {
                ...current.canvas.elements,
                [elementId]: { ...responsive.desktop, responsive }
              }
            }
          };
        });
        return;
      }
    }

    updateCanvasElementStyle(elementId, { visible: true });
  }

  function toggleSelectedVisibility() {
    if (!selectedElementId) return;
    if (selectedElementId.startsWith('section:')) {
      const sectionId = selectedElementId.slice('section:'.length) as HomepageSectionId;
      if (!isSectionVisible(sectionId)) {
        updateConfig((current) => {
          const responsive = Object.fromEntries(HOMEPAGE_PREVIEW_DEVICES.map((device) => [
            device,
            {
              ...(current.canvas.elements[selectedElementId]?.responsive[device]
                ?? createCanvasStyleSeed(current, selectedElementId, device)),
              visible: device === previewDevice
            }
          ])) as HomepageSettings['canvas']['elements'][string]['responsive'];
          const globallyVisible = withSectionVisibility(current, sectionId, true);
          return {
            ...globallyVisible,
            canvas: {
              ...globallyVisible.canvas,
              elements: {
                ...globallyVisible.canvas.elements,
                [selectedElementId]: { ...responsive.desktop, responsive }
              }
            }
          };
        });
        return;
      }
      updateCanvasElementStyle(selectedElementId, { visible: !selectedEffectiveVisible });
      return;
    }
    if (selectedTextBlock && !selectedTextBlock.visible) {
      updateConfig((current) => {
        const responsive = Object.fromEntries(HOMEPAGE_PREVIEW_DEVICES.map((device) => [
          device,
          {
            ...(current.canvas.elements[selectedElementId]?.responsive[device]
              ?? createCanvasStyleSeed(current, selectedElementId, device)),
            visible: device === previewDevice
          }
        ])) as HomepageSettings['canvas']['elements'][string]['responsive'];
        return {
          ...current,
          hero: {
            ...current.hero,
            textBlocks: current.hero.textBlocks.map((block) => block.id === selectedTextBlock.id ? { ...block, visible: true } : block)
          },
          canvas: {
            ...current.canvas,
            elements: {
              ...current.canvas.elements,
              [selectedElementId]: { ...responsive.desktop, responsive }
            }
          }
        };
      });
      return;
    }
    updateCanvasElementStyle(selectedElementId, { visible: !selectedEffectiveVisible });
  }

  function toggleToolbarPopover(popover: Exclude<ToolbarPopover, null>, host: HomepageToolbarHost) {
    const shouldClose = activeToolbarPopover === popover && activeToolbarHost === host;
    setActiveToolbarHost(shouldClose ? null : host);
    setActiveToolbarPopover(shouldClose ? null : popover);
  }

  async function save() {
    if (saveInFlightRef.current || uploadingSlideId !== null) return;
    const payloadConfig = normalizeLandingPageConfig(configWithPendingEdits);
    const submittedConfigKey = comparable(payloadConfig);
    const submittedFooterDescription = footerDescription;
    if (renamingSectionId && landingIsDirty) {
      setConfig(payloadConfig);
      setRenamingSectionId(null);
      setSectionRenameValue('');
    }
    saveInFlightRef.current = true;
    setIsSaving(true);
    try {
      if (landingIsDirty) {
        const response = await fetch('/api/admin/landing-page', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ config: payloadConfig })
        });
        const body = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(typeof body.message === 'string' ? body.message : 'Shranjevanje glavne strani ni uspelo.');
        }
        const persistedConfig = normalizeLandingPageConfig(body.config ?? payloadConfig);
        appliedInitialConfigKeyRef.current = comparable(persistedConfig);
        setSavedConfig(persistedConfig);
        setConfig((current) => {
          if (comparable(current) === submittedConfigKey) return persistedConfig;
          return normalizeLandingPageConfig({ ...current, updatedAt: persistedConfig.updatedAt });
        });
      }

      if (categoryPresentationIsDirty) await categoryShowcaseEditor.save();

      if (footerDescriptionIsDirty) {
        const response = await fetch('/api/admin/site-navigation', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ footer: { description: submittedFooterDescription } })
        });
        const body = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(typeof body.message === 'string' ? body.message : 'Shranjevanje opisa noge ni uspelo.');
        }
        const persistedNavigation = normalizeSiteNavigationConfig(body.config ?? previewNavigation);
        const persistedDescription = persistedNavigation.footer.description;
        appliedInitialFooterDescriptionRef.current = persistedDescription;
        setSavedFooterDescription(persistedDescription);
        setFooterDescription((current) => current === submittedFooterDescription ? persistedDescription : current);
      }

      toast.success('Spremembe glavne strani so shranjene.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Shranjevanje glavne strani ni uspelo.');
    } finally {
      saveInFlightRef.current = false;
      setIsSaving(false);
    }
  }

  async function setCurrentConfigAsDefaults() {
    if (saveInFlightRef.current || uploadingSlideId !== null) return;
    const payloadConfig = normalizeLandingPageConfig(configWithPendingEdits);
    const submittedConfigKey = comparable(payloadConfig);
    if (renamingSectionId && landingIsDirty) {
      setConfig(payloadConfig);
      setRenamingSectionId(null);
      setSectionRenameValue('');
    }
    saveInFlightRef.current = true;
    setIsSaving(true);
    try {
      const response = await fetch('/api/admin/landing-page/defaults', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          config: payloadConfig,
          expectedUpdatedAt: savedConfig.updatedAt ?? null
        })
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(
          typeof body.message === 'string'
            ? body.message
            : 'Shranjevanje privzetih nastavitev glavne strani ni uspelo.'
        );
      }

      const persistedConfig = normalizeLandingPageConfig(body.config ?? payloadConfig);
      const persistedDefaults = normalizeLandingPageConfig(body.defaults ?? persistedConfig);
      appliedInitialConfigKeyRef.current = comparable(persistedConfig);
      appliedInitialDefaultsKeyRef.current = comparable(persistedDefaults);
      setSavedConfig(persistedConfig);
      setSavedDefaults(persistedDefaults);
      setConfig((current) => {
        if (comparable(current) === submittedConfigKey) return persistedConfig;
        return normalizeLandingPageConfig({ ...current, updatedAt: persistedConfig.updatedAt });
      });
      toast.success('Privzete nastavitve glavne strani so shranjene.');
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : 'Shranjevanje privzetih nastavitev glavne strani ni uspelo.'
      );
    } finally {
      saveInFlightRef.current = false;
      setIsSaving(false);
    }
  }

  function restoreDefaults() {
    if (uploadingSlideId !== null) return;
    if (!window.confirm('Ponastavim glavno stran na shranjene privzete nastavitve?')) return;
    const defaults = normalizeLandingPageConfig(savedDefaults);
    setConfig(defaults);
    setSelectedSectionId(defaults.sectionOrder[0] ?? 'hero');
    setSelectedElementId(null);
    setCategoryTitleEditScope('selected');
    setActiveToolbarPopover(null);
  }

  const categoryRows = useMemo(() => {
    return orderHomepageCategories(categoryShowcaseEditor.items, config.categories);
  }, [categoryShowcaseEditor.items, config.categories]);

  const sectionVisibilitySummary = HOMEPAGE_SECTION_IDS
    .map((sectionId) => `${getSectionLabel(sectionId)}: ${isSectionVisible(sectionId) ? 'vidno' : 'skrito'}`)
    .join(' · ');

  const selectedViewLabel = homepagePreviewDeviceLabels[previewDevice];
  const heroViewSettings = config.hero.responsive[previewDevice];
  const categoryViewSettings = config.categories.responsive[previewDevice];
  const infoViewSettings = config.infoBlocks.responsive[previewDevice];
  const footerViewSettings = config.footer.responsive[previewDevice];
  const pageViewSettings = config.page.responsive[previewDevice];
  const editorOptions = editorOptionsByDevice[previewDevice];
  const selectedIsCategoryTitle = isCategoryTitleCanvasElement(selectedElementId);
  const selectedCanvasStyleElementId = selectedIsCategoryTitle && categoryTitleEditScope === 'all'
    ? HOMEPAGE_CATEGORY_TITLE_SHARED_CANVAS_ELEMENT_ID
    : selectedElementId;
  const selectedCanvasStyle = selectedCanvasStyleElementId
    ? resolveCanvasStyleForDevice(config, config.canvas.elements, selectedCanvasStyleElementId, previewDevice)
    : DEFAULT_HOMEPAGE_CANVAS_ELEMENT_DEVICE_SETTINGS;
  const selectedIsSection = Boolean(selectedElementId?.startsWith('section:'));
  const selectedIsFixedFooterElement = Boolean(selectedElementId?.startsWith('footer:'));
  const selectedIsCategoryElement = Boolean(selectedElementId?.startsWith('categories:'));
  const selectedCategoryMediaSlug = selectedElementId?.startsWith('categories:image:')
    ? selectedElementId.slice('categories:image:'.length)
    : null;
  const selectedCategoryMediaItem = selectedCategoryMediaSlug
    ? categoryShowcaseEditor.items.find((category) => category.slug === selectedCategoryMediaSlug) ?? null
    : null;
  const selectedCategoryTitleSlug = selectedIsCategoryTitle && selectedElementId
    ? selectedElementId.slice(categoryTitleCanvasElementPrefix.length)
    : null;
  const selectedCategoryTitleItem = selectedCategoryTitleSlug
    ? categoryShowcaseEditor.items.find((category) => category.slug === selectedCategoryTitleSlug) ?? null
    : null;
  const selectedIsCategoryText = selectedElementId === 'categories:heading'
    || selectedElementId === 'categories:subtitle'
    || selectedElementId === 'categories:showAll'
    || selectedIsCategoryTitle;
  const selectedTextBlockId = selectedElementId?.startsWith('hero:textBlock:')
    ? selectedElementId.slice('hero:textBlock:'.length)
    : null;
  const selectedTextBlock = selectedTextBlockId
    ? config.hero.textBlocks.find((block) => block.id === selectedTextBlockId) ?? null
    : null;
  const selectedIsButton = selectedElementId === 'hero:primaryButton'
    || selectedElementId === 'hero:secondaryButton'
    || selectedTextBlock?.kind === 'button';
  const selectedIsText = selectedElementId === 'hero:title'
    || selectedElementId === 'hero:description'
    || selectedElementId === 'footer:description'
    || selectedIsCategoryText
    || Boolean(selectedTextBlock);
  const selectedCanLink = selectedIsButton || Boolean(selectedTextBlock) || selectedElementId === 'categories:showAll';
  const selectedCanDelete = isDeletableHomepageCanvasElementId(selectedElementId);
  const selectedSectionElementId = selectedIsSection
    ? selectedElementId?.slice('section:'.length) as HomepageSectionId
    : null;
  const selectedEffectiveVisible = selectedSectionElementId
    ? isSectionVisible(selectedSectionElementId) && selectedCanvasStyle.visible
    : selectedTextBlock
      ? selectedTextBlock.visible && selectedCanvasStyle.visible
      : selectedCanvasStyle.visible;
  const selectedElementLabel = !selectedElementId
    ? 'Stran'
    : selectedElementId.startsWith('section:')
      ? getSectionLabel(selectedElementId.slice('section:'.length) as HomepageSectionId)
      : selectedElementId === 'hero:title'
        ? 'Naslov'
        : selectedElementId === 'hero:description'
          ? 'Opis'
          : selectedElementId === 'footer:logo'
            ? 'Logotip noge'
          : selectedElementId === 'footer:description'
              ? 'Opis noge'
          : selectedElementId === 'categories:heading'
            ? 'Naslov kategorij'
            : selectedElementId === 'categories:subtitle'
              ? 'Podnaslov kategorij'
              : selectedElementId === 'categories:showAll'
                ? 'Povezava do vseh kategorij'
                : selectedElementId.startsWith('categories:title:')
                  ? categories.find((category) => category.slug === selectedElementId.slice('categories:title:'.length))?.title || 'Naslov kategorije'
                  : selectedElementId.startsWith('categories:image:')
                    ? `Slika · ${categories.find((category) => category.slug === selectedElementId.slice('categories:image:'.length))?.title || 'Kategorija'}`
                    : selectedElementId.startsWith('categories:card:')
                      ? `Kartica · ${categories.find((category) => category.slug === selectedElementId.slice('categories:card:'.length))?.title || 'Kategorija'}`
          : selectedElementId === 'hero:primaryButton'
            ? 'Primarni gumb'
            : selectedElementId === 'hero:secondaryButton'
              ? 'Sekundarni gumb'
              : selectedTextBlock?.kind === 'button'
                ? selectedTextBlock.text || 'Gumb'
                : selectedTextBlock?.text || 'Besedilo';
  const selectedEditTargetLabel = selectedIsCategoryTitle && categoryTitleEditScope === 'all'
    ? 'Vsa imena kategorij'
    : selectedElementLabel;
  const selectedTypography = selectedElementId === 'hero:title'
    ? {
        fontFamily: heroViewSettings.titleFontFamily,
        fontSizePx: heroViewSettings.titleFontSizePx,
        bold: heroViewSettings.titleBold,
        italic: heroViewSettings.titleItalic,
        underline: heroViewSettings.titleUnderline
      }
    : selectedElementId === 'hero:description'
      ? {
          fontFamily: heroViewSettings.descriptionFontFamily,
          fontSizePx: heroViewSettings.descriptionFontSizePx,
          bold: heroViewSettings.descriptionBold,
          italic: heroViewSettings.descriptionItalic,
          underline: heroViewSettings.descriptionUnderline
        }
      : selectedTextBlock
        ? {
            fontFamily: selectedTextBlock.responsive[previewDevice].fontFamily,
            fontSizePx: selectedTextBlock.responsive[previewDevice].fontSizePx,
            bold: selectedTextBlock.responsive[previewDevice].bold,
            italic: selectedTextBlock.responsive[previewDevice].italic,
            underline: selectedTextBlock.responsive[previewDevice].underline
          }
        : selectedElementId === 'footer:description'
          ? {
              fontFamily: selectedCanvasStyle.fontFamily as HomepageHeroFontFamily,
              fontSizePx: selectedCanvasStyle.fontSizePx,
              bold: selectedCanvasStyle.fontWeight >= 600,
              italic: selectedCanvasStyle.italic,
              underline: selectedCanvasStyle.underline
            }
        : selectedIsCategoryText
          ? {
              fontFamily: selectedCanvasStyle.fontFamily as HomepageHeroFontFamily,
              fontSizePx: selectedCanvasStyle.fontSizePx,
              bold: selectedCanvasStyle.fontWeight >= 600,
              italic: selectedCanvasStyle.italic,
              underline: selectedCanvasStyle.underline
            }
        : null;
  const selectedPosition = selectedTextBlock
    ? {
        xPx: selectedTextBlock.responsive[previewDevice].xPx,
        yPx: selectedTextBlock.responsive[previewDevice].yPx
      }
    : selectedElementId === 'hero:title'
      ? { xPx: heroViewSettings.titleOffsetXPx, yPx: heroViewSettings.titleOffsetYPx }
      : selectedElementId === 'hero:description'
        ? { xPx: heroViewSettings.descriptionOffsetXPx, yPx: heroViewSettings.descriptionOffsetYPx }
        : selectedElementId === 'hero:primaryButton'
          ? { xPx: heroViewSettings.primaryButtonOffsetXPx, yPx: heroViewSettings.primaryButtonOffsetYPx }
          : selectedElementId === 'hero:secondaryButton'
            ? { xPx: heroViewSettings.secondaryButtonOffsetXPx, yPx: heroViewSettings.secondaryButtonOffsetYPx }
            : selectedElementId?.startsWith('footer:') || selectedElementId?.startsWith('categories:')
              ? { xPx: selectedCanvasStyle.offsetXPx, yPx: selectedCanvasStyle.offsetYPx }
            : null;

  function updateSelectedPosition(updates: Partial<{ xPx: number; yPx: number }>) {
    if (selectedTextBlock) {
      updateHeroTextBlock(selectedTextBlock.id, {
        responsive: {
          ...selectedTextBlock.responsive,
          [previewDevice]: {
            ...selectedTextBlock.responsive[previewDevice],
            ...updates
          }
        }
      });
      return;
    }
    if (selectedElementId === 'hero:title') {
      updateHeroView({
        ...(updates.xPx !== undefined ? { titleOffsetXPx: updates.xPx } : {}),
        ...(updates.yPx !== undefined ? { titleOffsetYPx: updates.yPx } : {})
      });
    } else if (selectedElementId === 'hero:description') {
      updateHeroView({
        ...(updates.xPx !== undefined ? { descriptionOffsetXPx: updates.xPx } : {}),
        ...(updates.yPx !== undefined ? { descriptionOffsetYPx: updates.yPx } : {})
      });
    } else if (selectedElementId === 'hero:primaryButton') {
      updateHeroView({
        ...(updates.xPx !== undefined ? { primaryButtonOffsetXPx: updates.xPx } : {}),
        ...(updates.yPx !== undefined ? { primaryButtonOffsetYPx: updates.yPx } : {})
      });
    } else if (selectedElementId === 'hero:secondaryButton') {
      updateHeroView({
        ...(updates.xPx !== undefined ? { secondaryButtonOffsetXPx: updates.xPx } : {}),
        ...(updates.yPx !== undefined ? { secondaryButtonOffsetYPx: updates.yPx } : {})
      });
    } else if (selectedElementId?.startsWith('footer:') || selectedElementId?.startsWith('categories:')) {
      updateCanvasElementStyle(selectedElementId, {
        ...(updates.xPx !== undefined ? { offsetXPx: updates.xPx } : {}),
        ...(updates.yPx !== undefined ? { offsetYPx: updates.yPx } : {})
      });
    }
  }

  function renderHeroCarouselSettings() {
    const uploadInProgress = uploadingSlideId !== null;
    const readySlideCount = config.hero.slides.filter((slide) => slide.src.trim()).length;
    const canAddSlide = config.hero.slides.length < MAX_HOMEPAGE_HERO_SLIDES;

    return (
      <div
        className="space-y-2"
        data-testid="homepage-hero-carousel-settings"
        data-carousel-media-count={readySlideCount}
        data-carousel-uploading={uploadInProgress ? 'true' : 'false'}
      >
        <div className="flex min-w-0 items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="text-[12px] font-semibold text-[color:var(--homepage-inspector-strong,#1e293b)]">Mediji</p>
            <p className="text-[11px] leading-4 text-[color:var(--homepage-inspector-muted,#64748b)]">
              {config.hero.slides.length} / {MAX_HOMEPAGE_HERO_SLIDES} · povlecite ali uporabite puščice za vrstni red
            </p>
          </div>
          <input
            ref={addHeroSlideInputRef}
            type="file"
            accept="image/*,video/*"
            className="hidden"
            data-testid="homepage-hero-carousel-add-input"
            disabled={uploadInProgress || !canAddSlide}
            onChange={(event: ChangeEvent<HTMLInputElement>) => {
              const file = event.target.files?.[0];
              event.target.value = '';
              if (file) uploadNewSlideMedia(file);
            }}
          />
          <Button
            type="button"
            variant="primary"
            size="toolbar"
            className={`${adminTablePrimaryButtonClassName} !h-8 shrink-0 !px-2.5`}
            onClick={() => addHeroSlideInputRef.current?.click()}
            disabled={uploadInProgress || !canAddSlide}
            data-testid="homepage-hero-carousel-add"
          >
            <Plus className="h-4 w-4" />
            Dodaj medij
          </Button>
        </div>

        <DndContext id="homepage-hero-slides" sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleSlideDragEnd}>
          <SortableContext items={config.hero.slides.map((slide) => slide.id)} strategy={verticalListSortingStrategy}>
            <div className="grid gap-1.5" data-testid="homepage-hero-carousel-slide-list">
              {config.hero.slides.map((slide, index) => (
                <SortableSlideEditor
                  key={slide.id}
                  slide={slide}
                  index={index}
                  uploading={uploadingSlideId === slide.id}
                  controlsDisabled={uploadInProgress}
                  canMoveUp={index > 0}
                  canMoveDown={index < config.hero.slides.length - 1}
                  onChange={(updates) => updateSlide(slide.id, updates)}
                  onDelete={() => deleteSlide(slide.id)}
                  onMoveUp={() => moveSlide(slide.id, -1)}
                  onMoveDown={() => moveSlide(slide.id, 1)}
                  onUpload={(file) => void uploadSlideMedia(slide.id, file)}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>

        <div className="space-y-1.5 border-t border-[color:var(--homepage-inspector-divider,#e2e8f0)] pt-2">
          <div className="grid gap-1.5 sm:grid-cols-[112px_minmax(0,1fr)] sm:items-center">
            <span className="text-[11px] font-medium text-[color:var(--homepage-inspector-muted,#475569)]">Način menjave</span>
            <div
              className="grid grid-cols-2 rounded-lg bg-[color:var(--homepage-inspector-control-bg,#f1f5f9)] p-0.5"
              role="group"
              aria-label="Način menjave diapozitivov"
              data-testid="homepage-hero-carousel-mode"
            >
              <button
                type="button"
                aria-pressed={!config.hero.autoplay}
                className={classNames(
                  `h-7 rounded-md px-2 text-[11px] font-semibold transition ${adminControlFocusTokenClasses}`,
                  !config.hero.autoplay
                    ? 'bg-[color:var(--homepage-inspector-selected-bg,#ffffff)] text-[color:var(--homepage-inspector-selected-text,#2563eb)] shadow-sm'
                    : 'text-[color:var(--homepage-inspector-muted,#64748b)] hover:text-[color:var(--homepage-inspector-strong,#1e293b)]'
                )}
                onClick={() => updateHero({ autoplay: false })}
                data-testid="homepage-hero-carousel-mode-manual"
              >
                Ročno
              </button>
              <button
                type="button"
                aria-pressed={config.hero.autoplay}
                className={classNames(
                  `h-7 rounded-md px-2 text-[11px] font-semibold transition ${adminControlFocusTokenClasses}`,
                  config.hero.autoplay
                    ? 'bg-[color:var(--homepage-inspector-selected-bg,#ffffff)] text-[color:var(--homepage-inspector-selected-text,#2563eb)] shadow-sm'
                    : 'text-[color:var(--homepage-inspector-muted,#64748b)] hover:text-[color:var(--homepage-inspector-strong,#1e293b)]'
                )}
                onClick={() => updateHero({ autoplay: true })}
                data-testid="homepage-hero-carousel-mode-autoplay"
              >
                Samodejno
              </button>
            </div>
          </div>

          {config.hero.autoplay ? (
            <div data-testid="homepage-hero-carousel-interval">
              <NumberField
                label="Čas menjave"
                value={config.hero.autoplayInterval / 1000}
                onChange={(seconds) => updateHero({ autoplayInterval: Math.round(seconds * 1000) })}
                min={1.5}
                max={30}
                step={0.5}
                suffix="s"
                inputAriaLabel="Čas menjave"
              />
            </div>
          ) : null}

          <div className="grid gap-1 sm:grid-cols-2">
            <ToggleRow label="Puščice" checked={config.hero.showArrows} onChange={(showArrows) => updateHero({ showArrows })} />
            <ToggleRow label="Navigacijske pike" checked={config.hero.showDots} onChange={(showDots) => updateHero({ showDots })} />
          </div>
          <p className="rounded-md bg-[color:var(--homepage-inspector-subsurface,#f8fafc)] px-2 py-1.5 text-[10px] leading-3.5 text-[color:var(--homepage-inspector-muted,#64748b)]" data-testid="homepage-hero-carousel-multiple-media-hint">
            Puščice in pike se prikažejo, ko sta dodana najmanj dva veljavna medija.
          </p>
        </div>
      </div>
    );
  }

  function renderHeroSettings() {
    return (
      <div className="space-y-2">
        <FieldBlock title="Tekst in gumbi">
          <TextField label="Naslov" value={config.hero.title} onChange={(title) => updateHero({ title })} />
          <TextareaField label="Opis" value={config.hero.description} onChange={(description) => updateHero({ description })} />
          <div className="grid gap-2 sm:grid-cols-2">
            <TextField label="Primarni gumb" value={config.hero.primaryButton.label} onChange={(label) => updateHero({ primaryButton: { ...config.hero.primaryButton, label } })} />
            <TextField label="Povezava" value={config.hero.primaryButton.href} onChange={(href) => updateHero({ primaryButton: { ...config.hero.primaryButton, href } })} />
            <TextField label="Sekundarni gumb" value={config.hero.secondaryButton.label} onChange={(label) => updateHero({ secondaryButton: { ...config.hero.secondaryButton, label } })} />
            <TextField label="Povezava" value={config.hero.secondaryButton.href} onChange={(href) => updateHero({ secondaryButton: { ...config.hero.secondaryButton, href } })} />
          </div>
        </FieldBlock>

        <FieldBlock title="Postavitev in ozadje" defaultOpen={false}>
          <div className="space-y-2">
            <p className="text-[11px] font-medium text-[color:var(--homepage-inspector-muted,#64748b)]">Nastavitve postavitve za pogled: {selectedViewLabel}</p>
            <div className="grid gap-2 sm:grid-cols-2">
              <NumberField label="Višina sekcije" value={heroViewSettings.heightPx} onChange={(heightPx) => updateHeroView({ heightPx })} min={280} max={900} step={10} suffix="px" />
              <NumberField label="Odmik besedila X" value={heroViewSettings.contentOffsetXPx} onChange={(contentOffsetXPx) => updateHeroView({ contentOffsetXPx })} min={0} max={1400} step={10} suffix="px" />
              <NumberField label="Odmik besedila Y" value={heroViewSettings.contentOffsetYPx} onChange={(contentOffsetYPx) => updateHeroView({ contentOffsetYPx })} min={-450} max={450} step={10} suffix="px" />
              <NumberField label="Širina besedila" value={heroViewSettings.textWidthPx} onChange={(textWidthPx) => updateHeroView({ textWidthPx })} min={260} max={1200} step={10} suffix="px" />
              <NumberField label="Širina medija" value={heroViewSettings.mediaWidthPercent} onChange={(mediaWidthPercent) => updateHeroView({ mediaWidthPercent })} min={50} max={160} step={5} suffix="%" />
              <NumberField label="Zatemnitev" value={heroViewSettings.overlayStrength} onChange={(overlayStrength) => updateHeroView({ overlayStrength })} min={0} max={85} suffix="%" />
            </div>
            <div className="grid gap-2">
              <ToggleRow label="Zatemni ozadje za berljivost" checked={config.hero.darkenBackground} onChange={(darkenBackground) => updateHero({ darkenBackground })} />
            </div>
          </div>
        </FieldBlock>
      </div>
    );
  }

  function renderCategorySettings() {
    return (
      <div className="space-y-2">
        <FieldBlock title="Postavitev in kartice">
          <p className="text-[11px] font-medium text-[color:var(--homepage-inspector-muted,#64748b)]">Nastavitve postavitve za pogled: {selectedViewLabel}</p>
          <div className="grid gap-2 sm:grid-cols-2">
            <NumberField label="Število prikazanih" value={categoryViewSettings.limit} onChange={(limit) => updateCategoriesView({ limit })} min={1} max={24} />
            <NumberField label="Stolpci" value={categoryViewSettings.columns} onChange={(columns) => updateCategoriesView({ columns })} min={1} max={6} />
            <NumberField label="Razmik" value={categoryViewSettings.gap} onChange={(gap) => updateCategoriesView({ gap })} min={0} max={48} suffix="px" />
            <SelectField label="Širina" value={categoryViewSettings.containerWidth} options={createOptions(HOMEPAGE_CONTAINER_WIDTHS, homepageContainerWidthLabels)} onChange={(containerWidth) => updateCategoriesView({ containerWidth })} />
            <SelectField label="Velikost kartic" value={categoryViewSettings.cardSize} options={createOptions(HOMEPAGE_CATEGORY_CARD_SIZES, homepageCategoryCardSizeLabels)} onChange={(cardSize) => updateCategoriesView({ cardSize })} />
            <SelectField label="Slog kartic" value={categoryViewSettings.cardStyle} options={createOptions(HOMEPAGE_CATEGORY_CARD_STYLES, homepageCategoryCardStyleLabels)} onChange={(cardStyle) => updateCategoriesView({ cardStyle })} />
          </div>
          <ToggleRow label="Povezava do vseh kategorij" checked={config.categories.showAllLink} onChange={(showAllLink) => updateCategories({ showAllLink })} />
          <ToggleRow label="Puščica v karticah" checked={categoryViewSettings.showCardArrow} onChange={(showCardArrow) => updateCategoriesView({ showCardArrow })} />
        </FieldBlock>

        <FieldBlock title="Vrstni red kategorij" defaultOpen={false}>
          <SelectField
            label="Vir vrstnega reda"
            value={config.categories.categoryOrderMode}
            options={createOptions(HOMEPAGE_CATEGORY_ORDER_MODES, homepageCategoryOrderModeLabels)}
            onChange={updateCategoryOrderMode}
          />
          {config.categories.categoryOrderMode === 'catalog' ? (
            <p className="rounded-lg bg-[color:var(--homepage-inspector-subsurface,#f8fafc)] px-3 py-2 text-[11px] leading-4 text-[color:var(--homepage-inspector-muted,#64748b)]">
              Kategorije sledijo kanoničnemu vrstnemu redu iz Kategorij oziroma Millerjevega pogleda. Povlek kategorije v predogledu samodejno vključi vrstni red po meri.
            </p>
          ) : (
            <>
              <p className="text-[11px] leading-4 text-[color:var(--homepage-inspector-muted,#64748b)]">Povlecite kategorije v želeni vrstni red. Nove kategorije se samodejno dodajo na konec.</p>
              <DndContext id="homepage-category-order" sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleCategoryDragEnd}>
                <SortableContext items={categoryRows.map((category) => category.slug)} strategy={verticalListSortingStrategy}>
                  <div className="grid gap-2">
                    {categoryRows.map((category, index) => (
                      <SortableCategoryRow key={category.slug} category={category} index={index} />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
            </>
          )}
        </FieldBlock>
      </div>
    );
  }

  function renderInfoSettings() {
    return (
      <div className="space-y-2">
        <FieldBlock title="Prikazne nastavitve">
          <p className="text-[11px] font-medium text-[color:var(--homepage-inspector-muted,#64748b)]">Nastavitve postavitve za pogled: {selectedViewLabel}</p>
          <div className="grid gap-2 sm:grid-cols-2">
            <NumberField label="Število elementov" value={config.infoBlocks.items.length} onChange={setInfoItemCount} min={1} max={12} />
            <NumberField label="Stolpci" value={infoViewSettings.columns} onChange={(columns) => updateInfoBlocksView({ columns })} min={1} max={6} />
            <NumberField label="Razmik" value={infoViewSettings.gap} onChange={(gap) => updateInfoBlocksView({ gap })} min={0} max={48} suffix="px" />
            <SelectField label="Slog" value={infoViewSettings.style} options={createOptions(HOMEPAGE_INFO_STYLES, homepageInfoStyleLabels)} onChange={(style) => updateInfoBlocksView({ style })} />
            <SelectField label="Pozicija ikon" value={infoViewSettings.iconPosition} options={createOptions(HOMEPAGE_INFO_ICON_POSITIONS, homepageInfoIconPositionLabels)} onChange={(iconPosition) => updateInfoBlocksView({ iconPosition })} />
            <div className={inspectorFieldRowClassName} data-homepage-compact-setting="Poravnava">
              <span className={labelClassName}>Poravnava</span>
              <AppearanceEditorAlignmentControl
                value={infoViewSettings.alignment}
                options={['left', 'center'] as const}
                ariaLabel="Poravnava informacijskih elementov"
                onValueChange={(alignment) => updateInfoBlocksView({ alignment })}
              />
            </div>
          </div>
          <ToggleRow label="Ločilne črte" checked={infoViewSettings.dividers} onChange={(dividers) => updateInfoBlocksView({ dividers })} />
        </FieldBlock>

        <FieldBlock title="Elementi" defaultOpen={false}>
          <div className="flex justify-end">
            <Button type="button" variant="primary" size="toolbar" className={`${adminTablePrimaryButtonClassName} !h-8 !px-2.5`} onClick={addInfoItem}>
              <Plus className="h-4 w-4" />
              Dodaj
            </Button>
          </div>
          <div className="grid gap-2">
            {config.infoBlocks.items.map((item, index) => (
              <div key={item.id} className="rounded-lg bg-[color:var(--homepage-inspector-subsurface,#f8fafc)] p-2">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <span className="text-[12px] font-semibold text-[color:var(--homepage-inspector-strong,#1e293b)]">Element {index + 1}</span>
                  <SmallIconButton label="Odstrani element" tone="danger" onClick={() => deleteInfoItem(item.id)}>
                    <Trash2 className="h-4 w-4" />
                  </SmallIconButton>
                </div>
                <div className="grid gap-2">
                  <SelectField label="Ikona" value={item.icon} options={createOptions(HOMEPAGE_INFO_ICONS, homepageInfoIconLabels)} onChange={(icon) => updateInfoItem(item.id, { icon })} />
                  <TextField label="Naslov" value={item.title} onChange={(title) => updateInfoItem(item.id, { title })} />
                  <TextareaField label="Kratek opis" value={item.description} onChange={(description) => updateInfoItem(item.id, { description })} />
                  <TextField label="Povezava" value={item.href} onChange={(href) => updateInfoItem(item.id, { href })} placeholder="Neobvezno" />
                </div>
              </div>
            ))}
          </div>
        </FieldBlock>
      </div>
    );
  }

  function renderFooterSettings() {
    return (
      <div className="space-y-2">
        <FieldBlock title="Prikaz noge">
          <p className="rounded-lg bg-[color:var(--homepage-inspector-subsurface,#f8fafc)] px-2.5 py-2 text-[11px] leading-5 text-[color:var(--homepage-inspector-muted,#475569)]">
            Vsebino noge, povezave in kontaktne podatke urejate v zavihku Navigacija, logotip pa v zavihku Logotip.
          </p>
          <div className="space-y-2 border-t border-[color:var(--homepage-inspector-divider,#e2e8f0)] pt-2">
            <p className="text-[11px] font-medium text-[color:var(--homepage-inspector-muted,#64748b)]">Nastavitve postavitve za pogled: {selectedViewLabel}</p>
            <div className="grid gap-2 sm:grid-cols-2">
              <NumberField label="Stolpci prikaza" value={footerViewSettings.layoutColumns} onChange={(layoutColumns) => updateFooterView({ layoutColumns })} min={1} max={6} />
              <SelectField label="Odmik" value={footerViewSettings.spacing} options={createOptions(HOMEPAGE_FOOTER_SPACINGS, homepageFooterSpacingLabels)} onChange={(spacing) => updateFooterView({ spacing })} />
            </div>
            <ToggleRow label="Zgornja obroba" checked={footerViewSettings.topBorder} onChange={(topBorder) => updateFooterView({ topBorder })} />
          </div>
        </FieldBlock>
      </div>
    );
  }

  function renderSelectedSectionSettings() {
    return (
      <div className="space-y-2">
        {selectedSectionId === 'hero' ? renderHeroSettings() : null}
        {selectedSectionId === 'categories' ? renderCategorySettings() : null}
        {selectedSectionId === 'infoBlocks' ? renderInfoSettings() : null}
        {selectedSectionId === 'footer' ? renderFooterSettings() : null}
      </div>
    );
  }

  function renderPageSettings() {
    return (
      <div className="space-y-2">
        <FieldBlock title="Splošno">
          <div className="grid gap-1">
            <SelectField label="Širina vsebine" value={pageViewSettings.containerWidth} options={createOptions(HOMEPAGE_CONTAINER_WIDTHS, homepageContainerWidthLabels)} onChange={(containerWidth) => updatePageView({ containerWidth })} />
            <SelectField label="Razmik sekcij" value={pageViewSettings.sectionSpacing} options={createOptions(HOMEPAGE_SECTION_SPACINGS, homepageSectionSpacingLabels)} onChange={(sectionSpacing) => updatePageView({ sectionSpacing })} />
            <SelectField label="Zaobljenost" value={pageViewSettings.sectionRadius} options={createOptions(HOMEPAGE_SECTION_RADII, homepageSectionRadiusLabels)} onChange={(sectionRadius) => updatePageView({ sectionRadius })} />
            <SelectField label="Slog gumbov" value={config.page.buttonStyle} options={createOptions(HOMEPAGE_BUTTON_STYLES, homepageButtonStyleLabels)} onChange={(buttonStyle) => updatePage({ buttonStyle })} />
          </div>
          <ColorField label="Barva ozadja" value={config.page.backgroundColor} onChange={(backgroundColor) => updatePage({ backgroundColor })} />
        </FieldBlock>
        <FieldBlock title="Vidnost" defaultOpen={false}>
          <p className="rounded-lg bg-[color:var(--homepage-inspector-subsurface,#f8fafc)] px-2.5 py-2 text-[11px] leading-5 text-[color:var(--homepage-inspector-muted,#475569)]">{sectionVisibilitySummary}</p>
        </FieldBlock>
      </div>
    );
  }

  function renderSectionStructure() {
    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <p className="text-[11px] leading-4 text-[color:var(--homepage-inspector-muted,#64748b)]">Izberi, preimenuj ali prerazporedi sekcije. Izbrano sekcijo lahko premikaš tudi neposredno v predogledu.</p>
          <div ref={addSectionMenuRef} className="relative shrink-0">
            <HomepageToolbarToneContext.Provider value="dark">
              <ToolbarButton label="Dodaj sekcijo" disabled={availableSectionIds.length === 0} active={addSectionMenuOpen} onClick={() => setAddSectionMenuOpen((open) => !open)}>
                <Plus className="h-4 w-4" />
              </ToolbarButton>
            </HomepageToolbarToneContext.Provider>
            {addSectionMenuOpen ? (
              <div className="absolute right-0 top-9 z-30 w-56 overflow-hidden rounded-lg border border-[color:var(--homepage-inspector-input-border,#e2e8f0)] bg-[color:var(--homepage-inspector-subsurface-strong,#ffffff)] p-1 shadow-lg">
                {availableSectionIds.map((sectionId) => (
                  <button key={sectionId} type="button" className={`flex w-full items-center justify-between gap-3 rounded-lg border border-transparent px-2.5 py-2 text-left text-[12px] font-medium text-[color:var(--homepage-inspector-strong,#334155)] transition hover:bg-[color:var(--homepage-inspector-hover,#f8fafc)] ${adminControlFocusTokenClasses}`} onClick={() => addSection(sectionId)}>
                    {resolveHomepageSectionLabel(sectionId, config.sectionTitles)}
                    <Plus className="h-3.5 w-3.5" />
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        </div>
        <DndContext id="homepage-sections-popover" sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleSectionDragEnd}>
          <SortableContext items={sectionIds} strategy={verticalListSortingStrategy}>
            <div className="grid gap-1.5">
              {config.sectionOrder.map((sectionId, index) => (
                <SortableSectionRow
                  key={sectionId}
                  sectionId={sectionId}
                  index={index}
                  label={getSectionLabel(sectionId)}
                  selected={selectedElementId === `section:${sectionId}`}
                  visible={isSectionVisible(sectionId)}
                  canDelete={config.sectionOrder.length > 1}
                  menuOpen={openSectionMenuId === sectionId}
                  renaming={renamingSectionId === sectionId}
                  renameValue={renamingSectionId === sectionId ? sectionRenameValue : getSectionLabel(sectionId)}
                  onSelect={() => selectCanvasElement(`section:${sectionId}`)}
                  onToggleVisibility={() => setSectionVisible(sectionId, !isSectionVisible(sectionId))}
                  onDelete={() => deleteSection(sectionId)}
                  onToggleMenu={() => {
                    setRenamingSectionId(null);
                    setOpenSectionMenuId((current) => current === sectionId ? null : sectionId);
                  }}
                  onStartRename={() => startSectionRename(sectionId)}
                  onRenameValueChange={setSectionRenameValue}
                  onRenameCommit={() => commitSectionRename(sectionId)}
                  onRenameCancel={cancelSectionRename}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      </div>
    );
  }

  function renderCategoryTitleScopeControl() {
    if (!selectedIsCategoryTitle) return null;

    const scopeOptions: Array<{ value: CategoryTitleEditScope; label: string; testId: string }> = [
      { value: 'all', label: 'Vsa imena', testId: 'homepage-category-title-scope-all' },
      { value: 'selected', label: 'Samo izbrano', testId: 'homepage-category-title-scope-selected' }
    ];

    return (
      <div
        className="rounded-xl bg-[color:var(--homepage-inspector-subsurface,#f8fafc)] p-2.5"
        role="group"
        aria-label="Obseg urejanja imen kategorij"
        data-testid="homepage-category-title-scope"
      >
        <div className="mb-2 flex items-center justify-between gap-3">
          <span className="text-[12px] font-semibold text-[color:var(--homepage-inspector-strong,#1e293b)]">Uporabi za</span>
          <span className="text-[11px] font-medium text-[color:var(--homepage-inspector-muted,#64748b)]">{selectedViewLabel}</span>
        </div>
        <div className={`${segmentedControlClassName} grid grid-cols-2`}>
          {scopeOptions.map((option) => {
            const active = categoryTitleEditScope === option.value;
            return (
              <button
                key={option.value}
                type="button"
                aria-pressed={active}
                data-testid={option.testId}
                data-category-label-scope={option.value}
                className={classNames(
                  `h-8 rounded-md px-2.5 text-[12px] font-semibold transition ${adminControlFocusTokenClasses}`,
                  active
                    ? 'bg-[color:var(--homepage-inspector-selected-bg,#ffffff)] text-[color:var(--homepage-inspector-selected-text,#2563eb)] shadow-sm'
                    : 'text-[color:var(--homepage-inspector-muted,#64748b)] hover:text-[color:var(--homepage-inspector-strong,#1e293b)]'
                )}
                onClick={() => setCategoryTitleEditScope(option.value)}
              >
                {option.label}
              </button>
            );
          })}
        </div>
        <p className="mt-2 text-[11px] leading-4 text-[color:var(--homepage-inspector-muted,#64748b)]">
          Imena ostanejo vezana na Kategorije; tukaj urejaš samo njihov videz in postavitev.
        </p>
      </div>
    );
  }

  function renderStyleControls() {
    const updateSharedCategoryTitleColors = (updates: Pick<Partial<CategoryShowcaseMediaSettings>, 'titleColor' | 'titleHoverColor'>) => {
      if (!selectedCategoryTitleItem) return;
      const targetSlugs = categoryTitleEditScope === 'all'
        ? categoryShowcaseEditor.items.map((category) => category.slug)
        : [selectedCategoryTitleItem.slug];
      targetSlugs.forEach((categorySlug) => categoryShowcaseEditor.updatePresentation(categorySlug, updates));
    };

    return (
      <div className="space-y-2.5">
        {renderCategoryTitleScopeControl()}
        <div className="grid gap-1">
          <div className={inspectorFieldRowClassName}>
            <span className={labelClassName}>Pisava</span>
            <SelectControl<HomepageHeroFontFamily>
              value={selectedCanvasStyle.fontFamily as HomepageHeroFontFamily}
              options={HOMEPAGE_HERO_FONT_FAMILIES.map((font) => ({ value: font, label: getWebsiteFontFamilyLabel(font) }))}
              ariaLabel="Pisava"
              onChange={(fontFamily) => {
                if (selectedTypography) updateSelectedTypography({ fontFamily });
                if (selectedElementId) updateCanvasElementStyle(selectedElementId, { fontFamily });
              }}
            />
          </div>
          <NumberField
            label="Velikost"
            value={selectedCanvasStyle.fontSizePx}
            onChange={(fontSizePx) => {
              if (selectedTypography) updateSelectedTypography({ fontSizePx });
              if (selectedElementId) updateCanvasElementStyle(selectedElementId, { fontSizePx });
            }}
            min={8}
            max={240}
            suffix="px"
          />
        </div>
        <div className={segmentedControlClassName}>
          <ToolbarButton label="Krepko" active={selectedCanvasStyle.fontWeight >= 600} pressed={selectedCanvasStyle.fontWeight >= 600} onClick={() => {
            const bold = selectedCanvasStyle.fontWeight < 600;
            if (selectedTypography) updateSelectedTypography({ bold });
            if (selectedElementId) updateCanvasElementStyle(selectedElementId, { fontWeight: bold ? 700 : 400 });
          }}><Bold className="h-4 w-4" /></ToolbarButton>
          {selectedTypography ? <ToolbarButton label="Ležeče" active={selectedTypography.italic} pressed={selectedTypography.italic} onClick={() => updateSelectedTypography({ italic: !selectedTypography.italic })}><Italic className="h-4 w-4" /></ToolbarButton> : null}
          {selectedTypography ? <ToolbarButton label="Podčrtano" active={selectedTypography.underline} pressed={selectedTypography.underline} onClick={() => updateSelectedTypography({ underline: !selectedTypography.underline })}><Underline className="h-4 w-4" /></ToolbarButton> : null}
          <ToolbarDivider />
          <AppearanceEditorAlignmentControl
            value={selectedCanvasStyle.textAlign}
            options={['left', 'center', 'right', 'justify'] as const}
            ariaLabel="Poravnava besedila"
            onValueChange={(textAlign) => selectedElementId && updateCanvasElementStyle(selectedElementId, { textAlign })}
          />
        </div>
        <div className="grid gap-1">
          {selectedIsCategoryTitle && selectedCategoryTitleItem?.presentation ? (
            <>
              <ColorField
                label="Barva"
                value={selectedCategoryTitleItem.presentation.titleColor}
                onChange={(titleColor) => updateSharedCategoryTitleColors({ titleColor })}
              />
              <ColorField
                label="Barva ob lebdenju"
                value={selectedCategoryTitleItem.presentation.titleHoverColor}
                onChange={(titleHoverColor) => updateSharedCategoryTitleColors({ titleHoverColor })}
              />
            </>
          ) : (
            <ColorField
              label="Barva"
              value={selectedCanvasStyle.color || (
                selectedElementId === 'categories:subtitle'
                  ? '#536070'
                  : selectedIsCategoryText || selectedElementId === 'footer:description'
                    ? '#111827'
                    : '#ffffff'
              )}
              onChange={(color) => selectedElementId && updateCanvasElementStyle(selectedElementId, { color })}
            />
          )}
          <NumberField label="Debelina" value={selectedCanvasStyle.fontWeight} onChange={(fontWeight) => selectedElementId && updateCanvasElementStyle(selectedElementId, { fontWeight })} min={100} max={900} step={100} />
          <NumberField label="Višina vrstice" value={selectedCanvasStyle.lineHeight} onChange={(lineHeight) => selectedElementId && updateCanvasElementStyle(selectedElementId, { lineHeight })} min={0.5} max={4} step={0.05} />
          <NumberField label="Razmik črk" value={selectedCanvasStyle.letterSpacingPx} onChange={(letterSpacingPx) => selectedElementId && updateCanvasElementStyle(selectedElementId, { letterSpacingPx })} min={-10} max={40} step={0.25} suffix="px" />
        </div>
      </div>
    );
  }

  function renderLayoutControls() {
    return (
      <div className="space-y-2.5">
        {renderCategoryTitleScopeControl()}
        <p className="text-[11px] leading-4 text-[color:var(--homepage-inspector-muted,#64748b)]">Vrednost 0 pomeni samodejno velikost. Ročico v spodnjem desnem kotu izbranega elementa lahko povlečeš neposredno.</p>
        {selectedPosition ? (
          <div className="rounded-xl bg-[color:var(--homepage-inspector-subsurface,#f8fafc)] p-2.5">
            <div className="mb-2 flex items-center justify-between gap-3">
              <span className="text-[12px] font-semibold text-[color:var(--homepage-inspector-strong,#1e293b)]">Položaj</span>
              <button type="button" className="text-[11px] font-semibold text-[color:var(--homepage-inspector-muted,var(--blue-600))] hover:text-[color:var(--homepage-inspector-strong,var(--blue-700))]" onClick={() => updateSelectedPosition({ xPx: 0, yPx: 0 })}>Ponastavi</button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <NumberField label="X" value={selectedPosition.xPx} onChange={(xPx) => updateSelectedPosition({ xPx })} min={-200} max={HOMEPAGE_PREVIEW_PROFILES[previewDevice].viewportWidth - 48} suffix="px" />
              <NumberField
                label="Y"
                value={selectedPosition.yPx}
                onChange={(yPx) => updateSelectedPosition({ yPx })}
                min={-900}
                max={selectedElementId?.startsWith('hero:') ? heroViewSettings.heightPx - 24 : 1200}
                suffix="px"
              />
            </div>
          </div>
        ) : null}
        <div className="grid grid-cols-2 gap-2">
          <NumberField label="Širina" value={selectedCanvasStyle.widthPx} onChange={(widthPx) => selectedElementId && updateCanvasElementStyle(selectedElementId, { widthPx })} min={0} max={1440} suffix="px" />
          <NumberField label="Višina" value={selectedCanvasStyle.heightPx} onChange={(heightPx) => selectedElementId && updateCanvasElementStyle(selectedElementId, { heightPx })} min={0} max={900} suffix="px" />
        </div>
        <div>
          <span className={labelClassName}>Poravnava elementa</span>
          <AppearanceEditorAlignmentControl
            className="mt-1.5 w-full"
            value={selectedCanvasStyle.horizontalAlign}
            options={['left', 'center', 'right'] as const}
            ariaLabel="Vodoravna poravnava elementa"
            onValueChange={(horizontalAlign) => selectedElementId && updateCanvasElementStyle(selectedElementId, { horizontalAlign })}
          />
        </div>
      </div>
    );
  }

  function renderSpacingControls() {
    const paddingFields: Array<[string, keyof HomepageCanvasElementDeviceSettings]> = [['Zgoraj', 'paddingTopPx'], ['Desno', 'paddingRightPx'], ['Spodaj', 'paddingBottomPx'], ['Levo', 'paddingLeftPx']];
    const marginFields: Array<[string, keyof HomepageCanvasElementDeviceSettings]> = [['Zgoraj', 'marginTopPx'], ['Desno', 'marginRightPx'], ['Spodaj', 'marginBottomPx'], ['Levo', 'marginLeftPx']];
    return (
      <div className="space-y-2.5">
        {renderCategoryTitleScopeControl()}
        <div>
          <h3 className="mb-1.5 text-[11px] font-semibold text-[color:var(--homepage-inspector-strong,#1e293b)]">Notranji odmik</h3>
          <div className="grid grid-cols-2 gap-2">
            {paddingFields.map(([label, key]) => <NumberField key={key} label={label} value={selectedCanvasStyle[key] as number} onChange={(value) => selectedElementId && updateCanvasElementStyle(selectedElementId, { [key]: value })} min={0} max={240} suffix="px" />)}
          </div>
        </div>
        <div className="border-t border-[color:var(--homepage-inspector-divider,#f1f5f9)] pt-2">
          <h3 className="mb-1.5 text-[11px] font-semibold text-[color:var(--homepage-inspector-strong,#1e293b)]">Zunanji razmik</h3>
          <div className="grid grid-cols-2 gap-2">
            {marginFields.map(([label, key]) => <NumberField key={key} label={label} value={selectedCanvasStyle[key] as number} onChange={(value) => selectedElementId && updateCanvasElementStyle(selectedElementId, { [key]: value })} min={-240} max={480} suffix="px" />)}
          </div>
        </div>
      </div>
    );
  }

  function renderViewControls() {
    return (
      <div className="space-y-0.5">
        <ToggleRow label="Mreža" description="Prikaži pomožno mrežo v izbrani sekciji." checked={editorOptions.grid} onChange={(grid) => updateEditorOptions({ grid })} />
        <NumberField label="Korak mreže" value={editorOptions.gridSize} onChange={(gridSize) => updateEditorOptions({ gridSize })} min={2} max={64} suffix="px" />
        <ToggleRow label="Pripni na mrežo" checked={editorOptions.snapToGrid} onChange={(snapToGrid) => updateEditorOptions({ snapToGrid })} />
        <ToggleRow label="Pripni na elemente" checked={editorOptions.snapToElements} onChange={(snapToElements) => updateEditorOptions({ snapToElements })} />
        <ToggleRow label="Vodila" description="Poudarijo poravnavo in pripenjanje v izbrani sekciji." checked={editorOptions.guides} onChange={(guides) => updateEditorOptions({ guides })} />
        <ToggleRow label="Ravnila" checked={editorOptions.rulers} onChange={(rulers) => updateEditorOptions({ rulers })} />
        <ToggleRow label="Meritve" description="Razdalje do robov in najbližjega elementa." checked={editorOptions.measurements} onChange={(measurements) => updateEditorOptions({ measurements })} />
      </div>
    );
  }

  function renderActiveToolbarPopover(host: HomepageToolbarHost) {
    if (!activeToolbarPopover || activeToolbarHost !== host) return null;
    const close = () => {
      setActiveToolbarPopover(null);
      setActiveToolbarHost(null);
    };
    if (activeToolbarPopover === 'create') return (
      <ToolbarPopoverPanel title="Dodaj v predogled" description="Novi prosti elementi se dodajo v hero sekcijo in imajo ločeno postavitev za vsak pogled." onClose={close}>
        <div className="grid grid-cols-2 gap-2">
          <button type="button" className={`flex items-center gap-2 rounded-xl border border-transparent bg-[color:var(--homepage-inspector-subsurface,#f8fafc)] p-2.5 text-left text-[12px] font-medium text-[color:var(--homepage-inspector-strong,#334155)] transition hover:bg-[color:var(--homepage-inspector-hover,#f1f5f9)] ${adminControlFocusTokenClasses}`} onClick={() => addHeroTextBlock('text')}><Plus className="h-4 w-4" />Besedilo</button>
          <button type="button" className={`flex items-center gap-2 rounded-xl border border-transparent bg-[color:var(--homepage-inspector-subsurface,#f8fafc)] p-2.5 text-left text-[12px] font-medium text-[color:var(--homepage-inspector-strong,#334155)] transition hover:bg-[color:var(--homepage-inspector-hover,#f1f5f9)] ${adminControlFocusTokenClasses}`} onClick={() => addHeroTextBlock('button')}><Plus className="h-4 w-4" />Gumb</button>
        </div>
        {availableSectionIds.length > 0 ? (
          <div className="mt-2 pt-2">
            <p className="mb-1 px-2 text-[11px] font-medium text-[color:var(--homepage-inspector-muted,#64748b)]">Sekcije</p>
            <div className="grid gap-0.5">
              {availableSectionIds.map((sectionId) => (
                <button
                  key={sectionId}
                  type="button"
                  className={`flex items-center justify-between rounded-lg border border-transparent px-2.5 py-2 text-left text-[12px] text-[color:var(--homepage-inspector-strong,#334155)] transition hover:bg-[color:var(--homepage-inspector-hover,#f8fafc)] ${adminControlFocusTokenClasses}`}
                  onClick={() => addSection(sectionId)}
                >
                  {getSectionLabel(sectionId)}
                  <Plus className="h-3.5 w-3.5" />
                </button>
              ))}
            </div>
          </div>
        ) : null}
      </ToolbarPopoverPanel>
    );
    if (activeToolbarPopover === 'structure') return <ToolbarPopoverPanel title="Struktura strani" description="Sekcije niso več stalno prikazane ob predogledu." onClose={close}>{renderSectionStructure()}</ToolbarPopoverPanel>;
    if (activeToolbarPopover === 'carousel') return <ToolbarPopoverPanel title="Slike in vrtiljak" description="Naložite medije, uredite njihov vrstni red in način menjave." onClose={close} wide>{renderHeroCarouselSettings()}</ToolbarPopoverPanel>;
    if (activeToolbarPopover === 'section') return <ToolbarPopoverPanel title={`Nastavitve · ${getSectionLabel(selectedSectionId)}`} description={`Odzivne nastavitve za pogled ${selectedViewLabel}.`} onClose={close} wide>{renderSelectedSectionSettings()}</ToolbarPopoverPanel>;
    if (activeToolbarPopover === 'page') return <ToolbarPopoverPanel title="Nastavitve strani" description={`Nastavitve glavne strani za pogled ${selectedViewLabel}.`} onClose={close}>{renderPageSettings()}</ToolbarPopoverPanel>;
    if (activeToolbarPopover === 'style') return <ToolbarPopoverPanel title={`Besedilo · ${selectedEditTargetLabel}`} description={`Slog za pogled ${selectedViewLabel}.`} onClose={close}>{renderStyleControls()}</ToolbarPopoverPanel>;
    if (activeToolbarPopover === 'layout') return <ToolbarPopoverPanel title={`Mere in poravnava · ${selectedEditTargetLabel}`} onClose={close}>{renderLayoutControls()}</ToolbarPopoverPanel>;
    if (activeToolbarPopover === 'spacing') return <ToolbarPopoverPanel title={`Razmiki · ${selectedEditTargetLabel}`} onClose={close}>{renderSpacingControls()}</ToolbarPopoverPanel>;
    if (activeToolbarPopover === 'link') return <ToolbarPopoverPanel title={`Povezava · ${selectedElementLabel}`} onClose={close}><TextField label="Cilj povezave" value={selectedElementLink()} onChange={updateSelectedElementLink} placeholder="/povezava ali https://..." /></ToolbarPopoverPanel>;
    if (activeToolbarPopover === 'media' && selectedCategoryMediaItem) return (
      <ToolbarPopoverPanel title="Uredi videz kategorije" description="Slika ter barve naslova, številke in ozadja so skupne v obeh urednikih in na javni strani." onClose={close}>
        <CategoryShowcaseEditor
          context="homepage"
          capabilities={CATEGORY_SHOWCASE_BASE_CAPABILITIES}
          selectedItem={selectedCategoryMediaItem}
          controlsTone="dark"
          controlsClassName="!w-full !border-0 !bg-transparent !p-0 !shadow-none !backdrop-blur-none"
          onPresentationChange={(updates) => categoryShowcaseEditor.updatePresentation(selectedCategoryMediaItem.slug, updates)}
          onImageChange={(file) => replaceCategoryImage(selectedCategoryMediaItem.slug, file)}
          onImageRemove={() => removeCategoryImage(selectedCategoryMediaItem.slug)}
          onReset={() => categoryShowcaseEditor.resetPresentation(selectedCategoryMediaItem.slug)}
        >
          {null}
        </CategoryShowcaseEditor>
      </ToolbarPopoverPanel>
    );
    return <ToolbarPopoverPanel title={`Mreža in vodila · ${getSectionLabel(selectedSectionId)} · ${selectedViewLabel}`} description="Nastavitve se uporabijo na izbrani sekciji v trenutnem pogledu." onClose={close}>{renderViewControls()}</ToolbarPopoverPanel>;
  }

  function renderContextToolbar(host: HomepageToolbarHost) {
    const inline = host === 'inline';
    const tone = inline ? 'light' : 'dark';
    const toolbarLabel = inline ? 'Stran' : selectedElementLabel;
    const hostPopover = activeToolbarHost === host ? activeToolbarPopover : null;
    return (
      <>
        <HomepageToolbarToneContext.Provider value={tone}>
          <div className="flex min-w-0 items-center gap-0.5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <span
              className={classNames(
                'mr-1 inline-flex h-8 max-w-40 shrink-0 items-center gap-1.5 rounded-lg px-2.5 text-[11px] font-semibold',
                tone === 'dark' ? 'bg-white/10 text-white' : 'bg-transparent text-slate-700'
              )}
              title={toolbarLabel}
              data-homepage-toolbar-label
            >
              <MousePointer2 className={classNames('h-3.5 w-3.5 shrink-0', tone === 'dark' ? 'text-white/80' : 'text-[color:var(--blue-500)]')} />
              <span className="truncate">{toolbarLabel}</span>
            </span>

            <ToolbarButton label="Dodaj besedilo, gumb ali sekcijo" active={hostPopover === 'create'} popover onClick={() => toggleToolbarPopover('create', host)} testId={inline && selectedElementId ? 'homepage-page-toolbar-add' : 'homepage-toolbar-add'}>
              <Plus className="h-4 w-4" />
            </ToolbarButton>

          {inline ? (
            <>
              <ToolbarButton label="Struktura strani" active={hostPopover === 'structure'} popover onClick={() => toggleToolbarPopover('structure', host)}>
                <Layers3 className="h-4 w-4" />
              </ToolbarButton>
              <ToolbarButton label="Nastavitve strani" active={hostPopover === 'page'} popover onClick={() => toggleToolbarPopover('page', host)}>
                <SlidersHorizontal className="h-4 w-4" />
              </ToolbarButton>
              <ToolbarButton label="Mreža, pripenjanje in vodila" active={hostPopover === 'view'} popover onClick={() => toggleToolbarPopover('view', host)}>
                <Grid3X3 className="h-4 w-4" />
              </ToolbarButton>
            </>
          ) : (
            <>
              <ToolbarDivider />
              <ToolbarButton label="Počisti izbor" onClick={() => selectCanvasElement(null)}>
                <MousePointer2 className="h-4 w-4" />
              </ToolbarButton>
              {!selectedCategoryMediaItem ? (
                <ToolbarButton label="Podvoji" disabled={selectedIsSection || selectedIsFixedFooterElement || selectedIsCategoryElement} onClick={duplicateSelectedElement}>
                  <Copy className="h-4 w-4" />
                </ToolbarButton>
              ) : null}
              {!selectedCategoryMediaItem ? (
                <ToolbarButton label={selectedEffectiveVisible ? 'Skrij' : 'Prikaži'} onClick={toggleSelectedVisibility}>
                  {selectedEffectiveVisible ? <Eye className="h-4 w-4" /> : <EyeClosed className="h-4 w-4" />}
                </ToolbarButton>
              ) : null}
              {selectedCategoryMediaItem || selectedIsSection || selectedCanDelete ? (
                <ToolbarButton label={selectedCategoryMediaItem ? 'Odstrani sliko' : 'Izbriši'} danger onClick={deleteSelectedElement}>
                  <Trash2 className="h-4 w-4" />
                </ToolbarButton>
              ) : null}

              <ToolbarDivider />

              {selectedIsSection ? (
                <>
                  {selectedSectionId === 'hero' ? (
                    <ToolbarButton
                      label="Slike in vrtiljak"
                      active={hostPopover === 'carousel'}
                      popover
                      onClick={() => toggleToolbarPopover('carousel', host)}
                      testId="homepage-hero-carousel-toolbar-button"
                    >
                      <Images className="h-4 w-4" />
                    </ToolbarButton>
                  ) : null}
                  <ToolbarButton label="Nastavitve sekcije" active={hostPopover === 'section'} popover onClick={() => toggleToolbarPopover('section', host)}>
                    <SlidersHorizontal className="h-4 w-4" />
                  </ToolbarButton>
                  <ToolbarButton label="Struktura in vrstni red sekcij" active={hostPopover === 'structure'} popover onClick={() => toggleToolbarPopover('structure', host)}>
                    <Layers3 className="h-4 w-4" />
                  </ToolbarButton>
                </>
              ) : (
                <>
                  {selectedCategoryMediaItem ? (
                    <ToolbarButton label="Uredi videz kategorije" active={hostPopover === 'media'} popover onClick={() => toggleToolbarPopover('media', host)}>
                      <SlidersHorizontal className="h-4 w-4" />
                    </ToolbarButton>
                  ) : (
                    <>
                      {selectedIsText || selectedIsButton ? (
                        <ToolbarButton label="Slog besedila" active={hostPopover === 'style'} popover onClick={() => toggleToolbarPopover('style', host)}>
                          <Bold className="h-4 w-4" />
                        </ToolbarButton>
                      ) : null}
                      <ToolbarButton label="Mere in poravnava" active={hostPopover === 'layout'} popover onClick={() => toggleToolbarPopover('layout', host)}>
                        <Maximize2 className="h-4 w-4" />
                      </ToolbarButton>
                      <ToolbarButton label="Notranji in zunanji razmiki" active={hostPopover === 'spacing'} popover onClick={() => toggleToolbarPopover('spacing', host)}>
                        <SquareDashed className="h-4 w-4" />
                      </ToolbarButton>
                      <ToolbarButton label="Premakni plast nazaj" onClick={() => selectedElementId && updateCanvasElementStyle(selectedElementId, { zIndex: selectedCanvasStyle.zIndex - 1 })}>
                        <ArrowDown className="h-4 w-4" />
                      </ToolbarButton>
                      <ToolbarButton label="Premakni plast naprej" onClick={() => selectedElementId && updateCanvasElementStyle(selectedElementId, { zIndex: selectedCanvasStyle.zIndex + 1 })}>
                        <ArrowUp className="h-4 w-4" />
                      </ToolbarButton>
                      <ToolbarButton label={selectedCanvasStyle.locked ? 'Odkleni položaj' : 'Zakleni položaj'} active={selectedCanvasStyle.locked} pressed={selectedCanvasStyle.locked} onClick={() => selectedElementId && updateCanvasElementStyle(selectedElementId, { locked: !selectedCanvasStyle.locked })}>
                        {selectedCanvasStyle.locked ? <Lock className="h-4 w-4" /> : <Unlock className="h-4 w-4" />}
                      </ToolbarButton>
                      {selectedCanLink ? (
                        <ToolbarButton label="Nastavitve povezave" active={hostPopover === 'link'} popover onClick={() => toggleToolbarPopover('link', host)}>
                          <LinkIcon className="h-4 w-4" />
                        </ToolbarButton>
                      ) : null}
                    </>
                  )}
                </>
              )}

              <ToolbarDivider />
              <ToolbarButton label="Mreža, pripenjanje in vodila" active={hostPopover === 'view'} popover onClick={() => toggleToolbarPopover('view', host)}>
                {editorOptions.snapToGrid || editorOptions.snapToElements ? <Magnet className="h-4 w-4" /> : editorOptions.rulers ? <Ruler className="h-4 w-4" /> : <Grid3X3 className="h-4 w-4" />}
              </ToolbarButton>
            </>
            )}
          </div>
        </HomepageToolbarToneContext.Provider>
        {renderActiveToolbarPopover(host)}
      </>
    );
  }

  return (
    <div className="space-y-4" data-appearance-settings-density="compact" data-appearance-settings-page="glavna-stran">
      <AdminPageHeader
        title="Glavna stran"
        description="Urejanje javne glavne strani pod zgornjo navigacijo."
        actions={
          <div
            className="flex flex-wrap items-center justify-end gap-2"
            data-homepage-selection-persistent-control
          >
            <span className="mr-1 inline-flex items-center gap-1.5 text-[11px] font-medium text-slate-500" aria-live="polite">
              <span className={`h-1.5 w-1.5 rounded-full ${isDirty ? 'bg-amber-500' : 'bg-emerald-500'}`} />
              {isDirty ? 'Neshranjeno' : 'Objavljeno'}
            </span>
            <Button type="button" variant="default" size="toolbar" onClick={restoreDefaults} className="!h-9 !rounded-md !px-3" disabled={isSaving || uploadingSlideId !== null}>
              Privzeto
            </Button>
            <Button type="button" variant="primary" size="toolbar" className={topActionSaveButtonClassName} onClick={save} disabled={!isDirty || isSaving || uploadingSlideId !== null}>
              <Save className="h-4 w-4" />
              Shrani spremembe
            </Button>
          </div>
        }
      />
      <AdminPodobaTabs />

      <main className="min-w-0">
        <div className={`${panelClassName} overflow-visible`}>
          <div className="flex min-w-0 flex-wrap items-center gap-2 px-4 py-3">
            <div
              className="flex shrink-0 items-center gap-2"
              role="group"
              aria-label="Odzivni predogled"
              data-homepage-preview-controls
            >
              {HOMEPAGE_PREVIEW_DEVICES.map((device) => (
                <button
                  key={device}
                  type="button"
                  onPointerDown={(event) => event.preventDefault()}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => setPreviewDevice(device)}
                  aria-pressed={previewDevice === device}
                  className={classNames(
                    `inline-flex h-8 items-center gap-1.5 rounded-md px-2.5 text-[12px] font-medium leading-none transition ${adminControlFocusTokenClasses}`,
                    previewDevice === device
                      ? 'text-[color:var(--blue-500)]'
                      : 'text-slate-500 hover:text-[color:var(--blue-500)]'
                  )}
                >
                  <PreviewDeviceIcon device={device} />
                  {homepagePreviewDeviceLabels[device]}
                </button>
              ))}
            </div>

            <div
              ref={inlineToolbarRef}
              data-testid={selectedElementId ? 'homepage-page-toolbar' : 'homepage-context-toolbar'}
              data-homepage-page-toolbar
              data-selected-element-id=""
              data-homepage-toolbar-anchor-id="preview-controls"
              data-toolbar-placement="inline"
              data-toolbar-ready="true"
              data-toolbar-mode="inline"
              role="toolbar"
              aria-label="Orodna vrstica predogleda"
              className="relative z-[110] ml-1 w-max max-w-full min-w-0 border-0 bg-transparent p-0 shadow-none"
            >
              {renderContextToolbar('inline')}
            </div>

            <div className="ml-auto shrink-0">
              <Button
                type="button"
                variant="primary"
                size="toolbar"
                className={`gap-2 whitespace-nowrap ${adminTablePrimaryButtonClassName}`}
                onClick={() => {
                  void setCurrentConfigAsDefaults();
                }}
                disabled={isSaving || uploadingSlideId !== null}
                data-testid="homepage-set-defaults"
              >
                <Save className="h-4 w-4" />
                Nastavi kot privzete nastavitve
              </Button>
            </div>
          </div>

          <div className="mx-4 h-px bg-slate-200" />
          <div className="overflow-x-clip p-4">
            <ScaledHomepagePreview
              selectedViewport={previewDevice}
              settings={config}
              categories={categoryShowcaseEditor.items}
              navigation={previewNavigation}
              globalStyle={globalStyle}
              selectedSectionId={selectedSectionId}
              selectedElementId={selectedElementId}
              onSelectSection={(sectionId) => selectCanvasElement(`section:${sectionId}`)}
              onSelectElement={selectCanvasElement}
              onHeroTextPositionChange={updateHeroViewForDevice}
              onHeroTextContentChange={(updates) => updateHero(updates)}
              onHeroTextBlockChange={updateHeroTextBlock}
              onFooterDescriptionChange={setFooterDescription}
              onCategoryTextChange={updateCategories}
              onCategoryImageChange={replaceCategoryImage}
              onCategoryImageRemove={removeCategoryImage}
              onEditCategoryAppearance={editCategoryAppearance}
              onCategoryPresentationChange={categoryShowcaseEditor.updatePresentation}
              onCategoryMove={moveCategory}
              onCanvasElementStyleChange={updateCanvasElementStyleFromPreview}
              onRestoreHiddenElement={restoreHiddenElement}
              onMoveSection={moveSection}
              editorOptionsByDevice={editorOptionsByDevice}
              contextToolbar={renderContextToolbar('floating')}
              contextToolbarRef={floatingToolbarRef}
            />
          </div>
        </div>
      </main>
    </div>
  );
}

export default AdminLandingPageClient;
