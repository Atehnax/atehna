import type { Plugins } from '@pdfme/common';
import {
  ellipse,
  image,
  line,
  list,
  multiVariableText,
  rectangle,
  svg,
  table,
  text
} from '@pdfme/schemas';

import { extendPluginWithBatchProperties } from './batchProperties';

export const PDFME_V2_PLUGIN_TYPES = [
  'text',
  'multiVariableText',
  'image',
  'svg',
  'line',
  'rectangle',
  'ellipse',
  'table',
  'list'
] as const;

export type PdfmeV2PluginType = (typeof PDFME_V2_PLUGIN_TYPES)[number];

/** The one explicit registry shared unchanged by Designer and generator. */
export const PDFME_V2_PLUGINS: Plugins = Object.freeze({
  text: extendPluginWithBatchProperties(text),
  multiVariableText: extendPluginWithBatchProperties(multiVariableText),
  image: extendPluginWithBatchProperties(image),
  svg: extendPluginWithBatchProperties(svg),
  line: extendPluginWithBatchProperties(line),
  rectangle: extendPluginWithBatchProperties(rectangle),
  ellipse: extendPluginWithBatchProperties(ellipse),
  table: extendPluginWithBatchProperties(table),
  list: extendPluginWithBatchProperties(list)
});
