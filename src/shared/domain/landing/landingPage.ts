import { HOMEPAGE_WEBSITE_FONT_FAMILIES } from '@/shared/domain/style/fontFamilies';
import {
  normalizeCategoryShowcaseMediaSettings,
  type CategoryShowcaseMediaSettings
} from '@/shared/features/category-showcase/categoryShowcaseSchema';

export const LANDING_PAGE_SETTINGS_KEY = 'main-landing-page';
export const LANDING_PAGE_DEFAULTS_KEY = 'main-landing-page-defaults';

export const HOMEPAGE_SECTION_IDS = ['hero', 'categories', 'infoBlocks', 'footer'] as const;
export const HOMEPAGE_PREVIEW_DEVICES = ['desktop', 'tablet', 'mobile'] as const;
export const HOMEPAGE_HERO_MEDIA_TYPES = ['image', 'video'] as const;
export const HOMEPAGE_HERO_HEIGHTS = ['compact', 'medium', 'large', 'viewport'] as const;
export const HOMEPAGE_ALIGNMENTS = ['left', 'center', 'right'] as const;
export const HOMEPAGE_TEXT_WIDTHS = ['small', 'medium', 'large'] as const;
export const HOMEPAGE_HERO_TITLE_SIZES = ['small', 'medium', 'large', 'xlarge'] as const;
export const HOMEPAGE_HERO_DESCRIPTION_SIZES = ['small', 'medium', 'large'] as const;
export const HOMEPAGE_HERO_TITLE_WEIGHTS = ['semibold', 'bold', 'extrabold'] as const;
export const HOMEPAGE_HERO_TITLE_TRANSFORMS = ['normal', 'uppercase'] as const;
export const HOMEPAGE_HERO_FONT_FAMILIES = HOMEPAGE_WEBSITE_FONT_FAMILIES;
export const HOMEPAGE_CONTAINER_WIDTHS = ['default', 'wide', 'full'] as const;
export const HOMEPAGE_CATEGORY_CARD_SIZES = ['small', 'medium', 'large'] as const;
export const HOMEPAGE_CATEGORY_CARD_STYLES = ['image-title', 'title-only', 'compact'] as const;
export const HOMEPAGE_CATEGORY_ORDER_MODES = ['catalog', 'custom'] as const;
export const HOMEPAGE_INFO_STYLES = ['boxed', 'unboxed'] as const;
export const HOMEPAGE_INFO_ICON_POSITIONS = ['top', 'left'] as const;
export const HOMEPAGE_SECTION_SPACINGS = ['compact', 'default', 'spacious'] as const;
export const HOMEPAGE_SECTION_RADII = ['none', 'small', 'medium', 'large'] as const;
export const HOMEPAGE_BUTTON_STYLES = ['filled', 'outline', 'soft'] as const;
export const HOMEPAGE_FOOTER_LOGO_MODES = ['full', 'mark', 'hidden'] as const;
export const HOMEPAGE_FOOTER_SPACINGS = ['compact', 'medium', 'large'] as const;
export const HOMEPAGE_SOCIAL_TYPES = ['facebook', 'instagram', 'youtube', 'linkedin', 'x', 'custom'] as const;
export const HOMEPAGE_INFO_ICONS = ['badge-check', 'truck', 'headphones', 'school', 'shield-check', 'wrench', 'package-check', 'mail'] as const;
export const HOMEPAGE_HERO_FREEFORM_KINDS = ['text', 'button'] as const;

export type HomepageSectionId = (typeof HOMEPAGE_SECTION_IDS)[number];
export type HomepagePreviewDevice = (typeof HOMEPAGE_PREVIEW_DEVICES)[number];
export type HomepageHeroMediaType = (typeof HOMEPAGE_HERO_MEDIA_TYPES)[number];
export type HomepageHeroHeight = (typeof HOMEPAGE_HERO_HEIGHTS)[number];
export type HomepageAlignment = (typeof HOMEPAGE_ALIGNMENTS)[number];
export type HomepageTextWidth = (typeof HOMEPAGE_TEXT_WIDTHS)[number];
export type HomepageHeroTitleSize = (typeof HOMEPAGE_HERO_TITLE_SIZES)[number];
export type HomepageHeroDescriptionSize = (typeof HOMEPAGE_HERO_DESCRIPTION_SIZES)[number];
export type HomepageHeroTitleWeight = (typeof HOMEPAGE_HERO_TITLE_WEIGHTS)[number];
export type HomepageHeroTitleTransform = (typeof HOMEPAGE_HERO_TITLE_TRANSFORMS)[number];
export type HomepageHeroFontFamily = (typeof HOMEPAGE_HERO_FONT_FAMILIES)[number];
export type HomepageContainerWidth = (typeof HOMEPAGE_CONTAINER_WIDTHS)[number];
export type HomepageCategoryCardSize = (typeof HOMEPAGE_CATEGORY_CARD_SIZES)[number];
export type HomepageCategoryCardStyle = (typeof HOMEPAGE_CATEGORY_CARD_STYLES)[number];
export type HomepageCategoryOrderMode = (typeof HOMEPAGE_CATEGORY_ORDER_MODES)[number];
export type HomepageInfoStyle = (typeof HOMEPAGE_INFO_STYLES)[number];
export type HomepageInfoIconPosition = (typeof HOMEPAGE_INFO_ICON_POSITIONS)[number];
export type HomepageSectionSpacing = (typeof HOMEPAGE_SECTION_SPACINGS)[number];
export type HomepageSectionRadius = (typeof HOMEPAGE_SECTION_RADII)[number];
export type HomepageButtonStyle = (typeof HOMEPAGE_BUTTON_STYLES)[number];
export type HomepageFooterLogoMode = (typeof HOMEPAGE_FOOTER_LOGO_MODES)[number];
export type HomepageFooterSpacing = (typeof HOMEPAGE_FOOTER_SPACINGS)[number];
export type HomepageSocialType = (typeof HOMEPAGE_SOCIAL_TYPES)[number];
export type HomepageInfoIcon = (typeof HOMEPAGE_INFO_ICONS)[number];
export type HomepageHeroFreeformKind = (typeof HOMEPAGE_HERO_FREEFORM_KINDS)[number];

export const HOMEPAGE_PREVIEW_PROFILES: Record<
  HomepagePreviewDevice,
  { viewportWidth: number; fallbackHeight: number }
> = {
  desktop: { viewportWidth: 1440, fallbackHeight: 1120 },
  tablet: { viewportWidth: 1024, fallbackHeight: 1080 },
  mobile: { viewportWidth: 390, fallbackHeight: 1240 }
};

export function getHomepagePreviewDeviceForViewport(viewportWidth: number): HomepagePreviewDevice {
  if (viewportWidth <= 767) return 'mobile';
  if (viewportWidth <= 1024) return 'tablet';
  return 'desktop';
}

export type HomepageButton = {
  label: string;
  href: string;
};

export type HomepageHeroSlide = {
  id: string;
  type: HomepageHeroMediaType;
  src: string;
  alt: string;
  title: string;
  poster: string;
};

export type HomepageHeroDeviceSettings = {
  overlayStrength: number;
  height: HomepageHeroHeight;
  contentAlign: HomepageAlignment;
  textWidth: HomepageTextWidth;
  heightPx: number;
  contentOffsetXPx: number;
  contentOffsetYPx: number;
  titleOffsetXPx: number;
  titleOffsetYPx: number;
  descriptionOffsetXPx: number;
  descriptionOffsetYPx: number;
  primaryButtonOffsetXPx: number;
  primaryButtonOffsetYPx: number;
  secondaryButtonOffsetXPx: number;
  secondaryButtonOffsetYPx: number;
  textWidthPx: number;
  mediaWidthPercent: number;
  titleSize: HomepageHeroTitleSize;
  titleWeight: HomepageHeroTitleWeight;
  titleTransform: HomepageHeroTitleTransform;
  descriptionSize: HomepageHeroDescriptionSize;
  titleFontFamily: HomepageHeroFontFamily;
  titleFontSizePx: number;
  titleBold: boolean;
  titleItalic: boolean;
  titleUnderline: boolean;
  titleHighlight: boolean;
  titleHighlightColor: string;
  descriptionFontFamily: HomepageHeroFontFamily;
  descriptionFontSizePx: number;
  descriptionBold: boolean;
  descriptionItalic: boolean;
  descriptionUnderline: boolean;
  descriptionHighlight: boolean;
  descriptionHighlightColor: string;
};

export type HomepageHeroTextBlockDeviceSettings = {
  xPx: number;
  yPx: number;
  widthPx: number;
  fontFamily: HomepageHeroFontFamily;
  fontSizePx: number;
  bold: boolean;
  italic: boolean;
  underline: boolean;
};

export type HomepageHeroTextBlock = {
  id: string;
  kind: HomepageHeroFreeformKind;
  text: string;
  visible: boolean;
  href: string;
  xPx: number;
  yPx: number;
  widthPx: number;
  fontFamily: HomepageHeroFontFamily;
  fontSizePx: number;
  bold: boolean;
  italic: boolean;
  underline: boolean;
  responsive: HomepageDeviceSettingsMap<HomepageHeroTextBlockDeviceSettings>;
};

export type HomepageCategoriesDeviceSettings = {
  limit: number;
  columns: number;
  cardSize: HomepageCategoryCardSize;
  gap: number;
  containerWidth: HomepageContainerWidth;
  cardStyle: HomepageCategoryCardStyle;
  showCardArrow: boolean;
};

export type HomepageInfoBlocksDeviceSettings = {
  columns: number;
  gap: number;
  alignment: Exclude<HomepageAlignment, 'right'>;
  style: HomepageInfoStyle;
  dividers: boolean;
  iconPosition: HomepageInfoIconPosition;
};

export type HomepageFooterDeviceSettings = {
  layoutColumns: number;
  spacing: HomepageFooterSpacing;
  topBorder: boolean;
};

export type HomepagePageDeviceSettings = {
  containerWidth: HomepageContainerWidth;
  sectionSpacing: HomepageSectionSpacing;
  sectionRadius: HomepageSectionRadius;
};

export type HomepageDeviceSettingsMap<T> = Record<HomepagePreviewDevice, T>;

export type HomepageCanvasElementDeviceSettings = {
  visible: boolean;
  locked: boolean;
  offsetXPx: number;
  offsetYPx: number;
  widthPx: number;
  heightPx: number;
  paddingTopPx: number;
  paddingRightPx: number;
  paddingBottomPx: number;
  paddingLeftPx: number;
  marginTopPx: number;
  marginRightPx: number;
  marginBottomPx: number;
  marginLeftPx: number;
  zIndex: number;
  textAlign: HomepageAlignment;
  horizontalAlign: HomepageAlignment;
  color: string;
  fontFamily: string;
  fontSizePx: number;
  lineHeight: number;
  letterSpacingPx: number;
  fontWeight: number;
  italic: boolean;
  underline: boolean;
};

export type HomepageCanvasElementSettings = HomepageCanvasElementDeviceSettings & {
  responsive: HomepageDeviceSettingsMap<HomepageCanvasElementDeviceSettings>;
};

export type HomepageCanvasSettings = {
  elements: Record<string, HomepageCanvasElementSettings>;
  deletedElementIds: string[];
};

export const DEFAULT_HOMEPAGE_CANVAS_ELEMENT_DEVICE_SETTINGS: HomepageCanvasElementDeviceSettings = {
  visible: true,
  locked: false,
  offsetXPx: 0,
  offsetYPx: 0,
  widthPx: 0,
  heightPx: 0,
  paddingTopPx: 0,
  paddingRightPx: 0,
  paddingBottomPx: 0,
  paddingLeftPx: 0,
  marginTopPx: 0,
  marginRightPx: 0,
  marginBottomPx: 0,
  marginLeftPx: 0,
  zIndex: 0,
  textAlign: 'left',
  horizontalAlign: 'left',
  color: '',
  fontFamily: 'Inter',
  fontSizePx: 15,
  lineHeight: 1.5,
  letterSpacingPx: 0,
  fontWeight: 400,
  italic: false,
  underline: false
};

export type HomepageHeroSettings = {
  visible: boolean;
  title: string;
  description: string;
  primaryButton: HomepageButton;
  secondaryButton: HomepageButton;
  backgroundType: HomepageHeroMediaType;
  slides: HomepageHeroSlide[];
  showArrows: boolean;
  showDots: boolean;
  autoplay: boolean;
  autoplayInterval: number;
  overlayStrength: number;
  height: HomepageHeroHeight;
  contentAlign: HomepageAlignment;
  textWidth: HomepageTextWidth;
  heightPx: number;
  contentOffsetXPx: number;
  contentOffsetYPx: number;
  titleOffsetXPx: number;
  titleOffsetYPx: number;
  descriptionOffsetXPx: number;
  descriptionOffsetYPx: number;
  primaryButtonOffsetXPx: number;
  primaryButtonOffsetYPx: number;
  secondaryButtonOffsetXPx: number;
  secondaryButtonOffsetYPx: number;
  textWidthPx: number;
  mediaWidthPercent: number;
  titleSize: HomepageHeroTitleSize;
  titleWeight: HomepageHeroTitleWeight;
  titleTransform: HomepageHeroTitleTransform;
  descriptionSize: HomepageHeroDescriptionSize;
  titleFontFamily: HomepageHeroFontFamily;
  titleFontSizePx: number;
  titleBold: boolean;
  titleItalic: boolean;
  titleUnderline: boolean;
  titleHighlight: boolean;
  titleHighlightColor: string;
  descriptionFontFamily: HomepageHeroFontFamily;
  descriptionFontSizePx: number;
  descriptionBold: boolean;
  descriptionItalic: boolean;
  descriptionUnderline: boolean;
  descriptionHighlight: boolean;
  descriptionHighlightColor: string;
  darkenBackground: boolean;
  textBlocks: HomepageHeroTextBlock[];
  responsive: HomepageDeviceSettingsMap<HomepageHeroDeviceSettings>;
};

