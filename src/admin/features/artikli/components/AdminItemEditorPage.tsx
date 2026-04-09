'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/shared/ui/button';
import { Chip } from '@/shared/ui/badge';
import { AdminCheckbox } from '@/shared/ui/checkbox';
import { IconButton } from '@/shared/ui/icon-button';
import { PencilIcon, PlusIcon, SaveIcon, TrashCanIcon } from '@/shared/ui/icons/AdminActionIcons';
import { useToast } from '@/shared/ui/toast';
import { buttonTokenClasses } from '@/shared/ui/theme/tokens';
import { MenuItem, MenuPanel } from '@/shared/ui/menu';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/ui/tabs';
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
const orderLikeEditableInputClassName = 'mt-0.5 h-5 w-full rounded-md border border-slate-300 bg-white px-1.5 text-xs leading-5 text-slate-900 outline-none transition focus:border-[#3e67d6] focus:outline-none focus:ring-0';

type EditorMode = 'create' | 'edit';
type CreateType = 'simple' | 'variants';
type MediaTab = 'slike' | 'video';

function ActiveStateChip({
  active,
  editable,
  onChange
}: {
  active: boolean;
  editable: boolean;
  onChange: (next: boolean) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    const onDocClick = () => setIsOpen(false);
    const onEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsOpen(false);
    };
    document.addEventListener('mousedown', onDocClick, { once: true });
    document.addEventListener('keydown', onEscape);
    return () => {
      document.removeEventListener('keydown', onEscape);
    };
  }, [isOpen]);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => {
          if (!editable) return;
          setIsOpen((current) => !current);
        }}
        className="relative block rounded-full focus:outline-none"
        aria-haspopup={editable ? 'menu' : undefined}
        aria-expanded={editable ? isOpen : undefined}
      >
        {editable ? <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-slate-500">▾</span> : null}
        <span className="block">
          <Chip variant={active ? 'success' : 'warning'}>{statusLabel(active)}</Chip>
        </span>
      </button>

      {editable && isOpen ? (
        <div role="menu" className="absolute left-0 top-8 z-30 min-w-[130px]">
          <MenuPanel>
            <MenuItem onClick={() => { onChange(true); setIsOpen(false); }}>Aktiven</MenuItem>
            <MenuItem onClick={() => { onChange(false); setIsOpen(false); }}>Neaktiven</MenuItem>
          </MenuPanel>
        </div>
      ) : null}
    </div>
  );
}

