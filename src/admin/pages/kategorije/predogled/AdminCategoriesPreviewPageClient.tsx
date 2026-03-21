'use client';

import { useCallback, useEffect, useMemo, useRef, useState, memo } from 'react';
import Image from 'next/image';
import type { CatalogItem } from '@/commercial/catalog/catalog';
import { formatCatalogPrice, getCatalogCategoryItemPrice, getCatalogCategoryItemSku, getCatalogItemPrice, getCatalogItemSku, getDiscountedPrice, sortCatalogItems } from '@/commercial/catalog/catalog';
import { Button } from '@/shared/ui/button';
import { useToast } from '@/shared/ui/toast';
import type { AdminPreviewNode, AdminPreviewPayload } from '@/shared/server/catalogCategories';

type Draft = { title: string; description: string; status: 'active' | 'inactive' };
type PendingImage = { file: File; objectUrl: string };
type LeafPayload = { category: { id: string; slug: string; title: string }; subcategory: { id: string; slug: string; title: string } | null; items: CatalogItem[] };

const GRID_MIN = 3;
const GRID_MAX = 8;

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.onerror = () => reject(new Error('Napaka pri branju slike.'));
    reader.readAsDataURL(file);
  });
}

const PreviewCard = memo(function PreviewCard({
  node,
  imageSrc,
  isEditing,
  draft,
  uploadInputRef,
  onOpen,
  onStartEdit,
  onCancelEdit,
  onDraftChange,
  onStatusToggle,
  onSelectImage,
  onSaveCard,
}: {
  node: AdminPreviewNode;
  imageSrc: string;
  isEditing: boolean;
  draft: Draft | null;
  uploadInputRef: (node: HTMLInputElement | null) => void;
  onOpen: (node: AdminPreviewNode) => void;
  onStartEdit: (node: AdminPreviewNode) => void;
  onCancelEdit: (nodeId: string) => void;
  onDraftChange: (nodeId: string, patch: Partial<Draft>) => void;
  onStatusToggle: (node: AdminPreviewNode) => void;
  onSelectImage: (node: AdminPreviewNode, file: File | null) => void;
  onSaveCard: (nodeId: string) => void;
}) {
  const title = draft?.title ?? node.title;
  const description = draft?.description ?? node.description;
  const isHidden = (draft?.status ?? node.status) === 'inactive';

  return (
    <article className="group flex h-full min-h-[300px] flex-col overflow-hidden rounded-[18px] border border-slate-200 bg-white shadow-[0_2px_8px_rgba(15,23,42,0.04)]">
      <div className="group/image relative h-[226px] overflow-hidden">
        <div className={`absolute inset-0 ${imageSrc ? 'bg-slate-100' : 'bg-[#323538]'}`} aria-hidden="true">
          {imageSrc ? (
            <Image
              src={imageSrc}
              alt={title || 'Kategorija'}
              fill
              sizes="(max-width: 768px) 50vw, (max-width: 1280px) 25vw, 16vw"
              className={`object-cover transition duration-200 ${isHidden ? 'scale-[1.02] blur-[2px]' : ''}`}
            />
          ) : null}
        </div>
        <div className={`pointer-events-none absolute inset-0 ${isHidden ? 'bg-[linear-gradient(180deg,rgba(15,23,42,0.18)_0%,rgba(15,23,42,0.42)_42%,rgba(15,23,42,0.6)_76%,rgba(15,23,42,0.72)_100%)]' : 'bg-[linear-gradient(180deg,rgba(15,23,42,0.02)_0%,rgba(15,23,42,0.08)_48%,rgba(15,23,42,0.18)_100%)]'}`} aria-hidden="true" />
        <div className="absolute right-3 top-3 z-20 flex flex-col items-end gap-2 opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100">
          <button type="button" className="inline-flex h-8 min-w-[2rem] items-center justify-center rounded-xl border border-slate-200 bg-white px-2 text-slate-900 shadow-[0_6px_18px_rgba(15,23,42,0.12)] transition hover:bg-slate-50" onClick={() => isEditing ? onCancelEdit(node.id) : onStartEdit(node)}>{isEditing ? 'Zapri' : 'Uredi'}</button>
          <button type="button" className={`inline-flex h-8 min-w-[2rem] items-center justify-center rounded-xl border bg-white px-2 shadow-[0_6px_18px_rgba(15,23,42,0.12)] transition ${isHidden ? 'border-[#f1c1bd] text-[#d2554a] hover:bg-[#fff7f6]' : 'border-slate-200 text-slate-900 hover:bg-slate-50'}`} onClick={() => onStatusToggle(node)}>{isHidden ? 'Prikaži' : 'Skrij'}</button>
          <button type="button" className="inline-flex h-8 min-w-[2rem] items-center justify-center rounded-xl border border-slate-200 bg-white px-2 text-slate-900 shadow-[0_6px_18px_rgba(15,23,42,0.12)] transition hover:bg-slate-50" onClick={() => onOpen(node)}>{node.hasChildren ? 'Odpri' : 'Izdelki'}</button>
          <label className="inline-flex cursor-pointer items-center justify-center rounded-xl border border-slate-200 bg-white px-2 py-1 text-xs text-slate-900 shadow-[0_6px_18px_rgba(15,23,42,0.12)] transition hover:bg-slate-50">
            Slika
            <input ref={uploadInputRef} type="file" accept="image/*" className="sr-only" onChange={(event) => onSelectImage(node, event.target.files?.[0] ?? null)} />
          </label>
        </div>
        {isHidden ? <div className="absolute left-1/2 top-[44%] z-20 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#d2554a] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-white shadow-sm">SKRITO</div> : null}
      </div>

      <div className="relative flex h-[132px] flex-none flex-col px-4 pb-4 pt-3">
        {isEditing ? (
          <div className="flex h-full flex-col gap-2">
            <input className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-900 focus:border-[#3e67d6] focus:outline-none" value={title} onChange={(event) => onDraftChange(node.id, { title: event.target.value })} />
            <textarea className="min-h-[56px] rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-600 focus:border-[#3e67d6] focus:outline-none" value={description} onChange={(event) => onDraftChange(node.id, { description: event.target.value })} />
            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => onCancelEdit(node.id)}>Prekliči</Button>
              <Button variant="primary" size="sm" onClick={() => onSaveCard(node.id)}>Shrani</Button>
            </div>
          </div>
        ) : (
          <button type="button" className="flex h-full flex-col items-start text-left" onClick={() => onOpen(node)}>
            <h3 className="line-clamp-2 text-[17px] font-semibold leading-5 text-[#132433]">{title || '—'}</h3>
            <p className="mt-2 line-clamp-3 text-sm leading-[1.35rem] text-[#536471]">{description || '—'}</p>
          </button>
        )}
      </div>
    </article>
  );
}, (prev, next) =>
  prev.node === next.node &&
  prev.imageSrc === next.imageSrc &&
  prev.isEditing === next.isEditing &&
  prev.draft?.title === next.draft?.title &&
  prev.draft?.description === next.draft?.description &&
  prev.draft?.status === next.draft?.status
);