export type HomepageCategoriesSettings = {
  visible: boolean;
  title: string;
  subtitle: string;
  showAllLink: boolean;
  showAllLabel: string;
  showAllHref: string;
  limit: number;
  columns: number;
  cardSize: HomepageCategoryCardSize;
  gap: number;
  containerWidth: HomepageContainerWidth;
  cardStyle: HomepageCategoryCardStyle;
  showCardArrow: boolean;
  categoryOrderMode: HomepageCategoryOrderMode;
  categoryOrder: string[];
  responsive: HomepageDeviceSettingsMap<HomepageCategoriesDeviceSettings>;
};

export type HomepageInfoBlockItem = {
  id: string;
  icon: HomepageInfoIcon;
  title: string;
  description: string;
  href: string;
};

export type HomepageInfoBlocksSettings = {
  visible: boolean;
  columns: number;
  gap: number;
  alignment: Exclude<HomepageAlignment, 'right'>;
  style: HomepageInfoStyle;
  dividers: boolean;
  iconPosition: HomepageInfoIconPosition;
  items: HomepageInfoBlockItem[];
  responsive: HomepageDeviceSettingsMap<HomepageInfoBlocksDeviceSettings>;
};

export type HomepageFooterLink = {
  id: string;
  label: string;
  href: string;
  visible?: boolean;
  position?: number;
};

export type HomepageFooterColumn = {
  id: string;
  title: string;
  visible?: boolean;
  position?: number;
  links: HomepageFooterLink[];
};

export type HomepageFooterContact = {
  email: string;
  phone: string;
  address: string;
  workingHours: string;
};

export type HomepageFooterSocialLink = {
  id: string;
  type: HomepageSocialType;
  label: string;
  href: string;
  visible?: boolean;
  position?: number;
};

export type HomepageFooterSettings = {
  visible: boolean;
  logoMode: HomepageFooterLogoMode;
  logoText: string;
  description: string;
  columns: HomepageFooterColumn[];
  contact: HomepageFooterContact;
  socialLinks: HomepageFooterSocialLink[];
  copyright: string;
  legalLinks: HomepageFooterLink[];
  layoutColumns: number;
  spacing: HomepageFooterSpacing;
  topBorder: boolean;
  responsive: HomepageDeviceSettingsMap<HomepageFooterDeviceSettings>;
};

export type HomepagePageSettings = {
  containerWidth: HomepageContainerWidth;
  sectionSpacing: HomepageSectionSpacing;
  backgroundColor: string;
  sectionRadius: HomepageSectionRadius;
  buttonStyle: HomepageButtonStyle;
  responsive: HomepageDeviceSettingsMap<HomepagePageDeviceSettings>;
};

export type HomepageSectionTitles = Partial<Record<HomepageSectionId, string>>;

export type HomepageSettings = {
  sectionOrder: HomepageSectionId[];
  sectionTitles: HomepageSectionTitles;
  hero: HomepageHeroSettings;
  categories: HomepageCategoriesSettings;
  infoBlocks: HomepageInfoBlocksSettings;
  footer: HomepageFooterSettings;
  page: HomepagePageSettings;
  canvas: HomepageCanvasSettings;
  updatedAt?: string | null;
};

export type HomepageCategoryCardData = {
  id?: string;
  slug: string;
  title: string;
  summary?: string | null;
  image?: string | null;
  presentation?: CategoryShowcaseMediaSettings;
  revision?: string;
};

export type LandingPageConfig = HomepageSettings;

export const HOMEPAGE_DELETABLE_CANVAS_ELEMENT_PREFIX = 'hero:textBlock:' as const;
const HOMEPAGE_DELETABLE_CANVAS_ELEMENT_NAMESPACES = ['hero:', 'categories:', 'footer:'] as const;
const HOMEPAGE_NON_DELETABLE_CANVAS_ELEMENT_PREFIXES = ['categories:image:', 'section:'] as const;

export function isDeletableHomepageCanvasElementId(
  elementId: string | null | undefined
): elementId is string {
  return Boolean(
    elementId
    && HOMEPAGE_DELETABLE_CANVAS_ELEMENT_NAMESPACES.some((namespace) => elementId.startsWith(namespace))
    && !HOMEPAGE_NON_DELETABLE_CANVAS_ELEMENT_PREFIXES.some((prefix) => elementId.startsWith(prefix))
  );
}

export function isHomepageCanvasElementDeleted(
  canvas: HomepageCanvasSettings,
  elementId: string
) {
  return canvas.deletedElementIds.includes(elementId);
}

export function removeDeletableHomepageCanvasElement(
  config: HomepageSettings,
  elementId: string
): HomepageSettings {
  if (!isDeletableHomepageCanvasElementId(elementId)) return config;

  const isHeroTextBlock = elementId.startsWith(HOMEPAGE_DELETABLE_CANVAS_ELEMENT_PREFIX);
  const blockId = isHeroTextBlock
    ? elementId.slice(HOMEPAGE_DELETABLE_CANVAS_ELEMENT_PREFIX.length)
    : null;
  const textBlocks = blockId
    ? config.hero.textBlocks.filter((block) => block.id !== blockId)
    : config.hero.textBlocks;
  const hasCanvasSettings = Object.prototype.hasOwnProperty.call(config.canvas.elements, elementId);
  const alreadyDeleted = isHomepageCanvasElementDeleted(config.canvas, elementId);
  if (textBlocks.length === config.hero.textBlocks.length && !hasCanvasSettings && alreadyDeleted) return config;

  const elements = { ...config.canvas.elements };
  delete elements[elementId];
  const deletedElementIds = alreadyDeleted
    ? config.canvas.deletedElementIds
    : [...config.canvas.deletedElementIds, elementId];

  return {
    ...config,
    hero: { ...config.hero, textBlocks },
    canvas: { ...config.canvas, elements, deletedElementIds }
  };
}

export const homepageSectionLabels: Record<HomepageSectionId, string> = {
  hero: 'Hero',
  categories: 'Kategorije',
  infoBlocks: 'Elementi pod kategorijami',
  footer: 'Footer'
};

export function resolveHomepageSectionLabel(sectionId: HomepageSectionId, sectionTitles?: HomepageSectionTitles) {
  const customTitle = sectionTitles?.[sectionId]?.trim();
  return customTitle || homepageSectionLabels[sectionId];
}

export const homepagePreviewDeviceLabels: Record<HomepagePreviewDevice, string> = {
  desktop: 'Desktop',
  tablet: 'Tablica',
  mobile: 'Mobilno'
};

export const homepageHeroHeightLabels: Record<HomepageHeroHeight, string> = {
  compact: 'Kompaktna',
  medium: 'Srednja',
  large: 'Velika',
  viewport: 'Cel zaslon'
};

export const homepageAlignmentLabels: Record<HomepageAlignment, string> = {
  left: 'Levo',
  center: 'Sredina',
  right: 'Desno'
};

export const homepageTextWidthLabels: Record<HomepageTextWidth, string> = {
  small: 'Ozko',
  medium: 'Srednje',
  large: 'Široko'
};

export const homepageHeroTitleSizeLabels: Record<HomepageHeroTitleSize, string> = {
  small: 'Majhen',
  medium: 'Srednji',
  large: 'Velik',
  xlarge: 'Zelo velik'
};

export const homepageHeroDescriptionSizeLabels: Record<HomepageHeroDescriptionSize, string> = {
  small: 'Majhen',
  medium: 'Srednji',
  large: 'Velik'
};

export const homepageHeroTitleWeightLabels: Record<HomepageHeroTitleWeight, string> = {
  semibold: 'Polkrepko',
  bold: 'Krepko',
  extrabold: 'Zelo krepko'
};

export const homepageHeroTitleTransformLabels: Record<HomepageHeroTitleTransform, string> = {
  normal: 'ObiÄajno',
  uppercase: 'Velike Ärke'
};

export const homepageContainerWidthLabels: Record<HomepageContainerWidth, string> = {
  default: 'Privzeta vsebina',
  wide: 'Široko',
  full: 'Polna širina'
};

export const homepageCategoryCardSizeLabels: Record<HomepageCategoryCardSize, string> = {
  small: 'Majhna',
  medium: 'Srednja',
  large: 'Velika'
};

export const homepageCategoryCardStyleLabels: Record<HomepageCategoryCardStyle, string> = {
  'image-title': 'Slika + naslov',
  'title-only': 'Samo naslov',
  compact: 'Kompaktno'
};

export const homepageCategoryOrderModeLabels: Record<HomepageCategoryOrderMode, string> = {
  catalog: 'Po katalogu',
  custom: 'Po meri'
};

export const homepageInfoStyleLabels: Record<HomepageInfoStyle, string> = {
  boxed: 'V okvirjih',
  unboxed: 'Brez okvirjev'
};

export const homepageInfoIconPositionLabels: Record<HomepageInfoIconPosition, string> = {
  top: 'Zgoraj',
  left: 'Levo'
};

export const homepageSectionSpacingLabels: Record<HomepageSectionSpacing, string> = {
  compact: 'Kompaktno',
  default: 'Privzeto',
  spacious: 'Zračno'
};

export const homepageSectionRadiusLabels: Record<HomepageSectionRadius, string> = {
  none: 'Brez',
  small: 'Majhen',
  medium: 'Srednji',
  large: 'Velik'
};

export const homepageButtonStyleLabels: Record<HomepageButtonStyle, string> = {
  filled: 'Poln',
  outline: 'Obroba',
  soft: 'Mehak'
};

export const homepageFooterLogoModeLabels: Record<HomepageFooterLogoMode, string> = {
  full: 'Znak + ime',
  mark: 'Samo znak',
  hidden: 'Skrito'
};

export const homepageFooterSpacingLabels: Record<HomepageFooterSpacing, string> = {
  compact: 'Kompaktno',
  medium: 'Srednje',
  large: 'Zračno'
};

export const homepageInfoIconLabels: Record<HomepageInfoIcon, string> = {
  'badge-check': 'Značka',
  truck: 'Dostava',
  headphones: 'Podpora',
  school: 'Šola',
  'shield-check': 'Varnost',
  wrench: 'Orodje',
  'package-check': 'Paket',
  mail: 'Sporočilo'
};

export const homepageSocialTypeLabels: Record<HomepageSocialType, string> = {
  facebook: 'Facebook',
  instagram: 'Instagram',
  youtube: 'YouTube',
  linkedin: 'LinkedIn',
  x: 'X',
  custom: 'Po meri'
};

export const DEFAULT_HOMEPAGE_CATEGORY_CARDS: HomepageCategoryCardData[] = [
  {
    slug: 'tehnika-in-tehnologija',
    title: 'Tehnika in tehnologija',
    image: '/images/categories/cutouts/tehnika-in-tehnologija.png'
  },
  {
    slug: 'materiali',
    title: 'Materiali',
    image: '/images/categories/cutouts/materiali.png'
  },
  {
    slug: 'stroji-in-naprave',
    title: 'Stroji in naprave',
    image: '/images/categories/cutouts/stroji-in-naprave.png'
  },
  {
    slug: 'merilno-orodje-in-geometrija',
    title: 'Merilno orodje in geometrija',
    image: '/images/categories/cutouts/merilno-orodje-in-geometrija.png'
  },
  {
    slug: 'elektricni-in-mehanicni-elementi',
    title: 'Električni in mehanski elementi',
    image: '/images/categories/cutouts/elektricni-in-mehanicni-elementi.png'
  },
  {
    slug: 'rocno-orodje-in-delavniski-pribor',
    title: 'Ročno orodje in delavniški pribor',
    image: '/images/categories/cutouts/rocno-orodje-in-delavniski-pribor.png'
  },
  {
    slug: 'zascita-pri-delu',
    title: 'Zaščita pri delu',
    image: '/images/categories/cutouts/zascita-pri-delu.png'
  },
  {
    slug: 'dodatki-in-nadomestni-deli',
    title: 'Dodatki in nadomestni deli',
    image: '/images/categories/cutouts/dodatki-in-nadomestni-deli.png'
  }
];

// Before categoryOrderMode existed, every untouched configuration was stored with
// this populated order. Matching legacy values therefore mean "inherit"; any
// different legacy order remains an intentional custom override.
const LEGACY_DEFAULT_HOMEPAGE_CATEGORY_ORDER = [
  'tehnika-in-tehnologija',
  'materiali',
  'stroji-in-naprave',
  'merilno-orodje-in-geometrija',
  'elektricni-in-mehanicni-elementi',
  'rocno-orodje-in-delavniski-pribor',
  'zascita-pri-delu',
  'dodatki-in-nadomestni-deli'
] as const;

const defaultHeroSlide: HomepageHeroSlide = {
  id: 'laser-cutting-plywood',
  type: 'image',
  src: '/images/landing/laser-cutting-plywood.png',
  alt: 'Laserski razrez vezane plošče',
  title: 'Laser rezanje vezane plošče',
  poster: ''
};

const heroHeightPxByPreset: Record<HomepageHeroHeight, number> = {
  compact: 360,
  medium: 460,
  large: 560,
  viewport: 720
};

const heroTextWidthPxByPreset: Record<HomepageTextWidth, number> = {
  small: 500,
  medium: 680,
  large: 820
};

const heroTitleFontSizePxByPreset: Record<HomepageHeroTitleSize, number> = {
  small: 42,
  medium: 54,
  large: 66,
  xlarge: 78
};

const heroDescriptionFontSizePxByPreset: Record<HomepageHeroDescriptionSize, number> = {
  small: 14,
  medium: 16,
  large: 18
};

const defaultHeroTextBlockDeviceSettings: HomepageHeroTextBlockDeviceSettings = {
  xPx: 220,
  yPx: 310,
  widthPx: 360,
  fontFamily: 'Inter',
  fontSizePx: 24,
  bold: false,
  italic: false,
  underline: false
};

const heroContentOffsetPxByAlignment: Record<HomepageAlignment, number> = {
  left: 0,
  center: 260,
  right: 520
};

