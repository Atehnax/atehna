import {
  DEFAULT_HOMEPAGE_SETTINGS,
  normalizeHomepageFooterSettings,
  type HomepageFooterSettings
} from '@/shared/domain/landing/landingPage';
import {
  HOMEPAGE_WEBSITE_FONT_FAMILIES,
  resolveWebsiteFontStack,
  type WebsiteFontFamily
} from '@/shared/domain/style/fontFamilies';

export const SITE_NAVIGATION_SETTINGS_KEY = 'main-navbar';

const defaultIcon = 'box';

export type SiteNavigationItemIcon = string;

export type SiteNavigationLink = {
  id: string;
  label: string;
  description: string;
  href: string;
  icon: SiteNavigationItemIcon;
  visible: boolean;
  position: number;
};

export type SiteNavigationGroup = {
  id: string;
  label: string;
  href: string;
  visible: boolean;
  position: number;
  desktopSpan?: 1 | 2 | 3 | 4;
  links: SiteNavigationLink[];
};

export type SiteNavigationTopLevelItem = {
  id: string;
  label: string;
  href: string;
  visible: boolean;
  position: number;
  groups: SiteNavigationGroup[];
};

export const SITE_NAVIGATION_TOP_BAR_ELEMENT_IDS = ['logo', 'navigation', 'search', 'ai', 'cart'] as const;
export const SITE_NAVIGATION_TOP_BAR_DEVICES = ['desktop', 'tablet', 'mobile'] as const;
export const SITE_NAVIGATION_TOP_BAR_FONT_FAMILIES = HOMEPAGE_WEBSITE_FONT_FAMILIES;
export const SITE_NAVIGATION_TOP_BAR_FONT_STYLES = ['normal', 'italic'] as const;

export type SiteNavigationTopBarElementId = (typeof SITE_NAVIGATION_TOP_BAR_ELEMENT_IDS)[number];
export type SiteNavigationTopBarDevice = (typeof SITE_NAVIGATION_TOP_BAR_DEVICES)[number];
export type SiteNavigationTopBarRegion = 'left' | 'center' | 'right' | 'edgeRight' | 'menu';
export type SiteNavigationTopBarWidthMode = 'match_content' | 'custom' | 'full';
export type SiteNavigationTopBarConstraintLayoutMode = 'centered_nav' | 'flow';
export type SiteNavigationTopBarSlot = 'left' | 'center' | 'right' | 'menu';
export type SiteNavigationTopBarItemWidthMode = 'auto' | 'fixed' | 'fill';
export type SiteNavigationTopBarZoneWidthMode = 'auto' | 'fixed' | 'fill';
export type SiteNavigationTopBarNavigationMode = 'full' | 'condensed' | 'hamburger';
export type SiteNavigationTopBarSearchMode = 'icon' | 'field' | 'menu';
export type SiteNavigationTopBarAiMode = 'button' | 'icon';
export type SiteNavigationTopBarMenuOpenMode = 'drawer' | 'fullscreen';
export type SiteNavigationTopBarActionId = 'cart' | 'search' | 'ai';
export type SiteNavigationTopBarFontFamily = WebsiteFontFamily;
export type SiteNavigationTopBarFontStyle = (typeof SITE_NAVIGATION_TOP_BAR_FONT_STYLES)[number];

export type SiteNavigationTopBarResponsiveItem = {
  id: SiteNavigationTopBarElementId;
  slot: SiteNavigationTopBarSlot;
  orderIndex: number;
  widthMode: SiteNavigationTopBarItemWidthMode;
  fixedWidthPx: number | null;
  minWidthPx: number | null;
  maxWidthPx: number | null;
  marginBeforePx: number;
  marginAfterPx: number;
  xPx: number;
  xRatio: number;
  widthPx: number;
  widthEditable: boolean;
  zIndex: number;
  region: SiteNavigationTopBarRegion;
  visible: boolean;
  offsetFromCenter: number;
  position: number;
};

export type SiteNavigationTopBarZoneWidthSettings = {
  widthMode: SiteNavigationTopBarZoneWidthMode;
  widthPx: number | null;
};

export type SiteNavigationTopBarZoneSettings = Record<'left' | 'center' | 'right', SiteNavigationTopBarZoneWidthSettings>;

export type SiteNavigationTopBarResponsiveSettings = {
  widthMode: SiteNavigationTopBarWidthMode;
  customMaxWidthPx: number | null;
  layoutMode: SiteNavigationTopBarConstraintLayoutMode;
  columnGapPx: number;
  itemGapPx: number;
  backgroundColor: string;
  backgroundOpacityPercent: number;
  textColor: string;
  fontFamily: SiteNavigationTopBarFontFamily;
  fontSizePx: number;
  fontWeight: number;
  fontStyle: SiteNavigationTopBarFontStyle;
  zones?: SiteNavigationTopBarZoneSettings;
  breakpointFrom?: number;
  breakpointTo?: number;
  navigationMode?: SiteNavigationTopBarNavigationMode;
  maxVisibleLinks?: number;
  searchMode?: SiteNavigationTopBarSearchMode;
  aiMode?: SiteNavigationTopBarAiMode;
  cartBadge?: boolean;
  menuOpenMode?: SiteNavigationTopBarMenuOpenMode;
  actionPriority?: SiteNavigationTopBarActionId[];
  height: number;
  paddingX: number;
  sticky: boolean;
  shadow: boolean;
  safeArea?: boolean;
};

export type SiteNavigationTopBarResponsiveLayout = {
  items: SiteNavigationTopBarResponsiveItem[];
  settings: SiteNavigationTopBarResponsiveSettings;
};

export type SiteNavigationTopBarResponsiveLayouts = Record<SiteNavigationTopBarDevice, SiteNavigationTopBarResponsiveLayout>;

export type SiteNavigationTopBarLayout = {
  responsive: SiteNavigationTopBarResponsiveLayouts;
};

export type SiteNavigationTopBarAppearanceCssVariables = {
  '--topbar-background': string;
  '--topbar-background-opacity': string;
  '--topbar-text-color': string;
  '--topbar-font-family': string;
  '--topbar-font-size': string;
  '--topbar-font-weight': string;
  '--topbar-font-style': SiteNavigationTopBarFontStyle;
};

export function toSiteNavigationTopBarAppearanceCssVariables(
  settings: Pick<
    SiteNavigationTopBarResponsiveSettings,
    | 'backgroundColor'
    | 'backgroundOpacityPercent'
    | 'textColor'
    | 'fontFamily'
    | 'fontSizePx'
    | 'fontWeight'
    | 'fontStyle'
  >
): SiteNavigationTopBarAppearanceCssVariables {
  return {
    '--topbar-background': settings.backgroundColor,
    '--topbar-background-opacity': `${settings.backgroundOpacityPercent}%`,
    '--topbar-text-color': settings.textColor,
    '--topbar-font-family': resolveWebsiteFontStack(settings.fontFamily),
    '--topbar-font-size': `${settings.fontSizePx}px`,
    '--topbar-font-weight': String(settings.fontWeight),
    '--topbar-font-style': settings.fontStyle
  };
}

