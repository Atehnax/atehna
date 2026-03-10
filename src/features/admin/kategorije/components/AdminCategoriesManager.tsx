'use client';

import { useEffect, useMemo, useState } from 'react';
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
  rectSortingStrategy,
  verticalListSortingStrategy,
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
import { FloatingInput, FloatingTextarea } from '@/shared/ui/floating-field';
import { useToast } from '@/shared/ui/toast';

type CatalogData = { categories: CatalogCategory[] };
type SelectedNode =
  | { kind: 'root' }
  | { kind: 'category'; categorySlug: string }
  | { kind: 'subcategory'; categorySlug: string; subcategorySlug: string };

type TreeNodeData = {
  id: string;
  title: string;
  kind: 'category' | 'subcategory';
  categorySlug: string;
  subcategorySlug?: string;
  children?: TreeNodeData[];
};

const slugify = (value: string) =>
  value
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-čšžćđ]/gi, '');

function SortableSurface({
  id,
  children
}: {
  id: string;
  children: (props: { draggableProps: Record<string, unknown> }) => React.ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id });
  const style = { transform: CSS.Transform.toString(transform), transition };

  return (
    <div ref={setNodeRef} style={style}>
      {children({ draggableProps: { ...attributes, ...listeners } })}
    </div>
  );
}

function preventDragFromField(event: React.PointerEvent<HTMLElement>) {
  event.stopPropagation();
}

