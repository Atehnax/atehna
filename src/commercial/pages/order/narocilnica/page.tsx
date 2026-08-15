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

type PurchaseOrderUploadPageProps = {
  searchParams: Promise<{
    orderId?: string | string[];
    orderNumber?: string | string[];
    token?: string | string[];
  }>;
};

const firstValue = (value?: string | string[]) =>
  Array.isArray(value) ? value[0] : value;

export default async function PurchaseOrderUploadPage({
  searchParams
}: PurchaseOrderUploadPageProps) {
  const resolvedSearchParams = await searchParams;
  const orderId = firstValue(resolvedSearchParams.orderId);
  const orderNumber = firstValue(resolvedSearchParams.orderNumber);
  const accessToken = firstValue(resolvedSearchParams.token);
  const confirmationHref = accessToken
    ? `/order/confirmation?token=${encodeURIComponent(accessToken)}`
    : '/order';

  return (
    <div className="container-base site-section">
      <div className="mx-auto max-w-3xl">
        <Link href={confirmationHref} className="site-link text-sm font-semibold">
          ← Nazaj na potrditev
        </Link>
        <p className="site-eyebrow mt-7">Šolsko naročilo</p>
        <h1 className="site-heading-1 mt-2">Naloži naročilnico</h1>
        <p className="site-paragraph mt-3 max-w-2xl">
          Dodajte podpisano naročilnico v obliki PDF ali JPG. Datoteko bomo
          povezali samo z naročilom iz varne potrditvene povezave.
        </p>

        <div className="site-card mt-8">
          <PurchaseOrderUploadForm
            initialOrderId={orderId}
            initialOrderNumber={orderNumber}
            accessToken={accessToken}
          />
        </div>
      </div>
    </div>
  );
}
