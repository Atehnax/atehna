'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
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

function formatTimestamp(value: string) {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : dateFormatter.format(parsed);
}

function changeCountLabel(count: number) {
  if (count === 1) return '1 sprememba';
  if (count === 2) return '2 spremembi';
  return `${count} sprememb`;
}

function groupActor(group: AuditEventGroup) {
  return group.actorName || group.actorId || 'System';
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
  buttonClassName
}: {
  entityType: AuditEntityType;
  entityId?: string | number | null;
  entityLabel?: string | null;
  buttonClassName?: string;
}) {
  const [open, setOpen] = useState(false);
  const [events, setEvents] = useState<AuditEventRecord[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const normalizedEntityId = entityId === null || entityId === undefined ? '' : String(entityId);
  const groups = useMemo(() => groupAuditEvents(events), [events]);

  const fullHref = useMemo(() => {
    const params = new URLSearchParams({ entity_type: entityType });
    if (normalizedEntityId) params.set('entity_id', normalizedEntityId);
    return `/admin/dnevnik?${params.toString()}`;
  }, [entityType, normalizedEntityId]);

  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    const params = new URLSearchParams({ entity_type: entityType, page_size: '25' });
    if (normalizedEntityId) params.set('entity_id', normalizedEntityId);
    setLoading(true);
    setError(null);
    fetch(`/api/admin/audit-events?${params.toString()}`, { cache: 'no-store', signal: controller.signal })
      .then(async (response) => {
        const payload = (await response.json().catch(() => ({}))) as AuditEventListResult & { message?: string };
        if (!response.ok) throw new Error(payload.message || 'Zgodovine ni bilo mogoče naložiti.');
        setEvents(payload.events ?? []);
        setExpandedId(null);
      })
      .catch((loadError) => {
        if (controller.signal.aborted) return;
        setError(loadError instanceof Error ? loadError.message : 'Zgodovine ni bilo mogoče naložiti.');
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [entityType, normalizedEntityId, open]);

  return (
    <>
      <IconButton
        type="button"
        tone="neutral"
        size="sm"
        className={classNames(
          adminTableNeutralIconButtonClassName,
          '!h-9 !w-9 !p-0',
          buttonClassName
        )}
        aria-label="Odpri zgodovino"
        title="Zgodovina"
        onClick={() => setOpen(true)}
      >
        <HistoryIcon className="h-[18px] w-[18px]" />
      </IconButton>

      {open ? (
        <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/30 font-['Inter',system-ui,sans-serif]">
          <button type="button" aria-label="Zapri zgodovino" className="absolute inset-0 cursor-default" onClick={() => setOpen(false)} />
          <aside className="relative h-full w-full max-w-xl overflow-y-auto border-l border-slate-200 bg-white p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Zgodovina</h2>
                <p className="mt-1 text-[12px] text-slate-500">
                  {entityLabel || AUDIT_ENTITY_LABELS[entityType]}
                </p>
              </div>
              <button type="button" className="rounded-md px-2 py-1 text-[12px] font-semibold text-slate-500 hover:bg-[color:var(--hover-neutral)]" onClick={() => setOpen(false)}>
                Zapri
              </button>
            </div>

            <Link href={fullHref} className="mt-4 inline-flex text-[12px] font-semibold text-[color:var(--blue-500)] hover:underline">
              Odpri v dnevniku sprememb
            </Link>

            {loading ? <p className="mt-5 text-[13px] text-slate-500">Nalaganje zgodovine ...</p> : null}
            {error ? <div className="mt-5 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-[12px] text-rose-700">{error}</div> : null}
            {!loading && !error && groups.length === 0 ? (
              <p className="mt-5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-4 text-center text-[12px] text-slate-500">
                Ni najdenih sprememb.
              </p>
            ) : null}

            <ol className="mt-5 space-y-3">
              {groups.map((group) => {
                const expanded = expandedId === group.id;
                return (
                  <li key={group.id} className="rounded-lg border border-slate-200 bg-white p-3">
                    <button type="button" className="block w-full text-left" onClick={() => setExpandedId(expanded ? null : group.id)}>
                      <span className="block text-[12px] font-semibold text-slate-900">{group.summary}</span>
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
                      <div className="mt-3 overflow-hidden rounded-lg border border-slate-200">
                        <table className="w-full table-fixed text-[11px]">
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
                                <td className="break-words px-2 py-2 font-medium text-slate-900">{change.field}</td>
                                <td className="break-words px-2 py-2 text-slate-600">{change.before}</td>
                                <td className="break-words px-2 py-2 text-slate-600">{change.after}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : null}
                  </li>
                );
              })}
            </ol>
          </aside>
        </div>
      ) : null}
    </>
  );
}
