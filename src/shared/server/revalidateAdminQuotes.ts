import { revalidatePath } from '@/shared/server/diagnostics/cache';

export function revalidateAdminQuotePaths(quoteRequestId?: number) {
  revalidatePath('/admin/orders');
  revalidatePath('/admin/analitika');

  if (typeof quoteRequestId === 'number' && Number.isSafeInteger(quoteRequestId)) {
    revalidatePath(`/admin/orders/quotes/${quoteRequestId}`);
    revalidatePath('/admin/orders/quotes/[quoteRequestId]', 'page');
  }
}
