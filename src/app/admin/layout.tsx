'use client';

import type { ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import AdminSidebar from '@/admin/components/AdminSidebar';

export default function AdminLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const isLoginPage = pathname === '/admin';

  if (isLoginPage) {
    return <div className="admin-scope flex w-full flex-1 bg-slate-50">{children}</div>;
  }

  return (
    <div className="admin-scope flex min-h-full w-full flex-1 bg-slate-50">
      <div className="flex min-h-full w-full flex-1 items-stretch">
        <AdminSidebar />
        <main className="min-w-0 flex-1 overflow-x-hidden px-6 py-6">{children}</main>
      </div>
    </div>
  );
}
