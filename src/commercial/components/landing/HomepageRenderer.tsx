'use client';

import Image from 'next/image';
import Link from 'next/link';
import { createElement, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type DragEvent as ReactDragEvent, type KeyboardEvent as ReactKeyboardEvent, type MouseEvent as ReactMouseEvent, type PointerEvent as ReactPointerEvent, type ReactNode, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import {
  BadgeCheck,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Eye,
  EyeOff,
  GripVertical,
  Headphones,
  Mail,
  PackageCheck,
  School,
  ShieldCheck,
  SlidersHorizontal,
  Truck,
  Wrench,
  type LucideIcon
} from 'lucide-react';
import { catalogCategoryHref } from '@/commercial/catalog/catalogRoutes';
import {
  COMMERCIAL_STOREFRONT_SCALE,
  toCommercialStorefrontLogicalPx
} from '@/commercial/components/commercialStorefrontScale';
import SiteFooter, { renderSiteFooterLogo, type SiteFooterEditorAdapter } from '@/commercial/components/SiteFooter';
import {
  DEFAULT_HOMEPAGE_CANVAS_ELEMENT_DEVICE_SETTINGS,
  HOMEPAGE_CATEGORY_TITLE_SHARED_CANVAS_ELEMENT_ID,
  createDefaultHomepageCategoryTitleCanvasSettings,
  type HomepageButtonStyle,
  type HomepageCanvasElementDeviceSettings,
  type HomepageCategoryCardData,
  type HomepageCategoriesSettings,
  type HomepageFooterSettings,
  type HomepageHeroSettings,
  type HomepageHeroTextBlock,
  type HomepageInfoBlocksSettings,
  type HomepageInfoIcon,
  type HomepagePageSettings,
  type HomepagePreviewDevice,
  type HomepageSectionId,
  type HomepageSettings,
  getHomepagePreviewDeviceForViewport,
  isHomepageCanvasElementDeleted,
  normalizeLandingPageConfig,
  orderHomepageCategories,
  resolveHomepageCategoryCardHeight,
  resolveHomepageCanvasElementDeviceSettings,
  resolveHomepageSettingsForDevice
} from '@/shared/domain/landing/landingPage';
import { resolveWebsiteFontStack } from '@/shared/domain/style/fontFamilies';
import CategoryShowcase from '@/shared/features/category-showcase/CategoryShowcase';
import type { CategoryShowcaseMediaSettings } from '@/shared/features/category-showcase/categoryShowcaseSchema';
import CanvasHiddenElementFlag from '@/shared/ui/product-canvas/CanvasHiddenElementFlag';
import { adminEditorSelectionOutlineTokenClasses } from '@/shared/ui/theme/tokens';

const classNames = (...parts: Array<string | false | null | undefined>) => parts.filter(Boolean).join(' ');

export { HOMEPAGE_CATEGORY_TITLE_SHARED_CANVAS_ELEMENT_ID };

// The public storefront is zoomed down globally; counter-zoom only this shared
// showcase so its physical geometry stays identical to both admin previews.
const publicCategoryShowcaseStyle: CSSProperties = {
  zoom: toCommercialStorefrontLogicalPx(1)
};

const sectionGapClassNames: Record<HomepagePageSettings['sectionSpacing'], string> = {
  compact: 'gap-3',
  default: 'gap-5',
  spacious: 'gap-8'
};

const containerClassNames: Record<HomepagePageSettings['containerWidth'], string> = {
  default: 'site-container',
  wide: 'mx-auto w-full max-w-[calc(var(--site-content-max-width)+160px)] px-[var(--site-gutter,24px)]',
  full: 'w-full px-[var(--site-gutter,24px)]'
};

const sectionRadiusClassNames: Record<HomepagePageSettings['sectionRadius'], string> = {
  none: 'rounded-none',
  small: 'rounded-md',
  medium: 'rounded-[10px]',
  large: 'rounded-2xl'
};

const homepageSectionLabels: Record<HomepageSectionId, string> = {
  hero: 'Uvodna sekcija',
  categories: 'Kategorije',
  infoBlocks: 'Informacijski bloki',
  footer: 'Noga strani'
};

const infoIconMap: Record<HomepageInfoIcon, LucideIcon> = {
  'badge-check': BadgeCheck,
  truck: Truck,
  headphones: Headphones,
  school: School,
  'shield-check': ShieldCheck,
  wrench: Wrench,
  'package-check': PackageCheck,
  mail: Mail
};

const siteContentMaxWidthPx = 1280;
const siteWideContentMaxWidthPx = siteContentMaxWidthPx + 160;
const heroMinimumTextWidthPx = 180;

type HeroContentBounds = {
  contentLeft: number;
  contentWidth: number;
};

function clampNumber(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function getCurrentLogicalViewportWidth(root: HTMLElement | null, fallbackWidth?: number) {
  const measuredWidth = root?.clientWidth || root?.offsetWidth || 0;
  if (measuredWidth > 0) return measuredWidth;
  if (fallbackWidth && fallbackWidth > 0) return fallbackWidth;
  return root?.getBoundingClientRect().width ?? 0;
}

function getSiteGutterPx(viewportWidth: number) {
  return clampNumber(viewportWidth * 0.04, 16, 32);
}

function getHeroContainerMetrics(page: HomepagePageSettings, viewportWidth: number) {
  const gutter = getSiteGutterPx(viewportWidth);
  const maxWidth = page.containerWidth === 'wide'
    ? siteWideContentMaxWidthPx
    : page.containerWidth === 'full'
      ? viewportWidth
      : siteContentMaxWidthPx;
  const outerWidth = Math.min(viewportWidth, maxWidth);
  const outerLeft = Math.max(0, (viewportWidth - outerWidth) / 2);
  const contentLeft = outerLeft + gutter;
  const contentWidth = Math.max(heroMinimumTextWidthPx, outerWidth - gutter * 2);

  return {
    gutter,
    outerLeft,
    outerWidth,
    contentLeft,
    contentWidth,
    contentRight: contentLeft + contentWidth
  };
}

function getHeroTextMetrics(
  hero: HomepageHeroSettings,
  page: HomepagePageSettings,
  viewportWidth: number,
  measuredContent?: HeroContentBounds | null
) {
  const fallbackContainer = getHeroContainerMetrics(page, viewportWidth);
  const container = measuredContent
    ? {
        ...fallbackContainer,
        outerLeft: measuredContent.contentLeft,
        outerWidth: measuredContent.contentWidth,
        contentLeft: measuredContent.contentLeft,
        contentWidth: measuredContent.contentWidth,
        contentRight: measuredContent.contentLeft + measuredContent.contentWidth
      }
    : fallbackContainer;
  const offset = clampNumber(hero.contentOffsetXPx, 0, Math.max(0, container.contentWidth - heroMinimumTextWidthPx));
  const width = clampNumber(hero.textWidthPx, heroMinimumTextWidthPx, Math.max(heroMinimumTextWidthPx, container.contentWidth - offset));
  const left = container.contentLeft + offset;
  const right = left + width;
  const centerDelta = Math.round(left + width / 2 - viewportWidth / 2);

  return {
    ...container,
    textLeft: left,
    textRight: right,
    textWidth: width,
    leftDistance: Math.round(left - container.contentLeft),
    rightDistance: Math.round(container.contentRight - right),
    centerDelta,
    textWidthPercent: Math.round((width / container.contentWidth) * 100),
    textOffsetY: hero.contentOffsetYPx,
    mediaWidthPx: Math.round(viewportWidth * (hero.mediaWidthPercent / 100)),
    mediaLeft: (viewportWidth - viewportWidth * (hero.mediaWidthPercent / 100)) / 2
  };
}

function measureHeroContentBounds(root: HTMLElement, logicalWidth: number): HeroContentBounds | null {
  const content = root.querySelector<HTMLElement>('[data-homepage-hero-content]');
  if (!content || logicalWidth <= 0) return null;

  const rootRect = root.getBoundingClientRect();
  const contentRect = content.getBoundingClientRect();
  const scaleX = rootRect.width > 0 ? rootRect.width / logicalWidth : 1;
  const contentStyle = window.getComputedStyle(content);
  const paddingLeft = Number.parseFloat(contentStyle.paddingLeft) || 0;
  const paddingRight = Number.parseFloat(contentStyle.paddingRight) || 0;
  const contentLeft = (contentRect.left - rootRect.left) / (scaleX || 1) + paddingLeft;
  const contentWidth = Math.max(
    heroMinimumTextWidthPx,
    contentRect.width / (scaleX || 1) - paddingLeft - paddingRight
  );

  return { contentLeft, contentWidth };
}

function useHomepageRenderDevice(previewDevice?: HomepagePreviewDevice) {
  const [device, setDevice] = useState<HomepagePreviewDevice>('desktop');

  useEffect(() => {
    if (previewDevice) return undefined;

    const updateDevice = () => {
      setDevice(getHomepagePreviewDeviceForViewport(window.innerWidth));
    };

    updateDevice();
    window.addEventListener('resize', updateDevice);
    return () => window.removeEventListener('resize', updateDevice);
  }, [previewDevice]);

  return previewDevice ?? device;
}

type HomepageRendererProps = {
  settings: HomepageSettings;
  categories: HomepageCategoryCardData[];
  canonicalFooter?: HomepageFooterSettings;
  selectedSectionId?: HomepageSectionId;
  onSelectSection?: (sectionId: HomepageSectionId) => void;
  onHeroTextPositionChange?: (updates: HeroPositionUpdates) => void;
  onHeroTextContentChange?: (updates: HeroTextContentUpdates) => void;
  onHeroTextBlockChange?: (blockId: string, updates: HeroTextBlockUpdates) => void;
  onFooterDescriptionChange?: (description: string) => void;
  onCategoryTextChange?: (updates: CategoryTextUpdates) => void;
  onCategoryImageChange?: (categorySlug: string, file: File) => void;
  onCategoryImageRemove?: (categorySlug: string) => void;
  onEditCategoryAppearance?: (categorySlug: string) => void;
  onCategoryPresentationChange?: (categorySlug: string, updates: Partial<CategoryShowcaseMediaSettings>) => void;
  onCategoryMove?: (sourceSlug: string, targetSlug: string) => void;
  selectedElementId?: string | null;
  onSelectElement?: (elementId: string | null) => void;
  onCanvasElementStyleChange?: (elementId: string, updates: Partial<HomepageCanvasElementDeviceSettings>) => void;
  onRestoreHiddenElement?: (elementId: string) => void;
  onMoveSection?: (sectionId: HomepageSectionId, direction: -1 | 1) => void;
  editorOptions?: HomepageCanvasEditorOptions;
  editorSectionId?: HomepageSectionId;
  preview?: boolean;
  previewDevice?: HomepagePreviewDevice;
  previewViewportWidth?: number;
  previewHeroStorefrontStyle?: CSSProperties;
};

export type HomepageCanvasEditorOptions = {
  grid: boolean;
  gridSize: number;
  snapToGrid: boolean;
  snapToElements: boolean;
  guides: boolean;
  rulers: boolean;
  measurements: boolean;
};

export const DEFAULT_HOMEPAGE_CANVAS_EDITOR_OPTIONS: HomepageCanvasEditorOptions = {
  grid: false,
  gridSize: 8,
  snapToGrid: true,
  snapToElements: true,
  guides: true,
  rulers: false,
  measurements: true
};

type HeroPositionUpdates = Partial<
  Pick<
    HomepageHeroSettings,
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

type HeroDragTarget = 'block' | 'title' | 'description' | 'primaryButton' | 'secondaryButton';
type HeroElementDragTarget = Exclude<HeroDragTarget, 'block'>;
type HeroEditableLayer = 'title' | 'description' | `textBlock:${string}`;
type HeroCanvasLayer = HeroEditableLayer | 'primaryButton' | 'secondaryButton';
type HeroTextContentUpdates = Partial<Pick<HomepageHeroSettings, 'title' | 'description'>>;
type CategoryTextUpdates = Partial<Pick<HomepageCategoriesSettings, 'title' | 'subtitle' | 'showAllLabel'>>;
type HeroTextBlockUpdates = Partial<
  Pick<HomepageHeroTextBlock, 'text' | 'visible' | 'href' | 'xPx' | 'yPx' | 'widthPx' | 'fontFamily' | 'fontSizePx' | 'bold' | 'italic' | 'underline' | 'responsive'>
>;
type HeroOffsetKey = keyof Pick<
  HomepageHeroSettings,
  | 'titleOffsetXPx'
  | 'titleOffsetYPx'
  | 'descriptionOffsetXPx'
  | 'descriptionOffsetYPx'
  | 'primaryButtonOffsetXPx'
  | 'primaryButtonOffsetYPx'
  | 'secondaryButtonOffsetXPx'
  | 'secondaryButtonOffsetYPx'
>;

const heroElementOffsetKeys: Record<HeroElementDragTarget, { x: HeroOffsetKey; y: HeroOffsetKey; label: string }> = {
  title: { x: 'titleOffsetXPx', y: 'titleOffsetYPx', label: 'Naslov' },
  description: { x: 'descriptionOffsetXPx', y: 'descriptionOffsetYPx', label: 'Opis' },
  primaryButton: { x: 'primaryButtonOffsetXPx', y: 'primaryButtonOffsetYPx', label: 'Primarni gumb' },
  secondaryButton: { x: 'secondaryButtonOffsetXPx', y: 'secondaryButtonOffsetYPx', label: 'Sekundarni gumb' }
};

type SectionFrameProps = {
  sectionId: HomepageSectionId;
  selectedSectionId?: HomepageSectionId;
  selectedElementId?: string | null;
  onSelectSection?: (sectionId: HomepageSectionId) => void;
  onSelectElement?: (elementId: string | null) => void;
  onMoveSection?: (sectionId: HomepageSectionId, direction: -1 | 1) => void;
  canMoveUp?: boolean;
  canMoveDown?: boolean;
  hidden?: boolean;
  onRestoreHidden?: () => void;
  preview?: boolean;
  editorActive?: boolean;
  editorOptions?: HomepageCanvasEditorOptions;
  editorContentScale?: number;
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
};

function getCategoryList(categories: HomepageCategoryCardData[], settings: HomepageCategoriesSettings) {
  return orderHomepageCategories(categories, settings).slice(0, settings.limit);
}

type HomepageCanvasElementLayout = 'fit' | 'fill' | 'absolute-fill';

type HomepageCanvasElementProps = {
  elementId: string;
  categoryLabelSlug?: string;
  settings: HomepageCanvasElementDeviceSettings;
  selected: boolean;
  preview: boolean;
  editorOptions: HomepageCanvasEditorOptions;
  text?: string;
  editableText?: boolean;
  textTag?: 'h2' | 'h3' | 'p' | 'span';
  textClassName?: string;
  textLabel?: string;
  textPlaceholder?: string;
  inheritTextColor?: boolean;
  href?: string;
  linkClassName?: string;
  trailingContent?: ReactNode;
  layout?: HomepageCanvasElementLayout;
  className?: string;
  visualScaleWithHeight?: boolean;
  onTextChange?: (value: string) => void;
  onSelect?: (elementId: string) => void;
  onStyleChange?: (elementId: string, updates: Partial<HomepageCanvasElementDeviceSettings>) => void;
  children?: ReactNode;
  sizedChildren?: ReactNode;
};

type HomepageCanvasInteraction = {
  kind: 'move' | 'resize';
  pointerId: number;
  startClientX: number;
  startClientY: number;
  startOffsetX: number;
  startOffsetY: number;
  startWidth: number;
  startHeight: number;
  startLeft: number;
  startTop: number;
  visualWidth: number;
  visualHeight: number;
  snapTargetsX: number[];
  snapTargetsY: number[];
  sectionElement: HTMLElement | null;
  scale: number;
  moved: boolean;
};

type HomepageCanvasSnapResult = {
  value: number;
  guide: number | null;
};

type HomepageSectionMeasurement = {
  left: number;
  top: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
  nearest: number | null;
};

type HomepageCanvasGuideDetail = {
  x: number | null;
  y: number | null;
};

const HOMEPAGE_CANVAS_GUIDE_EVENT = 'atehna:homepage-canvas-guides';

function snapCanvasValue(value: number, options: HomepageCanvasEditorOptions) {
  if (!options.snapToGrid || options.gridSize <= 0) return Math.round(value);
  return Math.round(value / options.gridSize) * options.gridSize;
}

function snapCanvasOffsetToElements({
  startOffset,
  startPosition,
  delta,
  size,
  targets,
  options
}: {
  startOffset: number;
  startPosition: number;
  delta: number;
  size: number;
  targets: number[];
  options: HomepageCanvasEditorOptions;
}): HomepageCanvasSnapResult {
  let value = snapCanvasValue(startOffset + delta, options);
  if (!options.snapToElements || targets.length === 0) return { value, guide: null };

  const threshold = Math.max(4, Math.min(12, options.gridSize / 2));
  const position = startPosition + value - startOffset;
  const anchors = [0, size / 2, size];
  let bestDistance = threshold + 1;
  let bestDelta = 0;
  let guide: number | null = null;

  targets.forEach((target) => {
    anchors.forEach((anchor) => {
      const candidateDelta = target - (position + anchor);
      const distance = Math.abs(candidateDelta);
      if (distance <= threshold && distance < bestDistance) {
        bestDistance = distance;
        bestDelta = candidateDelta;
        guide = target;
      }
    });
  });

  value = Math.round(value + bestDelta);
  return { value, guide };
}

function snapCanvasSizeToElements({
  value,
  startPosition,
  targets,
  options
}: {
  value: number;
  startPosition: number;
  targets: number[];
  options: HomepageCanvasEditorOptions;
}): HomepageCanvasSnapResult {
  let next = Math.max(24, snapCanvasValue(value, options));
  if (!options.snapToElements || targets.length === 0) return { value: next, guide: null };

  const threshold = Math.max(4, Math.min(12, options.gridSize / 2));
  const edge = startPosition + next;
  let bestDistance = threshold + 1;
  let guide: number | null = null;

  targets.forEach((target) => {
    const distance = Math.abs(target - edge);
    if (distance <= threshold && distance < bestDistance) {
      bestDistance = distance;
      guide = target;
    }
  });

  if (guide !== null) next = Math.max(24, Math.round(guide - startPosition));
  return { value: next, guide };
}

function reportHomepageCanvasGuides(section: HTMLElement | null, detail: HomepageCanvasGuideDetail) {
  section?.dispatchEvent(new CustomEvent<HomepageCanvasGuideDetail>(HOMEPAGE_CANVAS_GUIDE_EVENT, { detail }));
}

function getCanvasPreviewScale(element: HTMLElement) {
  const host = element.closest<HTMLElement>('[data-preview-scale]');
  const scale = Number(host?.dataset.previewScale);
  return Number.isFinite(scale) && scale > 0 ? scale : 1;
}

function HomepageCanvasElement({
  elementId,
  categoryLabelSlug,
  settings,
  selected,
  preview,
  editorOptions,
  text,
  editableText = false,
  textTag = 'p',
  textClassName,
  textLabel,
  textPlaceholder,
  inheritTextColor = false,
  href,
  linkClassName,
  trailingContent,
  layout = 'fit',
  className,
  visualScaleWithHeight = false,
  onTextChange,
  onSelect,
  onStyleChange,
  children,
  sizedChildren
}: HomepageCanvasElementProps) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const textRef = useRef<HTMLElement | null>(null);
  const interactionRef = useRef<HomepageCanvasInteraction | null>(null);
  const suppressClickRef = useRef(false);
  const [editing, setEditing] = useState(false);
  const isText = text !== undefined;
  const hasExplicitSize = settings.widthPx > 0 || settings.heightPx > 0;

  useEffect(() => {
    if (editing || !isText || !textRef.current) return;
    if (textRef.current.textContent !== (text ?? '')) textRef.current.textContent = text ?? '';
  }, [editing, isText, text]);

  if (!preview && !settings.visible) return null;
  if (preview && !settings.visible) {
    return (
      <CanvasHiddenElementFlag
        elementId={elementId}
        label={textLabel || elementId}
        kind="homepage"
        onRestore={() => onStyleChange?.(elementId, { visible: true })}
      />
    );
  }

  const beginInteraction = (kind: HomepageCanvasInteraction['kind'], event: ReactPointerEvent<HTMLElement>) => {
    const root = rootRef.current;
    if (!preview || settings.locked || !onStyleChange || !root || event.button !== 0 || editing) return;
    const scale = getCanvasPreviewScale(root);
    const sectionElement = root.closest<HTMLElement>('[data-homepage-section]');
    const sectionRect = sectionElement?.getBoundingClientRect() ?? null;
    const rootRect = root.getBoundingClientRect();
    const startLeft = sectionRect ? (rootRect.left - sectionRect.left) / scale : 0;
    const startTop = sectionRect ? (rootRect.top - sectionRect.top) / scale : 0;
    const visualWidth = rootRect.width / scale;
    const visualHeight = rootRect.height / scale;
    const snapTargetsX: number[] = [];
    const snapTargetsY: number[] = [];

    if (sectionElement && sectionRect) {
      const sectionWidth = sectionRect.width / scale;
      const sectionHeight = sectionRect.height / scale;
      snapTargetsX.push(0, sectionWidth / 2, sectionWidth);
      snapTargetsY.push(0, sectionHeight / 2, sectionHeight);
      sectionElement.querySelectorAll<HTMLElement>('[data-homepage-canvas-element]').forEach((candidate) => {
        if (candidate === root || candidate.contains(root) || root.contains(candidate)) return;
        const candidateRect = candidate.getBoundingClientRect();
        const left = (candidateRect.left - sectionRect.left) / scale;
        const top = (candidateRect.top - sectionRect.top) / scale;
        const right = (candidateRect.right - sectionRect.left) / scale;
        const bottom = (candidateRect.bottom - sectionRect.top) / scale;
        snapTargetsX.push(left, (left + right) / 2, right);
        snapTargetsY.push(top, (top + bottom) / 2, bottom);
      });
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
      startOffsetX: settings.offsetXPx,
      startOffsetY: settings.offsetYPx,
      startWidth: settings.widthPx > 0 ? settings.widthPx : root.offsetWidth,
      startHeight: settings.heightPx > 0 ? settings.heightPx : root.offsetHeight,
      startLeft,
      startTop,
      visualWidth,
      visualHeight,
      snapTargetsX,
      snapTargetsY,
      sectionElement,
      scale,
      moved: false
    };
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const interaction = interactionRef.current;
    if (!interaction || interaction.pointerId !== event.pointerId || !onStyleChange) return;
    const deltaX = (event.clientX - interaction.startClientX) / interaction.scale;
    const deltaY = (event.clientY - interaction.startClientY) / interaction.scale;
    if (Math.abs(deltaX) + Math.abs(deltaY) > 2) interaction.moved = true;

    if (interaction.kind === 'move') {
      const snappedX = snapCanvasOffsetToElements({
        startOffset: interaction.startOffsetX,
        startPosition: interaction.startLeft,
        delta: deltaX,
        size: interaction.visualWidth,
        targets: interaction.snapTargetsX,
        options: editorOptions
      });
      const snappedY = snapCanvasOffsetToElements({
        startOffset: interaction.startOffsetY,
        startPosition: interaction.startTop,
        delta: deltaY,
        size: interaction.visualHeight,
        targets: interaction.snapTargetsY,
        options: editorOptions
      });
      onStyleChange(elementId, {
        offsetXPx: snappedX.value,
        offsetYPx: snappedY.value
      });
      reportHomepageCanvasGuides(interaction.sectionElement, { x: snappedX.guide, y: snappedY.guide });
      return;
    }

    const snappedWidth = snapCanvasSizeToElements({
      value: interaction.startWidth + deltaX,
      startPosition: interaction.startLeft,
      targets: interaction.snapTargetsX,
      options: editorOptions
    });
    const snappedHeight = snapCanvasSizeToElements({
      value: interaction.startHeight + deltaY,
      startPosition: interaction.startTop,
      targets: interaction.snapTargetsY,
      options: editorOptions
    });
    onStyleChange(elementId, {
      widthPx: snappedWidth.value,
      heightPx: snappedHeight.value
    });
    reportHomepageCanvasGuides(interaction.sectionElement, { x: snappedWidth.guide, y: snappedHeight.guide });
  };

  const endInteraction = (event: ReactPointerEvent<HTMLDivElement>) => {
    const interaction = interactionRef.current;
    if (!interaction || interaction.pointerId !== event.pointerId) return;
    suppressClickRef.current = interaction.moved;
    interactionRef.current = null;
    reportHomepageCanvasGuides(interaction.sectionElement, { x: null, y: null });
    rootRef.current?.releasePointerCapture?.(event.pointerId);
  };

  const commitText = () => {
    if (!editableText || !textRef.current) return;
    const nextValue = textRef.current.innerText.replace(/\r\n/g, '\n').trim();
    setEditing(false);
    if (nextValue !== (text ?? '')) onTextChange?.(nextValue);
  };

  const alignmentTranslate = settings.horizontalAlign === 'center'
    ? `calc(-50% + ${settings.offsetXPx}px)`
    : settings.horizontalAlign === 'right'
      ? `calc(-100% + ${settings.offsetXPx}px)`
      : `${settings.offsetXPx}px`;
  const left = layout === 'absolute-fill'
    ? 0
    : settings.horizontalAlign === 'center'
      ? '50%'
      : settings.horizontalAlign === 'right'
        ? '100%'
        : 0;
  const content = hasExplicitSize && sizedChildren ? sizedChildren : children;
  const elementStyle: CSSProperties = {
    position: layout === 'absolute-fill' ? 'absolute' : 'relative',
    top: layout === 'absolute-fill' ? 0 : undefined,
    left,
    transform: `translate3d(${layout === 'absolute-fill' ? `${settings.offsetXPx}px` : alignmentTranslate}, ${settings.offsetYPx}px, 0)`,
    width: settings.widthPx > 0 ? settings.widthPx : layout === 'fit' ? 'fit-content' : '100%',
    maxWidth: isText && settings.widthPx === 0 ? '20rem' : undefined,
    height: settings.heightPx > 0 ? settings.heightPx : layout === 'absolute-fill' ? '100%' : undefined,
    minHeight: preview && isText && !text ? 24 : undefined,
    overflow: hasExplicitSize ? 'hidden' : undefined,
    paddingTop: settings.paddingTopPx,
    paddingRight: settings.paddingRightPx,
    paddingBottom: settings.paddingBottomPx,
    paddingLeft: settings.paddingLeftPx,
    marginTop: settings.marginTopPx,
    marginRight: settings.marginRightPx,
    marginBottom: settings.marginBottomPx,
    marginLeft: settings.marginLeftPx,
    zIndex: settings.zIndex,
    color: inheritTextColor ? 'inherit' : settings.color || undefined,
    fontFamily: resolveWebsiteFontStack(settings.fontFamily),
    fontSize: isText ? settings.fontSizePx : visualScaleWithHeight && settings.heightPx > 0 ? settings.heightPx : undefined,
    fontWeight: settings.fontWeight,
    fontStyle: settings.italic ? 'italic' : 'normal',
    textDecorationLine: settings.underline ? 'underline' : 'none',
    lineHeight: settings.lineHeight,
    letterSpacing: settings.letterSpacingPx,
    textAlign: settings.textAlign,
    opacity: 1,
    cursor: preview ? settings.locked ? 'default' : editing ? 'text' : 'move' : undefined,
    touchAction: preview ? 'none' : undefined
  };

  return (
    <div
      ref={rootRef}
      data-homepage-canvas-element
      data-homepage-category-label={categoryLabelSlug}
      data-canvas-element-id={elementId}
      data-canvas-element-selected={selected || undefined}
      data-canvas-element-hidden={!settings.visible || undefined}
      data-canvas-element-editing={editing || undefined}
      className={classNames(
        'group/canvas-element box-border',
        className,
        selected && adminEditorSelectionOutlineTokenClasses
      )}
      style={elementStyle}
      onPointerDown={(event) => {
        const target = event.target instanceof Element ? event.target : null;
        const nestedCanvasElement = target?.closest('[data-homepage-canvas-element]');
        if (nestedCanvasElement && nestedCanvasElement !== rootRef.current) return;
        if (target?.closest('[data-canvas-resize-handle], [data-canvas-action], [contenteditable="true"]')) return;
        beginInteraction('move', event);
      }}
      onPointerMove={handlePointerMove}
      onPointerUp={endInteraction}
      onPointerCancel={endInteraction}
      onClick={(event) => {
        if (!preview) return;
        event.preventDefault();
        event.stopPropagation();
        if (suppressClickRef.current) {
          suppressClickRef.current = false;
          return;
        }
        onSelect?.(elementId);
        if (editableText) {
          setEditing(true);
          window.requestAnimationFrame(() => {
            if (textRef.current && !text) textRef.current.textContent = '';
            textRef.current?.focus();
          });
        }
      }}
      onDoubleClick={(event) => {
        if (!preview || !editableText) return;
        event.preventDefault();
        event.stopPropagation();
        onSelect?.(elementId);
        setEditing(true);
        window.requestAnimationFrame(() => textRef.current?.focus());
      }}
    >
      {isText ? (() => {
        const textNode = createElement(textTag, {
          ref: (node: HTMLElement | null) => { textRef.current = node; },
          className: classNames('block min-h-[1em] whitespace-pre-wrap outline-none', textClassName, !text && textPlaceholder && preview && !editing && 'text-slate-400'),
          style: { color: 'inherit', fontFamily: 'inherit', fontSize: 'inherit', fontWeight: 'inherit', fontStyle: 'inherit', lineHeight: 'inherit', letterSpacing: 'inherit', textAlign: 'inherit', textDecorationLine: 'inherit' },
          contentEditable: editing,
          suppressContentEditableWarning: true,
          role: preview && editableText ? 'textbox' : undefined,
          'aria-label': preview ? textLabel : undefined,
          'aria-multiline': preview && editableText ? true : undefined,
          onInput: editableText ? () => {
            if (textRef.current) onTextChange?.(textRef.current.innerText.replace(/\r\n/g, '\n'));
          } : undefined,
          onBlur: commitText,
          onKeyDown: (event: ReactKeyboardEvent<HTMLElement>) => {
            if (event.key === 'Escape') {
              event.preventDefault();
              if (textRef.current) textRef.current.textContent = text ?? '';
              setEditing(false);
              textRef.current?.blur();
            } else if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
              event.preventDefault();
              textRef.current?.blur();
            }
          }
        }, text || (preview && textPlaceholder && !editing ? textPlaceholder : ''));

        if (href && !editing) {
          return (
            <Link
              href={href}
              prefetch={false}
              className={linkClassName}
              style={{ color: 'inherit', fontFamily: 'inherit', fontSize: 'inherit', fontWeight: 'inherit', fontStyle: 'inherit', lineHeight: 'inherit', letterSpacing: 'inherit', textDecorationLine: 'inherit' }}
            >
              {textNode}
              {trailingContent}
            </Link>
          );
        }

        return <>{textNode}{trailingContent}</>;
      })() : content}

      {preview && selected && !settings.locked ? (
        <span
          data-canvas-resize-handle
          role="button"
          aria-label={`Spremeni velikost: ${textLabel || elementId}`}
          title="Povleci za spremembo velikosti"
          className="absolute -bottom-1.5 -right-1.5 z-[74] h-3 w-3 cursor-nwse-resize rounded-[3px] border-2 border-white bg-[color:var(--blue-500)] shadow-sm"
          onPointerDown={(event) => beginInteraction('resize', event)}
        />
      ) : null}
    </div>
  );
}

