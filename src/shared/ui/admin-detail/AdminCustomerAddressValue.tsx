import { adminCompactIconFieldShellClassName } from '@/shared/ui/admin-controls/adminCompactFieldStyles';
import styles from './AdminCustomerDetails.module.css';

type Props = { addressLine1: string; addressLine2: string; postalCode: string; city: string; countryCode: string };

export function AdminCustomerAddressValue({ addressLine1, addressLine2, postalCode, city, countryCode }: Props) {
  const values = [addressLine1, addressLine2, postalCode, city, countryCode.toUpperCase()];
  return (
    <div className={`${adminCompactIconFieldShellClassName} !mt-0 !h-7 w-full ${styles.addressShell}`} data-editing="false">
      <div className={styles.addressFields} role="group" aria-label="Naslovni podatki">
        {values.map((value, index) => <span key={index} className={styles.compositeReadValue} title={value}>{value.trim() || '—'}</span>)}
      </div>
    </div>
  );
}