const defaultHeroElementOffsets = {
  titleOffsetXPx: 0,
  titleOffsetYPx: 0,
  descriptionOffsetXPx: 0,
  descriptionOffsetYPx: 0,
  primaryButtonOffsetXPx: 0,
  primaryButtonOffsetYPx: 0,
  secondaryButtonOffsetXPx: 0,
  secondaryButtonOffsetYPx: 0
} satisfies Pick<
  HomepageHeroDeviceSettings,
  | 'titleOffsetXPx'
  | 'titleOffsetYPx'
  | 'descriptionOffsetXPx'
  | 'descriptionOffsetYPx'
  | 'primaryButtonOffsetXPx'
  | 'primaryButtonOffsetYPx'
  | 'secondaryButtonOffsetXPx'
  | 'secondaryButtonOffsetYPx'
>;

export const DEFAULT_HOMEPAGE_SETTINGS: HomepageSettings = {
  sectionOrder: ['hero', 'categories', 'infoBlocks', 'footer'],
  sectionTitles: {},
  hero: {
    visible: true,
    title: 'Oprema in materiali za tehnično izobraževanje.',
    description: 'Vse za ustvarjanje, učenje in inoviranje - na enem mestu, za šole in delavnice.',
    primaryButton: {
      label: 'Razišči katalog',
      href: '/products'
    },
    secondaryButton: {
      label: 'Za šole',
      href: '/how-schools-order'
    },
    backgroundType: 'image',
    slides: [defaultHeroSlide],
    showArrows: true,
    showDots: true,
    autoplay: false,
    autoplayInterval: 5000,
    overlayStrength: 42,
    height: 'large',
    contentAlign: 'left',
    textWidth: 'medium',
    heightPx: 560,
    contentOffsetXPx: 0,
    contentOffsetYPx: 0,
    ...defaultHeroElementOffsets,
    textWidthPx: 680,
    mediaWidthPercent: 100,
    titleSize: 'medium',
    titleWeight: 'bold',
    titleTransform: 'normal',
    descriptionSize: 'medium',
    titleFontFamily: 'Inter',
    titleFontSizePx: 54,
    titleBold: true,
    titleItalic: false,
    titleUnderline: false,
    titleHighlight: false,
    titleHighlightColor: '#ffffff',
    descriptionFontFamily: 'Inter',
    descriptionFontSizePx: 16,
    descriptionBold: false,
    descriptionItalic: false,
    descriptionUnderline: false,
    descriptionHighlight: false,
    descriptionHighlightColor: '#ffffff',
    darkenBackground: true,
    textBlocks: [],
    responsive: {
      desktop: { overlayStrength: 42, height: 'large', contentAlign: 'left', textWidth: 'medium', heightPx: 560, contentOffsetXPx: 0, contentOffsetYPx: 0, ...defaultHeroElementOffsets, textWidthPx: 680, mediaWidthPercent: 100, titleSize: 'medium', titleWeight: 'bold', titleTransform: 'normal', descriptionSize: 'medium', titleFontFamily: 'Inter', titleFontSizePx: 54, titleBold: true, titleItalic: false, titleUnderline: false, titleHighlight: false, titleHighlightColor: '#ffffff', descriptionFontFamily: 'Inter', descriptionFontSizePx: 16, descriptionBold: false, descriptionItalic: false, descriptionUnderline: false, descriptionHighlight: false, descriptionHighlightColor: '#ffffff' },
      tablet: { overlayStrength: 45, height: 'medium', contentAlign: 'left', textWidth: 'medium', heightPx: 460, contentOffsetXPx: 0, contentOffsetYPx: 0, ...defaultHeroElementOffsets, textWidthPx: 620, mediaWidthPercent: 100, titleSize: 'medium', titleWeight: 'bold', titleTransform: 'normal', descriptionSize: 'medium', titleFontFamily: 'Inter', titleFontSizePx: 48, titleBold: true, titleItalic: false, titleUnderline: false, titleHighlight: false, titleHighlightColor: '#ffffff', descriptionFontFamily: 'Inter', descriptionFontSizePx: 15, descriptionBold: false, descriptionItalic: false, descriptionUnderline: false, descriptionHighlight: false, descriptionHighlightColor: '#ffffff' },
      mobile: { overlayStrength: 50, height: 'medium', contentAlign: 'left', textWidth: 'small', heightPx: 420, contentOffsetXPx: 0, contentOffsetYPx: 0, ...defaultHeroElementOffsets, textWidthPx: 340, mediaWidthPercent: 100, titleSize: 'small', titleWeight: 'bold', titleTransform: 'normal', descriptionSize: 'small', titleFontFamily: 'Inter', titleFontSizePx: 34, titleBold: true, titleItalic: false, titleUnderline: false, titleHighlight: false, titleHighlightColor: '#ffffff', descriptionFontFamily: 'Inter', descriptionFontSizePx: 14, descriptionBold: false, descriptionItalic: false, descriptionUnderline: false, descriptionHighlight: false, descriptionHighlightColor: '#ffffff' }
    }
  },
  categories: {
    visible: true,
    title: 'Kategorije',
    subtitle: '',
    showAllLink: true,
    showAllLabel: 'Prikaži vse kategorije',
    showAllHref: '/products',
    limit: 8,
    columns: 4,
    cardSize: 'medium',
    gap: 16,
    containerWidth: 'default',
    cardStyle: 'image-title',
    showCardArrow: true,
    categoryOrderMode: 'catalog',
    categoryOrder: [],
    responsive: {
      desktop: { limit: 8, columns: 4, cardSize: 'medium', gap: 16, containerWidth: 'default', cardStyle: 'image-title', showCardArrow: true },
      tablet: { limit: 8, columns: 2, cardSize: 'medium', gap: 16, containerWidth: 'default', cardStyle: 'image-title', showCardArrow: true },
      mobile: { limit: 6, columns: 1, cardSize: 'medium', gap: 12, containerWidth: 'default', cardStyle: 'compact', showCardArrow: true }
    }
  },
  infoBlocks: {
    visible: true,
    columns: 4,
    gap: 0,
    alignment: 'left',
    style: 'boxed',
    dividers: true,
    iconPosition: 'left',
    responsive: {
      desktop: { columns: 4, gap: 0, alignment: 'left', style: 'boxed', dividers: true, iconPosition: 'left' },
      tablet: { columns: 2, gap: 12, alignment: 'left', style: 'boxed', dividers: true, iconPosition: 'left' },
      mobile: { columns: 1, gap: 10, alignment: 'left', style: 'boxed', dividers: false, iconPosition: 'left' }
    },
    items: [
      {
        id: 'quality-education',
        icon: 'badge-check',
        title: 'Kakovost za izobraževanje',
        description: 'Preverjeni izdelki za šole in delavnice',
        href: ''
      },
      {
        id: 'fast-delivery',
        icon: 'truck',
        title: 'Hitra dostava',
        description: 'Po vsej Sloveniji',
        href: ''
      },
      {
        id: 'expert-support',
        icon: 'headphones',
        title: 'Strokovna podpora',
        description: 'Pišite nam, z veseljem pomagamo',
        href: '/contact'
      },
      {
        id: 'school-terms',
        icon: 'school',
        title: 'Ugodni pogoji za šole',
        description: 'Posebne ponudbe za izobraževalne ustanove',
        href: '/how-schools-order'
      }
    ]
  },
  footer: {
    visible: true,
    logoMode: 'mark',
    logoText: 'ATEHNA',
    description: 'Oprema, materiali in podpora za tehnično izobraževanje.',
    columns: [
      {
        id: 'products',
        title: 'Izdelki',
        links: [
          { id: 'catalog', label: 'Katalog', href: '/products' },
          { id: 'schools', label: 'Za šole', href: '/how-schools-order' },
          { id: 'projects', label: 'Projekti', href: '/products' }
        ]
      },
      {
        id: 'support',
        title: 'Podpora',
        links: [
          { id: 'help', label: 'Pomoč', href: '/contact' },
          { id: 'delivery', label: 'Dostava in plačilo', href: '/how-schools-order' },
          { id: 'returns', label: 'Vračila in reklamacije', href: '/terms' }
        ]
      },
      {
        id: 'about',
        title: 'O nas',
        links: [
          { id: 'company', label: 'O podjetju', href: '/about' },
          { id: 'contact', label: 'Kontakt', href: '/contact' },
          { id: 'work', label: 'Sodeluj z nami', href: '/contact' }
        ]
      }
    ],
    contact: {
      email: 'info@atehna.si',
      phone: '+386 1 234 56 78',
      address: '',
      workingHours: 'Pon-Pet 8:00-16:00'
    },
    socialLinks: [
      { id: 'facebook', type: 'facebook', label: 'Facebook', href: '#' },
      { id: 'instagram', type: 'instagram', label: 'Instagram', href: '#' },
      { id: 'youtube', type: 'youtube', label: 'YouTube', href: '#' },
      { id: 'linkedin', type: 'linkedin', label: 'LinkedIn', href: '#' }
    ],
    copyright: '© {year} Atehna d.o.o. Vse pravice pridržane.',
    legalLinks: [
      { id: 'terms', label: 'Pogoji uporabe', href: '/terms' },
      { id: 'privacy', label: 'Zasebnost', href: '/privacy' },
      { id: 'cookies', label: 'Piškotki', href: '/cookies' }
    ],
    layoutColumns: 3,
    spacing: 'medium',
    topBorder: true,
    responsive: {
      desktop: { layoutColumns: 3, spacing: 'medium', topBorder: true },
      tablet: { layoutColumns: 2, spacing: 'medium', topBorder: true },
      mobile: { layoutColumns: 1, spacing: 'compact', topBorder: true }
    }
  },
  page: {
    containerWidth: 'default',
    sectionSpacing: 'default',
    backgroundColor: '#ffffff',
    sectionRadius: 'medium',
    buttonStyle: 'filled',
    responsive: {
      desktop: { containerWidth: 'default', sectionSpacing: 'default', sectionRadius: 'medium' },
      tablet: { containerWidth: 'default', sectionSpacing: 'compact', sectionRadius: 'medium' },
      mobile: { containerWidth: 'default', sectionSpacing: 'compact', sectionRadius: 'small' }
    }
  },
  canvas: {
    elements: {},
    deletedElementIds: []
  },
  updatedAt: null
};

export const DEFAULT_LANDING_PAGE_CONFIG = DEFAULT_HOMEPAGE_SETTINGS;

const TITLE_MAX_LENGTH = 140;
const SECTION_TITLE_MAX_LENGTH = 80;
const DESCRIPTION_MAX_LENGTH = 900;
const BUTTON_LABEL_MAX_LENGTH = 80;
const URL_MAX_LENGTH = 700;
const SHORT_TEXT_MAX_LENGTH = 180;
const COLOR_MAX_LENGTH = 32;
export const MAX_HOMEPAGE_HERO_SLIDES = 12;
const MAX_HERO_TEXT_BLOCKS = 12;
const MAX_INFO_ITEMS = 12;
const MAX_FOOTER_COLUMNS = 6;
const MAX_FOOTER_LINKS = 12;
const MAX_SOCIAL_LINKS = 8;
const MAX_CANVAS_ELEMENTS = 256;

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function asString(value: unknown, fallback = '', maxLength = 5000) {
  const stringValue = typeof value === 'string' ? value : fallback;
  return stringValue.trim().slice(0, maxLength);
}

function asNullableString(value: unknown, maxLength = 500) {
  const stringValue = asString(value, '', maxLength);
  return stringValue || null;
}

function asBoolean(value: unknown, fallback = true) {
  return typeof value === 'boolean' ? value : fallback;
}

function asNumber(value: unknown, fallback: number, min: number, max: number) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.min(max, Math.max(min, Math.round(numeric)));
}

function asDecimalNumber(value: unknown, fallback: number, min: number, max: number) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.round(Math.min(max, Math.max(min, numeric)) * 1000) / 1000;
}

function enumValue<T extends string>(value: unknown, options: readonly T[], fallback: T): T {
  return options.includes(value as T) ? value as T : fallback;
}

function normalizeButton(value: unknown, fallback: HomepageButton): HomepageButton {
  const record = asRecord(value);
  return {
    label: asString(record.label, fallback.label, BUTTON_LABEL_MAX_LENGTH),
    href: asString(record.href ?? record.url, fallback.href, URL_MAX_LENGTH)
  };
}

function normalizeSlide(value: unknown, index: number): HomepageHeroSlide {
  const record = asRecord(value);
  const fallback = index === 0 ? defaultHeroSlide : {
    id: `slide-${index + 1}`,
    type: 'image',
    src: '',
    alt: '',
    title: '',
    poster: ''
  } satisfies HomepageHeroSlide;
  const type = enumValue(record.type, HOMEPAGE_HERO_MEDIA_TYPES, fallback.type);

  return {
    id: asString(record.id, fallback.id, 100) || `slide-${index + 1}`,
    type,
    src: asString(record.src ?? record.url, fallback.src, URL_MAX_LENGTH),
    alt: asString(record.alt ?? record.altText, fallback.alt, SHORT_TEXT_MAX_LENGTH),
    title: asString(record.title, fallback.title, SHORT_TEXT_MAX_LENGTH),
    poster: asString(record.poster, fallback.poster, URL_MAX_LENGTH)
  };
}

function normalizeHeroTextBlockDeviceSettings(
  value: unknown,
  fallback: HomepageHeroTextBlockDeviceSettings
): HomepageHeroTextBlockDeviceSettings {
  const record = asRecord(value);

  return {
    xPx: asNumber(record.xPx ?? record.x, fallback.xPx, -1400, 1400),
    yPx: asNumber(record.yPx ?? record.y, fallback.yPx, -700, 900),
    widthPx: asNumber(record.widthPx ?? record.width, fallback.widthPx, 120, 1200),
    fontFamily: enumValue(record.fontFamily, HOMEPAGE_HERO_FONT_FAMILIES, fallback.fontFamily),
    fontSizePx: asNumber(record.fontSizePx ?? record.fontSize, fallback.fontSizePx, 11, 120),
    bold: asBoolean(record.bold, fallback.bold),
    italic: asBoolean(record.italic, fallback.italic),
    underline: asBoolean(record.underline, fallback.underline)
  };
}

