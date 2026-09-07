'use client';

import { useSearchParams, useRouter } from 'next/navigation';
import EuiTabs from '@/shared/ui/eui-tabs';
const tabs = [{ value: 'orders', label: 'Izbrisana naročila' }, { value: 'articles', label: 'Izbrisani artikli' }];
export default function AdminTrashTabs() {
  const params = useSearchParams();
  const router = useRouter();
  return <EuiTabs value={params.get('view') === 'articles' ? 'articles' : 'orders'} onChange={(value) => router.push(value === 'articles' ? '/admin/trash?view=articles' : '/admin/trash')} tabs={tabs} />;
}
