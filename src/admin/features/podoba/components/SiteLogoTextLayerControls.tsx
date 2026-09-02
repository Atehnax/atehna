'use client';

import { useEffect, useState } from 'react';
import { Eye, EyeOff, RotateCcw, Trash2, Type } from 'lucide-react';
import {
  SITE_LOGO_TEXT_CONTENT_MAX_LENGTH,
  SITE_LOGO_TEXT_FONT_FAMILIES,
  SITE_LOGO_TEXT_FONT_SIZE_MAX_PX,
  SITE_LOGO_TEXT_FONT_SIZE_MIN_PX,
  SITE_LOGO_TEXT_FONT_STYLES,
  SITE_LOGO_TEXT_FONT_WEIGHTS,
  SITE_LOGO_TEXT_LAYER_IDS,
  SITE_LOGO_TEXT_LETTER_SPACING_MAX_PX,
  SITE_LOGO_TEXT_LETTER_SPACING_MIN_PX,
  SITE_LOGO_TEXT_POSITION_MAX,
  SITE_LOGO_TEXT_POSITION_MIN,
  resetSiteLogoTextLayer,
  resolveSiteLogoPresentation,
  sanitizeSiteLogoTextContent,
  updateSiteLogoTextLayer,
  type SiteLogoConfig,
  type SiteLogoPurposeId,
  type SiteLogoTextLayer,
  type SiteLogoTextLayerId
} from '@/shared/domain/logo/siteLogo';
import { adminControlFocusTokenClasses } from '@/shared/ui/theme/tokens';
import {
  AppearanceEditorAlignmentControl,
  AppearanceEditorCompactSelect
} from './AppearanceEditorToolbarPrimitives';

export const SITE_LOGO_TEXT_LAYER_META: Record<
  SiteLogoTextLayerId,
  { label: string; shortLabel: string; description: string }
> = {
  secondaryText: {
    label: 'Pravna oblika',
    shortLabel: 'd.o.o.',
    description: 'Besedilo ob imenu ATEHNA.'
  },
  taglineText: {
    label: 'Slogan',
    shortLabel: 'varčevanje z energijo',
    description: 'Besedilo v spodnjem pasu logotipa.'
  }
};

const darkFieldClassName = `h-8 min-w-0 rounded-md border border-white/15 bg-slate-800 px-2 text-[10px] font-medium text-white outline-none transition placeholder:text-white/30 hover:border-white/25 focus:border-blue-300 ${adminControlFocusTokenClasses}`;

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

function CompactNumber({
  label,
  value,
  min,
  max,
  step,
  unit,
  marker,
  onChange
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit: string;
  marker: string;
  onChange: (value: number) => void;
}) {
  return (
    <label
      className="flex min-w-0 items-center gap-1.5 rounded-md border border-white/10 bg-white/5 px-2 py-1.5"
      data-logo-text-control={marker}
    >
      <span className="shrink-0 text-[9px] font-semibold text-white/50">{label}</span>
      <span className="ml-auto flex h-6 min-w-0 max-w-[88px] items-center overflow-hidden rounded border border-white/10 bg-slate-800">
        <input
          type="number"
          value={Number(value.toFixed(2))}
          min={min}
          max={max}
          step={step}
          onChange={(event) => {
            const next = event.currentTarget.valueAsNumber;
            if (Number.isFinite(next)) onChange(clamp(next, min, max));
          }}
          className="h-full min-w-0 flex-1 bg-transparent px-1.5 text-right text-[10px] font-semibold tabular-nums text-white outline-none"
          aria-label={label}
        />
        <span className="grid min-w-6 place-items-center pr-1 text-[8px] text-white/35">{unit}</span>
      </span>
    </label>
  );
}

