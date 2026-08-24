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
      <div className="mx-auto max-w-4xl">
        <Link
          href="/order/confirmation"
          className="site-link text-sm font-semibold"
        >
          ← Nazaj na potrditev
        </Link>
        <p className="site-eyebrow mt-7">Naročilo šole / javnega zavoda</p>
        <h1 className="site-heading-1 mt-2">Naloži naročilnico</h1>
        <p className="site-paragraph mt-3 max-w-2xl">
          Za nadaljnjo obdelavo dodajte podpisano oziroma odobreno naročilnico.
          Varna povezava bo dokument samodejno povezala z vašim naročilom.
        </p>

        <section
          className="site-card mt-8"
          aria-labelledby="purchase-order-steps-heading"
        >
          <p className="site-eyebrow">Postopek</p>
          <h2
            id="purchase-order-steps-heading"
            className="mt-2 text-xl font-semibold"
          >
            Naročilnico naložite v treh korakih
          </h2>
          <ol className="mt-6 grid gap-4 sm:grid-cols-3">
            {[
              {
                title: 'Pripravite dokument',
                description: 'Uporabite podpisano oziroma odobreno naročilnico.'
              },
              {
                title: 'Preverite datoteko',
                description: 'Dovoljena sta PDF ali JPG do velikosti 10 MB.'
              },
              {
                title: 'Varno naložite',
                description: 'Dokument samodejno povežemo z vašim naročilom.'
              }
            ].map((step, index) => (
              <li
                key={step.title}
                className="site-radius-md border border-[color:var(--site-border-color)] bg-[color:var(--site-color-surface-muted)] p-4"
              >
                <span
                  aria-hidden="true"
                  className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[color:var(--site-color-primary)] text-sm font-bold text-white"
                >
                  {index + 1}
                </span>
                <h3 className="mt-3 font-semibold">{step.title}</h3>
                <p className="mt-1 text-sm leading-6 text-[color:var(--site-color-text-muted)]">
                  {step.description}
                </p>
              </li>
            ))}
          </ol>
        </section>

        <div className="site-card mt-6">
          <h2 className="text-xl font-semibold">Izberite naročilnico</h2>
          <p className="mt-2 text-sm leading-6 text-[color:var(--site-color-text-muted)]">
            Dodatnih podatkov ali interne številke naročila ni treba vpisovati.
          </p>
          <div className="mt-5">
            <PurchaseOrderUploadForm />
          </div>
        </div>
      </div>
    </div>
  );
}
