import sanitizeHtml from 'sanitize-html';

const SAFE_COLOR = /^(?:#[\da-f]{3,8}|rgba?\([\d\s.,%]+\)|[a-z]+)$/i;
const SAFE_FONT_FAMILY = /^[\w\s"',.-]+$/;
const SAFE_FONT_SIZE = /^\d+(?:\.\d+)?(?:px|rem|em|%)$/i;

export function sanitizeCatalogRichText(value: unknown): string {
  if (typeof value !== 'string' || !value.trim()) return '';

  return sanitizeHtml(value, {
    allowedTags: [
      'p', 'br', 'h1', 'h2', 'h3', 'blockquote', 'ul', 'ol', 'li',
      'strong', 'b', 'em', 'i', 'u', 's', 'mark', 'span', 'code', 'pre',
      'hr', 'a', 'img'
    ],
    allowedAttributes: {
      a: ['href', 'target', 'rel'],
      img: ['src', 'alt', 'title', 'width', 'height'],
      p: ['style'],
      h1: ['style'],
      h2: ['style'],
      h3: ['style'],
      span: ['style'],
      mark: ['style']
    },
    allowedSchemes: ['http', 'https', 'mailto', 'tel'],
    allowProtocolRelative: false,
    allowedStyles: {
      '*': {
        color: [SAFE_COLOR],
        'background-color': [SAFE_COLOR],
        'font-family': [SAFE_FONT_FAMILY],
        'font-size': [SAFE_FONT_SIZE],
        'text-align': [/^(?:left|center|right|justify)$/]
      }
    },
    transformTags: {
      a: (_tagName, attributes) => ({
        tagName: 'a',
        attribs: {
          ...attributes,
          rel: 'noopener noreferrer'
        }
      })
    }
  }).trim();
}

export function escapeCatalogRichText(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function plainTextToCatalogRichText(value: string): string {
  const paragraphs = value
    .replace(/\r\n?/g, '\n')
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)
    .map((paragraph) => `<p>${escapeCatalogRichText(paragraph).replace(/\n/g, '<br>')}</p>`);

  return paragraphs.join('');
}
