import type { ReactNode } from 'react';

export type SubmissionStatusTone =
  | 'success'
  | 'info'
  | 'warning'
  | 'danger';

type SubmissionStatusPanelProps = {
  eyebrow: ReactNode;
  heading: ReactNode;
  description: ReactNode;
  symbol: ReactNode;
  tone: SubmissionStatusTone;
  testId: string;
  headingTestId?: string;
};

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

export default function SubmissionStatusPanel({
  eyebrow,
  heading,
  description,
  symbol,
  tone,
  testId,
  headingTestId
}: SubmissionStatusPanelProps) {
  const styles = TONE_STYLES[tone];

  return (
    <div
      className={`site-radius-md border ${styles.border} bg-[color:var(--site-color-surface)] p-5`}
      data-testid={testId}
      data-confirmation-status
      data-confirmation-tone={tone}
      role={tone === 'danger' ? 'alert' : 'status'}
      aria-live={tone === 'danger' ? 'assertive' : 'polite'}
      aria-atomic="true"
    >
      <div className="flex items-start gap-4">
        <span
          aria-hidden="true"
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${styles.symbol} text-xl font-bold text-white`}
        >
          {symbol}
        </span>
        <div className="min-w-0">
          <p className="site-eyebrow">{eyebrow}</p>
          <h1
            className="site-heading-1 mt-1 !text-2xl sm:!text-3xl"
            data-testid={headingTestId}
          >
            {heading}
          </h1>
          <p className="site-paragraph mt-3">{description}</p>
        </div>
      </div>
    </div>
  );
}
