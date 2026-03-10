'use client';

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import Image from 'next/image';
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  horizontalListSortingStrategy,
  rectSortingStrategy,
  useSortable
} from '@dnd-kit/sortable';
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
import { ConfirmDialog } from '@/shared/ui/confirm-dialog';
import { FloatingInput, FloatingTextarea } from '@/shared/ui/floating-field';
import { IconButton } from '@/shared/ui/icon-button';
import { useToast } from '@/shared/ui/toast';

type CatalogData = { categories: CatalogCategory[] };
type SelectedNode = { kind: 'root' } | { kind: 'category'; categorySlug: string } | { kind: 'subcategory'; categorySlug: string; subcategorySlug: string };
type DeleteTarget = { kind: 'category' | 'subcategory'; categorySlug: string; subcategorySlug?: string } | null;
type ImageDeleteTarget = { kind: 'category' | 'subcategory'; categorySlug: string; subcategorySlug?: string } | null;
type TreeNode = { id: string; title: string; kind: 'root' | 'category' | 'subcategory'; categorySlug?: string; subcategorySlug?: string; children: TreeNode[] };
type ContentCard = { id: string; title: string; description: string; image?: string; kind: 'category' | 'subcategory' };

const rootId = 'root';
const catId = (slug: string) => `cat:${slug}`;
const subId = (catSlug: string, subSlug: string) => `sub:${catSlug}:${subSlug}`;
const slugify = (value: string) => value.toLowerCase().trim().replace(/\s+/g, '-').replace(/[^a-z0-9-čšžćđ]/gi, '');

function parseTreeId(id: string): { kind: 'category' | 'subcategory'; categorySlug: string; subcategorySlug?: string } | null {
  if (id.startsWith('cat:')) return { kind: 'category', categorySlug: id.slice(4) };
  if (!id.startsWith('sub:')) return null;
  const [, categorySlug, subcategorySlug] = id.split(':');
  if (!categorySlug || !subcategorySlug) return null;
  return { kind: 'subcategory', categorySlug, subcategorySlug };
}

async function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.onerror = () => reject(new Error('Napaka pri branju datoteke'));
    reader.readAsDataURL(file);
  });
}

function SortableItem({ id, children }: { id: string; children: (dragHandleProps: Record<string, unknown>) => ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id });
  return (
    <div ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition }}>
      {children({ ...attributes, ...listeners })}
    </div>
  );
}

