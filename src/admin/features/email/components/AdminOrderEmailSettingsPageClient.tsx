"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ImagePlus } from "lucide-react";
import {
  DEFAULT_ORDER_EMAIL_SETTINGS,
  ORDER_EMAIL_IMAGE_ATTACHMENT_MAX_BYTES,
  ORDER_EMAIL_TEMPLATE_CONTENT_HTML_MAX_LENGTH,
  ORDER_EMAIL_TEMPLATE_SUBJECT_MAX_LENGTH,
  ORDER_EMAIL_TEMPLATE_VARIABLES,
  ORDER_EMAIL_EVENT_DEFINITIONS,
  normalizeOrderEmailSettings,
  toStoredOrderEmailSettings,
  type OrderEmailEventType,
  type OrderEmailSettings,
} from "@/shared/domain/order/orderEmailSettings";
import {
  buildOrderEmailMessage,
  type OrderEmailJobPayload,
} from "@/shared/domain/order/orderEmailTemplates";
import { getStatusLabel } from "@/shared/domain/order/orderStatus";
import type { OrderEmailAdminState } from "@/shared/server/orderEmailSettings";
import type { QuoteEmailAdminState } from "@/shared/server/quoteEmailSettings";
import EmailTemplateWorkspace, {
  EmailTemplateRecipientToggle,
  getEmailTemplateActivity,
} from "@/admin/features/email/components/EmailTemplateWorkspace";
import AdminQuoteEmailSettingsSection, {
  type AdminQuoteEmailSaveState,
  type AdminQuoteEmailSettingsHandle,
} from "@/admin/features/email/components/AdminQuoteEmailSettingsSection";
import CustomerEmailConfirmationDialog from "@/admin/features/email/components/CustomerEmailConfirmationDialog";
import EmailQueueMetricCard from "@/admin/features/email/components/EmailQueueMetricCard";
import { parseCustomerEmailConfirmationRequired } from "@/admin/features/email/customerEmailConfirmation";
import { useCustomerEmailConfirmation } from "@/admin/features/email/useCustomerEmailConfirmation";
import { getOrderEmailEventStatusPresentation } from "@/admin/features/email/emailEventStatusPresentation";
import { uploadAdminPublicMedia } from "@/shared/client/publicMediaUpload";
import { AdminPageHeader } from "@/shared/ui/admin-primitives";
import { AdminSwitch } from "@/shared/ui/admin-switch";
import { Button } from "@/shared/ui/button";
import AdminCheckbox from "@/shared/ui/checkbox/admin-checkbox";
import EuiTabs from "@/shared/ui/eui-tabs";
import { TrashCanIcon } from "@/shared/ui/icons/AdminActionIcons";
import { Input } from "@/shared/ui/input";
import { Spinner } from "@/shared/ui/loading";
import {
  AdminTablePrimaryActionButton,
  adminTableBodyCellCenterClassName,
  adminTableBodyCellLeftClassName,
  adminTableBulkHeaderButtonClassName,
  adminTableHeaderCellCenterClassName,
  adminTableHeaderCellLeftClassName,
  adminTableRowHeightClassName,
  adminTableSelectedDangerIconButtonClassName,
  adminWindowCardClassName,
  adminWindowCardStyle,
} from "@/shared/ui/admin-table";
import { IconButton } from "@/shared/ui/icon-button";
import { CustomSelect } from "@/shared/ui/select";
import { Table, TBody, TD, TH, THead, TR } from "@/shared/ui/table";
import {
  adminInputFocusTokenClasses,
  adminPlaceholderTokenClasses,
} from "@/shared/ui/theme/tokens";
import { useToast } from "@/shared/ui/toast";

type UnknownRecord = Record<string, unknown>;
type EventKey = keyof OrderEmailSettings["events"];
type EventAudience = keyof OrderEmailSettings["events"][EventKey];
type EmailPageTab = "settings" | "orders" | "quotes";
type TemplateAudience = keyof OrderEmailSettings["templates"][EventKey];
type RecentFailure = OrderEmailAdminState["queue"]["recentFailures"][number];
type EmailImageAttachment = NonNullable<OrderEmailSettings["imageAttachment"]>;
type StagedEmailImageAttachment = {
  file: File;
  previewUrl: string;
  uploaded: EmailImageAttachment | null;
};

const fieldClassName = "h-9 px-3 text-[13px] leading-5";
const textareaClassName = `h-12 min-h-12 w-full resize-y rounded-md border border-slate-300 bg-white px-3 py-1.5 font-['Inter',system-ui,sans-serif] text-[13px] leading-4 text-slate-900 outline-none transition-[border-color,box-shadow,color,opacity] disabled:cursor-default disabled:bg-[color:var(--field-locked-bg)] disabled:opacity-60 ${adminInputFocusTokenClasses} ${adminPlaceholderTokenClasses}`;
const alignedFieldClassName = "grid min-w-0 grid-rows-[1fr_auto]";
const templateEventOptions = ORDER_EMAIL_EVENT_DEFINITIONS.map(
  ({ value, label }) => ({ value, label }),
);
const acceptedEmailImageContentTypes = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
]);
const orderEmailTemplateAudienceOptions = [
  { value: "customer", label: "Fiz. oseba" },
  { value: "companyCustomer", label: "Podjetje" },
  { value: "schoolCustomer", label: "Šola / javni zavod" },
  { value: "admin", label: "Admin" },
] as const satisfies ReadonlyArray<{ value: TemplateAudience; label: string }>;
const ORDER_EMAIL_PREVIEW_CREATED_AT = "2026-09-03T12:37:00.000Z";
const ORDER_EMAIL_PREVIEW_CUSTOMER_NAME = "Primer naročnika";
const ORDER_EMAIL_PREVIEW_CONTACT_NAME = "Ana Novak";
const ORDER_EMAIL_PREVIEW_CUSTOMER_EMAIL = "ana.novak@example.com";
const ORDER_EMAIL_PREVIEW_REFERENCE = "TEST-2026";
const ORDER_EMAIL_PREVIEW_ADDRESS_LINE_1 = "Slovenska cesta 1";
const ORDER_EMAIL_PREVIEW_POSTAL_CODE = "1000";
const ORDER_EMAIL_PREVIEW_CITY = "Ljubljana";
const ORDER_EMAIL_PREVIEW_ORDER_NUMBER = "#PREIZKUS";
const ORDER_EMAIL_PREVIEW_ACCESS_TOKEN =
  ["ath", "order"].join("_") + "_" + "P".repeat(43);

function orderEmailPreviewPurchaseOrderUrl(siteUrl: string): string {
  const url = new URL("/order/narocilnica", siteUrl);
  url.hash = new URLSearchParams({
    token: ORDER_EMAIL_PREVIEW_ACCESS_TOKEN,
  }).toString();
  return url.toString();
}

