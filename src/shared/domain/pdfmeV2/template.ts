import { cloneDeep } from '@pdfme/common';
import type { BlankPdf, Schema, Template } from '@pdfme/common';

import type { PdfmeV2BindingName } from './bindings';
import {
  PDFME_V2_DOCUMENT_TYPES,
  PDFME_V2_DOCUMENT_TYPE_LABELS,
  type PdfmeV2DocumentType
} from './documentTypes';
import {
  PDFME_V2_ITEM_TABLE_HEADERS
} from './renderData';

export const PDFME_V2_ENGINE_VERSION = '6.1.12' as const;
export const PDFME_V2_SCHEMA_VERSION = 1 as const;
export const PDFME_V2_A4_WIDTH_MM = 210 as const;
export const PDFME_V2_A4_HEIGHT_MM = 297 as const;
export const PDFME_V2_DEFAULT_PADDING_MM = [40, 10, 20, 10] as const;
export const PDFME_V2_REGULAR_FONT_NAME = 'NotoSans' as const;
export const PDFME_V2_BOLD_FONT_NAME = 'NotoSansBold' as const;

/** Accepted ATEHNA document values, copied locally to keep v2 isolated from v1. */
export const PDFME_V2_DOCUMENT_STYLE = Object.freeze({
  pageBackground: '#FFFFFF',
  textColor: '#151515',
  mutedTextColor: '#2F2F2F',
  lineColor: '#202020',
  accentColor: '#D6A900',
  tableHeaderBackground: '#FFFFFF',
  tableStripeColor: '#FFFFFF'
});

export const PDFME_V2_DOCUMENT_GEOMETRY = Object.freeze({
  marginX: 10,
  contentWidth: 190,
  headerBottom: 38,
  footerTop: 278
});

export const PDFME_V2_DOCUMENT_TYPOGRAPHY = Object.freeze({
  title: 15.5,
  body: 8.5,
  small: 7,
  table: 8,
  wordmark: 23
});

export const PDFME_V2_DEFAULT_TABLE_WIDTH_PERCENTAGES = [
  14,
  40,
  8,
  8,
  14,
  16
] as const;

export const PDFME_V2_SCHEMA_TYPES = [
  'text',
  'multiVariableText',
  'image',
  'svg',
  'line',
  'rectangle',
  'ellipse',
  'table',
  'list'
] as const;

export type PdfmeV2SchemaType = (typeof PDFME_V2_SCHEMA_TYPES)[number];
export type AtehnaId = string;
export type AtehnaPdfmeSchema = Schema & {
  atehnaId: AtehnaId;
  type: PdfmeV2SchemaType;
};

export type PdfmeV2AuthoringTemplate = Omit<
  Template,
  'schemas' | 'basePdf' | 'pdfmeVersion'
> & {
  schemas: AtehnaPdfmeSchema[][];
  basePdf: BlankPdf;
  pdfmeVersion: typeof PDFME_V2_ENGINE_VERSION;
};

export const PDFME_V2_VISIBILITY_CONDITIONS = [
  'hasItems',
  'hasNotes',
  'hasReference',
  'hasShipping',
  'hasTax'
] as const;

export type PdfmeV2VisibilityCondition =
  (typeof PDFME_V2_VISIBILITY_CONDITIONS)[number];

export type PdfmeV2TemplateRevisionMetadata = Readonly<{
  activeRevisionId: string | null;
  baseRevisionId: string | null;
}>;

/**
 * Contains only ATEHNA facts that pdfme cannot safely own. Geometry, styling,
 * rotation and z-order remain exclusively in template.schemas.
 */
export type PdfmeV2TemplateEnvelope = Readonly<{
  schemaVersion: typeof PDFME_V2_SCHEMA_VERSION;
  pdfmeVersion: typeof PDFME_V2_ENGINE_VERSION;
  documentType: PdfmeV2DocumentType;
  labels: Readonly<Record<AtehnaId, string>>;
  bindings: Readonly<Record<AtehnaId, readonly PdfmeV2BindingName[]>>;
  visibilityConditions: Readonly<
    Partial<Record<AtehnaId, PdfmeV2VisibilityCondition>>
  >;
  repeating: Readonly<{
    header: readonly AtehnaId[];
    footer: readonly AtehnaId[];
  }>;
  assetRevisionIds: Readonly<Partial<Record<AtehnaId, string>>>;
  revision: PdfmeV2TemplateRevisionMetadata;
}>;

