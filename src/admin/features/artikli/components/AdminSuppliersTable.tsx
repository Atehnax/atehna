'use client';

import AdminSchoolsTable from '@/admin/features/stranke/components/AdminSchoolsTable';
import type { SupplierDirectoryData } from '@/shared/domain/supplierDirectory';

export default function AdminSuppliersTable({ initialDirectory }: { initialDirectory: SupplierDirectoryData }) {
  return <AdminSchoolsTable initialDirectory={initialDirectory} supplierArticles={initialDirectory.articles} />;
}