function orderEmailPreviewStatus(eventType: OrderEmailEventType): string {
  if (eventType === "order_submitted") return "Prejeto – čaka na sprejem";
  if (eventType === "order_accepted") return "Pogodbeno sprejeto";
  if (eventType === "order_rejected") return "Pogodbeno zavrnjeno";
  if (eventType === "predracun_issued") return "Predračun izdan";
  if (eventType === "invoice_issued") return "Račun izdan";
  return getStatusLabel(eventType);
}

function buildOrderEmailPreviewMessage(
  config: OrderEmailSettings,
  eventType: OrderEmailEventType,
  audience: TemplateAudience,
) {
  const settingsSnapshot = toStoredOrderEmailSettings({
    ...config,
    senderName: config.senderName.trim() || "Atehna",
    fromEmail: "preview@example.invalid",
    replyToEmail: "",
  });
  const customerType: "individual" | "company" | "school" =
    audience === "schoolCustomer"
      ? "school"
      : audience === "customer"
        ? "individual"
        : "company";
  const order = {
    createdAt: ORDER_EMAIL_PREVIEW_CREATED_AT,
    customer: {
      customerType,
      organizationName:
        customerType === "individual" ? null : ORDER_EMAIL_PREVIEW_CUSTOMER_NAME,
      contactName: ORDER_EMAIL_PREVIEW_CONTACT_NAME,
      email: ORDER_EMAIL_PREVIEW_CUSTOMER_EMAIL,
      reference: ORDER_EMAIL_PREVIEW_REFERENCE,
      addressLine1: ORDER_EMAIL_PREVIEW_ADDRESS_LINE_1,
      addressLine2: null,
      postalCode: ORDER_EMAIL_PREVIEW_POSTAL_CODE,
      city: ORDER_EMAIL_PREVIEW_CITY,
      countryCode: "SI",
    },
    items: [
      {
        sku: "TEST-001",
        name: "Testni izdelek",
        unit: "kos",
        quantity: 1,
        lineGross: 12.2,
        imageUrl: null,
      },
    ],
    totals: {
      net: 10,
      tax: 2.2,
      shipping: 0,
      gross: 12.2,
    },
  };
  const payloadBase = {
    eventType,
    occurredAt: ORDER_EMAIL_PREVIEW_CREATED_AT,
    previousStatus: eventType === "order_submitted" ? null : "received",
    settingsSnapshot,
  };
  const payload: OrderEmailJobPayload =
    audience === "admin"
      ? {
          ...payloadBase,
          audience: "admin",
          recipientEmail: "admin@example.invalid",
          recipientName: null,
          order: {
            ...order,
            orderId: 999_999_999,
            orderNumber: ORDER_EMAIL_PREVIEW_ORDER_NUMBER,
          },
        }
      : {
          ...payloadBase,
          audience: "customer",
          recipientEmail: ORDER_EMAIL_PREVIEW_CUSTOMER_EMAIL,
          recipientName: ORDER_EMAIL_PREVIEW_CONTACT_NAME,
          order,
          purchaseOrderUploadUrl:
            audience === "schoolCustomer" && eventType === "order_submitted"
              ? orderEmailPreviewPurchaseOrderUrl(settingsSnapshot.siteUrl)
              : null,
        };
  return buildOrderEmailMessage(payload);
}

function orderEmailPreviewVariables(
  eventType: OrderEmailEventType,
  audience: TemplateAudience,
) {
  const values: Record<string, string> = {
    recipient_name:
      audience === "admin" ? "" : ORDER_EMAIL_PREVIEW_CONTACT_NAME,
    customer_name: ORDER_EMAIL_PREVIEW_CUSTOMER_NAME,
    organization_name: ORDER_EMAIL_PREVIEW_CUSTOMER_NAME,
    contact_name: ORDER_EMAIL_PREVIEW_CONTACT_NAME,
    reference: ORDER_EMAIL_PREVIEW_REFERENCE,
    status: orderEmailPreviewStatus(eventType),
    previous_status:
      eventType === "order_submitted" ? "" : getStatusLabel("received"),
    order_number: ORDER_EMAIL_PREVIEW_ORDER_NUMBER,
    customer_email: ORDER_EMAIL_PREVIEW_CUSTOMER_EMAIL,
  };
  return ORDER_EMAIL_TEMPLATE_VARIABLES[audience].map((name) => ({
    name,
    value: values[name] ?? "",
  }));
}

function formatFileSize(size: number): string {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${Math.round(size / 1024)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

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
  titleAccessory,
  description,
  actions,
  children,
  testId,
  className = "bg-white",
  statusTone,
}: {
  title: string;
  titleAccessory?: React.ReactNode;
  description?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
  testId?: string;
  className?: string;
  statusTone?: string;
}) {
  return (
    <section
      className={`min-w-0 px-5 py-4 ${className}`}
      data-testid={testId}
      data-status-tone={statusTone}
    >
      <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-base font-semibold text-slate-900">{title}</h2>
            {titleAccessory}
          </div>
          {description ? (
            <p className="mt-1 max-w-3xl text-sm leading-5 text-slate-600">
              {description}
            </p>
          ) : null}
        </div>
        {actions ? (
          <div className="flex shrink-0 items-center sm:justify-end">
            {actions}
          </div>
        ) : null}
      </div>
      {children}
    </section>
  );
}

function SettingsCard({ children }: { children: React.ReactNode }) {
  return (
    <div
      className={`${adminWindowCardClassName} bg-white`}
      style={adminWindowCardStyle}
    >
      {children}
    </div>
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
      <span className="block text-xs font-semibold text-slate-700">
        {label}
      </span>
      {hint ? (
        <span className="mt-0.5 block text-xs text-slate-500">{hint}</span>
      ) : null}
    </label>
  );
}

