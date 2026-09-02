import assert from 'node:assert/strict';
import test from 'node:test';
import {
  SITE_LOGO_BUILTIN_ORIGINAL_MASTER,
  SITE_LOGO_CROP_MIN_SIZE_RATIO,
  cloneDefaultSiteLogoConfig,
  deriveSiteLogoFitSuggestion,
  normalizeSiteLogoConfig,
  normalizeSiteLogoCropRect,
  resolveSiteLogoCropClipPath,
  resolveSiteLogoFittedArtworkRect,
  resolveSiteLogoFittedCropRect,
  toStoredSiteLogoConfig,
  validateSiteLogoConfigInput
} from '@/shared/domain/logo/siteLogo';

test('crop normalization always returns a positive rectangle inside the unit square', () => {
  const edgeCrop = normalizeSiteLogoCropRect({
    x: 1,
    y: 1,
    width: 0.5,
    height: 0.5
  });

  assert.equal(edgeCrop.x, 1 - SITE_LOGO_CROP_MIN_SIZE_RATIO);
  assert.equal(edgeCrop.y, 1 - SITE_LOGO_CROP_MIN_SIZE_RATIO);
  assert.equal(edgeCrop.width, SITE_LOGO_CROP_MIN_SIZE_RATIO);
  assert.equal(edgeCrop.height, SITE_LOGO_CROP_MIN_SIZE_RATIO);
  assert.ok(edgeCrop.x + edgeCrop.width <= 1);
  assert.ok(edgeCrop.y + edgeCrop.height <= 1);

  const normalized = normalizeSiteLogoConfig({
    placements: {
      standalone: {
        override: {
          crop: { x: 0.99999, y: 2, width: 1, height: 1 }
        }
      }
    }
  });
  const persistedCrop = normalized.placements.standalone.override?.crop;
  assert.ok(persistedCrop);
  assert.ok(persistedCrop.x + persistedCrop.width <= 1);
  assert.ok(persistedCrop.y + persistedCrop.height <= 1);
});

test('fitted crop projection clips excluded source pixels without changing fit geometry', () => {
  const crop = { x: 0.25, y: 0, width: 0.5, height: 1 };
  const geometry = { scale: 1, translateX: 0, translateY: 0, crop, safeAreaInset: 0 };
  const contained = resolveSiteLogoFittedArtworkRect({
    sourceWidth: 200,
    sourceHeight: 100,
    viewportWidth: 200,
    viewportHeight: 100,
    geometry,
    fitMode: 'contain'
  });

  assert.deepEqual(contained, { left: 0, top: 0, width: 200, height: 100, scale: 1 });
  assert.deepEqual(resolveSiteLogoFittedCropRect(contained, crop), {
    left: 50,
    top: 0,
    width: 100,
    height: 100
  });
  assert.equal(resolveSiteLogoCropClipPath(crop), 'inset(0% 25% 0% 25%)');

  const filled = resolveSiteLogoFittedArtworkRect({
    sourceWidth: 200,
    sourceHeight: 100,
    viewportWidth: 200,
    viewportHeight: 100,
    geometry,
    fitMode: 'fill'
  });
  assert.deepEqual(resolveSiteLogoFittedCropRect(filled, crop), {
    left: 0,
    top: -50,
    width: 200,
    height: 200
  });
});

test('strict validation rejects every malformed present geometry field', () => {
  const input = toStoredSiteLogoConfig(cloneDefaultSiteLogoConfig()) as unknown as {
    placements: Record<string, Record<string, unknown>>;
  };
  input.placements.standalone.suggestion = {
    scale: '2',
    translateX: -3,
    translateY: Number.NaN,
    crop: { x: 0.9, y: 0, width: 0.2, height: 1 },
    safeAreaInset: 0.5,
    algorithmVersion: ''
  };
  input.placements.standalone.override = {
    scale: 0,
    translateX: 3,
    translateY: '0',
    crop: { x: 0, y: 0, width: 1 },
    safeAreaInset: -0.1
  };

  const errors = validateSiteLogoConfigInput(input);
  for (const fragment of [
    'scale predloga prileganja',
    'translateX predloga prileganja',
    'translateY predloga prileganja',
    'Izrez predloga prileganja',
    'safeAreaInset predloga prileganja',
    'Različica algoritma predloga prileganja',
    'scale ročne prilagoditve',
    'translateX ročne prilagoditve',
    'translateY ročne prilagoditve',
    'Izrez ročne prilagoditve',
    'safeAreaInset ročne prilagoditve'
  ]) {
    assert.ok(errors.some((error) => error.includes(fragment)), `Missing validation error: ${fragment}\n${errors.join('\n')}`);
  }
});

test('strict geometry validation preserves legacy omission compatibility', () => {
  const input = toStoredSiteLogoConfig(cloneDefaultSiteLogoConfig()) as unknown as {
    placements: Record<string, {
      suggestion?: Record<string, unknown>;
      override?: Record<string, unknown> | null;
    }>;
  };
  const placement = input.placements.standalone;
  assert.ok(placement);
  placement.suggestion = {};
  placement.override = {};
  delete input.placements['header-desktop'].suggestion;
  delete input.placements['header-desktop'].override;

  assert.deepEqual(validateSiteLogoConfigInput(input), []);
});

test('fresh master fit suggestions use optical bounds except for the built-in PDF crop', () => {
  const uploadedMaster = {
    id: 'uploaded-lockup',
    opticalBounds: { x: 0.12, y: 0.18, width: 0.7, height: 0.6 }
  };
  const headerSuggestion = deriveSiteLogoFitSuggestion('header-desktop', uploadedMaster);
  assert.deepEqual(headerSuggestion.crop, uploadedMaster.opticalBounds);
  assert.equal(headerSuggestion.algorithmVersion, 'optical-fit-v1');
  assert.equal(headerSuggestion.safeAreaInset, 0);

  const uploadedPdfSuggestion = deriveSiteLogoFitSuggestion('pdf-document', uploadedMaster);
  assert.deepEqual(uploadedPdfSuggestion.crop, uploadedMaster.opticalBounds);
  assert.equal(uploadedPdfSuggestion.algorithmVersion, 'optical-fit-v1');

  const builtInPdfSuggestion = deriveSiteLogoFitSuggestion(
    'pdf-document',
    SITE_LOGO_BUILTIN_ORIGINAL_MASTER
  );
  assert.deepEqual(builtInPdfSuggestion.crop, {
    x: 0,
    y: 70 / 840,
    width: 1,
    height: 594 / 840
  });
  assert.equal(builtInPdfSuggestion.algorithmVersion, 'atehna-document-crop-v1');

  const boundarySuggestion = deriveSiteLogoFitSuggestion('standalone', {
    id: 'boundary-master',
    opticalBounds: { x: 1, y: 1, width: 1, height: 1 }
  });
  assert.ok(boundarySuggestion.crop.x + boundarySuggestion.crop.width <= 1);
  assert.ok(boundarySuggestion.crop.y + boundarySuggestion.crop.height <= 1);
});
