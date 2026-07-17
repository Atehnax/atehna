import { redirect } from 'next/navigation';

export const metadata = {
  title: 'Administracija podoba'
};

export default function AdminPodobaPage() {
  redirect('/admin/podoba/glavna-stran');
}
