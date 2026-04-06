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
      className="relative inline-flex h-6 w-[50px] items-center rounded-full border-2 border-[#3b4754] bg-[#f2f2f1] transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3e67d6]/50 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
    >
      <span aria-hidden="true" className={`pointer-events-none absolute top-1/2 -translate-y-1/2 transition-all duration-200 ${checked ? 'left-1 text-[#1fa56a]' : 'right-1 text-[#df4f67]'}`}>
        {checked ? (
          <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M1.5 12s3.75-6.75 10.5-6.75S22.5 12 22.5 12s-3.75 6.75-10.5 6.75S1.5 12 1.5 12Z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M1.5 12s3.75-6.75 10.5-6.75S22.5 12 22.5 12s-3.75 6.75-10.5 6.75S1.5 12 1.5 12Z" />
            <circle cx="12" cy="12" r="3" />
            <path d="M3 3 21 21" />
          </svg>
        )}
      </span>
      <span
        aria-hidden="true"
        className={`absolute left-[-1px] top-1/2 z-10 h-5 w-5 -translate-y-1/2 rounded-full border border-[#37424f] bg-[#4f5b68] shadow-[inset_0_1px_2px_rgba(255,255,255,0.08),inset_0_-3px_6px_rgba(0,0,0,0.22),0_4px_8px_rgba(20,30,45,0.33)] transition-transform duration-200 ${
          checked ? 'translate-x-[28px]' : 'translate-x-0'
        }`}
      >
        <span
          className={`absolute left-1/2 top-1/2 h-[4.5px] w-[4.5px] -translate-x-1/2 -translate-y-1/2 rounded-full ${
            checked ? 'bg-[#51ee87] shadow-[0_0_6px_rgba(81,238,135,0.82)]' : 'bg-[#77808b]'
          }`}
        />
      </span>
    </button>
  );
}
