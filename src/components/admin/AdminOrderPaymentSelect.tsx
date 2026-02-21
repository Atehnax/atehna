'use client';

import { useEffect, useRef, useState } from 'react';
import PaymentChip from '@/components/admin/PaymentChip';
import { PAYMENT_STATUS_OPTIONS, isPaymentStatus } from '@/lib/paymentStatus';

type Props = {
  orderId: number;
  status?: string | null;
  canEdit: boolean;
  disabled?: boolean;
  onStatusSaved?: (nextStatus: string) => void;
};

export default function AdminOrderPaymentSelect({
  orderId,
  status,
  canEdit,
  disabled = false,
  onStatusSaved
}: Props) {
  const [currentStatus, setCurrentStatus] = useState(status ?? null);
  const [isSaving, setIsSaving] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setCurrentStatus(status ?? null);
  }, [status]);

  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsOpen(false);
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen]);

  const handleChange = async (value: string) => {
    setIsSaving(true);
    try {
      const response = await fetch(`/api/admin/orders/${orderId}/payment-status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: value, note: '' })
      });

      if (!response.ok) return;

      setCurrentStatus(value);
      setIsOpen(false);
      onStatusSaved?.(value);
    } finally {
      setIsSaving(false);
    }
  };

  const knownStatus = currentStatus && isPaymentStatus(currentStatus);
  const allowEdit = canEdit && !disabled && knownStatus;

  if (!allowEdit) {
    return (
      <div className="flex justify-center">
        <PaymentChip status={currentStatus} isSaving={isSaving} />
      </div>
    );
  }

  return (
    <div className="relative flex justify-center" ref={containerRef}>
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="rounded-full focus:outline-none focus-visible:ring-0 focus-visible:ring-[#5d3ed6]"
        aria-haspopup="menu"
        aria-expanded={isOpen}
        aria-label={`Spremeni plačilni status naročila ${orderId}`}
      >
        <PaymentChip status={currentStatus} isSaving={isSaving} />
      </button>

      {isOpen && (
        <div
          role="menu"
          className="absolute left-1/2 top-9 z-20 w-44 -translate-x-1/2 rounded-lg border border-slate-200 bg-white p-1 shadow-lg"
        >
          {PAYMENT_STATUS_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              role="menuitem"
              onClick={() => handleChange(option.value)}
              disabled={isSaving || option.value === currentStatus}
              className="block w-full rounded-md px-2 py-1.5 text-left text-xs text-slate-700 hover:bg-[#ede8ff] disabled:cursor-not-allowed disabled:text-slate-300"
            >
              {option.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
