import { expect } from '@playwright/test';
import { test } from 'node:test';
import {
  deriveCategoryShowcaseBackgroundHoverColor,
  normalizeCategoryShowcaseMediaSettings
} from '@/shared/features/category-showcase/categoryShowcaseSchema';

test('legacy category colours receive compatible hover defaults', () => {
  const legacy = normalizeCategoryShowcaseMediaSettings({
    backgroundColor: '#102030',
    ordinalColor: '#405060',
    titleColor: '#708090'
  });

  expect(legacy.titleHoverColor).toBe('#708090');
  expect(legacy.ordinalHoverColor).toBe('#405060');
  expect(legacy.backgroundHoverColor).toBe(deriveCategoryShowcaseBackgroundHoverColor('#102030'));

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
