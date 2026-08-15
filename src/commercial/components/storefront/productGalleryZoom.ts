export type GalleryZoomBounds = {
  left: number;
  top: number;
  width: number;
  height: number;
  clientX: number;
  clientY: number;
};

export function resolveGalleryZoomOrigin({
  left,
  top,
  width,
  height,
  clientX,
  clientY
}: GalleryZoomBounds) {
  if (width <= 0 || height <= 0) {
    return { xPercent: 50, yPercent: 50 };
  }

  const clampPercent = (value: number) =>
    Math.min(100, Math.max(0, Math.round(value * 100) / 100));

  return {
    xPercent: clampPercent(((clientX - left) / width) * 100),
    yPercent: clampPercent(((clientY - top) / height) * 100)
  };
}
