import { redirect } from 'next/navigation';

export const metadata = {
  title: 'Seznam strank'
};

export default function AdminKupciPage() {
  redirect('/admin/stranke/vse');
}
