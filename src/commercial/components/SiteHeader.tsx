'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import type { CSSProperties, FormEvent } from 'react';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useCartStore } from '@/commercial/cart/store';
import { toCommercialStorefrontLogicalPx } from '@/commercial/components/commercialStorefrontScale';
import { SiteLogo } from '@/commercial/components/SiteLogo';
import type { CatalogSearchItem } from '@/shared/domain/catalog/catalogTypes';
import type { SiteLogoPurposeId } from '@/shared/domain/logo/siteLogo';
import {
  DEFAULT_SITE_NAVIGATION_CONFIG,
  SITE_NAVIGATION_DESKTOP_COLUMN_COUNT,
  SITE_NAVIGATION_DESKTOP_DROPDOWN_ROW_GAP_PX,
  SITE_NAVIGATION_DESKTOP_LINK_ROWS,
  SITE_NAVIGATION_TOP_BAR_LOGO_WIDTH_PX,
  getVisibleSiteNavigationItems,
  getSiteNavigationDesktopGroupPlacements,
  normalizeSiteNavigationConfig,
  toSiteNavigationTopBarBackgroundCssColor,
  toSiteNavigationTopBarAppearanceCssVariables,
  type SiteNavigationConfig,
  type SiteNavigationGroup,
  type SiteNavigationItemIcon,
  type SiteNavigationLink,
  type SiteNavigationTopBarDevice,
  type SiteNavigationTopBarResponsiveItem,
  type SiteNavigationTopBarResponsiveSettings,
  type SiteNavigationTopBarSearchMode,
  type SiteNavigationTopLevelItem
} from '@/shared/domain/navigation/siteNavigation';
import { SiteNavigationLucideIcon } from '@/shared/ui/icons/SiteNavigationLucideIcon';
import { sharedIconTileBorderWidth } from '@/shared/ui/theme/tokens';

type MenuKey = string;
type DesktopMenuColumnSlot = {
  heading?: string;
  items: SiteNavigationLink[];
  sourceGroupId?: string;
  sourceSlotSpan?: number;
};
type DesktopMenuPage = {
  slots: DesktopMenuColumnSlot[];
  showDivider: boolean;
};

type MenuDirection = 'forward' | 'backward';
type MenuMotion = 'from-start' | 'from-end' | 'to-start' | 'to-end';
type CtaVariant = 'secondary' | 'ghost' | 'primary';
type TopBarCssProperties = CSSProperties & {
  '--site-content-max-width'?: string;
  '--site-gutter-min'?: string;
  '--site-gutter-max'?: string;
  '--site-gutter'?: string;
  '--topbar-height'?: string;
  '--topbar-inner-max-width'?: string;
  '--topbar-background'?: string;
  '--topbar-background-opacity'?: string;
  '--topbar-text-color'?: string;
  '--topbar-font-family'?: string;
  '--topbar-font-size'?: string;
  '--topbar-font-weight'?: string;
  '--topbar-font-style'?: string;
};

const desktopPanelId = 'site-desktop-mega-menu';
const mobileMenuId = 'site-mobile-menu';
const adminSiteNavigationPreviewEventName = 'admin-site-navigation-preview';
type AdminSiteNavigationPreviewEventDetail = {
  enabled: boolean;
  navigation?: SiteNavigationConfig;
  previewDevice?: SiteNavigationTopBarDevice;
  previewViewportWidth?: number;
};
type AdminSiteNavigationPreviewState = {
  navigation: SiteNavigationConfig;
  previewDevice?: SiteNavigationTopBarDevice;
  previewViewportWidth?: number;
};
const legacyDropdownFontFamily = 'Geist, "Geist Sans", ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
const coreNavTextRenderingStyle: CSSProperties = {
  fontFamily: 'var(--topbar-font-family)',
  fontStyle: 'var(--topbar-font-style)',
  WebkitFontSmoothing: 'antialiased',
  MozOsxFontSmoothing: 'grayscale'
};
const logoTextRenderingStyle: CSSProperties = {
  fontFamily: 'var(--site-font-body, "Noto Sans", Inter, system-ui, sans-serif)',
  fontSize: 'var(--site-font-size-body, 16px)',
  fontWeight: 'var(--site-font-weight-body, 400)',
  fontStyle: 'normal'
};
const dropdownTextRenderingStyle: CSSProperties = {
  fontFamily: legacyDropdownFontFamily,
  WebkitFontSmoothing: 'antialiased',
  MozOsxFontSmoothing: 'grayscale',
  textRendering: 'optimizeLegibility',
  willChange: 'auto'
};
const desktopDropdownGridStyle: CSSProperties = {
  gridTemplateColumns:
    'var(--navbar-dropdown-col-1-width) var(--navbar-dropdown-col-gap) var(--navbar-dropdown-col-2-width) var(--navbar-dropdown-divider-lane-width) var(--navbar-dropdown-col-gap) var(--navbar-dropdown-col-3-width)',
  gridTemplateRows: '100%',
  columnGap: 0
};
const desktopDropdownColumnGridStyle: CSSProperties = {
  gridTemplateRows:
    'var(--navbar-dropdown-heading-slot-height) var(--navbar-dropdown-heading-to-items-gap) auto'
};
const desktopDropdownColumnListStyle: CSSProperties = {
  gridTemplateRows: 'repeat(5, var(--navbar-dropdown-item-slot-height))',
  rowGap: 'var(--navbar-dropdown-row-gap)'
};
const desktopDropdownColumnListExpandedHoverStyle: CSSProperties = {
  marginLeft: 'calc(var(--navbar-dropdown-item-hover-x) * -1)',
  marginRight: 'calc(var(--navbar-dropdown-item-hover-x) * -1)'
};
const desktopDropdownColumnGridColumns = ['1', '3', '6'];
const navbarColorStyle = {
  '--navbar-link-default': '#4d4d4d',
  '--navbar-link-hover': '#171717',
  '--navbar-link-current': '#171717',
  '--navbar-trigger-open-bg': '#ebebeb',
  '--navbar-dropdown-heading': '#4d4d4d',
  '--navbar-dropdown-title': '#171717',
  '--navbar-dropdown-description': '#636363',
  '--navbar-dropdown-icon': '#4c4c4d',
  '--navbar-dropdown-border': '#e6e6e6',
  '--navbar-dropdown-border-hover': '#dcdcdc',
  '--navbar-dropdown-panel-width': '896px',
  '--navbar-dropdown-panel-height':
    'calc(var(--navbar-dropdown-panel-padding) * 2 + var(--navbar-dropdown-heading-slot-height) + var(--navbar-dropdown-heading-to-items-gap) + var(--navbar-dropdown-item-slot-height) * 5 + var(--navbar-dropdown-row-gap) * 4)',
  '--navbar-dropdown-panel-padding': '28px',
  '--navbar-dropdown-icon-tile-size': '41px',
  '--navbar-dropdown-icon-size': '18px',
  '--navbar-dropdown-icon-tile-border-width': sharedIconTileBorderWidth,
  '--navbar-dropdown-title-font-size': '18px',
  '--navbar-dropdown-title-line-height': '21px',
  '--navbar-dropdown-description-font-size': '16px',
  '--navbar-dropdown-description-line-height': '20px',
  '--navbar-dropdown-heading-font-size': '16px',
  '--navbar-dropdown-heading-line-height': '22px',
  '--navbar-dropdown-heading-slot-height': '22px',
  '--navbar-dropdown-heading-to-items-gap': '16px',
  '--navbar-dropdown-item-slot-height': 'var(--navbar-dropdown-icon-tile-size)',
  '--navbar-dropdown-row-gap': `${SITE_NAVIGATION_DESKTOP_DROPDOWN_ROW_GAP_PX}px`,
  '--navbar-dropdown-item-content-gap': '14px',
  '--navbar-dropdown-item-hover-x': '8px',
  '--navbar-dropdown-item-hover-y': '6px',
  '--navbar-dropdown-col-1-width': '265px',
  '--navbar-dropdown-col-2-width': '285px',
  '--navbar-dropdown-col-3-width': '241px',
  '--navbar-dropdown-col-gap': '24px',
  '--navbar-dropdown-divider-lane-width': '1px'
} as CSSProperties & Record<string, string>;
const coreNavTextClassName =
  '[font-size:calc(var(--topbar-font-size)/var(--commercial-storefront-scale))] [font-weight:var(--topbar-font-weight)] [font-style:var(--topbar-font-style)] leading-[1.4286]';
