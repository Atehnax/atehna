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
  meta?: ReactNode;
  tone: SubmissionStatusTone;
  testId: string;
  headingTestId?: string;
};

const TONE_STYLES = {
  success: {
    color: 'var(--site-color-success)'
  },
  info: {
    color: 'var(--site-color-info)'
  },
  warning: {
    color: 'var(--site-color-warning)'
  },
  danger: {
    color: 'var(--site-color-danger)'
  }
} as const;

export default function SubmissionStatusPanel({
  eyebrow,
  heading,
  description,
  symbol,
  meta,
  tone,
  testId,
  headingTestId
}: SubmissionStatusPanelProps) {
  const styles = TONE_STYLES[tone];

  return (
    <div
      className="site-card !p-5 sm:!p-7"
      data-testid={testId}
      data-confirmation-status
      data-confirmation-tone={tone}
      role={tone === 'danger' ? 'alert' : 'status'}
      aria-live={tone === 'danger' ? 'assertive' : 'polite'}
      aria-atomic="true"
    >
      <div className="grid min-w-0 items-center gap-4 sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:gap-6">
        <span
          aria-hidden="true"
          className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full text-3xl font-bold sm:h-16 sm:w-16"
          style={{
            backgroundColor: `color-mix(in srgb, ${styles.color} 12%, var(--site-color-surface))`,
            color: styles.color
          }}
        >
          {symbol}
        </span>
        <div className="min-w-0">
          <p className="site-eyebrow" style={{ color: styles.color }}>
            {eyebrow}
          </p>
          <h1
            className="site-heading-1 mt-1 !text-2xl sm:!text-3xl"
            data-testid={headingTestId}
          >
            {heading}
          </h1>
          <p className="site-paragraph mt-2">{description}</p>
        </div>
        {meta ? (
          <div
            className="min-w-0 border-t border-[color:var(--site-divider-color)] pt-4 text-left sm:min-w-40 sm:border-l sm:border-t-0 sm:pl-6 sm:pt-0 sm:text-right"
            data-confirmation-status-meta
          >
            {meta}
          </div>
        ) : null}
      </div>
    </div>
  );
}
