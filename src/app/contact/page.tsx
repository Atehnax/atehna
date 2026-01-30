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
          <form
            className="mt-4 space-y-4"
            action="mailto:info@atehna.si"
            method="post"
            encType="text/plain"
          >
            <div>
              <label className="text-sm font-medium text-slate-700" htmlFor="school">
                Naziv naročnika
              </label>
              <input
                id="school"
                name="school"
                type="text"
                required
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700" htmlFor="contact">
                Kontaktna oseba
              </label>
              <input
                id="contact"
                name="contact"
                type="text"
                required
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700" htmlFor="email">
                E-pošta
              </label>
              <input
                id="email"
                name="email"
                type="email"
                required
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700" htmlFor="message">
                Sporočilo
              </label>
              <textarea
                id="message"
                name="message"
                rows={4}
                required
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
              />
            </div>
            <button
              type="submit"
              className="w-full rounded-full bg-brand-600 px-6 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-700"
            >
              Pošlji povpraševanje
            </button>
            <p className="text-xs text-slate-500">
              Obrazec trenutno uporablja mailto povezavo. Za produkcijo ga lahko povežemo z vašo
              e-poštno storitvijo ali obrazcem v eUpravi.
            </p>
          </form>
        </div>
      </div>
    </div>
  );
}
