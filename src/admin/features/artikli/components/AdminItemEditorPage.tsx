'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Button } from '@/shared/ui/button';
import { Chip } from '@/shared/ui/badge';
import { AdminCheckbox } from '@/shared/ui/checkbox';
import { IconButton } from '@/shared/ui/icon-button';
import { PencilIcon, PlusIcon, SaveIcon, TrashCanIcon } from '@/shared/ui/icons/AdminActionIcons';
import { useToast } from '@/shared/ui/toast';
import { buttonTokenClasses } from '@/shared/ui/theme/tokens';
import { MenuItem, MenuPanel } from '@/shared/ui/menu';
import EuiTabs from '@/shared/ui/eui-tabs';
import {
  buildFamiliesFromSeed,
  computeSalePrice,
  createFamily,
  createVariant,
  formatCurrency,
  toSlug,
  type ProductFamily,
  type SeedItemTuple,
  type Variant
} from '@/admin/features/artikli/lib/familyModel';
import AdminCategoryBreadcrumbPicker from '@/admin/features/artikli/components/AdminCategoryBreadcrumbPicker';

const inputClass = 'h-10 w-full rounded-md border border-slate-300 bg-white px-2.5 text-sm text-slate-900 outline-none transition focus:border-[#3e67d6] focus:ring-0';
const numberInputClass = '[-moz-appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none';
const orderLikeEditableInputClassName = 'mt-0.5 h-5 w-full rounded-md border border-slate-300 bg-white px-1.5 text-xs leading-5 text-slate-900 outline-none transition focus:border-[#3e67d6] focus:outline-none focus:ring-0';
const compactTableNumberInputClassName = `h-5 w-full rounded-md border border-slate-300 bg-white px-1.5 text-[11px] leading-4 text-slate-900 outline-none transition focus:border-[#3e67d6] focus:outline-none focus:ring-0 ${numberInputClass}`;

type EditorMode = 'create' | 'edit';
type CreateType = 'simple' | 'variants';
type MediaTab = 'slike' | 'video';
type VariantTag = 'novo' | 'akcija' | 'zadnji-kosi';
type GeneratorDimension = 'length' | 'width' | 'thickness';
type GeneratorChip = { dimension: GeneratorDimension; values: number[] };
type VideoEntry = { id: string; source: 'upload' | 'youtube'; label: string; previewUrl: string; visible: boolean };

function ActiveStateChip({
  active,
  editable,
  onChange,
  chipClassName,
  menuPlacement = 'bottom'
}: {
  active: boolean;
  editable: boolean;
  onChange: (next: boolean) => void;
  chipClassName?: string;
  menuPlacement?: 'top' | 'bottom';
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState<{ top: number; left: number } | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const label = active ? 'Aktiven' : 'Neaktiven';

  const updateMenuPosition = useCallback(() => {
    if (!triggerRef.current) return;
    const triggerRect = triggerRef.current.getBoundingClientRect();
    const menuWidth = Math.max(130, menuRef.current?.offsetWidth ?? 130);
    const left = Math.min(Math.max(8, triggerRect.left), window.innerWidth - menuWidth - 8);
    const top = menuPlacement === 'top' ? triggerRect.top - 6 : triggerRect.bottom + 6;
    setMenuPosition({ top, left });
  }, [menuPlacement]);

  useEffect(() => {
    if (!isOpen) return;
    updateMenuPosition();
    const onDocClick = (event: MouseEvent) => {
      const target = event.target as Node;
      if (rootRef.current?.contains(target)) return;
      if (menuRef.current?.contains(target)) return;
      setIsOpen(false);
    };
    const onEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsOpen(false);
    };
    const onWindowChange = () => updateMenuPosition();
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onEscape);
    window.addEventListener('resize', onWindowChange);
    window.addEventListener('scroll', onWindowChange, true);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onEscape);
      window.removeEventListener('resize', onWindowChange);
      window.removeEventListener('scroll', onWindowChange, true);
    };
  }, [isOpen, updateMenuPosition]);

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={triggerRef}
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
          <Chip variant={active ? 'success' : 'warning'} className={chipClassName}>{label}</Chip>
        </span>
      </button>

      {editable && isOpen && menuPosition && typeof document !== 'undefined'
        ? createPortal(
            <div
              ref={menuRef}
              role="menu"
              className={`fixed z-[1000] min-w-[130px] ${menuPlacement === 'top' ? '-translate-y-full' : ''}`}
              style={{ top: menuPosition.top, left: menuPosition.left }}
            >
              <MenuPanel>
                <MenuItem onClick={() => { onChange(true); setIsOpen(false); }}>Aktiven</MenuItem>
                <MenuItem onClick={() => { onChange(false); setIsOpen(false); }}>Neaktiven</MenuItem>
              </MenuPanel>
            </div>,
            document.body
          )
        : null}
    </div>
  );
}

