'use client';

import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { toCommercialStorefrontLogicalPx } from '@/commercial/components/commercialStorefrontScale';
import {
  getHomepagePreviewDeviceForViewport,
  resolveHomepageCategoryCardHeight,
  resolveHomepageSharedCategoryTitleCanvasSettings,
  type HomepageCanvasElementDeviceSettings,
  type HomepageCanvasSettings,
  type HomepageCategoriesSettings,
  type HomepagePreviewDevice
} from '@/shared/domain/landing/landingPage';
import { resolveWebsiteFontStack } from '@/shared/domain/style/fontFamilies';
import CategoryShowcase from '@/shared/features/category-showcase/CategoryShowcase';
import type { CategoryShowcaseItem } from '@/shared/features/category-showcase/categoryShowcaseSchema';

export type StorefrontCategoryShowcaseItem = CategoryShowcaseItem & {
  href: string;
};

const publicCategoryShowcaseStyle: CSSProperties = {
  zoom: toCommercialStorefrontLogicalPx(1)
};

function StorefrontCategoryTitle({
  title,
  settings
}: {
  title: string;
  settings: HomepageCanvasElementDeviceSettings;
}) {
  if (!settings.visible) return null;

  const hasExplicitSize = settings.widthPx > 0 || settings.heightPx > 0;
  const alignmentTranslate = settings.horizontalAlign === 'center'
    ? `calc(-50% + ${settings.offsetXPx}px)`
    : settings.horizontalAlign === 'right'
      ? `calc(-100% + ${settings.offsetXPx}px)`
      : `${settings.offsetXPx}px`;
  const left = settings.horizontalAlign === 'center'
    ? '50%'
    : settings.horizontalAlign === 'right'
      ? '100%'
      : 0;
  const style: CSSProperties = {
    position: 'relative',
    left,
    transform: `translate3d(${alignmentTranslate}, ${settings.offsetYPx}px, 0)`,
    width: settings.widthPx > 0 ? settings.widthPx : 'fit-content',
    maxWidth: settings.widthPx === 0 ? '20rem' : undefined,
    height: settings.heightPx > 0 ? settings.heightPx : undefined,
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
    color: 'inherit',
    fontFamily: resolveWebsiteFontStack(settings.fontFamily),
    fontSize: settings.fontSizePx,
    fontWeight: settings.fontWeight,
    fontStyle: settings.italic ? 'italic' : 'normal',
    textDecorationLine: settings.underline ? 'underline' : 'none',
    lineHeight: settings.lineHeight,
    letterSpacing: settings.letterSpacingPx,
    textAlign: settings.textAlign
  };

  return (
    <div
      data-storefront-shared-category-title
      className="group/canvas-element relative z-[2] min-w-0 box-border"
      style={style}
    >
      <h3
        className="site-heading-3 line-clamp-2 block min-h-[1em] whitespace-pre-wrap outline-none"
        style={{
          color: 'inherit',
          fontFamily: 'inherit',
          fontSize: 'inherit',
          fontWeight: 'inherit',
          fontStyle: 'inherit',
          lineHeight: 'inherit',
          letterSpacing: 'inherit',
          textAlign: 'inherit',
          textDecorationLine: 'inherit'
        }}
      >
        {title}
      </h3>
    </div>
  );
}

export default function StorefrontCategoryShowcase({
  categorySlug,
  items,
  settings,
  canvas
}: {
  categorySlug: string;
  items: StorefrontCategoryShowcaseItem[];
  settings: HomepageCategoriesSettings;
  canvas: HomepageCanvasSettings;
}) {
  const [device, setDevice] = useState<HomepagePreviewDevice>('desktop');

  useEffect(() => {
    const updateDevice = () => {
      setDevice(getHomepagePreviewDeviceForViewport(window.innerWidth));
    };

    updateDevice();
    window.addEventListener('resize', updateDevice);
    return () => window.removeEventListener('resize', updateDevice);
  }, []);

  const resolvedSettings = useMemo(
    () => ({ ...settings, ...settings.responsive[device] }),
    [device, settings]
  );
  const cardHeight = useMemo(
    () => resolveHomepageCategoryCardHeight(resolvedSettings, items),
    [items, resolvedSettings]
  );
  const titleSettings = useMemo(
    () => resolveHomepageSharedCategoryTitleCanvasSettings(canvas, device),
    [canvas, device]
  );
  const hrefBySlug = useMemo(
    () => new Map(items.map((item) => [item.slug, item.href])),
    [items]
  );

  return (
    <div data-storefront-subcategory-showcase={categorySlug}>
      <CategoryShowcase
        items={items}
        columns={resolvedSettings.columns}
        gap={resolvedSettings.gap}
        style={publicCategoryShowcaseStyle}
        showDirectionIndicator={resolvedSettings.showCardArrow}
        getHref={(item) => hrefBySlug.get(item.slug)}
        getTileProps={(item) => ({
          'data-storefront-subcategory-card': item.slug,
          style: { height: cardHeight }
        })}
        renderMedia={resolvedSettings.cardStyle === 'title-only'
          ? () => null
          : undefined}
        renderTitle={({ item }) => (
          <StorefrontCategoryTitle title={item.title} settings={titleSettings} />
        )}
      />
    </div>
  );
}
