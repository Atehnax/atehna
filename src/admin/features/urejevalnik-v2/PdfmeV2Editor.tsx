'use client';

import type { Font } from '@pdfme/common';
import type { Designer as PdfmeDesigner, DesignerSelection } from '@pdfme/ui';
import { useEffect, useRef, useState } from 'react';

import {
  PDFME_V2_BOLD_FONT_NAME,
  PDFME_V2_DOCUMENT_TYPES,
  PDFME_V2_DOCUMENT_TYPE_LABELS,
  PDFME_V2_REGULAR_FONT_NAME,
  clonePdfmeV2CanonicalTemplate,
  createDefaultPdfmeV2Templates,
  createPdfmeV2SampleRenderData,
  reconcilePdfmeV2DesignerTemplate,
  type PdfmeV2CanonicalTemplate,
  type PdfmeV2DocumentType
} from '@/shared/domain/pdfmeV2';
import { PDFME_V2_PLUGINS } from '@/shared/pdfmeV2';
import { AdminPageHeader } from '@/shared/ui/admin-primitives';
import Button from '@/shared/ui/button/Button';
import { CustomSelect } from '@/shared/ui/select';

import { installModifierSelectionAdapter } from './selectionToggleAdapter';
import { reconcilePdfmeV2SelectionSnapshot } from './selectionSnapshotReconciliation';
import styles from './pdfmeV2Editor.module.css';

const SAMPLE_ROW_COUNTS = [0, 1, 27, 100] as const;
type SampleRowCount = (typeof SAMPLE_ROW_COUNTS)[number];
type SampleRowCountValue = `${SampleRowCount}`;
type EditorTone = 'ready' | 'busy' | 'error';

const DOCUMENT_TYPE_OPTIONS = PDFME_V2_DOCUMENT_TYPES.map((type) => ({
  value: type,
  label: PDFME_V2_DOCUMENT_TYPE_LABELS[type]
}));

const SAMPLE_ROW_COUNT_OPTIONS: ReadonlyArray<{
  value: SampleRowCountValue;
  label: string;
}> = SAMPLE_ROW_COUNTS.map((count) => ({
  value: String(count) as SampleRowCountValue,
  label: count === 1 ? '1 postavka' : `${count} postavk`
}));

const SLOVENE_SCHEMA_TYPE_LABELS: Readonly<Record<string, string>> = {
  text: 'besedilo',
  multiVariableText: 'dinamično besedilo',
  image: 'slika',
  svg: 'vektorska slika',
  line: 'črta',
  rectangle: 'pravokotnik',
  ellipse: 'elipsa',
  table: 'tabela',
  list: 'seznam'
};

