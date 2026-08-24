'use client';

import Image from 'next/image';
import Link from 'next/link';
import {
  Fragment,
  type CSSProperties,
  type HTMLAttributes,
  type KeyboardEvent,
  type MouseEvent,
  type ReactElement,
  type ReactNode
} from 'react';
import {
  normalizeCategoryShowcaseMediaSettings,
  type CategoryShowcaseItem,
  type CategoryShowcaseMediaSettings
} from '@/shared/features/category-showcase/categoryShowcaseSchema';

const classNames = (...parts: Array<string | false | null | undefined>) => parts.filter(Boolean).join(' ');

export type CategoryShowcaseColumns = {
  desktop: number;
  tablet: number;
  mobile: number;
};

export type CategoryShowcaseTileContext = {
  item: CategoryShowcaseItem;
  index: number;
  ordinal: number;
  selected: boolean;
  href?: string;
  presentation: CategoryShowcaseMediaSettings;
};

export type CategoryShowcaseTitleRenderContext = CategoryShowcaseTileContext & {
  defaultTitle: ReactElement;
};

export type CategoryShowcaseMediaRenderContext = CategoryShowcaseTileContext & {
  defaultMedia: ReactNode;
};

export type CategoryShowcaseTileRenderContext = CategoryShowcaseTileContext & {
  tile: ReactElement;
};

export type CategoryShowcaseItemPointerHandler = (
  item: CategoryShowcaseItem,
  index: number,
  event: MouseEvent<HTMLElement>
) => void;

export type CategoryShowcaseTileProps = {
  item: CategoryShowcaseItem;
  index: number;
  presentation?: CategoryShowcaseMediaSettings;
  imageSizes?: string;
  href?: string;
  selected?: boolean;
  interactive?: boolean;
  showDirectionIndicator?: boolean;
  className?: string;
  tileProps?: Omit<HTMLAttributes<HTMLDivElement>, 'children'>;
  onItemClick?: CategoryShowcaseItemPointerHandler;
  onSelectItem?: CategoryShowcaseItemPointerHandler;
  renderTitle?: (context: CategoryShowcaseTitleRenderContext) => ReactNode;
  renderMedia?: (context: CategoryShowcaseMediaRenderContext) => ReactNode;
  renderActions?: (context: CategoryShowcaseTileContext) => ReactNode;
};

export type CategoryShowcaseProps = {
  items: CategoryShowcaseItem[];
  columns?: number | Partial<CategoryShowcaseColumns>;
  gap?: number | string;
  selectedSlug?: string | null;
  interactive?: boolean;
  showDirectionIndicator?: boolean;
  className?: string;
  gridClassName?: string;
  tileClassName?: string;
  style?: CSSProperties;
  emptyState?: ReactNode;
  trailingContent?: ReactNode;
  getHref?: (item: CategoryShowcaseItem, index: number) => string | null | undefined;
  getTileClassName?: (item: CategoryShowcaseItem, index: number) => string | null | undefined;
  getTileProps?: (
    item: CategoryShowcaseItem,
    index: number
  ) => Omit<HTMLAttributes<HTMLDivElement>, 'children'> | undefined;
  onItemClick?: CategoryShowcaseItemPointerHandler;
  onSelectItem?: CategoryShowcaseItemPointerHandler;
  renderTitle?: (context: CategoryShowcaseTitleRenderContext) => ReactNode;
  renderMedia?: (context: CategoryShowcaseMediaRenderContext) => ReactNode;
  renderActions?: (context: CategoryShowcaseTileContext) => ReactNode;
  renderTile?: (context: CategoryShowcaseTileRenderContext) => ReactNode;
};

const DEFAULT_COLUMNS: CategoryShowcaseColumns = {
  desktop: 4,
  tablet: 2,
  mobile: 1
};

const MIN_COLUMNS = 1;
const MAX_COLUMNS = 8;

