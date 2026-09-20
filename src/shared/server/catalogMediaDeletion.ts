import type { PoolClient } from 'pg';

/** Detach in the save transaction; the storage lifecycle rechecks all references before deleting bytes. */
export async function queueRemovedCatalogMediaFiles(
  client: PoolClient,
  itemId: number,
  previousMedia: Array<Record<string, unknown>>
): Promise<void> {
  const candidates = previousMedia.flatMap((media) => {
    if (media.source_kind !== 'upload') return [];
    const pathname = typeof media.blob_pathname === 'string' ? media.blob_pathname.trim() : '';
    const url = typeof media.blob_url === 'string' ? media.blob_url.trim() : '';
    // Public repository assets and remote suppliers' files are never ours to delete.
    const target = pathname || (/^https:\/\/[^/]+\.blob\.vercel-storage\.com\//i.test(url) ? url : '');
    return target ? [{ target, pathname, url }] : [];
  });
  if (candidates.length === 0) return;
  await client.query(
    `
    insert into archive_blob_deletion_outbox (blob_target, source_item_type, source_product_id)
    select distinct candidate.target, 'product_media', $1::bigint
    from jsonb_to_recordset($2::jsonb) as candidate(target text, pathname text, url text)
    where not exists (
      select 1 from catalog_media retained
      where nullif(retained.blob_pathname, '') = nullif(candidate.pathname, '')
         or nullif(retained.blob_url, '') = nullif(candidate.url, '')
         or nullif(retained.external_url, '') = nullif(candidate.url, '')
         or nullif(retained.image_dimensions ->> 'originalUrl', '') = nullif(candidate.url, '')
    )
    on conflict (blob_target) do nothing
    `,
    [itemId, JSON.stringify(candidates)]
  );
}
