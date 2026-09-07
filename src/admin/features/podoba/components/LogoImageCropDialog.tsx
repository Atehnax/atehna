"use client";

import { useEffect, useId, useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent } from 'react';
import { Check, RotateCcw, X } from 'lucide-react';
import { AdminUnitInput } from '@/shared/ui/admin-controls/AdminUnitInput';
import type { LogoBounds, LogoImageLayer, LogoSourceAsset } from '@/shared/domain/logo/logoLibrary';
import { canFitLogoCropAspect, drawLogoCrop, fitLogoCropAspect, logoCropPoint, normalizeLogoCrop, setLogoCropPixels, transformLogoCrop, type LogoCropDrag, type LogoCropPoint, type LogoCropResize } from './logoCropGeometry';
import styles from './LogoImageCropDialog.module.css';

type Props = { layer: LogoImageLayer; asset: LogoSourceAsset; onApply: (crop: LogoBounds) => void; onCancel: () => void };
type Aspect = 'free' | 'original' | 'square' | 'four-three' | 'wide';
const presets: { id: Aspect; label: string; ratio: number | null }[] = [
  { id: 'free', label: 'Prosto', ratio: null }, { id: 'original', label: 'Izvirno', ratio: null },
  { id: 'square', label: '1:1', ratio: 1 }, { id: 'four-three', label: '4:3', ratio: 4 / 3 }, { id: 'wide', label: '16:9', ratio: 16 / 9 }
];
const handles: { mode: LogoCropResize; label: string; style: CSSProperties }[] = [
  { mode: 'nw', label: 'Zgornji levi rob', style: { left: 0, top: 0 } },
  { mode: 'n', label: 'Zgornji rob', style: { left: '50%', top: 0 } },
  { mode: 'ne', label: 'Zgornji desni rob', style: { left: '100%', top: 0 } },
  { mode: 'e', label: 'Desni rob', style: { left: '100%', top: '50%' } },
  { mode: 'se', label: 'Spodnji desni rob', style: { left: '100%', top: '100%' } },
  { mode: 's', label: 'Spodnji rob', style: { left: '50%', top: '100%' } },
  { mode: 'sw', label: 'Spodnji levi rob', style: { left: 0, top: '100%' } },
  { mode: 'w', label: 'Levi rob', style: { left: 0, top: '50%' } }
];

function PixelField({ label, value, max, min = 0, onChange }: { label: string; value: number; max: number; min?: number; onChange: (value: number) => void }) {
  const id = useId(), [draft, setDraft] = useState<string | null>(null);
  return <label className={styles.pixelField} htmlFor={id}><span>{label}</span>
    <AdminUnitInput id={id} aria-label={label + ' (px)'} type="number" inputMode="decimal" unit="px" min={min} max={max} step={1} value={draft ?? String(Math.round(value))}
      onFocus={() => setDraft(String(Math.round(value)))} onBlur={() => setDraft(null)} onChange={event => {
        const raw = event.target.value; setDraft(raw);
        if (raw.trim() && Number.isFinite(Number(raw))) onChange(Number(raw));
      }} />
  </label>;
}

