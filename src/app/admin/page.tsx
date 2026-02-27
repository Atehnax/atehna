import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import AdminLoginForm from '@/components/admin/AdminLoginForm';

const ADMIN_SESSION_COOKIE = 'atehna_admin_session';

function expectedToken(username: string, password: string) {
  return Buffer.from(`${username}:${password}`).toString('base64');
}

export default function AdminLoginPage() {
  const username = process.env.ADMIN_USERNAME ?? 'admin';
  const password = process.env.ADMIN_PASSWORD ?? 'admin';

  const cookieValue = cookies().get(ADMIN_SESSION_COOKIE)?.value;
  if (cookieValue && cookieValue === expectedToken(username, password)) {
    redirect('/admin/orders');
  }

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-14">
      <AdminLoginForm />
    </div>
  );
}
