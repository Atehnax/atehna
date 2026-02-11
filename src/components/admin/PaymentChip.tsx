import { getPaymentBadgeClassName, getPaymentLabel } from '@/lib/paymentStatus';

type Props = {
  status?: string | null;
  isSaving?: boolean;
};

export default function PaymentChip({ status, isSaving = false }: Props) {
  return (
    <span
      className={`mx-auto inline-flex h-7 min-w-[120px] items-center justify-center rounded-full border px-3 text-xs font-semibold leading-none ${getPaymentBadgeClassName(
        status
      )}`}
    >
      <span>{getPaymentLabel(status)}</span>
      {isSaving && <span className="ml-1 text-[10px]">…</span>}
    </span>
  );
}