function SectionFrame({
  sectionId,
  selectedSectionId,
  selectedElementId,
  onSelectSection,
  onSelectElement,
  onMoveSection,
  canMoveUp = false,
  canMoveDown = false,
  hidden = false,
  onRestoreHidden,
  preview,
  editorActive = false,
  editorOptions = DEFAULT_HOMEPAGE_CANVAS_EDITOR_OPTIONS,
  editorContentScale = 1,
  children,
  className,
  style
}: SectionFrameProps) {
  const sectionRef = useRef<HTMLElement | null>(null);
  const [snapGuides, setSnapGuides] = useState<HomepageCanvasGuideDetail>({ x: null, y: null });
  const [sectionMeasurement, setSectionMeasurement] = useState<HomepageSectionMeasurement | null>(null);
  const selected = preview && (selectedElementId === `section:${sectionId}` || (!selectedElementId && selectedSectionId === sectionId));
  const selectedChild = Boolean(selectedElementId && selectedElementId !== `section:${sectionId}`);
  const visualEditorGridSize = Math.max(2, editorOptions.gridSize) * editorContentScale;
  const visualRulerStep = 8 * editorContentScale;
  const visualRulerTickStart = Math.max(0, visualRulerStep - 1);

  useEffect(() => {
    const section = sectionRef.current;
    if (!section) return undefined;
    const handleGuides = (event: Event) => {
      setSnapGuides((event as CustomEvent<HomepageCanvasGuideDetail>).detail);
    };
    section.addEventListener(HOMEPAGE_CANVAS_GUIDE_EVENT, handleGuides);
    return () => section.removeEventListener(HOMEPAGE_CANVAS_GUIDE_EVENT, handleGuides);
  }, []);

  useLayoutEffect(() => {
    if (!preview || !editorActive || sectionId === 'hero' || !editorOptions.measurements || !selectedChild || !selectedElementId) {
      setSectionMeasurement(null);
      return undefined;
    }

    const section = sectionRef.current;
    const selectedNode = Array.from(section?.querySelectorAll<HTMLElement>('[data-canvas-element-id]') ?? [])
      .find((node) => node.dataset.canvasElementId === selectedElementId);
    if (!section || !selectedNode) {
      setSectionMeasurement(null);
      return undefined;
    }

    const updateMeasurement = () => {
      const sectionRect = section.getBoundingClientRect();
      const selectedRect = selectedNode.getBoundingClientRect();
      const scaleX = section.offsetWidth > 0 ? sectionRect.width / section.offsetWidth : 1;
      const scaleY = section.offsetHeight > 0 ? sectionRect.height / section.offsetHeight : scaleX;
      const selectedLogical = {
        left: (selectedRect.left - sectionRect.left) / (scaleX || 1),
        top: (selectedRect.top - sectionRect.top) / (scaleY || 1),
        right: (selectedRect.right - sectionRect.left) / (scaleX || 1),
        bottom: (selectedRect.bottom - sectionRect.top) / (scaleY || 1)
      };
      const nearestDistances: number[] = [];

      section.querySelectorAll<HTMLElement>('[data-homepage-canvas-element]').forEach((candidate) => {
        if (candidate === selectedNode || candidate.contains(selectedNode) || selectedNode.contains(candidate)) return;
        const candidateRect = candidate.getBoundingClientRect();
        const candidateLogical = {
          left: (candidateRect.left - sectionRect.left) / (scaleX || 1),
          top: (candidateRect.top - sectionRect.top) / (scaleY || 1),
          right: (candidateRect.right - sectionRect.left) / (scaleX || 1),
          bottom: (candidateRect.bottom - sectionRect.top) / (scaleY || 1)
        };
        const horizontalGap = Math.max(candidateLogical.left - selectedLogical.right, selectedLogical.left - candidateLogical.right, 0);
        const verticalGap = Math.max(candidateLogical.top - selectedLogical.bottom, selectedLogical.top - candidateLogical.bottom, 0);
        const gap = Math.max(horizontalGap, verticalGap);
        if (gap > 0) nearestDistances.push(gap);
      });

      setSectionMeasurement({
        left: Math.max(0, Math.round(selectedLogical.left)),
        top: Math.max(0, Math.round(selectedLogical.top)),
        right: Math.max(0, Math.round(section.offsetWidth - selectedLogical.right)),
        bottom: Math.max(0, Math.round(section.offsetHeight - selectedLogical.bottom)),
        width: Math.max(0, Math.round(selectedLogical.right - selectedLogical.left)),
        height: Math.max(0, Math.round(selectedLogical.bottom - selectedLogical.top)),
        nearest: nearestDistances.length > 0 ? Math.round(Math.min(...nearestDistances)) : null
      });
    };

    updateMeasurement();
    const resizeObserver = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(updateMeasurement);
    resizeObserver?.observe(section);
    resizeObserver?.observe(selectedNode);
    window.addEventListener('resize', updateMeasurement);
    return () => {
      resizeObserver?.disconnect();
      window.removeEventListener('resize', updateMeasurement);
    };
  }, [children, editorActive, editorOptions.measurements, preview, sectionId, selectedChild, selectedElementId]);

  if (preview && hidden) {
    return (
      <CanvasHiddenElementFlag
        elementId={`section:${sectionId}`}
        label={homepageSectionLabels[sectionId]}
        kind="homepage"
        onRestore={() => onRestoreHidden?.()}
      />
    );
  }

  return (
    <section
      ref={sectionRef}
      data-homepage-section={sectionId}
      data-homepage-section-hidden={hidden || undefined}
      data-admin-editor-selection-frame={selected || undefined}
      data-homepage-editor-active={editorActive || undefined}
      onClickCapture={(event) => {
        const target = event.target instanceof Element ? event.target : null;
        if (target?.closest('[data-homepage-canvas-element], [data-homepage-section-controls], [data-canvas-hidden-flag], [data-canvas-hidden-popover]')) return;
        if (preview && onSelectSection) event.preventDefault();
        onSelectSection?.(sectionId);
        onSelectElement?.(`section:${sectionId}`);
      }}
      className={classNames(
        'group/section relative',
        preview && onSelectSection && 'cursor-pointer',
        selected && adminEditorSelectionOutlineTokenClasses,
        className
      )}
      style={style}
    >
      {preview && editorActive && editorOptions.grid ? (
        <div
          aria-hidden="true"
          data-homepage-editor-aid="grid"
          data-editor-section={sectionId}
          data-editor-grid-size={Math.max(2, editorOptions.gridSize)}
          className="pointer-events-none absolute inset-0 z-[31] opacity-40"
          style={{
            backgroundImage: 'linear-gradient(to right, rgba(56,189,248,.22) 1px, transparent 1px), linear-gradient(to bottom, rgba(56,189,248,.22) 1px, transparent 1px)',
            backgroundSize: `${visualEditorGridSize}px ${visualEditorGridSize}px`
          }}
        />
      ) : null}
      {preview && editorActive && editorOptions.guides && selectedChild && sectionId !== 'hero' ? (
        <div
          aria-hidden="true"
          data-homepage-editor-aid="guides"
          data-editor-section={sectionId}
          className="pointer-events-none absolute inset-0 z-[32] text-[9px] font-bold text-fuchsia-700"
          style={{ textShadow: '0 1px 2px rgba(255,255,255,.95), 0 0 4px rgba(255,255,255,.8)' }}
        >
          <span className="absolute inset-y-0 left-1/2 w-px bg-fuchsia-500/25" />
          <span className="absolute inset-x-0 top-1/2 h-px bg-fuchsia-500/25" />
          {snapGuides.x !== null ? (
            <>
              <span className="absolute inset-y-0 w-px bg-fuchsia-500/80" style={{ left: `${snapGuides.x}px` }} />
              <span className="absolute top-3 translate-x-2 whitespace-nowrap" style={{ left: `${snapGuides.x}px` }}>{Math.round(snapGuides.x)} px</span>
            </>
          ) : null}
          {snapGuides.y !== null ? (
            <>
              <span className="absolute inset-x-0 h-px bg-fuchsia-500/80" style={{ top: `${snapGuides.y}px` }} />
              <span className="absolute left-3 whitespace-nowrap" style={{ top: `${snapGuides.y}px`, transform: 'translateY(calc(-100% - 6px))' }}>{Math.round(snapGuides.y)} px</span>
            </>
          ) : null}
        </div>
      ) : null}
      {preview && editorActive && editorOptions.rulers ? (
        <div
          aria-hidden="true"
          data-homepage-editor-aid="rulers"
          data-editor-section={sectionId}
          className="pointer-events-none absolute inset-0 z-[33] text-[9px] font-semibold text-sky-50"
        >
          <span
            className="absolute inset-x-0 top-0 h-5 border-b border-sky-300/45 bg-slate-950/30"
            style={{ backgroundImage: `repeating-linear-gradient(to right, transparent 0, transparent ${visualRulerTickStart}px, rgba(125,211,252,.62) ${visualRulerTickStart}px, rgba(125,211,252,.62) ${visualRulerStep}px)` }}
          />
          <span
            className="absolute inset-y-0 left-0 w-5 border-r border-sky-300/45 bg-slate-950/30"
            style={{ backgroundImage: `repeating-linear-gradient(to bottom, transparent 0, transparent ${visualRulerTickStart}px, rgba(125,211,252,.62) ${visualRulerTickStart}px, rgba(125,211,252,.62) ${visualRulerStep}px)` }}
          />
          <span className="absolute left-1 top-1">0</span>
        </div>
      ) : null}
      {preview && editorActive && sectionMeasurement ? (
        <div
          aria-hidden="true"
          data-homepage-editor-aid="measurements"
          data-editor-section={sectionId}
          className="pointer-events-none absolute inset-0 z-[64] text-[10px] font-bold leading-none text-sky-700"
          style={{ textShadow: '0 1px 2px rgba(255,255,255,.98), 0 0 4px rgba(255,255,255,.85)' }}
        >
          <span className="absolute whitespace-nowrap rounded bg-white/80 px-1 py-0.5" style={{ left: sectionMeasurement.left, top: Math.max(2, sectionMeasurement.top - 18) }}>
            {sectionMeasurement.width} × {sectionMeasurement.height} px
          </span>
          <span className="absolute h-px border-t border-dashed border-sky-500/55" style={{ left: 0, top: sectionMeasurement.top + sectionMeasurement.height / 2, width: sectionMeasurement.left }} />
          <span className="absolute h-px border-t border-dashed border-sky-500/55" style={{ left: sectionMeasurement.left + sectionMeasurement.width, right: 0, top: sectionMeasurement.top + sectionMeasurement.height / 2 }} />
          <span className="absolute w-px border-l border-dashed border-sky-500/55" style={{ left: sectionMeasurement.left + sectionMeasurement.width / 2, top: 0, height: sectionMeasurement.top }} />
          <span className="absolute w-px border-l border-dashed border-sky-500/55" style={{ left: sectionMeasurement.left + sectionMeasurement.width / 2, top: sectionMeasurement.top + sectionMeasurement.height, bottom: 0 }} />
          <span className="absolute whitespace-nowrap" style={{ left: Math.max(22, sectionMeasurement.left / 2), top: sectionMeasurement.top + sectionMeasurement.height / 2 - 14, transform: 'translateX(-50%)' }}>{sectionMeasurement.left}px</span>
          <span className="absolute whitespace-nowrap" style={{ right: Math.max(22, sectionMeasurement.right / 2), top: sectionMeasurement.top + sectionMeasurement.height / 2 - 14, transform: 'translateX(50%)' }}>{sectionMeasurement.right}px</span>
          <span className="absolute whitespace-nowrap" style={{ left: sectionMeasurement.left + sectionMeasurement.width / 2 + 6, top: Math.max(14, sectionMeasurement.top / 2), transform: 'translateY(-50%)' }}>{sectionMeasurement.top}px</span>
          <span className="absolute whitespace-nowrap" style={{ left: sectionMeasurement.left + sectionMeasurement.width / 2 + 6, bottom: Math.max(14, sectionMeasurement.bottom / 2), transform: 'translateY(50%)' }}>{sectionMeasurement.bottom}px</span>
          {sectionMeasurement.nearest !== null ? <span className="absolute bottom-2 right-2 rounded bg-white/85 px-1.5 py-1">Najbližje: {sectionMeasurement.nearest}px</span> : null}
        </div>
      ) : null}
      {selected && onMoveSection ? (
        <div
          data-homepage-section-controls
          className="absolute left-3 top-3 z-[75] inline-flex items-center gap-0.5 rounded-xl border border-white/15 bg-black/90 p-1 text-slate-200 shadow-[0_16px_40px_rgba(30,41,53,0.38),0_3px_12px_rgba(30,41,53,0.28)] backdrop-blur-xl"
          onClick={(event) => event.stopPropagation()}
          onPointerDown={(event) => event.stopPropagation()}
        >
          <span className="grid h-7 w-7 place-items-center text-slate-300" title="Izbrana sekcija">
            <GripVertical className="h-4 w-4" />
          </span>
          <button
            type="button"
            aria-label="Premakni sekcijo navzgor"
            title="Premakni sekcijo navzgor"
            disabled={!canMoveUp}
            className="grid h-7 w-7 place-items-center rounded-md text-slate-200 transition hover:bg-white/10 hover:text-white disabled:opacity-30"
            onClick={() => onMoveSection(sectionId, -1)}
          >
            <ChevronUp className="h-4 w-4" />
          </button>
          <button
            type="button"
            aria-label="Premakni sekcijo navzdol"
            title="Premakni sekcijo navzdol"
            disabled={!canMoveDown}
            className="grid h-7 w-7 place-items-center rounded-md text-slate-200 transition hover:bg-white/10 hover:text-white disabled:opacity-30"
            onClick={() => onMoveSection(sectionId, 1)}
          >
            <ChevronDown className="h-4 w-4" />
          </button>
        </div>
      ) : null}
      {children}
    </section>
  );
}