function clampColumns(value: unknown, fallback: number): number {
  const numeric = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.min(MAX_COLUMNS, Math.max(MIN_COLUMNS, Math.round(numeric)));
}

function resolveColumns(columns?: number | Partial<CategoryShowcaseColumns>): CategoryShowcaseColumns {
  if (typeof columns === 'number') {
    const desktop = clampColumns(columns, DEFAULT_COLUMNS.desktop);
    return {
      desktop,
      tablet: Math.min(2, desktop),
      mobile: 1
    };
  }

  return {
    desktop: clampColumns(columns?.desktop, DEFAULT_COLUMNS.desktop),
    tablet: clampColumns(columns?.tablet, DEFAULT_COLUMNS.tablet),
    mobile: clampColumns(columns?.mobile, DEFAULT_COLUMNS.mobile)
  };
}

const CATEGORY_SHOWCASE_MEDIA_WIDTH_PERCENT = 61;

export function resolveCategoryShowcaseImageSizes(columns: CategoryShowcaseColumns): string {
  const viewportWidthForColumns = (count: number) => `${Math.ceil(CATEGORY_SHOWCASE_MEDIA_WIDTH_PERCENT / count)}vw`;
  return [
    `(min-width: 1025px) ${viewportWidthForColumns(columns.desktop)}`,
    `(min-width: 560px) ${viewportWidthForColumns(columns.tablet)}`,
    viewportWidthForColumns(columns.mobile)
  ].join(', ');
}

function ArrowIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 20 20" className="h-4 w-4" fill="none">
      <path
        d="M3.5 10h12m-4-4 4 4-4 4"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function defaultCategoryTitle(item: CategoryShowcaseItem) {
  return (
    <h3 className="line-clamp-2 text-[15px] font-semibold leading-[1.28] tracking-[-0.012em] min-[1025px]:text-[16px]">
      {item.title}
    </h3>
  );
}

function defaultCategoryMedia(
  item: CategoryShowcaseItem,
  presentation: CategoryShowcaseMediaSettings,
  imageSizes: string
) {
  const image = typeof item.image === 'string' ? item.image.trim() : '';
  if (!image) {
    return (
      <span className="absolute inset-0 grid place-items-center text-[12px] font-medium text-slate-400">
        Brez slike
      </span>
    );
  }

  return (
    <Image
      src={image}
      alt=""
      aria-hidden="true"
      fill
      unoptimized={image.startsWith('blob:') || image.startsWith('data:')}
      loading="lazy"
      sizes={imageSizes}
      className="select-none"
      draggable={false}
      style={{
        objectFit: presentation.fit,
        objectPosition: `${presentation.focalPoint.x * 100}% ${presentation.focalPoint.y * 100}%`
      }}
    />
  );
}

function stopKeyboardActivation(event: KeyboardEvent<HTMLDivElement>) {
  if (event.key === ' ') event.preventDefault();
}

