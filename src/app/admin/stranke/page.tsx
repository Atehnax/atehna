import { withAdminPage } from '@/shared/auth/adminPage';
import AdminPage from '@/admin/pages/stranke/page';

export * from '@/admin/pages/stranke/page';

export default withAdminPage(AdminPage);
