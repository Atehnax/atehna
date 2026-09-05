'use client';

import { adminCompactIconFieldInputClassName, adminCompactIconFieldShellClassName } from '@/shared/ui/admin-controls/adminCompactFieldStyles';

type CustomerNameValues = { customerType: string; organizationName: string; contactName: string };

export function AdminCustomerNameEditor({ values, disabled, onChange }: {
  values: CustomerNameValues;
  disabled: boolean;
  onChange: (patch: Partial<CustomerNameValues>) => void;
}) {
  const individual = values.customerType === 'individual';
  const shell = `${adminCompactIconFieldShellClassName} !mt-0 !h-7 min-w-0 w-full`;

  return (
    <div className="grid min-w-0 gap-1">
      <div className={shell}>
        <input
          aria-label={individual ? 'Naročnik' : 'Naziv'}
          type="text"
          autoComplete={individual ? 'name' : 'organization'}
          value={individual ? values.contactName : values.organizationName}
          disabled={disabled}
          onChange={(event) => onChange(individual
            ? { contactName: event.target.value, organizationName: '' }
            : { organizationName: event.target.value })}
          className={adminCompactIconFieldInputClassName}
        />
      </div>
      {!individual ? (
        <div className={shell}>
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
        </div>
      ) : null}
    </div>
  );
}