export function SiteLogoTextLayerFields({
  layerId,
  layer,
  onChange
}: {
  layerId: SiteLogoTextLayerId;
  layer: SiteLogoTextLayer;
  onChange: (updates: Partial<SiteLogoTextLayer>) => void;
}) {
  const meta = SITE_LOGO_TEXT_LAYER_META[layerId];
  const [contentDraft, setContentDraft] = useState(layer.content);

  useEffect(() => {
    setContentDraft(layer.content);
  }, [layer.content, layerId]);

  const commitContent = () => {
    const committed = sanitizeSiteLogoTextContent(contentDraft, layer.content);
    setContentDraft(committed);
    if (committed !== layer.content) onChange({ content: committed });
  };

  return (
    <div className="space-y-2" data-logo-text-layer-fields={layerId}>
      <label className="grid gap-1 text-[9px] font-semibold text-white/55" data-logo-text-control="content">
        Besedilo
        <input
          type="text"
          value={contentDraft}
          maxLength={SITE_LOGO_TEXT_CONTENT_MAX_LENGTH}
          onChange={(event) => setContentDraft(event.currentTarget.value)}
          onBlur={commitContent}
          onKeyDown={(event) => {
            if (event.nativeEvent.isComposing) return;
            if (event.key === 'Enter') {
              event.preventDefault();
              commitContent();
            } else if (event.key === 'Escape') {
              event.preventDefault();
              setContentDraft(layer.content);
            }
          }}
          className={darkFieldClassName}
          aria-label={`Besedilo: ${meta.label}`}
          data-logo-text-content-draft
        />
      </label>

      <div className="grid grid-cols-2 gap-1.5" aria-label={`Položaj: ${meta.label}`}>
        <CompactNumber
          label="X"
          value={layer.x * 100}
          min={SITE_LOGO_TEXT_POSITION_MIN * 100}
          max={SITE_LOGO_TEXT_POSITION_MAX * 100}
          step={0.5}
          unit="%"
          marker="x"
          onChange={(value) => onChange({ x: value / 100 })}
        />
        <CompactNumber
          label="Y"
          value={layer.y * 100}
          min={SITE_LOGO_TEXT_POSITION_MIN * 100}
          max={SITE_LOGO_TEXT_POSITION_MAX * 100}
          step={0.5}
          unit="%"
          marker="y"
          onChange={(value) => onChange({ y: value / 100 })}
        />
      </div>

      <div className="grid gap-1 text-[9px] font-semibold text-white/55" data-logo-text-control="fontFamily">
        <span>Pisava</span>
        <AppearanceEditorCompactSelect
          value={layer.fontFamily}
          tone="dark"
          options={SITE_LOGO_TEXT_FONT_FAMILIES.map((fontFamily) => ({ value: fontFamily, label: fontFamily }))}
          ariaLabel={`Pisava: ${meta.label}`}
          marker={`logo-text-${layerId}-font-family`}
          triggerClassName="rounded-md text-[10px]"
          onValueChange={(fontFamily) => onChange({ fontFamily })}
        />
      </div>

      <div className="grid grid-cols-2 gap-1.5">
        <CompactNumber
          label="Velikost"
          value={layer.fontSizePx}
          min={SITE_LOGO_TEXT_FONT_SIZE_MIN_PX}
          max={SITE_LOGO_TEXT_FONT_SIZE_MAX_PX}
          step={1}
          unit="px"
          marker="fontSizePx"
          onChange={(fontSizePx) => onChange({ fontSizePx })}
        />
        <CompactNumber
          label="Razmik"
          value={layer.letterSpacingPx}
          min={SITE_LOGO_TEXT_LETTER_SPACING_MIN_PX}
          max={SITE_LOGO_TEXT_LETTER_SPACING_MAX_PX}
          step={1}
          unit="px"
          marker="letterSpacingPx"
          onChange={(letterSpacingPx) => onChange({ letterSpacingPx })}
        />
      </div>

      <div className="grid grid-cols-2 gap-1.5">
        <div className="grid gap-1 text-[9px] font-semibold text-white/55" data-logo-text-control="fontWeight">
          <span>Debelina</span>
          <AppearanceEditorCompactSelect
            value={String(layer.fontWeight)}
            tone="dark"
            options={SITE_LOGO_TEXT_FONT_WEIGHTS.map((fontWeight) => ({ value: String(fontWeight), label: String(fontWeight) }))}
            ariaLabel={`Debelina pisave: ${meta.label}`}
            marker={`logo-text-${layerId}-font-weight`}
            triggerClassName="rounded-md text-[10px]"
            onValueChange={(fontWeight) => onChange({ fontWeight: Number(fontWeight) as SiteLogoTextLayer['fontWeight'] })}
          />
        </div>
        <div className="grid gap-1" data-logo-text-control="fontStyle">
          <span className="text-[9px] font-semibold text-white/55">Slog</span>
          <span className="flex h-8 rounded-md border border-white/15 bg-slate-800 p-0.5">
            {SITE_LOGO_TEXT_FONT_STYLES.map((fontStyle) => (
              <button
                key={fontStyle}
                type="button"
                aria-pressed={layer.fontStyle === fontStyle}
                onClick={() => onChange({ fontStyle })}
                className={`min-w-9 rounded px-2 text-[10px] font-semibold transition ${
                  layer.fontStyle === fontStyle
                    ? 'bg-white/15 text-white'
                    : 'text-white/45 hover:bg-white/10 hover:text-white/80'
                } ${fontStyle === 'italic' ? 'italic' : ''}`}
                title={fontStyle === 'italic' ? 'Ležeče' : 'Pokončno'}
              >
                {fontStyle === 'italic' ? 'I' : 'A'}
              </button>
            ))}
          </span>
        </div>
      </div>

      <div className="grid gap-1" data-logo-text-control="textAlign">
        <span className="text-[9px] font-semibold text-white/55">Poravnava</span>
        <AppearanceEditorAlignmentControl
          value={layer.textAlign}
          options={['left', 'center', 'right'] as const}
          className="w-full"
          ariaLabel={`Poravnava: ${meta.label}`}
          onValueChange={(textAlign) => onChange({ textAlign })}
        />
      </div>
    </div>
  );
}

