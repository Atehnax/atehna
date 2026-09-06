import { NextResponse } from 'next/server';
import {
  isOrderDocumentTemplateType,
  normalizeOrderDocumentTemplate
} from '@/shared/domain/order/orderDocumentTemplates';
import { createOrderDocumentPreviewContext } from '@/shared/domain/order/orderDocumentPreview';
import { generateOrderPdfPreview } from '@/shared/server/pdf';
import { readRequiredJsonRecord } from '@/shared/server/requestJson';
import { getDocumentLogoArtwork } from '@/shared/server/documentLogo';
import { isQuoteAdminEnabled } from '@/shared/server/quoteFeatureFlags';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(request: Request) {
  try {
    const body = await readRequiredJsonRecord(request);
    if (!body.ok) return body.response;
    const type = body.body.type;
    if (!isOrderDocumentTemplateType(type)) {
      return NextResponse.json(
        { message: 'Vrsta predloge PDF ni veljavna.' },
        { status: 400 }
      );
    }
    if (type === 'offer' && !isQuoteAdminEnabled()) {
      return NextResponse.json(
        { message: 'Ponudbe niso omogočene.' },
        { status: 404 }
      );
    }
    const template = normalizeOrderDocumentTemplate(type, body.body.template);
    const logoArtwork = await getDocumentLogoArtwork();
    const preview = createOrderDocumentPreviewContext(type);
    const rendered = await generateOrderPdfPreview({
      template,
      ...preview,
      logoArtwork
    });
    if (body.body.includeLayout === true) {
      return NextResponse.json({
        pdfBase64: Buffer.from(rendered.pdf).toString('base64'),
        layout: rendered.layout
      }, { headers: { 'Cache-Control': 'no-store, private', 'X-Content-Type-Options': 'nosniff' } });
    }
    return new Response(Buffer.from(rendered.pdf), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="preview-${type}.pdf"`,
        'Cache-Control': 'no-store, private',
        'X-Content-Type-Options': 'nosniff'
      }
    });
  } catch (error) {
    console.error('Failed to generate order document template preview', error);
    return NextResponse.json(
      { message: 'Predogleda PDF ni bilo mogoče ustvariti.' },
      { status: 500 }
    );
  }
}
