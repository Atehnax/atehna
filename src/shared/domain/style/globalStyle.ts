import { GLOBAL_WEBSITE_FONT_FAMILIES, resolveWebsiteFontStack } from './fontFamilies';

export const GLOBAL_STYLE_SETTINGS_KEY = 'website-global-style';

export const GLOBAL_STYLE_FONT_FAMILIES = GLOBAL_WEBSITE_FONT_FAMILIES;
export const GLOBAL_STYLE_BUTTON_APPEARANCES = ['filled', 'outline', 'soft'] as const;
export const GLOBAL_STYLE_FORM_APPEARANCES = ['outline', 'filled'] as const;
export const GLOBAL_STYLE_CARD_APPEARANCES = ['bordered', 'elevated', 'flat'] as const;
export const GLOBAL_STYLE_SHADOW_SIZES = ['none', 'small', 'medium', 'large'] as const;
export const GLOBAL_STYLE_LINK_UNDERLINES = ['never', 'hover', 'always'] as const;

export type GlobalStyleFontFamily = (typeof GLOBAL_STYLE_FONT_FAMILIES)[number];
export type GlobalStyleButtonAppearance = (typeof GLOBAL_STYLE_BUTTON_APPEARANCES)[number];
export type GlobalStyleFormAppearance = (typeof GLOBAL_STYLE_FORM_APPEARANCES)[number];
export type GlobalStyleCardAppearance = (typeof GLOBAL_STYLE_CARD_APPEARANCES)[number];
export type GlobalStyleShadowSize = (typeof GLOBAL_STYLE_SHADOW_SIZES)[number];
export type GlobalStyleLinkUnderline = (typeof GLOBAL_STYLE_LINK_UNDERLINES)[number];

export type GlobalStyleConfig = {
  layout: {
    contentWidthPx: number;
    maxWidthPx: number;
    gutterMobilePx: number;
    gutterTabletPx: number;
    gutterDesktopPx: number;
  };
  radii: {
    smallPx: number;
    mediumPx: number;
    largePx: number;
    pillPx: number;
  };
  colors: {
    pageBackground: string;
    surface: string;
    surfaceMuted: string;
    text: string;
    textMuted: string;
    primary: string;
    primaryHover: string;
    primaryActive: string;
    primaryForeground: string;
    accent: string;
    success: string;
    warning: string;
    danger: string;
    info: string;
  };
  typography: {
    bodyFontFamily: GlobalStyleFontFamily;
    bodySizePx: number;
    bodyWeight: number;
    bodyLineHeight: number;
    headingFontFamily: GlobalStyleFontFamily;
    headingWeight: number;
    headingLineHeight: number;
    h1SizePx: number;
    h2SizePx: number;
    h3SizePx: number;
    paragraphSizePx: number;
    paragraphLineHeight: number;
  };
  spacing: {
    xsPx: number;
    smPx: number;
    mdPx: number;
    lgPx: number;
    xlPx: number;
    sectionDesktopPx: number;
    sectionTabletPx: number;
    sectionMobilePx: number;
  };
  buttons: {
    appearance: GlobalStyleButtonAppearance;
    heightPx: number;
    paddingXPx: number;
    radiusPx: number;
    fontSizePx: number;
    fontWeight: number;
    borderWidthPx: number;
    shadow: GlobalStyleShadowSize;
    disabledOpacityPercent: number;
  };
  forms: {
    appearance: GlobalStyleFormAppearance;
    heightPx: number;
    paddingXPx: number;
    radiusPx: number;
    fontSizePx: number;
    borderWidthPx: number;
    background: string;
    placeholder: string;
    focusColor: string;
  };
  cards: {
    appearance: GlobalStyleCardAppearance;
    radiusPx: number;
    paddingPx: number;
    borderWidthPx: number;
    background: string;
    shadow: GlobalStyleShadowSize;
  };
  borders: {
    color: string;
    dividerColor: string;
    widthPx: number;
  };
  shadows: {
    color: string;
    opacityPercent: number;
    smallBlurPx: number;
    mediumBlurPx: number;
    largeBlurPx: number;
    smallYPx: number;
    mediumYPx: number;
    largeYPx: number;
  };
  links: {
    color: string;
    hoverColor: string;
    activeColor: string;
    fontWeight: number;
    underline: GlobalStyleLinkUnderline;
  };
  breakpoints: {
    mobileMaxPx: number;
    tabletMaxPx: number;
    wideMinPx: number;
  };
  updatedAt?: string | null;
};