function normalizeHeroTextBlockResponsive(
  value: unknown,
  base: HomepageHeroTextBlockDeviceSettings
): HomepageDeviceSettingsMap<HomepageHeroTextBlockDeviceSettings> {
  const record = asRecord(value);
  const fallbacks: HomepageDeviceSettingsMap<HomepageHeroTextBlockDeviceSettings> = {
    desktop: base,
    tablet: {
      ...base,
      xPx: Math.min(base.xPx, 120),
      yPx: Math.min(base.yPx, 280),
      widthPx: Math.min(base.widthPx, 320),
      fontSizePx: Math.min(base.fontSizePx, 22)
    },
    mobile: {
      ...base,
      xPx: 24,
      yPx: Math.min(base.yPx, 260),
      widthPx: 300,
      fontSizePx: Math.min(base.fontSizePx, 18)
    }
  };

  return {
    desktop: normalizeHeroTextBlockDeviceSettings(record.desktop, fallbacks.desktop),
    tablet: normalizeHeroTextBlockDeviceSettings(record.tablet, fallbacks.tablet),
    mobile: normalizeHeroTextBlockDeviceSettings(record.mobile, fallbacks.mobile)
  };
}

function normalizeHeroTextBlock(value: unknown, index: number): HomepageHeroTextBlock {
  const record = asRecord(value);
  const fallback = defaultHeroTextBlockDeviceSettings;
  const base = {
    id: asString(record.id, '', 100) || `hero-text-${index + 1}`,
    kind: enumValue(record.kind, HOMEPAGE_HERO_FREEFORM_KINDS, 'text'),
    text: asString(record.text, index === 0 ? 'Novo besedilo' : `Novo besedilo ${index + 1}`, DESCRIPTION_MAX_LENGTH),
    visible: asBoolean(record.visible, true),
    href: asString(record.href, '', URL_MAX_LENGTH),
    xPx: asNumber(record.xPx ?? record.x, fallback.xPx, -1400, 1400),
    yPx: asNumber(record.yPx ?? record.y, fallback.yPx, -700, 900),
    widthPx: asNumber(record.widthPx ?? record.width, fallback.widthPx, 120, 1200),
    fontFamily: enumValue(record.fontFamily, HOMEPAGE_HERO_FONT_FAMILIES, fallback.fontFamily),
    fontSizePx: asNumber(record.fontSizePx ?? record.fontSize, fallback.fontSizePx, 11, 120),
    bold: asBoolean(record.bold, fallback.bold),
    italic: asBoolean(record.italic, fallback.italic),
    underline: asBoolean(record.underline, fallback.underline)
  };

  return {
    ...base,
    responsive: normalizeHeroTextBlockResponsive(record.responsive, {
      xPx: base.xPx,
      yPx: base.yPx,
      widthPx: base.widthPx,
      fontFamily: base.fontFamily,
      fontSizePx: base.fontSizePx,
      bold: base.bold,
      italic: base.italic,
      underline: base.underline
    })
  };
}

function normalizeHeroDeviceSettings(value: unknown, fallback: HomepageHeroDeviceSettings): HomepageHeroDeviceSettings {
  const record = asRecord(value);
  const titleSize = enumValue(record.titleSize, HOMEPAGE_HERO_TITLE_SIZES, fallback.titleSize);
  const titleWeight = enumValue(record.titleWeight, HOMEPAGE_HERO_TITLE_WEIGHTS, fallback.titleWeight);
  const titleTransform = enumValue(record.titleTransform, HOMEPAGE_HERO_TITLE_TRANSFORMS, fallback.titleTransform);
  const descriptionSize = enumValue(record.descriptionSize, HOMEPAGE_HERO_DESCRIPTION_SIZES, fallback.descriptionSize);

  return {
    overlayStrength: asNumber(record.overlayStrength, fallback.overlayStrength, 0, 85),
    height: enumValue(record.height, HOMEPAGE_HERO_HEIGHTS, fallback.height),
    contentAlign: enumValue(record.contentAlign, HOMEPAGE_ALIGNMENTS, fallback.contentAlign),
    textWidth: enumValue(record.textWidth, HOMEPAGE_TEXT_WIDTHS, fallback.textWidth),
    heightPx: asNumber(record.heightPx, fallback.heightPx ?? heroHeightPxByPreset[fallback.height], 280, 900),
    contentOffsetXPx: asNumber(record.contentOffsetXPx ?? record.contentOffsetX, fallback.contentOffsetXPx ?? heroContentOffsetPxByAlignment[fallback.contentAlign], 0, 1400),
    contentOffsetYPx: asNumber(record.contentOffsetYPx ?? record.contentOffsetY, fallback.contentOffsetYPx ?? 0, -450, 450),
    titleOffsetXPx: asNumber(record.titleOffsetXPx, fallback.titleOffsetXPx ?? 0, -1400, 1400),
    titleOffsetYPx: asNumber(record.titleOffsetYPx, fallback.titleOffsetYPx ?? 0, -700, 700),
    descriptionOffsetXPx: asNumber(record.descriptionOffsetXPx, fallback.descriptionOffsetXPx ?? 0, -1400, 1400),
    descriptionOffsetYPx: asNumber(record.descriptionOffsetYPx, fallback.descriptionOffsetYPx ?? 0, -700, 700),
    primaryButtonOffsetXPx: asNumber(record.primaryButtonOffsetXPx, fallback.primaryButtonOffsetXPx ?? 0, -1400, 1400),
    primaryButtonOffsetYPx: asNumber(record.primaryButtonOffsetYPx, fallback.primaryButtonOffsetYPx ?? 0, -700, 700),
    secondaryButtonOffsetXPx: asNumber(record.secondaryButtonOffsetXPx, fallback.secondaryButtonOffsetXPx ?? 0, -1400, 1400),
    secondaryButtonOffsetYPx: asNumber(record.secondaryButtonOffsetYPx, fallback.secondaryButtonOffsetYPx ?? 0, -700, 700),
    textWidthPx: asNumber(record.textWidthPx, fallback.textWidthPx ?? heroTextWidthPxByPreset[fallback.textWidth], 260, 1200),
    mediaWidthPercent: asNumber(record.mediaWidthPercent, fallback.mediaWidthPercent ?? 100, 50, 160),
    titleSize,
    titleWeight,
    titleTransform,
    descriptionSize,
    titleFontFamily: enumValue(record.titleFontFamily, HOMEPAGE_HERO_FONT_FAMILIES, fallback.titleFontFamily),
    titleFontSizePx: asNumber(record.titleFontSizePx, fallback.titleFontSizePx ?? heroTitleFontSizePxByPreset[titleSize], 24, 120),
    titleBold: asBoolean(record.titleBold, fallback.titleBold ?? titleWeight !== 'semibold'),
    titleItalic: asBoolean(record.titleItalic, fallback.titleItalic ?? false),
    titleUnderline: asBoolean(record.titleUnderline, fallback.titleUnderline ?? false),
    titleHighlight: asBoolean(record.titleHighlight, fallback.titleHighlight ?? false),
    titleHighlightColor: asString(record.titleHighlightColor, fallback.titleHighlightColor ?? '#ffffff', COLOR_MAX_LENGTH),
    descriptionFontFamily: enumValue(record.descriptionFontFamily, HOMEPAGE_HERO_FONT_FAMILIES, fallback.descriptionFontFamily),
    descriptionFontSizePx: asNumber(record.descriptionFontSizePx, fallback.descriptionFontSizePx ?? heroDescriptionFontSizePxByPreset[descriptionSize], 11, 40),
    descriptionBold: asBoolean(record.descriptionBold, fallback.descriptionBold ?? false),
    descriptionItalic: asBoolean(record.descriptionItalic, fallback.descriptionItalic ?? false),
    descriptionUnderline: asBoolean(record.descriptionUnderline, fallback.descriptionUnderline ?? false),
    descriptionHighlight: asBoolean(record.descriptionHighlight, fallback.descriptionHighlight ?? false),
    descriptionHighlightColor: asString(record.descriptionHighlightColor, fallback.descriptionHighlightColor ?? '#ffffff', COLOR_MAX_LENGTH)
  };
}

function normalizeHeroResponsive(value: unknown, base: HomepageHeroDeviceSettings): HomepageDeviceSettingsMap<HomepageHeroDeviceSettings> {
  const record = asRecord(value);
  const fallbacks: HomepageDeviceSettingsMap<HomepageHeroDeviceSettings> = {
    desktop: base,
    tablet: {
      ...base,
      overlayStrength: Math.max(base.overlayStrength, 45),
      height: base.height === 'viewport' ? 'large' : base.height,
      heightPx: Math.min(base.heightPx, 520),
      textWidthPx: Math.min(base.textWidthPx, 620),
      titleFontSizePx: Math.min(base.titleFontSizePx, 48),
      descriptionFontSizePx: Math.min(base.descriptionFontSizePx, 15)
    },
    mobile: {
      ...base,
      overlayStrength: Math.max(base.overlayStrength, 50),
      height: base.height === 'compact' ? 'compact' : 'medium',
      heightPx: Math.min(base.heightPx, 440),
      contentAlign: 'left',
      textWidth: 'small',
      contentOffsetXPx: 0,
      contentOffsetYPx: base.contentOffsetYPx,
      textWidthPx: Math.min(base.textWidthPx, 340),
      titleSize: base.titleSize === 'xlarge' || base.titleSize === 'large' ? 'medium' : 'small',
      descriptionSize: 'small',
      titleFontSizePx: Math.min(base.titleFontSizePx, 34),
      descriptionFontSizePx: Math.min(base.descriptionFontSizePx, 14)
    }
  };

  return {
    desktop: normalizeHeroDeviceSettings(record.desktop, fallbacks.desktop),
    tablet: normalizeHeroDeviceSettings(record.tablet, fallbacks.tablet),
    mobile: normalizeHeroDeviceSettings(record.mobile, fallbacks.mobile)
  };
}

function normalizeHero(value: unknown): HomepageHeroSettings {
  const record = asRecord(value);
  const fallback = DEFAULT_HOMEPAGE_SETTINGS.hero;
  const slides = asArray(record.slides)
    .slice(0, MAX_HOMEPAGE_HERO_SLIDES)
    .map(normalizeSlide)
    .filter((slide, index) => index === 0 || slide.src || slide.title);
  const textBlocks = asArray(record.textBlocks)
    .slice(0, MAX_HERO_TEXT_BLOCKS)
    .map(normalizeHeroTextBlock)
    .filter((block, index, all) => block.text.trim() && all.findIndex((candidate) => candidate.id === block.id) === index);
  const titleSize = enumValue(record.titleSize, HOMEPAGE_HERO_TITLE_SIZES, fallback.titleSize);
  const titleWeight = enumValue(record.titleWeight, HOMEPAGE_HERO_TITLE_WEIGHTS, fallback.titleWeight);
  const titleTransform = enumValue(record.titleTransform, HOMEPAGE_HERO_TITLE_TRANSFORMS, fallback.titleTransform);
  const descriptionSize = enumValue(record.descriptionSize, HOMEPAGE_HERO_DESCRIPTION_SIZES, fallback.descriptionSize);

  const base = {
    visible: asBoolean(record.visible, fallback.visible),
    title: asString(record.title, fallback.title, TITLE_MAX_LENGTH),
    description: asString(record.description, fallback.description, DESCRIPTION_MAX_LENGTH),
    primaryButton: normalizeButton(record.primaryButton, fallback.primaryButton),
    secondaryButton: normalizeButton(record.secondaryButton, fallback.secondaryButton),
    backgroundType: enumValue(record.backgroundType, HOMEPAGE_HERO_MEDIA_TYPES, fallback.backgroundType),
    slides: slides.length > 0 ? slides : clone(fallback.slides),
    showArrows: asBoolean(record.showArrows, fallback.showArrows),
    showDots: asBoolean(record.showDots, fallback.showDots),
    autoplay: asBoolean(record.autoplay, fallback.autoplay),
    autoplayInterval: asNumber(record.autoplayInterval, fallback.autoplayInterval, 1500, 30000),
    overlayStrength: asNumber(record.overlayStrength, fallback.overlayStrength, 0, 85),
    height: enumValue(record.height, HOMEPAGE_HERO_HEIGHTS, fallback.height),
    contentAlign: enumValue(record.contentAlign, HOMEPAGE_ALIGNMENTS, fallback.contentAlign),
    textWidth: enumValue(record.textWidth, HOMEPAGE_TEXT_WIDTHS, fallback.textWidth),
    heightPx: asNumber(record.heightPx, fallback.heightPx ?? heroHeightPxByPreset[fallback.height], 280, 900),
    contentOffsetXPx: asNumber(record.contentOffsetXPx ?? record.contentOffsetX, fallback.contentOffsetXPx ?? heroContentOffsetPxByAlignment[fallback.contentAlign], 0, 1400),
    contentOffsetYPx: asNumber(record.contentOffsetYPx ?? record.contentOffsetY, fallback.contentOffsetYPx ?? 0, -450, 450),
    titleOffsetXPx: asNumber(record.titleOffsetXPx, fallback.titleOffsetXPx ?? 0, -1400, 1400),
    titleOffsetYPx: asNumber(record.titleOffsetYPx, fallback.titleOffsetYPx ?? 0, -700, 700),
    descriptionOffsetXPx: asNumber(record.descriptionOffsetXPx, fallback.descriptionOffsetXPx ?? 0, -1400, 1400),
    descriptionOffsetYPx: asNumber(record.descriptionOffsetYPx, fallback.descriptionOffsetYPx ?? 0, -700, 700),
    primaryButtonOffsetXPx: asNumber(record.primaryButtonOffsetXPx, fallback.primaryButtonOffsetXPx ?? 0, -1400, 1400),
    primaryButtonOffsetYPx: asNumber(record.primaryButtonOffsetYPx, fallback.primaryButtonOffsetYPx ?? 0, -700, 700),
    secondaryButtonOffsetXPx: asNumber(record.secondaryButtonOffsetXPx, fallback.secondaryButtonOffsetXPx ?? 0, -1400, 1400),
    secondaryButtonOffsetYPx: asNumber(record.secondaryButtonOffsetYPx, fallback.secondaryButtonOffsetYPx ?? 0, -700, 700),
    textWidthPx: asNumber(record.textWidthPx, fallback.textWidthPx ?? heroTextWidthPxByPreset[fallback.textWidth], 260, 1200),
    mediaWidthPercent: asNumber(record.mediaWidthPercent, fallback.mediaWidthPercent ?? 100, 50, 160),
    titleSize,
    titleWeight,
    titleTransform,
    descriptionSize,
    titleFontFamily: enumValue(record.titleFontFamily, HOMEPAGE_HERO_FONT_FAMILIES, fallback.titleFontFamily),
    titleFontSizePx: asNumber(record.titleFontSizePx, fallback.titleFontSizePx ?? heroTitleFontSizePxByPreset[titleSize], 24, 120),
    titleBold: asBoolean(record.titleBold, fallback.titleBold ?? titleWeight !== 'semibold'),
    titleItalic: asBoolean(record.titleItalic, fallback.titleItalic ?? false),
    titleUnderline: asBoolean(record.titleUnderline, fallback.titleUnderline ?? false),
    titleHighlight: asBoolean(record.titleHighlight, fallback.titleHighlight ?? false),
    titleHighlightColor: asString(record.titleHighlightColor, fallback.titleHighlightColor ?? '#ffffff', COLOR_MAX_LENGTH),
    descriptionFontFamily: enumValue(record.descriptionFontFamily, HOMEPAGE_HERO_FONT_FAMILIES, fallback.descriptionFontFamily),
    descriptionFontSizePx: asNumber(record.descriptionFontSizePx, fallback.descriptionFontSizePx ?? heroDescriptionFontSizePxByPreset[descriptionSize], 11, 40),
    descriptionBold: asBoolean(record.descriptionBold, fallback.descriptionBold ?? false),
    descriptionItalic: asBoolean(record.descriptionItalic, fallback.descriptionItalic ?? false),
    descriptionUnderline: asBoolean(record.descriptionUnderline, fallback.descriptionUnderline ?? false),
    descriptionHighlight: asBoolean(record.descriptionHighlight, fallback.descriptionHighlight ?? false),
    descriptionHighlightColor: asString(record.descriptionHighlightColor, fallback.descriptionHighlightColor ?? '#ffffff', COLOR_MAX_LENGTH),
    darkenBackground: asBoolean(record.darkenBackground, fallback.darkenBackground),
    textBlocks
  };

  return {
    ...base,
    responsive: normalizeHeroResponsive(record.responsive, {
      overlayStrength: base.overlayStrength,
      height: base.height,
      contentAlign: base.contentAlign,
      textWidth: base.textWidth,
      heightPx: base.heightPx,
      contentOffsetXPx: base.contentOffsetXPx,
      contentOffsetYPx: base.contentOffsetYPx,
      titleOffsetXPx: base.titleOffsetXPx,
      titleOffsetYPx: base.titleOffsetYPx,
      descriptionOffsetXPx: base.descriptionOffsetXPx,
      descriptionOffsetYPx: base.descriptionOffsetYPx,
      primaryButtonOffsetXPx: base.primaryButtonOffsetXPx,
      primaryButtonOffsetYPx: base.primaryButtonOffsetYPx,
      secondaryButtonOffsetXPx: base.secondaryButtonOffsetXPx,
      secondaryButtonOffsetYPx: base.secondaryButtonOffsetYPx,
      textWidthPx: base.textWidthPx,
      mediaWidthPercent: base.mediaWidthPercent,
      titleSize: base.titleSize,
      titleWeight: base.titleWeight,
      titleTransform: base.titleTransform,
      descriptionSize: base.descriptionSize,
      titleFontFamily: base.titleFontFamily,
      titleFontSizePx: base.titleFontSizePx,
      titleBold: base.titleBold,
      titleItalic: base.titleItalic,
      titleUnderline: base.titleUnderline,
      titleHighlight: base.titleHighlight,
      titleHighlightColor: base.titleHighlightColor,
      descriptionFontFamily: base.descriptionFontFamily,
      descriptionFontSizePx: base.descriptionFontSizePx,
      descriptionBold: base.descriptionBold,
      descriptionItalic: base.descriptionItalic,
      descriptionUnderline: base.descriptionUnderline,
      descriptionHighlight: base.descriptionHighlight,
      descriptionHighlightColor: base.descriptionHighlightColor
    })
  };
}

