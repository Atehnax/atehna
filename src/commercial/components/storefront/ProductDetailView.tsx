'use client';

import Link from 'next/link';
import { House } from 'lucide-react';
import {
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type ReactNode
} from 'react';
import { useCartStore } from '@/commercial/cart/store';
import {
  ProductAppearanceProvider,
  useProductAppearance
} from '@/commercial/components/ProductAppearanceProvider';
import { toCommercialStorefrontLogicalPx } from '@/commercial/components/commercialStorefrontScale';
import ProductCard from '@/commercial/components/storefront/ProductCard';
import ProductGallery from '@/commercial/components/storefront/ProductGallery';
import PurchasePanel from '@/commercial/components/storefront/PurchasePanel';
import SpecificationTable from '@/commercial/components/storefront/SpecificationTable';
import useProductCanvasDevice from '@/commercial/components/storefront/useProductCanvasDevice';
import VariantSelector, {
  type VariantSelection
} from '@/commercial/components/storefront/VariantSelector';
import {
  buildCartOptionSelections,
  buildProductCartItem
} from '@/commercial/features/products/productCart';
import {
  isStorefrontVariantPurchasable,
  type StorefrontProduct,
  type StorefrontVariant
} from '@/commercial/features/products/storefrontProduct';
import { mergeStorefrontSpecifications } from '@/commercial/features/products/storefrontSpecifications';
import {
  resolveProductAppearanceConfig,
  resolveProductCanvasElementDeviceSettings,
  toProductAppearanceCssVariables,
  type ProductInformationBlock,
  type ProductCanvasDevice,
  type ProductCanvasElementDeviceSettings,
  type ProductSecondaryLayout
} from '@/shared/domain/style/productAppearance';
import ProductCanvasElement, {
  PRODUCT_CANVAS_PROTECTED_ELEMENT_IDS
} from '@/shared/ui/product-canvas/ProductCanvasElement';

type ProductDetailViewProps = {
  product: StorefrontProduct;
  canvasEditor?: ProductDetailCanvasEditor;
};

export type ProductDetailCanvasEditor = {
  device: ProductCanvasDevice;
  selectedElementId: string | null;
  scale?: number;
  onSelectElement: (elementId: string) => void;
  onElementChange: (
    elementId: string,
    updates: Partial<ProductCanvasElementDeviceSettings>
  ) => void;
};

type ProductCanvasWrapper = (
  elementId: string,
  label: string,
  children: ReactNode,
  className?: string
) => ReactNode;

const informationCanvasElement: Record<
  Exclude<ProductInformationBlock, 'brand'>,
  { id: string; label: string }
> = {
  title: { id: 'product-title', label: 'Naziv artikla' },
  badge: { id: 'product-badge', label: 'Oznaka' },
  sku: { id: 'product-sku', label: 'SKU' },
  shortDescription: {
    id: 'product-short-description',
    label: 'Kratek opis'
  },
  keyAttributes: {
    id: 'product-key-attributes',
    label: 'KljuÄne lastnosti'
  },
  variants: { id: 'product-variants', label: 'RazliÄice' }
};

const selectionForVariant = (
  product: StorefrontProduct,
  variant: StorefrontVariant | undefined
): VariantSelection => {
  if (!variant) return {};
  return Object.fromEntries(
    product.optionAxes.flatMap((axis) => {
      const value = axis.values.find((entry) =>
        variant.optionValueIds.includes(entry.id)
      );
      return value ? [[axis.id, value.id]] : [];
    })
  );
};

const variantMatchesSelection = (
  variant: StorefrontVariant,
  product: StorefrontProduct,
  selection: VariantSelection
) =>
  product.optionAxes.every((axis) => {
    const selectedValueId = selection[axis.id];
    return selectedValueId
      ? variant.optionValueIds.includes(selectedValueId)
      : true;
  });

