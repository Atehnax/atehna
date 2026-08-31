import AdminOrdersTableLoader from '@/admin/features/orders/components/AdminOrdersTableLoader';
import AdminCreateDraftOrderButton from '@/admin/features/orders/components/AdminCreateDraftOrderButton';
import AdminOrdersTabs from '@/admin/features/orders/components/AdminOrdersTabs';
import AdminQuotesTable from '@/admin/features/quotes/components/AdminQuotesTable';
import {
  fetchOrderAttentionCount,
  fetchOrdersAnalyticsRows,
  fetchOrdersListPage
} from '@/shared/server/orders';
import type { OrderAnalyticsRow, OrderRow } from '@/shared/domain/order/orderTypes';
import {
  normalizeAdminQuoteAmountBound,
  normalizeAdminQuoteCustomerTypeFilter,
  normalizeAdminQuoteDateRange,
  normalizeAdminQuoteRequestNumberRange,
  type AdminQuoteStatusFilter
} from '@/shared/domain/quote/quoteAdminTypes';
import {
  fetchAdminQuoteFunnel,
  fetchAdminQuoteRequestsPage,
  fetchNewQuoteRequestCount
} from '@/shared/server/quotes';
import { isAllPageSize, parsePageSizeValue } from '@/shared/domain/pagination';
import { instrumentAdminRouteRender, profilePayloadEstimate, profileRoutePhase } from '@/shared/server/catalogDiagnostics';
import { getDatabaseUrl } from '@/shared/server/db';
import { fetchGlobalAnalyticsAppearance, type AnalyticsGlobalAppearance } from '@/shared/server/analyticsCharts';
import { isQuoteAdminEnabled } from '@/shared/server/quoteFeatureFlags';

export const metadata = {
  title: 'Naročila'
};

export const dynamic = 'force-dynamic';

const DATE_INPUT_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const ORDERS_PAGE_SIZE_OPTIONS = [25, 50, 100] as const;
const QUOTE_STATUS_FILTERS: readonly AdminQuoteStatusFilter[] = [
  'all',
  'preparation',
  'received',
  'issued',
  'ordered',
  'declined',
  'expired'
];

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

