import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';
import { documentTypeOptions } from '../../src/admin/features/orders/components/adminOrdersTableUtils';
import {
  ORDER_PDF_TYPE_CONFIGS,
  normalizeOrderPdfFilenameForPresentation
} from '../../src/shared/domain/order/orderTypes';
import {
  buildGeneratedPdfFileName,
  buildOrderDocumentNumber
} from '../../src/shared/server/pdfGeneration';

const ISSUED_AT = new Date('2026-08-25T10:00:00.000Z');

test('order confirmations consistently use the PN abbreviation in admin and generated names', () => {
  const sharedConfig = ORDER_PDF_TYPE_CONFIGS.find(
    (documentType) => documentType.key === 'order_summary'
  );
  const adminOption = documentTypeOptions.find(
    (documentType) => documentType.value === 'order_summary'
  );

  assert.equal(sharedConfig?.shortLabel, 'PN');
  assert.equal(adminOption?.label, 'Potrditev naročila (PN)');
  assert.match(
    buildGeneratedPdfFileName('order_summary', ISSUED_AT),
    /^PN-20260825-[A-Z0-9_-]{18}\.pdf$/u
  );
  assert.equal(
    buildOrderDocumentNumber('order_summary', 2, 'ABC12345', ISSUED_AT),
    'PN-20260825-ABC12345-V2'
  );
});

test('legacy POT filenames are presented as PN only for order confirmations', () => {
  assert.equal(
    normalizeOrderPdfFilenameForPresentation(
      'order_summary',
      'POT-20260825-KNVZ89KGML_Z4MFWBL.pdf'
    ),
    'PN-20260825-KNVZ89KGML_Z4MFWBL.pdf'
  );
  assert.equal(
    normalizeOrderPdfFilenameForPresentation('order_summary', 'PN-20260825-NEW.pdf'),
    'PN-20260825-NEW.pdf'
  );
  assert.equal(
    normalizeOrderPdfFilenameForPresentation('invoice', 'POT-20260825-UNRELATED.pdf'),
    'POT-20260825-UNRELATED.pdf'
  );
  assert.equal(
    normalizeOrderPdfFilenameForPresentation('order_summary', 'archive/POT-20260825-OLD.pdf'),
    'archive/POT-20260825-OLD.pdf'
  );
});

test('admin presentation boundaries normalize filenames without rewriting private blob paths', () => {
  const ordersSource = readFileSync(resolve(process.cwd(), 'src/shared/server/orders.ts'), 'utf8');
  const documentRouteSource = readFileSync(
    resolve(
      process.cwd(),
      'src/admin/api/orders/[orderId]/documents/[documentId]/route.ts'
    ),
    'utf8'
  );
  const bulkDownloadSource = readFileSync(
    resolve(process.cwd(), 'src/admin/api/orders/download/route.ts'),
    'utf8'
  );

  assert.match(
    ordersSource,
    /filename: normalizeOrderPdfFilenameForPresentation\(type, String\(rawRow\.filename\)\)/u
  );
  assert.match(
    ordersSource,
    /filename: normalizeOrderPdfFilenameForPresentation\(type, String\(row\.filename\)\)/u
  );
  assert.match(
    documentRouteSource,
    /normalizeOrderPdfFilenameForPresentation\(\s*document\.type,\s*document\.filename\s*\)/u
  );
  assert.match(
    documentRouteSource,
    /readPrivateOrderDocumentBlob\(document\.blob_pathname\)/u
  );
  assert.match(
    bulkDownloadSource,
    /filename: normalizeOrderPdfFilenameForPresentation\(row\.type, row\.filename\)/u
  );
});
