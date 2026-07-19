import { permanentRedirect } from 'next/navigation';

export default function LegacyAdminGlobalStylePage() {
  permanentRedirect('/admin/podoba/globalni-parametri');
}