export type PdfmeV2CanonicalTemplate = Readonly<{
  template: PdfmeV2AuthoringTemplate;
  envelope: PdfmeV2TemplateEnvelope;
}>;

type DefaultElementRole =
  | 'headerTitle'
  | 'headerTagline'
  | 'headerCompany'
  | 'headerRule'
  | 'footerRegistration'
  | 'footerBanking'
  | 'footerPageNumber'
  | 'documentTitle'
  | 'documentNumber'
  | 'documentMeta'
  | 'documentMetaLabels'
  | 'customer'
  | 'detailRule'
  | 'introAccent'
  | 'intro'
  | 'itemsTable'
  | 'totals'
  | 'notes'
  | 'closing';

const DEFAULT_ELEMENT_IDS: Readonly<
  Record<PdfmeV2DocumentType, Readonly<Record<DefaultElementRole, AtehnaId>>>
> = {
  order_summary: {
    headerTitle: '11111111-1111-4111-8111-111111111101',
    footerPageNumber: '11111111-1111-4111-8111-111111111102',
    documentMeta: '11111111-1111-4111-8111-111111111103',
    customer: '11111111-1111-4111-8111-111111111104',
    itemsTable: '11111111-1111-4111-8111-111111111105',
    totals: '11111111-1111-4111-8111-111111111106',
    notes: '11111111-1111-4111-8111-111111111107',
    headerTagline: '11111111-1111-4111-8111-111111111108',
    headerCompany: '11111111-1111-4111-8111-111111111109',
    headerRule: '11111111-1111-4111-8111-111111111110',
    footerRegistration: '11111111-1111-4111-8111-111111111111',
    footerBanking: '11111111-1111-4111-8111-111111111112',
    documentTitle: '11111111-1111-4111-8111-111111111113',
    documentNumber: '11111111-1111-4111-8111-111111111114',
    documentMetaLabels: '11111111-1111-4111-8111-111111111115',
    detailRule: '11111111-1111-4111-8111-111111111116',
    introAccent: '11111111-1111-4111-8111-111111111117',
    intro: '11111111-1111-4111-8111-111111111118',
    closing: '11111111-1111-4111-8111-111111111119'
  },
  dobavnica: {
    headerTitle: '22222222-2222-4222-8222-222222222201',
    footerPageNumber: '22222222-2222-4222-8222-222222222202',
    documentMeta: '22222222-2222-4222-8222-222222222203',
    customer: '22222222-2222-4222-8222-222222222204',
    itemsTable: '22222222-2222-4222-8222-222222222205',
    totals: '22222222-2222-4222-8222-222222222206',
    notes: '22222222-2222-4222-8222-222222222207',
    headerTagline: '22222222-2222-4222-8222-222222222208',
    headerCompany: '22222222-2222-4222-8222-222222222209',
    headerRule: '22222222-2222-4222-8222-222222222210',
    footerRegistration: '22222222-2222-4222-8222-222222222211',
    footerBanking: '22222222-2222-4222-8222-222222222212',
    documentTitle: '22222222-2222-4222-8222-222222222213',
    documentNumber: '22222222-2222-4222-8222-222222222214',
    documentMetaLabels: '22222222-2222-4222-8222-222222222215',
    detailRule: '22222222-2222-4222-8222-222222222216',
    introAccent: '22222222-2222-4222-8222-222222222217',
    intro: '22222222-2222-4222-8222-222222222218',
    closing: '22222222-2222-4222-8222-222222222219'
  },
  predracun: {
    headerTitle: '33333333-3333-4333-8333-333333333301',
    footerPageNumber: '33333333-3333-4333-8333-333333333302',
    documentMeta: '33333333-3333-4333-8333-333333333303',
    customer: '33333333-3333-4333-8333-333333333304',
    itemsTable: '33333333-3333-4333-8333-333333333305',
    totals: '33333333-3333-4333-8333-333333333306',
    notes: '33333333-3333-4333-8333-333333333307',
    headerTagline: '33333333-3333-4333-8333-333333333308',
    headerCompany: '33333333-3333-4333-8333-333333333309',
    headerRule: '33333333-3333-4333-8333-333333333310',
    footerRegistration: '33333333-3333-4333-8333-333333333311',
    footerBanking: '33333333-3333-4333-8333-333333333312',
    documentTitle: '33333333-3333-4333-8333-333333333313',
    documentNumber: '33333333-3333-4333-8333-333333333314',
    documentMetaLabels: '33333333-3333-4333-8333-333333333315',
    detailRule: '33333333-3333-4333-8333-333333333316',
    introAccent: '33333333-3333-4333-8333-333333333317',
    intro: '33333333-3333-4333-8333-333333333318',
    closing: '33333333-3333-4333-8333-333333333319'
  },
  invoice: {
    headerTitle: '44444444-4444-4444-8444-444444444401',
    footerPageNumber: '44444444-4444-4444-8444-444444444402',
    documentMeta: '44444444-4444-4444-8444-444444444403',
    customer: '44444444-4444-4444-8444-444444444404',
    itemsTable: '44444444-4444-4444-8444-444444444405',
    totals: '44444444-4444-4444-8444-444444444406',
    notes: '44444444-4444-4444-8444-444444444407',
    headerTagline: '44444444-4444-4444-8444-444444444408',
    headerCompany: '44444444-4444-4444-8444-444444444409',
    headerRule: '44444444-4444-4444-8444-444444444410',
    footerRegistration: '44444444-4444-4444-8444-444444444411',
    footerBanking: '44444444-4444-4444-8444-444444444412',
    documentTitle: '44444444-4444-4444-8444-444444444413',
    documentNumber: '44444444-4444-4444-8444-444444444414',
    documentMetaLabels: '44444444-4444-4444-8444-444444444415',
    detailRule: '44444444-4444-4444-8444-444444444416',
    introAccent: '44444444-4444-4444-8444-444444444417',
    intro: '44444444-4444-4444-8444-444444444418',
    closing: '44444444-4444-4444-8444-444444444419'
  }
};

