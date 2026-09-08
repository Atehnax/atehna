import { withAdminPage } from '@/shared/auth/adminPage';
import AdminPage from '@/admin/pages/arhiv/page';

export * from '@/admin/pages/arhiv/page';

export default withAdminPage(AdminPage);
