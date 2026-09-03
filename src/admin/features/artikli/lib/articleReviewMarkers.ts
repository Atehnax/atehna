export const ADMIN_ARTICLE_REVIEW_MARKERS_STORAGE_KEY = 'atehna:admin:artikli:reviewed:v1';

export function parseAdminArticleReviewMarkers(value: string | null): Set<string> {
  if (!value) return new Set();

  try {
    const parsed: unknown = JSON.parse(value);
    if (!Array.isArray(parsed)) return new Set();

    return new Set(
      parsed.filter(
        (entry): entry is string => typeof entry === 'string' && entry.trim().length > 0
      )
    );
  } catch {
    return new Set();
  }
}

export function serializeAdminArticleReviewMarkers(ids: ReadonlySet<string>): string {
  return JSON.stringify(Array.from(ids).sort());
}

export function setAdminArticleReviewMarker(
  current: ReadonlySet<string>,
  familyId: string,
  reviewed: boolean
): Set<string> {
  const next = new Set(current);

  if (reviewed) {
    next.add(familyId);
  } else {
    next.delete(familyId);
  }

  return next;
}
