export function StatusToggle({
  checked,
  onToggle,
  disabled,
  ariaLabel
}: {
  checked: boolean;
  onToggle: () => void;
  disabled?: boolean;
  ariaLabel: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      disabled={disabled}
      onPointerDown={(event) => event.stopPropagation()}
      onClick={(event) => {
        event.stopPropagation();
        onToggle();
      }}
      className={`relative inline-flex h-7 w-14 items-center overflow-hidden rounded-full border-[2.25px] border-[#2f3b48] transition-[background-color,box-shadow] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3e67d6]/50 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 ${
        checked ? 'bg-[#afd9bd]' : 'bg-[#d9848f]'
      }`}
    >
      <span
        aria-hidden="true"
        className={`pointer-events-none absolute left-[6.5px] top-1/2 -translate-y-1/2 text-[#46515e] transition-[opacity,transform] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${
          checked ? 'translate-x-0 opacity-100' : 'translate-x-1 opacity-0'
        }`}
      >
        <svg viewBox="0 0 24 24" className="h-[16px] w-[16px]" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M1.5 12s3.75-6.75 10.5-6.75S22.5 12 22.5 12s-3.75 6.75-10.5 6.75S1.5 12 1.5 12Z" />
          <circle cx="12" cy="12" r="3" />
        </svg>
      </span>
      <span
        aria-hidden="true"
        className={`pointer-events-none absolute right-[6.5px] top-1/2 -translate-y-1/2 text-white transition-[opacity,transform] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${
          checked ? '-translate-x-1 opacity-0' : 'translate-x-0 opacity-100'
        }`}
      >
        <svg viewBox="0 0 24 24" className="h-[16px] w-[16px]" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M1.5 12s3.75-6.75 10.5-6.75S22.5 12 22.5 12s-3.75 6.75-10.5 6.75S1.5 12 1.5 12Z" />
          <circle cx="12" cy="12" r="3" />
          <path d="M3.5 3.5 20.5 20.5" />
        </svg>
      </span>
      <span
        aria-hidden="true"
        className={`absolute left-[-2px] top-1/2 z-10 h-[29px] w-[29px] -translate-y-1/2 rounded-full border-[2.25px] border-[#2f3b48] bg-[#46515e] shadow-[inset_0_2px_3px_rgba(255,255,255,0.08),inset_0_-5px_8px_rgba(20,29,40,0.34),0_4px_8px_rgba(20,30,45,0.24)] transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${
          checked ? 'translate-x-[31px]' : 'translate-x-0'
        }`}
      />
    </button>
  );
}
