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
  type DragEndEvent,
  type DragStartEvent
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

const ROOT_DROP_ID = 'tree-root-drop';

const slugify = (value: string) =>
  value
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-čšžćđ]/gi, '');

const categoryTreeId = (slug: string) => `cat:${slug}`;
const subTreeId = (categorySlug: string, subSlug: string) => `sub:${categorySlug}:${subSlug}`;
const dropCategoryId = (categorySlug: string) => `drop:cat:${categorySlug}`;

const parseTreeId = (id: string): { kind: 'category' | 'subcategory'; categorySlug: string; subSlug?: string } | null => {
  if (id.startsWith('cat:')) return { kind: 'category', categorySlug: id.slice(4) };
  if (id.startsWith('sub:')) {
    const [, categorySlug, subSlug] = id.split(':');
    if (!categorySlug || !subSlug) return null;
    return { kind: 'subcategory', categorySlug, subSlug };
  }
  return null;
};

const parseDropCategoryId = (id: string): string | null => {
  if (!id.startsWith('drop:cat:')) return null;
  return id.slice('drop:cat:'.length);
};

function SortableSurface({
  id,
  children,
  className
}: {
  id: string;
  children: (props: { draggableProps: Record<string, unknown> }) => ReactNode;
  className?: string;
}) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id });
  const style = { transform: CSS.Transform.toString(transform), transition };

  return (
    <div ref={setNodeRef} style={style} className={className}>
      {children({ draggableProps: { ...attributes, ...listeners } })}
    </div>
  );
}

function TreeDropZone({ id, children }: { id: string; children: ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <div ref={setNodeRef} className={isOver ? 'rounded-lg bg-brand-50/60' : ''}>
      {children}
    </div>
  );
}

function stopDragFromField(event: React.PointerEvent<HTMLElement>) {
  event.stopPropagation();
}

