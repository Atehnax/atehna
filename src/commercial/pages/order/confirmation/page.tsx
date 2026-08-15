import OrderConfirmationPageClient from '@/commercial/order/components/OrderConfirmationPageClient';

export const metadata = {
  title: 'Potrditev naročila',
  robots: {
    index: false,
    follow: false
  },
  referrer: 'no-referrer'
};

type OrderConfirmationPageProps = {
  searchParams: Promise<{ token?: string | string[] }>;
};

export default async function OrderConfirmationPage({
  searchParams
}: OrderConfirmationPageProps) {
  const resolvedSearchParams = await searchParams;
  const token = Array.isArray(resolvedSearchParams.token)
    ? resolvedSearchParams.token[0]
    : resolvedSearchParams.token;

  return (
    <div className="container-base site-section" data-testid="order-confirmation-page">
      <OrderConfirmationPageClient token={token} />
    </div>
  );
}
