'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type InputHTMLAttributes,
  type TextareaHTMLAttributes
} from 'react';
import { useCartStore } from '@/commercial/cart/store';
import { cartHasBlockingIssue } from '@/commercial/cart/cartTypes';
import CartLine from '@/commercial/components/storefront/CartLine';
import { useProductAppearance } from '@/commercial/components/ProductAppearanceProvider';
import {
  parseOrderApiError,
  type SubmitOrderRequest,
  type SubmitOrderResponse
} from '@/commercial/order/contracts';
import { useOrderQuote } from '@/commercial/order/useOrderQuote';
import { SLOVENIAN_ADDRESSES } from '@/commercial/data/slovenianAddresses';
import {
  CUSTOMER_TYPE_FORM_OPTIONS,
  type CustomerType
} from '@/shared/domain/order/customerType';
import { formatEuro } from '@/shared/domain/formatting';

const FORM_STORAGE_KEY = 'atehna-order-form-v2';

type OrderFormData = {
  customerType: CustomerType;
  firstName: string;
  lastName: string;
  organizationName: string;
  contactName: string;
  email: string;
  addressLine1: string;
  city: string;
  postalCode: string;
  reference: string;
  notes: string;
};

type FieldName = keyof Omit<OrderFormData, 'customerType'>;
type FieldErrors = Partial<Record<FieldName, string>>;

const initialForm: OrderFormData = {
  customerType: 'school',
  firstName: '',
  lastName: '',
  organizationName: '',
  contactName: '',
  email: '',
  addressLine1: '',
  city: '',
  postalCode: '',
  reference: '',
  notes: ''
};

const isValidEmail = (value: string) =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());

const createIdempotencyKey = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `atehna-${Date.now()}-${Math.random().toString(36).slice(2)}`;
};