export default function AdminCategoriesManager() {
  const [catalog, setCatalog] = useState<CatalogData>({ categories: [] });
  const [selected, setSelected] = useState<SelectedNode>({ kind: 'root' });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingTreeNode, setEditingTreeNode] = useState<string | null>(null);
  const [treeDraftTitle, setTreeDraftTitle] = useState('');
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

  const tree = useMemo<TreeNodeData[]>(
    () =>
      catalog.categories.map((category) => ({
        id: `cat:${category.slug}`,
        title: category.title,
        kind: 'category',
        categorySlug: category.slug,
        children: category.subcategories.map((subcategory) => ({
          id: `sub:${category.slug}:${subcategory.slug}`,
          title: subcategory.title,
          kind: 'subcategory',
          categorySlug: category.slug,
          subcategorySlug: subcategory.slug
        }))
      })),
    [catalog.categories]
  );

  const selectedContext = useMemo(() => {
    if (selected.kind === 'root') return { kind: 'root' as const };
    const category = catalog.categories.find((entry) => entry.slug === selected.categorySlug);
    if (!category) return null;
    if (selected.kind === 'category') return { kind: 'category' as const, category };
    const subcategory = category.subcategories.find((entry) => entry.slug === selected.subcategorySlug);
    if (!subcategory) return null;
    return { kind: 'subcategory' as const, category, subcategory };
  }, [catalog.categories, selected]);

  const isSelectedNode = (node: TreeNodeData) =>
    (node.kind === 'category' &&
      selected.kind === 'category' &&
      selected.categorySlug === node.categorySlug) ||
    (node.kind === 'subcategory' &&
      selected.kind === 'subcategory' &&
      selected.categorySlug === node.categorySlug &&
      selected.subcategorySlug === node.subcategorySlug);

  const updateCategory = (categorySlug: string, patch: Partial<CatalogCategory>) => {
    const next = {
      categories: catalog.categories.map((entry) =>
        entry.slug === categorySlug ? { ...entry, ...patch } : entry
      )
    };
    void persist(next);
  };

  const updateSubcategory = (
    categorySlug: string,
    subcategorySlug: string,
    patch: Partial<CatalogSubcategory>
  ) => {
    const next = {
      categories: catalog.categories.map((entry) => {
        if (entry.slug !== categorySlug) return entry;
        return {
          ...entry,
          subcategories: entry.subcategories.map((subcategory) =>
            subcategory.slug === subcategorySlug ? { ...subcategory, ...patch } : subcategory
          )
        };
      })
    };
    void persist(next);
  };

  const renameTreeNode = (node: TreeNodeData, title: string) => {
    const nextSlug = slugify(title);
    if (!nextSlug) return;

    if (node.kind === 'category') {
      const next = {
        categories: catalog.categories.map((entry) =>
          entry.slug === node.categorySlug ? { ...entry, title, slug: nextSlug } : entry
        )
      };
      setSelected({ kind: 'category', categorySlug: nextSlug });
      void persist(next);
      return;
    }

    const next = {
      categories: catalog.categories.map((entry) => {
        if (entry.slug !== node.categorySlug) return entry;
        return {
          ...entry,
          subcategories: entry.subcategories.map((subcategory) =>
            subcategory.slug === node.subcategorySlug ? { ...subcategory, title, slug: nextSlug } : subcategory
          )
        };
      })
    };
    setSelected({ kind: 'subcategory', categorySlug: node.categorySlug, subcategorySlug: nextSlug });
    void persist(next);
  };

  const startEditTreeNode = (node: TreeNodeData) => {
    setEditingTreeNode(node.id);
    setTreeDraftTitle(node.title);
  };

  const submitTreeNodeRename = (node: TreeNodeData) => {
    const nextTitle = treeDraftTitle.trim();
    if (!nextTitle || nextTitle === node.title) {
      setEditingTreeNode(null);
      return;
    }
    renameTreeNode(node, nextTitle);
    setEditingTreeNode(null);
  };

  const addNode = (kind: 'category' | 'subcategory', categorySlug?: string) => {
    const name = window.prompt(kind === 'category' ? 'Ime nove kategorije' : 'Ime nove podkategorije');
    if (!name) return;
    const slug = slugify(name);
    if (!slug) return;

    if (kind === 'category') {
      const nextCategory: CatalogCategory = {
        slug,
        title: name,
        summary: name,
        description: '',
        image: '/images/categories/metal-plates.svg',
        subcategories: [],
        items: []
      };
      void persist({ categories: [...catalog.categories, nextCategory] }, 'Nova kategorija dodana');
      return;
    }

    if (!categorySlug) return;
    const next = {
      categories: catalog.categories.map((category) =>
        category.slug === categorySlug
          ? {
              ...category,
              subcategories: [
                ...category.subcategories,
                { slug, title: name, description: '', image: '', items: [] }
              ]
            }
          : category
      )
    };
    void persist(next, 'Nova podkategorija dodana');
  };

  const removeNode = (node: TreeNodeData) => {
    const ok = window.confirm(`Odstranim ${node.title}?`);
    if (!ok) return;

    if (node.kind === 'category') {
      void persist(
        { categories: catalog.categories.filter((entry) => entry.slug !== node.categorySlug) },
        'Kategorija odstranjena'
      );
      setSelected({ kind: 'root' });
      return;
    }

    const next = {
      categories: catalog.categories.map((entry) => {
        if (entry.slug !== node.categorySlug) return entry;
        return {
          ...entry,
          subcategories: entry.subcategories.filter((sub) => sub.slug !== node.subcategorySlug)
        };
      })
    };
    setSelected({ kind: 'category', categorySlug: node.categorySlug });
    void persist(next, 'Podkategorija odstranjena');
  };

  const onProductsDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id || !selectedContext || selectedContext.kind === 'root') return;

    if (selectedContext.kind === 'category') {
      const items = sortCatalogItems(selectedContext.category.items ?? []);
      const oldIndex = items.findIndex((entry) => entry.slug === active.id);
      const newIndex = items.findIndex((entry) => entry.slug === over.id);
      if (oldIndex < 0 || newIndex < 0) return;
      const reordered = arrayMove(items, oldIndex, newIndex).map((item, index) => ({
        ...item,
        displayOrder: index + 1
      }));
      const next = {
        categories: catalog.categories.map((entry) =>
          entry.slug === selectedContext.category.slug ? { ...entry, items: reordered } : entry
        )
      };
      void persist(next, 'Vrstni red izdelkov posodobljen');
      return;
    }

    const items = sortCatalogItems(selectedContext.subcategory.items);
    const oldIndex = items.findIndex((entry) => entry.slug === active.id);
    const newIndex = items.findIndex((entry) => entry.slug === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    const reordered = arrayMove(items, oldIndex, newIndex).map((item, index) => ({
      ...item,
      displayOrder: index + 1
    }));
    const next = {
      categories: catalog.categories.map((entry) => {
        if (entry.slug !== selectedContext.category.slug) return entry;
        return {
          ...entry,
          subcategories: entry.subcategories.map((sub) =>
            sub.slug === selectedContext.subcategory.slug ? { ...sub, items: reordered } : sub
          )
        };
      })
    };
    void persist(next, 'Vrstni red izdelkov posodobljen');
  };

  const onCategoryListDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id || selected.kind !== 'root') return;
    const oldIndex = catalog.categories.findIndex((entry) => entry.slug === active.id);
    const newIndex = catalog.categories.findIndex((entry) => entry.slug === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    const reordered = arrayMove(catalog.categories, oldIndex, newIndex);
    void persist({ categories: reordered }, 'Vrstni red kategorij posodobljen');
  };

  const onSubcategoryDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id || selectedContext?.kind !== 'category') return;
    const subcategories = selectedContext.category.subcategories;
    const oldIndex = subcategories.findIndex((entry) => entry.slug === active.id);
    const newIndex = subcategories.findIndex((entry) => entry.slug === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    const reordered = arrayMove(subcategories, oldIndex, newIndex);
    const next = {
      categories: catalog.categories.map((entry) =>
        entry.slug === selectedContext.category.slug ? { ...entry, subcategories: reordered } : entry
      )
    };
    void persist(next, 'Vrstni red podkategorij posodobljen');
  };

  if (loading) return <p className="text-sm text-slate-500">Nalagam kategorije ...</p>;

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl font-semibold text-slate-900">Kategorije</h1>
        <p className="mt-1 text-sm text-slate-600">
          Urejanje strukture kategorij in storefront predogled v admin načinu.
        </p>
      </header>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Drevo kategorij</p>
          <Button variant="outline" size="sm" onClick={() => addNode('category')}>
            + Kategorija
          </Button>
        </div>

        <div className="mt-4">
          <button
            type="button"
            onClick={() => setSelected({ kind: 'root' })}
            className={`w-full rounded-xl border px-3 py-2 text-left text-sm transition ${
              selected.kind === 'root'
                ? 'border-brand-300 bg-brand-50 text-brand-700'
                : 'border-slate-200 text-slate-700 hover:border-brand-200'
            }`}
          >
            Vse kategorije
          </button>

          <ul className="mt-3 space-y-2">
            {tree.map((node) => (
              <TreeNode
                key={node.id}
                node={node}
                isSelected={isSelectedNode}
                editingTreeNode={editingTreeNode}
                treeDraftTitle={treeDraftTitle}
                onSelect={(entry) =>
                  setSelected(
                    entry.kind === 'category'
                      ? { kind: 'category', categorySlug: entry.categorySlug }
                      : {
                          kind: 'subcategory',
                          categorySlug: entry.categorySlug,
                          subcategorySlug: entry.subcategorySlug ?? ''
                        }
                  )
                }
                onStartEdit={startEditTreeNode}
                onTreeDraftChange={setTreeDraftTitle}
                onRename={submitTreeNodeRename}
                onAddChild={(entry) => addNode('subcategory', entry.categorySlug)}
                onRemove={removeNode}
              />
            ))}
          </ul>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Predogled strani (admin)</p>
          <p className="text-xs text-slate-400">{saving ? 'Shranjujem ...' : 'Spremembe se shranjujejo sproti.'}</p>
        </div>

        {selectedContext?.kind === 'root' ? (
          <>
            <h2 className="mt-4 text-2xl font-semibold text-slate-900">Vse kategorije</h2>
            <p className="mt-2 text-sm text-slate-600">Top-level storefront pregled kategorij z urejanjem in razvrščanjem.</p>
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onCategoryListDragEnd}>
              <SortableContext items={catalog.categories.map((entry) => entry.slug)} strategy={rectSortingStrategy}>
                <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {catalog.categories.map((category) => (
                    <SortableSurface key={category.slug} id={category.slug}>
                      {({ draggableProps }) => (
                        <div
                          {...draggableProps}
                          className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
                        >
                          <div className="relative h-32">
                            <Image src={category.image} alt={category.title} fill className="object-cover" />
                          </div>
                          <div className="space-y-3 p-4">
                            <div onPointerDownCapture={preventDragFromField}>
                              <FloatingInput
                                id={`category-title-${category.slug}`}
                                tone="admin"
                                label="Naziv"
                                value={category.title}
                                onChange={(event) => updateCategory(category.slug, { title: event.target.value })}
                              />
                            </div>
                            <div onPointerDownCapture={preventDragFromField}>
                              <FloatingTextarea
                                id={`category-summary-${category.slug}`}
                                tone="admin"
                                label="Kratek opis"
                                value={category.summary}
                                onChange={(event) => updateCategory(category.slug, { summary: event.target.value })}
                                className="min-h-[90px]"
                              />
                            </div>
                            <div onPointerDownCapture={preventDragFromField}>
                              <FloatingInput
                                id={`category-image-${category.slug}`}
                                tone="admin"
                                label="Slika kategorije URL"
                                value={category.image}
                                onChange={(event) => updateCategory(category.slug, { image: event.target.value })}
                              />
                            </div>
                            <p className="text-xs text-slate-500">Povlecite kartico po praznem delu za spremembo vrstnega reda.</p>
                          </div>
                        </div>
                      )}
                    </SortableSurface>
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          </>
        ) : null}

        {selectedContext?.kind === 'category' ? (
          <>
            <div className="mt-4 grid gap-4 lg:grid-cols-[2fr_1fr]">
              <div className="space-y-3">
                <h2 className="text-2xl font-semibold text-slate-900">{selectedContext.category.title}</h2>
                <div onPointerDownCapture={preventDragFromField}>
                  <FloatingTextarea
                    id={`description-${selectedContext.category.slug}`}
                    tone="admin"
                    label="Opis kategorije"
                    value={selectedContext.category.description}
                    onChange={(event) =>
                      updateCategory(selectedContext.category.slug, { description: event.target.value })
                    }
                    className="min-h-[120px]"
                  />
                </div>
                <div onPointerDownCapture={preventDragFromField}>
                  <FloatingInput
                    id={`image-${selectedContext.category.slug}`}
                    tone="admin"
                    label="Slika kategorije URL"
                    value={selectedContext.category.image}
                    onChange={(event) => updateCategory(selectedContext.category.slug, { image: event.target.value })}
                  />
                </div>
                <div onPointerDownCapture={preventDragFromField}>
                  <FloatingInput
                    id={`banner-${selectedContext.category.slug}`}
                    tone="admin"
                    label="Banner URL"
                    value={selectedContext.category.bannerImage ?? ''}
                    onChange={(event) =>
                      updateCategory(selectedContext.category.slug, { bannerImage: event.target.value })
                    }
                  />
                </div>
              </div>
              <div className="relative h-48 overflow-hidden rounded-2xl border border-slate-200 bg-slate-50">
                <Image
                  src={selectedContext.category.bannerImage || selectedContext.category.image}
                  alt={selectedContext.category.title}
                  fill
                  className="object-cover"
                />
              </div>
            </div>

            {selectedContext.category.subcategories.length > 0 ? (
              <>
                <p className="mt-6 text-sm font-semibold text-slate-900">Podkategorije (drag & drop)</p>
                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onSubcategoryDragEnd}>
                  <SortableContext
                    items={selectedContext.category.subcategories.map((entry) => entry.slug)}
                    strategy={verticalListSortingStrategy}
                  >
                    <div className="mt-3 space-y-3">
                      {selectedContext.category.subcategories.map((subcategory) => (
                        <SortableSurface key={subcategory.slug} id={subcategory.slug}>
                          {({ draggableProps }) => (
                            <div {...draggableProps} className="rounded-xl border border-slate-200 bg-white p-4">
                              <div className="grid gap-3 md:grid-cols-[2fr_1fr]">
                                <div className="space-y-3">
                                  <div onPointerDownCapture={preventDragFromField}>
                                    <FloatingInput
                                      id={`sub-title-${subcategory.slug}`}
                                      tone="admin"
                                      label="Naziv podkategorije"
                                      value={subcategory.title}
                                      onChange={(event) =>
                                        updateSubcategory(selectedContext.category.slug, subcategory.slug, {
                                          title: event.target.value
                                        })
                                      }
                                    />
                                  </div>
                                  <div onPointerDownCapture={preventDragFromField}>
                                    <FloatingTextarea
                                      id={`sub-desc-${subcategory.slug}`}
                                      tone="admin"
                                      label="Opis"
                                      value={subcategory.description}
                                      onChange={(event) =>
                                        updateSubcategory(selectedContext.category.slug, subcategory.slug, {
                                          description: event.target.value
                                        })
                                      }
                                    />
                                  </div>
                                  <div onPointerDownCapture={preventDragFromField}>
                                    <FloatingInput
                                      id={`sub-image-${subcategory.slug}`}
                                      tone="admin"
                                      label="Slika podkategorije URL"
                                      value={subcategory.image ?? ''}
                                      onChange={(event) =>
                                        updateSubcategory(selectedContext.category.slug, subcategory.slug, {
                                          image: event.target.value
                                        })
                                      }
                                    />
                                  </div>
                                </div>
                                <div className="flex items-end justify-end gap-2" onPointerDownCapture={preventDragFromField}>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() =>
                                      setSelected({
                                        kind: 'subcategory',
                                        categorySlug: selectedContext.category.slug,
                                        subcategorySlug: subcategory.slug
                                      })
                                    }
                                  >
                                    Odpri stran
                                  </Button>
                                </div>
                              </div>
                              <p className="mt-2 text-xs text-slate-500">Povlecite kartico po praznem delu za spremembo vrstnega reda.</p>
                            </div>
                          )}
                        </SortableSurface>
                      ))}
                    </div>
                  </SortableContext>
                </DndContext>
              </>
            ) : (
              <ProductOrdering
                category={selectedContext.category}
                items={sortCatalogItems(selectedContext.category.items ?? [])}
                onDragEnd={onProductsDragEnd}
              />
            )}
          </>
        ) : null}

        {selectedContext?.kind === 'subcategory' ? (
          <>
            <div className="mt-4 max-w-3xl space-y-3">
              <p className="text-sm font-semibold uppercase tracking-widest text-brand-600">{selectedContext.category.title}</p>
              <div onPointerDownCapture={preventDragFromField}>
                <FloatingInput
                  id={`sub-edit-title-${selectedContext.subcategory.slug}`}
                  tone="admin"
                  label="Naziv podkategorije"
                  value={selectedContext.subcategory.title}
                  onChange={(event) =>
                    updateSubcategory(selectedContext.category.slug, selectedContext.subcategory.slug, {
                      title: event.target.value
                    })
                  }
                />
              </div>
              <div onPointerDownCapture={preventDragFromField}>
                <FloatingTextarea
                  id={`sub-edit-description-${selectedContext.subcategory.slug}`}
                  tone="admin"
                  label="Opis"
                  value={selectedContext.subcategory.description}
                  onChange={(event) =>
                    updateSubcategory(selectedContext.category.slug, selectedContext.subcategory.slug, {
                      description: event.target.value
                    })
                  }
                  className="min-h-[110px]"
                />
              </div>
              <div onPointerDownCapture={preventDragFromField}>
                <FloatingInput
                  id={`sub-edit-image-${selectedContext.subcategory.slug}`}
                  tone="admin"
                  label="Slika URL"
                  value={selectedContext.subcategory.image ?? ''}
                  onChange={(event) =>
                    updateSubcategory(selectedContext.category.slug, selectedContext.subcategory.slug, {
                      image: event.target.value
                    })
                  }
                />
              </div>
            </div>
            <ProductOrdering
              category={selectedContext.category}
              subcategory={selectedContext.subcategory}
              items={sortCatalogItems(selectedContext.subcategory.items)}
              onDragEnd={onProductsDragEnd}
            />
          </>
        ) : null}
      </section>
    </div>
  );
}

