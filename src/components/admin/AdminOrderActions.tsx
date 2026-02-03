'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

type AdminOrderActionsProps = {
  orderId: string;
};

export default function AdminOrderActions({ orderId }: AdminOrderActionsProps) {
  const router = useRouter();
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);

  const runAction = async (url: string, body?: BodyInit) => {
    setBusy(true);
    await fetch(url, { method: 'POST', body });
    setBusy(false);
    router.refresh();
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => runAction(`/api/admin/orders/${orderId}/generate-dobavnica`)}
          className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:border-brand-200"
          disabled={busy}
        >
          Generiraj dobavnico
        </button>
        <button
          type="button"
          onClick={() => runAction(`/api/admin/orders/${orderId}/generate-invoice`)}
          className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:border-brand-200"
          disabled={busy}
        >
          Generiraj račun
        </button>
        <button
          type="button"
          onClick={() =>
            runAction(
              `/api/admin/orders/${orderId}/status`,
              (() => {
                const form = new FormData();
                form.append('action', 'mark_paid');
                return form;
              })()
            )
          }
          className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:border-brand-200"
          disabled={busy}
        >
          Označi kot plačano
        </button>
      </div>

      <div className="rounded-xl border border-slate-200 p-3">
        <label className="text-xs font-semibold uppercase tracking-widest text-slate-500">
          Razlog
        </label>
        <input
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
          placeholder="Dodajte razlog (za oznako ali preklic)"
        />
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() =>
              runAction(`/api/admin/orders/${orderId}/status`, (() => {
                const form = new FormData();
                form.append('action', 'flag');
                form.append('reason', reason);
                return form;
              })())
            }
            className="rounded-lg border border-amber-200 px-3 py-2 text-sm font-semibold text-amber-700 hover:bg-amber-50"
            disabled={busy}
          >
            Označi za pregled
          </button>
          <button
            type="button"
            onClick={() =>
              runAction(`/api/admin/orders/${orderId}/status`, (() => {
                const form = new FormData();
                form.append('action', 'cancel');
                form.append('reason', reason);
                return form;
              })())
            }
            className="rounded-lg border border-rose-200 px-3 py-2 text-sm font-semibold text-rose-700 hover:bg-rose-50"
            disabled={busy}
          >
            Prekliči naročilo
          </button>
        </div>
      </div>
    </div>
  );
}
