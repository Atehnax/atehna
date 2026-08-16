'use client';

import type { ReactNode } from 'react';
import type {
  StorefrontOptionAxis,
  StorefrontOptionValue,
  StorefrontVariant
} from '@/commercial/features/products/storefrontProduct';
import { useProductAppearance } from '@/commercial/components/ProductAppearanceProvider';
import {
  buildDimensionalVariantSelectorModel,
  type DimensionalVariantGroup
} from '@/commercial/features/products/dimensionalVariants';
import {
  resolveProductCanvasElementDeviceSettings,
  type ProductCanvasDevice
} from '@/shared/domain/style/productAppearance';
import ProductCanvasElement from '@/shared/ui/product-canvas/ProductCanvasElement';

export type VariantSelection = Record<string, string>;

type VariantSelectorProps = {
  axes: StorefrontOptionAxis[];
  variants: StorefrontVariant[];
  selection: VariantSelection;
  onChange: (axisId: string, valueId: string) => void;
  canvasDevice?: ProductCanvasDevice;
  canvasWrapper?: (
    elementId: string,
    label: string,
    children: ReactNode,
    className?: string
  ) => ReactNode;
  className?: string;
};

const variantMatchesSelection = (
  variant: StorefrontVariant,
  axes: StorefrontOptionAxis[],
  selection: VariantSelection,
  candidateAxisId?: string,
  candidateValueId?: string
) =>
  axes.every((axis) => {
    const selectedValueId =
      axis.id === candidateAxisId ? candidateValueId : selection[axis.id];
    return !selectedValueId || variant.optionValueIds.includes(selectedValueId);
  });

const isPurchasable = (variant: StorefrontVariant) =>
  variant.commerceId !== null &&
  variant.status === 'active' &&
  (variant.inventory === null || variant.inventory >= variant.minOrder);

const optionAvailability = (
  option: StorefrontOptionValue,
  axis: StorefrontOptionAxis,
  axes: StorefrontOptionAxis[],
  variants: StorefrontVariant[],
  selection: VariantSelection
) => {
  const matchingVariants = variants.filter((variant) =>
    variantMatchesSelection(variant, axes, selection, axis.id, option.id)
  );
  const globalVariants = variants.filter((variant) =>
    variant.optionValueIds.includes(option.id)
  );
  return {
    exists: globalVariants.length > 0,
    compatible: matchingVariants.length > 0,
    compatiblePurchasable: matchingVariants.some(isPurchasable)
  };
};

