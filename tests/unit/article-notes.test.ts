import assert from 'node:assert/strict';
import test from 'node:test';
import {
  DEFAULT_ARTICLE_NOTE_TAGS, createArticleNoteTagId, getArticleNoteDefinition, getArticleNoteOptions,
  getArticleNoteStyle, mergeExistingArticleNoteTags, normalizeArticleNoteTags, normalizeNoteTagValue, validateArticleNoteTags
} from '@/shared/domain/catalog/articleNotes';
import { normalizeProductAppearanceConfig, toStoredProductAppearanceConfig, validateProductAppearanceConfigInput } from '@/shared/domain/style/productAppearance';

test('legacy no-note IDs render neutrally while arbitrary note values remain intact', () => {
  assert.equal(normalizeNoteTagValue(' NA-ZALOGI '), 'na-zalogi');
  assert.equal(normalizeNoteTagValue('opomba'), 'na-zalogi');
  assert.equal(normalizeNoteTagValue(' Posebna Serija '), 'Posebna Serija');
  assert.equal(getArticleNoteDefinition('na-zalogi').label, 'Brez opomb');
  assert.equal(getArticleNoteDefinition('').label, 'Brez opomb');
  assert.equal(getArticleNoteDefinition('na-zalogi').color, '#64748b');
  assert.equal(getArticleNoteDefinition('Posebna Serija').label, 'Posebna Serija');
});

test('custom names, colors and disabled choices persist through stored appearance configuration', () => {
  const tags = normalizeArticleNoteTags([
    { id: 'na-zalogi', label: 'Brez opomb', color: '#475569' },
    { id: 'Posebna Serija', label: 'Omejena serija', color: '#CA8A04', enabled: false }
  ]);
  const config = normalizeProductAppearanceConfig({ articleNotes: { tags } });
  const roundTrip = normalizeProductAppearanceConfig(JSON.parse(JSON.stringify(toStoredProductAppearanceConfig(config))));
  assert.deepEqual(roundTrip.articleNotes.tags, tags);
  assert.deepEqual(getArticleNoteDefinition('Posebna Serija', tags), { id: 'Posebna Serija', label: 'Omejena serija', color: '#ca8a04', enabled: false });
  assert.equal(getArticleNoteOptions(tags).some((option) => option.value === 'Posebna Serija'), false);
  assert.equal(getArticleNoteOptions(tags, 'Posebna Serija').at(-1)?.label, 'Omejena serija');
  assert.equal(getArticleNoteOptions(tags, 'unknown').at(-1)?.value, 'unknown');
  assert.deepEqual(validateProductAppearanceConfigInput(config), []);
});

test('note validation rejects duplicate IDs, blank labels and malformed colors before persistence', () => {
  const invalid = [{ id: 'novo', label: '', color: 'url(https://invalid)' }, { id: 'NOVO', label: 'New', color: '#ff0000' }];
  assert.equal(validateArticleNoteTags(invalid).length, 3);
  const config = normalizeProductAppearanceConfig({});
  assert.equal(validateProductAppearanceConfigInput({ ...config, articleNotes: { tags: invalid } }).length, 3);
  assert.deepEqual(normalizeArticleNoteTags(undefined), DEFAULT_ARTICLE_NOTE_TAGS);
  assert.deepEqual(validateProductAppearanceConfigInput({ ...config, articleNotes: { tags: null } }), ['Opombe morajo vsebovati največ 100 oznak.']);
});

test('saved badge colors define readable tints and new note IDs avoid collisions', () => {
  const tags = normalizeArticleNoteTags([{ id: 'custom', label: 'Posebno', color: '#ff0000' }]);
  assert.deepEqual(getArticleNoteStyle('custom', tags), { color: 'rgb(166, 0, 0)', backgroundColor: '#ff000012', borderColor: '#ff000040' });
  assert.equal(createArticleNoteTagId('Šolski komplet', []), 'solski-komplet');
  assert.equal(createArticleNoteTagId('Novo', DEFAULT_ARTICLE_NOTE_TAGS), 'novo-2');
});

test('admin discovery exposes existing custom values without changing their IDs or saved definitions', () => {
  const tags = normalizeArticleNoteTags([{ id: 'custom', label: 'Saved label', color: '#123456', enabled: false }]);
  const merged = mergeExistingArticleNoteTags(tags, ['custom', 'Posebna Serija', '  Posebna Serija ', 'opomba', '']);
  assert.equal(merged.length, tags.length + 1);
  assert.equal(getArticleNoteDefinition('custom', merged).label, 'Saved label');
  assert.equal(getArticleNoteDefinition('custom', merged).enabled, false);
  assert.equal(merged.at(-1)?.id, 'Posebna Serija');
  assert.equal(tags.some((tag) => tag.id === 'Posebna Serija'), false);
});