function buttonClassName(style: HomepageButtonStyle, tone: 'primary' | 'secondary') {
  const base =
    'inline-flex h-12 items-center justify-center gap-3 rounded-lg border border-transparent px-5 text-[15px] font-semibold transition focus-visible:border-white focus-visible:outline-none focus-visible:ring-0 focus-visible:shadow-none';

  if (tone === 'secondary') {
    if (style === 'soft') return `${base} border border-white/25 bg-white/12 text-white hover:bg-white/18`;
    if (style === 'outline') return `${base} border border-white/55 bg-transparent text-white hover:bg-white/10`;
    return `${base} border border-white/30 bg-white/10 text-white hover:bg-white/15`;
  }

  if (style === 'soft') return `${base} bg-white text-[#111827] hover:bg-slate-100`;
  if (style === 'outline') return `${base} border border-white/70 bg-white/10 text-white hover:bg-white/18`;
  return `${base} bg-[color:var(--blue-500)] text-white shadow-[0_12px_30px_rgba(25,130,191,0.28)] hover:bg-[color:var(--blue-600)]`;
}

function getHighlightedTextStyle(enabled: boolean, color: string): CSSProperties {
  if (!enabled) return {};

  return {
    backgroundColor: color || '#ffffff',
    borderRadius: '0.12em',
    boxDecorationBreak: 'clone',
    color: '#0f172a',
    padding: '0 0.08em',
    WebkitBoxDecorationBreak: 'clone'
  } as CSSProperties;
}

function getHeroTitleTextStyle(hero: HomepageHeroSettings): CSSProperties {
  return {
    fontFamily: resolveWebsiteFontStack(hero.titleFontFamily),
    fontSize: `${hero.titleFontSizePx}px`,
    fontStyle: hero.titleItalic ? 'italic' : undefined,
    fontWeight: hero.titleBold ? 800 : 600,
    textDecorationLine: hero.titleUnderline ? 'underline' : undefined,
    textTransform: hero.titleTransform === 'uppercase' ? 'uppercase' : undefined
  };
}

function getHeroDescriptionTextStyle(hero: HomepageHeroSettings): CSSProperties {
  return {
    fontFamily: resolveWebsiteFontStack(hero.descriptionFontFamily),
    fontSize: `${hero.descriptionFontSizePx}px`,
    fontStyle: hero.descriptionItalic ? 'italic' : undefined,
    fontWeight: hero.descriptionBold ? 700 : 400,
    lineHeight: 1.65,
    textDecorationLine: hero.descriptionUnderline ? 'underline' : undefined
  };
}

function resolveHeroTextBlockForDevice(block: HomepageHeroTextBlock, device?: HomepagePreviewDevice) {
  const deviceSettings = device ? block.responsive[device] : undefined;

  return {
    ...block,
    ...deviceSettings
  };
}

function getHeroTextBlockStyle(block: HomepageHeroTextBlock, device?: HomepagePreviewDevice): CSSProperties {
  const resolvedBlock = resolveHeroTextBlockForDevice(block, device);

  return {
    fontFamily: resolveWebsiteFontStack(resolvedBlock.fontFamily),
    fontSize: `${resolvedBlock.fontSizePx}px`,
    fontStyle: resolvedBlock.italic ? 'italic' : undefined,
    fontWeight: resolvedBlock.bold ? 800 : 500,
    lineHeight: 1.25,
    textDecorationLine: resolvedBlock.underline ? 'underline' : undefined
  };
}

function HeroTechnicalGuides({
  hero,
  page,
  viewportWidth,
  editorContentScale = 1
}: {
  hero: HomepageHeroSettings;
  page: HomepagePageSettings;
  viewportWidth: number;
  editorContentScale?: number;
}) {
  const guideRef = useRef<HTMLDivElement | null>(null);
  const [measuredContent, setMeasuredContent] = useState<HeroContentBounds | null>(null);

  useLayoutEffect(() => {
    const guide = guideRef.current;
    const root = guide?.closest<HTMLElement>('[data-homepage-hero-root]');
    const content = root?.querySelector<HTMLElement>('[data-homepage-hero-content]');
    if (!root || !content) return undefined;

    const updateMeasuredContent = () => {
      const logicalWidth = getCurrentLogicalViewportWidth(root, viewportWidth);
      const next = measureHeroContentBounds(root, logicalWidth);
      setMeasuredContent((current) => {
        if (!next) return current === null ? current : null;
        if (
          current
          && Math.abs(current.contentLeft - next.contentLeft) < 0.1
          && Math.abs(current.contentWidth - next.contentWidth) < 0.1
        ) return current;
        return next;
      });
    };

    updateMeasuredContent();
    const resizeObserver = typeof ResizeObserver === 'undefined'
      ? null
      : new ResizeObserver(updateMeasuredContent);
    resizeObserver?.observe(root);
    resizeObserver?.observe(content);
    window.addEventListener('resize', updateMeasuredContent);
    return () => {
      resizeObserver?.disconnect();
      window.removeEventListener('resize', updateMeasuredContent);
    };
  }, [viewportWidth]);

  const metrics = getHeroTextMetrics(hero, page, viewportWidth, measuredContent);
  const percent = (value: number) => `${(value / viewportWidth) * 100}%`;
  const mediaRight = metrics.mediaLeft + metrics.mediaWidthPx;
  const mediaDelta = hero.mediaWidthPercent - 100;
  const mediaLabel = mediaDelta < 0
    ? `Medij ${hero.mediaWidthPercent}% · stisk ${Math.abs(mediaDelta)}%`
    : mediaDelta > 0
      ? `Medij ${hero.mediaWidthPercent}% · razširitev +${mediaDelta}%`
      : 'Medij 100% · brez stiska';
  const centerLabel = metrics.centerDelta === 0 ? 'Sredina 0 px' : `Sredina ${metrics.centerDelta > 0 ? '+' : ''}${metrics.centerDelta} px`;
  const guideLabelClassName = 'absolute whitespace-nowrap text-sky-200/90';
  const compactGuides = viewportWidth < 640;
  const clampedLabelX = (value: number, edgePadding: number) => `${clampNumber(value, edgePadding, Math.max(edgePadding, viewportWidth - edgePadding))}px`;

  return (
    <div
      ref={guideRef}
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 z-30 text-[11px] font-semibold leading-none"
      style={{
        fontSize: `${11 / editorContentScale}px`,
        textShadow: '0 1px 2px rgba(2, 6, 23, .95), 0 0 4px rgba(2, 6, 23, .65)'
      }}
    >
      <div className="absolute inset-y-0 w-px bg-sky-300/25" style={{ left: percent(viewportWidth / 2) }} />
      <div className={classNames(guideLabelClassName, 'translate-x-2')} style={{ left: percent(viewportWidth / 2), top: 12 }}>
        {centerLabel}
      </div>

      <div className="absolute inset-y-0 w-px border-l border-dashed border-sky-300/25" style={{ left: percent(metrics.contentLeft) }} />
      <div className="absolute inset-y-0 w-px border-l border-dashed border-sky-300/25" style={{ left: percent(metrics.contentRight) }} />
      <div className={classNames(guideLabelClassName, 'translate-x-2')} style={{ left: percent(metrics.contentLeft), top: compactGuides ? 52 : 12 }}>
        Vsebina {Math.round(metrics.contentWidth)} px
      </div>

      <div className="absolute bottom-20 h-px bg-sky-300/50" style={{ left: percent(metrics.contentLeft), width: percent(metrics.leftDistance) }} />
      <div className="absolute bottom-20 h-3 w-px translate-y-1/2 bg-sky-300/50" style={{ left: percent(metrics.contentLeft) }} />
      <div className="absolute bottom-20 h-3 w-px translate-y-1/2 bg-sky-300/50" style={{ left: percent(metrics.textLeft) }} />
      <div className={classNames(guideLabelClassName, 'bottom-[5.5rem]')} style={{ left: clampedLabelX((metrics.contentLeft + metrics.textLeft) / 2, 28), transform: 'translateX(-50%)' }}>
        Levo {metrics.leftDistance} px
      </div>

      <div className="absolute bottom-14 h-px bg-sky-300/50" style={{ left: percent(metrics.textLeft), width: percent(metrics.textWidth) }} />
      <div className="absolute bottom-14 h-3 w-px translate-y-1/2 bg-sky-300/50" style={{ left: percent(metrics.textLeft) }} />
      <div className="absolute bottom-14 h-3 w-px translate-y-1/2 bg-sky-300/50" style={{ left: percent(metrics.textRight) }} />
      <div className={classNames(guideLabelClassName, 'bottom-16')} style={{ left: clampedLabelX((metrics.textLeft + metrics.textRight) / 2, 68), transform: 'translateX(-50%)' }}>
        Besedilo {Math.round(metrics.textWidth)} px · {metrics.textWidthPercent}%
      </div>

      <div className="absolute bottom-8 h-px bg-sky-300/50" style={{ left: percent(metrics.textRight), width: percent(metrics.rightDistance) }} />
      <div className="absolute bottom-8 h-3 w-px translate-y-1/2 bg-sky-300/50" style={{ left: percent(metrics.textRight) }} />
      <div className="absolute bottom-8 h-3 w-px translate-y-1/2 bg-sky-300/50" style={{ left: percent(metrics.contentRight) }} />
      <div className={classNames(guideLabelClassName, 'bottom-10')} style={{ left: clampedLabelX((metrics.textRight + metrics.contentRight) / 2, 38), transform: 'translateX(-50%)' }}>
        Desno {metrics.rightDistance} px
      </div>

      <div className={classNames(guideLabelClassName, 'right-6 text-right')} style={{ top: compactGuides ? 32 : 12 }}>
        Višina {hero.heightPx} px · Y {metrics.textOffsetY > 0 ? '+' : ''}{metrics.textOffsetY} px
      </div>
      <div className="absolute bottom-4 top-4 w-px bg-sky-300/40" style={{ right: 16 }} />
      <div className="absolute right-[12px] top-4 h-px w-2 bg-sky-300/40" />
      <div className="absolute bottom-4 right-[12px] h-px w-2 bg-sky-300/40" />

      <div className="absolute top-16 h-px bg-cyan-300/45" style={{ left: percent(metrics.mediaLeft), width: percent(metrics.mediaWidthPx) }} />
      <div className="absolute top-[58px] h-4 w-px bg-cyan-300/45" style={{ left: percent(metrics.mediaLeft) }} />
      <div className="absolute top-[58px] h-4 w-px bg-cyan-300/45" style={{ left: percent(mediaRight) }} />
      <div className={classNames(guideLabelClassName, 'top-[74px] text-cyan-200/90')} style={{ left: percent((metrics.mediaLeft + mediaRight) / 2), transform: 'translateX(-50%)' }}>
        {mediaLabel}
      </div>
    </div>
  );
}

