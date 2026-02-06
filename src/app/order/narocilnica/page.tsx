import Link from 'next/link';
import PurchaseOrderUploadForm from '@/components/order/PurchaseOrderUploadForm';

export const metadata = {
  title: 'Naloži naročilnico'
};

export default function PurchaseOrderUploadPage() {
  return (
    <div className="container-base py-12">
      <div className="max-w-3xl">
        <Link href="/order" className="text-sm font-semibold text-brand-600">
          ← Nazaj na naročilo
        </Link>
        <h1 className="mt-4 text-3xl font-semibold text-slate-900">Naloži naročilnico</h1>
        <p className="mt-3 text-slate-600">
          Šole lahko naročilnico naložijo tudi kasneje. Potrebujete številko naročila in PDF ali JPG
          datoteko.
        </p>
        <div className="mt-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <PurchaseOrderUploadForm />
        </div>
      </div>
    </div>
  );
}