export default function VariantSelector({
  axes,
  variants,
  selection,
  onChange,
  canvasDevice = 'desktop',
  canvasWrapper,
  className
}: VariantSelectorProps) {
  const appearance = useProductAppearance();
  const canvasActive = appearance.canvas?.mode === 'free';
  const localCanvasWrapper = (
    elementId: string,
    label: string,
    children: ReactNode,
    elementClassName = ''
  ) => {
    if (!canvasActive) return children;
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
        active
        className={elementClassName}
      >
        {children}
      </ProductCanvasElement>
    );
  };
  const wrapCanvasElement = canvasWrapper ?? localCanvasWrapper;
  if (axes.length === 0) return null;
  const publicVariants = variants.filter((variant) => variant.status === 'active');
  const dimensionalModel = buildDimensionalVariantSelectorModel(
    axes,
    publicVariants
  );

  if (dimensionalModel) {
    const { axis, groups } = dimensionalModel;
    const selectedAxisValueId = selection[axis.id];
    const selectedChoice = groups
      .flatMap((group) => group.choices)
      .find((choice) => choice.axisValueId === selectedAxisValueId);
    const selectedGroup = selectedChoice
      ? groups.find((group) => group.thickness === selectedChoice.thickness)
      : undefined;
    const selectThickness = (group: DimensionalVariantGroup) => {
      const sameSize = selectedChoice
        ? group.choices.find(
            (choice) =>
              choice.length === selectedChoice.length &&
              choice.width === selectedChoice.width
          )
        : undefined;
      const nextChoice =
        (sameSize && isPurchasable(sameSize.variant) ? sameSize : undefined) ??
        group.choices.find((choice) => isPurchasable(choice.variant)) ??
        sameSize ??
        group.choices[0];
      if (nextChoice) onChange(axis.id, nextChoice.axisValueId);
    };

    return (
      <div
        className={`storefront-product-variant-selector storefront-dimensional-variant-selector space-y-3 ${
          className ?? ''
        }`.trim()}
      >
        {wrapCanvasElement(
          'product-variant-thickness',
          'Debelina',
          <fieldset>
            <legend
              className={`storefront-variant-selector-label text-sm font-semibold text-[color:var(--site-color-text)] ${
                appearance.variants.labelAboveSelector
                  ? ''
                  : 'storefront-variant-selector-label--compact'
              }`}
            >
              Debelina
              {selectedGroup && appearance.variants.showSelectedSummary ? (
                <span className="ml-2 font-normal text-[color:var(--site-color-text-muted)]">
                  {selectedGroup.thicknessLabel}
                </span>
              ) : null}
            </legend>
            {wrapCanvasElement(
              'product-variant-thickness-options',
              'Gumbi debeline',
              <div className="flex flex-wrap gap-2">
                {groups.map((group) => {
                  const selected = group.thickness === selectedGroup?.thickness;
                  const groupPurchasable = group.choices.some((choice) =>
                    isPurchasable(choice.variant)
                  );
                  return (
                    <button
                      key={group.thickness}
                      type="button"
                      onClick={() => selectThickness(group)}
                      aria-pressed={selected}
                      title={
                        groupPurchasable
                          ? undefined
                          : `${group.thicknessLabel} trenutno ni na zalogi.`
                      }
                      className={`site-radius-md storefront-variant-chip inline-flex items-center justify-center border text-sm font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--site-field-focus)] ${
                        appearance.variants.compactSelectors
                          ? 'min-h-9 px-3 py-1.5'
                          : 'min-h-11 px-4 py-2'
                      } ${
                        selected
                          ? 'border-[color:var(--site-color-primary)] bg-[color:var(--blue-50)] text-[color:var(--site-color-primary)]'
                          : groupPurchasable
                            ? 'border-[color:var(--site-border-color)] bg-[color:var(--site-color-surface)] text-[color:var(--site-color-text)] hover:border-[color:var(--site-color-primary)]'
                            : 'border-[color:var(--site-color-warning)] bg-[color:var(--site-color-surface-muted)] text-[color:var(--site-color-text-muted)]'
                      }`}
                    >
                      {group.thicknessLabel}
                    </button>
                  );
                })}
              </div>
            )}
          </fieldset>
        )}

        {selectedGroup ? (
          wrapCanvasElement(
            'product-variant-dimensions',
            'Dimenzije',
            <fieldset className="storefront-dimensional-size-selector">
              <legend
                className={`storefront-variant-selector-label text-sm font-semibold text-[color:var(--site-color-text)] ${
                  appearance.variants.labelAboveSelector
                    ? ''
                    : 'storefront-variant-selector-label--compact'
                }`}
              >
                Dimenzije
                {selectedChoice && appearance.variants.showSelectedSummary ? (
                  <span className="ml-2 font-normal text-[color:var(--site-color-text-muted)]">
                    {selectedChoice.sizeLabel}
                  </span>
                ) : null}
              </legend>
              {wrapCanvasElement(
                'product-variant-dimensions-control',
                'Izbirnik dimenzij',
                <select
                  className="site-field storefront-variant-select w-full"
                  value={selectedChoice?.axisValueId ?? ''}
                  onChange={(event) => onChange(axis.id, event.target.value)}
                  aria-label="Dimenzije"
                >
                  <option value="">Izberite dolžino in širino</option>
                  {selectedGroup.choices.map((choice) => (
                    <option key={choice.axisValueId} value={choice.axisValueId}>
                      {choice.sizeLabel}
                      {!isPurchasable(choice.variant)
                        ? ' – trenutno ni na zalogi'
                        : ''}
                    </option>
                  ))}
                </select>,
                'storefront-variant-control-canvas'
              )}
            </fieldset>
          )
        ) : (
          <p className="text-sm text-[color:var(--site-color-text-muted)]">
            Najprej izberite debelino.
          </p>
        )}
      </div>
    );
  }

  return (
    <div
      className={`storefront-product-variant-selector space-y-3 ${
        className ?? ''
      }`.trim()}
    >
      {axes.map((axis, axisIndex) => {
        const selectedValue = axis.values.find(
          (value) => value.id === selection[axis.id]
        );
        const useSelect =
          appearance.variants.selectorStyle === 'select' ||
          (appearance.variants.selectorStyle === 'auto' &&
            (axis.values.length > 8 ||
              axis.values.some((value) => value.label.length > 28)));

        const axisCanvasId = `product-variant-axis-${axisIndex + 1}`;
        const controlCanvasId = `${axisCanvasId}-control`;

        return wrapCanvasElement(
          axisCanvasId,
          axis.name,
          <fieldset key={axis.id}>
            <legend
              className={`storefront-variant-selector-label text-sm font-semibold text-[color:var(--site-color-text)] ${
                appearance.variants.labelAboveSelector
                  ? ''
                  : 'storefront-variant-selector-label--compact'
              }`}
            >
              {axis.name}
              {selectedValue && appearance.variants.showSelectedSummary ? (
                <span className="ml-2 font-normal text-[color:var(--site-color-text-muted)]">
                  {selectedValue.label}
                </span>
              ) : null}
            </legend>

            {wrapCanvasElement(
              controlCanvasId,
              `Izbirnik: ${axis.name}`,
              useSelect ? (
              <select
                className="site-field storefront-variant-select w-full"
                value={selectedValue?.id ?? ''}
                onChange={(event) => onChange(axis.id, event.target.value)}
                aria-label={axis.name}
              >
                <option value="">Izberite možnost</option>
                {axis.values.map((option) => {
                  const availability = optionAvailability(
                    option,
                    axis,
                    axes,
                    publicVariants,
                    selection
                  );
                  return (
                    <option
                      key={option.id}
                      value={option.id}
                      disabled={!availability.exists}
                    >
                      {option.label}
                      {!availability.exists
                        ? ' – ni na voljo'
                        : !availability.compatible
                          ? ' – spremeni druge možnosti'
                          : ''}
                      {availability.compatible &&
                      !availability.compatiblePurchasable
                        ? ' – trenutno ni na zalogi'
                        : ''}
                    </option>
                  );
                })}
              </select>
            ) : (
              <div className="flex flex-wrap gap-2">
                {axis.values.map((option) => {
                  const availability = optionAvailability(
                    option,
                    axis,
                    axes,
                    publicVariants,
                    selection
                  );
                  const selected = selectedValue?.id === option.id;
                  const unavailable = !availability.exists;
                  const incompatible =
                    availability.exists && !availability.compatible;
                  const outOfStock =
                    availability.compatible &&
                    !availability.compatiblePurchasable;

                  return (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => {
                        if (!unavailable) onChange(axis.id, option.id);
                      }}
                      aria-pressed={selected}
                      aria-disabled={unavailable}
                      title={
                        unavailable
                          ? `${option.label} trenutno ni na voljo.`
                          : incompatible &&
                              appearance.variants.showCompatibilityReasons
                            ? 'Z izbiro se bodo nezdružljive možnosti ponastavile.'
                          : undefined
                      }
                      className={`site-radius-md storefront-variant-option relative inline-flex items-center justify-center gap-2 border text-sm font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--site-field-focus)] ${
                        appearance.variants.compactSelectors
                          ? 'min-h-9 px-2.5 py-1.5'
                          : 'min-h-11 px-3 py-2'
                      } ${
                        selected
                          ? 'border-[color:var(--site-color-primary)] bg-[color:var(--blue-50)] text-[color:var(--site-color-primary)]'
                          : incompatible
                            ? 'border-dashed border-[color:var(--site-color-warning)] bg-[color:var(--site-color-surface)] text-[color:var(--site-color-text)]'
                            : outOfStock
                              ? 'border-[color:var(--site-color-warning)] bg-[color:var(--site-color-surface-muted)] text-[color:var(--site-color-text-muted)]'
                              : 'border-[color:var(--site-border-color)] bg-[color:var(--site-color-surface)] text-[color:var(--site-color-text)] hover:border-[color:var(--site-color-primary)]'
                      } ${
                        unavailable
                          ? 'cursor-not-allowed opacity-50'
                          : 'cursor-pointer'
                      }`}
                    >
                      {option.swatch &&
                      appearance.variants.selectorStyle !== 'chips' ? (
                        <span
                          className="h-4 w-4 rounded-full border border-black/10"
                          style={{ backgroundColor: option.swatch }}
                          aria-hidden="true"
                        />
                      ) : null}
                      <span
                        className={
                          unavailable || outOfStock ? 'line-through' : undefined
                        }
                      >
                        {option.label}
                      </span>
                      {selected ? (
                        <svg
                          aria-hidden="true"
                          viewBox="0 0 20 20"
                          className="h-4 w-4"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                        >
                          <path d="m5 10 3 3 7-7" />
                        </svg>
                      ) : null}
                    </button>
                  );
                })}
              </div>
              ),
              'storefront-variant-control-canvas'
            )}
          </fieldset>
        );
      })}
    </div>
  );
}
