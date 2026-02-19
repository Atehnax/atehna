'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

type Props = {
  className?: string;
};

export default function AdminCreateDraftOrderButton({ className }: Props) {
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
      setIsCreating(false);
    }
  };

  return (
    <div className={`flex flex-col items-end gap-1 ${className ?? ''}`.trim()}>
      <button
        type="button"
        onClick={createDraft}
        disabled={isCreating}
        aria-label="Dodaj naročilo"
        className="inline-flex h-8 items-center gap-1.5 rounded-xl border border-[#5a3fda]/70 bg-[#5a3fda]/85 px-3 text-xs font-semibold text-white shadow-sm transition hover:bg-[#5a3fda] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand-300 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-200 disabled:text-slate-400"
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
