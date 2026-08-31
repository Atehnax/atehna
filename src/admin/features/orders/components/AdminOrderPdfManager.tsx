'use client';

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { IconButton } from '@/shared/ui/icon-button';
import LazyConfirmDialog from '@/shared/ui/confirm-dialog/lazy-confirm-dialog';
import {
  DownloadIcon,
  PdfFileIcon,
  TrashCanIcon,
  UploadIcon
} from '@/shared/ui/icons/AdminActionIcons';
import { Spinner } from '@/shared/ui/loading';
import { RowActionsDropdown } from '@/shared/ui/table';
import { adminTableInlineCancelButtonClassName } from '@/shared/ui/admin-table';
import {
  AdminDetailDocumentActions,
  AdminDetailDocumentCurrent,
  AdminDetailDocumentEmpty,
  AdminDetailDocumentHistory,
  AdminDetailDocumentHistoryItem,
  AdminDetailDocumentHistoryLink,
  AdminDetailDocumentHistoryMeta,
  AdminDetailDocumentOpenLink,
  AdminDetailDocumentPrimaryAction,
  AdminDetailDocumentSummary,
  AdminDetailDocumentsCard,
  AdminDetailDocumentTypeRow
} from '@/shared/ui/admin-detail';
import { useToast } from '@/shared/ui/toast';
import {
  groupDocumentsByType,
  isGenerateKey,
  routeMap,
  type GeneratePdfType,
  type PdfTypeKey
} from '@/admin/features/orders/components/adminOrdersPdfCellUtils';
import { ORDER_PDF_TYPE_CONFIGS, type PersistedOrderPdfDocument } from '@/shared/domain/order/orderTypes';

const PDF_TYPES = ORDER_PDF_TYPE_CONFIGS;

const pdfTimestampFormatter = new Intl.DateTimeFormat('sl-SI', {
  dateStyle: 'medium',
  timeStyle: 'short',
  timeZone: 'Europe/Ljubljana'
});

const formatTimestamp = (value: string) => pdfTimestampFormatter.format(new Date(value));