function HomepageHero({
  hero,
  page,
  canvas,
  preview,
  showTechnicalGuides,
  previewViewportWidth,
  previewDevice,
  editorContentScale = 1,
  selectedElementId,
  onSelect,
  onSelectElement,
  onCanvasElementStyleChange,
  onRestoreHiddenElement,
  editorOptions = DEFAULT_HOMEPAGE_CANVAS_EDITOR_OPTIONS,
  onTextPositionChange,
  onTextContentChange,
  onTextBlockChange
}: {
  hero: HomepageHeroSettings;
  page: HomepagePageSettings;
  canvas: HomepageSettings['canvas'];
  preview?: boolean;
  showTechnicalGuides?: boolean;
  previewViewportWidth?: number;
  previewDevice?: HomepagePreviewDevice;
  editorContentScale?: number;
  selectedElementId?: string | null;
  onSelect?: () => void;
  onSelectElement?: (elementId: string | null) => void;
  onCanvasElementStyleChange?: (elementId: string, updates: Partial<HomepageCanvasElementDeviceSettings>) => void;
  onRestoreHiddenElement?: (elementId: string) => void;
  editorOptions?: HomepageCanvasEditorOptions;
  onTextPositionChange?: (updates: HeroPositionUpdates) => void;
  onTextContentChange?: (updates: HeroTextContentUpdates) => void;
  onTextBlockChange?: (blockId: string, updates: HeroTextBlockUpdates) => void;
}) {
  const slides = hero.slides.filter((slide) => slide.src.trim());
  const [activeIndex, setActiveIndex] = useState(0);
  const [selectedLayer, setSelectedLayer] = useState<HeroCanvasLayer | null>(null);
  const [editingLayer, setEditingLayer] = useState<HeroEditableLayer | null>(null);
  const [activeManipulation, setActiveManipulation] = useState<'drag' | 'resize' | null>(null);
  const [snapGuides, setSnapGuides] = useState<{ x: number | null; y: number | null }>({ x: null, y: null });
  const [measurement, setMeasurement] = useState<null | {
    left: number;
    top: number;
    right: number;
    bottom: number;
    width: number;
    height: number;
    nearest: number | null;
  }>(null);
  const heroRootRef = useRef<HTMLDivElement | null>(null);
  const canvasElementRefs = useRef<Record<string, HTMLElement | null>>({});
  const titleEditRef = useRef<HTMLHeadingElement | null>(null);
  const descriptionEditRef = useRef<HTMLParagraphElement | null>(null);
  const textBlockEditRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const activeSlide = slides[activeIndex] ?? slides[0] ?? hero.slides[0];
  const hasMultipleSlides = slides.length > 1;
  const inlineEditorEnabled = Boolean(preview);
  const activeDevice = previewDevice ?? 'desktop';
  const dragRef = useRef<null | {
    target: HeroDragTarget;
    pointerId: number;
    startClientX: number;
    startClientY: number;
    startX: number;
    startY: number;
    originX: number;
    originY: number;
    width: number;
    height: number;
    scaleX: number;
    scaleY: number;
    snapX: number[];
    snapY: number[];
  }>(null);
  const textBlockDragRef = useRef<null | {
    blockId: string;
    pointerId: number;
    startClientX: number;
    startClientY: number;
    startX: number;
    startY: number;
    originX: number;
    originY: number;
    width: number;
    height: number;
    scaleX: number;
    scaleY: number;
    snapX: number[];
    snapY: number[];
    resetHorizontalAlignment: boolean;
  }>(null);
  const resizeRef = useRef<null | {
    layer: HeroCanvasLayer;
    pointerId: number;
    startClientX: number;
    startClientY: number;
    startWidth: number;
    startHeight: number;
    startLeft: number;
    startTop: number;
    scaleX: number;
    scaleY: number;
    snapX: number[];
    snapY: number[];
  }>(null);

  useEffect(() => {
    setActiveIndex((current) => Math.min(current, Math.max(0, slides.length - 1)));
  }, [slides.length]);

  useEffect(() => {
    if (!hero.autoplay || !hasMultipleSlides) return undefined;
    const timer = window.setTimeout(() => {
      setActiveIndex((current) => (current + 1) % slides.length);
    }, hero.autoplayInterval);
    return () => window.clearTimeout(timer);
  }, [activeIndex, hero.autoplay, hero.autoplayInterval, hasMultipleSlides, slides.length]);

  useEffect(() => {
    if (!inlineEditorEnabled) return undefined;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setEditingLayer(null);
      setSelectedLayer(null);
      onSelectElement?.(null);
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [inlineEditorEnabled, onSelectElement]);

  useEffect(() => {
    if (!selectedElementId?.startsWith('hero:')) {
      setSelectedLayer(null);
      setEditingLayer(null);
      return;
    }

    const layer = selectedElementId.slice('hero:'.length) as HeroCanvasLayer;
    setSelectedLayer(layer);
  }, [selectedElementId]);

  useEffect(() => {
    if (!inlineEditorEnabled || !selectedLayer) return undefined;

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target instanceof Element ? event.target : null;
      if (target?.closest('[data-homepage-hero-root], [data-homepage-preview-controls]')) return;
      setSelectedLayer(null);
      setEditingLayer(null);
    };

    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, [inlineEditorEnabled, selectedLayer]);

  useEffect(() => {
    if (!editingLayer) return;
    const frame = window.requestAnimationFrame(() => {
      const target =
        editingLayer === 'title'
          ? titleEditRef.current
          : editingLayer === 'description'
            ? descriptionEditRef.current
            : textBlockEditRefs.current[editingLayer.replace('textBlock:', '')];
      target?.focus();
      const selection = window.getSelection();
      const range = document.createRange();
      if (target && selection) {
        range.selectNodeContents(target);
        range.collapse(false);
        selection.removeAllRanges();
        selection.addRange(range);
      }
    });

    return () => window.cancelAnimationFrame(frame);
  }, [editingLayer]);

  const getLayerElementId = (layer: HeroCanvasLayer) => `hero:${layer}`;
  const getLayerCanvasSettings = (layer: HeroCanvasLayer) =>
    resolveHomepageCanvasElementDeviceSettings(canvas, getLayerElementId(layer), activeDevice);
  const getLayerBoxStyle = (layer: HeroCanvasLayer): CSSProperties => {
    const element = getLayerCanvasSettings(layer);
    const configured = Boolean(canvas.elements[getLayerElementId(layer)]);
    const supportsFlowAlignment = layer === 'title' || layer === 'description';
    const horizontalAlignment = element.horizontalAlign === 'center'
      ? 'center'
      : element.horizontalAlign === 'right'
        ? 'flex-end'
        : 'flex-start';

    return {
      alignSelf: configured && supportsFlowAlignment ? horizontalAlignment : undefined,
      width: configured && element.widthPx > 0 ? `${element.widthPx}px` : undefined,
      height: configured && element.heightPx > 0 ? `${element.heightPx}px` : undefined,
      paddingTop: configured ? `${element.paddingTopPx}px` : undefined,
      paddingRight: configured ? `${element.paddingRightPx}px` : undefined,
      paddingBottom: configured ? `${element.paddingBottomPx}px` : undefined,
      paddingLeft: configured ? `${element.paddingLeftPx}px` : undefined,
      marginTop: configured ? `${element.marginTopPx}px` : undefined,
      marginRight: configured ? `${element.marginRightPx}px` : undefined,
      marginBottom: configured ? `${element.marginBottomPx}px` : undefined,
      marginLeft: configured ? `${element.marginLeftPx}px` : undefined,
      zIndex: configured ? Math.max(1, element.zIndex) : undefined,
      textAlign: configured ? element.textAlign : undefined,
      color: configured ? element.color || undefined : undefined,
      fontFamily: configured && element.fontFamily ? resolveWebsiteFontStack(element.fontFamily) : undefined,
      fontSize: configured ? `${element.fontSizePx}px` : undefined,
      lineHeight: configured ? element.lineHeight : undefined,
      letterSpacing: configured ? `${element.letterSpacingPx}px` : undefined,
      fontWeight: configured ? element.fontWeight : undefined
    };
  };
  const getPreviewLayerBoxStyle = (layer: HeroCanvasLayer): CSSProperties => {
    if (!preview || !canvas.elements[getLayerElementId(layer)]) return {};

    const prefix = layer === 'primaryButton'
      ? 'primary-button'
      : layer === 'secondaryButton'
        ? 'secondary-button'
        : layer;
    const element = getLayerCanvasSettings(layer);

    return {
      width: `var(--preview-${prefix}-width, ${element.widthPx > 0 ? `${element.widthPx}px` : 'auto'})`,
      height: `var(--preview-${prefix}-height, ${element.heightPx > 0 ? `${element.heightPx}px` : 'auto'})`,
      paddingTop: `var(--preview-${prefix}-padding-top, ${element.paddingTopPx}px)`,
      paddingRight: `var(--preview-${prefix}-padding-right, ${element.paddingRightPx}px)`,
      paddingBottom: `var(--preview-${prefix}-padding-bottom, ${element.paddingBottomPx}px)`,
      paddingLeft: `var(--preview-${prefix}-padding-left, ${element.paddingLeftPx}px)`,
      marginTop: `var(--preview-${prefix}-margin-top, ${element.marginTopPx}px)`,
      marginRight: `var(--preview-${prefix}-margin-right, ${element.marginRightPx}px)`,
      marginBottom: `var(--preview-${prefix}-margin-bottom, ${element.marginBottomPx}px)`,
      marginLeft: `var(--preview-${prefix}-margin-left, ${element.marginLeftPx}px)`
    };
  };
  const getButtonAlignmentStyle = (layer: 'primaryButton' | 'secondaryButton'): CSSProperties => {
    if (!canvas.elements[getLayerElementId(layer)]) return {};
    const alignment = getLayerCanvasSettings(layer).horizontalAlign;
    if (alignment === 'center') return { marginLeft: 'auto', marginRight: 'auto' };
    if (alignment === 'right') return { marginLeft: 'auto' };
    return {};
  };
  const getLayerTextStyle = (layer: HeroCanvasLayer): CSSProperties => {
    const element = getLayerCanvasSettings(layer);
    if (!canvas.elements[getLayerElementId(layer)]) return {};
    return {
      color: element.color || undefined,
      fontFamily: element.fontFamily ? resolveWebsiteFontStack(element.fontFamily) : undefined,
      fontSize: `${element.fontSizePx}px`,
      lineHeight: element.lineHeight,
      letterSpacing: `${element.letterSpacingPx}px`,
      fontWeight: element.fontWeight,
      textAlign: element.textAlign
    };
  };
  const getPreviewLayerTextStyle = (layer: 'title' | 'description'): CSSProperties => {
    if (!preview) return {};

    const element = getLayerCanvasSettings(layer);
    const configured = Boolean(canvas.elements[getLayerElementId(layer)]);
    const fontSize = configured
      ? element.fontSizePx
      : layer === 'title'
        ? hero.titleFontSizePx
        : hero.descriptionFontSizePx;
    const lineHeight = configured ? element.lineHeight : layer === 'title' ? 1.08 : 1.65;
    const letterSpacing = configured ? element.letterSpacingPx : 0;
    const fontWeight = configured
      ? element.fontWeight
      : layer === 'title'
        ? hero.titleBold ? 800 : 600
        : hero.descriptionBold ? 700 : 400;

    return {
      fontSize: `var(--preview-${layer}-size, ${fontSize}px)`,
      lineHeight: `var(--preview-${layer}-line-height, ${lineHeight})`,
      letterSpacing: `var(--preview-${layer}-letter-spacing, ${letterSpacing}px)`,
      fontWeight: `var(--preview-${layer}-weight, ${fontWeight})`,
      fontVariationSettings: `"wght" var(--preview-${layer}-weight, ${fontWeight})`
    };
  };
  const registerCanvasElement = (layer: HeroCanvasLayer) => (node: HTMLElement | null) => {
    canvasElementRefs.current[layer] = node;
  };
  const buildSnapTargets = (layer: HeroCanvasLayer, excludedLayers: HeroCanvasLayer[] = []) => {
    const root = heroRootRef.current;
    if (!root) return { snapX: [0], snapY: [0] };
    const rootRect = root.getBoundingClientRect();
    const logicalWidth = getCurrentLogicalViewportWidth(root, previewViewportWidth);
    const scaleX = rootRect.width > 0 ? rootRect.width / logicalWidth : 1;
    const scaleY = rootRect.height > 0 ? rootRect.height / hero.heightPx : scaleX;
    const snapX = [0, logicalWidth / 2, logicalWidth];
    const snapY = [0, hero.heightPx / 2, hero.heightPx];
    const excluded = new Set<HeroCanvasLayer>([layer, ...excludedLayers]);

    Object.entries(canvasElementRefs.current).forEach(([candidateLayer, node]) => {
      if (!node || excluded.has(candidateLayer as HeroCanvasLayer)) return;
      const rect = node.getBoundingClientRect();
      const left = (rect.left - rootRect.left) / (scaleX || 1);
      const right = (rect.right - rootRect.left) / (scaleX || 1);
      const top = (rect.top - rootRect.top) / (scaleY || 1);
      const bottom = (rect.bottom - rootRect.top) / (scaleY || 1);
      snapX.push(left, (left + right) / 2, right);
      snapY.push(top, (top + bottom) / 2, bottom);
    });

    return { snapX, snapY };
  };
  const snapThreshold = Math.max(4, Math.min(12, editorOptions.gridSize / 2));
  const snapBoxAxis = (position: number, size: number, extent: number, targets: number[]) => {
    const maxPosition = Math.max(0, extent - size);
    let next = clampNumber(position, 0, maxPosition);
    let guide: number | null = null;

    if (editorOptions.snapToGrid) {
      const gridSize = Math.max(2, editorOptions.gridSize);
      const snapped = clampNumber(Math.round(next / gridSize) * gridSize, 0, maxPosition);
      next = snapped;
      guide = snapped;
    }

    if (editorOptions.snapToElements) {
      const anchors = [0, size / 2, size];
      let bestDistance = snapThreshold + 1;
      let bestDelta = 0;
      let bestTarget: number | null = null;
      let bestAnchor = 0;
      for (const target of targets) {
        for (const anchor of anchors) {
          const delta = target - (next + anchor);
          const distance = Math.abs(delta);
          if (distance <= snapThreshold && distance < bestDistance) {
            bestDistance = distance;
            bestDelta = delta;
            bestTarget = target;
            bestAnchor = anchor;
          }
        }
      }
      if (bestTarget !== null) {
        const snapped = clampNumber(next + bestDelta, 0, maxPosition);
        next = snapped;
        guide = Math.abs(snapped + bestAnchor - bestTarget) < 0.5 ? bestTarget : null;
      }
    }

    return { position: next, guide };
  };
  const snapEdgeAxis = (value: number, min: number, max: number, targets: number[]) => {
    let next = clampNumber(value, min, max);
    let guide: number | null = null;

    if (editorOptions.snapToGrid) {
      const gridSize = Math.max(2, editorOptions.gridSize);
      const snapped = clampNumber(Math.round(next / gridSize) * gridSize, min, max);
      next = snapped;
      guide = snapped;
    }

    if (editorOptions.snapToElements) {
      let closestTarget: number | null = null;
      let closestDistance = snapThreshold + 1;
      targets.forEach((target) => {
        const distance = Math.abs(target - next);
        if (distance <= snapThreshold && distance < closestDistance) {
          closestTarget = target;
          closestDistance = distance;
        }
      });
      if (closestTarget !== null) {
        const snapped = clampNumber(closestTarget, min, max);
        next = snapped;
        guide = Math.abs(snapped - closestTarget) < 0.5 ? closestTarget : null;
      }
    }

    return { position: next, guide };
  };

  useLayoutEffect(() => {
    if (!preview || !selectedLayer || (!editorOptions.measurements && !activeManipulation)) {
      setMeasurement(null);
      return;
    }

    const root = heroRootRef.current;
    const selectedNode = canvasElementRefs.current[selectedLayer];
    if (!root || !selectedNode) {
      setMeasurement(null);
      return;
    }

    const rootRect = root.getBoundingClientRect();
    const selectedRect = selectedNode.getBoundingClientRect();
    const logicalWidth = getCurrentLogicalViewportWidth(root, previewViewportWidth);
    const scaleX = logicalWidth > 0 && rootRect.width > 0 ? rootRect.width / logicalWidth : 1;
    const scaleY = rootRect.height > 0 ? rootRect.height / hero.heightPx : scaleX;
    const selectedLogical = {
      left: (selectedRect.left - rootRect.left) / (scaleX || 1),
      top: (selectedRect.top - rootRect.top) / (scaleY || 1),
      right: (selectedRect.right - rootRect.left) / (scaleX || 1),
      bottom: (selectedRect.bottom - rootRect.top) / (scaleY || 1)
    };
    const nearestDistances: number[] = [];

    Object.entries(canvasElementRefs.current).forEach(([candidateLayer, node]) => {
      if (!node || candidateLayer === selectedLayer) return;
      const rect = node.getBoundingClientRect();
      const candidate = {
        left: (rect.left - rootRect.left) / (scaleX || 1),
        top: (rect.top - rootRect.top) / (scaleY || 1),
        right: (rect.right - rootRect.left) / (scaleX || 1),
        bottom: (rect.bottom - rootRect.top) / (scaleY || 1)
      };
      const horizontalGap = Math.max(candidate.left - selectedLogical.right, selectedLogical.left - candidate.right, 0);
      const verticalGap = Math.max(candidate.top - selectedLogical.bottom, selectedLogical.top - candidate.bottom, 0);
      const gap = Math.max(horizontalGap, verticalGap);
      if (gap > 0) nearestDistances.push(gap);
    });

    setMeasurement({
      left: Math.max(0, Math.round(selectedLogical.left)),
      top: Math.max(0, Math.round(selectedLogical.top)),
      right: Math.max(0, Math.round(logicalWidth - selectedLogical.right)),
      bottom: Math.max(0, Math.round(hero.heightPx - selectedLogical.bottom)),
      width: Math.max(0, Math.round(selectedLogical.right - selectedLogical.left)),
      height: Math.max(0, Math.round(selectedLogical.bottom - selectedLogical.top)),
      nearest: nearestDistances.length > 0 ? Math.round(Math.min(...nearestDistances)) : null
    });
  }, [activeManipulation, canvas, editorOptions.measurements, hero, preview, previewViewportWidth, selectedLayer]);

  const overlayOpacity = hero.darkenBackground ? hero.overlayStrength / 100 : 0;
  const previewOverlayOpacity = `var(--preview-hero-overlay-strength, ${overlayOpacity})`;
  const overlayStyle: CSSProperties = {
    background:
      hero.contentAlign === 'right'
        ? preview
          ? `linear-gradient(270deg, rgba(0,0,0,min(0.82, calc(${previewOverlayOpacity} + 0.16))) 0%, rgba(0,0,0,${previewOverlayOpacity}) 44%, rgba(0,0,0,0.12) 100%)`
          : `linear-gradient(270deg, rgba(0,0,0,${Math.min(0.82, overlayOpacity + 0.16)}) 0%, rgba(0,0,0,${overlayOpacity}) 44%, rgba(0,0,0,0.12) 100%)`
        : hero.contentAlign === 'center'
          ? preview
            ? `linear-gradient(90deg, rgba(0,0,0,${previewOverlayOpacity}) 0%, rgba(0,0,0,min(0.78, calc(${previewOverlayOpacity} + 0.08))) 50%, rgba(0,0,0,${previewOverlayOpacity}) 100%)`
            : `linear-gradient(90deg, rgba(0,0,0,${overlayOpacity}) 0%, rgba(0,0,0,${Math.min(0.78, overlayOpacity + 0.08)}) 50%, rgba(0,0,0,${overlayOpacity}) 100%)`
          : preview
            ? `linear-gradient(90deg, rgba(0,0,0,min(0.82, calc(${previewOverlayOpacity} + 0.18))) 0%, rgba(0,0,0,${previewOverlayOpacity}) 46%, rgba(0,0,0,0.08) 100%)`
            : `linear-gradient(90deg, rgba(0,0,0,${Math.min(0.82, overlayOpacity + 0.18)}) 0%, rgba(0,0,0,${overlayOpacity}) 46%, rgba(0,0,0,0.08) 100%)`
  };

  const goToPrevious = () => setActiveIndex((current) => (current - 1 + slides.length) % slides.length);
  const goToNext = () => setActiveIndex((current) => (current + 1) % slides.length);
  const mediaFrameStyle: CSSProperties = {
    width: preview ? `var(--preview-hero-media-width, ${hero.mediaWidthPercent}%)` : `${hero.mediaWidthPercent}%`,
    left: '50%',
    transform: 'translateX(-50%)'
  };
  const heroContentOffsetX = preview
    ? `var(--preview-hero-content-x, ${hero.contentOffsetXPx}px)`
    : `${hero.contentOffsetXPx}px`;
  const textBlockStyle = {
    '--hero-text-offset': `min(${heroContentOffsetX}, max(0px, calc(100% - ${heroMinimumTextWidthPx}px)))`,
    marginLeft: 'var(--hero-text-offset)',
    width: preview ? `var(--preview-hero-text-width, ${hero.textWidthPx}px)` : `${hero.textWidthPx}px`,
    maxWidth: `max(${heroMinimumTextWidthPx}px, calc(100% - var(--hero-text-offset)))`,
    position: 'relative',
    top: preview ? `var(--preview-hero-content-y, ${hero.contentOffsetYPx}px)` : `${hero.contentOffsetYPx}px`,
    touchAction: preview && onTextPositionChange ? 'none' : undefined
  } as CSSProperties & Record<string, string>;
  const getElementOffset = (target: HeroElementDragTarget) => {
    const keys = heroElementOffsetKeys[target];
    return {
      x: Number(hero[keys.x] ?? 0),
      y: Number(hero[keys.y] ?? 0)
    };
  };
  const getElementOffsetStyle = (target: HeroElementDragTarget): CSSProperties => {
    const offset = getElementOffset(target);
    const prefix = target === 'primaryButton'
      ? 'primary-button'
      : target === 'secondaryButton'
        ? 'secondary-button'
        : target;
    const offsetX = preview ? `var(--preview-${prefix}-offset-x, ${offset.x}px)` : `${offset.x}px`;
    const offsetY = preview ? `var(--preview-${prefix}-offset-y, ${offset.y}px)` : `${offset.y}px`;
    return {
      transform: `translate(${offsetX}, ${offsetY})`,
      touchAction: preview && onTextPositionChange ? 'none' : undefined
    };
  };
  const elementDragClassName = classNames(
    'relative',
    preview && onTextPositionChange && 'cursor-move rounded-md outline outline-1 outline-transparent transition hover:outline-white/45'
  );
  const renderElementOffsetBadge = (target: HeroElementDragTarget) => {
    if (!preview || !showTechnicalGuides || selectedLayer !== target || activeManipulation !== 'drag') return null;
    const offset = getElementOffset(target);
    const label = heroElementOffsetKeys[target].label;
    const compactPreview = (previewViewportWidth ?? 0) < 640;
    const placementClassName = compactPreview && target !== 'primaryButton' && target !== 'secondaryButton'
      ? 'bottom-[calc(100%+8px)] left-0'
      : target === 'primaryButton' || target === 'secondaryButton'
      ? 'left-0 top-[calc(100%+8px)]'
      : 'left-[calc(100%+10px)] top-1/2 -translate-y-1/2';

    return (
      <span
        aria-hidden="true"
        className={classNames('pointer-events-none absolute z-10 whitespace-nowrap text-[10px] font-semibold leading-none text-sky-200', placementClassName)}
        style={{ textShadow: '0 1px 2px rgba(2, 6, 23, .95), 0 0 4px rgba(2, 6, 23, .65)' }}
      >
        {label} X {offset.x} · Y {offset.y}
      </span>
    );
  };
  const startTextDrag = (target: HeroDragTarget) => (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!preview || !onTextPositionChange) return;
    if (editingLayer) return;
    const layer = target === 'block' ? 'title' : target;
    if (getLayerCanvasSettings(layer).locked) {
      event.stopPropagation();
      return;
    }

    const heroRoot = event.currentTarget.closest<HTMLElement>('[data-homepage-hero-root]');
    if (!heroRoot) return;

    const rootRect = heroRoot.getBoundingClientRect();
    const nodeRect = event.currentTarget.getBoundingClientRect();
    const logicalWidth = getCurrentLogicalViewportWidth(heroRoot, previewViewportWidth);
    if (logicalWidth <= 0) return;
    const scaleX = rootRect.width > 0 ? rootRect.width / logicalWidth : 1;
    const scaleY = rootRect.height > 0 ? rootRect.height / hero.heightPx : scaleX;
    const isBlock = target === 'block';
    const logicalLeft = (nodeRect.left - rootRect.left) / (scaleX || 1);
    const logicalTop = (nodeRect.top - rootRect.top) / (scaleY || 1);
    const measuredContent = isBlock ? measureHeroContentBounds(heroRoot, logicalWidth) : null;
    const contentLeft = measuredContent?.contentLeft ?? getHeroContainerMetrics(page, logicalWidth).contentLeft;
    const elementOffset = isBlock
      ? { x: Math.max(0, logicalLeft - contentLeft), y: hero.contentOffsetYPx }
      : getElementOffset(target);
    const excludedLayers: HeroCanvasLayer[] = isBlock
      ? ['description', 'primaryButton', 'secondaryButton']
      : [];
    const snapTargets = buildSnapTargets(layer, excludedLayers);

    dragRef.current = {
      target,
      pointerId: event.pointerId,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startX: elementOffset.x,
      startY: elementOffset.y,
      originX: logicalLeft - elementOffset.x,
      originY: logicalTop - elementOffset.y,
      width: nodeRect.width / (scaleX || 1),
      height: nodeRect.height / (scaleY || 1),
      scaleX: scaleX || 1,
      scaleY: scaleY || 1,
      ...snapTargets
    };
    if (!isBlock) {
      setSelectedLayer(layer);
      onSelectElement?.(getLayerElementId(layer));
    }
    setSnapGuides({ x: null, y: null });
    setActiveManipulation('drag');
    event.currentTarget.setPointerCapture(event.pointerId);
    event.stopPropagation();
    event.preventDefault();
  };
  const moveTextDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId || !onTextPositionChange) return;
    const logicalWidth = getCurrentLogicalViewportWidth(heroRootRef.current, previewViewportWidth);
    if (logicalWidth <= 0) return;
    const layer = drag.target === 'block' ? 'title' : drag.target;
    const excludedLayers: HeroCanvasLayer[] = drag.target === 'block'
      ? ['description', 'primaryButton', 'secondaryButton']
      : [];
    const snapTargets = buildSnapTargets(layer, excludedLayers);

    const absoluteX = drag.originX + drag.startX + (event.clientX - drag.startClientX) / drag.scaleX;
    const absoluteY = drag.originY + drag.startY + (event.clientY - drag.startClientY) / drag.scaleY;
    const snappedX = snapBoxAxis(absoluteX, drag.width, logicalWidth, snapTargets.snapX);
    const snappedY = snapBoxAxis(absoluteY, drag.height, hero.heightPx, snapTargets.snapY);
    let nextX = snappedX.position - drag.originX;
    const nextY = snappedY.position - drag.originY;
    let guideX = snappedX.guide;

    if (drag.target === 'block' && nextX < 0) {
      nextX = 0;
      if (guideX !== null && Math.abs(drag.originX + nextX - guideX) >= 0.5) guideX = null;
    }
    setSnapGuides({ x: guideX, y: snappedY.guide });

    if (drag.target === 'block') {
      onTextPositionChange({
        contentOffsetXPx: Math.round(nextX),
        contentOffsetYPx: Math.round(nextY)
      });
    } else {
      const keys = heroElementOffsetKeys[drag.target];
      onTextPositionChange({
        [keys.x]: Math.round(nextX),
        [keys.y]: Math.round(nextY)
      });
    }
    event.stopPropagation();
    event.preventDefault();
  };
  const endTextDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (dragRef.current?.pointerId === event.pointerId) {
      dragRef.current = null;
      setActiveManipulation(null);
      setSnapGuides({ x: null, y: null });
      event.currentTarget.releasePointerCapture(event.pointerId);
      event.stopPropagation();
    }
  };
  const startTextBlockDrag = (block: HomepageHeroTextBlock) => (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!inlineEditorEnabled || editingLayer) return;
    const layer = `textBlock:${block.id}` as const;
    const layerCanvasSettings = getLayerCanvasSettings(layer);
    if (layerCanvasSettings.locked) {
      event.stopPropagation();
      return;
    }
    const heroRoot = event.currentTarget.closest<HTMLElement>('[data-homepage-hero-root]');
    if (!heroRoot) return;

    const resolvedBlock = resolveHeroTextBlockForDevice(block, previewDevice);
    const rootRect = heroRoot.getBoundingClientRect();
    const nodeRect = event.currentTarget.getBoundingClientRect();
    const logicalWidth = getCurrentLogicalViewportWidth(heroRoot, previewViewportWidth);
    if (logicalWidth <= 0) return;
    const scaleX = rootRect.width > 0 ? rootRect.width / logicalWidth : 1;
    const scaleY = rootRect.height > 0 ? rootRect.height / hero.heightPx : scaleX;
    const logicalLeft = (nodeRect.left - rootRect.left) / (scaleX || 1);
    const logicalTop = (nodeRect.top - rootRect.top) / (scaleY || 1);
    const resetHorizontalAlignment = Boolean(
      canvas.elements[getLayerElementId(layer)] && layerCanvasSettings.horizontalAlign !== 'left'
    );
    const startX = resetHorizontalAlignment
      ? logicalLeft - layerCanvasSettings.marginLeftPx
      : resolvedBlock.xPx;
    const snapTargets = buildSnapTargets(layer);

    textBlockDragRef.current = {
      blockId: block.id,
      pointerId: event.pointerId,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startX,
      startY: resolvedBlock.yPx,
      originX: resetHorizontalAlignment
        ? layerCanvasSettings.marginLeftPx
        : logicalLeft - resolvedBlock.xPx,
      originY: logicalTop - resolvedBlock.yPx,
      width: nodeRect.width / (scaleX || 1),
      height: nodeRect.height / (scaleY || 1),
      scaleX: scaleX || 1,
      scaleY: scaleY || 1,
      ...snapTargets,
      resetHorizontalAlignment
    };
    setSelectedLayer(layer);
    onSelect?.();
    onSelectElement?.(getLayerElementId(layer));
    setSnapGuides({ x: null, y: null });
    setActiveManipulation('drag');
    event.currentTarget.setPointerCapture(event.pointerId);
    event.stopPropagation();
  };
  const moveTextBlockDrag = (block: HomepageHeroTextBlock) => (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = textBlockDragRef.current;
    if (!drag || drag.blockId !== block.id || drag.pointerId !== event.pointerId) return;
    const logicalWidth = getCurrentLogicalViewportWidth(heroRootRef.current, previewViewportWidth);
    if (logicalWidth <= 0) return;
    const snapTargets = buildSnapTargets(`textBlock:${block.id}`);
    if (drag.resetHorizontalAlignment) {
      onCanvasElementStyleChange?.(getLayerElementId(`textBlock:${block.id}`), { horizontalAlign: 'left' });
      drag.resetHorizontalAlignment = false;
    }
    const absoluteX = drag.originX + drag.startX + (event.clientX - drag.startClientX) / drag.scaleX;
    const absoluteY = drag.originY + drag.startY + (event.clientY - drag.startClientY) / drag.scaleY;
    const snappedX = snapBoxAxis(absoluteX, drag.width, logicalWidth, snapTargets.snapX);
    const snappedY = snapBoxAxis(absoluteY, drag.height, hero.heightPx, snapTargets.snapY);
    const nextX = Math.round(snappedX.position - drag.originX);
    const nextY = Math.round(snappedY.position - drag.originY);

    updateTextBlockForDevice(block, { xPx: nextX, yPx: nextY });
    setSnapGuides({ x: snappedX.guide, y: snappedY.guide });
    event.stopPropagation();
    event.preventDefault();
  };
  const endTextBlockDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (textBlockDragRef.current?.pointerId === event.pointerId) {
      textBlockDragRef.current = null;
      setActiveManipulation(null);
      setSnapGuides({ x: null, y: null });
      event.currentTarget.releasePointerCapture(event.pointerId);
      event.stopPropagation();
    }
  };
  const selectLayer = (layer: HeroCanvasLayer) => {
    if (!inlineEditorEnabled) return;
    onSelect?.();
    setSelectedLayer(layer);
    setEditingLayer(null);
    onSelectElement?.(getLayerElementId(layer));
  };
  const editLayer = (layer: HeroEditableLayer) => {
    if (!inlineEditorEnabled || getLayerCanvasSettings(layer).locked) return;
    onSelect?.();
    setSelectedLayer(layer);
    setEditingLayer(layer);
    onSelectElement?.(getLayerElementId(layer));
  };
  const commitLayerText = (layer: HeroEditableLayer, value: string) => {
    if (layer === 'title') {
      onTextContentChange?.({ title: value });
      return;
    }
    if (layer === 'description') {
      onTextContentChange?.({ description: value });
      return;
    }
    onTextBlockChange?.(layer.replace('textBlock:', ''), { text: value });
  };
  const updateTextBlockForDevice = (block: HomepageHeroTextBlock, updates: Partial<HomepageHeroTextBlock>) => {
    if (!previewDevice) {
      onTextBlockChange?.(block.id, updates);
      return;
    }

    onTextBlockChange?.(block.id, {
      responsive: {
        ...block.responsive,
        [previewDevice]: {
          ...block.responsive[previewDevice],
          ...updates
        }
      }
    });
  };
  const startResize = (layer: HeroCanvasLayer) => (event: ReactPointerEvent<HTMLSpanElement>) => {
    if (!preview || !onCanvasElementStyleChange) return;
    if (getLayerCanvasSettings(layer).locked) {
      event.stopPropagation();
      return;
    }
    const node = canvasElementRefs.current[layer];
    const root = heroRootRef.current;
    if (!node || !root) return;
    const nodeRect = node.getBoundingClientRect();
    const rootRect = root.getBoundingClientRect();
    const logicalWidth = getCurrentLogicalViewportWidth(root, previewViewportWidth);
    const scaleX = logicalWidth > 0 && rootRect.width > 0 ? rootRect.width / logicalWidth : 1;
    const scaleY = rootRect.height > 0 ? rootRect.height / hero.heightPx : scaleX;
    const snapTargets = buildSnapTargets(layer);

    resizeRef.current = {
      layer,
      pointerId: event.pointerId,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startWidth: nodeRect.width / (scaleX || 1),
      startHeight: nodeRect.height / (scaleY || 1),
      startLeft: (nodeRect.left - rootRect.left) / (scaleX || 1),
      startTop: (nodeRect.top - rootRect.top) / (scaleY || 1),
      scaleX: scaleX || 1,
      scaleY: scaleY || 1,
      ...snapTargets
    };
    setSnapGuides({ x: null, y: null });
    setActiveManipulation('resize');
    event.currentTarget.setPointerCapture(event.pointerId);
    event.stopPropagation();
    event.preventDefault();
  };
  const moveResize = (event: ReactPointerEvent<HTMLSpanElement>) => {
    const resize = resizeRef.current;
    if (!resize || resize.pointerId !== event.pointerId || !onCanvasElementStyleChange) return;
    const viewportWidth = getCurrentLogicalViewportWidth(heroRootRef.current, previewViewportWidth);
    if (viewportWidth <= 0) return;
    const snapTargets = buildSnapTargets(resize.layer);
    const rawRight = resize.startLeft + resize.startWidth + (event.clientX - resize.startClientX) / resize.scaleX;
    const rawBottom = resize.startTop + resize.startHeight + (event.clientY - resize.startClientY) / resize.scaleY;
    const snappedRight = snapEdgeAxis(rawRight, Math.min(viewportWidth, resize.startLeft + 48), viewportWidth, snapTargets.snapX);
    const snappedBottom = snapEdgeAxis(rawBottom, Math.min(hero.heightPx, resize.startTop + 24), hero.heightPx, snapTargets.snapY);
    const widthPx = Math.round(Math.max(48, snappedRight.position - resize.startLeft));
    const heightPx = Math.round(Math.max(24, snappedBottom.position - resize.startTop));
    onCanvasElementStyleChange(getLayerElementId(resize.layer), { widthPx, heightPx });
    setSnapGuides({ x: snappedRight.guide, y: snappedBottom.guide });
    event.stopPropagation();
    event.preventDefault();
  };
  const endResize = (event: ReactPointerEvent<HTMLSpanElement>) => {
    if (resizeRef.current?.pointerId !== event.pointerId) return;
    resizeRef.current = null;
    setActiveManipulation(null);
    setSnapGuides({ x: null, y: null });
    event.currentTarget.releasePointerCapture(event.pointerId);
    event.stopPropagation();
  };
  const renderSelectionFrame = (layer: HeroCanvasLayer) => {
    if (!inlineEditorEnabled || selectedLayer !== layer) return null;
    const element = getLayerCanvasSettings(layer);
    const handleClassName = 'absolute rounded-full border-2 border-white bg-[color:var(--blue-500)] shadow-[0_1px_4px_rgba(15,23,42,0.22)]';
    const handleStyle = {
      height: `${12 / editorContentScale}px`,
      width: `${12 / editorContentScale}px`
    };

    return (
      <span className="pointer-events-none absolute inset-[-6px] z-[65] rounded-sm border-2 border-[color:var(--blue-500)]">
        <span className={classNames(handleClassName, '-left-2 -top-2')} style={handleStyle} />
        <span className={classNames(handleClassName, '-right-2 -top-2')} style={handleStyle} />
        <span className={classNames(handleClassName, '-bottom-2 -left-2')} style={handleStyle} />
        {!element.locked ? (
          <span
            role="button"
            aria-label="Spremeni velikost elementa"
            title="Povleci za spremembo velikosti"
            tabIndex={0}
            className={classNames(handleClassName, 'pointer-events-auto -bottom-2 -right-2 cursor-nwse-resize')}
            style={handleStyle}
            onPointerDown={startResize(layer)}
            onPointerMove={moveResize}
            onPointerUp={endResize}
            onPointerCancel={endResize}
          />
        ) : (
          <span className={classNames(handleClassName, '-bottom-2 -right-2 bg-slate-400')} style={handleStyle} />
        )}
      </span>
    );
  };
  const editableLayerProps = (layer: HeroEditableLayer) => ({
    'data-hero-inline-layer': layer,
    'data-homepage-canvas-element': true,
    'data-canvas-element-id': getLayerElementId(layer),
    onClick: (event: ReactMouseEvent) => {
      event.stopPropagation();
      if (selectedLayer === layer) editLayer(layer);
      else selectLayer(layer);
    },
    onDoubleClick: (event: ReactMouseEvent) => {
      event.stopPropagation();
      editLayer(layer);
    }
  });
  const selectableLayerProps = (layer: HeroCanvasLayer) => ({
    'data-homepage-canvas-element': true,
    'data-canvas-element-id': getLayerElementId(layer),
    onClick: (event: ReactMouseEvent) => {
      event.stopPropagation();
      selectLayer(layer);
    }
  });
  const renderHiddenElementFlag = (
    layer: HeroCanvasLayer,
    label: string,
    hidden = !getLayerCanvasSettings(layer).visible,
    markerStyle?: CSSProperties
  ) => {
    if (!preview || !hidden) return null;
    const elementId = getLayerElementId(layer);
    return (
      <CanvasHiddenElementFlag
        elementId={elementId}
        label={label}
        kind="homepage"
        markerStyle={markerStyle}
        onRestore={() => {
          if (onRestoreHiddenElement) onRestoreHiddenElement(elementId);
          else onCanvasElementStyleChange?.(elementId, { visible: true });
        }}
      />
    );
  };
  const layerIsVisible = (layer: HeroCanvasLayer) => getLayerCanvasSettings(layer).visible;
  const layerIsDeleted = (layer: HeroCanvasLayer) => (
    isHomepageCanvasElementDeleted(canvas, getLayerElementId(layer))
  );
  const shouldRenderLayer = (layer: HeroCanvasLayer) => (
    !layerIsDeleted(layer) && (preview || layerIsVisible(layer))
  );
  const hasVisibleHeroAction = Boolean(
    hero.primaryButton.label
      && hero.primaryButton.href
      && layerIsVisible('primaryButton')
  ) || Boolean(
    hero.secondaryButton.label
      && hero.secondaryButton.href
      && layerIsVisible('secondaryButton')
  );

  return (
    <div
      ref={heroRootRef}
      data-homepage-hero-root
      data-homepage-hero-carousel
      data-homepage-hero-slide-count={slides.length}
      className="relative isolate overflow-hidden bg-[#0d1117]"
      style={{ minHeight: preview ? `var(--preview-hero-height, ${hero.heightPx}px)` : `${hero.heightPx}px` }}
      onClick={(event) => {
        const target = event.target instanceof Element ? event.target : null;
        if (target?.closest('[data-homepage-canvas-element]')) return;
        setSelectedLayer(null);
        setEditingLayer(null);
        onSelect?.();
        onSelectElement?.('section:hero');
      }}
    >
      {activeSlide?.type === 'video' ? (
        <video
          key={activeSlide.id}
          data-homepage-hero-carousel-media
          data-homepage-hero-slide-id={activeSlide.id}
          className="absolute top-0 h-full object-cover"
          style={mediaFrameStyle}
          src={activeSlide.src}
          poster={activeSlide.poster || undefined}
          autoPlay
          muted
          loop
          playsInline
        />
      ) : activeSlide?.src ? (
        <div
          key={activeSlide.id}
          data-homepage-hero-carousel-media
          data-homepage-hero-slide-id={activeSlide.id}
          className="absolute top-0 h-full object-cover"
          role="img"
          aria-label={activeSlide.alt || activeSlide.title || undefined}
          style={{ ...mediaFrameStyle, backgroundImage: `url("${activeSlide.src}")`, backgroundSize: 'cover', backgroundPosition: 'center' }}
        />
      ) : (
        <div className="absolute inset-0 bg-[#10151d]" />
      )}

      <div className="absolute inset-0" style={overlayStyle} />

      {preview && editorOptions.guides && (activeManipulation || selectedLayer) ? (
        <div
          aria-hidden="true"
          data-homepage-editor-aid="guides"
          data-editor-section="hero"
          className="pointer-events-none absolute inset-0 z-[32] text-[9px] font-bold text-fuchsia-100"
          style={{ textShadow: '0 1px 2px rgba(2, 6, 23, .95), 0 0 4px rgba(2, 6, 23, .65)' }}
        >
          {!activeManipulation ? (
            <>
              <span className="absolute inset-y-0 left-1/2 w-px bg-fuchsia-400/20" />
              <span className="absolute inset-x-0 top-1/2 h-px bg-fuchsia-400/20" />
            </>
          ) : null}
          {activeManipulation && snapGuides.x !== null ? (
            <>
              <span className="absolute inset-y-0 w-px bg-fuchsia-300/85 shadow-[0_0_0_1px_rgba(192,38,211,0.16)]" style={{ left: `${snapGuides.x}px` }} />
              <span className="absolute top-3 translate-x-2 whitespace-nowrap" style={{ left: `${snapGuides.x}px` }}>{Math.round(snapGuides.x)} px</span>
            </>
          ) : null}
          {activeManipulation && snapGuides.y !== null ? (
            <>
              <span className="absolute inset-x-0 h-px bg-fuchsia-300/85 shadow-[0_0_0_1px_rgba(192,38,211,0.16)]" style={{ top: `${snapGuides.y}px` }} />
              <span className="absolute left-3 whitespace-nowrap" style={{ top: `${snapGuides.y}px`, transform: 'translateY(calc(-100% - 6px))' }}>{Math.round(snapGuides.y)} px</span>
            </>
          ) : null}
        </div>
      ) : null}
      {preview && measurement ? (
        <div
          aria-hidden="true"
          data-homepage-editor-aid="measurements"
          data-editor-section="hero"
          className="pointer-events-none absolute inset-0 z-[64] text-[10px] font-bold leading-none text-sky-200"
          style={{ textShadow: '0 1px 2px rgba(2, 6, 23, .95), 0 0 4px rgba(2, 6, 23, .65)' }}
        >
          <span className="absolute h-px border-t border-dashed border-sky-300/45" style={{ left: 0, top: measurement.top + measurement.height / 2, width: measurement.left }} />
          <span className="absolute h-px border-t border-dashed border-sky-300/45" style={{ left: measurement.left + measurement.width, right: 0, top: measurement.top + measurement.height / 2 }} />
          <span className="absolute w-px border-l border-dashed border-sky-300/45" style={{ left: measurement.left + measurement.width / 2, top: 0, height: measurement.top }} />
          <span className="absolute w-px border-l border-dashed border-sky-300/45" style={{ left: measurement.left + measurement.width / 2, top: measurement.top + measurement.height, bottom: 0 }} />
          <span className="absolute whitespace-nowrap" style={{ left: Math.max(24, measurement.left / 2), top: measurement.top + measurement.height / 2 - 14, transform: 'translateX(-50%)' }}>{measurement.left}px</span>
          <span className="absolute whitespace-nowrap" style={{ right: Math.max(24, measurement.right / 2), top: measurement.top + measurement.height / 2 - 14, transform: 'translateX(50%)' }}>{measurement.right}px</span>
          <span className="absolute whitespace-nowrap" style={{ left: measurement.left + measurement.width / 2 + 6, top: Math.max(16, measurement.top / 2), transform: 'translateY(-50%)' }}>{measurement.top}px</span>
          <span className="absolute whitespace-nowrap" style={{ left: measurement.left + measurement.width / 2 + 6, bottom: Math.max(16, measurement.bottom / 2), transform: 'translateY(50%)' }}>{measurement.bottom}px</span>
          <span
            className="absolute whitespace-nowrap text-right"
            style={{
              left: measurement.left + measurement.width < 180 ? measurement.left : measurement.left + measurement.width,
              top: selectedLayer === 'description' || selectedLayer === 'primaryButton' || selectedLayer === 'secondaryButton'
                ? Math.min(hero.heightPx - 18, measurement.top + measurement.height + 10)
                : measurement.top >= 28
                  ? measurement.top - 20
                  : Math.min(hero.heightPx - 18, measurement.top + measurement.height + 10),
              transform: measurement.left + measurement.width < 180 ? undefined : 'translateX(-100%)'
            }}
          >
            {measurement.width} × {measurement.height}px{measurement.nearest !== null ? ` · najbližje ${measurement.nearest}px` : ''}
          </span>
        </div>
      ) : null}

      <div
        data-homepage-hero-content
        className={classNames('relative flex min-h-[inherit]', containerClassNames[page.containerWidth])}
      >
        <div
          className="flex min-h-[inherit] w-full flex-col justify-center py-16 text-left text-white"
          style={preview ? { paddingBlock: 'var(--preview-hero-content-padding-block, 64px)' } : undefined}
        >
          <div
            data-homepage-hero-content-block
            className={classNames('flex flex-col text-left', preview && onTextPositionChange && 'cursor-move rounded-md outline outline-1 outline-transparent transition hover:outline-white/35')}
            style={textBlockStyle}
            onPointerDown={startTextDrag('block')}
            onPointerMove={moveTextDrag}
            onPointerUp={endTextDrag}
            onPointerCancel={endTextDrag}
          >
            {shouldRenderLayer('title') ? layerIsVisible('title') ? (
              <div
                ref={registerCanvasElement('title') as (node: HTMLDivElement | null) => void}
                data-hero-element="title"
                {...editableLayerProps('title')}
                className={classNames(elementDragClassName, 'w-fit max-w-full outline-offset-2 hover:outline-[color:var(--blue-400)]/70')}
                style={{ ...getElementOffsetStyle('title'), ...getLayerBoxStyle('title'), ...getPreviewLayerBoxStyle('title') }}
                onPointerDown={startTextDrag('title')}
                onPointerMove={moveTextDrag}
                onPointerUp={endTextDrag}
                onPointerCancel={endTextDrag}
              >
                {renderElementOffsetBadge('title')}
                {renderSelectionFrame('title')}
                <h1
                  ref={titleEditRef}
                  contentEditable={editingLayer === 'title'}
                  suppressContentEditableWarning
                  className="text-balance leading-[1.08] tracking-[0] outline-none"
                  style={{ ...getHeroTitleTextStyle(hero), ...getLayerTextStyle('title'), ...getPreviewLayerTextStyle('title') }}
                  onInput={(event) => commitLayerText('title', event.currentTarget.textContent ?? '')}
                  onBlur={(event) => {
                    commitLayerText('title', event.currentTarget.textContent ?? '');
                    setEditingLayer((current) => (current === 'title' ? null : current));
                  }}
                >
                  <span style={getHighlightedTextStyle(hero.titleHighlight, hero.titleHighlightColor)}>{hero.title}</span>
                </h1>
              </div>
            ) : renderHiddenElementFlag('title', 'Naslov') : null}
            {hero.description && shouldRenderLayer('description') ? layerIsVisible('description') ? (
              <div
                ref={registerCanvasElement('description') as (node: HTMLDivElement | null) => void}
                data-hero-element="description"
                {...editableLayerProps('description')}
                className={classNames(elementDragClassName, 'mt-5 w-fit max-w-full outline-offset-2 hover:outline-[color:var(--blue-400)]/70')}
                style={{ ...getElementOffsetStyle('description'), ...getLayerBoxStyle('description'), ...getPreviewLayerBoxStyle('description') }}
                onPointerDown={startTextDrag('description')}
                onPointerMove={moveTextDrag}
                onPointerUp={endTextDrag}
                onPointerCancel={endTextDrag}
              >
                {renderElementOffsetBadge('description')}
                {renderSelectionFrame('description')}
                <p
                  ref={descriptionEditRef}
                  contentEditable={editingLayer === 'description'}
                  suppressContentEditableWarning
                  className="max-w-[620px] text-pretty text-white/88 outline-none"
                  style={{ ...getHeroDescriptionTextStyle(hero), ...getLayerTextStyle('description'), ...getPreviewLayerTextStyle('description') }}
                  onInput={(event) => commitLayerText('description', event.currentTarget.textContent ?? '')}
                  onBlur={(event) => {
                    commitLayerText('description', event.currentTarget.textContent ?? '');
                    setEditingLayer((current) => (current === 'description' ? null : current));
                  }}
                >
                  <span style={getHighlightedTextStyle(hero.descriptionHighlight, hero.descriptionHighlightColor)}>{hero.description}</span>
                </p>
              </div>
            ) : renderHiddenElementFlag('description', 'Opis') : null}
            <div
              data-homepage-hero-actions
              className={classNames('flex flex-wrap gap-3', hasVisibleHeroAction && 'mt-8')}
              style={preview
                ? {
                    marginTop: hasVisibleHeroAction
                      ? 'var(--preview-actions-gap-top, 32px)'
                      : 0,
                    gap: 'var(--preview-actions-gap-inline, 12px)'
                  }
                : undefined}
            >
              {hero.primaryButton.label && hero.primaryButton.href && shouldRenderLayer('primaryButton') ? layerIsVisible('primaryButton') ? (
                <div
                  ref={registerCanvasElement('primaryButton') as (node: HTMLDivElement | null) => void}
                  data-hero-element="primary-button"
                  {...selectableLayerProps('primaryButton')}
                  className={classNames(elementDragClassName, 'inline-flex outline-offset-2 hover:outline-[color:var(--blue-400)]/70')}
                  style={{ ...getElementOffsetStyle('primaryButton'), ...getLayerBoxStyle('primaryButton'), ...getPreviewLayerBoxStyle('primaryButton'), ...getButtonAlignmentStyle('primaryButton') }}
                  onPointerDown={startTextDrag('primaryButton')}
                  onPointerMove={moveTextDrag}
                  onPointerUp={endTextDrag}
                  onPointerCancel={endTextDrag}
                >
                  {renderElementOffsetBadge('primaryButton')}
                  {renderSelectionFrame('primaryButton')}
                  <Link
                    href={hero.primaryButton.href}
                    prefetch={false}
                    draggable={false}
                    className={classNames(buttonClassName(page.buttonStyle, 'primary'), preview && onTextPositionChange && 'pointer-events-none', getLayerCanvasSettings('primaryButton').widthPx > 0 && 'h-full w-full')}
                    style={getLayerTextStyle('primaryButton')}
                  >
                    <span>{hero.primaryButton.label}</span>
                    <ChevronRight className="h-4 w-4" strokeWidth={2} />
                  </Link>
                </div>
              ) : renderHiddenElementFlag('primaryButton', 'Primarni gumb') : null}
              {hero.secondaryButton.label && hero.secondaryButton.href && shouldRenderLayer('secondaryButton') ? layerIsVisible('secondaryButton') ? (
                <div
                  ref={registerCanvasElement('secondaryButton') as (node: HTMLDivElement | null) => void}
                  data-hero-element="secondary-button"
                  {...selectableLayerProps('secondaryButton')}
                  className={classNames(elementDragClassName, 'inline-flex outline-offset-2 hover:outline-[color:var(--blue-400)]/70')}
                  style={{ ...getElementOffsetStyle('secondaryButton'), ...getLayerBoxStyle('secondaryButton'), ...getPreviewLayerBoxStyle('secondaryButton'), ...getButtonAlignmentStyle('secondaryButton') }}
                  onPointerDown={startTextDrag('secondaryButton')}
                  onPointerMove={moveTextDrag}
                  onPointerUp={endTextDrag}
                  onPointerCancel={endTextDrag}
                >
                  {renderElementOffsetBadge('secondaryButton')}
                  {renderSelectionFrame('secondaryButton')}
                  <Link
                    href={hero.secondaryButton.href}
                    prefetch={false}
                    draggable={false}
                    className={classNames(buttonClassName(page.buttonStyle, 'secondary'), preview && onTextPositionChange && 'pointer-events-none', getLayerCanvasSettings('secondaryButton').widthPx > 0 && 'h-full w-full')}
                    style={getLayerTextStyle('secondaryButton')}
                  >
                    <span>{hero.secondaryButton.label}</span>
                  </Link>
                </div>
              ) : renderHiddenElementFlag('secondaryButton', 'Sekundarni gumb') : null}
            </div>
          </div>
        </div>
      </div>

      {hero.textBlocks.map((block) => {
        const resolvedBlock = resolveHeroTextBlockForDevice(block, previewDevice);
        const layer = `textBlock:${block.id}` as const;
        if (layerIsDeleted(layer)) return null;
        const visible = block.visible && layerIsVisible(layer);
        if (!preview && !visible) return null;
        const layerCanvasSettings = getLayerCanvasSettings(layer);
        const configured = Boolean(canvas.elements[getLayerElementId(layer)]);
        const blockWidthPx = layerCanvasSettings.widthPx > 0 ? layerCanvasSettings.widthPx : resolvedBlock.widthPx;
        const alignedLeft = configured && layerCanvasSettings.horizontalAlign === 'center'
          ? `calc(50% - ${blockWidthPx / 2 + layerCanvasSettings.marginLeftPx}px)`
          : configured && layerCanvasSettings.horizontalAlign === 'right'
            ? `calc(100% - ${blockWidthPx + layerCanvasSettings.marginLeftPx + layerCanvasSettings.marginRightPx}px)`
            : `${resolvedBlock.xPx}px`;
        const blockStyle: CSSProperties = {
          ...getHeroTextBlockStyle(block, previewDevice),
          ...getLayerBoxStyle(layer),
          left: alignedLeft,
          top: `${resolvedBlock.yPx}px`,
          width: `${blockWidthPx}px`
        };
        if (preview && !visible) {
          const elementId = getLayerElementId(layer);
          return (
            <CanvasHiddenElementFlag
              key={block.id}
              elementId={elementId}
              label={block.kind === 'button' ? 'Gumb' : 'Besedilni blok'}
              kind="homepage"
              markerStyle={{
                left: alignedLeft,
                top: `${resolvedBlock.yPx}px`,
                transform: blockStyle.transform
              }}
              onRestore={() => {
                if (onRestoreHiddenElement) onRestoreHiddenElement(elementId);
                else onCanvasElementStyleChange?.(elementId, { visible: true });
              }}
            />
          );
        }
        const content = (
          <div
            ref={(node) => {
              textBlockEditRefs.current[block.id] = node;
            }}
            contentEditable={editingLayer === layer}
            suppressContentEditableWarning
            className="min-h-8 text-pretty outline-none"
            onInput={(event) => commitLayerText(layer, event.currentTarget.textContent ?? '')}
            onBlur={(event) => {
              commitLayerText(layer, event.currentTarget.textContent ?? '');
              setEditingLayer((current) => (current === layer ? null : current));
            }}
          >
            {block.text}
          </div>
        );

        return (
          <div
            key={block.id}
            ref={registerCanvasElement(layer) as (node: HTMLDivElement | null) => void}
            {...editableLayerProps(layer)}
            className={classNames(
              'absolute z-20 cursor-move rounded-sm text-white outline outline-1 outline-transparent transition hover:outline-white/45',
              'outline-offset-2 hover:outline-[color:var(--blue-400)]/70'
            )}
            style={blockStyle}
            onPointerDown={startTextBlockDrag(block)}
            onPointerMove={moveTextBlockDrag(block)}
            onPointerUp={endTextBlockDrag}
            onPointerCancel={endTextBlockDrag}
          >
            {renderSelectionFrame(layer)}
            {block.kind === 'button' ? (
              <Link
                href={block.href || '#'}
                prefetch={false}
                draggable={false}
                className={classNames(buttonClassName(page.buttonStyle, 'primary'), preview && 'pointer-events-none', 'h-full w-full')}
                style={getLayerTextStyle(layer)}
              >
                {content}
              </Link>
            ) : block.href ? (
              <Link href={block.href} prefetch={false} draggable={false} className={classNames(preview && 'pointer-events-none')} style={getLayerTextStyle(layer)}>
                {content}
              </Link>
            ) : content}
          </div>
        );
      })}

      {preview && showTechnicalGuides && previewViewportWidth ? (
        <HeroTechnicalGuides
          hero={hero}
          page={page}
          viewportWidth={previewViewportWidth}
          editorContentScale={editorContentScale}
        />
      ) : null}

      {hero.showArrows && hasMultipleSlides ? (
        <div data-homepage-hero-carousel-arrows>
          <button
            type="button"
            aria-label="Prejšnji diapozitiv"
            onClick={goToPrevious}
            data-homepage-hero-carousel-arrow="previous"
            className={classNames(
              'absolute top-1/2 z-20 inline-grid -translate-y-1/2 place-items-center rounded-full border border-white/70 bg-black/25 text-white shadow-[0_5px_18px_rgba(0,0,0,0.22)] backdrop-blur-sm transition hover:border-white/90 hover:bg-black/40 focus-visible:border-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/75 focus-visible:ring-offset-2 focus-visible:ring-offset-black/30',
              preview
                ? previewDevice === 'mobile' ? 'left-5 h-12 w-12' : 'left-6 h-14 w-14'
                : 'left-5 h-12 w-12 sm:left-6 sm:h-14 sm:w-14'
            )}
          >
            <ChevronLeft className="h-6 w-6" />
          </button>
          <button
            type="button"
            aria-label="Naslednji diapozitiv"
            onClick={goToNext}
            data-homepage-hero-carousel-arrow="next"
            className={classNames(
              'absolute top-1/2 z-20 inline-grid -translate-y-1/2 place-items-center rounded-full border border-white/70 bg-black/25 text-white shadow-[0_5px_18px_rgba(0,0,0,0.22)] backdrop-blur-sm transition hover:border-white/90 hover:bg-black/40 focus-visible:border-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/75 focus-visible:ring-offset-2 focus-visible:ring-offset-black/30',
              preview
                ? previewDevice === 'mobile' ? 'right-5 h-12 w-12' : 'right-6 h-14 w-14'
                : 'right-5 h-12 w-12 sm:right-6 sm:h-14 sm:w-14'
            )}
          >
            <ChevronRight className="h-6 w-6" />
          </button>
        </div>
      ) : null}

      {hero.showDots && hasMultipleSlides ? (
        <div
          className="absolute bottom-5 left-1/2 z-20 flex -translate-x-1/2 items-center gap-2.5"
          data-homepage-hero-carousel-dots
          role="group"
          aria-label="Izbira diapozitiva"
        >
          {slides.map((slide, index) => (
            <button
              key={slide.id}
              type="button"
              aria-label={`Prikaži diapozitiv ${index + 1}`}
              aria-current={index === activeIndex ? 'true' : undefined}
              onClick={() => setActiveIndex(index)}
              data-homepage-hero-carousel-dot={index}
              data-active={index === activeIndex ? 'true' : 'false'}
              className={classNames(
                'h-3 w-3 rounded-full border transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80 focus-visible:ring-offset-2 focus-visible:ring-offset-black/30',
                index === activeIndex
                  ? 'border-white bg-white shadow-[0_1px_6px_rgba(0,0,0,0.28)]'
                  : 'border-white/75 bg-white/15 hover:border-white hover:bg-white/35'
              )}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function createCategoryCanvasSettings(elementId: string): HomepageCanvasElementDeviceSettings {
  const base = { ...DEFAULT_HOMEPAGE_CANVAS_ELEMENT_DEVICE_SETTINGS };
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
    return { ...base, color: '#1982bf', fontFamily: 'Noto Sans', fontSizePx: 16, lineHeight: 1.5, fontWeight: 500, zIndex: 3 };
  }
  if (elementId.startsWith('categories:image:')) return { ...base, zIndex: 1 };
  return base;
}

function resolveCategoryCanvasSettings(
  canvas: HomepageSettings['canvas'],
  elementId: string,
  device: HomepagePreviewDevice
) {
  if (canvas.elements[elementId]) {
    return resolveHomepageCanvasElementDeviceSettings(canvas, elementId, device);
  }

  if (
    elementId.startsWith('categories:title:')
    && elementId !== HOMEPAGE_CATEGORY_TITLE_SHARED_CANVAS_ELEMENT_ID
    && canvas.elements[HOMEPAGE_CATEGORY_TITLE_SHARED_CANVAS_ELEMENT_ID]
  ) {
    return resolveHomepageCanvasElementDeviceSettings(
      canvas,
      HOMEPAGE_CATEGORY_TITLE_SHARED_CANVAS_ELEMENT_ID,
      device
    );
  }

  return createCategoryCanvasSettings(elementId);
}

const categoryImageTransformHandles = [
  { position: 'north-west', className: 'left-0 top-0' },
  { position: 'north', className: 'left-1/2 top-0 -translate-x-1/2' },
  { position: 'north-east', className: 'right-0 top-0' },
  { position: 'east', className: 'right-0 top-1/2 -translate-y-1/2' },
  { position: 'south-east', className: 'bottom-0 right-0' },
  { position: 'south', className: 'bottom-0 left-1/2 -translate-x-1/2' },
  { position: 'south-west', className: 'bottom-0 left-0' },
  { position: 'west', className: 'left-0 top-1/2 -translate-y-1/2' }
] as const;

function CategoryImageTransformBox({
  categorySlug,
  className,
  style
}: {
  categorySlug: string;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <div
      aria-hidden="true"
      data-category-image-transform-box={categorySlug}
      className={classNames(
        adminEditorSelectionOutlineTokenClasses,
        'pointer-events-none z-30',
        className ?? 'absolute inset-0'
      )}
      style={{ borderRadius: 0, ...style }}
    >
      {categoryImageTransformHandles.map((handle) => (
        <span
          key={handle.position}
          data-category-image-transform-handle={handle.position}
          className={classNames(
            'absolute block h-[9px] w-[9px] rounded-[2px] border-[1.5px] border-[color:var(--blue-500)] bg-white shadow-[0_1px_3px_rgba(15,23,42,0.18)]',
            handle.className
          )}
        />
      ))}

      <span
        data-category-image-transform-center
        className="absolute left-1/2 top-1/2 grid h-6 w-6 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border-[1.5px] border-[color:var(--blue-500)] bg-white shadow-[0_2px_6px_rgba(15,23,42,0.18)]"
      >
        <svg viewBox="0 0 16 16" className="h-3.5 w-3.5 text-[color:var(--blue-500)]" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true">
          <path d="M8 3.5v9M3.5 8h9" />
        </svg>
      </span>

      <span
        data-category-image-transform-rotate
        className="absolute left-3 top-3 grid h-5 w-5 place-items-center rounded-full border-[1.5px] border-[color:var(--blue-500)] bg-white shadow-[0_2px_5px_rgba(15,23,42,0.16)]"
      >
        <svg viewBox="0 0 16 16" className="h-3 w-3 text-[color:var(--blue-500)]" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M12.5 5.4A5 5 0 1 0 13 9" />
          <path d="M9.7 3.2h3v3" />
        </svg>
      </span>
    </div>
  );
}

type CategoryImageTransformRect = {
  left: number;
  top: number;
  width: number;
  height: number;
};

function CategoryImageTransformOverlay({
  categorySlug,
  sourceRef
}: {
  categorySlug: string;
  sourceRef: RefObject<HTMLDivElement | null>;
}) {
  const scheduledFrameRef = useRef<number | null>(null);
  const [rect, setRect] = useState<CategoryImageTransformRect | null>(null);

  const updateRect = useCallback(() => {
    const source = sourceRef.current;
    if (!source) return;
    const bounds = source.getBoundingClientRect();
    if (bounds.width <= 0 || bounds.height <= 0) return;
    const nextRect = {
      left: bounds.left,
      top: bounds.top,
      width: bounds.width,
      height: bounds.height
    };
    setRect((current) => (
      current
      && Math.abs(current.left - nextRect.left) < 0.25
      && Math.abs(current.top - nextRect.top) < 0.25
      && Math.abs(current.width - nextRect.width) < 0.25
      && Math.abs(current.height - nextRect.height) < 0.25
        ? current
        : nextRect
    ));
  }, [sourceRef]);

  const scheduleRectUpdate = useCallback(() => {
    if (scheduledFrameRef.current !== null) return;
    scheduledFrameRef.current = window.requestAnimationFrame(() => {
      scheduledFrameRef.current = null;
      updateRect();
    });
  }, [updateRect]);

  useLayoutEffect(() => {
    updateRect();
  }, [categorySlug, updateRect]);

  useEffect(() => {
    const source = sourceRef.current;
    if (!source) return undefined;
    const previewFrame = source.closest<HTMLElement>('[data-testid="homepage-preview-frame"]');
    const cropLayer = source.parentElement;
    const presentationLayer = source.closest<HTMLElement>('[data-category-showcase-presentation]');
    const mediaMotionLayer = source.closest<HTMLElement>('.category-showcase-media-motion');
    let transitionFrame = 0;
    const followTransition = () => {
      updateRect();
      transitionFrame = window.requestAnimationFrame(followTransition);
    };
    const startFollowingTransition = () => {
      if (transitionFrame !== 0) return;
      transitionFrame = window.requestAnimationFrame(followTransition);
    };
    const stopFollowingTransition = () => {
      if (transitionFrame !== 0) window.cancelAnimationFrame(transitionFrame);
      transitionFrame = 0;
      updateRect();
    };
    const resizeObserver = typeof ResizeObserver === 'undefined'
      ? null
      : new ResizeObserver(scheduleRectUpdate);
    resizeObserver?.observe(source);
    if (previewFrame) resizeObserver?.observe(previewFrame);

    const mutationObserver = typeof MutationObserver === 'undefined'
      ? null
      : new MutationObserver(scheduleRectUpdate);
    [cropLayer, presentationLayer].forEach((element) => {
      if (!element) return;
      mutationObserver?.observe(element, {
        attributes: true,
        attributeFilter: ['class', 'style']
      });
    });

    source.addEventListener('pointermove', scheduleRectUpdate, { passive: true });
    [previewFrame, mediaMotionLayer].forEach((element) => {
      element?.addEventListener('transitionrun', startFollowingTransition);
      element?.addEventListener('transitionend', stopFollowingTransition);
      element?.addEventListener('transitioncancel', stopFollowingTransition);
    });
    window.addEventListener('resize', scheduleRectUpdate);
    window.addEventListener('scroll', scheduleRectUpdate, true);
    window.visualViewport?.addEventListener('resize', scheduleRectUpdate);
    window.visualViewport?.addEventListener('scroll', scheduleRectUpdate);
    scheduleRectUpdate();

    return () => {
      resizeObserver?.disconnect();
      mutationObserver?.disconnect();
      source.removeEventListener('pointermove', scheduleRectUpdate);
      [previewFrame, mediaMotionLayer].forEach((element) => {
        element?.removeEventListener('transitionrun', startFollowingTransition);
        element?.removeEventListener('transitionend', stopFollowingTransition);
        element?.removeEventListener('transitioncancel', stopFollowingTransition);
      });
      if (transitionFrame !== 0) window.cancelAnimationFrame(transitionFrame);
      window.removeEventListener('resize', scheduleRectUpdate);
      window.removeEventListener('scroll', scheduleRectUpdate, true);
      window.visualViewport?.removeEventListener('resize', scheduleRectUpdate);
      window.visualViewport?.removeEventListener('scroll', scheduleRectUpdate);
      if (scheduledFrameRef.current !== null) {
        window.cancelAnimationFrame(scheduledFrameRef.current);
        scheduledFrameRef.current = null;
      }
    };
  }, [scheduleRectUpdate, sourceRef, updateRect]);

  if (!rect || typeof document === 'undefined') return null;

  return createPortal(
    <CategoryImageTransformBox
      categorySlug={categorySlug}
      className="fixed z-[190]"
      style={rect}
    />,
    document.body
  );
}

function CategoryImageCanvas({
  category,
  presentation,
  children,
  selectedElementId,
  preview,
  onSelectElement,
  onCategoryPresentationChange
}: {
  category: HomepageCategoryCardData;
  presentation: CategoryShowcaseMediaSettings;
  children: ReactNode;
  selectedElementId?: string | null;
  preview: boolean;
  onSelectElement?: (elementId: string | null) => void;
  onCategoryPresentationChange?: (categorySlug: string, updates: Partial<CategoryShowcaseMediaSettings>) => void;
}) {
  const imageCanvasRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    startOffsetX: number;
    startOffsetY: number;
    width: number;
    height: number;
  } | null>(null);
  const imageElementId = `categories:image:${category.slug}`;
  const selected = preview && selectedElementId === imageElementId;
  return (
    <div
      ref={imageCanvasRef}
      data-homepage-canvas-element
      data-canvas-element-id={imageElementId}
      data-canvas-element-selected={selected || undefined}
      aria-label={`Slika kategorije ${category.title}`}
      className={classNames(
        'group/category-image absolute inset-0 touch-none',
        preview && 'cursor-move'
      )}
      onClick={(event) => {
        if (!preview || (event.target as Element).closest('[data-canvas-action]')) return;
        event.preventDefault();
        event.stopPropagation();
        onSelectElement?.(imageElementId);
      }}
      onPointerDown={(event) => {
        if (!preview || event.button !== 0 || (event.target as Element).closest('[data-canvas-action]')) return;
        event.preventDefault();
        event.stopPropagation();
        onSelectElement?.(imageElementId);
        if (!onCategoryPresentationChange) return;
        const bounds = event.currentTarget.getBoundingClientRect();
        dragRef.current = {
          pointerId: event.pointerId,
          startX: event.clientX,
          startY: event.clientY,
          startOffsetX: presentation.offsetX,
          startOffsetY: presentation.offsetY,
          width: Math.max(1, bounds.width),
          height: Math.max(1, bounds.height)
        };
        event.currentTarget.setPointerCapture(event.pointerId);
      }}
      onPointerMove={(event) => {
        const drag = dragRef.current;
        if (!drag || drag.pointerId !== event.pointerId) return;
        event.preventDefault();
        const offsetX = Math.max(
          -100 - presentation.offsetOriginX,
          Math.min(100 - presentation.offsetOriginX, drag.startOffsetX + ((event.clientX - drag.startX) / drag.width) * 100)
        );
        const offsetY = Math.max(
          -100 - presentation.offsetOriginY,
          Math.min(100 - presentation.offsetOriginY, drag.startOffsetY + ((event.clientY - drag.startY) / drag.height) * 100)
        );
        onCategoryPresentationChange?.(category.slug, { offsetX, offsetY });
      }}
      onPointerUp={(event) => {
        if (dragRef.current?.pointerId !== event.pointerId) return;
        dragRef.current = null;
        if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
      }}
      onPointerCancel={() => { dragRef.current = null; }}
    >
      <div
        className="absolute inset-0 overflow-hidden"
        data-homepage-category-image={category.slug}
      >
        {children}
      </div>
      {selected ? <CategoryImageTransformOverlay categorySlug={category.slug} sourceRef={imageCanvasRef} /> : null}
    </div>
  );
}

const homepageCategoryActionButtonBaseClassName =
  'inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-[5px] border p-0 leading-none shadow-[0_4px_12px_rgba(15,23,42,0.1)] transition focus-visible:border-[color:var(--blue-500)] focus-visible:outline-none focus-visible:ring-0 focus-visible:shadow-none';
const homepageCategoryActionLightClassName = `${homepageCategoryActionButtonBaseClassName} border-slate-200 bg-white text-slate-900 hover:bg-slate-50`;
const homepageCategoryActionDangerClassName = `${homepageCategoryActionButtonBaseClassName} border-[#f1c1bd] bg-white text-[#d2554a] hover:bg-[#fff7f6]`;

function CategoryImageAdminActions({
  category,
  canvas,
  device,
  selectedElementId,
  onSelectElement,
  onCanvasElementStyleChange,
  onCategoryImageChange,
  onCategoryImageRemove,
  onEditCategoryAppearance
}: {
  category: HomepageCategoryCardData;
  canvas: HomepageSettings['canvas'];
  device: HomepagePreviewDevice;
  selectedElementId?: string | null;
  onSelectElement?: (elementId: string | null) => void;
  onCanvasElementStyleChange?: (elementId: string, updates: Partial<HomepageCanvasElementDeviceSettings>) => void;
  onCategoryImageChange?: (categorySlug: string, file: File) => void;
  onCategoryImageRemove?: (categorySlug: string) => void;
  onEditCategoryAppearance?: (categorySlug: string) => void;
}) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const imageElementId = `categories:image:${category.slug}`;
  const cardElementId = `categories:card:${category.slug}`;
  const titleElementId = `categories:title:${category.slug}`;
  const categorySelected = [imageElementId, cardElementId, titleElementId].includes(selectedElementId ?? '');
  const cardSettings = resolveCategoryCanvasSettings(canvas, cardElementId, device);

  const openImagePicker = () => {
    const input = fileInputRef.current;
    if (!input) return;
    input.value = '';
    if (typeof input.showPicker === 'function') {
      try {
        input.showPicker();
        return;
      } catch {
        // Some browsers expose showPicker but block it; clicking is the fallback.
      }
    }
    input.click();
  };

  return (
    <>
      <div
        data-canvas-action
        data-testid="homepage-category-action-stack"
        data-homepage-category-action-stack={category.slug}
        className={classNames(
          'absolute inset-y-2.5 right-3 z-[40] flex flex-col items-end justify-center gap-[3px] transition-opacity duration-150',
          categorySelected
            ? 'opacity-100'
            : 'opacity-0 group-hover/category-showcase-tile:opacity-100 group-focus-within/category-showcase-tile:opacity-100'
        )}
      >
        {category.image ? (
          <button
            type="button"
            data-canvas-action
            aria-label={`Odstrani sliko za ${category.title}`}
            title="Odstrani sliko"
            className={homepageCategoryActionLightClassName}
            onPointerDown={(event) => { event.preventDefault(); event.stopPropagation(); }}
            onClick={(event) => { event.preventDefault(); event.stopPropagation(); onSelectElement?.(imageElementId); onCategoryImageRemove?.(category.slug); }}
          >
            <span aria-hidden="true" className="text-[11px] leading-none">×</span>
          </button>
        ) : null}
        <button
          type="button"
          data-canvas-action
          aria-label={`Dodaj ali zamenjaj sliko za ${category.title}`}
          title="Dodaj ali zamenjaj sliko"
          className={homepageCategoryActionLightClassName}
          onPointerDown={(event) => { event.preventDefault(); event.stopPropagation(); }}
          onClick={(event) => { event.preventDefault(); event.stopPropagation(); onSelectElement?.(imageElementId); openImagePicker(); }}
        >
          <svg viewBox="0 0 24 24" className="block h-3.5 w-3.5 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <rect x="3" y="4" width="18" height="16" rx="2.8" />
            <path d="m6.5 15.5 3.7-3.8a1 1 0 0 1 1.42 0L15 15l2-2a1 1 0 0 1 1.42 0l2.08 2.08" />
            <circle cx="15.5" cy="9.3" r="1.5" />
          </svg>
        </button>
        {onEditCategoryAppearance ? (
          <button
            type="button"
            data-canvas-action
            data-testid={`homepage-category-edit-appearance-${category.slug}`}
            aria-label={`Uredi videz kategorije ${category.title}`}
            title="Uredi videz kategorije"
            className={homepageCategoryActionLightClassName}
            onPointerDown={(event) => { event.preventDefault(); event.stopPropagation(); }}
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              onEditCategoryAppearance(category.slug);
            }}
          >
            <SlidersHorizontal className="h-3.5 w-3.5" />
          </button>
        ) : null}
        <button
          type="button"
          data-canvas-action
          aria-label={`Uredi slog kategorije ${category.title}`}
          title="Uredi slog kategorije"
          className={homepageCategoryActionLightClassName}
          onPointerDown={(event) => { event.preventDefault(); event.stopPropagation(); }}
          onClick={(event) => { event.preventDefault(); event.stopPropagation(); onSelectElement?.(titleElementId); }}
        >
          <svg viewBox="0 0 20 20" className="block h-3.5 w-3.5 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
            <path d="M4 14.5l.5-3L13.5 2.5l3 3L7.5 14.5z" />
            <path d="M11.5 4.5l3 3" />
          </svg>
        </button>
        <button
          type="button"
          data-canvas-action
          aria-label={`${cardSettings.visible ? 'Skrij' : 'Prikaži'} kategorijo ${category.title}`}
          title={cardSettings.visible ? 'Skrij kategorijo' : 'Prikaži kategorijo'}
          className={cardSettings.visible ? homepageCategoryActionLightClassName : homepageCategoryActionDangerClassName}
          onPointerDown={(event) => { event.preventDefault(); event.stopPropagation(); }}
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            onSelectElement?.(cardElementId);
            onCanvasElementStyleChange?.(cardElementId, { visible: !cardSettings.visible });
          }}
        >
          {cardSettings.visible ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5 text-[#d2554a]" />}
        </button>
        <button
          type="button"
          draggable
          data-canvas-action
          aria-label={`Premakni kategorijo ${category.title}`}
          title="Premakni kategorijo"
          className={`${homepageCategoryActionLightClassName} cursor-grab active:cursor-grabbing`}
          onPointerDown={(event) => { event.stopPropagation(); }}
          onClick={(event) => { event.preventDefault(); event.stopPropagation(); onSelectElement?.(cardElementId); }}
          onDragStart={(event) => {
            event.stopPropagation();
            event.dataTransfer.effectAllowed = 'move';
            event.dataTransfer.setData('application/x-atehna-homepage-category', category.slug);
            onSelectElement?.(cardElementId);
          }}
          onDragEnd={(event) => { event.stopPropagation(); }}
        >
          <GripVertical className="h-3.5 w-3.5" />
        </button>
      </div>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = '';
          if (file) onCategoryImageChange?.(category.slug, file);
        }}
      />
    </>
  );
}

