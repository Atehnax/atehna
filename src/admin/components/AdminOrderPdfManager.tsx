'use client';

import dynamic from 'next/dynamic';
import { useMemo, useRef, useState, type ReactNode } from 'react';
import { IconButton } from '@/shared/ui/icon-button';
import {
  CheckCircleIcon,
  DownloadIcon,
  PdfFileIcon,
  TrashCanIcon,
  UploadIcon
} from '@/shared/ui/icons/AdminActionIcons';
import { Spinner } from '@/shared/ui/loading';
import {
  adminTableInlineCancelButtonClassName,
  adminTableNeutralIconButtonClassName,
  adminWindowCardClassName,
  adminWindowCardStyle
} from '@/shared/ui/admin-table';
import { useToast } from '@/shared/ui/toast';

type PdfDocument = {
  id: number;
  type: string;
  filename: string;
  blob_url: string;
  created_at: string;
};

type PdfTypeKey = 'order_summary' | 'purchase_order' | 'predracun' | 'dobavnica' | 'invoice';

type PdfTypeConfig = {
  key: PdfTypeKey;
  label: string;
};

const PDF_TYPES: PdfTypeConfig[] = [
  { key: 'order_summary', label: 'Povzetek naročila' },
  { key: 'purchase_order', label: 'Naročilnica' },
  { key: 'dobavnica', label: 'Dobavnica' },
  { key: 'predracun', label: 'Predračun' },
  { key: 'invoice', label: 'Račun' }
];

const routeMap: Record<PdfTypeKey, string> = {
  order_summary: 'generate-order-summary',
  purchase_order: 'generate-purchase-order',
  predracun: 'generate-predracun',
  dobavnica: 'generate-dobavnica',
  invoice: 'generate-invoice'
};

const normalizeType = (type: string): PdfTypeKey | null => {
  if (type === 'offer') return 'order_summary';
  if (type === 'purchase_order') return 'purchase_order';
  if (type === 'order_summary') return 'order_summary';
  if (type === 'predracun') return 'predracun';
  if (type === 'dobavnica') return 'dobavnica';
  if (type === 'invoice') return 'invoice';
  return null;
};

const pdfTimestampFormatter = new Intl.DateTimeFormat('sl-SI', {
  dateStyle: 'medium',
  timeStyle: 'short',
  timeZone: 'Europe/Ljubljana'
});

const formatTimestamp = (value: string) => pdfTimestampFormatter.format(new Date(value));

const LazyConfirmDialog = dynamic(
  () => import('@/shared/ui/confirm-dialog').then((module) => module.ConfirmDialog),
  { ssr: false }
);

