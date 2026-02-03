import OrderPageClient from '@/components/order/OrderPageClient';

export const metadata = {
  title: 'Naročilo'
};

export default function OrderPage() {
  return (
    <div className="container-base py-12">
      <div className="max-w-5xl">
        <h1 className="text-3xl font-semibold text-slate-900">Oddaja naročila</h1>
        <p className="mt-3 text-slate-600">
          Izpolnite podatke, pripravite PDF naročilnico in jo pošljite po e-pošti.
        </p>
        <div className="mt-8">
          <OrderPageClient />
        </div>
      </div>
    </div>
  );
}
