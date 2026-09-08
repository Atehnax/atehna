import { withAdminPage } from '@/shared/auth/adminPage';
import AdminPage from '@/admin/pages/artikli/[articleId]/page';

export * from '@/admin/pages/artikli/[articleId]/page';

export default withAdminPage(AdminPage);
