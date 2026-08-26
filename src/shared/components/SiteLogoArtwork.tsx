import Image from 'next/image';
import type { CSSProperties } from 'react';
import {
  DEFAULT_SITE_LOGO_TEXT_LAYERS,
  SITE_LOGO_BUILTIN_MASK_GEOMETRY,
  SITE_LOGO_BUILTIN_MASK_URLS,
  SITE_LOGO_TEXT_MASK_BOUNDS,
  SITE_LOGO_TAGLINE_BAND_RATIO,
  isBuiltInAtehnaLogoMaster,
  isDefaultSiteLogoPresentation,
  resolveSiteLogoCanvasLayout,
  resolveSiteLogoPresentation,
  resolveSiteLogoTransparentColors,
  usesCanonicalSiteLogoTextMask,
  type SiteLogoCanvasLayout,
  type SiteLogoMasterVariant,
  type SiteLogoPresentation,
  type SiteLogoTextLayer,
  type SiteLogoTextLayerId
} from '@/shared/domain/logo/siteLogo';

export type SiteLogoArtworkProps = {
  master: SiteLogoMasterVariant;
  presentation?: SiteLogoPresentation;
  alt?: string;
  className?: string;
  imageClassName?: string;
  style?: CSSProperties;
  effectScale?: number;
};

const classNames = (...values: Array<string | false | null | undefined>) => values.filter(Boolean).join(' ');

const layerStyle = (maskImage: string, backgroundColor: string): CSSProperties => ({
  position: 'absolute',
  inset: 0,
  backgroundColor,
  WebkitMaskImage: `url(${maskImage})`,
  maskImage: `url(${maskImage})`,
  WebkitMaskPosition: 'center',
  maskPosition: 'center',
  WebkitMaskRepeat: 'no-repeat',
  maskRepeat: 'no-repeat',
  WebkitMaskSize: '100% 100%',
  maskSize: '100% 100%'
});

const sourceFrameStyle = (layout: SiteLogoCanvasLayout): CSSProperties => ({
  position: 'absolute',
  left: `${(layout.sourceLeft / layout.width) * 100}%`,
  top: `${(layout.sourceTop / layout.height) * 100}%`,
  width: `${(layout.sourceWidth / layout.width) * 100}%`,
  height: `${(layout.sourceHeight / layout.height) * 100}%`,
  overflow: 'visible'
});

function outlineFilters(color: string, widthPx: number, effectScale = 1) {
  const width = Math.max(0, widthPx * effectScale);
  if (width === 0) return [];
  return [
    `${width}px 0 0 ${color}`,
    `${-width}px 0 0 ${color}`,
    `0 ${width}px 0 ${color}`,
    `0 ${-width}px 0 ${color}`,
    `${width * 0.707}px ${width * 0.707}px 0 ${color}`,
    `${-width * 0.707}px ${width * 0.707}px 0 ${color}`,
    `${width * 0.707}px ${-width * 0.707}px 0 ${color}`,
    `${-width * 0.707}px ${-width * 0.707}px 0 ${color}`
  ].map((shadow) => `drop-shadow(${shadow})`);
}

function colorWithOpacity(hex: string, opacity: number) {
  const red = Number.parseInt(hex.slice(1, 3), 16);
  const green = Number.parseInt(hex.slice(3, 5), 16);
  const blue = Number.parseInt(hex.slice(5, 7), 16);
  return `rgba(${red}, ${green}, ${blue}, ${Math.max(0, Math.min(1, opacity))})`;
}

function uploadedArtworkShadowFilter(presentation: SiteLogoPresentation, effectScale: number) {
  if (presentation.shadow.enabled && presentation.shadow.opacity > 0) {
    return `drop-shadow(${presentation.shadow.offsetXpx * effectScale}px ${presentation.shadow.offsetYpx * effectScale}px ${presentation.shadow.blurPx * effectScale}px ${colorWithOpacity(presentation.shadow.color, presentation.shadow.opacity)})`;
  }
  return undefined;
}

