import type { CatalogItemEditorPayload, CatalogItemSaveResponse } from '@/shared/domain/catalog/catalogAdminTypes';

export async function saveCatalogItemPayload(payload: CatalogItemEditorPayload): Promise<CatalogItemSaveResponse> {
  const saveResponse = await fetch('/api/admin/artikli', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload)
  });
  const body = (await saveResponse.json().catch(() => ({}))) as CatalogItemSaveResponse;
  if (!saveResponse.ok) {
    throw new Error(body.message || 'Shranjevanje artikla ni uspelo.');
  }
  return body;
}
