type OrderLoadingStateProps = {
  heading: string;
  description: string;
  testId: string;
  spinnerTestId?: string;
  ariaLabel?: string;
};

export default function OrderLoadingState({
  heading,
  description,
  testId,
  spinnerTestId,
  ariaLabel
}: OrderLoadingStateProps) {
  return (
    <div
      className="site-panel mx-auto flex min-h-[24rem] max-w-2xl flex-col items-center justify-center p-8 text-center"
      role="status"
      aria-live="polite"
      aria-atomic="true"
      aria-busy="true"
      aria-label={ariaLabel}
      data-testid={testId}
    >
      <span
        className="relative block h-9 w-9"
        aria-hidden="true"
        data-testid={spinnerTestId}
      >
        <span className="absolute inset-0 rounded-full border-[3px] border-[color:var(--site-border-color)] opacity-60" />
        <span className="absolute inset-0 animate-spin rounded-full border-[3px] border-transparent border-t-[color:var(--site-color-primary)] [animation-duration:800ms] motion-reduce:animate-none" />
      </span>
      <h1 className="site-heading-2 mt-6">{heading}</h1>
      <p className="site-paragraph mt-3 max-w-md">{description}</p>
    </div>
  );
}
