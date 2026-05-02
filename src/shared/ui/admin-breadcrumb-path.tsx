import type { ReactNode } from 'react';
import { categoriesBreadcrumbCurrentTextClassName } from '@/admin/features/kategorije/common/typography';

export type AdminBreadcrumbPathItem = {
  label: string;
  isCurrent?: boolean;
  onClick?: () => void;
  key?: string;
  title?: string;
  labelClassName?: string;
  render?: ReactNode;
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
    <nav className={`${className} inline-flex min-w-0 items-center`.trim()} aria-label="Breadcrumb">
      {items.length === 0 ? (
        <span className="text-xs text-slate-400">{emptyLabel}</span>
      ) : (
        items.map((crumb, index) => (
          <span key={crumb.key ?? `${crumb.label}-${index}`} className="inline-flex min-w-0 items-center">
            {index > 0 ? <span className="mx-1 inline-flex items-center leading-5 text-slate-400">/</span> : null}
            {crumb.render ? crumb.render : crumb.onClick && !crumb.isCurrent ? (
              <button
                type="button"
                onClick={crumb.onClick}
                className="inline-flex min-w-0 items-center text-sm leading-5 text-slate-600 hover:text-slate-900 focus-visible:outline-none focus-visible:underline"
              >
                <span className={crumb.labelClassName} title={crumb.title ?? crumb.label}>{crumb.label}</span>
              </button>
            ) : (
              <span
                className={`${crumb.isCurrent ? categoriesBreadcrumbCurrentTextClassName : 'text-sm text-slate-700'} ${crumb.labelClassName ?? ''}`.trim()}
                title={crumb.title ?? crumb.label}
              >
                {crumb.label}
              </span>
            )}
          </span>
        ))
      )}
    </nav>
  );
}
