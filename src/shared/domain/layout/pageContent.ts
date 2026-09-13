/** The shared available content width follows the admin shell's sidebar spacing. */
export const PAGE_CONTENT_INSETS = {
  mobile: { startPx: 80, endPx: 16 },
  tablet: { startPx: 96, endPx: 24 },
  desktop: { startPx: 96, endPx: 28 }
} as const;

export function getPageContentInsets(viewportWidthPx: number) {
  return viewportWidthPx >= 1024
    ? PAGE_CONTENT_INSETS.desktop
    : viewportWidthPx >= 768
      ? PAGE_CONTENT_INSETS.tablet
      : PAGE_CONTENT_INSETS.mobile;
}
