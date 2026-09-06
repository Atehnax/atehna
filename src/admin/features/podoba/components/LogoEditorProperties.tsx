"use client";

import { CompactHexColorField } from '@/shared/ui/admin-controls/CompactHexColorField';
import { Eye, EyeOff, LockKeyhole, UnlockKeyhole, ChevronUp, ChevronDown, Copy, Trash2, Group, Ungroup, ImagePlus } from 'lucide-react';
import { AppearanceEditorNumberInput } from './AppearanceEditorToolbarPrimitives';
import { LOGO_FONT_FAMILIES, type LogoBounds, type LogoLayer, type LogoProject, type LogoSourceAsset } from '@/shared/domain/logo/logoLibrary';
import { findLogoLayer, isLogoLayerLocked, resizeLogoLayer, rotateLogoPoint, updateLogoLayers } from '@/shared/domain/logo/logoProject';
import styles from './LogoEditor.module.css';

export function cropLogoImage(project: LogoProject, id: string, nextCrop: LogoBounds): LogoProject {
  return updateLogoLayers(project, [id], layer => {
    if (layer.type !== 'image') return;
    const old = layer.crop, width = layer.width * nextCrop.width / old.width, height = layer.height * nextCrop.height / old.height;
    const localX = (nextCrop.x - old.x) * layer.width / old.width, localY = (nextCrop.y - old.y) * layer.height / old.height;
    const center = rotateLogoPoint(localX + width / 2, localY + height / 2, layer.width / 2, layer.height / 2, layer.rotation);
    layer.x += center.x - width / 2; layer.y += center.y - height / 2;
    layer.width = width; layer.height = height; layer.crop = nextCrop;
  });
}

export function LogoNumber({ label, value, onChange, min = -32768, max = 32768, step = 1, disabled = false }: { label: string; value: number; onChange: (value: number) => void; min?: number; max?: number; step?: number; disabled?: boolean }) {
  return <label className={styles.field}><span>{label}</span><AppearanceEditorNumberInput aria-label={label} value={Math.round(value * 100) / 100} min={min} max={max} step={step} disabled={disabled} onValueChange={onChange} className={styles.input} /></label>;
}
function ColorField({ label, value, onChange, marker }: { label: string; value: string; onChange: (value: string) => void; marker: string }) {
  return <CompactHexColorField label={label} marker={marker} tone="light" layout="inline" allowAlpha allowClear clearLabel="Brez barve" value={value === 'none' ? '' : value === 'transparent' ? '#00000000' : value} onChange={color => onChange(color || 'none')} inputAttributes={{ 'aria-label': label + ' HEX' }} />;
}

