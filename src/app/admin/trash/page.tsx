import { withAdminPage } from '@/shared/auth/adminPage';
import AdminPage from '@/admin/pages/trash/page';

export * from '@/admin/pages/trash/page';

export default withAdminPage(AdminPage);
