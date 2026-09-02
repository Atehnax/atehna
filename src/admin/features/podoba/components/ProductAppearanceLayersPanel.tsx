'use client';

import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Eye, EyeOff, GripVertical, Lock, Unlock } from 'lucide-react';
import { useCallback, useMemo, type ReactNode } from 'react';
import type { ProductCanvasElementDeviceSettings } from '@/shared/domain/style/productAppearance';
import type { ProductCanvasSelectionOptions } from '@/shared/ui/product-canvas/ProductCanvasElement';
import { adminControlFocusTokenClasses } from '@/shared/ui/theme/tokens';

export type ProductAppearanceLayerItem = {
  id: string;
  label: string;
  group: string;
  parentId: string | null;
  domOrder: number;
  settings: ProductCanvasElementDeviceSettings;
  protectedElement: boolean;
};

type ProductAppearanceLayersPanelProps = {
  items: readonly ProductAppearanceLayerItem[];
  selectedIds: readonly string[];
  className?: string;
  onSelect: (
    id: string,
    options?: ProductCanvasSelectionOptions
  ) => void;
  onToggleVisibility: (id: string) => void;
  onToggleLock: (id: string) => void;
  onReorder: (parentId: string | null, topFirstIds: readonly string[]) => void;
};

const classes = (...values: Array<string | false | null | undefined>) =>
  values.filter(Boolean).join(' ');

export function sortProductAppearanceLayersTopFirst(
  items: readonly ProductAppearanceLayerItem[]
) {
  return [...items].sort((first, second) => (
    second.settings.zIndex - first.settings.zIndex
    || second.domOrder - first.domOrder
    || first.label.localeCompare(second.label, 'sl')
  ));
}

export function moveSelectedProductAppearanceLayers(
  topFirstIds: readonly string[],
  activeId: string,
  overId: string,
  selectedIds: readonly string[] = []
) {
  const activeIndex = topFirstIds.indexOf(activeId);
  const overIndex = topFirstIds.indexOf(overId);
  if (activeIndex < 0 || overIndex < 0 || activeIndex === overIndex) {
    return [...topFirstIds];
  }

  const selected = new Set(selectedIds);
  const movingIds = selected.has(activeId)
    ? topFirstIds.filter((id) => selected.has(id))
    : [activeId];
  if (movingIds.includes(overId)) return [...topFirstIds];

  const moving = new Set(movingIds);
  const remaining = topFirstIds.filter((id) => !moving.has(id));
  const remainingOverIndex = remaining.indexOf(overId);
  if (remainingOverIndex < 0) return [...topFirstIds];

  const insertAt = activeIndex < overIndex
    ? remainingOverIndex + 1
    : remainingOverIndex;
  return [
    ...remaining.slice(0, insertAt),
    ...movingIds,
    ...remaining.slice(insertAt)
  ];
}

export function rankProductAppearanceLayersTopFirst(
  topFirstIds: readonly string[]
) {
  const uniqueIds = Array.from(new Set(topFirstIds));
  return uniqueIds.map((id, index) => ({
    id,
    zIndex: uniqueIds.length - index
  }));
}

