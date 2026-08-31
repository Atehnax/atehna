'use client';

export function AdminSwitch({
  checked,
  disabled = false,
  ariaLabel,
  onChange
}: {
  checked: boolean;
  disabled?: boolean;
  ariaLabel: string;
  onChange: (checked: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full border transition ${
        checked
          ? 'border-[color:var(--blue-500)] bg-[color:var(--blue-500)]'
          : 'border-slate-300 bg-slate-200'
      } disabled:cursor-not-allowed disabled:opacity-60`}
    >
      <span
        aria-hidden="true"
        className={`inline-block h-5 w-5 rounded-full bg-white shadow transition-transform ${
          checked ? 'translate-x-6' : 'translate-x-0.5'
        }`}
      />
    </button>
  );
}
