"use client";

import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type PointerEvent } from 'react';
import Moveable from 'react-moveable';
import { flushSync } from 'react-dom';
import Selecto from 'react-selecto';
import type { OnDragStart as SelectoDragStart, OnSelectEnd as SelectoSelectEnd } from 'selecto';
import { cloneLogoProject, type LogoLayer, type LogoProject, type LogoSourceAsset } from '@/shared/domain/logo/logoLibrary';
import { findLogoLayer, isLogoLayerLocked, resizeLogoLayer, validateLogoProject } from '@/shared/domain/logo/logoProject';
import styles from './LogoEditor.module.css';

export function LogoEditorFonts() {
  const faces = ['Inter', 'Barlow', 'Bitter'].flatMap(font => [400, 500, 600, 700].flatMap(weight => ['normal', 'italic'].map(style => `@font-face{font-family:"Logo ${font}";src:url("/fonts/${font}-${weight}-${style}.ttf") format("truetype");font-weight:${weight};font-style:${style};font-display:swap;}`)));
  faces.push('@font-face{font-family:"Logo Noto Sans";src:url("/fonts/NotoSans-Regular.ttf");font-weight:400;font-display:swap;}@font-face{font-family:"Logo Noto Sans";src:url("/fonts/NotoSans-Bold.ttf");font-weight:700;font-display:swap;}');
  return <style>{faces.join('')}</style>;
}

// Ascenders from the bundled TTF faces, in em. All supported weights/styles of
// each family share these metrics; the exporter positions glyph paths at this baseline.
const fontAscenders = { Inter: .96875, Barlow: 1, Bitter: .935, 'Noto Sans': 1.069 };

export function LogoCanvasArtwork({ layers, assets, interactive = false }: { layers: LogoLayer[]; assets: LogoSourceAsset[]; interactive?: boolean }) {
  return <>{layers.filter(layer => layer.visible).map(layer => {
    const transform = `translate(${layer.x}px, ${layer.y}px) rotate(${layer.rotation}deg)`;
    const style: CSSProperties = { position: 'absolute', left: 0, top: 0, width: layer.width, height: layer.height, transform, transformOrigin: 'center', opacity: layer.opacity, filter: layer.shadow ? `drop-shadow(${layer.shadow.offsetX}px ${layer.shadow.offsetY}px ${layer.shadow.blur / 2}px color-mix(in srgb, ${layer.shadow.color} ${layer.shadow.opacity * 100}%, transparent))` : undefined };
    let content;
    if (layer.type === 'group') content = <LogoCanvasArtwork layers={layer.children} assets={assets} interactive={interactive && !layer.locked} />;
    else if (layer.type === 'image') {
      const asset = assets.find(item => item.id === layer.assetId), crop = layer.crop;
      content = asset ? <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', borderRadius: layer.mask === 'ellipse' ? '50%' : 0 }}><svg width="100%" height="100%" viewBox={`0 0 ${layer.width} ${layer.height}`} preserveAspectRatio="none"><image href={asset.url} x={-crop.x * layer.width / crop.width} y={-crop.y * layer.height / crop.height} width={layer.width / crop.width} height={layer.height / crop.height} preserveAspectRatio="none" /></svg></div> : <div className={styles.missing}>Vir ni na voljo</div>;
    } else if (layer.type === 'text') {
      // SVG anchors include the final character spacing; the project spacing is only between glyphs.
      const x = layer.textAlign === 'center' ? (layer.width + layer.letterSpacing) / 2 : layer.textAlign === 'right' ? layer.width + layer.letterSpacing : 0;
      content = <svg width="100%" height="100%" viewBox={`0 0 ${layer.width} ${layer.height}`} style={{ overflow: 'visible', userSelect: 'none' }}>
        <text fill={layer.fill} textAnchor={layer.textAlign === 'center' ? 'middle' : layer.textAlign === 'right' ? 'end' : 'start'} style={{ whiteSpace: 'pre', fontFamily: `"Logo ${layer.fontFamily}"`, fontSize: layer.fontSize, fontWeight: layer.fontWeight, fontStyle: layer.fontStyle, letterSpacing: layer.letterSpacing, fontKerning: 'normal', fontVariantLigatures: layer.letterSpacing === 0 ? 'normal' : 'none' }}>
          {layer.text.split('\n').map((line, index) => <tspan key={index} x={x} y={fontAscenders[layer.fontFamily] * layer.fontSize + index * layer.fontSize * layer.lineHeight}>{line || ' '}</tspan>)}
        </text>
      </svg>;
    } else {
      const stroke = layer.strokeWidth;
      content = <svg width="100%" height="100%" viewBox={layer.shape === 'path' && layer.pathViewBox ? `${layer.pathViewBox.x} ${layer.pathViewBox.y} ${layer.pathViewBox.width} ${layer.pathViewBox.height}` : `0 0 ${layer.width} ${layer.height}`} preserveAspectRatio="none" style={{ overflow: 'visible' }}>
        {layer.shape === 'rectangle' ? <rect width={layer.width} height={layer.height} rx={layer.radius} fill={layer.fill} stroke={layer.stroke} strokeWidth={stroke} />
          : layer.shape === 'ellipse' ? <ellipse cx={layer.width / 2} cy={layer.height / 2} rx={layer.width / 2} ry={layer.height / 2} fill={layer.fill} stroke={layer.stroke} strokeWidth={stroke} />
            : layer.shape === 'line' ? <line x1={0} y1={0} x2={layer.width} y2={layer.height} fill={layer.fill} stroke={layer.stroke} strokeWidth={stroke} />
              : <path d={layer.path} fill={layer.fill} stroke={layer.stroke} strokeWidth={stroke} />}
      </svg>;
    }
    return <div key={layer.id} data-logo-layer={interactive ? layer.id : undefined} data-logo-selectable={interactive && !layer.locked ? layer.id : undefined} data-logo-locked={layer.locked || undefined} style={style}>{content}</div>;
  })}</>;
}

