export const LOGO_LIBRARY_SETTINGS_KEY = 'website-logo-library';
export const LOGO_PLACEMENT_IDS = ['standalone', 'header-desktop', 'header-tablet', 'header-mobile', 'footer-desktop', 'footer-tablet', 'footer-mobile', 'pdf-document', 'favicon', 'apple-touch-icon', 'pwa-maskable', 'social-share'] as const;
export type LogoPlacementId = typeof LOGO_PLACEMENT_IDS[number];
export const LOGO_PLACEMENT_LABELS: Record<LogoPlacementId, string> = {
  standalone: 'Privzeti logotip', 'header-desktop': 'Glava · namizje', 'header-tablet': 'Glava · tablica', 'header-mobile': 'Glava · telefon',
  'footer-desktop': 'Noga · namizje', 'footer-tablet': 'Noga · tablica', 'footer-mobile': 'Noga · telefon',
  'pdf-document': 'Dokumenti PDF', favicon: 'Ikona zavihka', 'apple-touch-icon': 'Ikona Apple', 'pwa-maskable': 'Ikona aplikacije', 'social-share': 'Družbena omrežja'
};
export const LOGO_FONT_FAMILIES = ['Inter', 'Barlow', 'Bitter', 'Noto Sans'] as const;
export type LogoFontFamily = typeof LOGO_FONT_FAMILIES[number];
export type LogoBounds = { x: number; y: number; width: number; height: number };
export type LogoShadow = { color: string; opacity: number; blur: number; offsetX: number; offsetY: number };
export type LogoLayerBase = LogoBounds & {
  id: string; name: string; rotation: number; opacity: number; visible: boolean; locked: boolean;
  shadow?: LogoShadow;
};
export type LogoImageLayer = LogoLayerBase & { type: 'image'; assetId: string; crop: LogoBounds; mask: 'rectangle' | 'ellipse' };
export type LogoTextLayer = LogoLayerBase & {
  type: 'text'; text: string; fontFamily: LogoFontFamily; fontSize: number; fontWeight: 400 | 500 | 600 | 700;
  fontStyle: 'normal' | 'italic'; fill: string; textAlign: 'left' | 'center' | 'right'; lineHeight: number; letterSpacing: number;
};
export type LogoShapeLayer = LogoLayerBase & {
  type: 'shape'; shape: 'rectangle' | 'ellipse' | 'line' | 'path'; fill: string; stroke: string; strokeWidth: number;
  radius: number; path?: string; pathViewBox?: LogoBounds;
};
export type LogoGroupLayer = LogoLayerBase & { type: 'group'; children: LogoLayer[] };
export type LogoLayer = LogoImageLayer | LogoTextLayer | LogoShapeLayer | LogoGroupLayer;
export type LogoProject = { version: 1; canvas: { width: number; height: number }; layers: LogoLayer[] };
export type LogoSourceAsset = {
  id: string; name: string; url: string; pathname: string; mimeType: 'image/png' | 'image/jpeg' | 'image/webp' | 'image/svg+xml';
  width: number; height: number; bytes: number; bounds: LogoBounds; warnings: string[];
};
export type LogoOutputAsset = { url: string; pathname: string; width: number; height: number; mimeType: 'image/png' | 'image/svg+xml' };
export type LogoPublishedRevision = {
  id: string; createdAt: string; project: LogoProject; png: LogoOutputAsset; png2x: LogoOutputAsset; svg: LogoOutputAsset;
  bounds: LogoBounds;
};
export type LogoVariant = {
  id: string; name: string; draft: LogoProject; draftRevision: number; updatedAt: string;
  published: LogoPublishedRevision | null; history: LogoPublishedRevision[];
};
export type LogoAssignment = { variantId: string | null; fallback: 'default' | 'original' | 'brand' | 'none' };
export type LogoLibrary = {
  version: 1; revision: number; assets: LogoSourceAsset[]; variants: LogoVariant[];
  placements: Record<LogoPlacementId, LogoAssignment>; migratedAt: string | null;
};
export type PublishedLogoAsset = {
  variantId: string | null; name: string; revision: string; pngUrl: string; svgUrl: string | null;
  width: number; height: number; bounds: LogoBounds; fallback?: 'brand' | 'original';
};
export type PublishedSiteLogoConfig = { revision: number; placements: Record<LogoPlacementId, PublishedLogoAsset | null> };
export type LogoLibraryAction =
  | { action: 'create'; name: string; project?: LogoProject; expectedRevision: number }
  | { action: 'save'; variantId: string; name: string; project: LogoProject; expectedRevision: number; expectedDraftRevision: number }
  | { action: 'duplicate'; variantId: string; name: string; expectedRevision: number }
  | { action: 'rename'; variantId: string; name: string; expectedRevision: number }
  | { action: 'delete'; variantId: string; expectedRevision: number }
  | { action: 'assign'; placements: Partial<Record<LogoPlacementId, LogoAssignment>>; expectedRevision: number }
  | { action: 'publish'; variantId: string; expectedRevision: number; expectedDraftRevision: number }
  | { action: 'restore'; variantId: string; revisionId: string; expectedRevision: number }
  | { action: 'preview'; project: LogoProject }
  | { action: 'export'; project: LogoProject; format: 'png' | 'svg'; scale?: 1 | 2 };
export type LogoPreview = { svg: string; pngDataUrl: string; width: number; height: number; bounds: LogoBounds };

export const blankLogoProject = (): LogoProject => ({ version: 1, canvas: { width: 640, height: 240 }, layers: [] });
export const cloneLogoProject = (project: LogoProject): LogoProject => structuredClone(project);
export function flattenLogoLayers(layers: LogoLayer[]): LogoLayer[] {
  return layers.flatMap(layer => [layer, ...(layer.type === 'group' ? flattenLogoLayers(layer.children) : [])]);
}
export function logoPlacementVariantId(library: Pick<LogoLibrary, 'placements'>, purpose: LogoPlacementId): string | null {
  const assignment = library.placements[purpose];
  if (assignment.variantId) return assignment.variantId;
  return assignment.fallback === 'default' && purpose !== 'standalone' ? library.placements.standalone.variantId : null;
}
export function logoVariantUsages(library: Pick<LogoLibrary, 'placements'>, variantId: string): LogoPlacementId[] {
  return LOGO_PLACEMENT_IDS.filter(purpose => logoPlacementVariantId(library, purpose) === variantId);
}
export function logoVariantHasDraft(variant: LogoVariant): boolean {
  return !variant.published || JSON.stringify(variant.draft) !== JSON.stringify(variant.published.project);
}
export function defaultLogoAssignments(): Record<LogoPlacementId, LogoAssignment> {
  return Object.fromEntries(LOGO_PLACEMENT_IDS.map(purpose => [purpose, { variantId: null, fallback: purpose.startsWith('header-') ? 'brand' : 'original' }])) as Record<LogoPlacementId, LogoAssignment>;
}
