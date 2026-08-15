import AdminOrdersTable from '@/admin/features/orders/components/AdminOrdersTable';
import type { AnalyticsGlobalAppearance } from '@/shared/server/analyticsCharts';
import type { AdminOrderAnalyticsTuple, AdminOrderPdfDocumentTuple, AdminOrderRowTuple } from '@/shared/domain/order/orderTypes';
import type { PageSizeValue } from '@/shared/domain/pagination';

export default function AdminOrdersTableLoader(props: {
  orders: ReadonlyArray<AdminOrderRowTuple>;
  analyticsOrders?: ReadonlyArray<AdminOrderAnalyticsTuple>;
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
  analyticsAppearance?: AnalyticsGlobalAppearance;
}) {
  return <AdminOrdersTable {...props} />;
}