export function toSiteNavigationTopBarBackgroundCssColor(
  settings: Pick<SiteNavigationTopBarResponsiveSettings, 'backgroundColor' | 'backgroundOpacityPercent'>
) {
  const color = asTopBarBackgroundColor(settings.backgroundColor, DEFAULT_SITE_NAVIGATION_TOP_BAR_APPEARANCE.backgroundColor);
  const opacity = asBoundedNumber(settings.backgroundOpacityPercent, 100, 0, 100) / 100;
  const red = Number.parseInt(color.slice(1, 3), 16);
  const green = Number.parseInt(color.slice(3, 5), 16);
  const blue = Number.parseInt(color.slice(5, 7), 16);

  return `rgb(${red} ${green} ${blue} / ${opacity})`;
}

export type SiteNavigationSiteLayoutSettings = {
  siteContentMaxWidthPx: number;
  siteGutterMinPx: number;
  siteGutterMaxPx: number;
};

export type SiteNavigationConfig = {
  siteLayout: SiteNavigationSiteLayoutSettings;
  items: SiteNavigationTopLevelItem[];
  footer: HomepageFooterSettings;
  topBarLayout: SiteNavigationTopBarLayout;
  topBarInitialLayout: SiteNavigationTopBarLayout;
  updatedAt?: string | null;
};

export const SITE_NAVIGATION_DESKTOP_COLUMN_COUNT = 3;
export const SITE_NAVIGATION_DESKTOP_LINK_ROWS = 5;
export const SITE_NAVIGATION_ADMIN_SELECTION_ROW_GAP_PX = 4;
export const SITE_NAVIGATION_DESKTOP_DROPDOWN_ROW_GAP_PX = 20;
export const SITE_NAVIGATION_TOP_BAR_CENTER_OFFSET_MIN = -512;
export const SITE_NAVIGATION_TOP_BAR_CENTER_OFFSET_MAX = 512;
export const SITE_NAVIGATION_TOP_BAR_CENTER_OFFSET_STEP = 1;
export const SITE_NAVIGATION_TOP_BAR_LOGO_WIDTH_PX = 88;
export const SITE_NAVIGATION_TOP_BAR_SEARCH_COLLAPSED_WIDTH_PX = 32;
export const SITE_NAVIGATION_TOP_BAR_SEARCH_EXPANDED_WIDTH_PX = 320;
export const SITE_NAVIGATION_TOP_BAR_TABLET_SEARCH_EXPANDED_WIDTH_PX = 240;
export const SITE_CONTENT_MAX_WIDTH_PX = 1500;

export const DEFAULT_SITE_LAYOUT_SETTINGS: SiteNavigationSiteLayoutSettings = {
  siteContentMaxWidthPx: SITE_CONTENT_MAX_WIDTH_PX,
  siteGutterMinPx: 16,
  siteGutterMaxPx: 32
};

export const DEFAULT_SITE_NAVIGATION_TOP_BAR_APPEARANCE = {
  backgroundColor: '#FFFFFF',
  backgroundOpacityPercent: 100,
  textColor: '#4D4D4D',
  fontFamily: 'system-ui',
  fontSizePx: 14,
  fontWeight: 400,
  fontStyle: 'normal'
} as const satisfies Pick<
  SiteNavigationTopBarResponsiveSettings,
  | 'backgroundColor'
  | 'backgroundOpacityPercent'
  | 'textColor'
  | 'fontFamily'
  | 'fontSizePx'
  | 'fontWeight'
  | 'fontStyle'
>;

const TOP_BAR_CENTERED_NAV_ZONE_SETTINGS: SiteNavigationTopBarZoneSettings = {
  left: { widthMode: 'fill', widthPx: null },
  center: { widthMode: 'auto', widthPx: null },
  right: { widthMode: 'fill', widthPx: null }
};

const TOP_BAR_FLOW_ZONE_SETTINGS: SiteNavigationTopBarZoneSettings = {
  left: { widthMode: 'auto', widthPx: null },
  center: { widthMode: 'fill', widthPx: null },
  right: { widthMode: 'auto', widthPx: null }
};

function defaultTopBarZoneSettings(layoutMode: SiteNavigationTopBarConstraintLayoutMode): SiteNavigationTopBarZoneSettings {
  const source = layoutMode === 'flow' ? TOP_BAR_FLOW_ZONE_SETTINGS : TOP_BAR_CENTERED_NAV_ZONE_SETTINGS;
  return {
    left: { ...source.left },
    center: { ...source.center },
    right: { ...source.right }
  };
}

export type SiteNavigationDesktopGroupPlacement = {
  pageIndex: number;
  pageNumber: number;
  slotIndex: number;
  slotSpan: number;
};

export function getSiteNavigationTopBarSearchReservedWidth(device: SiteNavigationTopBarDevice) {
  return device === 'tablet'
    ? SITE_NAVIGATION_TOP_BAR_TABLET_SEARCH_EXPANDED_WIDTH_PX
    : SITE_NAVIGATION_TOP_BAR_SEARCH_EXPANDED_WIDTH_PX;
}

export function getSiteNavigationTopBarReservedFixedWidth(
  item: Pick<SiteNavigationTopBarResponsiveItem, 'id' | 'slot' | 'fixedWidthPx' | 'widthMode'>
) {
  if (item.id === 'search' && item.slot !== 'menu') {
    return SITE_NAVIGATION_TOP_BAR_SEARCH_COLLAPSED_WIDTH_PX;
  }

  return item.widthMode === 'fixed' && item.fixedWidthPx !== null ? item.fixedWidthPx : null;
}

const lucideIconNamePattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const link = (
  id: string,
  position: number,
  label: string,
  description: string,
  href: string,
  icon: SiteNavigationItemIcon
): SiteNavigationLink => ({
  id,
  label,
  description,
  href,
  icon,
  visible: true,
  position
});

const group = (
  id: string,
  position: number,
  label: string,
  links: SiteNavigationLink[],
  desktopSpan?: 1 | 2 | 3 | 4
): SiteNavigationGroup => ({
  id,
  label,
  href: '',
  visible: true,
  position,
  desktopSpan,
  links
});

const topLevel = (
  id: string,
  position: number,
  label: string,
  groups: SiteNavigationGroup[]
): SiteNavigationTopLevelItem => ({
  id,
  label,
  href: '',
  visible: true,
  position,
  groups
});

const DEFAULT_TOP_BAR_PLACEMENT_BOUNDS_WIDTH: Record<SiteNavigationTopBarDevice, number> = {
  desktop: 1216,
  tablet: 720,
  mobile: 358
};

function defaultTopBarPlacement(
  device: SiteNavigationTopBarDevice,
  xPx: number,
  widthPx: number,
  zIndex: number,
  widthEditable = false
) {
  const boundsWidth = DEFAULT_TOP_BAR_PLACEMENT_BOUNDS_WIDTH[device];

  return {
    xPx,
    xRatio: boundsWidth > 0 ? xPx / boundsWidth : 0,
    widthPx,
    widthEditable,
    zIndex
  };
}

