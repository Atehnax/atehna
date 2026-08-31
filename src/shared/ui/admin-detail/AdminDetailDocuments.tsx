import type {
  AnchorHTMLAttributes,
  ButtonHTMLAttributes,
  ReactNode
} from 'react';
import {
  adminWindowCardClassName,
  adminWindowCardStyle
} from '@/shared/ui/admin-table';

type AdminDetailDocumentsCardProps = {
  children: ReactNode;
  beforeTitle?: ReactNode;
  notice?: ReactNode;
  noticeId?: string;
  testId?: string;
};

export function AdminDetailDocumentsCard({
  children,
  beforeTitle,
  notice,
  noticeId,
  testId
}: AdminDetailDocumentsCardProps) {
  return (
    <section
      className={`${adminWindowCardClassName} flex w-full min-w-0 flex-col p-4 font-['Inter',system-ui,sans-serif]`}
      style={adminWindowCardStyle}
      data-testid={testId}
    >
      {beforeTitle ? (
        <div className="mb-4 border-b border-slate-200 pb-4">
          {beforeTitle}
        </div>
      ) : null}

      <h2 className="text-base font-semibold text-slate-900">PDF dokumenti</h2>
      {notice ? (
        <p
          id={noticeId}
          className="mt-1.5 text-[11px] leading-4 text-amber-700"
        >
          {notice}
        </p>
      ) : null}
      <div className="mt-2.5 overflow-hidden rounded-xl border border-slate-200 bg-white">
        {children}
      </div>
    </section>
  );
}

type AdminDetailDocumentTypeRowProps = {
  summary: ReactNode;
  actions: ReactNode;
  history?: ReactNode;
  testId?: string;
};

export function AdminDetailDocumentTypeRow({
  summary,
  actions,
  history,
  testId
}: AdminDetailDocumentTypeRowProps) {
  return (
    <div
      className="border-b border-slate-200 last:border-b-0"
      data-testid={testId}
    >
      <div className="grid min-h-11 grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-3 py-1.5">
        {summary}
        {actions}
      </div>
      {history}
    </div>
  );
}

export function AdminDetailDocumentSummary({
  label,
  children
}: {
  label: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="min-w-0">
      <p className="text-[12px] font-semibold leading-4 text-slate-900">
        {label}
      </p>
      {children}
    </div>
  );
}

export function AdminDetailDocumentCurrent({
  href,
  filename,
  badge,
  timestamp
}: {
  href: string;
  filename: string;
  badge?: ReactNode;
  timestamp: ReactNode;
}) {
  return (
    <div className="mt-0.5 flex min-w-0 items-center gap-2">
      <a
        href={href}
        target="_blank"
        rel="noreferrer"
        className="min-w-0 flex-1 truncate text-[11px] font-medium leading-4 text-[color:var(--blue-500)] hover:text-[color:var(--blue-600)]"
        title={filename}
      >
        {filename}
      </a>
      {badge}
      <span className="shrink-0 whitespace-nowrap text-[10px] leading-4 text-slate-500">
        {timestamp}
      </span>
    </div>
  );
}

export function AdminDetailDocumentEmpty({ children }: { children: ReactNode }) {
  return (
    <p className="mt-0.5 text-[11px] leading-4 text-slate-500">{children}</p>
  );
}

export function AdminDetailDocumentActions({
  children
}: {
  children: ReactNode;
}) {
  return <div className="flex items-center gap-0.5">{children}</div>;
}

export function AdminDetailDocumentOpenLink({
  className = '',
  ...props
}: AnchorHTMLAttributes<HTMLAnchorElement>) {
  return (
    <a
      {...props}
      className={`inline-flex h-7 items-center rounded-md px-1.5 text-[11px] font-semibold text-[color:var(--blue-500)] hover:bg-[color:var(--hover-neutral)] ${className}`.trim()}
    />
  );
}

export function AdminDetailDocumentPrimaryAction({
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className={`inline-flex h-7 min-w-[48px] items-center justify-center rounded-md px-1.5 text-[11px] font-semibold text-[color:var(--blue-500)] hover:bg-[color:var(--hover-neutral)] disabled:cursor-not-allowed disabled:opacity-50 ${className}`.trim()}
    />
  );
}

export function AdminDetailDocumentHistory({
  children,
  testId
}: {
  children: ReactNode;
  testId?: string;
}) {
  return (
    <ul
      className="border-t border-slate-200 bg-slate-50/70 px-2 py-1"
      data-testid={testId}
    >
      {children}
    </ul>
  );
}

export function AdminDetailDocumentHistoryItem({
  children,
  hasTrailingAction = false,
  testId
}: {
  children: ReactNode;
  hasTrailingAction?: boolean;
  testId?: string;
}) {
  return (
    <li
      className={`grid min-w-0 ${
        hasTrailingAction
          ? 'grid-cols-[minmax(0,1fr)_auto_28px]'
          : 'grid-cols-[minmax(0,1fr)_auto]'
      } items-center gap-2 rounded-md px-1.5 py-1 text-[10px] leading-4 text-slate-600 transition hover:bg-white`}
      data-testid={testId}
    >
      {children}
    </li>
  );
}

export function AdminDetailDocumentHistoryLink({
  className = '',
  ...props
}: AnchorHTMLAttributes<HTMLAnchorElement>) {
  return (
    <a
      {...props}
      className={`truncate font-medium text-[color:var(--blue-500)] hover:text-[color:var(--blue-600)] ${className}`.trim()}
    />
  );
}

export function AdminDetailDocumentHistoryMeta({
  children,
  className = ''
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={`whitespace-nowrap text-right text-slate-500 ${className}`.trim()}
    >
      {children}
    </span>
  );
}