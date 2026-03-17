'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent, type FocusEvent, type ReactNode, type CSSProperties, type RefObject } from 'react';
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
import { AdminCategoriesPreview } from './AdminCategoriesPreview';
import { AdminCategoriesMiller } from './AdminCategoriesMiller';

type RecursiveCatalogSubcategory = Omit<CatalogSubcategory, 'items'> & {
  items: CatalogItem[];
  subcategories: RecursiveCatalogSubcategory[];
};

type RecursiveCatalogCategory = Omit<CatalogCategory, 'subcategories' | 'items'> & {
  subcategories: RecursiveCatalogSubcategory[];
  items: CatalogItem[];
};

type CatalogData = { categories: RecursiveCatalogCategory[] };
type AdminCategoriesPayload = { categories: CatalogCategory[]; statuses?: Record<string, CategoryStatus> };

type SelectedNode =
  | { kind: 'root' }
  | { kind: 'category'; categorySlug: string }
  | {
      kind: 'subcategory';
      categorySlug: string;
      subcategoryPath?: string[];
      subcategorySlug?: string;
    };

type DeleteTarget =
  | { kind: 'root' }
  | { kind: 'category'; categorySlug: string }
  | {
      kind: 'subcategory';
      categorySlug: string;
      subcategoryPath?: string[];
      subcategorySlug?: string;
    }
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
  isInactive?: boolean;
};

type EditingRowDraft = {
  id: string;
  kind: 'root' | 'category' | 'subcategory';
  categorySlug?: string;
  subcategoryPath?: string[];
  subcategorySlug?: string;
  title: string;
  description: string;
  status: CategoryStatus;
};

type CreateTarget =
  | { kind: 'category'; afterSlug?: string }
  | { kind: 'subcategory'; categorySlug: string; parentPath?: string[]; afterSlug?: string }
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
const subPathKey = (subPath: string[]) => subPath.join('__');
const subId = (categorySlug: string, subPath: string | string[]) =>
  `sub:${categorySlug}:${subPathKey(Array.isArray(subPath) ? subPath : [subPath])}`;

const itemId = (catSlug: string, itemSlug: string, subSlug?: string) =>
  `item:${catSlug}:${subSlug ?? '_'}:${itemSlug}`;
const slugify = (value: string) =>
  value.toLowerCase().trim().replace(/\s+/g, '-').replace(/[^a-z0-9-čšžćđ]/gi, '');

