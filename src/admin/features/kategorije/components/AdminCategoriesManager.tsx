'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent, type FocusEvent, type ReactNode, type CSSProperties } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Image from 'next/image';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  closestCenter,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
  useSortable,
  verticalListSortingStrategy
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { CatalogCategory, CatalogItem, CatalogSubcategory } from '@/commercial/catalog/catalog';
import {
  formatCatalogPrice,
  getCatalogCategoryItemPrice,
  getCatalogCategoryItemSku,
  getCatalogItemPrice,
  getCatalogItemSku,
  getDiscountedPrice,
  sortCatalogItems
} from '@/commercial/catalog/catalog';
import { Button } from '@/shared/ui/button';
import { ConfirmDialog } from '@/shared/ui/confirm-dialog';
import { IconButton } from '@/shared/ui/icon-button';
import { Chip } from '@/shared/ui/badge';
import { MenuItem, MenuPanel } from '@/shared/ui/menu';
import { RowActions } from '@/shared/ui/table';
import { AdminTableLayout } from '@/shared/ui/admin-table';
import { ADMIN_CONTROL_HEIGHT, ADMIN_CONTROL_PADDING_X } from '@/shared/ui/admin-controls/controlSizes';
import {
  adminTableRowToneClasses,
  buttonTokenClasses,
  getAdminCategoryRowToneClass
} from '@/shared/ui/theme/tokens';
import { Input } from '@/shared/ui/input';
import { Spinner } from '@/shared/ui/loading';
import { useToast } from '@/shared/ui/toast';
import { Tabs, TabsList, TabsTrigger } from '@/shared/ui/tabs';
import Selecto from 'react-selecto';

type CatalogData = { categories: CatalogCategory[] };
type AdminCategoriesPayload = { categories: CatalogCategory[]; statuses?: Record<string, CategoryStatus> };

type SelectedNode =
  | { kind: 'root' }
  | { kind: 'category'; categorySlug: string }
  | { kind: 'subcategory'; categorySlug: string; subcategorySlug: string };

type DeleteTarget =
  | { kind: 'root' }
  | { kind: 'category'; categorySlug: string }
  | { kind: 'subcategory'; categorySlug: string; subcategorySlug?: string }
  | null;

type ImageDeleteTarget =
  | { kind: 'category' | 'subcategory'; categorySlug: string; subcategorySlug?: string }
  | null;

type ContentCard = {
  id: string;
  title: string;
  description: string;
  image?: string;
  kind: 'category' | 'subcategory';
};

type EditingRowDraft = {
  id: string;
  kind: 'root' | 'category' | 'subcategory';
  categorySlug?: string;
  subcategorySlug?: string;
  title: string;
  description: string;
  status: CategoryStatus;
};

type CreateTarget =
  | { kind: 'category'; afterSlug?: string }
  | { kind: 'subcategory'; categorySlug: string; afterSlug?: string }
  | null;

type MillerDeleteTarget =
  | { column: 'categories'; ids: string[] }
  | { column: 'subcategories'; ids: string[]; categorySlug: string }
  | { column: 'items'; ids: string[]; categorySlug: string; subcategorySlug?: string }
  | null;

type CategoryStatus = 'active' | 'inactive';

type MillerRenameDraft = { id: string; value: string };
type HistorySnapshot = { catalog: CatalogData; statuses: Record<string, CategoryStatus> };

const bulkDeleteButtonClass = buttonTokenClasses.danger;
const CATEGORY_STATUS_STORAGE_KEY = 'admin-categories-status-v1';
const rootId = 'root';
const catId = (slug: string) => `cat:${slug}`;
const subId = (catSlug: string, subSlug: string) => `sub:${catSlug}:${subSlug}`;
const itemId = (catSlug: string, itemSlug: string, subSlug?: string) => `item:${catSlug}:${subSlug ?? '_'}:${itemSlug}`;
const slugify = (value: string) =>
  value.toLowerCase().trim().replace(/\s+/g, '-').replace(/[^a-z0-9-čšžćđ]/gi, '');


const createNodeId = () =>
  typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `id-${Math.random().toString(36).slice(2, 11)}`;

const normalizeNodeId = (value: unknown, fallbackSeed: string) => {
  if (typeof value === 'string' && value.trim().length > 0) return value.trim();

  let hash = 0;
  for (const char of fallbackSeed) {
    hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  }

  return `id-${hash.toString(36)}`;
};

const treeIndent = 32;
const treeRowHeight = 48;
const treeHalfRowHeight = treeRowHeight / 2;
const leafConnectorWidth = 22;
const treeButtonDiameter = 28;
const treeButtonRadius = treeButtonDiameter / 2;
const treeConnectorBleed = 1;
const expandTransitionMs = 140;
const treeCheckboxSize = 16;
const treeCheckboxHalf = treeCheckboxSize / 2;

const getCheckboxLeftFromTreeStart = (
  kind: 'root' | 'category' | 'subcategory',
  buttonLeft: number,
  parentColumnX: number | null
) => {
  if (kind === 'root') return 0;

  // category row: place checkbox in the space before the expand connector/button area
  if (kind === 'category') {
    return 0;
  }

  // subcategory row: place checkbox exactly between the two vertical lines
  if (parentColumnX !== null) {
    const leftConnectorX = parentColumnX - treeIndent;
    const rightConnectorX = parentColumnX;
    const targetCenterX = (leftConnectorX + rightConnectorX) / 2 + 18;
    return targetCenterX - treeCheckboxHalf;
  }

  return 0;
};

async function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.onerror = () => reject(new Error('Napaka pri branju datoteke'));
    reader.readAsDataURL(file);
  });
}

function SortableItem({
  id,
  children
}: {
  id: string;
  children: (dragHandleProps: Record<string, unknown>) => ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id });

  return (
    <div ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition }}>
      {children({ ...attributes, ...listeners })}
    </div>
  );
}


function SortableTreeRow({
  id,
  disabled = false,
  children
}: {
  id: string;
  disabled?: boolean;
  children: (args: {
    dragHandleProps: Record<string, unknown>;
    setNodeRef: (node: HTMLElement | null) => void;
    style: CSSProperties;
    isDragging: boolean;
  }) => ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
    disabled
  });

  return children({
    dragHandleProps: disabled ? {} : { ...attributes, ...listeners },
    setNodeRef,
    style: { transform: CSS.Transform.toString(transform), transition },
    isDragging
  });
}

function ChevronDownIcon() {
  return (
    <svg viewBox="0 0 20 20" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path d="M5 8l5 5 5-5" />
    </svg>
  );
}

function ChevronUpIcon() {
  return (
    <svg viewBox="0 0 20 20" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path d="M5 12l5-5 5 5" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg viewBox="0 0 20 20" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path d="M10 4v12M4 10h12" />
    </svg>
  );
}

function SaveIcon() {
  return (
    <svg viewBox="0 0 20 20" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path d="M4 3h9l3 3v11H4z" />
      <path d="M7 3v5h6V3" />
      <path d="M7 13h6" />
    </svg>
  );
}

function normalizeCatalogData(input: unknown): CatalogData {
  const source =
    typeof input === 'object' && input !== null && Array.isArray((input as { categories?: unknown }).categories)
      ? (input as { categories: unknown[] }).categories
      : [];

  const categories = source
    .map((rawCategory) => {
      if (typeof rawCategory !== 'object' || rawCategory === null) return null;
      const category = rawCategory as Partial<CatalogCategory>;
      const slug = typeof category.slug === 'string' ? category.slug.trim() : '';
      if (!slug) return null;

      const subcategoriesSource = Array.isArray(category.subcategories) ? category.subcategories : [];
      const categoryId = normalizeNodeId(category.id, `cat-${slug}`);

      return {
        id: categoryId,
        slug,
        title: typeof category.title === 'string' ? category.title : slug,
        summary: typeof category.summary === 'string' ? category.summary : '',
        description: typeof category.description === 'string' ? category.description : '',
        image: typeof category.image === 'string' ? category.image : '',
        adminNotes: typeof category.adminNotes === 'string' ? category.adminNotes : undefined,
        bannerImage: typeof category.bannerImage === 'string' ? category.bannerImage : undefined,
        subcategories: subcategoriesSource
          .map((rawSubcategory) => {
            if (typeof rawSubcategory !== 'object' || rawSubcategory === null) return null;
            const subcategory = rawSubcategory as Partial<CatalogSubcategory>;
            const subSlug = typeof subcategory.slug === 'string' ? subcategory.slug.trim() : '';
            if (!subSlug) return null;
            return {
              id: normalizeNodeId(subcategory.id, `sub-${categoryId}-${slug}-${subSlug}`),
              slug: subSlug,
              title: typeof subcategory.title === 'string' ? subcategory.title : subSlug,
              description: typeof subcategory.description === 'string' ? subcategory.description : '',
              adminNotes: typeof subcategory.adminNotes === 'string' ? subcategory.adminNotes : undefined,
              image: typeof subcategory.image === 'string' ? subcategory.image : '',
              items: Array.isArray(subcategory.items) ? subcategory.items : []
            } as CatalogSubcategory;
          })
          .filter((entry): entry is CatalogSubcategory => entry !== null),
        items: Array.isArray(category.items) ? category.items : []
      } as CatalogCategory;
    })
    .filter((entry): entry is CatalogCategory => entry !== null);

  return { categories };
}


function summarizeCatalogChanges(
  previous: CatalogData,
  next: CatalogData,
  previousStatuses: Record<string, CategoryStatus> = {},
  nextStatuses: Record<string, CategoryStatus> = {}
): string[] {
  const lines: string[] = [];
  const prevCats = previous.categories;
  const nextCats = next.categories;
  const prevById = new Map(prevCats.map((c, i) => [c.id, { c, i }]));
  const nextById = new Map(nextCats.map((c, i) => [c.id, { c, i }]));

  for (const { c } of prevById.values()) {
    if (!nextById.has(c.id)) lines.push(`izbrisana kategorija "${c.title}"`);
  }
  for (const { c } of nextById.values()) {
    if (!prevById.has(c.id)) lines.push(`dodana kategorija "${c.title}"`);
  }

  for (const [id, { c: oldCat, i: oldIndex }] of prevById.entries()) {
    const match = nextById.get(id);
    if (!match) continue;
    const newCat = match.c;
    if (oldCat.title !== newCat.title) lines.push(`preimenovana kategorija "${oldCat.title}" → "${newCat.title}"`);
    if ((oldCat.image ?? '') !== (newCat.image ?? '')) lines.push(`spremenjena slika za kategorijo "${newCat.title}"`);
    if (oldIndex !== match.i) lines.push(`premaknjena kategorija "${newCat.title}"`);

    const oldSubs = oldCat.subcategories ?? [];
    const newSubs = newCat.subcategories ?? [];
    const oldSubsById = new Map(oldSubs.map((sub, i) => [sub.id, { sub, i }]));
    const newSubsById = new Map(newSubs.map((sub, i) => [sub.id, { sub, i }]));

    for (const { sub } of oldSubsById.values()) {
      if (!newSubsById.has(sub.id)) lines.push(`izbrisana podkategorija "${sub.title}"`);
    }
    for (const { sub } of newSubsById.values()) {
      if (!oldSubsById.has(sub.id)) lines.push(`dodana podkategorija pod "${newCat.title}": "${sub.title}"`);
    }

    for (const [subId, { sub: oldSub, i: oldSubIndex }] of oldSubsById.entries()) {
      const nextSubMatch = newSubsById.get(subId);
      if (!nextSubMatch) continue;
      const newSub = nextSubMatch.sub;
      if (oldSub.title !== newSub.title) lines.push(`preimenovana podkategorija "${oldSub.title}" → "${newSub.title}"`);
      if ((oldSub.image ?? '') !== (newSub.image ?? '')) lines.push(`spremenjena slika za podkategorijo "${newSub.title}"`);
      if (oldSubIndex !== nextSubMatch.i) lines.push(`premaknjena podkategorija "${newSub.title}"`);
    }
  }

  const labelById = new Map<string, string>();
  nextCats.forEach((category) => {
    labelById.set(catId(category.slug), category.title);
    category.subcategories.forEach((subcategory) => {
      labelById.set(subId(category.slug, subcategory.slug), subcategory.title);
    });
  });

  const allStatusIds = new Set([...Object.keys(previousStatuses), ...Object.keys(nextStatuses)]);
  for (const id of allStatusIds) {
    const before = previousStatuses[id] ?? 'active';
    const after = nextStatuses[id] ?? 'active';
    if (before === after) continue;

    if (id.startsWith('cat:')) {
      const label = labelById.get(id) ?? id.slice(4);
      lines.push(`spremenjen status kategorije "${label}" na ${after === 'active' ? 'Aktivna' : 'Neaktivna'}`);
      continue;
    }

    if (id.startsWith('sub:')) {
      const label = labelById.get(id) ?? id;
      lines.push(`spremenjen status podkategorije "${label}" na ${after === 'active' ? 'Aktivna' : 'Neaktivna'}`);
    }
  }

  return lines;
}

type CategoriesView = 'table' | 'miller';

