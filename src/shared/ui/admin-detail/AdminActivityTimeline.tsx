export type AdminActivityTimelineItem = {
  id: string | number;
  occurredAt: string;
  timestampKnown: boolean;
  timestampLabel: string;
  compactLabel: string;
  fullLabel: string;
};

export type AdminActivityTimelineProps = {
  testId: string;
  ariaLabel: string;
  progressAriaLabel: string;
  items: readonly AdminActivityTimelineItem[];
  emptyMessage: string;
  loading?: boolean;
  error?: boolean;
  loadingMessage?: string;
  errorMessage?: string;
  messageMinHeightClassName?: string;
};

export function AdminActivityTimeline({
  testId,
  ariaLabel,
  progressAriaLabel,
  items,
  emptyMessage,
  loading = false,
  error = false,
  loadingMessage = 'Nalaganje dejavnosti …',
  errorMessage = 'Dejavnosti trenutno ni mogoče prikazati.',
  messageMinHeightClassName = 'min-h-9'
}: AdminActivityTimelineProps) {
  const messageClassName = `flex ${messageMinHeightClassName} items-center text-[11px] text-slate-500`;

  return (
    <section
      className="min-w-0"
      data-testid={testId}
      aria-label={ariaLabel}
      aria-live="polite"
    >
      {loading ? <p className={messageClassName}>{loadingMessage}</p> : null}
      {!loading && error ? <p className={messageClassName}>{errorMessage}</p> : null}
      {!loading && !error && items.length === 0 ? (
        <p className={messageClassName}>{emptyMessage}</p>
      ) : null}

      {!loading && !error && items.length > 0 ? (
        <div className="overflow-x-auto">
          <ol
            className={[
              'relative flex min-w-max justify-between gap-6',
              items.length > 1 ? 'before:absolute before:bottom-2 before:left-2 before:right-2 before:h-0.5 before:translate-y-1/2 before:bg-emerald-500' : ''
            ].join(' ')}
            aria-label={progressAriaLabel}
          >
            {items.map((item, index) => (
              <li
                key={item.id}
                className="group min-w-[112px] text-center first:text-left last:text-right only:text-left"
                aria-current={index === items.length - 1 ? 'step' : undefined}
              >
                <div className="min-h-4">
                  <p
                    className="whitespace-nowrap text-[10px] leading-4 text-slate-500"
                    title={item.fullLabel}
                    aria-label={item.fullLabel}
                    data-activity-compact-label
                  >
                    <span className="font-semibold text-slate-700">{item.compactLabel}</span>
                    {' · '}
                    {item.timestampKnown ? (
                      <time dateTime={item.occurredAt}>{item.timestampLabel}</time>
                    ) : (
                      <span data-activity-timestamp-unknown>{item.timestampLabel}</span>
                    )}
                  </p>
                </div>
                <div className="relative mt-1 flex h-4 items-center justify-center group-first:justify-start group-last:justify-end group-only:justify-start" aria-hidden>
                  <span className={[
                    'relative z-10 flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500 text-white',
                    index === items.length - 1 ? 'border border-emerald-500 bg-white p-0.5' : ''
                  ].join(' ')}>
                    {index === items.length - 1 ? (
                      <span className="h-full w-full rounded-full bg-emerald-500" />
                    ) : (
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                        <path d="m5 12 4 4L19 6" />
                      </svg>
                    )}
                  </span>
                </div>
              </li>
            ))}
          </ol>
        </div>
      ) : null}
    </section>
  );
}
