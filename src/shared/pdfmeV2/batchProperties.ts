import type {
  ChangeSchemaItem,
  ChangeSchemas,
  Plugin,
  PropPanelSchema,
  PropPanelWidgetProps,
  SchemaForUI
} from '@pdfme/common';
import { PDFME_V2_LIMITS } from '@/shared/domain/pdfmeV2';

export const PDFME_V2_MIXED_VALUE_LABEL = 'Mešano' as const;

export const PDFME_V2_BATCH_PROPERTIES = [
  'rotate',
  'opacity',
  'fontSize'
] as const;

export type PdfmeV2BatchProperty =
  (typeof PDFME_V2_BATCH_PROPERTIES)[number];

type SchemaElementReference = Readonly<Pick<HTMLElement, 'id'>>;

export interface PdfmeV2PropPanelSelectionInput {
  activeElements: readonly SchemaElementReference[];
  schemas: readonly SchemaForUI[];
}

export interface PdfmeV2BatchFieldAvailability {
  enabled: boolean;
  reason?: string;
  selectedCount: number;
  selectedTypes: readonly string[];
}

export interface PdfmeV2BatchPropertyState
  extends PdfmeV2BatchFieldAvailability {
  mixed: boolean;
  value?: number;
  placeholder?: string;
}

export type PdfmeV2NumericDraft =
  | { status: 'draft'; draft: string }
  | { status: 'valid'; draft: string; value: number }
  | { status: 'invalid'; draft: string };

interface BatchPropertyDefinition {
  label: string;
  supportedTypes: ReadonlySet<string>;
  fallbackValue: number;
  min: number;
  max: number;
  step: number;
}

const ROTATABLE_TYPES = new Set([
  'text',
  'multiVariableText',
  'image',
  'line',
  'rectangle',
  'ellipse',
  'list'
]);

const OPACITY_TYPES = new Set([
  'text',
  'multiVariableText',
  'image',
  'line',
  'rectangle',
  'ellipse',
  'list'
]);

const TYPOGRAPHY_TYPES = new Set(['text', 'multiVariableText', 'list']);

const BATCH_PROPERTY_DEFINITIONS: Record<
  PdfmeV2BatchProperty,
  BatchPropertyDefinition
> = {
  rotate: {
    label: 'Zasuk',
    supportedTypes: ROTATABLE_TYPES,
    fallbackValue: 0,
    min: 0,
    max: 360,
    step: 1
  },
  opacity: {
    label: 'Prosojnost',
    supportedTypes: OPACITY_TYPES,
    fallbackValue: 1,
    min: 0,
    max: 1,
    step: 0.1
  },
  fontSize: {
    label: 'Velikost pisave',
    supportedTypes: TYPOGRAPHY_TYPES,
    fallbackValue: 13,
    min: PDFME_V2_LIMITS.MIN_FONT_SIZE,
    max: PDFME_V2_LIMITS.MAX_FONT_SIZE,
    step: 0.1
  }
};

const SCHEMA_TYPE_LABELS: Readonly<Record<string, string>> = {
  text: 'Besedilo',
  multiVariableText: 'Besedilo s spremenljivkami',
  image: 'Slika',
  svg: 'SVG',
  line: 'Črta',
  rectangle: 'Pravokotnik',
  ellipse: 'Elipsa',
  table: 'Tabela',
  list: 'Seznam'
};

const BATCH_NUMBER_WIDGET = 'atehnaPdfmeV2BatchNumber';
const SELECTION_SUMMARY_WIDGET = 'atehnaPdfmeV2SelectionSummary';
const BATCH_PANEL_KEY = 'atehnaPdfmeV2BatchProperties';
const BATCH_DIVIDER_KEY = 'atehnaPdfmeV2BatchDivider';

function schemaRecord(schema: SchemaForUI): Record<string, unknown> {
  return schema as unknown as Record<string, unknown>;
}

function uniqueSchemaTypes(schemas: readonly SchemaForUI[]): string[] {
  return [...new Set(schemas.map((schema) => schema.type))];
}

function selectionCountLabel(count: number): string {
  if (count === 1) return '1 izbran element';
  if (count === 2) return '2 izbrana elementa';
  if (count === 3 || count === 4) return `${count} izbrani elementi`;
  return `${count} izbranih elementov`;
}