type Props = {
  project: LogoProject; assets: LogoSourceAsset[]; selected: string[]; onSelect: (ids: string[]) => void;
  onChange: (project: LogoProject, record?: boolean) => void; onGestureStart: () => void; onGestureEnd: () => void;
  tool: 'select' | 'hand'; keepRatio: boolean; snap: boolean; background: 'transparent' | 'light' | 'dark';
};
export default function LogoEditorCanvas({ project, assets, selected, onSelect, onChange, onGestureStart, onGestureEnd, tool, keepRatio, snap, background }: Props) {
  const viewport = useRef<HTMLDivElement>(null), stage = useRef<HTMLDivElement>(null), moveable = useRef<Moveable>(null);
  const selection = useRef<{ setSelectedTargets: (elements: HTMLElement[]) => unknown }>(null);
  const transforming = useRef(false);
  const gesture = useRef<LogoProject>(project), panGesture = useRef<{ x: number; y: number; startX: number; startY: number } | null>(null);
  const [zoom, setZoom] = useState(.75), [pan, setPan] = useState({ x: 0, y: 0 }), [space, setSpace] = useState(false);
  const [transformError, setTransformError] = useState('');
  const [targets, setTargets] = useState<HTMLElement[]>([]), [viewportSize, setViewportSize] = useState({ width: 800, height: 600 });
  const panning = tool === 'hand' || space;
  useEffect(() => { const element = viewport.current; if (!element) return; const observer = new ResizeObserver(() => setViewportSize({ width: element.clientWidth, height: element.clientHeight })); observer.observe(element); return () => observer.disconnect(); }, []);
  useEffect(() => {
    const element = viewport.current; if (!element) return;
    const wheel = (event: WheelEvent) => {
      event.preventDefault();
      if (event.ctrlKey || event.metaKey) setZoom(value => Math.max(.05, Math.min(8, value * Math.exp(-event.deltaY * .002))));
      else setPan(value => ({ x: value.x - event.deltaX, y: value.y - event.deltaY }));
    };
    element.addEventListener('wheel', wheel, { passive: false });
    return () => element.removeEventListener('wheel', wheel);
  }, []);
  const fit = () => { setZoom(Math.max(.05, Math.min(3, (viewportSize.width - 80) / project.canvas.width, (viewportSize.height - 80) / project.canvas.height))); setPan({ x: 0, y: 0 }); };
  useEffect(() => { setZoom(Math.max(.05, Math.min(2, (viewportSize.width - 80) / project.canvas.width, (viewportSize.height - 80) / project.canvas.height))); setPan({ x: 0, y: 0 }); }, [project.canvas.width, project.canvas.height, viewportSize.width, viewportSize.height]);
  useLayoutEffect(() => {
    const next = selected.map(id => stage.current?.querySelector<HTMLElement>(`[data-logo-layer="${id}"]`)).filter((element): element is HTMLElement => Boolean(element) && !isLogoLayerLocked(project, element!.dataset.logoLayer ?? ''));
    const independent = next.filter(element => !next.some(other => other !== element && other.contains(element)));
    setTargets(previous => previous.length === independent.length && previous.every((element, index) => element === independent[index]) ? previous : independent);
    selection.current?.setSelectedTargets(independent);
    if (!transforming.current) moveable.current?.updateRect();
  }, [selected, project, zoom, pan]);
  useLayoutEffect(() => { const frame = requestAnimationFrame(() => { if (!transforming.current) moveable.current?.updateRect(); }); return () => cancelAnimationFrame(frame); }, [targets]);
  useEffect(() => {
    const down = (event: KeyboardEvent) => { if (event.code === 'Space' && !(event.target instanceof HTMLElement && event.target.closest('input,textarea,select,[contenteditable="true"]'))) { event.preventDefault(); setSpace(true); } };
    const up = (event: KeyboardEvent) => { if (event.code === 'Space') setSpace(false); };
    const blur = () => setSpace(false);
    window.addEventListener('keydown', down); window.addEventListener('keyup', up); window.addEventListener('blur', blur);
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); window.removeEventListener('blur', blur); };
  }, []);
  const start = () => { transforming.current = true; gesture.current = cloneLogoProject(project); setTransformError(''); onGestureStart(); };
  const finish = () => { transforming.current = false; onGestureEnd(); requestAnimationFrame(() => moveable.current?.updateRect()); };
  const applyEvents = <T extends { target: HTMLElement | SVGElement }>(events: T[], transform: (layer: LogoLayer, event: T) => void) => {
    const next = cloneLogoProject(gesture.current);
    try {
      for (const event of events) {
        const id = (event.target as HTMLElement).dataset.logoLayer ?? '';
        // Event collections can include both a selected group and its descendant.
        // The group transform already includes that child and must apply only once.
        if (events.some(other => other !== event && other.target.contains(event.target)) || isLogoLayerLocked(next, id) || isLogoLayerLocked(project, id)) continue;
        const layer = findLogoLayer(next, id);
        if (layer) transform(layer, event);
      }
      const valid = validateLogoProject(next);
      flushSync(() => onChange(valid, false));
      setTransformError('');
    } catch (error) {
      // A rejected transform leaves the last valid frame intact, including all
      // other selected layers. For example a rotated group cannot be sheared.
      setTransformError(error instanceof Error ? error.message : 'Spremembe slojev ni mogoče uporabiti.');
    }
  };
  const drag = (events: Array<{ target: HTMLElement | SVGElement; beforeTranslate: number[] }>) => applyEvents(events, (layer, event) => {
    layer.x = event.beforeTranslate[0]; layer.y = event.beforeTranslate[1];
  });
  const beginPan = (event: PointerEvent<HTMLDivElement>) => {
    if (!panning && event.button !== 1) return;
    event.preventDefault(); event.currentTarget.setPointerCapture(event.pointerId);
    panGesture.current = { x: event.clientX, y: event.clientY, startX: pan.x, startY: pan.y };
  };
  const guidelines = Array.from(stage.current?.querySelectorAll<HTMLElement>('[data-logo-selectable]') ?? []).filter(element => !targets.some(target => target === element || target.contains(element) || element.contains(target))); 
  return <div className={styles.canvasColumn}>
    <LogoEditorFonts />
    <div ref={viewport} className={`${styles.viewport} ${panning ? styles.panning : ''}`} data-testid="logo-editor-canvas" onPointerDown={beginPan}
      onPointerMove={event => { const active = panGesture.current; if (active) setPan({ x: active.startX + event.clientX - active.x, y: active.startY + event.clientY - active.y }); }}
      onPointerUp={() => { panGesture.current = null; }} onPointerCancel={() => { panGesture.current = null; }}
      >
      <div ref={stage} className={`${styles.stage} ${background === 'transparent' ? styles.checkerboard : ''}`} style={{ width: project.canvas.width, height: project.canvas.height, left: viewportSize.width / 2 + pan.x - project.canvas.width * zoom / 2, top: viewportSize.height / 2 + pan.y - project.canvas.height * zoom / 2, transform: `scale(${zoom})`, backgroundColor: background === 'dark' ? '#172033' : background === 'light' ? '#ffffff' : undefined }}>
        <div className={styles.canvasArtwork}><LogoCanvasArtwork layers={project.layers} assets={assets} interactive /></div>
        {!project.layers.length && <span className={styles.emptyCanvas} style={{ fontSize: 13 / zoom }}>Dodajte sliko, besedilo ali obliko.</span>}
      </div>
      {!panning && <Selecto ref={selection} container={viewport.current} dragContainer={viewport.current ?? undefined} selectableTargets={[() => Array.from(stage.current?.querySelectorAll<HTMLElement>('[data-logo-selectable]') ?? [])]} selectByClick selectFromInside={false} toggleContinueSelect={['ctrl', 'meta', 'shift']} hitRate={0}
        onDragStart={(event: SelectoDragStart) => { if (moveable.current?.isMoveableElement(event.inputEvent.target) || event.inputEvent.button === 1) event.stop(); }}
        onSelectEnd={(event: SelectoSelectEnd) => {
          const input = event.inputEvent as MouseEvent;
          const clicked = input.target instanceof Element ? input.target.closest<HTMLElement>('[data-logo-selectable]') : null;
          const modifier = input.ctrlKey || input.metaKey || input.shiftKey;
          let elements = event.selected.filter(element => stage.current?.contains(element) && !event.selected.some(parent => parent !== element && parent.contains(element))) as HTMLElement[];
          if ((event.isClick || event.isDragStartEnd) && clicked && stage.current?.contains(clicked)) {
            const current = targets.filter(element => stage.current?.contains(element));
            if (modifier) elements = current.includes(clicked) ? current.filter(element => element !== clicked) : [...current.filter(element => !element.contains(clicked) && !clicked.contains(element)), clicked];
            else elements = !event.isDouble && current.some(element => element === clicked || element.contains(clicked)) ? current : [clicked];
          }
          elements = elements.filter(element => !isLogoLayerLocked(project, element.dataset.logoLayer ?? ''));
          onSelect(elements.map(element => element.dataset.logoLayer!).filter(Boolean));
          if (event.isDragStartEnd && elements.length && !modifier) {
            input.preventDefault();
            void moveable.current?.waitToChangeTarget().then(() => moveable.current?.dragStart(input));
          }
        }} />}
      {!panning && <Moveable ref={moveable} flushSync={flushSync} target={targets.length === 1 ? targets[0] : targets} container={viewport.current} rootContainer={viewport.current} origin={false} draggable resizable rotatable keepRatio={keepRatio}
        snappable={snap} snapThreshold={5} elementGuidelines={guidelines} verticalGuidelines={stage.current ? [stage.current.offsetLeft, stage.current.offsetLeft + project.canvas.width * zoom / 2, stage.current.offsetLeft + project.canvas.width * zoom] : []} horizontalGuidelines={stage.current ? [stage.current.offsetTop, stage.current.offsetTop + project.canvas.height * zoom / 2, stage.current.offsetTop + project.canvas.height * zoom] : []}
        checkResizableError={false} throttleDrag={0} throttleResize={0} throttleRotate={1} checkInput
        onDragStart={event => { start(); const layer = findLogoLayer(project, (event.target as HTMLElement).dataset.logoLayer!); if (layer) event.set([layer.x, layer.y]); }}
        onDrag={event => drag([event])} onDragEnd={finish}
        onDragGroupStart={event => { start(); event.events.forEach(item => { const layer = findLogoLayer(project, (item.target as HTMLElement).dataset.logoLayer!); if (layer) item.set([layer.x, layer.y]); }); }}
        onDragGroup={event => drag(event.events)} onDragGroupEnd={finish}
        onResizeStart={event => { start(); const layer = findLogoLayer(project, (event.target as HTMLElement).dataset.logoLayer!); if (layer) { event.set([layer.width, layer.height]); if (event.dragStart) event.dragStart.set([layer.x, layer.y]); } }}
        onResize={event => applyEvents([event], (layer, item) => { resizeLogoLayer(layer, item.width, item.height); layer.x = item.drag.beforeTranslate[0]; layer.y = item.drag.beforeTranslate[1]; })} onResizeEnd={finish}
        onResizeGroupStart={event => { start(); event.events.forEach(item => { const layer = findLogoLayer(project, (item.target as HTMLElement).dataset.logoLayer!); if (layer) { item.set([layer.width, layer.height]); if (item.dragStart) item.dragStart.set([layer.x, layer.y]); } }); }}
        onResizeGroup={event => applyEvents(event.events, (layer, item) => { resizeLogoLayer(layer, item.width, item.height); layer.x = item.drag.beforeTranslate[0]; layer.y = item.drag.beforeTranslate[1]; })} onResizeGroupEnd={finish}
        onRotateStart={event => { start(); const layer = findLogoLayer(project, (event.target as HTMLElement).dataset.logoLayer!); if (layer) { event.set(layer.rotation); if (event.dragStart) event.dragStart.set([layer.x, layer.y]); } }}
        onRotate={event => applyEvents([event], (layer, item) => { layer.rotation = item.beforeRotate; layer.x = item.drag.beforeTranslate[0]; layer.y = item.drag.beforeTranslate[1]; })} onRotateEnd={finish}
        onRotateGroupStart={event => { start(); event.events.forEach(item => { const layer = findLogoLayer(project, (item.target as HTMLElement).dataset.logoLayer!); if (layer) { item.set(layer.rotation); if (item.dragStart) item.dragStart.set([layer.x, layer.y]); } }); }}
        onRotateGroup={event => applyEvents(event.events, (layer, item) => { layer.rotation = item.beforeRotate; layer.x = item.drag.beforeTranslate[0]; layer.y = item.drag.beforeTranslate[1]; })} onRotateGroupEnd={finish} />}
      {transformError && <div role="alert" className={`${styles.status} ${styles.error}`} style={{ position: 'absolute', left: 12, right: 12, bottom: 8, zIndex: 2 }}>{transformError}</div>}
    </div>
    <div className={styles.canvasStatus}><span>Platno {Math.round(project.canvas.width)} × {Math.round(project.canvas.height)} px</span><div><button type="button" onClick={() => setZoom(value => Math.max(.05, value / 1.2))} aria-label="Pomanjšaj">−</button><button type="button" onClick={() => setZoom(1)}>{Math.round(zoom * 100)} %</button><button type="button" onClick={() => setZoom(value => Math.min(8, value * 1.2))} aria-label="Povečaj">+</button><button type="button" onClick={fit}>Prilagodi pogledu</button></div><span>Preslednica: premik pogleda</span></div>
  </div>;
}





