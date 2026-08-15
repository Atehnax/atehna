begin;

-- Replace the development placeholder description with real catalogue copy.
-- The guard keeps authored descriptions untouched in existing installations.
update catalog_items
set
  description = '<p>Aluminijasta plošča za tehnični pouk, modelarstvo in delavniško izdelavo manjših sestavnih delov. Material je lahek in odporen proti koroziji, izbrana različica pa določa debelino, dimenzije, ceno, zalogo in tehnične podatke.</p>',
  updated_at = now()
where slug = 'aluminijasta-plosca'
  and lower(trim(regexp_replace(description, '<[^>]+>', '', 'g')))
    = lower(trim(item_name));

update global_style_settings
set
  config_json = config_json
    || jsonb_build_object(
      'colors',
      coalesce(config_json -> 'colors', '{}'::jsonb) || jsonb_build_object(
        'pageBackground', '#F8FAFC',
        'surface', '#FFFFFF',
        'text', '#0F172A',
        'textMuted', '#64748B',
        'primary', '#0788CF',
        'primaryHover', '#067BBB',
        'primaryActive', '#056CA5',
        'accent', '#94633F',
        'success', '#079669',
        'info', '#0788CF'
      )
    )
    || jsonb_build_object(
      'borders',
      coalesce(config_json -> 'borders', '{}'::jsonb) || jsonb_build_object(
        'color', '#D7DDE3',
        'dividerColor', '#E5E7EB'
      )
    )
    || jsonb_build_object(
      'forms',
      coalesce(config_json -> 'forms', '{}'::jsonb) || jsonb_build_object(
        'focusColor', '#0788CF'
      )
    )
    || jsonb_build_object(
      'links',
      coalesce(config_json -> 'links', '{}'::jsonb) || jsonb_build_object(
        'color', '#0788CF',
        'hoverColor', '#067BBB',
        'activeColor', '#056CA5'
      )
    ),
  updated_at = now()
where key = 'website-global-style';

update product_appearance_settings
set
  config_json = config_json
    || jsonb_build_object(
      'productPage',
      coalesce(config_json -> 'productPage', '{}'::jsonb) || jsonb_build_object(
        'contentMaxWidthPx', 1500,
        'columnGapPx', 44
      )
    )
    || jsonb_build_object(
      'gallery',
      coalesce(config_json -> 'gallery', '{}'::jsonb) || jsonb_build_object(
        'thumbnailSizePx', 70,
        'thumbnailGapPx', 16
      )
    )
    || jsonb_build_object(
      'relatedProducts',
      coalesce(config_json -> 'relatedProducts', '{}'::jsonb) || jsonb_build_object(
        'maxItems', 4,
        'desktopColumns', 4,
        'tabletColumns', 2,
        'mobileColumns', 1,
        'gapPx', 24,
        'imageHeightPx', 188
      )
    ),
  updated_at = now()
where key = 'website-product-appearance';

commit;
