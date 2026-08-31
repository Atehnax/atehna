'use client';

import { useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CUSTOMER_TYPE_FORM_OPTIONS, type CustomerType } from '@/shared/domain/order/customerType';
import { AdminTablePrimaryActionButton } from '@/shared/ui/admin-table';
import { Button } from '@/shared/ui/button';
import {
  Dialog,
  dialogActionButtonClassName,
  dialogDescriptionClassName,
  dialogFooterClassName
} from '@/shared/ui/dialog';
import { Input } from '@/shared/ui/input';
import { Spinner } from '@/shared/ui/loading';
import { CustomSelect } from '@/shared/ui/select';
import { useToast } from '@/shared/ui/toast';

type ManualQuoteRequestDraft = {
  customerType: CustomerType;
  organizationName: string;
  contactName: string;
  email: string;
  addressLine1: string;
  addressLine2: string;
  postalCode: string;
  city: string;
  reference: string;
  intakeSource: 'admin_email' | 'admin_testing';
  requestedItemName: string;
  requestedQuantity: string;
  customerMessage: string;
};

type CatalogChoice = {
  catalogItemId: number;
  catalogVariantId: number;
  sku: string;
  name: string;
  unit: string;
};

const emptyDraft = (): ManualQuoteRequestDraft => ({
  customerType: 'company',
  organizationName: '',
  contactName: '',
  email: '',
  addressLine1: '',
  addressLine2: '',
  postalCode: '',
  city: '',
  reference: '',
  intakeSource: 'admin_email',
  requestedItemName: '',
  requestedQuantity: '1',
  customerMessage: ''
});

const fieldLabelClassName = 'space-y-1 text-[11px] font-semibold text-slate-700';
const fieldClassName = 'h-9 px-3 text-[12px] font-normal';
const textareaClassName =
  "min-h-20 w-full resize-y rounded-md border border-slate-300 bg-white px-3 py-2 font-['Inter',system-ui,sans-serif] text-[12px] font-normal text-slate-900 outline-none transition focus:border-[#3e67d6] focus:ring-1 focus:ring-[#3e67d6] disabled:cursor-default disabled:opacity-60";

const isValidEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(value.trim());
const isValidPostalCode = (value: string) => /^\d{4}$/u.test(value.trim());
const INTAKE_SOURCE_OPTIONS = [
  { value: 'admin_email', label: 'Prejeto po e-pošti' },
  { value: 'admin_testing', label: 'Testni vnos' }
] as const;

