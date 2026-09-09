# Product image import — 2026-09-09

## Selected assets

The user chose **Keep the best available source images** after the built-in image editor could not read local files because of a Windows sandbox initialization error (`helper_unknown_error: apply deny-read ACLs`). The seven supplied PNGs were copied without image edits. Their original lightly textured off-white backgrounds remain. They must not be described as standardized white-background images.

Source directory: `C:/Users/wfqfw/Desktop/UI ideas/materiali/`.
Final asset directory: `public/images/catalog/2026-09/`.

| Source filename | Selected asset filename | Status |
| --- | --- | --- |
| aluminij_200_200_05.png | aluminijasta-plosca-kvadrat.png | Supplied original |
| aluminij_300_200_05.png | aluminijasta-plosca-pravokotnik.png | Supplied original |
| baker_200_200_05.png | bakrena-plosca-kvadrat.png | Supplied original |
| medenina_200_200_05.png | medeninasta-plosca-kvadrat.png | Supplied original |
| medenina_300_200_05.png | medeninasta-plosca-pravokotnik.png | Supplied original |
| pocinkana_plocevina_200_200_05.png | pocinkana-plocevina-kvadrat.png | Supplied original |
| pocinkana_plocevina_300_200_05.png | pocinkana-plocevina-pravokotnik.png | Supplied original |

The square image is a representative material photo for square dimension variants, not a scale drawing. Copper has only the supplied square image; no rectangular copper photo is claimed. Product size and thickness belong in catalog variant data rather than overlaid image text.

## Reusable skill

Installed discoverable skill: `C:/Users/wfqfw/.codex/skills/atehna-product-background/SKILL.md`.
Repository copy: [atehna-product-background](../skills/atehna-product-background/SKILL.md).
Invoke as `$atehna-product-background` for future product-photo preparation.

The standard is a seamless pure-white `#FFFFFF` background, square canvas, centered complete product, approximately 8% clear margins and a subtle neutral contact shadow. The skill preserves product identity, accurate labels, materials, shape and count, and does not change website styling or product specifications. Current source assets are explicitly exempt from this edit pass following the user's source-only choice.

## Attempted background edit

Built-in tool: `image_gen`.
Target: `C:/Users/wfqfw/Desktop/UI ideas/materiali/aluminij_200_200_05.png`.
Result: failed while opening the reference image; no edited asset was produced.

Exact submitted prompt:

```text
Use case: precise-object-edit. Asset type: ATEHNA ecommerce product photograph. Input image is the edit target. Replace only the textured off-white background with a seamless, pure white (#FFFFFF) studio background and a very soft neutral contact shadow immediately beneath the product. Preserve exactly the three fanned thin square aluminum sheets: brushed silver metal texture, natural highlights, thin edges, count, angle, proportions and arrangement. Keep the entire product visible and centered on a square 1024x1024 canvas with at least 7% clear white margin around its silhouette; product should occupy approximately 80% of canvas width. Neutral color balance, sharp realistic detail. Do not add a gradient, horizon, props, logos, labels, borders, watermark, text or extra plates. Change only the background, natural contact shadow and slight recentering; do not redesign or beautify the product.
```

## Unselected generation test

One already-running built-in generation test completed just before the user's source-only choice arrived. This was a new representative aluminum illustration, not an edit of a supplied photo, and is **not selected or referenced by the catalog**. No additional generation or API fallback was attempted after the user's choice.

Output left at the tool's original location:
`C:/Users/wfqfw/.codex/generated_images/01a08700-d9af-7eb1-ae79-509e1bbddc85/exec-9cbc13cc-cd48-4262-bf54-550cc908d633.png`.

Exact submitted prompt:

```text
Use case: product-mockup. Asset type: ATEHNA ecommerce catalog material image. Create a new photorealistic studio product photograph of exactly three thin square aluminum sheets, 0.5 mm thickness, fanned in a neat shallow overlapping stack. Each individual sheet is truly square, viewed at a gentle three-quarter top-down angle; realistic brushed silver aluminum with fine directional texture, natural neutral highlights, straight clean edges and visibly thin sheet thickness. Scene/backdrop: seamless pure white #FFFFFF with no texture, gradient or horizon; a very soft neutral contact shadow only immediately beneath the sheets. Square 1024x1024 canvas; center the complete stack with at least 8% white margin on all sides, product about 80% of canvas width. Crisp, credible materials product photography. No text, dimensions, logos, watermarks, labels, border, props or extra objects. This is a representative unbranded material photo, not a technical drawing.
```

Future edit prompts and visual checks live in the skill; the remaining six original photos were not submitted for edits in this run.

## Supplemental supplier photos