function uploadedArtworkOutlineFilters(presentation: SiteLogoPresentation, effectScale: number) {
  if (presentation.outline.enabled && presentation.outline.widthPx > 0) {
    return outlineFilters(presentation.outline.color, presentation.outline.widthPx, effectScale);
  }
  return [];
}

function transformedMaskLayerStyle(
  layerId: SiteLogoTextLayerId,
  layer: SiteLogoTextLayer,
  maskImage: string,
  color: string
): CSSProperties {
  const fallback = DEFAULT_SITE_LOGO_TEXT_LAYERS[layerId];
  const bounds = SITE_LOGO_TEXT_MASK_BOUNDS[layerId];
  const scale = layer.fontSizePx / fallback.fontSizePx;
  const anchorFactor = layer.textAlign === 'center' ? 0.5 : layer.textAlign === 'right' ? 1 : 0;
  const anchoredLeft = layer.x
    - (bounds.width * scale / SITE_LOGO_BUILTIN_MASK_GEOMETRY.width) * anchorFactor;
  const translateX = (anchoredLeft - fallback.x) * 100;
  const translateY = (layer.y - fallback.y) * 100;
  return {
    ...layerStyle(maskImage, color),
    transformOrigin: `${(bounds.x / SITE_LOGO_BUILTIN_MASK_GEOMETRY.width) * 100}% ${(bounds.y / SITE_LOGO_BUILTIN_MASK_GEOMETRY.height) * 100}%`,
    transform: `translate(${translateX}%, ${translateY}%) scale(${scale})`
  };
}

function DynamicSiteLogoTextLayer({
  layerId,
  layer,
  color,
  exposeHook
}: {
  layerId: SiteLogoTextLayerId;
  layer: SiteLogoTextLayer;
  color: string;
  exposeHook: boolean;
}) {
  return (
    <svg
      aria-hidden
      viewBox={`0 0 ${SITE_LOGO_BUILTIN_MASK_GEOMETRY.width} ${SITE_LOGO_BUILTIN_MASK_GEOMETRY.height}`}
      preserveAspectRatio="none"
      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', overflow: 'visible' }}
    >
      <text
        data-site-logo-text-layer={exposeHook ? layerId : undefined}
        x={layer.x * SITE_LOGO_BUILTIN_MASK_GEOMETRY.width}
        y={layer.y * SITE_LOGO_BUILTIN_MASK_GEOMETRY.height}
        fill={color}
        dominantBaseline="hanging"
        fontFamily={layer.fontFamily}
        fontSize={layer.fontSizePx}
        fontStyle={layer.fontStyle}
        fontWeight={layer.fontWeight}
        letterSpacing={layer.letterSpacingPx}
        textAnchor={layer.textAlign === 'center' ? 'middle' : layer.textAlign === 'right' ? 'end' : 'start'}
      >
        {layer.content}
      </text>
    </svg>
  );
}

function BuiltInSiteLogoTextLayer({
  layerId,
  layer,
  color,
  exposeHook = false
}: {
  layerId: SiteLogoTextLayerId;
  layer: SiteLogoTextLayer;
  color: string;
  exposeHook?: boolean;
}) {
  if (!layer.enabled) return null;
  if (!usesCanonicalSiteLogoTextMask(layer, layerId)) {
    return <DynamicSiteLogoTextLayer layerId={layerId} layer={layer} color={color} exposeHook={exposeHook} />;
  }
  const maskUrl = layerId === 'secondaryText'
    ? SITE_LOGO_BUILTIN_MASK_URLS.secondary
    : SITE_LOGO_BUILTIN_MASK_URLS.tagline;
  return (
    <span
      aria-hidden
      data-site-logo-text-layer={exposeHook ? layerId : undefined}
      style={transformedMaskLayerStyle(layerId, layer, maskUrl, color)}
    />
  );
}

