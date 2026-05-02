import { insertAuditEventForRequest } from '@/shared/server/audit';

export async function recordOrderDocumentAudit({
  request,
  orderId,
  orderNumber,
  documentId,
  documentType,
  filename,
  generated
}: {
  request: Request;
  orderId: number;
  orderNumber: string;
  documentId: number;
  documentType: string;
  filename: string;
  generated: boolean;
}) {
  await insertAuditEventForRequest(request, {
    entityType: 'order',
    entityId: String(orderId),
    entityLabel: `Naročilo ${orderNumber}`,
    action: 'uploaded',
    summary: `Naročilo ${orderNumber}: dokument dodan`,
    diff: {
      documents: {
        label: 'Dokumenti',
        added: [filename]
      }
    },
    metadata: {
      order_number: orderNumber,
      document_id: documentId,
      document_type: documentType,
      filename,
      generated
    }
  });
}
