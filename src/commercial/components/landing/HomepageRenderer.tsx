'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useMemo, useRef, useState, type CSSProperties, type MouseEvent as ReactMouseEvent, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react';
import {
  BadgeCheck,
  Bold,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Clock,
  Globe2,
  GripVertical,
  Headphones,
  Home,
  Image as ImageIcon,
  Italic,
  Link as LinkIcon,
  Mail,
  MapPin,
  PackageCheck,
  Phone,
  Pencil,
  Plus,
  School,
  Settings,
  ShieldCheck,
  Truck,
  Underline,
  Wrench,
  type LucideIcon
} from 'lucide-react';
import { catalogCategoryHref } from '@/commercial/catalog/catalogRoutes';
import AtehnaLogo from '@/commercial/components/AtehnaLogo';
import {
  DEFAULT_HOMEPAGE_CATEGORY_CARDS,
  HOMEPAGE_HERO_FONT_FAMILIES,
  type HomepageButtonStyle,
  type HomepageCategoryCardData,
  type HomepageCategoriesSettings,
  type HomepageFooterSettings,
  type HomepageHeroFontFamily,
  type HomepageHeroSettings,
  type HomepageHeroTextBlock,
  type HomepageInfoBlocksSettings,
  type HomepageInfoIcon,
  type HomepagePageSettings,
  type HomepagePreviewDevice,
  type HomepageSectionId,
  type HomepageSettings,
  type HomepageSocialType,
  normalizeLandingPageConfig,
  resolveHomepageSettingsForDevice
} from '@/shared/domain/landing/landingPage';

const classNames = (...parts: Array<string | false | null | undefined>) => parts.filter(Boolean).join(' ');

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

const categoryCardHeightClassNames: Record<HomepageCategoriesSettings['cardSize'], string> = {
  small: 'min-h-[150px] p-5',
  medium: 'min-h-[190px] p-6',
  large: 'min-h-[240px] p-7'
};

