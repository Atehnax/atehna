import OrderConfirmationPageClient from '@/commercial/order/components/OrderConfirmationPageClient';

export const metadata = {
  title: 'Potrditev naročila',
  robots: {
    index: false,
    follow: false
  },
  referrer: 'no-referrer'
};

export default function OrderConfirmationPage() {
  return (
    <div className="container-base site-section" data-testid="order-confirmation-page">
      <OrderConfirmationPageClient />
    </div>
  );
}
