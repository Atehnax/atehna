import { access, copyFile, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const publicBrand = path.join(process.cwd(), 'public', 'brand');
const canonicalPath = path.join(publicBrand, 'atehna-document-wordmark.png');
const sourceDirectory = path.join(process.cwd(), 'scripts', 'assets');
const sourcePath = path.join(sourceDirectory, 'atehna-document-wordmark-source.png');
const BACKGROUND = [57, 54, 45];
const TAGLINE_BACKGROUND = [76, 72, 61];
const PRIMARY = [194, 169, 24];
const SECONDARY = [175, 153, 27];
const TAGLINE = [184, 184, 176];
const TAGLINE_BAND_Y = 500;
const WORDMARK_TOP = 150;
const WORDMARK_BOTTOM = 420;
const WORDMARK_COMPONENT_MIN_ALPHA = 10_000;
const FINAL_A_SEED = { x: 1450, y: 250 };
const FINAL_A_CLEANUP_LEFT_X = 1475;
const FINAL_A_RIGHT_FACE_X = 1501;
const SUFFIX_LEFT = 1580;

function projection(pixel, background, foreground) {
  const vector = foreground.map((channel, index) => channel - background[index]);
  const delta = pixel.map((channel, index) => channel - background[index]);
  const denominator = vector.reduce((sum, channel) => sum + channel * channel, 0);
  const amount = Math.max(0, Math.min(1, delta.reduce(
    (sum, channel, index) => sum + channel * vector[index],
    0
  ) / denominator));
  const error = pixel.reduce((sum, channel, index) => {
    const reconstructed = background[index] + vector[index] * amount;
    return sum + (channel - reconstructed) ** 2;
  }, 0);
  return { amount, error };
}

function rgbaMask(alpha) {
  const rgba = Buffer.alloc(alpha.length * 4);
  for (let index = 0; index < alpha.length; index += 1) {
    const offset = index * 4;
    rgba[offset] = 255;
    rgba[offset + 1] = 255;
    rgba[offset + 2] = 255;
    rgba[offset + 3] = alpha[index];
  }
  return rgba;
}

await mkdir(sourceDirectory, { recursive: true });
try {
  await access(sourcePath);
} catch {
  await copyFile(canonicalPath, sourcePath);
}

function connectedComponents(alpha, width, height, top, bottom) {
  const labels = new Int32Array(width * height);
  const queue = new Int32Array(width * (bottom - top));
  const components = [];
  let nextLabel = 1;

  for (let y = top; y < bottom; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const seed = y * width + x;
      if (alpha[seed] === 0 || labels[seed] !== 0) continue;

      let head = 0;
      let tail = 0;
      let alphaSum = 0;
      let count = 0;
      let minX = width;
      let minY = height;
      let maxX = -1;
      let maxY = -1;
      queue[tail++] = seed;
      labels[seed] = nextLabel;

      while (head < tail) {
        const index = queue[head++];
        const pixelX = index % width;
        const pixelY = Math.floor(index / width);
        count += 1;
        alphaSum += alpha[index];
        minX = Math.min(minX, pixelX);
        minY = Math.min(minY, pixelY);
        maxX = Math.max(maxX, pixelX);
        maxY = Math.max(maxY, pixelY);

        for (let offsetY = -1; offsetY <= 1; offsetY += 1) {
          for (let offsetX = -1; offsetX <= 1; offsetX += 1) {
            if (offsetX === 0 && offsetY === 0) continue;
            const neighborX = pixelX + offsetX;
            const neighborY = pixelY + offsetY;
            if (
              neighborX < 0
              || neighborX >= width
              || neighborY < top
              || neighborY >= bottom
            ) continue;
            const neighbor = neighborY * width + neighborX;
            if (alpha[neighbor] === 0 || labels[neighbor] !== 0) continue;
            labels[neighbor] = nextLabel;
            queue[tail++] = neighbor;
          }
        }
      }

      components.push({
        label: nextLabel,
        alphaSum,
        count,
        bounds: { minX, minY, maxX, maxY }
      });
      nextLabel += 1;
    }
  }

  return { labels, components };
}

