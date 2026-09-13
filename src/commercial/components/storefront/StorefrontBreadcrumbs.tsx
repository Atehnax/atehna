import Link from 'next/link';
import { House } from 'lucide-react';
import type { StorefrontBreadcrumb } from '@/commercial/features/products/storefrontProduct';

type StorefrontBreadcrumbsProps = {
  breadcrumbs: StorefrontBreadcrumb[];
  className?: string;
  scroll?: boolean;
};

export default function StorefrontBreadcrumbs({
  breadcrumbs,
  className = 'mb-4',
  scroll
}: StorefrontBreadcrumbsProps) {
  const path = breadcrumbs.filter(crumb => crumb.href !== '/');
  return (
    <nav aria-label="Drobtinice" className={`storefront-product-breadcrumbs ${className}`}>
      <ol className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-[color:var(--site-color-text-muted)]">
        <li className="flex items-center gap-2">
          <Link href="/" className="site-link inline-flex items-center" aria-label="Domov">
            <House aria-hidden="true" className="h-4 w-4" />
          </Link>
          {path.length > 0 ? <span aria-hidden="true">/</span> : null}
        </li>
        {path.map((crumb, index) => (
          <li key={`${crumb.label}-${index}`} className="flex items-center gap-2">
            {index > 0 ? <span aria-hidden="true">/</span> : null}
            {crumb.href ? (
              <Link href={crumb.href} scroll={scroll} className="site-link">{crumb.label}</Link>
            ) : (
              <span aria-current="page">{crumb.label}</span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
