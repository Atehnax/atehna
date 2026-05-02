'use client';

import { useEffect, useMemo, useState } from 'react';
import type { CatalogItemIdentityAvailability, CatalogItemIdentityField } from '@/shared/domain/catalog/catalogAdminTypes';

export type CatalogItemIdentityAvailabilityState =
  | { status: 'idle'; isAvailable: false; suggestions: string[]; message: string | null }
  | { status: 'loading'; isAvailable: false; suggestions: string[]; message: string | null }
  | ({ status: 'ready'; message: string | null } & CatalogItemIdentityAvailability)
  | { status: 'error'; isAvailable: false; suggestions: string[]; message: string };

const IDLE_STATE: CatalogItemIdentityAvailabilityState = {
  status: 'idle',
  isAvailable: false,
  suggestions: [],
  message: null
};

const FIELD_LABELS: Record<CatalogItemIdentityField, string> = {
  name: 'Naziv artikla',
  sku: 'SKU',
  slug: 'URL'
};

export function getCatalogItemIdentityMessage(
  field: CatalogItemIdentityField,
  state: CatalogItemIdentityAvailabilityState
) {
  if (state.status === 'ready' && !state.isAvailable) {
    const suffix = state.suggestions.length > 0 ? ` Predlogi: ${state.suggestions.join(', ')}.` : '';
    return `${FIELD_LABELS[field]} je že uporabljen.${suffix}`;
  }
  if (state.status === 'error') return state.message;
  return null;
}

export function useCatalogItemIdentityAvailability({
  field,
  value,
  itemId,
  variantId,
  enabled
}: {
  field: CatalogItemIdentityField;
  value: string;
  itemId: number | null;
  variantId?: number | null;
  enabled: boolean;
}) {
  const normalizedValue = useMemo(() => value.trim().replace(/\s+/g, ' '), [value]);
  const [state, setState] = useState<CatalogItemIdentityAvailabilityState>(IDLE_STATE);

  useEffect(() => {
    if (!enabled || !normalizedValue) {
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
        field,
        value: normalizedValue
      });
      if (itemId !== null) params.set('itemId', String(itemId));
      if (variantId !== undefined && variantId !== null) params.set('variantId', String(variantId));

      fetch(`/api/admin/artikli/availability?${params.toString()}`, {
        signal: controller.signal
      })
        .then(async (response) => {
          const payload = await response.json().catch(() => null);
          if (!response.ok) {
            throw new Error(
              payload && typeof payload === 'object' && 'message' in payload && typeof payload.message === 'string'
                ? payload.message
                : 'Preverjanje enoličnosti ni uspelo.'
            );
          }

          return payload as CatalogItemIdentityAvailability;
        })
        .then((availability) => {
          setState({
            ...availability,
            status: 'ready',
            message: availability.isAvailable ? null : `${FIELD_LABELS[field]} je že uporabljen.`
          });
        })
        .catch((error: Error) => {
          if (controller.signal.aborted) return;
          setState({
            status: 'error',
            isAvailable: false,
            suggestions: [],
            message: error.message || 'Preverjanje enoličnosti ni uspelo.'
          });
        });
    }, 180);

    return () => {
      window.clearTimeout(timeoutId);
      controller.abort();
    };
  }, [enabled, field, itemId, normalizedValue, variantId]);

  return state;
}