export default function AdminCreateManualQuoteRequestButton() {
  const router = useRouter();
  const { toast } = useToast();
  const initialFocusRef = useRef<HTMLInputElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [draft, setDraft] = useState<ManualQuoteRequestDraft>(emptyDraft);
  const [formError, setFormError] = useState<string | null>(null);
  const [catalogChoices, setCatalogChoices] = useState<CatalogChoice[]>([]);
  const [selectedCatalogChoice, setSelectedCatalogChoice] =
    useState<CatalogChoice | null>(null);
  const [isCatalogLoading, setIsCatalogLoading] = useState(false);
  const [isCatalogMenuOpen, setIsCatalogMenuOpen] = useState(false);
  const [catalogWarning, setCatalogWarning] = useState<string | null>(null);

  const filteredCatalogChoices = useMemo(() => {
    const query = draft.requestedItemName.trim().toLocaleLowerCase('sl');
    if (!query) return catalogChoices.slice(0, 8);
    return catalogChoices
      .filter(
        (choice) =>
          choice.name.toLocaleLowerCase('sl').includes(query) ||
          choice.sku.toLocaleLowerCase('sl').includes(query)
      )
      .slice(0, 8);
  }, [catalogChoices, draft.requestedItemName]);

  const updateDraft = <Key extends keyof ManualQuoteRequestDraft>(
    key: Key,
    value: ManualQuoteRequestDraft[Key]
  ) => setDraft((current) => ({ ...current, [key]: value }));

  const closeDialog = () => {
    if (isCreating) return;
    setIsOpen(false);
    setFormError(null);
    setDraft(emptyDraft());
    setSelectedCatalogChoice(null);
    setIsCatalogMenuOpen(false);
  };

  const loadCatalogChoices = async () => {
    if (catalogChoices.length > 0 || isCatalogLoading) return;
    setIsCatalogLoading(true);
    setCatalogWarning(null);
    try {
      const response = await fetch('/api/admin/catalog-items');
      const payload = (await response.json().catch(() => null)) as {
        items?: CatalogChoice[];
        warning?: string;
        message?: string;
      } | null;
      if (!response.ok) {
        throw new Error(payload?.message ?? 'Kataloga artiklov ni bilo mogoče naložiti.');
      }
      setCatalogChoices(payload?.items ?? []);
      setCatalogWarning(payload?.warning ?? null);
    } catch (error) {
      setCatalogWarning(
        error instanceof Error
          ? error.message
          : 'Kataloga artiklov ni bilo mogoče naložiti.'
      );
    } finally {
      setIsCatalogLoading(false);
    }
  };

  const openDialog = () => {
    setIsOpen(true);
    void loadCatalogChoices();
  };

  const selectCatalogChoice = (choice: CatalogChoice) => {
    setSelectedCatalogChoice(choice);
    updateDraft('requestedItemName', choice.name);
    setIsCatalogMenuOpen(false);
  };

  const createQuoteRequest = async () => {
    if (isCreating) return;

    const organizationName = draft.organizationName.trim();
    const contactName = draft.contactName.trim();
    const email = draft.email.trim().toLowerCase();
    const addressLine1 = draft.addressLine1.trim();
    const postalCode = draft.postalCode.trim();
    const city = draft.city.trim();
    const requestedItemName = draft.requestedItemName.trim();
    const requestedQuantity = Number(draft.requestedQuantity);
    const customerMessage = draft.customerMessage.trim();

    if (
      (draft.customerType !== 'individual' && !organizationName) ||
      !contactName ||
      !email ||
      !requestedItemName ||
      !Number.isSafeInteger(requestedQuantity) ||
      requestedQuantity < 1 ||
      requestedQuantity > 1_000_000
    ) {
      setFormError('Izpolnite obvezne podatke naročnika in zahtevanega artikla.');
      return;
    }
    if (!isValidEmail(email)) {
      setFormError('Vnesite veljaven e-poštni naslov.');
      return;
    }
    if (postalCode && !isValidPostalCode(postalCode)) {
      setFormError('Poštna številka mora vsebovati štiri številke.');
      return;
    }
    setFormError(null);
    setIsCreating(true);
    try {
      const customerName =
        draft.customerType === 'individual' ? contactName : organizationName;
      const response = await fetch('/api/admin/quote-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerType: draft.customerType,
          customerName,
          organizationName:
            draft.customerType === 'individual' ? null : organizationName,
          contactName,
          email,
          addressLine1: addressLine1 || null,
          addressLine2: draft.addressLine2.trim() || null,
          postalCode: postalCode || null,
          city: city || null,
          countryCode: 'SI',
          reference: draft.reference.trim() || null,
          quoteReason: 'formal_offer',
          customerMessage: customerMessage || null,
          intakeSource: draft.intakeSource,
          requestedItems: [
            {
              catalogItemId: selectedCatalogChoice?.catalogItemId ?? null,
              catalogVariantId: selectedCatalogChoice?.catalogVariantId ?? null,
              sku: selectedCatalogChoice?.sku ?? null,
              productName: selectedCatalogChoice?.name ?? requestedItemName,
              quantity: requestedQuantity,
              unit: selectedCatalogChoice?.unit ?? 'kos'
            }
          ]
        })
      });
      const payload = (await response.json().catch(() => null)) as {
        quoteRequestId?: number;
        id?: number;
        message?: string;
      } | null;
      if (!response.ok) {
        throw new Error(payload?.message ?? 'Povpraševanja ni bilo mogoče ustvariti.');
      }

      const quoteRequestId = Number(payload?.quoteRequestId ?? payload?.id);
      if (!Number.isSafeInteger(quoteRequestId) || quoteRequestId <= 0) {
        throw new Error('Strežnik ni vrnil veljavnega povpraševanja.');
      }

      setIsOpen(false);
      setDraft(emptyDraft());
      setSelectedCatalogChoice(null);
      setIsCatalogMenuOpen(false);
      toast.success(payload?.message ?? 'Povpraševanje je ustvarjeno.');
      router.push(`/admin/orders/quotes/${quoteRequestId}`);
      router.refresh();
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Povpraševanja ni bilo mogoče ustvariti.';
      setFormError(message);
      toast.error(message);
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <>
      <AdminTablePrimaryActionButton
        type="button"
        onClick={openDialog}
        disabled={isCreating}
        aria-label="Novo povpraševanje"
        data-testid="quote-table-create-request"
        className="!rounded-md !px-4"
      >
        Novo povpraševanje
      </AdminTablePrimaryActionButton>

      <Dialog
        open={isOpen}
        onOpenChange={(open) => {
          if (!open) closeDialog();
        }}
        title="Novo povpraševanje"
        isDismissable={!isCreating}
        initialFocusRef={initialFocusRef}
        panelClassName="max-w-2xl"
        footer={
          <div className={dialogFooterClassName}>
            <Button
              type="button"
              variant="outline"
              className={dialogActionButtonClassName}
              onClick={closeDialog}
              disabled={isCreating}
            >
              Prekliči
            </Button>
            <Button
              type="button"
              variant="primary"
              className={dialogActionButtonClassName}
              onClick={() => void createQuoteRequest()}
              disabled={isCreating}
              data-testid="quote-create-submit"
            >
              {isCreating ? (
                <span className="inline-flex items-center gap-1.5">
                  <Spinner size="sm" className="text-white/90" />
                  Ustvarjam …
                </span>
              ) : (
                'Ustvari povpraševanje'
              )}
            </Button>
          </div>
        }
      >
        <p className={dialogDescriptionClassName}>
          Vnesite identiteto naročnika in zahtevani artikel. Naslov lahko dopolnite pozneje, vendar mora biti popoln pred izdajo ponudbe.
        </p>

        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className={fieldLabelClassName}>
            <span>Tip naročnika</span>
            <CustomSelect<CustomerType>
              value={draft.customerType}
              onChange={(customerType) => updateDraft('customerType', customerType)}
              options={CUSTOMER_TYPE_FORM_OPTIONS}
              ariaLabel="Tip naročnika"
              className="h-9 w-full px-3 text-[12px] font-normal"
            />
          </label>

          {draft.customerType !== 'individual' ? (
            <label className={fieldLabelClassName}>
              <span>Naziv organizacije *</span>
              <Input
                ref={initialFocusRef}
                value={draft.organizationName}
                onChange={(event) => updateDraft('organizationName', event.target.value)}
                className={fieldClassName}
                aria-label="Naziv organizacije"
                autoComplete="organization"
              />
            </label>
          ) : null}

          <label className={fieldLabelClassName}>
            <span>Kontaktna oseba *</span>
            <Input
              ref={draft.customerType === 'individual' ? initialFocusRef : undefined}
              value={draft.contactName}
              onChange={(event) => updateDraft('contactName', event.target.value)}
              className={fieldClassName}
              aria-label="Kontaktna oseba"
              autoComplete="name"
            />
          </label>

          <label className={fieldLabelClassName}>
            <span>E-pošta *</span>
            <Input
              type="email"
              value={draft.email}
              onChange={(event) => updateDraft('email', event.target.value)}
              className={fieldClassName}
              aria-label="E-pošta"
              autoComplete="email"
            />
          </label>

          <div className="flex items-center justify-between gap-3 border-t border-slate-200 pt-2 sm:col-span-2">
            <span className="text-[11px] font-semibold text-slate-700">Naslovni podatki</span>
            <span className="text-right text-[10px] font-medium text-slate-500">
              Neobvezni ob vnosu · obvezni pred izdajo ponudbe
            </span>
          </div>

          <label className={fieldLabelClassName}>
            <span>Naslov</span>
            <Input
              value={draft.addressLine1}
              onChange={(event) => updateDraft('addressLine1', event.target.value)}
              className={fieldClassName}
              aria-label="Naslov"
              autoComplete="address-line1"
            />
          </label>

          <label className={fieldLabelClassName}>
            <span>Dodatni naslov</span>
            <Input
              value={draft.addressLine2}
              onChange={(event) => updateDraft('addressLine2', event.target.value)}
              className={fieldClassName}
              aria-label="Dodatni naslov"
              autoComplete="address-line2"
            />
          </label>
        </div>

        <div className="mt-3 grid grid-cols-[minmax(0,0.7fr)_minmax(0,1.3fr)_80px] gap-3">
          <label className={fieldLabelClassName}>
            <span>Poštna številka</span>
            <Input
              inputMode="numeric"
              value={draft.postalCode}
              onChange={(event) => updateDraft('postalCode', event.target.value)}
              className={fieldClassName}
              aria-label="Poštna številka"
              autoComplete="postal-code"
            />
          </label>
          <label className={fieldLabelClassName}>
            <span>Kraj</span>
            <Input
              value={draft.city}
              onChange={(event) => updateDraft('city', event.target.value)}
              className={fieldClassName}
              aria-label="Kraj"
              autoComplete="address-level2"
            />
          </label>
          <label className={fieldLabelClassName}>
            <span>Država</span>
            <Input
              readOnly
              value="SI"
              className={`${fieldClassName} text-center`}
              aria-label="Država"
            />
          </label>
        </div>

        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className={fieldLabelClassName}>
            <span>Vir vnosa</span>
            <CustomSelect<'admin_email' | 'admin_testing'>
              value={draft.intakeSource}
              onChange={(intakeSource) => updateDraft('intakeSource', intakeSource)}
              options={INTAKE_SOURCE_OPTIONS}
              ariaLabel="Vir vnosa"
              className="h-9 w-full px-3 text-[12px] font-normal"
            />
          </label>
          <label className={fieldLabelClassName}>
            <span>Referenca</span>
            <Input
              value={draft.reference}
              onChange={(event) => updateDraft('reference', event.target.value)}
              className={fieldClassName}
              aria-label="Referenca"
            />
          </label>
        </div>

        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1fr)_150px]">

          <label className={`${fieldLabelClassName} relative`}>
            <span>Zahtevani artikel *</span>
            <Input
              value={draft.requestedItemName}
              onChange={(event) => {
                updateDraft('requestedItemName', event.target.value);
                setSelectedCatalogChoice(null);
                setIsCatalogMenuOpen(true);
              }}
              onFocus={() => {
                setIsCatalogMenuOpen(true);
                void loadCatalogChoices();
              }}
              onBlur={() => {
                window.setTimeout(() => setIsCatalogMenuOpen(false), 100);
              }}
              className={fieldClassName}
              aria-label="Zahtevani artikel"
              placeholder={isCatalogLoading ? 'Nalagam katalog …' : 'Poiščite po nazivu ali SKU'}
              autoComplete="off"
            />
            {isCatalogMenuOpen && filteredCatalogChoices.length > 0 ? (
              <div
                role="listbox"
                aria-label="Kataloški artikli"
                className="absolute left-0 right-0 top-[58px] z-[150] max-h-56 overflow-y-auto rounded-lg border border-slate-200 bg-white p-1 shadow-xl"
              >
                {filteredCatalogChoices.map((choice) => (
                  <button
                    key={choice.catalogVariantId}
                    type="button"
                    role="option"
                    aria-selected={selectedCatalogChoice?.catalogVariantId === choice.catalogVariantId}
                    className="flex w-full items-center justify-between gap-3 rounded-md px-2.5 py-2 text-left text-[12px] font-normal text-slate-700 hover:bg-sky-50 hover:text-sky-800"
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => selectCatalogChoice(choice)}
                  >
                    <span className="min-w-0 truncate">{choice.name}</span>
                    <span className="shrink-0 text-[10px] font-semibold text-slate-400">
                      {choice.sku}
                    </span>
                  </button>
                ))}
              </div>
            ) : null}
            {selectedCatalogChoice ? (
              <span className="block text-[10px] font-medium text-emerald-700">
                Kataloški artikel · {selectedCatalogChoice.sku}
              </span>
            ) : draft.requestedItemName.trim() ? (
              <span className="block text-[10px] font-medium text-amber-700">
                Prosti vnos – artikel ni povezan s katalogom
              </span>
            ) : catalogWarning ? (
              <span className="block text-[10px] font-medium text-amber-700">
                {catalogWarning}
              </span>
            ) : null}
          </label>

          <label className={fieldLabelClassName}>
            <span>Količina *</span>
            <div className="flex h-9 overflow-hidden rounded-md border border-slate-300 bg-white focus-within:border-[#3e67d6] focus-within:ring-1 focus-within:ring-[#3e67d6]">
              <Input
                type="number"
                min="1"
                max="1000000"
                step="1"
                value={draft.requestedQuantity}
                onChange={(event) => updateDraft('requestedQuantity', event.target.value)}
                className="h-full min-w-0 flex-1 rounded-none border-0 px-3 text-[12px] font-normal focus:!border-0 focus:!ring-0"
                aria-label="Količina zahtevanega artikla"
              />
              <span className="inline-flex items-center border-l border-slate-200 bg-slate-50 px-3 text-[11px] font-semibold text-slate-500">
                {selectedCatalogChoice?.unit ?? 'kos'}
              </span>
            </div>
          </label>
        </div>

        <label className={`${fieldLabelClassName} mt-3 block`}>
          <span>Opomba</span>
          <textarea
            value={draft.customerMessage}
            onChange={(event) => updateDraft('customerMessage', event.target.value)}
            className={textareaClassName}
            aria-label="Opis povpraševanja"
          />
        </label>

        {formError ? (
          <p role="alert" className="mt-3 text-[12px] font-medium text-rose-600">
            {formError}
          </p>
        ) : null}
      </Dialog>
    </>
  );
}
