/** Actual PDF renderer geometry, in millimetres from each page's top-left. */
export type OrderDocumentPreviewRegion = {
  /** Existing selection ID; repeated/split content has one region per page. */
  id: string;
  parentId?: string;
  kind: 'element' | 'child';
  pageNumber: number;
  /** Exact owner origin used by field-row placement offsets. */
  placementOriginXMm?: number;
  placementOriginYMm?: number;
  xMm: number;
  yMm: number;
  widthMm: number;
  heightMm: number;
};

export type OrderDocumentPreviewLayout = {
  pages: Array<{ pageNumber: number; widthMm: number; heightMm: number }>;
  regions: OrderDocumentPreviewRegion[];
};

export type OrderDocumentRenderedPreview = {
  pdfBase64: string;
  layout: OrderDocumentPreviewLayout;
};
