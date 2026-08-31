import 'server-only';

import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { Font } from '@pdfme/common';

export const PDFME_V2_FONT_ASSETS = {
  NotoSans: {
    publicPath: '/fonts/NotoSans-Regular.ttf',
    filePath: 'public/fonts/NotoSans-Regular.ttf',
    fileName: 'NotoSans-Regular.ttf',
    sha256: 'fe8c022f48d8dd29f17b744d16f9346f4357e16f7d4f7be58b000ae7c291b614',
    fallback: true
  },
  NotoSansBold: {
    publicPath: '/fonts/NotoSans-Bold.ttf',
    filePath: 'public/fonts/NotoSans-Bold.ttf',
    fileName: 'NotoSans-Bold.ttf',
    sha256: '13a813c49624ae3ba3c5c6e72c5ebffc4b9e1e6ea32f421c04069b037c6ad431',
    fallback: false
  }
} as const;

export const PDFME_V2_FONT_HASHES = {
  NotoSans: PDFME_V2_FONT_ASSETS.NotoSans.sha256,
  NotoSansBold: PDFME_V2_FONT_ASSETS.NotoSansBold.sha256
} as const;

export type PdfmeV2FontName = keyof typeof PDFME_V2_FONT_ASSETS;

type LoadedFontAsset = {
  bytes: Uint8Array<ArrayBuffer>;
  sha256: string;
};

let loadedFontAssetsPromise: Promise<Record<PdfmeV2FontName, LoadedFontAsset>> | null = null;

function sha256(bytes: Uint8Array) {
  return createHash('sha256').update(bytes).digest('hex');
}

async function readVerifiedFont(name: PdfmeV2FontName): Promise<LoadedFontAsset> {
  const asset = PDFME_V2_FONT_ASSETS[name];
  const fileBytes = await readFile(
    resolve(process.cwd(), 'public', 'fonts', asset.fileName)
  );
  const bytes = new Uint8Array(
    fileBytes.buffer.slice(fileBytes.byteOffset, fileBytes.byteOffset + fileBytes.byteLength)
  );
  const actualHash = sha256(bytes);

  if (actualHash !== asset.sha256) {
    throw new Error(
      `Pdfme v2 font integrity check failed for ${name}: expected ${asset.sha256}, got ${actualHash}.`
    );
  }

  return { bytes, sha256: actualHash };
}

async function loadVerifiedFontAssets() {
  loadedFontAssetsPromise ??= Promise.all([
    readVerifiedFont('NotoSans'),
    readVerifiedFont('NotoSansBold')
  ]).then(([regular, bold]) => ({
    NotoSans: regular,
    NotoSansBold: bold
  }));

  return loadedFontAssetsPromise;
}

export async function getPdfmeV2ServerFontHashes() {
  const assets = await loadVerifiedFontAssets();
  return {
    NotoSans: assets.NotoSans.sha256,
    NotoSansBold: assets.NotoSansBold.sha256
  } as const;
}

export async function loadPdfmeV2ServerFonts(): Promise<Font> {
  const assets = await loadVerifiedFontAssets();

  return {
    NotoSans: {
      data: assets.NotoSans.bytes.slice(),
      fallback: true
    },
    NotoSansBold: {
      data: assets.NotoSansBold.bytes.slice(),
      fallback: false
    }
  };
}