const compactNavbarControlSizePx = toCommercialStorefrontLogicalPx(32);
const compactNavbarControlStyle = {
  width: `${compactNavbarControlSizePx}px`,
  minWidth: `${compactNavbarControlSizePx}px`,
  height: `${compactNavbarControlSizePx}px`
} satisfies CSSProperties;
const publicNavNoFocusOutlineClassName =
  'focus:outline-none focus:ring-0 focus-visible:outline-none focus-visible:ring-0';
const publicDropdownSelectionClassName =
  `transition hover:bg-[color:var(--hover-neutral)] active:bg-[color:var(--hover-neutral)] focus:bg-[color:var(--hover-neutral)] focus:outline-none focus:ring-0 focus-visible:bg-[color:var(--hover-neutral)] focus-visible:outline-none focus-visible:ring-0`;
const publicDropdownIconTileInteractionClassName =
  'group-hover:border-transparent group-hover:text-[color:var(--blue-500)] group-hover:[outline:1px_solid_currentColor] group-hover:[outline-offset:-1px] group-focus:border-transparent group-focus:text-[color:var(--blue-500)] group-focus:[outline:1px_solid_currentColor] group-focus:[outline-offset:-1px] group-focus-visible:border-transparent group-focus-visible:text-[color:var(--blue-500)] group-focus-visible:[outline:1px_solid_currentColor] group-focus-visible:[outline-offset:-1px] group-active:border-transparent group-active:text-[color:var(--blue-500)] group-active:[outline:1px_solid_currentColor] group-active:[outline-offset:-1px]';
const publicCoreNavInteractiveClassName =
  `transition hover:text-[var(--navbar-link-hover)] focus:text-[color:var(--blue-500)] focus-visible:text-[color:var(--blue-500)] ${publicNavNoFocusOutlineClassName}`;
const publicCoreNavOpenClassName =
  `transition text-[color:var(--blue-500)] hover:text-[color:var(--blue-500)] focus:text-[color:var(--blue-500)] focus-visible:text-[color:var(--blue-500)] ${publicNavNoFocusOutlineClassName}`;


const ctas: Array<{ label: string; href: string; variant: CtaVariant }> = [
  { label: 'Vprašaj AI', href: '/contact', variant: 'secondary' }
];

function sortTopBarPlacementItems(items: SiteNavigationTopBarResponsiveItem[]) {
  return [...items].sort((first, second) => {
    const xDelta = first.xPx - second.xPx;
    return xDelta === 0 ? first.zIndex - second.zIndex : xDelta;
  });
}

function isCompactTopBarPlacementItem(item: SiteNavigationTopBarResponsiveItem) {
  return item.id === 'navigation' || item.id === 'logo' || item.id === 'cart';
}

function isRenderedTopBarPlacementItem(
  item: SiteNavigationTopBarResponsiveItem,
  activeDevice: SiteNavigationTopBarDevice
) {
  if (!item.visible) return false;
  if (activeDevice === 'mobile') return isCompactTopBarPlacementItem(item);
  return true;
}

function getTopBarItemRenderedWidthPx(
  item: SiteNavigationTopBarResponsiveItem,
  activeDevice: SiteNavigationTopBarDevice,
  settings: SiteNavigationTopBarResponsiveSettings
) {
  if (item.id === 'logo') {
    return Math.max(item.widthPx, item.fixedWidthPx ?? 0, SITE_NAVIGATION_TOP_BAR_LOGO_WIDTH_PX);
  }

  if (item.id === 'navigation' && (activeDevice === 'mobile' || settings.navigationMode === 'hamburger')) {
    return 32;
  }

  return item.widthPx;
}

function getTopBarItemLayoutStyle(
  item: SiteNavigationTopBarResponsiveItem,
  activeDevice: SiteNavigationTopBarDevice,
  settings: SiteNavigationTopBarResponsiveSettings
): CSSProperties {
  const leftPercent = Math.max(0, Math.min(1, item.xRatio)) * 100;
  const itemWidthPx = getTopBarItemRenderedWidthPx(item, activeDevice, settings);
  const logicalWidthPx = toCommercialStorefrontLogicalPx(itemWidthPx);

  return {
    position: 'absolute',
    ...(item.region === 'edgeRight'
      ? { left: 'auto', right: 0 }
      : { left: `min(${leftPercent}%, calc(100% - ${logicalWidthPx}px))` }),
    top: '50%',
    zIndex: item.zIndex,
    width: `${logicalWidthPx}px`,
    transform: 'translateY(-50%)'
  };
}

const normalizeSearchValue = (value: string) =>
  value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

let navbarSearchItemsCache: CatalogSearchItem[] | null = null;
let navbarSearchItemsPromise: Promise<CatalogSearchItem[]> | null = null;

async function loadNavbarSearchItems(): Promise<CatalogSearchItem[]> {
  if (navbarSearchItemsCache) return navbarSearchItemsCache;

  if (!navbarSearchItemsPromise) {
    navbarSearchItemsPromise = fetch('/api/catalog/search', { cache: 'force-cache' })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(`Failed to load catalog search items: ${response.status}`);
        }

        const payload = (await response.json()) as { items?: CatalogSearchItem[] };
        navbarSearchItemsCache = Array.isArray(payload.items) ? payload.items : [];
        return navbarSearchItemsCache;
      })
      .catch((error) => {
        navbarSearchItemsPromise = null;
        throw error;
      });
  }

  return navbarSearchItemsPromise;
}

function LegacyBrand() {
  return (
    <span className="inline-flex items-center gap-2 text-black">
      <span className="inline-flex h-6 w-6 items-center justify-center rounded-[5px] bg-black text-[15px] font-semibold leading-none text-white">
        A
      </span>
      <span className="text-[23px] font-semibold leading-none tracking-normal">Atehna</span>
    </span>
  );
}

const headerLogoClassNames: Record<SiteNavigationTopBarDevice, string> = {
  desktop: 'h-6 w-[88px]',
  tablet: 'h-[22px] w-[72px]',
  mobile: 'h-5 w-14'
};

function Brand({ device }: { device: SiteNavigationTopBarDevice }) {
  const purposeId = `header-${device}` as SiteLogoPurposeId;
  return (
    <SiteLogo
      purposeId={purposeId}
      fallback={<LegacyBrand />}
      className={headerLogoClassNames[device]}
      alt="Atehna"
    />
  );
}