const box = (value: number) => ({
  top: value,
  right: value,
  bottom: value,
  left: value
});

const PDFME_V2_COMPANY_DETAILS = [
  'ATEHNA d.o.o., izobraževanje, proizvodnja in storitve',
  'Ajdovska 1',
  '4264 Bohinjska Bistrica',
  'Tel.: +386 4 57 47 300',
  'www.atehna.si'
].join('\n');

const PDFME_V2_FOOTER_REGISTRATION =
  'Reg. št. 1/05317/00, Temeljno sodišče v Kranju, osnovni kapital: 23.072,00 EUR';

const PDFME_V2_FOOTER_BANKING =
  'ID št. za DDV: SI32904789 · TRR Gorenjska banka d.d. Kranj · '
  + 'SWIFT: GORESI2X · IBAN: SI56 0700 0000 0027 638';

type DefaultDocumentCopy = Readonly<{
  title: string;
  metaLabels: string;
  metaContent: string;
  metaBindings: readonly PdfmeV2BindingName[];
  totalsContent: string;
  intro?: string;
  closing: string;
  closingBindings?: readonly PdfmeV2BindingName[];
}>;

const DEFAULT_DOCUMENT_COPY: Readonly<
  Record<PdfmeV2DocumentType, DefaultDocumentCopy>