export const DEFAULT_SITE_NAVIGATION_TOP_BAR_LAYOUT: SiteNavigationTopBarLayout = {
  responsive: {
    desktop: {
      items: [
        { id: 'logo', slot: 'left', orderIndex: 1, widthMode: 'fixed', fixedWidthPx: 88, minWidthPx: null, maxWidthPx: null, marginBeforePx: 0, marginAfterPx: 0, ...defaultTopBarPlacement('desktop', 0, 88, 1, true), region: 'left', visible: true, offsetFromCenter: -420, position: 0 },
        { id: 'navigation', slot: 'center', orderIndex: 1, widthMode: 'auto', fixedWidthPx: null, minWidthPx: null, maxWidthPx: null, marginBeforePx: 0, marginAfterPx: 0, ...defaultTopBarPlacement('desktop', 381, 455, 2), region: 'center', visible: true, offsetFromCenter: -40, position: 1 },
        { id: 'search', slot: 'right', orderIndex: 1, widthMode: 'fixed', fixedWidthPx: 32, minWidthPx: null, maxWidthPx: null, marginBeforePx: 0, marginAfterPx: 0, ...defaultTopBarPlacement('desktop', 1040, 32, 3), region: 'right', visible: true, offsetFromCenter: 210, position: 2 },
        { id: 'ai', slot: 'right', orderIndex: 2, widthMode: 'auto', fixedWidthPx: null, minWidthPx: null, maxWidthPx: null, marginBeforePx: 0, marginAfterPx: 0, ...defaultTopBarPlacement('desktop', 1084, 116, 4), region: 'right', visible: true, offsetFromCenter: 320, position: 3 },
        { id: 'cart', slot: 'right', orderIndex: 3, widthMode: 'fixed', fixedWidthPx: 32, minWidthPx: null, maxWidthPx: null, marginBeforePx: 0, marginAfterPx: 0, ...defaultTopBarPlacement('desktop', 1184, 32, 5), region: 'edgeRight', visible: true, offsetFromCenter: 420, position: 4 }
      ],
      settings: {
        widthMode: 'full',
        customMaxWidthPx: null,
        layoutMode: 'centered_nav',
        columnGapPx: 24,
        itemGapPx: 12,
        ...DEFAULT_SITE_NAVIGATION_TOP_BAR_APPEARANCE,
        zones: defaultTopBarZoneSettings('centered_nav'),
        searchMode: 'icon',
        height: 73,
        paddingX: 32,
        sticky: false,
        shadow: false,
        cartBadge: true
      }
    },
    tablet: {
      items: [
        { id: 'logo', slot: 'left', orderIndex: 1, widthMode: 'fixed', fixedWidthPx: 88, minWidthPx: null, maxWidthPx: null, marginBeforePx: 0, marginAfterPx: 16, ...defaultTopBarPlacement('tablet', 0, 88, 1, true), region: 'left', visible: true, offsetFromCenter: -280, position: 0 },
        { id: 'navigation', slot: 'left', orderIndex: 2, widthMode: 'auto', fixedWidthPx: null, minWidthPx: null, maxWidthPx: null, marginBeforePx: 0, marginAfterPx: 16, ...defaultTopBarPlacement('tablet', 112, 332, 2), region: 'left', visible: true, offsetFromCenter: -80, position: 1 },
        { id: 'search', slot: 'right', orderIndex: 1, widthMode: 'fixed', fixedWidthPx: 32, minWidthPx: null, maxWidthPx: null, marginBeforePx: 0, marginAfterPx: 12, ...defaultTopBarPlacement('tablet', 512, 32, 3), region: 'right', visible: true, offsetFromCenter: 120, position: 2 },
        { id: 'ai', slot: 'right', orderIndex: 2, widthMode: 'auto', fixedWidthPx: null, minWidthPx: null, maxWidthPx: null, marginBeforePx: 0, marginAfterPx: 12, ...defaultTopBarPlacement('tablet', 556, 116, 4), region: 'right', visible: true, offsetFromCenter: 220, position: 3 },
        { id: 'cart', slot: 'right', orderIndex: 3, widthMode: 'fixed', fixedWidthPx: 32, minWidthPx: null, maxWidthPx: null, marginBeforePx: 0, marginAfterPx: 0, ...defaultTopBarPlacement('tablet', 688, 32, 5), region: 'edgeRight', visible: true, offsetFromCenter: 300, position: 4 }
      ],
      settings: {
        widthMode: 'match_content',
        customMaxWidthPx: null,
        layoutMode: 'flow',
        columnGapPx: 20,
        itemGapPx: 12,
        ...DEFAULT_SITE_NAVIGATION_TOP_BAR_APPEARANCE,
        zones: defaultTopBarZoneSettings('flow'),
        breakpointFrom: 768,
        breakpointTo: 1024,
        navigationMode: 'condensed',
        maxVisibleLinks: 3,
        searchMode: 'icon',
        aiMode: 'button',
        cartBadge: true,
        height: 64,
        paddingX: 24,
        sticky: true,
        shadow: true
      }
    },
    mobile: {
      items: [
        { id: 'navigation', slot: 'right', orderIndex: 1, widthMode: 'fixed', fixedWidthPx: 32, minWidthPx: null, maxWidthPx: null, marginBeforePx: 0, marginAfterPx: 0, ...defaultTopBarPlacement('mobile', 0, 32, 1), region: 'left', visible: true, offsetFromCenter: -150, position: 0 },
        { id: 'logo', slot: 'left', orderIndex: 1, widthMode: 'fixed', fixedWidthPx: 88, minWidthPx: null, maxWidthPx: null, marginBeforePx: 0, marginAfterPx: 0, ...defaultTopBarPlacement('mobile', 135, 88, 2, true), region: 'center', visible: true, offsetFromCenter: 0, position: 1 },
        { id: 'cart', slot: 'right', orderIndex: 2, widthMode: 'fixed', fixedWidthPx: 32, minWidthPx: null, maxWidthPx: null, marginBeforePx: 0, marginAfterPx: 0, ...defaultTopBarPlacement('mobile', 326, 32, 3), region: 'edgeRight', visible: true, offsetFromCenter: 150, position: 2 },
        { id: 'search', slot: 'menu', orderIndex: 1, widthMode: 'fixed', fixedWidthPx: 32, minWidthPx: null, maxWidthPx: null, marginBeforePx: 0, marginAfterPx: 0, ...defaultTopBarPlacement('mobile', 246, 32, 4), region: 'menu', visible: false, offsetFromCenter: 0, position: 3 },
        { id: 'ai', slot: 'menu', orderIndex: 2, widthMode: 'auto', fixedWidthPx: null, minWidthPx: null, maxWidthPx: null, marginBeforePx: 0, marginAfterPx: 0, ...defaultTopBarPlacement('mobile', 120, 116, 5), region: 'menu', visible: false, offsetFromCenter: 0, position: 4 }
      ],
      settings: {
        widthMode: 'match_content',
        customMaxWidthPx: null,
        layoutMode: 'flow',
        columnGapPx: 16,
        itemGapPx: 10,
        ...DEFAULT_SITE_NAVIGATION_TOP_BAR_APPEARANCE,
        zones: defaultTopBarZoneSettings('flow'),
        breakpointTo: 767,
        navigationMode: 'hamburger',
        menuOpenMode: 'drawer',
        actionPriority: ['search', 'ai', 'cart'],
        searchMode: 'menu',
        aiMode: 'button',
        cartBadge: true,
        height: 56,
        paddingX: 16,
        sticky: true,
        shadow: false,
        safeArea: true
      }
    }
  }
};

