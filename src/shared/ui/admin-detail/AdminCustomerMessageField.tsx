'use client';

import styles from './AdminCustomerDetails.module.css';

type Props = { value: string; isEditing: boolean; disabled: boolean; onChange: (value: string) => void };

export function AdminCustomerMessageField({ value, isEditing, disabled, onChange }: Props) {
  return (
    <div className={styles.messageShell} data-editing={isEditing}>
      <div className={styles.messageMeasure} aria-hidden="true">{(value || 'Ni sporočila') + '\u200b'}</div>
      {isEditing ? (
        <textarea aria-label="Sporočilo stranke" placeholder="Ni sporočila" rows={1} value={value} readOnly={disabled}
          onChange={event => onChange(event.target.value)} className={styles.messageControl} />
      ) : <div className={styles.messageControl} data-empty={!value}>{value || 'Ni sporočila'}</div>}
    </div>
  );
}
