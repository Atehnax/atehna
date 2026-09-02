'use client';

import Link from 'next/link';
import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Button } from '@/shared/ui/button';
import { adminTableNeutralIconButtonClassName } from '@/shared/ui/admin-table';
import { IconButton } from '@/shared/ui/icon-button';
import { AUDIT_ENTITY_LABELS } from '@/shared/audit/auditLabels';
import { groupAuditEvents, type AuditEventGroup } from '@/shared/audit/auditPresentation';
import type { AuditEntityType, AuditEventListResult, AuditEventRecord } from '@/shared/audit/auditTypes';

const dateFormatter = new Intl.DateTimeFormat('sl-SI', {
  dateStyle: 'medium',
  timeStyle: 'short',
  timeZone: 'Europe/Ljubljana'
});

export type AuditWorkflowEvent = {
  id: string | number;
  eventType: string;
  actorType: string;
  actorId?: string | null;
  occurredAt: string;
  reason?: string | null;
  metadata?: Record<string, unknown> | null;
};

const focusableSelector = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])'
].join(',');

function formatTimestamp(value: string) {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : dateFormatter.format(parsed);
}

function changeCountLabel(count: number) {
  if (count === 1) return '1 sprememba';
  if (count === 2) return '2 spremembi';
  return String(count) + ' sprememb';
}

function groupActor(group: AuditEventGroup) {
  return group.actorName || group.actorId || 'Sistem';
}

function workflowActor(event: AuditWorkflowEvent) {
  const actorTypeLabel: Record<string, string> = {
    admin: 'Administrator',
    customer: 'Stranka',
    system: 'Sistem'
  };
  const actorType = actorTypeLabel[event.actorType] ?? event.actorType ?? 'Sistem';
  return event.actorId ? actorType + ' ' + event.actorId : actorType;
}

function formatWorkflowEventType(value: string) {
  const normalized = value
    .replace(/_/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .trim();
  return normalized
    ? normalized.charAt(0).toUpperCase() + normalized.slice(1)
    : 'Dogodek';
}

function formatMetadataKey(value: string) {
  return formatWorkflowEventType(value);
}

function formatMetadataValue(value: unknown) {
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value === 'boolean') return value ? 'Da' : 'Ne';
  if (typeof value === 'string' || typeof value === 'number') return String(value);
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function classNames(...parts: Array<string | null | undefined | false>) {
  return parts.filter(Boolean).join(' ');
}

function HistoryIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
      <path d="M3 3v5h5" />
      <path d="M12 7v5l4 2" />
    </svg>
  );
}

