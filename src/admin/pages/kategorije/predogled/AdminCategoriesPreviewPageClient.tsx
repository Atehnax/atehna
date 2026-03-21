'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode, type ChangeEvent } from 'react';
import { arrayMove, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { DragEndEvent } from '@dnd-kit/core';
import { AdminCategoriesPreview } from '@/admin/features/kategorije/components/AdminCategoriesPreview';
import type { ContentCard, EditingRowDraft, ImageDeleteTarget, RecursiveCatalogSubcategory, SelectedPreviewContext } from '@/admin/features/kategorije/common/types';
import { catId, findSubcategoryByPath, slugify, subId } from '@/admin/features/kategorije/common/catalog-helpers';
import type { CatalogCategory, CatalogItem, CatalogSubcategory } from '@/commercial/catalog/catalog';
import { sortCatalogItems } from '@/commercial/catalog/catalog';
import { ConfirmDialog } from '@/shared/ui/confirm-dialog';
import { Input } from '@/shared/ui/input';
import { useToast } from '@/shared/ui/toast';
import type { AdminPreviewNode, AdminPreviewPayload } from '@/shared/server/catalogCategories';

type Draft = { title: string; description: string; status: 'active' | 'inactive' };
type PendingImage = { file: File; objectUrl: string };
type LeafPayload = { category: { id: string; slug: string; title: string }; subcategory: { id: string; slug: string; title: string } | null; items: CatalogItem[] };

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.onerror = () => reject(new Error('Napaka pri branju datoteke'));
    reader.readAsDataURL(file);
  });
}

function SortableItem({
  id,
  children
}: {
  id: string;
  children: (args: { dragHandleProps: Record<string, unknown>; setNodeRef: (node: HTMLElement | null) => void; style: CSSProperties }) => ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id });

  return children({
    dragHandleProps: { ...attributes, ...listeners },
    setNodeRef,
    style: { transform: CSS.Transform.toString(transform), transition }
  });
}

