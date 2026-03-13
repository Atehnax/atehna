import MdxContent from '@/app/components/MdxContent';
import { getPageContent } from '@/product/lib/content';

export const metadata = {
  title: 'Kako naročiti'
};

export default function HowSchoolsOrderPage() {
  const page = getPageContent('how-schools-order');

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
