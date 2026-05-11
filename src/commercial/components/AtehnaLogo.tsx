type AtehnaLogoProps = {
  markOnly?: boolean;
  className?: string;
};

export default function AtehnaLogo({ markOnly = false, className = '' }: AtehnaLogoProps) {
  return (
    <span className={`inline-flex items-center gap-3 text-[color:var(--blue-500)] ${className}`}>
      <svg
        aria-hidden="true"
        viewBox="0 0 48 48"
        className={markOnly ? 'h-11 w-11' : 'h-9 w-9 sm:h-10 sm:w-10'}
        fill="none"
      >
        <path d="M24 3 45 45h-9.3L24 20.6 12.3 45H3L24 3Z" fill="currentColor" />
        <path d="M24 12.4 39.7 45h-7.1L24 27.2 15.4 45H8.3L24 12.4Z" fill="white" />
        <path d="M19 24.7h10l3 6.4H16l3-6.4Z" fill="currentColor" />
      </svg>
      {!markOnly ? (
        <span className="text-3xl font-bold leading-none tracking-[0.02em] sm:text-[34px]">
          ATEHNA
        </span>
      ) : null}
    </span>
  );
}
