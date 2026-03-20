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
import type { ContentCard, SelectedPreviewContext } from '../common/types';

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
  sortCatalogItems
}: {
  activeView: 'table' | 'miller';
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
}) {
  const previewSensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  return (
    <div className={activeView === 'table' ? 'space-y-5' : 'hidden'}>
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

        {selectedContext?.kind === 'root' || (selectedContext?.kind === 'category' && visibleContent.length > 0) ? (
          <DndContext sensors={previewSensors} collisionDetection={closestCenter} onDragEnd={onBottomReorder}>
            <SortableContext items={visibleContent.map((item) => item.id)} strategy={rectSortingStrategy}>
              <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${Math.min(8, Math.max(3, lowerViewCount))}, minmax(0, 1fr))` }}>
                {visibleContent.map((item) => (
                  <div key={item.id}>
                    {renderSortableItem(item.id, (dragProps) => (
                      <article {...dragProps} className={`h-[300px] rounded-xl border p-3 shadow-sm cursor-grab active:cursor-grabbing ${item.isInactive ? 'border-slate-300 bg-slate-50 text-slate-400' : 'border-slate-200 bg-white'}`}>
                        <button
                          type="button"
                          className={`relative h-36 w-full overflow-hidden rounded-lg border border-slate-200 text-left ${item.image ? 'bg-slate-50' : 'bg-black'}`}
                          onClick={() => uploadRefs.current[item.id]?.click()}
                          onPointerDown={(event) => event.stopPropagation()}
                        >
                          {item.image ? <Image src={item.image} alt={item.title} fill className="object-cover" /> : null}
                          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
                            <div className="flex items-center justify-center gap-2">
                            <button
                              type="button"
                              className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-black/50 bg-black/45 text-white/90 backdrop-blur-sm hover:bg-black/60"
                              onPointerDown={(event) => event.stopPropagation()}
                              onClick={(event) => {
                                event.stopPropagation();
                                uploadRefs.current[item.id]?.click();
                              }}
                              aria-label="Dodaj sliko"
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
                                className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-black/50 bg-black/45 text-white/90 backdrop-blur-sm hover:bg-black/60"
                                onPointerDown={(event) => event.stopPropagation()}
                                onClick={(event) => {
                                  event.stopPropagation();
                                  onSetImageDeleteTarget({
                                    kind: item.kind,
                                    categorySlug: item.kind === 'category' ? item.id : selectedContext?.kind === 'category' ? selectedContext.category.slug : '',
                                    subcategorySlug: item.kind === 'subcategory' ? item.id : undefined
                                  });
                                }}
                                aria-label="Odstrani sliko"
                              >
                                ✕
                              </button>
                            ) : null}
                            </div>
                            {!item.image ? <p className="text-xs text-slate-300">Brez slike</p> : null}
                          </div>
                        </button>

                        <div className="mt-3 space-y-1">
                          <p className={`text-sm font-semibold ${item.isInactive ? 'text-slate-400' : 'text-slate-700'}`}>{item.title}</p>
                          <p className={`text-xs ${item.isInactive ? 'text-slate-400' : 'text-slate-600'}`}>{item.description || '—'}</p>
                        </div>

                        <div className="mt-2 flex items-center gap-2" onPointerDown={(event) => event.stopPropagation()}>
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
                    ))}
                  </div>
                ))}
              </div>
            </SortableContext>
          </DndContext>
        ) : null}

        {selectedContext?.kind === 'category' && selectedContext.category.subcategories.length === 0 ? (
          <LeafProductsView
            title={`${selectedContext.category.title} — izdelki`}
            category={selectedContext.category}
            items={sortCatalogItems(selectedContext.category.items ?? [])}
            onDragEnd={onLeafProductsDragEnd}
          />
        ) : null}

        {selectedContext?.kind === 'subcategory' ? (
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
          <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {items.map((item) => {
              const basePrice = subcategory
                ? item.price ?? getCatalogItemPrice(category.slug, subcategory.slug, item.slug)
                : item.price ?? getCatalogCategoryItemPrice(category.slug, item.slug);

              const finalPrice = getDiscountedPrice(basePrice, item.discountPct);

              return (
                <article key={item.slug} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm cursor-grab active:cursor-grabbing">
                  {item.image ? (
                    <div className="relative h-24 overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
                      <Image src={item.images?.[0] ?? item.image} alt={item.name} fill className="object-contain p-2" />
                    </div>
                  ) : null}

                  <h4 className="mt-2 text-sm font-semibold text-slate-900">{item.name}</h4>
                  <p className="mt-1 text-xs text-slate-600">{item.description}</p>
                  <p className="mt-2 text-sm font-semibold text-slate-900">{formatCatalogPrice(finalPrice)}</p>
                  <p className="mt-1 text-[11px] text-slate-500">
                    SKU:{' '}
                    {subcategory
                      ? getCatalogItemSku(category.slug, subcategory.slug, item.slug)
                      : getCatalogCategoryItemSku(category.slug, item.slug)}
                  </p>
                </article>
              );
            })}
          </div>
        </SortableContext>
      </DndContext>
    </div>
  );
}
