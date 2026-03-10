'use client';

import { useMemo, useState, useEffect } from 'react';
import Image from 'next/image';
import { DndContext, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { SortableContext, arrayMove, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { CatalogCategory, CatalogSubcategory, CatalogItem } from '@/lib/catalog';
import { formatCatalogPrice, getCatalogCategoryItemPrice, getCatalogCategoryItemSku, getCatalogItemPrice, getCatalogItemSku, getDiscountedPrice } from '@/lib/catalog';
import { Button } from '@/shared/ui/button';
import { FloatingInput, FloatingTextarea } from '@/shared/ui/floating-field';
import { useToast } from '@/shared/ui/toast';

type SelectedNode = { kind: 'category' | 'subcategory'; categorySlug: string; subcategorySlug?: string };

type CatalogData = { categories: CatalogCategory[] };

function SortableProductCard({ id, item, category, subcategory }: { id: string; item: CatalogItem; category: CatalogCategory; subcategory?: CatalogSubcategory }) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id });
  const style = { transform: CSS.Transform.toString(transform), transition };
  const basePrice = subcategory
    ? (item.price ?? getCatalogItemPrice(category.slug, subcategory.slug, item.slug))
    : (item.price ?? getCatalogCategoryItemPrice(category.slug, item.slug));
  const finalPrice = getDiscountedPrice(basePrice, item.discountPct);

  return (
    <div ref={setNodeRef} style={style} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-semibold text-slate-900">{item.name}</p>
        <button type="button" {...attributes} {...listeners} className="rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-600">↕ Premakni</button>
      </div>
      <p className="mt-1 text-xs text-slate-600">{item.description}</p>
      <p className="mt-2 text-xs font-semibold text-slate-900">{formatCatalogPrice(finalPrice)}</p>
      <p className="mt-2 text-[11px] text-slate-500">SKU: {subcategory ? getCatalogItemSku(category.slug, subcategory.slug, item.slug) : getCatalogCategoryItemSku(category.slug, item.slug)}</p>
    </div>
  );
}

const slugify = (value: string) => value.toLowerCase().trim().replace(/\s+/g, '-').replace(/[^a-z0-9-čšžćđ]/gi, '');

