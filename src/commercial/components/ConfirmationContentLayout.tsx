import type { ReactNode } from 'react';

type ConfirmationContentLayoutProps = {
  details: ReactNode;
  summary: ReactNode;
  testId: string;
  detailsTestId: string;
  summaryTestId: string;
  detailsLabelledBy: string;
  summaryLabelledBy: string;
};

export default function ConfirmationContentLayout({
  details,
  summary,
  testId,
  detailsTestId,
  summaryTestId,
  detailsLabelledBy,
  summaryLabelledBy
}: ConfirmationContentLayoutProps) {
  return (
    <div
      className="mt-6 grid min-w-0 gap-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(18rem,0.9fr)] lg:items-stretch"
      data-testid={testId}
      data-confirmation-content-grid
    >
      <article
        className="site-card min-w-0"
        data-testid={detailsTestId}
        data-confirmation-region="details"
        aria-labelledby={detailsLabelledBy}
      >
        {details}
      </article>
      <aside
        className="site-card min-w-0"
        data-testid={summaryTestId}
        data-confirmation-region="summary"
        aria-labelledby={summaryLabelledBy}
      >
        {summary}
      </aside>
    </div>
  );
}