export function CategoryTile({
  item,
  index,
  presentation: resolvedPresentation,
  imageSizes = resolveCategoryShowcaseImageSizes(DEFAULT_COLUMNS),
  href,
  selected = false,
  interactive,
  showDirectionIndicator = true,
  className,
  tileProps,
  onItemClick,
  onSelectItem,
  renderTitle,
  renderMedia,
  renderActions
}: CategoryShowcaseTileProps) {
  const presentation = resolvedPresentation ?? normalizeCategoryShowcaseMediaSettings(item.presentation);
  const isInteractive = interactive ?? Boolean(href || onItemClick || onSelectItem);
  const ordinal = index + 1;
  const context: CategoryShowcaseTileContext = {
    item,
    index,
    ordinal,
    selected,
    href,
    presentation
  };
  const {
    className: tilePropsClassName,
    style: tilePropsStyle,
    onClick: tilePropsOnClick,
    onKeyDown: tilePropsOnKeyDown,
    ...restTileProps
  } = tileProps ?? {};

  const tileStyle = {
    '--category-showcase-surface': presentation.backgroundColor,
    '--category-showcase-hover-surface': presentation.backgroundHoverColor,
    '--category-showcase-title': presentation.titleColor,
    '--category-showcase-title-hover': presentation.titleHoverColor,
    '--category-showcase-ordinal': presentation.ordinalColor,
    '--category-showcase-ordinal-hover': presentation.ordinalHoverColor,
    ...tilePropsStyle
  } as CSSProperties & Record<string, string | number>;
  const cropStyle: CSSProperties = {
    left: `${-(presentation.crop.x / presentation.crop.width) * 100}%`,
    top: `${-(presentation.crop.y / presentation.crop.height) * 100}%`,
    width: `${(1 / presentation.crop.width) * 100}%`,
    height: `${(1 / presentation.crop.height) * 100}%`
  };
  const presentationTransformStyle: CSSProperties = {
    transform: `translate3d(${presentation.offsetOriginX + presentation.offsetX}%, ${presentation.offsetOriginY + presentation.offsetY}%, 0) scale(${presentation.scale})`,
    transformOrigin: `${presentation.focalPoint.x * 100}% ${presentation.focalPoint.y * 100}%`
  };
  const title = defaultCategoryTitle(item);
  const renderedTitle = renderTitle?.({ ...context, defaultTitle: title }) ?? title;
  const media = defaultCategoryMedia(item, presentation, imageSizes);
  const renderedMedia = renderMedia?.({ ...context, defaultMedia: media }) ?? media;
  const actions = renderActions?.(context);
  const hasEmbeddedActions = Boolean(actions);
  const ordinalBoxHeightPx = Math.max(16, Math.ceil(presentation.ordinalFontSizePx * 1.35));
  const ordinalBoxWidthPx = Math.max(32, Math.ceil(presentation.ordinalFontSizePx * 2.2));

  const invokeItemHandlers = (event: MouseEvent<HTMLElement>) => {
    onSelectItem?.(item, index, event);
    if (!event.defaultPrevented) onItemClick?.(item, index, event);
  };

  const handleTileClick = (event: MouseEvent<HTMLDivElement>) => {
    tilePropsOnClick?.(event);
    if (!event.defaultPrevented) invokeItemHandlers(event);
  };

  const handleTileKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    tilePropsOnKeyDown?.(event);
    if (event.defaultPrevented || event.target !== event.currentTarget) return;
    if (event.key !== 'Enter' && event.key !== ' ') return;
    stopKeyboardActivation(event);
    event.currentTarget.click();
  };

  return (
    <div
      {...restTileProps}
      data-testid="category-showcase-tile"
      data-category={item.slug}
      data-category-slug={item.slug}
      data-category-index={index}
      data-category-showcase-selected={selected ? 'true' : 'false'}
      className={classNames(
        'group/category-showcase-tile relative isolate h-[156px] min-w-0 overflow-hidden rounded-[12px]',
        'bg-[var(--category-showcase-surface)] transition-[background-color,box-shadow] duration-300 ease-out',
        'hover:bg-[var(--category-showcase-hover-surface)] motion-reduce:transition-none',
        selected && 'ring-2 ring-[color:var(--blue-500)] ring-offset-1',
        !href && isInteractive && 'cursor-pointer',
        !href && isInteractive && !hasEmbeddedActions && 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--blue-500)] focus-visible:ring-offset-2',
        'min-[560px]:h-[164px] min-[1025px]:h-[168px]',
        tilePropsClassName,
        className
      )}
      style={tileStyle}
      role={!href && isInteractive && !hasEmbeddedActions ? 'button' : undefined}
      tabIndex={!href && isInteractive && !hasEmbeddedActions ? 0 : undefined}
      aria-pressed={!href && isInteractive && !hasEmbeddedActions ? selected : undefined}
      onClick={!href && isInteractive ? handleTileClick : tilePropsOnClick}
      onKeyDown={!href && isInteractive ? handleTileKeyDown : tilePropsOnKeyDown}
    >
      <div
        data-testid="category-showcase-media"
        data-category-media={item.slug}
        className="absolute inset-y-0 left-[39%] right-0 overflow-hidden bg-[var(--category-showcase-surface)] transition-colors duration-300 ease-out group-hover/category-showcase-tile:bg-[var(--category-showcase-hover-surface)] group-focus-within/category-showcase-tile:bg-[var(--category-showcase-hover-surface)] motion-reduce:transition-none"
      >
        <div className="category-showcase-media-motion absolute inset-0 transition-transform duration-300 ease-out group-hover/category-showcase-tile:translate-x-[5px] group-hover/category-showcase-tile:-translate-y-[4px] group-hover/category-showcase-tile:scale-[1.025] group-focus-within/category-showcase-tile:translate-x-[5px] group-focus-within/category-showcase-tile:-translate-y-[4px] group-focus-within/category-showcase-tile:scale-[1.025] motion-reduce:transform-none motion-reduce:transition-none">
          <div
            data-category-showcase-presentation
            className="absolute inset-0 bg-[var(--category-showcase-surface)] transition-colors duration-300 ease-out group-hover/category-showcase-tile:bg-[var(--category-showcase-hover-surface)] group-focus-within/category-showcase-tile:bg-[var(--category-showcase-hover-surface)] motion-reduce:transition-none"
            style={presentationTransformStyle}
          >
            <div className="absolute overflow-hidden" style={cropStyle}>
              {renderedMedia}
            </div>
          </div>
        </div>
      </div>

      <div className="relative z-10 flex h-full w-[48%] min-w-0 flex-col justify-start px-5 py-4 min-[560px]:px-6">
        <span
          className="relative block overflow-hidden font-medium tabular-nums text-[color:var(--category-showcase-ordinal)] transition-colors duration-300 ease-out group-hover/category-showcase-tile:text-[color:var(--category-showcase-ordinal-hover)] group-focus-within/category-showcase-tile:text-[color:var(--category-showcase-ordinal-hover)] motion-reduce:transition-none"
          style={{
            height: ordinalBoxHeightPx,
            width: ordinalBoxWidthPx
          }}
          data-category-showcase-ordinal-indicator={item.slug}
          aria-hidden="true"
        >
          <span
            className={classNames(
            'absolute inset-0',
            showDirectionIndicator && 'transition-[opacity,transform] duration-300 ease-out group-hover/category-showcase-tile:-translate-y-1 group-hover/category-showcase-tile:opacity-0 group-focus-within/category-showcase-tile:-translate-y-1 group-focus-within/category-showcase-tile:opacity-0 motion-reduce:transform-none motion-reduce:transition-none'
            )}
            style={{ fontSize: presentation.ordinalFontSizePx, lineHeight: `${ordinalBoxHeightPx}px` }}
            data-category-showcase-ordinal-number={item.slug}
          >
            {String(ordinal).padStart(2, '0')}
          </span>
          {showDirectionIndicator ? (
            <span
              className="absolute inset-0 flex translate-y-1 items-center opacity-0 transition-[opacity,transform] duration-300 ease-out group-hover/category-showcase-tile:translate-y-0 group-hover/category-showcase-tile:opacity-100 group-focus-within/category-showcase-tile:translate-y-0 group-focus-within/category-showcase-tile:opacity-100 motion-reduce:transform-none motion-reduce:transition-none"
              data-category-showcase-ordinal-arrow={item.slug}
            >
              <ArrowIcon />
            </span>
          ) : null}
        </span>
        <span
          aria-hidden="true"
          className="mt-1 block h-px w-5 origin-left bg-[color:var(--blue-500)] transition-[width] duration-300 ease-out group-hover/category-showcase-tile:w-10 group-focus-within/category-showcase-tile:w-10 motion-reduce:transition-none"
        />
        <div
          data-testid="category-showcase-title"
          data-category-title={item.slug}
          className="mt-3 min-w-0 text-[color:var(--category-showcase-title)] transition-colors duration-300 ease-out group-hover/category-showcase-tile:text-[color:var(--category-showcase-title-hover)] group-focus-within/category-showcase-tile:text-[color:var(--category-showcase-title-hover)] motion-reduce:transition-none"
        >
          {renderedTitle}
        </div>
      </div>

      {href ? (
        <Link
          href={href}
          prefetch={false}
          className="absolute inset-0 z-20 rounded-[12px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[color:var(--blue-500)]"
          aria-label={item.title}
          onClick={invokeItemHandlers}
        >
          <span className="sr-only">{item.title}</span>
        </Link>
      ) : null}

      {actions ? (
        <div data-testid="category-showcase-actions" className="pointer-events-none absolute inset-0 z-30 [&>*]:pointer-events-auto">
          {actions}
        </div>
      ) : null}
    </div>
  );
}

