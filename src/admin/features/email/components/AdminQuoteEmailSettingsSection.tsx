'use client';

import { forwardRef, useEffect, useImperativeHandle, useMemo, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import {
  cloneDefaultQuoteEmailSettings,
  normalizeQuoteEmailSettings,
  QUOTE_EMAIL_EDITABLE_EVENT_DEFINITIONS,
  QUOTE_EMAIL_TEMPLATE_BODY_MAX_LENGTH,
  QUOTE_EMAIL_TEMPLATE_SUBJECT_MAX_LENGTH,
  type QuoteEmailEventType,
  type QuoteEmailSettings
} from '@/shared/domain/quote/quoteEmailSettings';
import {
  buildQuoteEmailMessage,
  type QuoteEmailAudience
} from '@/shared/domain/quote/quoteEmailTemplates';
import type { OrderEmailSettings } from '@/shared/domain/order/orderEmailSettings';
import type { QuoteEmailAdminState } from '@/shared/server/quoteEmailSettings';
import {
  adminTableBodyCellCenterClassName,
  adminTableBodyCellLeftClassName,
  adminTableBulkHeaderButtonClassName,
  adminTableHeaderCellCenterClassName,
  adminTableHeaderCellLeftClassName,
  adminTableNeutralIconButtonClassName,
  adminTableRowHeightClassName,
  adminTableSelectedDangerIconButtonClassName,
  adminWindowCardClassName,
  adminWindowCardStyle
} from '@/shared/ui/admin-table';
import { Button } from '@/shared/ui/button';
import AdminCheckbox from '@/shared/ui/checkbox/admin-checkbox';
import { ConfirmDialog } from '@/shared/ui/confirm-dialog';
import { IconButton } from '@/shared/ui/icon-button';
import { TrashCanIcon } from '@/shared/ui/icons/AdminActionIcons';
import { Input } from '@/shared/ui/input';
import { CustomSelect } from '@/shared/ui/select';
import { Table, TBody, TD, TH, THead, TR } from '@/shared/ui/table';
import {
  adminInputFocusTokenClasses,
  adminPlaceholderTokenClasses
} from '@/shared/ui/theme/tokens';
import { useToast } from '@/shared/ui/toast';
import CustomerEmailConfirmationDialog from '@/admin/features/email/components/CustomerEmailConfirmationDialog';
import EmailQueueMetricCard from '@/admin/features/email/components/EmailQueueMetricCard';
import { getQuoteEmailEventStatusPresentation } from '@/admin/features/email/emailEventStatusPresentation';
import { useCustomerEmailConfirmation } from '@/admin/features/email/useCustomerEmailConfirmation';
import EmailMessagePreview from '@/admin/features/email/components/EmailMessagePreview';

const inputClassName = 'h-9 px-3 text-[13px] leading-5';
const textareaClassName =
  `min-h-24 w-full resize-y rounded-md border border-slate-300 bg-white px-3 py-2 font-['Inter',system-ui,sans-serif] text-[13px] leading-5 text-slate-900 outline-none transition-[border-color,box-shadow,color,opacity] disabled:cursor-default disabled:bg-[color:var(--field-locked-bg)] disabled:opacity-60 ${adminInputFocusTokenClasses} ${adminPlaceholderTokenClasses}`;

type EditableEvent = (typeof QUOTE_EMAIL_EDITABLE_EVENT_DEFINITIONS)[number]['value'];
type PendingJob = QuoteEmailAdminState['queue']['pendingJobs'][number];

export type AdminQuoteEmailSettingsHandle = {
  save: () => Promise<void>;
  setEnabled: (enabled: boolean) => void;
  setStockAcceptanceMode: (
    mode: QuoteEmailSettings['stockAcceptanceMode']
  ) => void;
};

export type AdminQuoteEmailSaveState = {
  hasChanges: boolean;
  saving: boolean;
  saveDisabled: boolean;
  updatedAt: string;
  enabled: boolean;
  stockAcceptanceMode: QuoteEmailSettings['stockAcceptanceMode'];
  mutationsDisabled: boolean;
};

type AdminQuoteEmailSettingsSectionProps = {
  initialState: QuoteEmailAdminState;
  sharedSettings: OrderEmailSettings;
  onSaveStateChange?: (state: AdminQuoteEmailSaveState) => void;
};

const quoteEmailEventLabelByType = new Map<string, string>(
  QUOTE_EMAIL_EDITABLE_EVENT_DEFINITIONS.map((definition) => [
    definition.value,
    definition.label
  ])
);
const quoteTemplateEventOptions = QUOTE_EMAIL_EDITABLE_EVENT_DEFINITIONS.map(
  ({ value, label }) => ({ value, label })
);
const QUOTE_EMAIL_TEMPLATE_VARIABLES = [
  'request_number',
  'offer_number'
] as const;
const quoteEmailPreviewAudienceOptions = [
  { value: 'customer', label: 'Stranka' },
  { value: 'admin', label: 'Administrator' }
] as const satisfies ReadonlyArray<{
  value: QuoteEmailAudience;
  label: string;
}>;
const QUOTE_EMAIL_PREVIEW_REQUEST_NUMBER = 'POV-2026-001';
const QUOTE_EMAIL_PREVIEW_OFFER_NUMBER = 'PON-2026-001';
const quoteEmailPreviewDetails: Partial<Record<EditableEvent, string>> = {
  quote_clarification_requested:
    'Prosimo, potrdite želeno količino in pričakovani rok dobave.',
  quote_accepted: 'Ustvarjeno je bilo naročilo #PREIZKUS.',
  quote_declined: 'Razlog: izbrana je bila druga ponudba.',
  quote_withdrawn: 'Ponudba je bila umaknjena zaradi spremembe pogojev.',
  quote_acceptance_blocked_stock:
    'Za izbrano količino trenutno ni dovolj razpoložljive zaloge.',
  quote_delivery_failed: 'Primer napake dostave: prejemnik ni dosegljiv.'
};
const quoteEmailPreviewVariables = QUOTE_EMAIL_TEMPLATE_VARIABLES.map(
  (name) => ({
    name,
    value:
      name === 'request_number'
        ? QUOTE_EMAIL_PREVIEW_REQUEST_NUMBER
        : QUOTE_EMAIL_PREVIEW_OFFER_NUMBER
  })
);

function formatAudience(value: string): string {
  if (value === 'customer') return 'Stranka';
  if (value === 'admin') return 'Administratorji';
  return value;
}

function comparable(config: QuoteEmailSettings): string {
  const { updatedAt: _updatedAt, ...stored } = config;
  return JSON.stringify(stored);
}

function formatDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? '—'
    : new Intl.DateTimeFormat('sl-SI', {
        dateStyle: 'short',
        timeStyle: 'short'
      }).format(date);
}

