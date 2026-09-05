import 'server-only';

import { revalidateTag } from '@/shared/server/diagnostics/cache';
import { unstable_cache, unstable_noStore as noStore } from 'next/cache';
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

const SITE_NAVIGATION_AUDIT_ENTITY_ID = 'site-navigation';
const SITE_NAVIGATION_AUDIT_SOURCE = 'admin-site-navigation';
const SITE_NAVIGATION_CACHE_TAG = 'site-navigation-config';

type SiteNavigationEntityKind =
  | 'topLevel'
  | 'group'
  | 'link'
  | 'footerColumn'
  | 'footerLink'
  | 'footerContact'
  | 'footerSocialLink'
  | 'footerLegalLink'
  | 'footerSettings'
  | 'topBar';
type SiteNavigationDisplayAction = 'created' | 'updated' | 'deleted' | 'hidden' | 'shown' | 'reordered';
type SiteNavigationAuditAction = 'created' | 'updated' | 'deleted' | 'reordered';

export type SiteNavigationUpdateResult = {
  config: SiteNavigationConfig;
  changed: boolean;
};

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
  footerColumn: 'Stolpec v nogi',
  footerLink: 'Povezava v nogi',
  footerContact: 'Kontaktni podatki v nogi',
  footerSocialLink: 'DruÅ¾beno omreÅ¾je v nogi',
  footerLegalLink: 'Pravna povezava v nogi',
  footerSettings: 'Nastavitve noge',
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
  descriptionTextAlign: 'Poravnava opisa',
  title: 'Naslov',
  titleTextAlign: 'Poravnava naslova',
  textAlign: 'Poravnava besedila',
  icon: 'Ikona',
  email: 'E-poÅ¡ta',
  phone: 'Telefon',
  address: 'Naslov',
  workingHours: 'Delovni Äas',
  type: 'Vrsta',
  copyright: 'Copyright',
  copyrightTextAlign: 'Poravnava avtorskih pravic',
  upperSectionVisible: 'Prikaz zgornjega dela',
  lowerSectionVisible: 'Prikaz spodnjega dela',
  lowerContactVisible: 'Kontakt v spodnjem delu',
  logoMode: 'Logotip',
  logoText: 'Besedilo logotipa',
  layoutColumns: 'Å tevilo stolpcev',
  spacing: 'Odmik',
  topBorder: 'Zgornja obroba',
  visible: 'Vidnost',
  desktopSpan: 'Širina',
  order: 'Vrstni red',
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

const textAlignmentAuditLabels = {
  left: 'Levo',
  center: 'Sredinsko',
  right: 'Desno',
  justify: 'Obojestransko'
} as const;

const topBarSettingAuditLabels: Record<string, string> = {
  backgroundColor: 'Barva ozadja',
  backgroundOpacityPercent: 'Prosojnost ozadja',
  textColor: 'Barva besedila',
  fontFamily: 'Pisava',
  fontSizePx: 'Velikost pisave',
  fontWeight: 'Debelina pisave',
  fontStyle: 'Slog pisave',
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
  if (!match) {
    const footerResponsiveMatch = /^footerResponsive\.([^.]+)\.([^.]+)$/.exec(field);
    if (footerResponsiveMatch) {
      const [, device, setting] = footerResponsiveMatch;
      const deviceLabel = topBarDeviceAuditLabels[device as keyof typeof topBarDeviceAuditLabels] ?? device;
      return `${deviceLabel}: ${navigationFieldLabels[setting] ?? setting}`;
    }
    return navigationFieldLabels[field] ?? field;
  }

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
  if (field === 'topBorder' || field.endsWith('.topBorder')) return value === false ? 'Ne' : 'Da';
  if (field === 'upperSectionVisible' || field === 'lowerSectionVisible' || field === 'lowerContactVisible') {
    return visibleLabel(value);
  }
  if (field.includes('.visible') || field.endsWith('.cartBadge') || field.endsWith('.sticky') || field.endsWith('.shadow') || field.endsWith('.safeArea')) {
    return visibleLabel(value);
  }
  if (field.endsWith('.region')) {
    return topBarRegionAuditLabels[value as keyof typeof topBarRegionAuditLabels] ?? String(value);
  }
  if (field === 'textAlign' || field.endsWith('TextAlign')) {
    return textAlignmentAuditLabels[value as keyof typeof textAlignmentAuditLabels] ?? String(value);
  }
  if (field.endsWith('.fontStyle')) {
    return value === 'italic' ? 'Ležeče' : 'Navadno';
  }
  if (field.endsWith('.backgroundOpacityPercent')) {
    const numeric = Number(value);
    return `${Number.isFinite(numeric) ? numeric : 0} %`;
  }
  if (Array.isArray(value)) {
    return value.map((item) => topBarElementAuditLabels[item as keyof typeof topBarElementAuditLabels] ?? String(item)).join(', ');
  }
  if (
    field.endsWith('.offsetFromCenter') ||
    field.endsWith('.fontSizePx') ||
    field.endsWith('.height') ||
    field.endsWith('.paddingX') ||
    field.endsWith('.breakpointFrom') ||
    field.endsWith('.breakpointTo')
  ) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return '0 px';
    return `${numeric} px`;
  }
  if (field === 'visible') return visibleLabel(value);
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
  const values: Record<string, unknown> = {};

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

