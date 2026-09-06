"use client";

import { useEffect, useId, useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent } from 'react';
import type { LogoBounds, LogoImageLayer, LogoSourceAsset } from '@/shared/domain/logo/logoLibrary';
import { LogoNumber } from './LogoEditorProperties';
import styles from './LogoEditor.module.css';

type Props = { layer: LogoImageLayer; asset: LogoSourceAsset; onApply: (crop: LogoBounds) => void; onCancel: () => void };
type ResizeMode = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w';
type DragMode = 'move' | ResizeMode;
const clamp = (value: number, low: number, high: number) => Math.max(low, Math.min(high, value));
const handles: { mode: ResizeMode; label: string; style: CSSProperties }[] = [
  { mode: 'nw', label: 'Zgornji levi rob', style: { left: -5, top: -5, right: 'auto', bottom: 'auto' } },
  { mode: 'n', label: 'Zgornji rob', style: { left: 'calc(50% - 6px)', top: -5, right: 'auto', bottom: 'auto', cursor: 'ns-resize' } },
  { mode: 'ne', label: 'Zgornji desni rob', style: { top: -5, bottom: 'auto', cursor: 'nesw-resize' } },
  { mode: 'e', label: 'Desni rob', style: { top: 'calc(50% - 6px)', bottom: 'auto', cursor: 'ew-resize' } },
  { mode: 'se', label: 'Spodnji desni rob', style: {} },
  { mode: 's', label: 'Spodnji rob', style: { left: 'calc(50% - 6px)', right: 'auto', cursor: 'ns-resize' } },
  { mode: 'sw', label: 'Spodnji levi rob', style: { left: -5, right: 'auto', cursor: 'nesw-resize' } },
  { mode: 'w', label: 'Levi rob', style: { left: -5, top: 'calc(50% - 6px)', right: 'auto', bottom: 'auto', cursor: 'ew-resize' } }
];

