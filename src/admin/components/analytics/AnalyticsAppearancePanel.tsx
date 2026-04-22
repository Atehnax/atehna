'use client';

import type { AnalyticsGlobalAppearance } from '@/shared/server/analyticsCharts';

function isHexColor(value: string) {
  return /^#([0-9A-Fa-f]{6}|[0-9A-Fa-f]{8})$/.test(value.trim());
}

function ColorPopoverField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  const isValid = isHexColor(value);
  const safeValue = isValid ? value : '#000000';
  return (
    <div className="text-xs text-slate-600">
      <span>{label}</span>
      <details className="relative mt-1">
        <summary className="list-none cursor-pointer">
          <span className={`inline-flex h-8 w-full items-center justify-between rounded border px-2 ${isValid ? 'border-slate-300 bg-white' : 'border-rose-300 bg-rose-50'}`}>
            <span className="font-mono text-xs">{value}</span>
            <span className="h-4 w-4 rounded border border-slate-300" style={{ backgroundColor: safeValue }} />
          </span>
        </summary>
        <div className="absolute z-20 mt-1 w-56 rounded-md border border-slate-200 bg-white p-2 shadow-lg">
          <input type="color" className="h-8 w-full cursor-pointer rounded border border-slate-200" value={safeValue} onChange={(event) => onChange(event.target.value)} />
          <input className={`mt-2 w-full rounded border px-2 py-1 font-mono text-xs ${isValid ? 'border-slate-300' : 'border-rose-300 bg-rose-50'}`} value={value} onChange={(event) => onChange(event.target.value)} placeholder="#RRGGBB" aria-label={`${label} HEX`} />
          {!isValid ? <span className="mt-1 block text-[11px] text-rose-500">Use HEX like #RRGGBB.</span> : null}
        </div>
      </details>
    </div>
  );
}

export default function AnalyticsAppearancePanel({ appearance, savedAppearance, onChange, onSave, onReset }: { appearance: AnalyticsGlobalAppearance; savedAppearance: AnalyticsGlobalAppearance; onChange: (appearance: AnalyticsGlobalAppearance) => void; onSave: () => Promise<void>; onReset: () => void; }) {
  const dirty = JSON.stringify(appearance) !== JSON.stringify(savedAppearance);
  const canSave = [appearance.sectionBg, appearance.canvasBg, appearance.cardBg, appearance.plotBg, appearance.axisTextColor, appearance.gridColor].every(isHexColor) && appearance.seriesPalette.every(isHexColor);

  return (
    <details className="mb-3 rounded-lg border border-slate-200 bg-white p-3 shadow-sm" open>
      <summary className="cursor-pointer text-xs font-semibold text-slate-700">Appearance / Theme {dirty ? <span className="ml-2 text-amber-600">• Unsaved changes</span> : null}</summary>
      <div className="mt-3 grid gap-3 md:grid-cols-3">
        <ColorPopoverField label="Analytics section background" value={appearance.sectionBg} onChange={(value) => onChange({ ...appearance, sectionBg: value })} />
        <ColorPopoverField label="Canvas background (paper_bgcolor)" value={appearance.canvasBg} onChange={(value) => onChange({ ...appearance, canvasBg: value })} />
        <ColorPopoverField label="Card background" value={appearance.cardBg} onChange={(value) => onChange({ ...appearance, cardBg: value })} />
        <ColorPopoverField label="Plot area background (plot_bgcolor)" value={appearance.plotBg} onChange={(value) => onChange({ ...appearance, plotBg: value })} />
        <ColorPopoverField label="Axis text color" value={appearance.axisTextColor} onChange={(value) => onChange({ ...appearance, axisTextColor: value })} />
        <ColorPopoverField label="Grid color" value={appearance.gridColor} onChange={(value) => onChange({ ...appearance, gridColor: value })} />
      </div>
      <div className="mt-3 grid gap-2 md:grid-cols-5">
        {appearance.seriesPalette.map((color, index) => (
          <ColorPopoverField key={index} label={`Series ${index + 1}`} value={color} onChange={(value) => onChange({ ...appearance, seriesPalette: appearance.seriesPalette.map((entry, entryIndex) => (entryIndex === index ? value : entry)) })} />
        ))}
      </div>
      <div className="mt-3 flex justify-end gap-2">
        <button className="rounded border border-slate-300 bg-white px-3 py-1 text-xs text-slate-700" onClick={onReset} disabled={!dirty}>Reset</button>
        <button className="rounded border border-sky-500 bg-sky-600 px-3 py-1 text-xs text-white disabled:opacity-50" onClick={() => void onSave()} disabled={!dirty || !canSave}>Save appearance</button>
      </div>
    </details>
  );
}
