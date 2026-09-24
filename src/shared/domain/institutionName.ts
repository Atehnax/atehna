/** Abbreviate only the complete Slovenian phrase, leaving the institution's name intact. */
export function normalizeInstitutionName(name: string): string {
  return name.replace(/(?<![\p{L}\p{N}_])osnovna[\t \u00a0]+šola(?![\p{L}\p{N}_])/giu, 'OŠ');
}
