import type { BusinessOrderPreview } from '@/shared/domain/analytics/orderPreview';
import AdminOrdersTable from '@/admin/features/orders/components/AdminOrdersTable';
import type { AdminOrderPdfDocumentTuple, AdminOrderRowTuple } from '@/shared/domain/order/orderTypes';
import type { PageSizeValue } from '@/shared/domain/pagination';

export default function AdminOrdersTableLoader(props: {
  orders: ReadonlyArray<AdminOrderRowTuple>;
  orderPreview: BusinessOrderPreview | null;
  documents: ReadonlyArray<AdminOrderPdfDocumentTuple>;
  initialFrom?: string;
  initialTo?: string;
  initialQuery?: string;
  initialStatusFilter?: string;
  initialDocumentType?: string;
  initialPage?: number;
  initialPageSize?: PageSizeValue;
  totalCount?: number;
  topAction?: React.ReactNode;
}) {
  return <AdminOrdersTable {...props} />;
}
