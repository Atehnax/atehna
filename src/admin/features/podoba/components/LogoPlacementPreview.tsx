'use client';

import Link from 'next/link';
import { createPortal } from 'react-dom';
import { useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import SiteHeader from '@/commercial/components/SiteHeader';
import SiteFooter from '@/commercial/components/SiteFooter';
import { SiteLogo, SiteLogoProvider } from '@/commercial/components/SiteLogo';
import { COMMERCIAL_STOREFRONT_SCALE } from '@/commercial/components/commercialStorefrontScale';
import { LOGO_PLACEMENT_LABELS, type LogoBounds, type LogoPlacementId, type LogoProject, type LogoSourceAsset, type PublishedLogoAsset, type PublishedSiteLogoConfig } from '@/shared/domain/logo/logoLibrary';
import { logoPlacementGuidance } from '../lib/logoPlacementGuidance';
import { resolveHeaderLogoSize } from '@/shared/domain/logo/logoPlacement';
import { normalizeSiteNavigationConfig, type SiteNavigationConfig, type SiteNavigationTopBarDevice } from '@/shared/domain/navigation/siteNavigation';

export type LogoPlacementPreviewProps = {
  published: PublishedSiteLogoConfig;
  navigation: SiteNavigationConfig;
  purpose: LogoPlacementId;
  draftAsset?: PublishedLogoAsset | null;
  project?: LogoProject;
  assets?: LogoSourceAsset[];
  width?: number;
  onTrimToContent?: () => void;
  onFitToPlacement?: (area: { width: number; height: number }) => void;
};
type Measurement = { area: LogoBounds; artwork: LogoBounds; image: LogoBounds; sourceScale: number };
const dimension = (value: number) => new Intl.NumberFormat('sl-SI', { maximumFractionDigits: 1 }).format(value);

export default function LogoPlacementPreview({ published, navigation, purpose, draftAsset, project, assets = [], width, onTrimToContent, onFitToPlacement }: LogoPlacementPreviewProps) {
  const device: SiteNavigationTopBarDevice = purpose.endsWith('-mobile') ? 'mobile' : purpose.endsWith('-tablet') ? 'tablet' : 'desktop';
  const header = purpose.startsWith('header-');
  const footer = purpose.startsWith('footer-');
  const viewportWidth = width ?? ({ desktop: 1440, tablet: 768, mobile: 390 }[device]);
  const normalized = useMemo(() => normalizeSiteNavigationConfig(navigation), [navigation]);
  const asset = draftAsset === undefined ? published.placements[purpose] : draftAsset;
  const config = useMemo(() => draftAsset === undefined ? published
    : { ...published, placements: { ...published.placements, [purpose]: draftAsset } }, [draftAsset, published, purpose]);
  const constraints = resolveHeaderLogoSize(device, normalized.topBarLayout.responsive[device], asset);
  const outer = useRef<HTMLDivElement>(null);
  const frame = useRef<HTMLDivElement>(null);
  const content = useRef<HTMLDivElement>(null);
  const [previewDocument, setPreviewDocument] = useState<Document | null>(null);
  const [previewScale, setPreviewScale] = useState(1);
  const [height, setHeight] = useState(header ? normalized.topBarLayout.responsive[device].settings.height * COMMERCIAL_STOREFRONT_SCALE : 220);
  const [measurement, setMeasurement] = useState<Measurement | null>(null);
  const [overlays, setOverlays] = useState(true);
  const [background, setBackground] = useState<'placement' | 'light' | 'dark'>('placement');

  useLayoutEffect(() => {
    const target = outer.current;
    if (!target) return;
    const update = () => setPreviewScale(Math.min(1, Math.max(0.1, target.clientWidth / viewportWidth)));
    update();
    const observer = new ResizeObserver(update); observer.observe(target);
    return () => observer.disconnect();
  }, [viewportWidth]);

  useLayoutEffect(() => {
    if (!previewDocument || !outer.current) return;
    const sourceDocument = outer.current.ownerDocument;
    const copyStyles = () => {
      previewDocument.head.querySelectorAll('[data-preview-style]').forEach(node => node.remove());
      for (const original of sourceDocument.head.querySelectorAll('style, link[rel="stylesheet"]')) {
        const clone = original.cloneNode(true) as HTMLElement;
        clone.setAttribute('data-preview-style', '');
        if (original instanceof HTMLLinkElement) (clone as HTMLLinkElement).href = original.href;
        previewDocument.head.appendChild(clone);
      }
      previewDocument.documentElement.className = sourceDocument.documentElement.className;
      for (const element of [previewDocument.documentElement, previewDocument.body]) {
        element.style.margin = '0'; element.style.padding = '0';
        element.style.overflow = 'hidden'; element.style.scrollbarGutter = 'auto';
      }
      const computed = getComputedStyle(outer.current!);
      for (const key of Array.from(computed)) if (key.startsWith('--'))
        previewDocument.documentElement.style.setProperty(key, computed.getPropertyValue(key));
    };
    copyStyles();
    const observer = new MutationObserver(copyStyles);
    observer.observe(sourceDocument.head, { childList: true, subtree: true, characterData: true });
    return () => observer.disconnect();
  }, [previewDocument]);

  useLayoutEffect(() => {
    const root = frame.current;
    const body = content.current;
    if (!root || !body || !previewDocument) return;
    const scale = COMMERCIAL_STOREFRONT_SCALE * previewScale;
    let pending = 0;
    const update = () => {
      cancelAnimationFrame(pending);
      pending = requestAnimationFrame(() => {
        const logicalHeight = header ? normalized.topBarLayout.responsive[device].settings.height : body.scrollHeight;
        setHeight(Math.max(1, logicalHeight * scale));
        const logo = body.querySelector<HTMLElement>('[data-site-logo-purpose="' + purpose + '"]');
        if (!asset || !logo) { setMeasurement(null); return; }
        const local = logo.getBoundingClientRect();
        const rect = { left: local.left * previewScale, top: local.top * previewScale, width: local.width * previewScale, height: local.height * previewScale };
        const origin = { left: 0, top: 0 };
        const fittedScale = Math.min(rect.width / asset.width, rect.height / asset.height);
        const image = {
          x: rect.left - origin.left + (rect.width - asset.width * fittedScale) / 2,
          y: rect.top - origin.top + (rect.height - asset.height * fittedScale) / 2,
          width: asset.width * fittedScale, height: asset.height * fittedScale
        };
        const area = header ? {
          x: rect.left - origin.left,
          y: rect.top - origin.top + rect.height / 2 - constraints.areaHeightPx * previewScale / 2,
          width: constraints.areaWidthPx * previewScale, height: constraints.areaHeightPx * previewScale
        } : { x: rect.left - origin.left, y: rect.top - origin.top, width: rect.width, height: rect.height };
        const next = { area, image, sourceScale: fittedScale / previewScale, artwork: {
          x: image.x + asset.bounds.x * fittedScale, y: image.y + asset.bounds.y * fittedScale,
          width: asset.bounds.width * fittedScale, height: asset.bounds.height * fittedScale
        } };
        setMeasurement(previous => JSON.stringify(previous) === JSON.stringify(next) ? previous : next);
      });
    };
    update();
    const observer = new ResizeObserver(update); observer.observe(body);
    body.addEventListener('load', update, true);
    void previewDocument.fonts.ready.then(update);
    return () => { cancelAnimationFrame(pending); observer.disconnect(); body.removeEventListener('load', update, true); };
  }, [asset, constraints.areaHeightPx, constraints.areaWidthPx, device, header, normalized, previewDocument, previewScale, purpose, viewportWidth]);

  const whitespace = asset ? 1 - Math.min(1, asset.bounds.width * asset.bounds.height / (asset.width * asset.height)) : 0;
  const guidance = project && measurement ? logoPlacementGuidance(project, assets, measurement.sourceScale) : null;
  const tinyText = guidance?.tinyText ?? false;
  const rasterUpscaled = guidance?.rasterUpscaled ?? Boolean(asset && !asset.svgUrl && measurement && measurement.sourceScale > 1.01);
  const viewportStyle = {
    width: viewportWidth / COMMERCIAL_STOREFRONT_SCALE,
    transform: 'scale(' + COMMERCIAL_STOREFRONT_SCALE + ')',
    transformOrigin: 'top left',
    '--commercial-storefront-scale': String(COMMERCIAL_STOREFRONT_SCALE),
    ...(background !== 'placement' ? {
      '--site-color-surface': background === 'dark' ? '#111827' : '#ffffff',
      '--site-color-text': background === 'dark' ? '#f8fafc' : '#111827'
    } : {})
  } as CSSProperties;
  const borderStyle = (bounds: LogoBounds): CSSProperties => ({ left: bounds.x, top: bounds.y, width: bounds.width, height: bounds.height });

  return <section className="min-w-0 space-y-3" aria-label={'Predogled uporabe · ' + LOGO_PLACEMENT_LABELS[purpose]}>
    <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
      <span className="font-semibold text-slate-800">{LOGO_PLACEMENT_LABELS[purpose]} · {viewportWidth}px</span>
      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-1"><input type="checkbox" checked={overlays} onChange={event => setOverlays(event.target.checked)} />Meje in varni rob</label>
        <label className="flex items-center gap-1">Ozadje
          <select value={background} onChange={event => setBackground(event.target.value as typeof background)} className="h-7 rounded border border-slate-300 bg-white px-2">
            <option value="placement">Dejanska uporaba</option><option value="light">Svetlo</option><option value="dark">Temno</option>
          </select>
        </label>
      </div>
    </div>
    <div ref={outer} className="flex min-w-0 justify-center overflow-hidden">
      <div ref={frame} className="relative overflow-hidden rounded-lg" style={{ width: viewportWidth * previewScale, height, background: background === 'dark' ? '#111827' : '#fff' }} data-logo-context-preview={purpose}>
        <iframe
          title={'Dejanski prikaz · ' + LOGO_PLACEMENT_LABELS[purpose]}
          className="absolute left-0 top-0 border-0"
          style={{ width: viewportWidth, height: height / previewScale, transform: 'scale(' + previewScale + ')', transformOrigin: 'top left' }}
          srcDoc={'<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>html,body{margin:0;padding:0;overflow:hidden}body{background:transparent}</style></head><body></body></html>'}
          onLoad={event => setPreviewDocument(event.currentTarget.contentDocument)}
        />
        {previewDocument && createPortal(<div ref={content} className="absolute left-0 top-0" style={viewportStyle}
          onClickCapture={event => { if ((event.target as Element).closest?.('a')) event.preventDefault(); }}
          onSubmitCapture={event => { event.preventDefault(); event.stopPropagation(); }}>
          <SiteLogoProvider config={config} previewDevice={device}>
            {header ? <SiteHeader
              navigation={background === 'placement' ? normalized : { ...normalized, topBarLayout: { ...normalized.topBarLayout, responsive: {
                ...normalized.topBarLayout.responsive, [device]: { ...normalized.topBarLayout.responsive[device], settings: {
                  ...normalized.topBarLayout.responsive[device].settings, backgroundColor: background === 'dark' ? '#111827' : '#ffffff', backgroundOpacityPercent: 100
                } }
              } } }}
              previewMode="inline" previewDevice={device} previewViewportWidth={viewportWidth / COMMERCIAL_STOREFRONT_SCALE}
            /> : footer ? <SiteFooter settings={normalized.footer} editorAdapter={{ forceVisible: true, editorMode: false, showHidden: false, showEmpty: false }} />
              : <div className="flex min-h-48 items-center justify-center p-6">
                <SiteLogo purposeId={purpose} alt="Atehna" className="h-36 w-96 max-w-full" />
              </div>}
          </SiteLogoProvider>
        </div>, previewDocument.body)}
        {overlays && measurement && <div className="pointer-events-none absolute inset-0" aria-hidden="true">
          <div className="absolute border border-dashed border-blue-500" style={borderStyle(measurement.area)} data-logo-available-area />
          <div className="absolute border border-emerald-500" style={borderStyle(measurement.artwork)} data-logo-visible-bounds />
          <div className="absolute border border-dotted border-amber-500" style={borderStyle({
            x: measurement.area.x + measurement.area.width * .05, y: measurement.area.y + measurement.area.height * .05,
            width: measurement.area.width * .9, height: measurement.area.height * .9
          })} />
        </div>}
        <div className="pointer-events-none absolute inset-0 rounded-lg border border-slate-200" aria-hidden="true" />
      </div>
    </div>
    <div className="space-y-1 text-[11px] leading-relaxed text-slate-600" aria-live="polite">
      {measurement && <p>Platno v uporabi: {dimension(measurement.image.width / previewScale)} × {dimension(measurement.image.height / previewScale)} CSS px.
        {' '}Vidna vsebina: {dimension(measurement.artwork.width / previewScale)} × {dimension(measurement.artwork.height / previewScale)} CSS px.
        {' '}Razpoložljivi prostor: {dimension(measurement.area.width / previewScale)} × {dimension(measurement.area.height / previewScale)} CSS px.</p>}
      {overlays && <p>Modro: prostor uporabe · zeleno: vidna vsebina · pikčasto: priporočeni 5-odstotni varni rob.</p>}
      {whitespace > .35 && <p className="text-amber-800">Logotip vsebuje veliko praznega roba. Obreži na vsebino, če rob ni nameren.</p>}
      {tinyText && <p className="text-amber-800">Drobno besedilo bo pri tej velikosti težko berljivo.</p>}
      {rasterUpscaled && <p className="text-amber-800">Logotip se povečuje nad izvorno ločljivost.</p>}
      {guidance?.embeddedRasterSvg && <p className="text-amber-800">SVG vsebuje rastrske slike. Pri povečavi preverite ostrino.</p>}
      {asset?.fallback === 'brand' && <p>Prikazana je obstoječa besedilna znamka Atehna.</p>}
      {!asset && <p>Ta uporaba je brez logotipa.</p>}
      {purpose === 'pdf-document' && <p>Postavitev na dokumentu določa <Link href="/admin/urejevalnik" className="text-blue-700 underline">urejevalnik dokumentov</Link>.</p>}
    </div>
    <div className="flex flex-wrap gap-3 text-xs">
      {onTrimToContent && <button type="button" onClick={onTrimToContent} className="text-blue-700 underline">Obreži na vsebino</button>}
      {onFitToPlacement && <button type="button" disabled={!measurement} onClick={() => measurement && onFitToPlacement({ width: measurement.area.width / previewScale, height: measurement.area.height / previewScale })} className="text-blue-700 underline disabled:opacity-40">Prilagodi prostoru</button>}
      {(header || footer) && <Link href="/admin/podoba/navigacija" className="text-blue-700 underline">Odpri nastavitve navigacije</Link>}
    </div>
  </section>;
}
