import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import ConfirmationContentLayout from '@/commercial/components/ConfirmationContentLayout';
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
    <div className="container-base site-section" data-testid="purchase-order-page">
      <div className="mx-auto max-w-6xl">
        <header className="site-card">
          <Link
            href="/order/confirmation"
            className="site-link inline-flex items-center gap-2 text-sm font-semibold"
          >
            <ArrowLeft aria-hidden="true" className="h-4 w-4" />
            Nazaj na potrditev
          </Link>
          <p className="mt-5 text-sm text-[color:var(--site-color-text-muted)]">
            Naročilo šole ali javnega zavoda
          </p>
          <h1 className="mt-1 text-2xl font-semibold">Naloži naročilnico</h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-[color:var(--site-color-text-muted)]">
            Dodajte podpisano oziroma odobreno naročilnico za nadaljnjo obdelavo.
            Dokument bomo samodejno povezali z vašim naročilom.
          </p>
        </header>

        <ConfirmationContentLayout
          testId="purchase-order-content-grid"
          detailsTestId="purchase-order-upload-card"
          summaryTestId="purchase-order-steps-card"
          detailsLabelledBy="purchase-order-upload-heading"
          summaryLabelledBy="purchase-order-steps-heading"
          details={
            <>
              <h2 id="purchase-order-upload-heading" className="text-xl font-semibold">
                Izberite naročilnico
              </h2>
              <p className="mt-2 text-sm leading-6 text-[color:var(--site-color-text-muted)]">
                Dodatnih podatkov ali interne številke naročila ni treba vpisovati.
              </p>
              <div className="mt-5">
                <PurchaseOrderUploadForm />
              </div>
            </>
          }
          summary={
            <>
              <h2 id="purchase-order-steps-heading" className="text-xl font-semibold">
                Kako oddati naročilnico
              </h2>
              <ol className="mt-5 space-y-5">
                {[
                  {
                    title: 'Pripravite dokument',
                    description: 'Uporabite podpisano oziroma odobreno naročilnico.'
                  },
                  {
                    title: 'Izberite datoteko',
                    description: 'Dovoljena sta PDF ali JPG do velikosti 10 MB.'
                  },
                  {
                    title: 'Naložite naročilnico',
                    description: 'Po nalaganju prejmete potrditev in povezavo do dokumenta.'
                  }
                ].map((step, index) => (
                  <li key={step.title} className="flex items-start gap-3">
                    <span
                      aria-hidden="true"
                      className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-[color:var(--site-border-color)] text-sm font-semibold"
                    >
                      {index + 1}
                    </span>
                    <div className="min-w-0">
                      <h3 className="text-sm font-semibold">{step.title}</h3>
                      <p className="mt-1 text-sm leading-6 text-[color:var(--site-color-text-muted)]">
                        {step.description}
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
            </>
          }
        />
      </div>
    </div>
  );
}
