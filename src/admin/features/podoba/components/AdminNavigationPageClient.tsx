'use client';

import {
  Fragment,
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type ReactNode
} from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent
} from '@dnd-kit/core';
import { SortableContext, arrayMove, rectSortingStrategy, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  cloneDefaultSiteNavigationConfig,
  DEFAULT_SITE_LAYOUT_SETTINGS,
  DEFAULT_SITE_NAVIGATION_TOP_BAR_LAYOUT,
  getSiteNavigationDesktopGroupPlacements,
  SITE_NAVIGATION_TOP_BAR_SEARCH_COLLAPSED_WIDTH_PX,
  normalizeSiteNavigationConfig,
  SITE_CONTENT_MAX_WIDTH_PX,
  SITE_NAVIGATION_ADMIN_SELECTION_ROW_GAP_PX,
  SITE_NAVIGATION_TOP_BAR_LOGO_WIDTH_PX,
  type SiteNavigationDesktopGroupPlacement,
  type SiteNavigationConfig,
  type SiteNavigationGroup,
  type SiteNavigationItemIcon,
  type SiteNavigationLink,
  type SiteNavigationTopBarAiMode,
  type SiteNavigationTopBarDevice,
  type SiteNavigationTopBarElementId,
  type SiteNavigationSiteLayoutSettings,
  type SiteNavigationTopBarItemWidthMode,
  type SiteNavigationTopBarLayout,
  type SiteNavigationTopBarNavigationMode,
  type SiteNavigationTopBarResponsiveItem,
  type SiteNavigationTopBarResponsiveSettings,
  type SiteNavigationTopBarSearchMode,
  type SiteNavigationTopBarSlot,
  type SiteNavigationTopBarWidthMode,
  type SiteNavigationTopBarZoneSettings,
  type SiteNavigationTopLevelItem
} from '@/shared/domain/navigation/siteNavigation';
import {
  HOMEPAGE_SOCIAL_TYPES,
  homepageSocialTypeLabels,
  type HomepageFooterColumn,
  type HomepageFooterContact,
  type HomepageFooterLink,
  type HomepageFooterSettings,
  type HomepageFooterSocialLink
} from '@/shared/domain/landing/landingPage';
import { toGlobalStyleCssVariables, type GlobalStyleConfig } from '@/shared/domain/style/globalStyle';
import {
  HOMEPAGE_WEBSITE_FONT_FAMILIES,
  type WebsiteFontFamily
} from '@/shared/domain/style/fontFamilies';
import { AdminPageHeader } from '@/shared/ui/admin-primitives';
import { Button } from '@/shared/ui/button';
import { CompactHexColorField, normalizeHexColor } from '@/shared/ui/admin-controls/CompactHexColorField';
import AdminCheckbox from '@/shared/ui/checkbox/admin-checkbox';
import { IconButton } from '@/shared/ui/icon-button';
import { Input } from '@/shared/ui/input';
import { ActionUndoIcon, PlusIcon, SaveIcon, TrashCanIcon } from '@/shared/ui/icons/AdminActionIcons';
import {
  SiteNavigationLucideIcon,
  siteNavigationLucideIconNames,
  toSiteNavigationLucideIconName
} from '@/shared/ui/icons/SiteNavigationLucideIcon';
import { useDropdownDismiss } from '@/shared/ui/dropdown/use-dropdown-dismiss';
import { MenuPanel } from '@/shared/ui/menu';
import RowActionsDropdown from '@/shared/ui/table/row-actions-dropdown';
import {
  adminTableNeutralIconButtonClassName,
  adminTablePrimaryButtonClassName,
  adminTableSelectedDangerIconButtonClassName
} from '@/shared/ui/admin-table/standards';
import {
  adminActionMenuItemTokenClasses,
  adminControlFocusTokenClasses,
  adminDragSurfaceTokenClasses,
  adminEditorPreviewContentTokenClasses,
  adminEditorPreviewFrameTokenClasses,
  adminEditorPreviewSurfaceTokenClasses,
  adminFilterInputTokenClasses,
  adminInlineEditTriggerTokenClasses,
  adminMiniIconButtonTokenClasses,
  adminSelectableIconBadgeTokenClasses,
  adminTinyNumberInputTokenClasses,
  iconButtonTokenClasses
} from '@/shared/ui/theme/tokens';
import { useToast } from '@/shared/ui/toast';
import SiteFooter, {
  type SiteFooterContactField,
  type SiteFooterEditorAdapter,
  type SiteFooterLinkPlacement
} from '@/commercial/components/SiteFooter';
import SiteHeader from '@/commercial/components/SiteHeader';
import { SiteLogo, useSiteLogoConfig } from '@/commercial/components/SiteLogo';
import { COMMERCIAL_STOREFRONT_SCALE, toCommercialStorefrontLogicalPx } from '@/commercial/components/commercialStorefrontScale';
import {
  resolveSiteLogoDisplaySize,
  type SiteLogoDisplaySize,
  type SiteLogoPurposeId
} from '@/shared/domain/logo/siteLogo';
import { sortTopBarTableItemsByResolvedX } from '../lib/topBarTableOrder';
import AdminPodobaTabs from './AdminPodobaTabs';
import styles from './AdminNavigationAppearance.module.css';
import {
  AppearanceEditorAlignmentControl,
  AppearanceEditorCompactSelect,
  AppearanceEditorNumberInput
} from './AppearanceEditorToolbarPrimitives';

const compactInputClassName = adminFilterInputTokenClasses;
const numberInputNoSpinnerClassName =
  '[appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none';
const topBarElementRowGridClassName = 'grid-cols-[34px_minmax(140px,1fr)_128px_104px_138px_56px_56px]';
const topBarElementRowMinWidthClassName = 'min-w-[738px]';
const topBarUnitAdornmentBaseClassName =
  'ml-auto inline-flex h-full min-w-8 shrink-0 items-center justify-center whitespace-nowrap border-l border-slate-200 bg-slate-50 px-2 font-[\'Inter\',system-ui,sans-serif] text-[12px] font-medium leading-none !text-slate-500';
const topBarUnitAdornmentSuffixClassName = topBarUnitAdornmentBaseClassName;
const topBarActiveFieldClassName =
  '!border-[color:var(--blue-500)] shadow-[0_0_0_1px_color-mix(in_srgb,var(--blue-500)_34%,transparent)]';
const navEditorRowHoverClassName = 'bg-slate-50';
const topBarPreviewRulerLeftGutterPx = 28;
const topBarPreviewRulerRightGutterPx = topBarPreviewRulerLeftGutterPx;
const topBarPreviewRulerTopGutterPx = 14;
const topBarPreviewGridLineStepPx = 50;
const topBarTechnicalPreviewVisualTopbarHeightPx =
  DEFAULT_SITE_NAVIGATION_TOP_BAR_LAYOUT.responsive.tablet.settings.height * COMMERCIAL_STOREFRONT_SCALE;
const topBarTechnicalPreviewSlotHeightPx = Math.ceil(
  topBarTechnicalPreviewVisualTopbarHeightPx + topBarPreviewRulerTopGutterPx + 2
);
const topBarLogoLinkPaddingFinalPx = 10 * COMMERCIAL_STOREFRONT_SCALE;
const iconPickerPageSize = 24;
const topActionSaveButtonClassName =
  `gap-2 ${adminTablePrimaryButtonClassName} !h-8 !leading-none !tracking-[0] disabled:!border-transparent disabled:!bg-[color:var(--blue-500)] disabled:!text-white disabled:!opacity-50`;
const topSaveActionButtonIconClassName = 'h-[15.3px] w-[15.3px]';
const iconSearchAliases: Record<string, string[]> = {
  box: ['cube', 'cuboid', 'package', 'boxes', 'container'],
  class: ['school', 'graduation-cap', 'book-open', 'presentation'],
  cube: ['cuboid', 'box', 'boxes', 'package', 'package-2', 'package-open', 'package-check', 'container', 'blocks'],
  cubes: ['cuboid', 'box', 'boxes', 'package', 'container', 'blocks'],
  education: ['school', 'graduation-cap', 'book-open', 'presentation'],
  group: ['users', 'users-round', 'user-round-check'],
  hardhat: ['hard-hat', 'helmet', 'shield'],
  package: ['box', 'boxes', 'container', 'archive'],
  parcel: ['package', 'package-open', 'box', 'container'],
  reload: ['refresh-cw', 'rotate-cw', 'repeat'],
  safety: ['shield', 'hard-hat', 'lock'],
  teacher: ['presentation', 'school', 'graduation-cap'],
  team: ['users', 'users-round', 'group'],
  tool: ['wrench', 'hammer', 'drill', 'screwdriver', 'pencil-ruler'],
  tools: ['wrench', 'hammer', 'drill', 'screwdriver', 'pencil-ruler']
};
type LucideIconName = (typeof siteNavigationLucideIconNames)[number];
type IconSearchTerm = { term: string; weight: number };
type GroupColumnCount = NonNullable<SiteNavigationGroup['desktopSpan']>;

const groupColumnSpanClassNames: Record<GroupColumnCount, string> = {
  1: '',
  2: 'lg:col-span-2',
  3: 'lg:col-span-3',
  4: 'lg:col-span-3'
};

const groupLinkGridClassNames: Record<GroupColumnCount, string> = {
  1: '',
  2: 'xl:grid-cols-2',
  3: 'xl:grid-cols-3',
  4: 'xl:grid-cols-4'
};

const columnCountInputClassName = adminTinyNumberInputTokenClasses;
function toGroupColumnCount(value: SiteNavigationGroup['desktopSpan']): GroupColumnCount {
  return value ?? 1;
}

function parseGroupColumnCount(value: string): GroupColumnCount | null {
  const normalizedValue = value.replace(/[^1-4]/g, '').slice(0, 1);
  if (!normalizedValue) return null;
  return Number(normalizedValue) as GroupColumnCount;
}

function normalizeIconSearchValue(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function addWeightedSearchTerm(terms: Map<string, number>, term: string, weight: number) {
  const normalizedTerm = normalizeIconSearchValue(term).replace(/\s+/g, '-');
  if (!normalizedTerm) return;
  const currentWeight = terms.get(normalizedTerm);
  if (currentWeight === undefined || weight < currentWeight) terms.set(normalizedTerm, weight);
}

function buildIconSearchTerms(query: string) {
  const normalizedQuery = normalizeIconSearchValue(query);
  const queryWords = normalizedQuery.split(' ').filter(Boolean);
  const weightedTerms = new Map<string, number>();

  addWeightedSearchTerm(weightedTerms, queryWords.join('-'), 0);
  queryWords.forEach((word, wordIndex) => {
    addWeightedSearchTerm(weightedTerms, word, 8 + wordIndex);
    (iconSearchAliases[word] ?? []).forEach((alias, aliasIndex) => addWeightedSearchTerm(weightedTerms, alias, 16 + aliasIndex));
  });
  (iconSearchAliases[queryWords.join('-')] ?? []).forEach((alias, aliasIndex) => addWeightedSearchTerm(weightedTerms, alias, 12 + aliasIndex));

  return [...weightedTerms.entries()].map(([term, weight]) => ({ term, weight }));
}

function scoreIconSearchResult(iconName: string, searchTerms: IconSearchTerm[]) {
  if (searchTerms.length === 0) return 0;

  const iconSegments = iconName.split('-');
  let bestScore = Number.POSITIVE_INFINITY;

  for (const { term, weight } of searchTerms) {
    let termScore: number | null = null;

    if (iconName === term) termScore = 0;
    else if (iconName.startsWith(`${term}-`)) termScore = 4;
    else if (iconSegments.includes(term)) termScore = 8;
    else if (iconName.includes(`-${term}-`)) termScore = 12;
    else if (iconName.includes(term)) termScore = 20;
    else if (iconSegments.some((segment) => segment.startsWith(term))) termScore = 24;

    if (termScore !== null) bestScore = Math.min(bestScore, weight + termScore);
  }

  return Number.isFinite(bestScore) ? bestScore : null;
}
const editorVars = {
  '--navbar-link-default': '#4d4d4d',
  '--navbar-link-hover': '#171717',
  '--navbar-link-current': '#171717',
  '--navbar-trigger-open-bg': '#ebebeb',
  '--navbar-dropdown-heading': '#4d4d4d',
  '--navbar-dropdown-title': '#171717',
  '--navbar-dropdown-description': '#636363',
  '--navbar-dropdown-border': '#e6e6e6',
  '--navbar-dropdown-border-hover': '#dcdcdc',
  '--navbar-dropdown-selection-row-gap': `${SITE_NAVIGATION_ADMIN_SELECTION_ROW_GAP_PX}px`
} as CSSProperties;

function createId(prefix: string) {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return `${prefix}-${crypto.randomUUID()}`;
  return `${prefix}-${Date.now()}-${Math.round(Math.random() * 100000)}`;
}

function comparable(config: SiteNavigationConfig) {
  const normalized = normalizeSiteNavigationConfig(config);
  return JSON.stringify({
    siteLayout: normalized.siteLayout,
    items: normalized.items,
    footer: normalized.footer,
    topBarLayout: normalized.topBarLayout,
    topBarInitialLayout: normalized.topBarInitialLayout
  });
}

function withPositions<T extends { position?: number }>(items: T[]) {
  return items.map((item, index) => ({ ...item, position: index }));
}

function reorderById<T extends { id: string; position?: number }>(items: T[], activeId: string, overId: string) {
  const oldIndex = items.findIndex((item) => item.id === activeId);
  const newIndex = items.findIndex((item) => item.id === overId);
  if (oldIndex < 0 || newIndex < 0 || oldIndex === newIndex) return items;
  return withPositions(arrayMove(items, oldIndex, newIndex));
}

function DragGlyph({ className = 'h-[17px] w-[17px]' }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" className={className} fill="currentColor" aria-hidden="true">
      <circle cx="7" cy="5" r="1.15" />
      <circle cx="13" cy="5" r="1.15" />
      <circle cx="7" cy="10" r="1.15" />
      <circle cx="13" cy="10" r="1.15" />
      <circle cx="7" cy="15" r="1.15" />
      <circle cx="13" cy="15" r="1.15" />
    </svg>
  );
}

function ChevronGlyph({ className = 'h-4 w-4 opacity-60' }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" className={className} fill="none" aria-hidden="true">
      <path d="m4 6 4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function GridGlyph({ className = 'h-3.5 w-3.5' }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" className={className} fill="none" aria-hidden="true">
      <path d="M3 3.5h10M3 8h10M3 12.5h10M3.5 3v10M8 3v10M12.5 3v10" stroke="currentColor" strokeWidth="1.15" strokeLinecap="round" />
    </svg>
  );
}

function EyeGlyph({ visible, className = 'h-[17px] w-[17px]' }: { visible: boolean; className?: string }) {
  return (
    <svg viewBox="0 0 20 20" className={className} fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
      <path d="M2.5 10s2.7-5 7.5-5 7.5 5 7.5 5-2.7 5-7.5 5-7.5-5-7.5-5Z" />
      <circle cx="10" cy="10" r="2.2" />
      {visible ? null : <path d="M3.5 3.5 16.5 16.5" />}
    </svg>
  );
}

function NavigationIconGlyph({ icon, className = 'h-[18px] w-[18px]' }: { icon: SiteNavigationItemIcon; className?: string }) {
  return <SiteNavigationLucideIcon icon={icon} className={className} />;
}

function DotsGlyph({ className = 'h-[15px] w-[15px]' }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" className={className} fill="currentColor" aria-hidden="true">
      <circle cx="10" cy="4.5" r="1.4" />
      <circle cx="10" cy="10" r="1.4" />
      <circle cx="10" cy="15.5" r="1.4" />
    </svg>
  );
}

const topBarLayoutLabels: Record<SiteNavigationTopBarElementId, string> = {
  logo: 'Logotip',
  navigation: 'Navigacija',
  search: 'Iskanje',
  ai: 'Vprašaj AI',
  cart: 'Košarica'
};

function estimateTopBarTextWidth(value: string) {
  return Math.ceil(value.length * 7.2);
}

type TopBarSearchVariant = 'icon' | 'input';

function getTopBarSearchVariant(settings: Pick<SiteNavigationTopBarResponsiveSettings, 'searchMode'>): TopBarSearchVariant {
  return settings.searchMode === 'field' ? 'input' : 'icon';
}

function estimateTopBarElementWidth({
  id,
  items,
  device,
  settings
}: {
  id: SiteNavigationTopBarElementId;
  items: SiteNavigationTopLevelItem[];
  device: SiteNavigationTopBarDevice;
  settings: SiteNavigationTopBarResponsiveSettings;
}) {
  if (id === 'logo') return SITE_NAVIGATION_TOP_BAR_LOGO_WIDTH_PX;
  if (id === 'search') return SITE_NAVIGATION_TOP_BAR_SEARCH_COLLAPSED_WIDTH_PX;
  if (id === 'ai') return settings.aiMode === 'icon' ? 32 : 116;
  if (id === 'cart') return 32;

  if (device === 'mobile' || settings.navigationMode === 'hamburger') return 32;

  const visibleItems = items.filter((item) => item.visible);
  const previewItems = settings.navigationMode === 'condensed'
    ? visibleItems.slice(0, settings.maxVisibleLinks ?? 3)
    : visibleItems;
  const itemWidths = previewItems.map((item) => 24 + estimateTopBarTextWidth(item.label) + (item.groups.length > 0 ? 18 : 0));
  const gaps = Math.max(0, previewItems.length - 1) * 5;
  const overflowWidth = settings.navigationMode === 'condensed' && visibleItems.length > previewItems.length
    ? 37
    : 0;

  return Math.round(itemWidths.reduce((total, width) => total + width, 0) + gaps + overflowWidth);
}

const topBarDeviceLabels: Record<SiteNavigationTopBarDevice, string> = {
  desktop: 'Desktop',
  tablet: 'Tablica',
  mobile: 'Mobilno'
};

const topBarSlotLabels: Record<SiteNavigationTopBarSlot, string> = {
  left: 'Levo',
  center: 'Sredina',
  right: 'Desno',
  menu: 'Meni'
};

const topBarWidthModeLabels: Record<SiteNavigationTopBarWidthMode, string> = {
  match_content: 'Vsebina',
  custom: 'Po meri',
  full: 'Celotna stran'
};

const topBarFontWeightOptions = [
  { value: 300, label: '300' },
  { value: 400, label: '400' },
  { value: 500, label: '500' },
  { value: 600, label: '600' },
  { value: 700, label: '700' },
  { value: 800, label: '800' },
  { value: 900, label: '900' }
] as const;

const topBarFontStyleOptions: Array<{
  value: SiteNavigationTopBarResponsiveSettings['fontStyle'];
  label: string;
}> = [
  { value: 'normal', label: 'Navadno' },
  { value: 'italic', label: 'Ležeče' }
];

const topBarItemWidthModeLabels: Record<SiteNavigationTopBarItemWidthMode, string> = {
  auto: 'Samodejno',
  fixed: 'Fiksno',
  fill: 'Zapolni'
};

const topBarHelpCopy = {
  siteContentWidth:
    'Največja širina glavne vsebine strani. Ko je zgornja vrstica nastavljena na "Vsebina", uporablja isto skupno širino. Primer: 1280 px pomeni, da sta vsebina strani in elementi v zgornji vrstici poravnani na isti levi in desni rob.',
  gutterMin:
    'Najmanjši notranji rob strani na ozkih zaslonih. Primer: 16 px zagotovi, da se vsebina in zgornja vrstica ne dotikata roba zaslona na mobilniku.',
  gutterMax:
    'Največji notranji rob strani na širših zaslonih. Primer: 32 px pomeni, da tudi na velikem zaslonu ostane prijeten stranski odmik.',
  topBarHeight:
    'Višina zgornje vrstice za izbrano napravo. Primer: 85 px na desktopu naredi vrstico višjo in zračnejšo; 56 px na mobilniku je bolj kompaktno.',
  columnGap:
    'Razmik med tremi glavnimi območji zgornje vrstice: levo, sredina in desno. Primer: večja vrednost bolj loči logotip, navigacijo in akcije.',
  itemGap:
    'Razmik med elementi znotraj istega območja. Primer: če sta Iskanje in Vprašaj AI oba na desni, ta vrednost določa prostor med njima.',
  headerPreview:
    'Vklopi živ predogled zgornje vrstice na vrhu admin strani. Predogled se spremeni takoj, shranjen pa je šele po kliku na Shrani.',
  widthMode:
    'Določa, kako široka je zgornja vrstica. Vsebina uporablja skupno širino strani, Po meri uporablja posebno max širino samo za zgornjo vrstico, Celotna stran pa raztegne vsebino čez celoten viewport z varnim robom.',
  customWidth:
    'Največja širina zgornje vrstice, kadar je izbran način Po meri. Primer: 1440 px omogoči širšo zgornjo vrstico kot glavno vsebino strani.',
  layoutMode:
    'Zgornja vrstica uporablja enotno postavitev: logotip levo, navigacija na sredini, akcije desno. Elemente med deli premikate z vlečenjem v predogledu.',
  slot:
    'Del zgornje vrstice določite z vlečenjem elementa v predogledu. Elementi v istem delu se razvrstijo po polju Vrstni red.',
  order:
    'Vrstni red znotraj istega območja. Manjša številka pride prej. Primer: na desni strani Vrstni red 1 za Iskanje, 2 za Vprašaj AI in 3 za Košarico prikaže elemente v tem vrstnem redu.',
  widthModeColumn:
    'Širina se določi glede na tip elementa. Logotip in iskalno polje imata urejeno širino, navigacija in besedilni gumbi pa uporabljajo naravno širino.',
  widthColumn:
    'Širina elementa v px, kadar je način širine Fiksno. Primer: logotip 88 px ohrani stalno širino logotipnega območja.',
  offsetsColumn:
    'Odmiki prikazujejo razdaljo v px do najbližjih vidnih elementov levo in desno. Prvi vidni element ima levo 0, zadnji vidni element ima desno 0.',
  breakpoint:
    'Prelomna širina pove, pri katerih širinah zaslona veljajo nastavitve naprave. Primer: Tablica od 768 px do 1024 px pomeni, da se tablična postavitev uporabi v tem razponu.',
  tabletNavigation:
    'Polna prikaže vse navigacijske povezave. Strnjena prikaže samo nastavljeno število prvih povezav in ostalo skrije za krajšo predstavitev. Meni zamenja navigacijo z menijskim gumbom.',
  maxVisibleLinks:
    'Največ povezav, ki so vidne v strnjenem tabličnem meniju. Primer: 3 prikaže prve tri navigacijske naslove, ostale pa ostanejo skrite za zgoščen prikaz.',
  mobileNavigation:
    'Na mobilniku je navigacija zaklenjena kot hamburger, ker polni tekstovni meni hitro postane neberljiv. Z leve odpre stranski predal, Celozaslonsko odpre meni čez cel zaslon.',
  actionPriority:
    'Vrstni red akcij na mobilniku. Elementi z nižjo prioriteto se premaknejo v meni, ko zmanjka prostora. Primer: če je Košarica prva, ostane vidna pred Iskanjem in Vprašaj AI.',
  mobileSearch:
    'Določa, kje je iskanje na mobilniku. V meniju ga skrije v hamburger meni, Ikona ga prikaže v zgornji vrstici.',
  safeArea:
    'Varno območje doda upoštevanje sistemskih robov naprav, na primer zareze na telefonu ali zaobljenih robov zaslona. Priporočeno je vklopljeno za mobilno postavitev.',
  previewGrid:
    'Mreža je merilna plast predogleda. Navpične črte so razmiki po 50 px, vodoravne črte razdelijo višino vrstice na štiri enake pasove. Tako lažje vidite širino, višino in poravnavo elementov; postavitev še vedno določajo pozicija, red, širine in razmiki.',
  marginBefore:
    'Dodatni prostor pred izbranim elementom. Primer: 8 px pred Vprašaj AI ga odmakne od elementa na levi.',
  marginAfter:
    'Dodatni prostor za izbranim elementom. Primer: 12 px za Iskanjem ustvari več prostora pred naslednjo akcijo.'
} satisfies Record<string, string>;

type TopBarHelpVisualKind =
  | 'content-width'
  | 'gutter'
  | 'height'
  | 'gap'
  | 'preview'
  | 'layout-mode'
  | 'slot'
  | 'order'
  | 'element-width'
  | 'edit'
  | 'breakpoint'
  | 'navigation-mode'
  | 'priority'
  | 'mobile-search'
  | 'safe-area'
  | 'preview-grid'
  | 'margin';

function getTopBarHelpVisual(text: string): TopBarHelpVisualKind | null {
  switch (text) {
    case topBarHelpCopy.siteContentWidth:
    case topBarHelpCopy.widthMode:
    case topBarHelpCopy.customWidth:
      return 'content-width';
    case topBarHelpCopy.gutterMin:
    case topBarHelpCopy.gutterMax:
      return 'gutter';
    case topBarHelpCopy.topBarHeight:
      return 'height';
    case topBarHelpCopy.columnGap:
    case topBarHelpCopy.itemGap:
      return 'gap';
    case topBarHelpCopy.headerPreview:
      return 'preview';
    case topBarHelpCopy.layoutMode:
      return 'layout-mode';
    case topBarHelpCopy.slot:
      return 'slot';
    case topBarHelpCopy.order:
      return 'order';
    case topBarHelpCopy.widthModeColumn:
    case topBarHelpCopy.widthColumn:
      return 'element-width';
    case topBarHelpCopy.breakpoint:
      return 'breakpoint';
    case topBarHelpCopy.tabletNavigation:
    case topBarHelpCopy.maxVisibleLinks:
    case topBarHelpCopy.mobileNavigation:
      return 'navigation-mode';
    case topBarHelpCopy.actionPriority:
      return 'priority';
    case topBarHelpCopy.mobileSearch:
      return 'mobile-search';
    case topBarHelpCopy.safeArea:
      return 'safe-area';
    case topBarHelpCopy.previewGrid:
      return 'preview-grid';
    case topBarHelpCopy.offsetsColumn:
    case topBarHelpCopy.marginBefore:
    case topBarHelpCopy.marginAfter:
      return 'margin';
    default:
      return null;
  }
}

const topBarDevicePreviewWidths: Record<SiteNavigationTopBarDevice, number> = {
  desktop: 1200,
  tablet: 768,
  mobile: 390
};

const topBarRowSettingLimits: Record<SiteNavigationTopBarDevice, {
  height: { min: number; max: number };
  paddingX: { min: number; max: number };
}> = {
  desktop: {
    height: { min: 56, max: 120 },
    paddingX: { min: 0, max: 96 }
  },
  tablet: {
    height: { min: 48, max: 120 },
    paddingX: { min: 0, max: 80 }
  },
  mobile: {
    height: { min: 44, max: 96 },
    paddingX: { min: 0, max: 48 }
  }
};

type TopBarZone = 'left' | 'center' | 'right';
type TopBarActiveEditKind =
  | 'position'
  | 'order'
  | 'gap-before'
  | 'gap-after'
  | 'element-width'
  | 'container-width'
  | 'layout-mode'
  | 'width-mode'
  | null;
type TopBarActiveEdit = {
  kind: TopBarActiveEditKind;
  elementId?: SiteNavigationTopBarElementId;
  fieldName?: string;
};
type TopBarActiveGuide =
  | { type: 'none' }
  | { type: 'topbar_width' }
  | { type: 'page_width' }
  | { type: 'height' }
  | { type: 'min_gutter' }
  | { type: 'max_gutter' }
  | { type: 'zone_gap' }
  | { type: 'element_gap' }
  | { type: 'zone_width'; zone: TopBarZone }
  | { type: 'element_width'; elementKey: SiteNavigationTopBarElementId }
  | { type: 'margin_before'; elementKey: SiteNavigationTopBarElementId }
  | { type: 'margin_after'; elementKey: SiteNavigationTopBarElementId };
type TopBarRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};
type TopBarSpacingRects = {
  before: TopBarRect;
  after: TopBarRect;
};
type TopBarMarginGuideRects = {
  left: TopBarRect;
  right: TopBarRect;
};
type TopBarWidthModeGuide = {
  containerRect: TopBarRect;
  contentRect: TopBarRect;
  label: string;
  innerLabel: string;
};
type TopBarGeometry = {
  viewportRect: TopBarRect;
  containerRect: TopBarRect;
  contentRect: TopBarRect;
  leftZoneRect: TopBarRect;
  centerZoneRect: TopBarRect;
  rightZoneRect: TopBarRect;
  elementRects: Partial<Record<SiteNavigationTopBarElementId, TopBarRect>>;
  spacingRects: Partial<Record<SiteNavigationTopBarElementId, TopBarSpacingRects>>;
  widthRects: Partial<Record<SiteNavigationTopBarElementId, TopBarRect>>;
  containerWidthGuideRect: TopBarRect;
  marginGuideRects: TopBarMarginGuideRects;
  widthModeGuideRects: Record<SiteNavigationTopBarWidthMode, TopBarWidthModeGuide>;
  zoneOrderIds: Record<TopBarZone, SiteNavigationTopBarElementId[]>;
};
type TopBarTableOffsets = {
  rendered: boolean;
  leftValue: number;
  rightValue: number;
  hasLeftNeighbor: boolean;
  hasRightNeighbor: boolean;
  previousRightPx: number | null;
  nextLeftPx: number | null;
};
type TopBarViewportDragState =
  | { type: 'element'; elementId: SiteNavigationTopBarElementId }
  | { type: 'width'; elementId: SiteNavigationTopBarElementId; edge: 'left' | 'right' }
  | null;
type TopBarOverflowStatus = {
  tone: 'ok' | 'warning' | 'info';
  label: string;
  detail?: string;
};
type TopBarDropTarget = {
  xPx: number;
  xRatio: number;
  deltaPx: number;
  rect: TopBarRect;
  constrained: boolean;
};

const topBarZoneLabels: Record<TopBarZone, string> = {
  left: 'Levo',
  center: 'Sredina',
  right: 'Desno'
};

const adminSiteNavigationPreviewEventName = 'admin-site-navigation-preview';

function cloneTopBarLayout(layout: SiteNavigationTopBarLayout): SiteNavigationTopBarLayout {
  return {
    responsive: {
      desktop: {
        items: layout.responsive.desktop.items.map((item) => ({ ...item })),
        settings: { ...layout.responsive.desktop.settings }
      },
      tablet: {
        items: layout.responsive.tablet.items.map((item) => ({ ...item })),
        settings: { ...layout.responsive.tablet.settings }
      },
      mobile: {
        items: layout.responsive.mobile.items.map((item) => ({ ...item })),
        settings: {
          ...layout.responsive.mobile.settings,
          actionPriority: ['search', 'ai', 'cart']
        }
      }
    }
  };
}

function TopBarHelpVisual({ visual }: { visual: TopBarHelpVisualKind }) {
  const shellClassName = 'mb-2 block overflow-hidden rounded-md border border-slate-200 bg-slate-50 p-2 text-[10px] leading-none text-slate-500';
  const blueBoxClassName = 'rounded border border-[color:var(--blue-500)] bg-[color:var(--blue-50)] text-[color:var(--blue-500)]';
  const neutralBoxClassName = 'rounded border border-slate-200 bg-white text-slate-500';

  if (visual === 'content-width') {
    return (
      <span className={shellClassName} aria-hidden="true">
        <span className="mb-1 flex items-center justify-between">
          <span>zaslon</span>
          <span>max vsebina</span>
        </span>
        <span className="flex h-9 items-center gap-2 rounded bg-white px-2">
          <span className="h-px flex-1 bg-slate-200" />
          <span className={`${blueBoxClassName} inline-flex h-6 w-28 items-center justify-center`}>1280 px</span>
          <span className="h-px flex-1 bg-slate-200" />
        </span>
      </span>
    );
  }

  if (visual === 'gutter') {
    return (
      <span className={shellClassName} aria-hidden="true">
        <span className="grid h-9 grid-cols-[32px_1fr_32px] items-center rounded bg-white text-center">
          <span className="h-full border-r border-dashed border-[color:var(--blue-500)]/45 pt-3 text-[color:var(--blue-500)]">rob</span>
          <span className="mx-2 h-5 rounded bg-slate-100" />
          <span className="h-full border-l border-dashed border-[color:var(--blue-500)]/45 pt-3 text-[color:var(--blue-500)]">rob</span>
        </span>
      </span>
    );
  }

  if (visual === 'height') {
    return (
      <span className={shellClassName} aria-hidden="true">
        <span className="grid h-12 grid-cols-[1fr_34px] items-stretch gap-2 rounded bg-white p-1.5">
          <span className="flex items-center rounded border border-slate-200 px-2">zgornja vrstica</span>
          <span className="relative rounded border-l border-[color:var(--blue-500)]">
            <span className="absolute right-1 top-1 text-[color:var(--blue-500)]">85</span>
            <span className="absolute bottom-1 right-1 text-[color:var(--blue-500)]">px</span>
          </span>
        </span>
      </span>
    );
  }

  if (visual === 'gap') {
    return (
      <span className={shellClassName} aria-hidden="true">
        <span className="flex h-9 items-center justify-center rounded bg-white px-3">
          <span className={`${neutralBoxClassName} h-5 w-12`} />
          <span className="mx-3 h-px w-7 bg-[color:var(--blue-500)] motion-safe:animate-pulse" />
          <span className={`${neutralBoxClassName} h-5 w-12`} />
          <span className="mx-2 h-px w-4 bg-[color:var(--blue-500)]/50" />
          <span className={`${neutralBoxClassName} h-5 w-8`} />
        </span>
      </span>
    );
  }

  if (visual === 'preview') {
    return (
      <span className={shellClassName} aria-hidden="true">
        <span className="flex h-10 items-center gap-2 rounded bg-white px-2">
          <span className={`${blueBoxClassName} inline-flex h-5 w-8 items-center justify-center motion-safe:animate-pulse`}>on</span>
          <span className="h-5 flex-1 rounded border border-slate-200" />
          <span className="h-5 w-14 rounded border border-slate-200" />
        </span>
      </span>
    );
  }

  if (visual === 'layout-mode') {
    return (
      <span className={shellClassName} aria-hidden="true">
        <span className="grid h-10 grid-cols-[1fr_auto_1fr] items-center gap-2 rounded bg-white px-2">
          <span className={`${neutralBoxClassName} h-5 w-12 justify-self-start`} />
          <span className={`${blueBoxClassName} inline-flex h-6 w-20 items-center justify-center`}>meni</span>
          <span className={`${neutralBoxClassName} h-5 w-12 justify-self-end`} />
        </span>
      </span>
    );
  }

  if (visual === 'slot') {
    return (
      <span className={shellClassName} aria-hidden="true">
        <span className="grid h-10 grid-cols-3 items-center gap-1 rounded bg-white p-1">
          <span className={`${blueBoxClassName} inline-flex h-7 items-center justify-center`}>Levo</span>
          <span className={`${blueBoxClassName} inline-flex h-7 items-center justify-center`}>Sredina</span>
          <span className={`${blueBoxClassName} inline-flex h-7 items-center justify-center`}>Desno</span>
        </span>
      </span>
    );
  }

  if (visual === 'order') {
    return (
      <span className={shellClassName} aria-hidden="true">
        <span className="flex h-10 items-center justify-center gap-2 rounded bg-white">
          {[1, 2, 3].map((order) => (
            <span key={order} className={`${order === 2 ? blueBoxClassName : neutralBoxClassName} inline-flex h-7 w-7 items-center justify-center`}>
              {order}
            </span>
          ))}
        </span>
      </span>
    );
  }

  if (visual === 'element-width') {
    return (
      <span className={shellClassName} aria-hidden="true">
        <span className="block rounded bg-white p-2">
          <span className={`${blueBoxClassName} mb-1 inline-flex h-6 w-24 items-center justify-center`}>element</span>
          <span className="block h-px w-24 bg-[color:var(--blue-500)]" />
          <span className="block w-24 text-center text-[color:var(--blue-500)]">88 px</span>
        </span>
      </span>
    );
  }

  if (visual === 'edit') {
    return (
      <span className={shellClassName} aria-hidden="true">
        <span className="flex h-10 items-center justify-end gap-2 rounded bg-white px-2">
          <span className={`${blueBoxClassName} inline-flex h-6 w-8 items-center justify-center`}>oko</span>
          <span className={`${neutralBoxClassName} inline-flex h-6 w-6 items-center justify-center`}>...</span>
          <span className="text-slate-400">meni</span>
        </span>
      </span>
    );
  }

  if (visual === 'breakpoint') {
    return (
      <span className={shellClassName} aria-hidden="true">
        <span className="block rounded bg-white p-2">
          <span className="relative block h-2 rounded bg-slate-200">
            <span className="absolute left-[38%] top-0 h-2 w-[28%] rounded bg-[color:var(--blue-500)]/70" />
          </span>
          <span className="mt-1 flex justify-between">
            <span>0</span>
            <span className="text-[color:var(--blue-500)]">768</span>
            <span className="text-[color:var(--blue-500)]">1024</span>
          </span>
        </span>
      </span>
    );
  }

  if (visual === 'navigation-mode') {
    return (
      <span className={shellClassName} aria-hidden="true">
        <span className="grid h-12 grid-cols-3 gap-1 rounded bg-white p-1 text-center">
          <span className={`${neutralBoxClassName} flex items-center justify-center`}>polna</span>
          <span className={`${blueBoxClassName} flex items-center justify-center`}>3 + ...</span>
          <span className={`${neutralBoxClassName} flex items-center justify-center`}>meni</span>
        </span>
      </span>
    );
  }

  if (visual === 'priority') {
    return (
      <span className={shellClassName} aria-hidden="true">
        <span className="flex h-10 items-center gap-2 rounded bg-white px-2">
          <span className={`${blueBoxClassName} inline-flex h-6 w-7 items-center justify-center`}>1</span>
          <span className={`${neutralBoxClassName} inline-flex h-6 w-7 items-center justify-center`}>2</span>
          <span className={`${neutralBoxClassName} inline-flex h-6 w-7 items-center justify-center`}>3</span>
          <span className="ml-auto text-slate-400">meni</span>
        </span>
      </span>
    );
  }

  if (visual === 'mobile-search') {
    return (
      <span className={shellClassName} aria-hidden="true">
        <span className="grid h-12 grid-cols-[38px_1fr] gap-2 rounded bg-white p-1.5">
          <span className={`${blueBoxClassName} flex items-center justify-center`}>meni</span>
          <span className="grid gap-1">
            <span className={`${neutralBoxClassName} flex items-center px-2`}>Iskanje</span>
            <span className="h-2 rounded bg-slate-100" />
          </span>
        </span>
      </span>
    );
  }

  if (visual === 'safe-area') {
    return (
      <span className={shellClassName} aria-hidden="true">
        <span className="mx-auto grid h-14 w-24 grid-rows-[10px_1fr] overflow-hidden rounded-xl border border-slate-300 bg-white">
          <span className="mx-auto mt-1 h-1.5 w-8 rounded-full bg-slate-300" />
          <span className="mx-2 mb-2 rounded border border-dashed border-[color:var(--blue-500)]/50 bg-[color:var(--blue-50)]" />
        </span>
      </span>
    );
  }

  if (visual === 'preview-grid') {
    return (
      <span className={shellClassName} aria-hidden="true">
        <span className="grid h-12 grid-cols-6 grid-rows-2 gap-px rounded bg-[color:var(--blue-500)]/20 p-px">
          {Array.from({ length: 12 }).map((_, index) => (
            <span key={index} className={index === 7 ? 'rounded-sm bg-[color:var(--blue-50)]' : 'rounded-sm bg-white'} />
          ))}
        </span>
      </span>
    );
  }

  return (
    <span className={shellClassName} aria-hidden="true">
      <span className="flex h-10 items-center rounded bg-white px-2">
        <span className="h-5 w-8 rounded bg-[color:var(--blue-50)]" />
        <span className="mx-2 h-px w-8 bg-[color:var(--blue-500)] motion-safe:animate-pulse" />
        <span className={`${blueBoxClassName} inline-flex h-6 w-16 items-center justify-center`}>element</span>
      </span>
    </span>
  );
}