Six additional source photographs were downloaded and visually inspected without image edits. Import mapping: `tmp/catalog-import/image-overrides.json`; selected downloads are under `tmp/catalog-import/extra-images/`. Only the six mapped assets are selected; earlier packaging, watermark, printed-artwork, and cropped candidates in the temporary directory are rejected.

### seleshamer

- Source: [seleshamer](https://www.likovni.kopija-nova.si/likovni-material/papirji-in-kartoni/barvni-seleshamer/seleshamer-velikost-a4-200-g-bel-1250)
- Image: [supplier original](https://www.likovni.kopija-nova.si/item_images/kopija_nova/18821.jpg)
- Selected file: `tmp/catalog-import/extra-images/seleshamer-kopija.jpg` (1080 × 1080 pixels)
- Status: Representative plain white smooth 200 g paper photo from a Slovenian listing for A4 šeleshamer; no pack count or brand inferred from the photograph. Original file, visually inspected; clean white background, no supplier watermark.

### pleksi-steklo

- Source: [pleksi-steklo](https://www.pos-plastika.hr/pleksi-steklo3)
- Image: [supplier original](https://www.pos-plastika.hr/Media/SlikeIT//prozoren%20pleksi%20(640%20x%20480)_r.jpg)
- Selected file: `tmp/catalog-import/extra-images/pleksi-steklo-pos.jpg` (800 × 600 pixels)
- Status: Representative unbranded transparent acrylic sheet from the supplier's 3 mm clear acrylic listing. Size differs from ATEHNA variants; photo is material representation, not dimensional evidence. Entire rectangular plate visible; original file, visually inspected.

### grafopak

- Source: [grafopak](https://velpapir.hr/ambalazni-kartoni/)
- Image: [supplier original](https://velpapir.hr/wp-content/uploads/2023/03/VELPAPIR1390-2048x1365.jpg)
- Selected file: `tmp/catalog-import/extra-images/grafopak-material.jpg` (2048 × 1365 pixels)
- Status: Representative unprinted white/gray GD cartonboard photograph from a supplier section explicitly listing Grafopak; not a dimensional/specification photograph.

### otroska-ocala-za-zascito-oci

- Source: [Children's Eye Protection Safety Glasses](https://www.tts-group.co.uk/childrens-eye-protection-safety-glasses/1032927.html)
- Image: [supplier original](https://www.tts-group.co.uk/on/demandware.static/-/Sites-TTSGroupE-commerceMaster/default/dw227dc8db/images/hi-res/1032927_00_770010_2.jpg)
- Selected file: `tmp/catalog-import/extra-images/otroska-ocala-tts.jpg` (900 × 900 pixels)
- Status: Selected real children's science-lab safety eyewear for the planned catalog. Supplier explicitly identifies children. This model is not asserted to be the unknown historical ATEHNA SKU 45002. No unverified certification claims copied.
- Selected supplier identity: TTS — Children's Eye Protection Safety Glasses, family 1032927

### ocala-za-zascito-oci

- Source: [Zaščitna varnostna očala za delo](https://www.techtradecenter.si/zascitna-varnostna-ocala-za-delo)
- Image: [supplier original](https://www.techtradecenter.si/modules/uploader/uploads/s_product/pictures/main/zascitna-varnostna-ocala-za-delo--0.jpg)
- Selected file: `tmp/catalog-import/extra-images/ocala-koestier.jpg` (535 × 431 pixels)
- Status: Selected source model for the planned general safety-eyewear entry, not asserted to match unknown historical ATEHNA SKU 45001. Supplier labels the image symbolic. No unverified certifications copied.
- Selected supplier identity: Koestier — Zaščitna varnostna očala za delo; TechTradeCenter 103509

### zlatarske-skarje-za-plocevino

- Source: [LUX-TOOLS Zlatarske škarje 180 mm Comfort](https://www.obi.si/p/lux-tools-zlatarske-skarje-180-mm-comfort-115606)
- Image: [supplier original](https://assets.dbsacdc-prod.obi.solutions/08e8954c-f66f-4b8b-8c7d-08e9dfb9c75a/prZZB/image.jpeg)
- Selected file: `tmp/catalog-import/extra-images/zlatarske-skarje-lux.jpg` (415 × 415 pixels)
- Status: Representative photograph of ONE pair of goldsmith tin snips. It does not show or verify the planned 10-piece set or stand. Do not claim this is the existing ATEHNA source set or invent a stand image.
- Selected supplier identity: LUX-TOOLS — Comfort 180 mm; OBI 1156066
- Review before sale: Pred prodajo potrditi model, vsebino kompleta 10 kosov in stojalo. Fotografija prikazuje le eno orodje, ne celotnega kompleta.
