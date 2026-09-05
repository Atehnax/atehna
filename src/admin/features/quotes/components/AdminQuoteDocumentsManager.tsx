'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  DownloadIcon,
  PdfFileIcon,
  UploadIcon
} from '@/shared/ui/icons/AdminActionIcons';
import { Spinner } from '@/shared/ui/loading';
import { RowActionsDropdown } from '@/shared/ui/table';
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
import type {
  AdminQuoteDocument,
  AdminQuoteOfferVersion
} from '@/shared/domain/quote/quoteAdminTypes';

type QuoteDocumentType = 'offer' | 'purchase_order';

const DOCUMENT_TYPES: ReadonlyArray<{
  key: QuoteDocumentType;
  label: string;
  openLabel: string;
  uploadLabel: string;
}> = [
  {
    key: 'offer',
    label: 'Ponudba',
    openLabel: 'Odpri PDF ponudbe',
    uploadLabel: 'Naloži ponudbo'
  },
  {
    key: 'purchase_order',
    label: 'Naročilnica',
    openLabel: 'Odpri naročilnico',
    uploadLabel: 'Naloži naročilnico'
  }
];

const ISSUED_LIFECYCLE_STATUSES = new Set([
  'issued',
  'accepted',
  'declined',
  'withdrawn',
  'expired',
  'superseded'
]);

const OFFER_VERSION_STATUS_LABELS: Record<string, string> = {
  draft: 'Osnutek',
  issued: 'Izdana',
  accepted: 'Sprejeta',
  declined: 'Zavrnjena',
  expired: 'Potekla',
  withdrawn: 'Umaknjena',
  superseded: 'Nadomeščena'
};

const documentTimestampFormatter = new Intl.DateTimeFormat('sl-SI', {
  dateStyle: 'medium',
  timeStyle: 'short',
  timeZone: 'Europe/Ljubljana'
});

const formatTimestamp = (value: string) =>
  documentTimestampFormatter.format(new Date(value));

const formatOptionalTimestamp = (value: string | null) =>
  value ? formatTimestamp(value) : '—';

const formatCurrency = (value: number, currency: string) =>
  new Intl.NumberFormat('sl-SI', {
    style: 'currency',
    currency
  }).format(value);

const offerVersionLabel = (version: AdminQuoteOfferVersion) =>
  version.offerNumber ?? `Osnutek V${version.versionNumber}`;

const isQuoteDocumentType = (value: string): value is QuoteDocumentType =>
  value === 'offer' || value === 'purchase_order';

const documentUrl = (quoteRequestId: number, documentId: number) =>
  `/api/admin/quote-requests/${quoteRequestId}/documents/${documentId}`;

const MAX_UPLOAD_SIZE = 10 * 1024 * 1024;

const isPdfFile = (file: File) =>
  file.type.toLowerCase() === 'application/pdf' ||
  file.name.toLowerCase().endsWith('.pdf');