export const DEFAULT_SITE_NAVIGATION_CONFIG: SiteNavigationConfig = {
  siteLayout: DEFAULT_SITE_LAYOUT_SETTINGS,
  items: [
    topLevel('products', 0, 'Katalog', [
      group(
        'products-categories',
        0,
        'Kategorije',
        [
          link('products-tehnika', 0, 'Tehnika in tehnologija', 'Osnovni tehnični pouk', '/products/tehnika-in-tehnologija', 'box'),
          link('products-materiali', 1, 'Materiali', 'Les, kovine in plastika', '/products/materiali', 'wrench'),
          link('products-stroji', 2, 'Stroji in naprave', 'Oprema za šolske delavnice', '/products/stroji-in-naprave', 'layers'),
          link('products-merilno', 3, 'Merilno orodje', 'Merjenje in geometrija', '/products/merilno-orodje-in-geometrija', 'ruler'),
          link('products-elektrika', 4, 'Elektrika in mehanika', 'Vezja in prenosi', '/products/elektricni-in-mehanicni-elementi', 'grid'),
          link('products-rocno', 5, 'Ročno orodje in pribor', 'Pribor za delavnico', '/products/rocno-orodje-in-delavniski-pribor', 'wrench'),
          link('products-zascita', 6, 'Zaščita pri delu', 'Oprema za varno delo', '/products/zascita-pri-delu', 'hard-hat'),
          link('products-dodatki', 7, 'Dodatki in deli', 'Rezervni deli in dodatki', '/products/dodatki-in-nadomestni-deli', 'repeat')
        ],
        2
      ),
      group('products-use', 1, 'Po uporabi', [
        link('products-ucilnice', 0, 'Za učilnice', 'Pripomočki za pouk', '/products#za-ucilnice', 'school'),
        link('products-delavnica', 1, 'Za delavnico', 'Orodje za prakso', '/products#za-delavnico', 'wrench'),
        link('products-projektno-delo', 2, 'Za projektno delo', 'Materiali za izdelavo', '/products#za-projektno-delo', 'clipboard'),
        link('products-potrosni', 3, 'Potrošni material', 'Pogosta zaloga za pouk', '/products#potrosni-material', 'box')
      ])
    ]),
    topLevel('resources', 1, 'Za šole', [
      group('resources-grades', 0, 'Po razredih', [
        link('resources-5', 0, '5. razred', 'Osnove tehničnega pouka', '/products#5-razred', 'school'),
        link('resources-6', 1, '6. razred', 'Za razvijanje spretnosti', '/products#6-razred', 'school'),
        link('resources-7', 2, '7. razred', 'Za zahtevnejše naloge', '/products#7-razred', 'school'),
        link('resources-8', 3, '8. razred', 'Merjenje in mehanika', '/products#8-razred', 'school'),
        link('resources-9', 4, '9. razred', 'Zaključni šolski projekti', '/products#9-razred', 'school')
      ]),
      group('resources-kits', 1, 'Kompleti za pouk', [
        link('resources-project-kits', 0, 'Kompleti za projekte', 'Material za en izdelek', '/products#komplet-za-posamezen-projekt', 'grid'),
        link('resources-consumables', 1, 'Potrošni material za pouk', 'Zaloga za več oddelkov', '/products#potrosni-material-za-pouk', 'box'),
        link('resources-safety', 2, 'Varnostni komplet', 'Osnovna zaščitna oprema', '/products/zascita-pri-delu', 'shield'),
        link('resources-classroom', 3, 'Oprema za učilnico', 'Pripomočki za organiziran pouk', '/products#oprema-za-ucilnico', 'layers')
      ]),
      group('resources-teachers', 2, 'Za učitelje', [
        link('resources-how-to-order', 0, 'Kako naročiti', 'Koraki za naročanje', '/how-schools-order', 'book'),
        link('resources-upload-order', 1, 'Oddaj naročilnico', 'Pošljite naročilnico', '/order/narocilnica', 'upload'),
        link('resources-video', 2, 'Video vodiči', 'Pomoč za izbiro', '/how-schools-order#video-vodici', 'file')
      ])
    ]),
    topLevel('solutions', 2, 'Projekti', [
      group(
        'solutions-types',
        0,
        'Vrste projektov',
        [
          link('solutions-all', 0, 'Vsi projekti', 'Celoten projektni program', '/products', 'grid'),
          link('solutions-vehicles', 1, 'Vozila in mehanizmi', 'Kolesa in prenosi', '/products#vozila-in-mehanizmi', 'truck'),
          link('solutions-wood', 2, 'Leseni izdelki', 'Les in ploščni materiali', '/products#leseni-izdelki', 'wrench'),
          link('solutions-electronics', 3, 'Elektronika', 'Vezja in elementi', '/products/elektricni-in-mehanicni-elementi', 'layers'),
          link('solutions-structures', 4, 'Konstrukcije', 'Nosilci in okvirji', '/products#konstrukcije', 'box'),
          link('solutions-modeling', 5, 'Modelarstvo', 'Modeli za izdelavo', '/products#modelarstvo', 'ruler'),
          link('solutions-measuring', 6, 'Merjenje in geometrija', 'Natančnost in oblike', '/products/merilno-orodje-in-geometrija', 'ruler'),
          link('solutions-creative', 7, 'Ustvarjalni tehnični projekti', 'Od ideje do izdelka', '/products#ustvarjalni-tehnicni-projekti', 'presentation')
        ],
        2
      ),
      group('solutions-recommended', 1, 'Priporočeno', [
        link('solutions-popular', 0, 'Najbolj iskano', 'Pogosta šolska naročila', '/products#najbolj-iskano', 'search'),
        link('solutions-new', 1, 'Novo v ponudbi', 'Novi materiali in kompleti', '/products#novo-v-ponudbi', 'clock'),
        link('solutions-starters', 2, 'Za začetnike', 'Preprosti prvi projekti', '/products#za-zacetnike', 'school'),
        link('solutions-guides', 3, 'Kompleti z navodili', 'Materiali z navodili', '/products#kompleti-z-navodili', 'book')
      ])
    ]),
    topLevel('help', 3, 'Pomoč', [
      group('help-orders', 0, 'Naročanje', [
        link('help-how-to-order', 0, 'Kako naročiti', 'Od izbire do dobave', '/how-schools-order', 'book'),
        link('help-delivery', 1, 'Dostava', 'Roki in prevzem', '/how-schools-order#dostava', 'truck'),
        link('help-payment', 2, 'Plačilo', 'Načini plačila', '/how-schools-order#placilo', 'clipboard'),
        link('help-quote', 3, 'Predračun', 'Ponudba pred naročilom', '/how-schools-order#predracun', 'file'),
        link('help-returns', 4, 'Vračila in reklamacije', 'Zamenjave in napake', '/terms#vracila-in-reklamacije', 'refresh-cw')
      ]),
      group('help-docs', 1, 'Dokumentacija', [
        link('help-instructions', 0, 'Navodila za uporabo', 'Navodila za izdelke', '/products#navodila-za-uporabo', 'book'),
        link('help-safety-sheets', 1, 'Varnostni listi', 'Podatki za materiale', '/products#varnostni-listi', 'shield'),
        link('help-technical', 2, 'Tehnični podatki', 'Mere in specifikacije', '/products#tehnicni-podatki', 'file'),
        link('help-warranty', 3, 'Garancija', 'Pogoji garancije in podpore', '/terms#garancija', 'lock')
      ]),
      group('help-company', 2, 'Podjetje', [
        link('help-about', 0, 'O nas', 'Kako podpiramo šole', '/about', 'users'),
        link('help-contact', 1, 'Kontakt', 'Ponudba ali pomoč', '/contact', 'mail'),
        link('help-terms', 2, 'Pogoji poslovanja', 'Pravila naročanja', '/terms', 'clipboard'),
        link('help-privacy', 3, 'Zasebnost', 'Varovanje podatkov', '/privacy', 'shield')
      ])
    ])
  ],
  footer: normalizeHomepageFooterSettings(DEFAULT_HOMEPAGE_SETTINGS.footer),
  topBarLayout: DEFAULT_SITE_NAVIGATION_TOP_BAR_LAYOUT,
  topBarInitialLayout: DEFAULT_SITE_NAVIGATION_TOP_BAR_LAYOUT,
  updatedAt: null
};

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function asString(value: unknown, fallback: string) {
  return typeof value === 'string' ? value.trim() : fallback;
}

