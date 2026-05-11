'use client';

import type { ReactNode } from 'react';
import { usePathname } from 'next/navigation';

export default function CommercialScaleFrame({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const isAdminPath = pathname?.startsWith('/admin');

  return (
    <div
      className={
        isAdminPath
          ? 'flex min-h-screen flex-1 flex-col'
          : 'commercial-storefront-scale flex min-h-screen flex-1 flex-col'
      }
    >
      {children}
    </div>
  );
}
