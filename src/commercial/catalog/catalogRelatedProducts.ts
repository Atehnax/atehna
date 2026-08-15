import {
  catalogCategoryHref,
  catalogCategoryItemHref,
  catalogSubcategoryHref,
  toPublicCatalogSlug
} from '@/commercial/catalog/catalogRoutes';
import {
  getCatalogCategoryItemPrice,
  getCatalogCategoryItemSku,
  getCatalogItemPrice,
  getCatalogItemSku
} from '@/commercial/catalog/catalogUtils';
import {
  selectRelatedProductCandidates,
  type RelatedProductCandidate
} from '@/commercial/features/products/relatedProductSelection';
import type { CatalogProductPresentationContext } from '@/commercial/features/products/storefrontProduct';
import type {
  CatalogCategory,
  CatalogItem,
  CatalogSubcategory
} from '@/shared/domain/catalog/catalogTypes';
import {
  resolveProductAppearanceConfig,
  type ProductAppearanceConfig
} from '@/shared/domain/style/productAppearance';

type CatalogRelatedCategory = Pick<
  CatalogCategory,
  'id' | 'slug' | 'title'
>;

type CatalogRelatedSubcategory = Pick<
  CatalogSubcategory,
  'id' | 'slug' | 'title'
>;

export type CatalogRelatedItem = {
  item: CatalogItem;
  category: CatalogRelatedCategory;
  subcategory: CatalogRelatedSubcategory | null;
};

export function buildCatalogRelatedPresentationContext(
  related: CatalogRelatedItem
): CatalogProductPresentationContext {
  const { item, category, subcategory } = related;
  return {
    href: catalogCategoryItemHref(category.slug, item.slug),
    fallbackSku: subcategory
      ? getCatalogItemSku(category.slug, subcategory.slug, item.slug)
      : getCatalogCategoryItemSku(category.slug, item.slug),
    fallbackPrice:
      item.price ??
      (subcategory
        ? getCatalogItemPrice(category.slug, subcategory.slug, item.slug)
        : getCatalogCategoryItemPrice(category.slug, item.slug)),
    category: {
      slug: category.slug,
      title: category.title,
      href: catalogCategoryHref(category.slug)
    },
    ...(subcategory
      ? {
          subcategory: {
            slug: subcategory.slug,
            title: subcategory.title,
            href: catalogSubcategoryHref(category.slug, subcategory.slug)
          }
        }
      : {})
  };
}

type CatalogItemsIndex = Array<
  CatalogRelatedCategory & {
    items: CatalogItem[];
    subcategories: Array<
      CatalogRelatedSubcategory & {
        items: CatalogItem[];
      }
    >;
  }
>;

const normalizeSlug = (value: string | null | undefined) =>
  toPublicCatalogSlug(value ?? '');

function flattenCatalogItems(
  categories: readonly CatalogItemsIndex[number][]
): CatalogRelatedItem[] {
  return categories.flatMap((category) => {
    const categoryContext: CatalogRelatedCategory = {
      id: category.id,
      slug: category.slug,
      title: category.title
    };
    return [
      ...category.items.map((item) => ({
        item,
        category: categoryContext,
        subcategory: null
      })),
      ...category.subcategories.flatMap((subcategory) => {
        const subcategoryContext: CatalogRelatedSubcategory = {
          id: subcategory.id,
          slug: subcategory.slug,
          title: subcategory.title
        };
        return subcategory.items.map((item) => ({
          item,
          category: categoryContext,
          subcategory: subcategoryContext
        }));
      })
    ];
  });
}

function rankAutomaticCandidates(
  entries: readonly CatalogRelatedItem[],
  current: CatalogRelatedItem
) {
  const categorySlug = normalizeSlug(current.category.slug);
  const subcategorySlug = normalizeSlug(current.subcategory?.slug);
  const sameLeaf: CatalogRelatedItem[] = [];
  const sameCategory: CatalogRelatedItem[] = [];
  const otherCategories: CatalogRelatedItem[] = [];

  for (const entry of entries) {
    if (normalizeSlug(entry.category.slug) !== categorySlug) {
      otherCategories.push(entry);
      continue;
    }
    if (normalizeSlug(entry.subcategory?.slug) === subcategorySlug) {
      sameLeaf.push(entry);
      continue;
    }
    sameCategory.push(entry);
  }

  return [...sameLeaf, ...sameCategory, ...otherCategories];
}

/**
 * Builds related-product results from the complete public catalogue index.
 *
 * The selected entries retain their own category/subcategory context. This is
 * essential for manually related products outside the current category: their
 * public href, fallback SKU and fallback price must be derived from the target
 * product's path rather than from the current product's path.
 */
export function selectCatalogRelatedItems(
  categories: CatalogItemsIndex,
  current: CatalogRelatedItem,
  globalAppearance: ProductAppearanceConfig
): CatalogRelatedItem[] {
  const appearance = resolveProductAppearanceConfig(
    globalAppearance,
    current.item.appearanceOverride
  );
  const rankedEntries = rankAutomaticCandidates(
    flattenCatalogItems(categories),
    current
  );
  const candidates: Array<
    RelatedProductCandidate<CatalogRelatedItem>
  > = rankedEntries.map((entry) => ({
    product: entry,
    slug: entry.item.slug,
    categorySlug: entry.category.slug,
    subcategorySlug: entry.subcategory?.slug ?? null
  }));

  return selectRelatedProductCandidates({
    currentSlug: current.item.slug,
    currentCategorySlug: current.category.slug,
    currentSubcategorySlug: current.subcategory?.slug ?? null,
    candidates,
    config: appearance.relatedProducts
  }).map((candidate) => candidate.product);
}
