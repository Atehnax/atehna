import { withAdminPage } from '@/shared/auth/adminPage';
import AdminPage from '@/admin/pages/dnevnik/page';

export * from '@/admin/pages/dnevnik/page';

export default withAdminPage(AdminPage);
