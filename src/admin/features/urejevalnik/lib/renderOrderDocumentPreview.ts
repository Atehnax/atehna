'use client';

import type { OrderDocumentPreviewLayout } from '@/shared/domain/order/orderDocumentPreviewLayout';
import { createOrderDocumentPreviewRuntimeLoader } from './orderDocumentPreviewRuntime';

export type OrderDocumentRenderedPreview = {
  url: string;
  pages: string[];
  layout: OrderDocumentPreviewLayout;
};

const loadPreviewRuntime = createOrderDocumentPreviewRuntimeLoader(
  () => import('pdfjs-dist/legacy/build/pdf.mjs'),
  (pdfjs) => {
    pdfjs.GlobalWorkerOptions.workerSrc = new URL(
      'pdfjs-dist/legacy/build/pdf.worker.min.mjs', import.meta.url
    ).toString();
    return new pdfjs.PDFWorker();
  }
);

/** Retain once per mounted editor; return its effect cleanup. */
export function retainOrderDocumentPreviewRenderer(): () => void {
  return loadPreviewRuntime.retain();
}

/** Start the PDF library and worker while the server generates the document. */
export function warmOrderDocumentPreviewRenderer(): void {
  const release = loadPreviewRuntime.retain();
  // A failed preload must remain retryable by the actual rendering request.
  void loadPreviewRuntime().catch(() => undefined).finally(release);
}

/** Render once; both views display these same pixels from the downloadable PDF. */
export async function renderOrderDocumentPreview(
  payload: { pdfBase64: string; layout: OrderDocumentPreviewLayout },
  signal: AbortSignal
): Promise<OrderDocumentRenderedPreview> {
  signal.throwIfAborted();
  const releaseRuntime = loadPreviewRuntime.retain();
  try {
    const { module: pdfjs, worker } = await loadPreviewRuntime();
    signal.throwIfAborted();
    const binary = atob(payload.pdfBase64);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
    // Keep the download bytes while PDF.js transfers its copy to the shared worker.
    const task = pdfjs.getDocument({ data: bytes.slice(), useSystemFonts: false, worker });
    let destruction: Promise<void> | undefined;
    const destroy = () => destruction ??= task.destroy();
    const abort = () => { void destroy().catch(() => undefined); };
    signal.addEventListener('abort', abort, { once: true });
    const pages: string[] = [];
    try {
      const pdf = await task.promise;
      if (pdf.numPages !== payload.layout.pages.length) throw new Error('Podatki strani predogleda se ne ujemajo.');
      for (let number = 1; number <= pdf.numPages; number += 1) {
        signal.throwIfAborted();
        const page = await pdf.getPage(number);
        const viewport = page.getViewport({ scale: 2 });
        const canvas = document.createElement('canvas');
        try {
          canvas.width = Math.ceil(viewport.width);
          canvas.height = Math.ceil(viewport.height);
          const context = canvas.getContext('2d');
          if (!context) throw new Error('Brskalnik ne podpira izrisa predogleda.');
          await page.render({ canvasContext: context, canvas, viewport }).promise;
          signal.throwIfAborted();
          pages.push(canvas.toDataURL('image/png'));
        } finally {
          canvas.width = 0;
          canvas.height = 0;
        }
      }
    } finally {
      signal.removeEventListener('abort', abort);
      // Hold this render's reference until document cleanup acknowledges cancellation.
      await destroy();
    }
    signal.throwIfAborted();
    // Cleanup may reject; only create a URL once the caller can take ownership.
    return {
      url: URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' })),
      pages,
      layout: payload.layout
    };
  } finally {
    releaseRuntime();
  }
}
