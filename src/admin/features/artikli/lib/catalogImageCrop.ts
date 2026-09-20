import { assertCatalogImageDimensions } from '@/shared/domain/media/catalogImageQuality';

type Crop = { x: number; y: number; width: number; height: number };

/** Export in source pixels; reject stretched transforms and blank padding outside the source. */
export function getNativeCatalogCropSize(crop: Crop, source: { width: number; height: number }, transform: number[]) {
  const [a, b, c, d, e, f] = transform;
  if (transform.length !== 6 || !transform.every(Number.isFinite)) throw new Error('Preoblikovanje slike ni veljavno.');
  const scaleX = Math.hypot(a, b);
  const scaleY = Math.hypot(c, d);
  const determinant = a * d - b * c;
  if (!scaleX || !scaleY || Math.abs(determinant) < 1e-8 || Math.abs(scaleX - scaleY) > 0.0001
    || Math.abs(a * c + b * d) > 0.0001) {
    throw new Error('Ohranite izvirna razmerja slike.');
  }
  const centerX = source.width / 2;
  const centerY = source.height / 2;
  const corners = [
    [crop.x, crop.y], [crop.x + crop.width, crop.y],
    [crop.x, crop.y + crop.height], [crop.x + crop.width, crop.y + crop.height]
  ];
  for (const [x, y] of corners) {
    const translatedX = x - centerX - e;
    const translatedY = y - centerY - f;
    const originalX = (d * translatedX - c * translatedY) / determinant + centerX;
    const originalY = (a * translatedY - b * translatedX) / determinant + centerY;
    if (originalX < -0.5 || originalY < -0.5 || originalX > source.width + 0.5 || originalY > source.height + 0.5) {
      throw new Error('Izrez mora ostati znotraj izvirne slike, brez dodajanja praznega roba.');
    }
  }
  const width = Math.floor(crop.width / scaleX);
  const height = Math.floor(crop.height / scaleY);
  assertCatalogImageDimensions(width, height);
  return { width, height };
}
