"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { useSearchParams } from 'next/navigation';
import { AdminPageHeader } from '@/shared/ui/admin-primitives';
import AdminPodobaTabs from './AdminPodobaTabs';
import { AlignCenterHorizontal, AlignCenterVertical, AlignEndHorizontal, AlignEndVertical, AlignStartHorizontal, AlignStartVertical, ArrowDownToLine, ChevronDown, Circle, ClipboardPaste, Columns3, Copy, Crop, Expand, FolderOpen, Hand, History, ImagePlus, Minus, MousePointer2, Plus, Redo2, Rows3, Save, Send, Shapes, Square, Trash2, Type, Undo2, X } from 'lucide-react';
import { blankLogoProject, cloneLogoProject, LOGO_PLACEMENT_IDS, LOGO_PLACEMENT_LABELS, logoVariantHasDraft, logoVariantUsages, type LogoAssignment, type LogoBounds, type LogoLayer, type LogoLibrary, type LogoLibraryAction, type LogoPlacementId, type LogoPreview, type LogoProject, type LogoSourceAsset, type LogoVariant, type PublishedLogoAsset, type PublishedSiteLogoConfig } from '@/shared/domain/logo/logoLibrary';
import { alignLogoLayers, copyLogoLayer, duplicateLogoLayers, findLogoLayer, groupLogoLayers, removeLogoLayers, reorderLogoLayer, resizeLogoLayer, trimLogoCanvas, ungroupLogoLayer, updateLogoLayers, validateLogoProject } from '@/shared/domain/logo/logoProject';
import type { SiteNavigationConfig } from '@/shared/domain/navigation/siteNavigation';
import LogoEditorCanvas, { LogoCanvasArtwork, LogoEditorFonts } from './LogoEditorCanvas';
import LogoEditorProperties, { cropLogoImage, LogoLayersPanel, type LogoEditorPropertiesProps } from './LogoEditorProperties';
import LogoImageCropDialog from './LogoImageCropDialog';
import LogoPlacementPreview from './LogoPlacementPreview';
import LogoPlacementSelector from './LogoPlacementSelector';
import styles from './LogoEditor.module.css';
import { copyLogoSelection, pasteLogoSelection } from '@/shared/domain/logo/logoClipboard';
import { isLogoLayerLocked } from '@/shared/domain/logo/logoProject';
import { AdminSaveStatus } from '@/shared/ui/admin-save-status';

// Persisted JSON object-key order must not count as an edit.
const signature = (project: LogoProject, name = '') => JSON.stringify([validateLogoProject(project), name.trim()]);
const errorMessage = (error: unknown) => error instanceof Error ? error.message : 'Dejanje ni uspelo. Poskusite znova.';
type LibraryResponse = { library: LogoLibrary; published: PublishedSiteLogoConfig };
type ModalState = null | { type: 'create' } | { type: 'publish' } | { type: 'delete'; id: string } | { type: 'restore'; revisionId: string };
type HistoryState = { past: LogoProject[]; future: LogoProject[]; gesture: LogoProject | null };
function LogoDialog({ title, children, onClose, className = '' }: { title: string; children: ReactNode; onClose: () => void; className?: string }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const node = ref.current, previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    node?.showModal();
    return () => { node?.close(); if (previous?.isConnected) previous.focus(); };
  }, []);
  return <dialog ref={ref} className={`${styles.workspace} ${styles.dialog} ${className}`} onCancel={event => { event.preventDefault(); onClose(); }} aria-label={title}>
    <div className={styles.dialogHeading}><h2>{title}</h2><button type="button" className={styles.iconButton} aria-label="Zapri okno" onClick={onClose}><X /></button></div>{children}
  </dialog>;
}
function LogoThumbnail({ project, assets }: { project: LogoProject; assets: LogoSourceAsset[] }) {
  const scale = Math.min(236 / project.canvas.width, 65 / project.canvas.height);
  return <div className={`${styles.thumbnail} ${styles.checkerboard}`}><div style={{ position: 'relative', width: project.canvas.width * scale, height: project.canvas.height * scale }}><div style={{ position: 'absolute', width: project.canvas.width, height: project.canvas.height, transform: `scale(${scale})`, transformOrigin: 'top left', overflow: 'hidden' }}><LogoCanvasArtwork layers={project.layers} assets={assets} /></div></div></div>;
}
function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob), anchor = document.createElement('a'); anchor.href = url; anchor.download = name; anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function starterProject(kind: 'blank' | 'wordmark' | 'symbol'): LogoProject {
  const project = blankLogoProject(), base = { rotation: 0, opacity: 1, visible: true, locked: false };
  const text = (name: string, value: string, x: number, y: number, width: number, size: number): LogoLayer => ({ ...base, id: crypto.randomUUID(), name, type: 'text', text: value, x, y, width, height: size * 1.3, fontFamily: 'Inter', fontSize: size, fontWeight: 600, fontStyle: 'normal', fill: '#0f172a', textAlign: 'left', lineHeight: 1.2, letterSpacing: 0 });
  if (kind === 'symbol') {
    project.canvas = { width: 240, height: 240 };
    project.layers = [{ ...base, id: crypto.randomUUID(), name: 'Simbol', type: 'shape', shape: 'ellipse', x: 30, y: 30, width: 180, height: 180, fill: '#1687be', stroke: 'none', strokeWidth: 0, radius: 0 }, { ...text('Začetnica', 'A', 30, 62, 180, 96), fill: '#ffffff', textAlign: 'center' } as LogoLayer];
  } else if (kind === 'wordmark') project.layers = [text('Naziv podjetja', 'Atehna', 38, 42, 400, 76), text('Pravna oblika', 'd.o.o.', 434, 90, 156, 26), { ...text('Dopolnilno besedilo', 'Vaše dopolnilno besedilo', 42, 158, 540, 22), fontWeight: 400, fill: '#64748b' } as LogoLayer];
  return project;
}

