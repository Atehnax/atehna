import { createElement, type CSSProperties } from 'react';
import { ImageResponse } from 'next/og';
import {
  SITE_LOGO_PURPOSE_CATALOG,
  SITE_LOGO_PURPOSE_IDS,
  resolveSiteLogoGeometry,
  type SiteLogoMasterVariant,
  type SiteLogoPurposeId
} from '@/shared/domain/logo/siteLogo';
import { getSiteLogoConfig } from '@/shared/server/siteLogo';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const OUTPUT_PURPOSES = new Set<SiteLogoPurposeId>([
  'favicon',
  'apple-touch-icon',
  'pwa-maskable',
  'social-share'
]);

function imageStyle(
  master: SiteLogoMasterVariant,
  purposeId: SiteLogoPurposeId,
  geometry: ReturnType<typeof resolveSiteLogoGeometry>
): CSSProperties {
  const purpose = SITE_LOGO_PURPOSE_CATALOG[purposeId];
  const crop = geometry.crop;
  const safeWidth = Math.max(1, purpose.widthPx * (1 - geometry.safeAreaInset * 2));
  const safeHeight = Math.max(1, purpose.heightPx * (1 - geometry.safeAreaInset * 2));
  const cropWidth = Math.max(0.0001, master.intrinsicWidth * crop.width);
  const cropHeight = Math.max(0.0001, master.intrinsicHeight * crop.height);
  const containScale = Math.min(safeWidth / cropWidth, safeHeight / cropHeight);
  const renderedScale = containScale * geometry.scale;
  const renderedWidth = master.intrinsicWidth * renderedScale;
  const renderedHeight = master.intrinsicHeight * renderedScale;
  const left = purpose.widthPx * geometry.safeAreaInset
    + (safeWidth - cropWidth * renderedScale) / 2
    - crop.x * renderedWidth
    + geometry.translateX * purpose.widthPx;
  const top = purpose.heightPx * geometry.safeAreaInset
    + (safeHeight - cropHeight * renderedScale) / 2
    - crop.y * renderedHeight
    + geometry.translateY * purpose.heightPx;

  return {
    position: 'absolute',
    left,
    top,
    width: renderedWidth,
    height: renderedHeight,
    objectFit: 'fill'
  };
}

function fallbackNode(purposeId: SiteLogoPurposeId) {
  const purpose = SITE_LOGO_PURPOSE_CATALOG[purposeId];
  const compact = purpose.widthPx === purpose.heightPx;
  return createElement(
    'div',
    {
      style: {
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: purposeId === 'social-share' ? '#F8FAFC' : 'transparent',
        color: '#0F172A',
        fontSize: compact ? Math.round(purpose.widthPx * 0.52) : Math.round(purpose.heightPx * 0.34),
        fontWeight: 700,
        letterSpacing: '-0.035em'
      }
    },
    compact ? 'A' : 'Atehna'
  );
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ purpose: string }> }
) {
  const { purpose: rawPurpose } = await context.params;
  if (!SITE_LOGO_PURPOSE_IDS.includes(rawPurpose as SiteLogoPurposeId)) {
    return new Response('Not found', { status: 404 });
  }
  const purposeId = rawPurpose as SiteLogoPurposeId;
  if (!OUTPUT_PURPOSES.has(purposeId)) return new Response('Not found', { status: 404 });

  const purpose = SITE_LOGO_PURPOSE_CATALOG[purposeId];
  const config = await getSiteLogoConfig();
  const placement = config.placements[purposeId];
  const master = placement?.enabled && placement.masterId
    ? config.masters.find((candidate) => candidate.id === placement.masterId && Boolean(candidate.url)) ?? null
    : null;
  const content = master
    ? createElement('img', {
        src: master.url,
        alt: '',
        width: master.intrinsicWidth,
        height: master.intrinsicHeight,
        style: imageStyle(master, purposeId, resolveSiteLogoGeometry(placement))
      })
    : fallbackNode(purposeId);

  return new ImageResponse(
    createElement(
      'div',
      {
        style: {
          width: '100%',
          height: '100%',
          display: 'flex',
          position: 'relative',
          overflow: 'hidden',
          background: 'transparent'
        }
      },
      content
    ),
    {
      width: purpose.widthPx,
      height: purpose.heightPx,
      headers: {
        'Cache-Control': 'public, max-age=0, s-maxage=300, stale-while-revalidate=86400'
      }
    }
  );
}
