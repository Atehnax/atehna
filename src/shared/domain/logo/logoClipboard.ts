import { cloneLogoProject, type LogoLayer, type LogoProject } from './logoLibrary';
import { copyLogoLayer, rotateLogoPoint } from './logoProject';

/** Capture independent selected layers in canvas coordinates, including rotated groups. */
export function copyLogoSelection(project: LogoProject, ids: readonly string[]): LogoLayer[] {
  const selected = new Set(ids), result: LogoLayer[] = [];
  const visit = (layers: LogoLayer[], parent?: LogoLayer) => {
    for (const layer of layers) {
      const copy = structuredClone(layer);
      if (parent) {
        const center = rotateLogoPoint(layer.x + layer.width / 2, layer.y + layer.height / 2, parent.width / 2, parent.height / 2, parent.rotation);
        copy.x = parent.x + center.x - layer.width / 2;
        copy.y = parent.y + center.y - layer.height / 2;
        copy.rotation += parent.rotation;
      }
      if (selected.has(layer.id)) result.push(copy);
      else if (layer.type === 'group') visit(layer.children, copy);
    }
  };
  visit(project.layers);
  return result;
}

export function pasteLogoSelection(project: LogoProject, clipboard: readonly LogoLayer[], offset = 12) {
  const next = cloneLogoProject(project);
  const copies = clipboard.map(layer => {
    const copy = copyLogoLayer(layer);
    copy.x += offset; copy.y += offset;
    copy.name = (copy.name + ' · kopija').slice(0, 120);
    return copy;
  });
  next.layers.push(...copies);
  return { project: next, ids: copies.map(layer => layer.id) };
}
