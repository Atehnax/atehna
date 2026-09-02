import Link from 'next/link';

export default function ProductNotFound() {
  return (
    <div className="container-base site-section">
      <div className="site-panel mx-auto max-w-2xl border-dashed p-8 text-center">
        <p className="site-eyebrow">Izdelek ni na voljo</p>
        <h1 className="site-heading-2 mt-2">
          Te strani ni več v aktualnem katalogu
        </h1>
        <p className="site-paragraph mt-3">
          Izdelek je lahko arhiviran, neobjavljen ali pa se je njegov naslov
          spremenil.
        </p>
        <Link
          href="/products"
          className="site-button site-button--primary mt-6 inline-flex items-center justify-center"
        >
          Poglej aktualne izdelke
        </Link>
      </div>
    </div>
  );
}
