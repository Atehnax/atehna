import { withAdminPage } from '@/shared/auth/adminPage';
import AdminPage from '@/admin/pages/artikli/page';

export * from '@/admin/pages/artikli/page';

export default withAdminPage(AdminPage);
