'use client';

import { createContext, useContext, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { LOGO_PLACEMENT_IDS, type LogoPlacementId, type PublishedSiteLogoConfig } from '@/shared/domain/logo/logoLibrary';

type SiteLogoProps = {
  purposeId: LogoPlacementId; fallback?: ReactNode; className?: string;
  imageClassName?: string; alt?: string; style?: CSSProperties;
};
type ResponsiveSiteLogoProps = Omit<SiteLogoProps, 'purposeId'> & {
  purposes: { desktop: LogoPlacementId; tablet: LogoPlacementId; mobile: LogoPlacementId };
  purposeClassNames?: Partial<Record<'desktop' | 'tablet' | 'mobile', string>>;
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

export function SiteLogo({ purposeId, fallback, className = '', imageClassName = '', alt = '', style }: SiteLogoProps) {
  const asset = useSiteLogoConfig().placements[purposeId];
  if (!asset) return null;
  if (asset.fallback === 'brand') return fallback ?? <DefaultSiteBrand />;
  return <span
    className={'relative inline-flex min-h-0 min-w-0 shrink-0 items-center justify-center ' + className}
    style={style}
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
      data-site-logo-published-image
    />
  </span>;
}

export function ResponsiveSiteLogo({ purposes, purposeClassNames, className, ...props }: ResponsiveSiteLogoProps) {
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
    <SiteLogo {...props} purposeId={purposes[activeDevice]} className={purposeClassNames?.[activeDevice] ?? className} />
  </span>;
}
