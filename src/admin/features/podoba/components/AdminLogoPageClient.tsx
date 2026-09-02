'use client';

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent
} from 'react';
import { useRouter } from 'next/navigation';
import { uploadAdminPublicMedia } from '@/shared/client/publicMediaUpload';
import { validateSiteLogoFileContent } from '@/shared/client/siteLogoFileValidation';
import {
  Check,
  Copy,
  Crop,
  Eye,
  EyeOff,
  FileText,
  Image as ImageIcon,
  Library,
  Move,
  MoreHorizontal,
  Palette,
  PanelBottom,
  PanelTop,
  RotateCcw,
  Save,
  Settings2,
  ShieldCheck,
  Sparkles,
  Trash2,
  Type,
  Upload,
  X,
  ZoomIn
} from 'lucide-react';
import {
  DEFAULT_SITE_LOGO_TEXT_LAYERS,
  SITE_LOGO_BUILTIN_ORIGINAL_MASTER,
  SITE_LOGO_BUILTIN_ORIGINAL_MASTER_ID,
  SITE_LOGO_BUILTIN_MASK_GEOMETRY,
  SITE_LOGO_CANVAS_EDGE_IDS,
  SITE_LOGO_CANVAS_EDGE_MAX,
  SITE_LOGO_CANVAS_EDGE_MIN,
  SITE_LOGO_HEADER_DISPLAY_HEIGHT_MAX_PX,
  SITE_LOGO_HEADER_DISPLAY_HEIGHT_MIN_PX,
  SITE_LOGO_PRIMARY_USE_CASE_IDS,
  SITE_LOGO_PURPOSE_CATALOG,
  SITE_LOGO_PURPOSE_IDS,
  SITE_LOGO_TEXT_LAYER_IDS,
  SITE_LOGO_TEXT_MASK_BOUNDS,
  SITE_LOGO_TEXT_POSITION_MAX,
  SITE_LOGO_TEXT_POSITION_MIN,
  SITE_LOGO_USE_CASE_PURPOSE_IDS,
  copySiteLogoPlacement,
  deriveSiteLogoFitSuggestion,
  getSiteLogoPresentationCapabilities,
  isBuiltInAtehnaLogoMaster,
  isSiteLogoHeaderPurpose,
  mapSiteLogoCanvasDeltaToSource,
  mapSiteLogoSourcePointToCanvas,
  normalizeSiteLogoConfig,
  resolveSiteLogoCanvasEdges,
  resolveSiteLogoCanvasLayout,
  resolveSiteLogoCropClipPath,
  resolveSiteLogoFittedArtworkRect,
  resolveSiteLogoGeometry,
  resolveSiteLogoDisplaySize,
  resolveSiteLogoMaster,
  resolveSiteLogoPresentation,
  resolveSiteLogoTransparentColors,
  resetSiteLogoTextLayer,
  suggestSiteLogoPlacement,
  toStoredSiteLogoConfig,
  updateSiteLogoTextLayer,
  updateSiteLogoCanvasEdges,
  updateSiteLogoColorTransparency,
  usesCanonicalSiteLogoTextMask,
  type SiteLogoConfig,
  type SiteLogoCanvasEdgeId,
  type SiteLogoCanvasLayout,
  type SiteLogoColorChannelId,
  type SiteLogoGeometry,
  type SiteLogoMasterKind,
  type SiteLogoMasterTone,
  type SiteLogoMasterVariant,
  type SiteLogoPlacement,
  type SiteLogoPresentation,
  type SiteLogoPrimaryUseCaseId,
  type SiteLogoPurposeDefinition,
  type SiteLogoPurposeId,
  type SiteLogoTextLayerId
} from '@/shared/domain/logo/siteLogo';
import { SiteLogoArtwork } from '@/shared/components/SiteLogoArtwork';
import { CompactHexColorField } from '@/shared/ui/admin-controls/CompactHexColorField';
import { AdminPageHeader } from '@/shared/ui/admin-primitives';
import { Button } from '@/shared/ui/button';
import { adminControlFocusTokenClasses } from '@/shared/ui/theme/tokens';
import { useToast } from '@/shared/ui/toast';
import AdminPodobaTabs from './AdminPodobaTabs';
import {
  SITE_LOGO_TEXT_LAYER_META,
  SiteLogoTextLayerFields,
  SiteLogoTextLayerManager
} from './SiteLogoTextLayerControls';
import {
  AppearanceEditorCompactSelect,
  AppearanceEditorNumberInput,
  AppearanceEditorToolbarButton,
  AppearanceEditorToolbarDivider,
  AppearanceEditorToolbarPopover,
  AppearanceEditorToolbarToneProvider,
  FloatingAppearanceEditorContextToolbar
} from './AppearanceEditorToolbarPrimitives';

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

type LogoEditMode = 'move' | 'resize' | 'crop';
type LogoResizeHandle = 'nw' | 'ne' | 'se' | 'sw';
type LogoCropHandle = LogoResizeHandle | 'n' | 'e' | 's' | 'w';

type LogoResizeDragState = {
  purposeId: SiteLogoPurposeId;
  handle: LogoResizeHandle;
  startClientX: number;
  startClientY: number;
  startScale: number;
  startDisplayHeightPx: number | null;
  frameWidth: number;
  frameHeight: number;
};

type LogoCropDragState = {
  purposeId: SiteLogoPurposeId;
  handle: LogoCropHandle;
  startClientX: number;
  startClientY: number;
  startCrop: SiteLogoGeometry['crop'];
  frameWidth: number;
  frameHeight: number;
};

const LOGO_RESIZE_HANDLES: readonly LogoResizeHandle[] = ['nw', 'ne', 'se', 'sw'];
const LOGO_CROP_HANDLES: readonly LogoCropHandle[] = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];
const LOGO_CROP_MIN_SIZE = 0.04;
const LOGO_EDITOR_SCALE_MIN = 0.25;
const LOGO_EDITOR_SCALE_MAX = 4;

function normalizeEditorCrop(crop: SiteLogoGeometry['crop']): SiteLogoGeometry['crop'] {
  const x = clamp(crop.x, 0, 1 - LOGO_CROP_MIN_SIZE);
  const y = clamp(crop.y, 0, 1 - LOGO_CROP_MIN_SIZE);
  const width = clamp(crop.width, LOGO_CROP_MIN_SIZE, 1 - x);
  const height = clamp(crop.height, LOGO_CROP_MIN_SIZE, 1 - y);
  return { x, y, width, height };
}

function cropFromPointerDelta(
  start: SiteLogoGeometry['crop'],
  handle: LogoCropHandle,
  deltaX: number,
  deltaY: number
): SiteLogoGeometry['crop'] {
  let left = start.x;
  let top = start.y;
  let right = start.x + start.width;
  let bottom = start.y + start.height;
  if (handle.includes('w')) left = clamp(start.x + deltaX, 0, right - LOGO_CROP_MIN_SIZE);
  if (handle.includes('e')) right = clamp(right + deltaX, left + LOGO_CROP_MIN_SIZE, 1);
  if (handle.includes('n')) top = clamp(start.y + deltaY, 0, bottom - LOGO_CROP_MIN_SIZE);
  if (handle.includes('s')) bottom = clamp(bottom + deltaY, top + LOGO_CROP_MIN_SIZE, 1);
  return normalizeEditorCrop({
    x: left,
    y: top,
    width: right - left,
    height: bottom - top
  });
}
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

type LogoUseCaseSelection = SiteLogoPrimaryUseCaseId | 'other';

const PRIMARY_USE_CASE_META: Record<
  SiteLogoPrimaryUseCaseId,
  { label: string; description: string }
> = {
  header: { label: 'Glava', description: 'Logotip v navigaciji na vseh napravah.' },
  footer: { label: 'Noga', description: 'Logotip na koncu strani.' },
  standalone: { label: 'Samostojno', description: 'Logotip brez okoliške postavitve.' },
  documents: { label: 'Dokumenti', description: 'Barvni logotip za PDF dokumente.' }
};

type TextLayerDragState = {
  purposeId: SiteLogoPurposeId;
  layerId: SiteLogoTextLayerId;
  startClientX: number;
  startClientY: number;
  startX: number;
  startY: number;
  frame: HTMLElement;
  layout: SiteLogoCanvasLayout;
};

const OTHER_LOGO_PURPOSE_IDS: SiteLogoPurposeId[] = [
  'favicon',
  'apple-touch-icon',
  'pwa-maskable',
  'social-share'
];

const LOGO_CANVAS_EDGE_LABELS: Record<SiteLogoCanvasEdgeId, string> = {
  top: 'Zgoraj',
  right: 'Desno',
  bottom: 'Spodaj',
  left: 'Levo'
};

const LOGO_PLACEMENT_PRESETS = [
  { id: 'top-left', label: 'Zgoraj levo', x: -0.25, y: -0.25 },
  { id: 'top-center', label: 'Zgoraj na sredini', x: 0, y: -0.25 },
  { id: 'top-right', label: 'Zgoraj desno', x: 0.25, y: -0.25 },
  { id: 'center-left', label: 'Na sredini levo', x: -0.25, y: 0 },
  { id: 'center', label: 'Na sredini', x: 0, y: 0 },
  { id: 'center-right', label: 'Na sredini desno', x: 0.25, y: 0 },
  { id: 'bottom-left', label: 'Spodaj levo', x: -0.25, y: 0.25 },
  { id: 'bottom-center', label: 'Spodaj na sredini', x: 0, y: 0.25 },
  { id: 'bottom-right', label: 'Spodaj desno', x: 0.25, y: 0.25 }
] as const;

