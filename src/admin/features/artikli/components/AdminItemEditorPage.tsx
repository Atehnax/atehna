'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/shared/ui/button';
import { Chip } from '@/shared/ui/badge';
import { AdminCheckbox } from '@/shared/ui/checkbox';
import { IconButton } from '@/shared/ui/icon-button';
import { MoreActionsIcon, PencilIcon, PlusIcon, SaveIcon, TrashCanIcon } from '@/shared/ui/icons/AdminActionIcons';
import { StatusToggle } from '@/shared/ui/status-toggle';
import { useToast } from '@/shared/ui/toast';
import { buttonTokenClasses } from '@/shared/ui/theme/tokens';
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
  type Variant
} from '@/admin/features/artikli/lib/familyModel';
import AdminCategoryBreadcrumbPicker from '@/admin/features/artikli/components/AdminCategoryBreadcrumbPicker';

const inputClass = 'h-10 w-full rounded-md border border-slate-300 bg-white px-2.5 text-sm text-slate-900 outline-none transition focus:border-[#3e67d6] focus:ring-0';
const readOnlyInputClass = 'disabled:cursor-default disabled:border-transparent disabled:bg-transparent disabled:px-0 disabled:text-slate-700 disabled:shadow-none';

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
  const categoryPathsFromSeed = useMemo(
    () => Array.from(new Set(seedItems.map(([, , , categoryPath]) => categoryPath).filter((categoryPath) => categoryPath.trim().length > 0))),
    [seedItems]
  );
  const [categoryPaths, setCategoryPaths] = useState<string[]>(categoryPathsFromSeed);

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
    brand: '',
    material: '',
    surface: '',
    color: '',
    toleranceEnabled: false,
    thicknessTolerance: '',
    moq: 1,
    weightPerUnit: '',
    palletCount: '',
    dimensions: { width: '', depth: '', height: '' },
    trackInventory: true,
    currentStock: 0,
    minStock: 0,
    warehouseLocation: '',
    basePriceNoVat: '',
    priceRounding: '0.01',
    showOldPrice: true,
    showGallery: true,
    autoSquareCrop: true,
    imageFocus: 'center',
    galleryMode: 'grid' as 'grid' | 'slider' | 'list',
    imageAltText: '',
    videoUrl: ''
  });
  const [documents, setDocuments] = useState<Array<{ name: string; size: string }>>([]);
  const [editorMode, setEditorMode] = useState<'read' | 'edit'>(mode === 'create' ? 'edit' : 'read');
  const [selectedCategoryPath, setSelectedCategoryPath] = useState<string[]>(() =>
    (draft.category || '')
      .split('/')
      .map((entry) => entry.trim())
      .filter(Boolean)
  );

  useEffect(() => {
    setDraft((current) => ({ ...current, category: selectedCategoryPath.join(' / ') }));
  }, [selectedCategoryPath]);

  useEffect(() => {
    let cancelled = false;

    const hydrateCategoryTree = async () => {
      try {
        const response = await fetch('/api/admin/categories/paths', { cache: 'no-store' });
        if (!response.ok) return;
        const payload = (await response.json()) as { paths?: string[] };
        const apiPaths = Array.isArray(payload.paths) ? payload.paths : [];
        const mergedPaths = Array.from(new Set([...categoryPathsFromSeed, ...apiPaths]));
        if (!cancelled) setCategoryPaths(mergedPaths);
      } catch {
        if (!cancelled) setCategoryPaths(categoryPathsFromSeed);
      }
    };

    void hydrateCategoryTree();
    return () => {
      cancelled = true;
    };
  }, [categoryPathsFromSeed]);

  const selectCategoryPath = (path: string[]) => {
    setSelectedCategoryPath(path);
  };

  const isEditable = editorMode === 'edit';

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
  const deleteItem = () => {
    const shouldDelete = window.confirm('Ali želite odstraniti artikel iz urejanja?');
    if (!shouldDelete) return;
    toast.success('Artikel je označen za brisanje (lokalni prikaz).');
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
    <div className="mx-auto max-w-7xl space-y-4 font-['Inter',system-ui,sans-serif]">
      <div className="text-xs text-slate-500"><Link href="/admin/artikli" className="hover:underline">Artikli</Link> › {mode === 'create' ? 'Nov artikel' : draft.name || 'Uredi artikel'}</div>

      <div className="grid items-start gap-6 lg:grid-cols-[2fr_1.1fr]">
        <div className="space-y-4">
          <section className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="mb-4 flex flex-wrap items-center gap-2">
              {isEditable ? (
                <input
                  aria-label="Naziv artikla"
                  placeholder={mode === 'edit' ? 'Naziv artikla' : 'Nov artikel'}
                  className="h-10 min-w-[220px] flex-1 rounded-md border border-slate-200 bg-white px-2.5 text-lg font-semibold tracking-tight text-slate-900 outline-none transition focus:border-[#3e67d6] focus:ring-0"
                  value={draft.name}
                  onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))}
                />
              ) : (
                <h1 className="flex h-10 flex-nowrap items-center gap-1 whitespace-nowrap text-lg font-semibold tracking-tight text-slate-900">
                  {draft.name.trim() || 'Naziv artikla'}
                </h1>
              )}
              <div className="ml-auto flex items-center gap-1.5">
                <Chip variant={draft.active ? 'success' : 'warning'}>{statusLabel(draft.active)}</Chip>
                <IconButton type="button" tone="neutral" onClick={() => setEditorMode((current) => (current === 'read' ? 'edit' : 'read'))} aria-label="Uredi artikel" title="Uredi"><PencilIcon /></IconButton>
                <IconButton type="button" tone="neutral" onClick={() => save(false)} aria-label="Shrani artikel" title="Shrani" disabled={!isEditable}><SaveIcon /></IconButton>
                <button type="button" className={buttonTokenClasses.closeX} onClick={deleteItem} aria-label="Izbriši artikel" title="Izbriši"><TrashCanIcon /></button>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <AdminCategoryBreadcrumbPicker
                className="col-span-3"
                value={selectedCategoryPath}
                onChange={selectCategoryPath}
                categoryPaths={categoryPaths}
                disabled={!isEditable}
              />
              <div className="col-span-3 space-y-1">
                {isEditable ? (
                  <>
                    <label className="sr-only">Opis</label>
                    <textarea
                      placeholder="Opis artikla..."
                      className={`${inputClass} !h-28 py-2`}
                      value={draft.description}
                      onChange={(event) => setDraft((current) => ({ ...current, description: event.target.value }))}
                    />
                  </>
                ) : (
                  <p className="min-h-10 rounded-md border border-transparent px-0 py-1 text-sm text-slate-700">
                    {draft.description.trim() || '—'}
                  </p>
                )}
              </div>
              <div className="space-y-1">
                <label className="text-xs text-slate-600">Oznake (badge)</label>
                {isEditable ? (
                  <input className={inputClass} value={draft.promoBadge} onChange={(event) => setDraft((current) => ({ ...current, promoBadge: event.target.value }))} placeholder="Akcija, Novo ..." />
                ) : (
                  <p className="flex min-h-10 items-center text-sm text-slate-700">{draft.promoBadge.trim() || '—'}</p>
                )}
              </div>
              <div className="col-span-2 space-y-1">
                <label className="text-xs text-slate-600">Kratek URL (slug)</label>
                {isEditable ? (
                  <input className={inputClass} value={draft.slug} onChange={(event) => setDraft((current) => ({ ...current, slug: event.target.value }))} placeholder={toSlug(draft.name)} />
                ) : (
                  <p className="flex min-h-10 items-center text-sm text-slate-700">{draft.slug.trim() || '—'}</p>
                )}
              </div>
            </div>
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-4">
            <h2 className="mb-1 text-2xl font-semibold">Slike</h2>
            <p className="mb-3 text-sm text-slate-500">Galerija artikla. Prva slika je glavna.</p>
            <div className="grid grid-cols-5 gap-2">
              {draft.images.map((img, index) => <div key={`${img}-${index}`} className="relative overflow-hidden rounded-lg border border-slate-200"><Image src={img} alt={`Slika ${index + 1}`} width={180} height={120} unoptimized className="h-28 w-full object-cover" /></div>)}
              <label className={`flex h-28 flex-col items-center justify-center rounded-lg border border-dashed border-slate-300 text-sm text-slate-500 ${isEditable ? 'cursor-pointer hover:border-[#2f66dd]' : 'cursor-not-allowed opacity-60'}`}>Dodaj slike<input disabled={!isEditable} type="file" className="hidden" multiple accept="image/*" onChange={(event) => {
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
              <table className="min-w-full text-xs"><thead className="bg-slate-50"><tr><th className="px-2 py-2" /><th className="px-2 py-2 text-left">Širina</th><th className="px-2 py-2 text-left">Dolžina</th><th className="px-2 py-2 text-left">Debelina</th><th className="px-2 py-2 text-left">SKU</th><th className="px-2 py-2 text-left">Cena</th><th className="px-2 py-2 text-left">Popust</th><th className="px-2 py-2 text-left">Akcijska cena</th><th className="px-2 py-2 text-left">Zaloga</th><th className="px-2 py-2 text-left">Status</th><th className="px-2 py-2 text-left">Sort</th><th className="px-2 py-2 text-right">Akcije</th></tr></thead><tbody>{draft.variants.map((variant, index) => <tr key={variant.id} className="border-t border-slate-100"><td className="px-2 py-2"><AdminCheckbox checked={variantSelections.has(variant.id)} onChange={() => setVariantSelections((current) => { const next = new Set(current); if (next.has(variant.id)) next.delete(variant.id); else next.add(variant.id); return next; })} /></td><td className="px-2 py-2">{variant.width ?? '—'}</td><td className="px-2 py-2">{variant.length ?? '—'}</td><td className="px-2 py-2">{variant.thickness ?? '—'}</td><td className="px-2 py-2"><input disabled={!isEditable} className={`${inputClass} ${readOnlyInputClass} !h-8`} value={variant.sku} onChange={(event) => setDraft((current) => { const next = [...current.variants]; next[index] = { ...next[index], sku: event.target.value }; return { ...current, variants: next }; })} /></td><td className="px-2 py-2"><input disabled={!isEditable} type="number" className={`${inputClass} ${readOnlyInputClass} !h-8`} value={variant.price} onChange={(event) => setDraft((current) => { const next = [...current.variants]; next[index] = { ...next[index], price: Number(event.target.value) || 0 }; return { ...current, variants: next }; })} /></td><td className="px-2 py-2"><input disabled={!isEditable} type="number" className={`${inputClass} ${readOnlyInputClass} !h-8`} value={variant.discountPct} onChange={(event) => setDraft((current) => { const next = [...current.variants]; next[index] = { ...next[index], discountPct: Number(event.target.value) || 0 }; return { ...current, variants: next }; })} /></td><td className="px-2 py-2">{formatCurrency(computeSalePrice(variant.price, variant.discountPct))}</td><td className="px-2 py-2"><input disabled={!isEditable} type="number" className={`${inputClass} ${readOnlyInputClass} !h-8`} value={variant.stock} onChange={(event) => setDraft((current) => { const next = [...current.variants]; next[index] = { ...next[index], stock: Number(event.target.value) || 0 }; return { ...current, variants: next }; })} /></td><td className="px-2 py-2"><Chip variant={variant.active ? 'success' : 'warning'}>{statusLabel(variant.active)}</Chip></td><td className="px-2 py-2"><input disabled={!isEditable} type="number" className={`${inputClass} ${readOnlyInputClass} !h-8`} value={variant.sort} onChange={(event) => setDraft((current) => { const next = [...current.variants]; next[index] = { ...next[index], sort: Number(event.target.value) || 1 }; return { ...current, variants: next }; })} /></td><td className="px-2 py-2 text-right"><IconButton type="button" tone="neutral" disabled={!isEditable} onClick={() => setDraft((current) => ({ ...current, variants: current.variants.filter((entry) => entry.id !== variant.id) }))}><MoreActionsIcon /></IconButton></td></tr>)}</tbody></table>
            </div>
            <Button type="button" variant="ghost" size="toolbar" disabled={!isEditable} className="mt-3" onClick={() => setDraft((current) => ({ ...current, variants: [...current.variants, createVariant({ sort: current.variants.length + 1 })] }))}><PlusIcon />Dodaj različico</Button>
          </section>
        </div>

        <aside className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="mb-3 flex items-center gap-4 border-b border-slate-100 text-sm font-semibold">
            <button type="button" className={`-mb-px border-b-2 pb-2 ${rightTab === 'dodatno' ? 'border-[#2f66dd] text-[#2f66dd]' : 'border-transparent text-slate-500'}`} onClick={() => setRightTab('dodatno')}>Dodatno</button>
            <button type="button" className={`-mb-px border-b-2 pb-2 ${rightTab === 'slike' ? 'border-[#2f66dd] text-[#2f66dd]' : 'border-transparent text-slate-500'}`} onClick={() => setRightTab('slike')}>Slike</button>
          </div>

          {rightTab === 'dodatno' ? (
            <div className="space-y-3">
              <h3 className="text-lg font-semibold">Dodatne lastnosti</h3>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1"><label className="text-xs text-slate-600">Blagovna znamka</label><input className={inputClass} value={sideSettings.brand} onChange={(event) => setSideSettings((current) => ({ ...current, brand: event.target.value }))} placeholder="AluCraft" /></div>
                <div className="space-y-1"><label className="text-xs text-slate-600">Material</label><input className={inputClass} value={sideSettings.material} onChange={(event) => setSideSettings((current) => ({ ...current, material: event.target.value }))} placeholder="Aluminij (EN AW-1050)" /></div>
              </div>
              <div className="grid grid-cols-2 gap-2"><div className="space-y-1"><label className="text-xs text-slate-600">Površina</label><input className={inputClass} value={sideSettings.surface} onChange={(event) => setSideSettings((current) => ({ ...current, surface: event.target.value }))} placeholder="Gladko" /></div><div className="space-y-1"><label className="text-xs text-slate-600">Barva</label><input className={inputClass} value={sideSettings.color} onChange={(event) => setSideSettings((current) => ({ ...current, color: event.target.value }))} placeholder="Srebrna" /></div></div>
              <label className="inline-flex items-center gap-2 text-sm"><StatusToggle checked={sideSettings.toleranceEnabled} onToggle={() => setSideSettings((current) => ({ ...current, toleranceEnabled: !current.toleranceEnabled }))} ariaLabel="Preklopi toleranco debeline" />Toleranca debeline (samo za materiale)</label>
              {sideSettings.toleranceEnabled ? <div className="space-y-1"><label className="text-xs text-slate-600">Debelina toleranca (mm)</label><input className={inputClass} value={sideSettings.thicknessTolerance} onChange={(event) => setSideSettings((current) => ({ ...current, thicknessTolerance: event.target.value }))} placeholder="±0,05" /></div> : null}
              <section className="rounded-lg border border-slate-200 p-3">
                <h4 className="mb-2 text-sm font-semibold">Logistika</h4>
                <div className="grid grid-cols-2 gap-2"><div className="space-y-1"><label className="text-xs text-slate-600">MOQ</label><input type="number" className={inputClass} value={sideSettings.moq} onChange={(event) => setSideSettings((current) => ({ ...current, moq: Number(event.target.value) || 1 }))} /></div><div className="space-y-1"><label className="text-xs text-slate-600">Teža na kos (kg)</label><input className={inputClass} value={sideSettings.weightPerUnit} onChange={(event) => setSideSettings((current) => ({ ...current, weightPerUnit: event.target.value }))} /></div><div className="space-y-1"><label className="text-xs text-slate-600">Kosov na paleti</label><input className={inputClass} value={sideSettings.palletCount} onChange={(event) => setSideSettings((current) => ({ ...current, palletCount: event.target.value }))} /></div><div className="space-y-1"><label className="text-xs text-slate-600">Lokacija skladišča</label><input className={inputClass} value={sideSettings.warehouseLocation} onChange={(event) => setSideSettings((current) => ({ ...current, warehouseLocation: event.target.value }))} placeholder="Glavno skladišče" /></div></div>
                <div className="mt-2 grid grid-cols-3 gap-2"><input className={inputClass} placeholder="Š" value={sideSettings.dimensions.width} onChange={(event) => setSideSettings((current) => ({ ...current, dimensions: { ...current.dimensions, width: event.target.value } }))} /><input className={inputClass} placeholder="D" value={sideSettings.dimensions.depth} onChange={(event) => setSideSettings((current) => ({ ...current, dimensions: { ...current.dimensions, depth: event.target.value } }))} /><input className={inputClass} placeholder="V" value={sideSettings.dimensions.height} onChange={(event) => setSideSettings((current) => ({ ...current, dimensions: { ...current.dimensions, height: event.target.value } }))} /></div>
              </section>
              <section className="rounded-lg border border-slate-200 p-3">
                <h4 className="mb-2 text-sm font-semibold">Zaloga</h4>
                <label className="inline-flex items-center gap-2 text-sm"><StatusToggle checked={sideSettings.trackInventory} onToggle={() => setSideSettings((current) => ({ ...current, trackInventory: !current.trackInventory }))} ariaLabel="Spremljaj zalogo" />Spremljaj zalogo</label>
                <div className="mt-2 grid grid-cols-2 gap-2"><div className="space-y-1"><label className="text-xs text-slate-600">Trenutna zaloga</label><input type="number" className={inputClass} value={sideSettings.currentStock} onChange={(event) => setSideSettings((current) => ({ ...current, currentStock: Number(event.target.value) || 0 }))} /></div><div className="space-y-1"><label className="text-xs text-slate-600">Minimalna zaloga</label><input type="number" className={inputClass} value={sideSettings.minStock} onChange={(event) => setSideSettings((current) => ({ ...current, minStock: Number(event.target.value) || 0 }))} /></div></div>
              </section>
              <section className="rounded-lg border border-slate-200 p-3">
                <h4 className="mb-2 text-sm font-semibold">Cenovna pravila</h4>
                <div className="grid grid-cols-2 gap-2"><div className="space-y-1"><label className="text-xs text-slate-600">Osnovna cena brez DDV</label><input className={inputClass} value={sideSettings.basePriceNoVat} onChange={(event) => setSideSettings((current) => ({ ...current, basePriceNoVat: event.target.value }))} /></div><div className="space-y-1"><label className="text-xs text-slate-600">Zaokroževanje cen</label><select className={inputClass} value={sideSettings.priceRounding} onChange={(event) => setSideSettings((current) => ({ ...current, priceRounding: event.target.value }))}><option value="0.01">Na 0,01 €</option><option value="0.05">Na 0,05 €</option><option value="0.1">Na 0,10 €</option></select></div></div>
                <label className="mt-2 inline-flex items-center gap-2 text-sm"><StatusToggle checked={sideSettings.showOldPrice} onToggle={() => setSideSettings((current) => ({ ...current, showOldPrice: !current.showOldPrice }))} ariaLabel="Prikaži staro ceno" />Prikaži staro ceno, ko je v akciji</label>
              </section>
              <div className="space-y-1"><label className="text-xs text-slate-600">Interna opomba</label><textarea className={`${inputClass} !h-24 py-2`} value={draft.notes} onChange={(event) => setDraft((current) => ({ ...current, notes: event.target.value }))} /></div>
            </div>
          ) : (
            <div className="space-y-3">
              <h3 className="text-lg font-semibold">Nastavitve slik</h3>
              <label className="inline-flex items-center gap-2 text-sm"><AdminCheckbox checked={sideSettings.showGallery} onChange={(event) => setSideSettings((current) => ({ ...current, showGallery: event.target.checked }))} />Prikaži galerijo na strani izdelka</label>
              <label className="inline-flex items-center gap-2 text-sm"><AdminCheckbox checked={sideSettings.autoSquareCrop} onChange={(event) => setSideSettings((current) => ({ ...current, autoSquareCrop: event.target.checked }))} />Samodejno obreži na kvadrat (1:1)</label>
              <div className="space-y-1"><label className="text-xs text-slate-600">Fokus slike</label><select className={inputClass} value={sideSettings.imageFocus} onChange={(event) => setSideSettings((current) => ({ ...current, imageFocus: event.target.value }))}><option value="center">Center</option><option value="top">Zgoraj</option><option value="bottom">Spodaj</option></select></div>
              <div className="space-y-1"><label className="text-xs text-slate-600">Galerija</label><div className="grid grid-cols-3 gap-1">{([{ key: 'grid', label: 'Mreža' }, { key: 'slider', label: 'Drsnik' }, { key: 'list', label: 'Seznam' }] as const).map((modeOption) => <button key={modeOption.key} type="button" className={`rounded-md border px-2 py-2 text-xs ${sideSettings.galleryMode === modeOption.key ? 'border-[#2f66dd] text-[#2f66dd]' : 'border-slate-300 text-slate-600'}`} onClick={() => setSideSettings((current) => ({ ...current, galleryMode: modeOption.key }))}>{modeOption.label}</button>)}</div></div>
              <div className="space-y-1"><label className="text-xs text-slate-600">Alt besedilo</label><input className={inputClass} value={sideSettings.imageAltText} onChange={(event) => setSideSettings((current) => ({ ...current, imageAltText: event.target.value }))} placeholder={`${draft.name || 'Artikel'} - različice`} /></div>
              <div className="space-y-1"><label className="text-xs text-slate-600">Video URL (neobvezno)</label><input className={inputClass} value={sideSettings.videoUrl} onChange={(event) => setSideSettings((current) => ({ ...current, videoUrl: event.target.value }))} placeholder="https://" /></div>
              <div className="space-y-1"><label className="text-xs text-slate-600">Dokumenti (tehnični list)</label><div className="space-y-2">{documents.map((doc) => <div key={doc.name} className="rounded-md border border-slate-200 px-2 py-1 text-xs">{doc.name} · {doc.size}</div>)}</div><input type="file" className="hidden" id="tech-sheet-upload" onChange={(event) => { const file = event.target.files?.[0]; if (!file) return; setDocuments((current) => [...current, { name: file.name, size: `${Math.max(1, Math.round(file.size / 1024))} KB` }]); }} /><label htmlFor="tech-sheet-upload"><Button type="button" variant="default" size="toolbar">Dodaj dokument</Button></label></div>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
