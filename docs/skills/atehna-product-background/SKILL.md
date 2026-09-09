---
name: atehna-product-background
description: Standardize ATEHNA catalog product photos on the shared pure-white studio background. Use when preparing or improving product image assets for Artikli; does not change website backgrounds, layouts, or product specifications.
---

# ATEHNA product background

Prepare catalog product images with this shared studio treatment. User-specified exceptions, reference requirements, and source-only choices take precedence.

## Visual standard

- Seamless, solid pure white (`#FFFFFF`) background. No paper texture, gray cast, colored tint, gradient, horizon, border, props, or added text.
- Square canvas, at least 1024 × 1024 pixels when source quality permits. Center the full product; keep approximately 8% clear margin on all sides. Aim for about 80% of canvas width, adjusting for tall or narrow products so no part is clipped.
- Soft neutral studio lighting and a subtle neutral contact shadow immediately beneath the object. Avoid floating objects, dramatic shadows, and artificial reflections.
- Preserve the real product: silhouette, proportions, material texture, color, part count, included accessories, angle, brand, model, labels, warning symbols, and legible packaging text. Change the background and slight framing only. Do not infer missing specifications or invent safety marks, certifications, packaging, or components.

## Workflow

Inspect the source photo. Prefer an existing sharp product photo that already meets the standard. For a local edit target, inspect with `view_image` before using the built-in `image_gen` image-editing tool. Provide `referenced_image_paths` when all targets have local paths; use `num_last_images_to_include` only when a target has no local file path. Use one call per product asset or variant. Follow the installed imagegen skill for the current tool's operating requirements.

Use this edit prompt, replacing the braces with facts visible in the source:

```text
Use case: precise-object-edit.
Asset type: ATEHNA ecommerce catalog product photo.
Input image: edit target showing {product and visible identifying details}.
Primary request: replace only the background with seamless pure white #FFFFFF. Preserve the exact product, material texture, colors, geometry, count, accessories, logos, model, labels and readable packaging text. Keep the original product angle.
Composition: square canvas, centered complete product, approximately 8% clear white margin on all sides; about 80% width when the product shape allows. Do not crop or stretch the product.
Lighting: neutral soft studio light, very subtle neutral contact shadow immediately beneath the object.
Avoid: texture, gradient, horizon, tint, border, props, extra objects, added text or watermark; no redesigned product or invented details.
```

For a truly missing generic material photo, a newly generated representative image may be appropriate when the user allows generation. Record that it is illustrative. Do not fabricate an exact branded model from text or substitute an unrelated product. A background edit cannot recover reliable lettering or technical details from a blurry source; prefer a better photo of the verified product.

Inspect the result for product drift, altered labels, cropped parts, halos, background color, and edge quality. Rework a failed result or keep the best authorized source with a clear note. A filesystem or generation failure does not mean the image was standardized. Do not switch to a paid API/CLI fallback unless the user has authorized that path.

## Save and record

Copy selected generated output into the current project, retaining the source. For the ATEHNA repository, use `public/images/catalog/YYYY-MM/` and lowercase ASCII Slovenian names, for example `aluminijasta-plosca-kvadrat.png`, `bakrena-plosca-kvadrat.png`, or `pocinkana-plocevina-pravokotnik.png`. Use a version suffix when replacement was not requested. Keep square and rectangular sheet silhouettes distinct; a square representative image may serve multiple square dimensions without implying a specific size.

Record the source path/URL, exact edit prompt, final asset path, and whether it is an original, an edited original, or a generated illustration in the catalog import notes. Update product image references only within the user's catalog task. Do not change product prices, stock, specifications, or unrelated site UI as part of this skill.