'use client';

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode
} from 'react';
import {
  ChevronDown,
  ChevronUp,
  Eye,
  EyeOff,
  Grid3X3,
  Layers3,
  List,
  Lock,
  MousePointer2,
  Package,
  RotateCcw,
  Save,
  ShoppingCart,
  Unlock,
  X
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { uploadAdminPublicMedia } from '@/shared/client/publicMediaUpload';
import { toCommercialStorefrontLogicalPx } from '@/commercial/components/commercialStorefrontScale';
import { ProductAppearanceProvider } from '@/commercial/components/ProductAppearanceProvider';
import { StorefrontInventoryPolicyProvider } from '@/commercial/components/StorefrontInventoryPolicyProvider';
import ProductCard from '@/commercial/components/storefront/ProductCard';
import {
  ProductListingHeader,
  ProductListingToolbar
} from '@/commercial/components/storefront/ProductListing';
import {
  toStorefrontProductSummary,
  type StorefrontProduct
} from '@/commercial/features/products/storefrontProduct';
import type {
  AdminCatalogListItem,
  CatalogItemEditorHydration,
  CatalogItemPresentationSaveResponse,
  UploadedCatalogMediaFile
} from '@/shared/domain/catalog/catalogAdminTypes';
import { readCatalogSpecificationLabels } from '@/shared/domain/catalog/catalogSpecification';
import {
  toGlobalStyleCssVariables,
  type GlobalStyleConfig
} from '@/shared/domain/style/globalStyle';
import type { SiteNavigationSiteLayoutSettings } from '@/shared/domain/navigation/siteNavigation';
import {
  STOREFRONT_CART_PENDING_SHIPPING_LABEL,
  STOREFRONT_CHECKOUT_SHIPPING_MESSAGE
} from '@/shared/domain/shipping/storefrontShippingCopy';
import {
  PRODUCT_INFORMATION_BLOCKS,
  PRODUCT_SECONDARY_BLOCKS,
  cloneDefaultProductAppearanceConfig,
  normalizeProductAppearanceConfig,
  normalizeProductCanvasElementDeviceSettings,
  resolveProductCanvasElementDeviceSettings,
  toProductAppearanceCssVariables,
  toStoredProductAppearanceConfig,
  type ProductCanvasDevice,
  type ProductCanvasElementDeviceSettings,
  type ProductAppearanceConfig,
  type ProductInformationBlock,
  type ProductSecondaryBlock
} from '@/shared/domain/style/productAppearance';
import { AdminPageHeader } from '@/shared/ui/admin-primitives';
import { Button } from '@/shared/ui/button';
import { useAppearanceResponsivePreviewMotion } from '@/shared/ui/responsive-preview-motion';
import { CompactHexColorField } from '@/shared/ui/admin-controls/CompactHexColorField';
import {
  adminControlFocusTokenClasses,
  adminInputFocusTokenClasses
} from '@/shared/ui/theme/tokens';
import { useToast } from '@/shared/ui/toast';
import ProductCanvasElement, {
  PRODUCT_CANVAS_PROTECTED_ELEMENT_IDS,
  type ProductCanvasSelectionOptions
} from '@/shared/ui/product-canvas/ProductCanvasElement';
import ProductCanvasGuidesOverlay from '@/shared/ui/product-canvas/ProductCanvasGuidesOverlay';
import ProductAppearanceContextToolbar, {
  createUploadedGalleryMedia
} from './ProductAppearanceContextToolbar';
import {
  AppearanceEditorAlignmentControl,
  AppearanceEditorCompactSelect,
  AppearanceEditorNumberInput,
  AppearanceEditorPreviewDeviceIcon as PreviewDeviceIcon,
  AppearanceEditorToolbarButton,
  AppearanceEditorToolbarDivider,
  AppearanceEditorToolbarToneProvider,
  FloatingAppearanceEditorContextToolbar,
  appearanceEditorToolbarPopoverSurfaceClassName
} from './AppearanceEditorToolbarPrimitives';
import ProductAppearanceLivePreview from './ProductAppearanceLivePreview';
import ProductAppearanceLayersPanel, {
  rankProductAppearanceLayersTopFirst,
  type ProductAppearanceLayerItem
} from './ProductAppearanceLayersPanel';
import AdminPodobaTabs from './AdminPodobaTabs';
import { buildProductAppearancePreviewProduct } from '../lib/productAppearancePreviewProduct';

type SectionKey = Exclude<
  keyof ProductAppearanceConfig,
  'schemaVersion' | 'updatedAt' | 'canvas'
>;
type PreviewPage = 'listing' | 'product' | 'cart';
type PreviewDevice = 'desktop' | 'tablet' | 'mobile';

const previewDevices = ['desktop', 'tablet', 'mobile'] as const satisfies readonly PreviewDevice[];

type ProductCanvasElementDefinition = {
  id: string;
  label: string;
  page: PreviewPage;
  group: string;
};

type RuntimeProductCanvasLayer = {
  id: string;
  label: string;
  parentId: string | null;
  domOrder: number;
};

function readRuntimeProductCanvasLayers(root: HTMLElement | null) {
  if (!root) return [];
  const seenIds = new Set<string>();
  const layers: RuntimeProductCanvasLayer[] = [];
  const elements = root.querySelectorAll<HTMLElement>(
    '[data-product-canvas-element]'
  );

  elements.forEach((element) => {
    const id = element.dataset.productCanvasElement?.trim();
    if (!id || seenIds.has(id)) return;
    seenIds.add(id);
    const parentElement = element.parentElement?.closest<HTMLElement>(
      '[data-product-canvas-element]'
    );
    const candidateParentId = parentElement?.dataset.productCanvasElement?.trim() || null;
    layers.push({
      id,
      label: element.dataset.productCanvasLabel?.trim() || id,
      parentId: candidateParentId === id ? null : candidateParentId,
      domOrder: layers.length
    });
  });

  return layers;
}

const productCanvasElements: ProductCanvasElementDefinition[] = [
  { id: 'listing-view-grid', label: 'Gumb Mreža', page: 'listing', group: 'Glava seznama' },
  { id: 'listing-view-list', label: 'Gumb Seznam', page: 'listing', group: 'Glava seznama' },
  { id: 'listing-sort', label: 'Polje razvrščanja', page: 'listing', group: 'Glava seznama' },
  { id: 'listing-header', label: 'Glava seznama', page: 'listing', group: 'Seznam' },
  { id: 'listing-card', label: 'Kartica artikla', page: 'listing', group: 'Kartica' },
  { id: 'card-image', label: 'Slika kartice', page: 'listing', group: 'Kartica' },
  { id: 'card-content', label: 'Vsebina kartice', page: 'listing', group: 'Kartica' },
  { id: 'card-category', label: 'Kategorija kartice', page: 'listing', group: 'Kartica' },
  { id: 'card-brand', label: 'Blagovna znamka', page: 'listing', group: 'Kartica' },
  { id: 'card-title', label: 'Naziv kartice', page: 'listing', group: 'Kartica' },
  { id: 'card-description', label: 'Opis kartice', page: 'listing', group: 'Kartica' },
  { id: 'card-sku', label: 'SKU kartice', page: 'listing', group: 'Kartica' },
  { id: 'card-stock', label: 'Zaloga kartice', page: 'listing', group: 'Kartica' },
  { id: 'card-price', label: 'Cena kartice', page: 'listing', group: 'Kartica' },
  { id: 'card-action', label: 'Dejanje kartice', page: 'listing', group: 'Kartica' },
  { id: 'product-breadcrumbs', label: 'Drobtinice', page: 'product', group: 'Stran artikla' },
  { id: 'product-gallery', label: 'Galerija', page: 'product', group: 'Stran artikla' },
  { id: 'product-gallery-thumbnails', label: 'Sličice galerije', page: 'product', group: 'Galerija' },
  { id: 'product-gallery-main', label: 'Glavna slika galerije', page: 'product', group: 'Galerija' },
  { id: 'product-information', label: 'Informacije', page: 'product', group: 'Stran artikla' },
  { id: 'product-category', label: 'Kategorija in znamka', page: 'product', group: 'Informacije' },
  { id: 'product-title', label: 'Naziv artikla', page: 'product', group: 'Informacije' },
  { id: 'product-badge', label: 'Oznaka', page: 'product', group: 'Informacije' },
  { id: 'product-sku', label: 'SKU', page: 'product', group: 'Informacije' },
  { id: 'product-short-description', label: 'Kratek opis', page: 'product', group: 'Informacije' },
  { id: 'product-key-attributes', label: 'Ključne lastnosti', page: 'product', group: 'Informacije' },
  { id: 'product-variants', label: 'Različice', page: 'product', group: 'Informacije' },
  { id: 'product-variant-thickness', label: 'Debelina', page: 'product', group: 'Različice' },
  { id: 'product-variant-thickness-options', label: 'Gumbi debeline', page: 'product', group: 'Različice' },
  { id: 'product-variant-dimensions', label: 'Dimenzije', page: 'product', group: 'Različice' },
  { id: 'product-variant-dimensions-control', label: 'Izbirnik dimenzij', page: 'product', group: 'Različice' },
  { id: 'product-variant-axis-1', label: 'Različica 1', page: 'product', group: 'Različice' },
  { id: 'product-variant-axis-1-control', label: 'Kontrole različice 1', page: 'product', group: 'Različice' },
  { id: 'product-variant-axis-2', label: 'Različica 2', page: 'product', group: 'Različice' },
  { id: 'product-variant-axis-2-control', label: 'Kontrole različice 2', page: 'product', group: 'Različice' },
  { id: 'product-variant-axis-3', label: 'Različica 3', page: 'product', group: 'Različice' },
  { id: 'product-variant-axis-3-control', label: 'Kontrole različice 3', page: 'product', group: 'Različice' },
  { id: 'product-variant-axis-4', label: 'Različica 4', page: 'product', group: 'Različice' },
  { id: 'product-variant-axis-4-control', label: 'Kontrole različice 4', page: 'product', group: 'Različice' },
  { id: 'product-purchase', label: 'Nakupno območje', page: 'product', group: 'Nakup' },
  { id: 'product-price', label: 'Cena in DDV', page: 'product', group: 'Nakup' },
  { id: 'product-availability', label: 'Razpoložljivost', page: 'product', group: 'Nakup' },
  { id: 'product-summary', label: 'Povzetek različice', page: 'product', group: 'Nakup' },
  { id: 'product-minimum-order', label: 'Minimalno naročilo', page: 'product', group: 'Nakup' },
  { id: 'product-quantity', label: 'Količina', page: 'product', group: 'Nakup' },
  { id: 'product-quantity-decrease', label: 'Zmanjšaj količino', page: 'product', group: 'Količina' },
  { id: 'product-quantity-input', label: 'Vnos količine', page: 'product', group: 'Količina' },
  { id: 'product-quantity-increase', label: 'Povečaj količino', page: 'product', group: 'Količina' },
  { id: 'product-quantity-label', label: 'Naslov količine', page: 'product', group: 'Količina' },
  { id: 'product-quantity-controls', label: 'Kontrole količine', page: 'product', group: 'Količina' },
  { id: 'product-primary-action', label: 'Primarno dejanje', page: 'product', group: 'Nakup' },
  { id: 'product-delivery', label: 'Dostava', page: 'product', group: 'Nakup' },
  { id: 'product-secondary-action', label: 'Sekundarno dejanje', page: 'product', group: 'Nakup' },
  { id: 'product-secondary', label: 'Dodatna vsebina', page: 'product', group: 'Vsebina' },
  { id: 'product-secondary-tabs', label: 'Zavihki podrobnosti', page: 'product', group: 'Vsebina' },
  { id: 'product-secondary-tab-description', label: 'Zavihek opisa', page: 'product', group: 'Zavihki' },
  { id: 'product-delivery-and-payment', label: 'Dostava in plačilo', page: 'product', group: 'Vsebina' },
  { id: 'product-secondary-tab-specifications', label: 'Zavihek specifikacij', page: 'product', group: 'Zavihki' },
  { id: 'product-secondary-tab-delivery-and-payment', label: 'Zavihek dostave in plačila', page: 'product', group: 'Zavihki' },
  { id: 'product-description', label: 'Opis izdelka', page: 'product', group: 'Vsebina' },
  { id: 'product-description-heading', label: 'Naslov opisa', page: 'product', group: 'Opis' },
  { id: 'product-description-content', label: 'Vsebina opisa', page: 'product', group: 'Opis' },
  { id: 'product-specifications', label: 'Specifikacije', page: 'product', group: 'Vsebina' },
  { id: 'product-specifications-heading', label: 'Naslov specifikacij', page: 'product', group: 'Specifikacije' },
  { id: 'product-specifications-content', label: 'Vsebina specifikacij', page: 'product', group: 'Specifikacije' },
  { id: 'product-delivery-and-payment-heading', label: 'Naslov dostave in plačila', page: 'product', group: 'Dostava' },
  { id: 'product-delivery-and-payment-content', label: 'Vsebina dostave in plačila', page: 'product', group: 'Dostava' },
  { id: 'product-related-products', label: 'Sorodni izdelki', page: 'product', group: 'Vsebina' },
  { id: 'product-related-title', label: 'Naslov sorodnih izdelkov', page: 'product', group: 'Sorodni izdelki' },
  { id: 'product-related-grid', label: 'Mreža sorodnih izdelkov', page: 'product', group: 'Sorodni izdelki' },
  { id: 'product-related-card', label: 'Kartica sorodnega izdelka', page: 'product', group: 'Sorodni izdelki' },
  { id: 'product-related-card-image', label: 'Slika sorodnega izdelka', page: 'product', group: 'Sorodna kartica' },
  { id: 'product-related-card-content', label: 'Vsebina sorodne kartice', page: 'product', group: 'Sorodna kartica' },
  { id: 'product-related-card-category', label: 'Kategorija sorodnega izdelka', page: 'product', group: 'Sorodna kartica' },
  { id: 'product-related-card-brand', label: 'Znamka sorodnega izdelka', page: 'product', group: 'Sorodna kartica' },
  { id: 'product-related-card-title', label: 'Naziv sorodnega izdelka', page: 'product', group: 'Sorodna kartica' },
  { id: 'product-related-card-description', label: 'Opis sorodnega izdelka', page: 'product', group: 'Sorodna kartica' },
  { id: 'product-related-card-price', label: 'Cena sorodnega izdelka', page: 'product', group: 'Sorodna kartica' },
  { id: 'product-related-card-action', label: 'Dejanje sorodnega izdelka', page: 'product', group: 'Sorodna kartica' },
  { id: 'product-related-card-quantity', label: 'Količina sorodnega izdelka', page: 'product', group: 'Sorodna kartica' },
  { id: 'product-related-card-add', label: 'Gumb sorodnega izdelka', page: 'product', group: 'Sorodna kartica' },
  { id: 'cart-panel', label: 'Panel košarice', page: 'cart', group: 'Košarica' },
  { id: 'cart-header', label: 'Glava košarice', page: 'cart', group: 'Košarica' },
  { id: 'cart-line', label: 'Vrstica artikla', page: 'cart', group: 'Košarica' },
  { id: 'cart-line-image', label: 'Slika v košarici', page: 'cart', group: 'Košarica' },
  { id: 'cart-line-info', label: 'Podatki vrstice', page: 'cart', group: 'Košarica' },
  { id: 'cart-summary', label: 'Povzetek košarice', page: 'cart', group: 'Košarica' },
  { id: 'cart-primary-action', label: 'Nadaljuj na naročilo', page: 'cart', group: 'Košarica' }
];

const sections: Array<{
  key: SectionKey;
  label: string;
  description: string;
  group: string;
  preview: PreviewPage;
}> = [
  { key: 'listings', label: 'Seznami in kartice', description: 'Mreža, kartice, filtri in straničenje', group: 'Katalog', preview: 'listing' },
  { key: 'productPage', label: 'Postavitev artikla', description: 'Razmerje galerije, informacij in nakupa', group: 'Stran artikla', preview: 'product' },
  { key: 'gallery', label: 'Galerija', description: 'Slike, sličice, razmerje in povečava', group: 'Stran artikla', preview: 'product' },
  { key: 'information', label: 'Informacije', description: 'Vidnost in širina vsebine', group: 'Stran artikla', preview: 'product' },
  { key: 'pricing', label: 'Cene in popusti', description: 'Bruto, neto, DDV in prihranki', group: 'Nakup', preview: 'product' },
  { key: 'variants', label: 'Različice', description: 'Izbirniki, zaloga in kombinacije', group: 'Nakup', preview: 'product' },
  { key: 'purchaseArea', label: 'Nakupno območje', description: 'Razpoložljivost, količina in dejanja', group: 'Nakup', preview: 'product' },
  { key: 'secondaryContent', label: 'Dodatna vsebina', description: 'Specifikacije, opisi in dokumenti', group: 'Vsebina', preview: 'product' },
  { key: 'relatedProducts', label: 'Sorodni artikli', description: 'Priporočila in dodatki', group: 'Vsebina', preview: 'product' },
  { key: 'cartSidebar', label: 'Košarica ob strani', description: 'Mere, povzetek in mobilni prikaz', group: 'Košarica', preview: 'cart' },
  { key: 'overrides', label: 'Lokalne izjeme', description: 'Dovoljene izjeme po artiklu', group: 'Upravljanje', preview: 'product' }
];

const informationLabels: Record<ProductInformationBlock, string> = {
  brand: 'Blagovna znamka',
  title: 'Naziv artikla',
  badge: 'Oznaka',
  sku: 'SKU',
  shortDescription: 'Kratek opis',
  keyAttributes: 'Ključne lastnosti',
  variants: 'Različice'
};

const secondaryLabels: Record<ProductSecondaryBlock, string> = {
  specifications: 'Specifikacije',
  description: 'Daljši opis',
  includedItems: 'Vsebina paketa',
  documents: 'Dokumenti',
  relatedProducts: 'Sorodni artikli'
};

const informationCanvasElementIds: Record<ProductInformationBlock, string> = {
  brand: 'product-category',
  title: 'product-title',
  badge: 'product-badge',
  sku: 'product-sku',
  shortDescription: 'product-short-description',
  keyAttributes: 'product-key-attributes',
  variants: 'product-variants'
};

const fieldClassName =
  `h-9 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 text-xs text-slate-800 transition hover:border-slate-300 hover:bg-white focus:bg-white ${adminInputFocusTokenClasses}`;

const previewPageLabels: Record<PreviewPage, string> = {
  listing: 'Seznam',
  product: 'Artikel',
  cart: 'Košarica'
};

const previewDeviceLabels: Record<PreviewDevice, string> = {
  desktop: 'Desktop',
  tablet: 'Tablica',
  mobile: 'Mobilno'
};

const previewControlButtonClassName =
  `inline-flex h-8 items-center gap-1.5 rounded-md px-2.5 text-[12px] font-medium leading-none transition ${adminControlFocusTokenClasses}`;

function PreviewPageControls({
  value,
  onChange
}: {
  value: PreviewPage;
  onChange: (page: PreviewPage) => void;
}) {
  return (
    <div
      role="group"
      aria-label="Stran predogleda"
      data-product-page-controls
      className="flex shrink-0 items-center gap-2"
    >
      {(['listing', 'product', 'cart'] as const).map((page) => {
        const PageIcon = page === 'listing'
          ? List
          : page === 'product'
            ? Package
            : ShoppingCart;
        return (
          <button
            key={page}
            type="button"
            aria-pressed={value === page}
            onClick={() => onChange(page)}
            className={`${previewControlButtonClassName} ${
              value === page
                ? 'text-[color:var(--blue-600)]'
                : 'text-slate-500 hover:text-[color:var(--blue-600)]'
            }`}
          >
            <PageIcon className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" />
            {previewPageLabels[page]}
          </button>
        );
      })}
    </div>
  );
}

function PreviewDeviceControls({
  value,
  onChange
}: {
  value: PreviewDevice;
  onChange: (device: PreviewDevice) => void;
}) {
  return (
    <div
      role="group"
      aria-label="Odzivni predogled"
      data-product-preview-controls
      className="flex shrink-0 items-center gap-2"
    >
      {(['desktop', 'tablet', 'mobile'] as const).map((device) => (
        <button
          key={device}
          type="button"
          aria-pressed={value === device}
          onClick={() => onChange(device)}
          className={`${previewControlButtonClassName} ${
            value === device
              ? 'text-[color:var(--blue-600)]'
              : 'text-slate-500 hover:text-[color:var(--blue-600)]'
          }`}
        >
          <PreviewDeviceIcon device={device} />
          {previewDeviceLabels[device]}
        </button>
      ))}
    </div>
  );
}

function comparable(value: ProductAppearanceConfig) {
  return JSON.stringify(toStoredProductAppearanceConfig(value));
}

function comparableProduct(value: CatalogItemEditorHydration | null) {
  if (!value) return '';
  return JSON.stringify({
    itemName: value.itemName,
    description: value.description,
    brand: value.brand,
    badge: value.badge,
    material: value.material,
    colour: value.colour,
    shape: value.shape,
    appearanceOverride: value.appearanceOverride,
    media: value.media,
    variantSpecifications: value.variants.map((variant) => ({
      id: variant.id,
      length: variant.length ?? null,
      width: variant.width ?? null,
      thickness: variant.thickness ?? null,
      weight: variant.weight ?? null,
      errorTolerance: variant.errorTolerance ?? null,
      variantSku: variant.variantSku ?? null,
      specifications: variant.contentOverride?.specifications ?? {}
    }))
  });
}

function Field({
  label,
  hint,
  children
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="grid min-w-0 gap-1.5">
      <span className="text-[11px] font-medium leading-4 text-slate-600">{label}</span>
      {children}
      {hint ? <span className="text-[10px] leading-4 text-slate-500">{hint}</span> : null}
    </label>
  );
}

function NumberField({
  label,
  value,
  onChange,
  min,
  max,
  step,
  suffix = '',
  hint,
  disabled = false
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  step?: number;
  suffix?: string;
  hint?: string;
  disabled?: boolean;
}) {
  return (
    <Field label={label} hint={hint}>
      <span className={`flex overflow-hidden rounded-lg border border-slate-200 ${disabled ? 'bg-slate-100' : 'bg-slate-50 focus-within:border-[color:var(--blue-500)] focus-within:bg-white'}`}>
        <AppearanceEditorNumberInput
          min={min}
          max={max}
          step={step}
          value={value}
          disabled={disabled}
          onValueChange={onChange}
          className={`h-9 min-w-0 flex-1 border-0 bg-transparent px-3 text-xs text-slate-800 disabled:cursor-not-allowed disabled:text-slate-400 ${adminInputFocusTokenClasses}`}
        />
        {suffix ? <span className={`grid min-w-10 place-items-center px-2 text-[10px] ${disabled ? 'text-slate-300' : 'text-slate-400'}`}>{suffix}</span> : null}
      </span>
    </Field>
  );
}

function SelectField<Value extends string>({
  label,
  value,
  options,
  onChange,
  hint,
  disabled = false
}: {
  label: string;
  value: Value;
  options: ReadonlyArray<{ value: Value; label: string }>;
  onChange: (value: Value) => void;
  hint?: string;
  disabled?: boolean;
}) {
  return (
    <div className="grid min-w-0 gap-1" data-product-appearance-compact-setting={label}>
      <span className="text-[11px] font-medium leading-4 text-slate-600">{label}</span>
      <AppearanceEditorCompactSelect
        value={value}
        options={options}
        disabled={disabled}
        ariaLabel={label}
        marker={`product-appearance-${label}`}
        onValueChange={onChange}
      />
      {hint ? <span className="text-[10px] leading-4 text-slate-500">{hint}</span> : null}
    </div>
  );
}

function TextField({
  label,
  value,
  onChange
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <Field label={label}>
      <input value={value} onChange={(event) => onChange(event.target.value)} className={fieldClassName} />
    </Field>
  );
}

function ToggleField({
  label,
  description,
  checked,
  onChange,
  locked = false
}: {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (value: boolean) => void;
  locked?: boolean;
}) {
  return (
    <label className={`flex min-h-12 items-center justify-between gap-4 rounded-lg border px-3 py-2.5 ${locked ? 'border-slate-100 bg-slate-50/70' : 'border-slate-200 bg-white hover:border-slate-300'}`}>
      <span className="min-w-0">
        <span className="block text-[11px] font-medium text-slate-700">{label}</span>
        {description ? <span className="mt-0.5 block text-[10px] leading-4 text-slate-500">{description}</span> : null}
      </span>
      <input
        type="checkbox"
        checked={checked}
        disabled={locked}
        onChange={(event) => onChange(event.target.checked)}
        className={`h-4 w-4 shrink-0 rounded border-slate-300 text-[color:var(--blue-600)] ${adminControlFocusTokenClasses}`}
      />
    </label>
  );
}

function SettingsGroup({
  title,
  description,
  children
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <fieldset className="grid gap-3 border-0 p-0">
      <legend className="text-xs font-semibold text-slate-800">{title}</legend>
      {description ? <p className="-mt-2 text-[10px] leading-4 text-slate-500">{description}</p> : null}
      {children}
    </fieldset>
  );
}

function FieldGrid({ children }: { children: ReactNode }) {
  return <div className="grid gap-3 sm:grid-cols-2">{children}</div>;
}

function ColorField({
  label,
  value,
  inheritedColor,
  onChange
}: {
  label: string;
  value: string;
  inheritedColor: string;
  onChange: (value: string) => void;
}) {
  return (
    <CompactHexColorField
      label={label}
      value={value}
      marker={`product-appearance-${label}`}
      tone="light"
      allowClear
      clearLabel="Podeduj"
      inheritedColor={inheritedColor}
      onChange={onChange}
      inputAttributes={{ 'aria-label': label }}
    />
  );
}

function CanvasElementInspector({
  definition,
  settings,
  protectedElement,
  onChange,
  onReset
}: {
  definition: ProductCanvasElementDefinition | null;
  settings: ProductCanvasElementDeviceSettings | null;
  protectedElement: boolean;
  onChange: (updates: Partial<ProductCanvasElementDeviceSettings>) => void;
  onReset: () => void;
}) {
  if (!definition || !settings) {
    return (
      <div className="grid min-h-52 place-items-center p-5 text-center">
        <div>
          <MousePointer2 className="mx-auto h-5 w-5 text-slate-300" />
          <p className="mt-2 text-xs font-semibold text-slate-700">Izberite element</p>
          <p className="mt-1 text-[10px] leading-4 text-slate-500">
            Kliknite element na platnu ali v seznamu.
          </p>
        </div>
      </div>
    );
  }

  const spacingFields: Array<{
    key: keyof ProductCanvasElementDeviceSettings;
    label: string;
  }> = [
    { key: 'paddingTopPx', label: 'Notranji · zgoraj' },
    { key: 'paddingRightPx', label: 'Notranji · desno' },
    { key: 'paddingBottomPx', label: 'Notranji · spodaj' },
    { key: 'paddingLeftPx', label: 'Notranji · levo' },
    { key: 'marginTopPx', label: 'Zunanji · zgoraj' },
    { key: 'marginRightPx', label: 'Zunanji · desno' },
    { key: 'marginBottomPx', label: 'Zunanji · spodaj' },
    { key: 'marginLeftPx', label: 'Zunanji · levo' }
  ];

  return (
    <div className="grid gap-5 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[9px] font-semibold uppercase tracking-[0.1em] text-[color:var(--blue-600)]">
            Lastnosti elementa
          </p>
          <h3 className="mt-1 truncate text-sm font-semibold text-slate-900">{definition.label}</h3>
          <p className="mt-0.5 truncate font-mono text-[9px] text-slate-400">{definition.id}</p>
        </div>
        <button
          type="button"
          onClick={onReset}
          title="Ponastavi element za izbrano napravo"
          aria-label="Ponastavi element"
          className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 ${adminControlFocusTokenClasses}`}
        >
          <RotateCcw className="h-3.5 w-3.5" />
        </button>
      </div>

      <SettingsGroup
        title="Vedenje"
        description={protectedElement ? 'Poslovno in zakonsko pomembnega elementa ni mogoče skriti.' : undefined}
      >
        <div className="grid gap-2">
          <ToggleField
            label="Vidno"
            checked={protectedElement || settings.visible}
            locked={protectedElement}
            onChange={(visible) => onChange({ visible })}
          />
          <ToggleField
            label="Zaklenjeno"
            description="Zaklenjen element ostane izbirljiv, vendar ga ni mogoče vleči ali raztegniti."
            checked={settings.locked}
            onChange={(locked) => onChange({ locked })}
          />
          <ToggleField
            label="Zakleni razmerje stranic"
            description="Širina in višina se pri spreminjanju ohranita v istem razmerju."
            checked={settings.aspectRatioLocked}
            onChange={(aspectRatioLocked) => onChange({ aspectRatioLocked })}
          />
        </div>
      </SettingsGroup>

      <SettingsGroup title="Položaj in velikost">
        <FieldGrid>
          <NumberField label="X" value={settings.offsetXPx} min={-5000} max={5000} suffix="px" onChange={(offsetXPx) => onChange({ offsetXPx })} />
          <NumberField label="Y" value={settings.offsetYPx} min={-5000} max={5000} suffix="px" onChange={(offsetYPx) => onChange({ offsetYPx })} />
          <NumberField label="Širina" value={settings.widthPx} min={0} max={5000} suffix="px" hint="0 pomeni samodejno." onChange={(widthPx) => onChange({ widthPx })} />
          <NumberField label="Višina" value={settings.heightPx} min={0} max={5000} suffix="px" hint="0 pomeni samodejno." onChange={(heightPx) => onChange({ heightPx })} />
          <NumberField label="Plast" value={settings.zIndex} min={-100} max={1000} onChange={(zIndex) => onChange({ zIndex })} />
          <NumberField label="Prosojnost" value={Math.round(settings.opacity * 100)} min={0} max={100} suffix="%" onChange={(opacity) => onChange({ opacity: opacity / 100 })} />
        </FieldGrid>
      </SettingsGroup>

      <SettingsGroup title="Površina in rob">
        <FieldGrid>
          <ColorField label="Barva besedila" value={settings.color} inheritedColor="#0F172A" onChange={(color) => onChange({ color })} />
          <ColorField label="Barva ozadja" value={settings.backgroundColor} inheritedColor="#FFFFFF" onChange={(backgroundColor) => onChange({ backgroundColor })} />
          <ColorField label="Barva roba" value={settings.borderColor} inheritedColor="#CBD5E1" onChange={(borderColor) => onChange({ borderColor })} />
          <NumberField label="Debelina roba" value={settings.borderWidthPx} min={0} max={24} suffix="px" onChange={(borderWidthPx) => onChange({ borderWidthPx })} />
          <NumberField label="Zaobljenost" value={settings.borderRadiusPx} min={0} max={240} suffix="px" onChange={(borderRadiusPx) => onChange({ borderRadiusPx })} />
          <SelectField
            label="Senca"
            value={settings.shadow}
            options={[
              { value: 'none', label: 'Brez' },
              { value: 'sm', label: 'Majhna' },
              { value: 'md', label: 'Srednja' },
              { value: 'lg', label: 'Velika' }
            ]}
            onChange={(shadow) => onChange({ shadow })}
          />
        </FieldGrid>
      </SettingsGroup>

      <SettingsGroup title="Tipografija" description="Prazna oziroma ničelna vrednost deduje Globalne parametre.">
        <TextField label="Družina pisave" value={settings.fontFamily} onChange={(fontFamily) => onChange({ fontFamily })} />
        <FieldGrid>
          <NumberField label="Velikost" value={settings.fontSizePx} min={0} max={240} suffix="px" onChange={(fontSizePx) => onChange({ fontSizePx })} />
          <NumberField label="Debelina" value={settings.fontWeight} min={0} max={900} onChange={(fontWeight) => onChange({ fontWeight })} />
          <NumberField label="Višina vrstice" value={settings.lineHeight} min={0} max={4} onChange={(lineHeight) => onChange({ lineHeight })} />
          <NumberField label="Razmik črk" value={settings.letterSpacingPx} min={-20} max={100} suffix="px" onChange={(letterSpacingPx) => onChange({ letterSpacingPx })} />
          <div className="grid min-w-0 gap-1">
            <span className="text-[11px] font-medium leading-4 text-slate-600">Poravnava</span>
            <AppearanceEditorAlignmentControl
              value={settings.textAlign}
              options={['inherit', 'left', 'center', 'right', 'justify'] as const}
              tone="light"
              className="w-full"
              ariaLabel="Poravnava besedila elementa"
              onValueChange={(textAlign) => onChange({ textAlign })}
            />
          </div>
        </FieldGrid>
      </SettingsGroup>

      <SettingsGroup title="Razmiki">
        <FieldGrid>
          {spacingFields.map(({ key, label }) => (
            <NumberField
              key={key}
              label={label}
              value={settings[key] as number}
              min={key.startsWith('margin') ? -1000 : 0}
              max={2000}
              suffix="px"
              onChange={(value) => onChange({ [key]: value })}
            />
          ))}
        </FieldGrid>
      </SettingsGroup>
    </div>
  );
}

function OrderEditor<Value extends string>({
  label,
  values,
  labels,
  onChange
}: {
  label: string;
  values: readonly Value[];
  labels: Record<Value, string>;
  onChange: (values: Value[]) => void;
}) {
  function move(index: number, offset: -1 | 1) {
    const target = index + offset;
    if (target < 0 || target >= values.length) return;
    const next = [...values];
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  }

  return (
    <div className="grid gap-2">
      <p className="text-[11px] font-medium text-slate-600">{label}</p>
      <ol className="grid gap-1.5">
        {values.map((value, index) => (
          <li key={value} className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-2">
            <span className="grid h-5 w-5 place-items-center rounded-full bg-white text-[10px] font-semibold text-slate-500 ring-1 ring-slate-200">{index + 1}</span>
            <span className="min-w-0 flex-1 text-[11px] font-medium text-slate-700">{labels[value]}</span>
            <button type="button" onClick={() => move(index, -1)} disabled={index === 0} aria-label={`Premakni ${labels[value]} gor`} className={`grid h-7 w-7 place-items-center rounded-md text-slate-500 hover:bg-white disabled:opacity-30 ${adminControlFocusTokenClasses}`}><ChevronUp className="h-3.5 w-3.5" /></button>
            <button type="button" onClick={() => move(index, 1)} disabled={index === values.length - 1} aria-label={`Premakni ${labels[value]} dol`} className={`grid h-7 w-7 place-items-center rounded-md text-slate-500 hover:bg-white disabled:opacity-30 ${adminControlFocusTokenClasses}`}><ChevronDown className="h-3.5 w-3.5" /></button>
          </li>
        ))}
      </ol>
    </div>
  );
}

function ProductPreview({
  config,
  selectedElementIds = [],
  globalStyle,
  page,
  device,
  product,
  interactive = false,
  selectedElementId = null,
  onSelectElement,
  onElementChange
}: {
  config: ProductAppearanceConfig;
  selectedElementIds?: readonly string[];
  globalStyle: GlobalStyleConfig;
  page: PreviewPage;
  device: PreviewDevice;
  product?: StorefrontProduct | null;
  interactive?: boolean;
  selectedElementId?: string | null;
  onSelectElement?: (elementId: string, options?: ProductCanvasSelectionOptions) => void;
  onElementChange?: (
    elementId: string,
    updates: Partial<ProductCanvasElementDeviceSettings>
  ) => void;
}) {
  const isMobile = device === 'mobile';
  const isTablet = device === 'tablet';
  const previewRootRef = useRef<HTMLDivElement | null>(null);
  const vars = {
    ...toGlobalStyleCssVariables(globalStyle),
    ...toProductAppearanceCssVariables(config)
  } as CSSProperties;
  const displayVariant = product?.variants.find((variant) => variant.id === product.defaultVariantId)
    ?? product?.variants[0]
    ?? null;
  const unitNet = displayVariant?.unitNet ?? 100;
  const taxRate = displayVariant?.taxRate ?? 0.22;
  const unitGross = unitNet * (1 + taxRate);
  const taxAmount = unitGross - unitNet;
  const priceFormatter = new Intl.NumberFormat('sl-SI', {
    style: 'currency',
    currency: 'EUR'
  });
  const productImage = product?.media.find((media) => media.kind === 'image')?.url;
  const productName = product?.name ?? 'Tehnični artikel';
  const previewListingProduct = product
    ? {
        ...toStorefrontProductSummary(product),
        purchasableVariant: null
      }
    : null;
  const previewListingMode =
    config.listings.availableModes === 'both'
      ? config.listings.defaultMode
      : config.listings.availableModes;
  const previewListingTitle = product?.breadcrumbs.at(-2)?.label ?? 'Kategorija';
  const cardCount = isMobile ? config.listings.mobileColumns : isTablet ? config.listings.tabletColumns : config.listings.desktopColumns;
  const canvasActive = config.canvas.mode === 'free';
  const wrapElement = (
    elementId: string,
    children: ReactNode,
    className = '',
    forceVisible = false,
    editorRepresentative = true
  ) => {
    const definition = productCanvasElements.find((entry) => entry.id === elementId);
    return (
      <ProductCanvasElement
        elementId={elementId}
        key={elementId}
        label={definition?.label ?? elementId}
        settings={resolveProductCanvasElementDeviceSettings(config, elementId, device)}
        active={canvasActive}
        interactive={interactive && editorRepresentative}
        selected={selectedElementIds.includes(elementId) && editorRepresentative}
        forceVisible={forceVisible || PRODUCT_CANVAS_PROTECTED_ELEMENT_IDS.has(elementId)}
        gridSizePx={config.canvas.gridSizePx}
        snapToGrid={config.canvas.snapToGrid}
        className={className}
        onSelect={onSelectElement}
        onChange={onElementChange}
      >
        {children}
      </ProductCanvasElement>
    );
  };

  if (page === 'listing') {
    return (
      <div
        ref={previewRootRef}
        data-storefront-theme="true"
        data-admin-product-live-preview="true"
        data-preview-device={device}
        className={`admin-product-live-preview relative min-h-[430px] bg-slate-50 p-4 ${interactive ? 'admin-product-canvas-surface' : ''}`}
        data-show-grid={interactive && config.canvas.showGrid}
        style={{
          ...vars,
          '--commercial-storefront-scale': '1'
        } as CSSProperties}
      >
        <ProductAppearanceProvider config={config}>
          <ProductListingHeader
            title={previewListingTitle}
            productCount={previewListingProduct ? 1 : 0}
            toolbar={
              previewListingProduct
                ? wrapElement(
                    'listing-header',
                    <ProductListingToolbar
                      appearance={config}
                      mode={previewListingMode}
                      sort="recommended"
                      onModeChange={() => undefined}
                      onSortChange={() => undefined}
                      canvasWrapper={(
                        elementId,
                        _label,
                        children,
                        className
                      ) => wrapElement(elementId, children, className)}
                    />
                  )
                : null
            }
          />
          <div
            className={
              previewListingMode === 'grid'
                ? 'storefront-product-grid mt-5'
                : 'mt-5 grid gap-[var(--product-listing-gap,20px)]'
            }
            data-card-density={config.listings.cardDensity}
            style={{
              gridTemplateColumns: `repeat(${Math.max(
                1,
                previewListingMode === 'grid' ? cardCount : 1
              )}, minmax(0, 1fr))`
            }}
          >
            {previewListingProduct
              ? Array.from(
                  { length: Math.max(2, previewListingMode === 'grid' ? cardCount : 1) },
                  (_, index) => (
                    <div key={index} className="min-w-0">
                      <ProductCard
                        product={previewListingProduct}
                        layout={previewListingMode}
                        canvasWrapper={(elementId, _label, children, className) =>
                          wrapElement(
                            elementId,
                            children,
                            className,
                            false,
                            index === 0
                          )
                        }
                      />
                    </div>
                  )
                )
              : null}
          </div>
        </ProductAppearanceProvider>
        <ProductCanvasGuidesOverlay
          rootRef={previewRootRef}
          selectedElementId={selectedElementId}
          enabled={interactive && config.canvas.showGuides}
          changeToken={config.canvas.elements}
        />
      </div>
    );
  }

  if (page === 'cart') {
    return (
      <div
        ref={previewRootRef}
        className={`relative min-h-[430px] overflow-hidden bg-slate-200/70 ${interactive ? 'admin-product-canvas-surface' : ''}`}
        data-show-grid={interactive && config.canvas.showGrid}
        style={vars}
      >
        <div className="absolute inset-0 bg-slate-900/20" />
        <aside
          className={`absolute inset-y-0 bg-white shadow-xl ${config.cartSidebar.side === 'right' ? 'right-0' : 'left-0'} ${isMobile ? 'w-full' : ''}`}
          style={isMobile ? undefined : { width: `${Math.min(config.cartSidebar.widthPx, 420)}px` }}
        >
          {wrapElement('cart-panel', <div className="relative h-full min-h-[430px]">
          {wrapElement('cart-header', <div className="flex items-center justify-between border-b border-slate-200 p-4">
            <div><p className="text-sm font-semibold">Košarica</p><p className="text-[9px] text-emerald-700">Artikel je dodan</p></div>
            <div className="h-7 w-7 rounded-full bg-slate-100" />
          </div>)}
          <div className="grid gap-3 p-4">
            {wrapElement('cart-line', <div className="flex gap-3 border-b border-slate-100 pb-4">
              {wrapElement('cart-line-image', (
                <div
                  className="rounded-lg bg-slate-100 bg-cover bg-center"
                  style={{
                    width: config.cartSidebar.lineImageSizePx,
                    height: config.cartSidebar.lineImageSizePx,
                    backgroundImage: productImage ? `url("${productImage}")` : undefined
                  }}
                />
              ), 'shrink-0', true)}
              {wrapElement('cart-line-info', <div className="min-w-0 flex-1">
                <p className="text-[11px] font-semibold">{productName}</p>
                <p className="mt-1 text-[9px] text-slate-500">{displayVariant?.name ?? 'Privzeta različica'} · SKU {displayVariant?.sku ?? product?.baseSku ?? '—'}</p>
                <p className="mt-2 text-xs font-bold">{priceFormatter.format(unitGross)}</p>
              </div>, 'min-w-0 flex-1')}
            </div>)}
          </div>
          {wrapElement('cart-summary', <div className="border-t border-slate-200 bg-white p-4">
            {config.cartSidebar.showNetTaxBreakdown ? <><div className="flex justify-between text-[10px] text-slate-500"><span>Neto</span><span>{priceFormatter.format(unitNet)}</span></div><div className="mt-1 flex justify-between text-[10px] text-slate-500"><span>DDV {Math.round(taxRate * 100)} %</span><span>{priceFormatter.format(taxAmount)}</span></div></> : null}
            <div className="mt-1 flex justify-between gap-3 text-[10px] text-slate-500"><span>Poštnina</span><span className="text-right">{STOREFRONT_CART_PENDING_SHIPPING_LABEL}</span></div>
            <div className="mt-3 flex justify-between border-t border-slate-100 pt-3 text-sm font-bold"><span>Vmesni seštevek z DDV</span><span>{priceFormatter.format(unitGross)}</span></div>
            {wrapElement('cart-primary-action', <div className="rounded-lg bg-[color:var(--blue-600)] py-2.5 text-center text-[10px] font-semibold text-white">Nadaljuj na naročilo</div>, 'mt-3', true)}
          </div>, 'absolute inset-x-0 bottom-0', true)}
          </div>, 'h-full', true)}
        </aside>
        <ProductCanvasGuidesOverlay
          rootRef={previewRootRef}
          selectedElementId={selectedElementId}
          enabled={interactive && config.canvas.showGuides}
          changeToken={config.canvas.elements}
        />
      </div>
    );
  }

  const thumbnailPosition = isMobile
    ? config.gallery.thumbnailPositionMobile
    : config.gallery.thumbnailPositionDesktop;
  const visibleThumbnailCount = Math.min(3, Math.max(1, config.gallery.visibleThumbnailCount));
  const previewThumbnailSize = Math.min(
    42,
    Math.max(20, Math.round(config.gallery.thumbnailSizePx * 0.48))
  );
  const hasSideThumbnails = thumbnailPosition === 'left' && !isMobile;
  const hasBottomThumbnails = thumbnailPosition === 'bottom' || (thumbnailPosition === 'left' && isMobile);
  const scaledColumnGap = Math.min(24, Math.max(8, Math.round(config.productPage.columnGapPx * 0.55)));
  const productGridColumns = isMobile
    ? 'minmax(0, 1fr)'
    : isTablet
      ? 'minmax(0, 1.08fr) minmax(0, 0.92fr)'
      : `${config.productPage.galleryColumns}fr ${config.productPage.informationColumns}fr ${config.productPage.purchaseColumns}fr`;
  const relatedColumnCount = isMobile
    ? config.relatedProducts.mobileColumns
    : isTablet
      ? config.relatedProducts.tabletColumns
      : config.relatedProducts.desktopColumns;
  const previewHasDocuments = false;
  const previewHasIncludedItems = false;
  const secondaryTabs = config.secondaryContent.blockOrder.filter((block) => (
    block !== 'relatedProducts' &&
    (block !== 'documents' || previewHasDocuments) &&
    (block !== 'includedItems' || previewHasIncludedItems)
  ));
  const hasPreviewDescription = secondaryTabs.includes('description');
  const hasPreviewSpecifications = secondaryTabs.includes('specifications');
  const firstPreviewOverviewBlock = secondaryTabs.find(
    (block) => block === 'description' || block === 'specifications'
  );
  const secondaryNavigationTabs = secondaryTabs.flatMap((block) => {
    if (
      hasPreviewDescription
      && hasPreviewSpecifications
      && (block === 'description' || block === 'specifications')
    ) {
      return block === firstPreviewOverviewBlock
        ? [{
            id: block,
            label: config.secondaryContent.combinedOverviewLabel
          }]
        : [];
    }
    return [{
      id: block,
      label: config.secondaryContent.sectionLabels[block]
    }];
  });

  function renderInformationBlock(block: ProductInformationBlock) {
    if (block === 'brand') {
      if (!config.information.showCategory && !config.information.showBrand) return null;
      return (
        <p className="text-[8px] font-bold uppercase tracking-[0.2em] text-amber-700">
          {config.information.showCategory ? 'Kovine' : null}
          {config.information.showCategory && config.information.showBrand ? ' · ' : null}
          {config.information.showBrand ? 'Atehna' : null}
        </p>
      );
    }
    if (block === 'title') {
      return (
        <h3 className={`${isMobile ? 'text-xl' : 'text-[clamp(17px,2.1vw,26px)]'} font-bold leading-[1.08] tracking-[-0.025em] text-slate-950`}>
          Aluminijasta plošča
        </h3>
      );
    }
    if (block === 'badge') {
      return config.information.showBadge
        ? <span className="w-fit rounded-full bg-slate-100 px-2 py-1 text-[8px] font-semibold uppercase tracking-wide text-slate-600">Materiali</span>
        : null;
    }
    if (block === 'sku') {
      return config.information.showSku
        ? <p className="text-[8px] text-slate-400">SKU: MAT-KOV-ALU-0P3X100X100</p>
        : null;
    }
    if (block === 'shortDescription') {
      return config.information.showShortDescription
        ? <p className="text-[10px] leading-[1.55] text-slate-600">Tanka aluminijasta plošča za modelarstvo, tehnični pouk in izdelavo manjših kovinskih elementov.</p>
        : null;
    }
    if (block === 'keyAttributes') {
      return config.information.showKeyAttributes
        ? (
          <div className="grid grid-cols-2 gap-1.5 text-[8px]">
            <span className="rounded-lg bg-slate-50 px-2 py-1.5 text-slate-500"><strong className="block text-slate-700">Material</strong>Aluminij</span>
            <span className="rounded-lg bg-slate-50 px-2 py-1.5 text-slate-500"><strong className="block text-slate-700">Oblika</strong>Pravokotna</span>
          </div>
        )
        : null;
    }
    if (block === 'variants') {
      const selectorLabel = config.variants.labelAboveSelector
        ? (
          <p
            className="text-[9px] font-semibold text-slate-800"
            style={{ marginBottom: config.variants.labelControlGapPx }}
          >
            Dimenzije
          </p>
        )
        : null;
      if (config.variants.selectorStyle === 'chips' || config.variants.selectorStyle === 'swatches') {
        return (
          <div>
            {selectorLabel}
            <div className="flex flex-wrap gap-1.5">
              <span className="rounded-lg border border-[color:var(--blue-500)] bg-[color:var(--blue-50)] px-2.5 py-2 text-[9px] font-medium text-slate-800">0,3 × 100 × 100 mm</span>
              {config.variants.showUnavailableValues ? <span className="rounded-lg border border-slate-200 px-2.5 py-2 text-[9px] text-slate-400 line-through">0,5 × 200 × 200 mm</span> : null}
            </div>
          </div>
        );
      }
      return (
        <div>
          {selectorLabel}
          <div className={`${config.variants.compactSelectors ? 'h-8' : 'h-10'} flex items-center justify-between rounded-lg border border-slate-200 bg-white px-3 text-[9px] font-medium text-slate-700`}>
            <span>0,3 × 100 × 100 mm</span>
            <ChevronDown className="h-3 w-3 text-slate-500" />
          </div>
        </div>
      );
    }
    return null;
  }

  return (
    <div
      ref={previewRootRef}
      className={`relative min-h-[430px] bg-white ${isMobile ? 'p-3' : 'p-4'} ${interactive ? 'admin-product-canvas-surface' : ''}`}
      data-show-grid={interactive && config.canvas.showGrid}
      style={vars}
    >
      <div
        className="mx-auto"
        style={{ width: '94%' }}
      >
        {config.productPage.showBreadcrumbs ? (
          wrapElement('product-breadcrumbs', <div className="flex flex-wrap items-center gap-1 text-[8px] font-medium text-slate-500">
            <span className="text-[color:var(--blue-600)]">Izdelki</span><span>/</span>
            <span className="text-[color:var(--blue-600)]">Materiali</span><span>/</span>
            <span className="text-[color:var(--blue-600)]">Kovine</span><span>/</span>
            <span>Aluminijasta plošča</span>
          </div>, 'mb-3')
        ) : null}

        <div
          className="grid items-start"
          style={{ gridTemplateColumns: productGridColumns, gap: `${scaledColumnGap}px` }}
        >
          {wrapElement('product-gallery', <div
            className="min-w-0"
            style={{ width: `${config.gallery.sizePercent}%` }}
          >
            <div className={hasSideThumbnails ? 'grid grid-cols-[auto_minmax(0,1fr)] gap-2' : ''}>
              {hasSideThumbnails ? (
                <div className="grid content-start gap-1.5">
                  {Array.from({ length: visibleThumbnailCount }, (_, index) => (
                    <div
                      key={index}
                      className={`grid place-items-center rounded-lg border bg-[#f5f3f0] ${index === 0 ? 'border-[color:var(--blue-500)] ring-1 ring-[color:var(--blue-100)]' : 'border-slate-200'}`}
                      style={{ width: previewThumbnailSize, height: previewThumbnailSize }}
                    >
                      <span className="h-[28%] w-[62%] -rotate-6 border border-slate-300 bg-gradient-to-br from-slate-100 via-white to-slate-300 shadow-sm" />
                    </div>
                  ))}
                </div>
              ) : null}
              <div className="relative grid place-items-center overflow-hidden rounded-xl border border-slate-200 bg-[#f5f3f0] shadow-sm" style={{ aspectRatio: config.gallery.imageRatio.replace(':', ' / ') }}>
                <div className="absolute left-[19%] top-[38%] h-[30%] w-[55%] -rotate-[8deg] border border-slate-300 bg-gradient-to-br from-slate-100 via-white to-slate-300 shadow-md" />
                <div className="absolute left-[27%] top-[31%] h-[30%] w-[55%] -rotate-[2deg] border border-slate-300 bg-gradient-to-br from-slate-100 via-white to-slate-300 shadow-md" />
                <div className="absolute left-[35%] top-[27%] h-[30%] w-[55%] rotate-[5deg] border border-slate-300 bg-gradient-to-br from-slate-100 via-white to-slate-300 shadow-md" />
                {config.gallery.showArrows ? (
                  <>
                    <span className="absolute left-2 grid h-6 w-6 place-items-center rounded-full bg-white text-xs text-slate-600 shadow">‹</span>
                    <span className="absolute right-2 grid h-6 w-6 place-items-center rounded-full bg-white text-xs text-slate-600 shadow">›</span>
                  </>
                ) : null}
                {config.gallery.zoomMode !== 'none' ? (
                  <span
                    aria-label="Povečaj sliko"
                    title="Povečaj"
                    className="absolute bottom-2 right-2 grid h-6 w-6 place-items-center rounded-full bg-white text-slate-600 shadow-sm"
                  >
                    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="1.8">
                      <circle cx="11" cy="11" r="6" />
                      <path d="m16 16 4 4M11 8v6M8 11h6" />
                    </svg>
                  </span>
                ) : null}
              </div>
            </div>
            {hasBottomThumbnails ? (
              <div className="mt-2 flex gap-1.5">
                {Array.from({ length: visibleThumbnailCount }, (_, index) => (
                  <div
                    key={index}
                    className={`grid place-items-center rounded-lg border bg-[#f5f3f0] ${index === 0 ? 'border-[color:var(--blue-500)]' : 'border-slate-200'}`}
                    style={{ width: previewThumbnailSize, height: previewThumbnailSize }}
                  >
                    <span className="h-[28%] w-[62%] -rotate-6 border border-slate-300 bg-gradient-to-br from-slate-100 via-white to-slate-300" />
                  </div>
                ))}
              </div>
            ) : null}
            {isMobile && config.gallery.showDotsMobile ? (
              <div className="mt-2 flex justify-center gap-1">
                <span className="h-1.5 w-4 rounded-full bg-[color:var(--blue-600)]" />
                <span className="h-1.5 w-1.5 rounded-full bg-slate-300" />
                <span className="h-1.5 w-1.5 rounded-full bg-slate-300" />
              </div>
            ) : null}
          </div>, 'min-w-0')}

          {wrapElement('product-information', (
            <div className="grid min-w-0 gap-2.5">
              {config.productPage.informationOrder.map((block) => {
                const content = renderInformationBlock(block);
                return content
                  ? (
                    <div key={block}>
                      {wrapElement(informationCanvasElementIds[block], content)}
                    </div>
                  )
                  : null;
              })}
            </div>
          ), 'min-w-0')}

          {wrapElement('product-purchase', <aside
            className={`rounded-xl border border-slate-200 bg-white p-3 ${config.purchaseArea.panelStyle === 'card' ? 'shadow-[0_8px_24px_rgba(15,23,42,0.08)]' : ''}`}
          >
            {wrapElement('product-price', <>
              <p className="text-[clamp(14px,1.5vw,19px)] font-bold leading-tight text-slate-950">0,00 €</p>
              <p className="mt-1 text-[8px] text-slate-500">
                0,00 € {config.purchaseArea.copy.netPriceLabel} · {config.purchaseArea.copy.taxLabel} 22 %: 0,00 €
              </p>
            </>, '', true)}
            {config.purchaseArea.showAvailability ? (
              wrapElement('product-availability', <div className="flex items-start gap-2">
                <span className="mt-0.5 h-2 w-2 shrink-0 rounded-full bg-amber-500" />
                <div>
                  <p className="text-[9px] font-semibold text-slate-800">{config.purchaseArea.copy.outOfStockLabel}</p>
                  {config.purchaseArea.copy.outOfStockDetail ? (
                    <p className="mt-1 text-[8px] leading-3.5 text-slate-500">{config.purchaseArea.copy.outOfStockDetail}</p>
                  ) : null}
                </div>
              </div>, 'mt-3')
            ) : null}
            {wrapElement('product-primary-action', <div className="rounded-lg border border-slate-300 bg-slate-50 px-2 py-2.5 text-center text-[9px] font-semibold text-slate-400">{config.purchaseArea.copy.unavailableActionLabel}</div>, 'mt-3', true)}
            {config.purchaseArea.showDeliveryEstimate ? (
              wrapElement('product-delivery', <div className="border-t border-slate-100 pt-3 text-[8px] leading-3.5 text-slate-500">
                <p className="font-semibold text-slate-700">{STOREFRONT_CHECKOUT_SHIPPING_MESSAGE}</p>
                {config.purchaseArea.copy.deliveryFallbackMessage ? (
                  <p>{config.purchaseArea.copy.deliveryFallbackMessage}</p>
                ) : null}
                {config.purchaseArea.copy.paymentMessage ? (
                  <p>{config.purchaseArea.copy.paymentMessage}</p>
                ) : null}
              </div>, 'mt-3')
            ) : null}
          </aside>, `self-start ${isTablet ? 'col-span-2' : ''}`, true)}
        </div>

        {wrapElement('product-secondary', <div>
          <div className="storefront-detail-tabs">
            {secondaryNavigationTabs.map((tab, index) => (
              <span
                key={tab.id}
                data-active={index === 0}
                className="storefront-detail-tab"
              >
                {tab.label}
              </span>
            ))}
          </div>
          <div className={`site-panel mt-3 grid gap-4 p-3 ${
            isMobile || !hasPreviewDescription || !hasPreviewSpecifications
              ? 'grid-cols-1'
              : 'grid-cols-[1.05fr_0.95fr]'
          }`}>
            {hasPreviewDescription ? wrapElement('product-description', <section>
              <h4 className="text-[12px] font-bold text-slate-900">
                {config.secondaryContent.sectionLabels.description}
              </h4>
              <p className="mt-2 text-[9px] leading-[1.55] text-slate-600">Aluminijasta plošča debeline 0,3 mm je lahka, oblikovno stabilna in enostavna za rezanje, upogibanje ter obdelavo.</p>
              <p className="mt-2 text-[9px] font-semibold text-slate-800">Primerno za</p>
              <ul className="mt-1 grid gap-1 text-[8px] text-slate-600">
                <li><span className="mr-1 text-[color:var(--blue-600)]">✓</span> modelarstvo in tehnični pouk</li>
                <li><span className="mr-1 text-[color:var(--blue-600)]">✓</span> prototipiranje manjših izdelkov</li>
              </ul>
            </section>) : null}
            {hasPreviewSpecifications ? wrapElement('product-specifications', <section>
              <h4 className="text-[12px] font-bold text-slate-900">
                {config.secondaryContent.sectionLabels.specifications}
              </h4>
              <div className="mt-2 overflow-hidden rounded-lg border border-slate-200 text-[8px]">
                {[
                  ['Material', 'Aluminij'],
                  ['Barva', 'Srebrna'],
                  ['Dolžina', '100 mm'],
                  ['Širina', '100 mm'],
                  ['Debelina', '0,3 mm']
                ].map(([label, value], index) => (
                  <div key={label} className={`grid grid-cols-[0.8fr_1.2fr] border-b border-slate-200 last:border-b-0 ${config.secondaryContent.stripedSpecifications && index % 2 === 1 ? 'bg-slate-50' : 'bg-white'}`}>
                    <span className={`${config.secondaryContent.compactSpecifications ? 'p-1.5' : 'p-2'} font-semibold text-slate-800`}>{label}</span>
                    <span className={`${config.secondaryContent.compactSpecifications ? 'p-1.5' : 'p-2'} text-slate-600`}>{value}</span>
                  </div>
                ))}
              </div>
            </section>) : null}
          </div>
        </div>, 'mt-5')}

        {config.relatedProducts.enabled ? (
          wrapElement('product-related-products', <div>
            <h4 className="text-[12px] font-bold text-slate-900">Sorodni izdelki</h4>
            <div className="mt-2 grid gap-2" style={{ gridTemplateColumns: `repeat(${Math.max(1, relatedColumnCount)}, minmax(0, 1fr))` }}>
              {Array.from({ length: Math.min(4, Math.max(2, relatedColumnCount)) }, (_, index) => <div key={index} className="aspect-[4/3] rounded-lg border border-slate-200 bg-slate-50" />)}
            </div>
          </div>, 'mt-4')
        ) : null}
      </div>
      <ProductCanvasGuidesOverlay
        rootRef={previewRootRef}
        selectedElementId={selectedElementId}
        enabled={interactive && config.canvas.showGuides}
        changeToken={config.canvas.elements}
      />
    </div>
  );
}