function normalizeCategoryOrder(value: unknown) {
  return asArray(value)
    .map((entry) => asString(entry, '', 120))
    .filter(Boolean)
    .filter((slug, index, all) => all.indexOf(slug) === index)
    .slice(0, 80);
}

function ordersMatch(first: readonly string[], second: readonly string[]) {
  return first.length === second.length && first.every((slug, index) => slug === second[index]);
}

export function orderHomepageCategories<T extends { slug: string }>(
  categories: readonly T[],
  settings: Pick<HomepageCategoriesSettings, 'categoryOrderMode' | 'categoryOrder'>
) {
  const source = [...categories];
  if (settings.categoryOrderMode !== 'custom' || settings.categoryOrder.length === 0) return source;

  const bySlug = new Map(source.map((category) => [category.slug, category]));
  const customSlugs = new Set(settings.categoryOrder);
  return [
    ...settings.categoryOrder
      .map((slug) => bySlug.get(slug))
      .filter((category): category is T => Boolean(category)),
    ...source.filter((category) => !customSlugs.has(category.slug))
  ];
}

export function resolveHomepageCategoryCardHeight(
  settings: Pick<HomepageCategoriesSettings, 'cardSize' | 'cardStyle'>,
  categories: readonly Pick<HomepageCategoryCardData, 'presentation'>[]
) {
  const baseHeight = settings.cardStyle === 'compact'
    ? 132
    : settings.cardSize === 'small'
      ? 150
      : settings.cardSize === 'large'
        ? 198
        : 168;
  const largestOrdinalBoxHeight = categories.reduce((largest, category) => {
    const { ordinalFontSizePx } = normalizeCategoryShowcaseMediaSettings(category.presentation);
    return Math.max(largest, Math.max(16, Math.ceil(ordinalFontSizePx * 1.35)));
  }, 16);

  // Reserve the shared vertical padding, divider/gaps, and two title lines.
  // Only compact cards need to grow at the largest supported ordinal sizes.
  return Math.max(baseHeight, largestOrdinalBoxHeight + 92);
}

function normalizeCategoriesDeviceSettings(value: unknown, fallback: HomepageCategoriesDeviceSettings): HomepageCategoriesDeviceSettings {
  const record = asRecord(value);
  return {
    limit: asNumber(record.limit, fallback.limit, 1, 24),
    columns: asNumber(record.columns, fallback.columns, 1, 6),
    cardSize: enumValue(record.cardSize, HOMEPAGE_CATEGORY_CARD_SIZES, fallback.cardSize),
    gap: asNumber(record.gap, fallback.gap, 0, 48),
    containerWidth: enumValue(record.containerWidth, HOMEPAGE_CONTAINER_WIDTHS, fallback.containerWidth),
    cardStyle: enumValue(record.cardStyle, HOMEPAGE_CATEGORY_CARD_STYLES, fallback.cardStyle),
    showCardArrow: asBoolean(record.showCardArrow, fallback.showCardArrow)
  };
}

function normalizeCategoriesResponsive(value: unknown, base: HomepageCategoriesDeviceSettings): HomepageDeviceSettingsMap<HomepageCategoriesDeviceSettings> {
  const record = asRecord(value);
  const fallbacks: HomepageDeviceSettingsMap<HomepageCategoriesDeviceSettings> = {
    desktop: base,
    tablet: {
      ...base,
      columns: Math.min(base.columns, 2),
      gap: Math.min(base.gap, 20)
    },
    mobile: {
      ...base,
      limit: Math.min(base.limit, 6),
      columns: 1,
      cardStyle: base.cardStyle === 'title-only' ? 'title-only' : 'compact',
      gap: Math.min(base.gap, 16)
    }
  };

  return {
    desktop: normalizeCategoriesDeviceSettings(record.desktop, fallbacks.desktop),
    tablet: normalizeCategoriesDeviceSettings(record.tablet, fallbacks.tablet),
    mobile: normalizeCategoriesDeviceSettings(record.mobile, fallbacks.mobile)
  };
}

function normalizeCategories(value: unknown): HomepageCategoriesSettings {
  const record = asRecord(value);
  const fallback = DEFAULT_HOMEPAGE_SETTINGS.categories;
  const categoryOrder = normalizeCategoryOrder(record.categoryOrder);
  const hasExplicitOrderMode = HOMEPAGE_CATEGORY_ORDER_MODES.includes(record.categoryOrderMode as HomepageCategoryOrderMode);
  const categoryOrderMode: HomepageCategoryOrderMode = hasExplicitOrderMode
    ? record.categoryOrderMode as HomepageCategoryOrderMode
    : categoryOrder.length > 0 && !ordersMatch(categoryOrder, LEGACY_DEFAULT_HOMEPAGE_CATEGORY_ORDER)
      ? 'custom'
      : 'catalog';

  const base = {
    visible: asBoolean(record.visible, fallback.visible),
    title: asString(record.title, fallback.title, TITLE_MAX_LENGTH),
    subtitle: asString(record.subtitle, fallback.subtitle, DESCRIPTION_MAX_LENGTH),
    showAllLink: asBoolean(record.showAllLink, fallback.showAllLink),
    showAllLabel: asString(record.showAllLabel, fallback.showAllLabel, SHORT_TEXT_MAX_LENGTH),
    showAllHref: asString(record.showAllHref, fallback.showAllHref, URL_MAX_LENGTH),
    limit: asNumber(record.limit, fallback.limit, 1, 24),
    columns: asNumber(record.columns, fallback.columns, 1, 6),
    cardSize: enumValue(record.cardSize, HOMEPAGE_CATEGORY_CARD_SIZES, fallback.cardSize),
    gap: asNumber(record.gap, fallback.gap, 0, 48),
    containerWidth: enumValue(record.containerWidth, HOMEPAGE_CONTAINER_WIDTHS, fallback.containerWidth),
    cardStyle: enumValue(record.cardStyle, HOMEPAGE_CATEGORY_CARD_STYLES, fallback.cardStyle),
    showCardArrow: asBoolean(record.showCardArrow, fallback.showCardArrow),
    categoryOrderMode,
    categoryOrder: categoryOrderMode === 'custom' ? categoryOrder : []
  };

  return {
    ...base,
    responsive: normalizeCategoriesResponsive(record.responsive, {
      limit: base.limit,
      columns: base.columns,
      cardSize: base.cardSize,
      gap: base.gap,
      containerWidth: base.containerWidth,
      cardStyle: base.cardStyle,
      showCardArrow: base.showCardArrow
    })
  };
}

function normalizeInfoItem(value: unknown, index: number): HomepageInfoBlockItem {
  const record = asRecord(value);
  const fallback = DEFAULT_HOMEPAGE_SETTINGS.infoBlocks.items[index] ?? {
    id: `info-${index + 1}`,
    icon: 'badge-check',
    title: `Element ${index + 1}`,
    description: '',
    href: ''
  } satisfies HomepageInfoBlockItem;

  return {
    id: asString(record.id, fallback.id, 100) || `info-${index + 1}`,
    icon: enumValue(record.icon, HOMEPAGE_INFO_ICONS, fallback.icon),
    title: asString(record.title, fallback.title, TITLE_MAX_LENGTH),
    description: asString(record.description, fallback.description, DESCRIPTION_MAX_LENGTH),
    href: asString(record.href ?? record.url, fallback.href, URL_MAX_LENGTH)
  };
}

function normalizeInfoBlocksDeviceSettings(value: unknown, fallback: HomepageInfoBlocksDeviceSettings): HomepageInfoBlocksDeviceSettings {
  const record = asRecord(value);
  return {
    columns: asNumber(record.columns, fallback.columns, 1, 6),
    gap: asNumber(record.gap, fallback.gap, 0, 48),
    alignment: enumValue(record.alignment, ['left', 'center'] as const, fallback.alignment),
    style: enumValue(record.style, HOMEPAGE_INFO_STYLES, fallback.style),
    dividers: asBoolean(record.dividers, fallback.dividers),
    iconPosition: enumValue(record.iconPosition, HOMEPAGE_INFO_ICON_POSITIONS, fallback.iconPosition)
  };
}

function normalizeInfoBlocksResponsive(value: unknown, base: HomepageInfoBlocksDeviceSettings): HomepageDeviceSettingsMap<HomepageInfoBlocksDeviceSettings> {
  const record = asRecord(value);
  const fallbacks: HomepageDeviceSettingsMap<HomepageInfoBlocksDeviceSettings> = {
    desktop: base,
    tablet: {
      ...base,
      columns: Math.min(base.columns, 2),
      gap: Math.max(base.gap, 10)
    },
    mobile: {
      ...base,
      columns: 1,
      gap: Math.max(base.gap, 10),
      dividers: false
    }
  };

  return {
    desktop: normalizeInfoBlocksDeviceSettings(record.desktop, fallbacks.desktop),
    tablet: normalizeInfoBlocksDeviceSettings(record.tablet, fallbacks.tablet),
    mobile: normalizeInfoBlocksDeviceSettings(record.mobile, fallbacks.mobile)
  };
}

function normalizeInfoBlocks(value: unknown): HomepageInfoBlocksSettings {
  const record = asRecord(value);
  const fallback = DEFAULT_HOMEPAGE_SETTINGS.infoBlocks;
  const items = asArray(record.items).slice(0, MAX_INFO_ITEMS).map(normalizeInfoItem);

  const base = {
    visible: asBoolean(record.visible, fallback.visible),
    columns: asNumber(record.columns, fallback.columns, 1, 6),
    gap: asNumber(record.gap, fallback.gap, 0, 48),
    alignment: enumValue(record.alignment, ['left', 'center'] as const, fallback.alignment),
    style: enumValue(record.style, HOMEPAGE_INFO_STYLES, fallback.style),
    dividers: asBoolean(record.dividers, fallback.dividers),
    iconPosition: enumValue(record.iconPosition, HOMEPAGE_INFO_ICON_POSITIONS, fallback.iconPosition),
    items: items.length > 0 ? items : clone(fallback.items)
  };

  return {
    ...base,
    responsive: normalizeInfoBlocksResponsive(record.responsive, {
      columns: base.columns,
      gap: base.gap,
      alignment: base.alignment,
      style: base.style,
      dividers: base.dividers,
      iconPosition: base.iconPosition
    })
  };
}

