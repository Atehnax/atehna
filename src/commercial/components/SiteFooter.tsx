import Link from 'next/link';
import AtehnaLogo from '@/commercial/components/AtehnaLogo';

function BoxIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-6 w-6" fill="none">
      <path
        d="m12 3 7 4v10l-7 4-7-4V7l7-4Zm0 8 7-4m-7 4L5 7m7 4v10"
        stroke="currentColor"
        strokeWidth="1.65"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function UserIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-6 w-6" fill="none">
      <path
        d="M12 12.3a4.3 4.3 0 1 0 0-8.6 4.3 4.3 0 0 0 0 8.6Zm-7.2 8c.7-3.4 3.4-5.4 7.2-5.4s6.5 2 7.2 5.4"
        stroke="currentColor"
        strokeWidth="1.65"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function MailIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-6 w-6" fill="none">
      <path
        d="M4.5 6.5h15v11h-15v-11Zm.8.7 6.7 5.4 6.7-5.4"
        stroke="currentColor"
        strokeWidth="1.65"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function LocationIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-6 w-6" fill="none">
      <path
        d="M18.5 10.1c0 4.7-6.5 10.2-6.5 10.2s-6.5-5.5-6.5-10.2a6.5 6.5 0 0 1 13 0Zm-4.2 0a2.3 2.3 0 1 1-4.6 0 2.3 2.3 0 0 1 4.6 0Z"
        stroke="currentColor"
        strokeWidth="1.65"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-[#dde4ed] bg-white">
      <div className="mx-auto grid max-w-[1840px] items-center gap-6 px-5 py-5 sm:px-8 md:grid-cols-[1fr_2fr_1fr] lg:px-16">
        <Link href="/" prefetch={false} aria-label="Atehna domov" className="justify-self-start">
          <AtehnaLogo markOnly />
        </Link>

        <nav
          aria-label="Povezave v nogi"
          className="grid gap-4 text-sm text-[#05070a] sm:grid-cols-3 sm:items-start"
        >
          <Link
            href="/products"
            prefetch={false}
            className="flex flex-col items-start gap-2 transition hover:text-[color:var(--blue-500)] sm:items-center"
          >
            <span>Izdelki</span>
            <BoxIcon />
          </Link>
          <Link
            href="/about"
            prefetch={false}
            className="flex flex-col items-start gap-2 border-[#dde4ed] transition hover:text-[color:var(--blue-500)] sm:items-center sm:border-x"
          >
            <span>O nas</span>
            <UserIcon />
          </Link>
          <Link
            href="/contact"
            prefetch={false}
            className="flex flex-col items-start gap-2 transition hover:text-[color:var(--blue-500)] sm:items-center"
          >
            <span>Kontakt</span>
            <span className="flex gap-6 text-[#536070]">
              <MailIcon />
              <MailIcon />
              <LocationIcon />
            </span>
          </Link>
        </nav>

        <p className="text-left text-xs text-[#7b8491] md:text-right">© {year}</p>
      </div>
    </footer>
  );
}