export function SiteLogoTextLayerManager({
  config,
  purposeId,
  selectedLayerId,
  showFields = false,
  onSelect,
  onLayerDisabled,
  onConfigChange
}: {
  config: SiteLogoConfig;
  purposeId: SiteLogoPurposeId;
  selectedLayerId?: SiteLogoTextLayerId | null;
  showFields?: boolean;
  onSelect?: (layerId: SiteLogoTextLayerId) => void;
  onLayerDisabled?: (layerId: SiteLogoTextLayerId) => void;
  onConfigChange: (config: SiteLogoConfig) => void;
}) {
  const [internalSelectedLayerId, setInternalSelectedLayerId] = useState<SiteLogoTextLayerId>('secondaryText');
  const presentation = resolveSiteLogoPresentation(config.placements[purposeId]);
  const activeLayerId = selectedLayerId ?? internalSelectedLayerId;
  const select = (layerId: SiteLogoTextLayerId) => {
    setInternalSelectedLayerId(layerId);
    onSelect?.(layerId);
  };

  return (
    <div className="space-y-2" data-logo-text-layer-manager>
      <div className="grid gap-1.5">
        {SITE_LOGO_TEXT_LAYER_IDS.map((layerId) => {
          const layer = presentation[layerId];
          const meta = SITE_LOGO_TEXT_LAYER_META[layerId];
          const active = activeLayerId === layerId;
          return (
            <div
              key={layerId}
              data-logo-text-layer-row={layerId}
              className={`flex min-w-0 items-center gap-1 rounded-lg border p-1 ${
                active ? 'border-blue-300/40 bg-blue-400/10' : 'border-white/10 bg-white/5'
              }`}
            >
              <button
                type="button"
                onClick={() => select(layerId)}
                className="flex min-w-0 flex-1 items-center gap-2 rounded-md px-1.5 py-1 text-left hover:bg-white/5"
                aria-pressed={active}
              >
                <Type className="h-3.5 w-3.5 shrink-0 text-blue-200" />
                <span className="min-w-0">
                  <span className="block truncate text-[10px] font-semibold text-white/85">{meta.label}</span>
                  <span className="block truncate text-[8px] text-white/40">{layer.content || meta.shortLabel}</span>
                </span>
              </button>
              {layer.enabled ? (
                <>
                  <button
                    type="button"
                    data-logo-text-hide={layerId}
                    onClick={() => {
                      onConfigChange(updateSiteLogoTextLayer(config, purposeId, layerId, { enabled: false }));
                      onLayerDisabled?.(layerId);
                    }}
                    className="grid h-7 w-7 shrink-0 place-items-center rounded-md text-white/55 hover:bg-white/10 hover:text-white"
                    aria-label={`Skrij: ${meta.label}`}
                    title="Skrij"
                  >
                    <Eye className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    data-logo-text-remove={layerId}
                    onClick={() => {
                      onConfigChange(updateSiteLogoTextLayer(
                        resetSiteLogoTextLayer(config, purposeId, layerId),
                        purposeId,
                        layerId,
                        { enabled: false }
                      ));
                      onLayerDisabled?.(layerId);
                    }}
                    className="grid h-7 w-7 shrink-0 place-items-center rounded-md text-white/45 hover:bg-red-400/15 hover:text-red-200"
                    aria-label={`Odstrani in ponastavi: ${meta.label}`}
                    title="Odstrani in ponastavi"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  data-logo-text-restore={layerId}
                  onClick={() => {
                    onConfigChange(updateSiteLogoTextLayer(config, purposeId, layerId, { enabled: true }));
                    select(layerId);
                  }}
                  className="inline-flex h-7 shrink-0 items-center gap-1 rounded-md bg-blue-400/15 px-2 text-[9px] font-semibold text-blue-100 hover:bg-blue-400/25"
                >
                  <EyeOff className="h-3 w-3" /> Obnovi
                </button>
              )}
            </div>
          );
        })}
      </div>

      {showFields && presentation[activeLayerId].enabled ? (
        <div className="rounded-lg border border-white/10 bg-black/10 p-2.5">
          <div className="mb-2 flex items-center justify-between gap-2">
            <span className="text-[10px] font-semibold text-white/80">{SITE_LOGO_TEXT_LAYER_META[activeLayerId].label}</span>
            <button
              type="button"
              onClick={() => onConfigChange(resetSiteLogoTextLayer(config, purposeId, activeLayerId))}
              className="grid h-6 w-6 place-items-center rounded text-white/45 hover:bg-white/10 hover:text-white"
              aria-label={`Ponastavi: ${SITE_LOGO_TEXT_LAYER_META[activeLayerId].label}`}
              title="Ponastavi"
            >
              <RotateCcw className="h-3 w-3" />
            </button>
          </div>
          <SiteLogoTextLayerFields
            layerId={activeLayerId}
            layer={presentation[activeLayerId]}
            onChange={(updates) => onConfigChange(updateSiteLogoTextLayer(
              config,
              purposeId,
              activeLayerId,
              updates
            ))}
          />
        </div>
      ) : null}
    </div>
  );
}
