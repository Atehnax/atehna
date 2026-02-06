import Link from 'next/link';
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
          Izpolnite podatke in oddajte naročilo. PDF dokument bo na voljo po uspešni oddaji.
        </p>
        <p className="mt-2 text-sm text-slate-600">
          Če ste šola, naročilnico naložite kasneje na{' '}
          <Link href="/order/narocilnica" className="font-semibold text-brand-600">
            posebni strani za naročilnice
          </Link>
          .
        </p>
        <div className="mt-8">
          <OrderPageClient />
        </div>
      </div>
    </div>
  );
}
