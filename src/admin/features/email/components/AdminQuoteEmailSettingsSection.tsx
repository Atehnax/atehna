'use client';

import { useMemo, useState } from 'react';
import {
  cloneDefaultQuoteEmailSettings,
  normalizeQuoteEmailSettings,
  QUOTE_EMAIL_EDITABLE_EVENT_DEFINITIONS,
  QUOTE_EMAIL_TEMPLATE_BODY_MAX_LENGTH,
  QUOTE_EMAIL_TEMPLATE_SUBJECT_MAX_LENGTH,
  quoteEmailEventSupportsAdminAudience,
  type QuoteEmailEventType,
  type QuoteEmailSettings
} from '@/shared/domain/quote/quoteEmailSettings';
import type { QuoteEmailAdminState } from '@/shared/server/quoteEmailSettings';
import { AdminSwitch } from '@/shared/ui/admin-switch';
import { useToast } from '@/shared/ui/toast';

const inputClass =
  'h-8 w-full rounded-md border border-slate-300 bg-white px-2.5 text-[12px] text-slate-900 outline-none transition focus:border-[color:var(--blue-500)] focus:ring-0 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500';
const textareaClass =
  'min-h-24 w-full resize-y rounded-md border border-slate-300 bg-white px-2.5 py-2 text-[12px] leading-5 text-slate-900 outline-none transition focus:border-[color:var(--blue-500)] focus:ring-0 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500';

type EditableEvent = (typeof QUOTE_EMAIL_EDITABLE_EVENT_DEFINITIONS)[number]['value'];

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