export default function AuditHistoryDrawer({
  entityType,
  entityId,
  entityLabel,
  buttonClassName,
  triggerLabel,
  workflowEvents = [],
  workflowEventsUrl,
  workflowEventLabels,
  workflowHeading = 'Potek',
  loadAuditEvents = true,
  open: controlledOpen,
  onOpenChange,
  hideTrigger = false
}: {
  entityType: AuditEntityType;
  entityId?: string | number | null;
  entityLabel?: string | null;
  buttonClassName?: string;
  triggerLabel?: string;
  workflowEvents?: readonly AuditWorkflowEvent[];
  workflowEventsUrl?: string;
  workflowEventLabels?: Readonly<Record<string, string>>;
  workflowHeading?: string;
  loadAuditEvents?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  hideTrigger?: boolean;
}) {
  const [internalOpen, setInternalOpen] = useState(false);
  const [events, setEvents] = useState<AuditEventRecord[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditError, setAuditError] = useState<string | null>(null);
  const [loadedWorkflowEvents, setLoadedWorkflowEvents] = useState<AuditWorkflowEvent[] | null>(null);
  const [workflowLoading, setWorkflowLoading] = useState(false);
  const [workflowError, setWorkflowError] = useState<string | null>(null);
  const dialogId = useId();
  const titleId = useId();
  const descriptionId = useId();
  const workflowTitleId = useId();
  const dialogRef = useRef<HTMLElement | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(null);
  const normalizedEntityId = entityId === null || entityId === undefined ? '' : String(entityId);
  const entityDisplayLabel = entityLabel || AUDIT_ENTITY_LABELS[entityType];
  const groups = useMemo(() => groupAuditEvents(events), [events]);
  const visibleWorkflowEvents = workflowEventsUrl
    ? loadedWorkflowEvents ?? []
    : workflowEvents;
  const loading = auditLoading || workflowLoading;
  const error = auditError ?? workflowError;
  const open = controlledOpen ?? internalOpen;
  const setOpen = useCallback((nextOpen: boolean) => {
    if (controlledOpen === undefined) setInternalOpen(nextOpen);
    onOpenChange?.(nextOpen);
  }, [controlledOpen, onOpenChange]);

  const fullHref = useMemo(() => {
    const params = new URLSearchParams({ entity_type: entityType });
    if (normalizedEntityId) params.set('entity_id', normalizedEntityId);
    return '/admin/dnevnik?' + params.toString();
  }, [entityType, normalizedEntityId]);

  useEffect(() => {
    if (!open) return;
    setExpandedId(null);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    setEvents([]);
    setAuditError(null);
    if (!loadAuditEvents) {
      setAuditLoading(false);
      return;
    }

    const controller = new AbortController();
    const params = new URLSearchParams({
      entity_type: entityType,
      page_size: normalizedEntityId ? 'all' : '100'
    });
    if (normalizedEntityId) params.set('entity_id', normalizedEntityId);
    setAuditLoading(true);
    fetch('/api/admin/audit-events?' + params.toString(), {
      cache: 'no-store',
      signal: controller.signal
    })
      .then(async (response) => {
        const payload = (await response.json().catch(() => ({}))) as AuditEventListResult & {
          message?: string;
        };
        if (!response.ok) {
          throw new Error(payload.message || 'Dnevnika sprememb ni bilo mogoče naložiti.');
        }
        if (payload.warning) throw new Error(payload.warning);
        setEvents(payload.events ?? []);
      })
      .catch((loadError) => {
        if (controller.signal.aborted) return;
        setEvents([]);
        setAuditError(
          loadError instanceof Error
            ? loadError.message
            : 'Dnevnika sprememb ni bilo mogoče naložiti.'
        );
      })
      .finally(() => {
        if (!controller.signal.aborted) setAuditLoading(false);
      });
    return () => controller.abort();
  }, [entityType, loadAuditEvents, normalizedEntityId, open]);

  useEffect(() => {
    if (!open) return;
    setWorkflowError(null);
    if (!workflowEventsUrl) {
      setLoadedWorkflowEvents(null);
      setWorkflowLoading(false);
      return;
    }

    const controller = new AbortController();
    setLoadedWorkflowEvents([]);
    setWorkflowLoading(true);
    fetch(workflowEventsUrl, { cache: 'no-store', signal: controller.signal })
      .then(async (response) => {
        const payload = (await response.json().catch(() => ({}))) as {
          events?: AuditWorkflowEvent[];
          message?: string;
          warning?: string;
        };
        if (!response.ok) {
          throw new Error(payload.message || 'Celotnega poteka ni bilo mogoče naložiti.');
        }
        if (payload.warning) throw new Error(payload.warning);
        setLoadedWorkflowEvents(Array.isArray(payload.events) ? payload.events : []);
      })
      .catch((loadError) => {
        if (controller.signal.aborted) return;
        setLoadedWorkflowEvents([]);
        setWorkflowError(
          loadError instanceof Error
            ? loadError.message
            : 'Celotnega poteka ni bilo mogoče naložiti.'
        );
      })
      .finally(() => {
        if (!controller.signal.aborted) setWorkflowLoading(false);
      });
    return () => controller.abort();
  }, [open, workflowEventsUrl]);

  useEffect(() => {
    if (!open) return;

    restoreFocusRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousBodyOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const focusFrame = window.requestAnimationFrame(() => {
      closeButtonRef.current?.focus();
    });

    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        setOpen(false);
        return;
      }
      if (event.key !== 'Tab') return;

      const dialog = dialogRef.current;
      if (!dialog) return;
      const focusableElements = Array.from(
        dialog.querySelectorAll<HTMLElement>(focusableSelector)
      );
      if (focusableElements.length === 0) {
        event.preventDefault();
        dialog.focus();
        return;
      }

      const first = focusableElements[0];
      const last = focusableElements[focusableElements.length - 1];
      const activeElement = document.activeElement;
      if (event.shiftKey && (activeElement === first || !dialog.contains(activeElement))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (activeElement === last || !dialog.contains(activeElement))) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => {
      window.cancelAnimationFrame(focusFrame);
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousBodyOverflow;
      const restoreTarget = restoreFocusRef.current;
      if (restoreTarget && document.contains(restoreTarget)) restoreTarget.focus();
      restoreFocusRef.current = null;
    };
  }, [open, setOpen]);

  const triggerAriaLabel = 'Odpri dnevnik sprememb za ' + entityDisplayLabel;

  return (
    <>
      {!hideTrigger ? (
        triggerLabel ? (
          <Button
            type="button"
            variant="default"
            size="toolbar"
            className={classNames(
              '!h-8 !gap-1.5 !rounded-md !border-slate-300 !bg-white !px-2 !text-[12px] !font-semibold !text-slate-700 hover:!bg-[color:var(--hover-neutral)] sm:!px-2.5',
              buttonClassName
            )}
            aria-label={triggerAriaLabel}
            aria-haspopup="dialog"
            aria-expanded={open}
            aria-controls={dialogId}
            title="Dnevnik sprememb"
            onClick={() => setOpen(true)}
          >
            <HistoryIcon className="h-4 w-4" />
            <span className="hidden sm:inline">{triggerLabel}</span>
          </Button>
        ) : (
          <IconButton
            type="button"
            tone="neutral"
            size="sm"
            className={classNames(
              adminTableNeutralIconButtonClassName,
              '!h-9 !w-9 !p-0',
              buttonClassName
            )}
            aria-label={triggerAriaLabel}
            aria-haspopup="dialog"
            aria-expanded={open}
            aria-controls={dialogId}
            title="Dnevnik sprememb"
            onClick={() => setOpen(true)}
          >
            <HistoryIcon className="h-[18px] w-[18px]" />
          </IconButton>
        )
      ) : null}

      {open && typeof document !== 'undefined' ? createPortal(
        <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/30 font-['Inter',system-ui,sans-serif]">
          <button
            type="button"
            tabIndex={-1}
            aria-label="Zapri dnevnik sprememb"
            className="absolute inset-0 cursor-default"
            onClick={() => setOpen(false)}
          />
          <aside
            ref={dialogRef}
            id={dialogId}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            aria-describedby={descriptionId}
            tabIndex={-1}
            className="relative h-full w-full max-w-xl overflow-y-auto border-l border-slate-200 bg-white p-5 shadow-2xl"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 id={titleId} className="text-lg font-semibold text-slate-900">
                  Dnevnik sprememb
                </h2>
                <p id={descriptionId} className="mt-1 text-[12px] text-slate-500">
                  Celotna shranjena zgodovina · {entityDisplayLabel}
                </p>
              </div>
              <button
                ref={closeButtonRef}
                type="button"
                className="rounded-md px-2 py-1 text-[12px] font-semibold text-slate-500 hover:bg-[color:var(--hover-neutral)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--blue-500)]"
                onClick={() => setOpen(false)}
              >
                Zapri
              </button>
            </div>

            {loadAuditEvents ? (
              <Link
                href={fullHref}
                className="mt-4 inline-flex text-[12px] font-semibold text-[color:var(--blue-500)] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--blue-500)]"
              >
                Odpri v dnevniku sprememb
              </Link>
            ) : null}

            {loading ? (
              <p role="status" aria-live="polite" className="mt-5 text-[13px] text-slate-500">
                Nalaganje celotnega dnevnika ...
              </p>
            ) : null}
            {error ? (
              <div role="alert" className="mt-5 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-[12px] text-rose-700">
                {error}
              </div>
            ) : null}
            {!loading && !error && groups.length === 0 && visibleWorkflowEvents.length === 0 ? (
              <p className="mt-5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-4 text-center text-[12px] text-slate-500">
                Ni najdenih sprememb.
              </p>
            ) : null}

            {!error && visibleWorkflowEvents.length > 0 ? (
              <section className="mt-5" aria-labelledby={workflowTitleId}>
                <div className="flex items-center justify-between gap-3">
                  <h3 id={workflowTitleId} className="text-[13px] font-semibold text-slate-900">
                    {workflowHeading}
                  </h3>
                  <span className="text-[11px] tabular-nums text-slate-400">
                    {visibleWorkflowEvents.length} zapisov
                  </span>
                </div>
                <ol className="mt-2 space-y-2">
                  {visibleWorkflowEvents.map((event, index) => {
                    const eventKey = 'workflow:' + String(event.id);
                    const expanded = expandedId === eventKey;
                    const detailsId = dialogId + '-workflow-' + String(index);
                    const metadataEntries = Object.entries(event.metadata ?? {});
                    const eventLabel =
                      workflowEventLabels?.[event.eventType] ??
                      formatWorkflowEventType(event.eventType);
                    return (
                      <li
                        key={eventKey}
                        className="rounded-lg border border-slate-200 bg-slate-50/70 p-3"
                      >
                        <button
                          type="button"
                          className="block w-full rounded-sm text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--blue-500)]"
                          aria-expanded={expanded}
                          aria-controls={detailsId}
                          onClick={() => setExpandedId(expanded ? null : eventKey)}
                        >
                          <span className="block text-[12px] font-semibold text-slate-900">
                            {eventLabel}
                          </span>
                          <span className="mt-1 block text-[11px] text-slate-500">
                            {formatTimestamp(event.occurredAt)} · {workflowActor(event)}
                          </span>
                        </button>
                        {expanded ? (
                          <div
                            id={detailsId}
                            className="mt-3 space-y-2 rounded-lg border border-slate-200 bg-white p-3 text-[11px]"
                          >
                            {event.reason ? (
                              <p className="break-words text-slate-600">
                                <span className="font-semibold text-slate-800">Razlog: </span>
                                {event.reason}
                              </p>
                            ) : null}
                            {metadataEntries.length > 0 ? (
                              <dl className="space-y-2">
                                {metadataEntries.map(([key, value]) => (
                                  <div
                                    key={key}
                                    className="grid grid-cols-[minmax(0,0.42fr)_minmax(0,0.58fr)] gap-3"
                                  >
                                    <dt className="break-words font-semibold text-slate-700">
                                      {formatMetadataKey(key)}
                                    </dt>
                                    <dd className="break-words text-slate-600">
                                      {formatMetadataValue(value)}
                                    </dd>
                                  </div>
                                ))}
                              </dl>
                            ) : event.reason ? null : (
                              <p className="text-slate-500">
                                Dogodek nima dodatnih podrobnosti.
                              </p>
                            )}
                          </div>
                        ) : null}
                      </li>
                    );
                  })}
                </ol>
              </section>
            ) : null}

            {!error && groups.length > 0 ? (
              <h3 className="mt-5 text-[13px] font-semibold text-slate-900">
                Spremembe podatkov
              </h3>
            ) : null}
            <ol className="mt-2 space-y-3" aria-label="Spremembe podatkov">
              {!error ? groups.map((group, index) => {
                const expanded = expandedId === group.id;
                const detailsId = dialogId + '-event-' + String(index);
                return (
                  <li key={group.id} className="rounded-lg border border-slate-200 bg-white p-3">
                    <button
                      type="button"
                      className="block w-full rounded-sm text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--blue-500)]"
                      aria-expanded={expanded}
                      aria-controls={detailsId}
                      onClick={() => setExpandedId(expanded ? null : group.id)}
                    >
                      <span className="block text-[12px] font-semibold text-slate-900">
                        {group.summary}
                      </span>
                      <span className="mt-1 block text-[11px] text-slate-500">
                        {formatTimestamp(group.occurredAt)} · {groupActor(group)} · {group.actionLabel}
                      </span>
                      {group.events.length > 1 ? (
                        <span className="mt-1 block text-[11px] text-slate-400">
                          {group.events.length} zapisov · {changeCountLabel(group.changes.length)}
                        </span>
                      ) : null}
                    </button>
                    {expanded ? (
                      <div id={detailsId} className="mt-3 overflow-hidden rounded-lg border border-slate-200">
                        <table className="w-full table-fixed text-[11px]">
                          <caption className="sr-only">
                            Podrobnosti spremembe {group.summary}
                          </caption>
                          <colgroup>
                            <col className="w-[40%]" />
                            <col className="w-[30%]" />
                            <col className="w-[30%]" />
                          </colgroup>
                          <thead className="bg-[color:var(--admin-table-header-bg)] text-slate-600">
                            <tr>
                              <th className="px-2 py-2 text-left font-semibold">Polje</th>
                              <th className="px-2 py-2 text-left font-semibold">Prej</th>
                              <th className="px-2 py-2 text-left font-semibold">Potem</th>
                            </tr>
                          </thead>
                          <tbody>
                            {group.changes.map((change) => (
                              <tr key={change.id} className="border-t border-slate-200 align-top">
                                <td className="break-words px-2 py-2 font-medium text-slate-900">
                                  {change.field}
                                </td>
                                <td className="break-words px-2 py-2 text-slate-600">
                                  {change.before}
                                </td>
                                <td className="break-words px-2 py-2 text-slate-600">
                                  {change.after}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : null}
                  </li>
                );
              }) : null}
            </ol>
          </aside>
        </div>,
        document.body
      ) : null}
    </>
  );
}
