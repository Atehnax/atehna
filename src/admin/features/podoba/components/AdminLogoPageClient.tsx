'use client';

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent
} from 'react';
import { useRouter } from 'next/navigation';
import { uploadAdminPublicMedia } from '@/shared/client/publicMediaUpload';
import { validateSiteLogoFileContent } from '@/shared/client/siteLogoFileValidation';
import {
  Check,
  Eye,
  EyeOff,
  Image as ImageIcon,
  Move,
  RotateCcw,
  Save,
  ShieldCheck,
  Sparkles,
  Trash2,
  Upload,
  ZoomIn
} from 'lucide-react';
import {
  SITE_LOGO_PURPOSE_CATALOG,
  SITE_LOGO_PURPOSE_IDS,
  normalizeSiteLogoConfig,
  resolveSiteLogoGeometry,
  toStoredSiteLogoConfig,
  type SiteLogoConfig,
  type SiteLogoGeometry,
  type SiteLogoMasterKind,
  type SiteLogoMasterTone,
  type SiteLogoMasterVariant,
  type SiteLogoPlacement,
  type SiteLogoPurposeDefinition,
  type SiteLogoPurposeId
} from '@/shared/domain/logo/siteLogo';
import { AdminPageHeader } from '@/shared/ui/admin-primitives';
import { Button } from '@/shared/ui/button';
import { adminControlFocusTokenClasses, adminInputFocusTokenClasses } from '@/shared/ui/theme/tokens';
import { useToast } from '@/shared/ui/toast';
import AdminPodobaTabs from './AdminPodobaTabs';
import { AppearanceEditorNumberInput } from './AppearanceEditorToolbarPrimitives';

type MasterSlot = {
  id: string;
  label: string;
  shortLabel: string;
  description: string;
  kind: SiteLogoMasterKind;
  tone: SiteLogoMasterTone;
};

type PendingMaster = {
  file: File;
  objectUrl: string;
};

type DragState = {
  purposeId: SiteLogoPurposeId;
  startClientX: number;
  startClientY: number;
  startTranslateX: number;
  startTranslateY: number;
  frame: HTMLElement;
};

const MASTER_SLOTS: MasterSlot[] = [
  {
    id: 'full-lockup',
    label: 'Celotni podpis',
    shortLabel: 'Celotni',
    description: 'Simbol in ime v primarnem razmerju.',
    kind: 'lockup',
    tone: 'default'
  },
  {
    id: 'wordmark',
    label: 'Besedni znak',
    shortLabel: 'Wordmark',
    description: 'Ime brez samostojnega simbola.',
    kind: 'wordmark',
    tone: 'default'
  },
  {
    id: 'symbol',
    label: 'Simbol',
    shortLabel: 'Simbol',
    description: 'Kompakten znak za majhne formate.',
    kind: 'symbol',
    tone: 'default'
  },
  {
    id: 'light',
    label: 'Svetla različica',
    shortLabel: 'Svetla',
    description: 'Pripravljena različica za temne podlage.',
    kind: 'lockup',
    tone: 'light'
  },
  {
    id: 'dark',
    label: 'Temna različica',
    shortLabel: 'Temna',
    description: 'Pripravljena različica za svetle podlage.',
    kind: 'lockup',
    tone: 'dark'
  }
];

const PURPOSE_GROUPS: Array<{
  id: string;
  label: string;
  description: string;
  purposes: SiteLogoPurposeId[];
}> = [
  {
    id: 'header',
    label: 'Glava strani',
    description: 'Namizje, tablica in mobilno',
    purposes: ['header-desktop', 'header-tablet', 'header-mobile']
  },
  {
    id: 'footer',
    label: 'Noga strani',
    description: 'Odzivne različice noge',
    purposes: ['footer-desktop', 'footer-tablet', 'footer-mobile']
  },
  {
    id: 'icons',
    label: 'Ikone in aplikacija',
    description: 'Favicon, Apple in maskable',
    purposes: ['favicon', 'apple-touch-icon', 'pwa-maskable']
  },
  {
    id: 'sharing',
    label: 'Deljenje',
    description: 'Predogled povezave na omrežjih',
    purposes: ['social-share' as SiteLogoPurposeId]
  }
];

const fieldClassName = `h-8 w-full rounded-lg border border-slate-200 bg-slate-50/70 px-2.5 text-[12px] text-slate-800 transition hover:border-slate-300 hover:bg-white focus:bg-white ${adminInputFocusTokenClasses}`;

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const comparable = (config: SiteLogoConfig) => JSON.stringify(toStoredSiteLogoConfig(config));

function getMaster(config: SiteLogoConfig, masterId: string | null): SiteLogoMasterVariant | null {
  if (!masterId) return null;
  return config.masters.find((master) => master.id === masterId) ?? null;
}

function masterForSlot(config: SiteLogoConfig, slotId: string): SiteLogoMasterVariant | null {
  return config.masters.find((master) => master.id === slotId) ?? null;
}

function getPurposeDefinition(purposeId: SiteLogoPurposeId): SiteLogoPurposeDefinition {
  return SITE_LOGO_PURPOSE_CATALOG[purposeId];
}