function AdminTopBarDeviceGlyph({ device }: { device: SiteNavigationTopBarDevice }) {
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

function AdminTopBarSparklesGlyph({ className = 'h-[17px] w-[17px]' }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" className={className} fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
      <path d="m8.5 3.5 1.1 3.1 3.1 1.1-3.1 1.1-1.1 3.1-1.1-3.1-3.1-1.1 3.1-1.1 1.1-3.1Z" />
      <path d="m14.5 10.8.6 1.7 1.7.6-1.7.6-.6 1.7-.6-1.7-1.7-.6 1.7-.6.6-1.7Z" />
    </svg>
  );
}

function AdminTopBarSearchGlyph({ className = 'h-[18px] w-[18px]' }: { className?: string }) {
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

function AdminTopBarMenuGlyph({ className = 'h-[17px] w-[17px]' }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" className={className} fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
      <path d="M4.5 6h11M4.5 10h11M4.5 14h11" strokeLinecap="round" />
    </svg>
  );
}

function AdminTopBarCartGlyph() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="h-5 w-5"
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

function AdminTopBarDefaultBrandPreview() {
  return (
    <span className="inline-flex items-center gap-1.5 text-black">
      <span className="inline-flex h-[18px] w-[18px] items-center justify-center rounded-[4px] bg-black text-[11px] font-semibold leading-none text-white">
        A
      </span>
      <span className="text-[17px] font-semibold leading-none tracking-normal">Atehna</span>
    </span>
  );
}

const adminTopBarLogoClassNames: Record<SiteNavigationTopBarDevice, string> = {
  desktop: 'h-6 w-[88px]',
  tablet: 'h-[22px] w-[72px]',
  mobile: 'h-5 w-14'
};

function AdminTopBarBrandPreview({
  device,
  displaySize
}: {
  device: SiteNavigationTopBarDevice;
  displaySize?: SiteLogoDisplaySize | null;
}) {
  const purposeId = `header-${device}` as SiteLogoPurposeId;
  const style = displaySize?.explicit
    ? {
        width: `calc(${displaySize.widthPx}px / var(--commercial-storefront-scale))`,
        height: `calc(${displaySize.heightPx}px / var(--commercial-storefront-scale))`
      }
    : undefined;

  return (
    <SiteLogo
      purposeId={purposeId}
      fallback={<AdminTopBarDefaultBrandPreview />}
      className={adminTopBarLogoClassNames[device]}
      alt="Atehna"
      style={style}
    />
  );
}

function AdminTopBarSearchPreview({ mode = 'icon' }: { mode?: SiteNavigationTopBarSearchMode }) {
  if (mode === 'field') {
    return (
      <span className="inline-flex h-8 w-full min-w-0 items-center gap-2 rounded-md border border-slate-200 bg-white px-2.5 text-[13px] text-slate-500">
        <AdminTopBarSearchGlyph className="h-[18px] w-[18px]" />
        <span className="truncate">Iskanje</span>
      </span>
    );
  }

  return (
    <span className="inline-flex h-8 w-8 items-center justify-center rounded-md text-[var(--navbar-link-default)]">
      <AdminTopBarSearchGlyph />
    </span>
  );
}

function AdminTopBarAiPreview({ highlighted = false, mode = 'button' }: { highlighted?: boolean; mode?: SiteNavigationTopBarAiMode }) {
  if (mode === 'icon') {
    return (
      <span
        className={`inline-flex h-8 w-8 items-center justify-center rounded-md border bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition ${
          highlighted ? 'border-[color:var(--blue-500)] text-[color:var(--blue-500)]' : 'border-slate-200 text-[var(--navbar-link-default)]'
        }`}
      >
        <AdminTopBarSparklesGlyph className="h-4 w-4" />
      </span>
    );
  }

  return (
    <span
      className={`inline-flex h-8 items-center justify-center gap-1.5 rounded-md border bg-white px-2.5 text-[13px] font-normal leading-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition ${
        highlighted
          ? 'border-[color:var(--blue-500)] text-[color:var(--blue-500)]'
          : 'border-slate-200 text-[var(--navbar-link-default)]'
      }`}
    >
      <AdminTopBarSparklesGlyph className="h-4 w-4" />
      <span>Vprašaj AI</span>
    </span>
  );
}

function AdminTopBarCartPreview({ badge = true }: { badge?: boolean }) {
  return (
    <span className="relative inline-flex h-8 w-8 items-center justify-center rounded-md text-[var(--navbar-link-default)]">
      <AdminTopBarCartGlyph />
      {badge ? (
        <span className="absolute right-[-4px] top-[-4px] inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-black px-1 text-[10px] font-bold leading-4 text-white">
          10
        </span>
      ) : null}
    </span>
  );
}

function AdminTopBarNavigationPreview({
  items,
  device,
  mode = 'full',
  maxVisibleLinks = 3
}: {
  items: SiteNavigationTopLevelItem[];
  device: SiteNavigationTopBarDevice;
  mode?: SiteNavigationTopBarNavigationMode;
  maxVisibleLinks?: number;
}) {
  const visibleItems = items.filter((item) => item.visible);

  if (device === 'mobile' || mode === 'hamburger') {
    return (
      <span className="inline-flex h-8 w-8 items-center justify-center rounded-md text-[var(--navbar-link-default)]">
        <AdminTopBarMenuGlyph />
      </span>
    );
  }

  const previewItems = mode === 'condensed' ? visibleItems.slice(0, maxVisibleLinks) : visibleItems;

  return (
    <nav className="inline-flex min-w-0 items-center justify-start gap-[5px]" aria-label="Predogled glavne navigacije">
      {previewItems.map((item) => (
        <span
          key={item.id}
          className="inline-flex h-8 min-w-0 items-center rounded-md px-3 text-[14px] font-normal leading-5 text-[var(--navbar-link-default)]"
        >
          <span className="inline-flex min-w-0 items-center gap-1.5">
            <span className="truncate">{item.label}</span>
            {item.groups.length > 0 ? <ChevronGlyph className="h-3 w-3 opacity-60" /> : null}
          </span>
        </span>
      ))}
      {mode === 'condensed' && visibleItems.length > previewItems.length ? (
        <span className="inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-500">
          <DotsGlyph className="h-4 w-4 rotate-90" />
        </span>
      ) : null}
    </nav>
  );
}

function AdminTopBarElementPreview({
  id,
  items,
  highlighted = false,
  device = 'desktop',
  settings,
  logoDisplaySize
}: {
  id: SiteNavigationTopBarElementId;
  items: SiteNavigationTopLevelItem[];
  highlighted?: boolean;
  device?: SiteNavigationTopBarDevice;
  logoDisplaySize?: SiteLogoDisplaySize | null;
  settings?: SiteNavigationTopBarLayout['responsive'][SiteNavigationTopBarDevice]['settings'];
}) {
  const previewSettings = settings ?? DEFAULT_SITE_NAVIGATION_TOP_BAR_LAYOUT.responsive.desktop.settings;

  if (id === 'logo') return <AdminTopBarBrandPreview device={device} displaySize={logoDisplaySize} />;
  if (id === 'navigation') {
    return (
      <AdminTopBarNavigationPreview
        items={items}
        device={device}
        mode={previewSettings.navigationMode}
        maxVisibleLinks={previewSettings.maxVisibleLinks}
      />
    );
  }
  if (id === 'search') return <AdminTopBarSearchPreview mode={previewSettings.searchMode} />;
  if (id === 'ai') return <AdminTopBarAiPreview highlighted={highlighted} mode={previewSettings.aiMode} />;
  return <AdminTopBarCartPreview badge={previewSettings.cartBadge} />;
}

function AdminTopBarElementBadge({ id, selected = false }: { id: SiteNavigationTopBarElementId; selected?: boolean }) {
  const className = `${adminSelectableIconBadgeTokenClasses.base} ${
    selected ? adminSelectableIconBadgeTokenClasses.selected : adminSelectableIconBadgeTokenClasses.interactive
  }`;

  if (id === 'logo') {
    return (
      <span className={className}>
        <span className="inline-flex h-[18px] w-[18px] items-center justify-center rounded-[4px] bg-black text-[11px] font-semibold leading-none text-white">
          A
        </span>
      </span>
    );
  }

  if (id === 'navigation') {
    return (
      <span className={className}>
        <svg viewBox="0 0 20 20" className="h-[17px] w-[17px]" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
          <path d="M4.5 6h11M4.5 10h11M4.5 14h11" strokeLinecap="round" />
        </svg>
      </span>
    );
  }

  if (id === 'search') {
    return (
      <span className={className}>
        <AdminTopBarSearchGlyph />
      </span>
    );
  }

  if (id === 'ai') {
    return (
      <span className={className}>
        <AdminTopBarSparklesGlyph />
      </span>
    );
  }

  return (
    <span className={className}>
      <AdminTopBarCartGlyph />
    </span>
  );
}

function sortedResponsiveItems(items: SiteNavigationTopBarResponsiveItem[]) {
  return [...items].sort((first, second) => {
    const xDelta = first.xPx - second.xPx;
    return xDelta === 0 ? first.zIndex - second.zIndex : xDelta;
  });
}

function updateResponsiveLayout(
  layout: SiteNavigationTopBarLayout,
  device: SiteNavigationTopBarDevice,
  updater: (current: SiteNavigationTopBarLayout['responsive'][SiteNavigationTopBarDevice]) => SiteNavigationTopBarLayout['responsive'][SiteNavigationTopBarDevice]
): SiteNavigationTopBarLayout {
  return {
    ...layout,
    responsive: {
      ...layout.responsive,
      [device]: updater(layout.responsive[device])
    }
  };
}

function TopBarHelp({
  text,
  align = 'center'
}: {
  text: string;
  align?: 'left' | 'center' | 'right';
}) {
  const helperRef = useRef<HTMLSpanElement>(null);
  const tooltipId = useId();
  const [isOpen, setIsOpen] = useState(false);
  const [tooltipPosition, setTooltipPosition] = useState<{ left: number; top: number; width: number } | null>(null);
  const visual = getTopBarHelpVisual(text);
  const updateTooltipPosition = useCallback(() => {
    const helperElement = helperRef.current;

    if (!helperElement || typeof window === 'undefined') {
      return;
    }

    const rect = helperElement.getBoundingClientRect();
    const viewportWidth = window.visualViewport?.width ?? window.innerWidth;
    const tooltipWidth = Math.min(320, Math.max(232, viewportWidth - 24));
    const viewportInset = 12;
    const alignedLeft = align === 'left'
      ? rect.left
      : align === 'right'
        ? rect.right - tooltipWidth
        : rect.left + rect.width / 2 - tooltipWidth / 2;
    const left = Math.min(Math.max(alignedLeft, viewportInset), viewportWidth - tooltipWidth - viewportInset);

    setTooltipPosition({
      left,
      top: rect.top - 8,
      width: tooltipWidth
    });
  }, [align]);

  useLayoutEffect(() => {
    if (!isOpen) {
      return;
    }

    updateTooltipPosition();
    window.addEventListener('resize', updateTooltipPosition);
    window.addEventListener('scroll', updateTooltipPosition, true);

    return () => {
      window.removeEventListener('resize', updateTooltipPosition);
      window.removeEventListener('scroll', updateTooltipPosition, true);
    };
  }, [isOpen, updateTooltipPosition]);

  const tooltip = isOpen && tooltipPosition && typeof document !== 'undefined'
    ? createPortal(
        <span
          id={tooltipId}
          role="tooltip"
          className="pointer-events-none rounded-lg border border-slate-200 bg-white p-3 text-left text-[12px] font-normal leading-5 text-slate-600 shadow-[0_16px_44px_rgba(15,23,42,0.16)]"
          style={{
            left: tooltipPosition.left,
            position: 'fixed',
            top: tooltipPosition.top,
            transform: 'translateY(-100%)',
            width: tooltipPosition.width,
            zIndex: 2147483647
          }}
        >
          {visual ? <TopBarHelpVisual visual={visual} /> : null}
          <span>{text}</span>
        </span>,
        document.body
      )
    : null;

  return (
    <span
      ref={helperRef}
      tabIndex={0}
      role="button"
      aria-label={`Pomoč: ${text}`}
      aria-describedby={isOpen ? tooltipId : undefined}
      className={`group/help relative inline-flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-[9px] font-semibold leading-none text-slate-400 transition ${adminControlFocusTokenClasses} hover:border-[color:var(--blue-500)] hover:text-[color:var(--blue-500)] focus:border-[color:var(--blue-500)] focus:text-[color:var(--blue-500)]`}
      onBlur={() => setIsOpen(false)}
      onFocus={() => {
        updateTooltipPosition();
        setIsOpen(true);
      }}
      onMouseEnter={() => {
        updateTooltipPosition();
        setIsOpen(true);
      }}
      onMouseLeave={() => setIsOpen(false)}
    >
      i
      {tooltip}
    </span>
  );
}

function TopBarHelpLabel({
  children,
  help,
  align = 'center',
  className = ''
}: {
  children: ReactNode;
  help?: string;
  align?: 'left' | 'center' | 'right';
  className?: string;
}) {
  return (
    <span className={`inline-flex min-w-0 items-center gap-1.5 ${className}`}>
      <span className="min-w-0 truncate">{children}</span>
      {help ? <TopBarHelp text={help} align={align} /> : null}
    </span>
  );
}

function TopBarSegmentedControl<T extends string>({
  value,
  options,
  activeValue,
  compact = false,
  contained = false,
  onChange,
  onOptionActive,
  onOptionInactive
}: {
  value: T;
  options: Array<{ value: T; label: string; disabled?: boolean }>;
  activeValue?: T | null;
  compact?: boolean;
  contained?: boolean;
  onChange: (value: T) => void;
  onOptionActive?: (value: T) => void;
  onOptionInactive?: () => void;
}) {
  return (
    <div
      className={
        contained
          ? 'grid min-h-9 w-full min-w-0 grid-flow-col auto-cols-fr overflow-hidden rounded-lg border border-slate-300 bg-white'
          : compact
            ? 'inline-flex min-h-7 w-full min-w-0 items-center gap-1'
            : 'inline-flex min-h-9 min-w-0 flex-wrap items-center gap-1'
      }
    >
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          disabled={option.disabled}
          aria-pressed={value === option.value}
          className={`inline-flex items-center justify-center font-medium leading-none transition ${adminControlFocusTokenClasses} ${
            contained
              ? 'h-9 min-w-0 border-0 border-r border-slate-200 px-2 text-[12px] last:border-r-0'
              : `rounded-md border ${compact ? 'h-7 min-w-0 flex-1 px-1.5 text-[11px]' : 'h-8 px-2.5 text-[12px]'}`
          } ${
            value === option.value
              ? contained
                ? 'bg-[color:var(--blue-50)] text-[color:var(--blue-500)]'
                : 'border-[color:var(--blue-500)] bg-[color:var(--blue-50)] text-[color:var(--blue-500)]'
              : activeValue === option.value
                ? contained
                  ? 'bg-[color:var(--blue-50)]/60 text-[color:var(--blue-500)]'
                  : 'border-[color:var(--blue-500)]/50 bg-[color:var(--blue-50)]/60 text-[color:var(--blue-500)]'
              : option.disabled
                ? contained
                  ? 'cursor-not-allowed text-slate-300'
                  : 'cursor-not-allowed border-transparent text-slate-300'
                : contained
                  ? 'text-slate-600 hover:bg-[color:var(--hover-neutral)] hover:text-[color:var(--blue-500)]'
                  : 'border-transparent text-slate-500 hover:bg-[color:var(--hover-neutral)] hover:text-[color:var(--blue-500)]'
          }`}
          onBlur={onOptionInactive}
          onClick={() => onChange(option.value)}
          onFocus={() => onOptionActive?.(option.value)}
          onMouseEnter={() => onOptionActive?.(option.value)}
          onMouseLeave={onOptionInactive}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

function TopBarUnitNumberInput({
  value,
  min = 0,
  max = 1920,
  step = 1,
  suffix = 'px',
  variant = 'compact',
  disabled = false,
  ariaLabel,
  className = 'w-full',
  inputClassName = 'min-w-0 flex-1',
  stopPropagation = false,
  active = false,
  onFocus,
  onBlur,
  onMouseEnter,
  onMouseLeave,
  onChange
}: {
  value: number;
  min?: number;
  max?: number;
  step?: number;
  suffix?: string;
  variant?: 'compact' | 'simulator';
  disabled?: boolean;
  ariaLabel?: string;
  className?: string;
  inputClassName?: string;
  stopPropagation?: boolean;
  active?: boolean;
  onFocus?: () => void;
  onBlur?: () => void;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
  onChange: (value: number) => void;
}) {
  const simulatorStyle = variant === 'simulator';

  return (
    <span
      data-top-bar-unit-control
      className={`inline-flex items-center overflow-hidden rounded-md border bg-white text-[12px] leading-none transition focus-within:border-[color:var(--blue-500)] ${
        simulatorStyle
          ? 'h-9 border-slate-300 text-slate-700'
          : 'h-7 border-slate-200 text-slate-700'
      } ${
        active ? topBarActiveFieldClassName : ''
      } ${
        disabled ? 'cursor-not-allowed bg-[color:var(--field-locked-bg)] text-slate-400' : ''
      } ${className}`}
      onClick={(event) => {
        if (stopPropagation) event.stopPropagation();
        if (!disabled) onFocus?.();
      }}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      onPointerDown={() => {
        if (!disabled) onFocus?.();
      }}
    >
      <AppearanceEditorNumberInput
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        onBlur={onBlur}
        onValueChange={onChange}
        onFocus={onFocus}
        className={`h-full border-0 bg-transparent text-right font-['Inter',system-ui,sans-serif] leading-none outline-none focus:ring-0 ${numberInputNoSpinnerClassName} ${
          simulatorStyle
            ? 'rounded-l-md px-2.5 text-[12px] font-medium text-slate-900 disabled:bg-transparent disabled:text-slate-500 disabled:opacity-100'
            : 'px-2 text-[12px] font-medium text-slate-700 disabled:text-slate-300'
        } ${disabled ? 'cursor-not-allowed' : ''} ${inputClassName}`}
        aria-label={ariaLabel}
      />
      {suffix ? (
        <span className={topBarUnitAdornmentSuffixClassName}>
          {suffix}
        </span>
      ) : null}
    </span>
  );
}

function TopBarUnitRangeInput({
  startValue,
  endValue,
  min = 0,
  max = 1920,
  suffix = 'px',
  ariaLabel,
  className = 'w-full',
  stopPropagation = false,
  active = false,
  onFocus,
  onBlur,
  onMouseEnter,
  onMouseLeave,
  onChange
}: {
  startValue: number;
  endValue: number;
  min?: number;
  max?: number;
  suffix?: string;
  ariaLabel: string;
  className?: string;
  stopPropagation?: boolean;
  active?: boolean;
  onFocus?: () => void;
  onBlur?: () => void;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
  onChange: (startValue: number) => void;
}) {
  const roundedStartValue = Math.round(startValue);
  const roundedEndValue = Math.round(endValue);
  const formattedValue = `${roundedStartValue}-${roundedEndValue}`;
  const [draftValue, setDraftValue] = useState(formattedValue);

  useEffect(() => {
    setDraftValue(formattedValue);
  }, [formattedValue]);

  const commitDraftValue = (candidateValue = draftValue) => {
    const match = candidateValue.match(/^\s*(\d+)\s*[-–—]\s*(\d+)\s*$/);
    if (!match) {
      setDraftValue(formattedValue);
      return;
    }

    const parsedStartValue = Number(match[1]);
    const parsedEndValue = Number(match[2]);
    if (parsedEndValue < parsedStartValue) {
      setDraftValue(formattedValue);
      return;
    }

    const nextStartValue = Math.round(clampTopBarNumber(parsedStartValue, min, max));
    const nextEndValue = nextStartValue + Math.max(0, roundedEndValue - roundedStartValue);
    const nextFormattedValue = `${nextStartValue}-${nextEndValue}`;
    setDraftValue(nextFormattedValue);

    if (nextStartValue !== roundedStartValue) {
      onChange(nextStartValue);
    }
  };

  return (
    <span
      className={`inline-flex h-7 items-center overflow-hidden rounded-md border border-slate-200 bg-white text-[12px] leading-none transition focus-within:border-[color:var(--blue-500)] ${
        active ? topBarActiveFieldClassName : ''
      } ${className}`}
      onClick={(event) => {
        if (stopPropagation) event.stopPropagation();
        onFocus?.();
      }}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      onPointerDown={onFocus}
    >
      <input
        type="text"
        inputMode="text"
        value={draftValue}
        onBlur={(event) => {
          commitDraftValue(event.currentTarget.value);
          onBlur?.();
        }}
        onChange={(event) => setDraftValue(event.target.value)}
        onFocus={onFocus}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault();
            commitDraftValue(event.currentTarget.value);
            event.currentTarget.blur();
          } else if (event.key === 'Escape') {
            event.currentTarget.value = formattedValue;
            setDraftValue(formattedValue);
            event.currentTarget.blur();
          }
        }}
        className="h-full min-w-0 flex-1 border-0 bg-transparent px-2 text-right font-['Inter',system-ui,sans-serif] text-[12px] font-medium leading-none text-slate-700 outline-none focus:ring-0"
        aria-label={ariaLabel}
      />
      {suffix ? <span className={topBarUnitAdornmentSuffixClassName}>{suffix}</span> : null}
    </span>
  );
}

function TopBarOffsetPairInput({
  leftValue,
  rightValue,
  min,
  max,
  step = 1,
  suffix = 'px',
  className = 'w-full',
  leftAriaLabel,
  rightAriaLabel,
  leftDisabled = false,
  rightDisabled = false,
  leftActive = false,
  rightActive = false,
  stopPropagation = false,
  onLeftFocus,
  onRightFocus,
  onBlur,
  onLeftMouseEnter,
  onRightMouseEnter,
  onMouseLeave,
  onLeftChange,
  onRightChange
}: {
  leftValue: number;
  rightValue: number;
  min: number;
  max: number;
  step?: number;
  suffix?: string;
  className?: string;
  leftAriaLabel: string;
  rightAriaLabel: string;
  leftDisabled?: boolean;
  rightDisabled?: boolean;
  leftActive?: boolean;
  rightActive?: boolean;
  stopPropagation?: boolean;
  onLeftFocus?: () => void;
  onRightFocus?: () => void;
  onBlur?: () => void;
  onLeftMouseEnter?: () => void;
  onRightMouseEnter?: () => void;
  onMouseLeave?: () => void;
  onLeftChange: (value: number) => void;
  onRightChange: (value: number) => void;
}) {
  const active = leftActive || rightActive;
  const inputClassName = `h-full w-full border-0 bg-transparent px-2 text-right font-['Inter',system-ui,sans-serif] text-[12px] font-medium leading-none text-slate-700 outline-none focus:ring-0 disabled:cursor-not-allowed disabled:text-slate-300 ${numberInputNoSpinnerClassName}`;

  return (
    <span
      className={`inline-flex h-7 items-center overflow-hidden rounded-md border border-slate-200 bg-white text-[12px] leading-none transition focus-within:border-[color:var(--blue-500)] ${
        active ? topBarActiveFieldClassName : ''
      } ${className}`}
      onClick={(event) => {
        if (stopPropagation) event.stopPropagation();
      }}
      onMouseLeave={onMouseLeave}
    >
      <span
        className={`flex h-full w-12 shrink-0 ${leftDisabled ? 'bg-slate-50' : ''}`}
        onMouseEnter={leftDisabled ? undefined : onLeftMouseEnter}
      >
        <AppearanceEditorNumberInput
          min={min}
          max={max}
          step={step}
          value={leftValue}
          disabled={leftDisabled}
          onBlur={onBlur}
          onValueChange={onLeftChange}
          onFocus={leftDisabled ? undefined : onLeftFocus}
          className={inputClassName}
          aria-label={leftAriaLabel}
        />
      </span>
      <span
        className={`flex h-full w-12 shrink-0 border-l border-slate-200 ${rightDisabled ? 'bg-slate-50' : ''}`}
        onMouseEnter={rightDisabled ? undefined : onRightMouseEnter}
      >
        <AppearanceEditorNumberInput
          min={min}
          max={max}
          step={step}
          value={rightValue}
          disabled={rightDisabled}
          onBlur={onBlur}
          onValueChange={onRightChange}
          onFocus={rightDisabled ? undefined : onRightFocus}
          className={inputClassName}
          aria-label={rightAriaLabel}
        />
      </span>
      {suffix ? (
        <span className={topBarUnitAdornmentSuffixClassName}>
          {suffix}
        </span>
      ) : null}
    </span>
  );
}

function TopBarNumberField({
  label,
  help,
  value,
  min = 0,
  max = 1920,
  step = 1,
  suffix = 'px',
  className = '',
  active = false,
  onFocus,
  onBlur,
  onMouseEnter,
  onMouseLeave,
  onChange
}: {
  label: string;
  help?: string;
  value: number;
  min?: number;
  max?: number;
  step?: number;
  suffix?: string;
  className?: string;
  active?: boolean;
  onFocus?: () => void;
  onBlur?: () => void;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
  onChange: (value: number) => void;
}) {
  return (
    <label className={`grid gap-1.5 ${className}`}>
      <TopBarHelpLabel help={help} align="right" className="text-[12px] font-medium leading-none text-slate-600">
        {label}
      </TopBarHelpLabel>
      <TopBarUnitNumberInput
        value={value}
        min={min}
        max={max}
        step={step}
        suffix={suffix}
        variant="simulator"
        className="w-full max-w-[112px]"
        inputClassName="w-[52px] shrink-0 text-[13px]"
        ariaLabel={label}
        active={active}
        onBlur={onBlur}
        onFocus={onFocus}
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
        onChange={onChange}
      />
    </label>
  );
}

function TopBarMiniNumberField({
  label,
  help,
  value,
  min = 0,
  max = 1920,
  step = 1,
  suffix = 'px',
  layout = 'stack',
  className = '',
  active = false,
  onFocus,
  onBlur,
  onMouseEnter,
  onMouseLeave,
  onChange
}: {
  label: string;
  help?: string;
  value: number;
  min?: number;
  max?: number;
  step?: number;
  suffix?: string;
  layout?: 'stack' | 'row';
  className?: string;
  active?: boolean;
  onFocus?: () => void;
  onBlur?: () => void;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
  onChange: (value: number) => void;
}) {
  const rowLayout = layout === 'row';

  return (
    <label
      className={`grid min-w-0 text-[12px] text-slate-700 ${
        rowLayout ? 'grid-cols-[minmax(0,1fr)_auto] items-center gap-3' : 'gap-1'
      } ${className}`}
    >
      <TopBarHelpLabel help={help} align="right" className={`${rowLayout ? '' : 'mb-1'} text-[12px] font-semibold leading-none text-slate-700`}>
        {label}
      </TopBarHelpLabel>
      <TopBarUnitNumberInput
        value={value}
        min={min}
        max={max}
        step={step}
        suffix={suffix}
        variant={rowLayout ? 'compact' : 'simulator'}
        className={rowLayout ? 'ml-auto w-[84px]' : 'w-full'}
        inputClassName={rowLayout ? 'w-10 shrink-0' : 'min-w-0 flex-1 text-[13px]'}
        ariaLabel={label}
        active={active}
        onBlur={onBlur}
        onFocus={onFocus}
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
        onChange={onChange}
      />
    </label>
  );
}

function TopBarMiniRangeField({
  label,
  help,
  startValue,
  endValue,
  min = 0,
  max = 1920,
  suffix = 'px',
  allowSingleValue = false,
  layout = 'stack',
  className = '',
  active = false,
  onFocus,
  onBlur,
  onMouseEnter,
  onMouseLeave,
  onChange
}: {
  label: string;
  help?: string;
  startValue: number;
  endValue: number;
  min?: number;
  max?: number;
  suffix?: string;
  allowSingleValue?: boolean;
  layout?: 'stack' | 'row';
  className?: string;
  active?: boolean;
  onFocus?: () => void;
  onBlur?: () => void;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
  onChange: (startValue: number, endValue: number) => void;
}) {
  const formattedValue = `${startValue} – ${endValue}`;
  const [draftValue, setDraftValue] = useState(formattedValue);
  const rowLayout = layout === 'row';

  useEffect(() => {
    setDraftValue(formattedValue);
  }, [formattedValue]);

  const commitDraftValue = () => {
    const rangeMatch = draftValue.match(/^\s*(\d+)\s*[-–—]\s*(\d+)\s*$/);
    const singleMatch = allowSingleValue ? draftValue.match(/^\s*(\d+)\s*$/) : null;

    if (!rangeMatch && !singleMatch) {
      setDraftValue(formattedValue);
      return;
    }

    const firstValue = clampTopBarNumber(Number(rangeMatch?.[1] ?? singleMatch?.[1]), min, max);
    const secondValue = clampTopBarNumber(Number(rangeMatch?.[2] ?? singleMatch?.[1]), min, max);
    const nextStartValue = Math.min(firstValue, secondValue);
    const nextEndValue = Math.max(firstValue, secondValue);

    setDraftValue(`${nextStartValue} – ${nextEndValue}`);
    onChange(nextStartValue, nextEndValue);
  };

  return (
    <label
      className={`grid min-w-0 text-[12px] text-slate-700 ${
        rowLayout ? 'grid-cols-[minmax(0,1fr)_auto] items-center gap-3' : 'gap-1'
      } ${className}`}
    >
      <TopBarHelpLabel help={help} align="right" className={`${rowLayout ? '' : 'mb-1'} text-[12px] font-semibold leading-none text-slate-700`}>
        {label}
      </TopBarHelpLabel>
      <span
        data-top-bar-unit-control
        className={`inline-flex ${rowLayout ? 'ml-auto h-7 w-[128px]' : 'h-9 w-full'} items-center overflow-hidden rounded-md border ${rowLayout ? 'border-slate-200' : 'border-slate-300'} bg-white text-[12px] leading-none transition focus-within:border-[color:var(--blue-500)] ${
          active ? topBarActiveFieldClassName : ''
        }`}
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
      >
        <input
          type="text"
          inputMode="numeric"
          value={draftValue}
          onBlur={() => {
            commitDraftValue();
            onBlur?.();
          }}
          onFocus={onFocus}
          onChange={(event) => setDraftValue(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              event.currentTarget.blur();
            } else if (event.key === 'Escape') {
              setDraftValue(formattedValue);
              event.currentTarget.blur();
            }
          }}
          className={`h-full min-w-0 flex-1 border-0 bg-transparent px-2 text-right font-['Inter',system-ui,sans-serif] text-[12px] font-medium leading-none text-slate-700 outline-none focus:ring-0 ${numberInputNoSpinnerClassName}`}
          aria-label={label}
        />
        <span className={topBarUnitAdornmentSuffixClassName} aria-hidden="true">
          {suffix}
        </span>
      </span>
    </label>
  );
}

