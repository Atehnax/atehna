'use client';

import Image from 'next/image';
import { useState } from 'react';

type PreviewMode = {
  id: 'model' | 'exploded' | 'wireframe' | 'sheet';
  label: string;
  src: string;
  alt: string;
};

const previewModes: PreviewMode[] = [
  {
    id: 'model',
    label: 'Model',
    src: '/images/technical-preview/model.webp',
    alt: 'Lesen model terenskega vozila'
  },
  {
    id: 'exploded',
    label: 'Exploded',
    src: '/images/technical-preview/exploded.webp',
    alt: 'Razstavljen lesen model terenskega vozila'
  },
  {
    id: 'wireframe',
    label: 'Wireframe',
    src: '/images/technical-preview/wireframe.webp',
    alt: 'Žični prikaz lesenega modela terenskega vozila'
  },
  {
    id: 'sheet',
    label: 'Sheet',
    src: '/images/technical-preview/sheet.webp',
    alt: 'Pregledni tehnični prikaz lesenega modela terenskega vozila'
  }
];

function CubeIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" fill="none">
      <path
        d="m12 3 7 4v10l-7 4-7-4V7l7-4Zm0 8 7-4m-7 4L5 7m7 4v10"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function HandIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" fill="none">
      <path
        d="M7.8 11.8V7.2a1.2 1.2 0 0 1 2.4 0v4.1m0 .1V5.8a1.2 1.2 0 1 1 2.4 0v5.6m0 0V6.8a1.2 1.2 0 1 1 2.4 0v5.1m0 0V9a1.2 1.2 0 0 1 2.4 0v5.4c0 4-2.2 6.1-5.5 6.1h-.8c-2.2 0-3.6-1-4.9-2.9L4.4 15a1.2 1.2 0 0 1 1.9-1.4l1.5 1.8v-3.6Z"
        stroke="currentColor"
        strokeWidth="1.55"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ZoomIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" fill="none">
      <path
        d="M10.7 17.4a6.7 6.7 0 1 1 0-13.4 6.7 6.7 0 0 1 0 13.4Zm4.9-1.8L20 20m-9.3-12v5.4m-2.7-2.7h5.4"
        stroke="currentColor"
        strokeWidth="1.65"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ExpandIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" fill="none">
      <path
        d="M8.5 4H4v4.5M15.5 4H20v4.5M20 15.5V20h-4.5M4 15.5V20h4.5M9 9 4.6 4.6M15 9l4.4-4.4M15 15l4.4 4.4M9 15l-4.4 4.4"
        stroke="currentColor"
        strokeWidth="1.65"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function TechnicalPreview() {
  const [activeModeId, setActiveModeId] = useState<PreviewMode['id']>('model');
  const activeMode = previewModes.find((mode) => mode.id === activeModeId) ?? previewModes[0];

  return (
    <div className="relative h-[330px] w-full min-w-0 overflow-hidden rounded-[10px] border border-[#dfe5ed] bg-[#fbfcfd] shadow-[0_18px_55px_rgba(15,23,42,0.05)] sm:h-[390px] lg:h-[410px] xl:h-[430px]">
      <div className="pointer-events-none absolute inset-0 z-[1] opacity-70">
        <div className="absolute left-[14%] top-[19%] hidden h-[50%] border-l border-[#cbd2dc] lg:block">
          <span className="absolute -left-[5px] top-0 h-2.5 w-2.5 rounded-full bg-[#9aa3af]" />
          <span className="absolute -left-[5px] bottom-0 h-2.5 w-2.5 rounded-full bg-[#9aa3af]" />
          <span className="absolute left-[-42px] top-1/2 -translate-y-1/2 text-sm text-[#6f7a89]">
            105
          </span>
        </div>
        <div className="absolute bottom-[13%] left-[24%] hidden h-px w-[25%] -rotate-[18deg] bg-[#d2d8e1] lg:block">
          <span className="absolute -left-1 top-[-4px] h-2.5 w-2.5 rounded-full bg-[#a7afba]" />
          <span className="absolute -right-1 top-[-4px] h-2.5 w-2.5 rounded-full bg-[#a7afba]" />
          <span className="absolute left-1/2 top-3 -translate-x-1/2 rotate-[18deg] text-sm text-[#6f7a89]">
            192
          </span>
        </div>
        <div className="absolute bottom-[17%] right-[15%] hidden h-px w-[20%] -rotate-[13deg] bg-[#d2d8e1] lg:block">
          <span className="absolute -left-1 top-[-4px] h-2.5 w-2.5 rounded-full bg-[#a7afba]" />
          <span className="absolute -right-1 top-[-4px] h-2.5 w-2.5 rounded-full bg-[#a7afba]" />
          <span className="absolute left-1/2 top-3 -translate-x-1/2 rotate-[13deg] text-sm text-[#6f7a89]">
            92
          </span>
        </div>
      </div>

      <Image
        key={activeMode.id}
        src={activeMode.src}
        alt={activeMode.alt}
        fill
        priority={activeMode.id === 'model'}
        loading={activeMode.id === 'model' ? undefined : 'lazy'}
        sizes="(min-width: 1024px) 58vw, 100vw"
        quality={90}
        unoptimized
        className="technical-preview-image z-[2] object-contain"
      />

      <div
        aria-hidden="true"
        className="absolute right-4 top-1/2 z-[3] hidden -translate-y-1/2 rounded-xl border border-[#e3e8ef] bg-white/[0.82] p-2 text-[#4c5a6d] shadow-[0_8px_22px_rgba(15,23,42,0.05)] backdrop-blur sm:grid sm:gap-3"
      >
        <span className="text-[color:var(--blue-500)]">
          <CubeIcon />
        </span>
        <span>
          <HandIcon />
        </span>
        <span>
          <ZoomIcon />
        </span>
        <span>
          <ExpandIcon />
        </span>
      </div>

      <div
        role="group"
        aria-label="Način tehničnega prikaza"
        className="absolute bottom-4 left-4 z-[4] inline-flex rounded-lg border border-[#dce3ec] bg-white/[0.88] p-1 shadow-[0_10px_24px_rgba(15,23,42,0.06)] backdrop-blur"
      >
        {previewModes.map((mode) => {
          const isActive = mode.id === activeMode.id;
          return (
            <button
              key={mode.id}
              type="button"
              aria-pressed={isActive}
              onClick={() => setActiveModeId(mode.id)}
              className={`rounded-md px-3 py-1.5 text-xs font-semibold transition sm:px-4 ${
                isActive
                  ? 'bg-[color:var(--blue-500)] text-white'
                  : 'text-[#536070] hover:bg-[#f2f5f9] hover:text-[#0b1320]'
              }`}
            >
              {mode.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
