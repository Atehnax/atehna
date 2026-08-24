import type { CatalogItem } from '@/shared/domain/catalog/catalogTypes';
import { resolveCatalogueDescription } from '@/commercial/catalog/catalogContentFallbacks';
import { getDiscountedPrice } from '@/commercial/catalog/catalogUtils';
import {
  plainTextToCatalogRichText,
  sanitizeCatalogRichText
} from '@/shared/domain/catalog/richText';
import { normalizeCatalogSpecificationToken } from '@/shared/domain/catalog/catalogSpecification';

export type StorefrontProductStatus = 'active' | 'inactive';
export type StorefrontMediaKind = 'image' | 'video' | 'document';

export type StorefrontProductMedia = {
  id: string;
  kind: StorefrontMediaKind;
  role: 'gallery' | 'technical_sheet';
  url: string;
  altText: string;
  filename?: string;
  mimeType?: string;
  variantIds: string[];
};

export type StorefrontOptionValue = {
  id: string;
  label: string;
  slug: string;
  position: number;
  swatch?: string;
};

export type StorefrontOptionAxis = {
  id: string;
  name: string;
  slug: string;
  position: number;
  values: StorefrontOptionValue[];
};

export type StorefrontSpecification = {
  id: string;
  label: string;
  value: string;
  group?: string;
  /** Immutable presentation/ordering identity; the visible label may differ. */
  orderKey?: string;
};

export type StorefrontDocument = {
  id: string;
  name: string;
  url: string;
  mimeType?: string;
  variantIds: string[];
};

export type StorefrontVariant = {
  id: string;
  commerceId: number | null;
  position: number;
  name: string;
  sku: string;
  optionValueIds: string[];
  baseUnitNet: number;
  discountPct: number;
  unitNet: number;
  taxRate: number;
  inventory: number | null;
  minOrder: number;
  unit: string;
  status: StorefrontProductStatus;
  badge?: string;
  attributes: Record<string, string>;
  mediaIds: string[];
  description?: string;
  descriptionHtml?: string;
  specifications: StorefrontSpecification[];
  includedItems: string[];
  documents: StorefrontDocument[];
  deliveryEstimate?: string;
  dimensions?: {
    length?: number;
    width?: number;
    thickness?: number;
  };
};

export type StorefrontBreadcrumb = {
  label: string;
  href?: string;
};

export type StorefrontProductSummary = {
  id: string;
  slug: string;
  href: string;
  name: string;
  shortDescription?: string;
  brand?: string;
  sku?: string;
  unit?: string;
  image?: StorefrontProductMedia;
  badge?: string;
  categoryLabel?: string;
  minUnitNet: number;
  maxUnitNet: number;
  baseUnitNet: number;
  taxRate: number;
  discountPct: number;
  displayVariant: StorefrontVariant | null;
  purchasableVariant: StorefrontVariant | null;
  hasMultipleVariants: boolean;
  isAvailable: boolean;
};

export type StorefrontProduct = {
  id: string;
  slug: string;
  href: string;
  name: string;
  shortDescription?: string;
  description?: string;
  descriptionHtml?: string;
  brand?: string;
  baseSku?: string;
  badge?: string;
  status: StorefrontProductStatus;
  breadcrumbs: StorefrontBreadcrumb[];
  media: StorefrontProductMedia[];
  optionAxes: StorefrontOptionAxis[];
  variants: StorefrontVariant[];
  defaultVariantId: string | null;
  specifications: StorefrontSpecification[];
  includedItems: string[];
  documents: StorefrontDocument[];
  deliveryEstimate?: string;
  relatedProducts: StorefrontProductSummary[];
  appearanceOverride?: unknown;
};

export type CatalogProductPresentationContext = {
  href: string;
  fallbackSku: string;
  fallbackPrice: number;
  category: {
    slug: string;
    title: string;
    href: string;
  };
  subcategory?: {
    slug: string;
    title: string;
    href: string;
  };
};