function QuoteTemplateEditorCard({
  audience,
  title,
  description,
  subject,
  body,
  disabled,
  onSubjectChange,
  onBodyChange,
  onReset,
  className = ''
}: {
  audience: 'customer' | 'admin';
  title: string;
  description: string;
  subject: string;
  body: string;
  disabled: boolean;
  onSubjectChange: (value: string) => void;
  onBodyChange: (value: string) => void;
  onReset: () => void;
  className?: string;
}) {
  const audienceLabel = audience === 'customer' ? 'stranko' : 'administratorja';
  const subjectId = `quote-email-template-${audience}-subject`;
  const bodyId = `quote-email-template-${audience}-body`;

  return (
    <section
      className={`min-w-0 rounded-lg border border-slate-200 bg-slate-50/60 p-4 ${className}`}
      data-testid={`quote-email-template-${audience}`}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h4 className="text-sm font-semibold text-slate-900">{title}</h4>
          <p className="mt-0.5 text-xs leading-4 text-slate-600">
            {description}
          </p>
        </div>
        <Button
          type="button"
          variant="default"
          size="toolbar"
          className={adminTableBulkHeaderButtonClassName}
          disabled={disabled}
          onClick={onReset}
          aria-label={`Ponastavi privzeto predlogo za ${audienceLabel}`}
          data-testid={`quote-email-template-${audience}-reset`}
        >
          Ponastavi privzeto
        </Button>
      </div>

      <div className="mt-3 space-y-3">
        <div>
          <label htmlFor={subjectId} className="block">
            <span className="block text-xs font-semibold text-slate-700">
              Zadeva za {audienceLabel}
            </span>
            <span className="mt-0.5 block text-xs text-slate-500">
              Uporabite lahko spodaj navedene spremenljivke.
            </span>
          </label>
          <Input
            id={subjectId}
            aria-label={`Zadeva za ${audienceLabel}`}
            className={`${inputClassName} mt-1.5`}
            disabled={disabled}
            maxLength={QUOTE_EMAIL_TEMPLATE_SUBJECT_MAX_LENGTH}
            value={subject}
            onChange={(event) => onSubjectChange(event.target.value)}
            data-testid={`quote-email-template-${audience}-subject`}
          />
        </div>
        <div>
          <label htmlFor={bodyId} className="block">
            <span className="block text-xs font-semibold text-slate-700">
              Vsebina za {audienceLabel}
            </span>
            <span className="mt-0.5 block text-xs text-slate-500">
              Vnesite navadno besedilo; sistemski podatki dogodka se dodajo ob
              pošiljanju.
            </span>
          </label>
          <textarea
            id={bodyId}
            aria-label={`Vsebina za ${audienceLabel}`}
            className={`${textareaClassName} mt-1.5 min-h-40`}
            disabled={disabled}
            maxLength={QUOTE_EMAIL_TEMPLATE_BODY_MAX_LENGTH}
            value={body}
            onChange={(event) => onBodyChange(event.target.value)}
            data-testid={`quote-email-template-${audience}-body`}
          />
        </div>
      </div>

      <div className="mt-3 border-t border-slate-200 pt-3">
        <p className="text-xs font-medium text-slate-700">
          Dovoljene spremenljivke
        </p>
        <div
          className="mt-1.5 flex flex-wrap gap-1.5"
          aria-label={`Dovoljene spremenljivke za ${audienceLabel}`}
        >
          {QUOTE_EMAIL_TEMPLATE_VARIABLES.map((variable) => (
            <code
              key={variable}
              className="max-w-full break-all rounded-md border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700"
            >
              {`{{${variable}}}`}
            </code>
          ))}
        </div>
      </div>
    </section>
  );
}