function getPreferredMasterId(config: SiteLogoConfig, purposeId: SiteLogoPurposeId): string | null {
  const current = config.placements[purposeId]?.masterId;
  if (current && config.masters.some((master) => master.id === current)) return current;
  const preferred = purposeId === 'favicon' || purposeId === 'apple-touch-icon' || purposeId === 'pwa-maskable'
    ? 'symbol'
    : 'full-lockup';
  return config.masters.some((master) => master.id === preferred)
    ? preferred
    : config.masters[0]?.id ?? null;
}

function imagePlacementStyle(
  master: SiteLogoMasterVariant,
  purpose: SiteLogoPurposeDefinition,
  geometry: SiteLogoGeometry
): CSSProperties {
  const optical = geometry.crop;
  const inset = clamp(geometry.safeAreaInset, 0, 0.45);
  const safeWidth = purpose.widthPx * (1 - inset * 2);
  const safeHeight = purpose.heightPx * (1 - inset * 2);
  const opticalWidth = Math.max(1, master.intrinsicWidth * optical.width);
  const opticalHeight = Math.max(1, master.intrinsicHeight * optical.height);
  const containScale = Math.min(safeWidth / opticalWidth, safeHeight / opticalHeight);
  const renderedScale = containScale * geometry.scale;
  const renderedWidth = master.intrinsicWidth * renderedScale;
  const renderedHeight = master.intrinsicHeight * renderedScale;
  const opticalCenterX = (optical.x + optical.width / 2) * master.intrinsicWidth * renderedScale;
  const opticalCenterY = (optical.y + optical.height / 2) * master.intrinsicHeight * renderedScale;
  const left = purpose.widthPx / 2 - opticalCenterX + geometry.translateX * purpose.widthPx;
  const top = purpose.heightPx / 2 - opticalCenterY + geometry.translateY * purpose.heightPx;

  return {
    position: 'absolute',
    width: `${(renderedWidth / purpose.widthPx) * 100}%`,
    height: `${(renderedHeight / purpose.heightPx) * 100}%`,
    left: `${(left / purpose.widthPx) * 100}%`,
    top: `${(top / purpose.heightPx) * 100}%`,
    maxWidth: 'none',
    userSelect: 'none',
    pointerEvents: 'none'
  };
}

async function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.decoding = 'async';
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Datoteke logotipa ni mogoče prebrati.'));
    image.src = url;
  });
}

async function analyzeMasterFile(file: File, objectUrl: string) {
  const image = await loadImage(objectUrl);
  const intrinsicWidth = Math.max(1, image.naturalWidth || image.width || 1);
  const intrinsicHeight = Math.max(1, image.naturalHeight || image.height || 1);
  const maxAnalysisSide = 640;
  const analysisScale = Math.min(1, maxAnalysisSide / Math.max(intrinsicWidth, intrinsicHeight));
  const width = Math.max(1, Math.round(intrinsicWidth * analysisScale));
  const height = Math.max(1, Math.round(intrinsicHeight * analysisScale));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) throw new Error('Optične analize ni mogoče zagnati.');
  context.clearRect(0, 0, width, height);
  context.drawImage(image, 0, 0, width, height);
  const pixels = context.getImageData(0, 0, width, height).data;
  const cornerIndexes = [0, width - 1, (height - 1) * width, height * width - 1];
  const background = cornerIndexes.reduce(
    (sum, index) => {
      const offset = index * 4;
      return [sum[0] + pixels[offset], sum[1] + pixels[offset + 1], sum[2] + pixels[offset + 2], sum[3] + pixels[offset + 3]];
    },
    [0, 0, 0, 0]
  ).map((channel) => channel / cornerIndexes.length);
  let hasTransparency = false;
  for (let index = 3; index < pixels.length; index += 4) {
    if (pixels[index] < 248) {
      hasTransparency = true;
      break;
    }
  }
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const offset = (y * width + x) * 4;
      const alpha = pixels[offset + 3];
      const colourDistance = Math.sqrt(
        (pixels[offset] - background[0]) ** 2 +
        (pixels[offset + 1] - background[1]) ** 2 +
        (pixels[offset + 2] - background[2]) ** 2
      );
      const visible = hasTransparency ? alpha > 18 : alpha > 18 && colourDistance > 24;
      if (!visible) continue;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
  }
  const opticalBounds = maxX >= minX && maxY >= minY
    ? {
        x: minX / width,
        y: minY / height,
        width: Math.max(1 / width, (maxX - minX + 1) / width),
        height: Math.max(1 / height, (maxY - minY + 1) / height)
      }
    : { x: 0, y: 0, width: 1, height: 1 };

  return { intrinsicWidth, intrinsicHeight, opticalBounds };
}

function updatePlacement(
  config: SiteLogoConfig,
  purposeId: SiteLogoPurposeId,
  updater: (placement: SiteLogoPlacement) => SiteLogoPlacement
): SiteLogoConfig {
  return {
    ...config,
    placements: {
      ...config.placements,
      [purposeId]: updater(config.placements[purposeId])
    }
  };
}

