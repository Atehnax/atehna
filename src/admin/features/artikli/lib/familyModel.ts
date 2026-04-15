export type SeedItemTuple = [
  id: string,
  name: string,
  description: string,
  category: string,
  categoryId: string | null,
  subcategoryId: string | null,
  price: number,
  sku: string,
  images: string[],
  discountPct: number,
  displayOrder: number | null
];

export type Variant = {
  id: string;
  label: string;
  width: number | null;
  length: number | null;
  thickness: number | null;
  errorTolerance?: string | null;
  weight?: number | null;
  minOrder?: number;
  badge?: string | null;
  position?: number;
  sku: string;
  price: number;
  discountPct: number;
  stock: number;
  active: boolean;
  sort: number;
  imageOverride?: string | null;
  imageAssignments?: number[];
};

export type ProductFamily = {
  id: string;
  name: string;
  description: string;
  category: string;
  categoryId: string | null;
  subcategoryId: string | null;
  images: string[];
  promoBadge: string;
  defaultDiscountPct: number;
  active: boolean;
  sort: number;
  notes: string;
  slug: string;
  variants: Variant[];
};

const parseDimensionTriplet = (input: string): { width: number | null; length: number | null; thickness: number | null } => {
  const normalized = input.replace(/,/g, '.').toLowerCase();
  const matches = normalized.match(/(\d+(?:\.\d+)?)/g);
  if (!matches || matches.length < 3) {
    return { width: null, length: null, thickness: null };
  }
  return {
    width: Number(matches[0]),
    length: Number(matches[1]),
    thickness: Number(matches[2])
  };
};

export const toSlug = (value: string) =>
  value
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');

export const computeSalePrice = (price: number, discountPct: number) =>
  Number((price * (1 - Math.max(0, Math.min(100, discountPct)) / 100)).toFixed(2));

export const formatCurrency = (value: number) =>
  new Intl.NumberFormat('sl-SI', { style: 'currency', currency: 'EUR' }).format(value);

const buildVariantLabel = (variant: Pick<Variant, 'width' | 'length' | 'thickness' | 'label'>) => {
  if (variant.width === null || variant.length === null || variant.thickness === null) {
    return variant.label || 'Osnovna različica';
  }
  return `${variant.width} × ${variant.length} × ${variant.thickness} mm`;
};

export const createVariant = (overrides: Partial<Variant> = {}): Variant => ({
  id: `var-${Math.random().toString(36).slice(2, 10)}`,
  label: 'Nova različica',
  width: null,
  length: null,
  thickness: null,
  errorTolerance: null,
  weight: null,
  minOrder: 1,
  sku: '',
  price: 0,
  discountPct: 0,
  stock: 0,
  active: true,
  sort: 1,
  imageOverride: null,
  imageAssignments: [],
  ...overrides
});

export const createFamily = (overrides: Partial<ProductFamily> = {}): ProductFamily => ({
  id: `fam-${Math.random().toString(36).slice(2, 10)}`,
  name: '',
  description: '',
  category: '',
  categoryId: null,
  subcategoryId: null,
  images: [],
  promoBadge: '',
  defaultDiscountPct: 0,
  active: true,
  sort: 1,
  notes: '',
  slug: '',
  variants: [createVariant()],
  ...overrides
});

export const statusLabel = (active: boolean) => (active ? 'Aktiven' : 'Skrit');

export const variantLabel = (variant: Variant) => buildVariantLabel(variant);

export function buildFamiliesFromSeed(seedItems: SeedItemTuple[]): ProductFamily[] {
  const grouped = new Map<string, ProductFamily>();

  seedItems.forEach((seed, index) => {
    const [id, name, description, category, categoryId, subcategoryId, price, sku, images, discountPct, displayOrder] = seed;
    const [familyRaw, variantRaw] = name.split(',').map((part) => part.trim());
    const dimensions = variantRaw ? parseDimensionTriplet(variantRaw) : { width: null, length: null, thickness: null };
    const familyName = familyRaw;
    const familySlug = toSlug(familyName);
    const key = `${familySlug}::${categoryId ?? category}`;

    const variant = createVariant({
      id,
      label: variantRaw || 'Osnovna različica',
      width: dimensions.width,
      length: dimensions.length,
      thickness: dimensions.thickness,
      sku,
      price,
      discountPct,
      stock: Math.max(0, 40 - index),
      active: true,
      sort: index + 1
    });

    const existing = grouped.get(key);
    if (!existing) {
      grouped.set(
        key,
        createFamily({
          id: key,
          name: familyName,
          description,
          category,
          categoryId,
          subcategoryId,
          images,
          promoBadge: discountPct > 0 ? 'Akcija' : '',
          defaultDiscountPct: discountPct,
          active: true,
          sort: displayOrder ?? index + 1,
          slug: familySlug,
          variants: [variant]
        })
      );
      return;
    }

    grouped.set(key, {
      ...existing,
      images: existing.images.length ? existing.images : images,
      defaultDiscountPct: existing.defaultDiscountPct || discountPct,
      variants: [...existing.variants, variant]
    });
  });

  return Array.from(grouped.values()).map((family) => ({
    ...family,
    variants: [...family.variants]
      .sort((a, b) => a.sort - b.sort)
      .map((variant, index) => ({ ...variant, label: buildVariantLabel(variant), sort: index + 1 }))
  }));
}
