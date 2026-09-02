'use client';

import { useEffect, useMemo, useState } from 'react';
import { ConfirmDialog } from '@/shared/ui/confirm-dialog';
import {
  AdminDetailDocumentOpenLink,
  AdminDetailDocumentPrimaryAction
} from '@/shared/ui/admin-detail';
import {
  adminCardSectionEditIconButtonClassName,
  adminCardSectionIconActionButtonClassName,
  adminCardSectionIconClassName
} from '@/shared/ui/admin-table';
import { CopyIcon, PencilIcon } from '@/shared/ui/icons/AdminActionIcons';
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
  hasActivePurchaseOrderEvidence,
  initialCommitmentStatus,
  compact = false
}: {
  orderId: number;
  customerType: string;
  hasActivePurchaseOrderEvidence: boolean;
  initialCommitmentStatus: CommitmentStatus;
  compact?: boolean;
}) {
  const { toast } = useToast();
  const [status, setStatus] = useState<AccessStatusResponse | null>(null);
  const [commitmentStatus, setCommitmentStatus] = useState(initialCommitmentStatus);
  const [issuedUrl, setIssuedUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isWorking, setIsWorking] = useState(false);
  const [confirmAction, setConfirmAction] = useState<'revoke' | null>(null);
  const [compactExpanded, setCompactExpanded] = useState(false);
  const latestActive = useMemo(
    () => status?.tokens.find((token) => token.active) ?? null,
    [status]
  );

  useEffect(() => {
    setCommitmentStatus(initialCommitmentStatus);
  }, [initialCommitmentStatus]);

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
      ? 'Potrjeno kot zavezujoče'
      : commitmentStatus === 'rejected'
        ? 'Zavrnjeno naročilo'
        : 'Čaka na status »V obdelavi«';
  const pendingCommitmentHelp =
    'Status »V obdelavi« sprejme naročilo in ga potrdi kot zavezujoče.';
  const missingSchoolPurchaseOrderEvidence =
    customerType === 'school' && !hasActivePurchaseOrderEvidence;
  const missingSchoolPurchaseOrderMessage = commitmentStatus === 'pending_confirmation'
    ? 'Manjka veljavna naročilnica. To je ločen pogoj za prehod v status »V obdelavi«.'
    : 'Manjka veljavna naročilnica. Trenutni status, obdelava in zavezujočnost ostanejo nespremenjeni; dodajte manjkajoče dokazilo.';

  if (compact) {
    return (
      <>
        <section
          className="rounded-xl border border-slate-200 bg-white p-5 shadow-[0_14px_34px_rgba(15,23,42,0.06),0_2px_6px_rgba(15,23,42,0.04)]"
          data-testid="admin-order-customer-access-compact"
        >
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-base font-semibold text-slate-900">Stranka in dostop</h2>
            <button
              type="button"
              className={`${adminCardSectionEditIconButtonClassName} ${compactExpanded ? 'bg-[color:var(--hover-neutral)]' : ''}`}
              onClick={() => setCompactExpanded((expanded) => !expanded)}
              aria-label={compactExpanded ? 'Skrij upravljanje dostopa' : 'Upravljaj dostop'}
              aria-expanded={compactExpanded}
              aria-controls={`admin-order-customer-access-management-${orderId}`}
              title={compactExpanded ? 'Skrij upravljanje' : 'Upravljaj dostop'}
              data-admin-card-edit-action="customer-access"
            >
              <PencilIcon className="h-4 w-4" />
            </button>
          </div>

          <dl className="mt-4 divide-y divide-slate-200 text-xs">
            <div className="flex items-center justify-between gap-4 py-2 first:pt-0">
              <dt className="text-slate-600">Zavezanost naročila</dt>
              <dd className={`font-semibold ${
                commitmentStatus === 'binding'
                  ? 'text-emerald-700'
                  : commitmentStatus === 'rejected'
                    ? 'text-rose-700'
                    : 'text-amber-700'
              }`}>
                {commitmentLabel}
              </dd>
            </div>
            <div className="flex items-center justify-between gap-4 py-2">
              <dt className="text-slate-600">Dostop stranke</dt>
              <dd className={`font-semibold ${latestActive ? 'text-emerald-700' : 'text-slate-500'}`}>
                {isLoading ? 'Preverjam …' : latestActive ? 'Omogočen' : 'Ni omogočen'}
              </dd>
            </div>
          </dl>

          {missingSchoolPurchaseOrderEvidence ? (
            <div
              className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-800"
              data-testid="missing-school-purchase-order-evidence-compact"
            >
              <p className="font-semibold">Manjka naročilnica</p>
              <p className="mt-1">{missingSchoolPurchaseOrderMessage}</p>
            </div>
          ) : null}

          {compactExpanded ? (
            <div
              id={`admin-order-customer-access-management-${orderId}`}
              className="mt-4 border-t border-slate-200 pt-4"
            >
              {commitmentStatus === 'pending_confirmation' ? (
                <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3">
                  <p className="text-xs leading-5 text-amber-800">
                    {pendingCommitmentHelp}
                  </p>

                </div>
              ) : null}

              <dl className="grid grid-cols-2 gap-3 text-xs">
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
                  <input readOnly value={issuedUrl} aria-label="Nova povezava za stranko" className="mt-2 h-9 w-full min-w-0 rounded-lg border border-emerald-200 bg-white px-3 text-xs text-slate-700 outline-none" />
                  <div className="mt-3 flex flex-wrap gap-2">
                    <AdminDetailDocumentOpenLink href={issuedUrl} target="_blank" rel="noreferrer noopener" className="no-underline">
                      Odpri povezavo
                    </AdminDetailDocumentOpenLink>
                    <button
                      type="button"
                      className={adminCardSectionIconActionButtonClassName}
                      onClick={() => void copyIssuedUrl()}
                      aria-label="Kopiraj povezavo"
                      title="Kopiraj povezavo"
                      data-testid="admin-order-customer-access-copy"
                    >
                      <CopyIcon className={adminCardSectionIconClassName} />
                    </button>
                  </div>
                </div>
              ) : null}

              <div className="mt-4 flex flex-wrap gap-2">
                <AdminDetailDocumentPrimaryAction type="button" disabled={isWorking} onClick={() => void regenerate()}>
                  {latestActive ? 'Obnovi povezavo' : 'Ustvari povezavo'}
                </AdminDetailDocumentPrimaryAction>
                <AdminDetailDocumentPrimaryAction
                  type="button"
                  className="!text-rose-700 hover:!bg-rose-50 active:!bg-rose-100"
                  disabled={isWorking || !latestActive}
                  onClick={() => setConfirmAction('revoke')}
                >
                  Prekliči dostop
                </AdminDetailDocumentPrimaryAction>
              </div>
            </div>
          ) : null}
        </section>

        <ConfirmDialog
          open={confirmAction !== null}
          title="Preklic dostopa stranke"
          description="Vse aktivne povezave za to naročilo bodo takoj neveljavne."
          confirmLabel="Prekliči dostop"
          cancelLabel="Nazaj"
          isDanger
          onCancel={() => setConfirmAction(null)}
          onConfirm={() => void revoke()}
        />
      </>
    );
  }

  return (
    <>
      <section className="grid gap-5 rounded-xl border border-slate-200 bg-white p-6 lg:grid-cols-2">
        <div>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Zavezanost naročila</h2>
              <p className="mt-1 text-xs leading-5 text-slate-500">
                Status »V obdelavi« naročilo sprejme in potrdi kot zavezujoče.
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

          {commitmentStatus === 'pending_confirmation' ? (
            <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-800">
              <p>{pendingCommitmentHelp}</p>

            </div>
          ) : (
            <p className="mt-4 text-xs leading-5 text-slate-600">
              {commitmentStatus === 'binding'
                ? 'Naročilo je potrjeno kot zavezujoče.'
                : 'Naročilo je zavrnjeno.'}
            </p>
          )}

          {missingSchoolPurchaseOrderEvidence ? (
            <div
              className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-800"
              data-testid="missing-school-purchase-order-evidence-full"
            >
              <p className="font-semibold">Manjka naročilnica</p>
              <p className="mt-1">{missingSchoolPurchaseOrderMessage}</p>
            </div>
          ) : null}
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
              <input readOnly value={issuedUrl} aria-label="Nova povezava za stranko" className="mt-2 h-9 w-full min-w-0 rounded-lg border border-emerald-200 bg-white px-3 text-xs text-slate-700 outline-none" />
              <div className="mt-3 flex flex-wrap gap-2">
                <AdminDetailDocumentOpenLink
                  href={issuedUrl}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="no-underline"
                >
                  Odpri novo povezavo
                </AdminDetailDocumentOpenLink>
                <button
                  type="button"
                  className={adminCardSectionIconActionButtonClassName}
                  onClick={() => void copyIssuedUrl()}
                  aria-label="Kopiraj povezavo"
                  title="Kopiraj povezavo"
                  data-testid="admin-order-customer-access-copy"
                >
                  <CopyIcon className={adminCardSectionIconClassName} />
                </button>
              </div>
            </div>
          ) : null}

          <div className="mt-4 flex flex-wrap gap-2">
            <AdminDetailDocumentPrimaryAction type="button" disabled={isWorking} onClick={() => void regenerate()}>
              {latestActive ? 'Obnovi povezavo' : 'Ustvari povezavo'}
            </AdminDetailDocumentPrimaryAction>
            <AdminDetailDocumentPrimaryAction
              type="button"
              className="!text-rose-700 hover:!bg-rose-50 active:!bg-rose-100"
              disabled={isWorking || !latestActive}
              onClick={() => setConfirmAction('revoke')}
            >
              Prekliči dostop
            </AdminDetailDocumentPrimaryAction>
          </div>

          <p className="mt-4 border-t border-slate-100 pt-3 text-[11px] leading-4 text-slate-500">
            Opomnik za naslednjo varnostno fazo: pred občutljivejšim ali pravno dokončnim dostopom zamenjajte povezavo brez prijave s preverjanjem e-pošte.
          </p>
        </div>
      </section>

      <ConfirmDialog
        open={confirmAction !== null}
        title="Preklic dostopa stranke"
        description="Vse aktivne povezave za to naročilo bodo takoj neveljavne."
        confirmLabel="Prekliči dostop"
        cancelLabel="Nazaj"
        isDanger
        onCancel={() => setConfirmAction(null)}
        onConfirm={() => void revoke()}
      />
    </>
  );
}