function asVisible(value: unknown) {
  return typeof value === 'boolean' ? value : true;
}

function asPosition(value: unknown, fallback: number) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function asDesktopSpan(value: unknown): 1 | 2 | 3 | 4 | undefined {
  return value === 1 || value === 2 || value === 3 || value === 4 ? value : undefined;
}

function asTopBarRegion(value: unknown, fallback: SiteNavigationTopBarRegion): SiteNavigationTopBarRegion {
  return value === 'left' || value === 'center' || value === 'right' || value === 'edgeRight' || value === 'menu'
    ? value
    : fallback;
}

function asTopBarSlot(value: unknown, fallback: SiteNavigationTopBarSlot): SiteNavigationTopBarSlot {
  return value === 'left' || value === 'center' || value === 'right' || value === 'menu' ? value : fallback;
}

function asTopBarWidthMode(value: unknown, fallback: SiteNavigationTopBarWidthMode): SiteNavigationTopBarWidthMode {
  return value === 'match_content' || value === 'custom' || value === 'full' ? value : fallback;
}

function asTopBarConstraintLayoutMode(
  value: unknown,
  fallback: SiteNavigationTopBarConstraintLayoutMode
): SiteNavigationTopBarConstraintLayoutMode {
  return value === 'centered_nav' || value === 'flow' ? value : fallback;
}

function asTopBarItemWidthMode(value: unknown, fallback: SiteNavigationTopBarItemWidthMode): SiteNavigationTopBarItemWidthMode {
  return value === 'auto' || value === 'fixed' || value === 'fill' ? value : fallback;
}

function asNavigationMode(value: unknown, fallback: SiteNavigationTopBarNavigationMode): SiteNavigationTopBarNavigationMode {
  return value === 'full' || value === 'condensed' || value === 'hamburger' ? value : fallback;
}

function asSearchMode(value: unknown, fallback: SiteNavigationTopBarSearchMode): SiteNavigationTopBarSearchMode {
  return value === 'icon' || value === 'field' || value === 'menu' ? value : fallback;
}

function asAiMode(value: unknown, fallback: SiteNavigationTopBarAiMode): SiteNavigationTopBarAiMode {
  return value === 'button' || value === 'icon' ? value : fallback;
}

function asMenuOpenMode(value: unknown, fallback: SiteNavigationTopBarMenuOpenMode): SiteNavigationTopBarMenuOpenMode {
  return value === 'drawer' || value === 'fullscreen' ? value : fallback;
}

function asTopBarBackgroundColor(value: unknown, fallback: string) {
  if (typeof value !== 'string') return fallback;
  const normalized = value.trim().toUpperCase();
  return /^#[0-9A-F]{6}$/.test(normalized) ? normalized : fallback;
}

function asTopBarFontFamily(
  value: unknown,
  fallback: SiteNavigationTopBarFontFamily
): SiteNavigationTopBarFontFamily {
  return SITE_NAVIGATION_TOP_BAR_FONT_FAMILIES.includes(value as SiteNavigationTopBarFontFamily)
    ? value as SiteNavigationTopBarFontFamily
    : fallback;
}

function asTopBarFontStyle(
  value: unknown,
  fallback: SiteNavigationTopBarFontStyle
): SiteNavigationTopBarFontStyle {
  return SITE_NAVIGATION_TOP_BAR_FONT_STYLES.includes(value as SiteNavigationTopBarFontStyle)
    ? value as SiteNavigationTopBarFontStyle
    : fallback;
}

function asBoundedNumber(value: unknown, fallback: number, min: number, max: number, step = 1) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  const stepped = Math.round(numeric / step) * step;
  return Math.min(max, Math.max(min, stepped));
}

function asNullableBoundedNumber(value: unknown, fallback: number | null, min: number, max: number, step = 1) {
  if (value === null || value === undefined || value === '') return fallback;
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  const stepped = Math.round(numeric / step) * step;
  return Math.min(max, Math.max(min, stepped));
}

function normalizeSiteLayoutSettings(value: unknown): SiteNavigationSiteLayoutSettings {
  const record = asRecord(value);

  return {
    siteContentMaxWidthPx: asBoundedNumber(
      record.siteContentMaxWidthPx,
      DEFAULT_SITE_LAYOUT_SETTINGS.siteContentMaxWidthPx,
      960,
      1920
    ),
    siteGutterMinPx: asBoundedNumber(
      record.siteGutterMinPx,
      DEFAULT_SITE_LAYOUT_SETTINGS.siteGutterMinPx,
      0,
      64
    ),
    siteGutterMaxPx: asBoundedNumber(
      record.siteGutterMaxPx,
      DEFAULT_SITE_LAYOUT_SETTINGS.siteGutterMaxPx,
      0,
      96
    )
  };
}

