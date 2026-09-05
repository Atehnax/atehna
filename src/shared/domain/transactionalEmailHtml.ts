export const TRANSACTIONAL_EMAIL_FONT_FAMILY = 'Arial,Helvetica,sans-serif';

/**
 * Email clients do not consistently inherit typography through nested tables.
 * Keep the stack inline wherever a renderer creates a text-bearing table/cell.
 */
export function transactionalEmailStyle(declarations = ''): string {
  return `font-family:${TRANSACTIONAL_EMAIL_FONT_FAMILY};${declarations}`;
}

export const TRANSACTIONAL_EMAIL_BODY_STYLE = transactionalEmailStyle(
  'margin:0;background:#f1f5f9;padding:24px;color:#0f172a;font-size:16px;line-height:24px;'
);

export const TRANSACTIONAL_EMAIL_CARD_STYLE = transactionalEmailStyle(
  'max-width:680px;margin:0 auto;border:1px solid #dbe4ee;border-radius:12px;background:#ffffff;padding:28px;color:#0f172a;font-size:16px;line-height:24px;font-weight:400;'
);

export const TRANSACTIONAL_EMAIL_COPY_STYLE = transactionalEmailStyle(
  'font-size:16px;line-height:26px;font-weight:400;'
);

export const TRANSACTIONAL_EMAIL_HEADING_STYLE = transactionalEmailStyle(
  'font-size:24px;line-height:31px;font-weight:700;color:#0f172a;'
);

export const TRANSACTIONAL_EMAIL_META_STYLE = transactionalEmailStyle(
  'font-size:14px;line-height:21px;font-weight:400;'
);

export const TRANSACTIONAL_EMAIL_SMALL_STYLE = transactionalEmailStyle(
  'font-size:12px;line-height:18px;font-weight:400;'
);

export const TRANSACTIONAL_EMAIL_TABLE_STYLE = transactionalEmailStyle(
  'font-size:16px;line-height:24px;font-weight:400;color:#0f172a;'
);

export const TRANSACTIONAL_EMAIL_BUTTON_STYLE = transactionalEmailStyle(
  'font-size:16px;line-height:24px;font-weight:600;'
);