function TreeNode({
  node,
  isSelected,
  editingTreeNode,
  treeDraftTitle,
  onSelect,
  onStartEdit,
  onTreeDraftChange,
  onRename,
  onAddChild,
  onRemove
}: {
  node: TreeNodeData;
  isSelected: (node: TreeNodeData) => boolean;
  editingTreeNode: string | null;
  treeDraftTitle: string;
  onSelect: (node: TreeNodeData) => void;
  onStartEdit: (node: TreeNodeData) => void;
  onTreeDraftChange: (value: string) => void;
  onRename: (node: TreeNodeData) => void;
  onAddChild: (node: TreeNodeData) => void;
  onRemove: (node: TreeNodeData) => void;
}) {
  return (
    <li>
      <div className="relative rounded-xl border border-slate-200 bg-slate-50/30 p-2">
        <div className="absolute -left-3 top-1/2 h-px w-3 bg-slate-300" />
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onSelect(node)}
            className={`flex-1 rounded-md px-2 py-1 text-left text-sm transition ${
              isSelected(node)
                ? 'bg-brand-50 font-semibold text-brand-700'
                : 'text-slate-700 hover:bg-white'
            }`}
          >
            {node.title}
          </button>
          <Button variant="ghost" size="sm" onClick={() => onStartEdit(node)}>
            ✎
          </Button>
          <Button variant="ghost" size="sm" onClick={() => onAddChild(node)}>
            +
          </Button>
          <Button variant="ghost" size="sm" onClick={() => onRemove(node)}>
            −
          </Button>
        </div>

        {editingTreeNode === node.id ? (
          <div className="mt-2 flex items-center gap-2">
            <FloatingInput
              id={`tree-edit-${node.id}`}
              tone="admin"
              label="Naziv"
              value={treeDraftTitle}
              onChange={(event) => onTreeDraftChange(event.target.value)}
            />
            <Button variant="outline" size="sm" onClick={() => onRename(node)}>
              Shrani
            </Button>
          </div>
        ) : null}
      </div>

      {node.children && node.children.length > 0 ? (
        <ul className="ml-6 mt-2 space-y-2 border-l border-slate-300 pl-4">
          {node.children.map((child) => (
            <TreeNode
              key={child.id}
              node={child}
              isSelected={isSelected}
              editingTreeNode={editingTreeNode}
              treeDraftTitle={treeDraftTitle}
              onSelect={onSelect}
              onStartEdit={onStartEdit}
              onTreeDraftChange={onTreeDraftChange}
              onRename={onRename}
              onAddChild={onAddChild}
              onRemove={onRemove}
            />
          ))}
        </ul>
      ) : null}
    </li>
  );
}

