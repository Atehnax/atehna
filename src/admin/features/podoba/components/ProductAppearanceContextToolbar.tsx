'use client';

import {
  ChevronDown,
  ChevronUp,
  Eye,
  EyeOff,
  ImagePlus,
  Link2,
  Lock,
  Palette,
  RotateCcw,
  SlidersHorizontal,
  Unlink2,
  Unlock,
  X
} from 'lucide-react';
import Image from 'next/image';
import { useEffect, useLayoutEffect, useRef, useState, type ChangeEvent } from 'react';
import {
  toStorefrontPlainText,
  type StorefrontProduct,
  type StorefrontSpecification
} from '@/commercial/features/products/storefrontProduct';
import { resolveCatalogueDescription } from '@/commercial/catalog/catalogContentFallbacks';
import {
  plainTextToCatalogRichText,
  sanitizeCatalogRichText
} from '@/shared/domain/catalog/richText';
import type {
  AdminCatalogListItem,
  CatalogItemEditorHydration,
  CatalogItemMediaPayload,
  CatalogVariantContentOverride,
  UploadedCatalogMediaFile
} from '@/shared/domain/catalog/catalogAdminTypes';
import {
  getStorefrontSpecificationOrderKey,
  mergeStorefrontSpecifications,
  prepareStorefrontSpecifications
} from '@/commercial/features/products/storefrontSpecifications';
import type {
  ProductAppearanceConfig,
  ProductCanvasDevice,
  ProductCanvasElementDeviceSettings,
  ProductSecondaryBlock
} from '@/shared/domain/style/productAppearance';
import {
  adminControlFocusTokenClasses,
  adminInputFocusTokenClasses
} from '@/shared/ui/theme/tokens';
import { CompactHexColorField } from '@/shared/ui/admin-controls/CompactHexColorField';
import {
  migrateCatalogSpecificationKey,
  normalizeCatalogSpecificationToken,
  readCatalogSpecificationLabels,
  writeCatalogSpecificationLabels
} from '@/shared/domain/catalog/catalogSpecification';
import {
  getProductCanvasElementResizeMinimums,
  resolveProductCanvasResize,
  type ProductCanvasResizeAxis
} from '@/shared/ui/product-canvas/ProductCanvasElement';
import {
  AppearanceEditorAlignmentControl,
  AppearanceEditorCompactSelect,
  AppearanceEditorNumberInput,
  AppearanceEditorToolbarButton,
  AppearanceEditorToolbarDivider,
  AppearanceEditorToolbarToneProvider,
  appearanceEditorToolbarPopoverSurfaceClassName,
  useAppearanceEditorToolbarPlacement
} from './AppearanceEditorToolbarPrimitives';
import ProductDescriptionRichTextEditor from './ProductDescriptionRichTextEditor';
import VariantSpecificationsEditor from '@/admin/features/artikli/components/VariantSpecificationsEditor';
import SpecificationDisplayLabelsEditor, {
  type SpecificationDisplayLabelRow
} from '@/admin/features/artikli/components/SpecificationDisplayLabelsEditor';

export type ProductAppearanceElementOption = {
  id: string;
  label: string;
  group: string;
  settings: ProductCanvasElementDeviceSettings;
  protectedElement: boolean;
};

type Panel = 'content' | 'style' | 'layers' | null;

const fieldClassName =
  `h-8 w-full rounded-lg border border-slate-200 bg-white px-2.5 text-[11px] text-slate-800 ${adminInputFocusTokenClasses}`;

function CompactContextSelect<Value extends string>({
  value,
  options,
  label,
  marker,
  testId,
  onChange
}: {
  value: Value | '';
  options: readonly { value: Value; label: string; disabled?: boolean }[];
  label: string;
  marker: string;
  testId?: string;
  onChange: (value: Value) => void;
}) {
  return (
    <AppearanceEditorCompactSelect
      value={value}
      options={options}
      ariaLabel={label}
      marker={marker}
      testId={testId}
      onValueChange={onChange}
    />
  );
}

function CanonicalNumberField({
  label,
  value,
  unit,
  testId,
  onChange,
  hideLabel = false
}: {
  label: string;
  value: number | null | undefined;
  unit: string;
  testId: string;
  onChange: (value: number | null) => void;
  hideLabel?: boolean;
}) {
  const focusedRef = useRef(false);
  const [draftValue, setDraftValue] = useState(
    value === null || value === undefined ? '' : String(value).replace('.', ',')
  );

  useEffect(() => {
    if (!focusedRef.current) {
      setDraftValue(
        value === null || value === undefined ? '' : String(value).replace('.', ',')
      );
    }
  }, [value]);

  const commit = () => {
    const normalized = draftValue.trim().replace(',', '.');
    if (!normalized) {
      onChange(null);
      return;
    }
    const parsed = Number(normalized);
    if (Number.isFinite(parsed) && parsed >= 0) {
      onChange(parsed);
      setDraftValue(String(parsed).replace('.', ','));
      return;
    }
    setDraftValue(
      value === null || value === undefined ? '' : String(value).replace('.', ',')
    );
  };

  return (
    <label className="grid gap-1">
      {hideLabel ? null : (
        <span className="text-[9px] font-medium text-slate-500">{label}</span>
      )}
      <span className="relative block">
        <input
          value={draftValue}
          inputMode="decimal"
          data-testid={testId}
          aria-label={label}
          onFocus={() => {
            focusedRef.current = true;
          }}
          onChange={(event) => setDraftValue(event.target.value)}
          onBlur={() => {
            commit();
            focusedRef.current = false;
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              commit();
              event.currentTarget.blur();
            } else if (event.key === 'Escape') {
              event.preventDefault();
              setDraftValue(
                value === null || value === undefined
                  ? ''
                  : String(value).replace('.', ',')
              );
              event.currentTarget.blur();
            }
          }}
          className={`${fieldClassName} pr-9`}
        />
        <span className="pointer-events-none absolute inset-y-0 right-2.5 flex items-center text-[9px] text-slate-400">
          {unit}
        </span>
      </span>
    </label>
  );
}

function measureSelectedCanvasElement(elementId: string | null) {
  if (!elementId || typeof document === 'undefined') return null;
  const element = Array.from(
    document.querySelectorAll<HTMLElement>('[data-product-canvas-element]')
  ).find((candidate) => (
    candidate.dataset.productCanvasElement === elementId
    && candidate.dataset.productCanvasSelected === 'true'
  ));
  if (!element) return null;
  return {
    width: Math.max(24, element.offsetWidth),
    height: Math.max(24, element.offsetHeight)
  };
}

function dimensionUpdates({
  selectedElementId,
  settings,
  axis,
  value
}: {
  selectedElementId: string | null;
  settings: ProductCanvasElementDeviceSettings;
  axis: Exclude<ProductCanvasResizeAxis, 'both'>;
  value: number;
}) {
  const resizeMinimums = getProductCanvasElementResizeMinimums(
    selectedElementId ?? ''
  );
  const constrainedValue = value <= 0
    ? value
    : Math.max(
        axis === 'width'
          ? resizeMinimums.minimumWidth
          : resizeMinimums.minimumHeight,
        value
      );
  if (!settings.aspectRatioLocked) {
    return axis === 'width'
      ? { widthPx: constrainedValue }
      : { heightPx: constrainedValue };
  }
  if (constrainedValue <= 0) return { widthPx: 0, heightPx: 0 };
  const measured = measureSelectedCanvasElement(selectedElementId);
  const startWidth = settings.widthPx > 0
    ? settings.widthPx
    : measured?.width ?? 24;
  const startHeight = settings.heightPx > 0
    ? settings.heightPx
    : measured?.height ?? 24;
  return resolveProductCanvasResize({
    startWidth,
    startHeight,
    nextWidth: axis === 'width' ? constrainedValue : startWidth,
    nextHeight: axis === 'height' ? constrainedValue : startHeight,
    axis,
    aspectRatioLocked: true,
    ...resizeMinimums
  });
}

const contentElementIds = new Set([
  'card-image',
  'card-brand',
  'card-title',
  'cart-line-image',
  'cart-line-info',
  'product-gallery',
  'product-category',
  'product-title',
  'product-badge',
  'product-sku',
  'product-short-description',
  'product-description',
  'product-key-attributes',
  'product-variants',
  'product-specifications',
  'product-specifications-content',
  'product-secondary',
  'product-related-products',
  'product-purchase',
  'product-price',
  'product-availability',
  'product-summary',
  'product-quantity',
  'product-primary-action',
  'product-delivery',
  'product-secondary-action'
]);

const isVariantContentElementId = (elementId: string) => (
  elementId === 'product-variants' || elementId.startsWith('product-variant-')
);

type PurchaseCopyKey =
  keyof ProductAppearanceConfig['purchaseArea']['copy'];

type PurchaseCopyField = {
  key: PurchaseCopyKey;
  label: string;
  multiline?: boolean;
  hint?: string;
};

const purchaseCopyGroups: Array<{
  id: string;
  title: string;
  fields: PurchaseCopyField[];
}> = [
  {
    id: 'product-price',
    title: 'Cena in DDV',
    fields: [
      { key: 'priceSelectionPrompt', label: 'Poziv pred izbiro različice', multiline: true },
      { key: 'grossPriceLabel', label: 'Oznaka bruto cene' },
      { key: 'netPriceLabel', label: 'Oznaka neto cene' },
      { key: 'taxLabel', label: 'Oznaka davka' },
      { key: 'savingsLabel', label: 'Oznaka prihranka' }
    ]
  },
  {
    id: 'product-availability',
    title: 'Razpoložljivost',
    fields: [
      { key: 'selectVariantLabel', label: 'Naslov · izbira ni dokončana' },
      { key: 'selectVariantDetail', label: 'Pojasnilo · izbira ni dokončana', multiline: true },
      { key: 'inactiveVariantLabel', label: 'Naslov · neaktivna različica' },
      { key: 'inactiveVariantDetail', label: 'Pojasnilo · neaktivna različica', multiline: true },
      { key: 'outOfStockLabel', label: 'Naslov · zaloga 0' },
      { key: 'outOfStockDetail', label: 'Pojasnilo · zaloga 0', multiline: true },
      { key: 'insufficientStockLabel', label: 'Naslov · premalo zaloge' },
      {
        key: 'insufficientStockDetail',
        label: 'Pojasnilo · premalo zaloge',
        multiline: true,
        hint: 'Uporabite {stock}, {minimum} in {unit}.'
      },
      { key: 'inStockLabel', label: 'Naslov · na zalogi' },
      {
        key: 'inStockDetail',
        label: 'Pojasnilo · na zalogi',
        multiline: true,
        hint: 'Uporabite {stock} in {unit}.'
      },
      { key: 'confirmationAvailabilityLabel', label: 'Naslov · po potrditvi' },
      {
        key: 'confirmationAvailabilityDetail',
        label: 'Pojasnilo · po potrditvi',
        multiline: true
      }
    ]
  },
  {
    id: 'product-summary',
    title: 'Povzetek različice',
    fields: [
      { key: 'variantLabel', label: 'Različica' },
      { key: 'skuLabel', label: 'SKU' },
      { key: 'minimumOrderLabel', label: 'Najmanjše naročilo' }
    ]
  },
  {
    id: 'product-quantity',
    title: 'Količina',
    fields: [
      { key: 'quantityLabel', label: 'Naslov polja' },
      { key: 'decreaseQuantityLabel', label: 'Dostopno ime · zmanjšaj' },
      { key: 'increaseQuantityLabel', label: 'Dostopno ime · povečaj' }
    ]
  },
  {
    id: 'product-primary-action',
    title: 'Primarno dejanje',
    fields: [
      { key: 'selectOptionsActionLabel', label: 'Izbira ni dokončana' },
      { key: 'addToCartActionLabel', label: 'Na voljo za nakup' },
      { key: 'unavailableActionLabel', label: 'Ni na voljo za nakup' }
    ]
  },
  {
    id: 'product-delivery',
    title: 'Dostava in plačilo',
    fields: [
      { key: 'deliveryFallbackMessage', label: 'Nadomestni dobavni rok', multiline: true },
      { key: 'paymentMessage', label: 'Način plačila', multiline: true }
    ]
  },
  {
    id: 'product-secondary-action',
    title: 'Sekundarno dejanje',
    fields: [
      { key: 'secondaryActionLabel', label: 'Besedilo gumba' }
    ]
  }
];