export const DEFAULT_GLOBAL_STYLE_CONFIG: GlobalStyleConfig = {
  layout: {
    contentWidthPx: 760,
    maxWidthPx: 1500,
    gutterMobilePx: 16,
    gutterTabletPx: 24,
    gutterDesktopPx: 32
  },
  radii: { smallPx: 6, mediumPx: 10, largePx: 16, pillPx: 999 },
  colors: {
    pageBackground: '#F8FAFC',
    surface: '#FFFFFF',
    surfaceMuted: '#F1F5F9',
    text: '#0F172A',
    textMuted: '#64748B',
    primary: '#0788CF',
    primaryHover: '#067BBB',
    primaryActive: '#056CA5',
    primaryForeground: '#FFFFFF',
    accent: '#94633F',
    success: '#079669',
    warning: '#A16207',
    danger: '#A24A45',
    info: '#0788CF'
  },
  typography: {
    bodyFontFamily: 'Noto Sans',
    bodySizePx: 16,
    bodyWeight: 400,
    bodyLineHeight: 1.6,
    headingFontFamily: 'Noto Sans',
    headingWeight: 600,
    headingLineHeight: 1.15,
    h1SizePx: 40,
    h2SizePx: 30,
    h3SizePx: 22,
    paragraphSizePx: 16,
    paragraphLineHeight: 1.65
  },
  spacing: {
    xsPx: 4,
    smPx: 8,
    mdPx: 16,
    lgPx: 24,
    xlPx: 40,
    sectionDesktopPx: 64,
    sectionTabletPx: 48,
    sectionMobilePx: 32
  },
  buttons: {
    appearance: 'filled',
    heightPx: 44,
    paddingXPx: 20,
    radiusPx: 8,
    fontSizePx: 15,
    fontWeight: 600,
    borderWidthPx: 1,
    shadow: 'none',
    disabledOpacityPercent: 48
  },
  forms: {
    appearance: 'outline',
    heightPx: 56,
    paddingXPx: 12,
    radiusPx: 8,
    fontSizePx: 14,
    borderWidthPx: 1,
    background: '#FFFFFF',
    placeholder: '#94A3B8',
    focusColor: '#0788CF'
  },
  cards: {
    appearance: 'bordered',
    radiusPx: 16,
    paddingPx: 24,
    borderWidthPx: 1,
    background: '#FFFFFF',
    shadow: 'small'
  },
  borders: { color: '#D7DDE3', dividerColor: '#E5E7EB', widthPx: 1 },
  shadows: {
    color: '#0F172A',
    opacityPercent: 10,
    smallBlurPx: 12,
    mediumBlurPx: 28,
    largeBlurPx: 54,
    smallYPx: 3,
    mediumYPx: 10,
    largeYPx: 22
  },
  links: {
    color: '#1982BF',
    hoverColor: '#1675AC',
    activeColor: '#126491',
    fontWeight: 600,
    underline: 'hover'
  },
  breakpoints: { mobileMaxPx: 767, tabletMaxPx: 1024, wideMinPx: 1440 },
  updatedAt: null
};

type RecordValue = Record<string, unknown>;
type CssVariables = Record<`--${string}`, string>;

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
const asRecord = (value: unknown): RecordValue => value && typeof value === 'object' && !Array.isArray(value) ? value as RecordValue : {};
const asString = (value: unknown, fallback: string) => typeof value === 'string' && value.trim() ? value.trim() : fallback;
const asNumber = (value: unknown, fallback: number, min: number, max: number, step = 1) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  const stepped = Math.round(numeric / step) * step;
  return Math.min(max, Math.max(min, stepped));
};
const asEnum = <T extends string>(value: unknown, values: readonly T[], fallback: T): T => values.includes(value as T) ? value as T : fallback;
const asColor = (value: unknown, fallback: string) => {
  const color = asString(value, fallback).toUpperCase();
  return /^#[0-9A-F]{6}$/.test(color) ? color : fallback;
};

