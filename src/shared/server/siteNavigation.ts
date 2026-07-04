import 'server-only';

import { unstable_noStore as noStore } from 'next/cache';
import type { PoolClient, QueryResult } from 'pg';
import {
  SITE_NAVIGATION_SETTINGS_KEY,
  SITE_NAVIGATION_TOP_BAR_DEVICES,
  cloneDefaultSiteNavigationConfig,
  normalizeSiteNavigationConfig,
  toStoredSiteNavigationConfig,
  type SiteNavigationConfig,
  type SiteNavigationGroup,
  type SiteNavigationLink,
  type SiteNavigationTopLevelItem
} from '@/shared/domain/navigation/siteNavigation';
import { getPool, isDatabaseUnavailableError } from '@/shared/server/db';
import { getAuditActor, getAuditRequestContext } from '@/shared/server/audit';

const tableSql = `
  create table if not exists site_navigation_settings (
    key text primary key,
    config_json jsonb not null default '{}'::jsonb,
    updated_at timestamptz not null default now()
  )
`;

const SITE_NAVIGATION_AUDIT_ENTITY_ID = 'site-navigation';
const SITE_NAVIGATION_AUDIT_SOURCE = 'admin-site-navigation';
const SITE_NAVIGATION_AUDIT_PAGE_SIZE = 200;

type SiteNavigationEntityKind = 'topLevel' | 'group' | 'link' | 'topBar';
type SiteNavigationDisplayAction = 'created' | 'updated' | 'deleted' | 'hidden' | 'shown' | 'reordered';
type SiteNavigationAuditAction = 'created' | 'updated' | 'deleted' | 'reordered';

type SiteNavigationChangeField = {
  field: string;
  before: string;
  after: string;
};

type SiteNavigationFlatEntity = {
  key: string;
  kind: SiteNavigationEntityKind;
  id: string;
  label: string;
  parentLabel: string | null;
  values: Record<string, unknown>;
};

type SiteNavigationAuditRow = {
  action: SiteNavigationAuditAction;
  displayAction: SiteNavigationDisplayAction;
  entityLabel: string;
  entityKind: SiteNavigationEntityKind;
  entityId: string;
  parentLabel: string | null;
  summary: string;
  diff: Record<string, { label: string; before: string | null; after: string | null }>;
};

export type SiteNavigationChangeLogEntry = {
  id: string;
  occurredAt: string;
  action: SiteNavigationDisplayAction;
  actionLabel: string;
  entityTypeLabel: string;
  entityLabel: string;
  parentLabel: string | null;
  summary: string;
  actorName: string | null;
  changes: SiteNavigationChangeField[];
};

const navigationEntityLabels: Record<SiteNavigationEntityKind, string> = {
  topLevel: 'Element navigacije',
  group: 'Skupina',
  link: 'Povezava',
  topBar: 'Zgornja vrstica'
};

const navigationActionLabels: Record<SiteNavigationDisplayAction, string> = {
  created: 'Dodano',
  updated: 'Spremenjeno',
  deleted: 'Odstranjeno',
  hidden: 'Skrito',
  shown: 'Prikazano',
  reordered: 'Prestavljeno'
};

const navigationActionSummaryPrefixes: Record<SiteNavigationDisplayAction, string> = {
  created: 'Dodano',
  updated: 'Spremenjeno',
  deleted: 'Odstranjeno',
  hidden: 'Skrito',
  shown: 'Prikazano',
  reordered: 'Spremenjen vrstni red'
};

const navigationFieldLabels: Record<string, string> = {
  label: 'Naziv',
  href: 'URL',
  description: 'Opis',
  icon: 'Ikona',
  visible: 'Vidnost',
  desktopSpan: 'Širina',
  order: 'Vrstni red',
  mode: 'NaÄin',
  'offset.logo': 'Logotip',
  'offset.navigation': 'Navigacija',
  'offset.search': 'Iskanje',
  'offset.ai': 'Vprašaj AI',
  'offset.cart': 'Košarica'
};

const topBarDeviceAuditLabels = {
  desktop: 'Desktop',
  tablet: 'Tablica',
  mobile: 'Mobilno'
} as const;

const topBarElementAuditLabels = {
  logo: 'Logotip',
  navigation: 'Navigacija',
  search: 'Iskanje',
  ai: 'Vprašaj AI',
  cart: 'Košarica'
} as const;

