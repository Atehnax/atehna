import type { ReactNode } from 'react';
import AdminStrankeTabs from '@/admin/features/stranke/components/AdminStrankeTabs';
import { AdminPageHeader } from '@/shared/ui/admin-primitives';

export const metadata = {
  title: 'Seznam strank'
};

export default function AdminStrankeLayout({ children }: { children: ReactNode }) {
  return (
    <div className="w-full space-y-4">
      <AdminPageHeader title="Seznam strank" />
      <AdminStrankeTabs />
      {children}
    </div>
  );
}