type SiteFooterSettings = SiteNavigationConfig['footer'];
type SiteFooterColumn = SiteFooterSettings['columns'][number];
type SiteFooterLink = SiteFooterColumn['links'][number];
type SiteFooterSocialLink = SiteFooterSettings['socialLinks'][number];

function footerLinkAuditId(columnId: string, linkId: string) {
  return `${columnId}/${linkId}`;
}

function flatFooterColumn(column: SiteFooterColumn, includeOrder: boolean): SiteNavigationFlatEntity {
  return {
    key: auditEntityKey('footerColumn', column.id),
    kind: 'footerColumn',
    id: column.id,
    label: column.title || 'Stolpec v nogi',
    parentLabel: 'Noga',
    values: {
      title: column.title,
      titleTextAlign: column.titleTextAlign,
      visible: column.visible !== false,
      ...(includeOrder ? { order: (column.position ?? 0) + 1 } : {})
    }
  };
}

function flatFooterLink(column: SiteFooterColumn, link: SiteFooterLink, includeOrder: boolean): SiteNavigationFlatEntity {
  const scopedId = footerLinkAuditId(column.id, link.id);
  return {
    key: auditEntityKey('footerLink', scopedId),
    kind: 'footerLink',
    id: link.id,
    label: link.label || 'Povezava v nogi',
    parentLabel: column.title || 'Noga',
    values: {
      label: link.label,
      href: link.href,
      textAlign: link.textAlign,
      visible: link.visible !== false,
      ...(includeOrder ? { order: (link.position ?? 0) + 1 } : {})
    }
  };
}

function flatFooterContact(footer: SiteFooterSettings): SiteNavigationFlatEntity {
  return {
    key: auditEntityKey('footerContact', 'contact'),
    kind: 'footerContact',
    id: 'contact',
    label: 'Kontakt',
    parentLabel: 'Noga',
    values: {
      email: footer.contact.email,
      phone: footer.contact.phone,
      address: footer.contact.address,
      workingHours: footer.contact.workingHours,
      textAlign: footer.contact.textAlign
    }
  };
}

function flatFooterSocialLink(link: SiteFooterSocialLink, includeOrder: boolean): SiteNavigationFlatEntity {
  return {
    key: auditEntityKey('footerSocialLink', link.id),
    kind: 'footerSocialLink',
    id: link.id,
    label: link.label || 'DruÅ¾beno omreÅ¾je',
    parentLabel: 'Noga / DruÅ¾bena omreÅ¾ja',
    values: {
      type: link.type,
      label: link.label,
      href: link.href,
      visible: link.visible !== false,
      ...(includeOrder ? { order: (link.position ?? 0) + 1 } : {})
    }
  };
}

function flatFooterLegalLink(link: SiteFooterSettings['legalLinks'][number], includeOrder: boolean): SiteNavigationFlatEntity {
  return {
    key: auditEntityKey('footerLegalLink', link.id),
    kind: 'footerLegalLink',
    id: link.id,
    label: link.label || 'Pravna povezava',
    parentLabel: 'Noga / Pravne povezave',
    values: {
      label: link.label,
      href: link.href,
      textAlign: link.textAlign,
      visible: link.visible !== false,
      ...(includeOrder ? { order: (link.position ?? 0) + 1 } : {})
    }
  };
}

