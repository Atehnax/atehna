import MdxContent from '@/commercial/components/MdxContent';
import { getPageContent } from '@/commercial/content/content';

type StaticMdxPageProps = {
  slug: string;
};

export default function StaticMdxPage({ slug }: StaticMdxPageProps) {
  const page = getPageContent(slug);

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