export default function AdminCategoriesManager() {
  const [catalog, setCatalog] = useState<CatalogData>({ categories: [] });
  const [selected, setSelected] = useState<SelectedNode>({ kind: 'root' });
  const [expanded, setExpanded] = useState<Record<string, boolean>>({ [rootId]: true });
  const [editingNodeId, setEditingNodeId] = useState<string | null>(null);
  const [draftTitle, setDraftTitle] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget>(null);
  const [imageDeleteTarget, setImageDeleteTarget] = useState<ImageDeleteTarget>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));
  const uploadRefs = useRef<Record<string, HTMLInputElement | null>>({});

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
    setExpanded((prev) => ({
      ...prev,
      [rootId]: true,
      ...Object.fromEntries(payload.categories.map((entry) => [catId(entry.slug), true]))
    }));
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
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(next)
    });
    setSaving(false);
    if (!response.ok) {
      toast.error('Shranjevanje ni uspelo');
      return;
    }
    toast.success(message);
  };

  const tree = useMemo<TreeNode>(() => ({
    id: rootId,
    title: 'Vse kategorije',
    kind: 'root',
    children: catalog.categories.map((category) => ({
      id: catId(category.slug),
      title: category.title,
      kind: 'category',
      categorySlug: category.slug,
      children: category.subcategories.map((subcategory) => ({
        id: subId(category.slug, subcategory.slug),
        title: subcategory.title,
        kind: 'subcategory',
        categorySlug: category.slug,
        subcategorySlug: subcategory.slug,
        children: []
      }))
    }))
  }), [catalog.categories]);

  const selectedContext = useMemo(() => {
    if (selected.kind === 'root') return { kind: 'root' as const };
    const category = catalog.categories.find((entry) => entry.slug === selected.categorySlug);
    if (!category) return null;
    if (selected.kind === 'category') return { kind: 'category' as const, category };
    const subcategory = category.subcategories.find((entry) => entry.slug === selected.subcategorySlug);
    if (!subcategory) return null;
    return { kind: 'subcategory' as const, category, subcategory };
  }, [catalog.categories, selected]);

  const startRename = (id: string, title: string) => {
    setEditingNodeId(id);
    setDraftTitle(title);
  };

  const renameNode = () => {
    if (!editingNodeId) return;
    const parsed = parseTreeId(editingNodeId);
    const nextTitle = draftTitle.trim();
    const nextSlug = slugify(nextTitle);
    if (!parsed || !nextTitle || !nextSlug) return;

    if (parsed.kind === 'category') {
      const next = { categories: catalog.categories.map((entry) => entry.slug === parsed.categorySlug ? { ...entry, title: nextTitle, slug: nextSlug } : entry) };
      setSelected({ kind: 'category', categorySlug: nextSlug });
      setEditingNodeId(null);
      void persist(next, 'Kategorija preimenovana');
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
    setEditingNodeId(null);
    void persist(next, 'Podkategorija preimenovana');
  };

  const addCategory = (afterSlug?: string) => {
    const title = window.prompt('Ime nove kategorije');
    if (!title) return;
    const slug = slugify(title);
    if (!slug) return;
    const item: CatalogCategory = { slug, title, summary: title, description: '', image: '', subcategories: [], items: [] };
    const list = [...catalog.categories];
    if (!afterSlug) list.push(item);
    else {
      const index = list.findIndex((entry) => entry.slug === afterSlug);
      if (index < 0) list.push(item); else list.splice(index + 1, 0, item);
    }
    setExpanded((prev) => ({ ...prev, [catId(slug)]: true }));
    void persist({ categories: list }, 'Kategorija dodana');
  };

  const addSubcategory = (categorySlug: string, afterSlug?: string) => {
    const title = window.prompt('Ime nove podkategorije');
    if (!title) return;
    const slug = slugify(title);
    if (!slug) return;
    const next = {
      categories: catalog.categories.map((entry) => {
        if (entry.slug !== categorySlug) return entry;
        const sub: CatalogSubcategory = { slug, title, description: '', image: '', items: [] };
        const list = [...entry.subcategories];
        if (!afterSlug) list.push(sub);
        else {
          const index = list.findIndex((node) => node.slug === afterSlug);
          if (index < 0) list.push(sub); else list.splice(index + 1, 0, sub);
        }
        return { ...entry, subcategories: list };
      })
    };
    setExpanded((prev) => ({ ...prev, [catId(categorySlug)]: true }));
    void persist(next, 'Podkategorija dodana');
  };

  const onTopTreeDragEnd = (event: DragEndEvent) => {
    const active = String(event.active.id);
    const over = event.over ? String(event.over.id) : null;
    if (!over || active === over) return;

    const activeNode = parseTreeId(active);
    const overNode = parseTreeId(over);
    if (!activeNode || !overNode) return;

    if (activeNode.kind === 'category' && overNode.kind === 'category') {
      const oldIndex = catalog.categories.findIndex((entry) => entry.slug === activeNode.categorySlug);
      const newIndex = catalog.categories.findIndex((entry) => entry.slug === overNode.categorySlug);
      if (oldIndex < 0 || newIndex < 0) return;
      void persist({ categories: arrayMove(catalog.categories, oldIndex, newIndex) }, 'Premik kategorije shranjen');
      return;
    }

    if (activeNode.kind !== 'subcategory') return;

    const sourceCategory = catalog.categories.find((entry) => entry.slug === activeNode.categorySlug);
    const movingSub = sourceCategory?.subcategories.find((entry) => entry.slug === activeNode.subcategorySlug);
    if (!sourceCategory || !movingSub) return;

    if (overNode.kind === 'category') {
      const next = {
        categories: catalog.categories.map((entry) => {
          if (entry.slug === activeNode.categorySlug) {
            return { ...entry, subcategories: entry.subcategories.filter((sub) => sub.slug !== activeNode.subcategorySlug) };
          }
          if (entry.slug === overNode.categorySlug) {
            return { ...entry, subcategories: [...entry.subcategories, movingSub] };
          }
          return entry;
        })
      };
      setSelected({ kind: 'subcategory', categorySlug: overNode.categorySlug, subcategorySlug: movingSub.slug });
      void persist(next, 'Podkategorija premaknjena');
      return;
    }

    const targetCategory = overNode.categorySlug;
    const targetIndex = catalog.categories
      .find((entry) => entry.slug === targetCategory)
      ?.subcategories.findIndex((entry) => entry.slug === overNode.subcategorySlug);

    if (targetIndex === undefined || targetIndex < 0) return;

    const next = {
      categories: catalog.categories.map((entry) => {
        if (entry.slug === activeNode.categorySlug && entry.slug === targetCategory) {
          const from = entry.subcategories.findIndex((sub) => sub.slug === activeNode.subcategorySlug);
          return from < 0 ? entry : { ...entry, subcategories: arrayMove(entry.subcategories, from, targetIndex) };
        }
        if (entry.slug === activeNode.categorySlug) {
          return { ...entry, subcategories: entry.subcategories.filter((sub) => sub.slug !== activeNode.subcategorySlug) };
        }
        if (entry.slug === targetCategory) {
          const list = [...entry.subcategories];
          list.splice(targetIndex, 0, movingSub);
          return { ...entry, subcategories: list };
        }
        return entry;
      })
    };

    setSelected({ kind: 'subcategory', categorySlug: targetCategory, subcategorySlug: movingSub.slug });
    void persist(next, 'Vrstni red podkategorij posodobljen');
  };

  const onBottomReorder = (event: DragEndEvent) => {
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
      const oldIndex = items.findIndex((item) => item.slug === active.id);
      const newIndex = items.findIndex((item) => item.slug === over.id);
      if (oldIndex < 0 || newIndex < 0) return;
      const reordered = arrayMove(items, oldIndex, newIndex).map((item, index) => ({ ...item, displayOrder: index + 1 }));
      void persist({ categories: catalog.categories.map((entry) => entry.slug === selectedContext.category.slug ? { ...entry, items: reordered } : entry) }, 'Vrstni red izdelkov shranjen');
      return;
    }

    const items = sortCatalogItems(selectedContext.subcategory.items);
    const oldIndex = items.findIndex((item) => item.slug === active.id);
    const newIndex = items.findIndex((item) => item.slug === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    const reordered = arrayMove(items, oldIndex, newIndex).map((item, index) => ({ ...item, displayOrder: index + 1 }));
    const next = {
      categories: catalog.categories.map((entry) =>
        entry.slug === selectedContext.category.slug
          ? { ...entry, subcategories: entry.subcategories.map((sub) => sub.slug === selectedContext.subcategory.slug ? { ...sub, items: reordered } : sub) }
          : entry
      )
    };
    void persist(next, 'Vrstni red izdelkov shranjen');
  };

  const updateSubcategory = (categorySlug: string, subSlug: string, patch: Partial<CatalogSubcategory>) => {
    void persist({
      categories: catalog.categories.map((entry) =>
        entry.slug === categorySlug
          ? { ...entry, subcategories: entry.subcategories.map((sub) => sub.slug === subSlug ? { ...sub, ...patch } : sub) }
          : entry
      )
    });
  };

  const onImageUpload = async (file: File | null, item: ContentCard, categorySlug?: string) => {
    if (!file) return;
    const dataUrl = await fileToDataUrl(file);
    if (item.kind === 'category') {
      void persist({ categories: catalog.categories.map((entry) => entry.slug === item.id ? { ...entry, image: dataUrl } : entry) }, 'Slika shranjena');
      return;
    }
    if (!categorySlug) return;
    updateSubcategory(categorySlug, item.id, { image: dataUrl });
  };

  const confirmDeleteNode = () => {
    if (!deleteTarget) return;
    if (deleteTarget.kind === 'category') {
      setDeleteTarget(null);
      setSelected({ kind: 'root' });
      void persist({ categories: catalog.categories.filter((entry) => entry.slug !== deleteTarget.categorySlug) }, 'Kategorija izbrisana');
      return;
    }

    setDeleteTarget(null);
    setSelected({ kind: 'category', categorySlug: deleteTarget.categorySlug });
    void persist({
      categories: catalog.categories.map((entry) =>
        entry.slug === deleteTarget.categorySlug
          ? { ...entry, subcategories: entry.subcategories.filter((sub) => sub.slug !== deleteTarget.subcategorySlug) }
          : entry
      )
    }, 'Podkategorija izbrisana');
  };

  const confirmDeleteImage = () => {
    if (!imageDeleteTarget) return;
    if (imageDeleteTarget.kind === 'category') {
      void persist({ categories: catalog.categories.map((entry) => entry.slug === imageDeleteTarget.categorySlug ? { ...entry, image: '' } : entry) }, 'Slika odstranjena');
      setImageDeleteTarget(null);
      return;
    }
    updateSubcategory(imageDeleteTarget.categorySlug, imageDeleteTarget.subcategorySlug ?? '', { image: '' });
    setImageDeleteTarget(null);
  };

  const visibleContent = useMemo(() => {
    if (selectedContext?.kind === 'root') {
      return catalog.categories.map((entry) => ({ id: entry.slug, title: entry.title, description: entry.summary, image: entry.image, kind: 'category' as const }));
    }
    if (selectedContext?.kind === 'category') {
      return selectedContext.category.subcategories.map((entry) => ({ id: entry.slug, title: entry.title, description: entry.description, image: entry.image, kind: 'subcategory' as const }));
    }
    return [];
  }, [catalog.categories, selectedContext]);

  if (loading) return <p className="text-sm text-slate-500">Nalagam kategorije ...</p>;

  const renderTree = (node: TreeNode): ReactNode => {
    const isSelected =
      (selected.kind === 'root' && node.kind === 'root') ||
      (selected.kind === 'category' && node.kind === 'category' && selected.categorySlug === node.categorySlug) ||
      (selected.kind === 'subcategory' && node.kind === 'subcategory' && selected.categorySlug === node.categorySlug && selected.subcategorySlug === node.subcategorySlug);

    const hasChildren = node.children.length > 0;
    const opened = expanded[node.id] ?? true;

    return (
      <div className="tree-node">
        <div className={`flex min-w-[260px] items-center justify-between gap-2 rounded-xl border bg-white px-3 py-2 shadow-sm ${isSelected ? 'border-brand-400 ring-2 ring-brand-100' : 'border-slate-200'}`}>
          <button
            type="button"
            onClick={() => {
              if (node.kind === 'root') setSelected({ kind: 'root' });
              if (node.kind === 'category' && node.categorySlug) setSelected({ kind: 'category', categorySlug: node.categorySlug });
              if (node.kind === 'subcategory' && node.categorySlug && node.subcategorySlug) setSelected({ kind: 'subcategory', categorySlug: node.categorySlug, subcategorySlug: node.subcategorySlug });
            }}
            className="flex-1 text-left text-sm font-semibold text-slate-800"
          >
            {node.title}
          </button>

          <div className="flex items-center gap-1">
            {hasChildren ? <IconButton aria-label="Razširi/skrij" onClick={() => setExpanded((prev) => ({ ...prev, [node.id]: !(prev[node.id] ?? true) }))}>{opened ? '▾' : '▸'}</IconButton> : null}
            {node.kind === 'category' && node.categorySlug ? <IconButton aria-label="Dodaj podkategorijo" onClick={() => addSubcategory(node.categorySlug!)}>＋</IconButton> : null}
            {node.kind === 'subcategory' && node.categorySlug && node.subcategorySlug ? <IconButton aria-label="Dodaj sorojenca" onClick={() => addSubcategory(node.categorySlug!, node.subcategorySlug!)}>＋</IconButton> : null}
            {node.kind === 'category' && node.categorySlug ? <IconButton aria-label="Dodaj sorojenca" onClick={() => addCategory(node.categorySlug)}>⟷</IconButton> : null}
            {node.kind !== 'root' ? <IconButton aria-label="Uredi" onClick={() => startRename(node.id, node.title)}>✎</IconButton> : null}
            {node.kind !== 'root' && node.categorySlug ? (
              <IconButton tone="danger" aria-label="Izbriši" onClick={() => setDeleteTarget(node.kind === 'category' ? { kind: 'category', categorySlug: node.categorySlug! } : { kind: 'subcategory', categorySlug: node.categorySlug!, subcategorySlug: node.subcategorySlug! })}>🗑</IconButton>
            ) : null}
          </div>
        </div>

        {editingNodeId === node.id ? (
          <div className="mt-2 flex items-center gap-2 rounded-lg border border-slate-200 bg-white p-2">
            <FloatingInput id={`rename-${node.id}`} tone="admin" label="Naziv" value={draftTitle} onChange={(event) => setDraftTitle(event.target.value)} />
            <Button variant="outline" size="sm" onClick={renameNode}>Shrani</Button>
          </div>
        ) : null}

        {hasChildren && opened ? (
          <ul>
            <SortableContext items={node.children.map((child) => child.id)} strategy={horizontalListSortingStrategy}>
              {node.children.map((child) => (
                <li key={child.id}>
                  <SortableItem id={child.id}>{() => <>{renderTree(child)}</>}</SortableItem>
                </li>
              ))}
            </SortableContext>
          </ul>
        ) : null}
      </div>
    );
  };

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl font-semibold text-slate-900">Kategorije</h1>
        <p className="mt-1 text-sm text-slate-600">Top: povezano obrnjeno drevo. Bottom: vsebina izbrane kategorije v storefront admin pogledu.</p>
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
        <div className="mb-3 flex items-center justify-between">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Hierarhija kategorij</p>
          <Button variant="outline" size="sm" onClick={() => addCategory()}>+ Dodaj kategorijo</Button>
        </div>
        <div className="overflow-x-auto pb-4">
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onTopTreeDragEnd}>
            <div className="tree">{renderTree(tree)}</div>
          </DndContext>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-3 flex items-center justify-between">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Vsebina izbrane kategorije</p>
          <p className="text-xs text-slate-400">{saving ? 'Shranjujem ...' : 'Spremembe se shranjujejo sproti.'}</p>
        </div>

        {selectedContext?.kind === 'root' || (selectedContext?.kind === 'category' && visibleContent.length > 0) ? (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onBottomReorder}>
            <SortableContext items={visibleContent.map((item) => item.id)} strategy={rectSortingStrategy}>
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {visibleContent.map((item) => (
                  <SortableItem key={item.id} id={item.id}>
                    {(dragProps) => (
                      <article className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
                        <div className="relative h-36 overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
                          {item.image ? <Image src={item.image} alt={item.title} fill className="object-cover" /> : <div className="flex h-full items-center justify-center text-xs text-slate-400">Brez slike</div>}
                        </div>

                        <div className="mt-2 flex items-center gap-1">
                          <IconButton aria-label="Premakni" {...dragProps}>⋮⋮</IconButton>
                          <Button variant="ghost" size="sm" onClick={() => {
                            if (item.kind === 'category') setSelected({ kind: 'category', categorySlug: item.id });
                            else if (selectedContext?.kind === 'category') setSelected({ kind: 'subcategory', categorySlug: selectedContext.category.slug, subcategorySlug: item.id });
                          }}>Odpri</Button>
                          <Button variant="ghost" size="sm" onClick={() => {
                            if (item.kind === 'category') setSelected({ kind: 'category', categorySlug: item.id });
                            if (item.kind === 'subcategory' && selectedContext?.kind === 'category') setSelected({ kind: 'subcategory', categorySlug: selectedContext.category.slug, subcategorySlug: item.id });
                          }}>Skok na drevo</Button>
                        </div>

                        <div className="mt-3 space-y-2">
                          <FloatingInput
                            id={`title-${item.id}`}
                            tone="admin"
                            label="Naziv"
                            value={item.title}
                            onChange={(event) => {
                              const value = event.target.value;
                              if (item.kind === 'category') {
                                void persist({ categories: catalog.categories.map((entry) => entry.slug === item.id ? { ...entry, title: value } : entry) });
                              } else if (selectedContext?.kind === 'category') {
                                updateSubcategory(selectedContext.category.slug, item.id, { title: value });
                              }
                            }}
                          />
                          <FloatingTextarea
                            id={`desc-${item.id}`}
                            tone="admin"
                            label="Opis"
                            value={item.description}
                            onChange={(event) => {
                              const value = event.target.value;
                              if (item.kind === 'category') {
                                void persist({ categories: catalog.categories.map((entry) => entry.slug === item.id ? { ...entry, summary: value } : entry) });
                              } else if (selectedContext?.kind === 'category') {
                                updateSubcategory(selectedContext.category.slug, item.id, { description: value });
                              }
                            }}
                          />
                        </div>

                        <div className="mt-2 flex items-center gap-2">
                          <input ref={(element) => { uploadRefs.current[item.id] = element; }} type="file" accept="image/*" className="hidden" onChange={(event) => void onImageUpload(event.target.files?.[0] ?? null, item, selectedContext?.kind === 'category' ? selectedContext.category.slug : undefined)} />
                          <Button variant="outline" size="sm" onClick={() => uploadRefs.current[item.id]?.click()}>{item.image ? 'Zamenjaj sliko' : 'Naloži sliko'}</Button>
                          {item.image ? <Button variant="ghost" size="sm" onClick={() => setImageDeleteTarget({ kind: item.kind, categorySlug: item.kind === 'category' ? item.id : selectedContext?.kind === 'category' ? selectedContext.category.slug : '', subcategorySlug: item.kind === 'subcategory' ? item.id : undefined })}>Odstrani sliko</Button> : null}
                        </div>
                      </article>
                    )}
                  </SortableItem>
                ))}
              </div>
            </SortableContext>
          </DndContext>
        ) : null}

        {selectedContext?.kind === 'category' && selectedContext.category.subcategories.length === 0 ? (
          <LeafProductsView title={`${selectedContext.category.title} — izdelki`} category={selectedContext.category} items={sortCatalogItems(selectedContext.category.items ?? [])} onDragEnd={onLeafProductsDragEnd} />
        ) : null}

        {selectedContext?.kind === 'subcategory' ? (
          <LeafProductsView title={`${selectedContext.category.title} / ${selectedContext.subcategory.title}`} category={selectedContext.category} subcategory={selectedContext.subcategory} items={sortCatalogItems(selectedContext.subcategory.items)} onDragEnd={onLeafProductsDragEnd} />
        ) : null}
      </section>

      <style jsx>{`
        .tree ul {
          display: flex;
          justify-content: center;
          padding-top: 24px;
          position: relative;
          margin: 0;
          list-style: none;
          gap: 10px;
        }
        .tree li {
          position: relative;
          text-align: center;
          list-style: none;
          padding: 0 4px;
        }
        .tree li::before,
        .tree li::after {
          content: '';
          position: absolute;
          top: -12px;
          right: 50%;
          width: 50%;
          height: 12px;
          border-top: 1px solid #cbd5e1;
        }
        .tree li::after {
          right: auto;
          left: 50%;
          border-left: 1px solid #cbd5e1;
        }
        .tree li:only-child::after,
        .tree li:only-child::before {
          display: none;
        }
        .tree li:only-child {
          padding-top: 0;
        }
        .tree li:first-child::before,
        .tree li:last-child::after {
          border: 0;
        }
        .tree li:last-child::before {
          border-right: 1px solid #cbd5e1;
          border-radius: 0 6px 0 0;
        }
        .tree li:first-child::after {
          border-radius: 6px 0 0 0;
        }
        .tree ul ul::before {
          content: '';
          position: absolute;
          top: 0;
          left: 50%;
          width: 0;
          height: 24px;
          border-left: 1px solid #cbd5e1;
        }
      `}</style>
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
            {items.map((item) => (
              <SortableItem key={item.slug} id={item.slug}>
                {(dragProps) => {
                  const basePrice = subcategory
                    ? item.price ?? getCatalogItemPrice(category.slug, subcategory.slug, item.slug)
                    : item.price ?? getCatalogCategoryItemPrice(category.slug, item.slug);
                  const finalPrice = getDiscountedPrice(basePrice, item.discountPct);
                  return (
                    <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                      {item.image ? (
                        <div className="relative h-24 overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
                          <Image src={item.images?.[0] ?? item.image} alt={item.name} fill className="object-contain p-2" />
                        </div>
                      ) : null}
                      <h4 className="mt-2 text-sm font-semibold text-slate-900">{item.name}</h4>
                      <p className="mt-1 text-xs text-slate-600">{item.description}</p>
                      <p className="mt-2 text-sm font-semibold text-slate-900">{formatCatalogPrice(finalPrice)}</p>
                      <p className="mt-1 text-[11px] text-slate-500">SKU: {subcategory ? getCatalogItemSku(category.slug, subcategory.slug, item.slug) : getCatalogCategoryItemSku(category.slug, item.slug)}</p>
                      <div className="mt-2">
                        <IconButton aria-label="Premakni izdelek" {...dragProps}>⋮⋮</IconButton>
                      </div>
                    </article>
                  );
                }}
              </SortableItem>
            ))}
          </div>
        </SortableContext>
      </DndContext>
    </div>
  );
}
