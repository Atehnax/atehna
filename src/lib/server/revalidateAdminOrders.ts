import { revalidatePath } from 'next/cache';

export function revalidateAdminOrderPaths(orderId?: number) {
  revalidatePath('/admin/orders');
  revalidatePath('/admin/arhiv-izbrisanih');

  if (typeof orderId === 'number' && Number.isFinite(orderId)) {
    revalidatePath(`/admin/orders/${orderId}`);
    revalidatePath('/admin/orders/[orderId]', 'page');
  }
}