function SortableLayerBranch({
  item,
  depth,
  selected,
  children,
  onSelect,
  onToggleVisibility,
  onToggleLock
}: {
  item: ProductAppearanceLayerItem;
  depth: number;
  selected: boolean;
  children: ReactNode;
  onSelect: ProductAppearanceLayersPanelProps['onSelect'];
  onToggleVisibility: ProductAppearanceLayersPanelProps['onToggleVisibility'];
  onToggleLock: ProductAppearanceLayersPanelProps['onToggleLock'];
}) {
  const {
    attributes,
    listeners,
    setActivatorNodeRef,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: item.id, disabled: item.settings.locked });

  return (
    <div
      data-product-appearance-layer={item.id}
      data-product-appearance-layer-parent={item.parentId ?? 'root'}
      data-product-appearance-layer-selected={selected || undefined}
    >
      <div
        ref={setNodeRef}
        className={classes(
          'grid min-w-0 grid-cols-[24px_minmax(0,1fr)_24px_24px] items-center gap-0.5 rounded-lg border py-1 pr-1 transition',
          selected
            ? 'border-[color:var(--blue-200)] bg-[color:var(--blue-50)] text-[color:var(--blue-800)]'
            : 'border-transparent text-slate-600 hover:border-slate-200 hover:bg-slate-50',
          !item.settings.visible && 'opacity-55',
          isDragging && 'relative z-20 opacity-80'
        )}
        style={{
          paddingLeft: 4 + depth * 10,
          transform: CSS.Transform.toString(transform),
          transition
        }}
      >
        <button
          ref={setActivatorNodeRef}
          type="button"
          {...attributes}
          {...listeners}
          aria-label={item.settings.locked
            ? 'Izberi zaklenjeno plast: ' + item.label
            : 'Izberi ali premakni plast: ' + item.label}
          aria-pressed={selected}
          title={item.settings.locked
            ? 'Plast je zaklenjena; kliknite za izbor'
            : 'Kliknite za izbor ali povlecite za spremembo vrstnega reda'}
          onClick={(event) => onSelect(item.id, {
            additive: event.ctrlKey || event.metaKey,
            label: item.label
          })}
          className={classes(
            'col-span-2 grid min-w-0 grid-cols-[24px_minmax(0,1fr)] items-center gap-0.5 rounded-md text-left transition',
            item.settings.locked
              ? 'cursor-default'
              : 'cursor-grab hover:bg-white active:cursor-grabbing',
            adminControlFocusTokenClasses
          )}
        >
          <span className="grid h-6 w-6 place-items-center text-slate-400">
            <GripVertical className="h-3.5 w-3.5" />
          </span>
          <span className="block w-full min-w-0 overflow-hidden px-1 py-0.5">
            <span className="block w-full min-w-0 truncate text-[9px] font-semibold leading-[11px]">
              {item.label}
            </span>
            <span className="block w-full min-w-0 truncate text-[7.5px] font-medium leading-[10px] text-slate-400">
              {item.group}
            </span>
          </span>
        </button>
        <button
          type="button"
          disabled={item.protectedElement}
          aria-label={(item.settings.visible ? 'Skrij: ' : 'Prikaži: ') + item.label}
          aria-pressed={item.settings.visible}
          title={item.protectedElement
            ? 'Zaščitenega elementa ni mogoče skriti'
            : undefined}
          onClick={(event) => {
            event.stopPropagation();
            onToggleVisibility(item.id);
          }}
          className={classes(
            'grid h-6 w-6 place-items-center rounded-md text-slate-500 transition',
            'hover:bg-white hover:text-slate-800 disabled:cursor-not-allowed disabled:opacity-30',
            adminControlFocusTokenClasses
          )}
        >
          {item.settings.visible
            ? <Eye className="h-3.5 w-3.5" />
            : <EyeOff className="h-3.5 w-3.5" />}
        </button>
        <button
          type="button"
          aria-label={(item.settings.locked ? 'Odkleni: ' : 'Zakleni: ') + item.label}
          aria-pressed={item.settings.locked}
          onClick={(event) => {
            event.stopPropagation();
            onToggleLock(item.id);
          }}
          className={classes(
            'grid h-6 w-6 place-items-center rounded-md text-slate-500 transition',
            'hover:bg-white hover:text-slate-800',
            adminControlFocusTokenClasses
          )}
        >
          {item.settings.locked
            ? <Lock className="h-3.5 w-3.5" />
            : <Unlock className="h-3.5 w-3.5" />}
        </button>
      </div>
      {children}
    </div>
  );
}