export function CategoryShowcase({
  items,
  columns,
  gap = 12,
  selectedSlug,
  interactive,
  showDirectionIndicator = true,
  className,
  gridClassName,
  tileClassName,
  style,
  emptyState = null,
  trailingContent = null,
  getHref,
  getTileClassName,
  getTileProps,
  onItemClick,
  onSelectItem,
  renderTitle,
  renderMedia,
  renderActions,
  renderTile
}: CategoryShowcaseProps) {
  const resolvedColumns = resolveColumns(columns);
  const imageSizes = resolveCategoryShowcaseImageSizes(resolvedColumns);
  const gridStyle = {
    '--category-showcase-columns-desktop': String(resolvedColumns.desktop),
    '--category-showcase-columns-tablet': String(resolvedColumns.tablet),
    '--category-showcase-columns-mobile': String(resolvedColumns.mobile),
    gap: typeof gap === 'number' ? `${gap}px` : gap
  } as CSSProperties & Record<string, string>;

  return (
    <div data-testid="category-showcase" className={className} style={style}>
      {items.length > 0 || trailingContent !== null ? (
        <div
          data-testid="category-showcase-grid"
          className={classNames(
            'grid grid-cols-[repeat(var(--category-showcase-columns-mobile),minmax(0,1fr))]',
            'min-[560px]:grid-cols-[repeat(var(--category-showcase-columns-tablet),minmax(0,1fr))]',
            'min-[1025px]:grid-cols-[repeat(var(--category-showcase-columns-desktop),minmax(0,1fr))]',
            gridClassName
          )}
          style={gridStyle}
        >
          {items.map((item, index) => {
            const href = getHref?.(item, index) ?? undefined;
            const selected = selectedSlug === item.slug;
            const presentation = normalizeCategoryShowcaseMediaSettings(item.presentation);
            const tile = (
              <CategoryTile
                item={item}
                index={index}
                presentation={presentation}
                imageSizes={imageSizes}
                href={href}
                selected={selected}
                interactive={interactive}
                showDirectionIndicator={showDirectionIndicator}
                className={classNames(tileClassName, getTileClassName?.(item, index))}
                tileProps={getTileProps?.(item, index)}
                onItemClick={onItemClick}
                onSelectItem={onSelectItem}
                renderTitle={renderTitle}
                renderMedia={renderMedia}
                renderActions={renderActions}
              />
            );

            if (!renderTile) return <Fragment key={item.id || item.slug}>{tile}</Fragment>;
            return (
              <Fragment key={item.id || item.slug}>
                {renderTile({
                  item,
                  index,
                  ordinal: index + 1,
                  selected,
                  href,
                  presentation,
                  tile
                })}
              </Fragment>
            );
          })}
          {trailingContent}
        </div>
      ) : emptyState}
    </div>
  );
}

export default CategoryShowcase;