function normalizeFooterLink(value: unknown, index: number, fallback?: HomepageFooterLink): HomepageFooterLink {
  const record = asRecord(value);
  return {
    id: asString(record.id, fallback?.id ?? `link-${index + 1}`, 100) || `link-${index + 1}`,
    label: asString(record.label, fallback?.label ?? `Povezava ${index + 1}`, SHORT_TEXT_MAX_LENGTH),
    href: asString(record.href ?? record.url, fallback?.href ?? '#', URL_MAX_LENGTH),
    visible: asBoolean(record.visible, fallback?.visible ?? true),
    position: asNumber(record.position, fallback?.position ?? index, 0, MAX_FOOTER_LINKS - 1)
  };
}

function normalizeFooterEntryOrder<T extends { position?: number }>(entries: T[]): T[] {
  return entries
    .map((entry, sourceIndex) => ({
      entry,
      sourceIndex,
      position: typeof entry.position === 'number' && Number.isFinite(entry.position)
        ? entry.position
        : sourceIndex
    }))
    .sort((first, second) => first.position - second.position || first.sourceIndex - second.sourceIndex)
    .map(({ entry }, position) => ({ ...entry, position }));
}

function normalizeFooterColumn(value: unknown, index: number): HomepageFooterColumn {
  const record = asRecord(value);
  const fallback = DEFAULT_HOMEPAGE_SETTINGS.footer.columns[index];
  const linkSource = Array.isArray(record.links) ? record.links : fallback?.links ?? [];
  const links = normalizeFooterEntryOrder(
    linkSource.slice(0, MAX_FOOTER_LINKS).map((link, linkIndex) =>
      normalizeFooterLink(link, linkIndex, fallback?.links[linkIndex])
    )
  );

  return {
    id: asString(record.id, fallback?.id ?? `column-${index + 1}`, 100) || `column-${index + 1}`,
    title: asString(record.title, fallback?.title ?? `Stolpec ${index + 1}`, SHORT_TEXT_MAX_LENGTH),
    visible: asBoolean(record.visible, fallback?.visible ?? true),
    position: asNumber(record.position, fallback?.position ?? index, 0, MAX_FOOTER_COLUMNS - 1),
    links
  };
}

function normalizeFooterContact(value: unknown): HomepageFooterContact {
  const record = asRecord(value);
  const fallback = DEFAULT_HOMEPAGE_SETTINGS.footer.contact;

  return {
    email: asString(record.email, fallback.email, SHORT_TEXT_MAX_LENGTH),
    phone: asString(record.phone, fallback.phone, SHORT_TEXT_MAX_LENGTH),
    address: asString(record.address, fallback.address, SHORT_TEXT_MAX_LENGTH),
    workingHours: asString(record.workingHours, fallback.workingHours, SHORT_TEXT_MAX_LENGTH)
  };
}

function normalizeSocialLink(value: unknown, index: number): HomepageFooterSocialLink {
  const record = asRecord(value);
  const fallback = DEFAULT_HOMEPAGE_SETTINGS.footer.socialLinks[index] ?? {
    id: `social-${index + 1}`,
    type: 'custom',
    label: `Profil ${index + 1}`,
    href: '#'
  } satisfies HomepageFooterSocialLink;

  return {
    id: asString(record.id, fallback.id, 100) || `social-${index + 1}`,
    type: enumValue(record.type, HOMEPAGE_SOCIAL_TYPES, fallback.type),
    label: asString(record.label, fallback.label, SHORT_TEXT_MAX_LENGTH),
    href: asString(record.href ?? record.url, fallback.href, URL_MAX_LENGTH),
    visible: asBoolean(record.visible, fallback.visible ?? true),
    position: asNumber(record.position, fallback.position ?? index, 0, MAX_SOCIAL_LINKS - 1)
  };
}

function normalizeFooterDeviceSettings(value: unknown, fallback: HomepageFooterDeviceSettings): HomepageFooterDeviceSettings {
  const record = asRecord(value);
  return {
    layoutColumns: asNumber(record.layoutColumns ?? record.columns, fallback.layoutColumns, 1, MAX_FOOTER_COLUMNS),
    spacing: enumValue(record.spacing, HOMEPAGE_FOOTER_SPACINGS, fallback.spacing),
    topBorder: asBoolean(record.topBorder, fallback.topBorder)
  };
}

function normalizeFooterResponsive(value: unknown, base: HomepageFooterDeviceSettings): HomepageDeviceSettingsMap<HomepageFooterDeviceSettings> {
  const record = asRecord(value);
  const fallbacks: HomepageDeviceSettingsMap<HomepageFooterDeviceSettings> = {
    desktop: base,
    tablet: {
      ...base,
      layoutColumns: Math.min(base.layoutColumns, 2)
    },
    mobile: {
      ...base,
      layoutColumns: 1,
      spacing: base.spacing === 'large' ? 'medium' : 'compact'
    }
  };

  return {
    desktop: normalizeFooterDeviceSettings(record.desktop, fallbacks.desktop),
    tablet: normalizeFooterDeviceSettings(record.tablet, fallbacks.tablet),
    mobile: normalizeFooterDeviceSettings(record.mobile, fallbacks.mobile)
  };
}

export function normalizeHomepageFooterSettings(value: unknown): HomepageFooterSettings {
  const record = asRecord(value);
  const fallback = DEFAULT_HOMEPAGE_SETTINGS.footer;
  const columnSource = Array.isArray(record.columns) ? record.columns : fallback.columns;
  const columns = normalizeFooterEntryOrder(
    columnSource.slice(0, MAX_FOOTER_COLUMNS).map(normalizeFooterColumn)
  );
  const legalLinkSource = Array.isArray(record.legalLinks) ? record.legalLinks : fallback.legalLinks;
  const legalLinks = normalizeFooterEntryOrder(
    legalLinkSource.slice(0, MAX_FOOTER_LINKS).map((link, index) =>
      normalizeFooterLink(link, index, fallback.legalLinks[index])
    )
  );
  const socialLinks = normalizeFooterEntryOrder(
    asArray(record.socialLinks).slice(0, MAX_SOCIAL_LINKS).map(normalizeSocialLink)
  );

  const base = {
    visible: asBoolean(record.visible, fallback.visible),
    logoMode: enumValue(record.logoMode, HOMEPAGE_FOOTER_LOGO_MODES, fallback.logoMode),
    logoText: asString(record.logoText ?? record.logo, fallback.logoText, SHORT_TEXT_MAX_LENGTH),
    description: asString(record.description, fallback.description, DESCRIPTION_MAX_LENGTH),
    columns,
    contact: normalizeFooterContact(record.contact),
    socialLinks,
    copyright: asString(record.copyright, fallback.copyright, SHORT_TEXT_MAX_LENGTH),
    legalLinks,
    layoutColumns: asNumber(record.layoutColumns, fallback.layoutColumns, 1, MAX_FOOTER_COLUMNS),
    spacing: enumValue(record.spacing, HOMEPAGE_FOOTER_SPACINGS, fallback.spacing),
    topBorder: asBoolean(record.topBorder, fallback.topBorder)
  };

  return {
    ...base,
    responsive: normalizeFooterResponsive(record.responsive, {
      layoutColumns: base.layoutColumns,
      spacing: base.spacing,
      topBorder: base.topBorder
    })
  };
}

function normalizePageDeviceSettings(value: unknown, fallback: HomepagePageDeviceSettings): HomepagePageDeviceSettings {
  const record = asRecord(value);
  return {
    containerWidth: enumValue(record.containerWidth, HOMEPAGE_CONTAINER_WIDTHS, fallback.containerWidth),
    sectionSpacing: enumValue(record.sectionSpacing, HOMEPAGE_SECTION_SPACINGS, fallback.sectionSpacing),
    sectionRadius: enumValue(record.sectionRadius, HOMEPAGE_SECTION_RADII, fallback.sectionRadius)
  };
}

function normalizePageResponsive(value: unknown, base: HomepagePageDeviceSettings): HomepageDeviceSettingsMap<HomepagePageDeviceSettings> {
  const record = asRecord(value);
  const fallbacks: HomepageDeviceSettingsMap<HomepagePageDeviceSettings> = {
    desktop: base,
    tablet: {
      ...base,
      sectionSpacing: base.sectionSpacing === 'spacious' ? 'default' : base.sectionSpacing
    },
    mobile: {
      ...base,
      sectionSpacing: 'compact',
      sectionRadius: base.sectionRadius === 'large' ? 'medium' : base.sectionRadius
    }
  };

  return {
    desktop: normalizePageDeviceSettings(record.desktop, fallbacks.desktop),
    tablet: normalizePageDeviceSettings(record.tablet, fallbacks.tablet),
    mobile: normalizePageDeviceSettings(record.mobile, fallbacks.mobile)
  };
}

function normalizePage(value: unknown): HomepagePageSettings {
  const record = asRecord(value);
  const fallback = DEFAULT_HOMEPAGE_SETTINGS.page;

  const base = {
    containerWidth: enumValue(record.containerWidth, HOMEPAGE_CONTAINER_WIDTHS, fallback.containerWidth),
    sectionSpacing: enumValue(record.sectionSpacing, HOMEPAGE_SECTION_SPACINGS, fallback.sectionSpacing),
    backgroundColor: asString(record.backgroundColor, fallback.backgroundColor, COLOR_MAX_LENGTH),
    sectionRadius: enumValue(record.sectionRadius, HOMEPAGE_SECTION_RADII, fallback.sectionRadius),
    buttonStyle: enumValue(record.buttonStyle, HOMEPAGE_BUTTON_STYLES, fallback.buttonStyle)
  };

  return {
    ...base,
    responsive: normalizePageResponsive(record.responsive, {
      containerWidth: base.containerWidth,
      sectionSpacing: base.sectionSpacing,
      sectionRadius: base.sectionRadius
    })
  };
}

function normalizeCanvasElementDeviceSettings(
  value: unknown,
  fallback: HomepageCanvasElementDeviceSettings
): HomepageCanvasElementDeviceSettings {
  const record = asRecord(value);
  const padding = asRecord(record.padding);
  const margin = asRecord(record.margin);
  const uniformPadding = record.paddingPx;
  const uniformMargin = record.marginPx;

  return {
    visible: asBoolean(record.visible, fallback.visible),
    locked: asBoolean(record.locked ?? record.lockPosition, fallback.locked),
    offsetXPx: asNumber(record.offsetXPx ?? record.xPx ?? record.x, fallback.offsetXPx, -5000, 5000),
    offsetYPx: asNumber(record.offsetYPx ?? record.yPx ?? record.y, fallback.offsetYPx, -5000, 5000),
    widthPx: asNumber(record.widthPx ?? record.width, fallback.widthPx, 0, 5000),
    heightPx: asNumber(record.heightPx ?? record.height, fallback.heightPx, 0, 5000),
    paddingTopPx: asNumber(record.paddingTopPx ?? padding.top ?? uniformPadding, fallback.paddingTopPx, 0, 1000),
    paddingRightPx: asNumber(record.paddingRightPx ?? padding.right ?? uniformPadding, fallback.paddingRightPx, 0, 1000),
    paddingBottomPx: asNumber(record.paddingBottomPx ?? padding.bottom ?? uniformPadding, fallback.paddingBottomPx, 0, 1000),
    paddingLeftPx: asNumber(record.paddingLeftPx ?? padding.left ?? uniformPadding, fallback.paddingLeftPx, 0, 1000),
    marginTopPx: asNumber(record.marginTopPx ?? margin.top ?? uniformMargin, fallback.marginTopPx, -1000, 2000),
    marginRightPx: asNumber(record.marginRightPx ?? margin.right ?? uniformMargin, fallback.marginRightPx, -1000, 2000),
    marginBottomPx: asNumber(record.marginBottomPx ?? margin.bottom ?? uniformMargin, fallback.marginBottomPx, -1000, 2000),
    marginLeftPx: asNumber(record.marginLeftPx ?? margin.left ?? uniformMargin, fallback.marginLeftPx, -1000, 2000),
    zIndex: asNumber(record.zIndex ?? record.layerOrder, fallback.zIndex, -100, 1000),
    textAlign: enumValue(record.textAlign, HOMEPAGE_ALIGNMENTS, fallback.textAlign),
    horizontalAlign: enumValue(record.horizontalAlign ?? record.alignment, HOMEPAGE_ALIGNMENTS, fallback.horizontalAlign),
    color: asString(record.color ?? record.colour, fallback.color, COLOR_MAX_LENGTH),
    fontFamily: asString(record.fontFamily ?? record.font, fallback.fontFamily, 120),
    fontSizePx: asDecimalNumber(record.fontSizePx ?? record.fontSize, fallback.fontSizePx, 8, 240),
    lineHeight: asDecimalNumber(record.lineHeight, fallback.lineHeight, 0.5, 4),
    letterSpacingPx: asDecimalNumber(record.letterSpacingPx ?? record.letterSpacing, fallback.letterSpacingPx, -20, 100),
    fontWeight: asNumber(record.fontWeight ?? record.weight, fallback.fontWeight, 100, 900),
    italic: asBoolean(record.italic, fallback.italic),
    underline: asBoolean(record.underline, fallback.underline)
  };
}

function normalizeCanvasElementResponsive(
  value: unknown,
  base: HomepageCanvasElementDeviceSettings
): HomepageDeviceSettingsMap<HomepageCanvasElementDeviceSettings> {
  const record = asRecord(value);

  return {
    desktop: normalizeCanvasElementDeviceSettings(record.desktop, base),
    tablet: normalizeCanvasElementDeviceSettings(record.tablet, base),
    mobile: normalizeCanvasElementDeviceSettings(record.mobile, base)
  };
}

