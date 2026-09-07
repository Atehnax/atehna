"use client";

import { adminControlFocusTokenClasses } from '@/shared/ui/theme/tokens';

export type AppearanceDevice = 'desktop' | 'tablet' | 'mobile';
export const APPEARANCE_DEVICE_LABELS: Record<AppearanceDevice, string> = {
  desktop: 'Desktop',
  tablet: 'Tablica',
  mobile: 'Mobilno'
};

function AppearanceDeviceGlyph({ device }: { device: AppearanceDevice }) {
  if (device === 'mobile') {
    return (
      <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
        <rect x="6.5" y="2.5" width="7" height="15" rx="1.5" />
        <path d="M9 15.5h2" />
      </svg>
    );
  }

  if (device === 'tablet') {
    return (
      <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
        <rect x="4.5" y="3" width="11" height="14" rx="1.7" />
        <path d="M9 14.5h2" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
      <rect x="3" y="4" width="14" height="10" rx="1.5" />
      <path d="M8 17h4M10 14v3" />
    </svg>
  );
}

export default function AppearanceDeviceSelector({ value, onChange, ariaLabel = 'Naprava za predogled' }: {
  value: AppearanceDevice;
  onChange: (device: AppearanceDevice) => void;
  ariaLabel?: string;
}) {
  return (
    <div className="flex shrink-0 items-center gap-2" role="group" aria-label={ariaLabel}>
      {(Object.keys(APPEARANCE_DEVICE_LABELS) as AppearanceDevice[]).map((device) => (
        <button
          key={device}
          type="button"
          className={`inline-flex h-8 items-center gap-1.5 rounded-md px-2.5 text-[12px] font-medium leading-none transition ${adminControlFocusTokenClasses} ${
            value === device ? 'text-[color:var(--blue-500)]' : 'text-slate-500 hover:text-[color:var(--blue-500)]'
          }`}
          aria-pressed={value === device}
          onClick={() => onChange(device)}
        >
          <AppearanceDeviceGlyph device={device} />
          {APPEARANCE_DEVICE_LABELS[device]}
        </button>
      ))}
    </div>
  );
}
