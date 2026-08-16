import {
  buildStorefrontProductFromCatalogItem,
  toStorefrontProductSummary,
  type StorefrontProduct
} from '@/commercial/features/products/storefrontProduct';
import { buildCatalogPresentationDetails } from '@/shared/domain/catalog/catalogPresentation';
import type { CatalogItem } from '@/shared/domain/catalog/catalogTypes';
import type {
  AdminCatalogListItem,
  CatalogItemEditorHydration
} from '@/shared/domain/catalog/catalogAdminTypes';
import type { ProductAppearanceConfig } from '@/shared/domain/style/productAppearance';

const slugify = (value: string) =>
  value
    .toLocaleLowerCase('sl')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || 'izdelki';

type ProductAppearancePreviewRelatedOptions = {
  productOptions: AdminCatalogListItem[];
  relatedProducts: ProductAppearanceConfig['relatedProducts'];
};

const categoryParts = (value: string) =>
  value
    .split('/')
    .map((part) => part.trim())
    .filter(Boolean);

const manualRelatedProductSlugs = (item: CatalogItemEditorHydration) => {
  const override = item.appearanceOverride;
  if (!override || typeof override !== 'object' || Array.isArray(override)) return [];
  const related = override.relatedProducts;
  if (!related || typeof related !== 'object' || Array.isArray(related)) return [];
  const slugs = (related as Record<string, unknown>).manualProductSlugs;
  return Array.isArray(slugs)
    ? Array.from(new Set(
        slugs
          .filter((slug): slug is string => typeof slug === 'string')
          .map((slug) => slug.trim())
          .filter((slug) => slug && slug !== item.slug)
      ))
    : [];
};

const isAutomaticRelatedProduct = (
  candidate: AdminCatalogListItem,
  selectedCategoryPath: string[],
  mode: ProductAppearanceConfig['relatedProducts']['sourceMode']
) => {
  if (mode === 'manual-only' || selectedCategoryPath.length === 0) return false;
  const candidatePath = categoryParts(candidate.categoryLabel);
  if (candidatePath.length === 0) return false;
  if (mode === 'same-subcategory') {
    return candidatePath.join('\u0000') === selectedCategoryPath.join('\u0000');
  }
  return candidatePath[0] === selectedCategoryPath[0];
};

const buildRelatedProductSummary = (item: AdminCatalogListItem) => {
  const path = categoryParts(item.categoryLabel);
  const categoryTitle = path[0] ?? 'Izdelki';
  const categorySlug = slugify(categoryTitle);
  const catalogItem = {
    id: item.id,
    slug: item.slug,
    name: item.itemName,
    productType: item.productType,
    description: item.description ?? '',
    brand: item.brand,
    sku: item.baseSku,
    unit: item.unit,
    material: item.material,
    badge: item.badge,
    status: item.status,
    taxRate: item.taxRate,
    defaultVariantId: item.defaultVariantId,
    variants: item.variants.map((variant) => ({
      ...variant,
      unit: item.unit ?? 'kos',
      taxRate: item.taxRate
    })),
    ...(item.imageUrl
      ? {
          media: [{
            id: `admin-related-${item.id}-image`,
            mediaKind: 'image',
            role: 'gallery',
            url: item.imageUrl,
            altText: item.itemName,
            variantIds: []
          }]
        }
      : {})
  } as unknown as CatalogItem;
  const product = buildStorefrontProductFromCatalogItem(catalogItem, {
    href: `/products/${categorySlug}/items/${item.slug}`,
    fallbackSku: item.baseSku ?? `ART-${item.id}`,
    fallbackPrice: item.minPrice,
    category: {
      slug: categorySlug,
      title: categoryTitle,
      href: `/products/${categorySlug}`
    },
    ...(path.length > 1
      ? {
          subcategory: {
            slug: slugify(path.at(-1) ?? ''),
            title: path.at(-1) ?? '',
            href: `/products/${categorySlug}/${slugify(path.at(-1) ?? '')}`
          }
        }
      : {})
  });
  return toStorefrontProductSummary(product, item.categoryLabel || categoryTitle);
};

