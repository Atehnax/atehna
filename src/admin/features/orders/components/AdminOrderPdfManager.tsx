'use client';

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { IconButton } from '@/shared/ui/icon-button';
import LazyConfirmDialog from '@/shared/ui/confirm-dialog/lazy-confirm-dialog';
import {
  DownloadIcon,
  MailIcon,
  PdfFileIcon,
  TrashCanIcon,
  UploadIcon
} from '@/shared/ui/icons/AdminActionIcons';
import CustomerEmailConfirmationDialog from '@/admin/features/email/components/CustomerEmailConfirmationDialog';
import { useCustomerEmailConfirmation } from '@/admin/features/email/useCustomerEmailConfirmation';
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
  unsavedChangesReason,
  generationDisabledReason
}: {
  orderId: number;
  documents: PersistedOrderPdfDocument[];
  adminNotesSlot?: ReactNode;
  unsavedChangesReason?: string;
  generationDisabledReason?: string;
}) {
  const [docList, setDocList] = useState(documents);
  const [loadingType, setLoadingType] = useState<GeneratePdfType | null>(null);
  const [uploadingType, setUploadingType] = useState<PdfTypeKey | null>(null);
  const [deletingDocumentId, setDeletingDocumentId] = useState<number | null>(null);
  const [sendingDocumentId, setSendingDocumentId] = useState<number | null>(null);
  const [confirmDeleteDocumentId, setConfirmDeleteDocumentId] = useState<number | null>(null);
  const uploadInputRefs = useRef<Partial<Record<PdfTypeKey, HTMLInputElement | null>>>({});
  const { toast } = useToast();
  const customerEmailConfirmation = useCustomerEmailConfirmation();

  useEffect(() => {
    setDocList(documents);
  }, [documents]);

  const grouped = useMemo<Record<PdfTypeKey, PersistedOrderPdfDocument[]>>(() => {
    return groupDocumentsByType(docList) as Record<PdfTypeKey, PersistedOrderPdfDocument[]>;
  }, [docList]);
  const effectiveGenerationDisabledReason =
    unsavedChangesReason ?? generationDisabledReason;

  const handleGenerate = async (type: GeneratePdfType) => {
    if (effectiveGenerationDisabledReason) {
      toast.info(effectiveGenerationDisabledReason);
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
    if (unsavedChangesReason) {
      toast.info(unsavedChangesReason);
      return;
    }
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

  const handleSendDocument = async (
    document: PersistedOrderPdfDocument,
    customerEmailConfirmationToken: string | null = null
  ) => {
    if (effectiveGenerationDisabledReason) {
      toast.info(effectiveGenerationDisabledReason);
      return;
    }
    setSendingDocumentId(document.id);
    try {
      const response = await fetch(
        `/api/admin/orders/${orderId}/documents/${document.id}/email`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...(customerEmailConfirmationToken
              ? { customerEmailConfirmationToken }
              : {})
          })
        }
      );
      const payload = (await response.json().catch(() => ({}))) as {
        message?: string;
      };
      if (!response.ok) {
        if (
          customerEmailConfirmation.handleConfirmationRequired(
            response,
            payload,
            (confirmationToken) =>
              handleSendDocument(document, confirmationToken)
          )
        ) {
          return;
        }
        toast.error(payload.message || 'Pošiljanje dokumenta ni uspelo.');
        return;
      }
      toast.success(payload.message || 'Dokument je uvrščen za pošiljanje.');
    } finally {
      setSendingDocumentId(null);
    }
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
        notice={effectiveGenerationDisabledReason}
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
                      disabled={
                        Boolean(unsavedChangesReason) ||
                        uploadingType === pdfType.key
                      }
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
                        Boolean(effectiveGenerationDisabledReason) ||
                        loadingType === generateType
                      }
                      title={effectiveGenerationDisabledReason ?? 'Ustvari'}
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
                      disabled={
                        Boolean(unsavedChangesReason) ||
                        uploadingType === pdfType.key
                      }
                      title={unsavedChangesReason ?? 'Naloži'}
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
                                Boolean(effectiveGenerationDisabledReason) ||
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
                              disabled:
                                Boolean(unsavedChangesReason) ||
                                uploadingType === pdfType.key
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
                      ...(latestDoc &&
                      (pdfType.key === 'predracun' ||
                        pdfType.key === 'invoice')
                        ? [
                            {
                              key: 'send-customer',
                              label: 'Pošlji stranki',
                              icon:
                                sendingDocumentId === latestDoc.id ? (
                                  <Spinner
                                    size="sm"
                                    className="text-slate-500"
                                  />
                                ) : (
                                  <MailIcon />
                                ),
                              onSelect: () =>
                                void handleSendDocument(latestDoc),
                              disabled:
                                Boolean(effectiveGenerationDisabledReason) ||
                                sendingDocumentId === latestDoc.id
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
      <CustomerEmailConfirmationDialog
        confirmation={customerEmailConfirmation.confirmation}
        onCancel={customerEmailConfirmation.cancelConfirmation}
        onConfirm={customerEmailConfirmation.confirm}
        confirmDisabled={sendingDocumentId !== null}
      />
    </>
  );
}
