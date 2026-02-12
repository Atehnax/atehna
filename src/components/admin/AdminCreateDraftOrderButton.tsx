'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function AdminCreateDraftOrderButton() {
  const router = useRouter();
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createDraft = async () => {
    setError(null);
    setIsCreating(true);
    try {
      const response = await fetch('/api/admin/orders', { method: 'POST' });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.message || 'Ustvarjanje osnutka ni uspelo.');
      }
      const payload = (await response.json()) as { orderId: number };
      router.push(`/admin/orders/${payload.orderId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Napaka pri ustvarjanju osnutka.');
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={createDraft}
        disabled={isCreating}
        className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-800 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-400"
      >
        <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
          <path d="M10 4v12M4 10h12" />
        </svg>
        {isCreating ? 'Ustvarjam ...' : 'Dodaj naročilo'}
      </button>
      {error && <p className="text-xs text-rose-600">{error}</p>}
    </div>
  );
}
