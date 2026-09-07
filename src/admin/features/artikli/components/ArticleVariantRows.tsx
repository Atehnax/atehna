'use client';

import { Children, cloneElement, isValidElement, type HTMLAttributes, type ReactElement, type ReactNode } from 'react';
import collapse from '@/shared/ui/admin-collapse.module.css';
import { useAdminCollapse } from '@/shared/ui/use-admin-collapse';
import styles from './ArticleVariantRows.module.css';

type CellProps = HTMLAttributes<HTMLTableCellElement>;
type RowProps = HTMLAttributes<HTMLTableRowElement>;

/** Keep the original table cells in their columns while their contents collapse. */
export function ArticleVariantRows({ open, children }: { open: boolean; children: ReactNode }) {
  const { mounted, expanded, settled, onTransitionEnd } = useAdminCollapse(open);

  if (!mounted) return null;
  return <>{Children.map(children, child => {
    if (!isValidElement<RowProps>(child) || child.type !== 'tr') return child;
    return cloneElement(child, {
      className: `${child.props.className ?? ''} ${styles.row}`,
      'aria-hidden': !open,
      inert: !open,
      children: Children.map(child.props.children, cell => {
        if (!isValidElement<CellProps>(cell) || !['td', 'th'].includes(String(cell.type))) return cell;
        const content = <div className={collapse.collapse} data-open={expanded} onTransitionEnd={onTransitionEnd}>
          <div className={`${collapse.content} ${styles.clip} ${settled ? styles.unclipped : ''}`}>
            <div className={`${cell.props.className ?? ''} ${styles.cellContent} ${cell.type === 'td' ? styles.bodyCell : ''}`}>
              <div className={styles.inner}>{cell.props.children}</div>
            </div>
          </div>
        </div>;
        return cloneElement(cell as ReactElement<CellProps>, { children: content });
      })
    });
  })}</>;
}