function orderTemplateAudienceMeta(
  audience: TemplateAudience,
) {
  if (audience === "schoolCustomer") {
    return {
      label: "\u0161olo ali javni zavod",
      testId: "school-customer",
      title: "\u0160ola / javni zavod",
      description:
        "Uporabi se za naro\u010dnika vrste \u00bb\u0160ola / javni zavod\u00ab. Sistemski podatki in morebitna varna povezava za naro\u010dilnico se dodajo samodejno.",
    };
  }
  if (audience === "companyCustomer") {
    return {
      label: "podjetje",
      testId: "company-customer",
      title: "Podjetje",
      description:
        "Uporabi se za naro\u010dnika vrste \u00bbPodjetje\u00ab. Interna zaporedna \u0161tevilka naro\u010dila se kupcu ne razkrije.",
    };
  }
  if (audience === "admin") {
    return {
      label: "administratorja",
      testId: "admin",
      title: "Administrator",
      description:
        "Interno \u0161tevilko lahko vklju\u010dite s {{order_number}}, povezava do naro\u010dila pa se doda samodejno.",
    };
  }
  return {
    label: "fizi\u010dno osebo",
    testId: "individual-customer",
    title: "Fizi\u010dna oseba",
    description:
      "Uporabi se za naro\u010dnika vrste \u00bbFizi\u010dna oseba\u00ab. Interna zaporedna \u0161tevilka naro\u010dila se kupcu ne razkrije.",
  };
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
  const [isClientReady, setIsClientReady] = useState(false);
  const quoteEmailSettingsRef = useRef<AdminQuoteEmailSettingsHandle>(null);
  const [quoteEmailSaveState, setQuoteEmailSaveState] =
    useState<AdminQuoteEmailSaveState>({
      hasChanges: false,
      saving: false,
      saveDisabled:
        !initialQuoteState.schemaReady || !initialQuoteState.flags.admin,
      updatedAt: initialQuoteState.config.updatedAt,
      enabled: initialQuoteState.config.enabled,
      stockAcceptanceMode: initialQuoteState.config.stockAcceptanceMode,
      mutationsDisabled:
        !initialQuoteState.schemaReady || !initialQuoteState.flags.admin,
    });
  const [selectedTemplateEvent, setSelectedTemplateEvent] =
    useState<EventKey>("order_submitted");
  const [orderPreviewAudience, setOrderPreviewAudience] =
    useState<TemplateAudience>("customer");
  const [testRecipient, setTestRecipient] = useState("");
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [uploadingImageAttachment, setUploadingImageAttachment] =
    useState(false);
  const [stagedImageAttachment, setStagedImageAttachment] =
    useState<StagedEmailImageAttachment | null>(null);
  const imageAttachmentInputRef = useRef<HTMLInputElement>(null);
  const [actionErrors, setActionErrors] = useState<string[]>([]);
  const setActionError = (message: string | null) => {
    setActionErrors(message ? [message] : []);
  };
  const { toast } = useToast();
  const customerEmailConfirmation = useCustomerEmailConfirmation();

  useEffect(() => {
    setIsClientReady(true);
  }, []);

  useEffect(() => {
    const previewUrl = stagedImageAttachment?.previewUrl;
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [stagedImageAttachment?.previewUrl]);

  const hasChanges = useMemo(
    () =>
      stagedImageAttachment !== null ||
      comparableConfig(draft) !== comparableConfig(adminState.config),
    [adminState.config, draft, stagedImageAttachment],
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
  const selectedTemplateAudienceMeta = orderTemplateAudienceMeta(
    orderPreviewAudience,
  );
  const selectedTemplate =
    draft.templates[selectedTemplateEvent][orderPreviewAudience];
  const selectedTemplateEventSetting = draft.events[selectedTemplateEvent] ?? {
    customer: false,
    admins: false,
  };
  const selectedTemplateActivity = getEmailTemplateActivity(
    draft.enabled,
    selectedTemplateEventSetting.customer,
    selectedTemplateEventSetting.admins,
  );
  const displayedImageAttachment = stagedImageAttachment
    ? {
        url: stagedImageAttachment.previewUrl,
        filename: stagedImageAttachment.file.name,
        size: stagedImageAttachment.file.size,
      }
    : draft.imageAttachment;
  const orderPreview = useMemo(() => {
    try {
      const message = buildOrderEmailPreviewMessage(
        draft,
        selectedTemplateEvent,
        orderPreviewAudience,
      );
      return { subject: message.subject, html: message.html, error: null };
    } catch {
      return {
        subject: "",
        html: "",
        error: "Predogleda s trenutnimi nastavitvami ni mogoče prikazati.",
      };
    }
  }, [draft, orderPreviewAudience, selectedTemplateEvent]);
  const orderPreviewVariables = useMemo(
    () =>
      orderEmailPreviewVariables(
        selectedTemplateEvent,
        orderPreviewAudience,
      ),
    [orderPreviewAudience, selectedTemplateEvent],
  );

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
    field: "subject" | "contentHtml",
    value: string,
  ) => {
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

  const handleImageAttachmentSelected = (file: File | null) => {
    if (!file) return;
    if (!acceptedEmailImageContentTypes.has(file.type)) {
      const message = "Izberite sliko PNG, JPEG, WebP ali GIF.";
      setActionError(message);
      toast.error(message);
      if (imageAttachmentInputRef.current) {
        imageAttachmentInputRef.current.value = "";
      }
      return;
    }
    if (file.size <= 0) {
      const message = "Izbrana slikovna datoteka je prazna.";
      setActionError(message);
      toast.error(message);
      if (imageAttachmentInputRef.current) {
        imageAttachmentInputRef.current.value = "";
      }
      return;
    }
    if (file.size > ORDER_EMAIL_IMAGE_ATTACHMENT_MAX_BYTES) {
      const message = "Slikovna datoteka je lahko velika največ 5 MB.";
      setActionError(message);
      toast.error(message);
      if (imageAttachmentInputRef.current) {
        imageAttachmentInputRef.current.value = "";
      }
      return;
    }

    setStagedImageAttachment({
      file,
      previewUrl: URL.createObjectURL(file),
      uploaded: null,
    });
    setActionErrors([]);
  };

  const removeImageAttachment = () => {
    setStagedImageAttachment(null);
    updateConfig("imageAttachment", null);
    if (imageAttachmentInputRef.current) {
      imageAttachmentInputRef.current.value = "";
    }
  };

  const handleSave = async () => {
    if (saving || uploadingImageAttachment) return;
    const submittedDraft = draft;
    const submittedDraftComparable = comparableConfig(submittedDraft);
    const submittedStagedImage = stagedImageAttachment;
    setSaving(true);
    setActionError(null);
    try {
      let submittedConfig = submittedDraft;
      if (submittedStagedImage) {
        setUploadingImageAttachment(true);
        let imageAttachment = submittedStagedImage.uploaded;
        if (!imageAttachment) {
          const uploaded = await uploadAdminPublicMedia(
            submittedStagedImage.file,
            { scope: "email-shared-image" },
          );
          if (
            uploaded.mediaKind !== "image" ||
            !acceptedEmailImageContentTypes.has(uploaded.contentType)
          ) {
            throw new Error("Nalo\u017eena datoteka ni podprta slika.");
          }
          imageAttachment = {
            url: uploaded.url,
            pathname: uploaded.pathname,
            filename: uploaded.filename,
            contentType:
              uploaded.contentType as EmailImageAttachment["contentType"],
            size: uploaded.size,
          };
          setStagedImageAttachment((current) =>
            current?.file === submittedStagedImage.file
              ? { ...current, uploaded: imageAttachment }
              : current,
          );
        }
        submittedConfig = {
          ...submittedDraft,
          imageAttachment,
        };
        setUploadingImageAttachment(false);
      }

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
      setDraft((current) => {
        if (comparableConfig(current) === submittedDraftComparable) {
          return nextState.config;
        }
        return submittedStagedImage
          ? {
              ...current,
              imageAttachment: nextState.config.imageAttachment,
              updatedAt: nextState.config.updatedAt,
            }
          : current;
      });
      if (submittedStagedImage) {
        setStagedImageAttachment((current) =>
          current?.file === submittedStagedImage.file ? null : current,
        );
        if (imageAttachmentInputRef.current) {
          imageAttachmentInputRef.current.value = "";
        }
      }
      toast.success("Nastavitve samodejne e-pošte so shranjene.");
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Nastavitev e-pošte ni bilo mogoče shraniti.";
      setActionError(message);
      toast.error(message);
    } finally {
      setUploadingImageAttachment(false);
      setSaving(false);
    }
  };

  const handleTest = async () => {
    if (saving || uploadingImageAttachment || stagedImageAttachment) {
      const message = "Pred preizkusom najprej shranite slikovno priponko.";
      setActionError(message);
      toast.error(message);
      return;
    }
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

  const handleRetry = async (
    customerEmailConfirmationToken: string | null = null,
  ) => {
    setRetrying(true);
    setActionError(null);
    try {
      const response = await fetch("/api/admin/order-email-settings/retry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...(customerEmailConfirmationToken
            ? { customerEmailConfirmationToken }
            : {}),
        }),
      });
      const payload = await readPayload(response);
      if (!response.ok) {
        const confirmation = parseCustomerEmailConfirmationRequired(payload);
        if (response.status === 428 && confirmation) {
          customerEmailConfirmation.requestConfirmation(
            confirmation,
            () => void handleRetry(confirmation.confirmationToken),
          );
          return;
        }
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

  const nonQuoteHasChanges =
    activeTab === "settings"
      ? hasChanges || quoteEmailSaveState.hasChanges
      : hasChanges;
  const nonQuoteSaving =
    saving ||
    uploadingImageAttachment ||
    (activeTab === "settings" && quoteEmailSaveState.saving);
  const nonQuoteSaveDisabled =
    uploadingImageAttachment ||
    (activeTab === "settings"
      ? (saving || !hasChanges) && quoteEmailSaveState.saveDisabled
      : saving || !hasChanges);
  const handleNonQuoteSave = () => {
    if (!saving && !uploadingImageAttachment && hasChanges) void handleSave();
    if (activeTab === "settings" && !quoteEmailSaveState.saveDisabled) {
      void quoteEmailSettingsRef.current?.save();
    }
  };

  return (
    <fieldset
      className="m-0 w-full min-w-0 space-y-4 border-0 p-0 font-['Inter',system-ui,sans-serif]"
      disabled={!isClientReady}
      aria-busy={!isClientReady}
      data-client-ready={isClientReady ? "true" : "false"}
      data-testid="order-email-client-surface"
    >
      <AdminPageHeader
        title="Email"
        description="Skupni profil pošiljatelja ter ločeni dogodki, predloge in čakalne vrste za naročila in ponudbe."
        actions={
          activeTab === "quotes" ? (
            <div className="flex flex-wrap items-center justify-end gap-2">
              <span
                className="mr-1 inline-flex items-center gap-1.5 text-xs font-medium text-slate-500"
                role="status"
                aria-live="polite"
                data-testid="quote-email-save-status"
                title={
                  quoteEmailSaveState.hasChanges
                    ? "Spremembe še niso shranjene."
                    : quoteEmailSaveState.updatedAt
                      ? `Shranjeno: ${formatUpdatedAt(quoteEmailSaveState.updatedAt)}`
                      : "Shranjeno"
                }
              >
                <span
                  className={`h-1.5 w-1.5 rounded-full ${
                    quoteEmailSaveState.hasChanges
                      ? "bg-amber-500"
                      : "bg-emerald-500"
                  }`}
                  aria-hidden="true"
                />
                {quoteEmailSaveState.hasChanges ? "Neshranjeno" : "Shranjeno"}
              </span>
              <AdminTablePrimaryActionButton
                type="button"
                className="gap-2"
                disabled={quoteEmailSaveState.saveDisabled}
                onClick={() => void quoteEmailSettingsRef.current?.save()}
                data-testid="quote-email-settings-save"
              >
                {quoteEmailSaveState.saving ? <Spinner size="sm" /> : null}
                {quoteEmailSaveState.saving
                  ? "Shranjujem …"
                  : "Shrani spremembe"}
              </AdminTablePrimaryActionButton>
            </div>
          ) : (
            <div className="flex flex-wrap items-center justify-end gap-2">
              <span
                className="mr-1 inline-flex items-center gap-1.5 text-xs font-medium text-slate-500"
                role="status"
                aria-live="polite"
                data-testid="order-email-save-status"
                title={
                  nonQuoteHasChanges
                    ? "Spremembe še niso shranjene."
                    : adminState.config.updatedAt
                      ? `Shranjeno: ${formatUpdatedAt(adminState.config.updatedAt)}`
                      : "Shranjeno"
                }
              >
                <span
                  className={`h-1.5 w-1.5 rounded-full ${
                    nonQuoteHasChanges ? "bg-amber-500" : "bg-emerald-500"
                  }`}
                  aria-hidden="true"
                />
                {nonQuoteHasChanges ? "Neshranjeno" : "Shranjeno"}
              </span>
              <AdminTablePrimaryActionButton
                type="button"
                className="gap-2"
                disabled={nonQuoteSaveDisabled}
                onClick={handleNonQuoteSave}
                data-testid="order-email-settings-save"
              >
                {nonQuoteSaving ? <Spinner size="sm" /> : null}
                {nonQuoteSaving ? "Shranjujem …" : "Shrani spremembe"}
              </AdminTablePrimaryActionButton>
            </div>
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
            label: "Osnovne nastavitve",
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
        className="space-y-3 outline-none"
        data-testid="order-email-settings-panel"
      >
        <SettingsCard>
          <SurfaceCard
            title="Pošiljanje"
            testId="order-email-delivery-settings"
          >
            <div className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start">
                <div className="min-w-0 md:grid md:grid-cols-[10rem_minmax(0,1fr)] md:gap-5">
                  <h3 className="text-sm font-semibold text-slate-900">
                    Pošiljanje naročil
                  </h3>
                  <p className="mt-1 text-xs leading-5 text-slate-600 md:mt-0">
                    To stikalo ustavi ali omogoči poslovna e-poštna sporočila za
                    naročila. Na varnostne kode za dostop do ponudbe ne vpliva;
                    te upravlja preklop Pošiljanje ponudb. Skrivni dostop do
                    ponudnika se upravlja samo v okolju Vercel.
                  </p>
                </div>
                <div className="flex justify-end">
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
              </div>

              <div
                className={`rounded-lg border px-3 py-2.5 ${readiness.className}`}
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold">{readiness.label}</p>
                    <p className="mt-1 text-xs leading-5 opacity-90">
                      {readiness.detail}
                    </p>
                    {draft.enabled && !draftBasicReady ? (
                      <p className="mt-1 text-xs leading-5">
                        Pošiljanje ne bo delovalo, dokler shema, povezava in
                        trenutne osnovne nastavitve niso pripravljene.
                      </p>
                    ) : null}
                  </div>
                  <span className="rounded-full border border-current/20 px-2 py-0.5 text-xs font-semibold">
                    {adminState.delivery.provider}
                  </span>
                </div>
              </div>
            </div>

            <div
              className="mt-4 border-t border-slate-200 pt-4"
              data-testid="quote-email-delivery-settings"
            >
              <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start">
                <div className="min-w-0 md:grid md:grid-cols-[10rem_minmax(0,1fr)] md:gap-5">
                  <h3 className="text-sm font-semibold text-slate-900">
                    Pošiljanje ponudb
                  </h3>
                  <p className="mt-1 text-xs leading-5 text-slate-600 md:mt-0">
                    Glavni preklop upravlja vso e-pošto za ponudbe, vključno z
                    varnostnimi kodami za spletni sprejem. Uporablja isti profil
                    pošiljatelja, Reply-To, ponudnika in administratorske
                    prejemnike kot naročila. Dogodki, predloge in čakalna vrsta
                    ponudb ostanejo ločeni na zavihku Ponudbe.
                  </p>
                </div>
                <div className="flex justify-end">
                  <AdminSwitch
                    checked={quoteEmailSaveState.enabled}
                    disabled={
                      quoteEmailSaveState.saving ||
                      quoteEmailSaveState.mutationsDisabled
                    }
                    ariaLabel={
                      quoteEmailSaveState.enabled
                        ? "Izklopi e-pošto za ponudbe"
                        : "Vključi e-pošto za ponudbe"
                    }
                    onChange={(enabled) => {
                      setQuoteEmailSaveState((current) => ({
                        ...current,
                        enabled,
                      }));
                      quoteEmailSettingsRef.current?.setEnabled(enabled);
                    }}
                  />
                </div>
              </div>

              {!initialQuoteState.schemaReady ? (
                <div
                  role="alert"
                  className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2.5 text-sm text-rose-800"
                >
                  Podatkovna shema e-pošte za ponudbe ni nameščena.
                </div>
              ) : (
                <div
                  className="mt-3 rounded-lg border border-slate-200 bg-slate-50/60 px-3 py-3"
                  data-testid="quote-stock-acceptance-policy"
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <h3 className="text-sm font-semibold text-slate-900">
                        Samodejna blokada sprejema zaradi zaloge
                      </h3>
                      <p className="mt-1 max-w-3xl text-xs leading-5 text-slate-600">
                        Ročni način (privzeto): konflikt zaloge varno ustavi
                        sprejem, ponudba pa ostane izdana in jo je mogoče po
                        uskladitvi zaloge znova sprejeti. Sistem ne ustvari
                        trajne blokade in ne pošlje obvestila o blokadi.
                      </p>
                      <p className="mt-1 max-w-3xl text-xs leading-5 text-slate-600">
                        Samodejni način: konflikt zabeleži kot blokiran sprejem
                        in pošlje obvestila prejemnikom, izbranim pri dogodku
                        »Sprejem blokiran zaradi zaloge«.
                      </p>
                    </div>
                    <AdminSwitch
                      checked={
                        quoteEmailSaveState.stockAcceptanceMode === "automatic"
                      }
                      disabled={
                        quoteEmailSaveState.saving ||
                        quoteEmailSaveState.mutationsDisabled
                      }
                      ariaLabel={
                        quoteEmailSaveState.stockAcceptanceMode === "automatic"
                          ? "Preklopi blokado sprejema zaradi zaloge na ročni način"
                          : "Preklopi blokado sprejema zaradi zaloge na samodejni način"
                      }
                      onChange={(automatic) => {
                        const stockAcceptanceMode = automatic
                          ? "automatic"
                          : "manual";
                        setQuoteEmailSaveState((current) => ({
                          ...current,
                          stockAcceptanceMode,
                        }));
                        quoteEmailSettingsRef.current?.setStockAcceptanceMode(
                          stockAcceptanceMode,
                        );
                      }}
                    />
                  </div>
                </div>
              )}
            </div>
          </SurfaceCard>
        </SettingsCard>

        <SettingsCard>
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
                <Input
                  id="order-email-sender-name"
                  aria-label="Ime pošiljatelja"
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
                <Input
                  id="order-email-from-address"
                  aria-label="E-poštni naslov pošiljatelja"
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
                <Input
                  id="order-email-reply-to"
                  aria-label="Naslov za odgovore"
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
                <Input
                  id="order-email-site-url"
                  aria-label="Naslov spletnega mesta"
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
        </SettingsCard>

        <SettingsCard>
          <SurfaceCard
            title="Skupna vsebina"
            titleAccessory={
              <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-semibold text-slate-600">
                Naročila in ponudbe
              </span>
            }
            description="Privzeta vsebina za vsa poslovna sporočila naročil in ponudb."
            testId="order-email-shared-content"
          >
            <div className="grid items-stretch gap-0 lg:grid-cols-[minmax(0,1.15fr)_minmax(20rem,0.85fr)]">
              <div
                className="min-w-0 space-y-3 lg:pr-5"
                data-testid="order-email-shared-text-panel"
              >
                <div className="min-w-0">
                  <FieldLabel
                    htmlFor="order-email-subject-prefix"
                    label="Predpona zadeve"
                    hint="Dodana bo pred zadevo vsakega sporočila."
                  />
                  <Input
                    id="order-email-subject-prefix"
                    aria-label="Predpona zadeve"
                    className={fieldClassName + " mt-1.5"}
                    value={draft.subjectPrefix}
                    maxLength={80}
                    disabled={saving || uploadingImageAttachment}
                    onChange={(event) =>
                      updateConfig("subjectPrefix", event.target.value)
                    }
                    placeholder="Atehna"
                  />
                </div>

                <div className="min-w-0">
                  <FieldLabel
                    htmlFor="order-email-header"
                    label="Besedilo glave"
                    hint="Neobvezno besedilo pred glavno vsebino sporočila."
                  />
                  <textarea
                    id="order-email-header"
                    aria-label="Besedilo glave"
                    className={textareaClassName + " mt-1.5"}
                    value={draft.headerText}
                    maxLength={1000}
                    disabled={saving || uploadingImageAttachment}
                    onChange={(event) =>
                      updateConfig("headerText", event.target.value)
                    }
                    placeholder="Pozdravljeni,"
                  />
                </div>

                <div
                  className="flex items-center gap-2 py-0.5"
                  aria-hidden="true"
                >
                  <span className="h-px flex-1 bg-slate-200" />
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-slate-500">
                    Samodejna vsebina e-pošte
                  </span>
                  <span className="h-px flex-1 bg-slate-200" />
                </div>

                <div className="min-w-0">
                  <FieldLabel
                    htmlFor="order-email-footer"
                    label="Dodatno besedilo v nogi"
                    hint="Neobvezno besedilo na koncu sporočila."
                  />
                  <textarea
                    id="order-email-footer"
                    aria-label="Dodatno besedilo v nogi"
                    className={textareaClassName + " mt-1.5"}
                    value={draft.footerText}
                    maxLength={1000}
                    disabled={saving || uploadingImageAttachment}
                    onChange={(event) =>
                      updateConfig("footerText", event.target.value)
                    }
                    placeholder="Hvala za vaše naročilo."
                  />
                </div>
              </div>

              <div
                className="mt-4 min-w-0 border-t border-slate-200 pt-4 lg:mt-0 lg:flex lg:h-full lg:min-h-0 lg:flex-col lg:border-l lg:border-t-0 lg:pl-5 lg:pt-0"
                data-testid="order-email-shared-image-panel"
              >
                <FieldLabel
                  htmlFor="order-email-image-attachment"
                  label="Slikovna priponka"
                  hint="Neobvezna priponka · PNG, JPEG, WebP ali GIF · največ 5 MB."
                />
                <Input
                  ref={imageAttachmentInputRef}
                  id="order-email-image-attachment"
                  type="file"
                  hidden
                  className="sr-only"
                  accept="image/png,image/jpeg,image/webp,image/gif"
                  aria-label="Slikovna priponka"
                  disabled={saving || uploadingImageAttachment}
                  onChange={(event) =>
                    handleImageAttachmentSelected(
                      event.target.files?.[0] ?? null,
                    )
                  }
                />

                {displayedImageAttachment ? (
                  <div
                    className="mt-1.5 overflow-hidden rounded-lg border border-slate-200 bg-slate-50/70 lg:flex lg:min-h-0 lg:flex-1 lg:flex-col"
                    data-testid="order-email-image-surface"
                    data-email-image-surface="true"
                  >
                    <div className="flex min-h-40 items-center justify-center bg-white p-4 sm:min-h-44 lg:min-h-0 lg:flex-1">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={displayedImageAttachment.url}
                        alt=""
                        className="max-h-36 max-w-full rounded-md border border-slate-200 bg-white object-contain"
                        data-testid="order-email-image-preview"
                      />
                    </div>
                    <div className="flex flex-wrap items-center gap-2.5 border-t border-slate-200 p-2.5">
                      <div className="min-w-0 flex-1">
                        <p
                          className="truncate text-[13px] font-medium leading-5 text-slate-900"
                          data-testid="order-email-image-filename"
                        >
                          {displayedImageAttachment.filename}
                        </p>
                        <p className="truncate text-xs text-slate-500">
                          {formatFileSize(displayedImageAttachment.size)}
                          {stagedImageAttachment ? " \u00b7 Neshranjeno" : ""}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-1.5">
                        <IconButton
                          type="button"
                          tone="neutral"
                          size="md"
                          disabled={saving || uploadingImageAttachment}
                          onClick={() =>
                            imageAttachmentInputRef.current?.click()
                          }
                          aria-label="Zamenjaj slikovno priponko"
                          title="Zamenjaj slikovno priponko"
                          data-testid="order-email-image-replace"
                        >
                          {uploadingImageAttachment ? (
                            <Spinner size="sm" />
                          ) : (
                            <ImagePlus className="h-4 w-4" aria-hidden="true" />
                          )}
                        </IconButton>
                        <IconButton
                          type="button"
                          tone="danger"
                          size="md"
                          disabled={saving || uploadingImageAttachment}
                          onClick={removeImageAttachment}
                          aria-label="Odstrani slikovno priponko"
                          title="Odstrani slikovno priponko"
                          data-testid="order-email-image-remove"
                        >
                          <TrashCanIcon className="!h-4 !w-4" />
                        </IconButton>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div
                    className="mt-1.5 flex min-h-40 flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-slate-300 bg-slate-50/50 px-4 py-6 text-center sm:min-h-44 lg:min-h-0 lg:flex-1"
                    data-testid="order-email-image-empty-state"
                    data-email-image-surface="true"
                  >
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-white text-slate-500 ring-1 ring-slate-200">
                      <ImagePlus className="h-4 w-4" aria-hidden="true" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[13px] font-medium leading-5 text-slate-800">
                        Ni izbrane slike
                      </p>
                      <p className="text-xs text-slate-500">
                        Priponka se doda v izvirni velikosti.
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="default"
                      size="toolbar"
                      className={adminTableBulkHeaderButtonClassName}
                      disabled={saving || uploadingImageAttachment}
                      onClick={() => imageAttachmentInputRef.current?.click()}
                      data-testid="order-email-image-upload"
                    >
                      {uploadingImageAttachment ? <Spinner size="sm" /> : null}
                      {"Nalo\u017ei"}
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </SurfaceCard>
        </SettingsCard>

        <SettingsCard>
          <SurfaceCard
            title="Potrditve in prejemniki"
            description="Nastavite dodatno potrditev pred e-pošto stranki in naslove za administratorska obvestila."
          >
            <div className="divide-y divide-slate-200">
              <section
                className="pb-4"
                data-testid="order-email-customer-confirmation-settings"
              >
                <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start">
                  <div className="min-w-0 md:grid md:grid-cols-[10rem_minmax(0,1fr)] md:gap-5">
                    <h3 className="text-sm font-semibold text-slate-900">
                      Potrditev e-pošte stranki
                    </h3>
                    <p className="mt-1 text-xs leading-5 text-slate-600 md:mt-0">
                      Pred dejanjem, ki stranki uvrsti e-pošto v čakalno vrsto,
                      zahtevaj dodatno potrditev. Poslovno pomembne potrditve,
                      na primer izdaja ali umik ponudbe, lahko ostanejo obvezne
                      neodvisno od te nastavitve.
                    </p>
                  </div>
                  <AdminSwitch
                    checked={draft.confirmCustomerEmails}
                    disabled={saving}
                    ariaLabel="Zahtevaj dodatno potrditev pred dejanji, ki pošljejo e-pošto stranki"
                    onChange={(confirmCustomerEmails) =>
                      updateConfig(
                        "confirmCustomerEmails",
                        confirmCustomerEmails,
                      )
                    }
                  />
                </div>
              </section>

              <section
                className="pt-4"
                data-testid="order-email-admin-recipients"
              >
                <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start">
                  <div className="min-w-0 md:grid md:grid-cols-[10rem_minmax(0,1fr)] md:gap-5">
                    <h3 className="text-sm font-semibold text-slate-900">
                      Prejemniki za administracijo
                    </h3>
                    <p className="mt-1 text-xs leading-5 text-slate-600 md:mt-0">
                      Na te naslove se pošiljajo dogodki, pri katerih je v
                      tabeli dogodkov označen stolpec Administratorji.
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="default"
                    size="toolbar"
                    className={adminTableBulkHeaderButtonClassName}
                    onClick={() =>
                      updateConfig("adminRecipients", [
                        ...draft.adminRecipients,
                        "",
                      ])
                    }
                  >
                    <span aria-hidden>+</span>
                    Dodaj naslov
                  </Button>
                </div>

                {draft.adminRecipients.length === 0 ? (
                  <div className="mt-3 rounded-lg border border-dashed border-slate-300 bg-slate-50 px-3 py-3 text-sm text-slate-600">
                    Administrator še nima nastavljenega prejemnika.
                  </div>
                ) : (
                  <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                    {draft.adminRecipients.map((recipient, index) => (
                      <div
                        key={`admin-recipient-${index}`}
                        className="flex min-w-0 items-center gap-2"
                      >
                        <label
                          htmlFor={`order-email-admin-${index}`}
                          className="sr-only"
                        >
                          E-poštni naslov administratorja {index + 1}
                        </label>
                        <Input
                          id={`order-email-admin-${index}`}
                          aria-label={`E-poštni naslov administratorja ${index + 1}`}
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
                        <IconButton
                          type="button"
                          tone="danger"
                          size="md"
                          className={
                            adminTableSelectedDangerIconButtonClassName
                          }
                          onClick={() => removeAdminRecipient(index)}
                          aria-label={`Odstrani e-poštni naslov administratorja ${index + 1}`}
                          title="Odstrani naslov"
                        >
                          <TrashCanIcon className="!h-4 !w-4" />
                        </IconButton>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </div>
          </SurfaceCard>
        </SettingsCard>

        <SettingsCard>
          <section
            className="grid gap-4 px-5 py-4 lg:grid-cols-[minmax(0,1fr)_minmax(28rem,0.9fr)] lg:items-end"
            data-testid="order-email-test-delivery"
          >
            <div className="min-w-0">
              <h2 className="text-base font-semibold text-slate-900">
                Preizkus pošiljanja
              </h2>
              <p className="mt-1 max-w-3xl text-sm leading-5 text-slate-600">
                Pošlje administratorsko predlogo za dogodek Oddano naročilo.
                Uporabi tudi neshranjeno besedilo; novo slikovno priponko morate
                najprej shraniti. API ključ se nikoli ne pošlje v brskalnik.
              </p>
            </div>
            <form
              className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-end"
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
                <Input
                  id="order-email-test-recipient"
                  aria-label="Prejemnik testa"
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
              <AdminTablePrimaryActionButton
                type="submit"
                className="gap-2"
                disabled={
                  testing ||
                  saving ||
                  uploadingImageAttachment ||
                  stagedImageAttachment !== null
                }
                title={
                  stagedImageAttachment
                    ? "Pred preizkusom shranite slikovno priponko."
                    : undefined
                }
                data-testid="order-email-send-test"
              >
                {testing ? <Spinner size="sm" /> : null}
                {testing ? "Pošiljam …" : "Pošlji test"}
              </AdminTablePrimaryActionButton>
            </form>
          </section>
        </SettingsCard>
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
            <Table
              className="min-w-[640px] table-fixed text-[12px]"
              data-testid="order-email-event-table"
            >
              <THead>
                <TR className="hover:bg-transparent">
                  <TH scope="col" className={adminTableHeaderCellLeftClassName}>
                    Dogodek
                  </TH>
                  <TH
                    scope="col"
                    className={`${adminTableHeaderCellCenterClassName} w-36`}
                  >
                    Stranka
                  </TH>
                  <TH
                    scope="col"
                    className={`${adminTableHeaderCellCenterClassName} w-44`}
                  >
                    Administratorji
                  </TH>
                </TR>
              </THead>
              <TBody className="divide-y divide-slate-200 bg-white">
                {ORDER_EMAIL_EVENT_DEFINITIONS.map((definition) => {
                  const eventKey = definition.value as EventKey;
                  const eventSetting = draft.events[eventKey] ?? {
                    customer: false,
                    admins: false,
                  };
                  const statusPresentation =
                    getOrderEmailEventStatusPresentation(eventKey);
                  return (
                    <TR
                      key={String(definition.value)}
                      className={`${adminTableRowHeightClassName} ${statusPresentation.rowClassName}`}
                      data-testid={`order-email-event-row-${String(definition.value)}`}
                      data-status-tone={statusPresentation.tone}
                    >
                      <TH
                        scope="row"
                        className={`${adminTableBodyCellLeftClassName} border-b-0 !font-normal`}
                      >
                        <span className="block font-medium text-slate-900">
                          {definition.label}
                        </span>
                        <span className="mt-0.5 block text-xs leading-4 text-slate-500">
                          {definition.description}
                        </span>
                      </TH>
                      <TD className={adminTableBodyCellCenterClassName}>
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
                      </TD>
                      <TD className={adminTableBodyCellCenterClassName}>
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
                      </TD>
                    </TR>
                  );
                })}
              </TBody>
            </Table>
          </div>
        </SurfaceCard>
        <EmailTemplateWorkspace<TemplateAudience>
          idPrefix="order-email-template"
          testId="order-email-message-templates"
          title="Predloge sporočil"
          description="Za vsak dogodek posebej nastavite zadevo in oblikovano vsebino za posamezne skupine prejemnikov. Povzetek naročila, artikli in slike artiklov, kadar so na voljo, se dodajo samodejno."
          eventSelector={
            <>
              <FieldLabel
                htmlFor="order-email-template-event"
                label="Dogodek naročila"
                hint="Izberite dogodek, katerega predloge so prikazane spodaj."
              />
              <CustomSelect<EventKey>
                id="order-email-template-event"
                testId="order-email-template-event"
                value={selectedTemplateEvent}
                onChange={(value) => {
                  setSelectedTemplateEvent(value);
                  setActionErrors([]);
                }}
                options={templateEventOptions}
                ariaLabel="Dogodek naročila"
                containerClassName="mt-1.5"
                triggerClassName="!h-9 !px-3 !text-[13px] !leading-5"
              />
            </>
          }
          activity={selectedTemplateActivity}
          recipientControls={
            <>
              <EmailTemplateRecipientToggle
                kind="customer"
                label="Pošiljanje stranki"
                checked={selectedTemplateEventSetting.customer}
                title="Vklopi ali izklopi pošiljanje stranki za izbrani dogodek"
                onChange={(checked) =>
                  updateEvent(
                    selectedTemplateEvent,
                    "customer",
                    checked,
                  )
                }
                testId="order-email-template-recipient-customer"
              />
              <EmailTemplateRecipientToggle
                kind="admin"
                label="Pošiljanje administratorjem"
                checked={selectedTemplateEventSetting.admins}
                title="Vklopi ali izklopi pošiljanje administratorjem za izbrani dogodek"
                onChange={(checked) =>
                  updateEvent(
                    selectedTemplateEvent,
                    "admins",
                    checked,
                  )
                }
                testId="order-email-template-recipient-admin"
              />
            </>
          }
          audiences={orderEmailTemplateAudienceOptions}
          activeAudience={orderPreviewAudience}
          onAudienceChange={(audience) => {
            setOrderPreviewAudience(audience);
            setActionErrors([]);
          }}
          workspaceTestId="order-email-template-grid"
          editor={{
            testId: `order-email-template-${selectedTemplateAudienceMeta.testId}`,
            title: selectedTemplateAudienceMeta.title,
            description: selectedTemplateAudienceMeta.description,
            subject: {
              id: `order-email-template-${selectedTemplateAudienceMeta.testId}-subject`,
              label: "Zadeva",
              value: selectedTemplate.subject,
              maxLength: ORDER_EMAIL_TEMPLATE_SUBJECT_MAX_LENGTH,
              testId: `order-email-template-${selectedTemplateAudienceMeta.testId}-subject`,
              onChange: (value) =>
                updateTemplate(orderPreviewAudience, "subject", value),
            },
            contentHtml: {
              id: `order-email-template-${selectedTemplateAudienceMeta.testId}-content`,
              label: "Vsebina sporočila",
              value: selectedTemplate.contentHtml ?? "",
              maxLength: ORDER_EMAIL_TEMPLATE_CONTENT_HTML_MAX_LENGTH,
              testId: `order-email-template-${selectedTemplateAudienceMeta.testId}-content`,
              onChange: (value) =>
                updateTemplate(orderPreviewAudience, "contentHtml", value),
            },
            variables: ORDER_EMAIL_TEMPLATE_VARIABLES[orderPreviewAudience],
            variablesAriaLabel: `Dovoljene spremenljivke za ${selectedTemplateAudienceMeta.label}`,
          }}
          onReset={() => resetTemplate(orderPreviewAudience)}
          resetAriaLabel={`Ponastavi privzeto predlogo za ${selectedTemplateAudienceMeta.label}`}
          resetTestId={`order-email-template-${selectedTemplateAudienceMeta.testId}-reset`}
          preview={{
            subject: orderPreview.subject,
            html: orderPreview.html,
            variables: orderPreviewVariables,
            error: orderPreview.error,
            testId: "order-email-preview",
          }}
        />

        <SurfaceCard
          title="Čakalna vrsta naročil"
          description="Tukaj se zabeleži sprejem pri Resendu; končna dostava in zavrnitve so vidne v Resendu. Neuspela opravila lahko varno znova uvrstite v čakalno vrsto."
          testId="order-email-queue"
          actions={
            <Button
              type="button"
              variant="default"
              size="toolbar"
              className={adminTableBulkHeaderButtonClassName}
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
            </Button>
          }
        >
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <EmailQueueMetricCard
              label="Na čakanju"
              value={adminState.queue.pending}
            />
            <EmailQueueMetricCard
              label="V obdelavi"
              value={adminState.queue.processing}
            />
            <EmailQueueMetricCard
              label="Sprejeta pri Resendu"
              value={adminState.queue.sent}
            />
            <EmailQueueMetricCard
              label="Neuspela"
              value={adminState.queue.failed}
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
                <Table className="min-w-[760px] table-fixed text-[12px]">
                  <THead>
                    <TR className="hover:bg-transparent">
                      <TH
                        scope="col"
                        className={adminTableHeaderCellLeftClassName}
                      >
                        Dogodek
                      </TH>
                      <TH
                        scope="col"
                        className={adminTableHeaderCellLeftClassName}
                      >
                        Prejemnik
                      </TH>
                      <TH
                        scope="col"
                        className={`${adminTableHeaderCellCenterClassName} w-20`}
                      >
                        Poskusi
                      </TH>
                      <TH
                        scope="col"
                        className={adminTableHeaderCellLeftClassName}
                      >
                        Napaka
                      </TH>
                      <TH
                        scope="col"
                        className={`${adminTableHeaderCellLeftClassName} w-36`}
                      >
                        Posodobljeno
                      </TH>
                    </TR>
                  </THead>
                  <TBody className="divide-y divide-slate-200 bg-white">
                    {adminState.queue.recentFailures.map((failure) => (
                      <TR
                        key={failure.id}
                        className={adminTableRowHeightClassName}
                      >
                        <TD
                          className={`${adminTableBodyCellLeftClassName} text-slate-800`}
                        >
                          {eventLabels.get(failure.eventType) ??
                            failure.eventType}
                        </TD>
                        <TD className={adminTableBodyCellLeftClassName}>
                          {failure.recipientEmail}
                        </TD>
                        <TD
                          className={`${adminTableBodyCellCenterClassName} tabular-nums`}
                        >
                          {failure.attempts}
                        </TD>
                        <TD
                          className={`${adminTableBodyCellLeftClassName} max-w-sm text-slate-600`}
                        >
                          <span
                            className="block truncate"
                            title={failure.lastError ?? undefined}
                          >
                            {failure.lastError || "Neznana napaka"}
                          </span>
                        </TD>
                        <TD
                          className={`${adminTableBodyCellLeftClassName} whitespace-nowrap text-slate-600`}
                        >
                          {formatUpdatedAt(failure.updatedAt)}
                        </TD>
                      </TR>
                    ))}
                  </TBody>
                </Table>
              </div>
            )}
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
        <AdminQuoteEmailSettingsSection
          ref={quoteEmailSettingsRef}
          initialState={initialQuoteState}
          sharedSettings={draft}
          onSaveStateChange={setQuoteEmailSaveState}
        />
      </div>
      <CustomerEmailConfirmationDialog
        confirmation={customerEmailConfirmation.confirmation}
        onCancel={customerEmailConfirmation.cancelConfirmation}
        onConfirm={customerEmailConfirmation.confirm}
        confirmDisabled={retrying}
      />
    </fieldset>
  );
}
