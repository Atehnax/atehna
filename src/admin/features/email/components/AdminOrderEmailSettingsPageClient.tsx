"use client";

import { useMemo, useState } from "react";
import {
  DEFAULT_ORDER_EMAIL_SETTINGS,
  ORDER_EMAIL_TEMPLATE_BODY_MAX_LENGTH,
  ORDER_EMAIL_TEMPLATE_SUBJECT_MAX_LENGTH,
  ORDER_EMAIL_TEMPLATE_VARIABLES,
  ORDER_EMAIL_EVENT_DEFINITIONS,
  normalizeOrderEmailSettings,
  type OrderEmailSettings,
} from "@/shared/domain/order/orderEmailSettings";
import type { OrderEmailAdminState } from "@/shared/server/orderEmailSettings";
import type { QuoteEmailAdminState } from "@/shared/server/quoteEmailSettings";
import AdminQuoteEmailSettingsSection from "@/admin/features/email/components/AdminQuoteEmailSettingsSection";
import { AdminPageHeader } from "@/shared/ui/admin-primitives";
import { AdminSwitch } from "@/shared/ui/admin-switch";
import AdminCheckbox from "@/shared/ui/checkbox/admin-checkbox";
import EuiTabs from "@/shared/ui/eui-tabs";
import { Spinner } from "@/shared/ui/loading";
import {
  adminWindowCardClassName,
  adminWindowCardStyle,
} from "@/shared/ui/admin-table";
import { adminInputFocusTokenClasses } from "@/shared/ui/theme/tokens";
import { useToast } from "@/shared/ui/toast";

type UnknownRecord = Record<string, unknown>;
type EventKey = keyof OrderEmailSettings["events"];
type EventAudience = keyof OrderEmailSettings["events"][EventKey];
type EmailPageTab = "settings" | "orders" | "quotes";
type StandardTemplateAudience = "customer" | "admin";
type TemplateAudience = StandardTemplateAudience | "schoolCustomer";
type RecentFailure = OrderEmailAdminState["queue"]["recentFailures"][number];

const fieldClassName =
  `h-9 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 transition-[border-color,box-shadow] placeholder:text-slate-400 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500 ${adminInputFocusTokenClasses}`;
const textareaClassName =
  `min-h-24 w-full resize-y rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm leading-5 text-slate-900 transition-[border-color,box-shadow] placeholder:text-slate-400 ${adminInputFocusTokenClasses}`;
const alignedFieldClassName = "grid min-w-0 grid-rows-[1fr_auto]";
const primaryButtonClassName =
  "inline-flex h-9 items-center justify-center gap-2 rounded-lg bg-[color:var(--blue-500)] px-3.5 text-sm font-semibold text-white transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-60";
const secondaryButtonClassName =
  "inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-3.5 text-sm font-semibold text-slate-700 transition hover:border-slate-400 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60";

function asRecord(value: unknown): UnknownRecord {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as UnknownRecord)
    : {};
}

function asString(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function asBoolean(value: unknown, fallback: boolean) {
  return typeof value === "boolean" ? value : fallback;
}

function asCount(value: unknown, fallback: number) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? Math.max(0, Math.trunc(numeric)) : fallback;
}

function normalizeRecentFailure(
  value: unknown,
  index: number,
): RecentFailure | null {
  const record = asRecord(value);
  const id = asString(record.id, `failure-${index + 1}`).trim();
  const eventType = asString(record.eventType).trim();
  const recipientEmail = asString(record.recipientEmail).trim();
  const updatedAt = asString(record.updatedAt).trim();
  if (!id || !eventType || !recipientEmail) return null;

  return {
    id,
    eventType,
    recipientEmail,
    attempts: asCount(record.attempts, 0),
    lastError:
      record.lastError === null ? null : asString(record.lastError, "") || null,
    updatedAt,
  };
}

function normalizeAdminStateResponse(
  value: unknown,
  fallback: OrderEmailAdminState,
): OrderEmailAdminState {
  const root = asRecord(value);
  const candidate = asRecord(
    root.state ?? root.adminState ?? root.data ?? value,
  );
  const delivery = asRecord(candidate.delivery);
  const queue = asRecord(candidate.queue);
  const failuresSource = Array.isArray(queue.recentFailures)
    ? queue.recentFailures
    : fallback.queue.recentFailures;

  let config = fallback.config;
  try {
    config = normalizeOrderEmailSettings(
      candidate.config ?? root.config ?? fallback.config,
    );
  } catch {
    config = fallback.config;
  }

  return {
    config,
    delivery: {
      provider: "Resend",
      schemaReady: asBoolean(
        delivery.schemaReady,
        fallback.delivery.schemaReady,
      ),
      apiKeyConfigured: asBoolean(
        delivery.apiKeyConfigured,
        fallback.delivery.apiKeyConfigured,
      ),
      e2eDisabled: asBoolean(
        delivery.e2eDisabled,
        fallback.delivery.e2eDisabled,
      ),
      ready: asBoolean(delivery.ready, fallback.delivery.ready),
    },
    queue: {
      pending: asCount(queue.pending, fallback.queue.pending),
      processing: asCount(queue.processing, fallback.queue.processing),
      sent: asCount(queue.sent, fallback.queue.sent),
      failed: asCount(queue.failed, fallback.queue.failed),
      recentFailures: failuresSource
        .map(normalizeRecentFailure)
        .filter((failure): failure is RecentFailure => Boolean(failure)),
    },
  };
}

