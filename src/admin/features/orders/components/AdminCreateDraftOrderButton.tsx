'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { AdminTablePrimaryActionButton } from '@/shared/ui/admin-table';
import { useToast } from '@/shared/ui/toast';
import { Spinner } from '@/shared/ui/loading';

type Props = {
  className?: string;
  buttonClassName?: string;
};

export default function AdminCreateDraftOrderButton({ className, buttonClassName }: Props) {
  const router = useRouter();
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

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
      if (typeof window !== 'undefined') {
        window.sessionStorage.setItem('admin-orders-needs-refresh', '1');
      }
      toast.success('Dodano');
      router.push(`/admin/orders/${payload.orderId}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Napaka pri ustvarjanju osnutka.';
      setError(message);
      toast.error('Napaka pri dodajanju');
      setIsCreating(false);
    }
  };

  return (
    <div className={`flex flex-col items-end gap-1 ${className ?? ''}`.trim()}>
      <AdminTablePrimaryActionButton
        type="button"
        onClick={createDraft}
        disabled={isCreating}
        aria-label="Novo naročilo"
        className={buttonClassName}
      >
        {isCreating ? <span className="inline-flex items-center gap-1.5"><Spinner size="sm" className="text-white/90" />Ustvarjam ...</span> : 'Novo naročilo'}
      </AdminTablePrimaryActionButton>
      {error && <p className="text-xs text-rose-600">{error}</p>}
    </div>
  );
}
