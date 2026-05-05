import { AdminInfoChip } from '@/shared/ui/badge';
import { getPaymentBadgeVariant, getPaymentLabel, isPaymentStatus } from '@/shared/domain/order/paymentStatus';

type Props = {
  status?: string | null;
  isSaving?: boolean;
  className?: string;
};

export default function PaymentChip({ status, isSaving = false, className }: Props) {
  const isKnown = Boolean(status && isPaymentStatus(status));

  return (
    <AdminInfoChip
      label={getPaymentLabel(status)}
      variant={getPaymentBadgeVariant(status)}
      isKnown={isKnown}
      isSaving={isSaving}
      className={className}
    />
  );
}
