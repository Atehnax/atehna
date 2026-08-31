type AdminNotificationCountBadgeProps = {
  count: number;
  label: string;
  className?: string;
};

const classNames = (...parts: Array<string | false | null | undefined>) =>
  parts.filter(Boolean).join(' ');

export default function AdminNotificationCountBadge({
  count,
  label,
  className
}: AdminNotificationCountBadgeProps) {
  const normalizedCount = Number.isFinite(count) ? Math.max(0, Math.trunc(count)) : 0;
  if (normalizedCount === 0) return null;

  return (
    <span
      title={label}
      data-admin-notification-count={normalizedCount}
      className={classNames(
        "relative -top-px inline-flex h-[15px] min-w-[15px] shrink-0 items-center justify-center rounded-full border border-rose-200/80 bg-rose-50/80 px-1 font-['Inter',system-ui,sans-serif] text-[9px] font-semibold leading-none tabular-nums text-rose-600/90",
        className
      )}
    >
      <span aria-hidden="true">{normalizedCount > 99 ? '99+' : normalizedCount}</span>
      <span className="sr-only">{label}</span>
    </span>
  );
}

export type { AdminNotificationCountBadgeProps };
