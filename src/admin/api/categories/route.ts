import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import type { CatalogCategory, RecursiveCatalogCategory, RecursiveCatalogSubcategory } from '@/shared/domain/catalog/catalogTypes';
import { normalizeCatalogData } from '@/shared/server/catalogAdmin';
import { CATALOG_ADMIN_TAG, CATALOG_PUBLIC_TAG, CATALOG_REVALIDATE_PATHS, getCatalogDataFromDatabase, getCatalogPreviewDataFromDatabase, patchCategoryTree, replaceCategoryTree } from '@/shared/server/catalogCategories';
import { recordCatalogInvalidation } from '@/shared/server/catalogDiagnostics';
import { computeObjectDiff, countAuditChangedFields, diffHasEntries } from '@/shared/audit/auditDiff';
import { insertAuditEventForRequest } from '@/shared/server/audit';

type CategoryStatus = 'active' | 'inactive';

type CategoryAuditRow = {
  id: string;
  parentId: string | null;
  slug: string;
  title: string;
  summary: string;
  description: string;
  image: string | null;
  adminNotes: string | null;
  bannerImage: string | null;
  position: number;
  status: CategoryStatus;
};

const categoryAuditFields = [
  'title',
  'slug',
  'parentId',
  'summary',
  'description',
  'image',
  'adminNotes',
  'bannerImage',
  'position',
  'status'
];

function flattenCategoryAuditRows(
  categories: RecursiveCatalogCategory[],
  statuses: Record<string, CategoryStatus> = {}
) {
  const rows = new Map<string, CategoryAuditRow>();

  const visitSubcategories = (
    categorySlug: string,
    parentId: string,
    nodes: RecursiveCatalogSubcategory[],
    parentPath: string[] = []
  ) => {
    nodes.forEach((node, index) => {
      const path = [...parentPath, node.slug];
      const rowKey = `sub:${categorySlug}:${path.join('/')}`;
      rows.set(node.id, {
        id: node.id,
        parentId,
        slug: node.slug,
        title: node.title,
        summary: '',
        description: node.description,
        image: node.image ?? null,
        adminNotes: node.adminNotes ?? null,
        bannerImage: null,
        position: index,
        status: statuses[rowKey] ?? 'active'
      });
      visitSubcategories(categorySlug, node.id, node.subcategories, path);
    });
  };

  categories.forEach((category, index) => {
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
      position: index,
      status: statuses[`cat:${category.slug}`] ?? 'active'
    });
    visitSubcategories(category.slug, category.id, category.subcategories);
  });

  return rows;
}

async function getCategoryAuditSnapshot() {
  const payload = await getCatalogDataFromDatabase({
    includeInactive: true,
    includeStatuses: true,
    diagnosticsContext: '/api/admin/categories:audit-before'
  }) as { categories: RecursiveCatalogCategory[]; statuses?: Record<string, CategoryStatus> };
  return flattenCategoryAuditRows(payload.categories, payload.statuses ?? {});
}

function getCategoryPathSegments(row: CategoryAuditRow | null | undefined, rowsById: Map<string, CategoryAuditRow>) {
  if (!row) return [];
  const segments: string[] = [];
  const seen = new Set<string>();
  let current: CategoryAuditRow | null | undefined = row;

  while (current && !seen.has(current.id)) {
    seen.add(current.id);
    segments.unshift(current.title || current.slug || current.id);
    current = current.parentId ? rowsById.get(current.parentId) : null;
  }

  return segments;
}

function getParentCategoryPathLabel(parentId: string | null | undefined, rowsById: Map<string, CategoryAuditRow>) {
  if (!parentId) return '';
  const parent = rowsById.get(parentId);
  if (!parent) return parentId;
  return getCategoryPathSegments(parent, rowsById).join('/');
}

function localizeCategoryParentDiff(
  diff: ReturnType<typeof computeObjectDiff>,
  before: CategoryAuditRow | null,
  after: CategoryAuditRow | null,
  beforeRowsById: Map<string, CategoryAuditRow>,
  afterRowsById: Map<string, CategoryAuditRow>
) {
  const parentEntry = diff.parentId;
  if (parentEntry && 'before' in parentEntry && 'after' in parentEntry) {
    parentEntry.before = getParentCategoryPathLabel(before?.parentId, beforeRowsById);
    parentEntry.after = getParentCategoryPathLabel(after?.parentId, afterRowsById);
  }
  return diff;
}

