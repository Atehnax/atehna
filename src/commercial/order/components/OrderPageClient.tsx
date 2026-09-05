'use client';

import Link from 'next/link';
import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type FocusEvent as ReactFocusEvent,
  type InputHTMLAttributes,
  type KeyboardEvent as ReactKeyboardEvent,
  type TextareaHTMLAttributes
} from 'react';
import { flushSync } from 'react-dom';
import { useCartStore } from '@/commercial/cart/store';
import {
  cartHasBlockingIssue,
  cartNeedsEstimate
} from '@/commercial/cart/cartTypes';
import { useCartQuantityValidity } from '@/commercial/cart/useCartQuantityValidity';
import CartLine from '@/commercial/components/storefront/CartLine';
import { useStockEnforcementEnabled } from '@/commercial/components/StorefrontInventoryPolicyProvider';
import {
  parseOrderApiError,
  type SubmitOrderRequest,
  type SubmitOrderResponse
} from '@/commercial/order/contracts';
import OrderLoadingState from '@/commercial/order/components/OrderLoadingState';
import PostalLocationCombobox from '@/commercial/order/components/PostalLocationCombobox';
import {
  ShippingManualQuoteNotice,
  shippingManualQuoteMessage
} from '@/commercial/order/components/ShippingCalculationRows';
import { storeOrderAccessId } from '@/commercial/order/orderAccessClient';
import { useOrderEstimate } from '@/commercial/order/useOrderEstimate';
import {
  type QuoteRequestReason,
  type SubmitQuoteRequestRequest,
  type SubmitQuoteRequestResponse
} from '@/commercial/quote/contracts';
import { storeQuoteAccessSession } from '@/commercial/quote/quoteAccessClient';
import { readJsonResponse } from '@/shared/client/readJsonResponse';
import {
  isAddressSearchQueryEligible,
  normalizeAddressSearchText,
  type GursAddressSearchResponse,
  type GursAddressSearchResult,
  type GursPostalLocation
} from '@/shared/domain/address/gursAddress';
import {
  CUSTOMER_TYPE_FORM_OPTIONS,
  isCustomerType,
  type CustomerType
} from '@/shared/domain/order/customerType';
import { formatEuro } from '@/shared/domain/formatting';
import {
  FloatingInput,
  FloatingTextarea
} from '@/shared/ui/floating-field';

const FORM_STORAGE_KEY = 'atehna-order-form-v4';
const ADDRESS_SEARCH_FOLLOW_UP_DEBOUNCE_MS = 50;
const ORDER_SUMMARY_CALCULATION_ROW_CLASS_NAME =
  'flex justify-between gap-4 text-sm font-normal not-italic text-[color:var(--site-color-text)]';

type OrderFormData = {
  customerType: CustomerType | '';
  firstName: string;
  lastName: string;
  organizationName: string;
  contactName: string;
  email: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  postalCode: string;
  gursHouseNumberId: string;
  countryCode: 'SI';
  reference: string;
  notes: string;
  quoteReason: QuoteRequestReason;
  quoteMessage: string;
};

type FieldName = Exclude<
  keyof OrderFormData,
  'customerType' | 'gursHouseNumberId' | 'countryCode'
>;
type FieldErrors = Partial<Record<FieldName, string>>;
type AddressSearchStatus = 'idle' | 'loading' | 'ready' | 'error';
type CheckoutIntent = 'order' | 'quote_request';
type SubmissionPhase =
  | 'idle'
  | 'submitting-order'
  | 'submitting-quote-request'
  | 'opening-order-confirmation'
  | 'opening-quote-confirmation';
type SubmissionFeedback = { error: string | null; issues: string[] };

const STOREFRONT_QUOTE_REASON: QuoteRequestReason = 'formal_offer';
const CHECKOUT_INTENT_OPTIONS = [
  {
    value: 'order',
    label: 'Naročilo',
    description: 'Oddajte naročilo za izbrane artikle.'
  },
  {
    value: 'quote_request',
    label: 'Zahtevaj ponudbo',
    description: 'Pošljite povpraševanje za ponudbo'
  }
] as const satisfies ReadonlyArray<{
  value: CheckoutIntent;
  label: string;
  description: string;
}>;

const initialForm: OrderFormData = {
  customerType: '',
  firstName: '',
  lastName: '',
  organizationName: '',
  contactName: '',
  email: '',
  addressLine1: '',
  addressLine2: '',
  city: '',
  postalCode: '',
  gursHouseNumberId: '',
  countryCode: 'SI',
  reference: '',
  notes: '',
  quoteReason: STOREFRONT_QUOTE_REASON,
  quoteMessage: ''
};

const isValidEmail = (value: string) =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());

const createIdempotencyKey = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `atehna-${Date.now()}-${Math.random().toString(36).slice(2)}`;
};

const waitForNextPaint = () =>
  new Promise<void>((resolve) => {
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => resolve());
    });
  });

function isGursAddressSearchResult(
  value: unknown
): value is GursAddressSearchResult {
  if (!value || typeof value !== 'object') return false;
  const result = value as Record<string, unknown>;
  return [
    'gursHouseNumberId',
    'addressLine1',
    'postalCode',
    'postalName',
    'settlementName',
    'municipalityName'
  ].every((key) => typeof result[key] === 'string');
}

function CheckoutInput({
  label,
  error,
  className,
  shellClassName = '',
  ...props
}: InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  error?: string;
  shellClassName?: string;
}) {
  const id = String(props.id);
  const describedBy = [
    props['aria-describedby'],
    error ? `${id}-error` : undefined
  ]
    .filter(Boolean)
    .join(' ');
  return (
    <div className={className}>
      <FloatingInput
        {...props}
        id={id}
        label={label}
        tone="order"
        shellClassName={`storefront-checkout-input-shell ${shellClassName} ${
          error ? '!border-[color:var(--site-color-danger)]' : ''
        }`}
        className="storefront-checkout-input"
        aria-invalid={Boolean(error)}
        aria-describedby={describedBy || undefined}
      />
      {error ? (
        <p
          id={`${id}-error`}
          className="mt-1 text-xs text-[color:var(--site-color-danger)]"
        >
          {error}
        </p>
      ) : null}
    </div>
  );
}

