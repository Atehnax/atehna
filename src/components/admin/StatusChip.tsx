import { getStatusChipClassName, getStatusLabel } from '@/lib/orderStatus';

type Props = {
  status: string;
  isSaving?: boolean;
};

export default function StatusChip({ status, isSaving = false }: Props) {
  return (
    <span
      className={`mx-auto inline-flex h-7 min-w-[120px] items-center justify-center rounded-full border px-3 text-xs font-semibold leading-none ${getStatusChipClassName(
        status
      )}`}
    >
      <span>{getStatusLabel(status)}</span>
      {isSaving && <span className="ml-1 text-[10px]">…</span>}
    </span>
  );
}
