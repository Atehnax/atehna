import type { CatalogItemEditorPayload } from '@/shared/server/catalogItems';

export async function saveCatalogItemPayload(payload: CatalogItemEditorPayload): Promise<{ slug?: string; message?: string }> {
  const saveResponse = await fetch('/api/admin/artikli', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload)
  });
  const body = (await saveResponse.json().catch(() => ({}))) as { slug?: string; message?: string };
  if (!saveResponse.ok) {
    throw new Error(body.message || 'Shranjevanje artikla ni uspelo.');
  }
  return body;
}
