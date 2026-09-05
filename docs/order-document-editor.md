# PDF template editor

`/admin/urejevalnik` edits five document templates: order confirmation, offer, delivery note, pro forma invoice and invoice.

Both editor modes display the same generated PDF artwork. The preview endpoint renders the current unsaved template, the shared sample document and the current logo once. Its optional layout response includes measured page, element, row and table-cell bounds from that exact render. PDF.js renders the embedded fonts and artwork locally; no PDF or customer data is sent to a third-party viewer. The download retains the original PDF bytes.

The interactive view adds selection, drag and resize controls over the measured bounds. Changing the template or logo refreshes the preview after a short typing pause. Switching view modes reuses the existing artifact. Failed or superseded requests never become the current preview, and object URLs and PDF workers are released after use.

Default templates share consistent margins, a full-width heading, separate customer and metadata columns, naturally flowing body sections, readable item columns and a reserved footer. Long codes and metadata wrap without ellipses. `Uredi razmike` arranges the current draft while preserving company information, text, labels, rules, visibility and visual overrides. It resets manual geometry and row placements; saving is explicit. Loading a saved template never silently resets its layout.

Regression coverage includes actual PDF glyph and table bounds, pagination and clipping, download/preview identity, browser mode parity, responsive scaling, unsaved edits, failure recovery and direct selection.
