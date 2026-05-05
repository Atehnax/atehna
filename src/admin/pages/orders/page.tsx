import AdminOrdersTableLoader from '@/admin/features/orders/components/AdminOrdersTableLoader';
import AdminCreateDraftOrderButton from '@/admin/features/orders/components/AdminCreateDraftOrderButton';
import { fetchOrdersAnalyticsRows, fetchOrdersListPage } from '@/shared/server/orders';
import type { OrderAnalyticsRow, OrderRow } from '@/shared/domain/order/orderTypes';
import { instrumentAdminRouteRender, profilePayloadEstimate, profileRoutePhase } from '@/shared/server/catalogDiagnostics';
import { getDatabaseUrl } from '@/shared/server/db';
import { fetchGlobalAnalyticsAppearance, type AnalyticsGlobalAppearance } from '@/shared/server/analyticsCharts';

export const metadata = {
  title: 'Naročila'
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

async function AdminOrdersTableSection({
  searchParams
}: {
  searchParams?: {
    from?: string | string[];
    to?: string | string[];
    q?: string | string[];
    status?: string | string[];
    docType?: string | string[];
    page?: string | string[];
    pageSize?: string | string[];
  };
}) {
  return instrumentAdminRouteRender('/admin/orders', async () => {
    const from = normalizeDateInput(normalizeSearchParam(searchParams?.from));
    const to = normalizeDateInput(normalizeSearchParam(searchParams?.to));
    const query = normalizeSearchParam(searchParams?.q).trim();
    const status = normalizeSearchParam(searchParams?.status).trim() || 'all';
    const documentType = normalizeSearchParam(searchParams?.docType).trim() || 'all';
    const page = Math.max(1, Number(normalizeSearchParam(searchParams?.page)) || 1);
    const pageSize = [25, 50, 100].includes(Number(normalizeSearchParam(searchParams?.pageSize)))
      ? Number(normalizeSearchParam(searchParams?.pageSize))
      : 25;
  let orders: OrderRow[] = [];
  let analyticsOrders: OrderAnalyticsRow[] = [];
  let documents: Array<{
    id: number;
    order_id: number;
    type: string;
    filename: string;
    blob_url: string;
    blob_pathname: string | null;
    created_at: string;
  }> = [];
  let totalCount = 0;
  let warningMessage: string | null = null;

  const fallbackAppearance: AnalyticsGlobalAppearance = {
    sectionBg: '#f1f0ec',
    canvasBg: '#ffffff',
    cardBg: '#ffffff',
    plotBg: '#ffffff',
    axisTextColor: '#111827',
    seriesPalette: ['#3e67d6', '#059669', '#a16207', '#3e67d6', '#3e67d6'],
    gridColor: '#d8d6cf',
    gridOpacity: 0.35
  };
  let analyticsAppearance = fallbackAppearance;

  if (!getDatabaseUrl()) {
    warningMessage = 'Povezava z bazo ni nastavljena.';
  } else {
    try {
      const [ordersPageResult, analyticsOrdersResult, analyticsAppearanceResult] = await Promise.all([
        fetchOrdersListPage({
          includeDrafts: true,
          fromDate: toIsoOrNull(from),
          toDate: getToDateIsoOrNull(to),
          query,
          status,
          documentType,
          page,
          pageSize
        }),
        fetchOrdersAnalyticsRows({
          includeDrafts: true,
          fromDate: toIsoOrNull(from),
          toDate: getToDateIsoOrNull(to)
        }, '/admin/orders:analytics-preview'),
        fetchGlobalAnalyticsAppearance('narocila', '/admin/orders').catch(() => fallbackAppearance)
      ]);
      orders = ordersPageResult.orders;
      analyticsOrders = analyticsOrdersResult;
      documents = ordersPageResult.documentSummaries.map((documentSummary, index) => ({
        id: index + 1,
        order_id: documentSummary.order_id,
        type: documentSummary.type,
        filename: documentSummary.filename,
        blob_url: documentSummary.blob_url,
        blob_pathname: null,
        created_at: documentSummary.created_at
      }));
      totalCount = ordersPageResult.totalCount;
      analyticsAppearance = analyticsAppearanceResult;
      console.info(`/admin/orders loaded rows=${orders.length} total=${totalCount} page=${page} pageSize=${pageSize}`);
    } catch (error) {
      console.error('Failed to load /admin/orders data', error);
      warningMessage = 'Podatkov trenutno ni mogoče naložiti.';
    }
  }

    await profileRoutePhase('payload', 'AdminOrdersTableSection:props', async () => {
      profilePayloadEstimate('AdminOrdersTableSection:orders', orders);
      profilePayloadEstimate('AdminOrdersTableSection:analyticsOrders', analyticsOrders);
      profilePayloadEstimate('AdminOrdersTableSection:documents', documents);
      profilePayloadEstimate('AdminOrdersTableSection:totalCount', totalCount);
    });

    const compactOrders = orders.map((order) => [
      order.id,
      order.order_number,
      order.customer_type,
      order.organization_name,
      order.contact_name,
      order.email,
      order.delivery_address ?? null,
      order.reference ?? null,
      order.notes ?? null,
      order.status,
      order.payment_status ?? null,
      order.admin_order_notes ?? null,
      order.subtotal,
      order.tax,
      order.total,
      order.created_at,
      order.is_draft ?? false,
      order.deleted_at ?? null
    ] as const);
    const compactAnalyticsOrders = analyticsOrders.map((order) => [
      order.created_at,
      order.status,
      order.total
    ] as const);
    const compactDocuments = documents.map((document) => [
      document.id,
      document.order_id,
      document.type,
      document.filename,
      document.blob_url,
      document.created_at
    ] as const);
    return (
      <>
        {warningMessage ? (
          <div className="rounded-2xl border border-dashed border-amber-200 bg-amber-50 p-6 text-sm text-amber-700">
            {warningMessage}
          </div>
        ) : null}

        <AdminOrdersTableLoader
          orders={compactOrders}
          analyticsOrders={compactAnalyticsOrders}
          documents={compactDocuments}
          initialFrom={from}
          initialTo={to}
          initialQuery={query}
          initialStatusFilter={status}
          initialDocumentType={documentType}
          initialPage={page}
          initialPageSize={pageSize}
          totalCount={totalCount}
          topAction={<AdminCreateDraftOrderButton />}
          analyticsAppearance={analyticsAppearance}
        />
      </>
    );
  });
}

export default async function AdminOrdersPage(
  props: {
    searchParams?: Promise<{
      from?: string | string[];
      to?: string | string[];
      q?: string | string[];
      status?: string | string[];
      docType?: string | string[];
      page?: string | string[];
      pageSize?: string | string[];
    }>;
  }
) {
  const searchParams = await props.searchParams;
  return (
    <div className="w-full">
      <div className="flex w-full flex-col gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Naročila</h1>
          <p className="mt-1 text-sm text-slate-500">Pregled in urejanje naročil.</p>
          <details className="mt-2 max-w-3xl rounded-xl bg-white/80 px-3 py-2 text-sm text-slate-600">
            <summary className="cursor-pointer select-none font-semibold text-slate-700">Navodila</summary>
            <div className="mt-2 rounded-lg bg-slate-50 px-3 py-2">
              <p className="leading-relaxed">
                Uporabite filtre v glavi tabele za hitro omejitev rezultatov po datumu, znesku, tipu dokumenta in statusih.
                Pri serijskih opravilih najprej izberite vrstice s potrditvenimi polji, nato uporabite dejanja v zgornji vrstici.
              </p>
            </div>
          </details>
        </div>
        {await AdminOrdersTableSection({ searchParams })}
      </div>
    </div>
  );
}
