'use client';

import { useEffect, useState } from 'react';
import { getCustomerTypeLabel } from '@/lib/customerType';

type Props = {
  organizationName: string | null;
  contactName: string;
  customerType: string;
  email: string;
  deliveryAddress: string | null;
  notes: string | null;
};

type DetailsUpdate = {
  organizationName?: string;
  contactName?: string;
  customerType?: string;
  email?: string;
  deliveryAddress?: string;
  notes?: string;
};

export default function AdminOrderOverviewCard({
  organizationName,
  contactName,
  customerType,
  email,
  deliveryAddress,
  notes
}: Props) {
  const [state, setState] = useState({
    organizationName: organizationName ?? '',
    contactName,
    customerType,
    email,
    deliveryAddress: deliveryAddress ?? '',
    notes: notes?.trim() ? notes : '/'
  });

  useEffect(() => {
    const onDetailsUpdated = (event: Event) => {
      const custom = event as CustomEvent<DetailsUpdate>;
      if (!custom.detail) return;
      setState((prev) => ({
        ...prev,
        ...custom.detail,
        notes: custom.detail.notes?.trim() ? custom.detail.notes : '/'
      }));
    };

    window.addEventListener('admin-order-details-updated', onDetailsUpdated as EventListener);
    return () =>
      window.removeEventListener('admin-order-details-updated', onDetailsUpdated as EventListener);
  }, []);

  return (
    <div className="mt-4 grid gap-4 text-sm text-slate-600 md:grid-cols-2">
      <div>
        <p className="text-xs uppercase text-slate-400">Naročnik</p>
        <p className="font-semibold text-slate-900">{state.organizationName || state.contactName}</p>
        <p>{getCustomerTypeLabel(state.customerType)}</p>
      </div>
      <div>
        <p className="text-xs uppercase text-slate-400">Kontakt</p>
        <p>{state.contactName}</p>
        <p>{state.email}</p>
      </div>
      <div>
        <p className="text-xs uppercase text-slate-400">Naslov</p>
        <p>{state.deliveryAddress || 'Ni podan.'}</p>
      </div>
      <div className="md:col-span-2">
        <p className="text-xs uppercase text-slate-400">Opombe</p>
        <p>{state.notes || '/'}</p>
      </div>
    </div>
  );
}
