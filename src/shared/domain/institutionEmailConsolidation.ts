import { INSTITUTION_DIRECTORIES, resolveInstitutionDirectoryId } from './institutionDirectory';
import { SCHOOL_DIRECTORY_MAX_CELL_LENGTH } from './schoolDirectory';

export type ConsolidationRow = { id: string; position?: number; cells: Record<string, string> };
export type ConsolidationDirectory = {
  id: string; label: string;
  columns: Array<{ id: string; label: string; position?: number }>;
  rows: ConsolidationRow[];
};
export type ConsolidationSource = { directoryId: string; rowId: string };
export type ConsolidationMapping = {
  sourceDirectoryId: string; sourceRowId: string; targetDirectoryId: string; canonicalRowId: string;
};
export type ConsolidationAudit = {
  targetDirectoryId: string; canonicalRowId: string; emails: string[];
  sources: Array<ConsolidationSource & { row: ConsolidationRow }>;
  conflicts: Array<{ columnId: string; keptValue: string; alternatives: Array<{ value: string; sources: ConsolidationSource[] }> }>;
};
export const INSTITUTION_EMAIL_CATEGORY_PRIORITY = [
  'osnovne-sole', 'osnovne-sole-posebne-potrebe', 'srednje-sole', 'visje-strokovne-sole',
  'izobrazevanje-odraslih', 'zavodi-posebne-potrebe', 'glasbene-sole', 'vrtci', 'dijaski-domovi'
] as const;
export type ConsolidationOptions = { categoryPriority?: readonly string[] };
const emailColumn = (id: string) => /^(e-naslov|e-posta|email|e-mail)$/i.test(id);
const contactColumn = (id: string) => /^(telefon|phone|kontaktne-osebe|kontaktna-oseba|contact-person)$/i.test(id);
const distinct = (values: string[]) => [...new Set(values)];
const semanticId = (id: string) => {
  const resolved = resolveInstitutionDirectoryId(id);
  if (!resolved) throw new Error(`Unknown institution directory: ${id}`);
  return resolved;
};