const topBarRegionAuditLabels = {
  left: 'Levo',
  center: 'Sredina',
  right: 'Desno',
  edgeRight: 'Skrajno desno',
  menu: 'Meni'
} as const;

const topBarSettingAuditLabels: Record<string, string> = {
  breakpointFrom: 'Prelom od',
  breakpointTo: 'Prelom do',
  navigationMode: 'Navigacija',
  maxVisibleLinks: 'Največ povezav',
  searchMode: 'Iskanje',
  aiMode: 'Vprašaj AI',
  cartBadge: 'Značka košarice',
  height: 'Višina',
  paddingX: 'Notranji odmik',
  sticky: 'Lepljiva vrstica',
  shadow: 'Senca',
  menuOpenMode: 'Odpiranje menija',
  actionPriority: 'Prioriteta akcij',
  safeArea: 'Varno območje'
};

function topBarAuditFieldLabel(field: string) {
  const match = /^(initialResponsive|responsive)\.([^.]+)\.(items|settings)\.([^.]+)(?:\.(.+))?$/.exec(field);
  if (!match) return navigationFieldLabels[field] ?? field;

  const [, prefix, device, scope, key, property] = match;
  const deviceLabel = topBarDeviceAuditLabels[device as keyof typeof topBarDeviceAuditLabels] ?? device;
  const prefixLabel = prefix === 'initialResponsive' ? 'Začetno - ' : '';

  if (scope === 'items') {
    const elementLabel = topBarElementAuditLabels[key as keyof typeof topBarElementAuditLabels] ?? key;
    if (property === 'region') return `${prefixLabel}${deviceLabel}: ${elementLabel} - regija`;
    if (property === 'visible') return `${prefixLabel}${deviceLabel}: ${elementLabel} - vidnost`;
    if (property === 'offsetFromCenter') return `${prefixLabel}${deviceLabel}: ${elementLabel} - odmik`;
    if (property === 'position') return `${prefixLabel}${deviceLabel}: ${elementLabel} - vrstni red`;
    return `${prefixLabel}${deviceLabel}: ${elementLabel}`;
  }

  return `${prefixLabel}${deviceLabel}: ${topBarSettingAuditLabels[key] ?? key}`;
}

function toIso(value: unknown) {
  return value instanceof Date ? value.toISOString() : typeof value === 'string' ? new Date(value).toISOString() : null;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function auditEntityKey(kind: SiteNavigationEntityKind, id: string) {
  return `${kind}:${id}`;
}

function visibleLabel(value: unknown) {
  return value === false ? 'Skrito' : 'Vidno';
}

function auditValueLabel(field: string, value: unknown) {
  if (value === null || value === undefined || value === '') return '';
  if (field.includes('.visible') || field.endsWith('.cartBadge') || field.endsWith('.sticky') || field.endsWith('.shadow') || field.endsWith('.safeArea')) {
    return visibleLabel(value);
  }
  if (field.endsWith('.region')) {
    return topBarRegionAuditLabels[value as keyof typeof topBarRegionAuditLabels] ?? String(value);
  }
  if (Array.isArray(value)) {
    return value.map((item) => topBarElementAuditLabels[item as keyof typeof topBarElementAuditLabels] ?? String(item)).join(', ');
  }
  if (
    field.endsWith('.offsetFromCenter') ||
    field.endsWith('.height') ||
    field.endsWith('.paddingX') ||
    field.endsWith('.breakpointFrom') ||
    field.endsWith('.breakpointTo')
  ) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return '0 px';
    return `${numeric} px`;
  }
  if (field === 'visible' || field.startsWith('visible.') || field.startsWith('initialVisible.')) return visibleLabel(value);
  if (field === 'mode') return value === 'manual' ? 'Ročno' : 'Samodejno';
  if (field === 'initialMode') return auditValueLabel('mode', value);
  if (field.startsWith('initialOffset.')) return auditValueLabel('offset.logo', value);
  if (field.startsWith('offset.')) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return '0 px';
    return `${numeric > 0 ? '+' : ''}${numeric} px`;
  }
  if (field === 'desktopSpan') {
    const columnCount = Number(value);
    if (columnCount === 1) return '1 stolpec';
    if (columnCount === 2) return '2 stolpca';
    if (columnCount === 3 || columnCount === 4) return `${columnCount} stolpci`;
    return '1 stolpec';
  }
  return String(value);
}

