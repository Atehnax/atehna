import { LOGO_PLACEMENT_IDS, type LogoLibrary, type LogoPlacementId, type PublishedLogoAsset, type PublishedSiteLogoConfig } from './logoLibrary';

const original = (): PublishedLogoAsset => ({
  variantId: null, name: 'Atehna · izvirnik', revision: 'original-v1',
  pngUrl: '/brand/atehna-document-wordmark.png', svgUrl: null, width: 1873, height: 840,
  bounds: { x: 0, y: 0, width: 1873, height: 840 }, fallback: 'original'
});
const brand = (): PublishedLogoAsset => ({
  variantId: null, name: 'Atehna', revision: 'brand-v1', pngUrl: '', svgUrl: null,
  width: 130, height: 30, bounds: { x: 0, y: 0, width: 130, height: 30 }, fallback: 'brand'
});
export function publishedLogoProjection(library: LogoLibrary): PublishedSiteLogoConfig {
  const resolve = (purpose: LogoPlacementId): PublishedLogoAsset | null => {
    const selected = library.placements[purpose];
    const variant = selected.variantId ? library.variants.find(value => value.id === selected.variantId) : undefined;
    if (variant?.published) {
      const revision = variant.published;
      return { variantId: variant.id, name: variant.name, revision: revision.id, pngUrl: revision.png.url,
        svgUrl: revision.svg.url, width: revision.png.width, height: revision.png.height, bounds: structuredClone(revision.bounds) };
    }
    if (selected.fallback === 'default' && purpose !== 'standalone') return resolve('standalone');
    if (selected.fallback === 'none') return null;
    return selected.fallback === 'brand' ? brand() : original();
  };
  return { revision: library.revision, placements: Object.fromEntries(LOGO_PLACEMENT_IDS.map(purpose => [purpose, resolve(purpose)])) as PublishedSiteLogoConfig['placements'] };
}
