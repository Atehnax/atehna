'use client';

import { useState } from 'react';
import { ORDER_STATUS_OPTIONS } from '@/lib/orderStatus';

type Props = {
  orderId: number;
  status: string;
};

export default function AdminOrderStatusSelect({ orderId, status }: Props) {
  const [currentStatus, setCurrentStatus] = useState(status);
  const [isSaving, setIsSaving] = useState(false);

  const handleChange = async (value: string) => {
    setCurrentStatus(value);
    setIsSaving(true);
    try {
      await fetch(`/api/admin/orders/${orderId}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: value })
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <select
        value={currentStatus}
        onChange={(event) => handleChange(event.target.value)}
        className="w-full rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-600"
      >
        {ORDER_STATUS_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {isSaving && <span className="text-xs text-slate-400">...</span>}
    </div>
  );
}
