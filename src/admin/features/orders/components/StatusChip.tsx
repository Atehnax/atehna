import { AdminInfoChip } from '@/shared/ui/badge';
import { getStatusChipVariant, getStatusLabel, isOrderStatus } from '@/shared/domain/order/orderStatus';

type Props = {
  status: string;
  isSaving?: boolean;
  className?: string;
};

export default function StatusChip({ status, isSaving = false, className }: Props) {
  const isKnown = isOrderStatus(status);

  return (
    <AdminInfoChip
      label={getStatusLabel(status)}
      variant={getStatusChipVariant(status)}
      isKnown={isKnown}
      isSaving={isSaving}
      className={className}
    />
  );
}