function normalizeTopBarCenterOffset(value: unknown) {
  return asBoundedNumber(
    value,
    0,
    SITE_NAVIGATION_TOP_BAR_CENTER_OFFSET_MIN,
    SITE_NAVIGATION_TOP_BAR_CENTER_OFFSET_MAX,
    SITE_NAVIGATION_TOP_BAR_CENTER_OFFSET_STEP
  );
}

function asTopBarZoneWidthMode(value: unknown, fallback: SiteNavigationTopBarZoneWidthMode): SiteNavigationTopBarZoneWidthMode {
  return value === 'auto' || value === 'fixed' || value === 'fill' ? value : fallback;
}

function normalizeTopBarZoneWidthSettings(
  value: unknown,
  fallback: SiteNavigationTopBarZoneWidthSettings
): SiteNavigationTopBarZoneWidthSettings {
  const record = asRecord(value);
  const widthMode = asTopBarZoneWidthMode(record.widthMode, fallback.widthMode);

  return {
    widthMode,
    widthPx: widthMode === 'fixed'
      ? asNullableBoundedNumber(record.widthPx, fallback.widthPx ?? 240, 40, 1600)
      : null
  };
}

function normalizeTopBarZoneSettings(
  value: unknown,
  fallback: SiteNavigationTopBarZoneSettings
): SiteNavigationTopBarZoneSettings {
  const record = asRecord(value);

  return {
    left: normalizeTopBarZoneWidthSettings(record.left, fallback.left),
    center: normalizeTopBarZoneWidthSettings(record.center, fallback.center),
    right: normalizeTopBarZoneWidthSettings(record.right, fallback.right)
  };
}

function normalizeTopBarResponsiveSettings(
  device: SiteNavigationTopBarDevice,
  value: unknown,
  fallback: SiteNavigationTopBarResponsiveSettings
): SiteNavigationTopBarResponsiveSettings {
  const record = asRecord(value);
  const baseSettings = {
    widthMode: asTopBarWidthMode(record.widthMode, fallback.widthMode ?? 'match_content'),
    customMaxWidthPx: asNullableBoundedNumber(
      record.customMaxWidthPx,
      fallback.customMaxWidthPx ?? null,
      640,
      2400
    ),
    layoutMode: asTopBarConstraintLayoutMode(record.layoutMode, fallback.layoutMode ?? 'centered_nav'),
    columnGapPx: asBoundedNumber(record.columnGapPx, fallback.columnGapPx ?? 24, 0, 96),
    itemGapPx: asBoundedNumber(record.itemGapPx, fallback.itemGapPx ?? 12, 0, 64),
    backgroundColor: asTopBarBackgroundColor(
      record.backgroundColor,
      fallback.backgroundColor
    ),
    backgroundOpacityPercent: asBoundedNumber(
      record.backgroundOpacityPercent,
      fallback.backgroundOpacityPercent,
      0,
      100
    ),
    textColor: asTopBarBackgroundColor(
      record.textColor,
      fallback.textColor
    ),
    fontFamily: asTopBarFontFamily(
      record.fontFamily,
      fallback.fontFamily
    ),
    fontSizePx: asBoundedNumber(
      record.fontSizePx,
      fallback.fontSizePx,
      10,
      24
    ),
    fontWeight: asBoundedNumber(
      record.fontWeight,
      fallback.fontWeight,
      300,
      900,
      100
    ),
    fontStyle: asTopBarFontStyle(
      record.fontStyle,
      fallback.fontStyle
    )
  };
  const baseSettingsWithZones = {
    ...baseSettings,
    zones: normalizeTopBarZoneSettings(
      record.zones,
      fallback.zones ?? defaultTopBarZoneSettings(baseSettings.layoutMode)
    )
  };

  if (device === 'tablet') {
    return {
      ...baseSettingsWithZones,
      breakpointFrom: asBoundedNumber(record.breakpointFrom, fallback.breakpointFrom ?? 768, 320, 1920),
      breakpointTo: asBoundedNumber(record.breakpointTo, fallback.breakpointTo ?? 1024, 320, 1920),
      navigationMode: asNavigationMode(record.navigationMode, fallback.navigationMode ?? 'condensed'),
      maxVisibleLinks: asBoundedNumber(record.maxVisibleLinks, fallback.maxVisibleLinks ?? 3, 1, 8),
      searchMode: 'icon',
      aiMode: asAiMode(record.aiMode, fallback.aiMode ?? 'button'),
      cartBadge: asVisible(record.cartBadge ?? fallback.cartBadge),
      height: asBoundedNumber(record.height, fallback.height, 48, 120),
      paddingX: asBoundedNumber(record.paddingX, fallback.paddingX, 0, 80),
      sticky: asVisible(record.sticky ?? fallback.sticky),
      shadow: asVisible(record.shadow ?? fallback.shadow)
    };
  }

  if (device === 'mobile') {
    return {
      ...baseSettingsWithZones,
      breakpointTo: asBoundedNumber(record.breakpointTo, fallback.breakpointTo ?? 767, 320, 1200),
      navigationMode: 'hamburger',
      menuOpenMode: asMenuOpenMode(record.menuOpenMode, fallback.menuOpenMode ?? 'drawer'),
      actionPriority: ['search', 'ai', 'cart'],
      searchMode: 'menu',
      aiMode: asAiMode(record.aiMode, fallback.aiMode ?? 'button'),
      cartBadge: asVisible(record.cartBadge ?? fallback.cartBadge),
      height: asBoundedNumber(record.height, fallback.height, 44, 96),
      paddingX: asBoundedNumber(record.paddingX, fallback.paddingX, 0, 48),
      sticky: asVisible(record.sticky ?? fallback.sticky),
      shadow: asVisible(record.shadow ?? fallback.shadow),
      safeArea: true
    };
  }

  return {
    ...baseSettingsWithZones,
    navigationMode: asNavigationMode(record.navigationMode, fallback.navigationMode ?? 'full'),
    searchMode: 'icon',
    aiMode: asAiMode(record.aiMode, fallback.aiMode ?? 'button'),
    height: asBoundedNumber(record.height, fallback.height, 56, 120),
    paddingX: asBoundedNumber(record.paddingX, fallback.paddingX, 0, 96),
    sticky: asVisible(record.sticky ?? fallback.sticky),
    shadow: asVisible(record.shadow ?? fallback.shadow),
    cartBadge: asVisible(record.cartBadge ?? fallback.cartBadge)
  };
}

