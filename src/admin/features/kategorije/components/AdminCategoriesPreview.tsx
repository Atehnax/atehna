import type { MutableRefObject, ReactNode } from 'react';
import Image from 'next/image';
import { DndContext, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { SortableContext, rectSortingStrategy } from '@dnd-kit/sortable';
import type { CatalogCategory, CatalogItem, CatalogSubcategory } from '@/commercial/catalog/catalog';
import {
  formatCatalogPrice,
  getCatalogCategoryItemPrice,
  getCatalogCategoryItemSku,
  getCatalogItemPrice,
  getCatalogItemSku,
  getDiscountedPrice
} from '@/commercial/catalog/catalog';
import { Button } from '@/shared/ui/button';
import { Input } from '@/shared/ui/input';
import type { CategoryStatus, ContentCard, EditingRowDraft, SelectedPreviewContext } from '../common/types';
import { InlineStatusToggle } from './AdminCategoriesMainTable';

export function AdminCategoriesPreview({
  activeView,
  tableError,
  lowerViewCount,
  onLowerViewCountChange,
  onRequestSave,
  tableDirty,
  saving,
  selectedContext,
  visibleContent,
  onBottomReorder,
  renderSortableItem,
  uploadRefs,
  onSetImageDeleteTarget,
  onImageUpload,
  onLeafProductsDragEnd,
  sortCatalogItems,
  editingRow,
  onStartEdit,
  onEditingRowTitleChange,
  onEditingRowDescriptionChange,
  onCommitEdit,
  onCancelEdit,
  onOpenNode,
  onStageStatusChange,
  onRequestCreateCategory
}: {
  activeView: 'table' | 'preview' | 'miller';
  tableError: string | null;
  lowerViewCount: number;
  onLowerViewCountChange: (value: number) => void;
  onRequestSave: () => void;
  tableDirty: boolean;
  saving: boolean;
  selectedContext: SelectedPreviewContext;
  visibleContent: ContentCard[];
  onBottomReorder: (event: DragEndEvent) => void;
  renderSortableItem: (id: string, children: (dragProps: Record<string, unknown>) => ReactNode) => ReactNode;
  uploadRefs: MutableRefObject<Record<string, HTMLInputElement | null>>;
  onSetImageDeleteTarget: (target: { kind: 'category' | 'subcategory'; categorySlug: string; subcategorySlug?: string }) => void;
  onImageUpload: (file: File | null, item: ContentCard, categorySlug?: string) => Promise<void>;
  onLeafProductsDragEnd: (event: DragEndEvent) => void;
  sortCatalogItems: (items: CatalogItem[]) => CatalogItem[];
  editingRow: EditingRowDraft | null;
  onStartEdit: (item: ContentCard) => void;
  onEditingRowTitleChange: (value: string) => void;
  onEditingRowDescriptionChange: (value: string) => void;
  onCommitEdit: () => void;
  onCancelEdit: () => void;
  onOpenNode: (item: ContentCard) => void;
  onStageStatusChange: (rowId: string, status: CategoryStatus) => void;
  onRequestCreateCategory: () => void;
}) {
  const previewSensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));
  const selectedSubcategoryChildren =
    selectedContext?.kind === 'subcategory'
      ? ((selectedContext.subcategory as CatalogSubcategory & { subcategories?: CatalogSubcategory[] }).subcategories ?? [])
      : [];

  return (
    <div className={activeView === 'preview' ? 'space-y-5' : 'hidden'}>
      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        {tableError ? <p className="mb-3 rounded-lg border border-[var(--danger-300)] bg-[var(--danger-100)] px-3 py-2 text-xs text-[var(--danger-700)]">{tableError}</p> : null}
        <div className="mb-3 flex items-center justify-between gap-3">
          <p className="text-sm font-semibold text-slate-700">Predogled</p>
          <div className="flex items-center gap-3">
            <label className="mr-2 flex items-center gap-2 text-[11px] text-slate-500">
              Elementov na vrstico
              <input
                type="range"
                min={3}
                max={8}
                value={lowerViewCount}
                onChange={(event) => onLowerViewCountChange(Number(event.target.value || 5))}
                className="h-1.5 w-28 accent-[#3e67d6]"
              />
              <span className="w-4 text-right text-slate-600">{lowerViewCount}</span>
            </label>
            <Button variant="primary" size="toolbar" onClick={onRequestSave} disabled={!tableDirty || saving}>
              Shrani spremembe
            </Button>
          </div>
        </div>

        {selectedContext && visibleContent.length > 0 ? (
          <DndContext sensors={previewSensors} collisionDetection={closestCenter} onDragEnd={onBottomReorder}>
            <SortableContext items={visibleContent.map((item) => item.id)} strategy={rectSortingStrategy}>
              <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${Math.min(8, Math.max(3, lowerViewCount))}, minmax(0, 1fr))` }}>
                {visibleContent.map((item) => (
                  <div key={item.id}>
                    {renderSortableItem(item.id, (dragProps) => (
                      <CategoryPreviewCard
                        dragProps={dragProps}
                        item={item}
                        uploadRefs={uploadRefs}
                        onSetImageDeleteTarget={onSetImageDeleteTarget}
                        onImageUpload={onImageUpload}
                        selectedContext={selectedContext}
                        editingRow={editingRow}
                        onStartEdit={onStartEdit}
                        onEditingRowTitleChange={onEditingRowTitleChange}
                        onEditingRowDescriptionChange={onEditingRowDescriptionChange}
                        onCommitEdit={onCommitEdit}
                        onCancelEdit={onCancelEdit}
                        onOpenNode={onOpenNode}
                        onStageStatusChange={onStageStatusChange}
                      />
                    ))}
                  </div>
                ))}
                {selectedContext.kind === 'root' ? <CreateCategoryCard onClick={onRequestCreateCategory} /> : null}
              </div>
            </SortableContext>
          </DndContext>
        ) : selectedContext?.kind === 'root' ? (
          <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${Math.min(8, Math.max(3, lowerViewCount))}, minmax(0, 1fr))` }}>
            <CreateCategoryCard onClick={onRequestCreateCategory} />
          </div>
        ) : null}

        {selectedContext?.kind === 'category' && selectedContext.category.subcategories.length === 0 ? (
          <LeafProductsView
            title={`${selectedContext.category.title} — izdelki`}
            category={selectedContext.category}
            items={sortCatalogItems(selectedContext.category.items ?? [])}
            onDragEnd={onLeafProductsDragEnd}
          />
        ) : null}

        {selectedContext?.kind === 'subcategory' && selectedSubcategoryChildren.length === 0 ? (
          <LeafProductsView
            title={`${selectedContext.category.title} / ${selectedContext.subcategory.title}`}
            category={selectedContext.category}
            subcategory={selectedContext.subcategory}
            items={sortCatalogItems(selectedContext.subcategory.items)}
            onDragEnd={onLeafProductsDragEnd}
          />
        ) : null}
      </section>
    </div>
  );
}

