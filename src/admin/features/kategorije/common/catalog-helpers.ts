import type { CatalogCategory, CatalogSubcategory } from '@/commercial/catalog/catalog';
import type {
  CatalogData,
  CategoryStatus,
  RecursiveCatalogCategory,
  RecursiveCatalogSubcategory
} from './types';

function normalizeCatalogImage(value: unknown): string {
  if (typeof value !== 'string') return '';
  const trimmed = value.trim();
  if (!trimmed) return '';
  return trimmed.startsWith('data:image/') ? '' : trimmed;
}

export const CATEGORY_STATUS_STORAGE_KEY = 'admin-categories-status-v1';
export const rootId = 'root';
export const catId = (slug: string) => `cat:${slug}`;
export const subPathKey = (subPath: string[]) => subPath.join('__');
export const subId = (categorySlug: string, subPath: string | string[]) =>
  `sub:${categorySlug}:${subPathKey(Array.isArray(subPath) ? subPath : [subPath])}`;
export const itemId = (catSlug: string, itemSlug: string, subPath?: string | string[]) =>
  `item:${catSlug}:${subPathKey(toSubcategoryPath(subPath)) || '_'}:${itemSlug}`;
export const slugify = (value: string) =>
  value.toLowerCase().trim().replace(/\s+/g, '-').replace(/[^a-z0-9-čšžćđ]/gi, '');

const createNodeId = () =>
  typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `id-${Math.random().toString(36).slice(2, 11)}`;

export const toSubcategoryPath = (value?: string | string[]) =>
  Array.isArray(value) ? value : value ? [value] : [];

export const pathEquals = (left?: string | string[], right?: string | string[]) => {
  const normalizedLeft = toSubcategoryPath(left);
  const normalizedRight = toSubcategoryPath(right);

  return (
    normalizedLeft.length === normalizedRight.length &&
    normalizedLeft.every((part, index) => part === normalizedRight[index])
  );
};

export const areStatusesEqual = (left: Record<string, CategoryStatus>, right: Record<string, CategoryStatus>) => {
  const leftKeys = Object.keys(left);
  const rightKeys = Object.keys(right);
  if (leftKeys.length !== rightKeys.length) return false;
  return leftKeys.every((key) => left[key] === right[key]);
};

const normalizeNodeId = (value: unknown, fallbackSeed: string) => {
  if (typeof value === 'string' && value.trim().length > 0) return value.trim();

  let hash = 0;
  for (const char of fallbackSeed) {
    hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  }

  return `id-${hash.toString(36)}`;
};

type RecursiveNode = RecursiveCatalogSubcategory;

const normalizeRecursiveSubcategory = (
  input: unknown,
  categoryIdSeed: string,
  parentPath: string[]
): RecursiveNode | null => {
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
    image: normalizeCatalogImage(subcategory.image),
    createdAt: typeof subcategory.createdAt === 'string' ? subcategory.createdAt : undefined,
    updatedAt: typeof subcategory.updatedAt === 'string' ? subcategory.updatedAt : undefined,
    items: Array.isArray(subcategory.items) ? subcategory.items : [],
    subcategories: Array.isArray(subcategory.subcategories)
      ? subcategory.subcategories
          .map((child) => normalizeRecursiveSubcategory(child, categoryIdSeed, currentPath))
          .filter((entry): entry is RecursiveNode => entry !== null)
      : []
  };
};

