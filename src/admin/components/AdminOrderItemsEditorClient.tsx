'use client';

import dynamic from 'next/dynamic';
import { AdminOrderItemsSectionSkeleton } from '@/admin/components/AdminPageSkeletons';
import type { OrderItemInput } from '@/shared/domain/order/orderTypes';

const AdminOrderItemsEditor = dynamic(() => import('@/admin/components/AdminOrderItemsEditor'), {
  ssr: false,
  loading: () => <AdminOrderItemsSectionSkeleton />
});

export default function AdminOrderItemsEditorClient(props: {
  orderId: number;
  items: OrderItemInput[];
  initialSubtotal?: number;
  initialTax?: number;
  initialTotal?: number;
  externalEditMode?: boolean;
  hideSectionEditControls?: boolean;
  onDirtyChange?: (isDirty: boolean) => void;
  onSavingChange?: (isSaving: boolean) => void;
  onRegisterSave?: (handler: () => Promise<boolean>) => void | (() => void);
}) {
  return <AdminOrderItemsEditor {...props} />;
}
