'use client';

import { useEffect, useRef, useState } from 'react';
import { ORDER_STATUS_OPTIONS } from '@/lib/orderStatus';
import StatusChip from '@/components/admin/StatusChip';

type Props = {
  orderId: number;
  status: string;
  canEdit: boolean;
  disabled?: boolean;
  onStatusSaved?: (nextStatus: string) => void;
};

export default function AdminOrderStatusSelect({
  orderId,
  status,
  canEdit,
  disabled = false,
  onStatusSaved
}: Props) {
  const [currentStatus, setCurrentStatus] = useState(status);
  const [isSaving, setIsSaving] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setCurrentStatus(status);
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
      const response = await fetch(`/api/admin/orders/${orderId}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: value })
      });

      if (!response.ok) return;

      setCurrentStatus(value);
      setIsOpen(false);
      onStatusSaved?.(value);
    } finally {
      setIsSaving(false);
    }
  };

  if (!canEdit || disabled) {
    return (
      <div className="flex justify-center">
        <StatusChip status={currentStatus} isSaving={isSaving} />
      </div>
    );
  }

  return (
    <div className="relative flex justify-center" ref={containerRef}>
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="rounded-full focus:outline-none focus-visible:ring-1 focus-visible:ring-[#ede8fe]"
        aria-haspopup="menu"
        aria-expanded={isOpen}
        aria-label={`Spremeni status naročila ${orderId}`}
      >
        <StatusChip status={currentStatus} isSaving={isSaving} />
      </button>

      {isOpen && (
        <div
          role="menu"
          className="absolute left-1/2 top-9 z-20 min-w-[180px] -translate-x-1/2 rounded-lg border border-slate-200 bg-white p-1 shadow-lg"
        >
          {ORDER_STATUS_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              role="menuitem"
              onClick={() => handleChange(option.value)}
              disabled={isSaving || option.value === currentStatus}
              className="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-xs text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-300"
            >
              <span>{option.label}</span>
              {option.value === currentStatus && <span aria-hidden>✓</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
