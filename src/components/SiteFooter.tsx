import Link from 'next/link';

const legalLinks = [
  { href: '/privacy', label: 'Politika zasebnosti' },
  { href: '/terms', label: 'Splošni pogoji' },
  { href: '/cookies', label: 'Piškotki' }
];

export default function SiteFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-slate-200 bg-white">
      <div className="container-base grid gap-8 py-10 md:grid-cols-[2fr_1fr]">
        <div>
          <p className="text-lg font-semibold text-slate-900">Atehna d.o.o.</p>
          <p className="mt-2 text-sm text-slate-600">
            Zanesljiv partner pri opremljanju delavnic, projektnih prostorov in tehničnih
            potreb.
          </p>
          <p className="mt-4 text-sm text-slate-500">
            © {year} Atehna. Vse pravice pridržane.
          </p>
        </div>
        <div className="space-y-3 text-sm text-slate-600">
          <p className="font-semibold text-slate-900">Pravno</p>
          <ul className="space-y-2">
            {legalLinks.map((link) => (
              <li key={link.href}>
                <Link href={link.href} className="transition hover:text-brand-600">
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </footer>
  );
}