const AdminQuoteEmailSettingsSection = forwardRef<
  AdminQuoteEmailSettingsHandle,
  AdminQuoteEmailSettingsSectionProps
>(function AdminQuoteEmailSettingsSection(
  { initialState, sharedSettings, onSaveStateChange },
  ref
) {
  const { toast } = useToast();
  const customerEmailConfirmation = useCustomerEmailConfirmation();
  const [state, setState] = useState(initialState);
  const [draft, setDraft] = useState(() =>
    normalizeQuoteEmailSettings(initialState.config)
  );
  const [selectedEvent, setSelectedEvent] =
    useState<EditableEvent>('quote_request_submitted');
  const [quotePreviewAudience, setQuotePreviewAudience] =
    useState<QuoteEmailAudience>('customer');
  const [saving, setSaving] = useState(false);
  const [retryingJobId, setRetryingJobId] = useState<string | null>(null);
  const [cancellingJobId, setCancellingJobId] = useState<string | null>(null);
  const [cancelCandidate, setCancelCandidate] = useState<PendingJob | null>(null);
  const hasChanges = useMemo(
    () => comparable(draft) !== comparable(state.config),
    [draft, state.config]
  );
  const selectedTemplateStatusPresentation =
    getQuoteEmailEventStatusPresentation(selectedEvent);
  const quotePreview = useMemo(() => {
    try {
      const message = buildQuoteEmailMessage({
        eventType: selectedEvent,
        audience: quotePreviewAudience,
        recipientEmail:
          quotePreviewAudience === 'customer'
            ? 'ana.novak@example.com'
            : 'admin@example.invalid',
        requestNumber: QUOTE_EMAIL_PREVIEW_REQUEST_NUMBER,
        offerNumber: QUOTE_EMAIL_PREVIEW_OFFER_NUMBER,
        offerUrl:
          selectedEvent === 'quote_issued'
            ? 'https://example.invalid/quote/offer'
            : null,
        detail: quoteEmailPreviewDetails[selectedEvent] ?? null,
        sharedSettings: {
          ...sharedSettings,
          senderName: sharedSettings.senderName.trim() || 'Atehna',
          fromEmail: 'preview@example.invalid',
          replyToEmail: '',
          imageAttachment: null
        },
        quoteSettings: draft
      });
      return { subject: message.subject, html: message.html, error: null };
    } catch {
      return {
        subject: '',
        html: '',
        error: 'Predogleda s trenutnimi nastavitvami ni mogoče prikazati.'
      };
    }
  }, [draft, quotePreviewAudience, selectedEvent, sharedSettings]);
  const mutationsDisabled = !state.schemaReady || !state.flags.admin;

  const updateEvent = (
    eventType: QuoteEmailEventType,
    patch: Partial<QuoteEmailSettings['events'][QuoteEmailEventType]>
  ) => {
    setDraft((current) => ({
      ...current,
      events: {
        ...current.events,
        [eventType]: { ...current.events[eventType], ...patch }
      }
    }));
  };

  const updateTemplate = (
    audience: 'customer' | 'admin',
    field: 'subject' | 'body',
    value: string
  ) => {
    setDraft((current) => ({
      ...current,
      templates: {
        ...current.templates,
        [selectedEvent]: {
          ...current.templates[selectedEvent],
          [audience]: {
            ...current.templates[selectedEvent][audience],
            [field]: value
          }
        }
      }
    }));
  };

  const resetTemplate = (audience: 'customer' | 'admin') => {
    const defaults =
      cloneDefaultQuoteEmailSettings().templates[selectedEvent][audience];
    setDraft((current) => ({
      ...current,
      templates: {
        ...current.templates,
        [selectedEvent]: {
          ...current.templates[selectedEvent],
          [audience]: defaults
        }
      }
    }));
  };

  const save = async () => {
    if (saving || !hasChanges || mutationsDisabled) return;
    const submittedConfig = draft;
    const submittedComparable = comparable(submittedConfig);
    setSaving(true);
    try {
      const response = await fetch('/api/admin/quote-email-settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ config: submittedConfig })
      });
      const payload = await response.json().catch(() => ({})) as {
        message?: string;
        errors?: string[];
        state?: QuoteEmailAdminState;
      };
      if (!response.ok || !payload.state) {
        throw new Error(payload.errors?.join(' ') || payload.message || 'Nastavitev ni mogoče shraniti.');
      }
      setState(payload.state);
      const persistedConfig = normalizeQuoteEmailSettings(payload.state.config);
      setDraft((current) =>
        comparable(current) === submittedComparable ? persistedConfig : current
      );
      toast.success('Nastavitve e-pošte za ponudbe so shranjene.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Nastavitev ni mogoče shraniti.');
    } finally {
      setSaving(false);
    }
  };

  const refreshQueue = async (): Promise<boolean> => {
    try {
      const response = await fetch('/api/admin/quote-email-settings', {
        method: 'GET',
        cache: 'no-store'
      });
      const payload = await response.json().catch(() => ({})) as {
        state?: QuoteEmailAdminState;
      };
      if (!response.ok || !payload.state) return false;
      setState((current) => ({
        ...current,
        schemaReady: payload.state!.schemaReady,
        flags: payload.state!.flags,
        queue: payload.state!.queue
      }));
      return true;
    } catch {
      return false;
    }
  };

  const retry = async (
    jobId: string,
    customerEmailConfirmationToken?: string
  ) => {
    const failure = state.queue.recentFailures.find((job) => job.id === jobId);
    if (
      retryingJobId ||
      mutationsDisabled ||
      !state.flags.emailDelivery ||
      !failure?.retryEligible
    ) return;
    setRetryingJobId(jobId);
    try {
      const response = await fetch(`/api/admin/quote-email-jobs/${jobId}/retry`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...(customerEmailConfirmationToken
            ? { customerEmailConfirmationToken }
            : {})
        })
      });
      const payload = await response.json().catch(() => ({})) as { message?: string };
      if (
        customerEmailConfirmation.handleConfirmationRequired(
          response,
          payload,
          (confirmationToken) => retry(jobId, confirmationToken)
        )
      ) {
        return;
      }
      if (!response.ok) throw new Error(payload.message || 'Ponovitev ni uspela.');
      if (!(await refreshQueue())) {
        setState((current) => ({
          ...current,
          queue: {
            ...current.queue,
            pending: current.queue.pending + 1,
            failed: Math.max(0, current.queue.failed - 1),
            recentFailures: current.queue.recentFailures.filter((job) => job.id !== jobId)
          }
        }));
      }
      toast.success(payload.message || 'E-pošta je znova v čakalni vrsti.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Ponovitev ni uspela.');
    } finally {
      setRetryingJobId(null);
    }
  };

  const cancelPendingEmail = async () => {
    const candidate = cancelCandidate;
    if (!candidate || cancellingJobId || retryingJobId || mutationsDisabled) return;
    setCancellingJobId(candidate.id);
    try {
      const response = await fetch(`/api/admin/quote-email-jobs/${candidate.id}`, {
        method: 'DELETE'
      });
      const payload = await response.json().catch(() => ({})) as { message?: string };
      if (!response.ok) {
        throw new Error(payload.message || 'E-pošte ni bilo mogoče odstraniti.');
      }
      setCancelCandidate(null);
      if (!(await refreshQueue())) {
        setState((current) => ({
          ...current,
          queue: {
            ...current.queue,
            pending: Math.max(0, current.queue.pending - 1),
            pendingJobs: current.queue.pendingJobs.filter(
              (job) => job.id !== candidate.id
            )
          }
        }));
      }
      toast.success(payload.message || 'E-pošta je odstranjena iz čakalne vrste.');
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : 'E-pošte ni bilo mogoče odstraniti.'
      );
      await refreshQueue();
    } finally {
      setCancellingJobId(null);
    }
  };

  const saveDisabled = !hasChanges || saving || mutationsDisabled;

  useImperativeHandle(ref, () => ({
    save: () => save(),
    setEnabled: (enabled) => {
      if (mutationsDisabled) return;
      setDraft((current) => ({ ...current, enabled }));
    },
    setStockAcceptanceMode: (stockAcceptanceMode) => {
      if (mutationsDisabled) return;
      setDraft((current) => ({ ...current, stockAcceptanceMode }));
    }
  }));

  useEffect(() => {
    onSaveStateChange?.({
      hasChanges,
      saving,
      saveDisabled,
      updatedAt: state.config.updatedAt,
      enabled: draft.enabled,
      stockAcceptanceMode: draft.stockAcceptanceMode,
      mutationsDisabled
    });
  }, [
    draft.enabled,
    draft.stockAcceptanceMode,
    hasChanges,
    mutationsDisabled,
    onSaveStateChange,
    saveDisabled,
    saving,
    state.config.updatedAt
  ]);

  return (
    <>
    <section className="font-['Inter',system-ui,sans-serif]" aria-labelledby="quote-email-events-heading" data-testid="quote-email-settings-section">
      <div
        className={`${adminWindowCardClassName} divide-y divide-slate-200 bg-white`}
        style={adminWindowCardStyle}
        data-testid="quote-email-editor-card"
      >
        <section aria-labelledby="quote-email-events-heading" className="min-w-0 bg-white px-5 py-4">
          <div className="mb-3">
            <h3 id="quote-email-events-heading" className="text-base font-semibold text-slate-900">Dogodki ponudbe</h3>
            <p className="mt-1 max-w-3xl text-sm leading-5 text-slate-600">
              Stranka pomeni e-poštni naslov, ki je shranjen na povpraševanju.
              Vsak dogodek lahko ločeno obvesti stranko in administratorje.
            </p>
          </div>
          <div className="overflow-x-auto rounded-lg border border-slate-200" data-testid="quote-email-event-grid">
            <Table className="min-w-[640px] table-fixed text-[12px]" data-testid="quote-email-event-table">
              <THead>
                <TR className="hover:bg-transparent">
                  <TH scope="col" className={adminTableHeaderCellLeftClassName}>Dogodek</TH>
                  <TH scope="col" className={`${adminTableHeaderCellCenterClassName} w-36`}>Stranka</TH>
                  <TH scope="col" className={`${adminTableHeaderCellCenterClassName} w-44`}>Administratorji</TH>
                </TR>
              </THead>
              <TBody className="divide-y divide-slate-200 bg-white">
                {QUOTE_EMAIL_EDITABLE_EVENT_DEFINITIONS.map((definition) => {
                  const event = draft.events[definition.value];
                  const statusPresentation =
                    getQuoteEmailEventStatusPresentation(definition.value);
                  return (
                    <TR
                      key={definition.value}
                      className={`${adminTableRowHeightClassName} ${statusPresentation.rowClassName}`}
                      data-testid={`quote-email-event-row-${definition.value}`}
                      data-status-tone={statusPresentation.tone}
                    >
                      <TH scope="row" className={`${adminTableBodyCellLeftClassName} border-b-0 !font-normal`}>
                        <span className="block font-medium text-slate-900">{definition.label}</span>
                        <span className="mt-0.5 block text-xs leading-4 text-slate-500">
                          {definition.description}
                        </span>
                      </TH>
                      <TD className={adminTableBodyCellCenterClassName}>
                        <AdminCheckbox
                          checked={event.customer}
                          disabled={mutationsDisabled}
                          onChange={(change) => updateEvent(definition.value, { customer: change.target.checked })}
                          aria-label={`${definition.label}: stranka`}
                          data-testid={`quote-email-event-${definition.value}-customer`}
                        />
                      </TD>
                      <TD className={adminTableBodyCellCenterClassName}>
                        <AdminCheckbox
                          checked={event.admins}
                          disabled={mutationsDisabled}
                          onChange={(change) => updateEvent(definition.value, { admins: change.target.checked })}
                          aria-label={`${definition.label}: admin`}
                          data-testid={`quote-email-event-${definition.value}-admins`}
                        />
                      </TD>
                    </TR>
                  );
                })}
              </TBody>
            </Table>
          </div>
          <p className="mt-3 text-xs leading-5 text-slate-500">Varnostna OTP e-pošta ostane sistemska in ni izpostavljena kot poslovna predloga.</p>
        </section>

        <section
          aria-labelledby="quote-email-template-heading"
          className={`min-w-0 px-5 py-4 ${selectedTemplateStatusPresentation.sectionClassName}`}
          data-testid="quote-email-message-templates"
          data-status-tone={selectedTemplateStatusPresentation.tone}
        >
          <div className="mb-3">
            <h3
              id="quote-email-template-heading"
              className="text-base font-semibold text-slate-900"
            >
              Predloge sporočil
            </h3>
            <p className="mt-1 max-w-3xl text-sm leading-5 text-slate-600">
              Za vsak dogodek posebej nastavite zadevo in uvodno vsebino za
              posamezne skupine prejemnikov. Sistemski podatki ponudbe se
              dodajo samodejno.
            </p>
          </div>

          <div className="max-w-sm">
            <label htmlFor="quote-email-template-event" className="block">
              <span className="block text-xs font-semibold text-slate-700">
                Dogodek ponudbe
              </span>
              <span className="mt-0.5 block text-xs text-slate-500">
                Izberite dogodek, katerega predloge so prikazane spodaj.
              </span>
            </label>
            <CustomSelect<EditableEvent>
              id="quote-email-template-event"
              testId="quote-email-template-event"
              value={selectedEvent}
              onChange={setSelectedEvent}
              options={quoteTemplateEventOptions}
              ariaLabel="Dogodek ponudbe"
              containerClassName="mt-1.5"
              triggerClassName="!h-9 !px-3 !text-[13px] !leading-5"
            />
          </div>

          <div
            className="mt-3 grid min-w-0 gap-3 lg:grid-cols-2"
            data-testid="quote-email-template-grid"
          >
            {(['customer', 'admin'] as const).map((audience) => {
              const template = draft.templates[selectedEvent][audience];
              return (
                <QuoteTemplateEditorCard
                  key={audience}
                  audience={audience}
                  title={audience === 'customer' ? 'Stranka' : 'Administrator'}
                  description={
                    audience === 'customer'
                      ? 'Predloga uporablja javne podatke povpraševanja ali ponudbe.'
                      : 'Administratorska predloga lahko uporablja številko povpraševanja in številko ponudbe.'
                  }
                  subject={template.subject}
                  body={template.body}
                  disabled={mutationsDisabled}
                  onSubjectChange={(value) =>
                    updateTemplate(audience, 'subject', value)
                  }
                  onBodyChange={(value) =>
                    updateTemplate(audience, 'body', value)
                  }
                  onReset={() => resetTemplate(audience)}
                  className="lg:col-span-2"
                />
              );
            })}
          </div>

          <EmailMessagePreview
            subject={quotePreview.subject}
            html={quotePreview.html}
            variables={quoteEmailPreviewVariables}
            error={quotePreview.error}
            testId="quote-email-preview"
            controls={
              <>
                <label htmlFor="quote-email-preview-audience" className="block">
                  <span className="block text-xs font-semibold text-slate-700">
                    Prejemnik predogleda
                  </span>
                </label>
                <CustomSelect<QuoteEmailAudience>
                  id="quote-email-preview-audience"
                  testId="quote-email-preview-audience"
                  value={quotePreviewAudience}
                  onChange={setQuotePreviewAudience}
                  options={quoteEmailPreviewAudienceOptions}
                  ariaLabel="Prejemnik predogleda ponudbe"
                  containerClassName="mt-1.5"
                  triggerClassName="!h-9 !px-3 !text-[13px] !leading-5"
                />
              </>
            }
          />
        </section>

        <section className="min-w-0 bg-white px-5 py-4" data-testid="quote-email-queue-card">
        <div className="mb-3">
          <h3 className="text-base font-semibold text-slate-900">Čakalna vrsta ponudb</h3>
          <p className="mt-1 max-w-3xl text-sm leading-5 text-slate-600">
            Tukaj se zabeleži sprejem pri ponudniku e-pošte. Neuspela opravila
            lahko po preverjanju varno znova uvrstite v čakalno vrsto.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4" data-testid="quote-email-queue-grid">
          {([['Čaka', state.queue.pending], ['Obdelava', state.queue.processing], ['Poslano', state.queue.sent], ['Napake', state.queue.failed]] as const).map(([label, value]) => (
            <EmailQueueMetricCard key={label} label={label} value={value} />
          ))}
        </div>
        <div className="mt-3">
          <h4 className="text-sm font-semibold text-slate-900">Čakajoča sporočila</h4>
          {state.queue.pendingJobs.length === 0 ? (
            <p className="mt-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-600">
              Ni e-poštnih opravil, ki čakajo na pošiljanje.
            </p>
          ) : (
            <div className="mt-1.5 overflow-x-auto rounded-lg border border-slate-200" data-testid="quote-email-pending-table">
              <Table className="min-w-[760px] table-fixed text-[12px]">
                <THead>
                  <TR className="hover:bg-transparent">
                    <TH scope="col" className={adminTableHeaderCellLeftClassName}>Dogodek</TH>
                    <TH scope="col" className={`${adminTableHeaderCellLeftClassName} w-28`}>Občinstvo</TH>
                    <TH scope="col" className={adminTableHeaderCellLeftClassName}>Prejemnik</TH>
                    <TH scope="col" className={`${adminTableHeaderCellLeftClassName} w-36`}>Na vrsti</TH>
                    <TH scope="col" className={`${adminTableHeaderCellCenterClassName} w-20`}>Dejanje</TH>
                  </TR>
                </THead>
                <TBody className="divide-y divide-slate-200 bg-white">
                  {state.queue.pendingJobs.map((job) => {
                    const eventLabel = quoteEmailEventLabelByType.get(job.eventType) ?? job.eventType;
                    return (
                      <TR key={job.id} className={adminTableRowHeightClassName} data-testid={`quote-email-pending-row-${job.id}`}>
                        <TD className={`${adminTableBodyCellLeftClassName} text-slate-800`}>{eventLabel}</TD>
                        <TD className={adminTableBodyCellLeftClassName}>{formatAudience(job.audience)}</TD>
                        <TD className={adminTableBodyCellLeftClassName}>{job.recipientEmail}</TD>
                        <TD className={`${adminTableBodyCellLeftClassName} whitespace-nowrap text-slate-600`}>{formatDate(job.nextAttemptAt)}</TD>
                        <TD className={adminTableBodyCellCenterClassName}>
                          <IconButton
                            type="button"
                            tone="danger"
                            size="sm"
                            className={adminTableSelectedDangerIconButtonClassName}
                            aria-label={`Odstrani iz čakalne vrste: ${eventLabel} · ${job.recipientEmail}`}
                            title="Odstrani iz čakalne vrste"
                            disabled={Boolean(retryingJobId) || Boolean(cancellingJobId) || mutationsDisabled}
                            data-testid={`quote-email-cancel-${job.id}`}
                            onClick={() => setCancelCandidate(job)}
                          >
                            <TrashCanIcon className="h-4 w-4" />
                          </IconButton>
                        </TD>
                      </TR>
                    );
                  })}
                </TBody>
              </Table>
            </div>
          )}
          {state.queue.pending > state.queue.pendingJobs.length ? (
            <p className="mt-1.5 text-xs leading-5 text-slate-500">
              Prikazanih je prvih {state.queue.pendingJobs.length} od {state.queue.pending} čakajočih sporočil.
            </p>
          ) : null}
        </div>
        <div className="mt-4">
          <h4 className="text-sm font-semibold text-slate-900">Nedavne napake</h4>
          {state.queue.recentFailures.length === 0 ? (
            <p className="mt-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-600">
              Ni neuspešnih opravil ponudb.
            </p>
          ) : (
            <div className="mt-1.5 overflow-x-auto rounded-lg border border-slate-200" data-testid="quote-email-failure-table">
              <Table className="min-w-[980px] table-fixed text-[12px]">
                <THead>
                  <TR className="hover:bg-transparent">
                    <TH scope="col" className={adminTableHeaderCellLeftClassName}>Dogodek</TH>
                    <TH scope="col" className={`${adminTableHeaderCellLeftClassName} w-28`}>Občinstvo</TH>
                    <TH scope="col" className={adminTableHeaderCellLeftClassName}>Prejemnik</TH>
                    <TH scope="col" className={`${adminTableHeaderCellCenterClassName} w-20`}>Poskusi</TH>
                    <TH scope="col" className={adminTableHeaderCellLeftClassName}>Napaka</TH>
                    <TH scope="col" className={`${adminTableHeaderCellLeftClassName} w-36`}>Posodobljeno</TH>
                    <TH scope="col" className={`${adminTableHeaderCellCenterClassName} w-28`}>Dejanje</TH>
                  </TR>
                </THead>
                <TBody className="divide-y divide-slate-200 bg-white">
                  {state.queue.recentFailures.map((failure) => (
                    <TR key={failure.id} className={adminTableRowHeightClassName}>
                      <TD className={`${adminTableBodyCellLeftClassName} text-slate-800`}>
                        {quoteEmailEventLabelByType.get(failure.eventType) ?? failure.eventType}
                      </TD>
                      <TD className={adminTableBodyCellLeftClassName}>{formatAudience(failure.audience)}</TD>
                      <TD className={adminTableBodyCellLeftClassName}>{failure.recipientEmail}</TD>
                      <TD className={`${adminTableBodyCellCenterClassName} tabular-nums`}>{failure.attempts}</TD>
                      <TD className={`${adminTableBodyCellLeftClassName} max-w-sm text-slate-600`}>
                        <span className="block truncate" title={failure.lastError ?? undefined}>
                          {failure.lastError || 'Neznana napaka'}
                        </span>
                      </TD>
                      <TD className={`${adminTableBodyCellLeftClassName} whitespace-nowrap text-slate-600`}>
                        {formatDate(failure.updatedAt)}
                      </TD>
                      <TD className={adminTableBodyCellCenterClassName}>
                        {failure.retryEligible ? (
                          <IconButton
                            type="button"
                            tone="neutral"
                            size="sm"
                            className={adminTableNeutralIconButtonClassName}
                            aria-label={`Ponovi pošiljanje: ${quoteEmailEventLabelByType.get(failure.eventType) ?? failure.eventType} · ${failure.recipientEmail}`}
                            title="Ponovi pošiljanje"
                            data-testid={`quote-email-retry-${failure.id}`}
                            onClick={() => void retry(failure.id)}
                            disabled={Boolean(retryingJobId) || Boolean(cancellingJobId) || mutationsDisabled}
                          >
                            <RefreshCw className={`h-4 w-4 ${retryingJobId === failure.id ? 'animate-spin' : ''}`} aria-hidden="true" />
                          </IconButton>
                        ) : (
                          <span className="block text-xs leading-4 text-slate-500" title={failure.retryIneligibleReason ?? undefined} data-testid={`quote-email-retry-ineligible-${failure.id}`}>
                            {failure.retryIneligibleReason ?? 'Ni mogoče ponoviti.'}
                          </span>
                        )}
                      </TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            </div>
          )}
        </div>
        </section>
      </div>
    </section>
    <CustomerEmailConfirmationDialog
      confirmation={customerEmailConfirmation.confirmation}
      confirmDisabled={Boolean(retryingJobId)}
      onCancel={customerEmailConfirmation.cancelConfirmation}
      onConfirm={customerEmailConfirmation.confirm}
    />
    <ConfirmDialog
      open={Boolean(cancelCandidate)}
      title="Odstrani e-pošto iz čakalne vrste?"
      description={cancelCandidate
        ? `Sporočilo za ${cancelCandidate.recipientEmail} ne bo poslano. Dejanje bo zabeleženo v dnevniku.`
        : undefined}
      confirmLabel={cancellingJobId ? 'Odstranjujem …' : 'Odstrani'}
      cancelLabel="Prekliči"
      isDanger
      confirmDisabled={Boolean(cancellingJobId)}
      onCancel={() => {
        if (!cancellingJobId) setCancelCandidate(null);
      }}
      onConfirm={() => void cancelPendingEmail()}
    />
    </>
  );
});

export default AdminQuoteEmailSettingsSection;
