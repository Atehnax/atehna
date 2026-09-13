import type { DimensionProduct, Geometry } from './geometry';

const SIZE = 1800;
const INK = '#19354d';
const MUTED = '#657381';
const GUIDE = '#8393a1';
const FILL = '#f1f5f8';
const format = (value: number) => new Intl.NumberFormat('sl-SI', {
  maximumFractionDigits: 3
}).format(value);
const escapeXml = (value: unknown) => String(value ?? '').replace(/[&<>"']/g,
  character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[character]!));
const positive = (value: number | undefined) => value !== undefined && Number.isFinite(value) && value > 0;

/** Conservative Arial width estimate: wrapping does not depend on installed fonts. */
function textWidth(value: string, size: number) {
  return [...value].reduce((width, character) => width + (
    /[MW@%]/.test(character) ? 0.94 : /[ilI1.,:;!'|\s]/.test(character) ? 0.32 :
      /[A-ZČŠŽ0-9]/.test(character) ? 0.69 : 0.59
  ) * size, 0);
}
function text(x: number, y: number, value: string, size = 54, attributes = '') {
  return `<text x="${x}" y="${y}" font-size="${size}" ${attributes}>${escapeXml(value)}</text>`;
}
function wrappedLines(value: string, width: number, size: number) {
  const words = value.trim().split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    if (current && textWidth(`${current} ${word}`, size) > width) {
      lines.push(current);
      current = '';
    }
    // A long SKU/compound word must not escape the canvas.
    for (const character of word) {
      if (textWidth(current + character, size) > width) {
        lines.push(current);
        current = '';
      }
      current += character;
    }
    current += ' ';
  }
  if (current.trim()) lines.push(current.trim());
  return lines.map(line => line.trim());
}
function heading(value: string, y: number, initialSize: number, colour: string, weight: number) {
  let size = initialSize;
  let lines = wrappedLines(value, 1540, size);
  while (lines.length > 2 && size > 20) {
    size -= 2;
    lines = wrappedLines(value, 1540, size);
  }
  if (lines.length > 2) throw new Error('The product or variant title is too long for a two-line sketch heading.');
  if (lines.length === 2) {
    const words = value.trim().split(/\s+/);
    let imbalance = Number.POSITIVE_INFINITY;
    for (let split = 1; split < words.length; split++) {
      const candidate = [words.slice(0, split).join(' '), words.slice(split).join(' ')];
      const widths = candidate.map(line => textWidth(line, size));
      if (Math.max(...widths) <= 1540 && Math.abs(widths[0] - widths[1]) < imbalance) {
        lines = candidate;
        imbalance = Math.abs(widths[0] - widths[1]);
      }
    }
  }
  return lines.map((line, index) => text(900, y + index * (initialSize + 14), line, size,
    `text-anchor="middle" fill="${colour}" font-weight="${weight}"`)).join('');
}
function line(x1: number, y1: number, x2: number, y2: number, attributes = '') {
  return `<path d="M ${x1} ${y1} L ${x2} ${y2}" fill="none" stroke="${GUIDE}" stroke-width="3" ${attributes}/>`;
}
function arrow(x1: number, y1: number, x2: number, y2: number, both = true) {
  return line(x1, y1, x2, y2,
    `${both ? 'marker-start="url(#dimension-arrow)" ' : ''}marker-end="url(#dimension-arrow)"`);
}
function horizontalDimension(x1: number, x2: number, edgeY: number, y: number, label: string) {
  return line(x1, edgeY + 10, x1, y + 18) + line(x2, edgeY + 10, x2, y + 18) +
    arrow(x1, y, x2, y) + text((x1 + x2) / 2, y + 78, label, 64,
      'text-anchor="middle" font-weight="600"');
}
function verticalDimension(y1: number, y2: number, edgeX: number, x: number, label: string) {
  let dimension = line(edgeX + 10, y1, x + 18, y1) + line(edgeX + 10, y2, x + 18, y2);
  if (y2 - y1 < 85) {
    dimension += arrow(x, y1 - 58, x, y1, false) + arrow(x, y2 + 58, x, y2, false);
  } else dimension += arrow(x, y1, x, y2);
  const labelX = x + 38;
  const size = Math.min(58, (SIZE - 95 - labelX) / Math.max(1, textWidth(label, 1)));
  return dimension + text(labelX, (y1 + y2) / 2 + size * 0.35, label, size,
    'font-weight="600"');
}
function caption(value: string, y: number, x = 735) {
  return text(x, y, value, 32, `text-anchor="middle" fill="${MUTED}" letter-spacing="3" font-weight="600"`);
}
function note(value: string, y: number) {
  const size = Math.min(38, 1520 / Math.max(1, textWidth(value, 1)));
  return text(900, y, value, size, `text-anchor="middle" fill="${MUTED}"`);
}
function finishColour(geometry: Geometry) {
  const colour = geometry.colour?.trim().toLocaleLowerCase('sl-SI') ?? '';
  if (/črn/.test(colour)) return '#697784';
  if (/siv|srebr/.test(colour)) return '#dce3e8';
  if (/bel|prozor/.test(colour)) return '#f5f8fa';
  if (/rdeč/.test(colour)) return '#ead8d9';
  if (/roza/.test(colour)) return '#f0dee6';
  if (/modr/.test(colour)) return '#d7e5f1';
  if (/zelen/.test(colour)) return '#dce9de';
  if (/rumen|zlat/.test(colour)) return '#eee7ca';
  if (/rjav/.test(colour)) return '#e5ded4';
  if (/vijoli|lila/.test(colour)) return '#e4ddef';
  if (/oranž|marelič/.test(colour)) return '#efdfce';
  return FILL;
}
function rectangle(x: number, y: number, width: number, height: number, fill: string) {
  return `<rect x="${x}" y="${y}" width="${width}" height="${height}" fill="${fill}" stroke="${INK}" stroke-width="5"/>`;
}
function thicknessView(geometry: Geometry, width: number) {
  if (!positive(geometry.t)) {
    return caption('DEBELINA', 1450, 900) + note('Debelina ni navedena.', 1535);
  }
  const trueHeight = width * geometry.t! / geometry.a;
  const viewWidth = trueHeight > 110 ? width * 110 / trueHeight : width;
  const height = Math.max(20, Math.min(110, trueHeight));
  const x = 735 - viewWidth / 2;
  const y = 1495 - height / 2;
  return caption('POGLED S STRANI', 1415) +
    rectangle(x, y, viewWidth, height, finishColour(geometry)) +
    verticalDimension(y, y + height, x + viewWidth, x + viewWidth + 70, `t = ${format(geometry.t!)} mm`) +
    (trueHeight < 20 ? note('Debelina je zaradi berljivosti povečana.', 1630) : '');
}
function plate(geometry: Geometry) {
  const b = geometry.b!;
  const scale = Math.min(1030 / geometry.a, 630 / b);
  const width = geometry.a * scale;
  const height = b * scale;
  const x = 735 - width / 2;
  const y = 850 - height / 2;
  return caption('POGLED OD ZGORAJ', 470) +
    rectangle(x, y, width, height, finishColour(geometry)) +
    horizontalDimension(x, x + width, y + height, y + height + 70, `L = ${format(geometry.a)} mm`) +
    verticalDimension(y, y + height, x + width, x + width + 70, `W = ${format(b)} mm`) +
    thicknessView(geometry, Math.min(1030, width));
}
function ruler(geometry: Geometry) {
  const width = 1030;
  const x = 220;
  let body = '';
  if (positive(geometry.b)) {
    const scale = Math.min(width / geometry.a, 570 / geometry.b!);
    const measuredWidth = geometry.a * scale;
    const height = geometry.b! * scale;
    const rulerX = 735 - measuredWidth / 2;
    const y = 825 - height / 2;
    body += caption('POGLED OD ZGORAJ', 470) +
      rectangle(rulerX, y, measuredWidth, height, finishColour(geometry)) +
      horizontalDimension(rulerX, rulerX + measuredWidth, y + height, y + height + 90, `L = ${format(geometry.a)} mm`) +
      verticalDimension(y, y + height, rulerX + measuredWidth, rulerX + measuredWidth + 70, `W = ${format(geometry.b!)} mm`);
    body += note('Mere profila ravnila; višina ročaja ni navedena.', 1210);
  } else {
    body += caption('DOLŽINA RAVNILA', 470) + line(x, 805, x + width, 805, `style="stroke:${INK};stroke-width:6"`) +
      line(x, 781, x, 829) + line(x + width, 781, x + width, 829) +
      horizontalDimension(x, x + width, 829, 925, `L = ${format(geometry.a)} mm`) +
      note('Širina ni navedena; prikazana je samo dolžina.', 1205);
  }
  return body + thicknessView(geometry, width);
}
function triangle(geometry: Geometry) {
  const width = 1030;
  const height = geometry.side === 'hypotenuse' ? width / 2 : width / Math.sqrt(3);
  const x = 220;
  const y = 1150;
  const peakX = geometry.side === 'hypotenuse' ? x + width / 2 : x + width;
  const measuredSide = geometry.side === 'hypotenuse' ? 'Hipotenuza' : 'Daljša kateta';
  const angleX = geometry.side === 'hypotenuse' ? x + 128 : x + width - 76;
  const angleY = geometry.side === 'hypotenuse' ? y - 42 : y - height + 165;
  return caption('POGLED OD ZGORAJ', 470) +
    `<path d="M ${x} ${y} L ${x + width} ${y} L ${peakX} ${y - height} Z" fill="${finishColour(geometry)}" stroke="${INK}" stroke-width="5" stroke-linejoin="round"/>` +
    text(angleX, angleY, `${format(geometry.angle!)}°`, 52,
      `text-anchor="${geometry.side === 'hypotenuse' ? 'middle' : 'end'}" fill="${INK}"`) +
    horizontalDimension(x, x + width, y, y + 80, `${measuredSide} = ${format(geometry.a)} mm`) +
    note('Druge stranice in debelina niso navedene.', 1510);
}
function motor(geometry: Geometry) {
  const scale = Math.min(1030 / geometry.a, 560 / geometry.b!);
  const width = geometry.a * scale;
  const height = geometry.b! * scale;
  const x = 735 - width / 2;
  const y = 805 - height / 2;
  let body = caption('POGLED S STRANI · OHIŠJE', 470) +
    rectangle(x, y, width, height, FILL) +
    line(x - 30, 805, x + width + 35, 805, 'stroke-dasharray="20 12"') +
    horizontalDimension(x, x + width, y + height, y + height + 80, `L = ${format(geometry.a)} mm`) +
    verticalDimension(y, y + height, x + width, x + width + 70, `Ø D = ${format(geometry.b!)} mm`);
  body += caption('POGLED OD SPREDAJ', 1375, 650);
  const radius = 115;
  const cx = 650;
  const cy = 1520;
  body += `<circle cx="${cx}" cy="${cy}" r="${radius}" fill="${FILL}" stroke="${INK}" stroke-width="5"/>`;
  body += line(cx - radius - 25, cy, cx + radius + 25, cy, 'stroke-dasharray="16 10"') +
    line(cx, cy - radius - 25, cx, cy + radius + 25, 'stroke-dasharray="16 10"');
  if (positive(geometry.shaft)) {
    const shaftRadius = radius * geometry.shaft! / geometry.b!;
    body += `<circle cx="${cx}" cy="${cy}" r="${shaftRadius}" fill="#fff" stroke="${INK}" stroke-width="4"/>` +
      line(cx + shaftRadius, cy, 900, 1465) + line(900, 1465, 1045, 1465) +
      text(1070, 1480, `Os Ø ${format(geometry.shaft!)} mm`, 54, 'font-weight="600"');
  }
  body += text(980, 1575, 'Dolžina osi ni navedena.', 36, `fill="${MUTED}"`);
  return body;
}

