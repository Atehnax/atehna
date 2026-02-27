'use client';

import type { ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import AdminSidebar from '@/components/admin/AdminSidebar';

export default function AdminLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const isLoginPage = pathname === '/admin';

  if (isLoginPage) {
    return <div className="admin-scope min-h-screen bg-slate-50">{children}</div>;
  }

  return (
    <div className="admin-scope min-h-screen bg-slate-50">
      <div className="flex w-full items-stretch">
        <AdminSidebar />
        <main className="min-w-0 flex-1 px-6 py-6">{children}</main>
      </div>
    </div>
  );
}
