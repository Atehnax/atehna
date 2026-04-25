import type { ReactNode } from 'react';

const classNames = (...parts: Array<string | false | null | undefined>) => parts.filter(Boolean).join(' ');

export function AdminPageHeader({
  title,
  description,
  className,
  actions
}: {
  title: string;
  description?: string;
  className?: string;
  actions?: ReactNode;
}) {
  return (
    <div className={classNames('mb-4 flex flex-wrap items-start justify-between gap-3', className)}>
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">{title}</h1>
        {description ? <p className="mt-1 text-sm text-slate-600">{description}</p> : null}
      </div>
      {actions ? <div className="shrink-0">{actions}</div> : null}
    </div>
  );
}

function AdminSurfaceCard({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={classNames("rounded-xl border border-slate-200 bg-white p-6 font-['Inter',system-ui,sans-serif]", className)}>{children}</div>;
}

export function AdminPlaceholderCard({ title, description }: { title: string; description: string }) {
  return (
    <AdminSurfaceCard>
      <h1 className="text-2xl font-semibold text-slate-900">{title}</h1>
      <p className="mt-2 text-sm text-slate-600">{description}</p>
    </AdminSurfaceCard>
  );
}
