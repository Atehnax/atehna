import {
  Document,
  Font,
  Page,
  Text,
  View,
  StyleSheet
} from '@react-pdf/renderer';
import { COMPANY_INFO } from '@/lib/constants';
import type { CartItem } from '@/lib/cart/store';
import { DEJAVU_SANS_BASE64, DEJAVU_SANS_BOLD_BASE64 } from '@/lib/pdfFonts';

export type OrderFormData = {
  firstName: string;
  lastName: string;
  orderAddress?: string;
  companyInvoice?: boolean;
  companyName?: string;
  companyTaxId?: string;
  contactName: string;
  email: string;
  phone?: string;
  reference: string;
  notes?: string;
  paymentMethod?: string;
};

export type OrderPdfProps = {
  formData: OrderFormData;
  items: CartItem[];
  createdAt: string;
};

const fontFamily = 'DejaVu Sans';

Font.register({
  family: fontFamily,
  fonts: [
    {
      src: `data:font/ttf;base64,${DEJAVU_SANS_BASE64}`
    },
    {
      src: `data:font/ttf;base64,${DEJAVU_SANS_BOLD_BASE64}`,
      fontWeight: 700
    }
  ]
});

const styles = StyleSheet.create({
  page: {
    padding: 32,
    fontSize: 11,
    fontFamily
  },
  header: {
    marginBottom: 20
  },
  title: {
    fontSize: 18,
    marginBottom: 6
  },
  sectionTitle: {
    fontSize: 12,
    marginBottom: 4,
    fontWeight: 700
  },
  row: {
    flexDirection: 'row',
    marginBottom: 2
  },
  label: {
    width: 120,
    fontWeight: 700
  },
  value: {
    flex: 1
  },
  tableHeader: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#94a3b8',
    paddingBottom: 6,
    marginTop: 12,
    fontWeight: 700
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0'
  },
  colSku: {
    width: '20%'
  },
  colName: {
    width: '50%'
  },
  colQty: {
    width: '15%',
    textAlign: 'right'
  },
  colUnit: {
    width: '15%',
    textAlign: 'right'
  },
  footerNote: {
    marginTop: 16
  }
});

export default function OrderPdf({ formData, items, createdAt }: OrderPdfProps) {
  return (
    <Document title="Naročilo">
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.title}>Naročilo / Naročilnica</Text>
          <Text>{COMPANY_INFO.name}</Text>
          <Text>{COMPANY_INFO.address}</Text>
          <Text>Telefon: {COMPANY_INFO.phone}</Text>
          <Text>E-pošta: {COMPANY_INFO.email}</Text>
        </View>

        <View>
          <Text style={styles.sectionTitle}>Podatki naročnika</Text>
          <View style={styles.row}>
            <Text style={styles.label}>Ime in priimek:</Text>
            <Text style={styles.value}>
              {formData.firstName} {formData.lastName}
            </Text>
          </View>
          {formData.orderAddress && (
            <View style={styles.row}>
              <Text style={styles.label}>Naslov naročnika:</Text>
              <Text style={styles.value}>{formData.orderAddress}</Text>
            </View>
          )}
          {formData.companyInvoice && formData.companyName && (
            <View style={styles.row}>
              <Text style={styles.label}>Podjetje:</Text>
              <Text style={styles.value}>{formData.companyName}</Text>
            </View>
          )}
          {formData.companyInvoice && formData.companyTaxId && (
            <View style={styles.row}>
              <Text style={styles.label}>DDV / davčna št.:</Text>
              <Text style={styles.value}>{formData.companyTaxId}</Text>
            </View>
          )}
          <View style={styles.row}>
            <Text style={styles.label}>Kontakt:</Text>
            <Text style={styles.value}>{formData.contactName}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>E-pošta:</Text>
            <Text style={styles.value}>{formData.email}</Text>
          </View>
          {formData.phone && (
            <View style={styles.row}>
              <Text style={styles.label}>Telefon:</Text>
              <Text style={styles.value}>{formData.phone}</Text>
            </View>
          )}
          <View style={styles.row}>
            <Text style={styles.label}>Sklic/št. naročila:</Text>
            <Text style={styles.value}>{formData.reference}</Text>
          </View>
          {formData.paymentMethod && (
            <View style={styles.row}>
              <Text style={styles.label}>Način plačila:</Text>
              <Text style={styles.value}>{formData.paymentMethod}</Text>
            </View>
          )}
          <View style={styles.row}>
            <Text style={styles.label}>Datum:</Text>
            <Text style={styles.value}>{createdAt}</Text>
          </View>
        </View>

        <View style={styles.tableHeader}>
          <Text style={styles.colSku}>SKU</Text>
          <Text style={styles.colName}>Izdelek</Text>
          <Text style={styles.colQty}>Količina</Text>
          <Text style={styles.colUnit}>Enota</Text>
        </View>
        {items.map((item) => (
          <View key={item.sku} style={styles.tableRow}>
            <Text style={styles.colSku}>{item.sku}</Text>
            <Text style={styles.colName}>{item.name}</Text>
            <Text style={styles.colQty}>{item.quantity}</Text>
            <Text style={styles.colUnit}>{item.unit ?? '-'}</Text>
          </View>
        ))}

        {formData.notes && (
          <View style={styles.footerNote}>
            <Text style={styles.sectionTitle}>Opombe</Text>
            <Text>{formData.notes}</Text>
          </View>
        )}

        <View style={styles.footerNote}>
          <Text>Prosimo, pošljite naročilo na {COMPANY_INFO.orderEmail}.</Text>
        </View>
      </Page>
    </Document>
  );
}