function CheckoutInput({
  label,
  error,
  className,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  error?: string;
}) {
  const id = String(props.id);
  return (
    <div className={className}>
      <label
        htmlFor={id}
        className="mb-1.5 block text-sm font-semibold text-[color:var(--site-color-text)]"
      >
        {label}
      </label>
      <input
        {...props}
        id={id}
        className={`site-field w-full ${
          error ? '!border-[color:var(--site-color-danger)]' : ''
        }`}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${id}-error` : undefined}
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
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement> & { label: string }) {
  const id = String(props.id);
  return (
    <div className={className}>
      <label
        htmlFor={id}
        className="mb-1.5 block text-sm font-semibold text-[color:var(--site-color-text)]"
      >
        {label}
      </label>
      <textarea
        {...props}
        id={id}
        className="site-field min-h-28 w-full resize-y py-3"
      />
    </div>
  );
}

export default function OrderPageClient() {
  const router = useRouter();
  const appearance = useProductAppearance();
  const items = useCartStore((state) => state.items);
  const setQuantity = useCartStore((state) => state.setQuantity);
  const removeItem = useCartStore((state) => state.removeItem);
  const clearCart = useCartStore((state) => state.clearCart);
  const quoteState = useOrderQuote(items, items.length > 0);
  const [formData, setFormData] = useState<OrderFormData>(initialForm);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitIssues, setSubmitIssues] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const idempotencyKeyRef = useRef<string | null>(null);

  const quoteByVariant = useMemo(
    () =>
      new Map(
        (quoteState.quote?.items ?? []).map((item) => [item.variantId, item])
      ),
    [quoteState.quote]
  );
  const formFingerprint = JSON.stringify({ formData, items: items.map((item) => [item.lineId, item.quantity]) });

  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(FORM_STORAGE_KEY);
      if (!saved) return;
      setFormData({ ...initialForm, ...(JSON.parse(saved) as Partial<OrderFormData>) });
    } catch {
      sessionStorage.removeItem(FORM_STORAGE_KEY);
    }
  }, []);

  useEffect(() => {
    sessionStorage.setItem(FORM_STORAGE_KEY, JSON.stringify(formData));
  }, [formData]);

  useEffect(() => {
    idempotencyKeyRef.current = null;
  }, [formFingerprint]);

  const addressSuggestions = useMemo(() => {
    const query = formData.addressLine1.trim().toLocaleLowerCase('sl');
    if (query.length < 2) return [];
    return SLOVENIAN_ADDRESSES.filter((address) =>
      address.toLocaleLowerCase('sl').includes(query)
    ).slice(0, 6);
  }, [formData.addressLine1]);

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

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitError(null);
    setSubmitIssues([]);
    const errors = validate();
    const firstInvalid = Object.keys(errors)[0] as FieldName | undefined;
    if (firstInvalid) {
      document.getElementById(firstInvalid)?.focus();
      setSubmitError('Preverite označena obvezna polja.');
      return;
    }
    if (!quoteState.quote || quoteState.error || cartHasBlockingIssue(items)) {
      setSubmitError(
        quoteState.error?.message ??
          'Pred oddajo moramo potrditi cene, zalogo in izbrane različice.'
      );
      return;
    }

    const individualName = `${formData.firstName.trim()} ${formData.lastName.trim()}`.trim();
    const customerName =
      formData.customerType === 'individual'
        ? individualName
        : formData.organizationName.trim();
    const contactName =
      formData.customerType === 'individual'
        ? individualName
        : formData.contactName.trim();
    const deliveryAddress = `${formData.addressLine1.trim()}, ${formData.postalCode.trim()} ${formData.city.trim()}`;
    const payload: SubmitOrderRequest = {
      customerType: formData.customerType,
      customerName,
      organizationName:
        formData.customerType === 'individual'
          ? ''
          : formData.organizationName.trim(),
      contactName,
      email: formData.email.trim(),
      addressLine1: formData.addressLine1.trim(),
      city: formData.city.trim(),
      postalCode: formData.postalCode.trim(),
      deliveryAddress,
      reference: formData.reference.trim(),
      notes: formData.notes.trim(),
      items: items.map((item) => ({
        variantId: item.variant!.id as number,
        quantity: item.quantity
      }))
    };

    idempotencyKeyRef.current ??= createIdempotencyKey();
    setIsSubmitting(true);
    try {
      const response = await fetch('/api/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': idempotencyKeyRef.current
        },
        body: JSON.stringify(payload)
      });
      const responsePayload: unknown = await response.json().catch(() => ({}));
      if (!response.ok) {
        const error = parseOrderApiError(responsePayload, 'Oddaja naročila ni uspela.');
        setSubmitIssues((error.issues ?? []).map((issue) => issue.message));
        throw new Error(error.message);
      }
      const result = responsePayload as SubmitOrderResponse;
      if (!result.confirmationToken && !result.confirmationUrl) {
        throw new Error('Potrditvene povezave ni bilo mogoče ustvariti.');
      }
      clearCart();
      sessionStorage.removeItem(FORM_STORAGE_KEY);
      const confirmationUrl =
        result.confirmationUrl ||
        `/order/confirmation?token=${encodeURIComponent(result.confirmationToken)}`;
      router.push(confirmationUrl);
    } catch (error) {
      setSubmitError(
        error instanceof Error ? error.message : 'Oddaja naročila ni uspela.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

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

  const totals = quoteState.quote?.totals;
  const isSchool = formData.customerType === 'school';
  const blockingCartMessage = items.find(
    (item) =>
      item.reconciliation.status === 'unavailable' ||
      item.reconciliation.status === 'needs_review'
  )?.reconciliation.message;
  const quoteStatusMessage = quoteState.isLoading
    ? 'Preverjamo cene in zalogo …'
    : quoteState.error?.message ||
      blockingCartMessage ||
      (!quoteState.quote
        ? 'Pred oddajo moramo potrditi cene, zalogo in izbrane različice.'
        : null);

  const summary = (
    <div>
      <div className="space-y-3">
        {items.map((item) => (
          <CartLine
            key={item.lineId}
            item={item}
            quoteItem={
              typeof item.variant?.id === 'number'
                ? quoteByVariant.get(item.variant.id)
                : undefined
            }
            compact
            onQuantityChange={(quantity) => setQuantity(item.lineId, quantity)}
            onRemove={() => removeItem(item.lineId)}
          />
        ))}
      </div>
      <dl className="mt-5 space-y-2 border-t border-[color:var(--site-divider-color)] pt-4 text-sm">
        <div className="flex justify-between">
          <dt>Cena brez DDV</dt>
          <dd className="font-semibold tabular-nums">
            {totals ? formatEuro(totals.net) : '—'}
          </dd>
        </div>
        <div className="flex justify-between">
          <dt>DDV</dt>
          <dd className="font-semibold tabular-nums">
            {totals ? formatEuro(totals.tax) : '—'}
          </dd>
        </div>
        <div className="flex justify-between">
          <dt>Dostava</dt>
          <dd className="font-semibold text-[color:var(--site-color-success)]">
            {appearance.pricing.freeShippingLabel}
          </dd>
        </div>
        <div className="flex justify-between border-t border-[color:var(--site-divider-color)] pt-3 text-base font-semibold">
          <dt>Skupaj z DDV</dt>
          <dd className="tabular-nums text-[color:var(--site-color-primary)]">
            {totals ? formatEuro(totals.gross) : '—'}
          </dd>
        </div>
      </dl>
    </div>
  );

  return (
    <form onSubmit={handleSubmit} noValidate>
      <header className="mb-8">
        <p className="site-eyebrow">Zaključek nakupa</p>
        <h1 className="site-heading-1 mt-2">Oddaja naročila</h1>
        <p className="site-paragraph mt-3 max-w-3xl">
          Dostava po Sloveniji je brezplačna. Plačilo uredimo ročno po ponudbi
          ali predračunu; spletno plačilo ni potrebno.
        </p>
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

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_25rem]">
        <div className="space-y-6">
          <section className="site-card">
            <h2 className="text-xl font-semibold">Vrsta naročnika</h2>
            <div
              className="mt-4 grid gap-2 sm:grid-cols-3"
              role="radiogroup"
              aria-label="Vrsta naročnika"
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
            {isSchool ? (
              <p className="site-radius-sm mt-4 bg-[color:var(--site-color-surface-muted)] p-3 text-sm text-[color:var(--site-color-text-muted)]">
                Šolsko naročilo je zahteva za ročno potrditev. Po pregledu
                prejmete ponudbo in navodila za naročilnico.
              </p>
            ) : (
              <p className="site-radius-sm mt-4 bg-[color:var(--site-color-surface-muted)] p-3 text-sm text-[color:var(--site-color-text-muted)]">
                Z oddajo pošiljate zavezujoče naročilo po prikazanem izračunu.
              </p>
            )}
          </section>

          <section className="site-card">
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
                className="sm:col-span-2"
              />
              {formData.customerType === 'individual' ? (
                <>
                  <CheckoutInput
                    id="firstName"
                    autoComplete="given-name"
                    label="Ime *"
                    value={formData.firstName}
                    onChange={(event) => updateField('firstName', event.target.value)}
                    error={fieldErrors.firstName}
                  />
                  <CheckoutInput
                    id="lastName"
                    autoComplete="family-name"
                    label="Priimek *"
                    value={formData.lastName}
                    onChange={(event) => updateField('lastName', event.target.value)}
                    error={fieldErrors.lastName}
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
                    className="sm:col-span-2"
                  />
                  <CheckoutInput
                    id="contactName"
                    autoComplete="name"
                    label="Kontaktna oseba (neobvezno)"
                    value={formData.contactName}
                    onChange={(event) =>
                      updateField('contactName', event.target.value)
                    }
                    error={fieldErrors.contactName}
                    className="sm:col-span-2"
                  />
                </>
              )}
            </div>
          </section>

          <section className="site-card">
            <h2 className="text-xl font-semibold">Naslov za dostavo</h2>
            <p className="mt-1 text-sm text-[color:var(--site-color-success)]">
              Brezplačna dostava po Sloveniji
            </p>
            <div className="mt-5 grid gap-4 sm:grid-cols-[1fr_10rem]">
              <div className="relative sm:col-span-2">
                <CheckoutInput
                  id="addressLine1"
                  autoComplete="street-address"
                  label="Naslov *"
                  value={formData.addressLine1}
                  onChange={(event) =>
                    updateField('addressLine1', event.target.value)
                  }
                  error={fieldErrors.addressLine1}
                />
                {addressSuggestions.length > 0 ? (
                  <ul className="site-panel absolute z-10 mt-1 max-h-52 w-full overflow-auto p-1 text-sm">
                    {addressSuggestions.map((address) => (
                      <li key={address}>
                        <button
                          type="button"
                          onClick={() => updateField('addressLine1', address)}
                          className="site-radius-sm w-full px-3 py-2 text-left hover:bg-[color:var(--site-color-surface-muted)]"
                        >
                          {address}
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
              <CheckoutInput
                id="city"
                autoComplete="address-level2"
                label="Kraj *"
                value={formData.city}
                onChange={(event) => updateField('city', event.target.value)}
                error={fieldErrors.city}
              />
              <CheckoutInput
                id="postalCode"
                autoComplete="postal-code"
                inputMode="numeric"
                pattern="[0-9]{4}"
                maxLength={4}
                label="Poštna številka *"
                value={formData.postalCode}
                onChange={(event) => updateField('postalCode', event.target.value)}
                error={fieldErrors.postalCode}
              />
            </div>
          </section>

          <section className="site-card">
            <h2 className="text-xl font-semibold">Plačilo in dodatni podatki</h2>
            <div className="site-radius-md mt-4 border border-[color:var(--site-border-color)] bg-[color:var(--site-color-surface-muted)] p-4">
              <p className="font-semibold">Ročna obdelava plačila</p>
              <p className="mt-1 text-sm text-[color:var(--site-color-text-muted)]">
                Po oddaji pripravimo ponudbo ali predračun. Plačilne kartice ne
                potrebujete.
              </p>
            </div>
            <div className="mt-5 grid gap-4">
              <CheckoutInput
                id="reference"
                label="Vaša referenca ali št. naročilnice"
                value={formData.reference}
                onChange={(event) => updateField('reference', event.target.value)}
              />
              <CheckoutTextarea
                id="notes"
                label="Opombe"
                value={formData.notes}
                onChange={(event) => updateField('notes', event.target.value)}
              />
            </div>
          </section>

          <details className="site-card lg:hidden">
            <summary className="cursor-pointer font-semibold">
              Povzetek naročila ({items.length})
            </summary>
            <div className="mt-4">{summary}</div>
          </details>
        </div>

        <aside className="hidden lg:block lg:self-start">
          <div className="site-card lg:sticky lg:top-8">
            <h2 className="text-xl font-semibold">Povzetek naročila</h2>
            <div className="mt-5">{summary}</div>

            {quoteStatusMessage ? (
              <p
                className={`mt-4 text-sm ${
                  quoteState.isLoading
                    ? 'text-[color:var(--site-color-text-muted)]'
                    : 'text-[color:var(--site-color-danger)]'
                }`}
              >
                {quoteStatusMessage}
              </p>
            ) : null}

            <button
              type="submit"
              disabled={
                isSubmitting ||
                quoteState.isLoading ||
                !quoteState.quote ||
                cartHasBlockingIssue(items)
              }
              className="site-button site-button--primary mt-5 w-full"
            >
              {isSubmitting
                ? 'Oddajanje …'
                : isSchool
                  ? 'Pošlji zahtevo za naročilo'
                  : 'Oddaj zavezujoče naročilo'}
            </button>
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
        {quoteStatusMessage ? (
          <p
            className={`mb-2 text-xs ${
              quoteState.isLoading
                ? 'text-[color:var(--site-color-text-muted)]'
                : 'text-[color:var(--site-color-danger)]'
            }`}
            role={quoteState.isLoading ? 'status' : 'alert'}
          >
            {quoteStatusMessage}
          </p>
        ) : null}
        <button
          type="submit"
          disabled={
            isSubmitting ||
            quoteState.isLoading ||
            !quoteState.quote ||
            cartHasBlockingIssue(items)
          }
          className="site-button site-button--primary w-full"
        >
          {isSubmitting
            ? 'Oddajanje …'
            : isSchool
              ? 'Pošlji zahtevo'
              : 'Oddaj naročilo'}
        </button>
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
