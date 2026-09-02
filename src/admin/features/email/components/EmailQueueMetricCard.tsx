export default function EmailQueueMetricCard({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50/60 px-3 py-2.5">
      <div className="text-base font-semibold tabular-nums text-slate-900">
        {value}
      </div>
      <div className="text-xs text-slate-500">{label}</div>
    </div>
  );
}