function TopBarMiniBreakpointField({
  label,
  help,
  value,
  min = 0,
  max = 2400,
  suffix = 'px',
  layout = 'row',
  className = '',
  active = false,
  onFocus,
  onBlur,
  onMouseEnter,
  onMouseLeave,
  onChange
}: {
  label: string;
  help?: string;
  value: string;
  min?: number;
  max?: number;
  suffix?: string;
  layout?: 'stack' | 'row';
  className?: string;
  active?: boolean;
  onFocus?: () => void;
  onBlur?: () => void;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
  onChange: (value: number) => void;
}) {
  const [draftValue, setDraftValue] = useState(value);
  const rowLayout = layout === 'row';

  useEffect(() => {
    setDraftValue(value);
  }, [value]);

  const commitDraftValue = () => {
    const plusMatch = draftValue.match(/^\s*(\d+)\s*\+\s*$/);
    const rangeMatch = draftValue.match(/^\s*(\d+)\s*[-–—]\s*(\d+)\s*$/);
    const plainMatch = draftValue.match(/^\s*(\d+)\s*$/);
    const rawValue = plusMatch
      ? Number(plusMatch[1])
      : rangeMatch
        ? Number(rangeMatch[1])
        : plainMatch
          ? Number(plainMatch[1])
          : null;

    if (rawValue === null) {
      setDraftValue(value);
      return;
    }

    const nextValue = Math.round(clampTopBarNumber(rawValue, min, max));

    setDraftValue(`${nextValue}+`);
    onChange(nextValue);
  };

  return (
    <label
      className={`grid min-w-0 text-[12px] text-slate-700 ${
        rowLayout ? 'grid-cols-[minmax(0,1fr)_auto] items-center gap-3' : 'gap-1'
      } ${className}`}
    >
      <TopBarHelpLabel help={help} align="right" className={`${rowLayout ? '' : 'mb-1'} text-[12px] font-semibold leading-none text-slate-700`}>
        {label}
      </TopBarHelpLabel>
      <span
        data-top-bar-unit-control
        className={`inline-flex ${rowLayout ? 'ml-auto h-7 w-[128px]' : 'h-9 w-full'} items-center overflow-hidden rounded-md border ${rowLayout ? 'border-slate-200' : 'border-slate-300'} bg-white text-[12px] leading-none transition focus-within:border-[color:var(--blue-500)] ${
          active ? topBarActiveFieldClassName : ''
        }`}
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
      >
        <input
          type="text"
          inputMode="numeric"
          value={draftValue}
          onBlur={() => {
            commitDraftValue();
            onBlur?.();
          }}
          onFocus={onFocus}
          onChange={(event) => setDraftValue(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              event.currentTarget.blur();
            } else if (event.key === 'Escape') {
              setDraftValue(value);
              event.currentTarget.blur();
            }
          }}
          className={`h-full min-w-0 flex-1 border-0 bg-transparent px-2 text-right font-['Inter',system-ui,sans-serif] text-[12px] font-medium leading-none text-slate-700 outline-none focus:ring-0 ${numberInputNoSpinnerClassName}`}
          aria-label={label}
        />
        <span className={topBarUnitAdornmentSuffixClassName} aria-hidden="true">
          {suffix}
        </span>
      </span>
    </label>
  );
}

function TopBarToggle({
  label,
  help,
  checked,
  onChange,
  frameless = false,
  simulatorStyle = false,
  hideLabel = false,
  compact = false
}: {
  label: string;
  help?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  frameless?: boolean;
  simulatorStyle?: boolean;
  hideLabel?: boolean;
  compact?: boolean;
}) {
  const trackClassName = simulatorStyle
    ? `h-[32px] w-[58px] ${checked ? 'bg-[#1982bf]' : 'bg-slate-300'}`
    : compact
      ? `h-4 w-7 ${checked ? 'bg-[color:var(--blue-500)]' : 'bg-slate-200'}`
      : `h-5 w-9 ${checked ? 'bg-[color:var(--blue-500)]' : 'bg-slate-200'}`;
  const knobClassName = simulatorStyle
    ? `top-[4px] h-6 w-6 ${checked ? 'left-[30px]' : 'left-[4px]'}`
    : compact
      ? `top-0.5 h-3 w-3 ${checked ? 'left-[14px]' : 'left-0.5'}`
      : `top-0.5 h-4 w-4 ${checked ? 'left-[18px]' : 'left-0.5'}`;

  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={hideLabel ? label : undefined}
      className={`${frameless ? 'inline-flex w-auto justify-start' : 'flex w-full justify-between'} ${compact ? 'h-6 text-[11px]' : 'h-9 text-[12px]'} items-center font-medium transition ${adminControlFocusTokenClasses} ${
        frameless
          ? `${compact ? 'gap-1.5' : 'gap-2'} rounded-md px-0 ${checked ? 'text-[color:var(--blue-500)]' : 'text-slate-600 hover:text-[color:var(--blue-500)]'}`
          : `rounded-lg border px-3 ${
              checked
                ? 'border-[color:var(--blue-500)] bg-[color:var(--blue-50)] text-[color:var(--blue-500)]'
                : 'border-slate-200 bg-white text-slate-600 hover:text-[color:var(--blue-500)]'
            }`
      }`}
      onClick={() => onChange(!checked)}
    >
      {hideLabel ? null : (
        <TopBarHelpLabel help={help} align="right">
          {label}
        </TopBarHelpLabel>
      )}
      <span
        className={`relative shrink-0 rounded-full transition-colors ${trackClassName}`}
      >
        <span
          className={`absolute rounded-full bg-white shadow-sm transition-[left] ${knobClassName}`}
        />
      </span>
    </button>
  );
}

function TopBarAppearanceColorField({
  label,
  ariaLabel,
  value,
  fallback,
  hideLabel = false,
  onChange
}: {
  label: string;
  ariaLabel: string;
  value: string;
  fallback: string;
  hideLabel?: boolean;
  onChange: (value: string) => void;
}) {
  const normalizedValue = normalizeHexColor(value) ?? normalizeHexColor(fallback) ?? '#FFFFFF';

  return (
    <CompactHexColorField
      label={label}
      value={normalizedValue}
      marker={`navigation-${ariaLabel}`}
      tone="light"
      layout={hideLabel ? 'inline' : 'compact'}
      onChange={onChange}
      inputAttributes={{ 'aria-label': ariaLabel }}
      className={
        hideLabel
          ? 'h-9 w-full min-w-0 rounded-lg border border-slate-300 bg-white px-2.5 transition focus-within:border-[color:var(--blue-500)] [&>label]:sr-only [&>span]:!ml-0 [&>span]:!max-w-none [&>span]:min-w-0 [&_input]:!border-0 [&_input]:!bg-transparent [&_input]:!px-1 [&_input]:!text-[12px] [&_input]:!font-medium [&_input]:!tracking-normal [&_input]:!ring-0'
          : 'min-w-0'
      }
    />
  );
}

function TopBarSettingsGroup({ title, help, children }: { title: string; help?: string; children: ReactNode }) {
  return (
    <div>
      <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">
        <TopBarHelpLabel help={help} align="right">
          {title}
        </TopBarHelpLabel>
      </h3>
      <div className="grid gap-3">{children}</div>
    </div>
  );
}

function formatPreviewRulerNumber(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(1).replace(/\.0$/, '');
}