export default function AdminCategoriesManager() {
  const [catalog, setCatalog] = useState<CatalogData>({ categories: [] });
  const [selected, setSelected] = useState<SelectedNode>({ kind: 'root' });
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({});
  const [activeTreeId, setActiveTreeId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingTreeId, setEditingTreeId] = useState<string | null>(null);
  const [treeDraftTitle, setTreeDraftTitle] = useState('');
  const { toast } = useToast();
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

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
    setExpandedCategories(Object.fromEntries(payload.categories.map((entry) => [entry.slug, true])));
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

  const selectedContext = useMemo(() => {
    if (selected.kind === 'root') return { kind: 'root' as const };
    const category = catalog.categories.find((entry) => entry.slug === selected.categorySlug);
    if (!category) return null;
    if (selected.kind === 'category') return { kind: 'category' as const, category };
    const subcategory = category.subcategories.find((entry) => entry.slug === selected.subcategorySlug);
    if (!subcategory) return null;
    return { kind: 'subcategory' as const, category, subcategory };
  }, [catalog.categories, selected]);

  const selectTreeNode = (id: string) => {
    const parsed = parseTreeId(id);
    if (!parsed) return;
    if (parsed.kind === 'category') {
      setSelected({ kind: 'category', categorySlug: parsed.categorySlug });
      return;
    }
    setSelected({ kind: 'subcategory', categorySlug: parsed.categorySlug, subcategorySlug: parsed.subSlug ?? '' });
  };


  const updateSubcategory = (
    categorySlug: string,
    subcategorySlug: string,
    patch: Partial<CatalogSubcategory>
  ) => {
    const next = {
      categories: catalog.categories.map((entry) =>
        entry.slug === categorySlug
          ? {
              ...entry,
              subcategories: entry.subcategories.map((sub) =>
                sub.slug === subcategorySlug ? { ...sub, ...patch } : sub
              )
            }
          : entry
      )
    };
    void persist(next);
  };

  const renameTreeNode = (id: string, nextTitle: string) => {
    const parsed = parseTreeId(id);
    const title = nextTitle.trim();
    const nextSlug = slugify(title);
    if (!parsed || !title || !nextSlug) return;

    if (parsed.kind === 'category') {
      const next = {
        categories: catalog.categories.map((entry) =>
          entry.slug === parsed.categorySlug ? { ...entry, slug: nextSlug, title } : entry
        )
      };
      setSelected({ kind: 'category', categorySlug: nextSlug });
      void persist(next);
      return;
    }

    const next = {
      categories: catalog.categories.map((entry) =>
        entry.slug === parsed.categorySlug
          ? {
              ...entry,
              subcategories: entry.subcategories.map((sub) =>
                sub.slug === parsed.subSlug ? { ...sub, slug: nextSlug, title } : sub
              )
            }
          : entry
      )
    };
    setSelected({ kind: 'subcategory', categorySlug: parsed.categorySlug, subcategorySlug: nextSlug });
    void persist(next);
  };

  const addCategory = (siblingAfter?: string) => {
    const name = window.prompt('Ime nove kategorije');
    if (!name) return;
    const slug = slugify(name);
    if (!slug) return;
    const nextCategory: CatalogCategory = {
      slug,
      title: name,
      summary: name,
      description: '',
      image: '/images/categories/metal-plates.svg',
      subcategories: [],
      items: []
    };

    if (!siblingAfter) {
      void persist({ categories: [...catalog.categories, nextCategory] }, 'Nova kategorija dodana');
      return;
    }

    const index = catalog.categories.findIndex((entry) => entry.slug === siblingAfter);
    if (index < 0) {
      void persist({ categories: [...catalog.categories, nextCategory] }, 'Nova kategorija dodana');
      return;
    }

    const cloned = [...catalog.categories];
    cloned.splice(index + 1, 0, nextCategory);
    void persist({ categories: cloned }, 'Nova kategorija dodana');
  };

  const addSubcategory = (categorySlug: string, siblingAfter?: string) => {
    const name = window.prompt('Ime nove podkategorije');
    if (!name) return;
    const slug = slugify(name);
    if (!slug) return;

    const next = {
      categories: catalog.categories.map((entry) => {
        if (entry.slug !== categorySlug) return entry;
        const children = [...entry.subcategories];
        const nextSub: CatalogSubcategory = { slug, title: name, description: '', image: '', items: [] };
        if (!siblingAfter) {
          children.push(nextSub);
        } else {
          const siblingIndex = children.findIndex((item) => item.slug === siblingAfter);
          if (siblingIndex < 0) children.push(nextSub);
          else children.splice(siblingIndex + 1, 0, nextSub);
        }
        return { ...entry, subcategories: children };
      })
    };

    void persist(next, 'Nova podkategorija dodana');
  };

  const removeNode = (id: string) => {
    const parsed = parseTreeId(id);
    if (!parsed) return;
    const ok = window.confirm('Odstranim izbrano kategorijo?');
    if (!ok) return;

    if (parsed.kind === 'category') {
      const next = { categories: catalog.categories.filter((entry) => entry.slug !== parsed.categorySlug) };
      setSelected({ kind: 'root' });
      void persist(next, 'Kategorija odstranjena');
      return;
    }

    const next = {
      categories: catalog.categories.map((entry) =>
        entry.slug === parsed.categorySlug
          ? { ...entry, subcategories: entry.subcategories.filter((sub) => sub.slug !== parsed.subSlug) }
          : entry
      )
    };
    setSelected({ kind: 'category', categorySlug: parsed.categorySlug });
    void persist(next, 'Podkategorija odstranjena');
  };

  const onTreeDragStart = (event: DragStartEvent) => {
    setActiveTreeId(String(event.active.id));
  };

  const onTreeDragEnd = (event: DragEndEvent) => {
    setActiveTreeId(null);
    const activeId = String(event.active.id);
    const overId = event.over ? String(event.over.id) : null;
    if (!overId || activeId === overId) return;

    const activeParsed = parseTreeId(activeId);
    const overParsed = parseTreeId(overId);
    const overDropCategory = parseDropCategoryId(overId);
    if (!activeParsed) return;

    if (activeParsed.kind === 'category') {
      if (!overParsed || overParsed.kind !== 'category') return;
      const oldIndex = catalog.categories.findIndex((entry) => entry.slug === activeParsed.categorySlug);
      const newIndex = catalog.categories.findIndex((entry) => entry.slug === overParsed.categorySlug);
      if (oldIndex < 0 || newIndex < 0) return;
      const reordered = arrayMove(catalog.categories, oldIndex, newIndex);
      void persist({ categories: reordered }, 'Premaknjena kategorija');
      return;
    }

    const fromCategory = activeParsed.categorySlug;
    const fromSub = activeParsed.subSlug ?? '';

    let toCategory = fromCategory;
    let targetIndex: number | null = null;

    if (overDropCategory) {
      toCategory = overDropCategory;
    } else if (overParsed?.kind === 'subcategory') {
      toCategory = overParsed.categorySlug;
      const targetCategory = catalog.categories.find((entry) => entry.slug === toCategory);
      targetIndex = targetCategory?.subcategories.findIndex((entry) => entry.slug === overParsed.subSlug) ?? null;
    } else if (overParsed?.kind === 'category') {
      toCategory = overParsed.categorySlug;
    } else {
      return;
    }

    const sourceCategory = catalog.categories.find((entry) => entry.slug === fromCategory);
    const targetCategory = catalog.categories.find((entry) => entry.slug === toCategory);
    if (!sourceCategory || !targetCategory) return;

    const moving = sourceCategory.subcategories.find((entry) => entry.slug === fromSub);
    if (!moving) return;

    const next = {
      categories: catalog.categories.map((entry) => {
        if (entry.slug === fromCategory && entry.slug === toCategory) {
          const items = [...entry.subcategories];
          const oldIndex = items.findIndex((item) => item.slug === fromSub);
          const newIndex = targetIndex ?? items.length - 1;
          if (oldIndex < 0) return entry;
          return { ...entry, subcategories: arrayMove(items, oldIndex, Math.max(0, newIndex)) };
        }

        if (entry.slug === fromCategory) {
          return { ...entry, subcategories: entry.subcategories.filter((item) => item.slug !== fromSub) };
        }

        if (entry.slug === toCategory) {
          const items = [...entry.subcategories];
          const insertIndex = targetIndex === null || targetIndex < 0 ? items.length : targetIndex;
          items.splice(insertIndex, 0, moving);
          return { ...entry, subcategories: items };
        }

        return entry;
      })
    };

    setExpandedCategories((prev) => ({ ...prev, [toCategory]: true }));
    setSelected({ kind: 'subcategory', categorySlug: toCategory, subcategorySlug: moving.slug });
    void persist(next, 'Premaknjena podkategorija');
  };

  const onChildrenOrderDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    if (selected.kind === 'root') {
      const oldIndex = catalog.categories.findIndex((entry) => entry.slug === active.id);
      const newIndex = catalog.categories.findIndex((entry) => entry.slug === over.id);
      if (oldIndex < 0 || newIndex < 0) return;
      const reordered = arrayMove(catalog.categories, oldIndex, newIndex);
      void persist({ categories: reordered }, 'Vrstni red kategorij posodobljen');
      return;
    }

    if (selected.kind === 'category') {
      const category = catalog.categories.find((entry) => entry.slug === selected.categorySlug);
      if (!category || category.subcategories.length === 0) return;
      const oldIndex = category.subcategories.findIndex((entry) => entry.slug === active.id);
      const newIndex = category.subcategories.findIndex((entry) => entry.slug === over.id);
      if (oldIndex < 0 || newIndex < 0) return;
      const reordered = arrayMove(category.subcategories, oldIndex, newIndex);
      const next = {
        categories: catalog.categories.map((entry) =>
          entry.slug === selected.categorySlug ? { ...entry, subcategories: reordered } : entry
        )
      };
      void persist(next, 'Vrstni red podkategorij posodobljen');
    }
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
    const reordered = arrayMove(items, oldIndex, newIndex).map((item, index) => ({ ...item, displayOrder: index + 1 }));
    const next = {
      categories: catalog.categories.map((entry) =>
        entry.slug === selectedContext.category.slug
          ? {
              ...entry,
              subcategories: entry.subcategories.map((sub) =>
                sub.slug === selectedContext.subcategory.slug ? { ...sub, items: reordered } : sub
              )
            }
          : entry
      )
    };
    void persist(next, 'Vrstni red izdelkov posodobljen');
  };

  if (loading) return <p className="text-sm text-slate-500">Nalagam kategorije ...</p>;

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl font-semibold text-slate-900">Kategorije</h1>
        <p className="mt-1 text-sm text-slate-600">Top: drevo strukture. Bottom: vsebina izbrane kategorije.</p>
      </header>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-3 flex items-center justify-between">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Drevo kategorij</p>
          <Button variant="outline" size="sm" onClick={() => addCategory()}>
            + Kategorija
          </Button>
        </div>

        <TreeDropZone id={ROOT_DROP_ID}>
          <button
            type="button"
            onClick={() => setSelected({ kind: 'root' })}
            className={`mb-3 w-full rounded-xl border px-3 py-2 text-left text-sm ${
              selected.kind === 'root' ? 'border-brand-300 bg-brand-50 text-brand-700' : 'border-slate-200 text-slate-700'
            }`}
          >
            Vse kategorije
          </button>
        </TreeDropZone>

        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={onTreeDragStart} onDragEnd={onTreeDragEnd}>
          <SortableContext items={catalog.categories.map((entry) => categoryTreeId(entry.slug))} strategy={verticalListSortingStrategy}>
            <ul className="space-y-2">
              {catalog.categories.map((category) => {
                const catId = categoryTreeId(category.slug);
                const expanded = expandedCategories[category.slug] ?? true;
                return (
                  <li key={category.slug}>
                    <SortableSurface id={catId}>
                      {({ draggableProps }) => (
                        <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-2">
                          <div className="flex items-center gap-2" {...draggableProps}>
                            <button
                              type="button"
                              className="rounded-md border border-slate-300 px-2 text-xs"
                              onClick={(event) => {
                                event.stopPropagation();
                                setExpandedCategories((prev) => ({ ...prev, [category.slug]: !expanded }));
                              }}
                            >
                              {expanded ? '−' : '+'}
                            </button>
                            <button
                              type="button"
                              onClick={() => selectTreeNode(catId)}
                              className={`flex-1 rounded-md px-2 py-1 text-left text-sm ${
                                selected.kind === 'category' && selected.categorySlug === category.slug
                                  ? 'bg-brand-50 font-semibold text-brand-700'
                                  : 'text-slate-700'
                              }`}
                            >
                              {category.title}
                            </button>
                            <Button variant="ghost" size="sm" onClick={() => { setEditingTreeId(catId); setTreeDraftTitle(category.title); }}>✎</Button>
                            <Button variant="ghost" size="sm" onClick={() => addCategory(category.slug)}>+⟷</Button>
                            <Button variant="ghost" size="sm" onClick={() => addSubcategory(category.slug)}>+↓</Button>
                            <Button variant="ghost" size="sm" onClick={() => removeNode(catId)}>−</Button>
                          </div>

                          {editingTreeId === catId ? (
                            <div className="mt-2 flex items-center gap-2">
                              <FloatingInput id={`rename-${catId}`} tone="admin" label="Naziv" value={treeDraftTitle} onChange={(event) => setTreeDraftTitle(event.target.value)} />
                              <Button variant="outline" size="sm" onClick={() => { renameTreeNode(catId, treeDraftTitle); setEditingTreeId(null); }}>Shrani</Button>
                            </div>
                          ) : null}

                          {expanded ? (
                            <div className="ml-6 mt-2 border-l border-slate-300 pl-3">
                              <TreeDropZone id={dropCategoryId(category.slug)}>
                                <SortableContext items={category.subcategories.map((entry) => subTreeId(category.slug, entry.slug))} strategy={verticalListSortingStrategy}>
                                  <ul className="space-y-1">
                                    {category.subcategories.map((sub) => {
                                      const subId = subTreeId(category.slug, sub.slug);
                                      return (
                                        <li key={subId}>
                                          <SortableSurface id={subId}>
                                            {({ draggableProps }) => (
                                              <div className={`rounded-lg border p-1 ${activeTreeId === subId ? 'border-brand-300 bg-brand-50/40' : 'border-slate-200 bg-white'}`}>
                                                <div className="flex items-center gap-2" {...draggableProps}>
                                                  <button
                                                    type="button"
                                                    onClick={() => selectTreeNode(subId)}
                                                    className={`flex-1 rounded-md px-2 py-1 text-left text-sm ${selected.kind === 'subcategory' && selected.categorySlug === category.slug && selected.subcategorySlug === sub.slug ? 'bg-brand-50 font-semibold text-brand-700' : 'text-slate-700'}`}
                                                  >
                                                    {sub.title}
                                                  </button>
                                                  <Button variant="ghost" size="sm" onClick={() => { setEditingTreeId(subId); setTreeDraftTitle(sub.title); }}>✎</Button>
                                                  <Button variant="ghost" size="sm" onClick={() => addSubcategory(category.slug, sub.slug)}>+⟷</Button>
                                                  <Button variant="ghost" size="sm" onClick={() => removeNode(subId)}>−</Button>
                                                </div>
                                                {editingTreeId === subId ? (
                                                  <div className="mt-2 flex items-center gap-2">
                                                    <FloatingInput id={`rename-${subId}`} tone="admin" label="Naziv" value={treeDraftTitle} onChange={(event) => setTreeDraftTitle(event.target.value)} />
                                                    <Button variant="outline" size="sm" onClick={() => { renameTreeNode(subId, treeDraftTitle); setEditingTreeId(null); }}>Shrani</Button>
                                                  </div>
                                                ) : null}
                                              </div>
                                            )}
                                          </SortableSurface>
                                        </li>
                                      );
                                    })}
                                  </ul>
                                </SortableContext>
                              </TreeDropZone>
                            </div>
                          ) : null}
                        </div>
                      )}
                    </SortableSurface>
                  </li>
                );
              })}
            </ul>
          </SortableContext>
        </DndContext>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-3 flex items-center justify-between">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Vsebina izbrane kategorije</p>
          <p className="text-xs text-slate-400">{saving ? 'Shranjujem ...' : 'Spremembe se shranjujejo sproti.'}</p>
        </div>

        {selectedContext?.kind === 'root' ? (
          <ContentsGrid
            title="Vse kategorije"
            description="Urejanje glavnih kategorij, kot jih vidi kupec na products landing strani."
            items={catalog.categories.map((entry) => ({ id: entry.slug, title: entry.title, description: entry.summary, image: entry.image, adminNotes: entry.adminNotes ?? '' }))}
            onDragEnd={onChildrenOrderDragEnd}
            onOpen={(id) => setSelected({ kind: 'category', categorySlug: id })}
            onTitleChange={(id, value) => {
              const next = { categories: catalog.categories.map((entry) => entry.slug === id ? { ...entry, title: value } : entry) };
              void persist(next);
            }}
            onDescriptionChange={(id, value) => {
              const next = { categories: catalog.categories.map((entry) => entry.slug === id ? { ...entry, summary: value } : entry) };
              void persist(next);
            }}
            onImageChange={(id, value) => {
              const next = { categories: catalog.categories.map((entry) => entry.slug === id ? { ...entry, image: value } : entry) };
              void persist(next);
            }}
            onAdminNotesChange={(id, value) => {
              const next = { categories: catalog.categories.map((entry) => entry.slug === id ? { ...entry, adminNotes: value } : entry) };
              void persist(next);
            }}
            onAddChild={(id) => addSubcategory(id)}
          />
        ) : null}

        {selectedContext?.kind === 'category' ? (
          selectedContext.category.subcategories.length > 0 ? (
            <ContentsGrid
              title={`${selectedContext.category.title} — podkategorije`}
              description="Urejanje vsebine te kategorije (child kartice v storefront slogu)."
              items={selectedContext.category.subcategories.map((entry) => ({ id: entry.slug, title: entry.title, description: entry.description, image: entry.image ?? '', adminNotes: entry.adminNotes ?? '' }))}
              onDragEnd={onChildrenOrderDragEnd}
              onOpen={(id) => setSelected({ kind: 'subcategory', categorySlug: selectedContext.category.slug, subcategorySlug: id })}
              onTitleChange={(id, value) => {
                updateSubcategory(selectedContext.category.slug, id, { title: value });
              }}
              onDescriptionChange={(id, value) => {
                updateSubcategory(selectedContext.category.slug, id, { description: value });
              }}
              onImageChange={(id, value) => {
                updateSubcategory(selectedContext.category.slug, id, { image: value });
              }}
              onAdminNotesChange={(id, value) => {
                updateSubcategory(selectedContext.category.slug, id, { adminNotes: value });
              }}
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

type ContentCard = { id: string; title: string; description: string; image: string; adminNotes: string };

function ContentsGrid({
  title,
  description,
  items,
  onDragEnd,
  onOpen,
  onTitleChange,
  onDescriptionChange,
  onImageChange,
  onAdminNotesChange,
  onAddChild
}: {
  title: string;
  description: string;
  items: ContentCard[];
  onDragEnd: (event: DragEndEvent) => void;
  onOpen: (id: string) => void;
  onTitleChange: (id: string, value: string) => void;
  onDescriptionChange: (id: string, value: string) => void;
  onImageChange: (id: string, value: string) => void;
  onAdminNotesChange: (id: string, value: string) => void;
  onAddChild: (id: string) => void;
}) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">{title}</h2>
          <p className="mt-1 text-sm text-slate-600">{description}</p>
        </div>
      </div>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={items.map((entry) => entry.id)} strategy={rectSortingStrategy}>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {items.map((item) => (
              <SortableSurface key={item.id} id={item.id}>
                {({ draggableProps }) => (
                  <div {...draggableProps} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                    <div className="relative h-32 overflow-hidden bg-slate-50">
                      {item.image ? (
                        <Image src={item.image} alt={item.title} fill className="object-cover" />
                      ) : (
                        <div className="flex h-full items-center justify-center text-xs text-slate-400">Brez slike</div>
                      )}
                    </div>
                    <div className="space-y-3 p-4">
                      <div onPointerDownCapture={stopDragFromField}>
                        <FloatingInput id={`title-${item.id}`} tone="admin" label="Naziv" value={item.title} onChange={(event) => onTitleChange(item.id, event.target.value)} />
                      </div>
                      <div onPointerDownCapture={stopDragFromField}>
                        <FloatingTextarea id={`desc-${item.id}`} tone="admin" label="Opis" value={item.description} onChange={(event) => onDescriptionChange(item.id, event.target.value)} className="min-h-[90px]" />
                      </div>
                      <div onPointerDownCapture={stopDragFromField}>
                        <FloatingInput id={`img-${item.id}`} tone="admin" label="Slika URL" value={item.image} onChange={(event) => onImageChange(item.id, event.target.value)} />
                      </div>
                      <div onPointerDownCapture={stopDragFromField}>
                        <FloatingTextarea id={`notes-${item.id}`} tone="admin" label="Admin opombe" value={item.adminNotes} onChange={(event) => onAdminNotesChange(item.id, event.target.value)} className="min-h-[80px]" />
                      </div>
                      <div className="flex items-center gap-2" onPointerDownCapture={stopDragFromField}>
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
