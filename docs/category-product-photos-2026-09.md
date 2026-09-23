# Category product photographs — 23 September 2026

Six category image assignments were updated in the local catalog through `/api/admin/categories/images`. `materiali` and `stroji-in-naprave` retain their original image, presentation and revision. No product records, prices, specifications or statuses were changed.

The source and replacement manifest is `data/catalog/category-product-photos-2026-09.json`. Five images reuse already deployed, reviewed product photographs; the apron JPEG is a new unchanged ATEHNA source. Its native 500 × 500 resolution is recorded as a category-card limitation, not a high-resolution product-gallery upgrade. The cubes are a representative construction/learning product currently classified under measuring tools; this update does not reclassify them.

All six images and category presentation settings were independently read back after saving. Desktop homepage and admin category previews show the six replacements. Mobile homepage verification covers its four visible replacements; the existing mobile visibility settings hide the safety and spare-parts categories. Layout and visibility settings were not changed. All displayed replacement images decoded successfully, and full product outlines were reviewed.

## Publication and rollback

Publishing the asset and manifest files does not itself update the production database. Publish the new apron asset, then apply only the six manifest entries through the authenticated category-image PATCH API, using each category's fresh revision and first confirming its current image/presentation still matches `previous`. A guarded administrative database release may use the same canonical mutation and revision checks when no production admin browser session is available: verify deployed asset hashes, retain before/after receipts, and prove all non-target category fields are unchanged. The API performs cache invalidation; a database release must explicitly invalidate the `category-showcase` cache tag through Vercel. Verify the production homepage and independently read back the stored category records afterwards.

For rollback, apply each entry's `previous.image` and `previous.presentation` through the same API with fresh revisions. All replaced image files remain intact.
