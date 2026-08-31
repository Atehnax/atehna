export type AdminActivityTimelineItem = {
  id: string | number;
  occurredAt: string;
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
  messageMinHeightClassName = 'min-h-[32px]'
}: AdminActivityTimelineProps) {
  const messageClassName = `flex ${messageMinHeightClassName} items-center justify-center text-[11px] text-slate-500`;

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
        <div className="-mx-1 overflow-x-auto px-1 pb-1">
          <ol className="flex min-w-max lg:min-w-full" aria-label={progressAriaLabel}>
            {items.map((item, index) => (
              <li
                key={item.id}
                className="min-w-[112px] flex-1 text-center"
                aria-current={index === items.length - 1 ? 'step' : undefined}
              >
                <div className="min-h-[16px] px-1">
                  <p
                    className="truncate whitespace-nowrap text-[9px] leading-3 text-slate-500"
                    title={item.fullLabel}
                    aria-label={item.fullLabel}
                    data-activity-compact-label
                  >
                    <span className="font-semibold text-slate-700">{item.compactLabel}</span>
                    {' · '}
                    <time dateTime={item.occurredAt}>{item.timestampLabel}</time>
                  </p>
                </div>
                <div className="relative mt-1 flex h-3 items-center justify-center" aria-hidden>
                  {index > 0 ? (
                    <span className="absolute left-0 right-1/2 top-1/2 h-px -translate-y-1/2 bg-emerald-300" />
                  ) : null}
                  {index < items.length - 1 ? (
                    <span className="absolute left-1/2 right-0 top-1/2 h-px -translate-y-1/2 bg-emerald-300" />
                  ) : null}
                  <span className="relative z-10 h-2.5 w-2.5 rounded-full border-2 border-white bg-emerald-500 shadow-[0_0_0_1px_rgba(16,185,129,0.35)]" />
                </div>
              </li>
            ))}
          </ol>
        </div>
      ) : null}
    </section>
  );
}