function solidifyEnclosedInterior(alpha, width, bounds) {
  const regionWidth = bounds.maxX - bounds.minX + 1;
  const regionHeight = bounds.maxY - bounds.minY + 1;
  const exterior = new Uint8Array(regionWidth * regionHeight);
  const queue = new Int32Array(regionWidth * regionHeight);
  let head = 0;
  let tail = 0;

  const enqueueExterior = (localX, localY) => {
    const localIndex = localY * regionWidth + localX;
    if (exterior[localIndex] !== 0) return;
    const sourceIndex = (bounds.minY + localY) * width + bounds.minX + localX;
    if (alpha[sourceIndex] !== 0) return;
    exterior[localIndex] = 1;
    queue[tail++] = localIndex;
  };

  for (let x = 0; x < regionWidth; x += 1) {
    enqueueExterior(x, 0);
    enqueueExterior(x, regionHeight - 1);
  }
  for (let y = 0; y < regionHeight; y += 1) {
    enqueueExterior(0, y);
    enqueueExterior(regionWidth - 1, y);
  }

  while (head < tail) {
    const localIndex = queue[head++];
    const localX = localIndex % regionWidth;
    const localY = Math.floor(localIndex / regionWidth);
    for (const [offsetX, offsetY] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
      const neighborX = localX + offsetX;
      const neighborY = localY + offsetY;
      if (
        neighborX < 0
        || neighborX >= regionWidth
        || neighborY < 0
        || neighborY >= regionHeight
      ) continue;
      enqueueExterior(neighborX, neighborY);
    }
  }

  const filled = Buffer.alloc(alpha.length);
  for (let localY = 0; localY < regionHeight; localY += 1) {
    for (let localX = 0; localX < regionWidth; localX += 1) {
      const localIndex = localY * regionWidth + localX;
      if (exterior[localIndex] !== 0) continue;
      const sourceIndex = (bounds.minY + localY) * width + bounds.minX + localX;
      if (alpha[sourceIndex] === 0) {
        filled[sourceIndex] = 255;
        continue;
      }

      let interior = true;
      for (let offsetY = -1; offsetY <= 1 && interior; offsetY += 1) {
        for (let offsetX = -1; offsetX <= 1; offsetX += 1) {
          const neighborX = localX + offsetX;
          const neighborY = localY + offsetY;
          if (
            neighborX < 0
            || neighborX >= regionWidth
            || neighborY < 0
            || neighborY >= regionHeight
            || exterior[neighborY * regionWidth + neighborX] !== 0
          ) {
            interior = false;
            break;
          }
        }
      }
      filled[sourceIndex] = interior ? 255 : alpha[sourceIndex];
    }
  }
  return filled;
}

const { data, info } = await sharp(sourcePath).removeAlpha().raw().toBuffer({ resolveWithObject: true });
const pixelCount = info.width * info.height;
const wordmarkMask = Buffer.alloc(pixelCount);
const primaryMask = Buffer.alloc(pixelCount);
const secondaryMask = Buffer.alloc(pixelCount);
const taglineMask = Buffer.alloc(pixelCount);

for (let index = 0; index < pixelCount; index += 1) {
  const y = Math.floor(index / info.width);
  const offset = index * info.channels;
  const pixel = [data[offset], data[offset + 1], data[offset + 2]];
  if (y >= TAGLINE_BAND_Y) {
    const candidate = projection(pixel, TAGLINE_BACKGROUND, TAGLINE);
    if (candidate.amount > 0.005 && candidate.error < 900) {
      taglineMask[index] = Math.round(candidate.amount * 255);
    }
    continue;
  }

  const primary = projection(pixel, BACKGROUND, PRIMARY);
  const secondary = projection(pixel, BACKGROUND, SECONDARY);
  const selected = secondary.error < primary.error ? secondary : primary;
  if (selected.amount <= 0.005 || selected.error >= 900) continue;
  wordmarkMask[index] = Math.round(selected.amount * 255);
}

