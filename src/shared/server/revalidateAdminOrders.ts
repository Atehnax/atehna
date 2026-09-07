import { revalidatePath } from '@/shared/server/diagnostics/cache';

export function revalidateAdminOrderPaths(orderId?: number) {
  revalidatePath('/admin/orders');
  revalidatePath('/admin/arhiv');
  revalidatePath('/admin/trash');
  revalidatePath('/admin/dnevnik');
  revalidatePath('/admin/analitika');

  if (typeof orderId === 'number' && Number.isFinite(orderId)) {
    revalidatePath(`/admin/orders/${orderId}`);
    revalidatePath('/admin/orders/[orderId]', 'page');
  }
}