function NeutralDropdownChip({
  value,
  editable,
  options,
  onChange,
  chipClassName
}: {
  value: string;
  editable: boolean;
  options: Array<{ value: string; label: string }>;
  onChange: (next: string) => void;
  chipClassName?: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const selectedOption = options.find((option) => option.value === value) ?? options[0];

  useEffect(() => {
    if (!isOpen) return;
    const onDocClick = (event: MouseEvent) => {
      if (rootRef.current?.contains(event.target as Node)) return;
      setIsOpen(false);
    };
    const onEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onEscape);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onEscape);
    };
  }, [isOpen]);

  return (
    <div ref={rootRef} className="relative">
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
          <Chip variant="neutral" className={`min-w-[124px] ${chipClassName ?? ''}`}>{selectedOption?.label ?? ''}</Chip>
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

function TagStateChip({
  value,
  editable,
  onChange,
  chipClassName,
  menuPlacement = 'bottom'
}: {
  value: VariantTag;
  editable: boolean;
  onChange: (next: VariantTag) => void;
  chipClassName?: string;
  menuPlacement?: 'top' | 'bottom';
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState<{ top: number; left: number } | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const label = value === 'novo' ? 'Novo' : value === 'akcija' ? 'V akciji' : 'Zadnji kosi';
  const variant = value === 'novo' ? 'info' : value === 'akcija' ? 'warning' : 'purple';

  const updateMenuPosition = useCallback(() => {
    if (!triggerRef.current) return;
    const triggerRect = triggerRef.current.getBoundingClientRect();
    const menuWidth = Math.max(130, menuRef.current?.offsetWidth ?? 130);
    const left = Math.min(Math.max(8, triggerRect.left), window.innerWidth - menuWidth - 8);
    const top = menuPlacement === 'top' ? triggerRect.top - 6 : triggerRect.bottom + 6;
    setMenuPosition({ top, left });
  }, [menuPlacement]);

  useEffect(() => {
    if (!isOpen) return;
    updateMenuPosition();
    const onDocClick = (event: MouseEvent) => {
      const target = event.target as Node;
      if (rootRef.current?.contains(target)) return;
      if (menuRef.current?.contains(target)) return;
      setIsOpen(false);
    };
    const onEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsOpen(false);
    };
    const onWindowChange = () => updateMenuPosition();
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onEscape);
    window.addEventListener('resize', onWindowChange);
    window.addEventListener('scroll', onWindowChange, true);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onEscape);
      window.removeEventListener('resize', onWindowChange);
      window.removeEventListener('scroll', onWindowChange, true);
    };
  }, [isOpen, updateMenuPosition]);

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={triggerRef}
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
          <Chip variant={variant} className={chipClassName}>{label}</Chip>
        </span>
      </button>

      {editable && isOpen && menuPosition && typeof document !== 'undefined'
        ? createPortal(
            <div
              ref={menuRef}
              role="menu"
              className={`fixed z-[1000] min-w-[130px] ${menuPlacement === 'top' ? '-translate-y-full' : ''}`}
              style={{ top: menuPosition.top, left: menuPosition.left }}
            >
              <MenuPanel>
                <MenuItem onClick={() => { onChange('novo'); setIsOpen(false); }}>Novo</MenuItem>
                <MenuItem onClick={() => { onChange('akcija'); setIsOpen(false); }}>V akciji</MenuItem>
                <MenuItem onClick={() => { onChange('zadnji-kosi'); setIsOpen(false); }}>Zadnji kosi</MenuItem>
              </MenuPanel>
            </div>,
            document.body
          )
        : null}
    </div>
  );
}

