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
import { useRouter } from 'next/navigation';
import SiteHeader from '@/commercial/components/SiteHeader';
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent
} from '@dnd-kit/core';
import { SortableContext, arrayMove, rectSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  cloneDefaultSiteNavigationConfig,
  DEFAULT_SITE_NAVIGATION_TOP_BAR_LAYOUT,
  getSiteNavigationDesktopGroupPlacements,
  getSiteNavigationTopBarReservedFixedWidth,
  getSiteNavigationTopBarSearchReservedWidth,
  normalizeSiteNavigationConfig,
  normalizeSiteNavigationTopBarOffset,
  SITE_NAVIGATION_ADMIN_SELECTION_ROW_GAP_PX,
  SITE_NAVIGATION_TOP_BAR_OFFSET_MAX,
  SITE_NAVIGATION_TOP_BAR_OFFSET_MIN,
  SITE_NAVIGATION_TOP_BAR_OFFSET_STEP,
  type SiteNavigationDesktopGroupPlacement,
  type SiteNavigationConfig,
  type SiteNavigationGroup,
  type SiteNavigationItemIcon,
  type SiteNavigationLink,
  type SiteNavigationTopBarActionId,
  type SiteNavigationTopBarAiMode,
  type SiteNavigationTopBarDevice,
  type SiteNavigationTopBarElementId,
  type SiteNavigationSiteLayoutSettings,
  type SiteNavigationTopBarConstraintLayoutMode,
  type SiteNavigationTopBarItemWidthMode,
  type SiteNavigationTopBarLayout,
  type SiteNavigationTopBarNavigationMode,
  type SiteNavigationTopBarResponsiveItem,
  type SiteNavigationTopBarResponsiveSettings,
  type SiteNavigationTopBarRowPattern,
  type SiteNavigationTopBarSearchMode,
  type SiteNavigationTopBarSecondRow,
  type SiteNavigationTopBarSlot,
  type SiteNavigationTopBarWidthMode,
  type SiteNavigationTopLevelItem
} from '@/shared/domain/navigation/siteNavigation';
import { AdminPageHeader } from '@/shared/ui/admin-primitives';
import { Button } from '@/shared/ui/button';
import { IconButton } from '@/shared/ui/icon-button';
import { Input } from '@/shared/ui/input';
import { ActionUndoIcon, SaveIcon, TrashCanIcon } from '@/shared/ui/icons/AdminActionIcons';
import {
  SiteNavigationLucideIcon,
  siteNavigationLucideIconNames,
  toSiteNavigationLucideIconName
} from '@/shared/ui/icons/SiteNavigationLucideIcon';
import { useDropdownDismiss } from '@/shared/ui/dropdown/use-dropdown-dismiss';
import { MenuPanel } from '@/shared/ui/menu';
import { adminTableNeutralIconButtonClassName, adminTablePrimaryButtonClassName } from '@/shared/ui/admin-table/standards';
import {
  adminActionMenuItemTokenClasses,
  adminControlFocusTokenClasses,
  adminDragSurfaceTokenClasses,
  adminFilterInputTokenClasses,
  adminInlineEditTriggerTokenClasses,
  adminMiniIconButtonTokenClasses,
  adminSelectableIconBadgeTokenClasses,
  adminTinyNumberInputTokenClasses,
  iconButtonTokenClasses
} from '@/shared/ui/theme/tokens';
import { useToast } from '@/shared/ui/toast';
import AdminPodobaTabs from './AdminPodobaTabs';

const compactInputClassName = adminFilterInputTokenClasses;
const numberInputNoSpinnerClassName =
  '[appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none';
const topBarElementRowGridClassName =
  'grid-cols-[minmax(170px,1fr)_112px_62px_116px_194px_88px_70px]';
const topBarElementRowMinWidthClassName = 'min-w-[932px]';
const topBarUnitAdornmentBaseClassName =
  'inline-flex h-full shrink-0 items-center justify-center whitespace-nowrap border-l border-slate-200';
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
    topBarLayout: normalized.topBarLayout,
    topBarInitialLayout: normalized.topBarInitialLayout
  });
}

function withPositions<T extends { position: number }>(items: T[]) {
  return items.map((item, index) => ({ ...item, position: index }));
}

function reorderById<T extends { id: string; position: number }>(items: T[], activeId: string, overId: string) {
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
  if (id === 'logo') return 88;
  if (id === 'search') return settings.searchMode === 'field' ? 132 : getSiteNavigationTopBarSearchReservedWidth(device);
  if (id === 'ai') return settings.aiMode === 'icon' ? 32 : 96;
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
  match_content: 'Kot vsebina',
  custom: 'Po meri',
  full: 'Polna'
};

const topBarConstraintLayoutModeLabels: Record<SiteNavigationTopBarConstraintLayoutMode, string> = {
  centered_nav: 'Navigacija v sredini',
  flow: 'Tok'
};

const topBarItemWidthModeLabels: Record<SiteNavigationTopBarItemWidthMode, string> = {
  auto: 'Samodejno',
  fixed: 'Fiksno',
  fill: 'Zapolni'
};