export default function AdminQuoteDocumentsManager({
  quoteRequestId,
  quoteCode,
  documents,
  offerVersions
}: {
  quoteRequestId: number;
  quoteCode?: string;
  documents: AdminQuoteDocument[];
  offerVersions: AdminQuoteOfferVersion[];
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [documentList, setDocumentList] = useState(documents);
  const [isGenerating, setIsGenerating] = useState(false);
  const [uploadingType, setUploadingType] =
    useState<QuoteDocumentType | null>(null);
  const uploadInputRefs = useRef<
    Partial<Record<QuoteDocumentType, HTMLInputElement | null>>
  >({});
  const purchaseOrderAssociationId = quoteCode
    ? `quote-purchase-order-association-${quoteRequestId}`
    : undefined;

  useEffect(() => {
    setDocumentList(documents);
  }, [documents]);

  const groupedDocuments = useMemo(() => {
    const grouped: Record<QuoteDocumentType, AdminQuoteDocument[]> = {
      offer: [],
      purchase_order: []
    };
    [...documentList]
      .sort(
        (left, right) =>
          new Date(right.createdAt).getTime() -
          new Date(left.createdAt).getTime()
      )
      .forEach((document) => {
        if (isQuoteDocumentType(document.documentType)) {
          grouped[document.documentType].push(document);
        }
      });
    return grouped;
  }, [documentList]);

  const sortedOfferVersions = useMemo(
    () =>
      [...offerVersions].sort(
        (left, right) => right.versionNumber - left.versionNumber
      ),
    [offerVersions]
  );
  const latestOfferVersion = sortedOfferVersions[0] ?? null;
  const offerDocumentByVersionId = useMemo(
    () => {
      const latestByVersion = new Map<number, AdminQuoteDocument>();
      groupedDocuments.offer.forEach((document) => {
        if (!latestByVersion.has(document.offerVersionId)) {
          latestByVersion.set(document.offerVersionId, document);
        }
      });
      return latestByVersion;
    },
    [groupedDocuments]
  );
  const issuedOfferVersion = useMemo(
    () =>
      sortedOfferVersions.find(
        (version) =>
          Boolean(version.offerNumber) &&
          ISSUED_LIFECYCLE_STATUSES.has(String(version.status))
      ) ?? null,
    [sortedOfferVersions]
  );
  const primaryOfferVersion = issuedOfferVersion ?? latestOfferVersion;
  const olderOfferVersions = sortedOfferVersions.filter(
    (version) => version.id !== primaryOfferVersion?.id
  );
  const primaryOfferVersionDocuments = primaryOfferVersion
    ? groupedDocuments.offer.filter(
        (document) => document.offerVersionId === primaryOfferVersion.id
      )
    : [];
  const primaryOfferVersionDocument =
    primaryOfferVersionDocuments[0] ?? null;
  const olderPrimaryOfferDocuments = primaryOfferVersionDocuments.slice(1);
  const generatedIssuedOfferDocument = issuedOfferVersion
    ? groupedDocuments.offer.find(
        (document) =>
          document.offerVersionId === issuedOfferVersion.id &&
          document.source === 'generated'
      ) ?? null
    : null;
  const generationDisabledReason = generatedIssuedOfferDocument
    ? 'PDF izdane ponudbe je že ustvarjen.'
    : issuedOfferVersion
      ? null
      : 'Samodejni PDF ponudbe lahko ustvarite po izdaji. Osnutek lahko preverite z gumbom Predogled.';
  const generationReasonId = `quote-document-generation-reason-${quoteRequestId}`;
  const showGenerationDisabledReason = Boolean(
    generationDisabledReason && !primaryOfferVersionDocument
  );

  const handleUpload = async (
    documentType: QuoteDocumentType,
    file: File
  ) => {
    if (!primaryOfferVersion) {
      toast.error('Najprej ustvarite osnutek ponudbe.');
      return;
    }
    if (!isPdfFile(file)) {
      toast.error('Dovoljeni so samo PDF-ji.');
      return;
    }
    if (file.size <= 0 || file.size > MAX_UPLOAD_SIZE) {
      toast.error('Datoteka mora biti manjša od 10 MB.');
      return;
    }

    setUploadingType(documentType);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('type', documentType);
      formData.append('offerVersionId', String(primaryOfferVersion.id));
      const response = await fetch(
        `/api/admin/quote-requests/${quoteRequestId}/documents`,
        { method: 'POST', body: formData }
      );
      const payload = (await response.json().catch(() => null)) as
        | {
            message?: string;
            document?: AdminQuoteDocument & { url?: string };
          }
        | null;
      if (!response.ok || !payload?.document) {
        throw new Error(payload?.message ?? 'Nalaganje PDF-ja ni uspelo.');
      }

      setDocumentList((current) => [
        payload.document as AdminQuoteDocument,
        ...current.filter(
          (document) => document.id !== payload.document?.id
        )
      ]);
      toast.success(payload.message ?? 'PDF je uspešno naložen.');
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : 'Nalaganje PDF-ja ni uspelo.'
      );
    } finally {
      setUploadingType(null);
    }
  };

  const generateOfferDocument = async () => {
    if (!issuedOfferVersion || generationDisabledReason || isGenerating) return;
    setIsGenerating(true);
    try {
      const response = await fetch(
        `/api/admin/quote-requests/${quoteRequestId}/documents`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ offerVersionId: issuedOfferVersion.id })
        }
      );
      const payload = await response.json().catch(() => null) as
        | {
            message?: string;
            pending?: boolean;
            document?: AdminQuoteDocument & { url?: string };
          }
        | null;
      if (!response.ok) {
        throw new Error(
          payload?.message ?? 'PDF-ja ponudbe ni bilo mogoče ustvariti.'
        );
      }
      if (payload?.document) {
        setDocumentList((current) => [
          payload.document as AdminQuoteDocument,
          ...current.filter(
            (document) => document.id !== payload.document?.id
          )
        ]);
      }
      if (payload?.pending) {
        toast.info(
          payload.message ??
            'PDF ponudbe se ustvarja. Čez trenutek osvežite stran.'
        );
        window.setTimeout(() => router.refresh(), 1_000);
      } else {
        toast.success(payload?.message ?? 'PDF ponudbe je ustvarjen.');
        router.refresh();
      }
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : 'PDF-ja ponudbe ni bilo mogoče ustvariti.'
      );
    } finally {
      setIsGenerating(false);
    }
  };

  const openDocument = (document: AdminQuoteDocument) => {
    window.open(
      documentUrl(quoteRequestId, document.id),
      '_blank',
      'noopener,noreferrer'
    );
  };

  return (
    <AdminDetailDocumentsCard
      notice={
        showGenerationDisabledReason ? generationDisabledReason : undefined
      }
      noticeId={generationReasonId}
      testId="quote-documents-card"
    >
      {DOCUMENT_TYPES.map((documentType) => {
        const typeDocuments = groupedDocuments[documentType.key];
        const latestDocument = typeDocuments[0] ?? null;
        const olderDocuments = typeDocuments.slice(1);
        const displayedDocument =
          documentType.key === 'offer'
            ? primaryOfferVersionDocument
            : latestDocument;

        return (
          <AdminDetailDocumentTypeRow
            key={documentType.key}
            testId={`quote-document-type-${documentType.key}`}
            summary={
              <AdminDetailDocumentSummary label={documentType.label}>
                {documentType.key === 'purchase_order' && quoteCode ? (
                  <p
                    id={purchaseOrderAssociationId}
                    data-testid="quote-purchase-order-association"
                    className="mt-0.5 break-words text-[11px] leading-4 text-slate-500"
                  >
                    Številka povpraševanja:{' '}
                    <span className="font-medium text-slate-700">{quoteCode}</span>
                  </p>
                ) : null}
                {displayedDocument ? (
                  <AdminDetailDocumentCurrent
                    href={documentUrl(
                      quoteRequestId,
                      displayedDocument.id
                    )}
                    filename={displayedDocument.filename}
                    badge={
                      displayedDocument.source === 'manual_upload' ? (
                        <span className="shrink-0 rounded border border-slate-300 bg-slate-50 px-1 py-px text-[9px] font-semibold leading-3 text-slate-600">
                          Ročno
                        </span>
                      ) : undefined
                    }
                    timestamp={formatTimestamp(displayedDocument.createdAt)}
                  />
                ) : (
                  <AdminDetailDocumentEmpty>
                    {documentType.key === 'purchase_order'
                      ? 'Naročilnico lahko naloži administrator ali stranka pri sprejemu ponudbe.'
                      : issuedOfferVersion
                        ? 'PDF izdane ponudbe še ni ustvarjen.'
                        : 'PDF se ustvari iz izdane ponudbe.'}
                  </AdminDetailDocumentEmpty>
                )}
              </AdminDetailDocumentSummary>
            }
            actions={
              <AdminDetailDocumentActions>
                <input
                  ref={(element) => {
                    uploadInputRefs.current[documentType.key] = element;
                  }}
                  type="file"
                  accept="application/pdf,.pdf"
                  className="hidden"
                  disabled={
                    !primaryOfferVersion || Boolean(uploadingType) || isGenerating
                  }
                  aria-label={documentType.uploadLabel}
                  aria-describedby={documentType.key === 'purchase_order' ? purchaseOrderAssociationId : undefined}
                  data-testid={`quote-document-upload-input-${documentType.key}`}
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) {
                      void handleUpload(documentType.key, file);
                    }
                    event.currentTarget.value = '';
                  }}
                />

                {displayedDocument ? (
                  <AdminDetailDocumentOpenLink
                    href={documentUrl(
                      quoteRequestId,
                      displayedDocument.id
                    )}
                    target="_blank"
                    rel="noreferrer"
                    aria-label={documentType.openLabel}
                  >
                    Odpri
                  </AdminDetailDocumentOpenLink>
                ) : documentType.key === 'offer' &&
                  !generationDisabledReason ? (
                  <AdminDetailDocumentPrimaryAction
                    type="button"
                    onClick={() => void generateOfferDocument()}
                    disabled={isGenerating || Boolean(uploadingType)}
                    title="Ustvari uradni PDF ponudbe"
                    aria-label="Ustvari uradni PDF ponudbe"
                    data-testid="quote-document-generate-offer"
                  >
                    {isGenerating ? (
                      <Spinner size="sm" className="text-slate-500" />
                    ) : (
                      'Ustvari'
                    )}
                  </AdminDetailDocumentPrimaryAction>
                ) : (
                  <AdminDetailDocumentPrimaryAction
                    type="button"
                    onClick={() =>
                      uploadInputRefs.current[documentType.key]?.click()
                    }
                    disabled={
                      !primaryOfferVersion ||
                      Boolean(uploadingType) ||
                      isGenerating
                    }
                    title={
                      primaryOfferVersion
                        ? documentType.uploadLabel
                        : 'Najprej ustvarite osnutek ponudbe.'
                    }
                    aria-label={documentType.uploadLabel}
                    aria-describedby={documentType.key === 'purchase_order' ? purchaseOrderAssociationId : undefined}
                    data-testid={`quote-document-upload-${documentType.key}`}
                  >
                    {uploadingType === documentType.key ? (
                      <Spinner size="sm" className="text-slate-500" />
                    ) : (
                      'Naloži'
                    )}
                  </AdminDetailDocumentPrimaryAction>
                )}

                <RowActionsDropdown
                  label={`Dejanja za ${documentType.label}`}
                  triggerClassName="!h-7 !w-7 !text-slate-500"
                  menuWidth={174}
                  menuClassName="!w-full"
                  items={[
                    ...(documentType.key === 'offer'
                      ? [
                          {
                            key: 'generate',
                            label: generatedIssuedOfferDocument
                              ? 'Uradni PDF je ustvarjen'
                              : 'Ustvari uradni PDF',
                            icon: <PdfFileIcon />,
                            onSelect: () => void generateOfferDocument(),
                            disabled:
                              Boolean(generationDisabledReason) ||
                              isGenerating ||
                              Boolean(uploadingType)
                          }
                        ]
                      : []),
                    {
                      key: 'upload',
                      label: displayedDocument
                        ? 'Naloži novo različico'
                        : 'Naloži PDF',
                      icon: <UploadIcon />,
                      onSelect: () =>
                        uploadInputRefs.current[documentType.key]?.click(),
                      disabled:
                        !primaryOfferVersion ||
                        Boolean(uploadingType) ||
                        isGenerating
                    },
                    ...(displayedDocument
                      ? [
                          {
                            key: 'download',
                            label: 'Prenesi',
                            icon: <DownloadIcon />,
                            onSelect: () => openDocument(displayedDocument)
                          }
                        ]
                      : [])
                  ]}
                />
              </AdminDetailDocumentActions>
            }
            history={
              documentType.key === 'offer' &&
              (olderPrimaryOfferDocuments.length > 0 ||
                olderOfferVersions.length > 0) ? (
                <AdminDetailDocumentHistory testId="quote-offer-version-history">
                  {olderPrimaryOfferDocuments.map((document) => (
                    <AdminDetailDocumentHistoryItem
                      key={document.id}
                      testId="quote-offer-document-history-item"
                    >
                      <AdminDetailDocumentHistoryLink
                        href={documentUrl(quoteRequestId, document.id)}
                        target="_blank"
                        rel="noreferrer"
                        title={document.filename}
                      >
                        {document.filename}
                      </AdminDetailDocumentHistoryLink>
                      <AdminDetailDocumentHistoryMeta>
                        {document.source === 'manual_upload'
                          ? 'Ročno'
                          : 'Ustvarjeno'}
                        {' · '}
                        {formatTimestamp(document.createdAt)}
                      </AdminDetailDocumentHistoryMeta>
                    </AdminDetailDocumentHistoryItem>
                  ))}
                  {olderOfferVersions.map((version) => {
                    const versionDocument =
                      offerDocumentByVersionId.get(version.id) ?? null;

                    return (
                      <AdminDetailDocumentHistoryItem
                        key={version.id}
                        testId="quote-offer-version-history-item"
                      >
                        <div className="min-w-0">
                          <div className="flex min-w-0 flex-wrap items-center gap-2">
                            {versionDocument ? (
                              <a
                                href={documentUrl(
                                  quoteRequestId,
                                  versionDocument.id
                                )}
                                target="_blank"
                                rel="noreferrer"
                                className="min-w-0 truncate font-semibold text-[color:var(--blue-500)] hover:text-[color:var(--blue-600)]"
                                title={versionDocument.filename}
                              >
                                {offerVersionLabel(version)}
                              </a>
                            ) : (
                              <span className="min-w-0 truncate font-semibold text-slate-700">
                                {offerVersionLabel(version)}
                              </span>
                            )}
                            {versionDocument?.source === 'manual_upload' ? (
                              <span className="rounded border border-slate-300 bg-white px-1 py-px text-[9px] font-semibold leading-3 text-slate-600">
                                Ročno
                              </span>
                            ) : null}
                            <span className="whitespace-nowrap text-slate-500">
                              {OFFER_VERSION_STATUS_LABELS[
                                String(version.status)
                              ] ?? String(version.status)}
                            </span>
                          </div>
                          <p className="mt-0.5 text-slate-500">
                            Ustvarjeno {formatTimestamp(version.createdAt)}
                            {' · '}izdano{' '}
                            {formatOptionalTimestamp(version.issuedAt)}
                            {' · '}velja do{' '}
                            {formatOptionalTimestamp(version.validUntil)}
                          </p>
                        </div>
                        <span className="whitespace-nowrap text-right font-semibold text-slate-700">
                          {formatCurrency(version.total, version.currency)}
                        </span>
                      </AdminDetailDocumentHistoryItem>
                    );
                  })}
                </AdminDetailDocumentHistory>
              ) : documentType.key !== 'offer' && olderDocuments.length > 0 ? (
                <AdminDetailDocumentHistory>
                  {olderDocuments.map((document) => (
                    <AdminDetailDocumentHistoryItem key={document.id}>
                      <AdminDetailDocumentHistoryLink
                        href={documentUrl(quoteRequestId, document.id)}
                        target="_blank"
                        rel="noreferrer"
                        title={document.filename}
                      >
                        {document.filename}
                      </AdminDetailDocumentHistoryLink>
                      <AdminDetailDocumentHistoryMeta>
                        {document.source === 'manual_upload' ? 'Ročno · ' : ''}
                        {formatTimestamp(document.createdAt)}
                      </AdminDetailDocumentHistoryMeta>
                    </AdminDetailDocumentHistoryItem>
                  ))}
                </AdminDetailDocumentHistory>
              ) : undefined
            }
          />
        );
      })}
    </AdminDetailDocumentsCard>
  );
}