const footerSpacingClassNames: Record<HomepageFooterSettings['spacing'], string> = {
  compact: 'py-6',
  medium: 'py-8',
  large: 'py-12'
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

const socialIconMap: Partial<Record<HomepageSocialType, LucideIcon>> = {
  facebook: Globe2,
  instagram: Globe2,
  youtube: Globe2,
  linkedin: Globe2,
  custom: Globe2,
  x: Globe2
};

const siteContentMaxWidthPx = 1280;
const siteWideContentMaxWidthPx = siteContentMaxWidthPx + 160;
const heroMinimumTextWidthPx = 180;

function clampNumber(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
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

function getHeroTextMetrics(hero: HomepageHeroSettings, page: HomepagePageSettings, viewportWidth: number) {
  const container = getHeroContainerMetrics(page, viewportWidth);
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

function getHomepageDeviceForViewport(width: number): HomepagePreviewDevice {
  if (width <= 767) return 'mobile';
  if (width <= 1024) return 'tablet';
  return 'desktop';
}

function useHomepageRenderDevice(previewDevice?: HomepagePreviewDevice) {
  const [device, setDevice] = useState<HomepagePreviewDevice>(previewDevice ?? 'desktop');

  useEffect(() => {
    if (previewDevice) {
      setDevice(previewDevice);
      return undefined;
    }

    const updateDevice = () => {
      setDevice(getHomepageDeviceForViewport(window.innerWidth));
    };

    updateDevice();
    window.addEventListener('resize', updateDevice);
    return () => window.removeEventListener('resize', updateDevice);
  }, [previewDevice]);

  return device;
}

type HomepageRendererProps = {
  settings: HomepageSettings;
  categories: HomepageCategoryCardData[];
  selectedSectionId?: HomepageSectionId;
  onSelectSection?: (sectionId: HomepageSectionId) => void;
  onHeroTextPositionChange?: (updates: HeroPositionUpdates) => void;
  onHeroTextContentChange?: (updates: HeroTextContentUpdates) => void;
  onHeroTypographyChange?: (updates: HeroTypographyUpdates) => void;
  onHeroTextBlockAdd?: () => string | undefined;
  onHeroTextBlockChange?: (blockId: string, updates: HeroTextBlockUpdates) => void;
  onHeroMediaFocus?: () => void;
  onHeroSettingsFocus?: () => void;
  preview?: boolean;
  previewDevice?: HomepagePreviewDevice;
  previewViewportWidth?: number;
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
type HeroTextContentUpdates = Partial<Pick<HomepageHeroSettings, 'title' | 'description'>>;
type HeroTextBlockUpdates = Partial<
  Pick<HomepageHeroTextBlock, 'text' | 'visible' | 'href' | 'xPx' | 'yPx' | 'widthPx' | 'fontFamily' | 'fontSizePx' | 'bold' | 'italic' | 'underline' | 'responsive'>
>;
type HeroTypographyUpdates = Partial<
  Pick<
    HomepageHeroSettings,
    | 'titleFontFamily'
    | 'titleFontSizePx'
    | 'titleBold'
    | 'titleItalic'
    | 'titleUnderline'
    | 'descriptionFontFamily'
    | 'descriptionFontSizePx'
    | 'descriptionBold'
    | 'descriptionItalic'
    | 'descriptionUnderline'
  >
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
  onSelectSection?: (sectionId: HomepageSectionId) => void;
  preview?: boolean;
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
};

function getCategoryList(categories: HomepageCategoryCardData[], settings: HomepageCategoriesSettings) {
  const source = categories.length > 0 ? categories : DEFAULT_HOMEPAGE_CATEGORY_CARDS;
  const bySlug = new Map(source.map((category) => [category.slug, category]));
  const ordered = [
    ...settings.categoryOrder.map((slug) => bySlug.get(slug)).filter((category): category is HomepageCategoryCardData => Boolean(category)),
    ...source.filter((category) => !settings.categoryOrder.includes(category.slug))
  ];

  return ordered.slice(0, settings.limit);
}

function SectionFrame({
  sectionId,
  selectedSectionId,
  onSelectSection,
  preview,
  children,
  className,
  style
}: SectionFrameProps) {
  const selected = preview && selectedSectionId === sectionId;

  return (
    <section
      data-homepage-section={sectionId}
      onClickCapture={(event) => {
        if (preview && onSelectSection) event.preventDefault();
        onSelectSection?.(sectionId);
      }}
      className={classNames(
        'relative',
        preview && onSelectSection && 'cursor-pointer',
        selected && 'outline outline-2 outline-offset-2 outline-[color:var(--blue-500)]',
        className
      )}
      style={style}
    >
      {children}
    </section>
  );
}

function buttonClassName(style: HomepageButtonStyle, tone: 'primary' | 'secondary') {
  const base =
    'inline-flex h-12 items-center justify-center gap-3 rounded-lg px-5 text-[15px] font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/45';

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
    fontFamily: hero.titleFontFamily,
    fontSize: `${hero.titleFontSizePx}px`,
    fontStyle: hero.titleItalic ? 'italic' : undefined,
    fontWeight: hero.titleBold ? 800 : 600,
    textDecorationLine: hero.titleUnderline ? 'underline' : undefined,
    textTransform: hero.titleTransform === 'uppercase' ? 'uppercase' : undefined
  };
}

function getHeroDescriptionTextStyle(hero: HomepageHeroSettings): CSSProperties {
  return {
    fontFamily: hero.descriptionFontFamily,
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
    fontFamily: resolvedBlock.fontFamily,
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
  viewportWidth
}: {
  hero: HomepageHeroSettings;
  page: HomepagePageSettings;
  viewportWidth: number;
}) {
  const metrics = getHeroTextMetrics(hero, page, viewportWidth);
  const percent = (value: number) => `${(value / viewportWidth) * 100}%`;
  const mediaRight = metrics.mediaLeft + metrics.mediaWidthPx;
  const mediaDelta = hero.mediaWidthPercent - 100;
  const mediaLabel = mediaDelta < 0
    ? `Medij ${hero.mediaWidthPercent}% · stisk ${Math.abs(mediaDelta)}%`
    : mediaDelta > 0
      ? `Medij ${hero.mediaWidthPercent}% · razširitev +${mediaDelta}%`
      : 'Medij 100% · brez stiska';
  const centerLabel = metrics.centerDelta === 0 ? 'Sredina 0 px' : `Sredina ${metrics.centerDelta > 0 ? '+' : ''}${metrics.centerDelta} px`;

  return (
    <div className="pointer-events-none absolute inset-0 z-30 text-[11px] font-semibold leading-none text-[color:var(--blue-600)]">
      <div className="absolute inset-y-0 w-px bg-[color:var(--blue-500)]/45" style={{ left: percent(viewportWidth / 2) }} />
      <div className="absolute top-3 -translate-x-1/2 rounded bg-white/90 px-1.5 py-1 shadow-sm ring-1 ring-[color:var(--blue-500)]/20" style={{ left: percent(viewportWidth / 2) }}>
        {centerLabel}
      </div>

      <div className="absolute inset-y-0 w-px border-l border-dashed border-[color:var(--blue-500)]/45" style={{ left: percent(metrics.contentLeft) }} />
      <div className="absolute inset-y-0 w-px border-l border-dashed border-[color:var(--blue-500)]/45" style={{ left: percent(metrics.contentRight) }} />
      <div className="absolute top-8 rounded bg-white/90 px-1.5 py-1 shadow-sm ring-1 ring-[color:var(--blue-500)]/20" style={{ left: percent(metrics.contentLeft) }}>
        Vsebina {Math.round(metrics.contentWidth)} px
      </div>

      <div className="absolute top-[37%] h-px bg-[color:var(--blue-500)]" style={{ left: percent(metrics.contentLeft), width: percent(metrics.leftDistance) }} />
      <div className="absolute top-[37%] h-3 w-px -translate-y-1/2 bg-[color:var(--blue-500)]" style={{ left: percent(metrics.contentLeft) }} />
      <div className="absolute top-[37%] h-3 w-px -translate-y-1/2 bg-[color:var(--blue-500)]" style={{ left: percent(metrics.textLeft) }} />
      <div className="absolute top-[37%] -translate-y-[calc(100%+6px)] rounded bg-white/95 px-1.5 py-1 shadow-sm ring-1 ring-[color:var(--blue-500)]/20" style={{ left: percent((metrics.contentLeft + metrics.textLeft) / 2), transform: 'translate(-50%, calc(-100% - 6px))' }}>
        Levo {metrics.leftDistance} px
      </div>

      <div className="absolute top-[46%] h-px bg-[color:var(--blue-500)]" style={{ left: percent(metrics.textLeft), width: percent(metrics.textWidth) }} />
      <div className="absolute top-[46%] h-3 w-px -translate-y-1/2 bg-[color:var(--blue-500)]" style={{ left: percent(metrics.textLeft) }} />
      <div className="absolute top-[46%] h-3 w-px -translate-y-1/2 bg-[color:var(--blue-500)]" style={{ left: percent(metrics.textRight) }} />
      <div className="absolute top-[46%] rounded bg-white/95 px-1.5 py-1 shadow-sm ring-1 ring-[color:var(--blue-500)]/20" style={{ left: percent((metrics.textLeft + metrics.textRight) / 2), transform: 'translate(-50%, calc(-100% - 6px))' }}>
        Besedilo {Math.round(metrics.textWidth)} px · {metrics.textWidthPercent}%
      </div>

      <div className="absolute top-[55%] h-px bg-[color:var(--blue-500)]" style={{ left: percent(metrics.textRight), width: percent(metrics.rightDistance) }} />
      <div className="absolute top-[55%] h-3 w-px -translate-y-1/2 bg-[color:var(--blue-500)]" style={{ left: percent(metrics.textRight) }} />
      <div className="absolute top-[55%] h-3 w-px -translate-y-1/2 bg-[color:var(--blue-500)]" style={{ left: percent(metrics.contentRight) }} />
      <div className="absolute top-[55%] rounded bg-white/95 px-1.5 py-1 shadow-sm ring-1 ring-[color:var(--blue-500)]/20" style={{ left: percent((metrics.textRight + metrics.contentRight) / 2), transform: 'translate(-50%, calc(-100% - 6px))' }}>
        Desno {metrics.rightDistance} px
      </div>

      <div className="absolute bottom-4 right-4 rounded bg-white/95 px-2 py-1.5 text-right shadow-sm ring-1 ring-[color:var(--blue-500)]/20">
        Višina {hero.heightPx} px · Y {metrics.textOffsetY > 0 ? '+' : ''}{metrics.textOffsetY} px
      </div>
      <div className="absolute bottom-4 top-4 w-px bg-[color:var(--blue-500)]/70" style={{ right: 16 }} />
      <div className="absolute right-[12px] top-4 h-px w-2 bg-[color:var(--blue-500)]/70" />
      <div className="absolute bottom-4 right-[12px] h-px w-2 bg-[color:var(--blue-500)]/70" />

      <div className="absolute top-16 h-px bg-cyan-500/80" style={{ left: percent(metrics.mediaLeft), width: percent(metrics.mediaWidthPx) }} />
      <div className="absolute top-[58px] h-4 w-px bg-cyan-500/80" style={{ left: percent(metrics.mediaLeft) }} />
      <div className="absolute top-[58px] h-4 w-px bg-cyan-500/80" style={{ left: percent(mediaRight) }} />
      <div className="absolute top-[74px] rounded bg-white/95 px-1.5 py-1 text-cyan-700 shadow-sm ring-1 ring-cyan-500/20" style={{ left: percent((metrics.mediaLeft + mediaRight) / 2), transform: 'translateX(-50%)' }}>
        {mediaLabel}
      </div>
    </div>
  );
}

function HomepageHero({
  hero,
  page,
  preview,
  showTechnicalGuides,
  previewViewportWidth,
  previewDevice,
  selected,
  onSelect,
  onTextPositionChange,
  onTextContentChange,
  onTypographyChange,
  onTextBlockAdd,
  onTextBlockChange,
  onMediaFocus,
  onSettingsFocus
}: {
  hero: HomepageHeroSettings;
  page: HomepagePageSettings;
  preview?: boolean;
  showTechnicalGuides?: boolean;
  previewViewportWidth?: number;
  previewDevice?: HomepagePreviewDevice;
  selected?: boolean;
  onSelect?: () => void;
  onTextPositionChange?: (updates: HeroPositionUpdates) => void;
  onTextContentChange?: (updates: HeroTextContentUpdates) => void;
  onTypographyChange?: (updates: HeroTypographyUpdates) => void;
  onTextBlockAdd?: () => string | undefined;
  onTextBlockChange?: (blockId: string, updates: HeroTextBlockUpdates) => void;
  onMediaFocus?: () => void;
  onSettingsFocus?: () => void;
}) {
  const slides = hero.slides.filter((slide) => slide.src.trim());
  const [activeIndex, setActiveIndex] = useState(0);
  const [hovered, setHovered] = useState(false);
  const [toolbarCollapsed, setToolbarCollapsed] = useState(false);
  const [inlineEditMode, setInlineEditMode] = useState(false);
  const [selectedLayer, setSelectedLayer] = useState<HeroEditableLayer | null>(null);
  const [editingLayer, setEditingLayer] = useState<HeroEditableLayer | null>(null);
  const titleEditRef = useRef<HTMLHeadingElement | null>(null);
  const descriptionEditRef = useRef<HTMLParagraphElement | null>(null);
  const textBlockEditRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const activeSlide = slides[activeIndex] ?? slides[0] ?? hero.slides[0];
  const hasMultipleSlides = slides.length > 1;
  const inlineEditorEnabled = Boolean(preview && previewDevice === 'desktop');
  const heroToolbarVisible = inlineEditorEnabled && !toolbarCollapsed && (hovered || selected || inlineEditMode || Boolean(selectedLayer));
  const dragRef = useRef<null | {
    target: HeroDragTarget;
    pointerId: number;
    startClientX: number;
    startClientY: number;
    startX: number;
    startY: number;
    scaleX: number;
    scaleY: number;
    viewportWidth: number;
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
  }>(null);
  const textBlockDragRef = useRef<null | {
    blockId: string;
    pointerId: number;
    startClientX: number;
    startClientY: number;
    startX: number;
    startY: number;
    scaleX: number;
    scaleY: number;
  }>(null);

  useEffect(() => {
    setActiveIndex((current) => Math.min(current, Math.max(0, slides.length - 1)));
  }, [slides.length]);

  useEffect(() => {
    if (!hero.autoplay || !hasMultipleSlides) return undefined;
    const timer = window.setInterval(() => {
      setActiveIndex((current) => (current + 1) % slides.length);
    }, hero.autoplayInterval);
    return () => window.clearInterval(timer);
  }, [hero.autoplay, hero.autoplayInterval, hasMultipleSlides, slides.length]);

  useEffect(() => {
    if (!inlineEditorEnabled) return undefined;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setInlineEditMode(false);
      setEditingLayer(null);
      setSelectedLayer(null);
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [inlineEditorEnabled]);

  useEffect(() => {
    if (!inlineEditorEnabled || !selectedLayer) return undefined;

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target instanceof Element ? event.target : null;
      if (target?.closest('[data-homepage-hero-root], [data-hero-typography-toolbar]')) return;
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

  const overlayOpacity = hero.darkenBackground ? hero.overlayStrength / 100 : 0;
  const overlayStyle: CSSProperties = {
    background:
      hero.contentAlign === 'right'
        ? `linear-gradient(270deg, rgba(0,0,0,${Math.min(0.82, overlayOpacity + 0.16)}) 0%, rgba(0,0,0,${overlayOpacity}) 44%, rgba(0,0,0,0.12) 100%)`
        : hero.contentAlign === 'center'
          ? `linear-gradient(90deg, rgba(0,0,0,${overlayOpacity}) 0%, rgba(0,0,0,${Math.min(0.78, overlayOpacity + 0.08)}) 50%, rgba(0,0,0,${overlayOpacity}) 100%)`
          : `linear-gradient(90deg, rgba(0,0,0,${Math.min(0.82, overlayOpacity + 0.18)}) 0%, rgba(0,0,0,${overlayOpacity}) 46%, rgba(0,0,0,0.08) 100%)`
  };

  const goToPrevious = () => setActiveIndex((current) => (current - 1 + slides.length) % slides.length);
  const goToNext = () => setActiveIndex((current) => (current + 1) % slides.length);
  const mediaFrameStyle: CSSProperties = {
    width: `${hero.mediaWidthPercent}%`,
    left: '50%',
    transform: 'translateX(-50%)'
  };
  const textBlockStyle = {
    '--hero-text-offset': `min(${hero.contentOffsetXPx}px, max(0px, calc(100% - ${heroMinimumTextWidthPx}px)))`,
    marginLeft: 'var(--hero-text-offset)',
    width: `${hero.textWidthPx}px`,
    maxWidth: `max(${heroMinimumTextWidthPx}px, calc(100% - var(--hero-text-offset)))`,
    transform: `translateY(${hero.contentOffsetYPx}px)`,
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
    return {
      transform: `translate(${offset.x}px, ${offset.y}px)`,
      touchAction: preview && onTextPositionChange ? 'none' : undefined
    };
  };
  const elementDragClassName = classNames(
    'relative',
    preview && onTextPositionChange && 'cursor-move rounded-md outline outline-1 outline-transparent transition hover:outline-white/45'
  );
  const renderElementOffsetBadge = (target: HeroElementDragTarget) => {
    if (!preview || !showTechnicalGuides) return null;
    const offset = getElementOffset(target);
    const label = heroElementOffsetKeys[target].label;

    return (
      <span className="pointer-events-none absolute left-0 top-0 z-10 -translate-y-[calc(100%+3px)] whitespace-nowrap rounded bg-white/95 px-1.5 py-1 text-[10px] font-semibold leading-none text-[color:var(--blue-600)] shadow-sm ring-1 ring-[color:var(--blue-500)]/20">
        {label} X {offset.x} · Y {offset.y}
      </span>
    );
  };
  const startTextDrag = (target: HeroDragTarget) => (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!preview || !onTextPositionChange || !previewViewportWidth) return;
    if (editingLayer) return;

    const heroRoot = event.currentTarget.closest<HTMLElement>('[data-homepage-hero-root]');
    if (!heroRoot) return;

    const rootRect = heroRoot.getBoundingClientRect();
    const scaleX = rootRect.width > 0 ? rootRect.width / previewViewportWidth : 1;
    const scaleY = rootRect.height > 0 ? rootRect.height / hero.heightPx : scaleX;
    const metrics = getHeroTextMetrics(hero, page, previewViewportWidth);
    const isBlock = target === 'block';
    const elementOffset = isBlock ? { x: hero.contentOffsetXPx, y: hero.contentOffsetYPx } : getElementOffset(target);

    dragRef.current = {
      target,
      pointerId: event.pointerId,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startX: elementOffset.x,
      startY: elementOffset.y,
      scaleX: scaleX || 1,
      scaleY: scaleY || 1,
      viewportWidth: previewViewportWidth,
      minX: isBlock ? 0 : -previewViewportWidth,
      maxX: isBlock ? Math.max(0, metrics.contentWidth - metrics.textWidth) : previewViewportWidth,
      minY: isBlock ? -Math.round(hero.heightPx / 2) : -hero.heightPx,
      maxY: isBlock ? Math.round(hero.heightPx / 2) : hero.heightPx
    };
    event.currentTarget.setPointerCapture(event.pointerId);
    event.stopPropagation();
    event.preventDefault();
  };
  const moveTextDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId || !onTextPositionChange) return;

    const nextX = clampNumber(
      drag.startX + (event.clientX - drag.startClientX) / drag.scaleX,
      drag.minX,
      drag.maxX
    );
    const nextY = clampNumber(
      drag.startY + (event.clientY - drag.startClientY) / drag.scaleY,
      drag.minY,
      drag.maxY
    );

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
      event.currentTarget.releasePointerCapture(event.pointerId);
      event.stopPropagation();
    }
  };
  const startTextBlockDrag = (block: HomepageHeroTextBlock) => (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!inlineEditorEnabled || !previewViewportWidth || editingLayer) return;
    const heroRoot = event.currentTarget.closest<HTMLElement>('[data-homepage-hero-root]');
    if (!heroRoot) return;

    const resolvedBlock = resolveHeroTextBlockForDevice(block, previewDevice);
    const rootRect = heroRoot.getBoundingClientRect();
    const scaleX = rootRect.width > 0 ? rootRect.width / previewViewportWidth : 1;
    const scaleY = rootRect.height > 0 ? rootRect.height / hero.heightPx : scaleX;

    textBlockDragRef.current = {
      blockId: block.id,
      pointerId: event.pointerId,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startX: resolvedBlock.xPx,
      startY: resolvedBlock.yPx,
      scaleX: scaleX || 1,
      scaleY: scaleY || 1
    };
    event.currentTarget.setPointerCapture(event.pointerId);
    event.stopPropagation();
  };
  const moveTextBlockDrag = (block: HomepageHeroTextBlock) => (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = textBlockDragRef.current;
    if (!drag || drag.blockId !== block.id || drag.pointerId !== event.pointerId) return;
    const nextX = Math.round(clampNumber(drag.startX + (event.clientX - drag.startClientX) / drag.scaleX, -previewViewportWidth!, previewViewportWidth!));
    const nextY = Math.round(clampNumber(drag.startY + (event.clientY - drag.startClientY) / drag.scaleY, -hero.heightPx, hero.heightPx + 300));

    updateTextBlockForDevice(block, { xPx: nextX, yPx: nextY });
    event.stopPropagation();
    event.preventDefault();
  };
  const endTextBlockDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (textBlockDragRef.current?.pointerId === event.pointerId) {
      textBlockDragRef.current = null;
      event.currentTarget.releasePointerCapture(event.pointerId);
      event.stopPropagation();
    }
  };
  const selectLayer = (layer: HeroEditableLayer) => {
    if (!inlineEditorEnabled || !inlineEditMode) return;
    onSelect?.();
    setSelectedLayer(layer);
    setEditingLayer(null);
  };
  const startInlineTextEditing = () => {
    if (!inlineEditorEnabled) return;
    onSelect?.();
    setToolbarCollapsed(false);
    setInlineEditMode(true);
    setSelectedLayer((current) => current ?? 'title');
  };
  const editLayer = (layer: HeroEditableLayer) => {
    if (!inlineEditorEnabled || !inlineEditMode) return;
    onSelect?.();
    setSelectedLayer(layer);
    setEditingLayer(layer);
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
  const updateLayerTypography = (layer: HeroEditableLayer, updates: {
    fontFamily?: HomepageHeroFontFamily;
    fontSizePx?: number;
    bold?: boolean;
    italic?: boolean;
    underline?: boolean;
  }) => {
    if (layer === 'title') {
      onTypographyChange?.({
        titleFontFamily: updates.fontFamily,
        titleFontSizePx: updates.fontSizePx,
        titleBold: updates.bold,
        titleItalic: updates.italic,
        titleUnderline: updates.underline
      });
      return;
    }
    if (layer === 'description') {
      onTypographyChange?.({
        descriptionFontFamily: updates.fontFamily,
        descriptionFontSizePx: updates.fontSizePx,
        descriptionBold: updates.bold,
        descriptionItalic: updates.italic,
        descriptionUnderline: updates.underline
      });
      return;
    }

    const blockId = layer.replace('textBlock:', '');
    const block = hero.textBlocks.find((candidate) => candidate.id === blockId);
    if (block) updateTextBlockForDevice(block, updates);
  };
  const getLayerTypography = (layer: HeroEditableLayer) => {
    if (layer === 'title') {
      return {
        fontFamily: hero.titleFontFamily,
        fontSizePx: hero.titleFontSizePx,
        bold: hero.titleBold,
        italic: hero.titleItalic,
        underline: hero.titleUnderline,
        linkable: false,
        href: ''
      };
    }
    if (layer === 'description') {
      return {
        fontFamily: hero.descriptionFontFamily,
        fontSizePx: hero.descriptionFontSizePx,
        bold: hero.descriptionBold,
        italic: hero.descriptionItalic,
        underline: hero.descriptionUnderline,
        linkable: false,
        href: ''
      };
    }

    const block = hero.textBlocks.find((candidate) => candidate.id === layer.replace('textBlock:', ''));
    const resolvedBlock = block ? resolveHeroTextBlockForDevice(block, previewDevice) : null;

    return {
      fontFamily: resolvedBlock?.fontFamily ?? 'Inter',
      fontSizePx: resolvedBlock?.fontSizePx ?? 24,
      bold: resolvedBlock?.bold ?? false,
      italic: resolvedBlock?.italic ?? false,
      underline: resolvedBlock?.underline ?? false,
      linkable: Boolean(block),
      href: block?.href ?? ''
    };
  };
  const setLayerLink = (layer: HeroEditableLayer) => {
    if (!layer.startsWith('textBlock:')) return;
    const blockId = layer.replace('textBlock:', '');
    const block = hero.textBlocks.find((candidate) => candidate.id === blockId);
    if (!block) return;

    const href = window.prompt('Povezava za besedilo', block.href);
    if (href === null) return;
    onTextBlockChange?.(blockId, { href: href.trim() });
  };
  const addTextBlock = () => {
    const blockId = onTextBlockAdd?.();
    if (!blockId) return;
    const layer = `textBlock:${blockId}` as const;
    onSelect?.();
    setInlineEditMode(true);
    setToolbarCollapsed(false);
    setSelectedLayer(layer);
    setEditingLayer(layer);
  };
  const renderSelectionFrame = (layer: HeroEditableLayer) => {
    if (!inlineEditorEnabled || selectedLayer !== layer) return null;
    const handleClassName = 'absolute h-3 w-3 rounded-full border-2 border-white bg-[color:var(--blue-500)] shadow-[0_1px_4px_rgba(15,23,42,0.22)]';

    return (
      <span className="pointer-events-none absolute inset-[-6px] z-20 rounded-sm border-2 border-[color:var(--blue-500)]">
        <span className={classNames(handleClassName, '-left-2 -top-2')} />
        <span className={classNames(handleClassName, '-right-2 -top-2')} />
        <span className={classNames(handleClassName, '-bottom-2 -left-2')} />
        <span className={classNames(handleClassName, '-bottom-2 -right-2')} />
      </span>
    );
  };
  const renderInlineTypographyToolbar = (layer: HeroEditableLayer) => {
    if (!inlineEditorEnabled || selectedLayer !== layer) return null;
    const typography = getLayerTypography(layer);
    const iconButtonClassName = (active = false) =>
      classNames(
        'grid h-8 w-8 place-items-center rounded-md border text-white transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--blue-500)]',
        active ? 'border-[color:var(--blue-500)] bg-[color:var(--blue-500)]/60' : 'border-white/10 bg-white/10 hover:bg-white/20'
      );

    return (
      <div
        data-hero-typography-toolbar
        className="absolute left-1/2 top-[calc(100%+14px)] z-40 flex max-w-[min(440px,90vw)] -translate-x-1/2 items-center gap-1 rounded-xl border border-white/10 bg-black/45 p-2 text-white shadow-[0_18px_45px_rgba(0,0,0,0.22)] backdrop-blur-md"
        onClick={(event) => event.stopPropagation()}
        onPointerDown={(event) => event.stopPropagation()}
      >
        <select
          aria-label="Pisava"
          value={typography.fontFamily}
          onChange={(event) => updateLayerTypography(layer, { fontFamily: event.target.value as HomepageHeroFontFamily })}
          className="h-8 min-w-20 rounded-md border border-white/10 bg-white/10 px-2 text-[12px] font-medium text-white outline-none focus:border-[color:var(--blue-500)]"
        >
          {HOMEPAGE_HERO_FONT_FAMILIES.map((font) => (
            <option key={font} value={font} className="text-slate-900">
              {font}
            </option>
          ))}
        </select>
        <input
          aria-label="Velikost pisave"
          type="number"
          value={typography.fontSizePx}
          min={11}
          max={120}
          step={1}
          onChange={(event) => updateLayerTypography(layer, { fontSizePx: clampNumber(Number(event.target.value), 11, 120) })}
          className="h-8 w-14 rounded-md border border-white/10 bg-white/10 px-2 text-[12px] font-semibold text-white outline-none focus:border-[color:var(--blue-500)]"
        />
        <button type="button" aria-label="Krepko" className={iconButtonClassName(typography.bold)} onClick={() => updateLayerTypography(layer, { bold: !typography.bold })}>
          <Bold className="h-4 w-4" />
        </button>
        <button type="button" aria-label="Lezece" className={iconButtonClassName(typography.italic)} onClick={() => updateLayerTypography(layer, { italic: !typography.italic })}>
          <Italic className="h-4 w-4" />
        </button>
        <button type="button" aria-label="Podcrtano" className={iconButtonClassName(typography.underline)} onClick={() => updateLayerTypography(layer, { underline: !typography.underline })}>
          <Underline className="h-4 w-4" />
        </button>
        <button
          type="button"
          aria-label="Povezava"
          title={typography.linkable ? 'Povezava' : 'Povezava je na voljo za dodatna besedila'}
          disabled={!typography.linkable}
          className={classNames(iconButtonClassName(Boolean(typography.href)), !typography.linkable && 'cursor-not-allowed opacity-45')}
          onClick={() => setLayerLink(layer)}
        >
          <LinkIcon className="h-4 w-4" />
        </button>
      </div>
    );
  };
  const editableLayerProps = (layer: HeroEditableLayer) => ({
    'data-hero-inline-layer': layer,
    onClick: (event: ReactMouseEvent) => {
      event.stopPropagation();
      selectLayer(layer);
    },
    onDoubleClick: (event: ReactMouseEvent) => {
      event.stopPropagation();
      editLayer(layer);
    }
  });

  return (
    <div
      data-homepage-hero-root
      className={classNames(
        'relative isolate overflow-hidden bg-[#0d1117]',
        inlineEditorEnabled && heroToolbarVisible && 'outline outline-2 outline-offset-[-2px] outline-[color:var(--blue-500)]/75'
      )}
      style={{ minHeight: `${hero.heightPx}px` }}
      onMouseEnter={() => {
        setHovered(true);
        setToolbarCollapsed(false);
      }}
      onMouseLeave={() => setHovered(false)}
      onFocusCapture={() => {
        setHovered(true);
        setToolbarCollapsed(false);
      }}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setHovered(false);
      }}
      onClick={(event) => {
        const target = event.target instanceof Element ? event.target : null;
        if (target?.closest('[data-hero-inline-layer], [data-hero-inline-toolbar], [data-hero-typography-toolbar]')) return;
        setSelectedLayer(null);
        setEditingLayer(null);
        onSelect?.();
      }}
    >
      {activeSlide?.type === 'video' ? (
        <video
          key={activeSlide.id}
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
          className="absolute top-0 h-full object-cover"
          role="img"
          aria-label={activeSlide.alt || activeSlide.title || undefined}
          style={{ ...mediaFrameStyle, backgroundImage: `url("${activeSlide.src}")`, backgroundSize: 'cover', backgroundPosition: 'center' }}
        />
      ) : (
        <div className="absolute inset-0 bg-[#10151d]" />
      )}

      <div className="absolute inset-0" style={overlayStyle} />

      {heroToolbarVisible ? (
        <div
          data-hero-inline-toolbar
          className="absolute left-28 top-5 z-40 flex max-w-[calc(100%-56px)] items-center gap-1 rounded-xl border border-white/12 bg-black/55 px-3 py-2 text-white shadow-[0_20px_60px_rgba(0,0,0,0.24)] backdrop-blur-md transition"
          onClick={(event) => event.stopPropagation()}
          onPointerDown={(event) => event.stopPropagation()}
        >
          <button type="button" aria-label="Premakni sekcijo" className="grid h-8 w-8 place-items-center rounded-md text-white/80 transition hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--blue-500)]">
            <GripVertical className="h-4 w-4" />
          </button>
          <span className="grid h-8 w-8 place-items-center rounded-md text-white/85">
            <Home className="h-4 w-4" />
          </span>
          <span className="px-1 pr-3 text-[14px] font-semibold">Hero</span>
          <button
            type="button"
            className={classNames(
              'inline-flex h-9 items-center gap-2 rounded-md border px-3 text-[13px] font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--blue-500)]',
              inlineEditMode ? 'border-[color:var(--blue-500)] bg-[color:var(--blue-500)]/18 text-white' : 'border-white/10 bg-white/10 text-white hover:bg-white/15'
            )}
            onClick={startInlineTextEditing}
          >
            <Pencil className="h-4 w-4 text-[color:var(--blue-400)]" />
            Uredi besedilo
          </button>
          <button type="button" className="inline-flex h-9 items-center gap-2 rounded-md bg-white/10 px-3 text-[13px] font-semibold text-white transition hover:bg-white/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--blue-500)]" onClick={addTextBlock}>
            <Plus className="h-4 w-4" />
            Besedilo
          </button>
          <button type="button" className="inline-flex h-9 items-center gap-2 rounded-md bg-white/10 px-3 text-[13px] font-semibold text-white transition hover:bg-white/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--blue-500)]" onClick={onMediaFocus}>
            <ImageIcon className="h-4 w-4" />
            Slika
          </button>
          <button type="button" className="inline-flex h-9 items-center gap-2 rounded-md bg-white/10 px-3 text-[13px] font-semibold text-white transition hover:bg-white/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--blue-500)]" onClick={onSettingsFocus}>
            <Settings className="h-4 w-4" />
            Nastavitve
          </button>
          <button type="button" aria-label="Skrij orodja" className="ml-1 grid h-8 w-8 place-items-center rounded-md text-white/80 transition hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--blue-500)]" onClick={() => setToolbarCollapsed(true)}>
            <ChevronUp className="h-4 w-4" />
          </button>
        </div>
      ) : null}

      <div className={classNames('relative z-10 flex min-h-[inherit]', containerClassNames[page.containerWidth])}>
        <div className="flex min-h-[inherit] w-full flex-col justify-center py-16 text-left text-white">
          <div
            className={classNames('flex flex-col text-left', preview && onTextPositionChange && 'cursor-move rounded-md outline outline-1 outline-transparent transition hover:outline-white/35')}
            style={textBlockStyle}
            onPointerDown={startTextDrag('block')}
            onPointerMove={moveTextDrag}
            onPointerUp={endTextDrag}
            onPointerCancel={endTextDrag}
          >
            <div
              data-hero-element="title"
              {...editableLayerProps('title')}
              className={classNames(elementDragClassName, 'w-fit max-w-full', inlineEditMode && 'outline-offset-2 hover:outline-[color:var(--blue-400)]/70')}
              style={getElementOffsetStyle('title')}
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
                className="text-balance leading-[1.08] tracking-[0]"
                style={getHeroTitleTextStyle(hero)}
                onInput={(event) => commitLayerText('title', event.currentTarget.textContent ?? '')}
                onBlur={(event) => {
                  commitLayerText('title', event.currentTarget.textContent ?? '');
                  setEditingLayer((current) => (current === 'title' ? null : current));
                }}
              >
                <span style={getHighlightedTextStyle(hero.titleHighlight, hero.titleHighlightColor)}>{hero.title}</span>
              </h1>
              {renderInlineTypographyToolbar('title')}
            </div>
            {hero.description ? (
              <div
                data-hero-element="description"
                {...editableLayerProps('description')}
                className={classNames(elementDragClassName, 'mt-5 w-fit max-w-full', inlineEditMode && 'outline-offset-2 hover:outline-[color:var(--blue-400)]/70')}
                style={getElementOffsetStyle('description')}
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
                  className="max-w-[620px] text-pretty text-white/88"
                  style={getHeroDescriptionTextStyle(hero)}
                  onInput={(event) => commitLayerText('description', event.currentTarget.textContent ?? '')}
                  onBlur={(event) => {
                    commitLayerText('description', event.currentTarget.textContent ?? '');
                    setEditingLayer((current) => (current === 'description' ? null : current));
                  }}
                >
                  <span style={getHighlightedTextStyle(hero.descriptionHighlight, hero.descriptionHighlightColor)}>{hero.description}</span>
                </p>
                {renderInlineTypographyToolbar('description')}
              </div>
            ) : null}
            <div className="mt-8 flex flex-wrap gap-3">
              {hero.primaryButton.label && hero.primaryButton.href ? (
                <div
                  data-hero-element="primary-button"
                  className={classNames(elementDragClassName, 'inline-flex')}
                  style={getElementOffsetStyle('primaryButton')}
                  onPointerDown={startTextDrag('primaryButton')}
                  onPointerMove={moveTextDrag}
                  onPointerUp={endTextDrag}
                  onPointerCancel={endTextDrag}
                >
                  {renderElementOffsetBadge('primaryButton')}
                  <Link
                    href={hero.primaryButton.href}
                    prefetch={false}
                    draggable={false}
                    className={classNames(buttonClassName(page.buttonStyle, 'primary'), preview && onTextPositionChange && 'pointer-events-none')}
                  >
                    <span>{hero.primaryButton.label}</span>
                    <ChevronRight className="h-4 w-4" strokeWidth={2} />
                  </Link>
                </div>
              ) : null}
              {hero.secondaryButton.label && hero.secondaryButton.href ? (
                <div
                  data-hero-element="secondary-button"
                  className={classNames(elementDragClassName, 'inline-flex')}
                  style={getElementOffsetStyle('secondaryButton')}
                  onPointerDown={startTextDrag('secondaryButton')}
                  onPointerMove={moveTextDrag}
                  onPointerUp={endTextDrag}
                  onPointerCancel={endTextDrag}
                >
                  {renderElementOffsetBadge('secondaryButton')}
                  <Link
                    href={hero.secondaryButton.href}
                    prefetch={false}
                    draggable={false}
                    className={classNames(buttonClassName(page.buttonStyle, 'secondary'), preview && onTextPositionChange && 'pointer-events-none')}
                  >
                    <span>{hero.secondaryButton.label}</span>
                  </Link>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      {hero.textBlocks.map((block) => {
        if (!block.visible) return null;
        const resolvedBlock = resolveHeroTextBlockForDevice(block, previewDevice);
        const layer = `textBlock:${block.id}` as const;
        const blockStyle: CSSProperties = {
          ...getHeroTextBlockStyle(block, previewDevice),
          left: `${resolvedBlock.xPx}px`,
          top: `${resolvedBlock.yPx}px`,
          width: `${resolvedBlock.widthPx}px`
        };
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
            {...editableLayerProps(layer)}
            className={classNames(
              'absolute z-20 cursor-move rounded-sm text-white outline outline-1 outline-transparent transition hover:outline-white/45',
              inlineEditMode && 'hover:outline-[color:var(--blue-400)]/70'
            )}
            style={blockStyle}
            onPointerDown={startTextBlockDrag(block)}
            onPointerMove={moveTextBlockDrag(block)}
            onPointerUp={endTextBlockDrag}
            onPointerCancel={endTextBlockDrag}
          >
            {renderSelectionFrame(layer)}
            {block.href ? (
              <Link href={block.href} prefetch={false} draggable={false} className={classNames(preview && 'pointer-events-none')}>
                {content}
              </Link>
            ) : content}
            {renderInlineTypographyToolbar(layer)}
          </div>
        );
      })}

      {preview && showTechnicalGuides && !inlineEditMode && previewViewportWidth ? (
        <HeroTechnicalGuides hero={hero} page={page} viewportWidth={previewViewportWidth} />
      ) : null}

      {hero.showArrows && hasMultipleSlides ? (
        <>
          <button
            type="button"
            aria-label="Prejšnji diapozitiv"
            onClick={goToPrevious}
            className="absolute left-5 top-1/2 z-20 inline-grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full border border-white/25 bg-black/20 text-white backdrop-blur-sm transition hover:bg-black/35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/45"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button
            type="button"
            aria-label="Naslednji diapozitiv"
            onClick={goToNext}
            className="absolute right-5 top-1/2 z-20 inline-grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full border border-white/25 bg-black/20 text-white backdrop-blur-sm transition hover:bg-black/35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/45"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </>
      ) : null}

      {hero.showDots && hasMultipleSlides ? (
        <div className="absolute bottom-5 left-1/2 z-20 flex -translate-x-1/2 gap-2">
          {slides.map((slide, index) => (
            <button
              key={slide.id}
              type="button"
              aria-label={`Prikaži diapozitiv ${index + 1}`}
              onClick={() => setActiveIndex(index)}
              className={classNames(
                'h-2.5 rounded-full border border-white/60 transition',
                index === activeIndex ? 'w-7 bg-white' : 'w-2.5 bg-white/35 hover:bg-white/70'
              )}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function HomepageCategories({
  settings,
  categories,
  page
}: {
  settings: HomepageCategoriesSettings;
  categories: HomepageCategoryCardData[];
  page: HomepagePageSettings;
}) {
  const visibleCategories = useMemo(() => getCategoryList(categories, settings), [categories, settings]);
  const gridStyle = {
    '--home-category-columns': String(settings.columns),
    gap: `${settings.gap}px`
  } as CSSProperties & Record<string, string>;
  const cardRadius = sectionRadiusClassNames[page.sectionRadius];
  const titleOnly = settings.cardStyle === 'title-only';
  const compact = settings.cardStyle === 'compact';

  if (visibleCategories.length === 0) return null;

  return (
    <div className={classNames(containerClassNames[settings.containerWidth], 'py-2')}>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          {settings.title ? <h2 className="text-[28px] font-semibold leading-tight text-[#05070a]">{settings.title}</h2> : null}
          {settings.subtitle ? <p className="mt-2 max-w-2xl text-[15px] leading-6 text-[#536070]">{settings.subtitle}</p> : null}
        </div>
        {settings.showAllLink && settings.showAllHref ? (
          <Link
            href={settings.showAllHref}
            prefetch={false}
            className="inline-flex items-center gap-2 text-[14px] font-semibold text-[color:var(--blue-500)] transition hover:text-[color:var(--blue-600)]"
          >
            Prikaži vse kategorije
            <ChevronRight className="h-4 w-4" />
          </Link>
        ) : null}
      </div>

      <div
        className="grid [grid-template-columns:repeat(var(--home-category-columns),minmax(0,1fr))] max-[900px]:[grid-template-columns:repeat(2,minmax(0,1fr))] max-[560px]:[grid-template-columns:1fr]"
        style={gridStyle}
      >
        {visibleCategories.map((category) => (
          <Link
            key={category.slug}
            href={catalogCategoryHref(category.slug)}
            prefetch={false}
            className={classNames(
              'group relative overflow-hidden border border-[#dde4ed] bg-white transition hover:-translate-y-0.5 hover:border-[#b7c8e6] hover:shadow-[0_14px_34px_rgba(15,23,42,0.06)]',
              cardRadius,
              compact ? 'min-h-[112px] p-4' : categoryCardHeightClassNames[settings.cardSize],
              titleOnly && 'grid place-items-center text-center'
            )}
          >
            {titleOnly ? (
              <h3 className="text-[20px] font-semibold leading-snug text-[#05070a]">{category.title}</h3>
            ) : (
              <>
                <h3 className={classNames('relative z-[2] font-semibold leading-snug text-[#05070a]', compact ? 'max-w-[68%] text-[16px]' : 'max-w-[58%] text-[20px]')}>
                  {category.title}
                </h3>
                {category.image ? (
                  <div className="absolute inset-0 z-[1] transition duration-300 group-hover:scale-[1.02]">
                    <Image
                      src={category.image}
                      alt={category.title}
                      fill
                      loading="lazy"
                      sizes="(min-width: 1280px) 22vw, (min-width: 768px) 45vw, 90vw"
                      className="object-cover object-center grayscale saturate-0 transition-[filter,transform] duration-500 group-hover:grayscale-0 group-hover:saturate-100 group-focus-visible:grayscale-0 group-focus-visible:saturate-100 motion-reduce:transition-none"
                    />
                  </div>
                ) : null}
                {settings.showCardArrow ? (
                  <span className={classNames('absolute z-[2] text-[color:var(--blue-500)] transition group-hover:translate-x-1', compact ? 'bottom-4 left-4' : 'bottom-6 left-6')}>
                    <ChevronRight className="h-5 w-5" />
                  </span>
                ) : null}
              </>
            )}
          </Link>
        ))}
      </div>
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

function FooterLogo({ settings }: { settings: HomepageFooterSettings }) {
  if (settings.logoMode === 'hidden') return null;
  if (settings.logoText.trim() && settings.logoText.trim().toUpperCase() !== 'ATEHNA') {
    return (
      <span className="inline-flex items-center gap-3 text-[color:var(--blue-500)]">
        <span className="grid h-9 w-9 place-items-center rounded-lg bg-[color:var(--blue-500)] text-base font-bold text-white">
          {settings.logoText.trim().slice(0, 1).toUpperCase()}
        </span>
        {settings.logoMode === 'full' ? (
          <span className="text-xl font-bold tracking-[0.02em] text-[#05070a]">{settings.logoText}</span>
        ) : null}
      </span>
    );
  }

  return <AtehnaLogo markOnly={settings.logoMode === 'mark'} className={settings.logoMode === 'mark' ? '[&>svg]:h-10 [&>svg]:w-10' : ''} />;
}

function SocialIcon({ type }: { type: HomepageSocialType }) {
  const Icon = socialIconMap[type] ?? Globe2;
  return <Icon className="h-4 w-4" strokeWidth={1.8} />;
}

function HomepageFooter({ settings, page }: { settings: HomepageFooterSettings; page: HomepagePageSettings }) {
  const year = new Date().getFullYear();
  const copyright = settings.copyright.replace('{year}', String(year));

  return (
    <footer className={classNames('bg-white text-[#121822]', settings.topBorder && 'border-t border-[#dde4ed]')}>
      <div className={classNames(containerClassNames[page.containerWidth], footerSpacingClassNames[settings.spacing])}>
        <div className="grid gap-8 lg:grid-cols-[minmax(180px,1fr)_minmax(0,2.2fr)_minmax(220px,0.9fr)]">
          <div className="min-w-0">
            <Link href="/" prefetch={false} aria-label="Atehna domov" className="inline-flex">
              <FooterLogo settings={settings} />
            </Link>
            {settings.description ? <p className="mt-4 max-w-xs text-[13px] leading-6 text-[#536070]">{settings.description}</p> : null}
          </div>

          <nav
            aria-label="Povezave v nogi"
            className="grid gap-6 sm:grid-cols-2 lg:grid-cols-[repeat(var(--home-footer-columns),minmax(0,1fr))]"
            style={{ '--home-footer-columns': String(Math.max(1, settings.layoutColumns)) } as CSSProperties & Record<string, string>}
          >
            {settings.columns.map((column) => (
              <div key={column.id} className="min-w-0">
                <h3 className="text-[13px] font-semibold text-[#05070a]">{column.title}</h3>
                <ul className="mt-3 grid gap-2">
                  {column.links.map((link) => (
                    <li key={link.id}>
                      <Link href={link.href || '#'} prefetch={false} className="text-[13px] leading-5 text-[#536070] transition hover:text-[color:var(--blue-500)]">
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </nav>

          <div className="min-w-0">
            <h3 className="text-[13px] font-semibold text-[#05070a]">Kontakt</h3>
            <ul className="mt-3 grid gap-2 text-[13px] leading-5 text-[#536070]">
              {settings.contact.email ? (
                <li className="flex items-center gap-2">
                  <Mail className="h-4 w-4 shrink-0" />
                  <a href={`mailto:${settings.contact.email}`} className="transition hover:text-[color:var(--blue-500)]">{settings.contact.email}</a>
                </li>
              ) : null}
              {settings.contact.phone ? (
                <li className="flex items-center gap-2">
                  <Phone className="h-4 w-4 shrink-0" />
                  <a href={`tel:${settings.contact.phone.replace(/\s+/g, '')}`} className="transition hover:text-[color:var(--blue-500)]">{settings.contact.phone}</a>
                </li>
              ) : null}
              {settings.contact.address ? (
                <li className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 shrink-0" />
                  <span>{settings.contact.address}</span>
                </li>
              ) : null}
              {settings.contact.workingHours ? (
                <li className="flex items-center gap-2">
                  <Clock className="h-4 w-4 shrink-0" />
                  <span>{settings.contact.workingHours}</span>
                </li>
              ) : null}
            </ul>

            {settings.socialLinks.length > 0 ? (
              <div className="mt-5">
                <h3 className="text-[13px] font-semibold text-[#05070a]">Spremljajte nas</h3>
                <div className="mt-3 flex flex-wrap gap-2">
                  {settings.socialLinks.map((link) => (
                    <Link
                      key={link.id}
                      href={link.href || '#'}
                      prefetch={false}
                      aria-label={link.label}
                      className="grid h-8 w-8 place-items-center rounded-lg border border-[#dde4ed] text-[#121822] transition hover:border-[color:var(--blue-500)] hover:text-[color:var(--blue-500)]"
                    >
                      <SocialIcon type={link.type} />
                    </Link>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        </div>

        <div className="mt-7 flex flex-wrap items-center justify-between gap-3 border-t border-[#eef2f7] pt-4 text-[12px] text-[#7b8491]">
          <p>{copyright}</p>
          {settings.legalLinks.length > 0 ? (
            <nav aria-label="Pravne povezave" className="flex flex-wrap gap-x-5 gap-y-2">
              {settings.legalLinks.map((link) => (
                <Link key={link.id} href={link.href || '#'} prefetch={false} className="transition hover:text-[color:var(--blue-500)]">
                  {link.label}
                </Link>
              ))}
            </nav>
          ) : null}
        </div>
      </div>
    </footer>
  );
}

export default function HomepageRenderer({
  settings,
  categories,
  selectedSectionId,
  onSelectSection,
  onHeroTextPositionChange,
  onHeroTextContentChange,
  onHeroTypographyChange,
  onHeroTextBlockAdd,
  onHeroTextBlockChange,
  onHeroMediaFocus,
  onHeroSettingsFocus,
  preview = false,
  previewDevice,
  previewViewportWidth
}: HomepageRendererProps) {
  const normalizedSettings = useMemo(() => normalizeLandingPageConfig(settings), [settings]);
  const renderDevice = useHomepageRenderDevice(previewDevice);
  const resolvedSettings = useMemo(
    () => resolveHomepageSettingsForDevice(normalizedSettings, renderDevice),
    [normalizedSettings, renderDevice]
  );
  const rootStyle = {
    backgroundColor: resolvedSettings.page.backgroundColor || '#ffffff'
  };

  return (
    <div className={classNames('flex min-h-full flex-col', sectionGapClassNames[resolvedSettings.page.sectionSpacing])} style={rootStyle}>
      {resolvedSettings.sectionOrder.map((sectionId) => {
        if (sectionId === 'hero' && resolvedSettings.hero.visible) {
          return (
            <SectionFrame
              key={sectionId}
              sectionId={sectionId}
              selectedSectionId={selectedSectionId}
              onSelectSection={onSelectSection}
              preview={preview}
            >
              <HomepageHero
                hero={resolvedSettings.hero}
                page={resolvedSettings.page}
                preview={preview}
                showTechnicalGuides={preview && selectedSectionId === 'hero'}
                previewViewportWidth={previewViewportWidth}
                previewDevice={renderDevice}
                selected={selectedSectionId === 'hero'}
                onSelect={() => onSelectSection?.('hero')}
                onTextPositionChange={onHeroTextPositionChange}
                onTextContentChange={onHeroTextContentChange}
                onTypographyChange={onHeroTypographyChange}
                onTextBlockAdd={onHeroTextBlockAdd}
                onTextBlockChange={onHeroTextBlockChange}
                onMediaFocus={onHeroMediaFocus}
                onSettingsFocus={onHeroSettingsFocus}
              />
            </SectionFrame>
          );
        }

        if (sectionId === 'categories' && resolvedSettings.categories.visible) {
          return (
            <SectionFrame
              key={sectionId}
              sectionId={sectionId}
              selectedSectionId={selectedSectionId}
              onSelectSection={onSelectSection}
              preview={preview}
            >
              <HomepageCategories settings={resolvedSettings.categories} categories={categories} page={resolvedSettings.page} />
            </SectionFrame>
          );
        }

        if (sectionId === 'infoBlocks' && resolvedSettings.infoBlocks.visible) {
          return (
            <SectionFrame
              key={sectionId}
              sectionId={sectionId}
              selectedSectionId={selectedSectionId}
              onSelectSection={onSelectSection}
              preview={preview}
            >
              <HomepageInfoBlocks settings={resolvedSettings.infoBlocks} page={resolvedSettings.page} />
            </SectionFrame>
          );
        }

        if (sectionId === 'footer' && resolvedSettings.footer.visible) {
          return (
            <SectionFrame
              key={sectionId}
              sectionId={sectionId}
              selectedSectionId={selectedSectionId}
              onSelectSection={onSelectSection}
              preview={preview}
            >
              <HomepageFooter settings={resolvedSettings.footer} page={resolvedSettings.page} />
            </SectionFrame>
          );
        }

        return null;
      })}
    </div>
  );
}