function flatFooterSettings(footer: SiteFooterSettings): SiteNavigationFlatEntity {
  const values: Record<string, unknown> = {
    visible: footer.visible,
    upperSectionVisible: footer.upperSectionVisible,
    lowerSectionVisible: footer.lowerSectionVisible,
    lowerContactVisible: footer.lowerContactVisible,
    logoMode: footer.logoMode,
    logoText: footer.logoText,
    description: footer.description,
    descriptionTextAlign: footer.descriptionTextAlign,
    copyright: footer.copyright,
    copyrightTextAlign: footer.copyrightTextAlign,
    layoutColumns: footer.layoutColumns,
    spacing: footer.spacing,
    topBorder: footer.topBorder
  };

  Object.entries(footer.responsive).forEach(([device, settings]) => {
    Object.entries(settings).forEach(([key, value]) => {
      values[`footerResponsive.${device}.${key}`] = value;
    });
  });

  return {
    key: auditEntityKey('footerSettings', 'settings'),
    kind: 'footerSettings',
    id: 'settings',
    label: 'Noga spletnega mesta',
    parentLabel: null,
    values
  };
}

function footerColumnIds(footer: SiteFooterSettings) {
  return footer.columns.map((column) => column.id);
}

function footerSocialLinkIds(footer: SiteFooterSettings) {
  return footer.socialLinks.map((link) => link.id);
}

function footerLegalLinkIds(footer: SiteFooterSettings) {
  return footer.legalLinks.map((link) => link.id);
}

function footerNestedLinkIds(column: SiteFooterColumn) {
  return column.links.map((link) => footerLinkAuditId(column.id, link.id));
}

