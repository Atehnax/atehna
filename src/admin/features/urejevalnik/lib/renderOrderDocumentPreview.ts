'use client';

import type { OrderDocumentPreviewLayout } from '@/shared/domain/order/orderDocumentPreviewLayout';

export type OrderDocumentRenderedPreview = {
  url: string;
  pages: string[];
  layout: OrderDocumentPreviewLayout;
};

/** Render once; both views display these same pixels from the downloadable PDF. */
export async function renderOrderDocumentPreview(
  payload: { pdfBase64: string; layout: OrderDocumentPreviewLayout },
  signal: AbortSignal
): Promise<OrderDocumentRenderedPreview> {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/legacy/build/pdf.worker.min.mjs', import.meta.url
  ).toString();
  signal.throwIfAborted();
  const bytes = Uint8Array.from(atob(payload.pdfBase64), (character) => character.charCodeAt(0));
  const task = pdfjs.getDocument({ data: bytes.slice(), useSystemFonts: false });
  const abort = () => { void task.destroy(); };
  signal.addEventListener('abort', abort, { once: true });
  try {
    const pdf = await task.promise;
    const pages: string[] = [];
    if (pdf.numPages !== payload.layout.pages.length) throw new Error('Podatki strani predogleda se ne ujemajo.');
    for (let number = 1; number <= pdf.numPages; number += 1) {
      signal.throwIfAborted();
      const page = await pdf.getPage(number);
      const viewport = page.getViewport({ scale: 2 });
      const canvas = document.createElement('canvas');
      canvas.width = Math.ceil(viewport.width);
      canvas.height = Math.ceil(viewport.height);
      const context = canvas.getContext('2d');
      if (!context) throw new Error('Brskalnik ne podpira izrisa predogleda.');
      await page.render({ canvasContext: context, canvas, viewport }).promise;
      signal.throwIfAborted();
      pages.push(canvas.toDataURL('image/png'));
      canvas.width = 0;
      canvas.height = 0;
    }
    signal.throwIfAborted();
    return {
      url: URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' })),
      pages,
      layout: payload.layout
    };
  } finally {
    signal.removeEventListener('abort', abort);
    await task.destroy();
  }
}


