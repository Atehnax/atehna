import { cloneDeep } from '@pdfme/common';
import type { BlankPdf, Schema, Template } from '@pdfme/common';

import type {
  AtehnaPdfmeSchema,
  PdfmeV2CanonicalTemplate
} from './template';

function isBlankBasePdf(basePdf: Template['basePdf']): basePdf is BlankPdf {
  return typeof basePdf === 'object'
    && basePdf !== null
    && !ArrayBuffer.isView(basePdf)
    && !(basePdf instanceof ArrayBuffer)
    && 'width' in basePdf
    && 'height' in basePdf
    && 'padding' in basePdf;
}

export function getPdfmeV2RepeatingSchemaIds(
  canonical: PdfmeV2CanonicalTemplate
): ReadonlySet<string> {
  return new Set([
    ...canonical.envelope.repeating.header,
    ...canonical.envelope.repeating.footer
  ]);
}

/**
 * Produces an ephemeral render clone. Header/footer schemas keep their exact
 * authored geometry and styling, but move below ordinary content because
 * pdfme renders basePdf.staticSchema first. The canonical input is untouched.
 */
export function compilePdfmeV2Template(
  canonical: PdfmeV2CanonicalTemplate
): Template {
  const compiled = cloneDeep(canonical.template) as Template;
  if (!isBlankBasePdf(compiled.basePdf)) {
    throw new TypeError('pdfme v2 compilation requires a blank object basePdf.');
  }

  const repeatingIds = getPdfmeV2RepeatingSchemaIds(canonical);
  const firstPage = (compiled.schemas[0] ?? []) as AtehnaPdfmeSchema[];
  const staticSchemas: Schema[] = [];
  const ordinarySchemas: Schema[] = [];

  for (const schema of firstPage) {
    if (repeatingIds.has(schema.atehnaId)) staticSchemas.push(schema);
    else ordinarySchemas.push(schema);
  }

  compiled.schemas = [ordinarySchemas, ...compiled.schemas.slice(1)];
  compiled.basePdf.staticSchema = [
    ...(compiled.basePdf.staticSchema ?? []),
    ...staticSchemas
  ];
  return compiled;
}

export const compilePdfmeV2TemplateForRender = compilePdfmeV2Template;