export default function AdminLogoPageClient({ initialLibrary, initialPublished, navigation }: { initialLibrary: LogoLibrary; initialPublished: PublishedSiteLogoConfig; navigation: SiteNavigationConfig }) {
  const query = useSearchParams();
  const initialPurpose = LOGO_PLACEMENT_IDS.find(id => id === query.get('purpose')) ?? 'header-desktop';
  const first = initialLibrary.variants.find(variant => variant.id === query.get('variant')) ?? initialLibrary.variants[0];
  const [library, setLibrary] = useState(initialLibrary), [published, setPublished] = useState(initialPublished);
  const [activeId, setActiveId] = useState(first?.id ?? ''), [project, setProject] = useState(() => cloneLogoProject(first?.draft ?? blankLogoProject())), [name, setName] = useState(first?.name ?? 'Nov logotip');
  const [baseline, setBaseline] = useState(() => signature(first?.draft ?? blankLogoProject(), first?.name ?? 'Nov logotip'));
  const [selected, setSelected] = useState<string[]>([]), [libraryOpen, setLibraryOpen] = useState(!first), [purpose, setPurpose] = useState<LogoPlacementId>(initialPurpose);
  const [tool, setTool] = useState<'select' | 'hand'>('select'), [keepRatio, setKeepRatio] = useState(true), [snap, setSnap] = useState(true), [background, setBackground] = useState<'transparent' | 'light' | 'dark'>('transparent');
  const [alignment, setAlignment] = useState<'canvas' | 'selection'>('canvas'), [busy, setBusy] = useState(''), [notice, setNotice] = useState(''), [error, setError] = useState('');
  const [preview, setPreview] = useState<{ value: LogoPreview; key: string } | null>(null), [previewError, setPreviewError] = useState(''), [previewPending, setPreviewPending] = useState(false), [previewMode, setPreviewMode] = useState<'draft' | 'published'>('draft');
  const [modal, setModal] = useState<ModalState>(null), [newName, setNewName] = useState('Nov logotip'), [starter, setStarter] = useState<'blank' | 'wordmark' | 'symbol' | 'copy'>('blank'), [cropId, setCropId] = useState<string | null>(null), [restoreId, setRestoreId] = useState('');
  const [, historyChanged] = useState(0);
  const [copyProject, setCopyProject] = useState<LogoProject | null>(null), [clipboard, setClipboard] = useState<LogoLayer[]>([]);
  const pasteCount = useRef(0);
  const [deleteReplacement, setDeleteReplacement] = useState('');
  const workspace = useRef<HTMLDivElement>(null), fileInput = useRef<HTMLInputElement>(null), projectInput = useRef<HTMLInputElement>(null);
  const projectRef = useRef(project), libraryRef = useRef(library), busyRef = useRef(false), baselineRef = useRef(baseline), draftRevision = useRef(first?.draftRevision ?? 0), uploadMode = useRef<string | null>(null);
  const history = useRef<HistoryState>({ past: [], future: [], gesture: null });
  projectRef.current = project; libraryRef.current = library; baselineRef.current = baseline;
  const active = library.variants.find(variant => variant.id === activeId), dirty = signature(project, name) !== baseline;
  const projectKey = JSON.stringify(validateLogoProject(project)), currentPreview = preview?.key === projectKey ? preview.value : null;
  const usages = active ? logoVariantUsages(library, active.id) : [];
  const deleting = modal?.type === 'delete' ? library.variants.find(variant => variant.id === modal.id) : undefined;
  const deletingUsages = deleting ? logoVariantUsages(library, deleting.id) : [];
  const replacementVariant = library.variants.find(variant => variant.id !== deleting?.id && variant.published && 'variant:' + variant.id === deleteReplacement);
  const deleteAssignment: LogoAssignment | undefined = deleteReplacement === 'original'
    ? { variantId: null, fallback: 'original' }
    : replacementVariant ? { variantId: replacementVariant.id, fallback: 'default' } : undefined;
  const replacementLabel = deleteReplacement === 'original' ? 'Izvirni logotip' : replacementVariant?.name;

  const draftAsset: PublishedLogoAsset | null = currentPreview ? { variantId: activeId || null, name, revision: 'private-preview', pngUrl: currentPreview.pngDataUrl, svgUrl: 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(currentPreview.svg), width: currentPreview.width, height: currentPreview.height, bounds: currentPreview.bounds } : null;
  const cropLayer = cropId ? findLogoLayer(project, cropId) : null, cropAsset = cropLayer?.type === 'image' ? library.assets.find(asset => asset.id === cropLayer.assetId) : undefined;

  const adopt = useCallback((next: LibraryResponse) => {
    libraryRef.current = next.library; setLibrary(next.library); setPublished(next.published);
    window.dispatchEvent(new CustomEvent('admin-logo-library-changed', { detail: next.library })); return next.library;
  }, []);
  async function request(action: LogoLibraryAction): Promise<LibraryResponse> {
    const response = await fetch('/api/admin/logo-library', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(action) }), result = await response.json();
    if (!response.ok) throw new Error(result.message ?? 'Knjižnice ni mogoče posodobiti.'); return result;
  }
  async function run(label: string, job: () => Promise<void>) {
    if (busyRef.current) return; busyRef.current = true; setBusy(label); setError(''); setNotice('');
    try { await job(); } catch (cause) { setError(errorMessage(cause)); } finally { busyRef.current = false; setBusy(''); }
  }
  function change(next: LogoProject, record = true) {
    if (busyRef.current) return;
    try {
      const valid = validateLogoProject(next, libraryRef.current.assets); if (signature(valid) === signature(projectRef.current)) return;
      if (record) { history.current.past = [...history.current.past.slice(-59), cloneLogoProject(projectRef.current)]; history.current.future = []; historyChanged(value => value + 1); }
      projectRef.current = valid; setProject(valid); setNotice('');
    } catch (cause) { setError(errorMessage(cause)); }
  }
  function undo(redo = false) {
    if (busyRef.current) return;
    const from = redo ? history.current.future : history.current.past, to = redo ? history.current.past : history.current.future, next = from.pop(); if (!next) return;
    to.push(cloneLogoProject(projectRef.current)); projectRef.current = next; setProject(next); setSelected([]); historyChanged(value => value + 1);
  }
  function gestureStart() { history.current.gesture = cloneLogoProject(projectRef.current); }
  function gestureEnd() {
    const start = history.current.gesture;
    if (start && signature(start) !== signature(projectRef.current)) { history.current.past = [...history.current.past.slice(-59), start]; history.current.future = []; historyChanged(value => value + 1); }
    history.current.gesture = null;
  }
  function mayLeave() { return !dirty || window.confirm('Različica vsebuje neshranjene spremembe. Jih želite zavreči?'); }
  function openVariant(variant: LogoVariant, force = false) {
    if (!force && (variant.id === activeId || !mayLeave())) return;
    const next = cloneLogoProject(variant.draft); projectRef.current = next; setProject(next); setName(variant.name); setActiveId(variant.id); draftRevision.current = variant.draftRevision;
    setBaseline(signature(next, variant.name)); setSelected([]); setError(''); setNotice(''); setLibraryOpen(false); setRestoreId(''); history.current = { past: [], future: [], gesture: null }; historyChanged(value => value + 1);
    const params = new URLSearchParams(window.location.search); params.set('variant', variant.id); params.set('purpose', purpose); window.history.replaceState(null, '', '?' + params.toString());
  }
  async function saveWorking(): Promise<LogoLibrary> {
    const working = validateLogoProject(projectRef.current, libraryRef.current.assets), cleanName = name.trim(); if (!cleanName) throw new Error('Vnesite ime različice.');
    if (activeId && signature(projectRef.current, cleanName) === baselineRef.current) return libraryRef.current;
    const result = await request(activeId ? { action: 'save', variantId: activeId, name: cleanName, project: working, expectedRevision: libraryRef.current.revision, expectedDraftRevision: draftRevision.current } : { action: 'create', name: cleanName, project: working, expectedRevision: libraryRef.current.revision });
    const next = adopt(result), saved = activeId ? next.variants.find(item => item.id === activeId)! : next.variants[next.variants.length - 1];
    setActiveId(saved.id); draftRevision.current = saved.draftRevision; setName(saved.name); setBaseline(signature(working, saved.name)); baselineRef.current = signature(working, saved.name);
    setNotice('Osnutek je shranjen. Javna stran se ni spremenila.'); return next;
  }
  async function refresh() {
    const response = await fetch('/api/admin/logo-library', { cache: 'no-store' }), result = await response.json();
    if (!response.ok) throw new Error(result.message ?? 'Knjižnice ni mogoče osvežiti.'); adopt(result); setNotice('Knjižnica je osvežena. Vaše spremembe so ostale na platnu.');
  }
  function beginCreate(source?: LogoVariant | 'current') {
    if ((!source || (source !== 'current' && source.id !== activeId)) && !mayLeave()) return;
    const current = source === 'current' || source?.id === activeId;
    setCopyProject(source ? cloneLogoProject(current ? projectRef.current : source.draft) : null);
    setNewName(source ? ((current ? name : source.name) + ' · kopija').slice(0, 120) : 'Nov logotip');
    setStarter(source ? 'copy' : 'blank'); setLibraryOpen(false); setError(''); setModal({ type: 'create' });
  }
  function beginDelete(id: string) {
    if (busyRef.current) return;
    setLibraryOpen(false); setError(''); setDeleteReplacement(''); setModal({ type: 'delete', id });
  }
  function copySelection() {
    if (!selected.length) return;
    setClipboard(copyLogoSelection(projectRef.current, selected)); pasteCount.current = 0;
  }
  function pasteSelection() {
    if (!clipboard.length) return;
    const result = pasteLogoSelection(projectRef.current, clipboard, 12 * (pasteCount.current + 1));
    try { validateLogoProject(result.project, libraryRef.current.assets); } catch (cause) { setError(errorMessage(cause)); return; }
    pasteCount.current += 1; change(result.project); setSelected(result.ids); setTool('select');
  }
  function editLayer(id: string) {
    setSelected([id]);
    requestAnimationFrame(() => workspace.current?.querySelector<HTMLTextAreaElement>(`[data-logo-text-editor="${id}"]`)?.focus());
  }
  function duplicateSelection() { const result = duplicateLogoLayers(projectRef.current, selected); change(result.project); setSelected(result.ids); }
  function deleteSelection() { change(removeLogoLayers(projectRef.current, selected)); setSelected([]); }
  function groupSelection() { try { const result = groupLogoLayers(projectRef.current, selected); change(result.project); setSelected([result.id]); } catch (cause) { setError(errorMessage(cause)); } }
  function ungroupSelection() { try { if (selected.length === 1) { const result = ungroupLogoLayer(projectRef.current, selected[0]); change(result.project); setSelected(result.ids); } } catch (cause) { setError(errorMessage(cause)); } }
  function addLayer(kind: 'text' | 'rectangle' | 'ellipse' | 'line') {
    const canvas = projectRef.current.canvas, size = Math.min(100, canvas.width / 3, canvas.height / 2);
    const base = { id: crypto.randomUUID(), name: kind === 'text' ? 'Besedilo' : kind === 'ellipse' ? 'Elipsa' : kind === 'line' ? 'Črta' : 'Pravokotnik', x: canvas.width * .15, y: canvas.height * .25, width: kind === 'text' ? Math.min(300, canvas.width * .7) : size, height: kind === 'text' ? Math.min(48, canvas.height * .3) : kind === 'line' ? 2 : size, rotation: 0, opacity: 1, visible: true, locked: false };
    const layer: LogoLayer = kind === 'text' ? { ...base, type: 'text', text: 'Besedilo', fontFamily: 'Inter', fontSize: Math.max(1, Math.min(36, canvas.height * .2)), fontWeight: 600, fontStyle: 'normal', fill: '#0f172a', textAlign: 'left', lineHeight: 1.2, letterSpacing: 0 } : { ...base, type: 'shape', shape: kind, fill: '#1687be', stroke: kind === 'line' ? '#1687be' : 'none', strokeWidth: kind === 'line' ? 2 : 0, radius: 0 };
    change({ ...projectRef.current, layers: [...projectRef.current.layers, layer] }); setSelected([layer.id]); setTool('select');
  }
  async function upload(file: File) {
    if (file.size > 3 * 1024 * 1024) { setError('Dovoljene so datoteke PNG, JPEG, WebP in SVG do 3 MB.'); return; }
    const replaceId = uploadMode.current;
    await run('Uvoz slike …', async () => {
      const body = new FormData(); body.set('file', file); body.set('expectedRevision', String(libraryRef.current.revision));
      const response = await fetch('/api/admin/logo-library/assets', { method: 'POST', body }), result = await response.json() as { library: LogoLibrary; asset: LogoSourceAsset; project: LogoProject; message?: string };
      if (!response.ok) throw new Error(result.message ?? 'Slike ni mogoče uvoziti.');
      libraryRef.current = result.library; setLibrary(result.library);
      const before = cloneLogoProject(projectRef.current); let next = cloneLogoProject(before), ids: string[] = [];
      if (replaceId) next = updateLogoLayers(next, [replaceId], layer => { if (layer.type === 'image') { layer.assetId = result.asset.id; const ratio = layer.width / layer.height, sourceRatio = result.asset.width / result.asset.height; const width = Math.min(1, ratio / sourceRatio), height = Math.min(1, sourceRatio / ratio); layer.crop = { x: (1 - width) / 2, y: (1 - height) / 2, width, height }; ids = [layer.id]; } });
      else {
        const imported = validateLogoProject(result.project, result.library.assets), scale = Math.min(1, next.canvas.width * .85 / imported.canvas.width, next.canvas.height * .85 / imported.canvas.height);
        const layers = imported.layers.map(item => { const layer = copyLogoLayer(item); layer.x = layer.x * scale + (next.canvas.width - imported.canvas.width * scale) / 2; layer.y = layer.y * scale + (next.canvas.height - imported.canvas.height * scale) / 2; resizeLogoLayer(layer, layer.width * scale, layer.height * scale); return layer; });
        ids = layers.map(layer => layer.id); next.layers.push(...layers);
      }
      next = validateLogoProject(next, result.library.assets); history.current.past = [...history.current.past.slice(-59), before]; history.current.future = []; historyChanged(value => value + 1); projectRef.current = next; setProject(next); setSelected(ids);
      setNotice(result.asset.warnings.length ? result.asset.warnings.join(' ') : result.asset.mimeType === 'image/svg+xml' ? 'SVG je uvožen. Podprti elementi so ločeni sloji.' : 'Slika je uvožena kot en sloj. Besedilo na sliki ostane del slike.');
    });
  }
  async function exportArtwork(format: 'png' | 'svg', scale: 1 | 2 = 1) {
    await run('Izvoz …', async () => {
      const response = await fetch('/api/admin/logo-library', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'export', project: projectRef.current, format, scale }) });
      if (!response.ok) { const result = await response.json(); throw new Error(result.message ?? 'Izvoz ni uspel.'); }
      download(await response.blob(), (name.trim() || 'logotip').replace(/[^\p{L}\p{N}._ -]/gu, '-') + (scale === 2 ? '@2x' : '') + '.' + format); setNotice('Izvoz je pripravljen.');
    });
  }
  function trim() { if (currentPreview) change(trimLogoCanvas(projectRef.current, currentPreview.bounds)); }
  function fitPlacement(area: { width: number; height: number }) {
    if (!currentPreview || !area.width || !area.height) return;
    const bounds = currentPreview.bounds; if (!bounds.width || !bounds.height) return;
    const ratio = area.width / area.height, width = Math.ceil(Math.max(bounds.width, bounds.height * ratio) / .9), height = Math.ceil(width / ratio);
    if (width > 8192 || height > 8192 || width * height > 4_000_000) { setError('Za to razmerje najprej zmanjšajte sloje ali obrežite platno.'); return; }
    const next = cloneLogoProject(projectRef.current); next.canvas = { width, height };
    for (const layer of next.layers) { layer.x += (width - bounds.width) / 2 - bounds.x; layer.y += (height - bounds.height) / 2 - bounds.y; }
    change(next); setNotice('Platno ima razmerje prostora in 5-odstotni rob. Nastavitve navigacije so ostale enake.');
  }
  useEffect(() => {
    const controller = new AbortController(); setPreviewPending(true); setPreviewError('');
    const timeout = setTimeout(async () => {
      try {
        const response = await fetch('/api/admin/logo-library', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'preview', project: JSON.parse(projectKey) }), signal: controller.signal });
        const result = await response.json(); if (!response.ok) throw new Error(result.message ?? 'Predogled ni uspel.');
        if (!controller.signal.aborted) { setPreview({ value: result, key: projectKey }); setPreviewPending(false); }
      } catch (cause) { if (!controller.signal.aborted) { setPreviewError(errorMessage(cause)); setPreviewPending(false); } }
    }, 400);
    return () => { clearTimeout(timeout); controller.abort(); };
  }, [projectKey]);
  useEffect(() => {
    const changed = (event: Event) => { const next = (event as CustomEvent<LogoLibrary>).detail; if (next.revision > libraryRef.current.revision) { libraryRef.current = next; setLibrary(next); void fetch('/api/admin/logo-library', { cache: 'no-store' }).then(response => response.json()).then((value: LibraryResponse) => { if (value.published) setPublished(value.published); }).catch(() => {}); } };
    window.addEventListener('admin-logo-library-changed', changed); return () => window.removeEventListener('admin-logo-library-changed', changed);
  }, []);
  useEffect(() => {
    const protect = (event: BeforeUnloadEvent) => { if (dirty) { event.preventDefault(); event.returnValue = ''; } };
    const link = (event: MouseEvent) => { if (!dirty || event.defaultPrevented || event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return; const anchor = event.target instanceof Element ? event.target.closest('a') : null; if (anchor && !anchor.hasAttribute('download') && anchor.target !== '_blank' && anchor.href !== window.location.href && !window.confirm('Različica vsebuje neshranjene spremembe. Zapustim urejevalnik?')) { event.preventDefault(); event.stopPropagation(); } };
    window.addEventListener('beforeunload', protect); document.addEventListener('click', link, true);
    return () => { window.removeEventListener('beforeunload', protect); document.removeEventListener('click', link, true); };
  }, [dirty]);
  useEffect(() => {
    const id = query.get('variant'), context = query.get('purpose');
    if (context && (LOGO_PLACEMENT_IDS as readonly string[]).includes(context)) setPurpose(context as LogoPlacementId);
    if (id && id !== activeId) { const variant = libraryRef.current.variants.find(item => item.id === id); if (variant) openVariant(variant); }
    // Query navigation selects the requested saved project; ordinary edits never reset it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);
  useEffect(() => {
    const keydown = (event: KeyboardEvent) => {
      if (busyRef.current || modal || cropId || libraryOpen) return;
      const modifier = event.ctrlKey || event.metaKey, key = event.key.toLowerCase();
      if (modifier && key === 's') { event.preventDefault(); void run('Shranjevanje …', async () => { await saveWorking(); }); }
      else if (event.target instanceof HTMLElement && event.target.closest('input,textarea,select,[contenteditable="true"]')) return;
      else if (modifier && (key === 'z' || key === 'y')) { event.preventDefault(); undo(key === 'y' || event.shiftKey); }
      else if (modifier && key === 'c' && selected.length) { event.preventDefault(); copySelection(); }
      else if (modifier && key === 'v' && clipboard.length) { event.preventDefault(); pasteSelection(); }
      else if (modifier && key === 'd') { event.preventDefault(); duplicateSelection(); }
      else if (modifier && key === 'g') { event.preventDefault(); if (event.shiftKey) ungroupSelection(); else groupSelection(); }
      else if (modifier && key === 'a') { event.preventDefault(); setSelected(projectRef.current.layers.filter(layer => layer.visible && !layer.locked).map(layer => layer.id)); }
      else if ((key === 'delete' || key === 'backspace') && selected.length) { event.preventDefault(); deleteSelection(); }
      else if (['arrowleft', 'arrowright', 'arrowup', 'arrowdown'].includes(key) && selected.length) { event.preventDefault(); const step = event.shiftKey ? 10 : 1; change(updateLogoLayers(projectRef.current, selected, layer => { layer.x += key === 'arrowleft' ? -step : key === 'arrowright' ? step : 0; layer.y += key === 'arrowup' ? -step : key === 'arrowdown' ? step : 0; })); }
      else if (!modifier && key === 'v') setTool('select');
      else if (!modifier && key === 'h') setTool('hand');
      else if (!modifier && key === 't') addLayer('text');
      else if (!modifier && key === 'c' && selected.length === 1 && findLogoLayer(projectRef.current, selected[0])?.type === 'image' && !isLogoLayerLocked(projectRef.current, selected[0])) setCropId(selected[0]);
      else if (key === 'escape') setSelected([]);
    };
    window.addEventListener('keydown', keydown); return () => window.removeEventListener('keydown', keydown);
  });
  const alignments = [{ value: 'left', label: 'Poravnaj levo', Icon: AlignStartVertical }, { value: 'center', label: 'Poravnaj vodoravno na sredino', Icon: AlignCenterVertical }, { value: 'right', label: 'Poravnaj desno', Icon: AlignEndVertical }, { value: 'top', label: 'Poravnaj zgoraj', Icon: AlignStartHorizontal }, { value: 'middle', label: 'Poravnaj navpično na sredino', Icon: AlignCenterHorizontal }, { value: 'bottom', label: 'Poravnaj spodaj', Icon: AlignEndHorizontal }, { value: 'horizontal', label: 'Enakomerno razporedi vodoravno', Icon: Columns3 }, { value: 'vertical', label: 'Enakomerno razporedi navpično', Icon: Rows3 }] as const;
  const selectedLayer = selected.length === 1 ? findLogoLayer(project, selected[0]) : undefined;
  const canCrop = selectedLayer?.type === 'image' && !isLogoLayerLocked(project, selectedLayer.id);
  const editorProps: LogoEditorPropertiesProps = {
    project, assets: library.assets, selected, onSelect: setSelected, onChange: change,
    onError: setError, onDuplicate: duplicateSelection, onDelete: deleteSelection,
    onGroup: groupSelection, onUngroup: ungroupSelection,
    onReorder: direction => change(reorderLogoLayer(projectRef.current, selected[0], direction)),
    onReplaceImage: id => { uploadMode.current = id; fileInput.current?.click(); },
    onCropImage: setCropId, keepRatio, setKeepRatio
  };
  return <div ref={workspace} className={styles.workspace} data-testid="logo-library-editor" aria-busy={Boolean(busy)}>
    <LogoEditorFonts />
    <div className={styles.pageHeading}>
      <AdminPageHeader title="Logotipi" description="Oblikujte logotip na platnu. Uredite sloje in pripravite različice za posamezna mesta uporabe." actions={<button type="button" className={styles.button} onClick={() => { if (document.fullscreenElement) void document.exitFullscreen(); else void workspace.current?.requestFullscreen().catch(() => setError('Celozaslonski način ni na voljo.')); }}><Expand />Način za delo</button>} />
      <AdminPodobaTabs onBeforeNavigate={()=>!busyRef.current&&mayLeave()} />
    </div>
    <div className={styles.toolbarArea}>
      <div className={styles.variantBar}>
        <button type="button" className={styles.button} aria-expanded={libraryOpen} onClick={() => setLibraryOpen(true)}><FolderOpen />Različice <span className={styles.badge}>{library.variants.length}</span><ChevronDown /></button>
        <label className={styles.documentName}><span>Ime različice</span><input className={styles.nameInput} aria-label="Ime različice" value={name} maxLength={120} disabled={Boolean(busy)} onChange={event => setName(event.target.value)} /></label>
        <span className={styles.spacer} />
        <button type="button" className={styles.button} disabled={Boolean(busy)} onClick={() => beginCreate()}><Plus />Nova različica</button>
        <button type="button" className={styles.button} disabled={Boolean(busy)} onClick={() => beginCreate('current')}><Copy />Kopija različice</button>
        <button type="button" className={styles.button} disabled={Boolean(busy) || !active}
          title={active ? 'Izbriši različico »' + active.name + '«' : 'Najprej izberite shranjeno različico'}
          onClick={() => active && beginDelete(active.id)}><Trash2 />Izbriši različico</button>
      </div>
      <div className={styles.toolbar}>
        <AdminSaveStatus dirty={dirty || !activeId} saving={busy.startsWith('Shranjevanje')} />
        <span className={styles.documentState}>{active?.published ? 'Objavljena različica' : 'Osnutek različice'}</span>
        <span className={styles.spacer} />
        <div className={styles.toolGroup}><button type="button" className={styles.iconButton} aria-label="Razveljavi" title="Razveljavi · Ctrl/Cmd Z" disabled={!history.current.past.length || Boolean(busy)} onClick={() => undo()}><Undo2 /></button><button type="button" className={styles.iconButton} aria-label="Uveljavi" title="Uveljavi · Ctrl/Cmd Shift Z" disabled={!history.current.future.length || Boolean(busy)} onClick={() => undo(true)}><Redo2 /></button></div>
        <select className={styles.exportSelect} aria-label="Izvoz logotipa" value="" disabled={Boolean(busy)} onChange={event => { const value = event.target.value; if (value === 'project') download(new Blob([JSON.stringify(project, null, 2)], { type: 'application/json' }), 'logotip-projekt.json'); else void exportArtwork(value === 'svg' ? 'svg' : 'png', value === 'png2' ? 2 : 1); }}><option value="" disabled>Izvozi</option><option value="png">PNG · 1×</option><option value="png2">PNG · 2×</option><option value="svg">SVG</option><option value="project">Projekt JSON</option></select>
        <button type="button" className={styles.button} disabled={Boolean(busy) || (!dirty && Boolean(active))} onClick={() => void run('Shranjevanje …', async () => { await saveWorking(); })}><Save />Shrani osnutek</button>
        <button type="button" className={styles.primary} disabled={Boolean(busy) || !currentPreview?.bounds.width || previewPending} onClick={() => setModal({ type: 'publish' })}><Send />Objavi</button>
      </div>
    </div>
    {libraryOpen && <LogoDialog title="Različice logotipa" className={styles.libraryDialog} onClose={() => setLibraryOpen(false)}>
      <div className={styles.libraryHeader}><p>Izberite različico za urejanje ali začnite novo.</p><button type="button" className={styles.button} disabled={Boolean(busy)} onClick={() => beginCreate()}><Plus />Nova različica</button></div>
      <div className={styles.variantGrid}>{library.variants.map(variant => <article key={variant.id} className={`${styles.variantCard} ${variant.id === activeId ? styles.variantCardActive : ''}`}>
        <button type="button" className={styles.variantOpen} disabled={Boolean(busy)} onClick={() => { if (variant.id === activeId) setLibraryOpen(false); else openVariant(variant); }}><LogoThumbnail project={variant.draft} assets={library.assets} /><div className={styles.variantTitle}><strong>{variant.name}</strong>{variant.id === activeId && <span className={styles.badge}>Odprta</span>}</div><p className={styles.hint}>{logoVariantHasDraft(variant) ? 'Osnutek' : 'Objavljeno'} · {logoVariantUsages(library, variant.id).map(id => LOGO_PLACEMENT_LABELS[id]).join(', ') || 'Brez uporabe'}</p></button>
        <div className={styles.variantActions}><button type="button" disabled={Boolean(busy)} onClick={() => beginCreate(variant)}><Copy />Ustvari kopijo</button><button type="button" disabled={Boolean(busy)} aria-label={'Izbriši različico »' + variant.name + '«'} title={logoVariantUsages(library, variant.id).length ? 'Pred izbrisom izberite nadomestni logotip za mesta uporabe.' : 'Izbriši različico'} onClick={() => beginDelete(variant.id)}><Trash2 />Izbriši</button></div>
      </article>)}</div>
      <div className={styles.dialogActions}><button type="button" className={styles.button} disabled={Boolean(busy)} onClick={() => { setLibraryOpen(false); projectInput.current?.click(); }}><ArrowDownToLine />Uvozi projekt</button></div>
    </LogoDialog>}
    <div className={styles.editorBody} style={busy ? { pointerEvents: 'none', opacity: .75 } : undefined}>
      <LogoLayersPanel {...editorProps} />
      <div className={styles.canvasWorkspace} onDragOver={event => { if (event.dataTransfer.types.includes('Files')) { event.preventDefault(); event.dataTransfer.dropEffect = 'copy'; } }} onDrop={event => {
        if (!event.dataTransfer.files.length) return;
        event.preventDefault(); uploadMode.current = null; void upload(event.dataTransfer.files[0]);
      }}>
        <div className={styles.tools} aria-label="Orodja">
          <div className={styles.toolGroup}><button type="button" aria-label="Izbor" title="Izbor · V" className={tool === 'select' ? styles.active : ''} onClick={() => setTool('select')}><MousePointer2 /></button><button type="button" aria-label="Premik pogleda" title="Premik pogleda · H ali preslednica" className={tool === 'hand' ? styles.active : ''} onClick={() => setTool('hand')}><Hand /></button></div>
          <span className={styles.toolDivider} />
          <button type="button" aria-label="Dodaj sliko" title="PNG, JPEG, WebP, SVG do 3 MB" onClick={() => { uploadMode.current = null; fileInput.current?.click(); }}><ImagePlus /><span>Slika</span></button><button type="button" aria-label="Dodaj besedilo" title="Dodaj besedilo · T" onClick={() => addLayer('text')}><Type /><span>Besedilo</span></button>
          <details className={styles.toolMenu}><summary><Shapes /><span>Oblika</span><ChevronDown /></summary><div className={styles.toolMenuPanel}><button type="button" onClick={event => { addLayer('rectangle'); event.currentTarget.closest('details')?.removeAttribute('open'); }}><Square />Pravokotnik</button><button type="button" onClick={event => { addLayer('ellipse'); event.currentTarget.closest('details')?.removeAttribute('open'); }}><Circle />Elipsa</button><button type="button" onClick={event => { addLayer('line'); event.currentTarget.closest('details')?.removeAttribute('open'); }}><Minus />Črta</button></div></details>
          <span className={styles.toolDivider} /><button type="button" aria-label="Izreži izbrano sliko" disabled={!canCrop} title={canCrop ? 'Povlecite robove izreza · C ali dvoklik slike' : 'Izberite odklenjen slikovni sloj za izrez'} onClick={() => canCrop && setCropId(selected[0])}><Crop /><span>Izrez</span></button>
        </div>
        <div className={styles.contextBar}>
          <span className={styles.selectionName}>{selectedLayer?.name ?? (selected.length ? `${selected.length} izbranih slojev` : 'Izberite sloj na platnu')}</span>
          <div className={styles.toolGroup}><button type="button" aria-label="Kopiraj sloje" title="Kopiraj sloje · Ctrl/Cmd C" disabled={!selected.length} onClick={copySelection}><Copy /></button><button type="button" aria-label="Prilepi sloje" title="Prilepi sloje · Ctrl/Cmd V" disabled={!clipboard.length} onClick={pasteSelection}><ClipboardPaste /></button></div>
          <details className={styles.toolMenu}><summary aria-label="Možnosti poravnave">Poravnava<ChevronDown /></summary><div className={`${styles.toolMenuPanel} ${styles.alignmentMenu}`}><label className={styles.field}>Glede na<select aria-label="Poravnava glede na" className={styles.input} value={alignment} onChange={event => setAlignment(event.target.value as 'canvas')}><option value="canvas">Platno</option><option value="selection">Izbor</option></select></label><div className={styles.alignmentButtons}>{alignments.map(({ value, label, Icon }) => <button type="button" key={value} aria-label={label} title={label} disabled={!selected.length || Boolean(busy) || ((value === 'horizontal' || value === 'vertical') && selected.length < 3)} onClick={() => { try { change(alignLogoLayers(project, selected, value, alignment)); } catch (cause) { setError(errorMessage(cause)); } }}><Icon /></button>)}</div></div></details>
        </div>
        <LogoEditorCanvas project={project} assets={library.assets} selected={selected} onSelect={setSelected} onChange={change} onGestureStart={gestureStart} onGestureEnd={gestureEnd} tool={tool} keepRatio={keepRatio} snap={snap} background={background} onEditLayer={editLayer} onCropImage={setCropId} />
        <div className={styles.canvasOptions}><label className={styles.check}><input type="checkbox" checked={snap} onChange={event => setSnap(event.target.checked)} />Pripni na vodila</label><label className={styles.backgroundOption}>Ozadje<select className={styles.input} aria-label="Ozadje platna" value={background} onChange={event => setBackground(event.target.value as typeof background)}><option value="transparent">Prosojno</option><option value="light">Svetlo</option><option value="dark">Temno</option></select></label></div>
      </div>
      <LogoEditorProperties {...editorProps} />
    </div>
    <input ref={fileInput} type="file" hidden accept="image/png,image/jpeg,image/webp,image/svg+xml" onChange={event => { const file = event.target.files?.[0]; event.target.value = ''; if (file) void upload(file); }} />
    <input ref={projectInput} type="file" hidden accept="application/json,.json" onChange={event => { const file = event.target.files?.[0]; event.target.value = ''; if (file && file.size > 2 * 1024 * 1024) { setError('Projekt je prevelik.'); return; } if (file) void file.text().then(text => { const next = validateLogoProject(JSON.parse(text), libraryRef.current.assets); change(next); setSelected([]); setNotice('Uvožen je urejljiv projekt. Njegovi slikovni viri morajo obstajati v tej knjižnici.'); }).catch(cause => setError(errorMessage(cause))); }} />
    {(busy || notice || error) && <div className={`${styles.status} ${error ? styles.error : ''}`} role={error ? 'alert' : 'status'}>{busy || error || notice}{error && <><button type="button" className={styles.button} disabled={Boolean(busy)} onClick={() => void run('Osveževanje …', refresh)}>Osveži knjižnico</button><button type="button" className={styles.button} disabled={Boolean(busy)} onClick={() => void run('Shranjevanje kopije …', async () => { const next = adopt(await request({ action: 'create', name: (name + ' · kopija').slice(0, 120), project: projectRef.current, expectedRevision: libraryRef.current.revision })); openVariant(next.variants[next.variants.length - 1], true); })}><Copy />Shrani kot kopijo</button></>}</div>}
    <details className={styles.previewSection}><summary className={styles.previewHeading}>Predogled v uporabi<span className={styles.hint}>Preverite videz na spletni strani in dokumentih.</span></summary><div className={styles.previewHeading}><select aria-label="Mesto predogleda" className={styles.input} value={purpose} onChange={event => setPurpose(event.target.value as LogoPlacementId)}>{LOGO_PLACEMENT_IDS.map(id => <option key={id} value={id}>{LOGO_PLACEMENT_LABELS[id]}</option>)}</select><select aria-label="Vsebina predogleda" className={styles.input} value={previewMode} onChange={event => setPreviewMode(event.target.value as 'draft')}><option value="draft">Trenutni osnutek</option><option value="published">Trenutno na spletni strani</option></select><span className={styles.spacer} /><span className={styles.hint}>{previewMode === 'draft' ? previewPending ? 'Izrisujem osnutek …' : 'Zasebni predogled · enak izris kot pri objavi' : 'Objavljena uporaba'}</span></div><div className={styles.previewBody}>{previewMode === 'draft' && previewError ? <p className={styles.error} role="alert">{previewError}</p> : previewMode === 'draft' && !currentPreview ? <p className={styles.hint}>Pripravljam predogled trenutnih slojev …</p> : <LogoPlacementPreview published={published} navigation={navigation} purpose={purpose} draftAsset={previewMode === 'draft' ? draftAsset : undefined} project={previewMode === 'draft' ? project : undefined} assets={library.assets} onTrimToContent={previewMode === 'draft' ? trim : undefined} onFitToPlacement={previewMode === 'draft' ? fitPlacement : undefined} />}</div></details>
    <details className={styles.previewSection}><summary className={styles.previewHeading}>Uporaba <span className={styles.hint}>{usages.length ? usages.map(id => LOGO_PLACEMENT_LABELS[id]).join(', ') : 'Različica še ni dodeljena.'}</span></summary><div className={styles.previewBody}><p className={styles.hint}>Vsako mesto uporablja objavljeno različico ali izbran nadomestni logotip. Shranjevanje osnutka ne spremeni teh dodelitev.</p><div className={styles.usage}>{LOGO_PLACEMENT_IDS.map(id => <LogoPlacementSelector key={id} purpose={id} library={library} onLibraryChange={next => { libraryRef.current = next; setLibrary(next); void fetch('/api/admin/logo-library', { cache: 'no-store' }).then(response => response.json()).then((value: LibraryResponse) => { if (value.published) setPublished(value.published); }).catch(cause => setError(errorMessage(cause))); }} />)}</div></div></details>
    {active?.history.length ? <details className={styles.previewSection}><summary className={styles.previewHeading}><History />Prejšnje objave</summary><div className={`${styles.previewBody} flex flex-wrap items-center gap-2`}><select aria-label="Prejšnja objava" className={styles.input} style={{ width: 'auto' }} value={restoreId} onChange={event => setRestoreId(event.target.value)}><option value="">Izberite objavo …</option>{active.history.map(revision => <option key={revision.id} value={revision.id}>{new Date(revision.createdAt).toLocaleString('sl-SI')} · {revision.id.slice(0, 8)}</option>)}</select><button type="button" className={styles.button} disabled={!restoreId || Boolean(busy)} onClick={() => setModal({ type: 'restore', revisionId: restoreId })}>Obnovi objavo</button></div></details> : null}
    {cropLayer?.type === 'image' && cropAsset && <LogoImageCropDialog layer={cropLayer} asset={cropAsset} onApply={(crop: LogoBounds) => { change(cropLogoImage(project, cropLayer.id, crop)); setCropId(null); }} onCancel={() => setCropId(null)} />}
    {modal && <LogoDialog title={modal.type === 'create' ? 'Nova različica' : modal.type === 'publish' ? 'Objavi različico' : modal.type === 'restore' ? 'Obnovi prejšnjo objavo' : 'Izbriši različico'} onClose={() => { if (!busy) setModal(null); }}>
      {modal.type === 'create' ? <><label className={styles.field}>Ime različice<input autoFocus className={styles.input} aria-label="Ime nove različice" value={newName} maxLength={120} onChange={event => setNewName(event.target.value)} /></label>
        {copyProject ? <div className={styles.copyPreview}><LogoThumbnail project={copyProject} assets={library.assets} /><p>Neodvisna kopija vseh slojev. Izvirna različica ostane nespremenjena.</p></div> : <div className={styles.starterGrid} role="group" aria-label="Začetna sestava">{([{ kind: 'blank', title: 'Prazno platno', description: 'Dodajte svojo sliko ali sloje.', Icon: Plus }, { kind: 'wordmark', title: 'Besedilni logotip', description: 'Naziv in dopolnilno besedilo.', Icon: Type }, { kind: 'symbol', title: 'Simbol', description: 'Oblika z urejljivo začetnico.', Icon: Shapes }] as const).map(({ kind, title, description, Icon }) => <button type="button" key={kind} className={`${styles.starterCard} ${starter === kind ? styles.starterActive : ''}`} aria-pressed={starter === kind} onClick={() => setStarter(kind)}><span className={styles.starterArt}><Icon /></span><strong>{title}</strong><span>{description}</span></button>)}</div>}
        <p className={styles.hint}>Različica se shrani kot osnutek. Objavite jo, ko je pripravljena.</p></> : modal.type === 'delete' ? <>{!deleting ? <p>Različica ne obstaja več. Osvežite knjižnico.</p> : <>
          <p>Izbrisali boste različico »{deleting.name}«.</p>
          {deletingUsages.length > 0 && <>
            <p className={styles.hint}>Različica se uporablja na teh mestih:</p>
            <ul className="my-3 list-disc space-y-1 pl-5">{deletingUsages.map(id => <li key={id}>{LOGO_PLACEMENT_LABELS[id]}</li>)}</ul>
            <label className={styles.field}>Nadomestni logotip<select className={styles.input} aria-label="Nadomestni logotip za izbris" value={deleteReplacement} disabled={Boolean(busy)} onChange={event => setDeleteReplacement(event.target.value)}>
              <option value="" disabled>Izberite nadomestni logotip …</option>
              <option value="original">Izvirni logotip</option>
              {library.variants.filter(variant => variant.id !== deleting.id && variant.published).map(variant => <option key={variant.id} value={'variant:' + variant.id}>{variant.name}</option>)}
            </select></label>
            <p className={styles.hint}>{replacementLabel ? <>Na navedenih mestih bo uporabljen logotip »{replacementLabel}«.</> : 'Pred izbrisom izberite, kateri logotip naj ga nadomesti na navedenih mestih.'}</p>
          </>}
          <p className={styles.hint}>Izvorne slike ostanejo shranjene.</p>
          {deleting.id === activeId && dirty && <p className={styles.hint}>Z izbrisom bodo zavržene tudi neshranjene spremembe te različice.</p>}
        </>}</> : <><p>{modal.type === 'restore' ? 'Izbrana objava bo ponovno prikazana na spodnjih mestih. Z njo se obnovi tudi urejljivi osnutek.' : 'Trenutni sloji bodo shranjeni in izrisani v PNG ter SVG. Po uspešnem izrisu se bodo posodobila ta mesta:'}</p>{usages.length ? <ul>{usages.map(id => <li key={id}>{LOGO_PLACEMENT_LABELS[id]}</li>)}</ul> : <p>Različica trenutno ni dodeljena nobenemu mestu. Po objavi jo lahko izberete v razdelku Uporaba.</p>}{modal.type === 'restore' && dirty && <p className={styles.error}>Neshranjene spremembe na platnu bodo zamenjane.</p>}</>}
      {error && <p className={styles.error} role="alert">{error}</p>}
      <div className={styles.dialogActions}><button type="button" className={styles.button} disabled={Boolean(busy)} onClick={() => setModal(null)}>Prekliči</button><button type="button" className={styles.primary} disabled={Boolean(busy) || (modal.type === 'create' && !newName.trim()) || (modal.type === 'delete' && (!deleting || (deletingUsages.length > 0 && !deleteAssignment)))} onClick={() => void run('Obdelujem …', async () => {
        if (modal.type === 'create') { const next = adopt(await request({ action: 'create', name: newName.trim(), project: copyProject ?? starterProject(starter === 'copy' ? 'blank' : starter), expectedRevision: libraryRef.current.revision })); openVariant(next.variants[next.variants.length - 1], true); }
        else if (modal.type === 'publish') { const saved = await saveWorking(), variant = saved.variants.find(item => item.id === activeId) ?? saved.variants[saved.variants.length - 1]; const next = adopt(await request({ action: 'publish', variantId: variant.id, expectedRevision: saved.revision, expectedDraftRevision: variant.draftRevision })); setNotice('Različica je objavljena. Vsa njena mesta uporabe so posodobljena.'); draftRevision.current = next.variants.find(item => item.id === variant.id)!.draftRevision; }
        else if (modal.type === 'restore') { const next = adopt(await request({ action: 'restore', variantId: activeId, revisionId: modal.revisionId, expectedRevision: libraryRef.current.revision })); openVariant(next.variants.find(item => item.id === activeId)!, true); setNotice('Prejšnja objava je obnovljena.'); }
        else { if (deletingUsages.length && !deleteAssignment) throw new Error('Izberite nadomestni logotip.'); const next = adopt(await request({ action: 'delete', variantId: modal.id, expectedRevision: library.revision, ...(deletingUsages.length ? { replacement: deleteAssignment } : {}) })); if (activeId === modal.id) { if (next.variants[0]) openVariant(next.variants[0], true); else { const empty = blankLogoProject(); setActiveId(''); setProject(empty); projectRef.current = empty; setName('Nov logotip'); setBaseline(signature(empty, 'Nov logotip')); baselineRef.current = signature(empty, 'Nov logotip'); draftRevision.current = 0; setRestoreId(''); setSelected([]); history.current = { past: [], future: [], gesture: null }; const params = new URLSearchParams(window.location.search); params.delete('variant'); window.history.replaceState(null, '', '?' + params.toString()); } } setNotice(deletingUsages.length ? 'Različica je izbrisana. Na njenih mestih uporabe je logotip »' + replacementLabel + '«.' : 'Različica je izbrisana.'); }
        setModal(null);
      })}>{busy || (modal.type === 'create' ? copyProject ? 'Ustvari kopijo' : 'Ustvari različico' : modal.type === 'publish' ? 'Objavi' : modal.type === 'restore' ? 'Obnovi' : deletingUsages.length ? 'Zamenjaj in izbriši' : 'Izbriši')}</button></div>
    </LogoDialog>}
  </div>;
}
