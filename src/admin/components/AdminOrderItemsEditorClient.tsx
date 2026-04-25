'use client';

import dynamic from 'next/dynamic';
import { AdminOrderItemsSectionSkeleton } from '@/admin/components/AdminPageSkeletons';

type OrderItemInput = {
  id: number;
  sku: string;
  name: string;
  unit: string | null;
  quantity: number;
  unit_price: number | null;
  discount_percentage?: number;
};

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