function CategoryPreviewCard({
  dragProps,
  item,
  uploadRefs,
  onSetImageDeleteTarget,
  onImageUpload,
  selectedContext,
  editingRow,
  onStartEdit,
  onEditingRowTitleChange,
  onEditingRowDescriptionChange,
  onCommitEdit,
  onCancelEdit,
  onOpenNode,
  onStageStatusChange
}: {
  dragProps: Record<string, unknown>;
  item: ContentCard;
  uploadRefs: MutableRefObject<Record<string, HTMLInputElement | null>>;
  onSetImageDeleteTarget: (target: { kind: 'category' | 'subcategory'; categorySlug: string; subcategorySlug?: string }) => void;
  onImageUpload: (file: File | null, item: ContentCard, categorySlug?: string) => Promise<void>;
  selectedContext: SelectedPreviewContext;
  editingRow: EditingRowDraft | null;
  onStartEdit: (item: ContentCard) => void;
  onEditingRowTitleChange: (value: string) => void;
  onEditingRowDescriptionChange: (value: string) => void;
  onCommitEdit: () => void;
  onCancelEdit: () => void;
  onOpenNode: (item: ContentCard) => void;
  onStageStatusChange: (rowId: string, status: CategoryStatus) => void;
}) {
  const isEditing = editingRow?.id === item.id;
  const isHidden = item.isInactive;

  return (
    <article
      {...dragProps}
      className={`group flex h-[350px] cursor-grab flex-col overflow-hidden rounded-[22px] border bg-white active:cursor-grabbing ${
        isHidden ? 'border-slate-300 text-slate-500' : 'border-slate-200 text-slate-900'
      }`}
    >
      <button
        type="button"
        className={`relative h-44 w-full overflow-hidden text-left ${item.image ? 'bg-slate-100' : 'bg-slate-900'}`}
        onClick={() => uploadRefs.current[item.id]?.click()}
        onPointerDown={(event) => event.stopPropagation()}
      >
        {item.image ? <Image src={item.image} alt={item.title} fill className="object-cover" /> : null}
        {isHidden ? (
          <div className="absolute inset-0 bg-slate-900/28" aria-hidden="true" />
        ) : null}
        {isHidden ? (
          <div className="absolute left-3 top-3 z-10 inline-flex items-center gap-1.5 rounded-md bg-white/90 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-700 shadow-sm">
            <EyeOffIcon className="h-3.5 w-3.5" />
            SKRITO
          </div>
        ) : null}
        <div className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-2 p-3">
          <button
            type="button"
            className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-black/50 bg-black/45 text-white/90 backdrop-blur-sm hover:bg-black/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
            onPointerDown={(event) => event.stopPropagation()}
            onClick={(event) => {
              event.stopPropagation();
              uploadRefs.current[item.id]?.click();
            }}
            aria-label="Dodaj ali zamenjaj sliko"
            title="Dodaj ali zamenjaj sliko"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <rect x="3" y="4" width="18" height="16" rx="2.8" />
              <path d="m6.5 15.5 3.7-3.8a1 1 0 0 1 1.42 0L15 15l2-2a1 1 0 0 1 1.42 0l2.08 2.08" />
              <circle cx="15.5" cy="9.3" r="1.5" />
            </svg>
          </button>
          {item.image ? (
            <button
              type="button"
              className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-black/50 bg-black/45 text-white/90 backdrop-blur-sm hover:bg-black/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
              onPointerDown={(event) => event.stopPropagation()}
              onClick={(event) => {
                event.stopPropagation();
                onSetImageDeleteTarget({
                  kind: item.kind,
                  categorySlug: item.categorySlug,
                  subcategorySlug: item.kind === 'subcategory' ? item.subcategoryPath.at(-1) : undefined
                });
              }}
              aria-label="Odstrani sliko"
              title="Odstrani sliko"
            >
              ✕
            </button>
          ) : null}
        </div>
      </button>

      <div className="flex flex-1 flex-col p-4">
        <div className="flex items-start justify-between gap-3">
          {isEditing ? (
            <Input
              value={editingRow.title}
              onChange={(event) => onEditingRowTitleChange(event.target.value)}
              onBlur={onCommitEdit}
              data-inline-edit-field="true"
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !(event.shiftKey)) {
                  event.preventDefault();
                  onCommitEdit();
                }
                if (event.key === 'Escape') onCancelEdit();
              }}
              className="h-9 flex-1 rounded-lg border-slate-300 px-3 text-sm font-semibold"
              autoFocus
              aria-label="Naziv kategorije"
            />
          ) : (
            <h3 className={`min-w-0 flex-1 truncate text-base font-semibold ${isHidden ? 'text-slate-500' : 'text-slate-900'}`}>{item.title}</h3>
          )}
          <button
            type="button"
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-slate-200 text-slate-500 transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3e67d6]/40"
            onPointerDown={(event) => event.stopPropagation()}
            onClick={() => onStartEdit(item)}
            aria-label={`Uredi ${item.kind === 'category' ? 'kategorijo' : 'podkategorijo'} ${item.title}`}
            title="Uredi"
          >
            <PencilIcon className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-3 flex-1">
          {isEditing ? (
            <textarea
              value={editingRow.description}
              onChange={(event) => onEditingRowDescriptionChange(event.target.value)}
              onBlur={onCommitEdit}
              data-inline-edit-field="true"
              onKeyDown={(event) => {
                if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
                  event.preventDefault();
                  onCommitEdit();
                }
                if (event.key === 'Escape') onCancelEdit();
              }}
              className="min-h-[88px] w-full resize-none rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 outline-none transition focus:border-[#3e67d6] focus:ring-2 focus:ring-[#3e67d6]/20"
              aria-label="Opis kategorije"
            />
          ) : (
            <p className={`line-clamp-3 text-sm leading-6 ${isHidden ? 'text-slate-500' : 'text-slate-600'}`}>{item.description || '—'}</p>
          )}
        </div>

        <div className="mt-4 flex items-end justify-between gap-3 border-t border-slate-200 pt-4" onPointerDown={(event) => event.stopPropagation()}>
          <div className="flex min-w-0 flex-col gap-2">
            <span className="text-[11px] font-medium uppercase tracking-[0.08em] text-slate-500">Vidnost</span>
            <div className="flex items-center gap-3">
              <InlineStatusToggle
                checked={!isHidden}
                onToggle={() => onStageStatusChange(item.id, isHidden ? 'active' : 'inactive')}
                ariaLabel={`Spremeni vidnost za ${item.title}`}
              />
              <span className={`text-xs font-semibold uppercase tracking-[0.06em] ${isHidden ? 'text-slate-500' : 'text-slate-700'}`}>
                {isHidden ? 'Nevidno' : 'Vidno'}
              </span>
            </div>
          </div>
          {item.hasChildren ? (
            <Button
              type="button"
              variant="outline"
              size="toolbar"
              onPointerDown={(event) => event.stopPropagation()}
              onClick={() => onOpenNode(item)}
            >
              {item.openLabel}
            </Button>
          ) : null}
        </div>

        <input
          ref={(element) => {
            uploadRefs.current[item.id] = element;
          }}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(event) =>
            void onImageUpload(
              event.target.files?.[0] ?? null,
              item,
              selectedContext?.kind === 'category' ? selectedContext.category.slug : undefined
            )
          }
        />
      </div>
    </article>
  );
}