function buildPreviewRelatedProducts(
  item: CatalogItemEditorHydration,
  options: ProductAppearancePreviewRelatedOptions
) {
  const eligible = options.productOptions.filter((candidate) =>
    candidate.slug !== item.slug
    && candidate.status === 'active'
    && candidate.variants.some((variant) => variant.status === 'active')
  );
  const eligibleBySlug = new Map(eligible.map((candidate) => [candidate.slug, candidate]));
  const manual = manualRelatedProductSlugs(item).flatMap((slug) => {
    const candidate = eligibleBySlug.get(slug);
    return candidate ? [candidate] : [];
  });
  const selectedCategoryPath = item.categoryPath.map((part) => part.trim()).filter(Boolean);
  const automatic = eligible.filter((candidate) =>
    isAutomaticRelatedProduct(
      candidate,
      selectedCategoryPath,
      options.relatedProducts.sourceMode
    )
  );
  const ordered = options.relatedProducts.sourceMode === 'manual-only'
    ? manual
    : options.relatedProducts.manualPlacement === 'before-auto'
      ? [...manual, ...automatic]
      : [...automatic, ...manual];
  const seen = new Set<string>();
  return ordered.flatMap((candidate) => {
    if (seen.has(candidate.slug)) return [];
    seen.add(candidate.slug);
    return [buildRelatedProductSummary(candidate)];
  });
}

export function buildProductAppearancePreviewProduct(
  item: CatalogItemEditorHydration,
  preferredVariantId?: number | null,
  relatedOptions?: ProductAppearancePreviewRelatedOptions
): StorefrontProduct {
  const galleryMedia = item.media
    .filter((media) => media.mediaKind === 'image' && media.role === 'gallery')
    .sort((left, right) => (left.position ?? 0) - (right.position ?? 0));
  const galleryIndexByMediaId = new Map(
    galleryMedia.map((media, index) => [media.id, index])
  );
  const media = item.media.map((entry) => {
    const galleryIndex = galleryIndexByMediaId.get(entry.id);
    const assignedVariantIds = galleryIndex === undefined
      ? []
      : item.variants.flatMap((variant) =>
          variant.id && variant.imageAssignments?.includes(galleryIndex)
            ? [variant.id]
            : []
        );
    return {
      ...entry,
      url: entry.blobUrl ?? entry.externalUrl ?? '',
      variantIds: assignedVariantIds
    };
  });
  const presentation = buildCatalogPresentationDetails(
    item.productType,
    item.typeSpecificData
  );
  const categoryTitle = item.categoryPath[0] ?? 'Izdelki';
  const categorySlug = slugify(categoryTitle);
  const subcategoryTitle = item.categoryPath.length > 1
    ? item.categoryPath.at(-1) ?? null
    : null;
  const subcategorySlug = subcategoryTitle
    ? slugify(subcategoryTitle)
    : null;
  const previewVariantId =
    preferredVariantId
    ?? item.defaultVariantId
    ?? item.variants.find((variant) => variant.status === 'active')?.id
    ?? item.variants[0]?.id
    ?? null;
  const catalogItem = {
    id: item.id,
    slug: item.slug,
    name: item.itemName,
    productType: item.productType,
    description: item.description ?? '',
    brand: item.brand,
    badge: item.badge,
    sku: item.sku,
    unit: item.unit,
    material: item.material,
    colour: item.colour,
    shape: item.shape,
    taxRate: item.taxRate,
    status: item.status === 'active' ? 'active' : 'inactive',
    appearanceOverride: item.appearanceOverride,
    defaultVariantId: previewVariantId,
    optionAxes: item.optionAxes,
    variants: item.variants,
    media,
    specifications: presentation.specifications,
    includedItems: presentation.includedItems,
    deliveryEstimate: presentation.deliveryEstimate
  } as unknown as CatalogItem;

  const product = buildStorefrontProductFromCatalogItem(catalogItem, {
    href: `/products/${categorySlug}/items/${item.slug}`,
    fallbackSku: item.sku ?? `ART-${item.id}`,
    fallbackPrice: item.variants[0]?.price ?? 0,
    category: {
      slug: categorySlug,
      title: categoryTitle,
      href: `/products/${categorySlug}`
    },
    ...(subcategoryTitle && subcategorySlug
      ? {
          subcategory: {
            slug: subcategorySlug,
            title: subcategoryTitle,
            href: `/products/${categorySlug}/${subcategorySlug}`
          }
        }
      : {})
  });
  if (relatedOptions) {
    product.relatedProducts = buildPreviewRelatedProducts(item, relatedOptions);
  }
  return product;
}
