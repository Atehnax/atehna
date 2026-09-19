-- Read-only product/supplier identities for families with no visible product photographs.
-- Supplier rows have no separate manufacturer-code field; known codes are extracted only from named variant specifications.
begin isolation level repeatable read read only;
with empty_families as (
  select item.id, item.slug, item.item_name, item.brand, item.sku
  from catalog_items item
  where item.status <> 'deleted'
    and not exists (
      select 1 from catalog_media image
      where image.item_id = item.id and image.media_kind = 'image' and image.role = 'gallery' and not image.hidden
        and coalesce(image.image_type, '') !~* 'diagram|schem|technical|drawing|dimension|sketch|blueprint'
        and coalesce(nullif(image.blob_url, ''), image.external_url, '') !~* '\.svg([?#]|$)'
    )
)
select family.id::text as item_id, family.slug, family.item_name, family.brand, family.sku as item_sku,
       variant.id::text as variant_id, variant.variant_sku, variant.variant_name,
       supplier.id as supplier_row_id,
       nullif(supplier.cells ->> 'dobavitelj', '') as supplier_name,
       substring(supplier.cells ->> 'spletna-stran' from '^(?:https?://)?([^/@[:space:]]+)(?:/|$)') as supplier_hostname,
       identity_fields.codes as recorded_identity_fields
from empty_families family
left join catalog_item_variants variant on variant.item_id = family.id
left join catalog_supplier_rows supplier on supplier.catalog_item_id = family.id
left join lateral (
  select jsonb_object_agg(entry.key, entry.value) as codes
  from jsonb_each(case when jsonb_typeof(variant.content_override_json -> 'specifications') = 'object'
                      then variant.content_override_json -> 'specifications' else '{}'::jsonb end) entry
  where lower(entry.key) in ('model', 'proizvajalec', 'znamka', 'ean', 'gtin', 'mpn',
        'šifra proizvajalca', 'sifra proizvajalca', 'koda proizvajalca',
        'šifra dobavitelja', 'sifra dobavitelja', 'koda dobavitelja', 'supplier sku', 'manufacturer code')
    and jsonb_typeof(entry.value) in ('string', 'number')
) identity_fields on true
order by family.slug, variant.position, variant.id, supplier.position, supplier.id;
rollback;
