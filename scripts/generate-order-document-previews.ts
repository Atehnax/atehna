import fs from 'node:fs/promises';
import path from 'node:path';
import {
  DEFAULT_ORDER_DOCUMENT_TEMPLATES_CONFIG,
  ORDER_DOCUMENT_TEMPLATE_TYPES,
  type OrderDocumentTemplateType
} from '@/shared/domain/order/orderDocumentTemplates';
import { createOrderDocumentPreviewContext } from '@/shared/domain/order/orderDocumentPreview';
import { generateOrderPdf } from '@/shared/server/pdf';
import { cloneDefaultSiteLogoConfig } from '@/shared/domain/logo/siteLogo';

const filenames: Record<OrderDocumentTemplateType, string> = {
  order_summary: 'potrditev-narocila-preview.pdf',
  dobavnica: 'dobavnica-preview.pdf',
  predracun: 'predracun-preview.pdf',
  invoice: 'racun-preview.pdf'
};

async function main() {
  const outputDirectory = path.join(process.cwd(), 'output', 'pdf');
  await fs.mkdir(outputDirectory, { recursive: true });
  const logoConfig = cloneDefaultSiteLogoConfig();

  for (const type of ORDER_DOCUMENT_TEMPLATE_TYPES) {
    const preview = createOrderDocumentPreviewContext(type);
    const bytes = await generateOrderPdf({
      template: DEFAULT_ORDER_DOCUMENT_TEMPLATES_CONFIG.templates[type],
      ...preview,
      logoConfig
    });
    const outputPath = path.join(outputDirectory, filenames[type]);
    await fs.writeFile(outputPath, bytes);
    console.log(`${type}: ${outputPath}`);
  }
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
