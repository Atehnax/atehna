import AdminOrdersTable from '@/components/admin/AdminOrdersTable';
import AdminCreateDraftOrderButton from '@/components/admin/AdminCreateDraftOrderButton';
import {
  type OrderAttachmentRow,
  type OrderDocumentRow,
  type OrderRow,
  fetchOrderAttachmentsForOrders,
  fetchOrderDocumentsForOrders,
  fetchOrders
} from '@/lib/server/orders';
import { getDatabaseUrl } from '@/lib/server/db';

export const metadata = {
  title: 'Administracija naročil'
};

export const dynamic = 'force-dynamic';

const DATE_INPUT_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function normalizeSearchParam(value: string | string[] | undefined): string {
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) return value[0] ?? '';
  return '';
}

function normalizeDateInput(value: string): string {
  const trimmedValue = value.trim();
  if (!DATE_INPUT_PATTERN.test(trimmedValue)) return '';

  const parsedDate = new Date(`${trimmedValue}T00:00:00`);
  if (Number.isNaN(parsedDate.getTime())) return '';

  return trimmedValue;
}

const toIsoOrNull = (value: string) => {
  if (!value) return null;
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
};

const getToDateIsoOrNull = (value: string) => {
  if (!value) return null;
  const date = new Date(`${value}T23:59:59.999`);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
};

export default async function AdminOrdersPage({
  searchParams
}: {
  searchParams?: { from?: string | string[]; to?: string | string[]; q?: string | string[] };
}) {
  const from = normalizeDateInput(normalizeSearchParam(searchParams?.from));
  const to = normalizeDateInput(normalizeSearchParam(searchParams?.to));
  const query = normalizeSearchParam(searchParams?.q).trim();

  const demoOrders: OrderRow[] = [
    {
      id: 1,
      order_number: '#1',
      customer_type: 'school',
      organization_name: 'Osnovna šola Triglav',
      contact_name: 'Maja Kovač',
      email: 'maja.kovac@example.com',
      phone: '041 555 123',
      delivery_address: 'Šolska ulica 1, Ljubljana',
      reference: 'PO-2024-01',
      notes: null,
      status: 'received',
      payment_status: 'paid',
      payment_notes: null,
      subtotal: 0,
      tax: 0,
      total: 0,
      created_at: new Date().toISOString(),
      is_draft: false
    }
  ];

  const demoDocuments: OrderDocumentRow[] = [
    {
      id: 1,
      order_id: 1,
      type: 'order_summary',
      filename: '#1-order-summary.pdf',
      blob_url: '#',
      blob_pathname: null,
      created_at: new Date().toISOString()
    }
  ];

  const demoAttachments: OrderAttachmentRow[] = [
    {
      id: 1,
      order_id: 1,
      type: 'purchase_order',
      filename: '#1-narocilnica.pdf',
      blob_url: '#',
      created_at: new Date().toISOString()
    }
  ];

  let orders: OrderRow[] = demoOrders;
  let documents: OrderDocumentRow[] = demoDocuments;
  let attachments: OrderAttachmentRow[] = demoAttachments;
  let warningMessage: string | null = null;

  if (!getDatabaseUrl()) {
    warningMessage = 'Povezava z bazo ni nastavljena — prikazan je demo pogled.';
  } else {
    try {
      orders = await fetchOrders({
        fromDate: toIsoOrNull(from),
        toDate: getToDateIsoOrNull(to),
        query: query || null
      });

      const orderIds = orders.map((order) => order.id);
      [documents, attachments] = await Promise.all([
        fetchOrderDocumentsForOrders(orderIds),
        fetchOrderAttachmentsForOrders(orderIds)
      ]);
    } catch (error) {
      console.error('Failed to load /admin/orders data', error);
      warningMessage =
        'Podatkov trenutno ni mogoče naložiti. Prikazan je demo pogled, dokler povezava z bazo ne deluje.';
    }
  }

  return (
    <div className="w-full px-6 py-12">
      <div className="flex flex-col gap-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-3xl font-semibold text-slate-900">Administracija naročil</h1>
            <p className="mt-2 text-sm text-slate-600">
              Pregled oddanih naročil, statusov in dokumentov.
            </p>
          </div>
        </div>

        {warningMessage ? (
          <div className="rounded-2xl border border-dashed border-amber-200 bg-amber-50 p-6 text-sm text-amber-700">
            {warningMessage}
          </div>
        ) : null}

        <AdminOrdersTable
          orders={orders}
          documents={documents}
          attachments={attachments}
          initialFrom={from}
          initialTo={to}
          initialQuery={query}
          topAction={<AdminCreateDraftOrderButton />}
        />
      </div>
    </div>
  );
}
