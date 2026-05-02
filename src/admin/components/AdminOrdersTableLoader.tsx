import AdminOrdersTable from '@/admin/components/AdminOrdersTable';
import type { AnalyticsGlobalAppearance } from '@/shared/server/analyticsCharts';
import type { AdminOrderPdfDocumentTuple, AdminOrderRowTuple } from '@/shared/domain/order/orderTypes';

export default function AdminOrdersTableLoader(props: {
  orders: ReadonlyArray<AdminOrderRowTuple>;
  analyticsOrders?: ReadonlyArray<AdminOrderRowTuple>;
  documents: ReadonlyArray<AdminOrderPdfDocumentTuple>;
  initialFrom?: string;
  initialTo?: string;
  initialQuery?: string;
  initialStatusFilter?: string;
  initialDocumentType?: string;
  initialPage?: number;
  initialPageSize?: number;
  totalCount?: number;
  topAction?: React.ReactNode;
  analyticsAppearance?: AnalyticsGlobalAppearance;
}) {
  return <AdminOrdersTable {...props} />;
}
