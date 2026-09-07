'use client';
import { Children, cloneElement, isValidElement, type HTMLAttributes, type ReactElement } from 'react';
import { TD } from '@/shared/ui/table';
import { useAdminCollapse } from '@/shared/ui/use-admin-collapse';
import collapse from '@/shared/ui/admin-collapse.module.css';
import styles from './TrashRowMotion.module.css';
export default function TrashRowMotion({ open, children }: { open: boolean; children: ReactElement<HTMLAttributes<HTMLTableRowElement>> }) {
  const motion = useAdminCollapse(open);
  if (!motion.mounted) return null;
  return cloneElement(children, {
    className: `${children.props.className ?? ''} ${styles.row}`,
    'aria-hidden': !open,
    inert: !open,
    children: Children.map(children.props.children, cell => {
      if (!isValidElement<HTMLAttributes<HTMLTableCellElement>>(cell) || cell.type !== TD) return cell;
      return cloneElement(cell, { children: <div className={collapse.collapse} data-open={motion.expanded} onTransitionEnd={motion.onTransitionEnd}><div className={styles.cell}><div className={styles.inner}>{cell.props.children}</div></div></div> });
    })
  });
}
