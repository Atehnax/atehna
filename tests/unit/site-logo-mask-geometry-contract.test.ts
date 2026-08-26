import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';
import sharp from 'sharp';

const brandPath = (filename: string) => resolve(process.cwd(), 'public/brand', filename);
const primaryMaskPath = brandPath('atehna-logo-primary-mask.png');
const secondaryMaskPath = brandPath('atehna-logo-secondary-mask.png');
const taglineMaskPath = brandPath('atehna-logo-tagline-mask.png');
const artworkMaskPath = brandPath('atehna-logo-artwork-mask.png');
const generatorSource = readFileSync(
  resolve(process.cwd(), 'scripts/generate-atehna-logo-masks.mjs'),
  'utf8'
);
const clientArtworkSource = readFileSync(
  resolve(process.cwd(), 'src/shared/components/SiteLogoArtwork.tsx'),
  'utf8'
);
const serverArtworkSource = readFileSync(
  resolve(process.cwd(), 'src/shared/server/siteLogoArtworkCore.ts'),
  'utf8'
);

type AlphaImage = {
  alpha: Uint8Array;
  width: number;
  height: number;
};

async function readAlpha(path: string): Promise<AlphaImage> {
  const { data, info } = await sharp(path)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const alpha = new Uint8Array(info.width * info.height);
  for (let index = 0; index < alpha.length; index += 1) {
    alpha[index] = data[index * info.channels + 3];
  }
  return { alpha, width: info.width, height: info.height };
}

function eightConnectedBounds(image: AlphaImage) {
  const { alpha, width, height } = image;
  const visited = new Uint8Array(alpha.length);
  const components: Array<[number, number, number, number]> = [];

  for (let seed = 0; seed < alpha.length; seed += 1) {
    if (alpha[seed] === 0 || visited[seed]) continue;
    const queue = [seed];
    visited[seed] = 1;
    let minX = width;
    let minY = height;
    let maxX = -1;
    let maxY = -1;
    while (queue.length > 0) {
      const index = queue.pop()!;
      const x = index % width;
      const y = Math.floor(index / width);
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
      for (let offsetY = -1; offsetY <= 1; offsetY += 1) {
        for (let offsetX = -1; offsetX <= 1; offsetX += 1) {
          if (offsetX === 0 && offsetY === 0) continue;
          const neighborX = x + offsetX;
          const neighborY = y + offsetY;
          if (neighborX < 0 || neighborX >= width || neighborY < 0 || neighborY >= height) continue;
          const neighbor = neighborY * width + neighborX;
          if (alpha[neighbor] === 0 || visited[neighbor]) continue;
          visited[neighbor] = 1;
          queue.push(neighbor);
        }
      }
    }
    components.push([minX, minY, maxX, maxY]);
  }
  return components.sort((left, right) => left[0] - right[0] || left[1] - right[1]);
}

test('secondary artwork mask contains exactly the six clean d.o.o. components', async () => {
  const bytes = readFileSync(secondaryMaskPath);
  assert.equal(
    createHash('sha256').update(bytes).digest('hex'),
    '772e653af34bd78a57d4f7bc0706ec6d225a76421a27a6e24a3bbce978e7de65'
  );

  const secondary = await readAlpha(secondaryMaskPath);
  assert.equal(secondary.width, 1873);
  assert.equal(secondary.height, 840);
  assert.equal(secondary.alpha.filter(Boolean).length, 2_296);
  assert.deepEqual(eightConnectedBounds(secondary), [
    [1603, 334, 1642, 389],
    [1642, 377, 1651, 387],
    [1661, 351, 1692, 388],
    [1699, 375, 1716, 389],
    [1717, 351, 1749, 389],
    [1752, 377, 1765, 388]
  ]);

  for (let y = 0; y < secondary.height; y += 1) {
    for (let x = 0; x < secondary.width; x += 1) {
      const pixelAlpha: number = secondary.alpha[y * secondary.width + x] ?? 0;
      if (x < 1603 || x > 1765 || y < 334 || y > 389) assert.equal(pixelAlpha, 0);
    }
  }
  assert.equal(secondary.alpha[499 * secondary.width], 0, 'A full-width spill row must never return.');
});

