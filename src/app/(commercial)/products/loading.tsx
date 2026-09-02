export default function ProductsLoading() {
  return (
    <div
      className="container-base site-section"
      role="status"
      aria-label="Nalaganje kataloga"
    >
      <div className="h-4 w-40 animate-pulse rounded bg-[color:var(--site-color-surface-muted)]" />
      <div className="mt-6 h-10 w-2/3 max-w-xl animate-pulse rounded bg-[color:var(--site-color-surface-muted)]" />
      <div className="mt-4 h-5 w-full max-w-2xl animate-pulse rounded bg-[color:var(--site-color-surface-muted)]" />
      <div className="storefront-product-grid mt-10">
        {Array.from({ length: 8 }, (_, index) => (
          <div
            key={index}
            className="site-panel overflow-hidden"
            aria-hidden="true"
          >
            <div className="aspect-square animate-pulse bg-[color:var(--site-color-surface-muted)]" />
            <div className="space-y-3 p-4">
              <div className="h-4 w-1/3 animate-pulse rounded bg-[color:var(--site-color-surface-muted)]" />
              <div className="h-6 w-4/5 animate-pulse rounded bg-[color:var(--site-color-surface-muted)]" />
              <div className="h-5 w-1/2 animate-pulse rounded bg-[color:var(--site-color-surface-muted)]" />
            </div>
          </div>
        ))}
      </div>
      <span className="sr-only">Nalaganje …</span>
    </div>
  );
}