function flatTopBarLayout(config: SiteNavigationConfig): SiteNavigationFlatEntity {
  const values: Record<string, unknown> = {
    mode: config.topBarLayout.mode,
    initialMode: config.topBarInitialLayout.mode
  };

  config.topBarLayout.items.forEach((item) => {
    values[`offset.${item.id}`] = item.offset;
    values[`visible.${item.id}`] = item.visible;
  });

  config.topBarInitialLayout.items.forEach((item) => {
    values[`initialOffset.${item.id}`] = item.offset;
    values[`initialVisible.${item.id}`] = item.visible;
  });

  SITE_NAVIGATION_TOP_BAR_DEVICES.forEach((device) => {
    const layout = config.topBarLayout.responsive[device];
    const initialLayout = config.topBarInitialLayout.responsive[device];

    layout.items.forEach((item) => {
      values[`responsive.${device}.items.${item.id}.position`] = item.position + 1;
      values[`responsive.${device}.items.${item.id}.region`] = item.region;
      values[`responsive.${device}.items.${item.id}.visible`] = item.visible;
      values[`responsive.${device}.items.${item.id}.offsetFromCenter`] = item.offsetFromCenter;
    });

    Object.entries(layout.settings).forEach(([key, value]) => {
      values[`responsive.${device}.settings.${key}`] = value;
    });

    initialLayout.items.forEach((item) => {
      values[`initialResponsive.${device}.items.${item.id}.position`] = item.position + 1;
      values[`initialResponsive.${device}.items.${item.id}.region`] = item.region;
      values[`initialResponsive.${device}.items.${item.id}.visible`] = item.visible;
      values[`initialResponsive.${device}.items.${item.id}.offsetFromCenter`] = item.offsetFromCenter;
    });

    Object.entries(initialLayout.settings).forEach(([key, value]) => {
      values[`initialResponsive.${device}.settings.${key}`] = value;
    });
  });

  return {
    key: auditEntityKey('topBar', 'layout'),
    kind: 'topBar',
    id: 'layout',
    label: 'Postavitev zgornje vrstice',
    parentLabel: null,
    values
  };
}

function flatTopLevelItem(item: SiteNavigationTopLevelItem, includeOrder: boolean): SiteNavigationFlatEntity {
  return {
    key: auditEntityKey('topLevel', item.id),
    kind: 'topLevel',
    id: item.id,
    label: item.label || 'Element navigacije',
    parentLabel: null,
    values: {
      label: item.label,
      href: item.href,
      visible: item.visible,
      ...(includeOrder ? { order: item.position + 1 } : {})
    }
  };
}

function flatGroup(item: SiteNavigationTopLevelItem, group: SiteNavigationGroup, includeOrder: boolean): SiteNavigationFlatEntity {
  return {
    key: auditEntityKey('group', group.id),
    kind: 'group',
    id: group.id,
    label: group.label || 'Skupina',
    parentLabel: item.label || null,
    values: {
      label: group.label,
      href: group.href,
      visible: group.visible,
      desktopSpan: group.desktopSpan ?? 1,
      ...(includeOrder ? { order: group.position + 1 } : {})
    }
  };
}

function flatLink(item: SiteNavigationTopLevelItem, group: SiteNavigationGroup, link: SiteNavigationLink, includeOrder: boolean): SiteNavigationFlatEntity {
  return {
    key: auditEntityKey('link', link.id),
    kind: 'link',
    id: link.id,
    label: link.label || 'Povezava',
    parentLabel: [item.label, group.label].filter(Boolean).join(' / ') || null,
    values: {
      label: link.label,
      description: link.description,
      href: link.href,
      icon: link.icon,
      visible: link.visible,
      ...(includeOrder ? { order: link.position + 1 } : {})
    }
  };
}

function markReorderedIds(
  reorderedIds: Set<string>,
  kind: SiteNavigationEntityKind,
  beforeIds: string[],
  afterIds: string[]
) {
  const afterIdSet = new Set(afterIds);
  const beforeIdSet = new Set(beforeIds);
  const beforeCommon = beforeIds.filter((id) => afterIdSet.has(id));
  const afterCommon = afterIds.filter((id) => beforeIdSet.has(id));
  if (beforeCommon.join('\u0000') === afterCommon.join('\u0000')) return;

  afterCommon.forEach((id, index) => {
    if (beforeCommon[index] !== id) {
      reorderedIds.add(auditEntityKey(kind, id));
    }
  });
}

