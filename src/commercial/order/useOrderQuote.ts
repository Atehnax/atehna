'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useCartStore } from '@/commercial/cart/store';
import type { CartItem, CartReconciliationUpdate } from '@/commercial/cart/cartTypes';
import {
  isOrderQuote,
  parseOrderApiError,
  type OrderApiError,
  type OrderQuote
} from '@/commercial/order/contracts';

export type OrderQuoteState = {
  quote: OrderQuote | null;
  isLoading: boolean;
  error: OrderApiError | null;
  missingVariantLineIds: string[];
};

export const normalizeOrderQuoteCustomerName = (customerName?: string) =>
  customerName?.trim() ?? '';

export const buildOrderQuoteRequestKey = (
  items: CartItem[],
  customerName?: string
) => {
  if (items.length === 0) return '';

  return JSON.stringify({
    customerName: normalizeOrderQuoteCustomerName(customerName),
    items: items
      .map((item) => [
        item.lineId,
        item.variant?.id ?? 'missing',
        Math.max(1, item.quantity)
      ])
      .sort(([leftLineId], [rightLineId]) =>
        String(leftLineId).localeCompare(String(rightLineId))
      )
  });
};

export function useOrderQuote(
  items: CartItem[],
  enabled = true,
  customerName?: string
): OrderQuoteState {
  const reconcileItems = useCartStore((state) => state.reconcileItems);
  const normalizedCustomerName = normalizeOrderQuoteCustomerName(customerName);
  const requestKey = useMemo(
    () => buildOrderQuoteRequestKey(items, normalizedCustomerName),
    [items, normalizedCustomerName]
  );
  const latestRequestKeyRef = useRef(requestKey);
  latestRequestKeyRef.current = requestKey;
  const itemsRef = useRef(items);
  itemsRef.current = items;
  const missingVariantLineIds = useMemo(
    () =>
      items
        .filter(
          (item) =>
            typeof item.variant?.id !== 'number' ||
            !Number.isFinite(item.variant.id) ||
            item.variant.id <= 0
        )
        .map((item) => item.lineId),
    [items]
  );
  const missingVariantKey = missingVariantLineIds.join('|');
  const [state, setState] = useState<Omit<OrderQuoteState, 'missingVariantLineIds'>>({
    quote: null,
    isLoading: false,
    error: null
  });

  useEffect(() => {
    if (!enabled || requestKey.length === 0) {
      setState({ quote: null, isLoading: false, error: null });
      return;
    }

    if (missingVariantKey.length > 0) {
      const missingLineIds = itemsRef.current
        .filter(
          (item) =>
            typeof item.variant?.id !== 'number' ||
            !Number.isFinite(item.variant.id) ||
            item.variant.id <= 0
        )
        .map((item) => item.lineId);
      const checkedAt = new Date().toISOString();
      reconcileItems(
        missingLineIds.map((lineId) => ({
          lineId,
          reconciliation: {
            status: 'needs_review',
            message: 'Pred oddajo ponovno izberite razpoložljivo različico.',
            checkedAt
          }
        }))
      );
      setState({
        quote: null,
        isLoading: false,
        error: {
          code: 'MISSING_VARIANT',
          message: 'Nekateri artikli nimajo potrjene različice.'
        }
      });
      return;
    }

    const controller = new AbortController();
    const requestItems = itemsRef.current;
    const isRequestStale = () =>
      controller.signal.aborted || latestRequestKeyRef.current !== requestKey;
    setState({ quote: null, isLoading: true, error: null });
    const timeout = window.setTimeout(async () => {
      if (isRequestStale()) return;

      try {
        const response = await fetch('/api/orders/quote', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            customerName: normalizedCustomerName,
            items: requestItems.map((item) => ({
              variantId: item.variant!.id,
              quantity: item.quantity
            }))
          }),
          signal: controller.signal
        });

        const payload: unknown = await response.json().catch(() => ({}));
        if (isRequestStale()) return;
        if (!response.ok) {
          const apiError = parseOrderApiError(
            payload,
            'Košarice trenutno ni mogoče preveriti.'
          );
          const checkedAt = new Date().toISOString();
          const issueByVariant = new Map(
            (apiError.issues ?? [])
              .filter((issue) => typeof issue.variantId === 'number')
              .map((issue) => [issue.variantId as number, issue])
          );
          const updates: CartReconciliationUpdate[] = requestItems.map((item) => {
            const issue = issueByVariant.get(item.variant!.id as number);
            return {
              lineId: item.lineId,
              reconciliation: {
                status: issue ? 'unavailable' : 'needs_review',
                message: issue?.message ?? apiError.message,
                checkedAt
              }
            };
          });
          reconcileItems(updates);
          setState({ quote: null, isLoading: false, error: apiError });
          return;
        }

        if (!isOrderQuote(payload)) {
          throw new Error('Strežnik je vrnil neveljaven izračun.');
        }

        const checkedAt = new Date().toISOString();
        const quoteByVariant = new Map(
          payload.items.map((item) => [item.variantId, item])
        );
        const updates: CartReconciliationUpdate[] = requestItems.map((item) => {
          const quoteItem = quoteByVariant.get(item.variant!.id as number);
          if (!quoteItem) {
            return {
              lineId: item.lineId,
              reconciliation: {
                status: 'unavailable',
                message: 'Artikel ni več v veljavnem izračunu.',
                checkedAt
              }
            };
          }

          const quotedUnitGross =
            quoteItem.quantity > 0 ? quoteItem.lineGross / quoteItem.quantity : 0;
          const previousGross = item.pricing?.quotedUnitGross;
          const priceChanged =
            typeof previousGross === 'number' &&
            Math.abs(previousGross - quotedUnitGross) > 0.005;

          return {
            lineId: item.lineId,
            pricing: {
              currency: 'EUR',
              taxRate: quoteItem.taxRate,
              baseUnitNet: quoteItem.baseUnitNet,
              discountPct: quoteItem.discountPct,
              unitNet: quoteItem.unitNet,
              estimatedUnitGross: quotedUnitGross,
              quotedUnitGross,
              quotedAt: checkedAt
            },
            reconciliation: {
              status: priceChanged ? 'price_changed' : 'valid',
              message: priceChanged
                ? 'Cena je bila posodobljena po veljavnem ceniku.'
                : undefined,
              checkedAt,
              availableStock: quoteItem.availableStock,
              minOrder: quoteItem.minOrder
            }
          };
        });

        reconcileItems(updates);
        setState({ quote: payload, isLoading: false, error: null });
      } catch (error) {
        if (isRequestStale()) return;
        setState({
          quote: null,
          isLoading: false,
          error: {
            code: 'QUOTE_UNAVAILABLE',
            message:
              error instanceof Error
                ? error.message
                : 'Košarice trenutno ni mogoče preveriti.'
          }
        });
      }
    }, 180);

    return () => {
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [
    enabled,
    missingVariantKey,
    normalizedCustomerName,
    reconcileItems,
    requestKey
  ]);

  return { ...state, missingVariantLineIds };
}