function CropEditor({ layer, asset, onApply, onCancel }: Props) {
  const [crop, setCrop] = useState<LogoBounds>(() => ({ ...layer.crop }));
  const [frame, setFrame] = useState({ width: 0, height: 0 });
  const [imageReady, setImageReady] = useState(false);
  const [imageFailed, setImageFailed] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const viewport = useRef<HTMLDivElement>(null);
  const sourceArea = useRef<HTMLDivElement>(null);
  const drag = useRef<{ pointerId: number; mode: DragMode; crop: LogoBounds; x: number; y: number; width: number; height: number } | null>(null);
  const titleId = useId(), hintId = useId();
  const minimumWidth = Math.max(.0001, 1 / asset.width), minimumHeight = Math.max(.0001, 1 / asset.height);
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
    const observer = new ResizeObserver(() => setFrame({ width: node.clientWidth, height: node.clientHeight }));
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  const fittedScale = Math.min(Math.max(0, frame.width - 20) / asset.width, Math.max(0, frame.height - 20) / asset.height);
  const fittedWidth = asset.width * fittedScale, fittedHeight = asset.height * fittedScale;
  const moveCrop = (initial: LogoBounds, mode: DragMode, dx: number, dy: number): LogoBounds => {
    if (mode === 'move') return { ...initial, x: clamp(initial.x + dx, 0, 1 - initial.width), y: clamp(initial.y + dy, 0, 1 - initial.height) };
    let left = initial.x, top = initial.y, right = left + initial.width, bottom = top + initial.height;
    if (mode.includes('w')) left = clamp(left + dx, 0, right - minimumWidth);
    if (mode.includes('e')) right = clamp(right + dx, left + minimumWidth, 1);
    if (mode.includes('n')) top = clamp(top + dy, 0, bottom - minimumHeight);
    if (mode.includes('s')) bottom = clamp(bottom + dy, top + minimumHeight, 1);
    return { x: left, y: top, width: right - left, height: bottom - top };
  };
  const begin = (event: PointerEvent<HTMLElement>, mode: DragMode) => {
    if (event.button !== 0 || !imageReady) return;
    const rect = sourceArea.current?.getBoundingClientRect();
    if (!rect?.width || !rect.height) return;
    event.preventDefault(); event.stopPropagation(); event.currentTarget.focus();
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = { pointerId: event.pointerId, mode, crop: { ...crop }, x: event.clientX, y: event.clientY, width: rect.width, height: rect.height };
  };
  const pointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const initial = drag.current;
    if (!initial || initial.pointerId !== event.pointerId) return;
    event.preventDefault();
    setCrop(moveCrop(initial.crop, initial.mode, (event.clientX - initial.x) / initial.width, (event.clientY - initial.y) / initial.height));
  };
  const finish = (event: PointerEvent<HTMLDivElement>) => {
    if (drag.current?.pointerId !== event.pointerId) return;
    drag.current = null;
    if (event.target instanceof HTMLElement && event.target.hasPointerCapture(event.pointerId)) event.target.releasePointerCapture(event.pointerId);
  };
  const keyboard = (event: KeyboardEvent<HTMLElement>, mode: DragMode) => {
    if (!imageReady || !['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return;
    event.preventDefault(); event.stopPropagation();
    const step = event.shiftKey ? 10 : 1;
    const dx = (event.key === 'ArrowLeft' ? -step : event.key === 'ArrowRight' ? step : 0) / asset.width;
    const dy = (event.key === 'ArrowUp' ? -step : event.key === 'ArrowDown' ? step : 0) / asset.height;
    setCrop(current => moveCrop(current, mode, dx, dy));
  };
  const number = (key: keyof LogoBounds, value: number) => setCrop(current => {
    const normalized = value / 100;
    if (key === 'x') return { ...current, x: clamp(normalized, 0, 1 - current.width) };
    if (key === 'y') return { ...current, y: clamp(normalized, 0, 1 - current.height) };
    if (key === 'width') return { ...current, width: clamp(normalized, minimumWidth, 1 - current.x) };
    return { ...current, height: clamp(normalized, minimumHeight, 1 - current.y) };
  });
  return <dialog ref={dialog} className={`${styles.workspace} ${styles.dialog}`} aria-labelledby={titleId} aria-describedby={hintId}
    onCancel={event => { event.preventDefault(); onCancel(); }} onClick={event => {
      if (event.target !== event.currentTarget) return;
      const rect = event.currentTarget.getBoundingClientRect();
      if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) onCancel();
    }}>
    <h2 id={titleId}>Izreži sliko</h2>
    <p id={hintId} className={styles.hint}>Premaknite okvir ali povlecite njegove robove. Puščice premaknejo izbrani okvir ali rob za eno slikovno piko; Shift za deset. Izvirna slika ostane ohranjena.</p>
    <div ref={viewport} className={`${styles.cropPreview} ${styles.checkerboard}`} style={{ touchAction: 'none', userSelect: 'none' }}>
      <div ref={sourceArea} style={{ position: 'absolute', left: (frame.width - fittedWidth) / 2, top: (frame.height - fittedHeight) / 2, width: fittedWidth, height: fittedHeight }}
        onPointerMove={pointerMove} onPointerUp={finish} onPointerCancel={finish} onLostPointerCapture={() => { drag.current = null; }}>
        {/* The authenticated source endpoint retains the original pixels; this dialog edits only crop coordinates. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={asset.url} alt={asset.name} draggable={false} width={asset.width} height={asset.height} style={{ display: 'block', width: '100%', height: '100%', pointerEvents: 'none' }} onLoad={() => setImageReady(true)} onError={() => { setImageFailed(true); setImageReady(false); }} />
        {imageReady && <div className={styles.cropBox} style={{ left: crop.x * fittedWidth, top: crop.y * fittedHeight, width: crop.width * fittedWidth, height: crop.height * fittedHeight, boxSizing: 'border-box', touchAction: 'none' }}
          tabIndex={0} role="group" aria-label="Okvir izreza" onPointerDown={event => begin(event, 'move')} onKeyDown={event => keyboard(event, 'move')}>
          {handles.map(handle => <button key={handle.mode} type="button" className={styles.cropHandle} style={{ ...handle.style, minHeight: 0, padding: 0, borderRadius: 0, touchAction: 'none' }}
            aria-label={'Izrez: ' + handle.label.toLowerCase()} onPointerDown={event => begin(event, handle.mode)} onKeyDown={event => keyboard(event, handle.mode)} />)}
        </div>}
      </div>
      {!imageReady && <p role={imageFailed ? 'alert' : 'status'} style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', background: '#ffffffdd', padding: 16 }}>{imageFailed ? 'Izvirne slike ni mogoče naložiti. Zaprite okno in poskusite znova.' : 'Nalaganje izvirne slike …'}</p>}
    </div>
    <div className={styles.twoColumns}>
      <LogoNumber label="Levi rob (%)" value={crop.x * 100} min={0} max={(1 - crop.width) * 100} step={.1} onChange={value => number('x', value)} />
      <LogoNumber label="Zgornji rob (%)" value={crop.y * 100} min={0} max={(1 - crop.height) * 100} step={.1} onChange={value => number('y', value)} />
      <LogoNumber label="Širina izreza (%)" value={crop.width * 100} min={minimumWidth * 100} max={(1 - crop.x) * 100} step={.1} onChange={value => number('width', value)} />
      <LogoNumber label="Višina izreza (%)" value={crop.height * 100} min={minimumHeight * 100} max={(1 - crop.y) * 100} step={.1} onChange={value => number('height', value)} />
    </div>
    <div className={styles.dialogActions}>
      <button type="button" className={styles.button} onClick={() => setCrop({ x: 0, y: 0, width: 1, height: 1 })}>Celotna slika</button>
      <span className={styles.spacer} />
      <button type="button" className={styles.button} onClick={onCancel}>Prekliči</button>
      <button type="button" className={styles.primary} disabled={!imageReady} onClick={() => onApply({ ...crop })}>Uporabi izrez</button>
    </div>
  </dialog>;
}

export default function LogoImageCropDialog(props: Props) {
  return <CropEditor key={props.layer.id + ':' + props.asset.id} {...props} />;
}