function collectReorderedIds(before: SiteNavigationConfig, after: SiteNavigationConfig) {
  const reorderedIds = new Set<string>();
  markReorderedIds(
    reorderedIds,
    'topLevel',
    before.items.map((item) => item.id),
    after.items.map((item) => item.id)
  );

  const beforeItems = new Map(before.items.map((item) => [item.id, item]));
  after.items.forEach((afterItem) => {
    const beforeItem = beforeItems.get(afterItem.id);
    if (!beforeItem) return;

    markReorderedIds(
      reorderedIds,
      'group',
      beforeItem.groups.map((group) => group.id),
      afterItem.groups.map((group) => group.id)
    );

    const beforeGroups = new Map(beforeItem.groups.map((group) => [group.id, group]));
    afterItem.groups.forEach((afterGroup) => {
      const beforeGroup = beforeGroups.get(afterGroup.id);
      if (!beforeGroup) return;
      markReorderedIds(
        reorderedIds,
        'link',
        beforeGroup.links.map((link) => link.id),
        afterGroup.links.map((link) => link.id)
      );
    });
  });

  return reorderedIds;
}

function flattenNavigationConfig(config: SiteNavigationConfig, reorderedIds: Set<string>) {
  const entities = new Map<string, SiteNavigationFlatEntity>();

  const topBarEntity = flatTopBarLayout(config);
  entities.set(topBarEntity.key, topBarEntity);

  config.items.forEach((item) => {
    const topEntity = flatTopLevelItem(item, reorderedIds.has(auditEntityKey('topLevel', item.id)));
    entities.set(topEntity.key, topEntity);

    item.groups.forEach((group) => {
      const groupEntity = flatGroup(item, group, reorderedIds.has(auditEntityKey('group', group.id)));
      entities.set(groupEntity.key, groupEntity);

      group.links.forEach((link) => {
        const linkEntity = flatLink(item, group, link, reorderedIds.has(auditEntityKey('link', link.id)));
        entities.set(linkEntity.key, linkEntity);
      });
    });
  });

  return entities;
}

function diffNavigationValues(before: Record<string, unknown>, after: Record<string, unknown>) {
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
  const diff: SiteNavigationAuditRow['diff'] = {};

  keys.forEach((key) => {
    const beforeValue = before[key];
    const afterValue = after[key];
    if (auditValueLabel(key, beforeValue) === auditValueLabel(key, afterValue)) return;

    diff[key] = {
      label: topBarAuditFieldLabel(key),
      before: auditValueLabel(key, beforeValue),
      after: auditValueLabel(key, afterValue)
    };
  });

  return diff;
}

function chooseNavigationDisplayAction(
  before: SiteNavigationFlatEntity,
  after: SiteNavigationFlatEntity,
  diff: SiteNavigationAuditRow['diff']
): SiteNavigationDisplayAction {
  if (before.values.visible !== after.values.visible) {
    return after.values.visible === false ? 'hidden' : 'shown';
  }
  const keys = Object.keys(diff);
  return keys.length === 1 && keys[0] === 'order' ? 'reordered' : 'updated';
}

function toAuditAction(action: SiteNavigationDisplayAction): SiteNavigationAuditAction {
  if (action === 'created') return 'created';
  if (action === 'deleted') return 'deleted';
  if (action === 'reordered') return 'reordered';
  return 'updated';
}

function makeNavigationSummary(action: SiteNavigationDisplayAction, entity: SiteNavigationFlatEntity) {
  return `${navigationActionSummaryPrefixes[action]}: ${navigationEntityLabels[entity.kind]} "${entity.label}"`;
}

function makeAuditRow(action: SiteNavigationDisplayAction, entity: SiteNavigationFlatEntity, diff: SiteNavigationAuditRow['diff']): SiteNavigationAuditRow {
  return {
    action: toAuditAction(action),
    displayAction: action,
    entityLabel: entity.label,
    entityKind: entity.kind,
    entityId: entity.id,
    parentLabel: entity.parentLabel,
    summary: makeNavigationSummary(action, entity),
    diff
  };
}

