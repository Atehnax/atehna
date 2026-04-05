'use client';

import dynamic from 'next/dynamic';
import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent, type FocusEvent, type ReactNode, type CSSProperties } from 'react';
import { usePathname, useRouter } from 'next/navigation';
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
  useSortable,
  verticalListSortingStrategy
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { CatalogCategory, CatalogItem, CatalogSubcategory } from '@/commercial/catalog/catalog';
import type {
  AdminCategoriesPayload,
  CatalogData,
  CategoriesView,
  CategoryStatus,
  ContentCard,
  CreateTarget,
  DeleteTarget,
  EditingRowDraft,
  HistorySnapshot,
  ImageDeleteTarget,
  MillerDeleteTarget,
  MillerRenameDraft,
  RecursiveCatalogCategory,
  RecursiveCatalogSubcategory,
  SelectedNode
} from '../common/types';
import {
  CATEGORY_STATUS_STORAGE_KEY,
  areCatalogsEqual,
  areMillerCatalogsEqual,
  areStatusesEqual,
  catId,
  collectExpandableSubcategoryIds,
  collectSubcategoryIds,
  createCatalogNodeId,
  filterSubcategoryTree,
  findSubcategoryByPath,
  insertAtIndex,
  itemId,
  mapSubcategoryTree,
  normalizeCatalogData,
  parseItemNodeId,
  parseSubNodeId,
  pathEquals,
  pruneSelectedSubcategoryTree,
  rootId,
  slugify,
  subId,
  subPathKey,
  summarizeCatalogChanges,
  toSubcategoryPath,
  updateSubcategoryTree,
  removeSubcategoryTree
} from '../common/catalog-helpers';
import { getAdminCategoriesSessionPayload, setAdminCategoriesSessionPayload } from '../common/client-session';
import { sortCatalogItems } from '@/commercial/catalog/catalogUtils';
import { Button } from '@/shared/ui/button';
import { IconButton } from '@/shared/ui/icon-button';
import { Chip } from '@/shared/ui/badge';
import { PencilIcon, PlusIcon, TrashCanIcon } from '@/shared/ui/icons/AdminActionIcons';
import { MenuItem, MenuPanel } from '@/shared/ui/menu';
import { RowActions, RowActionsDropdown } from '@/shared/ui/table';
import {
  adminTableRowToneClasses,
  getAdminCategoryRowToneClass
} from '@/shared/ui/theme/tokens';
import { Input } from '@/shared/ui/input';
import { useToast } from '@/shared/ui/toast';
import EuiTabs from '@/shared/ui/eui-tabs';

const AdminCategoriesPreview = dynamic(
  () => import('./AdminCategoriesPreview').then((module) => module.AdminCategoriesPreview)
);
const AdminCategoriesMiller = dynamic(
  () => import('./AdminCategoriesMiller').then((module) => module.AdminCategoriesMiller)
);
const AdminCategoriesTableView = dynamic(
  () => import('../views/AdminCategoriesTableView').then((module) => module.AdminCategoriesTableView)
);
const LazyConfirmDialog = dynamic(
  () => import('@/shared/ui/confirm-dialog').then((module) => module.ConfirmDialog),
  { ssr: false }
);

type RecursiveNode = RecursiveCatalogSubcategory;
type MillerSearchMatch =
  | { kind: 'category'; id: string; categorySlug: string }
  | { kind: 'subcategory'; id: string; categorySlug: string; subcategoryPath: string[] }
  | { kind: 'item'; id: string; categorySlug: string; subcategoryPath: string[]; itemSlug: string };

type MillerSearchIndex = {
  matches: MillerSearchMatch[];
  categorySlugsWithMatches: Set<string>;
  matchedCategorySlugs: Set<string>;
  matchedSubcategoryPaths: Map<string, Set<string>>;
  ancestorSubcategoryPaths: Map<string, Set<string>>;
  matchedItemIds: Set<string>;
};

type MillerDropLocation = {
  parentId: string;
  index: number;
  columnKey: string;
};
type CategorySortKey = 'category' | 'subcategories' | 'items';
type CategorySortDirection = 'asc' | 'desc';

type TreeNodeRef =
  | { kind: 'category'; category: RecursiveCatalogCategory; categoryIndex: number }
  | { kind: 'subcategory'; category: RecursiveCatalogCategory; node: RecursiveCatalogSubcategory; path: string[] };

type CatalogRowSnapshot = {
  id: string;
  parentId: string | null;
  slug: string;
  title: string;
  summary: string;
  description: string;
  image: string | null;
  removeImage?: boolean;
  adminNotes?: string | null;
  bannerImage?: string | null;
  items: CatalogItem[];
  position: number;
  status: CategoryStatus;
};

type PendingImageUpload = {
  file: File;
  objectUrl: string;
};

const treeIndent = 32;
const treeRowHeight = 48;
const treeHalfRowHeight = treeRowHeight / 2;
const leafConnectorWidth = 22;
const treeButtonDiameter = 28;
const treeExpandButtonSize = 16;
const treeExpandButtonInset = (treeButtonDiameter - treeExpandButtonSize) / 2;
const treeExpandButtonHalf = treeExpandButtonSize / 2;
const treeButtonRadius = treeButtonDiameter / 2;
const treeConnectorBleed = 1;
const expandTransitionMs = 140;
const treeCheckboxSize = 16;
const treeCheckboxHalf = treeCheckboxSize / 2;

const getCheckboxLeftFromTreeStart = (
  kind: 'root' | 'category' | 'subcategory',
  _buttonLeft: number,
  parentColumnX: number | null
) => {
  if (kind === 'root' || kind === 'category') return 0;
  if (parentColumnX !== null) {
    const leftConnectorX = parentColumnX - treeIndent;
    const rightConnectorX = parentColumnX;
    const targetCenterX = (leftConnectorX + rightConnectorX) / 2 + 18;
    return targetCenterX - treeCheckboxHalf;
  }

  return 0;
};

export const InlineStatusToggle = ({
  checked,
  onToggle,
  disabled,
  ariaLabel
}: {
  checked: boolean;
  onToggle: () => void;
  disabled?: boolean;
  ariaLabel: string;
}) => (
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    aria-label={ariaLabel}
    disabled={disabled}
    onPointerDown={(event) => event.stopPropagation()}
    onClick={(event) => {
      event.stopPropagation();
      onToggle();
    }}
    className={`relative inline-flex h-6 w-12 items-center rounded-full border transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3e67d6]/50 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 ${
      checked
        ? 'border-[#243f58] bg-[#3c5167] text-[#d4c08f]'
        : 'border-[#3e556d] bg-[#e8eaee] text-[#5e636b]'
    }`}
  >
    <span
      aria-hidden="true"
      className={`pointer-events-none absolute top-1/2 -translate-y-1/2 transition-all duration-200 ${
        checked ? 'left-1.5 opacity-100 text-[#d4c08f]' : 'right-1.5 opacity-100 text-[#686d75]'
      }`}
    >
      {checked ? (
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M1.5 12s3.75-6.75 10.5-6.75S22.5 12 22.5 12s-3.75 6.75-10.5 6.75S1.5 12 1.5 12Z" />
          <circle cx="12" cy="12" r="3" />
        </svg>
      ) : (
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M1.5 12s3.75-6.75 10.5-6.75S22.5 12 22.5 12s-3.75 6.75-10.5 6.75S1.5 12 1.5 12Z" />
          <circle cx="12" cy="12" r="3" />
          <path d="M3 3 21 21" />
        </svg>
      )}
    </span>
    <span
      aria-hidden="true"
      className={`absolute inset-y-0 z-10 w-5 rounded-full border border-[#1f2a36] bg-[#2f3942] shadow-[inset_0_1px_2px_rgba(255,255,255,0.08),inset_0_-3px_6px_rgba(0,0,0,0.2),0_2px_5px_rgba(15,23,42,0.25)] transition-transform duration-200 ${
        checked ? 'translate-x-7' : 'translate-x-0'
      }`}
    >
      <span className="absolute left-1/2 top-1/2 h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#9aa0a7]" />
    </span>
  </button>
);

function SortableItem({
  id,
  children
}: {
  id: string;
  children: (args: { dragHandleProps: Record<string, unknown>; setNodeRef: (node: HTMLElement | null) => void; style: CSSProperties }) => ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id });

  return children({
    dragHandleProps: { ...attributes, ...listeners },
    setNodeRef,
    style: { transform: CSS.Transform.toString(transform), transition }
  });
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

const getMillerSearchIndex = (categories: RecursiveCatalogCategory[], query: string): MillerSearchIndex => {
  const normalizedQuery = query.trim().toLowerCase();
  const emptyIndex: MillerSearchIndex = {
    matches: [],
    categorySlugsWithMatches: new Set<string>(),
    matchedCategorySlugs: new Set<string>(),
    matchedSubcategoryPaths: new Map<string, Set<string>>(),
    ancestorSubcategoryPaths: new Map<string, Set<string>>(),
    matchedItemIds: new Set<string>()
  };

  if (!normalizedQuery) return emptyIndex;

  const upsertPathSet = (target: Map<string, Set<string>>, categorySlug: string, path: string[]) => {
    if (path.length === 0) return;
    const current = target.get(categorySlug) ?? new Set<string>();
    current.add(subPathKey(path));
    target.set(categorySlug, current);
  };

  const matches: MillerSearchMatch[] = [];

  const visitSubcategory = (category: RecursiveCatalogCategory, nodes: RecursiveNode[], parentPath: string[] = []) => {
    nodes.forEach((subcategory) => {
      const path = [...parentPath, subcategory.slug];
      const subcategoryNodeId = subId(category.slug, path);
      const subcategoryText = [subcategory.title, subcategory.description, subcategory.slug].join(' ').toLowerCase();
      const subcategoryMatches = subcategoryText.includes(normalizedQuery);

      if (subcategoryMatches) {
        matches.push({ kind: 'subcategory', id: subcategoryNodeId, categorySlug: category.slug, subcategoryPath: path });
        emptyIndex.categorySlugsWithMatches.add(category.slug);
        upsertPathSet(emptyIndex.matchedSubcategoryPaths, category.slug, path);
      }

      subcategory.items.forEach((item) => {
        const itemText = [item.name, item.description, item.slug].join(' ').toLowerCase();
        if (!itemText.includes(normalizedQuery)) return;

        const id = itemId(category.slug, item.slug, path);
        matches.push({ kind: 'item', id, categorySlug: category.slug, subcategoryPath: path, itemSlug: item.slug });
        emptyIndex.categorySlugsWithMatches.add(category.slug);
        emptyIndex.matchedItemIds.add(id);
      });

      if (subcategoryMatches || subcategory.items.some((item) => [item.name, item.description, item.slug].join(' ').toLowerCase().includes(normalizedQuery))) {
        path.forEach((_, index) => upsertPathSet(emptyIndex.ancestorSubcategoryPaths, category.slug, path.slice(0, index + 1)));
      }

      visitSubcategory(category, subcategory.subcategories, path);
    });
  };

  categories.forEach((category) => {
    const categoryNodeId = catId(category.slug);
    const categoryText = [category.title, category.summary, category.description, category.slug].join(' ').toLowerCase();
    if (categoryText.includes(normalizedQuery)) {
      matches.push({ kind: 'category', id: categoryNodeId, categorySlug: category.slug });
      emptyIndex.categorySlugsWithMatches.add(category.slug);
      emptyIndex.matchedCategorySlugs.add(category.slug);
    }

    category.items.forEach((item) => {
      const itemText = [item.name, item.description, item.slug].join(' ').toLowerCase();
      if (!itemText.includes(normalizedQuery)) return;
      const id = itemId(category.slug, item.slug);
      matches.push({ kind: 'item', id, categorySlug: category.slug, subcategoryPath: [], itemSlug: item.slug });
      emptyIndex.categorySlugsWithMatches.add(category.slug);
      emptyIndex.matchedItemIds.add(id);
    });

    visitSubcategory(category, category.subcategories);
  });

  emptyIndex.matches = matches;
  return emptyIndex;
};

function flattenCatalogRows(
  catalog: CatalogData,
  statuses: Record<string, CategoryStatus>
): Map<string, CatalogRowSnapshot> {
  const rows = new Map<string, CatalogRowSnapshot>();

  const visitSubcategories = (
    categorySlug: string,
    parentId: string,
    nodes: RecursiveCatalogSubcategory[],
    parentPath: string[] = []
  ) => {
    nodes.forEach((node, index) => {
      const path = [...parentPath, node.slug];
      const rowId = subId(categorySlug, path);
      rows.set(node.id, {
        id: node.id,
        parentId,
        slug: node.slug,
        title: node.title,
        summary: '',
        description: node.description,
        image: node.image ?? '',
        adminNotes: node.adminNotes ?? null,
        bannerImage: null,
        items: Array.isArray(node.items) ? node.items : [],
        position: index,
        status: statuses[rowId] ?? 'active'
      });
      visitSubcategories(categorySlug, node.id, node.subcategories, path);
    });
  };

  catalog.categories.forEach((category, index) => {
    rows.set(category.id, {
      id: category.id,
      parentId: null,
      slug: category.slug,
      title: category.title,
      summary: category.summary,
      description: category.description,
      image: category.image,
      adminNotes: category.adminNotes ?? null,
      bannerImage: category.bannerImage ?? null,
      items: Array.isArray(category.items) ? category.items : [],
      position: index,
      status: statuses[catId(category.slug)] ?? 'active'
    });
    visitSubcategories(category.slug, category.id, category.subcategories);
  });

  return rows;
}