function LogoUseCaseIcon({ id, className = 'h-4 w-4' }: { id: LogoUseCaseSelection; className?: string }) {
  if (id === 'header') return <PanelTop className={className} />;
  if (id === 'footer') return <PanelBottom className={className} />;
  if (id === 'documents') return <FileText className={className} />;
  if (id === 'standalone') return <ImageIcon className={className} />;
  return <MoreHorizontal className={className} />;
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const comparable = (config: SiteLogoConfig) => JSON.stringify(toStoredSiteLogoConfig(config));

function getMaster(config: SiteLogoConfig, masterId: string | null): SiteLogoMasterVariant | null {
  if (!masterId) return null;
  if (isBuiltInAtehnaLogoMaster(masterId)) return SITE_LOGO_BUILTIN_ORIGINAL_MASTER;
  return config.masters.find((master) => master.id === masterId) ?? null;
}

function masterForSlot(config: SiteLogoConfig, slotId: string): SiteLogoMasterVariant | null {
  return config.masters.find((master) => master.id === slotId) ?? null;
}

function getPurposeDefinition(purposeId: SiteLogoPurposeId): SiteLogoPurposeDefinition {
  return SITE_LOGO_PURPOSE_CATALOG[purposeId];
}

function getPreferredMasterId(config: SiteLogoConfig, purposeId: SiteLogoPurposeId): string | null {
  const placement = config.placements[purposeId];
  const current = placement?.masterId;
  if (current === null) return null;
  if (current && getMaster(config, current)) return current;
  const preferred = purposeId === 'favicon' || purposeId === 'apple-touch-icon' || purposeId === 'pwa-maskable'
    ? 'symbol'
    : 'full-lockup';
  if (config.masters.some((master) => master.id === preferred)) return preferred;
  if (purposeId.startsWith('header-') || purposeId.startsWith('footer-') || purposeId === 'standalone' || purposeId === 'pdf-document') {
    return SITE_LOGO_BUILTIN_ORIGINAL_MASTER_ID;
  }
  return config.masters[0]?.id ?? null;
}

function imagePlacementStyle(
  master: SiteLogoMasterVariant,
  purpose: SiteLogoPurposeDefinition,
  geometry: SiteLogoGeometry,
  presentation: SiteLogoPresentation,
  fitMode: SiteLogoPlacement['fitMode'] = 'contain'
): CSSProperties {
  const canvas = resolveSiteLogoCanvasLayout(
    master.intrinsicWidth,
    master.intrinsicHeight,
    presentation.canvasEdges
  );
  const fitted = resolveSiteLogoFittedArtworkRect({
    sourceWidth: canvas.width,
    sourceHeight: canvas.height,
    viewportWidth: purpose.widthPx,
    viewportHeight: purpose.heightPx,
    geometry,
    fitMode,
    artworkScale: geometry.scale
  });

  return {
    position: 'absolute',
    width: `${(fitted.width / purpose.widthPx) * 100}%`,
    height: `${(fitted.height / purpose.heightPx) * 100}%`,
    left: `${(fitted.left / purpose.widthPx) * 100}%`,
    top: `${(fitted.top / purpose.heightPx) * 100}%`,
    maxWidth: 'none',
    clipPath: resolveSiteLogoCropClipPath(geometry.crop),
    WebkitClipPath: resolveSiteLogoCropClipPath(geometry.crop),
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

function MeasuredSiteLogoArtwork({
  master,
  presentation,
  style,
  alt
}: {
  master: SiteLogoMasterVariant;
  presentation: SiteLogoPresentation;
  style: CSSProperties;
  alt: string;
}) {
  const frameRef = useRef<HTMLSpanElement | null>(null);
  const [effectScale, setEffectScale] = useState(1);
  const canvasLayout = useMemo(
    () => resolveSiteLogoCanvasLayout(master.intrinsicWidth, master.intrinsicHeight, presentation.canvasEdges),
    [master.intrinsicHeight, master.intrinsicWidth, presentation.canvasEdges]
  );

  useEffect(() => {
    const frame = frameRef.current;
    if (!frame) return;
    const measure = () => {
      const rect = frame.getBoundingClientRect();
      const nextScale = Math.min(
        rect.width / Math.max(1, canvasLayout.width),
        rect.height / Math.max(1, canvasLayout.height)
      );
      if (Number.isFinite(nextScale) && nextScale >= 0) {
        setEffectScale((current) => Math.abs(current - nextScale) > 0.0001 ? nextScale : current);
      }
    };
    measure();
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure);
    observer?.observe(frame);
    window.addEventListener('resize', measure);
    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, [canvasLayout.height, canvasLayout.width]);

  return (
    <span ref={frameRef} style={{ ...style, display: 'block' }} data-logo-measured-artwork>
      <SiteLogoArtwork
        master={master}
        presentation={presentation}
        alt={alt}
        className="select-none"
        effectScale={effectScale}
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', maxWidth: 'none' }}
      />
    </span>
  );
}

function resolveSelectedSiteLogoMasterId(
  purposeId: SiteLogoPurposeId,
  placement: SiteLogoPlacement,
  selectedMasterId: string | null
) {
  if (selectedMasterId) return selectedMasterId;
  return isSiteLogoHeaderPurpose(purposeId) && placement.displayHeightPx != null
    ? SITE_LOGO_BUILTIN_ORIGINAL_MASTER_ID
    : null;
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
      className={`group flex min-w-0 items-center gap-1.5 rounded-lg border p-1.5 transition ${isActive ? 'border-blue-300/55 bg-blue-400/15' : 'border-white/10 bg-white/5 hover:bg-white/10'}`}
      data-logo-master={slot.id}
    >
      <button type="button" onClick={onSelect} className={`flex min-w-0 flex-1 items-center gap-2 rounded-md p-1 text-left ${adminControlFocusTokenClasses}`}>
        <span className={`grid h-10 w-16 shrink-0 place-items-center overflow-hidden rounded-md p-1.5 ${slot.tone === 'light' ? 'bg-slate-950' : 'bg-slate-700'}`}>
          {master ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={master.url} alt="" className="max-h-full max-w-full object-contain" />
          ) : (
            <ImageIcon className="h-4 w-4 text-white/25" />
          )}
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1.5">
            <span className="truncate text-[10px] font-semibold text-white/85">{slot.label}</span>
            {master ? <Check className="h-3 w-3 shrink-0 text-emerald-300" /> : null}
          </span>
          <span className="block truncate text-[10px] text-white/45">{master ? master.filename : 'Ni naloženo'}</span>
        </span>
      </button>
      <div className="flex shrink-0 items-center gap-0.5">
        {master ? (
          <button
            type="button"
            onClick={onRemove}
            title={`Odstrani ${slot.label.toLowerCase()}`}
            aria-label={`Odstrani ${slot.label.toLowerCase()}`}
            className={`grid h-7 w-7 place-items-center rounded-md text-white/45 transition hover:bg-rose-500/15 hover:text-rose-200 ${adminControlFocusTokenClasses}`}
          >
            <Trash2 className="h-3 w-3" />
          </button>
        ) : null}
        <label className={`grid h-7 cursor-pointer place-items-center rounded-md px-2 text-[10px] font-semibold text-white/60 transition hover:bg-white/10 hover:text-white ${adminControlFocusTokenClasses}`} title={master ? 'Zamenjaj datoteko' : 'Naloži datoteko'}>
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

type LogoToolbarPanel = 'masters' | 'fit' | 'text' | 'appearance' | 'sync' | null;

function CompactLogoRangeField({
  label,
  value,
  marker,
  min,
  max,
  step = 1,
  unit = '',
  onChange
}: {
  label: string;
  value: number;
  marker: string;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  onChange: (value: number) => void;
}) {
  return (
    <label className="grid gap-1 rounded-lg border border-white/10 bg-white/5 px-2 py-1.5" data-logo-presentation-control={marker}>
      <span className="flex items-center justify-between gap-3 text-[10px] font-medium text-white/70">
        <span>{label}</span>
        <span className="font-mono text-[10px] text-white/45">{value}{unit}</span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="h-4 w-full accent-blue-400"
        aria-label={label}
      />
    </label>
  );
}

function LogoColorChannelField({
  label,
  value,
  marker,
  channel,
  transparent,
  onColorChange,
  onTransparencyChange
}: {
  label: string;
  value: string;
  marker: string;
  channel: SiteLogoColorChannelId;
  transparent: boolean;
  onColorChange: (value: string) => void;
  onTransparencyChange: (transparent: boolean) => void;
}) {
  return (
    <div
      className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-stretch gap-1.5"
      data-logo-color-channel={channel}
    >
      <CompactHexColorField label={label} value={value} marker={marker} onChange={onColorChange} />
      <button
        type="button"
        aria-pressed={transparent}
        aria-label={`${label}: ${transparent ? 'uporabi barvo' : 'nastavi prosojno'}`}
        title={transparent ? 'Uporabi izbrano barvo' : 'Nastavi prosojno'}
        data-logo-color-transparency={channel}
        onClick={() => onTransparencyChange(!transparent)}
        className={`grid min-w-16 place-items-center gap-0.5 rounded-lg border px-1.5 py-1 text-[10px] font-semibold transition ${adminControlFocusTokenClasses} ${
          transparent
            ? 'border-blue-300/60 bg-blue-400/20 text-blue-100'
            : 'border-white/10 bg-white/5 text-white/50 hover:bg-white/10 hover:text-white/80'
        }`}
      >
        <span
          aria-hidden="true"
          className="h-3.5 w-3.5 rounded border border-white/20"
          style={{ backgroundImage: 'conic-gradient(#cbd5e1 25%, #475569 0 50%, #cbd5e1 0 75%, #475569 0)' , backgroundSize: '6px 6px' }}
        />
        Prosojno
      </button>
    </div>
  );
}

function LogoTextLayerTargets({
  purposeId,
  master,
  presentation,
  artworkStyle,
  selectedLayerId,
  onSelect,
  onPointerDown,
  onPointerMove,
  onPointerUp
}: {
  purposeId: SiteLogoPurposeId;
  master: SiteLogoMasterVariant;
  presentation: SiteLogoPresentation;
  artworkStyle: CSSProperties;
  selectedLayerId: SiteLogoTextLayerId | null;
  onSelect: (layerId: SiteLogoTextLayerId) => void;
  onPointerDown: (layerId: SiteLogoTextLayerId, event: ReactPointerEvent<HTMLButtonElement>) => void;
  onPointerMove: (event: ReactPointerEvent<HTMLButtonElement>) => void;
  onPointerUp: (event: ReactPointerEvent<HTMLButtonElement>) => void;
}) {
  const canvasLayout = resolveSiteLogoCanvasLayout(
    master.intrinsicWidth,
    master.intrinsicHeight,
    presentation.canvasEdges
  );
  const sourceOrigin = mapSiteLogoSourcePointToCanvas(canvasLayout, { x: 0, y: 0 });
  const sourceEnd = mapSiteLogoSourcePointToCanvas(canvasLayout, { x: 1, y: 1 });
  const sourceFrameWidth = Math.max(Number.EPSILON, sourceEnd.x - sourceOrigin.x);
  const sourceFrameHeight = Math.max(Number.EPSILON, sourceEnd.y - sourceOrigin.y);

  return (
    <span
      data-logo-text-target-layer
      style={{ ...artworkStyle, pointerEvents: 'none', overflow: 'hidden' }}
    >
      <span
        data-logo-text-source-frame
        style={{
          position: 'absolute',
          left: `${sourceOrigin.x * 100}%`,
          top: `${sourceOrigin.y * 100}%`,
          width: `${sourceFrameWidth * 100}%`,
          height: `${sourceFrameHeight * 100}%`,
          pointerEvents: 'none',
          overflow: 'visible'
        }}
      >
        {SITE_LOGO_TEXT_LAYER_IDS.map((layerId) => {
          const layer = presentation[layerId];
          if (!layer.enabled) return null;
          const fallback = DEFAULT_SITE_LOGO_TEXT_LAYERS[layerId];
          const bounds = SITE_LOGO_TEXT_MASK_BOUNDS[layerId];
          const fontScale = layer.fontSizePx / fallback.fontSizePx;
          const canonicalWidth = bounds.width * fontScale;
          const dynamicWidth = Math.max(
            layer.fontSizePx,
            layer.content.length * layer.fontSizePx * 0.58
              + Math.max(0, layer.content.length - 1) * layer.letterSpacingPx
          );
          const width = usesCanonicalSiteLogoTextMask(layer, layerId) ? canonicalWidth : dynamicWidth;
          const height = usesCanonicalSiteLogoTextMask(layer, layerId)
            ? bounds.height * fontScale
            : layer.fontSizePx * 1.18;
          const normalizedWidth = Math.max(22, width) / SITE_LOGO_BUILTIN_MASK_GEOMETRY.width;
          const anchorShift = layer.textAlign === 'center'
            ? normalizedWidth / 2
            : layer.textAlign === 'right'
              ? normalizedWidth
              : 0;
          const anchoredSourcePoint = { x: layer.x - anchorShift, y: layer.y };
          const anchoredCanvasPoint = mapSiteLogoSourcePointToCanvas(canvasLayout, anchoredSourcePoint);
          const mappedLeft = (anchoredCanvasPoint.x - sourceOrigin.x) / sourceFrameWidth;
          const mappedTop = (anchoredCanvasPoint.y - sourceOrigin.y) / sourceFrameHeight;
          const selected = selectedLayerId === layerId;
          const meta = SITE_LOGO_TEXT_LAYER_META[layerId];
          return (
            <button
              key={layerId}
              type="button"
              data-logo-text-layer={layerId}
              data-logo-text-anchor={layer.textAlign}
              data-canvas-element-id={`${purposeId}:${layerId}`}
              data-canvas-element-selected={selected || undefined}
              aria-label={`Uredi: ${meta.label}`}
              onClick={(event) => {
                event.stopPropagation();
                onSelect(layerId);
              }}
              onPointerDown={(event) => {
                event.stopPropagation();
                onPointerDown(layerId, event);
              }}
              onPointerMove={(event) => {
                event.stopPropagation();
                onPointerMove(event);
              }}
              onPointerUp={(event) => {
                event.stopPropagation();
                onPointerUp(event);
              }}
              onPointerCancel={(event) => {
                event.stopPropagation();
                onPointerUp(event);
              }}
              className={`absolute touch-none rounded-[3px] border transition-[border-color,background-color,box-shadow] ${
                selected
                  ? 'border-blue-500 bg-blue-400/10 shadow-[0_0_0_2px_rgba(255,255,255,0.9)]'
                  : 'border-transparent hover:border-blue-400/80 hover:bg-blue-400/5'
              }`}
              style={{
                left: `${mappedLeft * 100}%`,
                top: `${mappedTop * 100}%`,
                width: `${normalizedWidth * 100}%`,
                height: `${(Math.max(22, height) / SITE_LOGO_BUILTIN_MASK_GEOMETRY.height) * 100}%`,
                minWidth: '10px',
                minHeight: '8px',
                pointerEvents: 'auto'
              }}
            >
              {selected ? (
                <span className="pointer-events-none absolute -top-5 left-0 whitespace-nowrap rounded bg-blue-600 px-1.5 py-0.5 text-[8px] font-semibold leading-3 text-white shadow">
                  {meta.label}
                </span>
              ) : null}
            </button>
          );
        })}
      </span>
    </span>
  );
}

function logoTransformHandleClass(handle: LogoCropHandle) {
  if (handle === 'n') return '-top-1.5 left-1/2 -translate-x-1/2 cursor-ns-resize';
  if (handle === 'e') return '-right-1.5 top-1/2 -translate-y-1/2 cursor-ew-resize';
  if (handle === 's') return '-bottom-1.5 left-1/2 -translate-x-1/2 cursor-ns-resize';
  if (handle === 'w') return '-left-1.5 top-1/2 -translate-y-1/2 cursor-ew-resize';
  if (handle === 'nw') return '-left-1.5 -top-1.5 cursor-nwse-resize';
  if (handle === 'ne') return '-right-1.5 -top-1.5 cursor-nesw-resize';
  if (handle === 'se') return '-bottom-1.5 -right-1.5 cursor-nwse-resize';
  return '-bottom-1.5 -left-1.5 cursor-nesw-resize';
}

function LogoTransformOverlay({
  artworkStyle,
  crop,
  mode,
  onResizePointerDown,
  onResizePointerMove,
  onResizePointerUp,
  onResizeKeyboard,
  onCropPointerDown,
  onCropPointerMove,
  onCropPointerUp,
  onCropKeyboard
}: {
  artworkStyle: CSSProperties;
  crop: SiteLogoGeometry['crop'];
  mode: Exclude<LogoEditMode, 'move'>;
  onResizePointerDown: (handle: LogoResizeHandle, event: ReactPointerEvent<HTMLButtonElement>) => void;
  onResizePointerMove: (event: ReactPointerEvent<HTMLButtonElement>) => void;
  onResizePointerUp: (event: ReactPointerEvent<HTMLButtonElement>) => void;
  onResizeKeyboard: (direction: -1 | 1) => void;
  onCropPointerDown: (handle: LogoCropHandle, event: ReactPointerEvent<HTMLButtonElement>) => void;
  onCropPointerMove: (event: ReactPointerEvent<HTMLButtonElement>) => void;
  onCropPointerUp: (event: ReactPointerEvent<HTMLButtonElement>) => void;
  onCropKeyboard: (handle: LogoCropHandle, deltaX: number, deltaY: number) => void;
}) {
  const normalizedCrop = normalizeEditorCrop(crop);
  const handles = mode === 'resize' ? LOGO_RESIZE_HANDLES : LOGO_CROP_HANDLES;
  return (
    <>
      {mode === 'crop' ? (
        <span
          data-logo-crop-shade
          className="pointer-events-none absolute inset-0 overflow-hidden"
          style={{ borderRadius: 'inherit' }}
        >
          <span
            style={{
              ...artworkStyle,
              overflow: 'visible',
              clipPath: 'none',
              WebkitClipPath: 'none'
            }}
          >
            <span
              style={{
                position: 'absolute',
                left: `${normalizedCrop.x * 100}%`,
                top: `${normalizedCrop.y * 100}%`,
                width: `${normalizedCrop.width * 100}%`,
                height: `${normalizedCrop.height * 100}%`,
                boxShadow: '0 0 0 9999px rgba(15, 23, 42, 0.28)'
              }}
            />
          </span>
        </span>
      ) : null}
    <span
      data-logo-editable-artwork-frame
      data-logo-edit-mode={mode}
      style={{
        ...artworkStyle,
        overflow: 'visible',
        clipPath: 'none',
        WebkitClipPath: 'none',
        pointerEvents: 'none'
      }}
    >
      <span
        data-logo-transform-bounds
        style={{
          position: 'absolute',
          left: `${normalizedCrop.x * 100}%`,
          top: `${normalizedCrop.y * 100}%`,
          width: `${normalizedCrop.width * 100}%`,
          height: `${normalizedCrop.height * 100}%`,
          pointerEvents: 'none'
        }}
        className={mode === 'crop' ? 'border border-dashed border-blue-300' : 'border border-blue-500'}
      >
        <span className="pointer-events-none absolute -top-6 left-0 rounded bg-blue-600 px-1.5 py-0.5 text-[9px] font-semibold text-white shadow-sm">
          {mode === 'crop' ? 'Izrez' : 'Velikost'}
        </span>
        {handles.map((handle) => (
          <button
            key={handle}
            type="button"
            data-logo-transform-handle={handle}
            data-logo-resize-handle={mode === 'resize' ? handle : undefined}
            data-logo-crop-handle={mode === 'crop' ? handle : undefined}
            aria-label={mode === 'crop' ? `Prilagodi izrez: ${handle}` : `Spremeni velikost: ${handle}`}
            title={mode === 'crop' ? 'Povlecite rob izreza' : 'Povlecite za spremembo velikosti'}
            className={`absolute z-20 h-3 w-3 rounded-sm border border-white bg-blue-500 shadow-[0_1px_4px_rgba(15,23,42,0.35)] ${logoTransformHandleClass(handle)} ${adminControlFocusTokenClasses}`}
            style={{ pointerEvents: 'auto' }}
            onClick={(event) => event.stopPropagation()}
            onPointerDown={(event) => {
              event.preventDefault();
              event.stopPropagation();
              if (mode === 'resize') onResizePointerDown(handle as LogoResizeHandle, event);
              else onCropPointerDown(handle, event);
            }}
            onPointerMove={(event) => {
              event.stopPropagation();
              if (mode === 'resize') onResizePointerMove(event);
              else onCropPointerMove(event);
            }}
            onPointerUp={(event) => {
              event.stopPropagation();
              if (mode === 'resize') onResizePointerUp(event);
              else onCropPointerUp(event);
            }}
            onPointerCancel={(event) => {
              event.stopPropagation();
              if (mode === 'resize') onResizePointerUp(event);
              else onCropPointerUp(event);
            }}
            onKeyDown={(event) => {
              const step = event.shiftKey ? 0.05 : 0.01;
              if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return;
              event.preventDefault();
              event.stopPropagation();
              if (mode === 'resize') {
                onResizeKeyboard(event.key === 'ArrowRight' || event.key === 'ArrowUp' ? 1 : -1);
              } else {
                onCropKeyboard(
                  handle,
                  event.key === 'ArrowLeft' ? -step : event.key === 'ArrowRight' ? step : 0,
                  event.key === 'ArrowUp' ? -step : event.key === 'ArrowDown' ? step : 0
                );
              }
            }}
          />
        ))}
      </span>
    </span>
    </>
  );
}
function LogoUseCasePreview({
  config,
  purposeId,
  showSafeArea,
  active,
  editMode,
  selectedTextLayerId,
  onActivate,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onResizePointerDown,
  onResizePointerMove,
  onResizePointerUp,
  onResizeKeyboard,
  onCropPointerDown,
  onCropPointerMove,
  onCropPointerUp,
  onCropKeyboard,
  onSelectTextLayer,
  onTextPointerDown,
  onTextPointerMove,
  onTextPointerUp
}: {
  config: SiteLogoConfig;
  purposeId: SiteLogoPurposeId;
  showSafeArea: boolean;
  active: boolean;
  editMode: LogoEditMode;
  selectedTextLayerId: SiteLogoTextLayerId | null;
  onActivate: () => void;
  onPointerDown: (event: ReactPointerEvent<HTMLDivElement>) => void;
  onPointerMove: (event: ReactPointerEvent<HTMLDivElement>) => void;
  onPointerUp: (event: ReactPointerEvent<HTMLDivElement>) => void;
  onResizePointerDown: (handle: LogoResizeHandle, event: ReactPointerEvent<HTMLButtonElement>) => void;
  onResizePointerMove: (event: ReactPointerEvent<HTMLButtonElement>) => void;
  onResizePointerUp: (event: ReactPointerEvent<HTMLButtonElement>) => void;
  onResizeKeyboard: (direction: -1 | 1) => void;
  onCropPointerDown: (handle: LogoCropHandle, event: ReactPointerEvent<HTMLButtonElement>) => void;
  onCropPointerMove: (event: ReactPointerEvent<HTMLButtonElement>) => void;
  onCropPointerUp: (event: ReactPointerEvent<HTMLButtonElement>) => void;
  onCropKeyboard: (handle: LogoCropHandle, deltaX: number, deltaY: number) => void;
  onSelectTextLayer: (layerId: SiteLogoTextLayerId) => void;
  onTextPointerDown: (layerId: SiteLogoTextLayerId, event: ReactPointerEvent<HTMLButtonElement>) => void;
  onTextPointerMove: (event: ReactPointerEvent<HTMLButtonElement>) => void;
  onTextPointerUp: (event: ReactPointerEvent<HTMLButtonElement>) => void;
}) {
  const purpose = getPurposeDefinition(purposeId);
  const placement = config.placements[purposeId];
  const masterId = getPreferredMasterId(config, purposeId);
  const effectivePlacement = placement.masterId === masterId ? placement : { ...placement, masterId };
  const previewConfig = placement === effectivePlacement
    ? config
    : updatePlacement(config, purposeId, () => effectivePlacement);
  const master = resolveSiteLogoMaster(previewConfig, purposeId);
  const geometry = resolveSiteLogoGeometry(effectivePlacement);
  const displaySize = resolveSiteLogoDisplaySize(purposeId, effectivePlacement);
  const previewGeometry = displaySize?.explicit ? { ...geometry, scale: 1 } : geometry;
  const manuallyAdjusted = Boolean(effectivePlacement.override) || Boolean(displaySize?.explicit);
  const presentation = resolveSiteLogoPresentation(effectivePlacement);
  const capabilities = getSiteLogoPresentationCapabilities(master);
  const headerArtworkStyle = master && displaySize
    ? imagePlacementStyle(
        master,
        { ...purpose, widthPx: displaySize.widthPx, heightPx: displaySize.heightPx },
        previewGeometry,
        presentation,
        effectivePlacement.fitMode
      )
    : null;
  const artworkStyle = master && !displaySize
    ? imagePlacementStyle(master, purpose, previewGeometry, presentation, effectivePlacement.fitMode)
    : null;

  return (
    <div
      className="relative mx-auto w-full"
      style={{ maxWidth: purpose.group === 'icon' ? '320px' : '880px' }}
      data-logo-use-case-preview
      data-logo-use-case={purposeId}
      data-logo-placement={purposeId}
      data-canvas-element-id={purposeId}
      data-canvas-element-selected={active || undefined}
    >
      <div className="mb-2 flex items-center justify-between gap-3 text-[10px] text-slate-500">
        <span>{displaySize ? `Višina: ${displaySize.heightPx} px` : `${purpose.widthPx} × ${purpose.heightPx} px`}</span>
        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 font-semibold ${manuallyAdjusted ? 'bg-amber-50 text-amber-700' : 'bg-sky-50 text-sky-700'}`}>
          {manuallyAdjusted ? <Move className="h-3 w-3" /> : <Sparkles className="h-3 w-3" />}
          {manuallyAdjusted ? 'Ročno prilagojeno' : 'Predlagano prileganje'}
        </span>
      </div>
      <div
        role={capabilities.editableText ? 'group' : 'img'}
        aria-label={`Predogled: ${purpose.label}`}
        tabIndex={0}
        onClick={onActivate}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        className={`relative mx-auto w-full touch-none overflow-visible rounded-xl border bg-[linear-gradient(135deg,#f8fafc,#eef2f7)] shadow-[0_18px_55px_rgba(15,23,42,0.12)] ${effectivePlacement.enabled ? editMode === 'move' ? 'cursor-grab active:cursor-grabbing' : 'cursor-default' : 'opacity-45'} ${active ? 'border-[color:var(--blue-300)] ring-2 ring-[color:var(--blue-100)]' : 'border-slate-200'} ${adminControlFocusTokenClasses}`}
        style={{ aspectRatio: `${purpose.widthPx} / ${purpose.heightPx}` }}
      >
        {master && displaySize ? (
          <span
            className="absolute left-1/2 top-1/2 block -translate-x-1/2 -translate-y-1/2 overflow-visible"
            style={{
              width: `${displaySize.widthPx}px`,
              height: `${displaySize.heightPx}px`
            }}
            data-logo-header-preview-viewport
            data-logo-display-height-px={displaySize.heightPx}
          >
            <span
              data-logo-clipped-artwork-layer
              className="pointer-events-none absolute inset-0 overflow-hidden"
              style={{ borderRadius: 'inherit' }}
            >
            <MeasuredSiteLogoArtwork
              master={master}
              presentation={presentation}
              alt="ATEHNA"
              style={editMode === 'crop' ? {
                ...headerArtworkStyle!,
                clipPath: 'none',
                WebkitClipPath: 'none'
              } : headerArtworkStyle!}
            />
            {capabilities.editableText && headerArtworkStyle ? (
              <LogoTextLayerTargets
                purposeId={purposeId}
                master={master}
                presentation={presentation}
                artworkStyle={headerArtworkStyle!}
                selectedLayerId={selectedTextLayerId}
                onSelect={onSelectTextLayer}
                onPointerDown={onTextPointerDown}
                onPointerMove={onTextPointerMove}
                onPointerUp={onTextPointerUp}
              />
            ) : null}
            </span>
            {active && !selectedTextLayerId && headerArtworkStyle && editMode !== 'move' ? (
              <LogoTransformOverlay
                artworkStyle={headerArtworkStyle}
                crop={geometry.crop}
                mode={editMode}
                onResizePointerDown={onResizePointerDown}
                onResizePointerMove={onResizePointerMove}
                onResizePointerUp={onResizePointerUp}
                onResizeKeyboard={onResizeKeyboard}
                onCropPointerDown={onCropPointerDown}
                onCropPointerMove={onCropPointerMove}
                onCropPointerUp={onCropPointerUp}
                onCropKeyboard={onCropKeyboard}
              />
            ) : null}
            {showSafeArea ? (
              <SafeAreaOverlay
                purpose={{ ...purpose, widthPx: displaySize.widthPx, heightPx: displaySize.heightPx }}
                inset={geometry.safeAreaInset}
              />
            ) : null}
          </span>
        ) : master ? (
          <>
            <span
              data-logo-clipped-artwork-layer
              className="pointer-events-none absolute inset-0 overflow-hidden"
              style={{ borderRadius: 'inherit' }}
            >
            <MeasuredSiteLogoArtwork
              master={master}
              presentation={presentation}
              alt="ATEHNA"
              style={editMode === 'crop' ? {
                ...artworkStyle!,
                clipPath: 'none',
                WebkitClipPath: 'none'
              } : artworkStyle!}
            />
            {capabilities.editableText && artworkStyle ? (
              <LogoTextLayerTargets
                purposeId={purposeId}
                master={master}
                presentation={presentation}
                artworkStyle={artworkStyle!}
                selectedLayerId={selectedTextLayerId}
                onSelect={onSelectTextLayer}
                onPointerDown={onTextPointerDown}
                onPointerMove={onTextPointerMove}
                onPointerUp={onTextPointerUp}
              />
            ) : null}
            </span>
            {active && !selectedTextLayerId && artworkStyle && editMode !== 'move' ? (
              <LogoTransformOverlay
                artworkStyle={artworkStyle}
                crop={geometry.crop}
                mode={editMode}
                onResizePointerDown={onResizePointerDown}
                onResizePointerMove={onResizePointerMove}
                onResizePointerUp={onResizePointerUp}
                onResizeKeyboard={onResizeKeyboard}
                onCropPointerDown={onCropPointerDown}
                onCropPointerMove={onCropPointerMove}
                onCropPointerUp={onCropPointerUp}
                onCropKeyboard={onCropKeyboard}
              />
            ) : null}
          </>
        ) : (
          <span className="absolute inset-0 grid place-items-center px-4 text-center text-[11px] text-slate-400">
            <span><ImageIcon className="mx-auto mb-1 h-6 w-6 text-slate-300" />Izberite ali naložite izvirnik.</span>
          </span>
        )}
        {showSafeArea && !displaySize ? <SafeAreaOverlay purpose={purpose} inset={geometry.safeAreaInset} /> : null}
        {!master ? (
          <span className="pointer-events-none absolute bottom-2 left-1/2 -translate-x-1/2 rounded-full bg-white/85 px-2 py-1 text-[9px] font-semibold text-slate-500 shadow-sm">
            Manjka izvirnik
          </span>
        ) : null}
      </div>
    </div>
  );
}

function LogoContextToolbar({
  config,
  purposeId,
  showSafeArea,
  editMode,
  isAnalyzing,
  onConfigChange,
  onPlacementChange,
  onEditModeChange,
  onShowSafeAreaChange,
  onUpload,
  onRemoveMaster,
  onSelectTextLayer,
  onClose
}: {
  config: SiteLogoConfig;
  purposeId: SiteLogoPurposeId;
  showSafeArea: boolean;
  editMode: LogoEditMode;
  isAnalyzing: string | null;
  onConfigChange: (config: SiteLogoConfig) => void;
  onPlacementChange: (placement: SiteLogoPlacement) => void;
  onEditModeChange: (mode: LogoEditMode) => void;
  onShowSafeAreaChange: (show: boolean) => void;
  onUpload: (slot: MasterSlot, event: ChangeEvent<HTMLInputElement>) => void;
  onRemoveMaster: (slotId: string) => void;
  onSelectTextLayer: (layerId: SiteLogoTextLayerId) => void;
  onClose: () => void;
}) {
  const [panel, setPanel] = useState<LogoToolbarPanel>(null);
  const [copyGeometry, setCopyGeometry] = useState(false);
  const toolbarRef = useRef<HTMLDivElement | null>(null);
  const panelTriggerRef = useRef<HTMLElement | null>(null);
  const purpose = getPurposeDefinition(purposeId);
  const placement = config.placements[purposeId];
  const preferredMasterId = getPreferredMasterId(config, purposeId);
  const effectivePlacement = placement.masterId === preferredMasterId
    ? placement
    : { ...placement, masterId: preferredMasterId };
  const sourceConfig = placement === effectivePlacement
    ? config
    : updatePlacement(config, purposeId, () => effectivePlacement);
  const master = getMaster(config, effectivePlacement.masterId);
  const geometry = resolveSiteLogoGeometry(effectivePlacement);
  const displaySize = resolveSiteLogoDisplaySize(purposeId, effectivePlacement);
  const presentation = resolveSiteLogoPresentation(effectivePlacement);
  const canvasEdges = resolveSiteLogoCanvasEdges(presentation.canvasEdges);
  const transparentColors = resolveSiteLogoTransparentColors(presentation.transparentColors);
  const capabilities = getSiteLogoPresentationCapabilities(master);
  const allMasters = [SITE_LOGO_BUILTIN_ORIGINAL_MASTER, ...config.masters.filter((candidate) => !isBuiltInAtehnaLogoMaster(candidate))];
  const syncTargets = SITE_LOGO_PURPOSE_IDS.filter((candidate) => candidate !== purposeId);
  const activePlacementPresetIndex = LOGO_PLACEMENT_PRESETS.findIndex((preset) => (
    Math.abs(geometry.translateX - preset.x) < 0.001
      && Math.abs(geometry.translateY - preset.y) < 0.001
  ));
  const rovingPlacementPresetIndex = activePlacementPresetIndex >= 0 ? activePlacementPresetIndex : 4;

  const setOverride = (updates: NonNullable<SiteLogoPlacement['override']>) => {
    onPlacementChange({
      ...effectivePlacement,
      override: { ...effectivePlacement.override, ...updates }
    });
  };
  const selectMaster = (selectedMasterId: string | null) => {
    const masterId = resolveSelectedSiteLogoMasterId(
      purposeId,
      effectivePlacement,
      selectedMasterId
    );
    onPlacementChange({
      ...effectivePlacement,
      masterId,
      suggestion: deriveSiteLogoFitSuggestion(purposeId, getMaster(config, masterId)),
      override: null
    });
  };
  const selectPlacementPreset = (index: number, focusFrom?: HTMLButtonElement) => {
    const preset = LOGO_PLACEMENT_PRESETS[index];
    if (!preset) return;
    setOverride({ translateX: preset.x, translateY: preset.y });
    focusFrom?.parentElement
      ?.querySelectorAll<HTMLButtonElement>('[data-logo-placement-preset]')
      [index]
      ?.focus();
  };
  const onPlacementPresetKeyDown = (index: number, event: ReactKeyboardEvent<HTMLButtonElement>) => {
    let nextIndex = index;
    if (event.key === 'ArrowLeft') nextIndex = Math.max(0, index - 1);
    else if (event.key === 'ArrowRight') nextIndex = Math.min(LOGO_PLACEMENT_PRESETS.length - 1, index + 1);
    else if (event.key === 'ArrowUp') nextIndex = Math.max(0, index - 3);
    else if (event.key === 'ArrowDown') nextIndex = Math.min(LOGO_PLACEMENT_PRESETS.length - 1, index + 3);
    else if (event.key === 'Home') nextIndex = 0;
    else if (event.key === 'End') nextIndex = LOGO_PLACEMENT_PRESETS.length - 1;
    else return;
    event.preventDefault();
    selectPlacementPreset(nextIndex, event.currentTarget);
  };
  const setDisplayHeightPx = (displayHeightPx: number) => {
    onPlacementChange({
      ...effectivePlacement,
      displayHeightPx: clamp(
        displayHeightPx,
        SITE_LOGO_HEADER_DISPLAY_HEIGHT_MIN_PX,
        SITE_LOGO_HEADER_DISPLAY_HEIGHT_MAX_PX
      ),
      override: { ...effectivePlacement.override, scale: 1 }
    });
  };
  const setPresentation = (updates: Partial<SiteLogoPresentation>) => {
    onPlacementChange({
      ...effectivePlacement,
      presentation: { ...presentation, ...updates }
    });
  };
  const togglePanel = (nextPanel: Exclude<LogoToolbarPanel, null>) => {
    panelTriggerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setPanel((current) => current === nextPanel ? null : nextPanel);
  };

  useEffect(() => {
    if (!panel) return;
    const isTransientPortal = (target: EventTarget | null) => target instanceof Element
      && Boolean(target.closest('[data-admin-color-palette-portal], [data-appearance-editor-compact-select-portal]'));
    const dismiss = (event: PointerEvent) => {
      if (!(event.target instanceof Node) || toolbarRef.current?.contains(event.target) || isTransientPortal(event.target)) return;
      setPanel(null);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || isTransientPortal(event.target)) return;
      event.preventDefault();
      setPanel(null);
      panelTriggerRef.current?.focus();
    };
    document.addEventListener('pointerdown', dismiss, true);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', dismiss, true);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [panel]);

  const panelContent = panel === 'masters' ? (
    <div className="space-y-2" data-logo-master-library>
      <div className="grid gap-1 text-[10px] font-medium text-white/65">
        <span>Izbrani izvirnik</span>
        <AppearanceEditorCompactSelect
          value={effectivePlacement.masterId ?? ''}
          tone="dark"
          onValueChange={(masterId) => selectMaster(masterId || null)}
          options={[
            { value: '', label: 'Brez izvirnika' },
            ...allMasters.map((option) => ({ value: option.id, label: option.label }))
          ]}
          ariaLabel={`Izvirnik za ${purpose.label}`}
          marker={`logo-${purposeId}-master`}
        />
      </div>
      <div className="grid grid-cols-2 gap-1.5">
        <button
          type="button"
          onClick={() => selectMaster(SITE_LOGO_BUILTIN_ORIGINAL_MASTER_ID)}
          className={`flex min-h-16 items-center gap-2 rounded-lg border p-2 text-left transition ${effectivePlacement.masterId === SITE_LOGO_BUILTIN_ORIGINAL_MASTER_ID ? 'border-blue-300/60 bg-blue-400/15' : 'border-white/10 bg-white/5 hover:bg-white/10'}`}
        >
          <span className="grid h-10 w-16 shrink-0 place-items-center overflow-hidden rounded bg-[#39362D] p-1">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={SITE_LOGO_BUILTIN_ORIGINAL_MASTER.url} alt="" className="max-h-full max-w-full object-contain" />
          </span>
          <span className="min-w-0 text-[10px] font-semibold text-white/85">Izvirni ATEHNA</span>
        </button>
        {MASTER_SLOTS.map((slot) => (
          <MasterCard
            key={slot.id}
            slot={slot}
            master={masterForSlot(config, slot.id)}
            isActive={effectivePlacement.masterId === slot.id}
            isAnalyzing={isAnalyzing === slot.id}
            onSelect={() => {
              if (masterForSlot(config, slot.id)) selectMaster(slot.id);
            }}
            onUpload={(event) => onUpload(slot, event)}
            onRemove={() => onRemoveMaster(slot.id)}
          />
        ))}
      </div>
    </div>
  ) : panel === 'fit' ? (
    <div className="space-y-2" data-logo-toolbar-panel="fit">
      <div
        className="grid grid-cols-2 gap-1 rounded-lg border border-white/10 bg-white/5 p-1"
        role="group"
        aria-label="Način prileganja"
      >
        {(['contain', 'fill'] as const).map((fitMode) => (
          <button
            key={fitMode}
            type="button"
            data-logo-fit-mode={fitMode}
            aria-pressed={effectivePlacement.fitMode === fitMode}
            onClick={() => onPlacementChange({ ...effectivePlacement, fitMode })}
            className={`h-7 rounded-md text-[10px] font-semibold transition ${effectivePlacement.fitMode === fitMode ? 'bg-white/20 text-white shadow-sm' : 'text-white/55 hover:bg-white/10 hover:text-white/85'}`}
          >
            {fitMode === 'contain' ? 'Prikaži celoto' : 'Zapolni okvir'}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-[86px_minmax(0,1fr)] gap-2">
        <div className="grid content-start gap-1" data-logo-placement-alignment>
          <span className="text-[10px] font-semibold text-white/55">Poravnava</span>
          <div
            className="grid grid-cols-3 gap-0.5 rounded-lg border border-white/10 bg-white/5 p-0.5"
            role="radiogroup"
            aria-label="Poravnava logotipa"
          >
            {LOGO_PLACEMENT_PRESETS.map((preset, index) => {
              const selected = Math.abs(geometry.translateX - preset.x) < 0.001
                && Math.abs(geometry.translateY - preset.y) < 0.001;
              return (
                <button
                  key={preset.id}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  tabIndex={index === rovingPlacementPresetIndex ? 0 : -1}
                  aria-label={preset.label}
                  title={preset.label}
                  data-logo-placement-preset={preset.id}
                  onClick={() => selectPlacementPreset(index)}
                  onKeyDown={(event) => onPlacementPresetKeyDown(index, event)}
                  className={`grid h-6 place-items-center rounded transition ${adminControlFocusTokenClasses} ${selected ? 'bg-blue-400/25 text-blue-100' : 'text-white/40 hover:bg-white/10 hover:text-white/75'}`}
                >
                  <span className={`h-1.5 w-1.5 rounded-full ${selected ? 'bg-blue-200' : 'bg-current'}`} />
                </button>
              );
            })}
          </div>
        </div>

        <div className="grid content-start gap-2">
          {displaySize ? (
            <div className="grid grid-cols-[auto_minmax(0,1fr)_74px] items-center gap-2" data-logo-header-size-control>
              <span className="text-[10px] font-medium text-white/65">Višina</span>
              <input
                type="range"
                min={SITE_LOGO_HEADER_DISPLAY_HEIGHT_MIN_PX}
                max={SITE_LOGO_HEADER_DISPLAY_HEIGHT_MAX_PX}
                step={0.5}
                value={displaySize.heightPx}
                onChange={(event) => setDisplayHeightPx(Number(event.target.value))}
                className="h-4 min-w-0 accent-blue-400"
                aria-label={`Velikost logotipa za ${purpose.label}`}
              />
              <span className="flex h-7 w-[74px] overflow-hidden rounded-md border border-white/15 bg-slate-800">
                <AppearanceEditorNumberInput
                  min={SITE_LOGO_HEADER_DISPLAY_HEIGHT_MIN_PX}
                  max={SITE_LOGO_HEADER_DISPLAY_HEIGHT_MAX_PX}
                  step={0.5}
                  value={displaySize.heightPx}
                  onValueChange={setDisplayHeightPx}
                  className="min-w-0 flex-1 border-0 bg-transparent px-1.5 text-right text-[10px] text-white outline-none"
                  aria-label={`Višina logotipa za ${purpose.label}`}
                />
                <span className="grid w-6 place-items-center text-[10px] text-white/40">px</span>
              </span>
            </div>
          ) : (
            <div className="grid grid-cols-[auto_minmax(0,1fr)_68px] items-center gap-2">
              <span className="text-[10px] font-medium text-white/65">Velikost</span>
              <input
                type="range"
                min={LOGO_EDITOR_SCALE_MIN * 100}
                max={LOGO_EDITOR_SCALE_MAX * 100}
                step={1}
                value={Math.round(geometry.scale * 100)}
                onChange={(event) => setOverride({ scale: Number(event.target.value) / 100 })}
                className="h-4 min-w-0 accent-blue-400"
                aria-label={`Velikost logotipa za ${purpose.label}`}
              />
              <span className="flex h-7 w-[68px] overflow-hidden rounded-md border border-white/15 bg-slate-800">
                <AppearanceEditorNumberInput
                  min={LOGO_EDITOR_SCALE_MIN * 100}
                  max={LOGO_EDITOR_SCALE_MAX * 100}
                  step={1}
                  value={Math.round(geometry.scale * 100)}
                  onValueChange={(value) => setOverride({ scale: value / 100 })}
                  className="min-w-0 flex-1 border-0 bg-transparent px-1.5 text-right text-[10px] text-white outline-none"
                  aria-label={`Velikost logotipa za ${purpose.label}`}
                />
                <span className="grid w-5 place-items-center text-[10px] text-white/40">%</span>
              </span>
            </div>
          )}

          <div className="grid grid-cols-2 gap-1.5" aria-label="Položaj logotipa">
            {([
              ['x', 'X', 'Vodoravno', geometry.translateX, 'translateX'],
              ['y', 'Y', 'Navpično', geometry.translateY, 'translateY']
            ] as const).map(([axis, shortLabel, label, value, key]) => (
              <label
                key={axis}
                data-logo-translation-field={axis}
                className="flex h-7 min-w-0 items-center overflow-hidden rounded-md border border-white/15 bg-slate-800"
                title={label}
              >
                <span className="grid w-7 shrink-0 place-items-center text-[10px] font-semibold text-white/55">{shortLabel}</span>
                <AppearanceEditorNumberInput
                  min={-100}
                  max={100}
                  value={Math.round(value * 100)}
                  onValueChange={(nextValue) => setOverride({ [key]: clamp(nextValue / 100, -1, 1) })}
                  className="w-[58px] min-w-0 flex-1 border-0 bg-transparent px-1 text-right text-[10px] text-white outline-none"
                  aria-label={`${label} za ${purpose.label}`}
                />
                <span className="grid w-5 shrink-0 place-items-center text-[10px] text-white/40">%</span>
              </label>
            ))}
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-white/10 bg-white/5 p-1.5" data-logo-crop-controls>
        <div className="mb-1 flex items-center justify-between gap-2">
          <span className="text-[10px] font-semibold text-white/60">Izrez slike</span>
          <button
            type="button"
            onClick={() => setOverride({ crop: { x: 0, y: 0, width: 1, height: 1 } })}
            className={`rounded px-1.5 py-0.5 text-[10px] font-semibold text-white/55 transition hover:bg-white/10 hover:text-white ${adminControlFocusTokenClasses}`}
          >
            Celotna slika
          </button>
        </div>
        <div className="grid grid-cols-4 gap-1">
          {([
            ['Levo', 'x'],
            ['Zgoraj', 'y'],
            ['Širina', 'width'],
            ['Višina', 'height']
          ] as const).map(([label, key]) => (
            <label key={key} className="grid min-w-0 gap-0.5 text-[10px] font-medium text-white/50">
              <span className="truncate">{label}</span>
              <span className="flex h-7 min-w-0 overflow-hidden rounded-md border border-white/15 bg-slate-800">
                <AppearanceEditorNumberInput
                  data-logo-crop-field={key}
                  min={key === 'width' || key === 'height' ? LOGO_CROP_MIN_SIZE * 100 : 0}
                  max={100}
                  step={0.5}
                  value={Math.round(geometry.crop[key] * 1000) / 10}
                  onValueChange={(value) => setOverride({
                    crop: normalizeEditorCrop({ ...geometry.crop, [key]: value / 100 })
                  })}
                  className="min-w-0 flex-1 border-0 bg-transparent px-1 text-right text-[10px] text-white outline-none"
                  aria-label={`${label} izreza za ${purpose.label}`}
                />
                <span className="grid w-5 shrink-0 place-items-center text-[10px] text-white/40">%</span>
              </span>
            </label>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-[auto_minmax(0,1fr)_38px] items-center gap-2">
        <span className="text-[10px] font-medium text-white/65">Varni odmik</span>
        <input
          type="range"
          min={0}
          max={30}
          value={Math.round(geometry.safeAreaInset * 100)}
          onChange={(event) => setOverride({ safeAreaInset: Number(event.target.value) / 100 })}
          className="h-4 min-w-0 accent-blue-400"
          aria-label={`Varni odmik za ${purpose.label}`}
        />
        <span className="text-right text-[10px] font-semibold tabular-nums text-white/65">{Math.round(geometry.safeAreaInset * 100)}%</span>
      </div>

      <details className="rounded-lg border border-white/10 bg-white/[0.03]" data-logo-canvas-edge-controls>
        <summary className={`cursor-pointer list-none px-2 py-1.5 text-[10px] font-semibold text-white/55 hover:text-white/80 ${adminControlFocusTokenClasses}`}>
          Platno (napredno)
        </summary>
        <div className="grid grid-cols-2 gap-1 border-t border-white/10 p-1.5">
          {SITE_LOGO_CANVAS_EDGE_IDS.map((edge) => (
            <label key={edge} className="flex h-7 min-w-0 items-center overflow-hidden rounded-md border border-white/15 bg-slate-800" data-logo-canvas-edge={edge}>
              <span className="w-12 shrink-0 pl-1.5 text-[10px] font-medium text-white/45">{LOGO_CANVAS_EDGE_LABELS[edge]}</span>
              <AppearanceEditorNumberInput
                min={SITE_LOGO_CANVAS_EDGE_MIN * 100}
                max={SITE_LOGO_CANVAS_EDGE_MAX * 100}
                step={0.5}
                value={Math.round(canvasEdges[edge] * 1000) / 10}
                onValueChange={(value) => onConfigChange(updateSiteLogoCanvasEdges(config, purposeId, {
                  [edge]: clamp(value / 100, SITE_LOGO_CANVAS_EDGE_MIN, SITE_LOGO_CANVAS_EDGE_MAX)
                }))}
                className="min-w-0 flex-1 border-0 bg-transparent px-1 text-right text-[10px] text-white outline-none"
                aria-label={`${LOGO_CANVAS_EDGE_LABELS[edge]}: rob platna v odstotkih`}
              />
              <span className="grid w-5 shrink-0 place-items-center text-[10px] text-white/40">%</span>
            </label>
          ))}
          <button
            type="button"
            onClick={() => onConfigChange(updateSiteLogoCanvasEdges(config, purposeId, { top: null, right: null, bottom: null, left: null }))}
            disabled={SITE_LOGO_CANVAS_EDGE_IDS.every((edge) => canvasEdges[edge] === 0)}
            className={`col-span-2 h-7 rounded-md border border-white/10 bg-white/5 text-[10px] font-semibold text-white/60 hover:bg-white/10 disabled:opacity-35 ${adminControlFocusTokenClasses}`}
          >
            Ponastavi robove platna
          </button>
        </div>
      </details>

      <button
        type="button"
        onClick={() => onPlacementChange({
          ...effectivePlacement,
          displayHeightPx: displaySize ? null : effectivePlacement.displayHeightPx,
          override: null
        })}
        disabled={!effectivePlacement.override && !displaySize?.explicit}
        className={`inline-flex h-7 w-full items-center justify-center gap-1.5 rounded-md border border-white/15 bg-white/5 text-[10px] font-semibold text-white/80 hover:bg-white/10 disabled:opacity-35 ${adminControlFocusTokenClasses}`}
      >
        <Sparkles className="h-3.5 w-3.5" /> Uporabi predlagano prileganje
      </button>
    </div>
  ) : panel === 'text' ? (
    <div className="space-y-2" data-logo-text-toolbar-panel="layers">
      <p className="text-[10px] leading-4 text-white/55">
        Izberite besedilo za neposreden premik in urejanje. Skrite ali odstranjene plasti lahko tukaj obnovite.
      </p>
      <SiteLogoTextLayerManager
        config={config}
        purposeId={purposeId}
        onSelect={onSelectTextLayer}
        onConfigChange={onConfigChange}
      />
    </div>
  ) : panel === 'appearance' ? (
    <div className="space-y-2" data-logo-toolbar-panel="appearance">
      <div className="grid grid-cols-2 gap-1.5" data-logo-transparent-color-controls>
        <LogoColorChannelField label="Zgornje ozadje" value={presentation.backgroundColor} marker="backgroundColor" channel="background" transparent={transparentColors.background} onColorChange={(backgroundColor) => setPresentation({ backgroundColor })} onTransparencyChange={(transparent) => onConfigChange(updateSiteLogoColorTransparency(config, purposeId, 'background', transparent))} />
      {capabilities.artworkColors ? (
        <>
          <LogoColorChannelField label="Ozadje slogana" value={presentation.taglineBackgroundColor} marker="taglineBackgroundColor" channel="taglineBackground" transparent={transparentColors.taglineBackground} onColorChange={(taglineBackgroundColor) => setPresentation({ taglineBackgroundColor })} onTransparencyChange={(transparent) => onConfigChange(updateSiteLogoColorTransparency(config, purposeId, 'taglineBackground', transparent))} />
          <LogoColorChannelField label="Primarna barva" value={presentation.primaryTextColor} marker="primaryTextColor" channel="primary" transparent={transparentColors.primary} onColorChange={(primaryTextColor) => setPresentation({ primaryTextColor })} onTransparencyChange={(transparent) => onConfigChange(updateSiteLogoColorTransparency(config, purposeId, 'primary', transparent))} />
          <LogoColorChannelField label="Barva d.o.o." value={presentation.secondaryTextColor} marker="secondaryTextColor" channel="secondary" transparent={transparentColors.secondary} onColorChange={(secondaryTextColor) => setPresentation({ secondaryTextColor })} onTransparencyChange={(transparent) => onConfigChange(updateSiteLogoColorTransparency(config, purposeId, 'secondary', transparent))} />
          <LogoColorChannelField label="Barva slogana" value={presentation.taglineTextColor} marker="taglineTextColor" channel="tagline" transparent={transparentColors.tagline} onColorChange={(taglineTextColor) => setPresentation({ taglineTextColor })} onTransparencyChange={(transparent) => onConfigChange(updateSiteLogoColorTransparency(config, purposeId, 'tagline', transparent))} />
        </>
      ) : <p className="rounded-lg bg-white/5 px-2 py-1.5 text-[10px] leading-4 text-white/55">Barve samega znaka so na voljo za vgrajeni izvirni logotip. Pri naloženi sliki ostanejo njene barve nespremenjene.</p>}
      </div>
      {capabilities.outline ? (
        <>
          <label className="flex items-center justify-between rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 text-[10px] font-medium text-white/75" data-logo-presentation-control="outline.enabled">
            Obroba znaka
            <input type="checkbox" checked={presentation.outline.enabled} onChange={(event) => setPresentation({ outline: { ...presentation.outline, enabled: event.target.checked } })} className="accent-blue-400" />
          </label>
          {presentation.outline.enabled ? (
            <div className="grid grid-cols-2 gap-1.5">
              <CompactHexColorField label="Barva obrobe" value={presentation.outline.color} marker="outline.color" onChange={(color) => setPresentation({ outline: { ...presentation.outline, color } })} />
              <CompactLogoRangeField label="Debelina obrobe" value={presentation.outline.widthPx} marker="outline.widthPx" min={0} max={24} unit=" px" onChange={(widthPx) => setPresentation({ outline: { ...presentation.outline, widthPx } })} />
            </div>
          ) : null}
        </>
      ) : null}
      {capabilities.shadow ? (
        <>
          <label className="flex items-center justify-between rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 text-[10px] font-medium text-white/75" data-logo-presentation-control="shadow.enabled">
            Senca znaka
            <input type="checkbox" checked={presentation.shadow.enabled} onChange={(event) => setPresentation({ shadow: { ...presentation.shadow, enabled: event.target.checked } })} className="accent-blue-400" />
          </label>
          {presentation.shadow.enabled ? (
            <div className="grid grid-cols-2 gap-1.5">
              <CompactHexColorField label="Barva sence" value={presentation.shadow.color} marker="shadow.color" onChange={(color) => setPresentation({ shadow: { ...presentation.shadow, color } })} />
              <CompactLogoRangeField label="Prosojnost" value={presentation.shadow.opacity} marker="shadow.opacity" min={0} max={1} step={0.01} onChange={(opacity) => setPresentation({ shadow: { ...presentation.shadow, opacity } })} />
              <CompactLogoRangeField label="Mehkoba" value={presentation.shadow.blurPx} marker="shadow.blurPx" min={0} max={64} unit=" px" onChange={(blurPx) => setPresentation({ shadow: { ...presentation.shadow, blurPx } })} />
              <CompactLogoRangeField label="Odmik X" value={presentation.shadow.offsetXpx} marker="shadow.offsetXpx" min={-64} max={64} unit=" px" onChange={(offsetXpx) => setPresentation({ shadow: { ...presentation.shadow, offsetXpx } })} />
              <CompactLogoRangeField label="Odmik Y" value={presentation.shadow.offsetYpx} marker="shadow.offsetYpx" min={-64} max={64} unit=" px" onChange={(offsetYpx) => setPresentation({ shadow: { ...presentation.shadow, offsetYpx } })} />
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  ) : panel === 'sync' ? (
    <div className="space-y-2" data-logo-toolbar-panel="sync" data-logo-sync-suggestion>
      <p className="text-[10px] leading-4 text-white/60">Predlog kopira izvirnik in videz šele, ko izberete cilj. Obstoječe nastavitve se ne spreminjajo samodejno.</p>
      <label className="flex items-center justify-between rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 text-[10px] font-medium text-white/75">
        Kopiraj tudi položaj in velikost
        <input type="checkbox" checked={copyGeometry} onChange={(event) => setCopyGeometry(event.target.checked)} className="accent-blue-400" />
      </label>
      <div className="grid grid-cols-2 gap-1">
        {syncTargets.map((targetPurposeId) => {
          const target = config.placements[targetPurposeId];
          const suggestion = suggestSiteLogoPlacement(sourceConfig, purposeId, targetPurposeId);
          const differs = target.masterId !== suggestion.masterId || JSON.stringify(resolveSiteLogoPresentation(target)) !== JSON.stringify(resolveSiteLogoPresentation(suggestion));
          return (
            <button
              key={targetPurposeId}
              type="button"
              data-logo-apply-to-purpose={targetPurposeId}
              disabled={!differs && !copyGeometry}
              onClick={() => onConfigChange(copySiteLogoPlacement(sourceConfig, purposeId, targetPurposeId, { geometry: copyGeometry }))}
              className="grid min-w-0 gap-0.5 rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 text-left text-[10px] text-white/80 transition hover:bg-white/10 disabled:opacity-40"
            >
              <span className="truncate font-medium">{getPurposeDefinition(targetPurposeId).label}</span>
              <span className={differs ? 'text-amber-200' : 'text-emerald-200'}>{differs ? 'Uporabi' : 'Usklajeno'}</span>
            </button>
          );
        })}
      </div>
    </div>
  ) : null;

  return (
    <div ref={toolbarRef} className="relative" data-logo-context-toolbar>
      <AppearanceEditorToolbarToneProvider tone="dark">
        <div className="flex items-center gap-0.5">
          <span className="mr-1 inline-flex h-8 max-w-40 items-center truncate rounded-lg bg-white/10 px-2.5 text-[11px] font-semibold text-white">{purpose.label}</span>
          <AppearanceEditorToolbarDivider />
          <div className="flex items-center gap-0.5" role="group" aria-label="Način urejanja logotipa">
            {(['move', 'resize', 'crop'] as const).map((mode) => (
              <AppearanceEditorToolbarButton
                key={mode}
                data-logo-edit-mode-control={mode}
                label={mode === 'move' ? 'Premakni logotip' : mode === 'resize' ? 'Spremeni velikost logotipa' : 'Izreži logotip'}
                title={mode === 'move' ? 'Premik' : mode === 'resize' ? 'Velikost' : 'Izrez'}
                pressed={editMode === mode}
                onClick={() => onEditModeChange(mode)}
              >
                {mode === 'move' ? <Move className="h-3.5 w-3.5" /> : mode === 'resize' ? <ZoomIn className="h-3.5 w-3.5" /> : <Crop className="h-3.5 w-3.5" />}
              </AppearanceEditorToolbarButton>
            ))}
          </div>
          <AppearanceEditorToolbarDivider />
          <AppearanceEditorToolbarButton label="Izvirnik" popover active={panel === 'masters'} onClick={() => togglePanel('masters')}><Library className="h-3.5 w-3.5" /></AppearanceEditorToolbarButton>
          <AppearanceEditorToolbarButton label="Prileganje" popover active={panel === 'fit'} onClick={() => togglePanel('fit')}><Settings2 className="h-3.5 w-3.5" /></AppearanceEditorToolbarButton>
          {capabilities.editableText ? <AppearanceEditorToolbarButton label="Besedilo logotipa" popover active={panel === 'text'} onClick={() => togglePanel('text')}><Type className="h-3.5 w-3.5" /></AppearanceEditorToolbarButton> : null}
          <AppearanceEditorToolbarButton label="Videz" popover active={panel === 'appearance'} onClick={() => togglePanel('appearance')}><Palette className="h-3.5 w-3.5" /></AppearanceEditorToolbarButton>
          <AppearanceEditorToolbarButton label="Uporabi drugje" popover active={panel === 'sync'} onClick={() => togglePanel('sync')}><Copy className="h-3.5 w-3.5" /></AppearanceEditorToolbarButton>
          <AppearanceEditorToolbarDivider />
          <AppearanceEditorToolbarButton label={showSafeArea ? 'Skrij varno območje' : 'Prikaži varno območje'} pressed={showSafeArea} onClick={() => onShowSafeAreaChange(!showSafeArea)}><ShieldCheck className="h-3.5 w-3.5" /></AppearanceEditorToolbarButton>
          <AppearanceEditorToolbarButton label={effectivePlacement.enabled ? 'Skrij uporabo' : 'Prikaži uporabo'} pressed={effectivePlacement.enabled} onClick={() => onPlacementChange({ ...effectivePlacement, enabled: !effectivePlacement.enabled })}>{effectivePlacement.enabled ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}</AppearanceEditorToolbarButton>
          <AppearanceEditorToolbarDivider />
          <AppearanceEditorToolbarButton label="Zapri" onClick={onClose}><X className="h-3.5 w-3.5" /></AppearanceEditorToolbarButton>
        </div>
      </AppearanceEditorToolbarToneProvider>
      {panelContent && panel ? (
        <AppearanceEditorToolbarPopover
          ariaLabel={panel === 'masters' ? 'Izvirniki logotipa' : panel === 'fit' ? 'Prileganje logotipa' : panel === 'text' ? 'Besedilo logotipa' : panel === 'appearance' ? 'Videz logotipa' : 'Uporabi logotip drugje'}
          size={panel === 'masters' || panel === 'appearance' ? 'wide' : 'compact'}
        >
          <div data-logo-toolbar-panel={panel}>
            {panelContent}
          </div>
        </AppearanceEditorToolbarPopover>
      ) : null}
    </div>
  );
}

function LogoTextContextToolbar({
  config,
  purposeId,
  layerId,
  onConfigChange,
  onSelectLayer,
  onReturnToLogo,
  onClose
}: {
  config: SiteLogoConfig;
  purposeId: SiteLogoPurposeId;
  layerId: SiteLogoTextLayerId;
  onConfigChange: (config: SiteLogoConfig) => void;
  onSelectLayer: (layerId: SiteLogoTextLayerId) => void;
  onReturnToLogo: () => void;
  onClose: () => void;
}) {
  const [panel, setPanel] = useState<'edit' | 'layers' | null>('edit');
  const toolbarRef = useRef<HTMLDivElement | null>(null);
  const panelTriggerRef = useRef<HTMLElement | null>(null);
  const presentation = resolveSiteLogoPresentation(config.placements[purposeId]);
  const layer = presentation[layerId];
  const meta = SITE_LOGO_TEXT_LAYER_META[layerId];
  const togglePanel = (next: Exclude<typeof panel, null>) => {
    panelTriggerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setPanel((current) => current === next ? null : next);
  };
  useEffect(() => {
    if (!panel) return;
    const isTransientPortal = (target: EventTarget | null) => target instanceof Element
      && Boolean(target.closest('[data-admin-color-palette-portal], [data-appearance-editor-compact-select-portal]'));
    const dismiss = (event: PointerEvent) => {
      if (!(event.target instanceof Node) || toolbarRef.current?.contains(event.target) || isTransientPortal(event.target)) return;
      setPanel(null);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || isTransientPortal(event.target)) return;
      event.preventDefault();
      setPanel(null);
      panelTriggerRef.current?.focus();
    };
    document.addEventListener('pointerdown', dismiss, true);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', dismiss, true);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [panel]);
  const hide = () => {
    onConfigChange(updateSiteLogoTextLayer(config, purposeId, layerId, { enabled: false }));
    onReturnToLogo();
  };
  const remove = () => {
    onConfigChange(updateSiteLogoTextLayer(
      resetSiteLogoTextLayer(config, purposeId, layerId),
      purposeId,
      layerId,
      { enabled: false }
    ));
    onReturnToLogo();
  };

  const panelContent = panel === 'edit' ? (
    <div className="space-y-2" data-logo-text-toolbar-panel="edit">
      <p className="text-[10px] leading-4 text-white/50">Povlecite besedilo neposredno na logotipu ali vnesite natančen položaj.</p>
      <SiteLogoTextLayerFields
        layerId={layerId}
        layer={layer}
        onChange={(updates) => onConfigChange(updateSiteLogoTextLayer(config, purposeId, layerId, updates))}
      />
    </div>
  ) : panel === 'layers' ? (
    <div className="space-y-2" data-logo-text-toolbar-panel="layers">
      <SiteLogoTextLayerManager
        config={config}
        purposeId={purposeId}
        selectedLayerId={layerId}
        onSelect={onSelectLayer}
        onLayerDisabled={(disabledLayerId) => {
          if (disabledLayerId === layerId) onReturnToLogo();
        }}
        onConfigChange={onConfigChange}
      />
    </div>
  ) : null;

  return (
    <div ref={toolbarRef} className="relative" data-logo-text-toolbar data-logo-text-layer-active={layerId}>
      <AppearanceEditorToolbarToneProvider tone="dark">
        <div className="flex items-center gap-0.5">
          <span className="mr-1 inline-flex h-8 max-w-40 items-center truncate rounded-lg bg-white/10 px-2.5 text-[11px] font-semibold text-white" title={layer.content || meta.label}>
            {layer.content || meta.label}
          </span>
          <AppearanceEditorToolbarDivider />
          <AppearanceEditorToolbarButton label="Besedilo in tipografija" popover active={panel === 'edit'} onClick={() => togglePanel('edit')}><Type className="h-3.5 w-3.5" /></AppearanceEditorToolbarButton>
          <AppearanceEditorToolbarButton label="Vse besedilne plasti" popover active={panel === 'layers'} onClick={() => togglePanel('layers')}><Library className="h-3.5 w-3.5" /></AppearanceEditorToolbarButton>
          <AppearanceEditorToolbarDivider />
          <AppearanceEditorToolbarButton label="Ponastavi besedilo" onClick={() => onConfigChange(resetSiteLogoTextLayer(config, purposeId, layerId))}><RotateCcw className="h-3.5 w-3.5" /></AppearanceEditorToolbarButton>
          <AppearanceEditorToolbarButton label="Skrij besedilo" onClick={hide}><EyeOff className="h-3.5 w-3.5" /></AppearanceEditorToolbarButton>
          <span data-logo-text-remove={layerId}>
            <AppearanceEditorToolbarButton label="Odstrani in ponastavi besedilo" onClick={remove}><Trash2 className="h-3.5 w-3.5" /></AppearanceEditorToolbarButton>
          </span>
          <AppearanceEditorToolbarDivider />
          <AppearanceEditorToolbarButton label="Izberi celoten logotip" onClick={onReturnToLogo}><ImageIcon className="h-3.5 w-3.5" /></AppearanceEditorToolbarButton>
          <AppearanceEditorToolbarButton label="Zapri" onClick={onClose}><X className="h-3.5 w-3.5" /></AppearanceEditorToolbarButton>
        </div>
      </AppearanceEditorToolbarToneProvider>
      {panelContent && panel ? (
        <AppearanceEditorToolbarPopover
          ariaLabel={panel === 'edit' ? 'Besedilo in tipografija' : 'Besedilne plasti logotipa'}
          size="compact"
        >
          {panelContent}
        </AppearanceEditorToolbarPopover>
      ) : null}
    </div>
  );
}

export default function AdminLogoPageClient({ initialConfig }: { initialConfig: SiteLogoConfig }) {
  const router = useRouter();
  const { toast } = useToast();
  const normalizedInitial = useMemo(() => normalizeSiteLogoConfig(initialConfig), [initialConfig]);
  const [config, setConfig] = useState(normalizedInitial);
  const [savedConfig, setSavedConfig] = useState(normalizedInitial);
  const [activeUseCase, setActiveUseCase] = useState<LogoUseCaseSelection>('header');
  const [activePurposeId, setActivePurposeId] = useState<SiteLogoPurposeId>('header-desktop');
  const [activeTextLayerId, setActiveTextLayerId] = useState<SiteLogoTextLayerId | null>(null);
  const [toolbarOpen, setToolbarOpen] = useState(true);
  const [logoEditMode, setLogoEditMode] = useState<LogoEditMode>('move');
  const [otherOutputsOpen, setOtherOutputsOpen] = useState(false);
  const [safeAreaVisibility, setSafeAreaVisibility] = useState<Partial<Record<SiteLogoPurposeId, boolean>>>({
    favicon: true,
    'apple-touch-icon': true,
    'pwa-maskable': true
  });
  const [isSaving, setIsSaving] = useState(false);
  const [analyzingMasterId, setAnalyzingMasterId] = useState<string | null>(null);
  const pendingMastersRef = useRef(new Map<string, PendingMaster>());
  const dragStateRef = useRef<DragState | null>(null);
  const resizeDragStateRef = useRef<LogoResizeDragState | null>(null);
  const cropDragStateRef = useRef<LogoCropDragState | null>(null);
  const textLayerDragStateRef = useRef<TextLayerDragState | null>(null);
  const editorFrameRef = useRef<HTMLDivElement | null>(null);
  const previewViewportRef = useRef<HTMLDivElement | null>(null);
  const otherOutputsRef = useRef<HTMLDivElement | null>(null);
  const otherOutputsTriggerRef = useRef<HTMLButtonElement | null>(null);
  const isDirty = comparable(config) !== comparable(savedConfig);
  const activeHeaderDisplaySize = resolveSiteLogoDisplaySize(
    activePurposeId,
    config.placements[activePurposeId]
  );
  const showOverflowingTransformHandles = toolbarOpen && !activeTextLayerId && logoEditMode !== 'move';
  const visiblePurposes = useMemo(
    () => (activeUseCase === 'other'
      ? OTHER_LOGO_PURPOSE_IDS
      : SITE_LOGO_USE_CASE_PURPOSE_IDS[activeUseCase]
    ).filter((purposeId) => purposeId in config.placements),
    [activeUseCase, config.placements]
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

  useEffect(() => {
    setActiveTextLayerId(null);
  }, [activePurposeId]);

  useEffect(() => {
    if (!otherOutputsOpen) return;
    const dismiss = (event: PointerEvent) => {
      if (!(event.target instanceof Node) || otherOutputsRef.current?.contains(event.target)) return;
      setOtherOutputsOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      setOtherOutputsOpen(false);
      otherOutputsTriggerRef.current?.focus();
    };
    document.addEventListener('pointerdown', dismiss, true);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', dismiss, true);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [otherOutputsOpen]);

  function applyPlacement(purposeId: SiteLogoPurposeId, placement: SiteLogoPlacement) {
    setConfig((current) => updatePlacement(current, purposeId, () => placement));
  }

  function removeMaster(slotId: string) {
    const pending = pendingMastersRef.current.get(slotId);
    if (pending) URL.revokeObjectURL(pending.objectUrl);
    pendingMastersRef.current.delete(slotId);
    setConfig((current) => {
      const configWithoutMaster: SiteLogoConfig = {
        ...current,
        masters: current.masters.filter((master) => master.id !== slotId)
      };
      const placements = Object.fromEntries(SITE_LOGO_PURPOSE_IDS.map((purposeId) => {
        const placement = current.placements[purposeId];
        if (placement.masterId !== slotId) return [purposeId, placement];
        const fallbackMasterId = getPreferredMasterId(configWithoutMaster, purposeId);
        return [purposeId, {
          ...placement,
          masterId: fallbackMasterId,
          suggestion: deriveSiteLogoFitSuggestion(
            purposeId,
            getMaster(configWithoutMaster, fallbackMasterId)
          ),
          override: null
        }];
      })) as SiteLogoConfig['placements'];
      return { ...configWithoutMaster, placements };
    });
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
            suggestion: deriveSiteLogoFitSuggestion(purposeId, nextMaster),
            override: null
          } : placement];
        })) as SiteLogoConfig['placements'];
        return { ...current, masters, placements };
      });
      toast.success('Logotip je optično analiziran. Spremembe še niso shranjene.');
    } catch (error) {
      URL.revokeObjectURL(objectUrl);
      toast.error(error instanceof Error ? error.message : 'Analiza logotipa ni uspela.');
    } finally {
      setAnalyzingMasterId(null);
    }
  }

  function beginDrag(purposeId: SiteLogoPurposeId, event: ReactPointerEvent<HTMLDivElement>) {
    if (
      logoEditMode !== 'move'
      || (event.target as HTMLElement).closest('[data-logo-text-layer], [data-logo-transform-handle]')
    ) return;
    const placement = config.placements[purposeId];
    const masterId = getPreferredMasterId(config, purposeId);
    if (!getMaster(config, masterId)) return;
    const geometry = resolveSiteLogoGeometry(placement.masterId === masterId ? placement : { ...placement, masterId });
    const frame = event.currentTarget.querySelector<HTMLElement>('[data-logo-header-preview-viewport]')
      ?? event.currentTarget;
    event.currentTarget.setPointerCapture(event.pointerId);
    dragStateRef.current = {
      purposeId,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startTranslateX: geometry.translateX,
      startTranslateY: geometry.translateY,
      frame
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

  function applyResize(
    purposeId: SiteLogoPurposeId,
    scale: number,
    displayHeightPx: number | null
  ) {
    setConfig((current) => updatePlacement(current, purposeId, (placement) => {
      const masterId = getPreferredMasterId(current, purposeId);
      if (isSiteLogoHeaderPurpose(purposeId) && displayHeightPx != null) {
        return {
          ...placement,
          masterId,
          displayHeightPx: clamp(
            displayHeightPx,
            SITE_LOGO_HEADER_DISPLAY_HEIGHT_MIN_PX,
            SITE_LOGO_HEADER_DISPLAY_HEIGHT_MAX_PX
          ),
          override: { ...placement.override, scale: 1 }
        };
      }
      return {
        ...placement,
        masterId,
        override: {
          ...placement.override,
          scale: clamp(scale, LOGO_EDITOR_SCALE_MIN, LOGO_EDITOR_SCALE_MAX)
        }
      };
    }));
  }

  function beginResize(
    purposeId: SiteLogoPurposeId,
    handle: LogoResizeHandle,
    event: ReactPointerEvent<HTMLButtonElement>
  ) {
    const frame = event.currentTarget.closest<HTMLElement>('[data-logo-transform-bounds]');
    const placement = config.placements[purposeId];
    const masterId = getPreferredMasterId(config, purposeId);
    if (!frame || !getMaster(config, masterId)) return;
    const rect = frame.getBoundingClientRect();
    const geometry = resolveSiteLogoGeometry(
      placement.masterId === masterId ? placement : { ...placement, masterId }
    );
    const displaySize = resolveSiteLogoDisplaySize(purposeId, placement);
    event.currentTarget.setPointerCapture(event.pointerId);
    resizeDragStateRef.current = {
      purposeId,
      handle,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startScale: geometry.scale,
      startDisplayHeightPx: displaySize?.heightPx ?? null,
      frameWidth: Math.max(1, rect.width),
      frameHeight: Math.max(1, rect.height)
    };
    setActivePurposeId(purposeId);
    setActiveTextLayerId(null);
  }

  function moveResize(event: ReactPointerEvent<HTMLButtonElement>) {
    const drag = resizeDragStateRef.current;
    if (!drag) return;
    const directionX = drag.handle.includes('e') ? 1 : -1;
    const directionY = drag.handle.includes('s') ? 1 : -1;
    const delta = (
      ((event.clientX - drag.startClientX) / drag.frameWidth) * directionX
      + ((event.clientY - drag.startClientY) / drag.frameHeight) * directionY
    ) / 2;
    const factor = Math.exp(delta);
    applyResize(
      drag.purposeId,
      drag.startScale * factor,
      drag.startDisplayHeightPx == null ? null : drag.startDisplayHeightPx * factor
    );
  }

  function endResize(event: ReactPointerEvent<HTMLButtonElement>) {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    resizeDragStateRef.current = null;
  }

  function stepResize(purposeId: SiteLogoPurposeId, direction: -1 | 1) {
    const placement = config.placements[purposeId];
    const geometry = resolveSiteLogoGeometry(placement);
    const displaySize = resolveSiteLogoDisplaySize(purposeId, placement);
    const factor = direction > 0 ? 1.05 : 1 / 1.05;
    applyResize(
      purposeId,
      geometry.scale * factor,
      displaySize ? displaySize.heightPx * factor : null
    );
  }

  function applyCrop(purposeId: SiteLogoPurposeId, crop: SiteLogoGeometry['crop']) {
    setConfig((current) => updatePlacement(current, purposeId, (placement) => ({
      ...placement,
      masterId: getPreferredMasterId(current, purposeId),
      override: { ...placement.override, crop: normalizeEditorCrop(crop) }
    })));
  }

  function beginCrop(
    purposeId: SiteLogoPurposeId,
    handle: LogoCropHandle,
    event: ReactPointerEvent<HTMLButtonElement>
  ) {
    const frame = event.currentTarget.closest<HTMLElement>('[data-logo-editable-artwork-frame]');
    const placement = config.placements[purposeId];
    const masterId = getPreferredMasterId(config, purposeId);
    if (!frame || !getMaster(config, masterId)) return;
    const rect = frame.getBoundingClientRect();
    const geometry = resolveSiteLogoGeometry(
      placement.masterId === masterId ? placement : { ...placement, masterId }
    );
    event.currentTarget.setPointerCapture(event.pointerId);
    cropDragStateRef.current = {
      purposeId,
      handle,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startCrop: normalizeEditorCrop(geometry.crop),
      frameWidth: Math.max(1, rect.width),
      frameHeight: Math.max(1, rect.height)
    };
    setActivePurposeId(purposeId);
    setActiveTextLayerId(null);
  }

  function moveCrop(event: ReactPointerEvent<HTMLButtonElement>) {
    const drag = cropDragStateRef.current;
    if (!drag) return;
    applyCrop(
      drag.purposeId,
      cropFromPointerDelta(
        drag.startCrop,
        drag.handle,
        (event.clientX - drag.startClientX) / drag.frameWidth,
        (event.clientY - drag.startClientY) / drag.frameHeight
      )
    );
  }

  function endCrop(event: ReactPointerEvent<HTMLButtonElement>) {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    cropDragStateRef.current = null;
  }

  function stepCrop(
    purposeId: SiteLogoPurposeId,
    handle: LogoCropHandle,
    deltaX: number,
    deltaY: number
  ) {
    const crop = resolveSiteLogoGeometry(config.placements[purposeId]).crop;
    applyCrop(purposeId, cropFromPointerDelta(crop, handle, deltaX, deltaY));
  }

  function beginTextLayerDrag(
    purposeId: SiteLogoPurposeId,
    layerId: SiteLogoTextLayerId,
    event: ReactPointerEvent<HTMLButtonElement>
  ) {
    const layer = resolveSiteLogoPresentation(config.placements[purposeId])[layerId];
    const frame = event.currentTarget.closest<HTMLElement>('[data-logo-text-target-layer]');
    const master = resolveSiteLogoMaster(config, purposeId);
    if (!frame || !master || !layer.enabled) return;
    const presentation = resolveSiteLogoPresentation(config.placements[purposeId]);
    const layout = resolveSiteLogoCanvasLayout(
      master.intrinsicWidth,
      master.intrinsicHeight,
      presentation.canvasEdges
    );
    event.currentTarget.setPointerCapture(event.pointerId);
    textLayerDragStateRef.current = {
      purposeId,
      layerId,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startX: layer.x,
      startY: layer.y,
      frame,
      layout
    };
    setActiveTextLayerId(layerId);
    setToolbarOpen(true);
  }

  function moveTextLayerDrag(event: ReactPointerEvent<HTMLButtonElement>) {
    const drag = textLayerDragStateRef.current;
    if (!drag) return;
    const rect = drag.frame.getBoundingClientRect();
    const sourceDelta = mapSiteLogoCanvasDeltaToSource(drag.layout, {
      x: (event.clientX - drag.startClientX) / Math.max(1, rect.width),
      y: (event.clientY - drag.startClientY) / Math.max(1, rect.height)
    });
    const x = clamp(
      drag.startX + sourceDelta.x,
      SITE_LOGO_TEXT_POSITION_MIN,
      SITE_LOGO_TEXT_POSITION_MAX
    );
    const y = clamp(
      drag.startY + sourceDelta.y,
      SITE_LOGO_TEXT_POSITION_MIN,
      SITE_LOGO_TEXT_POSITION_MAX
    );
    setConfig((current) => updateSiteLogoTextLayer(current, drag.purposeId, drag.layerId, { x, y }));
  }

  function endTextLayerDrag(event: ReactPointerEvent<HTMLButtonElement>) {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    textLayerDragStateRef.current = null;
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
    setActiveTextLayerId(null);
  }

  function selectUseCase(useCaseId: LogoUseCaseSelection) {
    const purposes = useCaseId === 'other'
      ? OTHER_LOGO_PURPOSE_IDS
      : SITE_LOGO_USE_CASE_PURPOSE_IDS[useCaseId];
    const firstPurpose = purposes.find((purposeId) => purposeId in config.placements);
    setActiveUseCase(useCaseId);
    setOtherOutputsOpen(false);
    if (firstPurpose) setActivePurposeId(firstPurpose);
    setToolbarOpen(true);
  }

  function differsFromActivePurpose(purposeId: SiteLogoPurposeId) {
    if (purposeId === activePurposeId) return false;
    const source = config.placements[activePurposeId];
    const target = config.placements[purposeId];
    if (!source || !target) return false;
    return source.masterId !== target.masterId
      || JSON.stringify(resolveSiteLogoPresentation(source)) !== JSON.stringify(resolveSiteLogoPresentation(target));
  }

  const activeUseCaseMeta = activeUseCase === 'other'
    ? { label: 'Drugi izhodi', description: 'Ikone aplikacije in predogled povezave.' }
    : PRIMARY_USE_CASE_META[activeUseCase];

  return (
    <div ref={editorFrameRef} className="space-y-4" data-logo-editor-workspace data-appearance-settings-density="compact" data-appearance-settings-page="logotip">
      <AdminPageHeader
        title="Logotip"
        description="Izberite namen, uredite logotip neposredno v predogledu in spremembe po želji uporabite tudi drugje."
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

      <section className="overflow-visible rounded-xl border border-slate-200 bg-white" data-testid="logo-purpose-catalogue">
        <div className="flex flex-wrap items-center gap-1.5 border-b border-slate-200 p-2" role="tablist" aria-label="Namen uporabe logotipa">
          {SITE_LOGO_PRIMARY_USE_CASE_IDS.map((useCaseId) => {
            const meta = PRIMARY_USE_CASE_META[useCaseId];
            const isActive = activeUseCase === useCaseId;
            return (
              <button key={useCaseId} type="button" role="tab" aria-selected={isActive} data-logo-use-case-tab={useCaseId} onClick={() => selectUseCase(useCaseId)} className={`inline-flex h-9 items-center gap-2 rounded-lg border px-3 text-[11px] font-semibold transition ${adminControlFocusTokenClasses} ${isActive ? 'border-[color:var(--blue-200)] bg-[color:var(--blue-50)] text-[color:var(--blue-700)] shadow-sm' : 'border-transparent text-slate-600 hover:bg-slate-100 hover:text-slate-950'}`}>
                <LogoUseCaseIcon id={useCaseId} />{meta.label}
              </button>
            );
          })}
          <div ref={otherOutputsRef} className="relative ml-auto" data-logo-other-outputs>
            <button ref={otherOutputsTriggerRef} type="button" aria-haspopup="menu" aria-expanded={otherOutputsOpen} onClick={() => setOtherOutputsOpen((open) => !open)} className={`flex h-9 items-center gap-2 rounded-lg border px-3 text-[11px] font-semibold transition ${adminControlFocusTokenClasses} ${activeUseCase === 'other' ? 'border-[color:var(--blue-200)] bg-[color:var(--blue-50)] text-[color:var(--blue-700)]' : 'border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-950'}`}>
              <MoreHorizontal className="h-4 w-4" /> Drugi izhodi
            </button>
            {otherOutputsOpen ? <div role="menu" className="absolute right-0 top-[calc(100%+6px)] z-30 grid min-w-56 gap-1 rounded-xl border border-white/15 bg-slate-900 p-1.5 text-white shadow-2xl">
              {OTHER_LOGO_PURPOSE_IDS.map((purposeId) => (
                <button key={purposeId} type="button" role="menuitem" data-logo-other-output={purposeId} onClick={() => { setActiveUseCase('other'); setActivePurposeId(purposeId); setToolbarOpen(true); setOtherOutputsOpen(false); }} className={`rounded-lg px-2.5 py-2 text-left text-[11px] font-medium transition ${adminControlFocusTokenClasses} ${activePurposeId === purposeId && activeUseCase === 'other' ? 'bg-blue-400/20 text-blue-100' : 'text-white/75 hover:bg-white/10 hover:text-white'}`}>
                  {getPurposeDefinition(purposeId).label}
                </button>
              ))}
            </div> : null}
          </div>
        </div>

        <div className="flex flex-wrap items-start justify-between gap-3 px-4 py-3">
          <div>
            <p className="text-[9px] font-semibold uppercase tracking-[0.1em] text-[color:var(--blue-600)]">Izbrani namen</p>
            <h2 className="mt-0.5 text-[15px] font-semibold text-slate-900">{activeUseCaseMeta.label}</h2>
            <p className="mt-0.5 text-[10px] leading-4 text-slate-500">{activeUseCaseMeta.description}</p>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-1.5" aria-label="Izhodi izbranega namena">
            {visiblePurposes.map((purposeId) => {
              const isActive = activePurposeId === purposeId;
              const differs = differsFromActivePurpose(purposeId);
              return (
                <button key={purposeId} type="button" data-logo-placement-option={purposeId} data-logo-output-differs={differs ? 'true' : 'false'} onClick={() => { setActivePurposeId(purposeId); setToolbarOpen(true); }} className={`inline-flex h-8 items-center gap-1.5 rounded-full border px-2.5 text-[10px] font-semibold transition ${adminControlFocusTokenClasses} ${isActive ? 'border-[color:var(--blue-200)] bg-[color:var(--blue-50)] text-[color:var(--blue-700)]' : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:text-slate-900'}`}>
                  {getPurposeDefinition(purposeId).label}{differs ? <span className="h-1.5 w-1.5 rounded-full bg-amber-500" title="Ta izhod uporablja drugačen videz" /> : null}
                </button>
              );
            })}
          </div>
        </div>

        <div ref={previewViewportRef} className={`relative min-h-[430px] ${activeHeaderDisplaySize || showOverflowingTransformHandles ? 'overflow-visible' : 'overflow-hidden'} border-t border-slate-200 bg-[radial-gradient(circle_at_top,_#f8fafc,_#e9eef5)] p-5 sm:p-8`} data-testid="logo-output-cards" data-logo-use-case-preview>
          <div className="mx-auto flex min-h-[360px] max-w-5xl items-center justify-center">
            <LogoUseCasePreview
              config={config}
              purposeId={activePurposeId}
              active={!activeTextLayerId}
              editMode={logoEditMode}
              selectedTextLayerId={activeTextLayerId}
              showSafeArea={safeAreaVisibility[activePurposeId] ?? false}
              onActivate={() => {
                setActiveTextLayerId(null);
                setToolbarOpen(true);
              }}
              onPointerDown={(event) => beginDrag(activePurposeId, event)}
              onPointerMove={moveDrag}
              onPointerUp={endDrag}
              onResizePointerDown={(handle, event) => beginResize(activePurposeId, handle, event)}
              onResizePointerMove={moveResize}
              onResizePointerUp={endResize}
              onResizeKeyboard={(direction) => stepResize(activePurposeId, direction)}
              onCropPointerDown={(handle, event) => beginCrop(activePurposeId, handle, event)}
              onCropPointerMove={moveCrop}
              onCropPointerUp={endCrop}
              onCropKeyboard={(handle, deltaX, deltaY) => stepCrop(activePurposeId, handle, deltaX, deltaY)}
              onSelectTextLayer={(layerId) => {
                setActiveTextLayerId(layerId);
                setToolbarOpen(true);
              }}
              onTextPointerDown={(layerId, event) => beginTextLayerDrag(activePurposeId, layerId, event)}
              onTextPointerMove={moveTextLayerDrag}
              onTextPointerUp={endTextLayerDrag}
            />
          </div>
          <div className="pointer-events-none absolute bottom-3 left-1/2 flex -translate-x-1/2 items-center gap-2 rounded-full border border-slate-200/80 bg-white/90 px-3 py-1.5 text-[10px] font-medium text-slate-500 shadow-sm backdrop-blur">
            {activeTextLayerId ? <Move className="h-3 w-3" /> : logoEditMode === 'crop' ? <Crop className="h-3 w-3" /> : logoEditMode === 'resize' ? <ZoomIn className="h-3 w-3" /> : <Move className="h-3 w-3" />}
            {activeTextLayerId
              ? 'Povlecite izbrano besedilo'
              : logoEditMode === 'crop'
                ? 'Povlecite robove izreza'
                : logoEditMode === 'resize'
                  ? 'Povlecite vogale za velikost'
                  : 'Povlecite logotip za premik'}
          </div>
        </div>
      </section>

      {toolbarOpen ? (
        <FloatingAppearanceEditorContextToolbar
          anchorId={activeTextLayerId ? `${activePurposeId}:${activeTextLayerId}` : activePurposeId}
          frameRef={editorFrameRef}
          viewportRef={previewViewportRef}
          ariaLabel={activeTextLayerId ? `Orodja za ${SITE_LOGO_TEXT_LAYER_META[activeTextLayerId].label}` : `Orodja za ${getPurposeDefinition(activePurposeId).label}`}
          testId="logo-context-toolbar"
          className="!transition-none"
        >
          {activeTextLayerId ? (
            <LogoTextContextToolbar
              config={config}
              purposeId={activePurposeId}
              layerId={activeTextLayerId}
              onConfigChange={setConfig}
              onSelectLayer={setActiveTextLayerId}
              onReturnToLogo={() => setActiveTextLayerId(null)}
              onClose={() => setToolbarOpen(false)}
            />
          ) : (
            <LogoContextToolbar
              config={config}
              purposeId={activePurposeId}
              showSafeArea={safeAreaVisibility[activePurposeId] ?? false}
              editMode={logoEditMode}
              onEditModeChange={setLogoEditMode}
              isAnalyzing={analyzingMasterId}
              onConfigChange={setConfig}
              onPlacementChange={(placement) => applyPlacement(activePurposeId, placement)}
              onShowSafeAreaChange={(show) => setSafeAreaVisibility((current) => ({ ...current, [activePurposeId]: show }))}
              onUpload={(slot, event) => void stageMaster(slot, event)}
              onRemoveMaster={removeMaster}
              onSelectTextLayer={setActiveTextLayerId}
              onClose={() => setToolbarOpen(false)}
            />
          )}
        </FloatingAppearanceEditorContextToolbar>
      ) : null}
    </div>
  );
}
