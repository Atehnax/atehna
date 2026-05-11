import Link from 'next/link';
import TechnicalPreview from '@/commercial/components/landing/TechnicalPreview';

function ArrowIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-6 w-6" fill="none">
      <path
        d="M4 12h14m-5-5 5 5-5 5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function HeroSection() {
  return (
    <section className="mx-auto max-w-[1840px] px-5 pb-5 pt-8 sm:px-8 lg:px-16 lg:pt-8">
      <div className="grid gap-7 lg:grid-cols-[36%_1fr] lg:items-center">
        <div className="py-8 lg:py-20">
          <div className="mb-10 h-[3px] w-9 rounded-full bg-[color:var(--blue-500)]" />
          <h1 className="max-w-[620px] text-[32px] font-bold leading-tight text-[#05070a] sm:text-[34px]">
            Oprema za tehnični pouk
          </h1>
          <p className="mt-4 max-w-[560px] text-lg leading-7 text-[#536070]">
            Izbrana oprema in materiali za sodoben pouk.
          </p>
          <div className="mt-9 flex flex-col gap-4 sm:flex-row sm:gap-8">
            <Link
              href="/products"
              prefetch={false}
              className="inline-flex h-14 w-full items-center justify-center gap-9 rounded-lg bg-[color:var(--blue-500)] px-7 text-lg font-medium text-white shadow-[0_10px_24px_rgba(25,130,191,0.18)] transition hover:bg-[color:var(--blue-600)] sm:w-[220px]"
            >
              <span>Izdelki</span>
              <ArrowIcon />
            </Link>
            <Link
              href="/contact"
              prefetch={false}
              className="inline-flex h-14 w-full items-center justify-center gap-9 rounded-lg border border-[color:var(--blue-500)] bg-white px-7 text-lg font-medium text-[color:var(--blue-500)] transition hover:bg-[color:var(--blue-50)] sm:w-[220px]"
            >
              <span>Kontakt</span>
              <ArrowIcon />
            </Link>
          </div>
        </div>
        <TechnicalPreview />
      </div>
    </section>
  );
}