const { labels: wordmarkLabels, components: wordmarkComponents } = connectedComponents(
  wordmarkMask,
  info.width,
  info.height,
  WORDMARK_TOP,
  WORDMARK_BOTTOM
);
const retainedComponents = wordmarkComponents.filter(
  (component) => component.alphaSum >= WORDMARK_COMPONENT_MIN_ALPHA
);
const retainedLabels = new Set(retainedComponents.map((component) => component.label));
const finalALabel = wordmarkLabels[FINAL_A_SEED.y * info.width + FINAL_A_SEED.x];
const finalAComponent = retainedComponents.find((component) => component.label === finalALabel);
const suffixLabels = new Set(
  retainedComponents
    .filter((component) => component.bounds.minX >= SUFFIX_LEFT)
    .map((component) => component.label)
);

if (!finalAComponent) {
  throw new Error('Could not resolve the final A component from the canonical logo source.');
}
if (retainedComponents.length !== 12 || suffixLabels.size !== 6) {
  throw new Error(
    `Unexpected ATEHNA wordmark topology (${retainedComponents.length} retained components, ${suffixLabels.size} suffix components).`
  );
}

const finalAFaceSource = Buffer.alloc(pixelCount);
for (let y = finalAComponent.bounds.minY; y <= finalAComponent.bounds.maxY; y += 1) {
  for (let x = FINAL_A_CLEANUP_LEFT_X; x <= finalAComponent.bounds.maxX; x += 1) {
    const index = y * info.width + x;
    if (wordmarkLabels[index] === finalALabel) finalAFaceSource[index] = wordmarkMask[index];
  }
}
const finalAFaceMask = solidifyEnclosedInterior(finalAFaceSource, info.width, {
  minX: FINAL_A_CLEANUP_LEFT_X,
  minY: finalAComponent.bounds.minY,
  maxX: finalAComponent.bounds.maxX,
  maxY: finalAComponent.bounds.maxY
});

for (let y = WORDMARK_TOP; y < WORDMARK_BOTTOM; y += 1) {
  for (let x = 0; x < info.width; x += 1) {
    const index = y * info.width + x;
    const label = wordmarkLabels[index];
    if (!retainedLabels.has(label)) continue;
    const usesSecondary = suffixLabels.has(label);
    if (usesSecondary) secondaryMask[index] = wordmarkMask[index];
    else primaryMask[index] = wordmarkMask[index];
  }
}

for (let y = finalAComponent.bounds.minY; y <= finalAComponent.bounds.maxY; y += 1) {
  for (let x = FINAL_A_RIGHT_FACE_X; x <= finalAComponent.bounds.maxX; x += 1) {
    const index = y * info.width + x;
    if (finalAFaceMask[index] === 0) continue;
    primaryMask[index] = finalAFaceMask[index];
    secondaryMask[index] = 0;
  }
}

const combinedMask = Buffer.alloc(pixelCount);
for (let index = 0; index < pixelCount; index += 1) {
  combinedMask[index] = Math.max(primaryMask[index], secondaryMask[index], taglineMask[index]);
}

for (const [name, alpha] of [
  ['atehna-logo-primary-mask.png', primaryMask],
  ['atehna-logo-secondary-mask.png', secondaryMask],
  ['atehna-logo-tagline-mask.png', taglineMask],
  ['atehna-logo-artwork-mask.png', combinedMask]
]) {
  const output = await sharp(rgbaMask(alpha), {
    raw: { width: info.width, height: info.height, channels: 4 }
  }).png({ compressionLevel: 9 }).toBuffer();
  await writeFile(path.join(publicBrand, name), output);
}

const revisedMaster = Buffer.from(data);
for (let index = 0; index < pixelCount; index += 1) {
  const alpha = finalAFaceMask[index] / 255;
  if (alpha === 0) continue;
  const offset = index * info.channels;
  for (let channel = 0; channel < 3; channel += 1) {
    revisedMaster[offset + channel] = Math.round(
      BACKGROUND[channel] + (PRIMARY[channel] - BACKGROUND[channel]) * alpha
    );
  }
}
const revisedMasterPng = await sharp(revisedMaster, {
  raw: { width: info.width, height: info.height, channels: info.channels }
}).ensureAlpha().png({ compressionLevel: 9 }).toBuffer();
await writeFile(canonicalPath, revisedMasterPng);

console.log(`Generated ATEHNA artwork masks at ${info.width}×${info.height}.`);