function normalizeCanvasElement(value: unknown): HomepageCanvasElementSettings {
  const record = asRecord(value);
  const base = normalizeCanvasElementDeviceSettings(record, DEFAULT_HOMEPAGE_CANVAS_ELEMENT_DEVICE_SETTINGS);

  return {
    ...base,
    responsive: normalizeCanvasElementResponsive(record.responsive, base)
  };
}

function normalizeCanvas(value: unknown): HomepageCanvasSettings {
  const record = asRecord(value);
  const deletedElementIds = asArray(record.deletedElementIds ?? record.deleted_element_ids)
    .slice(0, MAX_CANVAS_ELEMENTS)
    .map((elementId) => asString(elementId, '', 160))
    .filter(isDeletableHomepageCanvasElementId)
    .filter((elementId, index, all) => all.indexOf(elementId) === index);
  const deletedElementIdSet = new Set(deletedElementIds);
  const elementSource = Object.prototype.hasOwnProperty.call(record, 'elements')
    ? asRecord(record.elements)
    : record;
  const elements = Object.fromEntries(
    Object.entries(elementSource)
      .slice(0, MAX_CANVAS_ELEMENTS)
      .map(([rawElementId, element]) => [asString(rawElementId, '', 160), normalizeCanvasElement(element)] as const)
      .filter(([elementId]) => (
        Boolean(elementId)
        && !['__proto__', 'prototype', 'constructor', 'deletedElementIds', 'deleted_element_ids'].includes(elementId)
        && !deletedElementIdSet.has(elementId)
      ))
  );

  return { elements, deletedElementIds };
}

function normalizeSectionOrder(value: unknown, fillMissing = !Array.isArray(value)): HomepageSectionId[] {
  const requested = (Array.isArray(value) ? value : [])
    .map((entry) => enumValue(entry, HOMEPAGE_SECTION_IDS, null as never))
    .filter((entry): entry is HomepageSectionId => HOMEPAGE_SECTION_IDS.includes(entry))
    .filter((entry, index, all) => all.indexOf(entry) === index);

  if (fillMissing) {
    for (const sectionId of HOMEPAGE_SECTION_IDS) {
      if (!requested.includes(sectionId)) requested.push(sectionId);
    }
  }

  return requested;
}

function normalizeSectionTitles(value: unknown): HomepageSectionTitles {
  const record = asRecord(value);
  return HOMEPAGE_SECTION_IDS.reduce<HomepageSectionTitles>((titles, sectionId) => {
    const title = asString(record[sectionId], '', SECTION_TITLE_MAX_LENGTH);
    if (title && title !== homepageSectionLabels[sectionId]) titles[sectionId] = title;
    return titles;
  }, {});
}

function normalizeLegacyElementConfig(value: unknown): Partial<HomepageSettings> {
  const record = asRecord(value);
  const elements = asArray(record.elements).map(asRecord);
  if (elements.length === 0) return {};

  const heroElement = elements.find((element) => element.type === 'hero');
  const categoryElement = elements.find((element) => element.type === 'category_grid');
  const sectionOrder = elements
    .map((element) => element.type === 'hero' ? 'hero' : element.type === 'category_grid' ? 'categories' : null)
    .filter((sectionId): sectionId is 'hero' | 'categories' => sectionId === 'hero' || sectionId === 'categories');

  return {
    sectionOrder: normalizeSectionOrder(sectionOrder, true),
    hero: heroElement
      ? {
          ...DEFAULT_HOMEPAGE_SETTINGS.hero,
          visible: asBoolean(heroElement.enabled, true),
          title: asString(asRecord(heroElement.content).title, DEFAULT_HOMEPAGE_SETTINGS.hero.title, TITLE_MAX_LENGTH),
          description: asString(asRecord(heroElement.content).description, DEFAULT_HOMEPAGE_SETTINGS.hero.description, DESCRIPTION_MAX_LENGTH),
          primaryButton: normalizeButton(asRecord(heroElement.content).primaryButton, DEFAULT_HOMEPAGE_SETTINGS.hero.primaryButton),
          secondaryButton: normalizeButton(asRecord(heroElement.content).secondaryButton, DEFAULT_HOMEPAGE_SETTINGS.hero.secondaryButton)
        }
      : undefined,
    categories: categoryElement
      ? {
          ...DEFAULT_HOMEPAGE_SETTINGS.categories,
          visible: asBoolean(categoryElement.enabled, true)
        }
      : undefined
  };
}

export function normalizeLandingPageConfig(value: unknown): HomepageSettings {
  const record = asRecord(value);
  const legacy = normalizeLegacyElementConfig(value);

  return {
    sectionOrder: normalizeSectionOrder(record.sectionOrder ?? legacy.sectionOrder),
    sectionTitles: normalizeSectionTitles(record.sectionTitles),
    hero: normalizeHero(record.hero ?? legacy.hero),
    categories: normalizeCategories(record.categories ?? legacy.categories),
    infoBlocks: normalizeInfoBlocks(record.infoBlocks),
    footer: normalizeHomepageFooterSettings(record.footer),
    page: normalizePage(record.page),
    canvas: normalizeCanvas(record.canvas),
    updatedAt: asNullableString(record.updatedAt ?? record.updated_at, 80)
  };
}

export function cloneDefaultLandingPageConfig() {
  return clone(DEFAULT_HOMEPAGE_SETTINGS);
}

export function toStoredLandingPageConfig(config: unknown): HomepageSettings {
  const normalized = normalizeLandingPageConfig(config);
  return {
    sectionOrder: normalized.sectionOrder,
    sectionTitles: normalized.sectionTitles,
    hero: normalized.hero,
    categories: normalized.categories,
    infoBlocks: normalized.infoBlocks,
    footer: normalized.footer,
    page: normalized.page,
    canvas: normalized.canvas
  };
}

export function resolveHomepageCanvasElementDeviceSettings(
  settingsOrConfig: HomepageCanvasSettings | HomepageSettings | unknown,
  elementId: string,
  device: HomepagePreviewDevice
): HomepageCanvasElementDeviceSettings {
  const sourceRecord = asRecord(settingsOrConfig);
  const canvasInput = Object.prototype.hasOwnProperty.call(sourceRecord, 'canvas')
    ? sourceRecord.canvas
    : settingsOrConfig;
  const canvas = normalizeCanvas(canvasInput);
  const element = canvas.elements[elementId];

  return element
    ? clone(element.responsive[device])
    : clone(DEFAULT_HOMEPAGE_CANVAS_ELEMENT_DEVICE_SETTINGS);
}

export function resolveHomepageSettingsForDevice(config: unknown, device: HomepagePreviewDevice): HomepageSettings {
  const normalized = normalizeLandingPageConfig(config);
  const heroDevice = normalized.hero.responsive[device];
  const categoriesDevice = normalized.categories.responsive[device];
  const infoBlocksDevice = normalized.infoBlocks.responsive[device];
  const footerDevice = normalized.footer.responsive[device];
  const pageDevice = normalized.page.responsive[device];
  const canvasElements = Object.fromEntries(
    Object.entries(normalized.canvas.elements).map(([elementId, element]) => [
      elementId,
      {
        ...element,
        ...element.responsive[device]
      }
    ])
  );

  return {
    ...normalized,
    hero: { ...normalized.hero, ...heroDevice },
    categories: { ...normalized.categories, ...categoriesDevice },
    infoBlocks: { ...normalized.infoBlocks, ...infoBlocksDevice },
    footer: { ...normalized.footer, ...footerDevice },
    page: { ...normalized.page, ...pageDevice },
    canvas: {
      elements: canvasElements,
      deletedElementIds: normalized.canvas.deletedElementIds
    }
  };
}

function isValidUrl(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return true;
  if (trimmed.startsWith('#') || trimmed.startsWith('/')) return true;

  try {
    const parsed = new URL(trimmed);
    return ['http:', 'https:', 'mailto:', 'tel:'].includes(parsed.protocol);
  } catch {
    return false;
  }
}

function validateUrl(errors: string[], value: unknown, label: string, required = false) {
  const url = typeof value === 'string' ? value.trim() : '';
  if (required && !url) errors.push(`${label} manjka.`);
  if (url && !isValidUrl(url)) errors.push(`${label} ni veljaven.`);
}

function validateText(errors: string[], value: unknown, maxLength: number, label: string, required = false) {
  if (typeof value !== 'string') {
    if (required) errors.push(`${label} manjka.`);
    return;
  }
  if (required && !value.trim()) errors.push(`${label} manjka.`);
  if (value.length > maxLength) errors.push(`${label} je predolg.`);
}

function validateButton(errors: string[], value: unknown, label: string) {
  const record = asRecord(value);
  validateText(errors, record.label, BUTTON_LABEL_MAX_LENGTH, `${label} - oznaka`);
  validateUrl(errors, record.href ?? record.url, `${label} - povezava`);
  const hasLabel = typeof record.label === 'string' && record.label.trim();
  const hasHref = typeof (record.href ?? record.url) === 'string' && String(record.href ?? record.url).trim();
  if (hasLabel && !hasHref) errors.push(`${label} - povezava manjka.`);
}

function validateNumber(errors: string[], value: unknown, label: string, min: number, max: number) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric < min || numeric > max) {
    errors.push(`${label} mora biti med ${min} in ${max}.`);
  }
}

function validateEnum<T extends string>(errors: string[], value: unknown, options: readonly T[], label: string) {
  if (!options.includes(value as T)) errors.push(`${label} ni veljaven.`);
}

function validateCanvasElementDeviceSettingsInput(
  errors: string[],
  value: unknown,
  fallback: HomepageCanvasElementDeviceSettings,
  label: string
) {
  const record = asRecord(value);
  const padding = asRecord(record.padding);
  const margin = asRecord(record.margin);
  const uniformPadding = record.paddingPx;
  const uniformMargin = record.marginPx;

  validateNumber(errors, record.offsetXPx ?? record.xPx ?? record.x ?? fallback.offsetXPx, `${label} - odmik X`, -5000, 5000);
  validateNumber(errors, record.offsetYPx ?? record.yPx ?? record.y ?? fallback.offsetYPx, `${label} - odmik Y`, -5000, 5000);
  validateNumber(errors, record.widthPx ?? record.width ?? fallback.widthPx, `${label} - širina`, 0, 5000);
  validateNumber(errors, record.heightPx ?? record.height ?? fallback.heightPx, `${label} - višina`, 0, 5000);
  validateNumber(errors, record.paddingTopPx ?? padding.top ?? uniformPadding ?? fallback.paddingTopPx, `${label} - notranji odmik zgoraj`, 0, 1000);
  validateNumber(errors, record.paddingRightPx ?? padding.right ?? uniformPadding ?? fallback.paddingRightPx, `${label} - notranji odmik desno`, 0, 1000);
  validateNumber(errors, record.paddingBottomPx ?? padding.bottom ?? uniformPadding ?? fallback.paddingBottomPx, `${label} - notranji odmik spodaj`, 0, 1000);
  validateNumber(errors, record.paddingLeftPx ?? padding.left ?? uniformPadding ?? fallback.paddingLeftPx, `${label} - notranji odmik levo`, 0, 1000);
  validateNumber(errors, record.marginTopPx ?? margin.top ?? uniformMargin ?? fallback.marginTopPx, `${label} - zunanji odmik zgoraj`, -1000, 2000);
  validateNumber(errors, record.marginRightPx ?? margin.right ?? uniformMargin ?? fallback.marginRightPx, `${label} - zunanji odmik desno`, -1000, 2000);
  validateNumber(errors, record.marginBottomPx ?? margin.bottom ?? uniformMargin ?? fallback.marginBottomPx, `${label} - zunanji odmik spodaj`, -1000, 2000);
  validateNumber(errors, record.marginLeftPx ?? margin.left ?? uniformMargin ?? fallback.marginLeftPx, `${label} - zunanji odmik levo`, -1000, 2000);
  validateNumber(errors, record.zIndex ?? record.layerOrder ?? fallback.zIndex, `${label} - vrstni red plasti`, -100, 1000);
  validateEnum(errors, record.textAlign ?? fallback.textAlign, HOMEPAGE_ALIGNMENTS, `${label} - poravnava besedila`);
  validateEnum(errors, record.horizontalAlign ?? record.alignment ?? fallback.horizontalAlign, HOMEPAGE_ALIGNMENTS, `${label} - vodoravna poravnava`);
  validateText(errors, record.color ?? record.colour ?? fallback.color, COLOR_MAX_LENGTH, `${label} - barva`);
  validateText(errors, record.fontFamily ?? record.font ?? fallback.fontFamily, 120, `${label} - pisava`);
  validateNumber(errors, record.fontSizePx ?? record.fontSize ?? fallback.fontSizePx, `${label} - velikost pisave`, 8, 240);
  validateNumber(errors, record.lineHeight ?? fallback.lineHeight, `${label} - višina vrstice`, 0.5, 4);
  validateNumber(errors, record.letterSpacingPx ?? record.letterSpacing ?? fallback.letterSpacingPx, `${label} - razmik črk`, -20, 100);
  validateNumber(errors, record.fontWeight ?? record.weight ?? fallback.fontWeight, `${label} - debelina pisave`, 100, 900);
}