/** Compare actual mailboxes only: never collapse dot/plus aliases or whole domains. */
export function extractInstitutionEmails(value: string): string[] {
  return distinct(value.split(/[\s;,<>]+/).flatMap(token => {
    const address = token.replace(/^mailto:/i, '').split('?')[0].replace(/^["'(]+|["').]+$/g, '').toLowerCase();
    const parts = address.split('@');
    if (parts.length !== 2 || address.length > 254) return [];
    const [local, domain] = parts;
    if (!local || local.length > 64 || local.startsWith('.') || local.endsWith('.') || local.includes('..')) return [];
    if (!/^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+$/.test(local)) return [];
    const labels = domain.split('.');
    // Registry values are identity evidence even when the last label is not a public TLD.
    // Validate mailbox syntax, not DNS or deliverability; never invent a corrected address.
    if (labels.length < 2 || /^\d+$/.test(labels.at(-1)!)) return [];
    if (labels.some(label => !/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(label))) return [];
    return [address];
  }));
}

/** Pure, repeatable consolidation. Full source snapshots retain all discarded scalar values. */
export function consolidateInstitutionDirectories(input: ConsolidationDirectory[], options: ConsolidationOptions = {}) {
  const priority = distinct(['osnovne-sole', ...(options.categoryPriority ?? INSTITUTION_EMAIL_CATEGORY_PRIORITY), ...INSTITUTION_EMAIL_CATEGORY_PRIORITY]);
  priority.forEach(semanticId);
  const rowIds = new Set<string>();
  const directoryIds = new Set<string>();
  const entries: Array<{ directory: ConsolidationDirectory; category: string; row: ConsolidationRow; index: number; emails: string[] }> = [];
  for (const directory of input) {
    if (directoryIds.has(directory.id)) throw new Error(`Duplicate directory ID: ${directory.id}`);
    directoryIds.add(directory.id);
    const category = semanticId(directory.id);
    for (const row of [...directory.rows].sort((a, b) => (a.position ?? directory.rows.indexOf(a)) - (b.position ?? directory.rows.indexOf(b)))) {
      if (!row.id || rowIds.has(row.id)) throw new Error(`Duplicate or empty row ID: ${row.id}`);
      rowIds.add(row.id);
      for (const cell of Object.values(row.cells)) {
        if (typeof cell !== 'string' || cell.length > SCHOOL_DIRECTORY_MAX_CELL_LENGTH) throw new Error(`Invalid or oversized cell in ${row.id}`);
      }
      entries.push({ directory, category, row, index: entries.length, emails: distinct(Object.entries(row.cells).filter(([key]) => emailColumn(key)).flatMap(([, value]) => extractInstitutionEmails(value))) });
    }
  }
  const parents = entries.map((_, index) => index);
  const find = (index: number): number => {
    if (parents[index] !== index) parents[index] = find(parents[index]);
    return parents[index];
  };
  const firstByEmail = new Map<string, number>();
  entries.forEach((entry, index) => entry.emails.forEach(email => {
    const first = firstByEmail.get(email);
    if (first === undefined) firstByEmail.set(email, index);
    else parents[find(index)] = find(first);
  }));
  const groups = new Map<number, typeof entries>();
  entries.forEach(entry => {
    const key = find(entry.index);
    groups.set(key, [...(groups.get(key) ?? []), entry]);
  });
  const mappings: ConsolidationMapping[] = [];
  const audit: ConsolidationAudit[] = [];
  const resolved: Array<{ target: string; canonical: typeof entries[number]; row: ConsolidationRow; sources: typeof entries }> = [];
  for (const group of groups.values()) {
    const categories = distinct(group.map(entry => entry.category));
    const target = [...categories].sort((a, b) => priority.indexOf(a) - priority.indexOf(b))[0];
    const ranked = [...group].sort((a, b) => {
      const preference = (entry: typeof a) => entry.category === 'osnovne-sole' ? 0 : entry.category === target ? 1 : 2;
      const richness = (entry: typeof a) => Object.values(entry.row.cells).filter(value => value.trim()).length;
      return preference(a) - preference(b) || richness(b) - richness(a) || a.index - b.index;
    });
    const canonical = ranked[0];
    const cells = { ...canonical.row.cells };
    const keys = distinct(ranked.flatMap(entry => Object.keys(entry.row.cells)));
    const emails = distinct(ranked.flatMap(entry => entry.emails));
    for (const key of group.length > 1 ? keys : []) {
      const values = distinct(ranked.map(entry => entry.row.cells[key] ?? '').filter(value => value.trim()));
      if (emailColumn(key) && emails.length) cells[key] = emails.join('; ');
      else if (contactColumn(key) && values.length) cells[key] = distinct(values.flatMap(value => value.split(/[;,\n]+/).map(part => part.trim()).filter(Boolean))).join('; ');
      else if (!cells[key]?.trim()) cells[key] = values[0] ?? '';
      if (cells[key].length > SCHOOL_DIRECTORY_MAX_CELL_LENGTH) throw new Error(`Merged cell exceeds ${SCHOOL_DIRECTORY_MAX_CELL_LENGTH} characters: ${canonical.row.id}/${key}`);
    }
    const row = { id: canonical.row.id, cells };
    const source = (entry: typeof canonical) => ({ directoryId: entry.directory.id, rowId: entry.row.id });
    if (group.length > 1 || canonical.directory.id !== target) {
      const conflicts = keys.flatMap(columnId => {
        const values = distinct(ranked.map(entry => entry.row.cells[columnId] ?? '').filter(value => value.trim()));
        return values.length < 2 ? [] : [{ columnId, keptValue: cells[columnId], alternatives: values.filter(value => value !== cells[columnId]).map(value => ({ value, sources: ranked.filter(entry => entry.row.cells[columnId] === value).map(source) })) }];
      });
      audit.push({ targetDirectoryId: target, canonicalRowId: row.id, emails, sources: group.map(entry => ({ ...source(entry), row: { ...entry.row, cells: { ...entry.row.cells } } })), conflicts });
    }
    group.forEach(entry => mappings.push({ sourceDirectoryId: entry.directory.id, sourceRowId: entry.row.id, targetDirectoryId: target, canonicalRowId: row.id }));
    resolved.push({ target, canonical, row, sources: group });
  }
  const fallbackColumns = input[0]?.columns ?? [];
  const directories = INSTITUTION_DIRECTORIES.map(definition => {
    const groupsHere = resolved.filter(group => group.target === definition.id).sort((a, b) => Number(a.canonical.category !== definition.id) - Number(b.canonical.category !== definition.id) || a.canonical.index - b.canonical.index);
    const nativeDirectories = input.filter(directory => semanticId(directory.id) === definition.id);
    const columns = new Map<string, ConsolidationDirectory['columns'][number]>();
    const sourceColumns = [...nativeDirectories, ...groupsHere.flatMap(group => group.sources.map(source => source.directory))].flatMap(directory => directory.columns);
    for (const column of sourceColumns.length ? sourceColumns : fallbackColumns) if (!columns.has(column.id)) columns.set(column.id, { ...column, position: columns.size });
    const rows = groupsHere.map(({ row }, position) => ({ ...row, position, cells: Object.fromEntries([...columns.keys()].map(key => [key, row.cells[key] ?? ''])) }));
    // Columns missing from imported metadata must not silently discard source cells.
    for (const group of groupsHere) for (const key of Object.keys(group.row.cells)) {
      if (!columns.has(key)) throw new Error(`Missing column metadata: ${definition.id}/${key}`);
    }
    return { ...definition, columns: [...columns.values()], rows };
  });
  const summary = {
    inputRows: entries.length, outputRows: resolved.length,
    mergedGroups: [...groups.values()].filter(group => group.length > 1).length,
    removedRows: entries.length - resolved.length,
    movedRows: mappings.filter(mapping => semanticId(mapping.sourceDirectoryId) !== mapping.targetDirectoryId).length,
    rowsWithoutValidEmail: entries.filter(entry => !entry.emails.length).length,
    directoryCounts: directories.map(directory => ({ id: directory.id, rows: directory.rows.length }))
  };
  return { directories, mappings, audit, summary };
}
