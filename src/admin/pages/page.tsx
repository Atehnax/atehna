import { redirect } from 'next/navigation';
import AdminLoginForm from '@/admin/components/AdminLoginForm';
import { getAdminPageSession } from '@/shared/auth/adminSession';
import { normalizeAdminReturnPath } from '@/shared/auth/adminReturnPath';

type AdminLoginPageProps = {
  searchParams?: Promise<{ next?: string | string[]; passwordChanged?: string }>;
};

export default async function AdminLoginPage({
  searchParams
}: AdminLoginPageProps) {
  const params = await searchParams;
  const requestedNext = Array.isArray(params?.next)
    ? params.next[0]
    : params?.next;
  const nextPath = normalizeAdminReturnPath(requestedNext);
  if (await getAdminPageSession()) {
    redirect(nextPath);
  }

  return (
    <div className="flex w-full min-h-[70vh] items-center justify-center bg-slate-50 px-4 py-8">
      <AdminLoginForm nextPath={nextPath} passwordChanged={params?.passwordChanged === '1'} />
    </div>
  );
}