export default function AdminCategoriesManager({
  initialView = 'table',
  initialPayload
}: {
  initialView?: CategoriesView;
  initialPayload?: AdminCategoriesPayload;
}) {
  const [catalog, setCatalog] = useState<CatalogData>({ categories: [] });
  const [selected, setSelected] = useState<SelectedNode>({ kind: 'root' });
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [editingRow, setEditingRow] = useState<EditingRowDraft | null>(null);
  const [statusByRow, setStatusByRow] = useState<Record<string, CategoryStatus>>({});
  const [openStatusMenuRowId, setOpenStatusMenuRowId] = useState<string | null>(null);
  const [statusMenuPlacement, setStatusMenuPlacement] = useState<Record<string, 'top' | 'bottom'>>({});
  const [isStatusHeaderMenuOpen, setIsStatusHeaderMenuOpen] = useState(false);
  const [selectedRows, setSelectedRows] = useState<string[]>([]);
  const [createTarget, setCreateTarget] = useState<CreateTarget>(null);
  const [createName, setCreateName] = useState('');
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);
  const [isBulkDeleteDialogOpen, setIsBulkDeleteDialogOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [deletingRowId, setDeletingRowId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget>(null);
  const [warningDialog, setWarningDialog] = useState<{ title: string; description: string } | null>(null);
  const [openingRowIds, setOpeningRowIds] = useState<string[]>([]);
  const [closingRowIds, setClosingRowIds] = useState<string[]>([]);
  const [imageDeleteTarget, setImageDeleteTarget] = useState<ImageDeleteTarget>(null);
  const [loading, setLoading] = useState(!initialPayload);
  const [saving, setSaving] = useState(false);
  const [tableDirty, setTableDirty] = useState(false);
  const [tableError, setTableError] = useState<string | null>(null);
  const [isTableSaveDialogOpen, setIsTableSaveDialogOpen] = useState(false);
  const [lowerViewCount, setLowerViewCount] = useState(4);
  const [millerCatalog, setMillerCatalog] = useState<CatalogData>({ categories: [] });
  const [millerSelection, setMillerSelection] = useState<string[]>([]);
  const [millerDropTarget, setMillerDropTarget] = useState<string | null>(null);
  const [millerDirty, setMillerDirty] = useState(false);
  const [millerDeleteTarget, setMillerDeleteTarget] = useState<MillerDeleteTarget>(null);
  const [isMillerSaveDialogOpen, setIsMillerSaveDialogOpen] = useState(false);
  const [millerError, setMillerError] = useState<string | null>(null);
  const [millerRename, setMillerRename] = useState<MillerRenameDraft | null>(null);
  const [tableSaveSummary, setTableSaveSummary] = useState<string[]>([]);
  const [millerSaveSummary, setMillerSaveSummary] = useState<string[]>([]);
  const [pendingNavigation, setPendingNavigation] = useState<string | null>(null);
  const [isUnsavedLeaveDialogOpen, setIsUnsavedLeaveDialogOpen] = useState(false);
  const [isHistoryMenuOpen, setIsHistoryMenuOpen] = useState(false);
  const [activeMillerDragId, setActiveMillerDragId] = useState<string | null>(null);

  const { toast } = useToast();
  const pathname = usePathname();
  const router = useRouter();
  const [activeView, setActiveView] = useState<CategoriesView>(initialView);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));
  const uploadRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const statusMenuRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const statusHeaderMenuRef = useRef<HTMLDivElement>(null);
  const selectAllRef = useRef<HTMLInputElement>(null);
  const isInlineSavingRef = useRef(false);
  const toastRef = useRef(toast);
  const persistedTableRef = useRef<CatalogData>({ categories: [] });
  const persistedMillerRef = useRef<CatalogData>({ categories: [] });
  const persistedStatusRef = useRef<Record<string, CategoryStatus>>({});
  const stagedTableHistoryRef = useRef<HistorySnapshot[]>([]);
  const stagedMillerHistoryRef = useRef<HistorySnapshot[]>([]);
  const committedHistoryRef = useRef<HistorySnapshot[]>([]);
  const committedHistoryIndexRef = useRef(0);
  const historyMenuRef = useRef<HTMLDivElement | null>(null);
  const millerViewportRef = useRef<HTMLDivElement | null>(null);

  const applyPayloadState = useCallback((payloadRaw: AdminCategoriesPayload) => {
    const payload = normalizeCatalogData(payloadRaw);
    const nextStatuses = payloadRaw.statuses ?? {};

    setCatalog(payload);
    setMillerCatalog(payload);
    persistedTableRef.current = payload;
    persistedMillerRef.current = payload;
    setTableDirty(false);
    setTableError(null);
    setMillerDirty(false);
    setMillerSelection([]);
    setExpanded((prev) => ({
      ...prev,
      ...Object.fromEntries(payload.categories.map((entry) => [catId(entry.slug), prev[catId(entry.slug)] ?? false]))
    }));

    setStatusByRow(() => {
      const next = { ...nextStatuses };
      payload.categories.forEach((category) => {
        const categoryId = catId(category.slug);
        if (!next[categoryId]) next[categoryId] = 'active';
        (category.subcategories ?? []).forEach((subcategory) => {
          const subcategoryId = subId(category.slug, subcategory.slug);
          if (!next[subcategoryId]) next[subcategoryId] = 'active';
        });
      });
      persistedStatusRef.current = next;
      return next;
    });
    const initialSnapshot = { catalog: payload, statuses: { ...persistedStatusRef.current } };
    stagedTableHistoryRef.current = [initialSnapshot];
    stagedMillerHistoryRef.current = [initialSnapshot];
    committedHistoryRef.current = [initialSnapshot];
    committedHistoryIndexRef.current = 0;
  }, []);

  const load = useCallback(async ({ silent = false }: { silent?: boolean } = {}) => {
    if (!silent) setLoading(true);

    try {
      const response = await fetch('/api/admin/categories', { cache: 'no-store' });

      if (!response.ok) {
        toastRef.current.error('Napaka pri nalaganju kategorij');
        return;
      }

      const payloadRaw = (await response.json()) as AdminCategoriesPayload;
      applyPayloadState(payloadRaw);
    } catch {
      toastRef.current.error('Napaka pri nalaganju kategorij');
    } finally {
      if (!silent) setLoading(false);
    }
  }, [applyPayloadState]);

  useEffect(() => {
    toastRef.current = toast;
  }, [toast]);

  useEffect(() => {
    if (initialPayload) {
      applyPayloadState(initialPayload);
      setLoading(false);
      return;
    }
    void load();
  }, [applyPayloadState, initialPayload, load]);

  useEffect(() => {
    setActiveView(pathname?.endsWith('/miller-view') ? 'miller' : 'table');
  }, [pathname]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(CATEGORY_STATUS_STORAGE_KEY, JSON.stringify(statusByRow));
  }, [statusByRow]);

  useEffect(() => {
    const closeOnOutsideClick = (event: MouseEvent) => {
      const target = event.target as Node;

      if (openStatusMenuRowId) {
        const container = statusMenuRefs.current[openStatusMenuRowId];
        if (container && !container.contains(target)) {
          setOpenStatusMenuRowId(null);
        }
      }

      if (isStatusHeaderMenuOpen && statusHeaderMenuRef.current && !statusHeaderMenuRef.current.contains(target)) {
        setIsStatusHeaderMenuOpen(false);
      }
    };

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpenStatusMenuRowId(null);
        setIsStatusHeaderMenuOpen(false);
      }
    };

    window.addEventListener('mousedown', closeOnOutsideClick);
    window.addEventListener('keydown', closeOnEscape);
    return () => {
      window.removeEventListener('mousedown', closeOnOutsideClick);
      window.removeEventListener('keydown', closeOnEscape);
    };
  }, [isStatusHeaderMenuOpen, openStatusMenuRowId]);

  const persist = async (next: CatalogData, statuses: Record<string, CategoryStatus>, message = 'Shranjeno') => {
    const previousCatalog = catalog;
    const normalizedNext = normalizeCatalogData(next);

    setCatalog(normalizedNext);
    setSaving(true);

    try {
      const response = await fetch('/api/admin/categories', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...normalizedNext, statuses })
      });

      if (!response.ok) {
        setCatalog(previousCatalog);
        const payload = (await response.json().catch(() => null)) as { message?: string } | null;
        toast.error(payload?.message || 'Shranjevanje ni uspelo');
        return false;
      }

      await load({ silent: true });
      toast.success(message);
      return true;
    } catch {
      setCatalog(previousCatalog);
      toast.error('Shranjevanje ni uspelo');
      return false;
    } finally {
      setSaving(false);
    }
  };

  const selectedContext = useMemo(() => {
    if (selected.kind === 'root') return { kind: 'root' as const };

    const category = catalog.categories.find((entry) => entry.slug === selected.categorySlug);
    if (!category) return null;

    if (selected.kind === 'category') return { kind: 'category' as const, category };

    const subcategory = category.subcategories.find((entry) => entry.slug === selected.subcategorySlug);
    if (!subcategory) return null;

    return { kind: 'subcategory' as const, category, subcategory };
  }, [catalog.categories, selected]);


  const millerSelectedContext = useMemo(() => {
    if (selected.kind === 'root') return { kind: 'root' as const };

    const category = millerCatalog.categories.find((entry) => entry.slug === selected.categorySlug);
    if (!category) return null;

    if (selected.kind === 'category') return { kind: 'category' as const, category };

    const subcategory = category.subcategories.find((entry) => entry.slug === selected.subcategorySlug);
    if (!subcategory) return null;

    return { kind: 'subcategory' as const, category, subcategory };
  }, [millerCatalog.categories, selected]);

  const stageMillerCatalog = (next: CatalogData, nextStatuses: Record<string, CategoryStatus> = statusByRow) => {
    const normalized = normalizeCatalogData(next);
    stagedMillerHistoryRef.current.push({ catalog: normalized, statuses: { ...nextStatuses } });
    setMillerCatalog(normalized);
    setStatusByRow(nextStatuses);
    setMillerDirty(true);
    setMillerError(null);
  };

  const stageTableCatalog = (next: CatalogData, nextStatuses: Record<string, CategoryStatus> = statusByRow) => {
    const normalized = normalizeCatalogData(next);
    stagedTableHistoryRef.current.push({ catalog: normalized, statuses: { ...nextStatuses } });
    setCatalog(normalized);
    setStatusByRow(nextStatuses);
    setTableDirty(true);
    setTableError(null);
  };

  const stageStatusChange = (nextStatuses: Record<string, CategoryStatus>) => {
    const snapshot = {
      catalog: normalizeCatalogData(activeView === 'miller' ? millerCatalog : catalog),
      statuses: { ...nextStatuses }
    };

    if (activeView === 'miller') {
      stagedMillerHistoryRef.current.push(snapshot);
      setMillerDirty(true);
      setMillerError(null);
    } else {
      stagedTableHistoryRef.current.push(snapshot);
      setTableDirty(true);
      setTableError(null);
    }

    setStatusByRow(nextStatuses);
  };

  const hasUnsavedChanges = tableDirty || millerDirty;

  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!hasUnsavedChanges) return;
      event.preventDefault();
      event.returnValue = '';
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasUnsavedChanges]);

  useEffect(() => {
    const handleDocumentClick = (event: MouseEvent) => {
      if (!hasUnsavedChanges) return;
      const target = event.target as HTMLElement | null;
      const anchor = target?.closest('a[href]') as HTMLAnchorElement | null;
      if (!anchor) return;
      const href = anchor.getAttribute('href');
      if (!href || href.startsWith('#') || href.startsWith('javascript:')) return;
      if (!href.startsWith('/')) return;
      if (href === pathname) return;
      event.preventDefault();
      setPendingNavigation(href);
      setIsUnsavedLeaveDialogOpen(true);
    };

    document.addEventListener('click', handleDocumentClick, true);
    return () => document.removeEventListener('click', handleDocumentClick, true);
  }, [hasUnsavedChanges, pathname]);

  useEffect(() => {
    const closeHistoryMenuOnOutside = (event: MouseEvent) => {
      if (!isHistoryMenuOpen) return;
      const target = event.target as Node | null;
      if (historyMenuRef.current && target && !historyMenuRef.current.contains(target)) {
        setIsHistoryMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', closeHistoryMenuOnOutside);
    return () => document.removeEventListener('mousedown', closeHistoryMenuOnOutside);
  }, [isHistoryMenuOpen]);

  const guardedNavigate = (nextPath: string) => {
    if (nextPath === pathname) return;
    if (!hasUnsavedChanges) {
      router.push(nextPath);
      return;
    }

    setPendingNavigation(nextPath);
    setIsUnsavedLeaveDialogOpen(true);
  };


  const undoStagedChanges = () => {
    if (activeView === 'miller') {
      if (stagedMillerHistoryRef.current.length <= 1) return;
      stagedMillerHistoryRef.current.pop();
      const previous = stagedMillerHistoryRef.current[stagedMillerHistoryRef.current.length - 1];
      setMillerCatalog(normalizeCatalogData(previous.catalog));
      setStatusByRow({ ...previous.statuses });
      setMillerDirty(stagedMillerHistoryRef.current.length > 1);
      return;
    }

    if (stagedTableHistoryRef.current.length <= 1) return;
    stagedTableHistoryRef.current.pop();
    const previous = stagedTableHistoryRef.current[stagedTableHistoryRef.current.length - 1];
    setCatalog(normalizeCatalogData(previous.catalog));
    setStatusByRow({ ...previous.statuses });
    setTableDirty(stagedTableHistoryRef.current.length > 1);
  };

  const restoreCommittedHistory = () => {
    const previousIndex = committedHistoryIndexRef.current - 1;
    if (previousIndex < 0) {
      toast.error('Ni starejše shranjene verzije za obnovitev.');
      return;
    }

    committedHistoryIndexRef.current = previousIndex;
    const snapshot = committedHistoryRef.current[previousIndex];
    setCatalog(normalizeCatalogData(snapshot.catalog));
    setMillerCatalog(normalizeCatalogData(snapshot.catalog));
    setStatusByRow({ ...snapshot.statuses });
    setTableDirty(true);
    setMillerDirty(true);
    stagedTableHistoryRef.current = [{ catalog: normalizeCatalogData(snapshot.catalog), statuses: { ...snapshot.statuses } }];
    stagedMillerHistoryRef.current = [{ catalog: normalizeCatalogData(snapshot.catalog), statuses: { ...snapshot.statuses } }];
  };

  const addCategory = (title: string, afterSlug?: string) => {
    const slug = slugify(title);
    if (!slug) return;

    const sourceCatalog = activeView === 'miller' ? millerCatalog : catalog;

    if (sourceCatalog.categories.some((entry) => entry.slug === slug)) {
      toast.error('Kategorija s tem nazivom že obstaja');
      return;
    }

    const item: CatalogCategory = {
      id: createNodeId(),
      slug,
      title,
      summary: title,
      description: '',
      image: '',
      subcategories: [],
      items: []
    };

    const list = [...sourceCatalog.categories];

    if (!afterSlug) {
      list.push(item);
    } else {
      const index = list.findIndex((entry) => entry.slug === afterSlug);
      if (index < 0) list.push(item);
      else list.splice(index + 1, 0, item);
    }

    setExpanded((prev) => ({ ...prev, [catId(slug)]: true }));
    if (activeView === 'miller') {
      stageMillerCatalog({ categories: list });
    } else {
      stageTableCatalog({ categories: list });
    }
  };

  const addSubcategory = (categorySlug: string, title: string, afterSlug?: string) => {
    const slug = slugify(title);
    if (!slug) return;

    const sourceCatalog = activeView === 'miller' ? millerCatalog : catalog;
    const parentCategory = sourceCatalog.categories.find((entry) => entry.slug === categorySlug);
    if (!parentCategory) return;
    if (parentCategory.subcategories.some((entry) => entry.slug === slug)) {
      toast.error('Podkategorija s tem nazivom že obstaja');
      return;
    }

    const next = {
      categories: sourceCatalog.categories.map((entry) => {
        if (entry.slug !== categorySlug) return entry;

        const sub: CatalogSubcategory = {
          id: createNodeId(),
          slug,
          title,
          description: '',
          image: '',
          items: []
        };

        const list = [...entry.subcategories];

        if (!afterSlug) {
          list.push(sub);
        } else {
          const index = list.findIndex((node) => node.slug === afterSlug);
          if (index < 0) list.push(sub);
          else list.splice(index + 1, 0, sub);
        }

        return { ...entry, subcategories: list };
      })
    };

    setExpanded((prev) => ({ ...prev, [catId(categorySlug)]: true }));
    if (activeView === 'miller') {
      stageMillerCatalog(next);
    } else {
      stageTableCatalog(next);
    }
  };

  const openCreateDialog = (target: CreateTarget) => {
    setCreateTarget(target);
    setCreateName('');
  };

  const confirmCreate = () => {
    const nextName = createName.trim();
    if (!nextName || !createTarget) return;

    if (createTarget.kind === 'category') {
      addCategory(nextName, createTarget.afterSlug);
    } else {
      addSubcategory(createTarget.categorySlug, nextName, createTarget.afterSlug);
    }

    setCreateTarget(null);
    setCreateName('');
  };


  const onTreeDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const activeId = String(active.id);
    const overId = String(over.id);

    if (activeId.startsWith('cat:') && overId.startsWith('cat:')) {
      const oldIndex = catalog.categories.findIndex((entry) => catId(entry.slug) === activeId);
      const newIndex = catalog.categories.findIndex((entry) => catId(entry.slug) === overId);
      if (oldIndex < 0 || newIndex < 0) return;

      stageTableCatalog({ categories: arrayMove(catalog.categories, oldIndex, newIndex) });
      return;
    }

    if (!activeId.startsWith('sub:')) return;

    const [, activeCategorySlug, activeSubSlug] = activeId.split(':');
    const sourceCategory = catalog.categories.find((entry) => entry.slug === activeCategorySlug);
    if (!sourceCategory) return;
    const movingSubcategory = sourceCategory.subcategories.find((entry) => entry.slug === activeSubSlug);
    if (!movingSubcategory) return;

    if (overId === rootId) {
      const nextCategories = catalog.categories.map((entry) => ({
        ...entry,
        subcategories: entry.subcategories.filter((sub) => sub.slug !== activeSubSlug)
      }));

      nextCategories.push({
        ...movingSubcategory,
        summary: '',
        image: movingSubcategory.image ?? '',
        subcategories: []
      });

      stageTableCatalog({ categories: nextCategories });
      return;
    }

    if (overId.startsWith('cat:')) {
      const targetCategorySlug = overId.slice(4);
      if (targetCategorySlug === activeCategorySlug) return;

      const nextCategories = catalog.categories.map((entry) => {
        if (entry.slug === activeCategorySlug) {
          return { ...entry, subcategories: entry.subcategories.filter((sub) => sub.slug !== activeSubSlug) };
        }

        if (entry.slug === targetCategorySlug) {
          return { ...entry, subcategories: [...entry.subcategories, movingSubcategory] };
        }

        return entry;
      });

      setExpanded((prev) => ({ ...prev, [catId(targetCategorySlug)]: true }));
      stageTableCatalog({ categories: nextCategories });
      return;
    }

    if (!overId.startsWith('sub:')) return;
    const [, overCategorySlug, overSubSlug] = overId.split(':');

    if (activeCategorySlug === overCategorySlug) {
      const oldIndex = sourceCategory.subcategories.findIndex((entry) => entry.slug === activeSubSlug);
      const newIndex = sourceCategory.subcategories.findIndex((entry) => entry.slug === overSubSlug);
      if (oldIndex < 0 || newIndex < 0) return;

      const nextCategories = catalog.categories.map((entry) =>
        entry.slug === activeCategorySlug
          ? { ...entry, subcategories: arrayMove(entry.subcategories, oldIndex, newIndex) }
          : entry
      );

      stageTableCatalog({ categories: nextCategories });
      return;
    }

    const targetCategory = catalog.categories.find((entry) => entry.slug === overCategorySlug);
    if (!targetCategory) return;
    const targetIndex = targetCategory.subcategories.findIndex((entry) => entry.slug === overSubSlug);
    if (targetIndex < 0) return;

    const nextCategories = catalog.categories.map((entry) => {
      if (entry.slug === activeCategorySlug) {
        return { ...entry, subcategories: entry.subcategories.filter((sub) => sub.slug !== activeSubSlug) };
      }

      if (entry.slug === overCategorySlug) {
        const nextSubs = [...entry.subcategories];
        nextSubs.splice(targetIndex, 0, movingSubcategory);
        return { ...entry, subcategories: nextSubs };
      }

      return entry;
    });

    setExpanded((prev) => ({ ...prev, [catId(overCategorySlug)]: true }));
    stageTableCatalog({ categories: nextCategories });
  };

  const onBottomReorder = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    if (selected.kind === 'root') {
      const oldIndex = catalog.categories.findIndex((entry) => entry.slug === active.id);
      const newIndex = catalog.categories.findIndex((entry) => entry.slug === over.id);
      if (oldIndex < 0 || newIndex < 0) return;

      stageTableCatalog({ categories: arrayMove(catalog.categories, oldIndex, newIndex) });
      return;
    }

    if (selected.kind !== 'category') return;

    const category = catalog.categories.find((entry) => entry.slug === selected.categorySlug);
    if (!category) return;

    const oldIndex = category.subcategories.findIndex((entry) => entry.slug === active.id);
    const newIndex = category.subcategories.findIndex((entry) => entry.slug === over.id);
    if (oldIndex < 0 || newIndex < 0) return;

    const next = {
      categories: catalog.categories.map((entry) =>
        entry.slug === selected.categorySlug
          ? { ...entry, subcategories: arrayMove(entry.subcategories, oldIndex, newIndex) }
          : entry
      )
    };

    stageTableCatalog(next);
  };

  const onLeafProductsDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id || !selectedContext || selectedContext.kind === 'root') return;

    if (selectedContext.kind === 'category') {
      const items = sortCatalogItems(selectedContext.category.items ?? []);
      const oldIndex = items.findIndex((item) => item.slug === active.id);
      const newIndex = items.findIndex((item) => item.slug === over.id);
      if (oldIndex < 0 || newIndex < 0) return;

      const reordered = arrayMove(items, oldIndex, newIndex).map((item, index) => ({
        ...item,
        displayOrder: index + 1
      }));

      stageTableCatalog({
        categories: catalog.categories.map((entry) =>
          entry.slug === selectedContext.category.slug ? { ...entry, items: reordered } : entry
        )
      });
      return;
    }

    const items = sortCatalogItems(selectedContext.subcategory.items);
    const oldIndex = items.findIndex((item) => item.slug === active.id);
    const newIndex = items.findIndex((item) => item.slug === over.id);
    if (oldIndex < 0 || newIndex < 0) return;

    const reordered = arrayMove(items, oldIndex, newIndex).map((item, index) => ({
      ...item,
      displayOrder: index + 1
    }));

    const next = {
      categories: catalog.categories.map((entry) =>
        entry.slug === selectedContext.category.slug
          ? {
              ...entry,
              subcategories: entry.subcategories.map((sub) =>
                sub.slug === selectedContext.subcategory.slug ? { ...sub, items: reordered } : sub
              )
            }
          : entry
      )
    };

    stageTableCatalog(next);
  };


  const toggleMillerSelection = (id: string, event: React.MouseEvent<HTMLButtonElement>, columnIds: string[]) => {
    setMillerSelection((prev) => {
      if (event.shiftKey && prev.length > 0) {
        const last = prev[prev.length - 1];
        const start = columnIds.indexOf(last);
        const finish = columnIds.indexOf(id);
        if (start >= 0 && finish >= 0) {
          const [a, b] = start < finish ? [start, finish] : [finish, start];
          const range = columnIds.slice(a, b + 1);
          return [...new Set([...prev.filter((entry) => !columnIds.includes(entry)), ...range])];
        }
      }

      if (event.metaKey || event.ctrlKey) {
        return prev.includes(id) ? prev.filter((entry) => entry !== id) : [...prev, id];
      }

      if (prev.includes(id) && prev.length > 1) {
        return prev;
      }

      return [id];
    });
  };

  const applyMillerMove = (targetId: string) => {
    if (millerSelection.length === 0) return;
    if (millerSelection.includes(targetId)) return;

    const parseCategoryId = (id: string) => (id.startsWith('cat:') ? id.slice(4) : null);
    const parseSubcategoryId = (id: string) => {
      if (!id.startsWith('sub:')) return null;
      const [, categorySlug, subcategorySlug] = id.split(':');
      if (!categorySlug || !subcategorySlug) return null;
      return { categorySlug, subcategorySlug };
    };

    const selectedCategorySlugs = new Set(
      millerSelection
        .map(parseCategoryId)
        .filter((entry): entry is string => entry !== null)
    );
    const selectedSubKeys = new Set(
      millerSelection.filter((entry) => entry.startsWith('sub:'))
    );
    const selectedItemKeys = new Set(
      millerSelection.filter((entry) => entry.startsWith('item:'))
    );

    const targetCategorySlug = parseCategoryId(targetId);
    const targetSub = parseSubcategoryId(targetId);

    let nextCategories: CatalogCategory[] = millerCatalog.categories.map((category) => ({
      ...category,
      subcategories: category.subcategories.map((subcategory) => ({
        ...subcategory,
        items: [...subcategory.items]
      })),
      items: [...(category.items ?? [])]
    }));

    if (selectedCategorySlugs.size > 0) {
      if (targetId === rootId || targetCategorySlug) {
        const moved = nextCategories.filter((category) => selectedCategorySlugs.has(category.slug));
        const remaining = nextCategories.filter((category) => !selectedCategorySlugs.has(category.slug));

        if (targetId === rootId) {
          nextCategories = [...remaining, ...moved];
        } else if (targetCategorySlug) {
          const targetIndex = remaining.findIndex((category) => category.slug === targetCategorySlug);
          if (targetIndex >= 0) {
            remaining.splice(targetIndex, 0, ...moved);
            nextCategories = remaining;
          }
        }
      }

      if (targetSub || targetCategorySlug) {
        const destinationCategorySlug = targetSub?.categorySlug ?? targetCategorySlug;

        if (destinationCategorySlug) {
          const movedCategories = nextCategories.filter((category) => selectedCategorySlugs.has(category.slug));
          const withChildren = movedCategories.filter((category) => category.subcategories.length > 0);

          const asSubcategories = movedCategories.map((category) => ({
            id: category.id,
            slug: category.slug,
            title: category.title,
            description: category.description || category.summary,
            adminNotes: category.adminNotes,
            image: category.image,
            items: [...(category.items ?? [])]
          }));

          const promotedFormerChildren = movedCategories.flatMap((category) => category.subcategories);
          const candidateSlugs = new Set<string>();
          [...asSubcategories, ...promotedFormerChildren].forEach((subcategory) => {
            if (candidateSlugs.has(subcategory.slug)) {
              toast.error('Premik ni možen zaradi podvojenih slugov podkategorij.');
            }
            candidateSlugs.add(subcategory.slug);
          });

          nextCategories = nextCategories
            .filter((category) => !selectedCategorySlugs.has(category.slug))
            .map((category) => {
              if (category.slug !== destinationCategorySlug) return category;
              const destinationExisting = new Set(category.subcategories.map((sub) => sub.slug));
              const duplicates = [...candidateSlugs].filter((slug) => destinationExisting.has(slug));
              if (duplicates.length > 0) {
                toast.error('Premik ni možen zaradi podvojenih slugov podkategorij.');
                return category;
              }

              const insertion = [...asSubcategories, ...promotedFormerChildren];
              if (targetSub) {
                const targetIndex = category.subcategories.findIndex((sub) => sub.slug === targetSub.subcategorySlug);
                if (targetIndex >= 0) {
                  const nextSubs = [...category.subcategories];
                  nextSubs.splice(targetIndex, 0, ...insertion);
                  return { ...category, subcategories: nextSubs };
                }
              }

              return { ...category, subcategories: [...category.subcategories, ...insertion] };
            });
        }
      }
    }

    if (selectedSubKeys.size > 0) {
      if (targetId === rootId) {
        const promoted: CatalogCategory[] = [];
        nextCategories = nextCategories
          .map((category) => {
            const remainingSubs = category.subcategories.filter((subcategory) => {
              const key = subId(category.slug, subcategory.slug);
              if (!selectedSubKeys.has(key)) return true;
              promoted.push({
                id: subcategory.id,
                slug: subcategory.slug,
                title: subcategory.title,
                summary: subcategory.title,
                description: subcategory.description,
                image: subcategory.image ?? '',
                adminNotes: subcategory.adminNotes,
                subcategories: [],
                items: [...subcategory.items]
              });
              return false;
            });
            return { ...category, subcategories: remainingSubs };
          });
        nextCategories = [...nextCategories, ...promoted];
      } else if (targetCategorySlug || targetSub) {
        const destinationCategorySlug = targetSub?.categorySlug ?? targetCategorySlug;
        if (destinationCategorySlug) {
          const movedSubs: CatalogSubcategory[] = [];

          nextCategories = nextCategories.map((category) => ({
            ...category,
            subcategories: category.subcategories.filter((subcategory) => {
              const key = subId(category.slug, subcategory.slug);
              const moving = selectedSubKeys.has(key);
              if (moving) movedSubs.push(subcategory);
              return !moving;
            })
          }));

          const duplicateWithinMoved = new Set<string>();
          for (const moved of movedSubs) {
            if (duplicateWithinMoved.has(moved.slug)) {
              toast.error('Premik ni možen zaradi podvojenih slugov podkategorij.');
              return;
            }
            duplicateWithinMoved.add(moved.slug);
          }

          nextCategories = nextCategories.map((category) => {
            if (category.slug !== destinationCategorySlug) return category;
            const existing = new Set(category.subcategories.map((sub) => sub.slug));
            const hasCollision = movedSubs.some((sub) => existing.has(sub.slug));
            if (hasCollision) {
              toast.error('Premik ni možen zaradi podvojenih slugov podkategorij.');
              return category;
            }

            if (targetSub) {
              const targetIndex = category.subcategories.findIndex((sub) => sub.slug === targetSub.subcategorySlug);
              if (targetIndex >= 0) {
                const nextSubs = [...category.subcategories];
                nextSubs.splice(targetIndex, 0, ...movedSubs);
                return { ...category, subcategories: nextSubs };
              }
            }

            return { ...category, subcategories: [...category.subcategories, ...movedSubs] };
          });
        }
      }
    }

    if (selectedItemKeys.size > 0 && (targetCategorySlug || targetSub)) {
      const movedItems: CatalogItem[] = [];
      nextCategories = nextCategories.map((category) => ({
        ...category,
        items: (category.items ?? []).filter((item) => {
          const key = itemId(category.slug, item.slug);
          const moving = selectedItemKeys.has(key);
          if (moving) movedItems.push(item);
          return !moving;
        }),
        subcategories: category.subcategories.map((subcategory) => ({
          ...subcategory,
          items: subcategory.items.filter((item) => {
            const key = itemId(category.slug, item.slug, subcategory.slug);
            const moving = selectedItemKeys.has(key);
            if (moving) movedItems.push(item);
            return !moving;
          })
        }))
      }));

      if (targetSub) {
        nextCategories = nextCategories.map((category) =>
          category.slug !== targetSub.categorySlug
            ? category
            : {
                ...category,
                subcategories: category.subcategories.map((subcategory) =>
                  subcategory.slug === targetSub.subcategorySlug
                    ? { ...subcategory, items: [...subcategory.items, ...movedItems] }
                    : subcategory
                )
              }
        );
      } else if (targetCategorySlug) {
        nextCategories = nextCategories.map((category) =>
          category.slug === targetCategorySlug
            ? { ...category, items: [...(category.items ?? []), ...movedItems] }
            : category
        );
      }
    }

    stageMillerCatalog({ categories: nextCategories });
    setMillerDropTarget(null);
  };

  const applyMillerRename = () => {
    if (!millerRename) return;
    const value = millerRename.value.trim();
    if (!value) {
      toast.error('Naziv je obvezen');
      return;
    }

    if (millerRename.id.startsWith('cat:')) {
      const slug = millerRename.id.slice(4);
      stageMillerCatalog({
        categories: millerCatalog.categories.map((category) =>
          category.slug === slug ? { ...category, title: value, summary: value } : category
        )
      });
      setMillerRename(null);
      return;
    }

    if (millerRename.id.startsWith('sub:')) {
      const [, categorySlug, subcategorySlug] = millerRename.id.split(':');
      stageMillerCatalog({
        categories: millerCatalog.categories.map((category) =>
          category.slug !== categorySlug
            ? category
            : {
                ...category,
                subcategories: category.subcategories.map((subcategory) =>
                  subcategory.slug === subcategorySlug ? { ...subcategory, title: value } : subcategory
                )
              }
        )
      });
      setMillerRename(null);
    }
  };

  const requestDeleteMillerSelection = (column: 'categories' | 'subcategories' | 'items') => {
    const ids = millerSelection.filter((entry) =>
      column === 'categories' ? entry.startsWith('cat:') : column === 'subcategories' ? entry.startsWith('sub:') : entry.startsWith('item:')
    );

    if (ids.length === 0) return;

    if (column === 'subcategories' && selected.kind !== 'root') {
      setMillerDeleteTarget({ column, ids, categorySlug: selected.categorySlug });
      return;
    }

    if (column === 'items' && selected.kind !== 'root') {
      setMillerDeleteTarget({
        column,
        ids,
        categorySlug: selected.categorySlug,
        subcategorySlug: selected.kind === 'subcategory' ? selected.subcategorySlug : undefined
      });
      return;
    }

    if (column === 'categories') {
      setMillerDeleteTarget({ column: 'categories', ids });
    }
  };

  const confirmMillerDelete = () => {
    if (!millerDeleteTarget) return;

    let nextCategories = [...millerCatalog.categories];

    if (millerDeleteTarget.column === 'categories') {
      const selectedCategories = new Set(millerDeleteTarget.ids.map((id) => id.slice(4)));
      nextCategories = nextCategories.filter((category) => !selectedCategories.has(category.slug));
    }

    if (millerDeleteTarget.column === 'subcategories') {
      const selectedSubcategories = new Set(millerDeleteTarget.ids);
      nextCategories = nextCategories.map((category) => ({
        ...category,
        subcategories: category.subcategories.filter((subcategory) => !selectedSubcategories.has(subId(category.slug, subcategory.slug)))
      }));
    }

    if (millerDeleteTarget.column === 'items') {
      const selectedItems = new Set(millerDeleteTarget.ids);
      nextCategories = nextCategories.map((category) => ({
        ...category,
        items: (category.items ?? []).filter((item) => !selectedItems.has(itemId(category.slug, item.slug))),
        subcategories: category.subcategories.map((sub) => ({
          ...sub,
          items: sub.items.filter((item) => !selectedItems.has(itemId(category.slug, item.slug, sub.slug)))
        }))
      }));
    }

    stageMillerCatalog({ categories: nextCategories });
    setMillerSelection([]);
    setMillerDeleteTarget(null);
  };

  const addMillerNode = (column: 'categories' | 'subcategories' | 'items') => {
    if (column === 'categories') {
      openCreateDialog({ kind: 'category' });
      return;
    }

    if (column === 'subcategories' && selected.kind !== 'root') {
      openCreateDialog({ kind: 'subcategory', categorySlug: selected.categorySlug });
      return;
    }

    toast.error('Dodajanje artiklov v Miller pogledu trenutno ni podprto.');
  };

  const saveMillerChanges = async () => {
    const ok = await persist(millerCatalog, statusByRow, 'Miller spremembe shranjene');
    if (!ok) {
      setMillerError('Shranjevanje Miller sprememb ni uspelo. Lokalno stanje je ohranjeno.');
      return;
    }

    persistedMillerRef.current = normalizeCatalogData(millerCatalog);
    persistedStatusRef.current = { ...statusByRow };
    committedHistoryRef.current = committedHistoryRef.current.slice(0, committedHistoryIndexRef.current + 1);
    const snapshot = { catalog: normalizeCatalogData(millerCatalog), statuses: { ...statusByRow } };
    committedHistoryRef.current.push(snapshot);
    committedHistoryIndexRef.current = committedHistoryRef.current.length - 1;
    stagedMillerHistoryRef.current = [snapshot];
    stagedTableHistoryRef.current = [snapshot];
    setMillerDirty(false);
    setTableDirty(false);
    setMillerError(null);
  };

  const saveTableChanges = async () => {
    const ok = await persist(catalog, statusByRow, 'Spremembe shranjene');
    if (!ok) {
      setTableError('Shranjevanje sprememb ni uspelo. Lokalno stanje je ohranjeno.');
      return;
    }

    persistedTableRef.current = normalizeCatalogData(catalog);
    persistedStatusRef.current = { ...statusByRow };
    committedHistoryRef.current = committedHistoryRef.current.slice(0, committedHistoryIndexRef.current + 1);
    const snapshot = { catalog: normalizeCatalogData(catalog), statuses: { ...statusByRow } };
    committedHistoryRef.current.push(snapshot);
    committedHistoryIndexRef.current = committedHistoryRef.current.length - 1;
    stagedTableHistoryRef.current = [snapshot];
    stagedMillerHistoryRef.current = [snapshot];
    setTableDirty(false);
    setMillerDirty(false);
    setTableError(null);
  };


  const millerColumns = useMemo(() => {
    const columns: Array<{ key: string; title: string; ids: string[]; rows: Array<{ id: string; label: string; tone: string; kind: 'category' | 'subcategory' | 'item'; onClick: (event: React.MouseEvent<HTMLButtonElement>) => void; onDragStart: () => void; onDropTarget: string; }>; kind: 'categories' | 'subcategories' | 'items' }> = [];

    const categoryIds = millerCatalog.categories.map((category) => catId(category.slug));
    columns.push({
      key: 'categories',
      title: 'Kategorije',
      kind: 'categories',
      ids: categoryIds,
      rows: millerCatalog.categories.map((category) => ({
        id: catId(category.slug),
        label: category.title,
        tone: selected.kind !== 'root' && selected.categorySlug === category.slug ? 'focused' : 'default',
        onClick: (event) => {
          setSelected({ kind: 'category', categorySlug: category.slug });
          toggleMillerSelection(catId(category.slug), event, categoryIds);
        },
        onDragStart: () => {
          if (!millerSelection.includes(catId(category.slug))) setMillerSelection([catId(category.slug)]);
        },
        onDropTarget: rootId,
        kind: 'category'
      }))
    });

    if (selected.kind === 'root') return columns;

    const activeCategory = millerCatalog.categories.find((entry) => entry.slug === selected.categorySlug);
    if (!activeCategory) return columns;

    const hasSubcategories = activeCategory.subcategories.length > 0;

    if (hasSubcategories) {
      const subIds = activeCategory.subcategories.map((sub) => subId(activeCategory.slug, sub.slug));
      columns.push({
        key: `sub-${activeCategory.slug}`,
        title: 'Podkategorije',
        kind: 'subcategories',
        ids: subIds,
        rows: activeCategory.subcategories.map((subcategory) => ({
          id: subId(activeCategory.slug, subcategory.slug),
          label: subcategory.title,
          tone: selected.kind === 'subcategory' && selected.subcategorySlug === subcategory.slug ? 'focused' : 'default',
          onClick: (event) => {
            setSelected({ kind: 'subcategory', categorySlug: activeCategory.slug, subcategorySlug: subcategory.slug });
            toggleMillerSelection(subId(activeCategory.slug, subcategory.slug), event, subIds);
          },
          onDragStart: () => {
            const id = subId(activeCategory.slug, subcategory.slug);
            if (!millerSelection.includes(id)) setMillerSelection([id]);
          },
          onDropTarget: catId(activeCategory.slug),
          kind: 'subcategory'
        }))
      });
    }

    const itemSource = selected.kind === 'subcategory'
      ? activeCategory.subcategories.find((sub) => sub.slug === selected.subcategorySlug)?.items ?? []
      : !hasSubcategories
        ? (activeCategory.items ?? [])
        : [];

    const showItems = selected.kind === 'subcategory' || !hasSubcategories;

    if (showItems) {
      const itemIds = itemSource.map((item) => itemId(activeCategory.slug, item.slug, selected.kind === 'subcategory' ? selected.subcategorySlug : undefined));
      columns.push({
        key: `item-${activeCategory.slug}-${selected.kind === 'subcategory' ? selected.subcategorySlug : 'cat'}`,
        title: 'Artikli',
        kind: 'items',
        ids: itemIds,
        rows: itemSource.map((item) => {
          const id = itemId(activeCategory.slug, item.slug, selected.kind === 'subcategory' ? selected.subcategorySlug : undefined);
          return {
            id,
            label: item.name,
            tone: 'default',
            onClick: (event: React.MouseEvent<HTMLButtonElement>) => toggleMillerSelection(id, event, itemIds),
            onDragStart: () => {
              if (!millerSelection.includes(id)) setMillerSelection([id]);
            },
            onDropTarget: selected.kind === 'subcategory' ? subId(activeCategory.slug, selected.subcategorySlug) : catId(activeCategory.slug),
            kind: 'item'
          };
        })
      });
    }

    return columns;
  }, [millerCatalog.categories, millerSelection, selected]);

  const updateSubcategory = (categorySlug: string, subSlug: string, patch: Partial<CatalogSubcategory>) => {
    stageTableCatalog({
      categories: catalog.categories.map((entry) =>
        entry.slug === categorySlug
          ? {
              ...entry,
              subcategories: entry.subcategories.map((sub) =>
                sub.slug === subSlug ? { ...sub, ...patch } : sub
              )
            }
          : entry
      )
    });
  };

  const onImageUpload = async (file: File | null, item: ContentCard, categorySlug?: string) => {
    if (!file) return;
    const dataUrl = await fileToDataUrl(file);

    if (item.kind === 'category') {
      stageTableCatalog({ categories: catalog.categories.map((entry) => (entry.slug === item.id ? { ...entry, image: dataUrl } : entry)) });
      return;
    }

    if (!categorySlug) return;
    updateSubcategory(categorySlug, item.id, { image: dataUrl });
  };

  const confirmDeleteNode = () => {
    if (!deleteTarget) return;

    if (deleteTarget.kind === 'root') {
      setDeleteTarget(null);
      setSelected({ kind: 'root' });
      stageTableCatalog({ categories: [] });
      return;
    }

    if (deleteTarget.kind === 'category') {
      setDeleteTarget(null);
      setSelected({ kind: 'root' });
      stageTableCatalog({ categories: catalog.categories.filter((entry) => entry.slug !== deleteTarget.categorySlug) });
      return;
    }

    setDeleteTarget(null);
    setSelected({ kind: 'category', categorySlug: deleteTarget.categorySlug });

    stageTableCatalog({
      categories: catalog.categories.map((entry) =>
        entry.slug === deleteTarget.categorySlug
          ? {
              ...entry,
              subcategories: entry.subcategories.filter((sub) => sub.slug !== deleteTarget.subcategorySlug)
            }
          : entry
      )
    });
  };

  const confirmDeleteImage = () => {
    if (!imageDeleteTarget) return;

    if (imageDeleteTarget.kind === 'category') {
      stageTableCatalog({
        categories: catalog.categories.map((entry) =>
          entry.slug === imageDeleteTarget.categorySlug ? { ...entry, image: '' } : entry
        )
      });
      setImageDeleteTarget(null);
      return;
    }

    updateSubcategory(imageDeleteTarget.categorySlug, imageDeleteTarget.subcategorySlug ?? '', {
      image: ''
    });
    setImageDeleteTarget(null);
  };

  const visibleContent = useMemo(() => {
    if (selectedContext?.kind === 'root') {
      return catalog.categories.map((entry) => ({
        id: entry.slug,
        title: entry.title,
        description: entry.summary,
        image: entry.image,
        kind: 'category' as const
      }));
    }

    if (selectedContext?.kind === 'category') {
      return selectedContext.category.subcategories.map((entry) => ({
        id: entry.slug,
        title: entry.title,
        description: entry.description,
        image: entry.image,
        kind: 'subcategory' as const
      }));
    }

    return [];
  }, [catalog.categories, selectedContext]);

  const getDescendantIds = (id: string) => {
    if (id === rootId) {
      return catalog.categories.flatMap((category) => [
        catId(category.slug),
        ...category.subcategories.map((subcategory) => subId(category.slug, subcategory.slug))
      ]);
    }

    if (id.startsWith('cat:')) {
      const categorySlug = id.slice(4);
      const category = catalog.categories.find((entry) => entry.slug === categorySlug);
      if (!category) return [];
      return category.subcategories.map((subcategory) => subId(category.slug, subcategory.slug));
    }

    return [];
  };

  const showDeleteSelectionWarning = () => {
    setWarningDialog({
      title: 'Brisanje ni dovoljeno',
      description:
        'Kategorije ali podkategorije ni mogoče izbrisati, dokler niso izbrane vse njene podrejene podkategorije.'
    });
  };

  const hasIncompleteDescendantSelection = (selectedIds: string[]) => {
    const selectedSet = new Set(selectedIds);

    return selectedIds.some((id) => {
      if (!id.startsWith('cat:') && id !== rootId) return false;
      const descendants = getDescendantIds(id);
      return descendants.some((descendantId) => !selectedSet.has(descendantId));
    });
  };

  const toggleExpanded = (id: string) => {
    const currentlyExpanded = expanded[id] ?? false;

    if (currentlyExpanded) {
      setClosingRowIds((prev) => (prev.includes(id) ? prev : [...prev, id]));
      setExpanded((prev) => ({ ...prev, [id]: false }));
      window.setTimeout(() => {
        setClosingRowIds((prev) => prev.filter((entry) => entry !== id));
      }, expandTransitionMs);
      return;
    }

    setOpeningRowIds((prev) => (prev.includes(id) ? prev : [...prev, id]));
    setExpanded((prev) => ({ ...prev, [id]: true }));
    window.setTimeout(() => {
      setOpeningRowIds((prev) => prev.filter((entry) => entry !== id));
    }, expandTransitionMs);
  };

  const saveInlineEdit = () => {
    if (!editingRow) return;
    const nextTitle = editingRow.title.trim();

    if (!nextTitle) {
      toast.error('Naziv je obvezen');
      return;
    }

    if (editingRow.kind === 'category') {
      if (!editingRow.categorySlug) return;
      const nextStatuses = { ...statusByRow, [editingRow.id]: editingRow.status };
      stageTableCatalog({
        categories: catalog.categories.map((entry) =>
          entry.slug === editingRow.categorySlug
            ? { ...entry, title: nextTitle, summary: editingRow.description }
            : entry
        )
      }, nextStatuses);
      setEditingRow(null);
      return;
    }

    if (!editingRow.categorySlug || !editingRow.subcategorySlug) return;

    const nextStatuses = { ...statusByRow, [editingRow.id]: editingRow.status };
    stageTableCatalog({
      categories: catalog.categories.map((entry) =>
        entry.slug === editingRow.categorySlug
          ? {
              ...entry,
              subcategories: entry.subcategories.map((sub) =>
                sub.slug === editingRow.subcategorySlug
                  ? { ...sub, title: nextTitle, description: editingRow.description }
                  : sub
              )
            }
          : entry
      )
    }, nextStatuses);

    setEditingRow(null);
  };

  const handleInlineBlur = (event: FocusEvent<HTMLElement>) => {
    const nextTarget = event.relatedTarget as Node | null;
    if (nextTarget && event.currentTarget.closest('tr')?.contains(nextTarget)) {
      return;
    }
    saveInlineEdit();
  };


  const searchQuery = query.trim().toLowerCase();
  const isSearchActive = searchQuery.length > 0;

  const filteredCategories = useMemo(() => {
    if (!isSearchActive) return catalog.categories;

    return catalog.categories
      .map((category) => {
        const categoryMatches = [category.title, category.summary, category.description]
          .join(' ')
          .toLowerCase()
          .includes(searchQuery);

        const matchingSubcategories = category.subcategories.filter((subcategory) =>
          [subcategory.title, subcategory.description].join(' ').toLowerCase().includes(searchQuery)
        );

        if (!categoryMatches && matchingSubcategories.length === 0) return null;

        return {
          ...category,
          subcategories: categoryMatches ? category.subcategories : matchingSubcategories
        };
      })
      .filter((category): category is CatalogCategory => category !== null);
  }, [catalog.categories, isSearchActive, searchQuery]);

  const visibleRowIds = useMemo(() => {
    const ids: string[] = [];

    filteredCategories.forEach((category) => {
      const categoryNodeId = catId(category.slug);
      ids.push(categoryNodeId);

      if (isSearchActive || expanded[categoryNodeId] || closingRowIds.includes(categoryNodeId)) {
        category.subcategories.forEach((subcategory) => {
          ids.push(subId(category.slug, subcategory.slug));
        });
      }
    });

    return ids;
  }, [closingRowIds, expanded, filteredCategories, isSearchActive]);

  const selectableVisibleRowIds = useMemo(() => visibleRowIds, [visibleRowIds]);

  const selectedVisibleCount = useMemo(
    () => selectableVisibleRowIds.filter((id) => selectedRows.includes(id)).length,
    [selectableVisibleRowIds, selectedRows]
  );

  const allRowsSelected =
    selectableVisibleRowIds.length > 0 && selectedVisibleCount === selectableVisibleRowIds.length;

  useEffect(() => {
    const validIds = new Set([
      ...catalog.categories.map((category) => catId(category.slug)),
      ...catalog.categories.flatMap((category) =>
        category.subcategories.map((subcategory) => subId(category.slug, subcategory.slug))
      )
    ]);

    setSelectedRows((current) => current.filter((id) => validIds.has(id)));
  }, [catalog.categories]);

  useEffect(() => {
    if (!selectAllRef.current) return;
    selectAllRef.current.indeterminate = selectedVisibleCount > 0 && !allRowsSelected;
  }, [allRowsSelected, selectedVisibleCount]);

  const toggleSelectAll = () => {
    if (allRowsSelected) {
      setSelectedRows((current) => current.filter((id) => !selectableVisibleRowIds.includes(id)));
      return;
    }

    setSelectedRows((current) => {
      const nextSet = new Set(current);

      selectableVisibleRowIds.forEach((id) => {
        nextSet.add(id);
        getDescendantIds(id).forEach((descendantId) => nextSet.add(descendantId));
      });

      return Array.from(nextSet);
    });
  };

  const handleBulkDelete = () => {
    if (selectedRows.length === 0) return;
    if (hasIncompleteDescendantSelection(selectedRows)) {
      showDeleteSelectionWarning();
      return;
    }
    setIsBulkDeleteDialogOpen(true);
  };

  const confirmBulkDelete = async () => {
    if (selectedRows.length === 0) return;
    if (hasIncompleteDescendantSelection(selectedRows)) {
      showDeleteSelectionWarning();
      return;
    }

    setIsBulkDeleteDialogOpen(false);
    setIsBulkDeleting(true);
    const selectedSet = new Set(selectedRows);

    const next = {
      categories: catalog.categories
        .filter((category) => !selectedSet.has(catId(category.slug)))
        .map((category) => ({
          ...category,
          subcategories: category.subcategories.filter(
            (subcategory) => !selectedSet.has(subId(category.slug, subcategory.slug))
          )
        }))
    };

    stageTableCatalog(next);
    setSelectedRows([]);
    setIsBulkDeleting(false);
  };

  const renderTreeRow = ({
    id,
    title,
    level,
    kind,
    categorySlug,
    subcategorySlug,
    description,
    childrenCount,
    productCount,
    ancestorContinuationColumns,
    continueCurrentColumnBelow,
    parentIsAnimating
  }: {
    id: string;
    title: string;
    level: number;
    kind: 'root' | 'category' | 'subcategory';
    categorySlug?: string;
    subcategorySlug?: string;
    description: string;
    childrenCount: number;
    productCount: number;
    ancestorContinuationColumns: boolean[];
    continueCurrentColumnBelow: boolean;
    parentIsAnimating?: boolean;
  }) => {
    const isSelected =
      (selected.kind === 'root' && kind === 'root') ||
      (selected.kind === 'category' && kind === 'category' && selected.categorySlug === categorySlug) ||
      (selected.kind === 'subcategory' &&
        kind === 'subcategory' &&
        selected.categorySlug === categorySlug &&
        selected.subcategorySlug === subcategorySlug);

    const hasChildren = childrenCount > 0;
    const isExpanded = expanded[id] ?? false;
    const isRowEditing = editingRow?.id === id;
    const isChecked = selectedRows.includes(id);
    const rowDepthTone = getAdminCategoryRowToneClass(level);
    const rowStatus = statusByRow[id] ?? 'active';
    const statusLabel = rowStatus === 'active' ? 'Aktivna' : 'Neaktivna';

    const toggleInlineEdit = () => {
      if (isRowEditing) {
        setEditingRow(null);
        setOpenStatusMenuRowId(null);
        return;
      }

      setEditingRow({
        id,
        kind,
        categorySlug,
        subcategorySlug,
        title,
        description,
        status: rowStatus
      });
      setOpenStatusMenuRowId(null);
    };

    const setStatus = (nextStatus: CategoryStatus) => {
      setEditingRow((prev) => {
        if (!prev || prev.id !== id) return prev;
        const next = { ...prev, status: nextStatus };
        const nextStatuses = { ...statusByRow, [id]: nextStatus };
        stageStatusChange(nextStatuses);
        return next;
      });
      setOpenStatusMenuRowId(null);
    };

    const isOpening = parentIsAnimating && openingRowIds.length > 0;
    const isClosing = parentIsAnimating && closingRowIds.length > 0;

    const toggleChecked = () => {
      setSelectedRows((prev) => {
        const descendants = getDescendantIds(id);
        const nextSet = new Set(prev);

        if (nextSet.has(id)) {
          nextSet.delete(id);
          descendants.forEach((descendantId) => nextSet.delete(descendantId));
        } else {
          nextSet.add(id);
          descendants.forEach((descendantId) => nextSet.add(descendantId));
        }

        return Array.from(nextSet);
      });
    };

    const buttonLeft = level * treeIndent;
    const buttonCenterX = buttonLeft + treeButtonRadius;
    const parentColumnX = level > 0 ? (level - 1) * treeIndent + treeButtonRadius : null;
    const checkboxLeftFromTreeStart = getCheckboxLeftFromTreeStart(kind, buttonLeft, parentColumnX);

    const gutterWidth =
      level === 0
        ? hasChildren
          ? treeButtonDiameter
          : 0
        : hasChildren
          ? buttonLeft + treeButtonDiameter
          : (parentColumnX ?? 0) + leafConnectorWidth;

    return (
      <SortableTreeRow key={id} id={id} disabled={kind === 'root'}>
        {({ dragHandleProps, setNodeRef, style, isDragging }) => (
      <tr
        ref={setNodeRef}
        style={style}
        className={`${isSelected ? adminTableRowToneClasses.selected : rowDepthTone} transition-[background-color,opacity,transform] duration-150 ${adminTableRowToneClasses.hover} ${isClosing ? 'opacity-80 translate-y-[-1px]' : 'translate-y-0'} ${isOpening ? 'opacity-100' : ''} ${isDragging ? 'opacity-70' : ''} ${kind !== 'root' ? 'cursor-grab active:cursor-grabbing select-none' : ''}`}
        {...dragHandleProps}
      >
        <td className="relative overflow-visible border-b border-slate-200 px-2 py-2 text-center align-middle">
          <div
            className="absolute top-1/2 z-20"
            style={
              level === 0
                ? {
                    left: '50%',
                    transform: 'translate(-50%, -50%)'
                  }
                : {
                    left: `calc(100% + ${checkboxLeftFromTreeStart}px)`,
                    transform: 'translateY(-50%)'
                  }
            }
          >
            <input
              type="checkbox"
              checked={isChecked}
              onChange={toggleChecked}
              aria-label={`Izberi ${title}`}
            />
          </div>
        </td>

        <td className="border-b border-slate-200 px-3 py-0 align-middle">
          <div className="relative flex h-12 items-center gap-2 overflow-visible px-1">
            <div
              className="relative shrink-0 overflow-visible"
              style={{
                width: `${gutterWidth}px`,
                height: `${treeRowHeight}px`
              }}
            >
              {ancestorContinuationColumns.map((continuesBelow, ancestorIndex) => {
                const ancestorX = ancestorIndex * treeIndent + treeButtonRadius;

                return (
                  <span
                    key={`ancestor-${ancestorIndex}`}
                    className="absolute z-0 w-px bg-slate-300/90"
                    style={{
                      left: `${ancestorX}px`,
                      top: `-${treeConnectorBleed}px`,
                      height: continuesBelow
                        ? `${treeRowHeight + treeConnectorBleed * 2}px`
                        : `${treeHalfRowHeight + treeConnectorBleed}px`
                    }}
                  />
                );
              })}

              {hasChildren && isExpanded ? (
                <span
                  className="absolute z-0 w-px bg-slate-300/90"
                  style={{
                    left: `${buttonCenterX}px`,
                    top: `${treeHalfRowHeight + treeButtonRadius}px`,
                    height: `${treeHalfRowHeight - treeButtonRadius + treeConnectorBleed + 1}px`
                  }}
                />
              ) : null}

              {level > 0 && parentColumnX !== null ? (
                <>
                  <span
                    className="absolute z-0 w-px bg-slate-300/90"
                    style={{
                      left: `${parentColumnX}px`,
                      top: `-${treeConnectorBleed}px`,
                      height: `${treeHalfRowHeight + treeConnectorBleed}px`
                    }}
                  />

                  {continueCurrentColumnBelow ? (
                    <span
                      className="absolute z-0 w-px bg-slate-300/90"
                      style={{
                        left: `${parentColumnX}px`,
                        top: `${treeHalfRowHeight}px`,
                        height: `${treeHalfRowHeight + treeConnectorBleed + 1}px`
                      }}
                    />
                  ) : null}

                  <span
                    className="absolute z-0 h-px bg-slate-300/90"
                    style={{
                      left: `${parentColumnX}px`,
                      top: `${treeHalfRowHeight}px`,
                      width: `${hasChildren ? buttonLeft - parentColumnX : leafConnectorWidth}px`
                    }}
                  />
                </>
              ) : null}

              {hasChildren ? (
                <div
                  className="absolute inset-y-0 z-10 flex items-center justify-center"
                  style={{
                    left: `${buttonLeft}px`,
                    width: `${treeButtonDiameter}px`
                  }}
                >
                  <IconButton
                    type="button"
                    tone="neutral"
                    shape="rounded"
                    aria-label="Razširi/skrij"
                    onPointerDown={(event) => event.stopPropagation()}
                    onClick={() => toggleExpanded(id)}
                  >
                    {isExpanded ? <ChevronUpIcon /> : <ChevronDownIcon />}
                  </IconButton>
                </div>
              ) : null}
            </div>

            <div className="min-w-0 flex-1">
              {isRowEditing ? (
                <Input
                  value={editingRow.title}
                  onChange={(event: ChangeEvent<HTMLInputElement>) =>
                    setEditingRow((prev) => (prev ? { ...prev, title: event.target.value } : prev))
                  }
                  data-inline-edit-field="true"
                  onBlur={handleInlineBlur}
                  className="h-8 min-w-[10ch] max-w-[34ch] truncate whitespace-nowrap px-2 text-xs font-semibold text-slate-500"
                  style={{ width: `${Math.min(34, Math.max(10, editingRow.title.length + 2))}ch` }}
                  autoFocus
                />
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    if (kind === 'root') setSelected({ kind: 'root' });
                    if (kind === 'category' && categorySlug) setSelected({ kind: 'category', categorySlug });
                    if (kind === 'subcategory' && categorySlug && subcategorySlug) {
                      setSelected({ kind: 'subcategory', categorySlug, subcategorySlug });
                    }
                  }}
                  onPointerDown={(event) => event.stopPropagation()}
                  className="block w-full truncate whitespace-nowrap text-left text-xs font-semibold text-slate-500"
                  title={title}
                >
                  {title}
                </button>
              )}
            </div>
          </div>
        </td>

        <td className="border-b border-slate-200 px-3 py-2 text-xs font-normal text-slate-500">
          {isRowEditing ? (
            <Input
              value={editingRow.description}
              onChange={(event: ChangeEvent<HTMLInputElement>) =>
                setEditingRow((prev) => (prev ? { ...prev, description: event.target.value } : prev))
              }
              data-inline-edit-field="true"
              onBlur={handleInlineBlur}
              className="h-8 min-w-[18ch] max-w-[64ch] truncate whitespace-nowrap px-2 text-xs font-normal text-slate-500"
              style={{ width: `${Math.min(64, Math.max(18, editingRow.description.length + 2))}ch` }}
            />
          ) : (
            <div className="truncate whitespace-nowrap" title={description || '—'}>
              {description || '—'}
            </div>
          )}
        </td>

        <td className="border-b border-slate-200 px-3 py-2 text-center text-sm text-slate-600">{childrenCount}</td>
        <td className="border-b border-slate-200 px-3 py-2 text-center text-sm text-slate-600">{productCount}</td>

        <td className="border-b border-slate-200 px-3 py-2 text-center text-sm">
          {isRowEditing && kind !== 'root' ? (
            <div
              className="relative inline-flex"
              ref={(node) => {
                statusMenuRefs.current[id] = node;
              }}
            >
              <button
                type="button"
                onClick={(event) => {
                  setOpenStatusMenuRowId((prev) => {
                    const nextOpen = prev === id ? null : id;
                    if (nextOpen) {
                      const triggerRect = (event.currentTarget as HTMLButtonElement).getBoundingClientRect();
                      const viewportHeight = window.innerHeight;
                      const estimatedMenuHeight = 112;
                      const spaceBelow = viewportHeight - triggerRect.bottom;
                      setStatusMenuPlacement((placements) => ({ ...placements, [id]: spaceBelow >= estimatedMenuHeight ? 'bottom' : 'top' }));
                    }
                    return nextOpen;
                  });
                }}
                className="rounded-full"
                aria-haspopup="menu"
                aria-expanded={openStatusMenuRowId === id}
              >
                <Chip
                  variant={editingRow?.status === 'active' ? 'success' : 'neutral'}
                  className={`min-w-0 px-2.5 text-xs ${
                    editingRow?.status === 'active'
                      ? buttonTokenClasses.activeSuccess
                      : buttonTokenClasses.inactiveNeutral
                  }`}
                >
                  {editingRow?.status === 'active' ? 'Aktivna' : 'Neaktivna'}
                </Chip>
              </button>

              {openStatusMenuRowId === id ? (
                <MenuPanel className={`absolute left-1/2 z-20 w-36 -translate-x-1/2 ${statusMenuPlacement[id] === 'top' ? 'bottom-8' : 'top-8'}`}>
                  <MenuItem onClick={() => setStatus('active')} disabled={editingRow?.status === 'active'}>
                    Aktivna
                  </MenuItem>
                  <MenuItem onClick={() => setStatus('inactive')} disabled={editingRow?.status === 'inactive'}>
                    Neaktivna
                  </MenuItem>
                </MenuPanel>
              ) : null}
            </div>
          ) : (
            <Chip
              variant={rowStatus === 'active' ? 'success' : 'neutral'}
              className={`min-w-0 px-2.5 text-xs ${
                rowStatus === 'active'
                  ? buttonTokenClasses.activeSuccess
                  : buttonTokenClasses.inactiveNeutral
              }`}
            >
              {statusLabel}
            </Chip>
          )}
        </td>

        <td className="border-b border-slate-200 px-3 py-2 text-center">
          <RowActions>
            <IconButton type="button" tone="neutral" onPointerDown={(event) => event.stopPropagation()} onClick={toggleInlineEdit} aria-label="Uredi" title="Uredi">
              <svg viewBox="0 0 20 20" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                <path d="M4 14.5l.5-3L13.5 2.5l3 3L7.5 14.5z" />
                <path d="M11.5 4.5l3 3" />
              </svg>
            </IconButton>


            <IconButton
              type="button"
              tone="neutral"
              aria-label="Dodaj podkategorijo"
              title="Dodaj podkategorijo"
              onPointerDown={(event) => event.stopPropagation()}
              onClick={() => {
                if (kind === 'root') openCreateDialog({ kind: 'category' });
                if (kind === 'category' && categorySlug) openCreateDialog({ kind: 'subcategory', categorySlug });
                if (kind === 'subcategory' && categorySlug && subcategorySlug) {
                  openCreateDialog({ kind: 'subcategory', categorySlug });
                }
              }}
            >
              <PlusIcon />
            </IconButton>

            <Button
              type="button"
              variant="close-x"
              aria-label="Izbriši"
              title="Izbriši"
              onPointerDown={(event) => event.stopPropagation()}
              onClick={() => {
                if (kind === 'root') {
                  stageTableCatalog({ categories: [] });
                  setSelected({ kind: 'root' });
                  return;
                }
                if (kind === 'category' && categorySlug) {
                  stageTableCatalog({ categories: catalog.categories.filter((entry) => entry.slug !== categorySlug) });
                  setSelected({ kind: 'root' });
                  return;
                }
                if (kind === 'subcategory' && categorySlug && subcategorySlug) {
                  stageTableCatalog({
                    categories: catalog.categories.map((entry) =>
                      entry.slug === categorySlug
                        ? { ...entry, subcategories: entry.subcategories.filter((sub) => sub.slug !== subcategorySlug) }
                        : entry
                    )
                  });
                  setSelected({ kind: 'category', categorySlug });
                }
              }}
            >
              ×
            </Button>
          </RowActions>
        </td>
      </tr>
        )}
      </SortableTreeRow>
    );
  };

  const treeRows: ReactNode[] = (() => {
    const rows: ReactNode[] = [];

    rows.push(
      renderTreeRow({
        id: rootId,
        title: 'Vse kategorije',
        level: 0,
        kind: 'root',
        description: 'Pogled vseh kategorij',
        childrenCount: catalog.categories.length,
        productCount: 0,
        ancestorContinuationColumns: [false],
        continueCurrentColumnBelow: filteredCategories.length > 0,
        parentIsAnimating: false
      })
    );

    filteredCategories.forEach((category, categoryIndex) => {
        const categoryNodeId = catId(category.slug);
        const hasVisibleChildren =
          (isSearchActive || (expanded[categoryNodeId] ?? false) || closingRowIds.includes(categoryNodeId)) &&
          category.subcategories.length > 0;
        const hasNextCategory = categoryIndex < filteredCategories.length - 1;

        rows.push(
          renderTreeRow({
            id: categoryNodeId,
            title: category.title,
            level: 1,
            kind: 'category',
            categorySlug: category.slug,
            description: category.summary,
            childrenCount: category.subcategories.length,
            productCount: (category.items ?? []).length,
            ancestorContinuationColumns: [false],
            continueCurrentColumnBelow: hasVisibleChildren || hasNextCategory,
            parentIsAnimating: false
          })
        );

        if (isSearchActive || expanded[categoryNodeId] || closingRowIds.includes(categoryNodeId)) {
          category.subcategories.forEach((subcategory, subcategoryIndex) => {
            const hasNextSubcategory = subcategoryIndex < category.subcategories.length - 1;

            rows.push(
              renderTreeRow({
                id: subId(category.slug, subcategory.slug),
                title: subcategory.title,
                level: 2,
                kind: 'subcategory',
                categorySlug: category.slug,
                subcategorySlug: subcategory.slug,
                description: subcategory.description,
                childrenCount: 0,
                productCount: subcategory.items.length,
                ancestorContinuationColumns: [false, true, hasNextCategory],
                continueCurrentColumnBelow: hasNextSubcategory,
                parentIsAnimating: openingRowIds.includes(categoryNodeId) || closingRowIds.includes(categoryNodeId)
              })
            );
          });
        }
      });

    return rows;
  })();


  if (loading) {
    return (
      <div className="space-y-4">
        <header>
          <h1 className="text-2xl font-semibold text-slate-900">Kategorije</h1>
        </header>
        <div className="rounded-2xl border border-slate-200 bg-white p-6">
          <div className="inline-flex items-center gap-2 text-sm text-slate-600"><Spinner size="sm" /> Nalaganje kategorij ...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl font-semibold text-slate-900">Kategorije</h1>
        <p className="mt-1 text-sm text-slate-600">
          Top: povezano drevo levo → desno. Bottom: vsebina izbrane kategorije v storefront admin pogledu.
        </p>
      </header>

      <Tabs
        value={activeView}
        onValueChange={(next) => {
          const nextView = next as CategoriesView;
          setActiveView(nextView);
          guardedNavigate(nextView === 'table' ? '/admin/kategorije' : '/admin/kategorije/miller-view');
        }}
      >
        <TabsList className="h-9 gap-1 rounded-xl border border-slate-200 bg-slate-50 p-1">
          <TabsTrigger
            value="table"
            className="h-7 rounded-lg px-3 text-xs font-semibold data-[active=true]:border data-[active=true]:border-[#3e67d6]/40 data-[active=true]:bg-white data-[active=true]:text-[#2749a5]"
          >
            Seznam
          </TabsTrigger>
          <TabsTrigger
            value="miller"
            className="h-7 rounded-lg px-3 text-xs font-semibold data-[active=true]:border data-[active=true]:border-[#3e67d6]/40 data-[active=true]:bg-white data-[active=true]:text-[#2749a5]"
          >
            Millerjev pogled
          </TabsTrigger>
        </TabsList>
      </Tabs>

      <ConfirmDialog
        open={isBulkDeleteDialogOpen}
        title="Izbris kategorij"
        description={`Ali ste prepričani, da želite izbrisati ${selectedRows.length} izbranih vrstic?`}
        confirmLabel="Izbriši"
        cancelLabel="Prekliči"
        isDanger
        onCancel={() => setIsBulkDeleteDialogOpen(false)}
        onConfirm={() => {
          void confirmBulkDelete();
        }}
        confirmDisabled={isBulkDeleting}
      />

      <ConfirmDialog
        open={warningDialog !== null}
        title={warningDialog?.title ?? 'Opozorilo'}
        description={warningDialog?.description}
        confirmLabel="V redu"
        onCancel={() => setWarningDialog(null)}
        onConfirm={() => setWarningDialog(null)}
      />

      <ConfirmDialog
        open={isUnsavedLeaveDialogOpen}
        title="Neshranjene spremembe"
        description="Imate neshranjene spremembe. Če zapustite stran, bodo lokalne spremembe izgubljene."
        confirmLabel="Zapusti stran"
        cancelLabel="Ostani"
        isDanger
        onCancel={() => {
          setIsUnsavedLeaveDialogOpen(false);
          setPendingNavigation(null);
        }}
        onConfirm={() => {
          const nextPath = pendingNavigation;
          setIsUnsavedLeaveDialogOpen(false);
          setPendingNavigation(null);
          if (nextPath) router.push(nextPath);
        }}
      />

      <ConfirmDialog
        open={imageDeleteTarget !== null}
        title="Odstrani sliko"
        description="Ali ste prepričani, da želite odstraniti sliko?"
        confirmLabel="Odstrani"
        cancelLabel="Prekliči"
        isDanger
        onCancel={() => setImageDeleteTarget(null)}
        onConfirm={confirmDeleteImage}
      />

      <ConfirmDialog
        open={createTarget !== null}
        title={createTarget?.kind === 'category' ? 'Nova kategorija' : 'Nova podkategorija'}
        description="Vnesite ime kategorije."
        confirmLabel="Dodaj"
        cancelLabel="Prekliči"
        onCancel={() => {
          setCreateTarget(null);
          setCreateName('');
        }}
        onConfirm={confirmCreate}
        confirmDisabled={createName.trim().length === 0}
      >
        <div className="mt-3">
          <Input
            value={createName}
            onChange={(event: ChangeEvent<HTMLInputElement>) => setCreateName(event.target.value)}
            placeholder="Ime kategorije"
            className="h-9 w-full rounded-xl px-3 text-sm"
            autoFocus
          />
        </div>
      </ConfirmDialog>

      <div className={activeView === 'table' ? 'space-y-5' : 'hidden'}>
      <section>
        <AdminTableLayout
          className="border"
          contentClassName="overflow-x-auto"
          headerLeft={
            <>
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Išči po kategoriji ali opisu ..."
                className={`${ADMIN_CONTROL_HEIGHT} min-w-[260px] flex-1 rounded-xl border border-slate-300 ${ADMIN_CONTROL_PADDING_X} text-xs text-slate-700 outline-none focus:border-[#3e67d6] focus:ring-0 focus:ring-[#3e67d6]`}
              />
            </>
          }
          headerRight={
            <>
              <button
                type="button"
                onClick={handleBulkDelete}
                disabled={selectedRows.length === 0 || isBulkDeleting}
                className={bulkDeleteButtonClass}
              >
                {isBulkDeleting ? (
                  <span className="inline-flex items-center gap-1.5">
                    <Spinner size="sm" className="text-[var(--danger-600)]" />
                    Brisanje...
                  </span>
                ) : (
                  'Izbriši'
                )}
              </button>

              <Button
                variant="primary"
                size="toolbar"
                onClick={() => {
                  const summary = summarizeCatalogChanges(persistedTableRef.current, catalog, persistedStatusRef.current, statusByRow);
                  setTableSaveSummary(summary);
                  setIsTableSaveDialogOpen(true);
                }}
                disabled={!tableDirty || saving}
              >
                Shrani spremembe
              </Button>

              <div className="relative" ref={historyMenuRef}>
                <IconButton type="button" tone="neutral" aria-label="Zgodovina" onClick={() => setIsHistoryMenuOpen((prev) => !prev)}>
                  ⋮
                </IconButton>
                {isHistoryMenuOpen ? (
                  <MenuPanel className="absolute right-0 top-9 z-20 w-40">
                    <MenuItem onClick={() => { undoStagedChanges(); setIsHistoryMenuOpen(false); }}>Razveljavi</MenuItem>
                    <MenuItem onClick={() => { restoreCommittedHistory(); setIsHistoryMenuOpen(false); }}>Obnovi</MenuItem>
                  </MenuPanel>
                ) : null}
              </div>
            </>
          }
        >
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onTreeDragEnd}>
            <SortableContext items={visibleRowIds} strategy={verticalListSortingStrategy}>
          <table className="min-w-full table-fixed border-separate border-spacing-0 border-x border-b border-slate-200">
            <colgroup>
              <col className="w-14" />
              <col className="w-[420px]" />
              <col className="w-[320px]" />
              <col className="w-32" />
              <col className="w-28" />
              <col className="w-32" />
              <col className="w-40" />
            </colgroup>

            <thead className="bg-slate-50/90">
              <tr>
                <th className="border-b border-slate-200 px-2 py-2 text-center text-xs font-semibold text-slate-500">
                  <input
                    ref={selectAllRef}
                    type="checkbox"
                    checked={allRowsSelected}
                    onChange={toggleSelectAll}
                    aria-label="Izberi vse"
                  />
                </th>
                <th className="border-b border-slate-200 px-3 py-2 text-left text-xs font-semibold text-slate-500">
                  Kategorija
                </th>
                <th className="border-b border-slate-200 px-3 py-2 text-left text-xs font-semibold text-slate-500">
                  Opis
                </th>
                <th className="border-b border-slate-200 px-3 py-2 text-center text-xs font-semibold text-slate-500">
                  Podkategorije
                </th>
                <th className="border-b border-slate-200 px-3 py-2 text-center text-xs font-semibold text-slate-500">
                  Izdelki
                </th>
                <th className="h-11 border-b border-slate-200 px-3 py-0 text-center text-xs font-semibold text-slate-500 align-middle">
                  <div className="relative flex h-8 items-center justify-center" ref={statusHeaderMenuRef}>
                    <button
                      type="button"
                      onClick={() => {
                        if (selectedRows.length === 0) return;
                        setIsStatusHeaderMenuOpen((previousOpen) => !previousOpen);
                      }}
                      className={`inline-flex h-7 items-center rounded-full border px-2 text-xs font-semibold ${
                        selectedRows.length > 0
                          ? 'border-slate-300 bg-white text-slate-700 hover:bg-[color:var(--hover-neutral)]'
                          : 'border-transparent bg-transparent text-slate-500 cursor-default'
                      }`}
                      aria-haspopup="menu"
                      aria-expanded={selectedRows.length > 0 ? isStatusHeaderMenuOpen : false}
                      disabled={selectedRows.length === 0}
                    >
                      {selectedRows.length > 0 ? `Status ▾ (${selectedRows.length})` : 'Status'}
                    </button>

                    {selectedRows.length > 0 && isStatusHeaderMenuOpen ? (
                      <MenuPanel className="absolute left-1/2 top-8 z-20 w-36 -translate-x-1/2">
                        <MenuItem
                          onClick={() => {
                            const nextStatuses = {
                              ...statusByRow,
                              ...Object.fromEntries(selectedRows.map((rowId) => [rowId, 'active' as CategoryStatus]))
                            };
                            stageStatusChange(nextStatuses);
                            setIsStatusHeaderMenuOpen(false);
                          }}
                        >
                          Aktivna
                        </MenuItem>
                        <MenuItem
                          onClick={() => {
                            const nextStatuses = {
                              ...statusByRow,
                              ...Object.fromEntries(selectedRows.map((rowId) => [rowId, 'inactive' as CategoryStatus]))
                            };
                            stageStatusChange(nextStatuses);
                            setIsStatusHeaderMenuOpen(false);
                          }}
                        >
                          Neaktivna
                        </MenuItem>
                      </MenuPanel>
                    ) : null}
                  </div>
                </th>
                <th className="border-b border-slate-200 px-3 py-2 text-center text-xs font-semibold text-slate-500">
                  Uredi
                </th>
              </tr>
            </thead>

            <tbody>{treeRows}</tbody>
          </table>
            </SortableContext>
          </DndContext>
        </AdminTableLayout>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        {tableError ? <p className="mb-3 rounded-lg border border-[var(--danger-300)] bg-[var(--danger-100)] px-3 py-2 text-xs text-[var(--danger-700)]">{tableError}</p> : null}
        <div className="mb-3 flex items-center justify-between gap-3">
          <p className="text-sm font-semibold text-slate-700">Predogled</p>
          <div className="flex items-center gap-3">
            <label className="mr-2 flex items-center gap-2 text-[11px] text-slate-500">
              Elementov na vrstico
              <input
                type="range"
                min={1}
                max={12}
                value={lowerViewCount}
                onChange={(event) => setLowerViewCount(Number(event.target.value || 4))}
                className="h-1.5 w-28 accent-[#3e67d6]"
              />
              <span className="w-4 text-right text-slate-600">{lowerViewCount}</span>
            </label>
            <Button
              variant="primary"
              size="toolbar"
              onClick={() => {
                const summary = summarizeCatalogChanges(persistedTableRef.current, catalog, persistedStatusRef.current, statusByRow);
                setTableSaveSummary(summary);
                setIsTableSaveDialogOpen(true);
              }}
              disabled={!tableDirty || saving}
            >
              Shrani spremembe
            </Button>
          </div>
        </div>

        {selectedContext?.kind === 'root' ||
        (selectedContext?.kind === 'category' && visibleContent.length > 0) ? (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onBottomReorder}>
            <SortableContext items={visibleContent.map((item) => item.id)} strategy={rectSortingStrategy}>
              <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${Math.max(1, lowerViewCount)}, minmax(0, 1fr))` }}>
                {visibleContent.map((item) => (
                  <SortableItem key={item.id} id={item.id}>
                    {(dragProps) => (
                      <article {...dragProps} className="h-[300px] rounded-xl border border-slate-200 bg-white p-3 shadow-sm cursor-grab active:cursor-grabbing">
                        <button
                          type="button"
                          className="relative h-36 w-full overflow-hidden rounded-lg border border-slate-200 bg-slate-50 text-left"
                          onClick={() => uploadRefs.current[item.id]?.click()}
                          onPointerDown={(event) => event.stopPropagation()}
                        >
                          {item.image ? (
                            <Image src={item.image} alt={item.title} fill className="object-cover" />
                          ) : (
                            <div className="flex h-full items-center justify-center text-xs text-slate-400">
                              Brez slike
                            </div>
                          )}
                          <div className="absolute inset-0 flex items-center justify-center gap-2">
                            <button
                              type="button"
                              className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-white/80 text-slate-500 backdrop-blur-sm hover:bg-white"
                              onPointerDown={(event) => event.stopPropagation()}
                              onClick={(event) => {
                                event.stopPropagation();
                                uploadRefs.current[item.id]?.click();
                              }}
                              aria-label="Dodaj sliko"
                            >
                              <svg viewBox="0 0 20 20" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                                <rect x="3.5" y="5" width="13" height="10" rx="2" />
                                <path d="M10 8v4M8 10h4" />
                              </svg>
                            </button>
                            {item.image ? (
                              <button
                                type="button"
                                className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-white/80 text-slate-500 backdrop-blur-sm hover:bg-white"
                                onPointerDown={(event) => event.stopPropagation()}
                                onClick={(event) => {
                                  event.stopPropagation();
                                  setImageDeleteTarget({
                                    kind: item.kind,
                                    categorySlug:
                                      item.kind === 'category'
                                        ? item.id
                                        : selectedContext?.kind === 'category'
                                          ? selectedContext.category.slug
                                          : '',
                                    subcategorySlug: item.kind === 'subcategory' ? item.id : undefined
                                  });
                                }}
                                aria-label="Odstrani sliko"
                              >
                                ✕
                              </button>
                            ) : null}
                          </div>
                        </button>

                        <div className="mt-3 space-y-1">
                          <p className="text-sm font-semibold text-slate-700">{item.title}</p>
                          <p className="text-xs text-slate-600">{item.description || '—'}</p>
                        </div>

                        <div className="mt-2 flex items-center gap-2" onPointerDown={(event) => event.stopPropagation()}>
                          <input
                            ref={(element) => {
                              uploadRefs.current[item.id] = element;
                            }}
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(event) =>
                              void onImageUpload(
                                event.target.files?.[0] ?? null,
                                item,
                                selectedContext?.kind === 'category'
                                  ? selectedContext.category.slug
                                  : undefined
                              )
                            }
                          />

                        </div>
                      </article>
                    )}
                  </SortableItem>
                ))}
              </div>
            </SortableContext>
          </DndContext>
        ) : null}

        {selectedContext?.kind === 'category' && selectedContext.category.subcategories.length === 0 ? (
          <LeafProductsView
            title={`${selectedContext.category.title} — izdelki`}
            category={selectedContext.category}
            items={sortCatalogItems(selectedContext.category.items ?? [])}
            onDragEnd={onLeafProductsDragEnd}
          />
        ) : null}

        {selectedContext?.kind === 'subcategory' ? (
          <LeafProductsView
            title={`${selectedContext.category.title} / ${selectedContext.subcategory.title}`}
            category={selectedContext.category}
            subcategory={selectedContext.subcategory}
            items={sortCatalogItems(selectedContext.subcategory.items)}
            onDragEnd={onLeafProductsDragEnd}
          />
        ) : null}

      </section>
      </div>


      <ConfirmDialog
        open={isTableSaveDialogOpen}
        title="Shrani spremembe"
        description="Pregled pripravljenih sprememb:"
        confirmLabel="Shrani"
        cancelLabel="Prekliči"
        onCancel={() => setIsTableSaveDialogOpen(false)}
        onConfirm={() => {
          setIsTableSaveDialogOpen(false);
          void saveTableChanges();
        }}
      >
        <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-slate-600">
          {(tableSaveSummary.length > 0 ? tableSaveSummary : ['Ni sprememb za shranjevanje.']).map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      </ConfirmDialog>

      <ConfirmDialog
        open={millerDeleteTarget !== null}
        title="Izbriši izbrane vnose"
        description="Ali ste prepričani, da želite izbrisati izbrane vnose v tem stolpcu?"
        confirmLabel="Izbriši"
        cancelLabel="Prekliči"
        isDanger
        onCancel={() => setMillerDeleteTarget(null)}
        onConfirm={confirmMillerDelete}
      />

      <ConfirmDialog
        open={isMillerSaveDialogOpen}
        title="Shrani Miller spremembe"
        description="Pregled pripravljenih sprememb:"
        confirmLabel="Shrani"
        cancelLabel="Prekliči"
        onCancel={() => setIsMillerSaveDialogOpen(false)}
        onConfirm={() => {
          setIsMillerSaveDialogOpen(false);
          void saveMillerChanges();
        }}
      >
        <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-slate-600">
          {(millerSaveSummary.length > 0 ? millerSaveSummary : ['Ni sprememb za shranjevanje.']).map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      </ConfirmDialog>


      <section className={activeView === 'miller' ? 'rounded-2xl border border-slate-200 bg-white p-3 shadow-sm' : 'hidden'}>
        <div className="mb-3 flex items-center justify-between">
          <div className="text-xs text-slate-600">{millerDirty ? 'Neshranjene spremembe' : ''}</div>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="primary"
              size="toolbar"
              onClick={() => { const summary = summarizeCatalogChanges(persistedMillerRef.current, millerCatalog, persistedStatusRef.current, statusByRow); setMillerSaveSummary(summary); setIsMillerSaveDialogOpen(true); }}
              disabled={!millerDirty || saving}
            >
              Shrani spremembe
            </Button>
            <div className="relative" ref={historyMenuRef}>
              <IconButton type="button" tone="neutral" aria-label="Zgodovina" onClick={() => setIsHistoryMenuOpen((prev) => !prev)}>⋮</IconButton>
              {isHistoryMenuOpen ? (
                <MenuPanel className="absolute right-0 top-9 z-20 w-40">
                  <MenuItem onClick={() => { undoStagedChanges(); setIsHistoryMenuOpen(false); }}>Razveljavi</MenuItem>
                  <MenuItem onClick={() => { restoreCommittedHistory(); setIsHistoryMenuOpen(false); }}>Obnovi</MenuItem>
                </MenuPanel>
              ) : null}
            </div>
          </div>
        </div>

        {millerError ? <p className="mb-3 rounded-lg border border-[var(--danger-300)] bg-[var(--danger-100)] px-3 py-2 text-xs text-[var(--danger-700)]">{millerError}</p> : null}

        <Selecto
          container={millerViewportRef.current ?? undefined}
          selectableTargets={[".miller-select-item"]}
          selectByClick={false}
          selectFromInside={false}
          hitRate={0}
          onSelectEnd={(event: { selected: Element[] }) => {
            const ids = event.selected
              .map((node: Element) => (node as HTMLElement).dataset.millerId)
              .filter((id: string | undefined): id is string => Boolean(id));
            if (ids.length > 0) setMillerSelection(ids);
          }}
        />

        <div
          ref={millerViewportRef}
          className="grid gap-3"
          style={{ gridTemplateColumns: `repeat(${Math.max(1, millerColumns.length)}, minmax(0, 1fr))` }}
        >
          {millerColumns.map((column) => (
            <div key={column.key} className="min-w-0 overflow-hidden rounded-xl border border-slate-200 bg-slate-50/40">
              <div className="flex items-center justify-between border-b border-slate-200 bg-white px-2.5 py-2">
                <h3 className="text-xs font-semibold text-slate-700">{column.title}</h3>
                <div className="flex items-center gap-1">
                  <IconButton type="button" tone="neutral" aria-label="Dodaj" onClick={() => addMillerNode(column.kind)}>
                    <PlusIcon />
                  </IconButton>
                  <IconButton
                    type="button"
                    tone="danger"
                    aria-label="Izbriši"
                    onClick={() => requestDeleteMillerSelection(column.kind)}
                    disabled={!millerSelection.some((id) => column.ids.includes(id))}
                  >
                    ✕
                  </IconButton>
                </div>
              </div>

              <div
                className={`max-h-[520px] space-y-1 overflow-auto p-1.5 ${millerDropTarget === (column.kind === 'categories' ? rootId : column.rows[0]?.onDropTarget) ? 'ring-2 ring-[#3e67d6]/40' : ''}`}
                onDragOver={(event) => {
                  event.preventDefault();
                  setMillerDropTarget(column.kind === 'categories' ? rootId : column.rows[0]?.onDropTarget ?? null);
                }}
                onDrop={(event) => {
                  event.preventDefault();
                  const dropTarget = column.kind === 'categories' ? rootId : column.rows[0]?.onDropTarget ?? rootId;
                  applyMillerMove(dropTarget);
                  setMillerDropTarget(null);
                }}
              >
                {column.rows.length === 0 ? <p className="px-2 py-3 text-xs text-slate-500">Ni zapisov.</p> : column.rows.map((row) => (
                  millerRename?.id === row.id && row.kind !== 'item' ? (
                    <input
                      key={row.id}
                      value={millerRename.value}
                      onChange={(event) => setMillerRename({ id: row.id, value: event.target.value })}
                      onBlur={applyMillerRename}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') applyMillerRename();
                        if (event.key === 'Escape') setMillerRename(null);
                      }}
                      className="block w-full rounded-md border border-[#3e67d6]/40 bg-white px-2 py-1 text-xs font-medium text-slate-700 outline-none"
                      autoFocus
                    />
                  ) : (
                    <button
                      key={row.id}
                      type="button"
                      data-miller-id={row.id}
                      className={`miller-select-item block w-full rounded-md border px-2 py-1 text-left text-xs font-medium transition ${millerSelection.includes(row.id) || row.tone === 'focused' ? 'border-[#3e67d6]/50 bg-[#f0f4ff] text-[#1f3f93]' : 'border-transparent bg-white text-slate-700 hover:border-slate-200 hover:bg-slate-100'}`}
                      onClick={row.onClick}
                      onDoubleClick={() => {
                        if (row.kind === 'item') return;
                        setMillerRename({ id: row.id, value: row.label });
                      }}
                      onContextMenu={(event) => {
                        if (row.kind === 'item') return;
                        event.preventDefault();
                        setMillerRename({ id: row.id, value: row.label });
                      }}
                      draggable
                      onDragStart={(event) => { event.dataTransfer.setData('text/plain', row.id); row.onDragStart(); }}
                      onDragEnd={() => setMillerDropTarget(null)}
                      onDragOver={(event) => {
                        event.preventDefault();
                        setMillerDropTarget(row.id);
                      }}
                      onDrop={(event) => {
                        event.preventDefault();
                        applyMillerMove(row.id);
                      }}
                    >
                      {row.label}
                    </button>
                  )
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function LeafProductsView({
  title,
  category,
  subcategory,
  items,
  onDragEnd
}: {
  title: string;
  category: CatalogCategory;
  subcategory?: CatalogSubcategory;
  items: CatalogItem[];
  onDragEnd: (event: DragEndEvent) => void;
}) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  return (
    <div>
      <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
      <p className="mt-1 text-sm text-slate-600">Storefront-like pogled izdelkov iz izbrane kategorije.</p>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={items.map((item) => item.slug)} strategy={rectSortingStrategy}>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {items.map((item) => (
              <SortableItem key={item.slug} id={item.slug}>
                {(dragProps) => {
                  const basePrice = subcategory
                    ? item.price ?? getCatalogItemPrice(category.slug, subcategory.slug, item.slug)
                    : item.price ?? getCatalogCategoryItemPrice(category.slug, item.slug);

                  const finalPrice = getDiscountedPrice(basePrice, item.discountPct);

                  return (
                    <article {...dragProps} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm cursor-grab active:cursor-grabbing">
                      {item.image ? (
                        <div className="relative h-24 overflow-hidden rounded-lg border border-slate-200 bg-slate-50" onPointerDown={(event) => event.stopPropagation()}>
                          <Image src={item.images?.[0] ?? item.image} alt={item.name} fill className="object-contain p-2" />
                        </div>
                      ) : null}

                      <h4 className="mt-2 text-sm font-semibold text-slate-900">{item.name}</h4>
                      <p className="mt-1 text-xs text-slate-600">{item.description}</p>
                      <p className="mt-2 text-sm font-semibold text-slate-900">{formatCatalogPrice(finalPrice)}</p>
                      <p className="mt-1 text-[11px] text-slate-500">
                        SKU:{' '}
                        {subcategory
                          ? getCatalogItemSku(category.slug, subcategory.slug, item.slug)
                          : getCatalogCategoryItemSku(category.slug, item.slug)}
                      </p>
                    </article>
                  );
                }}
              </SortableItem>
            ))}
          </div>
        </SortableContext>
      </DndContext>
    </div>
  );
}
