import sanitizeHtml from 'sanitize-html';
import {
  TRANSACTIONAL_EMAIL_COPY_STYLE,
  TRANSACTIONAL_EMAIL_HEADING_STYLE,
  transactionalEmailStyle
} from './transactionalEmailHtml';

const SAFE_COLOR = /^(?:#[\da-f]{3,8}|rgba?\([\d\s.,%]+\)|[a-z]+)$/iu;
const SAFE_FONT_FAMILY = /^[\w\s"',.-]+$/u;
const SAFE_FONT_SIZE = /^\d+(?:\.\d+)?(?:px|rem|em|%)$/iu;
const TEMPLATE_VARIABLE_PATTERN = /\{\{\s*([a-z_]+)\s*\}\}/gu;

const allowedTags = [
  'p',
  'br',
  'h1',
  'h2',
  'h3',
  'blockquote',
  'ul',
  'ol',
  'li',
  'strong',
  'b',
  'em',
  'i',
  'u',
  's',
  'mark',
  'span',
  'code',
  'pre',
  'hr',
  'a'
] as const;

const allowedAttributes = {
  a: ['href', 'target', 'rel'],
  p: ['style'],
  h1: ['style'],
  h2: ['style'],
  h3: ['style'],
  blockquote: ['style'],
  ul: ['style'],
  ol: ['style'],
  li: ['style'],
  span: ['style'],
  mark: ['style'],
  code: ['style'],
  pre: ['style']
};

const allowedStyles = {
  '*': {
    color: [SAFE_COLOR],
    'background-color': [SAFE_COLOR],
    'font-family': [SAFE_FONT_FAMILY],
    'font-size': [SAFE_FONT_SIZE],
    'font-weight': [/^(?:normal|bold|[1-9]00)$/u],
    'line-height': [/^(?:\d+(?:\.\d+)?|\d+(?:\.\d+)?(?:px|rem|em|%))$/u],
    margin: [/^(?:auto|0|\d+(?:\.\d+)?(?:px|rem|em|%))(?:\s+(?:auto|0|\d+(?:\.\d+)?(?:px|rem|em|%))){0,3}$/u],
    'padding-left': [/^(?:0|\d+(?:\.\d+)?(?:px|rem|em|%))$/u],
    'border-left': [/^\d+(?:\.\d+)?px\s+solid\s+(?:#[\da-f]{3,8}|[a-z]+)$/iu],
    'white-space': [/^(?:normal|pre|pre-wrap|pre-line)$/u],
    'text-decoration': [/^(?:none|underline|line-through)$/u],
    'text-align': [/^(?:left|center|right|justify)$/u]
  }
};

const safeOptions: sanitizeHtml.IOptions = {
  allowedTags: [...allowedTags],
  allowedAttributes: { ...allowedAttributes },
  allowedSchemes: ['http', 'https', 'mailto', 'tel'],
  allowProtocolRelative: false,
  allowedStyles,
  transformTags: {
    a: (_tagName, attributes) => ({
      tagName: 'a',
      attribs: {
        ...attributes,
        rel: 'noopener noreferrer'
      }
    })
  }
};

export function escapeEmailTemplateHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/gu, '&amp;')
    .replace(/</gu, '&lt;')
    .replace(/>/gu, '&gt;')
    .replace(/"/gu, '&quot;')
    .replace(/'/gu, '&#39;');
}

export function sanitizeEmailTemplateRichText(value: unknown): string {
  if (typeof value !== 'string' || !value.trim()) return '';
  return sanitizeHtml(value, safeOptions).trim();
}

function plainTextBlocks(value: unknown): string {
  return String(value ?? '')
    .replace(/\r\n?/gu, '\n')
    .split(/\n{2,}/gu)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)
    .map(
      (paragraph) =>
        `<p>${escapeEmailTemplateHtml(paragraph).replace(/\n/gu, '<br>')}</p>`
    )
    .join('');
}

export function legacyEmailTemplateContentHtml(input: {
  greeting?: unknown;
  heading?: unknown;
  body?: unknown;
}): string {
  const greeting = String(input.greeting ?? '').trim();
  const heading = String(input.heading ?? '').trim();
  return sanitizeEmailTemplateRichText(
    [
      greeting ? `<p>${escapeEmailTemplateHtml(greeting)}</p>` : '',
      heading ? `<h1>${escapeEmailTemplateHtml(heading)}</h1>` : '',
      plainTextBlocks(input.body)
    ].join('')
  );
}

export function emailTemplateRichTextToPlainText(value: unknown): string {
  const html = sanitizeEmailTemplateRichText(value);
  if (!html) return '';
  const withBreaks = html
    .replace(/<br\s*\/?>/giu, '\n')
    .replace(/<li(?:\s[^>]*)?>/giu, '- ')
    .replace(/<\/(?:p|h[1-3]|blockquote|li|ul|ol|pre)>/giu, '\n');
  const encodedText = sanitizeHtml(withBreaks, {
    allowedTags: [],
    allowedAttributes: {}
  });
  return encodedText
    .replace(/&#(\d+);/gu, (_match, codePoint: string) =>
      String.fromCodePoint(Number.parseInt(codePoint, 10))
    )
    .replace(/&#x([\da-f]+);/giu, (_match, codePoint: string) =>
      String.fromCodePoint(Number.parseInt(codePoint, 16))
    )
    .replace(/&nbsp;/giu, '\u00a0')
    .replace(/&quot;/giu, '"')
    .replace(/&#39;|&apos;/giu, "'")
    .replace(/&lt;/giu, '<')
    .replace(/&gt;/giu, '>')
    .replace(/&amp;/giu, '&')
    .replace(/\u00a0/gu, ' ')
    .replace(/[ \t]+\n/gu, '\n')
    .replace(/\n[ \t]+/gu, '\n')
    .replace(/\n{3,}/gu, '\n\n')
    .trim();
}

const blockStyles: Partial<Record<(typeof allowedTags)[number], string>> = {
  p: `${TRANSACTIONAL_EMAIL_COPY_STYLE}margin:0 0 16px;color:#334155;`,
  h1: `${TRANSACTIONAL_EMAIL_HEADING_STYLE}margin:0 0 10px;`,
  h2: `${transactionalEmailStyle('font-size:20px;line-height:27px;font-weight:700;color:#0f172a;')}margin:18px 0 8px;`,
  h3: `${transactionalEmailStyle('font-size:18px;line-height:25px;font-weight:700;color:#0f172a;')}margin:16px 0 7px;`,
  blockquote: `${TRANSACTIONAL_EMAIL_COPY_STYLE}margin:0 0 16px;border-left:3px solid #cbd5e1;padding-left:14px;color:#475569;`,
  ul: `${TRANSACTIONAL_EMAIL_COPY_STYLE}margin:0 0 16px;padding-left:24px;`,
  ol: `${TRANSACTIONAL_EMAIL_COPY_STYLE}margin:0 0 16px;padding-left:24px;`,
  li: `${TRANSACTIONAL_EMAIL_COPY_STYLE}margin:0 0 6px;`,
  pre: `${transactionalEmailStyle("font-size:14px;line-height:21px;font-weight:400;")}margin:0 0 16px;white-space:pre-wrap;`,
  code: transactionalEmailStyle(),
  a: `${TRANSACTIONAL_EMAIL_COPY_STYLE}color:#2563eb;text-decoration:underline;`
};

function appendDefaultStyle(
  tagName: (typeof allowedTags)[number],
  attributes: Record<string, string>
): Record<string, string> {
  const defaultStyle = blockStyles[tagName];
  if (!defaultStyle) return attributes;
  return {
    ...attributes,
    style: `${defaultStyle}${attributes.style ?? ''}`
  };
}

export function renderEmailTemplateRichText(
  value: unknown,
  variables: Readonly<Record<string, string>>
): { html: string; text: string } {
  const source = typeof value === 'string' ? value : '';
  const interpolated = source
    .replace(
      TEMPLATE_VARIABLE_PATTERN,
      (_match, key: string) => escapeEmailTemplateHtml(variables[key] ?? '')
    )
    // Legacy administrator templates used the customer salutation with an
    // intentionally empty recipient name. Preserve the previous rendering
    // behaviour instead of exposing a doubled comma after migration.
    .replace(/,\s*,/gu, ',');
  const sanitized = sanitizeEmailTemplateRichText(interpolated);
  const transformTags = Object.fromEntries(
    allowedTags.map((tagName) => [
      tagName,
      (_name: string, attributes: Record<string, string>) => ({
        tagName,
        attribs: appendDefaultStyle(tagName, attributes)
      })
    ])
  );
  const html = sanitizeHtml(sanitized, {
    ...safeOptions,
    transformTags: {
      ...transformTags,
      a: (_tagName, attributes) => ({
        tagName: 'a',
        attribs: {
          ...appendDefaultStyle('a', attributes),
          rel: 'noopener noreferrer'
        }
      })
    }
  }).trim();
  return {
    html,
    text: emailTemplateRichTextToPlainText(html)
  };
}

export function emailTemplateVariables(value: unknown): string[] {
  return typeof value === 'string'
    ? Array.from(value.matchAll(TEMPLATE_VARIABLE_PATTERN), (match) =>
        String(match[1] ?? '').trim()
      )
    : [];
}
