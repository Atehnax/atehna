'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/shared/ui/button';
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
      <Button
        type="button"
        onClick={createDraft}
        disabled={isCreating}
        aria-label="Novo naročilo"
        variant="primary"
        size="toolbar"
        className={buttonClassName}
      >
        {isCreating ? <span className="inline-flex items-center gap-1.5"><Spinner size="sm" className="text-slate-500" />Ustvarjam ...</span> : 'Novo naročilo'}
      </Button>
      {error && <p className="text-xs text-rose-600">{error}</p>}
    </div>
  );
}