export function normalizeCatalogData(input: unknown): CatalogData {
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
        image: normalizeCatalogImage(category.image),
        adminNotes: typeof category.adminNotes === 'string' ? category.adminNotes : undefined,
        bannerImage: normalizeCatalogImage(category.bannerImage) || undefined,
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

export const areCatalogsEqual = (left: CatalogData, right: CatalogData) =>
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

export const areMillerCatalogsEqual = (left: CatalogData, right: CatalogData) =>
  JSON.stringify(stripNodeIds(normalizeCatalogData(left))) ===
  JSON.stringify(stripNodeIds(normalizeCatalogData(right)));

export const parseSubNodeId = (value: string): { categorySlug: string; subcategoryPath: string[] } | null => {
  if (!value.startsWith('sub:')) return null;

  const [, categorySlug, pathKey = ''] = value.split(':');
  if (!categorySlug) return null;

  return {
    categorySlug,
    subcategoryPath: pathKey ? pathKey.split('__').filter(Boolean) : []
  };
};

export const parseItemNodeId = (value: string): { categorySlug: string; subcategoryPath: string[]; subcategorySlug?: string; itemSlug: string } | null => {
  if (!value.startsWith('item:')) return null;

  const [, categorySlug, subcategorySlug, itemSlug] = value.split(':');
  if (!categorySlug || !itemSlug) return null;

  const subcategoryPath = subcategorySlug && subcategorySlug !== '_' ? subcategorySlug.split('__').filter(Boolean) : [];

  return {
    categorySlug,
    subcategoryPath,
    subcategorySlug: subcategoryPath.at(-1),
    itemSlug
  };
};

export function findSubcategoryByPath(nodes: RecursiveNode[], path: string[]): RecursiveNode | null {
  if (path.length === 0) return null;

  const current = nodes.find((node) => node.slug === path[0]);
  if (!current) return null;
  if (path.length === 1) return current;

  return findSubcategoryByPath(current.subcategories, path.slice(1));
}

export function updateSubcategoryTree(
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

export function removeSubcategoryTree(nodes: RecursiveNode[], path: string[]): RecursiveNode[] {
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


export function mapSubcategoryTree(
  nodes: RecursiveNode[],
  mapper: (node: RecursiveNode, path: string[]) => RecursiveNode,
  parentPath: string[] = []
): RecursiveNode[] {
  return nodes.map((node) => {
    const currentPath = [...parentPath, node.slug];
    return mapper(
      {
        ...node,
        subcategories: mapSubcategoryTree(node.subcategories, mapper, currentPath)
      },
      currentPath
    );
  });
}

export function findSubcategoryById(nodes: RecursiveNode[], id: string): { node: RecursiveNode; path: string[] } | null {
  const visit = (entries: RecursiveNode[], parentPath: string[] = []): { node: RecursiveNode; path: string[] } | null => {
    for (const node of entries) {
      const currentPath = [...parentPath, node.slug];
      if (node.id === id) return { node, path: currentPath };
      const nested = visit(node.subcategories, currentPath);
      if (nested) return nested;
    }

    return null;
  };

  return visit(nodes);
}

export function insertAtIndex<T>(items: T[], index: number, values: T[]): T[] {
  const next = [...items];
  next.splice(Math.max(0, Math.min(index, next.length)), 0, ...values);
  return next;
}

export function collectSubcategoryIds(
  categorySlug: string,
  nodes: RecursiveNode[],
  parentPath: string[] = []
): string[] {
  return nodes.flatMap((node) => {
    const currentPath = [...parentPath, node.slug];
    return [subId(categorySlug, currentPath), ...collectSubcategoryIds(categorySlug, node.subcategories, currentPath)];
  });
}

export function collectExpandableSubcategoryIds(
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

export function filterSubcategoryTree(nodes: RecursiveNode[], searchQuery: string): RecursiveNode[] {
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

export function pruneSelectedSubcategoryTree(
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

export function summarizeCatalogChanges(
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
    if (!nextById.has(category.id)) lines.push(`izbrisana kategorija "${category.title}"`);
  }

  for (const { category } of nextById.values()) {
    if (!prevById.has(category.id)) lines.push(`dodana kategorija "${category.title}"`);
  }

  const prevSubsById = new Map<string, { title: string; image: string; index: number; parentId: string; parentLabel: string }>();
  const nextSubsById = new Map<string, { title: string; image: string; index: number; parentId: string; parentLabel: string }>();

  prevCats.forEach((category) => {
    flattenSubcategories(category.slug, category.subcategories, [], category.title).forEach((entry) => prevSubsById.set(entry.id, entry));
  });
  nextCats.forEach((category) => {
    flattenSubcategories(category.slug, category.subcategories, [], category.title).forEach((entry) => nextSubsById.set(entry.id, entry));
  });

  for (const [id, prevSub] of prevSubsById.entries()) {
    if (!nextSubsById.has(id)) lines.push(`izbrisana podkategorija "${prevSub.title}"`);
  }
  for (const [id, nextSub] of nextSubsById.entries()) {
    if (!prevSubsById.has(id)) lines.push(`dodana podkategorija pod "${nextSub.parentLabel}": "${nextSub.title}"`);
  }
  for (const [id, prevSub] of prevSubsById.entries()) {
    const nextSub = nextSubsById.get(id);
    if (!nextSub) continue;
    if (prevSub.title !== nextSub.title) lines.push(`preimenovana podkategorija "${prevSub.title}" → "${nextSub.title}"`);
    if (prevSub.image !== nextSub.image) lines.push(`spremenjena slika za podkategorijo "${nextSub.title}"`);
    if (prevSub.parentId !== nextSub.parentId || prevSub.index !== nextSub.index) lines.push(`premaknjena podkategorija "${nextSub.title}"`);
  }

  for (const [id, { category: oldCat, index: oldIndex }] of prevById.entries()) {
    const match = nextById.get(id);
    if (!match) continue;
    const newCat = match.category;
    if (oldCat.title !== newCat.title) lines.push(`preimenovana kategorija "${oldCat.title}" → "${newCat.title}"`);
    if ((oldCat.image ?? '') !== (newCat.image ?? '')) lines.push(`spremenjena slika za kategorijo "${newCat.title}"`);
    if (oldIndex !== match.index) lines.push(`premaknjena kategorija "${newCat.title}"`);
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

const flattenSubcategories = (
  categorySlug: string,
  nodes: RecursiveNode[],
  parentPath: string[] = [],
  parentLabel: string
): Array<{ id: string; title: string; image: string; index: number; parentId: string; parentLabel: string }> => {
  return nodes.flatMap((node, index) => {
    const currentPath = [...parentPath, node.slug];
    const currentId = subId(categorySlug, currentPath);
    const current = {
      id: currentId,
      title: node.title,
      image: node.image ?? '',
      index,
      parentId: parentPath.length === 0 ? catId(categorySlug) : subId(categorySlug, parentPath),
      parentLabel
    };

    return [current, ...flattenSubcategories(categorySlug, node.subcategories, currentPath, node.title)];
  });
};

const buildLabelMap = (categories: RecursiveCatalogCategory[]) => {
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
};

export const createCatalogNodeId = createNodeId;