export default function AdminCategoriesPreviewPageClient({ initialPayload }: { initialPayload: AdminPreviewPayload }) {
  const { toast } = useToast();
  const [nodes, setNodes] = useState(initialPayload.nodes);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [lowerViewCount, setLowerViewCount] = useState(5);
  const [editingRow, setEditingRow] = useState<EditingRowDraft | null>(null);
  const [draftsById, setDraftsById] = useState<Record<string, Draft>>({});
  const [dirtyIds, setDirtyIds] = useState<string[]>([]);
  const [pendingImagesById, setPendingImagesById] = useState<Record<string, PendingImage>>({});
  const [leafItemsByNodeId, setLeafItemsByNodeId] = useState<Record<string, LeafPayload>>({});
  const [loadingLeafNodeId, setLoadingLeafNodeId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [tableError, setTableError] = useState<string | null>(null);
  const [isSaveDialogOpen, setIsSaveDialogOpen] = useState(false);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [createName, setCreateName] = useState('');
  const [imageDeleteTarget, setImageDeleteTarget] = useState<ImageDeleteTarget>(null);
  const uploadRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const pendingImagesRef = useRef(pendingImagesById);

  useEffect(() => {
    pendingImagesRef.current = pendingImagesById;
  }, [pendingImagesById]);

  useEffect(() => () => {
    Object.values(pendingImagesRef.current).forEach((entry) => URL.revokeObjectURL(entry.objectUrl));
  }, []);

  const nodeById = useMemo(() => new Map(nodes.map((node) => [node.id, node])), [nodes]);
  const selectedNode = selectedId ? nodeById.get(selectedId) ?? null : null;

  const childNodesByParent = useMemo(() => {
    const map = new Map<string | null, AdminPreviewNode[]>();
    nodes.forEach((node) => {
      const list = map.get(node.parentId) ?? [];
      list.push(node);
      map.set(node.parentId, list);
    });
    map.forEach((list) => list.sort((left, right) => left.position - right.position));
    return map;
  }, [nodes]);

  const getNodeState = useCallback((node: AdminPreviewNode) => {
    const draft = draftsById[node.id];
    return {
      title: draft?.title ?? node.title,
      description: draft?.description ?? node.description,
      status: draft?.status ?? node.status,
      image: pendingImagesById[node.id]?.objectUrl ?? node.image
    };
  }, [draftsById, pendingImagesById]);

  const buildSubcategoryTree = useCallback((categorySlug: string, parentId: string): CatalogSubcategory[] => {
    const children = childNodesByParent.get(parentId) ?? [];
    return children.map((node) => {
      const state = getNodeState(node);
      return {
        id: node.id,
        slug: node.slug,
        title: state.title,
        description: state.description,
        image: state.image,
        items: leafItemsByNodeId[node.id]?.items ?? [],
        subcategories: buildSubcategoryTree(categorySlug, node.id)
      } as CatalogSubcategory & { subcategories: CatalogSubcategory[] };
    });
  }, [childNodesByParent, getNodeState, leafItemsByNodeId]);

  const selectedContext = useMemo<SelectedPreviewContext>(() => {
    if (!selectedNode) return { kind: 'root' };
    if (selectedNode.kind === 'category') {
      const state = getNodeState(selectedNode);
      const category: CatalogCategory = {
        id: selectedNode.id,
        slug: selectedNode.slug,
        title: state.title,
        summary: state.description,
        description: '',
        image: state.image,
        subcategories: buildSubcategoryTree(selectedNode.slug, selectedNode.id),
        items: leafItemsByNodeId[selectedNode.id]?.items ?? []
      };
      return { kind: 'category', category };
    }

    const categoryNode = nodes.find((node) => node.kind === 'category' && node.slug === selectedNode.categorySlug);
    if (!categoryNode) return null;
    const categoryState = getNodeState(categoryNode);
    const category: CatalogCategory = {
      id: categoryNode.id,
      slug: categoryNode.slug,
      title: categoryState.title,
      summary: categoryState.description,
      description: '',
      image: categoryState.image,
      subcategories: buildSubcategoryTree(categoryNode.slug, categoryNode.id),
      items: leafItemsByNodeId[categoryNode.id]?.items ?? []
    };
    const subcategory = findSubcategoryByPath(category.subcategories as RecursiveCatalogSubcategory[], selectedNode.path);
    if (!subcategory) return null;
    return { kind: 'subcategory', category, subcategory };
  }, [buildSubcategoryTree, getNodeState, leafItemsByNodeId, nodes, selectedNode]);

  const visibleContent = useMemo<ContentCard[]>(() => {
    if (!selectedContext) return [];
    if (selectedContext.kind === 'root') {
      return (childNodesByParent.get(null) ?? []).map((node) => {
        const state = getNodeState(node);
        return {
          id: catId(node.slug),
          title: state.title,
          description: state.description,
          image: state.image,
          kind: 'category',
          categorySlug: node.slug,
          subcategoryPath: [],
          openLabel: 'Odpri kategorijo',
          hasChildren: node.hasChildren,
          isInactive: state.status === 'inactive'
        };
      });
    }

    if (selectedContext.kind === 'category') {
      return (childNodesByParent.get(selectedContext.category.id) ?? []).map((node) => {
        const state = getNodeState(node);
        return {
          id: subId(selectedContext.category.slug, node.path),
          title: state.title,
          description: state.description,
          image: state.image,
          kind: 'subcategory',
          categorySlug: selectedContext.category.slug,
          subcategoryPath: node.path,
          openLabel: 'Odpri podkategorijo',
          hasChildren: node.hasChildren,
          isInactive: state.status === 'inactive'
        };
      });
    }

    return (childNodesByParent.get(selectedContext.subcategory.id) ?? []).map((node) => {
      const state = getNodeState(node);
      return {
        id: subId(selectedContext.category.slug, node.path),
        title: state.title,
        description: state.description,
        image: state.image,
        kind: 'subcategory',
        categorySlug: selectedContext.category.slug,
        subcategoryPath: node.path,
        openLabel: 'Odpri podkategorijo',
        hasChildren: node.hasChildren,
        isInactive: state.status === 'inactive'
      };
    });
  }, [childNodesByParent, getNodeState, selectedContext]);

  const loadLeafItems = useCallback(async (node: AdminPreviewNode) => {
    if (node.hasChildren || leafItemsByNodeId[node.id] || loadingLeafNodeId === node.id) return;
    setLoadingLeafNodeId(node.id);
    try {
      const response = await fetch(`/api/admin/categories/preview/${node.id}/items`, { cache: 'no-store' });
      if (!response.ok) throw new Error();
      const payload = await response.json() as LeafPayload;
      setLeafItemsByNodeId((current) => ({ ...current, [node.id]: payload }));
    } catch {
      toast.error('Napaka pri nalaganju izdelkov');
    } finally {
      setLoadingLeafNodeId((current) => (current === node.id ? null : current));
    }
  }, [leafItemsByNodeId, loadingLeafNodeId, toast]);

  useEffect(() => {
    if (selectedNode) void loadLeafItems(selectedNode);
  }, [loadLeafItems, selectedNode]);

  const markDirty = useCallback((nodeId: string) => {
    setDirtyIds((current) => current.includes(nodeId) ? current : [...current, nodeId]);
  }, []);

  const clearDirty = useCallback((nodeId: string) => {
    setDirtyIds((current) => current.filter((entry) => entry !== nodeId));
  }, []);

  const startEdit = useCallback((item: ContentCard) => {
    const node = item.kind === 'category'
      ? nodes.find((entry) => entry.kind === 'category' && entry.slug === item.categorySlug)
      : nodes.find((entry) => entry.kind === 'subcategory' && entry.categorySlug === item.categorySlug && entry.path.join('__') === item.subcategoryPath.join('__'));
    if (!node) return;
    const draft = draftsById[node.id];
    setEditingRow({
      id: item.id,
      kind: item.kind,
      categorySlug: item.categorySlug,
      subcategoryPath: item.subcategoryPath,
      subcategorySlug: item.subcategoryPath.at(-1),
      title: draft?.title ?? item.title,
      description: draft?.description ?? item.description,
      status: draft?.status ?? node.status
    });
  }, [draftsById, nodes]);

  const commitInlineEdit = useCallback(() => {
    if (!editingRow) return;
    const node = editingRow.kind === 'category'
      ? nodes.find((entry) => entry.kind === 'category' && entry.slug === editingRow.categorySlug)
      : nodes.find((entry) => entry.kind === 'subcategory' && entry.categorySlug === editingRow.categorySlug && entry.path.join('__') === (editingRow.subcategoryPath ?? []).join('__'));
    if (!node) {
      setEditingRow(null);
      return;
    }

    const nextDraft: Draft = {
      title: editingRow.title,
      description: editingRow.description,
      status: editingRow.status
    };

    const unchanged = nextDraft.title.trim() === node.title.trim()
      && nextDraft.description === node.description
      && nextDraft.status === node.status;

    setDraftsById((current) => {
      const next = { ...current };
      if (unchanged && !pendingImagesById[node.id]) {
        delete next[node.id];
      } else {
        next[node.id] = nextDraft;
      }
      return next;
    });

    if (unchanged && !pendingImagesById[node.id]) clearDirty(node.id);
    else markDirty(node.id);

    setEditingRow(null);
  }, [clearDirty, editingRow, markDirty, nodes, pendingImagesById]);

  const saveChanges = useCallback(async () => {
    commitInlineEdit();
    const nodeIds = [...new Set(dirtyIds)];
    if (nodeIds.length === 0) {
      setIsSaveDialogOpen(false);
      return;
    }

    setSaving(true);
    setTableError(null);

    try {
      for (const nodeId of nodeIds) {
        const node = nodeById.get(nodeId);
        if (!node) continue;
        const draft = draftsById[nodeId];
        const pendingImage = pendingImagesById[nodeId];
        const changes: Record<string, unknown> = {};

        if (draft) {
          if (draft.title.trim() !== node.title) changes.title = draft.title.trim();
          if (draft.description !== node.description) changes.description = draft.description;
          if (draft.status !== node.status) changes.status = draft.status;
        }
        if (pendingImage) changes.image = await fileToDataUrl(pendingImage.file);
        if (Object.keys(changes).length === 0) continue;

        const response = await fetch('/api/admin/categories/preview', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: nodeId, changes })
        });
        const payload = await response.json();
        if (!response.ok || !payload.node) {
          throw new Error(payload?.message ?? 'Shranjevanje ni uspelo');
        }
        const updatedNode = payload.node as AdminPreviewNode;
        setNodes((current) => current.map((entry) => entry.id === nodeId ? updatedNode : entry));
        setDraftsById((current) => {
          const next = { ...current };
          delete next[nodeId];
          return next;
        });
        setPendingImagesById((current) => {
          const next = { ...current };
          const pending = next[nodeId];
          if (pending) URL.revokeObjectURL(pending.objectUrl);
          delete next[nodeId];
          return next;
        });
      }

      setDirtyIds([]);
      setIsSaveDialogOpen(false);
      toast.success('Spremembe shranjene');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Shranjevanje ni uspelo';
      setTableError(message);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  }, [commitInlineEdit, dirtyIds, draftsById, nodeById, pendingImagesById, toast]);

  const handleStatusChange = useCallback((rowId: string, status: 'active' | 'inactive') => {
    const node = visibleContent.find((item) => item.id === rowId);
    if (!node) return;
    const previewNode = node.kind === 'category'
      ? nodes.find((entry) => entry.kind === 'category' && entry.slug === node.categorySlug)
      : nodes.find((entry) => entry.kind === 'subcategory' && entry.categorySlug === node.categorySlug && entry.path.join('__') === node.subcategoryPath.join('__'));
    if (!previewNode) return;

    setDraftsById((current) => ({
      ...current,
      [previewNode.id]: {
        title: current[previewNode.id]?.title ?? previewNode.title,
        description: current[previewNode.id]?.description ?? previewNode.description,
        status
      }
    }));
    markDirty(previewNode.id);
    setEditingRow((current) => current && current.id === rowId ? { ...current, status } : current);
  }, [markDirty, nodes, visibleContent]);

  const handleImageUpload = useCallback(async (file: File | null, item: ContentCard) => {
    if (!file) return;
    const previewNode = item.kind === 'category'
      ? nodes.find((entry) => entry.kind === 'category' && entry.slug === item.categorySlug)
      : nodes.find((entry) => entry.kind === 'subcategory' && entry.categorySlug === item.categorySlug && entry.path.join('__') === item.subcategoryPath.join('__'));
    if (!previewNode) return;

    setPendingImagesById((current) => {
      const next = { ...current };
      if (next[previewNode.id]) URL.revokeObjectURL(next[previewNode.id].objectUrl);
      next[previewNode.id] = { file, objectUrl: URL.createObjectURL(file) };
      return next;
    });
    markDirty(previewNode.id);
  }, [markDirty, nodes]);

  const saveSummary = useMemo(() => {
    if (dirtyIds.length === 0) return ['Ni sprememb za shranjevanje.'];
    return dirtyIds.map((nodeId) => nodeById.get(nodeId)?.title ?? nodeId);
  }, [dirtyIds, nodeById]);

  const handleCreateCategory = useCallback(async () => {
    const title = createName.trim();
    if (!title) return;
    try {
      const response = await fetch('/api/admin/categories/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title })
      });
      const payload = await response.json();
      if (!response.ok || !payload.node) throw new Error(payload?.message ?? 'Dodajanje ni uspelo');
      setNodes((current) => [...current, payload.node as AdminPreviewNode]);
      setCreateName('');
      setIsCreateDialogOpen(false);
      toast.success('Kategorija dodana');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Dodajanje ni uspelo');
    }
  }, [createName, toast]);

  const handleDeleteImage = useCallback(() => {
    if (!imageDeleteTarget) return;
    const previewNode = imageDeleteTarget.kind === 'category'
      ? nodes.find((entry) => entry.kind === 'category' && entry.slug === imageDeleteTarget.categorySlug)
      : nodes.find((entry) => entry.kind === 'subcategory' && entry.categorySlug === imageDeleteTarget.categorySlug && entry.path.at(-1) === imageDeleteTarget.subcategorySlug);
    if (!previewNode) return;

    setPendingImagesById((current) => {
      const next = { ...current };
      if (next[previewNode.id]) URL.revokeObjectURL(next[previewNode.id].objectUrl);
      delete next[previewNode.id];
      return next;
    });
    setDraftsById((current) => ({
      ...current,
      [previewNode.id]: {
        title: current[previewNode.id]?.title ?? previewNode.title,
        description: current[previewNode.id]?.description ?? previewNode.description,
        status: current[previewNode.id]?.status ?? previewNode.status
      }
    }));
    setNodes((current) => current.map((entry) => entry.id === previewNode.id ? { ...entry, image: '' } : entry));
    markDirty(previewNode.id);
    setImageDeleteTarget(null);
  }, [imageDeleteTarget, markDirty, nodes]);

  const onBottomReorder = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const currentIds = visibleContent.map((item) => item.id);
    const oldIndex = currentIds.indexOf(String(active.id));
    const newIndex = currentIds.indexOf(String(over.id));
    if (oldIndex < 0 || newIndex < 0) return;
    const reorderedIds = arrayMove(currentIds, oldIndex, newIndex);
    const parentId = selectedNode?.id ?? null;
    const siblings = childNodesByParent.get(parentId) ?? [];
    const reorderedNodes = reorderedIds.map((id, index) => {
      const sibling = siblings.find((entry) => (entry.kind === 'category' ? catId(entry.slug) : subId(entry.categorySlug, entry.path)) === id);
      return sibling ? { ...sibling, position: index } : null;
    }).filter((entry): entry is AdminPreviewNode => entry !== null);
    setNodes((current) => current.map((entry) => reorderedNodes.find((node) => node.id === entry.id) ?? entry));
    reorderedNodes.forEach((node) => markDirty(node.id));
  }, [childNodesByParent, markDirty, selectedNode, visibleContent]);

  return (
    <>
      <AdminCategoriesPreview
        activeView="preview"
        tableError={tableError}
        lowerViewCount={lowerViewCount}
        onLowerViewCountChange={setLowerViewCount}
        onRequestSave={() => setIsSaveDialogOpen(true)}
        canNavigateUp={selectedNode !== null}
        onNavigateUp={() => setSelectedId(selectedNode?.parentId ?? null)}
        tableDirty={dirtyIds.length > 0}
        saving={saving}
        selectedContext={selectedContext}
        visibleContent={visibleContent}
        onBottomReorder={onBottomReorder}
        renderSortableItem={(id, children) => (
          <SortableItem key={id} id={id}>
            {({ dragHandleProps, setNodeRef, style }) => children({ dragHandleProps, setNodeRef, style })}
          </SortableItem>
        )}
        uploadRefs={uploadRefs}
        onSetImageDeleteTarget={setImageDeleteTarget}
        onImageUpload={handleImageUpload}
        onLeafProductsDragEnd={() => {}}
        sortCatalogItems={sortCatalogItems}
        editingRow={editingRow}
        onStartEdit={startEdit}
        onEditingRowTitleChange={(value) => setEditingRow((current) => current ? { ...current, title: value } : current)}
        onEditingRowDescriptionChange={(value) => setEditingRow((current) => current ? { ...current, description: value } : current)}
        onCommitEdit={commitInlineEdit}
        onCancelEdit={() => setEditingRow(null)}
        onOpenNode={(item) => {
          const node = item.kind === 'category'
            ? nodes.find((entry) => entry.kind === 'category' && entry.slug === item.categorySlug)
            : nodes.find((entry) => entry.kind === 'subcategory' && entry.categorySlug === item.categorySlug && entry.path.join('__') === item.subcategoryPath.join('__'));
          if (node) setSelectedId(node.id);
        }}
        onStageStatusChange={handleStatusChange}
        onRequestCreateCategory={() => setIsCreateDialogOpen(true)}
      />

      <ConfirmDialog
        open={isSaveDialogOpen}
        title="Shrani spremembe"
        description="Pregled pripravljenih sprememb:"
        confirmLabel="Shrani"
        cancelLabel="Prekliči"
        onCancel={() => setIsSaveDialogOpen(false)}
        onConfirm={() => void saveChanges()}
      >
        <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-slate-600">
          {saveSummary.map((line) => <li key={line}>{line}</li>)}
        </ul>
      </ConfirmDialog>

      <ConfirmDialog
        open={isCreateDialogOpen}
        title="Nova kategorija"
        description="Vnesite ime kategorije."
        confirmLabel="Dodaj"
        cancelLabel="Prekliči"
        onCancel={() => {
          setIsCreateDialogOpen(false);
          setCreateName('');
        }}
        onConfirm={() => void handleCreateCategory()}
        confirmDisabled={createName.trim().length === 0}
      >
        <div className="mt-3">
          <Input
            value={createName}
            onChange={(event: ChangeEvent<HTMLInputElement>) => setCreateName(event.target.value)}
            placeholder="Ime kategorije"
            className="h-9 w-full rounded-xl px-3 text-sm"
            autoFocus
          />
        </div>
      </ConfirmDialog>

      <ConfirmDialog
        open={imageDeleteTarget !== null}
        title="Odstrani sliko"
        description="Ali želite odstraniti sliko izbrane kategorije?"
        confirmLabel="Odstrani"
        cancelLabel="Prekliči"
        isDanger
        onCancel={() => setImageDeleteTarget(null)}
        onConfirm={handleDeleteImage}
      />
    </>
  );
}
