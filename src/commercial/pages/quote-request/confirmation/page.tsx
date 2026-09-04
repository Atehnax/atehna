import ConfirmationPageFrame from '@/commercial/components/ConfirmationPageFrame';
import QuoteRequestConfirmationPageClient from '@/commercial/quote/components/QuoteRequestConfirmationPageClient';

export const metadata = {
  title: 'Potrditev povpraševanja',
  robots: { index: false, follow: false },
  referrer: 'no-referrer'
};

export default function QuoteRequestConfirmationPage() {
  return (
    <ConfirmationPageFrame testId="quote-request-confirmation-page">
      <QuoteRequestConfirmationPageClient />
    </ConfirmationPageFrame>
  );
}
