'use client';

import type { ReactNode } from 'react';
import { useState } from 'react';
import { usePathname } from 'next/navigation';
import AdminSidebar from '@/admin/components/AdminSidebar';

export default function AdminLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const isLoginPage = pathname === '/admin';
  const [isSidebarExpanded, setIsSidebarExpanded] = useState(false);

  if (isLoginPage) {
    return <div className="admin-scope flex w-full flex-1 bg-slate-50">{children}</div>;
  }

  return (
    <div className="admin-scope flex min-h-full w-full flex-1 bg-slate-50">
      <div className="flex min-h-full w-full flex-1 items-stretch">
        <AdminSidebar onExpandedChange={setIsSidebarExpanded} />
        <main
          className={`min-w-0 flex-1 overflow-x-hidden py-6 pl-7 pr-4 transition-[filter] duration-300 ease-out md:pl-9 md:pr-6 lg:pl-10 lg:pr-7 ${
            isSidebarExpanded ? 'blur-[2px]' : 'blur-0'
          }`}
        >
          <div className="mx-auto w-full max-w-[1280px]">{children}</div>
        </main>
      </div>
    </div>
  );
}