function purposeBackgroundClass(purposeId: SiteLogoPurposeId, master: SiteLogoMasterVariant | null) {
  if (master?.tone === 'light') return 'bg-slate-900';
  if (purposeId.startsWith('footer')) return 'bg-slate-50';
  if (purposeId === 'social-share') return 'bg-gradient-to-br from-slate-50 to-slate-100';
  return 'bg-white';
}

function SafeAreaOverlay({ purpose, inset }: { purpose: SiteLogoPurposeDefinition; inset: number }) {
  const insetPercent = clamp(inset, 0, 0.45) * 100;
  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none absolute border border-dashed border-sky-500/80 ${purpose.safeArea === 'circle' ? 'rounded-full' : 'rounded-[6px]'}`}
      style={{ inset: `${insetPercent}%` }}
    >
      <span className="absolute -top-5 left-1/2 -translate-x-1/2 whitespace-nowrap text-[9px] font-semibold text-sky-600">
        varno območje
      </span>
    </div>
  );
}

function MasterCard({
  slot,
  master,
  isActive,
  isAnalyzing,
  onSelect,
  onUpload,
  onRemove
}: {
  slot: MasterSlot;
  master: SiteLogoMasterVariant | null;
  isActive: boolean;
  isAnalyzing: boolean;
  onSelect: () => void;
  onUpload: (event: ChangeEvent<HTMLInputElement>) => void;
  onRemove: () => void;
}) {
  return (
    <article
      className={`group relative min-w-0 overflow-hidden rounded-xl border bg-white transition ${isActive ? 'border-[color:var(--blue-300)] ring-1 ring-[color:var(--blue-100)]' : 'border-slate-200 hover:border-slate-300'}`}
      data-logo-master={slot.id}
    >
      <button type="button" onClick={onSelect} className={`block w-full text-left ${adminControlFocusTokenClasses}`}>
        <div className={`grid h-24 place-items-center overflow-hidden border-b border-slate-100 p-4 ${slot.tone === 'light' ? 'bg-slate-900' : 'bg-[linear-gradient(45deg,#f8fafc_25%,transparent_25%,transparent_75%,#f8fafc_75%),linear-gradient(45deg,#f8fafc_25%,white_25%,white_75%,#f8fafc_75%)] bg-[length:16px_16px] bg-[position:0_0,8px_8px]'}`}>
          {master ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={master.url} alt="" className="max-h-14 max-w-full object-contain" />
          ) : (
            <ImageIcon className="h-6 w-6 text-slate-300" />
          )}
        </div>
        <div className="p-3">
          <div className="flex items-center gap-2">
            <h3 className="truncate text-[12px] font-semibold text-slate-800">{slot.label}</h3>
            {master ? <Check className="ml-auto h-3.5 w-3.5 shrink-0 text-emerald-500" /> : null}
          </div>
          <p className="mt-0.5 line-clamp-2 text-[10px] leading-4 text-slate-500">{slot.description}</p>
        </div>
      </button>
      <div className="absolute right-2 top-2 flex items-center gap-1">
        {master ? (
          <button
            type="button"
            onClick={onRemove}
            title={`Odstrani ${slot.label.toLowerCase()}`}
            aria-label={`Odstrani ${slot.label.toLowerCase()}`}
            className={`grid h-7 w-7 place-items-center rounded-lg border border-slate-200 bg-white/95 text-slate-500 shadow-sm transition hover:text-rose-600 ${adminControlFocusTokenClasses}`}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        ) : null}
        <label className={`grid h-7 cursor-pointer place-items-center rounded-lg border border-slate-200 bg-white/95 px-2 text-[10px] font-semibold text-slate-600 shadow-sm transition hover:text-[color:var(--blue-600)] ${adminControlFocusTokenClasses}`}>
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp,image/svg+xml"
            className="sr-only"
            onChange={onUpload}
            disabled={isAnalyzing}
          />
          {isAnalyzing ? 'Analiza …' : master ? 'Zamenjaj' : <Upload className="h-3.5 w-3.5" />}
        </label>
      </div>
    </article>
  );
}

function PlacementCard({
  config,
  purposeId,
  active,
  showSafeArea,
  onActivate,
  onPlacementChange,
  onShowSafeAreaChange,
  onPointerDown,
  onPointerMove,
  onPointerUp
}: {
  config: SiteLogoConfig;
  purposeId: SiteLogoPurposeId;
  active: boolean;
  showSafeArea: boolean;
  onActivate: () => void;
  onPlacementChange: (placement: SiteLogoPlacement) => void;
  onShowSafeAreaChange: (show: boolean) => void;
  onPointerDown: (event: ReactPointerEvent<HTMLDivElement>) => void;
  onPointerMove: (event: ReactPointerEvent<HTMLDivElement>) => void;
  onPointerUp: (event: ReactPointerEvent<HTMLDivElement>) => void;
}) {
  const purpose = getPurposeDefinition(purposeId);
  const placement = config.placements[purposeId];
  const masterId = getPreferredMasterId(config, purposeId);
  const effectivePlacement = placement.masterId === masterId ? placement : { ...placement, masterId };
  const master = getMaster(config, effectivePlacement.masterId);
  const geometry = resolveSiteLogoGeometry(effectivePlacement);
  const isOverridden = Boolean(effectivePlacement.override);
  const masterOptions = config.masters;

  function setOverride(updates: NonNullable<SiteLogoPlacement['override']>) {
    onPlacementChange({
      ...effectivePlacement,
      override: { ...effectivePlacement.override, ...updates }
    });
  }

  return (
    <article
      className={`min-w-0 overflow-hidden rounded-xl border bg-white transition ${active ? 'border-[color:var(--blue-300)] ring-1 ring-[color:var(--blue-100)]' : 'border-slate-200 hover:border-slate-300'}`}
      data-logo-placement={purposeId}
      onFocusCapture={onActivate}
    >
      <div className="flex min-w-0 items-center gap-2 border-b border-slate-100 px-3 py-2.5">
        <button type="button" onClick={onActivate} className={`min-w-0 flex-1 text-left ${adminControlFocusTokenClasses}`}>
          <span className="block truncate text-[12px] font-semibold text-slate-800">{purpose.label}</span>
          <span className="block text-[9px] text-slate-400">{purpose.widthPx} × {purpose.heightPx} px</span>
        </button>
        <span className={`hidden items-center gap-1 rounded-full px-2 py-1 text-[9px] font-semibold sm:inline-flex ${isOverridden ? 'bg-amber-50 text-amber-700' : 'bg-sky-50 text-sky-700'}`}>
          {isOverridden ? <Move className="h-3 w-3" /> : <Sparkles className="h-3 w-3" />}
          {isOverridden ? 'Ročno' : 'Samodejno'}
        </span>
        <button
          type="button"
          aria-label={effectivePlacement.enabled ? `Skrij ${purpose.label}` : `Prikaži ${purpose.label}`}
          title={effectivePlacement.enabled ? 'Skrij to uporabo' : 'Prikaži to uporabo'}
          onClick={() => onPlacementChange({ ...effectivePlacement, enabled: !effectivePlacement.enabled })}
          className={`grid h-7 w-7 shrink-0 place-items-center rounded-lg text-slate-500 transition hover:bg-slate-100 ${adminControlFocusTokenClasses}`}
        >
          {effectivePlacement.enabled ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
        </button>
      </div>

      <div className="grid min-w-0 gap-3 p-3 min-[1250px]:grid-cols-[minmax(180px,1.2fr)_minmax(170px,0.8fr)]">
        <div className="min-w-0">
          <div className="mb-1.5 flex items-center justify-between text-[9px] text-slate-400">
            <span>Povlecite znak za premik</span>
            {!effectivePlacement.enabled ? <span className="font-semibold uppercase tracking-wide">Skrito</span> : null}
          </div>
          <div
            role="img"
            aria-label={`Predogled: ${purpose.label}`}
            tabIndex={0}
            onClick={onActivate}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
            className={`relative mx-auto w-full touch-none overflow-hidden rounded-lg border border-slate-200 ${purposeBackgroundClass(purposeId, master)} ${effectivePlacement.enabled ? 'cursor-grab active:cursor-grabbing' : 'opacity-45'} ${adminControlFocusTokenClasses}`}
            style={{ aspectRatio: `${purpose.widthPx} / ${purpose.heightPx}` }}
          >
            {master ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={master.url} alt="" draggable={false} style={imagePlacementStyle(master, purpose, geometry)} />
            ) : (
              <div className="absolute inset-0 grid place-items-center px-4 text-center">
                <div>
                  <ImageIcon className="mx-auto h-5 w-5 text-slate-300" />
                  <p className="mt-1 text-[10px] text-slate-400">Najprej naložite glavno različico.</p>
                </div>
              </div>
            )}
            {showSafeArea ? <SafeAreaOverlay purpose={purpose} inset={geometry.safeAreaInset} /> : null}
          </div>
        </div>

        <div className="grid content-start gap-2.5">
          <label className="grid gap-1">
            <span className="text-[10px] font-medium text-slate-500">Glavna različica</span>
            <select
              value={effectivePlacement.masterId ?? ''}
              disabled={masterOptions.length === 0}
              onChange={(event) => onPlacementChange({ ...effectivePlacement, masterId: event.target.value || null, override: null })}
              className={fieldClassName}
              aria-label={`Glavna različica za ${purpose.label}`}
            >
              {masterOptions.length === 0 ? <option value="">Ni naložene različice</option> : null}
              {masterOptions.map((option) => (
                <option key={option.id} value={option.id}>{option.label}</option>
              ))}
            </select>
          </label>

          <label className="grid gap-1">
            <span className="flex items-center justify-between text-[10px] font-medium text-slate-500">
              <span className="inline-flex items-center gap-1"><ZoomIn className="h-3 w-3" /> Velikost</span>
              <span>{Math.round(geometry.scale * 100)}%</span>
            </span>
            <input
              type="range"
              min={50}
              max={180}
              step={1}
              value={Math.round(geometry.scale * 100)}
              disabled={!master}
              onChange={(event) => setOverride({ scale: Number(event.target.value) / 100 })}
              className="h-5 w-full accent-[color:var(--blue-600)] disabled:opacity-40"
              aria-label={`Velikost logotipa za ${purpose.label}`}
            />
          </label>

          <div className="grid grid-cols-2 gap-2">
            <label className="grid gap-1">
              <span className="text-[10px] font-medium text-slate-500">Vodoravno</span>
              <span className="flex h-8 overflow-hidden rounded-lg border border-slate-200 bg-slate-50/70 focus-within:bg-white">
                <AppearanceEditorNumberInput
                  min={-100}
                  max={100}
                  value={Math.round(geometry.translateX * 100)}
                  disabled={!master}
                  onValueChange={(value) => setOverride({ translateX: clamp(value / 100, -1, 1) })}
                  className={`min-w-0 flex-1 border-0 bg-transparent px-2 text-[11px] ${adminInputFocusTokenClasses}`}
                  aria-label={`Vodoravni premik za ${purpose.label}`}
                />
                <span className="grid min-w-6 place-items-center text-[9px] text-slate-400">%</span>
              </span>
            </label>
            <label className="grid gap-1">
              <span className="text-[10px] font-medium text-slate-500">Navpično</span>
              <span className="flex h-8 overflow-hidden rounded-lg border border-slate-200 bg-slate-50/70 focus-within:bg-white">
                <AppearanceEditorNumberInput
                  min={-100}
                  max={100}
                  value={Math.round(geometry.translateY * 100)}
                  disabled={!master}
                  onValueChange={(value) => setOverride({ translateY: clamp(value / 100, -1, 1) })}
                  className={`min-w-0 flex-1 border-0 bg-transparent px-2 text-[11px] ${adminInputFocusTokenClasses}`}
                  aria-label={`Navpični premik za ${purpose.label}`}
                />
                <span className="grid min-w-6 place-items-center text-[9px] text-slate-400">%</span>
              </span>
            </label>
          </div>

          <div className="flex items-center gap-1.5 pt-0.5">
            <button
              type="button"
              onClick={() => onPlacementChange({ ...effectivePlacement, override: null })}
              disabled={!master || !isOverridden}
              className={`inline-flex h-8 flex-1 items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2 text-[10px] font-semibold text-slate-600 transition hover:bg-slate-50 disabled:opacity-40 ${adminControlFocusTokenClasses}`}
              title="Ponovno uporabi optično samodejno prileganje"
            >
              <Sparkles className="h-3.5 w-3.5" /> Samodejno prileganje
            </button>
            <button
              type="button"
              aria-pressed={showSafeArea}
              onClick={() => onShowSafeAreaChange(!showSafeArea)}
              className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg border transition ${adminControlFocusTokenClasses} ${showSafeArea ? 'border-sky-200 bg-sky-50 text-sky-600' : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50'}`}
              title="Prikaži ali skrij varno območje"
              aria-label={`Varno območje za ${purpose.label}`}
            >
              <ShieldCheck className="h-3.5 w-3.5" />
            </button>
          </div>

          {showSafeArea ? (
            <label className="grid gap-1">
              <span className="flex items-center justify-between text-[10px] font-medium text-slate-500">
                <span>Notranji varni odmik</span>
                <span>{Math.round(geometry.safeAreaInset * 100)}%</span>
              </span>
              <input
                type="range"
                min={0}
                max={30}
                step={1}
                value={Math.round(geometry.safeAreaInset * 100)}
                onChange={(event) => setOverride({ safeAreaInset: Number(event.target.value) / 100 })}
                className="h-5 w-full accent-[color:var(--blue-600)]"
                aria-label={`Varni odmik za ${purpose.label}`}
              />
            </label>
          ) : null}
        </div>
      </div>
    </article>
  );
}