export default function AdminOrderPdfManager({
  orderId,
  documents,
  adminNotesSlot,
  generationDisabledReason
}: {
  orderId: number;
  documents: PersistedOrderPdfDocument[];
  adminNotesSlot?: ReactNode;
  generationDisabledReason?: string;
}) {
  const [docList, setDocList] = useState(documents);
  const [loadingType, setLoadingType] = useState<GeneratePdfType | null>(null);
  const [uploadingType, setUploadingType] = useState<PdfTypeKey | null>(null);
  const [deletingDocumentId, setDeletingDocumentId] = useState<number | null>(null);
  const [confirmDeleteDocumentId, setConfirmDeleteDocumentId] = useState<number | null>(null);
  const uploadInputRefs = useRef<Partial<Record<PdfTypeKey, HTMLInputElement | null>>>({});
  const { toast } = useToast();

  useEffect(() => {
    setDocList(documents);
  }, [documents]);

  const grouped = useMemo<Record<PdfTypeKey, PersistedOrderPdfDocument[]>>(() => {
    return groupDocumentsByType(docList) as Record<PdfTypeKey, PersistedOrderPdfDocument[]>;
  }, [docList]);

  const handleGenerate = async (type: GeneratePdfType) => {
    if (generationDisabledReason) {
      toast.info(generationDisabledReason);
      return;
    }
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
          url: payload.url,
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
          url: payload.url,
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
    window.open(latest.url, '_blank', 'noopener,noreferrer');
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
    <>
      <AdminDetailDocumentsCard
        beforeTitle={adminNotesSlot}
        notice={generationDisabledReason}
      >
        {PDF_TYPES.map((pdfType) => {
          const docs = grouped[pdfType.key];
          const latestDoc = docs[0] ?? null;
          const previousDocs = docs.slice(1);
          const generateType = isGenerateKey(pdfType.key) ? pdfType.key : null;

          return (
            <AdminDetailDocumentTypeRow
              key={pdfType.key}
              summary={
                <AdminDetailDocumentSummary label={pdfType.label}>
                  {latestDoc ? (
                    <AdminDetailDocumentCurrent
                      href={latestDoc.url}
                      filename={latestDoc.filename}
                      timestamp={formatTimestamp(latestDoc.created_at)}
                    />
                  ) : (
                    <AdminDetailDocumentEmpty>Ni ustvarjeno.</AdminDetailDocumentEmpty>
                  )}
                </AdminDetailDocumentSummary>
              }
              actions={
                <AdminDetailDocumentActions>
                  {pdfType.key === 'purchase_order' ? (
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
                  ) : null}

                  {latestDoc ? (
                    <AdminDetailDocumentOpenLink
                      href={latestDoc.url}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Odpri
                    </AdminDetailDocumentOpenLink>
                  ) : generateType ? (
                    <AdminDetailDocumentPrimaryAction
                      type="button"
                      onClick={() => void handleGenerate(generateType)}
                      disabled={
                        Boolean(generationDisabledReason) ||
                        loadingType === generateType
                      }
                      title={generationDisabledReason ?? 'Ustvari'}
                    >
                      {loadingType === generateType ? (
                        <Spinner size="sm" className="text-slate-500" />
                      ) : (
                        'Ustvari'
                      )}
                    </AdminDetailDocumentPrimaryAction>
                  ) : (
                    <AdminDetailDocumentPrimaryAction
                      type="button"
                      onClick={() =>
                        uploadInputRefs.current[pdfType.key]?.click()
                      }
                      disabled={uploadingType === pdfType.key}
                    >
                      {uploadingType === pdfType.key ? (
                        <Spinner size="sm" className="text-slate-500" />
                      ) : (
                        'Naloži'
                      )}
                    </AdminDetailDocumentPrimaryAction>
                  )}

                  <RowActionsDropdown
                    label={`Dejanja za ${pdfType.label}`}
                    triggerClassName="!h-7 !w-7 !text-slate-500"
                    menuWidth={174}
                    menuClassName="!w-full"
                    items={[
                      ...(generateType
                        ? [
                            {
                              key: 'generate',
                              label: latestDoc
                                ? 'Ustvari novo različico'
                                : 'Ustvari',
                              icon: <PdfFileIcon />,
                              onSelect: () => void handleGenerate(generateType),
                              disabled:
                                Boolean(generationDisabledReason) ||
                                loadingType === generateType
                            }
                          ]
                        : []),
                      ...(pdfType.key === 'purchase_order'
                        ? [
                            {
                              key: 'upload',
                              label: latestDoc
                                ? 'Naloži novo različico'
                                : 'Naloži',
                              icon: <UploadIcon />,
                              onSelect: () =>
                                uploadInputRefs.current[pdfType.key]?.click(),
                              disabled: uploadingType === pdfType.key
                            }
                          ]
                        : []),
                      ...(latestDoc
                        ? [
                            {
                              key: 'download',
                              label: 'Prenesi',
                              icon: <DownloadIcon />,
                              onSelect: () =>
                                downloadLatestByType(pdfType.key)
                            }
                          ]
                        : []),
                      ...(latestDoc
                        ? [
                            {
                              key: 'delete',
                              label: 'Izbriši',
                              icon:
                                deletingDocumentId === latestDoc.id ? (
                                  <Spinner
                                    size="sm"
                                    className="text-slate-500"
                                  />
                                ) : (
                                  <TrashCanIcon />
                                ),
                              onSelect: () =>
                                setConfirmDeleteDocumentId(latestDoc.id),
                              disabled: deletingDocumentId === latestDoc.id,
                              className: '!text-rose-700'
                            }
                          ]
                        : [])
                    ]}
                  />
                </AdminDetailDocumentActions>
              }
              history={
                latestDoc && previousDocs.length > 0 ? (
                  <AdminDetailDocumentHistory>
                    {previousDocs.map((doc) => (
                      <AdminDetailDocumentHistoryItem
                        key={`${doc.id}-${doc.created_at}`}
                        hasTrailingAction
                      >
                        <AdminDetailDocumentHistoryLink
                          href={doc.url}
                          target="_blank"
                          rel="noreferrer"
                          title={doc.filename}
                        >
                          {doc.filename}
                        </AdminDetailDocumentHistoryLink>
                        <AdminDetailDocumentHistoryMeta>
                          {formatTimestamp(doc.created_at)}
                        </AdminDetailDocumentHistoryMeta>
                        <IconButton
                          type="button"
                          onClick={() => setConfirmDeleteDocumentId(doc.id)}
                          disabled={deletingDocumentId === doc.id}
                          tone="neutral"
                          className={`${adminTableInlineCancelButtonClassName} !text-rose-700`}
                          aria-label={`Izbriši dokument ${doc.filename}`}
                          title="Izbriši"
                        >
                          {deletingDocumentId === doc.id ? (
                            <Spinner size="sm" className="text-slate-500" />
                          ) : (
                            <TrashCanIcon />
                          )}
                        </IconButton>
                      </AdminDetailDocumentHistoryItem>
                    ))}
                  </AdminDetailDocumentHistory>
                ) : undefined
              }
            />
          );
        })}
      </AdminDetailDocumentsCard>

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
    </>
  );
}