'use client';

import type { ReactNode } from 'react';
import { useState } from 'react';
import { usePathname } from 'next/navigation';
import AdminSidebar from '@/admin/components/AdminSidebar';
import { ToastProvider, Toaster } from '@/shared/ui/toast';

export default function AdminLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const isLoginPage = pathname === '/admin';
  const [isSidebarExpanded, setIsSidebarExpanded] = useState(false);

  if (isLoginPage) {
    return (
      <ToastProvider>
        <div className="admin-scope flex w-full flex-1 bg-slate-50">{children}</div>
        <Toaster />
      </ToastProvider>
    );
  }

  return (
    <ToastProvider>
      <div className="admin-scope flex min-h-screen w-full flex-1 bg-slate-50">
        <div className="flex min-h-screen w-full flex-1 items-stretch">
          <AdminSidebar onExpandedChange={setIsSidebarExpanded} />
          <main
            className={`min-w-0 flex-1 overflow-x-hidden py-6 pl-20 pr-4 transition-[filter] duration-300 ease-out md:pl-24 md:pr-6 lg:pl-24 lg:pr-7 ${
              isSidebarExpanded ? 'blur-[2px]' : 'blur-0'
            }`}
          >
            <div className="mx-auto w-full max-w-[1280px]">{children}</div>
          </main>
        </div>
      </div>
      <Toaster />
    </ToastProvider>
  );
}
