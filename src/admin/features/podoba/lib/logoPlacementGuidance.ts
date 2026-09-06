import type { LogoLayer, LogoProject, LogoSourceAsset } from '@/shared/domain/logo/logoLibrary';

export function logoPlacementGuidance(project: LogoProject, assets: LogoSourceAsset[], scale: number) {
  const result = { tinyText: false, rasterUpscaled: false, embeddedRasterSvg: false };
  const sources = new Map(assets.map(asset => [asset.id, asset]));
  const visit = (layers: LogoLayer[]) => {
    for (const layer of layers) {
      if (!layer.visible || layer.opacity <= 0) continue;
      if (layer.type === 'group') { visit(layer.children); continue; }
      if (layer.type === 'text') result.tinyText ||= layer.fontSize * scale < 9;
      if (layer.type !== 'image') continue;
      const source = sources.get(layer.assetId);
      if (!source) continue;
      if (source.mimeType === 'image/svg+xml') {
        result.embeddedRasterSvg ||= source.warnings.includes('SVG vsebuje vdelane rastrske slike.');
        continue;
      }
      const sourceWidth = source.width * layer.crop.width;
      const sourceHeight = source.height * layer.crop.height;
      result.rasterUpscaled ||= layer.width * scale > sourceWidth * 1.01 || layer.height * scale > sourceHeight * 1.01;
    }
  };
  visit(project.layers);
  return result;
}
