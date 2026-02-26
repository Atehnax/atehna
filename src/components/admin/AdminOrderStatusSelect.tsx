'use client';

import { useEffect, useRef, useState } from 'react';
import { ORDER_STATUS_OPTIONS } from '@/lib/orderStatus';
import StatusChip from '@/components/admin/StatusChip';
import MenuItem from '@/shared/ui/menu/menu-item';
import MenuPanel from '@/shared/ui/menu/menu-panel';

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
        className="rounded-full focus:outline-none focus-visible:ring-0 focus-visible:ring-[#5d3ed6]"
        aria-haspopup="menu"
        aria-expanded={isOpen}
        aria-label={`Spremeni status naročila ${orderId}`}
      >
        <StatusChip status={currentStatus} isSaving={isSaving} />
      </button>

      {isOpen && (
        <div role="menu">
          <MenuPanel className="absolute left-1/2 top-9 z-20 min-w-[180px] -translate-x-1/2">
            {ORDER_STATUS_OPTIONS.map((option) => (
              <MenuItem
                key={option.value}
                onClick={() => handleChange(option.value)}
                disabled={isSaving || option.value === currentStatus}
                className="justify-between"
              >
                <span>{option.label}</span>
                {option.value === currentStatus && <span aria-hidden>✓</span>}
              </MenuItem>
            ))}
          </MenuPanel>
        </div>
      )}
    </div>
  );
}
