'use client';

import { createContext, useContext, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { LOGO_PLACEMENT_IDS, type LogoPlacementId, type LogoBounds, type PublishedLogoAsset, type PublishedSiteLogoConfig } from '@/shared/domain/logo/logoLibrary';

type SiteLogoProps = {
  purposeId: LogoPlacementId; fallback?: ReactNode; className?: string;
  imageClassName?: string; alt?: string; style?: CSSProperties;
  sourceBounds?: LogoBounds; assetOverride?: PublishedLogoAsset | null;
  maxHeightPx?: number;
};
type ResponsiveSiteLogoProps = Omit<SiteLogoProps, 'purposeId'> & {
  purposes: { desktop: LogoPlacementId; tablet: LogoPlacementId; mobile: LogoPlacementId };
  purposeClassNames?: Partial<Record<'desktop' | 'tablet' | 'mobile', string>>;
  purposeMaxHeights?: Partial<Record<'desktop' | 'tablet' | 'mobile', number>>;
};

const defaultOriginal = {
  variantId: null, name: 'Izvirni logotip', revision: 'original', pngUrl: '/brand/atehna-document-wordmark.png',
  svgUrl: null, width: 1873, height: 840, bounds: { x: 0, y: 0, width: 1873, height: 840 }, fallback: 'original' as const
};
const defaultConfig: PublishedSiteLogoConfig = {
  revision: 0,
  placements: Object.fromEntries(LOGO_PLACEMENT_IDS.map(purpose => [purpose, purpose.startsWith('header-')
    ? { ...defaultOriginal, name: 'Besedilna znamka', fallback: 'brand' } : defaultOriginal])) as PublishedSiteLogoConfig['placements']
};
const SiteLogoContext = createContext<PublishedSiteLogoConfig>(defaultConfig);
const LogoPreviewDeviceContext = createContext<'desktop' | 'tablet' | 'mobile' | undefined>(undefined);

/** Only immutable published assets cross into the storefront; editor drafts use a nested provider. */
export function SiteLogoProvider({ config, children, previewDevice }: { config: PublishedSiteLogoConfig; children: ReactNode; previewDevice?: 'desktop' | 'tablet' | 'mobile' }) {
  return <SiteLogoContext.Provider value={config}><LogoPreviewDeviceContext.Provider value={previewDevice}>{children}</LogoPreviewDeviceContext.Provider></SiteLogoContext.Provider>;
}
export function useSiteLogoConfig() { return useContext(SiteLogoContext); }

export function DefaultSiteBrand() {
  return <span className="inline-flex items-center gap-2 text-black">
    <span className="inline-flex h-6 w-6 items-center justify-center rounded-[5px] bg-black text-[15px] font-semibold leading-none text-white">A</span>
    <span className="text-[23px] font-semibold leading-none tracking-normal">Atehna</span>
  </span>;
}

/** Explicit footer sizing scales the existing DOM brand without changing its default rendering. */
function HeightLimitedSiteBrand({ asset, height, fallback, purposeId, className, style }: {
  asset: PublishedLogoAsset; height: number; fallback?: ReactNode;
  purposeId: LogoPlacementId; className: string; style?: CSSProperties;
}) {
  const width = Number.isFinite(asset.width) && asset.width > 0 ? asset.width : 130;
  const sourceHeight = Number.isFinite(asset.height) && asset.height > 0 ? asset.height : 30;
  const hostRef = useRef<HTMLSpanElement>(null);
  const [scale, setScale] = useState(height / sourceHeight);
  useLayoutEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const update = () => {
      // Computed CSS width stays in local coordinates even inside a scaled preview.
      const displayedWidth = Number.parseFloat(getComputedStyle(host).width);
      if (Number.isFinite(displayedWidth) && displayedWidth > 0) setScale(displayedWidth / width);
    };
    update();
    const observer = new ResizeObserver(update); observer.observe(host);
    return () => observer.disconnect();
  }, [height, width, sourceHeight]);
  return <span ref={hostRef} className={'relative inline-block min-h-0 min-w-0 shrink-0 align-middle ' + className}
    style={{ ...style, width: height * width / sourceHeight, height: 'auto', maxWidth: '100%', aspectRatio: `${width} / ${sourceHeight}` }}
    data-site-logo-purpose={purposeId} data-site-logo-variant="brand" data-site-logo-revision={asset.revision}
    data-logo-placement-area data-logo-max-height={height}>
    <span className="absolute left-0 top-0 inline-flex items-center" style={{ width, height: sourceHeight, transform: `scale(${scale})`, transformOrigin: 'top left' }}>
      {fallback ?? <DefaultSiteBrand />}
    </span>
  </span>;
}

