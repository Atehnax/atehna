const LOCAL_IMAGE_ORIGIN = 'https://homepage-image.invalid';
const OPTIMIZABLE_RASTER_EXTENSION = /\.(?:png|jpe?g|webp|gif)$/i;

/** Preserve arbitrary editor media; optimize only known raster sources the server supports. */
export function canOptimizeHomepageImage(src: string): boolean {
  // Fragments can select SVG views. AVIF and unknown formats may be animated,
  // while the image optimizer only detects animation in GIF, PNG and WebP.
  if (src.includes('#')) return false;
  const local = src.startsWith('/') && !src.startsWith('//');
  try {
    const url = local ? new URL(src, LOCAL_IMAGE_ORIGIN) : new URL(src);
    if (!OPTIMIZABLE_RASTER_EXTENSION.test(url.pathname)) return false;
    if (local) {
      // API images can require cookies, which the optimizer does not forward.
      return url.origin === LOCAL_IMAGE_ORIGIN && !url.pathname.startsWith('/api/');
    }
    return url.protocol === 'https:'
      && url.port === ''
      && !url.username
      && !url.password
      && url.hostname.endsWith('.public.blob.vercel-storage.com');
  } catch {
    return false;
  }
}