function comparableConfig(config: OrderEmailSettings) {
  const { updatedAt: _updatedAt, ...stored } = config;
  return JSON.stringify(stored);
}

function responseMessage(payload: UnknownRecord, fallback: string) {
  return typeof payload.message === "string" && payload.message.trim()
    ? payload.message.trim()
    : fallback;
}

function responseErrors(payload: UnknownRecord, fallback: string) {
  const rawErrors = Array.isArray(payload.errors) ? payload.errors : [];
  const errors = rawErrors
    .filter((error): error is string => typeof error === "string")
    .map((error) => error.trim())
    .filter((error) => error.length > 0);
  return Array.from(
    new Set(errors.length > 0 ? errors : [responseMessage(payload, fallback)]),
  );
}

async function readPayload(response: Response) {
  return asRecord(await response.json().catch(() => ({})));
}

function formatUpdatedAt(value: string) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("sl-SI", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(date);
}

function SurfaceCard({
  title,
  description,
  actions,
  children,
  testId,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
  testId?: string;
}) {
  return (
    <section
      className="min-w-0 bg-white px-4 py-4 sm:px-5"
      data-testid={testId}
    >
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2.5">
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-slate-900">{title}</h2>
          {description ? (
            <p className="mt-0.5 max-w-3xl text-xs leading-4 text-slate-600">
              {description}
            </p>
          ) : null}
        </div>
        {actions ? <div className="shrink-0">{actions}</div> : null}
      </div>
      {children}
    </section>
  );
}

function FieldLabel({
  htmlFor,
  label,
  hint,
}: {
  htmlFor: string;
  label: string;
  hint?: string;
}) {
  return (
    <label htmlFor={htmlFor} className="block">
      <span className="block text-xs font-semibold text-slate-700">{label}</span>
      {hint ? (
        <span className="mt-0.5 block text-xs text-slate-500">{hint}</span>
      ) : null}
    </label>
  );
}

