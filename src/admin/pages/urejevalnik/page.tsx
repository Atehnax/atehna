import AdminOrderDocumentTemplateEditor from '@/admin/features/urejevalnik/components/AdminOrderDocumentTemplateEditor';
import { getOrderDocumentTemplatesConfig } from '@/shared/server/orderDocumentTemplates';
import { getSiteLogoConfig } from '@/shared/server/siteLogo';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Administracija urejevalnik dokumentov'
};

export default async function AdminDocumentEditorPage() {
  const [initialConfig, initialLogoConfig] = await Promise.all([
    getOrderDocumentTemplatesConfig(),
    getSiteLogoConfig()
  ]);

  return (
    <AdminOrderDocumentTemplateEditor
      initialConfig={initialConfig}
      initialLogoConfig={initialLogoConfig}
    />
  );
}
