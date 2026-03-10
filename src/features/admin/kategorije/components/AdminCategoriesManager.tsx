'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import Image from 'next/image';
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent
} from '@dnd-kit/core';
import { SortableContext, arrayMove, rectSortingStrategy, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { CatalogCategory, CatalogItem, CatalogSubcategory } from '@/lib/catalog';
import {
  formatCatalogPrice,
  getCatalogCategoryItemPrice,
  getCatalogCategoryItemSku,
  getCatalogItemPrice,
  getCatalogItemSku,
  getDiscountedPrice,
  sortCatalogItems
} from '@/lib/catalog';
import { Button } from '@/shared/ui/button';
import { FloatingInput, FloatingTextarea } from '@/shared/ui/floating-field';
import { ConfirmDialog } from '@/shared/ui/confirm-dialog';
import { useToast } from '@/shared/ui/toast';

type CatalogData = { categories: CatalogCategory[] };
type SelectedNode = { kind: 'root' } | { kind: 'category'; categorySlug: string } | { kind: 'subcategory'; categorySlug: string; subcategorySlug: string };
type DeleteTarget = { kind: 'category' | 'subcategory'; categorySlug: string; subcategorySlug?: string } | null;
type ImageDeleteTarget = { kind: 'category' | 'subcategory'; categorySlug: string; subcategorySlug?: string; itemId: string } | null;

type ContentCard = { id: string; title: string; description: string; image: string; adminNotes: string };

const slugify = (value: string) => value.toLowerCase().trim().replace(/\s+/g, '-').replace(/[^a-z0-9-čšžćđ]/gi, '');
const catId = (slug: string) => `cat:${slug}`;
const subId = (catSlug: string, subSlug: string) => `sub:${catSlug}:${subSlug}`;
const catDropId = (slug: string) => `drop:${slug}`;

async function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Napaka pri branju datoteke'));
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.readAsDataURL(file);
  });
}

function parseTreeId(id: string): { kind: 'category' | 'subcategory'; categorySlug: string; subcategorySlug?: string } | null {
  if (id.startsWith('cat:')) return { kind: 'category', categorySlug: id.slice(4) };
  if (!id.startsWith('sub:')) return null;
  const [, categorySlug, subcategorySlug] = id.split(':');
  if (!categorySlug || !subcategorySlug) return null;
  return { kind: 'subcategory', categorySlug, subcategorySlug };
}

function SortableSurface({ id, children }: { id: string; children: (props: { dragProps: Record<string, unknown> }) => ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id });
  const style = { transform: CSS.Transform.toString(transform), transition };
  return <div ref={setNodeRef} style={style}>{children({ dragProps: { ...attributes, ...listeners } })}</div>;
}