function clampTopBarNumber(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function getTopBarStorefrontGeometrySiteLayout(
  siteLayout: SiteNavigationSiteLayoutSettings
): SiteNavigationSiteLayoutSettings {
  return {
    siteContentMaxWidthPx: toCommercialStorefrontLogicalPx(siteLayout.siteContentMaxWidthPx),
    siteGutterMinPx: toCommercialStorefrontLogicalPx(siteLayout.siteGutterMinPx),
    siteGutterMaxPx: toCommercialStorefrontLogicalPx(siteLayout.siteGutterMaxPx)
  };
}

function getTopBarStorefrontGeometrySettings(
  settings: SiteNavigationTopBarResponsiveSettings
): SiteNavigationTopBarResponsiveSettings {
  return {
    ...settings,
    customMaxWidthPx: settings.customMaxWidthPx === null
      ? null
      : toCommercialStorefrontLogicalPx(settings.customMaxWidthPx)
  };
}

function createTopBarRect(x: number, y: number, width: number, height: number): TopBarRect {
  return {
    x: Math.round(x * 100) / 100,
    y: Math.round(y * 100) / 100,
    width: Math.round(Math.max(0, width) * 100) / 100,
    height: Math.round(Math.max(0, height) * 100) / 100
  };
}

function getTopBarRectRight(rect: TopBarRect) {
  return rect.x + rect.width;
}

function getTopBarRectCenterX(rect: TopBarRect) {
  return rect.x + rect.width / 2;
}

function getTopBarComputedGutter(viewportWidth: number, siteLayout: SiteNavigationSiteLayoutSettings) {
  return clampTopBarNumber(viewportWidth * 0.04, siteLayout.siteGutterMinPx, siteLayout.siteGutterMaxPx);
}

function getTopBarContainerForWidthMode({
  viewportWidth,
  viewportHeight,
  widthMode,
  settings,
  siteLayout
}: {
  viewportWidth: number;
  viewportHeight: number;
  widthMode: SiteNavigationTopBarWidthMode;
  settings: SiteNavigationTopBarResponsiveSettings;
  siteLayout: SiteNavigationSiteLayoutSettings;
}) {
  const configuredWidth =
    widthMode === 'full'
      ? viewportWidth
      : widthMode === 'custom'
        ? settings.customMaxWidthPx ?? siteLayout.siteContentMaxWidthPx
        : siteLayout.siteContentMaxWidthPx;
  const containerWidth = Math.min(viewportWidth, configuredWidth);
  const containerX = (viewportWidth - containerWidth) / 2;
  const containerRect = createTopBarRect(containerX, 0, containerWidth, viewportHeight);
  const gutter = Math.min(containerWidth / 2, getTopBarComputedGutter(viewportWidth, siteLayout));
  const contentRect = createTopBarRect(
    containerRect.x + gutter,
    containerRect.y,
    Math.max(0, containerRect.width - gutter * 2),
    containerRect.height
  );

  return { containerRect, contentRect, gutter };
}

function getTopBarElementVisualHeight(
  item: SiteNavigationTopBarResponsiveItem,
  device: SiteNavigationTopBarDevice,
  settings: SiteNavigationTopBarResponsiveSettings,
  logoDisplaySize?: SiteLogoDisplaySize | null,
  coordinateScale = 1
) {
  if (item.id === 'navigation') return device === 'mobile' || settings.navigationMode === 'hamburger' ? 32 : 43;
  if (item.id === 'logo') {
    return logoDisplaySize?.explicit
      ? (logoDisplaySize.heightPx + topBarLogoLinkPaddingFinalPx) / Math.max(coordinateScale, 0.0001)
      : 34;
  }
  if (item.id === 'ai') return settings.aiMode === 'icon' ? 32 : 36;
  return 32;
}

function getTopBarRenderedViewportHeight(settings: SiteNavigationTopBarResponsiveSettings) {
  return Math.max(44, settings.height);
}

function getTopBarElementYInPlacementBounds(
  placementBounds: TopBarRect,
  elementHeight: number
) {
  return placementBounds.y + (placementBounds.height - elementHeight) / 2;
}

function deriveTopBarElementWidthMode(
  item: SiteNavigationTopBarResponsiveItem,
  device: SiteNavigationTopBarDevice,
  settings: SiteNavigationTopBarResponsiveSettings
): SiteNavigationTopBarItemWidthMode {
  if (item.id === 'logo' || item.id === 'cart') return 'fixed';
  if (item.id === 'search' && item.slot !== 'menu') return 'fixed';
  if (item.id === 'navigation' && (device === 'mobile' || settings.navigationMode === 'hamburger')) return 'fixed';
  return 'auto';
}

function getDerivedTopBarFixedWidthPx(
  item: SiteNavigationTopBarResponsiveItem,
  device: SiteNavigationTopBarDevice,
  settings: SiteNavigationTopBarResponsiveSettings
) {
  if (item.id === 'logo') return Math.max(item.fixedWidthPx ?? 0, SITE_NAVIGATION_TOP_BAR_LOGO_WIDTH_PX);
  if (item.id === 'cart') return 32;
  if (item.id === 'navigation' && (device === 'mobile' || settings.navigationMode === 'hamburger')) return 32;
  if (item.id === 'search' && item.slot !== 'menu') return SITE_NAVIGATION_TOP_BAR_SEARCH_COLLAPSED_WIDTH_PX;

  return null;
}

function getTopBarElementComputedWidth({
  item,
  items,
  device,
  settings,
  logoDisplaySize
}: {
  item: SiteNavigationTopBarResponsiveItem;
  items: SiteNavigationTopLevelItem[];
  device: SiteNavigationTopBarDevice;
  settings: SiteNavigationTopBarResponsiveSettings;
  logoDisplaySize?: SiteLogoDisplaySize | null;
}) {
  if (item.id === 'logo') {
    return Math.max(
      item.widthPx,
      item.fixedWidthPx ?? 0,
      SITE_NAVIGATION_TOP_BAR_LOGO_WIDTH_PX,
      logoDisplaySize?.explicit ? logoDisplaySize.widthPx + topBarLogoLinkPaddingFinalPx : 0
    );
  }


  if (item.id === 'search' && item.slot !== 'menu') {
    return SITE_NAVIGATION_TOP_BAR_SEARCH_COLLAPSED_WIDTH_PX;
  }
  if (item.widthPx > 0) return item.widthPx;

  const derivedFixedWidth = getDerivedTopBarFixedWidthPx(item, device, settings);
  if (derivedFixedWidth !== null) return derivedFixedWidth;

  const estimatedWidth = estimateTopBarElementWidth({ id: item.id, items, device, settings });
  if (deriveTopBarElementWidthMode(item, device, settings) === 'fill') return Math.max(item.minWidthPx ?? 0, estimatedWidth);

  return clampTopBarNumber(estimatedWidth, item.minWidthPx ?? 0, item.maxWidthPx ?? 1600);
}

function getTopBarElementRenderedPlacementWidth({
  item,
  items,
  device,
  settings,
  logoDisplaySize
}: {
  item: SiteNavigationTopBarResponsiveItem;
  items: SiteNavigationTopLevelItem[];
  device: SiteNavigationTopBarDevice;
  settings: SiteNavigationTopBarResponsiveSettings;
  logoDisplaySize?: SiteLogoDisplaySize | null;
}) {
  if (item.id === 'navigation') {
    const compactNavigationWidth = getDerivedTopBarFixedWidthPx(item, device, settings);
    if (compactNavigationWidth !== null) return compactNavigationWidth;
  }

  return getTopBarElementComputedWidth({ item, items, device, settings, logoDisplaySize });
}

function getTopBarElementXInBounds(
  item: SiteNavigationTopBarResponsiveItem,
  placementBoundsWidth: number,
  elementWidth: number,
  baseElementWidth = elementWidth
) {
  const maxXPx = Math.max(0, placementBoundsWidth - elementWidth);

  if (item.region === 'edgeRight') {
    return Math.round(maxXPx);
  }

  const ratioX = item.xRatio * placementBoundsWidth;
  const baseMaxXPx = Math.max(0, placementBoundsWidth - baseElementWidth);
  const baseXPx = clampTopBarNumber(ratioX, 0, baseMaxXPx);
  if (item.region === 'center') {
    return Math.round(baseXPx - Math.max(0, elementWidth - baseElementWidth) / 2);
  }

  return Math.round(clampTopBarNumber(ratioX, 0, maxXPx));
}

function isTopBarPlacementItemRendered(
  item: SiteNavigationTopBarResponsiveItem,
  device: SiteNavigationTopBarDevice,
  settings: SiteNavigationTopBarResponsiveSettings
) {
  if (!item.visible) return false;

  if (device === 'mobile') {
    return item.id === 'navigation' || item.id === 'logo' || item.id === 'cart';
  }

  return true;
}

function sortTopBarResponsiveSlotItems(items: SiteNavigationTopBarResponsiveItem[]) {
  return [...items].sort((first, second) => {
    const orderDelta = first.orderIndex - second.orderIndex;
    return orderDelta === 0 ? first.position - second.position : orderDelta;
  });
}

function getTopBarItemsAfterDropReorder(
  items: SiteNavigationTopBarResponsiveItem[],
  id: SiteNavigationTopBarElementId,
  slot: TopBarZone,
  insertionIndex: number
) {
  const activeItem = items.find((item) => item.id === id);
  if (!activeItem) return items;

  const targetSiblings = sortTopBarResponsiveSlotItems(items.filter((item) => item.id !== id && item.slot === slot));
  const nextTargetItems = [...targetSiblings];
  nextTargetItems.splice(clampTopBarNumber(insertionIndex, 0, nextTargetItems.length), 0, { ...activeItem, slot });
  const orderIndexById = new Map<SiteNavigationTopBarElementId, number>();

  nextTargetItems.forEach((item, index) => {
    orderIndexById.set(item.id, index + 1);
  });

  (['left', 'center', 'right', 'menu'] as SiteNavigationTopBarSlot[]).forEach((currentSlot) => {
    if (currentSlot === slot) return;
    sortTopBarResponsiveSlotItems(items.filter((item) => item.id !== id && item.slot === currentSlot)).forEach((item, index) => {
      orderIndexById.set(item.id, index + 1);
    });
  });

  return items.map((item) => {
    const nextOrderIndex = orderIndexById.get(item.id);
    if (item.id === id) return { ...item, slot, orderIndex: nextOrderIndex ?? item.orderIndex };
    if (nextOrderIndex !== undefined) return { ...item, orderIndex: nextOrderIndex };
    return item;
  });
}

function formatSignedTopBarPx(value: number) {
  const rounded = Math.round(value);
  return `${rounded > 0 ? '+' : ''}${rounded} px`;
}

function groupTopBarWidth(
  zoneItems: SiteNavigationTopBarResponsiveItem[],
  elementWidths: Partial<Record<SiteNavigationTopBarElementId, number>>,
  itemGapPx: number
) {
  if (zoneItems.length === 0) return 0;

  return zoneItems.reduce((total, item, index) => {
    const width = elementWidths[item.id] ?? 0;
    return total + item.marginBeforePx + width + item.marginAfterPx + (index > 0 ? itemGapPx : 0);
  }, 0);
}

function getTopBarZoneRects({
  contentRect,
  columnGapPx,
  zoneSettings,
  leftGroupWidth,
  centerGroupWidth,
  rightGroupWidth
}: {
  contentRect: TopBarRect;
  columnGapPx: number;
  zoneSettings: SiteNavigationTopBarZoneSettings;
  leftGroupWidth: number;
  centerGroupWidth: number;
  rightGroupWidth: number;
}) {
  const zoneKeys: TopBarZone[] = ['left', 'center', 'right'];
  const groupWidths: Record<TopBarZone, number> = {
    left: leftGroupWidth,
    center: centerGroupWidth,
    right: rightGroupWidth
  };
  const naturalFallbacks: Record<TopBarZone, number> = {
    left: Math.min(140, contentRect.width * 0.2),
    center: Math.min(280, contentRect.width * 0.34),
    right: Math.min(140, contentRect.width * 0.2)
  };
  const gapTotal = columnGapPx * 2;
  const fixedWidthTotal = zoneKeys.reduce((total, zone) => {
    const setting = zoneSettings[zone];
    if (setting.widthMode === 'fill') return total;
    if (setting.widthMode === 'fixed') return total + (setting.widthPx ?? naturalFallbacks[zone]);
    return total + Math.max(groupWidths[zone], naturalFallbacks[zone]);
  }, 0);
  const fillZones = zoneKeys.filter((zone) => zoneSettings[zone].widthMode === 'fill');
  const fillWidth = fillZones.length > 0 ? Math.max(0, (contentRect.width - gapTotal - fixedWidthTotal) / fillZones.length) : 0;
  const zoneWidths = zoneKeys.reduce<Record<TopBarZone, number>>((widths, zone) => {
    const setting = zoneSettings[zone];
    widths[zone] = setting.widthMode === 'fill'
      ? fillWidth
      : setting.widthMode === 'fixed'
        ? setting.widthPx ?? naturalFallbacks[zone]
        : Math.max(groupWidths[zone], naturalFallbacks[zone]);
    return widths;
  }, { left: 0, center: 0, right: 0 });
  const leftX = contentRect.x;
  const centerX = leftX + zoneWidths.left + columnGapPx;
  const rightX = centerX + zoneWidths.center + columnGapPx;

  return {
    leftZoneRect: createTopBarRect(leftX, contentRect.y, zoneWidths.left, contentRect.height),
    centerZoneRect: createTopBarRect(centerX, contentRect.y, zoneWidths.center, contentRect.height),
    rightZoneRect: createTopBarRect(rightX, contentRect.y, zoneWidths.right, contentRect.height)
  };
}

function placeTopBarZoneItems({
  zoneItems,
  groupStartX,
  settings,
  device,
  items,
  elementWidths
}: {
  zoneItems: SiteNavigationTopBarResponsiveItem[];
  groupStartX: number;
  settings: SiteNavigationTopBarResponsiveSettings;
  device: SiteNavigationTopBarDevice;
  items: SiteNavigationTopLevelItem[];
  elementWidths: Partial<Record<SiteNavigationTopBarElementId, number>>;
}) {
  const elementRects: Partial<Record<SiteNavigationTopBarElementId, TopBarRect>> = {};
  const spacingRects: Partial<Record<SiteNavigationTopBarElementId, TopBarSpacingRects>> = {};
  const widthRects: Partial<Record<SiteNavigationTopBarElementId, TopBarRect>> = {};
  let cursorX = groupStartX;

  zoneItems.forEach((item, index) => {
    if (index > 0) cursorX += settings.itemGapPx;

    const width = elementWidths[item.id] ?? getTopBarElementComputedWidth({ item, items, device, settings });
    const height = getTopBarElementVisualHeight(item, device, settings);
    const y = (settings.height - height) / 2;
    const beforeStartX = cursorX;
    const beforeEndX = cursorX + item.marginBeforePx;
    const beforeRect = createTopBarRect(Math.min(beforeStartX, beforeEndX), y, Math.abs(item.marginBeforePx), height);
    cursorX = beforeEndX;

    const elementRect = createTopBarRect(cursorX, y, width, height);
    cursorX += width;

    const afterStartX = cursorX;
    const afterEndX = cursorX + item.marginAfterPx;
    const afterRect = createTopBarRect(Math.min(afterStartX, afterEndX), y, Math.abs(item.marginAfterPx), height);
    cursorX = afterEndX;

    elementRects[item.id] = elementRect;
    spacingRects[item.id] = { before: beforeRect, after: afterRect };
    widthRects[item.id] = createTopBarRect(elementRect.x, elementRect.y, elementRect.width, elementRect.height);
  });

  return { elementRects, spacingRects, widthRects };
}

function calculateTopBarGeometry({
  viewportWidth,
  viewportHeight,
  siteLayout,
  settings,
  layoutItems,
  items,
  device,
  logoDisplaySize,
  labelScale = 1,
  coordinateScale = 1
}: {
  viewportWidth: number;
  viewportHeight: number;
  siteLayout: SiteNavigationSiteLayoutSettings;
  settings: SiteNavigationTopBarResponsiveSettings;
  layoutItems: SiteNavigationTopBarResponsiveItem[];
  items: SiteNavigationTopLevelItem[];
  device: SiteNavigationTopBarDevice;
  logoDisplaySize?: SiteLogoDisplaySize | null;
  labelScale?: number;
  coordinateScale?: number;
}): TopBarGeometry {
  const coordinateScaleFactor = coordinateScale > 0 ? coordinateScale : 1;
  const viewportRect = createTopBarRect(0, 0, viewportWidth, viewportHeight);
  const selectedContainer = getTopBarContainerForWidthMode({
    viewportWidth,
    viewportHeight,
    widthMode: settings.widthMode,
    settings,
    siteLayout
  });
  const widthModeGuideRects = (Object.keys(topBarWidthModeLabels) as SiteNavigationTopBarWidthMode[]).reduce(
    (guides, widthMode) => {
      const modeContainer = getTopBarContainerForWidthMode({
        viewportWidth,
        viewportHeight,
        widthMode,
        settings,
        siteLayout
      });
      const label =
        widthMode === 'match_content'
          ? `Širina strani: ${Math.round(modeContainer.containerRect.width * labelScale)} px`
          : widthMode === 'custom'
            ? `Po meri: ${Math.round(modeContainer.containerRect.width * labelScale)} px`
            : `Celotna stran: ${Math.round(modeContainer.containerRect.width * labelScale)} px`;
      const innerLabel = `Notranja širina: ${Math.round(modeContainer.contentRect.width * labelScale)} px po robovih`;

      guides[widthMode] = {
        containerRect: modeContainer.containerRect,
        contentRect: modeContainer.contentRect,
        label,
        innerLabel
      };

      return guides;
    },
    {} as Record<SiteNavigationTopBarWidthMode, TopBarWidthModeGuide>
  );
  const visibleItems = [...layoutItems]
    .filter((item) => isTopBarPlacementItemRendered(item, device, settings))
    .sort((first, second) => {
      const xDelta = first.xPx - second.xPx;
      return xDelta === 0 ? first.zIndex - second.zIndex : xDelta;
    });
  const elementRects: Partial<Record<SiteNavigationTopBarElementId, TopBarRect>> = {};
  const spacingRects: Partial<Record<SiteNavigationTopBarElementId, TopBarSpacingRects>> = {};
  const widthRects: Partial<Record<SiteNavigationTopBarElementId, TopBarRect>> = {};
  const placementBounds = selectedContainer.contentRect;

  visibleItems.forEach((item) => {
    const baseWidth = getTopBarElementRenderedPlacementWidth({ item, items, device, settings }) / coordinateScaleFactor;
    const width = getTopBarElementRenderedPlacementWidth({
      item,
      items,
      device,
      settings,
      logoDisplaySize
    }) / coordinateScaleFactor;
    const height = getTopBarElementVisualHeight(
      item,
      device,
      settings,
      logoDisplaySize,
      coordinateScaleFactor
    );
    const xInBounds = getTopBarElementXInBounds(item, placementBounds.width, width, baseWidth);
    const x = placementBounds.x + xInBounds;
    const y = getTopBarElementYInPlacementBounds(placementBounds, height);
    const elementRect = createTopBarRect(x, y, width, height);

    elementRects[item.id] = elementRect;
    spacingRects[item.id] = {
      before: createTopBarRect(x, y, 0, height),
      after: createTopBarRect(getTopBarRectRight(elementRect), y, 0, height)
    };
    widthRects[item.id] = elementRect;
  });
  const leftZoneRect = createTopBarRect(placementBounds.x, placementBounds.y, placementBounds.width / 3, placementBounds.height);
  const centerZoneRect = createTopBarRect(
    placementBounds.x + placementBounds.width / 3,
    placementBounds.y,
    placementBounds.width / 3,
    placementBounds.height
  );
  const rightZoneRect = createTopBarRect(
    placementBounds.x + placementBounds.width * 2 / 3,
    placementBounds.y,
    placementBounds.width / 3,
    placementBounds.height
  );
  const zoneOrderIds = {
    left: [] as SiteNavigationTopBarElementId[],
    center: visibleItems.map((item) => item.id),
    right: [] as SiteNavigationTopBarElementId[]
  };

  return {
    viewportRect,
    containerRect: selectedContainer.containerRect,
    contentRect: selectedContainer.contentRect,
    leftZoneRect,
    centerZoneRect,
    rightZoneRect,
    elementRects,
    spacingRects,
    widthRects,
    containerWidthGuideRect:
      settings.widthMode === 'custom' ? selectedContainer.containerRect : selectedContainer.contentRect,
    marginGuideRects: {
      left: createTopBarRect(
        selectedContainer.containerRect.x,
        selectedContainer.containerRect.y,
        selectedContainer.contentRect.x - selectedContainer.containerRect.x,
        selectedContainer.containerRect.height
      ),
      right: createTopBarRect(
        getTopBarRectRight(selectedContainer.contentRect),
        selectedContainer.containerRect.y,
        getTopBarRectRight(selectedContainer.containerRect) - getTopBarRectRight(selectedContainer.contentRect),
        selectedContainer.containerRect.height
      )
    },
    widthModeGuideRects,
    zoneOrderIds
  };
}

function useMeasuredElementWidth<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);
  const [element, setElement] = useState<T | null>(null);
  const [width, setWidth] = useState(0);
  const measureRef = useCallback((node: T | null) => {
    ref.current = node;
    setElement(node);
    if (node) {
      setWidth(Math.round(node.getBoundingClientRect().width));
    }
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

function TopBarPreviewGridOverlay({ width, height, visualScale = 1 }: { width: number; height: number; visualScale?: number }) {
  const scale = visualScale > 0 ? visualScale : 1;
  const xStep = topBarPreviewGridLineStepPx / scale;
  const xMarkers = Array.from({ length: Math.floor(width / xStep) + 1 }, (_, index) => index * xStep).filter(
    (marker) => marker <= width
  );
  const xLineMarkers = xMarkers.filter((marker) => marker > 0 && marker < width);
  const yLineMarkers = [height / 4, height / 2, (height * 3) / 4];

  return (
    <>
      <div
        className="pointer-events-none absolute inset-0 z-20 rounded-xl bg-[rgba(37,99,235,0.025)]"
        aria-hidden="true"
      />
      <div className="pointer-events-none absolute inset-0 z-[21] overflow-hidden rounded-xl" aria-hidden="true">
        {xLineMarkers.map((marker) => (
          <span
            key={`x-line-${marker}`}
            className="absolute bottom-0 top-0 w-px bg-[rgba(37,99,235,0.16)]"
            style={{ left: `${(marker / width) * 100}%` }}
          />
        ))}
        {yLineMarkers.map((marker) => (
          <span
            key={`y-line-${marker}`}
            className="absolute left-0 right-0 h-px bg-[rgba(37,99,235,0.14)]"
            style={{ top: `${(marker / height) * 100}%` }}
          />
        ))}
      </div>
    </>
  );
}

function TopBarPreviewRulerOverlay({
  viewportWidth,
  viewportHeight,
  heightValue,
  viewportX,
  viewportY
}: {
  viewportWidth: number;
  viewportHeight: number;
  heightValue: number;
  viewportX: number;
  viewportY: number;
}) {
  const finalXMarker = viewportWidth;
  const xLabelStep = 100;
  const xLabelCandidates = Array.from(new Set([
    0,
    ...Array.from({ length: Math.floor(viewportWidth / xLabelStep) }, (_, index) => (index + 1) * xLabelStep)
      .filter((marker) => marker < finalXMarker),
    finalXMarker
  ])).sort((first, second) => first - second);
  const xLabels = xLabelCandidates.reduce<Array<{ marker: number; label: string; left: number; width: number }>>(
    (labels, marker) => {
      const label = `${formatPreviewRulerNumber(marker)}${marker === finalXMarker ? 'px' : ''}`;
      const labelWidth = Math.max(12, label.length * 4.6);
      const left = Math.min(
        Math.max(viewportX + 3, marker === finalXMarker ? viewportX + viewportWidth - labelWidth - 3 : viewportX + marker - labelWidth / 2),
        Math.max(viewportX + 3, viewportX + viewportWidth - labelWidth - 3)
      );
      const previous = labels[labels.length - 1];

      if (previous && left < previous.left + previous.width + 8) {
        if (marker === finalXMarker) labels.pop();
        else return labels;
      }

      labels.push({ marker, label, left, width: labelWidth });
      return labels;
    },
    []
  );
  const yMarkers = [0, viewportHeight / 2, viewportHeight];
  const yLabels = yMarkers.reduce<Array<{ marker: number; label: string; top: number }>>((labels, marker) => {
    const labelValue = viewportHeight > 0 ? marker / viewportHeight * heightValue : marker;
    const label = `${formatPreviewRulerNumber(labelValue)}${marker === viewportHeight ? 'px' : ''}`;
    const top = Math.min(
      Math.max(viewportY + 1, viewportY + marker - 4),
      Math.max(viewportY + 1, viewportY + viewportHeight - 9)
    );
    const previous = labels[labels.length - 1];

    if (previous && top < previous.top + 9) return labels;
    labels.push({ marker, label, top });
    return labels;
  }, []);

  return (
    <div className="pointer-events-none absolute inset-0 z-[24] overflow-hidden" aria-hidden="true">
      {xLabels.map(({ marker }) => (
        <span
          key={`x-ruler-tick-${marker}`}
          className="absolute w-px rounded-full bg-slate-400/45"
          style={{
            height: 4,
            left: viewportX + marker,
            top: viewportY - 4
          }}
        />
      ))}
      {xLabels.map(({ marker, label, left, width: labelWidth }) => (
        <span
          key={`x-ruler-${marker}`}
          className="absolute rounded-sm px-0.5 text-[8px] font-medium leading-none text-slate-400/85"
          style={{
            left,
            top: Math.max(2, viewportY - 11),
            width: labelWidth
          }}
        >
          {label}
        </span>
      ))}
      {yLabels.map(({ marker }) => (
        <span
          key={`y-ruler-tick-${marker}`}
          className="absolute h-px rounded-full bg-slate-400/45"
          style={{
            left: Math.max(0, viewportX - 5),
            top: viewportY + marker,
            width: Math.min(5, viewportX)
          }}
        />
      ))}
      {yLabels.map(({ marker, label, top }) => (
        <span
          key={`y-ruler-${marker}`}
          className="absolute whitespace-nowrap text-right text-[8px] font-medium leading-none text-slate-400/85"
          style={{
            left: 2,
            top,
            width: Math.max(18, viewportX - 6)
          }}
        >
          {label}
        </span>
      ))}
    </div>
  );
}

function getTopBarPreviewViewportWidth(
  device: SiteNavigationTopBarDevice,
  settings: SiteNavigationTopBarResponsiveSettings,
  siteLayout: SiteNavigationSiteLayoutSettings
) {
  if (device !== 'desktop') return topBarDevicePreviewWidths[device];
  return Math.max(
    topBarDevicePreviewWidths.desktop,
    siteLayout.siteContentMaxWidthPx + siteLayout.siteGutterMinPx * 2,
    settings.customMaxWidthPx ?? 0
  );
}

function getTopBarSelectedWidthLabel(settings: SiteNavigationTopBarResponsiveSettings, geometry: TopBarGeometry, labelScale = 1) {
  const containerWidth = Math.round(geometry.containerRect.width * labelScale);
  const contentWidth = Math.round(geometry.contentRect.width * labelScale);

  if (settings.widthMode === 'custom') {
    return `Po meri: ${containerWidth} px`;
  }

  if (settings.widthMode === 'full') {
    return `Celotna stran: ${containerWidth} px`;
  }

  return `Vsebina: ${contentWidth} px`;
}

function getPreviewScale(availableWidth: number, viewportWidth: number, viewportHeight: number) {
  if (availableWidth <= 0 || viewportWidth <= 0 || viewportHeight <= 0) return 1;

  return Math.min(
    availableWidth / viewportWidth,
    topBarTechnicalPreviewVisualTopbarHeightPx / viewportHeight
  );
}

function computeOverflowStatus({
  geometry,
  settings
}: {
  geometry: TopBarGeometry;
  settings: SiteNavigationTopBarResponsiveSettings;
}): TopBarOverflowStatus {
  const renderedRects = (Object.keys(geometry.elementRects) as SiteNavigationTopBarElementId[])
    .map((elementId) => geometry.elementRects[elementId])
    .filter((rect): rect is TopBarRect => Boolean(rect));

  if (renderedRects.length === 0) {
    return { tone: 'ok', label: 'Postavitev ustreza' };
  }

  const minX = Math.min(...renderedRects.map((rect) => rect.x));
  const maxX = Math.max(...renderedRects.map((rect) => getTopBarRectRight(rect)));
  const rightOverflowPx = Math.ceil(maxX - getTopBarRectRight(geometry.contentRect));
  const leftOverflowPx = Math.ceil(geometry.contentRect.x - minX);
  const overflowPx = Math.max(rightOverflowPx, leftOverflowPx);
  const hasOverlap = renderedRects.some((rect, index) =>
    renderedRects.slice(index + 1).some((nextRect) =>
      rect.x < getTopBarRectRight(nextRect) &&
      getTopBarRectRight(rect) > nextRect.x &&
      rect.y < nextRect.y + nextRect.height &&
      rect.y + rect.height > nextRect.y
    )
  );

  if (rightOverflowPx > 1) {
    return {
      tone: 'warning',
      label: 'Elementi presegajo desno območje',
      detail: `Presežek: ${rightOverflowPx} px. Premaknite element levo, zmanjšajte širino ali ga skrijte.`
    };
  }

  if (overflowPx > 1) {
    return {
      tone: 'warning',
      label: `Premalo prostora: ${overflowPx} px`,
      detail: 'Premaknite elemente znotraj postavitvenega območja ali zmanjšajte širino.'
    };
  }

  if (hasOverlap) {
    return {
      tone: 'warning',
      label: 'Elementi se prekrivajo'
    };
  }

  if (settings.navigationMode === 'hamburger') {
    return {
      tone: 'info',
      label: 'Navigacija bo skrita pri tej širini'
    };
  }

  return { tone: 'ok', label: 'Postavitev ustreza' };
}

function topBarRectStyle(rect: TopBarRect): CSSProperties {
  return {
    height: rect.height,
    left: rect.x,
    top: rect.y,
    width: rect.width
  };
}

function getTopBarZoneRect(geometry: TopBarGeometry, zone: TopBarZone) {
  if (zone === 'left') return geometry.leftZoneRect;
  if (zone === 'center') return geometry.centerZoneRect;
  return geometry.rightZoneRect;
}

function getTopBarGuideFromActiveEdit(activeEdit: TopBarActiveEdit): TopBarActiveGuide {
  const fieldName = activeEdit.fieldName ?? '';

  if (activeEdit.kind === 'width-mode') return { type: 'topbar_width' };
  if (activeEdit.kind === 'container-width') {
    if (fieldName === 'siteContentMaxWidthPx') return { type: 'page_width' };
    if (fieldName === 'height') return { type: 'height' };
    if (fieldName === 'siteGutterRangePx') return { type: 'min_gutter' };
    if (fieldName === 'siteGutterMinPx') return { type: 'min_gutter' };
    if (fieldName === 'siteGutterMaxPx') return { type: 'max_gutter' };
    return { type: 'topbar_width' };
  }
  if (activeEdit.kind === 'layout-mode') {
    if (fieldName === 'columnGapPx') return { type: 'zone_gap' };
    if (fieldName === 'itemGapPx') return { type: 'element_gap' };
    if (fieldName.startsWith('zone-')) {
      const zone = fieldName.split('-')[1];
      if (zone === 'left' || zone === 'center' || zone === 'right') return { type: 'zone_width', zone };
    }
  }
  if (activeEdit.kind === 'element-width' && activeEdit.elementId) return { type: 'element_width', elementKey: activeEdit.elementId };
  if (activeEdit.kind === 'gap-before' && activeEdit.elementId) return { type: 'margin_before', elementKey: activeEdit.elementId };
  if (activeEdit.kind === 'gap-after' && activeEdit.elementId) return { type: 'margin_after', elementKey: activeEdit.elementId };

  return { type: 'none' };
}

function isTopBarPointInsideRect(rect: TopBarRect, x: number, y: number) {
  return x >= rect.x && x <= getTopBarRectRight(rect) && y >= rect.y && y <= rect.y + rect.height;
}

function getTopBarZoneFromPoint(geometry: TopBarGeometry, x: number, y: number): TopBarZone {
  const zones = (Object.keys(topBarZoneLabels) as TopBarZone[]).map((zone) => ({
    zone,
    rect: getTopBarZoneRect(geometry, zone)
  }));
  const containingZone = zones.find(({ rect }) => isTopBarPointInsideRect(rect, x, y));
  if (containingZone) return containingZone.zone;

  return zones.reduce((nearest, current) => {
    const nearestDistance = Math.abs(getTopBarRectCenterX(nearest.rect) - x);
    const currentDistance = Math.abs(getTopBarRectCenterX(current.rect) - x);
    return currentDistance < nearestDistance ? current : nearest;
  }, zones[0]).zone;
}

function getTopBarDropTarget({
  geometry,
  x,
  y,
  startXPx,
  grabOffsetX,
  width,
  height,
  coordinateScale = 1
}: {
  geometry: TopBarGeometry;
  x: number;
  y: number;
  startXPx: number;
  grabOffsetX: number;
  width: number;
  height: number;
  coordinateScale?: number;
}): TopBarDropTarget {
  const coordinateScaleFactor = coordinateScale > 0 ? coordinateScale : 1;
  const placementBounds = geometry.contentRect;
  const rawX = x - placementBounds.x - grabOffsetX;
  const maxX = Math.max(0, placementBounds.width - width);
  const logicalXPx = clampTopBarNumber(rawX, 0, maxX);
  const xPx = Math.round(logicalXPx * coordinateScaleFactor);
  const xRatio = placementBounds.width > 0 ? logicalXPx / placementBounds.width : 0;
  const rectTop = clampTopBarNumber(
    y - height / 2,
    placementBounds.y,
    Math.max(placementBounds.y, placementBounds.y + placementBounds.height - height)
  );

  return {
    xPx,
    xRatio,
    deltaPx: xPx - startXPx,
    rect: createTopBarRect(placementBounds.x + logicalXPx, rectTop, width, height),
    constrained: Math.abs(rawX - logicalXPx) > 0.5
  };
}

function TopBarGuideLabel({
  rect,
  children,
  className = '',
  align = 'center'
}: {
  rect: TopBarRect;
  children: ReactNode;
  className?: string;
  align?: 'left' | 'center' | 'right';
}) {
  return (
    <span
      className={`absolute z-[45] whitespace-nowrap rounded bg-[color:var(--blue-500)] px-1.5 py-0.5 text-[10px] font-semibold leading-none text-white shadow-sm ${className}`}
      style={{
        left: align === 'left' ? rect.x : align === 'right' ? getTopBarRectRight(rect) : rect.x + rect.width / 2,
        top: Math.max(2, rect.y - 14),
        transform: align === 'left' ? 'none' : align === 'right' ? 'translateX(-100%)' : 'translateX(-50%)'
      }}
    >
      {children}
    </span>
  );
}

function getTopBarDropGuideRect(geometry: TopBarGeometry, target: TopBarDropTarget): TopBarRect {
  return createTopBarRect(target.rect.x, geometry.viewportRect.y + 6, 0, Math.max(12, geometry.viewportRect.height - 12));
}

function getTopBarColumnGapRects(geometry: TopBarGeometry) {
  return [
    createTopBarRect(
      getTopBarRectRight(geometry.leftZoneRect),
      geometry.viewportRect.y,
      geometry.centerZoneRect.x - getTopBarRectRight(geometry.leftZoneRect),
      geometry.viewportRect.height
    ),
    createTopBarRect(
      getTopBarRectRight(geometry.centerZoneRect),
      geometry.viewportRect.y,
      geometry.rightZoneRect.x - getTopBarRectRight(geometry.centerZoneRect),
      geometry.viewportRect.height
    )
  ].filter((rect) => rect.width > 0.5);
}

function getTopBarItemGapRects(geometry: TopBarGeometry, preferredZone: TopBarZone | null) {
  const zones = (Object.keys(topBarZoneLabels) as TopBarZone[]).sort((first, second) => {
    if (first === preferredZone) return -1;
    if (second === preferredZone) return 1;
    return 0;
  });

  return zones.flatMap((zone) =>
    geometry.zoneOrderIds[zone].slice(1).flatMap((elementId, index) => {
      const previousRect = geometry.elementRects[geometry.zoneOrderIds[zone][index]];
      const currentRect = geometry.elementRects[elementId];
      if (!previousRect || !currentRect) return [];
      const gapX = getTopBarRectRight(previousRect);
      const width = currentRect.x - gapX;
      if (width <= 0.5) return [];

      return [{
        zone,
        rect: createTopBarRect(
          gapX,
          Math.min(previousRect.y, currentRect.y),
          width,
          Math.max(previousRect.height, currentRect.height)
        )
      }];
    })
  );
}

function labelRectForGuide(rect: TopBarRect): TopBarRect {
  return createTopBarRect(rect.x, Math.max(16, rect.y), rect.width, rect.height);
}

function TopBarGeometryOverlay({
  geometry,
  device,
  settings,
  layoutItems,
  activeEdit,
  activeGuide,
  selectedElementId,
  dragState,
  dropTarget,
  showGrid,
  labelScale = 1,
  onStartWidthDrag
}: {
  geometry: TopBarGeometry;
  device: SiteNavigationTopBarDevice;
  settings: SiteNavigationTopBarResponsiveSettings;
  layoutItems: SiteNavigationTopBarResponsiveItem[];
  activeEdit: TopBarActiveEdit;
  activeGuide: TopBarActiveGuide;
  selectedElementId: SiteNavigationTopBarElementId;
  dragState: TopBarViewportDragState;
  dropTarget: TopBarDropTarget | null;
  showGrid: boolean;
  labelScale?: number;
  onStartWidthDrag: (elementId: SiteNavigationTopBarElementId, edge: 'left' | 'right', event: ReactPointerEvent<HTMLButtonElement>) => void;
}) {
  const hasActiveEdit = activeEdit.kind !== null || dragState !== null;
  const isAdvancedMode = false;
  const activeZone: TopBarZone | null = null;
  const activeElementId = activeEdit.elementId ?? selectedElementId;
  const ghostWidthMode =
    activeEdit.kind === 'width-mode' &&
    (activeEdit.fieldName === 'match_content' || activeEdit.fieldName === 'custom' || activeEdit.fieldName === 'full')
      ? (activeEdit.fieldName as SiteNavigationTopBarWidthMode)
      : null;
  const showZones = false;
  const showOrderMarkers = false;
  const showMargins = false;
  const showContainerGuide = activeEdit.kind === 'container-width' || activeEdit.kind === 'width-mode';
  const selectedWidthGuide = geometry.widthModeGuideRects[settings.widthMode];
  const activeWidthRect = activeElementId ? geometry.widthRects[activeElementId] : undefined;
  const activeWidthItem = activeElementId ? layoutItems.find((item) => item.id === activeElementId) : undefined;
  const resizeHandleElementId = dragState?.type === 'width' ? dragState.elementId : selectedElementId;
  const dropGuideRect = dropTarget ? getTopBarDropGuideRect(geometry, dropTarget) : null;
  const dropLabelAlign = dropTarget && dropTarget.rect.x > geometry.viewportRect.width - 170 ? 'right' : 'left';
  const dropAdjustmentLabel = dropTarget && Math.abs(dropTarget.deltaPx) >= 0.5
    ? `premik ${formatSignedTopBarPx(dropTarget.deltaPx)}`
    : 'naravno';
  const dropDistanceGuide = dropTarget
    ? (() => {
        const targetLeft = dropTarget.rect.x;
        const targetRight = getTopBarRectRight(dropTarget.rect);
        const targetCenter = getTopBarRectCenterX(dropTarget.rect);
        const contentLeft = geometry.contentRect.x;
        const contentRight = getTopBarRectRight(geometry.contentRect);
        const contentCenter = getTopBarRectCenterX(geometry.contentRect);
        const labelMinX = contentLeft + 28;
        const labelMaxX = Math.max(labelMinX, contentRight - 28);
        const edgeGuideY = clampTopBarNumber(
          dropTarget.rect.y + dropTarget.rect.height + 9,
          geometry.viewportRect.y + 10,
          geometry.viewportRect.height - 5
        );
        const centerGuideY = clampTopBarNumber(
          dropTarget.rect.y - 7,
          geometry.viewportRect.y + 7,
          Math.max(geometry.viewportRect.y + 7, edgeGuideY - 10)
        );

        return {
          contentLeft,
          contentRight,
          contentCenter,
          targetLeft,
          targetRight,
          targetCenter,
          edgeGuideY,
          centerGuideY,
          leftLabelX: clampTopBarNumber((contentLeft + targetLeft) / 2, labelMinX, labelMaxX),
          rightLabelX: clampTopBarNumber((targetRight + contentRight) / 2, labelMinX, labelMaxX),
          centerLabelX: clampTopBarNumber((contentCenter + targetCenter) / 2, labelMinX, labelMaxX),
          leftDistancePx: Math.max(0, Math.round((targetLeft - contentLeft) * labelScale)),
          rightDistancePx: Math.max(0, Math.round((contentRight - targetRight) * labelScale)),
          centerDistancePx: Math.round((targetCenter - contentCenter) * labelScale)
        };
      })()
    : null;
  const dropElementDistanceGuides = dropTarget && dragState?.type === 'element'
    ? (() => {
        const targetLeft = dropTarget.rect.x;
        const targetRight = getTopBarRectRight(dropTarget.rect);
        const targetCenter = getTopBarRectCenterX(dropTarget.rect);
        const visibleRects = layoutItems
          .filter((item) => item.id !== dragState.elementId && isTopBarPlacementItemRendered(item, device, settings))
          .map((item) => {
            const rect = geometry.elementRects[item.id];
            if (!rect) return null;

            return {
              id: item.id,
              label: topBarLayoutLabels[item.id],
              rect,
              centerX: getTopBarRectCenterX(rect)
            };
          })
          .filter((item): item is { id: SiteNavigationTopBarElementId; label: string; rect: TopBarRect; centerX: number } => Boolean(item));
        const leftNeighbor = visibleRects
          .filter((item) => item.centerX <= targetCenter)
          .sort((first, second) => second.centerX - first.centerX)[0];
        const rightNeighbor = visibleRects
          .filter((item) => item.centerX > targetCenter)
          .sort((first, second) => first.centerX - second.centerX)[0];
        const labelMinX = geometry.contentRect.x + 28;
        const labelMaxX = Math.max(labelMinX, getTopBarRectRight(geometry.contentRect) - 28);
        const preferredGuideY = dropDistanceGuide ? dropDistanceGuide.edgeGuideY + 11 : dropTarget.rect.y + dropTarget.rect.height / 2;
        const fallbackGuideY = dropTarget.rect.y + dropTarget.rect.height / 2;
        const guideY = preferredGuideY <= geometry.viewportRect.height - 7
          ? preferredGuideY
          : clampTopBarNumber(fallbackGuideY, geometry.viewportRect.y + 8, geometry.viewportRect.height - 8);
        const guides: Array<{
          key: string;
          label: string;
          distancePx: number;
          x1: number;
          x2: number;
          y: number;
          labelX: number;
        }> = [];
        const addGuide = (
          side: 'left' | 'right',
          neighbor: { id: SiteNavigationTopBarElementId; label: string; rect: TopBarRect; centerX: number } | undefined
        ) => {
          if (!neighbor) return;

          const neighborEdge = side === 'left' ? getTopBarRectRight(neighbor.rect) : neighbor.rect.x;
          const targetEdge = side === 'left' ? targetLeft : targetRight;
          const distance = side === 'left' ? targetLeft - neighborEdge : neighborEdge - targetRight;
          const x1 = neighborEdge;
          const x2 = targetEdge;

          guides.push({
            key: `element-distance-${side}-${neighbor.id}`,
            label: neighbor.label,
            distancePx: Math.round(distance * labelScale),
            x1,
            x2,
            y: guideY,
            labelX: clampTopBarNumber((x1 + x2) / 2, labelMinX, labelMaxX)
          });
        };

        addGuide('left', leftNeighbor);
        addGuide('right', rightNeighbor);
        return guides;
      })()
    : [];
  const activeFieldName = activeEdit.fieldName ?? '';
  const showHeightGuide = activeGuide.type === 'height';
  const showGutterGuide = activeGuide.type === 'min_gutter' || activeGuide.type === 'max_gutter';
  const showColumnGapGuide = false;
  const showItemGapGuide = false;
  const activeZoneGuide = null;
  const activeZoneForItemGaps = null;
  const itemGapZone = activeZoneForItemGaps === 'left' || activeZoneForItemGaps === 'center' || activeZoneForItemGaps === 'right'
    ? activeZoneForItemGaps
    : null;
  const columnGapRects = showColumnGapGuide ? getTopBarColumnGapRects(geometry) : [];
  const itemGapRects = showItemGapGuide ? getTopBarItemGapRects(geometry, itemGapZone) : [];

  return (
    <div className="pointer-events-none absolute inset-0 z-[130] overflow-visible" aria-hidden="true">
      {showGrid ? <TopBarPreviewGridOverlay width={geometry.viewportRect.width} height={geometry.viewportRect.height} visualScale={labelScale} /> : null}

      <svg
        className="pointer-events-none absolute inset-0 z-[34] overflow-visible"
        viewBox={`0 0 ${geometry.viewportRect.width} ${geometry.viewportRect.height}`}
        width={geometry.viewportRect.width}
        height={geometry.viewportRect.height}
        focusable="false"
      >
        {showContainerGuide ? (
          <rect
            x={selectedWidthGuide.contentRect.x}
            y={selectedWidthGuide.contentRect.y + 0.5}
            width={selectedWidthGuide.contentRect.width}
            height={Math.max(0, selectedWidthGuide.contentRect.height - 1)}
            rx={6}
            fill="rgba(37,99,235,0.035)"
            stroke="rgba(37,99,235,0.42)"
            strokeWidth="1.25"
          />
        ) : null}
        {showZones
          ? (Object.keys(topBarZoneLabels) as TopBarZone[]).map((zone) => {
              const zoneRect = getTopBarZoneRect(geometry, zone);
              const highlighted = (zone === activeZone && hasActiveEdit) || zone === activeZoneGuide;

              return (
                <rect
                  key={`svg-zone-${zone}`}
                  x={zoneRect.x + 0.5}
                  y={zoneRect.y + 6}
                  width={Math.max(0, zoneRect.width - 1)}
                  height={Math.max(0, zoneRect.height - 12)}
                  rx={7}
                  fill={highlighted ? 'rgba(37,99,235,0.10)' : 'rgba(148,163,184,0.045)'}
                  stroke={highlighted ? 'rgba(37,99,235,0.62)' : 'rgba(100,116,139,0.26)'}
                  strokeWidth={highlighted ? 1.5 : 1}
                />
              );
            })
          : null}
        {showHeightGuide ? (
          <line
            x1={geometry.contentRect.x - 10}
            y1={geometry.viewportRect.y + 2}
            x2={geometry.contentRect.x - 10}
            y2={geometry.viewportRect.height - 2}
            stroke="rgba(37,99,235,0.82)"
            strokeWidth="2"
            strokeLinecap="round"
          />
        ) : null}
        {showGutterGuide ? (
          <>
            <rect
              x={geometry.marginGuideRects.left.x}
              y={geometry.marginGuideRects.left.y + 1}
              width={geometry.marginGuideRects.left.width}
              height={Math.max(0, geometry.marginGuideRects.left.height - 2)}
              fill="rgba(37,99,235,0.14)"
              stroke="rgba(37,99,235,0.42)"
              strokeWidth="1"
            />
            <rect
              x={geometry.marginGuideRects.right.x}
              y={geometry.marginGuideRects.right.y + 1}
              width={geometry.marginGuideRects.right.width}
              height={Math.max(0, geometry.marginGuideRects.right.height - 2)}
              fill="rgba(37,99,235,0.14)"
              stroke="rgba(37,99,235,0.42)"
              strokeWidth="1"
            />
          </>
        ) : null}
        {showColumnGapGuide
          ? columnGapRects.map((rect, index) => (
              <rect
                key={`column-gap-${index}`}
                x={rect.x}
                y={rect.y}
                width={rect.width}
                height={rect.height}
                fill="rgba(37,99,235,0.18)"
                stroke="rgba(37,99,235,0.42)"
                strokeWidth="1"
              />
            ))
          : null}
        {showItemGapGuide
          ? itemGapRects.map(({ rect, zone }, index) => (
              <rect
                key={`item-gap-${zone}-${index}`}
                x={rect.x}
                y={rect.y}
                width={rect.width}
                height={rect.height}
                rx={4}
                fill={zone === itemGapZone ? 'rgba(37,99,235,0.22)' : 'rgba(37,99,235,0.15)'}
                stroke={zone === itemGapZone ? 'rgba(37,99,235,0.48)' : 'rgba(37,99,235,0.28)'}
                strokeWidth="1"
              />
            ))
          : null}
        {activeWidthRect ? (
          <rect
            x={activeWidthRect.x + 0.5}
            y={activeWidthRect.y + 0.5}
            width={Math.max(0, activeWidthRect.width - 1)}
            height={Math.max(0, activeWidthRect.height - 1)}
            rx={7}
            fill="transparent"
            stroke="rgba(37,99,235,0.74)"
            strokeWidth="1.5"
          />
        ) : null}
        {dropTarget ? (
          <rect
            x={dropTarget.rect.x + 0.5}
            y={dropTarget.rect.y + 0.5}
            width={Math.max(0, dropTarget.rect.width - 1)}
            height={Math.max(0, dropTarget.rect.height - 1)}
            rx={7}
            fill="rgba(37,99,235,0.08)"
            stroke="rgba(37,99,235,0.75)"
            strokeDasharray="5 4"
            strokeWidth="1.5"
          />
        ) : null}
        {dropDistanceGuide ? (
          <g>
            <line
              x1={dropDistanceGuide.contentLeft}
              y1={dropDistanceGuide.edgeGuideY}
              x2={dropDistanceGuide.targetLeft}
              y2={dropDistanceGuide.edgeGuideY}
              stroke="rgba(37,99,235,0.62)"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
            <line
              x1={dropDistanceGuide.targetRight}
              y1={dropDistanceGuide.edgeGuideY}
              x2={dropDistanceGuide.contentRight}
              y2={dropDistanceGuide.edgeGuideY}
              stroke="rgba(37,99,235,0.62)"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
            <line
              x1={dropDistanceGuide.contentCenter}
              y1={dropDistanceGuide.centerGuideY}
              x2={dropDistanceGuide.targetCenter}
              y2={dropDistanceGuide.centerGuideY}
              stroke="rgba(37,99,235,0.78)"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeDasharray="4 3"
            />
            {[dropDistanceGuide.contentLeft, dropDistanceGuide.targetLeft, dropDistanceGuide.targetRight, dropDistanceGuide.contentRight].map((x, index) => (
              <line
                key={`drop-edge-tick-${index}`}
                x1={x}
                y1={dropDistanceGuide.edgeGuideY - 4}
                x2={x}
                y2={dropDistanceGuide.edgeGuideY + 4}
                stroke="rgba(37,99,235,0.52)"
                strokeWidth="1"
                strokeLinecap="round"
              />
            ))}
            {[dropDistanceGuide.contentCenter, dropDistanceGuide.targetCenter].map((x, index) => (
              <line
                key={`drop-center-tick-${index}`}
                x1={x}
                y1={dropDistanceGuide.centerGuideY - 4}
                x2={x}
                y2={dropDistanceGuide.centerGuideY + 4}
                stroke="rgba(37,99,235,0.7)"
                strokeWidth="1"
                strokeLinecap="round"
              />
            ))}
            <text
              x={dropDistanceGuide.leftLabelX}
              y={dropDistanceGuide.edgeGuideY - 4}
              textAnchor="middle"
              fontSize="8"
              fontWeight="700"
              fill="rgb(25,130,191)"
              stroke="rgba(255,255,255,0.96)"
              strokeWidth="3"
              paintOrder="stroke"
            >
              Levo {dropDistanceGuide.leftDistancePx} px
            </text>
            <text
              x={dropDistanceGuide.rightLabelX}
              y={dropDistanceGuide.edgeGuideY - 4}
              textAnchor="middle"
              fontSize="8"
              fontWeight="700"
              fill="rgb(25,130,191)"
              stroke="rgba(255,255,255,0.96)"
              strokeWidth="3"
              paintOrder="stroke"
            >
              Desno {dropDistanceGuide.rightDistancePx} px
            </text>
            <text
              x={dropDistanceGuide.centerLabelX}
              y={dropDistanceGuide.centerGuideY - 4}
              textAnchor="middle"
              fontSize="8"
              fontWeight="700"
              fill="rgb(25,130,191)"
              stroke="rgba(255,255,255,0.96)"
              strokeWidth="3"
              paintOrder="stroke"
            >
              Sredina {formatSignedTopBarPx(dropDistanceGuide.centerDistancePx)}
            </text>
          </g>
        ) : null}
        {dropElementDistanceGuides.length > 0 ? (
          <g>
            {dropElementDistanceGuides.map((guide) => (
              <g key={guide.key}>
                <line
                  x1={guide.x1}
                  y1={guide.y}
                  x2={guide.x2}
                  y2={guide.y}
                  stroke="rgba(217,119,6,0.78)"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                />
                {[guide.x1, guide.x2].map((x, index) => (
                  <line
                    key={`${guide.key}-tick-${index}`}
                    x1={x}
                    y1={guide.y - 4}
                    x2={x}
                    y2={guide.y + 4}
                    stroke="rgba(217,119,6,0.62)"
                    strokeWidth="1"
                    strokeLinecap="round"
                  />
                ))}
                <text
                  x={guide.labelX}
                  y={guide.y - 4}
                  textAnchor="middle"
                  fontSize="8"
                  fontWeight="700"
                  fill="rgb(180,83,9)"
                  stroke="rgba(255,255,255,0.96)"
                  strokeWidth="3"
                  paintOrder="stroke"
                >
                  {guide.label} {guide.distancePx} px
                </text>
              </g>
            ))}
          </g>
        ) : null}
        {dropTarget && Math.abs(dropTarget.deltaPx) >= 0.5 ? (
          <line
            x1={dropTarget.rect.x - dropTarget.deltaPx}
            y1={dropTarget.rect.y + dropTarget.rect.height + 7}
            x2={dropTarget.rect.x}
            y2={dropTarget.rect.y + dropTarget.rect.height + 7}
            stroke="rgba(37,99,235,0.72)"
            strokeWidth="2"
            strokeLinecap="round"
          />
        ) : null}
        {dropGuideRect ? (
          <line
            x1={dropGuideRect.x}
            y1={dropGuideRect.y}
            x2={dropGuideRect.x}
            y2={dropGuideRect.y + dropGuideRect.height}
            stroke="rgba(37,99,235,0.92)"
            strokeWidth="3"
            strokeLinecap="round"
          />
        ) : null}
      </svg>

      {dropTarget ? (
        <TopBarGuideLabel
          rect={createTopBarRect(dropTarget.rect.x, Math.max(16, dropTarget.rect.y), 1, dropTarget.rect.height)}
          align={dropLabelAlign}
          className="!z-[60] !bg-[color:var(--blue-500)]"
        >
          x {Math.round(dropTarget.xPx)} px · {dropAdjustmentLabel}
          {dropTarget.constrained ? ' · omejeno' : ''}
        </TopBarGuideLabel>
      ) : null}

      {showContainerGuide ? (
        <>
          <TopBarGuideLabel
            rect={settings.widthMode === 'custom' ? selectedWidthGuide.containerRect : selectedWidthGuide.contentRect}
            align={settings.widthMode === 'full' ? 'left' : 'center'}
            className="!bg-white !text-[color:var(--blue-500)] ring-1 ring-[color:var(--blue-500)]/20"
          >
            {activeEdit.kind === 'container-width' || activeEdit.kind === 'width-mode' ? selectedWidthGuide.label : 'Širina'}
          </TopBarGuideLabel>
        </>
      ) : null}
      {showHeightGuide ? (
        <TopBarGuideLabel rect={createTopBarRect(geometry.contentRect.x - 10, 0, 1, geometry.viewportRect.height)} align="left">
          Višina: {Math.round(geometry.viewportRect.height)} px
        </TopBarGuideLabel>
      ) : null}
      {showGutterGuide ? (
        <TopBarGuideLabel rect={geometry.marginGuideRects.left} align="left">
          {activeFieldName === 'siteGutterRangePx'
            ? 'Min in Max odmik'
            : activeFieldName === 'siteGutterMinPx'
              ? 'Min odmik'
              : 'Max odmik'}
        </TopBarGuideLabel>
      ) : null}
      {showColumnGapGuide
        ? columnGapRects.map((rect, index) => (
            <TopBarGuideLabel key={`column-gap-label-${index}`} rect={labelRectForGuide(rect)}>
              L|S|D: {settings.columnGapPx} px
            </TopBarGuideLabel>
          ))
        : null}
      {showItemGapGuide
        ? itemGapRects.slice(0, 4).map(({ rect, zone }, index) => (
            <TopBarGuideLabel
              key={`item-gap-label-${zone}-${index}`}
              rect={labelRectForGuide(rect)}
              className={zone === itemGapZone ? '' : '!bg-white !text-[color:var(--blue-500)] ring-1 ring-[color:var(--blue-500)]/20'}
            >
              E1|E2: {settings.itemGapPx} px
            </TopBarGuideLabel>
          ))
        : null}
      {activeZoneGuide ? (
        <TopBarGuideLabel rect={getTopBarZoneRect(geometry, activeZoneGuide)}>
          {topBarZoneLabels[activeZoneGuide]}
        </TopBarGuideLabel>
      ) : null}

      {ghostWidthMode && ghostWidthMode !== settings.widthMode ? (
        <span
          className="absolute z-[30] rounded-md border border-dashed border-[color:var(--blue-500)]/30 bg-[color:var(--blue-50)]/5"
          style={topBarRectStyle(
            ghostWidthMode === 'custom'
              ? geometry.widthModeGuideRects[ghostWidthMode].containerRect
              : geometry.widthModeGuideRects[ghostWidthMode].contentRect
          )}
        />
      ) : null}

      {showMargins ? (
        <>
          <span
            className="absolute z-[32] border-x border-dashed border-[color:var(--blue-500)]/45 bg-[color:var(--blue-50)]/20"
            style={topBarRectStyle(geometry.marginGuideRects.left)}
          />
          <span
            className="absolute z-[32] border-x border-dashed border-[color:var(--blue-500)]/45 bg-[color:var(--blue-50)]/20"
            style={topBarRectStyle(geometry.marginGuideRects.right)}
          />
          <TopBarGuideLabel rect={geometry.marginGuideRects.left} align="left" className="!bg-white !text-[color:var(--blue-500)] ring-1 ring-[color:var(--blue-500)]/25">
            Min. / maks. rob strani
          </TopBarGuideLabel>
        </>
      ) : null}

      {showZones ? (
        (Object.keys(topBarZoneLabels) as TopBarZone[]).map((zone) => {
          const zoneRect = getTopBarZoneRect(geometry, zone);
          const highlighted = zone === activeZone && hasActiveEdit;
          const showZoneLabel = highlighted || isAdvancedMode;

          return (
            <span
              key={zone}
              className={`${showZoneLabel ? 'absolute z-[35] rounded bg-white/85 px-1.5 py-0.5 text-[10px] font-semibold uppercase leading-none shadow-sm ring-1 ring-slate-200' : 'sr-only'} ${
                highlighted ? 'text-[color:var(--blue-500)]' : 'text-slate-500'
              }`}
              style={{ left: zoneRect.x + 6, top: zoneRect.y + 8 }}
            >
              {topBarZoneLabels[zone]}
            </span>
          );
        })
      ) : null}

      {showZones ? (
        <span
          className="absolute bottom-0 top-0 z-[36] w-px bg-slate-300/45"
          style={{ left: geometry.contentRect.x + geometry.contentRect.width / 2 }}
        />
      ) : null}

      {showOrderMarkers
        ? (Object.keys(topBarZoneLabels) as TopBarZone[]).flatMap((zone) =>
            geometry.zoneOrderIds[zone].map((elementId, index) => {
              const rect = geometry.elementRects[elementId];
              if (!rect) return null;

              return (
                <span
                  key={`${zone}-${elementId}-order`}
                  className={`absolute z-[46] grid h-5 w-5 place-items-center rounded-full border text-[10px] font-bold leading-none ${
                    elementId === activeElementId
                      ? 'border-[color:var(--blue-500)] bg-[color:var(--blue-500)] text-white'
                      : 'border-[color:var(--blue-500)]/35 bg-white text-[color:var(--blue-500)]'
                  }`}
                  style={{ left: rect.x + 2, top: rect.y - 8 }}
                >
                  {index + 1}
                </span>
              );
            })
          )
        : null}

      {activeWidthRect && activeWidthItem && (activeEdit.kind === 'element-width' || dragState?.type === 'width') ? (
        <>
          <span
            className={`absolute z-[45] h-0.5 ${deriveTopBarElementWidthMode(activeWidthItem, device, settings) === 'fixed' ? 'bg-[color:var(--blue-500)]' : 'bg-[color:var(--blue-500)]/45'}`}
            style={{
              left: activeWidthRect.x,
              top: activeWidthRect.y + 3,
              width: activeWidthRect.width
            }}
          />
          <TopBarGuideLabel rect={activeWidthRect}>
            {deriveTopBarElementWidthMode(activeWidthItem, device, settings) === 'fixed'
              ? `${Math.round(activeWidthRect.width * labelScale)}px`
              : `${Math.round(activeWidthRect.width * labelScale)}px`}
          </TopBarGuideLabel>
        </>
      ) : null}

      {(() => {
        const elementId = resizeHandleElementId;
        const item = layoutItems.find((currentItem) => currentItem.id === elementId);
        const rect = geometry.widthRects[elementId];
        if (!item || !rect || item.id === 'search' && item.slot !== 'menu') return null;
        const active = activeEdit.kind === 'element-width' && activeEdit.elementId === elementId || dragState?.type === 'width' && dragState.elementId === elementId;

        return (
          <Fragment key={`${elementId}-resize-handles`}>
            <button
              type="button"
              aria-label={`Zmanjšaj ali povečaj širino ${topBarLayoutLabels[elementId]} z leve`}
              className={`pointer-events-auto absolute z-[56] h-6 w-2 -translate-x-1/2 cursor-ew-resize rounded-full border border-[color:var(--blue-500)] bg-[color:var(--blue-500)]/88 shadow-[0_0_0_1px_rgba(255,255,255,0.78),0_0_0_3px_color-mix(in_srgb,var(--blue-500)_20%,transparent)] transition hover:bg-[color:var(--blue-500)]/95 ${
                active
                  ? 'scale-105 bg-[color:var(--blue-500)]'
                  : 'hover:scale-105'
              }`}
              style={{ left: rect.x, top: rect.y + rect.height / 2 - 12 }}
              onPointerDown={(event) => onStartWidthDrag(elementId, 'left', event)}
            />
            <button
              type="button"
              aria-label={`Zmanjšaj ali povečaj širino ${topBarLayoutLabels[elementId]} z desne`}
              className={`pointer-events-auto absolute z-[56] h-6 w-2 -translate-x-1/2 cursor-ew-resize rounded-full border border-[color:var(--blue-500)] bg-[color:var(--blue-500)]/88 shadow-[0_0_0_1px_rgba(255,255,255,0.78),0_0_0_3px_color-mix(in_srgb,var(--blue-500)_20%,transparent)] transition hover:bg-[color:var(--blue-500)]/95 ${
                active
                  ? 'scale-105 bg-[color:var(--blue-500)]'
                  : 'hover:scale-105'
              }`}
              style={{ left: getTopBarRectRight(rect), top: rect.y + rect.height / 2 - 12 }}
              onPointerDown={(event) => onStartWidthDrag(elementId, 'right', event)}
            />
          </Fragment>
        );
      })()}
    </div>
  );
}

function TopBarResponsivePreview({
  device,
  logoDisplaySize,
  navigation,
  siteLayout,
  settings,
  layoutItems,
  items,
  selectedElementId,
  activeEdit,
  showOverlay,
  showHeaderPreview,
  onToggleOverlay,
  onHeaderPreviewChange,
  onSelectElement,
  onSetActiveEdit,
  onClearActiveEditSoon,
  onUpdateItem,
  onMoveElement
}: {
  device: SiteNavigationTopBarDevice;
  logoDisplaySize?: SiteLogoDisplaySize | null;
  navigation: SiteNavigationConfig;
  siteLayout: SiteNavigationSiteLayoutSettings;
  settings: SiteNavigationTopBarResponsiveSettings;
  layoutItems: SiteNavigationTopBarResponsiveItem[];
  items: SiteNavigationTopLevelItem[];
  selectedElementId: SiteNavigationTopBarElementId;
  activeEdit: TopBarActiveEdit;
  showOverlay: boolean;
  showHeaderPreview: boolean;
  onToggleOverlay: () => void;
  onHeaderPreviewChange: (checked: boolean) => void;
  onSelectElement: (elementId: SiteNavigationTopBarElementId) => void;
  onSetActiveEdit: (edit: TopBarActiveEdit) => void;
  onClearActiveEditSoon: () => void;
  onUpdateItem: (elementId: SiteNavigationTopBarElementId, updates: Partial<SiteNavigationTopBarResponsiveItem>) => void;
  onMoveElement: (elementId: SiteNavigationTopBarElementId, xPx: number, xRatio: number) => void;
}) {
  const [measureRef, availableWidth] = useMeasuredElementWidth<HTMLDivElement>();
  const frameRef = useRef<HTMLDivElement | null>(null);
  const [observedScale, setObservedScale] = useState<number | null>(null);
  const [dropTarget, setDropTarget] = useState<TopBarDropTarget | null>(null);
  const dropTargetRef = useRef<TopBarDropTarget | null>(null);
  const [dragState, setDragState] = useState<
    | {
        type: 'element';
        elementId: SiteNavigationTopBarElementId;
        grabOffsetX: number;
        grabOffsetY: number;
        pointerX: number;
        pointerY: number;
        startXPx: number;
        width: number;
        height: number;
      }
    | { type: 'width'; elementId: SiteNavigationTopBarElementId; edge: 'left' | 'right'; startClientX: number; startWidth: number; minWidth: number }
    | null
  >(null);
  const viewportWidth = getTopBarPreviewViewportWidth(device, settings, siteLayout);
  const viewportHeight = getTopBarRenderedViewportHeight(settings);
  const storefrontPreviewScale = COMMERCIAL_STOREFRONT_SCALE;
  const rendererViewportWidth = viewportWidth / storefrontPreviewScale;
  const rendererViewportHeight = viewportHeight;
  const renderedViewportHeight = rendererViewportHeight * storefrontPreviewScale;
  const rulerLeftGutter = topBarPreviewRulerLeftGutterPx;
  const rulerRightGutter = topBarPreviewRulerRightGutterPx;
  const rulerTopGutter = topBarPreviewRulerTopGutterPx;
  const previewLogicalWidth = viewportWidth + rulerLeftGutter + rulerRightGutter;
  const rendererSiteLayout = useMemo(() => getTopBarStorefrontGeometrySiteLayout(siteLayout), [siteLayout]);
  const rendererSettings = useMemo(() => getTopBarStorefrontGeometrySettings(settings), [settings]);
  const measuredScale = getPreviewScale(availableWidth, previewLogicalWidth, renderedViewportHeight);
  const previewMeasured = availableWidth > 0 || observedScale !== null;
  const scale = availableWidth > 0 ? measuredScale : observedScale ?? measuredScale;
  const scaledRulerTopGutter = previewMeasured && scale > 0 ? rulerTopGutter / scale : rulerTopGutter;
  const previewLogicalHeight = renderedViewportHeight + scaledRulerTopGutter;
  const combinedRendererScale = scale * storefrontPreviewScale;
  const heightFitScale = renderedViewportHeight > 0
    ? topBarTechnicalPreviewVisualTopbarHeightPx / renderedViewportHeight
    : 1;
  const cssScaleExpression = `min(${heightFitScale.toFixed(4)}, calc(100cqw / ${previewLogicalWidth}px))`;
  const deviceLabel = topBarDeviceLabels[device];
  const scaleNumberLabel = scale === 1 ? '1' : scale.toFixed(2).replace('.', ',');
  const zoomLabel = previewMeasured ? `${scaleNumberLabel}x zoom` : 'prilagajanje širini';
  const geometry = useMemo(
    () =>
      calculateTopBarGeometry({
        viewportWidth: rendererViewportWidth,
        viewportHeight: rendererViewportHeight,
        siteLayout: rendererSiteLayout,
        settings: rendererSettings,
        layoutItems,
        items,
        device,
        logoDisplaySize,
        labelScale: storefrontPreviewScale,
        coordinateScale: storefrontPreviewScale
      }),
    [device, items, layoutItems, logoDisplaySize, rendererSettings, rendererSiteLayout, rendererViewportHeight, rendererViewportWidth, storefrontPreviewScale]
  );
  const geometryRef = useRef(geometry);
  const combinedRendererScaleRef = useRef(combinedRendererScale);
  const dragStateForOverlay: TopBarViewportDragState = dragState
    ? dragState.type === 'element'
      ? { type: 'element', elementId: dragState.elementId }
      : { type: 'width', elementId: dragState.elementId, edge: dragState.edge }
    : null;
  const isDraggingLogo = dragState?.type === 'element' && dragState.elementId === 'logo';
  const activeGuide = getTopBarGuideFromActiveEdit(activeEdit);
  const overflowStatus = useMemo(
    () => computeOverflowStatus({ geometry, settings }),
    [geometry, settings]
  );
  const overflowStatusClassName = overflowStatus.tone === 'warning'
    ? 'bg-amber-50 text-amber-700 ring-1 ring-amber-200'
    : overflowStatus.tone === 'info'
      ? 'bg-sky-50 text-sky-700 ring-1 ring-sky-100'
      : 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100';

  useEffect(() => {
    geometryRef.current = geometry;
  }, [geometry]);

  useEffect(() => {
    combinedRendererScaleRef.current = combinedRendererScale;
  }, [combinedRendererScale]);

  useLayoutEffect(() => {
    if (availableWidth > 0) {
      setObservedScale(null);
      return undefined;
    }

    const frame = frameRef.current;
    if (!frame) return undefined;

    const updateObservedScale = () => {
      const rect = frame.getBoundingClientRect();
      if (rect.width <= 0 || viewportWidth <= 0) return;
      const nextScale = getPreviewScale(rect.width, previewLogicalWidth, renderedViewportHeight);
      setObservedScale((current) => (current !== null && Math.abs(current - nextScale) < 0.002 ? current : nextScale));
    };

    updateObservedScale();
    const animationFrame = window.requestAnimationFrame(updateObservedScale);
    window.addEventListener('resize', updateObservedScale);

    const resizeTarget = frame.parentElement ?? frame;
    const resizeObserver =
      typeof ResizeObserver !== 'undefined' ? new ResizeObserver(updateObservedScale) : null;
    resizeObserver?.observe(resizeTarget);

    return () => {
      window.cancelAnimationFrame(animationFrame);
      window.removeEventListener('resize', updateObservedScale);
      resizeObserver?.disconnect();
    };
  }, [availableWidth, previewLogicalWidth, renderedViewportHeight, viewportWidth]);

  const getViewportPoint = useCallback((event: PointerEvent | ReactPointerEvent<HTMLElement>) => {
    const frame = frameRef.current;
    if (!frame) return { x: 0, y: 0 };
    const rect = frame.getBoundingClientRect();
    const currentScale = combinedRendererScaleRef.current || 1;

    return {
      x: (event.clientX - rect.left) / currentScale,
      y: (event.clientY - rect.top) / currentScale
    };
  }, []);

  const getResolvedDropTargetForPoint = useCallback((
    state: Extract<NonNullable<typeof dragState>, { type: 'element' }>,
    point: { x: number; y: number }
  ) => {
    const geometrySnapshot = geometryRef.current;

    return getTopBarDropTarget({
      geometry: geometrySnapshot,
      x: point.x,
      y: point.y,
      startXPx: state.startXPx,
      grabOffsetX: state.grabOffsetX,
      width: state.width,
      height: state.height,
      coordinateScale: storefrontPreviewScale
    });
  }, [storefrontPreviewScale]);

  useEffect(() => {
    if (!dragState) return undefined;

    const handlePointerMove = (event: PointerEvent) => {
      event.preventDefault();

      if (dragState.type === 'element') {
        const { x, y } = getViewportPoint(event);
        const nextDropTarget = getResolvedDropTargetForPoint(dragState, { x, y });

        setDragState((current) =>
          current?.type === 'element' && current.elementId === dragState.elementId
            ? { ...current, pointerX: x, pointerY: y }
            : current
        );
        dropTargetRef.current = nextDropTarget;
        setDropTarget(nextDropTarget);
        onSetActiveEdit({ kind: 'position', elementId: dragState.elementId, fieldName: 'drag' });
        return;
      }

      const delta = (event.clientX - dragState.startClientX) / (combinedRendererScaleRef.current || 1) * storefrontPreviewScale;

      const signedDelta = dragState.edge === 'right' ? delta : -delta;
      const nextWidth = Math.round(clampTopBarNumber(dragState.startWidth + signedDelta, dragState.minWidth, 1200));
      onUpdateItem(dragState.elementId, { fixedWidthPx: nextWidth, widthMode: 'fixed', widthPx: nextWidth });
      onSetActiveEdit({ kind: 'element-width', elementId: dragState.elementId, fieldName: 'width' });
    };

    const handlePointerUp = (event: PointerEvent) => {
      if (dragState.type === 'element') {
        const target = dropTargetRef.current;
        if (target) {
          onMoveElement(dragState.elementId, target.xPx, target.xRatio);
        }
      }

      setDragState(null);
      setDropTarget(null);
      dropTargetRef.current = null;
      onClearActiveEditSoon();
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp, { once: true });

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, [dragState, getResolvedDropTargetForPoint, getViewportPoint, onClearActiveEditSoon, onMoveElement, onSetActiveEdit, onUpdateItem, storefrontPreviewScale]);

  const startElementDrag = (elementId: SiteNavigationTopBarElementId, event: ReactPointerEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    const rect = geometry.elementRects[elementId];
    if (!rect) return;
    const point = getViewportPoint(event);
    onSelectElement(elementId);
    onSetActiveEdit({ kind: 'position', elementId, fieldName: 'drag' });
    const initialState = {
      type: 'element' as const,
      elementId,
      grabOffsetX: point.x - rect.x,
      grabOffsetY: point.y - rect.y,
      pointerX: point.x,
      pointerY: point.y,
      startXPx: Math.round((rect.x - geometry.contentRect.x) * storefrontPreviewScale),
      width: rect.width,
      height: rect.height
    };
    const initialTarget = getResolvedDropTargetForPoint(initialState, point);
    dropTargetRef.current = initialTarget;
    setDropTarget(initialTarget);
    setDragState(initialState);
  };

  const startWidthDrag = (elementId: SiteNavigationTopBarElementId, edge: 'left' | 'right', event: ReactPointerEvent<HTMLButtonElement>) => {
    const item = layoutItems.find((currentItem) => currentItem.id === elementId);
    const rect = geometry.widthRects[elementId];
    if (!item || !rect) return;
    if (item.id === 'search' && item.slot !== 'menu') return;
    const minimumFixedWidth = item.id === 'logo'
      ? SITE_NAVIGATION_TOP_BAR_LOGO_WIDTH_PX
      : 0;

    event.preventDefault();
    event.stopPropagation();
    onSelectElement(elementId);
    onSetActiveEdit({ kind: 'element-width', elementId, fieldName: 'width' });
    setDragState({
      type: 'width',
      elementId,
      edge,
      startClientX: event.clientX,
      startWidth: getTopBarElementComputedWidth({ item, items, device, settings }),
      minWidth: minimumFixedWidth
    });
  };

  return (
    <div className="min-w-0">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-[11px] font-medium text-slate-500">
        <span className="inline-flex min-w-0 flex-wrap items-center gap-1.5">
          <span>{deviceLabel} · viewport: {viewportWidth} px · {zoomLabel} | </span>
          <button
            type="button"
            className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 font-medium transition ${adminControlFocusTokenClasses} ${
              showOverlay ? 'text-[color:var(--blue-500)]' : 'text-slate-500 hover:text-[color:var(--blue-500)]'
            }`}
            onClick={onToggleOverlay}
          >
            <GridGlyph />
            Mreža
          </button>
          <span className="text-slate-300" aria-hidden="true">|</span>
          <TopBarToggle
            label="Predogled"
            checked={showHeaderPreview}
            onChange={onHeaderPreviewChange}
            frameless
            compact
          />
        </span>
        <span className={`rounded-full px-2 py-1 leading-none ${overflowStatusClassName}`}>{overflowStatus.label}</span>
      </div>
      {overflowStatus.detail ? (
        <p className="mb-2 text-[11px] leading-4 text-amber-700">
          {overflowStatus.detail}
        </p>
      ) : null}
      <div
        ref={measureRef}
        className="relative flex min-w-0 justify-center overflow-hidden"
        style={{
          containerType: 'inline-size',
          height: Math.max(
            topBarTechnicalPreviewSlotHeightPx,
            previewMeasured ? Math.ceil(previewLogicalHeight * scale) : topBarTechnicalPreviewSlotHeightPx
          )
        }}
      >
        <div
          className="relative overflow-hidden rounded-[10px] bg-white"
          style={{
            height: previewMeasured ? Math.ceil(previewLogicalHeight * scale) : `calc(${previewLogicalHeight}px * ${cssScaleExpression})`,
            width: previewMeasured ? Math.ceil(previewLogicalWidth * scale) : `calc(${previewLogicalWidth}px * ${cssScaleExpression})`
          }}
        >
          <div
            className="absolute left-0 top-0 overflow-visible bg-white"
            style={{
              width: previewLogicalWidth,
              height: previewLogicalHeight,
              transform: previewMeasured ? `scale(${scale})` : `scale(${cssScaleExpression})`,
              transformOrigin: 'top left'
            }}
          >
            {showOverlay ? (
              <TopBarPreviewRulerOverlay
                viewportWidth={viewportWidth}
                viewportHeight={renderedViewportHeight}
                heightValue={rendererViewportHeight}
                viewportX={rulerLeftGutter}
                viewportY={scaledRulerTopGutter}
              />
            ) : null}
            <div
              ref={frameRef}
              className="absolute box-border overflow-visible rounded-[10px] bg-white"
              style={{
                left: rulerLeftGutter,
                top: scaledRulerTopGutter,
                width: viewportWidth,
                height: renderedViewportHeight
              }}
            >
              <div
                data-technical-topbar-renderer="true"
                className="absolute left-0 top-0 overflow-visible"
                style={{
                  width: rendererViewportWidth,
                  height: rendererViewportHeight,
                  transform: `scale(${storefrontPreviewScale})`,
                  transformOrigin: 'top left'
                }}
              >
                <div
                  className={`absolute inset-0 z-10 overflow-visible ${
                    isDraggingLogo ? '[&_a[data-navbar-left]]:invisible' : ''
                  }`}
                >
                  <SiteHeader
                    navigation={navigation}
                    previewMode="inline"
                    previewDevice={device}
                    previewViewportWidth={rendererViewportWidth}
                  />
                </div>
                {(layoutItems.filter((item) => isTopBarPlacementItemRendered(item, device, settings)) as SiteNavigationTopBarResponsiveItem[]).map((item) => {
                  const rect = geometry.elementRects[item.id];
                  if (!rect) return null;
                  const dragging = dragState?.type === 'element' && dragState.elementId === item.id;

                  return (
                    <button
                      key={item.id}
                      type="button"
                      className={`absolute z-[90] inline-flex cursor-grab items-center justify-center overflow-hidden rounded-lg border border-transparent bg-transparent transition active:cursor-grabbing ${adminControlFocusTokenClasses}`}
                      style={{ ...topBarRectStyle(rect), zIndex: 90 + item.zIndex }}
                      onClick={() => {
                        onSelectElement(item.id);
                        onSetActiveEdit({ kind: 'position', elementId: item.id, fieldName: 'element' });
                        onClearActiveEditSoon();
                      }}
                      onPointerDown={(event) => startElementDrag(item.id, event)}
                    >
                      {dragging ? <span className="pointer-events-none h-full w-full rounded-lg border border-dashed border-[color:var(--blue-500)]/35" /> : null}
                    </button>
                  );
                })}
                {dragState?.type === 'element' ? (
                  <div
                    className="pointer-events-none absolute z-[120] inline-flex items-center justify-center overflow-hidden rounded-lg border border-[color:var(--blue-500)] bg-white/95 px-1 text-slate-900 shadow-lg"
                    style={{
                      left: dragState.pointerX - dragState.grabOffsetX,
                      top: dragState.pointerY - dragState.grabOffsetY,
                      width: dragState.width,
                      height: dragState.height
                    }}
                  >
                    <AdminTopBarElementPreview
                      id={dragState.elementId}
                      items={items}
                      highlighted
                      device={device}
                      logoDisplaySize={logoDisplaySize}
                      settings={settings}
                    />
                  </div>
                ) : null}
                <TopBarGeometryOverlay
                  geometry={geometry}
                  device={device}
                  settings={settings}
                  layoutItems={layoutItems}
                  activeEdit={activeEdit}
                  activeGuide={activeGuide}
                  selectedElementId={selectedElementId}
                  dragState={dragStateForOverlay}
                  dropTarget={dropTarget}
                  showGrid={showOverlay}
                  labelScale={storefrontPreviewScale}
                  onStartWidthDrag={startWidthDrag}
                />
              </div>
              <span
                className="pointer-events-none absolute inset-0 z-[160] rounded-[10px] border border-slate-200"
                aria-hidden="true"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function TopBarElementRow({
  item,
  device,
  settings,
  items,
  logoDisplaySize,
  placementBoundsWidth,
  currentXPx,
  offsets,
  selected,
  checked,
  isLast,
  activeEdit,
  onSelect,
  onCheckedChange,
  onSetActiveEdit,
  onClearActiveEditSoon,
  onChange,
  onReset
}: {
  item: SiteNavigationTopBarResponsiveItem;
  device: SiteNavigationTopBarDevice;
  settings: SiteNavigationTopBarResponsiveSettings;
  items: SiteNavigationTopLevelItem[];
  logoDisplaySize?: SiteLogoDisplaySize | null;
  placementBoundsWidth: number;
  currentXPx: number;
  offsets: TopBarTableOffsets;
  selected: boolean;
  checked: boolean;
  isLast: boolean;
  activeEdit: TopBarActiveEdit;
  onSelect: () => void;
  onCheckedChange: (checked: boolean) => void;
  onSetActiveEdit: (edit: TopBarActiveEdit) => void;
  onClearActiveEditSoon: () => void;
  onChange: (updates: Partial<SiteNavigationTopBarResponsiveItem>) => void;
  onReset: () => void;
}) {
  const resolvedWidth = getTopBarElementComputedWidth({ item, items, device, settings });
  const placementWidth = getTopBarElementRenderedPlacementWidth({
    item,
    items,
    device,
    settings,
    logoDisplaySize
  });
  const minimumFixedWidth = item.id === 'logo'
    ? SITE_NAVIGATION_TOP_BAR_LOGO_WIDTH_PX
    : item.id === 'search' && item.slot !== 'menu'
      ? SITE_NAVIGATION_TOP_BAR_SEARCH_COLLAPSED_WIDTH_PX
      : 0;
  const searchWidthLocked = item.id === 'search' && item.slot !== 'menu';
  const rowGridClassName = topBarElementRowGridClassName;
  const rowMinWidthClassName = topBarElementRowMinWidthClassName;
  const rowActive = selected || activeEdit.elementId === item.id;
  const xActive = activeEdit.elementId === item.id && activeEdit.kind === 'position';
  const widthActive = activeEdit.elementId === item.id && activeEdit.kind === 'element-width' && activeEdit.fieldName !== 'widthMode';
  const leftOffsetActive = activeEdit.elementId === item.id && activeEdit.kind === 'gap-before';
  const rightOffsetActive = activeEdit.elementId === item.id && activeEdit.kind === 'gap-after';
  const maxXPx = Math.max(0, Math.round(placementBoundsWidth - placementWidth));
  const rangeEndXPx = Math.round(currentXPx + resolvedWidth);
  const offsetMinPx = -placementBoundsWidth;
  const offsetMaxPx = placementBoundsWidth;

  const activateEdit = (edit: TopBarActiveEdit) => {
    onSelect();
    onSetActiveEdit(edit);
  };
  const activateTargetField = (target: EventTarget | null) => {
    if (!(target instanceof HTMLElement)) return;

    const ariaLabel = target.getAttribute('aria-label') ?? '';
    if (!ariaLabel.includes(topBarLayoutLabels[item.id])) return;

    if (ariaLabel.startsWith('X za')) {
      activateEdit({ kind: 'position', elementId: item.id, fieldName: 'x' });
    } else if (ariaLabel.startsWith('Širina za')) {
      activateEdit({ kind: 'element-width', elementId: item.id, fieldName: 'width' });
    } else if (ariaLabel.startsWith('Levi odmik za')) {
      activateEdit({ kind: 'gap-before', elementId: item.id, fieldName: 'left' });
    } else if (ariaLabel.startsWith('Desni odmik za')) {
      activateEdit({ kind: 'gap-after', elementId: item.id, fieldName: 'right' });
    }
  };
  const moveElementToXPx = (nextXPx: number) => {
    const clampedXPx = Math.round(clampTopBarNumber(nextXPx, 0, maxXPx));
    onChange({
      xPx: clampedXPx,
      xRatio: placementBoundsWidth > 0 ? clampedXPx / placementBoundsWidth : 0,
      region:
        item.id === 'cart' || item.region === 'edgeRight'
          ? Math.abs(clampedXPx - maxXPx) <= 1
            ? 'edgeRight'
            : 'right'
          : item.region
    });
  };
  const changeOffset = (side: 'left' | 'right', value: number) => {
    const roundedValue = Math.round(value);
    if (side === 'left') {
      if (!offsets.hasLeftNeighbor || offsets.previousRightPx === null) return;
      activateEdit({ kind: 'gap-before', elementId: item.id, fieldName: 'left' });
      moveElementToXPx(offsets.previousRightPx + roundedValue);
      return;
    }

    if (!offsets.hasRightNeighbor || offsets.nextLeftPx === null) return;
    activateEdit({ kind: 'gap-after', elementId: item.id, fieldName: 'right' });
    moveElementToXPx(offsets.nextLeftPx - placementWidth - roundedValue);
  };

  const visibilityButton = (
    <button
      type="button"
      aria-label={item.visible ? `Skrij ${topBarLayoutLabels[item.id]}` : `Prikaži ${topBarLayoutLabels[item.id]}`}
      className={`${adminMiniIconButtonTokenClasses} ${item.visible ? '' : '!text-slate-400'}`}
      onClick={(event) => {
        event.stopPropagation();
        onChange({ visible: !item.visible });
      }}
    >
      <EyeGlyph visible={item.visible} className="h-4 w-4" />
    </button>
  );
  const menuControl = (
    <div onClick={(event) => event.stopPropagation()}>
      <RowActionsDropdown
        label={`Možnosti za ${topBarLayoutLabels[item.id]}`}
        items={[
          {
            key: 'reset',
            label: 'Ponastavi',
            onSelect: onReset,
            className: adminActionMenuItemTokenClasses.base
          }
        ]}
        menuWidth={160}
        menuZIndex={2147483647}
        menuTestId={`top-bar-element-menu-${item.id}`}
        menuClassName="!w-40"
        triggerClassName={`${adminMiniIconButtonTokenClasses} !h-6 !w-6`}
      />
    </div>
  );

  return (
    <div
      role="button"
      tabIndex={0}
      className={`group grid ${rowMinWidthClassName} ${rowGridClassName} items-center gap-3 px-3 py-2 text-left text-[13px] transition focus:outline-none focus:ring-0 focus-visible:outline-none focus-visible:ring-0 ${isLast ? 'rounded-b-xl' : 'border-b border-slate-100'} ${
        rowActive ? navEditorRowHoverClassName : 'bg-white hover:bg-slate-50'
      } ${item.visible ? '' : 'text-slate-400'}`}
      onClick={onSelect}
      onFocusCapture={(event) => activateTargetField(event.target)}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onSelect();
        }
      }}
      onPointerDownCapture={(event) => activateTargetField(event.target)}
    >
      <span className="flex items-center justify-center">
        <input
          type="checkbox"
          checked={checked}
          aria-label={`Izberi ${topBarLayoutLabels[item.id]}`}
          className="h-4 w-4 rounded border-slate-300 text-[color:var(--blue-500)] focus:ring-[color:var(--blue-500)]"
          onClick={(event) => event.stopPropagation()}
          onChange={(event) => {
            event.stopPropagation();
            onCheckedChange(event.target.checked);
          }}
        />
      </span>
      <span className="inline-flex min-w-0 items-center gap-2">
        <AdminTopBarElementBadge id={item.id} selected={rowActive} />
        <span className="min-w-0">
          <span className={`block truncate font-semibold ${item.visible ? 'text-slate-900' : 'text-slate-400'}`}>{topBarLayoutLabels[item.id]}</span>
        </span>
      </span>
      <TopBarUnitRangeInput
        startValue={Math.round(currentXPx)}
        endValue={rangeEndXPx}
        min={0}
        max={maxXPx}
        className="w-[128px]"
        ariaLabel={`X za ${topBarLayoutLabels[item.id]}`}
        stopPropagation
        active={xActive}
        onBlur={onClearActiveEditSoon}
        onFocus={() => activateEdit({ kind: 'position', elementId: item.id, fieldName: 'x' })}
        onMouseEnter={() => activateEdit({ kind: 'position', elementId: item.id, fieldName: 'x' })}
        onMouseLeave={onClearActiveEditSoon}
        onChange={(startXPx) => {
          activateEdit({ kind: 'position', elementId: item.id, fieldName: 'x' });
          moveElementToXPx(startXPx);
        }}
      />
      <TopBarUnitNumberInput
        value={resolvedWidth}
        min={minimumFixedWidth}
        max={1200}
        className="w-[84px]"
        inputClassName="w-10"
        ariaLabel={`Širina za ${topBarLayoutLabels[item.id]}`}
        disabled={searchWidthLocked}
        stopPropagation
        active={widthActive && !searchWidthLocked}
        onBlur={onClearActiveEditSoon}
        onFocus={searchWidthLocked ? undefined : () => activateEdit({ kind: 'element-width', elementId: item.id, fieldName: 'width' })}
        onMouseEnter={searchWidthLocked ? undefined : () => activateEdit({ kind: 'element-width', elementId: item.id, fieldName: 'width' })}
        onMouseLeave={onClearActiveEditSoon}
        onChange={(fixedWidthPx) => {
          activateEdit({ kind: 'element-width', elementId: item.id, fieldName: 'width' });
          onChange({ fixedWidthPx, widthMode: 'fixed', widthPx: fixedWidthPx });
        }}
      />
      {offsets.rendered ? (
        <TopBarOffsetPairInput
          leftValue={offsets.leftValue}
          rightValue={offsets.rightValue}
          min={offsetMinPx}
          max={offsetMaxPx}
          className="w-[128px] justify-self-center"
          leftAriaLabel={`Levi odmik za ${topBarLayoutLabels[item.id]}`}
          rightAriaLabel={`Desni odmik za ${topBarLayoutLabels[item.id]}`}
          stopPropagation
          leftActive={leftOffsetActive}
          rightActive={rightOffsetActive}
          leftDisabled={!offsets.hasLeftNeighbor}
          rightDisabled={!offsets.hasRightNeighbor}
          onBlur={onClearActiveEditSoon}
          onLeftFocus={offsets.hasLeftNeighbor ? () => activateEdit({ kind: 'gap-before', elementId: item.id, fieldName: 'left' }) : undefined}
          onRightFocus={offsets.hasRightNeighbor ? () => activateEdit({ kind: 'gap-after', elementId: item.id, fieldName: 'right' }) : undefined}
          onLeftMouseEnter={offsets.hasLeftNeighbor ? () => activateEdit({ kind: 'gap-before', elementId: item.id, fieldName: 'left' }) : undefined}
          onRightMouseEnter={offsets.hasRightNeighbor ? () => activateEdit({ kind: 'gap-after', elementId: item.id, fieldName: 'right' }) : undefined}
          onMouseLeave={onClearActiveEditSoon}
          onLeftChange={(value) => changeOffset('left', value)}
          onRightChange={(value) => changeOffset('right', value)}
        />
      ) : (
        <span
          className={`inline-flex min-w-0 items-center justify-center px-1 text-center text-[12px] font-medium tabular-nums ${
            item.visible ? 'text-slate-500' : 'text-slate-400'
          }`}
          aria-label={`Odmiki za ${topBarLayoutLabels[item.id]}`}
          title="Levi in desni odmik v px"
        >
          — | —
        </span>
      )}
      <div className="flex items-center justify-center">{visibilityButton}</div>
      <div className="flex items-center justify-center">{menuControl}</div>
    </div>
  );
}

function TopBarDeviceSettingsPanel({
  device,
  settings,
  onChange,
  scope = 'extras'
}: {
  device: SiteNavigationTopBarDevice;
  settings: SiteNavigationTopBarResponsiveSettings;
  onChange: (updates: Partial<SiteNavigationTopBarResponsiveSettings>) => void;
  scope?: 'navigation' | 'extras';
}) {
  const updateNumber = (key: keyof SiteNavigationTopBarResponsiveSettings) => (value: number) => onChange({ [key]: value });

  if (device === 'tablet' && scope === 'navigation') {
    return (
      <div
        className={`grid h-7 min-w-0 items-center gap-1.5 ${
          settings.navigationMode === 'condensed'
            ? 'grid-cols-[72px_minmax(0,1fr)_52px]'
            : 'grid-cols-[72px_minmax(0,1fr)]'
        }`}
        data-testid="top-bar-tablet-navigation-settings"
      >
        <TopBarHelpLabel help={topBarHelpCopy.tabletNavigation} align="right" className="text-[11px] font-semibold leading-none text-slate-600">
          Navigacija
        </TopBarHelpLabel>
        <TopBarSegmentedControl<SiteNavigationTopBarNavigationMode>
          value={settings.navigationMode ?? 'condensed'}
          compact
          options={[
            { value: 'full', label: 'Polna' },
            { value: 'condensed', label: 'Strnjena' },
            { value: 'hamburger', label: 'Meni' }
          ]}
          onChange={(navigationMode) => onChange({ navigationMode })}
        />
        {settings.navigationMode === 'condensed' ? (
          <span title={topBarHelpCopy.maxVisibleLinks}>
            <TopBarUnitNumberInput
              value={settings.maxVisibleLinks ?? 3}
              min={1}
              max={8}
              suffix=""
              className="w-[52px]"
              inputClassName="w-full px-1.5"
              ariaLabel="Št. povezav"
              onChange={updateNumber('maxVisibleLinks')}
            />
          </span>
        ) : null}
      </div>
    );
  }

  if (device === 'mobile' && scope === 'navigation') {
    return (
      <div
        className="grid h-7 min-w-0 grid-cols-[72px_minmax(0,1fr)] items-center gap-1.5"
        data-testid="top-bar-mobile-navigation-settings"
      >
        <TopBarHelpLabel help={topBarHelpCopy.mobileNavigation} align="right" className="text-[11px] font-semibold leading-none text-slate-600">
          Navigacija
        </TopBarHelpLabel>
        <TopBarSegmentedControl<NonNullable<SiteNavigationTopBarResponsiveSettings['menuOpenMode']>>
          value={settings.menuOpenMode ?? 'drawer'}
          compact
          options={[{ value: 'drawer', label: 'Z leve' }, { value: 'fullscreen', label: 'Celozaslonsko' }]}
          onChange={(menuOpenMode) => onChange({ menuOpenMode })}
        />
      </div>
    );
  }

  return null;
}

function TopBarLayoutEditor({
  siteLayout,
  layout,
  initialLayout,
  items,
  footer,
  isSaving,
  onChange,
  onSiteLayoutChange,
  onSetInitialLayout
}: {
  siteLayout: SiteNavigationSiteLayoutSettings;
  layout: SiteNavigationTopBarLayout;
  initialLayout: SiteNavigationTopBarLayout;
  items: SiteNavigationTopLevelItem[];
  footer: HomepageFooterSettings;
  isSaving: boolean;
  onChange: (updater: (current: SiteNavigationTopBarLayout) => SiteNavigationTopBarLayout) => void;
  onSiteLayoutChange: (updates: Partial<SiteNavigationSiteLayoutSettings>) => void;
  onSetInitialLayout: (layout: SiteNavigationTopBarLayout) => void | Promise<void>;
}) {
  const siteLogoConfig = useSiteLogoConfig();
  const [showHeaderPreview, setShowHeaderPreview] = useState(false);
  const [showTechnicalOverlay, setShowTechnicalOverlay] = useState(false);
  const [device, setDevice] = useState<SiteNavigationTopBarDevice>('desktop');
  const [selectedElementId, setSelectedElementId] = useState<SiteNavigationTopBarElementId>('navigation');
  const [selectedTableElementIds, setSelectedTableElementIds] = useState<SiteNavigationTopBarElementId[]>([]);
  const [addElementMenuOpen, setAddElementMenuOpen] = useState(false);
  const [activeEdit, setActiveEditState] = useState<TopBarActiveEdit>({ kind: null });
  const activeEditFadeTimerRef = useRef<number | null>(null);
  const addElementMenuRef = useRef<HTMLDivElement | null>(null);
  const addElementMenuDismissRefs = useMemo(() => [addElementMenuRef], []);
  const deviceLayout = layout.responsive[device];
  const logoPurposeId = `header-${device}` as SiteLogoPurposeId;
  const logoDisplaySize = resolveSiteLogoDisplaySize(
    logoPurposeId,
    siteLogoConfig.placements[logoPurposeId]
  );
  const defaultDeviceLayout = initialLayout.responsive[device];
  const layoutItems = useMemo(() => sortedResponsiveItems(deviceLayout.items), [deviceLayout.items]);
  const layoutItemIdsKey = layoutItems.map((item) => item.id).join('|');
  const previewNavigation = useMemo<SiteNavigationConfig>(
    () => ({
      siteLayout,
      items,
      footer,
      topBarLayout: layout,
      topBarInitialLayout: initialLayout,
      updatedAt: null
    }),
    [footer, initialLayout, items, layout, siteLayout]
  );
  const selectedDevicePreviewWidth = getTopBarPreviewViewportWidth(device, deviceLayout.settings, siteLayout);
  const selectedRendererPreviewViewportWidth = selectedDevicePreviewWidth / COMMERCIAL_STOREFRONT_SCALE;

  useEffect(() => {
    window.dispatchEvent(
      new CustomEvent(adminSiteNavigationPreviewEventName, {
        detail: showHeaderPreview
          ? {
              enabled: true,
              navigation: previewNavigation,
              previewDevice: device,
              previewViewportWidth: selectedRendererPreviewViewportWidth,
            }
          : { enabled: false }
      })
    );
  }, [device, previewNavigation, selectedRendererPreviewViewportWidth, showHeaderPreview]);

  useEffect(() => {
    return () => {
      window.dispatchEvent(new CustomEvent(adminSiteNavigationPreviewEventName, { detail: { enabled: false } }));
    };
  }, []);

  useEffect(() => {
    return () => {
      if (activeEditFadeTimerRef.current !== null) {
        window.clearTimeout(activeEditFadeTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const currentIds = new Set(layoutItems.map((item) => item.id));

    setSelectedTableElementIds((current) => current.filter((id) => currentIds.has(id)));

    if (layoutItems.length > 0 && !currentIds.has(selectedElementId)) {
      setSelectedElementId(layoutItems[0].id);
    }
  }, [layoutItemIdsKey, layoutItems, selectedElementId]);

  useDropdownDismiss({ open: addElementMenuOpen, refs: addElementMenuDismissRefs, onClose: () => setAddElementMenuOpen(false) });

  const setActiveEdit = useCallback((edit: TopBarActiveEdit) => {
    if (activeEditFadeTimerRef.current !== null) {
      window.clearTimeout(activeEditFadeTimerRef.current);
      activeEditFadeTimerRef.current = null;
    }

    setActiveEditState(edit);
    if (edit.elementId) setSelectedElementId(edit.elementId);
  }, []);

  const clearActiveEditSoon = useCallback(() => {
    if (activeEditFadeTimerRef.current !== null) {
      window.clearTimeout(activeEditFadeTimerRef.current);
    }

    activeEditFadeTimerRef.current = window.setTimeout(() => {
      setActiveEditState({ kind: null });
      activeEditFadeTimerRef.current = null;
    }, 900);
  }, []);

  const updateDeviceLayout = (
    updater: (current: SiteNavigationTopBarLayout['responsive'][SiteNavigationTopBarDevice]) => SiteNavigationTopBarLayout['responsive'][SiteNavigationTopBarDevice]
  ) => {
    onChange((current) => updateResponsiveLayout(current, device, updater));
  };

  const normalizeDeviceItemWidth = (
    item: SiteNavigationTopBarResponsiveItem,
    settings: SiteNavigationTopBarResponsiveSettings
  ): SiteNavigationTopBarResponsiveItem => {
    if (item.id === 'search' && item.slot !== 'menu') {
      return {
        ...item,
        widthMode: 'fixed',
        fixedWidthPx: SITE_NAVIGATION_TOP_BAR_SEARCH_COLLAPSED_WIDTH_PX,
        widthPx: SITE_NAVIGATION_TOP_BAR_SEARCH_COLLAPSED_WIDTH_PX,
        widthEditable: false
      };
    }

    const widthMode = deriveTopBarElementWidthMode(item, device, settings);
    const fixedWidthPx = widthMode === 'fixed'
      ? getDerivedTopBarFixedWidthPx(item, device, settings)
      : null;

    return {
      ...item,
      widthMode,
      fixedWidthPx,
      widthPx: Math.max(
        item.id === 'logo' ? SITE_NAVIGATION_TOP_BAR_LOGO_WIDTH_PX : 0,
        item.widthPx > 0 ? item.widthPx : fixedWidthPx ?? getTopBarElementComputedWidth({ item, items, device, settings })
      )
    };
  };

  const updateDeviceItem = (id: SiteNavigationTopBarElementId, updates: Partial<SiteNavigationTopBarResponsiveItem>) => {
    updateDeviceLayout((current) => ({
      ...current,
      items: current.items.map((item) => (item.id === id ? normalizeDeviceItemWidth({ ...item, ...updates }, current.settings) : item))
    }));
  };

  const addTopBarElement = (id: SiteNavigationTopBarElementId) => {
    const defaultItem =
      defaultDeviceLayout.items.find((item) => item.id === id) ??
      DEFAULT_SITE_NAVIGATION_TOP_BAR_LAYOUT.responsive[device].items.find((item) => item.id === id);
    if (!defaultItem || deviceLayout.items.some((item) => item.id === id)) return;

    updateDeviceLayout((current) => ({
      ...current,
      items: sortedResponsiveItems([
        ...current.items,
        normalizeDeviceItemWidth({ ...defaultItem, visible: true }, current.settings)
      ]).map((item, position) => ({ ...item, position }))
    }));
    setSelectedTableElementIds([]);
    setSelectedElementId(id);
    setActiveEdit({ kind: 'position', elementId: id, fieldName: 'x' });
    setAddElementMenuOpen(false);
  };

  const chooseTopBarElementType = (id: SiteNavigationTopBarElementId) => {
    const existingItem = deviceLayout.items.find((item) => item.id === id);

    if (existingItem) {
      setSelectedTableElementIds([]);
      setSelectedElementId(id);
      setActiveEdit({ kind: 'position', elementId: id, fieldName: 'element' });
      setAddElementMenuOpen(false);
      return;
    }

    addTopBarElement(id);
  };

  const deleteSelectedTopBarElements = () => {
    if (selectedTableElementIds.length === 0) return;

    const selectedIds = new Set(selectedTableElementIds);
    const nextSelectedElementId = layoutItems.find((item) => !selectedIds.has(item.id))?.id;

    updateDeviceLayout((current) => ({
      ...current,
      items: current.items
        .filter((item) => !selectedIds.has(item.id))
        .map((item, position) => ({ ...item, position }))
    }));
    setSelectedTableElementIds([]);

    if (selectedIds.has(selectedElementId) && nextSelectedElementId) {
      setSelectedElementId(nextSelectedElementId);
    }
  };

  const moveDeviceItem = (id: SiteNavigationTopBarElementId, xPx: number, xRatio: number) => {
    updateDeviceLayout((current) => {
      const maxZIndex = current.items.reduce((max, item) => Math.max(max, item.zIndex), 0);

      return {
        ...current,
        items: current.items.map((item) => {
          if (item.id !== id) return item;

          const placementWidth = getTopBarElementRenderedPlacementWidth({
            item,
            items,
            device,
            settings: current.settings,
            logoDisplaySize
          });
          const maxXPx = Math.max(0, placementBoundsWidth - placementWidth);

          return normalizeDeviceItemWidth(
            {
              ...item,
              xPx,
              xRatio,
              region:
                item.id === 'cart' || item.region === 'edgeRight'
                  ? Math.abs(xPx - maxXPx) <= 1
                    ? 'edgeRight'
                    : 'right'
                  : item.region,
              zIndex: maxZIndex + 1
            },
            current.settings
          );
        })
      };
    });
  };

  const updateSettings = (updates: Partial<SiteNavigationTopBarResponsiveSettings>) => {
    updateDeviceLayout((current) => ({
      ...current,
      settings: { ...current.settings, ...updates }
    }));
  };

  const updateDesktopBreakpointFrom = (nextDesktopBreakpointFrom: number) => {
    const tabletBreakpointFrom = layout.responsive.tablet.settings.breakpointFrom ?? 768;
    const breakpointTo = Math.max(tabletBreakpointFrom, nextDesktopBreakpointFrom - 1);

    onChange((current) =>
      updateResponsiveLayout(current, 'tablet', (tabletLayout) => ({
        ...tabletLayout,
        settings: {
          ...tabletLayout.settings,
          breakpointTo
        }
      }))
    );
  };

  const resetDeviceItem = (id: SiteNavigationTopBarElementId) => {
    const defaultItem =
      defaultDeviceLayout.items.find((item) => item.id === id) ??
      DEFAULT_SITE_NAVIGATION_TOP_BAR_LAYOUT.responsive[device].items.find((item) => item.id === id);
    if (!defaultItem) return;
    updateDeviceItem(id, defaultItem);
  };

  const rowSettingLimits = topBarRowSettingLimits[device];
  const hasDeviceSettingsPanel = device === 'mobile';
  const tabletBreakpointFrom = layout.responsive.tablet.settings.breakpointFrom ?? 768;
  const desktopBreakpointFrom = (layout.responsive.tablet.settings.breakpointTo ?? 1024) + 1;
  const desktopBreakpointMin = tabletBreakpointFrom + 1;
  const tablePlacementGeometry = useMemo(
    () =>
      calculateTopBarGeometry({
        viewportWidth: selectedDevicePreviewWidth / COMMERCIAL_STOREFRONT_SCALE,
        viewportHeight: Math.max(44, deviceLayout.settings.height),
        siteLayout: getTopBarStorefrontGeometrySiteLayout(siteLayout),
        settings: getTopBarStorefrontGeometrySettings(deviceLayout.settings),
        layoutItems,
        items,
        device,
        logoDisplaySize,
        labelScale: COMMERCIAL_STOREFRONT_SCALE,
        coordinateScale: COMMERCIAL_STOREFRONT_SCALE
      }),
    [device, deviceLayout.settings, items, layoutItems, logoDisplaySize, selectedDevicePreviewWidth, siteLayout]
  );
  const selectedWidthLabel = getTopBarSelectedWidthLabel(
    deviceLayout.settings,
    tablePlacementGeometry,
    COMMERCIAL_STOREFRONT_SCALE
  );
  const placementBoundsWidth = Math.round(tablePlacementGeometry.contentRect.width * COMMERCIAL_STOREFRONT_SCALE);
  const tableResolvedXPxById = useMemo(
    () =>
      layoutItems.reduce<Partial<Record<SiteNavigationTopBarElementId, number>>>((resolvedXPxById, item) => {
        const renderedRect = tablePlacementGeometry.elementRects[item.id];
        resolvedXPxById[item.id] = renderedRect
          ? Math.round(
              (renderedRect.x - tablePlacementGeometry.contentRect.x) *
                COMMERCIAL_STOREFRONT_SCALE
            )
          : getTopBarElementXInBounds(
              item,
              placementBoundsWidth,
              getTopBarElementRenderedPlacementWidth({
                item,
                items,
                device,
                settings: deviceLayout.settings,
                logoDisplaySize
              }),
              getTopBarElementRenderedPlacementWidth({
                item,
                items,
                device,
                settings: deviceLayout.settings
              })
            );
        return resolvedXPxById;
      }, {}),
    [
      device,
      deviceLayout.settings,
      items,
      layoutItems,
      logoDisplaySize,
      placementBoundsWidth,
      tablePlacementGeometry.contentRect.x,
      tablePlacementGeometry.elementRects
    ]
  );
  const tableLayoutItems = useMemo(
    () => sortTopBarTableItemsByResolvedX(layoutItems, tableResolvedXPxById),
    [layoutItems, tableResolvedXPxById]
  );
  const tableOffsets = useMemo(() => {
    const placementRects = layoutItems
      .filter((item) => isTopBarPlacementItemRendered(item, device, deviceLayout.settings))
      .map((item) => {
        const rect = tablePlacementGeometry.elementRects[item.id];
        if (!rect) return null;
        const x = Math.round((rect.x - tablePlacementGeometry.contentRect.x) * COMMERCIAL_STOREFRONT_SCALE);
        const width = Math.round(rect.width * COMMERCIAL_STOREFRONT_SCALE);

        return { id: item.id, x, width, zIndex: item.zIndex };
      })
      .filter((rect): rect is { id: SiteNavigationTopBarElementId; x: number; width: number; zIndex: number } => Boolean(rect))
      .sort((first, second) => {
        const xDelta = first.x - second.x;
        return xDelta === 0 ? first.zIndex - second.zIndex : xDelta;
      });
    const offsets: Partial<Record<SiteNavigationTopBarElementId, TopBarTableOffsets>> = {};

    placementRects.forEach((rect, index) => {
      const previousRect = placementRects[index - 1];
      const nextRect = placementRects[index + 1];
      const leftGap = previousRect ? rect.x - (previousRect.x + previousRect.width) : 0;
      const rightGap = nextRect ? nextRect.x - (rect.x + rect.width) : 0;

      offsets[rect.id] = {
        rendered: true,
        leftValue: Math.round(leftGap),
        rightValue: Math.round(rightGap),
        hasLeftNeighbor: Boolean(previousRect),
        hasRightNeighbor: Boolean(nextRect),
        previousRightPx: previousRect ? previousRect.x + previousRect.width : null,
        nextLeftPx: nextRect ? nextRect.x : null
      };
    });

    layoutItems.forEach((item) => {
      if (!offsets[item.id]) {
        offsets[item.id] = {
          rendered: false,
          leftValue: 0,
          rightValue: 0,
          hasLeftNeighbor: false,
          hasRightNeighbor: false,
          previousRightPx: null,
          nextLeftPx: null
        };
      }
    });

    return offsets;
  }, [device, deviceLayout.settings, layoutItems, tablePlacementGeometry.contentRect.x, tablePlacementGeometry.elementRects]);
  const tableGridClassName = topBarElementRowGridClassName;
  const tableMinWidthClassName = topBarElementRowMinWidthClassName;
  const selectedTableElementIdSet = useMemo(() => new Set(selectedTableElementIds), [selectedTableElementIds]);
  const allTableRowsSelected = tableLayoutItems.length > 0 && tableLayoutItems.every((item) => selectedTableElementIdSet.has(item.id));
  const addElementChoices = useMemo(() => {
    const currentIds = new Set(deviceLayout.items.map((item) => item.id));

    return DEFAULT_SITE_NAVIGATION_TOP_BAR_LAYOUT.responsive[device].items.map((item) => ({
      id: item.id,
      alreadyAdded: currentIds.has(item.id)
    }));
  }, [device, deviceLayout.items]);
  const hasSelectedTableElements = selectedTableElementIds.length > 0;

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-4">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="text-lg font-semibold text-slate-900">Zgornja vrstica</h2>
        </div>
        <div className="flex items-center gap-2">
          <IconButton
            type="button"
            size="sm"
            tone="neutral"
            className={adminTableNeutralIconButtonClassName}
            aria-label="Privzete nastavitve"
            title="Privzete nastavitve"
            onClick={() => onChange(() => cloneTopBarLayout(initialLayout))}
          >
            <ActionUndoIcon />
          </IconButton>
          <Button
            type="button"
            variant="primary"
            size="toolbar"
            className={`gap-2 whitespace-nowrap ${adminTablePrimaryButtonClassName}`}
            onClick={() => {
              void onSetInitialLayout(cloneTopBarLayout(layout));
            }}
            disabled={isSaving}
          >
            <SaveIcon className="h-4 w-4" />
            Nastavi kot privzete nastavitve
          </Button>
        </div>
      </div>

      <div className="grid min-w-0 items-start gap-4">
        <div className="grid min-w-0 gap-4 min-[1280px]:grid-cols-[minmax(0,3fr)_minmax(500px,2fr)]">
          <div className="col-span-full flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
              {(Object.keys(topBarDeviceLabels) as SiteNavigationTopBarDevice[]).map((currentDevice) => (
                <button
                  key={currentDevice}
                  type="button"
                  className={`inline-flex h-8 items-center gap-1.5 rounded-md px-2.5 text-[12px] font-medium leading-none transition ${adminControlFocusTokenClasses} ${
                    device === currentDevice ? 'text-[color:var(--blue-500)]' : 'text-slate-500 hover:text-[color:var(--blue-500)]'
                  }`}
                  onClick={() => setDevice(currentDevice)}
                >
                  <AdminTopBarDeviceGlyph device={currentDevice} />
                  {topBarDeviceLabels[currentDevice]}
                </button>
              ))}
            </div>
          </div>

          <div className="col-span-full">
            <TopBarResponsivePreview
              device={device}
              logoDisplaySize={logoDisplaySize}
              navigation={previewNavigation}
              siteLayout={siteLayout}
              settings={deviceLayout.settings}
              layoutItems={layoutItems}
              items={items}
              selectedElementId={selectedElementId}
              activeEdit={activeEdit}
              showOverlay={showTechnicalOverlay}
              showHeaderPreview={showHeaderPreview}
              onToggleOverlay={() => setShowTechnicalOverlay((current) => !current)}
              onHeaderPreviewChange={setShowHeaderPreview}
              onSelectElement={setSelectedElementId}
              onSetActiveEdit={setActiveEdit}
              onClearActiveEditSoon={clearActiveEditSoon}
              onUpdateItem={updateDeviceItem}
              onMoveElement={moveDeviceItem}
            />
          </div>

          <div className="order-2 min-w-0 self-stretch border-t border-slate-100 pt-4 min-[1280px]:col-start-2 min-[1280px]:row-start-3 min-[1280px]:border-t-0 min-[1280px]:pt-0">
            <aside
              className={`${styles.panel} grid h-full min-w-0 content-start rounded-xl border border-slate-200 bg-white`}
              data-testid="top-bar-settings-panel"
              data-appearance-editor-settings-surface
              data-settings-scroll="none"
            >
              <section
                className="min-w-0"
                data-testid="top-bar-appearance-settings"
              >
                <h3 className="text-xl font-semibold leading-7 text-slate-900">Videz</h3>
                <div className="mt-5 min-w-0">
                  <h4 className="text-base font-semibold leading-6 text-slate-900">Barve in pisava</h4>

                  <div
                    className="mt-3 grid min-w-0 gap-4 lg:grid-cols-3"
                    data-testid="top-bar-colors-row"
                  >
                    <div className="grid min-w-0 gap-1.5">
                      <span className="text-[12px] font-medium leading-4 text-slate-600">Ozadje</span>
                      <TopBarAppearanceColorField
                        label="Barva ozadja"
                        ariaLabel="Ozadje zgornje vrstice"
                        value={deviceLayout.settings.backgroundColor}
                        fallback="#FFFFFF"
                        hideLabel
                        onChange={(backgroundColor) => updateSettings({ backgroundColor })}
                      />
                    </div>
                    <div className="grid min-w-0 gap-1.5">
                      <span className="text-[12px] font-medium leading-4 text-slate-600">Prosojnost</span>
                      <TopBarUnitNumberInput
                        value={deviceLayout.settings.backgroundOpacityPercent}
                        min={0}
                        max={100}
                        step={1}
                        suffix="%"
                        variant="simulator"
                        className="w-full"
                        inputClassName="min-w-0 flex-1 text-[13px]"
                        ariaLabel="Prosojnost ozadja zgornje vrstice"
                        onChange={(backgroundOpacityPercent) => updateSettings({ backgroundOpacityPercent })}
                      />
                    </div>
                    <div className="grid min-w-0 gap-1.5">
                      <span className="text-[12px] font-medium leading-4 text-slate-600">Besedilo</span>
                      <TopBarAppearanceColorField
                        label="Barva besedila"
                        ariaLabel="Barva besedila zgornje vrstice"
                        value={deviceLayout.settings.textColor}
                        fallback="#4D4D4D"
                        hideLabel
                        onChange={(textColor) => updateSettings({ textColor })}
                      />
                    </div>
                  </div>

                  <div
                    className="mt-4 grid min-w-0 gap-4 sm:grid-cols-2 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.62fr)_minmax(0,0.82fr)_minmax(0,0.82fr)]"
                    data-testid="top-bar-typography-row"
                  >
                    <div className="grid min-w-0 gap-1.5">
                      <span className="text-[12px] font-medium leading-4 text-slate-600">Pisava</span>
                      <AppearanceEditorCompactSelect
                        value={deviceLayout.settings.fontFamily}
                        options={HOMEPAGE_WEBSITE_FONT_FAMILIES.map((fontFamily) => ({ value: fontFamily, label: fontFamily }))}
                        ariaLabel="Pisava zgornje vrstice"
                        marker={`topbar-${device}-font-family`}
                        tone="light"
                        triggerClassName="!h-9 !rounded-lg !border-slate-300 !bg-white !px-2.5 !text-[12px] !font-normal !text-slate-700"
                        onValueChange={(fontFamily) => updateSettings({ fontFamily: fontFamily as WebsiteFontFamily })}
                      />
                    </div>
                    <div className="grid min-w-0 gap-1.5">
                      <span className="text-[12px] font-medium leading-4 text-slate-600">Velikost</span>
                      <TopBarUnitNumberInput
                        value={deviceLayout.settings.fontSizePx}
                        min={10}
                        max={24}
                        step={1}
                        suffix="px"
                        variant="simulator"
                        className="w-full"
                        inputClassName="min-w-0 flex-1 text-[13px]"
                        ariaLabel="Velikost pisave zgornje vrstice"
                        onChange={(fontSizePx) => updateSettings({ fontSizePx })}
                      />
                    </div>
                    <div className="grid min-w-0 gap-1.5">
                      <span className="text-[12px] font-medium leading-4 text-slate-600">Debelina</span>
                      <AppearanceEditorCompactSelect
                        value={String(deviceLayout.settings.fontWeight)}
                        options={topBarFontWeightOptions.map((option) => ({ value: String(option.value), label: option.label }))}
                        ariaLabel="Debelina pisave zgornje vrstice"
                        marker={`topbar-${device}-font-weight`}
                        tone="light"
                        triggerClassName="!h-9 !rounded-lg !border-slate-300 !bg-white !px-2.5 !text-[12px] !font-normal !text-slate-700"
                        onValueChange={(fontWeight) => updateSettings({ fontWeight: Number(fontWeight) })}
                      />
                    </div>
                    <div className="grid min-w-0 gap-1.5">
                      <span className="text-[12px] font-medium leading-4 text-slate-600">Slog</span>
                      <AppearanceEditorCompactSelect
                        value={deviceLayout.settings.fontStyle}
                        options={topBarFontStyleOptions}
                        ariaLabel="Slog pisave zgornje vrstice"
                        marker={`topbar-${device}-font-style`}
                        tone="light"
                        triggerClassName="!h-9 !rounded-lg !border-slate-300 !bg-white !px-2.5 !text-[12px] !font-normal !text-slate-700"
                        onValueChange={(fontStyle) => updateSettings({
                          fontStyle: fontStyle as SiteNavigationTopBarResponsiveSettings['fontStyle']
                        })}
                      />
                    </div>
                  </div>
                </div>
              </section>

              <section className="min-w-0 border-t border-slate-200 pt-5" data-testid="top-bar-width-settings">
                <h4 className="text-base font-semibold leading-6 text-slate-900">Zgornja vrstica</h4>
                <div className="mt-3 grid min-w-0 gap-3">
                  <TopBarHelpLabel
                    help={topBarHelpCopy.widthMode}
                    align="right"
                    className="text-[12px] font-medium leading-4 text-slate-600"
                  >
                    Širina
                  </TopBarHelpLabel>
                  <div className="min-w-0" data-testid="top-bar-width-mode-control">
                    <TopBarSegmentedControl<SiteNavigationTopBarWidthMode>
                      value={deviceLayout.settings.widthMode}
                      activeValue={activeEdit.kind === 'width-mode' ? activeEdit.fieldName as SiteNavigationTopBarWidthMode : null}
                      contained
                      options={[
                        { value: 'match_content', label: topBarWidthModeLabels.match_content },
                        { value: 'custom', label: topBarWidthModeLabels.custom },
                        { value: 'full', label: topBarWidthModeLabels.full }
                      ]}
                      onChange={(widthMode) => {
                        setActiveEdit({ kind: 'width-mode', fieldName: widthMode });
                        updateSettings({ widthMode });
                      }}
                      onOptionActive={(widthMode) => setActiveEdit({ kind: 'width-mode', fieldName: widthMode })}
                      onOptionInactive={clearActiveEditSoon}
                    />
                  </div>
                  {deviceLayout.settings.widthMode === 'custom' ? (
                    <div className="grid max-w-[240px] min-w-0 gap-1.5">
                      <TopBarHelpLabel
                        help={topBarHelpCopy.customWidth}
                        align="right"
                        className="text-[12px] font-medium leading-4 text-slate-600"
                      >
                        Širina po meri
                      </TopBarHelpLabel>
                      <TopBarUnitNumberInput
                        value={deviceLayout.settings.customMaxWidthPx ?? siteLayout.siteContentMaxWidthPx}
                        min={640}
                        max={2400}
                        variant="simulator"
                        className="w-full"
                        inputClassName="min-w-0 flex-1 text-[13px]"
                        ariaLabel="Po meri"
                        active={activeEdit.kind === 'container-width' && activeEdit.fieldName === 'customMaxWidthPx'}
                        onBlur={clearActiveEditSoon}
                        onFocus={() => setActiveEdit({ kind: 'container-width', fieldName: 'customMaxWidthPx' })}
                        onMouseEnter={() => setActiveEdit({ kind: 'container-width', fieldName: 'customMaxWidthPx' })}
                        onMouseLeave={clearActiveEditSoon}
                        onChange={(customMaxWidthPx) => {
                          setActiveEdit({ kind: 'container-width', fieldName: 'customMaxWidthPx' });
                          updateSettings({ customMaxWidthPx });
                        }}
                      />
                    </div>
                  ) : null}
                  {device !== 'desktop' ? (
                    <div>
                      <TopBarDeviceSettingsPanel device={device} settings={deviceLayout.settings} onChange={updateSettings} scope="navigation" />
                    </div>
                  ) : null}
                </div>
              </section>

              <section className="min-w-0" data-testid="top-bar-dimensions-settings">
                <div className="grid min-w-0 gap-4 md:grid-cols-3">
                  <TopBarMiniNumberField
                    layout="stack"
                    label="Višina"
                    help={topBarHelpCopy.topBarHeight}
                    value={deviceLayout.settings.height}
                    min={rowSettingLimits.height.min}
                    max={rowSettingLimits.height.max}
                    active={activeEdit.kind === 'container-width' && activeEdit.fieldName === 'height'}
                    onBlur={clearActiveEditSoon}
                    onFocus={() => setActiveEdit({ kind: 'container-width', fieldName: 'height' })}
                    onMouseEnter={() => setActiveEdit({ kind: 'container-width', fieldName: 'height' })}
                    onMouseLeave={clearActiveEditSoon}
                    onChange={(height) => {
                      setActiveEdit({ kind: 'container-width', fieldName: 'height' });
                      updateSettings({ height });
                    }}
                  />
                  {device === 'desktop' ? (
                    <TopBarMiniBreakpointField
                      layout="stack"
                      label="Prelomna širina"
                      help={topBarHelpCopy.breakpoint}
                      value={`${desktopBreakpointFrom}+`}
                      min={desktopBreakpointMin}
                      max={2400}
                      active={activeEdit.kind === 'container-width' && activeEdit.fieldName === 'desktopBreakpointFrom'}
                      onBlur={clearActiveEditSoon}
                      onFocus={() => setActiveEdit({ kind: 'container-width', fieldName: 'desktopBreakpointFrom' })}
                      onMouseEnter={() => setActiveEdit({ kind: 'container-width', fieldName: 'desktopBreakpointFrom' })}
                      onMouseLeave={clearActiveEditSoon}
                      onChange={(nextDesktopBreakpointFrom) => {
                        setActiveEdit({ kind: 'container-width', fieldName: 'desktopBreakpointFrom' });
                        updateDesktopBreakpointFrom(nextDesktopBreakpointFrom);
                      }}
                    />
                  ) : null}
                  {device === 'tablet' ? (
                    <TopBarMiniRangeField
                      layout="stack"
                      label="Prelomna širina"
                      help={topBarHelpCopy.breakpoint}
                      startValue={deviceLayout.settings.breakpointFrom ?? 768}
                      endValue={deviceLayout.settings.breakpointTo ?? 1024}
                      min={320}
                      max={1920}
                      onChange={(breakpointFrom, breakpointTo) => updateSettings({ breakpointFrom, breakpointTo })}
                    />
                  ) : null}
                  {device === 'mobile' ? (
                    <TopBarMiniRangeField
                      layout="stack"
                      label="Prelomna širina"
                      help={topBarHelpCopy.breakpoint}
                      startValue={0}
                      endValue={deviceLayout.settings.breakpointTo ?? 767}
                      min={0}
                      max={1200}
                      active={activeEdit.kind === 'container-width' && activeEdit.fieldName === 'mobileBreakpointTo'}
                      onBlur={clearActiveEditSoon}
                      onFocus={() => setActiveEdit({ kind: 'container-width', fieldName: 'mobileBreakpointTo' })}
                      onMouseEnter={() => setActiveEdit({ kind: 'container-width', fieldName: 'mobileBreakpointTo' })}
                      onMouseLeave={clearActiveEditSoon}
                      onChange={(_breakpointFrom, breakpointTo) => {
                        setActiveEdit({ kind: 'container-width', fieldName: 'mobileBreakpointTo' });
                        updateSettings({ breakpointTo });
                      }}
                    />
                  ) : null}
                  <TopBarMiniRangeField
                    layout="stack"
                    label="Odmik"
                    help={`${topBarHelpCopy.gutterMin} ${topBarHelpCopy.gutterMax}`}
                    startValue={siteLayout.siteGutterMinPx}
                    endValue={siteLayout.siteGutterMaxPx}
                    min={0}
                    max={96}
                    allowSingleValue
                    active={activeEdit.kind === 'container-width' && activeEdit.fieldName === 'siteGutterRangePx'}
                    onBlur={clearActiveEditSoon}
                    onFocus={() => setActiveEdit({ kind: 'container-width', fieldName: 'siteGutterRangePx' })}
                    onMouseEnter={() => setActiveEdit({ kind: 'container-width', fieldName: 'siteGutterRangePx' })}
                    onMouseLeave={clearActiveEditSoon}
                    onChange={(siteGutterMinPx, siteGutterMaxPx) => {
                      setActiveEdit({ kind: 'container-width', fieldName: 'siteGutterRangePx' });
                      onSiteLayoutChange({ siteGutterMinPx, siteGutterMaxPx });
                    }}
                  />
                </div>
              </section>

              {hasDeviceSettingsPanel ? (
                <TopBarDeviceSettingsPanel device={device} settings={deviceLayout.settings} onChange={updateSettings} scope="extras" />
              ) : null}
            </aside>

          </div>

          <div className="order-1 min-w-0 min-[1280px]:col-start-1 min-[1280px]:row-start-3">
            <div className="relative overflow-visible rounded-xl bg-white" data-testid="top-bar-elements-table">
              <div className="flex min-h-[58px] items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
                <h3 className="text-base font-semibold text-slate-900">Elementi v vrstici</h3>
                <div className="flex items-center gap-2">
                  <span className="rounded-md bg-slate-50 px-2 py-1 text-[11px] font-medium text-slate-500">{selectedWidthLabel}</span>
                  <div ref={addElementMenuRef} className="relative">
                    <IconButton
                      type="button"
                      tone="neutral"
                      className={adminTableNeutralIconButtonClassName}
                      aria-label="Dodaj element v vrstico"
                      title="Dodaj element"
                      onClick={() => setAddElementMenuOpen((current) => !current)}
                    >
                      <PlusIcon />
                    </IconButton>
                    {addElementMenuOpen ? (
                      <MenuPanel className="absolute right-0 top-full z-[120] mt-2 w-72 p-2">
                        <div className="px-2 pb-2 pt-1">
                          <p className="text-[12px] font-semibold leading-4 text-slate-900">Dodaj element</p>
                          <p className="mt-0.5 text-[11px] leading-4 text-slate-500">Izberite vrsto elementa za zgornjo vrstico.</p>
                        </div>
                        <div className="grid gap-1">
                          {addElementChoices.map(({ id, alreadyAdded }) => (
                            <button
                              key={id}
                              type="button"
                              aria-label={alreadyAdded ? `Izberi obstoječi element ${topBarLayoutLabels[id]}` : `Dodaj element ${topBarLayoutLabels[id]}`}
                              className="group flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left text-[12px] transition hover:bg-[color:var(--hover-neutral)] focus-visible:border focus-visible:border-[color:var(--blue-500)] focus-visible:outline-none focus-visible:ring-0"
                              onClick={() => chooseTopBarElementType(id)}
                            >
                              <AdminTopBarElementBadge id={id} />
                              <span className="min-w-0 flex-1">
                                <span className="block truncate font-medium text-slate-900">{topBarLayoutLabels[id]}</span>
                                <span className="block truncate text-[11px] leading-4 text-slate-500">
                                  {alreadyAdded ? 'Element je že v vrstici' : 'Dodaj v trenutno napravo'}
                                </span>
                              </span>
                              <span
                                className={`shrink-0 rounded-full px-2 py-1 text-[10px] font-medium leading-none ${
                                  alreadyAdded
                                    ? 'bg-slate-50 text-slate-500'
                                    : 'bg-[color:var(--blue-50)] text-[color:var(--blue-500)]'
                                }`}
                              >
                                {alreadyAdded ? 'Izberi' : 'Dodaj'}
                              </span>
                            </button>
                          ))}
                        </div>
                      </MenuPanel>
                    ) : null}
                  </div>
                  <IconButton
                    type="button"
                    tone={hasSelectedTableElements ? 'danger' : 'neutral'}
                    className={hasSelectedTableElements ? adminTableSelectedDangerIconButtonClassName : adminTableNeutralIconButtonClassName}
                    aria-label="Izbriši izbrane elemente"
                    title="Izbriši izbrane"
                    disabled={!hasSelectedTableElements}
                    onClick={deleteSelectedTopBarElements}
                  >
                    <TrashCanIcon />
                  </IconButton>
                </div>
              </div>
              <div className="overflow-x-auto" data-appearance-editor-scroll-purpose="data">
                <div className={`grid ${tableMinWidthClassName} ${tableGridClassName} gap-3 border-b border-slate-100 bg-slate-50 px-3 py-2 text-[12px] font-medium text-slate-500`}>
                  <span className="flex items-center justify-center">
                    <input
                      type="checkbox"
                      checked={allTableRowsSelected}
                      aria-label="Izberi vse elemente v vrstici"
                      className="h-4 w-4 rounded border-slate-300 text-[color:var(--blue-500)] focus:ring-[color:var(--blue-500)]"
                      onChange={(event) => {
                        setSelectedTableElementIds(event.target.checked ? tableLayoutItems.map((item) => item.id) : []);
                      }}
                    />
                  </span>
                  <span>Element</span>
                  <span className="text-center">X</span>
                  <TopBarHelpLabel help={topBarHelpCopy.widthColumn} className="justify-center text-center">Širina</TopBarHelpLabel>
                  <TopBarHelpLabel help={topBarHelpCopy.offsetsColumn} className="justify-center text-center">Odmiki</TopBarHelpLabel>
                  <span className="text-center">Vidnost</span>
                  <span className="text-center">Uredi</span>
                </div>
                {tableLayoutItems.length > 0 ? tableLayoutItems.map((item, index) => (
                  <TopBarElementRow
                    key={item.id}
                    item={item}
                    device={device}
                    settings={deviceLayout.settings}
                    items={items}
                    logoDisplaySize={logoDisplaySize}
                    placementBoundsWidth={placementBoundsWidth}
                    currentXPx={tableResolvedXPxById[item.id] ?? item.xPx}
                    offsets={tableOffsets[item.id] ?? {
                      rendered: false,
                      leftValue: 0,
                      rightValue: 0,
                      hasLeftNeighbor: false,
                      hasRightNeighbor: false,
                      previousRightPx: null,
                      nextLeftPx: null
                    }}
                    selected={selectedElementId === item.id || activeEdit.elementId === item.id}
                    checked={selectedTableElementIdSet.has(item.id)}
                    isLast={index === tableLayoutItems.length - 1}
                    activeEdit={activeEdit}
                    onSelect={() => setSelectedElementId(item.id)}
                    onCheckedChange={(checked) => {
                      setSelectedTableElementIds((current) =>
                        checked
                          ? current.includes(item.id)
                            ? current
                            : [...current, item.id]
                          : current.filter((selectedId) => selectedId !== item.id)
                      );
                    }}
                    onSetActiveEdit={setActiveEdit}
                    onClearActiveEditSoon={clearActiveEditSoon}
                    onChange={(updates) => updateDeviceItem(item.id, updates)}
                    onReset={() => resetDeviceItem(item.id)}
                  />
                )) : (
                  <div className={`${tableMinWidthClassName} px-4 py-8 text-center text-[13px] text-slate-500`}>
                    V vrstici ni elementov. Dodajte element z gumbom +.
                  </div>
                )}
              </div>
              <div aria-hidden="true" className="pointer-events-none absolute inset-0 z-[80] rounded-xl border border-slate-200" />
            </div>
          </div>
        </div>

      </div>
    </section>
  );
}

function IconPicker({
  icon,
  label,
  onChange,
  highlighted = false
}: {
  icon: SiteNavigationItemIcon;
  label: string;
  onChange: (icon: SiteNavigationItemIcon) => void;
  highlighted?: boolean;
}) {
  const pickerId = useId();
  const rootRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const dismissRefs = useMemo(() => [rootRef], []);

  useDropdownDismiss({
    open,
    refs: dismissRefs,
    returnFocusRef: triggerRef,
    dismissGroup: 'navigation-icon-picker',
    onClose: () => setOpen(false)
  });

  const selectedIconName = toSiteNavigationLucideIconName(icon);
  const filteredIconNames = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return siteNavigationLucideIconNames;
    const searchTerms = buildIconSearchTerms(normalizedQuery);
    return siteNavigationLucideIconNames
      .map((iconName) => ({ iconName, score: scoreIconSearchResult(iconName, searchTerms) }))
      .filter((result): result is { iconName: LucideIconName; score: number } => result.score !== null)
      .sort((first, second) => first.score - second.score || first.iconName.localeCompare(second.iconName))
      .map((result) => result.iconName);
  }, [query]);
  const selectedIconIndex = filteredIconNames.indexOf(selectedIconName);
  const selectedPage = selectedIconIndex >= 0 ? Math.floor(selectedIconIndex / iconPickerPageSize) : 0;
  const [page, setPage] = useState(selectedPage);
  const pageCount = Math.max(1, Math.ceil(filteredIconNames.length / iconPickerPageSize));
  const visibleIconNames = filteredIconNames.slice(page * iconPickerPageSize, page * iconPickerPageSize + iconPickerPageSize);

  useEffect(() => {
    if (open) setPage(Math.min(selectedPage, pageCount - 1));
  }, [open, pageCount, selectedPage]);

  return (
    <div
      ref={rootRef}
      className={`relative h-8 w-8 shrink-0 ${open ? 'z-[80]' : 'z-10'}`}
      onPointerDown={(event) => event.stopPropagation()}
      onBlur={(event) => {
        const nextFocus = event.relatedTarget;
        if (nextFocus instanceof Node && event.currentTarget.contains(nextFocus)) return;
        setOpen(false);
      }}
    >
      <button
        ref={triggerRef}
        type="button"
        aria-label={label}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? pickerId : undefined}
        title={icon}
        onClick={() => setOpen((current) => !current)}
        className={`inline-grid h-8 w-8 place-items-center rounded-md border bg-white transition hover:bg-[color:var(--hover-neutral)] ${adminControlFocusTokenClasses} ${
          open || highlighted
            ? 'border-[color:var(--blue-500)] text-[color:var(--blue-500)]'
            : 'border-slate-300 text-slate-700'
        }`}
      >
        <NavigationIconGlyph icon={icon} className="h-4 w-4" />
      </button>
      {open ? (
        <MenuPanel className="absolute left-0 top-full z-[90] mt-2 w-[294px] p-2">
          <div id={pickerId} role="dialog" aria-label={`${label}: izberite ikono`}>
            <Input
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setPage(0);
              }}
              className={`${compactInputClassName} mb-2 h-7 w-full`}
              placeholder="Poišči ikono"
              aria-label="Poišči ikono"
            />
            <div className="grid grid-cols-6 gap-1">
              {visibleIconNames.length > 0 ? visibleIconNames.map((option) => (
                <button
                  key={option}
                  type="button"
                  aria-label={`Izberi ikono ${option}`}
                  title={option}
                  onClick={() => {
                    onChange(option);
                    setOpen(false);
                  }}
                  className={`inline-grid h-7 w-7 place-items-center rounded-md border transition ${adminControlFocusTokenClasses} ${
                    option === selectedIconName
                      ? 'border-[color:var(--blue-500)] bg-[color:var(--hover-neutral)] text-[color:var(--blue-500)]'
                      : 'border-slate-200 bg-white text-slate-700 hover:bg-[color:var(--hover-neutral)] hover:text-[color:var(--blue-500)]'
                  }`}
                >
                  <NavigationIconGlyph icon={option} className="h-3.5 w-3.5" />
                </button>
              )) : (
                <div className="col-span-6 px-1 py-4 text-center text-[12px] text-slate-500">Ni zadetkov</div>
              )}
            </div>
            <div className="mt-2 flex items-center justify-between gap-2 text-[11px] text-slate-500">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7 px-2"
                disabled={page === 0}
                onClick={() => setPage((current) => Math.max(0, current - 1))}
              >
                Prej
              </Button>
              <span>
                {page + 1} / {pageCount}
              </span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7 px-2"
                disabled={page >= pageCount - 1}
                onClick={() => setPage((current) => Math.min(pageCount - 1, current + 1))}
              >
                Naprej
              </Button>
            </div>
          </div>
        </MenuPanel>
      ) : null}
    </div>
  );
}

function DeleteButton({
  label,
  onDelete,
  className = 'h-6 w-6',
  iconClassName = '!h-3.5 !w-3.5',
  menu = false
}: {
  label: string;
  onDelete: () => void;
  className?: string;
  iconClassName?: string;
  menu?: boolean;
}) {
  if (menu) {
    return (
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          onDelete();
        }}
        className={adminActionMenuItemTokenClasses.danger}
      >
        <span>{label}</span>
        <TrashCanIcon className="!h-4 !w-4" />
      </button>
    );
  }

  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={(event) => {
        event.stopPropagation();
        onDelete();
      }}
      className={`inline-grid shrink-0 place-items-center rounded-md ${iconButtonTokenClasses.danger} ${className}`}
    >
      <TrashCanIcon className={iconClassName} />
    </button>
  );
}

function InlineEditableText({
  value,
  onChange,
  className,
  inputClassName,
  style,
  placeholder = 'Vnesite besedilo',
  ariaLabel,
  displayValue
}: {
  value: string;
  onChange: (value: string) => void;
  className: string;
  inputClassName?: string;
  style?: CSSProperties;
  placeholder?: string;
  ariaLabel: string;
  displayValue?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const initialValueRef = useRef(value);

  useEffect(() => {
    if (!editing) setDraft(value);
  }, [editing, value]);

  const commit = () => setEditing(false);

  if (editing) {
    return (
      <input
        autoFocus
        value={draft}
        placeholder={placeholder}
        aria-label={ariaLabel}
        onPointerDown={(event) => event.stopPropagation()}
        onChange={(event) => {
          const nextValue = event.target.value;
          setDraft(nextValue);
          onChange(nextValue);
        }}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === 'Enter') commit();
          if (event.key === 'Escape') {
            onChange(initialValueRef.current);
            setDraft(initialValueRef.current);
            setEditing(false);
          }
        }}
        className={`${compactInputClassName} pointer-events-auto min-w-0 ${inputClassName ?? ''}`}
        style={style}
      />
    );
  }

  return (
    <button
      type="button"
      className={`${className} ${adminInlineEditTriggerTokenClasses}`}
      style={style}
      onPointerDown={(event) => event.stopPropagation()}
      onClick={(event) => {
        event.stopPropagation();
        initialValueRef.current = value;
        setEditing(true);
      }}
      title={displayValue ?? value}
    >
      {value ? displayValue ?? value : placeholder}
    </button>
  );
}

type FooterTextAlignment = 'left' | 'center' | 'right' | 'justify';

const footerTextAlignmentOptions = ['left', 'center', 'right', 'justify'] as const;
const footerShortTextAlignmentOptions = ['left', 'center', 'right'] as const;

function FooterAlignmentGlyph({
  alignment,
  className = 'h-3.5 w-3.5'
}: {
  alignment: FooterTextAlignment;
  className?: string;
}) {
  const lineStarts = alignment === 'right'
    ? [3, 6, 4]
    : alignment === 'center'
      ? [3, 5, 4]
      : [3, 3, 3];
  const lineEnds = alignment === 'left'
    ? [15, 12, 14]
    : alignment === 'center'
      ? [15, 13, 14]
      : [15, 15, 15];

  return (
    <svg aria-hidden="true" viewBox="0 0 18 18" fill="none" className={className}>
      {[4, 9, 14].map((y, index) => (
        <path
          key={y}
          d={`M${lineStarts[index]} ${y}H${lineEnds[index]}`}
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
        />
      ))}
    </svg>
  );
}

function FooterTextAlignmentMenu<Value extends FooterTextAlignment>({
  value,
  options,
  onValueChange,
  ariaLabel,
  side = 'right',
  className
}: {
  value: Value;
  options: readonly Value[];
  onValueChange: (value: Value) => void;
  ariaLabel: string;
  side?: 'left' | 'right';
  className?: string;
}) {
  const rootRef = useRef<HTMLSpanElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const [open, setOpen] = useState(false);
  const dismissRefs = useMemo(() => [rootRef], []);

  useDropdownDismiss({ open, refs: dismissRefs, onClose: () => setOpen(false) });

  return (
    <span
      ref={rootRef}
      className={`relative inline-flex shrink-0 ${open ? 'z-[120]' : 'z-20'} ${className ?? ''}`}
      onPointerDown={(event) => event.stopPropagation()}
      onKeyDown={(event) => {
        if (!open || event.key !== 'Escape') return;
        event.stopPropagation();
        setOpen(false);
        window.requestAnimationFrame(() => triggerRef.current?.focus());
      }}
    >
      <button
        ref={triggerRef}
        type="button"
        aria-label={ariaLabel}
        aria-haspopup="dialog"
        aria-expanded={open}
        title={ariaLabel}
        data-footer-text-alignment-trigger={ariaLabel}
        className={`${adminMiniIconButtonTokenClasses} ${open ? '!border-[color:var(--blue-500)] !text-[color:var(--blue-600)]' : ''}`}
        onClick={(event) => {
          event.stopPropagation();
          setOpen((current) => !current);
        }}
      >
        <FooterAlignmentGlyph alignment={value} />
      </button>
      {open ? (
        <div
          role="dialog"
          aria-label={ariaLabel}
          data-footer-text-alignment-popover
          className={`absolute top-full z-[130] mt-1 grid w-max gap-1.5 rounded-xl border border-white/15 bg-slate-950/95 p-2 text-white shadow-[0_16px_40px_rgba(15,23,42,0.35)] backdrop-blur-xl ${
            side === 'left' ? 'left-0' : 'right-0'
          }`}
        >
          <span className="px-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-white/55">
            Poravnava
          </span>
          <AppearanceEditorAlignmentControl
            value={value}
            options={options}
            onValueChange={onValueChange}
            ariaLabel={ariaLabel}
            tone="dark"
          />
        </div>
      ) : null}
    </span>
  );
}

function TopLevelNavItemEditor({
  item,
  selected,
  onSelect,
  onChange,
  onDelete,
  onOpenUrlEditor
}: {
  item: SiteNavigationTopLevelItem;
  selected: boolean;
  onSelect: () => void;
  onChange: (updates: Partial<SiteNavigationTopLevelItem>) => void;
  onDelete: () => void;
  onOpenUrlEditor: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id });
  const menuRef = useRef<HTMLDivElement | null>(null);
  const [renaming, setRenaming] = useState(false);
  const [draftLabel, setDraftLabel] = useState(item.label);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuDismissRefs = useMemo(() => [menuRef], []);

  useEffect(() => {
    if (!renaming) setDraftLabel(item.label);
  }, [item.label, renaming]);

  useDropdownDismiss({ open: menuOpen, refs: menuDismissRefs, onClose: () => setMenuOpen(false) });

  const commitLabel = () => {
    onChange({ label: draftLabel });
    setRenaming(false);
  };

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      onContextMenu={(event) => {
        event.preventDefault();
        event.stopPropagation();
        setMenuOpen(true);
        onSelect();
      }}
      data-navigation-hidden={item.visible ? undefined : 'true'}
      className={`group/nav-item relative flex min-h-10 items-center gap-1.5 ${isDragging ? 'z-20 opacity-80' : ''}`}
    >
      {renaming ? (
        <Input
          autoFocus
          value={draftLabel}
          onChange={(event) => setDraftLabel(event.target.value)}
          onBlur={commitLabel}
          onKeyDown={(event) => {
            if (event.key === 'Enter') commitLabel();
            if (event.key === 'Escape') {
              setDraftLabel(item.label);
              setRenaming(false);
            }
          }}
          className={`${compactInputClassName} w-[132px]`}
        />
      ) : (
        <button
          type="button"
          className={`inline-flex h-9 max-w-[160px] items-center gap-1.5 rounded-md px-3 text-[13px] leading-5 transition ${
            !item.visible
              ? 'text-slate-400 opacity-50 hover:text-slate-500 hover:opacity-75'
              : selected
              ? 'text-[color:var(--blue-500)]'
              : 'text-[var(--navbar-link-default)] hover:text-[var(--navbar-link-hover)]'
          }`}
          onClick={(event) => {
            event.stopPropagation();
            onSelect();
          }}
        >
          <span className="truncate pb-px">{item.label || 'Element'}</span>
          {item.groups.length > 0 ? <ChevronGlyph /> : null}
        </button>
      )}
      <div
        ref={menuRef}
        className="contents"
        onContextMenu={(event) => {
          event.preventDefault();
          event.stopPropagation();
          setMenuOpen(true);
          onSelect();
        }}
      >
        <button
          type="button"
          aria-label="Možnosti elementa"
          aria-expanded={menuOpen}
          className={`${adminMiniIconButtonTokenClasses} opacity-70 group-hover/nav-item:opacity-100 group-focus-within/nav-item:opacity-100 ${menuOpen ? '!text-[color:var(--blue-500)]' : ''}`}
          onClick={(event) => {
            event.stopPropagation();
            setMenuOpen((current) => !current);
            onSelect();
          }}
        >
          <DotsGlyph className="h-3.5 w-3.5" />
        </button>
        {menuOpen ? (
          <MenuPanel className="absolute left-0 top-full z-30 mt-1 w-44">
          <button
            type="button"
            className={adminActionMenuItemTokenClasses.base}
            onClick={(event) => {
              event.stopPropagation();
              setMenuOpen(false);
              setRenaming(true);
            }}
          >
            Spremeni naziv
          </button>
          <button
            type="button"
            className={adminActionMenuItemTokenClasses.base}
            onClick={(event) => {
              event.stopPropagation();
              setMenuOpen(false);
              onOpenUrlEditor();
            }}
          >
            Spremeni povezavo
          </button>
          <button
            type="button"
            className={adminActionMenuItemTokenClasses.flex}
            onClick={(event) => {
              event.stopPropagation();
              onChange({ visible: !item.visible });
              setMenuOpen(false);
            }}
          >
            <span>{item.visible ? 'Skrij element' : 'Prikaži element'}</span>
            <EyeGlyph visible={item.visible} className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            className={adminActionMenuItemTokenClasses.flexDrag}
            {...attributes}
            {...listeners}
          >
            <span>Premakni</span>
            <DragGlyph className="h-3.5 w-3.5" />
          </button>
          <DeleteButton label="Izbriši" onDelete={onDelete} menu />
          </MenuPanel>
        ) : null}
      </div>
    </div>
  );
}

function LinkEditor({
  link,
  onChange,
  onDelete
}: {
  link: SiteNavigationLink;
  onChange: (updates: Partial<SiteNavigationLink>) => void;
  onDelete: () => void;
}) {
  const { attributes, listeners, setActivatorNodeRef, setNodeRef, transform, transition, isDragging } = useSortable({ id: link.id });
  const menuRef = useRef<HTMLDivElement | null>(null);
  const [urlOpen, setUrlOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [rowHovered, setRowHovered] = useState(false);
  const [rowFocused, setRowFocused] = useState(false);
  const menuDismissRefs = useMemo(() => [menuRef], []);

  useDropdownDismiss({ open: menuOpen, refs: menuDismissRefs, onClose: () => setMenuOpen(false) });

  const rowLayerClass = menuOpen ? 'z-[70]' : isDragging ? 'z-20' : '';

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      onMouseEnter={() => setRowHovered(true)}
      onMouseLeave={() => setRowHovered(false)}
      onFocusCapture={() => setRowFocused(true)}
      onBlurCapture={(event) => {
        const nextFocus = event.relatedTarget;
        if (nextFocus instanceof Node && event.currentTarget.contains(nextFocus)) return;
        setRowFocused(false);
      }}
      onContextMenu={(event) => {
        event.preventDefault();
        event.stopPropagation();
        setMenuOpen(true);
      }}
      className={`group relative grid grid-cols-[32px_minmax(0,1fr)_24px] items-start gap-3 rounded-lg px-2 py-1.5 transition hover:bg-slate-50 ${rowLayerClass} ${
        isDragging
          ? 'bg-white opacity-80 shadow-lg'
          : rowHovered || rowFocused || menuOpen || urlOpen
            ? navEditorRowHoverClassName
            : ''
      } ${link.visible ? '' : 'bg-slate-50/60'}`}
    >
      <button
        ref={setActivatorNodeRef}
        type="button"
        aria-label={`Premakni ${link.label || 'povezavo'}`}
        className={adminDragSurfaceTokenClasses}
        {...attributes}
        {...listeners}
      />
      <IconPicker
        icon={link.icon}
        label={`Ikona za ${link.label || 'povezavo'}`}
        highlighted={rowHovered || rowFocused || menuOpen || urlOpen}
        onChange={(icon) => onChange({ icon })}
      />
      <div className="pointer-events-none relative z-10 min-w-0">
        <InlineEditableText
          value={link.label}
          onChange={(label) => onChange({ label })}
          ariaLabel="Naziv povezave"
          className={`block max-w-full truncate px-1 py-0 text-[13px] font-semibold leading-4 ${
            link.visible ? 'text-[var(--navbar-dropdown-title)]' : 'text-slate-400'
          }`}
          style={link.visible ? undefined : { color: '#94a3b8' }}
          inputClassName="w-full font-semibold"
          placeholder="Nova povezava"
        />
        <InlineEditableText
          value={link.description}
          onChange={(description) => onChange({ description })}
          ariaLabel="Opis povezave"
          className={`block max-w-full truncate px-1 py-0 text-[12px] leading-[15px] ${
            link.visible ? 'text-[var(--navbar-dropdown-description)]' : 'text-slate-400'
          }`}
          style={link.visible ? undefined : { color: '#94a3b8' }}
          inputClassName="w-full"
          placeholder="Opis"
        />
        {urlOpen ? (
          <Input
            value={link.href}
            onChange={(event) => onChange({ href: event.target.value })}
            onPointerDown={(event) => event.stopPropagation()}
            className={`${compactInputClassName} pointer-events-auto mt-2 w-full`}
            aria-label="Povezava"
          />
        ) : null}
      </div>
      <div ref={menuRef} className={`relative self-center ${menuOpen ? 'z-[80]' : 'z-10'}`} onPointerDown={(event) => event.stopPropagation()}>
        <button
          type="button"
          aria-label="Možnosti povezave"
          aria-expanded={menuOpen}
          className={`${adminMiniIconButtonTokenClasses} opacity-75 group-hover:opacity-100 ${menuOpen ? '!text-[color:var(--blue-500)]' : ''}`}
          onClick={(event) => {
            event.stopPropagation();
            setMenuOpen((current) => !current);
          }}
        >
          <DotsGlyph className="h-3.5 w-3.5" />
        </button>
        {menuOpen ? (
          <MenuPanel className="absolute right-0 top-full z-[90] mt-1 w-36">
            <button
              type="button"
              className={adminActionMenuItemTokenClasses.flex}
              onClick={(event) => {
                event.stopPropagation();
                onChange({ visible: !link.visible });
                setMenuOpen(false);
              }}
            >
              <span>Prikaži / Skrij</span>
              <EyeGlyph visible={link.visible} className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              className={adminActionMenuItemTokenClasses.base}
              onClick={(event) => {
                event.stopPropagation();
                setUrlOpen((current) => !current);
                setMenuOpen(false);
              }}
            >
              Uredi URL
            </button>
            <DeleteButton label="Izbriši" onDelete={onDelete} menu />
          </MenuPanel>
        ) : null}
      </div>
    </div>
  );
}

function FooterLinkEditor({
  link,
  placement,
  hidden,
  onChange,
  onDelete
}: {
  link: HomepageFooterLink;
  placement: SiteFooterLinkPlacement;
  hidden: boolean;
  onChange: (updates: Partial<HomepageFooterLink>) => void;
  onDelete: () => void;
}) {
  const { attributes, listeners, setActivatorNodeRef, setNodeRef, transform, transition, isDragging } = useSortable({ id: link.id });
  const menuRef = useRef<HTMLDivElement | null>(null);
  const [urlOpen, setUrlOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuDismissRefs = useMemo(() => [menuRef], []);

  useDropdownDismiss({
    open: menuOpen || urlOpen,
    refs: menuDismissRefs,
    onClose: () => {
      setMenuOpen(false);
      setUrlOpen(false);
    }
  });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      onContextMenu={(event) => {
        event.preventDefault();
        event.stopPropagation();
        setMenuOpen(true);
      }}
      className={`group/footer-link relative max-w-full items-center gap-1 rounded-md border border-transparent px-1 transition hover:border-[color:var(--blue-500)]/30 focus-within:border-[color:var(--blue-500)]/40 ${
        placement === 'column'
          ? '-ml-1 grid min-h-7 w-full grid-cols-[minmax(0,1fr)_24px_24px]'
          : 'grid min-h-7 grid-cols-[minmax(0,1fr)_24px_24px]'
      } ${hidden ? 'opacity-50' : ''} ${isDragging ? 'z-20 bg-white opacity-80 shadow-sm' : ''}`}
    >
      <button
        ref={setActivatorNodeRef}
        type="button"
        aria-label={`Premakni ${link.label || 'povezavo v nogi'}`}
        className={adminDragSurfaceTokenClasses}
        {...attributes}
        {...listeners}
      />
      <div className="pointer-events-none relative z-10 flex w-full min-w-0 items-center gap-1">
        <InlineEditableText
          value={link.label}
          onChange={(label) => onChange({ label })}
          ariaLabel="Naziv povezave v nogi"
          className={`site-link block w-full min-w-0 max-w-full truncate px-0.5 py-0 hover:!bg-transparent ${placement === 'column' ? 'text-[13px] leading-5' : 'text-[12px] leading-5'}`}
          inputClassName={placement === 'column' ? 'h-7 w-40 text-[13px]' : 'h-7 w-44 text-[12px]'}
          style={{ textAlign: link.textAlign }}
          placeholder="Nova povezava"
        />
        {hidden ? <span className="shrink-0 text-[10px] font-semibold text-slate-500">Skrito</span> : null}
      </div>
      <FooterTextAlignmentMenu
        value={link.textAlign}
        options={footerShortTextAlignmentOptions}
        onValueChange={(textAlign) => onChange({ textAlign })}
        ariaLabel={`Poravnava povezave ${link.label || 'v nogi'}`}
      />
      <div
        ref={menuRef}
        className={`relative self-center ${menuOpen || urlOpen ? 'z-[80]' : 'z-10'}`}
        onPointerDown={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          aria-label={`Možnosti povezave v nogi ${link.label || ''}`.trim()}
          aria-expanded={menuOpen}
          className={`${adminMiniIconButtonTokenClasses} opacity-75 hover:opacity-100 ${menuOpen || urlOpen ? '!text-[color:var(--blue-500)] !opacity-100' : ''}`}
          onClick={(event) => {
            event.stopPropagation();
            setMenuOpen((current) => !current);
            setUrlOpen(false);
          }}
        >
          <DotsGlyph className="h-3.5 w-3.5" />
        </button>
        {menuOpen ? (
          <MenuPanel className="absolute right-0 top-full z-[90] mt-1 w-36">
            <button
              type="button"
              className={adminActionMenuItemTokenClasses.base}
              onClick={(event) => {
                event.stopPropagation();
                setUrlOpen(true);
                setMenuOpen(false);
              }}
            >
              Uredi povezavo
            </button>
            <button
              type="button"
              className={adminActionMenuItemTokenClasses.flex}
              onClick={(event) => {
                event.stopPropagation();
                onChange({ visible: link.visible === false });
                setMenuOpen(false);
              }}
            >
              <span>{link.visible !== false ? 'Skrij' : 'Prikaži'}</span>
              <EyeGlyph visible={link.visible !== false} className="h-3.5 w-3.5" />
            </button>
            <DeleteButton label="Izbriši" onDelete={onDelete} menu />
          </MenuPanel>
        ) : null}
        {urlOpen ? (
          <MenuPanel className="absolute right-0 top-full z-[90] mt-1 w-64 p-2.5">
            <label className="grid gap-1.5">
              <span className="text-[11px] font-medium text-slate-500">Povezava</span>
              <Input
                autoFocus
                value={link.href}
                onChange={(event) => onChange({ href: event.target.value })}
                className={compactInputClassName}
                aria-label={`Povezava za ${link.label || 'element v nogi'}`}
                placeholder="/povezava"
              />
            </label>
          </MenuPanel>
        ) : null}
      </div>
    </div>
  );
}

function FooterColumnEditor({
  column,
  children,
  sensors,
  onChange,
  onDelete,
  onAddLink,
  onReorderLink
}: {
  column: HomepageFooterColumn;
  children: ReactNode;
  sensors: ReturnType<typeof useSensors>;
  onChange: (updates: Partial<HomepageFooterColumn>) => void;
  onDelete: () => void;
  onAddLink: () => void;
  onReorderLink: (event: DragEndEvent) => void;
}) {
  const linkIds = useMemo(() => column.links.map((link) => link.id), [column.links]);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuDismissRefs = useMemo(() => [menuRef], []);

  useDropdownDismiss({ open: menuOpen, refs: menuDismissRefs, onClose: () => setMenuOpen(false) });

  return (
    <div
      className={`group/footer-column relative -m-2 min-w-0 rounded-lg border border-transparent p-2 transition hover:border-[color:var(--blue-500)]/30 focus-within:border-[color:var(--blue-500)]/40 ${
        column.visible === false ? 'opacity-50' : ''
      }`}
    >
      {column.visible === false ? (
        <span className="absolute -top-2 left-1 rounded-md bg-slate-700 px-1.5 py-0.5 text-[10px] font-semibold leading-none text-white">
          Skrito
        </span>
      ) : null}
      <div className="absolute right-4 top-1.5 z-30 flex items-center gap-0.5">
        <FooterTextAlignmentMenu
          value={column.titleTextAlign}
          options={footerShortTextAlignmentOptions}
          onValueChange={(titleTextAlign) => onChange({ titleTextAlign })}
          ariaLabel={`Poravnava naslova ${column.title || 'stolpca'}`}
        />
        <div ref={menuRef} className="relative">
          <button
            type="button"
            aria-label={`Možnosti stolpca ${column.title || ''}`.trim()}
            aria-expanded={menuOpen}
            className={adminMiniIconButtonTokenClasses}
            onClick={() => setMenuOpen((current) => !current)}
          >
            <DotsGlyph className="h-3.5 w-3.5" />
          </button>
          {menuOpen ? (
            <MenuPanel className="absolute right-0 top-full z-[90] mt-1 w-36">
              <button
                type="button"
                className={adminActionMenuItemTokenClasses.flex}
                onClick={() => {
                  onChange({ visible: column.visible === false });
                  setMenuOpen(false);
                }}
              >
                <span>{column.visible !== false ? 'Skrij' : 'Prikaži'}</span>
                <EyeGlyph visible={column.visible !== false} className="h-3.5 w-3.5" />
              </button>
              <DeleteButton label="Izbriši" onDelete={onDelete} menu />
            </MenuPanel>
          ) : null}
        </div>
      </div>

      <DndContext
        id={`site-footer-column-links-${column.id}`}
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={onReorderLink}
      >
        <SortableContext items={linkIds} strategy={verticalListSortingStrategy}>
          <div>{children}</div>
        </SortableContext>
      </DndContext>

      <IconButton
        type="button"
        size="sm"
        tone="neutral"
        className={`mt-3 !h-7 !w-7 ${adminTableNeutralIconButtonClassName}`}
        aria-label={`Dodaj povezavo v ${column.title || 'stolpec'}`}
        title="Dodaj povezavo"
        onClick={onAddLink}
      >
        <PlusIcon />
      </IconButton>
    </div>
  );
}

function FooterSocialLinkEditor({
  link,
  icon,
  hidden,
  onChange,
  onDelete
}: {
  link: HomepageFooterSocialLink;
  icon: ReactNode;
  hidden: boolean;
  onChange: (updates: Partial<HomepageFooterSocialLink>) => void;
  onDelete: () => void;
}) {
  const { attributes, listeners, setActivatorNodeRef, setNodeRef, transform, transition, isDragging } = useSortable({ id: link.id });
  const menuRef = useRef<HTMLDivElement | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuDismissRefs = useMemo(() => [menuRef], []);

  useDropdownDismiss({
    open: menuOpen,
    refs: menuDismissRefs,
    ignoreSelector: '[data-appearance-editor-compact-select-portal]',
    ignoreEscapeSelector: '[data-appearance-editor-compact-select-portal]',
    onClose: () => setMenuOpen(false)
  });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      onContextMenu={(event) => {
        event.preventDefault();
        event.stopPropagation();
        setMenuOpen(true);
      }}
      className={`group/footer-social relative inline-grid grid-cols-[32px_24px] items-center justify-items-center gap-0.5 rounded-md border border-transparent p-0.5 transition hover:border-[color:var(--blue-500)]/30 focus-within:border-[color:var(--blue-500)]/40 ${hidden ? 'opacity-50' : ''} ${isDragging ? 'z-20 bg-white opacity-80 shadow-sm' : ''}`}
    >
      <button
        ref={setActivatorNodeRef}
        type="button"
        aria-label={`Premakni družbeno omrežje ${link.label || homepageSocialTypeLabels[link.type]}`}
        className={adminDragSurfaceTokenClasses}
        {...attributes}
        {...listeners}
      />
      <div
        aria-hidden="true"
        className={`site-link pointer-events-none relative z-10 grid h-8 w-8 place-items-center rounded-[var(--site-radius-md,0.5rem)] border border-[color:var(--site-divider-color)] no-underline transition ${menuOpen ? '!border-[color:var(--site-link-hover)]' : ''}`}
      >
        {icon}
      </div>
      {hidden ? (
        <span className="pointer-events-none absolute -top-2 left-1/2 z-20 -translate-x-1/2 rounded-md bg-slate-700 px-1 py-0.5 text-[9px] font-semibold leading-none text-white">
          Skrito
        </span>
      ) : null}
      <div ref={menuRef} className="relative z-30 self-center">
        <button
          type="button"
          aria-label={`Možnosti družbenega omrežja ${link.label || homepageSocialTypeLabels[link.type]}`}
          aria-expanded={menuOpen}
          className={`${adminMiniIconButtonTokenClasses} opacity-75 hover:opacity-100 ${menuOpen ? '!text-[color:var(--blue-500)] !opacity-100' : ''}`}
          onClick={(event) => {
            event.stopPropagation();
            setMenuOpen((current) => !current);
          }}
        >
          <DotsGlyph className="h-3 w-3" />
        </button>
        {menuOpen ? (
          <MenuPanel className="absolute right-0 top-full z-[90] mt-1 w-64 p-2.5">
            <div className="grid gap-2.5">
              <div className="grid gap-1">
                <span className="text-[11px] font-medium text-slate-500">Omrežje</span>
                <AppearanceEditorCompactSelect
                  value={link.type}
                  options={HOMEPAGE_SOCIAL_TYPES.map((type) => ({ value: type, label: homepageSocialTypeLabels[type] }))}
                  ariaLabel={`Omrežje za ${link.label || 'profil'}`}
                  marker={`footer-social-${link.id}`}
                  onValueChange={(type) => onChange({ type: type as HomepageFooterSocialLink['type'] })}
                />
              </div>
              <label className="grid gap-1.5">
                <span className="text-[11px] font-medium text-slate-500">Naziv</span>
                <Input
                  value={link.label}
                  onChange={(event) => onChange({ label: event.target.value })}
                  className={compactInputClassName}
                  aria-label="Naziv družbenega profila"
                  placeholder="Naziv"
                />
              </label>
              <label className="grid gap-1.5">
                <span className="text-[11px] font-medium text-slate-500">Povezava</span>
                <Input
                  value={link.href}
                  onChange={(event) => onChange({ href: event.target.value })}
                  className={compactInputClassName}
                  aria-label={`Povezava za ${link.label || 'profil'}`}
                  placeholder="https://..."
                />
              </label>
              <div className="border-t border-slate-100 pt-1">
                <button
                  type="button"
                  className={adminActionMenuItemTokenClasses.flex}
                  onClick={() => {
                    onChange({ visible: link.visible === false });
                    setMenuOpen(false);
                  }}
                >
                  <span>{link.visible !== false ? 'Skrij' : 'Prikaži'}</span>
                  <EyeGlyph visible={link.visible !== false} className="h-3.5 w-3.5" />
                </button>
                <DeleteButton label="Izbriši" onDelete={onDelete} menu />
              </div>
            </div>
          </MenuPanel>
        ) : null}
      </div>
    </div>
  );
}

const footerContactFieldMeta: Record<SiteFooterContactField, { label: string; placeholder: string }> = {
  email: { label: 'E-pošta', placeholder: 'info@atehna.si' },
  phone: { label: 'Telefon', placeholder: '+386 1 234 56 78' },
  address: { label: 'Naslov', placeholder: 'Ulica in kraj' },
  workingHours: { label: 'Delovni čas', placeholder: 'Pon–Pet 8.00–16.00' }
};

function GroupEditor({
  group,
  desktopPageNumber,
  sensors,
  onChange,
  onDelete,
  onAddLink,
  onUpdateLink,
  onDeleteLink,
  onReorderLink
}: {
  group: SiteNavigationGroup;
  desktopPageNumber: number;
  sensors: ReturnType<typeof useSensors>;
  onChange: (updates: Partial<SiteNavigationGroup>) => void;
  onDelete: () => void;
  onAddLink: () => void;
  onUpdateLink: (linkId: string, updates: Partial<SiteNavigationLink>) => void;
  onDeleteLink: (linkId: string) => void;
  onReorderLink: (event: DragEndEvent) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: group.id });
  const linkIds = useMemo(() => group.links.map((link) => link.id), [group.links]);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const [urlOpen, setUrlOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const columnCount = toGroupColumnCount(group.desktopSpan);
  const menuDismissRefs = useMemo(() => [menuRef], []);

  useDropdownDismiss({ open: menuOpen, refs: menuDismissRefs, onClose: () => setMenuOpen(false) });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      data-navigation-group-hidden={group.visible ? undefined : 'true'}
      className={`group min-w-0 transition ${groupColumnSpanClassNames[columnCount]} ${isDragging ? 'z-20 opacity-80' : ''}`}
    >
      <div
        className="px-2 py-1"
        onContextMenu={(event) => {
          event.preventDefault();
          event.stopPropagation();
          setMenuOpen(true);
        }}
      >
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex min-w-0 flex-1 items-center gap-1.5">
            <div className="min-w-0 shrink">
              <InlineEditableText
                value={group.label}
                onChange={(label) => onChange({ label })}
                ariaLabel="Naziv skupine"
                className={`block max-w-full truncate px-1 py-0 text-[12px] font-medium leading-4 ${
                  group.visible ? 'text-[var(--navbar-dropdown-heading)]' : 'text-slate-400'
                }`}
                inputClassName="w-full font-medium"
                placeholder="Skupina"
              />
            </div>
            {desktopPageNumber > 1 ? (
              <span className="shrink-0 rounded-md border border-[color:var(--blue-500)]/25 bg-[color:var(--blue-50)] px-1.5 py-0.5 text-[10px] font-medium leading-none text-[color:var(--blue-500)]">
                Stran {desktopPageNumber}
              </span>
            ) : null}
          </div>
          <div className="flex shrink-0 items-center gap-1 opacity-75 transition group-hover:opacity-100 focus-within:opacity-100">
            <input
              type="text"
              inputMode="numeric"
              pattern="[1-4]"
              maxLength={1}
              value={columnCount}
              onClick={(event) => event.stopPropagation()}
              onChange={(event) => {
                const nextColumnCount = parseGroupColumnCount(event.target.value);
                if (nextColumnCount) onChange({ desktopSpan: nextColumnCount });
              }}
              aria-label="Število stolpcev"
              title="Število stolpcev"
              className={columnCountInputClassName}
            />
            <div ref={menuRef} className="relative">
              <button
                type="button"
                aria-label="Možnosti skupine"
                aria-expanded={menuOpen}
                className={`${adminMiniIconButtonTokenClasses} opacity-75 group-hover:opacity-100 ${menuOpen ? '!text-[color:var(--blue-500)]' : ''}`}
                onClick={(event) => {
                  event.stopPropagation();
                  setMenuOpen((current) => !current);
                }}
              >
                <DotsGlyph className="h-3.5 w-3.5" />
              </button>
              {menuOpen ? (
                <MenuPanel className="absolute left-0 top-full z-30 mt-1 w-40">
                <button
                  type="button"
                  className={adminActionMenuItemTokenClasses.flex}
                  onClick={(event) => {
                    event.stopPropagation();
                    onChange({ visible: !group.visible });
                    setMenuOpen(false);
                  }}
                >
                  <span>{group.visible ? 'Skrij skupino' : 'Prikaži skupino'}</span>
                  <EyeGlyph visible={group.visible} className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  className={adminActionMenuItemTokenClasses.base}
                  onClick={(event) => {
                    event.stopPropagation();
                    setUrlOpen((current) => !current);
                    setMenuOpen(false);
                  }}
                >
                  Uredi URL
                </button>
                <button
                  type="button"
                  className={adminActionMenuItemTokenClasses.drag}
                  {...attributes}
                  {...listeners}
                >
                  Premakni
                </button>
                <DeleteButton label="Izbriši" onDelete={onDelete} menu />
              </MenuPanel>
            ) : null}
            </div>
          </div>
        </div>
        {urlOpen ? (
          <div className="mt-2 max-w-sm">
            <Input
              value={group.href}
              onChange={(event) => onChange({ href: event.target.value })}
              className={compactInputClassName}
              aria-label="Povezava skupine"
              placeholder="Povezava skupine"
            />
          </div>
        ) : null}
      </div>
      <DndContext id={`site-navigation-links-${group.id}`} sensors={sensors} collisionDetection={closestCenter} onDragEnd={onReorderLink}>
        <SortableContext items={linkIds} strategy={rectSortingStrategy}>
          <div
            className={`mt-2 grid gap-x-1 gap-y-[var(--navbar-dropdown-selection-row-gap)] transition-opacity ${
              group.visible ? '' : 'opacity-50'
            } ${groupLinkGridClassNames[columnCount]}`}
          >
            {group.links.map((link) => (
              <LinkEditor
                key={link.id}
                link={link}
                onChange={(updates) => onUpdateLink(link.id, updates)}
                onDelete={() => onDeleteLink(link.id)}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>
      <div className="mt-3 pl-2">
        <IconButton
          type="button"
          size="sm"
          tone="neutral"
          className={adminTableNeutralIconButtonClassName}
          aria-label="Dodaj povezavo"
          title="Dodaj povezavo"
          onClick={onAddLink}
        >
          <PlusIcon />
        </IconButton>
      </div>
    </div>
  );
}

export default function AdminNavigationPageClient({
  initialConfig,
  initialGlobalStyle
}: {
  initialConfig: SiteNavigationConfig;
  initialGlobalStyle: GlobalStyleConfig;
}) {
  const { toast } = useToast();
  const normalizedInitialConfig = useMemo(() => normalizeSiteNavigationConfig(initialConfig), [initialConfig]);
  const normalizedInitialConfigKey = useMemo(() => comparable(normalizedInitialConfig), [normalizedInitialConfig]);
  const [config, setConfig] = useState(normalizedInitialConfig);
  const [savedConfig, setSavedConfig] = useState(normalizedInitialConfig);
  const [selectedItemId, setSelectedItemId] = useState(() => normalizedInitialConfig.items[0]?.id ?? '');
  const [topLinkEditorId, setTopLinkEditorId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const appliedInitialConfigKeyRef = useRef(normalizedInitialConfigKey);
  const saveInFlightRef = useRef(false);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  useEffect(() => {
    if (appliedInitialConfigKeyRef.current === normalizedInitialConfigKey) return;
    appliedInitialConfigKeyRef.current = normalizedInitialConfigKey;
    setConfig(normalizedInitialConfig);
    setSavedConfig(normalizedInitialConfig);
    setSelectedItemId((current) => {
      if (normalizedInitialConfig.items.some((item) => item.id === current)) return current;
      return normalizedInitialConfig.items[0]?.id ?? '';
    });
  }, [normalizedInitialConfig, normalizedInitialConfigKey]);

  const selectedItem = useMemo(
    () => config.items.find((item) => item.id === selectedItemId) ?? config.items[0] ?? null,
    [config.items, selectedItemId]
  );
  const configComparable = useMemo(() => comparable(config), [config]);
  const savedConfigComparable = useMemo(() => comparable(savedConfig), [savedConfig]);
  const isDirty = configComparable !== savedConfigComparable;
  const topLevelIds = useMemo(() => config.items.map((item) => item.id), [config.items]);
  const footerSocialLinkIds = useMemo(() => config.footer.socialLinks.map((link) => link.id), [config.footer.socialLinks]);
  const footerLegalLinkIds = useMemo(() => config.footer.legalLinks.map((link) => link.id), [config.footer.legalLinks]);
  const footerPreviewVars = useMemo(() => ({
    ...toGlobalStyleCssVariables(initialGlobalStyle),
    '--site-content-max-width': `${config.siteLayout.siteContentMaxWidthPx}px`,
    '--site-gutter-min': `${config.siteLayout.siteGutterMinPx}px`,
    '--site-gutter-max': `${config.siteLayout.siteGutterMaxPx}px`,
    '--site-gutter': `clamp(${config.siteLayout.siteGutterMinPx}px, 4vw, ${config.siteLayout.siteGutterMaxPx}px)`
  }) as CSSProperties, [config.siteLayout, initialGlobalStyle]);
  const selectedGroupIds = useMemo(() => selectedItem?.groups.map((group) => group.id) ?? [], [selectedItem]);
  const selectedGroupEntries = useMemo(() => {
    if (!selectedItem) return [];
    const placements = getSiteNavigationDesktopGroupPlacements(selectedItem.groups);
    let previousPageIndex = 0;

    return selectedItem.groups.map((group, index) => {
      const placement = placements[group.id] ?? {
        pageIndex: 0,
        pageNumber: 1,
        slotIndex: index,
        slotSpan: 1
      } satisfies SiteNavigationDesktopGroupPlacement;
      const startsLaterPage = index > 0 && placement.pageIndex > previousPageIndex;
      previousPageIndex = placement.pageIndex;

      return {
        group,
        placement,
        startsLaterPage
      };
    });
  }, [selectedItem]);
  const topLinkEditorItem = useMemo(
    () => config.items.find((item) => item.id === topLinkEditorId) ?? null,
    [config.items, topLinkEditorId]
  );

  useEffect(() => {
    if (topLinkEditorId && !config.items.some((item) => item.id === topLinkEditorId)) {
      setTopLinkEditorId(null);
    }
  }, [config.items, topLinkEditorId]);

  function updateConfig(updater: (current: SiteNavigationConfig) => SiteNavigationConfig) {
    setConfig((current) => normalizeSiteNavigationConfig(updater(current)));
  }

  function updateTopBarLayout(updater: (current: SiteNavigationTopBarLayout) => SiteNavigationTopBarLayout) {
    updateConfig((current) => ({
      ...current,
      topBarLayout: updater(current.topBarLayout)
    }));
  }

  function updateSiteLayout(updates: Partial<SiteNavigationSiteLayoutSettings>) {
    updateConfig((current) => ({
      ...current,
      siteLayout: {
        ...current.siteLayout,
        ...updates
      }
    }));
  }

  function updateTopItem(itemId: string, updates: Partial<SiteNavigationTopLevelItem>) {
    updateConfig((current) => ({
      ...current,
      items: current.items.map((item) => (item.id === itemId ? { ...item, ...updates } : item))
    }));
  }

  function updateFooter(updates: Partial<HomepageFooterSettings>) {
    updateConfig((current) => ({
      ...current,
      footer: { ...current.footer, ...updates }
    }));
  }

  function updateFooterContact(updates: Partial<HomepageFooterContact>) {
    updateConfig((current) => ({
      ...current,
      footer: {
        ...current.footer,
        contact: { ...current.footer.contact, ...updates }
      }
    }));
  }

  function updateFooterColumn(columnId: string, updates: Partial<HomepageFooterColumn>) {
    updateConfig((current) => ({
      ...current,
      footer: {
        ...current.footer,
        columns: current.footer.columns.map((column) => column.id === columnId ? { ...column, ...updates } : column)
      }
    }));
  }

  function addFooterColumn() {
    updateConfig((current) => ({
      ...current,
      footer: {
        ...current.footer,
        columns: [
          ...current.footer.columns,
          {
            id: createId('footer-column'),
            title: 'Nov stolpec',
            titleTextAlign: 'left',
            links: [],
            visible: true,
            position: current.footer.columns.length
          }
        ]
      }
    }));
  }

  function deleteFooterColumn(columnId: string) {
    updateConfig((current) => ({
      ...current,
      footer: {
        ...current.footer,
        columns: withPositions(current.footer.columns.filter((column) => column.id !== columnId))
      }
    }));
  }

  function updateFooterColumnLink(columnId: string, linkId: string, updates: Partial<HomepageFooterLink>) {
    updateConfig((current) => ({
      ...current,
      footer: {
        ...current.footer,
        columns: current.footer.columns.map((column) => column.id === columnId
          ? { ...column, links: column.links.map((link) => link.id === linkId ? { ...link, ...updates } : link) }
          : column)
      }
    }));
  }

  function addFooterColumnLink(columnId: string) {
    updateConfig((current) => ({
      ...current,
      footer: {
        ...current.footer,
        columns: current.footer.columns.map((column) => column.id === columnId
          ? {
              ...column,
              links: [
                ...column.links,
                {
                  id: createId('footer-link'),
                  label: 'Nova povezava',
                  href: '#',
                  textAlign: 'left',
                  visible: true,
                  position: column.links.length
                }
              ]
            }
          : column)
      }
    }));
  }

  function deleteFooterColumnLink(columnId: string, linkId: string) {
    updateConfig((current) => ({
      ...current,
      footer: {
        ...current.footer,
        columns: current.footer.columns.map((column) => column.id === columnId
          ? { ...column, links: withPositions(column.links.filter((link) => link.id !== linkId)) }
          : column)
      }
    }));
  }

  function updateFooterSocialLink(linkId: string, updates: Partial<HomepageFooterSocialLink>) {
    updateConfig((current) => ({
      ...current,
      footer: {
        ...current.footer,
        socialLinks: current.footer.socialLinks.map((link) => link.id === linkId ? { ...link, ...updates } : link)
      }
    }));
  }

  function addFooterSocialLink() {
    updateConfig((current) => ({
      ...current,
      footer: {
        ...current.footer,
        socialLinks: [
          ...current.footer.socialLinks,
          {
            id: createId('footer-social'),
            type: 'custom',
            label: 'Nov profil',
            href: '#',
            visible: true,
            position: current.footer.socialLinks.length
          }
        ]
      }
    }));
  }

  function deleteFooterSocialLink(linkId: string) {
    updateConfig((current) => ({
      ...current,
      footer: {
        ...current.footer,
        socialLinks: withPositions(current.footer.socialLinks.filter((link) => link.id !== linkId))
      }
    }));
  }

  function updateFooterLegalLink(linkId: string, updates: Partial<HomepageFooterLink>) {
    updateConfig((current) => ({
      ...current,
      footer: {
        ...current.footer,
        legalLinks: current.footer.legalLinks.map((link) => link.id === linkId ? { ...link, ...updates } : link)
      }
    }));
  }

  function addFooterLegalLink() {
    updateConfig((current) => ({
      ...current,
      footer: {
        ...current.footer,
        legalLinks: [
          ...current.footer.legalLinks,
          {
            id: createId('footer-legal'),
            label: 'Nova pravna povezava',
            href: '#',
            textAlign: 'left',
            visible: true,
            position: current.footer.legalLinks.length
          }
        ]
      }
    }));
  }

  function deleteFooterLegalLink(linkId: string) {
    updateConfig((current) => ({
      ...current,
      footer: {
        ...current.footer,
        legalLinks: withPositions(current.footer.legalLinks.filter((link) => link.id !== linkId))
      }
    }));
  }

  function updateGroup(groupId: string, updates: Partial<SiteNavigationGroup>) {
    if (!selectedItem) return;
    updateConfig((current) => ({
      ...current,
      items: current.items.map((item) =>
        item.id === selectedItem.id
          ? {
              ...item,
              groups: item.groups.map((group) => (group.id === groupId ? { ...group, ...updates } : group))
            }
          : item
      )
    }));
  }

  function updateLink(groupId: string, linkId: string, updates: Partial<SiteNavigationLink>) {
    if (!selectedItem) return;
    updateConfig((current) => ({
      ...current,
      items: current.items.map((item) =>
        item.id === selectedItem.id
          ? {
              ...item,
              groups: item.groups.map((group) =>
                group.id === groupId
                  ? {
                      ...group,
                      links: group.links.map((link) => (link.id === linkId ? { ...link, ...updates } : link))
                    }
                  : group
              )
            }
          : item
      )
    }));
  }

  function addTopItem() {
    const id = createId('nav');
    updateConfig((current) => ({
      ...current,
      items: [
        ...current.items,
        {
          id,
          label: 'Nov element',
          href: '',
          visible: true,
          position: current.items.length,
          groups: []
        }
      ]
    }));
    setSelectedItemId(id);
    setTopLinkEditorId(id);
  }

  function deleteTopItem(itemId: string) {
    updateConfig((current) => {
      const remainingItems = withPositions(current.items.filter((item) => item.id !== itemId));
      return { ...current, items: remainingItems };
    });
    if (selectedItemId === itemId) {
      const nextItem = config.items.find((item) => item.id !== itemId);
      setSelectedItemId(nextItem?.id ?? '');
    }
    if (topLinkEditorId === itemId) setTopLinkEditorId(null);
  }

  function addGroup() {
    if (!selectedItem) return;
    const id = createId('group');
    updateConfig((current) => ({
      ...current,
      items: current.items.map((item) =>
        item.id === selectedItem.id
          ? {
              ...item,
              groups: [
                ...item.groups,
                {
                  id,
                  label: 'Nova skupina',
                  href: '',
                  visible: true,
                  position: item.groups.length,
                  desktopSpan: 1,
                  links: []
                }
              ]
            }
          : item
      )
    }));
  }

  function deleteGroup(groupId: string) {
    if (!selectedItem) return;
    updateConfig((current) => ({
      ...current,
      items: current.items.map((item) =>
        item.id === selectedItem.id
          ? {
              ...item,
              groups: withPositions(item.groups.filter((group) => group.id !== groupId))
            }
          : item
      )
    }));
  }

  function addLink(groupId: string) {
    if (!selectedItem) return;
    updateConfig((current) => ({
      ...current,
      items: current.items.map((item) =>
        item.id === selectedItem.id
          ? {
              ...item,
              groups: item.groups.map((group) =>
                group.id === groupId
                  ? {
                      ...group,
                      links: [
                        ...group.links,
                        {
                          id: createId('link'),
                          label: 'Nova povezava',
                          description: '',
                          href: '#',
                          icon: 'box',
                          visible: true,
                          position: group.links.length
                        }
                      ]
                    }
                  : group
              )
            }
          : item
      )
    }));
  }

  function deleteLink(groupId: string, linkId: string) {
    if (!selectedItem) return;
    updateConfig((current) => ({
      ...current,
      items: current.items.map((item) =>
        item.id === selectedItem.id
          ? {
              ...item,
              groups: item.groups.map((group) =>
                group.id === groupId
                  ? {
                      ...group,
                      links: withPositions(group.links.filter((link) => link.id !== linkId))
                    }
                  : group
              )
            }
          : item
      )
    }));
  }

  function handleTopDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    updateConfig((current) => ({
      ...current,
      items: reorderById(current.items, String(active.id), String(over.id))
    }));
  }

  function handleFooterColumnLinkDragEnd(columnId: string) {
    return (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;
      updateConfig((current) => ({
        ...current,
        footer: {
          ...current.footer,
          columns: current.footer.columns.map((column) => column.id === columnId
            ? { ...column, links: reorderById(column.links, String(active.id), String(over.id)) }
            : column)
        }
      }));
    };
  }

  function handleFooterSocialLinkDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    updateConfig((current) => ({
      ...current,
      footer: {
        ...current.footer,
        socialLinks: reorderById(current.footer.socialLinks, String(active.id), String(over.id))
      }
    }));
  }

  function handleFooterLegalLinkDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    updateConfig((current) => ({
      ...current,
      footer: {
        ...current.footer,
        legalLinks: reorderById(current.footer.legalLinks, String(active.id), String(over.id))
      }
    }));
  }

  function handleGroupDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!selectedItem || !over || active.id === over.id) return;
    updateConfig((current) => ({
      ...current,
      items: current.items.map((item) =>
        item.id === selectedItem.id
          ? {
              ...item,
              groups: reorderById(item.groups, String(active.id), String(over.id))
            }
          : item
      )
    }));
  }

  function handleLinkDragEnd(groupId: string) {
    return (event: DragEndEvent) => {
      const { active, over } = event;
      if (!selectedItem || !over || active.id === over.id) return;
      updateConfig((current) => ({
        ...current,
        items: current.items.map((item) =>
          item.id === selectedItem.id
            ? {
                ...item,
                groups: item.groups.map((group) =>
                  group.id === groupId
                    ? {
                        ...group,
                        links: reorderById(group.links, String(active.id), String(over.id))
                      }
                    : group
                )
              }
            : item
        )
      }));
    };
  }

  function resetMainMenuToDefaults() {
    const defaults = normalizeSiteNavigationConfig(cloneDefaultSiteNavigationConfig());
    updateConfig((current) => ({ ...current, items: defaults.items }));
    setSelectedItemId(defaults.items[0]?.id ?? '');
  }

  async function persistConfig(
    nextConfig: SiteNavigationConfig,
    successMessage: string,
    mergePersistedIntoCurrent?: (
      current: SiteNavigationConfig,
      persisted: SiteNavigationConfig
    ) => SiteNavigationConfig
  ) {
    if (saveInFlightRef.current) return;
    const payloadConfig = normalizeSiteNavigationConfig(nextConfig);
    const sourceConfigKey = comparable(config);

    saveInFlightRef.current = true;
    setIsSaving(true);
    try {
      const response = await fetch('/api/admin/site-navigation', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ config: payloadConfig })
      });

      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(typeof body.message === 'string' ? body.message : 'Shranjevanje navigacije ni uspelo.');
      }

      const persistedConfig = normalizeSiteNavigationConfig(body.config ?? payloadConfig);
      appliedInitialConfigKeyRef.current = comparable(persistedConfig);
      setSavedConfig(persistedConfig);
      setConfig((current) => {
        if (comparable(current) === sourceConfigKey) return persistedConfig;
        if (mergePersistedIntoCurrent) {
          return normalizeSiteNavigationConfig(mergePersistedIntoCurrent(current, persistedConfig));
        }
        return normalizeSiteNavigationConfig({ ...current, updatedAt: persistedConfig.updatedAt });
      });
      toast.success(successMessage);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Shranjevanje navigacije ni uspelo.');
    } finally {
      saveInFlightRef.current = false;
      setIsSaving(false);
    }
  }

  async function save() {
    await persistConfig(config, 'Navigacija je shranjena.');
  }

  async function setCurrentTopBarAsDefaults(layout: SiteNavigationTopBarLayout) {
    await persistConfig(
      {
        ...config,
        topBarInitialLayout: cloneTopBarLayout(layout)
      },
      'Privzete nastavitve zgornje vrstice so shranjene.',
      (current, persisted) => ({
        ...current,
        topBarInitialLayout: cloneTopBarLayout(persisted.topBarInitialLayout),
        updatedAt: persisted.updatedAt
      })
    );
  }

  const footerEditorAdapter = {
    forceVisible: true,
    showHidden: true,
    showEmpty: true,
    renderSurface: ({ defaultNode, hidden }) => (
      <div
        data-admin-editor-preview-surface="true"
        className={`${adminEditorPreviewSurfaceTokenClasses} ${hidden ? '[&>footer]:opacity-50' : ''}`}
      >
        {defaultNode}
        {hidden ? (
          <span className="absolute right-3 top-3 z-20 rounded-md bg-slate-800 px-2 py-1 text-[11px] font-semibold leading-none text-white">
            Skrito na spletni strani
          </span>
        ) : null}
      </div>
    ),
    renderUpperSection: ({ defaultNode, hidden }) => (
      <div
        data-admin-footer-section-preview="upper"
        data-admin-footer-section-hidden={hidden ? 'true' : 'false'}
        className={hidden ? 'opacity-45' : undefined}
      >
        {defaultNode}
      </div>
    ),
    renderLowerSection: ({ defaultNode, hidden }) => (
      <div
        data-admin-footer-section-preview="lower"
        data-admin-footer-section-hidden={hidden ? 'true' : 'false'}
        className={hidden ? 'opacity-45' : undefined}
      >
        {defaultNode}
      </div>
    ),
    renderLogo: ({ logo }) => (
      <span data-testid="site-footer-shared-logo" className="inline-flex max-w-full">
        {logo}
      </span>
    ),
    renderDescription: ({ value }) => (
      <div className="mt-4 grid max-w-xs grid-cols-[minmax(0,1fr)_24px] items-start gap-1">
        <InlineEditableText
          value={value}
          onChange={(description) => updateFooter({ description })}
          ariaLabel="Opis noge"
          className="site-paragraph block w-full max-w-xs px-1 py-0 text-[13px] leading-6"
          inputClassName="h-8 w-full max-w-xs text-[13px]"
          style={{ textAlign: config.footer.descriptionTextAlign }}
          placeholder="Dodajte kratek opis podjetja"
        />
        <FooterTextAlignmentMenu
          value={config.footer.descriptionTextAlign}
          options={footerTextAlignmentOptions}
          onValueChange={(descriptionTextAlign) => updateFooter({ descriptionTextAlign })}
          ariaLabel="Poravnava opisa noge"
        />
      </div>
    ),
    renderColumns: ({ defaultNode }) => (
      <div className="flex min-w-0 items-start gap-1.5">
        <div className="min-w-0 flex-1">{defaultNode}</div>
        <IconButton
          type="button"
          size="sm"
          tone="neutral"
          className={`-mt-1 !h-7 !w-7 shrink-0 ${adminTableNeutralIconButtonClassName}`}
          aria-label="Dodaj stolpec v nogo"
          title="Dodaj stolpec"
          onClick={addFooterColumn}
        >
          <PlusIcon />
        </IconButton>
      </div>
    ),
    renderColumn: ({ column, children }) => (
      <FooterColumnEditor
        column={column}
        sensors={sensors}
        onChange={(updates) => updateFooterColumn(column.id, updates)}
        onDelete={() => deleteFooterColumn(column.id)}
        onAddLink={() => addFooterColumnLink(column.id)}
        onReorderLink={handleFooterColumnLinkDragEnd(column.id)}
      >
        {children}
      </FooterColumnEditor>
    ),
    renderColumnTitle: ({ column, value }) => (
      <h2
        className="pr-14 text-[13px] font-semibold text-[color:var(--site-color-text)]"
        style={{ textAlign: column.titleTextAlign }}
      >
        <InlineEditableText
          value={value}
          onChange={(title) => updateFooterColumn(column.id, { title })}
          ariaLabel="Naslov stolpca v nogi"
          className="block w-full max-w-full truncate px-0.5 py-0 text-[13px] font-semibold leading-5"
          inputClassName="h-7 w-full font-semibold"
          style={{ textAlign: column.titleTextAlign }}
          placeholder="Naslov stolpca"
        />
      </h2>
    ),
    renderLink: ({ placement, link, column, hidden }) => (
      <FooterLinkEditor
        link={link}
        placement={placement}
        hidden={hidden}
        onChange={(updates) => {
          if (placement === 'column' && column) updateFooterColumnLink(column.id, link.id, updates);
          else updateFooterLegalLink(link.id, updates);
        }}
        onDelete={() => {
          if (placement === 'column' && column) deleteFooterColumnLink(column.id, link.id);
          else deleteFooterLegalLink(link.id);
        }}
      />
    ),
    renderContact: ({ defaultNode }) => (
      <div
        className="relative flex min-w-0 items-start gap-1"
        style={{ textAlign: config.footer.contact.textAlign }}
      >
        <div className="min-w-0 flex-1">{defaultNode}</div>
        <FooterTextAlignmentMenu
          value={config.footer.contact.textAlign}
          options={footerShortTextAlignmentOptions}
          onValueChange={(textAlign) => updateFooterContact({ textAlign })}
          ariaLabel="Poravnava kontakta v nogi"
        />
      </div>
    ),
    renderLowerContact: ({ defaultNode, hidden }) => (
      <div
        data-admin-footer-lower-contact-preview="true"
        className={`relative flex w-full min-w-0 basis-full items-center gap-1 ${hidden ? 'opacity-45' : ''}`}
        style={{ textAlign: config.footer.contact.textAlign }}
      >
        <div className="min-w-0 flex-1">{defaultNode}</div>
        <FooterTextAlignmentMenu
          value={config.footer.contact.textAlign}
          options={footerShortTextAlignmentOptions}
          onValueChange={(textAlign) => updateFooterContact({ textAlign })}
          ariaLabel="Poravnava spodnjega kontakta v nogi"
        />
      </div>
    ),
    renderContactField: ({ field, value }) => {
      const meta = footerContactFieldMeta[field];
      return (
        <InlineEditableText
          value={value}
          onChange={(nextValue) => updateFooterContact({ [field]: nextValue })}
          ariaLabel={meta.label}
          className={`block max-w-[220px] truncate px-0.5 py-0 text-[13px] leading-5 ${field === 'email' ? 'site-link hover:!bg-transparent' : ''}`}
          inputClassName="h-7 w-[220px] text-[13px]"
          style={{ textAlign: config.footer.contact.textAlign }}
          placeholder={meta.placeholder}
        />
      );
    },
    renderSocial: ({ headingNode, linkNodes }) => (
      <section className="relative mt-5" aria-labelledby="site-footer-social-heading">
        {headingNode}
        <DndContext
          id="site-navigation-footer-social-links"
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleFooterSocialLinkDragEnd}
        >
          <SortableContext items={footerSocialLinkIds} strategy={rectSortingStrategy}>
            <div className="mt-3 flex min-h-9 flex-wrap items-center gap-1.5">
              {linkNodes}
              <IconButton
                type="button"
                size="sm"
                tone="neutral"
                className="!h-9 !w-9 shrink-0 self-start"
                aria-label="Dodaj družbeni profil"
                title="Dodaj profil"
                onClick={addFooterSocialLink}
              >
                <PlusIcon />
              </IconButton>
            </div>
          </SortableContext>
        </DndContext>
      </section>
    ),
    renderSocialLink: ({ link, icon, hidden }) => (
      <FooterSocialLinkEditor
        link={link}
        icon={icon}
        hidden={hidden}
        onChange={(updates) => updateFooterSocialLink(link.id, updates)}
        onDelete={() => deleteFooterSocialLink(link.id)}
      />
    ),
    renderCopyright: ({ rawValue, resolvedValue }) => (
      <div className="flex min-w-0 max-w-full items-center gap-1">
        <InlineEditableText
          value={rawValue}
          displayValue={resolvedValue}
          onChange={(copyright) => updateFooter({ copyright })}
          ariaLabel="Copyright"
          className="block min-h-7 w-[320px] max-w-full truncate px-0.5 py-1 text-[12px] leading-5"
          inputClassName="h-7 w-[320px] text-[12px]"
          style={{ textAlign: config.footer.copyrightTextAlign }}
          placeholder="© {year} Podjetje"
        />
        <FooterTextAlignmentMenu
          value={config.footer.copyrightTextAlign}
          options={footerTextAlignmentOptions}
          onValueChange={(copyrightTextAlign) => updateFooter({ copyrightTextAlign })}
          ariaLabel="Poravnava avtorskih pravic"
          side="left"
        />
      </div>
    ),
    renderLegal: ({ children }) => (
      <DndContext
        id="site-navigation-footer-legal-links"
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleFooterLegalLinkDragEnd}
      >
        <div className="flex min-h-7 items-center justify-end gap-1 pr-1">
          <SortableContext items={footerLegalLinkIds} strategy={rectSortingStrategy}>
            <nav aria-label="Urejanje pravnih povezav" className="flex min-w-0 flex-wrap items-center justify-end gap-x-5 gap-y-2">
              {children}
            </nav>
          </SortableContext>
          <IconButton
            type="button"
            size="sm"
            tone="neutral"
            className="!h-7 !w-7 shrink-0"
            aria-label="Dodaj pravno povezavo"
            title="Dodaj pravno povezavo"
            onClick={addFooterLegalLink}
          >
            <PlusIcon />
          </IconButton>
        </div>
      </DndContext>
    )
  } satisfies SiteFooterEditorAdapter;

  return (
    <div className="space-y-4" style={editorVars} data-appearance-settings-density="compact" data-appearance-settings-page="navigacija">
      <AdminPageHeader
        title="Podoba"
        description="Urejanje vizualnih nastavitev."
        actions={
          <div className="flex items-center gap-2">
            <Button type="button" variant="primary" size="toolbar" className={topActionSaveButtonClassName} onClick={save} disabled={!isDirty || isSaving}>
              <SaveIcon className={topSaveActionButtonIconClassName} />
              <span>Shrani</span>
            </Button>
          </div>
        }
      />
      <AdminPodobaTabs />

      <TopBarLayoutEditor
        siteLayout={config.siteLayout}
        layout={config.topBarLayout}
        initialLayout={config.topBarInitialLayout}
        items={config.items}
        footer={config.footer}
        isSaving={isSaving}
        onChange={updateTopBarLayout}
        onSiteLayoutChange={updateSiteLayout}
        onSetInitialLayout={setCurrentTopBarAsDefaults}
      />

      <section className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-slate-900">Glavni meni</h2>
          <div className="flex items-center gap-2">
            <IconButton
              type="button"
              size="sm"
              tone="neutral"
              className={adminTableNeutralIconButtonClassName}
              aria-label="Privzete nastavitve"
              title="Privzete nastavitve"
              onClick={resetMainMenuToDefaults}
              disabled={isSaving}
            >
              <ActionUndoIcon />
            </IconButton>
            <Button type="button" variant="primary" size="toolbar" className={adminTablePrimaryButtonClassName} onClick={addTopItem}>
              Dodaj element
            </Button>
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
          <DndContext id="site-navigation-top-level" sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleTopDragEnd}>
            <SortableContext items={topLevelIds} strategy={rectSortingStrategy}>
              <nav className="flex min-h-10 min-w-0 flex-wrap items-center gap-x-2 gap-y-2" aria-label="Urejanje glavne navigacije">
                {config.items.map((item) => (
                  <TopLevelNavItemEditor
                    key={item.id}
                    item={item}
                    selected={selectedItem?.id === item.id}
                    onSelect={() => setSelectedItemId(item.id)}
                    onChange={(updates) => updateTopItem(item.id, updates)}
                    onDelete={() => deleteTopItem(item.id)}
                    onOpenUrlEditor={() => setTopLinkEditorId((current) => (current === item.id ? null : item.id))}
                  />
                ))}
              </nav>
            </SortableContext>
          </DndContext>
          {topLinkEditorItem ? (
            <div className="mt-3 border-t border-slate-100 pt-3">
              <label className="grid max-w-xl gap-1.5">
                <span className="text-xs font-semibold uppercase tracking-[0.06em] text-slate-500">
                  Povezava za {topLinkEditorItem.label || 'element'}
                </span>
                <Input
                  value={topLinkEditorItem.href}
                  onChange={(event) => updateTopItem(topLinkEditorItem.id, { href: event.target.value })}
                  className={compactInputClassName}
                  placeholder="/"
                />
              </label>
            </div>
          ) : null}
        </div>

        <div className="my-5 border-t border-slate-200" />

        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className={`text-xl font-semibold ${selectedItem?.visible === false ? 'text-slate-400' : 'text-slate-900'}`}>
              {selectedItem?.label ?? 'Izberite element navigacije'}
            </h2>
          </div>
          <Button type="button" variant="primary" size="toolbar" className={adminTablePrimaryButtonClassName} onClick={addGroup} disabled={!selectedItem}>
            Dodaj skupino
          </Button>
        </div>
        {selectedItem ? (
          selectedItem.groups.length > 0 ? (
            <div
              data-navigation-parent-hidden={selectedItem.visible ? undefined : 'true'}
              className={`rounded-2xl border border-[var(--navbar-dropdown-border)] bg-white p-5 shadow-[0_16px_40px_-28px_rgba(15,23,42,0.6)] transition-opacity ${
                selectedItem.visible ? '' : 'opacity-50'
              }`}
            >
              <DndContext id={`site-navigation-groups-${selectedItem.id}`} sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleGroupDragEnd}>
                <SortableContext items={selectedGroupIds} strategy={rectSortingStrategy}>
                  <div className="grid gap-x-8 gap-y-7 lg:grid-cols-3">
                    {selectedGroupEntries.map(({ group, placement, startsLaterPage }) => (
                      <Fragment key={group.id}>
                        {startsLaterPage ? (
                          <div className="col-span-full flex items-center gap-3 pt-1 text-[11px] font-medium uppercase tracking-[0.08em] text-[color:var(--blue-500)]">
                            <span className="h-px flex-1 bg-[color:var(--blue-500)]/20" />
                            <span>Stran {placement.pageNumber} v javnem dropdownu</span>
                            <span className="h-px flex-1 bg-[color:var(--blue-500)]/20" />
                          </div>
                        ) : null}
                        <GroupEditor
                          group={group}
                          desktopPageNumber={placement.pageNumber}
                          sensors={sensors}
                          onChange={(updates) => updateGroup(group.id, updates)}
                          onDelete={() => deleteGroup(group.id)}
                          onAddLink={() => addLink(group.id)}
                          onUpdateLink={(linkId, updates) => updateLink(group.id, linkId, updates)}
                          onDeleteLink={(linkId) => deleteLink(group.id, linkId)}
                          onReorderLink={handleLinkDragEnd(group.id)}
                        />
                      </Fragment>
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-600">
              Ta element še nima skupin.
            </div>
          )
        ) : (
          <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-600">
            Najprej dodajte element glavne navigacije.
          </div>
        )}
      </section>

      <section
        className="rounded-xl border border-slate-200 bg-white p-4"
        data-testid="site-footer-links-editor"
      >
        <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">Noga spletnega mesta</h2>
            <p className="mt-1 max-w-2xl text-sm text-slate-500">
              Iste povezave in kontaktni podatki so prikazani na vseh javnih straneh.
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <Link
              href="/admin/podoba/logotip"
              className="inline-flex h-8 items-center rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 hover:text-[color:var(--blue-600)]"
            >
              Uredi logotip
            </Link>
            <fieldset
              aria-label="Vidnost delov noge"
              className="m-0 flex min-w-0 flex-wrap items-center justify-end gap-2 border-0 p-0"
            >
              <legend className="sr-only">Vidnost delov noge</legend>
              <label className="inline-flex h-8 items-center gap-2 rounded-lg bg-slate-50 px-2.5 text-xs font-medium text-slate-700">
                <AdminCheckbox
                  checked={config.footer.upperSectionVisible}
                  onChange={(event) => updateFooter({ upperSectionVisible: event.target.checked })}
                />
                Prikaži zgornji del
              </label>
              <label className="inline-flex h-8 items-center gap-2 rounded-lg bg-slate-50 px-2.5 text-xs font-medium text-slate-700">
                <AdminCheckbox
                  checked={config.footer.lowerSectionVisible}
                  onChange={(event) => updateFooter({ lowerSectionVisible: event.target.checked })}
                />
                Prikaži spodnji del
              </label>
              {!config.footer.upperSectionVisible ? (
                <label className="inline-flex h-8 items-center gap-2 rounded-lg bg-slate-50 px-2.5 text-xs font-medium text-slate-700">
                  <AdminCheckbox
                    checked={config.footer.lowerContactVisible}
                    onChange={(event) => updateFooter({ lowerContactVisible: event.target.checked })}
                  />
                  Prikaži kontakt v spodnjem delu
                </label>
              ) : null}
            </fieldset>
            <label className="inline-flex h-8 items-center gap-2 rounded-lg bg-slate-50 px-2.5 text-xs font-medium text-slate-700">
              <AdminCheckbox
                checked={config.footer.visible}
                onChange={(event) => updateFooter({ visible: event.target.checked })}
              />
              Prikaži nogo
            </label>
          </div>
        </div>

        <div
          data-testid="site-footer-editor-preview"
          data-admin-editor-preview-frame="true"
          data-storefront-theme="true"
          className={`storefront-theme-preview site-page-surface ${adminEditorPreviewFrameTokenClasses} bg-[color:var(--site-color-surface)]`}
          style={footerPreviewVars}
        >
          <SiteFooter
            settings={config.footer}
            editorAdapter={footerEditorAdapter}
            containerClassName={`site-container ${adminEditorPreviewContentTokenClasses}`}
          />
        </div>
      </section>
    </div>
  );
}