export function cloneDefaultGlobalStyleConfig() {
  return clone(DEFAULT_GLOBAL_STYLE_CONFIG);
}

export function normalizeGlobalStyleConfig(value: unknown): GlobalStyleConfig {
  const record = asRecord(value);
  const layout = asRecord(record.layout);
  const radii = asRecord(record.radii);
  const colors = asRecord(record.colors);
  const typography = asRecord(record.typography);
  const spacing = asRecord(record.spacing);
  const buttons = asRecord(record.buttons);
  const forms = asRecord(record.forms);
  const cards = asRecord(record.cards);
  const borders = asRecord(record.borders);
  const shadows = asRecord(record.shadows);
  const links = asRecord(record.links);
  const breakpoints = asRecord(record.breakpoints);
  const defaults = DEFAULT_GLOBAL_STYLE_CONFIG;
  const upgradeLegacyDefaultColor = (
    rawValue: unknown,
    legacyDefault: string,
    nextDefault: string
  ) =>
    typeof rawValue === 'string' &&
    rawValue.trim().toUpperCase() === legacyDefault.toUpperCase()
      ? nextDefault
      : rawValue;
  const mobileMaxPx = asNumber(breakpoints.mobileMaxPx, defaults.breakpoints.mobileMaxPx, 480, 900);
  const tabletMaxPx = asNumber(breakpoints.tabletMaxPx, defaults.breakpoints.tabletMaxPx, mobileMaxPx + 1, 1600);

  return {
    layout: {
      contentWidthPx: asNumber(layout.contentWidthPx, defaults.layout.contentWidthPx, 480, 1200),
      maxWidthPx: asNumber(layout.maxWidthPx, defaults.layout.maxWidthPx, 960, 1920),
      gutterMobilePx: asNumber(layout.gutterMobilePx, defaults.layout.gutterMobilePx, 0, 48),
      gutterTabletPx: asNumber(layout.gutterTabletPx, defaults.layout.gutterTabletPx, 0, 72),
      gutterDesktopPx: asNumber(layout.gutterDesktopPx, defaults.layout.gutterDesktopPx, 0, 96)
    },
    radii: {
      smallPx: asNumber(radii.smallPx, defaults.radii.smallPx, 0, 32),
      mediumPx: asNumber(radii.mediumPx, defaults.radii.mediumPx, 0, 48),
      largePx: asNumber(radii.largePx, defaults.radii.largePx, 0, 72),
      pillPx: asNumber(radii.pillPx, defaults.radii.pillPx, 24, 999)
    },
    colors: {
      pageBackground: asColor(
        upgradeLegacyDefaultColor(colors.pageBackground, '#FAFBFC', defaults.colors.pageBackground),
        defaults.colors.pageBackground
      ),
      surface: asColor(colors.surface, defaults.colors.surface),
      surfaceMuted: asColor(colors.surfaceMuted, defaults.colors.surfaceMuted),
      text: asColor(
        upgradeLegacyDefaultColor(colors.text, '#111827', defaults.colors.text),
        defaults.colors.text
      ),
      textMuted: asColor(
        upgradeLegacyDefaultColor(colors.textMuted, '#4B5563', defaults.colors.textMuted),
        defaults.colors.textMuted
      ),
      primary: asColor(
        upgradeLegacyDefaultColor(colors.primary, '#1982BF', defaults.colors.primary),
        defaults.colors.primary
      ),
      primaryHover: asColor(
        upgradeLegacyDefaultColor(colors.primaryHover, '#1675AC', defaults.colors.primaryHover),
        defaults.colors.primaryHover
      ),
      primaryActive: asColor(
        upgradeLegacyDefaultColor(colors.primaryActive, '#126491', defaults.colors.primaryActive),
        defaults.colors.primaryActive
      ),
      primaryForeground: asColor(colors.primaryForeground, defaults.colors.primaryForeground),
      accent: asColor(
        upgradeLegacyDefaultColor(colors.accent, '#B08968', defaults.colors.accent),
        defaults.colors.accent
      ),
      success: asColor(
        upgradeLegacyDefaultColor(colors.success, '#059669', defaults.colors.success),
        defaults.colors.success
      ),
      warning: asColor(colors.warning, defaults.colors.warning),
      danger: asColor(colors.danger, defaults.colors.danger),
      info: asColor(
        upgradeLegacyDefaultColor(colors.info, '#1982BF', defaults.colors.info),
        defaults.colors.info
      )
    },
    typography: {
      bodyFontFamily: asEnum(typography.bodyFontFamily, GLOBAL_STYLE_FONT_FAMILIES, defaults.typography.bodyFontFamily),
      bodySizePx: asNumber(typography.bodySizePx, defaults.typography.bodySizePx, 12, 24),
      bodyWeight: asNumber(typography.bodyWeight, defaults.typography.bodyWeight, 300, 800, 100),
      bodyLineHeight: asNumber(typography.bodyLineHeight, defaults.typography.bodyLineHeight, 1, 2.2, 0.05),
      headingFontFamily: asEnum(typography.headingFontFamily, GLOBAL_STYLE_FONT_FAMILIES, defaults.typography.headingFontFamily),
      headingWeight: asNumber(typography.headingWeight, defaults.typography.headingWeight, 300, 900, 100),
      headingLineHeight: asNumber(typography.headingLineHeight, defaults.typography.headingLineHeight, 0.9, 1.8, 0.05),
      h1SizePx: asNumber(typography.h1SizePx, defaults.typography.h1SizePx, 24, 72),
      h2SizePx: asNumber(typography.h2SizePx, defaults.typography.h2SizePx, 20, 56),
      h3SizePx: asNumber(typography.h3SizePx, defaults.typography.h3SizePx, 16, 40),
      paragraphSizePx: asNumber(typography.paragraphSizePx, defaults.typography.paragraphSizePx, 12, 24),
      paragraphLineHeight: asNumber(typography.paragraphLineHeight, defaults.typography.paragraphLineHeight, 1, 2.2, 0.05)
    },
    spacing: {
      xsPx: asNumber(spacing.xsPx, defaults.spacing.xsPx, 0, 16),
      smPx: asNumber(spacing.smPx, defaults.spacing.smPx, 2, 32),
      mdPx: asNumber(spacing.mdPx, defaults.spacing.mdPx, 4, 48),
      lgPx: asNumber(spacing.lgPx, defaults.spacing.lgPx, 8, 72),
      xlPx: asNumber(spacing.xlPx, defaults.spacing.xlPx, 12, 120),
      sectionDesktopPx: asNumber(spacing.sectionDesktopPx, defaults.spacing.sectionDesktopPx, 0, 160),
      sectionTabletPx: asNumber(spacing.sectionTabletPx, defaults.spacing.sectionTabletPx, 0, 140),
      sectionMobilePx: asNumber(spacing.sectionMobilePx, defaults.spacing.sectionMobilePx, 0, 120)
    },
    buttons: {
      appearance: asEnum(buttons.appearance, GLOBAL_STYLE_BUTTON_APPEARANCES, defaults.buttons.appearance),
      heightPx: asNumber(buttons.heightPx, defaults.buttons.heightPx, 28, 72),
      paddingXPx: asNumber(buttons.paddingXPx, defaults.buttons.paddingXPx, 8, 48),
      radiusPx: asNumber(buttons.radiusPx, defaults.buttons.radiusPx, 0, 36),
      fontSizePx: asNumber(buttons.fontSizePx, defaults.buttons.fontSizePx, 11, 22),
      fontWeight: asNumber(buttons.fontWeight, defaults.buttons.fontWeight, 300, 800, 100),
      borderWidthPx: asNumber(buttons.borderWidthPx, defaults.buttons.borderWidthPx, 0, 4),
      shadow: asEnum(buttons.shadow, GLOBAL_STYLE_SHADOW_SIZES, defaults.buttons.shadow),
      disabledOpacityPercent: asNumber(buttons.disabledOpacityPercent, defaults.buttons.disabledOpacityPercent, 10, 100)
    },
    forms: {
      appearance: asEnum(forms.appearance, GLOBAL_STYLE_FORM_APPEARANCES, defaults.forms.appearance),
      heightPx: asNumber(forms.heightPx, defaults.forms.heightPx, 32, 72),
      paddingXPx: asNumber(forms.paddingXPx, defaults.forms.paddingXPx, 6, 32),
      radiusPx: asNumber(forms.radiusPx, defaults.forms.radiusPx, 0, 32),
      fontSizePx: asNumber(forms.fontSizePx, defaults.forms.fontSizePx, 11, 22),
      borderWidthPx: asNumber(forms.borderWidthPx, defaults.forms.borderWidthPx, 0, 4),
      background: asColor(forms.background, defaults.forms.background),
      placeholder: asColor(forms.placeholder, defaults.forms.placeholder),
      focusColor: asColor(
        upgradeLegacyDefaultColor(forms.focusColor, '#1982BF', defaults.forms.focusColor),
        defaults.forms.focusColor
      )
    },
    cards: {
      appearance: asEnum(cards.appearance, GLOBAL_STYLE_CARD_APPEARANCES, defaults.cards.appearance),
      radiusPx: asNumber(cards.radiusPx, defaults.cards.radiusPx, 0, 48),
      paddingPx: asNumber(cards.paddingPx, defaults.cards.paddingPx, 0, 64),
      borderWidthPx: asNumber(cards.borderWidthPx, defaults.cards.borderWidthPx, 0, 4),
      background: asColor(cards.background, defaults.cards.background),
      shadow: asEnum(cards.shadow, GLOBAL_STYLE_SHADOW_SIZES, defaults.cards.shadow)
    },
    borders: {
      color: asColor(
        upgradeLegacyDefaultColor(borders.color, '#D8D6CF', defaults.borders.color),
        defaults.borders.color
      ),
      dividerColor: asColor(borders.dividerColor, defaults.borders.dividerColor),
      widthPx: asNumber(borders.widthPx, defaults.borders.widthPx, 0, 4)
    },
    shadows: {
      color: asColor(shadows.color, defaults.shadows.color),
      opacityPercent: asNumber(shadows.opacityPercent, defaults.shadows.opacityPercent, 0, 40),
      smallBlurPx: asNumber(shadows.smallBlurPx, defaults.shadows.smallBlurPx, 0, 40),
      mediumBlurPx: asNumber(shadows.mediumBlurPx, defaults.shadows.mediumBlurPx, 0, 80),
      largeBlurPx: asNumber(shadows.largeBlurPx, defaults.shadows.largeBlurPx, 0, 140),
      smallYPx: asNumber(shadows.smallYPx, defaults.shadows.smallYPx, 0, 24),
      mediumYPx: asNumber(shadows.mediumYPx, defaults.shadows.mediumYPx, 0, 48),
      largeYPx: asNumber(shadows.largeYPx, defaults.shadows.largeYPx, 0, 80)
    },
    links: {
      color: asColor(
        upgradeLegacyDefaultColor(links.color, '#1982BF', defaults.links.color),
        defaults.links.color
      ),
      hoverColor: asColor(
        upgradeLegacyDefaultColor(links.hoverColor, '#1675AC', defaults.links.hoverColor),
        defaults.links.hoverColor
      ),
      activeColor: asColor(
        upgradeLegacyDefaultColor(links.activeColor, '#126491', defaults.links.activeColor),
        defaults.links.activeColor
      ),
      fontWeight: asNumber(links.fontWeight, defaults.links.fontWeight, 300, 800, 100),
      underline: asEnum(links.underline, GLOBAL_STYLE_LINK_UNDERLINES, defaults.links.underline)
    },
    breakpoints: {
      mobileMaxPx,
      tabletMaxPx,
      wideMinPx: asNumber(breakpoints.wideMinPx, defaults.breakpoints.wideMinPx, tabletMaxPx + 1, 2560)
    },
    updatedAt: typeof record.updatedAt === 'string' ? record.updatedAt : typeof record.updated_at === 'string' ? record.updated_at : null
  };
}

