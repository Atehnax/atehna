'use client';

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ChangeEvent, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
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
  Bold,
  ChevronDown,
  Eye,
  EyeOff,
  GripVertical,
  Italic,
  MoreVertical,
  Pencil,
  Plus,
  Save,
  Trash2,
  Underline,
  Upload
} from 'lucide-react';
import HomepageRenderer from '@/commercial/components/landing/HomepageRenderer';
import { COMMERCIAL_STOREFRONT_SCALE } from '@/commercial/components/commercialStorefrontScale';
import SiteHeader from '@/commercial/components/SiteHeader';
import {
  DEFAULT_HOMEPAGE_CATEGORY_CARDS,
  HOMEPAGE_BUTTON_STYLES,
  HOMEPAGE_CATEGORY_CARD_SIZES,
  HOMEPAGE_CATEGORY_CARD_STYLES,
  HOMEPAGE_CONTAINER_WIDTHS,
  HOMEPAGE_FOOTER_LOGO_MODES,
  HOMEPAGE_FOOTER_SPACINGS,
  HOMEPAGE_HERO_FONT_FAMILIES,
  HOMEPAGE_INFO_ICONS,
  HOMEPAGE_INFO_ICON_POSITIONS,
  HOMEPAGE_INFO_STYLES,
  HOMEPAGE_PREVIEW_DEVICES,
  HOMEPAGE_SECTION_IDS,
  HOMEPAGE_SECTION_RADII,
  HOMEPAGE_SECTION_SPACINGS,
  HOMEPAGE_SOCIAL_TYPES,
  cloneDefaultLandingPageConfig,
  homepageButtonStyleLabels,
  homepageCategoryCardSizeLabels,
  homepageCategoryCardStyleLabels,
  homepageContainerWidthLabels,
  homepageFooterLogoModeLabels,
  homepageFooterSpacingLabels,
  homepageInfoIconLabels,
  homepageInfoIconPositionLabels,
  homepageInfoStyleLabels,
  homepagePreviewDeviceLabels,
  homepageSectionLabels,
  homepageSectionRadiusLabels,
  homepageSectionSpacingLabels,
  homepageSocialTypeLabels,
  normalizeLandingPageConfig,
  resolveHomepageSectionLabel,
  type HomepageCategoryCardData,
  type HomepageCategoriesDeviceSettings,
  type HomepageFooterColumn,
  type HomepageFooterDeviceSettings,
  type HomepageFooterLink,
  type HomepageFooterSocialLink,
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
import { normalizeSiteNavigationConfig, type SiteNavigationConfig } from '@/shared/domain/navigation/siteNavigation';
import { AdminPageHeader } from '@/shared/ui/admin-primitives';
import { Button } from '@/shared/ui/button';
import { Input } from '@/shared/ui/input';
import { AdminCheckbox } from '@/shared/ui/checkbox';
import EuiTabs from '@/shared/ui/eui-tabs';
import {
  adminTableNeutralIconButtonClassName,
  adminTablePrimaryButtonClassName,
  adminTableSelectedDangerIconButtonClassName
} from '@/shared/ui/admin-table/standards';
import {
  adminControlFocusTokenClasses,
  adminFilterInputTokenClasses,
  adminMiniIconButtonTokenClasses
} from '@/shared/ui/theme/tokens';
import { useToast } from '@/shared/ui/toast';
import AdminPodobaTabs from './AdminPodobaTabs';

const classNames = (...parts: Array<string | false | null | undefined>) => parts.filter(Boolean).join(' ');

const panelClassName = 'rounded-xl border border-slate-200 bg-white';
const panelInnerClassName = 'min-w-0 p-4';
const labelClassName = 'text-[11px] font-semibold uppercase tracking-[0.06em] text-slate-500';
const inputClassName = adminFilterInputTokenClasses;
const textareaClassName = `${inputClassName} min-h-[74px] resize-y py-2 leading-5`;
const topActionSaveButtonClassName =
  `gap-2 ${adminTablePrimaryButtonClassName} !h-9 !leading-none disabled:!border-transparent disabled:!bg-[color:var(--blue-500)] disabled:!text-white disabled:!opacity-50`;
const previewButtonClassName =
  'inline-flex h-9 items-center justify-center gap-2 rounded-md border border-slate-200 bg-white px-4 text-[13px] font-semibold text-slate-700 transition hover:bg-slate-50 hover:text-[color:var(--blue-500)]';

const previewViewportWidths: Record<HomepagePreviewDevice, number> = {
  desktop: 1440,
  tablet: 1024,
  mobile: 390
};

const previewHeightFallbacks: Record<HomepagePreviewDevice, number> = {
  desktop: 1120,
  tablet: 1080,
  mobile: 1240
};

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
type HeroTextBlockUpdates = Partial<HomepageHeroTextBlock>;

type PanelTab = 'sections' | 'page';
type Option<Value extends string> = { value: Value; label: string };

function comparable(config: HomepageSettings) {
  return JSON.stringify(normalizeLandingPageConfig(config));
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
  const [element, setElement] = useState<T | null>(null);
  const [width, setWidth] = useState(0);

  const measureRef = useCallback((node: T | null) => {
    setElement(node);
    if (node) setWidth(Math.round(node.getBoundingClientRect().width));
  }, []);

  useLayoutEffect(() => {
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
  }, [element]);

  return [measureRef, width] as const;
}

function useMeasuredElementHeight<T extends HTMLElement>() {
  const [element, setElement] = useState<T | null>(null);
  const [height, setHeight] = useState(0);

  const measureRef = useCallback((node: T | null) => {
    setElement(node);
    if (node) setHeight(Math.ceil(node.scrollHeight || node.getBoundingClientRect().height));
  }, []);

  useLayoutEffect(() => {
    if (!element) return undefined;

    const updateHeight = () => {
      setHeight(Math.ceil(element.scrollHeight || element.getBoundingClientRect().height));
    };

    updateHeight();
    const animationFrame = window.requestAnimationFrame(updateHeight);
    window.addEventListener('resize', updateHeight);

    const resizeObserver = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(updateHeight) : null;
    resizeObserver?.observe(element);

    return () => {
      window.cancelAnimationFrame(animationFrame);
      window.removeEventListener('resize', updateHeight);
      resizeObserver?.disconnect();
    };
  }, [element]);

  return [measureRef, height] as const;
}

function getHomepagePreviewScale(availableWidth: number, viewportWidth: number) {
  if (availableWidth <= 0 || viewportWidth <= 0) return 1;
  return Math.min(1, availableWidth / viewportWidth);
}

function formatZoomLabel(scale: number) {
  const scaleNumberLabel = scale === 1 ? '1' : scale.toFixed(2).replace('.', ',');
  return `${scaleNumberLabel}x zoom`;
}

function withPositions<T>(items: T[]) {
  return [...items];
}

function mergeCategoryOrder(order: string[], categories: HomepageCategoryCardData[]) {
  const source = categories.length > 0 ? categories : DEFAULT_HOMEPAGE_CATEGORY_CARDS;
  const slugs = source.map((category) => category.slug);
  return [
    ...order.filter((slug) => slugs.includes(slug)),
    ...slugs.filter((slug) => !order.includes(slug))
  ];
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
    <label className="grid min-w-0 gap-1.5">
      <span className={labelClassName}>{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value as Value)}
        className={inputClassName}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
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
    <label className="grid min-w-0 gap-1.5">
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
    <label className="grid min-w-0 gap-1.5">
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
  suffix
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  suffix?: string;
}) {
  return (
    <label className="grid min-w-0 gap-1.5">
      <span className={labelClassName}>{label}</span>
      <span className="flex h-8 min-w-0 overflow-hidden rounded-md border border-slate-300 bg-white">
        <input
          type="number"
          value={value}
          min={min}
          max={max}
          step={step}
          onChange={(event) => onChange(Number(event.target.value))}
          className={`h-full min-w-0 flex-1 border-0 bg-transparent px-2.5 text-[12px] text-slate-700 outline-none ${adminControlFocusTokenClasses}`}
        />
        {suffix ? (
          <span className="grid min-w-10 place-items-center border-l border-slate-200 bg-slate-50 px-2 text-[11px] font-medium text-slate-500">
            {suffix}
          </span>
        ) : null}
      </span>
    </label>
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
    <label className="flex min-w-0 items-start gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2">
      <AdminCheckbox checked={checked} onChange={(event) => onChange(event.target.checked)} className="mt-0.5" />
      <span className="grid min-w-0 gap-0.5">
        <span className="text-[12px] font-semibold text-slate-800">{label}</span>
        {description ? <span className="text-[11px] leading-4 text-slate-500">{description}</span> : null}
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
    <section className="min-w-0 overflow-hidden rounded-lg border border-slate-200 bg-white">
      <button
        type="button"
        className={`flex w-full min-w-0 items-center justify-between gap-3 px-3 py-2.5 text-left transition hover:bg-slate-50 ${adminControlFocusTokenClasses}`}
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        <span className="min-w-0 truncate text-[12px] font-semibold text-slate-900">{title}</span>
        <ChevronDown className={classNames('h-4 w-4 shrink-0 text-slate-500 transition-transform', !open && '-rotate-90')} />
      </button>
      {open ? (
        <div className="min-w-0 space-y-3 border-t border-slate-100 bg-slate-50/40 p-3">
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
  disabled
}: {
  label: string;
  title?: string;
  children: ReactNode;
  onClick: () => void;
  tone?: 'neutral' | 'danger';
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={title ?? label}
      onClick={onClick}
      disabled={disabled}
      className={tone === 'danger' ? adminTableSelectedDangerIconButtonClassName : adminTableNeutralIconButtonClassName}
    >
      {children}
    </button>
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

function ScaledHomepagePreview({
  device,
  settings,
  categories,
  navigation,
  selectedSectionId,
  onSelectSection,
  onHeroTextPositionChange,
  onHeroTextContentChange,
  onHeroTypographyChange,
  onHeroTextBlockAdd,
  onHeroTextBlockChange,
  onHeroMediaFocus,
  onHeroSettingsFocus
}: {
  device: HomepagePreviewDevice;
  settings: HomepageSettings;
  categories: HomepageCategoryCardData[];
  navigation: SiteNavigationConfig;
  selectedSectionId: HomepageSectionId;
  onSelectSection: (sectionId: HomepageSectionId) => void;
  onHeroTextPositionChange: (updates: HeroPositionUpdates) => void;
  onHeroTextContentChange: (updates: HeroTextContentUpdates) => void;
  onHeroTypographyChange: (updates: HeroTypographyUpdates) => void;
  onHeroTextBlockAdd: () => string | undefined;
  onHeroTextBlockChange: (blockId: string, updates: HeroTextBlockUpdates) => void;
  onHeroMediaFocus: () => void;
  onHeroSettingsFocus: () => void;
}) {
  const [measureRef, availableWidth] = useMeasuredElementWidth<HTMLDivElement>();
  const [contentRef, contentHeight] = useMeasuredElementHeight<HTMLDivElement>();
  const viewportWidth = previewViewportWidths[device];
  const scale = getHomepagePreviewScale(availableWidth, viewportWidth);
  const logicalHeight = contentHeight > 0 ? contentHeight : previewHeightFallbacks[device];
  const scaledWidth = Math.ceil(viewportWidth * scale);
  const scaledHeight = Math.ceil(logicalHeight * scale);
  const zoomLabel = availableWidth > 0 ? formatZoomLabel(scale) : 'prilagajanje širini';

  return (
    <div className="min-w-0">
      <div className="mb-2 flex flex-wrap items-center gap-1.5 text-[11px] font-medium text-slate-500">
        <span>
          {homepagePreviewDeviceLabels[device]} · viewport: {viewportWidth} px · {zoomLabel}
        </span>
      </div>
      <div ref={measureRef} className="relative flex min-w-0 justify-center overflow-hidden">
        <div
          className="relative overflow-hidden rounded-xl shadow-[0_22px_60px_rgba(15,23,42,0.12)] transition-[width,height] duration-200"
          style={{ width: scaledWidth, height: scaledHeight }}
        >
          <div className="pointer-events-none absolute inset-0 z-20 rounded-xl ring-1 ring-inset ring-slate-200" />
          <div
            ref={contentRef}
            className="absolute left-1/2 top-1/2 overflow-hidden rounded-xl bg-white transition-transform duration-200 ease-out"
            style={{
              width: viewportWidth,
              transform: `translate(-50%, -50%) scale(${scale})`,
              transformOrigin: 'center center'
            }}
          >
            <ScaledSiteHeaderPreview navigation={navigation} device={device} viewportWidth={viewportWidth} />
            <HomepageRenderer
              settings={settings}
              categories={categories}
              selectedSectionId={selectedSectionId}
              onSelectSection={onSelectSection}
              onHeroTextPositionChange={onHeroTextPositionChange}
              onHeroTextContentChange={onHeroTextContentChange}
              onHeroTypographyChange={onHeroTypographyChange}
              onHeroTextBlockAdd={onHeroTextBlockAdd}
              onHeroTextBlockChange={onHeroTextBlockChange}
              onHeroMediaFocus={onHeroMediaFocus}
              onHeroSettingsFocus={onHeroSettingsFocus}
              previewDevice={device}
              previewViewportWidth={viewportWidth}
              preview
            />
          </div>
        </div>
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
    <div className="relative bg-white" style={{ width: viewportWidth, height: headerHeight }}>
      <div
        className="absolute left-0 top-0 overflow-visible"
        style={{
          width: rendererViewportWidth,
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
        'grid grid-cols-[28px_22px_minmax(0,1fr)_34px] items-center gap-2 rounded-md border px-2 py-1.5 text-[12px] transition',
        selected ? 'border-[color:var(--blue-500)] bg-[color:var(--blue-50)] text-[color:var(--blue-600)]' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50',
        isDragging && 'relative z-20 opacity-70'
      )}
    >
      <button
        type="button"
        className={`${adminMiniIconButtonTokenClasses} cursor-grab active:cursor-grabbing`}
        aria-label="Premakni sekcijo"
        title="Premakni sekcijo"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-4 w-4" />
      </button>
      <span className="text-center text-[11px] font-semibold text-slate-400">{index + 1}</span>
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
            !visible && 'text-slate-400 line-through decoration-slate-300'
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
          className="grid h-7 w-7 place-items-center rounded-md text-slate-500 transition hover:bg-white hover:text-[color:var(--blue-500)]"
          aria-label="Možnosti sekcije"
          aria-expanded={menuOpen}
          title="Možnosti sekcije"
        >
          <MoreVertical className="h-4 w-4" />
        </button>
        {menuOpen ? (
          <div className="absolute right-0 top-8 z-40 w-44 overflow-hidden rounded-md border border-slate-200 bg-white py-1 text-slate-700 shadow-[0_14px_34px_rgba(15,23,42,0.12)]">
            <button
              type="button"
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-[12px] font-medium transition hover:bg-[color:var(--hover-neutral)] hover:text-[color:var(--blue-500)]"
              onClick={onToggleVisibility}
            >
              {visible ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
              <span>{visible ? 'Skrij sekcijo' : 'Prikaži sekcijo'}</span>
            </button>
            <button
              type="button"
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-[12px] font-medium transition hover:bg-[color:var(--hover-neutral)] hover:text-[color:var(--blue-500)]"
              onClick={onStartRename}
            >
              <Pencil className="h-3.5 w-3.5" />
              <span>Preimenuj</span>
            </button>
            <div className="my-1 h-px bg-slate-100" />
            <button
              type="button"
              disabled={!canDelete}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-[12px] font-medium text-rose-600 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:text-slate-300 disabled:hover:bg-transparent"
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
        'grid grid-cols-[26px_24px_minmax(0,1fr)] items-center gap-2 rounded-md border border-slate-200 bg-white px-2 py-1.5 text-[12px]',
        isDragging && 'relative z-20 opacity-70'
      )}
    >
      <button
        type="button"
        className={`${adminMiniIconButtonTokenClasses} cursor-grab active:cursor-grabbing`}
        aria-label="Premakni kategorijo"
        title="Premakni kategorijo"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-4 w-4" />
      </button>
      <span className="text-center text-[11px] font-semibold text-slate-400">{index + 1}</span>
      <span className="truncate font-medium text-slate-700">{category.title}</span>
    </div>
  );
}

function SlidePreview({ slide }: { slide: HomepageHeroSlide }) {
  if (slide.type === 'video') {
    return (
      <div className="grid h-12 w-20 place-items-center overflow-hidden rounded-md border border-slate-200 bg-slate-900 text-[10px] font-semibold text-white">
        VIDEO
      </div>
    );
  }

  if (!slide.src) {
    return <div className="grid h-12 w-20 place-items-center rounded-md border border-dashed border-slate-300 bg-slate-50 text-[10px] text-slate-400">Medij</div>;
  }

  return (
    <div
      className="h-12 w-20 rounded-md border border-slate-200 bg-cover bg-center"
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
  addingSlide,
  showAddUpload,
  onChange,
  onDelete,
  onAddUpload,
  onUpload
}: {
  slide: HomepageHeroSlide;
  index: number;
  uploading: boolean;
  addingSlide: boolean;
  showAddUpload: boolean;
  onChange: (updates: Partial<HomepageHeroSlide>) => void;
  onDelete: () => void;
  onAddUpload: (file: File) => void;
  onUpload: (file: File) => void;
}) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const addFileInputRef = useRef<HTMLInputElement | null>(null);
  const [mediaDetailsOpen, setMediaDetailsOpen] = useState(false);
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: slide.id });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={classNames('rounded-lg border border-slate-200 bg-white p-3', isDragging && 'relative z-20 opacity-70')}
    >
      <div className="mb-3 grid min-w-0 gap-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
        <div className="flex min-w-0 items-center gap-2">
          <button
            type="button"
            className={`${adminMiniIconButtonTokenClasses} cursor-grab active:cursor-grabbing`}
            aria-label="Premakni diapozitiv"
            title="Premakni diapozitiv"
            {...attributes}
            {...listeners}
          >
            <GripVertical className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => setMediaDetailsOpen((open) => !open)}
            className={classNames(
              'group relative rounded-md outline-none transition',
              'focus-visible:ring-2 focus-visible:ring-[color:var(--blue-500)] focus-visible:ring-offset-2'
            )}
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
            <p className="truncate text-[12px] font-semibold text-slate-800">Diapozitiv {index + 1}</p>
            <p className="truncate text-[11px] text-slate-500">{slide.title || slide.src || 'Brez medija'}</p>
          </div>
        </div>
        <div className="flex min-w-0 flex-wrap items-center gap-1 sm:justify-end">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,video/*"
            className="hidden"
            onChange={(event: ChangeEvent<HTMLInputElement>) => {
              const file = event.target.files?.[0];
              event.target.value = '';
              if (file) onUpload(file);
            }}
          />
          <SmallIconButton label="Zamenjaj medij" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
            <Upload className="h-4 w-4" />
          </SmallIconButton>
          <SmallIconButton label="Odstrani" tone="danger" onClick={onDelete}>
            <Trash2 className="h-4 w-4" />
          </SmallIconButton>
        </div>
      </div>

      <div className="grid gap-3">
        {showAddUpload ? (
          <div className="flex min-w-0">
            <input
              ref={addFileInputRef}
              type="file"
              accept="image/*,video/*"
              className="hidden"
              onChange={(event: ChangeEvent<HTMLInputElement>) => {
                const file = event.target.files?.[0];
                event.target.value = '';
                if (file) onAddUpload(file);
              }}
            />
            <Button
              type="button"
              variant="primary"
              size="toolbar"
              className={`${adminTablePrimaryButtonClassName} !h-8 !px-2.5`}
              onClick={() => addFileInputRef.current?.click()}
              disabled={addingSlide}
            >
              <Upload className="h-4 w-4" />
              Naloži
            </Button>
          </div>
        ) : null}
        {mediaDetailsOpen ? (
          <div className="grid gap-3 rounded-lg border border-slate-200 bg-slate-50/50 p-3">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[12px] font-semibold text-slate-800">Medij</span>
              <button
                type="button"
                onClick={() => setMediaDetailsOpen(false)}
                className="text-[11px] font-semibold text-slate-500 transition hover:text-[color:var(--blue-500)]"
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
    </div>
  );
}

function AdminLandingPageClient({
  initialConfig,
  initialCategories,
  navigation
}: {
  initialConfig: HomepageSettings;
  initialCategories: HomepageCategoryCardData[];
  navigation: SiteNavigationConfig;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const normalizedInitialConfig = useMemo(() => normalizeLandingPageConfig(initialConfig), [initialConfig]);
  const categories = initialCategories.length > 0 ? initialCategories : DEFAULT_HOMEPAGE_CATEGORY_CARDS;
  const [config, setConfig] = useState(normalizedInitialConfig);
  const [savedConfig, setSavedConfig] = useState(normalizedInitialConfig);
  const [selectedSectionId, setSelectedSectionId] = useState<HomepageSectionId>(normalizedInitialConfig.sectionOrder[0] ?? 'hero');
  const [panelTab, setPanelTab] = useState<PanelTab>('sections');
  const [previewDevice, setPreviewDevice] = useState<HomepagePreviewDevice>('desktop');
  const [isSaving, setIsSaving] = useState(false);
  const [uploadingSlideId, setUploadingSlideId] = useState<string | null>(null);
  const [addSectionMenuOpen, setAddSectionMenuOpen] = useState(false);
  const [openSectionMenuId, setOpenSectionMenuId] = useState<HomepageSectionId | null>(null);
  const [renamingSectionId, setRenamingSectionId] = useState<HomepageSectionId | null>(null);
  const [sectionRenameValue, setSectionRenameValue] = useState('');
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  useEffect(() => {
    setConfig(normalizedInitialConfig);
    setSavedConfig(normalizedInitialConfig);
    setSelectedSectionId((current) => normalizedInitialConfig.sectionOrder.includes(current) ? current : normalizedInitialConfig.sectionOrder[0] ?? 'hero');
    setOpenSectionMenuId(null);
    setRenamingSectionId(null);
    setSectionRenameValue('');
  }, [normalizedInitialConfig]);

  const isDirty = useMemo(() => comparable(config) !== comparable(savedConfig), [config, savedConfig]);
  const sectionIds = config.sectionOrder;
  const availableSectionIds = HOMEPAGE_SECTION_IDS.filter((sectionId) => !sectionIds.includes(sectionId));

  useEffect(() => {
    if (availableSectionIds.length === 0) setAddSectionMenuOpen(false);
  }, [availableSectionIds.length]);

  useEffect(() => {
    if (!openSectionMenuId) return undefined;

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target instanceof Element ? event.target : null;
      if (target?.closest('[data-homepage-section-menu]')) return;
      setOpenSectionMenuId(null);
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpenSectionMenuId(null);
    };

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [openSectionMenuId]);

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
    updateConfig((current) => {
      const trimmedTitle = title.trim();
      const sectionTitles = { ...current.sectionTitles };

      if (!trimmedTitle || trimmedTitle === homepageSectionLabels[sectionId]) {
        delete sectionTitles[sectionId];
      } else {
        sectionTitles[sectionId] = trimmedTitle;
      }

      return { ...current, sectionTitles };
    });
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

  function updateHeroView(updates: Partial<HomepageHeroDeviceSettings>) {
    updateHero({
      responsive: {
        ...config.hero.responsive,
        [previewDevice]: { ...config.hero.responsive[previewDevice], ...updates }
      }
    });
  }

  function addHeroTextBlock() {
    const blockId = createId('hero-text');
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
      text: 'Novo besedilo',
      visible: true,
      href: '',
      ...desktopDefaults,
      responsive: {
        desktop: desktopDefaults,
        tablet: { ...desktopDefaults, xPx: 120, yPx: 260, widthPx: 320, fontSizePx: 22 },
        mobile: { ...desktopDefaults, xPx: 24, yPx: 250, widthPx: 300, fontSizePx: 18 }
      }
    };

    updateHero({ textBlocks: [...config.hero.textBlocks, block] });
    setSelectedSectionId('hero');
    setPanelTab('sections');
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

  function focusHeroEditor() {
    setSelectedSectionId('hero');
    setPanelTab('sections');
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
    setPanelTab('sections');
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
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = config.hero.slides.findIndex((slide) => slide.id === active.id);
    const newIndex = config.hero.slides.findIndex((slide) => slide.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    updateHero({ slides: arrayMove(config.hero.slides, oldIndex, newIndex) });
  }

  function handleCategoryDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const ordered = mergeCategoryOrder(config.categories.categoryOrder, categories);
    const oldIndex = ordered.indexOf(String(active.id));
    const newIndex = ordered.indexOf(String(over.id));
    if (oldIndex < 0 || newIndex < 0) return;
    updateCategories({ categoryOrder: arrayMove(ordered, oldIndex, newIndex) });
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
    const formData = new FormData();
    formData.append('file', file);
    formData.append('elementId', `hero-${slideId}`);
    const fallbackMediaType = detectHeroMediaTypeFromFile(file);
    const fileBaseName = getFileBaseName(file.name);

    setUploadingSlideId(slideId);
    try {
      const response = await fetch('/api/admin/landing-page/media', {
        method: 'POST',
        body: formData
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(typeof body.message === 'string' ? body.message : 'Nalaganje medija ni uspelo.');
      }
      const mediaType = body.mediaType === 'video' ? 'video' : body.mediaType === 'image' ? 'image' : fallbackMediaType;
      updateSlide(slideId, {
        type: mediaType,
        src: String(body.url ?? ''),
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

  function updateFooterColumn(columnId: string, updates: Partial<HomepageFooterColumn>) {
    updateFooter({
      columns: config.footer.columns.map((column) => (column.id === columnId ? { ...column, ...updates } : column))
    });
  }

  function setFooterColumnCount(count: number) {
    const nextCount = Math.min(6, Math.max(1, Math.round(count)));
    const columns = [...config.footer.columns];
    while (columns.length < nextCount) {
      columns.push({
        id: createId('footer-column'),
        title: `Stolpec ${columns.length + 1}`,
        links: []
      });
    }
    updateFooter({ columns: columns.slice(0, nextCount) });
  }

  function addFooterLink(columnId: string) {
    updateFooter({
      columns: config.footer.columns.map((column) =>
        column.id === columnId
          ? {
              ...column,
              links: [...column.links, { id: createId('footer-link'), label: 'Nova povezava', href: '#' }]
            }
          : column
      )
    });
  }

  function updateFooterLink(columnId: string, linkId: string, updates: Partial<HomepageFooterLink>) {
    updateFooter({
      columns: config.footer.columns.map((column) =>
        column.id === columnId
          ? {
              ...column,
              links: column.links.map((link) => (link.id === linkId ? { ...link, ...updates } : link))
            }
          : column
      )
    });
  }

  function deleteFooterLink(columnId: string, linkId: string) {
    updateFooter({
      columns: config.footer.columns.map((column) =>
        column.id === columnId
          ? { ...column, links: column.links.filter((link) => link.id !== linkId) }
          : column
      )
    });
  }

  function addSocialLink() {
    const link: HomepageFooterSocialLink = {
      id: createId('social'),
      type: 'custom',
      label: 'Profil',
      href: '#'
    };
    updateFooter({ socialLinks: [...config.footer.socialLinks, link] });
  }

  function updateSocialLink(linkId: string, updates: Partial<HomepageFooterSocialLink>) {
    updateFooter({
      socialLinks: config.footer.socialLinks.map((link) => (link.id === linkId ? { ...link, ...updates } : link))
    });
  }

  function deleteSocialLink(linkId: string) {
    updateFooter({ socialLinks: config.footer.socialLinks.filter((link) => link.id !== linkId) });
  }

  function updateLegalLink(linkId: string, updates: Partial<HomepageFooterLink>) {
    updateFooter({
      legalLinks: config.footer.legalLinks.map((link) => (link.id === linkId ? { ...link, ...updates } : link))
    });
  }

  async function save() {
    const payloadConfig = normalizeLandingPageConfig(config);
    setIsSaving(true);
    try {
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
      setConfig(persistedConfig);
      setSavedConfig(persistedConfig);
      toast.success('Glavna stran je shranjena.');
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Shranjevanje glavne strani ni uspelo.');
    } finally {
      setIsSaving(false);
    }
  }

  function restoreDefaults() {
    if (!window.confirm('Ponastavim glavno stran na privzeto vsebino?')) return;
    const defaults = normalizeLandingPageConfig(cloneDefaultLandingPageConfig());
    setConfig(defaults);
    setSelectedSectionId(defaults.sectionOrder[0] ?? 'hero');
  }

  const categoryRows = useMemo(() => {
    const source = categories.length > 0 ? categories : DEFAULT_HOMEPAGE_CATEGORY_CARDS;
    const bySlug = new Map(source.map((category) => [category.slug, category]));
    return mergeCategoryOrder(config.categories.categoryOrder, source)
      .map((slug) => bySlug.get(slug))
      .filter((category): category is HomepageCategoryCardData => Boolean(category));
  }, [categories, config.categories.categoryOrder]);

  const sectionVisibilitySummary = HOMEPAGE_SECTION_IDS
    .map((sectionId) => `${getSectionLabel(sectionId)}: ${isSectionVisible(sectionId) ? 'vidno' : 'skrito'}`)
    .join(' · ');

  const selectedViewLabel = homepagePreviewDeviceLabels[previewDevice];
  const heroViewSettings = config.hero.responsive[previewDevice];
  const categoryViewSettings = config.categories.responsive[previewDevice];
  const infoViewSettings = config.infoBlocks.responsive[previewDevice];
  const footerViewSettings = config.footer.responsive[previewDevice];
  const pageViewSettings = config.page.responsive[previewDevice];

  function renderHeroSettings() {
    return (
      <div className="space-y-3">
        <FieldBlock title="Tekst in gumbi">
          <TextField label="Naslov" value={config.hero.title} onChange={(title) => updateHero({ title })} />
          <TextareaField label="Opis" value={config.hero.description} onChange={(description) => updateHero({ description })} />
          <div className="grid gap-3 sm:grid-cols-2">
            <TextField label="Primarni gumb" value={config.hero.primaryButton.label} onChange={(label) => updateHero({ primaryButton: { ...config.hero.primaryButton, label } })} />
            <TextField label="Povezava" value={config.hero.primaryButton.href} onChange={(href) => updateHero({ primaryButton: { ...config.hero.primaryButton, href } })} />
            <TextField label="Sekundarni gumb" value={config.hero.secondaryButton.label} onChange={(label) => updateHero({ secondaryButton: { ...config.hero.secondaryButton, label } })} />
            <TextField label="Povezava" value={config.hero.secondaryButton.href} onChange={(href) => updateHero({ secondaryButton: { ...config.hero.secondaryButton, href } })} />
          </div>
        </FieldBlock>

        <FieldBlock title="Mediji in prikazne nastavitve">
          <DndContext id="homepage-hero-slides" sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleSlideDragEnd}>
            <SortableContext items={config.hero.slides.map((slide) => slide.id)} strategy={verticalListSortingStrategy}>
              <div className="grid gap-3">
                {config.hero.slides.map((slide, index) => (
                  <SortableSlideEditor
                    key={slide.id}
                    slide={slide}
                    index={index}
                    uploading={uploadingSlideId === slide.id}
                    addingSlide={uploadingSlideId !== null}
                    showAddUpload={index === config.hero.slides.length - 1}
                    onChange={(updates) => updateSlide(slide.id, updates)}
                    onDelete={() => deleteSlide(slide.id)}
                    onAddUpload={uploadNewSlideMedia}
                    onUpload={(file) => void uploadSlideMedia(slide.id, file)}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>

          <div className="space-y-3 border-t border-slate-200 pt-3">
            <p className="text-[11px] font-medium text-slate-500">Nastavitve postavitve za pogled: {selectedViewLabel}</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <NumberField label="Višina sekcije" value={heroViewSettings.heightPx} onChange={(heightPx) => updateHeroView({ heightPx })} min={280} max={900} step={10} suffix="px" />
              <NumberField label="Odmik besedila X" value={heroViewSettings.contentOffsetXPx} onChange={(contentOffsetXPx) => updateHeroView({ contentOffsetXPx })} min={0} max={1400} step={10} suffix="px" />
              <NumberField label="Odmik besedila Y" value={heroViewSettings.contentOffsetYPx} onChange={(contentOffsetYPx) => updateHeroView({ contentOffsetYPx })} min={-450} max={450} step={10} suffix="px" />
              <NumberField label="Širina besedila" value={heroViewSettings.textWidthPx} onChange={(textWidthPx) => updateHeroView({ textWidthPx })} min={260} max={1200} step={10} suffix="px" />
              <NumberField label="Širina medija" value={heroViewSettings.mediaWidthPercent} onChange={(mediaWidthPercent) => updateHeroView({ mediaWidthPercent })} min={50} max={160} step={5} suffix="%" />
              <NumberField label="Zatemnitev" value={heroViewSettings.overlayStrength} onChange={(overlayStrength) => updateHeroView({ overlayStrength })} min={0} max={85} suffix="%" />
              <NumberField label="Autoplay interval" value={config.hero.autoplayInterval} onChange={(autoplayInterval) => updateHero({ autoplayInterval })} min={1500} max={30000} step={500} suffix="ms" />
            </div>
            <div className="grid gap-2">
              <ToggleRow label="Puščice levo/desno" checked={config.hero.showArrows} onChange={(showArrows) => updateHero({ showArrows })} />
              <ToggleRow label="Pike" checked={config.hero.showDots} onChange={(showDots) => updateHero({ showDots })} />
              <ToggleRow label="Samodejno predvajanje" checked={config.hero.autoplay} onChange={(autoplay) => updateHero({ autoplay })} />
              <ToggleRow label="Zatemni ozadje za berljivost" checked={config.hero.darkenBackground} onChange={(darkenBackground) => updateHero({ darkenBackground })} />
            </div>
          </div>
        </FieldBlock>
      </div>
    );
  }

  function renderCategorySettings() {
    return (
      <div className="space-y-3">
        <FieldBlock title="Tekst in povezava">
          <TextField label="Naslov" value={config.categories.title} onChange={(title) => updateCategories({ title })} />
          <TextareaField label="Podnaslov" value={config.categories.subtitle} onChange={(subtitle) => updateCategories({ subtitle })} />
          <ToggleRow label="Prikaži povezavo do vseh kategorij" checked={config.categories.showAllLink} onChange={(showAllLink) => updateCategories({ showAllLink })} />
          <TextField label="Cilj povezave" value={config.categories.showAllHref} onChange={(showAllHref) => updateCategories({ showAllHref })} />
        </FieldBlock>

        <FieldBlock title="Postavitev in kartice">
          <p className="text-[11px] font-medium text-slate-500">Nastavitve postavitve za pogled: {selectedViewLabel}</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <NumberField label="Število prikazanih" value={categoryViewSettings.limit} onChange={(limit) => updateCategoriesView({ limit })} min={1} max={24} />
            <NumberField label="Stolpci" value={categoryViewSettings.columns} onChange={(columns) => updateCategoriesView({ columns })} min={1} max={6} />
            <NumberField label="Razmik" value={categoryViewSettings.gap} onChange={(gap) => updateCategoriesView({ gap })} min={0} max={48} suffix="px" />
            <SelectField label="Širina" value={categoryViewSettings.containerWidth} options={createOptions(HOMEPAGE_CONTAINER_WIDTHS, homepageContainerWidthLabels)} onChange={(containerWidth) => updateCategoriesView({ containerWidth })} />
            <SelectField label="Velikost kartic" value={categoryViewSettings.cardSize} options={createOptions(HOMEPAGE_CATEGORY_CARD_SIZES, homepageCategoryCardSizeLabels)} onChange={(cardSize) => updateCategoriesView({ cardSize })} />
            <SelectField label="Slog kartic" value={categoryViewSettings.cardStyle} options={createOptions(HOMEPAGE_CATEGORY_CARD_STYLES, homepageCategoryCardStyleLabels)} onChange={(cardStyle) => updateCategoriesView({ cardStyle })} />
          </div>
          <ToggleRow label="Puščica v karticah" checked={categoryViewSettings.showCardArrow} onChange={(showCardArrow) => updateCategoriesView({ showCardArrow })} />
        </FieldBlock>

        <FieldBlock title="Vrstni red kategorij" defaultOpen={false}>
          <p className="text-[11px] leading-4 text-slate-500">Slike in vsebina kategorij ostanejo na strani Kategorije.</p>
          <DndContext id="homepage-category-order" sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleCategoryDragEnd}>
            <SortableContext items={categoryRows.map((category) => category.slug)} strategy={verticalListSortingStrategy}>
              <div className="grid gap-2">
                {categoryRows.map((category, index) => (
                  <SortableCategoryRow key={category.slug} category={category} index={index} />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        </FieldBlock>
      </div>
    );
  }

  function renderInfoSettings() {
    return (
      <div className="space-y-3">
        <FieldBlock title="Prikazne nastavitve">
          <p className="text-[11px] font-medium text-slate-500">Nastavitve postavitve za pogled: {selectedViewLabel}</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <NumberField label="Število elementov" value={config.infoBlocks.items.length} onChange={setInfoItemCount} min={1} max={12} />
            <NumberField label="Stolpci" value={infoViewSettings.columns} onChange={(columns) => updateInfoBlocksView({ columns })} min={1} max={6} />
            <NumberField label="Razmik" value={infoViewSettings.gap} onChange={(gap) => updateInfoBlocksView({ gap })} min={0} max={48} suffix="px" />
            <SelectField label="Slog" value={infoViewSettings.style} options={createOptions(HOMEPAGE_INFO_STYLES, homepageInfoStyleLabels)} onChange={(style) => updateInfoBlocksView({ style })} />
            <SelectField label="Pozicija ikon" value={infoViewSettings.iconPosition} options={createOptions(HOMEPAGE_INFO_ICON_POSITIONS, homepageInfoIconPositionLabels)} onChange={(iconPosition) => updateInfoBlocksView({ iconPosition })} />
            <SelectField label="Poravnava" value={infoViewSettings.alignment} options={[{ value: 'left', label: 'Levo' }, { value: 'center', label: 'Sredina' }]} onChange={(alignment) => updateInfoBlocksView({ alignment })} />
          </div>
          <ToggleRow label="Ločilne črte" checked={infoViewSettings.dividers} onChange={(dividers) => updateInfoBlocksView({ dividers })} />
        </FieldBlock>

        <FieldBlock title="Elementi">
          <div className="flex justify-end">
            <Button type="button" variant="primary" size="toolbar" className={`${adminTablePrimaryButtonClassName} !h-8 !px-2.5`} onClick={addInfoItem}>
              <Plus className="h-4 w-4" />
              Dodaj
            </Button>
          </div>
          <div className="grid gap-3">
            {config.infoBlocks.items.map((item, index) => (
              <div key={item.id} className="rounded-lg border border-slate-200 bg-white p-3">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <span className="text-[12px] font-semibold text-slate-800">Element {index + 1}</span>
                  <SmallIconButton label="Odstrani element" tone="danger" onClick={() => deleteInfoItem(item.id)}>
                    <Trash2 className="h-4 w-4" />
                  </SmallIconButton>
                </div>
                <div className="grid gap-3">
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
      <div className="space-y-3">
        <FieldBlock title="Osnovno in prikaz">
          <div className="grid gap-3 sm:grid-cols-2">
            <SelectField label="Logotip" value={config.footer.logoMode} options={createOptions(HOMEPAGE_FOOTER_LOGO_MODES, homepageFooterLogoModeLabels)} onChange={(logoMode) => updateFooter({ logoMode })} />
            <TextField label="Besedilo logotipa" value={config.footer.logoText} onChange={(logoText) => updateFooter({ logoText })} />
            <NumberField label="Število stolpcev" value={config.footer.columns.length} onChange={setFooterColumnCount} min={1} max={6} />
          </div>
          <TextareaField label="Opis" value={config.footer.description} onChange={(description) => updateFooter({ description })} />
          <div className="space-y-3 border-t border-slate-200 pt-3">
            <p className="text-[11px] font-medium text-slate-500">Nastavitve postavitve za pogled: {selectedViewLabel}</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <NumberField label="Stolpci prikaza" value={footerViewSettings.layoutColumns} onChange={(layoutColumns) => updateFooterView({ layoutColumns })} min={1} max={6} />
              <SelectField label="Odmik" value={footerViewSettings.spacing} options={createOptions(HOMEPAGE_FOOTER_SPACINGS, homepageFooterSpacingLabels)} onChange={(spacing) => updateFooterView({ spacing })} />
            </div>
            <ToggleRow label="Zgornja obroba" checked={footerViewSettings.topBorder} onChange={(topBorder) => updateFooterView({ topBorder })} />
          </div>
        </FieldBlock>

        <FieldBlock title="Stolpci in povezave" defaultOpen={false}>
          <div className="grid gap-3">
            {config.footer.columns.map((column, columnIndex) => (
              <div key={column.id} className="rounded-lg border border-slate-200 bg-white p-3">
                <TextField label={`Naslov stolpca ${columnIndex + 1}`} value={column.title} onChange={(title) => updateFooterColumn(column.id, { title })} />
                <div className="mt-3 grid gap-2">
                  {column.links.map((link) => (
                    <div key={link.id} className="grid min-w-0 gap-2">
                      <Input value={link.label} onChange={(event) => updateFooterLink(column.id, link.id, { label: event.target.value })} className={inputClassName} placeholder="Oznaka" />
                      <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_36px] gap-2">
                        <Input value={link.href} onChange={(event) => updateFooterLink(column.id, link.id, { href: event.target.value })} className={inputClassName} placeholder="/povezava" />
                        <SmallIconButton label="Odstrani povezavo" tone="danger" onClick={() => deleteFooterLink(column.id, link.id)}>
                          <Trash2 className="h-4 w-4" />
                        </SmallIconButton>
                      </div>
                    </div>
                  ))}
                </div>
                <Button type="button" variant="default" size="toolbar" className="mt-3 !h-8 !rounded-md !px-2.5" onClick={() => addFooterLink(column.id)}>
                  <Plus className="h-4 w-4" />
                  Povezava
                </Button>
              </div>
            ))}
          </div>
        </FieldBlock>

        <FieldBlock title="Kontakt" defaultOpen={false}>
          <div className="grid gap-3 sm:grid-cols-2">
            <TextField label="E-pošta" value={config.footer.contact.email} onChange={(email) => updateFooter({ contact: { ...config.footer.contact, email } })} />
            <TextField label="Telefon" value={config.footer.contact.phone} onChange={(phone) => updateFooter({ contact: { ...config.footer.contact, phone } })} />
            <TextField label="Naslov" value={config.footer.contact.address} onChange={(address) => updateFooter({ contact: { ...config.footer.contact, address } })} />
            <TextField label="Delovni čas" value={config.footer.contact.workingHours} onChange={(workingHours) => updateFooter({ contact: { ...config.footer.contact, workingHours } })} />
          </div>
        </FieldBlock>

        <FieldBlock title="Družbena omrežja" defaultOpen={false}>
          <div className="flex justify-end">
            <Button type="button" variant="primary" size="toolbar" className={`${adminTablePrimaryButtonClassName} !h-8 !px-2.5`} onClick={addSocialLink}>
              <Plus className="h-4 w-4" />
              Dodaj
            </Button>
          </div>
          <div className="grid gap-2">
            {config.footer.socialLinks.map((link) => (
              <div key={link.id} className="grid min-w-0 gap-2">
                <select value={link.type} onChange={(event) => updateSocialLink(link.id, { type: event.target.value as HomepageFooterSocialLink['type'] })} className={inputClassName}>
                  {HOMEPAGE_SOCIAL_TYPES.map((type) => (
                    <option key={type} value={type}>{homepageSocialTypeLabels[type]}</option>
                  ))}
                </select>
                <Input value={link.label} onChange={(event) => updateSocialLink(link.id, { label: event.target.value })} className={inputClassName} placeholder="Oznaka" />
                <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_36px] gap-2">
                  <Input value={link.href} onChange={(event) => updateSocialLink(link.id, { href: event.target.value })} className={inputClassName} placeholder="https://..." />
                  <SmallIconButton label="Odstrani profil" tone="danger" onClick={() => deleteSocialLink(link.id)}>
                    <Trash2 className="h-4 w-4" />
                  </SmallIconButton>
                </div>
              </div>
            ))}
          </div>
        </FieldBlock>

        <FieldBlock title="Spodnja vrstica" defaultOpen={false}>
          <TextField label="Copyright" value={config.footer.copyright} onChange={(copyright) => updateFooter({ copyright })} />
          <div className="grid gap-2">
            {config.footer.legalLinks.map((link) => (
              <div key={link.id} className="grid min-w-0 gap-2">
                <Input value={link.label} onChange={(event) => updateLegalLink(link.id, { label: event.target.value })} className={inputClassName} />
                <Input value={link.href} onChange={(event) => updateLegalLink(link.id, { href: event.target.value })} className={inputClassName} />
              </div>
            ))}
          </div>
        </FieldBlock>
      </div>
    );
  }

  function renderSelectedSectionSettings() {
    return (
      <div className="space-y-3">
        <div className="border-t border-slate-200 pt-4">
          <h2 className="text-[13px] font-semibold text-slate-900">Uredi sekcijo: {getSectionLabel(selectedSectionId)}</h2>
        </div>
        {selectedSectionId === 'hero' ? renderHeroSettings() : null}
        {selectedSectionId === 'categories' ? renderCategorySettings() : null}
        {selectedSectionId === 'infoBlocks' ? renderInfoSettings() : null}
        {selectedSectionId === 'footer' ? renderFooterSettings() : null}
      </div>
    );
  }

  function renderPageSettings() {
    return (
      <div className="space-y-3">
        <FieldBlock title="Stran">
          <div className="grid gap-3 sm:grid-cols-2">
            <SelectField label="Širina vsebine" value={pageViewSettings.containerWidth} options={createOptions(HOMEPAGE_CONTAINER_WIDTHS, homepageContainerWidthLabels)} onChange={(containerWidth) => updatePageView({ containerWidth })} />
            <SelectField label="Razmik sekcij" value={pageViewSettings.sectionSpacing} options={createOptions(HOMEPAGE_SECTION_SPACINGS, homepageSectionSpacingLabels)} onChange={(sectionSpacing) => updatePageView({ sectionSpacing })} />
            <SelectField label="Zaobljenost" value={pageViewSettings.sectionRadius} options={createOptions(HOMEPAGE_SECTION_RADII, homepageSectionRadiusLabels)} onChange={(sectionRadius) => updatePageView({ sectionRadius })} />
            <SelectField label="Slog gumbov" value={config.page.buttonStyle} options={createOptions(HOMEPAGE_BUTTON_STYLES, homepageButtonStyleLabels)} onChange={(buttonStyle) => updatePage({ buttonStyle })} />
          </div>
          <TextField label="Barva ozadja" value={config.page.backgroundColor} onChange={(backgroundColor) => updatePage({ backgroundColor })} placeholder="#ffffff" />
        </FieldBlock>
        <FieldBlock title="Povzetek vidnosti">
          <p className="text-[12px] leading-5 text-slate-600">{sectionVisibilitySummary}</p>
        </FieldBlock>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <AdminPageHeader
        title="Glavna stran"
        description="Urejanje javne glavne strani pod zgornjo navigacijo."
        actions={
          <div className="flex flex-wrap items-center justify-end gap-2">
            <span className={classNames('inline-flex h-8 items-center rounded-full border px-3 text-[12px] font-semibold', isDirty ? 'border-amber-200 bg-amber-50 text-amber-700' : 'border-emerald-200 bg-emerald-50 text-emerald-700')}>
              {isDirty ? 'Neshranjeno' : 'Objavljeno'}
            </span>
            <a href="/" target="_blank" rel="noreferrer" className={previewButtonClassName}>
              <Eye className="h-4 w-4" />
              Predogled
            </a>
            <Button type="button" variant="default" size="toolbar" onClick={restoreDefaults} className="!h-9 !rounded-md !px-3" disabled={isSaving}>
              Privzeto
            </Button>
            <Button type="button" variant="primary" size="toolbar" className={topActionSaveButtonClassName} onClick={save} disabled={!isDirty || isSaving}>
              <Save className="h-4 w-4" />
              Shrani spremembe
            </Button>
          </div>
        }
      />
      <AdminPodobaTabs />

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_420px]">
        <main className="min-w-0 space-y-3">
          <div className={`${panelClassName} overflow-hidden`}>
            <div className="flex flex-wrap items-center gap-2 px-4 py-3">
              <div className="flex items-center gap-2">
                {HOMEPAGE_PREVIEW_DEVICES.map((device) => (
                  <button
                    key={device}
                    type="button"
                    onClick={() => setPreviewDevice(device)}
                    className={classNames(
                      `inline-flex h-8 items-center gap-1.5 rounded-md px-2.5 text-[12px] font-medium leading-none transition ${adminControlFocusTokenClasses}`,
                      previewDevice === device ? 'text-[color:var(--blue-500)]' : 'text-slate-500 hover:text-[color:var(--blue-500)]'
                    )}
                  >
                    <PreviewDeviceIcon device={device} />
                    {homepagePreviewDeviceLabels[device]}
                  </button>
                ))}
              </div>
            </div>
            <div className="mx-4 h-px bg-slate-200" />
            <div className="overflow-auto p-4">
              <ScaledHomepagePreview
                device={previewDevice}
                settings={config}
                categories={categories}
                navigation={navigation}
                selectedSectionId={selectedSectionId}
                onSelectSection={(sectionId) => {
                  setSelectedSectionId(sectionId);
                  setPanelTab('sections');
                }}
                onHeroTextPositionChange={(updates) => updateHeroView(updates)}
                onHeroTextContentChange={(updates) => updateHero(updates)}
                onHeroTypographyChange={(updates) => updateHeroView(updates)}
                onHeroTextBlockAdd={addHeroTextBlock}
                onHeroTextBlockChange={updateHeroTextBlock}
                onHeroMediaFocus={focusHeroEditor}
                onHeroSettingsFocus={focusHeroEditor}
              />
            </div>
          </div>
        </main>

        <aside className="min-w-0 xl:sticky xl:top-5 xl:self-start">
          <div className={`${panelClassName} overflow-hidden`}>
            <div className="px-3 pt-3">
              <EuiTabs
                value={panelTab}
                onChange={(value) => setPanelTab(value as PanelTab)}
                tabs={[
                  { value: 'sections', label: 'Sekcije' },
                  { value: 'page', label: 'Nastavitve strani' }
                ]}
                surface="panel"
              />
            </div>

            <div className={`${panelInnerClassName} max-h-[calc(100vh-180px)] overflow-x-hidden overflow-y-auto`}>
              {panelTab === 'sections' ? (
                <div className="space-y-4">
                  <div>
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <h2 className="text-[13px] font-semibold text-slate-900">Sekcije</h2>
                      <div className="relative">
                        <button
                          type="button"
                          aria-label="Dodaj sekcijo"
                          title={availableSectionIds.length > 0 ? 'Dodaj sekcijo' : 'Vse sekcije so že dodane'}
                          disabled={availableSectionIds.length === 0}
                          onClick={() => setAddSectionMenuOpen((open) => !open)}
                          className={adminTableNeutralIconButtonClassName}
                        >
                          <Plus className="h-4 w-4" />
                        </button>
                        {addSectionMenuOpen ? (
                          <div className="absolute right-0 top-9 z-30 w-56 overflow-hidden rounded-md border border-slate-200 bg-white py-1 shadow-[0_14px_34px_rgba(15,23,42,0.12)]">
                            {availableSectionIds.map((sectionId) => (
                              <button
                                key={sectionId}
                                type="button"
                                className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-[12px] font-medium text-slate-700 transition hover:bg-[color:var(--hover-neutral)] hover:text-[color:var(--blue-500)]"
                                onClick={() => addSection(sectionId)}
                              >
                                <span>{resolveHomepageSectionLabel(sectionId, config.sectionTitles)}</span>
                                <Plus className="h-3.5 w-3.5" />
                              </button>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    </div>
                    <DndContext id="homepage-sections" sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleSectionDragEnd}>
                      <SortableContext items={sectionIds} strategy={verticalListSortingStrategy}>
                        <div className="grid gap-1.5">
                          {config.sectionOrder.map((sectionId, index) => (
                            <SortableSectionRow
                              key={sectionId}
                              sectionId={sectionId}
                              index={index}
                              label={getSectionLabel(sectionId)}
                              selected={selectedSectionId === sectionId}
                              visible={isSectionVisible(sectionId)}
                              canDelete={config.sectionOrder.length > 1}
                              menuOpen={openSectionMenuId === sectionId}
                              renaming={renamingSectionId === sectionId}
                              renameValue={renamingSectionId === sectionId ? sectionRenameValue : getSectionLabel(sectionId)}
                              onSelect={() => setSelectedSectionId(sectionId)}
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
                  {renderSelectedSectionSettings()}
                </div>
              ) : renderPageSettings()}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

export default AdminLandingPageClient;
