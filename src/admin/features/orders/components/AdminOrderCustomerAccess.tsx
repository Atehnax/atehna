'use client';

import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/shared/ui/button';
import { ConfirmDialog } from '@/shared/ui/confirm-dialog';
import { useToast } from '@/shared/ui/toast';

type CommitmentStatus = 'binding' | 'pending_confirmation' | 'rejected';

type AccessTokenStatus = {
  id: string;
  tokenPrefix: string;
  scopes: string[];
  createdAt: string;
  expiresAt: string;
  lastUsedAt: string | null;
  revokedAt: string | null;
  active: boolean;
};

type AccessStatusResponse = {
  hasActiveToken: boolean;
  activeTokenCount: number;
  tokens: AccessTokenStatus[];
  message?: string;
};

type IssuedAccessResponse = {
  confirmationUrl: string;
  expiresAt: string;
  revokedTokenCount: number;
  message?: string;
};

const formatDateTime = (value: string | null | undefined) => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('sl-SI', {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(date);
};

export default function AdminOrderCustomerAccess({
  orderId,
  customerType,
  initialCommitmentStatus
}: {
  orderId: number;
  customerType: string;
  initialCommitmentStatus: CommitmentStatus;
}) {
  const { toast } = useToast();
  const [status, setStatus] = useState<AccessStatusResponse | null>(null);
  const [commitmentStatus, setCommitmentStatus] = useState(initialCommitmentStatus);
  const [issuedUrl, setIssuedUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isWorking, setIsWorking] = useState(false);
  const [confirmAction, setConfirmAction] = useState<'revoke' | 'reject' | null>(null);
  const latestActive = useMemo(
    () => status?.tokens.find((token) => token.active) ?? null,
    [status]
  );

  async function loadStatus() {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/admin/orders/${orderId}/access-token`, {
        cache: 'no-store'
      });
      const body = await response.json().catch(() => ({})) as AccessStatusResponse;
      if (!response.ok) throw new Error(body.message ?? 'Stanja povezave ni bilo mogoče prebrati.');
      setStatus(body);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Stanja povezave ni bilo mogoče prebrati.');
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadStatus();
    // The order id is stable for the lifetime of this detail page.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId]);

  async function regenerate() {
    setIsWorking(true);
    try {
      const response = await fetch(`/api/admin/orders/${orderId}/access-token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ expiresInDays: 90 })
      });
      const body = await response.json().catch(() => ({})) as IssuedAccessResponse;
      if (!response.ok) throw new Error(body.message ?? 'Povezave ni bilo mogoče ustvariti.');
      const absoluteUrl = new URL(body.confirmationUrl, window.location.origin).toString();
      setIssuedUrl(absoluteUrl);
      toast.success('Nova povezava je ustvarjena; prejšnje povezave so preklicane.');
      await loadStatus();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Povezave ni bilo mogoče ustvariti.');
    } finally {
      setIsWorking(false);
    }
  }

  async function revoke() {
    setConfirmAction(null);
    setIsWorking(true);
    try {
      const response = await fetch(`/api/admin/orders/${orderId}/access-token`, {
        method: 'DELETE'
      });
      const body = await response.json().catch(() => ({})) as { message?: string };
      if (!response.ok) throw new Error(body.message ?? 'Povezave ni bilo mogoče preklicati.');
      setIssuedUrl(null);
      toast.success('Dostop stranke je preklican.');
      await loadStatus();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Povezave ni bilo mogoče preklicati.');
    } finally {
      setIsWorking(false);
    }
  }

  async function updateCommitment(nextStatus: CommitmentStatus) {
    setConfirmAction(null);
    setIsWorking(true);
    try {
      const response = await fetch(`/api/admin/orders/${orderId}/commitment-status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ commitmentStatus: nextStatus })
      });
      const body = await response.json().catch(() => ({})) as {
        message?: string;
        commitmentStatus?: CommitmentStatus;
      };
      if (!response.ok) throw new Error(body.message ?? 'Statusa ni bilo mogoče spremeniti.');
      setCommitmentStatus(body.commitmentStatus ?? nextStatus);
      toast.success(
        nextStatus === 'binding'
          ? 'Šolsko povpraševanje je potrjeno kot zavezujoče naročilo.'
          : 'Šolsko povpraševanje je zavrnjeno.'
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Statusa ni bilo mogoče spremeniti.');
    } finally {
      setIsWorking(false);
    }
  }

  async function copyIssuedUrl() {
    if (!issuedUrl) return;
    try {
      await navigator.clipboard.writeText(issuedUrl);
      toast.success('Povezava je kopirana.');
    } catch {
      toast.error('Povezave ni bilo mogoče kopirati. Označite jo ročno.');
    }
  }

  const commitmentLabel =
    commitmentStatus === 'binding'
      ? 'Zavezujoče naročilo'
      : commitmentStatus === 'rejected'
        ? 'Zavrnjeno povpraševanje'
        : 'Čaka na potrditev';

  return (
    <>
      <section className="grid gap-5 rounded-xl border border-slate-200 bg-white p-6 lg:grid-cols-2">
        <div>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Zavezanost naročila</h2>
              <p className="mt-1 text-xs leading-5 text-slate-500">
                Zavezanost je ločena od izvedbenega statusa in plačila.
              </p>
            </div>
            <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
              commitmentStatus === 'binding'
                ? 'bg-emerald-50 text-emerald-700'
                : commitmentStatus === 'rejected'
                  ? 'bg-rose-50 text-rose-700'
                  : 'bg-amber-50 text-amber-700'
            }`}>
              {commitmentLabel}
            </span>
          </div>

          {customerType === 'school' && commitmentStatus === 'pending_confirmation' ? (
            <>
              <p className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-800">
                Zaloga še ni rezervirana. Potrditev ponovno preveri trenutno zalogo in jo šele nato odšteje.
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <Button type="button" variant="primary" size="sm" disabled={isWorking} onClick={() => void updateCommitment('binding')}>
                  Potrdi kot zavezujoče
                </Button>
                <Button type="button" variant="danger" size="sm" disabled={isWorking} onClick={() => setConfirmAction('reject')}>
                  Zavrni
                </Button>
              </div>
            </>
          ) : (
            <p className="mt-4 text-xs leading-5 text-slate-600">
              {commitmentStatus === 'binding'
                ? 'Zaloga je zavezana naročilu. Samodejno vračilo ob preklicu ni omogočeno, dokler ni uvedena evidenca premikov zaloge.'
                : 'To povpraševanje ni zavezujoče in zaloga zanj ni rezervirana.'}
            </p>
          )}
        </div>

        <div className="border-t border-slate-200 pt-5 lg:border-l lg:border-t-0 lg:pl-5 lg:pt-0">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Dostop stranke</h2>
              <p className="mt-1 text-xs leading-5 text-slate-500">
                Neprosojna povezava omogoča ogled potrditve in oddajo naročilnice.
              </p>
            </div>
            <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
              latestActive ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'
            }`}>
              {isLoading ? 'Preverjam …' : latestActive ? 'Aktivna' : 'Ni aktivna'}
            </span>
          </div>

          <dl className="mt-4 grid grid-cols-2 gap-3 text-xs">
            <div>
              <dt className="text-slate-500">Velja do</dt>
              <dd className="mt-1 font-medium text-slate-800">{formatDateTime(latestActive?.expiresAt)}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Nazadnje uporabljena</dt>
              <dd className="mt-1 font-medium text-slate-800">{formatDateTime(latestActive?.lastUsedAt)}</dd>
            </div>
          </dl>

          {issuedUrl ? (
            <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 p-3">
              <p className="text-[11px] font-semibold text-emerald-800">Nova povezava — prikazana samo zdaj</p>
              <div className="mt-2 flex gap-2">
                <input readOnly value={issuedUrl} aria-label="Nova povezava za stranko" className="h-9 min-w-0 flex-1 rounded-lg border border-emerald-200 bg-white px-3 text-xs text-slate-700 outline-none" />
                <Button type="button" variant="outline" size="sm" onClick={() => void copyIssuedUrl()}>Kopiraj</Button>
              </div>
            </div>
          ) : null}

          <div className="mt-4 flex flex-wrap gap-2">
            <Button type="button" variant="primary" size="sm" disabled={isWorking} onClick={() => void regenerate()}>
              {latestActive ? 'Obnovi povezavo' : 'Ustvari povezavo'}
            </Button>
            <Button type="button" variant="outline" size="sm" disabled={isWorking || !latestActive} onClick={() => setConfirmAction('revoke')}>
              Prekliči dostop
            </Button>
          </div>

          <p className="mt-4 border-t border-slate-100 pt-3 text-[11px] leading-4 text-slate-500">
            Opomnik za naslednjo varnostno fazo: pred občutljivejšim ali pravno dokončnim dostopom zamenjajte povezavo brez prijave s preverjanjem e-pošte.
          </p>
        </div>
      </section>

      <ConfirmDialog
        open={confirmAction !== null}
        title={confirmAction === 'reject' ? 'Zavrnitev povpraševanja' : 'Preklic dostopa stranke'}
        description={confirmAction === 'reject'
          ? 'Povpraševanje bo označeno kot zavrnjeno. Zaloga ne bo spremenjena.'
          : 'Vse aktivne povezave za to naročilo bodo takoj neveljavne.'}
        confirmLabel={confirmAction === 'reject' ? 'Zavrni' : 'Prekliči dostop'}
        cancelLabel="Nazaj"
        isDanger
        onCancel={() => setConfirmAction(null)}
        onConfirm={() => {
          if (confirmAction === 'reject') void updateCommitment('rejected');
          else void revoke();
        }}
      />
    </>
  );
}
