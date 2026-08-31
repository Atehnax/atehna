import { revalidatePath } from 'next/cache';

export function revalidateAdminQuotePaths(quoteRequestId?: number) {
  revalidatePath('/admin/orders');
  revalidatePath('/admin/analitika');
  revalidatePath('/admin/analitika/ponudbe');

  if (typeof quoteRequestId === 'number' && Number.isSafeInteger(quoteRequestId)) {
    revalidatePath(`/admin/orders/quotes/${quoteRequestId}`);
    revalidatePath('/admin/orders/quotes/[quoteRequestId]', 'page');
  }
}
