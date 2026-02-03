import MdxContent from '@/components/MdxContent';
import { getPageContent } from '@/lib/content';

export const metadata = {
  title: 'Kontakt'
};

export default function ContactPage() {
  const page = getPageContent('contact');

  return (
    <div className="container-base py-12">
      <div className="grid gap-10 lg:grid-cols-[1.1fr_0.9fr]">
        <div>
          <h1 className="text-3xl font-semibold text-slate-900">{page.title}</h1>
          <div className="mt-6">
            <MdxContent source={page.content} />
          </div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-semibold text-slate-900">Pošljite povpraševanje</h2>
          <p className="mt-3 text-sm text-slate-600">
            Trenutno zbiramo naročila in povpraševanja preko naročilnega postopka. Če potrebujete
            ponudbo po meri, pripravite seznam artiklov in nas kontaktirajte po telefonu.
          </p>
          <div className="mt-4 rounded-xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
            <p className="font-semibold text-slate-900">Kontaktna točka</p>
            <p className="mt-1">Ponedeljek – petek, 8:00–16:00</p>
            <p className="mt-1">Telefon: 01 555 22 11</p>
          </div>
        </div>
      </div>
    </div>
  );
}
