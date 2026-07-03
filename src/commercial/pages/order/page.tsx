import OrderPageClient from '@/commercial/order/components/OrderPageClient';

export const metadata = {
  title: 'Naročilo'
};

export default function OrderPage() {
  return (
    <div className="container-base py-12" data-testid="order-page">
      <div className="w-full">
        <OrderPageClient />
      </div>
    </div>
  );
}
