'use client';

import { Children, cloneElement, isValidElement, type HTMLAttributes, type ReactElement, type ReactNode } from 'react';
import collapse from '@/shared/ui/admin-collapse.module.css';
import { useAdminCollapse } from '@/shared/ui/use-admin-collapse';
import styles from './CategoryTreeRowMotion.module.css';

type CellProps = HTMLAttributes<HTMLTableCellElement>;
type RowElement = ReactElement<HTMLAttributes<HTMLTableRowElement>>;

/** Animate cell contents so the tree keeps its flat table and sortable row refs. */
export function CategoryTreeRowMotion({ open, children }: {
  open: boolean;
  children: (animateRow: (row: RowElement) => RowElement) => ReactNode;
}) {
  const { mounted, expanded, settled, onTransitionEnd } = useAdminCollapse(open);
  if (!mounted) return null;

  return children((row) => cloneElement(row, {
    className: `${row.props.className ?? ''} ${styles.row}`,
    'aria-hidden': !open,
    inert: !open,
    children: Children.map(row.props.children, (cell) => {
      if (!isValidElement<CellProps>(cell) || cell.type !== 'td') return cell;
      return cloneElement(cell, {
        children: <div className={collapse.collapse} data-open={expanded} onTransitionEnd={onTransitionEnd}>
          <div className={`${collapse.content} ${styles.clip} ${settled ? styles.unclipped : ''}`}>
            <div className={`${cell.props.className ?? ''} ${styles.cellContent}`}>
              <div className={styles.inner}>{cell.props.children}</div>
            </div>
          </div>
        </div>
      });
    })
  }));
}