function Breadcrumbs({ product }: { product: StorefrontProduct }) {
  return (
    <nav
      aria-label="Drobtinice"
      className="storefront-product-breadcrumbs mb-4"
    >
      <ol className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-[color:var(--site-color-text-muted)]">
        <li className="flex items-center gap-2">
          <Link
            href="/"
            className="site-link inline-flex items-center"
            aria-label="Domov"
          >
            <House aria-hidden="true" className="h-4 w-4" />
          </Link>
          <span aria-hidden="true">/</span>
        </li>
        {product.breadcrumbs.map((crumb, index) => (
          <li key={`${crumb.label}-${index}`} className="flex items-center gap-2">
            {index > 0 ? <span aria-hidden="true">/</span> : null}
            {crumb.href ? (
              <Link href={crumb.href} className="site-link">
                {crumb.label}
              </Link>
            ) : (
              <span aria-current="page">{crumb.label}</span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}

type DetailContentSection = {
  id: string;
  title: string;
  content: ReactNode;
  openByDefault: boolean;
  canvasElementId?: string;
};

type DetailNavigationItem = Pick<DetailContentSection, 'id' | 'title'>;

type DetailContentGroup = DetailNavigationItem & {
  sections: DetailContentSection[];
};

function buildStackedGroups(
  sections: DetailContentSection[],
  _combinedOverviewLabel: string
): DetailContentGroup[] {
  const overviewSections = sections.filter(
    (section) => section.id === 'description' || section.id === 'specifications'
  );
  if (overviewSections.length < 2) {
    return sections.map((section) => ({
      id: section.id,
      title: section.title,
      sections: [section]
    }));
  }

  const firstOverviewId = overviewSections[0]?.id;
  return sections.flatMap((section) => {
    if (section.id === firstOverviewId) {
      return [{
        id: section.id,
        title: section.title,
        sections: overviewSections
      }];
    }
    return [{
      id: section.id,
      title: section.title,
      sections: [section]
    }];
  });
}

function DetailSectionNavigation({
  sections,
  activeId,
  onSelect,
  desktop,
  mode,
  wrapCanvasElement
}: {
  sections: DetailNavigationItem[];
  activeId: string;
  onSelect: (sectionId: string) => void;
  desktop: boolean;
  mode: 'tabs' | 'anchors';
  wrapCanvasElement: ProductCanvasWrapper;
}) {
  const idPrefix = `product-detail-${desktop ? 'desktop' : 'mobile'}`;

  const onTabKeyDown = (
    event: KeyboardEvent<HTMLButtonElement>,
    currentIndex: number
  ) => {
    let nextIndex: number | null = null;
    if (event.key === 'ArrowRight') {
      nextIndex = (currentIndex + 1) % sections.length;
    } else if (event.key === 'ArrowLeft') {
      nextIndex = (currentIndex - 1 + sections.length) % sections.length;
    } else if (event.key === 'Home') {
      nextIndex = 0;
    } else if (event.key === 'End') {
      nextIndex = sections.length - 1;
    }

    if (nextIndex === null) return;
    event.preventDefault();
    const nextSection = sections[nextIndex];
    if (!nextSection) return;
    onSelect(nextSection.id);
    event.currentTarget.parentElement
      ?.querySelectorAll<HTMLButtonElement>('[role="tab"]')
      [nextIndex]?.focus();
  };

  if (mode === 'tabs') {
    const tabs = (
      <div
        role="tablist"
        aria-label="Podrobnosti izdelka"
        aria-orientation="horizontal"
        className="storefront-detail-tabs"
      >
        {sections.map((section, index) => {
          const active = section.id === activeId;
          return wrapCanvasElement(
            `product-secondary-tab-${section.id}`,
            `Zavihek ${section.title}`,
            <button
              key={section.id}
              id={`${idPrefix}-${section.id}-tab`}
              type="button"
              role="tab"
              aria-controls={`${idPrefix}-${section.id}-panel`}
              aria-selected={active}
              tabIndex={active ? 0 : -1}
              data-active={active}
              onClick={() => onSelect(section.id)}
              onKeyDown={(event) => onTabKeyDown(event, index)}
              className="storefront-detail-tab"
            >
              {section.title}
            </button>,
            'inline-flex min-w-0'
          );
        })}
      </div>
    );
    return wrapCanvasElement(
      'product-secondary-tabs',
      'Zavihki podrobnosti',
      tabs,
      'block min-w-0'
    );
  }

  const anchors = (
    <nav aria-label="Vsebina izdelka" className="storefront-detail-tabs">
      {sections.map((section) => {
        const active = section.id === activeId;
        return wrapCanvasElement(
          `product-secondary-tab-${section.id}`,
          `Povezava ${section.title}`,
          <a
            key={section.id}
            href={`#${idPrefix}-${section.id}`}
            aria-current={active ? 'location' : undefined}
            data-active={active}
            onClick={() => onSelect(section.id)}
            className="storefront-detail-tab"
          >
            {section.title}
          </a>,
          'inline-flex min-w-0'
        );
      })}
    </nav>
  );
  return wrapCanvasElement(
    'product-secondary-tabs',
    'Povezave podrobnosti',
    anchors,
    'block min-w-0'
  );
}

function DetailLayout({
  sections,
  layout,
  desktop,
  forceVisible = false,
  combinedOverviewLabel,
  wrapCanvasElement
}: {
  sections: DetailContentSection[];
  layout: ProductSecondaryLayout;
  desktop: boolean;
  forceVisible?: boolean;
  combinedOverviewLabel: string;
  wrapCanvasElement: ProductCanvasWrapper;
}) {
  const { secondaryContent } = useProductAppearance();
  const [activeTab, setActiveTab] = useState(sections[0]?.id ?? '');
  const [openSections, setOpenSections] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(sections.map((section) => [section.id, section.openByDefault]))
  );
  const responsiveClass = forceVisible
    ? 'block'
    : desktop
      ? 'hidden lg:block'
      : 'lg:hidden';
  const previewResponsiveClass = desktop
    ? 'storefront-detail-layout-desktop'
    : 'storefront-detail-layout-mobile';
  const layoutClassName = `${responsiveClass} ${previewResponsiveClass}`;

  useEffect(() => {
    if (!sections.some((section) => section.id === activeTab)) {
      setActiveTab(sections[0]?.id ?? '');
    }
  }, [activeTab, sections]);

  if (layout === 'tabs') {
    const selected = sections.find((section) => section.id === activeTab) ?? sections[0];
    return (
      <div className={layoutClassName}>
        <DetailSectionNavigation
          sections={sections}
          activeId={selected?.id ?? ''}
          onSelect={setActiveTab}
          desktop={desktop}
          mode="tabs"
          wrapCanvasElement={wrapCanvasElement}
        />
        {selected
          ? (
              selected.canvasElementId
                ? wrapCanvasElement(
                    selected.canvasElementId,
                    selected.title,
                    <section
                      id={`product-detail-${desktop ? 'desktop' : 'mobile'}-${selected.id}-panel`}
                      role="tabpanel"
                      aria-labelledby={`product-detail-${desktop ? 'desktop' : 'mobile'}-${selected.id}-tab`}
                      className="site-panel mt-3 p-4 sm:p-5"
                    >
                      {selected.content}
                    </section>
                  )
                : (
                    <section
                      id={`product-detail-${desktop ? 'desktop' : 'mobile'}-${selected.id}-panel`}
                      role="tabpanel"
                      aria-labelledby={`product-detail-${desktop ? 'desktop' : 'mobile'}-${selected.id}-tab`}
                      className="site-panel mt-3 p-4 sm:p-5"
                    >
                      {selected.content}
                    </section>
                  )
            )
          : null}
      </div>
    );
  }

  if (layout === 'accordions') {
    return (
      <div className={layoutClassName}>
        {sections.map((section) => {
          const isOpen = Boolean(openSections[section.id]);
          const sectionNode = (
            <section
              key={section.id}
              className="border-t border-[color:var(--site-divider-color)] py-1 first:border-t-0"
            >
              <button
                type="button"
                onClick={() =>
                  setOpenSections((previous) => ({
                    ...previous,
                    [section.id]: !previous[section.id]
                  }))
                }
                className="flex w-full items-center justify-between gap-4 py-4 text-left"
                aria-expanded={isOpen}
              >
                <span className="text-lg font-semibold text-[color:var(--site-color-text)]">
                  {section.title}
                </span>
                <span
                  aria-hidden="true"
                  className={`text-xl transition ${isOpen ? 'rotate-45' : ''}`}
                >
                  +
                </span>
              </button>
              {isOpen ? <div className="pb-6">{section.content}</div> : null}
            </section>
          );
          return section.canvasElementId
            ? wrapCanvasElement(
                section.canvasElementId,
                section.title,
                sectionNode
              )
            : sectionNode;
        })}
      </div>
    );
  }

  const stackedGroups = buildStackedGroups(
    sections,
    combinedOverviewLabel
  );
  const selectedGroup = stackedGroups.find(
    (group) => group.id === activeTab
  ) ?? stackedGroups[0];

  return (
    <div
      className={`${layoutClassName} storefront-detail-stacked-shell`}
      data-tab-divider-visible={secondaryContent.showTabDivider}
    >
      <DetailSectionNavigation
        sections={stackedGroups}
        activeId={selectedGroup?.id ?? ''}
        onSelect={setActiveTab}
        desktop={desktop}
        mode="tabs"
        wrapCanvasElement={wrapCanvasElement}
      />
      <div
        id={`product-detail-${desktop ? 'desktop' : 'mobile'}-${selectedGroup?.id ?? 'overview'}-panel`}
        role="tabpanel"
        aria-labelledby={`product-detail-${desktop ? 'desktop' : 'mobile'}-${selectedGroup?.id ?? 'overview'}-tab`}
        className="site-panel mt-3 p-4 sm:p-5"
      >
        <div
          className="storefront-detail-stacked-grid grid gap-6 lg:grid-cols-2 lg:gap-8"
          data-combined-overview={selectedGroup?.sections.length === 2}
          data-content-divider-visible={secondaryContent.showContentDivider}
        >
          {selectedGroup?.sections.map((section, sectionIndex) => {
            const sectionNode = (
              <section
                key={section.id}
                data-detail-section={section.id}
                data-content-divider={
                  selectedGroup.sections.length === 2 && sectionIndex > 0
                }
                className={
                  selectedGroup.sections.length === 1
                    ? 'lg:col-span-2'
                    : undefined
                }
              >
                {wrapCanvasElement(
                  `product-${section.id}-heading`,
                  `Naslov ${section.title}`,
                  <h2 className="site-heading-3 storefront-detail-section-heading">
                    {section.title}
                  </h2>
                )}
                {wrapCanvasElement(
                  `product-${section.id}-content`,
                  `Vsebina ${section.title}`,
                  <div className="mt-3">{section.content}</div>,
                  'min-w-0'
                )}
              </section>
            );
            return section.canvasElementId
              ? wrapCanvasElement(
                  section.canvasElementId,
                  section.title,
                  sectionNode
                )
              : sectionNode;
          })}
        </div>
      </div>
    </div>
  );
}

function ProductDetailContent({ product, canvasEditor }: ProductDetailViewProps) {
  const appearance = useProductAppearance();
  const responsiveCanvasDevice = useProductCanvasDevice();
  const canvasDevice = canvasEditor?.device ?? responsiveCanvasDevice;
  const canvasActive = appearance.canvas?.mode === 'free';
  const wrapCanvasElement: ProductCanvasWrapper = (
    elementId,
    label,
    children,
    className = ''
  ) => {
    if (!canvasActive && !canvasEditor) return children;
    return (
      <ProductCanvasElement
        key={`${elementId}-${canvasDevice}`}
        elementId={elementId}
        label={label}
        settings={resolveProductCanvasElementDeviceSettings(
          appearance,
          elementId,
          canvasDevice
        )}
        active={canvasActive}
        interactive={Boolean(canvasEditor)}
        selected={canvasEditor?.selectedElementId === elementId}
        forceVisible={PRODUCT_CANVAS_PROTECTED_ELEMENT_IDS.has(elementId)}
        gridSizePx={appearance.canvas.gridSizePx}
        snapToGrid={appearance.canvas.snapToGrid}
        scale={canvasEditor?.scale ?? 1}
        onSelect={canvasEditor?.onSelectElement}
        onChange={canvasEditor?.onElementChange}
        className={className}
      >
        {children}
      </ProductCanvasElement>
    );
  };
  const defaultVariant =
    product.variants.find((variant) => variant.id === product.defaultVariantId) ??
    product.variants[0];
  const [selection, setSelection] = useState<VariantSelection>(() =>
    selectionForVariant(product, defaultVariant)
  );
  const [quantity, setQuantity] = useState(defaultVariant?.minOrder ?? 1);
  const addItem = useCartStore((state) => state.addItem);
  const openDrawer = useCartStore((state) => state.openDrawer);

  const selectionComplete = product.optionAxes.every(
    (axis) => Boolean(selection[axis.id])
  );
  const selectedVariant =
    product.variants.find(
      (variant) =>
        selectionComplete && variantMatchesSelection(variant, product, selection)
    ) ??
    (product.optionAxes.length === 0 ? defaultVariant : null);

  const visibleMedia = useMemo(() => {
    if (!selectedVariant) {
      return product.media.filter((entry) => entry.variantIds.length === 0);
    }
    const variantMedia = product.media.filter((entry) =>
      entry.variantIds.includes(selectedVariant.id)
    );
    const parentMedia = product.media.filter((entry) => entry.variantIds.length === 0);
    return [...variantMedia, ...parentMedia].filter((entry, index, all) => {
      const mediaKey = `${entry.kind}:${entry.url}`;
      return (
        all.findIndex(
          (candidate) => `${candidate.kind}:${candidate.url}` === mediaKey
        ) === index
      );
    });
  }, [product.media, selectedVariant]);

  const specifications = mergeStorefrontSpecifications(
    mergeStorefrontSpecifications(
      product.specifications,
      selectedVariant?.specifications ?? []
    ),
    selectedVariant?.sku
      ? [
          {
            id: `variant-${selectedVariant.id}-sku`,
            label: 'SKU',
            value: selectedVariant.sku
          }
        ]
      : []
  );
  const includedItems =
    selectedVariant?.includedItems.length
      ? selectedVariant.includedItems
      : product.includedItems;
  const documents =
    selectedVariant?.documents.length
      ? selectedVariant.documents
      : product.documents.filter(
          (document) =>
            document.variantIds.length === 0 ||
            document.variantIds.includes(selectedVariant?.id ?? '')
        );
  const displayTitle = product.name;
  const shortDescription =
    selectedVariant?.description || product.shortDescription;
  const normalizeComparisonText = (value: string) =>
    value
      .replace(/<[^>]*>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .toLocaleLowerCase('sl');
  const showShortDescription =
    typeof shortDescription === 'string' &&
    shortDescription.trim().length > 0 &&
    normalizeComparisonText(shortDescription) !==
      normalizeComparisonText(displayTitle);

  const changeOption = (axisId: string, valueId: string) => {
    const nextSelection = { ...selection, [axisId]: valueId };
    let candidateVariants = product.variants.filter(
      (variant) =>
        variant.status === 'active' && variant.optionValueIds.includes(valueId)
    );

    for (const axis of product.optionAxes) {
      if (axis.id === axisId) continue;
      const selectedValue = nextSelection[axis.id];
      if (
        selectedValue &&
        !candidateVariants.some((variant) =>
          variant.optionValueIds.includes(selectedValue)
        )
      ) {
        delete nextSelection[axis.id];
      } else if (selectedValue) {
        candidateVariants = candidateVariants.filter((variant) =>
          variant.optionValueIds.includes(selectedValue)
        );
      }
    }

    const nextComplete = product.optionAxes.every(
      (axis) => Boolean(nextSelection[axis.id])
    );
    const nextVariant = nextComplete
      ? product.variants.find((variant) =>
          variantMatchesSelection(variant, product, nextSelection)
        )
      : undefined;

    setSelection(nextSelection);
    setQuantity(nextVariant?.minOrder ?? 1);
  };

  const renderInformationBlock = (
    block: ProductInformationBlock
  ): ReactNode => {
    if (block === 'brand') {
      return appearance.information.showBrand && product.brand ? (
        <p className="mt-2 text-sm font-semibold text-[color:var(--site-color-text-muted)]">
          {product.brand}
        </p>
      ) : null;
    }
    if (block === 'title') {
      return (
        <h1 className="site-heading-1 storefront-product-title mt-2 leading-[1.05] tracking-[-0.025em] text-[color:var(--site-color-text)]">
          {displayTitle}
        </h1>
      );
    }
    if (block === 'badge') {
      return appearance.information.showBadge && product.badge ? (
        <div className="mt-3">
          <span className="site-radius-pill inline-flex bg-[color:var(--site-color-primary)] px-2.5 py-1 text-xs font-semibold text-[color:var(--site-color-primary-foreground)]">
            {product.badge}
          </span>
        </div>
      ) : null;
    }
    if (block === 'sku') {
      return appearance.information.showSku && selectedVariant ? (
        <p className="mt-3 font-mono text-xs text-[color:var(--site-color-text-muted)]">
          SKU: {selectedVariant.sku}
        </p>
      ) : null;
    }
    if (block === 'shortDescription') {
      return appearance.information.showShortDescription &&
        showShortDescription ? (
        <p className="site-paragraph storefront-product-short-description mt-4">
          {shortDescription}
        </p>
      ) : null;
    }
    if (block === 'keyAttributes') {
      return appearance.information.showKeyAttributes &&
        selectedVariant &&
        Object.keys(selectedVariant.attributes).length > 0 ? (
        <dl className="mt-5 grid gap-2 text-sm sm:grid-cols-2">
          {Object.entries(selectedVariant.attributes)
            .slice(0, 6)
            .map(([label, value]) => (
              <div
                key={label}
                className="site-radius-sm bg-[color:var(--site-color-surface-muted)] px-3 py-2"
              >
                <dt className="text-xs text-[color:var(--site-color-text-muted)]">
                  {label}
                </dt>
                <dd className="font-semibold text-[color:var(--site-color-text)]">
                  {value}
                </dd>
              </div>
            ))}
        </dl>
      ) : null;
    }
    if (block === 'variants') {
      return (
        <VariantSelector
          axes={product.optionAxes}
          variants={product.variants}
          selection={selection}
          onChange={changeOption}
          canvasDevice={canvasDevice}
          canvasWrapper={canvasEditor ? wrapCanvasElement : undefined}
          className="mt-5"
        />
      );
    }
    return null;
  };

  const addSelectedVariant = () => {
    if (canvasEditor) return;
    if (!selectedVariant || !isStorefrontVariantPurchasable(selectedVariant)) return;
    const image = visibleMedia.find((entry) => entry.kind === 'image');
    addItem({
      ...buildProductCartItem({
        productId: product.id,
        productSlug: product.slug,
        productHref: product.href,
        productName: product.name,
        category: product.breadcrumbs.at(-2)?.label,
        image,
        variant: selectedVariant,
        options: buildCartOptionSelections(product.optionAxes, selection)
      }),
      quantity
    });
    openDrawer();
  };

  const mobileCanPurchase = isStorefrontVariantPurchasable(selectedVariant);
  const mobileHasAction = Boolean(selectionComplete && selectedVariant);
  const longDescription =
    selectedVariant?.description ?? product.description ?? product.shortDescription;
  const longDescriptionHtml = selectedVariant?.description
    ? selectedVariant.descriptionHtml
    : product.descriptionHtml;
  const detailSections = appearance.secondaryContent.blockOrder.flatMap(
    (block): DetailContentSection[] => {
      const openByDefault =
        appearance.secondaryContent.openByDefault.includes(block);

      if (block === 'specifications') {
        return [
          {
            id: block,
            title: appearance.secondaryContent.sectionLabels.specifications,
            openByDefault,
            canvasElementId: 'product-specifications',
            content: <SpecificationTable specifications={specifications} />
          }
        ];
      }
      if (block === 'description' && longDescription) {
        return [
          {
            id: block,
            title: appearance.secondaryContent.sectionLabels.description,
            openByDefault,
            canvasElementId: 'product-description',
            content: (
              <div
                className={`site-prose storefront-rich-text ${longDescriptionHtml ? '' : 'whitespace-pre-line'}`}
                style={{ maxWidth: 'var(--product-description-max-width, 880px)' }}
                {...(longDescriptionHtml
                  ? { dangerouslySetInnerHTML: { __html: longDescriptionHtml } }
                  : { children: longDescription })}
              />
            )
          }
        ];
      }
      if (block === 'includedItems' && includedItems.length > 0) {
        return [
          {
            id: block,
            title: appearance.secondaryContent.sectionLabels.includedItems,
            openByDefault,
            content: (
              <ul className="list-disc space-y-2 pl-5 text-[color:var(--site-color-text-muted)]">
                {includedItems.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            )
          }
        ];
      }
      if (block === 'documents' && documents.length > 0) {
        return [
          {
            id: block,
            title: appearance.secondaryContent.sectionLabels.documents,
            openByDefault,
            content: (
              <ul
                className={
                  appearance.secondaryContent.documentsAsCards
                    ? 'grid gap-3 sm:grid-cols-2'
                    : 'divide-y divide-[color:var(--site-divider-color)] border-y border-[color:var(--site-divider-color)]'
                }
              >
                {documents.map((document) => (
                  <li key={document.id}>
                    <a
                      href={document.url}
                      target="_blank"
                      rel="noreferrer"
                      className={`flex items-center gap-3 text-sm font-semibold text-[color:var(--site-color-text)] transition hover:text-[color:var(--site-color-primary)] ${
                        appearance.secondaryContent.documentsAsCards
                          ? 'site-panel p-4 hover:border-[color:var(--site-color-primary)]'
                          : 'px-1 py-4'
                      }`}
                    >
                      <span
                        aria-hidden="true"
                        className="text-xl text-[color:var(--site-color-primary)]"
                      >
                        ↓
                      </span>
                      {document.name}
                    </a>
                  </li>
                ))}
              </ul>
            )
          }
        ];
      }
      if (
        block === 'relatedProducts' &&
        (appearance.relatedProducts.enabled || Boolean(canvasEditor)) &&
        (product.relatedProducts.length > 0 || Boolean(canvasEditor))
      ) {
        const visibleRelatedProducts = product.relatedProducts
          .slice(0, appearance.relatedProducts.maxItems);
        return [
          {
            id: block,
            title: appearance.secondaryContent.sectionLabels.relatedProducts,
            openByDefault,
            content: (
              visibleRelatedProducts.length > 0 ? (
                <div className="storefront-related-product-grid">
                  {visibleRelatedProducts.map((related) => (
                    <ProductCard
                      key={related.id}
                      product={related}
                      presentation="related"
                      canvasWrapper={canvasEditor ? wrapCanvasElement : undefined}
                    />
                  ))}
                </div>
              ) : (
                <div className="site-panel border-dashed px-4 py-8 text-center text-sm text-[color:var(--site-color-text-muted)]">
                  Izberite ročne izdelke ali vključite samodejni izbor.
                </div>
              )
            )
          }
        ];
      }
      return [];
    }
  );
  const primaryDetailSections: DetailContentSection[] = [
    ...detailSections.filter((section) => section.id !== 'relatedProducts'),
    {
      id: 'delivery-and-payment',
      title: 'Dostava in plačilo',
      openByDefault: false,
      content: (
        <dl className="storefront-detail-delivery-list grid gap-4 text-sm sm:grid-cols-2">
          <div>
            <dt className="font-semibold text-[color:var(--site-color-text)]">
              Dostava
            </dt>
            <dd className="mt-1 text-[color:var(--site-color-text-muted)]">
              {appearance.purchaseArea.copy.freeShippingMessage ? (
                <span className="block font-semibold text-[color:var(--site-color-success)]">
                  {appearance.purchaseArea.copy.freeShippingMessage}
                </span>
              ) : null}
              {selectedVariant?.deliveryEstimate ??
                product.deliveryEstimate ??
                appearance.purchaseArea.copy.deliveryFallbackMessage}
            </dd>
          </div>
          <div>
            <dt className="font-semibold text-[color:var(--site-color-text)]">
              Plačilo
            </dt>
            <dd className="mt-1 text-[color:var(--site-color-text-muted)]">
              {appearance.purchaseArea.copy.paymentMessage}
            </dd>
          </div>
        </dl>
      )
    }
  ];
  const relatedProductsSection = detailSections.find(
    (section) => section.id === 'relatedProducts'
  );
  const relatedProductsNode = relatedProductsSection
    ? wrapCanvasElement(
        'product-related-products',
        'Sorodni izdelki',
        <section
          className="storefront-related-products-section mt-6"
          aria-labelledby="related-products-title"
        >
          {wrapCanvasElement(
            'product-related-title',
            'Naslov sorodnih izdelkov',
            <h2 id="related-products-title" className="site-heading-2 mb-4">
              {relatedProductsSection.title}
            </h2>
          )}
          {wrapCanvasElement(
            'product-related-grid',
            'Mreža sorodnih izdelkov',
            relatedProductsSection.content,
            'min-w-0'
          )}
        </section>
      )
    : null;

  return (
    <div
      data-product-preview-device={canvasEditor?.device}
      className={`container-base site-section storefront-product-page ${
        appearance.productPage.stickyPurchaseMobile && mobileHasAction
          ? 'pb-28 lg:pb-[var(--site-section-space-current)]'
          : ''
      }`}
      onClickCapture={(event) => {
        if (
          canvasEditor
          && event.target instanceof Element
          && event.target.closest('a')
        ) {
          event.preventDefault();
        }
      }}
    >
      {appearance.productPage.showBreadcrumbs
        ? wrapCanvasElement(
            'product-breadcrumbs',
            'Drobtinice',
            <Breadcrumbs product={product} />
          )
        : null}

      <div className="storefront-product-detail-grid">
        {wrapCanvasElement(
          'product-gallery',
          'Galerija',
          <div className="min-w-0">
            <ProductGallery
              media={visibleMedia}
              productName={displayTitle}
              previewDevice={canvasEditor?.device}
              canvasWrapper={
                canvasActive || canvasEditor ? wrapCanvasElement : undefined
              }
            />
          </div>,
          'min-w-0'
        )}

        {wrapCanvasElement(
          'product-information',
          'Informacije',
          <div className="storefront-product-information min-w-0">
            {canvasActive ? (
              appearance.information.showCategory ||
              (
                appearance.productPage.informationOrder.includes('brand') &&
                appearance.information.showBrand &&
                product.brand
              ) ? (
                wrapCanvasElement(
                  'product-category',
                  'Kategorija in znamka',
                  <div>
                    {appearance.information.showCategory ? (
                      <p className="site-eyebrow">
                        {product.breadcrumbs.at(-2)?.label}
                      </p>
                    ) : null}
                    {appearance.productPage.informationOrder.includes('brand') &&
                    appearance.information.showBrand &&
                    product.brand ? (
                      <p className="mt-2 text-sm font-semibold text-[color:var(--site-color-text-muted)]">
                        {product.brand}
                      </p>
                    ) : null}
                  </div>
                )
              ) : null
            ) : appearance.information.showCategory ? (
              <p className="site-eyebrow">
                {product.breadcrumbs.at(-2)?.label}
              </p>
            ) : null}
            {appearance.productPage.informationOrder.map((block) => {
              if (canvasActive && block === 'brand') return null;
              const content = renderInformationBlock(block);
              if (!content) return null;
              const node = <div key={block}>{content}</div>;
              if (block === 'brand') return node;
              const definition = informationCanvasElement[block];
              return wrapCanvasElement(
                definition.id,
                definition.label,
                node
              );
            })}
          </div>,
          'min-w-0'
        )}

        {wrapCanvasElement(
          'product-purchase',
          'Nakupno obmoÄje',
          <PurchasePanel
            variant={selectedVariant}
            selectionComplete={selectionComplete}
            quantity={quantity}
            onQuantityChange={setQuantity}
            onAdd={addSelectedVariant}
            deliveryEstimate={product.deliveryEstimate}
            canvasDevice={canvasDevice}
            canvasWrapper={canvasEditor ? wrapCanvasElement : undefined}
            className={
              appearance.productPage.stickyPurchaseDesktop
                ? 'lg:sticky lg:top-8'
                : undefined
            }
          />
        )}
      </div>

      {appearance.relatedProducts.sectionPlacement === 'before-content'
        ? relatedProductsNode
        : null}

      {primaryDetailSections.length > 0
        ? wrapCanvasElement(
            'product-secondary',
            'Dodatna vsebina',
            <div className="storefront-product-secondary mt-6">
              {canvasEditor ? (
                <DetailLayout
                  sections={primaryDetailSections}
                  layout={
                    canvasEditor.device === 'desktop'
                      ? appearance.secondaryContent.desktopLayout
                      : appearance.secondaryContent.mobileLayout
                  }
                  desktop={canvasEditor.device === 'desktop'}
                  forceVisible
                  combinedOverviewLabel={
                    appearance.secondaryContent.combinedOverviewLabel
                  }
                  wrapCanvasElement={wrapCanvasElement}
                />
              ) : (
                <>
                  <DetailLayout
                    sections={primaryDetailSections}
                    layout={appearance.secondaryContent.desktopLayout}
                    desktop
                    combinedOverviewLabel={
                      appearance.secondaryContent.combinedOverviewLabel
                    }
                    wrapCanvasElement={wrapCanvasElement}
                  />
                  <DetailLayout
                    sections={primaryDetailSections}
                    layout={appearance.secondaryContent.mobileLayout}
                    desktop={false}
                    combinedOverviewLabel={
                      appearance.secondaryContent.combinedOverviewLabel
                    }
                    wrapCanvasElement={wrapCanvasElement}
                  />
                </>
              )}
            </div>
          )
        : null}

      {appearance.relatedProducts.sectionPlacement === 'after-content'
        ? relatedProductsNode
        : null}

      {!canvasEditor && appearance.productPage.stickyPurchaseMobile && mobileHasAction ? (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-[color:var(--site-divider-color)] bg-[color:var(--site-color-surface)] p-3 shadow-[0_-8px_24px_rgba(15,23,42,0.1)] lg:hidden">
          <div className="mx-auto flex max-w-3xl items-center gap-3">
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs text-[color:var(--site-color-text-muted)]">
                {selectedVariant?.name}
              </p>
              <p className="font-semibold text-[color:var(--site-color-text)]">
                {selectedVariant
                  ? new Intl.NumberFormat('sl-SI', {
                      style: 'currency',
                      currency: 'EUR'
                    }).format(selectedVariant.unitNet * (1 + selectedVariant.taxRate))
                  : '—'}
              </p>
            </div>
            <button
              type="button"
              onClick={addSelectedVariant}
              disabled={!mobileCanPurchase}
              className="site-button site-button--primary inline-flex items-center justify-center disabled:cursor-not-allowed disabled:opacity-50"
            >
              {mobileCanPurchase
                ? appearance.purchaseArea.copy.addToCartActionLabel
                : appearance.purchaseArea.copy.unavailableActionLabel}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default function ProductDetailView(props: ProductDetailViewProps) {
  const globalAppearance = useProductAppearance();
  const appearance = useMemo(
    () =>
      resolveProductAppearanceConfig(
        globalAppearance,
        props.product.appearanceOverride
      ),
    [globalAppearance, props.product.appearanceOverride]
  );
  const appearanceVariables = toProductAppearanceCssVariables(
    appearance,
    toCommercialStorefrontLogicalPx(1)
  ) as CSSProperties;

  return (
    <ProductAppearanceProvider config={appearance}>
      <div style={appearanceVariables}>
        <ProductDetailContent {...props} />
      </div>
    </ProductAppearanceProvider>
  );
}