export default function AdminQuoteEmailSettingsSection({
  initialState
}: {
  initialState: QuoteEmailAdminState;
}) {
  const { toast } = useToast();
  const [state, setState] = useState(initialState);
  const [draft, setDraft] = useState(() =>
    normalizeQuoteEmailSettings(initialState.config)
  );
  const [selectedEvent, setSelectedEvent] =
    useState<EditableEvent>('quote_request_submitted');
  const [saving, setSaving] = useState(false);
  const [retryingJobId, setRetryingJobId] = useState<string | null>(null);
  const hasChanges = useMemo(
    () => comparable(draft) !== comparable(state.config),
    [draft, state.config]
  );
  const selectedDefinition = QUOTE_EMAIL_EDITABLE_EVENT_DEFINITIONS.find(
    (definition) => definition.value === selectedEvent
  )!;
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

  const save = async () => {
    if (saving || !hasChanges || mutationsDisabled) return;
    setSaving(true);
    try {
      const response = await fetch('/api/admin/quote-email-settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ config: draft })
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
      setDraft(normalizeQuoteEmailSettings(payload.state.config));
      toast.success('Nastavitve e-pošte za ponudbe so shranjene.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Nastavitev ni mogoče shraniti.');
    } finally {
      setSaving(false);
    }
  };

  const retry = async (jobId: string) => {
    if (retryingJobId || mutationsDisabled) return;
    setRetryingJobId(jobId);
    try {
      const response = await fetch(`/api/admin/quote-email-jobs/${jobId}/retry`, {
        method: 'POST'
      });
      const payload = await response.json().catch(() => ({})) as { message?: string };
      if (!response.ok) throw new Error(payload.message || 'Ponovitev ni uspela.');
      setState((current) => ({
        ...current,
        queue: {
          ...current.queue,
          pending: current.queue.pending + 1,
          failed: Math.max(0, current.queue.failed - 1),
          recentFailures: current.queue.recentFailures.filter((job) => job.id !== jobId)
        }
      }));
      toast.success(payload.message || 'E-pošta je znova v čakalni vrsti.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Ponovitev ni uspela.');
    } finally {
      setRetryingJobId(null);
    }
  };

  return (
    <section className="space-y-4" aria-labelledby="quote-email-heading" data-testid="quote-email-settings-section">
      <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h2 id="quote-email-heading" className="text-base font-semibold text-slate-950">Ponudbe</h2>
          <p className="mt-1 max-w-3xl text-[12px] leading-5 text-slate-600">
            Uporablja isti profil pošiljatelja, Reply-To, ponudnika in administratorske prejemnike kot naročila. Tukaj so ločeni samo dogodki, predloge in čakalna vrsta ponudb.
          </p>
          <p className="mt-1.5 text-[10px] font-medium text-slate-500">
            Zastavici: admin {state.flags.admin ? 'vključen' : 'izključen'} · dostava e-pošte {state.flags.emailDelivery ? 'vključena' : 'izključena'}
          </p>
        </div>
        <div className="flex shrink-0 items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50/70 px-3 py-2 sm:justify-start">
          <span className="text-[11px] font-semibold text-slate-700">Samodejna e-pošta ponudb</span>
          <AdminSwitch
            checked={draft.enabled}
            disabled={mutationsDisabled}
            ariaLabel="Vključi samodejno e-pošto za ponudbe"
            onChange={(enabled) => setDraft((current) => ({ ...current, enabled }))}
          />
        </div>
      </div>

      {!state.schemaReady ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-[12px] text-rose-800">
          Podatkovna shema e-pošte za ponudbe ni nameščena.
        </div>
      ) : null}

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm" data-testid="quote-email-editor-card">
        <section aria-labelledby="quote-email-events-heading">
          <div className="border-b border-slate-200 bg-slate-50/60 px-4 py-3">
            <h3 id="quote-email-events-heading" className="text-sm font-semibold text-slate-950">Dogodki ponudbe</h3>
            <p className="mt-0.5 text-[10px] leading-4 text-slate-500">Izberite prejemnike in dogodek, katerega predlogo urejate.</p>
          </div>
          <div className="grid gap-2 p-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4" data-testid="quote-email-event-grid">
            {QUOTE_EMAIL_EDITABLE_EVENT_DEFINITIONS.map((definition) => {
              const event = draft.events[definition.value];
              const selected = selectedEvent === definition.value;
              const supportsAdmin = quoteEmailEventSupportsAdminAudience(
                definition.value
              );
              return (
                <article key={definition.value} className={`min-w-0 rounded-lg border px-3 py-2.5 ${selected ? 'border-blue-200 bg-blue-50/40' : 'border-slate-200 bg-slate-50/60'}`}>
                  <div className="flex min-w-0 items-start justify-between gap-2">
                    <span className="min-w-0 text-[11px] font-semibold leading-4 text-slate-900">{definition.label}</span>
                    <button type="button" aria-label={`Uredi predlogo: ${definition.label}`} aria-pressed={selected} onClick={() => setSelectedEvent(definition.value)} className="h-6 shrink-0 rounded-md px-1.5 text-[10px] font-semibold text-[color:var(--blue-600)] hover:bg-white/80">Uredi</button>
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    <label className="flex h-7 items-center gap-2 rounded-md border border-slate-200 bg-white px-2 text-[10px] font-medium text-slate-600">
                      <input className="h-3.5 w-3.5 accent-[color:var(--blue-500)]" type="checkbox" checked={event.customer} disabled={mutationsDisabled || !supportsAdmin} onChange={(change) => updateEvent(definition.value, { customer: change.target.checked })} aria-label={`${definition.label}: stranka`} />
                      Stranka
                    </label>
                    <label className="flex h-7 items-center gap-2 rounded-md border border-slate-200 bg-white px-2 text-[10px] font-medium text-slate-600">
                      <input className="h-3.5 w-3.5 accent-[color:var(--blue-500)]" type="checkbox" checked={supportsAdmin && event.admins} disabled={mutationsDisabled || !supportsAdmin} onChange={(change) => updateEvent(definition.value, { admins: change.target.checked })} aria-label={`${definition.label}: admin`} />
                      {supportsAdmin ? 'Admin' : 'Samo stranka'}
                    </label>
                  </div>
                </article>
              );
            })}
          </div>
          <p className="px-4 pb-3 text-[10px] leading-4 text-slate-500">Varnostna OTP e-pošta ostane sistemska in ni izpostavljena kot poslovna predloga.</p>
        </section>

        <section aria-labelledby="quote-email-template-heading" className="border-t border-slate-200">
          <div className="flex flex-col gap-2 border-b border-slate-200 bg-slate-50/60 px-4 py-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <h3 id="quote-email-template-heading" className="text-sm font-semibold text-slate-950">Predloga: {selectedDefinition.label}</h3>
              <p className="mt-0.5 text-[10px] leading-4 text-slate-500">Dovoljeni spremenljivki: <code>{'{{request_number}}'}</code>, <code>{'{{offer_number}}'}</code>.</p>
            </div>
            <button type="button" onClick={() => {
              const defaults = cloneDefaultQuoteEmailSettings().templates[selectedEvent];
              setDraft((current) => ({ ...current, templates: { ...current.templates, [selectedEvent]: defaults } }));
            }} className="h-8 shrink-0 rounded-md border border-slate-300 bg-white px-2.5 text-[11px] font-semibold text-slate-700 hover:bg-slate-50">Ponastavi predlogo</button>
          </div>
          <div className="grid gap-3 p-3 lg:grid-cols-2" data-testid="quote-email-template-grid">
            {(['customer', 'admin'] as const)
              .filter((audience) =>
                audience === 'customer' ||
                quoteEmailEventSupportsAdminAudience(selectedEvent)
              )
              .map((audience) => {
              const template = draft.templates[selectedEvent][audience];
              return (
                <section key={audience} className={`grid min-w-0 gap-2.5 rounded-lg border border-slate-200 bg-slate-50/60 p-3 ${quoteEmailEventSupportsAdminAudience(selectedEvent) ? '' : 'lg:col-span-2'}`}>
                  <h4 className="text-[11px] font-semibold text-slate-900">{audience === 'customer' ? 'Stranka' : 'Administrator'}</h4>
                  <label className="grid gap-1 text-[11px] font-semibold text-slate-600">Zadeva<input className={inputClass} disabled={mutationsDisabled} maxLength={QUOTE_EMAIL_TEMPLATE_SUBJECT_MAX_LENGTH} value={template.subject} onChange={(event) => updateTemplate(audience, 'subject', event.target.value)} /></label>
                  <label className="grid gap-1 text-[11px] font-semibold text-slate-600">Vsebina<textarea className={textareaClass} disabled={mutationsDisabled} maxLength={QUOTE_EMAIL_TEMPLATE_BODY_MAX_LENGTH} value={template.body} onChange={(event) => updateTemplate(audience, 'body', event.target.value)} /></label>
                </section>
              );
              })}
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 px-4 py-3">
            <span className="text-[10px] text-slate-500">Nazadnje shranjeno: {formatDate(state.config.updatedAt)}</span>
            <button type="button" onClick={() => void save()} disabled={!hasChanges || saving || mutationsDisabled} className="h-8 rounded-md bg-[color:var(--blue-600)] px-3 text-[11px] font-semibold text-white disabled:opacity-50">{saving ? 'Shranjujem…' : 'Shrani ponudbe'}</button>
          </div>
        </section>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm" data-testid="quote-email-queue-card">
        <div className="border-b border-slate-200 bg-slate-50/60 px-4 py-3">
          <h3 className="text-sm font-semibold text-slate-950">Čakalna vrsta ponudb</h3>
        </div>
        <div className="grid grid-cols-2 gap-2 p-3 sm:grid-cols-4" data-testid="quote-email-queue-grid">
          {([['Čaka', state.queue.pending], ['Obdelava', state.queue.processing], ['Poslano', state.queue.sent], ['Napake', state.queue.failed]] as const).map(([label, value]) => <div key={label} className="rounded-lg border border-slate-200 bg-slate-50/60 px-3 py-2.5"><div className="text-base font-semibold tabular-nums text-slate-900">{value}</div><div className="text-[10px] text-slate-500">{label}</div></div>)}
        </div>
        <div className="space-y-2 border-t border-slate-200 px-3 py-3">
          {state.queue.recentFailures.map((failure) => (
            <article key={failure.id} className="flex flex-wrap items-start justify-between gap-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2.5">
              <div className="min-w-0"><p className="text-[11px] font-semibold text-rose-900">{failure.eventType} · {failure.audience}</p><p className="mt-0.5 break-words text-[10px] leading-4 text-rose-800">{failure.recipientEmail} · poskusi {failure.attempts} · {formatDate(failure.updatedAt)}</p>{failure.lastError ? <p className="mt-0.5 text-[10px] leading-4 text-rose-700">{failure.lastError}</p> : null}</div>
              <button type="button" onClick={() => void retry(failure.id)} disabled={Boolean(retryingJobId) || mutationsDisabled} className="h-8 rounded-md border border-rose-300 bg-white px-2.5 text-[10px] font-semibold text-rose-700 disabled:opacity-50">Ponovi</button>
            </article>
          ))}
          {state.queue.recentFailures.length === 0 ? <p className="text-[11px] text-slate-500">Ni neuspešnih opravil ponudb.</p> : null}
        </div>
      </div>
    </section>
  );
}