const SLOVENE_PDFME_LABELS: Readonly<Record<string, string>> = {
  cancel: 'Prekliči',
  close: 'Zapri',
  set: 'Nastavi',
  clear: 'Počisti',
  field: 'Element',
  fieldName: 'Ime elementa',
  align: 'Poravnava',
  width: 'Širina',
  opacity: 'Prosojnost',
  height: 'Višina',
  rotate: 'Zasuk',
  edit: 'Uredi',
  required: 'Obvezno',
  editable: 'Uredljivo',
  plsInputName: 'Vnesite ime',
  fieldMustUniq: 'Ime elementa mora biti enolično.',
  notUniq: 'Ime že obstaja.',
  noKeyName: 'Element nima imena.',
  fieldsList: 'Plasti',
  editField: 'Uredi element',
  type: 'Vrsta',
  errorOccurred: 'Prišlo je do napake.',
  errorBulkUpdateFieldName: 'Imen izbranih elementov ni bilo mogoče spremeniti.',
  commitBulkUpdateFieldName: 'Potrdi imena',
  bulkUpdateFieldName: 'Preimenuj izbrane elemente',
  addPageAfter: 'Dodaj stran za trenutno',
  removePage: 'Odstrani stran',
  removePageConfirm: 'Ali želite odstraniti trenutno stran?',
  zoomIn: 'Povečaj',
  zoomOut: 'Pomanjšaj',
  fitWidth: 'Prilagodi širini',
  fitHeight: 'Prilagodi višini',
  'schemas.color': 'Barva',
  'schemas.borderWidth': 'Debelina obrobe',
  'schemas.borderColor': 'Barva obrobe',
  'schemas.backgroundColor': 'Barva ozadja',
  'schemas.textColor': 'Barva besedila',
  'schemas.bgColor': 'Barva ozadja',
  'schemas.horizontal': 'Vodoravno',
  'schemas.vertical': 'Navpično',
  'schemas.left': 'Levo',
  'schemas.center': 'Sredina',
  'schemas.right': 'Desno',
  'schemas.top': 'Zgoraj',
  'schemas.middle': 'Sredina',
  'schemas.bottom': 'Spodaj',
  'schemas.padding': 'Odmik',
  'schemas.text.fontName': 'Pisava',
  'schemas.text.size': 'Velikost',
  'schemas.text.spacing': 'Razmik znakov',
  'schemas.text.textAlign': 'Poravnava besedila',
  'schemas.text.verticalAlign': 'Navpična poravnava',
  'schemas.text.lineHeight': 'Višina vrstice',
  'schemas.text.overflow': 'Prelivanje',
  'schemas.text.overflowVisible': 'Vidno',
  'schemas.text.overflowExpand': 'Razširi element',
  'schemas.table.showHead': 'Prikaži glavo',
  'schemas.table.repeatHead': 'Ponovi glavo',
  'schemas.table.headStyle': 'Slog glave',
  'schemas.table.bodyStyle': 'Slog telesa',
  'schemas.table.columnStyle': 'Slog stolpcev',
  'schemas.list.listStyle': 'Slog seznama',
  'schemas.list.bullet': 'Oznake',
  'schemas.list.ordered': 'Oštevilčeno',
  'schemas.list.markerWidth': 'Širina oznake',
  'schemas.list.markerGap': 'Razmik oznake',
  'schemas.list.indentSize': 'Zamik',
  'schemas.list.itemSpacing': 'Razmik postavk',
  'schemas.list.addItem': 'Dodaj postavko',
  'schemas.list.removeItem': 'Odstrani postavko',
  'schemas.list.indentItem': 'Povečaj zamik',
  'schemas.list.outdentItem': 'Zmanjšaj zamik'
};

async function fetchFont(url: string, signal: AbortSignal): Promise<ArrayBuffer> {
  const response = await fetch(url, { cache: 'force-cache', signal });
  if (!response.ok) {
    throw new Error('Pisave za urejevalnik ni bilo mogoče naložiti.');
  }
  return response.arrayBuffer();
}

async function loadDesignerFonts(signal: AbortSignal): Promise<Font> {
  const [regular, bold] = await Promise.all([
    fetchFont('/fonts/NotoSans-Regular.ttf', signal),
    fetchFont('/fonts/NotoSans-Bold.ttf', signal)
  ]);
  return {
    [PDFME_V2_REGULAR_FONT_NAME]: {
      data: regular,
      fallback: true
    },
    [PDFME_V2_BOLD_FONT_NAME]: {
      data: bold
    }
  };
}

function selectionDescription(selection: DesignerSelection): string {
  const count = selection.schemas.length;
  if (count === 0) return 'Ni izbora';
  const types = [
    ...new Set(
      selection.schemas.map(
        (schema) => SLOVENE_SCHEMA_TYPE_LABELS[schema.type] ?? 'element'
      )
    )
  ].join(', ');
  if (count === 1) return '1 izbran element · ' + types;
  if (count === 2) return '2 izbrana elementa · ' + types;
  return String(count) + ' izbranih elementov · ' + types;
}

async function responseError(response: Response): Promise<string> {
  try {
    const payload = (await response.json()) as { message?: unknown };
    return typeof payload.message === 'string'
      ? payload.message
      : 'Predogleda PDF ni bilo mogoče ustvariti.';
  } catch {
    return 'Predogleda PDF ni bilo mogoče ustvariti.';
  }
}