function CheckoutTextarea({
  label,
  className,
  shellClassName = '',
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement> & {
  label: string;
  shellClassName?: string;
}) {
  const id = String(props.id);
  return (
    <div className={className}>
      <FloatingTextarea
        {...props}
        id={id}
        label={label}
        tone="order"
        shellClassName={`storefront-checkout-textarea-shell ${shellClassName}`}
        className="storefront-checkout-textarea"
      />
    </div>
  );
}

export default function OrderPageClient({
  quoteRequestsEnabled = false
}: {
  quoteRequestsEnabled?: boolean;
}) {
  const stockEnforcementEnabled = useStockEnforcementEnabled();
  const items = useCartStore((state) => state.items);
  const setQuantity = useCartStore((state) => state.setQuantity);
  const removeItem = useCartStore((state) => state.removeItem);
  const clearCart = useCartStore((state) => state.clearCart);
  const { hasInvalidQuantity, onQuantityValidityChange } =
    useCartQuantityValidity();
  const [formData, setFormData] = useState<OrderFormData>(initialForm);
  const [isFormHydrated, setIsFormHydrated] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [checkoutIntent, setCheckoutIntent] =
    useState<CheckoutIntent>('order');
  const [lastSubmissionIntent, setLastSubmissionIntent] =
    useState<CheckoutIntent>('order');
  const [submissionFeedback, setSubmissionFeedback] = useState<
    Record<CheckoutIntent, SubmissionFeedback>
  >({
    order: { error: null, issues: [] },
    quote_request: { error: null, issues: [] }
  });
  const [submissionPhase, setSubmissionPhase] =
    useState<SubmissionPhase>('idle');
  const [addressSuggestions, setAddressSuggestions] = useState<
    GursAddressSearchResult[]
  >([]);
  const [isAddressListOpen, setIsAddressListOpen] = useState(false);
  const [isAddressComboboxActive, setIsAddressComboboxActive] =
    useState(false);
  const [activeAddressIndex, setActiveAddressIndex] = useState(-1);
  const [addressSearchStatus, setAddressSearchStatus] =
    useState<AddressSearchStatus>('idle');
  const idempotencyKeyRefs = useRef<Record<CheckoutIntent, string | null>>({
    order: null,
    quote_request: null
  });
  const addressRequestRef = useRef<AbortController | null>(null);
  const addressListboxId = useId();
  const isSubmitting = submissionPhase !== 'idle';
  const activeCheckoutIntent: CheckoutIntent =
    quoteRequestsEnabled && checkoutIntent === 'quote_request'
      ? 'quote_request'
      : 'order';
  const isQuoteRequest = activeCheckoutIntent === 'quote_request';
  const submitError = submissionFeedback[lastSubmissionIntent].error;
  const submitIssues = submissionFeedback[lastSubmissionIntent].issues;

  const estimateCustomerName = useMemo(() => {
    if (formData.customerType === 'individual') {
      return `${formData.firstName.trim()} ${formData.lastName.trim()}`.trim();
    }
    if (
      formData.customerType === 'company' ||
      formData.customerType === 'school'
    ) {
      return formData.organizationName.trim();
    }
    return '';
  }, [
    formData.customerType,
    formData.firstName,
    formData.lastName,
    formData.organizationName
  ]);
  const estimateCustomerLabels = useMemo(() => {
    if (formData.customerType === 'individual') {
      return estimateCustomerName ? [estimateCustomerName] : [];
    }
    if (
      formData.customerType === 'company' ||
      formData.customerType === 'school'
    ) {
      return [
        formData.organizationName.trim(),
        formData.contactName.trim()
      ].filter(Boolean);
    }
    return [];
  }, [
    formData.contactName,
    formData.customerType,
    formData.organizationName,
    estimateCustomerName
  ]);
  const estimateState = useOrderEstimate(
    items,
    items.length > 0,
    estimateCustomerName,
    estimateCustomerLabels
  );
  const shippingRequiresManualQuote =
    estimateState.estimate?.shipping.status === 'manual_quote';

  const estimateByVariant = useMemo(
    () =>
      new Map(
        (estimateState.estimate?.items ?? []).map((item) => [item.variantId, item])
      ),
    [estimateState.estimate]
  );
  const orderSubmissionFingerprint = JSON.stringify({
    intent: 'order',
    formData,
    items: items.map((item) => [item.lineId, item.quantity])
  });
  const quoteRequestSubmissionFingerprint = JSON.stringify({
    intent: 'quote_request',
    formData,
    items: items.map((item) => [item.lineId, item.quantity])
  });

  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(FORM_STORAGE_KEY);
      if (saved) {
        const restored = JSON.parse(saved) as Partial<OrderFormData>;
        setFormData({
          ...initialForm,
          ...restored,
          customerType:
            typeof restored.customerType === 'string' &&
            isCustomerType(restored.customerType)
              ? restored.customerType
              : '',
          gursHouseNumberId:
            typeof restored.gursHouseNumberId === 'string'
              ? restored.gursHouseNumberId
              : '',
          quoteReason: STOREFRONT_QUOTE_REASON,
          quoteMessage:
            typeof restored.quoteMessage === 'string'
              ? restored.quoteMessage
              : '',
          countryCode: 'SI'
        });
      }
    } catch {
      sessionStorage.removeItem(FORM_STORAGE_KEY);
    } finally {
      setIsFormHydrated(true);
    }
  }, []);

  useEffect(() => {
    if (!isFormHydrated) return;
    sessionStorage.setItem(FORM_STORAGE_KEY, JSON.stringify(formData));
  }, [formData, isFormHydrated]);

  useEffect(() => {
    idempotencyKeyRefs.current.order = null;
  }, [orderSubmissionFingerprint]);

  useEffect(() => {
    idempotencyKeyRefs.current.quote_request = null;
  }, [quoteRequestSubmissionFingerprint]);

  useEffect(() => {
    addressRequestRef.current?.abort();
    addressRequestRef.current = null;

    if (
      !isAddressComboboxActive ||
      formData.gursHouseNumberId ||
      !isAddressSearchQueryEligible(formData.addressLine1)
    ) {
      setAddressSuggestions([]);
      setIsAddressListOpen(false);
      setActiveAddressIndex(-1);
      setAddressSearchStatus('idle');
      return;
    }

    const query = normalizeAddressSearchText(formData.addressLine1);
    setAddressSearchStatus('loading');
    setActiveAddressIndex(-1);
    const search = async () => {
      const controller = new AbortController();
      addressRequestRef.current = controller;

      try {
        const response = await fetch(
          `/api/addresses/search?query=${encodeURIComponent(query)}`,
          {
            headers: { Accept: 'application/json' },
            signal: controller.signal
          }
        );
        if (!response.ok) throw new Error('Address search failed.');

        const payload = (await response.json()) as Partial<GursAddressSearchResponse>;
        if (
          controller.signal.aborted ||
          addressRequestRef.current !== controller
        ) {
          return;
        }
        const results = Array.isArray(payload.results)
          ? payload.results.filter(isGursAddressSearchResult).slice(0, 8)
          : [];
        setAddressSuggestions(results);
        setActiveAddressIndex(-1);
        setIsAddressListOpen(results.length > 0);
        setAddressSearchStatus('ready');
      } catch (error) {
        if (
          controller.signal.aborted ||
          addressRequestRef.current !== controller ||
          (error instanceof Error && error.name === 'AbortError')
        ) {
          return;
        }
        setAddressSuggestions([]);
        setIsAddressListOpen(false);
        setActiveAddressIndex(-1);
        setAddressSearchStatus('error');
      } finally {
        if (addressRequestRef.current === controller) {
          addressRequestRef.current = null;
        }
      }
    };
    const startsImmediately = query.length === 1;
    const timeoutId = startsImmediately
      ? null
      : window.setTimeout(() => {
          void search();
        }, ADDRESS_SEARCH_FOLLOW_UP_DEBOUNCE_MS);

    if (startsImmediately) void search();

    return () => {
      if (timeoutId !== null) window.clearTimeout(timeoutId);
      addressRequestRef.current?.abort();
    };
  }, [
    formData.addressLine1,
    formData.gursHouseNumberId,
    isAddressComboboxActive
  ]);

  const validate = () => {
    const errors: FieldErrors = {};
    if (!isValidEmail(formData.email)) errors.email = 'Vnesite veljaven e-poštni naslov.';
    if (!formData.addressLine1.trim()) errors.addressLine1 = 'Vnesite naslov.';
    if (!formData.city.trim()) errors.city = 'Vnesite kraj.';
    if (!/^\d{4}$/.test(formData.postalCode.trim())) {
      errors.postalCode = 'Vnesite štirimestno slovensko poštno številko.';
    }
    if (formData.customerType === 'individual') {
      if (!formData.firstName.trim()) errors.firstName = 'Vnesite ime.';
      if (!formData.lastName.trim()) errors.lastName = 'Vnesite priimek.';
    } else {
      if (!formData.organizationName.trim()) {
        errors.organizationName = 'Vnesite naziv naročnika.';
      }
      if (!formData.contactName.trim()) {
        errors.contactName = 'Vnesite kontaktno osebo.';
      }
    }
    setFieldErrors(errors);
    return errors;
  };

  const updateField = <K extends keyof OrderFormData>(
    field: K,
    value: OrderFormData[K]
  ) => {
    setFormData((previous) => ({ ...previous, [field]: value }));
    if (field !== 'customerType') {
      setFieldErrors((previous) => ({ ...previous, [field]: undefined }));
    }
  };

  const selectCheckoutIntent = (intent: CheckoutIntent) => {
    if (isSubmitting) return;
    setCheckoutIntent(intent);
    setLastSubmissionIntent(intent);
  };

  const updateAddressField = (
    field: 'addressLine1' | 'city' | 'postalCode',
    value: string
  ) => {
    setFormData((previous) => ({
      ...previous,
      [field]: value,
      gursHouseNumberId: ''
    }));
    setFieldErrors((previous) => ({ ...previous, [field]: undefined }));
  };

  const applyPostalLocation = useCallback(
    (location: GursPostalLocation) => {
      setFormData((previous) => {
        if (
          previous.postalCode === location.postalCode &&
          previous.city === location.postalName &&
          !previous.gursHouseNumberId
        ) {
          return previous;
        }
        return {
          ...previous,
          postalCode: location.postalCode,
          city: location.postalName,
          gursHouseNumberId: ''
        };
      });
      setFieldErrors((previous) => ({
        ...previous,
        city: undefined,
        postalCode: undefined
      }));
    },
    []
  );
  const postalEditSequenceRef = useRef(0);

  const selectAddressSuggestion = (suggestion: GursAddressSearchResult) => {
    postalEditSequenceRef.current += 1;
    setFormData((previous) => ({
      ...previous,
      addressLine1: suggestion.addressLine1,
      city: suggestion.postalName,
      postalCode: suggestion.postalCode,
      gursHouseNumberId: suggestion.gursHouseNumberId
    }));
    setFieldErrors((previous) => ({
      ...previous,
      addressLine1: undefined,
      city: undefined,
      postalCode: undefined
    }));
    setAddressSuggestions([]);
    setIsAddressListOpen(false);
    setActiveAddressIndex(-1);
  };

  const handleAddressKeyDown = (
    event: ReactKeyboardEvent<HTMLInputElement>
  ) => {
    if (event.key === 'Escape') {
      setIsAddressListOpen(false);
      setActiveAddressIndex(-1);
      return;
    }
    if (addressSuggestions.length === 0) return;

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setIsAddressListOpen(true);
      setActiveAddressIndex((current) =>
        current >= addressSuggestions.length - 1 ? 0 : current + 1
      );
      return;
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      setIsAddressListOpen(true);
      setActiveAddressIndex((current) =>
        current <= 0 ? addressSuggestions.length - 1 : current - 1
      );
      return;
    }
    if (
      event.key === 'Enter' &&
      isAddressListOpen &&
      activeAddressIndex >= 0
    ) {
      event.preventDefault();
      const suggestion = addressSuggestions[activeAddressIndex];
      if (suggestion) selectAddressSuggestion(suggestion);
    }
  };

  const handleAddressComboboxBlur = (
    event: ReactFocusEvent<HTMLDivElement>
  ) => {
    const nextTarget = event.relatedTarget;
    if (nextTarget instanceof Node && event.currentTarget.contains(nextTarget)) {
      return;
    }
    setIsAddressComboboxActive(false);
    setIsAddressListOpen(false);
    setActiveAddressIndex(-1);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const intent = activeCheckoutIntent;
    const setIntentFeedback = (feedback: SubmissionFeedback) => {
      setSubmissionFeedback((previous) => ({
        ...previous,
        [intent]: feedback
      }));
    };
    const setIntentError = (error: string | null) => {
      setSubmissionFeedback((previous) => ({
        ...previous,
        [intent]: { ...previous[intent], error }
      }));
    };
    const setIntentIssues = (issues: string[]) => {
      setSubmissionFeedback((previous) => ({
        ...previous,
        [intent]: { ...previous[intent], issues }
      }));
    };

    setLastSubmissionIntent(intent);
    setIntentFeedback({ error: null, issues: [] });
    if (!isCustomerType(formData.customerType)) {
      document.getElementById('order-customer-type')?.focus();
      setIntentError('Za nadaljevanje izberite vrsto naročnika.');
      return;
    }
    const customerType = formData.customerType;
    if (!isValidEmail(formData.email)) {
      setFieldErrors((previous) => ({
        ...previous,
        email: 'Vnesite veljaven e-poštni naslov.'
      }));
      document.getElementById('email')?.focus();
      setIntentError('Za nadaljevanje vnesite veljaven e-poštni naslov.');
      return;
    }
    const errors = validate();
    const firstInvalid = Object.keys(errors)[0] as FieldName | undefined;
    if (firstInvalid) {
      document.getElementById(firstInvalid)?.focus();
      setIntentError('Preverite označena obvezna polja.');
      return;
    }
    if (hasInvalidQuantity) {
      setIntentError('Preverite označene količine artiklov.');
      return;
    }
    if (
      !estimateState.estimate ||
      estimateState.error ||
      cartNeedsEstimate(items) ||
      cartHasBlockingIssue(items)
    ) {
      setIntentError(
        estimateState.error?.message ??
          (stockEnforcementEnabled
            ? 'Pred oddajo moramo potrditi cene, zalogo in izbrane različice.'
            : 'Pred oddajo moramo potrditi cene in izbrane različice.')
      );
      return;
    }
    const currentShipping = estimateState.estimate.shipping;
    if (intent === 'order' && currentShipping.status === 'manual_quote') {
      setIntentError(
        shippingManualQuoteMessage(currentShipping) ??
          'Poštnino je treba pred oddajo naročila določiti ročno.'
      );
      setIntentIssues(currentShipping.issues.map((issue) => issue.message));
      return;
    }

    const individualName =
      `${formData.firstName.trim()} ${formData.lastName.trim()}`.trim();
    const customerName =
      customerType === 'individual'
        ? individualName
        : formData.organizationName.trim();
    const contactName =
      customerType === 'individual'
        ? individualName
        : formData.contactName.trim();
    const commonPayload = {
      customerType,
      customerName,
      organizationName:
        customerType === 'individual'
          ? ''
          : formData.organizationName.trim(),
      contactName,
      email: formData.email.trim(),
      addressLine1: formData.addressLine1.trim(),
      addressLine2: formData.addressLine2.trim(),
      city: formData.city.trim(),
      postalCode: formData.postalCode.trim(),
      gursHouseNumberId: formData.gursHouseNumberId,
      countryCode: formData.countryCode,
      shippingConfigurationVersion: currentShipping.configurationVersion,
      quoteFingerprint: estimateState.estimate.quoteFingerprint,
      items: items.map((item) => ({
        variantId: item.variant!.id as number,
        quantity: item.quantity
      }))
    };
    const payload: SubmitOrderRequest | SubmitQuoteRequestRequest =
      intent === 'quote_request'
        ? {
            ...commonPayload,
            quoteReason: STOREFRONT_QUOTE_REASON,
            quoteMessage: formData.quoteMessage.trim()
          }
        : {
            ...commonPayload,
            reference:
              customerType === 'school' ? formData.reference.trim() : '',
            notes: formData.notes.trim()
          };

    idempotencyKeyRefs.current[intent] ??= createIdempotencyKey();
    const idempotencyKey = idempotencyKeyRefs.current[intent] as string;
    setSubmissionPhase(
      intent === 'order' ? 'submitting-order' : 'submitting-quote-request'
    );
    try {
      const response = await fetch(
        intent === 'order' ? '/api/orders' : '/api/quote-requests',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Idempotency-Key': idempotencyKey
          },
          body: JSON.stringify(payload)
        }
      );
      const responsePayload: unknown = await readJsonResponse(response, {});
      if (!response.ok) {
        const error = parseOrderApiError(
          responsePayload,
          intent === 'order'
            ? 'Oddaja naročila ni uspela.'
            : 'Oddaja povpraševanja ni uspela.'
        );
        setIntentIssues((error.issues ?? []).map((issue) => issue.message));
        if (
          error.code === 'SHIPPING_QUOTE_CHANGED' ||
          error.code === 'ESTIMATE_CHANGED'
        ) {
          idempotencyKeyRefs.current[intent] = null;
          setIntentError(error.message);
          setSubmissionPhase('idle');
          estimateState.refresh();
          return;
        }
        throw new Error(error.message);
      }

      const result = responsePayload as
        | SubmitOrderResponse
        | SubmitQuoteRequestResponse;
      const accessId = result.accessId?.trim();
      if (!accessId) {
        throw new Error(
          intent === 'order'
            ? 'Varne seje za prikaz potrditve ni bilo mogoče ustvariti.'
            : 'Varne seje za prikaz povpraševanja ni bilo mogoče ustvariti.'
        );
      }

      try {
        if (intent === 'order') {
          storeOrderAccessId(accessId);
        } else {
          const quoteResult = result as SubmitQuoteRequestResponse;
          storeQuoteAccessSession(accessId, quoteResult.csrfToken);
        }
      } catch (error) {
        throw new Error(
          error instanceof Error
            ? error.message
            : 'Varne seje za prikaz potrditve ni bilo mogoče shraniti.'
        );
      }

      flushSync(() => {
        setSubmissionPhase(
          intent === 'order'
            ? 'opening-order-confirmation'
            : 'opening-quote-confirmation'
        );
      });
      try {
        clearCart();
      } catch (error) {
        console.error(`[${intent}.submit] cart cleanup failed`, error);
      }
      try {
        sessionStorage.removeItem(FORM_STORAGE_KEY);
      } catch (error) {
        console.error(`[${intent}.submit] form cleanup failed`, error);
      }
      // Give the success live region a rendered frame before replacing the document.
      await waitForNextPaint();
      if (intent === 'order') {
        window.location.replace('/order/confirmation');
      } else {
        window.location.replace('/quote-request/confirmation');
      }
      return;
    } catch (error) {
      setIntentError(
        error instanceof Error
          ? error.message
          : intent === 'order'
            ? 'Oddaja naročila ni uspela.'
            : 'Oddaja povpraševanja ni uspela.'
      );
      setSubmissionPhase('idle');
    }
  };

  if (submissionPhase !== 'idle') {
    const isQuoteRequest = submissionPhase.includes('quote');
    const isOpeningConfirmation = submissionPhase.startsWith('opening');

    return (
      <OrderLoadingState
        heading={
          isOpeningConfirmation
            ? isQuoteRequest
              ? 'Odpiramo potrditev povpraševanja'
              : 'Odpiramo potrditev naročila'
            : isQuoteRequest
              ? 'Pošiljamo povpraševanje'
              : 'Oddajamo naročilo'
        }
        description={
          isOpeningConfirmation
            ? isQuoteRequest
              ? 'Povpraševanje je poslano. Prosimo, počakajte, da odpremo potrditev.'
              : 'Naročilo je oddano. Prosimo, počakajte, da odpremo potrditev.'
            : isQuoteRequest
              ? 'Varno shranjujemo vaše povpraševanje. Prosimo, počakajte in ne zapirajte strani.'
              : 'Varno shranjujemo vaše naročilo. Prosimo, počakajte in ne zapirajte strani.'
        }
        testId={
          isQuoteRequest
            ? 'quote-request-submission-handoff'
            : 'order-submission-handoff'
        }
        spinnerTestId={
          isQuoteRequest
            ? 'quote-request-submission-spinner'
            : 'order-submission-spinner'
        }
      />
    );
  }

  if (items.length === 0) {
    return (
      <div className="site-panel mx-auto max-w-2xl border-dashed p-8 text-center">
        <h1 className="site-heading-2">Košarica je prazna</h1>
        <p className="site-paragraph mt-3">
          Pred oddajo naročila dodajte vsaj en artikel.
        </p>
        <Link
          href="/products"
          className="site-button site-button--primary mt-6 inline-flex items-center justify-center"
        >
          Poglej izdelke
        </Link>
      </div>
    );
  }

  const totals = estimateState.estimate?.totals;
  const hasCustomerType = isCustomerType(formData.customerType);
  const isSchool = formData.customerType === 'school';
  const canContinue = hasCustomerType && isValidEmail(formData.email);
  const checkoutActionLabel = isQuoteRequest
    ? 'Zahtevaj ponudbo'
    : isSchool
      ? 'Pošlji naročilo v potrditev'
      : 'Oddaj naročilo';
  const checkoutActionDisabled =
    !canContinue ||
    isSubmitting ||
    estimateState.isLoading ||
    !estimateState.estimate ||
    hasInvalidQuantity ||
    cartNeedsEstimate(items) ||
    (!isQuoteRequest && shippingRequiresManualQuote) ||
    cartHasBlockingIssue(items);
  const addressSearchStatusMessage =
    addressSearchStatus === 'loading'
      ? 'Iščemo uradne naslove …'
      : addressSearchStatus === 'ready'
        ? addressSuggestions.length > 0
          ? `Na voljo je ${addressSuggestions.length} predlogov.`
          : 'Za vnos ni bilo najdenih predlogov. Naslov lahko vnesete ročno.'
        : addressSearchStatus === 'error'
          ? 'Predlogi naslovov trenutno niso na voljo. Naslov lahko vnesete ročno.'
          : '';
  const blockingCartMessage = items.find(
    (item) =>
      item.reconciliation.status === 'unavailable' ||
      item.reconciliation.status === 'needs_review'
  )?.reconciliation.message;
  const estimateStatusMessage = estimateState.isLoading
    ? stockEnforcementEnabled
      ? 'Preverjamo cene in zalogo …'
      : 'Preverjamo cene in izbrane različice …'
    : estimateState.error?.message ||
      blockingCartMessage ||
      (!estimateState.estimate
        ? stockEnforcementEnabled
          ? 'Pred oddajo moramo potrditi cene, zalogo in izbrane različice.'
          : 'Pred oddajo moramo potrditi cene in izbrane različice.'
        : null);

  const summary = (
    <div>
      <div className="space-y-3">
        {items.map((item) => (
          <CartLine
            key={item.lineId}
            item={item}
            estimateItem={
              typeof item.variant?.id === 'number'
                ? estimateByVariant.get(item.variant.id)
                : undefined
            }
            compact
            presentation="order-summary"
            onQuantityChange={(quantity) => setQuantity(item.lineId, quantity)}
            onQuantityValidityChange={onQuantityValidityChange}
            onRemove={() => removeItem(item.lineId)}
          />
        ))}
      </div>
      <dl className="mt-5 space-y-2 border-t border-[color:var(--site-divider-color)] pt-4 text-sm">
        <div className={ORDER_SUMMARY_CALCULATION_ROW_CLASS_NAME}>
          <dt>Cena brez DDV</dt>
          <dd className="font-semibold tabular-nums">
            {totals ? formatEuro(totals.net) : '—'}
          </dd>
        </div>
        <div className={ORDER_SUMMARY_CALCULATION_ROW_CLASS_NAME}>
          <dt>DDV</dt>
          <dd className="font-semibold tabular-nums">
            {totals ? formatEuro(totals.tax) : '—'}
          </dd>
        </div>
        <div
          className={ORDER_SUMMARY_CALCULATION_ROW_CLASS_NAME}
          data-testid="order-summary-shipping"
          data-summary-row="shipping"
          data-shipping-status={
            estimateState.estimate?.shipping.status ?? 'pending'
          }
        >
          <dt>Poštnina</dt>
          <dd className="font-semibold tabular-nums">
            {totals?.shipping !== null && totals?.shipping !== undefined
              ? formatEuro(totals.shipping)
              : estimateState.estimate?.shipping.status === 'manual_quote'
                ? 'Po dogovoru'
                : '—'}
          </dd>
        </div>
        <div className="flex justify-between border-t border-[color:var(--site-divider-color)] pt-3 text-base font-semibold">
          <dt>Skupaj z DDV</dt>
          <dd className="tabular-nums text-[color:var(--site-color-primary)]">
            {totals?.gross !== null && totals?.gross !== undefined
              ? formatEuro(totals.gross)
              : '—'}
          </dd>
        </div>
      </dl>
      <ShippingManualQuoteNotice
        calculation={estimateState.estimate?.shipping ?? null}
        className="site-radius-sm mt-3 bg-[color:var(--site-color-surface-muted)] p-3 text-xs text-[color:var(--site-color-danger)]"
      />
    </div>
  );

  return (
    <form onSubmit={handleSubmit} noValidate>
      <header className="mb-8">
        <p className="site-eyebrow">Zaključek nakupa</p>
        <h1
          className="site-heading-1 mt-2 !text-2xl sm:!text-3xl"
          data-testid="order-page-heading"
        >
          {isQuoteRequest ? 'Oddaja povpraševanja' : 'Oddaja naročila'}
        </h1>
      </header>

      {submitError ? (
        <div
          role="alert"
          className="site-radius-md mb-6 border border-[color:var(--site-color-danger)] bg-[color:var(--site-color-surface)] p-4 text-sm text-[color:var(--site-color-danger)]"
        >
          <p className="font-semibold">{submitError}</p>
          {submitIssues.length > 0 ? (
            <ul className="mt-2 list-disc pl-5">
              {submitIssues.map((issue) => (
                <li key={issue}>{issue}</li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      <div
        className="grid gap-8 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]"
        data-testid="order-checkout-layout"
      >
        <div className="min-w-0 space-y-6" data-testid="order-form-column">
          {quoteRequestsEnabled ? (
            <section
              className="site-card"
              data-testid="order-checkout-intent-section"
            >
              <h2 className="text-xl font-semibold">Kaj želite oddati?</h2>
              <p className="mt-2 text-sm text-[color:var(--site-color-text-muted)]">
                Izberite naročilo ali povpraševanje.
              </p>
              <div
                className="mt-4 grid gap-2 sm:grid-cols-2"
                role="radiogroup"
                aria-label="Način oddaje"
              >
                {CHECKOUT_INTENT_OPTIONS.map((option) => {
                  const selected = activeCheckoutIntent === option.value;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      role="radio"
                      aria-label={option.label}
                      aria-checked={selected}
                      disabled={isSubmitting}
                      onClick={() => selectCheckoutIntent(option.value)}
                      className={`site-radius-md min-h-16 border px-4 py-3 text-left transition ${
                        selected
                          ? 'border-[color:var(--site-color-primary)] bg-[color:var(--blue-50)] text-[color:var(--site-color-primary)]'
                          : 'border-[color:var(--site-border-color)] bg-[color:var(--site-color-surface)]'
                      }`}
                    >
                      <span className="block text-sm font-semibold">
                        {option.label}
                      </span>
                      <span className="mt-1 block text-xs font-normal leading-5 text-[color:var(--site-color-text-muted)]">
                        {option.description}
                      </span>
                    </button>
                  );
                })}
              </div>
            </section>
          ) : null}

          <section className="site-card">
            <h2 className="text-xl font-semibold">Vrsta naročnika</h2>
            <div
              id="order-customer-type"
              className="mt-4 grid gap-2 sm:grid-cols-3"
              role="radiogroup"
              aria-label="Vrsta naročnika"
              aria-required="true"
              aria-describedby={
                !hasCustomerType
                  ? 'order-customer-type-prompt'
                  : isSchool
                    ? 'order-school-notice-message'
                    : undefined
              }
              tabIndex={hasCustomerType ? -1 : 0}
            >
              {CUSTOMER_TYPE_FORM_OPTIONS.map((option) => {
                const selected = formData.customerType === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    onClick={() => updateField('customerType', option.value)}
                    className={`site-radius-md min-h-12 border px-3 py-2 text-sm font-semibold transition ${
                      selected
                        ? 'border-[color:var(--site-color-primary)] bg-[color:var(--blue-50)] text-[color:var(--site-color-primary)]'
                        : 'border-[color:var(--site-border-color)] bg-[color:var(--site-color-surface)]'
                    }`}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>
            {!hasCustomerType ? (
              <p
                id="order-customer-type-prompt"
                className="mt-3 text-sm text-[color:var(--site-color-text-muted)]"
              >
                Za nadaljevanje izberite vrsto naročnika.
              </p>
            ) : null}
            <div
              className="order-school-notice"
              data-testid="order-school-notice"
              data-visible={isSchool ? 'true' : 'false'}
              aria-hidden={!isSchool}
            >
              <div className="order-school-notice__content">
                <p
                  id="order-school-notice-message"
                  className="order-school-notice__message site-radius-sm bg-[color:var(--site-color-surface-muted)] p-3 text-sm text-[color:var(--site-color-text-muted)]"
                >
                  Po oddaji boste po e-pošti prejeli varno povezavo za
                  nalaganje naročilnice. Naročilo začnemo obdelovati šele po
                  prejemu in pregledu naročilnice.
                </p>
              </div>
            </div>
          </section>

          {hasCustomerType ? (
            <div className="site-card" data-testid="order-customer-details-card">
            <section data-testid="order-contact-section">
              <h2 className="text-xl font-semibold">Kontakt in naročnik</h2>
              <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <CheckoutInput
                id="email"
                type="email"
                autoComplete="email"
                label="E-poštni naslov *"
                value={formData.email}
                onChange={(event) => updateField('email', event.target.value)}
                error={fieldErrors.email}
                aria-describedby={
                  canContinue ? undefined : 'order-email-gate-message'
                }
                required
                className="sm:col-span-2"
              />
              {!canContinue ? (
                <p
                  id="order-email-gate-message"
                  data-testid="order-email-gate-message"
                  role="status"
                  aria-live="polite"
                  className="sm:col-span-2 text-sm text-[color:var(--site-color-text-muted)]"
                >
                  Za nadaljevanje vnesite veljaven e-poštni naslov.
                </p>
              ) : null}
              {formData.customerType === 'individual' ? (
                <>
                  <CheckoutInput
                    id="firstName"
                    autoComplete="given-name"
                    label="Ime *"
                    value={formData.firstName}
                    onChange={(event) => updateField('firstName', event.target.value)}
                    error={fieldErrors.firstName}
                    disabled={!canContinue}
                    required
                  />
                  <CheckoutInput
                    id="lastName"
                    autoComplete="family-name"
                    label="Priimek *"
                    value={formData.lastName}
                    onChange={(event) => updateField('lastName', event.target.value)}
                    error={fieldErrors.lastName}
                    disabled={!canContinue}
                    required
                  />
                </>
              ) : (
                <>
                  <CheckoutInput
                    id="organizationName"
                    autoComplete="organization"
                    label="Naziv naročnika *"
                    value={formData.organizationName}
                    onChange={(event) =>
                      updateField('organizationName', event.target.value)
                    }
                    error={fieldErrors.organizationName}
                    disabled={!canContinue}
                    required
                  />
                  <CheckoutInput
                    id="contactName"
                    autoComplete="name"
                    label="Kontaktna oseba *"
                    value={formData.contactName}
                    onChange={(event) =>
                      updateField('contactName', event.target.value)
                    }
                    error={fieldErrors.contactName}
                    disabled={!canContinue}
                    required
                  />
                </>
              )}
              </div>
            </section>

            <div
              className="mt-8 space-y-8"
              data-testid="order-email-gated-content"
              aria-disabled={!canContinue}
            >
              <section
                className="border-t border-[color:var(--site-divider-color)] pt-6"
                data-testid="order-address-section"
              >
              <input
                type="hidden"
                name="gursHouseNumberId"
                value={formData.gursHouseNumberId}
              />
              <input type="hidden" name="countryCode" value="SI" />
              <div
                role="group"
                aria-label="Naslovni podatki"
                className="storefront-checkout-address-row grid gap-4 sm:grid-cols-2 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)_minmax(8.75rem,0.7fr)_minmax(0,1fr)] xl:gap-0"
                data-testid="order-address-fields"
              >
                <div
                  className="relative min-w-0"
                  onFocusCapture={() => setIsAddressComboboxActive(true)}
                  onBlurCapture={handleAddressComboboxBlur}
                >
                  <CheckoutInput
                    id="addressLine1"
                    autoComplete="off"
                    label="Naslov *"
                    value={formData.addressLine1}
                    onChange={(event) =>
                      updateAddressField('addressLine1', event.target.value)
                    }
                    onKeyDown={handleAddressKeyDown}
                    role="combobox"
                    aria-autocomplete="list"
                    aria-expanded={isAddressListOpen}
                    aria-busy={addressSearchStatus === 'loading'}
                    aria-controls={addressListboxId}
                    aria-describedby={`${addressListboxId}-status`}
                    aria-activedescendant={
                      isAddressListOpen && activeAddressIndex >= 0
                        ? `${addressListboxId}-option-${activeAddressIndex}`
                        : undefined
                    }
                    error={fieldErrors.addressLine1}
                    disabled={!canContinue}
                    shellClassName="storefront-checkout-address-row-field"
                    required
                  />
                  <p
                    id={`${addressListboxId}-status`}
                    role="status"
                    aria-live="polite"
                    className={
                      addressSearchStatus === 'error'
                        ? 'mt-1 text-xs text-[color:var(--site-color-text-muted)]'
                        : 'sr-only'
                    }
                  >
                    {addressSearchStatusMessage}
                  </p>
                  {canContinue && isAddressListOpen ? (
                    <ul
                      id={addressListboxId}
                      role="listbox"
                      aria-label="Predlogi naslovov"
                      className="site-panel absolute z-10 mt-1 max-h-64 w-full overflow-auto p-1 text-sm"
                    >
                      {addressSuggestions.map((suggestion, index) => (
                        <li key={suggestion.gursHouseNumberId}>
                          <button
                            id={`${addressListboxId}-option-${index}`}
                            type="button"
                            role="option"
                            aria-selected={activeAddressIndex === index}
                            tabIndex={-1}
                            onPointerDown={(event) => {
                              if (event.pointerType === 'mouse') {
                                event.preventDefault();
                              }
                            }}
                            onClick={() => selectAddressSuggestion(suggestion)}
                            className={`site-radius-sm w-full px-3 py-2 text-left transition ${
                              activeAddressIndex === index
                                ? 'bg-[color:var(--site-color-surface-muted)]'
                                : 'hover:bg-[color:var(--site-color-surface-muted)]'
                            }`}
                          >
                            <span className="block font-semibold text-[color:var(--site-color-text)]">
                              {suggestion.addressLine1}
                            </span>
                            <span className="mt-0.5 block text-xs text-[color:var(--site-color-text-muted)]">
                              {suggestion.postalCode} {suggestion.postalName}
                            </span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </div>
                <CheckoutInput
                  id="addressLine2"
                  autoComplete="off"
                  label="Stanovanje"
                  value={formData.addressLine2}
                  onChange={(event) =>
                    updateField('addressLine2', event.target.value)
                  }
                  disabled={!canContinue}
                  className="min-w-0"
                  shellClassName="storefront-checkout-address-row-field"
                />
                <PostalLocationCombobox
                  field="postalCode"
                  label="Poštna številka *"
                  value={formData.postalCode}
                  onChange={(value) =>
                    updateAddressField(
                      'postalCode',
                      value.replace(/\D/g, '').slice(0, 4)
                    )
                  }
                  error={fieldErrors.postalCode}
                  disabled={!canContinue}
                  lookupEnabled={!formData.gursHouseNumberId}
                  editSequenceRef={postalEditSequenceRef}
                  onResolve={applyPostalLocation}
                  className="min-w-0"
                  shellClassName="storefront-checkout-address-row-field"
                />
                <PostalLocationCombobox
                  field="postalName"
                  label="Poštni kraj *"
                  value={formData.city}
                  onChange={(value) => updateAddressField('city', value)}
                  error={fieldErrors.city}
                  disabled={!canContinue}
                  lookupEnabled={!formData.gursHouseNumberId}
                  editSequenceRef={postalEditSequenceRef}
                  onResolve={applyPostalLocation}
                  className="min-w-0"
                  shellClassName="storefront-checkout-address-row-field"
                />
              </div>
              </section>

              {isQuoteRequest ? (
                <section
                  className="border-t border-[color:var(--site-divider-color)] pt-6"
                  data-testid="quote-request-details-section"
                >
                  <CheckoutTextarea
                    id="quoteMessage"
                    label="Opombe"
                    value={formData.quoteMessage}
                    onChange={(event) =>
                      updateField('quoteMessage', event.target.value)
                    }
                    maxLength={2000}
                    rows={1}
                    disabled={!canContinue}
                    shellClassName="storefront-checkout-textarea-shell--compact"
                  />
                </section>
              ) : (
                <section
                  className="border-t border-[color:var(--site-divider-color)] pt-6"
                  data-testid="order-payment-section"
                >
                  <div className="site-radius-md border border-[color:var(--site-border-color)] bg-[color:var(--site-color-surface-muted)] p-4">
                    <p className="font-semibold">Obdelava plačila</p>
                    <p className="mt-1 text-sm text-[color:var(--site-color-text-muted)]">
                      Plačilne kartice ne potrebujete. Neposredno naročilo bomo po
                      oddaji pregledali in ga posebej potrdili ali zavrnili.
                    </p>
                  </div>
                  <div className="mt-5 grid gap-4">
                    {isSchool ? (
                      <CheckoutInput
                        id="reference"
                        label="Vaša referenca ali št. naročilnice"
                        value={formData.reference}
                        onChange={(event) =>
                          updateField('reference', event.target.value)
                        }
                        disabled={!canContinue}
                      />
                    ) : null}
                    <CheckoutTextarea
                      id="notes"
                      label="Opombe"
                      value={formData.notes}
                      onChange={(event) =>
                        updateField('notes', event.target.value)
                      }
                      rows={1}
                      disabled={!canContinue}
                      shellClassName="storefront-checkout-textarea-shell--compact"
                    />
                  </div>
                </section>
              )}
            </div>
            </div>
          ) : null}

          <details className="site-card lg:hidden">
            <summary className="cursor-pointer font-semibold">
              {isQuoteRequest ? 'Povzetek povpraševanja' : 'Povzetek naročila'} (
              {items.length})
            </summary>
            <div className="mt-4">{summary}</div>
          </details>
        </div>

        <aside
          className="hidden min-w-0 lg:block lg:self-stretch"
          data-testid="order-summary-column"
        >
          <div className="site-card lg:sticky lg:top-8">
            <h2 className="text-xl font-semibold">
              {isQuoteRequest
                ? 'Povzetek povpraševanja'
                : 'Povzetek naročila'}
            </h2>
            <div className="mt-5">{summary}</div>

            {estimateStatusMessage ? (
              <p
                className={`mt-4 text-sm ${
                  estimateState.isLoading
                    ? 'text-[color:var(--site-color-text-muted)]'
                    : 'text-[color:var(--site-color-danger)]'
                }`}
              >
                {estimateStatusMessage}
              </p>
            ) : null}

            <button
              type="submit"
              name="checkoutIntent"
              value={activeCheckoutIntent}
              disabled={checkoutActionDisabled}
              className="site-button site-button--primary mt-5 w-full"
            >
              {checkoutActionLabel}
            </button>
            {isQuoteRequest ? (
              <p className="mt-3 text-xs leading-5 text-[color:var(--site-color-text-muted)]">
                Povpraševanje ni naročilo in ne povzroči obveznosti plačila.
                Ponudbo boste lahko sprejeli ali zavrnili.
              </p>
            ) : null}
            <p className="mt-3 text-xs leading-5 text-[color:var(--site-color-text-muted)]">
              Z oddajo potrjujete pravilnost podatkov in se strinjate s{' '}
              <Link href="/terms" className="site-link">
                pogoji poslovanja
              </Link>
              .
            </p>
          </div>
        </aside>
      </div>

      <div className="sticky bottom-0 z-20 -mx-[var(--site-gutter)] mt-6 border-t border-[color:var(--site-divider-color)] bg-[color:var(--site-color-surface)] px-[var(--site-gutter)] py-3 shadow-[0_-8px_24px_rgba(15,23,42,0.08)] lg:hidden">
        {estimateStatusMessage ? (
          <p
            className={`mb-2 text-xs ${
              estimateState.isLoading
                ? 'text-[color:var(--site-color-text-muted)]'
                : 'text-[color:var(--site-color-danger)]'
            }`}
            role={estimateState.isLoading ? 'status' : 'alert'}
          >
            {estimateStatusMessage}
          </p>
        ) : null}
        <button
          type="submit"
          name="checkoutIntent"
          value={activeCheckoutIntent}
          disabled={checkoutActionDisabled}
          className="site-button site-button--primary w-full"
        >
          {checkoutActionLabel}
        </button>
        {isQuoteRequest ? (
          <p className="mt-2 text-center text-[10px] leading-4 text-[color:var(--site-color-text-muted)]">
            Povpraševanje ni naročilo in ne povzroči obveznosti plačila. Ponudbo
            boste lahko sprejeli ali zavrnili.
          </p>
        ) : null}
        <p className="mt-2 text-center text-[10px] text-[color:var(--site-color-text-muted)]">
          Z oddajo se strinjate s{' '}
          <Link href="/terms" className="site-link">
            pogoji poslovanja
          </Link>
          .
        </p>
      </div>
    </form>
  );
}
