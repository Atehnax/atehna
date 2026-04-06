import { categoriesBreadcrumbCurrentTextClassName } from '@/admin/features/kategorije/common/typography';

export type AdminBreadcrumbPathItem = {
  label: string;
  isCurrent?: boolean;
  onClick?: () => void;
};

export default function AdminBreadcrumbPath({
  items,
  emptyLabel = 'Ni izbrane poti.',
  className = 'truncate whitespace-nowrap text-sm text-slate-700'
}: {
  items: AdminBreadcrumbPathItem[];
  emptyLabel?: string;
  className?: string;
}) {
  return (
    <nav className={className} aria-label="Breadcrumb">
      {items.length === 0 ? (
        <span className="text-xs text-slate-400">{emptyLabel}</span>
      ) : (
        items.map((crumb, index) => (
          <span key={`${crumb.label}-${index}`}>
            {index > 0 ? <span className="mx-1 text-slate-400">/</span> : null}
            {crumb.onClick && !crumb.isCurrent ? (
              <button
                type="button"
                onClick={crumb.onClick}
                className="text-slate-600 hover:text-slate-900 focus-visible:outline-none focus-visible:underline"
              >
                <span title={crumb.label}>{crumb.label}</span>
              </button>
            ) : (
              <span className={crumb.isCurrent ? categoriesBreadcrumbCurrentTextClassName : 'text-sm text-slate-700'} title={crumb.label}>
                {crumb.label}
              </span>
            )}
          </span>
        ))
      )}
    </nav>
  );
}
