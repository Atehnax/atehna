import { getStatusChipClassName, getStatusLabel } from '@/lib/orderStatus';

type Props = {
  status: string;
  isSaving?: boolean;
};

export default function StatusChip({ status, isSaving = false }: Props) {
  return (
    <span
      className={`inline-flex h-6 min-w-[104px] items-center justify-center rounded-full border px-2 text-[11px] font-semibold leading-none ${getStatusChipClassName(
        status
      )}`}
    >
      <span>{getStatusLabel(status)}</span>
      {isSaving && <span className="ml-1 text-[10px]">…</span>}
    </span>
  );
}