const editableSecondaryBlocks: ProductSecondaryBlock[] = [
  'description',
  'specifications',
  'documents',
  'includedItems'
];

const secondaryBlockDescriptions: Record<ProductSecondaryBlock, string> = {
  description: 'Opis artikla',
  specifications: 'Tehnične specifikacije',
  documents: 'Dokumenti, kot je tehnični list',
  includedItems: 'Vsebina paketa',
  relatedProducts: 'Sorodni artikli'
};

function SecondaryDividerControls({
  secondaryContent,
  onChange
}: {
  secondaryContent: ProductAppearanceConfig['secondaryContent'];
  onChange: (
    updates: Partial<ProductAppearanceConfig['secondaryContent']>
  ) => void;
}) {
  const visibilityControls = [
    ['showTabDivider', 'Črta pod zavihki'],
    ['showContentDivider', 'Med opisom in specifikacijami'],
    ['showSpecificationColumnDivider', 'Med skupinama specifikacij'],
    ['showSpecificationRowDividers', 'Med vrsticami specifikacij']
  ] as const;

  const updateNumber = (
    key: 'dividerThicknessPx' | 'descriptionColumnPercent' | 'specificationFirstColumnPercent',
    rawValue: string | number,
    minimum: number,
    maximum: number
  ) => {
    const value = Number(rawValue);
    if (!Number.isFinite(value)) return;
    onChange({ [key]: Math.min(maximum, Math.max(minimum, value)) });
  };

  return (
    <fieldset
      data-testid="product-secondary-divider-controls"
      className="grid gap-2.5 rounded-lg border border-white/15 bg-white/5 p-2.5"
    >
      <legend className="px-1 text-[10px] font-semibold text-white">
        Ločnice vsebine
      </legend>
      <p className="text-[9px] leading-4 text-white/60">
        Položaja določata razmerje stolpcev na namizju; na manjših zaslonih se
        vsebina še vedno zloži v en stolpec.
      </p>
      <div className="grid gap-1.5 sm:grid-cols-2">
        {visibilityControls.map(([key, label]) => (
          <label
            key={key}
            className="flex min-h-8 cursor-pointer items-center gap-2 rounded-md border border-white/10 bg-black/10 px-2 py-1.5"
          >
            <input
              type="checkbox"
              data-testid={`product-secondary-divider-${key}`}
              checked={secondaryContent[key]}
              onChange={(event) => onChange({ [key]: event.target.checked })}
              className="h-3.5 w-3.5 accent-[color:var(--blue-500)]"
            />
            <span className="text-[9px] leading-3 text-white/75">{label}</span>
          </label>
        ))}
      </div>
      <label className="grid gap-1">
        <span className="text-[9px] font-medium text-white/70">
          Debelina ločnic
        </span>
        <div className="flex overflow-hidden rounded-lg border border-slate-200 bg-white">
          <AppearanceEditorNumberInput
            data-testid="product-secondary-divider-thickness"
            min={0.5}
            max={4}
            step={0.5}
            value={secondaryContent.dividerThicknessPx}
            onValueChange={(value) => updateNumber(
              'dividerThicknessPx',
              value,
              0.5,
              4
            )}
            className="h-8 min-w-0 flex-1 bg-transparent px-2.5 text-[11px] text-slate-800 outline-none"
          />
          <span className="grid place-items-center border-l border-slate-200 px-2 text-[10px] text-slate-500">
            px
          </span>
        </div>
      </label>
      {([
        ['descriptionColumnPercent', 'Položaj med opisom in specifikacijami', 30, 65],
        ['specificationFirstColumnPercent', 'Položaj med skupinama specifikacij', 35, 65]
      ] as const).map(([key, label, minimum, maximum]) => (
        <div key={key} className="grid gap-1">
          <span className="flex items-center justify-between gap-2 text-[9px] font-medium text-white/70">
            <span>{label}</span>
            <span>{secondaryContent[key]} %</span>
          </span>
          <div className="grid grid-cols-[minmax(0,1fr)_68px] items-center gap-2">
            <input
              type="range"
              aria-label={label}
              data-testid={`product-secondary-divider-position-${key}`}
              min={minimum}
              max={maximum}
              step={1}
              value={secondaryContent[key]}
              onChange={(event) => updateNumber(
                key,
                event.target.value,
                minimum,
                maximum
              )}
              className="h-5 w-full accent-[color:var(--blue-500)]"
            />
            <span className="flex overflow-hidden rounded-md border border-slate-200 bg-white">
              <AppearanceEditorNumberInput
                aria-label={`${label} v odstotkih`}
                min={minimum}
                max={maximum}
                step={1}
                value={secondaryContent[key]}
                onValueChange={(value) => updateNumber(
                  key,
                  value,
                  minimum,
                  maximum
                )}
                className="h-7 min-w-0 flex-1 bg-transparent px-1.5 text-[10px] text-slate-800 outline-none"
              />
              <span className="grid place-items-center border-l border-slate-200 px-1.5 text-[9px] text-slate-500">
                %
              </span>
            </span>
          </div>
        </div>
      ))}
    </fieldset>
  );
}

function nextPosition(media: CatalogItemMediaPayload[]) {
  return media.reduce((maximum, item) => Math.max(maximum, item.position ?? 0), -1) + 1;
}

