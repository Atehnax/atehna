export type TableExportRows = ReadonlyArray<ReadonlyArray<string>>;

export type CsvExportOptions = {
  delimiter?: string;
};

export type XlsxExportOptions = {
  sheetName?: string;
};

const CSV_MIME_TYPE = 'text/csv;charset=utf-8';
const XLSX_MIME_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
const XLSX_MAX_ROWS = 1_048_576;
const XLSX_MAX_COLUMNS = 16_384;
const ZIP_UTF8_FLAG = 0x0800;
const ZIP_VERSION = 20;
const ZIP_STORED_METHOD = 0;
const ZIP_DOS_TIME = 0;
const ZIP_DOS_DATE = 0x0021;
const UINT32_MAX = 0xffffffff;
const textEncoder = new TextEncoder();
const CSV_FORMULA_PREFIX_PATTERN =
  /^[\s\u0000-\u001f\u007f-\u009f\u00ad\u200b-\u200f\u202a-\u202e\u2060-\u206f\ufeff]*[=+\-@]/u;

type ZipSourceEntry = {
  path: string;
  data: Uint8Array;
};

type EncodedZipEntry = ZipSourceEntry & {
  encodedPath: Uint8Array;
  crc32: number;
  localHeaderOffset: number;
};

const crc32Table = (() => {
  const table = new Uint32Array(256);
  for (let index = 0; index < table.length; index += 1) {
    let value = index;
    for (let bit = 0; bit < 8; bit += 1) {
      value = (value & 1) !== 0 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
    }
    table[index] = value >>> 0;
  }
  return table;
})();

const encodeUtf8 = (value: string) => textEncoder.encode(value);

const toCellString = (value: string) => typeof value === 'string' ? value : String(value ?? '');

const neutralizeCsvFormula = (value: string) =>
  CSV_FORMULA_PREFIX_PATTERN.test(value) ? `'${value}` : value;

const escapeCsvCell = (value: string, delimiter: string) => {
  // Spreadsheet applications can ignore leading whitespace/control characters
  // before interpreting a CSV cell as a formula. A leading apostrophe forces
  // those cells to remain text while leaving ordinary values unchanged.
  const normalizedValue = neutralizeCsvFormula(toCellString(value));
  if (
    !normalizedValue.includes(delimiter)
    && !normalizedValue.includes('"')
    && !normalizedValue.includes('\r')
    && !normalizedValue.includes('\n')
  ) {
    return normalizedValue;
  }
  return `"${normalizedValue.replace(/"/g, '""')}"`;
};

const sanitizeXmlText = (value: string) => {
  let sanitizedValue = '';
  for (const character of toCellString(value)) {
    const codePoint = character.codePointAt(0) ?? 0;
    const isAllowed = codePoint === 0x09
      || codePoint === 0x0a
      || codePoint === 0x0d
      || (codePoint >= 0x20 && codePoint <= 0xd7ff)
      || (codePoint >= 0xe000 && codePoint <= 0xfffd)
      || (codePoint >= 0x10000 && codePoint <= 0x10ffff);
    if (isAllowed) sanitizedValue += character;
  }
  return sanitizedValue;
};

const escapeXml = (value: string) => sanitizeXmlText(value)
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&apos;');

const escapeSpreadsheetXml = (value: string) => escapeXml(
  toCellString(value).replace(/_x[0-9a-f]{4}_/gi, (match) => `_x005F_${match.slice(1)}`)
);

