import { Badge } from '@/shared/ui/badge';

type OrderOrigin = 'manual' | 'historical' | 'unknown';
type OrderOriginBadgeProps = {
  entrySource?: 'website' | 'manual' | null;
  isHistorical?: boolean;
  className?: string;
};

const origins = {
  manual: { letter: 'R', label: 'Ročno dodano naročilo', variant: 'info' },
  historical: { letter: 'Z', label: 'Ročno dodano zgodovinsko naročilo', variant: 'purple' },
  unknown: { letter: '?', label: 'Neznan izvor naročila', variant: 'neutral' }
} as const;

export function AdminOrderOriginBadge({ entrySource, isHistorical = false, className }: OrderOriginBadgeProps) {
  if (!isHistorical && entrySource === 'website') return null;
  const origin: OrderOrigin = isHistorical ? 'historical' : entrySource === 'manual' ? 'manual' : 'unknown';
  const marker = origins[origin];

  return (
    <Badge
      variant={marker.variant}
      className={`!h-[18px] !min-h-[18px] !max-h-[18px] !w-[18px] !min-w-[18px] !max-w-[18px] shrink-0 !rounded-md !p-0 ${className ?? ''}`}
      role="img"
      aria-label={marker.label}
      title={marker.label}
      data-admin-order-origin={origin}
    >
      {marker.letter}
    </Badge>
  );
}

export function AdminOrderOriginLegend({ showUnknown = false, className }: { showUnknown?: boolean; className?: string }) {
  return (
    <div role="note" aria-label="Oznake izvora naročil" className={`flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] leading-5 text-slate-500 ${className ?? ''}`}>
      <span className="inline-flex items-center gap-1.5">
        <AdminOrderOriginBadge entrySource="manual" />
        <span>Ročno dodano</span>
      </span>
      <span className="inline-flex items-center gap-1.5">
        <AdminOrderOriginBadge entrySource="manual" isHistorical />
        <span>Zgodovinsko</span>
      </span>
      {showUnknown ? (
        <span className="inline-flex items-center gap-1.5">
          <AdminOrderOriginBadge entrySource={null} />
          <span>Neznan izvor</span>
        </span>
      ) : null}
      <span>Brez oznake: spletno naročilo</span>
    </div>
  );
}