function propertyDefinition(
  property: PdfmeV2BatchProperty
): BatchPropertyDefinition {
  return BATCH_PROPERTY_DEFINITIONS[property];
}

function numericSchemaValue(
  schema: SchemaForUI,
  property: PdfmeV2BatchProperty
): number | undefined {
  const rawValue = schemaRecord(schema)[property];
  if (rawValue === undefined) {
    return propertyDefinition(property).fallbackValue;
  }
  return typeof rawValue === 'number' && Number.isFinite(rawValue)
    ? rawValue
    : undefined;
}

/**
 * Maps pdfme's public prop-panel element references back to its public schema
 * objects. No DOM queries or independent selection state are used.
 */
export function derivePropPanelSelection({
  activeElements,
  schemas
}: PdfmeV2PropPanelSelectionInput): SchemaForUI[] {
  const selectedIds = new Set(
    activeElements.map((element) => element.id).filter(Boolean)
  );
  return schemas.filter((schema) => selectedIds.has(schema.id));
}

export function formatPropPanelSelectionSummary(
  schemas: readonly SchemaForUI[]
): string {
  if (schemas.length === 0) return 'Ni izbranih elementov.';

  const counts = new Map<string, number>();
  for (const schema of schemas) {
    counts.set(schema.type, (counts.get(schema.type) ?? 0) + 1);
  }

  const typeSummary = [...counts.entries()]
    .map(([type, count]) => `${SCHEMA_TYPE_LABELS[type] ?? type} (${count})`)
    .join(', ');
  return `${selectionCountLabel(schemas.length)}: ${typeSummary}.`;
}

export function getBatchFieldAvailability(
  schemas: readonly SchemaForUI[],
  property: PdfmeV2BatchProperty
): PdfmeV2BatchFieldAvailability {
  const selectedTypes = uniqueSchemaTypes(schemas);
  if (schemas.length === 0) {
    return {
      enabled: false,
      reason: 'Najprej izberite element.',
      selectedCount: 0,
      selectedTypes
    };
  }

  const definition = propertyDefinition(property);
  if (
    property === 'fontSize' &&
    selectedTypes.some((type) => !TYPOGRAPHY_TYPES.has(type))
  ) {
    return {
      enabled: false,
      reason:
        'Velikost pisave je na voljo le, ko so vsi izbrani elementi tipografski.',
      selectedCount: schemas.length,
      selectedTypes
    };
  }

  const unsupportedTypes = selectedTypes.filter(
    (type) => !definition.supportedTypes.has(type)
  );
  if (unsupportedTypes.length > 0) {
    const labels = unsupportedTypes
      .map((type) => SCHEMA_TYPE_LABELS[type] ?? type)
      .join(', ');
    return {
      enabled: false,
      reason: `Izbor ne podpira lastnosti »${definition.label}«: ${labels}.`,
      selectedCount: schemas.length,
      selectedTypes
    };
  }

  if (schemas.some((schema) => numericSchemaValue(schema, property) === undefined)) {
    return {
      enabled: false,
      reason: `Izbor vsebuje neveljavno vrednost za »${definition.label}«.`,
      selectedCount: schemas.length,
      selectedTypes
    };
  }

  return {
    enabled: true,
    selectedCount: schemas.length,
    selectedTypes
  };
}

export function getBatchPropertyState(
  schemas: readonly SchemaForUI[],
  property: PdfmeV2BatchProperty
): PdfmeV2BatchPropertyState {
  const availability = getBatchFieldAvailability(schemas, property);
  if (!availability.enabled) {
    return {
      ...availability,
      mixed: false,
      placeholder: 'Ni na voljo'
    };
  }

  const values = schemas.map((schema) => numericSchemaValue(schema, property));
  const firstValue = values[0];
  const mixed = values.some((value) => value !== firstValue);
  return {
    ...availability,
    mixed,
    value: mixed ? undefined : firstValue,
    placeholder: mixed ? PDFME_V2_MIXED_VALUE_LABEL : undefined
  };
}

/**
 * Classifies syntax only. Even a valid value remains caller-owned draft text
 * until blur or Enter explicitly asks for a commit.
 */
