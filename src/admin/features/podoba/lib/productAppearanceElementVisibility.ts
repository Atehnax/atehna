import {
  normalizeProductAppearanceConfig,
  resolveProductCanvasElementDeviceSettings,
  type ProductAppearanceConfig,
  type ProductCanvasDevice,
  type ProductInformationBlock,
  type ProductSecondaryBlock
} from '@/shared/domain/style/productAppearance';

type OptionalElement = {
  id: string;
  label: string;
  parentId: string | null;
};

export const optionalProductCanvasElements: readonly OptionalElement[] = [
  { id: 'product-breadcrumbs', label: 'Drobtinice', parentId: null },
  { id: 'product-category', label: 'Kategorija', parentId: 'product-information' },
  { id: 'product-badge', label: 'Oznaka', parentId: 'product-information' },
  { id: 'product-sku', label: 'SKU', parentId: 'product-information' },
  { id: 'product-short-description', label: 'Kratek opis', parentId: 'product-information' },
  { id: 'product-key-attributes', label: 'Ključne lastnosti', parentId: 'product-information' },
  { id: 'product-variants', label: 'Različice', parentId: 'product-information' },
  { id: 'product-gallery-thumbnails', label: 'Sličice galerije', parentId: 'product-gallery' },
  { id: 'product-availability', label: 'Dobavljivost', parentId: 'product-purchase' },
  { id: 'product-gallery-sale-unit', label: 'Prodajna enota', parentId: 'product-price' },
  { id: 'product-minimum-order', label: 'Minimalno naročilo', parentId: 'product-purchase' },
  { id: 'product-quantity', label: 'Količina', parentId: 'product-purchase' },
  { id: 'product-delivery', label: 'Dostava', parentId: 'product-purchase' },
  { id: 'product-secondary-action', label: 'Sekundarno dejanje', parentId: 'product-purchase' },
  { id: 'product-description', label: 'Opis izdelka', parentId: 'product-secondary' },
  { id: 'product-specifications', label: 'Specifikacije', parentId: 'product-secondary' },
  { id: 'product-related-products', label: 'Sorodni izdelki', parentId: null }
];

const informationElementFields: Record<string, { field?: keyof ProductAppearanceConfig['information']; block: ProductInformationBlock }> = {
  'product-badge': { field: 'showBadge', block: 'badge' },
  'product-sku': { field: 'showSku', block: 'sku' },
  'product-short-description': { field: 'showShortDescription', block: 'shortDescription' },
  'product-key-attributes': { field: 'showKeyAttributes', block: 'keyAttributes' },
  'product-variants': { block: 'variants' }
};
const purchaseElementFields: Record<string, keyof Omit<ProductAppearanceConfig['purchaseArea'], 'copy'>> = {
  'product-availability': 'showAvailability',
  'product-gallery-sale-unit': 'showSaleUnit',
  'product-minimum-order': 'showMinimumOrder',
  'product-quantity': 'showQuantityStepper',
  'product-delivery': 'showDeliveryEstimate',
  'product-secondary-action': 'showSecondaryAction'
};
const secondaryElementBlocks: Record<string, ProductSecondaryBlock> = {
  'product-description': 'description',
  'product-specifications': 'specifications',
  'product-related-products': 'relatedProducts'
};

export function isProductCanvasElementContentEnabled(config: ProductAppearanceConfig, id: string, device: ProductCanvasDevice) {
  if (id === 'product-breadcrumbs') return config.productPage.showBreadcrumbs;
  if (id === 'product-category') return config.information.showCategory;
  if (id === 'product-gallery-thumbnails') return (device === 'mobile'
    ? config.gallery.thumbnailPositionMobile : config.gallery.thumbnailPositionDesktop) !== 'hidden';
  const information = informationElementFields[id];
  if (information) return (!information.field || Boolean(config.information[information.field]))
    && config.productPage.informationOrder.includes(information.block);
  const purchase = purchaseElementFields[id];
  if (purchase) return Boolean(config.purchaseArea[purchase]);
  const secondary = secondaryElementBlocks[id];
  if (secondary) return config.secondaryContent.blockOrder.includes(secondary)
    && (id !== 'product-related-products' || config.relatedProducts.enabled);
  return true;
}

function enableElementContent(config: ProductAppearanceConfig, id: string, device: ProductCanvasDevice): ProductAppearanceConfig {
  if (id === 'product-breadcrumbs') return { ...config, productPage: { ...config.productPage, showBreadcrumbs: true } };
  if (id === 'product-category') return { ...config, information: { ...config.information, showCategory: true } };
  if (id === 'product-gallery-thumbnails') return { ...config, gallery: { ...config.gallery, [device === 'mobile' ? 'thumbnailPositionMobile' : 'thumbnailPositionDesktop']: 'bottom' } };
  const information = informationElementFields[id];
  if (information) return {
    ...config,
    information: information.field ? { ...config.information, [information.field]: true } : config.information,
    productPage: { ...config.productPage, informationOrder: config.productPage.informationOrder.includes(information.block)
      ? config.productPage.informationOrder : [...config.productPage.informationOrder, information.block] }
  };
  const purchase = purchaseElementFields[id];
  if (purchase) return { ...config, purchaseArea: { ...config.purchaseArea, [purchase]: true } };
  const secondary = secondaryElementBlocks[id];
  if (secondary) return {
    ...config,
    relatedProducts: id === 'product-related-products' ? { ...config.relatedProducts, enabled: true } : config.relatedProducts,
    secondaryContent: { ...config.secondaryContent, blockOrder: config.secondaryContent.blockOrder.includes(secondary)
      ? config.secondaryContent.blockOrder : [...config.secondaryContent.blockOrder, secondary] }
  };
  return config;
}

/** Re-add in the selected viewport, restoring hidden ancestors without losing device-specific styling. */
export function restoreProductCanvasElements(
  value: ProductAppearanceConfig,
  ids: readonly string[],
  device: ProductCanvasDevice,
  parents: ReadonlyMap<string, string | null>
): ProductAppearanceConfig {
  let config = value;
  const restore = new Set<string>();
  for (const id of ids) {
    let current: string | null = id;
    while (current && !restore.has(current)) {
      restore.add(current);
      current = parents.get(current) ?? null;
    }
  }
  for (const id of restore) {
    const previouslyEnabled = Object.fromEntries((['desktop', 'tablet', 'mobile'] as const)
      .map((profile) => [profile, isProductCanvasElementContentEnabled(config, id, profile)])) as Record<ProductCanvasDevice, boolean>;
    config = enableElementContent(config, id, device);
    const responsive = Object.fromEntries((['desktop', 'tablet', 'mobile'] as const).map((profile) => [profile, {
      ...resolveProductCanvasElementDeviceSettings(config, id, profile),
      ...(profile === device ? { visible: true } : !previouslyEnabled[profile] ? { visible: false } : {})
    }])) as ProductAppearanceConfig['canvas']['elements'][string]['responsive'];
    config = { ...config, canvas: { ...config.canvas, mode: 'free', elements: { ...config.canvas.elements, [id]: { responsive } } } };
  }
  return normalizeProductAppearanceConfig(config);
}
