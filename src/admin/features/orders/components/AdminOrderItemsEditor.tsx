'use client';

import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent
} from 'react';
import { AdminCheckbox } from '@/shared/ui/checkbox';
import { AdminSearchInput } from '@/shared/ui/admin-search-input';
import {
  adminCardSectionEditIconButtonClassName,
  adminTableInlineActionRowClassName,
  adminTableInlineCancelButtonClassName,
  adminTableInlineCancelIconClassName,
  adminTableInlineConfirmButtonClassName,
  adminTableInlineConfirmIconClassName,
  adminTableInlineEditInputClassName,
  adminTableNeutralIconButtonClassName,
  adminTableSearchIconClassName,
  adminTableSearchInputClassName,
  adminTableSearchWrapperClassName,
  adminTableSelectedDangerIconButtonClassName,
  adminWindowCardClassName,
  adminWindowCardStyle
} from '@/shared/ui/admin-table';
import { IconButton } from '@/shared/ui/icon-button';
import {
  ApplyToAllIcon,
  CheckIcon,
  CloseIcon,
  PencilIcon,
  PlusIcon,
  TrashCanIcon
} from '@/shared/ui/icons/AdminActionIcons';
import { adminTableRowToneClasses } from '@/shared/ui/theme/tokens';
import { useToast } from '@/shared/ui/toast';
import { useDropdownDismiss } from '@/shared/ui/dropdown/use-dropdown-dismiss';
import { formatEuro } from '@/shared/domain/formatting';
import type { OrderItemInput } from '@/shared/domain/order/orderTypes';

type CatalogChoice = {
  catalogItemId: number;
  catalogVariantId: number;
  sku: string;
  name: string;
  unit: string;
  unitPrice: number;
  discountPercentage: number;
};

type EditableItem = {
  id: string;
  persistedId?: number;
  sku: string;
  name: string;
  unit: string;
  quantity: number;
  unitPrice: number;
  discountPercentage: number;
  catalogItemId?: number | null;
  catalogVariantId?: number | null;
  shipLater: boolean;
};

export type OrderDeliveryPlanSnapshot = {
  shipLaterItemIds: number[];
  currentItemCount: number;
  laterItemCount: number;
};

export type OrderItemsSaveOptions = {
  deliveryPlanPersistence?: 'immediate' | 'status' | 'after-page-save';
};

export type OrderItemsSaveResult = {
  ok: boolean;
  persistDeferredDeliveryPlan?: () => Promise<void>;
  commitDeferredDeliveryPlan?: () => void;
};

export type OrderItemsSaveHandler = (
  options?: OrderItemsSaveOptions
) => Promise<OrderItemsSaveResult>;

type ItemsSectionMode = 'read' | 'edit';

const TAX_RATE = 0.22;
const toMoney = (value: number) => Math.round(value * 100) / 100;
const decimalFormatter = new Intl.NumberFormat('sl-SI', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const formatCurrency = formatEuro;

const parseLocaleNumber = (value: string) => {
  const trimmed = value.trim();
  const normalized = trimmed.includes(',') ? trimmed.replace(/\./g, '').replace(',', '.') : trimmed;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
};

const formatDecimalInput = (value: number) => decimalFormatter.format(value);

const getEditableLineNet = (item: EditableItem) => {
  const baseUnitNet = toMoney(item.unitPrice);
  const discountPercentage = toMoney(item.discountPercentage);
  const effectiveUnitNet = toMoney(
    baseUnitNet * (1 - discountPercentage / 100)
  );
  return toMoney(effectiveUnitNet * item.quantity);
};

const mapIncomingItems = (sourceItems: OrderItemInput[]): EditableItem[] =>
  sourceItems.map((item) => ({
    id: `saved-${item.id}`,
    persistedId: item.id,
    sku: item.sku,
    name: item.name,
    unit: item.unit ?? 'kos',
    quantity: item.quantity,
    unitPrice: item.base_unit_net,
    discountPercentage: item.discount_percentage ?? 0,
    catalogItemId: item.catalog_item_id,
    catalogVariantId: item.catalog_variant_id,
    shipLater: item.ship_later === true
  }));

const cloneEditableItems = (sourceItems: EditableItem[]): EditableItem[] =>
  sourceItems.map((item) => ({ ...item }));

const areCommercialItemsEqual = (left: EditableItem[], right: EditableItem[]) => {
  if (left.length !== right.length) return false;
  for (let index = 0; index < left.length; index += 1) {
    const leftItem = left[index];
    const rightItem = right[index];
    if (
      leftItem.id !== rightItem.id ||
      leftItem.persistedId !== rightItem.persistedId ||
      leftItem.sku !== rightItem.sku ||
      leftItem.name !== rightItem.name ||
      leftItem.unit !== rightItem.unit ||
      leftItem.quantity !== rightItem.quantity ||
      leftItem.unitPrice !== rightItem.unitPrice ||
      leftItem.discountPercentage !== rightItem.discountPercentage ||
      leftItem.catalogItemId !== rightItem.catalogItemId ||
      leftItem.catalogVariantId !== rightItem.catalogVariantId
    ) {
      return false;
    }
  }
  return true;
};

const isDeliveryPlanDirty = (draftItems: EditableItem[], persistedItems: EditableItem[]) => {
  const persistedById = new Map(
    persistedItems
      .filter((item): item is EditableItem & { persistedId: number } => typeof item.persistedId === 'number')
      .map((item) => [item.persistedId, item.shipLater] as const)
  );

  return draftItems.some((item) => {
    if (typeof item.persistedId !== 'number') return item.shipLater;
    return persistedById.get(item.persistedId) !== item.shipLater;
  });
};

const toDeliveryPlanSnapshot = (sourceItems: EditableItem[]): OrderDeliveryPlanSnapshot => ({
  shipLaterItemIds: sourceItems
    .filter((item) => item.shipLater && typeof item.persistedId === 'number')
    .map((item) => item.persistedId as number),
  currentItemCount: sourceItems.filter((item) => !item.shipLater).length,
  laterItemCount: sourceItems.filter((item) => item.shipLater).length
});

const orderItemsEditInputClassName =
  `${adminTableInlineEditInputClassName} !h-8 !px-2 !text-[12px] !leading-5`;

const centeredEditInputClassName = `${orderItemsEditInputClassName} !text-center`;
const orderItemsValueInputClassName =
  `${centeredEditInputClassName} read-only:cursor-default read-only:!border-slate-200 read-only:!bg-[color:var(--field-locked-bg)] read-only:!text-slate-900`;
const orderItemsReadValueClassName =
  "inline-flex h-full w-full min-w-0 items-center justify-center px-2 font-['Inter',system-ui,sans-serif] text-[12px] font-normal leading-5 text-slate-900";
const selectionCheckboxClassName =
  'disabled:cursor-default disabled:border-slate-200 disabled:bg-slate-100 disabled:opacity-60';
const pickerFocusableSelector = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])'
].join(',');

