export const EMAIL_TEMPLATE_BLOCK_IDS = [
  'sharedHeader',
  'templateContent',
  'audienceDetails',
  'customerDetails',
  'systemDetails',
  'items',
  'totals',
  'primaryAction',
  'sharedFooter'
] as const;

export type EmailTemplateBlockId =
  (typeof EMAIL_TEMPLATE_BLOCK_IDS)[number];

export const EMAIL_TEMPLATE_SPACING_MIN_PX = 0;
export const EMAIL_TEMPLATE_SPACING_MAX_PX = 64;

/**
 * Sparse presentation overrides shared by order and quote templates.
 * Missing values deliberately retain each renderer's legacy spacing.
 */
export type EmailTemplatePresentation = {
  verticalSpacingPx?: number;
  blockSpacingPx?: Partial<Record<EmailTemplateBlockId, number>>;
};

export type EmailTemplateRenderOptions = Readonly<{
  editorPreview?: boolean;
}>;

type UnknownRecord = Record<string, unknown>;

const blockIds = new Set<string>(EMAIL_TEMPLATE_BLOCK_IDS);

function record(value: unknown): UnknownRecord {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as UnknownRecord
    : {};
}

function normalizeSpacingPx(value: unknown): number | undefined {
  if (typeof value !== 'number' || !Number.isFinite(value)) return undefined;
  return Math.min(
    EMAIL_TEMPLATE_SPACING_MAX_PX,
    Math.max(EMAIL_TEMPLATE_SPACING_MIN_PX, Math.round(value))
  );
}

export function normalizeEmailTemplatePresentation(
  value: unknown
): EmailTemplatePresentation | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return undefined;
  }
  const source = value as UnknownRecord;
  const verticalSpacingPx = normalizeSpacingPx(source.verticalSpacingPx);
  const rawBlockSpacing = record(source.blockSpacingPx);
  const blockSpacingEntries = EMAIL_TEMPLATE_BLOCK_IDS.flatMap((blockId) => {
    const spacing = normalizeSpacingPx(rawBlockSpacing[blockId]);
    return spacing === undefined ? [] : [[blockId, spacing] as const];
  });
  const blockSpacingPx = blockSpacingEntries.length > 0
    ? Object.fromEntries(blockSpacingEntries) as Partial<
        Record<EmailTemplateBlockId, number>
      >
    : undefined;

  if (verticalSpacingPx === undefined && !blockSpacingPx) return undefined;
  return {
    ...(verticalSpacingPx === undefined ? {} : { verticalSpacingPx }),
    ...(blockSpacingPx ? { blockSpacingPx } : {})
  };
}

export function cloneEmailTemplatePresentation(
  value: EmailTemplatePresentation | undefined
): EmailTemplatePresentation | undefined {
  if (!value) return undefined;
  return {
    ...(value.verticalSpacingPx === undefined
      ? {}
      : { verticalSpacingPx: value.verticalSpacingPx }),
    ...(value.blockSpacingPx
      ? { blockSpacingPx: { ...value.blockSpacingPx } }
      : {})
  };
}

export function validateEmailTemplatePresentation(value: unknown): string[] {
  if (value === undefined) return [];
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return ['presentation must be an object'];
  }
  const source = value as UnknownRecord;
  const errors: string[] = [];
  if (source.verticalSpacingPx !== undefined) {
    const spacing = source.verticalSpacingPx;
    if (
      typeof spacing !== 'number' ||
      !Number.isSafeInteger(spacing) ||
      spacing < EMAIL_TEMPLATE_SPACING_MIN_PX ||
      spacing > EMAIL_TEMPLATE_SPACING_MAX_PX
    ) {
      errors.push(
        `verticalSpacingPx must be an integer from ${EMAIL_TEMPLATE_SPACING_MIN_PX} to ${EMAIL_TEMPLATE_SPACING_MAX_PX}`
      );
    }
  }
  if (source.blockSpacingPx !== undefined) {
    if (
      !source.blockSpacingPx ||
      typeof source.blockSpacingPx !== 'object' ||
      Array.isArray(source.blockSpacingPx)
    ) {
      errors.push('blockSpacingPx must be an object');
    } else {
      for (const [blockId, spacing] of Object.entries(source.blockSpacingPx)) {
        if (!blockIds.has(blockId)) {
          errors.push(`blockSpacingPx.${blockId} is not a supported block`);
          continue;
        }
        if (
          typeof spacing !== 'number' ||
          !Number.isSafeInteger(spacing) ||
          spacing < EMAIL_TEMPLATE_SPACING_MIN_PX ||
          spacing > EMAIL_TEMPLATE_SPACING_MAX_PX
        ) {
          errors.push(
            `blockSpacingPx.${blockId} must be an integer from ${EMAIL_TEMPLATE_SPACING_MIN_PX} to ${EMAIL_TEMPLATE_SPACING_MAX_PX}`
          );
        }
      }
    }
  }
  return errors;
}

export function hasEmailTemplateSpacingOverride(
  presentation: EmailTemplatePresentation | undefined,
  blockId: EmailTemplateBlockId
): boolean {
  return (
    presentation?.blockSpacingPx?.[blockId] !== undefined ||
    presentation?.verticalSpacingPx !== undefined
  );
}

export function resolveEmailTemplateSpacingPx(
  presentation: EmailTemplatePresentation | undefined,
  blockId: EmailTemplateBlockId,
  legacyDefaultPx: number
): number {
  const blockSpacing = normalizeSpacingPx(
    presentation?.blockSpacingPx?.[blockId]
  );
  const verticalSpacing = normalizeSpacingPx(
    presentation?.verticalSpacingPx
  );
  return blockSpacing ??
    verticalSpacing ??
    normalizeSpacingPx(legacyDefaultPx) ??
    EMAIL_TEMPLATE_SPACING_MIN_PX;
}

export function emailTemplateEditorAttribute(
  options: EmailTemplateRenderOptions | undefined,
  blockId: EmailTemplateBlockId
): string {
  return options?.editorPreview
    ? ` data-email-editor-id="${blockId}"`
    : '';
}