> = {
  order_summary: {
    title: 'POTRDITEV NAROČILA',
    metaLabels:
      'Datum:\nDatum naročila:\nVrsta naročnika:\nReferenca naročnika:',
    metaContent:
      '{issueDate}\n{orderDate}\n{customerType}\n{reference}',
    metaBindings: ['issueDate', 'orderDate', 'customerType', 'reference'],
    totalsContent:
      'Skupaj brez DDV: {subtotal}\n'
      + 'Davek: {tax}\n'
      + 'Stroški dostave: {shipping}\n'
      + 'VREDNOST NAROČILA EUR: {total}',
    intro:
      'Dokument potrjuje prejem naročila in ni račun.\n'
      + 'Hvala za vaše naročilo. Potrjujemo, da smo ga prejeli in ga bomo '
      + 'obdelali v najkrajšem možnem času.',
    closing:
      'O odpremi oziroma morebitnih spremembah vas bomo obvestili po e-pošti.'
  },
  dobavnica: {
    title: 'DOBAVNICA',
    metaLabels:
      'Datum:\nDatum odpreme:\nNačin odpreme:\n'
      + 'Številka naročilnice:\nDatum naročilnice:',
    metaContent:
      '{issueDate}\n{issueDate}\nPo dogovoru\n{reference}\n{orderDate}',
    metaBindings: ['issueDate', 'reference', 'orderDate'],
    totalsContent:
      'Skupaj: {subtotal}\n'
      + 'Davek: {tax}\n'
      + 'Stroški dostave: {shipping}\n'
      + 'SKUPAJ EUR: {total}',
    closing:
      'Predal: ______________________________    '
      + 'Prevzel: ______________________________'
  },
  predracun: {
    title: 'PREDRAČUN',
    metaLabels: 'Datum:\nVelja do:\nReferenca naročnika:',
    metaContent: '{issueDate}\n{dueDate}\n{reference}',
    metaBindings: ['issueDate', 'dueDate', 'reference'],
    totalsContent:
      'Skupaj: {subtotal}\n'
      + 'Davek: {tax}\n'
      + 'Stroški dostave: {shipping}\n'
      + 'ZA PLAČILO EUR: {total}',
    closing:
      'Predračun velja 15 dni. Plačilo na transakcijski račun '
      + 'SI56 0700 0000 0027 638.\n'
      + 'Dir. URBAN CESAR, dipl. inž. el. (UN)'
  },
  invoice: {
    title: 'RAČUN',
    metaLabels:
      'Datum:\nDatum naročila:\nŠtevilka naročilnice:\n'
      + 'Plačilo zapade:\nSklicna številka:',
    metaContent:
      '{issueDate}\n{orderDate}\n{reference}\n{dueDate}\n{reference}',
    metaBindings: ['issueDate', 'orderDate', 'reference', 'dueDate'],
    totalsContent:
      'Osnova za DDV: {subtotal}\n'
      + 'Davek: {tax}\n'
      + 'Stroški dostave: {shipping}\n'
      + 'ZA PLAČILO EUR: {total}',
    closing:
      'Prosimo, poravnajte račun na SI56 0700 0000 0027 638 '
      + 's sklicem {reference}.\n'
      + 'Dir. URBAN CESAR, dipl. inž. el. (UN)',
    closingBindings: ['reference']
  }
};

type TextSchemaOptions = Readonly<{
  fontName?: string;
  fontSize?: number;
  readOnly?: boolean;
  overflow?: 'visible' | 'expand';
  alignment?: 'left' | 'center' | 'right' | 'justify';
  verticalAlignment?: 'top' | 'middle' | 'bottom';
  textFormat?: 'plain' | 'markdown';
  lineHeight?: number;
  characterSpacing?: number;
  fontColor?: string;
  backgroundColor?: string;
  borderColor?: string;
  borderWidth?: ReturnType<typeof box>;
  padding?: ReturnType<typeof box>;
}>;

function textSchema(
  atehnaId: AtehnaId,
  name: string,
  content: string,
  geometry: { x: number; y: number; width: number; height: number },
  options: TextSchemaOptions = {}
): AtehnaPdfmeSchema {
  return {
    atehnaId,
    name,
    type: 'text',
    content,
    position: { x: geometry.x, y: geometry.y },
    width: geometry.width,
    height: geometry.height,
    rotate: 0,
    opacity: 1,
    readOnly: options.readOnly ?? true,
    fontName: options.fontName ?? PDFME_V2_REGULAR_FONT_NAME,
    fontVariants: { bold: PDFME_V2_BOLD_FONT_NAME },
    textFormat: options.textFormat ?? 'plain',
    alignment: options.alignment ?? 'left',
    verticalAlignment: options.verticalAlignment ?? 'top',
    fontSize: options.fontSize ?? PDFME_V2_DOCUMENT_TYPOGRAPHY.body,
    lineHeight: options.lineHeight ?? 1.2,
    characterSpacing: options.characterSpacing ?? 0,
    overflow: options.overflow ?? 'visible',
    fontColor: options.fontColor ?? PDFME_V2_DOCUMENT_STYLE.textColor,
    backgroundColor: options.backgroundColor ?? '',
    borderColor: options.borderColor ?? '',
    borderWidth: options.borderWidth ?? box(0),
    padding: options.padding ?? box(0)
  } as AtehnaPdfmeSchema;
}

