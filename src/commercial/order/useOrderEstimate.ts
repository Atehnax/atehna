'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useCartStore } from '@/commercial/cart/store';
import type { CartItem, CartReconciliationUpdate } from '@/commercial/cart/cartTypes';
import {
  isOrderEstimate,
  parseOrderApiError,
  type OrderApiError,
  type OrderEstimate
} from '@/commercial/order/contracts';
import { readJsonResponse } from '@/shared/client/readJsonResponse';

export type OrderEstimateState = {
  estimate: OrderEstimate | null;
  /** @deprecated Use estimate. */
  quote: OrderEstimate | null;
  isLoading: boolean;
  error: OrderApiError | null;
  missingVariantLineIds: string[];
  refresh: () => void;
};

export const normalizeOrderEstimateCustomerName = (customerName?: string) =>
  customerName?.trim() ?? '';

export const normalizeOrderEstimateCustomerLabels = (
  customerName?: string,
  customerLabels: readonly string[] = []
) =>
  Array.from(
    new Set(
      [customerName, ...customerLabels]
        .map((label) => label?.trim().toLocaleLowerCase('sl-SI') ?? '')
        .filter(Boolean)
    )
  ).sort();

export const buildOrderEstimateRequestKey = (
  items: CartItem[],
  customerName?: string,
  customerLabels: readonly string[] = []
) => {
  if (items.length === 0) return '';

  return JSON.stringify({
    customerName: normalizeOrderEstimateCustomerName(customerName),
    customerLabels: normalizeOrderEstimateCustomerLabels(
      customerName,
      customerLabels
    ),
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

export function useOrderEstimate(
  items: CartItem[],
  enabled = true,
  customerName?: string,
  customerLabels?: readonly string[]
): OrderEstimateState {
  const reconcileItems = useCartStore((state) => state.reconcileItems);
  const normalizedCustomerName = normalizeOrderEstimateCustomerName(customerName);
  const normalizedCustomerLabels = useMemo(
    () =>
      normalizeOrderEstimateCustomerLabels(
        normalizedCustomerName,
        customerLabels
      ),
    [customerLabels, normalizedCustomerName]
  );
  const requestKey = useMemo(
    () =>
      buildOrderEstimateRequestKey(
        items,
        normalizedCustomerName,
        normalizedCustomerLabels
      ),
    [items, normalizedCustomerLabels, normalizedCustomerName]
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
  const [state, setState] = useState<{
    estimate: OrderEstimate | null;
    isLoading: boolean;
    error: OrderApiError | null;
  }>({
    estimate: null,
    isLoading: false,
    error: null
  });
  const [refreshCounter, setRefreshCounter] = useState(0);
  const refresh = useCallback(() => {
    setRefreshCounter((current) => current + 1);
  }, []);

  useEffect(() => {
    if (!enabled || requestKey.length === 0) {
      setState({ estimate: null, isLoading: false, error: null });
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
        estimate: null,
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
    setState({ estimate: null, isLoading: true, error: null });
    const timeout = window.setTimeout(async () => {
      if (isRequestStale()) return;

      try {
        const response = await fetch('/api/orders/estimate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            customerName: normalizedCustomerName,
            customerLabels: normalizedCustomerLabels,
            items: requestItems.map((item) => ({
              variantId: item.variant!.id,
              quantity: item.quantity
            }))
          }),
          signal: controller.signal
        });

        const payload: unknown = await readJsonResponse(response, {});
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
          setState({ estimate: null, isLoading: false, error: apiError });
          return;
        }

        if (!isOrderEstimate(payload)) {
          throw new Error('Strežnik je vrnil neveljaven izračun.');
        }

        const checkedAt = new Date().toISOString();
        const estimateByVariant = new Map(
          payload.items.map((item) => [item.variantId, item])
        );
        const updates: CartReconciliationUpdate[] = requestItems.map((item) => {
          const estimateItem = estimateByVariant.get(item.variant!.id as number);
          if (!estimateItem) {
            return {
              lineId: item.lineId,
              reconciliation: {
                status: 'unavailable',
                message: 'Artikel ni več v veljavnem izračunu.',
                checkedAt
              }
            };
          }

          const estimatedUnitGross =
            estimateItem.quantity > 0
              ? estimateItem.lineGross / estimateItem.quantity
              : 0;
          const previousGross = item.pricing?.quotedUnitGross;
          const priceChanged =
            typeof previousGross === 'number' &&
            Math.abs(previousGross - estimatedUnitGross) > 0.005;

          return {
            lineId: item.lineId,
            pricing: {
              currency: 'EUR',
              taxRate: estimateItem.taxRate,
              baseUnitNet: estimateItem.baseUnitNet,
              discountPct: estimateItem.discountPct,
              unitNet: estimateItem.unitNet,
              estimatedUnitGross,
              quotedUnitGross: estimatedUnitGross,
              quotedAt: checkedAt
            },
            reconciliation: {
              status: priceChanged ? 'price_changed' : 'valid',
              message: priceChanged
                ? 'Cena je bila posodobljena po veljavnem ceniku.'
                : undefined,
              checkedAt,
              availableStock: estimateItem.availableStock,
              minOrder: estimateItem.minOrder
            }
          };
        });

        reconcileItems(updates);
        setState({ estimate: payload, isLoading: false, error: null });
      } catch (error) {
        if (isRequestStale()) return;
        setState({
          estimate: null,
          isLoading: false,
          error: {
            code: 'ESTIMATE_UNAVAILABLE',
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
    normalizedCustomerLabels,
    normalizedCustomerName,
    reconcileItems,
    refreshCounter,
    requestKey
  ]);

  return {
    ...state,
    quote: state.estimate,
    missingVariantLineIds,
    refresh
  };
}
