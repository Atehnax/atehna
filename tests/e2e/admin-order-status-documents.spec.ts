import { randomUUID } from 'node:crypto';
import { expect, test, type APIResponse } from '@playwright/test';
import { PDFDocument } from 'pdf-lib';
import { assertAuthenticatedAdmin } from './support/auth';

async function requireOk(response: APIResponse) {
  expect(response.ok(), await response.text()).toBe(true);
  return response.json();
}

test.beforeEach(async ({ request }) => assertAuthenticatedAdmin(request));

test('status changes identify required PDFs and current orders reject opaque invoice uploads', async ({ request }) => {
  const created = await requireOk(await request.post('/api/admin/orders'));
  const orderId = Number(created.orderId);
  try {
    for (const status of ['partially_sent', 'sent', 'finished']) {
      const response = await request.post(`/api/admin/orders/${orderId}/status`, { data: { status } });
      expect(response.status()).toBe(409);
      expect(await response.json()).toMatchObject({
        code: 'ORDER_STATUS_DOCUMENTS_REQUIRED',
        missingDocumentTypes: status === 'finished' ? ['dobavnica', 'invoice'] : ['dobavnica', 'predracun']
      });
    }
    const pdf = await PDFDocument.create(); pdf.addPage();
    const response = await request.post(`/api/admin/orders/${orderId}/documents`, { multipart: {
      type: 'invoice', file: { name: 'invoice.pdf', mimeType: 'application/pdf', buffer: Buffer.from(await pdf.save()) }
    } });
    expect(response.status()).toBe(400);
    expect((await response.json()).message).toContain('samo za zgodovinsko naročilo');
  } finally {
    await requireOk(await request.delete(`/api/admin/orders/${orderId}`));
  }
});

test('historical source invoice upload unlocks completion and survives source amount correction', async ({ request }) => {
  const created = await requireOk(await request.post('/api/admin/orders', { data: {
    isHistorical: true, orderDate: '2018-03-10', originalReferenceSystem: 'E2E PDF requirements', originalReference: randomUUID()
  } }));
  const orderId = Number(created.orderId);
  try {
    const items = await requireOk(await request.post(`/api/admin/orders/${orderId}/items`, { data: {
      expectedHistoricalRevision: '0', expectedPricingRevision: 1,
      items: [{ sku: 'E2E-HISTORICAL-INVOICE', name: 'Source invoice item', unit: 'kos', quantity: 1, unitPrice: 10, discountPercentage: 0 }]
    } }));
    const details = {
      expectedHistoricalRevision: String(items.historicalRevision), expectedPricingRevision: Number(items.pricingRevision),
      customerType: 'school', organizationName: 'E2E school source invoice', contactName: 'Ana Novak',
      historicalStatus: 'finished', historicalPaymentStatus: 'paid', historicalShippingGross: '3.00', historicalComplete: true
    };
    const blocked = await request.post(`/api/admin/orders/${orderId}/details`, { data: details });
    expect(blocked.status()).toBe(409);
    expect(await blocked.json()).toMatchObject({ code: 'ORDER_STATUS_DOCUMENTS_REQUIRED', missingDocumentTypes: ['invoice'] });
    const invalid = await request.post(`/api/admin/orders/${orderId}/documents`, { multipart: {
      type: 'invoice', file: { name: 'invoice.pdf', mimeType: 'application/pdf', buffer: Buffer.from('not a PDF') }
    } });
    expect(invalid.status()).toBe(400);
    const pdf = await PDFDocument.create(); pdf.addPage();
    const bytes = Buffer.from(await pdf.save());
    const uploaded = await requireOk(await request.post(`/api/admin/orders/${orderId}/documents`, { multipart: {
      type: 'invoice', file: { name: 'source-invoice.pdf', mimeType: 'application/pdf', buffer: bytes }
    } }));
    expect(uploaded).toMatchObject({ type: 'invoice', url: expect.stringContaining(`/api/admin/orders/${orderId}/documents/`) });
    const completed = await requireOk(await request.post(`/api/admin/orders/${orderId}/details`, { data: details }));
    expect(completed.isDraft).toBe(false);
    // Completion changed source shipping, hence pricing revision, but the original invoice stays accessible.
    expect(completed.pricingRevision).toBeGreaterThan(Number(items.pricingRevision));
    const download = await request.get(uploaded.url);
    expect(download.status()).toBe(200);
    expect(download.headers()['content-type']).toBe('application/pdf');
    expect(await download.body()).toEqual(bytes);
    const correction = await requireOk(await request.post(`/api/admin/orders/${orderId}/details`, { data: {
      expectedHistoricalRevision: completed.historicalRevision, historicalNotes: 'Verified source invoice'
    } }));
    expect(correction.isDraft).toBe(false);
  } finally {
    await requireOk(await request.delete(`/api/admin/orders/${orderId}`));
  }
});
