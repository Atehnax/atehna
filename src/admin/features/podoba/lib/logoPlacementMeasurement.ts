import type { LogoBounds } from '@/shared/domain/logo/logoLibrary';

/** Measure a contained image window in the preview frame's coordinate space. */
export function measureLogoPlacementImage(rect: LogoBounds, source: LogoBounds, artwork: LogoBounds) {
  const sourceScale = Math.min(rect.width / source.width, rect.height / source.height);
  const image = {
    x: rect.x + (rect.width - source.width * sourceScale) / 2,
    y: rect.y + (rect.height - source.height * sourceScale) / 2,
    width: source.width * sourceScale, height: source.height * sourceScale
  };
  return { image, sourceScale, artwork: {
    x: image.x + (artwork.x - source.x) * sourceScale,
    y: image.y + (artwork.y - source.y) * sourceScale,
    width: artwork.width * sourceScale, height: artwork.height * sourceScale
  } };
}