function HomepageCategories({
  settings,
  categories,
  canvas,
  device,
  selectedElementId,
  preview = false,
  editorOptions,
  onSelectElement,
  onCanvasElementStyleChange,
  onCategoryTextChange,
  onCategoryImageChange,
  onCategoryImageRemove,
  onEditCategoryAppearance,
  onCategoryPresentationChange,
  onCategoryMove
}: {
  settings: HomepageCategoriesSettings;
  categories: HomepageCategoryCardData[];
  canvas: HomepageSettings['canvas'];
  device: HomepagePreviewDevice;
  selectedElementId?: string | null;
  preview?: boolean;
  editorOptions: HomepageCanvasEditorOptions;
  onSelectElement?: (elementId: string | null) => void;
  onCanvasElementStyleChange?: (elementId: string, updates: Partial<HomepageCanvasElementDeviceSettings>) => void;
  onCategoryTextChange?: (updates: CategoryTextUpdates) => void;
  onCategoryImageChange?: (categorySlug: string, file: File) => void;
  onCategoryImageRemove?: (categorySlug: string) => void;
  onEditCategoryAppearance?: (categorySlug: string) => void;
  onCategoryPresentationChange?: (categorySlug: string, updates: Partial<CategoryShowcaseMediaSettings>) => void;
  onCategoryMove?: (sourceSlug: string, targetSlug: string) => void;
}) {
  const availableCategories = useMemo(
    () => getCategoryList(categories, settings).filter((category) => (
      !isHomepageCanvasElementDeleted(canvas, `categories:card:${category.slug}`)
    )),
    [canvas, categories, settings]
  );
  const visibleCategories = useMemo(
    () => availableCategories.filter((category) => (
      resolveCategoryCanvasSettings(
        canvas,
        `categories:card:${category.slug}`,
        device
      ).visible
    )),
    [availableCategories, canvas, device]
  );
  const hiddenCategories = useMemo(
    () => preview
      ? availableCategories.filter((category) => (
          !resolveCategoryCanvasSettings(
            canvas,
            `categories:card:${category.slug}`,
            device
          ).visible
        ))
      : [],
    [availableCategories, canvas, device, preview]
  );
  const categoryCardSize = settings.cardSize;
  const categoryCardStyle = settings.cardStyle;
  const categoryCardHeight = useMemo(
    () => resolveHomepageCategoryCardHeight(
      { cardSize: categoryCardSize, cardStyle: categoryCardStyle },
      visibleCategories
    ),
    [categoryCardSize, categoryCardStyle, visibleCategories]
  );
  const handleCategoryDrop = (event: ReactDragEvent<HTMLElement>, targetSlug: string) => {
    const sourceSlug = event.dataTransfer.getData('application/x-atehna-homepage-category');
    if (!sourceSlug || sourceSlug === targetSlug) return;
    event.preventDefault();
    event.stopPropagation();
    onCategoryMove?.(sourceSlug, targetSlug);
  };

  if (visibleCategories.length === 0 && hiddenCategories.length === 0) return null;

  return (
    <div className={classNames(containerClassNames[settings.containerWidth], 'relative py-2')}>
      {hiddenCategories.map((category) => {
        const elementId = `categories:card:${category.slug}`;
        return (
          <CanvasHiddenElementFlag
            key={elementId}
            elementId={elementId}
            label={`Kartica kategorije ${category.title}`}
            kind="homepage"
            onRestore={() => onCanvasElementStyleChange?.(elementId, { visible: true })}
          />
        );
      })}
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          {!isHomepageCanvasElementDeleted(canvas, 'categories:heading') && (settings.title || preview) ? (
            <HomepageCanvasElement
              elementId="categories:heading"
              settings={resolveCategoryCanvasSettings(canvas, 'categories:heading', device)}
              selected={preview && selectedElementId === 'categories:heading'}
              preview={preview}
              editorOptions={editorOptions}
              text={settings.title}
              editableText
              textTag="h2"
              textClassName="site-heading-2"
              textLabel="Naslov sekcije kategorij"
              textPlaceholder="Dodaj naslov"
              onTextChange={(title) => onCategoryTextChange?.({ title })}
              onSelect={onSelectElement}
              onStyleChange={onCanvasElementStyleChange}
            />
          ) : null}
          {!isHomepageCanvasElementDeleted(canvas, 'categories:subtitle') && (settings.subtitle || preview) ? (
            <HomepageCanvasElement
              elementId="categories:subtitle"
              settings={resolveCategoryCanvasSettings(canvas, 'categories:subtitle', device)}
              selected={preview && selectedElementId === 'categories:subtitle'}
              preview={preview}
              editorOptions={editorOptions}
              text={settings.subtitle}
              editableText
              textTag="p"
              textClassName="site-paragraph"
              textLabel="Podnaslov sekcije kategorij"
              textPlaceholder="Dodaj podnaslov"
              className="mt-2 max-w-2xl"
              onTextChange={(subtitle) => onCategoryTextChange?.({ subtitle })}
              onSelect={onSelectElement}
              onStyleChange={onCanvasElementStyleChange}
            />
          ) : null}
        </div>
        {!isHomepageCanvasElementDeleted(canvas, 'categories:showAll') && settings.showAllLink && settings.showAllHref ? (
          <HomepageCanvasElement
            elementId="categories:showAll"
            settings={resolveCategoryCanvasSettings(canvas, 'categories:showAll', device)}
            selected={preview && selectedElementId === 'categories:showAll'}
            preview={preview}
            editorOptions={editorOptions}
            text={settings.showAllLabel}
            editableText
            textTag="span"
            textClassName="inline"
            textLabel="Besedilo povezave do vseh kategorij"
            href={settings.showAllHref}
            linkClassName="site-link inline-flex items-center gap-2 transition"
            trailingContent={<ChevronRight className="h-4 w-4" />}
            onTextChange={(showAllLabel) => onCategoryTextChange?.({ showAllLabel })}
            onSelect={onSelectElement}
            onStyleChange={onCanvasElementStyleChange}
          />
        ) : null}
      </div>

      {visibleCategories.length > 0 ? <CategoryShowcase
        items={visibleCategories}
        columns={settings.columns}
        gap={settings.gap}
        style={preview ? undefined : publicCategoryShowcaseStyle}
        interactive={preview}
        showDirectionIndicator={settings.showCardArrow}
        selectedSlug={selectedElementId?.startsWith('categories:') ? selectedElementId.split(':').at(-1) : null}
        getHref={(category) => preview ? null : catalogCategoryHref(category.slug)}
        getTileProps={(category) => ({
          'data-homepage-category-card': category.slug,
          onDragOver: (event) => {
            if (!event.dataTransfer.types.includes('application/x-atehna-homepage-category')) return;
            event.preventDefault();
            event.dataTransfer.dropEffect = 'move';
          },
          onDrop: (event) => handleCategoryDrop(event, category.slug),
          style: {
            height: categoryCardHeight
          }
        })}
        onSelectItem={(category, _index, event) => {
          if (!preview || event.defaultPrevented) return;
          onSelectElement?.(`categories:card:${category.slug}`);
        }}
        renderTitle={({ item: category }) => {
          const titleElementId = `categories:title:${category.slug}`;
          if (isHomepageCanvasElementDeleted(canvas, titleElementId)) return <></>;
          return (
            <HomepageCanvasElement
              elementId={titleElementId}
              categoryLabelSlug={category.slug}
              settings={resolveCategoryCanvasSettings(canvas, titleElementId, device)}
              selected={preview && selectedElementId === titleElementId}
              preview={preview}
              editorOptions={editorOptions}
              text={category.title}
              textTag="h3"
              textClassName="site-heading-3 line-clamp-2"
              textLabel={`Naslov kategorije ${category.title}`}
              inheritTextColor
              className="relative z-[2] min-w-0"
              onSelect={onSelectElement}
              onStyleChange={onCanvasElementStyleChange}
            />
          );
        }}
        renderMedia={({ item: category, presentation, defaultMedia }) => settings.cardStyle === 'title-only' ? null : (
          <CategoryImageCanvas
            category={category}
            presentation={presentation}
            selectedElementId={selectedElementId}
            preview={preview}
            onSelectElement={onSelectElement}
            onCategoryPresentationChange={onCategoryPresentationChange}
          >
            {defaultMedia}
          </CategoryImageCanvas>
        )}
        renderActions={({ item: category }) => preview ? (
          <CategoryImageAdminActions
            category={category}
            canvas={canvas}
            device={device}
            selectedElementId={selectedElementId}
            onSelectElement={onSelectElement}
            onCanvasElementStyleChange={onCanvasElementStyleChange}
            onCategoryImageChange={onCategoryImageChange}
            onCategoryImageRemove={onCategoryImageRemove}
            onEditCategoryAppearance={onEditCategoryAppearance}
          />
        ) : null}
        renderTile={({ item: category, tile }) => {
          const cardElementId = `categories:card:${category.slug}`;
          return (
            <HomepageCanvasElement
              elementId={cardElementId}
              settings={resolveCategoryCanvasSettings(canvas, cardElementId, device)}
              selected={preview && selectedElementId === cardElementId}
              preview={preview}
              editorOptions={editorOptions}
              layout="fill"
              className="h-full min-w-0"
              textLabel={`Kartica kategorije ${category.title}`}
              onSelect={onSelectElement}
              onStyleChange={onCanvasElementStyleChange}
            >
              {tile}
            </HomepageCanvasElement>
          );
        }}
      /> : null}
    </div>
  );
}

