import { withAdminPage } from '@/shared/auth/adminPage';
import AdminPage from '@/admin/pages/analitika/page';

export * from '@/admin/pages/analitika/page';

export default withAdminPage(AdminPage);
