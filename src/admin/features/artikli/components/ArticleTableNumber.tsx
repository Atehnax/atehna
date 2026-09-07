import type { InputHTMLAttributes } from 'react';
import { adminTableMatchingValueBaseClassName } from '@/shared/ui/admin-table';
import styles from './ArticleListFields.module.css';

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, 'className' | 'size'> & {
  editing?: boolean;
  unit?: string;
  invalid?: boolean;
  matchingClassName?: string;
  onValueMouseEnter?: () => void;
  onValueMouseLeave?: () => void;
};

/** Identical field geometry keeps quick editing aligned with displayed values. */
export function ArticleTableNumber({ editing = false, unit, value, title, invalid = false, matchingClassName = '', onValueMouseEnter, onValueMouseLeave, ...inputProps }: Props) {
  return (
    <span className={styles.numberField} data-editing={editing || undefined} data-unit={unit} data-invalid={invalid || undefined} title={title}>
      {editing ? (
        <>
          <input {...inputProps} data-admin-table-value-input value={value} type="text" className={styles.numberValue} />
          {unit ? <span className={styles.numberUnit} aria-hidden="true">{unit}</span> : null}
        </>
      ) : (
        <span className={styles.numberReadout} onMouseEnter={onValueMouseEnter} onMouseLeave={onValueMouseLeave}>
          <span className={`${adminTableMatchingValueBaseClassName} ${styles.numberMatch} ${matchingClassName}`}>
            <span className={styles.readAmount}>{value ?? '—'}</span>
            {unit ? <span className={styles.readUnit}>{unit}</span> : null}
          </span>
        </span>
      )}
    </span>
  );
}