export default function AdminOrderPdfManager({
  orderId,
  documents,
  adminNotesSlot
}: {
  orderId: number;
  documents: PdfDocument[];
  adminNotesSlot?: ReactNode;
}) {
  const [docList, setDocList] = useState(documents);
  const [loadingType, setLoadingType] = useState<PdfTypeKey | null>(null);
  const [uploadingType, setUploadingType] = useState<PdfTypeKey | null>(null);
  const [expandedByType, setExpandedByType] = useState<Partial<Record<PdfTypeKey, boolean>>>({});
  const [deletingDocumentId, setDeletingDocumentId] = useState<number | null>(null);
  const [confirmDeleteDocumentId, setConfirmDeleteDocumentId] = useState<number | null>(null);
  const uploadInputRefs = useRef<Partial<Record<PdfTypeKey, HTMLInputElement | null>>>({});
  const { toast } = useToast();

  const grouped = useMemo(() => {
    const map: Record<PdfTypeKey, PdfDocument[]> = {
      order_summary: [],
      purchase_order: [],
      predracun: [],
      dobavnica: [],
      invoice: []
    };

    const sorted = [...docList].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );

    sorted.forEach((doc) => {
      const normalized = normalizeType(doc.type);
      if (!normalized) return;
      map[normalized].push(doc);
    });

    return map;
  }, [docList]);

  const handleGenerate = async (type: PdfTypeKey) => {
    setLoadingType(type);
    try {
      const response = await fetch(`/api/admin/orders/${orderId}/${routeMap[type]}`, {
        method: 'POST'
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        toast.error(body.message || 'Generiranje PDF ni uspelo.');
        return;
      }
      const payload = (await response.json()) as {
        id: number;
        url: string;
        filename: string;
        createdAt: string;
        type: string;
      };
      toast.success('PDF je uspešno ustvarjen.');
      setDocList((prev) => [
        {
          id: payload.id,
          type: payload.type,
          filename: payload.filename,
          blob_url: payload.url,
          created_at: payload.createdAt
        },
        ...prev
      ]);
    } finally {
      setLoadingType(null);
    }
  };

  const handleUpload = async (type: PdfTypeKey, file: File) => {
    setUploadingType(type);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('type', type);
      const response = await fetch(`/api/admin/orders/${orderId}/documents`, {
        method: 'POST',
        body: formData
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        toast.error(body.message || 'Nalaganje PDF ni uspelo.');
        return;
      }
      const payload = (await response.json()) as {
        id: number;
        url: string;
        filename: string;
        createdAt: string;
        type: string;
      };
      toast.success('PDF je uspešno naložen.');
      setDocList((prev) => [
        {
          id: payload.id,
          type: payload.type,
          filename: payload.filename,
          blob_url: payload.url,
          created_at: payload.createdAt
        },
        ...prev
      ]);
    } finally {
      setUploadingType(null);
    }
  };

  const downloadLatestByType = (type: PdfTypeKey) => {
    const latest = grouped[type][0];
    if (!latest) {
      toast.info('Ni dokumenta za prenos.');
      return;
    }
    window.open(latest.blob_url, '_blank', 'noopener,noreferrer');
  };

  const confirmDeleteDocument = async () => {
    if (confirmDeleteDocumentId === null) return;

    const documentId = confirmDeleteDocumentId;
    setDeletingDocumentId(documentId);
    setConfirmDeleteDocumentId(null);
    try {
      const response = await fetch(`/api/admin/orders/${orderId}/documents/${documentId}`, {
        method: 'DELETE'
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        toast.error(body.message || 'Brisanje PDF ni uspelo.');
        return;
      }
      toast.success('Verzija PDF je izbrisana.');
      setDocList((previousDocuments) => previousDocuments.filter((doc) => doc.id !== documentId));
    } finally {
      setDeletingDocumentId(null);
    }
  };

  return (
    <section className={`${adminWindowCardClassName} flex h-full w-full min-w-0 flex-col p-6 font-['Inter',system-ui,sans-serif]`} style={adminWindowCardStyle}>
      {adminNotesSlot ? (
        <div className="mb-6 border-b border-slate-200 pb-6">{adminNotesSlot}</div>
      ) : null}

      <h2 className="text-lg font-semibold text-slate-900">PDF dokumenti</h2>
      <div className="mt-5 space-y-4">
        {PDF_TYPES.map((pdfType) => {
          const docs = grouped[pdfType.key];
          const latestDoc = docs[0] ?? null;
          const hasMultipleVersions = docs.length > 1;
          const isExpanded = Boolean(expandedByType[pdfType.key]);
          const visibleDocs = isExpanded ? docs : docs.slice(0, 1);

          return (
            <div key={pdfType.key} className="rounded-2xl border border-slate-200 p-4">
              <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-900">{pdfType.label}</p>
                  <div className="mt-1 flex min-h-5 min-w-0 flex-wrap items-center gap-2 text-[12px] leading-5 text-slate-500">
                    {latestDoc ? (
                      <>
                        <a
                          href={latestDoc.blob_url}
                          target="_blank"
                          rel="noreferrer"
                          className="min-w-0 truncate font-medium text-[color:var(--blue-500)] hover:text-[color:var(--blue-600)]"
                          title={latestDoc.filename}
                        >
                          {latestDoc.filename}
                        </a>
                        <span className="whitespace-nowrap">{formatTimestamp(latestDoc.created_at)}</span>
                        {hasMultipleVersions ? (
                          <button
                            type="button"
                            onClick={() =>
                              setExpandedByType((previousState) => ({
                                ...previousState,
                                [pdfType.key]: !previousState[pdfType.key]
                              }))
                            }
                            className="font-semibold text-slate-500 transition hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3e67d6]"
                            aria-label={isExpanded ? `Skrij verzije za ${pdfType.label}` : `Pokaži vse verzije za ${pdfType.label}`}
                            aria-expanded={isExpanded}
                            aria-controls={`pdf-versions-${pdfType.key}`}
                          >
                            {isExpanded ? 'Skrij verzije' : `${docs.length} verziji`}
                          </button>
                        ) : null}
                      </>
                    ) : (
                      <span>Ni shranjenih verzij.</span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  <IconButton
                    type="button"
                    onClick={() => void handleGenerate(pdfType.key)}
                    disabled={loadingType === pdfType.key}
                    className={adminTableNeutralIconButtonClassName}
                    title="Ustvari"
                    tone="neutral"
                    aria-label={`Ustvari ${pdfType.label}`}
                  >
                    {loadingType === pdfType.key ? <Spinner size="sm" className="text-slate-500" /> : <PdfFileIcon />}
                  </IconButton>

                  <input
                    ref={(element) => {
                      uploadInputRefs.current[pdfType.key] = element;
                    }}
                    type="file"
                    accept="application/pdf"
                    className="hidden"
                    disabled={uploadingType === pdfType.key}
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      if (!file) return;
                      void handleUpload(pdfType.key, file);
                      event.currentTarget.value = '';
                    }}
                  />

                  <IconButton
                    type="button"
                    onClick={() => uploadInputRefs.current[pdfType.key]?.click()}
                    disabled={uploadingType === pdfType.key}
                    className={adminTableNeutralIconButtonClassName}
                    title="Naloži"
                    tone="neutral"
                    aria-label={`Naloži ${pdfType.label}`}
                  >
                    {uploadingType === pdfType.key ? <Spinner size="sm" className="text-slate-500" /> : <UploadIcon />}
                  </IconButton>

                  <IconButton
                    type="button"
                    onClick={() => downloadLatestByType(pdfType.key)}
                    className={adminTableNeutralIconButtonClassName}
                    title="Prenesi"
                    tone="neutral"
                    aria-label={`Prenesi ${pdfType.label}`}
                  >
                    <DownloadIcon />
                  </IconButton>
                </div>
              </div>

              {latestDoc && isExpanded ? (
                <div id={`pdf-versions-${pdfType.key}`} className="mt-3 rounded-xl bg-slate-50/80 p-2">
                  <ul className="space-y-1">
                    {visibleDocs.map((doc, index) => {
                      const isNewest = index === 0;

                      return (
                        <li
                          key={`${doc.id}-${doc.created_at}`}
                          className="grid min-w-0 grid-cols-[16px_minmax(0,1fr)_120px_28px] items-center gap-2 rounded-lg px-2 py-1.5 text-[11px] leading-4 text-slate-600 transition hover:bg-white"
                        >
                          <span className="inline-flex h-4 w-4 items-center justify-center text-emerald-700" aria-hidden="true">
                            {isNewest ? <CheckCircleIcon className="h-3.5 w-3.5" /> : null}
                          </span>
                          <a
                            href={doc.blob_url}
                            target="_blank"
                            rel="noreferrer"
                            className={`truncate text-[color:var(--blue-500)] hover:text-[color:var(--blue-600)] ${
                              isNewest ? 'font-semibold' : 'font-medium'
                            }`}
                            title={doc.filename}
                          >
                            {doc.filename}
                          </a>
                          <span className="whitespace-nowrap text-right text-slate-500">{formatTimestamp(doc.created_at)}</span>
                          <IconButton
                            type="button"
                            onClick={() => setConfirmDeleteDocumentId(doc.id)}
                            disabled={deletingDocumentId === doc.id}
                            tone="neutral"
                            className={adminTableInlineCancelButtonClassName}
                            aria-label={`Izbriši dokument ${doc.filename}`}
                            title="Izbriši"
                          >
                            {deletingDocumentId === doc.id ? <Spinner size="sm" className="text-slate-500" /> : <TrashCanIcon />}
                          </IconButton>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>

      {confirmDeleteDocumentId !== null ? (
        <LazyConfirmDialog
          open={confirmDeleteDocumentId !== null}
          title="Izbris verzije PDF"
          description="Ali ste prepričani, da želite izbrisati to verzijo PDF dokumenta?"
          confirmLabel="Izbriši"
          cancelLabel="Prekliči"
          isDanger
          onCancel={() => setConfirmDeleteDocumentId(null)}
          onConfirm={() => {
            void confirmDeleteDocument();
          }}
        />
      ) : null}
    </section>
  );
}