function addFooterEntities(
  entities: Map<string, SiteNavigationFlatEntity>,
  config: SiteNavigationConfig,
  reorderedIds: Set<string>
) {
  const settingsEntity = flatFooterSettings(config.footer);
  entities.set(settingsEntity.key, settingsEntity);

  const contactEntity = flatFooterContact(config.footer);
  entities.set(contactEntity.key, contactEntity);

  config.footer.columns.forEach((column) => {
    const columnEntity = flatFooterColumn(
      column,
      reorderedIds.has(auditEntityKey('footerColumn', column.id))
    );
    entities.set(columnEntity.key, columnEntity);

    column.links.forEach((link) => {
      const scopedId = footerLinkAuditId(column.id, link.id);
      const linkEntity = flatFooterLink(
        column,
        link,
        reorderedIds.has(auditEntityKey('footerLink', scopedId))
      );
      entities.set(linkEntity.key, linkEntity);
    });
  });

  config.footer.socialLinks.forEach((link) => {
    const entity = flatFooterSocialLink(
      link,
      reorderedIds.has(auditEntityKey('footerSocialLink', link.id))
    );
    entities.set(entity.key, entity);
  });

  config.footer.legalLinks.forEach((link) => {
    const entity = flatFooterLegalLink(
      link,
      reorderedIds.has(auditEntityKey('footerLegalLink', link.id))
    );
    entities.set(entity.key, entity);
  });
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

  markReorderedIds(
    reorderedIds,
    'footerColumn',
    footerColumnIds(before.footer),
    footerColumnIds(after.footer)
  );

  const beforeFooterColumns = new Map(before.footer.columns.map((column) => [column.id, column]));
  after.footer.columns.forEach((afterColumn) => {
    const beforeColumn = beforeFooterColumns.get(afterColumn.id);
    if (!beforeColumn) return;
    markReorderedIds(
      reorderedIds,
      'footerLink',
      footerNestedLinkIds(beforeColumn),
      footerNestedLinkIds(afterColumn)
    );
  });

  markReorderedIds(
    reorderedIds,
    'footerSocialLink',
    footerSocialLinkIds(before.footer),
    footerSocialLinkIds(after.footer)
  );
  markReorderedIds(
    reorderedIds,
    'footerLegalLink',
    footerLegalLinkIds(before.footer),
    footerLegalLinkIds(after.footer)
  );

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

  addFooterEntities(entities, config, reorderedIds);

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

function serializeStoredSiteNavigationConfig(config: SiteNavigationConfig) {
  return JSON.stringify({
    siteLayout: config.siteLayout,
    items: config.items,
    footer: config.footer,
    topBarLayout: config.topBarLayout,
    topBarInitialLayout: config.topBarInitialLayout
  });
}

async function readSiteNavigationConfigFromDatabase(): Promise<SiteNavigationConfig> {
  const pool = await getPool();
  const result = await pool.query(
    'select config_json, updated_at from site_navigation_settings where key = $1 limit 1',
    [SITE_NAVIGATION_SETTINGS_KEY]
  );
  const row = result.rows[0] as { config_json?: unknown; updated_at?: unknown } | undefined;
  const config = row
    ? normalizeSiteNavigationConfig(row.config_json)
    : cloneDefaultSiteNavigationConfig();

  return {
    ...config,
    updatedAt: toIso(row?.updated_at)
  };
}

const getCachedSiteNavigationConfigFromDatabase = unstable_cache(
  readSiteNavigationConfigFromDatabase,
  ['site-navigation-config'],
  { tags: [SITE_NAVIGATION_CACHE_TAG] }
);

export function revalidateSiteNavigationConfigCache() {
  revalidateTag(SITE_NAVIGATION_CACHE_TAG, { expire: 0 });
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
  try {
    return normalizeSiteNavigationConfig(await getCachedSiteNavigationConfigFromDatabase());
  } catch (error) {
    if (!isDatabaseUnavailableError(error)) {
      console.error('Failed to load site navigation config', error);
    }
    return cloneDefaultSiteNavigationConfig();
  }
}

export async function updateSiteNavigationConfig(input: unknown, options: { request?: Request } = {}): Promise<SiteNavigationUpdateResult> {
  const config = toStoredSiteNavigationConfig(input);
  const serializedConfig = serializeStoredSiteNavigationConfig(config);
  const pool = await getPool();
  const client = await pool.connect();

  try {
    await client.query('begin');
    const previousResult = await client.query(
      'select config_json, updated_at from site_navigation_settings where key = $1 for update',
      [SITE_NAVIGATION_SETTINGS_KEY]
    );
    const previousRow = previousResult.rows[0] as { config_json?: unknown; updated_at?: unknown } | undefined;
    const previousConfig = previousRow
      ? toStoredSiteNavigationConfig(previousRow.config_json)
      : toStoredSiteNavigationConfig(cloneDefaultSiteNavigationConfig());

    if (previousRow && serializeStoredSiteNavigationConfig(previousConfig) === serializedConfig) {
      await client.query('commit');

      return {
        config: {
          ...previousConfig,
          updatedAt: toIso(previousRow.updated_at)
        },
        changed: false
      };
    }

    const result = await client.query(
      `insert into site_navigation_settings (key, config_json, updated_at)
       values ($1, $2::jsonb, now())
       on conflict (key)
       do update set config_json = excluded.config_json, updated_at = now()
       returning updated_at`,
      [SITE_NAVIGATION_SETTINGS_KEY, serializedConfig]
    );
    const row = result.rows[0] as { updated_at?: unknown } | undefined;
    const auditRows = buildSiteNavigationAuditRows(previousConfig, config);

    await insertSiteNavigationAuditRows(client, auditRows, options.request);
    await client.query('commit');

    return {
      config: {
        ...config,
        updatedAt: toIso(row?.updated_at)
      },
      changed: true
    };
  } catch (error) {
    await client.query('rollback');
    throw error;
  } finally {
    client.release();
  }
}

export async function fetchSiteNavigationChangeLog(): Promise<SiteNavigationChangeLogEntry[]> {
  noStore();

  try {
    const pool = await getPool();
    const result: QueryResult<Record<string, unknown>> = await pool.query(
      `
      select id, occurred_at, actor_name, action, entity_label, summary, diff_json, metadata_json
      from audit_events
      where entity_type = 'system'
        and entity_id = $1
        and source = $2
      order by occurred_at desc, created_at desc
      `,
      [SITE_NAVIGATION_AUDIT_ENTITY_ID, SITE_NAVIGATION_AUDIT_SOURCE]
    );

    return result.rows.map(mapSiteNavigationChangeLogRow);
  } catch (error) {
    if (!isDatabaseUnavailableError(error)) {
      console.error('Failed to load site navigation change log', error);
    }
    return [];
  }
}