function HomepageInfoBlocks({
  settings,
  page
}: {
  settings: HomepageInfoBlocksSettings;
  page: HomepagePageSettings;
}) {
  const gridStyle = {
    '--home-info-columns': String(settings.columns),
    gap: `${settings.gap}px`
  } as CSSProperties & Record<string, string>;
  const boxed = settings.style === 'boxed';
  const cardRadius = sectionRadiusClassNames[page.sectionRadius];

  return (
    <div className={classNames(containerClassNames[page.containerWidth], 'py-1')}>
      <div
        className={classNames(
          'grid overflow-hidden border-[#dde4ed] bg-white max-[900px]:[grid-template-columns:repeat(2,minmax(0,1fr))] max-[560px]:[grid-template-columns:1fr]',
          '[grid-template-columns:repeat(var(--home-info-columns),minmax(0,1fr))]',
          boxed && `border shadow-[0_12px_30px_rgba(15,23,42,0.05)] ${cardRadius}`,
          !boxed && 'border-y'
        )}
        style={gridStyle}
      >
        {settings.items.map((item, index) => {
          const Icon = infoIconMap[item.icon] ?? BadgeCheck;
          const content = (
            <div
              className={classNames(
                'flex h-full gap-4 px-5 py-4',
                settings.iconPosition === 'top' ? 'flex-col' : 'items-center',
                settings.alignment === 'center' && 'items-center text-center',
                !boxed && settings.dividers && index > 0 && 'border-l border-[#dde4ed] max-[560px]:border-l-0 max-[560px]:border-t'
              )}
            >
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-[#d8e0eb] text-[#121822]">
                <Icon className="h-5 w-5" strokeWidth={1.8} />
              </span>
              <span className="min-w-0">
                <span className="block text-[14px] font-semibold text-[#121822]">{item.title}</span>
                {item.description ? <span className="mt-1 block text-[12px] leading-5 text-[#536070]">{item.description}</span> : null}
              </span>
            </div>
          );

          return item.href ? (
            <Link key={item.id} href={item.href} prefetch={false} className="block transition hover:bg-[#f8fafc]">
              {content}
            </Link>
          ) : (
            <div key={item.id}>{content}</div>
          );
        })}
      </div>
    </div>
  );
}

export default function HomepageRenderer({
  settings,
  categories,
  canonicalFooter,
  selectedSectionId,
  onSelectSection,
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
  selectedElementId,
  onSelectElement,
  onCanvasElementStyleChange,
  onRestoreHiddenElement,
  onMoveSection,
  editorOptions = DEFAULT_HOMEPAGE_CANVAS_EDITOR_OPTIONS,
  editorSectionId,
  preview = false,
  previewDevice,
  previewViewportWidth,
  previewHeroStorefrontStyle
}: HomepageRendererProps) {
  const normalizedSettings = useMemo(() => normalizeLandingPageConfig(settings), [settings]);
  const renderDevice = useHomepageRenderDevice(previewDevice);
  const resolvedSettings = useMemo(
    () => resolveHomepageSettingsForDevice(normalizedSettings, renderDevice),
    [normalizedSettings, renderDevice]
  );
  const activeEditorSectionId = editorSectionId ?? selectedSectionId;
  const rootStyle = {
    backgroundColor: resolvedSettings.page.backgroundColor || '#ffffff'
  };
  const footerSettings = canonicalFooter ?? resolvedSettings.footer;
  const footerLogoElementId = 'footer:logo';
  const footerDescriptionElementId = 'footer:description';
  const footerLogoDeleted = isHomepageCanvasElementDeleted(normalizedSettings.canvas, footerLogoElementId);
  const footerDescriptionDeleted = isHomepageCanvasElementDeleted(normalizedSettings.canvas, footerDescriptionElementId);
  const footerLogoConfigured = Boolean(normalizedSettings.canvas.elements[footerLogoElementId]);
  const footerDescriptionConfigured = Boolean(normalizedSettings.canvas.elements[footerDescriptionElementId]);
  const footerLogoCanvasSettings = footerLogoConfigured
    ? resolveHomepageCanvasElementDeviceSettings(normalizedSettings.canvas, footerLogoElementId, renderDevice)
    : { ...DEFAULT_HOMEPAGE_CANVAS_ELEMENT_DEVICE_SETTINGS };
  const footerDescriptionCanvasSettings = footerDescriptionConfigured
    ? resolveHomepageCanvasElementDeviceSettings(normalizedSettings.canvas, footerDescriptionElementId, renderDevice)
    : {
        ...DEFAULT_HOMEPAGE_CANVAS_ELEMENT_DEVICE_SETTINGS,
        fontSizePx: 13,
        lineHeight: 1.85,
        fontWeight: 400
      };
  const footerEditorAdapter: SiteFooterEditorAdapter | undefined = preview
    || footerLogoConfigured
    || footerDescriptionConfigured
    || footerLogoDeleted
    || footerDescriptionDeleted
    ? {
        editorMode: preview,
        forceVisible: preview,
        showEmpty: false,
        renderLogo: ({ settings: currentFooter, logoMode, logo, defaultNode }) => footerLogoDeleted ? null : (
          <HomepageCanvasElement
            elementId={footerLogoElementId}
            settings={footerLogoCanvasSettings}
            selected={preview && selectedElementId === footerLogoElementId}
            preview={preview}
            editorOptions={editorOptions}
            onSelect={onSelectElement}
            onStyleChange={onCanvasElementStyleChange}
            visualScaleWithHeight
            textLabel="Logotip noge"
            sizedChildren={preview
              ? <span aria-label="Logotip Atehna" className="inline-flex h-full w-full items-center">{renderSiteFooterLogo(currentFooter, logoMode, true)}</span>
              : (
                <Link href="/" prefetch={false} aria-label="Atehna domov" className="inline-flex h-full w-full items-center">
                  {renderSiteFooterLogo(currentFooter, logoMode, true)}
                </Link>
              )}
          >
            {preview ? <span aria-label="Logotip Atehna" className="inline-flex">{logo}</span> : defaultNode}
          </HomepageCanvasElement>
        ),
        renderDescription: ({ value }) => footerDescriptionDeleted ? null : (
          <HomepageCanvasElement
            elementId={footerDescriptionElementId}
            settings={footerDescriptionCanvasSettings}
            selected={preview && selectedElementId === footerDescriptionElementId}
            preview={preview}
            editorOptions={editorOptions}
            text={value}
            editableText
            textClassName="site-paragraph"
            textLabel="Opis noge"
            className="mt-4"
            onTextChange={preview ? onFooterDescriptionChange : undefined}
            onSelect={onSelectElement}
            onStyleChange={onCanvasElementStyleChange}
          />
        )
      }
    : undefined;

  return (
    <div
      className={classNames('flex min-h-full flex-col', sectionGapClassNames[resolvedSettings.page.sectionSpacing])}
      data-preview-homepage-device={preview ? renderDevice : undefined}
      style={rootStyle}
    >
      {resolvedSettings.sectionOrder.map((sectionId, sectionIndex) => {
        const sectionCanvasSettings = resolveHomepageCanvasElementDeviceSettings(resolvedSettings.canvas, `section:${sectionId}`, renderDevice);
        const sectionContentVisible = sectionId === 'hero'
          ? resolvedSettings.hero.visible
          : sectionId === 'categories'
            ? resolvedSettings.categories.visible
            : sectionId === 'infoBlocks'
              ? resolvedSettings.infoBlocks.visible
              : resolvedSettings.footer.visible && (canonicalFooter?.visible ?? true);
        const sectionVisible = sectionContentVisible && sectionCanvasSettings.visible;
        if (!preview && !sectionVisible) return null;
        const sectionFrameProps = {
          sectionId,
          selectedSectionId,
          selectedElementId,
          onSelectSection,
          onSelectElement,
          onMoveSection,
          canMoveUp: sectionIndex > 0,
          canMoveDown: sectionIndex < resolvedSettings.sectionOrder.length - 1,
          hidden: !sectionVisible,
          onRestoreHidden: () => onRestoreHiddenElement?.(`section:${sectionId}`),
          preview,
          editorActive: preview && activeEditorSectionId === sectionId,
          editorOptions,
          editorContentScale: sectionId === 'hero' && previewHeroStorefrontStyle
            ? COMMERCIAL_STOREFRONT_SCALE
            : 1
        };

        if (sectionId === 'hero') {
          const storefrontScaledPreview = preview && Boolean(previewHeroStorefrontStyle);
          const heroPreviewViewportWidth = storefrontScaledPreview && previewViewportWidth
            ? previewViewportWidth / COMMERCIAL_STOREFRONT_SCALE
            : previewViewportWidth;
          const heroNode = (
            <HomepageHero
              hero={resolvedSettings.hero}
              page={resolvedSettings.page}
              canvas={resolvedSettings.canvas}
              preview={preview}
              showTechnicalGuides={preview && editorOptions.measurements && selectedElementId === 'section:hero'}
              previewViewportWidth={heroPreviewViewportWidth}
              previewDevice={renderDevice}
              editorContentScale={storefrontScaledPreview ? COMMERCIAL_STOREFRONT_SCALE : 1}
              selectedElementId={selectedElementId}
              onSelect={() => onSelectSection?.('hero')}
              onSelectElement={onSelectElement}
              onCanvasElementStyleChange={onCanvasElementStyleChange}
              onRestoreHiddenElement={onRestoreHiddenElement}
              editorOptions={editorOptions}
              onTextPositionChange={onHeroTextPositionChange}
              onTextContentChange={onHeroTextContentChange}
              onTextBlockChange={onHeroTextBlockChange}
            />
          );

          return (
            <SectionFrame
              key={sectionId}
              {...sectionFrameProps}
            >
              {storefrontScaledPreview ? (
                <div
                  data-testid="homepage-preview-hero-storefront-scale"
                  data-preview-device={renderDevice}
                  data-preview-wide-lane={(previewViewportWidth ?? 0) >= 1024 ? 'true' : 'false'}
                  data-storefront-theme="true"
                  className="commercial-storefront-scale homepage-preview-hero-storefront-scale storefront-theme-preview site-page-surface"
                  style={previewHeroStorefrontStyle}
                >
                  {heroNode}
                </div>
              ) : heroNode}
            </SectionFrame>
          );
        }

        if (sectionId === 'categories') {
          return (
            <SectionFrame
              key={sectionId}
              {...sectionFrameProps}
            >
              <HomepageCategories
                settings={resolvedSettings.categories}
                categories={categories}
                canvas={normalizedSettings.canvas}
                device={renderDevice}
                selectedElementId={selectedElementId}
                preview={preview}
                editorOptions={editorOptions}
                onSelectElement={onSelectElement}
                onCanvasElementStyleChange={onCanvasElementStyleChange}
                onCategoryTextChange={onCategoryTextChange}
                onCategoryImageChange={onCategoryImageChange}
                onCategoryImageRemove={onCategoryImageRemove}
                onEditCategoryAppearance={onEditCategoryAppearance}
                onCategoryPresentationChange={onCategoryPresentationChange}
                onCategoryMove={onCategoryMove}
              />
            </SectionFrame>
          );
        }

        if (sectionId === 'infoBlocks') {
          return (
            <SectionFrame
              key={sectionId}
              {...sectionFrameProps}
            >
              <HomepageInfoBlocks settings={resolvedSettings.infoBlocks} page={resolvedSettings.page} />
            </SectionFrame>
          );
        }

        if (sectionId === 'footer') {
          return (
            <SectionFrame
              key={sectionId}
              {...sectionFrameProps}
            >
              <SiteFooter
                settings={footerSettings}
                presentation={{
                  logoMode: resolvedSettings.footer.logoMode,
                  layoutColumns: resolvedSettings.footer.layoutColumns,
                  spacing: resolvedSettings.footer.spacing,
                  topBorder: resolvedSettings.footer.topBorder
                }}
                containerClassName={containerClassNames[resolvedSettings.page.containerWidth]}
                responsivePresentation={false}
                editorAdapter={footerEditorAdapter}
              />
            </SectionFrame>
          );
        }

        return null;
      })}
    </div>
  );
}
