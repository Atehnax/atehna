'use client';

import Image from 'next/image';
import {
  createContext,
  useContext,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode
} from 'react';
import {
  cloneDefaultSiteLogoConfig,
  normalizeSiteLogoConfig,
  resolveSiteLogoGeometry,
  type SiteLogoConfig,
  type SiteLogoMasterVariant,
  type SiteLogoPurposeId
} from '@/shared/domain/logo/siteLogo';

type RenderSize = {
  width: number;
  height: number;
};

type SiteLogoProps = {
  purposeId: SiteLogoPurposeId;
  fallback: ReactNode;
  className?: string;
  imageClassName?: string;
  alt?: string;
};

type ResponsiveSiteLogoProps = Omit<SiteLogoProps, 'purposeId'> & {
  purposes: {
    desktop: SiteLogoPurposeId;
    tablet: SiteLogoPurposeId;
    mobile: SiteLogoPurposeId;
  };
  purposeClassNames?: Partial<Record<'desktop' | 'tablet' | 'mobile', string>>;
};

const SiteLogoContext = createContext<SiteLogoConfig>(cloneDefaultSiteLogoConfig());

const classNames = (...values: Array<string | false | null | undefined>) => values.filter(Boolean).join(' ');

export function SiteLogoProvider({ config, children }: { config: SiteLogoConfig; children: ReactNode }) {
  const normalizedConfig = useMemo(() => normalizeSiteLogoConfig(config), [config]);
  return <SiteLogoContext.Provider value={normalizedConfig}>{children}</SiteLogoContext.Provider>;
}

export function useSiteLogoConfig() {
  return useContext(SiteLogoContext);
}

function resolveMaster(config: SiteLogoConfig, purposeId: SiteLogoPurposeId): SiteLogoMasterVariant | null {
  const placement = config.placements[purposeId];
  if (!placement?.enabled || !placement.masterId) return null;
  return config.masters.find((master) => master.id === placement.masterId && Boolean(master.url)) ?? null;
}

function useElementSize() {
  const ref = useRef<HTMLSpanElement>(null);
  const [size, setSize] = useState<RenderSize | null>(null);

  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return undefined;

    const measure = () => {
      const width = element.clientWidth;
      const height = element.clientHeight;
      if (width <= 0 || height <= 0) return;
      setSize((current) => {
        if (current && Math.abs(current.width - width) < 0.25 && Math.abs(current.height - height) < 0.25) {
          return current;
        }
        return { width, height };
      });
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return { ref, size };
}

function fittedImageStyle(
  master: SiteLogoMasterVariant,
  config: SiteLogoConfig,
  purposeId: SiteLogoPurposeId,
  size: RenderSize
): CSSProperties {
  const geometry = resolveSiteLogoGeometry(config.placements[purposeId]);
  const crop = geometry.crop;
  const safeWidth = Math.max(1, size.width * (1 - geometry.safeAreaInset * 2));
  const safeHeight = Math.max(1, size.height * (1 - geometry.safeAreaInset * 2));
  const cropWidth = Math.max(0.0001, master.intrinsicWidth * crop.width);
  const cropHeight = Math.max(0.0001, master.intrinsicHeight * crop.height);
  const containScale = Math.min(safeWidth / cropWidth, safeHeight / cropHeight);
  const renderedScale = containScale * geometry.scale;
  const renderedWidth = master.intrinsicWidth * renderedScale;
  const renderedHeight = master.intrinsicHeight * renderedScale;
  const renderedCropWidth = cropWidth * renderedScale;
  const renderedCropHeight = cropHeight * renderedScale;
  const safeLeft = size.width * geometry.safeAreaInset;
  const safeTop = size.height * geometry.safeAreaInset;
  const left = safeLeft
    + (safeWidth - renderedCropWidth) / 2
    - crop.x * renderedWidth
    + geometry.translateX * size.width;
  const top = safeTop
    + (safeHeight - renderedCropHeight) / 2
    - crop.y * renderedHeight
    + geometry.translateY * size.height;

  return {
    position: 'absolute',
    left,
    top,
    width: renderedWidth,
    height: renderedHeight,
    maxWidth: 'none',
    objectFit: 'fill',
    pointerEvents: 'none',
    userSelect: 'none'
  };
}

export function SiteLogo({
  purposeId,
  fallback,
  className,
  imageClassName,
  alt = ''
}: SiteLogoProps) {
  const config = useSiteLogoConfig();
  const placement = config.placements[purposeId];
  const master = resolveMaster(config, purposeId);
  const { ref, size } = useElementSize();

  if (placement && !placement.enabled) return null;
  if (!master) return fallback;

  return (
    <span
      ref={ref}
      className={classNames('relative inline-flex shrink-0 overflow-hidden', className)}
      data-site-logo-purpose={purposeId}
      data-site-logo-master={master.id}
    >
      {size ? (
        <Image
          src={master.url}
          alt={alt}
          aria-hidden={alt ? undefined : true}
          draggable={false}
          unoptimized
          width={master.intrinsicWidth}
          height={master.intrinsicHeight}
          className={classNames('block', imageClassName)}
          style={fittedImageStyle(master, config, purposeId, size)}
        />
      ) : null}
    </span>
  );
}

function responsivePurposeForWidth(
  width: number,
  purposes: ResponsiveSiteLogoProps['purposes']
): SiteLogoPurposeId {
  if (width <= 767) return purposes.mobile;
  if (width <= 1024) return purposes.tablet;
  return purposes.desktop;
}

export function ResponsiveSiteLogo({
  purposes,
  fallback,
  className,
  purposeClassNames,
  imageClassName,
  alt
}: ResponsiveSiteLogoProps) {
  const config = useSiteLogoConfig();
  const hostRef = useRef<HTMLSpanElement>(null);
  const [purposeId, setPurposeId] = useState<SiteLogoPurposeId>(purposes.desktop);
  const usesResponsiveConfig = Object.values(purposes).some((candidate) => {
    const placement = config.placements[candidate];
    return placement?.enabled === false || Boolean(resolveMaster(config, candidate));
  });

  useLayoutEffect(() => {
    if (!usesResponsiveConfig) return undefined;
    const host = hostRef.current;
    if (!host) return undefined;
    const responsiveSurface = host.closest('footer') ?? host.parentElement;
    if (!responsiveSurface) return undefined;

    const update = () => {
      const width = responsiveSurface.clientWidth;
      if (width > 0) setPurposeId(responsivePurposeForWidth(width, purposes));
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(responsiveSurface);
    return () => observer.disconnect();
  }, [purposes, usesResponsiveConfig]);

  if (!usesResponsiveConfig) return fallback;
  const device = purposeId === purposes.mobile ? 'mobile' : purposeId === purposes.tablet ? 'tablet' : 'desktop';

  return (
    <span ref={hostRef} className="inline-flex h-full w-full min-h-0 min-w-0">
      <SiteLogo
        purposeId={purposeId}
        fallback={fallback}
        className={purposeClassNames?.[device] ?? className}
        imageClassName={imageClassName}
        alt={alt}
      />
    </span>
  );
}