function buildSiteNavigationAuditRows(beforeInput: SiteNavigationConfig, afterInput: SiteNavigationConfig) {
  const before = normalizeSiteNavigationConfig(beforeInput);
  const after = normalizeSiteNavigationConfig(afterInput);
  const reorderedIds = collectReorderedIds(before, after);
  const beforeEntities = flattenNavigationConfig(before, reorderedIds);
  const afterEntities = flattenNavigationConfig(after, reorderedIds);
  const rows: SiteNavigationAuditRow[] = [];

  beforeEntities.forEach((beforeEntity, key) => {
    if (afterEntities.has(key)) return;
    const emptyAfter = Object.fromEntries(Object.keys(beforeEntity.values).map((field) => [field, null]));
    rows.push(makeAuditRow('deleted', beforeEntity, diffNavigationValues(beforeEntity.values, emptyAfter)));
  });

  afterEntities.forEach((afterEntity, key) => {
    const beforeEntity = beforeEntities.get(key);
    if (!beforeEntity) {
      const emptyBefore = Object.fromEntries(Object.keys(afterEntity.values).map((field) => [field, null]));
      rows.push(makeAuditRow('created', afterEntity, diffNavigationValues(emptyBefore, afterEntity.values)));
      return;
    }

    const diff = diffNavigationValues(beforeEntity.values, afterEntity.values);
    if (Object.keys(diff).length === 0) return;
    rows.push(makeAuditRow(chooseNavigationDisplayAction(beforeEntity, afterEntity, diff), afterEntity, diff));
  });

  return rows;
}

function mapSiteNavigationChangeLogRow(row: Record<string, unknown>): SiteNavigationChangeLogEntry {
  const metadata = asRecord(row.metadata_json);
  const diff = asRecord(row.diff_json);
  const action = typeof metadata.displayAction === 'string' && metadata.displayAction in navigationActionLabels
    ? metadata.displayAction as SiteNavigationDisplayAction
    : row.action === 'created' || row.action === 'deleted' || row.action === 'reordered'
      ? row.action as SiteNavigationDisplayAction
      : 'updated';
  const entityKind = typeof metadata.navEntityType === 'string' && metadata.navEntityType in navigationEntityLabels
    ? metadata.navEntityType as SiteNavigationEntityKind
    : 'link';

  return {
    id: String(row.id),
    occurredAt: toIso(row.occurred_at) ?? new Date().toISOString(),
    action,
    actionLabel: navigationActionLabels[action],
    entityTypeLabel: navigationEntityLabels[entityKind],
    entityLabel: String(row.entity_label ?? ''),
    parentLabel: typeof metadata.parentLabel === 'string' && metadata.parentLabel ? metadata.parentLabel : null,
    summary: String(row.summary ?? ''),
    actorName: row.actor_name === null || row.actor_name === undefined ? null : String(row.actor_name),
    changes: Object.entries(diff).map(([key, value]) => {
      const entry = asRecord(value);
      return {
        field: typeof entry.label === 'string' ? entry.label : topBarAuditFieldLabel(key),
        before: entry.before === null || entry.before === undefined ? '' : String(entry.before),
        after: entry.after === null || entry.after === undefined ? '' : String(entry.after)
      };
    })
  };
}

async function ensureSiteNavigationTable() {
  const pool = await getPool();
  await pool.query(tableSql);
  return pool;
}

async function insertSiteNavigationAuditRows(client: PoolClient, rows: SiteNavigationAuditRow[], request?: Request) {
  if (rows.length === 0) return;

  const actor = request
    ? await getAuditActor(request)
    : { actor_id: 'system', actor_name: 'System', actor_email: null };
  const requestContext = request
    ? getAuditRequestContext(request)
    : { requestId: null, ipHash: null, userAgentHash: null, metadata: {} };
  const payload = rows.map((row) => ({
    actor_id: actor.actor_id,
    actor_name: actor.actor_name,
    actor_email: actor.actor_email,
    action: row.action,
    entity_label: row.entityLabel,
    summary: row.summary,
    diff_json: row.diff,
    metadata_json: {
      ...requestContext.metadata,
      area: 'site_navigation',
      displayAction: row.displayAction,
      navEntityType: row.entityKind,
      navEntityId: row.entityId,
      parentLabel: row.parentLabel,
      fieldCount: Object.keys(row.diff).length
    },
    request_id: requestContext.requestId,
    source: SITE_NAVIGATION_AUDIT_SOURCE,
    ip_hash: requestContext.ipHash,
    user_agent_hash: requestContext.userAgentHash
  }));

  await client.query(
    `
    insert into audit_events (
      actor_id,
      actor_name,
      actor_email,
      entity_type,
      entity_id,
      entity_label,
      action,
      summary,
      diff_json,
      metadata_json,
      request_id,
      source,
      ip_hash,
      user_agent_hash
    )
    select
      entry.actor_id,
      entry.actor_name,
      entry.actor_email,
      'system',
      $2,
      entry.entity_label,
      entry.action,
      entry.summary,
      entry.diff_json,
      entry.metadata_json,
      entry.request_id,
      entry.source,
      entry.ip_hash,
      entry.user_agent_hash
    from jsonb_to_recordset($1::jsonb) as entry(
      actor_id text,
      actor_name text,
      actor_email text,
      action text,
      entity_label text,
      summary text,
      diff_json jsonb,
      metadata_json jsonb,
      request_id text,
      source text,
      ip_hash text,
      user_agent_hash text
    )
    `,
    [JSON.stringify(payload), SITE_NAVIGATION_AUDIT_ENTITY_ID]
  );
}

