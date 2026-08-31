import AdminOrderDocumentTemplateEditor from '@/admin/features/urejevalnik/components/AdminOrderDocumentTemplateEditor';
import {
  getOrderDocumentTemplatesConfig,
  withoutQuoteOfferTemplate
} from '@/shared/server/orderDocumentTemplates';
import { getSiteLogoConfig } from '@/shared/server/siteLogo';
import { isQuoteAdminEnabled } from '@/shared/server/quoteFeatureFlags';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Administracija urejevalnik dokumentov'
};

export default async function AdminDocumentEditorPage() {
  const quoteAdminEnabled = isQuoteAdminEnabled();
  const [initialConfig, initialLogoConfig] = await Promise.all([
    getOrderDocumentTemplatesConfig(),
    getSiteLogoConfig()
  ]);

  return (
    <AdminOrderDocumentTemplateEditor
      initialConfig={
        quoteAdminEnabled
          ? initialConfig
          : withoutQuoteOfferTemplate(initialConfig)
      }
      initialLogoConfig={initialLogoConfig}
      quoteOfferTemplateEnabled={quoteAdminEnabled}
    />
  );
}