function ContentPanel({
  selectedElementId,
  product,
  previewProduct,
  productOptions,
  gallery,
  variants,
  purchaseArea,
  relatedProducts,
  secondaryContent,
  defaultFontSizePx,
  previewDevice,
  selectedVariantId,
  uploading,
  onProductChange,
  onGalleryChange,
  onVariantsChange,
  onPurchaseAreaChange,
  onRelatedProductsChange,
  onSecondaryContentChange,
  onSelectedVariantIdChange,
  onUploadImages
}: {
  selectedElementId: string;
  product: CatalogItemEditorHydration;
  previewProduct: StorefrontProduct | null;
  productOptions: AdminCatalogListItem[];
  gallery: ProductAppearanceConfig['gallery'];
  variants: ProductAppearanceConfig['variants'];
  purchaseArea: ProductAppearanceConfig['purchaseArea'];
  relatedProducts: ProductAppearanceConfig['relatedProducts'];
  secondaryContent: ProductAppearanceConfig['secondaryContent'];
  defaultFontSizePx: number;
  previewDevice: ProductCanvasDevice;
  selectedVariantId: number | null;
  uploading: boolean;
  onProductChange: (updates: Partial<CatalogItemEditorHydration>) => void;
  onGalleryChange: (updates: Partial<ProductAppearanceConfig['gallery']>) => void;
  onVariantsChange: (
    updates: Partial<ProductAppearanceConfig['variants']>
  ) => void;
  onPurchaseAreaChange: (
    updates: Partial<ProductAppearanceConfig['purchaseArea']>
  ) => void;
  onRelatedProductsChange: (
    updates: Partial<ProductAppearanceConfig['relatedProducts']>
  ) => void;
  onSecondaryContentChange: (
    updates: Partial<ProductAppearanceConfig['secondaryContent']>
  ) => void;
  onSelectedVariantIdChange: (variantId: number | null) => void;
  onUploadImages: (files: File[]) => Promise<void>;
}) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [relatedSearch, setRelatedSearch] = useState('');
  const selectedVariant = product.variants.find((variant) => variant.id === selectedVariantId)
    ?? product.variants[0]
    ?? null;
  const selectedSpecifications = selectedVariant?.contentOverride?.specifications ?? {};
  const specificationLabels = readCatalogSpecificationLabels(product.appearanceOverride);
  const previewVariant = previewProduct?.variants.find(
    (variant) => variant.commerceId === selectedVariant?.id
  ) ?? previewProduct?.variants.find(
    (variant) => variant.id === previewProduct.defaultVariantId
  ) ?? previewProduct?.variants[0] ?? null;
  const mergedSpecifications = mergeStorefrontSpecifications(
    previewProduct?.specifications ?? [],
    previewVariant?.specifications ?? [],
    previewVariant?.sku
      ? [{
          id: `variant-${previewVariant.id}-sku`,
          label: 'SKU',
          value: previewVariant.sku,
          orderKey: 'sku'
        } satisfies StorefrontSpecification]
      : []
  );
  const canonicalDisplayedSpecifications = prepareStorefrontSpecifications(
    mergedSpecifications,
    secondaryContent.specificationOrder
  );
  const canonicalSpecificationLabels = new Map(
    canonicalDisplayedSpecifications.map((specification) => [
      getStorefrontSpecificationOrderKey(specification),
      specification.label
    ])
  );
  const displayedSpecifications = prepareStorefrontSpecifications(
    mergedSpecifications,
    secondaryContent.specificationOrder,
    specificationLabels
  );
  const customSpecificationKeys = new Set(
    Object.keys(selectedSpecifications).map(normalizeCatalogSpecificationToken)
  );
  const systemSpecificationRows: SpecificationDisplayLabelRow[] = displayedSpecifications
    .filter((specification) => (
      !customSpecificationKeys.has(getStorefrontSpecificationOrderKey(specification))
    ))
    .map((specification) => ({
      key: getStorefrontSpecificationOrderKey(specification),
      label: specification.label,
      canonicalLabel: canonicalSpecificationLabels.get(
        getStorefrontSpecificationOrderKey(specification)
      ) ?? specification.label,
      value: specification.value
    }));

  function updateMedia(index: number, updates: Partial<CatalogItemMediaPayload>) {
    onProductChange({
      media: product.media.map((media, mediaIndex) => (
        mediaIndex === index ? { ...media, ...updates } : media
      ))
    });
  }

  function removeMedia(index: number) {
    onProductChange({ media: product.media.filter((_, mediaIndex) => mediaIndex !== index) });
  }

  function updateSelectedVariant(
    updates: Partial<CatalogItemEditorHydration['variants'][number]>
  ) {
    if (!selectedVariant) return;
    onProductChange({
      variants: product.variants.map((variant) => (
        variant === selectedVariant ? { ...variant, ...updates } : variant
      ))
    });
  }

  function updateVariantSpecifications(specifications: Record<string, string>) {
    if (!selectedVariant) return;
    const contentOverride: CatalogVariantContentOverride = {
      ...(selectedVariant.contentOverride ?? {}),
      specifications
    };
    if (Object.keys(specifications).length === 0) {
      delete contentOverride.specifications;
    }
    updateSelectedVariant({
      contentOverride: Object.keys(contentOverride).length > 0
        ? contentOverride
        : null
    });
  }

  function updateSpecificationLabels(labels: Record<string, string>) {
    onProductChange({
      appearanceOverride: writeCatalogSpecificationLabels(
        product.appearanceOverride,
        labels
      )
    });
  }

  function renderSystemSpecificationValueEditor(
    row: SpecificationDisplayLabelRow
  ) {
    if (row.key === 'material' || row.key === 'barva' || row.key === 'oblika') {
      const productKey = row.key === 'barva'
        ? 'colour'
        : row.key === 'oblika'
          ? 'shape'
          : 'material';
      return (
        <input
          value={product[productKey] ?? ''}
          data-testid={`canonical-specification-${row.key}`}
          aria-label={`Vrednost specifikacije ${row.label}`}
          onChange={(event) => onProductChange({ [productKey]: event.target.value })}
          className={fieldClassName}
        />
      );
    }
    if (row.key === 'dimensions') {
      return (
        <div className="grid grid-cols-3 gap-1.5">
          <CanonicalNumberField
            label="Debelina"
            value={selectedVariant?.thickness}
            unit="mm"
            testId="canonical-specification-thickness"
            onChange={(thickness) => updateSelectedVariant({ thickness })}
            hideLabel
          />
          <CanonicalNumberField
            label="Dolžina"
            value={selectedVariant?.length}
            unit="mm"
            testId="canonical-specification-length"
            onChange={(length) => updateSelectedVariant({ length })}
            hideLabel
          />
          <CanonicalNumberField
            label="Širina"
            value={selectedVariant?.width}
            unit="mm"
            testId="canonical-specification-width"
            onChange={(width) => updateSelectedVariant({ width })}
            hideLabel
          />
        </div>
      );
    }
    if (row.key === 'teza') {
      return (
        <CanonicalNumberField
          label="Teža"
          value={selectedVariant?.weight}
          unit={product.productType === 'dimensions' ? 'g' : 'kg'}
          testId="canonical-specification-weight"
          onChange={(weight) => updateSelectedVariant({ weight })}
          hideLabel
        />
      );
    }
    if (row.key === 'toleranca') {
      return (
        <input
          value={selectedVariant?.errorTolerance ?? ''}
          data-testid="canonical-specification-tolerance"
          aria-label="Vrednost specifikacije Toleranca"
          onChange={(event) => updateSelectedVariant({
            errorTolerance: event.target.value || null
          })}
          className={fieldClassName}
        />
      );
    }
    if (row.key === 'sku') {
      return (
        <input
          value={selectedVariant?.variantSku ?? ''}
          data-testid="canonical-specification-sku"
          aria-label="Vrednost specifikacije SKU"
          onChange={(event) => updateSelectedVariant({
            variantSku: event.target.value || null
          })}
          className={fieldClassName}
        />
      );
    }
    return undefined;
  }

  function moveDisplayedSpecification(index: number, direction: -1 | 1) {
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= displayedSpecifications.length) return;
    const visibleKeys = displayedSpecifications.map(
      getStorefrontSpecificationOrderKey
    );
    [visibleKeys[index], visibleKeys[targetIndex]] = [
      visibleKeys[targetIndex],
      visibleKeys[index]
    ];
    const visibleKeySet = new Set(visibleKeys);
    onSecondaryContentChange({
      specificationOrder: [
        ...visibleKeys,
        ...secondaryContent.specificationOrder.filter(
          (key) => !visibleKeySet.has(key)
        )
      ]
    });
  }

  if (selectedElementId === 'product-related-products') {
    const override = product.appearanceOverride ?? {};
    const relatedOverride =
      typeof override.relatedProducts === 'object'
      && override.relatedProducts !== null
      && !Array.isArray(override.relatedProducts)
        ? override.relatedProducts as Record<string, unknown>
        : {};
    const manualProductSlugs = Array.isArray(relatedOverride.manualProductSlugs)
      ? relatedOverride.manualProductSlugs.filter(
          (value): value is string => typeof value === 'string'
        )
      : [];
    const normalizedSearch = relatedSearch.trim().toLocaleLowerCase('sl');
    const availableProducts = productOptions.filter((item) => (
      item.slug !== product.slug
      && item.status === 'active'
      && (
        !normalizedSearch
        || item.itemName.toLocaleLowerCase('sl').includes(normalizedSearch)
        || item.categoryLabel.toLocaleLowerCase('sl').includes(normalizedSearch)
      )
    ));
    const updateManualProducts = (nextSlugs: string[]) => {
      onProductChange({
        appearanceOverride: {
          ...override,
          relatedProducts: {
            ...relatedOverride,
            manualProductSlugs: nextSlugs
          }
        }
      });
    };
    const toggleManualProduct = (slug: string) => {
      updateManualProducts(
        manualProductSlugs.includes(slug)
          ? manualProductSlugs.filter((entry) => entry !== slug)
          : [...manualProductSlugs, slug]
      );
    };

    return (
      <div className="grid gap-3" data-testid="product-related-products-controls">
        <div className="rounded-lg border border-white/15 bg-white/5 px-3 py-2">
          <p className="text-[10px] font-semibold text-white">
            Sorodni izdelki
          </p>
          <p className="mt-1 text-[9px] leading-4 text-white/65">
            Samodejna pravila veljajo za vse artikle. Ročno izbrane izdelke
            shranimo samo pri trenutno izbranem artiklu.
          </p>
        </div>

        <label className="flex items-center justify-between gap-3 rounded-lg border border-white/15 bg-white/5 px-3 py-2">
          <span className="text-[9px] font-semibold text-white/75">Prikaži sklop</span>
          <input
            type="checkbox"
            checked={relatedProducts.enabled}
            onChange={(event) => onRelatedProductsChange({ enabled: event.target.checked })}
            className="h-4 w-4 accent-[color:var(--blue-500)]"
          />
        </label>

        <label className="grid gap-1">
          <span className="text-[9px] font-medium text-white/70">Naslov sklopa</span>
          <input
            value={secondaryContent.sectionLabels.relatedProducts}
            maxLength={120}
            onChange={(event) => onSecondaryContentChange({
              sectionLabels: {
                ...secondaryContent.sectionLabels,
                relatedProducts: event.target.value
              }
            })}
            className={fieldClassName}
          />
        </label>

        <div className="grid grid-cols-2 gap-2">
          <div className="grid gap-1">
            <span className="text-[9px] font-medium text-white/70">Samodejni izbor</span>
            <CompactContextSelect
              value={relatedProducts.sourceMode}
              options={[
                { value: 'same-category', label: 'Ista kategorija' },
                { value: 'same-subcategory', label: 'Ista podkategorija' },
                { value: 'manual-only', label: 'Samo ročno' }
              ]}
              label="Samodejni izbor"
              marker="related-source-mode"
              onChange={(sourceMode) => onRelatedProductsChange({ sourceMode })}
            />
          </div>
          <div className="grid gap-1">
            <span className="text-[9px] font-medium text-white/70">Ročni izbor</span>
            <CompactContextSelect
              value={relatedProducts.manualPlacement}
              options={[
                { value: 'before-auto', label: 'Pred samodejnimi' },
                { value: 'after-auto', label: 'Za samodejnimi' }
              ]}
              label="Ročni izbor"
              marker="related-manual-placement"
              onChange={(manualPlacement) => onRelatedProductsChange({ manualPlacement })}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <label className="grid gap-1">
            <span className="text-[9px] font-medium text-white/70">Največ izdelkov</span>
            <AppearanceEditorNumberInput
              min={1}
              max={12}
              value={relatedProducts.maxItems}
              onValueChange={(value) => onRelatedProductsChange({
                maxItems: value
              })}
              className={fieldClassName}
            />
          </label>
          <label className="grid gap-1">
            <span className="text-[9px] font-medium text-white/70">Razmik kartic</span>
            <div className="flex overflow-hidden rounded-lg border border-slate-200 bg-white">
              <AppearanceEditorNumberInput
                min={8}
                max={64}
                value={relatedProducts.gapPx}
                onValueChange={(value) => onRelatedProductsChange({
                  gapPx: value
                })}
                className="h-8 min-w-0 flex-1 bg-transparent px-2.5 text-[11px] text-slate-800 outline-none"
              />
              <span className="grid place-items-center border-l border-slate-200 px-2 text-[10px] text-slate-500">px</span>
            </div>
          </label>
        </div>

        <div className="grid grid-cols-3 gap-2">
          {([
            ['desktopColumns', 'Desktop', 6],
            ['tabletColumns', 'Tablica', 4],
            ['mobileColumns', 'Mobilno', 2]
          ] as const).map(([key, label, maximum]) => (
            <label key={key} className="grid gap-1">
              <span className="text-[9px] font-medium text-white/70">{label}</span>
              <AppearanceEditorNumberInput
                min={1}
                max={maximum}
                value={relatedProducts[key]}
                onValueChange={(value) => onRelatedProductsChange({
                  [key]: value
                })}
                className={fieldClassName}
              />
            </label>
          ))}
        </div>

        <div className="grid grid-cols-3 gap-2">
          <label className="grid gap-1">
            <span className="text-[9px] font-medium text-white/70">Širina kartice</span>
            <div className="flex overflow-hidden rounded-lg border border-slate-200 bg-white">
              <AppearanceEditorNumberInput
                min={160}
                max={520}
                value={relatedProducts.cardWidthPx}
                onValueChange={(value) => onRelatedProductsChange({
                  cardWidthPx: value
                })}
                className="h-8 min-w-0 flex-1 bg-transparent px-2 text-[10px] text-slate-800 outline-none"
              />
              <span className="grid place-items-center border-l border-slate-200 px-1.5 text-[9px] text-slate-500">px</span>
            </div>
          </label>
          <label className="grid gap-1">
            <span className="text-[9px] font-medium text-white/70">Višina slike</span>
            <div className="flex overflow-hidden rounded-lg border border-slate-200 bg-white">
              <AppearanceEditorNumberInput
                min={96}
                max={480}
                value={relatedProducts.imageHeightPx}
                onValueChange={(value) => onRelatedProductsChange({
                  imageHeightPx: value
                })}
                className="h-8 min-w-0 flex-1 bg-transparent px-2 text-[10px] text-slate-800 outline-none"
              />
              <span className="grid place-items-center border-l border-slate-200 px-1.5 text-[9px] text-slate-500">px</span>
            </div>
          </label>
          <label className="grid gap-1">
            <span className="text-[9px] font-medium text-white/70">Besedilo</span>
            <div className="flex overflow-hidden rounded-lg border border-slate-200 bg-white">
              <AppearanceEditorNumberInput
                min={70}
                max={140}
                value={relatedProducts.textScalePercent}
                onValueChange={(value) => onRelatedProductsChange({
                  textScalePercent: value
                })}
                className="h-8 min-w-0 flex-1 bg-transparent px-2 text-[10px] text-slate-800 outline-none"
              />
              <span className="grid place-items-center border-l border-slate-200 px-1.5 text-[9px] text-slate-500">%</span>
            </div>
          </label>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div className="grid gap-1">
            <span className="text-[9px] font-medium text-white/70">Položaj sklopa</span>
            <CompactContextSelect
              value={relatedProducts.sectionPlacement}
              options={[
                { value: 'before-content', label: 'Pred opisom' },
                { value: 'after-content', label: 'Za opisom' }
              ]}
              label="Položaj sklopa"
              marker="related-section-placement"
              onChange={(sectionPlacement) => onRelatedProductsChange({ sectionPlacement })}
            />
          </div>
          <div className="grid gap-1">
            <span className="text-[9px] font-medium text-white/70">Poravnava</span>
            <AppearanceEditorAlignmentControl
              value={relatedProducts.sectionAlignment}
              options={['left', 'center', 'right'] as const}
              className="w-full"
              ariaLabel="Poravnava sklopa povezanih izdelkov"
              onValueChange={(sectionAlignment) => onRelatedProductsChange({ sectionAlignment })}
            />
          </div>
        </div>

        <label className="grid gap-1">
          <span className="text-[9px] font-medium text-white/70">Širina sklopa</span>
          <div className="flex overflow-hidden rounded-lg border border-slate-200 bg-white">
            <AppearanceEditorNumberInput
              min={25}
              max={100}
              value={relatedProducts.sectionWidthPercent}
              onValueChange={(value) => onRelatedProductsChange({
                sectionWidthPercent: value
              })}
              className="h-8 min-w-0 flex-1 bg-transparent px-2.5 text-[11px] text-slate-800 outline-none"
            />
            <span className="grid place-items-center border-l border-slate-200 px-2 text-[10px] text-slate-500">%</span>
          </div>
        </label>

        <div className="grid gap-2 border-t border-white/15 pt-3">
          <div>
            <p className="text-[10px] font-semibold text-white">Ročno dodani izdelki</p>
            <p className="mt-0.5 text-[9px] text-white/55">
              Izbrano: {manualProductSlugs.length}
            </p>
          </div>
          <input
            type="search"
            data-testid="product-related-products-search"
            value={relatedSearch}
            placeholder="Poišči po nazivu ali kategoriji …"
            onChange={(event) => setRelatedSearch(event.target.value)}
            className={fieldClassName}
          />
          <div className="max-h-52 overflow-y-auto rounded-lg border border-white/15" data-appearance-editor-scroll-purpose="data">
            {availableProducts.length > 0 ? availableProducts.map((item) => (
              <label
                key={item.slug}
                className="flex cursor-pointer items-start gap-2 border-b border-white/10 px-2.5 py-2 last:border-b-0 hover:bg-white/5"
              >
                <input
                  type="checkbox"
                  checked={manualProductSlugs.includes(item.slug)}
                  onChange={() => toggleManualProduct(item.slug)}
                  className="mt-0.5 h-3.5 w-3.5 accent-[color:var(--blue-500)]"
                />
                <span className="min-w-0">
                  <span className="block truncate text-[10px] font-semibold text-white">
                    {item.itemName}
                  </span>
                  <span className="block truncate text-[9px] text-white/55">
                    {item.categoryLabel}
                  </span>
                </span>
              </label>
            )) : (
              <p className="px-3 py-4 text-center text-[9px] text-white/55">
                Ni zadetkov.
              </p>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (selectedElementId === 'product-secondary') {
    const orderedBlocks = [
      ...secondaryContent.blockOrder.filter((block) =>
        editableSecondaryBlocks.includes(block)
      ),
      ...editableSecondaryBlocks.filter(
        (block) => !secondaryContent.blockOrder.includes(block)
      )
    ];

    const toggleBlock = (block: ProductSecondaryBlock) => {
      if (secondaryContent.blockOrder.includes(block)) {
        const nextOrder = secondaryContent.blockOrder.filter(
          (entry) => entry !== block
        );
        if (nextOrder.length === 0) return;
        onSecondaryContentChange({
          blockOrder: nextOrder,
          openByDefault: secondaryContent.openByDefault.filter(
            (entry) => entry !== block
          )
        });
        return;
      }

      const relatedIndex = secondaryContent.blockOrder.indexOf('relatedProducts');
      const nextOrder = [...secondaryContent.blockOrder];
      nextOrder.splice(
        relatedIndex >= 0 ? relatedIndex : nextOrder.length,
        0,
        block
      );
      onSecondaryContentChange({ blockOrder: nextOrder });
    };

    const moveBlock = (block: ProductSecondaryBlock, direction: -1 | 1) => {
      const currentOrder = secondaryContent.blockOrder;
      const currentIndex = currentOrder.indexOf(block);
      if (currentIndex < 0) return;

      let targetIndex = currentIndex + direction;
      while (
        targetIndex >= 0
        && targetIndex < currentOrder.length
        && currentOrder[targetIndex] === 'relatedProducts'
      ) {
        targetIndex += direction;
      }
      if (targetIndex < 0 || targetIndex >= currentOrder.length) return;

      const nextOrder = [...currentOrder];
      [nextOrder[currentIndex], nextOrder[targetIndex]] = [
        nextOrder[targetIndex],
        nextOrder[currentIndex]
      ];
      onSecondaryContentChange({ blockOrder: nextOrder });
    };

    return (
      <div className="grid gap-3">
        <div className="rounded-lg border border-white/15 bg-white/5 px-3 py-2">
          <p className="text-[10px] font-semibold text-white">
            Zavihki in vsebinski sklopi · velja za vse artikle
          </p>
          <p className="mt-1 text-[9px] leading-4 text-white/65">
            Opis in specifikacije sta v zloženem prikazu združena pod enim
            zavihkom. Dodatni zavihki se pokažejo samo, ko ima izbrani artikel
            ustrezno vsebino.
          </p>
        </div>

        <SecondaryDividerControls
          secondaryContent={secondaryContent}
          onChange={onSecondaryContentChange}
        />

        <label className="grid gap-1">
          <span className="text-[9px] font-medium text-white/70">
            Skupni naslov opisa in specifikacij
          </span>
          <input
            data-testid="product-secondary-combined-label"
            value={secondaryContent.combinedOverviewLabel}
            maxLength={120}
            onChange={(event) => onSecondaryContentChange({
              combinedOverviewLabel: event.target.value
            })}
            className={fieldClassName}
          />
        </label>

        <div className="grid gap-1.5">
          {orderedBlocks.map((block) => {
            const visible = secondaryContent.blockOrder.includes(block);
            const currentIndex = secondaryContent.blockOrder.indexOf(block);
            return (
              <div
                key={block}
                className="grid grid-cols-[minmax(0,1fr)_auto] gap-2 rounded-lg border border-white/15 bg-white/5 p-2"
              >
                <label className="grid min-w-0 gap-1">
                  <span className="text-[9px] font-medium text-white/70">
                    {secondaryBlockDescriptions[block]}
                  </span>
                  <input
                    data-testid={`product-secondary-label-${block}`}
                    value={secondaryContent.sectionLabels[block]}
                    maxLength={120}
                    onChange={(event) => onSecondaryContentChange({
                      sectionLabels: {
                        ...secondaryContent.sectionLabels,
                        [block]: event.target.value
                      }
                    })}
                    className={fieldClassName}
                  />
                </label>
                <div className="flex items-end gap-1">
                  {visible ? (
                    <>
                      <button
                        type="button"
                        aria-label={`Premakni ${secondaryContent.sectionLabels[block]} gor`}
                        disabled={currentIndex <= 0}
                        onClick={() => moveBlock(block, -1)}
                        className={`grid h-8 w-8 place-items-center rounded-lg border border-white/15 text-xs text-white/75 hover:bg-white/10 disabled:opacity-30 ${adminControlFocusTokenClasses}`}
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        aria-label={`Premakni ${secondaryContent.sectionLabels[block]} dol`}
                        disabled={
                          currentIndex < 0
                          || currentIndex >= secondaryContent.blockOrder.length - 1
                          || secondaryContent.blockOrder[currentIndex + 1] === 'relatedProducts'
                        }
                        onClick={() => moveBlock(block, 1)}
                        className={`grid h-8 w-8 place-items-center rounded-lg border border-white/15 text-xs text-white/75 hover:bg-white/10 disabled:opacity-30 ${adminControlFocusTokenClasses}`}
                      >
                        ↓
                      </button>
                    </>
                  ) : null}
                  <button
                    type="button"
                    data-testid={`product-secondary-toggle-${block}`}
                    onClick={() => toggleBlock(block)}
                    className={`h-8 rounded-lg border px-2 text-[9px] font-semibold ${adminControlFocusTokenClasses} ${
                      visible
                        ? 'border-red-300/30 text-red-200 hover:bg-red-400/10'
                        : 'border-white/20 text-white hover:bg-white/10'
                    }`}
                  >
                    {visible ? 'Odstrani' : 'Dodaj zavihek'}
                  </button>
                </div>
                {block === 'documents' ? (
                  <p className="col-span-2 text-[9px] leading-3 text-white/55">
                    Zavihek se prikaže, ko je v Artikli naložen dokument.
                  </p>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  if (
    selectedElementId === 'product-purchase'
    || purchaseCopyGroups.some((group) => group.id === selectedElementId)
  ) {
    const groups = selectedElementId === 'product-purchase'
      ? purchaseCopyGroups
      : purchaseCopyGroups.filter((group) => group.id === selectedElementId);
    const updateCopy = (key: PurchaseCopyKey, value: string) => {
      onPurchaseAreaChange({
        copy: {
          ...purchaseArea.copy,
          [key]: value
        }
      });
    };

    return (
      <div className="grid gap-3">
        <div className="rounded-lg border border-white/15 bg-white/5 px-3 py-2">
          <p className="text-[10px] font-semibold text-white">
            Besedilo velja za vse artikle
          </p>
          <p className="mt-1 text-[9px] leading-4 text-white/65">
            Cene, DDV, zaloga, SKU, količine in dejanski dobavni rok ostanejo
            povezani z Artikli. Tukaj urejate samo oznake in pojasnila.
          </p>
        </div>

        {groups.map((group) => (
          <fieldset
            key={group.id}
            className="grid gap-2 rounded-lg border border-white/15 bg-white/5 p-2.5"
          >
            <legend className="px-1 text-[10px] font-semibold text-white">
              {group.title}
            </legend>
            <div className="grid gap-2 sm:grid-cols-2">
              {group.fields.map((field) => (
                <label
                  key={field.key}
                  className={`grid gap-1 ${
                    field.multiline ? 'sm:col-span-2' : ''
                  }`}
                >
                  <span className="text-[9px] font-medium text-white/70">
                    {field.label}
                  </span>
                  {field.multiline ? (
                    <textarea
                      data-testid={`product-purchase-copy-${field.key}`}
                      value={purchaseArea.copy[field.key]}
                      maxLength={320}
                      rows={2}
                      onChange={(event) => updateCopy(field.key, event.target.value)}
                      className={`min-h-14 resize-y rounded-lg border border-white/15 bg-white/10 px-2.5 py-2 text-[11px] leading-4 text-white ${adminInputFocusTokenClasses}`}
                    />
                  ) : (
                    <input
                      data-testid={`product-purchase-copy-${field.key}`}
                      value={purchaseArea.copy[field.key]}
                      maxLength={120}
                      onChange={(event) => updateCopy(field.key, event.target.value)}
                      className={fieldClassName}
                    />
                  )}
                  {field.hint ? (
                    <span className="text-[9px] leading-3 text-white/55">
                      {field.hint}
                    </span>
                  ) : null}
                </label>
              ))}
            </div>
          </fieldset>
        ))}
      </div>
    );
  }

  if (
    selectedElementId === 'product-gallery'
    || selectedElementId === 'card-image'
    || selectedElementId === 'cart-line-image'
  ) {
    const images = product.media
      .map((media, index) => ({ media, index }))
      .filter(({ media }) => media.mediaKind === 'image' && media.role === 'gallery');
    const thumbnailPosition = previewDevice === 'desktop'
      ? gallery.thumbnailPositionDesktop
      : gallery.thumbnailPositionMobile;
    return (
      <div className="grid gap-3">
        {selectedElementId === 'product-gallery' ? (
          <div className="grid gap-2 rounded-lg border border-slate-200 bg-slate-50 p-2.5">
            <div>
              <p className="text-xs font-semibold text-slate-900">Postavitev sličic</p>
              <p className="mt-0.5 text-[10px] text-slate-500">
                {previewDevice === 'desktop'
                  ? 'Nastavitev velja za namizni prikaz.'
                  : previewDevice === 'tablet'
                    ? 'Tablični prikaz uporablja mobilno nastavitev.'
                    : 'Nastavitev velja za mobilni prikaz.'}
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              <div className="col-span-2 grid gap-1 sm:col-span-1">
                <span className="text-[9px] font-medium text-slate-500">Položaj</span>
                <CompactContextSelect
                  value={thumbnailPosition}
                  options={[
                    { value: 'left', label: 'Levo · navpično' },
                    { value: 'right', label: 'Desno · navpično' },
                    { value: 'top', label: 'Zgoraj · vodoravno' },
                    { value: 'bottom', label: 'Spodaj · vodoravno' },
                    { value: 'hidden', label: 'Skrito' }
                  ]}
                  label="Položaj sličic"
                  marker="gallery-thumbnail-position"
                  testId="product-gallery-thumbnail-position"
                  onChange={(position) => {
                    onGalleryChange(
                      previewDevice === 'desktop'
                        ? { thumbnailPositionDesktop: position }
                        : { thumbnailPositionMobile: position }
                    );
                  }}
                />
              </div>
              <label className="grid gap-1">
                <span className="text-[9px] font-medium text-slate-500">Galerija</span>
                <div className="flex h-8 overflow-hidden rounded-lg border border-slate-200 bg-white">
                  <AppearanceEditorNumberInput
                    data-testid="product-gallery-size"
                    min={50}
                    max={100}
                    value={gallery.sizePercent}
                    onValueChange={(value) => onGalleryChange({
                      sizePercent: value
                    })}
                    className="min-w-0 flex-1 bg-transparent px-2 text-right text-[11px] outline-none"
                  />
                  <span className="grid w-8 place-items-center border-l border-slate-200 text-[9px] text-slate-500">%</span>
                </div>
              </label>
              <label className="grid gap-1">
                <span className="text-[9px] font-medium text-slate-500">Sličica</span>
                <div className="flex h-8 overflow-hidden rounded-lg border border-slate-200 bg-white">
                  <AppearanceEditorNumberInput
                    data-testid="product-gallery-thumbnail-size"
                    min={30}
                    max={120}
                    value={gallery.thumbnailSizePx}
                    onValueChange={(value) => onGalleryChange({
                      thumbnailSizePx: value
                    })}
                    className="min-w-0 flex-1 bg-transparent px-2 text-right text-[11px] outline-none"
                  />
                  <span className="grid w-8 place-items-center border-l border-slate-200 text-[9px] text-slate-500">px</span>
                </div>
              </label>
              <label className="grid gap-1">
                <span className="text-[9px] font-medium text-slate-500">Razmik</span>
                <div className="flex h-8 overflow-hidden rounded-lg border border-slate-200 bg-white">
                  <AppearanceEditorNumberInput
                    data-testid="product-gallery-thumbnail-gap"
                    min={0}
                    max={40}
                    value={gallery.thumbnailGapPx}
                    onValueChange={(value) => onGalleryChange({
                      thumbnailGapPx: value
                    })}
                    className="min-w-0 flex-1 bg-transparent px-2 text-right text-[11px] outline-none"
                  />
                  <span className="grid w-8 place-items-center border-l border-slate-200 text-[9px] text-slate-500">px</span>
                </div>
              </label>
              <label className="flex min-h-8 items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white px-2">
                <span className="text-[9px] font-medium text-slate-600">Skrij pri eni sliki</span>
                <input
                  data-testid="product-gallery-hide-single-thumbnail"
                  type="checkbox"
                  checked={gallery.hideThumbnailsWhenSingle}
                  onChange={(event) => onGalleryChange({
                    hideThumbnailsWhenSingle: event.target.checked
                  })}
                  className={`h-3.5 w-3.5 rounded border-slate-300 text-[color:var(--blue-600)] ${adminControlFocusTokenClasses}`}
                />
              </label>
            </div>
          </div>
        ) : null}
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold text-slate-900">Galerija artikla</p>
            <p className="mt-0.5 text-[10px] text-slate-500">
              Slike se shranijo v isti zapis kot na strani Artikli.
            </p>
          </div>
          <button
            type="button"
            disabled={uploading}
            onClick={() => fileInputRef.current?.click()}
            className={`inline-flex h-8 items-center gap-1.5 rounded-lg bg-[color:var(--blue-600)] px-3 text-[10px] font-semibold text-white hover:bg-[color:var(--blue-700)] disabled:opacity-50 ${adminControlFocusTokenClasses}`}
          >
            <ImagePlus className="h-3.5 w-3.5" />
            {uploading ? 'Nalagam …' : 'Dodaj slike'}
          </button>
          <input
            ref={fileInputRef}
            className="hidden"
            type="file"
            accept="image/*"
            multiple
            onChange={(event: ChangeEvent<HTMLInputElement>) => {
              const files = Array.from(event.target.files ?? []);
              event.target.value = '';
              if (files.length > 0) void onUploadImages(files);
            }}
          />
        </div>
        <div className="grid max-h-72 gap-2 overflow-y-auto pr-1" data-appearance-editor-scroll-purpose="data">
          {images.length === 0 ? (
            <p className="rounded-lg border border-dashed border-slate-200 p-4 text-center text-[10px] text-slate-500">
              Artikel še nima galerijskih slik.
            </p>
          ) : images.map(({ media, index }) => {
            const src = media.blobUrl ?? media.externalUrl ?? '';
            return (
              <div key={media.id ?? `${media.filename}-${index}`} className="grid grid-cols-[52px_minmax(0,1fr)_30px] items-center gap-2 rounded-lg border border-slate-200 p-2">
                <div className="aspect-square overflow-hidden rounded-md bg-slate-100">
                  {src ? (
                    <Image
                      src={src}
                      alt=""
                      width={52}
                      height={52}
                      unoptimized
                      className="h-full w-full object-cover"
                    />
                  ) : null}
                </div>
                <label className="grid gap-1">
                  <span className="text-[9px] font-medium text-slate-500">Nadomestno besedilo</span>
                  <input
                    value={media.altText ?? ''}
                    onChange={(event) => updateMedia(index, { altText: event.target.value })}
                    className={fieldClassName}
                    placeholder={media.filename ?? 'Opis slike'}
                  />
                </label>
                <button
                  type="button"
                  onClick={() => removeMedia(index)}
                  aria-label="Odstrani sliko"
                  title="Odstrani sliko"
                  className={`grid h-8 w-8 place-items-center rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-600 ${adminControlFocusTokenClasses}`}
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  if (
    selectedElementId === 'product-short-description'
    || selectedElementId === 'product-description'
  ) {
    const storedDescription = product.description ?? '';
    const storedPlainText = toStorefrontPlainText(storedDescription);
    const resolvedPlainText = resolveCatalogueDescription({
      slug: product.slug,
      name: product.itemName,
      description: storedPlainText
    });
    const editorValue = resolvedPlainText !== storedPlainText
      ? plainTextToCatalogRichText(resolvedPlainText)
      : sanitizeCatalogRichText(storedDescription)
        || plainTextToCatalogRichText(storedPlainText);

    return (
      <div className="grid gap-2">
        <div>
          <p className="text-xs font-semibold text-slate-900">Opis artikla</p>
          <p className="mt-0.5 text-[10px] leading-4 text-slate-500">
          To je isti opis, ki ga urejate v Artikli. Predogled se posodobi takoj.
          </p>
        </div>
        <ProductDescriptionRichTextEditor
          value={editorValue}
          defaultFontSizePx={defaultFontSizePx}
          onChange={(description) => onProductChange({ description })}
        />
        <SecondaryDividerControls
          secondaryContent={secondaryContent}
          onChange={onSecondaryContentChange}
        />
        <p className="text-[9px] leading-4 text-slate-500">
          Enter ustvari nov odstavek, Shift + Enter pa mehki prelom vrstice.
          Osnovno velikost in razmik celotnega elementa nastavite pod Slog.
        </p>
      </div>
    );
  }

  if (
    selectedElementId === 'product-specifications'
    || selectedElementId === 'product-specifications-content'
    || selectedElementId === 'product-key-attributes'
  ) {
    return (
      <div className="grid gap-3">
        <div>
          <p className="text-[10px] font-semibold text-slate-800">
            Osnovne specifikacije artikla
          </p>
          <p className="mt-0.5 text-[9px] leading-4 text-slate-500">
            Vrednosti so skupne z zapisom v Artikli.
          </p>
        </div>
        <SecondaryDividerControls
          secondaryContent={secondaryContent}
          onChange={onSecondaryContentChange}
        />
        <div
          data-testid="product-specification-order-controls"
          className="grid gap-2 rounded-lg border border-white/15 bg-white/5 p-2.5"
        >
          <div>
            <p className="text-[10px] font-semibold text-white">
              Vrstni red na strani &middot; vsi artikli
            </p>
            <p className="mt-0.5 text-[9px] leading-4 text-white/60">
              Debelina, dol&#382;ina in &#353;irina so prikazane skupaj kot
              &quot;Dimenzije&quot;. Druge lastnosti sledijo temu vrstnemu redu.
            </p>
          </div>
          {displayedSpecifications.length > 0 ? (
            <ol className="grid gap-1">
              {displayedSpecifications.map((specification, index) => (
                <li
                  key={getStorefrontSpecificationOrderKey(specification)}
                  data-testid="product-specification-order-row"
                  className="grid grid-cols-[22px_minmax(0,1fr)_28px_28px] items-center gap-1 rounded-md border border-white/10 bg-black/10 px-1.5 py-1"
                >
                  <span className="grid h-5 w-5 place-items-center rounded-full bg-white/10 text-[9px] font-semibold text-white/65">
                    {index + 1}
                  </span>
                  <span className="min-w-0 truncate text-[10px] font-medium text-white">
                    {specification.label}
                  </span>
                  <button
                    type="button"
                    onClick={() => moveDisplayedSpecification(index, -1)}
                    disabled={index === 0}
                    aria-label={`Premakni ${specification.label} gor`}
                    className={`grid h-7 w-7 place-items-center rounded-md text-white/70 hover:bg-white/10 hover:text-white disabled:opacity-25 ${adminControlFocusTokenClasses}`}
                  >
                    <ChevronUp className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => moveDisplayedSpecification(index, 1)}
                    disabled={index === displayedSpecifications.length - 1}
                    aria-label={`Premakni ${specification.label} dol`}
                    className={`grid h-7 w-7 place-items-center rounded-md text-white/70 hover:bg-white/10 hover:text-white disabled:opacity-25 ${adminControlFocusTokenClasses}`}
                  >
                    <ChevronDown className="h-3.5 w-3.5" />
                  </button>
                </li>
              ))}
            </ol>
          ) : (
            <p className="rounded-md border border-dashed border-white/15 px-2 py-3 text-center text-[9px] text-white/55">
              Artikel &#353;e nima objavljenih specifikacij.
            </p>
          )}
        </div>
        {product.variants.length > 0 ? (
          <>
            <div className="grid gap-1">
              <span className="text-[9px] font-medium text-slate-500">Različica</span>
              <CompactContextSelect
                value={String(selectedVariant?.id ?? '')}
                options={product.variants.map((variant) => ({ value: String(variant.id ?? ''), label: variant.variantName }))}
                label="Različica"
                marker="variant-specification-editor"
                onChange={(variantId) => onSelectedVariantIdChange(Number(variantId) || null)}
              />
            </div>
            <div className="grid gap-2 rounded-lg border border-slate-200 bg-slate-50/70 p-2.5">
              <div>
                <p className="text-[10px] font-semibold text-slate-800">
                  Sistemske specifikacije različice
                </p>
                <p className="mt-0.5 text-[9px] leading-4 text-slate-500">
                  Prikazni naziv lahko prilagodite, ne da bi spremenili pomen prodajnega polja.
                  Vrednosti se shranijo v ista polja kot v Artikli.
                </p>
              </div>
              <SpecificationDisplayLabelsEditor
                rows={systemSpecificationRows.map((row) => ({
                  ...row,
                  valueEditor: renderSystemSpecificationValueEditor(row)
                }))}
                labels={specificationLabels}
                onChange={updateSpecificationLabels}
                surface="appearance-editor"
                reservedLabels={Object.keys(selectedSpecifications)}
              />
            </div>
            <div className="grid gap-2">
              <div>
                <p className="text-[10px] font-semibold text-slate-800">
                  Dodatne specifikacije različice
                </p>
                <p className="mt-0.5 text-[9px] leading-4 text-slate-500">
                  Nazive in vrednosti lahko urejate neposredno.
                </p>
              </div>
              <VariantSpecificationsEditor
                specifications={selectedSpecifications}
                onChange={updateVariantSpecifications}
                onLabelChange={(previousLabel, nextLabel) => {
                  const migrated = migrateCatalogSpecificationKey(
                    secondaryContent.specificationOrder,
                    specificationLabels,
                    previousLabel,
                    nextLabel
                  );
                  onSecondaryContentChange({
                    specificationOrder: migrated.specificationOrder
                  });
                  updateSpecificationLabels(migrated.specificationLabels);
                }}
                surface="appearance-editor"
                reservedLabels={[
                  ...Object.values(specificationLabels),
                  ...(previewProduct?.specifications ?? []).map(
                    (specification) => specification.label
                  ),
                  ...(previewVariant?.specifications ?? []).map(
                    (specification) => specification.label
                  )
                ]}
              />
            </div>
          </>
        ) : null}
      </div>
    );
  }

  if (isVariantContentElementId(selectedElementId)) {
    return (
      <div className="grid gap-3">
        <fieldset
          data-testid="product-variant-chip-size-controls"
          className="grid gap-2 rounded-lg border border-white/15 bg-white/5 p-2.5"
        >
          <legend className="px-1 text-[10px] font-semibold text-white">
            Velikost gumbov in naslovov
          </legend>
          <p className="text-[9px] leading-4 text-white/60">
            Mere veljajo za gumbe debeline, tipografija naslova pa skupaj za
            &quot;Debelina&quot; in &quot;Dimenzije&quot;.
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            {([
              ['chipWidthPx', 'Širina gumba', 72, 180],
              ['chipHeightPx', 'Višina gumba', 36, 80],
              ['chipFontSizePx', 'Besedilo gumba', 11, 24],
              ['labelFontSizePx', 'Naslova izbirnikov', 11, 28]
            ] as const).map(([key, label, minimum, maximum]) => (
              <label key={key} className="grid gap-1">
                <span className="text-[9px] font-medium text-white/70">
                  {label}
                </span>
                <span className="flex overflow-hidden rounded-lg border border-slate-200 bg-white">
                  <AppearanceEditorNumberInput
                    data-testid={`product-variant-chip-${key}`}
                    min={minimum}
                    max={maximum}
                    step={1}
                    value={variants[key]}
                    onValueChange={(value) => {
                      onVariantsChange({
                        [key]: Math.min(maximum, Math.max(minimum, value))
                      });
                    }}
                    className="h-8 min-w-0 flex-1 bg-transparent px-2.5 text-[11px] text-slate-800 outline-none"
                  />
                  <span className="grid place-items-center border-l border-slate-200 px-2 text-[10px] text-slate-500">
                    px
                  </span>
                </span>
              </label>
            ))}
          </div>
          <label className="grid gap-1">
            <span className="text-[9px] font-medium text-white/70">
              Razmik med naslovom in izbirnikom
            </span>
            <span className="flex overflow-hidden rounded-lg border border-slate-200 bg-white">
              <AppearanceEditorNumberInput
                data-testid="product-variant-label-control-gap"
                min={0}
                max={32}
                step={1}
                value={variants.labelControlGapPx}
                onValueChange={(labelControlGapPx) => {
                  onVariantsChange({
                    labelControlGapPx: Math.min(
                      32,
                      Math.max(0, labelControlGapPx)
                    )
                  });
                }}
                className="h-8 min-w-0 flex-1 bg-transparent px-2.5 text-[11px] text-slate-800 outline-none"
              />
              <span className="grid place-items-center border-l border-slate-200 px-2 text-[10px] text-slate-500">
                px
              </span>
            </span>
            <span className="text-[9px] leading-4 text-white/55">
              Enako velja za Debelino, Dimenzije in druge izbirnike različic.
            </span>
          </label>
        </fieldset>
        <fieldset
          data-testid="product-variant-select-size-controls"
          className="grid gap-2 rounded-lg border border-white/15 bg-white/5 p-2.5"
        >
          <legend className="px-1 text-[10px] font-semibold text-white">
            Velikost spustnega seznama
          </legend>
          <p className="text-[9px] leading-4 text-white/60">
            Velja za Dimenzije in druge spustne izbirnike različic. Na ozkih
            zaslonih širina ostane omejena na razpoložljivi prostor.
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            {([
              ['selectWidthPx', 'Širina', 160, 500],
              ['selectHeightPx', 'Višina', 40, 88]
            ] as const).map(([key, label, minimum, maximum]) => (
              <label key={key} className="grid gap-1">
                <span className="text-[9px] font-medium text-white/70">
                  {label}
                </span>
                <span className="flex overflow-hidden rounded-lg border border-slate-200 bg-white">
                  <AppearanceEditorNumberInput
                    data-testid={`product-variant-select-${key}`}
                    min={minimum}
                    max={maximum}
                    step={1}
                    value={variants[key]}
                    onValueChange={(value) => {
                      onVariantsChange({
                        [key]: Math.min(maximum, Math.max(minimum, value))
                      });
                    }}
                    className="h-8 min-w-0 flex-1 bg-transparent px-2.5 text-[11px] text-slate-800 outline-none"
                  />
                  <span className="grid place-items-center border-l border-slate-200 px-2 text-[10px] text-slate-500">
                    px
                  </span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>
        <div className="grid gap-1.5">
          <span className="text-xs font-semibold text-slate-900">Predogled različice</span>
          <span className="text-[10px] text-slate-500">
            Trgovske podatke različic urejate v Artikli; tukaj izberete vsebino, ki jo oblikujete.
          </span>
          <CompactContextSelect
            value={String(selectedVariant?.id ?? '')}
            options={product.variants.map((variant) => ({ value: String(variant.id ?? ''), label: variant.variantName }))}
            label="Predogled različice"
            marker="variant-preview"
            onChange={(variantId) => onSelectedVariantIdChange(Number(variantId) || null)}
          />
        </div>
      </div>
    );
  }

  if (selectedElementId === 'product-sku') {
    return (
      <div>
        <p className="text-xs font-semibold text-slate-900">SKU</p>
        <p className="mt-1 text-[11px] text-slate-600">{selectedVariant?.variantSku ?? product.sku ?? '—'}</p>
        <p className="mt-2 text-[10px] leading-4 text-slate-500">
          SKU vpliva na naročila in zalogo, zato ga urejate samo v Artikli.
        </p>
      </div>
    );
  }

  const fields = selectedElementId === 'product-title'
    || selectedElementId === 'card-title'
    || selectedElementId === 'cart-line-info'
    ? [['itemName', 'Naziv artikla']] as const
    : selectedElementId === 'product-category' || selectedElementId === 'card-brand'
      ? [['brand', 'Blagovna znamka']] as const
      : selectedElementId === 'product-badge'
        ? [['badge', 'Oznaka']] as const
        : [['itemName', 'Naziv artikla'], ['brand', 'Blagovna znamka'], ['badge', 'Oznaka']] as const;

  return (
    <div className="grid gap-2">
      {fields.map(([key, label]) => (
        <label key={key} className="grid gap-1">
          <span className="text-[9px] font-medium text-slate-500">{label}</span>
          <input
            value={product[key] ?? ''}
            onChange={(event) => onProductChange({ [key]: event.target.value })}
            className={fieldClassName}
          />
        </label>
      ))}
    </div>
  );
}

export default function ProductAppearanceContextToolbar({
  selectedElementId,
  selectedElementLabel,
  settings,
  elements,
  product,
  previewProduct,
  productOptions,
  gallery,
  variants,
  purchaseArea,
  relatedProducts,
  secondaryContent,
  previewDevice,
  selectedVariantId,
  uploading,
  onSelectElement,
  onCanvasChange,
  onElementCanvasChange,
  onReset,
  onProductChange,
  onGalleryChange,
  onVariantsChange,
  onPurchaseAreaChange,
  onRelatedProductsChange,
  onSecondaryContentChange,
  onSelectedVariantIdChange,
  onUploadImages
}: {
  selectedElementId: string | null;
  selectedElementLabel: string;
  settings: ProductCanvasElementDeviceSettings | null;
  elements: ProductAppearanceElementOption[];
  product: CatalogItemEditorHydration | null;
  previewProduct: StorefrontProduct | null;
  productOptions: AdminCatalogListItem[];
  gallery: ProductAppearanceConfig['gallery'];
  variants: ProductAppearanceConfig['variants'];
  purchaseArea: ProductAppearanceConfig['purchaseArea'];
  relatedProducts: ProductAppearanceConfig['relatedProducts'];
  secondaryContent: ProductAppearanceConfig['secondaryContent'];
  previewDevice: ProductCanvasDevice;
  selectedVariantId: number | null;
  uploading: boolean;
  onSelectElement: (elementId: string) => void;
  onCanvasChange: (updates: Partial<ProductCanvasElementDeviceSettings>) => void;
  onElementCanvasChange: (
    elementId: string,
    updates: Partial<ProductCanvasElementDeviceSettings>
  ) => void;
  onReset: () => void;
  onProductChange: (updates: Partial<CatalogItemEditorHydration>) => void;
  onGalleryChange: (updates: Partial<ProductAppearanceConfig['gallery']>) => void;
  onVariantsChange: (
    updates: Partial<ProductAppearanceConfig['variants']>
  ) => void;
  onPurchaseAreaChange: (
    updates: Partial<ProductAppearanceConfig['purchaseArea']>
  ) => void;
  onRelatedProductsChange: (
    updates: Partial<ProductAppearanceConfig['relatedProducts']>
  ) => void;
  onSecondaryContentChange: (
    updates: Partial<ProductAppearanceConfig['secondaryContent']>
  ) => void;
  onSelectedVariantIdChange: (variantId: number | null) => void;
  onUploadImages: (files: File[]) => Promise<void>;
}) {
  const [panel, setPanel] = useState<Panel>(null);
  const toolbarContentRef = useRef<HTMLDivElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const [panelAlignment, setPanelAlignment] = useState<'left' | 'right'>('left');
  const [panelLayout, setPanelLayout] = useState<{
    side: 'above' | 'below';
    maxHeight: number;
  }>({ side: 'below', maxHeight: 540 });
  useEffect(() => setPanel(null), [selectedElementId]);
  const canEditContent = Boolean(
    product
    && selectedElementId
    && (
      contentElementIds.has(selectedElementId)
      || isVariantContentElementId(selectedElementId)
    )
  );
  const toggleAspectRatioLock = () => {
    if (!settings) return;
    const aspectRatioLocked = !settings.aspectRatioLocked;
    if (!aspectRatioLocked) {
      onCanvasChange({ aspectRatioLocked: false });
      return;
    }
    const measured = measureSelectedCanvasElement(selectedElementId);
    onCanvasChange({
      aspectRatioLocked: true,
      widthPx: settings.widthPx > 0
        ? settings.widthPx
        : measured?.width ?? settings.widthPx,
      heightPx: settings.heightPx > 0
        ? settings.heightPx
        : measured?.height ?? settings.heightPx
    });
  };
  const toolbarPlacement = useAppearanceEditorToolbarPlacement();
  useLayoutEffect(() => {
    const toolbar = toolbarContentRef.current;
    const panelElement = panelRef.current;
    if (!panel || !toolbar || !panelElement || typeof window === 'undefined') return undefined;

    const updatePanelLayout = () => {
      const toolbarRect = toolbar.getBoundingClientRect();
      const panelWidth = panelElement.offsetWidth || Math.min(440, window.innerWidth - 32);
      const alignment = toolbarRect.left + panelWidth > window.innerWidth - 8 ? 'right' : 'left';
      setPanelAlignment((current) => current === alignment ? current : alignment);

      if (window.matchMedia('(max-width: 767px)').matches) {
        const maxHeight = Math.max(180, window.innerHeight - 96);
        setPanelLayout((current) => (
          current.side === 'below' && current.maxHeight === maxHeight
            ? current
            : { side: 'below', maxHeight }
        ));
        return;
      }

      const gap = 6;
      const margin = 8;
      const desiredHeight = Math.min(540, panelElement.scrollHeight);
      const availableAbove = Math.max(0, toolbarRect.top - margin - gap);
      const availableBelow = Math.max(0, window.innerHeight - toolbarRect.bottom - margin - gap);
      const preferredSide = toolbarPlacement === 'top' ? 'above' : 'below';
      const alternateSide = preferredSide === 'above' ? 'below' : 'above';
      const available = { above: availableAbove, below: availableBelow };
      const minimumUsableHeight = Math.min(desiredHeight, 180);
      const side = available[preferredSide] >= minimumUsableHeight
        ? preferredSide
        : alternateSide;
      const maxHeight = Math.max(120, Math.min(540, available[side]));
      setPanelLayout((current) => (
        current.side === side && Math.abs(current.maxHeight - maxHeight) < 0.5
          ? current
          : { side, maxHeight }
      ));
    };

    updatePanelLayout();
    const observer = typeof ResizeObserver === 'undefined'
      ? null
      : new ResizeObserver(updatePanelLayout);
    observer?.observe(toolbar);
    observer?.observe(panelElement);
    window.addEventListener('resize', updatePanelLayout);
    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', updatePanelLayout);
    };
  }, [panel, selectedElementId, toolbarPlacement]);
  useEffect(() => {
    if (!panel) return undefined;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setPanel(null);
    };
    const closeOutside = (event: PointerEvent) => {
      const target = event.target instanceof Element ? event.target : null;
      if (target?.closest('[data-admin-color-palette-portal], [data-appearance-editor-compact-select-portal]')) return;
      if (
        toolbarContentRef.current
        && event.target instanceof Node
        && !toolbarContentRef.current.contains(event.target)
      ) {
        setPanel(null);
      }
    };
    document.addEventListener('keydown', closeOnEscape);
    document.addEventListener('pointerdown', closeOutside, true);
    return () => {
      document.removeEventListener('keydown', closeOnEscape);
      document.removeEventListener('pointerdown', closeOutside, true);
    };
  }, [panel]);

  return (
    <div ref={toolbarContentRef} className="relative">
      <AppearanceEditorToolbarToneProvider tone="dark">
        <div className="flex min-w-0 flex-wrap items-center gap-0.5">
          <span
            className="mr-1 inline-flex h-8 max-w-44 min-w-0 items-center truncate rounded-lg bg-white/10 px-2.5 text-[11px] font-semibold text-white"
            title={selectedElementLabel}
          >
            {selectedElementLabel}
          </span>
          <AppearanceEditorToolbarDivider />
          {canEditContent ? (
            <AppearanceEditorToolbarButton
              label="Vsebina"
              popover
              active={panel === 'content'}
              onClick={() => setPanel(panel === 'content' ? null : 'content')}
            >
              <SlidersHorizontal className="h-3.5 w-3.5" />
            </AppearanceEditorToolbarButton>
          ) : null}
          <AppearanceEditorToolbarButton
            label="Slog · vsi artikli"
            popover
            active={panel === 'style'}
            onClick={() => setPanel(panel === 'style' ? null : 'style')}
          >
            <Palette className="h-3.5 w-3.5" />
          </AppearanceEditorToolbarButton>
          {selectedElementId && settings ? (
            <>
              <AppearanceEditorToolbarDivider />
              <AppearanceEditorToolbarButton
                label={settings.visible ? 'Skrij element' : 'Prikaži element'}
                pressed={settings.visible}
                onClick={() => onCanvasChange({ visible: !settings.visible })}
              >
                {settings.visible ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
              </AppearanceEditorToolbarButton>
              <AppearanceEditorToolbarButton
                label={settings.locked ? 'Odkleni element' : 'Zakleni element'}
                pressed={settings.locked}
                onClick={() => onCanvasChange({ locked: !settings.locked })}
              >
                {settings.locked ? <Lock className="h-3.5 w-3.5" /> : <Unlock className="h-3.5 w-3.5" />}
              </AppearanceEditorToolbarButton>
              <AppearanceEditorToolbarButton
                label={settings.aspectRatioLocked
                  ? 'Odkleni razmerje stranic'
                  : 'Zakleni razmerje stranic'}
                pressed={settings.aspectRatioLocked}
                onClick={toggleAspectRatioLock}
              >
                {settings.aspectRatioLocked
                  ? <Link2 className="h-3.5 w-3.5" />
                  : <Unlink2 className="h-3.5 w-3.5" />}
              </AppearanceEditorToolbarButton>
              <AppearanceEditorToolbarButton label="Ponastavi element" onClick={onReset}>
                <RotateCcw className="h-3.5 w-3.5" />
              </AppearanceEditorToolbarButton>
            </>
          ) : null}
        </div>
      </AppearanceEditorToolbarToneProvider>

      {panel ? (
        <div
          ref={panelRef}
          role="dialog"
          aria-label={panel === 'layers' ? 'Elementi predogleda' : panel === 'content' ? 'Vsebina artikla' : 'Slog elementa'}
          data-product-toolbar-popover
          data-product-toolbar-popover-side={panelLayout.side}
          className={`absolute z-[130] flex w-[min(440px,calc(100vw-32px))] flex-col overflow-visible max-md:fixed max-md:inset-x-3 max-md:bottom-auto max-md:top-20 max-md:w-auto ${appearanceEditorToolbarPopoverSurfaceClassName} ${panelLayout.side === 'above' ? 'bottom-[calc(100%+6px)]' : 'top-[calc(100%+6px)]'} ${panelAlignment === 'right' ? 'right-0' : 'left-0'}`}
          onPointerDown={(event) => event.stopPropagation()}
        >
          <div className="flex shrink-0 items-center justify-between gap-3 px-3 pb-1.5 pt-2">
            <p className="text-[11px] font-semibold text-white">
              {panel === 'layers' ? 'Elementi predogleda' : panel === 'content' ? 'Vsebina artikla' : 'Slog elementa'}
            </p>
            <button
              type="button"
              onClick={() => setPanel(null)}
              className={`grid h-6 w-6 place-items-center rounded-md text-white/75 hover:bg-white/10 hover:text-white ${adminControlFocusTokenClasses}`}
              aria-label="Zapri"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>

          <div
            data-product-toolbar-dark-controls
            data-appearance-editor-settings-surface
            data-settings-scroll="none"
            className="border-t border-white/15 bg-[rgba(30,41,53,0.98)] p-2.5 [&_.bg-slate-100]:!bg-white/10 [&_.bg-slate-50]:!bg-white/5 [&_.bg-white]:!bg-white/10 [&_.border-slate-200]:!border-white/15 [&_.border-slate-300]:!border-white/20 [&_.text-slate-400]:!text-white/55 [&_.text-slate-500]:!text-white/65 [&_.text-slate-600]:!text-white/75 [&_.text-slate-700]:!text-white/85 [&_.text-slate-800]:!text-white/90 [&_.text-slate-900]:!text-white"
          >
          {panel === 'layers' ? (
            <div className="grid max-h-72 grid-cols-1 gap-1 overflow-y-auto sm:grid-cols-2" data-appearance-editor-scroll-purpose="navigation">
              {elements.map((element) => (
                <div
                  key={element.id}
                  className={`flex items-center gap-1 rounded-lg border px-1.5 py-1 ${
                    selectedElementId === element.id
                      ? 'border-[color:var(--blue-200)] bg-[color:var(--blue-50)]'
                      : 'border-transparent hover:bg-slate-50'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => {
                      onSelectElement(element.id);
                      setPanel(null);
                    }}
                    className={`min-w-0 flex-1 truncate px-1.5 py-1 text-left text-[10px] font-medium text-slate-700 ${adminControlFocusTokenClasses}`}
                  >
                    {element.label}
                  </button>
                  <button
                    type="button"
                    disabled={element.protectedElement}
                    onClick={() => {
                      onSelectElement(element.id);
                      onElementCanvasChange(element.id, { visible: !element.settings.visible });
                    }}
                    className={`grid h-7 w-7 place-items-center rounded-md text-slate-400 hover:bg-white disabled:opacity-30 ${adminControlFocusTokenClasses}`}
                    aria-label={element.settings.visible ? 'Skrij' : 'Prikaži'}
                  >
                    {element.settings.visible ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                  </button>
                </div>
              ))}
            </div>
          ) : null}

          {panel === 'content' && selectedElementId && product ? (
            <ContentPanel
                  selectedElementId={selectedElementId}
                  product={product}
                  previewProduct={previewProduct}
                  productOptions={productOptions}
                  gallery={gallery}
                  variants={variants}
                  purchaseArea={purchaseArea}
                  relatedProducts={relatedProducts}
                  secondaryContent={secondaryContent}
              defaultFontSizePx={settings?.fontSizePx ?? 0}
              previewDevice={previewDevice}
              selectedVariantId={selectedVariantId}
              uploading={uploading}
              onProductChange={onProductChange}
                  onGalleryChange={onGalleryChange}
                  onVariantsChange={onVariantsChange}
                  onPurchaseAreaChange={onPurchaseAreaChange}
                  onRelatedProductsChange={onRelatedProductsChange}
                  onSecondaryContentChange={onSecondaryContentChange}
              onSelectedVariantIdChange={onSelectedVariantIdChange}
              onUploadImages={onUploadImages}
            />
          ) : null}

          {panel === 'style' && settings ? (
            <div className="grid gap-3">
              <div
                data-testid="product-canvas-dimensions"
                className="grid gap-2 rounded-lg border border-slate-200 bg-white p-2.5"
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[10px] font-semibold text-slate-800">
                      {selectedElementId === 'product-primary-action'
                        ? 'Položaj in velikost gumba'
                        : 'Položaj in velikost elementa'}
                    </p>
                    <p className="text-[9px] leading-4 text-slate-500">
                      {selectedElementId === 'product-primary-action'
                        ? 'Širina in višina spremenita dejanski gumb za izbrano napravo.'
                        : 'Vnesite odmik ali element povlecite za modro oznako.'}
                    </p>
                  </div>
                  <button
                    type="button"
                    data-testid="product-canvas-aspect-ratio-lock"
                    aria-pressed={settings.aspectRatioLocked}
                    aria-label={settings.aspectRatioLocked
                      ? 'Odkleni razmerje stranic'
                      : 'Zakleni razmerje stranic'}
                    title={settings.aspectRatioLocked
                      ? 'Širina in višina se spreminjata sorazmerno'
                      : 'Širina in višina se spreminjata neodvisno'}
                    onClick={toggleAspectRatioLock}
                    className={`inline-flex h-8 items-center gap-1.5 rounded-lg border px-2 text-[9px] font-semibold transition ${adminControlFocusTokenClasses} ${
                      settings.aspectRatioLocked
                        ? 'border-[color:var(--blue-300)] bg-[color:var(--blue-50)] text-[color:var(--blue-700)]'
                        : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    {settings.aspectRatioLocked
                      ? <Link2 className="h-3.5 w-3.5" />
                      : <Unlink2 className="h-3.5 w-3.5" />}
                    {settings.aspectRatioLocked ? 'Zaklenjeno' : 'Neodvisno'}
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <label className="grid gap-1">
                    <span className="text-[9px] font-medium text-slate-500">
                      Vodoravni odmik
                    </span>
                    <div className="relative">
                      <AppearanceEditorNumberInput
                        min={-5000}
                        max={5000}
                        data-testid="product-canvas-offset-x"
                        aria-label="Vodoravni odmik elementa"
                        value={settings.offsetXPx}
                        disabled={settings.locked}
                        onValueChange={(value) => onCanvasChange({
                          offsetXPx: value
                        })}
                        className={`${fieldClassName} pr-7 disabled:cursor-not-allowed disabled:opacity-50`}
                      />
                      <span className="pointer-events-none absolute inset-y-0 right-2 grid place-items-center text-[9px] text-slate-400">
                        px
                      </span>
                    </div>
                  </label>
                  <label className="grid gap-1">
                    <span className="text-[9px] font-medium text-slate-500">
                      Navpični odmik
                    </span>
                    <div className="relative">
                      <AppearanceEditorNumberInput
                        min={-5000}
                        max={5000}
                        data-testid="product-canvas-offset-y"
                        aria-label="Navpični odmik elementa"
                        value={settings.offsetYPx}
                        disabled={settings.locked}
                        onValueChange={(value) => onCanvasChange({
                          offsetYPx: value
                        })}
                        className={`${fieldClassName} pr-7 disabled:cursor-not-allowed disabled:opacity-50`}
                      />
                      <span className="pointer-events-none absolute inset-y-0 right-2 grid place-items-center text-[9px] text-slate-400">
                        px
                      </span>
                    </div>
                  </label>
                </div>
                <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-end gap-2">
                  <label className="grid gap-1">
                    <span className="text-[9px] font-medium text-slate-500">
                      {selectedElementId === 'product-primary-action'
                        ? 'Širina gumba'
                        : 'Širina'}
                    </span>
                    <div className="relative">
                      <AppearanceEditorNumberInput
                        min={selectedElementId === 'product-primary-action'
                          ? 160
                          : 0}
                        max={5000}
                        data-testid="product-canvas-width"
                        aria-label="Širina elementa"
                        value={settings.widthPx}
                        disabled={settings.locked}
                        onValueChange={(value) => onCanvasChange(dimensionUpdates({
                          selectedElementId,
                          settings,
                          axis: 'width',
                          value
                        }))}
                        className={`${fieldClassName} pr-7 disabled:cursor-not-allowed disabled:opacity-50`}
                      />
                      <span className="pointer-events-none absolute inset-y-0 right-2 grid place-items-center text-[9px] text-slate-400">
                        px
                      </span>
                    </div>
                  </label>
                  <span className="pb-2 text-slate-400">
                    {settings.aspectRatioLocked
                      ? <Link2 className="h-3.5 w-3.5" />
                      : <Unlink2 className="h-3.5 w-3.5" />}
                  </span>
                  <label className="grid gap-1">
                    <span className="text-[9px] font-medium text-slate-500">
                      {selectedElementId === 'product-primary-action'
                        ? 'Višina gumba'
                        : 'Višina'}
                    </span>
                    <div className="relative">
                      <AppearanceEditorNumberInput
                        min={selectedElementId === 'product-primary-action'
                          ? 40
                          : 0}
                        max={5000}
                        data-testid="product-canvas-height"
                        aria-label="Višina elementa"
                        value={settings.heightPx}
                        disabled={settings.locked}
                        onValueChange={(value) => onCanvasChange(dimensionUpdates({
                          selectedElementId,
                          settings,
                          axis: 'height',
                          value
                        }))}
                        className={`${fieldClassName} pr-7 disabled:cursor-not-allowed disabled:opacity-50`}
                      />
                      <span className="pointer-events-none absolute inset-y-0 right-2 grid place-items-center text-[9px] text-slate-400">
                        px
                      </span>
                    </div>
                  </label>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-[9px] text-slate-500">
                    {selectedElementId === 'product-primary-action'
                      ? 'Najmanj 160 × 40 px; za samodejno velikost uporabite Samodejno.'
                      : 'Vrednost 0 pomeni samodejno velikost.'}
                  </span>
                  <button
                    type="button"
                    disabled={settings.locked}
                    onClick={() => onCanvasChange({
                      widthPx: 0,
                      heightPx: 0
                    })}
                    className={`text-[9px] font-semibold text-[color:var(--blue-600)] disabled:opacity-40 ${adminControlFocusTokenClasses}`}
                  >
                    Samodejno
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <CompactHexColorField
                  label="Besedilo"
                  value={settings.color}
                  marker="product-canvas-text-color"
                  tone="light"
                  allowClear
                  clearLabel="Podeduj"
                  inheritedColor="#0F172A"
                  onChange={(color) => onCanvasChange({ color })}
                  inputAttributes={{ 'aria-label': 'Barva besedila' }}
                  className="min-w-0"
                />
                <CompactHexColorField
                  label="Ozadje"
                  value={settings.backgroundColor}
                  marker="product-canvas-background-color"
                  tone="light"
                  allowClear
                  clearLabel="Brez"
                  inheritedColor="#FFFFFF"
                  onChange={(backgroundColor) => onCanvasChange({ backgroundColor })}
                  inputAttributes={{ 'aria-label': 'Barva ozadja' }}
                  className="min-w-0"
                />
                <label className="grid gap-1">
                  <span className="text-[9px] font-medium text-slate-500">Velikost pisave</span>
                  <AppearanceEditorNumberInput
                    min={0}
                    max={96}
                    value={settings.fontSizePx}
                    onValueChange={(value) => onCanvasChange({ fontSizePx: value })}
                    className={fieldClassName}
                  />
                </label>
                <div className="grid gap-1">
                  <span className="text-[9px] font-medium text-slate-500">Debelina</span>
                  <CompactContextSelect
                    value={String(settings.fontWeight)}
                    options={[
                      { value: '0', label: 'Deduj' },
                      { value: '400', label: 'Navadno' },
                      { value: '500', label: 'Srednje' },
                      { value: '600', label: 'Polkrepko' },
                      { value: '700', label: 'Krepko' }
                    ]}
                    label="Debelina pisave"
                    marker="canvas-font-weight"
                    onChange={(fontWeight) => onCanvasChange({ fontWeight: Number(fontWeight) })}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <div className="grid gap-1">
                  <span className="text-[9px] font-medium text-slate-500">Poravnava</span>
                  <AppearanceEditorAlignmentControl
                    value={settings.textAlign}
                    options={['inherit', 'left', 'center', 'right', 'justify'] as const}
                    className="w-full"
                    ariaLabel="Poravnava besedila elementa"
                    onValueChange={(textAlign) => onCanvasChange({ textAlign })}
                  />
                </div>
                <label className="grid gap-1">
                  <span className="text-[9px] font-medium text-slate-500">Radij</span>
                  <AppearanceEditorNumberInput min={0} max={999} value={settings.borderRadiusPx} onValueChange={(value) => onCanvasChange({ borderRadiusPx: value })} className={fieldClassName} />
                </label>
                <label className="grid gap-1">
                  <span className="text-[9px] font-medium text-slate-500">Prosojnost</span>
                  <input type="range" min={0.1} max={1} step={0.05} value={settings.opacity} onChange={(event) => onCanvasChange({ opacity: Number(event.target.value) })} className="h-8 w-full" />
                </label>
                <div className="grid gap-1">
                  <span className="text-[9px] font-medium text-slate-500">Senca</span>
                  <CompactContextSelect
                    value={settings.shadow}
                    options={[
                      { value: 'none', label: 'Brez' },
                      { value: 'sm', label: 'Majhna' },
                      { value: 'md', label: 'Srednja' },
                      { value: 'lg', label: 'Velika' }
                    ]}
                    label="Senca"
                    marker="canvas-shadow"
                    onChange={(shadow) => onCanvasChange({ shadow })}
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                <div className="grid gap-1">
                  <span className="text-[9px] font-medium text-slate-500">Pisava elementa</span>
                  <CompactContextSelect
                    value={settings.fontFamily}
                    options={[
                      { value: '', label: 'Deduj globalno pisavo' },
                      { value: 'Inter, system-ui, sans-serif', label: 'Inter' },
                      { value: 'Arial, sans-serif', label: 'Arial' },
                      { value: 'Georgia, serif', label: 'Georgia' },
                      { value: "'Times New Roman', Times, serif", label: 'Times New Roman' },
                      { value: 'Verdana, sans-serif', label: 'Verdana' },
                      { value: "'Courier New', Courier, monospace", label: 'Courier New' }
                    ]}
                    label="Pisava elementa"
                    marker="canvas-font-family"
                    onChange={(fontFamily) => onCanvasChange({ fontFamily })}
                  />
                </div>
                <label className="grid gap-1">
                  <span className="text-[9px] font-medium text-slate-500">Višina vrstice</span>
                  <AppearanceEditorNumberInput
                    min={0}
                    max={3}
                    step={0.05}
                    value={settings.lineHeight}
                    onValueChange={(value) => onCanvasChange({ lineHeight: value })}
                    className={fieldClassName}
                  />
                </label>
                <label className="grid gap-1">
                  <span className="text-[9px] font-medium text-slate-500">Razmik med črkami</span>
                  <div className="relative">
                    <AppearanceEditorNumberInput
                      min={-5}
                      max={20}
                      step={0.1}
                      value={settings.letterSpacingPx}
                      onValueChange={(value) => onCanvasChange({ letterSpacingPx: value })}
                      className={`${fieldClassName} pr-7`}
                    />
                    <span className="pointer-events-none absolute inset-y-0 right-2 grid place-items-center text-[9px] text-slate-400">px</span>
                  </div>
                </label>
              </div>
              <p className="text-[10px] text-slate-500">
                Položaj spremenite z vlečenjem elementa. Desna ročica spreminja
                širino, spodnja višino, kotna pa obe meri.
              </p>
            </div>
          ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function createUploadedGalleryMedia(
  files: UploadedCatalogMediaFile[],
  currentMedia: CatalogItemMediaPayload[]
) {
  const startPosition = nextPosition(currentMedia);
  return files.map<CatalogItemMediaPayload>((file, index) => ({
    mediaKind: 'image',
    role: 'gallery',
    sourceKind: 'upload',
    filename: file.filename,
    blobUrl: file.url,
    blobPathname: file.pathname,
    mimeType: file.mimeType,
    altText: '',
    hidden: false,
    position: startPosition + index
  }));
}