test('the primary mask owns the full final A without overlap or holes', async () => {
  const [primary, secondary, tagline, artwork] = await Promise.all([
    readAlpha(primaryMaskPath),
    readAlpha(secondaryMaskPath),
    readAlpha(taglineMaskPath),
    readAlpha(artworkMaskPath)
  ]);
  assert.deepEqual(
    [primary.width, primary.height],
    [secondary.width, secondary.height]
  );

  for (let index = 0; index < primary.alpha.length; index += 1) {
    assert.ok(primary.alpha[index] === 0 || secondary.alpha[index] === 0, `Overlapping tone masks at pixel ${index}.`);
    assert.equal(
      artwork.alpha[index],
      Math.max(primary.alpha[index], secondary.alpha[index], tagline.alpha[index]),
      `Combined artwork mask differs at pixel ${index}.`
    );
  }

  const at = (image: AlphaImage, x: number, y: number) => image.alpha[y * image.width + x];
  assert.equal(at(primary, 1500, 350), 255);
  assert.equal(at(secondary, 1500, 350), 0);
  assert.equal(at(primary, 1520, 350), 255);
  assert.equal(at(secondary, 1520, 350), 0);
  for (let y = 260; y <= 380; y += 1) {
    for (let x = 1501; x <= 1504; x += 1) {
      assert.equal(
        at(primary, x, y),
        255,
        `Former final-A seam is not solid at (${x}, ${y}).`
      );
    }
  }
  assert.ok(at(secondary, 1630, 360) > 0, 'The authentic d.o.o. suffix must remain in the secondary tone.');
});

test('client and server consume the same secondary mask and server pixels reproduce its alpha exactly', () => {
  assert.match(
    clientArtworkSource,
    /BuiltInSiteLogoTextLayer/u
  );
  assert.match(clientArtworkSource, /SITE_LOGO_BUILTIN_MASK_URLS\.secondary/u);
  assert.match(serverArtworkSource, /SITE_LOGO_BUILTIN_MASK_URLS\[key\]/u);
  assert.match(serverArtworkSource, /builtInTextLayerMask\(\s*masks,\s*'secondaryText'/u);
  assert.match(serverArtworkSource, /coloredMask\(secondaryWorkspaceMask/u);
  assert.match(generatorSource, /FINAL_A_RIGHT_FACE_X = 1501/u);
  assert.match(generatorSource, /retainedComponents\.length !== 12 \|\| suffixLabels\.size !== 6/u);

  const script = String.raw`
    const { renderBuiltInAtehnaLogoArtwork } = await import('./src/shared/server/siteLogoArtwork.ts');
    const sharp = (await import('sharp')).default;
    const presentation = {
      backgroundColor: '#000000',
      taglineBackgroundColor: '#000000',
      primaryTextColor: '#000000',
      secondaryTextColor: '#FFFFFF',
      taglineTextColor: '#000000',
      outline: { enabled: false, color: '#000000', widthPx: 0 },
      shadow: { enabled: false, color: '#000000', opacity: 0, blurPx: 0, offsetXpx: 0, offsetYpx: 0 }
    };
    const [rendered, mask] = await Promise.all([
      sharp(await renderBuiltInAtehnaLogoArtwork(presentation)).ensureAlpha().raw().toBuffer({ resolveWithObject: true }),
      sharp('./public/brand/atehna-logo-secondary-mask.png').ensureAlpha().raw().toBuffer({ resolveWithObject: true })
    ]);
    let mismatches = 0;
    for (let index = 0; index < rendered.info.width * rendered.info.height; index += 1) {
      const expected = mask.data[index * mask.info.channels + 3];
      for (let channel = 0; channel < 3; channel += 1) {
        if (rendered.data[index * rendered.info.channels + channel] !== expected) mismatches += 1;
      }
    }
    process.stdout.write(JSON.stringify({
      mismatches,
      width: rendered.info.width,
      height: rendered.info.height
    }));
  `;
  const parity = JSON.parse(execFileSync(process.execPath, [
    '--conditions=react-server',
    '--import',
    'tsx',
    '--input-type=module',
    '--eval',
    script
  ], {
    cwd: process.cwd(),
    encoding: 'utf8'
  })) as { mismatches: number; width: number; height: number };

  assert.deepEqual(parity, { mismatches: 0, width: 1873, height: 840 });
});