function CropEditor({ layer, asset, onApply, onCancel }: Props) {
  const [crop, setCrop] = useState<LogoBounds>(() => normalizeLogoCrop(layer.crop, asset));
  const [aspect, setAspect] = useState<Aspect>('free');
  const [frame, setFrame] = useState({ width: 0, height: 0 });
  const [imageReady, setImageReady] = useState(false), [imageFailed, setImageFailed] = useState(false), [dragging, setDragging] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null), viewport = useRef<HTMLDivElement>(null), sourceArea = useRef<HTMLDivElement>(null), selection = useRef<HTMLDivElement>(null);
  const drag = useRef<{ pointerId: number; mode: LogoCropDrag | 'draw'; crop: LogoBounds; start: LogoCropPoint; ratio: number | null; moved: boolean } | null>(null);
  const titleId = useId(), hintId = useId(), shortcutsId = useId();
  const ratio = aspect === 'original' ? asset.width / asset.height : presets.find(preset => preset.id === aspect)?.ratio ?? null;
  useEffect(() => {
    const node = dialog.current;
    if (!node) return;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    node.showModal();
    return () => { node.close(); if (previous?.isConnected) previous.focus(); };
  }, []);
  useEffect(() => {
    const node = viewport.current;
    if (!node) return;
    const update = () => setFrame({ width: node.clientWidth, height: node.clientHeight });
    update();
    const observer = new ResizeObserver(update);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    if (!imageReady) return;
    const frame = requestAnimationFrame(() => selection.current?.focus({ preventScroll: true }));
    return () => cancelAnimationFrame(frame);
  }, [imageReady]);
  const fittedScale = Math.min(Math.max(0, frame.width - 48) / asset.width, Math.max(0, frame.height - 48) / asset.height);
  const fittedWidth = asset.width * fittedScale, fittedHeight = asset.height * fittedScale;
  const chooseAspect = (next: Aspect) => {
    const nextRatio = next === 'original' ? asset.width / asset.height : presets.find(preset => preset.id === next)?.ratio ?? null;
    setAspect(next);
    if (nextRatio !== null) setCrop(current => fitLogoCropAspect(current, asset, nextRatio));
  };
  const begin = (event: PointerEvent<HTMLElement>, mode: LogoCropDrag | 'draw') => {
    if (event.button !== 0 || !event.isPrimary || !imageReady || drag.current) return;
    const node = sourceArea.current, rect = node?.getBoundingClientRect();
    if (!node || !rect?.width || !rect.height) return;
    event.preventDefault(); event.stopPropagation(); event.currentTarget.focus();
    node.setPointerCapture(event.pointerId);
    drag.current = { pointerId: event.pointerId, mode, crop: { ...crop }, start: logoCropPoint(event.clientX, event.clientY, rect), ratio, moved: false };
    setDragging(true);
  };
  const pointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const initial = drag.current, rect = sourceArea.current?.getBoundingClientRect();
    if (!initial || initial.pointerId !== event.pointerId || !rect?.width || !rect.height) return;
    event.preventDefault();
    const point = logoCropPoint(event.clientX, event.clientY, rect), dx = point.x - initial.start.x, dy = point.y - initial.start.y;
    if (initial.mode === 'draw' && !initial.moved && Math.hypot(dx * rect.width, dy * rect.height) < 3) return;
    initial.moved = true;
    setCrop(initial.mode === 'draw' ? drawLogoCrop(initial.start, point, asset, initial.ratio) : transformLogoCrop(initial.crop, initial.mode, dx, dy, asset, initial.ratio));
  };
  const finish = (event: PointerEvent<HTMLDivElement>, cancel = false) => {
    const initial = drag.current;
    if (initial?.pointerId !== event.pointerId) return;
    if (cancel) setCrop(initial.crop);
    drag.current = null; setDragging(false);
    const node = sourceArea.current;
    if (node?.hasPointerCapture(event.pointerId)) node.releasePointerCapture(event.pointerId);
  };
  const keyboard = (event: KeyboardEvent<HTMLElement>, mode: LogoCropDrag) => {
    if (!imageReady || !['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return;
    event.preventDefault(); event.stopPropagation();
    const step = event.shiftKey ? 10 : 1;
    const dx = (event.key === 'ArrowLeft' ? -step : event.key === 'ArrowRight' ? step : 0) / asset.width;
    const dy = (event.key === 'ArrowUp' ? -step : event.key === 'ArrowDown' ? step : 0) / asset.height;
    setCrop(current => transformLogoCrop(current, mode, dx, dy, asset, ratio));
  };
  const apply = () => { if (imageReady) onApply({ ...crop }); };
  return <dialog ref={dialog} className={styles.dialog} aria-labelledby={titleId} aria-describedby={hintId} onCancel={event => { event.preventDefault(); onCancel(); }}
    onKeyDown={event => {
      if (event.nativeEvent.isComposing) return;
      if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); onCancel(); }
      if (event.key === 'Enter' && !event.altKey && !event.ctrlKey && !event.metaKey) {
        const target = event.target instanceof HTMLElement ? event.target : null;
        if (target?.closest('summary,button:not([data-crop-handle])')) return;
        event.preventDefault(); event.stopPropagation(); apply();
      }
    }} onClick={event => {
      if (event.target !== event.currentTarget) return;
      const rect = event.currentTarget.getBoundingClientRect();
      if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) onCancel();
    }}>
    <header className={styles.header}><div><h2 id={titleId}>Izreži sliko</h2><p className={styles.filename} title={asset.name}>{asset.name}</p></div><button type="button" className={styles.close} aria-label="Zapri izrez" onClick={onCancel}><X size={18}/></button></header>
    <div className={styles.toolbar}>
      <div className={styles.presets} role="group" aria-label="Razmerje izreza"><span className={styles.toolbarLabel}>Razmerje</span>{presets.map(preset => {
        const value = preset.id === 'original' ? asset.width / asset.height : preset.ratio;
        return <button key={preset.id} type="button" aria-pressed={aspect === preset.id} disabled={!imageReady || dragging || (value !== null && !canFitLogoCropAspect(asset, value))} onClick={() => chooseAspect(preset.id)}>{preset.label}</button>;
      })}</div>
      <output className={styles.dimensions} data-testid="logo-crop-dimensions" aria-label="Velikost izreza" aria-live="polite">{Math.max(1, Math.round(crop.width * asset.width))} × {Math.max(1, Math.round(crop.height * asset.height))} <span>px</span></output>
    </div>
    <div ref={viewport} className={styles.workspace} data-testid="logo-crop-workspace" data-dragging={dragging}>
      <div ref={sourceArea} className={styles.source} data-testid="logo-crop-source" tabIndex={-1} style={{ left: (frame.width - fittedWidth) / 2, top: (frame.height - fittedHeight) / 2, width: fittedWidth, height: fittedHeight }}
        onPointerDown={event => begin(event, 'draw')} onPointerMove={pointerMove} onPointerUp={event => finish(event)} onPointerCancel={event => finish(event, true)} onLostPointerCapture={() => { drag.current = null; setDragging(false); }}>
        {/* The source pixels remain immutable; Apply returns only normalized crop coordinates. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={asset.url} alt={asset.name} draggable={false} width={asset.width} height={asset.height} className={styles.image} onLoad={() => { setImageReady(true); setImageFailed(false); }} onError={() => { setImageFailed(true); setImageReady(false); }} />
        {imageReady && <div ref={selection} className={styles.cropBox} style={{ left: crop.x * fittedWidth, top: crop.y * fittedHeight, width: crop.width * fittedWidth, height: crop.height * fittedHeight }}
          tabIndex={0} role="group" aria-label="Okvir izreza" aria-describedby={shortcutsId} onPointerDown={event => begin(event, 'move')} onKeyDown={event => keyboard(event, 'move')}>
          <div className={styles.guides} aria-hidden="true"><i style={{ left: '33.333%' }}/><i style={{ left: '66.667%' }}/><b style={{ top: '33.333%' }}/><b style={{ top: '66.667%' }}/></div>
          {handles.map(handle => <button key={handle.mode} type="button" className={styles.handle} style={handle.style} data-crop-handle={handle.mode}
            aria-label={'Izrez: ' + handle.label.toLowerCase()} title={handle.label} onPointerDown={event => begin(event, handle.mode)} onKeyDown={event => keyboard(event, handle.mode)} />)}
        </div>}
      </div>
      {!imageReady && <p role={imageFailed ? 'alert' : 'status'} className={styles.imageStatus}>{imageFailed ? 'Izvirne slike ni mogoče naložiti. Zaprite okno in poskusite znova.' : 'Nalaganje izvirne slike …'}</p>}
    </div>
    <div className={styles.belowWorkspace}><p id={hintId}>Povlecite okvir ali njegove robove. Zunaj okvira povlecite za nov izrez.</p><button type="button" className={styles.reset} disabled={!imageReady || dragging} onClick={() => { setAspect('free'); setCrop({ x: 0, y: 0, width: 1, height: 1 }); }}><RotateCcw size={14}/>Celotna slika</button></div>
    <details className={styles.advanced}><summary>Natančen izrez</summary><fieldset disabled={!imageReady || dragging} className={styles.pixelFields}>
      <PixelField label="Levi rob" value={crop.x * asset.width} max={(1 - crop.width) * asset.width} onChange={value => setCrop(current => setLogoCropPixels(current, 'x', value, asset, ratio))}/>
      <PixelField label="Zgornji rob" value={crop.y * asset.height} max={(1 - crop.height) * asset.height} onChange={value => setCrop(current => setLogoCropPixels(current, 'y', value, asset, ratio))}/>
      <PixelField label="Širina izreza" value={crop.width * asset.width} min={1} max={(1 - crop.x) * asset.width} onChange={value => setCrop(current => setLogoCropPixels(current, 'width', value, asset, ratio))}/>
      <PixelField label="Višina izreza" value={crop.height * asset.height} min={1} max={(1 - crop.y) * asset.height} onChange={value => setCrop(current => setLogoCropPixels(current, 'height', value, asset, ratio))}/>
    </fieldset><p id={shortcutsId} className={styles.shortcuts}>Puščice: premik okvira ali roba za 1 px. Shift + puščice: 10 px. Enter: uporabi izrez. Esc: prekliči.</p></details>
    <footer className={styles.footer}><span>Izvirna slika ostane ohranjena.</span><div><button type="button" className={styles.button} onClick={onCancel} aria-keyshortcuts="Escape">Prekliči</button><button type="button" className={styles.primary} disabled={!imageReady || dragging} onClick={apply} aria-keyshortcuts="Enter"><Check size={16}/>Uporabi izrez</button></div></footer>
  </dialog>;
}

export default function LogoImageCropDialog(props: Props) {
  return <CropEditor key={props.layer.id + ':' + props.asset.id} {...props} />;
}