export default function ProductAppearanceLayersPanel({
  items,
  selectedIds,
  className,
  onSelect,
  onToggleVisibility,
  onToggleLock,
  onReorder
}: ProductAppearanceLayersPanelProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );
  const orderedItems = useMemo(() => {
    const knownIds = new Set(items.map((item) => item.id));
    return sortProductAppearanceLayersTopFirst(
      items.map((item) => (
        item.parentId && !knownIds.has(item.parentId)
          ? { ...item, parentId: null }
          : item
      ))
    );
  }, [items]);
  const itemById = useMemo(
    () => new Map(orderedItems.map((item) => [item.id, item])),
    [orderedItems]
  );
  const selected = useMemo(() => new Set(selectedIds), [selectedIds]);
  const siblingCollisionDetection = useCallback<CollisionDetection>((args) => {
    const activeItem = itemById.get(String(args.active.id));
    if (!activeItem) return closestCenter(args);
    return closestCenter({
      ...args,
      droppableContainers: args.droppableContainers.filter((container) => (
        itemById.get(String(container.id))?.parentId === activeItem.parentId
      ))
    });
  }, [itemById]);

  const renderScope = (parentId: string | null, depth = 0): ReactNode => {
    const siblings = orderedItems.filter((item) => item.parentId === parentId);
    if (siblings.length === 0) return null;
    return (
      <SortableContext
        items={siblings.map((item) => item.id)}
        strategy={verticalListSortingStrategy}
      >
        <div className="grid gap-0.5">
          {siblings.map((item) => (
            <SortableLayerBranch
              key={item.id}
              item={item}
              depth={depth}
              selected={selected.has(item.id)}
              onSelect={onSelect}
              onToggleVisibility={onToggleVisibility}
              onToggleLock={onToggleLock}
            >
              {renderScope(item.id, depth + 1)}
            </SortableLayerBranch>
          ))}
        </div>
      </SortableContext>
    );
  };

  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    const activeItem = itemById.get(String(active.id));
    const overItem = itemById.get(String(over.id));
    if (
      !activeItem
      || !overItem
      || activeItem.settings.locked
      || activeItem.parentId !== overItem.parentId
    ) {
      return;
    }

    const siblings = orderedItems.filter(
      (item) => item.parentId === activeItem.parentId
    );
    const selectedMovableIds = selectedIds.filter((id) => {
      const item = itemById.get(id);
      return item?.parentId === activeItem.parentId && !item.settings.locked;
    });
    const nextOrder = moveSelectedProductAppearanceLayers(
      siblings.map((item) => item.id),
      activeItem.id,
      overItem.id,
      selectedMovableIds
    );
    onReorder(activeItem.parentId, nextOrder);
  };

  return (
    <aside
      data-product-appearance-layers-panel
      className={classes(
        'min-w-0 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm',
        className
      )}
    >
      <div className="border-b border-slate-200 px-3 py-2.5">
        <h3 className="text-xs font-semibold text-slate-900">Plasti</h3>
        <p className="mt-0.5 text-[9px] leading-3 text-slate-500">
          Najvišja plast je na vrhu. Povlecite znotraj iste skupine.
        </p>
      </div>
      <div className="border-b border-slate-100 px-3 py-1.5 text-[9px] text-slate-400">
        Ctrl/Cmd + klik izbere več plasti
      </div>
      <nav
        aria-label="Plasti predogleda"
        className="max-h-[min(640px,calc(100vh-220px))] overflow-y-auto overscroll-contain p-2"
        data-appearance-editor-scroll-purpose="navigation"
      >
        {orderedItems.some((item) => item.parentId === null) ? (
          <DndContext
            sensors={sensors}
            collisionDetection={siblingCollisionDetection}
            onDragEnd={handleDragEnd}
          >
            {renderScope(null)}
          </DndContext>
        ) : (
          <p className="px-2 py-8 text-center text-[10px] text-slate-400">
            Ni plasti za prikaz.
          </p>
        )}
      </nav>
    </aside>
  );
}