export default function AdminLogoPageClient({ initialConfig }: { initialConfig: SiteLogoConfig }) {
  const router = useRouter();
  const { toast } = useToast();
  const normalizedInitial = useMemo(() => normalizeSiteLogoConfig(initialConfig), [initialConfig]);
  const [config, setConfig] = useState(normalizedInitial);
  const [savedConfig, setSavedConfig] = useState(normalizedInitial);
  const [activeGroup, setActiveGroup] = useState('header');
  const [activePurposeId, setActivePurposeId] = useState<SiteLogoPurposeId>('header-desktop');
  const [activeMasterId, setActiveMasterId] = useState<string | null>(null);
  const [safeAreaVisibility, setSafeAreaVisibility] = useState<Partial<Record<SiteLogoPurposeId, boolean>>>({
    favicon: true,
    'apple-touch-icon': true,
    'pwa-maskable': true
  });
  const [isSaving, setIsSaving] = useState(false);
  const [analyzingMasterId, setAnalyzingMasterId] = useState<string | null>(null);
  const pendingMastersRef = useRef(new Map<string, PendingMaster>());
  const dragStateRef = useRef<DragState | null>(null);
  const isDirty = comparable(config) !== comparable(savedConfig);
  const visiblePurposes = useMemo(
    () => PURPOSE_GROUPS.find((group) => group.id === activeGroup)?.purposes.filter((purposeId) => purposeId in config.placements) ?? SITE_LOGO_PURPOSE_IDS,
    [activeGroup, config.placements]
  );

  useEffect(() => {
    const pendingMasters = pendingMastersRef.current;
    return () => {
      for (const pending of pendingMasters.values()) URL.revokeObjectURL(pending.objectUrl);
      pendingMasters.clear();
    };
  }, []);

  useEffect(() => {
    const warnBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!isDirty) return;
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', warnBeforeUnload);
    return () => window.removeEventListener('beforeunload', warnBeforeUnload);
  }, [isDirty]);

  function applyPlacement(purposeId: SiteLogoPurposeId, placement: SiteLogoPlacement) {
    setConfig((current) => updatePlacement(current, purposeId, () => placement));
  }

  function removeMaster(slotId: string) {
    const pending = pendingMastersRef.current.get(slotId);
    if (pending) URL.revokeObjectURL(pending.objectUrl);
    pendingMastersRef.current.delete(slotId);
    setConfig((current) => ({
      ...current,
      masters: current.masters.filter((master) => master.id !== slotId),
      placements: Object.fromEntries(SITE_LOGO_PURPOSE_IDS.map((purposeId) => {
        const placement = current.placements[purposeId];
        return [purposeId, placement.masterId === slotId ? { ...placement, masterId: null, override: null } : placement];
      })) as SiteLogoConfig['placements']
    }));
  }

  async function stageMaster(slot: MasterSlot, event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (!['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'].includes(file.type)) {
      toast.error('Dovoljene so datoteke PNG, JPEG, WebP in SVG.');
      return;
    }
    if (file.size <= 0 || file.size > 10 * 1024 * 1024) {
      toast.error('Datoteka logotipa je večja od 10 MB.');
      return;
    }

    const previousPending = pendingMastersRef.current.get(slot.id);
    if (previousPending) URL.revokeObjectURL(previousPending.objectUrl);
    const objectUrl = URL.createObjectURL(file);
    setAnalyzingMasterId(slot.id);
    try {
      await validateSiteLogoFileContent(file);
      const analysis = await analyzeMasterFile(file, objectUrl);
      pendingMastersRef.current.set(slot.id, { file, objectUrl });
      setConfig((current) => {
        const isFirstMaster = current.masters.length === 0;
        const nextMaster: SiteLogoMasterVariant = {
          id: slot.id,
          label: slot.label,
          kind: slot.kind,
          tone: slot.tone,
          url: objectUrl,
          pathname: `pending/${slot.id}`,
          filename: file.name,
          mimeType: file.type as SiteLogoMasterVariant['mimeType'],
          size: file.size,
          intrinsicWidth: analysis.intrinsicWidth,
          intrinsicHeight: analysis.intrinsicHeight,
          opticalBounds: analysis.opticalBounds
        };
        const alreadyExists = current.masters.some((master) => master.id === slot.id);
        const masters = alreadyExists
          ? current.masters.map((master) => master.id === slot.id ? nextMaster : master)
          : [...current.masters, nextMaster];
        const placements = Object.fromEntries(SITE_LOGO_PURPOSE_IDS.map((purposeId) => {
          const placement = current.placements[purposeId];
          const wantsSymbol = purposeId === 'favicon' || purposeId === 'apple-touch-icon' || purposeId === 'pwa-maskable';
          const shouldAssign = !placement.masterId && (
            isFirstMaster ||
            (wantsSymbol && slot.id === 'symbol') ||
            (!wantsSymbol && slot.id === 'full-lockup')
          );
          const usesThisMaster = placement.masterId === slot.id || shouldAssign;
          return [purposeId, usesThisMaster ? {
            ...placement,
            masterId: slot.id,
            suggestion: {
              ...placement.suggestion,
              scale: 1,
              translateX: 0,
              translateY: 0,
              crop: analysis.opticalBounds,
              algorithmVersion: 'optical-fit-v1'
            },
            override: null
          } : placement];
        })) as SiteLogoConfig['placements'];
        return { ...current, masters, placements };
      });
      setActiveMasterId(slot.id);
      toast.success('Logotip je optično analiziran. Spremembe še niso shranjene.');
    } catch (error) {
      URL.revokeObjectURL(objectUrl);
      toast.error(error instanceof Error ? error.message : 'Analiza logotipa ni uspela.');
    } finally {
      setAnalyzingMasterId(null);
    }
  }

  function beginDrag(purposeId: SiteLogoPurposeId, event: ReactPointerEvent<HTMLDivElement>) {
    const placement = config.placements[purposeId];
    const masterId = getPreferredMasterId(config, purposeId);
    if (!getMaster(config, masterId)) return;
    const geometry = resolveSiteLogoGeometry(placement.masterId === masterId ? placement : { ...placement, masterId });
    event.currentTarget.setPointerCapture(event.pointerId);
    dragStateRef.current = {
      purposeId,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startTranslateX: geometry.translateX,
      startTranslateY: geometry.translateY,
      frame: event.currentTarget
    };
    setActivePurposeId(purposeId);
  }

  function moveDrag(event: ReactPointerEvent<HTMLDivElement>) {
    const drag = dragStateRef.current;
    if (!drag) return;
    const rect = drag.frame.getBoundingClientRect();
    const translateX = clamp(drag.startTranslateX + (event.clientX - drag.startClientX) / Math.max(1, rect.width), -1, 1);
    const translateY = clamp(drag.startTranslateY + (event.clientY - drag.startClientY) / Math.max(1, rect.height), -1, 1);
    setConfig((current) => updatePlacement(current, drag.purposeId, (placement) => ({
      ...placement,
      masterId: getPreferredMasterId(current, drag.purposeId),
      override: { ...placement.override, translateX, translateY }
    })));
  }

  function endDrag(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    dragStateRef.current = null;
  }

  async function save() {
    if (!isDirty || isSaving) return;
    setIsSaving(true);
    try {
      let nextConfig = config;
      for (const [masterId, pending] of pendingMastersRef.current.entries()) {
        const stagedMaster = nextConfig.masters.find((master) => master.id === masterId);
        if (!stagedMaster) continue;
        const uploaded = await uploadAdminPublicMedia(pending.file, {
          scope: 'site-logo',
          masterId
        });
        nextConfig = {
          ...nextConfig,
          masters: nextConfig.masters.map((master) => master.id === masterId ? {
            ...master,
            url: uploaded.url,
            pathname: uploaded.pathname,
            filename: uploaded.filename,
            mimeType: uploaded.contentType as SiteLogoMasterVariant['mimeType'],
            size: uploaded.size
          } : master)
        };
      }

      const response = await fetch('/api/admin/site-logo', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ config: toStoredSiteLogoConfig(nextConfig) })
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(typeof body.message === 'string' ? body.message : 'Shranjevanje logotipov ni uspelo.');
      const persisted = normalizeSiteLogoConfig(body.config ?? nextConfig);
      for (const pending of pendingMastersRef.current.values()) URL.revokeObjectURL(pending.objectUrl);
      pendingMastersRef.current.clear();
      setConfig(persisted);
      setSavedConfig(persisted);
      toast.success('Različice in mesta uporabe logotipa so shranjeni.');
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Shranjevanje logotipov ni uspelo.');
    } finally {
      setIsSaving(false);
    }
  }

  function resetUnsaved() {
    for (const pending of pendingMastersRef.current.values()) URL.revokeObjectURL(pending.objectUrl);
    pendingMastersRef.current.clear();
    setConfig(savedConfig);
    setActiveMasterId(null);
  }

  return (
    <div className="space-y-5">
      <AdminPageHeader
        title="Logotip"
        description="Upravljajte glavne različice in optično prileganje za vsako mesto uporabe posebej."
        actions={
          <div className="flex items-center gap-2">
            <span className="mr-1 inline-flex items-center gap-1.5 text-[11px] font-medium text-slate-500" aria-live="polite">
              <span className={`h-1.5 w-1.5 rounded-full ${isDirty ? 'bg-amber-500' : 'bg-emerald-500'}`} />
              {isDirty ? 'Neshranjeno' : 'Objavljeno'}
            </span>
            <button
              type="button"
              onClick={resetUnsaved}
              disabled={!isDirty || isSaving}
              aria-label="Zavrzi neshranjene spremembe"
              title="Zavrzi neshranjene spremembe"
              className={`grid h-8 w-8 place-items-center rounded-lg text-slate-500 transition hover:bg-slate-100 disabled:opacity-40 ${adminControlFocusTokenClasses}`}
            >
              <RotateCcw className="h-4 w-4" />
            </button>
            <Button type="button" variant="primary" size="toolbar" onClick={save} disabled={!isDirty || isSaving} className="gap-2">
              <Save className="h-4 w-4" /> {isSaving ? 'Shranjujem …' : 'Shrani'}
            </Button>
          </div>
        }
      />
      <AdminPodobaTabs />

      <div className="grid min-w-0 gap-4 min-[980px]:grid-cols-[220px_minmax(0,1fr)]">
        <aside className="min-w-0 self-start overflow-hidden rounded-xl border border-slate-200 bg-white min-[980px]:sticky min-[980px]:top-5" data-testid="logo-purpose-catalogue">
          <div className="border-b border-slate-200 px-3 py-2.5">
            <h2 className="text-[12px] font-semibold text-slate-800">Mesta uporabe</h2>
            <p className="mt-0.5 text-[10px] leading-4 text-slate-500">Vsak izhod hrani svoj izrez in položaj.</p>
          </div>
          <div className="grid gap-1 p-2" role="tablist" aria-label="Katalog mest uporabe" aria-orientation="vertical">
            {PURPOSE_GROUPS.filter((group) => group.purposes.some((purposeId) => purposeId in config.placements)).map((group) => {
              const isActive = group.id === activeGroup;
              return (
                <button
                  key={group.id}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  onClick={() => {
                    setActiveGroup(group.id);
                    const firstPurpose = group.purposes.find((purposeId) => purposeId in config.placements);
                    if (firstPurpose) setActivePurposeId(firstPurpose);
                    setActiveMasterId(null);
                  }}
                  className={`rounded-lg border px-2.5 py-2 text-left transition ${adminControlFocusTokenClasses} ${isActive ? 'border-[color:var(--blue-100)] bg-[color:var(--blue-50)] text-[color:var(--blue-700)]' : 'border-transparent text-slate-700 hover:bg-slate-50 hover:text-slate-950'}`}
                >
                  <span className="block text-[11px] font-semibold leading-4">{group.label}</span>
                  <span className={`mt-0.5 block text-[9px] leading-3.5 ${isActive ? 'text-[color:var(--blue-600)]/75' : 'text-slate-400'}`}>{group.description}</span>
                </button>
              );
            })}
          </div>
          <div className="border-t border-slate-100 px-3 py-2.5">
            <p className="text-[9px] font-semibold uppercase tracking-[0.1em] text-slate-400">Način dela</p>
            <ul className="mt-2 grid gap-2 text-[9px] leading-4 text-slate-500">
              <li className="flex gap-2"><Sparkles className="mt-0.5 h-3 w-3 shrink-0 text-sky-500" /> Samodejni predlog temelji na vidnih mejah znaka.</li>
              <li className="flex gap-2"><Move className="mt-0.5 h-3 w-3 shrink-0 text-slate-400" /> Ročni premiki veljajo samo za izbrani izhod.</li>
              <li className="flex gap-2"><ShieldCheck className="mt-0.5 h-3 w-3 shrink-0 text-slate-400" /> Izvirna datoteka vedno ostane nespremenjena.</li>
            </ul>
          </div>
        </aside>

        <main className="min-w-0 space-y-4">
          <section className="overflow-hidden rounded-xl border border-slate-200 bg-white" data-testid="logo-master-variants">
            <div className="flex flex-wrap items-start justify-between gap-2 border-b border-slate-200 px-4 py-3">
              <div>
                <p className="text-[9px] font-semibold uppercase tracking-[0.1em] text-[color:var(--blue-600)]">Glavne različice</p>
                <h2 className="mt-0.5 text-[15px] font-semibold text-slate-900">Knjižnica izvirnikov</h2>
                <p className="mt-0.5 text-[10px] leading-4 text-slate-500">Različice so samo organizirane po vlogi; videza tukaj ne spreminjamo.</p>
              </div>
              <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[9px] font-medium text-slate-500">{config.masters.length} / {MASTER_SLOTS.length} naloženih</span>
            </div>
            <div className="grid gap-3 bg-slate-50/50 p-3 sm:grid-cols-2 min-[1180px]:grid-cols-5">
              {MASTER_SLOTS.map((slot) => (
                <MasterCard
                  key={slot.id}
                  slot={slot}
                  master={masterForSlot(config, slot.id)}
                  isActive={activeMasterId === slot.id}
                  isAnalyzing={analyzingMasterId === slot.id}
                  onSelect={() => setActiveMasterId(slot.id)}
                  onUpload={(event) => void stageMaster(slot, event)}
                  onRemove={() => removeMaster(slot.id)}
                />
              ))}
            </div>
          </section>

          <section className="overflow-hidden rounded-xl border border-slate-200 bg-white" data-testid="logo-output-cards">
            <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 px-4 py-3">
              <div>
                <p className="text-[9px] font-semibold uppercase tracking-[0.1em] text-[color:var(--blue-600)]">Neodvisni izhodi</p>
                <h2 className="mt-0.5 text-[15px] font-semibold text-slate-900">{PURPOSE_GROUPS.find((group) => group.id === activeGroup)?.label}</h2>
                <p className="mt-0.5 text-[10px] leading-4 text-slate-500">Povlecite znak neposredno v predogledu ali uporabite natančne vrednosti.</p>
              </div>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-sky-50 px-2.5 py-1 text-[9px] font-semibold text-sky-700">
                <Sparkles className="h-3 w-3" /> Optično samodejno prileganje
              </span>
            </div>
            <div className="grid min-w-0 gap-3 bg-slate-50/50 p-3 min-[1120px]:grid-cols-2">
              {visiblePurposes.map((purposeId) => (
                <PlacementCard
                  key={purposeId}
                  config={config}
                  purposeId={purposeId}
                  active={activePurposeId === purposeId}
                  showSafeArea={safeAreaVisibility[purposeId] ?? false}
                  onActivate={() => {
                    setActivePurposeId(purposeId);
                    setActiveMasterId(null);
                  }}
                  onPlacementChange={(placement) => applyPlacement(purposeId, placement)}
                  onShowSafeAreaChange={(show) => setSafeAreaVisibility((current) => ({ ...current, [purposeId]: show }))}
                  onPointerDown={(event) => beginDrag(purposeId, event)}
                  onPointerMove={moveDrag}
                  onPointerUp={endDrag}
                />
              ))}
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}
