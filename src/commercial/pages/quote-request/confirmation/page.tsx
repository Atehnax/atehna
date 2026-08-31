import QuoteRequestConfirmationPageClient from '@/commercial/quote/components/QuoteRequestConfirmationPageClient';

export const metadata = {
  title: 'Potrditev povpraševanja',
  robots: { index: false, follow: false },
  referrer: 'no-referrer'
};

export default function QuoteRequestConfirmationPage() {
  return (
    <div
      className="container-base site-section"
      data-testid="quote-request-confirmation-page"
    >
      <QuoteRequestConfirmationPageClient />
    </div>
  );
}
