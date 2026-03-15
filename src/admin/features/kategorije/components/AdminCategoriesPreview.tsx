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

type ContentCard = {
  id: string;
  title: string;
  description: string;
  image?: string;
  kind: 'category' | 'subcategory';
};

type SelectedContext =
  | { kind: 'root' }
  | { kind: 'category'; category: CatalogCategory }
  | { kind: 'subcategory'; category: CatalogCategory; subcategory: CatalogSubcategory }
  | null;

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
  selectedContext: SelectedContext;
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
                min={1}
                max={12}
                value={lowerViewCount}
                onChange={(event) => onLowerViewCountChange(Number(event.target.value || 4))}
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
              <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${Math.max(1, lowerViewCount)}, minmax(0, 1fr))` }}>
                {visibleContent.map((item) => (
                  <div key={item.id}>
                    {renderSortableItem(item.id, (dragProps) => (
                      <article {...dragProps} className="h-[300px] rounded-xl border border-slate-200 bg-white p-3 shadow-sm cursor-grab active:cursor-grabbing">
                        <button
                          type="button"
                          className="relative h-36 w-full overflow-hidden rounded-lg border border-slate-200 bg-slate-50 text-left"
                          onClick={() => uploadRefs.current[item.id]?.click()}
                          onPointerDown={(event) => event.stopPropagation()}
                        >
                          {item.image ? (
                            <Image src={item.image} alt={item.title} fill className="object-cover" />
                          ) : (
                            <div className="flex h-full items-center justify-center text-xs text-slate-400">Brez slike</div>
                          )}
                          <div className="absolute inset-0 flex items-center justify-center gap-2">
                            <button
                              type="button"
                              className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-white/80 text-slate-500 backdrop-blur-sm hover:bg-white"
                              onPointerDown={(event) => event.stopPropagation()}
                              onClick={(event) => {
                                event.stopPropagation();
                                uploadRefs.current[item.id]?.click();
                              }}
                              aria-label="Dodaj sliko"
                            >
                              <svg viewBox="0 0 20 20" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                                <rect x="3.5" y="5" width="13" height="10" rx="2" />
                                <path d="M10 8v4M8 10h4" />
                              </svg>
                            </button>
                            {item.image ? (
                              <button
                                type="button"
                                className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-white/80 text-slate-500 backdrop-blur-sm hover:bg-white"
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
                        </button>

                        <div className="mt-3 space-y-1">
                          <p className="text-sm font-semibold text-slate-700">{item.title}</p>
                          <p className="text-xs text-slate-600">{item.description || '—'}</p>
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