const InlineStatusToggle = ({
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
    className={`relative inline-flex h-7 w-14 items-center rounded-full border transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3e67d6]/50 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 ${
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
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M1.5 12s3.75-6.75 10.5-6.75S22.5 12 22.5 12s-3.75 6.75-10.5 6.75S1.5 12 1.5 12Z" />
          <circle cx="12" cy="12" r="3" />
        </svg>
      ) : (
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M1.5 12s3.75-6.75 10.5-6.75S22.5 12 22.5 12s-3.75 6.75-10.5 6.75S1.5 12 1.5 12Z" />
          <circle cx="12" cy="12" r="3" />
          <path d="M3 3 21 21" />
        </svg>
      )}
    </span>
    <span
      aria-hidden="true"
      className={`absolute inset-y-0 z-10 w-6 rounded-full border border-[#1f2a36] bg-[#2f3942] shadow-[inset_0_1px_2px_rgba(255,255,255,0.08),inset_0_-3px_6px_rgba(0,0,0,0.2),0_2px_5px_rgba(15,23,42,0.25)] transition-transform duration-200 ${
        checked ? 'translate-x-8' : 'translate-x-0'
      }`}
    >
      <span className="absolute left-1/2 top-1/2 h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#9aa0a7]" />
    </span>
  </button>
);


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

type RecursiveNode = RecursiveCatalogSubcategory;

const toSubcategoryPath = (value?: string | string[]) =>
  Array.isArray(value) ? value : value ? [value] : [];

const pathEquals = (left?: string | string[], right?: string | string[]) => {
  const normalizedLeft = toSubcategoryPath(left);
  const normalizedRight = toSubcategoryPath(right);

  return (
    normalizedLeft.length === normalizedRight.length &&
    normalizedLeft.every((part, index) => part === normalizedRight[index])
  );
};

const areStatusesEqual = (left: Record<string, CategoryStatus>, right: Record<string, CategoryStatus>) => {
  const leftKeys = Object.keys(left);
  const rightKeys = Object.keys(right);
  if (leftKeys.length !== rightKeys.length) return false;
  return leftKeys.every((key) => left[key] === right[key]);
};

const areCatalogsEqual = (left: CatalogData, right: CatalogData) =>
  JSON.stringify(normalizeCatalogData(left)) === JSON.stringify(normalizeCatalogData(right));

const stripNodeIds = (catalog: CatalogData): CatalogData => ({
  categories: catalog.categories.map((category) => ({
    ...category,
    id: '',
    subcategories: category.subcategories.map(function stripSubcategoryIds(subcategory): RecursiveNode {
      return {
        ...subcategory,
        id: '',
        subcategories: subcategory.subcategories.map(stripSubcategoryIds)
      };
    })
  }))
});

const areMillerCatalogsEqual = (left: CatalogData, right: CatalogData) =>
  JSON.stringify(stripNodeIds(normalizeCatalogData(left))) ===
  JSON.stringify(stripNodeIds(normalizeCatalogData(right)));

const parseSubNodeId = (value: string): { categorySlug: string; subcategoryPath: string[] } | null => {
  if (!value.startsWith('sub:')) return null;

  const [, categorySlug, pathKey = ''] = value.split(':');
  if (!categorySlug) return null;

  return {
    categorySlug,
    subcategoryPath: pathKey ? pathKey.split('__').filter(Boolean) : []
  };
};


const parseItemNodeId = (value: string): { categorySlug: string; subcategorySlug?: string; itemSlug: string } | null => {
  if (!value.startsWith('item:')) return null;

  const [, categorySlug, subcategorySlug, itemSlug] = value.split(':');
  if (!categorySlug || !itemSlug) return null;

  return {
    categorySlug,
    subcategorySlug: subcategorySlug && subcategorySlug !== '_' ? subcategorySlug : undefined,
    itemSlug
  };
};

function normalizeRecursiveSubcategory(
  input: unknown,
  categoryIdSeed: string,
  parentPath: string[]
): RecursiveNode | null {
  if (typeof input !== 'object' || input === null) return null;

  const subcategory = input as Partial<CatalogSubcategory> & { subcategories?: unknown[] };
  const slug = typeof subcategory.slug === 'string' ? subcategory.slug.trim() : '';
  if (!slug) return null;

  const currentPath = [...parentPath, slug];

  return {
    id: normalizeNodeId(subcategory.id, `sub-${categoryIdSeed}-${currentPath.join('-')}`),
    slug,
    title: typeof subcategory.title === 'string' ? subcategory.title : slug,
    description: typeof subcategory.description === 'string' ? subcategory.description : '',
    adminNotes: typeof subcategory.adminNotes === 'string' ? subcategory.adminNotes : undefined,
    image: typeof subcategory.image === 'string' ? subcategory.image : '',
    createdAt: typeof subcategory.createdAt === 'string' ? subcategory.createdAt : undefined,
    updatedAt: typeof subcategory.updatedAt === 'string' ? subcategory.updatedAt : undefined,
    items: Array.isArray(subcategory.items) ? subcategory.items : [],
    subcategories: Array.isArray(subcategory.subcategories)
      ? subcategory.subcategories
          .map((child) => normalizeRecursiveSubcategory(child, categoryIdSeed, currentPath))
          .filter((entry): entry is RecursiveNode => entry !== null)
      : []
  };
}

function findSubcategoryByPath(
  nodes: RecursiveNode[],
  path: string[]
): RecursiveNode | null {
  if (path.length === 0) return null;

  const current = nodes.find((node) => node.slug === path[0]);
  if (!current) return null;
  if (path.length === 1) return current;

  return findSubcategoryByPath(current.subcategories, path.slice(1));
}

function updateSubcategoryTree(
  nodes: RecursiveNode[],
  path: string[],
  updater: (node: RecursiveNode) => RecursiveNode
): RecursiveNode[] {
  if (path.length === 0) return nodes;

  return nodes.map((node) => {
    if (node.slug !== path[0]) return node;

    if (path.length === 1) {
      return updater(node);
    }

    return {
      ...node,
      subcategories: updateSubcategoryTree(node.subcategories, path.slice(1), updater)
    };
  });
}

function removeSubcategoryTree(
  nodes: RecursiveNode[],
  path: string[]
): RecursiveNode[] {
  if (path.length === 0) return nodes;

  if (path.length === 1) {
    return nodes.filter((node) => node.slug !== path[0]);
  }

  return nodes.map((node) => {
    if (node.slug !== path[0]) return node;

    return {
      ...node,
      subcategories: removeSubcategoryTree(node.subcategories, path.slice(1))
    };
  });
}

function collectSubcategoryIds(
  categorySlug: string,
  nodes: RecursiveNode[],
  parentPath: string[] = []
): string[] {
  return nodes.flatMap((node) => {
    const currentPath = [...parentPath, node.slug];
    return [
      subId(categorySlug, currentPath),
      ...collectSubcategoryIds(categorySlug, node.subcategories, currentPath)
    ];
  });
}

function collectExpandableSubcategoryIds(
  categorySlug: string,
  nodes: RecursiveNode[],
  parentPath: string[] = []
): string[] {
  return nodes.flatMap((node) => {
    const currentPath = [...parentPath, node.slug];
    const currentId = subId(categorySlug, currentPath);
    const nested = collectExpandableSubcategoryIds(categorySlug, node.subcategories, currentPath);

    if (node.subcategories.length === 0) return nested;
    return [currentId, ...nested];
  });
}

function filterSubcategoryTree(
  nodes: RecursiveNode[],
  searchQuery: string
): RecursiveNode[] {
  return nodes.flatMap((node) => {
    const selfMatches = [node.title, node.description].join(' ').toLowerCase().includes(searchQuery);
    const matchingChildren = filterSubcategoryTree(node.subcategories, searchQuery);

    if (!selfMatches && matchingChildren.length === 0) return [];

    return [
      {
        ...node,
        subcategories: selfMatches ? node.subcategories : matchingChildren
      }
    ];
  });
}

function pruneSelectedSubcategoryTree(
  categorySlug: string,
  nodes: RecursiveNode[],
  selectedIds: Set<string>,
  parentPath: string[] = []
): RecursiveNode[] {
  return nodes.flatMap((node) => {
    const currentPath = [...parentPath, node.slug];
    const currentId = subId(categorySlug, currentPath);

    if (selectedIds.has(currentId)) return [];

    return [
      {
        ...node,
        subcategories: pruneSelectedSubcategoryTree(categorySlug, node.subcategories, selectedIds, currentPath)
      }
    ];
  });
}

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
const categoryTableColumnWidths = {
  select: 56,
  category: 420,
  description: 320,
  subcategories: 128,
  items: 112,
  visibility: 128,
  actions: 160
} as const;

const categoryTableTotalWidth = Object.values(categoryTableColumnWidths).reduce((sum, width) => sum + width, 0);
const categoryTableFixedWidthWithoutDescription =
  categoryTableTotalWidth - categoryTableColumnWidths.description;

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

      const category = rawCategory as Partial<CatalogCategory> & { subcategories?: unknown[] };
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
        createdAt: typeof category.createdAt === 'string' ? category.createdAt : undefined,
        updatedAt: typeof category.updatedAt === 'string' ? category.updatedAt : undefined,
        subcategories: subcategoriesSource
          .map((rawSubcategory) => normalizeRecursiveSubcategory(rawSubcategory, categoryId, []))
          .filter((entry): entry is RecursiveNode => entry !== null),
        items: Array.isArray(category.items) ? category.items : []
      } as RecursiveCatalogCategory;
    })
    .filter((entry): entry is RecursiveCatalogCategory => entry !== null);

  return { categories };
}

function flattenSubcategories(
  categorySlug: string,
  nodes: RecursiveNode[],
  parentPath: string[] = [],
  parentLabel: string
): Array<{
  id: string;
  title: string;
  image: string;
  index: number;
  parentId: string;
  parentLabel: string;
}> {
  return nodes.flatMap((node, index) => {
    const currentPath = [...parentPath, node.slug];
    const currentId = subId(categorySlug, currentPath);
    const current = {
      id: currentId,
      title: node.title,
      image: node.image ?? '',
      index,
      parentId:
        parentPath.length === 0
          ? catId(categorySlug)
          : subId(categorySlug, parentPath),
      parentLabel
    };

    return [
      current,
      ...flattenSubcategories(categorySlug, node.subcategories, currentPath, node.title)
    ];
  });
}

function buildLabelMap(categories: RecursiveCatalogCategory[]) {
  const labelById = new Map<string, string>();

  categories.forEach((category) => {
    labelById.set(catId(category.slug), category.title);

    const visit = (nodes: RecursiveNode[], parentPath: string[] = []) => {
      nodes.forEach((node) => {
        const currentPath = [...parentPath, node.slug];
        labelById.set(subId(category.slug, currentPath), node.title);
        visit(node.subcategories, currentPath);
      });
    };

    visit(category.subcategories);
  });

  return labelById;
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
  const prevById = new Map(prevCats.map((category, index) => [category.id, { category, index }]));
  const nextById = new Map(nextCats.map((category, index) => [category.id, { category, index }]));

  for (const { category } of prevById.values()) {
    if (!nextById.has(category.id)) {
      lines.push(`izbrisana kategorija "${category.title}"`);
    }
  }

  for (const { category } of nextById.values()) {
    if (!prevById.has(category.id)) {
      lines.push(`dodana kategorija "${category.title}"`);
    }
  }

  const prevSubsById = new Map<
    string,
    {
      title: string;
      image: string;
      index: number;
      parentId: string;
      parentLabel: string;
    }
  >();

  const nextSubsById = new Map<
    string,
    {
      title: string;
      image: string;
      index: number;
      parentId: string;
      parentLabel: string;
    }
  >();

  prevCats.forEach((category) => {
    flattenSubcategories(category.slug, category.subcategories, [], category.title).forEach((entry) => {
      prevSubsById.set(entry.id, entry);
    });
  });

  nextCats.forEach((category) => {
    flattenSubcategories(category.slug, category.subcategories, [], category.title).forEach((entry) => {
      nextSubsById.set(entry.id, entry);
    });
  });

  for (const [id, prevSub] of prevSubsById.entries()) {
    if (!nextSubsById.has(id)) {
      lines.push(`izbrisana podkategorija "${prevSub.title}"`);
    }
  }

  for (const [id, nextSub] of nextSubsById.entries()) {
    if (!prevSubsById.has(id)) {
      lines.push(`dodana podkategorija pod "${nextSub.parentLabel}": "${nextSub.title}"`);
    }
  }

  for (const [id, prevSub] of prevSubsById.entries()) {
    const nextSub = nextSubsById.get(id);
    if (!nextSub) continue;

    if (prevSub.title !== nextSub.title) {
      lines.push(`preimenovana podkategorija "${prevSub.title}" → "${nextSub.title}"`);
    }

    if (prevSub.image !== nextSub.image) {
      lines.push(`spremenjena slika za podkategorijo "${nextSub.title}"`);
    }

    if (prevSub.parentId !== nextSub.parentId || prevSub.index !== nextSub.index) {
      lines.push(`premaknjena podkategorija "${nextSub.title}"`);
    }
  }

  for (const [id, { category: oldCat, index: oldIndex }] of prevById.entries()) {
    const match = nextById.get(id);
    if (!match) continue;

    const newCat = match.category;

    if (oldCat.title !== newCat.title) {
      lines.push(`preimenovana kategorija "${oldCat.title}" → "${newCat.title}"`);
    }

    if ((oldCat.image ?? '') !== (newCat.image ?? '')) {
      lines.push(`spremenjena slika za kategorijo "${newCat.title}"`);
    }

    if (oldIndex !== match.index) {
      lines.push(`premaknjena kategorija "${newCat.title}"`);
    }
  }

  const labelById = buildLabelMap(nextCats);
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
  const statusHeaderMenuRef = useRef<HTMLDivElement>(null);
  const selectAllRef = useRef<HTMLInputElement>(null);
  const isInlineSavingRef = useRef(false);
  const skipNextInlineBlurSaveRef = useRef(false);
  const saveInlineEditRef = useRef<() => void>(() => {});
  const toastRef = useRef(toast);
  const persistedTableRef = useRef<CatalogData>({ categories: [] });
  const persistedMillerRef = useRef<CatalogData>({ categories: [] });
  const persistedStatusRef = useRef<Record<string, CategoryStatus>>({});
  const stagedTableHistoryRef = useRef<HistorySnapshot[]>([]);
  const stagedMillerHistoryRef = useRef<HistorySnapshot[]>([]);
  const demotedMillerCategoriesRef = useRef<Map<string, RecursiveCatalogCategory>>(new Map());
  const committedHistoryRef = useRef<HistorySnapshot[]>([]);
  const committedHistoryIndexRef = useRef(0);
  const tableHistoryMenuRef = useRef<HTMLDivElement | null>(null);
  const millerHistoryMenuRef = useRef<HTMLDivElement | null>(null);
  const millerViewportRef = useRef<HTMLDivElement | null>(null);
  const canUndoStagedChanges =
    activeView === 'miller'
      ? stagedMillerHistoryRef.current.length > 0
      : stagedTableHistoryRef.current.length > 0;

  const hasPendingStagedChanges =
    stagedTableHistoryRef.current.length > 0 || stagedMillerHistoryRef.current.length > 0;

  const canRestoreCommittedHistory = committedHistoryIndexRef.current > 0;

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
      return next;
    });
    const initialSnapshot = { catalog: payload, statuses: { ...persistedStatusRef.current } };
    stagedTableHistoryRef.current = [];
    stagedMillerHistoryRef.current = [];
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

    const subcategoryPath = toSubcategoryPath(selected.subcategoryPath ?? selected.subcategorySlug);
    const subcategory = findSubcategoryByPath(category.subcategories, subcategoryPath);
    if (!subcategory) return null;

    return { kind: 'subcategory' as const, category, subcategory };
  }, [catalog.categories, selected]);

  const millerSelectedContext = useMemo(() => {
    if (selected.kind === 'root') return { kind: 'root' as const };

    const category = millerCatalog.categories.find((entry) => entry.slug === selected.categorySlug);
    if (!category) return null;

    if (selected.kind === 'category') return { kind: 'category' as const, category };

    const subcategoryPath = toSubcategoryPath(selected.subcategoryPath ?? selected.subcategorySlug);
    const subcategory = findSubcategoryByPath(category.subcategories, subcategoryPath);
    if (!subcategory) return null;

    return { kind: 'subcategory' as const, category, subcategory };
  }, [millerCatalog.categories, selected]);


  const millerBreadcrumbs = useMemo(() => {
    if (selected.kind === 'root') {
      return [] as Array<{ label: string; onClick?: () => void; isCurrent: boolean }>;
    }

    const category = millerCatalog.categories.find((entry) => entry.slug === selected.categorySlug);
    if (!category) {
      return [] as Array<{ label: string; onClick?: () => void; isCurrent: boolean }>;
    }

    const crumbs: Array<{ label: string; onClick?: () => void; isCurrent: boolean }> = [
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
        const itemName = parsedItem.subcategorySlug
          ? category.subcategories.find((sub) => sub.slug === parsedItem.subcategorySlug)?.items.find((item) => item.slug === parsedItem.itemSlug)?.name
          : (category.items ?? []).find((item) => item.slug === parsedItem.itemSlug)?.name;
        if (itemName) crumbs.push({ label: itemName, isCurrent: true });
      }
    }

    return crumbs;
  }, [millerCatalog.categories, millerSelection, selected]);

  const stageMillerCatalog = (next: CatalogData, nextStatuses: Record<string, CategoryStatus> = statusByRow) => {
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
    setStatusByRow(nextStatuses);
    setMillerDirty(
      !areMillerCatalogsEqual(normalized, persistedMillerRef.current) ||
        !areStatusesEqual(nextStatuses, persistedStatusRef.current)
    );
    setMillerError(null);
  };

  const stageTableCatalog = (next: CatalogData, nextStatuses: Record<string, CategoryStatus> = statusByRow) => {
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
    setStatusByRow(nextStatuses);
    setTableDirty(
      !areCatalogsEqual(normalized, persistedTableRef.current) ||
        !areStatusesEqual(nextStatuses, persistedStatusRef.current)
    );
    setTableError(null);
  };

  const stageStatusChange = (nextStatuses: Record<string, CategoryStatus>) => {
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
      const activeMenuRef = activeView === 'miller' ? millerHistoryMenuRef.current : tableHistoryMenuRef.current;
      if (activeMenuRef && target && !activeMenuRef.contains(target)) {
        setIsHistoryMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', closeHistoryMenuOnOutside);
    return () => document.removeEventListener('mousedown', closeHistoryMenuOnOutside);
  }, [activeView, isHistoryMenuOpen]);

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
      id: createNodeId(),
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

  const confirmCreate = () => {
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

    let nextCategories: RecursiveCatalogCategory[] = millerCatalog.categories.map((category) => ({
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
          movedCategories.forEach((category) => {
            demotedMillerCategoriesRef.current.set(category.id, category);
          });

          const asSubcategories: RecursiveCatalogSubcategory[] = movedCategories.map((category) => ({
            id: category.id,
            slug: category.slug,
            title: category.title,
            description: category.description,
            adminNotes: category.adminNotes,
            image: category.image,
            items: [...(category.items ?? [])],
            subcategories: category.subcategories
          }));

          const candidateSlugs = new Set<string>();
          asSubcategories.forEach((subcategory) => {
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

              const insertion = asSubcategories;
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
        const promoted: RecursiveCatalogCategory[] = [];
        nextCategories = nextCategories
          .map((category) => {
            const remainingSubs = category.subcategories.filter((subcategory) => {
              const key = subId(category.slug, subcategory.slug);
              if (!selectedSubKeys.has(key)) return true;
              const demotedCategory = demotedMillerCategoriesRef.current.get(subcategory.id);
              promoted.push({
                ...(demotedCategory ?? {
                  id: subcategory.id,
                  slug: subcategory.slug,
                  title: subcategory.title,
                  summary: subcategory.title,
                  description: subcategory.description,
                  image: subcategory.image ?? '',
                  adminNotes: subcategory.adminNotes,
                  bannerImage: undefined
                }),
                id: subcategory.id,
                slug: subcategory.slug,
                title: subcategory.title,
                description: subcategory.description,
                image: subcategory.image ?? '',
                adminNotes: subcategory.adminNotes,
                subcategories: subcategory.subcategories,
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
          const movedSubs: RecursiveCatalogSubcategory[] = [];

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
        subcategories: pruneSelectedSubcategoryTree(category.slug, category.subcategories, selectedSubcategories)
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
    const savedCatalog = normalizeCatalogData(millerCatalog);
    const ok = await persist(savedCatalog, statusByRow, 'Miller spremembe shranjene');

    if (!ok) {
      setMillerError('Shranjevanje Miller sprememb ni uspelo. Lokalno stanje je ohranjeno.');
      return;
    }

    persistedTableRef.current = savedCatalog;
    persistedMillerRef.current = savedCatalog;
    persistedStatusRef.current = { ...statusByRow };

    committedHistoryRef.current = committedHistoryRef.current.slice(0, committedHistoryIndexRef.current + 1);
    committedHistoryRef.current.push({
      catalog: savedCatalog,
      statuses: { ...statusByRow }
    });
    committedHistoryIndexRef.current = committedHistoryRef.current.length - 1;

    stagedMillerHistoryRef.current = [];
    stagedTableHistoryRef.current = [];

    setCatalog(savedCatalog);
    setMillerCatalog(savedCatalog);
    setMillerDirty(false);
    setTableDirty(false);
    setMillerError(null);
    setTableError(null);
  };

  const saveTableChanges = async () => {
    const savedCatalog = normalizeCatalogData(catalog);
    const ok = await persist(savedCatalog, statusByRow, 'Spremembe shranjene');

    if (!ok) {
      setTableError('Shranjevanje sprememb ni uspelo. Lokalno stanje je ohranjeno.');
      return;
    }

    persistedTableRef.current = savedCatalog;
    persistedMillerRef.current = savedCatalog;
    persistedStatusRef.current = { ...statusByRow };

    committedHistoryRef.current = committedHistoryRef.current.slice(0, committedHistoryIndexRef.current + 1);
    committedHistoryRef.current.push({
      catalog: savedCatalog,
      statuses: { ...statusByRow }
    });
    committedHistoryIndexRef.current = committedHistoryRef.current.length - 1;

    stagedTableHistoryRef.current = [];
    stagedMillerHistoryRef.current = [];

    setCatalog(savedCatalog);
    setMillerCatalog(savedCatalog);
    setTableDirty(false);
    setMillerDirty(false);
    setTableError(null);
    setMillerError(null);
  };


  const millerColumns = useMemo(() => {
    const columns: Array<{ key: string; title: string; ids: string[]; rows: Array<{ id: string; label: string; tone: string; isInactive?: boolean; createdAt?: string; updatedAt?: string; kind: 'category' | 'subcategory' | 'item'; onClick: (event: React.MouseEvent<HTMLButtonElement>) => void; onDragStart: () => void; onDropTarget: string; }>; kind: 'categories' | 'subcategories' | 'items' }> = [];

    const categoryIds = millerCatalog.categories.map((category) => catId(category.slug));
    columns.push({
      key: 'categories',
      title: '/',
      kind: 'categories',
      ids: categoryIds,
      rows: millerCatalog.categories.map((category) => ({
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
      const columnIds = nodes.map((node) => subId(activeCategory.slug, [...parentPath, node.slug]));

      columns.push({
        key: `sub-${activeCategory.slug}-${depth}-${parentPath.join('__') || 'root'}`,
        title: parentTitle,
        kind: 'subcategories',
        ids: columnIds,
        rows: nodes.map((subcategory) => {
          const currentPath = [...parentPath, subcategory.slug];
          const id = subId(activeCategory.slug, currentPath);
          return {
            id,
            label: subcategory.title,
            tone: selected.kind === 'subcategory' && pathEquals(selectedSubcategoryPath, currentPath) ? 'focused' : 'default',
            isInactive: (statusByRow[id] ?? 'active') === 'inactive',
            createdAt: subcategory.createdAt,
            updatedAt: subcategory.updatedAt,
            onClick: (event) => {
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

    const itemSource = selected.kind === 'subcategory'
      ? findSubcategoryByPath(activeCategory.subcategories, selectedSubcategoryPath)?.items ?? []
      : activeCategory.subcategories.length === 0
        ? (activeCategory.items ?? [])
        : [];

    const showItems = selected.kind === 'subcategory' || activeCategory.subcategories.length === 0;

    if (showItems) {
      const selectedLeafSlug = selected.kind === 'subcategory' ? selectedSubcategoryPath.at(-1) : undefined;
      const itemIds = itemSource.map((item) => itemId(activeCategory.slug, item.slug, selectedLeafSlug));
      columns.push({
        key: `item-${activeCategory.slug}-${selectedLeafSlug ?? 'cat'}`,
        title: selected.kind === 'subcategory' ? parentTitle : activeCategory.title,
        kind: 'items',
        ids: itemIds,
        rows: itemSource.map((item) => {
          const id = itemId(activeCategory.slug, item.slug, selectedLeafSlug);
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
  }, [millerCatalog.categories, millerSelection, selected, statusByRow]);

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
        kind: 'category' as const,
        isInactive: (statusByRow[catId(entry.slug)] ?? 'active') === 'inactive'
      }));
    }

    if (selectedContext?.kind === 'category') {
      return selectedContext.category.subcategories.map((entry) => ({
        id: entry.slug,
        title: entry.title,
        description: entry.description,
        image: entry.image,
        kind: 'subcategory' as const,
        isInactive: (statusByRow[subId(selectedContext.category.slug, entry.slug)] ?? 'active') === 'inactive'
      }));
    }

    return [];
  }, [catalog.categories, selectedContext, statusByRow]);

  const getDescendantIds = (id: string) => {
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
  };

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

  const toggleExpanded = (id: string) => {
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
  };

  saveInlineEditRef.current = saveInlineEdit;

  const handleInlineBlur = (event: FocusEvent<HTMLElement>) => {
    if (skipNextInlineBlurSaveRef.current) {
      skipNextInlineBlurSaveRef.current = false;
      return;
    }

    const nextTarget = event.relatedTarget as Node | null;
    if (nextTarget && event.currentTarget.closest('tr')?.contains(nextTarget)) {
      return;
    }
    saveInlineEdit();
  };

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

  const filteredCategories = useMemo(() => {
    if (!isSearchActive) return catalog.categories;

    return catalog.categories
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
  }, [catalog.categories, isSearchActive, searchQuery]);

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

  const selectedVisibleCount = useMemo(
    () => selectableVisibleRowIds.filter((id) => selectedRows.includes(id)).length,
    [selectableVisibleRowIds, selectedRows]
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
          subcategories: pruneSelectedSubcategoryTree(category.slug, category.subcategories, selectedSet)
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
    const isChecked = selectedRows.includes(id);
    const rowDepthTone = getAdminCategoryRowToneClass(level);
    const rowStatus = statusByRow[id] ?? 'active';

    const toggleInlineEdit = () => {
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

    const setStatus = (nextStatus: CategoryStatus) => {
      const nextStatuses = { ...statusByRow, [id]: nextStatus };
      stageStatusChange(nextStatuses);
      setEditingRow((prev) => (prev && prev.id === id ? { ...prev, status: nextStatus } : prev));
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

    const gutterWidth = level === 0 ? treeButtonDiameter : buttonLeft + treeButtonDiameter;

    return (
      <SortableTreeRow
        key={id}
        id={id}
        disabled={kind === 'root' || (kind === 'subcategory' && resolvedSubcategoryPath.length > 1)}
      >
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

  const buildSubcategoryRows = (
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
        isSearchActive || expanded[currentId] || closingRowIds.includes(currentId);
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
          parentIsAnimating: openingRowIds.includes(currentId) || closingRowIds.includes(currentId)
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
  };

  const treeRows: ReactNode[] = (() => {
    const rows: ReactNode[] = [];
    const isRootExpanded = isSearchActive || (expanded[rootId] ?? true) || closingRowIds.includes(rootId);

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
        isSearchActive || (expanded[categoryNodeId] ?? false) || closingRowIds.includes(categoryNodeId);
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
          parentIsAnimating: openingRowIds.includes(rootId) || closingRowIds.includes(rootId)
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
        variant="motion"
      >
        <TabsList>
          <TabsTrigger value="table">Osnovno</TabsTrigger>
          <TabsTrigger value="miller">Po stolpcih</TabsTrigger>
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


      <AdminCategoriesTableSection
        activeView={activeView}
        query={query}
        onQueryChange={setQuery}
        onBulkDelete={handleBulkDelete}
        selectedRows={selectedRows}
        isBulkDeleting={isBulkDeleting}
        bulkDeleteButtonClass={bulkDeleteButtonClass}
        onRequestSave={() => {
          const summary = summarizeCatalogChanges(persistedTableRef.current, catalog, persistedStatusRef.current, statusByRow);
          setTableSaveSummary(summary);
          setIsTableSaveDialogOpen(true);
        }}
        tableDirty={tableDirty}
        saving={saving}
        tableHistoryMenuRef={tableHistoryMenuRef}
        isHistoryMenuOpen={isHistoryMenuOpen}
        onToggleHistoryMenu={() => setIsHistoryMenuOpen((prev) => !prev)}
        canUndoStagedChanges={canUndoStagedChanges}
        onUndo={() => {
          undoStagedChanges();
          setIsHistoryMenuOpen(false);
        }}
        canRestoreCommittedHistory={canRestoreCommittedHistory}
        hasPendingStagedChanges={hasPendingStagedChanges}
        onRestore={() => {
          restoreCommittedHistory();
          setIsHistoryMenuOpen(false);
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
      />

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
        tableDirty={tableDirty}
        saving={saving}
        selectedContext={selectedContext}
        visibleContent={visibleContent}
        onBottomReorder={onBottomReorder}
        renderSortableItem={(id, children) => (
          <SortableItem key={id} id={id}>
            {(dragProps) => children(dragProps)}
          </SortableItem>
        )}
        uploadRefs={uploadRefs}
        onSetImageDeleteTarget={setImageDeleteTarget}
        onImageUpload={onImageUpload}
        onLeafProductsDragEnd={onLeafProductsDragEnd}
        sortCatalogItems={sortCatalogItems}
      />

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
        millerHistoryMenuRef={millerHistoryMenuRef}
        isHistoryMenuOpen={isHistoryMenuOpen}
        onToggleHistoryMenu={() => setIsHistoryMenuOpen((prev) => !prev)}
        canUndoStagedChanges={canUndoStagedChanges}
        onUndo={() => {
          undoStagedChanges();
          setIsHistoryMenuOpen(false);
        }}
        canRestoreCommittedHistory={canRestoreCommittedHistory}
        hasPendingStagedChanges={hasPendingStagedChanges}
        onRestore={() => {
          restoreCommittedHistory();
          setIsHistoryMenuOpen(false);
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


    </div>
  );
}



function AdminCategoriesTableSection({
  activeView,
  query,
  onQueryChange,
  onBulkDelete,
  selectedRows,
  isBulkDeleting,
  bulkDeleteButtonClass,
  onRequestSave,
  tableDirty,
  saving,
  tableHistoryMenuRef,
  isHistoryMenuOpen,
  onToggleHistoryMenu,
  canUndoStagedChanges,
  onUndo,
  canRestoreCommittedHistory,
  hasPendingStagedChanges,
  onRestore,
  sensors,
  onTreeDragEnd,
  visibleRowIds,
  selectAllRef,
  allRowsSelected,
  onToggleSelectAll,
  allExpanded,
  onToggleAllExpanded,
  statusHeaderMenuRef,
  onToggleStatusHeaderMenu,
  isStatusHeaderMenuOpen,
  statusByRow,
  onStageStatusChange,
  treeRows
}: {
  activeView: 'table' | 'miller';
  query: string;
  onQueryChange: (value: string) => void;
  onBulkDelete: () => void;
  selectedRows: string[];
  isBulkDeleting: boolean;
  bulkDeleteButtonClass: string;
  onRequestSave: () => void;
  tableDirty: boolean;
  saving: boolean;
  tableHistoryMenuRef: RefObject<HTMLDivElement>;
  isHistoryMenuOpen: boolean;
  onToggleHistoryMenu: () => void;
  canUndoStagedChanges: boolean;
  onUndo: () => void;
  canRestoreCommittedHistory: boolean;
  hasPendingStagedChanges: boolean;
  onRestore: () => void;
  sensors: ReturnType<typeof import('@dnd-kit/core').useSensors>;
  onTreeDragEnd: (event: DragEndEvent) => void;
  visibleRowIds: string[];
  selectAllRef: RefObject<HTMLInputElement>;
  allRowsSelected: boolean;
  onToggleSelectAll: () => void;
  allExpanded: boolean;
  onToggleAllExpanded: () => void;
  statusHeaderMenuRef: RefObject<HTMLDivElement>;
  onToggleStatusHeaderMenu: () => void;
  isStatusHeaderMenuOpen: boolean;
  statusByRow: Record<string, CategoryStatus>;
  onStageStatusChange: (nextStatuses: Record<string, CategoryStatus>) => void;
  treeRows: ReactNode;
}) {
  return (
    <div className={activeView === 'table' ? 'space-y-5' : 'hidden'}>
      <section>
        <AdminTableLayout
          className="border"
          contentClassName="overflow-x-auto"
          headerLeft={
            <>
              <input
                value={query}
                onChange={(event) => onQueryChange(event.target.value)}
                placeholder="Išči po kategoriji ali opisu ..."
                className={`${ADMIN_CONTROL_HEIGHT} min-w-[260px] flex-1 rounded-xl border border-slate-300 ${ADMIN_CONTROL_PADDING_X} text-xs text-slate-700 outline-none focus:border-[#3e67d6] focus:ring-0 focus:ring-[#3e67d6]`}
              />
            </>
          }
          headerRight={
            <>
              <button
                type="button"
                onClick={onBulkDelete}
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

              <Button variant="primary" size="toolbar" onClick={onRequestSave} disabled={!tableDirty || saving}>
                Shrani spremembe
              </Button>

              <div className="relative" ref={tableHistoryMenuRef}>
                <IconButton type="button" size="md" tone="neutral" aria-label="Zgodovina" onClick={onToggleHistoryMenu}>
                  ⋮
                </IconButton>
                {isHistoryMenuOpen ? (
                  <MenuPanel className="absolute right-0 top-9 z-20 w-40">
                    <MenuItem
                      disabled={!canUndoStagedChanges}
                      onClick={() => {
                        if (!canUndoStagedChanges) return;
                        onUndo();
                      }}
                    >
                      Razveljavi
                    </MenuItem>

                    <MenuItem
                      disabled={!canRestoreCommittedHistory || hasPendingStagedChanges}
                      onClick={() => {
                        if (!canRestoreCommittedHistory || hasPendingStagedChanges) return;
                        onRestore();
                      }}
                    >
                      Obnovi
                    </MenuItem>
                  </MenuPanel>
                ) : null}
              </div>
            </>
          }
        >
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onTreeDragEnd}>
            <SortableContext items={visibleRowIds} strategy={verticalListSortingStrategy}>
              <table
                className="table-fixed border-separate border-spacing-0 border-x border-b border-slate-200"
                style={{ width: '100%', minWidth: `${categoryTableTotalWidth}px` }}
              >
                <colgroup>
                  <col style={{ width: `${categoryTableColumnWidths.select}px` }} />
                  <col style={{ width: `${categoryTableColumnWidths.category}px` }} />
                  <col style={{ width: `calc(100% - ${categoryTableFixedWidthWithoutDescription}px)` }} />
                  <col style={{ width: `${categoryTableColumnWidths.subcategories}px` }} />
                  <col style={{ width: `${categoryTableColumnWidths.items}px` }} />
                  <col style={{ width: `${categoryTableColumnWidths.visibility}px` }} />
                  <col style={{ width: `${categoryTableColumnWidths.actions}px` }} />
                </colgroup>

                <thead className="bg-slate-50/90">
                  <tr>
                    <th className="border-b border-slate-200 px-2 py-2 text-center text-xs font-semibold text-slate-500">
                      <input
                        ref={selectAllRef}
                        type="checkbox"
                        checked={allRowsSelected}
                        onChange={onToggleSelectAll}
                        aria-label="Izberi vse"
                      />
                    </th>
                    <th className="border-b border-slate-200 px-3 py-0 text-left text-xs font-semibold text-slate-500 align-middle">
                      <div className="relative flex h-12 items-center gap-2 overflow-visible px-1">
                        <div
                          className="relative shrink-0 overflow-visible"
                          style={{ width: `${treeButtonDiameter}px`, height: `${treeRowHeight}px` }}
                        >
                          <div className="absolute inset-y-0 z-10 flex items-center justify-center" style={{ left: 0, width: `${treeButtonDiameter}px` }}>
                            <button
                              type="button"
                              onClick={onToggleAllExpanded}
                              className="inline-grid h-4 w-4 place-items-center rounded-[2px] border border-slate-300 text-slate-600"
                              aria-label="Razširi/skrij vse kategorije"
                            >
                              {allExpanded ? (
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
                        </div>
                        <span>Kategorija</span>
                      </div>
                    </th>
                    <th className="border-b border-slate-200 px-3 py-2 text-left text-xs font-semibold text-slate-500">Opis</th>
                    <th className="border-b border-slate-200 px-3 py-2 text-center text-xs font-semibold text-slate-500">Podkategorije</th>
                    <th className="border-b border-slate-200 px-3 py-2 text-center text-xs font-semibold text-slate-500">Izdelki</th>
                    <th className="h-11 border-b border-slate-200 px-3 py-0 text-center text-xs font-semibold text-slate-500 align-middle">
                      <div className="relative flex h-8 items-center justify-center" ref={statusHeaderMenuRef}>
                        <button
                          type="button"
                          onClick={onToggleStatusHeaderMenu}
                          className={`inline-flex h-7 items-center rounded-full border px-2 text-xs font-semibold ${
                            selectedRows.length > 0
                              ? 'border-slate-300 bg-white text-slate-700 hover:bg-[color:var(--hover-neutral)]'
                              : 'border-transparent bg-transparent text-slate-500 cursor-default'
                          }`}
                          aria-haspopup="menu"
                          aria-expanded={selectedRows.length > 0 ? isStatusHeaderMenuOpen : false}
                          disabled={selectedRows.length === 0}
                        >
                          {selectedRows.length > 0 ? `Vidnost ▾ (${selectedRows.length})` : 'Vidnost'}
                        </button>

                        {selectedRows.length > 0 && isStatusHeaderMenuOpen ? (
                          <MenuPanel className="absolute left-1/2 top-8 z-20 w-36 -translate-x-1/2">
                            <MenuItem
                              onClick={() => {
                                const nextStatuses = {
                                  ...statusByRow,
                                  ...Object.fromEntries(selectedRows.map((rowId) => [rowId, 'active' as CategoryStatus]))
                                };
                                onStageStatusChange(nextStatuses);
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
                                onStageStatusChange(nextStatuses);
                              }}
                            >
                              Neaktivna
                            </MenuItem>
                          </MenuPanel>
                        ) : null}
                      </div>
                    </th>
                    <th className="border-b border-slate-200 px-3 py-2 text-center text-xs font-semibold text-slate-500">Uredi</th>
                  </tr>
                </thead>

                <tbody>{treeRows}</tbody>
              </table>
            </SortableContext>
          </DndContext>
        </AdminTableLayout>
      </section>
    </div>
  );
}
