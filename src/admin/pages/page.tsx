import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import AdminLoginForm from '@/admin/components/AdminLoginForm';

const ADMIN_SESSION_COOKIE = 'atehna_admin_session';

function expectedToken(username: string, password: string) {
  return Buffer.from(`${username}:${password}`).toString('base64');
}

export default async function AdminLoginPage() {
  const username = process.env.ADMIN_USERNAME ?? 'admin';
  const password = process.env.ADMIN_PASSWORD ?? 'admin';

  const cookieValue = (await cookies()).get(ADMIN_SESSION_COOKIE)?.value;
  if (cookieValue && cookieValue === expectedToken(username, password)) {
    redirect('/admin/orders');
  }

  return (
    <div className="flex w-full min-h-[70vh] items-center justify-center bg-slate-50 px-4 py-8">
      <AdminLoginForm />
    </div>
  );
}
