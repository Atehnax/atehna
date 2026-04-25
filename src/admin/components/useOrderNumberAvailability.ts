'use client';

import { useEffect, useMemo, useState } from 'react';

type OrderNumberAvailability = {
  inputDigits: string;
  normalizedOrderNumber: number | null;
  formattedOrderNumber: string | null;
  isAvailable: boolean;
  conflictOrderId: number | null;
  suggestions: string[];
};

export type OrderNumberAvailabilityState =
  | { status: 'idle'; isAvailable: false; suggestions: string[]; message: string | null }
  | { status: 'loading'; isAvailable: false; suggestions: string[]; message: string | null }
  | ({ status: 'ready'; message: string | null } & OrderNumberAvailability)
  | { status: 'error'; isAvailable: false; suggestions: string[]; message: string };

const IDLE_STATE: OrderNumberAvailabilityState = {
  status: 'idle',
  isAvailable: false,
  suggestions: [],
  message: null
};

export function sanitizeOrderNumberInput(value: string) {
  return value.replace(/[^\d]/g, '');
}

export function normalizeOrderNumberDigits(value: string) {
  const digits = sanitizeOrderNumberInput(value);
  return digits.replace(/^0+(?=\d)/, '');
}

export function useOrderNumberAvailability({
  orderId,
  value,
  enabled
}: {
  orderId: number | null;
  value: string;
  enabled: boolean;
}) {
  const inputDigits = useMemo(() => sanitizeOrderNumberInput(value), [value]);
  const [state, setState] = useState<OrderNumberAvailabilityState>(IDLE_STATE);

  useEffect(() => {
    if (!enabled || orderId === null || !inputDigits) {
      setState(IDLE_STATE);
      return;
    }

    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => {
      setState((current) => ({
        status: 'loading',
        isAvailable: false,
        suggestions: current.suggestions,
        message: null
      }));

      const params = new URLSearchParams({
        orderId: String(orderId),
        value: inputDigits
      });

      fetch(`/api/admin/orders/order-number-suggestions?${params.toString()}`, {
        signal: controller.signal
      })
        .then(async (response) => {
          const payload = await response.json().catch(() => null);
          if (!response.ok) {
            throw new Error(
              payload && typeof payload === 'object' && 'message' in payload && typeof payload.message === 'string'
                ? payload.message
                : 'Preverjanje številke naročila ni uspelo.'
            );
          }

          return payload as OrderNumberAvailability;
        })
        .then((availability) => {
          setState({
            ...availability,
            status: 'ready',
            message: availability.isAvailable ? null : 'Številka naročila je že zasedena.'
          });
        })
        .catch((error: Error) => {
          if (controller.signal.aborted) return;
          setState({
            status: 'error',
            isAvailable: false,
            suggestions: [],
            message: error.message || 'Preverjanje številke naročila ni uspelo.'
          });
        });
    }, 180);

    return () => {
      window.clearTimeout(timeoutId);
      controller.abort();
    };
  }, [enabled, inputDigits, orderId]);

  return state;
}

export function isOrderNumberAllowed(
  value: string,
  currentOrderNumber: string,
  availability: OrderNumberAvailabilityState
) {
  const normalizedValue = normalizeOrderNumberDigits(value);
  if (!normalizedValue) return false;
  if (normalizedValue === normalizeOrderNumberDigits(currentOrderNumber)) return true;
  return availability.status === 'ready' && availability.isAvailable;
}

export function getOrderNumberValidationMessage(
  value: string,
  currentOrderNumber: string,
  availability: OrderNumberAvailabilityState
) {
  const normalizedValue = normalizeOrderNumberDigits(value);
  if (!normalizedValue) return 'Vnesite številko naročila.';
  if (normalizedValue === normalizeOrderNumberDigits(currentOrderNumber)) return null;
  if (availability.status === 'ready' && !availability.isAvailable) return availability.message;
  if (availability.status === 'error') return availability.message;
  return null;
}
