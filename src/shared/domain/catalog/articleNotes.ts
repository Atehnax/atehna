export type ArticleNoteTagDefinition = {
  id: string;
  label: string;
  color: string;
  enabled: boolean;
};

export const DEFAULT_ARTICLE_NOTE_TAGS: readonly ArticleNoteTagDefinition[] = [
  { id: 'na-zalogi', label: 'Brez opomb', color: '#64748b', enabled: true },
  { id: 'novo', label: 'Novo', color: '#0284c7', enabled: true },
  { id: 'akcija', label: 'V akciji', color: '#be123c', enabled: true },
  { id: 'zadnji-kosi', label: 'Zadnji kosi', color: '#7c3aed', enabled: true },
  { id: 'ni-na-zalogi', label: 'Ni na zalogi', color: '#64748b', enabled: true }
];

const isRecord = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
const isColor = (value: unknown): value is string => typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value);

/** Preserve unknown legacy note values; stock is deliberately unrelated to notes. */
export function normalizeNoteTagValue(value: string | null | undefined): string {
  const normalized = (value ?? '').trim();
  if (normalized.toLowerCase() === 'opomba') return 'na-zalogi';
  const legacy = DEFAULT_ARTICLE_NOTE_TAGS.find((tag) => tag.id === normalized.toLowerCase());
  return legacy?.id ?? normalized;
}

export function normalizeArticleNoteTags(value: unknown): ArticleNoteTagDefinition[] {
  if (!Array.isArray(value)) return DEFAULT_ARTICLE_NOTE_TAGS.map((tag) => ({ ...tag }));
  const tags: ArticleNoteTagDefinition[] = [];
  const seen = new Set<string>();
  for (const entry of value) {
    if (!isRecord(entry) || typeof entry.id !== 'string') continue;
    const id = normalizeNoteTagValue(entry.id);
    if (!id || seen.has(id)) continue;
    seen.add(id);
    const fallback = DEFAULT_ARTICLE_NOTE_TAGS.find((tag) => tag.id === id);
    tags.push({
      id,
      label: typeof entry.label === 'string' ? entry.label : fallback?.label ?? id,
      color: isColor(entry.color) ? entry.color.toLowerCase() : fallback?.color ?? '#64748b',
      enabled: id === 'na-zalogi' || entry.enabled !== false
    });
  }
  // Legacy IDs retain their meaning even when older configuration did not include them.
  for (const tag of DEFAULT_ARTICLE_NOTE_TAGS) {
    if (!seen.has(tag.id)) tags.push({ ...tag });
  }
  return tags;
}

export function validateArticleNoteTags(value: unknown): string[] {
  if (!Array.isArray(value) || value.length > 100) return ['Opombe morajo vsebovati največ 100 oznak.'];
  const errors: string[] = [];
  const seen = new Set<string>();
  for (const entry of value) {
    if (!isRecord(entry) || typeof entry.id !== 'string' || !entry.id.trim() || entry.id.length > 100) {
      errors.push('Vsaka opomba mora imeti veljaven identifikator.');
      continue;
    }
    const id = normalizeNoteTagValue(entry.id);
    if (seen.has(id)) errors.push('Identifikatorji opomb se ne smejo ponavljati.');
    seen.add(id);
    if (typeof entry.label !== 'string' || !entry.label.trim() || entry.label.length > 100) errors.push('Naziv opombe mora vsebovati od 1 do 100 znakov.');
    if (!isColor(entry.color)) errors.push('Barva opombe mora biti zapisana v obliki #RRGGBB.');
    if (entry.enabled !== undefined && typeof entry.enabled !== 'boolean') errors.push('Vidnost opombe mora biti veljavna.');
  }
  return [...new Set(errors)];
}

export function getArticleNoteDefinition(value: string, tags: readonly ArticleNoteTagDefinition[] = DEFAULT_ARTICLE_NOTE_TAGS): ArticleNoteTagDefinition {
  const id = normalizeNoteTagValue(value) || 'na-zalogi';
  return tags.find((tag) => tag.id === id)
    ?? DEFAULT_ARTICLE_NOTE_TAGS.find((tag) => tag.id === id)
    ?? { id, label: id, color: '#64748b', enabled: true };
}

export function getArticleNoteOptions(tags: readonly ArticleNoteTagDefinition[], currentValue?: string) {
  const options = tags.filter((tag) => tag.enabled).map((tag) => ({ value: tag.id, label: tag.label }));
  const current = normalizeNoteTagValue(currentValue);
  if (current && !options.some((option) => option.value === current)) {
    const tag = getArticleNoteDefinition(current, tags);
    options.push({ value: current, label: tag.label });
  }
  return options;
}

export function getArticleNoteStyle(value: string, tags: readonly ArticleNoteTagDefinition[] = DEFAULT_ARTICLE_NOTE_TAGS) {
  const { color } = getArticleNoteDefinition(value, tags);
  const channels = [1, 3, 5].map((index) => parseInt(color.slice(index, index + 2), 16));
  // Keep the selected hue, while retaining readable contrast on a pale badge background.
  const text = channels.map((channel) => Math.round(channel * 0.65));
  return {
    color: 'rgb(' + text.join(', ') + ')',
    backgroundColor: color + '12',
    borderColor: color + '40'
  };
}

export function createArticleNoteTagId(label: string, tags: readonly ArticleNoteTagDefinition[]): string {
  const stem = label.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 70) || 'opomba';
  const existing = new Set(tags.map((tag) => tag.id));
  let id = stem;
  let suffix = 2;
  while (existing.has(id)) id = stem + '-' + suffix++;
  return id;
}

/** Discover existing custom note IDs without relabeling or rewriting catalog records. */
export function mergeExistingArticleNoteTags(tags: readonly ArticleNoteTagDefinition[], values: readonly string[]): ArticleNoteTagDefinition[] {
  const result = tags.map((tag) => ({ ...tag }));
  const seen = new Set(result.map((tag) => tag.id));
  for (const value of values) {
    const id = normalizeNoteTagValue(value);
    if (!id || id.length > 100 || seen.has(id) || result.length >= 100) continue;
    seen.add(id);
    result.push({ id, label: id, color: '#64748b', enabled: true });
  }
  return result;
}
