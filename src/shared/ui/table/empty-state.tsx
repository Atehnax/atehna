import type { ReactNode } from 'react';

type EmptyStateProps = {
  title: string;
  description?: string;
  action?: ReactNode;
};

export default function EmptyState({ title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center gap-2 text-slate-500">
      <span>{title}</span>
      {description ? <span className="text-xs">{description}</span> : null}
      {action}
    </div>
  );
}
