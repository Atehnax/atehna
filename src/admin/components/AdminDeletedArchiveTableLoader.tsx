import AdminDeletedArchiveTable from '@/admin/components/AdminDeletedArchiveTable';

type ArchiveEntryTuple = readonly [
  id: number,
  itemType: 'order' | 'pdf',
  orderId: number | null,
  documentId: number | null,
  label: string,
  orderCreatedAt: string | null,
  customerName: string | null,
  address: string | null,
  customerType: string | null,
  deletedAt: string,
  expiresAt: string
];

export default function AdminDeletedArchiveTableLoader({ initialEntries }: { initialEntries: ArchiveEntryTuple[] }) {
  return <AdminDeletedArchiveTable initialEntries={initialEntries} />;
}
