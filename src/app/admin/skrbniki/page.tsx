import AdminAccountSettingsPage from '@/admin/pages/skrbniki/page';
import { withAdminPage } from '@/shared/auth/adminPage';

export { metadata } from '@/admin/pages/skrbniki/page';
export const dynamic = 'force-dynamic';
export default withAdminPage(AdminAccountSettingsPage);
