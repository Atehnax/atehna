begin;

delete from catalog_items
where slug in ('aluminijasta-plosca', 'bakrena-plosca', 'jeklena-merilna-letvica');

insert into catalog_items (
  id,
  item_name,
  item_type,
  status,
  category_id,
  sku,
  slug,
  unit,
  brand,
  material,
  colour,
  shape,
  description,
  position,
  tax_rate
) values
  (
    910001,
    'Aluminijasta plošča',
    'sheet',
    'active',
    '424579b4-afc9-49d0-890b-850f2e96b9fc',
    'MAT-KOV-ALU',
    'aluminijasta-plosca',
    'kos',
    'Atehna',
    'Aluminij EN AW-1050A',
    'Naravna srebrna',
    'Pravokotna plošča',
    '<p>Aluminijasta plošča za tehnični pouk, modelarstvo in delavniško izdelavo manjših sestavnih delov. Material je lahek in odporen proti koroziji, izbrana različica pa določa debelino, dimenzije, ceno, zalogo in tehnične podatke.</p>',
    0,
    0.2200
  ),
  (
    910002,
    'Bakrena plošča',
    'sheet',
    'active',
    '424579b4-afc9-49d0-890b-850f2e96b9fc',
    'MAT-KOV-BAK',
    'bakrena-plosca',
    'kos',
    'Atehna',
    'Baker Cu-DHP',
    'Bakrena',
    'Pravokotna plošča',
    '<p>Bakrena plošča za oblikovanje, preizkuse prevodnosti in tehnične projekte.</p>',
    1,
    0.2200
  ),
  (
    910003,
    'Jeklena merilna letvica',
    'unit',
    'active',
    '49f023be-9fac-4a75-8d8f-8cfe7ff79c6e',
    'MAT-LET-JEK',
    'jeklena-merilna-letvica',
    'kos',
    'Atehna',
    'Nerjavno jeklo',
    'Srebrna',
    'Merilna letvica',
    '<p>Jeklena merilna letvica za tehnični pouk in delavniške meritve.</p>',
    0,
    0.2200
  );

insert into catalog_item_variants (
  id,
  item_id,
  variant_name,
  length,
  width,
  thickness,
  weight,
  error_tolerance,
  price,
  cost_net,
  content_override_json,
  discount_pct,
  inventory,
  min_order,
  variant_sku,
  unit,
  status,
  position
) values
  (
    920001,
    910001,
    '100 × 100 × 0,5 mm',
    100,
    100,
    0.5,
    0.014,
    '±0,2 mm',
    4.90,
    2.10,
    '{"specifications":{"Površina":"Gladko valjana","Trdota":"H14"},"attributes":{"Uporaba":"Modelarstvo"},"deliveryEstimate":"2–4 delovne dni"}'::jsonb,
    0,
    100,
    1,
    'MAT-KOV-ALU-100',
    'kos',
    'active',
    0
  ),
  (
    920002,
    910001,
    '200 × 200 × 0,5 mm',
    200,
    200,
    0.5,
    0.054,
    '±0,2 mm',
    8.90,
    4.20,
    '{"specifications":{"Površina":"Gladko valjana","Trdota":"H14"},"attributes":{"Uporaba":"Tehnični pouk"},"deliveryEstimate":"2–4 delovne dni"}'::jsonb,
    5,
    75,
    1,
    'MAT-KOV-ALU-200',
    'kos',
    'active',
    1
  ),
  (
    920003,
    910001,
    '300 × 200 × 1 mm',
    300,
    200,
    1.0,
    0.162,
    '±0,3 mm',
    13.50,
    6.70,
    '{"specifications":{"Površina":"Gladko valjana","Trdota":"H14"},"attributes":{"Uporaba":"Delavniški projekti"},"deliveryEstimate":"2–4 delovne dni"}'::jsonb,
    0,
    40,
    1,
    'MAT-KOV-ALU-300',
    'kos',
    'active',
    2
  ),
  (
    920011,
    910002,
    '100 × 100 × 0,5 mm',
    100,
    100,
    0.5,
    0.045,
    '±0,2 mm',
    6.40,
    3.20,
    '{"specifications":{"Površina":"Surova","Zlitina":"Cu-DHP"},"deliveryEstimate":"2–4 delovne dni"}'::jsonb,
    0,
    60,
    1,
    'MAT-KOV-BAK-100',
    'kos',
    'active',
    0
  ),
  (
    920021,
    910003,
    '300 mm',
    null,
    null,
    null,
    0.075,
    '±0,5 mm',
    9.90,
    4.20,
    '{"deliveryEstimate":"2–4 delovne dni"}'::jsonb,
    0,
    80,
    1,
    'MAT-LET-JEK-300',
    'kos',
    'active',
    0
  );

