import Chip, { type ChipProps } from './chip';

type AdminInfoChipProps = {
  label: string;
  variant: ChipProps['variant'];
  isKnown?: boolean;
  isSaving?: boolean;
  className?: string;
};

export default function AdminInfoChip({
  label,
  variant,
  isKnown = true,
  isSaving = false,
  className
}: AdminInfoChipProps) {
  return (
    <Chip
      size="adminStatusInfo"
      variant={variant}
      className={`${isKnown ? 'rounded-md' : 'rounded-md text-slate-400'} ${className ?? ''}`.trim()}
    >
      <span>{label}</span>
      {isSaving && <span className="ml-1 text-[10px]">{'\u2026'}</span>}
    </Chip>
  );
}

export type { AdminInfoChipProps };
