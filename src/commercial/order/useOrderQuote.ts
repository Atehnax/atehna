'use client';

import type { CartItem } from '@/commercial/cart/cartTypes';
import {
  buildOrderEstimateRequestKey,
  normalizeOrderEstimateCustomerLabels,
  normalizeOrderEstimateCustomerName,
  useOrderEstimate,
  type OrderEstimateState
} from '@/commercial/order/useOrderEstimate';

/** @deprecated Use OrderEstimateState. */
export type OrderQuoteState = OrderEstimateState;

/** @deprecated Use normalizeOrderEstimateCustomerName. */
export const normalizeOrderQuoteCustomerName = normalizeOrderEstimateCustomerName;
/** @deprecated Use normalizeOrderEstimateCustomerLabels. */
export const normalizeOrderQuoteCustomerLabels = normalizeOrderEstimateCustomerLabels;
/** @deprecated Use buildOrderEstimateRequestKey. */
export const buildOrderQuoteRequestKey = buildOrderEstimateRequestKey;

/** @deprecated Use useOrderEstimate. */
export function useOrderQuote(
  items: CartItem[],
  enabled = true,
  customerName?: string,
  customerLabels?: readonly string[]
): OrderQuoteState {
  return useOrderEstimate(items, enabled, customerName, customerLabels);
}
