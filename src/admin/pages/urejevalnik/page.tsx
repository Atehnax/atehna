import AdminOrderDocumentTemplateEditor from '@/admin/features/urejevalnik/components/AdminOrderDocumentTemplateEditor';
import {
  getOrderDocumentTemplatesConfig,
  withoutQuoteOfferTemplate
} from '@/shared/server/orderDocumentTemplates';
import { getPublishedSiteLogos } from '@/shared/server/logoLibrary';
import { isQuoteAdminEnabled } from '@/shared/server/quoteFeatureFlags';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Administracija urejevalnik dokumentov'
};

export default async function AdminDocumentEditorPage() {
  const quoteAdminEnabled = isQuoteAdminEnabled();
  const [initialConfig, initialLogoConfig] = await Promise.all([
    getOrderDocumentTemplatesConfig(),
    getPublishedSiteLogos()
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
