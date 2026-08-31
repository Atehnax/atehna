/**
 * Backward-compatible endpoint. Despite its historical URL, this returns only
 * a live checkout estimate and never creates an immutable seller offer.
 */
export { POST, runtime } from '@/commercial/api/orders/estimate/route';
