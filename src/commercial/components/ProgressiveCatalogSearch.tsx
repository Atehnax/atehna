'use client';

import dynamic from 'next/dynamic';

function CatalogSearchShell() {
  return (
    <div className="relative w-full rounded-full border border-slate-300 bg-white px-4 py-2 text-sm text-slate-400 shadow-sm">
      Poiščite izdelek...
    </div>
  );
}

const CatalogSearch = dynamic(() => import('@/commercial/features/products/CatalogSearch'), {
  ssr: false,
  loading: () => <CatalogSearchShell />
});

export default function ProgressiveCatalogSearch(props: { placeholder?: string }) {
  return <CatalogSearch {...props} />;
}
