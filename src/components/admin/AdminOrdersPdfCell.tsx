'use client';

import { useEffect, useMemo, useState } from 'react';

import {
  type GeneratePdfType,
  type PdfDocument,
  groupDocumentsByType,
  pdfTypes,
  routeMap
} from '@/components/admin/adminOrdersPdfCellUtils';

export default function AdminOrdersPdfCell({
  orderId,
  documents,
  attachments,
  interactionsDisabled = false
}: {
  orderId: number;
  documents: PdfDocument[];
  attachments: PdfDocument[];
  interactionsDisabled?: boolean;
}) {
  const [documentsState, setDocumentsState] = useState(documents);
  const [attachmentsState, setAttachmentsState] = useState(attachments);
  const [loadingType, setLoadingType] = useState<GeneratePdfType | null>(null);

  useEffect(() => {
    setDocumentsState(documents);
  }, [documents]);

  useEffect(() => {
    setAttachmentsState(attachments);
  }, [attachments]);

  const groupedDocuments = useMemo(
    () => groupDocumentsByType(documentsState, attachmentsState),
    [attachmentsState, documentsState]
  );

  const handleGenerate = async (type: GeneratePdfType) => {
    setLoadingType(type);
    try {
      const response = await fetch(`/api/admin/orders/${orderId}/${routeMap[type]}`, {
        method: 'POST'
      });

      if (!response.ok) return;

      const payload = (await response.json()) as {
        url: string;
        filename: string;
        createdAt: string;
        type: string;
      };

      const newDocument: PdfDocument = {
        type: payload.type,
        blob_url: payload.url,
        filename: payload.filename,
        created_at: payload.createdAt
      };

      setDocumentsState((previousDocuments) => [newDocument, ...previousDocuments]);
    } finally {
      setLoadingType(null);
    }
  };

  return (
    <div className="inline-flex flex-nowrap items-center justify-center gap-1 whitespace-nowrap">
      {pdfTypes.map((pdfType) => {
        const options = groupedDocuments[pdfType.key];
        const latestDocument = options[0];
        const isGeneratingThisType = loadingType === pdfType.key;

        if (latestDocument) {
          return (
            <a
              key={pdfType.key}
              href={latestDocument.blob_url}
              target="_blank"
              rel="noreferrer"
              onClick={(event) => {
                if (interactionsDisabled) event.preventDefault();
              }}
              className="inline-flex h-7 min-w-[84px] shrink-0 items-center justify-center whitespace-nowrap rounded-md border border-slate-200 bg-white px-2 text-[11px] font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
            >
              {pdfType.label}
            </a>
          );
        }

        if (!pdfType.canGenerate) {
          return (
            <span
              key={pdfType.key}
              className="inline-flex h-7 min-w-[84px] shrink-0 items-center justify-center whitespace-nowrap rounded-md border border-slate-200 bg-slate-50 px-2 text-[11px] font-medium text-slate-400"
            >
              {pdfType.label}
            </span>
          );
        }

        return (
          <button
            key={pdfType.key}
            type="button"
            onClick={() => handleGenerate(pdfType.key as GeneratePdfType)}
            disabled={interactionsDisabled || isGeneratingThisType}
            className="inline-flex h-7 min-w-[84px] shrink-0 items-center justify-center whitespace-nowrap rounded-md border border-slate-200 bg-white px-2 text-[11px] font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-300"
          >
            {isGeneratingThisType ? 'Generiram…' : pdfType.label}
          </button>
        );
      })}
    </div>
  );
}