function ChevronIcon({ open, subtle = false }: { open: boolean; subtle?: boolean }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 16 16"
      className={`block shrink-0 self-center ${subtle ? 'h-4 w-4' : 'h-[18px] w-[18px]'} transition duration-150 ${
        open ? `rotate-180 ${subtle ? 'opacity-70' : 'opacity-100'}` : subtle ? 'opacity-50' : 'opacity-60'
      }`}
      fill="none"
    >
      <path
        d="m4 6 4 4 4-4"
        stroke="currentColor"
        strokeWidth={subtle ? '1.5' : '1.6'}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function MenuIcon({ open }: { open: boolean }) {
  return (
    <span
      aria-hidden="true"
      className="relative h-[21px] w-[21px]"
    >
      <span
        className={`absolute left-0 top-1 h-px w-[21px] bg-current transition duration-150 ${
          open ? 'translate-y-[7px] rotate-45' : ''
        }`}
      />
      <span
        className={`absolute left-0 top-[11px] h-px w-[21px] bg-current transition duration-150 ${
          open ? 'opacity-0' : ''
        }`}
      />
      <span
        className={`absolute left-0 top-[18px] h-px w-[21px] bg-current transition duration-150 ${
          open ? '-translate-y-[7px] -rotate-45' : ''
        }`}
      />
    </span>
  );
}

function createEmptyDesktopMenuSlots(): DesktopMenuColumnSlot[] {
  return [
    { items: [] },
    { items: [] },
    { items: [] }
  ];
}

function createDesktopMenuPageFromGroups(groups: SiteNavigationGroup[]): DesktopMenuPage {
  const slots = createEmptyDesktopMenuSlots();
  const placements = getSiteNavigationDesktopGroupPlacements(groups);

  for (const group of groups) {
    const placement = placements[group.id];
    if (!placement) continue;

    for (let offset = 0; offset < placement.slotSpan && placement.slotIndex + offset < slots.length; offset += 1) {
      slots[placement.slotIndex + offset] = {
        heading: offset === 0 ? group.label : undefined,
        items: group.links.slice(offset * SITE_NAVIGATION_DESKTOP_LINK_ROWS, offset * SITE_NAVIGATION_DESKTOP_LINK_ROWS + SITE_NAVIGATION_DESKTOP_LINK_ROWS),
        sourceGroupId: group.id,
        sourceSlotSpan: placement.slotSpan
      };
    }
  }

  const showDivider = slots.some((slot, index) =>
    index < SITE_NAVIGATION_DESKTOP_COLUMN_COUNT - 1 &&
    slot.sourceGroupId &&
    slot.sourceGroupId === slots[index + 1]?.sourceGroupId &&
    slots.slice(index + 2).some((nextSlot) => nextSlot.items.length > 0)
  );

  return { slots, showDivider };
}

function createDesktopMenuPages(menuItem: SiteNavigationTopLevelItem): DesktopMenuPage[] {
  const placements = getSiteNavigationDesktopGroupPlacements(menuItem.groups);
  const groupedPages = new Map<number, SiteNavigationGroup[]>();

  for (const group of menuItem.groups) {
    const pageIndex = placements[group.id]?.pageIndex ?? 0;
    const pageGroups = groupedPages.get(pageIndex) ?? [];
    pageGroups.push(group);
    groupedPages.set(pageIndex, pageGroups);
  }

  if (groupedPages.size === 0) return [{ slots: createEmptyDesktopMenuSlots(), showDivider: false }];

  return [...groupedPages.entries()]
    .sort(([firstPage], [secondPage]) => firstPage - secondPage)
    .map(([, groups]) => createDesktopMenuPageFromGroups(groups));
}

function DesktopMenuPageControls({
  pageIndex,
  pageCount,
  onPageChange
}: {
  pageIndex: number;
  pageCount: number;
  onPageChange: (pageIndex: number) => void;
}) {
  if (pageCount <= 1) return null;

  const pagerButtonClassName =
    'inline-grid h-6 w-6 place-items-center rounded-md text-[var(--navbar-dropdown-description)] transition hover:text-[color:var(--blue-500)] focus:text-[color:var(--blue-500)] focus:outline-none focus:ring-0 focus-visible:text-[color:var(--blue-500)] focus-visible:outline-none focus-visible:ring-0 disabled:pointer-events-none disabled:text-slate-300';

  return (
    <div className="absolute bottom-3 right-4 z-10 flex items-center gap-1 text-[13px] text-[var(--navbar-dropdown-description)]">
      <button
        type="button"
        aria-label="Prejšnja stran dropdowna"
        disabled={pageIndex === 0}
        onClick={(event) => {
          event.stopPropagation();
          onPageChange(Math.max(0, pageIndex - 1));
        }}
        className={pagerButtonClassName}
      >
        <svg viewBox="0 0 20 20" aria-hidden="true" className="h-4 w-4">
          <path d="M12.5 4.5 7 10l5.5 5.5" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.7" />
        </svg>
      </button>
      <span className="min-w-9 text-center text-[12px] font-medium leading-6 text-[var(--navbar-dropdown-description)]">
        {pageIndex + 1} / {pageCount}
      </span>
      <button
        type="button"
        aria-label="Naslednja stran dropdowna"
        disabled={pageIndex >= pageCount - 1}
        onClick={(event) => {
          event.stopPropagation();
          onPageChange(Math.min(pageCount - 1, pageIndex + 1));
        }}
        className={pagerButtonClassName}
      >
        <svg viewBox="0 0 20 20" aria-hidden="true" className="h-4 w-4">
          <path d="m7.5 4.5 5.5 5.5-5.5 5.5" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.7" />
        </svg>
      </button>
    </div>
  );
}

function MenuItemGlyph({ icon, size = 'default' }: { icon: SiteNavigationItemIcon; size?: 'default' | 'desktopDropdown' }) {
  const usesDesktopDropdownSize = size === 'desktopDropdown';

  return (
    <span
      style={{ borderWidth: 'var(--navbar-dropdown-icon-tile-border-width)' }}
      className={`grid shrink-0 place-items-center rounded-md border border-[var(--navbar-dropdown-border)] bg-white text-[#111111] transition ${publicDropdownIconTileInteractionClassName} ${
        usesDesktopDropdownSize ? 'h-[var(--navbar-dropdown-icon-tile-size)] w-[var(--navbar-dropdown-icon-tile-size)]' : 'h-8 w-8'
      }`}
    >
      <SiteNavigationLucideIcon icon={icon} className={usesDesktopDropdownSize ? 'h-[18px] w-[18px]' : 'h-4 w-4'} strokeWidth={usesDesktopDropdownSize ? 1.75 : 1.6} />
    </span>
  );
}

function DesktopMenuContent({
  menuItem,
  onNavigate,
  pageIndex,
  onPageChange,
  motion,
  isExiting = false
}: {
  menuItem: SiteNavigationTopLevelItem;
  onNavigate: () => void;
  pageIndex: number;
  onPageChange?: (pageIndex: number) => void;
  motion?: MenuMotion;
  isExiting?: boolean;
}) {
  const motionClass = motion ? `site-menu-content-${motion}` : '';
  const pages = createDesktopMenuPages(menuItem);
  const resolvedPageIndex = Math.min(Math.max(pageIndex, 0), pages.length - 1);
  const { slots: columns, showDivider } = pages[resolvedPageIndex] ?? pages[0];

  return (
    <div
      key={menuItem.id}
      aria-hidden={isExiting}
      style={{
        ...dropdownTextRenderingStyle,
        ...desktopDropdownGridStyle,
        padding: 'var(--navbar-dropdown-panel-padding)'
      }}
      className={`site-menu-content grid h-full ${motionClass} ${
        isExiting ? 'pointer-events-none absolute inset-0' : 'relative'
      }`}
    >
      {columns.map((column, index) => {
        const headingId = column.heading ? `${menuItem.id}-desktop-column-${index + 1}` : undefined;

        return (
          <section
            key={`${menuItem.id}-desktop-column-${index + 1}`}
            aria-labelledby={headingId}
            style={{
              ...desktopDropdownColumnGridStyle,
              gridColumn: desktopDropdownColumnGridColumns[index]
            }}
            className="grid min-w-0"
          >
            {column.heading ? (
              <h2
                id={headingId}
                className="m-0 whitespace-nowrap p-0 [font-size:var(--navbar-dropdown-heading-font-size)] font-normal [line-height:var(--navbar-dropdown-heading-line-height)] text-[var(--navbar-dropdown-heading)]"
              >
                {column.heading}
              </h2>
            ) : (
              <div aria-hidden="true" />
            )}
            <ul style={{ ...desktopDropdownColumnListStyle, ...desktopDropdownColumnListExpandedHoverStyle }} className="row-start-3 grid min-w-0">
              {column.items.map((item) => (
                <li key={item.id}>
                  <Link
                    href={item.href}
                    prefetch={false}
                    onClick={onNavigate}
                    className={`group grid h-[calc(var(--navbar-dropdown-item-slot-height)+var(--navbar-dropdown-item-hover-y)*2)] w-full -translate-y-[var(--navbar-dropdown-item-hover-y)] grid-cols-[var(--navbar-dropdown-icon-tile-size)_1fr] items-center gap-[var(--navbar-dropdown-item-content-gap)] rounded-lg px-[var(--navbar-dropdown-item-hover-x)] ${publicDropdownSelectionClassName}`}
                  >
                    <MenuItemGlyph icon={item.icon} size="desktopDropdown" />
                    <span className="flex h-[var(--navbar-dropdown-icon-tile-size)] min-w-0 flex-col justify-between">
                      <span className="m-0 block whitespace-nowrap [font-size:var(--navbar-dropdown-title-font-size)] font-medium [line-height:var(--navbar-dropdown-title-line-height)] text-[var(--navbar-dropdown-title)]">
                        {item.label}
                      </span>
                      <span className="m-0 block whitespace-nowrap [font-size:var(--navbar-dropdown-description-font-size)] font-normal [line-height:var(--navbar-dropdown-description-line-height)] text-[var(--navbar-dropdown-description)]">
                        {item.description}
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
      <div
        aria-hidden="true"
        style={{ gridColumn: '4', gridRow: '1', width: 'var(--navbar-dropdown-divider-lane-width)' }}
        className={showDivider ? 'h-full bg-[#eaeaea]' : 'h-full bg-transparent'}
      />
      {!isExiting && onPageChange ? (
        <DesktopMenuPageControls pageIndex={resolvedPageIndex} pageCount={pages.length} onPageChange={onPageChange} />
      ) : null}
    </div>
  );
}

function MobileAccordion({
  item,
  open,
  onToggle,
  onNavigate
}: {
  item: SiteNavigationTopLevelItem;
  open: boolean;
  onToggle: () => void;
  onNavigate: () => void;
}) {
  const panelId = `site-mobile-${item.id}-panel`;

  return (
    <div className="border-b border-[#eeeeee]">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={onToggle}
        className={`flex w-full items-center justify-between px-[27px] py-[21px] text-left text-xl font-medium text-[#111111] ${publicDropdownSelectionClassName}`}
      >
        <span>{item.label}</span>
        <ChevronIcon open={open} />
      </button>
      {open ? (
        <div id={panelId} className="pb-4">
          {item.groups.map((group) => (
            <section
              key={group.id}
              className="px-[27px] pb-4"
            >
              <h2 className="pb-[5px] text-base font-medium uppercase tracking-normal text-[var(--navbar-dropdown-heading)]">
                {group.label}
              </h2>
              <ul className="space-y-[5px]">
                {group.links.map((link) => (
                  <li key={link.id}>
                    <Link
                    href={link.href}
                    prefetch={false}
                    onClick={onNavigate}
                      className={`group grid min-h-[82px] grid-cols-[43px_1fr] items-center gap-[13px] rounded-lg px-3 py-[9px] ${publicDropdownSelectionClassName}`}
                    >
                      <MenuItemGlyph icon={link.icon} />
                      <span className="block min-w-0">
                        <span className="block text-[19px] font-medium leading-[24px] text-[var(--navbar-dropdown-title)]">
                          {link.label}
                        </span>
                        {link.description ? (
                          <span className="mt-[3px] block text-[17px] leading-[23px] text-[var(--navbar-dropdown-description)]">
                            {link.description}
                          </span>
                        ) : null}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function SearchGlyph({ className = 'h-[22px] w-[22px]' }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M10.8 18.1a7.3 7.3 0 1 0 0-14.6 7.3 7.3 0 0 0 0 14.6Z" />
      <path d="m16.1 16.1 4.4 4.4" />
    </svg>
  );
}

function SparklesGlyph({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 20 20"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M10.5 2.8 11.7 7l4.1 1.2-4.1 1.2-1.2 4.1-1.2-4.1-4.1-1.2L9.3 7l1.2-4.2Z" />
      <path d="m4.2 12.8.5 1.7 1.7.5-1.7.5-.5 1.7-.5-1.7-1.7-.5 1.7-.5.5-1.7Z" />
      <path d="m15.2 13 .4 1.2 1.2.4-1.2.4-.4 1.2-.4-1.2-1.2-.4 1.2-.4.4-1.2Z" />
    </svg>
  );
}

function CartGlyph() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="h-[27px] w-[27px]"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M3.5 4.8h2.2l1.8 10.1h9.7l2-7.1H7.2" />
      <path d="M8.2 19.1h.1" />
      <path d="M16.5 19.1h.1" />
    </svg>
  );
}

function getNavbarSearchResults(items: CatalogSearchItem[], query: string) {
  const normalizedQuery = normalizeSearchValue(query);

  if (!normalizedQuery) return [];

  const tokens = normalizedQuery.split(' ').filter(Boolean);

  return items
    .map((item) => ({
      ...item,
      haystack: normalizeSearchValue(`${item.name} ${item.description}`)
    }))
    .filter((item) => tokens.every((token) => item.haystack.includes(token)))
    .slice(0, 5);
}

function NavbarSearch({
  mobile = false,
  mode = 'icon',
  onNavigate
}: {
  mobile?: boolean;
  mode?: SiteNavigationTopBarSearchMode;
  onNavigate: () => void;
}) {
  const router = useRouter();
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');
  const [items, setItems] = useState<CatalogSearchItem[]>(() => navbarSearchItemsCache ?? []);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const inputId = mobile ? 'site-mobile-search' : 'site-desktop-search';
  const results = getNavbarSearchResults(items, query);
  const hasQuery = normalizeSearchValue(query).length > 0;
  const desktopFieldMode = !mobile && mode === 'field';
  const desktopExpanded = desktopFieldMode || expanded;

  const ensureItemsLoaded = () => {
    if (navbarSearchItemsCache) {
      setItems(navbarSearchItemsCache);
      return Promise.resolve(navbarSearchItemsCache);
    }

    setLoading(true);
    return loadNavbarSearchItems()
      .then((nextItems) => {
        setItems(nextItems);
        return nextItems;
      })
      .catch(() => {
        setItems([]);
        return [];
      })
      .finally(() => setLoading(false));
  };

  const openExpandedSearch = () => {
    setExpanded(true);
    setOpen(true);
    void ensureItemsLoaded();
    window.requestAnimationFrame(() => inputRef.current?.focus());
  };

  useEffect(() => {
    if (mobile || desktopFieldMode || !expanded) return undefined;

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target;

      if (!(target instanceof Node)) {
        return;
      }

      if (!rootRef.current?.contains(target) && !query) {
        setOpen(false);
        setExpanded(false);
      }
    };

    document.addEventListener('pointerdown', handlePointerDown);

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
    };
  }, [desktopFieldMode, expanded, mobile, query]);

  const closeOrClearSearch = () => {
    if (query) {
      setQuery('');
      setOpen(false);
      return;
    }

    setOpen(false);
    setExpanded(false);
  };

  const submitSearch = async () => {
    if (!hasQuery) {
      closeOrClearSearch();
      return;
    }

    const nextItems = items.length > 0 ? items : await ensureItemsLoaded();
    const firstResult = getNavbarSearchResults(nextItems, query)[0];

    if (firstResult) {
      setOpen(false);
      setExpanded(false);
      onNavigate();
      router.push(firstResult.href);
      return;
    }

    setOpen(true);
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void submitSearch();
  };

  return (
    <div
      ref={rootRef}
        className={
          mobile
            ? 'relative'
          : desktopFieldMode
            ? 'relative flex h-[43px] w-full min-w-[240px] shrink-0 justify-end'
            : 'relative flex shrink-0 items-center justify-end'
      }
      style={!mobile && !desktopFieldMode ? compactNavbarControlStyle : undefined}
    >
      {!mobile && !desktopFieldMode ? (
        <button
          type="button"
          aria-label="Išči"
          aria-hidden={desktopExpanded}
          tabIndex={desktopExpanded ? -1 : 0}
          onClick={openExpandedSearch}
          onFocus={openExpandedSearch}
          className={`inline-flex items-center justify-center rounded-lg text-[var(--navbar-link-default)] transition duration-150 hover:bg-[var(--navbar-trigger-open-bg)] hover:text-[var(--navbar-link-hover)] ${
            desktopExpanded ? 'pointer-events-none opacity-0' : 'opacity-100'
          }`}
          style={compactNavbarControlStyle}
        >
          <SearchGlyph className="h-[24.3px] w-[24.3px]" />
        </button>
      ) : null}

      <form
        role="search"
        aria-hidden={!mobile && !desktopExpanded}
        onSubmit={handleSubmit}
        style={mobile ? undefined : coreNavTextRenderingStyle}
        className={
          mobile
            ? 'relative w-full'
            : desktopFieldMode
              ? 'relative z-30 w-full'
              : `absolute right-0 top-1/2 z-30 w-[320px] -translate-y-1/2 transition-opacity duration-150 ease-out ${
                  desktopExpanded ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0'
                }`
        }
      >
        <label htmlFor={inputId} className="sr-only">
          Išči
        </label>
        <SearchGlyph className="pointer-events-none absolute left-[13px] top-1/2 h-[21px] w-[21px] -translate-y-1/2 text-[var(--navbar-link-default)]" />
        <input
          ref={inputRef}
          id={inputId}
          type="search"
          tabIndex={!mobile && !desktopExpanded ? -1 : undefined}
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setOpen(true);
            void ensureItemsLoaded();
          }}
          onFocus={() => {
            setOpen(true);
            void ensureItemsLoaded();
          }}
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              event.preventDefault();
              closeOrClearSearch();
            } else if (event.key === 'Enter') {
              event.preventDefault();
              void submitSearch();
            }
          }}
          aria-label="Išči"
          placeholder="Išči"
          className={
            mobile
              ? 'h-10 w-full rounded-lg border border-[#eaeaea] bg-white pl-[38px] pr-3 text-[17px] font-medium leading-none text-[#111111] outline-none transition placeholder:text-[#737373] hover:border-[#dedede] focus:border-[#111111] focus:bg-white focus:ring-0 focus:shadow-none'
              : `site-topbar-typography-input h-[43px] w-full appearance-none rounded-lg border border-[color:var(--blue-500)] bg-white pl-[38px] pr-3 ${coreNavTextClassName} text-[var(--navbar-link-current)] shadow-none [box-shadow:none] [outline:0] [outline-offset:0] transition-colors placeholder:text-[var(--navbar-dropdown-description)] hover:border-[color:var(--blue-500)] focus:border-[color:var(--blue-500)] focus:bg-white focus:shadow-none focus:ring-0 focus:[box-shadow:none] focus:[outline:0] focus:[outline-offset:0] focus-visible:border-[color:var(--blue-500)] focus-visible:shadow-none focus-visible:ring-0 focus-visible:[box-shadow:none] focus-visible:[outline:0] focus-visible:[outline-offset:0]`
          }
        />
        {open && hasQuery ? (
          <div className="absolute left-0 right-0 top-full z-40 mt-2 overflow-hidden rounded-lg border border-[#dedede] bg-white py-1 shadow-[0_12px_32px_rgba(0,0,0,0.08),0_2px_8px_rgba(0,0,0,0.04)]">
            {loading && items.length === 0 ? (
              <p className="px-3 py-2 text-[13px] font-medium text-[#666666]">Nalagam ...</p>
            ) : results.length > 0 ? (
              results.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  prefetch={false}
                  onClick={() => {
                    setOpen(false);
                    setExpanded(false);
                    onNavigate();
                  }}
                  className="block px-3 py-2 text-[13px] transition hover:bg-[#f5f5f5] focus-visible:bg-[#f5f5f5]"
                >
                  <span className="block truncate font-medium text-[#111111]">{item.name}</span>
                  <span className="block truncate text-[#666666]">{item.description}</span>
                </Link>
              ))
            ) : (
              <p className="px-3 py-2 text-[13px] font-medium text-[#666666]">Ni zadetkov.</p>
            )}
          </div>
        ) : null}
      </form>
    </div>
  );
}

function NavbarCartControl() {
  const cartItemCount = useCartStore((state) => state.getItemCount());
  const openDrawer = useCartStore((state) => state.openDrawer);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const visibleCount = isMounted && cartItemCount > 0 ? cartItemCount : 0;

  return (
    <button
      type="button"
      onClick={openDrawer}
      aria-label={visibleCount > 0 ? `Košarica, ${visibleCount} izdelki` : 'Košarica'}
      className="relative inline-flex shrink-0 items-center justify-center rounded-lg text-[var(--navbar-link-default)] transition hover:bg-[var(--navbar-trigger-open-bg)] hover:text-[var(--navbar-link-hover)]"
      style={{
        width: toCommercialStorefrontLogicalPx(32),
        height: toCommercialStorefrontLogicalPx(32)
      }}
    >
      <CartGlyph />
      {visibleCount > 0 ? (
        <span className="absolute right-[-5px] top-[-5px] inline-flex h-[21px] min-w-[21px] items-center justify-center rounded-full bg-black px-[5px] text-[14px] font-bold leading-[21px] text-white">
          {visibleCount}
        </span>
      ) : null}
    </button>
  );
}

function DesktopCta({
  label,
  href,
  variant,
  onNavigate
}: {
  label: string;
  href: string;
  variant: CtaVariant;
  onNavigate: () => void;
}) {
  const className =
    variant === 'primary'
      ? 'h-[43px] rounded-lg bg-black px-4 text-white hover:bg-[#1f1f1f]'
      : 'h-[43px] gap-1.5 rounded-lg border border-[var(--navbar-dropdown-border)] bg-white px-3 text-[var(--navbar-link-default)] hover:border-transparent hover:text-[color:var(--blue-500)] hover:[outline:1px_solid_currentColor] hover:[outline-offset:-1px] focus-visible:border-transparent focus-visible:text-[color:var(--blue-500)] focus-visible:[outline:1px_solid_currentColor] focus-visible:[outline-offset:-1px]';

  return (
    <Link
      href={href}
      prefetch={false}
      onClick={onNavigate}
      style={coreNavTextRenderingStyle}
      className={`inline-flex w-full items-center justify-center whitespace-nowrap ${coreNavTextClassName} transition focus-visible:outline-none focus-visible:ring-0 ${className}`}
    >
      {variant === 'secondary' ? <SparklesGlyph /> : null}
      <span>{label}</span>
    </Link>
  );
}

type SiteHeaderProps = {
  navigation?: SiteNavigationConfig;
  previewMode?: 'normal' | 'inline';
  previewDevice?: SiteNavigationTopBarDevice;
  previewViewportWidth?: number;
};

function resolveTopBarDeviceForViewportWidth(
  navigation: SiteNavigationConfig,
  viewportWidth: number | null
): SiteNavigationTopBarDevice {
  if (viewportWidth === null) return 'desktop';

  const mobileBreakpointTo = navigation.topBarLayout.responsive.mobile.settings.breakpointTo ?? 767;
  const tabletBreakpointTo = navigation.topBarLayout.responsive.tablet.settings.breakpointTo ?? 1024;

  if (viewportWidth <= mobileBreakpointTo) return 'mobile';
  if (viewportWidth <= tabletBreakpointTo) return 'tablet';

  return 'desktop';
}

export default function SiteHeader({
  navigation = DEFAULT_SITE_NAVIGATION_CONFIG,
  previewMode = 'normal',
  previewDevice,
  previewViewportWidth
}: SiteHeaderProps) {
  const pathname = usePathname();
  const headerRef = useRef<HTMLElement>(null);
  const katalogLabelRef = useRef<HTMLSpanElement>(null);
  const switchTimerRef = useRef<number | null>(null);
  const closeTimerRef = useRef<number | null>(null);
  const activeMenuRef = useRef<MenuKey | null>(null);
  const previousActiveMenuRef = useRef<MenuKey | null>(null);
  const [activeMenu, setActiveMenu] = useState<MenuKey | null>(null);
  const [previousMenu, setPreviousMenu] = useState<MenuKey | null>(null);
  const [menuDirection, setMenuDirection] = useState<MenuDirection | null>(null);
  const [isMenuClosing, setIsMenuClosing] = useState(false);
  const [desktopMenuPageById, setDesktopMenuPageById] = useState<Record<MenuKey, number>>({});
  const [dropdownPanelLeft, setDropdownPanelLeft] = useState(0);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [openMobileMenus, setOpenMobileMenus] = useState<MenuKey[]>([]);
  const [adminPreview, setAdminPreview] = useState<AdminSiteNavigationPreviewState | null>(null);
  const isAdminPath = pathname.startsWith('/admin');
  const isInlinePreview = previewMode === 'inline';
  const effectiveNavigation = isInlinePreview ? navigation : adminPreview?.navigation ?? navigation;
  const effectivePreviewDevice = isInlinePreview ? previewDevice : adminPreview?.previewDevice;
  const effectivePreviewViewportWidth = isInlinePreview ? previewViewportWidth : adminPreview?.previewViewportWidth;
  const isAdminNavbarPreview = isInlinePreview || (isAdminPath && adminPreview !== null);
  const [measuredViewportWidth, setMeasuredViewportWidth] = useState<number | null>(null);
  const normalizedNavigation = useMemo(
    () => normalizeSiteNavigationConfig(effectiveNavigation),
    [effectiveNavigation]
  );
  const resolvedViewportWidth =
    typeof effectivePreviewViewportWidth === 'number' ? effectivePreviewViewportWidth : measuredViewportWidth;
  const activeTopBarDevice = useMemo(
    () => effectivePreviewDevice ?? resolveTopBarDeviceForViewportWidth(normalizedNavigation, resolvedViewportWidth),
    [effectivePreviewDevice, normalizedNavigation, resolvedViewportWidth]
  );
  const activeTopBarLayout = normalizedNavigation.topBarLayout.responsive[activeTopBarDevice];
  const usesCompactTopBar =
    activeTopBarDevice === 'mobile' || activeTopBarLayout.settings.navigationMode === 'hamburger';
  const navigationItems = useMemo(
    () => getVisibleSiteNavigationItems(normalizedNavigation),
    [normalizedNavigation]
  );
  const siteLayout = normalizedNavigation.siteLayout;
  const activeTopBarPlacementItems = useMemo(
    () =>
      sortTopBarPlacementItems(
        activeTopBarLayout.items.filter((item) => isRenderedTopBarPlacementItem(item, activeTopBarDevice))
      ),
    [activeTopBarDevice, activeTopBarLayout.items]
  );
  const topBarShellStyle = useMemo<TopBarCssProperties>(() => {
    const logicalSiteContentMaxWidthPx = toCommercialStorefrontLogicalPx(siteLayout.siteContentMaxWidthPx);
    const logicalSiteGutterMinPx = toCommercialStorefrontLogicalPx(siteLayout.siteGutterMinPx);
    const logicalSiteGutterMaxPx = toCommercialStorefrontLogicalPx(siteLayout.siteGutterMaxPx);
    const logicalTopBarPaddingPx = toCommercialStorefrontLogicalPx(
      activeTopBarLayout.settings.paddingX
    );
    const logicalCustomMaxWidthPx = activeTopBarLayout.settings.customMaxWidthPx
      ? toCommercialStorefrontLogicalPx(activeTopBarLayout.settings.customMaxWidthPx)
      : null;

    return {
      '--site-content-max-width': `${logicalSiteContentMaxWidthPx}px`,
      '--site-gutter-min': `${logicalSiteGutterMinPx}px`,
      '--site-gutter-max': `${logicalSiteGutterMaxPx}px`,
      '--site-gutter': `clamp(${logicalSiteGutterMinPx}px, 4vw, ${logicalSiteGutterMaxPx}px)`,
      paddingInline: `${logicalTopBarPaddingPx}px`,
      '--topbar-height': `${activeTopBarLayout.settings.height}px`,
      '--topbar-inner-max-width':
        activeTopBarLayout.settings.widthMode === 'full'
          ? 'none'
          : activeTopBarLayout.settings.widthMode === 'custom' && logicalCustomMaxWidthPx
            ? `${logicalCustomMaxWidthPx}px`
            : `${logicalSiteContentMaxWidthPx}px`
    };
  }, [
    activeTopBarLayout.settings.customMaxWidthPx,
    activeTopBarLayout.settings.height,
    activeTopBarLayout.settings.paddingX,
    activeTopBarLayout.settings.widthMode,
    siteLayout.siteContentMaxWidthPx,
    siteLayout.siteGutterMaxPx,
    siteLayout.siteGutterMinPx
  ]);
  const topBarAppearanceStyle = useMemo<TopBarCssProperties>(() => {
    const appearanceVariables = toSiteNavigationTopBarAppearanceCssVariables(activeTopBarLayout.settings);
    const textColor = appearanceVariables['--topbar-text-color'];

    return {
      ...navbarColorStyle,
      ...appearanceVariables,
      '--navbar-link-default': textColor,
      '--navbar-link-current': textColor,
      backgroundColor: toSiteNavigationTopBarBackgroundCssColor(activeTopBarLayout.settings)
    };
  }, [activeTopBarLayout.settings]);
  const dropdownItems = useMemo(
    () => navigationItems.filter((item) => item.groups.length > 0),
    [navigationItems]
  );
  const dropdownItemsById = useMemo(
    () => new Map(dropdownItems.map((item) => [item.id, item])),
    [dropdownItems]
  );
  const dropdownOrderIds = useMemo(
    () => dropdownItems.map((item) => item.id),
    [dropdownItems]
  );
  const anchorMenuId = useMemo(
    () => navigationItems.some((item) => item.id === 'products') ? 'products' : navigationItems[0]?.id,
    [navigationItems]
  );
  const activeMenuItem = activeMenu ? dropdownItemsById.get(activeMenu) ?? null : null;
  const previousMenuItem = previousMenu ? dropdownItemsById.get(previousMenu) ?? null : null;
  const activeMenuPageIndex = activeMenu ? desktopMenuPageById[activeMenu] ?? 0 : 0;
  const adminPreviewWrapperStyle = useMemo(() => {
    if (
      isInlinePreview ||
      activeTopBarDevice === 'desktop' ||
      typeof effectivePreviewViewportWidth !== 'number'
    ) {
      return undefined;
    }

    return {
      width: `min(100%, calc(${effectivePreviewViewportWidth}px * var(--commercial-storefront-scale)))`,
      marginInline: 'auto'
    } satisfies CSSProperties;
  }, [activeTopBarDevice, effectivePreviewViewportWidth, isInlinePreview]);

  useLayoutEffect(() => {
    if (typeof effectivePreviewViewportWidth === 'number') return undefined;

    const updateMeasuredViewportWidth = () => {
      setMeasuredViewportWidth(window.innerWidth);
    };

    updateMeasuredViewportWidth();
    window.addEventListener('resize', updateMeasuredViewportWidth);

    return () => {
      window.removeEventListener('resize', updateMeasuredViewportWidth);
    };
  }, [effectivePreviewViewportWidth]);

  const updateDropdownPanelLeft = useCallback(() => {
    const header = headerRef.current;
    const katalogLabel = katalogLabelRef.current;

    if (!header || !katalogLabel) {
      return;
    }

    const headerRect = header.getBoundingClientRect();
    const labelRect = katalogLabel.getBoundingClientRect();
    const scaleX = header.offsetWidth > 0 ? headerRect.width / header.offsetWidth : 1;
    const nextPanelLeft = (labelRect.left - headerRect.left) / (scaleX || 1);
    const roundedPanelLeft = Math.round(nextPanelLeft * 100) / 100;

    setDropdownPanelLeft((currentPanelLeft) =>
      Math.abs(currentPanelLeft - roundedPanelLeft) < 0.5 ? currentPanelLeft : roundedPanelLeft
    );
  }, []);

  const clearSwitchTimer = () => {
    if (switchTimerRef.current !== null) {
      window.clearTimeout(switchTimerRef.current);
      switchTimerRef.current = null;
    }
  };

  const clearCloseTimer = () => {
    if (closeTimerRef.current !== null) {
      window.clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  };

  const closeMenus = () => {
    clearSwitchTimer();
    clearCloseTimer();
    activeMenuRef.current = null;
    previousActiveMenuRef.current = null;
    setActiveMenu(null);
    setPreviousMenu(null);
    setMenuDirection(null);
    setIsMenuClosing(false);
    setDesktopMenuPageById({});
    setMobileOpen(false);
  };

  const cancelDesktopMenuClose = () => {
    clearCloseTimer();
    setIsMenuClosing(false);
  };

  const closeDesktopMenuWithAnimation = () => {
    if (!activeMenuRef.current) {
      return;
    }

    clearSwitchTimer();
    clearCloseTimer();
    previousActiveMenuRef.current = null;
    setPreviousMenu(null);
    setMenuDirection(null);
    setIsMenuClosing(true);

    closeTimerRef.current = window.setTimeout(() => {
      activeMenuRef.current = null;
      previousActiveMenuRef.current = null;
      setActiveMenu(null);
      setPreviousMenu(null);
      setMenuDirection(null);
      setIsMenuClosing(false);
      setDesktopMenuPageById({});
      closeTimerRef.current = null;
    }, 150);
  };

  const scheduleDesktopMenuClose = () => {
    clearCloseTimer();
    closeTimerRef.current = window.setTimeout(() => {
      closeTimerRef.current = null;
      closeDesktopMenuWithAnimation();
    }, 90);
  };

  const openDesktopMenu = (nextMenu: MenuKey) => {
    cancelDesktopMenuClose();
    updateDropdownPanelLeft();
    const currentMenu = activeMenuRef.current;

    if (currentMenu === nextMenu) {
      return;
    }

    clearSwitchTimer();
    activeMenuRef.current = nextMenu;
    setActiveMenu(nextMenu);
    setDesktopMenuPageById((currentPages) => ({ ...currentPages, [nextMenu]: 0 }));
  };

  const setDesktopMenuPage = (menuId: MenuKey, pageIndex: number) => {
    setDesktopMenuPageById((currentPages) => ({ ...currentPages, [menuId]: pageIndex }));
  };

  useEffect(() => {
    closeMenus();
    // closeMenus intentionally stays local to keep the route-change reset immediate.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  useLayoutEffect(() => {
    updateDropdownPanelLeft();
  }, [updateDropdownPanelLeft]);

  useLayoutEffect(() => {
    if (isAdminNavbarPreview || !isAdminPath) {
      updateDropdownPanelLeft();
    }
  }, [isAdminNavbarPreview, isAdminPath, navigationItems, updateDropdownPanelLeft]);

  useEffect(() => {
    let animationFrame: number | null = null;
    let disposed = false;

    const scheduleDropdownPanelLeftUpdate = () => {
      if (disposed) {
        return;
      }

      if (animationFrame !== null) {
        window.cancelAnimationFrame(animationFrame);
      }

      animationFrame = window.requestAnimationFrame(() => {
        animationFrame = null;
        updateDropdownPanelLeft();
      });
    };

    scheduleDropdownPanelLeftUpdate();
    window.addEventListener('resize', scheduleDropdownPanelLeftUpdate);

    const resizeObserver =
      typeof ResizeObserver !== 'undefined' ? new ResizeObserver(scheduleDropdownPanelLeftUpdate) : null;

    if (headerRef.current) {
      resizeObserver?.observe(headerRef.current);
    }

    if (katalogLabelRef.current) {
      resizeObserver?.observe(katalogLabelRef.current);
    }

    const fontSet = 'fonts' in document ? document.fonts : undefined;
    void fontSet?.ready.then(scheduleDropdownPanelLeftUpdate);

    return () => {
      disposed = true;

      if (animationFrame !== null) {
        window.cancelAnimationFrame(animationFrame);
      }

      window.removeEventListener('resize', scheduleDropdownPanelLeftUpdate);
      resizeObserver?.disconnect();
    };
  }, [updateDropdownPanelLeft]);

  useEffect(() => {
    activeMenuRef.current = activeMenu;
  }, [activeMenu]);

  useEffect(() => {
    if (!isAdminPath) {
      setAdminPreview(null);
      return undefined;
    }

    const handleAdminPreview = (event: Event) => {
      const detail = (event as CustomEvent<AdminSiteNavigationPreviewEventDetail>).detail;

      if (detail?.enabled && detail.navigation) {
        setAdminPreview({
          navigation: normalizeSiteNavigationConfig(detail.navigation),
          previewDevice: detail.previewDevice,
          previewViewportWidth: detail.previewViewportWidth
        });
      } else {
        setAdminPreview(null);
      }

      closeMenus();
    };

    window.addEventListener(adminSiteNavigationPreviewEventName, handleAdminPreview);

    return () => {
      window.removeEventListener(adminSiteNavigationPreviewEventName, handleAdminPreview);
    };
    // closeMenus is intentionally local; this listener only mirrors preview state into the existing header.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdminPath]);

  useLayoutEffect(() => {
    if (switchTimerRef.current !== null) {
      window.clearTimeout(switchTimerRef.current);
      switchTimerRef.current = null;
    }

    const previousMenu = previousActiveMenuRef.current;

    if (!activeMenu) {
      previousActiveMenuRef.current = null;
      setPreviousMenu(null);
      setMenuDirection(null);
      return;
    }

    if (previousMenu && previousMenu !== activeMenu) {
      const previousIndex = dropdownOrderIds.indexOf(previousMenu);
      const nextIndex = dropdownOrderIds.indexOf(activeMenu);

      setPreviousMenu(previousMenu);
      setMenuDirection(nextIndex > previousIndex ? 'forward' : 'backward');
      switchTimerRef.current = window.setTimeout(() => {
        setPreviousMenu(null);
        setMenuDirection(null);
        switchTimerRef.current = null;
      }, 220);
    } else {
      setPreviousMenu(null);
      setMenuDirection(null);
    }

    previousActiveMenuRef.current = activeMenu;
  }, [activeMenu, dropdownOrderIds]);

  const renderTopBarPlacementElement = (item: SiteNavigationTopBarResponsiveItem) => {
    const wrapperStyle = getTopBarItemLayoutStyle(item, activeTopBarDevice, activeTopBarLayout.settings);
    const wrapperClassName = 'inline-flex min-w-0 items-center overflow-visible';

    if (item.id === 'logo') {
      return (
        <div key={item.id} className={wrapperClassName} style={wrapperStyle}>
          <Link
            href="/"
            prefetch={false}
            aria-label="Atehna home"
            data-navbar-left
            onClick={closeMenus}
            className="inline-flex shrink-0 rounded-lg py-[5px] pl-0 pr-[10px] transition hover:bg-[#f5f5f5]"
            style={logoTextRenderingStyle}
          >
            <Brand device={activeTopBarDevice} />
          </Link>
        </div>
      );
    }

    if (item.id === 'navigation' && usesCompactTopBar) {
      return (
        <div key={item.id} className={wrapperClassName} style={wrapperStyle}>
          <button
            type="button"
            aria-label={mobileOpen ? 'Close navigation' : 'Open navigation'}
            aria-expanded={mobileOpen}
            aria-controls={mobileMenuId}
            onClick={() => setMobileOpen((open) => !open)}
            className="inline-flex h-[43px] w-[43px] shrink-0 items-center justify-center rounded-lg text-black transition hover:bg-[#f5f5f5]"
          >
            <MenuIcon open={mobileOpen} />
          </button>
        </div>
      );
    }

    if (item.id === 'navigation') {
      return (
        <div key={item.id} className={wrapperClassName} style={wrapperStyle}>
          <nav
            aria-label="Main navigation"
            className="inline-flex min-w-0 items-center justify-start gap-[5px]"
            style={coreNavTextRenderingStyle}
          >
            {navigationItems.map((navigationItem) => {
              const hasDropdown = navigationItem.groups.length > 0;
              const open = activeMenu === navigationItem.id;

              return hasDropdown ? (
                <button
                  key={navigationItem.id}
                  type="button"
                  aria-expanded={open}
                  aria-controls={desktopPanelId}
                  aria-haspopup="true"
                  onClick={() => openDesktopMenu(navigationItem.id)}
                  onFocus={() => openDesktopMenu(navigationItem.id)}
                  onMouseEnter={() => openDesktopMenu(navigationItem.id)}
                  onMouseLeave={scheduleDesktopMenuClose}
                  onPointerEnter={() => openDesktopMenu(navigationItem.id)}
                  onPointerLeave={scheduleDesktopMenuClose}
                  className={`inline-flex h-[43px] shrink-0 items-center whitespace-nowrap rounded-lg px-4 ${coreNavTextClassName} ${
                    open ? publicCoreNavOpenClassName : `text-[var(--navbar-link-default)] ${publicCoreNavInteractiveClassName}`
                  }`}
                >
                  <span className="inline-flex min-w-max items-center gap-2 whitespace-nowrap">
                    <span className="whitespace-nowrap" ref={navigationItem.id === anchorMenuId ? katalogLabelRef : undefined}>{navigationItem.label}</span>
                    <ChevronIcon open={open} subtle />
                  </span>
                </button>
              ) : navigationItem.href ? (
                <Link
                  key={navigationItem.id}
                  href={navigationItem.href}
                  prefetch={false}
                  onClick={closeMenus}
                  className={`inline-flex h-[43px] shrink-0 items-center whitespace-nowrap rounded-lg px-4 ${coreNavTextClassName} text-[var(--navbar-link-default)] ${publicCoreNavInteractiveClassName}`}
                >
                  <span className="whitespace-nowrap" ref={navigationItem.id === anchorMenuId ? katalogLabelRef : undefined}>{navigationItem.label}</span>
                </Link>
              ) : null;
            })}
          </nav>
        </div>
      );
    }

    if (item.id === 'search') {
      return (
        <div key={item.id} className={wrapperClassName} style={wrapperStyle}>
          <NavbarSearch mode={activeTopBarLayout.settings.searchMode} onNavigate={closeMenus} />
        </div>
      );
    }

    if (item.id === 'ai') {
      return ctas.map((cta) => (
        <div key={`${item.id}-${cta.label}`} className={wrapperClassName} style={wrapperStyle}>
          <DesktopCta label={cta.label} href={cta.href} variant={cta.variant} onNavigate={closeMenus} />
        </div>
      ));
    }

    return (
      <div key={item.id} className={wrapperClassName} style={wrapperStyle}>
        <NavbarCartControl />
      </div>
    );
  };

  useEffect(() => {
    closeMenus();
    // closeMenus intentionally stays local; this only clears menu state after responsive mode changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTopBarDevice]);

  useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target;
      const header = headerRef.current;

      if (!(target instanceof Node)) {
        return;
      }

      const headerRect = header?.getBoundingClientRect();
      const isInsideHeaderBox = headerRect
        ? event.clientX >= headerRect.left &&
          event.clientX <= headerRect.right &&
          event.clientY >= headerRect.top &&
          event.clientY <= headerRect.bottom
        : false;

      if (header && !header.contains(target) && !event.composedPath().includes(header) && !isInsideHeaderBox) {
        clearSwitchTimer();
        clearCloseTimer();
        activeMenuRef.current = null;
        previousActiveMenuRef.current = null;
        setActiveMenu(null);
        setPreviousMenu(null);
        setMenuDirection(null);
        setIsMenuClosing(false);
        setDesktopMenuPageById({});
        setMobileOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        clearSwitchTimer();
        clearCloseTimer();
        activeMenuRef.current = null;
        previousActiveMenuRef.current = null;
        setActiveMenu(null);
        setPreviousMenu(null);
        setMenuDirection(null);
        setIsMenuClosing(false);
        setDesktopMenuPageById({});
        setMobileOpen(false);
      }
    };

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      clearSwitchTimer();
      clearCloseTimer();
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  if (isAdminPath && !isAdminNavbarPreview) {
    return (
      <header className="h-[65px] border-b border-[#e5e5e5] bg-white" aria-hidden="true" />
    );
  }

  const siteHeader = (
    <header
      ref={headerRef}
      style={topBarAppearanceStyle}
      className="relative z-50 border-b border-[#e5e5e5] text-black"
    >
      <div
        className="topbar-inner topbar-inner-freeform"
        data-layout-mode="centered_nav"
        data-width-mode={activeTopBarLayout.settings.widthMode}
        style={topBarShellStyle}
      >
        <div
          className={`topbar-placement-bounds ${coreNavTextClassName}`}
          style={coreNavTextRenderingStyle}
        >
          {activeTopBarPlacementItems.map(renderTopBarPlacementElement)}
        </div>
      </div>

      {!usesCompactTopBar && activeMenuItem ? (
        <div
          id={desktopPanelId}
          style={{
            left: dropdownPanelLeft,
            width: 'var(--navbar-dropdown-panel-width)',
            maxWidth: 'calc((100vw - 32px) / var(--commercial-storefront-scale))'
          }}
          onMouseEnter={cancelDesktopMenuClose}
          onMouseLeave={scheduleDesktopMenuClose}
          onPointerEnter={cancelDesktopMenuClose}
          onPointerLeave={scheduleDesktopMenuClose}
          className="site-menu-perspective absolute top-full pt-[11px]"
        >
          <div className={`${isMenuClosing ? 'site-menu-viewport-close' : 'site-menu-viewport-open'} h-[var(--navbar-dropdown-panel-height)] overflow-hidden rounded-2xl border border-[var(--navbar-dropdown-border)] bg-white shadow-[0_12px_32px_rgba(0,0,0,0.08),0_2px_8px_rgba(0,0,0,0.04)]`}>
            <div className="relative h-full overflow-hidden">
              {previousMenuItem && menuDirection ? (
                <DesktopMenuContent
                  menuItem={previousMenuItem}
                  onNavigate={closeMenus}
                  pageIndex={previousMenu ? desktopMenuPageById[previousMenu] ?? 0 : 0}
                  motion={menuDirection === 'forward' ? 'to-start' : 'to-end'}
                  isExiting
                />
              ) : null}
              <DesktopMenuContent
                menuItem={activeMenuItem}
                onNavigate={closeMenus}
                pageIndex={activeMenuPageIndex}
                onPageChange={(pageIndex) => setDesktopMenuPage(activeMenuItem.id, pageIndex)}
                motion={
                  previousMenuItem && menuDirection
                    ? menuDirection === 'forward'
                      ? 'from-end'
                      : 'from-start'
                    : undefined
                }
              />
            </div>
          </div>
        </div>
      ) : null}

      {usesCompactTopBar && mobileOpen ? (
        <div
          id={mobileMenuId}
          className="max-h-[calc(100vh-64px)] overflow-y-auto border-t border-[#eeeeee] bg-white"
        >
          <nav
            aria-label="Mobile navigation"
            className="pb-[27px]"
          >
            <div className="border-b border-[#eeeeee] px-[27px] py-[18px]">
              <NavbarSearch mobile onNavigate={closeMenus} />
            </div>

            {navigationItems.map((item) => (
              item.groups.length > 0 ? (
                <MobileAccordion
                  key={item.id}
                  item={item}
                  open={openMobileMenus.includes(item.id)}
                  onToggle={() =>
                    setOpenMobileMenus((openMenus) =>
                      openMenus.includes(item.id)
                        ? openMenus.filter((openMenu) => openMenu !== item.id)
                        : [...openMenus, item.id]
                    )
                  }
                  onNavigate={closeMenus}
                />
              ) : item.href ? (
                <div key={item.id} className="border-b border-[#eeeeee] py-2">
                  <Link
                    href={item.href}
                    prefetch={false}
                    onClick={closeMenus}
                    className={`block px-[27px] py-4 text-xl font-medium text-[#111111] ${publicDropdownSelectionClassName}`}
                  >
                    {item.label}
                  </Link>
                </div>
              ) : null
            ))}

            <div className="grid gap-[11px] px-[27px] pt-[21px]">
              {ctas.map((cta) => (
                <Link
                  key={cta.label}
                  href={cta.href}
                  prefetch={false}
                  onClick={closeMenus}
                  className={`inline-flex h-[53px] items-center justify-center rounded-lg px-[21px] text-[19px] font-medium transition ${
                    cta.variant === 'primary'
                      ? 'bg-black text-white hover:bg-[#1f1f1f]'
                      : cta.variant === 'secondary'
                        ? 'border border-[#dedede] bg-white text-[#111111] hover:bg-[#f5f5f5]'
                        : 'text-[#555555] hover:bg-[#f5f5f5] hover:text-black'
                  }`}
                >
                  {cta.label}
                </Link>
              ))}
            </div>
          </nav>
        </div>
      ) : null}
    </header>
  );

  if (isAdminNavbarPreview && !isInlinePreview) {
    return (
      <div
        className="commercial-storefront-scale admin-site-header-preview-scale"
        data-admin-site-header-preview="true"
        data-preview-device={activeTopBarDevice}
        style={adminPreviewWrapperStyle}
      >
        {siteHeader}
      </div>
    );
  }

  return siteHeader;
}
