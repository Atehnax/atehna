export type PdfDocument = {
  id?: number;
  type: string;
  blob_url: string;
  filename: string;
  created_at: string;
};

export type PdfTypeKey =
  | 'order_summary'
  | 'predracun'
  | 'dobavnica'
  | 'invoice'
  | 'purchase_order';

export type GeneratePdfType = Exclude<PdfTypeKey, 'purchase_order'>;

export type PdfTypeConfig = {
  key: PdfTypeKey;
  label: string;
  canGenerate: boolean;
};

export type MenuPosition = {
  top: number;
  left: number;
};

export const pdfTypes: PdfTypeConfig[] = [
  { key: 'order_summary', label: 'Povzetek', canGenerate: true },
  { key: 'predracun', label: 'Predračun', canGenerate: true },
  { key: 'dobavnica', label: 'Dobavnica', canGenerate: true },
  { key: 'invoice', label: 'Račun', canGenerate: true },
  { key: 'purchase_order', label: 'Naročilnica', canGenerate: false }
];

export const routeMap: Record<GeneratePdfType, string> = {
  order_summary: 'generate-order-summary',
  predracun: 'generate-predracun',
  dobavnica: 'generate-dobavnica',
  invoice: 'generate-invoice'
};

export const normalizePdfType = (type: string): PdfTypeKey | null => {
  if (type === 'offer' || type === 'order_summary') return 'order_summary';
  if (type === 'predracun') return 'predracun';
  if (type === 'dobavnica') return 'dobavnica';
  if (type === 'invoice') return 'invoice';
  if (type === 'purchase_order') return 'purchase_order';
  return null;
};

export const isGenerateKey = (key: PdfTypeKey): key is GeneratePdfType => key !== 'purchase_order';

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

export const formatVersionCount = (count: number) => {
  if (count === 1) return '1 verzija';
  if (count === 2) return '2 verziji';
  if (count === 3 || count === 4) return `${count} verzije`;
  return `${count} verzij`;
};

export const clampValue = (value: number, minimum: number, maximum: number) =>
  Math.min(Math.max(value, minimum), maximum);

const badgeBaseClass =
  'relative inline-flex h-5 w-full items-center justify-center rounded-md border px-1 text-[10px] font-medium leading-none';

export const badgeAvailableClass = `${badgeBaseClass} border-slate-300 bg-slate-100 text-slate-700 transition hover:bg-slate-200`;
export const badgeMissingClass = `${badgeBaseClass} border-slate-200 bg-slate-50 text-slate-400`;

export const groupDocumentsByType = (
  documents: PdfDocument[],
  attachments: PdfDocument[]
): Record<PdfTypeKey, PdfDocument[]> => {
  const grouped: Record<PdfTypeKey, PdfDocument[]> = {
    order_summary: [],
    predracun: [],
    dobavnica: [],
    invoice: [],
    purchase_order: []
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
