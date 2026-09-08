import { withAdminPage } from '@/shared/auth/adminPage';
import AdminPage from '@/admin/pages/kategorije/page';

export * from '@/admin/pages/kategorije/page';

export default withAdminPage(AdminPage);
