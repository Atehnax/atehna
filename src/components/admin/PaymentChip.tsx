import { Chip } from '@/shared/ui/badge';
import { getPaymentBadgeVariant, getPaymentLabel, isPaymentStatus } from '@/lib/paymentStatus';

type Props = {
  status?: string | null;
  isSaving?: boolean;
};

export default function PaymentChip({ status, isSaving = false }: Props) {
  const isKnown = Boolean(status && isPaymentStatus(status));

  return (
    <Chip variant={getPaymentBadgeVariant(status)} className={isKnown ? undefined : 'text-slate-400'}>
      <span>{getPaymentLabel(status)}</span>
      {isSaving && <span className="ml-1 text-[10px]">…</span>}
    </Chip>
  );
}
