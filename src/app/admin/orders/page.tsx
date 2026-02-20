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
import { fetchGlobalAnalyticsAppearance, type AnalyticsGlobalAppearance } from '@/lib/server/analyticsCharts';

export const metadata = {
  title: 'Pregled naročil'
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

  const fallbackAppearance: AnalyticsGlobalAppearance = {
    sectionBg: '#f1f0ec',
    canvasBg: '#ffffff',
    cardBg: '#ffffff',
    plotBg: '#ffffff',
    axisTextColor: '#111827',
    seriesPalette: ['#65c8cc', '#5fb6ba', '#7a8f6a', '#b08968', '#a24a45'],
    gridColor: '#d8d6cf',
    gridOpacity: 0.35
  };
  let analyticsAppearance = fallbackAppearance;


  if (!getDatabaseUrl()) {
    warningMessage = 'Povezava z bazo ni nastavljena — prikazan je demo pogled.';
  } else {
    try {
      // Always load the full active dataset on the server and let the table apply
      // date/search/document filters client-side. This avoids accidental empty states
      // caused by stale URL params or server-side filter drift.
      orders = await fetchOrders({ includeDrafts: true });
      analyticsAppearance = await fetchGlobalAnalyticsAppearance('narocila').catch(() => fallbackAppearance);
      console.info(`/admin/orders loaded rows=${orders.length}`);

      const orderIds = orders.map((order) => order.id);
      const [documentsResult, attachmentsResult] = await Promise.allSettled([
        fetchOrderDocumentsForOrders(orderIds),
        fetchOrderAttachmentsForOrders(orderIds)
      ]);

      if (documentsResult.status === 'fulfilled') {
        documents = documentsResult.value;
      } else {
        console.error('Failed to load /admin/orders documents', documentsResult.reason);
        warningMessage =
          warningMessage ?? 'Nekaterih dokumentov ni bilo mogoče naložiti. Naročila so vseeno prikazana.';
      }

      if (attachmentsResult.status === 'fulfilled') {
        attachments = attachmentsResult.value;
      } else {
        console.error('Failed to load /admin/orders attachments', attachmentsResult.reason);
        warningMessage =
          warningMessage ?? 'Nekaterih priponk ni bilo mogoče naložiti. Naročila so vseeno prikazana.';
      }
    } catch (error) {
      console.error('Failed to load /admin/orders data', error);
      warningMessage =
        'Podatkov trenutno ni mogoče naložiti. Prikazan je demo pogled, dokler povezava z bazo ne deluje.';
    }
  }

  return (
    <div className="w-full">
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">Pregled naročil</h1>
            <p className="mt-1 text-sm text-slate-500">Pregled in urejanje naročil.</p>
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
          analyticsAppearance={analyticsAppearance}
        />
      </div>
    </div>
  );
}
