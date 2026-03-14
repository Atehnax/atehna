'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent, type FocusEvent, type ReactNode, type CSSProperties } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Image from 'next/image';
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent
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
import { FloatingInput, FloatingTextarea } from '@/shared/ui/floating-field';
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

type CatalogData = { categories: CatalogCategory[] };

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

type CategoryStatus = 'active' | 'inactive';

const bulkDeleteButtonClass = buttonTokenClasses.danger;
const CATEGORY_STATUS_STORAGE_KEY = 'admin-categories-status-v1';
const rootId = 'root';
const catId = (slug: string) => `cat:${slug}`;
const subId = (catSlug: string, subSlug: string) => `sub:${catSlug}:${subSlug}`;
const slugify = (value: string) =>
  value.toLowerCase().trim().replace(/\s+/g, '-').replace(/[^a-z0-9-čšžćđ]/gi, '');

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

function DragModeIcon() {
  return (
    <svg viewBox="0 0 20 20" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
      <path d="M7 4.5h6M7 10h6M7 15.5h6" />
      <circle cx="4.5" cy="4.5" r="1" fill="currentColor" stroke="none" />
      <circle cx="4.5" cy="10" r="1" fill="currentColor" stroke="none" />
      <circle cx="4.5" cy="15.5" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}

type CategoriesView = 'table' | 'miller';

export default function AdminCategoriesManager({ initialView = 'table' }: { initialView?: CategoriesView }) {
  const [catalog, setCatalog] = useState<CatalogData>({ categories: [] });
  const [selected, setSelected] = useState<SelectedNode>({ kind: 'root' });
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [editingRow, setEditingRow] = useState<EditingRowDraft | null>(null);
  const [statusByRow, setStatusByRow] = useState<Record<string, CategoryStatus>>({});
  const [openStatusMenuRowId, setOpenStatusMenuRowId] = useState<string | null>(null);
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
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isDragModeActive, setIsDragModeActive] = useState(false);
  const [itemMoveTargets, setItemMoveTargets] = useState<Record<string, string>>({});

  const { toast } = useToast();
  const toastRef = useRef(toast);
  const pathname = usePathname();
  const router = useRouter();
  const [activeView, setActiveView] = useState<CategoriesView>(initialView);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));
  const uploadRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const statusMenuRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const statusHeaderMenuRef = useRef<HTMLDivElement>(null);
  const selectAllRef = useRef<HTMLInputElement>(null);
  const isInlineSavingRef = useRef(false);
  const catalogRef = useRef<CatalogData>({ categories: [] });
  const persistQueueRef = useRef(Promise.resolve(true));

  const load = useCallback(async () => {
    setLoading(true);
    const response = await fetch('/api/admin/categories', { cache: 'no-store' });

    if (!response.ok) {
      toastRef.current.error('Napaka pri nalaganju kategorij');
      setLoading(false);
      return;
    }

    const payload = (await response.json()) as CatalogData;

    setCatalog(payload);
    catalogRef.current = payload;
    setExpanded((prev) => ({
      ...prev,
      ...Object.fromEntries(payload.categories.map((entry) => [catId(entry.slug), false]))
    }));

    setStatusByRow((prev) => {
      const next = { ...prev };

      payload.categories.forEach((category) => {
        const categoryId = catId(category.slug);
        if (!next[categoryId]) next[categoryId] = 'active';

        category.subcategories.forEach((subcategory) => {
          const subcategoryId = subId(category.slug, subcategory.slug);
          if (!next[subcategoryId]) next[subcategoryId] = 'active';
        });
      });
      return next;
    });

    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    toastRef.current = toast;
  }, [toast]);

  useEffect(() => {
    catalogRef.current = catalog;
  }, [catalog]);

  useEffect(() => {
    setActiveView(pathname?.endsWith('/miller-view') ? 'miller' : 'table');
  }, [pathname]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    try {
      const raw = window.localStorage.getItem(CATEGORY_STATUS_STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as Record<string, CategoryStatus>;
      setStatusByRow(parsed);
    } catch {
      // no-op
    }
  }, []);

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

  const persist = async (next: CatalogData, message = 'Shranjeno') => {
    setCatalog(next);
    catalogRef.current = next;

    const runPersist = async () => {
      setSaving(true);

      try {
        const response = await fetch('/api/admin/categories', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(next)
        });

        if (!response.ok) {
          toast.error('Shranjevanje ni uspelo');
          await load();
          return false;
        }

        toast.success(message);
        return true;
      } catch {
        toast.error('Shranjevanje ni uspelo');
        await load();
        return false;
      } finally {
        setSaving(false);
      }
    };

    persistQueueRef.current = persistQueueRef.current.then(runPersist, runPersist);
    return persistQueueRef.current;
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

  const addCategory = (title: string, afterSlug?: string) => {
    const slug = slugify(title);
    if (!slug) return;

    const item: CatalogCategory = {
      slug,
      title,
      summary: title,
      description: '',
      image: '',
      subcategories: [],
      items: []
    };

    const list = [...catalog.categories];

    if (!afterSlug) {
      list.push(item);
    } else {
      const index = list.findIndex((entry) => entry.slug === afterSlug);
      if (index < 0) list.push(item);
      else list.splice(index + 1, 0, item);
    }

    setExpanded((prev) => ({ ...prev, [catId(slug)]: true }));
    void persist({ categories: list }, 'Kategorija dodana');
  };

  const addSubcategory = (categorySlug: string, title: string, afterSlug?: string) => {
    const slug = slugify(title);
    if (!slug) return;

    const next = {
      categories: catalog.categories.map((entry) => {
        if (entry.slug !== categorySlug) return entry;

        const sub: CatalogSubcategory = {
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
    void persist(next, 'Podkategorija dodana');
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

      void persist({ categories: arrayMove(catalog.categories, oldIndex, newIndex) }, 'Vrstni red kategorij posodobljen');
      return;
    }

    if (!activeId.startsWith('sub:')) return;

    const [, activeCategorySlug, activeSubSlug] = activeId.split(':');
    const sourceCategory = catalog.categories.find((entry) => entry.slug === activeCategorySlug);
    if (!sourceCategory) return;
    const movingSubcategory = sourceCategory.subcategories.find((entry) => entry.slug === activeSubSlug);
    if (!movingSubcategory) return;

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
      void persist({ categories: nextCategories }, 'Podkategorija premaknjena');
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

      void persist({ categories: nextCategories }, 'Vrstni red podkategorij posodobljen');
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
    void persist({ categories: nextCategories }, 'Podkategorija premaknjena');
  };

  const onBottomReorder = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    if (selected.kind === 'root') {
      const oldIndex = catalog.categories.findIndex((entry) => entry.slug === active.id);
      const newIndex = catalog.categories.findIndex((entry) => entry.slug === over.id);
      if (oldIndex < 0 || newIndex < 0) return;

      void persist(
        { categories: arrayMove(catalog.categories, oldIndex, newIndex) },
        'Vrstni red kategorij posodobljen'
      );
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

    void persist(next, 'Vrstni red podkategorij posodobljen');
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

      void persist(
        {
          categories: catalog.categories.map((entry) =>
            entry.slug === selectedContext.category.slug ? { ...entry, items: reordered } : entry
          )
        },
        'Vrstni red izdelkov shranjen'
      );
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

    void persist(next, 'Vrstni red izdelkov shranjen');
  };

  const updateSubcategory = (categorySlug: string, subSlug: string, patch: Partial<CatalogSubcategory>) => {
    void persist({
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
      void persist(
        { categories: catalog.categories.map((entry) => (entry.slug === item.id ? { ...entry, image: dataUrl } : entry)) },
        'Slika shranjena'
      );
      return;
    }

    if (!categorySlug) return;
    updateSubcategory(categorySlug, item.id, { image: dataUrl });
  };

  const confirmDeleteNode = () => {
    if (!deleteTarget) return;

    if (deleteTarget.kind === 'root') {
      setDeletingRowId(rootId);
      setDeleteTarget(null);
      setSelected({ kind: 'root' });

      void persist({ categories: [] }, 'Vse kategorije izbrisane').finally(() => {
        setDeletingRowId(null);
      });

      return;
    }

    const currentDeleteId =
      deleteTarget.kind === 'category'
        ? catId(deleteTarget.categorySlug)
        : subId(deleteTarget.categorySlug, deleteTarget.subcategorySlug ?? '');

    setDeletingRowId(currentDeleteId);

    if (deleteTarget.kind === 'category') {
      setDeleteTarget(null);
      setSelected({ kind: 'root' });

      void persist(
        { categories: catalog.categories.filter((entry) => entry.slug !== deleteTarget.categorySlug) },
        'Kategorija izbrisana'
      ).finally(() => {
        setDeletingRowId(null);
      });

      return;
    }

    setDeleteTarget(null);
    setSelected({ kind: 'category', categorySlug: deleteTarget.categorySlug });

    void persist(
      {
        categories: catalog.categories.map((entry) =>
          entry.slug === deleteTarget.categorySlug
            ? {
                ...entry,
                subcategories: entry.subcategories.filter(
                  (sub) => sub.slug !== deleteTarget.subcategorySlug
                )
              }
            : entry
        )
      },
      'Podkategorija izbrisana'
    ).finally(() => {
      setDeletingRowId(null);
    });
  };

  const confirmDeleteImage = () => {
    if (!imageDeleteTarget) return;

    if (imageDeleteTarget.kind === 'category') {
      void persist(
        {
          categories: catalog.categories.map((entry) =>
            entry.slug === imageDeleteTarget.categorySlug ? { ...entry, image: '' } : entry
          )
        },
        'Slika odstranjena'
      );
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

  const saveInlineEdit = async () => {
    if (!editingRow) return;
    if (isInlineSavingRef.current) return;

    isInlineSavingRef.current = true;
    const nextTitle = editingRow.title.trim();

    if (!nextTitle) {
      toast.error('Naziv je obvezen');
      isInlineSavingRef.current = false;
      return;
    }

    if (editingRow.kind === 'category') {
      if (!editingRow.categorySlug) {
        isInlineSavingRef.current = false;
        return;
      }

      const next = {
        categories: catalog.categories.map((entry) =>
          entry.slug === editingRow.categorySlug
            ? { ...entry, title: nextTitle, summary: editingRow.description }
            : entry
        )
      };

      const ok = await persist(next, 'Shranjeno');
      if (ok) {
        setStatusByRow((prev) => ({ ...prev, [editingRow.id]: editingRow.status }));
        setEditingRow(null);
      }

      isInlineSavingRef.current = false;
      return;
    }

    if (!editingRow.categorySlug || !editingRow.subcategorySlug) {
      isInlineSavingRef.current = false;
      return;
    }

    const next = {
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
    };

    const ok = await persist(next, 'Shranjeno');
    if (ok) {
      setStatusByRow((prev) => ({ ...prev, [editingRow.id]: editingRow.status }));
      setEditingRow(null);
    }

    isInlineSavingRef.current = false;
  };

  const handleInlineBlur = (_event: FocusEvent<HTMLInputElement>) => {};

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

    const ok = await persist(next, 'Izbrisano');
    if (ok) {
      setSelectedRows([]);
    }

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
      setEditingRow((prev) => (prev && prev.id === id ? { ...prev, status: nextStatus } : prev));
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
      <SortableTreeRow id={id} disabled={kind === 'root' || !isDragModeActive}>
        {({ dragHandleProps, setNodeRef, style, isDragging }) => (
      <tr
        ref={setNodeRef}
        style={style}
        className={`${isSelected ? adminTableRowToneClasses.selected : rowDepthTone} transition-[background-color,opacity,transform] duration-150 ${adminTableRowToneClasses.hover} ${isClosing ? 'opacity-80 translate-y-[-1px]' : 'translate-y-0'} ${isOpening ? 'opacity-100' : ''} ${isDragging ? 'opacity-70' : ''} ${isDragModeActive && kind !== 'root' ? 'cursor-grab active:cursor-grabbing select-none' : ''}`}
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
              className="h-8 min-w-[12ch] max-w-[42ch] truncate whitespace-nowrap px-2 text-xs font-normal text-slate-500"
              style={{ width: `${Math.min(42, Math.max(12, editingRow.description.length + 2))}ch` }}
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
                onClick={() => setOpenStatusMenuRowId((prev) => (prev === id ? null : id))}
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
                <MenuPanel className="absolute left-1/2 top-8 z-20 w-36 -translate-x-1/2">
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
            <IconButton type="button" tone="neutral" onClick={toggleInlineEdit} aria-label="Uredi" title="Uredi">
              <svg viewBox="0 0 20 20" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                <path d="M4 14.5l.5-3L13.5 2.5l3 3L7.5 14.5z" />
                <path d="M11.5 4.5l3 3" />
              </svg>
            </IconButton>

            <IconButton
              type="button"
              tone="neutral"
              aria-label="Shrani"
              title="Shrani"
              onClick={() => void saveInlineEdit()}
              disabled={!isRowEditing}
            >
              <SaveIcon />
            </IconButton>

            <IconButton
              type="button"
              tone="neutral"
              aria-label="Dodaj podkategorijo"
              title="Dodaj podkategorijo"
              onClick={() => {
                if (kind === 'root') openCreateDialog({ kind: 'category' });
                if (kind === 'category' && categorySlug) openCreateDialog({ kind: 'subcategory', categorySlug });
                if (kind === 'subcategory' && categorySlug && subcategorySlug) {
                  openCreateDialog({ kind: 'subcategory', categorySlug, afterSlug: subcategorySlug });
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
              disabled={deletingRowId === id}
              onClick={() => {
                if (kind === 'root') {
                  setDeleteTarget({ kind: 'root' });
                  return;
                }
                if (kind === 'category' && categorySlug) {
                  const categoryId = catId(categorySlug);
                  const descendants = getDescendantIds(categoryId);
                  const selectedSet = new Set(selectedRows);

                  if (selectedSet.has(categoryId) && descendants.some((descendantId) => !selectedSet.has(descendantId))) {
                    showDeleteSelectionWarning();
                    return;
                  }

                  setDeleteTarget({ kind: 'category', categorySlug });
                  return;
                }
                if (kind === 'subcategory' && categorySlug && subcategorySlug) {
                  setDeleteTarget({ kind: 'subcategory', categorySlug, subcategorySlug });
                }
              }}
            >
              {deletingRowId === id ? <Spinner size="sm" className="text-[var(--danger-600)]" /> : '×'}
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
            level: 0,
            kind: 'category',
            categorySlug: category.slug,
            description: category.summary,
            childrenCount: category.subcategories.length,
            productCount: (category.items ?? []).length,
            ancestorContinuationColumns: [],
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
                level: 1,
                kind: 'subcategory',
                categorySlug: category.slug,
                subcategorySlug: subcategory.slug,
                description: subcategory.description,
                childrenCount: 0,
                productCount: subcategory.items.length,
                ancestorContinuationColumns: [hasNextCategory],
                continueCurrentColumnBelow: hasNextSubcategory,
                parentIsAnimating: openingRowIds.includes(categoryNodeId) || closingRowIds.includes(categoryNodeId)
              })
            );
          });
        }
      });

    return rows;
  })();


  const millerCategory = selected.kind === 'root'
    ? null
    : catalog.categories.find((entry) => entry.slug === selected.categorySlug) ?? null;

  const millerSubcategory =
    selected.kind === 'subcategory' && millerCategory
      ? millerCategory.subcategories.find((entry) => entry.slug === selected.subcategorySlug) ?? null
      : null;

  const millerColumns: Array<{ key: string; title: string; entries: Array<{ id: string; label: string; meta?: string; onClick: () => void; selected: boolean }> }> = [
    {
      key: 'categories',
      title: 'Kategorije',
      entries: catalog.categories.map((category) => ({
        id: category.slug,
        label: category.title,
        meta: `${category.subcategories.length} podkategorij · ${(category.items ?? []).length} izdelkov`,
        selected: selected.kind !== 'root' && selected.categorySlug === category.slug,
        onClick: () => setSelected({ kind: 'category', categorySlug: category.slug })
      }))
    }
  ];

  if (millerCategory) {
    millerColumns.push({
      key: `children-${millerCategory.slug}`,
      title: millerCategory.title,
      entries: [
        ...millerCategory.subcategories.map((subcategory) => ({
          id: `sub-${subcategory.slug}`,
          label: subcategory.title,
          meta: `${subcategory.items.length} izdelkov`,
          selected: selected.kind === 'subcategory' && selected.subcategorySlug === subcategory.slug,
          onClick: () =>
            setSelected({ kind: 'subcategory', categorySlug: millerCategory.slug, subcategorySlug: subcategory.slug })
        })),
        ...sortCatalogItems(millerCategory.items ?? []).map((item) => ({
          id: `item-cat-${item.slug}`,
          label: item.name,
          meta: 'izdelek',
          selected: false,
          onClick: () => undefined
        }))
      ]
    });
  }

  if (millerSubcategory && millerCategory) {
    millerColumns.push({
      key: `items-${millerSubcategory.slug}`,
      title: millerSubcategory.title,
      entries: sortCatalogItems(millerSubcategory.items).map((item) => ({
        id: `item-sub-${item.slug}`,
        label: item.name,
        meta: 'izdelek',
        selected: false,
        onClick: () => undefined
      }))
    });
  }

  const moveCategory = async (categorySlug: string, targetSlug: string) => {
    const fromIndex = catalog.categories.findIndex((entry) => entry.slug === categorySlug);
    const toIndex = catalog.categories.findIndex((entry) => entry.slug === targetSlug);
    if (fromIndex < 0 || toIndex < 0 || fromIndex === toIndex) return;
    await persist({ categories: arrayMove(catalog.categories, fromIndex, toIndex) }, 'Kategorija premaknjena');
  };

  const moveSelectedSubcategory = async (targetCategorySlug: string) => {
    if (selected.kind !== 'subcategory') return;
    if (selected.categorySlug === targetCategorySlug) return;
    const sourceCategory = catalog.categories.find((entry) => entry.slug === selected.categorySlug);
    const subcategory = sourceCategory?.subcategories.find((entry) => entry.slug === selected.subcategorySlug);
    if (!sourceCategory || !subcategory) return;

    const next = {
      categories: catalog.categories.map((entry) => {
        if (entry.slug === sourceCategory.slug) {
          return { ...entry, subcategories: entry.subcategories.filter((node) => node.slug !== subcategory.slug) };
        }
        if (entry.slug === targetCategorySlug) {
          return { ...entry, subcategories: [...entry.subcategories, subcategory] };
        }
        return entry;
      })
    };

    const ok = await persist(next, 'Podkategorija premaknjena');
    if (ok) {
      setSelected({ kind: 'subcategory', categorySlug: targetCategorySlug, subcategorySlug: subcategory.slug });
    }
  };
  const moveItemToDestination = async (
    itemSlug: string,
    source: { categorySlug: string; subcategorySlug?: string },
    destination: string
  ) => {
    if (!destination) return;
    const [targetCategorySlug, targetSubcategorySlug] = destination.split('/');
    if (source.categorySlug === targetCategorySlug && (source.subcategorySlug ?? '') === (targetSubcategorySlug ?? '')) return;

    let movingItem: CatalogItem | null = null;

    const stripped = catalog.categories.map((category) => {
      if (category.slug !== source.categorySlug) return category;

      if (!source.subcategorySlug) {
        const items = category.items ?? [];
        movingItem = items.find((entry) => entry.slug === itemSlug) ?? null;
        return { ...category, items: items.filter((entry) => entry.slug !== itemSlug) };
      }

      return {
        ...category,
        subcategories: category.subcategories.map((subcategory) => {
          if (subcategory.slug !== source.subcategorySlug) return subcategory;
          movingItem = subcategory.items.find((entry) => entry.slug === itemSlug) ?? null;
          return { ...subcategory, items: subcategory.items.filter((entry) => entry.slug !== itemSlug) };
        })
      };
    });

    if (!movingItem) return;

    const next = {
      categories: stripped.map((category) => {
        if (category.slug !== targetCategorySlug) return category;
        if (!targetSubcategorySlug) {
          return { ...category, items: [...(category.items ?? []), movingItem as CatalogItem] };
        }
        return {
          ...category,
          subcategories: category.subcategories.map((subcategory) =>
            subcategory.slug === targetSubcategorySlug
              ? { ...subcategory, items: [...subcategory.items, movingItem as CatalogItem] }
              : subcategory
          )
        };
      })
    };

    await persist(next, 'Izdelek premaknjen');
  };



  return (
    <div className="space-y-5">
      <header>
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-semibold text-slate-900">Kategorije</h1>
          {loading ? <Spinner size="sm" className="text-slate-400" /> : null}
        </div>
        <p className="mt-1 text-sm text-slate-600">
          Top: povezano drevo levo → desno. Bottom: vsebina izbrane kategorije v storefront admin pogledu.
        </p>
      </header>

      <Tabs
        value={activeView}
        onValueChange={(next) => {
          const nextView = next as CategoriesView;
          setActiveView(nextView);
          router.push(nextView === 'table' ? '/admin/kategorije' : '/admin/kategorije/miller-view');
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
        open={deleteTarget !== null}
        title={deleteTarget?.kind === 'root' ? 'Izbris vseh kategorij' : 'Izbris kategorije'}
        description={
          deleteTarget?.kind === 'root'
            ? 'Ali ste prepričani, da želite izbrisati vse kategorije?'
            : 'Ali ste prepričani, da želite odstraniti izbrano kategorijo?'
        }
        confirmLabel="Izbriši"
        cancelLabel="Prekliči"
        isDanger
        onCancel={() => setDeleteTarget(null)}
        onConfirm={confirmDeleteNode}
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
              <IconButton
                type="button"
                tone="neutral"
                aria-label="Vklopi ali izklopi način premikanja"
                title={isDragModeActive ? 'Način premikanja je vklopljen' : 'Vklopi način premikanja'}
                onClick={() => setIsDragModeActive((prev) => !prev)}
                className={isDragModeActive ? 'text-[#2f56c4] ring-1 ring-[#adc0f7]' : ''}
              >
                <DragModeIcon />
              </IconButton>

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

              <Button variant="primary" size="toolbar" onClick={() => openCreateDialog({ kind: 'category' })}>
                Dodaj kategorijo
              </Button>
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
                            setStatusByRow((prev) => ({
                              ...prev,
                              ...Object.fromEntries(selectedRows.map((rowId) => [rowId, 'active']))
                            }));
                            setIsStatusHeaderMenuOpen(false);
                          }}
                        >
                          Aktivna
                        </MenuItem>
                        <MenuItem
                          onClick={() => {
                            setStatusByRow((prev) => ({
                              ...prev,
                              ...Object.fromEntries(selectedRows.map((rowId) => [rowId, 'inactive']))
                            }));
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
        <div className="mb-3 flex items-center justify-between">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Vsebina izbrane kategorije
          </p>
          <p className="text-xs text-slate-400">{saving ? 'Shranjujem ...' : 'Spremembe se shranjujejo sproti.'}</p>
        </div>

        {selectedContext?.kind === 'root' ||
        (selectedContext?.kind === 'category' && visibleContent.length > 0) ? (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onBottomReorder}>
            <SortableContext items={visibleContent.map((item) => item.id)} strategy={rectSortingStrategy}>
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {visibleContent.map((item) => (
                  <SortableItem key={item.id} id={item.id}>
                    {(dragProps) => (
                      <article className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
                        <div className="relative h-36 overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
                          {item.image ? (
                            <Image src={item.image} alt={item.title} fill className="object-cover" />
                          ) : (
                            <div className="flex h-full items-center justify-center text-xs text-slate-400">
                              Brez slike
                            </div>
                          )}
                        </div>

                        <div className="mt-2 flex items-center gap-1">
                          <IconButton aria-label="Premakni" {...dragProps}>
                            ⋮⋮
                          </IconButton>

                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              if (item.kind === 'category') {
                                setSelected({ kind: 'category', categorySlug: item.id });
                              } else if (selectedContext?.kind === 'category') {
                                setSelected({
                                  kind: 'subcategory',
                                  categorySlug: selectedContext.category.slug,
                                  subcategorySlug: item.id
                                });
                              }
                            }}
                          >
                            Odpri
                          </Button>

                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              if (item.kind === 'category') {
                                setSelected({ kind: 'category', categorySlug: item.id });
                              }
                              if (item.kind === 'subcategory' && selectedContext?.kind === 'category') {
                                setSelected({
                                  kind: 'subcategory',
                                  categorySlug: selectedContext.category.slug,
                                  subcategorySlug: item.id
                                });
                              }
                            }}
                          >
                            Skok na drevo
                          </Button>
                        </div>

                        <div className="mt-3 space-y-2">
                          <FloatingInput
                            id={`title-${item.id}`}
                            tone="admin"
                            label="Naziv"
                            value={item.title}
                            onChange={(event) => {
                              const value = event.target.value;

                              if (item.kind === 'category') {
                                void persist({
                                  categories: catalog.categories.map((entry) =>
                                    entry.slug === item.id ? { ...entry, title: value } : entry
                                  )
                                });
                              } else if (selectedContext?.kind === 'category') {
                                updateSubcategory(selectedContext.category.slug, item.id, { title: value });
                              }
                            }}
                          />

                          <FloatingTextarea
                            id={`desc-${item.id}`}
                            tone="admin"
                            label="Opis"
                            value={item.description}
                            onChange={(event) => {
                              const value = event.target.value;

                              if (item.kind === 'category') {
                                void persist({
                                  categories: catalog.categories.map((entry) =>
                                    entry.slug === item.id ? { ...entry, summary: value } : entry
                                  )
                                });
                              } else if (selectedContext?.kind === 'category') {
                                updateSubcategory(selectedContext.category.slug, item.id, { description: value });
                              }
                            }}
                          />
                        </div>

                        <div className="mt-2 flex items-center gap-2">
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

                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => uploadRefs.current[item.id]?.click()}
                          >
                            {item.image ? 'Zamenjaj sliko' : 'Naloži sliko'}
                          </Button>

                          {item.image ? (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() =>
                                setImageDeleteTarget({
                                  kind: item.kind,
                                  categorySlug:
                                    item.kind === 'category'
                                      ? item.id
                                      : selectedContext?.kind === 'category'
                                        ? selectedContext.category.slug
                                        : '',
                                  subcategorySlug: item.kind === 'subcategory' ? item.id : undefined
                                })
                              }
                            >
                              Odstrani sliko
                            </Button>
                          ) : null}
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

      <section className={activeView === 'miller' ? 'rounded-2xl border border-slate-200 bg-white p-2 shadow-sm' : 'hidden'}>
        <div className="mb-2 flex items-center justify-between gap-2">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Millerjev pogled</p>
          <div className="flex items-center gap-1.5">
            <Button variant="outline" size="sm" onClick={() => openCreateDialog({ kind: 'category' })}>Dodaj kategorijo</Button>
            {millerCategory ? (
              <Button variant="ghost" size="sm" onClick={() => openCreateDialog({ kind: 'subcategory', categorySlug: millerCategory.slug })}>Dodaj podkategorijo</Button>
            ) : null}
          </div>
        </div>
        <div className="grid gap-2 md:grid-cols-3 xl:grid-cols-4">
          {millerColumns.map((column) => (
            <div key={column.key} className="rounded-lg border border-slate-200 bg-slate-50/60 p-1.5">
              <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500">{column.title}</p>
              <div className="max-h-[520px] space-y-1 overflow-auto">
                {column.entries.length === 0 ? <p className="px-1 py-1 text-[11px] text-slate-500">Ni elementov.</p> : null}
                {column.entries.map((entry) => (
                  <button
                    key={entry.id}
                    type="button"
                    onClick={entry.onClick}
                    className={`block w-full rounded-md border px-2 py-1 text-left text-xs transition ${entry.selected ? 'border-[#3e67d6]/50 bg-[#f0f4ff] text-[#1f3f93]' : 'border-transparent bg-white text-slate-700 hover:border-slate-200 hover:bg-slate-100'}`}
                  >
                    <div className="truncate font-medium">{entry.label}</div>
                    {entry.meta ? <div className="truncate text-[10px] text-slate-500">{entry.meta}</div> : null}
                  </button>
                ))}
              </div>
            </div>
          ))}

          {millerCategory ? (
            <div className="rounded-lg border border-slate-200 bg-white p-2">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Upravljanje</p>
              <div className="mt-2 space-y-2 text-xs">
                <FloatingInput
                  id="miller-category-title"
                  tone="admin"
                  label="Naziv kategorije"
                  value={millerCategory.title}
                  onChange={(event) => {
                    const value = event.target.value;
                    void persist({ categories: catalog.categories.map((entry) => entry.slug === millerCategory.slug ? { ...entry, title: value } : entry) }, 'Kategorija posodobljena');
                  }}
                />
                <FloatingTextarea
                  id="miller-category-summary"
                  tone="admin"
                  label="Opis"
                  value={millerCategory.summary}
                  onChange={(event) => {
                    const value = event.target.value;
                    void persist({ categories: catalog.categories.map((entry) => entry.slug === millerCategory.slug ? { ...entry, summary: value } : entry) }, 'Opis posodobljen');
                  }}
                />
                <div className="flex items-center gap-1">
                  <select
                    className="h-8 flex-1 rounded-md border border-slate-200 px-2 text-xs"
                    defaultValue=""
                    onChange={(event) => {
                      if (!event.target.value) return;
                      void moveCategory(millerCategory.slug, event.target.value);
                      event.currentTarget.value = '';
                    }}
                  >
                    <option value="">Premakni kategorijo pred ...</option>
                    {catalog.categories.filter((entry) => entry.slug !== millerCategory.slug).map((entry) => <option key={entry.slug} value={entry.slug}>{entry.title}</option>)}
                  </select>
                  <Button variant="ghost" size="sm" onClick={() => setDeleteTarget({ kind: 'category', categorySlug: millerCategory.slug })}>Izbriši</Button>
                </div>

                {millerSubcategory ? (
                  <>
                    <FloatingInput
                      id="miller-subcategory-title"
                      tone="admin"
                      label="Naziv podkategorije"
                      value={millerSubcategory.title}
                      onChange={(event) => updateSubcategory(millerCategory.slug, millerSubcategory.slug, { title: event.target.value })}
                    />
                    <FloatingTextarea
                      id="miller-subcategory-description"
                      tone="admin"
                      label="Opis podkategorije"
                      value={millerSubcategory.description}
                      onChange={(event) => updateSubcategory(millerCategory.slug, millerSubcategory.slug, { description: event.target.value })}
                    />
                    <div className="flex items-center gap-1">
                      <select
                        className="h-8 flex-1 rounded-md border border-slate-200 px-2 text-xs"
                        defaultValue=""
                        onChange={(event) => {
                          if (!event.target.value) return;
                          void moveSelectedSubcategory(event.target.value);
                          event.currentTarget.value = '';
                        }}
                      >
                        <option value="">Premakni podkategorijo v ...</option>
                        {catalog.categories.filter((entry) => entry.slug !== millerCategory.slug).map((entry) => <option key={entry.slug} value={entry.slug}>{entry.title}</option>)}
                      </select>
                      <Button variant="ghost" size="sm" onClick={() => setDeleteTarget({ kind: 'subcategory', categorySlug: millerCategory.slug, subcategorySlug: millerSubcategory.slug })}>Izbriši</Button>
                    </div>
                    <div className="space-y-1">
                      {sortCatalogItems(millerSubcategory.items).map((item) => {
                        const moveKey = `${millerCategory.slug}/${millerSubcategory.slug}/${item.slug}`;
                        return (
                          <div key={item.slug} className="flex items-center gap-1 text-[11px]">
                            <span className="min-w-0 flex-1 truncate">{item.name}</span>
                            <select
                              className="h-7 rounded-md border border-slate-200 px-1 text-[11px]"
                              value={itemMoveTargets[moveKey] ?? ''}
                              onChange={(event) => setItemMoveTargets((prev) => ({ ...prev, [moveKey]: event.target.value }))}
                            >
                              <option value="">Cilj</option>
                              {catalog.categories.map((category) => (
                                <optgroup key={category.slug} label={category.title}>
                                  <option value={category.slug}>{category.title} (direktno)</option>
                                  {category.subcategories.map((subcategory) => (
                                    <option key={subcategory.slug} value={`${category.slug}/${subcategory.slug}`}>{category.title} / {subcategory.title}</option>
                                  ))}
                                </optgroup>
                              ))}
                            </select>
                            <Button variant="ghost" size="sm" onClick={() => void moveItemToDestination(item.slug, { categorySlug: millerCategory.slug, subcategorySlug: millerSubcategory.slug }, itemMoveTargets[moveKey] ?? '')}>Premakni</Button>
                          </div>
                        );
                      })}
                    </div>
                  </>
                ) : null}
              </div>
            </div>
          ) : null}
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
                    <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                      {item.image ? (
                        <div className="relative h-24 overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
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

                      <div className="mt-2">
                        <IconButton aria-label="Premakni izdelek" {...dragProps}>
                          ⋮⋮
                        </IconButton>
                      </div>
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