function NeutralDropdownChip({
  value,
  editable,
  options,
  onChange
}: {
  value: string;
  editable: boolean;
  options: Array<{ value: string; label: string }>;
  onChange: (next: string) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const selectedOption = options.find((option) => option.value === value) ?? options[0];

  useEffect(() => {
    if (!isOpen) return;
    const onDocClick = () => setIsOpen(false);
    const onEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsOpen(false);
    };
    document.addEventListener('mousedown', onDocClick, { once: true });
    document.addEventListener('keydown', onEscape);
    return () => {
      document.removeEventListener('keydown', onEscape);
    };
  }, [isOpen]);

  return (
    <div className="relative mt-0.5">
      <button
        type="button"
        onClick={() => {
          if (!editable) return;
          setIsOpen((current) => !current);
        }}
        className="relative block rounded-full focus:outline-none"
        aria-haspopup={editable ? 'menu' : undefined}
        aria-expanded={editable ? isOpen : undefined}
      >
        {editable ? <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-slate-500">▾</span> : null}
        <span className="block">
          <Chip variant="neutral">{selectedOption?.label ?? ''}</Chip>
        </span>
      </button>

      {editable && isOpen ? (
        <div role="menu" className="absolute left-0 top-8 z-30 min-w-[150px]">
          <MenuPanel>
            {options.map((option) => (
              <MenuItem
                key={option.value}
                onClick={() => {
                  onChange(option.value);
                  setIsOpen(false);
                }}
              >
                {option.label}
              </MenuItem>
            ))}
          </MenuPanel>
        </div>
      ) : null}
    </div>
  );
}

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
  const [attrValues, setAttrValues] = useState({ width: '100, 200', length: '100, 200', thickness: '0,5' });
  const [sideSettings, setSideSettings] = useState({
    brand: '',
    material: '',
    surface: '',
    color: '',
    thicknessTolerance: '',
    moq: 1,
    weightPerUnit: '0',
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
  const [articleType, setArticleType] = useState<'unit' | 'sheet' | 'bulk'>('unit');
  const [mediaTab, setMediaTab] = useState<MediaTab>('slike');
  const [videoInputMode, setVideoInputMode] = useState<'upload' | 'youtube'>('youtube');
  const [uploadedVideo, setUploadedVideo] = useState<{ name: string; url: string } | null>(null);
  const [dimensionsLocked, setDimensionsLocked] = useState(true);
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
  const hasSelectedVariants = variantSelections.size > 0;
  const allVariantsSelected = draft.variants.length > 0 && draft.variants.every((variant) => variantSelections.has(variant.id));

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

  const updateVariant = (index: number, updates: Partial<Variant>) => {
    setDraft((current) => {
      const next = [...current.variants];
      next[index] = { ...next[index], ...updates };
      return { ...current, variants: next };
    });
  };

  const deleteSelectedVariants = () => {
    if (!isEditable || !hasSelectedVariants) return;
    setDraft((current) => ({
      ...current,
      variants: current.variants.filter((variant) => !variantSelections.has(variant.id))
    }));
    setVariantSelections(new Set());
  };

  return (
    <div className="mx-auto max-w-7xl space-y-4 font-['Inter',system-ui,sans-serif]">
      <div className="text-xs text-slate-500"><Link href="/admin/artikli" className="hover:underline">Artikli</Link> › {mode === 'create' ? 'Nov artikel' : draft.name || 'Uredi artikel'}</div>

      <div className="grid items-stretch gap-6 lg:grid-cols-[3fr_7fr]">
        <div className="space-y-4">
          <section className="h-full rounded-xl border border-slate-200 bg-white p-4">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <h1 className="flex min-h-10 flex-nowrap items-center gap-1 whitespace-nowrap text-lg font-semibold tracking-tight text-slate-900">
                <span>Naziv artikla</span>
                <span className="inline-flex h-10 items-center gap-0">
                  {isEditable ? (
                    <input
                      aria-label="Naziv artikla"
                      value={draft.name}
                      onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))}
                      className="h-[1.45em] min-w-[12ch] rounded-md border border-slate-300 bg-white px-1.5 py-0 font-inherit text-inherit leading-none tracking-tight text-slate-900 shadow-none outline-none transition focus:border-[#3e67d6] focus:outline-none focus:ring-0"
                    />
                  ) : (
                    <span className="inline-flex h-[1.45em] min-w-[12ch] items-center px-1.5">{draft.name.trim() || 'Naziv artikla'}</span>
                  )}
                </span>
              </h1>
              <div className="ml-auto flex items-center gap-1.5">
                <ActiveStateChip active={draft.active} editable={isEditable} onChange={(next) => setDraft((current) => ({ ...current, active: next }))} />
                <IconButton type="button" tone="neutral" onClick={() => setEditorMode((current) => (current === 'read' ? 'edit' : 'read'))} aria-label="Uredi artikel" title="Uredi"><PencilIcon /></IconButton>
                <IconButton type="button" tone="neutral" onClick={() => save(false)} aria-label="Shrani artikel" title="Shrani" disabled={!isEditable}><SaveIcon /></IconButton>
                <button type="button" className={buttonTokenClasses.closeX} onClick={deleteItem} aria-label="Izbriši artikel" title="Izbriši"><TrashCanIcon /></button>
              </div>
            </div>
            <div className="mb-1 grid grid-cols-[minmax(0,1fr)_220px] items-start gap-3 px-2.5">
              <AdminCategoryBreadcrumbPicker
                className="col-span-1"
                value={selectedCategoryPath}
                onChange={selectCategoryPath}
                categoryPaths={categoryPaths}
                disabled={!isEditable}
              />
              <div className="min-h-10">
                <p className="text-sm font-semibold text-slate-700">Tip artikla</p>
                <NeutralDropdownChip
                  value={articleType}
                  editable={isEditable}
                  onChange={(value) => setArticleType(value as 'unit' | 'sheet' | 'bulk')}
                  options={[
                    { value: 'unit', label: 'Kosovni artikel' },
                    { value: 'sheet', label: 'Ploščni material' },
                    { value: 'bulk', label: 'Sipki material' }
                  ]}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 px-2.5">
              <div className="col-span-2 grid grid-cols-2 gap-3">
                {[
                  { title: 'Blagovna znamka', value: sideSettings.brand, placeholder: 'Blagovna znamka (npr. AluCraft)', onChange: (value: string) => setSideSettings((current) => ({ ...current, brand: value })) },
                  { title: 'Material', value: sideSettings.material, placeholder: 'Material (npr. aluminij)', onChange: (value: string) => setSideSettings((current) => ({ ...current, material: value })) },
                  { title: 'Oblika', value: sideSettings.surface, placeholder: 'Oblika (npr. pravokotna)', onChange: (value: string) => setSideSettings((current) => ({ ...current, surface: value })) },
                  { title: 'Barva', value: sideSettings.color, placeholder: 'Barva (npr. srebrna)', onChange: (value: string) => setSideSettings((current) => ({ ...current, color: value })) },
                  { title: 'Tehnični list', value: documents.map((doc) => doc.name).join(', '), placeholder: 'Dodajte dokument', onChange: () => {} },
                  { title: 'Kratek URL', value: draft.slug, placeholder: toSlug(draft.name || 'naziv-artikla'), onChange: (value: string) => setDraft((current) => ({ ...current, slug: value })) }
                ].map((field) => (
                  <div key={field.title} className="min-h-10 px-2.5">
                    <p className="text-sm font-semibold text-slate-700">{field.title}</p>
                    {field.title === 'Tehnični list' ? (
                      <div className="mt-0.5 flex items-center gap-2">
                        <input
                          type="file"
                          className="hidden"
                          id="tech-sheet-upload-inline"
                          disabled={!isEditable}
                          onChange={(event) => {
                            const file = event.target.files?.[0];
                            if (!file) return;
                            setDocuments((current) => [...current, { name: file.name, size: `${Math.max(1, Math.round(file.size / 1024))} KB` }]);
                          }}
                        />
                        <label htmlFor="tech-sheet-upload-inline">
                          <Button type="button" variant="default" size="toolbar" disabled={!isEditable}>Dodaj dokument</Button>
                        </label>
                        <span className="text-xs text-slate-600">{field.value || field.placeholder}</span>
                      </div>
                    ) : isEditable ? (
                      <input className={orderLikeEditableInputClassName} value={field.value} onChange={(event) => field.onChange(event.target.value)} placeholder={field.placeholder} />
                    ) : (
                      <p className="text-sm text-slate-700">{field.value || field.placeholder}</p>
                    )}
                  </div>
                ))}
              </div>
              <div className="col-span-2 space-y-1">
                <label className="text-xs text-slate-600">Oznake (badge)</label>
                {isEditable ? (
                  <input className={inputClass} value={draft.promoBadge} onChange={(event) => setDraft((current) => ({ ...current, promoBadge: event.target.value }))} placeholder="Akcija, Novo ..." />
                ) : (
                  <p className="flex min-h-10 items-center text-sm text-slate-700">{draft.promoBadge.trim() || 'Akcija, Novo ...'}</p>
                )}
              </div>
              <div className="col-span-2 space-y-1">
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
                    {draft.description.trim() || '[Opis artikla]'}
                  </p>
                )}
              </div>
            </div>
          </section>

        </div>

        <aside className="h-full rounded-xl border border-slate-200 bg-white p-4">
          <div className="space-y-3">
            <h3 className="text-lg font-semibold">Slike</h3>
            <Tabs value={mediaTab} onValueChange={(value) => setMediaTab(value as MediaTab)}>
              <TabsList className="w-fit">
                <TabsTrigger value="slike">Slike</TabsTrigger>
                <TabsTrigger value="video">Video</TabsTrigger>
              </TabsList>
              <TabsContent value="slike" className="mt-3 space-y-3">
                <p className="text-sm text-slate-500">Galerija artikla. Prva slika je glavna.</p>
                <div className="grid grid-cols-2 gap-2">
                  {draft.images.map((img, index) => <div key={`${img}-${index}`} className="relative overflow-hidden rounded-lg border border-slate-200"><Image src={img} alt={`Slika ${index + 1}`} width={180} height={120} unoptimized className="h-24 w-full object-cover" /></div>)}
                  <label className={`flex h-24 flex-col items-center justify-center rounded-lg border border-dashed border-slate-300 text-sm text-slate-500 ${isEditable ? 'cursor-pointer hover:border-[#2f66dd]' : 'cursor-not-allowed opacity-60'}`}>Dodaj slike<input disabled={!isEditable} type="file" className="hidden" multiple accept="image/*" onChange={(event) => {
                    const urls = Array.from(event.target.files ?? []).map((file) => URL.createObjectURL(file));
                    setDraft((current) => ({ ...current, images: [...current.images, ...urls] }));
                  }} /></label>
                </div>
                <label className="inline-flex items-center gap-2 text-sm"><AdminCheckbox checked={sideSettings.showGallery} onChange={(event) => setSideSettings((current) => ({ ...current, showGallery: event.target.checked }))} />Prikaži galerijo na strani izdelka</label>
                <label className="inline-flex items-center gap-2 text-sm"><AdminCheckbox checked={sideSettings.autoSquareCrop} onChange={(event) => setSideSettings((current) => ({ ...current, autoSquareCrop: event.target.checked }))} />Samodejno obreži na kvadrat (1:1)</label>
                <div className="space-y-1"><label className="text-xs text-slate-600">Fokus slike</label><select className={inputClass} value={sideSettings.imageFocus} onChange={(event) => setSideSettings((current) => ({ ...current, imageFocus: event.target.value }))}><option value="center">Center</option><option value="top">Zgoraj</option><option value="bottom">Spodaj</option></select></div>
                <div className="space-y-1"><label className="text-xs text-slate-600">Galerija</label><div className="grid grid-cols-3 gap-1">{([{ key: 'grid', label: 'Mreža' }, { key: 'slider', label: 'Drsnik' }, { key: 'list', label: 'Seznam' }] as const).map((modeOption) => <button key={modeOption.key} type="button" className={`rounded-md border px-2 py-2 text-xs ${sideSettings.galleryMode === modeOption.key ? 'border-[#2f66dd] text-[#2f66dd]' : 'border-slate-300 text-slate-600'}`} onClick={() => setSideSettings((current) => ({ ...current, galleryMode: modeOption.key }))}>{modeOption.label}</button>)}</div></div>
                <div className="space-y-1"><label className="text-xs text-slate-600">Alt besedilo</label><input className={inputClass} value={sideSettings.imageAltText} onChange={(event) => setSideSettings((current) => ({ ...current, imageAltText: event.target.value }))} placeholder={`${draft.name || 'Artikel'} - različice`} /></div>
              </TabsContent>
              <TabsContent value="video" className="mt-3 space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <Button type="button" variant={videoInputMode === 'upload' ? 'primary' : 'default'} size="toolbar" onClick={() => setVideoInputMode('upload')}>Naloži video</Button>
                  <Button type="button" variant={videoInputMode === 'youtube' ? 'primary' : 'default'} size="toolbar" onClick={() => setVideoInputMode('youtube')}>YouTube povezava</Button>
                </div>
                {videoInputMode === 'upload' ? (
                  <div className="space-y-1">
                    <label className="text-xs text-slate-600">Video datoteka</label>
                    <input
                      type="file"
                      accept="video/*"
                      disabled={!isEditable}
                      className="block w-full text-xs text-slate-700 file:mr-2 file:rounded-md file:border-0 file:bg-slate-100 file:px-2 file:py-1 file:text-xs file:font-semibold"
                      onChange={(event) => {
                        const file = event.target.files?.[0];
                        if (!file) return;
                        setUploadedVideo({ name: file.name, url: URL.createObjectURL(file) });
                      }}
                    />
                    {uploadedVideo ? <video controls className="mt-2 w-full rounded-lg border border-slate-200"><source src={uploadedVideo.url} /></video> : <p className="text-xs text-slate-500">Noben video ni naložen.</p>}
                  </div>
                ) : (
                  <div className="space-y-1">
                    <label className="text-xs text-slate-600">YouTube URL</label>
                    <input className={inputClass} value={sideSettings.videoUrl} onChange={(event) => setSideSettings((current) => ({ ...current, videoUrl: event.target.value }))} placeholder="https://www.youtube.com/watch?v=..." />
                    {sideSettings.videoUrl.includes('youtube.com') || sideSettings.videoUrl.includes('youtu.be') ? (
                      <iframe
                        title="YouTube video predogled"
                        className="h-52 w-full rounded-lg border border-slate-200"
                        src={sideSettings.videoUrl
                          .replace('watch?v=', 'embed/')
                          .replace('youtu.be/', 'youtube.com/embed/')}
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                      />
                    ) : <p className="text-xs text-slate-500">Vnesite YouTube povezavo za predogled.</p>}
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </div>
        </aside>
      </div>

      <section className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-2xl font-semibold">Uredi artikle</h2>
          <div className="flex items-center gap-2">
            <IconButton
              type="button"
              aria-label="Odstrani izbrane različice"
              title="Izbriši izbrane"
              tone={hasSelectedVariants ? 'danger' : 'neutral'}
              disabled={!isEditable || !hasSelectedVariants}
              onClick={deleteSelectedVariants}
            >
              <TrashCanIcon />
            </IconButton>
            <IconButton
              type="button"
              aria-label="Zakleni ali odkleni dimenzije"
              title={dimensionsLocked ? 'Odkleni dimenzije' : 'Zakleni dimenzije'}
              tone="neutral"
              disabled={!isEditable}
              onClick={() => setDimensionsLocked((current) => !current)}
            >
              <PencilIcon />
            </IconButton>
            <Button type="button" variant="primary" size="toolbar" onClick={generateVariants}>Generiraj različice</Button>
          </div>
        </div>
        <div className="mb-3 grid grid-cols-3 gap-2 lg:max-w-[420px]">
          <div className="space-y-1"><label className="text-xs text-slate-600">Dolžina (mm)</label><input disabled={!isEditable || dimensionsLocked} className={`${inputClass} !h-8 !w-24 ${readOnlyInputClass}`} value={attrValues.length} onChange={(event) => setAttrValues((current) => ({ ...current, length: event.target.value }))} /></div>
          <div className="space-y-1"><label className="text-xs text-slate-600">Širina (mm)</label><input disabled={!isEditable || dimensionsLocked} className={`${inputClass} !h-8 !w-24 ${readOnlyInputClass}`} value={attrValues.width} onChange={(event) => setAttrValues((current) => ({ ...current, width: event.target.value }))} /></div>
          <div className="space-y-1"><label className="text-xs text-slate-600">Debelina (mm)</label><input disabled={!isEditable || dimensionsLocked} className={`${inputClass} !h-8 !w-24 ${readOnlyInputClass}`} value={attrValues.thickness} onChange={(event) => setAttrValues((current) => ({ ...current, thickness: event.target.value }))} /></div>
        </div>
        <div className="overflow-x-auto rounded-lg border border-slate-200">
          <table className="min-w-full text-xs">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-2 py-2 text-center">
                  <AdminCheckbox
                    checked={isEditable && allVariantsSelected}
                    onChange={() =>
                      setVariantSelections(allVariantsSelected ? new Set() : new Set(draft.variants.map((variant) => variant.id)))
                    }
                    disabled={!isEditable}
                  />
                </th>
                <th className="px-2 py-2 text-center">Dolžina</th>
                <th className="px-2 py-2 text-center">Širina</th>
                <th className="px-2 py-2 text-center">Debelina</th>
                <th className="px-2 py-2 text-center">Toleranca</th>
                <th className="px-2 py-2 text-center">SKU</th>
                <th className="px-2 py-2 text-right">Cena</th>
                <th className="px-2 py-2 text-right">Teža</th>
                <th className="px-2 py-2 text-right">Popust %</th>
                <th className="px-2 py-2 text-right">Akcijska cena</th>
                <th className="px-2 py-2 text-right">Zaloga</th>
                <th className="px-2 py-2 text-center">Min. naročilo</th>
                <th className="px-2 py-2 text-center">Status</th>
                <th className="px-2 py-2 text-center">Sort</th>
              </tr>
            </thead>
            <tbody>
              {draft.variants.map((variant, index) => (
                <tr key={variant.id} className="border-t border-slate-100">
                  <td className="px-2 py-2 text-center"><AdminCheckbox checked={variantSelections.has(variant.id)} onChange={() => setVariantSelections((current) => { const next = new Set(current); if (next.has(variant.id)) next.delete(variant.id); else next.add(variant.id); return next; })} disabled={!isEditable} /></td>
                  <td className="px-2 py-2 text-center">{variant.length ?? '—'}</td>
                  <td className="px-2 py-2 text-center">{variant.width ?? '—'}</td>
                  <td className="px-2 py-2 text-center">{variant.thickness ?? '—'}</td>
                  <td className="px-2 py-2 text-center">{sideSettings.thicknessTolerance || '—'}</td>
                  <td className="px-2 py-2 text-center">{isEditable ? <input className={`${inputClass} !h-8`} value={variant.sku} onChange={(event) => updateVariant(index, { sku: event.target.value })} /> : <span className="inline-flex min-h-8 items-center">{variant.sku || '—'}</span>}</td>
                  <td className="px-2 py-2 text-right">{isEditable ? <input type="number" className={`${inputClass} !h-8 text-right`} value={variant.price} onChange={(event) => updateVariant(index, { price: Number(event.target.value) || 0 })} /> : <span className="inline-flex min-h-8 items-center justify-end">{formatCurrency(variant.price)}</span>}</td>
                  <td className="px-2 py-2 text-right">{isEditable ? <input className={`${inputClass} !h-8 text-right`} value={sideSettings.weightPerUnit} onChange={(event) => setSideSettings((current) => ({ ...current, weightPerUnit: event.target.value }))} /> : <span className="inline-flex min-h-8 items-center justify-end">{sideSettings.weightPerUnit || '—'}</span>}</td>
                  <td className="px-2 py-2 text-right">{isEditable ? <input type="number" className={`${inputClass} !h-8 text-right`} value={variant.discountPct} onChange={(event) => updateVariant(index, { discountPct: Number(event.target.value) || 0 })} /> : <span className="inline-flex min-h-8 items-center justify-end">{variant.discountPct}</span>}</td>
                  <td className="px-2 py-2 text-right">{formatCurrency(computeSalePrice(variant.price, variant.discountPct))}</td>
                  <td className="px-2 py-2 text-right">{isEditable ? <input type="number" className={`${inputClass} !h-8 text-right`} value={variant.stock} onChange={(event) => updateVariant(index, { stock: Number(event.target.value) || 0 })} /> : <span className="inline-flex min-h-8 items-center justify-end">{variant.stock}</span>}</td>
                  <td className="px-2 py-2 text-center">{isEditable ? <input type="number" className={`${inputClass} !h-8 text-center`} value={sideSettings.moq} onChange={(event) => setSideSettings((current) => ({ ...current, moq: Number(event.target.value) || 1 }))} /> : <span className="inline-flex min-h-8 items-center justify-center">{sideSettings.moq}</span>}</td>
                  <td className="px-2 py-2 text-center"><Chip variant={variant.active ? 'success' : 'warning'}>{statusLabel(variant.active)}</Chip></td>
                  <td className="px-2 py-2 text-center">{isEditable ? <input type="number" className={`${inputClass} !h-8 text-center`} value={variant.sort} onChange={(event) => updateVariant(index, { sort: Number(event.target.value) || 1 })} /> : <span className="inline-flex min-h-8 items-center justify-center">{variant.sort}</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Button type="button" variant="ghost" size="toolbar" disabled={!isEditable} className="mt-3" onClick={() => setDraft((current) => ({ ...current, variants: [...current.variants, createVariant({ sort: current.variants.length + 1 })] }))}><PlusIcon />Dodaj različico</Button>
      </section>
    </div>
  );
}
