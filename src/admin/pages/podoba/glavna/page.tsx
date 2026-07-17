import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Administracija glavna stran'
};

export default async function AdminPodobaGlavnaPage() {
  redirect('/admin/podoba/glavna-stran');
}
