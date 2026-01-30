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

export type OrderFormData = {
  schoolName: string;
  deliveryAddress?: string;
  contactName: string;
  email: string;
  phone?: string;
  reference: string;
  notes?: string;
};

export type OrderPdfProps = {
  formData: OrderFormData;
  items: CartItem[];
  createdAt: string;
};

Font.register({
  family: 'Noto Sans',
  fonts: [
    {
      src: 'https://fonts.gstatic.com/s/notosans/v35/o-0IIpQlx3QUlC5A4PNb4g.ttf'
    },
    {
      src: 'https://fonts.gstatic.com/s/notosans/v35/o-0NIpQlx3QUlC5A4PNjXhFVZNyBw.ttf',
      fontWeight: 700
    }
  ]
});

const styles = StyleSheet.create({
  page: {
    padding: 32,
    fontSize: 11,
    fontFamily: 'Noto Sans'
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
          <Text style={styles.sectionTitle}>Podatki šole</Text>
          <View style={styles.row}>
            <Text style={styles.label}>Naziv šole:</Text>
            <Text style={styles.value}>{formData.schoolName}</Text>
          </View>
          {formData.deliveryAddress && (
            <View style={styles.row}>
              <Text style={styles.label}>Naslov dostave:</Text>
              <Text style={styles.value}>{formData.deliveryAddress}</Text>
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
