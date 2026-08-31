import { notFound } from 'next/navigation';
import AdminQuoteDetailClient from '@/admin/features/quotes/components/AdminQuoteDetailClient';
import { fetchAdminQuoteDetail } from '@/shared/server/quotes';
import { isQuoteAdminEnabled } from '@/shared/server/quoteFeatureFlags';

export const metadata = { title: 'Povpraševanje in ponudba' };
export const dynamic = 'force-dynamic';

export default async function AdminQuoteDetailPage({
  params
}: {
  params: Promise<{ quoteRequestId: string }>;
}) {
  if (!isQuoteAdminEnabled()) notFound();
  const { quoteRequestId: rawQuoteRequestId } = await params;
  const quoteRequestId = Number(rawQuoteRequestId);
  if (!Number.isSafeInteger(quoteRequestId) || quoteRequestId <= 0) notFound();
  const detail = await fetchAdminQuoteDetail(quoteRequestId);
  if (!detail) notFound();
  return <AdminQuoteDetailClient detail={detail} />;
}
