'use client';

import dynamic from 'next/dynamic';
import { AdminOrderItemsSectionSkeleton } from '@/admin/components/AdminPageSkeletons';
import type { OrderItemInput } from '@/shared/domain/order/orderTypes';

const AdminOrderItemsEditor = dynamic(() => import('@/admin/features/orders/components/AdminOrderItemsEditor'), {
  ssr: false,
  loading: () => <AdminOrderItemsSectionSkeleton />
});

export default function AdminOrderItemsEditorClient(props: {
  orderId: number;
  items: OrderItemInput[];
  initialSubtotal?: number;
  initialTax?: number;
  initialShipping?: number;
  initialShippingOverride?: boolean;
  initialShippingOverrideStale?: boolean;
  initialShippingManualQuote?: boolean;
  initialTaxRate?: number;
  externalEditMode?: boolean;
  hideSectionEditControls?: boolean;
  onRequestEdit?: () => void;
  sectionEditDisabled?: boolean;
  onDirtyChange?: (isDirty: boolean) => void;
  onSavingChange?: (isSaving: boolean) => void;
  onRegisterSave?: (handler: () => Promise<boolean>) => void | (() => void);
  onPricingRevisionChange?: (pricingRevision: number) => void;
}) {
  return <AdminOrderItemsEditor {...props} />;
}
