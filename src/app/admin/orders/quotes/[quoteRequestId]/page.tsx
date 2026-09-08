import { withAdminPage } from '@/shared/auth/adminPage';
import AdminPage from '@/admin/pages/orders/quotes/[quoteRequestId]/page';

export const dynamic = 'force-dynamic';

export { metadata } from '@/admin/pages/orders/quotes/[quoteRequestId]/page';

export default withAdminPage(AdminPage);