export default function AdminCategoriesManager() {
  const [catalog, setCatalog] = useState<CatalogData>({ categories: [] });
  const [selected, setSelected] = useState<SelectedNode | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const load = async () => {
    setLoading(true);
    const response = await fetch('/api/admin/categories', { cache: 'no-store' });
    if (!response.ok) {
      toast.error('Napaka pri nalaganju kategorij');
      setLoading(false);
      return;
    }
    const payload = (await response.json()) as CatalogData;
    setCatalog(payload);
    if (!selected && payload.categories[0]) {
      setSelected({ kind: 'category', categorySlug: payload.categories[0].slug });
    }
    setLoading(false);
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const persist = async (next: CatalogData) => {
    setCatalog(next);
    setSaving(true);
    const response = await fetch('/api/admin/categories', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(next)
    });
    setSaving(false);
    if (!response.ok) {
      toast.error('Shranjevanje ni uspelo');
      return;
    }
    toast.success('Shranjeno');
  };

  const selectedContext = useMemo(() => {
    if (!selected) return null;
    const category = catalog.categories.find((entry) => entry.slug === selected.categorySlug);
    if (!category) return null;
    if (selected.kind === 'category') return { category, subcategory: null as CatalogSubcategory | null };
    const subcategory = category.subcategories.find((entry) => entry.slug === selected.subcategorySlug);
    if (!subcategory) return null;
    return { category, subcategory };
  }, [catalog.categories, selected]);

  const updateSelectedMeta = (patch: Partial<CatalogCategory & CatalogSubcategory>) => {
    if (!selectedContext || !selected) return;
    const next: CatalogData = {
      categories: catalog.categories.map((category) => {
        if (category.slug !== selectedContext.category.slug) return category;
        if (selected.kind === 'category') {
          return { ...category, ...patch };
        }
        return {
          ...category,
          subcategories: category.subcategories.map((subcategory) =>
            subcategory.slug === selectedContext.subcategory?.slug ? { ...subcategory, ...patch } : subcategory
          )
        };
      })
    };
    void persist(next);
  };

  const onDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id || !selectedContext) return;
    const items = selectedContext.subcategory ? selectedContext.subcategory.items : (selectedContext.category.items ?? []);
    const oldIndex = items.findIndex((entry) => entry.slug === active.id);
    const newIndex = items.findIndex((entry) => entry.slug === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    const reordered = arrayMove(items, oldIndex, newIndex).map((item, index) => ({ ...item, displayOrder: index + 1 }));

    const next: CatalogData = {
      categories: catalog.categories.map((category) => {
        if (category.slug !== selectedContext.category.slug) return category;
        if (selectedContext.subcategory) {
          return {
            ...category,
            subcategories: category.subcategories.map((subcategory) =>
              subcategory.slug === selectedContext.subcategory?.slug ? { ...subcategory, items: reordered } : subcategory
            )
          };
        }
        return { ...category, items: reordered };
      })
    };
    void persist(next);
  };

  if (loading) return <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-600">Nalagam kategorije …</div>;

  return (
    <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Kategorije</h1>
        <p className="mt-1 text-sm text-slate-500">Upravljanje drevesa kategorij in vrstnega reda izdelkov.</p>
      </div>

      <section className="grid gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm lg:grid-cols-[1.2fr_2fr]">
        <div className="rounded-xl border border-slate-200 p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Drevo kategorij</p>
          <div className="mt-3 space-y-2">
            {catalog.categories.map((category) => (
              <div key={category.slug} className="rounded-lg border border-slate-200 p-2">
                <button type="button" onClick={() => setSelected({ kind: 'category', categorySlug: category.slug })} className={`w-full rounded-md px-2 py-1 text-left text-sm ${selected?.kind === 'category' && selected.categorySlug === category.slug ? 'bg-brand-50 font-semibold text-brand-700' : 'text-slate-700 hover:bg-slate-50'}`}>
                  {category.title}
                </button>
                <div className="mt-1 pl-3">
                  {category.subcategories.map((subcategory) => (
                    <button key={subcategory.slug} type="button" onClick={() => setSelected({ kind: 'subcategory', categorySlug: category.slug, subcategorySlug: subcategory.slug })} className={`mt-1 block w-full rounded-md px-2 py-1 text-left text-sm ${selected?.kind === 'subcategory' && selected.subcategorySlug === subcategory.slug ? 'bg-brand-50 font-semibold text-brand-700' : 'text-slate-600 hover:bg-slate-50'}`}>
                      └ {subcategory.title}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button variant="outline" type="button" onClick={() => {
              const name = window.prompt('Ime kategorije');
              if (!name) return;
              const slug = slugify(name);
              void persist({ categories: [...catalog.categories, { slug, title: name, summary: name, description: '', image: '/images/categories/metal-plates.svg', subcategories: [], items: [] }] });
            }}>+ Kategorija</Button>
            {selectedContext ? <Button variant="outline" type="button" onClick={() => {
              const name = window.prompt('Ime podkategorije');
              if (!name) return;
              const slug = slugify(name);
              const next = {
                categories: catalog.categories.map((category) => category.slug === selectedContext.category.slug
                  ? { ...category, subcategories: [...category.subcategories, { slug, title: name, description: '', items: [] }] }
                  : category)
              };
              void persist(next);
            }}>+ Podkategorija</Button> : null}
          </div>
        </div>

        <div className="space-y-3 rounded-xl border border-slate-200 p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Podrobnosti izbrane kategorije</p>
          {selectedContext ? (
            <>
              <FloatingInput id="cat-title" tone="admin" label="Naziv" value={selectedContext.subcategory ? selectedContext.subcategory.title : selectedContext.category.title} onChange={(event) => updateSelectedMeta({ title: event.target.value })} />
              <FloatingTextarea id="cat-description" tone="admin" label="Opis" value={selectedContext.subcategory ? selectedContext.subcategory.description : selectedContext.category.description} onChange={(event) => updateSelectedMeta({ description: event.target.value })} className="min-h-[90px]" />
              <FloatingTextarea id="cat-notes" tone="admin" label="Admin opombe" value={(selectedContext.subcategory ? selectedContext.subcategory.adminNotes : selectedContext.category.adminNotes) ?? ''} onChange={(event) => updateSelectedMeta({ adminNotes: event.target.value })} className="min-h-[90px]" />
              <FloatingInput id="cat-image" tone="admin" label="Slika / banner URL" value={(selectedContext.subcategory ? selectedContext.subcategory.image : (selectedContext.category.bannerImage ?? selectedContext.category.image)) ?? ''} onChange={(event) => updateSelectedMeta(selectedContext.subcategory ? { image: event.target.value } : { bannerImage: event.target.value })} />
            </>
          ) : <p className="text-sm text-slate-500">Izberite kategorijo.</p>}
          <p className="text-xs text-slate-400">{saving ? 'Shranjujem …' : 'Spremembe se sproti shranjujejo v catalog.json.'}</p>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Predogled strani (admin način)</p>
        {selectedContext ? (
          <div className="mt-3 grid gap-6 lg:grid-cols-[2fr_1fr]">
            <div>
              <h2 className="text-2xl font-semibold text-slate-900">{selectedContext.subcategory ? selectedContext.subcategory.title : selectedContext.category.title}</h2>
              <p className="mt-2 text-sm text-slate-600">{selectedContext.subcategory ? selectedContext.subcategory.description : selectedContext.category.summary}</p>
              <div className="mt-4 rounded-2xl border border-dashed border-brand-200 bg-brand-50/40 p-3 text-xs text-brand-700">Admin način: izdelke lahko preuredite z drag-and-drop.</div>
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
                <SortableContext items={(selectedContext.subcategory ? selectedContext.subcategory.items : (selectedContext.category.items ?? [])).map((item) => item.slug)} strategy={verticalListSortingStrategy}>
                  <div className="mt-4 space-y-3">
                    {(selectedContext.subcategory ? selectedContext.subcategory.items : (selectedContext.category.items ?? [])).map((item) => (
                      <SortableProductCard key={item.slug} id={item.slug} item={item} category={selectedContext.category} subcategory={selectedContext.subcategory ?? undefined} />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
            </div>
            <aside className="space-y-3">
              <div className="relative h-44 overflow-hidden rounded-2xl border border-slate-200 bg-slate-50">
                <Image src={(selectedContext.subcategory?.image ?? selectedContext.category.bannerImage ?? selectedContext.category.image) || '/images/categories/metal-plates.svg'} alt="category" fill className="object-cover" />
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-600">
                <p className="font-semibold text-slate-900">Admin opombe</p>
                <p className="mt-2">{(selectedContext.subcategory?.adminNotes ?? selectedContext.category.adminNotes ?? 'Brez opomb.')}</p>
              </div>
            </aside>
          </div>
        ) : <p className="mt-2 text-sm text-slate-500">Izberite kategorijo za predogled.</p>}
      </section>
    </div>
  );
}
