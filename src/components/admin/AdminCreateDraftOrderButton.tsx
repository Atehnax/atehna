'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/shared/ui/button';
import { useToast } from '@/shared/ui/toast';

type Props = {
  className?: string;
};

export default function AdminCreateDraftOrderButton({ className }: Props) {
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
        variant="admin-soft"
      >
        <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
          <path d="M10 4v12M4 10h12" />
        </svg>
        {isCreating ? 'Ustvarjam ...' : 'Novo naročilo'}
      </Button>
      {error && <p className="text-xs text-rose-600">{error}</p>}
    </div>
  );
}
