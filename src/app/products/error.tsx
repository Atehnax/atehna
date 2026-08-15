'use client';

import Link from 'next/link';
import { useEffect } from 'react';

export default function ProductsError({
  error,
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[storefront.products] render failed', {
      message: error.message,
      digest: error.digest
    });
  }, [error]);

  return (
    <div className="container-base site-section">
      <div
        className="site-panel mx-auto max-w-2xl border-[color:var(--site-color-danger)] p-8 text-center"
        role="alert"
      >
        <p className="site-eyebrow">Napaka kataloga</p>
        <h1 className="site-heading-2 mt-2">
          Izdelkov trenutno ni mogoče prikazati
        </h1>
        <p className="site-paragraph mt-3">
          Poskusite ponovno. Če težava ostane, se obrnite na našo ekipo.
        </p>
        <button
          type="button"
          onClick={reset}
          className="site-button site-button--primary mt-6"
        >
          Poskusi znova
        </button>
        <Link
          href="/"
          className="site-button site-button--secondary mt-3 inline-flex items-center justify-center"
        >
          Na domačo stran
        </Link>
      </div>
    </div>
  );
}
