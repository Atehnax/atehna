import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizeInstitutionName } from '../../src/shared/domain/institutionName';

test('abbreviates the complete phrase case-insensitively while preserving the remaining proper name', () => {
  assert.equal(normalizeInstitutionName('Osnovna šola dr. Ljudevita Pivka Ptuj'), 'OŠ dr. Ljudevita Pivka Ptuj');
  assert.equal(normalizeInstitutionName('OSNOVNA ŠOLA ROJE'), 'OŠ ROJE');
  assert.equal(normalizeInstitutionName('Zasebna osnovna šola in vrtec'), 'Zasebna OŠ in vrtec');
  assert.equal(normalizeInstitutionName('Osnovna\u00a0šola – Center'), 'OŠ – Center');
});

test('leaves abbreviations, inflected phrases, unrelated words, and layout text untouched', () => {
  for (const name of ['OŠ Roje', 'Osnovne šole', 'Osnovna šolarica', 'Predosnovna šola', 'Osnovna šolačka', 'osnovnašola', 'Osnovna\nšola', 'Zavod Janeza Levca', '']) {
    assert.equal(normalizeInstitutionName(name), name);
  }
});

test('repeated name normalization is idempotent and replaces every complete occurrence', () => {
  const name = 'Osnovna šola A / OSNOVNA ŠOLA B';
  assert.equal(normalizeInstitutionName(name), 'OŠ A / OŠ B');
  assert.equal(normalizeInstitutionName(normalizeInstitutionName(name)), normalizeInstitutionName(name));
});
