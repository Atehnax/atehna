export type PdfDocument = {
  id?: number;
  type: string;
  blob_url: string;
  filename: string;
  created_at: string;
};

export type PdfTypeKey =
  | 'order_summary'
  | 'purchase_order'
  | 'dobavnica'
  | 'predracun'
  | 'invoice';

export type GeneratePdfType = PdfTypeKey;

export type PdfTypeConfig = {
  key: PdfTypeKey;
  label: string;
  canGenerate: boolean;
};

export const pdfTypes: PdfTypeConfig[] = [
  { key: 'order_summary', label: 'Povzetek', canGenerate: true },
  { key: 'purchase_order', label: 'Naročilnica', canGenerate: true },
  { key: 'dobavnica', label: 'Dobavnica', canGenerate: true },
  { key: 'predracun', label: 'Predračun', canGenerate: true },
  { key: 'invoice', label: 'Račun', canGenerate: true }
];

export const routeMap: Record<GeneratePdfType, string> = {
  order_summary: 'generate-order-summary',
  purchase_order: 'generate-purchase-order',
  predracun: 'generate-predracun',
  dobavnica: 'generate-dobavnica',
  invoice: 'generate-invoice'
};

export const normalizePdfType = (type: string): PdfTypeKey | null => {
  if (type === 'offer' || type === 'order_summary') return 'order_summary';
  if (type === 'purchase_order') return 'purchase_order';
  if (type === 'predracun') return 'predracun';
  if (type === 'dobavnica') return 'dobavnica';
  if (type === 'invoice') return 'invoice';
  return null;
};

export const isGenerateKey = (key: PdfTypeKey): key is GeneratePdfType => Boolean(key);

const padTwoDigits = (value: number) => String(value).padStart(2, '0');

export const formatDateTimeCompact = (value: string) => {
  const parsedDate = new Date(value);
  if (Number.isNaN(parsedDate.getTime())) return value;

  const day = padTwoDigits(parsedDate.getDate());
  const month = padTwoDigits(parsedDate.getMonth() + 1);
  const year = parsedDate.getFullYear();
  const hour = padTwoDigits(parsedDate.getHours());
  const minute = padTwoDigits(parsedDate.getMinutes());

  return `${day}.${month}.${year} ${hour}:${minute}`;
};

export const groupDocumentsByType = (
  documents: PdfDocument[],
  attachments: PdfDocument[]
): Record<PdfTypeKey, PdfDocument[]> => {
  const grouped: Record<PdfTypeKey, PdfDocument[]> = {
    order_summary: [],
    purchase_order: [],
    dobavnica: [],
    predracun: [],
    invoice: []
  };

  const sortedDocuments = [...documents].sort(
    (leftDocument, rightDocument) =>
      new Date(rightDocument.created_at).getTime() - new Date(leftDocument.created_at).getTime()
  );

  sortedDocuments.forEach((documentItem) => {
    const normalizedType = normalizePdfType(documentItem.type);
    if (!normalizedType) return;
    grouped[normalizedType].push(documentItem);
  });

  const sortedAttachments = [...attachments].sort(
    (leftAttachment, rightAttachment) =>
      new Date(rightAttachment.created_at).getTime() - new Date(leftAttachment.created_at).getTime()
  );

  sortedAttachments.forEach((attachmentItem) => {
    grouped.purchase_order.push(attachmentItem);
  });

  return grouped;
};
