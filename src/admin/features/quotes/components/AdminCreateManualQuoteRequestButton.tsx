'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { AdminTablePrimaryActionButton } from '@/shared/ui/admin-table';
import { Spinner } from '@/shared/ui/loading';
import { useToast } from '@/shared/ui/toast';

export default function AdminCreateManualQuoteRequestButton() {
  const router = useRouter();
  const { toast } = useToast();
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createDraftQuoteRequest = async () => {
    if (isCreating) return;

    setError(null);
    setIsCreating(true);
    try {
      const response = await fetch('/api/admin/quote-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'draft' })
      });
      const payload = (await response.json().catch(() => null)) as {
        quoteRequestId?: number;
        id?: number;
        message?: string;
      } | null;
      if (!response.ok) {
        throw new Error(payload?.message ?? 'Povpraševanja ni bilo mogoče ustvariti.');
      }

      const quoteRequestId = Number(payload?.quoteRequestId ?? payload?.id);
      if (!Number.isSafeInteger(quoteRequestId) || quoteRequestId <= 0) {
        throw new Error('Strežnik ni vrnil veljavnega povpraševanja.');
      }

      if (typeof window !== 'undefined') {
        window.sessionStorage.setItem('admin-orders-needs-refresh', '1');
      }
      toast.success(payload?.message ?? 'Osnutek povpraševanja je ustvarjen.');
      router.push(`/admin/orders/quotes/${quoteRequestId}`);
    } catch (caughtError) {
      const message =
        caughtError instanceof Error
          ? caughtError.message
          : 'Povpraševanja ni bilo mogoče ustvariti.';
      setError(message);
      toast.error(message);
      setIsCreating(false);
    }
  };

  return (
    <div className="flex flex-col items-end gap-1">
      <AdminTablePrimaryActionButton
        type="button"
        onClick={() => void createDraftQuoteRequest()}
        disabled={isCreating}
        aria-label="Novo povpraševanje"
        data-testid="quote-table-create-request"
        className="!rounded-md !px-4"
      >
        {isCreating ? (
          <span className="inline-flex items-center gap-1.5">
            <Spinner size="sm" className="text-white/90" />
            Ustvarjam …
          </span>
        ) : (
          'Novo povpraševanje'
        )}
      </AdminTablePrimaryActionButton>
      {error ? (
        <p role="alert" className="max-w-72 text-right text-[11px] font-medium text-rose-600">
          {error}
        </p>
      ) : null}
    </div>
  );
}
