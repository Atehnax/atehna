import type { OrderContractStatus } from '@/shared/domain/order/contractStatus';
import SubmissionStatusPanel, {
  type SubmissionStatusTone
} from '@/commercial/components/SubmissionStatusPanel';

export type OrderSubmissionCommitmentStatus =
  | 'binding'
  | 'pending_confirmation'
  | 'rejected';

type OrderSubmissionStatusProps = {
  orderCode: string;
  commitmentStatus?: OrderSubmissionCommitmentStatus;
  contractStatus?: OrderContractStatus;
  submittedAt?: string | null;
  submittedAtDateTime?: string | null;
};

export type OrderSubmissionStatusContent = {
  eyebrow: string;
  heading: string;
  description: string;
  symbol: string;
  tone: SubmissionStatusTone;
};

export function getOrderSubmissionStatusContent(
  commitmentStatus?: OrderSubmissionCommitmentStatus,
  contractStatus?: OrderContractStatus
): OrderSubmissionStatusContent {
  if (commitmentStatus === 'rejected' || contractStatus === 'rejected') {
    return {
      eyebrow: 'Stanje naročila',
      heading: 'Naročilo je zavrnjeno',
      description:
        'Naročilo ni bilo potrjeno. Za pojasnilo se obrnite na našo ekipo z istega e-poštnega naslova, ki ste ga uporabili pri naročilu.',
      symbol: '!',
      tone: 'danger'
    };
  }

  if (commitmentStatus === 'pending_confirmation') {
    return {
      eyebrow: 'Potrditev',
      heading: 'Naročilo je prejeto',
      description:
        'Po e-pošti boste prejeli varno povezavo za nalaganje naročilnice. Naročilo začnemo obdelovati šele po prejemu in pregledu naročilnice. Zaloga do potrditve še ni rezervirana.',
      symbol: '…',
      tone: 'info'
    };
  }

  if (contractStatus === 'accepted') {
    return {
      eyebrow: 'Potrjeno',
      heading: 'Vaše naročilo je potrjeno',
      description:
        'Za nadaljnje usklajevanje bomo uporabili navedeni e-poštni naslov.',
      symbol: '✓',
      tone: 'success'
    };
  }

  return {
    eyebrow: 'Prejeto',
    heading: 'Prejeli smo vaše naročilo',
    description:
      'Naročilo še ni potrjeno. Atehna ga bo pregledala in vas o sprejemu ali zavrnitvi obvestila po e-pošti.',
    symbol: '…',
    tone: 'success'
  };
}

export default function OrderSubmissionStatus({
  orderCode,
  commitmentStatus,
  contractStatus,
  submittedAt,
  submittedAtDateTime
}: OrderSubmissionStatusProps) {
  const content = getOrderSubmissionStatusContent(
    commitmentStatus,
    contractStatus
  );

  return (
    <SubmissionStatusPanel
      eyebrow={content.eyebrow}
      heading={content.heading}
      description={content.description}
      symbol={content.symbol}
      meta={
        <>
          <p className="text-sm text-[color:var(--site-color-text-muted)]">
            Koda naročila
          </p>
          <p
            className="mt-1 font-semibold tabular-nums"
            data-testid="order-confirmation-public-code"
          >
            {orderCode}
          </p>
          {submittedAt ? (
            <time
              className="mt-2 block text-sm text-[color:var(--site-color-text-muted)]"
              dateTime={submittedAtDateTime ?? undefined}
            >
              {submittedAt}
            </time>
          ) : null}
        </>
      }
      tone={content.tone}
      testId="order-submission-status"
      headingTestId="order-confirmation-heading"
    />
  );
}
