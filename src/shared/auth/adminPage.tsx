import 'server-only';

import { cache, type ComponentType, type ReactNode } from 'react';
import { redirect } from 'next/navigation';
import { getAdminPageSession } from '@/shared/auth/adminSession';

export const requireAdminPageSession = cache(async () => {
  const session = await getAdminPageSession();
  if (!session) redirect('/admin');
  return session;
});

// Guard the leaf page before it can load or render private data. A layout alone
// does not prevent a nested Server Component from producing an RSC payload.
export function withAdminPage<Props extends object>(
  Page: (props: Props) => ReactNode | void | Promise<ReactNode | void>
) {
  return async function AuthenticatedAdminPage(props: Props) {
    await requireAdminPageSession();
    const ProtectedPage = Page as ComponentType<Props>;
    return <ProtectedPage {...props} />;
  };
}