function BuiltInArtworkLayers({
  presentation,
  uniformColor,
  exposeTextHooks = false
}: {
  presentation: SiteLogoPresentation;
  uniformColor?: string;
  exposeTextHooks?: boolean;
}) {
  const transparent = resolveSiteLogoTransparentColors(presentation.transparentColors);
  return (
    <>
      {!transparent.primary ? (
        <span aria-hidden style={layerStyle(SITE_LOGO_BUILTIN_MASK_URLS.primary, uniformColor ?? presentation.primaryTextColor)} />
      ) : null}
      {!transparent.secondary ? <BuiltInSiteLogoTextLayer
        layerId="secondaryText"
        layer={presentation.secondaryText}
        color={uniformColor ?? presentation.secondaryTextColor}
        exposeHook={exposeTextHooks}
      /> : null}
      {!transparent.tagline ? <BuiltInSiteLogoTextLayer
        layerId="taglineText"
        layer={presentation.taglineText}
        color={uniformColor ?? presentation.taglineTextColor}
        exposeHook={exposeTextHooks}
      /> : null}
    </>
  );
}

function BuiltInAtehnaArtwork({
  presentation,
  canvasLayout,
  effectScale
}: {
  presentation: SiteLogoPresentation;
  canvasLayout: SiteLogoCanvasLayout;
  effectScale: number;
}) {
  const transparent = resolveSiteLogoTransparentColors(presentation.transparentColors);
  const taglineSplit = Math.max(0, Math.min(
    1,
    (canvasLayout.sourceTop + canvasLayout.sourceHeight * SITE_LOGO_TAGLINE_BAND_RATIO) / canvasLayout.height
  ));
  const bandTop = `${taglineSplit * 100}%`;
  return (
    <>
      {!transparent.background && taglineSplit > 0 ? (
        <span aria-hidden style={{
          position: 'absolute',
          inset: `0 0 ${(1 - taglineSplit) * 100}% 0`,
          backgroundColor: presentation.backgroundColor
        }} />
      ) : null}
      {!transparent.taglineBackground && taglineSplit < 1 ? (
        <span aria-hidden style={{ position: 'absolute', inset: `${bandTop} 0 0`, backgroundColor: presentation.taglineBackgroundColor }} />
      ) : null}
      <span aria-hidden style={sourceFrameStyle(canvasLayout)}>
      {presentation.shadow.enabled && presentation.shadow.opacity > 0 ? (
        <span
          aria-hidden
          style={{
            position: 'absolute',
            inset: 0,
            opacity: presentation.shadow.opacity,
            filter: presentation.shadow.blurPx > 0 ? `blur(${presentation.shadow.blurPx * effectScale}px)` : undefined,
            transform: `translate(${presentation.shadow.offsetXpx * effectScale}px, ${presentation.shadow.offsetYpx * effectScale}px)`
          }}
        >
          <BuiltInArtworkLayers presentation={presentation} uniformColor={presentation.shadow.color} />
        </span>
      ) : null}
      {presentation.outline.enabled && presentation.outline.widthPx > 0 ? (
        outlineFilters(presentation.outline.color, presentation.outline.widthPx, effectScale).map((filter, index) => (
          <span
            key={`outline-${index}`}
            aria-hidden
            style={{ position: 'absolute', inset: 0, filter }}
          >
            <BuiltInArtworkLayers presentation={presentation} uniformColor={presentation.outline.color} />
          </span>
        ))
      ) : null}
      <BuiltInArtworkLayers presentation={presentation} exposeTextHooks />
      </span>
    </>
  );
}

function DefaultTextLayerHooks() {
  return (
    <>
      {(['secondaryText', 'taglineText'] as const).map((layerId) => {
        const layer = DEFAULT_SITE_LOGO_TEXT_LAYERS[layerId];
        const bounds = SITE_LOGO_TEXT_MASK_BOUNDS[layerId];
        return (
          <span
            key={layerId}
            aria-hidden
            data-site-logo-text-layer={layerId}
            style={{
              position: 'absolute',
              left: `${layer.x * 100}%`,
              top: `${layer.y * 100}%`,
              width: `${(bounds.width / SITE_LOGO_BUILTIN_MASK_GEOMETRY.width) * 100}%`,
              height: `${(bounds.height / SITE_LOGO_BUILTIN_MASK_GEOMETRY.height) * 100}%`,
              opacity: 0,
              pointerEvents: 'none'
            }}
          />
        );
      })}
    </>
  );
}