update catalog_items set default_variant_id = 920001 where id = 910001;
update catalog_items set default_variant_id = 920011 where id = 910002;
update catalog_items set default_variant_id = 920021 where id = 910003;

insert into catalog_item_editor_details (item_id, product_type, data)
values
  (
    910001,
    'dimensions',
    '{"dimensions":{"defaultDeliveryTime":"2–4 delovne dni"}}'::jsonb
  ),
  (
    910002,
    'dimensions',
    '{"dimensions":{"defaultDeliveryTime":"2–4 delovne dni"}}'::jsonb
  ),
  (
    910003,
    'simple',
    '{}'::jsonb
  );

insert into catalog_media (
  id,
  item_id,
  media_kind,
  role,
  source_kind,
  filename,
  blob_url,
  mime_type,
  alt_text,
  image_type,
  image_dimensions,
  hidden,
  position
) values
  (
    930001,
    910001,
    'image',
    'gallery',
    'upload',
    'aluminijasta-plosca.png',
    '/images/categories/materiali.png',
    'image/png',
    'Aluminijasta plošča od spredaj',
    'product',
    '{"width":1200,"height":900}'::jsonb,
    false,
    0
  ),
  (
    930002,
    910001,
    'image',
    'gallery',
    'upload',
    'aluminijasta-plosca-detajl.webp',
    '/images/categories/materiali.webp',
    'image/webp',
    'Detajl površine aluminijaste plošče',
    'detail',
    '{"width":1200,"height":900}'::jsonb,
    false,
    1
  ),
  (
    930011,
    910002,
    'image',
    'gallery',
    'upload',
    'bakrena-plosca.png',
    '/images/categories/tehnika-in-tehnologija.png',
    'image/png',
    'Bakrena plošča',
    'product',
    '{"width":1200,"height":900}'::jsonb,
    false,
    0
  ),
  (
    930021,
    910003,
    'image',
    'gallery',
    'upload',
    'jeklena-merilna-letvica.png',
    '/images/categories/materiali.png',
    'image/png',
    'Jeklena merilna letvica',
    'product',
    '{"width":1200,"height":900}'::jsonb,
    false,
    0
  );

insert into catalog_item_quantity_discounts (
  item_id,
  min_quantity,
  discount_percent,
  applies_to,
  note,
  position
) values
  (910001, 10, 5, 'allVariants', 'E2E količinski popust', 0),
  (910001, 25, 10, 'allVariants', 'E2E količinski popust', 1);

insert into product_appearance_settings (key, config_json)
values ('website-product-appearance', '{}'::jsonb)
on conflict (key) do update set config_json = excluded.config_json, updated_at = now();

insert into global_style_settings (key, config_json)
values ('website-global-style', '{}'::jsonb)
on conflict (key) do update set config_json = excluded.config_json, updated_at = now();

insert into site_navigation_settings (key, config_json)
values ('main-navbar', '{}'::jsonb)
on conflict (key) do update set config_json = excluded.config_json, updated_at = now();

insert into landing_page_settings (key, config_json)
values
  ('main-landing-page', '{}'::jsonb),
  ('main-landing-page-defaults', '{}'::jsonb)
on conflict (key) do update set config_json = excluded.config_json, updated_at = now();

insert into site_logo_settings (key, config_json)
values ('website-site-logo', '{}'::jsonb)
on conflict (key) do update set config_json = excluded.config_json, updated_at = now();

commit;