export default function AdminCategoriesPreviewPageClient({ initialPayload }: { initialPayload: AdminPreviewPayload }) {
  const { toast } = useToast();
  const [nodes, setNodes] = useState(initialPayload.nodes);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [lowerViewCount, setLowerViewCount] = useState(5);
  const [draftsById, setDraftsById] = useState<Record<string, Draft>>({});
  const [pendingImagesById, setPendingImagesById] = useState<Record<string, PendingImage>>({});
  const [leafItemsByNodeId, setLeafItemsByNodeId] = useState<Record<string, LeafPayload>>({});
  const [loadingLeafForNodeId, setLoadingLeafForNodeId] = useState<string | null>(null);

  const nodeById = useMemo(() => new Map(nodes.map((node) => [node.id, node])), [nodes]);

  const selectedNode = selectedId ? nodeById.get(selectedId) ?? null : null;
  const selectedParentId = selectedNode?.id ?? null;
  const visibleNodes = useMemo(
    () => nodes.filter((node) => node.parentId === selectedParentId).sort((left, right) => left.position - right.position),
    [nodes, selectedParentId]
  );

  const canNavigateUp = selectedNode !== null;

  const loadLeaf = useCallback(async (node: AdminPreviewNode) => {
    if (node.hasChildren || leafItemsByNodeId[node.id] || loadingLeafForNodeId === node.id) return;
    setLoadingLeafForNodeId(node.id);
    try {
      const response = await fetch(`/api/admin/categories/preview/${node.id}/items`, { cache: 'no-store' });
      if (!response.ok) throw new Error();
      const payload = await response.json() as LeafPayload;
      setLeafItemsByNodeId((current) => ({ ...current, [node.id]: payload }));
    } catch {
      toast.error('Napaka pri nalaganju izdelkov.');
    } finally {
      setLoadingLeafForNodeId((current) => (current === node.id ? null : current));
    }
  }, [leafItemsByNodeId, loadingLeafForNodeId, toast]);

  useEffect(() => {
    if (selectedNode) {
      void loadLeaf(selectedNode);
    }
  }, [loadLeaf, selectedNode]);

  const pendingImagesRef = useRef(pendingImagesById);
  useEffect(() => {
    pendingImagesRef.current = pendingImagesById;
  }, [pendingImagesById]);

  useEffect(() => () => {
    Object.values(pendingImagesRef.current).forEach((entry) => URL.revokeObjectURL(entry.objectUrl));
  }, []);

  const stageDraft = useCallback((node: AdminPreviewNode) => {
    setDraftsById((current) => current[node.id] ? current : { ...current, [node.id]: { title: node.title, description: node.description, status: node.status } });
  }, []);

  const updateDraft = useCallback((nodeId: string, patch: Partial<Draft>) => {
    setDraftsById((current) => {
      const node = nodeById.get(nodeId);
      const base = current[nodeId] ?? (node ? { title: node.title, description: node.description, status: node.status } : { title: '', description: '', status: 'active' as const });
      return { ...current, [nodeId]: { ...base, ...patch } };
    });
  }, [nodeById]);

  const saveCard = useCallback(async (nodeId: string) => {
    const node = nodeById.get(nodeId);
    if (!node) return;
    const draft = draftsById[nodeId];
    const pendingImage = pendingImagesById[nodeId];
    const changes: Record<string, unknown> = {};

    if (draft) {
      if (draft.title.trim() !== node.title) changes.title = draft.title.trim();
      if (draft.description !== node.description) changes.description = draft.description;
      if (draft.status !== node.status) changes.status = draft.status;
    }
    if (pendingImage) {
      changes.image = await fileToDataUrl(pendingImage.file);
    }
    if (Object.keys(changes).length === 0) {
      return;
    }

    try {
      const response = await fetch('/api/admin/categories/preview', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: nodeId, changes })
      });
      const payload = await response.json();
      if (!response.ok || !payload.node) throw new Error();
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
      toast.success('Spremembe shranjene.');
    } catch {
      toast.error('Shranjevanje ni uspelo.');
    }
  }, [draftsById, nodeById, pendingImagesById, toast]);

  const selectedLeaf = selectedNode ? leafItemsByNodeId[selectedNode.id] : null;

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-3 flex items-center justify-between gap-3">
          <p className="text-sm font-semibold text-slate-700">Predogled</p>
          <div className="flex items-center gap-3">
            <label className="mr-2 flex items-center gap-2 text-[11px] text-slate-500">
              Elementov na vrstico
              <input type="range" min={GRID_MIN} max={GRID_MAX} value={lowerViewCount} onChange={(event) => setLowerViewCount(Number(event.target.value || 5))} className="h-1.5 w-28 accent-[#3e67d6]" />
              <span className="w-4 text-right text-slate-600">{lowerViewCount}</span>
            </label>
            <Button variant="outline" size="toolbar" onClick={() => setSelectedId(selectedNode?.parentId ?? null)} disabled={!canNavigateUp} className="inline-flex h-9 w-9 items-center justify-center rounded-xl px-0">←</Button>
          </div>
        </div>

        {visibleNodes.length > 0 ? (
          <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${Math.min(GRID_MAX, Math.max(GRID_MIN, lowerViewCount))}, minmax(0, 1fr))` }}>
            {visibleNodes.map((node) => (
              <PreviewCard
                key={node.id}
                node={node}
                imageSrc={pendingImagesById[node.id]?.objectUrl ?? node.image}
                isEditing={Boolean(draftsById[node.id])}
                draft={draftsById[node.id] ?? null}
                uploadInputRef={() => {}}
                onOpen={(nextNode) => setSelectedId(nextNode.id)}
                onStartEdit={stageDraft}
                onCancelEdit={(nodeId) => setDraftsById((current) => {
                  const next = { ...current };
                  delete next[nodeId];
                  return next;
                })}
                onDraftChange={updateDraft}
                onStatusToggle={(nextNode) => updateDraft(nextNode.id, { status: (draftsById[nextNode.id]?.status ?? nextNode.status) === 'inactive' ? 'active' : 'inactive' })}
                onSelectImage={(nextNode, file) => {
                  if (!file) return;
                  setPendingImagesById((current) => {
                    const previous = current[nextNode.id];
                    if (previous) URL.revokeObjectURL(previous.objectUrl);
                    return { ...current, [nextNode.id]: { file, objectUrl: URL.createObjectURL(file) } };
                  });
                }}
                onSaveCard={saveCard}
              />
            ))}
          </div>
        ) : null}

        {selectedNode && !selectedNode.hasChildren ? (
          <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-sm font-semibold text-slate-700">{selectedLeaf ? `${selectedLeaf.category.title}${selectedLeaf.subcategory ? ` / ${selectedLeaf.subcategory.title}` : ''}` : selectedNode.title}</p>
            {loadingLeafForNodeId === selectedNode.id ? <p className="mt-3 text-sm text-slate-500">Nalagam izdelke…</p> : null}
            {selectedLeaf ? (
              <ul className="mt-4 space-y-3">
                {sortCatalogItems(selectedLeaf.items).map((item) => {
                  const price = selectedLeaf.subcategory ? getCatalogItemPrice(selectedLeaf.category.slug, selectedLeaf.subcategory.slug, item.slug) : getCatalogCategoryItemPrice(selectedLeaf.category.slug, item.slug);
                  const discounted = getDiscountedPrice(price, item.discountPct);
                  const sku = selectedLeaf.subcategory ? getCatalogItemSku(selectedLeaf.category.slug, selectedLeaf.subcategory.slug, item.slug) : getCatalogCategoryItemSku(selectedLeaf.category.slug, item.slug);
                  return (
                    <li key={item.slug} className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3">
                      <div>
                        <p className="text-sm font-medium text-slate-900">{item.name}</p>
                        <p className="text-xs text-slate-500">{sku}</p>
                      </div>
                      <div className="text-sm font-semibold text-slate-700">{formatCatalogPrice(discounted)}</div>
                    </li>
                  );
                })}
              </ul>
            ) : null}
          </div>
        ) : null}
      </section>
    </div>
  );
}