export function validateLandingPageConfigInput(input: unknown): string[] {
  const errors: string[] = [];
  const config = asRecord(input);
  const hero = asRecord(config.hero);
  const categories = asRecord(config.categories);
  const infoBlocks = asRecord(config.infoBlocks);
  const footer = asRecord(config.footer);
  const page = asRecord(config.page);
  const canvas = asRecord(config.canvas);
  const canvasElements = Object.prototype.hasOwnProperty.call(canvas, 'elements')
    ? asRecord(canvas.elements)
    : canvas;
  const deletedCanvasElementIds = canvas.deletedElementIds ?? canvas.deleted_element_ids;
  const sectionTitles = asRecord(config.sectionTitles);
  const normalized = normalizeLandingPageConfig(input);

  if (deletedCanvasElementIds !== undefined && !Array.isArray(deletedCanvasElementIds)) {
    errors.push('Seznam izbrisanih elementov platna ni veljaven.');
  } else if (Array.isArray(deletedCanvasElementIds)) {
    if (deletedCanvasElementIds.length > MAX_CANVAS_ELEMENTS) {
      errors.push(`Platno lahko vsebuje največ ${MAX_CANVAS_ELEMENTS} izbrisanih elementov.`);
    }
    deletedCanvasElementIds.slice(0, MAX_CANVAS_ELEMENTS).forEach((elementId, index) => {
      validateText(errors, elementId, 160, `Izbrisani element platna ${index + 1}`, true);
      if (typeof elementId === 'string' && !isDeletableHomepageCanvasElementId(elementId.trim())) {
        errors.push(`Izbrisani element platna ${index + 1} ni podprt.`);
      }
    });
  }

  for (const sectionId of HOMEPAGE_SECTION_IDS) {
    validateText(errors, sectionTitles[sectionId], SECTION_TITLE_MAX_LENGTH, `${homepageSectionLabels[sectionId]} - ime sekcije`);
  }

  validateText(errors, hero.title, TITLE_MAX_LENGTH, 'Hero naslov', true);
  validateText(errors, hero.description, DESCRIPTION_MAX_LENGTH, 'Hero opis');
  validateButton(errors, hero.primaryButton, 'Primarni gumb');
  validateButton(errors, hero.secondaryButton, 'Sekundarni gumb');
  validateEnum(errors, hero.backgroundType, HOMEPAGE_HERO_MEDIA_TYPES, 'Tip ozadja');
  validateNumber(errors, hero.autoplayInterval, 'Interval samodejnega predvajanja', 1500, 30000);
  validateNumber(errors, hero.overlayStrength, 'Zatemnitev ozadja', 0, 85);
  validateEnum(errors, hero.height, HOMEPAGE_HERO_HEIGHTS, 'Višina hero sekcije');
  validateEnum(errors, hero.contentAlign, HOMEPAGE_ALIGNMENTS, 'Poravnava vsebine');
  validateEnum(errors, hero.textWidth, HOMEPAGE_TEXT_WIDTHS, 'Širina besedila');
  validateNumber(errors, hero.heightPx ?? normalized.hero.heightPx, 'Višina hero sekcije v px', 280, 900);
  validateNumber(errors, hero.contentOffsetXPx ?? normalized.hero.contentOffsetXPx, 'Odmik hero besedila v px', 0, 1400);
  validateNumber(errors, hero.contentOffsetYPx ?? normalized.hero.contentOffsetYPx, 'Vertikalni odmik hero besedila v px', -450, 450);
  validateNumber(errors, hero.titleOffsetXPx ?? normalized.hero.titleOffsetXPx, 'Odmik hero naslova X v px', -1400, 1400);
  validateNumber(errors, hero.titleOffsetYPx ?? normalized.hero.titleOffsetYPx, 'Odmik hero naslova Y v px', -700, 700);
  validateNumber(errors, hero.descriptionOffsetXPx ?? normalized.hero.descriptionOffsetXPx, 'Odmik hero opisa X v px', -1400, 1400);
  validateNumber(errors, hero.descriptionOffsetYPx ?? normalized.hero.descriptionOffsetYPx, 'Odmik hero opisa Y v px', -700, 700);
  validateNumber(errors, hero.primaryButtonOffsetXPx ?? normalized.hero.primaryButtonOffsetXPx, 'Odmik primarnega gumba X v px', -1400, 1400);
  validateNumber(errors, hero.primaryButtonOffsetYPx ?? normalized.hero.primaryButtonOffsetYPx, 'Odmik primarnega gumba Y v px', -700, 700);
  validateNumber(errors, hero.secondaryButtonOffsetXPx ?? normalized.hero.secondaryButtonOffsetXPx, 'Odmik sekundarnega gumba X v px', -1400, 1400);
  validateNumber(errors, hero.secondaryButtonOffsetYPx ?? normalized.hero.secondaryButtonOffsetYPx, 'Odmik sekundarnega gumba Y v px', -700, 700);
  validateNumber(errors, hero.textWidthPx ?? normalized.hero.textWidthPx, 'Širina hero besedila v px', 260, 1200);
  validateNumber(errors, hero.mediaWidthPercent ?? normalized.hero.mediaWidthPercent, 'Širina hero medija v odstotkih', 50, 160);
  validateEnum(errors, hero.titleSize ?? normalized.hero.titleSize, HOMEPAGE_HERO_TITLE_SIZES, 'Velikost hero naslova');
  validateEnum(errors, hero.titleWeight ?? normalized.hero.titleWeight, HOMEPAGE_HERO_TITLE_WEIGHTS, 'Debelina hero naslova');
  validateEnum(errors, hero.titleTransform ?? normalized.hero.titleTransform, HOMEPAGE_HERO_TITLE_TRANSFORMS, 'Slog hero naslova');
  validateEnum(errors, hero.descriptionSize ?? normalized.hero.descriptionSize, HOMEPAGE_HERO_DESCRIPTION_SIZES, 'Velikost hero opisa');
  validateEnum(errors, hero.titleFontFamily ?? normalized.hero.titleFontFamily, HOMEPAGE_HERO_FONT_FAMILIES, 'Pisava hero naslova');
  validateNumber(errors, hero.titleFontSizePx ?? normalized.hero.titleFontSizePx, 'Velikost hero naslova v px', 24, 120);
  validateText(errors, hero.titleHighlightColor ?? normalized.hero.titleHighlightColor, COLOR_MAX_LENGTH, 'Barva poudarka hero naslova');
  validateEnum(errors, hero.descriptionFontFamily ?? normalized.hero.descriptionFontFamily, HOMEPAGE_HERO_FONT_FAMILIES, 'Pisava hero opisa');
  validateNumber(errors, hero.descriptionFontSizePx ?? normalized.hero.descriptionFontSizePx, 'Velikost hero opisa v px', 11, 40);
  validateText(errors, hero.descriptionHighlightColor ?? normalized.hero.descriptionHighlightColor, COLOR_MAX_LENGTH, 'Barva poudarka hero opisa');
  asArray(hero.slides).forEach((slide, index) => {
    const record = asRecord(slide);
    validateEnum(errors, record.type, HOMEPAGE_HERO_MEDIA_TYPES, `Diapozitiv ${index + 1} - tip`);
    validateText(errors, record.src, URL_MAX_LENGTH, `Diapozitiv ${index + 1} - medij`, index === 0);
    validateUrl(errors, record.src, `Diapozitiv ${index + 1} - medij`, index === 0);
    validateText(errors, record.alt, SHORT_TEXT_MAX_LENGTH, `Diapozitiv ${index + 1} - alt`);
    validateText(errors, record.title, SHORT_TEXT_MAX_LENGTH, `Diapozitiv ${index + 1} - naslov`);
  });
  asArray(hero.textBlocks).forEach((block, index) => {
    const record = asRecord(block);
    validateEnum(errors, record.kind ?? normalized.hero.textBlocks[index]?.kind ?? 'text', HOMEPAGE_HERO_FREEFORM_KINDS, `Hero besedilo ${index + 1} - vrsta`);
    validateText(errors, record.text, DESCRIPTION_MAX_LENGTH, `Hero besedilo ${index + 1}`, true);
    validateUrl(errors, record.href, `Hero besedilo ${index + 1} - povezava`);
    validateNumber(errors, record.xPx ?? normalized.hero.textBlocks[index]?.xPx ?? defaultHeroTextBlockDeviceSettings.xPx, `Hero besedilo ${index + 1} - X`, -1400, 1400);
    validateNumber(errors, record.yPx ?? normalized.hero.textBlocks[index]?.yPx ?? defaultHeroTextBlockDeviceSettings.yPx, `Hero besedilo ${index + 1} - Y`, -700, 900);
    validateNumber(errors, record.widthPx ?? normalized.hero.textBlocks[index]?.widthPx ?? defaultHeroTextBlockDeviceSettings.widthPx, `Hero besedilo ${index + 1} - sirina`, 120, 1200);
    validateEnum(errors, record.fontFamily ?? normalized.hero.textBlocks[index]?.fontFamily, HOMEPAGE_HERO_FONT_FAMILIES, `Hero besedilo ${index + 1} - pisava`);
    validateNumber(errors, record.fontSizePx ?? normalized.hero.textBlocks[index]?.fontSizePx ?? defaultHeroTextBlockDeviceSettings.fontSizePx, `Hero besedilo ${index + 1} - velikost`, 11, 120);
  });

  validateText(errors, categories.title, TITLE_MAX_LENGTH, 'Naslov kategorij');
  validateText(errors, categories.subtitle, DESCRIPTION_MAX_LENGTH, 'Podnaslov kategorij');
  validateText(errors, categories.showAllLabel, SHORT_TEXT_MAX_LENGTH, 'Besedilo povezave za vse kategorije');
  validateUrl(errors, categories.showAllHref, 'Povezava za vse kategorije');
  validateNumber(errors, categories.limit, 'Število kategorij', 1, 24);
  validateNumber(errors, categories.columns, 'Število stolpcev kategorij', 1, 6);
  validateNumber(errors, categories.gap, 'Razmik kategorij', 0, 48);
  validateEnum(errors, categories.containerWidth, HOMEPAGE_CONTAINER_WIDTHS, 'Širina kategorij');
  validateEnum(errors, categories.cardSize, HOMEPAGE_CATEGORY_CARD_SIZES, 'Velikost kartic');
  validateEnum(errors, categories.cardStyle, HOMEPAGE_CATEGORY_CARD_STYLES, 'Slog kartic');
  validateEnum(
    errors,
    categories.categoryOrderMode ?? normalized.categories.categoryOrderMode,
    HOMEPAGE_CATEGORY_ORDER_MODES,
    'Vrstni red kategorij'
  );

  validateNumber(errors, infoBlocks.columns, 'Število stolpcev elementov', 1, 6);
  validateNumber(errors, infoBlocks.gap, 'Razmik elementov', 0, 48);
  validateEnum(errors, infoBlocks.alignment, ['left', 'center'] as const, 'Poravnava elementov');
  validateEnum(errors, infoBlocks.style, HOMEPAGE_INFO_STYLES, 'Slog elementov');
  validateEnum(errors, infoBlocks.iconPosition, HOMEPAGE_INFO_ICON_POSITIONS, 'Pozicija ikon');
  asArray(infoBlocks.items).forEach((item, index) => {
    const record = asRecord(item);
    validateEnum(errors, record.icon, HOMEPAGE_INFO_ICONS, `Element ${index + 1} - ikona`);
    validateText(errors, record.title, TITLE_MAX_LENGTH, `Element ${index + 1} - naslov`, true);
    validateText(errors, record.description, DESCRIPTION_MAX_LENGTH, `Element ${index + 1} - opis`);
    validateUrl(errors, record.href, `Element ${index + 1} - povezava`);
  });

  validateEnum(errors, footer.logoMode, HOMEPAGE_FOOTER_LOGO_MODES, 'Logotip v nogi');
  validateText(errors, footer.logoText, SHORT_TEXT_MAX_LENGTH, 'Besedilo logotipa');
  validateText(errors, footer.description, DESCRIPTION_MAX_LENGTH, 'Opis noge');
  validateEnum(errors, footer.spacing, HOMEPAGE_FOOTER_SPACINGS, 'Odmik noge');
  asArray(footer.columns).forEach((column, columnIndex) => {
    const columnRecord = asRecord(column);
    validateText(errors, columnRecord.title, SHORT_TEXT_MAX_LENGTH, `Stolpec ${columnIndex + 1} - naslov`, true);
    asArray(columnRecord.links).forEach((link, linkIndex) => {
      const linkRecord = asRecord(link);
      validateText(errors, linkRecord.label, SHORT_TEXT_MAX_LENGTH, `Stolpec ${columnIndex + 1}, povezava ${linkIndex + 1} - oznaka`, true);
      validateUrl(errors, linkRecord.href, `Stolpec ${columnIndex + 1}, povezava ${linkIndex + 1} - URL`, true);
    });
  });
  asArray(footer.socialLinks).forEach((link, index) => {
    const linkRecord = asRecord(link);
    validateEnum(errors, linkRecord.type, HOMEPAGE_SOCIAL_TYPES, `Družbena povezava ${index + 1} - tip`);
    validateText(errors, linkRecord.label, SHORT_TEXT_MAX_LENGTH, `Družbena povezava ${index + 1} - oznaka`, true);
    validateUrl(errors, linkRecord.href, `Družbena povezava ${index + 1} - URL`);
  });
  asArray(footer.legalLinks).forEach((link, index) => {
    const linkRecord = asRecord(link);
    validateText(errors, linkRecord.label, SHORT_TEXT_MAX_LENGTH, `Pravna povezava ${index + 1} - oznaka`, true);
    validateUrl(errors, linkRecord.href, `Pravna povezava ${index + 1} - URL`, true);
  });

  validateEnum(errors, page.containerWidth, HOMEPAGE_CONTAINER_WIDTHS, 'Širina strani');
  validateEnum(errors, page.sectionSpacing, HOMEPAGE_SECTION_SPACINGS, 'Razmik sekcij');
  validateEnum(errors, page.sectionRadius, HOMEPAGE_SECTION_RADII, 'Zaobljenost sekcij');
  validateEnum(errors, page.buttonStyle, HOMEPAGE_BUTTON_STYLES, 'Slog gumbov');

  Object.entries(canvasElements).slice(0, MAX_CANVAS_ELEMENTS).forEach(([elementId, elementValue]) => {
    const element = asRecord(elementValue);
    const normalizedElement = normalized.canvas.elements[elementId] ?? normalizeCanvasElement(elementValue);
    validateText(errors, elementId, 160, `Element platna ${elementId} - ID`, true);
    validateCanvasElementDeviceSettingsInput(errors, element, normalizedElement, `Element platna ${elementId}`);

    const responsive = asRecord(element.responsive);
    HOMEPAGE_PREVIEW_DEVICES.forEach((device) => {
      validateCanvasElementDeviceSettingsInput(
        errors,
        responsive[device],
        normalizedElement.responsive[device],
        `Element platna ${elementId} - ${homepagePreviewDeviceLabels[device]}`
      );
    });
  });

  return errors;
}
