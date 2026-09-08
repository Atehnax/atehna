import { withAdminPage } from '@/shared/auth/adminPage';
import AdminPage from '@/admin/pages/orders/page';

export * from '@/admin/pages/orders/page';

export default withAdminPage(AdminPage);