function DropSurface({ id, children }: { id: string; children: ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return <div ref={setNodeRef} className={isOver ? 'ring-2 ring-brand-300 ring-offset-1' : ''}>{children}</div>;
}

export default function AdminCategoriesManager() {
  const [catalog, setCatalog] = useState<CatalogData>({ categories: [] });
  const [selected, setSelected] = useState<SelectedNode>({ kind: 'root' });
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [editingNode, setEditingNode] = useState<string | null>(null);
  const [draftNodeTitle, setDraftNodeTitle] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget>(null);
  const [imageDeleteTarget, setImageDeleteTarget] = useState<ImageDeleteTarget>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

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
    setExpanded(Object.fromEntries(payload.categories.map((entry) => [entry.slug, true])));
    setLoading(false);
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const persist = async (next: CatalogData, message = 'Shranjeno') => {
    setCatalog(next);
    setSaving(true);
    const response = await fetch('/api/admin/categories', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(next)
    });
    setSaving(false);
    if (!response.ok) {
      toast.error('Shranjevanje ni uspelo');
      return;
    }
    toast.success(message);
  };

  const selectedContext = useMemo(() => {
    if (selected.kind === 'root') return { kind: 'root' as const };
    const category = catalog.categories.find((entry) => entry.slug === selected.categorySlug);
    if (!category) return null;
    if (selected.kind === 'category') return { kind: 'category' as const, category };
    const subcategory = category.subcategories.find((entry) => entry.slug === selected.subcategorySlug);
    if (!subcategory) return null;
    return { kind: 'subcategory' as const, category, subcategory };
  }, [catalog.categories, selected]);

  const renameNode = (id: string, title: string) => {
    const parsed = parseTreeId(id);
    const nextTitle = title.trim();
    const nextSlug = slugify(nextTitle);
    if (!parsed || !nextTitle || !nextSlug) return;

    if (parsed.kind === 'category') {
      const next = { categories: catalog.categories.map((entry) => entry.slug === parsed.categorySlug ? { ...entry, title: nextTitle, slug: nextSlug } : entry) };
      setSelected({ kind: 'category', categorySlug: nextSlug });
      void persist(next);
      return;
    }

    const next = {
      categories: catalog.categories.map((entry) =>
        entry.slug === parsed.categorySlug
          ? { ...entry, subcategories: entry.subcategories.map((sub) => sub.slug === parsed.subcategorySlug ? { ...sub, title: nextTitle, slug: nextSlug } : sub) }
          : entry
      )
    };
    setSelected({ kind: 'subcategory', categorySlug: parsed.categorySlug, subcategorySlug: nextSlug });
    void persist(next);
  };

  const addCategory = (afterSlug?: string) => {
    const name = window.prompt('Ime nove kategorije');
    if (!name) return;
    const slug = slugify(name);
    if (!slug) return;
    const item: CatalogCategory = { slug, title: name, summary: name, description: '', image: '', subcategories: [], items: [] };
    if (!afterSlug) {
      void persist({ categories: [...catalog.categories, item] }, 'Kategorija dodana');
      return;
    }
    const ix = catalog.categories.findIndex((entry) => entry.slug === afterSlug);
    const list = [...catalog.categories];
    if (ix < 0) list.push(item); else list.splice(ix + 1, 0, item);
    void persist({ categories: list }, 'Kategorija dodana');
  };

  const addSubcategory = (categorySlug: string, afterSlug?: string) => {
    const name = window.prompt('Ime nove podkategorije');
    if (!name) return;
    const slug = slugify(name);
    if (!slug) return;
    const next = {
      categories: catalog.categories.map((entry) => {
        if (entry.slug !== categorySlug) return entry;
        const nextSub: CatalogSubcategory = { slug, title: name, description: '', image: '', items: [] };
        const list = [...entry.subcategories];
        if (!afterSlug) list.push(nextSub);
        else {
          const ix = list.findIndex((sub) => sub.slug === afterSlug);
          if (ix < 0) list.push(nextSub); else list.splice(ix + 1, 0, nextSub);
        }
        return { ...entry, subcategories: list };
      })
    };
    void persist(next, 'Podkategorija dodana');
  };

  const confirmDeleteNode = () => {
    if (!deleteTarget) return;
    if (deleteTarget.kind === 'category') {
      const next = { categories: catalog.categories.filter((entry) => entry.slug !== deleteTarget.categorySlug) };
      setSelected({ kind: 'root' });
      setDeleteTarget(null);
      void persist(next, 'Kategorija odstranjena');
      return;
    }

    const next = {
      categories: catalog.categories.map((entry) =>
        entry.slug === deleteTarget.categorySlug
          ? { ...entry, subcategories: entry.subcategories.filter((sub) => sub.slug !== deleteTarget.subcategorySlug) }
          : entry
      )
    };
    setSelected({ kind: 'category', categorySlug: deleteTarget.categorySlug });
    setDeleteTarget(null);
    void persist(next, 'Podkategorija odstranjena');
  };

  const updateSub = (categorySlug: string, subSlug: string, patch: Partial<CatalogSubcategory>) => {
    const next = {
      categories: catalog.categories.map((entry) =>
        entry.slug === categorySlug
          ? { ...entry, subcategories: entry.subcategories.map((sub) => sub.slug === subSlug ? { ...sub, ...patch } : sub) }
          : entry
      )
    };
    void persist(next);
  };

  const onTreeDragEnd = (event: DragEndEvent) => {
    const active = String(event.active.id);
    const over = event.over ? String(event.over.id) : null;
    if (!over || active === over) return;

    const activeNode = parseTreeId(active);
    const overNode = parseTreeId(over);
    const overDrop = over.startsWith('drop:') ? over.slice(5) : null;
    if (!activeNode) return;

    if (activeNode.kind === 'category') {
      if (!overNode || overNode.kind !== 'category') return;
      const oldIndex = catalog.categories.findIndex((entry) => entry.slug === activeNode.categorySlug);
      const newIndex = catalog.categories.findIndex((entry) => entry.slug === overNode.categorySlug);
      if (oldIndex < 0 || newIndex < 0) return;
      void persist({ categories: arrayMove(catalog.categories, oldIndex, newIndex) }, 'Premik kategorije shranjen');
      return;
    }

    const fromCat = activeNode.categorySlug;
    const fromSub = activeNode.subcategorySlug ?? '';
    let toCat = fromCat;
    let toIndex: number | null = null;

    if (overDrop) {
      toCat = overDrop;
    } else if (overNode?.kind === 'subcategory') {
      toCat = overNode.categorySlug;
      const targetCat = catalog.categories.find((entry) => entry.slug === toCat);
      toIndex = targetCat?.subcategories.findIndex((entry) => entry.slug === overNode.subcategorySlug) ?? null;
    } else if (overNode?.kind === 'category') {
      toCat = overNode.categorySlug;
    } else {
      return;
    }

    const sourceCat = catalog.categories.find((entry) => entry.slug === fromCat);
    const moving = sourceCat?.subcategories.find((entry) => entry.slug === fromSub);
    if (!sourceCat || !moving) return;

    const next = {
      categories: catalog.categories.map((entry) => {
        if (entry.slug === fromCat && entry.slug === toCat) {
          const list = [...entry.subcategories];
          const oldIndex = list.findIndex((item) => item.slug === fromSub);
          const newIndex = toIndex ?? list.length - 1;
          if (oldIndex < 0) return entry;
          return { ...entry, subcategories: arrayMove(list, oldIndex, Math.max(0, newIndex)) };
        }
        if (entry.slug === fromCat) return { ...entry, subcategories: entry.subcategories.filter((item) => item.slug !== fromSub) };
        if (entry.slug === toCat) {
          const list = [...entry.subcategories];
          list.splice(toIndex === null || toIndex < 0 ? list.length : toIndex, 0, moving);
          return { ...entry, subcategories: list };
        }
        return entry;
      })
    };

    setExpanded((prev) => ({ ...prev, [toCat]: true }));
    setSelected({ kind: 'subcategory', categorySlug: toCat, subcategorySlug: moving.slug });
    void persist(next, 'Premik podkategorije shranjen');
  };

  const onBottomChildrenDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    if (selected.kind === 'root') {
      const oldIndex = catalog.categories.findIndex((entry) => entry.slug === active.id);
      const newIndex = catalog.categories.findIndex((entry) => entry.slug === over.id);
      if (oldIndex < 0 || newIndex < 0) return;
      void persist({ categories: arrayMove(catalog.categories, oldIndex, newIndex) }, 'Vrstni red kategorij posodobljen');
      return;
    }

    if (selected.kind !== 'category') return;
    const category = catalog.categories.find((entry) => entry.slug === selected.categorySlug);
    if (!category) return;
    const oldIndex = category.subcategories.findIndex((entry) => entry.slug === active.id);
    const newIndex = category.subcategories.findIndex((entry) => entry.slug === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    const next = {
      categories: catalog.categories.map((entry) =>
        entry.slug === selected.categorySlug ? { ...entry, subcategories: arrayMove(entry.subcategories, oldIndex, newIndex) } : entry
      )
    };
    void persist(next, 'Vrstni red podkategorij posodobljen');
  };

  const onLeafProductsDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id || !selectedContext || selectedContext.kind === 'root') return;

    if (selectedContext.kind === 'category') {
      const items = sortCatalogItems(selectedContext.category.items ?? []);
      const oldIndex = items.findIndex((entry) => entry.slug === active.id);
      const newIndex = items.findIndex((entry) => entry.slug === over.id);
      if (oldIndex < 0 || newIndex < 0) return;
      const reordered = arrayMove(items, oldIndex, newIndex).map((item, index) => ({ ...item, displayOrder: index + 1 }));
      const next = { categories: catalog.categories.map((entry) => entry.slug === selectedContext.category.slug ? { ...entry, items: reordered } : entry) };
      void persist(next, 'Vrstni red izdelkov posodobljen');
      return;
    }

    const items = sortCatalogItems(selectedContext.subcategory.items);
    const oldIndex = items.findIndex((entry) => entry.slug === active.id);
    const newIndex = items.findIndex((entry) => entry.slug === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    const reordered = arrayMove(items, oldIndex, newIndex).map((item, index) => ({ ...item, displayOrder: index + 1 }));
    const next = {
      categories: catalog.categories.map((entry) =>
        entry.slug === selectedContext.category.slug
          ? { ...entry, subcategories: entry.subcategories.map((sub) => sub.slug === selectedContext.subcategory.slug ? { ...sub, items: reordered } : sub) }
          : entry
      )
    };
    void persist(next, 'Vrstni red izdelkov posodobljen');
  };

  const handleUploadImage = async (file: File | null, target: { kind: 'category' | 'subcategory'; categorySlug: string; subSlug?: string }) => {
    if (!file) return;
    const dataUrl = await fileToDataUrl(file);
    if (target.kind === 'category') {
      const next = { categories: catalog.categories.map((entry) => entry.slug === target.categorySlug ? { ...entry, image: dataUrl } : entry) };
      void persist(next, 'Slika shranjena');
      return;
    }
    updateSub(target.categorySlug, target.subSlug ?? '', { image: dataUrl });
  };

  const confirmDeleteImage = () => {
    if (!imageDeleteTarget) return;
    if (imageDeleteTarget.kind === 'category') {
      const next = { categories: catalog.categories.map((entry) => entry.slug === imageDeleteTarget.itemId ? { ...entry, image: '' } : entry) };
      setImageDeleteTarget(null);
      void persist(next, 'Slika odstranjena');
      return;
    }
    updateSub(imageDeleteTarget.categorySlug, imageDeleteTarget.itemId, { image: '' });
    setImageDeleteTarget(null);
  };

  if (loading) return <p className="text-sm text-slate-500">Nalagam kategorije ...</p>;

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl font-semibold text-slate-900">Kategorije</h1>
        <p className="mt-1 text-sm text-slate-600">Top = vizualno drevo, bottom = vsebina izbranega vozlišča.</p>
      </header>

      <ConfirmDialog
        open={deleteTarget !== null}
        title="Izbris kategorije"
        description="Ali ste prepričani, da želite odstraniti izbrano kategorijo?"
        confirmLabel="Izbriši"
        cancelLabel="Prekliči"
        isDanger
        onCancel={() => setDeleteTarget(null)}
        onConfirm={confirmDeleteNode}
      />

      <ConfirmDialog
        open={imageDeleteTarget !== null}
        title="Odstrani sliko"
        description="Ali ste prepričani, da želite odstraniti sliko?"
        confirmLabel="Odstrani"
        cancelLabel="Prekliči"
        isDanger
        onCancel={() => setImageDeleteTarget(null)}
        onConfirm={confirmDeleteImage}
      />

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Hierarhija (inverted tree)</p>
          <Button variant="outline" size="sm" onClick={() => addCategory()}>+ Kategorija</Button>
        </div>

        <div className="overflow-x-auto">
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onTreeDragEnd}>
            <div className="min-w-[980px] pb-2">
              <div className="flex justify-center">
                <button
                  type="button"
                  onClick={() => setSelected({ kind: 'root' })}
                  className={`rounded-xl border px-4 py-2 text-sm ${selected.kind === 'root' ? 'border-brand-300 bg-brand-50 text-brand-700' : 'border-slate-200 text-slate-700'}`}
                >
                  Vse kategorije
                </button>
              </div>
              <div className="mx-auto mt-2 h-7 w-px bg-slate-300" />

              <SortableContext items={catalog.categories.map((entry) => catId(entry.slug))} strategy={rectSortingStrategy}>
                <div className="relative border-t border-slate-300 pt-8">
                  <div className="grid gap-4 lg:grid-cols-3 2xl:grid-cols-4">
                    {catalog.categories.map((category) => {
                      const categorySelected = selected.kind === 'category' && selected.categorySlug === category.slug;
                      const expandedState = expanded[category.slug] ?? true;

                      return (
                        <div key={category.slug} className="relative rounded-xl border border-slate-200 bg-slate-50/40 p-3">
                          <div className="absolute -top-8 left-1/2 h-8 w-px -translate-x-1/2 bg-slate-300" />
                          <DropSurface id={catDropId(category.slug)}>
                            <SortableSurface id={catId(category.slug)}>
                              {({ dragProps }) => (
                                <div {...dragProps} className="rounded-xl border border-slate-200 bg-white p-2">
                                  <div className="flex items-center gap-2">
                                    <button type="button" className="rounded-md border border-slate-300 px-2 text-xs" onClick={(e) => { e.stopPropagation(); setExpanded((prev) => ({ ...prev, [category.slug]: !expandedState })); }}>
                                      {expandedState ? '−' : '+'}
                                    </button>
                                    <button type="button" onClick={() => setSelected({ kind: 'category', categorySlug: category.slug })} className={`flex-1 rounded-md px-2 py-1 text-left text-sm ${categorySelected ? 'bg-brand-50 font-semibold text-brand-700' : 'text-slate-700'}`}>
                                      {category.title}
                                    </button>
                                    <Button variant="ghost" size="sm" onClick={() => { setEditingNode(catId(category.slug)); setDraftNodeTitle(category.title); }}>✎</Button>
                                    <Button variant="ghost" size="sm" onClick={() => addCategory(category.slug)}>+⟷</Button>
                                    <Button variant="ghost" size="sm" onClick={() => addSubcategory(category.slug)}>+↓</Button>
                                    <Button variant="ghost" size="sm" onClick={() => setDeleteTarget({ kind: 'category', categorySlug: category.slug })}>−</Button>
                                  </div>
                                  {editingNode === catId(category.slug) ? (
                                    <div className="mt-2 flex items-center gap-2">
                                      <FloatingInput id={`rename-${category.slug}`} tone="admin" label="Naziv" value={draftNodeTitle} onChange={(event) => setDraftNodeTitle(event.target.value)} />
                                      <Button variant="outline" size="sm" onClick={() => { renameNode(catId(category.slug), draftNodeTitle); setEditingNode(null); }}>Shrani</Button>
                                    </div>
                                  ) : null}
                                </div>
                              )}
                            </SortableSurface>
                          </DropSurface>

                          {expandedState ? (
                            <>
                              <div className="mx-auto mt-2 h-4 w-px bg-slate-300" />
                              <div className="relative border-t border-slate-300 pt-4">
                                <SortableContext items={category.subcategories.map((entry) => subId(category.slug, entry.slug))} strategy={rectSortingStrategy}>
                                  <div className="grid gap-2 xl:grid-cols-2">
                                    {category.subcategories.map((subcategory) => {
                                      const sid = subId(category.slug, subcategory.slug);
                                      const subSelected = selected.kind === 'subcategory' && selected.categorySlug === category.slug && selected.subcategorySlug === subcategory.slug;
                                      return (
                                        <div key={sid} className="relative pt-4">
                                          <div className="absolute left-1/2 top-0 h-4 w-px -translate-x-1/2 bg-slate-300" />
                                          <SortableSurface id={sid}>
                                            {({ dragProps }) => (
                                              <div {...dragProps} className="rounded-lg border border-slate-200 bg-white p-2">
                                                <div className="flex items-center gap-2">
                                                  <button type="button" onClick={() => setSelected({ kind: 'subcategory', categorySlug: category.slug, subcategorySlug: subcategory.slug })} className={`flex-1 rounded-md px-2 py-1 text-left text-sm ${subSelected ? 'bg-brand-50 font-semibold text-brand-700' : 'text-slate-700'}`}>
                                                    {subcategory.title}
                                                  </button>
                                                  <Button variant="ghost" size="sm" onClick={() => { setEditingNode(sid); setDraftNodeTitle(subcategory.title); }}>✎</Button>
                                                  <Button variant="ghost" size="sm" onClick={() => addSubcategory(category.slug, subcategory.slug)}>+⟷</Button>
                                                  <Button variant="ghost" size="sm" onClick={() => setDeleteTarget({ kind: 'subcategory', categorySlug: category.slug, subcategorySlug: subcategory.slug })}>−</Button>
                                                </div>
                                                {editingNode === sid ? (
                                                  <div className="mt-2 flex items-center gap-2">
                                                    <FloatingInput id={`rename-${sid}`} tone="admin" label="Naziv" value={draftNodeTitle} onChange={(event) => setDraftNodeTitle(event.target.value)} />
                                                    <Button variant="outline" size="sm" onClick={() => { renameNode(sid, draftNodeTitle); setEditingNode(null); }}>Shrani</Button>
                                                  </div>
                                                ) : null}
                                              </div>
                                            )}
                                          </SortableSurface>
                                        </div>
                                      );
                                    })}
                                  </div>
                                </SortableContext>
                              </div>
                            </>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </SortableContext>
            </div>
          </DndContext>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-3 flex items-center justify-between">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Vsebina izbrane kategorije</p>
          <p className="text-xs text-slate-400">{saving ? 'Shranjujem ...' : 'Spremembe se shranjujejo sproti.'}</p>
        </div>

        {selectedContext?.kind === 'root' ? (
          <ContentsGrid
            title="Vse kategorije"
            description="Top-level kategorije, kot jih vidi kupec."
            items={catalog.categories.map((entry) => ({ id: entry.slug, title: entry.title, description: entry.summary, image: entry.image, adminNotes: entry.adminNotes ?? '' }))}
            onDragEnd={onBottomChildrenDragEnd}
            onOpen={(id) => setSelected({ kind: 'category', categorySlug: id })}
            onTitleChange={(id, value) => void persist({ categories: catalog.categories.map((entry) => entry.slug === id ? { ...entry, title: value } : entry) })}
            onDescriptionChange={(id, value) => void persist({ categories: catalog.categories.map((entry) => entry.slug === id ? { ...entry, summary: value } : entry) })}
            onAdminNotesChange={(id, value) => void persist({ categories: catalog.categories.map((entry) => entry.slug === id ? { ...entry, adminNotes: value } : entry) })}
            onImageUpload={(id, file) => void handleUploadImage(file, { kind: 'category', categorySlug: id })}
            onImageDelete={(id) => setImageDeleteTarget({ kind: 'category', categorySlug: id, itemId: id })}
            onAddChild={(id) => addSubcategory(id)}
          />
        ) : null}

        {selectedContext?.kind === 'category' ? (
          selectedContext.category.subcategories.length > 0 ? (
            <ContentsGrid
              title={`${selectedContext.category.title} — podkategorije`}
              description="Urejanje child kategorij v storefront-like pogledu."
              items={selectedContext.category.subcategories.map((entry) => ({ id: entry.slug, title: entry.title, description: entry.description, image: entry.image ?? '', adminNotes: entry.adminNotes ?? '' }))}
              onDragEnd={onBottomChildrenDragEnd}
              onOpen={(id) => setSelected({ kind: 'subcategory', categorySlug: selectedContext.category.slug, subcategorySlug: id })}
              onTitleChange={(id, value) => updateSub(selectedContext.category.slug, id, { title: value })}
              onDescriptionChange={(id, value) => updateSub(selectedContext.category.slug, id, { description: value })}
              onAdminNotesChange={(id, value) => updateSub(selectedContext.category.slug, id, { adminNotes: value })}
              onImageUpload={(id, file) => void handleUploadImage(file, { kind: 'subcategory', categorySlug: selectedContext.category.slug, subSlug: id })}
              onImageDelete={(id) => setImageDeleteTarget({ kind: 'subcategory', categorySlug: selectedContext.category.slug, subcategorySlug: id, itemId: id })}
              onAddChild={() => addSubcategory(selectedContext.category.slug)}
            />
          ) : (
            <LeafProductsView
              title={`${selectedContext.category.title} — izdelki`}
              category={selectedContext.category}
              items={sortCatalogItems(selectedContext.category.items ?? [])}
              onDragEnd={onLeafProductsDragEnd}
            />
          )
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

function ContentsGrid({
  title,
  description,
  items,
  onDragEnd,
  onOpen,
  onTitleChange,
  onDescriptionChange,
  onAdminNotesChange,
  onImageUpload,
  onImageDelete,
  onAddChild
}: {
  title: string;
  description: string;
  items: ContentCard[];
  onDragEnd: (event: DragEndEvent) => void;
  onOpen: (id: string) => void;
  onTitleChange: (id: string, value: string) => void;
  onDescriptionChange: (id: string, value: string) => void;
  onAdminNotesChange: (id: string, value: string) => void;
  onImageUpload: (id: string, file: File | null) => void;
  onImageDelete: (id: string) => void;
  onAddChild: (id: string) => void;
}) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  return (
    <div>
      <h2 className="text-xl font-semibold text-slate-900">{title}</h2>
      <p className="mt-1 text-sm text-slate-600">{description}</p>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={items.map((entry) => entry.id)} strategy={rectSortingStrategy}>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {items.map((item) => (
              <SortableSurface key={item.id} id={item.id}>
                {({ dragProps }) => (
                  <div {...dragProps} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                    <div className="relative h-36 bg-slate-50">
                      {item.image ? <Image src={item.image} alt={item.title} fill className="object-cover" /> : <div className="flex h-full items-center justify-center text-xs text-slate-400">Brez slike</div>}
                    </div>
                    <div className="space-y-3 p-4" onPointerDownCapture={(e) => e.stopPropagation()}>
                      <FloatingInput id={`content-title-${item.id}`} tone="admin" label="Naziv" value={item.title} onChange={(event) => onTitleChange(item.id, event.target.value)} />
                      <FloatingTextarea id={`content-description-${item.id}`} tone="admin" label="Opis" value={item.description} onChange={(event) => onDescriptionChange(item.id, event.target.value)} className="min-h-[90px]" />
                      <FloatingTextarea id={`content-notes-${item.id}`} tone="admin" label="Admin opombe" value={item.adminNotes} onChange={(event) => onAdminNotesChange(item.id, event.target.value)} className="min-h-[80px]" />

                      <div className="flex items-center gap-2">
                        <label className="inline-flex cursor-pointer items-center rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50">
                          Naloži sliko
                          <input type="file" accept="image/*" className="hidden" onChange={(event) => void onImageUpload(item.id, event.target.files?.[0] ?? null)} />
                        </label>
                        <Button variant="outline" size="sm" onClick={() => onImageDelete(item.id)}>Odstrani sliko</Button>
                      </div>

                      <div className="flex items-center gap-2">
                        <Button variant="outline" size="sm" onClick={() => onOpen(item.id)}>Odpri</Button>
                        <Button variant="outline" size="sm" onClick={() => onAddChild(item.id)}>+ Otrok</Button>
                      </div>
                    </div>
                  </div>
                )}
              </SortableSurface>
            ))}
          </div>
        </SortableContext>
      </DndContext>
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
      <h2 className="text-xl font-semibold text-slate-900">{title}</h2>
      <p className="mt-1 text-sm text-slate-600">Leaf pogled: urejanje vrstnega reda izdelkov.</p>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={items.map((item) => item.slug)} strategy={verticalListSortingStrategy}>
          <div className="mt-4 space-y-3">
            {items.map((item) => (
              <SortableSurface key={item.slug} id={item.slug}>
                {({ dragProps }) => {
                  const basePrice = subcategory ? item.price ?? getCatalogItemPrice(category.slug, subcategory.slug, item.slug) : item.price ?? getCatalogCategoryItemPrice(category.slug, item.slug);
                  const finalPrice = getDiscountedPrice(basePrice, item.discountPct);
                  return (
                    <div {...dragProps} className="rounded-xl border border-slate-200 bg-white p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-slate-900">{item.name}</p>
                          <p className="mt-1 text-xs text-slate-600">{item.description}</p>
                          <p className="mt-2 text-xs font-semibold text-slate-900">{formatCatalogPrice(finalPrice)}</p>
                          <p className="mt-1 text-[11px] text-slate-500">SKU: {subcategory ? getCatalogItemSku(category.slug, subcategory.slug, item.slug) : getCatalogCategoryItemSku(category.slug, item.slug)}</p>
                        </div>
                        <span className="text-xs text-slate-500">Povleci</span>
                      </div>
                    </div>
                  );
                }}
              </SortableSurface>
            ))}
          </div>
        </SortableContext>
      </DndContext>
    </div>
  );
}