/** One variant, measured geometry only; packaging and shipping data never enter this renderer. */
export function renderVariantDimensionSketch(product: DimensionProduct, geometry: Geometry) {
  if (!positive(geometry.a)) throw new Error('A dimension sketch needs a positive measured length.');
  if (geometry.kind === 'work-area') throw new Error('Work-area sketches use the dedicated machinery renderer.');
  if (['plate', 'motor'].includes(geometry.kind) && !positive(geometry.b)) {
    throw new Error(`${geometry.kind} needs a positive measured width or diameter.`);
  }
  for (const key of ['b', 't', 'shaft'] as const) {
    if (geometry[key] !== undefined && !positive(geometry[key])) throw new Error(`Invalid ${key} measurement.`);
  }
  if (geometry.kind === 'triangle' && !(
    (geometry.side === 'hypotenuse' && geometry.angle === 45) ||
    (geometry.side === 'long-leg' && geometry.angle === 60)
  )) throw new Error('Triangle geometry needs a verified measured side and matching angle.');
  if (geometry.kind === 'motor' && geometry.shaft && geometry.shaft >= geometry.b!) {
    throw new Error('Shaft diameter must be smaller than the motor body diameter.');
  }
  const identityParts = [geometry.name || geometry.variantSku];
  if (geometry.colour && !identityParts[0].toLocaleLowerCase('sl-SI').includes(geometry.colour.toLocaleLowerCase('sl-SI'))) {
    identityParts.push(geometry.colour);
  }
  const identity = identityParts.join(' · ');
  const body = geometry.kind === 'plate' ? plate(geometry) : geometry.kind === 'ruler' ? ruler(geometry) :
    geometry.kind === 'triangle' ? triangle(geometry) : motor(geometry);
  const description = [product.itemName, identity, `Dolžina ${format(geometry.a)} mm`,
    geometry.b ? `${geometry.kind === 'motor' ? 'Premer' : 'Širina'} ${format(geometry.b)} mm` : '',
    geometry.t ? `Debelina ${format(geometry.t)} mm` : '',
    geometry.shaft ? `Premer osi ${format(geometry.shaft)} mm` : ''
  ].filter(Boolean).join('; ');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${SIZE}" height="${SIZE}" viewBox="0 0 ${SIZE} ${SIZE}" role="img">` +
    `<title>${escapeXml(`${product.itemName} — ${identity}`)}</title><desc>${escapeXml(description)}</desc>` +
    `<defs><marker id="dimension-arrow" markerWidth="20" markerHeight="20" refX="10" refY="10" orient="auto-start-reverse" markerUnits="userSpaceOnUse"><path d="M 0 0 L 20 10 L 0 20 Z" fill="${GUIDE}"/></marker></defs>` +
    '<rect width="1800" height="1800" fill="#ffffff"/>' +
    `<g fill="${INK}" font-family="Arial, Helvetica, sans-serif">` +
    heading(product.itemName, 128, 78, INK, 700) + heading(identity, 290, 48, MUTED, 400) +
    caption('TEHNIČNA SKICA · MERE V MM', 405, 900) + body +
    note(`Skica ni v merilu.${geometry.colour ? ' Barva je shematska.' : ''}`, 1740) + '</g></svg>';
  return { svg, width: SIZE, height: SIZE };
}