type UnknownRecord = Record<string, unknown>;

const asRecord = (value: unknown): UnknownRecord =>
  typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as UnknownRecord)
    : {};

const asArray = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);

const asString = (value: unknown, fallback = '') =>
  typeof value === 'string' && value.trim() ? value.trim() : fallback;

const asOptionalString = (value: unknown) => {
  const result = asString(value);
  return result || undefined;
};

const asIdentifier = (value: unknown, fallback = '') => {
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return asString(value, fallback);
};

const asOptionalIdentifier = (value: unknown) => {
  const result = asIdentifier(value);
  return result || undefined;
};

const asDisplayString = (value: unknown) => {
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return asString(value);
};

const asFiniteNumber = (value: unknown, fallback = 0) => {
  const result = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(result) ? result : fallback;
};

const asNullableNumber = (value: unknown): number | null => {
  if (value === null || value === undefined || value === '') return null;
  const result = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(result) ? result : null;
};

const asStatus = (value: unknown): StorefrontProductStatus =>
  asString(value, 'active') === 'inactive' ? 'inactive' : 'active';

const HTML_ENTITY_VALUES: Record<string, string> = {
  amp: '&',
  apos: "'",
  ccaron: 'č',
  Ccaron: 'Č',
  gt: '>',
  hellip: '…',
  laquo: '«',
  lt: '<',
  mdash: '—',
  nbsp: ' ',
  ndash: '–',
  quot: '"',
  raquo: '»',
  scaron: 'š',
  Scaron: 'Š',
  times: '×',
  zcaron: 'ž',
  Zcaron: 'Ž'
};

