export type OrderDeliveryPlanCounts = {
  currentItemCount: number;
  laterItemCount: number;
};

export type OrderDeliveryPlanValidation =
  | { ok: true }
  | {
      ok: false;
      code:
        | 'PARTIAL_DELIVERY_PLAN_REQUIRED'
        | 'DEFERRED_ITEMS_REMAIN';
      message: string;
    };

export function validateOrderDeliveryPlanForStatus(
  status: string,
  counts: OrderDeliveryPlanCounts
): OrderDeliveryPlanValidation {
  if (
    status === 'partially_sent' &&
    (counts.currentItemCount < 1 || counts.laterItemCount < 1)
  ) {
    return {
      ok: false,
      code: 'PARTIAL_DELIVERY_PLAN_REQUIRED',
      message:
        'Za status »Delno poslano« mora biti vsaj ena postavka v tej pošiljki in vsaj ena postavka označena za poznejšo dobavo.'
    };
  }

  if (
    (status === 'sent' || status === 'finished') &&
    counts.laterItemCount > 0
  ) {
    return {
      ok: false,
      code: 'DEFERRED_ITEMS_REMAIN',
      message:
        'Pred izbiro tega statusa premaknite vse postavke iz poznejše dobave v trenutno pošiljko.'
    };
  }

  return { ok: true };
}