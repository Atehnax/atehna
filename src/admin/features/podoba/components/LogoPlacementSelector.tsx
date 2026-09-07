'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Check, X } from 'lucide-react';
import { adminControlFocusTokenClasses } from '@/shared/ui/theme/tokens';
import { AppearanceEditorCompactSelect } from './AppearanceEditorToolbarPrimitives';
import { publishedLogoProjection } from '@/shared/domain/logo/publishedLogo';
import {
  LOGO_PLACEMENT_LABELS, logoPlacementVariantId, logoVariantUsages,
  type LogoAssignment, type LogoLibrary, type LogoPlacementId, type PublishedSiteLogoConfig
} from '@/shared/domain/logo/logoLibrary';

const libraryChanged = 'admin-logo-library-changed';
let pendingLibrary: Promise<LogoLibrary> | null = null;
async function loadLibrary(): Promise<LogoLibrary> {
  if (!pendingLibrary) pendingLibrary = fetch('/api/admin/logo-library', { cache: 'no-store' })
    .then(async response => {
      const payload = await response.json();
      if (!response.ok || !payload.library) throw new Error(payload.message ?? 'Knjižnice logotipov ni mogoče naložiti.');
      return payload.library as LogoLibrary;
    }).finally(() => { pendingLibrary = null; });
  return pendingLibrary;
}
const selectionValue = (assignment: LogoAssignment) => assignment.variantId
  ? 'variant:' + assignment.variantId : 'fallback:' + assignment.fallback;
const assignmentFor = (value: string): LogoAssignment => value.startsWith('variant:')
  ? { variantId: value.slice(8), fallback: 'default' }
  : { variantId: null, fallback: value.slice(9) as LogoAssignment['fallback'] };

export type LogoPlacementSelectorProps = {
  purpose: LogoPlacementId;
  library?: LogoLibrary;
  onLibraryChange?: (library: LogoLibrary) => void;
  onAssigned?: (published: PublishedSiteLogoConfig) => void;
  onPreview?: (published: PublishedSiteLogoConfig | null) => void;
  compact?: boolean;
  toolbar?: boolean;
};

