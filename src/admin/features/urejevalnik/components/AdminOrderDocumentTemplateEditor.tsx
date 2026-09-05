'use client';

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState
} from 'react';
import { FilePenLine, FileText, RefreshCw } from 'lucide-react';
import {
  ORDER_DOCUMENT_TEMPLATE_TYPES,
  arrangeOrderDocumentTemplate,
  cloneDefaultOrderDocumentTemplate,
  cloneDefaultOrderDocumentTemplatesConfig,
  normalizeOrderDocumentTemplatesConfig,
  type OrderDocumentTemplate,
  type OrderDocumentTemplatesConfig,
  type OrderDocumentTemplateType
} from '@/shared/domain/order/orderDocumentTemplates';
import {
  cloneDefaultSiteLogoConfig,
  normalizeSiteLogoConfig,
  toStoredSiteLogoConfig,
  type SiteLogoConfig
} from '@/shared/domain/logo/siteLogo';
import { AdminPageHeader } from '@/shared/ui/admin-primitives';
import Button from '@/shared/ui/button/Button';
import { useToast } from '@/shared/ui/toast';
import OrderDocumentTemplateCanvas from './OrderDocumentTemplateCanvas';
import { renderOrderDocumentPreview, type OrderDocumentRenderedPreview } from '../lib/renderOrderDocumentPreview';

type Props = {
  initialConfig?: unknown;
  initialLogoConfig?: SiteLogoConfig;
  quoteOfferTemplateEnabled?: boolean;
};

type PreviewState = {
  requestKey: string | null;
  loading: boolean;
  error: string | null;
};

type PreviewDocument = OrderDocumentRenderedPreview & { requestKey: string };

const TEMPLATE_META: Record<
  OrderDocumentTemplateType,
  { label: string; description: string }
> = {
  order_summary: {
    label: 'Potrditev naročila',
    description: 'Potrdilo o prejemu in vsebini naročila.'
  },
  offer: {
    label: 'Ponudba',
    description: 'Ločena ponudba z obvezno identiteto, veljavnostjo, vsotami in načinom sprejema.'
  },
  dobavnica: {
    label: 'Dobavnica',
    description: 'Dokument, ki spremlja odpremo oziroma prevzem blaga.'
  },
  predracun: {
    label: 'Predračun',
    description: 'Ponudbeni dokument z veljavnostjo in podatki za plačilo.'
  },
  invoice: {
    label: 'Račun',
    description: 'Končni račun z rokom plačila in davčnim povzetkom.'
  }
};

const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const messageFromPayload = (payload: unknown, fallback: string) => {
  if (!isRecord(payload)) return fallback;
  if (typeof payload.message === 'string' && payload.message.trim()) return payload.message;
  if (Array.isArray(payload.errors)) {
    const errors = payload.errors.filter((item): item is string => typeof item === 'string');
    if (errors.length > 0) return errors.join(' ');
  }
  return fallback;
};

const formatUpdatedAt = (value: string | null | undefined) => {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return new Intl.DateTimeFormat('sl-SI', {
    dateStyle: 'short',
    timeStyle: 'short'
  }).format(parsed);
};

function Spinner() {
  return (
    <span
      aria-hidden
      className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-r-transparent"
    />
  );
}