function toCategoryAuditRow(entry: {
  id: string;
  parentId: string | null;
  slug: string;
  title: string;
  summary: string;
  description: string;
  image: string | null;
  adminNotes?: string | null;
  bannerImage?: string | null;
  position: number;
  status: CategoryStatus;
}): CategoryAuditRow {
  return {
    id: entry.id,
    parentId: entry.parentId,
    slug: entry.slug,
    title: entry.title,
    summary: entry.summary,
    description: entry.description,
    image: entry.image,
    adminNotes: entry.adminNotes ?? null,
    bannerImage: entry.bannerImage ?? null,
    position: entry.position,
    status: entry.status
  };
}

function getCategoryAction(before: CategoryAuditRow | null, after: CategoryAuditRow | null) {
  if (!before && after) return 'created' as const;
  if (before && !after) return 'deleted' as const;
  if (before?.status === 'active' && after?.status === 'inactive') return 'archived' as const;
  if (before?.status === 'inactive' && after?.status === 'active') return 'restored' as const;
  if (before && after && (before.parentId !== after.parentId || before.position !== after.position)) return 'reordered' as const;
  return 'updated' as const;
}

function getCategorySummary(action: ReturnType<typeof getCategoryAction>, before: CategoryAuditRow | null, after: CategoryAuditRow | null) {
  if (action === 'created') return 'Kategorija dodana';
  if (action === 'deleted') return 'Kategorija izbrisana';
  if (action === 'archived') return 'Kategorija arhivirana';
  if (action === 'restored') return 'Kategorija obnovljena';
  if (action === 'reordered') return 'Spremenjen vrstni red kategorij';
  if (before && after && before.title !== after.title) return 'Kategorija preimenovana';
  return 'Kategorija posodobljena';
}

function formatCategoryCount(count: number) {
  if (count === 1) return '1 kategorija';
  if (count === 2) return '2 kategoriji';
  if (count === 3 || count === 4) return `${count} kategorije`;
  return `${count} kategorij`;
}

function getCategoryReorderSummary(count: number, movedCount = 0) {
  if (movedCount > 0) {
    return movedCount === 1 ? 'Premaknjena kategorija' : `Premaknjenih kategorij: ${movedCount}`;
  }
  return `Spremenjen vrstni red: ${formatCategoryCount(count)}`;
}

