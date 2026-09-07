'use client';

import styles from './AdminCustomerDetails.module.css';

type Props = { value: string; isEditing: boolean; disabled: boolean; onChange: (value: string) => void };

export function AdminCustomerMessageField({ value, isEditing, disabled, onChange }: Props) {
  return (
    <div className={styles.messageShell} data-editing={isEditing}>
      <div className={styles.messageMeasure} aria-hidden="true">{(value || '—') + '\u200b'}</div>
      {isEditing ? (
        <textarea aria-label="Sporočilo stranke" rows={1} value={value} readOnly={disabled}
          onChange={event => onChange(event.target.value)} className={styles.messageControl} />
      ) : <div className={styles.messageControl}>{value || '—'}</div>}
    </div>
  );
}
