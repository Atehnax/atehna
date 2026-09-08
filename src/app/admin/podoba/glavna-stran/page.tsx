import { withAdminPage } from '@/shared/auth/adminPage';
import AdminPage from '@/admin/pages/podoba/glavna-stran/page';

export * from '@/admin/pages/podoba/glavna-stran/page';

export default withAdminPage(AdminPage);
