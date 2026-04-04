import { Chip } from '@/shared/ui/badge';
import { getStatusChipVariant, getStatusLabel, isOrderStatus } from '@/shared/domain/order/orderStatus';

type Props = {
  status: string;
  isSaving?: boolean;
};

export default function StatusChip({ status, isSaving = false }: Props) {
  const isKnown = isOrderStatus(status);

  return (
    <Chip variant={getStatusChipVariant(status)} className={isKnown ? 'rounded-md' : 'rounded-md text-slate-400'}>
      <span>{getStatusLabel(status)}</span>
      {isSaving && <span className="ml-1 text-[10px]">…</span>}
    </Chip>
  );
}
