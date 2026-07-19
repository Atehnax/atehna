export const GLOBAL_WEBSITE_FONT_FAMILIES = [
  'Noto Sans',
  'Inter',
  'IBM Plex Sans',
  'Source Sans 3',
  'Manrope',
  'Space Grotesk',
  'Barlow',
  'Bitter',
  'Arial',
  'Georgia',
  'system-ui'
] as const;

export const HOMEPAGE_WEBSITE_FONT_FAMILIES = [
  'Inter',
  'Noto Sans',
  'IBM Plex Sans',
  'Source Sans 3',
  'Manrope',
  'Space Grotesk',
  'Barlow',
  'Bitter',
  'Arial',
  'Helvetica',
  'Georgia',
  'Times New Roman',
  'Trebuchet MS',
  'Tahoma',
  'Verdana',
  'Courier New',
  'system-ui'
] as const;

export type WebsiteFontFamily = (typeof HOMEPAGE_WEBSITE_FONT_FAMILIES)[number];

export const RECOMMENDED_WEBSITE_FONT_FAMILY = 'IBM Plex Sans' as const;

const websiteFontStacks: Record<WebsiteFontFamily, string> = {
  'Noto Sans': '"Noto Sans", "Inter Variable", "Inter", system-ui, sans-serif',
  Inter: '"Inter Variable", "Inter", "Noto Sans", system-ui, sans-serif',
  'IBM Plex Sans': '"IBM Plex Sans Variable", "IBM Plex Sans", "Noto Sans", system-ui, sans-serif',
  'Source Sans 3': '"Source Sans 3 Variable", "Source Sans 3", "Noto Sans", system-ui, sans-serif',
  Manrope: '"Manrope Variable", "Manrope", "Noto Sans", system-ui, sans-serif',
  'Space Grotesk': '"Space Grotesk Variable", "Space Grotesk", "Noto Sans", system-ui, sans-serif',
  Barlow: '"Barlow", "Noto Sans", system-ui, sans-serif',
  Bitter: '"Bitter Variable", "Bitter", Georgia, "Times New Roman", serif',
  Arial: 'Arial, Helvetica, sans-serif',
  Helvetica: 'Helvetica, Arial, sans-serif',
  Georgia: 'Georgia, "Times New Roman", serif',
  'Times New Roman': '"Times New Roman", Times, serif',
  'Trebuchet MS': '"Trebuchet MS", Arial, sans-serif',
  Tahoma: 'Tahoma, Verdana, sans-serif',
  Verdana: 'Verdana, Tahoma, sans-serif',
  'Courier New': '"Courier New", Courier, monospace',
  'system-ui': 'system-ui, sans-serif'
};

export function resolveWebsiteFontStack(fontFamily: string): string {
  return websiteFontStacks[fontFamily as WebsiteFontFamily] ?? fontFamily;
}

export function getWebsiteFontFamilyLabel(fontFamily: string): string {
  return fontFamily === RECOMMENDED_WEBSITE_FONT_FAMILY
    ? `${fontFamily} · priporočeno`
    : fontFamily;
}