const normalizeSheetName = (value: string | undefined) => {
  const sourceName = sanitizeXmlText(value?.trim() || 'Podatki')
    .replace(/[\\/*?:[\]]/g, ' ')
    .replace(/^'+|'+$/g, '')
    .trim();
  const fallbackName = sourceName || 'Podatki';
  let normalizedName = '';
  for (const character of fallbackName) {
    if (normalizedName.length + character.length > 31) break;
    normalizedName += character;
  }
  return normalizedName || 'Podatki';
};

const getColumnName = (oneBasedColumnIndex: number) => {
  let currentIndex = oneBasedColumnIndex;
  let columnName = '';
  while (currentIndex > 0) {
    const remainder = (currentIndex - 1) % 26;
    columnName = String.fromCharCode(65 + remainder) + columnName;
    currentIndex = Math.floor((currentIndex - 1) / 26);
  }
  return columnName;
};

const calculateCrc32 = (data: Uint8Array) => {
  let checksum = UINT32_MAX;
  for (const byte of data) {
    checksum = (crc32Table[(checksum ^ byte) & 0xff] ^ (checksum >>> 8)) >>> 0;
  }
  return (checksum ^ UINT32_MAX) >>> 0;
};

const assertClassicZipSize = (value: number, label: string) => {
  if (!Number.isSafeInteger(value) || value < 0 || value > UINT32_MAX) {
    throw new RangeError(`${label} presega omejitev klasičnega zapisa ZIP.`);
  }
};

const concatenateBytes = (chunks: readonly Uint8Array[]) => {
  const totalLength = chunks.reduce((sum, chunk) => sum + chunk.byteLength, 0);
  assertClassicZipSize(totalLength, 'Velikost datoteke');
  const result = new Uint8Array(totalLength);
  let offset = 0;
  chunks.forEach((chunk) => {
    result.set(chunk, offset);
    offset += chunk.byteLength;
  });
  return result;
};

const createStoredZipBytes = (sourceEntries: readonly ZipSourceEntry[]) => {
  if (sourceEntries.length > 0xffff) {
    throw new RangeError('Število datotek presega omejitev klasičnega zapisa ZIP.');
  }

  const localChunks: Uint8Array[] = [];
  const encodedEntries: EncodedZipEntry[] = [];
  let localHeaderOffset = 0;

  sourceEntries.forEach((entry) => {
    const encodedPath = encodeUtf8(entry.path);
    if (encodedPath.byteLength > 0xffff) {
      throw new RangeError(`Ime datoteke »${entry.path}« je predolgo za zapis ZIP.`);
    }
    assertClassicZipSize(entry.data.byteLength, `Datoteka »${entry.path}«`);
    assertClassicZipSize(localHeaderOffset, 'Odmik datoteke');

    const crc32 = calculateCrc32(entry.data);
    const localChunk = new Uint8Array(30 + encodedPath.byteLength + entry.data.byteLength);
    const view = new DataView(localChunk.buffer);
    view.setUint32(0, 0x04034b50, true);
    view.setUint16(4, ZIP_VERSION, true);
    view.setUint16(6, ZIP_UTF8_FLAG, true);
    view.setUint16(8, ZIP_STORED_METHOD, true);
    view.setUint16(10, ZIP_DOS_TIME, true);
    view.setUint16(12, ZIP_DOS_DATE, true);
    view.setUint32(14, crc32, true);
    view.setUint32(18, entry.data.byteLength, true);
    view.setUint32(22, entry.data.byteLength, true);
    view.setUint16(26, encodedPath.byteLength, true);
    view.setUint16(28, 0, true);
    localChunk.set(encodedPath, 30);
    localChunk.set(entry.data, 30 + encodedPath.byteLength);
    localChunks.push(localChunk);
    encodedEntries.push({ ...entry, encodedPath, crc32, localHeaderOffset });
    localHeaderOffset += localChunk.byteLength;
  });

  const centralDirectoryOffset = localHeaderOffset;
  const centralChunks = encodedEntries.map((entry) => {
    const centralChunk = new Uint8Array(46 + entry.encodedPath.byteLength);
    const view = new DataView(centralChunk.buffer);
    view.setUint32(0, 0x02014b50, true);
    view.setUint16(4, ZIP_VERSION, true);
    view.setUint16(6, ZIP_VERSION, true);
    view.setUint16(8, ZIP_UTF8_FLAG, true);
    view.setUint16(10, ZIP_STORED_METHOD, true);
    view.setUint16(12, ZIP_DOS_TIME, true);
    view.setUint16(14, ZIP_DOS_DATE, true);
    view.setUint32(16, entry.crc32, true);
    view.setUint32(20, entry.data.byteLength, true);
    view.setUint32(24, entry.data.byteLength, true);
    view.setUint16(28, entry.encodedPath.byteLength, true);
    view.setUint16(30, 0, true);
    view.setUint16(32, 0, true);
    view.setUint16(34, 0, true);
    view.setUint16(36, 0, true);
    view.setUint32(38, 0, true);
    view.setUint32(42, entry.localHeaderOffset, true);
    centralChunk.set(entry.encodedPath, 46);
    return centralChunk;
  });
  const centralDirectorySize = centralChunks.reduce((sum, chunk) => sum + chunk.byteLength, 0);
  assertClassicZipSize(centralDirectoryOffset, 'Odmik osrednjega imenika ZIP');
  assertClassicZipSize(centralDirectorySize, 'Velikost osrednjega imenika ZIP');

  const endOfCentralDirectory = new Uint8Array(22);
  const endView = new DataView(endOfCentralDirectory.buffer);
  endView.setUint32(0, 0x06054b50, true);
  endView.setUint16(4, 0, true);
  endView.setUint16(6, 0, true);
  endView.setUint16(8, encodedEntries.length, true);
  endView.setUint16(10, encodedEntries.length, true);
  endView.setUint32(12, centralDirectorySize, true);
  endView.setUint32(16, centralDirectoryOffset, true);
  endView.setUint16(20, 0, true);

  return concatenateBytes([...localChunks, ...centralChunks, endOfCentralDirectory]);
};

const createWorksheetXml = (rows: TableExportRows) => {
  if (rows.length > XLSX_MAX_ROWS) {
    throw new RangeError(`Preglednica lahko vsebuje največ ${XLSX_MAX_ROWS} vrstic.`);
  }

  let maximumColumnCount = 0;
  rows.forEach((row) => {
    maximumColumnCount = Math.max(maximumColumnCount, row.length);
  });
  if (maximumColumnCount > XLSX_MAX_COLUMNS) {
    throw new RangeError(`Preglednica lahko vsebuje največ ${XLSX_MAX_COLUMNS} stolpcev.`);
  }

  const dimension = rows.length > 0 && maximumColumnCount > 0
    ? `A1:${getColumnName(maximumColumnCount)}${rows.length}`
    : 'A1';
  const xmlParts = [
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
    '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">',
    `<dimension ref="${dimension}"/>`,
    '<sheetViews><sheetView workbookViewId="0"/></sheetViews>',
    '<sheetFormatPr defaultRowHeight="15"/>',
    '<sheetData>'
  ];

  rows.forEach((row, rowIndex) => {
    const rowNumber = rowIndex + 1;
    if (row.length === 0) {
      xmlParts.push(`<row r="${rowNumber}"/>`);
      return;
    }
    xmlParts.push(`<row r="${rowNumber}">`);
    row.forEach((cell, columnIndex) => {
      const cellReference = `${getColumnName(columnIndex + 1)}${rowNumber}`;
      xmlParts.push(
        `<c r="${cellReference}" t="inlineStr"><is><t xml:space="preserve">${escapeSpreadsheetXml(cell)}</t></is></c>`
      );
    });
    xmlParts.push('</row>');
  });

  xmlParts.push('</sheetData></worksheet>');
  return xmlParts.join('');
};

const ensureFilenameExtension = (filename: string, extension: string, fallbackName: string) => {
  const normalizedFilename = filename.trim() || fallbackName;
  return normalizedFilename.toLocaleLowerCase().endsWith(extension)
    ? normalizedFilename
    : `${normalizedFilename}${extension}`;
};

export const createCsvText = (rows: TableExportRows, options: CsvExportOptions = {}) => {
  const delimiter = options.delimiter ?? ',';
  if (delimiter.length !== 1 || delimiter === '"' || delimiter === '\r' || delimiter === '\n') {
    throw new TypeError('Ločilo CSV mora biti en veljaven znak.');
  }
  const body = rows
    .map((row) => row.map((cell) => escapeCsvCell(cell, delimiter)).join(delimiter))
    .join('\r\n');
  return `\uFEFF${body}`;
};

export const createCsvBytes = (rows: TableExportRows, options: CsvExportOptions = {}) =>
  encodeUtf8(createCsvText(rows, options));

export const createCsvBlob = (rows: TableExportRows, options: CsvExportOptions = {}) =>
  new Blob([createCsvBytes(rows, options)], { type: CSV_MIME_TYPE });

export const createXlsxBytes = (rows: TableExportRows, options: XlsxExportOptions = {}) => {
  const sheetName = escapeSpreadsheetXml(normalizeSheetName(options.sheetName));
  const worksheetXml = createWorksheetXml(rows);
  const entries: ZipSourceEntry[] = [
    {
      path: '[Content_Types].xml',
      data: encodeUtf8(
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        + '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
        + '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
        + '<Default Extension="xml" ContentType="application/xml"/>'
        + '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>'
        + '<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>'
        + '</Types>'
      )
    },
    {
      path: '_rels/.rels',
      data: encodeUtf8(
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
        + '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>'
        + '</Relationships>'
      )
    },
    {
      path: 'xl/workbook.xml',
      data: encodeUtf8(
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        + '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" '
        + 'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">'
        + `<sheets><sheet name="${sheetName}" sheetId="1" r:id="rId1"/></sheets>`
        + '</workbook>'
      )
    },
    {
      path: 'xl/_rels/workbook.xml.rels',
      data: encodeUtf8(
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
        + '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>'
        + '</Relationships>'
      )
    },
    {
      path: 'xl/worksheets/sheet1.xml',
      data: encodeUtf8(worksheetXml)
    }
  ];
  return createStoredZipBytes(entries);
};

export const createXlsxBlob = (rows: TableExportRows, options: XlsxExportOptions = {}) =>
  new Blob([createXlsxBytes(rows, options)], { type: XLSX_MIME_TYPE });

export const downloadBlob = (blob: Blob, filename: string) => {
  if (
    typeof document === 'undefined'
    || typeof URL === 'undefined'
    || typeof URL.createObjectURL !== 'function'
  ) {
    throw new Error('Prenos datoteke je na voljo samo v brskalniku.');
  }

  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = objectUrl;
  link.download = filename;
  link.style.display = 'none';
  document.body.appendChild(link);
  try {
    link.click();
  } finally {
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 0);
  }
};

export const downloadTableAsCsv = (
  rows: TableExportRows,
  filename: string,
  options: CsvExportOptions = {}
) => downloadBlob(
  createCsvBlob(rows, options),
  ensureFilenameExtension(filename, '.csv', 'izvoz.csv')
);

export const downloadTableAsXlsx = (
  rows: TableExportRows,
  filename: string,
  options: XlsxExportOptions = {}
) => downloadBlob(
  createXlsxBlob(rows, options),
  ensureFilenameExtension(filename, '.xlsx', 'izvoz.xlsx')
);
