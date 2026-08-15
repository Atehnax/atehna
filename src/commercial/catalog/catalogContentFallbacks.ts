const catalogueDescriptionFallbacks: Record<string, string> = {
  'aluminijasta-plosca':
    'Aluminijasta plošča za tehnični pouk, modelarstvo in delavniško izdelavo manjših sestavnih delov. Material je lahek in odporen proti koroziji, izbrana različica pa določa debelino, dimenzije, ceno, zalogo in tehnične podatke.'
};

const normalizeComparisonText = (value: string) =>
  value.replace(/\s+/g, ' ').trim().toLocaleLowerCase('sl');

/**
 * Supplies catalogue copy only when a development record still contains the
 * item title as its entire description. Authored database content always wins.
 */
export function resolveCatalogueDescription({
  slug,
  name,
  description
}: {
  slug: string;
  name: string;
  description: string;
}) {
  if (
    description &&
    normalizeComparisonText(description) !== normalizeComparisonText(name)
  ) {
    return description;
  }
  return catalogueDescriptionFallbacks[slug] ?? description;
}
