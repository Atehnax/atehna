type ConfirmationCustomerDetailsProps = {
  heading: string;
  headingId: string;
  name: string;
  email: string;
  address: string;
  testId: string;
};

export default function ConfirmationCustomerDetails({
  heading,
  headingId,
  name,
  email,
  address,
  testId
}: ConfirmationCustomerDetailsProps) {
  return (
    <section
      className="mt-6 border-t border-[color:var(--site-divider-color)] pt-6"
      data-testid={testId}
      data-confirmation-region="customer"
      aria-labelledby={headingId}
    >
      <h2 id={headingId} className="text-xl font-semibold sm:text-2xl">
        {heading}
      </h2>
      <dl className="mt-5 grid gap-x-6 gap-y-4 text-base sm:grid-cols-3">
        <div className="min-w-0">
          <dt className="leading-6 text-[color:var(--site-color-text-muted)]">
            Naročnik
          </dt>
          <dd className="mt-1 break-words text-base font-semibold leading-6 sm:text-lg">
            {name || '—'}
          </dd>
        </div>
        <div className="min-w-0">
          <dt className="leading-6 text-[color:var(--site-color-text-muted)]">
            Email
          </dt>
          <dd className="mt-1 break-words text-base font-semibold leading-6 sm:text-lg">
            {email ? (
              <a
                href={`mailto:${email}`}
                className="text-[color:var(--site-color-primary)] underline-offset-2 hover:underline"
              >
                {email}
              </a>
            ) : (
              '—'
            )}
          </dd>
        </div>
        <div className="min-w-0">
          <dt className="leading-6 text-[color:var(--site-color-text-muted)]">
            Naslov
          </dt>
          <dd className="mt-1 break-words text-base font-semibold leading-6 sm:text-lg">
            {address || '—'}
          </dd>
        </div>
      </dl>
    </section>
  );
}