export default function AdminOrderItemsEditor({
  orderId,
  items,
  initialSubtotal = 0,
  initialTax = 0,
  initialShipping = 0,
  initialShippingOverride = false,
  initialShippingOverrideStale = false,
  initialShippingManualQuote = false,
  initialTaxRate,
  externalEditMode,
  hideSectionEditControls = false,
  onRequestEdit,
  sectionEditDisabled = false,
  commercialEditingLocked = false,
  deliveryPlanEditingLocked = false,
  deliveryPlanEditingLockedReason,
  initialDeliveryPlanRevision = 1,
  onDirtyChange,
  onSavingChange,
  onRegisterSave,
  onPricingRevisionChange,
  onDeliveryPlanChange,
  onDeliveryPlanRevisionChange
}: {
  orderId: number;
  items: OrderItemInput[];
  initialSubtotal?: number;
  initialTax?: number;
  initialShipping?: number;
  initialShippingOverride?: boolean;
  initialShippingOverrideStale?: boolean;
  initialShippingManualQuote?: boolean;
  initialTaxRate?: number;
  externalEditMode?: boolean;
  hideSectionEditControls?: boolean;
  onRequestEdit?: () => void;
  sectionEditDisabled?: boolean;
  commercialEditingLocked?: boolean;
  deliveryPlanEditingLocked?: boolean;
  deliveryPlanEditingLockedReason?: string;
  initialDeliveryPlanRevision?: number;
  onDirtyChange?: (isDirty: boolean) => void;
  onSavingChange?: (isSaving: boolean) => void;
  onRegisterSave?: (handler: OrderItemsSaveHandler) => void | (() => void);
  onPricingRevisionChange?: (pricingRevision: number) => void;
  onDeliveryPlanChange?: (snapshot: OrderDeliveryPlanSnapshot) => void;
  onDeliveryPlanRevisionChange?: (deliveryPlanRevision: number) => void;
}) {
  const initialMappedItems = useMemo(() => mapIncomingItems(items), [items]);
  const hasExternalEditMode = typeof externalEditMode === 'boolean';
  const [itemsSectionMode, setItemsSectionMode] = useState<ItemsSectionMode>(externalEditMode ? 'edit' : 'read');
  const [persistedItems, setPersistedItems] = useState<EditableItem[]>(initialMappedItems);
  const [draftItems, setDraftItems] = useState<EditableItem[]>(() => cloneEditableItems(initialMappedItems));
  const [persistedShipping, setPersistedShipping] = useState(initialShipping);
  const [hasShippingOverride, setHasShippingOverride] = useState(initialShippingOverride);
  const [shippingOverrideStale, setShippingOverrideStale] = useState(initialShippingOverrideStale);
  const [shippingManualQuote, setShippingManualQuote] = useState(initialShippingManualQuote);
  const [isItemsSaving, setIsItemsSaving] = useState(false);
  const [selectedDraftItemIds, setSelectedDraftItemIds] = useState<string[]>([]);
  const [catalogChoices, setCatalogChoices] = useState<CatalogChoice[]>([]);
  const [catalogQuery, setCatalogQuery] = useState('');
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const { toast } = useToast();
  const saveItemsRef = useRef<OrderItemsSaveHandler>(async () => ({ ok: true }));
  const deliveryPlanRevisionRef = useRef(
    Number.isSafeInteger(initialDeliveryPlanRevision) && initialDeliveryPlanRevision >= 1
      ? initialDeliveryPlanRevision
      : 1
  );
  const lastExternalEditModeRef = useRef<boolean | undefined>(undefined);
  const pickerDialogRef = useRef<HTMLDivElement | null>(null);
  const pickerTriggerRef = useRef<HTMLButtonElement | null>(null);
  const pickerDismissRefs = useMemo(() => [pickerDialogRef] as const, []);
  const pickerDialogId = useId();
  const pickerTitleId = useId();

  useEffect(() => {
    if (
      Number.isSafeInteger(initialDeliveryPlanRevision) &&
      initialDeliveryPlanRevision >= 1
    ) {
      deliveryPlanRevisionRef.current = initialDeliveryPlanRevision;
    }
  }, [initialDeliveryPlanRevision]);

  useEffect(() => {
    setPersistedShipping(initialShipping);
    setHasShippingOverride(initialShippingOverride);
    setShippingOverrideStale(initialShippingOverrideStale);
    setShippingManualQuote(initialShippingManualQuote);
  }, [
    initialShipping,
    initialShippingManualQuote,
    initialShippingOverride,
    initialShippingOverrideStale
  ]);

  const closeItemPicker = useCallback(() => {
    setIsPickerOpen(false);
    setCatalogQuery('');
  }, []);

  const closeItemPickerAndRestoreFocus = useCallback(() => {
    closeItemPicker();
    window.requestAnimationFrame(() => pickerTriggerRef.current?.focus());
  }, [closeItemPicker]);

  useDropdownDismiss({
    open: isPickerOpen,
    onClose: closeItemPicker,
    refs: pickerDismissRefs,
    returnFocusRef: pickerTriggerRef
  });

  const handlePickerKeyDown = useCallback((event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'Tab') return;

    const panel = pickerDialogRef.current;
    if (!panel) return;
    const focusableElements = Array.from(panel.querySelectorAll<HTMLElement>(pickerFocusableSelector))
      .filter((element) => element.tabIndex >= 0 && !element.hasAttribute('disabled'));
    if (focusableElements.length === 0) {
      event.preventDefault();
      panel.focus();
      return;
    }

    const first = focusableElements[0];
    const last = focusableElements[focusableElements.length - 1];
    const activeElement = document.activeElement;
    if (event.shiftKey && (activeElement === first || !panel.contains(activeElement))) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }, []);

  const itemsEditable = hasExternalEditMode ? Boolean(externalEditMode) : itemsSectionMode === 'edit';
  const taxRate =
    typeof initialTaxRate === 'number' &&
    Number.isFinite(initialTaxRate) &&
    initialTaxRate >= 0 &&
    initialTaxRate <= 1
      ? initialTaxRate
      : initialSubtotal > 0 && initialTax >= 0
        ? Math.min(1, initialTax / initialSubtotal)
        : TAX_RATE;
  const taxRateLabel = new Intl.NumberFormat('sl-SI', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2
  }).format(taxRate * 100);

  const isCommercialItemsDirty = useMemo(
    () => !areCommercialItemsEqual(draftItems, persistedItems),
    [draftItems, persistedItems]
  );
  const deliveryPlanDirty = useMemo(
    () => isDeliveryPlanDirty(draftItems, persistedItems),
    [draftItems, persistedItems]
  );
  const isItemsDirty = isCommercialItemsDirty || deliveryPlanDirty;
  const commercialItemsEditable = itemsEditable && !commercialEditingLocked;
  const deliveryPlanEditable = itemsEditable && !deliveryPlanEditingLocked;
  const itemSelectionEditable = commercialItemsEditable || deliveryPlanEditable;
  const itemsSaveDisabled = !itemsEditable || isItemsSaving || !isItemsDirty;
  const addItemDisabled = !commercialItemsEditable || isItemsSaving;
  const activeItems = itemsEditable ? draftItems : persistedItems;
  const activeCurrentItems = activeItems.filter((item) => !item.shipLater);
  const activeLaterItems = activeItems.filter((item) => item.shipLater);
  const selectedDraftItems = draftItems.filter((item) => selectedDraftItemIds.includes(item.id));
  const hasSelectedDraftItems = selectedDraftItems.length > 0;
  const selectedSectionShipLater = hasSelectedDraftItems
    && selectedDraftItems.every((item) => item.shipLater === selectedDraftItems[0]?.shipLater)
      ? selectedDraftItems[0]?.shipLater ?? null
      : null;
  const transferActionLabel = selectedSectionShipLater === true
    ? 'Premakni izbrane v trenutno pošiljko'
    : 'Premakni izbrane v poznejšo dobavo';
  const lockedDeliveryPlanReason = deliveryPlanEditingLocked
    ? deliveryPlanEditingLockedReason ?? 'Razporeda dobave trenutno ni mogoče spreminjati.'
    : undefined;
  const transferActionTitle = lockedDeliveryPlanReason
    ?? (!itemsEditable
      ? 'Najprej vključite urejanje postavk'
      : isItemsSaving
        ? 'Počakajte, da se shranjevanje konča'
        : !hasSelectedDraftItems
          ? 'Izberite postavke iz enega razdelka'
          : selectedSectionShipLater === null
            ? 'Izberite postavke samo iz enega razdelka'
            : transferActionLabel);
  const transferDisabled =
    !deliveryPlanEditable || isItemsSaving || selectedSectionShipLater === null;
  const transferActionAriaLabel = transferDisabled
    ? `${transferActionLabel}. ${transferActionTitle}`
    : transferActionLabel;

  const totals = useMemo(() => {
    const lineNets = activeItems.map(getEditableLineNet);
    const subtotal = toMoney(lineNets.reduce((sum, lineNet) => sum + lineNet, 0));
    const tax = toMoney(
      lineNets.reduce((sum, lineNet) => sum + toMoney(lineNet * taxRate), 0)
    );
    const shipping = persistedShipping;
    const total = toMoney(subtotal + tax + shipping);
    return { subtotal, tax, shipping, total };
  }, [activeItems, persistedShipping, taxRate]);
  const shippingPending = shippingManualQuote && !hasShippingOverride;
  const shippingIsStale =
    shippingOverrideStale || (hasShippingOverride && isCommercialItemsDirty);
  const shippingContextLabel = shippingManualQuote
    ? `Po dogovoru${shippingIsStale ? ' · zastarelo' : ''}`
    : hasShippingOverride
      ? shippingIsStale ? 'Zastarelo' : null
      : `Samodejna${shippingIsStale ? ' · zastarelo' : ''}`;

  const filteredChoices = useMemo(() => {
    const normalizedQuery = catalogQuery.trim().toLocaleLowerCase('sl');
    return catalogChoices.filter((choice) =>
      !normalizedQuery
        ? true
        : choice.name.toLocaleLowerCase('sl').includes(normalizedQuery) ||
          choice.sku.toLocaleLowerCase('sl').includes(normalizedQuery)
    );
  }, [catalogChoices, catalogQuery]);

  const updateItem = (id: string, updates: Partial<EditableItem>) => {
    if (!commercialItemsEditable) return;
    setDraftItems((currentItems) =>
      currentItems.map((item) => {
        if (item.id !== id) return item;
        const updated = { ...item, ...updates };
        return {
          ...updated,
          quantity: Math.max(1, Number.isFinite(updated.quantity) ? Math.floor(updated.quantity) : 1),
          unitPrice: Math.max(0, Number.isFinite(updated.unitPrice) ? updated.unitPrice : 0),
          discountPercentage: Math.min(
            100,
            Math.max(0, Number.isFinite(updated.discountPercentage) ? updated.discountPercentage : 0)
          )
        };
      })
    );
  };

  const startItemsEdit = () => {
    setDraftItems(cloneEditableItems(persistedItems));
    setSelectedDraftItemIds([]);
    setItemsSectionMode('edit');
  };

  const cancelItemsEdit = useCallback(() => {
    setDraftItems(cloneEditableItems(persistedItems));
    setSelectedDraftItemIds([]);
    setItemsSectionMode('read');
    setIsPickerOpen(false);
    setCatalogQuery('');
  }, [persistedItems]);

  const openAddItem = async () => {
    if (addItemDisabled) return;

    setIsPickerOpen(true);
    if (catalogChoices.length > 0) return;
    const response = await fetch('/api/admin/catalog-items');
    if (!response.ok) return;
    const payload = (await response.json()) as { items: CatalogChoice[] };
    setCatalogChoices(payload.items ?? []);
  };

  const addCatalogItem = (choice: CatalogChoice) => {
    if (!commercialItemsEditable) return;

    setDraftItems((currentItems) => {
      const existing = currentItems.find((item) =>
        item.catalogVariantId === choice.catalogVariantId ||
        (!item.catalogVariantId && item.sku === choice.sku)
      );
      if (existing) {
        return currentItems.map((item) =>
          item.id === existing.id ? { ...item, quantity: item.quantity + 1 } : item
        );
      }
      return [
        ...currentItems,
        {
          id: `new-${Date.now()}-${choice.sku}`,
          sku: choice.sku,
          name: choice.name,
          unit: choice.unit,
          quantity: 1,
          unitPrice: choice.unitPrice,
          discountPercentage: choice.discountPercentage,
          catalogItemId: choice.catalogItemId,
          catalogVariantId: choice.catalogVariantId,
          shipLater: false
        }
      ];
    });
    closeItemPickerAndRestoreFocus();
  };

  const saveItems = useCallback<OrderItemsSaveHandler>(async (options = {}) => {
    if (!itemsEditable) return { ok: true };
    if (isItemsSaving) return { ok: false };

    if (!isItemsDirty) {
      if (!hasExternalEditMode) cancelItemsEdit();
      return { ok: true };
    }

    if (draftItems.length === 0) {
      toast.error('Naročilo mora vsebovati vsaj eno postavko.');
      return { ok: false };
    }

    setIsItemsSaving(true);
    try {
      let nextDesiredItems = cloneEditableItems(draftItems);
      let nextServerItems = cloneEditableItems(persistedItems);

      if (isCommercialItemsDirty) {
        const response = await fetch(`/api/admin/orders/${orderId}/items`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            items: draftItems.map((item) => ({
              id: item.persistedId,
              catalogItemId: item.catalogItemId,
              catalogVariantId: item.catalogVariantId,
              sku: item.sku,
              name: item.name,
              unit: item.unit,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              discountPercentage: item.discountPercentage
            }))
          })
        });

        if (!response.ok) {
          const error = await response.json().catch(() => ({}));
          throw new Error(error.message || 'Shranjevanje postavk ni uspelo.');
        }

        const payload = (await response.json()) as {
          pricingRevision?: number;
          deliveryPlanRevision?: number;
          totals?: {
            shipping?: number;
            shippingOverrideStale?: boolean;
            shippingSource?: 'automatic' | 'manual_override' | 'manual_quote';
            shippingManualQuoteReason?: string | null;
          };
          items?: Array<{
            id: number;
            catalogItemId?: number | null;
            catalogVariantId?: number | null;
            sku: string;
            name: string;
            unit: string | null;
            quantity: number;
            unitPrice: number;
            discountPercentage: number;
          }>;
        };
        if (!payload.items || payload.items.length !== draftItems.length) {
          throw new Error('Strežnik ni vrnil vseh shranjenih postavk.');
        }
        const itemSaveDeliveryPlanRevision = Number(payload.deliveryPlanRevision);
        if (
          !Number.isSafeInteger(itemSaveDeliveryPlanRevision) ||
          itemSaveDeliveryPlanRevision < 1
        ) {
          throw new Error('Strežnik ni vrnil veljavne revizije načrta dobave.');
        }
        deliveryPlanRevisionRef.current = itemSaveDeliveryPlanRevision;
        onDeliveryPlanRevisionChange?.(itemSaveDeliveryPlanRevision);

        const previousPlanById = new Map(
          persistedItems
            .filter((item): item is EditableItem & { persistedId: number } => typeof item.persistedId === 'number')
            .map((item) => [item.persistedId, item.shipLater] as const)
        );
        nextServerItems = payload.items.map((item) => ({
          id: `saved-${item.id}`,
          persistedId: item.id,
          sku: item.sku,
          name: item.name,
          unit: item.unit ?? 'kos',
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          discountPercentage: item.discountPercentage,
          catalogItemId: item.catalogItemId,
          catalogVariantId: item.catalogVariantId,
          shipLater: previousPlanById.get(item.id) ?? false
        }));
        nextDesiredItems = nextServerItems.map((item, index) => ({
          ...item,
          shipLater: draftItems[index]?.shipLater === true
        }));

        // Commercial mutations already committed server-side. Keep their returned IDs
        // even if the following delivery-plan/status request fails, so a retry cannot
        // create duplicate rows.
        setPersistedItems(cloneEditableItems(nextServerItems));
        setDraftItems(cloneEditableItems(nextDesiredItems));
        setSelectedDraftItemIds([]);
        if (typeof payload.totals?.shipping === 'number') {
          setPersistedShipping(payload.totals.shipping);
        }
        setHasShippingOverride(payload.totals?.shippingSource === 'manual_override');
        setShippingOverrideStale(payload.totals?.shippingOverrideStale === true);
        setShippingManualQuote(payload.totals?.shippingSource === 'manual_quote');
        if (
          Number.isSafeInteger(payload.pricingRevision) &&
          Number(payload.pricingRevision) >= 1
        ) {
          onPricingRevisionChange?.(Number(payload.pricingRevision));
        }
        onDeliveryPlanChange?.(toDeliveryPlanSnapshot(nextDesiredItems));
      }

      const planStillDirty = isDeliveryPlanDirty(nextDesiredItems, nextServerItems);
      const planSnapshot = toDeliveryPlanSnapshot(nextDesiredItems);
      const persistDeliveryPlan = async () => {
        const expectedDeliveryPlanRevision = deliveryPlanRevisionRef.current;
        const planResponse = await fetch(`/api/admin/orders/${orderId}/delivery-plan`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            shipLaterItemIds: planSnapshot.shipLaterItemIds,
            expectedDeliveryPlanRevision
          })
        });
        const responsePayload = await planResponse.json().catch(() => ({})) as {
          message?: string;
          deliveryPlanRevision?: number;
        };
        if (!planResponse.ok) {
          throw new Error(responsePayload.message || 'Shranjevanje načrta dobave ni uspelo.');
        }
        const nextDeliveryPlanRevision = Number(responsePayload.deliveryPlanRevision);
        if (!Number.isSafeInteger(nextDeliveryPlanRevision) || nextDeliveryPlanRevision < 1) {
          throw new Error('Strežnik ni vrnil veljavne revizije načrta dobave.');
        }
        deliveryPlanRevisionRef.current = nextDeliveryPlanRevision;
        onDeliveryPlanRevisionChange?.(nextDeliveryPlanRevision);
      };
      const deliveryPlanPersistence = options.deliveryPlanPersistence ?? 'immediate';

      if (planStillDirty && deliveryPlanPersistence !== 'immediate') {
        const committedItems = cloneEditableItems(nextDesiredItems);
        return {
          ok: true,
          ...(deliveryPlanPersistence === 'after-page-save'
            ? { persistDeferredDeliveryPlan: persistDeliveryPlan }
            : {}),
          commitDeferredDeliveryPlan: () => {
            setPersistedItems(cloneEditableItems(committedItems));
            setDraftItems(cloneEditableItems(committedItems));
            setSelectedDraftItemIds([]);
            onDeliveryPlanChange?.(toDeliveryPlanSnapshot(committedItems));
          }
        };
      }

      if (planStillDirty) {
        await persistDeliveryPlan();
      }

      setPersistedItems(cloneEditableItems(nextDesiredItems));
      setDraftItems(cloneEditableItems(nextDesiredItems));
      setSelectedDraftItemIds([]);
      onDeliveryPlanChange?.(toDeliveryPlanSnapshot(nextDesiredItems));
      if (!hasExternalEditMode) {
        setItemsSectionMode('read');
        toast.success('Postavke so posodobljene.');
      }
      return { ok: true };
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Napaka pri shranjevanju postavk.');
      return { ok: false };
    } finally {
      setIsItemsSaving(false);
    }
  }, [
    draftItems,
    persistedItems,
    cancelItemsEdit,
    hasExternalEditMode,
    isCommercialItemsDirty,
    isItemsDirty,
    isItemsSaving,
    itemsEditable,
    orderId,
    onDeliveryPlanChange,
    onDeliveryPlanRevisionChange,
    onPricingRevisionChange,
    toast
  ]);
  useEffect(() => {
    if (!hasExternalEditMode) return;
    if (lastExternalEditModeRef.current === externalEditMode) return;
    lastExternalEditModeRef.current = externalEditMode;

    setDraftItems(cloneEditableItems(persistedItems));
    setSelectedDraftItemIds([]);
    setItemsSectionMode(externalEditMode ? 'edit' : 'read');
    if (!externalEditMode) {
      setIsPickerOpen(false);
      setCatalogQuery('');
    }
  }, [externalEditMode, hasExternalEditMode, persistedItems]);

  useEffect(() => {
    onDirtyChange?.(isItemsDirty);
  }, [isItemsDirty, onDirtyChange]);

  useEffect(() => {
    onDeliveryPlanChange?.(toDeliveryPlanSnapshot(activeItems));
  }, [activeItems, onDeliveryPlanChange]);

  useEffect(() => {
    onSavingChange?.(isItemsSaving);
  }, [isItemsSaving, onSavingChange]);

  useEffect(() => {
    saveItemsRef.current = saveItems;
  }, [saveItems]);

  useEffect(() => {
    if (!onRegisterSave) return undefined;
    return onRegisterSave((options) => saveItemsRef.current(options));
  }, [onRegisterSave]);

  useEffect(() => {
    if (hasExternalEditMode || !itemsEditable || isPickerOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const isTextEntry =
        target?.tagName === 'INPUT' ||
        target?.tagName === 'TEXTAREA' ||
        target?.getAttribute('contenteditable') === 'true';

      if (event.key === 'Escape') {
        event.preventDefault();
        cancelItemsEdit();
        return;
      }

      if (event.key === 'Enter' && isTextEntry && !event.shiftKey) {
        event.preventDefault();
        void saveItems();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [cancelItemsEdit, hasExternalEditMode, itemsEditable, isPickerOpen, saveItems]);

  const toggleSelectedDraftItem = (itemId: string) => {
    if (!itemSelectionEditable) return;
    const item = draftItems.find((candidate) => candidate.id === itemId);
    if (!item) return;

    setSelectedDraftItemIds((previous) => {
      if (previous.includes(itemId)) return previous.filter((id) => id !== itemId);
      const previousItems = draftItems.filter((candidate) => previous.includes(candidate.id));
      const selectionMatchesSection = previousItems.every(
        (candidate) => candidate.shipLater === item.shipLater
      );
      return selectionMatchesSection ? [...previous, itemId] : [itemId];
    });
  };

  const toggleDraftSection = (shipLater: boolean) => {
    if (!itemSelectionEditable) return;
    const sectionItemIds = draftItems
      .filter((item) => item.shipLater === shipLater)
      .map((item) => item.id);
    const sectionIsSelected =
      sectionItemIds.length > 0 && sectionItemIds.every((id) => selectedDraftItemIds.includes(id));
    setSelectedDraftItemIds(sectionIsSelected ? [] : sectionItemIds);
  };

  const moveSelectedDraftItems = () => {
    if (transferDisabled || selectedSectionShipLater === null) return;
    const selectedSet = new Set(selectedDraftItemIds);
    const destinationShipLater = !selectedSectionShipLater;
    setDraftItems((previous) => previous.map((item) =>
      selectedSet.has(item.id) ? { ...item, shipLater: destinationShipLater } : item
    ));
    setSelectedDraftItemIds([]);
    toast.info(
      destinationShipLater
        ? 'Izbrane postavke bodo poslane pozneje. Shrani za potrditev.'
        : 'Izbrane postavke bodo vključene v trenutno pošiljko. Shrani za potrditev.'
    );
  };

  const deleteSelectedDraftItems = () => {
    if (!commercialItemsEditable || selectedDraftItemIds.length === 0) return;
    const removedCount = selectedDraftItemIds.length;
    const selectedSet = new Set(selectedDraftItemIds);
    setDraftItems((previous) => previous.filter((item) => !selectedSet.has(item.id)));
    setSelectedDraftItemIds([]);
    toast.info(removedCount === 1 ? 'Postavka je odstranjena. Shrani za potrditev.' : `Odstranjenih postavk: ${removedCount}. Shrani za potrditev.`);
  };

  const renderItemRow = (item: EditableItem) => {
    const lineTotal = getEditableLineNet(item);
    return (
      <tr key={item.id} className={`border-t border-slate-200/90 bg-white align-middle ${adminTableRowToneClasses.hover}`}>
        <td className="py-3 pl-4 pr-2 text-left">
          <AdminCheckbox
            checked={itemSelectionEditable && selectedDraftItemIds.includes(item.id)}
            onChange={() => toggleSelectedDraftItem(item.id)}
            aria-label={`Izberi postavko ${item.name}`}
            className={selectionCheckboxClassName}
            disabled={!itemSelectionEditable}
          />
        </td>
        <td className="px-3 py-3 align-middle">
          <div className="grid gap-0.5">
            <p className="truncate text-[12px] font-medium text-slate-900">{item.name}</p>
            <p className="truncate text-[11px] text-slate-500">{item.sku}</p>
          </div>
        </td>
        <td className="px-1 py-3 text-center">
          <span
            className="mx-auto inline-flex h-8 w-full items-center justify-center"
            data-admin-order-item-value-slot="quantity"
          >
            {commercialItemsEditable ? (
              <input
                type="number"
                min={1}
                value={item.quantity}
                onChange={(event) => updateItem(item.id, { quantity: Number(event.target.value) || 1 })}
                aria-label="Količina"
                data-admin-order-item-value-input
                className={`${orderItemsValueInputClassName} w-full appearance-none [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none`}
                readOnly={isItemsSaving}
              />
            ) : (
              <span className={orderItemsReadValueClassName} data-admin-order-item-value-display>
                {item.quantity}
              </span>
            )}
          </span>
        </td>
        <td className="px-1.5 py-3 text-center">
          <span
            className="mx-auto inline-flex h-8 w-[88px] items-center justify-center gap-1"
            data-admin-order-item-value-slot="unit-price"
          >
            {commercialItemsEditable ? (
              <input
                type="text"
                inputMode="decimal"
                value={formatDecimalInput(item.unitPrice)}
                onChange={(event) => updateItem(item.id, { unitPrice: parseLocaleNumber(event.target.value) })}
                aria-label="Cena brez DDV"
                data-admin-order-item-value-input
                className={`${orderItemsValueInputClassName} min-w-0 w-full`}
                readOnly={isItemsSaving}
              />
            ) : (
              <span className={orderItemsReadValueClassName} data-admin-order-item-value-display>
                {formatDecimalInput(item.unitPrice)}
              </span>
            )}
            <span className="text-[12px] text-slate-700">€</span>
          </span>
        </td>
        <td className="px-1.5 py-3 text-center">
          <span
            className="mx-auto inline-flex h-8 w-[72px] items-center justify-center gap-1"
            data-admin-order-item-value-slot="discount"
          >
            {commercialItemsEditable ? (
              <input
                type="text"
                inputMode="decimal"
                value={formatDecimalInput(item.discountPercentage)}
                onChange={(event) => updateItem(item.id, { discountPercentage: parseLocaleNumber(event.target.value) })}
                aria-label="Popust"
                data-admin-order-item-value-input
                className={`${orderItemsValueInputClassName} min-w-0 w-full`}
                readOnly={isItemsSaving}
              />
            ) : (
              <span className={orderItemsReadValueClassName} data-admin-order-item-value-display>
                {formatDecimalInput(item.discountPercentage)}
              </span>
            )}
            <span className="text-[12px] text-slate-700">%</span>
          </span>
        </td>
        <td
          className="py-3 pl-1.5 pr-4 text-right font-semibold text-slate-900"
          data-admin-order-item-total
        >
          <span data-admin-order-item-total-value>{formatCurrency(lineTotal)}</span>
        </td>
      </tr>
    );
  };

  return (
    <section className={`${adminWindowCardClassName} flex flex-col p-6`} style={adminWindowCardStyle}>
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div
          className="flex h-11 items-center gap-3 px-4"
          data-testid="admin-order-items-toolbar"
        >
          <h2 className="text-base font-semibold text-slate-900">Postavke</h2>
          <div className="ml-auto flex shrink-0 flex-nowrap items-center gap-1.5">
            <h3 className="sr-only">Upravljanje postavk</h3>
            {!hideSectionEditControls ? (
              itemsEditable ? (
                <div className={adminTableInlineActionRowClassName}>
                  <IconButton
                    type="button"
                    tone="neutral"
                    size="sm"
                    className={adminTableInlineConfirmButtonClassName}
                    disabled={itemsSaveDisabled}
                    aria-label="Shrani postavke"
                    title={isItemsDirty ? 'Shrani spremembe' : 'Ni sprememb za shranjevanje'}
                    onClick={() => {
                      void saveItems();
                    }}
                  >
                    <CheckIcon className={adminTableInlineConfirmIconClassName} strokeWidth={2.2} />
                  </IconButton>
                  <IconButton
                    type="button"
                    tone="neutral"
                    size="sm"
                    className={adminTableInlineCancelButtonClassName}
                    aria-label="Prekliči urejanje postavk"
                    title="Prekliči"
                    onClick={cancelItemsEdit}
                  >
                    <CloseIcon className={adminTableInlineCancelIconClassName} strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" />
                  </IconButton>
                </div>
              ) : (
                <IconButton
                  type="button"
                  aria-label="Hitro urejanje postavk"
                  onClick={startItemsEdit}
                  title="Hitro urejanje"
                  tone="neutral"
                  className={adminTableNeutralIconButtonClassName}
                  disabled={isItemsSaving}
                >
                  <PencilIcon />
                </IconButton>
              )
            ) : null}

            <IconButton
              type="button"
              aria-label="Dodaj postavko"
              aria-haspopup="dialog"
              aria-expanded={isPickerOpen}
              aria-controls={pickerDialogId}
              onClick={(event) => {
                pickerTriggerRef.current = event.currentTarget;
                void openAddItem();
              }}
              title="Dodaj"
              tone="neutral"
              className={adminTableNeutralIconButtonClassName}
              disabled={addItemDisabled}
            >
              <PlusIcon />
            </IconButton>

            <span className="inline-flex" title={transferActionTitle}>
              <IconButton
                type="button"
                aria-label={transferActionAriaLabel}
                onClick={moveSelectedDraftItems}
                title={transferActionTitle}
                tone="neutral"
                className={adminTableNeutralIconButtonClassName}
                disabled={transferDisabled}
                data-testid="admin-order-items-transfer"
              >
                <ApplyToAllIcon className={selectedSectionShipLater === true ? 'h-4 w-4 rotate-180' : 'h-4 w-4'} />
              </IconButton>
            </span>

            <IconButton
              type="button"
              aria-label="Odstrani izbrane postavke"
              onClick={deleteSelectedDraftItems}
              title={commercialEditingLocked ? 'Vsebina postavk je zaklenjena' : 'Izbriši izbrane'}
              tone={commercialItemsEditable && hasSelectedDraftItems ? 'danger' : 'neutral'}
              className={commercialItemsEditable && hasSelectedDraftItems ? adminTableSelectedDangerIconButtonClassName : `${adminTableNeutralIconButtonClassName} !transition-none`}
              disabled={!commercialItemsEditable || !hasSelectedDraftItems}
            >
              <TrashCanIcon />
            </IconButton>

            {onRequestEdit ? (
              <button
                type="button"
                className={`${adminCardSectionEditIconButtonClassName} ${itemsEditable ? 'bg-[color:var(--hover-neutral)]' : ''}`}
                onClick={onRequestEdit}
                aria-label="Uredi postavke naročila"
                aria-pressed={itemsEditable}
                title="Uredi postavke"
                disabled={sectionEditDisabled || isItemsSaving}
                data-admin-card-edit-action="items"
              >
                <PencilIcon className="h-4 w-4" />
              </button>
            ) : null}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table
            className="min-w-[620px] w-full table-fixed whitespace-nowrap text-[12px] leading-5"
          >
            <colgroup>
              <col style={{ width: '44px' }} />
              <col />
              <col style={{ width: '11%' }} />
              <col style={{ width: '17%' }} />
              <col style={{ width: '14%' }} />
              <col style={{ width: '19%' }} />
            </colgroup>
            <thead className="border-t border-slate-200 bg-[color:var(--admin-table-header-bg)] text-slate-600">
              <tr>
                <th className="border-b border-slate-200 py-4 pl-4 pr-2 text-left align-middle" aria-label="Izbira" />
                <th className="border-b border-slate-200 px-3 py-4 text-left text-[12px] font-semibold align-middle">Artikel</th>
                <th className="border-b border-slate-200 px-1 py-4 text-center text-[12px] font-semibold align-middle">Količina</th>
                <th className="border-b border-slate-200 px-1.5 py-4 text-center text-[12px] font-semibold align-middle">Cena brez DDV</th>
                <th className="border-b border-slate-200 px-1.5 py-4 text-center text-[12px] font-semibold align-middle">Popust %</th>
                <th className="border-b border-slate-200 py-4 pl-1.5 pr-4 text-right text-[12px] font-semibold align-middle">
                  <span data-testid="admin-order-items-total-header">Skupaj brez DDV</span>
                </th>
              </tr>
            </thead>
            <tbody data-testid="admin-order-items-current-group">
              <tr className="bg-slate-50/80 text-slate-700">
                <td className="py-2.5 pl-4 pr-2 text-left align-middle">
                  <AdminCheckbox
                    checked={
                      itemSelectionEditable &&
                      activeCurrentItems.length > 0 &&
                      activeCurrentItems.every((item) => selectedDraftItemIds.includes(item.id))
                    }
                    onChange={() => toggleDraftSection(false)}
                    aria-label="Izberi vse postavke v tej pošiljki"
                    className={selectionCheckboxClassName}
                    disabled={!itemSelectionEditable || activeCurrentItems.length === 0}
                  />
                </td>
                <td colSpan={5} className="px-3 py-2.5 align-middle">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-slate-900">V tej pošiljki</span>
                    <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-medium text-slate-500 ring-1 ring-inset ring-slate-200">
                      {activeCurrentItems.length}
                    </span>
                  </div>
                </td>
              </tr>
              {activeCurrentItems.length > 0 ? (
                activeCurrentItems.map(renderItemRow)
              ) : (
                <tr className="border-t border-slate-200/90 bg-white">
                  <td colSpan={6} className="px-4 py-4 text-center text-[11px] text-slate-500">
                    V trenutni pošiljki ni postavk.
                  </td>
                </tr>
              )}
            </tbody>
            <tbody data-testid="admin-order-items-later-group">
              <tr className="border-t border-slate-200 bg-sky-50/60 text-slate-700">
                <td className="py-2.5 pl-4 pr-2 text-left align-middle">
                  <AdminCheckbox
                    checked={
                      itemSelectionEditable &&
                      activeLaterItems.length > 0 &&
                      activeLaterItems.every((item) => selectedDraftItemIds.includes(item.id))
                    }
                    onChange={() => toggleDraftSection(true)}
                    aria-label="Izberi vse postavke za poznejšo dobavo"
                    className={selectionCheckboxClassName}
                    disabled={!itemSelectionEditable || activeLaterItems.length === 0}
                  />
                </td>
                <td colSpan={5} className="px-3 py-2.5 align-middle">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-slate-900">Pošljemo pozneje</span>
                    <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-medium text-slate-500 ring-1 ring-inset ring-sky-200">
                      {activeLaterItems.length}
                    </span>
                  </div>
                </td>
              </tr>
              {activeLaterItems.length > 0 ? (
                activeLaterItems.map(renderItemRow)
              ) : (
                <tr className="border-t border-slate-200/90 bg-white">
                  <td colSpan={6} className="px-4 py-4 text-center text-[11px] text-slate-500">
                    {lockedDeliveryPlanReason ?? 'Izberite postavke zgoraj in jih premaknite v poznejšo dobavo.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className={`bg-slate-50/50 px-4 py-3 text-[12px] text-slate-700 ${activeItems.length > 0 ? 'border-t border-slate-200' : ''}`}>
          <div
            className="ml-auto w-full max-w-[280px] space-y-1"
            data-testid="admin-order-items-totals"
          >
            <div className="flex items-center justify-between">
              <span>Vmesni seštevek brez DDV</span>
              <span className="font-semibold">{formatCurrency(totals.subtotal)}</span>
            </div>
            <div className="flex min-h-5 items-center justify-between">
              <span>Poštnina</span>
              <span className="inline-flex flex-wrap items-center justify-end gap-x-2 gap-y-0.5 font-semibold text-slate-700">
                {shippingContextLabel ? (
                  <span className="text-[10px] font-medium leading-3 text-slate-500">
                    {shippingContextLabel}
                  </span>
                ) : null}
                <span>{shippingManualQuote ? '—' : formatCurrency(totals.shipping)}</span>
              </span>
            </div>
            {shippingManualQuote ? (
              <p className="text-right text-[10px] leading-3 text-amber-700">
                Pred dokončanjem osnutka določite ročno poštnino in razlog.
              </p>
            ) : null}
            {itemsEditable && isItemsDirty && !hasShippingOverride ? (
              <p className="text-right text-[10px] leading-3 text-slate-500">
                Poštnina bo preračunana ob shranjevanju postavk.
              </p>
            ) : null}
            <div className="flex items-center justify-between text-slate-500">
              <span>DDV ({taxRateLabel} %)</span>
              <span className="font-semibold">{formatCurrency(totals.tax)}</span>
            </div>
            <div className="border-t border-slate-200 pt-1">
              <div className="flex items-center justify-between text-[13px] font-semibold text-slate-900">
                <span>Skupaj z DDV</span>
                <span>{shippingPending ? 'Ni dokončen' : formatCurrency(totals.total)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {isPickerOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4"
          data-admin-order-item-picker-overlay
        >
          <div
            id={pickerDialogId}
            ref={pickerDialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={pickerTitleId}
            tabIndex={-1}
            onKeyDown={handlePickerKeyDown}
            data-admin-order-item-picker-dialog
            className="w-full max-w-2xl rounded-xl border border-slate-200 bg-white p-4 shadow-[0_14px_34px_rgba(15,23,42,0.08),0_2px_6px_rgba(15,23,42,0.05)]"
          >
            <div className="flex items-center justify-between">
              <h3 id={pickerTitleId} className="text-[13px] font-semibold text-slate-900">Dodaj artikel</h3>
              <button
                type="button"
                className="text-[12px] text-slate-500 hover:text-slate-700"
                onClick={closeItemPickerAndRestoreFocus}
              >
                Zapri
              </button>
            </div>

            <div className="mt-3">
              <AdminSearchInput
                autoFocus
                value={catalogQuery}
                onChange={(event) => setCatalogQuery(event.target.value)}
                placeholder="Išči po nazivu ali šifri"
                aria-label="Išči artikel"
                wrapperClassName={adminTableSearchWrapperClassName}
                inputClassName={adminTableSearchInputClassName}
                iconClassName={adminTableSearchIconClassName}
              />
            </div>

            <div className="mt-3 max-h-[360px] overflow-y-auto rounded-md border border-slate-200">
              {filteredChoices.map((choice) => (
                <button
                  key={choice.sku}
                  type="button"
                  onClick={() => addCatalogItem(choice)}
                  className="flex w-full items-center justify-between border-b border-slate-200/80 px-3 py-3 text-left text-[12px] text-slate-700 transition-colors hover:bg-[color:var(--admin-table-row-hover)] last:border-b-0"
                >
                  <span className="font-medium text-slate-900">{choice.name}</span>
                  <span className="text-[12px] text-slate-600">{formatCurrency(choice.unitPrice)}</span>
                </button>
              ))}
              {filteredChoices.length === 0 ? (
                <div className="px-3 py-6 text-center text-[12px] text-slate-500">Ni ujemajočih artiklov.</div>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
