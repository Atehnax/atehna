'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function AdminOrdersRowActions({ orderId }: { orderId: number }) {
  const router = useRouter();
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async () => {
    const confirmed = window.confirm('Ali ste prepričani, da želite izbrisati to naročilo?');
    if (!confirmed) return;
    setIsDeleting(true);
    try {
      const response = await fetch(`/api/admin/orders/${orderId}`, { method: 'DELETE' });
      if (!response.ok) {
        return;
      }
      router.refresh();
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="flex items-center justify-end gap-3">
      <Link
        href={`/admin/orders/${orderId}`}
        className="text-sm font-semibold text-brand-600 hover:text-brand-700"
      >
        Odpri →
      </Link>
      <button
        type="button"
        onClick={handleDelete}
        disabled={isDeleting}
        className="text-xs font-semibold text-rose-600 hover:text-rose-700 disabled:cursor-not-allowed disabled:text-slate-300"
      >
        {isDeleting ? 'Brisanje...' : 'Izbriši'}
      </button>
    </div>
  );
}
