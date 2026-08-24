export type OrderSubmissionCommitmentStatus =
  | 'binding'
  | 'pending_confirmation'
  | 'rejected';

type OrderSubmissionStatusProps = {
  commitmentStatus?: OrderSubmissionCommitmentStatus;
};

export type OrderSubmissionStatusContent = {
  eyebrow: string;
  heading: string;
  description: string;
  symbol: string;
  tone: 'success' | 'info' | 'warning' | 'danger';
};

export function getOrderSubmissionStatusContent(
  commitmentStatus?: OrderSubmissionCommitmentStatus
): OrderSubmissionStatusContent {
  if (commitmentStatus === 'pending_confirmation') {
    return {
      eyebrow: 'Potrditev',
      heading: 'Naročilo je prejeto',
      description:
        'Vaše naročilo bomo pregledali in vam poslali ponudbo oziroma navodila za naročilnico. Zaloga do potrditve še ni rezervirana.',
      symbol: '…',
      tone: 'info'
    };
  }

  if (commitmentStatus === 'rejected') {
    return {
      eyebrow: 'Stanje naročila',
      heading: 'Naročilo ni bilo potrjeno',
      description:
        'Za pojasnilo se obrnite na našo ekipo z istega e-poštnega naslova, ki ste ga uporabili pri naročilu.',
      symbol: '!',
      tone: 'danger'
    };
  }

  return {
    eyebrow: 'Uspešno oddano',
    heading: 'Naročilo je sprejeto',
    description:
      'Potrditev je shranjena na tej strani. Za nadaljnje usklajevanje bomo uporabili navedeni e-poštni naslov; plačilo uredimo ročno po ponudbi ali predračunu.',
    symbol: '✓',
    tone: 'success'
  };
}

const TONE_STYLES = {
  success: {
    border: 'border-[color:var(--site-color-success)]',
    symbol: 'bg-[color:var(--site-color-success)]'
  },
  info: {
    border: 'border-[color:var(--site-color-info)]',
    symbol: 'bg-[color:var(--site-color-info)]'
  },
  warning: {
    border: 'border-[color:var(--site-color-warning)]',
    symbol: 'bg-[color:var(--site-color-warning)]'
  },
  danger: {
    border: 'border-[color:var(--site-color-danger)]',
    symbol: 'bg-[color:var(--site-color-danger)]'
  }
} as const;

export default function OrderSubmissionStatus({
  commitmentStatus
}: OrderSubmissionStatusProps) {
  const content = getOrderSubmissionStatusContent(commitmentStatus);
  const tone = TONE_STYLES[content.tone];

  return (
    <div
      className={`site-radius-md border ${tone.border} bg-[color:var(--site-color-surface)] p-5`}
      data-testid="order-submission-status"
      role={content.tone === 'danger' ? 'alert' : 'status'}
      aria-live={content.tone === 'danger' ? 'assertive' : 'polite'}
      aria-atomic="true"
    >
      <div className="flex items-start gap-4">
        <span
          aria-hidden="true"
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${tone.symbol} text-xl font-bold text-white`}
        >
          {content.symbol}
        </span>
        <div>
          <p className="site-eyebrow">{content.eyebrow}</p>
          <h1
            className="site-heading-1 mt-1 !text-2xl sm:!text-3xl"
            data-testid="order-confirmation-heading"
          >
            {content.heading}
          </h1>
          <p className="site-paragraph mt-3">{content.description}</p>
        </div>
      </div>
    </div>
  );
}