type Props = {
  project: LogoProject; assets: LogoSourceAsset[]; selected: string[]; onError: (message: string) => void; onSelect: (ids: string[]) => void;
  onChange: (project: LogoProject) => void; onDuplicate: () => void; onDelete: () => void; onGroup: () => void; onUngroup: () => void;
  onReorder: (direction: -1 | 1) => void; onReplaceImage: (id: string) => void; onCropImage: (id: string) => void; keepRatio: boolean; setKeepRatio: (value: boolean) => void;
};
export default function LogoEditorProperties({ project, assets, selected, onError, onSelect, onChange, onDuplicate, onDelete, onGroup, onUngroup, onReorder, onReplaceImage, onCropImage, keepRatio, setKeepRatio }: Props) {
  const layer = selected.length === 1 ? findLogoLayer(project, selected[0]) : undefined;
  const locked = layer ? isLogoLayerLocked(project, layer.id) : false;
  const change = (update: (layer: LogoLayer) => void) => { try { onChange(updateLogoLayers(project, selected, update)); } catch (error) { onError(error instanceof Error ? error.message : 'Spremembe ni mogoče uporabiti.'); } };
  const tree = (layers: LogoLayer[], depth = 0) => [...layers].reverse().map(item => <div key={item.id}>
    <div className={`${styles.layerRow} ${selected.includes(item.id) ? styles.selectedLayer : ''}`} style={{ paddingLeft: 6 + depth * 12 }} data-layer-row={item.id}>
      <button type="button" className={styles.layerName} onClick={event => onSelect(event.ctrlKey || event.metaKey || event.shiftKey ? selected.includes(item.id) ? selected.filter(id => id !== item.id) : [...selected, item.id] : [item.id])} title={item.name} aria-pressed={selected.includes(item.id)}><span className={styles.layerKind}>{item.type === 'text' ? 'T' : item.type === 'image' ? '▧' : item.type === 'group' ? '▤' : '◇'}</span><span>{item.name}</span></button>
      <button type="button" title={item.visible ? 'Skrij sloj' : 'Pokaži sloj'} aria-label={`${item.visible ? 'Skrij' : 'Pokaži'} ${item.name}`} onClick={() => onChange(updateLogoLayers(project, [item.id], target => { target.visible = !target.visible; }))}>{item.visible ? <Eye /> : <EyeOff />}</button>
      <button type="button" title={item.locked ? 'Odkleni sloj' : 'Zakleni sloj'} aria-label={`${item.locked ? 'Odkleni' : 'Zakleni'} ${item.name}`} onClick={() => onChange(updateLogoLayers(project, [item.id], target => { target.locked = !target.locked; }))}>{item.locked ? <LockKeyhole /> : <UnlockKeyhole />}</button>
    </div>{item.type === 'group' && tree(item.children, depth + 1)}
  </div>);
  return <aside className={styles.inspector}>
    <div className={styles.panelHeading}><h2>Sloji</h2><span>{project.layers.length}</span></div>
    <div className={styles.layerTree} data-testid="logo-layers">{tree(project.layers)}{!project.layers.length && <p className={styles.hint}>Sloje dodate z orodno vrstico levo.</p>}</div>
    <div className={styles.layerActions}>
      <button type="button" title="Premakni naprej" aria-label="Premakni sloj naprej" disabled={!layer} onClick={() => onReorder(1)}><ChevronUp /></button><button type="button" title="Premakni nazaj" aria-label="Premakni sloj nazaj" disabled={!layer} onClick={() => onReorder(-1)}><ChevronDown /></button>
      <button type="button" title="Podvoji sloje" aria-label="Podvoji sloje" disabled={!selected.length} onClick={onDuplicate}><Copy /></button><button type="button" title="Združi v skupino" aria-label="Združi v skupino" disabled={selected.length < 2} onClick={onGroup}><Group /></button><button type="button" title="Razdruži skupino" aria-label="Razdruži skupino" disabled={layer?.type !== 'group'} onClick={onUngroup}><Ungroup /></button><button type="button" title="Izbriši sloje" aria-label="Izbriši sloje" disabled={!selected.length} onClick={onDelete}><Trash2 /></button>
    </div>
    <div className={styles.panelHeading}><h2>Lastnosti</h2><span>{selected.length > 1 ? 'Izbranih: ' + selected.length : layer?.type === 'image' ? 'Slika' : layer?.type === 'text' ? 'Besedilo' : layer?.type === 'shape' ? 'Oblika' : layer?.type === 'group' ? 'Skupina' : 'Platno'}</span></div>
    <div className={styles.properties}>
      {!selected.length ? <><div className={styles.twoColumns}><LogoNumber label="Širina platna" value={project.canvas.width} min={1} max={8192} onChange={width => onChange({ ...project, canvas: { ...project.canvas, width } })} /><LogoNumber label="Višina platna" value={project.canvas.height} min={1} max={8192} onChange={height => onChange({ ...project, canvas: { ...project.canvas, height } })} /></div><p className={styles.hint}>Platno je prosojno. Ozadje predogleda se ne izvozi. Največ 4 milijone slikovnih pik.</p><p className={styles.hint}>Izberite sloj na platnu ali v seznamu. Ctrl/Cmd-klik doda sloj v izbor.</p></>
        : selected.length > 1 ? <><p className={styles.hint}>Poravnavo in razporeditev izbranih slojev nastavite nad platnom.</p><LogoNumber label="Prosojnost izbora (%)" value={Math.round((findLogoLayer(project, selected[0])?.opacity ?? 1) * 100)} min={0} max={100} onChange={value => change(item => { if (!item.locked) item.opacity = value / 100; })} /></>
          : layer && <>
            <label className={styles.field}><span>Ime sloja</span><input className={styles.input} aria-label="Ime sloja" value={layer.name} maxLength={120} onChange={event => change(item => { item.name = event.target.value; })} /></label>
            {locked && <p className={styles.hint}>Sloj ali njegova skupina je zaklenjena. Za urejanje jo odklenite v seznamu.</p>}
            <fieldset disabled={locked} className={styles.propertyFields}>
              <div className={styles.twoColumns}><LogoNumber label="Položaj X" value={layer.x} onChange={value => change(item => { item.x = value; })} /><LogoNumber label="Položaj Y" value={layer.y} onChange={value => change(item => { item.y = value; })} /></div>
              <div className={styles.twoColumns}><LogoNumber label="Širina sloja" value={layer.width} min={.1} max={8192} onChange={width => change(item => resizeLogoLayer(item, width, keepRatio ? item.height * width / item.width : item.height))} /><LogoNumber label="Višina sloja" value={layer.height} min={.1} max={8192} onChange={height => change(item => resizeLogoLayer(item, keepRatio ? item.width * height / item.height : item.width, height))} /></div>
              <label className={styles.check}><input type="checkbox" checked={keepRatio} onChange={event => setKeepRatio(event.target.checked)} />Ohrani razmerje stranic</label>
              <div className={styles.twoColumns}><LogoNumber label="Zasuk (°)" value={layer.rotation} min={-3600} max={3600} onChange={value => change(item => { item.rotation = value; })} /><LogoNumber label="Prosojnost (%)" value={layer.opacity * 100} min={0} max={100} onChange={value => change(item => { item.opacity = value / 100; })} /></div>
              {layer.type === 'text' && <>
                <label className={styles.field}><span>Besedilo</span><textarea rows={3} className={styles.input} aria-label="Vsebina besedila" value={layer.text} maxLength={2000} onChange={event => change(item => { if (item.type === 'text') item.text = event.target.value; })} /></label>
                <label className={styles.field}><span>Pisava</span><select className={styles.input} aria-label="Pisava" value={layer.fontFamily} onChange={event => change(item => { if (item.type === 'text') { item.fontFamily = event.target.value as typeof item.fontFamily; if (item.fontFamily === 'Noto Sans') { item.fontWeight = 400; item.fontStyle = 'normal'; } } })}>{LOGO_FONT_FAMILIES.map(font => <option key={font}>{font}</option>)}</select></label>
                <div className={styles.twoColumns}><LogoNumber label="Velikost pisave" value={layer.fontSize} min={1} max={1024} onChange={value => change(item => { if (item.type === 'text') item.fontSize = value; })} /><label className={styles.field}><span>Debelina</span><select className={styles.input} aria-label="Debelina pisave" value={layer.fontWeight} onChange={event => change(item => { if (item.type === 'text') item.fontWeight = Number(event.target.value) as 400; })}>{(layer.fontFamily === 'Noto Sans' ? [400, 700] : [400, 500, 600, 700]).map(weight => <option key={weight} value={weight}>{weight}</option>)}</select></label></div>
                <label className={styles.check}><input type="checkbox" disabled={layer.fontFamily === 'Noto Sans'} checked={layer.fontStyle === 'italic'} onChange={event => change(item => { if (item.type === 'text') item.fontStyle = event.target.checked ? 'italic' : 'normal'; })} />Ležeče</label>
                <ColorField marker="fill" label="Barva besedila" value={layer.fill} onChange={value => change(item => { if (item.type === 'text') item.fill = value; })} />
                <label className={styles.field}><span>Poravnava besedila</span><select aria-label="Poravnava besedila" className={styles.input} value={layer.textAlign} onChange={event => change(item => { if (item.type === 'text') item.textAlign = event.target.value as 'left'; })}><option value="left">Levo</option><option value="center">Sredina</option><option value="right">Desno</option></select></label>
                <div className={styles.twoColumns}><LogoNumber label="Medvrstični razmik" value={layer.lineHeight} min={.5} max={5} step={.05} onChange={value => change(item => { if (item.type === 'text') item.lineHeight = value; })} /><LogoNumber label="Razmik črk" value={layer.letterSpacing} min={-64} max={1024} step={.1} onChange={value => change(item => { if (item.type === 'text') item.letterSpacing = value; })} /></div>
              </>}
              {layer.type === 'shape' && <><ColorField marker="fill" label="Polnilo" value={layer.fill} onChange={value => change(item => { if (item.type === 'shape') item.fill = value; })} /><ColorField marker="stroke" label="Obroba" value={layer.stroke} onChange={value => change(item => { if (item.type === 'shape') item.stroke = value; })} /><LogoNumber label="Debelina obrobe" value={layer.strokeWidth} min={0} max={256} onChange={value => change(item => { if (item.type === 'shape') item.strokeWidth = value; })} />{layer.shape === 'rectangle' && <LogoNumber label="Zaobljenost" value={layer.radius} min={0} max={Math.min(layer.width, layer.height) / 2} onChange={value => change(item => { if (item.type === 'shape') item.radius = value; })} />}{layer.shape === 'path' && <p className={styles.hint}>Uvožena vektorska pot. Uredite njeno barvo, obrobo in položaj.</p>}</>}
              {layer.type === 'image' && <>
                <p className={styles.hint}>Slika je en sloj. Vdelano besedilo ni ločeno urejljivo; območje lahko izrežete in dodate nov besedilni sloj.</p>
                <button type="button" className={styles.button} onClick={() => onReplaceImage(layer.id)}><ImagePlus />Zamenjaj sliko</button>
                <button type="button" className={styles.button} onClick={() => onCropImage(layer.id)}>Izreži sliko …</button>
                <label className={styles.field}><span>Maska</span><select aria-label="Maska slike" className={styles.input} value={layer.mask} onChange={event => change(item => { if (item.type === 'image') item.mask = event.target.value as 'rectangle'; })}><option value="rectangle">Pravokotnik</option><option value="ellipse">Elipsa</option></select></label>
                <button type="button" className={styles.button} onClick={() => onChange(cropLogoImage(project, layer.id, { x: 0, y: 0, width: 1, height: 1 }))}>Obnovi celotno sliko</button>
                <button type="button" className={styles.button} onClick={() => { const asset = assets.find(item => item.id === layer.assetId); if (asset?.bounds.width && asset.bounds.height) onChange(cropLogoImage(project, layer.id, { x: asset.bounds.x / asset.width, y: asset.bounds.y / asset.height, width: asset.bounds.width / asset.width, height: asset.bounds.height / asset.height })); }}>Odstrani prosojne robove slike</button>
              </>}
              {layer.type !== 'group' && <details className={styles.effects}><summary>Senca</summary><label className={styles.check}><input type="checkbox" checked={Boolean(layer.shadow)} onChange={event => change(item => { item.shadow = event.target.checked ? { color: '#000000', opacity: .2, blur: 4, offsetX: 2, offsetY: 2 } : undefined; })} />Omogoči senco</label>{layer.shadow && <><ColorField marker="shadow.color" label="Barva sence" value={layer.shadow.color} onChange={value => change(item => { if (item.shadow) item.shadow.color = value; })} /><div className={styles.twoColumns}><LogoNumber label="Zameglitev sence" value={layer.shadow.blur} min={0} max={128} onChange={value => change(item => { if (item.shadow) item.shadow.blur = value; })} /><LogoNumber label="Prosojnost sence (%)" value={layer.shadow.opacity * 100} min={0} max={100} onChange={value => change(item => { if (item.shadow) item.shadow.opacity = value / 100; })} /><LogoNumber label="Odmik sence X" value={layer.shadow.offsetX} min={-512} max={512} onChange={value => change(item => { if (item.shadow) item.shadow.offsetX = value; })} /><LogoNumber label="Odmik sence Y" value={layer.shadow.offsetY} min={-512} max={512} onChange={value => change(item => { if (item.shadow) item.shadow.offsetY = value; })} /></div></>}</details>}
            </fieldset>
          </>}
    </div>
  </aside>;
}
