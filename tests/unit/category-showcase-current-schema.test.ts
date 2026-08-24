import { expect } from '@playwright/test';
import { test } from 'node:test';
import {
  DEFAULT_CATEGORY_SHOWCASE_MEDIA_SETTINGS,
  normalizeCategoryShowcaseMediaSettings
} from '@/shared/features/category-showcase/categoryShowcaseSchema';

test('category showcase uses canonical hover defaults when hover colours are omitted', () => {
  const normalized = normalizeCategoryShowcaseMediaSettings({
    backgroundColor: '#102030',
    ordinalColor: '#405060',
    titleColor: '#708090'
  });

  expect(normalized.titleHoverColor).toBe(DEFAULT_CATEGORY_SHOWCASE_MEDIA_SETTINGS.titleHoverColor);
  expect(normalized.ordinalHoverColor).toBe(DEFAULT_CATEGORY_SHOWCASE_MEDIA_SETTINGS.ordinalHoverColor);
  expect(normalized.backgroundHoverColor).toBe(DEFAULT_CATEGORY_SHOWCASE_MEDIA_SETTINGS.backgroundHoverColor);
});

test('category showcase preserves explicit current-schema colours', () => {
  const explicit = normalizeCategoryShowcaseMediaSettings({
    titleColor: '#abcdef',
    titleHoverColor: '#fedcba',
    ordinalColor: '#123abc',
    ordinalHoverColor: '#321cba',
    backgroundColor: '#a1b2c3',
    backgroundHoverColor: '#c3b2a1'
  });

  expect(explicit.titleColor).toBe('#ABCDEF');
  expect(explicit.titleHoverColor).toBe('#FEDCBA');
  expect(explicit.ordinalColor).toBe('#123ABC');
  expect(explicit.ordinalHoverColor).toBe('#321CBA');
  expect(explicit.backgroundColor).toBe('#A1B2C3');
  expect(explicit.backgroundHoverColor).toBe('#C3B2A1');
});