export default function LogoPlacementSelector({ purpose, library: initialLibrary, onLibraryChange, onAssigned, onPreview, compact = false, toolbar = false }: LogoPlacementSelectorProps) {
  const router = useRouter();
  const [library, setLibrary] = useState(initialLibrary ?? null);
  const [selection, setSelection] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  useEffect(() => { if (initialLibrary) setLibrary(initialLibrary); }, [initialLibrary]);
  useEffect(() => {
    let active = true;
    if (!initialLibrary) void loadLibrary().then(value => { if (active) setLibrary(value); }).catch(cause => {
      if (active) setError(cause instanceof Error ? cause.message : 'Knjižnica ni na voljo.');
    });
    const changed = (event: Event) => setLibrary((event as CustomEvent<LogoLibrary>).detail);
    window.addEventListener(libraryChanged, changed);
    return () => { active = false; window.removeEventListener(libraryChanged, changed); };
  }, [initialLibrary]);
  const stored = library?.placements[purpose];
  const value = selection ?? (stored ? selectionValue(stored) : 'fallback:original');
  const selectedAssignment = assignmentFor(value);
  const variantId = library ? logoPlacementVariantId({ placements: { ...library.placements, [purpose]: selectedAssignment } }, purpose) : null;
  const variant = library?.variants.find(candidate => candidate.id === variantId);
  const uses = library && variantId ? logoVariantUsages(library, variantId) : [];
  const editorHref = '/admin/podoba/logotip?' + new URLSearchParams({
    ...(variantId ? { variant: variantId } : {}), purpose
  });
  const changed = Boolean(stored && value !== selectionValue(stored));

  function chooseSelection(next: string) {
    setSelection(next); setNotice('');
    if (library) onPreview?.(publishedLogoProjection({
      ...library, placements: { ...library.placements, [purpose]: assignmentFor(next) }
    }));
  }
  function cancelSelection() {
    setSelection(null); setNotice(''); onPreview?.(null);
  }

  async function reload() {
    setError('');
    try { setLibrary(await loadLibrary()); } catch (cause) { setError(cause instanceof Error ? cause.message : 'Knjižnica ni na voljo.'); }
  }
  async function apply() {
    if (!library || busy || !changed) return;
    setBusy(true); setError(''); setNotice('');
    try {
      const response = await fetch('/api/admin/logo-library', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'assign', placements: { [purpose]: selectedAssignment }, expectedRevision: library.revision })
      });
      const payload = await response.json();
      if (!response.ok || !payload.library) throw new Error(payload.message ?? 'Uporabe logotipa ni mogoče shraniti.');
      const next = payload.library as LogoLibrary;
      setLibrary(next); setSelection(null); setNotice('Uporaba je shranjena.');
      onLibraryChange?.(next);
      if (payload.published) onAssigned?.(payload.published as PublishedSiteLogoConfig);
      window.dispatchEvent(new CustomEvent(libraryChanged, { detail: next }));
      router.refresh();
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Shranjevanje ni uspelo.'); }
    finally { setBusy(false); }
  }
  if (toolbar) {
    const options = [
      ...(purpose !== 'standalone' ? [{ value: 'fallback:default', label: 'Uporabi privzeti logotip' }] : []),
      { value: 'fallback:original', label: 'Izvirni logotip' },
      { value: 'fallback:brand', label: 'Besedilna znamka Atehna' },
      { value: 'fallback:none', label: 'Brez logotipa' },
      ...(library?.variants.map(candidate => ({
        value: 'variant:' + candidate.id,
        label: candidate.name + (candidate.published ? '' : ' · še ni objavljeno'),
        disabled: !candidate.published
      })) ?? [])
    ];
    const actionClassName = `inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-slate-300 bg-white text-slate-600 transition hover:bg-slate-50 hover:text-[color:var(--blue-500)] disabled:cursor-not-allowed disabled:opacity-40 ${adminControlFocusTokenClasses}`;
    return <div className="min-w-0 max-w-full" data-logo-placement-selector={purpose} data-logo-placement-toolbar>
      <div className="flex min-w-0 items-center gap-1.5" aria-busy={busy || (!library && !error)}>
        <AppearanceEditorCompactSelect
          value={library ? value : ''}
          options={options}
          ariaLabel={'Različica · ' + LOGO_PLACEMENT_LABELS[purpose]}
          placeholder={error ? 'Različice niso na voljo' : 'Nalaganje različic …'}
          disabled={!library || busy}
          tone="light"
          className="w-[200px] min-w-0 max-w-full shrink"
          triggerClassName="!h-7 !rounded-lg !border-slate-300 !bg-white !px-2.5 !text-[11px] !font-normal !text-slate-700"
          onValueChange={chooseSelection}
        />
        <button type="button" disabled={!changed || busy} onClick={() => void apply()}
          aria-label="Uporabi logotip" title={busy ? 'Shranjevanje …' : 'Uporabi logotip'}
          className={actionClassName}>
          <Check className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden="true" />
        </button>
        <button type="button" disabled={selection === null || busy}
          onClick={cancelSelection}
          aria-label="Prekliči izbiro logotipa" title="Prekliči izbiro logotipa"
          className={actionClassName}>
          <X className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden="true" />
        </button>
      </div>
      <p role="status" className="sr-only">{busy ? 'Shranjevanje …' : !library && !error ? 'Nalaganje različic …' : notice}</p>
      {error && <p role="alert" className="mt-1 max-w-xs text-[11px] text-red-700">{error} <button type="button" disabled={busy} onClick={() => void reload()} className="underline">Osveži</button></p>}
    </div>;
  }
  return <div className={compact ? 'min-w-0 space-y-1.5' : 'space-y-2 rounded-lg border border-slate-200 bg-white p-3'} data-logo-placement-selector={purpose}>
    <label className="grid gap-1 text-xs font-medium text-slate-600">
      {LOGO_PLACEMENT_LABELS[purpose]}
      <span className="flex min-w-0 flex-wrap items-center gap-2">
        {variant?.published && <Image src={variant.published.png.url} alt="" width={52} height={28} unoptimized className="h-7 w-13 rounded border border-slate-200 bg-slate-50 object-contain" />}
        <select aria-label={'Različica · ' + LOGO_PLACEMENT_LABELS[purpose]} value={value}
          disabled={!library || busy} onChange={event => chooseSelection(event.target.value)}
          className="h-8 min-w-40 max-w-full rounded-md border border-slate-300 bg-white px-2 text-xs font-normal text-slate-800">
          {purpose !== 'standalone' && <option value="fallback:default">Uporabi privzeti logotip</option>}
          <option value="fallback:original">Izvirni logotip</option>
          <option value="fallback:brand">Besedilna znamka Atehna</option>
          <option value="fallback:none">Brez logotipa</option>
          {library?.variants.map(candidate => <option key={candidate.id} value={'variant:' + candidate.id} disabled={!candidate.published}>
            {candidate.name}{candidate.published ? '' : ' · še ni objavljeno'}
          </option>)}
        </select>
      </span>
    </label>
    <div className="flex flex-wrap items-center gap-2 text-xs">
      <button type="button" disabled={!changed || busy} onClick={() => void apply()}
        className="h-8 rounded-md border border-slate-300 bg-white px-2.5 font-medium text-slate-700 disabled:opacity-40">
        {busy ? 'Shranjevanje …' : 'Uporabi'}
      </button>
      <Link href={editorHref} className="text-blue-700 underline">Uredi logotip</Link>
      {selection !== null && <button type="button" onClick={cancelSelection} className="text-slate-500 underline">Prekliči</button>}
    </div>
    {uses.length > 0 && <p className="max-w-lg text-[11px] leading-relaxed text-slate-500">Uporaba različice: {uses.map(id => LOGO_PLACEMENT_LABELS[id]).join(', ')}.</p>}
    {!library && !error && <p role="status" className="text-xs text-slate-500">Nalaganje različic …</p>}
    {notice && <p role="status" className="text-xs text-emerald-700">{notice}</p>}
    {error && <p role="alert" className="max-w-lg text-xs text-red-700">{error} <button type="button" onClick={() => void reload()} className="underline">Osveži</button></p>}
  </div>;
}
