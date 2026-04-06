'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { Button } from '@/shared/ui/button';
import { Chip } from '@/shared/ui/badge';
import { AdminCheckbox } from '@/shared/ui/checkbox';
import { IconButton } from '@/shared/ui/icon-button';
import { MoreActionsIcon, PlusIcon } from '@/shared/ui/icons/AdminActionIcons';
import { useToast } from '@/shared/ui/toast';
import {
  buildFamiliesFromSeed,
  computeSalePrice,
  createFamily,
  createVariant,
  formatCurrency,
  statusLabel,
  toSlug,
  type ProductFamily,
  type SeedItemTuple,
  type Variant,
  variantLabel
} from '@/admin/features/artikli/lib/familyModel';

const inputClass = 'h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-[#2f66dd]';

type EditorMode = 'create' | 'edit';
type CreateType = 'simple' | 'variants';

export default function AdminItemEditorPage({
  seedItems,
  articleId,
  mode,
  createType = 'simple'
}: {
  seedItems: SeedItemTuple[];
  articleId?: string;
  mode: EditorMode;
  createType?: CreateType;
}) {
  const { toast } = useToast();
  const families = useMemo(() => buildFamiliesFromSeed(seedItems), [seedItems]);
  const existing = mode === 'edit' ? families.find((family) => family.id === articleId) ?? null : null;

  const [draft, setDraft] = useState<ProductFamily>(() => {
    if (existing) return structuredClone(existing);
    return createFamily({
      variants: createType === 'variants' ? [createVariant()] : [createVariant({ label: 'Osnovni artikel' })],
      active: true
    });
  });
  const [variantSelections, setVariantSelections] = useState<Set<string>>(new Set());
  const [rightTab, setRightTab] = useState<'dodatno' | 'slike'>('dodatno');
  const [attrValues, setAttrValues] = useState({ width: '100, 200', length: '100, 200', thickness: '0,5' });
  const [sideSettings, setSideSettings] = useState({
    material: '',
    surface: '',
    moq: 1,
    warehouseLocation: '',
    showGallery: true,
    imageAltText: '',
    videoUrl: ''
  });

  const priceValues = draft.variants.map((variant) => variant.price);
  const priceRange = priceValues.length ? `${formatCurrency(Math.min(...priceValues))} – ${formatCurrency(Math.max(...priceValues))}` : '—';

  const save = (asDraft = false) => {
    if (!draft.name.trim()) {
      toast.error('Naziv je obvezen.');
      return;
    }
    if (!draft.category.trim()) {
      toast.error('Kategorija je obvezna.');
      return;
    }
    toast.success(asDraft ? 'Osnutek shranjen (lokalno).' : 'Artikel shranjen (lokalno).');
  };

  const generateVariants = () => {
    const parse = (value: string) => value.split(',').map((entry) => Number(entry.trim().replace(',', '.'))).filter((entry) => Number.isFinite(entry));
    const widths = parse(attrValues.width);
    const lengths = parse(attrValues.length);
    const thicknesses = parse(attrValues.thickness);

    if (widths.length === 0 || lengths.length === 0 || thicknesses.length === 0) {
      toast.error('Vnesite številčne vrednosti atributov.');
      return;
    }

    const generated: Variant[] = [];
    widths.forEach((width) => lengths.forEach((length) => thicknesses.forEach((thickness) => {
      generated.push(createVariant({
        label: `${width} × ${length} × ${thickness} mm`,
        width,
        length,
        thickness,
        sku: `${toSlug(draft.name || 'artikel').toUpperCase()}-${width}${length}${thickness}`,
        discountPct: draft.defaultDiscountPct,
        sort: generated.length + 1
      }));
    })));

    setDraft((current) => ({ ...current, variants: generated }));
    setVariantSelections(new Set());
  };

  return (
    <div className="space-y-4 font-['Inter',system-ui,sans-serif]">
      <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3">
        <div>
          <div className="mb-1 text-xs text-slate-500"><Link href="/admin/artikli" className="hover:underline">Artikli</Link> › {mode === 'create' ? 'Nov artikel' : draft.name || 'Uredi artikel'}</div>
          <div className="flex items-center gap-2">
            <h1 className="text-3xl font-semibold text-slate-900">{mode === 'create' ? 'Nov artikel' : draft.name || 'Uredi artikel'}</h1>
            <Chip variant={draft.active ? 'success' : 'warning'}>{statusLabel(draft.active)}</Chip>
          </div>
          <p className="text-sm text-slate-500">Ustvarite artikel z različicami ali brez njih. Spremembe so pripravljene za shranjevanje.</p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/admin/artikli"><Button type="button" variant="default" size="toolbar">Prekliči</Button></Link>
          <Button type="button" variant="default" size="toolbar" onClick={() => save(true)}>Shrani osnutek</Button>
          <Button type="button" variant="primary" size="toolbar" onClick={() => save(false)}>Shrani</Button>
          <IconButton type="button" tone="neutral"><MoreActionsIcon /></IconButton>
        </div>
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)_320px] gap-4">
        <div className="space-y-4">
          <section className="rounded-xl border border-slate-200 bg-white p-4">
            <h2 className="mb-3 text-2xl font-semibold">Osnovno</h2>
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2 space-y-1"><label className="text-xs text-slate-600">Naziv</label><input className={inputClass} value={draft.name} onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))} /></div>
              <div className="space-y-1"><label className="text-xs text-slate-600">Status</label><select className={inputClass} value={draft.active ? 'active' : 'hidden'} onChange={(event) => setDraft((current) => ({ ...current, active: event.target.value === 'active' }))}><option value="active">Aktiven</option><option value="hidden">Skrit</option></select></div>
              <div className="space-y-1"><label className="text-xs text-slate-600">Kategorija</label><input className={inputClass} value={draft.category} onChange={(event) => setDraft((current) => ({ ...current, category: event.target.value }))} /></div>
              <div className="space-y-1"><label className="text-xs text-slate-600">Podkategorija</label><input className={inputClass} value={draft.subcategoryId ?? ''} onChange={(event) => setDraft((current) => ({ ...current, subcategoryId: event.target.value || null }))} /></div>
              <div className="space-y-1"><label className="text-xs text-slate-600">Datum objave</label><input type="date" className={inputClass} /></div>
              <div className="col-span-2 space-y-1"><label className="text-xs text-slate-600">Opis</label><textarea className={`${inputClass} !h-28 py-2`} value={draft.description} onChange={(event) => setDraft((current) => ({ ...current, description: event.target.value }))} /></div>
              <div className="space-y-1"><label className="text-xs text-slate-600">Oznake (badge)</label><input className={inputClass} value={draft.promoBadge} onChange={(event) => setDraft((current) => ({ ...current, promoBadge: event.target.value }))} placeholder="Akcija, Novo ..." /></div>
              <div className="col-span-2 space-y-1"><label className="text-xs text-slate-600">Kratek URL (slug)</label><input className={inputClass} value={draft.slug} onChange={(event) => setDraft((current) => ({ ...current, slug: event.target.value }))} placeholder={toSlug(draft.name)} /></div>
              <label className="col-span-1 mt-2 inline-flex items-center gap-2 text-sm"><AdminCheckbox checked={draft.active} onChange={(event) => setDraft((current) => ({ ...current, active: event.target.checked }))} />Vidno v katalogu</label>
            </div>
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-4">
            <h2 className="mb-1 text-2xl font-semibold">Slike</h2>
            <p className="mb-3 text-sm text-slate-500">Galerija artikla. Prva slika je glavna.</p>
            <div className="grid grid-cols-5 gap-2">
              {draft.images.map((img, index) => <div key={`${img}-${index}`} className="relative overflow-hidden rounded-lg border border-slate-200"><Image src={img} alt={`Slika ${index + 1}`} width={180} height={120} unoptimized className="h-28 w-full object-cover" /></div>)}
              <label className="flex h-28 cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed border-slate-300 text-sm text-slate-500 hover:border-[#2f66dd]">Dodaj slike<input type="file" className="hidden" multiple accept="image/*" onChange={(event) => {
                const urls = Array.from(event.target.files ?? []).map((file) => URL.createObjectURL(file));
                setDraft((current) => ({ ...current, images: [...current.images, ...urls] }));
              }} /></label>
            </div>
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-2xl font-semibold">Različice</h2>
              <div className="flex gap-2"><Button type="button" variant="default" size="toolbar">Uredi atribute</Button><Button type="button" variant="primary" size="toolbar" onClick={generateVariants}>Generiraj različice</Button></div>
            </div>
            <div className="mb-3 grid grid-cols-3 gap-2">
              <div className="space-y-1"><label className="text-xs text-slate-600">Širina (mm)</label><input className={inputClass} value={attrValues.width} onChange={(event) => setAttrValues((current) => ({ ...current, width: event.target.value }))} /></div>
              <div className="space-y-1"><label className="text-xs text-slate-600">Dolžina (mm)</label><input className={inputClass} value={attrValues.length} onChange={(event) => setAttrValues((current) => ({ ...current, length: event.target.value }))} /></div>
              <div className="space-y-1"><label className="text-xs text-slate-600">Debelina (mm)</label><input className={inputClass} value={attrValues.thickness} onChange={(event) => setAttrValues((current) => ({ ...current, thickness: event.target.value }))} /></div>
            </div>
            <div className="overflow-x-auto rounded-lg border border-slate-200">
              <table className="min-w-full text-xs"><thead className="bg-slate-50"><tr><th className="px-2 py-2" /><th className="px-2 py-2 text-left">Širina</th><th className="px-2 py-2 text-left">Dolžina</th><th className="px-2 py-2 text-left">Debelina</th><th className="px-2 py-2 text-left">SKU</th><th className="px-2 py-2 text-left">Cena</th><th className="px-2 py-2 text-left">Popust</th><th className="px-2 py-2 text-left">Akcijska cena</th><th className="px-2 py-2 text-left">Zaloga</th><th className="px-2 py-2 text-left">Status</th><th className="px-2 py-2 text-left">Sort</th><th className="px-2 py-2 text-right">Akcije</th></tr></thead><tbody>{draft.variants.map((variant, index) => <tr key={variant.id} className="border-t border-slate-100"><td className="px-2 py-2"><AdminCheckbox checked={variantSelections.has(variant.id)} onChange={() => setVariantSelections((current) => { const next = new Set(current); if (next.has(variant.id)) next.delete(variant.id); else next.add(variant.id); return next; })} /></td><td className="px-2 py-2">{variant.width ?? '—'}</td><td className="px-2 py-2">{variant.length ?? '—'}</td><td className="px-2 py-2">{variant.thickness ?? '—'}</td><td className="px-2 py-2"><input className={`${inputClass} !h-8`} value={variant.sku} onChange={(event) => setDraft((current) => { const next = [...current.variants]; next[index] = { ...next[index], sku: event.target.value }; return { ...current, variants: next }; })} /></td><td className="px-2 py-2"><input type="number" className={`${inputClass} !h-8`} value={variant.price} onChange={(event) => setDraft((current) => { const next = [...current.variants]; next[index] = { ...next[index], price: Number(event.target.value) || 0 }; return { ...current, variants: next }; })} /></td><td className="px-2 py-2"><input type="number" className={`${inputClass} !h-8`} value={variant.discountPct} onChange={(event) => setDraft((current) => { const next = [...current.variants]; next[index] = { ...next[index], discountPct: Number(event.target.value) || 0 }; return { ...current, variants: next }; })} /></td><td className="px-2 py-2">{formatCurrency(computeSalePrice(variant.price, variant.discountPct))}</td><td className="px-2 py-2"><input type="number" className={`${inputClass} !h-8`} value={variant.stock} onChange={(event) => setDraft((current) => { const next = [...current.variants]; next[index] = { ...next[index], stock: Number(event.target.value) || 0 }; return { ...current, variants: next }; })} /></td><td className="px-2 py-2"><Chip variant={variant.active ? 'success' : 'warning'}>{statusLabel(variant.active)}</Chip></td><td className="px-2 py-2"><input type="number" className={`${inputClass} !h-8`} value={variant.sort} onChange={(event) => setDraft((current) => { const next = [...current.variants]; next[index] = { ...next[index], sort: Number(event.target.value) || 1 }; return { ...current, variants: next }; })} /></td><td className="px-2 py-2 text-right"><IconButton type="button" tone="neutral" onClick={() => setDraft((current) => ({ ...current, variants: current.variants.filter((entry) => entry.id !== variant.id) }))}><MoreActionsIcon /></IconButton></td></tr>)}</tbody></table>
            </div>
            <Button type="button" variant="ghost" size="toolbar" className="mt-3" onClick={() => setDraft((current) => ({ ...current, variants: [...current.variants, createVariant({ sort: current.variants.length + 1 })] }))}><PlusIcon />Dodaj različico</Button>
          </section>

          <div className="grid grid-cols-2 gap-4">
            <section className="rounded-xl border border-slate-200 bg-white p-4"><h3 className="mb-3 text-xl font-semibold">Hitre akcije</h3><div className="flex flex-wrap gap-2"><Button type="button" variant="default" size="toolbar">Uvozi iz CSV</Button><Button type="button" variant="default" size="toolbar">Podvoji izdelek</Button><Button type="button" variant="default" size="toolbar" className="text-red-600">Izbriši izdelek</Button></div></section>
            <section className="rounded-xl border border-slate-200 bg-slate-50 p-4"><h3 className="mb-2 text-xl font-semibold">Povzetek</h3><p className="text-sm text-slate-600">{draft.variants.length} različic</p><p className="text-sm text-slate-600">Razpon cen: {priceRange}</p><p className="text-sm text-slate-600">Aktivnih: {draft.variants.filter((variant) => variant.active).length}</p></section>
          </div>
        </div>

        <aside className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="mb-3 flex items-center gap-4 border-b border-slate-100 text-sm font-semibold">
            <button type="button" className={`-mb-px border-b-2 pb-2 ${rightTab === 'dodatno' ? 'border-[#2f66dd] text-[#2f66dd]' : 'border-transparent text-slate-500'}`} onClick={() => setRightTab('dodatno')}>Dodatno</button>
            <button type="button" className={`-mb-px border-b-2 pb-2 ${rightTab === 'slike' ? 'border-[#2f66dd] text-[#2f66dd]' : 'border-transparent text-slate-500'}`} onClick={() => setRightTab('slike')}>Slike</button>
          </div>

          {rightTab === 'dodatno' ? (
            <div className="space-y-3">
              <h3 className="text-lg font-semibold">Dodatne lastnosti</h3>
              <div className="space-y-1"><label className="text-xs text-slate-600">Material</label><input className={inputClass} value={sideSettings.material} onChange={(event) => setSideSettings((current) => ({ ...current, material: event.target.value }))} placeholder="Aluminij" /></div>
              <div className="space-y-1"><label className="text-xs text-slate-600">Površina</label><input className={inputClass} value={sideSettings.surface} onChange={(event) => setSideSettings((current) => ({ ...current, surface: event.target.value }))} placeholder="Gladko" /></div>
              <div className="grid grid-cols-2 gap-2"><div className="space-y-1"><label className="text-xs text-slate-600">MOQ</label><input type="number" className={inputClass} value={sideSettings.moq} onChange={(event) => setSideSettings((current) => ({ ...current, moq: Number(event.target.value) || 1 }))} /></div><div className="space-y-1"><label className="text-xs text-slate-600">Lokacija skladišča</label><input className={inputClass} value={sideSettings.warehouseLocation} onChange={(event) => setSideSettings((current) => ({ ...current, warehouseLocation: event.target.value }))} placeholder="Glavno" /></div></div>
              <div className="space-y-1"><label className="text-xs text-slate-600">Interna opomba</label><textarea className={`${inputClass} !h-24 py-2`} value={draft.notes} onChange={(event) => setDraft((current) => ({ ...current, notes: event.target.value }))} /></div>
            </div>
          ) : (
            <div className="space-y-3">
              <h3 className="text-lg font-semibold">Nastavitve slik</h3>
              <label className="inline-flex items-center gap-2 text-sm"><AdminCheckbox checked={sideSettings.showGallery} onChange={(event) => setSideSettings((current) => ({ ...current, showGallery: event.target.checked }))} />Prikaži galerijo na strani izdelka</label>
              <div className="space-y-1"><label className="text-xs text-slate-600">Alt besedilo</label><input className={inputClass} value={sideSettings.imageAltText} onChange={(event) => setSideSettings((current) => ({ ...current, imageAltText: event.target.value }))} placeholder={`${draft.name || 'Artikel'} - različice`} /></div>
              <div className="space-y-1"><label className="text-xs text-slate-600">Video URL (neobvezno)</label><input className={inputClass} value={sideSettings.videoUrl} onChange={(event) => setSideSettings((current) => ({ ...current, videoUrl: event.target.value }))} placeholder="https://" /></div>
              <div className="space-y-1"><label className="text-xs text-slate-600">Dokument (neobvezno)</label><Button type="button" variant="default" size="toolbar">Dodaj dokument</Button></div>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