export function classifyNumericDraft(draft: string): PdfmeV2NumericDraft {
  if (
    draft === '' ||
    /^[+-]$/u.test(draft) ||
    /^[+-]?\.$/u.test(draft) ||
    /^[+-]?\d+\.$/u.test(draft)
  ) {
    return { status: 'draft', draft };
  }

  if (!/^[+-]?(?:\d+|\d+\.\d+|\.\d+)$/u.test(draft)) {
    return { status: 'invalid', draft };
  }

  const value = Number(draft);
  return Number.isFinite(value)
    ? { status: 'valid', draft, value }
    : { status: 'invalid', draft };
}

export function isBatchPropertyValueValid(
  property: PdfmeV2BatchProperty,
  value: number
): boolean {
  if (!Number.isFinite(value)) return false;
  const definition = propertyDefinition(property);
  return value >= definition.min && value <= definition.max;
}

export function buildBatchChanges(
  schemas: readonly SchemaForUI[],
  property: PdfmeV2BatchProperty,
  value: number
): ChangeSchemaItem[] {
  if (
    !getBatchFieldAvailability(schemas, property).enabled ||
    !isBatchPropertyValueValid(property, value)
  ) {
    return [];
  }

  return schemas.map((schema) => ({
    key: property,
    value,
    schemaId: schema.id
  }));
}

/** Calls pdfme once with the complete batch, preserving one native history entry. */
export function commitBatchChanges({
  schemas,
  property,
  value,
  changeSchemas
}: {
  schemas: readonly SchemaForUI[];
  property: PdfmeV2BatchProperty;
  value: number;
  changeSchemas: ChangeSchemas;
}): boolean {
  const changes = buildBatchChanges(schemas, property, value);
  if (changes.length === 0) return false;
  changeSchemas(changes);
  return true;
}

export function commitNumericDraft({
  draft,
  schemas,
  property,
  changeSchemas
}: {
  draft: string;
  schemas: readonly SchemaForUI[];
  property: PdfmeV2BatchProperty;
  changeSchemas: ChangeSchemas;
}): boolean {
  const parsed = classifyNumericDraft(draft);
  if (parsed.status !== 'valid') return false;
  return commitBatchChanges({
    schemas,
    property,
    value: parsed.value,
    changeSchemas
  });
}

function propertyFromWidget(
  props: PropPanelWidgetProps
): PdfmeV2BatchProperty | undefined {
  const candidate = props.schema?.props?.batchProperty;
  return PDFME_V2_BATCH_PROPERTIES.find((property) => property === candidate);
}

function styleSummary(element: HTMLElement): void {
  Object.assign(element.style, {
    color: 'inherit',
    fontSize: '12px',
    lineHeight: '1.4',
    margin: '0'
  });
}

function renderSelectionSummaryWidget(props: PropPanelWidgetProps): void {
  const selected = derivePropPanelSelection(props);
  const summary = document.createElement('p');
  styleSummary(summary);
  summary.dataset.pdfmeV2SelectionSummary = 'true';
  summary.setAttribute('role', 'status');
  summary.textContent = formatPropPanelSelectionSummary(selected);
  props.rootElement.appendChild(summary);
}

function renderBatchNumberWidget(props: PropPanelWidgetProps): void {
  const property = propertyFromWidget(props);
  if (!property) return;

  const selected = derivePropPanelSelection(props);
  const state = getBatchPropertyState(selected, property);
  const definition = propertyDefinition(property);
  const input = document.createElement('input');
  input.type = 'text';
  input.inputMode = 'decimal';
  input.autocomplete = 'off';
  input.disabled = !state.enabled;
  input.value = state.value === undefined ? '' : String(state.value);
  input.placeholder = state.placeholder ?? '';
  input.dataset.pdfmeV2BatchProperty = property;
  input.dataset.indeterminate = String(state.mixed);
  input.setAttribute('aria-label', definition.label);
  input.setAttribute('aria-valuemin', String(definition.min));
  input.setAttribute('aria-valuemax', String(definition.max));
  if (state.mixed) {
    input.setAttribute('aria-valuetext', PDFME_V2_MIXED_VALUE_LABEL);
  }
  if (state.reason) input.title = state.reason;

  Object.assign(input.style, {
    width: '100%',
    boxSizing: 'border-box',
    border: '1px solid rgba(255, 255, 255, 0.2)',
    borderRadius: '4px',
    background: 'transparent',
    color: 'inherit',
    font: 'inherit',
    padding: '5px 8px'
  });

  let draft = input.value;
  let lastCommittedDraft: string | undefined = draft;

  const restoreDisplayedValue = () => {
    input.value = state.value === undefined ? '' : String(state.value);
    draft = input.value;
    lastCommittedDraft = draft;
    input.removeAttribute('aria-invalid');
  };

  const commit = (): boolean => {
    if (lastCommittedDraft === draft) return false;
    const parsed = classifyNumericDraft(draft);
    if (parsed.status === 'draft') {
      restoreDisplayedValue();
      return false;
    }
    const committed = commitNumericDraft({
      draft,
      schemas: selected,
      property,
      changeSchemas: props.changeSchemas
    });
    if (committed) {
      lastCommittedDraft = draft;
      input.removeAttribute('aria-invalid');
      return true;
    }
    if (
      parsed.status === 'invalid' ||
      (parsed.status === 'valid' &&
        !isBatchPropertyValueValid(property, parsed.value))
    ) {
      input.setAttribute('aria-invalid', 'true');
    }
    return false;
  };

  input.addEventListener('input', () => {
    draft = input.value;
    lastCommittedDraft = undefined;
    input.removeAttribute('aria-invalid');
  });
  input.addEventListener('blur', commit);
  input.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      const committed = commit();
      if (committed) input.blur();
    } else if (event.key === 'Escape') {
      event.preventDefault();
      restoreDisplayedValue();
    }
  });

  props.rootElement.appendChild(input);
  if (state.reason) {
    const reason = document.createElement('small');
    styleSummary(reason);
    reason.textContent = state.reason;
    props.rootElement.appendChild(reason);
  }
}