function normalizeTopBarResponsiveItems(
  device: SiteNavigationTopBarDevice,
  value: unknown,
  fallbackItems: SiteNavigationTopBarResponsiveItem[],
  sourceSearchMode: SiteNavigationTopBarSearchMode = 'icon'
) {
  const hasExplicitItems = Array.isArray(value);
  const rawItems = hasExplicitItems ? value : [];
  const rawItemsById = new Map<SiteNavigationTopBarElementId, Record<string, unknown>>();
  const fallbackItemsById = new Map(fallbackItems.map((item) => [item.id, item]));

  rawItems.forEach((rawItem) => {
    const itemRecord = asRecord(rawItem);
    const itemId = itemRecord.id;
    if (SITE_NAVIGATION_TOP_BAR_ELEMENT_IDS.some((id) => id === itemId)) {
      rawItemsById.set(itemId as SiteNavigationTopBarElementId, itemRecord);
    }
  });

  const itemIds = hasExplicitItems
    ? Array.from(rawItemsById.keys())
    : [...SITE_NAVIGATION_TOP_BAR_ELEMENT_IDS];

  return itemIds.map((id, index): SiteNavigationTopBarResponsiveItem => {
    const fallback = fallbackItemsById.get(id) ?? {
      id,
      slot: 'left',
      orderIndex: index + 1,
      widthMode: 'auto',
      fixedWidthPx: null,
      minWidthPx: null,
      maxWidthPx: null,
      marginBeforePx: 0,
      marginAfterPx: 0,
      xPx: 0,
      xRatio: 0,
      widthPx: 88,
      widthEditable: false,
      zIndex: index + 1,
      region: 'left',
      visible: true,
      offsetFromCenter: 0,
      position: index
    };
    const raw = rawItemsById.get(id);

    const slot = asTopBarSlot(raw?.slot, fallback.slot);
    const isCollapsedSearch = id === 'search' && slot !== 'menu';
    const widthMode = isCollapsedSearch
      ? 'fixed'
      : asTopBarItemWidthMode(raw?.widthMode, fallback.widthMode);
    const configuredFixedWidthPx = asNullableBoundedNumber(raw?.fixedWidthPx, fallback.fixedWidthPx, 0, 1200);
    const fixedWidthPx = isCollapsedSearch
      ? SITE_NAVIGATION_TOP_BAR_SEARCH_COLLAPSED_WIDTH_PX
      : configuredFixedWidthPx;
    const placementBoundsWidth = DEFAULT_TOP_BAR_PLACEMENT_BOUNDS_WIDTH[device];
    const rawWidthPx = asBoundedNumber(
      raw?.widthPx,
      fallback.widthPx ?? fixedWidthPx ?? 88,
      1,
      1600
    );
    const rawXPx = asBoundedNumber(raw?.xPx, fallback.xPx, 0, 2400);
    const rawXRatio = asBoundedNumber(
      raw?.xRatio,
      placementBoundsWidth > 0 ? rawXPx / placementBoundsWidth : fallback.xRatio,
      0,
      1,
      0.0001
    );
    let widthPx = rawWidthPx;
    let xPx = rawXPx;
    let xRatio = rawXRatio;

    if (isCollapsedSearch) {
      const previousWidthPx = Math.max(
        rawWidthPx,
        configuredFixedWidthPx ?? 0,
        sourceSearchMode === 'field'
          ? getSiteNavigationTopBarSearchReservedWidth(device)
          : SITE_NAVIGATION_TOP_BAR_SEARCH_COLLAPSED_WIDTH_PX
      );
      const hasRawXRatio =
        raw?.xRatio !== null &&
        raw?.xRatio !== undefined &&
        raw?.xRatio !== '' &&
        Number.isFinite(Number(raw.xRatio));
      const previousMaxXPx = Math.max(0, placementBoundsWidth - previousWidthPx);
      const previousXPx = Math.min(
        previousMaxXPx,
        Math.max(0, hasRawXRatio ? rawXRatio * placementBoundsWidth : rawXPx)
      );
      const nextMaxXPx = Math.max(
        0,
        placementBoundsWidth - SITE_NAVIGATION_TOP_BAR_SEARCH_COLLAPSED_WIDTH_PX
      );
      const nextXPx = Math.round(
        Math.min(
          nextMaxXPx,
          Math.max(
            0,
            previousXPx + previousWidthPx - SITE_NAVIGATION_TOP_BAR_SEARCH_COLLAPSED_WIDTH_PX
          )
        )
      );

      widthPx = SITE_NAVIGATION_TOP_BAR_SEARCH_COLLAPSED_WIDTH_PX;
      xPx = nextXPx;
      xRatio = asBoundedNumber(
        placementBoundsWidth > 0 ? nextXPx / placementBoundsWidth : 0,
        0,
        0,
        1,
        0.0001
      );
    }

    return {
      id,
      slot,
      orderIndex: asBoundedNumber(raw?.orderIndex, fallback.orderIndex, 0, 99),
      widthMode,
      fixedWidthPx,
      minWidthPx: asNullableBoundedNumber(raw?.minWidthPx, fallback.minWidthPx, 0, 1200),
      maxWidthPx: asNullableBoundedNumber(raw?.maxWidthPx, fallback.maxWidthPx, 0, 1600),
      marginBeforePx: asBoundedNumber(raw?.marginBeforePx, fallback.marginBeforePx, -128, 128),
      marginAfterPx: asBoundedNumber(raw?.marginAfterPx, fallback.marginAfterPx, -128, 128),
      xPx,
      xRatio,
      widthPx,
      widthEditable: isCollapsedSearch
        ? false
        : asVisible(raw?.widthEditable ?? fallback.widthEditable),
      zIndex: asBoundedNumber(raw?.zIndex, fallback.zIndex, 0, 999),
      region: asTopBarRegion(raw?.region, fallback.region),
      visible: asVisible(raw?.visible ?? fallback.visible),
      offsetFromCenter: normalizeTopBarCenterOffset(raw?.offsetFromCenter ?? fallback.offsetFromCenter),
      position: asPosition(raw?.position, fallback.position)
    };
  }).sort((first, second) => first.position - second.position).map((item, position) => ({ ...item, position }));
}

export function normalizeSiteNavigationTopBarResponsiveLayouts(
  value: unknown
): SiteNavigationTopBarResponsiveLayouts {
  const record = asRecord(value);
  const defaultLayouts = DEFAULT_SITE_NAVIGATION_TOP_BAR_LAYOUT.responsive;

  return SITE_NAVIGATION_TOP_BAR_DEVICES.reduce((layouts, device) => {
    const rawLayout = asRecord(record[device]);
    const rawSettings = asRecord(rawLayout.settings);
    const fallback = defaultLayouts[device];
    const sourceSearchMode = device === 'mobile'
      ? 'menu'
      : asSearchMode(rawSettings.searchMode, fallback.settings.searchMode ?? 'icon');

    const settings = normalizeTopBarResponsiveSettings(device, rawLayout.settings, fallback.settings);

    layouts[device] = {
      items: normalizeTopBarResponsiveItems(device, rawLayout.items, fallback.items, sourceSearchMode),
      settings
    };

    return layouts;
  }, {} as SiteNavigationTopBarResponsiveLayouts);
}

export function normalizeSiteNavigationTopBarLayout(value: unknown): SiteNavigationTopBarLayout {
  const record = asRecord(value);
  return {
    responsive: normalizeSiteNavigationTopBarResponsiveLayouts(record.responsive)
  };
}

export function toLucideIconName(icon: unknown): SiteNavigationItemIcon {
  if (typeof icon !== 'string') return defaultIcon;
  const normalizedIcon = icon.trim().toLowerCase();
  if (!normalizedIcon) return defaultIcon;
  return lucideIconNamePattern.test(normalizedIcon) ? normalizedIcon : defaultIcon;
}