export default function AdminOrderDocumentTemplateEditor({
  initialConfig,
  initialLogoConfig,
  quoteOfferTemplateEnabled = false
}: Props) {
  const normalizedInitial = useMemo(
    () =>
      normalizeOrderDocumentTemplatesConfig(
        initialConfig ?? cloneDefaultOrderDocumentTemplatesConfig()
      ),
    [initialConfig]
  );
  const normalizedInitialLogo = useMemo(
    () =>
      normalizeSiteLogoConfig(
        initialLogoConfig ?? cloneDefaultSiteLogoConfig()
      ),
    [initialLogoConfig]
  );
  const [draft, setDraft] = useState<OrderDocumentTemplatesConfig>(() => clone(normalizedInitial));
  const [savedConfig, setSavedConfig] = useState<OrderDocumentTemplatesConfig>(() =>
    clone(normalizedInitial)
  );
  const [logoConfig, setLogoConfig] = useState<SiteLogoConfig>(() =>
    clone(normalizedInitialLogo)
  );
  const [savedLogoConfig, setSavedLogoConfig] = useState<SiteLogoConfig>(() =>
    clone(normalizedInitialLogo)
  );
  const [selectedType, setSelectedType] =
    useState<OrderDocumentTemplateType>('order_summary');
  const availableTemplateTypes = useMemo(
    () =>
      ORDER_DOCUMENT_TEMPLATE_TYPES.filter(
        (type) => quoteOfferTemplateEnabled || type !== 'offer'
      ),
    [quoteOfferTemplateEnabled]
  );
  const [viewMode, setViewMode] = useState<'canvas' | 'pdf'>('canvas');
  const [saving, setSaving] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [previewDocument, setPreviewDocument] = useState<PreviewDocument | null>(null);
  const [previewState, setPreviewState] = useState<PreviewState>({
    requestKey: null,
    loading: false,
    error: null
  });
  const [previewNonce, setPreviewNonce] = useState(0);
  const previewDocumentRef = useRef<PreviewDocument | null>(null);
  const previewAbortRef = useRef<AbortController | null>(null);
  const { toast } = useToast();

  const currentTemplate = draft.templates[selectedType];
  const previewRequestBody = useMemo(
    () => JSON.stringify({
      type: selectedType,
      includeLayout: true,
      template: currentTemplate,
      logoConfig: toStoredSiteLogoConfig(logoConfig)
    }),
    [currentTemplate, logoConfig, selectedType]
  );
  const previewRequestKey = useMemo(
    () => JSON.stringify({ body: previewRequestBody, nonce: previewNonce }),
    [previewNonce, previewRequestBody]
  );
  const activePreviewDocument =
    previewDocument?.requestKey === previewRequestKey ? previewDocument : null;
  const activePreviewState: PreviewState =
    previewState.requestKey === previewRequestKey
      ? previewState
      : {
          requestKey: previewRequestKey,
          loading: true,
          error: null
        };
  const templateDirty = useMemo(
    () => JSON.stringify(draft.templates) !== JSON.stringify(savedConfig.templates),
    [draft.templates, savedConfig.templates]
  );
  const logoDirty = useMemo(
    () =>
      JSON.stringify(toStoredSiteLogoConfig(logoConfig)) !==
      JSON.stringify(toStoredSiteLogoConfig(savedLogoConfig)),
    [logoConfig, savedLogoConfig]
  );
  const dirty = templateDirty || logoDirty;
  const savedAt = formatUpdatedAt(
    [savedConfig.updatedAt, savedLogoConfig.updatedAt]
      .filter((value): value is string => Boolean(value))
      .sort()
      .at(-1)
  );

  const replacePreviewDocument = useCallback((nextDocument: PreviewDocument | null) => {
    const previousDocument = previewDocumentRef.current;
    if (previousDocument?.url && previousDocument.url !== nextDocument?.url) {
      URL.revokeObjectURL(previousDocument.url);
    }
    previewDocumentRef.current = nextDocument;
    setPreviewDocument(nextDocument);
  }, []);

  const resetPreviewSession = useCallback(() => {
    previewAbortRef.current?.abort();
    previewAbortRef.current = null;
    replacePreviewDocument(null);
    setPreviewState({ requestKey: null, loading: false, error: null });
  }, [replacePreviewDocument]);

  useEffect(
    () => () => {
      previewAbortRef.current?.abort();
      if (previewDocumentRef.current?.url) {
        URL.revokeObjectURL(previewDocumentRef.current.url);
      }
      previewDocumentRef.current = null;
    },
    []
  );

  useEffect(() => {
    if (previewDocumentRef.current?.requestKey === previewRequestKey) return undefined;
    let disposed = false;
    const controller = new AbortController();
    if (previewDocumentRef.current?.requestKey !== previewRequestKey) {
      replacePreviewDocument(null);
    }
    setPreviewState({ requestKey: previewRequestKey, loading: true, error: null });
    const timer = window.setTimeout(async () => {
      previewAbortRef.current?.abort();
      previewAbortRef.current = controller;
      try {
        const response = await fetch('/api/admin/order-document-templates/preview', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: previewRequestBody,
          signal: controller.signal
        });
        if (!response.ok) {
          const payload = await response.json().catch(() => null);
          throw new Error(messageFromPayload(payload, 'Predogleda PDF ni bilo mogoče ustvariti.'));
        }
        const payload = await response.json();
        const rendered = await renderOrderDocumentPreview(payload, controller.signal);
        if (disposed) { URL.revokeObjectURL(rendered.url); return; }
        replacePreviewDocument({ requestKey: previewRequestKey, ...rendered });
        setPreviewState({ requestKey: previewRequestKey, loading: false, error: null });
      } catch (error) {
        if (disposed || controller.signal.aborted) return;
        setPreviewState({
          requestKey: previewRequestKey,
          loading: false,
          error: error instanceof Error ? error.message : 'Predogleda PDF ni bilo mogoče ustvariti.'
        });
      } finally {
        if (previewAbortRef.current === controller) previewAbortRef.current = null;
      }
    }, 450);
    return () => {
      disposed = true;
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [previewRequestBody, previewRequestKey, replacePreviewDocument]);

  useEffect(() => {
    if (!dirty) return;
    const warnBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', warnBeforeUnload);
    return () => window.removeEventListener('beforeunload', warnBeforeUnload);
  }, [dirty]);

  const updateCurrentTemplate = useCallback(
    (updater: (template: OrderDocumentTemplate) => OrderDocumentTemplate) => {
      setDraft((previous) => ({
        ...previous,
        templates: {
          ...previous.templates,
          [selectedType]: updater(previous.templates[selectedType])
        }
      }));
      setActionError(null);
    },
    [selectedType]
  );

  const resetSelectedTemplate = () => {
    updateCurrentTemplate(() => cloneDefaultOrderDocumentTemplate(selectedType));
    toast.info(`${TEMPLATE_META[selectedType].label} je ponastavljena. Spremembo še shranite.`);
  };

  const saveConfig = async () => {
    if (saving || !dirty) return;
    setSaving(true);
    setActionError(null);
    const submittedConfig = clone(draft);
    const submittedTemplatesJson = JSON.stringify(submittedConfig.templates);
    const submittedLogoConfig = toStoredSiteLogoConfig(logoConfig);
    const submittedLogoJson = JSON.stringify(submittedLogoConfig);
    try {
      const requests: Array<Promise<
        | { kind: 'templates'; config: OrderDocumentTemplatesConfig }
        | { kind: 'logo'; config: SiteLogoConfig }
      >> = [];

      if (templateDirty) {
        requests.push((async () => {
          const response = await fetch('/api/admin/order-document-templates', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(submittedConfig)
          });
          const payload = (await response.json().catch(() => null)) as unknown;
          if (!response.ok) {
            throw new Error(messageFromPayload(payload, 'Predlog PDF ni bilo mogoče shraniti.'));
          }
          const returnedConfig = isRecord(payload) && 'config' in payload ? payload.config : payload;
          return {
            kind: 'templates' as const,
            config: normalizeOrderDocumentTemplatesConfig(
              isRecord(returnedConfig) ? returnedConfig : submittedConfig
            )
          };
        })());
      }

      if (logoDirty) {
        requests.push((async () => {
          const response = await fetch('/api/admin/site-logo', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ config: submittedLogoConfig })
          });
          const payload = (await response.json().catch(() => null)) as unknown;
          if (!response.ok) {
            throw new Error(messageFromPayload(payload, 'Nastavitev logotipa ni bilo mogoče shraniti.'));
          }
          const returnedConfig = isRecord(payload) && 'config' in payload ? payload.config : payload;
          return {
            kind: 'logo' as const,
            config: normalizeSiteLogoConfig(
              isRecord(returnedConfig) ? returnedConfig : submittedLogoConfig
            )
          };
        })());
      }

      const results = await Promise.allSettled(requests);
      for (const result of results) {
        if (result.status !== 'fulfilled') continue;
        if (result.value.kind === 'templates') {
          const nextSaved = result.value.config;
          setSavedConfig(clone(nextSaved));
          setDraft((currentDraft) =>
            JSON.stringify(currentDraft.templates) === submittedTemplatesJson
              ? clone(nextSaved)
              : currentDraft
          );
        } else {
          const nextSaved = result.value.config;
          setSavedLogoConfig(clone(nextSaved));
          setLogoConfig((currentLogoConfig) =>
            JSON.stringify(toStoredSiteLogoConfig(currentLogoConfig)) === submittedLogoJson
              ? clone(nextSaved)
              : currentLogoConfig
          );
        }
      }

      const failed = results.find(
        (result): result is PromiseRejectedResult => result.status === 'rejected'
      );
      if (failed) throw failed.reason;

      toast.success(
        templateDirty && logoDirty
          ? 'Predloge PDF in logotip so shranjeni.'
          : logoDirty
            ? 'Nastavitve logotipa za PDF so shranjene.'
            : 'Predloge PDF so shranjene.'
      );
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Sprememb ni bilo mogoče shraniti.';
      setActionError(message);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="min-w-0 font-['Inter',system-ui,sans-serif]"
      data-testid="order-document-template-editor"
    >
      <AdminPageHeader
        title="Predloge PDF"
        description="Izberite element neposredno na strani, ga povlecite ali povečajte ter uredite vsebino, videz in logiko v kontekstnem inšpektorju."
        actions={
          <div className="flex flex-wrap items-center justify-end gap-2">
            <span
              className={`inline-flex h-8 items-center rounded-full border px-3 text-xs font-semibold ${
                dirty
                  ? 'border-amber-200 bg-amber-50 text-amber-800'
                  : 'border-emerald-200 bg-emerald-50 text-emerald-700'
              }`}
              role="status"
              data-testid="order-document-template-dirty-state"
            >
              {dirty ? 'Neshranjene spremembe' : savedAt ? `Shranjeno ${savedAt}` : 'Vse shranjeno'}
            </span>
            <Button type="button" variant="outline" disabled={saving} data-testid="order-document-template-arrange" onClick={() => updateCurrentTemplate(arrangeOrderDocumentTemplate)}>
              Uredi razmike
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={resetSelectedTemplate}
              disabled={saving}
              data-testid="order-document-template-reset"
            >
              Ponastavi predlogo
            </Button>
            <Button
              type="button"
              variant="primary"
              onClick={() => void saveConfig()}
              disabled={saving || !dirty}
              data-testid="order-document-template-save"
            >
              {saving ? <Spinner /> : null}
              {saving ? 'Shranjujem …' : 'Shrani spremembe'}
            </Button>
          </div>
        }
      />

      <div
        role="tablist"
        aria-label="Vrsta predloge PDF"
        className="mb-4 grid gap-2 rounded-xl border border-slate-200 bg-white p-2 shadow-sm sm:grid-cols-2 xl:grid-cols-5"
      >
        {availableTemplateTypes.map((type) => {
          const active = type === selectedType;
          return (
            <button
              key={type}
              id={`order-document-template-tab-${type}`}
              type="button"
              role="tab"
              aria-selected={active}
              aria-controls="order-document-template-panel"
              tabIndex={active ? 0 : -1}
              className={`rounded-lg border px-4 py-3 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 ${
                active
                  ? 'border-[color:var(--blue-500)] bg-blue-50 text-blue-900'
                  : 'border-transparent text-slate-600 hover:border-slate-200 hover:bg-slate-50'
              }`}
              onClick={() => {
                if (type !== selectedType) resetPreviewSession();
                setSelectedType(type);
                setActionError(null);
              }}
              data-testid={`order-document-template-tab-${type}`}
            >
              <span className="block text-sm font-semibold">{TEMPLATE_META[type].label}</span>
              <span className="mt-1 block text-xs leading-4 opacity-80">
                {TEMPLATE_META[type].description}
              </span>
            </button>
          );
        })}
      </div>

      {actionError ? (
        <div
          role="alert"
          className="mb-4 flex items-start justify-between gap-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800"
          data-testid="order-document-template-save-error"
        >
          <span>{actionError}</span>
          <button
            type="button"
            className="shrink-0 text-lg leading-none text-rose-500 hover:text-rose-700"
            onClick={() => setActionError(null)}
            aria-label="Zapri sporočilo o napaki"
          >
            ×
          </button>
        </div>
      ) : null}

      <div
        id="order-document-template-panel"
        role="tabpanel"
        aria-labelledby={`order-document-template-tab-${selectedType}`}
        tabIndex={0}
        className="min-w-0"
      >
        <div className="mb-3 flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-sm">
          <div className="inline-flex rounded-lg bg-slate-100 p-1" role="group" aria-label="Način predogleda">
            <button
              type="button"
              aria-pressed={viewMode === 'canvas'}
              onClick={() => setViewMode('canvas')}
              className={`inline-flex h-8 items-center gap-2 rounded-md px-3 text-xs font-semibold ${
                viewMode === 'canvas' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-500'
              }`}
              data-testid="order-document-template-canvas-mode"
            >
              <FilePenLine className="h-4 w-4" /> Interaktivni urejevalnik
            </button>
            <button
              type="button"
              aria-pressed={viewMode === 'pdf'}
              onClick={() => setViewMode('pdf')}
              className={`inline-flex h-8 items-center gap-2 rounded-md px-3 text-xs font-semibold ${
                viewMode === 'pdf' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-500'
              }`}
              data-testid="order-document-template-pdf-mode"
            >
              <FileText className="h-4 w-4" /> Predogled PDFja
            </button>
          </div>
          <p className="hidden text-xs text-slate-500 md:block">
            {viewMode === 'canvas'
              ? 'Urejate isti PDF, ki ga prikaže predogled.'
              : 'Isti dokument, brez oznak urejevalnika.'}
          </p>
        </div>

        {viewMode === 'canvas' ? (
          <OrderDocumentTemplateCanvas
            key={selectedType}
            template={currentTemplate}
            preview={activePreviewDocument}
            previewLoading={activePreviewState.loading}
            previewError={activePreviewState.error}
            onRefreshPreview={() => setPreviewNonce((value) => value + 1)}
            logoConfig={logoConfig}
            onChange={(template) => updateCurrentTemplate(() => template)}
            onLogoConfigChange={(nextLogoConfig) => {
              setLogoConfig(normalizeSiteLogoConfig(nextLogoConfig));
              setActionError(null);
            }}
          />
        ) : (
          <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm" aria-label="Predogled PDFja">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
              <div>
                <h2 className="text-sm font-semibold text-slate-900">Predogled PDFja</h2>
                <p className="mt-0.5 text-xs text-slate-500">{currentTemplate.name}</p>
              </div>
              <div className="flex items-center gap-2">
                <span
                  className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium ${
                    activePreviewState.error
                      ? 'bg-rose-50 text-rose-700'
                      : activePreviewState.loading
                        ? 'bg-blue-50 text-blue-700'
                        : 'bg-emerald-50 text-emerald-700'
                  }`}
                  role="status"
                  data-testid="order-document-template-preview-state"
                >
                  {activePreviewState.loading ? <Spinner /> : null}
                  {activePreviewState.error
                    ? 'Napaka predogleda'
                    : activePreviewState.loading
                      ? 'Osvežujem …'
                      : 'Predogled je posodobljen'}
                </span>
                {activePreviewDocument ? <a href={activePreviewDocument.url} download={`predogled-${selectedType}.pdf`} className="text-xs font-semibold text-blue-700 underline">Prenesi PDF</a> : null}
                <button
                  type="button"
                  className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-2.5 text-xs text-slate-700 hover:bg-slate-50"
                  onClick={() => setPreviewNonce((value) => value + 1)}
                  disabled={activePreviewState.loading}
                  data-testid="order-document-template-preview-refresh"
                >
                  <RefreshCw className="h-3.5 w-3.5" /> Osveži
                </button>
              </div>
            </div>
            <div className="relative min-h-[700px] bg-slate-200 p-3" aria-busy={activePreviewState.loading}>
              {activePreviewDocument ? (
                <div data-testid="order-document-template-preview" className="mx-auto max-w-[760px] space-y-4" aria-label={`Predogled PDFja – ${currentTemplate.name}`}>
                  {activePreviewDocument.pages.map((src, index) => (
                    // The pixels are rendered locally from our authenticated PDF response.
                    // eslint-disable-next-line @next/next/no-img-element
                    <img key={index} src={src} alt={`Stran ${index + 1} – ${currentTemplate.name}`} data-order-document-pdf-page={index + 1} className="block h-auto w-full bg-white shadow-lg" />
                  ))}
                </div>
              ) : (
                <div className="flex min-h-[680px] items-center justify-center rounded-md border border-dashed border-slate-300 bg-white text-center">
                  <div>
                    {activePreviewState.loading ? <span className="mx-auto mb-3 block h-7 w-7 animate-spin rounded-full border-2 border-blue-600 border-r-transparent" /> : null}
                    <p className="text-sm font-medium text-slate-700">
                      {activePreviewState.loading ? 'Pripravljam predogled PDF …' : 'Predogled ni na voljo.'}
                    </p>
                  </div>
                </div>
              )}
              {activePreviewState.error ? (
                <div
                  role="alert"
                  className="absolute inset-x-6 top-6 rounded-lg border border-rose-200 bg-white/95 px-4 py-3 text-sm text-rose-800 shadow-lg backdrop-blur"
                  data-testid="order-document-template-preview-error"
                >
                  <p className="font-semibold">Predogleda ni bilo mogoče posodobiti.</p>
                  <p className="mt-1 text-xs leading-5">{activePreviewState.error}</p>
                </div>
              ) : null}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
