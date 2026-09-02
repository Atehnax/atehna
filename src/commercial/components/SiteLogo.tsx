'use client';

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
  isSiteLogoHeaderPurpose,
  normalizeSiteLogoConfig,
  resolveSiteLogoCanvasLayout,
  resolveSiteLogoCropClipPath,
  resolveSiteLogoFittedArtworkRect,
  resolveSiteLogoGeometry,
  resolveSiteLogoMaster,
  resolveSiteLogoPresentation,
  type SiteLogoConfig,
  type SiteLogoMasterVariant,
  type SiteLogoPresentation,
  type SiteLogoPurposeId
} from '@/shared/domain/logo/siteLogo';
import { SiteLogoArtwork } from '@/shared/components/SiteLogoArtwork';

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
  style?: CSSProperties;
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
  return resolveSiteLogoMaster(config, purposeId);
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
  size: RenderSize,
  presentation: SiteLogoPresentation
): CSSProperties {
  const geometry = resolveSiteLogoGeometry(config.placements[purposeId]);
  const canvasLayout = resolveSiteLogoCanvasLayout(
    master.intrinsicWidth,
    master.intrinsicHeight,
    presentation.canvasEdges
  );
  const placement = config.placements[purposeId];
  const artworkScale = isSiteLogoHeaderPurpose(purposeId) && placement.displayHeightPx != null
    ? 1
    : geometry.scale;
  const fitted = resolveSiteLogoFittedArtworkRect({
    sourceWidth: canvasLayout.width,
    sourceHeight: canvasLayout.height,
    viewportWidth: size.width,
    viewportHeight: size.height,
    geometry,
    fitMode: placement.fitMode,
    artworkScale
  });

  return {
    position: 'absolute',
    left: fitted.left,
    top: fitted.top,
    width: fitted.width,
    height: fitted.height,
    maxWidth: 'none',
    objectFit: 'fill',
    clipPath: resolveSiteLogoCropClipPath(geometry.crop),
    WebkitClipPath: resolveSiteLogoCropClipPath(geometry.crop),
    pointerEvents: 'none',
    userSelect: 'none'
  };
}

export function SiteLogo({
  purposeId,
  fallback,
  className,
  imageClassName,
  alt = '',
  style
}: SiteLogoProps) {
  const config = useSiteLogoConfig();
  const placement = config.placements[purposeId];
  const master = resolveMaster(config, purposeId);
  const presentation = resolveSiteLogoPresentation(placement);
  const { ref, size } = useElementSize();

  if (placement && !placement.enabled) return null;
  if (!master) return fallback;

  return (
    <span
      ref={ref}
      className={classNames('relative inline-flex shrink-0 overflow-hidden', className)}
      style={style}
      data-site-logo-purpose={purposeId}
      data-site-logo-master={master.id}
    >
      {size ? (
        <SiteLogoArtwork
          master={master}
          presentation={presentation}
          alt={alt}
          imageClassName={imageClassName}
          style={fittedImageStyle(master, config, purposeId, size, presentation)}
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
  alt,
  style
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
        style={style}
      />
    </span>
  );
}
