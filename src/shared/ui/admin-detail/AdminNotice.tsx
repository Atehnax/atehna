'use client';

import { useState, type ReactNode } from 'react';
import { useAdminCollapse } from '@/shared/ui/use-admin-collapse';
import collapseStyles from '@/shared/ui/admin-collapse.module.css';

/** Keep notice content and its spacing mounted until the shared exit transition finishes. */
export function AdminNotice({ open, children, className = '', wrapperClassName = '', spacingClassName = '', id, testId }: {
  open: boolean;
  children: ReactNode;
  className?: string;
  wrapperClassName?: string;
  spacingClassName?: string;
  id?: string;
  testId?: string;
}) {
  const { mounted, expanded, onTransitionEnd } = useAdminCollapse(open);
  const [lastContent, setLastContent] = useState(children);
  if (open && children !== lastContent) setLastContent(children);
  if (!mounted) return null;
  return (
    <div className={`${collapseStyles.collapse} ${wrapperClassName}`.trim()}
      data-admin-notice data-open={expanded} aria-hidden={!open} inert={!open}
      onTransitionEnd={onTransitionEnd}>
      <div className={collapseStyles.content}>
        <div className={spacingClassName}>
          <div id={id} data-testid={testId} className={className} role="status">{lastContent}</div>
        </div>
      </div>
    </div>
  );
}