function CreateCategoryCard({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex h-[350px] flex-col items-center justify-center rounded-[22px] border border-dashed border-slate-300 bg-slate-50/60 px-6 text-center transition hover:border-slate-400 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3e67d6]/40"
      aria-label="Ustvari novo kategorijo"
    >
      <span className="inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-200 text-slate-600">
        <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M12 5v14M5 12h14" />
        </svg>
      </span>
      <span className="mt-6 text-xl font-semibold text-slate-900">Ustvari novo kategorijo</span>
      <span className="mt-2 max-w-[18ch] text-sm leading-6 text-slate-500">Kliknite za začetek ustvarjanja nove kategorije.</span>
    </button>
  );
}

function PencilIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 20h9" />
      <path d="m16.5 3.5 4 4L7 21l-4 1 1-4Z" />
    </svg>
  );
}

function EyeOffIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M1.5 12s3.75-6.75 10.5-6.75S22.5 12 22.5 12s-3.75 6.75-10.5 6.75S1.5 12 1.5 12Z" />
      <circle cx="12" cy="12" r="3" />
      <path d="M3 3 21 21" />
    </svg>
  );
}

function LeafProductsView({
  title,
  category,
  subcategory,
  items,
  onDragEnd
}: {
  title: string;
  category: CatalogCategory;
  subcategory?: CatalogSubcategory;
  items: CatalogItem[];
  onDragEnd: (event: DragEndEvent) => void;
}) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  return (
    <div>
      <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
      <p className="mt-1 text-sm text-slate-600">Storefront-like pogled izdelkov iz izbrane kategorije.</p>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={items.map((item) => item.slug)} strategy={rectSortingStrategy}>
          <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {items.map((item) => {
              const sku = subcategory ? getCatalogItemSku(category.slug, subcategory.slug, item.slug) : getCatalogCategoryItemSku(category.slug, item.slug);
              const listPrice = subcategory ? getCatalogItemPrice(category.slug, subcategory.slug, item.slug) : getCatalogCategoryItemPrice(category.slug, item.slug);
              const salePrice = getDiscountedPrice(listPrice, item.discountPct);
              const hasDiscount = typeof salePrice === 'number' && salePrice < listPrice;

              return (
                <div key={item.slug} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="aspect-[4/3] rounded-xl bg-slate-50">
                    {item.image ? <Image src={item.image} alt={item.name} width={640} height={480} className="h-full w-full rounded-xl object-cover" /> : null}
                  </div>
                  <div className="mt-4 space-y-1">
                    <p className="text-sm font-semibold text-slate-900">{item.name}</p>
                    <p className="text-xs text-slate-500">SKU: {sku}</p>
                    <div className="flex items-center gap-2 text-sm">
                      <span className="font-semibold text-slate-900">{formatCatalogPrice(hasDiscount ? salePrice : listPrice)}</span>
                      {hasDiscount ? <span className="text-xs text-slate-400 line-through">{formatCatalogPrice(listPrice)}</span> : null}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </SortableContext>
      </DndContext>
    </div>
  );
}
