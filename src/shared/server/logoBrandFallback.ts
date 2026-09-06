import { createElement } from 'react';
import { ImageResponse } from 'next/og';
import type { LogoPlacementId } from '@/shared/domain/logo/logoLibrary';
import { LOGO_OUTPUT_DIMENSIONS } from '@/shared/domain/logo/logoOutputDimensions';

/** Stable public fallback artwork, independent of editable logo projects. */
export function createLogoBrandFallback(purpose: LogoPlacementId, headers: HeadersInit) {
  const dimensions = LOGO_OUTPUT_DIMENSIONS[purpose];
  const compact = dimensions.widthPx === dimensions.heightPx;
  return new ImageResponse(createElement('div', {
    style: { width: '100%', height: '100%', display: 'flex', position: 'relative', overflow: 'hidden', background: 'transparent' }
  }, createElement('div', {
    style: {
      width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: purpose === 'social-share' ? '#F8FAFC' : 'transparent',
      color: '#0F172A',
      fontSize: compact ? Math.round(dimensions.widthPx * .52) : Math.round(dimensions.heightPx * .34),
      fontWeight: 700, letterSpacing: '-0.035em'
    }
  }, compact ? 'A' : 'Atehna')), { width: dimensions.widthPx, height: dimensions.heightPx, headers });
}
