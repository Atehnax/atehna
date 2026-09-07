'use client';

import { adminCompactIconFieldInputClassName, adminCompactIconFieldShellClassName } from '@/shared/ui/admin-controls/adminCompactFieldStyles';
import styles from './AdminCustomerDetails.module.css';

type CustomerNameValues = { customerType: string; organizationName: string; contactName: string };

export function AdminCustomerNameEditor({ values, disabled, onChange, isEditing = true }: {
  values: CustomerNameValues;
  disabled: boolean;
  onChange: (patch: Partial<CustomerNameValues>) => void;
  isEditing?: boolean;
}) {
  const individual = values.customerType === 'individual';
  const primaryName = individual ? values.contactName : values.organizationName;
  const displayName = individual && !primaryName.trim() ? values.organizationName : primaryName;
  return (
    <div className={`${adminCompactIconFieldShellClassName} !mt-0 !h-7 w-full ${styles.nameShell}`} data-editing={isEditing}>
      <div className={styles.nameFields} data-individual={individual} role="group" aria-label={individual ? 'Naročnik' : 'Naziv in kontaktna oseba'}>
        {isEditing ? (
          <input
            aria-label={individual ? 'Naročnik' : 'Naziv'}
            placeholder={individual ? 'Ime in priimek' : 'Naziv organizacije'}
            type="text"
            autoComplete={individual ? 'name' : 'organization'}
            value={primaryName}
            disabled={disabled}
            onChange={(event) => onChange(individual
              ? { contactName: event.target.value, organizationName: '' }
              : { organizationName: event.target.value })}
            className={adminCompactIconFieldInputClassName}
          />
        ) : <span className={styles.compositeReadValue} title={displayName}>{displayName.trim() || '—'}</span>}
        {!individual ? isEditing ? (
          <input
            aria-label="Kontaktna oseba"
            placeholder="Kontaktna oseba"
            type="text"
            autoComplete="name"
            value={values.contactName}
            disabled={disabled}
            onChange={(event) => onChange({ contactName: event.target.value })}
            className={adminCompactIconFieldInputClassName}
          />
        ) : <span className={styles.compositeReadValue} title={values.contactName}>{values.contactName.trim() || '—'}</span> : null}
      </div>
    </div>
  );
}
