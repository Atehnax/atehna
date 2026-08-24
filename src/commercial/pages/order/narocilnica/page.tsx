import Link from 'next/link';
import PurchaseOrderUploadForm from '@/commercial/order/components/PurchaseOrderUploadForm';

export const metadata = {
  title: 'Naloži naročilnico',
  robots: {
    index: false,
    follow: false
  },
  referrer: 'no-referrer'
};

export default function PurchaseOrderUploadPage() {
  return (
    <div className="container-base site-section">
      <div className="mx-auto max-w-3xl">
        <Link href="/order/confirmation" className="site-link text-sm font-semibold">
          ← Nazaj na potrditev
        </Link>
        <p className="site-eyebrow mt-7">Šolsko naročilo</p>
        <h1 className="site-heading-1 mt-2">Naloži naročilnico</h1>
        <p className="site-paragraph mt-3 max-w-2xl">
          Dodajte podpisano naročilnico v obliki PDF ali JPG. Datoteko bomo
          povezali samo z naročilom iz varne potrditvene povezave.
        </p>

        <div className="site-card mt-8">
          <PurchaseOrderUploadForm />
        </div>
      </div>
    </div>
  );
}
