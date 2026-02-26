import OrderPageClient from '@/components/order/OrderPageClient';

export const metadata = {
  title: 'Naročilo'
};

export default function OrderPage() {
  return (
    <div className="container-base py-12" data-testid="order-page">
      <div className="max-w-5xl">
        <OrderPageClient />
      </div>
    </div>
  );
}
