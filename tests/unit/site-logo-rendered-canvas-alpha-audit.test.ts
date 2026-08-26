import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import test from 'node:test';

test('rendered logo canvas preserves exact signed edges, independent channels, effects, and legacy bytes', () => {
  const script = String.raw`
    const {
      DEFAULT_SITE_LOGO_PRESENTATION,
      SITE_LOGO_COLOR_CHANNEL_IDS,
      resolveSiteLogoCanvasLayout
    } = await import('./src/shared/domain/logo/siteLogo.ts');
    const { renderBuiltInAtehnaLogoArtwork } = await import('./src/shared/server/siteLogoArtwork.ts');
    const { readFile } = await import('node:fs/promises');
    const sharp = (await import('sharp')).default;

    const readRaw = async (input) => sharp(input).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const clone = (value) => structuredClone(value);
    const colors = {
      background: [1, 2, 3],
      taglineBackground: [4, 5, 6],
      primary: [17, 34, 51],
      secondary: [68, 85, 102],
      tagline: [119, 136, 153]
    };
    const base = clone(DEFAULT_SITE_LOGO_PRESENTATION);
    Object.assign(base, {
      backgroundColor: '#010203',
      taglineBackgroundColor: '#040506',
      primaryTextColor: '#112233',
      secondaryTextColor: '#445566',
      taglineTextColor: '#778899',
      canvasEdges: {},
      transparentColors: {},
      outline: { enabled: false, color: '#FF00FF', widthPx: 0 },
      shadow: { enabled: false, color: '#00FFFF', opacity: 0, blurPx: 0, offsetXpx: 0, offsetYpx: 0 }
    });

    const countExactColors = ({ data, info }) => {
      const counts = Object.fromEntries(SITE_LOGO_COLOR_CHANNEL_IDS.map((channel) => [channel, 0]));
      let transparentPixels = 0;
      for (let offset = 0; offset < data.length; offset += info.channels) {
        if (data[offset + 3] === 0) transparentPixels += 1;
        for (const channel of SITE_LOGO_COLOR_CHANNEL_IDS) {
          const target = colors[channel];
          if (data[offset] === target[0] && data[offset + 1] === target[1] && data[offset + 2] === target[2]) {
            counts[channel] += 1;
          }
        }
      }
      return { counts, transparentPixels, width: info.width, height: info.height };
    };

    const channelResults = {};
    for (const channel of SITE_LOGO_COLOR_CHANNEL_IDS) {
      const presentation = clone(base);
      presentation.transparentColors = { [channel]: true };
      channelResults[channel] = countExactColors(await readRaw(
        await renderBuiltInAtehnaLogoArtwork(presentation)
      ));
    }

    const signedEdges = { left: 0.1, right: 0.2, top: -0.1, bottom: 0.3 };
    const mappedPresentation = clone(base);
    mappedPresentation.canvasEdges = signedEdges;
    mappedPresentation.transparentColors = { background: true, taglineBackground: true };
    const mapped = await readRaw(await renderBuiltInAtehnaLogoArtwork(mappedPresentation));
    const artworkMask = await readRaw('./public/brand/atehna-logo-artwork-mask.png');
    const layout = resolveSiteLogoCanvasLayout(artworkMask.info.width, artworkMask.info.height, signedEdges);
    let alphaMismatches = 0;
    for (let y = 0; y < mapped.info.height; y += 1) {
      for (let x = 0; x < mapped.info.width; x += 1) {
        const sourceX = x - layout.sourceLeft;
        const sourceY = y - layout.sourceTop;
        const expected = sourceX >= 0 && sourceX < artworkMask.info.width
          && sourceY >= 0 && sourceY < artworkMask.info.height
          ? artworkMask.data[(sourceY * artworkMask.info.width + sourceX) * artworkMask.info.channels + 3]
          : 0;
        const actual = mapped.data[(y * mapped.info.width + x) * mapped.info.channels + 3];
        if (actual !== expected) alphaMismatches += 1;
      }
    }

    const effectPresentation = clone(base);
    effectPresentation.transparentColors = { background: true, taglineBackground: true };
    effectPresentation.outline = { enabled: true, color: '#FF00FF', widthPx: 5 };
    effectPresentation.shadow = {
      enabled: true,
      color: '#00FFFF',
      opacity: 0.8,
      blurPx: 2,
      offsetXpx: 7,
      offsetYpx: 5
    };
    const fullEffect = await readRaw(await renderBuiltInAtehnaLogoArtwork(effectPresentation));
    const croppedEffectPresentation = clone(effectPresentation);
    croppedEffectPresentation.canvasEdges = { left: -0.1 };
    const croppedEffect = await readRaw(await renderBuiltInAtehnaLogoArtwork(croppedEffectPresentation));
    const cropLeft = Math.round(fullEffect.info.width * 0.1);
    const expectedCrop = await sharp(fullEffect.data, {
      raw: {
        width: fullEffect.info.width,
        height: fullEffect.info.height,
        channels: fullEffect.info.channels
      }
    }).extract({
      left: cropLeft,
      top: 0,
      width: croppedEffect.info.width,
      height: croppedEffect.info.height
    }).raw().toBuffer();

    const originalBytes = await readFile('./public/brand/atehna-document-wordmark.png');
    const defaultBytes = await renderBuiltInAtehnaLogoArtwork();
    process.stdout.write(JSON.stringify({
      channelResults,
      mapped: {
        width: mapped.info.width,
        height: mapped.info.height,
        layout,
        alphaMismatches
      },
      effectsCropMatches: Buffer.from(croppedEffect.data).equals(expectedCrop),
      defaultMatchesOriginal: Buffer.from(defaultBytes).equals(originalBytes)
    }));
  `;

  const result = JSON.parse(execFileSync(process.execPath, [
    '--conditions=react-server',
    '--import',
    'tsx',
    '--input-type=module',
    '--eval',
    script
  ], {
    cwd: process.cwd(),
    encoding: 'utf8'
  })) as {
    channelResults: Record<string, {
      counts: Record<string, number>;
      transparentPixels: number;
      width: number;
      height: number;
    }>;
    mapped: {
      width: number;
      height: number;
      layout: {
        width: number;
        height: number;
        sourceLeft: number;
        sourceTop: number;
      };
      alphaMismatches: number;
    };
    effectsCropMatches: boolean;
    defaultMatchesOriginal: boolean;
  };

  for (const [transparentChannel, channelResult] of Object.entries(result.channelResults)) {
    assert.equal(channelResult.width, 1873);
    assert.equal(channelResult.height, 840);
    assert.equal(channelResult.counts[transparentChannel], 0, transparentChannel);
    for (const [channel, count] of Object.entries(channelResult.counts)) {
      if (channel !== transparentChannel) assert.ok(count > 0, `${transparentChannel} removed ${channel}`);
    }
    assert.equal(
      channelResult.transparentPixels > 0,
      transparentChannel === 'background' || transparentChannel === 'taglineBackground'
    );
  }
  assert.deepEqual(result.mapped.layout, {
    width: 2435,
    height: 1008,
    sourceLeft: 187,
    sourceTop: -84,
    sourceWidth: 1873,
    sourceHeight: 840,
    edges: { top: -0.1, right: 0.2, bottom: 0.3, left: 0.1 }
  });
  assert.equal(result.mapped.width, 2435);
  assert.equal(result.mapped.height, 1008);
  assert.equal(result.mapped.alphaMismatches, 0);
  assert.equal(result.effectsCropMatches, true);
  assert.equal(result.defaultMatchesOriginal, true);
});