export async function getSiteNavigationConfig(): Promise<SiteNavigationConfig> {
  noStore();

  try {
    const pool = await ensureSiteNavigationTable();
    const result = await pool.query(
      'select config_json, updated_at from site_navigation_settings where key = $1 limit 1',
      [SITE_NAVIGATION_SETTINGS_KEY]
    );
    const row = result.rows[0] as { config_json?: unknown; updated_at?: unknown } | undefined;

    if (!row) return cloneDefaultSiteNavigationConfig();

    return {
      ...normalizeSiteNavigationConfig(row.config_json),
      updatedAt: toIso(row.updated_at)
    };
  } catch (error) {
    if (!isDatabaseUnavailableError(error)) {
      console.error('Failed to load site navigation config', error);
    }
    return cloneDefaultSiteNavigationConfig();
  }
}

export async function updateSiteNavigationConfig(input: unknown, options: { request?: Request } = {}): Promise<SiteNavigationConfig> {
  const config = toStoredSiteNavigationConfig(normalizeSiteNavigationConfig(input));
  const pool = await ensureSiteNavigationTable();
  const client = await pool.connect();

  try {
    await client.query('begin');
    const previousResult = await client.query(
      'select config_json from site_navigation_settings where key = $1 for update',
      [SITE_NAVIGATION_SETTINGS_KEY]
    );
    const previousConfig = previousResult.rows[0]
      ? normalizeSiteNavigationConfig((previousResult.rows[0] as { config_json?: unknown }).config_json)
      : cloneDefaultSiteNavigationConfig();

    const result = await client.query(
      `insert into site_navigation_settings (key, config_json, updated_at)
       values ($1, $2::jsonb, now())
       on conflict (key)
       do update set config_json = excluded.config_json, updated_at = now()
       returning config_json, updated_at`,
      [SITE_NAVIGATION_SETTINGS_KEY, JSON.stringify(config)]
    );
    const row = result.rows[0] as { config_json?: unknown; updated_at?: unknown } | undefined;
    const storedConfig = normalizeSiteNavigationConfig(row?.config_json ?? config);
    const auditRows = buildSiteNavigationAuditRows(previousConfig, storedConfig);

    await insertSiteNavigationAuditRows(client, auditRows, options.request);
    await client.query('commit');

    return {
      ...storedConfig,
      updatedAt: toIso(row?.updated_at)
    };
  } catch (error) {
    await client.query('rollback');
    throw error;
  } finally {
    client.release();
  }
}

export async function fetchSiteNavigationChangeLog(limit = SITE_NAVIGATION_AUDIT_PAGE_SIZE): Promise<SiteNavigationChangeLogEntry[]> {
  noStore();

  try {
    const pool = await getPool();
    const boundedLimit = Math.min(SITE_NAVIGATION_AUDIT_PAGE_SIZE, Math.max(1, Math.floor(limit)));
    const result: QueryResult<Record<string, unknown>> = await pool.query(
      `
      select id, occurred_at, actor_name, action, entity_label, summary, diff_json, metadata_json
      from audit_events
      where entity_type = 'system'
        and entity_id = $1
        and source = $2
      order by occurred_at desc, created_at desc
      limit $3
      `,
      [SITE_NAVIGATION_AUDIT_ENTITY_ID, SITE_NAVIGATION_AUDIT_SOURCE, boundedLimit]
    );

    return result.rows.map(mapSiteNavigationChangeLogRow);
  } catch (error) {
    if (!isDatabaseUnavailableError(error)) {
      console.error('Failed to load site navigation change log', error);
    }
    return [];
  }
}