const decodeHtmlEntities = (value: string) =>
  value.replace(
    /&(#(?:x[\da-f]+|\d+)|[a-z][\da-z]+);/gi,
    (entity, encoded: string) => {
      if (encoded.startsWith('#')) {
        const hexadecimal = encoded[1]?.toLocaleLowerCase() === 'x';
        const codePoint = Number.parseInt(
          encoded.slice(hexadecimal ? 2 : 1),
          hexadecimal ? 16 : 10
        );
        return Number.isInteger(codePoint) &&
          codePoint >= 0 &&
          codePoint <= 0x10ffff &&
          !(codePoint >= 0xd800 && codePoint <= 0xdfff)
          ? String.fromCodePoint(codePoint)
          : entity;
      }
      return HTML_ENTITY_VALUES[encoded] ?? HTML_ENTITY_VALUES[encoded.toLocaleLowerCase()] ?? entity;
    }
  );

export function toStorefrontPlainText(value: unknown): string {
  if (typeof value !== 'string' || !value.trim()) return '';

  const hasHtmlMarkup = /<\/?[a-z][^>]*>/i.test(value);
  const textWithStructure = hasHtmlMarkup
    ? value
        .replace(/<!--[\s\S]*?-->/g, ' ')
        .replace(/<(?:script|style)\b[^>]*>[\s\S]*?<\/(?:script|style)>/gi, ' ')
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<li\b[^>]*>/gi, '\n• ')
        .replace(
          /<\/(?:address|article|aside|blockquote|div|dl|figcaption|figure|footer|h[1-6]|header|li|main|nav|ol|p|pre|section|table|tbody|td|tfoot|th|thead|tr|ul)>/gi,
          '\n'
        )
        .replace(/<[^>]+>/g, ' ')
    : value;

  return decodeHtmlEntities(textWithStructure)
    .replace(/\r\n?/g, '\n')
    .replace(/[^\S\n]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

const slugify = (value: string) =>
  value
    .toLocaleLowerCase('sl')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || 'vrednost';

const makeExcerpt = (value: string, maxLength = 180) => {
  const normalized = value.replace(/\s+/g, ' ').trim();
  if (normalized.length <= maxLength) return normalized;
  const clipped = normalized.slice(0, maxLength + 1);
  const lastSpace = clipped.lastIndexOf(' ');
  return `${clipped.slice(0, Math.max(lastSpace, maxLength - 24)).trim()}…`;
};

const normalizeStringList = (value: unknown) =>
  asArray(value)
    .map((entry) => asString(entry))
    .filter(Boolean);

const normalizeSpecifications = (
  value: unknown,
  prefix = 'specification'
): StorefrontSpecification[] => {
  if (Array.isArray(value)) {
    return value.reduce<StorefrontSpecification[]>((result, entry, index) => {
        const row = asRecord(entry);
        const label = asString(row.label ?? row.name ?? row.key);
        const specificationValue = asString(row.value);
        if (!label || !specificationValue) return result;
        result.push({
          id: asIdentifier(row.id, `${prefix}-${index}`),
          label,
          value: specificationValue,
          orderKey: normalizeCatalogSpecificationToken(
            asString(row.orderKey, label)
          ),
          ...(asOptionalString(row.group)
            ? { group: asOptionalString(row.group) }
            : {})
        });
        return result;
      }, []);
  }

  const record = asRecord(value);
  return Object.entries(record)
    .flatMap(([key, entry], index): StorefrontSpecification[] => {
      const specificationValue = asString(entry);
      if (!specificationValue) return [];
      return [{
        id: `${prefix}-${index}-${slugify(key)}`,
        label: key,
        value: specificationValue,
        orderKey: normalizeCatalogSpecificationToken(key)
      }];
    });
};

const ATTRIBUTE_LABELS: Record<string, string> = {
  length: 'Dolžina',
  width: 'Širina',
  thickness: 'Debelina',
  weight: 'Teža',
  material: 'Material',
  colour: 'Barva',
  color: 'Barva',
  shape: 'Oblika'
};

const normalizeAttributes = (
  raw: UnknownRecord,
  weightUnit: 'g' | 'kg' = 'kg'
): Record<string, string> => {
  const explicit = asRecord(raw.attributes);
  const entries = new Map<string, string>();

  for (const [key, value] of Object.entries(explicit)) {
    const normalized = asDisplayString(value);
    const label = ATTRIBUTE_LABELS[key] ?? key;
    const normalizedLabel = label.toLocaleLowerCase('sl');
    const numeric = Number.parseFloat(normalized.replace(',', '.'));
    if (
      (normalizedLabel === 'weight' ||
        normalizedLabel === 'teža' ||
        normalizedLabel === 'masa' ||
        normalizedLabel === 'neto masa') &&
      Number.isFinite(numeric) &&
      numeric <= 0
    ) {
      continue;
    }
    if (normalized) entries.set(label, normalized);
  }

  for (const key of ['length', 'width', 'thickness', 'weight'] as const) {
    const normalized = asDisplayString(raw[key]);
    if (!normalized) continue;
    const numeric = Number.parseFloat(normalized.replace(',', '.'));
    if (key === 'weight' && Number.isFinite(numeric) && numeric <= 0) continue;
    entries.set(
      ATTRIBUTE_LABELS[key],
      `${normalized} ${key === 'weight' ? weightUnit : 'mm'}`
    );
  }

  const tolerance = asDisplayString(raw.errorTolerance);
  if (tolerance) {
    entries.set(
      'Toleranca',
      `${tolerance.startsWith('±') ? '' : '±'}${tolerance}${
        tolerance.toLocaleLowerCase('sl').includes('mm') ? '' : ' mm'
      }`
    );
  }

  return Object.fromEntries(entries);
};

const normalizeDocuments = (
  value: unknown,
  fallbackMedia: StorefrontProductMedia[] = []
): StorefrontDocument[] => {
  const explicit = asArray(value).reduce<StorefrontDocument[]>(
    (result, entry, index) => {
      const row = asRecord(entry);
      const url = asString(row.url ?? row.blobUrl ?? row.externalUrl);
      if (!url) return result;
      const mimeType = asOptionalString(row.mimeType);
      const variantIds = asArray(row.variantIds)
        .flatMap((variantId) =>
          variantId === null || variantId === undefined
            ? []
            : [String(variantId)]
        );
      result.push({
        id: asIdentifier(row.id, `document-${index}`),
        name: asString(row.name ?? row.filename, `Dokument ${index + 1}`),
        url,
        ...(mimeType ? { mimeType } : {}),
        variantIds
      });
      return result;
    },
    []
  );

  if (explicit.length > 0) return explicit;

  return fallbackMedia
    .filter((media) => media.kind === 'document')
    .map((media) => ({
      id: media.id,
      name: media.filename ?? media.altText,
      url: media.url,
      mimeType: media.mimeType,
      variantIds: media.variantIds
    }));
};

const normalizeMedia = (item: UnknownRecord, itemName: string): StorefrontProductMedia[] => {
  const explicit = asArray(item.media).reduce<StorefrontProductMedia[]>(
    (result, entry, index) => {
      const row = asRecord(entry);
      const url = asString(row.url ?? row.blobUrl ?? row.externalUrl);
      if (!url || row.hidden === true) return result;
      const rawKind = asString(row.kind ?? row.mediaKind, 'image');
      const kind: StorefrontMediaKind =
        rawKind === 'video' || rawKind === 'document' ? rawKind : 'image';
      const variantIds = asArray(row.variantIds)
        .flatMap((variantId) =>
          variantId === null || variantId === undefined ? [] : [String(variantId)]
        );
      const filename = asOptionalString(row.filename);
      const mimeType = asOptionalString(row.mimeType);
      result.push({
        id: asIdentifier(row.id, `media-${index}`),
        kind,
        role:
          asString(row.role, 'gallery') === 'technical_sheet'
            ? 'technical_sheet'
            : 'gallery',
        url,
        altText: asString(row.altText, itemName),
        ...(filename ? { filename } : {}),
        ...(mimeType ? { mimeType } : {}),
        variantIds
      });
      return result;
    },
    []
  );

  return explicit;
};

const normalizeAxes = (item: UnknownRecord): StorefrontOptionAxis[] =>
  asArray(item.optionAxes)
    .reduce<StorefrontOptionAxis[]>((axes, entry, axisIndex) => {
      const row = asRecord(entry);
      const name = asString(row.name, `Možnost ${axisIndex + 1}`);
      const id = asIdentifier(row.id, `axis-${axisIndex}`);
      const values = asArray(row.values).reduce<StorefrontOptionValue[]>(
        (result, valueEntry, valueIndex) => {
          const valueRow = asRecord(valueEntry);
          const label = asString(valueRow.label ?? valueRow.value);
          if (!label) return result;
          const swatch = asOptionalString(valueRow.swatch);
          result.push({
            id: asIdentifier(valueRow.id, `${id}-value-${valueIndex}`),
            label,
            slug: asString(valueRow.slug, slugify(label)),
            position: asFiniteNumber(valueRow.position, valueIndex),
            ...(swatch ? { swatch } : {})
          });
          return result;
        },
        []
      );
      values.sort((left, right) => left.position - right.position);

      if (values.length === 0) return axes;
      axes.push({
        id,
        name,
        slug: asString(row.slug, slugify(name)),
        position: asFiniteNumber(row.position, axisIndex),
        values
      });
      return axes;
    }, [])
    .sort((left, right) => left.position - right.position);

const variantIsPurchasable = (variant: StorefrontVariant) =>
  variant.commerceId !== null &&
  variant.status === 'active' &&
  (variant.inventory === null || variant.inventory >= variant.minOrder);

const inferSyntheticAxisLabel = (
  item: UnknownRecord,
  variants: unknown[]
) => {
  const productType = asString(
    item.productType ?? item.editorProductType ?? item.product_type
  );
  if (productType === 'dimensions') return 'Dimenzije';
  if (productType === 'weight') return 'Pakiranje';
  if (productType) return 'Različica';

  const variantRows = variants.map(asRecord);
  const hasDimensions = variantRows.some((variant) =>
    ['length', 'width', 'thickness'].some((key) => {
      const numeric = asNullableNumber(variant[key]);
      return numeric !== null && numeric > 0;
    })
  );
  if (hasDimensions) return 'Dimenzije';

  const isMassLike = variantRows.some((variant) => {
    const unit = asString(variant.unit).toLocaleLowerCase('sl');
    const mass = asNullableNumber(variant.weight);
    return unit === 'kg' || unit === 'g' || (mass !== null && mass > 0);
  });
  return isMassLike ? 'Pakiranje' : 'Različica';
};

const normalizeParentSpecifications = (
  item: UnknownRecord
): StorefrontSpecification[] => {
  const specifications = normalizeSpecifications(item.specifications, 'product');
  const byLabel = new Map(
    specifications.map((entry) => [
      entry.label.toLocaleLowerCase('sl'),
      entry
    ])
  );
  const candidates: Array<[string, unknown]> = [
    ['Material', item.material],
    ['Barva', item.colour ?? item.color],
    ['Oblika', item.shape]
  ];

  candidates.forEach(([label, value], index) => {
    const normalized = asOptionalString(value);
    const key = label.toLocaleLowerCase('sl');
    if (!normalized || byLabel.has(key)) return;
    byLabel.set(key, {
      id: `product-attribute-${index}-${slugify(label)}`,
      label,
      value: normalized,
      orderKey: ['material', 'barva', 'oblika'][index]
    });
  });

  return [...byLabel.values()];
};

export function buildStorefrontProductFromCatalogItem(
  catalogItem: CatalogItem,
  context: CatalogProductPresentationContext
): StorefrontProduct {
  const item = asRecord(catalogItem);
  const productType = asString(
    item.productType ?? item.editorProductType ?? item.product_type
  );
  const name = asString(item.name, 'Artikel');
  const storedDescription = asString(item.description);
  const storedDescriptionHtml = sanitizeCatalogRichText(storedDescription);
  const storedDescriptionText = toStorefrontPlainText(storedDescription);
  const description = resolveCatalogueDescription({
    slug: catalogItem.slug,
    name,
    description: storedDescriptionText
  });
  const descriptionHtml = description !== storedDescriptionText
    ? plainTextToCatalogRichText(description)
    : storedDescriptionHtml || plainTextToCatalogRichText(description);
  const media = normalizeMedia(item, name);
  let axes = normalizeAxes(item);

  const rawVariants = asArray(item.variants);
  const sourceVariants =
    rawVariants.length > 0
      ? rawVariants
      : [
          {
            id: null,
            variantName: name,
            variantSku: context.fallbackSku,
            price: item.price ?? context.fallbackPrice,
            discountPct: item.discountPct ?? 0,
            inventory: null,
            minOrder: 1,
            status: item.status ?? 'active'
          }
        ];

  const normalizedVariants = sourceVariants.map((entry, index): StorefrontVariant => {
    const raw = asRecord(entry);
    const contentOverride = asRecord(raw.contentOverride);
    const commerceId = asNullableNumber(raw.id);
    const id = commerceId === null ? `fallback-${catalogItem.slug}-${index}` : String(commerceId);
    const baseUnitNet = Math.max(0, asFiniteNumber(raw.price, context.fallbackPrice));
    const discountPct = Math.min(100, Math.max(0, asFiniteNumber(raw.discountPct, 0)));
    const inventory = asNullableNumber(raw.inventory);
    const optionValueIds = asArray(raw.optionValueIds).map(String);
    const length = asNullableNumber(raw.length);
    const width = asNullableNumber(raw.width);
    const thickness = asNullableNumber(raw.thickness);
    const attributes = normalizeAttributes(
      {
        ...raw,
        ...contentOverride,
        attributes: contentOverride.attributes ?? raw.attributes
      },
      productType === 'dimensions' ? 'g' : 'kg'
    );
    const attributeSpecifications = Object.entries(attributes).map(
      ([label, value], specificationIndex) => ({
        id: `variant-${id}-attribute-${specificationIndex}`,
        label,
        value,
        orderKey: normalizeCatalogSpecificationToken(label)
      })
    );
    const specifications = [
      ...attributeSpecifications,
      ...normalizeSpecifications(
        contentOverride.specifications ?? raw.specifications,
        `variant-${id}`
      )
    ];
    const documentIds = new Set(
      asArray(contentOverride.documentIds ?? raw.documentIds).map(String)
    );
    const variantDocuments = normalizeDocuments(
      contentOverride.documents ?? raw.documents,
      media
    ).filter(
      (document) =>
        documentIds.size === 0 ||
        documentIds.has(document.id) ||
        document.variantIds.includes(id)
    );
    const storedVariantDescription = asString(
      contentOverride.description ?? raw.description
    );
    const variantDescription = toStorefrontPlainText(storedVariantDescription);
    const variantDescriptionHtml = sanitizeCatalogRichText(storedVariantDescription)
      || plainTextToCatalogRichText(variantDescription);

    return {
      id,
      commerceId,
      position: Math.max(1, Math.floor(asFiniteNumber(raw.position, index + 1))),
      name: asString(raw.variantName ?? raw.name, sourceVariants.length > 1 ? `Različica ${index + 1}` : name),
      sku: asString(raw.variantSku ?? raw.sku, context.fallbackSku),
      optionValueIds,
      baseUnitNet,
      discountPct,
      unitNet: getDiscountedPrice(baseUnitNet, discountPct),
      taxRate: Math.max(
        0,
        asFiniteNumber(raw.taxRate, asFiniteNumber(item.taxRate, 0.22))
      ),
      inventory,
      minOrder: Math.max(1, Math.floor(asFiniteNumber(raw.minOrder, 1))),
      unit: asString(raw.unit, asString(item.unit, 'kos')),
      status: asStatus(raw.status),
      badge: asOptionalString(raw.badge),
      attributes,
      mediaIds: asArray(
        contentOverride.mediaIds ??
          contentOverride.imageIds ??
          raw.mediaIds ??
          raw.imageAssignments
      ).map(String),
      description: asOptionalString(variantDescription),
      descriptionHtml: asOptionalString(variantDescriptionHtml),
      specifications,
      includedItems: normalizeStringList(
        contentOverride.includedItems ?? raw.includedItems
      ),
      documents: variantDocuments.filter(
        (document) =>
          document.variantIds.length === 0 || document.variantIds.includes(id)
      ),
      deliveryEstimate: asOptionalString(
        contentOverride.deliveryEstimate ?? raw.deliveryEstimate
      ),
      ...(length !== null || width !== null || thickness !== null
        ? {
            dimensions: {
              ...(length !== null ? { length } : {}),
              ...(width !== null ? { width } : {}),
              ...(thickness !== null ? { thickness } : {})
            }
          }
        : {})
    };
  });
  const variants = normalizedVariants
    .sort((left, right) => left.position - right.position)
    .filter((variant) => variant.status === 'active');

  if (axes.length === 0 && variants.length > 1) {
    const syntheticAxisId = 'derived-variant';
    axes = [
      {
        id: syntheticAxisId,
        name: inferSyntheticAxisLabel(item, sourceVariants),
        slug: syntheticAxisId,
        position: 0,
        values: variants.map((variant, index) => ({
          id: `derived-value-${variant.id}`,
          label: variant.name,
          slug: slugify(variant.name),
          position: index
        }))
      }
    ];
    variants.forEach((variant) => {
      variant.optionValueIds = [`derived-value-${variant.id}`];
    });
  } else if (axes.length > 0) {
    const usedOptionValueIds = new Set(
      variants.flatMap((variant) => variant.optionValueIds)
    );
    axes = axes
      .map((axis) => ({
        ...axis,
        values: axis.values.filter((value) => usedOptionValueIds.has(value.id))
      }))
      .filter((axis) => axis.values.length > 0);
  }

  const requestedDefaultId = asOptionalIdentifier(item.defaultVariantId);
  const requestedDefault = variants.find(
    (variant) => variant.id === requestedDefaultId
  );
  const defaultVariant =
    (requestedDefault && variantIsPurchasable(requestedDefault)
      ? requestedDefault
      : undefined) ??
    variants.find(variantIsPurchasable) ??
    requestedDefault ??
    variants.find((variant) => variant.status === 'active') ??
    variants[0] ??
    null;

  const breadcrumbs: StorefrontBreadcrumb[] = [
    { label: 'Izdelki', href: '/products' },
    { label: context.category.title, href: context.category.href }
  ];
  if (context.subcategory) {
    breadcrumbs.push({
      label: context.subcategory.title,
      href: context.subcategory.href
    });
  }
  breadcrumbs.push({ label: name });

  return {
    id: asIdentifier(item.id, catalogItem.slug),
    slug: catalogItem.slug,
    href: context.href,
    name,
    shortDescription: description ? makeExcerpt(description) : undefined,
    description: description || undefined,
    descriptionHtml: descriptionHtml || undefined,
    brand: asOptionalString(item.brand),
    baseSku: asOptionalString(item.sku),
    badge: asOptionalString(item.badge) ?? defaultVariant?.badge,
    status: asStatus(item.status),
    breadcrumbs,
    media,
    optionAxes: axes,
    variants,
    defaultVariantId: defaultVariant?.id ?? null,
    specifications: normalizeParentSpecifications(item),
    includedItems: normalizeStringList(item.includedItems),
    documents: normalizeDocuments(item.documents, media),
    deliveryEstimate: asOptionalString(item.deliveryEstimate),
    relatedProducts: [],
    appearanceOverride: item.appearanceOverride
  };
}

export function toStorefrontProductSummary(
  product: StorefrontProduct,
  categoryLabel?: string
): StorefrontProductSummary {
  const activeVariants = product.variants.filter((variant) => variant.status === 'active');
  const prices = activeVariants.map((variant) => variant.unitNet);
  const fallbackPrice = product.variants[0]?.unitNet ?? 0;
  const minUnitNet = prices.length > 0 ? Math.min(...prices) : fallbackPrice;
  const maxUnitNet = prices.length > 0 ? Math.max(...prices) : fallbackPrice;
  const purchasableVariants = activeVariants.filter(variantIsPurchasable);
  const representativeVariant =
    [...activeVariants].sort(
      (left, right) => left.unitNet - right.unitNet
    )[0] ??
    product.variants[0] ??
    null;
  const galleryImage = product.media.find(
    (entry) => entry.kind === 'image' && entry.role === 'gallery'
  );

  return {
    id: product.id,
    slug: product.slug,
    href: product.href,
    name: product.name,
    shortDescription: product.shortDescription,
    brand: product.brand,
    sku: representativeVariant?.sku ?? product.baseSku,
    unit: representativeVariant?.unit,
    image: galleryImage,
    badge: product.badge,
    categoryLabel,
    minUnitNet,
    maxUnitNet,
    baseUnitNet: representativeVariant?.baseUnitNet ?? minUnitNet,
    taxRate: representativeVariant?.taxRate ?? 0.22,
    discountPct: representativeVariant?.discountPct ?? 0,
    displayVariant: representativeVariant,
    purchasableVariant:
      product.variants.length === 1 && purchasableVariants.length === 1
        ? purchasableVariants[0]
        : null,
    hasMultipleVariants: product.variants.length > 1,
    isAvailable: purchasableVariants.length > 0
  };
}

export function isStorefrontVariantPurchasable(variant: StorefrontVariant | null) {
  return Boolean(variant && variantIsPurchasable(variant) && variant.commerceId !== null);
}
