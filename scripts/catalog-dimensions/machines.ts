/** Deterministic vector diagrams. Work areas never stand in for unverified machine dimensions. */
export type MachineSketch = { svg: string; width: number; height: number; basis: string[] };
const WIDTH = 1800;
const HEIGHT = 1800;
const INK = '#334155';
const MUTED = '#64748b';
const GUIDE = '#94a3b8';
const FILL = '#f8fafc';
const PROXXON_MANUAL = 'https://s3-eu-west-1.amazonaws.com/plentymarkets-public-94/rzc8p33vcg85/propertyItems/10335/Bedienungsanleitung_28092-Dekupiers%C3%A4ge_aktuell.pdf';
const PROXXON_PRODUCT = 'https://www.proxxon.com/en/micromot/28092.php';
const ALTON_PRODUCT = 'https://alton.nl/thermoform-400.html';
const ATEHNA_THERMOFORM = 'https://atehna.si/product/krivilnik-za-plasticne-mase-thermoform-400/';
const escapeXml = (value: string) => value.replace(/[<>&"']/g, char => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' }[char]!));
const text = (x: number, y: number, content: string, size = 44, extra = '') =>
  '<text x="' + x + '" y="' + y + '" font-size="' + size + '" ' + extra + '>' + escapeXml(content) + '</text>';
const line = (x1: number, y1: number, x2: number, y2: number, color = GUIDE, arrows = false) =>
  '<line x1="' + x1 + '" y1="' + y1 + '" x2="' + x2 + '" y2="' + y2 + '" stroke="' + color + '" stroke-width="2.4"' +
  (arrows ? ' marker-start="url(#machine-dimension-arrow)" marker-end="url(#machine-dimension-arrow)"' : '') + '/>';

function horizontalDimension(x1: number, x2: number, y: number, objectY: number, label: string, above = false) {
  const beyond = above ? y - 14 : y + 14;
  return '<g class="dimension">' +
    line(x1, objectY, x1, beyond) + line(x2, objectY, x2, beyond) +
    line(x1, y, x2, y, INK, true) +
    text((x1 + x2) / 2, above ? y - 25 : y + 62, label, 52, 'text-anchor="middle" font-weight="500"') + '</g>';
}

/** Vertical dimension lines still use horizontal number labels. */
function verticalDimension(y1: number, y2: number, x: number, objectX: number, label: string, right = false, endObjectX = objectX) {
  const beyond = right ? x + 14 : x - 14;
  const labelX = right ? x + 28 : x - 28;
  return '<g class="dimension">' +
    line(objectX, y1, beyond, y1) + line(endObjectX, y2, beyond, y2) +
    line(x, y1, x, y2, INK, true) +
    text(labelX, (y1 + y2) / 2 + 18, label, 52, 'text-anchor="' + (right ? 'start' : 'end') + '" font-weight="500"') + '</g>';
}

function header(title: string, subtitle: string) {
  const lines: string[] = [];
  for (const word of title.split(/\s+/)) {
    if (!lines.length || lines[lines.length - 1].length + word.length > 48) lines.push(word);
    else lines[lines.length - 1] += ' ' + word;
  }
  return lines.map((entry, index) => text(100, 134 + index * 72, entry, 62, 'font-weight="600" letter-spacing="-0.5"')).join('') +
    text(100, 202 + (lines.length - 1) * 72, subtitle, 38, 'fill="' + MUTED + '"');
}

function svgDocument(title: string, subtitle: string, body: string, footnotes: string[], basis: string[]): MachineSketch {
  const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="' + WIDTH + '" height="' + HEIGHT + '" viewBox="0 0 ' + WIDTH + ' ' + HEIGHT + '" role="img" aria-labelledby="machine-title machine-description">' +
    '<title id="machine-title">' + escapeXml(title) + ' – tehnična skica</title>' +
    '<desc id="machine-description">' + escapeXml(subtitle + '. ' + footnotes.join(' ')) + '</desc>' +
    '<metadata>' + escapeXml(JSON.stringify({ basis, schematic: true })) + '</metadata>' +
    '<defs><marker id="machine-dimension-arrow" markerWidth="15" markerHeight="15" refX="10" refY="5" viewBox="0 0 10 10" orient="auto-start-reverse" markerUnits="userSpaceOnUse"><path d="M0 0 L10 5 L0 10 Z" fill="' + INK + '"/></marker></defs>' +
    '<rect width="' + WIDTH + '" height="' + HEIGHT + '" fill="#ffffff"/>' +
    '<g font-family="Arial, Helvetica, sans-serif" fill="' + INK + '" stroke-linecap="round" stroke-linejoin="round">' +
    header(title, subtitle) + body +
    footnotes.map((entry, index) => text(100, 1750 - (footnotes.length - 1 - index) * 47, entry, 30, 'fill="' + MUTED + '"')).join('') +
    '</g></svg>';
  return { svg, width: WIDTH, height: HEIGHT, basis };
}

function renderThermoform(title: string): MachineSketch {
  const basis = [
    ALTON_PRODUCT,
    ATEHNA_THERMOFORM,
    'Alton: delovna širina 400 mm; največja debelina materiala 5 mm.',
    'Atehna: delovna površina 440 × 165 mm; dolžina grelne žice 400 mm.',
    'Zunanje mere celotnega stroja niso potrjene; diagram prikazuje samo delovno površino.'
  ];
  const body =
    text(200, 342, 'Delovna površina · pogled od zgoraj', 46, 'font-weight="600"') +
    '<rect x="200" y="530" width="1100" height="412.5" fill="' + FILL + '" stroke="' + INK + '" stroke-width="3"/>' +
    horizontalDimension(200, 1300, 442, 530, '440 mm', true) +
    verticalDimension(530, 942.5, 1385, 1300, '165 mm', true) +
    text(250, 630, 'Grelna žica', 44) +
    '<line x1="250" y1="695" x2="1250" y2="695" stroke="' + INK + '" stroke-width="5"/>' +
    horizontalDimension(250, 1250, 800, 695, '400 mm') +
    text(200, 1210, 'Največja debelina materiala', 46, 'font-weight="600"') +
    text(200, 1304, '5 mm', 76);
  return svgDocument(title, 'Tehnična skica · mere v milimetrih', body,
    ['Prikazana je delovna površina; zunanje mere celotnega stroja niso navedene.',
      'Skica ni v merilu. Vira: Alton THERMOFORM 400 in Atehna.'], basis);
}

function renderProxxon(title: string): MachineSketch {
  const basis = [
    PROXXON_MANUAL,
    PROXXON_PRODUCT,
    'PROXXON DSH 28092: navodila rev. 4/2015-06, str. 14: D × Š × V = 53 × 27 × 33 cm.',
    'Delovna miza: 360 × 180 mm; potrjeno tudi na uradni produktni strani proizvajalca.',
    'Obris stroja je poenostavljena vektorska shema, ne risba sestavnih delov ali prikaz dejanskih barv.'
  ];
  const body =
    text(410, 326, 'Stranski pogled', 46, 'font-weight="600"') +
    '<g transform="translate(80 -120) scale(1.5)" stroke="' + INK + '" stroke-width="2.4" fill="' + FILL + '">' +
      '<path d="M 293 418 Q 278 402 300 392 L 756 375 Q 827 373 852 426 L 880 735 L 815 735 L 795 471 Q 792 446 758 442 L 313 460 Q 293 460 293 438 Z"/>' +
      '<path d="M 320 375 L 320 370 M 338 375 L 338 370" fill="none"/>' +
      '<rect x="300" y="350" width="58" height="20" rx="7"/>' +
      '<circle cx="805" cy="673" r="57"/>' +
      '<path d="M 285 735 L 299 657 L 412 657 L 429 735 Z"/>' +
      '<path d="M 245 624 L 640 624 L 640 640 L 245 640 Z"/>' +
      '<path d="M 220 749 L 240 735 L 889 735 L 909 753 L 909 779 L 220 779 Z"/>' +
      '<line x1="330" y1="459" x2="330" y2="655" stroke="' + MUTED + '" stroke-width="2.8"/>' +
    '</g>' +
    horizontalDimension(410, 1443.5, 1120, 1048.5, '530 mm') +
    verticalDimension(405, 1048.5, 285, 530, '330 mm', false, 410) +
    text(400, 1270, 'Sprednji pogled', 44, 'font-weight="600"') +
    '<g transform="translate(-990 515) scale(1.2)" stroke="' + INK + '" stroke-width="2.5" fill="' + FILL + '">' +
      '<path d="M 1206 873 L 1235 720 Q 1240 699 1278 699 Q 1316 699 1321 720 L 1350 873 Z"/>' +
      '<rect x="1256" y="682" width="44" height="17" rx="6"/>' +
      '<rect x="1201" y="790" width="154" height="13"/>' +
      '<line x1="1278" y1="742" x2="1278" y2="811" stroke="' + MUTED + '" stroke-width="2.5"/>' +
      '<rect x="1170" y="873" width="216" height="29" rx="3"/>' +
    '</g>' +
    horizontalDimension(414, 673.2, 1632, 1597.4, '270 mm') +
    text(1030, 1270, 'Delovna miza · pogled od zgoraj', 38, 'font-weight="600"') +
    '<rect x="1040" y="1400" width="450" height="225" rx="8" fill="' + FILL + '" stroke="' + INK + '" stroke-width="3"/>' +
    horizontalDimension(1040, 1490, 1360, 1400, '360 mm', true) +
    verticalDimension(1400, 1625, 1540, 1490, '180 mm', true);
  return svgDocument(title, 'Tehnična skica · mere v milimetrih', body,
    ['PROXXON 28092 · navodila 4/2015-06, str. 14. Poenostavljeni obrisi; skica ni v merilu.'], basis);
}

export function renderMachineSketch(slug: string, title: string): MachineSketch | null {
  if (slug === 'vibracijska-zaga-proxxon-dsh') return renderProxxon(title);
  if (slug === 'krivilnik-za-plasticne-mase' || slug === 'krivilnik-za-plasticne-mase-thermoform-400') return renderThermoform(title);
  return null;
}
