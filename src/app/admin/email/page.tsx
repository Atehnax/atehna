import { withAdminPage } from '@/shared/auth/adminPage';
import AdminPage from '@/admin/pages/email/page';

export * from '@/admin/pages/email/page';

export default withAdminPage(AdminPage);
