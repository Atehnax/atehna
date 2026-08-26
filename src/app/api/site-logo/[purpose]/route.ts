import { createElement } from 'react';
import { ImageResponse } from 'next/og';
import {
  SITE_LOGO_PURPOSE_CATALOG,
  SITE_LOGO_PURPOSE_IDS,
  type SiteLogoPurposeId
} from '@/shared/domain/logo/siteLogo';
import { getSiteLogoConfig } from '@/shared/server/siteLogo';
import {
  SITE_LOGO_PUBLIC_CACHE_CONTROL,
  resolveCachedSiteLogoArtwork
} from '@/shared/server/siteLogoArtwork';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const OUTPUT_PURPOSES = new Set<SiteLogoPurposeId>(SITE_LOGO_PURPOSE_IDS);

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
  let artwork: Awaited<ReturnType<typeof resolveCachedSiteLogoArtwork>> = null;
  let transientArtworkFailure = false;
  if (placement?.enabled) {
    try {
      artwork = await resolveCachedSiteLogoArtwork(config, purposeId);
    } catch (error) {
      transientArtworkFailure = true;
      console.error(`Failed to render public site logo for ${purposeId}`, error);
    }
  }
  if (artwork) {
    return new Response(Uint8Array.from(Buffer.from(artwork.base64, 'base64')), {
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': SITE_LOGO_PUBLIC_CACHE_CONTROL
      }
    });
  }

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
      fallbackNode(purposeId)
    ),
    {
      width: purpose.widthPx,
      height: purpose.heightPx,
      headers: {
        'Cache-Control': transientArtworkFailure
          ? 'no-store, max-age=0'
          : SITE_LOGO_PUBLIC_CACHE_CONTROL
      }
    }
  );
}
