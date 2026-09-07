'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { AdminTablePrimaryActionButton, AdminTablePrimarySplitActionButton } from '@/shared/ui/admin-table';
import { useToast } from '@/shared/ui/toast';
import { Button } from '@/shared/ui/button';
import { Dialog } from '@/shared/ui/dialog';
import { Input } from '@/shared/ui/input';
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

  const [historicalOpen, setHistoricalOpen] = useState(false);
  const [originalReferenceSystem, setOriginalReferenceSystem] = useState('');
  const [originalReference, setOriginalReference] = useState('');
  const [orderDate, setOrderDate] = useState('');
  const createDraft = async (historical = false) => {
    setError(null);
    setIsCreating(true);
    try {
      const response = await fetch('/api/admin/orders', { method: 'POST', ...(historical ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ isHistorical: true, originalReferenceSystem, originalReference, orderDate }) } : {}) });
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
      <AdminTablePrimarySplitActionButton
        label="Novo naročilo"
        menuLabel="Način dodajanja naročila"
        onClick={() => void createDraft()}
        disabled={isCreating}
        buttonClassName={buttonClassName}
        items={[{
          key: 'historical',
          label: 'Dodaj zgodovinsko naročilo',
          onSelect: () => { setError(null); setHistoricalOpen(true); }
        }]}
      >
        {isCreating ? <span className="inline-flex items-center gap-1.5"><Spinner size="sm" className="text-white/90" />Ustvarjam ...</span> : 'Novo naročilo'}
      </AdminTablePrimarySplitActionButton>
      <Dialog open={historicalOpen} onOpenChange={(open) => { if (!isCreating) setHistoricalOpen(open); }} title="Zgodovinsko naročilo">
        <p className="mb-4 text-sm text-slate-500">Vnesite izvorne podatke. Nato dodajte naročnika, postavke in prvotno stanje naročila.</p>
        <form className="grid gap-3" onSubmit={(event) => { event.preventDefault(); void createDraft(true); }}>
          <label className="grid gap-1 text-sm">Izvorni sistem<Input aria-label="Izvorni sistem" className="h-9 px-2 text-sm" required maxLength={80} value={originalReferenceSystem} onChange={(event)=>setOriginalReferenceSystem(event.target.value)} placeholder="Npr. prejšnja evidenca" /></label>
          <label className="grid gap-1 text-sm">Izvorna št. računa<Input aria-label="Izvorna št. računa" className="h-9 px-2 text-sm" required maxLength={200} value={originalReference} onChange={(event)=>setOriginalReference(event.target.value)} /></label>
          <label className="grid gap-1 text-sm">Datum naročila<Input aria-label="Datum naročila" className="h-9 px-2 text-sm" type="date" required value={orderDate} onChange={(event)=>setOrderDate(event.target.value)} /></label>
          {error ? <p role="alert" className="text-sm text-rose-600">{error}</p> : null}
          <div className="mt-2 flex justify-end gap-2"><Button type="button" variant="default" size="toolbar" disabled={isCreating} onClick={()=>setHistoricalOpen(false)}>Prekliči</Button><AdminTablePrimaryActionButton type="submit" disabled={isCreating}>Ustvari osnutek</AdminTablePrimaryActionButton></div>
        </form>
      </Dialog>
      {error && !historicalOpen && <p className="text-xs text-rose-600">{error}</p>}
    </div>
  );
}