export function toStoredGlobalStyleConfig(value: unknown): GlobalStyleConfig {
  const normalized = normalizeGlobalStyleConfig(value);
  const { updatedAt: _updatedAt, ...stored } = normalized;
  return stored;
}

export function validateGlobalStyleConfigInput(value: unknown): string[] {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return ['Nastavitve globalnih parametrov niso veljavne.'];
  const record = asRecord(value);
  const errors: string[] = [];
  const requiredGroups = Object.entries(DEFAULT_GLOBAL_STYLE_CONFIG)
    .filter(([group]) => group !== 'updatedAt') as Array<[string, Record<string, unknown>]>;

  for (const [groupName, defaults] of requiredGroups) {
    const rawGroup = record[groupName];
    if (!rawGroup || typeof rawGroup !== 'object' || Array.isArray(rawGroup)) {
      errors.push(`Skupina ${groupName} manjka.`);
      continue;
    }
    const group = rawGroup as RecordValue;
    for (const [fieldName, defaultValue] of Object.entries(defaults)) {
      const fieldValue = group[fieldName];
      if (fieldValue === undefined || fieldValue === null) {
        errors.push(`Polje ${groupName}.${fieldName} manjka.`);
      } else if (typeof defaultValue === 'number' && !Number.isFinite(Number(fieldValue))) {
        errors.push(`Polje ${groupName}.${fieldName} mora biti število.`);
      } else if (typeof defaultValue === 'string' && typeof fieldValue !== 'string') {
        errors.push(`Polje ${groupName}.${fieldName} mora biti besedilo.`);
      }
    }
  }

  const typography = asRecord(record.typography);
  const buttons = asRecord(record.buttons);
  const forms = asRecord(record.forms);
  const cards = asRecord(record.cards);
  const links = asRecord(record.links);
  if (typography.bodyFontFamily !== undefined && !GLOBAL_STYLE_FONT_FAMILIES.includes(typography.bodyFontFamily as GlobalStyleFontFamily)) errors.push('Osnovna pisava ni veljavna.');
  if (typography.headingFontFamily !== undefined && !GLOBAL_STYLE_FONT_FAMILIES.includes(typography.headingFontFamily as GlobalStyleFontFamily)) errors.push('Pisava naslovov ni veljavna.');
  if (buttons.appearance !== undefined && !GLOBAL_STYLE_BUTTON_APPEARANCES.includes(buttons.appearance as GlobalStyleButtonAppearance)) errors.push('Videz gumbov ni veljaven.');
  if (buttons.shadow !== undefined && !GLOBAL_STYLE_SHADOW_SIZES.includes(buttons.shadow as GlobalStyleShadowSize)) errors.push('Senca gumbov ni veljavna.');
  if (forms.appearance !== undefined && !GLOBAL_STYLE_FORM_APPEARANCES.includes(forms.appearance as GlobalStyleFormAppearance)) errors.push('Videz obrazcev ni veljaven.');
  if (cards.appearance !== undefined && !GLOBAL_STYLE_CARD_APPEARANCES.includes(cards.appearance as GlobalStyleCardAppearance)) errors.push('Videz kartic ni veljaven.');
  if (cards.shadow !== undefined && !GLOBAL_STYLE_SHADOW_SIZES.includes(cards.shadow as GlobalStyleShadowSize)) errors.push('Senca kartic ni veljavna.');
  if (links.underline !== undefined && !GLOBAL_STYLE_LINK_UNDERLINES.includes(links.underline as GlobalStyleLinkUnderline)) errors.push('Slog povezav ni veljaven.');
  const colorFields: Array<[RecordValue, string[]]> = [
    [asRecord(record.colors), Object.keys(DEFAULT_GLOBAL_STYLE_CONFIG.colors)],
    [asRecord(record.forms), ['background', 'placeholder', 'focusColor']],
    [asRecord(record.cards), ['background']],
    [asRecord(record.borders), ['color', 'dividerColor']],
    [asRecord(record.shadows), ['color']],
    [asRecord(record.links), ['color', 'hoverColor', 'activeColor']]
  ];
  for (const [group, fields] of colorFields) {
    for (const key of fields) {
      const entry = group[key];
      if (entry !== undefined && (typeof entry !== 'string' || !/^#[0-9a-f]{6}$/i.test(entry))) {
        errors.push(`Barva ${key} ni veljavna.`);
      }
    }
  }
  const breakpoints = asRecord(record.breakpoints);
  const mobile = Number(breakpoints.mobileMaxPx);
  const tablet = Number(breakpoints.tabletMaxPx);
  const wide = Number(breakpoints.wideMinPx);
  if ([mobile, tablet, wide].every(Number.isFinite) && !(mobile < tablet && tablet < wide)) {
    errors.push('Prelomne širine morajo naraščati od mobilne do široke postavitve.');
  }
  return errors;
}

const hexToRgb = (hex: string) => {
  const value = hex.replace('#', '');
  return [Number.parseInt(value.slice(0, 2), 16), Number.parseInt(value.slice(2, 4), 16), Number.parseInt(value.slice(4, 6), 16)];
};

export function toGlobalStyleCssVariables(value: unknown, dimensionScale = 1): CssVariables {
  const config = normalizeGlobalStyleConfig(value);
  const px = (number: number) => `${Math.round(number * dimensionScale * 100) / 100}px`;
  const [shadowR, shadowG, shadowB] = hexToRgb(config.shadows.color);
  const shadowColor = `rgba(${shadowR}, ${shadowG}, ${shadowB}, ${config.shadows.opacityPercent / 100})`;
  const shadows = {
    none: 'none',
    small: `0 ${px(config.shadows.smallYPx)} ${px(config.shadows.smallBlurPx)} ${shadowColor}`,
    medium: `0 ${px(config.shadows.mediumYPx)} ${px(config.shadows.mediumBlurPx)} ${shadowColor}`,
    large: `0 ${px(config.shadows.largeYPx)} ${px(config.shadows.largeBlurPx)} ${shadowColor}`
  } as const;
  const buttonAppearance = config.buttons.appearance === 'outline'
    ? { bg: 'transparent', text: config.colors.primary, border: config.colors.primary, hover: config.colors.surfaceMuted }
    : config.buttons.appearance === 'soft'
      ? { bg: config.colors.surfaceMuted, text: config.colors.primary, border: 'transparent', hover: config.colors.surface }
      : { bg: config.colors.primary, text: config.colors.primaryForeground, border: config.colors.primary, hover: config.colors.primaryHover };
  const cardShadow = config.cards.appearance === 'flat' ? 'none' : shadows[config.cards.shadow];
  const cardBorderWidth = config.cards.appearance === 'elevated' || config.cards.appearance === 'flat' ? '0px' : px(config.cards.borderWidthPx);
  const formBackground = config.forms.appearance === 'filled' ? config.colors.surfaceMuted : config.forms.background;
  const decoration = config.links.underline === 'always' ? 'underline' : 'none';
  const hoverDecoration = config.links.underline === 'never' ? 'none' : 'underline';

  return {
    '--site-global-content-width': px(config.layout.contentWidthPx),
    '--site-global-max-width': px(config.layout.maxWidthPx),
    '--site-gutter-mobile': px(config.layout.gutterMobilePx),
    '--site-gutter-tablet': px(config.layout.gutterTabletPx),
    '--site-gutter-desktop': px(config.layout.gutterDesktopPx),
    '--site-radius-sm': px(config.radii.smallPx),
    '--site-radius-md': px(config.radii.mediumPx),
    '--site-radius-lg': px(config.radii.largePx),
    '--site-radius-pill': px(config.radii.pillPx),
    '--site-color-page': config.colors.pageBackground,
    '--site-color-surface': config.colors.surface,
    '--site-color-surface-muted': config.colors.surfaceMuted,
    '--site-color-text': config.colors.text,
    '--site-color-text-muted': config.colors.textMuted,
    '--site-color-primary': config.colors.primary,
    '--site-color-primary-hover': config.colors.primaryHover,
    '--site-color-primary-active': config.colors.primaryActive,
    '--site-color-primary-foreground': config.colors.primaryForeground,
    '--site-color-accent': config.colors.accent,
    '--site-color-success': config.colors.success,
    '--site-color-warning': config.colors.warning,
    '--site-color-danger': config.colors.danger,
    '--site-color-info': config.colors.info,
    '--site-font-body': resolveWebsiteFontStack(config.typography.bodyFontFamily),
    '--site-font-heading': resolveWebsiteFontStack(config.typography.headingFontFamily),
    '--site-font-size-body': px(config.typography.bodySizePx),
    '--site-font-weight-body': String(config.typography.bodyWeight),
    '--site-line-height-body': String(config.typography.bodyLineHeight),
    '--site-font-weight-heading': String(config.typography.headingWeight),
    '--site-line-height-heading': String(config.typography.headingLineHeight),
    '--site-font-size-h1': px(config.typography.h1SizePx),
    '--site-font-size-h2': px(config.typography.h2SizePx),
    '--site-font-size-h3': px(config.typography.h3SizePx),
    '--site-font-size-paragraph': px(config.typography.paragraphSizePx),
    '--site-line-height-paragraph': String(config.typography.paragraphLineHeight),
    '--site-space-xs': px(config.spacing.xsPx),
    '--site-space-sm': px(config.spacing.smPx),
    '--site-space-md': px(config.spacing.mdPx),
    '--site-space-lg': px(config.spacing.lgPx),
    '--site-space-xl': px(config.spacing.xlPx),
    '--site-section-space-desktop': px(config.spacing.sectionDesktopPx),
    '--site-section-space-tablet': px(config.spacing.sectionTabletPx),
    '--site-section-space-mobile': px(config.spacing.sectionMobilePx),
    '--site-button-height': px(config.buttons.heightPx),
    '--site-button-padding-x': px(config.buttons.paddingXPx),
    '--site-button-radius': px(config.buttons.radiusPx),
    '--site-button-font-size': px(config.buttons.fontSizePx),
    '--site-button-font-weight': String(config.buttons.fontWeight),
    '--site-button-border-width': px(config.buttons.borderWidthPx),
    '--site-button-bg': buttonAppearance.bg,
    '--site-button-text': buttonAppearance.text,
    '--site-button-border': buttonAppearance.border,
    '--site-button-hover-bg': buttonAppearance.hover,
    '--site-button-shadow': shadows[config.buttons.shadow],
    '--site-button-disabled-opacity': String(config.buttons.disabledOpacityPercent / 100),
    '--site-field-height': px(config.forms.heightPx),
    '--site-field-padding-x': px(config.forms.paddingXPx),
    '--site-field-radius': px(config.forms.radiusPx),
    '--site-field-font-size': px(config.forms.fontSizePx),
    '--site-field-border-width': px(config.forms.borderWidthPx),
    '--site-field-bg': formBackground,
    '--site-field-placeholder': config.forms.placeholder,
    '--site-field-focus': config.forms.focusColor,
    '--site-card-radius': px(config.cards.radiusPx),
    '--site-card-padding': px(config.cards.paddingPx),
    '--site-card-border-width': cardBorderWidth,
    '--site-card-bg': config.cards.background,
    '--site-card-shadow': cardShadow,
    '--site-border-color': config.borders.color,
    '--site-divider-color': config.borders.dividerColor,
    '--site-border-width': px(config.borders.widthPx),
    '--site-shadow-sm': shadows.small,
    '--site-shadow-md': shadows.medium,
    '--site-shadow-lg': shadows.large,
    '--site-link-color': config.links.color,
    '--site-link-hover': config.links.hoverColor,
    '--site-link-active': config.links.activeColor,
    '--site-link-weight': String(config.links.fontWeight),
    '--site-link-decoration': decoration,
    '--site-link-hover-decoration': hoverDecoration,
    '--site-breakpoint-mobile-max': px(config.breakpoints.mobileMaxPx),
    '--site-breakpoint-tablet-max': px(config.breakpoints.tabletMaxPx),
    '--site-breakpoint-wide-min': px(config.breakpoints.wideMinPx)
  };
}