export default function PdfmeV2Editor() {
  const designerHostRef = useRef<HTMLDivElement>(null);
  const designerRef = useRef<PdfmeDesigner | null>(null);
  const previewUrlRef = useRef<string | null>(null);
  const suppressTemplateChangeRef = useRef(false);
  const previewRequestRef = useRef<{
    id: number;
    controller: AbortController | null;
  }>({ id: 0, controller: null });
  const seedTemplatesRef = useRef(createDefaultPdfmeV2Templates());
  const canonicalRef = useRef<PdfmeV2CanonicalTemplate>(
    clonePdfmeV2CanonicalTemplate(seedTemplatesRef.current.order_summary)
  );

  const [documentType, setDocumentType] =
    useState<PdfmeV2DocumentType>('order_summary');
  const [rowCount, setRowCount] = useState<SampleRowCount>(1);
  const [editorStatus, setEditorStatus] = useState('Nalaganje pdfme Designerja …');
  const [editorTone, setEditorTone] = useState<EditorTone>('busy');
  const [designerReady, setDesignerReady] = useState(false);
  const [selection, setSelection] = useState('Ni izbora');
  const [dirty, setDirty] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewBusy, setPreviewBusy] = useState(false);

  const replacePreviewUrl = (next: string | null) => {
    const previous = previewUrlRef.current;
    previewUrlRef.current = next;
    setPreviewUrl(next);
    if (previous) URL.revokeObjectURL(previous);
  };

  const updateDesignerTemplate = (canonical: PdfmeV2CanonicalTemplate) => {
    suppressTemplateChangeRef.current = true;
    designerRef.current?.updateTemplate(canonical.template);
    requestAnimationFrame(() => {
      suppressTemplateChangeRef.current = false;
    });
  };

  useEffect(() => {
    const host = designerHostRef.current;
    if (!host) return;

    const abortController = new AbortController();
    let cancelled = false;
    let localDesigner: PdfmeDesigner | null = null;
    let removeSelectionAdapter: (() => void) | null = null;
    let announcedReady = false;
    let acceptUserTemplateChanges = false;
    const enableUserTemplateChanges = () => {
      acceptUserTemplateChanges = true;
    };
    host.addEventListener('pointerdown', enableUserTemplateChanges, true);
    host.addEventListener('keydown', enableUserTemplateChanges, true);

    const initialize = async () => {
      try {
        const [{ Designer }, font] = await Promise.all([
          import('@pdfme/ui'),
          loadDesignerFonts(abortController.signal)
        ]);
        if (cancelled) return;

        localDesigner = new Designer({
          domContainer: host,
          template: clonePdfmeV2CanonicalTemplate(canonicalRef.current).template,
          plugins: PDFME_V2_PLUGINS,
          options: {
            font,
            lang: 'en',
            labels: SLOVENE_PDFME_LABELS,
            sidebarOpen: true,
            zoomLevel: 0.9,
            maxZoom: 200,
            theme: {
              token: {
                colorPrimary: '#1982bf',
                colorPrimaryBg: '#e8f4fb',
                colorError: '#94a3b8',
                colorBgBase: '#ffffff',
                colorBgLayout: '#e2e8f0',
                colorBgContainer: '#ffffff',
                colorBgElevated: '#ffffff',
                colorText: '#111827',
                colorTextSecondary: '#4b5563',
                colorTextTertiary: '#64748b',
                colorTextPlaceholder: '#94a3b8',
                colorBorder: '#cbd5e1',
                colorBorderSecondary: '#e2e8f0',
                colorSplit: '#e2e8f0',
                colorFill: 'rgba(15, 23, 42, 0.12)',
                colorFillSecondary: 'rgba(15, 23, 42, 0.08)',
                colorFillTertiary: 'rgba(15, 23, 42, 0.05)',
                colorFillQuaternary: 'rgba(15, 23, 42, 0.03)'
              }
            }
          }
        });
        designerRef.current = localDesigner;

        localDesigner.onChangeTemplate((template) => {
          if (cancelled) return;
          const previousCanonical = canonicalRef.current;
          const reconciled = reconcilePdfmeV2DesignerTemplate(
            previousCanonical,
            template,
            () => crypto.randomUUID()
          );
          canonicalRef.current = reconciled;
          if (
            suppressTemplateChangeRef.current
            || !acceptUserTemplateChanges
            || JSON.stringify(reconciled.template) === JSON.stringify(previousCanonical.template)
          ) return;
          setDirty(true);
          setEditorStatus('Neshranjene spremembe');
          setEditorTone('ready');
        });
        localDesigner.onSaveTemplate(() => {
          setEditorStatus('Dokazni način: shranjevanje je zaklenjeno.');
          setEditorTone('ready');
        });
        removeSelectionAdapter = installModifierSelectionAdapter({
          container: host,
          designer: localDesigner,
          onSelectionChange: (nextSelection) => {
            canonicalRef.current = reconcilePdfmeV2SelectionSnapshot(
              canonicalRef.current,
              nextSelection,
              () => crypto.randomUUID()
            );
            setSelection(selectionDescription(nextSelection));
            if (!announcedReady) {
              announcedReady = true;
              setDesignerReady(true);
              setEditorStatus('pdfme 6.1.12 je pripravljen');
              setEditorTone('ready');
            }
          }
        });

        setEditorStatus('Priprava delovne površine pdfme …');
      } catch (error) {
        if (cancelled || abortController.signal.aborted) return;
        console.error('Failed to initialize pdfme v2 proof editor', error);
        setDesignerReady(false);
        setEditorStatus('Urejevalnika ni bilo mogoče zagnati.');
        setEditorTone('error');
      }
    };

    void initialize();
    return () => {
      cancelled = true;
      abortController.abort();
      host.removeEventListener('pointerdown', enableUserTemplateChanges, true);
      host.removeEventListener('keydown', enableUserTemplateChanges, true);
      removeSelectionAdapter?.();
      if (designerRef.current === localDesigner) designerRef.current = null;
      localDesigner?.destroy();
    };
  }, []);

  useEffect(
    () => () => {
      previewRequestRef.current.controller?.abort();
      previewRequestRef.current.id += 1;
      previewRequestRef.current.controller = null;
      if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    },
    []
  );

  const selectDocumentType = (nextType: PdfmeV2DocumentType) => {
    previewRequestRef.current.controller?.abort();
    previewRequestRef.current.id += 1;
    previewRequestRef.current.controller = null;
    setPreviewBusy(false);
    const nextCanonical = clonePdfmeV2CanonicalTemplate(
      seedTemplatesRef.current[nextType]
    );
    canonicalRef.current = nextCanonical;
    updateDesignerTemplate(nextCanonical);
    setDocumentType(nextType);
    setDirty(false);
    setSelection('Ni izbora');
    setEditorStatus('Naložena je privzeta predloga.');
    setEditorTone('ready');
    replacePreviewUrl(null);
  };

  const discardChanges = () => {
    previewRequestRef.current.controller?.abort();
    previewRequestRef.current.id += 1;
    previewRequestRef.current.controller = null;
    setPreviewBusy(false);
    const nextCanonical = clonePdfmeV2CanonicalTemplate(
      seedTemplatesRef.current[documentType]
    );
    canonicalRef.current = nextCanonical;
    updateDesignerTemplate(nextCanonical);
    setDirty(false);
    setSelection('Ni izbora');
    setEditorStatus('Spremembe so zavržene.');
    setEditorTone('ready');
    replacePreviewUrl(null);
  };

  const generatePreview = async () => {
    previewRequestRef.current.controller?.abort();
    const requestId = previewRequestRef.current.id + 1;
    const controller = new AbortController();
    previewRequestRef.current = {
      id: requestId,
      controller
    };
    setPreviewBusy(true);
    setEditorStatus('Generator ustvarja PDF …');
    setEditorTone('busy');
    try {
      const canonicalTemplate = clonePdfmeV2CanonicalTemplate(canonicalRef.current);
      const renderData = createPdfmeV2SampleRenderData(
        canonicalTemplate.envelope.documentType,
        rowCount
      );
      const response = await fetch(
        '/api/admin/order-document-templates-v2/preview',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          cache: 'no-store',
          signal: controller.signal,
          body: JSON.stringify({ canonicalTemplate, renderData })
        }
      );
      if (!response.ok) throw new Error(await responseError(response));
      if (previewRequestRef.current.id !== requestId) return;

      const blob = await response.blob();
      if (previewRequestRef.current.id !== requestId) return;
      if (blob.type !== 'application/pdf') {
        throw new Error('Strežnik ni vrnil dokumenta PDF.');
      }
      replacePreviewUrl(URL.createObjectURL(blob));
      setEditorStatus('PDF je ustvarjen iz trenutne neshranjene predloge.');
      setEditorTone('ready');
    } catch (error) {
      if (
        previewRequestRef.current.id !== requestId
        || (error instanceof DOMException && error.name === 'AbortError')
      ) {
        return;
      }
      console.error('Failed to generate pdfme v2 preview', error);
      setEditorStatus(
        error instanceof Error
          ? error.message
          : 'Predogleda PDF ni bilo mogoče ustvariti.'
      );
      setEditorTone('error');
    } finally {
      if (previewRequestRef.current.id === requestId) {
        previewRequestRef.current.controller = null;
        setPreviewBusy(false);
      }
    }
  };

  return (
    <div className={styles.page}>
      <AdminPageHeader
        title="Predloge PDF"
        description="Uredite postavitev dokumenta neposredno v pdfme Designerju. Končni prelom strani vedno preverite v predogledu PDF."
        actions={
          <span className={styles.versionBadge}>
            Ločen dokaz · pdfme 6.1.12
          </span>
        }
      />

      <section className={styles.workspace} data-testid="pdfme-v2-workspace">
        <div className={styles.toolbar}>
          <div className={styles.field} data-testid="document-type">
            <span className={styles.fieldLabel}>Vrsta dokumenta</span>
            <CustomSelect<PdfmeV2DocumentType>
              value={documentType}
              onChange={selectDocumentType}
              options={DOCUMENT_TYPE_OPTIONS}
              ariaLabel="Vrsta dokumenta"
              containerClassName={styles.documentSelect}
            />
          </div>

          <div className={styles.field} data-testid="sample-row-count">
            <span className={styles.fieldLabel}>Vzorčne postavke</span>
            <CustomSelect<SampleRowCountValue>
              value={String(rowCount) as SampleRowCountValue}
              onChange={(value) => setRowCount(Number(value) as SampleRowCount)}
              options={SAMPLE_ROW_COUNT_OPTIONS}
              ariaLabel="Število vzorčnih postavk"
              containerClassName={styles.rowSelect}
            />
            <span className={styles.fieldHelp}>Samo za predogled PDF</span>
          </div>

          <div className={styles.toolbarSpacer} />
          <div className={styles.toolbarActions}>
            <Button
              variant="default"
              size="toolbar"
              type="button"
              onClick={discardChanges}
              disabled={!dirty}
            >
              Zavrzi
            </Button>
            <Button
              variant="default"
              size="toolbar"
              type="button"
              disabled
              title="Shranjevanje se odklene šele po uspešnem dokazu javnih API-jev."
              data-testid="save-disabled"
            >
              Shrani
            </Button>
            <Button
              variant="primary"
              size="toolbar"
              type="button"
              onClick={() => void generatePreview()}
              disabled={previewBusy || !designerReady}
              data-testid="generate-preview"
            >
              {previewBusy ? 'Ustvarjam …' : 'Predogled PDF'}
            </Button>
          </div>
        </div>

        <div className={styles.proofBar}>
          <div className={styles.proofSummary}>
            <span
              className={styles.status}
              data-tone={editorTone}
              data-testid="editor-status"
              role="status"
            >
              {editorStatus}
            </span>
            <span className={styles.selection} data-testid="selection-status">
              {selection}
            </span>
          </div>
          <span className={styles.proofHint}>
            Predogled PDF je merodajen za končni prelom strani.
          </span>
        </div>

        <div className={styles.designerViewport}>
          <div
            ref={designerHostRef}
            className={styles.designerHost}
            data-testid="designer-host"
          />
          {!designerReady && editorTone === 'busy' ? (
            <div className={styles.loading}>Nalaganje urejevalnika in pisav …</div>
          ) : null}
          {!designerReady && editorTone === 'error' ? (
            <div className={styles.errorPanel}>{editorStatus}</div>
          ) : null}

          {previewUrl ? (
            <div className={styles.previewBackdrop} data-testid="pdf-preview">
              <div className={styles.previewHeader}>
                <div>
                  <strong>Predogled ustvarjenega PDF</strong>
                  <span>
                    {rowCount === 1
                      ? '1 vzorčna postavka'
                      : String(rowCount) + ' vzorčnih postavk'}
                  </span>
                </div>
                <Button
                  variant="default"
                  size="toolbar"
                  type="button"
                  onClick={() => replacePreviewUrl(null)}
                >
                  Zapri predogled
                </Button>
              </div>
              <iframe
                className={styles.previewFrame}
                src={previewUrl}
                title="Predogled dokumenta PDF"
              />
            </div>
          ) : null}
        </div>
      </section>
    </div>
  );
}