const normalizeQuoteStatus = (value: string): AdminQuoteStatusFilter =>
  QUOTE_STATUS_FILTERS.includes(value as AdminQuoteStatusFilter)
    ? value as AdminQuoteStatusFilter
    : 'all';

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
    const pageSize = parsePageSizeValue(
      normalizeSearchParam(searchParams?.pageSize),
      ORDERS_PAGE_SIZE_OPTIONS
    ) ?? 25;
    const page = isAllPageSize(pageSize)
      ? 1
      : Math.max(1, Number(normalizeSearchParam(searchParams?.page)) || 1);
  let orders: OrderRow[] = [];
  let analyticsOrders: OrderAnalyticsRow[] = [];
  let documents: Array<{
    id: number;
    order_id: number;
    type: string;
    filename: string;
    url: string;
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
          includeDrafts: false,
          fromDate: toIsoOrNull(from),
          toDate: getToDateIsoOrNull(to)
        }, '/admin/orders:analytics-preview'),
        fetchGlobalAnalyticsAppearance('narocila', '/admin/orders').catch(() => fallbackAppearance)
      ]);
      orders = ordersPageResult.orders;
      analyticsOrders = analyticsOrdersResult;
      documents = ordersPageResult.documentSummaries.map((documentSummary) => ({
        id: documentSummary.id,
        order_id: documentSummary.order_id,
        type: documentSummary.type,
        filename: documentSummary.filename,
        url: documentSummary.url,
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
      order.address_line1,
      order.address_line2,
      order.postal_code,
      order.city,
      order.country_code,
      order.reference ?? null,
      order.notes ?? null,
      order.status,
      order.payment_status ?? null,
      order.admin_order_notes ?? null,
      order.subtotal,
      order.tax,
      order.shipping,
      order.automatic_shipping,
      order.shipping_override_json,
      order.shipping_override_stale,
      order.total,
      order.created_at,
      order.is_draft ?? false,
      order.deleted_at ?? null
    ] as const);
    const compactAnalyticsOrders = analyticsOrders.map((order) => [
      order.created_at,
      order.status,
      order.total,
      order.commitment_status,
      order.contract_status,
      order.committed_at,
      order.contract_accepted_at
    ] as const);
    const compactDocuments = documents.map((document) => [
      document.id,
      document.order_id,
      document.type,
      document.filename,
      document.url,
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

async function AdminQuotesTableSection({
  searchParams
}: {
  searchParams?: {
    q?: string | string[];
    quoteStatus?: string | string[];
    quoteCustomerType?: string | string[];
    quoteFrom?: string | string[];
    quoteTo?: string | string[];
    quoteMinRequestNumber?: string | string[];
    quoteMaxRequestNumber?: string | string[];
    quoteMinTotal?: string | string[];
    quoteMaxTotal?: string | string[];
    quotePage?: string | string[];
    quotePageSize?: string | string[];
  };
}) {
  const query = normalizeSearchParam(searchParams?.q).trim();
  const status = normalizeQuoteStatus(normalizeSearchParam(searchParams?.quoteStatus));
  const customerType = normalizeAdminQuoteCustomerTypeFilter(
    normalizeSearchParam(searchParams?.quoteCustomerType)
  );
  const quoteDateRange = normalizeAdminQuoteDateRange(
    normalizeSearchParam(searchParams?.quoteFrom),
    normalizeSearchParam(searchParams?.quoteTo)
  );
  const quoteFrom = quoteDateRange.from;
  const quoteTo = quoteDateRange.to;
  const quoteRequestNumberRange = normalizeAdminQuoteRequestNumberRange(
    normalizeSearchParam(searchParams?.quoteMinRequestNumber),
    normalizeSearchParam(searchParams?.quoteMaxRequestNumber)
  );
  const minRequestNumber = quoteRequestNumberRange.min;
  const maxRequestNumber = quoteRequestNumberRange.max;
  const minTotal = normalizeAdminQuoteAmountBound(
    normalizeSearchParam(searchParams?.quoteMinTotal)
  );
  const maxTotal = normalizeAdminQuoteAmountBound(
    normalizeSearchParam(searchParams?.quoteMaxTotal)
  );
  const page = Math.max(1, Math.trunc(Number(normalizeSearchParam(searchParams?.quotePage)) || 1));
  const pageSize = [25, 50, 100].includes(Number(normalizeSearchParam(searchParams?.quotePageSize)))
    ? Number(normalizeSearchParam(searchParams?.quotePageSize))
    : 25;

  if (!getDatabaseUrl()) {
    return (
      <div className="rounded-2xl border border-dashed border-amber-200 bg-amber-50 p-6 text-sm text-amber-700">
        Povezava z bazo ni nastavljena.
      </div>
    );
  }

  const loaded = await Promise.all([
    fetchAdminQuoteRequestsPage({
      query,
      status,
      customerType,
      fromDate: quoteFrom || undefined,
      toDate: quoteTo || undefined,
      minRequestNumber: minRequestNumber ? Number(minRequestNumber) : undefined,
      maxRequestNumber: maxRequestNumber ? Number(maxRequestNumber) : undefined,
      minTotal: minTotal ? Number(minTotal) : undefined,
      maxTotal: maxTotal ? Number(maxTotal) : undefined,
      page,
      pageSize
    }),
    fetchAdminQuoteFunnel().catch(() => null)
  ])
    .then(([result, funnel]) => ({ result, funnel }))
    .catch((error: unknown) => {
      console.error('Failed to load quote administration list', error);
      return null;
    });
  if (!loaded) {
    return (
      <div className="rounded-2xl border border-dashed border-amber-200 bg-amber-50 p-6 text-sm text-amber-700">
        Povpraševanj in ponudb trenutno ni mogoče naložiti. Preverite, ali je bila nameščena podatkovna migracija za ponudbe.
      </div>
    );
  }
  return (
    <AdminQuotesTable
      result={loaded.result}
      funnel={loaded.funnel}
      query={query}
      status={status}
      customerType={customerType}
      fromDate={quoteFrom}
      toDate={quoteTo}
      minRequestNumber={minRequestNumber}
      maxRequestNumber={maxRequestNumber}
      minTotal={minTotal}
      maxTotal={maxTotal}
      page={page}
      pageSize={pageSize}
    />
  );
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
      view?: string | string[];
      quoteStatus?: string | string[];
      quoteCustomerType?: string | string[];
      quoteFrom?: string | string[];
      quoteTo?: string | string[];
      quoteMinRequestNumber?: string | string[];
      quoteMaxRequestNumber?: string | string[];
      quoteMinTotal?: string | string[];
      quoteMaxTotal?: string | string[];
      quotePage?: string | string[];
      quotePageSize?: string | string[];
    }>;
  }
) {
  const searchParams = await props.searchParams;
  const quoteAdminEnabled = isQuoteAdminEnabled();
  const activeView =
    quoteAdminEnabled && normalizeSearchParam(searchParams?.view) === 'quotes'
      ? 'quotes'
      : 'orders';
  const [attentionOrderCount, newQuoteCount] = getDatabaseUrl()
    ? await Promise.all([
        fetchOrderAttentionCount().catch(() => 0),
        quoteAdminEnabled
          ? fetchNewQuoteRequestCount().catch(() => 0)
          : Promise.resolve(0)
      ])
    : [0, 0];
  return (
    <div className="w-full">
      <div className="flex w-full flex-col gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Naročila</h1>
          <p className="mt-1 text-sm text-slate-500">
            {activeView === 'orders'
              ? 'Pregled in urejanje naročil.'
              : 'Ločen pregled neobvezujočih povpraševanj in izdanih ponudb.'}
          </p>
        </div>
        <AdminOrdersTabs
          activeView={activeView}
          quoteAdminEnabled={quoteAdminEnabled}
          attentionOrderCount={attentionOrderCount}
          newQuoteCount={newQuoteCount}
        />
        <div
          id={`admin-orders-panel-${activeView}`}
          role="tabpanel"
          aria-labelledby={`admin-orders-tab-${activeView}`}
        >
          {activeView === 'quotes'
            ? await AdminQuotesTableSection({ searchParams })
            : await AdminOrdersTableSection({ searchParams })}
        </div>
      </div>
    </div>
  );
}