function VisibilityChip({
  visible,
  editable,
  onChange
}: {
  visible: boolean;
  editable: boolean;
  onChange: (next: boolean) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!isOpen) return;
    const onDocClick = (event: MouseEvent) => {
      if (rootRef.current?.contains(event.target as Node)) return;
      setIsOpen(false);
    };
    const onEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onEscape);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onEscape);
    };
  }, [isOpen]);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => {
          if (!editable) return;
          setIsOpen((current) => !current);
        }}
        className="relative block rounded-full focus:outline-none"
      >
        {editable ? <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-slate-500">▾</span> : null}
        <Chip variant={visible ? 'success' : 'warning'}>{visible ? 'Prikaži' : 'Skrij'}</Chip>
      </button>
      {editable && isOpen ? (
        <div role="menu" className="absolute left-0 top-8 z-30 min-w-[120px]">
          <MenuPanel>
            <MenuItem onClick={() => { onChange(true); setIsOpen(false); }}>Prikaži</MenuItem>
            <MenuItem onClick={() => { onChange(false); setIsOpen(false); }}>Skrij</MenuItem>
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
  const [generatorInput, setGeneratorInput] = useState('');
  const [generatorPriceInput, setGeneratorPriceInput] = useState('');
  const [generatorChips, setGeneratorChips] = useState<GeneratorChip[]>([]);
  const [generatorError, setGeneratorError] = useState<string | null>(null);
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
  const [tableEditorMode, setTableEditorMode] = useState<'read' | 'edit'>(mode === 'create' ? 'edit' : 'read');
  const [articleType, setArticleType] = useState<'unit' | 'sheet' | 'bulk' | ''>('');
  const [mediaTab, setMediaTab] = useState<MediaTab>('slike');
  const [mediaMode, setMediaMode] = useState<'read' | 'edit'>('read');
  const [mediaImagesSaved, setMediaImagesSaved] = useState<string[]>(draft.images);
  const [mediaImagesDraft, setMediaImagesDraft] = useState<string[]>(draft.images);
  const [selectedImageIndexes, setSelectedImageIndexes] = useState<Set<number>>(new Set());
  const [uploadedVideo, setUploadedVideo] = useState<{ name: string; url: string } | null>(null);
  const [youtubeInput, setYoutubeInput] = useState('');
  const [videoEntriesDraft, setVideoEntriesDraft] = useState<VideoEntry[]>([]);
  const [videoEntriesSaved, setVideoEntriesSaved] = useState<VideoEntry[]>([]);
  const [videoSelections, setVideoSelections] = useState<Set<string>>(new Set());
  const [variantTags, setVariantTags] = useState<Record<string, VariantTag>>({});
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
  const isTableEditable = tableEditorMode === 'edit';
  const isMediaEditable = mediaMode === 'edit';
  const isBulkMaterial = articleType === 'bulk';
  const isGeneratorLocked = !isTableEditable || isBulkMaterial;
  const generatorUnitLabel = articleType === 'sheet' ? 'na m²' : articleType === 'bulk' ? 'na kg' : articleType === 'unit' ? 'na kos' : 'na enoto';
  const hasSelectedVariants = variantSelections.size > 0;
  const allVariantsSelected = draft.variants.length > 0 && draft.variants.every((variant) => variantSelections.has(variant.id));
  const generatorDimensionLabels: Record<GeneratorDimension, string> = {
    length: 'Dolžina',
    width: 'Širina/fi',
    thickness: 'Debelina'
  };
  const generatorByDimension = useMemo(() => {
    const map = new Map<GeneratorDimension, number[]>();
    generatorChips.forEach((chip) => {
      map.set(chip.dimension, chip.values);
    });
    return map;
  }, [generatorChips]);
  const combinationCount = useMemo(() => {
    const activeDimensions = (['length', 'width', 'thickness'] as const)
      .map((dimension) => generatorByDimension.get(dimension) ?? [])
      .filter((values) => values.length > 0);
    if (activeDimensions.length < 2) return 0;
    return activeDimensions.reduce((total, values) => total * values.length, 1);
  }, [generatorByDimension]);

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
    const widths = generatorByDimension.get('width') ?? [];
    const lengths = generatorByDimension.get('length') ?? [];
    const thicknesses = generatorByDimension.get('thickness') ?? [];

    if (widths.length === 0 || lengths.length === 0 || thicknesses.length === 0) {
      toast.error('Najprej dodajte Dolžino, Širino in Debelino.');
      return;
    }

    const generated: Variant[] = [];
    const parsedGeneratorPrice = Number(generatorPriceInput.replace(',', '.'));
    const nextPrice = Number.isFinite(parsedGeneratorPrice) ? parsedGeneratorPrice : 0;
    widths.forEach((width) => lengths.forEach((length) => thicknesses.forEach((thickness) => {
      generated.push(createVariant({
        label: `${width} × ${length} × ${thickness} mm`,
        width,
        length,
        thickness,
        sku: `${toSlug(draft.name || 'artikel').toUpperCase()}-${width}${length}${thickness}`,
        price: nextPrice,
        discountPct: draft.defaultDiscountPct,
        sort: generated.length + 1
      }));
    })));

    setDraft((current) => ({ ...current, variants: generated }));
    setVariantSelections(new Set());
  };

  const parseGeneratorEntry = (value: string): { dimension: GeneratorDimension; values: number[] } | { error: string } => {
    const normalized = value.trim();
    if (!normalized) return { error: 'Vnos ne sme biti prazen.' };
    const match = normalized.match(/^(dolzina|dolžina|sirina(?:\/fi)?|širina(?:\/fi)?|fi|debelina)\s*:?\s*(.+)$/i);
    if (!match) return { error: 'Uporabite Dolžina/Širina/fi/Debelina + vrednosti.' };
    const prefix = match[1]
      .toLowerCase()
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '');
    const rawValues = (match[2] ?? '').trim();
    if (!rawValues) return { error: 'Dodajte vsaj eno številčno vrednost.' };

    const dimension: GeneratorDimension = prefix.startsWith('dol')
      ? 'length'
      : (prefix.startsWith('sir') || prefix.startsWith('fi'))
        ? 'width'
        : 'thickness';
    const parts = rawValues.split(',').map((entry) => entry.trim()).filter(Boolean);
    if (parts.length === 0) return { error: 'Dodajte vsaj eno številčno vrednost.' };
    if (parts.length > 5) return { error: `${generatorDimensionLabels[dimension]} podpira največ 5 vrednosti.` };

    const parsedValues: number[] = [];
    const duplicateGuard = new Set<number>();
    for (const part of parts) {
      const parsed = Number(part.replace(',', '.'));
      if (!Number.isFinite(parsed)) return { error: 'Vse vrednosti morajo biti številke.' };
      if (duplicateGuard.has(parsed)) return { error: 'Podvojene vrednosti v isti dimenziji niso dovoljene.' };
      duplicateGuard.add(parsed);
      parsedValues.push(parsed);
    }

    return { dimension, values: parsedValues };
  };

  const submitGeneratorEntry = () => {
    const parsed = parseGeneratorEntry(generatorInput);
    if ('error' in parsed) {
      setGeneratorError(parsed.error);
      return;
    }
    setGeneratorError(null);
    setGeneratorChips((current) => {
      const next = current.filter((chip) => chip.dimension !== parsed.dimension);
      return [...next, parsed];
    });
    setGeneratorInput('');
  };

  const addYoutubeVideo = () => {
    const value = youtubeInput.trim();
    if (!value) return;
    if (!value.includes('youtube.com') && !value.includes('youtu.be')) {
      toast.error('Vnesite veljavno YouTube povezavo.');
      return;
    }
    const previewUrl = value.replace('watch?v=', 'embed/').replace('youtu.be/', 'youtube.com/embed/');
    setVideoEntriesDraft((current) => [
      ...current,
      { id: `video-${Date.now()}`, source: 'youtube', label: value, previewUrl, visible: true }
    ]);
    setYoutubeInput('');
  };

  const addUploadedVideo = () => {
    if (!uploadedVideo) return;
    setVideoEntriesDraft((current) => [
      ...current,
      { id: `video-${Date.now()}`, source: 'upload', label: uploadedVideo.name, previewUrl: uploadedVideo.url, visible: true }
    ]);
    setUploadedVideo(null);
  };

  const saveVideoEntries = () => {
    setVideoEntriesSaved(videoEntriesDraft);
    setMediaImagesSaved(mediaImagesDraft);
    setDraft((current) => ({ ...current, images: mediaImagesDraft }));
    toast.success('Video spremembe shranjene lokalno.');
  };

  const updateVariant = (index: number, updates: Partial<Variant>) => {
    setDraft((current) => {
      const next = [...current.variants];
      next[index] = { ...next[index], ...updates };
      return { ...current, variants: next };
    });
  };

  const deleteSelectedVariants = () => {
    if (!isTableEditable || !hasSelectedVariants) return;
    setDraft((current) => ({
      ...current,
      variants: current.variants.filter((variant) => !variantSelections.has(variant.id))
    }));
    setVariantSelections(new Set());
  };

  const setVariantTag = (variantId: string, tag: VariantTag) => {
    setVariantTags((current) => ({ ...current, [variantId]: tag }));
  };

  const getVariantTag = (variantId: string): VariantTag => variantTags[variantId] ?? 'novo';
  return (
    <div className="mx-auto max-w-7xl space-y-4 font-['Inter',system-ui,sans-serif]">
      <div className="text-xs text-slate-500"><Link href="/admin/artikli" className="hover:underline">Artikli</Link> › {mode === 'create' ? 'Nov artikel' : draft.name || 'Uredi artikel'}</div>

      <div className="grid items-stretch gap-6 lg:grid-cols-2">
        <div className="space-y-4">
          <section className="h-full rounded-xl border border-slate-200 bg-white p-4">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <h1 className="flex min-h-10 flex-nowrap items-center gap-1 whitespace-nowrap text-lg font-semibold tracking-tight text-slate-900">
                <span className="inline-flex h-10 items-center gap-0">
                  {isEditable ? (
                    <input
                      aria-label="Naziv artikla"
                      value={draft.name}
                      onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))}
                      placeholder="Naziv artikla"
                      className="inline-flex h-[1.45em] min-w-[14ch] items-center rounded-md border border-slate-300 bg-white px-1.5 py-0 font-inherit text-inherit leading-none tracking-tight text-slate-900 shadow-none outline-none transition focus:border-[#3e67d6] focus:outline-none focus:ring-0 focus:shadow-none focus-visible:outline-none focus-visible:ring-0 focus-visible:shadow-none"
                    />
                  ) : (
                    <span className="inline-flex h-[1.45em] min-w-[14ch] items-center px-1.5">{draft.name.trim() || 'Naziv artikla'}</span>
                  )}
                </span>
              </h1>
              <div className="ml-auto flex items-center gap-1.5">
                <NeutralDropdownChip
                  value={articleType}
                  editable={isEditable}
                  onChange={(value) => setArticleType(value as 'unit' | 'sheet' | 'bulk' | '')}
                  options={[
                    { value: '', label: 'Tip artikla' },
                    { value: 'unit', label: 'Kosovni artikel' },
                    { value: 'sheet', label: 'Ploščni material' },
                    { value: 'bulk', label: 'Sipki material' }
                  ]}
                />
                <ActiveStateChip active={draft.active} editable={isEditable} onChange={(next) => setDraft((current) => ({ ...current, active: next }))} />
                <IconButton type="button" tone="neutral" onClick={() => setEditorMode((current) => (current === 'read' ? 'edit' : 'read'))} aria-label="Uredi artikel" title="Uredi"><PencilIcon /></IconButton>
                <IconButton type="button" tone="neutral" onClick={() => save(false)} aria-label="Shrani artikel" title="Shrani" disabled={!isEditable}><SaveIcon /></IconButton>
                <button type="button" className={buttonTokenClasses.closeX} onClick={deleteItem} aria-label="Izbriši artikel" title="Izbriši"><TrashCanIcon /></button>
              </div>
            </div>
            <div className="mb-1 grid grid-cols-[minmax(0,1fr)] items-start gap-3 px-2.5">
              <AdminCategoryBreadcrumbPicker
                className="col-span-1"
                value={selectedCategoryPath}
                onChange={selectCategoryPath}
                categoryPaths={categoryPaths}
                disabled={!isEditable}
              />
            </div>
            <div className="grid grid-cols-2 gap-3 px-2.5">
              <div className="col-span-2 grid grid-cols-2 gap-3">
                {[
                  { title: 'Blagovna znamka', value: sideSettings.brand, placeholder: 'AluCraft', onChange: (value: string) => setSideSettings((current) => ({ ...current, brand: value })) },
                  { title: 'Material', value: sideSettings.material, placeholder: 'Aluminij', onChange: (value: string) => setSideSettings((current) => ({ ...current, material: value })) },
                  { title: 'Oblika', value: sideSettings.surface, placeholder: 'Pravokotna', onChange: (value: string) => setSideSettings((current) => ({ ...current, surface: value })) },
                  { title: 'Barva', value: sideSettings.color, placeholder: 'Srebrna', onChange: (value: string) => setSideSettings((current) => ({ ...current, color: value })) },
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
                          <Button type="button" variant="default" size="toolbar" className="whitespace-nowrap" disabled={!isEditable}>Dodaj dokument</Button>
                        </label>
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
                <label className="text-sm font-semibold text-slate-700">Opis</label>
                {isEditable ? (
                  <>
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
            <div className="flex items-center justify-between gap-3">
              <EuiTabs
                value={mediaTab}
                onChange={(value) => setMediaTab(value as MediaTab)}
                size="compact"
                tabClassName="!font-['Inter',system-ui,sans-serif] !text-lg !font-semibold !tracking-tight"
                tabs={[
                  { value: 'slike', label: 'Slike' },
                  { value: 'video', label: 'Video' }
                ]}
              />
              <div className="flex items-center justify-end gap-1.5">
              <IconButton type="button" tone="neutral" aria-label="Uredi medije" title="Uredi" onClick={() => setMediaMode((current) => (current === 'read' ? 'edit' : 'read'))}><PencilIcon /></IconButton>
              <IconButton type="button" tone="neutral" aria-label="Shrani medije" title="Shrani" onClick={saveVideoEntries} disabled={!isMediaEditable}><SaveIcon /></IconButton>
              <IconButton
                type="button"
                tone={(mediaTab === 'video' ? videoSelections.size : selectedImageIndexes.size) > 0 ? 'danger' : 'neutral'}
                aria-label="Izbriši medije"
                title="Izbriši"
                disabled={!isMediaEditable || (mediaTab === 'video' ? videoSelections.size === 0 : selectedImageIndexes.size === 0)}
                onClick={() => {
                  if (mediaTab === 'video') {
                    const selected = new Set(videoSelections);
                    setVideoEntriesDraft((current) => current.filter((entry) => !selected.has(entry.id)));
                    setVideoSelections(new Set());
                    return;
                  }
                  const selected = new Set(selectedImageIndexes);
                  setMediaImagesDraft((current) => current.filter((_, index) => !selected.has(index)));
                  setSelectedImageIndexes(new Set());
                }}
              >
                <TrashCanIcon />
              </IconButton>
              </div>
            </div>
            {mediaTab === 'slike' ? (
              <div className="mt-3 space-y-3">
                <p className="text-sm text-slate-500">Galerija artikla. Prva slika je glavna.</p>
                <div className="grid grid-cols-2 gap-2">
                  {mediaImagesDraft.map((img, index) => <div key={`${img}-${index}`} className="relative overflow-hidden rounded-lg border border-slate-200"><Image src={img} alt={`Slika ${index + 1}`} width={180} height={120} unoptimized className="h-24 w-full object-cover" />{isMediaEditable ? <div className="absolute left-1 top-1"><AdminCheckbox checked={selectedImageIndexes.has(index)} onChange={() => setSelectedImageIndexes((current) => { const next = new Set(current); if (next.has(index)) next.delete(index); else next.add(index); return next; })} /></div> : null}</div>)}
                  <label className={`flex h-24 flex-col items-center justify-center rounded-lg border border-dashed border-slate-300 text-sm text-slate-500 ${isMediaEditable ? 'cursor-pointer hover:border-[#2f66dd]' : 'cursor-not-allowed opacity-60'}`}>Dodaj slike<input disabled={!isMediaEditable} type="file" className="hidden" multiple accept="image/*" onChange={(event) => {
                    const urls = Array.from(event.target.files ?? []).map((file) => URL.createObjectURL(file));
                    setMediaImagesDraft((current) => [...current, ...urls]);
                  }} /></label>
                </div>
                <label className="inline-flex items-center gap-2 text-sm"><AdminCheckbox checked={sideSettings.showGallery} onChange={(event) => setSideSettings((current) => ({ ...current, showGallery: event.target.checked }))} />Prikaži galerijo na strani izdelka</label>
                <label className="inline-flex items-center gap-2 text-sm"><AdminCheckbox checked={sideSettings.autoSquareCrop} onChange={(event) => setSideSettings((current) => ({ ...current, autoSquareCrop: event.target.checked }))} />Samodejno obreži na kvadrat (1:1)</label>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs text-slate-600">Postavitev</label>
                    <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-1">
                      {([
                        { key: 'grid', icon: <span className="grid grid-cols-2 gap-0.5">{Array.from({ length: 4 }).map((_, idx) => <span key={idx} className="h-1.5 w-1.5 rounded-[2px] border border-current" />)}</span> },
                        { key: 'slider', icon: <span className="inline-flex gap-0.5">{Array.from({ length: 2 }).map((_, idx) => <span key={idx} className="h-3 w-1.5 rounded-[2px] border border-current" />)}</span> },
                        { key: 'list', icon: <span className="inline-flex flex-col gap-0.5">{Array.from({ length: 3 }).map((_, idx) => <span key={idx} className="h-1 w-4 rounded-[2px] border border-current" />)}</span> }
                      ] as const).map((modeOption) => (
                        <button
                          key={modeOption.key}
                          type="button"
                          aria-label={`Postavitev ${modeOption.key}`}
                          className={`inline-flex h-9 w-9 items-center justify-center rounded-md border transition ${sideSettings.galleryMode === modeOption.key ? 'border-[#6f95ff] bg-[#edf2ff] text-[#3e67d6]' : 'border-transparent bg-transparent text-slate-400 hover:text-slate-600'}`}
                          onClick={() => setSideSettings((current) => ({ ...current, galleryMode: modeOption.key }))}
                        >
                          {modeOption.icon}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-slate-600">Fokus slike</label>
                    <select className={inputClass} value={sideSettings.imageFocus} onChange={(event) => setSideSettings((current) => ({ ...current, imageFocus: event.target.value }))}>
                      <option value="center">Center</option>
                      <option value="top">Zgoraj</option>
                      <option value="bottom">Spodaj</option>
                    </select>
                  </div>
                </div>
                <div className="space-y-1"><label className="text-xs text-slate-600">Alt besedilo</label><input className={inputClass} value={sideSettings.imageAltText} onChange={(event) => setSideSettings((current) => ({ ...current, imageAltText: event.target.value }))} placeholder={`${draft.name || 'Artikel'} - različice`} /></div>
              </div>
            ) : (
              <div className="mt-3 space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <div className="space-y-1">
                      <label className="text-xs text-slate-600">YouTube URL</label>
                      <div className="flex gap-2">
                        <input className={inputClass} value={youtubeInput} disabled={!isMediaEditable} onChange={(event) => setYoutubeInput(event.target.value)} placeholder="https://www.youtube.com/watch?v=..." />
                        <Button type="button" variant="default" size="toolbar" disabled={!isMediaEditable} onClick={addYoutubeVideo}>Dodaj</Button>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs text-slate-600">Video datoteka</label>
                      <input
                        type="file"
                        accept="video/*"
                        disabled={!isMediaEditable}
                        className="block w-full text-xs text-slate-700 file:mr-2 file:rounded-md file:border-0 file:bg-slate-100 file:px-2 file:py-1 file:text-xs file:font-semibold"
                        onChange={(event) => {
                          const file = event.target.files?.[0];
                          if (!file) return;
                          setUploadedVideo({ name: file.name, url: URL.createObjectURL(file) });
                        }}
                      />
                      <Button type="button" variant="default" size="toolbar" disabled={!isMediaEditable || !uploadedVideo} onClick={addUploadedVideo}>Dodaj video</Button>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <p className="text-xs text-slate-600">Predogled</p>
                    <div className="grid grid-cols-2 gap-2">
                      {(videoEntriesDraft.length ? videoEntriesDraft : videoEntriesSaved).slice(0, 4).map((entry) => (
                        entry.source === 'youtube' ? (
                          <iframe key={entry.id} title={`Predogled ${entry.id}`} className="h-16 w-full rounded border border-slate-200" src={entry.previewUrl} />
                        ) : (
                          <video key={entry.id} controls className="h-16 w-full rounded border border-slate-200 object-cover"><source src={entry.previewUrl} /></video>
                        )
                      ))}
                    </div>
                  </div>
                </div>
                <div className="overflow-hidden rounded-lg border border-slate-200">
                  <table className="min-w-full text-xs">
                    <thead className="bg-slate-50">
                      <tr>
                        <th className="px-2 py-1.5 text-center" />
                        <th className="px-2 py-1.5 text-left">Vir videa</th>
                        <th className="px-2 py-1.5 text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {videoEntriesDraft.map((entry) => (
                        <tr key={entry.id} className="border-t border-slate-100">
                          <td className="px-2 py-1.5 text-center">
                            <AdminCheckbox checked={videoSelections.has(entry.id)} disabled={!isMediaEditable} onChange={() => setVideoSelections((current) => {
                              const next = new Set(current);
                              if (next.has(entry.id)) next.delete(entry.id); else next.add(entry.id);
                              return next;
                            })} />
                          </td>
                          <td className="px-2 py-1.5">{entry.source === 'youtube' ? 'YouTube povezava' : 'Naložen video'}</td>
                          <td className="px-2 py-1.5 text-center"><VisibilityChip visible={entry.visible} editable={isMediaEditable} onChange={(next) => setVideoEntriesDraft((current) => current.map((video) => video.id === entry.id ? { ...video, visible: next } : video))} /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </aside>
      </div>

      <section className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold tracking-tight">Uredi artikel</h2>
          <div className="flex items-center gap-2">
            <IconButton
              type="button"
              aria-label="Uredi tabelo artikla"
              title={isTableEditable ? 'Zaključi urejanje' : 'Uredi'}
              tone="neutral"
              onClick={() => setTableEditorMode((current) => (current === 'read' ? 'edit' : 'read'))}
            >
              <PencilIcon />
            </IconButton>
            <IconButton
              type="button"
              aria-label="Shrani tabelo artikla"
              title="Shrani"
              tone="neutral"
              disabled={!isTableEditable}
              onClick={() => setTableEditorMode('read')}
            >
              <SaveIcon />
            </IconButton>
            <IconButton
              type="button"
              aria-label="Odstrani izbrane različice"
              title="Izbriši izbrane"
              tone={hasSelectedVariants ? 'danger' : 'neutral'}
              disabled={!isTableEditable || !hasSelectedVariants}
              onClick={deleteSelectedVariants}
            >
              <TrashCanIcon />
            </IconButton>
            <Button type="button" variant="primary" size="toolbar" className="!h-8 !rounded-lg !px-3 !text-xs" onClick={generateVariants}>Generiraj različice</Button>
          </div>
        </div>
        <div className="mb-3 space-y-2">
          <p className="text-xs text-slate-500">
            Vnesi mere za vsako dimenzijo posebej, npr. <span className="rounded bg-slate-100 px-1 py-0.5 font-mono text-[11px] text-slate-700">Dolžina: 10,20</span>. Podprte dimenzije: Dolžina, Širina/fi in Debelina, največ 5 vrednosti na dimenzijo. Generiranje ustvari kartezični produkt vseh mer in na tej osnovi pripravi različice.
          </p>
          <p className="text-xs text-slate-500">Dodaj do tri čipe (Dolžina, Širina, Fi, Debelina). Vse mere naj bodo v milimetrih.</p>
          <div className="flex items-start gap-3">
            <div className="relative w-1/2 min-w-[300px]">
              <div className={`flex min-h-9 flex-wrap items-center gap-1 rounded-md border border-slate-300 px-2 py-1 pr-11 ${isGeneratorLocked ? '!bg-[color:var(--ui-neutral-bg)] text-slate-500' : 'bg-white'}`}>
                {generatorChips.map((chip) => (
                  <span key={chip.dimension} className="inline-flex items-center gap-1 rounded-md border border-slate-300 bg-slate-50 px-2 py-0.5 text-xs text-slate-700">
                    <button
                      type="button"
                      className="hover:text-slate-900 disabled:cursor-not-allowed disabled:text-slate-400"
                      disabled={isGeneratorLocked}
                      onClick={() => {
                        setGeneratorInput(`${generatorDimensionLabels[chip.dimension]}: ${chip.values.join(',')}`);
                        setGeneratorChips((current) => current.filter((entry) => entry.dimension !== chip.dimension));
                      }}
                    >
                      {`${generatorDimensionLabels[chip.dimension]}: ${chip.values.join(', ')}`}
                    </button>
                    <button
                      type="button"
                      aria-label={`Odstrani ${generatorDimensionLabels[chip.dimension]}`}
                      className="text-slate-500 transition hover:text-rose-600 active:text-rose-700 disabled:cursor-not-allowed disabled:text-slate-400"
                      disabled={isGeneratorLocked}
                      onClick={() => setGeneratorChips((current) => current.filter((entry) => entry.dimension !== chip.dimension))}
                    >
                      ×
                    </button>
                  </span>
                ))}
                <input
                  className={`h-6 min-w-[140px] flex-1 border-0 bg-transparent text-xs outline-none focus:ring-0 ${isGeneratorLocked ? 'cursor-not-allowed text-slate-500' : 'text-slate-900'}`}
                  value={generatorInput}
                  disabled={isGeneratorLocked}
                  onChange={(event) => {
                    setGeneratorInput(event.target.value);
                    if (generatorError) setGeneratorError(null);
                  }}
                  placeholder={generatorChips.length > 0 ? '' : 'Dolžina: 10,20'}
                  onKeyDown={(event) => {
                    if (event.key !== 'Enter') return;
                    event.preventDefault();
                    submitGeneratorEntry();
                  }}
                />
              </div>
              <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-slate-400">{combinationCount}</span>
            </div>
            <label className="mt-1 inline-flex items-center gap-2 text-xs text-slate-600">
              <span className="font-semibold text-slate-700">Cena:</span>
              <span className="relative inline-flex items-center">
                <input
                  type="number"
                  inputMode="decimal"
                  value={generatorPriceInput}
                  disabled={!isTableEditable}
                  onChange={(event) => setGeneratorPriceInput(event.target.value)}
                  className={`${compactTableNumberInputClassName} !w-28 !pr-12 text-right ${!isTableEditable ? '!bg-[color:var(--ui-neutral-bg)] text-slate-500' : ''}`}
                />
                <span className="pointer-events-none absolute right-2 text-[10px] text-slate-500">{generatorUnitLabel}</span>
              </span>
            </label>
          </div>
          <div className="text-xs">
            {generatorError ? <span className="text-rose-600">{generatorError}</span> : null}
          </div>
        </div>
        <div className="relative overflow-x-auto overflow-y-visible rounded-lg border border-slate-200">
          <table className="min-w-full text-[11px] leading-4">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-2 py-2 text-center">
                  <AdminCheckbox
                    checked={isTableEditable && allVariantsSelected}
                    onChange={() =>
                      setVariantSelections(allVariantsSelected ? new Set() : new Set(draft.variants.map((variant) => variant.id)))
                    }
                    disabled={!isTableEditable}
                  />
                </th>
                <th className="px-2 py-2 text-center">Dolžina</th>
                <th className="px-2 py-2 text-center">Širina/fi</th>
                <th className="px-2 py-2 text-center">Debelina</th>
                <th className="px-2 py-2 text-right">Teža (g)</th>
                <th className="px-2 py-2 text-center">Toleranca</th>
                <th className="px-2 py-2 text-right">Cena</th>
                <th className="px-2 py-2 text-right">Popust %</th>
                <th className="px-2 py-2 text-right">Akcijska cena</th>
                <th className="px-2 py-2 text-right">Zaloga</th>
                <th className="px-2 py-2 text-center">Min/nar.</th>
                <th className="px-2 py-2 text-center">SKU</th>
                <th className="px-1 py-2 text-center">Status</th>
                <th className="px-1 py-2 text-center">Opomba</th>
                <th className="px-2 py-2 text-center">Sort</th>
              </tr>
            </thead>
            <tbody>
              {draft.variants.map((variant, index) => (
                <tr key={variant.id} className="h-8 border-t border-slate-100 align-middle">
                  <td className="px-2 py-1.5 text-center"><AdminCheckbox checked={variantSelections.has(variant.id)} onChange={() => setVariantSelections((current) => { const next = new Set(current); if (next.has(variant.id)) next.delete(variant.id); else next.add(variant.id); return next; })} disabled={!isTableEditable} /></td>
                  <td className="px-2 py-1.5 text-center">{isTableEditable ? <input type="number" disabled={isBulkMaterial} className={`${compactTableNumberInputClassName} !w-10 text-center ${isBulkMaterial ? '!bg-[color:var(--ui-neutral-bg)] text-slate-500' : ''}`} value={variant.length ?? ''} onChange={(event) => updateVariant(index, { length: Number(event.target.value) || 0 })} /> : <span className={`inline-flex h-5 w-10 items-center justify-center ${isBulkMaterial ? 'text-slate-500' : ''}`}>{variant.length ?? '—'}</span>}</td>
                  <td className="px-2 py-1.5 text-center">{isTableEditable ? <input type="number" disabled={isBulkMaterial} className={`${compactTableNumberInputClassName} !w-10 text-center ${isBulkMaterial ? '!bg-[color:var(--ui-neutral-bg)] text-slate-500' : ''}`} value={variant.width ?? ''} onChange={(event) => updateVariant(index, { width: Number(event.target.value) || 0 })} /> : <span className={`inline-flex h-5 w-10 items-center justify-center ${isBulkMaterial ? 'text-slate-500' : ''}`}>{variant.width ?? '—'}</span>}</td>
                  <td className="px-2 py-1.5 text-center">{isTableEditable ? <input type="number" disabled={isBulkMaterial} className={`${compactTableNumberInputClassName} !w-10 text-center ${isBulkMaterial ? '!bg-[color:var(--ui-neutral-bg)] text-slate-500' : ''}`} value={variant.thickness ?? ''} onChange={(event) => updateVariant(index, { thickness: Number(event.target.value) || 0 })} /> : <span className={`inline-flex h-5 w-10 items-center justify-center ${isBulkMaterial ? 'text-slate-500' : ''}`}>{variant.thickness ?? '—'}</span>}</td>
                  <td className="px-2 py-1.5 text-right">{isTableEditable ? <span className="inline-flex w-full justify-end"><input type="number" inputMode="decimal" className={`${compactTableNumberInputClassName} !mt-0 !w-14 text-right`} value={sideSettings.weightPerUnit} onChange={(event) => setSideSettings((current) => ({ ...current, weightPerUnit: event.target.value }))} /></span> : <span className="inline-flex h-5 w-full justify-end"><span className="inline-flex h-5 w-14 items-center justify-end">{sideSettings.weightPerUnit || '—'}</span></span>}</td>
                  <td className="px-2 py-1.5 text-center">
                    {isTableEditable ? (
                      <div className="inline-flex h-5 w-[52px] items-center justify-center gap-0.5">
                        <span className="text-slate-500">±</span>
                        <input
                          type="number"
                          inputMode="decimal"
                          className={`${compactTableNumberInputClassName} !mt-0 !w-10 text-center`}
                          value={sideSettings.thicknessTolerance}
                          onChange={(event) => setSideSettings((current) => ({ ...current, thicknessTolerance: event.target.value }))}
                        />
                      </div>
                    ) : (
                      <span className="inline-flex h-5 w-[52px] items-center justify-center">{sideSettings.thicknessTolerance ? `±${sideSettings.thicknessTolerance}` : '—'}</span>
                    )}
                  </td>
                  <td className="px-2 py-1.5 text-right">{isTableEditable ? <span className="inline-flex w-full justify-end"><input type="number" inputMode="decimal" className={`${compactTableNumberInputClassName} !mt-0 !w-14 text-right`} value={variant.price} onChange={(event) => updateVariant(index, { price: Number(event.target.value) || 0 })} /></span> : <span className="inline-flex h-5 w-full justify-end"><span className="inline-flex h-5 w-14 items-center justify-end">{formatCurrency(variant.price)}</span></span>}</td>
                  <td className="px-2 py-1.5 text-right">{isTableEditable ? <span className="inline-flex w-full justify-end"><input type="number" inputMode="decimal" min={0} max={99.9} step={0.1} className={`${compactTableNumberInputClassName} !mt-0 !w-12 text-right`} value={variant.discountPct} onChange={(event) => updateVariant(index, { discountPct: Math.min(99.9, Math.max(0, Number(event.target.value) || 0)) })} /></span> : <span className="inline-flex h-5 w-full justify-end"><span className="inline-flex h-5 w-12 items-center justify-end">{variant.discountPct}</span></span>}</td>
                  <td className="px-2 py-1.5 text-right"><span className="inline-flex h-5 items-center justify-end">{formatCurrency(computeSalePrice(variant.price, variant.discountPct))}</span></td>
                  <td className="px-2 py-1.5 text-right">{isTableEditable ? <span className="inline-flex w-full justify-end"><input type="number" inputMode="numeric" className={`${compactTableNumberInputClassName} !mt-0 !w-12 text-right`} value={variant.stock} onChange={(event) => updateVariant(index, { stock: Number(event.target.value) || 0 })} /></span> : <span className="inline-flex h-5 w-full justify-end"><span className="inline-flex h-5 w-12 items-center justify-end">{variant.stock}</span></span>}</td>
                  <td className="px-2 py-1.5 text-center">{isTableEditable ? <input type="number" inputMode="numeric" className={`${compactTableNumberInputClassName} !mt-0 !w-10 text-center`} value={sideSettings.moq} onChange={(event) => setSideSettings((current) => ({ ...current, moq: Number(event.target.value) || 1 }))} /> : <span className="inline-flex h-5 w-10 items-center justify-center">{sideSettings.moq}</span>}</td>
                  <td className="px-2 py-1.5 text-center">{isTableEditable ? <input className={`${orderLikeEditableInputClassName} !mt-0 !h-5 !w-[132px] text-center`} value={variant.sku} onChange={(event) => updateVariant(index, { sku: event.target.value })} /> : <span className="inline-flex h-5 w-[132px] items-center justify-center overflow-hidden text-ellipsis whitespace-nowrap text-center">{variant.sku || '—'}</span>}</td>
                  <td className="px-1 py-1.5 text-center">
                    <div className="inline-flex justify-center">
                      <ActiveStateChip
                        active={variant.active}
                        editable={isTableEditable}
                        chipClassName="!h-5 !min-w-[94px] !px-1.5 !text-[10px]"
                        menuPlacement="bottom"
                        onChange={(next) => updateVariant(index, { active: next })}
                      />
                    </div>
                  </td>
                  <td className="px-1 py-1.5 text-center">
                    <div className="inline-flex justify-center">
                      <TagStateChip
                        value={getVariantTag(variant.id)}
                        editable={isTableEditable}
                        chipClassName="!h-5 !min-w-[94px] !px-1.5 !text-[10px]"
                        menuPlacement="bottom"
                        onChange={(next) => setVariantTag(variant.id, next)}
                      />
                    </div>
                  </td>
                  <td className="px-2 py-1.5 text-center">{isTableEditable ? <input type="number" inputMode="numeric" className={`${compactTableNumberInputClassName} !mt-0 !w-10 text-center`} value={variant.sort} onChange={(event) => updateVariant(index, { sort: Number(event.target.value) || 1 })} /> : <span className="inline-flex h-5 w-10 items-center justify-center">{variant.sort}</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Button type="button" variant="ghost" size="toolbar" disabled={!isTableEditable} className="mt-3" onClick={() => setDraft((current) => ({ ...current, variants: [...current.variants, createVariant({ sort: current.variants.length + 1 })] }))}><PlusIcon />Dodaj različico</Button>
      </section>
    </div>
  );
}
