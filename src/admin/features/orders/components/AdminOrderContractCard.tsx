'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useToast } from '@/shared/ui/toast';
import type { OrderContractEvidence, OrderContractStatus } from '@/shared/domain/order/orderTypes';

const LABELS: Record<OrderContractStatus, string> = {
  pending_seller_acceptance: 'Čaka na sprejem prodajalca',
  accepted: 'Sprejeto',
  rejected: 'Zavrnjeno'
};

const formatDateTime = (value: string | null) => {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? '—'
    : new Intl.DateTimeFormat('sl-SI', { dateStyle: 'medium', timeStyle: 'short' }).format(date);
};

export default function AdminOrderContractCard({
  orderId,
  initialStatus,
  acceptedAt,
  acceptedActorType,
  acceptedActorId,
  acceptedEvidence,
  rejectedAt,
  rejectedActorType,
  rejectedActorId,
  rejectedEvidence,
  rejectedReason,
  committedAt,
  sourceQuoteRequestId,
  sourceQuoteRequestNumber,
  sourceQuoteOfferNumber
}: {
  orderId: number;
  initialStatus: OrderContractStatus;
  acceptedAt: string | null;
  acceptedActorType: string | null;
  acceptedActorId: string | null;
  acceptedEvidence: OrderContractEvidence | null;
  rejectedAt: string | null;
  rejectedActorType: string | null;
  rejectedActorId: string | null;
  rejectedEvidence: OrderContractEvidence | null;
  rejectedReason: string | null;
  committedAt: string | null;
  sourceQuoteRequestId: number | null;
  sourceQuoteRequestNumber: string | null;
  sourceQuoteOfferNumber: string | null;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [status, setStatus] = useState(initialStatus);
  const [reason, setReason] = useState(rejectedReason ?? '');
  const [busy, setBusy] = useState(false);
  const isQuoteDerived = sourceQuoteRequestId !== null;

  const updateContract = async (nextStatus: 'accepted' | 'rejected') => {
    if (busy || status !== 'pending_seller_acceptance' || isQuoteDerived) return;
    if (nextStatus === 'rejected' && !reason.trim()) {
      toast.error('Pred zavrnitvijo vnesite jasen razlog za stranko.');
      return;
    }
    const confirmed = window.confirm(
      nextStatus === 'accepted'
        ? 'Sprejmem naročilo v imenu Atehne? Po tem se lahko začne izvedba.'
        : 'Zavrnem naročilo? Morebitna zalogovna vezava mora biti obnovljena natanko enkrat.'
    );
    if (!confirmed) return;
    setBusy(true);
    try {
      const response = await fetch(`/api/admin/orders/${orderId}/contract-status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contractStatus: nextStatus, reason: nextStatus === 'rejected' ? reason.trim() : null })
      });
      const payload = await response.json().catch(() => null) as { message?: string; contractStatus?: OrderContractStatus } | null;
      if (!response.ok) throw new Error(payload?.message ?? 'Pogodbenega statusa ni bilo mogoče spremeniti.');
      setStatus(payload?.contractStatus ?? nextStatus);
      toast.success(payload?.message ?? (nextStatus === 'accepted' ? 'Naročilo je sprejeto.' : 'Naročilo je zavrnjeno.'));
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Pogodbenega statusa ni bilo mogoče spremeniti.');
    } finally {
      setBusy(false);
    }
  };

  const evidence = status === 'accepted' ? acceptedEvidence : rejectedEvidence;
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm" data-testid="admin-order-contract-card">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-950">Pogodbeni status</h2>
          <p className="mt-1 text-xs leading-5 text-slate-500">
            Ločen je od izvedbenega statusa, plačila in šolske zavezanosti kupca.
          </p>
        </div>
        <span className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
          status === 'accepted'
            ? 'bg-emerald-50 text-emerald-700'
            : status === 'rejected'
              ? 'bg-rose-50 text-rose-700'
              : 'bg-amber-50 text-amber-800'
        }`}>
          {LABELS[status]}
        </span>
      </div>

      {isQuoteDerived ? (
        <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">
          <p>To naročilo je pogodbeno sprejeto že s sprejemom izdane Atehnine ponudbe in ne potrebuje ponovnega sprejema prodajalca.</p>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 font-semibold">
            {sourceQuoteOfferNumber ? <span>Iz ponudbe {sourceQuoteOfferNumber}</span> : null}
            {sourceQuoteRequestId && sourceQuoteRequestNumber ? (
              <Link href={`/admin/orders/quotes/${sourceQuoteRequestId}`} className="text-blue-700 hover:underline">
                Povpraševanje {sourceQuoteRequestNumber}
              </Link>
            ) : null}
          </div>
        </div>
      ) : status === 'pending_seller_acceptance' ? (
        <div className="mt-4 space-y-3">
          <p className="text-sm text-slate-700">Samodejno potrdilo pomeni samo prejem naročila. Izvedba je blokirana do izrecnega sprejema Atehne.</p>
          <label className="block text-sm font-medium text-slate-700">
            Razlog zavrnitve
            <textarea value={reason} onChange={(event) => setReason(event.target.value)} rows={2} placeholder="Razlog bo uporabljen v obvestilu stranki in dokazni sledi." className="mt-1 w-full rounded-lg border border-slate-300 p-3 text-sm" />
          </label>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => void updateContract('accepted')} disabled={busy} className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">Sprejmi naročilo</button>
            <button type="button" onClick={() => void updateContract('rejected')} disabled={busy} className="rounded-lg border border-rose-300 px-4 py-2 text-sm font-semibold text-rose-700 disabled:opacity-50">Zavrni naročilo</button>
          </div>
        </div>
      ) : (
        <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
          <div><dt className="text-xs font-semibold uppercase text-slate-500">Odločitev</dt><dd className="mt-1 text-slate-900">{formatDateTime(status === 'accepted' ? acceptedAt : rejectedAt)}</dd></div>
          <div><dt className="text-xs font-semibold uppercase text-slate-500">Izvedel</dt><dd className="mt-1 text-slate-900">{(status === 'accepted' ? acceptedActorType : rejectedActorType) ?? '—'} {(status === 'accepted' ? acceptedActorId : rejectedActorId) ?? ''}</dd></div>
          {status === 'accepted' ? <div><dt className="text-xs font-semibold uppercase text-slate-500">Finančno pripisano</dt><dd className="mt-1 text-slate-900">{formatDateTime(committedAt)}</dd></div> : <div><dt className="text-xs font-semibold uppercase text-slate-500">Razlog</dt><dd className="mt-1 text-slate-900">{reason || '—'}</dd></div>}
          <div><dt className="text-xs font-semibold uppercase text-slate-500">Dokaz</dt><dd className="mt-1 break-all text-xs text-slate-600">{evidence ? JSON.stringify(evidence) : '—'}</dd></div>
        </dl>
      )}
    </section>
  );
}
