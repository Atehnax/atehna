import QuoteOfferReviewPageClient from '@/commercial/quote/components/QuoteOfferReviewPageClient';

export const metadata = {
  title: 'Pregled ponudbe',
  robots: { index: false, follow: false },
  referrer: 'no-referrer'
};

export default function QuoteOfferReviewPage() {
  return (
    <div className="container-base site-section" data-testid="quote-offer-review-page">
      <QuoteOfferReviewPageClient />
    </div>
  );
}
