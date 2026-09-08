import { withAdminPage } from '@/shared/auth/adminPage';
import AdminPage from '@/admin/pages/orders/[orderId]/page';

export * from '@/admin/pages/orders/[orderId]/page';

export default withAdminPage(AdminPage);