function buildCatalogPatchPayload(
  previous: CatalogData,
  next: CatalogData,
  previousStatuses: Record<string, CategoryStatus>,
  statuses: Record<string, CategoryStatus>
) {
  const previousRows = flattenCatalogRows(previous, previousStatuses);
  const nextRows = flattenCatalogRows(next, statuses);
  const upserts: CatalogRowSnapshot[] = [];

  nextRows.forEach((row, id) => {
    const previousRow = previousRows.get(id);
    if (!previousRow || JSON.stringify(previousRow) !== JSON.stringify(row)) {
      upserts.push(
        row.image === '' && !!previousRow?.image
          ? { ...row, image: null, removeImage: true }
          : { ...row, removeImage: false }
      );
    }
  });

  const deleteIds = [...previousRows.keys()].filter((id) => !nextRows.has(id));
  return { upserts, deleteIds };
}


export default function AdminCategoriesMainTable({
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
  const [isStatusHeaderMenuOpen, setIsStatusHeaderMenuOpen] = useState(false);
  const [selectedRows, setSelectedRows] = useState<string[]>([]);
  const [createTarget, setCreateTarget] = useState<CreateTarget>(null);
  const [createName, setCreateName] = useState('');
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);
  const [isBulkDeleteDialogOpen, setIsBulkDeleteDialogOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [tableSort, setTableSort] = useState<{ key: CategorySortKey; direction: CategorySortDirection }>({
    key: 'category',
    direction: 'asc'
  });
  const [millerSearchQuery, setMillerSearchQuery] = useState('');
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
  const [lowerViewCount, setLowerViewCount] = useState(5);
  const [millerCatalog, setMillerCatalog] = useState<CatalogData>({ categories: [] });
  const [millerSelection, setMillerSelection] = useState<string[]>([]);
  const [millerDropTarget, setMillerDropTarget] = useState<MillerDropLocation | null>(null);
  const [millerDirty, setMillerDirty] = useState(false);
  const [millerDeleteTarget, setMillerDeleteTarget] = useState<MillerDeleteTarget>(null);
  const [isMillerSaveDialogOpen, setIsMillerSaveDialogOpen] = useState(false);
  const [millerError, setMillerError] = useState<string | null>(null);
  const [millerRename, setMillerRename] = useState<MillerRenameDraft | null>(null);
  const [tableSaveSummary, setTableSaveSummary] = useState<string[]>([]);
  const [millerSaveSummary, setMillerSaveSummary] = useState<string[]>([]);
  const [pendingNavigation, setPendingNavigation] = useState<string | null>(null);
  const [isUnsavedLeaveDialogOpen, setIsUnsavedLeaveDialogOpen] = useState(false);
  const [activeMillerDragId, setActiveMillerDragId] = useState<string | null>(null);

  const { toast } = useToast();
  const pathname = usePathname();
  const router = useRouter();
  const [activeView, setActiveView] = useState<CategoriesView>(initialView);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));
  const uploadRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const pendingImageUploadsRef = useRef<Record<string, PendingImageUpload>>({});
  const statusHeaderMenuRef = useRef<HTMLDivElement>(null);
  const selectAllRef = useRef<HTMLInputElement>(null);
  const isInlineSavingRef = useRef(false);
  const skipNextInlineBlurSaveRef = useRef(false);
  const saveInlineEditRef = useRef<() => void>(() => {});
  const toastRef = useRef(toast);
  const persistedTableRef = useRef<CatalogData>({ categories: [] });
  const persistedMillerRef = useRef<CatalogData>({ categories: [] });
  const persistedStatusRef = useRef<Record<string, CategoryStatus>>({});
  const catalogRef = useRef<CatalogData>({ categories: [] });
  const millerCatalogRef = useRef<CatalogData>({ categories: [] });
  const statusByRowRef = useRef<Record<string, CategoryStatus>>({});
  const partialPayloadRef = useRef(initialPayload?.payloadMode === 'partial');
  const hydrationPromiseRef = useRef<Promise<AdminCategoriesPayload> | null>(null);
  const stagedTableHistoryRef = useRef<HistorySnapshot[]>([]);
  const stagedMillerHistoryRef = useRef<HistorySnapshot[]>([]);
  const demotedMillerCategoriesRef = useRef<Map<string, RecursiveCatalogCategory>>(new Map());
  const committedHistoryRef = useRef<HistorySnapshot[]>([]);
  const committedHistoryIndexRef = useRef(0);
  const millerViewportRef = useRef<HTMLDivElement | null>(null);
  const canUndoStagedChanges =
    activeView === 'miller'
      ? stagedMillerHistoryRef.current.length > 0
      : stagedTableHistoryRef.current.length > 0;

  const hasPendingStagedChanges =
    stagedTableHistoryRef.current.length > 0 || stagedMillerHistoryRef.current.length > 0;

  const canRestoreCommittedHistory = committedHistoryIndexRef.current > 0;

  const applyPayloadState = useCallback((payloadRaw: AdminCategoriesPayload, options?: { persistSession?: boolean }) => {
    Object.keys(pendingImageUploadsRef.current).forEach((rowId) => {
      const pending = pendingImageUploadsRef.current[rowId];
      if (pending) URL.revokeObjectURL(pending.objectUrl);
      delete pendingImageUploadsRef.current[rowId];
    });
    const payload = normalizeCatalogData(payloadRaw);
    const nextStatuses = payloadRaw.statuses ?? {};

    setCatalog(payload);
    setMillerCatalog(payload);
    catalogRef.current = payload;
    millerCatalogRef.current = payload;
    persistedTableRef.current = payload;
    persistedMillerRef.current = payload;
    setTableDirty(false);
    setTableError(null);
    setMillerDirty(false);
    setMillerSelection([]);
    setExpanded((prev) => ({
      ...prev,
      [rootId]: prev[rootId] ?? true,
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
      statusByRowRef.current = next;
      return next;
    });
    const initialSnapshot = { catalog: payload, statuses: { ...persistedStatusRef.current } };
    stagedTableHistoryRef.current = [];
    stagedMillerHistoryRef.current = [];
    committedHistoryRef.current = [initialSnapshot];
    committedHistoryIndexRef.current = 0;
    partialPayloadRef.current = payloadRaw.payloadMode === 'partial';
    if (options?.persistSession ?? payloadRaw.payloadMode !== 'partial') {
      setAdminCategoriesSessionPayload({
        categories: payload.categories,
        statuses: nextStatuses,
        payloadMode: payloadRaw.payloadMode ?? 'full',
        payloadView: payloadRaw.payloadView
      });
    }
  }, []);

  const prefetchFullPayload = useCallback(async () => {
    if (!partialPayloadRef.current) return null;

    if (!hydrationPromiseRef.current) {
      hydrationPromiseRef.current = fetch(
        activeView === 'preview' ? '/api/admin/categories?view=preview' : '/api/admin/categories',
        { cache: 'no-store' }
      )
        .then(async (response) => {
          if (!response.ok) {
            throw new Error('Napaka pri nalaganju kategorij');
          }

          return (await response.json()) as AdminCategoriesPayload;
        })
        .catch((error) => {
          hydrationPromiseRef.current = null;
          throw error;
        });
    }

    return hydrationPromiseRef.current;
  }, [activeView]);

  const ensureFullPayloadLoaded = useCallback(async () => {
    if (!partialPayloadRef.current) return;

    const payload = await prefetchFullPayload();
    if (!payload) return;

    applyPayloadState({
      ...payload,
      payloadMode: 'full',
      payloadView: activeView
    });
  }, [activeView, applyPayloadState, prefetchFullPayload]);

  const load = useCallback(async ({ silent = false }: { silent?: boolean } = {}) => {
    if (!silent) setLoading(true);

    try {
      const response = await fetch(
        activeView === 'preview' ? '/api/admin/categories?view=preview' : '/api/admin/categories',
        { cache: 'no-store' }
      );

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
  }, [activeView, applyPayloadState]);

  useEffect(() => {
    toastRef.current = toast;
  }, [toast]);

  useEffect(() => {
    catalogRef.current = catalog;
  }, [catalog]);

  useEffect(() => {
    millerCatalogRef.current = millerCatalog;
  }, [millerCatalog]);

  useEffect(() => {
    statusByRowRef.current = statusByRow;
  }, [statusByRow]);

  useEffect(() => {
    const sessionPayload = getAdminCategoriesSessionPayload();
    if (sessionPayload && sessionPayload.payloadMode !== 'partial') {
      applyPayloadState(sessionPayload);
      setLoading(false);
      return;
    }

    if (initialPayload) {
      applyPayloadState(initialPayload, { persistSession: initialPayload.payloadMode !== 'partial' });
      setLoading(false);
      return;
    }
    void load();
  }, [applyPayloadState, initialPayload, load]);

  useEffect(() => {
    if (pathname?.endsWith('/miller-view')) {
      setActiveView('miller');
      return;
    }
    if (pathname?.endsWith('/predogled')) {
      setActiveView('preview');
      return;
    }
    setActiveView('table');
  }, [pathname]);

  useEffect(() => {
    return () => {
      Object.values(pendingImageUploadsRef.current).forEach(({ objectUrl }) => URL.revokeObjectURL(objectUrl));
      pendingImageUploadsRef.current = {};
    };
  }, []);


  useEffect(() => {
    if (activeView !== 'miller' || millerSelection.length === 0) return;

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node | null;
      if (!target) return;

      const viewport = millerViewportRef.current;
      if (!viewport) return;

      if (viewport.contains(target)) return;
      setMillerSelection([]);
    };

    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, [activeView, millerSelection.length]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(CATEGORY_STATUS_STORAGE_KEY, JSON.stringify(statusByRow));
  }, [statusByRow]);

  useEffect(() => {
    const closeOnOutsideClick = (event: MouseEvent) => {
      const target = event.target as Node;

      if (isStatusHeaderMenuOpen && statusHeaderMenuRef.current && !statusHeaderMenuRef.current.contains(target)) {
        setIsStatusHeaderMenuOpen(false);
      }
    };

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsStatusHeaderMenuOpen(false);
      }
    };

    window.addEventListener('mousedown', closeOnOutsideClick);
    window.addEventListener('keydown', closeOnEscape);
    return () => {
      window.removeEventListener('mousedown', closeOnOutsideClick);
      window.removeEventListener('keydown', closeOnEscape);
    };
  }, [isStatusHeaderMenuOpen]);

  const resolvePendingImageCatalog = useCallback(async (source: CatalogData): Promise<CatalogData> => {
    const pendingEntries = Object.entries(pendingImageUploadsRef.current);
    if (pendingEntries.length === 0) return source;

    const rowTargets = new Map<string, { categorySlug: string; subcategoryPath: string[] }>();
    source.categories.forEach((category) => {
      rowTargets.set(catId(category.slug), { categorySlug: category.slug, subcategoryPath: [] });
      mapSubcategoryTree(category.subcategories, (_subcategory, path) => {
        rowTargets.set(subId(category.slug, path), { categorySlug: category.slug, subcategoryPath: path });
        return _subcategory;
      });
    });

    const uploadedUrlByRowId = new Map<string, string>();
    await Promise.all(
      pendingEntries.map(async ([rowId, pending]) => {
        const target = rowTargets.get(rowId);
        if (!target) return;

        const formData = new FormData();
        formData.append('file', pending.file);
        formData.append('categorySlug', target.categorySlug);
        if (target.subcategoryPath.length > 0) {
          formData.append('subcategoryPath', target.subcategoryPath.join('__'));
        }

        const response = await fetch('/api/admin/categories/images', {
          method: 'POST',
          body: formData
        });

        if (!response.ok) {
          const payload = (await response.json().catch(() => null)) as { message?: string } | null;
          throw new Error(payload?.message || 'Nalaganje slike ni uspelo.');
        }

        const payload = (await response.json()) as { url: string };
        uploadedUrlByRowId.set(rowId, payload.url);
      })
    );

    return {
      categories: source.categories.map((category) => {
        const categoryRowId = catId(category.slug);
        const categoryPending = pendingImageUploadsRef.current[categoryRowId];
        const nextCategoryImage = categoryPending && category.image === categoryPending.objectUrl
          ? (uploadedUrlByRowId.get(categoryRowId) ?? category.image)
          : category.image;

        return {
          ...category,
          image: nextCategoryImage,
          subcategories: mapSubcategoryTree(category.subcategories, (subcategory, path) => {
            const rowId = subId(category.slug, path);
            const pending = pendingImageUploadsRef.current[rowId];
            if (!pending || subcategory.image !== pending.objectUrl) return subcategory;
            return {
              ...subcategory,
              image: uploadedUrlByRowId.get(rowId) ?? subcategory.image
            };
          })
        };
      })
    };
  }, []);

  const clearPendingImageUpload = useCallback((rowId: string) => {
    const pending = pendingImageUploadsRef.current[rowId];
    if (!pending) return;
    URL.revokeObjectURL(pending.objectUrl);
    delete pendingImageUploadsRef.current[rowId];
  }, []);

  const persist = async (next: CatalogData, statuses: Record<string, CategoryStatus>, message = 'Shranjeno') => {
    const previousTableCatalog = catalog;
    const previousMillerCatalog = millerCatalog;
    const previousPersistedCatalog = persistedTableRef.current;
    const previousStatuses = persistedStatusRef.current;
    const normalizedNext = normalizeCatalogData(next);
    const requestCatalog = normalizeCatalogData(await resolvePendingImageCatalog(normalizedNext));

    setCatalog(normalizedNext);
    setMillerCatalog(normalizedNext);
    setSaving(true);

    try {
      const patchPayload = buildCatalogPatchPayload(previousPersistedCatalog, requestCatalog, previousStatuses, statuses);
      const response = await fetch('/api/admin/categories', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patchPayload)
      });

      if (!response.ok) {
        setCatalog(previousTableCatalog);
        setMillerCatalog(previousMillerCatalog);
        const payload = (await response.json().catch(() => null)) as { message?: string } | null;
        toast.error(payload?.message || 'Shranjevanje ni uspelo');
        return null;
      }

      Object.keys(pendingImageUploadsRef.current).forEach(clearPendingImageUpload);
      const savedPayload = (await response.json().catch(() => ({ ok: true }))) as AdminCategoriesPayload & { ok?: boolean };
      toast.success(message);
      return {
        categories: savedPayload.categories ? normalizeCatalogData(savedPayload).categories : requestCatalog.categories,
        statuses: savedPayload.statuses ?? { ...statuses }
      } as AdminCategoriesPayload;
    } catch {
      setCatalog(previousTableCatalog);
      setMillerCatalog(previousMillerCatalog);
      toast.error('Shranjevanje ni uspelo');
      return null;
    } finally {
      setSaving(false);
    }
  };

  const selectedContext = useMemo(() => {
    if (activeView !== 'preview') return null;
    if (selected.kind === 'root') return { kind: 'root' as const };

    const category = catalog.categories.find((entry) => entry.slug === selected.categorySlug);
    if (!category) return null;

    if (selected.kind === 'category') return { kind: 'category' as const, category };

    const subcategoryPath = toSubcategoryPath(selected.subcategoryPath ?? selected.subcategorySlug);
    const subcategory = findSubcategoryByPath(category.subcategories, subcategoryPath);
    if (!subcategory) return null;

    return { kind: 'subcategory' as const, category, subcategory };
  }, [activeView, catalog.categories, selected]);

  const millerSelectedContext = useMemo(() => {
    if (activeView !== 'miller') return null;
    if (selected.kind === 'root') return { kind: 'root' as const };

    const category = millerCatalog.categories.find((entry) => entry.slug === selected.categorySlug);
    if (!category) return null;

    if (selected.kind === 'category') return { kind: 'category' as const, category };

    const subcategoryPath = toSubcategoryPath(selected.subcategoryPath ?? selected.subcategorySlug);
    const subcategory = findSubcategoryByPath(category.subcategories, subcategoryPath);
    if (!subcategory) return null;

    return { kind: 'subcategory' as const, category, subcategory };
  }, [activeView, millerCatalog.categories, selected]);


  const millerBreadcrumbs = useMemo(() => {
    if (selected.kind === 'root') {
      return [{ label: 'Kategorije', isCurrent: true }] as Array<{ label: string; onClick?: () => void; isCurrent: boolean }>;
    }

    const category = millerCatalog.categories.find((entry) => entry.slug === selected.categorySlug);
    if (!category) {
      return [{ label: 'Kategorije', isCurrent: true }] as Array<{ label: string; onClick?: () => void; isCurrent: boolean }>;
    }

    const crumbs: Array<{ label: string; onClick?: () => void; isCurrent: boolean }> = [
      {
        label: 'Kategorije',
        isCurrent: false,
        onClick: () => setSelected({ kind: 'root' })
      },
      {
        label: category.title,
        isCurrent: selected.kind === 'category',
        onClick: selected.kind === 'category' ? undefined : () => setSelected({ kind: 'category', categorySlug: category.slug })
      }
    ];

    if (selected.kind === 'subcategory') {
      const subcategoryPath = toSubcategoryPath(selected.subcategoryPath ?? selected.subcategorySlug);
      let nodes = category.subcategories;
      const traversedPath: string[] = [];

      subcategoryPath.forEach((slug, index) => {
        const node = nodes.find((entry) => entry.slug === slug);
        if (!node) return;
        traversedPath.push(node.slug);
        const pathSnapshot = [...traversedPath];
        const isCurrent = index === subcategoryPath.length - 1;
        crumbs.push({
          label: node.title,
          isCurrent,
          onClick: isCurrent
            ? undefined
            : () => setSelected({
                kind: 'subcategory',
                categorySlug: category.slug,
                subcategoryPath: pathSnapshot,
                subcategorySlug: node.slug
              })
        });
        nodes = node.subcategories;
      });
    }

    const selectedItemId = [...millerSelection].reverse().find((entry) => entry.startsWith('item:'));
    if (selectedItemId) {
      const parsedItem = parseItemNodeId(selectedItemId);
      if (parsedItem && parsedItem.categorySlug === category.slug) {
        const itemName = parsedItem.subcategoryPath.length > 0
          ? findSubcategoryByPath(category.subcategories, parsedItem.subcategoryPath)?.items.find((item) => item.slug === parsedItem.itemSlug)?.name
          : (category.items ?? []).find((item) => item.slug === parsedItem.itemSlug)?.name;
        if (itemName) crumbs.push({ label: itemName, isCurrent: true });
      }
    }

    return crumbs;
  }, [millerCatalog.categories, millerSelection, selected]);

  const stageMillerCatalog = useCallback((next: CatalogData, nextStatuses: Record<string, CategoryStatus> = statusByRow) => {
    const normalized = normalizeCatalogData(next);
    if (areMillerCatalogsEqual(normalized, millerCatalog) && areStatusesEqual(nextStatuses, statusByRow)) {
      setMillerError(null);
      return;
    }
    stagedMillerHistoryRef.current.push({
      catalog: normalizeCatalogData(millerCatalog),
      statuses: { ...statusByRow }
    });
    setMillerCatalog(normalized);
    millerCatalogRef.current = normalized;
    setStatusByRow(nextStatuses);
    statusByRowRef.current = nextStatuses;
    setMillerDirty(
      !areMillerCatalogsEqual(normalized, persistedMillerRef.current) ||
        !areStatusesEqual(nextStatuses, persistedStatusRef.current)
    );
    setMillerError(null);
  }, [millerCatalog, statusByRow]);

  const stageTableCatalog = useCallback((next: CatalogData, nextStatuses: Record<string, CategoryStatus> = statusByRow) => {
    const normalized = normalizeCatalogData(next);
    if (areCatalogsEqual(normalized, catalog) && areStatusesEqual(nextStatuses, statusByRow)) {
      setTableError(null);
      return;
    }
    stagedTableHistoryRef.current.push({
      catalog: normalizeCatalogData(catalog),
      statuses: { ...statusByRow }
    });
    setCatalog(normalized);
    catalogRef.current = normalized;
    setStatusByRow(nextStatuses);
    statusByRowRef.current = nextStatuses;
    setTableDirty(
      !areCatalogsEqual(normalized, persistedTableRef.current) ||
        !areStatusesEqual(nextStatuses, persistedStatusRef.current)
    );
    setTableError(null);
  }, [catalog, statusByRow]);

  const stageStatusChange = useCallback((nextStatuses: Record<string, CategoryStatus>) => {
    const snapshot = {
      catalog: normalizeCatalogData(activeView === 'miller' ? millerCatalog : catalog),
      statuses: { ...statusByRow }
    };

    if (activeView === 'miller') {
      stagedMillerHistoryRef.current.push(snapshot);
      setMillerDirty(
        !areMillerCatalogsEqual(millerCatalog, persistedMillerRef.current) ||
          !areStatusesEqual(nextStatuses, persistedStatusRef.current)
      );
      setMillerError(null);
    } else {
      stagedTableHistoryRef.current.push(snapshot);
      setTableDirty(
        !areCatalogsEqual(catalog, persistedTableRef.current) ||
          !areStatusesEqual(nextStatuses, persistedStatusRef.current)
      );
      setTableError(null);
    }

    setStatusByRow(nextStatuses);
  }, [activeView, catalog, millerCatalog, statusByRow]);

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
      const previous = stagedMillerHistoryRef.current.pop();
      if (!previous) return;

      const normalizedCatalog = normalizeCatalogData(previous.catalog);

      setMillerCatalog(normalizedCatalog);
      setStatusByRow({ ...previous.statuses });
      setMillerSelection([]);
      setMillerRename(null);
      setMillerDropTarget(null);
      setMillerDirty(
        !areMillerCatalogsEqual(normalizedCatalog, persistedMillerRef.current) ||
          !areStatusesEqual(previous.statuses, persistedStatusRef.current)
      );
      setMillerError(null);
      return;
    }

    const previous = stagedTableHistoryRef.current.pop();
    if (!previous) return;

    const normalizedCatalog = normalizeCatalogData(previous.catalog);

    setCatalog(normalizedCatalog);
    setStatusByRow({ ...previous.statuses });
    setEditingRow(null);
    setIsStatusHeaderMenuOpen(false);
    setTableDirty(
      !areCatalogsEqual(normalizedCatalog, persistedTableRef.current) ||
        !areStatusesEqual(previous.statuses, persistedStatusRef.current)
    );
    setTableError(null);
  };

  const restoreCommittedHistory = () => {
    if (hasPendingStagedChanges) {
      toast.error('Najprej razveljavite ali shranite neshranjene spremembe.');
      return;
    }

    const previousIndex = committedHistoryIndexRef.current - 1;
    if (previousIndex < 0) {
      toast.error('Ni starejše shranjene verzije za obnovitev.');
      return;
    }

    const snapshot = committedHistoryRef.current[previousIndex];
    const normalizedCatalog = normalizeCatalogData(snapshot.catalog);

    committedHistoryIndexRef.current = previousIndex;

    setCatalog(normalizedCatalog);
    setMillerCatalog(normalizedCatalog);
    setStatusByRow({ ...snapshot.statuses });

    setEditingRow(null);
    setIsStatusHeaderMenuOpen(false);
    setMillerSelection([]);
    setMillerRename(null);
    setMillerDropTarget(null);

    stagedTableHistoryRef.current = [];
    stagedMillerHistoryRef.current = [];

    setTableDirty(true);
    setMillerDirty(true);
    setTableError(null);
    setMillerError(null);

    toast.success('Obnovljena je bila prejšnja shranjena verzija. Za potrditev kliknite "Shrani spremembe".');
  };

  const addCategory = (title: string, afterSlug?: string) => {
    const slug = slugify(title);
    if (!slug) return;

    const sourceCatalog = activeView === 'miller' ? millerCatalog : catalog;

    if (sourceCatalog.categories.some((entry) => entry.slug === slug)) {
      toast.error('Kategorija s tem nazivom že obstaja');
      return;
    }

    const item: RecursiveCatalogCategory = {
      id: createCatalogNodeId(),
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

    setExpanded((prev) => ({ ...prev, [rootId]: true, [catId(slug)]: true }));
    if (activeView === 'miller') {
      stageMillerCatalog({ categories: list });
    } else {
      stageTableCatalog({ categories: list });
    }
  };

  const addSubcategory = (
    categorySlug: string,
    title: string,
    parentPathOrAfterSlug?: string[] | string,
    afterSlug?: string
  ) => {
    const slug = slugify(title);
    if (!slug) return;

    const parentPath = Array.isArray(parentPathOrAfterSlug) ? parentPathOrAfterSlug : [];
    const resolvedAfterSlug = typeof parentPathOrAfterSlug === 'string' ? parentPathOrAfterSlug : afterSlug;

    const sourceCatalog = activeView === 'miller' ? millerCatalog : catalog;
    const parentCategory = sourceCatalog.categories.find((entry) => entry.slug === categorySlug);
    if (!parentCategory) return;

    const newNode: RecursiveCatalogSubcategory = {
      id: createCatalogNodeId(),
      slug,
      title,
      description: '',
      image: '',
      items: [],
      subcategories: []
    };

    const next = {
      categories: sourceCatalog.categories.map((entry) => {
        if (entry.slug !== categorySlug) return entry;

        if (parentPath.length === 0) {
          if (entry.subcategories.some((node) => node.slug === slug)) {
            toast.error('Podkategorija s tem nazivom že obstaja');
            return entry;
          }

          const list = [...entry.subcategories];
          if (!resolvedAfterSlug) {
            list.push(newNode);
          } else {
            const index = list.findIndex((node) => node.slug === resolvedAfterSlug);
            if (index < 0) list.push(newNode);
            else list.splice(index + 1, 0, newNode);
          }

          return { ...entry, subcategories: list };
        }

        const parentNode = findSubcategoryByPath(entry.subcategories, parentPath);
        if (!parentNode) return entry;

        if (parentNode.subcategories.some((node) => node.slug === slug)) {
          toast.error('Podkategorija s tem nazivom že obstaja');
          return entry;
        }

        return {
          ...entry,
          subcategories: updateSubcategoryTree(entry.subcategories, parentPath, (node) => {
            const list = [...node.subcategories];
            if (!resolvedAfterSlug) {
              list.push(newNode);
            } else {
              const index = list.findIndex((child) => child.slug === resolvedAfterSlug);
              if (index < 0) list.push(newNode);
              else list.splice(index + 1, 0, newNode);
            }

            return {
              ...node,
              subcategories: list
            };
          })
        };
      })
    };

    setExpanded((prev) => {
      const nextExpanded = { ...prev, [catId(categorySlug)]: true };
      for (let index = 1; index <= parentPath.length; index += 1) {
        nextExpanded[subId(categorySlug, parentPath.slice(0, index))] = true;
      }
      return nextExpanded;
    });

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

  const confirmCreate = async () => {
    await ensureFullPayloadLoaded();
    const nextName = createName.trim();
    if (!nextName || !createTarget) return;

    if (createTarget.kind === 'category') {
      addCategory(nextName, createTarget.afterSlug);
    } else {
      addSubcategory(
        createTarget.categorySlug,
        nextName,
        createTarget.parentPath,
        createTarget.afterSlug
      );
    }

    setCreateTarget(null);
    setCreateName('');
  };


  const onTreeDragEnd = async (event: DragEndEvent) => {
    await ensureFullPayloadLoaded();
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

  const onBottomReorder = async (event: DragEndEvent) => {
    await ensureFullPayloadLoaded();
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    if (selected.kind === 'root') {
      const oldIndex = catalog.categories.findIndex((entry) => catId(entry.slug) === active.id);
      const newIndex = catalog.categories.findIndex((entry) => catId(entry.slug) === over.id);
      if (oldIndex < 0 || newIndex < 0) return;

      stageTableCatalog({ categories: arrayMove(catalog.categories, oldIndex, newIndex) });
      return;
    }

    const parsedActive = parseSubNodeId(String(active.id));
    const parsedOver = parseSubNodeId(String(over.id));
    if (!parsedActive || !parsedOver || parsedActive.categorySlug !== parsedOver.categorySlug) return;
    if (parsedActive.subcategoryPath.length !== parsedOver.subcategoryPath.length) return;

    const parentPath = parsedActive.subcategoryPath.slice(0, -1);
    if (!pathEquals(parentPath, parsedOver.subcategoryPath.slice(0, -1))) return;

    const category = catalog.categories.find((entry) => entry.slug === parsedActive.categorySlug);
    const siblings = !category
      ? []
      : parentPath.length === 0
        ? category.subcategories
        : findSubcategoryByPath(category.subcategories, parentPath)?.subcategories ?? [];

    const oldIndex = siblings.findIndex((entry) => entry.slug === parsedActive.subcategoryPath.at(-1));
    const newIndex = siblings.findIndex((entry) => entry.slug === parsedOver.subcategoryPath.at(-1));
    if (oldIndex < 0 || newIndex < 0) return;

    const next = {
      categories: catalog.categories.map((entry) =>
        entry.slug !== parsedActive.categorySlug
          ? entry
          : parentPath.length === 0
            ? { ...entry, subcategories: arrayMove(entry.subcategories, oldIndex, newIndex) }
            : {
                ...entry,
                subcategories: updateSubcategoryTree(entry.subcategories, parentPath, (node) => ({
                  ...node,
                  subcategories: arrayMove(node.subcategories, oldIndex, newIndex)
                }))
              }
      )
    };

    stageTableCatalog(next);
  };

  const onLeafProductsDragEnd = async (event: DragEndEvent) => {
    await ensureFullPayloadLoaded();
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

  const cloneCategory = useCallback(
    (category: RecursiveCatalogCategory): RecursiveCatalogCategory => ({
      ...category,
      items: [...(category.items ?? [])],
      subcategories: mapSubcategoryTree(category.subcategories, (node) => ({
        ...node,
        items: [...node.items]
      }))
    }),
    []
  );

  const getTreeNodeRef = useCallback((categories: RecursiveCatalogCategory[], id: string): TreeNodeRef | null => {
    if (id.startsWith('cat:')) {
      const slug = id.slice(4);
      const categoryIndex = categories.findIndex((entry) => entry.slug === slug);
      if (categoryIndex < 0) return null;
      return { kind: 'category', category: categories[categoryIndex], categoryIndex };
    }

    if (!id.startsWith('sub:')) return null;
    const parsed = parseSubNodeId(id);
    if (!parsed) return null;
    const category = categories.find((entry) => entry.slug === parsed.categorySlug);
    if (!category) return null;
    const node = findSubcategoryByPath(category.subcategories, parsed.subcategoryPath);
    if (!node) return null;
    return { kind: 'subcategory', category, node, path: parsed.subcategoryPath };
  }, []);

  const isDescendantPath = useCallback((ancestor: string[], candidate: string[]) => (
    ancestor.length < candidate.length && ancestor.every((part, index) => candidate[index] === part)
  ), []);

  const applyMillerMove = async (dropLocation: MillerDropLocation | null) => {
    await ensureFullPayloadLoaded();
    if (millerSelection.length === 0) return;
    if (!dropLocation) return;
    if (millerSelection.includes(dropLocation.parentId)) return;

    const selectedCategorySlugs = new Set(
      millerSelection
        .map((id) => (id.startsWith('cat:') ? id.slice(4) : null))
        .filter((entry): entry is string => entry !== null)
    );
    const selectedSubKeys = new Set(
      millerSelection.filter((entry) => entry.startsWith('sub:'))
    );
    const selectedItemKeys = new Set(
      millerSelection.filter((entry) => entry.startsWith('item:'))
    );

    let nextCategories = millerCatalog.categories.map(cloneCategory);

    if (selectedCategorySlugs.size > 0) {
      const moved = nextCategories.filter((category) => selectedCategorySlugs.has(category.slug));
      const remaining = nextCategories.filter((category) => !selectedCategorySlugs.has(category.slug));

      if (dropLocation.parentId === rootId) {
        nextCategories = insertAtIndex(remaining, dropLocation.index, moved);
      } else {
        const parentRef = getTreeNodeRef(remaining, dropLocation.parentId);
        if (!parentRef) return;

        const candidateSlugs = new Set<string>();
        for (const category of moved) {
          if (candidateSlugs.has(category.slug)) {
            toast.error('Premik ni možen zaradi podvojenih slugov podkategorij.');
            return;
          }
          candidateSlugs.add(category.slug);
          demotedMillerCategoriesRef.current.set(category.id, category);
        }

        const movedNodes = moved.map<RecursiveCatalogSubcategory>((category) => ({
          id: category.id,
          slug: category.slug,
          title: category.title,
          description: category.description,
          adminNotes: category.adminNotes,
          image: category.image,
          createdAt: category.createdAt,
          updatedAt: category.updatedAt,
          items: [...(category.items ?? [])],
          subcategories: category.subcategories
        }));

        if (parentRef.kind === 'category') {
          const existing = new Set(parentRef.category.subcategories.map((entry) => entry.slug));
          if (movedNodes.some((entry) => existing.has(entry.slug))) {
            toast.error('Premik ni možen zaradi podvojenih slugov podkategorij.');
            return;
          }
          nextCategories = remaining.map((category) =>
            category.slug !== parentRef.category.slug
              ? category
              : { ...category, subcategories: insertAtIndex(category.subcategories, dropLocation.index, movedNodes) }
          );
        } else {
          if (moved.some((category) => category.slug === parentRef.category.slug) || moved.some((category) => isDescendantPath([category.slug], parentRef.path))) {
            toast.error('Premik v lastno vejo ni dovoljen.');
            return;
          }
          nextCategories = remaining.map((category) =>
            category.slug !== parentRef.category.slug
              ? category
              : {
                  ...category,
                  subcategories: updateSubcategoryTree(category.subcategories, parentRef.path, (node) => {
                    const existing = new Set(node.subcategories.map((entry) => entry.slug));
                    if (movedNodes.some((entry) => existing.has(entry.slug))) {
                      throw new Error('duplicate-subcategory-slug');
                    }
                    return { ...node, subcategories: insertAtIndex(node.subcategories, dropLocation.index, movedNodes) };
                  })
                }
          );
        }
      }
    }

    if (selectedSubKeys.size > 0) {
      const selectedRefs = millerSelection
        .filter((entry) => entry.startsWith('sub:'))
        .map((id) => getTreeNodeRef(nextCategories, id))
        .filter((entry): entry is Extract<TreeNodeRef, { kind: 'subcategory' }> => entry?.kind === 'subcategory')
        .sort((left, right) => right.path.length - left.path.length);

      const parentRef = dropLocation.parentId === rootId ? null : getTreeNodeRef(nextCategories, dropLocation.parentId);
      if (dropLocation.parentId !== rootId && !parentRef) return;

      for (const selectedRef of selectedRefs) {
        if (parentRef?.kind === 'subcategory') {
          if (selectedRef.node.id === parentRef.node.id || isDescendantPath(selectedRef.path, parentRef.path)) {
            toast.error('Premik v isto ali podrejeno podkategorijo ni dovoljen.');
            return;
          }
        }
      }

      const movedSubs: RecursiveCatalogSubcategory[] = [];
      nextCategories = nextCategories.flatMap((category) => {
        const removals = new Set(selectedRefs.filter((entry) => entry.category.slug === category.slug).map((entry) => subPathKey(entry.path)));
        const visit = (nodes: RecursiveCatalogSubcategory[], parentPath: string[] = []): RecursiveCatalogSubcategory[] =>
          nodes.flatMap((node) => {
            const currentPath = [...parentPath, node.slug];
            if (removals.has(subPathKey(currentPath))) {
              movedSubs.push(node);
              return [];
            }
            return [{ ...node, subcategories: visit(node.subcategories, currentPath) }];
          });

        return [{ ...category, subcategories: visit(category.subcategories) }];
      });

      if (dropLocation.parentId === rootId) {
        const promoted = movedSubs.map<RecursiveCatalogCategory>((subcategory) => {
          const demotedCategory = demotedMillerCategoriesRef.current.get(subcategory.id);
          return {
            ...(demotedCategory ?? {
              id: subcategory.id,
              slug: subcategory.slug,
              title: subcategory.title,
              summary: subcategory.title,
              description: subcategory.description,
              image: subcategory.image ?? '',
              adminNotes: subcategory.adminNotes,
              bannerImage: undefined,
              createdAt: subcategory.createdAt,
              updatedAt: subcategory.updatedAt
            }),
            id: subcategory.id,
            slug: subcategory.slug,
            title: subcategory.title,
            description: subcategory.description,
            image: subcategory.image ?? '',
            adminNotes: subcategory.adminNotes,
            subcategories: subcategory.subcategories,
            items: [...subcategory.items]
          };
        });
        nextCategories = insertAtIndex(nextCategories, dropLocation.index, promoted);
      } else if (parentRef?.kind === 'category') {
        const existing = new Set(parentRef.category.subcategories.map((entry) => entry.slug));
        if (movedSubs.some((entry) => existing.has(entry.slug))) {
          toast.error('Premik ni možen zaradi podvojenih slugov podkategorij.');
          return;
        }
        nextCategories = nextCategories.map((category) =>
          category.slug !== parentRef.category.slug
            ? category
            : { ...category, subcategories: insertAtIndex(category.subcategories, dropLocation.index, movedSubs) }
        );
      } else if (parentRef?.kind === 'subcategory') {
        nextCategories = nextCategories.map((category) =>
          category.slug !== parentRef.category.slug
            ? category
            : {
                ...category,
                subcategories: updateSubcategoryTree(category.subcategories, parentRef.path, (node) => {
                  const existing = new Set(node.subcategories.map((entry) => entry.slug));
                  if (movedSubs.some((entry) => existing.has(entry.slug))) {
                    throw new Error('duplicate-subcategory-slug');
                  }
                  return { ...node, subcategories: insertAtIndex(node.subcategories, dropLocation.index, movedSubs) };
                })
              }
        );
      }
    }

    if (selectedItemKeys.size > 0 && dropLocation.parentId !== rootId) {
      const parsedItems = millerSelection
        .map((id) => parseItemNodeId(id))
        .filter((entry): entry is NonNullable<ReturnType<typeof parseItemNodeId>> => Boolean(entry));
      const movedItems: CatalogItem[] = [];

      nextCategories = nextCategories.map((category) => ({
        ...category,
        items: (category.items ?? []).filter((item) => {
          const moving = parsedItems.some((entry) => entry.categorySlug === category.slug && entry.itemSlug === item.slug && entry.subcategoryPath.length === 0);
          if (moving) movedItems.push(item);
          return !moving;
        }),
        subcategories: mapSubcategoryTree(category.subcategories, (node, path) => ({
          ...node,
          items: node.items.filter((item) => {
            const moving = parsedItems.some((entry) => entry.categorySlug === category.slug && entry.itemSlug === item.slug && pathEquals(entry.subcategoryPath, path));
            if (moving) movedItems.push(item);
            return !moving;
          })
        }))
      }));

      const parentRef = getTreeNodeRef(nextCategories, dropLocation.parentId);
      if (!parentRef) return;

      if (parentRef.kind === 'category') {
        nextCategories = nextCategories.map((category) =>
          category.slug !== parentRef.category.slug
            ? category
            : { ...category, items: insertAtIndex(category.items ?? [], dropLocation.index, movedItems) }
        );
      } else {
        nextCategories = nextCategories.map((category) =>
          category.slug !== parentRef.category.slug
            ? category
            : {
                ...category,
                subcategories: updateSubcategoryTree(category.subcategories, parentRef.path, (node) => ({
                  ...node,
                  items: insertAtIndex(node.items, dropLocation.index, movedItems)
                }))
              }
        );
      }
    }

    try {
      stageMillerCatalog({ categories: nextCategories });
      setMillerDropTarget(null);
    } catch (error) {
      if (error instanceof Error && error.message === 'duplicate-subcategory-slug') {
        toast.error('Premik ni možen zaradi podvojenih slugov podkategorij.');
        return;
      }
      throw error;
    }
  };

  const applyMillerRename = async () => {
    await ensureFullPayloadLoaded();
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
      const parsed = parseSubNodeId(millerRename.id);
      if (!parsed) return;

      stageMillerCatalog({
        categories: millerCatalog.categories.map((category) =>
          category.slug !== parsed.categorySlug
            ? category
            : {
                ...category,
                subcategories: updateSubcategoryTree(category.subcategories, parsed.subcategoryPath, (subcategory) => ({
                  ...subcategory,
                  title: value
                }))
              }
        )
      });
      setMillerRename(null);
    }
  };

  const requestDeleteMillerSelection = async (column: 'categories' | 'subcategories' | 'items') => {
    await ensureFullPayloadLoaded();
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
        subcategories: pruneSelectedSubcategoryTree(category.slug, category.subcategories, selectedSubcategories)
      }));
    }

    if (millerDeleteTarget.column === 'items') {
      const selectedItems = new Set(millerDeleteTarget.ids);
      nextCategories = nextCategories.map((category) => ({
        ...category,
        items: (category.items ?? []).filter((item) => !selectedItems.has(itemId(category.slug, item.slug))),
        subcategories: mapSubcategoryTree(category.subcategories, (sub, path) => ({
          ...sub,
          items: sub.items.filter((item) => !selectedItems.has(itemId(category.slug, item.slug, path)))
        }))
      }));
    }

    stageMillerCatalog({ categories: nextCategories });
    setMillerSelection([]);
    setMillerDeleteTarget(null);
  };

  const addMillerNode = async (column: 'categories' | 'subcategories' | 'items') => {
    await ensureFullPayloadLoaded();
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
    await ensureFullPayloadLoaded();
    const savedCatalog = normalizeCatalogData(millerCatalogRef.current);
    const savedPayload = await persist(savedCatalog, statusByRowRef.current, 'Miller spremembe shranjene');

    if (!savedPayload) {
      setMillerError('Shranjevanje Miller sprememb ni uspelo. Lokalno stanje je ohranjeno.');
      return;
    }

    const canonicalCatalog = normalizeCatalogData(savedPayload);
    const canonicalStatuses = savedPayload.statuses ?? {};

    persistedTableRef.current = canonicalCatalog;
    persistedMillerRef.current = canonicalCatalog;
    persistedStatusRef.current = { ...canonicalStatuses };
    setAdminCategoriesSessionPayload({ categories: canonicalCatalog.categories, statuses: canonicalStatuses });

    committedHistoryRef.current = committedHistoryRef.current.slice(0, committedHistoryIndexRef.current + 1);
    committedHistoryRef.current.push({
      catalog: canonicalCatalog,
      statuses: { ...canonicalStatuses }
    });
    committedHistoryIndexRef.current = committedHistoryRef.current.length - 1;

    stagedMillerHistoryRef.current = [];
    stagedTableHistoryRef.current = [];

    setCatalog(canonicalCatalog);
    setMillerCatalog(canonicalCatalog);
    setStatusByRow(canonicalStatuses);
    setMillerDirty(false);
    setTableDirty(false);
    setMillerError(null);
    setTableError(null);
  };

  const saveTableChanges = async () => {
    await ensureFullPayloadLoaded();
    const savedCatalog = normalizeCatalogData(catalogRef.current);
    const savedPayload = await persist(savedCatalog, statusByRowRef.current, 'Spremembe shranjene');

    if (!savedPayload) {
      setTableError('Shranjevanje sprememb ni uspelo. Lokalno stanje je ohranjeno.');
      return;
    }

    const canonicalCatalog = normalizeCatalogData(savedPayload);
    const canonicalStatuses = savedPayload.statuses ?? {};

    persistedTableRef.current = canonicalCatalog;
    persistedMillerRef.current = canonicalCatalog;
    persistedStatusRef.current = { ...canonicalStatuses };
    setAdminCategoriesSessionPayload({ categories: canonicalCatalog.categories, statuses: canonicalStatuses });

    committedHistoryRef.current = committedHistoryRef.current.slice(0, committedHistoryIndexRef.current + 1);
    committedHistoryRef.current.push({
      catalog: canonicalCatalog,
      statuses: { ...canonicalStatuses }
    });
    committedHistoryIndexRef.current = committedHistoryRef.current.length - 1;

    stagedTableHistoryRef.current = [];
    stagedMillerHistoryRef.current = [];

    setCatalog(canonicalCatalog);
    setMillerCatalog(canonicalCatalog);
    setStatusByRow(canonicalStatuses);
    setTableDirty(false);
    setMillerDirty(false);
    setTableError(null);
    setMillerError(null);
  };

  const millerSearchIndex = useMemo(
    () => activeView === 'miller' ? getMillerSearchIndex(millerCatalog.categories, millerSearchQuery) : {
      matches: [],
      categorySlugsWithMatches: new Set<string>(),
      matchedCategorySlugs: new Set<string>(),
      matchedSubcategoryPaths: new Map<string, Set<string>>(),
      ancestorSubcategoryPaths: new Map<string, Set<string>>(),
      matchedItemIds: new Set<string>()
    },
    [activeView, millerCatalog.categories, millerSearchQuery]
  );

  const navigateToMillerSearchMatch = useCallback(async (match: MillerSearchMatch) => {
    if (match.kind === 'category') {
      setSelected({ kind: 'category', categorySlug: match.categorySlug });
      setMillerSelection([match.id]);
      return;
    }

    await ensureFullPayloadLoaded();

    if (match.kind === 'subcategory') {
      setSelected({
        kind: 'subcategory',
        categorySlug: match.categorySlug,
        subcategoryPath: match.subcategoryPath,
        subcategorySlug: match.subcategoryPath.at(-1)
      });
      setMillerSelection([match.id]);
      return;
    }

    if (match.subcategoryPath.length > 0) {
      setSelected({
        kind: 'subcategory',
        categorySlug: match.categorySlug,
        subcategoryPath: match.subcategoryPath,
        subcategorySlug: match.subcategoryPath.at(-1)
      });
    } else {
      setSelected({ kind: 'category', categorySlug: match.categorySlug });
    }
    setMillerSelection([match.id]);
  }, [ensureFullPayloadLoaded]);

  useEffect(() => {
    if (!millerSearchQuery.trim() || millerSearchIndex.matches.length === 0) return;

    const selectedMatchId = millerSelection.at(-1);
    if (selectedMatchId && millerSearchIndex.matches.some((entry) => entry.id === selectedMatchId)) return;

    void navigateToMillerSearchMatch(millerSearchIndex.matches[0]);
  }, [millerSearchIndex.matches, millerSearchQuery, millerSelection, navigateToMillerSearchMatch]);


  const millerColumns = useMemo(() => {
    if (activeView !== 'miller') return [];
    const columns: Array<{ key: string; title: string; ids: string[]; rows: Array<{ id: string; label: string; tone: string; isInactive?: boolean; createdAt?: string; updatedAt?: string; kind: 'category' | 'subcategory' | 'item'; onClick: (event: React.MouseEvent<HTMLButtonElement>) => void; onDragStart: () => void; onDropTarget: string; }>; kind: 'categories' | 'subcategories' | 'items' }> = [];
    const isMillerSearchActive = millerSearchQuery.trim().length > 0;
    const categoriesSource = isMillerSearchActive
      ? millerCatalog.categories.filter((category) => millerSearchIndex.categorySlugsWithMatches.has(category.slug))
      : millerCatalog.categories;

    const categoryIds = categoriesSource.map((category) => catId(category.slug));
    columns.push({
      key: 'categories',
      title: 'Kategorije',
      kind: 'categories',
      ids: categoryIds,
      rows: categoriesSource.map((category) => ({
        id: catId(category.slug),
        label: category.title,
        tone: selected.kind !== 'root' && selected.categorySlug === category.slug ? 'focused' : 'default',
        isInactive: (statusByRow[catId(category.slug)] ?? 'active') === 'inactive',
        createdAt: category.createdAt,
        updatedAt: category.updatedAt,
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

    const selectedSubcategoryPath = toSubcategoryPath(
      selected.kind === 'subcategory' ? (selected.subcategoryPath ?? selected.subcategorySlug) : undefined
    );

    let parentPath: string[] = [];
    let nodes = activeCategory.subcategories;
    let parentTitle = activeCategory.title;
    let depth = 0;

    while (nodes.length > 0) {
      const nodesAtDepth = isMillerSearchActive
        ? nodes.filter((node) => {
            const nodePath = [...parentPath, node.slug];
            const pathKey = subPathKey(nodePath);
            return (millerSearchIndex.ancestorSubcategoryPaths.get(activeCategory.slug)?.has(pathKey) ?? false)
              || (millerSearchIndex.matchedSubcategoryPaths.get(activeCategory.slug)?.has(pathKey) ?? false);
          })
        : nodes;

      const columnIds = nodesAtDepth.map((node) => subId(activeCategory.slug, [...parentPath, node.slug]));

      columns.push({
        key: `sub-${activeCategory.slug}-${depth}-${parentPath.join('__') || 'root'}`,
        title: parentTitle,
        kind: 'subcategories',
        ids: columnIds,
        rows: nodesAtDepth.map((subcategory) => {
          const currentPath = [...parentPath, subcategory.slug];
          const id = subId(activeCategory.slug, currentPath);
          return {
            id,
            label: subcategory.title,
            tone: selected.kind === 'subcategory' && pathEquals(selectedSubcategoryPath, currentPath) ? 'focused' : 'default',
            isInactive: (statusByRow[id] ?? 'active') === 'inactive',
            createdAt: subcategory.createdAt,
            updatedAt: subcategory.updatedAt,
            onClick: async (event) => {
              await ensureFullPayloadLoaded();
              setSelected({
                kind: 'subcategory',
                categorySlug: activeCategory.slug,
                subcategoryPath: currentPath,
                subcategorySlug: subcategory.slug
              });
              toggleMillerSelection(id, event, columnIds);
            },
            onDragStart: () => {
              if (!millerSelection.includes(id)) setMillerSelection([id]);
            },
            onDropTarget: parentPath.length === 0 ? catId(activeCategory.slug) : subId(activeCategory.slug, parentPath),
            kind: 'subcategory'
          };
        })
      });

      if (selected.kind !== 'subcategory') break;

      const selectedSlugAtDepth = selectedSubcategoryPath[depth];
      if (!selectedSlugAtDepth) break;

      const selectedNodeAtDepth = nodes.find((node) => node.slug === selectedSlugAtDepth);
      if (!selectedNodeAtDepth) break;

      parentPath = [...parentPath, selectedNodeAtDepth.slug];
      parentTitle = selectedNodeAtDepth.title;
      nodes = selectedNodeAtDepth.subcategories;
      depth += 1;
    }

    const selectedSubcategoryNode = selected.kind === 'subcategory'
      ? findSubcategoryByPath(activeCategory.subcategories, selectedSubcategoryPath)
      : null;

    const itemSource = selected.kind === 'subcategory'
      ? selectedSubcategoryNode?.items ?? []
      : activeCategory.subcategories.length === 0
        ? (activeCategory.items ?? [])
        : [];

        const filteredItemSource = isMillerSearchActive
      ? itemSource.filter((item) => millerSearchIndex.matchedItemIds.has(itemId(activeCategory.slug, item.slug, selectedSubcategoryPath)))
      : itemSource;

    const showItems = selected.kind === 'subcategory'
      ? (selectedSubcategoryNode?.subcategories.length ?? 0) === 0
      : activeCategory.subcategories.length === 0;

    if (showItems) {
      const itemIds = filteredItemSource.map((item) => itemId(activeCategory.slug, item.slug, selectedSubcategoryPath));
      columns.push({
        key: `item-${activeCategory.slug}-${subPathKey(selectedSubcategoryPath) || 'cat'}`,
        title: selected.kind === 'subcategory' ? parentTitle : activeCategory.title,
        kind: 'items',
        ids: itemIds,
        rows: filteredItemSource.map((item) => {
          const id = itemId(activeCategory.slug, item.slug, selectedSubcategoryPath);
          return {
            id,
            label: item.name,
            tone: 'default',
            createdAt: typeof item.createdAt === 'string' ? item.createdAt : typeof item.created_at === 'string' ? item.created_at : undefined,
            updatedAt: typeof item.updatedAt === 'string' ? item.updatedAt : typeof item.updated_at === 'string' ? item.updated_at : undefined,
            onClick: (event: React.MouseEvent<HTMLButtonElement>) => toggleMillerSelection(id, event, itemIds),
            onDragStart: () => {
              if (!millerSelection.includes(id)) setMillerSelection([id]);
            },
            onDropTarget: selected.kind === 'subcategory' ? subId(activeCategory.slug, selectedSubcategoryPath) : catId(activeCategory.slug),
            kind: 'item'
          };
        })
      });
    }

    return columns;
  }, [activeView, millerCatalog.categories, millerSearchIndex, millerSearchQuery, millerSelection, selected, statusByRow]);

  const activeMillerColumnKind = useMemo<'categories' | 'subcategories' | 'items'>(() => {
    const selectedId = millerSelection.at(-1);
    if (selectedId) {
      const selectedColumn = millerColumns.find((column) => column.ids.includes(selectedId));
      if (selectedColumn) return selectedColumn.kind;
    }

    const lastColumn = millerColumns.at(-1);
    return lastColumn?.kind ?? 'categories';
  }, [millerColumns, millerSelection]);

  const updateSubcategory = (
    categorySlug: string,
    subcategoryPathOrSlug: string | string[],
    patch: Partial<RecursiveCatalogSubcategory>
  ) => {
    const subcategoryPath = toSubcategoryPath(subcategoryPathOrSlug);
    if (subcategoryPath.length === 0) return;

    stageTableCatalog({
      categories: catalog.categories.map((entry) =>
        entry.slug === categorySlug
          ? {
              ...entry,
              subcategories: updateSubcategoryTree(entry.subcategories, subcategoryPath, (sub) => ({
                ...sub,
                ...patch
              }))
            }
          : entry
      )
    });
  };

  const onImageUpload = async (file: File | null, item: ContentCard, _categorySlug?: string) => {
    if (!file) return;
    const nextObjectUrl = URL.createObjectURL(file);
    clearPendingImageUpload(item.id);
    pendingImageUploadsRef.current[item.id] = { file, objectUrl: nextObjectUrl };

    if (item.kind === 'category') {
      stageTableCatalog({
        categories: catalog.categories.map((entry) =>
          entry.slug === item.categorySlug ? { ...entry, image: nextObjectUrl } : entry
        )
      });
      return;
    }

    updateSubcategory(item.categorySlug, item.subcategoryPath, { image: nextObjectUrl });
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
      stageTableCatalog({
        categories: catalog.categories.filter((entry) => entry.slug !== deleteTarget.categorySlug)
      });
      return;
    }

    const subcategoryPath = toSubcategoryPath(deleteTarget.subcategoryPath ?? deleteTarget.subcategorySlug);

    setDeleteTarget(null);
    setSelected({ kind: 'category', categorySlug: deleteTarget.categorySlug });

    stageTableCatalog({
      categories: catalog.categories.map((entry) =>
        entry.slug === deleteTarget.categorySlug
          ? {
              ...entry,
              subcategories: removeSubcategoryTree(entry.subcategories, subcategoryPath)
            }
          : entry
      )
    });
  };

  const confirmDeleteImage = () => {
    if (!imageDeleteTarget) return;

    if (imageDeleteTarget.kind === 'category') {
      clearPendingImageUpload(catId(imageDeleteTarget.categorySlug));
      stageTableCatalog({
        categories: catalog.categories.map((entry) =>
          entry.slug === imageDeleteTarget.categorySlug ? { ...entry, image: '' } : entry
        )
      });
      setImageDeleteTarget(null);
      return;
    }

    clearPendingImageUpload(subId(imageDeleteTarget.categorySlug, imageDeleteTarget.subcategorySlug ?? ''));
    updateSubcategory(imageDeleteTarget.categorySlug, imageDeleteTarget.subcategorySlug ?? '', {
      image: ''
    });
    setImageDeleteTarget(null);
  };

  const openPreviewNode = useCallback(async (card: ContentCard) => {
    if (card.kind === 'category') {
      await ensureFullPayloadLoaded();
      setSelected({ kind: 'category', categorySlug: card.categorySlug });
      return;
    }

    await ensureFullPayloadLoaded();

    setSelected({
      kind: 'subcategory',
      categorySlug: card.categorySlug,
      subcategoryPath: card.subcategoryPath,
      subcategorySlug: card.subcategoryPath.at(-1)
    });
  }, [ensureFullPayloadLoaded]);

  const navigatePreviewUp = useCallback(() => {
    setSelected((current) => {
      if (current.kind === 'root') return current;
      if (current.kind === 'category') return { kind: 'root' } as const;

      const parentPath = toSubcategoryPath(current.subcategoryPath ?? current.subcategorySlug).slice(0, -1);
      if (parentPath.length === 0) {
        return { kind: 'category', categorySlug: current.categorySlug } as const;
      }

      return {
        kind: 'subcategory',
        categorySlug: current.categorySlug,
        subcategoryPath: parentPath,
        subcategorySlug: parentPath.at(-1)
      } as const;
    });
  }, []);

  const startPreviewTitleEdit = useCallback(async (card: ContentCard) => {
    await ensureFullPayloadLoaded();
    const rowId = card.kind === 'category' ? catId(card.categorySlug) : subId(card.categorySlug, card.subcategoryPath);
    setEditingRow({
      id: rowId,
      kind: card.kind,
      categorySlug: card.categorySlug,
      subcategoryPath: card.subcategoryPath,
      subcategorySlug: card.subcategoryPath.at(-1),
      title: card.title,
      description: card.description,
      status: statusByRow[rowId] ?? 'active'
    });
  }, [ensureFullPayloadLoaded, statusByRow]);

  const visibleContent = useMemo(() => {
    if (activeView !== 'preview') return [];
    if (selectedContext?.kind === 'root') {
      return catalog.categories.map((entry) => ({
        id: catId(entry.slug),
        title: entry.title,
        description: entry.summary,
        image: entry.image,
        kind: 'category' as const,
        categorySlug: entry.slug,
        subcategoryPath: [],
        openLabel: 'Odpri kategorijo',
        hasChildren: entry.subcategories.length > 0,
        isInactive: (statusByRow[catId(entry.slug)] ?? 'active') === 'inactive'
      }));
    }

    if (selectedContext?.kind === 'category') {
      return selectedContext.category.subcategories.map((entry) => ({
        id: subId(selectedContext.category.slug, entry.slug),
        title: entry.title,
        description: entry.description,
        image: entry.image,
        kind: 'subcategory' as const,
        categorySlug: selectedContext.category.slug,
        subcategoryPath: [entry.slug],
        openLabel: 'Odpri podkategorijo',
        hasChildren: entry.subcategories.length > 0,
        isInactive: (statusByRow[subId(selectedContext.category.slug, entry.slug)] ?? 'active') === 'inactive'
      }));
    }

    if (selectedContext?.kind === 'subcategory') {
      const parentPath = toSubcategoryPath(selectedContext.subcategory.slug ? (selected.kind === 'subcategory' ? (selected.subcategoryPath ?? selected.subcategorySlug) : undefined) : undefined);
      return selectedContext.subcategory.subcategories.map((entry) => {
        const path = [...parentPath, entry.slug];
        return {
          id: subId(selectedContext.category.slug, path),
          title: entry.title,
          description: entry.description,
          image: entry.image,
          kind: 'subcategory' as const,
          categorySlug: selectedContext.category.slug,
          subcategoryPath: path,
          openLabel: 'Odpri podkategorijo',
          hasChildren: entry.subcategories.length > 0,
          isInactive: (statusByRow[subId(selectedContext.category.slug, path)] ?? 'active') === 'inactive'
        };
      });
    }

    return [];
  }, [activeView, catalog.categories, selected, selectedContext, statusByRow]);

  const selectedRowSet = useMemo(() => new Set(selectedRows), [selectedRows]);
  const openingRowIdSet = useMemo(() => new Set(openingRowIds), [openingRowIds]);
  const closingRowIdSet = useMemo(() => new Set(closingRowIds), [closingRowIds]);

  const getDescendantIds = useCallback((id: string) => {
    if (id === rootId) {
      return catalog.categories.flatMap((category) => [
        catId(category.slug),
        ...collectSubcategoryIds(category.slug, category.subcategories)
      ]);
    }

    if (id.startsWith('cat:')) {
      const categorySlug = id.slice(4);
      const category = catalog.categories.find((entry) => entry.slug === categorySlug);
      if (!category) return [];
      return collectSubcategoryIds(category.slug, category.subcategories);
    }

    if (id.startsWith('sub:')) {
      const parsed = parseSubNodeId(id);
      if (!parsed) return [];

      const category = catalog.categories.find((entry) => entry.slug === parsed.categorySlug);
      if (!category) return [];

      const subcategory = findSubcategoryByPath(category.subcategories, parsed.subcategoryPath);
      if (!subcategory) return [];

      return collectSubcategoryIds(parsed.categorySlug, subcategory.subcategories, parsed.subcategoryPath);
    }

    return [];
  }, [catalog.categories]);

  const expandableRowIds = useMemo(() => {
    return [
      rootId,
      ...catalog.categories.flatMap((category) => [
        ...(category.subcategories.length > 0 ? [catId(category.slug)] : []),
        ...collectExpandableSubcategoryIds(category.slug, category.subcategories)
      ])
    ];
  }, [catalog.categories]);

  const isRowExpanded = useCallback((id: string) => {
    return id === rootId ? (expanded[rootId] ?? true) : Boolean(expanded[id]);
  }, [expanded]);

  const areAllRowsExpanded = useMemo(
    () => expandableRowIds.every((id) => isRowExpanded(id)),
    [expandableRowIds, isRowExpanded]
  );

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

  const toggleAllExpanded = () => {
    if (areAllRowsExpanded) {
      setClosingRowIds((prev) => [...new Set([...prev, ...expandableRowIds])]);
      setExpanded((prev) => ({
        ...prev,
        ...Object.fromEntries(expandableRowIds.map((id) => [id, false]))
      }));
      window.setTimeout(() => {
        setClosingRowIds((prev) => prev.filter((entry) => !expandableRowIds.includes(entry)));
      }, expandTransitionMs);
      return;
    }

    const rowsToOpen = expandableRowIds.filter((id) => !isRowExpanded(id));
    setOpeningRowIds((prev) => [...new Set([...prev, ...rowsToOpen])]);
    setExpanded((prev) => ({
      ...prev,
      ...Object.fromEntries(expandableRowIds.map((id) => [id, true]))
    }));
    window.setTimeout(() => {
      setOpeningRowIds((prev) => prev.filter((entry) => !rowsToOpen.includes(entry)));
    }, expandTransitionMs);
  };

  const toggleExpanded = useCallback((id: string) => {
    const currentlyExpanded = isRowExpanded(id);

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
  }, [isRowExpanded]);

  const saveInlineEdit = useCallback(() => {
    if (!editingRow) return;
    const nextTitle = editingRow.title.trim();

    if (!nextTitle) {
      toast.error('Naziv je obvezen');
      return;
    }

    if (editingRow.kind === 'category') {
      if (!editingRow.categorySlug) return;

      const currentCategory = catalog.categories.find((entry) => entry.slug === editingRow.categorySlug);
      if (!currentCategory) return;

      const currentStatus = statusByRow[editingRow.id] ?? 'active';
      const hasChange =
        currentCategory.title !== nextTitle ||
        currentCategory.summary !== editingRow.description ||
        currentStatus !== editingRow.status;

      if (!hasChange) {
        setEditingRow(null);
        return;
      }

      const nextStatuses = { ...statusByRow, [editingRow.id]: editingRow.status };

      stageTableCatalog(
        {
          categories: catalog.categories.map((entry) =>
            entry.slug === editingRow.categorySlug
              ? { ...entry, title: nextTitle, summary: editingRow.description }
              : entry
          )
        },
        nextStatuses
      );

      setEditingRow(null);
      return;
    }

    if (!editingRow.categorySlug) return;

    const subcategoryPath = toSubcategoryPath(editingRow.subcategoryPath ?? editingRow.subcategorySlug);
    if (subcategoryPath.length === 0) return;

    const currentCategory = catalog.categories.find((entry) => entry.slug === editingRow.categorySlug);
    const currentSubcategory = currentCategory
      ? findSubcategoryByPath(currentCategory.subcategories, subcategoryPath)
      : null;
    if (!currentSubcategory) return;

    const currentStatus = statusByRow[editingRow.id] ?? 'active';
    const hasChange =
      currentSubcategory.title !== nextTitle ||
      currentSubcategory.description !== editingRow.description ||
      currentStatus !== editingRow.status;

    if (!hasChange) {
      setEditingRow(null);
      return;
    }

    const nextStatuses = { ...statusByRow, [editingRow.id]: editingRow.status };

    stageTableCatalog(
      {
        categories: catalog.categories.map((entry) =>
          entry.slug === editingRow.categorySlug
            ? {
                ...entry,
                subcategories: updateSubcategoryTree(entry.subcategories, subcategoryPath, (sub) => ({
                  ...sub,
                  title: nextTitle,
                  description: editingRow.description
                }))
              }
            : entry
        )
      },
      nextStatuses
    );

    setEditingRow(null);
  }, [catalog.categories, editingRow, stageTableCatalog, statusByRow, toast]);

  saveInlineEditRef.current = saveInlineEdit;

  const handleInlineBlur = useCallback((event: FocusEvent<HTMLElement>) => {
    if (skipNextInlineBlurSaveRef.current) {
      skipNextInlineBlurSaveRef.current = false;
      return;
    }

    const nextTarget = event.relatedTarget as Node | null;
    if (nextTarget && event.currentTarget.closest('tr')?.contains(nextTarget)) {
      return;
    }
    saveInlineEdit();
  }, [saveInlineEdit]);

  useEffect(() => {
    if (!editingRow) return;

    const closeInlineEditOnOutsideClick = (event: MouseEvent) => {
      const target = event.target as Node | null;
      if (!target) return;

      const targetElement = target instanceof Element ? target : null;
      if (targetElement?.closest('[data-inline-edit-field="true"]')) return;

      skipNextInlineBlurSaveRef.current = true;
      saveInlineEditRef.current();
    };

    document.addEventListener('mousedown', closeInlineEditOnOutsideClick, true);
    return () => {
      document.removeEventListener('mousedown', closeInlineEditOnOutsideClick, true);
    };
  }, [editingRow]);

  const searchQuery = query.trim().toLowerCase();
  const isSearchActive = searchQuery.length > 0;
  const sortDirectionMultiplier = tableSort.direction === 'asc' ? 1 : -1;

  const filteredCategories = useMemo(() => {
    const collator = new Intl.Collator('sl', { sensitivity: 'base' });
    const getSortValue = (node: { title: string; subcategories: RecursiveCatalogSubcategory[]; items?: CatalogItem[] }) => {
      if (tableSort.key === 'subcategories') return node.subcategories.length;
      if (tableSort.key === 'items') return (node.items ?? []).length;
      return node.title;
    };
    const compareNodes = (
      left: { title: string; subcategories: RecursiveCatalogSubcategory[]; items?: CatalogItem[] },
      right: { title: string; subcategories: RecursiveCatalogSubcategory[]; items?: CatalogItem[] }
    ) => {
      const leftValue = getSortValue(left);
      const rightValue = getSortValue(right);
      if (typeof leftValue === 'number' && typeof rightValue === 'number') {
        const numericCompare = leftValue - rightValue;
        if (numericCompare !== 0) return numericCompare * sortDirectionMultiplier;
        return collator.compare(left.title, right.title) * sortDirectionMultiplier;
      }
      return collator.compare(String(leftValue), String(rightValue)) * sortDirectionMultiplier;
    };
    const sortSubcategories = (nodes: RecursiveCatalogSubcategory[]): RecursiveCatalogSubcategory[] =>
      [...nodes]
        .sort(compareNodes)
        .map((node) => ({ ...node, subcategories: sortSubcategories(node.subcategories) }));

    const baseCategories =
      activeView !== 'table' || !isSearchActive
        ? catalog.categories
        : catalog.categories
      .map((category) => {
        const categoryMatches = [category.title, category.summary, category.description]
          .join(' ')
          .toLowerCase()
          .includes(searchQuery);

        const matchingSubcategories = categoryMatches
          ? category.subcategories
          : filterSubcategoryTree(category.subcategories, searchQuery);

        if (!categoryMatches && matchingSubcategories.length === 0) return null;

        return {
          ...category,
          subcategories: matchingSubcategories
        };
      })
      .filter((category): category is RecursiveCatalogCategory => category !== null);

    return [...baseCategories]
      .sort(compareNodes)
      .map((category) => ({ ...category, subcategories: sortSubcategories(category.subcategories) }));
  }, [activeView, catalog.categories, isSearchActive, searchQuery, sortDirectionMultiplier, tableSort.key]);

  const visibleRowIds = useMemo(() => {
    const ids: string[] = [rootId];
    const isRootExpanded =
      isSearchActive || (expanded[rootId] ?? true) || closingRowIds.includes(rootId);

    if (!isRootExpanded) {
      return ids;
    }

    const appendVisibleSubcategoryIds = (
      categorySlug: string,
      nodes: RecursiveNode[],
      parentPath: string[] = []
    ) => {
      nodes.forEach((subcategory) => {
        const currentPath = [...parentPath, subcategory.slug];
        const currentId = subId(categorySlug, currentPath);
        ids.push(currentId);

        if (isSearchActive || expanded[currentId] || closingRowIds.includes(currentId)) {
          appendVisibleSubcategoryIds(categorySlug, subcategory.subcategories, currentPath);
        }
      });
    };

    filteredCategories.forEach((category) => {
      const categoryNodeId = catId(category.slug);
      ids.push(categoryNodeId);

      if (isSearchActive || expanded[categoryNodeId] || closingRowIds.includes(categoryNodeId)) {
        appendVisibleSubcategoryIds(category.slug, category.subcategories);
      }
    });

    return ids;
  }, [closingRowIds, expanded, filteredCategories, isSearchActive]);

  const selectableVisibleRowIds = useMemo(() => visibleRowIds, [visibleRowIds]);
  const selectedRowIdSet = useMemo(() => new Set(selectedRows), [selectedRows]);

  const selectedVisibleCount = useMemo(
    () => selectableVisibleRowIds.filter((id) => selectedRowIdSet.has(id)).length,
    [selectableVisibleRowIds, selectedRowIdSet]
  );

  const allRowsSelected =
    selectableVisibleRowIds.length > 0 && selectedVisibleCount === selectableVisibleRowIds.length;

  useEffect(() => {
    const validIds = new Set([
      ...catalog.categories.map((category) => catId(category.slug)),
      ...catalog.categories.flatMap((category) => collectSubcategoryIds(category.slug, category.subcategories))
    ]);

    setSelectedRows((current) => current.filter((id) => validIds.has(id)));
  }, [catalog.categories]);

  useEffect(() => {
    if (!selectAllRef.current) return;
    selectAllRef.current.indeterminate = selectedVisibleCount > 0 && !allRowsSelected;
  }, [allRowsSelected, selectedVisibleCount]);

  const toggleSelectAll = () => {
    if (allRowsSelected) {
      const selectableVisibleRowIdSet = new Set(selectableVisibleRowIds);
      setSelectedRows((current) => current.filter((id) => !selectableVisibleRowIdSet.has(id)));
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
    await ensureFullPayloadLoaded();
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
          subcategories: pruneSelectedSubcategoryTree(category.slug, category.subcategories, selectedSet)
        }))
    };

    stageTableCatalog(next);
    setSelectedRows([]);
    setIsBulkDeleting(false);
  };

  const renderTreeRow = useCallback(({
    id,
    title,
    level,
    kind,
    categorySlug,
    subcategoryPath,
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
    subcategoryPath?: string[];
    description: string;
    childrenCount: number;
    productCount: number;
    ancestorContinuationColumns: boolean[];
    continueCurrentColumnBelow: boolean;
    parentIsAnimating?: boolean;
  }) => {
    const resolvedSubcategoryPath = toSubcategoryPath(subcategoryPath);

    const isSelected =
      (selected.kind === 'root' && kind === 'root') ||
      (selected.kind === 'category' && kind === 'category' && selected.categorySlug === categorySlug) ||
      (selected.kind === 'subcategory' &&
        kind === 'subcategory' &&
        selected.categorySlug === categorySlug &&
        pathEquals(selected.subcategoryPath ?? selected.subcategorySlug, resolvedSubcategoryPath));

    const hasChildren = childrenCount > 0;
    const isExpanded = expanded[id] ?? false;
    const isRowEditing = editingRow?.id === id;
    const isChecked = selectedRowSet.has(id);
    const rowDepthTone = getAdminCategoryRowToneClass(level);
    const rowStatus = statusByRow[id] ?? 'active';

    const toggleInlineEdit = async () => {
      await ensureFullPayloadLoaded();
      if (isRowEditing) {
        setEditingRow(null);
        return;
      }

      setEditingRow({
        id,
        kind,
        categorySlug,
        subcategoryPath: resolvedSubcategoryPath,
        subcategorySlug: resolvedSubcategoryPath.at(-1),
        title,
        description,
        status: rowStatus
      });
    };

    const setStatus = async (nextStatus: CategoryStatus) => {
      await ensureFullPayloadLoaded();
      const nextStatuses = { ...statusByRow, [id]: nextStatus };
      stageStatusChange(nextStatuses);
      setEditingRow((prev) => (prev && prev.id === id ? { ...prev, status: nextStatus } : prev));
    };

    const isOpening = parentIsAnimating && openingRowIdSet.size > 0;
    const isClosing = parentIsAnimating && closingRowIdSet.size > 0;

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

    const gutterWidth = level === 0 ? treeButtonDiameter : buttonLeft + treeButtonDiameter;

    return (
      (() => {
        const isDragDisabled = kind === 'root' || (kind === 'subcategory' && resolvedSubcategoryPath.length > 1);

        const row = ({
          dragHandleProps,
          setNodeRef,
          style,
          isDragging
        }: {
          dragHandleProps: Record<string, unknown>;
          setNodeRef?: (node: HTMLElement | null) => void;
          style?: CSSProperties;
          isDragging: boolean;
        }) => (
          <tr
            key={id}
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
                  id={`category-select-${id}`}
                  name={`categorySelect-${id}`}
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
                  {ancestorContinuationColumns.map((shouldContinue, ancestorIndex) => {
                    if (!shouldContinue) return null;

                    const ancestorX = ancestorIndex * treeIndent + treeButtonRadius;

                    return (
                      <span
                        key={`ancestor-${ancestorIndex}`}
                        className="absolute z-0 w-px bg-slate-300/90"
                        style={{
                          left: `${ancestorX}px`,
                          top: `-${treeConnectorBleed}px`,
                          height: `${treeRowHeight + treeConnectorBleed * 2}px`
                        }}
                      />
                    );
                  })}

                  {hasChildren && isExpanded ? (
                    <span
                      className="absolute z-0 w-px bg-slate-300/90"
                      style={{
                        left: `${buttonCenterX}px`,
                        top: `${treeHalfRowHeight + treeExpandButtonHalf}px`,
                        height: `${treeHalfRowHeight - treeExpandButtonHalf + treeConnectorBleed}px`
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
                          width: `${hasChildren ? buttonLeft + treeExpandButtonInset - parentColumnX : leafConnectorWidth}px`
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
                      <button
                        type="button"
                        aria-label="Razširi/skrij"
                        onPointerDown={(event) => event.stopPropagation()}
                        onClick={() => toggleExpanded(id)}
                        className="inline-grid h-4 w-4 place-items-center rounded-[2px] border border-slate-300 text-slate-600"
                      >
                        {isExpanded ? (
                          <svg viewBox="0 0 16 16" className="h-2.5 w-2.5" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
                            <path d="M3 8h10" />
                          </svg>
                        ) : (
                          <svg viewBox="0 0 16 16" className="h-2.5 w-2.5" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
                            <path d="M3 8h10M8 3v10" />
                          </svg>
                        )}
                      </button>
                    </div>
                  ) : null}
                </div>

                <div className="min-w-0 flex-1">
                  {isRowEditing ? (
                    <Input
                      id={`category-title-${id}`}
                      name={`categoryTitle-${id}`}
                      value={editingRow.title}
                      onChange={(event: ChangeEvent<HTMLInputElement>) =>
                        setEditingRow((prev) => (prev ? { ...prev, title: event.target.value } : prev))
                      }
                      data-inline-edit-field="true"
                      onBlur={handleInlineBlur}
                      className="h-7 min-w-[10ch] max-w-[34ch] truncate whitespace-nowrap px-2 text-[11px] font-semibold text-slate-500"
                      style={{ width: `${Math.min(34, Math.max(10, editingRow.title.length + 2))}ch` }}
                      autoFocus
                    />
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        if (kind === 'root') setSelected({ kind: 'root' });
                        if (kind === 'category' && categorySlug) setSelected({ kind: 'category', categorySlug });
                        if (kind === 'subcategory' && categorySlug) {
                          setSelected({
                            kind: 'subcategory',
                            categorySlug,
                            subcategoryPath: resolvedSubcategoryPath,
                            subcategorySlug: resolvedSubcategoryPath.at(-1)
                          });
                        }
                      }}
                      onPointerDown={(event) => event.stopPropagation()}
                      className="block w-full truncate whitespace-nowrap text-left text-[11px] font-semibold text-slate-500"
                      title={title}
                    >
                      {title}
                    </button>
                  )}
                </div>
              </div>
            </td>

            <td className="border-b border-slate-200 px-2.5 py-2 text-[11px] font-normal text-slate-500">
              {isRowEditing ? (
                <Input
                  id={`category-description-${id}`}
                  name={`categoryDescription-${id}`}
                  value={editingRow.description}
                  onChange={(event: ChangeEvent<HTMLInputElement>) =>
                    setEditingRow((prev) => (prev ? { ...prev, description: event.target.value } : prev))
                  }
                  data-inline-edit-field="true"
                  onBlur={handleInlineBlur}
                  className="h-7 min-w-[18ch] max-w-[64ch] truncate whitespace-nowrap px-2 text-[11px] font-normal text-slate-500"
                  style={{ width: `${Math.min(64, Math.max(18, editingRow.description.length + 2))}ch` }}
                />
              ) : (
                <div className="truncate whitespace-nowrap" title={description || '—'}>
                  {description || '—'}
                </div>
              )}
            </td>

            <td className="border-b border-slate-200 px-3 py-2 text-center text-[11px] text-slate-600">{childrenCount}</td>
            <td className="border-b border-slate-200 px-3 py-2 text-center text-[11px] text-slate-600">{productCount}</td>

            <td className="border-b border-slate-200 px-3 py-2 text-center text-[11px]">
              {kind === 'root' ? (
                <span className="text-xs text-slate-400">—</span>
              ) : (
                <InlineStatusToggle
                  checked={rowStatus === 'active'}
                  ariaLabel={rowStatus === 'active' ? `Skrij ${title}` : `Prikaži ${title}`}
                  onToggle={() => setStatus(rowStatus === 'active' ? 'inactive' : 'active')}
                />
              )}
            </td>

            <td className="border-b border-slate-200 px-3 py-2 text-center">
              <RowActions>
                <RowActionsDropdown
                  label={`Možnosti za ${title}`}
                  items={[
                    {
                      key: 'edit',
                      label: 'Uredi',
                      icon: <PencilIcon />,
                      onSelect: toggleInlineEdit
                    },
                    {
                      key: 'add',
                      label: 'Dodaj',
                      icon: <PlusIcon />,
                      onSelect: () => {
                        if (kind === 'root') {
                          openCreateDialog({ kind: 'category' });
                          return;
                        }

                        if (kind === 'category' && categorySlug) {
                          openCreateDialog({ kind: 'subcategory', categorySlug, parentPath: [] });
                          return;
                        }

                        if (kind === 'subcategory' && categorySlug) {
                          openCreateDialog({
                            kind: 'subcategory',
                            categorySlug,
                            parentPath: resolvedSubcategoryPath
                          });
                        }
                      }
                    },
                    {
                      key: 'delete',
                      label: 'Izbriši',
                      icon: <TrashCanIcon />,
                      className: 'text-[rgb(192,64,46)]',
                      onSelect: () => {
                        if (kind === 'root') {
                          stageTableCatalog({ categories: [] });
                          setSelected({ kind: 'root' });
                          return;
                        }

                        if (kind === 'category' && categorySlug) {
                          stageTableCatalog({
                            categories: catalog.categories.filter((entry) => entry.slug !== categorySlug)
                          });
                          setSelected({ kind: 'root' });
                          return;
                        }

                        if (kind === 'subcategory' && categorySlug) {
                          stageTableCatalog({
                            categories: catalog.categories.map((entry) =>
                              entry.slug === categorySlug
                                ? {
                                    ...entry,
                                    subcategories: removeSubcategoryTree(entry.subcategories, resolvedSubcategoryPath)
                                  }
                                : entry
                            )
                          });
                          setSelected({ kind: 'category', categorySlug });
                        }
                      }
                    }
                  ]}
                />
              </RowActions>
            </td>
          </tr>
        );

        if (isDragDisabled) {
          return row({ dragHandleProps: {}, isDragging: false });
        }

        return (
          <SortableTreeRow
            key={id}
            id={id}
            disabled={false}
          >
            {({ dragHandleProps, setNodeRef, style, isDragging }) =>
              row({ dragHandleProps, setNodeRef, style, isDragging })}
          </SortableTreeRow>
        );
      })()
    );
  }, [
    catalog.categories,
    closingRowIdSet,
    editingRow,
    expanded,
    getDescendantIds,
    handleInlineBlur,
    openingRowIdSet,
    selected,
    selectedRowSet,
    stageTableCatalog,
    stageStatusChange,
    statusByRow,
    toggleExpanded
  ]);

  const buildSubcategoryRows = useCallback((
    category: RecursiveCatalogCategory,
    nodes: RecursiveNode[],
    level: number,
    parentPath: string[] = [],
    ancestorContinuationColumns: boolean[] = []
  ): ReactNode[] => {
    const rows: ReactNode[] = [];

    nodes.forEach((subcategory, index) => {
      const currentPath = [...parentPath, subcategory.slug];
      const currentId = subId(category.slug, currentPath);
      const isLastSibling = index === nodes.length - 1;
      const isExpandedHere =
        isSearchActive || expanded[currentId] || closingRowIdSet.has(currentId);
      const hasVisibleChildren = isExpandedHere && subcategory.subcategories.length > 0;

      rows.push(
        renderTreeRow({
          id: currentId,
          title: subcategory.title,
          level,
          kind: 'subcategory',
          categorySlug: category.slug,
          subcategoryPath: currentPath,
          description: subcategory.description,
          childrenCount: subcategory.subcategories.length,
          productCount: subcategory.items.length,
          ancestorContinuationColumns,
          continueCurrentColumnBelow: !isLastSibling,
          parentIsAnimating: openingRowIdSet.has(currentId) || closingRowIdSet.has(currentId)
        })
      );

      if (hasVisibleChildren) {
        rows.push(
          ...buildSubcategoryRows(
            category,
            subcategory.subcategories,
            level + 1,
            currentPath,
            [...ancestorContinuationColumns, !isLastSibling]
          )
        );
      }
    });

    return rows;
  }, [closingRowIdSet, expanded, isSearchActive, openingRowIdSet, renderTreeRow]);

  const treeRows = useMemo<ReactNode[]>(() => {
    if (activeView !== 'table') return [];
    const rows: ReactNode[] = [];
    const isRootExpanded = isSearchActive || (expanded[rootId] ?? true) || closingRowIdSet.has(rootId);

    rows.push(
      renderTreeRow({
        id: rootId,
        title: 'Vse kategorije',
        level: 0,
        kind: 'root',
        description: 'Pogled vseh kategorij',
        childrenCount: catalog.categories.length,
        productCount: 0,
        ancestorContinuationColumns: [],
        continueCurrentColumnBelow: isRootExpanded && filteredCategories.length > 0,
        parentIsAnimating: false
      })
    );

    if (!isRootExpanded) {
      return rows;
    }

    filteredCategories.forEach((category, categoryIndex) => {
      const categoryNodeId = catId(category.slug);
      const isCategoryExpanded =
        isSearchActive || (expanded[categoryNodeId] ?? false) || closingRowIdSet.has(categoryNodeId);
      const hasVisibleChildren = isCategoryExpanded && category.subcategories.length > 0;
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
          ancestorContinuationColumns: [],
          continueCurrentColumnBelow: hasVisibleChildren || hasNextCategory,
          parentIsAnimating: openingRowIdSet.has(rootId) || closingRowIdSet.has(rootId)
        })
      );

      if (isCategoryExpanded) {
        rows.push(
          ...buildSubcategoryRows(
          category,
          category.subcategories,
          2,
          [],
          [hasNextCategory]
        )
        );
      }
    });

    return rows;
  }, [
    activeView,
    buildSubcategoryRows,
    catalog.categories.length,
    closingRowIdSet,
    expanded,
    filteredCategories,
    isSearchActive,
    openingRowIdSet,
    renderTreeRow
  ]);


  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl font-semibold text-slate-900">Kategorije</h1>
        <p className="mt-1 text-sm text-slate-600">
          Top: povezano drevo levo → desno. Bottom: vsebina izbrane kategorije v storefront admin pogledu.
        </p>
      </header>

      <EuiTabs
        value={activeView}
        onChange={(next) => {
          const nextView = next as CategoriesView;
          setActiveView(nextView);
          guardedNavigate(
            nextView === 'table'
              ? '/admin/kategorije'
              : nextView === 'preview'
                ? '/admin/kategorije/predogled'
                : '/admin/kategorije/miller-view'
          );
        }}
        tabs={[
          { value: 'table', label: 'Osnovno' },
          { value: 'preview', label: 'Predogled' },
          { value: 'miller', label: 'Po stolpcih' }
        ]}
      />

      {isBulkDeleteDialogOpen ? <LazyConfirmDialog
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
      /> : null}

      {warningDialog !== null ? <LazyConfirmDialog
        open={warningDialog !== null}
        title={warningDialog?.title ?? 'Opozorilo'}
        description={warningDialog?.description}
        confirmLabel="V redu"
        onCancel={() => setWarningDialog(null)}
        onConfirm={() => setWarningDialog(null)}
      /> : null}

      {isUnsavedLeaveDialogOpen ? <LazyConfirmDialog
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
      /> : null}

      {imageDeleteTarget !== null ? <LazyConfirmDialog
        open={imageDeleteTarget !== null}
        title="Odstrani sliko"
        description="Ali ste prepričani, da želite odstraniti sliko?"
        confirmLabel="Odstrani"
        cancelLabel="Prekliči"
        isDanger
        onCancel={() => setImageDeleteTarget(null)}
        onConfirm={confirmDeleteImage}
      /> : null}

      {createTarget !== null ? <LazyConfirmDialog
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
            id="create-category-name"
            name="createCategoryName"
            value={createName}
            onChange={(event: ChangeEvent<HTMLInputElement>) => setCreateName(event.target.value)}
            placeholder="Ime kategorije"
            className="h-9 w-full rounded-xl px-3 text-sm"
            autoFocus
          />
        </div>
      </LazyConfirmDialog> : null}

      {loading ? (
        <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-600">
          Nalaganje podatkov kategorij …
        </div>
      ) : null}

      {activeView === 'table' ? (
        <AdminCategoriesTableView
          activeView={activeView}
          query={query}
          onQueryChange={setQuery}
          onBulkDelete={handleBulkDelete}
          selectedRows={selectedRows}
          isBulkDeleting={isBulkDeleting}
          onRequestSave={() => {
            const summary = summarizeCatalogChanges(persistedTableRef.current, catalog, persistedStatusRef.current, statusByRow);
            setTableSaveSummary(summary);
            setIsTableSaveDialogOpen(true);
          }}
          tableDirty={tableDirty}
          saving={saving}
          canUndoStagedChanges={canUndoStagedChanges}
          onUndo={() => {
            undoStagedChanges();
          }}
          canRestoreCommittedHistory={canRestoreCommittedHistory}
          hasPendingStagedChanges={hasPendingStagedChanges}
          onRestore={() => {
            restoreCommittedHistory();
          }}
          sensors={sensors}
          onTreeDragEnd={onTreeDragEnd}
          visibleRowIds={visibleRowIds}
          selectAllRef={selectAllRef}
          allRowsSelected={allRowsSelected}
          onToggleSelectAll={toggleSelectAll}
          allExpanded={areAllRowsExpanded}
          onToggleAllExpanded={toggleAllExpanded}
          statusHeaderMenuRef={statusHeaderMenuRef}
          onToggleStatusHeaderMenu={() => {
            if (selectedRows.length === 0) return;
            setIsStatusHeaderMenuOpen((previousOpen) => !previousOpen);
          }}
          isStatusHeaderMenuOpen={isStatusHeaderMenuOpen}
          statusByRow={statusByRow}
          onStageStatusChange={(nextStatuses) => {
            stageStatusChange(nextStatuses);
            setIsStatusHeaderMenuOpen(false);
          }}
          treeRows={treeRows}
          sortState={tableSort}
          onSort={(key) => {
            setTableSort((current) => (
              current.key === key
                ? { key, direction: current.direction === 'asc' ? 'desc' : 'asc' }
                : { key, direction: key === 'category' ? 'asc' : 'desc' }
            ));
          }}
        />
      ) : null}

      {activeView === 'preview' ? (
        <AdminCategoriesPreview
        activeView={activeView}
        tableError={tableError}
        lowerViewCount={lowerViewCount}
        onLowerViewCountChange={setLowerViewCount}
        onRequestSave={() => {
          const summary = summarizeCatalogChanges(persistedTableRef.current, catalog, persistedStatusRef.current, statusByRow);
          setTableSaveSummary(summary);
          setIsTableSaveDialogOpen(true);
        }}
        canNavigateUp={selected.kind !== 'root'}
        onNavigateUp={navigatePreviewUp}
        tableDirty={tableDirty}
        saving={saving}
        selectedContext={selectedContext}
        visibleContent={visibleContent}
        onBottomReorder={onBottomReorder}
        renderSortableItem={(id, children) => (
          <SortableItem key={id} id={id}>
            {({ dragHandleProps, setNodeRef, style }) => children({ dragHandleProps, setNodeRef, style })}
          </SortableItem>
        )}
        uploadRefs={uploadRefs}
        onSetImageDeleteTarget={setImageDeleteTarget}
        onImageUpload={onImageUpload}
        onLeafProductsDragEnd={onLeafProductsDragEnd}
        sortCatalogItems={sortCatalogItems}
        editingRow={editingRow}
        onStartEdit={startPreviewTitleEdit}
        onEditingRowTitleChange={(value) => setEditingRow((prev) => (prev ? { ...prev, title: value } : prev))}
        onEditingRowDescriptionChange={(value) => setEditingRow((prev) => (prev ? { ...prev, description: value } : prev))}
        onCommitEdit={() => saveInlineEditRef.current()}
        onCancelEdit={() => setEditingRow(null)}
        onOpenNode={openPreviewNode}
        onStageStatusChange={(rowId, status) => stageStatusChange({ ...statusByRow, [rowId]: status })}
        onRequestCreateCategory={() => openCreateDialog({ kind: 'category' })}
        />
      ) : null}

      {isTableSaveDialogOpen ? <LazyConfirmDialog
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
      </LazyConfirmDialog> : null}

      {millerDeleteTarget !== null ? <LazyConfirmDialog
        open={millerDeleteTarget !== null}
        title="Izbriši izbrane vnose"
        description="Ali ste prepričani, da želite izbrisati izbrane vnose v tem stolpcu?"
        confirmLabel="Izbriši"
        cancelLabel="Prekliči"
        isDanger
        onCancel={() => setMillerDeleteTarget(null)}
        onConfirm={confirmMillerDelete}
      /> : null}

      {isMillerSaveDialogOpen ? <LazyConfirmDialog
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
      </LazyConfirmDialog> : null}

      {activeView === 'miller' ? (
        <AdminCategoriesMiller
        activeView={activeView}
        millerDirty={millerDirty}
        breadcrumbs={millerBreadcrumbs}
        searchQuery={millerSearchQuery}
        onSearchQueryChange={setMillerSearchQuery}
        activeColumnKind={activeMillerColumnKind}
        onRequestSave={() => {
          const summary = summarizeCatalogChanges(persistedMillerRef.current, millerCatalog, persistedStatusRef.current, statusByRow);
          setMillerSaveSummary(summary);
          setIsMillerSaveDialogOpen(true);
        }}
        saving={saving}
        canUndoStagedChanges={canUndoStagedChanges}
        onUndo={() => {
          undoStagedChanges();
        }}
        canRestoreCommittedHistory={canRestoreCommittedHistory}
        hasPendingStagedChanges={hasPendingStagedChanges}
        onRestore={() => {
          restoreCommittedHistory();
        }}
        millerError={millerError}
        millerViewportRef={millerViewportRef}
        onSelectIds={(ids) => setMillerSelection(ids)}
        millerColumns={millerColumns}
        plusIcon={<PlusIcon />}
        onAddNode={addMillerNode}
        onRequestDelete={requestDeleteMillerSelection}
        millerSelection={millerSelection}
        millerDropTarget={millerDropTarget}
        rootId={rootId}
        setMillerDropTarget={setMillerDropTarget}
        applyMillerMove={applyMillerMove}
        millerRename={millerRename}
        setMillerRename={setMillerRename}
        applyMillerRename={applyMillerRename}
        />
      ) : null}


    </div>
  );
}