async function recordCategoryPatchAudit(
  request: Request,
  beforeRows: Map<string, CategoryAuditRow>,
  upserts: CategoryAuditRow[],
  deleteIds: string[]
) {
  const reorderEvents: Array<{ before: CategoryAuditRow; after: CategoryAuditRow; diff: ReturnType<typeof computeObjectDiff> }> = [];
  const afterRows = new Map(beforeRows);
  upserts.forEach((row) => afterRows.set(row.id, row));
  deleteIds.forEach((id) => afterRows.delete(id));

  for (const after of upserts) {
    const before = beforeRows.get(after.id) ?? null;
    const diff = localizeCategoryParentDiff(
      computeObjectDiff(before, after, { entityType: 'category', fields: categoryAuditFields }),
      before,
      after,
      beforeRows,
      afterRows
    );
    if (!diffHasEntries(diff)) continue;
    const action = getCategoryAction(before, after);
    if (action === 'reordered') {
      reorderEvents.push({ before: before as CategoryAuditRow, after, diff });
      continue;
    }
    await insertAuditEventForRequest(request, {
      entityType: 'category',
      entityId: after.id,
      entityLabel: after.title,
      action,
      summary: getCategorySummary(action, before, after),
      diff,
      metadata: {
        category_slug: after.slug,
        changed_field_count: countAuditChangedFields(diff)
      }
    });
  }

  if (reorderEvents.length > 0) {
    const changedFieldCount = reorderEvents.reduce((total, event) => total + countAuditChangedFields(event.diff), 0);
    const movedCount = reorderEvents.filter(({ before, after }) => before.parentId !== after.parentId).length;
    await insertAuditEventForRequest(request, {
      entityType: 'category',
      entityId: 'catalog_categories',
      entityLabel: 'Kategorije',
      action: 'reordered',
      summary: getCategoryReorderSummary(reorderEvents.length, movedCount),
      diff: {
        categories: {
          label: 'Kategorije',
          updated: reorderEvents.slice(0, 25).map(({ after, diff }) => ({
            id: after.id,
            label: after.title,
            changes: diff
          }))
        }
      },
      metadata: {
        changed_category_count: reorderEvents.length,
        moved_category_count: movedCount,
        changed_field_count: changedFieldCount
      }
    });
  }

  for (const id of deleteIds) {
    const before = beforeRows.get(id);
    if (!before) continue;
    await insertAuditEventForRequest(request, {
      entityType: 'category',
      entityId: before.id,
      entityLabel: before.title,
      action: 'deleted',
      summary: 'Kategorija izbrisana',
      diff: {
        status: {
          label: 'Status',
          before: before.status,
          after: 'izbrisano'
        }
      },
      metadata: {
        category_slug: before.slug
      }
    });
  }
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const view = url.searchParams.get('view');
    const catalog = view === 'preview'
      ? await getCatalogPreviewDataFromDatabase({ includeInactive: true, includeStatuses: true, diagnosticsContext: '/api/admin/categories?view=preview' })
      : await getCatalogDataFromDatabase({ includeInactive: true, includeStatuses: true });
    return NextResponse.json(catalog);
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : 'Napaka pri nalaganju.' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const payload = (await request.json()) as { categories?: CatalogCategory[]; statuses?: Record<string, 'active' | 'inactive'> };
    const normalized = normalizeCatalogData(payload);

    if (!Array.isArray(payload.categories)) {
      return NextResponse.json({ message: 'Neveljavni podatki.' }, { status: 400 });
    }

    if (!isValidCategoryTree(normalized.categories)) {
      return NextResponse.json({ message: 'Neveljavna struktura kategorij.' }, { status: 400 });
    }

    const beforeRows = await getCategoryAuditSnapshot();
    await replaceCategoryTree(normalized, payload.statuses ?? {});
    const afterRows = flattenCategoryAuditRows(normalized.categories as RecursiveCatalogCategory[], payload.statuses ?? {});
    await recordCategoryPatchAudit(
      request,
      beforeRows,
      Array.from(afterRows.values()),
      Array.from(beforeRows.keys()).filter((id) => !afterRows.has(id))
    );

    for (const target of CATALOG_REVALIDATE_PATHS) {
      revalidatePath(target.path, target.type);
    }

    recordCatalogInvalidation({
      context: '/api/admin/categories:save',
      tags: [CATALOG_PUBLIC_TAG, CATALOG_ADMIN_TAG],
      revalidatedPaths: CATALOG_REVALIDATE_PATHS.length
    });

    const savedCatalog = await getCatalogDataFromDatabase({
      includeInactive: true,
      includeStatuses: true,
      diagnosticsContext: '/api/admin/categories:save-after'
    });

    return NextResponse.json({ ok: true, ...savedCatalog });
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : 'Napaka pri shranjevanju.' }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const payload = (await request.json()) as {
      upserts?: Array<{
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
        items?: unknown;
        position: number;
        status: 'active' | 'inactive';
      }>;
      deleteIds?: string[];
    };

    const upserts = Array.isArray(payload.upserts)
      ? payload.upserts.map((entry) => ({
          ...entry,
          items: Array.isArray(entry.items) ? entry.items : []
        }))
      : [];
    const deleteIds = Array.isArray(payload.deleteIds) ? payload.deleteIds.filter((entry): entry is string => typeof entry === 'string' && entry.length > 0) : [];

    const beforeRows = await getCategoryAuditSnapshot();
    await patchCategoryTree({ upserts, deleteIds });
    await recordCategoryPatchAudit(request, beforeRows, upserts.map(toCategoryAuditRow), deleteIds);

    for (const target of CATALOG_REVALIDATE_PATHS) {
      revalidatePath(target.path, target.type);
    }

    recordCatalogInvalidation({
      context: '/api/admin/categories:patch',
      tags: [CATALOG_PUBLIC_TAG, CATALOG_ADMIN_TAG],
      revalidatedPaths: CATALOG_REVALIDATE_PATHS.length
    });

    const savedCatalog = await getCatalogDataFromDatabase({
      includeInactive: true,
      includeStatuses: true,
      diagnosticsContext: '/api/admin/categories:patch-after'
    });

    return NextResponse.json({ ok: true, ...savedCatalog });
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : 'Napaka pri shranjevanju.' }, { status: 500 });
  }
}

type ValidatedCategoryNode = {
  id: string;
  slug: string;
  subcategories?: ValidatedCategoryNode[];
};

function areSiblingCategoryNodesValid(nodes: ValidatedCategoryNode[], seenIds: Set<string>): boolean {
  const siblingSlugs = new Set<string>();

  for (const node of nodes) {
    const normalizedSlug = node.slug.trim();
    const normalizedId = node.id.trim();

    if (!normalizedSlug || siblingSlugs.has(normalizedSlug)) return false;
    if (!normalizedId || seenIds.has(normalizedId)) return false;

    siblingSlugs.add(normalizedSlug);
    seenIds.add(normalizedId);

    if (!areSiblingCategoryNodesValid(node.subcategories ?? [], seenIds)) return false;
  }

  return true;
}

function isValidCategoryTree(categories: CatalogCategory[]): boolean {
  return areSiblingCategoryNodesValid(categories as ValidatedCategoryNode[], new Set<string>());
}
