import { getStatusLabel, isOrderStatus } from '@/lib/orderStatus';

export type OrderRow = {
  id: number;
  order_number: string;
  customer_type: string;
  organization_name: string | null;
  contact_name: string;
  status: string;
  payment_status?: string | null;
  total: number | string | null;
  created_at: string;
  delivery_address?: string | null;
  address_line1?: string | null;
  city?: string | null;
  postal_code?: string | null;
};

export type PdfDoc = {
  id: number;
  order_id: number;
  type: string;
  filename: string;
  blob_url: string;
  created_at: string;
};

export type Attachment = {
  id: number;
  order_id: number;
  type: string;
  filename: string;
  blob_url: string;
  created_at: string;
};

export type SortKey =
  | 'order_number'
  | 'customer'
  | 'address'
  | 'type'
  | 'status'
  | 'payment'
  | 'total'
  | 'created_at';

export type SortDirection = 'asc' | 'desc';

export type StatusTab =
  | 'all'
  | 'received'
  | 'in_progress'
  | 'partially_sent'
  | 'sent'
  | 'finished'
  | 'cancelled';

export type DocumentType =
  | 'all'
  | 'order_summary'
  | 'purchase_order'
  | 'dobavnica'
  | 'predracun'
  | 'invoice';

export type UnifiedDocument = {
  order_id: number;
  type: string;
  filename: string;
  blob_url: string;
  created_at: string;
  typeLabel: string;
};

export const documentTypeOptions: Array<{ value: DocumentType; label: string }> = [
  { value: 'all', label: 'Vse vrste' },
  { value: 'order_summary', label: 'Povzetek' },
  { value: 'purchase_order', label: 'Naročilnica' },
  { value: 'dobavnica', label: 'Dobavnica' },
  { value: 'predracun', label: 'Predračun' },
  { value: 'invoice', label: 'Račun' }
];

export const documentTypeLabelMap: Map<string, string> = new Map(
  documentTypeOptions.map((documentTypeOption) => [documentTypeOption.value, documentTypeOption.label])
);

export const statusTabs: Array<{ value: StatusTab; label: string }> = [
  { value: 'all', label: 'Vsa' },
  { value: 'received', label: 'Prejeto' },
  { value: 'in_progress', label: 'V obdelavi' },
  { value: 'partially_sent', label: 'Delno poslano' },
  { value: 'sent', label: 'Poslano' },
  { value: 'finished', label: 'Zaključeno' },
  { value: 'cancelled', label: 'Preklicano' }
];

export const columnWidths = {
  selectAndDelete: '40px',
  order: '75px',
  customer: '180px',
  address: '200px',
  type: '110px',
  status: '120px',
  payment: '120px',
  total: '85px',
  date: '104px',
  documents: '440px'
};

const currencyFormatter = new Intl.NumberFormat('sl-SI', {
  style: 'currency',
  currency: 'EUR'
});

export const textCollator = new Intl.Collator('sl', { sensitivity: 'base', numeric: true });

export const toAmount = (value: unknown): number => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;

  if (typeof value === 'string') {
    const normalizedValue = value.replace(',', '.').trim();
    const parsedValue = Number(normalizedValue);
    if (Number.isFinite(parsedValue)) return parsedValue;
  }

  return 0;
};

export const formatCurrency = (value: unknown) => currencyFormatter.format(toAmount(value));

export const getMergedOrderStatusValue = (status: string): StatusTab | 'unknown' =>
  isOrderStatus(status) ? status : 'unknown';

export const getOrderStatusLabelForUi = (status: string) => getStatusLabel(status);


export const toDisplayOrderNumber = (orderNumber: string) => {
  const trimmed = orderNumber.trim();
  if (!trimmed) return orderNumber;

  if (trimmed.startsWith('#')) return trimmed;

  const match = trimmed.match(/(?:N-|ORD-)?(\d+)$/i);
  if (match) return `#${match[1]}`;

  return trimmed;
};

export const formatOrderAddress = (order: OrderRow) => {
  const deliveryAddress = (order.delivery_address ?? '').trim();
  if (deliveryAddress) return deliveryAddress;

  const addressLine1 = (order.address_line1 ?? '').trim();
  const city = (order.city ?? '').trim();
  const postalCode = (order.postal_code ?? '').trim();

  const cityAndPostalCode = [postalCode, city].filter(Boolean).join(' ');
  return [addressLine1, cityAndPostalCode].filter(Boolean).join(', ');
};

export const normalizeForSearch = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

const padTwoDigits = (value: number) => String(value).padStart(2, '0');

export const toDateInputValue = (dateValue: Date) =>
  `${dateValue.getFullYear()}-${padTwoDigits(dateValue.getMonth() + 1)}-${padTwoDigits(
    dateValue.getDate()
  )}`;

export const shiftDateByDays = (dateValue: Date, dayShift: number) => {
  const clonedDate = new Date(dateValue);
  clonedDate.setDate(clonedDate.getDate() + dayShift);
  return clonedDate;
};
