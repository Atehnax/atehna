import { getPaymentBadgeClassName, getPaymentLabel } from '@/lib/paymentStatus';

type Props = {
  status?: string | null;
  isSaving?: boolean;
};

export default function PaymentChip({ status, isSaving = false }: Props) {
  return (
    <span
      className={`inline-flex h-6 min-w-[104px] items-center justify-center rounded-full border px-2 text-[11px] font-semibold leading-none ${getPaymentBadgeClassName(
        status
      )}`}
    >
      <span>{getPaymentLabel(status)}</span>
      {isSaving && <span className="ml-1 text-[10px]">…</span>}
    </span>
  );
}
