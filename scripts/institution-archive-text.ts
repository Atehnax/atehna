import { createHash } from 'node:crypto';

/** Git may check out repository JSON with CRLF. Fingerprints use UTF-8/LF text only. */
export const INSTITUTION_ARCHIVE_TEXT_ENCODING = 'UTF-8 with LF line endings';
export const normalizeInstitutionArchiveText = (text: string): string => text.replace(/\r\n?/g, '\n');
export const institutionArchiveTextSha256 = (text: string): string =>
  createHash('sha256').update(normalizeInstitutionArchiveText(text), 'utf8').digest('hex');
