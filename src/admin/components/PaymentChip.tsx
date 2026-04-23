import { Chip } from '@/shared/ui/badge';
import { getPaymentBadgeVariant, getPaymentLabel, isPaymentStatus } from '@/shared/domain/order/paymentStatus';

type Props = {
  status?: string | null;
  isSaving?: boolean;
  className?: string;
};

export default function PaymentChip({ status, isSaving = false, className }: Props) {
  const isKnown = Boolean(status && isPaymentStatus(status));

  return (
    <Chip
      variant={getPaymentBadgeVariant(status)}
      className={`${isKnown ? 'rounded-md' : 'rounded-md text-slate-400'} ${className ?? ''} !h-7`.trim()}
    >
      <span>{getPaymentLabel(status)}</span>
      {isSaving && <span className="ml-1 text-[10px]">…</span>}
    </Chip>
  );
}