export function SiteLogo({ purposeId, fallback, className = '', imageClassName = '', alt = '', style, sourceBounds, assetOverride, maxHeightPx }: SiteLogoProps) {
  const configuredAsset = useSiteLogoConfig().placements[purposeId];
  const asset = assetOverride === undefined ? configuredAsset : assetOverride;
  if (!asset) return null;
  const maximumHeight = typeof maxHeightPx === 'number' && Number.isFinite(maxHeightPx) && maxHeightPx > 0 ? maxHeightPx : null;
  if (asset.fallback === 'brand') return maximumHeight
    ? <HeightLimitedSiteBrand asset={asset} height={maximumHeight} fallback={fallback} purposeId={purposeId} className={className} style={style} />
    : fallback ?? <DefaultSiteBrand />;
  const cropped = sourceBounds && sourceBounds.width > 0 && sourceBounds.height > 0
    && (sourceBounds.x !== 0 || sourceBounds.y !== 0 || sourceBounds.width !== asset.width || sourceBounds.height !== asset.height);
  const sourceWidth = cropped ? sourceBounds.width : asset.width;
  const sourceHeight = cropped ? sourceBounds.height : asset.height;
  const proportionalStyle: CSSProperties | undefined = maximumHeight && sourceWidth > 0 && sourceHeight > 0 ? {
    width: maximumHeight * sourceWidth / sourceHeight, height: 'auto', maxWidth: '100%', aspectRatio: `${sourceWidth} / ${sourceHeight}`
  } : undefined;
  const imageStyle: CSSProperties | undefined = cropped ? {
    position: 'absolute', maxWidth: 'none', maxHeight: 'none',
    width: `${asset.width / sourceBounds.width * 100}%`,
    height: `${asset.height / sourceBounds.height * 100}%`,
    left: `${-sourceBounds.x / sourceBounds.width * 100}%`,
    top: `${-sourceBounds.y / sourceBounds.height * 100}%`
  } : proportionalStyle ? { height: 'auto' } : undefined;

  return <span
    className={'relative inline-flex min-h-0 min-w-0 shrink-0 items-center justify-center ' + className}
    style={cropped || proportionalStyle ? { ...style, ...proportionalStyle, ...(cropped ? { overflow: 'hidden' } : {}) } : style}
    data-logo-max-height={proportionalStyle ? maximumHeight : undefined}
    data-logo-source-window={cropped ? `${sourceBounds.x},${sourceBounds.y},${sourceBounds.width},${sourceBounds.height}` : undefined}
    data-site-logo-purpose={purposeId}
    data-site-logo-variant={asset.variantId ?? asset.fallback}
    data-site-logo-revision={asset.revision}
    data-logo-placement-area
  >
    {/* Published assets are already rendered and versioned; no image optimizer or editor runtime is needed. */}
    {/* eslint-disable-next-line @next/next/no-img-element */}
    <img
      src={asset.svgUrl || asset.pngUrl} alt={alt} width={asset.width} height={asset.height}
      draggable={false}
      className={'block h-full w-full max-h-full max-w-full object-contain ' + imageClassName}
      style={imageStyle}
      data-site-logo-published-image
    />
  </span>;
}

export function ResponsiveSiteLogo({ purposes, purposeClassNames, purposeMaxHeights, className, ...props }: ResponsiveSiteLogoProps) {
  const previewDevice = useContext(LogoPreviewDeviceContext);
  const hostRef = useRef<HTMLSpanElement>(null);
  const [device, setDevice] = useState<'desktop' | 'tablet' | 'mobile'>('desktop');
  useLayoutEffect(() => {
    if (previewDevice) return;
    const host = hostRef.current;
    const surface = host?.closest('footer') ?? host?.parentElement;
    if (!surface) return;
    const update = () => {
      const width = surface.clientWidth;
      if (width > 0) setDevice(width <= 767 ? 'mobile' : width <= 1024 ? 'tablet' : 'desktop');
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(surface);
    return () => observer.disconnect();
  }, [previewDevice]);
  const activeDevice = previewDevice ?? device;
  return <span ref={hostRef} className="inline-flex h-full w-full min-h-0 min-w-0">
    <SiteLogo {...props} purposeId={purposes[activeDevice]} maxHeightPx={purposeMaxHeights?.[activeDevice] ?? props.maxHeightPx} className={purposeClassNames?.[activeDevice] ?? className} />
  </span>;
}