export default function AdminProductAppearancePageClient({
  initialConfig,
  initialGlobalStyle,
  initialSiteLayout,
  initialStockEnforcementEnabled,
  initialProducts,
  initialProduct
}: {
  initialConfig: ProductAppearanceConfig;
  initialGlobalStyle: GlobalStyleConfig;
  initialSiteLayout: SiteNavigationSiteLayoutSettings;
  initialStockEnforcementEnabled: boolean;
  initialProducts: AdminCatalogListItem[];
  initialProduct: CatalogItemEditorHydration | null;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const normalizedInitial = useMemo(() => normalizeProductAppearanceConfig(initialConfig), [initialConfig]);
  const [config, setConfig] = useState<ProductAppearanceConfig>(normalizedInitial);
  const [savedConfig, setSavedConfig] = useState<ProductAppearanceConfig>(normalizedInitial);
  const [activeSection, setActiveSection] = useState<SectionKey>('listings');
  const [previewPage, setPreviewPage] = useState<PreviewPage>('product');
  const [previewDevice, setPreviewDevice] = useState<PreviewDevice>('desktop');
  const [selectedCanvasElementIds, setSelectedCanvasElementIds] = useState<string[]>(['product-title']);
  const [canvasElementLabels, setCanvasElementLabels] = useState<Record<string, string>>({});
  const [isElementPickerOpen, setIsElementPickerOpen] = useState(false);
  const [isGridSettingsOpen, setIsGridSettingsOpen] = useState(false);
  const [runtimeCanvasLayers, setRuntimeCanvasLayers] = useState<RuntimeProductCanvasLayer[]>([]);
  const [productOptions, setProductOptions] = useState<AdminCatalogListItem[]>(initialProducts);
  const [selectedProductSlug, setSelectedProductSlug] = useState(initialProduct?.slug ?? '');
  const [product, setProduct] = useState<CatalogItemEditorHydration | null>(initialProduct);
  const [savedProduct, setSavedProduct] = useState<CatalogItemEditorHydration | null>(initialProduct);
  const [selectedVariantId, setSelectedVariantId] = useState<number | null>(
    initialProduct?.defaultVariantId
      ?? initialProduct?.variants.find((variant) => variant.status === 'active')?.id
      ?? initialProduct?.variants[0]?.id
      ?? null
  );
  const [showAdvancedSettings, setShowAdvancedSettings] = useState(false);
  const [isLoadingProduct, setIsLoadingProduct] = useState(false);
  const [isUploadingMedia, setIsUploadingMedia] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const inlineToolbarRef = useRef<HTMLDivElement | null>(null);
  const interactivePreviewFrameRef = useRef<HTMLDivElement | null>(null);
  const interactivePreviewViewportRef = useRef<HTMLDivElement | null>(null);
  const previewLogicalWidths = useMemo<Record<PreviewDevice, number>>(() => {
    const tablet = toCommercialStorefrontLogicalPx(900);
    return {
      desktop: Math.max(
        tablet + 1,
        toCommercialStorefrontLogicalPx(initialGlobalStyle.layout.maxWidthPx)
      ),
      tablet,
      mobile: toCommercialStorefrontLogicalPx(390)
    };
  }, [initialGlobalStyle.layout.maxWidthPx]);
  const getPreviewTargetGeometry = useCallback((
    device: PreviewDevice,
    availableWidth: number
  ) => {
    const renderedWidth = device === 'desktop'
      ? Math.min(availableWidth, showAdvancedSettings ? availableWidth : 1120)
      : device === 'tablet'
        ? Math.min(availableWidth * 0.76, showAdvancedSettings ? availableWidth : 1120)
        : Math.min(availableWidth, 390);
    return {
      logicalWidth: previewLogicalWidths[device],
      renderedWidth
    };
  }, [previewLogicalWidths, showAdvancedSettings]);
  const resolvePreviewDevice = useCallback((logicalWidth: number): PreviewDevice => {
    const mobileTabletBoundary = (
      previewLogicalWidths.mobile + previewLogicalWidths.tablet
    ) / 2;
    const tabletDesktopBoundary = (
      previewLogicalWidths.tablet + previewLogicalWidths.desktop
    ) / 2;
    if (logicalWidth <= mobileTabletBoundary) return 'mobile';
    if (logicalWidth <= tabletDesktopBoundary) return 'tablet';
    return 'desktop';
  }, [previewLogicalWidths]);
  const previewMotion = useAppearanceResponsivePreviewMotion<PreviewDevice>({
    selectedDevice: previewDevice,
    orderedDevices: previewDevices,
    getTargetGeometry: getPreviewTargetGeometry,
    resolveDevice: resolvePreviewDevice
  });
  const setPreviewMotionFrameElement = previewMotion.setFrameElement;
  const setInteractivePreviewFrame = useCallback((element: HTMLDivElement | null) => {
    interactivePreviewFrameRef.current = element;
    interactivePreviewViewportRef.current = element;
    setPreviewMotionFrameElement(element);
  }, [setPreviewMotionFrameElement]);
  const activeDefinition = sections.find((section) => section.key === activeSection) ?? sections[0];
  const isAppearanceDirty = comparable(config) !== comparable(savedConfig);
  const isProductDirty = comparableProduct(product) !== comparableProduct(savedProduct);
  const isDirty = isAppearanceDirty || isProductDirty;
  const visibleCanvasElements = productCanvasElements.filter((element) => element.page === previewPage);
  const selectedCanvasElementId = selectedCanvasElementIds.at(-1) ?? null;
  const selectedCanvasDefinition = productCanvasElements.find(
    (element) => element.id === selectedCanvasElementId
  ) ?? null;
  const selectedCanvasElementLabel = selectedCanvasElementId
    ? selectedCanvasDefinition?.label ?? canvasElementLabels[selectedCanvasElementId] ?? selectedCanvasElementId
    : '';
  const selectedCanvasSettings = selectedCanvasElementId
    ? resolveProductCanvasElementDeviceSettings(config, selectedCanvasElementId, previewDevice)
    : null;
  const previewProduct = useMemo(
    () => product
      ? buildProductAppearancePreviewProduct(
          product,
          selectedVariantId,
          {
            productOptions,
            relatedProducts: config.relatedProducts
          }
        )
      : null,
    [config.relatedProducts, product, productOptions, selectedVariantId]
  );
  const productAppearanceLayerItems = useMemo<ProductAppearanceLayerItem[]>(() => {
    const runtimeById = new Map(runtimeCanvasLayers.map((layer) => [layer.id, layer]));
    return runtimeCanvasLayers.map((layer) => {
      const definition = productCanvasElements.find((element) => element.id === layer.id);
      return {
        ...layer,
        label: definition?.label ?? layer.label,
        group: definition?.group
          ?? (layer.parentId ? runtimeById.get(layer.parentId)?.label : null)
          ?? previewPageLabels[previewPage],
        settings: resolveProductCanvasElementDeviceSettings(config, layer.id, previewDevice),
        protectedElement: PRODUCT_CANVAS_PROTECTED_ELEMENT_IDS.has(layer.id)
      };
    });
  }, [config, previewDevice, previewPage, runtimeCanvasLayers]);
  const selectCanvasElement = useCallback((
    elementId: string,
    options: ProductCanvasSelectionOptions = {}
  ) => {
    if (options.label) {
      const label = options.label;
      setCanvasElementLabels((current) => (
        current[elementId] === label
          ? current
          : { ...current, [elementId]: label }
      ));
    }
    setSelectedCanvasElementIds((current) => {
      const selected = current.includes(elementId);
      if (options.additive) {
        return selected
          ? current.filter((id) => id !== elementId)
          : [...current, elementId];
      }
      if (options.preserveExisting && selected) return current;
      return [elementId];
    });
  }, []);
  const clearCanvasSelection = useCallback(() => {
    setSelectedCanvasElementIds([]);
  }, []);
  useEffect(() => {
    setIsElementPickerOpen(false);
    setIsGridSettingsOpen(false);
  }, [previewDevice, previewPage, selectedCanvasElementId, showAdvancedSettings]);
  useEffect(() => {
    const root = interactivePreviewViewportRef.current;
    if (!root) return undefined;

    const refreshLayers = () => {
      const next = readRuntimeProductCanvasLayers(root);
      setRuntimeCanvasLayers((current) => (
        JSON.stringify(current) === JSON.stringify(next) ? current : next
      ));
    };
    const observer = typeof MutationObserver === 'undefined'
      ? null
      : new MutationObserver(refreshLayers);
    observer?.observe(root, {
      attributes: true,
      childList: true,
      subtree: true,
      attributeFilter: ['data-product-canvas-element', 'data-product-canvas-label']
    });
    const frame = window.requestAnimationFrame(refreshLayers);
    return () => {
      window.cancelAnimationFrame(frame);
      observer?.disconnect();
    };
  }, [previewDevice, previewPage, previewProduct]);
  useEffect(() => {
    if (!isElementPickerOpen && !isGridSettingsOpen) return undefined;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsElementPickerOpen(false);
        setIsGridSettingsOpen(false);
      }
    };
    const closeOutside = (event: PointerEvent) => {
      if (
        inlineToolbarRef.current
        && event.target instanceof Node
        && !inlineToolbarRef.current.contains(event.target)
      ) {
        setIsElementPickerOpen(false);
        setIsGridSettingsOpen(false);
      }
    };
    document.addEventListener('keydown', closeOnEscape);
    document.addEventListener('pointerdown', closeOutside, true);
    return () => {
      document.removeEventListener('keydown', closeOnEscape);
      document.removeEventListener('pointerdown', closeOutside, true);
    };
  }, [isElementPickerOpen, isGridSettingsOpen]);

  function updateSection<Key extends SectionKey>(key: Key, updates: Partial<ProductAppearanceConfig[Key]>) {
    setConfig((current) => normalizeProductAppearanceConfig({
      ...current,
      [key]: { ...current[key], ...updates }
    }));
  }

  function updateCanvas(updates: Partial<ProductAppearanceConfig['canvas']>) {
    setConfig((current) => normalizeProductAppearanceConfig({
      ...current,
      canvas: { ...current.canvas, ...updates }
    }));
  }

  function writeCanvasElementDeviceUpdates(
    current: ProductAppearanceConfig,
    elements: ProductAppearanceConfig['canvas']['elements'],
    elementId: string,
    device: PreviewDevice,
    updates: Partial<ProductCanvasElementDeviceSettings>
  ) {
    const currentElement = current.canvas.elements[elementId] ?? {
      responsive: {
        desktop: resolveProductCanvasElementDeviceSettings(current, elementId, 'desktop'),
        tablet: resolveProductCanvasElementDeviceSettings(current, elementId, 'tablet'),
        mobile: resolveProductCanvasElementDeviceSettings(current, elementId, 'mobile')
      }
    };
    const currentSettings = resolveProductCanvasElementDeviceSettings(
      current,
      elementId,
      device
    );
    return {
      ...elements,
      [elementId]: {
        responsive: {
          ...currentElement.responsive,
          [device]: normalizeProductCanvasElementDeviceSettings(
            { ...currentSettings, ...updates },
            currentSettings
          )
        }
      }
    };
  }

  function updateCanvasElement(
    elementId: string,
    updates: Partial<ProductCanvasElementDeviceSettings>
  ) {
    setConfig((current) => {
      let elements = { ...current.canvas.elements };
      const targetSettings = resolveProductCanvasElementDeviceSettings(
        current,
        elementId,
        previewDevice
      );
      const changesHorizontalOffset = Object.hasOwn(updates, 'offsetXPx');
      const changesVerticalOffset = Object.hasOwn(updates, 'offsetYPx');
      const moveSelection = selectedCanvasElementIds.length > 1
        && selectedCanvasElementIds.includes(elementId)
        && (changesHorizontalOffset || changesVerticalOffset);
      const deltaX = changesHorizontalOffset
        ? (updates.offsetXPx ?? targetSettings.offsetXPx) - targetSettings.offsetXPx
        : 0;
      const deltaY = changesVerticalOffset
        ? (updates.offsetYPx ?? targetSettings.offsetYPx) - targetSettings.offsetYPx
        : 0;

      elements = writeCanvasElementDeviceUpdates(
        current,
        elements,
        elementId,
        previewDevice,
        updates
      );
      if (moveSelection) {
        for (const selectedId of selectedCanvasElementIds) {
          if (selectedId === elementId) continue;
          const selectedSettings = resolveProductCanvasElementDeviceSettings(
            current,
            selectedId,
            previewDevice
          );
          if (selectedSettings.locked) continue;
          elements = writeCanvasElementDeviceUpdates(
            current,
            elements,
            selectedId,
            previewDevice,
            {
              offsetXPx: selectedSettings.offsetXPx + deltaX,
              offsetYPx: selectedSettings.offsetYPx + deltaY
            }
          );
        }
      }
      return {
        ...current,
        canvas: { ...current.canvas, mode: 'free', elements }
      };
    });
  }

  function updateSelectedCanvasElements(
    updates: Partial<ProductCanvasElementDeviceSettings>
  ) {
    setConfig((current) => {
      let elements = { ...current.canvas.elements };
      for (const elementId of selectedCanvasElementIds) {
        const elementSettings = resolveProductCanvasElementDeviceSettings(
          current,
          elementId,
          previewDevice
        );
        if (
          elementSettings.locked
          && !Object.hasOwn(updates, 'locked')
          && !Object.hasOwn(updates, 'visible')
        ) {
          continue;
        }
        elements = writeCanvasElementDeviceUpdates(
          current,
          elements,
          elementId,
          previewDevice,
          updates
        );
      }
      return {
        ...current,
        canvas: { ...current.canvas, mode: 'free', elements }
      };
    });
  }

  function layerActionTargetIds(elementId: string) {
    return selectedCanvasElementIds.includes(elementId)
      ? selectedCanvasElementIds
      : [elementId];
  }

  function toggleLayerVisibility(elementId: string) {
    const targetIds = layerActionTargetIds(elementId);
    setConfig((current) => {
      const visible = !resolveProductCanvasElementDeviceSettings(
        current,
        elementId,
        previewDevice
      ).visible;
      let elements = { ...current.canvas.elements };
      for (const targetId of targetIds) {
        if (!visible && PRODUCT_CANVAS_PROTECTED_ELEMENT_IDS.has(targetId)) continue;
        elements = writeCanvasElementDeviceUpdates(
          current,
          elements,
          targetId,
          previewDevice,
          { visible }
        );
      }
      return {
        ...current,
        canvas: { ...current.canvas, mode: 'free', elements }
      };
    });
  }

  function toggleLayerLock(elementId: string) {
    const targetIds = layerActionTargetIds(elementId);
    setConfig((current) => {
      const locked = !resolveProductCanvasElementDeviceSettings(
        current,
        elementId,
        previewDevice
      ).locked;
      let elements = { ...current.canvas.elements };
      for (const targetId of targetIds) {
        elements = writeCanvasElementDeviceUpdates(
          current,
          elements,
          targetId,
          previewDevice,
          { locked }
        );
      }
      return {
        ...current,
        canvas: { ...current.canvas, mode: 'free', elements }
      };
    });
  }

  function reorderLayers(parentId: string | null, topFirstIds: readonly string[]) {
    const scopeItems = productAppearanceLayerItems.filter(
      (item) => item.parentId === parentId
    );
    const scopeIds = new Set(scopeItems.map((item) => item.id));
    const uniqueTopFirstIds = Array.from(new Set(topFirstIds)).filter(
      (elementId) => scopeIds.has(elementId)
    );
    scopeItems.forEach((item) => {
      if (!uniqueTopFirstIds.includes(item.id)) uniqueTopFirstIds.push(item.id);
    });
    if (uniqueTopFirstIds.length < 2) return;

    setConfig((current) => {
      let elements = { ...current.canvas.elements };
      rankProductAppearanceLayersTopFirst(uniqueTopFirstIds).forEach(({ id, zIndex }) => {
        elements = writeCanvasElementDeviceUpdates(
          current,
          elements,
          id,
          previewDevice,
          { zIndex }
        );
      });
      return {
        ...current,
        canvas: { ...current.canvas, mode: 'free', elements }
      };
    });
  }

  function removeSelectedCanvasElements() {
    setConfig((current) => {
      let elements = { ...current.canvas.elements };
      for (const elementId of selectedCanvasElementIds) {
        if (PRODUCT_CANVAS_PROTECTED_ELEMENT_IDS.has(elementId)) continue;
        for (const device of ['desktop', 'tablet', 'mobile'] as const) {
          elements = writeCanvasElementDeviceUpdates(
            current,
            elements,
            elementId,
            device,
            { visible: false }
          );
        }
      }
      return {
        ...current,
        canvas: { ...current.canvas, mode: 'free', elements }
      };
    });
  }

  const applyLoadedProduct = useCallback((nextProduct: CatalogItemEditorHydration) => {
    setProduct(nextProduct);
    setSavedProduct(nextProduct);
    setProductOptions((current) => current.map((item) => (
      item.id === nextProduct.id
        ? {
            ...item,
            itemName: nextProduct.itemName,
            badge: nextProduct.badge,
            status: nextProduct.status === 'active' ? 'active' : 'inactive'
          }
        : item
    )));
    setSelectedProductSlug(nextProduct.slug);
    setSelectedVariantId(
      nextProduct.defaultVariantId
        ?? nextProduct.variants.find((variant) => variant.status === 'active')?.id
        ?? nextProduct.variants[0]?.id
        ?? null
    );
  }, []);

  const fetchProduct = useCallback(async (
    slug: string,
    options: { silent?: boolean } = {}
  ) => {
    if (!slug) return;
    if (!options.silent) setIsLoadingProduct(true);
    try {
      const response = await fetch(`/api/admin/artikli/${encodeURIComponent(slug)}`, {
        cache: 'no-store'
      });
      const body = await response.json().catch(() => ({})) as CatalogItemEditorHydration & {
        message?: string;
      };
      if (!response.ok || typeof body.id !== 'number') {
        throw new Error(body.message ?? 'Artikla ni bilo mogoče naložiti.');
      }
      applyLoadedProduct(body);
    } catch (error) {
      if (!options.silent) {
        toast.error(error instanceof Error ? error.message : 'Artikla ni bilo mogoče naložiti.');
      }
    } finally {
      if (!options.silent) setIsLoadingProduct(false);
    }
  }, [applyLoadedProduct, toast]);

  async function changeSelectedProduct(slug: string) {
    if (slug === selectedProductSlug) return;
    if (
      isProductDirty
      && !window.confirm('Izbrani artikel ima neshranjene vsebinske spremembe. Ga vseeno zamenjam?')
    ) {
      return;
    }
    setSelectedProductSlug(slug);
    setProduct(null);
    setSavedProduct(null);
    const nextUrl = new URL(window.location.href);
    if (slug) nextUrl.searchParams.set('product', slug);
    else nextUrl.searchParams.delete('product');
    window.history.replaceState(window.history.state, '', nextUrl);
    await fetchProduct(slug);
  }

  function updateProduct(updates: Partial<CatalogItemEditorHydration>) {
    setProduct((current) => current ? { ...current, ...updates } : current);
  }

  async function uploadProductImages(files: File[]) {
    if (!product || files.length === 0) return;
    setIsUploadingMedia(true);
    try {
      const uploaded: UploadedCatalogMediaFile[] = [];
      for (const file of files) {
        const result = await uploadAdminPublicMedia(file, {
          scope: 'catalog-item',
          itemSlug: product.slug,
          mediaKind: 'image'
        });
        uploaded.push({
          url: result.url,
          pathname: result.pathname,
          mimeType: result.contentType,
          filename: result.filename,
          size: result.size
        });
      }
      setProduct((current) => current
        ? {
            ...current,
            media: [
              ...current.media,
              ...createUploadedGalleryMedia(uploaded, current.media)
            ]
          }
        : current
      );
      toast.success(uploaded.length === 1 ? 'Slika je dodana v predogled.' : 'Slike so dodane v predogled.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Nalaganje slik ni uspelo.');
    } finally {
      setIsUploadingMedia(false);
    }
  }

  useEffect(() => {
    const refreshWhenCurrent = () => {
      if (
        document.visibilityState === 'visible'
        && selectedProductSlug
        && !isProductDirty
        && !isSaving
      ) {
        void fetchProduct(selectedProductSlug, { silent: true });
      }
    };
    window.addEventListener('focus', refreshWhenCurrent);
    document.addEventListener('visibilitychange', refreshWhenCurrent);
    return () => {
      window.removeEventListener('focus', refreshWhenCurrent);
      document.removeEventListener('visibilitychange', refreshWhenCurrent);
    };
  }, [fetchProduct, isProductDirty, isSaving, selectedProductSlug]);

  useEffect(() => {
    if (!isDirty) return;
    const warnBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    window.addEventListener('beforeunload', warnBeforeUnload);
    return () => window.removeEventListener('beforeunload', warnBeforeUnload);
  }, [isDirty]);

  function resetCanvasElement(elementId: string) {
    setConfig((current) => {
      const currentElement = current.canvas.elements[elementId];
      if (!currentElement) return current;
      const defaultConfig = cloneDefaultProductAppearanceConfig();
      const responsive = {
        ...currentElement.responsive,
        [previewDevice]: resolveProductCanvasElementDeviceSettings(
          defaultConfig,
          elementId,
          previewDevice
        )
      };
      const elements = { ...current.canvas.elements };
      const isFullyDefault = (
        ['desktop', 'tablet', 'mobile'] as const
      ).every((device) => (
        JSON.stringify(responsive[device]) === JSON.stringify(
          resolveProductCanvasElementDeviceSettings(
            defaultConfig,
            elementId,
            device
          )
        )
      ));
      if (isFullyDefault) delete elements[elementId];
      else elements[elementId] = { responsive };
      return normalizeProductAppearanceConfig({
        ...current,
        canvas: { ...current.canvas, elements }
      });
    });
  }

  function selectPreviewPage(page: PreviewPage) {
    setPreviewPage(page);
    const currentBelongsToPage = productCanvasElements.some(
      (element) => element.id === selectedCanvasElementId && element.page === page
    );
    if (!currentBelongsToPage) {
      const nextElementId = productCanvasElements.find((element) => element.page === page)?.id;
      setSelectedCanvasElementIds(nextElementId ? [nextElementId] : []);
    }
  }

  function toggleElementPicker() {
    setIsGridSettingsOpen(false);
    setIsElementPickerOpen((open) => !open);
  }

  function toggleGridSettings() {
    setIsElementPickerOpen(false);
    setIsGridSettingsOpen((open) => !open);
  }

  async function save() {
    setIsSaving(true);
    let savedAppearanceNow = false;
    let savedProductNow = false;
    try {
      if (isAppearanceDirty) {
        const response = await fetch('/api/admin/product-appearance', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ config: toStoredProductAppearanceConfig(config) })
        });
        const body = await response.json().catch(() => ({})) as { message?: string; config?: unknown };
        if (!response.ok) throw new Error(body.message ?? 'Shranjevanje videza ni uspelo.');
        const persisted = normalizeProductAppearanceConfig(body.config ?? config);
        setConfig(persisted);
        setSavedConfig(persisted);
        savedAppearanceNow = true;
      }

      if (isProductDirty && product && savedProduct) {
        const response = await fetch(
          `/api/admin/product-appearance/products/${encodeURIComponent(savedProduct.slug)}`,
          {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              expectedUpdatedAt: savedProduct.updatedAt,
              itemName: product.itemName,
              description: product.description,
              brand: product.brand,
              badge: product.badge,
              material: product.material,
              colour: product.colour,
              shape: product.shape,
              appearanceOverride: product.appearanceOverride,
              specificationLabels: readCatalogSpecificationLabels(
                product.appearanceOverride
              ),
              media: product.media,
              variantSpecifications: product.variants.flatMap((variant) => (
                variant.id
                  ? [{
                      variantId: variant.id,
                      specifications: variant.contentOverride?.specifications ?? {},
                      length: variant.length ?? null,
                      width: variant.width ?? null,
                      thickness: variant.thickness ?? null,
                      weight: variant.weight ?? null,
                      errorTolerance: variant.errorTolerance ?? null,
                      variantSku: variant.variantSku ?? null
                    }]
                  : []
              ))
            })
          }
        );
        const body = await response.json().catch(() => ({})) as Partial<CatalogItemPresentationSaveResponse> & {
          message?: string;
        };
        if (!response.ok || !body.item) {
          throw new Error(
            `${savedAppearanceNow ? 'Videz je bil shranjen, vsebina pa ne. ' : ''}${
              body.message ?? 'Shranjevanje vsebine artikla ni uspelo.'
            }`
          );
        }
        applyLoadedProduct(body.item);
        savedProductNow = true;
      }

      if (savedAppearanceNow && savedProductNow) {
        toast.success('Videz in vsebina artikla sta shranjena.');
      } else if (savedProductNow) {
        toast.success('Vsebina artikla je shranjena.');
      } else if (savedAppearanceNow) {
        toast.success('Videz artiklov je shranjen.');
      }
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Shranjevanje nastavitev ni uspelo.');
    } finally {
      setIsSaving(false);
    }
  }

  function renderSettings(section: SectionKey) {
    if (section === 'listings') return (
      <>
        <SettingsGroup title="Postavitev seznama">
          <FieldGrid>
            <SelectField label="Razpoložljivi pogledi" value={config.listings.availableModes} options={[{ value: 'grid', label: 'Samo mreža' }, { value: 'list', label: 'Samo seznam' }, { value: 'both', label: 'Mreža in seznam' }]} onChange={(availableModes) => updateSection('listings', { availableModes })} />
            <SelectField label="Privzeti pogled" value={config.listings.defaultMode} options={[{ value: 'grid', label: 'Mreža' }, { value: 'list', label: 'Seznam' }]} onChange={(defaultMode) => updateSection('listings', { defaultMode })} />
            <NumberField label="Stolpci · desktop" value={config.listings.desktopColumns} min={2} max={6} onChange={(desktopColumns) => updateSection('listings', { desktopColumns })} />
            <NumberField label="Stolpci · tablica" value={config.listings.tabletColumns} min={1} max={4} onChange={(tabletColumns) => updateSection('listings', { tabletColumns })} />
            <NumberField label="Stolpci · mobilno" value={config.listings.mobileColumns} min={1} max={2} onChange={(mobileColumns) => updateSection('listings', { mobileColumns })} />
            <NumberField label="Razmik med karticami" value={config.listings.gapPx} min={8} max={48} suffix="px" onChange={(gapPx) => updateSection('listings', { gapPx })} />
            <SelectField label="Gostota kartice" value={config.listings.cardDensity} options={[{ value: 'compact', label: 'Kompaktna' }, { value: 'comfortable', label: 'Uravnotežena' }, { value: 'spacious', label: 'Prostorna' }]} onChange={(cardDensity) => updateSection('listings', { cardDensity })} />
            <NumberField label="Vrstice naziva" value={config.listings.titleLines} min={1} max={4} onChange={(titleLines) => updateSection('listings', { titleLines })} />
            <SelectField label="Razmerje slike" value={config.listings.imageRatio} options={[{ value: '1:1', label: 'Kvadrat 1 : 1' }, { value: '4:3', label: '4 : 3' }, { value: '3:2', label: '3 : 2' }, { value: '16:9', label: '16 : 9' }]} onChange={(imageRatio) => updateSection('listings', { imageRatio })} />
            <SelectField label="Prileganje slike" value={config.listings.imageFit} options={[{ value: 'contain', label: 'Celotna slika' }, { value: 'cover', label: 'Zapolni okvir' }]} onChange={(imageFit) => updateSection('listings', { imageFit })} />
            <SelectField label="Položaj filtrov" hint="Na voljo po uvedbi podatkovnega modela filtrov." disabled value={config.listings.filterPlacement} options={[{ value: 'sidebar', label: 'Stranski stolpec' }, { value: 'toolbar', label: 'Orodna vrstica' }]} onChange={(filterPlacement) => updateSection('listings', { filterPlacement })} />
            <SelectField label="Straničenje" hint="Na voljo po uvedbi strežniškega straničenja." disabled value={config.listings.paginationStyle} options={[{ value: 'pages', label: 'Številke strani' }, { value: 'load-more', label: 'Naloži več' }]} onChange={(paginationStyle) => updateSection('listings', { paginationStyle })} />
          </FieldGrid>
        </SettingsGroup>
        <SettingsGroup title="Vsebina kartice">
          <div className="grid gap-2 sm:grid-cols-2">
            <ToggleField label="Blagovna znamka" checked={config.listings.showBrand} onChange={(showBrand) => updateSection('listings', { showBrand })} />
            <ToggleField label="SKU" checked={config.listings.showSku} onChange={(showSku) => updateSection('listings', { showSku })} />
            <ToggleField label="Kratek opis" checked={config.listings.showShortDescription} onChange={(showShortDescription) => updateSection('listings', { showShortDescription })} />
            <ToggleField label="Zaloga" checked={config.listings.showStock} onChange={(showStock) => updateSection('listings', { showStock })} />
            <ToggleField label="Popust" checked={config.listings.showDiscount} onChange={(showDiscount) => updateSection('listings', { showDiscount })} />
            <ToggleField label="Nakupno dejanje" checked={config.listings.showPurchaseAction} onChange={(showPurchaseAction) => updateSection('listings', { showPurchaseAction })} />
            <ToggleField label="Hiter nakup enostavnega artikla" checked={config.listings.allowSimpleQuickAdd} onChange={(allowSimpleQuickAdd) => updateSection('listings', { allowSimpleQuickAdd })} />
            <ToggleField label="Prikaži nerazpoložljive različice" description="Dogovorjeno vedenje: aktivne različice z zalogo 0 ostanejo vidne." checked={config.listings.showUnavailableVariants} onChange={() => undefined} locked />
            <ToggleField label="Ploščice podkategorij" description="Združevanje izdelkov brez ploščic zahteva prihodnjo spremembo podatkovnega vira." checked={config.listings.subcategoryTilesVisible} onChange={() => undefined} locked />
          </div>
        </SettingsGroup>
      </>
    );

    if (section === 'productPage') return (
      <>
        <SettingsGroup title="Mreža strani" description="Širina sledi vsebinskemu pasu iz Globalnih parametrov; tukaj urejate samo razmerja znotraj njega.">
          <FieldGrid>
            <NumberField label="Razmik stolpcev" value={config.productPage.columnGapPx} min={8} max={64} suffix="px" onChange={(columnGapPx) => updateSection('productPage', { columnGapPx })} />
            <NumberField label="Galerija" value={config.productPage.galleryColumns} min={3} max={7} suffix="delov" onChange={(galleryColumns) => updateSection('productPage', { galleryColumns })} />
            <NumberField label="Informacije" value={config.productPage.informationColumns} min={3} max={6} suffix="delov" onChange={(informationColumns) => updateSection('productPage', { informationColumns })} />
            <NumberField label="Nakup" value={config.productPage.purchaseColumns} min={2} max={5} suffix="delov" onChange={(purchaseColumns) => updateSection('productPage', { purchaseColumns })} />
          </FieldGrid>
        </SettingsGroup>
        <SettingsGroup title="Obnašanje">
          <div className="grid gap-2 sm:grid-cols-2">
            <ToggleField label="Drobtinice" checked={config.productPage.showBreadcrumbs} onChange={(showBreadcrumbs) => updateSection('productPage', { showBreadcrumbs })} />
            <ToggleField label="Lepljivo nakupno območje · desktop" checked={config.productPage.stickyPurchaseDesktop} onChange={(stickyPurchaseDesktop) => updateSection('productPage', { stickyPurchaseDesktop })} />
            <ToggleField label="Lepljivo nakupno dejanje · mobilno" description="Spodnja vrstica ostane vidna, ko je izbrana veljavna različica." checked={config.productPage.stickyPurchaseMobile} onChange={(stickyPurchaseMobile) => updateSection('productPage', { stickyPurchaseMobile })} />
          </div>
          <OrderEditor label="Vrstni red informacij" values={config.productPage.informationOrder} labels={informationLabels} onChange={(informationOrder) => updateSection('productPage', { informationOrder })} />
        </SettingsGroup>
      </>
    );

    if (section === 'gallery') return (
      <>
        <SettingsGroup title="Slika in sličice">
          <FieldGrid>
            <SelectField label="Razmerje slike" value={config.gallery.imageRatio} options={[{ value: '1:1', label: 'Kvadrat 1 : 1' }, { value: '4:3', label: '4 : 3' }, { value: '3:2', label: '3 : 2' }, { value: '16:9', label: '16 : 9' }]} onChange={(imageRatio) => updateSection('gallery', { imageRatio })} />
            <SelectField label="Prileganje slike" value={config.gallery.imageFit} options={[{ value: 'contain', label: 'Celotna slika' }, { value: 'cover', label: 'Zapolni okvir' }]} onChange={(imageFit) => updateSection('gallery', { imageFit })} />
            <SelectField label="Sličice · desktop" value={config.gallery.thumbnailPositionDesktop} options={[{ value: 'left', label: 'Levo · navpično' }, { value: 'right', label: 'Desno · navpično' }, { value: 'top', label: 'Zgoraj · vodoravno' }, { value: 'bottom', label: 'Spodaj · vodoravno' }, { value: 'hidden', label: 'Skrito' }]} onChange={(thumbnailPositionDesktop) => updateSection('gallery', { thumbnailPositionDesktop })} />
            <SelectField label="Sličice · mobilno" value={config.gallery.thumbnailPositionMobile} options={[{ value: 'left', label: 'Levo · navpično' }, { value: 'right', label: 'Desno · navpično' }, { value: 'top', label: 'Zgoraj · vodoravno' }, { value: 'bottom', label: 'Spodaj · vodoravno' }, { value: 'hidden', label: 'Skrito' }]} onChange={(thumbnailPositionMobile) => updateSection('gallery', { thumbnailPositionMobile })} />
            <NumberField label="Velikost galerije" value={config.gallery.sizePercent} min={50} max={100} suffix="%" onChange={(sizePercent) => updateSection('gallery', { sizePercent })} />
            <NumberField label="Velikost sličice" value={config.gallery.thumbnailSizePx} min={30} max={120} suffix="px" onChange={(thumbnailSizePx) => updateSection('gallery', { thumbnailSizePx })} />
            <NumberField label="Razmik sličic" value={config.gallery.thumbnailGapPx} min={0} max={40} suffix="px" onChange={(thumbnailGapPx) => updateSection('gallery', { thumbnailGapPx })} />
            <NumberField label="Vidne sličice" value={config.gallery.visibleThumbnailCount} min={3} max={12} onChange={(visibleThumbnailCount) => updateSection('gallery', { visibleThumbnailCount })} />
            <SelectField label="Povečava" value={config.gallery.zoomMode} options={[{ value: 'none', label: 'Brez povečave' }, { value: 'click', label: 'Ob kliku' }, { value: 'hover-and-click', label: 'Ob prehodu in kliku' }]} onChange={(zoomMode) => updateSection('gallery', { zoomMode })} />
          </FieldGrid>
        </SettingsGroup>
        <SettingsGroup title="Krmiljenje in mediji">
          <div className="grid gap-2 sm:grid-cols-2">
            <ToggleField label="Puščice" checked={config.gallery.showArrows} onChange={(showArrows) => updateSection('gallery', { showArrows })} />
            <ToggleField label="Skrij sličice pri eni sliki" checked={config.gallery.hideThumbnailsWhenSingle} onChange={(hideThumbnailsWhenSingle) => updateSection('gallery', { hideThumbnailsWhenSingle })} />
            <ToggleField label="Pike · mobilno" checked={config.gallery.showDotsMobile} onChange={(showDotsMobile) => updateSection('gallery', { showDotsMobile })} />
            <ToggleField label="Tipkovnica" checked={config.gallery.keyboardNavigation} onChange={(keyboardNavigation) => updateSection('gallery', { keyboardNavigation })} />
            <ToggleField label="Video sličice" checked={config.gallery.showVideoThumbnails} onChange={(showVideoThumbnails) => updateSection('gallery', { showVideoThumbnails })} />
            <ToggleField label="Dokumenti v galeriji" checked={config.gallery.showDocumentThumbnails} onChange={(showDocumentThumbnails) => updateSection('gallery', { showDocumentThumbnails })} />
          </div>
        </SettingsGroup>
      </>
    );

    if (section === 'information') return (
      <SettingsGroup title="Vidnost in berljivost">
        <FieldGrid>
          <NumberField label="Največja širina dolgega opisa" value={config.information.longDescriptionMaxWidthPx} min={480} max={1400} suffix="px" onChange={(longDescriptionMaxWidthPx) => updateSection('information', { longDescriptionMaxWidthPx })} />
        </FieldGrid>
        <div className="grid gap-2 sm:grid-cols-2">
          <ToggleField label="Kategorija" checked={config.information.showCategory} onChange={(showCategory) => updateSection('information', { showCategory })} />
          <ToggleField label="Blagovna znamka" checked={config.information.showBrand} onChange={(showBrand) => updateSection('information', { showBrand })} />
          <ToggleField label="Oznaka" checked={config.information.showBadge} onChange={(showBadge) => updateSection('information', { showBadge })} />
          <ToggleField label="SKU" checked={config.information.showSku} onChange={(showSku) => updateSection('information', { showSku })} />
          <ToggleField label="Kratek opis" checked={config.information.showShortDescription} onChange={(showShortDescription) => updateSection('information', { showShortDescription })} />
          <ToggleField label="Ključne lastnosti" checked={config.information.showKeyAttributes} onChange={(showKeyAttributes) => updateSection('information', { showKeyAttributes })} />
        </div>
      </SettingsGroup>
    );

    if (section === 'pricing') return (
      <>
        <SettingsGroup title="Poudarek in razčlenitev" description="Končna cena z DDV je zaradi jasnosti za kupca vedno prikazana.">
          <FieldGrid>
            <SelectField label="Poudarek cene" value={config.pricing.emphasis} options={[{ value: 'standard', label: 'Standardni' }, { value: 'strong', label: 'Močan' }]} onChange={(emphasis) => updateSection('pricing', { emphasis })} />
          </FieldGrid>
          <div className="grid gap-2 sm:grid-cols-2">
            <ToggleField label="Cena z DDV" description="Obvezna javna končna cena." checked={config.pricing.showGrossPrice} onChange={() => undefined} locked />
            <ToggleField label="Cena brez DDV" description="Obvezna razčlenitev za vse tipe naročnikov." checked={config.pricing.showNetPrice} onChange={() => undefined} locked />
            <ToggleField label="Stopnja DDV" description="Obvezna razčlenitev za vse tipe naročnikov." checked={config.pricing.showTaxRate} onChange={() => undefined} locked />
            <ToggleField label="Znesek DDV" description="Obvezna razčlenitev za vse tipe naročnikov." checked={config.pricing.showTaxAmount} onChange={() => undefined} locked />
            <ToggleField label="Prvotna cena" checked={config.pricing.showOriginalPrice} onChange={(showOriginalPrice) => updateSection('pricing', { showOriginalPrice })} />
            <ToggleField label="Odstotek popusta" checked={config.pricing.showDiscountPercentage} onChange={(showDiscountPercentage) => updateSection('pricing', { showDiscountPercentage })} />
            <ToggleField label="Absolutni prihranek" checked={config.pricing.showAbsoluteSavings} onChange={(showAbsoluteSavings) => updateSection('pricing', { showAbsoluteSavings })} />
            <ToggleField label="Cena na enoto" checked={config.pricing.showUnitPrice} onChange={(showUnitPrice) => updateSection('pricing', { showUnitPrice })} />
            <ToggleField label="Razpon cen na seznamu" checked={config.pricing.listingUsesPriceRange} onChange={(listingUsesPriceRange) => updateSection('pricing', { listingUsesPriceRange })} />
          </div>
        </SettingsGroup>
      </>
    );

    if (section === 'variants') return (
      <SettingsGroup title="Izbiranje različic" description="Nerazpoložljive vrednosti ostanejo vidne in pojasnjene; veljavna zaloga lahko nadomesti privzeto različico z zalogo 0.">
        <FieldGrid>
          <SelectField label="Slog izbirnika" value={config.variants.selectorStyle} options={[{ value: 'auto', label: 'Samodejno glede na os' }, { value: 'chips', label: 'Gumbi' }, { value: 'select', label: 'Spustni seznam' }, { value: 'swatches', label: 'Barvni vzorci' }]} onChange={(selectorStyle) => updateSection('variants', { selectorStyle })} />
          <NumberField label="Širina gumba" value={config.variants.chipWidthPx} min={72} max={180} suffix="px" onChange={(chipWidthPx) => updateSection('variants', { chipWidthPx })} />
          <NumberField label="Višina gumba" value={config.variants.chipHeightPx} min={36} max={80} suffix="px" onChange={(chipHeightPx) => updateSection('variants', { chipHeightPx })} />
          <NumberField label="Velikost besedila gumba" value={config.variants.chipFontSizePx} min={11} max={24} suffix="px" onChange={(chipFontSizePx) => updateSection('variants', { chipFontSizePx })} />
          <NumberField label="Velikost naslovov izbirnikov" value={config.variants.labelFontSizePx} min={11} max={28} suffix="px" onChange={(labelFontSizePx) => updateSection('variants', { labelFontSizePx })} />
          <NumberField label="Razmik med naslovom in izbirnikom" value={config.variants.labelControlGapPx} min={0} max={32} suffix="px" onChange={(labelControlGapPx) => updateSection('variants', { labelControlGapPx })} />
          <NumberField label="Širina spustnega seznama" value={config.variants.selectWidthPx} min={160} max={500} suffix="px" onChange={(selectWidthPx) => updateSection('variants', { selectWidthPx })} />
          <NumberField label="Višina spustnega seznama" value={config.variants.selectHeightPx} min={40} max={88} suffix="px" onChange={(selectHeightPx) => updateSection('variants', { selectHeightPx })} />
        </FieldGrid>
        <div className="grid gap-2 sm:grid-cols-2">
          <ToggleField label="Oznaka nad izbirnikom" checked={config.variants.labelAboveSelector} onChange={(labelAboveSelector) => updateSection('variants', { labelAboveSelector })} />
          <ToggleField label="Kompaktni izbirniki" checked={config.variants.compactSelectors} onChange={(compactSelectors) => updateSection('variants', { compactSelectors })} />
          <ToggleField label="Nerazpoložljive vrednosti" description="Dogovorjeno vedenje kataloga." checked={config.variants.showUnavailableValues} onChange={() => undefined} locked />
          <ToggleField label="Povzetek izbire" checked={config.variants.showSelectedSummary} onChange={(showSelectedSummary) => updateSection('variants', { showSelectedSummary })} />
          <ToggleField label="Razlog nezdružljivosti" checked={config.variants.showCompatibilityReasons} onChange={(showCompatibilityReasons) => updateSection('variants', { showCompatibilityReasons })} />
          <ToggleField label="Samodejna alternativa na zalogi" description="Uporabi vrstni red različic." checked={config.variants.autoSelectFallbackInStock} onChange={() => undefined} locked />
        </div>
      </SettingsGroup>
    );

    if (section === 'purchaseArea') return (
      <SettingsGroup title="Nakupno območje">
        <FieldGrid>
          <SelectField label="Slog območja" value={config.purchaseArea.panelStyle} options={[{ value: 'flat', label: 'Brez kartice' }, { value: 'card', label: 'Kartica' }]} onChange={(panelStyle) => updateSection('purchaseArea', { panelStyle })} />
        </FieldGrid>
        <div className="grid gap-2 sm:grid-cols-2">
          <ToggleField label="Primarno dejanje čez širino" checked={config.purchaseArea.fullWidthPrimaryAction} onChange={(fullWidthPrimaryAction) => updateSection('purchaseArea', { fullWidthPrimaryAction })} />
          <ToggleField label="Razpoložljivost" checked={config.purchaseArea.showAvailability} onChange={(showAvailability) => updateSection('purchaseArea', { showAvailability })} />
          <ToggleField label="Ocena dobave" checked={config.purchaseArea.showDeliveryEstimate} onChange={(showDeliveryEstimate) => updateSection('purchaseArea', { showDeliveryEstimate })} />
          <ToggleField label="Najmanjša količina" checked={config.purchaseArea.showMinimumOrder} onChange={(showMinimumOrder) => updateSection('purchaseArea', { showMinimumOrder })} />
          <ToggleField label="Krmilnik količine" checked={config.purchaseArea.showQuantityStepper} onChange={(showQuantityStepper) => updateSection('purchaseArea', { showQuantityStepper })} />
          <ToggleField label="Sekundarno dejanje" checked={config.purchaseArea.showSecondaryAction} onChange={(showSecondaryAction) => updateSection('purchaseArea', { showSecondaryAction })} />
        </div>
      </SettingsGroup>
    );

    if (section === 'secondaryContent') return (
      <>
        <SettingsGroup title="Postavitev">
          <FieldGrid>
            <SelectField label="Desktop" value={config.secondaryContent.desktopLayout} options={[{ value: 'stacked', label: 'Zloženi sklopi' }, { value: 'tabs', label: 'Zavihki' }, { value: 'accordions', label: 'Harmonike' }]} onChange={(desktopLayout) => updateSection('secondaryContent', { desktopLayout })} />
            <SelectField label="Mobilno" value={config.secondaryContent.mobileLayout} options={[{ value: 'stacked', label: 'Zloženi sklopi' }, { value: 'tabs', label: 'Zavihki' }, { value: 'accordions', label: 'Harmonike' }]} onChange={(mobileLayout) => updateSection('secondaryContent', { mobileLayout })} />
          </FieldGrid>
          <OrderEditor label="Vrstni red sklopov" values={config.secondaryContent.blockOrder} labels={secondaryLabels} onChange={(blockOrder) => updateSection('secondaryContent', { blockOrder })} />
        </SettingsGroup>
        <SettingsGroup title="Odprto in oblikovano">
          <div className="grid gap-2 sm:grid-cols-2">
            {PRODUCT_SECONDARY_BLOCKS.map((block) => (
              <ToggleField
                key={block}
                label={`${secondaryLabels[block]} · odprto privzeto`}
                checked={config.secondaryContent.openByDefault.includes(block)}
                onChange={(checked) => updateSection('secondaryContent', {
                  openByDefault: checked
                    ? [...config.secondaryContent.openByDefault, block]
                    : config.secondaryContent.openByDefault.filter((entry) => entry !== block)
                })}
              />
            ))}
            <ToggleField label="Kompaktne specifikacije" checked={config.secondaryContent.compactSpecifications} onChange={(compactSpecifications) => updateSection('secondaryContent', { compactSpecifications })} />
            <ToggleField label="Črtaste specifikacije" checked={config.secondaryContent.stripedSpecifications} onChange={(stripedSpecifications) => updateSection('secondaryContent', { stripedSpecifications })} />
            <ToggleField label="Dokumenti kot kartice" checked={config.secondaryContent.documentsAsCards} onChange={(documentsAsCards) => updateSection('secondaryContent', { documentsAsCards })} />
          </div>
        </SettingsGroup>
        <SettingsGroup
          title="Ločnice vsebine"
          description="Nastavitve veljajo za zloženi namizni prikaz opisa in specifikacij."
        >
          <FieldGrid>
            <NumberField
              label="Debelina ločnic"
              value={config.secondaryContent.dividerThicknessPx}
              min={0.5}
              max={4}
              step={0.5}
              suffix="px"
              onChange={(dividerThicknessPx) => updateSection('secondaryContent', { dividerThicknessPx })}
            />
            <NumberField
              label="Položaj · opis / specifikacije"
              value={config.secondaryContent.descriptionColumnPercent}
              min={30}
              max={65}
              suffix="%"
              onChange={(descriptionColumnPercent) => updateSection('secondaryContent', { descriptionColumnPercent })}
            />
            <NumberField
              label="Položaj · skupini specifikacij"
              value={config.secondaryContent.specificationFirstColumnPercent}
              min={35}
              max={65}
              suffix="%"
              onChange={(specificationFirstColumnPercent) => updateSection('secondaryContent', { specificationFirstColumnPercent })}
            />
          </FieldGrid>
          <div className="grid gap-2 sm:grid-cols-2">
            <ToggleField label="Črta pod zavihki" checked={config.secondaryContent.showTabDivider} onChange={(showTabDivider) => updateSection('secondaryContent', { showTabDivider })} />
            <ToggleField label="Med opisom in specifikacijami" checked={config.secondaryContent.showContentDivider} onChange={(showContentDivider) => updateSection('secondaryContent', { showContentDivider })} />
            <ToggleField label="Med skupinama specifikacij" checked={config.secondaryContent.showSpecificationColumnDivider} onChange={(showSpecificationColumnDivider) => updateSection('secondaryContent', { showSpecificationColumnDivider })} />
            <ToggleField label="Med vrsticami specifikacij" checked={config.secondaryContent.showSpecificationRowDividers} onChange={(showSpecificationRowDividers) => updateSection('secondaryContent', { showSpecificationRowDividers })} />
          </div>
        </SettingsGroup>
      </>
    );

    if (section === 'relatedProducts') return (
      <SettingsGroup title="Sorodni artikli in dodatki">
        <FieldGrid>
          <SelectField label="Samodejni izbor" value={config.relatedProducts.sourceMode} options={[{ value: 'same-category', label: 'Ista kategorija' }, { value: 'same-subcategory', label: 'Ista podkategorija' }, { value: 'manual-only', label: 'Samo ročno' }]} onChange={(sourceMode) => updateSection('relatedProducts', { sourceMode })} />
          <SelectField label="Ročno izbrani izdelki" value={config.relatedProducts.manualPlacement} options={[{ value: 'before-auto', label: 'Pred samodejnimi' }, { value: 'after-auto', label: 'Za samodejnimi' }]} onChange={(manualPlacement) => updateSection('relatedProducts', { manualPlacement })} />
          <NumberField label="Največ artiklov" value={config.relatedProducts.maxItems} min={1} max={12} onChange={(maxItems) => updateSection('relatedProducts', { maxItems })} />
          <NumberField label="Stolpci · desktop" value={config.relatedProducts.desktopColumns} min={2} max={6} onChange={(desktopColumns) => updateSection('relatedProducts', { desktopColumns })} />
          <NumberField label="Stolpci · tablica" value={config.relatedProducts.tabletColumns} min={1} max={4} onChange={(tabletColumns) => updateSection('relatedProducts', { tabletColumns })} />
          <NumberField label="Stolpci · mobilno" value={config.relatedProducts.mobileColumns} min={1} max={2} onChange={(mobileColumns) => updateSection('relatedProducts', { mobileColumns })} />
          <NumberField label="Razmik med karticami" value={config.relatedProducts.gapPx} min={8} max={64} suffix="px" onChange={(gapPx) => updateSection('relatedProducts', { gapPx })} />
          <NumberField label="Širina kartice" value={config.relatedProducts.cardWidthPx} min={160} max={520} suffix="px" onChange={(cardWidthPx) => updateSection('relatedProducts', { cardWidthPx })} />
          <NumberField label="Višina slike kartice" value={config.relatedProducts.imageHeightPx} min={96} max={480} suffix="px" onChange={(imageHeightPx) => updateSection('relatedProducts', { imageHeightPx })} />
          <NumberField label="Velikost besedila kartice" value={config.relatedProducts.textScalePercent} min={70} max={140} suffix="%" onChange={(textScalePercent) => updateSection('relatedProducts', { textScalePercent })} />
          <NumberField label="Širina sklopa" value={config.relatedProducts.sectionWidthPercent} min={25} max={100} suffix="%" onChange={(sectionWidthPercent) => updateSection('relatedProducts', { sectionWidthPercent })} />
          <SelectField label="Položaj sklopa" value={config.relatedProducts.sectionPlacement} options={[{ value: 'before-content', label: 'Pred opisom' }, { value: 'after-content', label: 'Za opisom' }]} onChange={(sectionPlacement) => updateSection('relatedProducts', { sectionPlacement })} />
          <SelectField label="Poravnava sklopa" value={config.relatedProducts.sectionAlignment} options={[{ value: 'left', label: 'Levo' }, { value: 'center', label: 'Sredina' }, { value: 'right', label: 'Desno' }]} onChange={(sectionAlignment) => updateSection('relatedProducts', { sectionAlignment })} />
        </FieldGrid>
        <div className="grid gap-2 sm:grid-cols-2">
          <ToggleField label="Omogočeno" checked={config.relatedProducts.enabled} onChange={(enabled) => updateSection('relatedProducts', { enabled })} />
          <ToggleField label="Dodatki pred sorodnimi" description="Na voljo po uvedbi eksplicitnih povezav med artiklom in dodatki." checked={config.relatedProducts.showAccessoriesFirst} onChange={() => undefined} locked />
        </div>
      </SettingsGroup>
    );

    if (section === 'cartSidebar') return (
      <>
        <SettingsGroup title="Postavitev">
          <FieldGrid>
            <NumberField label="Širina" value={config.cartSidebar.widthPx} min={360} max={640} suffix="px" onChange={(widthPx) => updateSection('cartSidebar', { widthPx })} />
            <SelectField label="Stran" value={config.cartSidebar.side} options={[{ value: 'right', label: 'Desno' }, { value: 'left', label: 'Levo' }]} onChange={(side) => updateSection('cartSidebar', { side })} />
            <SelectField label="Mobilni prikaz" value={config.cartSidebar.mobileMode} options={[{ value: 'fullscreen', label: 'Cel zaslon' }, { value: 'sheet', label: 'Spodnji list' }]} onChange={(mobileMode) => updateSection('cartSidebar', { mobileMode })} />
            <NumberField label="Slika vrstice" value={config.cartSidebar.lineImageSizePx} min={48} max={120} suffix="px" onChange={(lineImageSizePx) => updateSection('cartSidebar', { lineImageSizePx })} />
          </FieldGrid>
        </SettingsGroup>
        <SettingsGroup title="Vsebina in vedenje">
          <div className="grid gap-2 sm:grid-cols-2">
            <ToggleField label="Kompaktne vrstice" checked={config.cartSidebar.compactRows} onChange={(compactRows) => updateSection('cartSidebar', { compactRows })} />
            <ToggleField label="Lepljiv povzetek" checked={config.cartSidebar.stickySummary} onChange={(stickySummary) => updateSection('cartSidebar', { stickySummary })} />
            <ToggleField label="Neto in DDV razčlenitev" description="Dogovorjena preglednost cene." checked={config.cartSidebar.showNetTaxBreakdown} onChange={() => undefined} locked />
            <ToggleField label="Poudari dodano vrstico" checked={config.cartSidebar.highlightAddedLine} onChange={(highlightAddedLine) => updateSection('cartSidebar', { highlightAddedLine })} />
            <ToggleField label="Sorodni artikli v košarici" description="Izključeno, da nakupna pot ostane mirna." checked={config.cartSidebar.showRelatedProducts} onChange={() => undefined} locked />
          </div>
        </SettingsGroup>
      </>
    );

    return (
      <SettingsGroup title="Dovoljene lokalne izjeme" description="Globalne barve, tipografija, gumbi, polja, robovi, radiji in sence se vedno dedujejo iz Globalnih parametrov.">
        <div className="grid gap-2">
          <ToggleField label="Predloge po kategoriji" description="Začetno izključeno; vse kategorije uporabljajo isti sistem." checked={config.overrides.allowCategoryTemplates} onChange={() => undefined} locked />
          <ToggleField label="Postavitev po artiklu" checked={config.overrides.allowProductLayoutOverride} onChange={(allowProductLayoutOverride) => updateSection('overrides', { allowProductLayoutOverride })} />
          <ToggleField label="Galerija po artiklu" checked={config.overrides.allowProductGalleryOverride} onChange={(allowProductGalleryOverride) => updateSection('overrides', { allowProductGalleryOverride })} />
          <ToggleField label="Vidnost sklopov po artiklu" checked={config.overrides.allowProductBlockVisibilityOverride} onChange={(allowProductBlockVisibilityOverride) => updateSection('overrides', { allowProductBlockVisibilityOverride })} />
        </div>
      </SettingsGroup>
    );
  }

  const groupedSections = sections.reduce<Array<{ label: string; items: typeof sections }>>((groups, section) => {
    const existing = groups.find((group) => group.label === section.group);
    if (existing) existing.items.push(section);
    else groups.push({ label: section.group, items: [section] });
    return groups;
  }, []);
  return (
    <StorefrontInventoryPolicyProvider
      stockEnforcementEnabled={initialStockEnforcementEnabled}
    >
      <div className="space-y-4" data-appearance-settings-density="compact" data-appearance-settings-page="artikli">
      <AdminPageHeader
        title="Artikli"
        description="Urejajte resničen artikel neposredno v predogledu. Vsebina ostane skupna z Artikli, vizualni jezik pa se deduje iz Globalnih parametrov."
        actions={
          <div className="flex items-center gap-2">
            <span className="mr-1 inline-flex items-center gap-1.5 text-[11px] font-medium text-slate-500" aria-live="polite">
              <span className={`h-1.5 w-1.5 rounded-full ${isDirty ? 'bg-amber-500' : 'bg-emerald-500'}`} />
              {isProductDirty && isAppearanceDirty
                ? 'Neshranjena videz in vsebina'
                : isProductDirty
                  ? 'Neshranjena vsebina'
                  : isAppearanceDirty
                    ? 'Neshranjen videz'
                    : 'Objavljeno'}
            </span>
            <button type="button" aria-label="Ponastavi na priporočene vrednosti" title="Ponastavi na priporočene vrednosti" onClick={() => setConfig(normalizeProductAppearanceConfig(cloneDefaultProductAppearanceConfig()))} disabled={isSaving} className={`grid h-8 w-8 place-items-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-800 disabled:opacity-40 ${adminControlFocusTokenClasses}`}>
              <RotateCcw className="h-4 w-4" />
            </button>
            <Button type="button" variant="primary" size="toolbar" onClick={save} disabled={!isDirty || isSaving} className="gap-2">
              <Save className="h-4 w-4" /> {isSaving ? 'Shranjujem …' : 'Shrani'}
            </Button>
          </div>
        }
      />
      <AdminPodobaTabs />

      <section className="grid gap-3 rounded-xl border border-slate-200 bg-white p-3 min-[860px]:grid-cols-[minmax(260px,1fr)_auto] min-[860px]:items-end">
        <div className="grid max-w-xl gap-1.5">
          <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">
            Artikel v predogledu
          </span>
          <AppearanceEditorCompactSelect
            value={selectedProductSlug}
            disabled={isLoadingProduct || productOptions.length === 0}
            options={productOptions.map((item) => ({
              value: item.slug,
              label: `${item.itemName} · ${item.status === 'active' ? 'aktiven' : 'neaktiven'}`
            }))}
            placeholder="Ni artiklov za predogled"
            ariaLabel="Artikel v predogledu"
            marker="product-preview-product"
            tone="light"
            triggerClassName="!h-8 !rounded-md !border-slate-300 !bg-white !px-2.5 !text-[12px] !font-normal !text-slate-700"
            onValueChange={(slug) => void changeSelectedProduct(slug)}
          />
          <span className="text-[10px] leading-4 text-slate-500">
            Predogled uporablja dejanske slike, različice, cene, zalogo, opis in specifikacije iz Artikli.
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {product ? (
            <a
              href={`/admin/artikli/${encodeURIComponent(product.slug)}`}
              className={`inline-flex h-9 items-center rounded-lg border border-slate-200 px-3 text-[10px] font-semibold text-slate-600 hover:bg-slate-50 ${adminControlFocusTokenClasses}`}
            >
              Odpri celoten zapis
            </a>
          ) : null}
          <button
            type="button"
            onClick={() => setShowAdvancedSettings((current) => !current)}
            aria-expanded={showAdvancedSettings}
            className={`h-9 rounded-lg border px-3 text-[10px] font-semibold ${adminControlFocusTokenClasses} ${
              showAdvancedSettings
                ? 'border-[color:var(--blue-200)] bg-[color:var(--blue-50)] text-[color:var(--blue-700)]'
                : 'border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            {showAdvancedSettings ? 'Zapri napredne nastavitve' : 'Napredne privzete nastavitve'}
          </button>
        </div>
      </section>

      {showAdvancedSettings ? (
      <div className="grid min-w-0 gap-4 min-[1020px]:grid-cols-[220px_minmax(0,1fr)]">
        <aside className="min-w-0 self-start overflow-hidden rounded-xl border border-slate-200 bg-white min-[1020px]:sticky min-[1020px]:top-5">
          <div className="border-b border-slate-200 px-3 py-2.5">
            <h2 className="text-xs font-semibold text-slate-800">Produktni elementi</h2>
            <p className="mt-0.5 text-[10px] text-slate-500">Izberite sklop za urejanje.</p>
          </div>
          <nav className="max-h-[calc(100vh-220px)] overflow-y-auto p-2" data-appearance-editor-scroll-purpose="navigation">
            {groupedSections.map((group) => (
              <div key={group.label} className="mb-3 last:mb-0">
                <p className="mb-1 px-2 text-[9px] font-semibold uppercase tracking-[0.1em] text-slate-400">{group.label}</p>
                <div className="grid gap-0.5">
                  {group.items.map((section) => (
                    <button
                      key={section.key}
                      type="button"
                      onClick={() => {
                        setActiveSection(section.key);
                        selectPreviewPage(section.preview);
                      }}
                      aria-current={activeSection === section.key ? 'page' : undefined}
                      className={`w-full rounded-lg border px-2.5 py-2 text-left transition ${adminControlFocusTokenClasses} ${activeSection === section.key ? 'border-[color:var(--blue-100)] bg-[color:var(--blue-50)] text-[color:var(--blue-700)]' : 'border-transparent text-slate-700 hover:bg-slate-50'}`}
                    >
                      <span className="block text-[11px] font-semibold">{section.label}</span>
                      <span className={`mt-0.5 block text-[9px] leading-3.5 ${activeSection === section.key ? 'text-[color:var(--blue-600)]/75' : 'text-slate-400'}`}>{section.description}</span>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </nav>
        </aside>

        <section className="min-w-0 overflow-hidden rounded-xl border border-slate-200 bg-white">
          <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 px-4 py-3">
            <div>
              <p className="text-[9px] font-semibold uppercase tracking-[0.1em] text-[color:var(--blue-600)]">{activeDefinition.group}</p>
              <h2 className="mt-0.5 text-base font-semibold text-slate-900">{activeDefinition.label}</h2>
              <p className="mt-0.5 text-[10px] text-slate-500">{activeDefinition.description}</p>
            </div>
            <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[10px] font-medium text-slate-500">Deduje Globalne parametre</span>
          </div>

          <div className="grid min-w-0 items-start gap-4 bg-slate-50/50 p-4 min-[1220px]:grid-cols-[minmax(330px,0.82fr)_minmax(430px,1.18fr)]">
            <div className="grid min-w-0 gap-3 rounded-xl border border-slate-200 bg-white p-3" data-appearance-editor-settings-surface data-settings-scroll="none">
              {renderSettings(activeSection)}
            </div>

            <aside className="min-w-0 overflow-hidden rounded-xl border border-slate-200 bg-white min-[1220px]:sticky min-[1220px]:top-5">
              <div className="grid gap-2 border-b border-slate-200 px-3 py-2">
                <div>
                  <p className="text-xs font-semibold text-slate-800">Predogled</p>
                  <p className="text-[10px] text-slate-500">Neshranjene spremembe se pokažejo takoj.</p>
                </div>
                <div className="flex min-w-0 flex-wrap items-center gap-2">
                  <PreviewDeviceControls value={previewDevice} onChange={setPreviewDevice} />
                  <div className="ml-auto shrink-0">
                    <PreviewPageControls value={previewPage} onChange={selectPreviewPage} />
                  </div>
                </div>
              </div>
              <div className="overflow-auto bg-slate-100 p-3" data-appearance-editor-scroll-purpose="preview">
                <div
                  ref={previewMotion.setStageElement}
                  className="relative flex w-full items-start justify-center overflow-x-clip"
                  data-testid="product-preview-stage"
                >
                  <div
                    ref={previewMotion.setFrameElement}
                    className="w-full shrink-0 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"
                    data-testid="product-preview-frame"
                    data-product-preview-frame
                  >
                    {previewPage === 'product' && previewProduct ? (
                      <ProductAppearanceLivePreview
                        config={config}
                        globalStyle={initialGlobalStyle}
                        siteLayout={initialSiteLayout}
                        product={previewProduct}
                        device={previewMotion.renderDevice}
                        motionFrameRef={previewMotion.frameRef}
                        transitioning={previewMotion.phase === 'animating'}
                        selectedElementId={null}
                        selectedElementIds={[]}
                        onSelectElement={() => undefined}
                        onElementChange={() => undefined}
                      />
                    ) : (
                      <ProductPreview
                        config={config}
                        globalStyle={initialGlobalStyle}
                        page={previewPage}
                        device={previewMotion.renderDevice}
                        product={previewProduct}
                      />
                    )}
                  </div>
                </div>
              </div>
            </aside>
          </div>
        </section>
      </div>
      ) : (
        <section className="min-w-0 overflow-hidden rounded-xl border border-slate-200 bg-white">
          <div className="grid gap-2 border-b border-slate-200 px-3 py-2.5">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">Interaktivni predogled</h2>
              <p className="mt-0.5 text-[10px] text-slate-500">
                Kliknite element v resničnem predogledu, nato ga povlecite ali spremenite z njegovo kontekstno orodno vrstico.
              </p>
            </div>
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <PreviewDeviceControls value={previewDevice} onChange={setPreviewDevice} />
              <div
                ref={inlineToolbarRef}
                role="toolbar"
                aria-label="Glavna orodna vrstica predogleda"
                data-product-page-toolbar
                data-toolbar-mode="inline"
                data-toolbar-placement="inline"
                data-toolbar-ready="true"
                className="relative z-[110] ml-1 w-max max-w-full min-w-0 border-0 bg-transparent p-0 shadow-none"
              >
                <AppearanceEditorToolbarToneProvider tone="light">
                  <div className="flex min-w-0 items-center gap-0.5">
                    <span className="mr-1 inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-[11px] font-semibold text-slate-700">
                      <Layers3 className="h-3.5 w-3.5" />
                      Stran
                    </span>
                    <AppearanceEditorToolbarDivider />
                    <AppearanceEditorToolbarButton
                      label="Elementi"
                      popover
                      active={isElementPickerOpen}
                      onClick={toggleElementPicker}
                    >
                      <Layers3 className="h-3.5 w-3.5" />
                    </AppearanceEditorToolbarButton>
                    <AppearanceEditorToolbarButton
                      label="Mreža, pripenjanje in vodila"
                      popover
                      pressed={config.canvas.showGrid}
                      active={isGridSettingsOpen}
                      onClick={toggleGridSettings}
                    >
                      <Grid3X3 className="h-3.5 w-3.5" />
                    </AppearanceEditorToolbarButton>
                  </div>
                </AppearanceEditorToolbarToneProvider>

                {isElementPickerOpen ? (
                  <div
                    role="dialog"
                    aria-label="Elementi predogleda"
                    className="absolute right-0 top-[calc(100%+6px)] z-[130] w-[min(360px,calc(100vw-32px))] max-md:fixed max-md:inset-x-3 max-md:top-20 max-md:w-auto"
                  >
                    <ProductAppearanceLayersPanel
                      items={productAppearanceLayerItems}
                      selectedIds={selectedCanvasElementIds}
                      onSelect={selectCanvasElement}
                      onToggleVisibility={toggleLayerVisibility}
                      onToggleLock={toggleLayerLock}
                      onReorder={reorderLayers}
                    />
                  </div>
                ) : null}
                {isGridSettingsOpen ? (
                  <div
                    role="dialog"
                    aria-label="Mreža, pripenjanje in vodila"
                    className={`absolute right-0 top-[calc(100%+6px)] z-[130] w-[min(320px,calc(100vw-32px))] overflow-hidden max-md:fixed max-md:inset-x-3 max-md:top-20 max-md:w-auto ${appearanceEditorToolbarPopoverSurfaceClassName}`}
                  >
                    <div className="flex items-start justify-between gap-2.5 border-b border-white/15 px-3 pb-1.5 pt-2">
                      <div className="min-w-0 flex-1">
                        <p className="text-[12px] font-semibold text-white">Mreža in vodila</p>
                        <p className="mt-0.5 text-[10px] text-white/70">Nastavitve interaktivnega platna.</p>
                      </div>
                      <button
                        type="button"
                        aria-label="Zapri"
                        title="Zapri"
                        onClick={() => setIsGridSettingsOpen(false)}
                        className={`grid h-6 w-6 shrink-0 place-items-center rounded-md text-white/75 transition hover:bg-white/10 hover:text-white ${adminControlFocusTokenClasses}`}
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <div className="grid gap-2.5 p-3 text-[10px] text-white/80">
                      <label className="flex items-center justify-between gap-3 rounded-lg bg-white/5 px-2.5 py-2">
                        <span>Prikaži mrežo</span>
                        <input
                          type="checkbox"
                          checked={config.canvas.showGrid}
                          onChange={(event) => updateCanvas({ showGrid: event.target.checked })}
                          className={`h-3.5 w-3.5 rounded border-white/30 bg-white/10 text-[color:var(--blue-500)] ${adminControlFocusTokenClasses}`}
                        />
                      </label>
                      <label className="flex items-center justify-between gap-3 rounded-lg bg-white/5 px-2.5 py-2">
                        <span>Pripni na mrežo</span>
                        <input
                          type="checkbox"
                          checked={config.canvas.snapToGrid}
                          onChange={(event) => updateCanvas({ snapToGrid: event.target.checked })}
                          className={`h-3.5 w-3.5 rounded border-white/30 bg-white/10 text-[color:var(--blue-500)] ${adminControlFocusTokenClasses}`}
                        />
                      </label>
                      <label className="flex items-center justify-between gap-3 rounded-lg bg-white/5 px-2.5 py-2">
                        <span>Prikaži vodila</span>
                        <input
                          type="checkbox"
                          checked={config.canvas.showGuides}
                          onChange={(event) => updateCanvas({ showGuides: event.target.checked })}
                          className={`h-3.5 w-3.5 rounded border-white/30 bg-white/10 text-[color:var(--blue-500)] ${adminControlFocusTokenClasses}`}
                        />
                      </label>
                      <label className="flex items-center justify-between gap-3 rounded-lg bg-white/5 px-2.5 py-2">
                        <span>Korak mreže</span>
                        <span className="flex items-center gap-1.5">
                          <AppearanceEditorNumberInput
                            min={2}
                            max={64}
                            value={config.canvas.gridSizePx}
                            onValueChange={(value) => updateCanvas({ gridSizePx: value })}
                            className={`h-7 w-14 rounded-md border border-white/15 bg-white/10 px-2 text-right text-[10px] text-white ${adminInputFocusTokenClasses}`}
                          />
                          px
                        </span>
                      </label>
                    </div>
                  </div>
                ) : null}
              </div>
              <div className="ml-auto shrink-0">
                <PreviewPageControls value={previewPage} onChange={selectPreviewPage} />
              </div>
            </div>
          </div>

          <div className="grid min-h-[680px] min-w-0 grid-cols-1 items-start bg-slate-50/60 lg:grid-cols-[minmax(0,1fr)_286px]">
            <aside className="hidden">
              <div className="border-b border-slate-200 px-3 py-3">
                <h3 className="text-xs font-semibold text-slate-800">Elementi</h3>
                <p className="mt-0.5 text-[10px] text-slate-500">
                  {previewPage === 'listing' ? 'Seznam in kartice' : previewPage === 'product' ? 'Stran artikla' : 'Košarica'}
                </p>
              </div>
              <nav className="max-h-[620px] overflow-y-auto p-2" data-appearance-editor-scroll-purpose="navigation">
                {Array.from(new Set(visibleCanvasElements.map((element) => element.group))).map((group) => (
                  <div key={group} className="mb-3 last:mb-0">
                    <p className="mb-1 px-2 text-[9px] font-semibold uppercase tracking-[0.1em] text-slate-400">{group}</p>
                    <div className="grid gap-0.5">
                      {visibleCanvasElements.filter((element) => element.group === group).map((element) => {
                        const elementSettings = resolveProductCanvasElementDeviceSettings(config, element.id, previewDevice);
                        const protectedElement = PRODUCT_CANVAS_PROTECTED_ELEMENT_IDS.has(element.id);
                        return (
                          <button
                            key={element.id}
                            type="button"
                            onClick={(event) => selectCanvasElement(element.id, {
                              additive: event.ctrlKey || event.metaKey,
                              label: element.label
                            })}
                            aria-pressed={selectedCanvasElementId === element.id}
                            className={`flex min-h-9 w-full items-center gap-2 rounded-lg border px-2 py-1.5 text-left transition ${adminControlFocusTokenClasses} ${
                              selectedCanvasElementId === element.id
                                ? 'border-[color:var(--blue-200)] bg-[color:var(--blue-50)] text-[color:var(--blue-800)]'
                                : 'border-transparent text-slate-600 hover:bg-slate-50'
                            }`}
                          >
                            {elementSettings.visible || protectedElement
                              ? <Eye className="h-3.5 w-3.5 shrink-0" />
                              : <EyeOff className="h-3.5 w-3.5 shrink-0 text-slate-300" />}
                            <span className="min-w-0 flex-1 truncate text-[10px] font-medium">{element.label}</span>
                            {elementSettings.locked ? <Lock className="h-3 w-3 shrink-0 text-slate-400" /> : null}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </nav>
            </aside>

            <div className="min-w-0 p-3 sm:p-5">
              <div className="mx-auto mb-3 flex max-w-[1120px] flex-wrap items-center justify-between gap-2 px-1 text-[10px] text-slate-500">
                <span>
                  {previewDeviceLabels[previewDevice]} · spremembe veljajo za ta odzivni profil
                </span>
                <span>
                  {config.canvas.showGrid ? 'Mreža vključena' : 'Mreža skrita'}
                  {' · '}
                  {config.canvas.snapToGrid ? 'pripenjanje vključeno' : 'brez pripenjanja'}
                  {' · '}
                  {config.canvas.gridSizePx} px
                </span>
              </div>

              <div
                ref={previewMotion.setStageElement}
                className="relative flex w-full items-start justify-center overflow-x-clip"
                data-testid="product-preview-stage"
              >
                <div
                  ref={setInteractivePreviewFrame}
                  className="admin-product-canvas-surface relative w-full max-w-[1120px] shrink-0 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"
                  data-testid="product-preview-frame"
                  data-show-grid={config.canvas.showGrid}
                  data-product-preview-frame
                  style={{
                    '--admin-product-canvas-grid-size': `${config.canvas.gridSizePx}px`
                  } as CSSProperties}
                >
                  {previewPage === 'product' ? (
                    previewProduct ? (
                      <ProductAppearanceLivePreview
                        config={config}
                        globalStyle={initialGlobalStyle}
                        siteLayout={initialSiteLayout}
                        product={previewProduct}
                        device={previewMotion.renderDevice}
                        motionFrameRef={previewMotion.frameRef}
                        transitioning={previewMotion.phase === 'animating'}
                        selectedElementId={selectedCanvasElementId}
                        selectedElementIds={selectedCanvasElementIds}
                        onSelectElement={selectCanvasElement}
                        onElementChange={updateCanvasElement}
                      />
                    ) : (
                      <div className="grid min-h-[520px] place-items-center p-8 text-center">
                        <div>
                          <p className="text-sm font-semibold text-slate-800">
                            {isLoadingProduct ? 'Nalaganje artikla …' : 'Izberite artikel za resničen predogled.'}
                          </p>
                          <p className="mt-1 text-[10px] text-slate-500">
                            Vsebina predogleda ni več nadomestna ali vnaprej določena.
                          </p>
                        </div>
                      </div>
                    )
                  ) : (
                    <ProductPreview
                      config={config}
                      globalStyle={initialGlobalStyle}
                      page={previewPage}
                      device={previewMotion.renderDevice}
                      product={previewProduct}
                      interactive
                      selectedElementId={selectedCanvasElementId}
                      selectedElementIds={selectedCanvasElementIds}
                      onSelectElement={selectCanvasElement}
                      onElementChange={updateCanvasElement}
                    />
                  )}
                </div>
              </div>

              <FloatingAppearanceEditorContextToolbar
                anchorId={selectedCanvasElementId}
                frameRef={interactivePreviewFrameRef}
                viewportRef={interactivePreviewViewportRef}
                ariaLabel="Orodna vrstica izbranega elementa"
                testId="product-appearance-context-toolbar"
                transitioning={previewMotion.phase === 'animating'}
                onDismiss={clearCanvasSelection}
              >
                <ProductAppearanceContextToolbar
                  selectedElementId={selectedCanvasElementId}
                  selectedElementIds={selectedCanvasElementIds}
                  selectedElementLabel={selectedCanvasElementIds.length > 1
                    ? `${selectedCanvasElementIds.length} izbranih elementov`
                    : selectedCanvasElementLabel}
                  settings={selectedCanvasSettings}
                  canRemoveSelected={selectedCanvasElementIds.some(
                    (elementId) => !PRODUCT_CANVAS_PROTECTED_ELEMENT_IDS.has(elementId)
                  )}
                  product={product}
                  previewProduct={previewProduct}
                  productOptions={productOptions}
                  gallery={config.gallery}
                  variants={config.variants}
                  purchaseArea={config.purchaseArea}
                  relatedProducts={config.relatedProducts}
                  secondaryContent={config.secondaryContent}
                  globalStyle={initialGlobalStyle}
                  previewDevice={previewDevice}
                  selectedVariantId={selectedVariantId}
                  uploading={isUploadingMedia}
                  onCanvasChange={updateSelectedCanvasElements}
                  onElementCanvasChange={updateCanvasElement}
                  onReset={() => {
                    selectedCanvasElementIds.forEach(resetCanvasElement);
                  }}
                  onRemove={removeSelectedCanvasElements}
                  onProductChange={updateProduct}
                  onGalleryChange={(updates) => updateSection('gallery', updates)}
                  onVariantsChange={(updates) => updateSection('variants', updates)}
                  onPurchaseAreaChange={(updates) => updateSection('purchaseArea', updates)}
                  onRelatedProductsChange={(updates) => updateSection('relatedProducts', updates)}
                  onSecondaryContentChange={(updates) => updateSection('secondaryContent', updates)}
                  onSelectedVariantIdChange={setSelectedVariantId}
                  onUploadImages={uploadProductImages}
                />
              </FloatingAppearanceEditorContextToolbar>
            </div>

            <ProductAppearanceLayersPanel
              items={productAppearanceLayerItems}
              selectedIds={selectedCanvasElementIds}
              className="sticky top-4 mr-3 mt-5 hidden lg:block"
              onSelect={selectCanvasElement}
              onToggleVisibility={toggleLayerVisibility}
              onToggleLock={toggleLayerLock}
              onReorder={reorderLayers}
            />

            <aside className="hidden">
              <CanvasElementInspector
                definition={selectedCanvasDefinition}
                settings={selectedCanvasSettings}
                protectedElement={selectedCanvasElementId
                  ? PRODUCT_CANVAS_PROTECTED_ELEMENT_IDS.has(selectedCanvasElementId)
                  : false}
                onChange={(updates) => {
                  if (selectedCanvasElementId) updateCanvasElement(selectedCanvasElementId, updates);
                }}
                onReset={() => {
                  if (selectedCanvasElementId) resetCanvasElement(selectedCanvasElementId);
                }}
              />
            </aside>
          </div>
        </section>
      )}
      </div>
    </StorefrontInventoryPolicyProvider>
  );
}