function lineSchema(
  atehnaId: AtehnaId,
  name: string,
  geometry: { x: number; y: number; width: number; height?: number }
): AtehnaPdfmeSchema {
  return {
    atehnaId,
    name,
    type: 'line',
    content: '',
    position: { x: geometry.x, y: geometry.y },
    width: geometry.width,
    height: geometry.height ?? 0.2,
    rotate: 0,
    opacity: 1,
    readOnly: true,
    color: PDFME_V2_DOCUMENT_STYLE.lineColor
  } as AtehnaPdfmeSchema;
}

function accentSchema(
  atehnaId: AtehnaId,
  name: string,
  geometry: { x: number; y: number; width: number; height: number }
): AtehnaPdfmeSchema {
  return {
    atehnaId,
    name,
    type: 'rectangle',
    content: '',
    position: { x: geometry.x, y: geometry.y },
    width: geometry.width,
    height: geometry.height,
    rotate: 0,
    opacity: 1,
    readOnly: true,
    borderWidth: 0,
    borderColor: PDFME_V2_DOCUMENT_STYLE.accentColor,
    color: PDFME_V2_DOCUMENT_STYLE.accentColor,
    radius: 0
  } as AtehnaPdfmeSchema;
}

function tableCellStyle(
  fontName: string,
  fontColor: string
) {
  return {
    fontName,
    alignment: 'left',
    verticalAlignment: 'top',
    fontSize: PDFME_V2_DOCUMENT_TYPOGRAPHY.table,
    lineHeight: 1.2,
    characterSpacing: 0,
    fontColor,
    backgroundColor: PDFME_V2_DOCUMENT_STYLE.tableHeaderBackground,
    borderColor: PDFME_V2_DOCUMENT_STYLE.lineColor,
    borderWidth: box(0),
    padding: box(1.2)
  };
}

function itemTableSchema(
  atehnaId: AtehnaId,
  y: number
): AtehnaPdfmeSchema {
  return {
    atehnaId,
    name: 'itemsTable',
    type: 'table',
    content: '[]',
    position: { x: PDFME_V2_DOCUMENT_GEOMETRY.marginX, y },
    width: PDFME_V2_DOCUMENT_GEOMETRY.contentWidth,
    height: 68,
    rotate: 0,
    opacity: 1,
    readOnly: false,
    showHead: true,
    repeatHead: true,
    head: [...PDFME_V2_ITEM_TABLE_HEADERS],
    headWidthPercentages: [...PDFME_V2_DEFAULT_TABLE_WIDTH_PERCENTAGES],
    tableStyles: {
      borderColor: PDFME_V2_DOCUMENT_STYLE.lineColor,
      borderWidth: 0
    },
    headStyles: tableCellStyle(
      PDFME_V2_BOLD_FONT_NAME,
      PDFME_V2_DOCUMENT_STYLE.textColor
    ),
    bodyStyles: {
      ...tableCellStyle(
        PDFME_V2_REGULAR_FONT_NAME,
        PDFME_V2_DOCUMENT_STYLE.textColor
      ),
      alternateBackgroundColor: PDFME_V2_DOCUMENT_STYLE.tableStripeColor
    },
    columnStyles: {
      alignment: { 2: 'right', 4: 'right', 5: 'right' }
    }
  } as AtehnaPdfmeSchema;
}

type DefaultElementDefinition = Readonly<{
  role: DefaultElementRole;
  label: string;
  schema: AtehnaPdfmeSchema;
  bindings?: readonly PdfmeV2BindingName[];
  visibilityCondition?: PdfmeV2VisibilityCondition;
  repeat?: 'header' | 'footer';
}>;

