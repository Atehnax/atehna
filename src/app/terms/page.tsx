import MdxContent from '@/components/MdxContent';
import { getPageContent } from '@/lib/content';

export const metadata = {
  title: 'Splošni pogoji'
};

export default function TermsPage() {
  const page = getPageContent('terms');

  return (
    <div className="container-base py-12">
      <div className="max-w-3xl">
        <h1 className="text-3xl font-semibold text-slate-900">{page.title}</h1>
        <div className="mt-6">
          <MdxContent source={page.content} />
        </div>
      </div>
    </div>
  );
}
