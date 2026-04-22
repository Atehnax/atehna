import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default async function AdminAnalyticsNarocilaRedirectPage(
  props: {
    searchParams?: Promise<{ range?: string; from?: string; to?: string; grouping?: string }>;
  }
) {
  const searchParams = await props.searchParams;
  const params = new URLSearchParams();
  if (searchParams?.range) params.set('range', searchParams.range);
  if (searchParams?.from) params.set('from', searchParams.from);
  if (searchParams?.to) params.set('to', searchParams.to);
  if (searchParams?.grouping) params.set('grouping', searchParams.grouping);
  params.set('view', 'narocila');

  redirect(`/admin/analitika${params.toString() ? `?${params.toString()}` : ''}`);
}
