import ConfirmationPageFrame from '@/commercial/components/ConfirmationPageFrame';
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
    <ConfirmationPageFrame testId="order-confirmation-page">
      <OrderConfirmationPageClient />
    </ConfirmationPageFrame>
  );
}