const topBarHelpCopy = {
  siteContentWidth:
    'Največja širina glavne vsebine strani. Ko je zgornja vrstica nastavljena na "Kot vsebina", uporablja isto širino. Primer: 1260 px pomeni, da sta vsebina strani in elementi v zgornji vrstici poravnani na isti levi in desni rob.',
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
    'Določa, kako široka je notranja vsebina zgornje vrstice. Kot vsebina uporablja skupno širino strani, Po meri uporablja posebno max širino samo za zgornjo vrstico, Polna pa raztegne elemente čez celotno širino z varnim robom.',
  customWidth:
    'Največja širina zgornje vrstice, kadar je izbran način Po meri. Primer: 1440 px omogoči širšo zgornjo vrstico kot glavno vsebino strani.',
  layoutMode:
    'Navigacija v sredini uporablja tri stolpce, kjer je sredinski stolpec res centriran na strani. Tok postavi levi, sredinski in desni del bolj tekoče, zato se bolje prilagodi, ko je na eni strani veliko elementov.',
  slot:
    'Pozicija določi, v kateri del zgornje vrstice element spada. Levo se poravna ob levi rob vsebinskega kontejnerja, Sredina se postavi v sredinski del, Desno se poravna ob desni rob. Elementi na isti poziciji se razvrstijo po polju Red. Na mobilniku Meni pomeni, da se element premakne v hamburger meni.',
  order:
    'Vrstni red znotraj istega slota. Manjša številka pride prej. Primer: na desni strani Red 1 za Iskanje, Red 2 za Vprašaj AI in Red 3 za Košarico prikaže elemente v tem vrstnem redu.',
  widthModeColumn:
    'Način širine določa, kako element porabi prostor. Samodejno uporabi naravno širino elementa, Fiksno uporabi vpisano širino v px, Zapolni pa dovoli elementu, da zapolni razpoložljiv prostor v svojem slotu.',
  widthColumn:
    'Širina elementa v px, kadar je način širine Fiksno. Primer: logotip 88 px ohrani stalno širino logotipnega območja.',
  offsetsColumn:
    'Odmiki dodajo prostor pred ali po elementu v isti poziciji. Pred poveča prostor pred elementom, Po poveča prostor za njim. Primer: Po 12 px za Iskanjem ustvari več prostora pred Vprašaj AI.',
  editColumn:
    'Uredi združuje prikaz/skrij in dodatne nastavitve elementa. Ikona očesa določa vidnost; meni s tremi pikami vsebuje ponastavitev elementa.',
  breakpoint:
    'Prelomna širina pove, pri katerih širinah zaslona veljajo nastavitve naprave. Primer: Tablica od 768 px do 1024 px pomeni, da se tablična postavitev uporabi v tem razponu.',
  tabletNavigation:
    'Polna prikaže vse navigacijske povezave. Strnjena prikaže samo nastavljeno število prvih povezav in ostalo skrije za krajšo predstavitev. Hamburger zamenja navigacijo z menijskim gumbom.',
  maxVisibleLinks:
    'Največ povezav, ki so vidne v strnjenem tabličnem meniju. Primer: 3 prikaže prve tri navigacijske naslove, ostale pa ostanejo skrite za zgoščen prikaz.',
  rowPattern:
    'Ena vrstica prikaže vse izbrane elemente v eni zgornji vrstici. Dve vrstici dodata drugo vrstico, kamor lahko premaknete iskanje ali navigacijo, če na mobilniku zmanjka prostora.',
  secondRow:
    'Določa vsebino druge mobilne vrstice. Primer: Iskanje prikaže iskalnik pod glavno vrstico, Navigacija pa lahko prikaže navigacijske možnosti v drugi vrstici.',
  mobileNavigation:
    'Na mobilniku je navigacija zaklenjena kot hamburger, ker polni tekstovni meni hitro postane neberljiv. Z leve odpre stranski predal, Celozaslonsko odpre meni čez cel zaslon.',
  actionPriority:
    'Vrstni red akcij na mobilniku. Elementi z nižjo prioriteto se premaknejo v meni, ko zmanjka prostora. Primer: če je Košarica prva, ostane vidna pred Iskanjem in Vprašaj AI.',
  mobileSearch:
    'Določa, kje je iskanje na mobilniku. V meniju ga skrije v hamburger meni, Ikona ga prikaže v zgornji vrstici, Druga vrstica ga prikaže pod glavno vrstico, kadar je vklopljen vzorec Dve vrstici.',
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
  | 'row-pattern'
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
    case topBarHelpCopy.editColumn:
      return 'edit';
    case topBarHelpCopy.breakpoint:
      return 'breakpoint';
    case topBarHelpCopy.tabletNavigation:
    case topBarHelpCopy.maxVisibleLinks:
    case topBarHelpCopy.mobileNavigation:
      return 'navigation-mode';
    case topBarHelpCopy.rowPattern:
    case topBarHelpCopy.secondRow:
      return 'row-pattern';
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

type TopBarPreviewDevice = SiteNavigationTopBarDevice;
type TopBarZone = 'left' | 'center' | 'right';

const topBarPreviewDeviceLabels = topBarDeviceLabels;
const topBarPreviewDeviceWidths: Record<TopBarPreviewDevice, string> = {
  desktop: '100%',
  tablet: '720px',
  mobile: '390px'
};

const topBarZoneLabels: Record<TopBarZone, string> = {
  left: 'Levo',
  center: 'Sredina',
  right: 'Desno'
};

const topBarZoneToneClassNames: Record<TopBarZone, string> = {
  left: 'bg-sky-50 text-sky-700',
  center: 'bg-violet-50 text-violet-700',
  right: 'bg-emerald-50 text-emerald-700'
};

const topBarZonePositionPercent: Record<TopBarZone, number> = {
  left: 12,
  center: 50,
  right: 88
};

const topBarLayoutBasePositions: Record<SiteNavigationTopBarElementId, number> = {
  logo: 9,
  navigation: 37,
  search: 69,
  ai: 82,
  cart: 94
};

const topBarLayoutElementWidths: Record<SiteNavigationTopBarElementId, number> = {
  logo: 104,
  navigation: 380,
  search: 34,
  ai: 104,
  cart: 34
};

const topBarPreviewFontStyle: CSSProperties = {
  fontFamily: 'Geist, "Geist Sans", ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  WebkitFontSmoothing: 'antialiased',
  MozOsxFontSmoothing: 'grayscale'
};
const adminSiteNavigationPreviewEventName = 'admin-site-navigation-preview';

function formatTopBarOffset(offset: number) {
  return `${offset > 0 ? '+' : ''}${offset} px`;
}

function getTopBarLayoutOffset(layout: SiteNavigationTopBarLayout, id: SiteNavigationTopBarElementId) {
  if (layout.mode !== 'manual') return 0;
  return layout.items.find((item) => item.id === id)?.offset ?? 0;
}

function getTopBarEffectivePercent(layout: SiteNavigationTopBarLayout, id: SiteNavigationTopBarElementId) {
  const offset = getTopBarLayoutOffset(layout, id);
  const offsetRange = SITE_NAVIGATION_TOP_BAR_OFFSET_MAX - SITE_NAVIGATION_TOP_BAR_OFFSET_MIN;
  return topBarLayoutBasePositions[id] + (offset / offsetRange) * 88;
}

function getTopBarZone(layout: SiteNavigationTopBarLayout, id: SiteNavigationTopBarElementId): TopBarZone {
  const effectivePercent = getTopBarEffectivePercent(layout, id);
  return (Object.keys(topBarZonePositionPercent) as TopBarZone[]).reduce<TopBarZone>((closestZone, zone) => {
    const closestDistance = Math.abs(effectivePercent - topBarZonePositionPercent[closestZone]);
    const zoneDistance = Math.abs(effectivePercent - topBarZonePositionPercent[zone]);
    return zoneDistance < closestDistance ? zone : closestZone;
  }, 'center');
}

function getTopBarOffsetForZone(id: SiteNavigationTopBarElementId, zone: TopBarZone) {
  const offsetRange = SITE_NAVIGATION_TOP_BAR_OFFSET_MAX - SITE_NAVIGATION_TOP_BAR_OFFSET_MIN;
  return normalizeSiteNavigationTopBarOffset(((topBarZonePositionPercent[zone] - topBarLayoutBasePositions[id]) / 88) * offsetRange);
}

function cloneTopBarLayout(layout: SiteNavigationTopBarLayout): SiteNavigationTopBarLayout {
  return {
    mode: layout.mode,
    items: layout.items.map((item) => ({ ...item })),
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
          actionPriority: [...(layout.responsive.mobile.settings.actionPriority ?? ['cart', 'search', 'ai'])]
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
          <span className={`${blueBoxClassName} inline-flex h-6 w-28 items-center justify-center`}>1260 px</span>
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

  if (visual === 'row-pattern') {
    return (
      <span className={shellClassName} aria-hidden="true">
        <span className="grid h-12 grid-cols-2 gap-2 rounded bg-white p-1.5">
          <span className={`${blueBoxClassName} flex items-center justify-center`}>1 vrstica</span>
          <span className="grid gap-1">
            <span className={`${neutralBoxClassName} block`} />
            <span className={`${neutralBoxClassName} block`} />
          </span>
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

function AdminTopBarSearchGlyph({ className = 'h-[17px] w-[17px]' }: { className?: string }) {
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

function AdminTopBarBrandPreview() {
  return (
    <span className="inline-flex items-center gap-1.5 text-black">
      <span className="inline-flex h-[18px] w-[18px] items-center justify-center rounded-[4px] bg-black text-[11px] font-semibold leading-none text-white">
        A
      </span>
      <span className="text-[17px] font-semibold leading-none tracking-normal">Atehna</span>
    </span>
  );
}

function AdminTopBarSearchPreview({ mode = 'icon' }: { mode?: SiteNavigationTopBarSearchMode }) {
  if (mode === 'field') {
    return (
      <span className="inline-flex h-8 w-[132px] items-center gap-2 rounded-md border border-slate-200 bg-white px-2.5 text-[13px] text-slate-500">
        <AdminTopBarSearchGlyph className="h-4 w-4" />
        <span>Iskanje</span>
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
  settings
}: {
  id: SiteNavigationTopBarElementId;
  items: SiteNavigationTopLevelItem[];
  highlighted?: boolean;
  device?: SiteNavigationTopBarDevice;
  settings?: SiteNavigationTopBarLayout['responsive'][SiteNavigationTopBarDevice]['settings'];
}) {
  const previewSettings = settings ?? DEFAULT_SITE_NAVIGATION_TOP_BAR_LAYOUT.responsive.desktop.settings;

  if (id === 'logo') return <AdminTopBarBrandPreview />;
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

const topBarActionLabels: Record<SiteNavigationTopBarActionId, string> = {
  cart: 'Košarica',
  search: 'Iskanje',
  ai: 'Vprašaj AI'
};

function sortedResponsiveItems(items: SiteNavigationTopBarResponsiveItem[]) {
  return [...items].sort((first, second) => first.position - second.position);
}

function updateResponsiveLayout(
  layout: SiteNavigationTopBarLayout,
  device: SiteNavigationTopBarDevice,
  updater: (current: SiteNavigationTopBarLayout['responsive'][SiteNavigationTopBarDevice]) => SiteNavigationTopBarLayout['responsive'][SiteNavigationTopBarDevice]
): SiteNavigationTopBarLayout {
  const nextLayout = {
    ...layout,
    responsive: {
      ...layout.responsive,
      [device]: updater(layout.responsive[device])
    }
  };

  if (device !== 'desktop') return nextLayout;

  const desktopItems = nextLayout.responsive.desktop.items;
  return {
    ...nextLayout,
    items: nextLayout.items.map((item) => ({
      ...item,
      visible: desktopItems.find((desktopItem) => desktopItem.id === item.id)?.visible ?? item.visible
    }))
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
  onChange
}: {
  value: T;
  options: Array<{ value: T; label: string; disabled?: boolean }>;
  onChange: (value: T) => void;
}) {
  return (
    <div className="inline-flex min-h-9 items-center gap-1">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          disabled={option.disabled}
          className={`inline-flex h-8 items-center rounded-md border px-2.5 text-[12px] font-medium leading-none transition ${adminControlFocusTokenClasses} ${
            value === option.value
              ? 'border-[color:var(--blue-500)] bg-[color:var(--blue-50)] text-[color:var(--blue-500)]'
              : option.disabled
                ? 'cursor-not-allowed border-transparent text-slate-300'
                : 'border-transparent text-slate-500 hover:bg-[color:var(--hover-neutral)] hover:text-[color:var(--blue-500)]'
          }`}
          onClick={() => onChange(option.value)}
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
  onChange: (value: number) => void;
}) {
  const simulatorStyle = variant === 'simulator';

  return (
    <span
      className={`inline-flex items-center overflow-hidden rounded-md border bg-white text-[12px] leading-none transition focus-within:border-[color:var(--blue-500)] ${
        simulatorStyle
          ? 'h-9 border-slate-300 text-slate-600'
          : 'h-8 border-slate-200 text-slate-700'
      } ${
        disabled ? 'bg-[color:var(--field-locked-bg)] text-slate-400' : ''
      } ${className}`}
      onClick={stopPropagation ? (event) => event.stopPropagation() : undefined}
    >
      <input
        type="number"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(Math.min(max, Math.max(min, Number(event.target.value) || 0)))}
        className={`h-full border-0 bg-transparent text-right font-['Inter',system-ui,sans-serif] text-[12px] leading-none outline-none focus:ring-0 ${numberInputNoSpinnerClassName} ${
          simulatorStyle
            ? 'px-2.5 font-semibold text-slate-600 disabled:text-slate-400'
            : 'px-2 font-normal text-slate-700 disabled:text-slate-300'
        } ${inputClassName}`}
        aria-label={ariaLabel}
      />
      {suffix ? (
        <span
          className={`${topBarUnitAdornmentBaseClassName} ${
            simulatorStyle
              ? 'px-2.5 text-[12px] font-semibold leading-none text-slate-500'
              : 'px-2 text-[12px] font-medium leading-none text-slate-500'
          }`}
        >
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
        className="w-full"
        inputClassName="w-10 shrink-0"
        ariaLabel={label}
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
  className = '',
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
  onChange: (value: number) => void;
}) {
  return (
    <label
      className={`grid min-w-0 gap-1.5 text-[12px] text-slate-700 ${className}`}
    >
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
        className="w-full"
        ariaLabel={label}
        onChange={onChange}
      />
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
  hideLabel = false
}: {
  label: string;
  help?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  frameless?: boolean;
  simulatorStyle?: boolean;
  hideLabel?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={hideLabel ? label : undefined}
      className={`${frameless ? 'inline-flex w-auto justify-start' : 'flex w-full justify-between'} h-9 items-center text-[12px] font-medium transition ${adminControlFocusTokenClasses} ${
        frameless
          ? `gap-2 rounded-md px-0 ${checked ? 'text-[color:var(--blue-500)]' : 'text-slate-600 hover:text-[color:var(--blue-500)]'}`
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
        className={`relative shrink-0 rounded-full transition-colors ${
          simulatorStyle
            ? `h-[32px] w-[58px] ${checked ? 'bg-[#1982bf]' : 'bg-slate-300'}`
            : `h-5 w-9 ${checked ? 'bg-[color:var(--blue-500)]' : 'bg-slate-200'}`
        }`}
      >
        <span
          className={`absolute rounded-full bg-white shadow-sm transition-[left] ${
            simulatorStyle
              ? `top-[4px] h-6 w-6 ${checked ? 'left-[30px]' : 'left-[4px]'}`
              : `top-0.5 h-4 w-4 ${checked ? 'left-[18px]' : 'left-0.5'}`
          }`}
        />
      </span>
    </button>
  );
}

function TopBarSettingsGroup({ title, help, children }: { title: string; help?: string; children: ReactNode }) {
  return (
    <div className="border-t border-slate-100 pt-4">
      <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">
        <TopBarHelpLabel help={help} align="right">
          {title}
        </TopBarHelpLabel>
      </h3>
      <div className="grid gap-3">{children}</div>
    </div>
  );
}

function TopBarCompactSettingsGroup({ children }: { title: string; children: ReactNode }) {
  return (
    <section className="grid min-w-0 content-start gap-2">
      {children}
    </section>
  );
}

function formatPreviewRulerNumber(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(1).replace(/\.0$/, '');
}

const topBarPreviewRulerTopGutter = 16;
const topBarPreviewRulerLeftGutter = 28;

function useMeasuredElementWidth<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const element = ref.current;
    if (!element) return undefined;

    const updateWidth = () => {
      setWidth(Math.round(element.getBoundingClientRect().width));
    };

    updateWidth();

    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', updateWidth);
      return () => window.removeEventListener('resize', updateWidth);
    }

    const resizeObserver = new ResizeObserver((entries) => {
      const entry = entries[0];
      setWidth(Math.round(entry?.contentRect.width ?? element.getBoundingClientRect().width));
    });

    resizeObserver.observe(element);

    return () => resizeObserver.disconnect();
  }, []);

  return [ref, width] as const;
}

function TopBarPreviewGridOverlay({ width, height }: { width: number; height: number }) {
  const xMarkers = Array.from({ length: Math.floor(width / 50) + 1 }, (_, index) => index * 50).filter(
    (marker) => marker <= width
  );
  const xLineMarkers = xMarkers.filter((marker) => marker > 0 && marker < width);
  const yLineMarkers = [height / 4, height / 2, (height * 3) / 4];
  const yLabelMarkers = [0, ...yLineMarkers, height];

  if (!xMarkers.includes(width)) xMarkers.push(width);
  const finalXMarker = xMarkers[xMarkers.length - 1] ?? width;
  const xLabelMarkers = xMarkers.filter((marker) => marker === finalXMarker || finalXMarker - marker >= 32);

  return (
    <>
      <div
        className="pointer-events-none absolute inset-0 z-20 rounded-xl border border-[rgba(37,99,235,0.28)] bg-[rgba(37,99,235,0.025)]"
        aria-hidden="true"
      />
      <div className="pointer-events-none absolute inset-0 z-[21] overflow-visible" aria-hidden="true">
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
        {xLabelMarkers.map((marker) => (
          <span
            key={`x-${marker}`}
            className="absolute -top-3 whitespace-nowrap text-[8px] font-medium leading-none text-slate-400"
            style={{
              left: `${(marker / width) * 100}%`,
              transform: marker === 0 ? 'none' : marker === finalXMarker ? 'translateX(-100%)' : 'translateX(-50%)'
            }}
          >
            {formatPreviewRulerNumber(marker)}
            {marker === finalXMarker ? 'px' : ''}
          </span>
        ))}
        {yLabelMarkers.map((marker) => (
          <span
            key={`y-${marker}`}
            className="absolute -left-7 whitespace-nowrap text-right text-[8px] font-medium leading-none text-slate-400"
            style={{
              top: `${(marker / height) * 100}%`,
              transform: marker === 0 ? 'translateY(0)' : marker === height ? 'translateY(-100%)' : 'translateY(-50%)'
            }}
          >
            {formatPreviewRulerNumber(marker)}
          </span>
        ))}
      </div>
    </>
  );
}

function getTopBarPreviewViewportWidth(
  device: SiteNavigationTopBarDevice,
  settings: SiteNavigationTopBarResponsiveSettings,
  siteLayout: SiteNavigationSiteLayoutSettings
) {
  if (device !== 'desktop') return topBarDevicePreviewWidths[device];
  if (settings.widthMode === 'custom' && settings.customMaxWidthPx) return settings.customMaxWidthPx;
  return siteLayout.siteContentMaxWidthPx;
}

function HeaderPreviewFrame({
  mode,
  navigation,
  viewportWidth,
  viewportHeight,
  scale,
  showOverlay
}: {
  mode: 'real' | 'technical';
  navigation: SiteNavigationConfig;
  viewportWidth: number;
  viewportHeight: number;
  scale: number;
  showOverlay: boolean;
}) {
  const frameScale = mode === 'technical' ? scale : 1;
  const scaledHeight = Math.ceil(viewportHeight * frameScale);

  return (
    <div className="relative" style={{ height: scaledHeight }}>
      <div
        className="relative overflow-visible"
        style={{
          width: viewportWidth,
          minHeight: viewportHeight,
          transform: mode === 'technical' ? `scale(${frameScale})` : undefined,
          transformOrigin: 'top left'
        }}
      >
        <div className="relative" style={{ height: viewportHeight }}>
          <div className="relative z-10">
            <div className="commercial-storefront-scale admin-site-header-preview-scale" style={{ height: viewportHeight }}>
              <SiteHeader navigation={navigation} previewMode="inline" previewViewportWidth={viewportWidth} />
            </div>
          </div>
          {showOverlay ? <TopBarPreviewGridOverlay width={viewportWidth} height={viewportHeight} /> : null}
        </div>
      </div>
    </div>
  );
}

function TopBarResponsivePreview({
  device,
  siteLayout,
  settings,
  navigation,
  showOverlay,
}: {
  device: SiteNavigationTopBarDevice;
  siteLayout: SiteNavigationSiteLayoutSettings;
  settings: SiteNavigationTopBarResponsiveSettings;
  navigation: SiteNavigationConfig;
  showOverlay: boolean;
}) {
  const [measureRef, availableWidth] = useMeasuredElementWidth<HTMLDivElement>();
  const viewportWidth = getTopBarPreviewViewportWidth(device, settings, siteLayout);
  const viewportHeight = Math.max(65, Math.ceil(settings.height * 0.75));
  const scale = availableWidth > 0 ? Math.min(1, Math.max(0.2, availableWidth / viewportWidth)) : 1;
  const deviceLabel = topBarDeviceLabels[device];
  const zoomLabel = `${Math.round(scale * 100) / 100}x`.replace('.', ',');

  return (
    <div className="min-w-0">
      <div className="mb-2 flex items-center justify-between gap-3 text-[11px] font-medium text-slate-500">
        <span>{deviceLabel} · {viewportWidth}px viewport · {zoomLabel} zoom</span>
      </div>
      <div ref={measureRef} className="relative min-w-0 overflow-hidden rounded-xl bg-slate-50/60">
        <HeaderPreviewFrame
          mode="technical"
          navigation={navigation}
          viewportWidth={viewportWidth}
          viewportHeight={viewportHeight}
          scale={scale}
          showOverlay={showOverlay}
        />
      </div>
    </div>
  );
}

function TopBarElementRow({
  item,
  device,
  settings,
  items,
  selected,
  isLast,
  onSelect,
  onChange,
  onReset
}: {
  item: SiteNavigationTopBarResponsiveItem;
  device: SiteNavigationTopBarDevice;
  settings: SiteNavigationTopBarResponsiveSettings;
  items: SiteNavigationTopLevelItem[];
  selected: boolean;
  isLast: boolean;
  onSelect: () => void;
  onChange: (updates: Partial<SiteNavigationTopBarResponsiveItem>) => void;
  onReset: () => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const menuDismissRefs = useMemo(() => [menuRef], []);
  const elementWidth = estimateTopBarElementWidth({ id: item.id, items, device, settings });
  const reservedWidth = getSiteNavigationTopBarReservedFixedWidth(item, device);
  const resolvedWidth = reservedWidth ?? item.fixedWidthPx ?? elementWidth;
  const minimumFixedWidth = item.id === 'search' && item.slot !== 'menu'
    ? getSiteNavigationTopBarSearchReservedWidth(device)
    : 0;

  useDropdownDismiss({ open: menuOpen, refs: menuDismissRefs, onClose: () => setMenuOpen(false) });

  return (
    <div
      role="button"
      tabIndex={0}
      className={`group grid ${topBarElementRowMinWidthClassName} ${topBarElementRowGridClassName} items-center gap-3 px-3 py-2 text-left text-[13px] transition focus:outline-none focus:ring-0 focus-visible:outline-none focus-visible:ring-0 ${isLast ? '' : 'border-b border-slate-100'} ${
        selected ? 'bg-[color:var(--hover-neutral)]' : 'bg-white hover:bg-[color:var(--hover-neutral)]'
      } ${item.visible ? '' : 'text-slate-400'}`}
      onClick={onSelect}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onSelect();
        }
      }}
    >
      <span className="inline-flex min-w-0 items-center gap-2">
        <AdminTopBarElementBadge id={item.id} selected={selected} />
        <span className={`truncate font-semibold ${item.visible ? 'text-slate-900' : 'text-slate-400'}`}>{topBarLayoutLabels[item.id]}</span>
      </span>
      <select
        value={item.slot}
        className={`${compactInputClassName} h-8 py-0 text-[12px]`}
        style={{ width: 104 }}
        onClick={(event) => event.stopPropagation()}
        onChange={(event) => onChange({ slot: event.target.value as SiteNavigationTopBarSlot })}
      >
        {(Object.keys(topBarSlotLabels) as SiteNavigationTopBarSlot[]).map((slot) => (
          <option key={slot} value={slot}>{topBarSlotLabels[slot]}</option>
        ))}
      </select>
      <input
        type="number"
        min={0}
        max={99}
        value={item.orderIndex}
        className={`${compactInputClassName} ${numberInputNoSpinnerClassName} h-8 py-0 text-right text-[12px]`}
        style={{ width: 54 }}
        onClick={(event) => event.stopPropagation()}
        onChange={(event) => onChange({ orderIndex: Math.min(99, Math.max(0, Number(event.target.value) || 0)) })}
        aria-label={`Vrstni red za ${topBarLayoutLabels[item.id]}`}
      />
      <select
        value={item.widthMode}
        className={`${compactInputClassName} h-8 py-0 text-[12px]`}
        style={{ width: 112 }}
        onClick={(event) => event.stopPropagation()}
        onChange={(event) => onChange({ widthMode: event.target.value as SiteNavigationTopBarItemWidthMode })}
      >
        {(Object.keys(topBarItemWidthModeLabels) as SiteNavigationTopBarItemWidthMode[]).map((widthMode) => (
          <option key={widthMode} value={widthMode}>{topBarItemWidthModeLabels[widthMode]}</option>
        ))}
      </select>
      <div className="flex items-center gap-1.5">
        <label className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-500" onClick={(event) => event.stopPropagation()}>
          <span>Pred</span>
          <TopBarUnitNumberInput
            value={item.marginBeforePx}
            min={0}
            max={128}
            className="w-[70px]"
            inputClassName="w-8"
            ariaLabel={`Odmik pred ${topBarLayoutLabels[item.id]}`}
            stopPropagation
            onChange={(marginBeforePx) => onChange({ marginBeforePx })}
          />
        </label>
        <label className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-500" onClick={(event) => event.stopPropagation()}>
          <span>Po</span>
          <TopBarUnitNumberInput
            value={item.marginAfterPx}
            min={0}
            max={128}
            className="w-[70px]"
            inputClassName="w-8"
            ariaLabel={`Odmik po ${topBarLayoutLabels[item.id]}`}
            stopPropagation
            onChange={(marginAfterPx) => onChange({ marginAfterPx })}
          />
        </label>
      </div>
      <TopBarUnitNumberInput
        value={resolvedWidth}
        min={minimumFixedWidth}
        max={1200}
        disabled={item.widthMode !== 'fixed'}
        className="w-[82px]"
        inputClassName="w-9"
        ariaLabel={`Širina za ${topBarLayoutLabels[item.id]}`}
        stopPropagation
        onChange={(fixedWidthPx) => onChange({ fixedWidthPx })}
      />
      <div className="flex items-center justify-center gap-2">
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
        <div ref={menuRef} className="relative" onClick={(event) => event.stopPropagation()}>
          <button
            type="button"
            aria-label={`Možnosti za ${topBarLayoutLabels[item.id]}`}
            className={`${adminMiniIconButtonTokenClasses} ${menuOpen ? '!text-[color:var(--blue-500)]' : ''}`}
            onClick={() => setMenuOpen((current) => !current)}
          >
            <DotsGlyph className="h-4 w-4" />
          </button>
          {menuOpen ? (
            <MenuPanel className="absolute right-0 top-full z-[90] mt-1 w-40 p-1">
              <button
                type="button"
                className={adminActionMenuItemTokenClasses.base}
                onClick={() => {
                  onReset();
                  setMenuOpen(false);
                }}
              >
                Ponastavi
              </button>
            </MenuPanel>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function SortableActionPriorityRow({ id }: { id: SiteNavigationTopBarActionId }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`flex h-9 items-center gap-2 rounded-lg border border-slate-200 bg-white px-2 text-[12px] font-medium text-slate-700 ${isDragging ? 'z-20 opacity-80' : ''}`}
      {...attributes}
      {...listeners}
    >
      <DragGlyph className="h-4 w-4 text-slate-400" />
      <span>{topBarActionLabels[id]}</span>
    </div>
  );
}

function TopBarDeviceSettingsPanel({
  device,
  settings,
  onChange
}: {
  device: SiteNavigationTopBarDevice;
  settings: SiteNavigationTopBarResponsiveSettings;
  onChange: (updates: Partial<SiteNavigationTopBarResponsiveSettings>) => void;
}) {
  const priority = settings.actionPriority ?? ['cart', 'search', 'ai'];
  const prioritySensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const updateNumber = (key: keyof SiteNavigationTopBarResponsiveSettings) => (value: number) => onChange({ [key]: value });

  if (device === 'tablet') {
    return (
      <aside className="min-w-0 rounded-xl border border-slate-200 bg-white p-4">
        <h3 className="text-base font-semibold text-slate-900">Nastavitve za tablico</h3>
        <div className="mt-4 grid gap-4">
          <TopBarSettingsGroup title="Prelomna širina" help={topBarHelpCopy.breakpoint}>
            <div className="grid grid-cols-2 gap-3">
              <TopBarNumberField label="Tablica od" help={topBarHelpCopy.breakpoint} value={settings.breakpointFrom ?? 768} min={320} max={1920} onChange={updateNumber('breakpointFrom')} />
              <TopBarNumberField label="Tablica do" help={topBarHelpCopy.breakpoint} value={settings.breakpointTo ?? 1024} min={320} max={1920} onChange={updateNumber('breakpointTo')} />
            </div>
          </TopBarSettingsGroup>
          <TopBarSettingsGroup title="Navigacija" help={topBarHelpCopy.tabletNavigation}>
            <TopBarSegmentedControl<SiteNavigationTopBarNavigationMode>
              value={settings.navigationMode ?? 'condensed'}
              options={[
                { value: 'full', label: 'Polna' },
                { value: 'condensed', label: 'Strnjena' },
                { value: 'hamburger', label: 'Hamburger' }
              ]}
              onChange={(navigationMode) => onChange({ navigationMode })}
            />
            {settings.navigationMode === 'condensed' ? (
              <TopBarNumberField label="Največ prikazanih povezav" help={topBarHelpCopy.maxVisibleLinks} value={settings.maxVisibleLinks ?? 3} min={1} max={8} suffix="" onChange={updateNumber('maxVisibleLinks')} />
            ) : null}
          </TopBarSettingsGroup>
        </div>
      </aside>
    );
  }

  if (device === 'mobile') {
    return (
      <aside className="min-w-0 rounded-xl border border-slate-200 bg-white p-4">
        <h3 className="text-base font-semibold text-slate-900">Nastavitve za mobilno</h3>
        <div className="mt-4 grid gap-4">
          <TopBarSettingsGroup title="Prelomna širina" help={topBarHelpCopy.breakpoint}>
            <TopBarNumberField label="Mobilno do" help={topBarHelpCopy.breakpoint} value={settings.breakpointTo ?? 767} min={320} max={1200} onChange={updateNumber('breakpointTo')} />
          </TopBarSettingsGroup>
          <TopBarSettingsGroup title="Vzorec vrstice" help={topBarHelpCopy.rowPattern}>
            <TopBarSegmentedControl<SiteNavigationTopBarRowPattern>
              value={settings.rowPattern ?? 'single'}
              options={[{ value: 'single', label: 'Ena vrstica' }, { value: 'double', label: 'Dve vrstici' }]}
              onChange={(rowPattern) => onChange({ rowPattern, searchMode: rowPattern === 'single' && settings.searchMode === 'secondRow' ? 'menu' : settings.searchMode })}
            />
            {settings.rowPattern === 'double' ? (
              <div className="grid gap-1.5">
                <TopBarHelpLabel help={topBarHelpCopy.secondRow} align="right" className="text-[12px] font-medium leading-none text-slate-600">
                  Druga vrstica
                </TopBarHelpLabel>
              <TopBarSegmentedControl<SiteNavigationTopBarSecondRow>
                value={settings.secondRow ?? 'search'}
                options={[{ value: 'search', label: 'Iskanje' }, { value: 'navigation', label: 'Navigacija' }]}
                onChange={(secondRow) => onChange({ secondRow })}
              />
              </div>
            ) : null}
          </TopBarSettingsGroup>
          <TopBarSettingsGroup title="Navigacija" help={topBarHelpCopy.mobileNavigation}>
            <div className="inline-flex h-9 items-center rounded-lg border border-slate-200 bg-slate-50 px-3 text-[12px] font-medium text-slate-500">Hamburger meni</div>
            <TopBarSegmentedControl<NonNullable<SiteNavigationTopBarResponsiveSettings['menuOpenMode']>>
              value={settings.menuOpenMode ?? 'drawer'}
              options={[{ value: 'drawer', label: 'Z leve' }, { value: 'fullscreen', label: 'Celozaslonsko' }]}
              onChange={(menuOpenMode) => onChange({ menuOpenMode })}
            />
          </TopBarSettingsGroup>
          <TopBarSettingsGroup title="Prioriteta akcij" help={topBarHelpCopy.actionPriority}>
            <DndContext
              id="top-bar-mobile-action-priority"
              sensors={prioritySensors}
              collisionDetection={closestCenter}
              onDragEnd={(event) => {
                const { active, over } = event;
                if (!over || active.id === over.id) return;
                const oldIndex = priority.indexOf(active.id as SiteNavigationTopBarActionId);
                const newIndex = priority.indexOf(over.id as SiteNavigationTopBarActionId);
                onChange({ actionPriority: arrayMove(priority, oldIndex, newIndex) });
              }}
            >
              <SortableContext items={priority} strategy={rectSortingStrategy}>
                <div className="grid gap-2">
                  {priority.map((id) => <SortableActionPriorityRow key={id} id={id} />)}
                </div>
              </SortableContext>
            </DndContext>
            <p className="text-[12px] leading-5 text-slate-500">Nižje prioritete se premaknejo v meni, ko zmanjka prostora.</p>
          </TopBarSettingsGroup>
          <TopBarSettingsGroup title="Iskanje" help={topBarHelpCopy.mobileSearch}>
            <TopBarSegmentedControl<SiteNavigationTopBarSearchMode>
              value={settings.searchMode ?? 'menu'}
              options={[
                { value: 'menu', label: 'V meniju' },
                { value: 'icon', label: 'Ikona' },
                { value: 'secondRow', label: 'Druga vrstica', disabled: settings.rowPattern !== 'double' }
              ]}
              onChange={(searchMode) => onChange({ searchMode })}
            />
          </TopBarSettingsGroup>
          <div className="border-t border-slate-100 pt-4">
            <TopBarToggle label="Varno območje" help={topBarHelpCopy.safeArea} checked={settings.safeArea !== false} onChange={(safeArea) => onChange({ safeArea })} />
          </div>
        </div>
      </aside>
    );
  }

  return null;
}

function TopBarLayoutEditor({
  siteLayout,
  layout,
  initialLayout,
  items,
  onChange,
  onSiteLayoutChange,
  onSetInitialLayout
}: {
  siteLayout: SiteNavigationSiteLayoutSettings;
  layout: SiteNavigationTopBarLayout;
  initialLayout: SiteNavigationTopBarLayout;
  items: SiteNavigationTopLevelItem[];
  onChange: (updater: (current: SiteNavigationTopBarLayout) => SiteNavigationTopBarLayout) => void;
  onSiteLayoutChange: (updates: Partial<SiteNavigationSiteLayoutSettings>) => void;
  onSetInitialLayout: (layout: SiteNavigationTopBarLayout) => void;
}) {
  const [showHeaderPreview, setShowHeaderPreview] = useState(false);
  const [showTechnicalOverlay, setShowTechnicalOverlay] = useState(false);
  const [device, setDevice] = useState<SiteNavigationTopBarDevice>('desktop');
  const [selectedElementId, setSelectedElementId] = useState<SiteNavigationTopBarElementId>('navigation');
  const deviceLayout = layout.responsive[device];
  const defaultDeviceLayout = initialLayout.responsive[device];
  const layoutItems = sortedResponsiveItems(deviceLayout.items);
  const previewNavigation = useMemo(
    () =>
      normalizeSiteNavigationConfig({
        siteLayout,
        items,
        topBarLayout: layout,
        topBarInitialLayout: initialLayout,
        updatedAt: null
      } satisfies SiteNavigationConfig),
    [initialLayout, items, layout, siteLayout]
  );

  useEffect(() => {
    window.dispatchEvent(
      new CustomEvent(adminSiteNavigationPreviewEventName, {
        detail: showHeaderPreview
          ? {
              enabled: true,
              navigation: previewNavigation
            }
          : { enabled: false }
      })
    );
  }, [previewNavigation, showHeaderPreview]);

  useEffect(() => {
    return () => {
      window.dispatchEvent(new CustomEvent(adminSiteNavigationPreviewEventName, { detail: { enabled: false } }));
    };
  }, []);

  const updateDeviceLayout = (
    updater: (current: SiteNavigationTopBarLayout['responsive'][SiteNavigationTopBarDevice]) => SiteNavigationTopBarLayout['responsive'][SiteNavigationTopBarDevice]
  ) => {
    onChange((current) => updateResponsiveLayout(current, device, updater));
  };

  const updateDeviceItem = (id: SiteNavigationTopBarElementId, updates: Partial<SiteNavigationTopBarResponsiveItem>) => {
    updateDeviceLayout((current) => ({
      ...current,
      items: current.items.map((item) => (item.id === id ? { ...item, ...updates } : item))
    }));
  };

  const updateSettings = (updates: Partial<SiteNavigationTopBarResponsiveSettings>) => {
    updateDeviceLayout((current) => ({
      ...current,
      settings: { ...current.settings, ...updates }
    }));
  };

  const resetDeviceItem = (id: SiteNavigationTopBarElementId) => {
    const defaultItem = defaultDeviceLayout.items.find((item) => item.id === id);
    if (!defaultItem) return;
    updateDeviceItem(id, defaultItem);
  };

  const rowSettingLimits = topBarRowSettingLimits[device];
  const hasDeviceSettingsPanel = device !== 'desktop';
  const selectedDevicePreviewWidth = device === 'desktop' ? siteLayout.siteContentMaxWidthPx : topBarDevicePreviewWidths[device];

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="text-lg font-semibold text-slate-900">Zgornja vrstica</h2>
          <TopBarToggle
            label="Predogled"
            checked={showHeaderPreview}
            onChange={setShowHeaderPreview}
            frameless
            simulatorStyle
            hideLabel
          />
        </div>
        <div className="flex items-center gap-2">
          <IconButton
            type="button"
            size="sm"
            tone="neutral"
            className={adminTableNeutralIconButtonClassName}
            aria-label="Ponastavi na začetne nastavitve"
            title="Ponastavi na začetne nastavitve"
            onClick={() => onChange(() => cloneTopBarLayout(initialLayout))}
          >
            <ActionUndoIcon />
          </IconButton>
          <Button
            type="button"
            variant="primary"
            size="toolbar"
            className={`gap-2 whitespace-nowrap ${adminTablePrimaryButtonClassName}`}
            onClick={() => onSetInitialLayout(cloneTopBarLayout(layout))}
          >
            <SaveIcon className="h-4 w-4" />
            Nastavi kot privzete nastavitve
          </Button>
        </div>
      </div>

      <div className={`grid min-w-0 items-start gap-4 ${hasDeviceSettingsPanel ? 'min-[1680px]:grid-cols-[minmax(0,1fr)_320px]' : ''}`}>
        <div className="grid min-w-0 gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
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
              <button
                type="button"
                className={`inline-flex h-8 items-center gap-1.5 rounded-md px-2.5 text-[12px] font-medium leading-none transition ${adminControlFocusTokenClasses} ${
                  showTechnicalOverlay ? 'text-[color:var(--blue-500)]' : 'text-slate-500 hover:text-[color:var(--blue-500)]'
                }`}
                onClick={() => setShowTechnicalOverlay((current) => !current)}
              >
                <TopBarHelpLabel help={topBarHelpCopy.previewGrid} align="left" className="text-[12px] font-medium leading-none">
                  Mreža
                </TopBarHelpLabel>
              </button>
            </div>
          </div>

          <TopBarResponsivePreview
            device={device}
            siteLayout={siteLayout}
            settings={deviceLayout.settings}
            navigation={previewNavigation}
            showOverlay={showTechnicalOverlay}
          />

          <div className="grid min-w-0 justify-start gap-4 border-t border-slate-100 pt-4 min-[1100px]:grid-cols-[auto_auto]">
            <TopBarCompactSettingsGroup title="Način">
              <div className="flex min-w-0 flex-wrap items-end gap-3">
                <div className="grid gap-1.5">
                  <TopBarHelpLabel help={topBarHelpCopy.widthMode} align="right" className="text-[12px] font-medium leading-none text-slate-600">
                    Širina
                  </TopBarHelpLabel>
                  <div className="flex min-w-0 items-center gap-2">
                    <TopBarSegmentedControl<SiteNavigationTopBarWidthMode>
                      value={deviceLayout.settings.widthMode}
                      options={[
                        { value: 'match_content', label: topBarWidthModeLabels.match_content },
                        { value: 'custom', label: topBarWidthModeLabels.custom },
                        { value: 'full', label: topBarWidthModeLabels.full }
                      ]}
                      onChange={(widthMode) => updateSettings({ widthMode })}
                    />
                  </div>
                </div>
                {deviceLayout.settings.widthMode === 'custom' ? (
                  <TopBarMiniNumberField
                    label="Max širina"
                    help={topBarHelpCopy.customWidth}
                    value={deviceLayout.settings.customMaxWidthPx ?? siteLayout.siteContentMaxWidthPx}
                    min={640}
                    max={2400}
                    onChange={(customMaxWidthPx) => updateSettings({ customMaxWidthPx })}
                  />
                ) : null}
                <div className="grid gap-1.5">
                  <TopBarHelpLabel help={topBarHelpCopy.layoutMode} align="right" className="text-[12px] font-medium leading-none text-slate-600">
                    Postavitev
                  </TopBarHelpLabel>
                  <TopBarSegmentedControl<SiteNavigationTopBarConstraintLayoutMode>
                    value={deviceLayout.settings.layoutMode}
                    options={[
                      { value: 'centered_nav', label: topBarConstraintLayoutModeLabels.centered_nav },
                      { value: 'flow', label: topBarConstraintLayoutModeLabels.flow }
                    ]}
                    onChange={(layoutMode) => updateSettings({ layoutMode })}
                  />
                </div>
              </div>
            </TopBarCompactSettingsGroup>

            <TopBarCompactSettingsGroup title="Kontejner">
              <div className="grid grid-cols-[88px_72px_72px_72px_72px_72px] gap-2">
                <TopBarMiniNumberField
                  label="Širina"
                  help={topBarHelpCopy.siteContentWidth}
                  value={siteLayout.siteContentMaxWidthPx}
                  min={960}
                  max={1920}
                  onChange={(siteContentMaxWidthPx) => onSiteLayoutChange({ siteContentMaxWidthPx })}
                />
                <TopBarMiniNumberField
                  label="Višina"
                  help={topBarHelpCopy.topBarHeight}
                  value={deviceLayout.settings.height}
                  min={rowSettingLimits.height.min}
                  max={rowSettingLimits.height.max}
                  onChange={(height) => updateSettings({ height })}
                />
                <TopBarMiniNumberField
                  label="Rob min"
                  help={topBarHelpCopy.gutterMin}
                  value={siteLayout.siteGutterMinPx}
                  min={0}
                  max={64}
                  onChange={(siteGutterMinPx) => onSiteLayoutChange({ siteGutterMinPx })}
                />
                <TopBarMiniNumberField
                  label="Rob max"
                  help={topBarHelpCopy.gutterMax}
                  value={siteLayout.siteGutterMaxPx}
                  min={0}
                  max={96}
                  onChange={(siteGutterMaxPx) => onSiteLayoutChange({ siteGutterMaxPx })}
                />
                <TopBarMiniNumberField
                  label="Stolpci"
                  help={topBarHelpCopy.columnGap}
                  value={deviceLayout.settings.columnGapPx}
                  min={0}
                  max={96}
                  onChange={(columnGapPx) => updateSettings({ columnGapPx })}
                />
                <TopBarMiniNumberField
                  label="Elementi"
                  help={topBarHelpCopy.itemGap}
                  value={deviceLayout.settings.itemGapPx}
                  min={0}
                  max={64}
                  onChange={(itemGapPx) => updateSettings({ itemGapPx })}
                />
              </div>
            </TopBarCompactSettingsGroup>
          </div>

          <div className="min-w-0">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-[13px] font-semibold text-slate-900">Elementi v vrstici</h3>
                </div>
                <span className="rounded-md bg-slate-50 px-2 py-1 text-[11px] font-medium text-slate-500">{selectedDevicePreviewWidth}px</span>
              </div>
              <div className="overflow-x-auto rounded-xl border border-slate-200">
                <div className={`grid ${topBarElementRowMinWidthClassName} ${topBarElementRowGridClassName} gap-3 border-b border-slate-100 bg-slate-50 px-3 py-2 text-[12px] font-medium text-slate-500`}>
                  <span>Element</span>
                  <TopBarHelpLabel help={topBarHelpCopy.slot} className="justify-center text-center">Pozicija</TopBarHelpLabel>
                  <TopBarHelpLabel help={topBarHelpCopy.order} className="justify-center text-center">Red</TopBarHelpLabel>
                  <TopBarHelpLabel help={topBarHelpCopy.widthModeColumn} className="justify-center text-center">Način širine</TopBarHelpLabel>
                  <TopBarHelpLabel help={topBarHelpCopy.offsetsColumn} className="justify-center text-center">Odmiki</TopBarHelpLabel>
                  <TopBarHelpLabel help={topBarHelpCopy.widthColumn} className="justify-center text-center">Širina</TopBarHelpLabel>
                  <TopBarHelpLabel help={topBarHelpCopy.editColumn} align="right" className="justify-center text-center">Uredi</TopBarHelpLabel>
                </div>
                {layoutItems.map((item, index) => (
                  <TopBarElementRow
                    key={item.id}
                    item={item}
                    device={device}
                    settings={deviceLayout.settings}
                    items={items}
                    selected={selectedElementId === item.id}
                    isLast={index === layoutItems.length - 1}
                    onSelect={() => setSelectedElementId(item.id)}
                    onChange={(updates) => updateDeviceItem(item.id, updates)}
                    onReset={() => resetDeviceItem(item.id)}
                  />
                ))}
              </div>
          </div>
        </div>

        {hasDeviceSettingsPanel ? <TopBarDeviceSettingsPanel device={device} settings={deviceLayout.settings} onChange={updateSettings} /> : null}
      </div>
    </section>
  );
}

function LegacyTopBarLayoutEditor({
  layout,
  initialLayout,
  items,
  onChange,
  onSetInitialLayout
}: {
  layout: SiteNavigationTopBarLayout;
  initialLayout: SiteNavigationTopBarLayout;
  items: SiteNavigationTopLevelItem[];
  onChange: (updater: (current: SiteNavigationTopBarLayout) => SiteNavigationTopBarLayout) => void;
  onSetInitialLayout: (layout: SiteNavigationTopBarLayout) => void;
}) {
  const [showHeaderPreview, setShowHeaderPreview] = useState(false);
  const [previewDevice, setPreviewDevice] = useState<TopBarPreviewDevice>('desktop');
  const [selectedElementId, setSelectedElementId] = useState<SiteNavigationTopBarElementId>('navigation');
  const [editingElementId, setEditingElementId] = useState<SiteNavigationTopBarElementId | null>(null);
  const [openElementMenuId, setOpenElementMenuId] = useState<SiteNavigationTopBarElementId | null>(null);
  const [dragState, setDragState] = useState<{
    id: SiteNavigationTopBarElementId;
    startX: number;
    startOffset: number;
  } | null>(null);
  const onChangeRef = useRef(onChange);
  const elementMenuRef = useRef<HTMLDivElement | null>(null);
  const elementMenuDismissRefs = useMemo(() => [elementMenuRef], []);
  const selectedElement = layout.items.some((item) => item.id === selectedElementId)
    ? selectedElementId
    : layout.items[0]?.id ?? 'logo';

  useDropdownDismiss({ open: openElementMenuId !== null, refs: elementMenuDismissRefs, onClose: () => setOpenElementMenuId(null) });

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    window.dispatchEvent(
      new CustomEvent(adminSiteNavigationPreviewEventName, {
        detail: showHeaderPreview
          ? {
              enabled: true,
              navigation: {
                siteLayout: cloneDefaultSiteNavigationConfig().siteLayout,
                items,
                topBarLayout: layout,
                topBarInitialLayout: initialLayout,
                updatedAt: null
              } satisfies SiteNavigationConfig
            }
          : { enabled: false }
      })
    );
  }, [initialLayout, items, layout, showHeaderPreview]);

  useEffect(() => {
    return () => {
      window.dispatchEvent(
        new CustomEvent(adminSiteNavigationPreviewEventName, {
          detail: { enabled: false }
        })
      );
    };
  }, []);

  const updateOffset = (id: SiteNavigationTopBarElementId, offset: unknown) => {
    onChange((current) => ({
      ...current,
      mode: 'manual',
      items: current.items.map((item) =>
        item.id === id ? { ...item, offset: normalizeSiteNavigationTopBarOffset(offset) } : item
      )
    }));
  };

  const stepOffset = (id: SiteNavigationTopBarElementId, delta: number) => {
    const currentOffset = layout.items.find((item) => item.id === id)?.offset ?? 0;
    updateOffset(id, currentOffset + delta);
  };

  const updateElementVisibility = (id: SiteNavigationTopBarElementId, visible: boolean) => {
    onChange((current) => ({
      ...current,
      items: current.items.map((item) => (item.id === id ? { ...item, visible } : item))
    }));
  };

  const setElementZone = (id: SiteNavigationTopBarElementId, zone: TopBarZone) => {
    updateOffset(id, getTopBarOffsetForZone(id, zone));
  };

  const resetToInitialLayout = () => {
    onChange(() => cloneTopBarLayout(initialLayout));
  };

  const saveAsInitialLayout = () => {
    onSetInitialLayout(cloneTopBarLayout(layout));
  };

  useEffect(() => {
    if (!dragState) return undefined;

    const handlePointerMove = (event: PointerEvent) => {
      const nextOffset = normalizeSiteNavigationTopBarOffset(dragState.startOffset + event.clientX - dragState.startX);
      onChangeRef.current((current) => ({
        ...current,
        mode: 'manual',
        items: current.items.map((item) => (item.id === dragState.id ? { ...item, offset: nextOffset } : item))
      }));
    };

    const handlePointerUp = () => {
      setDragState(null);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp, { once: true });

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, [dragState]);

  const startDrag = (id: SiteNavigationTopBarElementId, event: ReactPointerEvent<HTMLButtonElement>) => {
    const item = layout.items.find((currentItem) => currentItem.id === id);
    event.preventDefault();
    setSelectedElementId(id);
    setDragState({
      id,
      startX: event.clientX,
      startOffset: item?.offset ?? 0
    });
  };

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-slate-900">Zgornja vrstica</h2>
      </div>

      <div className="grid gap-4">
        <div>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="text-[13px] font-semibold text-slate-900">Predogled v živo</h3>
              <p className="mt-1 text-[12px] leading-5 text-slate-500">
                Povlecite element v predogledu ali prilagodite odmik v nastavitvah.
              </p>
            </div>
            <div className="flex items-center gap-2">
              {(Object.keys(topBarPreviewDeviceLabels) as TopBarPreviewDevice[]).map((device) => (
                <button
                  key={device}
                  type="button"
                  className={`inline-flex h-7 items-center gap-1.5 rounded-md px-2 text-[12px] font-medium leading-none transition ${adminControlFocusTokenClasses} ${
                    previewDevice === device
                      ? 'text-[color:var(--blue-500)]'
                      : 'text-slate-500 hover:text-[color:var(--blue-500)]'
                  }`}
                  onClick={() => setPreviewDevice(device)}
                >
                  <AdminTopBarDeviceGlyph device={device} />
                  {topBarPreviewDeviceLabels[device]}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-4 overflow-x-auto">
            <div
              className="relative h-[58px] min-w-[360px] overflow-hidden rounded-lg border border-slate-200 bg-white"
              style={{ width: topBarPreviewDeviceWidths[previewDevice], maxWidth: '100%', ...topBarPreviewFontStyle }}
            >
              {layout.items.filter((item) => item.visible).map((item) => {
                const active = dragState?.id === item.id || selectedElement === item.id;
                const framedPreviewElement = item.id === 'ai';
                return (
                  <button
                    key={item.id}
                    type="button"
                    onPointerDown={(event) => startDrag(item.id, event)}
                    className={`absolute top-1/2 inline-flex h-9 -translate-y-1/2 cursor-grab items-center justify-center rounded-lg border px-0 text-[13px] leading-5 transition active:cursor-grabbing ${
                      active ? 'z-20' : 'z-10'
                    } ${
                      active && !framedPreviewElement
                        ? 'border-[color:var(--blue-500)] bg-[color:var(--blue-50)]/80 text-[color:var(--blue-500)]'
                        : framedPreviewElement
                          ? 'border-transparent bg-transparent text-slate-700'
                          : 'border-transparent bg-transparent text-slate-700 hover:bg-[color:var(--hover-neutral)] hover:text-[color:var(--blue-500)]'
                    } ${adminControlFocusTokenClasses}`}
                    style={{
                      left: `${topBarLayoutBasePositions[item.id]}%`,
                      width: topBarLayoutElementWidths[item.id],
                      transform: `translateX(calc(-50% + ${item.offset}px)) translateY(-50%)`
                    }}
                  >
                    <span className="pointer-events-none min-w-0 overflow-hidden">
                      <AdminTopBarElementPreview id={item.id} items={items} highlighted={active} />
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
          <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div>
            <h3 className="text-[13px] font-semibold text-slate-900">Elementi v vrstici</h3>
            <p className="mt-1 text-[12px] leading-5 text-slate-500">
              Izberite element za podrobne nastavitve.
            </p>
            <div className="mt-3 overflow-hidden rounded-xl border border-slate-200">
              {layout.items.map((item) => {
                const zone = getTopBarZone(layout, item.id);
                const selected = selectedElement === item.id;
                const editing = editingElementId === item.id;
                const menuOpen = openElementMenuId === item.id;

                return (
                  <Fragment key={item.id}>
                    <div
                      role="button"
                      tabIndex={0}
                      className={`group grid ${
                        editing
                          ? 'grid-cols-[24px_36px_minmax(0,1fr)_minmax(174px,230px)_32px_minmax(150px,190px)_24px]'
                          : 'grid-cols-[24px_36px_minmax(0,1fr)_auto_32px_auto_24px]'
                      } items-center gap-3 border-b border-slate-100 px-3 py-1.5 text-left transition ${adminControlFocusTokenClasses} ${
                        selected || editing ? 'bg-[color:var(--hover-neutral)]' : 'bg-white hover:bg-[color:var(--hover-neutral)]'
                      } ${item.visible ? '' : 'text-slate-400'}`}
                      onClick={() => setSelectedElementId(item.id)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault();
                          setSelectedElementId(item.id);
                        }
                      }}
                    >
                      <span className="inline-flex justify-center text-slate-400 group-hover:text-[color:var(--blue-500)]">
                        <DragGlyph className="h-4 w-4" />
                      </span>
                      <AdminTopBarElementBadge id={item.id} selected={selected || editing} />
                      <span className="min-w-0">
                        <span className={`block truncate text-[13px] font-semibold leading-5 ${item.visible ? 'text-slate-900' : 'text-slate-400'}`}>
                          {topBarLayoutLabels[item.id]}
                        </span>
                      </span>
                      {editing ? (
                        <div className="grid grid-cols-3 gap-1 rounded-lg border border-slate-200 bg-slate-50 p-1" onPointerDown={(event) => event.stopPropagation()}>
                          {(Object.keys(topBarZoneLabels) as TopBarZone[]).map((currentZone) => (
                            <button
                              key={currentZone}
                              type="button"
                              className={`h-7 rounded-md text-[12px] font-medium leading-none transition ${adminControlFocusTokenClasses} ${
                                zone === currentZone ? 'bg-white text-[color:var(--blue-500)] shadow-sm' : 'text-slate-500 hover:text-[color:var(--blue-500)]'
                              }`}
                              onClick={(event) => {
                                event.stopPropagation();
                                setElementZone(item.id, currentZone);
                              }}
                            >
                              {topBarZoneLabels[currentZone]}
                            </button>
                          ))}
                        </div>
                      ) : (
                        <span className={`rounded-md px-2 py-1 text-[11px] font-medium leading-none ${topBarZoneToneClassNames[zone]}`}>
                          {topBarZoneLabels[zone]}
                        </span>
                      )}
                      {editing ? (
                        <button
                          type="button"
                          aria-label={item.visible ? `Skrij ${topBarLayoutLabels[item.id]}` : `Prikaži ${topBarLayoutLabels[item.id]}`}
                          className={`${adminMiniIconButtonTokenClasses} justify-self-center ${item.visible ? '' : '!text-slate-400'}`}
                          onPointerDown={(event) => event.stopPropagation()}
                          onClick={(event) => {
                            event.stopPropagation();
                            updateElementVisibility(item.id, !item.visible);
                          }}
                        >
                          <EyeGlyph visible={item.visible} className="h-4 w-4" />
                        </button>
                      ) : (
                        <span
                          aria-label={item.visible ? 'Prikazano' : 'Skrito'}
                          className={`inline-flex h-8 w-8 items-center justify-center justify-self-center ${item.visible ? 'text-slate-500' : 'text-slate-400'}`}
                        >
                          <EyeGlyph visible={item.visible} className="h-4 w-4" />
                        </span>
                      )}
                      {editing ? (
                        <div
                          className="inline-flex h-8 items-center justify-self-end overflow-hidden rounded-md border border-slate-200 bg-white text-[12px] font-medium text-slate-600"
                          onPointerDown={(event) => event.stopPropagation()}
                        >
                          <button
                            type="button"
                            className={`inline-flex h-full w-8 items-center justify-center border-r border-slate-200 transition hover:text-[color:var(--blue-500)] ${adminControlFocusTokenClasses}`}
                            onClick={(event) => {
                              event.stopPropagation();
                              stepOffset(item.id, -SITE_NAVIGATION_TOP_BAR_OFFSET_STEP);
                            }}
                            aria-label={`Zmanjšaj odmik za ${topBarLayoutLabels[item.id]}`}
                          >
                            -
                          </button>
                          <label className="inline-flex h-full items-center px-2">
                            <input
                              type="number"
                              min={SITE_NAVIGATION_TOP_BAR_OFFSET_MIN}
                              max={SITE_NAVIGATION_TOP_BAR_OFFSET_MAX}
                              step={SITE_NAVIGATION_TOP_BAR_OFFSET_STEP}
                              value={item.offset}
                              onChange={(event) => updateOffset(item.id, event.target.value)}
                              onClick={(event) => event.stopPropagation()}
                              className={`h-7 w-12 bg-transparent text-right text-[12px] outline-none ${numberInputNoSpinnerClassName}`}
                              aria-label={`${topBarLayoutLabels[item.id]} odmik v px`}
                            />
                            <span className="ml-1 text-slate-400">px</span>
                          </label>
                          <button
                            type="button"
                            className={`inline-flex h-full w-8 items-center justify-center border-l border-slate-200 transition hover:text-[color:var(--blue-500)] ${adminControlFocusTokenClasses}`}
                            onClick={(event) => {
                              event.stopPropagation();
                              stepOffset(item.id, SITE_NAVIGATION_TOP_BAR_OFFSET_STEP);
                            }}
                            aria-label={`Povečaj odmik za ${topBarLayoutLabels[item.id]}`}
                          >
                            +
                          </button>
                        </div>
                      ) : (
                        <span className={`min-w-[46px] text-right text-[12px] font-medium leading-none ${item.visible ? 'text-slate-500' : 'text-slate-400'}`}>
                          {formatTopBarOffset(item.offset)}
                        </span>
                      )}
                      <div
                        ref={menuOpen ? elementMenuRef : undefined}
                        className={`relative justify-self-end ${menuOpen ? 'z-[80]' : 'z-10'}`}
                        onPointerDown={(event) => event.stopPropagation()}
                      >
                        <button
                          type="button"
                          aria-label={`Možnosti za ${topBarLayoutLabels[item.id]}`}
                          aria-expanded={menuOpen}
                          className={`${adminMiniIconButtonTokenClasses} opacity-75 group-hover:opacity-100 ${menuOpen ? '!text-[color:var(--blue-500)]' : ''}`}
                          onClick={(event) => {
                            event.stopPropagation();
                            setSelectedElementId(item.id);
                            setOpenElementMenuId((current) => (current === item.id ? null : item.id));
                          }}
                        >
                          <DotsGlyph className="h-4 w-4" />
                        </button>
                        {menuOpen ? (
                          <MenuPanel className="absolute right-0 top-full z-[90] mt-1 w-32">
                            <button
                              type="button"
                              className={adminActionMenuItemTokenClasses.base}
                              onClick={(event) => {
                                event.stopPropagation();
                                setSelectedElementId(item.id);
                                setEditingElementId((current) => (current === item.id ? null : item.id));
                                setOpenElementMenuId(null);
                              }}
                            >
                              Uredi
                            </button>
                            <button
                              type="button"
                              className={item.visible ? adminActionMenuItemTokenClasses.danger : adminActionMenuItemTokenClasses.flex}
                              onClick={(event) => {
                                event.stopPropagation();
                                updateElementVisibility(item.id, !item.visible);
                                if (item.visible) setEditingElementId(null);
                                setOpenElementMenuId(null);
                              }}
                            >
                              <span>{item.visible ? 'Izbriši' : 'Prikaži'}</span>
                              {item.visible ? <TrashCanIcon className="h-3.5 w-3.5" /> : <EyeGlyph visible className="h-3.5 w-3.5" />}
                            </button>
                          </MenuPanel>
                        ) : null}
                      </div>
                    </div>
                  </Fragment>
                );
              })}
            </div>
            </div>
          </div>

        <aside className="rounded-xl border border-slate-200 bg-white p-4">
          <div>
            <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">Prikaz</div>
            <button
              type="button"
              role="switch"
              aria-checked={showHeaderPreview}
              className={`flex h-9 w-full items-center justify-between rounded-lg border px-3 text-[12px] font-medium transition ${adminControlFocusTokenClasses} ${
                showHeaderPreview
                  ? 'border-[color:var(--blue-500)] bg-[color:var(--blue-50)] text-[color:var(--blue-500)]'
                  : 'border-slate-200 bg-white text-slate-600 hover:text-[color:var(--blue-500)]'
              }`}
              onClick={() => setShowHeaderPreview((current) => !current)}
            >
              <span>Predogled</span>
              <span
                className={`relative h-5 w-9 rounded-full transition ${
                  showHeaderPreview ? 'bg-[color:var(--blue-500)]' : 'bg-slate-200'
                }`}
              >
                <span
                  className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition ${
                    showHeaderPreview ? 'left-[18px]' : 'left-0.5'
                  }`}
                />
              </span>
            </button>
          </div>

          <div className="mt-4 border-t border-slate-100 pt-4">
            <div className="flex items-center gap-2">
              <IconButton
                type="button"
                size="sm"
                tone="neutral"
                className={adminTableNeutralIconButtonClassName}
                aria-label="Ponastavi na začetne nastavitve"
                title="Ponastavi na začetne nastavitve"
                onClick={resetToInitialLayout}
              >
                <ActionUndoIcon />
              </IconButton>
              <Button
                type="button"
                variant="primary"
                size="toolbar"
                className={`gap-2 whitespace-nowrap ${adminTablePrimaryButtonClassName}`}
                onClick={saveAsInitialLayout}
              >
                <SaveIcon className="h-4 w-4" />
                Nastavi kot privzete nastavitve
              </Button>
            </div>
          </div>

        </aside>
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
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
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
      className={`relative h-8 w-8 shrink-0 ${open ? 'z-[80]' : 'z-10'}`}
      onPointerDown={(event) => event.stopPropagation()}
      onBlur={(event) => {
        const nextFocus = event.relatedTarget;
        if (nextFocus instanceof Node && event.currentTarget.contains(nextFocus)) return;
        setOpen(false);
      }}
    >
      <button
        type="button"
        aria-label={label}
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
  ariaLabel
}: {
  value: string;
  onChange: (value: string) => void;
  className: string;
  inputClassName?: string;
  style?: CSSProperties;
  placeholder?: string;
  ariaLabel: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);

  useEffect(() => {
    if (!editing) setDraft(value);
  }, [editing, value]);

  const commit = () => {
    onChange(draft);
    setEditing(false);
  };

  if (editing) {
    return (
      <input
        autoFocus
        value={draft}
        placeholder={placeholder}
        aria-label={ariaLabel}
        onPointerDown={(event) => event.stopPropagation()}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === 'Enter') commit();
          if (event.key === 'Escape') {
            setDraft(value);
            setEditing(false);
          }
        }}
        className={`${compactInputClassName} pointer-events-auto min-w-0 ${inputClassName ?? ''}`}
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
        setEditing(true);
      }}
      title={value}
    >
      {value || placeholder}
    </button>
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
              ? 'text-slate-400 hover:text-slate-500'
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
      className={`group relative grid grid-cols-[32px_minmax(0,1fr)_24px] items-start gap-3 rounded-lg px-2 py-1.5 transition hover:bg-[color:var(--hover-neutral)] ${rowLayerClass} ${
        isDragging ? 'bg-white opacity-80 shadow-lg' : ''
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
                <MenuPanel className="absolute left-0 top-full z-30 mt-1 w-36">
                <button
                  type="button"
                  className={adminActionMenuItemTokenClasses.flex}
                  onClick={(event) => {
                    event.stopPropagation();
                    onChange({ visible: !group.visible });
                    setMenuOpen(false);
                  }}
                >
                  <span>Prikaži / Skrij</span>
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
          <div className={`mt-2 grid gap-x-1 gap-y-[var(--navbar-dropdown-selection-row-gap)] ${groupLinkGridClassNames[columnCount]}`}>
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
      <Button type="button" variant="primary" size="toolbar" className={`${adminTablePrimaryButtonClassName} ml-2 mt-3`} onClick={onAddLink}>
        Dodaj povezavo
      </Button>
    </div>
  );
}

export default function AdminNavigationPageClient({ initialConfig }: { initialConfig: SiteNavigationConfig }) {
  const router = useRouter();
  const { toast } = useToast();
  const [config, setConfig] = useState(() => normalizeSiteNavigationConfig(initialConfig));
  const [savedConfig, setSavedConfig] = useState(() => normalizeSiteNavigationConfig(initialConfig));
  const [selectedItemId, setSelectedItemId] = useState(() => normalizeSiteNavigationConfig(initialConfig).items[0]?.id ?? '');
  const [topLinkEditorId, setTopLinkEditorId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  useEffect(() => {
    const normalized = normalizeSiteNavigationConfig(initialConfig);
    setConfig(normalized);
    setSavedConfig(normalized);
    setSelectedItemId((current) => {
      if (normalized.items.some((item) => item.id === current)) return current;
      return normalized.items[0]?.id ?? '';
    });
  }, [initialConfig]);

  const selectedItem = useMemo(
    () => config.items.find((item) => item.id === selectedItemId) ?? config.items[0] ?? null,
    [config.items, selectedItemId]
  );
  const isDirty = comparable(config) !== comparable(savedConfig);
  const topLevelIds = useMemo(() => config.items.map((item) => item.id), [config.items]);
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

  function updateTopBarInitialLayout(layout: SiteNavigationTopBarLayout) {
    updateConfig((current) => ({
      ...current,
      topBarInitialLayout: layout
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

  function resetToDefaults() {
    const defaults = normalizeSiteNavigationConfig(cloneDefaultSiteNavigationConfig());
    setConfig(defaults);
    setSelectedItemId(defaults.items[0]?.id ?? '');
  }

  async function save() {
    setIsSaving(true);
    try {
      const response = await fetch('/api/admin/site-navigation', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ config })
      });

      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(typeof body.message === 'string' ? body.message : 'Shranjevanje navigacije ni uspelo.');
      }

      const nextConfig = normalizeSiteNavigationConfig(body.config ?? config);
      setConfig(nextConfig);
      setSavedConfig(nextConfig);
      setSelectedItemId((current) => {
        if (nextConfig.items.some((item) => item.id === current)) return current;
        return nextConfig.items[0]?.id ?? '';
      });
      toast.success('Navigacija je shranjena.');
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Shranjevanje navigacije ni uspelo.');
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="space-y-5" style={editorVars}>
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
        onChange={updateTopBarLayout}
        onSiteLayoutChange={updateSiteLayout}
        onSetInitialLayout={updateTopBarInitialLayout}
      />

      <section className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-xl font-semibold text-slate-900">Glavni meni</h2>
          <div className="flex items-center gap-2">
            <IconButton
              type="button"
              size="sm"
              tone="neutral"
              className={adminTableNeutralIconButtonClassName}
              aria-label="Privzete nastavitve"
              title="Privzete nastavitve"
              onClick={resetToDefaults}
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
            <h2 className="text-xl font-semibold text-slate-900">{selectedItem?.label ?? 'Izberite element navigacije'}</h2>
          </div>
          <Button type="button" variant="primary" size="toolbar" className={adminTablePrimaryButtonClassName} onClick={addGroup} disabled={!selectedItem}>
            Dodaj skupino
          </Button>
        </div>
        {selectedItem ? (
          selectedItem.groups.length > 0 ? (
            <div className="rounded-2xl border border-[var(--navbar-dropdown-border)] bg-white p-5 shadow-[0_16px_40px_-28px_rgba(15,23,42,0.6)]">
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
    </div>
  );
}
