'use client';

function bytesMatch(bytes: Uint8Array, expected: number[]): boolean {
  return expected.every((value, index) => bytes[index] === value);
}

export async function validateSiteLogoFileContent(file: File): Promise<void> {
  if (file.type === 'image/svg+xml') {
    const source = (await file.text()).replace(/^\uFEFF/u, '').trim();
    if (!/<svg\b/iu.test(source)) throw new Error('Datoteka ni veljaven SVG.');
    if (/<\s*script\b/iu.test(source)) throw new Error('SVG ne sme vsebovati skript.');
    if (/<\s*foreignObject\b/iu.test(source)) {
      throw new Error('SVG ne sme vsebovati elementa foreignObject.');
    }
    if (/\son[a-z][\w:.-]*\s*=/iu.test(source)) {
      throw new Error('SVG ne sme vsebovati aktivnih dogodkov.');
    }

    const hrefPattern = /\b(?:href|xlink:href)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/giu;
    for (const match of source.matchAll(hrefPattern)) {
      const href = (match[1] ?? match[2] ?? match[3] ?? '').trim();
      if (href && !href.startsWith('#')) {
        throw new Error('SVG ne sme vsebovati zunanjih povezav.');
      }
    }
    return;
  }

  const bytes = new Uint8Array(await file.slice(0, 12).arrayBuffer());
  const valid = file.type === 'image/png'
    ? bytesMatch(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
    : file.type === 'image/jpeg'
      ? bytesMatch(bytes, [0xff, 0xd8, 0xff])
      : file.type === 'image/webp'
        ? new TextDecoder('ascii').decode(bytes.slice(0, 4)) === 'RIFF' &&
          new TextDecoder('ascii').decode(bytes.slice(8, 12)) === 'WEBP'
        : false;

  if (!valid) {
    throw new Error('Vsebina datoteke se ne ujema z navedeno vrsto slike.');
  }
}