function defaultElements(type: PdfmeV2DocumentType): DefaultElementDefinition[] {
  const ids = DEFAULT_ELEMENT_IDS[type];
  const copy = DEFAULT_DOCUMENT_COPY[type];
  const tableY = copy.intro ? 122 : 106;
  const totalsY = tableY + 75;
  const notesY = totalsY + 34;
  const closingY = notesY + 28;
  const elements: DefaultElementDefinition[] = [
    {
      role: 'headerTitle',
      label: 'Besedni znak ATEHNA',
      repeat: 'header',
      schema: textSchema(
        ids.headerTitle,
        'znamkaAtehna',
        'ATEHNA',
        { x: 10, y: 7.5, width: 74, height: 11 },
        {
          fontName: PDFME_V2_BOLD_FONT_NAME,
          fontSize: PDFME_V2_DOCUMENT_TYPOGRAPHY.wordmark,
          fontColor: PDFME_V2_DOCUMENT_STYLE.accentColor,
          characterSpacing: 0.8,
          lineHeight: 1
        }
      )
    },
    {
      role: 'headerTagline',
      label: 'Slogan ATEHNA',
      repeat: 'header',
      schema: textSchema(
        ids.headerTagline,
        'sloganAtehna',
        'varčevanje z energijo',
        { x: 10, y: 21.5, width: 74, height: 5 },
        {
          fontSize: 6.4,
          fontColor: PDFME_V2_DOCUMENT_STYLE.mutedTextColor,
          characterSpacing: 1.2,
          lineHeight: 1
        }
      )
    },
    {
      role: 'headerCompany',
      label: 'Podatki podjetja',
      repeat: 'header',
      schema: textSchema(
        ids.headerCompany,
        'podatkiPodjetja',
        PDFME_V2_COMPANY_DETAILS,
        { x: 112, y: 8, width: 88, height: 24 },
        {
          fontSize: 6.7,
          alignment: 'right',
          fontColor: PDFME_V2_DOCUMENT_STYLE.mutedTextColor,
          lineHeight: 1.18
        }
      )
    },
    {
      role: 'headerRule',
      label: 'Ločilna črta glave',
      repeat: 'header',
      schema: lineSchema(
        ids.headerRule,
        'crtaGlave',
        { x: 10, y: 37, width: 190 }
      )
    },
    {
      role: 'documentTitle',
      label: 'Naslov dokumenta',
      schema: textSchema(
        ids.documentTitle,
        'naslovDokumenta',
        copy.title,
        { x: 10, y: 45, width: 140, height: 10 },
        {
          fontName: PDFME_V2_BOLD_FONT_NAME,
          fontSize: PDFME_V2_DOCUMENT_TYPOGRAPHY.title,
          lineHeight: 1
        }
      )
    },
    {
      role: 'documentNumber',
      label: 'Številka dokumenta',
      bindings: ['documentNumber'],
      schema: textSchema(
        ids.documentNumber,
        'stevilkaDokumenta',
        '{documentNumber}',
        { x: 150, y: 45, width: 50, height: 10 },
        {
          fontName: PDFME_V2_BOLD_FONT_NAME,
          fontSize: 10.5,
          alignment: 'right',
          lineHeight: 1
        }
      )
    },
    {
      role: 'customer',
      label: 'Naročnik',
      bindings: [
        'customerName',
        'customerContactName',
        'customerAddress',
        'customerEmail'
      ],
      schema: textSchema(
        ids.customer,
        'narocnik',
        'Stranka: {customerName}\n'
          + 'Kontakt: {customerContactName}\n'
          + 'Naslov: {customerAddress}\n'
          + 'E-pošta: {customerEmail}',
        { x: 10, y: 62, width: 102, height: 33 },
        {
          fontSize: PDFME_V2_DOCUMENT_TYPOGRAPHY.body,
          textFormat: 'plain',
          lineHeight: 1.22,
          overflow: 'expand'
        }
      )
    },
    {
      role: 'documentMetaLabels',
      label: 'Oznake podatkov dokumenta',
      schema: textSchema(
        ids.documentMetaLabels,
        'oznakeDokumenta',
        copy.metaLabels,
        { x: 120, y: 62, width: 35, height: 33 },
        {
          fontSize: 7.5,
          fontColor: PDFME_V2_DOCUMENT_STYLE.mutedTextColor,
          lineHeight: 1.3
        }
      )
    },
    {
      role: 'documentMeta',
      label: 'Podatki dokumenta',
      bindings: copy.metaBindings,
      schema: textSchema(
        ids.documentMeta,
        'podatkiDokumenta',
        copy.metaContent,
        { x: 155, y: 62, width: 45, height: 33 },
        {
          fontSize: 7.5,
          alignment: 'right',
          lineHeight: 1.3
        }
      )
    },
    {
      role: 'detailRule',
      label: 'Ločilna črta podatkov',
      schema: lineSchema(
        ids.detailRule,
        'crtaPodatkov',
        { x: 10, y: 99, width: 190 }
      )
    }
  ];

  if (copy.intro) {
    elements.push(
      {
        role: 'introAccent',
        label: 'Poudarek uvoda',
        schema: accentSchema(
          ids.introAccent,
          'poudarekUvoda',
          { x: 10, y: 103, width: 0.8, height: 14 }
        )
      },
      {
        role: 'intro',
        label: 'Uvod',
        schema: textSchema(
          ids.intro,
          'uvod',
          copy.intro,
          { x: 14, y: 102, width: 186, height: 16 },
          {
            fontSize: 8,
            textFormat: 'plain',
            lineHeight: 1.22,
            overflow: 'expand'
          }
        )
      }
    );
  }

  elements.push(
    {
      role: 'itemsTable',
      label: 'Postavke',
      bindings: ['itemsTable'],
      schema: itemTableSchema(ids.itemsTable, tableY)
    },
    {
      role: 'totals',
      label: 'Seštevki',
      bindings: ['subtotal', 'tax', 'shipping', 'total'],
      schema: textSchema(
        ids.totals,
        'sestevki',
        copy.totalsContent,
        { x: 118, y: totalsY, width: 82, height: 28 },
        {
          fontSize: PDFME_V2_DOCUMENT_TYPOGRAPHY.body,
          textFormat: 'plain',
          overflow: 'expand',
          alignment: 'right',
          lineHeight: 1.3,
          borderColor: PDFME_V2_DOCUMENT_STYLE.accentColor,
          borderWidth: box(0.25),
          padding: box(1.2)
        }
      )
    },
    {
      role: 'notes',
      label: 'Opombe',
      bindings: ['notes'],
      visibilityCondition: 'hasNotes',
      schema: textSchema(
        ids.notes,
        'opombe',
        'Opombe:\n{notes}',
        { x: 10, y: notesY, width: 190, height: 22 },
        {
          fontSize: 8,
          textFormat: 'plain',
          overflow: 'expand',
          lineHeight: 1.25
        }
      )
    },
    {
      role: 'closing',
      label: type === 'dobavnica' ? 'Podpisa' : 'Zaključek',
      bindings: copy.closingBindings,
      schema: textSchema(
        ids.closing,
        'zakljucek',
        copy.closing,
        { x: 10, y: closingY, width: 190, height: 12 },
        {
          fontSize: 7.5,
          textFormat: 'plain',
          overflow: 'expand',
          lineHeight: 1.25
        }
      )
    },
    {
      role: 'footerRegistration',
      label: 'Registrski podatki',
      repeat: 'footer',
      schema: textSchema(
        ids.footerRegistration,
        'registrskiPodatki',
        PDFME_V2_FOOTER_REGISTRATION,
        { x: 10, y: 278, width: 190, height: 4.5 },
        {
          fontSize: 5.5,
          alignment: 'center',
          fontColor: PDFME_V2_DOCUMENT_STYLE.mutedTextColor,
          lineHeight: 1
        }
      )
    },
    {
      role: 'footerBanking',
      label: 'Bančni podatki',
      repeat: 'footer',
      schema: textSchema(
        ids.footerBanking,
        'bancniPodatki',
        PDFME_V2_FOOTER_BANKING,
        { x: 10, y: 283, width: 150, height: 6 },
        {
          fontSize: 5.8,
          alignment: 'left',
          fontColor: PDFME_V2_DOCUMENT_STYLE.mutedTextColor,
          lineHeight: 1
        }
      )
    },
    {
      role: 'footerPageNumber',
      label: 'Številčenje strani',
      bindings: ['currentPage', 'totalPages'],
      repeat: 'footer',
      schema: textSchema(
        ids.footerPageNumber,
        'stevilcenjeStrani',
        'Stran {currentPage} / {totalPages}',
        { x: 165, y: 283, width: 35, height: 6 },
        {
          fontSize: 6.5,
          alignment: 'right',
          fontColor: PDFME_V2_DOCUMENT_STYLE.mutedTextColor,
          lineHeight: 1
        }
      )
    }
  );

  // pdfme UI 6.1.12 supplies the schema index as currentPage while authoring.
  // Keeping this schema first makes the one-page canvas display 1 / 1; the
  // generator still supplies authoritative page variables after compilation.
  const pageNumber = elements.find(
    ({ role }) => role === 'footerPageNumber'
  );
  if (!pageNumber) return elements;
  return [
    pageNumber,
    ...elements.filter(({ role }) => role !== 'footerPageNumber')
  ];
}