type DistributedFunction<T> = T extends (...args: infer Args) => infer Result
  ? (...args: Args) => Result
  : never;

type PropPanelSchemaFactory = DistributedFunction<
  Plugin['propPanel']['schema']
>;
type PropPanelSchemaFactoryProps = Parameters<PropPanelSchemaFactory>[0];

function resolvePluginPanelSchema(
  plugin: Plugin,
  props: PropPanelSchemaFactoryProps
): Record<string, PropPanelSchema> {
  const source = plugin.propPanel.schema;
  return typeof source === 'function' ? source(props) : source;
}

function hiddenNativeField(
  original?: PropPanelSchema
): PropPanelSchema {
  return {
    ...original,
    hidden: true
  };
}

function batchNumberField(
  property: PdfmeV2BatchProperty
): PropPanelSchema {
  const definition = propertyDefinition(property);
  return {
    title: definition.label,
    type: 'string',
    widget: BATCH_NUMBER_WIDGET,
    bind: false,
    span: property === 'fontSize' ? 24 : 12,
    props: { batchProperty: property }
  };
}

/**
 * Keeps every official plugin function intact and changes only propPanel. The
 * resulting plugin remains safe to share with Designer and generator.
 */
export function extendPluginWithBatchProperties(plugin: Plugin): Plugin {
  return {
    ...plugin,
    propPanel: {
      ...plugin.propPanel,
      defaultSchema: plugin.propPanel.defaultSchema,
      widgets: {
        ...plugin.propPanel.widgets,
        [BATCH_NUMBER_WIDGET]: renderBatchNumberWidget,
        [SELECTION_SUMMARY_WIDGET]: renderSelectionSummaryWidget
      },
      schema: (props: PropPanelSchemaFactoryProps) => {
        const original = resolvePluginPanelSchema(plugin, props);
        const withoutNativeBatchFields = { ...original };
        delete withoutNativeBatchFields.rotate;
        delete withoutNativeBatchFields.opacity;
        delete withoutNativeBatchFields.fontSize;

        return {
          ...withoutNativeBatchFields,
          rotate: hiddenNativeField(original.rotate),
          opacity: hiddenNativeField(original.opacity),
          fontSize: hiddenNativeField(original.fontSize),
          [BATCH_DIVIDER_KEY]: {
            type: 'void',
            widget: 'Divider'
          },
          [BATCH_PANEL_KEY]: {
            title: 'Skupne lastnosti izbora',
            type: 'string',
            widget: 'Card',
            bind: false,
            span: 24,
            properties: {
              selectionSummary: {
                type: 'string',
                widget: SELECTION_SUMMARY_WIDGET,
                bind: false,
                span: 24
              },
              batchRotate: batchNumberField('rotate'),
              batchOpacity: batchNumberField('opacity'),
              batchFontSize: batchNumberField('fontSize')
            }
          }
        };
      }
    }
  };
}
