import MdxContent from '@/commercial/components/MdxContent';
import { getPageContent } from '@/commercial/content/content';

type StaticMdxPageProps = {
  slug: string;
};

export default function StaticMdxPage({ slug }: StaticMdxPageProps) {
  const page = getPageContent(slug);

  return (
    <div className="container-base site-section">
      <div className="site-content-measure w-full">
        <h1 className="site-heading-1 text-3xl font-semibold text-slate-900">{page.title}</h1>
        <div className="mt-6">
          <MdxContent source={page.content} />
        </div>
      </div>
    </div>
  );
}
