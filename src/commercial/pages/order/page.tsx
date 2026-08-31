import OrderPageClient from '@/commercial/order/components/OrderPageClient';
import { arePublicQuoteRequestsEnabled } from '@/shared/server/quoteFeatureFlags';

export const metadata = {
  title: 'Naročilo'
};

export default function OrderPage() {
  return (
    <div className="container-base site-section" data-testid="order-page">
      <div className="w-full">
        <OrderPageClient
          quoteRequestsEnabled={arePublicQuoteRequestsEnabled()}
        />
      </div>
    </div>
  );
}
