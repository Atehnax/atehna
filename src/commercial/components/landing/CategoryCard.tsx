import Image from 'next/image';
import Link from 'next/link';

type CategoryCardProps = {
  title: string;
  href: string;
  image?: string | null;
};

function ArrowIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-6 w-6" fill="none">
      <path
        d="M4 12h14m-5-5 5 5-5 5"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function CategoryCard({ title, href, image }: CategoryCardProps) {
  return (
    <Link
      href={href}
      prefetch={false}
      className="group relative h-[220px] overflow-hidden rounded-[10px] border border-[#dde4ed] bg-white p-7 transition hover:-translate-y-0.5 hover:border-[#b7c8e6] hover:shadow-[0_14px_34px_rgba(15,23,42,0.06)]"
    >
      <h2 className="relative z-[2] max-w-[54%] text-[21px] font-medium leading-snug text-[#05070a]">
        {title}
      </h2>
      {image ? (
        <div className="absolute inset-0 z-[1] transition duration-300 group-hover:scale-[1.02]">
          <Image
            src={image}
            alt={title}
            fill
            loading="lazy"
            sizes="(min-width: 1280px) 22vw, (min-width: 768px) 45vw, 90vw"
            className="object-cover object-center grayscale saturate-0 transition-[filter,transform] duration-500 group-hover:grayscale-0 group-hover:saturate-100 group-focus-visible:grayscale-0 group-focus-visible:saturate-100 motion-reduce:transition-none"
          />
        </div>
      ) : null}
      <span className="absolute bottom-7 left-7 z-[2] text-[color:var(--blue-500)] transition group-hover:translate-x-1">
        <ArrowIcon />
      </span>
    </Link>
  );
}