export function SiteLogoArtwork({
  master,
  presentation: presentationInput,
  alt = '',
  className,
  imageClassName,
  style,
  effectScale: effectScaleInput
}: SiteLogoArtworkProps) {
  const presentation = resolveSiteLogoPresentation({ presentation: presentationInput });
  const builtIn = isBuiltInAtehnaLogoMaster(master);
  const preserveOriginal = builtIn && isDefaultSiteLogoPresentation(presentation);
  const transparent = resolveSiteLogoTransparentColors(presentation.transparentColors);
  const canvasLayout = resolveSiteLogoCanvasLayout(
    master.intrinsicWidth,
    master.intrinsicHeight,
    presentation.canvasEdges
  );
  const effectScale = typeof effectScaleInput === 'number' && Number.isFinite(effectScaleInput)
    ? Math.max(0, effectScaleInput)
    : typeof style?.width === 'number'
      ? style.width / canvasLayout.width
      : typeof style?.height === 'number' ? style.height / canvasLayout.height : 1;
  const uploadedShadowEffect = builtIn ? undefined : uploadedArtworkShadowFilter(presentation, effectScale);
  const uploadedOutlineEffects = builtIn ? [] : uploadedArtworkOutlineFilters(presentation, effectScale);

  return (
    <span
      className={classNames('relative block overflow-hidden', className)}
      style={{
        backgroundColor: builtIn || transparent.background ? undefined : presentation.backgroundColor,
        ...style
      }}
      role={alt ? 'img' : undefined}
      aria-label={alt || undefined}
      aria-hidden={alt ? undefined : true}
      data-site-logo-artwork={builtIn ? 'atehna-original' : 'uploaded'}
    >
      {builtIn ? preserveOriginal ? (
        <>
          <Image
            src={master.url}
            alt=""
            aria-hidden
            draggable={false}
            unoptimized
            width={master.intrinsicWidth}
            height={master.intrinsicHeight}
            className={classNames('relative block size-full', imageClassName)}
            style={{ objectFit: 'fill' }}
          />
          <DefaultTextLayerHooks />
        </>
      ) : <BuiltInAtehnaArtwork presentation={presentation} canvasLayout={canvasLayout} effectScale={effectScale} /> : (
        <>
          {uploadedShadowEffect ? (
            <Image
              src={master.url}
              alt=""
              aria-hidden
              draggable={false}
              unoptimized
              width={master.intrinsicWidth}
              height={master.intrinsicHeight}
              className={classNames('absolute inset-0 block size-full', imageClassName)}
              style={{ ...sourceFrameStyle(canvasLayout), objectFit: 'fill', filter: uploadedShadowEffect }}
            />
          ) : null}
          {uploadedOutlineEffects.map((filter, index) => (
            <Image
              key={`outline-${index}`}
              src={master.url}
              alt={''}
              aria-hidden
              draggable={false}
              unoptimized
              width={master.intrinsicWidth}
              height={master.intrinsicHeight}
              className={classNames('absolute inset-0 block size-full', imageClassName)}
              style={{ ...sourceFrameStyle(canvasLayout), objectFit: 'fill', filter }}
            />
          ))}
          <Image
            src={master.url}
            alt=""
            aria-hidden
            draggable={false}
            unoptimized
            width={master.intrinsicWidth}
            height={master.intrinsicHeight}
            className={classNames('relative block size-full', imageClassName)}
            style={{ ...sourceFrameStyle(canvasLayout), objectFit: 'fill' }}
          />
        </>
      )}
    </span>
  );
}
