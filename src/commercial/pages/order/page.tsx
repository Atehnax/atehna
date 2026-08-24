import OrderPageClient from '@/commercial/order/components/OrderPageClient';

export const metadata = {
  title: 'Naročilo'
};

export default function OrderPage() {
  return (
    <div className="container-base site-section" data-testid="order-page">
      <div className="w-full">
        <OrderPageClient />
      </div>
    </div>
  );
}
