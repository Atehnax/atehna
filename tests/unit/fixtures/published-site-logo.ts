import { LOGO_PLACEMENT_IDS, type LogoPlacementId, type PublishedLogoAsset, type PublishedSiteLogoConfig } from '@/shared/domain/logo/logoLibrary';

export function publishedLogoAsset(id: string, width = 320, height = 96): PublishedLogoAsset {
  return { variantId: id, name: id, revision: 'published-1', pngUrl: '/' + id + '.png', svgUrl: '/' + id + '.svg',
    width, height, bounds: { x: 0, y: 0, width, height } };
}
export function publishedLogoFixture(placements: Partial<Record<LogoPlacementId, PublishedLogoAsset | null>> = {}): PublishedSiteLogoConfig {
  return { revision: 1, placements: { ...Object.fromEntries(LOGO_PLACEMENT_IDS.map(id => [id, null])), ...placements } as PublishedSiteLogoConfig['placements'] };
}