function TemplateEditorCard({
  audience,
  title,
  description,
  subject,
  body,
  variables,
  onSubjectChange,
  onBodyChange,
  onReset,
  className = "",
}: {
  audience: TemplateAudience;
  title: string;
  description: string;
  subject: string;
  body: string;
  variables: readonly string[];
  onSubjectChange: (value: string) => void;
  onBodyChange: (value: string) => void;
  onReset: () => void;
  className?: string;
}) {
  const audienceLabel =
    audience === "customer"
      ? "stranko"
      : audience === "schoolCustomer"
        ? "\u0161olo ali javni zavod"
        : "administratorja";
  const audienceTestId =
    audience === "schoolCustomer" ? "school-customer" : audience;
  const subjectId = `order-email-template-${audienceTestId}-subject`;
  const bodyId = `order-email-template-${audienceTestId}-body`;

  return (
    <section
      className={`min-w-0 rounded-xl border border-slate-200 bg-slate-50/60 p-3.5 ${className}`}
      data-testid={`order-email-template-${audienceTestId}`}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
          <p className="mt-0.5 text-xs leading-4 text-slate-600">{description}</p>
        </div>
        <button
          type="button"
          className={secondaryButtonClassName}
          onClick={onReset}
          aria-label={`Ponastavi privzeto predlogo za ${audienceLabel}`}
          data-testid={`order-email-template-${audienceTestId}-reset`}
        >
          Ponastavi privzeto
        </button>
      </div>

      <div className="mt-3 space-y-3">
        <div>
          <FieldLabel
            htmlFor={subjectId}
            label={`Zadeva za ${audienceLabel}`}
            hint="Predpona zadeve se doda samodejno."
          />
          <input
            id={subjectId}
            className={`${fieldClassName} mt-1.5`}
            value={subject}
            maxLength={ORDER_EMAIL_TEMPLATE_SUBJECT_MAX_LENGTH}
            onChange={(event) => onSubjectChange(event.target.value)}
            data-testid={`order-email-template-${audienceTestId}-subject`}
          />
        </div>
        <div>
          <FieldLabel
            htmlFor={bodyId}
            label={`Vsebina za ${audienceLabel}`}
            hint="Vnesite navadno besedilo. Povzetek naročila in artikli se dodajo samodejno."
          />
          <textarea
            id={bodyId}
            className={`${textareaClassName} mt-1.5 min-h-40`}
            value={body}
            maxLength={ORDER_EMAIL_TEMPLATE_BODY_MAX_LENGTH}
            onChange={(event) => onBodyChange(event.target.value)}
            data-testid={`order-email-template-${audienceTestId}-body`}
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
          {variables.map((variable) => (
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

function QueueMetric({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: number;
  tone?: "neutral" | "info" | "success" | "danger";
}) {
  const toneClassName = {
    neutral: "border-slate-200 bg-slate-50 text-slate-900",
    info: "border-blue-200 bg-blue-50 text-blue-900",
    success: "border-emerald-200 bg-emerald-50 text-emerald-900",
    danger: "border-rose-200 bg-rose-50 text-rose-900",
  }[tone];

  return (
    <div className={`rounded-lg border px-3 py-2.5 ${toneClassName}`}>
      <div className="text-xl font-semibold tabular-nums">{value}</div>
      <div className="mt-0.5 text-xs font-medium opacity-75">{label}</div>
    </div>
  );
}

export default function AdminOrderEmailSettingsPageClient({
  initialState,
  initialQuoteState,
}: {
  initialState: OrderEmailAdminState;
  initialQuoteState: QuoteEmailAdminState;
}) {
  const normalizedInitialState = useMemo(
    () => normalizeAdminStateResponse(initialState, initialState),
    [initialState],
  );
  const [adminState, setAdminState] = useState(normalizedInitialState);
  const [draft, setDraft] = useState<OrderEmailSettings>(
    normalizedInitialState.config,
  );
  const [activeTab, setActiveTab] = useState<EmailPageTab>("settings");
  const [selectedTemplateEvent, setSelectedTemplateEvent] =
    useState<EventKey>("order_submitted");
  const [testRecipient, setTestRecipient] = useState("");
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [actionErrors, setActionErrors] = useState<string[]>([]);
  const setActionError = (message: string | null) => {
    setActionErrors(message ? [message] : []);
  };
  const { toast } = useToast();

  const hasChanges = useMemo(
    () => comparableConfig(draft) !== comparableConfig(adminState.config),
    [adminState.config, draft],
  );
  const eventLabels = useMemo(
    () =>
      new Map(
        ORDER_EMAIL_EVENT_DEFINITIONS.map((definition) => [
          String(definition.value),
          definition.label,
        ]),
      ),
    [],
  );
  const schoolCustomerTemplate =
    draft.templates.order_submitted.schoolCustomer ??
    DEFAULT_ORDER_EMAIL_SETTINGS.templates.order_submitted.schoolCustomer;

  const draftBasicReady =
    adminState.delivery.schemaReady &&
    adminState.delivery.apiKeyConfigured &&
    !adminState.delivery.e2eDisabled &&
    Boolean(draft.senderName.trim()) &&
    Boolean(draft.fromEmail.trim());
  const siteUrlInvalid = actionErrors.some((error) =>
    error.toLowerCase().includes("spletni naslov"),
  );

  const readiness = !adminState.delivery.schemaReady
    ? {
        label: "Podatkovna shema e-pošte ni nameščena",
        detail:
          "Pred vklopom uvedite kanonično shemo za nastavitve in čakalno vrsto e-pošte.",
        className: "border-rose-200 bg-rose-50 text-rose-800",
      }
    : adminState.delivery.e2eDisabled
      ? {
          label: "Pošiljanje je v E2E izklopljeno",
          detail: "Testno okolje e-pošte ne pošilja dejanskim prejemnikom.",
          className: "border-amber-200 bg-amber-50 text-amber-800",
        }
      : !adminState.delivery.apiKeyConfigured
        ? {
            label: "Povezava z Resend manjka",
            detail:
              "Skrbnik mora ponudnika povezati v nastavitvah okolja Vercel.",
            className: "border-rose-200 bg-rose-50 text-rose-800",
          }
        : draftBasicReady
          ? {
              label: "Osnovna konfiguracija je izpolnjena",
              detail:
                "API ključ in trenutni podatki pošiljatelja so vneseni. Veljavnost domene potrdite s testnim sporočilom.",
              className: "border-blue-200 bg-blue-50 text-blue-800",
            }
          : {
              label: "Dopolnite nastavitve pošiljatelja",
              detail:
                "Povezava obstaja, vendar trenutni podatki pošiljatelja še niso popolni.",
              className: "border-amber-200 bg-amber-50 text-amber-800",
            };

  const updateConfig = <Key extends keyof OrderEmailSettings>(
    key: Key,
    value: OrderEmailSettings[Key],
  ) => {
    setDraft((current) => ({ ...current, [key]: value }));
    setActionErrors([]);
  };

  const updateEvent = (
    eventKey: EventKey,
    audience: EventAudience,
    checked: boolean,
  ) => {
    setDraft((current) => ({
      ...current,
      events: {
        ...current.events,
        [eventKey]: {
          ...(current.events[eventKey] ?? { customer: false, admins: false }),
          [audience]: checked,
        },
      },
    }));
    setActionErrors([]);
  };

  const updateTemplate = (
    audience: TemplateAudience,
    field: "subject" | "body",
    value: string,
  ) => {
    setDraft((current) => {
      if (audience === "schoolCustomer") {
        const submissionTemplates = current.templates.order_submitted;
        const currentSchoolTemplate =
          submissionTemplates.schoolCustomer ??
          DEFAULT_ORDER_EMAIL_SETTINGS.templates.order_submitted.schoolCustomer;
        if (!currentSchoolTemplate) return current;
        return {
          ...current,
          templates: {
            ...current.templates,
            order_submitted: {
              ...submissionTemplates,
              schoolCustomer: {
                ...submissionTemplates.schoolCustomer,
                ...currentSchoolTemplate,
                [field]: value,
              },
            },
          },
        };
      }

      const eventTemplates =
        current.templates[selectedTemplateEvent] ??
        DEFAULT_ORDER_EMAIL_SETTINGS.templates[selectedTemplateEvent];
      return {
        ...current,
        templates: {
          ...current.templates,
          [selectedTemplateEvent]: {
            ...eventTemplates,
            [audience]: {
              ...eventTemplates[audience],
              [field]: value,
            },
          },
        },
      };
    });
    setActionErrors([]);
  };

  const resetTemplate = (audience: TemplateAudience) => {
    if (audience === "schoolCustomer") {
      const defaultTemplate =
        DEFAULT_ORDER_EMAIL_SETTINGS.templates.order_submitted.schoolCustomer;
      if (!defaultTemplate) return;
      setDraft((current) => ({
        ...current,
        templates: {
          ...current.templates,
          order_submitted: {
            ...current.templates.order_submitted,
            schoolCustomer: { ...defaultTemplate },
          },
        },
      }));
      setActionErrors([]);
      return;
    }

    const defaultTemplate =
      DEFAULT_ORDER_EMAIL_SETTINGS.templates[selectedTemplateEvent][audience];
    setDraft((current) => {
      const eventTemplates =
        current.templates[selectedTemplateEvent] ??
        DEFAULT_ORDER_EMAIL_SETTINGS.templates[selectedTemplateEvent];
      return {
        ...current,
        templates: {
          ...current.templates,
          [selectedTemplateEvent]: {
            ...eventTemplates,
            [audience]: { ...defaultTemplate },
          },
        },
      };
    });
    setActionErrors([]);
  };

  const updateAdminRecipient = (index: number, value: string) => {
    updateConfig(
      "adminRecipients",
      draft.adminRecipients.map((recipient, recipientIndex) =>
        recipientIndex === index ? value : recipient,
      ),
    );
  };

  const removeAdminRecipient = (index: number) => {
    updateConfig(
      "adminRecipients",
      draft.adminRecipients.filter(
        (_, recipientIndex) => recipientIndex !== index,
      ),
    );
  };

  const handleSave = async () => {
    const submittedConfig = draft;
    const submittedComparable = comparableConfig(submittedConfig);
    setSaving(true);
    setActionError(null);
    try {
      const response = await fetch("/api/admin/order-email-settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ config: submittedConfig }),
      });
      const payload = await readPayload(response);
      if (!response.ok) {
        const errors = responseErrors(
          payload,
          "Nastavitev e-pošte ni bilo mogoče shraniti.",
        );
        setActionErrors(errors);
        toast.error(errors[0]);
        return;
      }

      const nextState = normalizeAdminStateResponse(payload, adminState);
      setAdminState(nextState);
      setDraft((current) =>
        comparableConfig(current) === submittedComparable
          ? nextState.config
          : current,
      );
      toast.success("Nastavitve samodejne e-pošte so shranjene.");
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Nastavitev e-pošte ni bilo mogoče shraniti.";
      setActionError(message);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    const recipient = testRecipient.trim();
    if (!recipient) {
      const message = "Vnesite prejemnika testnega sporočila.";
      setActionError(message);
      toast.error(message);
      return;
    }

    setTesting(true);
    setActionError(null);
    try {
      const response = await fetch("/api/admin/order-email-settings/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recipient, config: draft }),
      });
      const payload = await readPayload(response);
      if (!response.ok) {
        const errors = responseErrors(
          payload,
          "Testnega sporočila ni bilo mogoče poslati.",
        );
        setActionErrors(errors);
        toast.error(errors[0]);
        return;
      }
      toast.success(
        responseMessage(
          payload,
          `Testno sporočilo je poslano na ${recipient}.`,
        ),
      );
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Testnega sporočila ni bilo mogoče poslati.";
      setActionError(message);
      toast.error(message);
    } finally {
      setTesting(false);
    }
  };

  const handleRetry = async () => {
    setRetrying(true);
    setActionError(null);
    try {
      const response = await fetch("/api/admin/order-email-settings/retry", {
        method: "POST",
      });
      const payload = await readPayload(response);
      if (!response.ok) {
        const errors = responseErrors(
          payload,
          "Ponovnega pošiljanja ni bilo mogoče zagnati.",
        );
        setActionErrors(errors);
        toast.error(errors[0]);
        return;
      }

      setAdminState((current) => normalizeAdminStateResponse(payload, current));
      toast.success(
        responseMessage(
          payload,
          "Neuspela sporočila so znova uvrščena za pošiljanje.",
        ),
      );
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Ponovnega pošiljanja ni bilo mogoče zagnati.";
      setActionError(message);
      toast.error(message);
    } finally {
      setRetrying(false);
    }
  };

  return (
    <div className="w-full space-y-4">
      <AdminPageHeader
        title="Email"
        description="Skupni profil pošiljatelja ter ločeni dogodki, predloge in čakalne vrste za naročila in ponudbe."
        actions={
          activeTab === "quotes" ? undefined : (
            <button
              type="button"
              className={primaryButtonClassName}
              disabled={saving || !hasChanges}
              onClick={() => void handleSave()}
              data-testid="order-email-settings-save"
            >
              {saving ? <Spinner size="sm" /> : null}
              {saving
                ? "Shranjujem …"
                : hasChanges
                  ? "Shrani spremembe"
                  : "Shranjeno"}
            </button>
          )
        }
      />

      <EuiTabs
        value={activeTab}
        onChange={(next) => setActiveTab(next as EmailPageTab)}
        ariaLabel="Razdelki nastavitev e-pošte"
        idPrefix="order-email"
        tabClassName="!min-w-0 flex-1 !px-2 sm:!min-w-[118px] sm:!flex-none sm:!px-6"
        tabs={[
          {
            value: "settings",
            label: "Nastavitve",
            panelId: "order-email-settings-panel",
          },
          {
            value: "orders",
            label: "Naročila",
            panelId: "order-email-orders-panel",
          },
          {
            value: "quotes",
            label: "Ponudbe",
            panelId: "order-email-quotes-panel",
          },
        ]}
      />

      {actionErrors.length > 0 ? (
        <div
          role="alert"
          aria-live="assertive"
          className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700"
        >
          <p className="font-medium">{actionErrors[0]}</p>
          {actionErrors.length > 1 ? (
            <ul className="mt-1 list-disc space-y-0.5 pl-5">
              {actionErrors.slice(1).map((error) => (
                <li key={error}>{error}</li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      <div
        id="order-email-settings-panel"
        role="tabpanel"
        aria-labelledby="order-email-tab-settings"
        aria-hidden={activeTab !== "settings"}
        hidden={activeTab !== "settings"}
        tabIndex={activeTab === "settings" ? 0 : -1}
        className={`${adminWindowCardClassName} divide-y divide-slate-200 bg-white`}
        style={adminWindowCardStyle}
        data-testid="order-email-settings-panel"
      >
          <SurfaceCard
            title="Pošiljanje"
            description="Glavno stikalo ustavi ali omogoči vsa samodejna sporočila. Skrivni dostop do ponudnika se upravlja samo v okolju Vercel."
            testId="order-email-delivery-settings"
            actions={
              <div className="flex items-center gap-3">
                <span className="text-sm font-medium text-slate-700">
                  {draft.enabled ? "Vklopljeno" : "Izklopljeno"}
                </span>
                <AdminSwitch
                  checked={draft.enabled}
                  disabled={saving}
                  ariaLabel={
                    draft.enabled
                      ? "Izklopi samodejno pošiljanje"
                      : "Vklopi samodejno pošiljanje"
                  }
                  onChange={(enabled) => updateConfig("enabled", enabled)}
                />
              </div>
            }
          >
            <div
              className={`rounded-lg border px-3 py-2.5 ${readiness.className}`}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-sm font-semibold">{readiness.label}</span>
                <span className="rounded-full border border-current/20 px-2 py-0.5 text-xs font-semibold">
                  {adminState.delivery.provider}
                </span>
              </div>
              <p className="mt-1 text-xs leading-5 opacity-90">
                {readiness.detail}
              </p>
            </div>
            {draft.enabled && !draftBasicReady ? (
              <p className="mt-2 text-xs text-amber-700">
                Pošiljanje ne bo delovalo, dokler shema, povezava in trenutne
                osnovne nastavitve niso pripravljene.
              </p>
            ) : null}
          </SurfaceCard>

          <SurfaceCard
            title="Pošiljatelj in povezave"
            description="Naslov pošiljatelja mora pripadati domeni, ki je preverjena pri ponudniku e-pošte."
            testId="order-email-sender-settings"
          >
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <div className={alignedFieldClassName}>
                <FieldLabel
                  htmlFor="order-email-sender-name"
                  label="Ime pošiljatelja"
                />
                <input
                  id="order-email-sender-name"
                  className={`${fieldClassName} mt-1.5`}
                  value={draft.senderName}
                  maxLength={120}
                  onChange={(event) =>
                    updateConfig("senderName", event.target.value)
                  }
                  placeholder="Atehna"
                />
              </div>
              <div className={alignedFieldClassName}>
                <FieldLabel
                  htmlFor="order-email-from-address"
                  label="E-poštni naslov pošiljatelja"
                  hint="Primer za preverjeno poštno poddomeno: narocila@updates.atehna-test.site"
                />
                <input
                  id="order-email-from-address"
                  type="email"
                  className={`${fieldClassName} mt-1.5`}
                  value={draft.fromEmail}
                  maxLength={320}
                  onChange={(event) =>
                    updateConfig("fromEmail", event.target.value)
                  }
                  placeholder="narocila@updates.atehna-test.site"
                  autoComplete="email"
                />
              </div>
              <div className={alignedFieldClassName}>
                <FieldLabel
                  htmlFor="order-email-reply-to"
                  label="Naslov za odgovore"
                  hint="Odgovori strank bodo poslani na ta naslov."
                />
                <input
                  id="order-email-reply-to"
                  type="email"
                  className={`${fieldClassName} mt-1.5`}
                  value={draft.replyToEmail}
                  maxLength={320}
                  onChange={(event) =>
                    updateConfig("replyToEmail", event.target.value)
                  }
                  placeholder="narocila@atehna.si"
                  autoComplete="email"
                />
              </div>
              <div className={alignedFieldClassName}>
                <FieldLabel
                  htmlFor="order-email-site-url"
                  label="Naslov spletnega mesta"
                  hint="Osnovni naslov trgovine za povezave v sporočilih; to ni poštna poddomena Resend."
                />
                <input
                  id="order-email-site-url"
                  type="url"
                  className={`${fieldClassName} mt-1.5`}
                  value={draft.siteUrl}
                  maxLength={2048}
                  onChange={(event) =>
                    updateConfig("siteUrl", event.target.value)
                  }
                  aria-invalid={siteUrlInvalid || undefined}
                  placeholder="https://www.atehna-test.site"
                  autoComplete="url"
                />
              </div>
            </div>
          </SurfaceCard>

          <SurfaceCard
            title="Prejemniki za administracijo"
            description="Na te naslove se pošiljajo dogodki, pri katerih je v spodnji tabeli označen stolpec Administratorji."
            testId="order-email-admin-recipients"
            actions={
              <button
                type="button"
                className={secondaryButtonClassName}
                onClick={() =>
                  updateConfig("adminRecipients", [
                    ...draft.adminRecipients,
                    "",
                  ])
                }
              >
                <span aria-hidden>+</span>
                Dodaj naslov
              </button>
            }
          >
            {draft.adminRecipients.length === 0 ? (
              <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-3 py-3 text-sm text-slate-600">
                Administrator še nima nastavljenega prejemnika.
              </div>
            ) : (
              <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                {draft.adminRecipients.map((recipient, index) => (
                  <div
                    key={`admin-recipient-${index}`}
                    className="flex items-center gap-2"
                  >
                    <label
                      htmlFor={`order-email-admin-${index}`}
                      className="sr-only"
                    >
                      E-poštni naslov administratorja {index + 1}
                    </label>
                    <input
                      id={`order-email-admin-${index}`}
                      type="email"
                      className={fieldClassName}
                      value={recipient}
                      maxLength={320}
                      onChange={(event) =>
                        updateAdminRecipient(index, event.target.value)
                      }
                      placeholder="admin@atehna.si"
                      autoComplete="off"
                    />
                    <button
                      type="button"
                      className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-rose-200 bg-white text-lg text-rose-600 transition hover:bg-rose-50"
                      onClick={() => removeAdminRecipient(index)}
                      aria-label={`Odstrani e-poštni naslov administratorja ${index + 1}`}
                      title="Odstrani naslov"
                    >
                      <span aria-hidden>×</span>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </SurfaceCard>
      </div>

      <div
        id="order-email-orders-panel"
        role="tabpanel"
        aria-labelledby="order-email-tab-orders"
        aria-hidden={activeTab !== "orders"}
        hidden={activeTab !== "orders"}
        tabIndex={activeTab === "orders" ? 0 : -1}
        className={`${adminWindowCardClassName} divide-y divide-slate-200 bg-white`}
        style={adminWindowCardStyle}
        data-testid="order-email-orders-panel"
      >
          <SurfaceCard
            title="Dogodki naročila"
            description="Stranka pomeni e-poštni naslov, ki je shranjen na naročilu. Oddaja naročila in poznejša sprememba statusa Prejeto sta ločena dogodka."
            testId="order-email-event-matrix"
          >
            <div className="overflow-x-auto rounded-lg border border-slate-200">
              <table className="w-full min-w-[640px] border-collapse text-sm">
                <thead className="bg-[color:var(--admin-table-header-bg)] text-slate-700">
                  <tr>
                    <th
                      scope="col"
                      className="px-4 py-2.5 text-left font-semibold"
                    >
                      Dogodek
                    </th>
                    <th
                      scope="col"
                      className="w-36 px-4 py-2.5 text-center font-semibold"
                    >
                      Stranka
                    </th>
                    <th
                      scope="col"
                      className="w-44 px-4 py-2.5 text-center font-semibold"
                    >
                      Administratorji
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 bg-white">
                  {ORDER_EMAIL_EVENT_DEFINITIONS.map((definition) => {
                    const eventKey = definition.value as EventKey;
                    const eventSetting = draft.events[eventKey] ?? {
                      customer: false,
                      admins: false,
                    };
                    return (
                      <tr
                        key={String(definition.value)}
                        className="transition hover:bg-slate-50"
                      >
                        <th
                          scope="row"
                          className="px-4 py-2.5 text-left font-normal"
                        >
                          <span className="block font-medium text-slate-900">
                            {definition.label}
                          </span>
                          <span className="mt-0.5 block text-xs leading-4 text-slate-500">
                            {definition.description}
                          </span>
                        </th>
                        <td className="px-4 py-2.5 text-center">
                          <AdminCheckbox
                            checked={eventSetting.customer}
                            onChange={(event) =>
                              updateEvent(
                                eventKey,
                                "customer",
                                event.target.checked,
                              )
                            }
                            aria-label={`${definition.label}: obvesti stranko`}
                            data-testid={`order-email-event-${String(definition.value)}-customer`}
                          />
                        </td>
                        <td className="px-4 py-2.5 text-center">
                          <AdminCheckbox
                            checked={eventSetting.admins}
                            onChange={(event) =>
                              updateEvent(
                                eventKey,
                                "admins",
                                event.target.checked,
                              )
                            }
                            aria-label={`${definition.label}: obvesti administratorje`}
                            data-testid={`order-email-event-${String(definition.value)}-admins`}
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </SurfaceCard>

          <SurfaceCard
            title="Preizkus pošiljanja"
            description="Test pošlje administratorsko predlogo za dogodek Oddano naročilo in uporabi trenutno prikazane nastavitve, tudi če jih še niste shranili. API ključ se nikoli ne pošlje v brskalnik."
            testId="order-email-test-delivery"
          >
            <form
              className="flex flex-col gap-2 sm:flex-row sm:items-end"
              onSubmit={(event) => {
                event.preventDefault();
                void handleTest();
              }}
            >
              <div className="min-w-0 flex-1">
                <FieldLabel
                  htmlFor="order-email-test-recipient"
                  label="Prejemnik testa"
                />
                <input
                  id="order-email-test-recipient"
                  type="email"
                  className={`${fieldClassName} mt-1.5`}
                  value={testRecipient}
                  onChange={(event) => {
                    setTestRecipient(event.target.value);
                    setActionErrors([]);
                  }}
                  placeholder="vas@primer.si"
                  autoComplete="email"
                  required
                />
              </div>
              <button
                type="submit"
                className={secondaryButtonClassName}
                disabled={testing}
                data-testid="order-email-send-test"
              >
                {testing ? <Spinner size="sm" /> : null}
                {testing ? "Pošiljam …" : "Pošlji test"}
              </button>
            </form>
          </SurfaceCard>

          <SurfaceCard
            title="Čakalna vrsta pošiljanja"
            description="Tukaj se zabeleži sprejem pri Resendu; končna dostava in zavrnitve so vidne v Resendu. Neuspela opravila lahko varno znova uvrstite v čakalno vrsto."
            testId="order-email-queue"
            actions={
              <button
                type="button"
                className={secondaryButtonClassName}
                disabled={
                  retrying ||
                  (adminState.queue.failed === 0 &&
                    adminState.queue.recentFailures.length === 0)
                }
                onClick={() => void handleRetry()}
                data-testid="order-email-retry-failed"
              >
                {retrying ? <Spinner size="sm" /> : null}
                {retrying ? "Uvrščam …" : "Ponovi neuspele"}
              </button>
            }
          >
            <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
              <QueueMetric
                label="Na čakanju"
                value={adminState.queue.pending}
              />
              <QueueMetric
                label="V obdelavi"
                value={adminState.queue.processing}
                tone="info"
              />
              <QueueMetric
                label="Sprejeta pri Resendu"
                value={adminState.queue.sent}
                tone="success"
              />
              <QueueMetric
                label="Neuspela"
                value={adminState.queue.failed}
                tone="danger"
              />
            </div>

            <div className="mt-3">
              <h3 className="text-sm font-semibold text-slate-900">
                Nedavne napake
              </h3>
              {adminState.queue.recentFailures.length === 0 ? (
                <p className="mt-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-600">
                  Ni nedavnih neuspelih pošiljanj.
                </p>
              ) : (
                <div className="mt-1.5 overflow-x-auto rounded-lg border border-slate-200">
                  <table className="w-full min-w-[760px] border-collapse text-sm">
                    <thead className="bg-[color:var(--admin-table-header-bg)] text-slate-700">
                      <tr>
                        <th
                          scope="col"
                          className="px-3 py-2.5 text-left font-semibold"
                        >
                          Dogodek
                        </th>
                        <th
                          scope="col"
                          className="px-3 py-2.5 text-left font-semibold"
                        >
                          Prejemnik
                        </th>
                        <th
                          scope="col"
                          className="px-3 py-2.5 text-center font-semibold"
                        >
                          Poskusi
                        </th>
                        <th
                          scope="col"
                          className="px-3 py-2.5 text-left font-semibold"
                        >
                          Napaka
                        </th>
                        <th
                          scope="col"
                          className="px-3 py-2.5 text-left font-semibold"
                        >
                          Posodobljeno
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 bg-white">
                      {adminState.queue.recentFailures.map((failure) => (
                        <tr key={failure.id}>
                          <td className="px-3 py-2.5 text-slate-800">
                            {eventLabels.get(failure.eventType) ??
                              failure.eventType}
                          </td>
                          <td className="px-3 py-2.5 text-slate-700">
                            {failure.recipientEmail}
                          </td>
                          <td className="px-3 py-2.5 text-center tabular-nums text-slate-700">
                            {failure.attempts}
                          </td>
                          <td className="max-w-sm px-3 py-2.5 text-slate-600">
                            <span
                              className="block truncate"
                              title={failure.lastError ?? undefined}
                            >
                              {failure.lastError || "Neznana napaka"}
                            </span>
                          </td>
                          <td className="whitespace-nowrap px-3 py-2.5 text-slate-600">
                            {formatUpdatedAt(failure.updatedAt)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </SurfaceCard>
          <SurfaceCard
            title="Skupna vsebina"
            description="Predpona se doda zadevi vsakega sporočila, besedilo v nogi pa se prikaže za povzetkom naročila."
            testId="order-email-shared-content"
          >
            <div className="grid gap-3 lg:grid-cols-4">
              <div>
                <FieldLabel
                  htmlFor="order-email-subject-prefix"
                  label="Predpona zadeve"
                  hint="Dodana bo pred zadevo vsakega sporočila."
                />
                <input
                  id="order-email-subject-prefix"
                  className={`${fieldClassName} mt-1.5`}
                  value={draft.subjectPrefix}
                  maxLength={80}
                  onChange={(event) =>
                    updateConfig("subjectPrefix", event.target.value)
                  }
                  placeholder="Atehna"
                />
              </div>
              <div className="lg:col-span-3">
                <FieldLabel
                  htmlFor="order-email-footer"
                  label="Dodatno besedilo v nogi"
                  hint="Neobvezno besedilo, ki se prikaže na koncu vseh sporočil."
                />
                <textarea
                  id="order-email-footer"
                  className={`${textareaClassName} mt-1.5`}
                  value={draft.footerText}
                  maxLength={1000}
                  onChange={(event) =>
                    updateConfig("footerText", event.target.value)
                  }
                  placeholder="Hvala za vaše naročilo."
                />
              </div>
            </div>
          </SurfaceCard>

          <SurfaceCard
            title="Predloge sporočil"
            description="Za vsak dogodek posebej nastavite zadevo in uvodno vsebino za posamezne skupine prejemnikov. Povzetek naročila, artikli in slike artiklov, kadar so na voljo, se dodajo samodejno."
            testId="order-email-message-templates"
          >
            <div className="max-w-sm">
              <FieldLabel
                htmlFor="order-email-template-event"
                label="Dogodek naročila"
                hint="Izberite dogodek, katerega predloge so prikazane spodaj."
              />
              <select
                id="order-email-template-event"
                className={`${fieldClassName} mt-1.5`}
                value={selectedTemplateEvent}
                onChange={(event) => {
                  setSelectedTemplateEvent(event.target.value as EventKey);
                  setActionErrors([]);
                }}
                data-testid="order-email-template-event"
              >
                {ORDER_EMAIL_EVENT_DEFINITIONS.map((definition) => (
                  <option key={definition.value} value={definition.value}>
                    {definition.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="mt-3 grid min-w-0 gap-3 lg:grid-cols-2">
              <TemplateEditorCard
                audience="customer"
                title={
                  selectedTemplateEvent === "order_submitted"
                    ? "Stranka (fizi\u010dna oseba ali podjetje)"
                    : "Stranka"
                }
                description="V predlogi za stranko interna zaporedna številka naročila ni na voljo in se kupcu ne razkrije."
                subject={
                  draft.templates[selectedTemplateEvent].customer.subject
                }
                body={draft.templates[selectedTemplateEvent].customer.body}
                variables={ORDER_EMAIL_TEMPLATE_VARIABLES.customer}
                onSubjectChange={(value) =>
                  updateTemplate("customer", "subject", value)
                }
                onBodyChange={(value) =>
                  updateTemplate("customer", "body", value)
                }
                onReset={() => resetTemplate("customer")}
              />
              {selectedTemplateEvent === "order_submitted" &&
              schoolCustomerTemplate ? (
                <TemplateEditorCard
                  audience="schoolCustomer"
                  title={"\u0160ola / javni zavod"}
                  description={
                    "Uporabi se samo ob oddaji naro\u010dila za naro\u010dnika vrste \u00bb\u0160ola / javni zavod\u00ab. Varna povezava za nalaganje naro\u010dilnice in klju\u010dni podatki se dodajo samodejno."
                  }
                  subject={schoolCustomerTemplate.subject}
                  body={schoolCustomerTemplate.body}
                  variables={ORDER_EMAIL_TEMPLATE_VARIABLES.schoolCustomer}
                  onSubjectChange={(value) =>
                    updateTemplate("schoolCustomer", "subject", value)
                  }
                  onBodyChange={(value) =>
                    updateTemplate("schoolCustomer", "body", value)
                  }
                  onReset={() => resetTemplate("schoolCustomer")}
                />
              ) : null}
              <TemplateEditorCard
                audience="admin"
                title="Administrator"
                description="Interno številko lahko vključite s {{order_number}}, povezava do naročila pa se doda samodejno."
                subject={draft.templates[selectedTemplateEvent].admin.subject}
                body={draft.templates[selectedTemplateEvent].admin.body}
                variables={ORDER_EMAIL_TEMPLATE_VARIABLES.admin}
                onSubjectChange={(value) =>
                  updateTemplate("admin", "subject", value)
                }
                onBodyChange={(value) => updateTemplate("admin", "body", value)}
                onReset={() => resetTemplate("admin")}
                className={
                  selectedTemplateEvent === "order_submitted"
                    ? "lg:col-span-2"
                    : ""
                }
              />
            </div>
          </SurfaceCard>
      </div>

      <div
        id="order-email-quotes-panel"
        role="tabpanel"
        aria-labelledby="order-email-tab-quotes"
        aria-hidden={activeTab !== "quotes"}
        hidden={activeTab !== "quotes"}
        tabIndex={activeTab === "quotes" ? 0 : -1}
        data-testid="order-email-quotes-panel"
      >
        <AdminQuoteEmailSettingsSection initialState={initialQuoteState} />
      </div>
    </div>
  );
}