function asIcon(value: unknown): SiteNavigationItemIcon {
  return toLucideIconName(value);
}

function sortByPosition<T extends { position: number }>(items: T[]) {
  return [...items].sort((a, b) => a.position - b.position);
}

function getDesktopGroupSpan(group: SiteNavigationGroup) {
  return Math.min(Math.max(group.desktopSpan ?? 1, 1), SITE_NAVIGATION_DESKTOP_COLUMN_COUNT);
}

export function getSiteNavigationDesktopGroupLinkColumns(
  group: SiteNavigationGroup,
  slotSpan = getDesktopGroupSpan(group)
): SiteNavigationLink[][] {
  const finiteSlotSpan = Number.isFinite(slotSpan) ? Math.trunc(slotSpan) : 1;
  const columnCount = Math.min(Math.max(finiteSlotSpan, 1), SITE_NAVIGATION_DESKTOP_COLUMN_COUNT);
  const pageLinks = group.links.slice(0, columnCount * SITE_NAVIGATION_DESKTOP_LINK_ROWS);

  return Array.from({ length: columnCount }, (_, columnIndex) =>
    pageLinks.filter((_, linkIndex) => linkIndex % columnCount === columnIndex)
  );
}

export function getSiteNavigationDesktopGroupDividerVisibility(
  sourceGroupIds: readonly (string | undefined)[]
): [boolean, boolean] {
  const hasBoundaryAfterColumn = (columnIndex: number) => {
    const sourceGroupId = sourceGroupIds[columnIndex];
    const nextSourceGroupId = sourceGroupIds[columnIndex + 1];
    return Boolean(sourceGroupId && nextSourceGroupId && sourceGroupId !== nextSourceGroupId);
  };

  return [hasBoundaryAfterColumn(0), hasBoundaryAfterColumn(1)];
}

export function getSiteNavigationDesktopGroupPlacements(groups: SiteNavigationGroup[]): Record<string, SiteNavigationDesktopGroupPlacement> {
  const placements: Record<string, SiteNavigationDesktopGroupPlacement> = {};
  let pageIndex = 0;
  let slotIndex = 0;

  for (const group of groups) {
    const slotSpan = getDesktopGroupSpan(group);

    if (slotIndex > 0 && slotIndex + slotSpan > SITE_NAVIGATION_DESKTOP_COLUMN_COUNT) {
      pageIndex += 1;
      slotIndex = 0;
    }

    placements[group.id] = {
      pageIndex,
      pageNumber: pageIndex + 1,
      slotIndex,
      slotSpan
    };

    slotIndex += slotSpan;

    if (slotIndex >= SITE_NAVIGATION_DESKTOP_COLUMN_COUNT) {
      slotIndex = SITE_NAVIGATION_DESKTOP_COLUMN_COUNT;
    }
  }

  return placements;
}

export function cloneDefaultSiteNavigationConfig() {
  return clone(DEFAULT_SITE_NAVIGATION_CONFIG);
}

export function normalizeSiteNavigationConfig(value: unknown): SiteNavigationConfig {
  const record = asRecord(value);
  const rawItems = Array.isArray(record.items) ? record.items : [];
  const siteLayout = normalizeSiteLayoutSettings(record.siteLayout);
  const topBarLayout = normalizeSiteNavigationTopBarLayout(record.topBarLayout);
  const topBarInitialLayout = normalizeSiteNavigationTopBarLayout(record.topBarInitialLayout);
  const updatedAt = typeof record.updatedAt === 'string' ? record.updatedAt : null;
  const footer = normalizeHomepageFooterSettings(record.footer);

  if (rawItems.length === 0) {
    return {
      ...cloneDefaultSiteNavigationConfig(),
      siteLayout,
      footer,
      topBarLayout,
      topBarInitialLayout,
      updatedAt
    };
  }

  const items = rawItems.map((rawItem, itemIndex): SiteNavigationTopLevelItem => {
    const itemRecord = asRecord(rawItem);
    const rawGroups = Array.isArray(itemRecord.groups) ? itemRecord.groups : [];

    return {
      id: asString(itemRecord.id, `nav-${itemIndex + 1}`),
      label: asString(itemRecord.label, `Element ${itemIndex + 1}`),
      href: asString(itemRecord.href, ''),
      visible: asVisible(itemRecord.visible),
      position: asPosition(itemRecord.position, itemIndex),
      groups: rawGroups.map((rawGroup, groupIndex): SiteNavigationGroup => {
        const groupRecord = asRecord(rawGroup);
        const rawLinks = Array.isArray(groupRecord.links) ? groupRecord.links : [];

        return {
          id: asString(groupRecord.id, `group-${itemIndex + 1}-${groupIndex + 1}`),
          label: asString(groupRecord.label, `Skupina ${groupIndex + 1}`),
          href: asString(groupRecord.href, ''),
          visible: asVisible(groupRecord.visible),
          position: asPosition(groupRecord.position, groupIndex),
          desktopSpan: asDesktopSpan(groupRecord.desktopSpan),
          links: rawLinks.map((rawLink, linkIndex): SiteNavigationLink => {
            const linkRecord = asRecord(rawLink);

            return {
              id: asString(linkRecord.id, `link-${itemIndex + 1}-${groupIndex + 1}-${linkIndex + 1}`),
              label: asString(linkRecord.label, `Povezava ${linkIndex + 1}`),
              description: asString(linkRecord.description, ''),
              href: asString(linkRecord.href, '#'),
              icon: asIcon(linkRecord.icon),
              visible: asVisible(linkRecord.visible),
              position: asPosition(linkRecord.position, linkIndex)
            };
          })
        };
      })
    };
  });

  return {
    siteLayout,
    items: sortByPosition(items).map((item, itemIndex) => ({
      ...item,
      position: itemIndex,
      groups: sortByPosition(item.groups).map((group, groupIndex) => ({
        ...group,
        position: groupIndex,
        links: sortByPosition(group.links).map((navigationLink, linkIndex) => ({
          ...navigationLink,
          position: linkIndex
        }))
      }))
    })),
    footer,
    topBarLayout,
    topBarInitialLayout,
    updatedAt
  };
}

export function getVisibleSiteNavigationItems(config: SiteNavigationConfig): SiteNavigationTopLevelItem[] {
  return normalizeSiteNavigationConfig(config).items
    .filter((item) => item.visible)
    .map((item) => ({
      ...item,
      groups: item.groups
        .filter((group) => group.visible)
        .map((group) => ({
          ...group,
          links: group.links.filter((navigationLink) => navigationLink.visible)
        }))
        .filter((group) => group.links.length > 0)
    }));
}

export function toStoredSiteNavigationConfig(config: unknown): SiteNavigationConfig {
  const normalized = normalizeSiteNavigationConfig(config);
  return {
    siteLayout: normalized.siteLayout,
    items: normalized.items,
    footer: normalized.footer,
    topBarLayout: normalized.topBarLayout,
    topBarInitialLayout: normalized.topBarInitialLayout
  };
}