function ProductOrdering({
  category,
  subcategory,
  items,
  onDragEnd
}: {
  category: CatalogCategory;
  subcategory?: CatalogSubcategory;
  items: CatalogItem[];
  onDragEnd: (event: DragEndEvent) => void;
}) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  return (
    <div className="mt-6">
      <p className="text-sm font-semibold text-slate-900">Izdelki (drag & drop)</p>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={items.map((item) => item.slug)} strategy={verticalListSortingStrategy}>
          <div className="mt-3 space-y-3">
            {items.map((item) => (
              <SortableSurface key={item.slug} id={item.slug}>
                {({ draggableProps }) => {
                  const basePrice = subcategory
                    ? item.price ?? getCatalogItemPrice(category.slug, subcategory.slug, item.slug)
                    : item.price ?? getCatalogCategoryItemPrice(category.slug, item.slug);
                  const finalPrice = getDiscountedPrice(basePrice, item.discountPct);
                  return (
                    <div {...draggableProps} className="rounded-xl border border-slate-200 bg-white p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-slate-900">{item.name}</p>
                          <p className="mt-1 text-xs text-slate-600">{item.description}</p>
                          <p className="mt-2 text-xs font-semibold text-slate-900">{formatCatalogPrice(finalPrice)}</p>
                          <p className="mt-1 text-[11px] text-slate-500">
                            SKU:{' '}
                            {subcategory
                              ? getCatalogItemSku(category.slug, subcategory.slug, item.slug)
                              : getCatalogCategoryItemSku(category.slug, item.slug)}
                          </p>
                        </div>
                        <p className="text-xs text-slate-500">Povleci</p>
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