export function createBlankA4PdfmeTemplate(): PdfmeV2AuthoringTemplate {
  const basePdf: BlankPdf = {
    width: PDFME_V2_A4_WIDTH_MM,
    height: PDFME_V2_A4_HEIGHT_MM,
    padding: [...PDFME_V2_DEFAULT_PADDING_MM]
  };
  return {
    basePdf,
    schemas: [[]],
    pdfmeVersion: PDFME_V2_ENGINE_VERSION
  };
}

export function createDefaultPdfmeV2Template(
  type: PdfmeV2DocumentType
): PdfmeV2CanonicalTemplate {
  const elements = defaultElements(type);
  const template = createBlankA4PdfmeTemplate();
  template.schemas = [elements.map(({ schema }) => schema)];

  const labels = Object.fromEntries(
    elements.map(({ label, schema }) => [schema.atehnaId, label])
  ) as Record<AtehnaId, string>;
  const bindings = Object.fromEntries(
    elements.flatMap(({ bindings: elementBindings, schema }) =>
      elementBindings && elementBindings.length > 0
        ? ([[schema.atehnaId, elementBindings]] as const)
        : []
    )
  ) as Record<AtehnaId, readonly PdfmeV2BindingName[]>;
  const visibilityConditions = Object.fromEntries(
    elements.flatMap(({ schema, visibilityCondition }) =>
      visibilityCondition
        ? ([[schema.atehnaId, visibilityCondition]] as const)
        : []
    )
  ) as Partial<Record<AtehnaId, PdfmeV2VisibilityCondition>>;

  return {
    template,
    envelope: {
      schemaVersion: PDFME_V2_SCHEMA_VERSION,
      pdfmeVersion: PDFME_V2_ENGINE_VERSION,
      documentType: type,
      labels,
      bindings,
      visibilityConditions,
      repeating: {
        header: elements
          .filter(({ repeat }) => repeat === 'header')
          .map(({ schema }) => schema.atehnaId),
        footer: elements
          .filter(({ repeat }) => repeat === 'footer')
          .map(({ schema }) => schema.atehnaId)
      },
      assetRevisionIds: {},
      revision: {
        activeRevisionId: null,
        baseRevisionId: null
      }
    }
  };
}
export function createDefaultPdfmeV2Templates(): Record<
  PdfmeV2DocumentType,
  PdfmeV2CanonicalTemplate
> {
  return Object.fromEntries(
    PDFME_V2_DOCUMENT_TYPES.map((type) => [
      type,
      createDefaultPdfmeV2Template(type)
    ])
  ) as Record<PdfmeV2DocumentType, PdfmeV2CanonicalTemplate>;
}

export function clonePdfmeV2CanonicalTemplate(
  canonical: PdfmeV2CanonicalTemplate
): PdfmeV2CanonicalTemplate {
  return cloneDeep(canonical);
}

export function getDefaultPdfmeV2ElementIds(
  type: PdfmeV2DocumentType
): Readonly<Record<DefaultElementRole, AtehnaId>> {
  return DEFAULT_ELEMENT_IDS[type];
}

export function getPdfmeV2DocumentTitle(type: PdfmeV2DocumentType): string {
  return PDFME_V2_DOCUMENT_TYPE_LABELS[type];
}
