import type {
  CSSProperties,
  FocusEvent,
  MutableRefObject,
  ReactNode,
} from "react";
import { memo, useEffect, useState } from "react";
import Image from "next/image";
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { SortableContext, rectSortingStrategy } from "@dnd-kit/sortable";
import type {
  CatalogCategory,
  CatalogItem,
  CatalogSubcategory,
} from "@/commercial/catalog/catalog";
import {
  formatCatalogPrice,
  getCatalogCategoryItemPrice,
  getCatalogCategoryItemSku,
  getCatalogItemPrice,
  getCatalogItemSku,
  getDiscountedPrice,
} from "@/commercial/catalog/catalogUtils";
import { Button } from "@/shared/ui/button";
import { InlineEditableText } from "@/shared/ui/inline-edit";
import type {
  CategoryStatus,
  ContentCard,
  EditingRowDraft,
  SelectedPreviewContext,
} from "../common/types";

export function AdminCategoriesPreview({
  activeView,
  tableError,
  lowerViewCount,
  onLowerViewCountChange,
  onRequestSave,
  canNavigateUp,
  onNavigateUp,
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
  onRequestCreateCategory,
}: {
  activeView: "table" | "preview" | "miller";
  tableError: string | null;
  lowerViewCount: number;
  onLowerViewCountChange: (value: number) => void;
  onRequestSave: () => void;
  canNavigateUp: boolean;
  onNavigateUp: () => void;
  tableDirty: boolean;
  saving: boolean;
  selectedContext: SelectedPreviewContext;
  visibleContent: ContentCard[];
  onBottomReorder: (event: DragEndEvent) => void;
  renderSortableItem: (
    id: string,
    children: (args: {
      dragHandleProps: Record<string, unknown>;
      setNodeRef: (node: HTMLElement | null) => void;
      style: CSSProperties;
    }) => ReactNode,
  ) => ReactNode;
  uploadRefs: MutableRefObject<Record<string, HTMLInputElement | null>>;
  onSetImageDeleteTarget: (target: {
    kind: "category" | "subcategory";
    categorySlug: string;
    subcategorySlug?: string;
  }) => void;
  onImageUpload: (
    file: File | null,
    item: ContentCard,
    categorySlug?: string,
  ) => Promise<void>;
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
  const previewSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
  );
  const selectedSubcategoryChildren =
    selectedContext?.kind === "subcategory"
      ? ((
          selectedContext.subcategory as CatalogSubcategory & {
            subcategories?: CatalogSubcategory[];
          }
        ).subcategories ?? [])
      : [];
  const activeEditCard = editingRow
    ? visibleContent.find((item) => item.id === editingRow.id)
    : null;
  const hasActiveEditChanges = editingRow
    ? editingRow.title.trim() !== (activeEditCard?.title ?? "").trim() ||
      editingRow.description !== (activeEditCard?.description ?? "")
    : false;

  return (
    <div className={activeView === "preview" ? "w-full space-y-4" : "hidden"}>
      <section className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
        {tableError ? (
          <p className="mb-3 rounded-lg border border-[var(--danger-300)] bg-[var(--danger-100)] px-3 py-2 text-xs text-[var(--danger-700)]">
            {tableError}
          </p>
        ) : null}
        <div className="mb-3 flex items-center justify-between gap-3">
          <p className="text-[13px] font-semibold text-slate-700">Predogled</p>
          <div className="flex items-center gap-3">
            <label className="mr-2 flex items-center gap-2 text-[11px] text-slate-500">
              Elementov na vrstico
              <input
                id="categories-preview-columns"
                name="categoriesPreviewColumns"
                type="range"
                min={3}
                max={8}
                value={lowerViewCount}
                onChange={(event) =>
                  onLowerViewCountChange(Number(event.target.value || 5))
                }
                className="h-1.5 w-28 accent-[#3e67d6]"
              />
              <span className="w-4 text-right text-slate-600">
                {lowerViewCount}
              </span>
            </label>
            <Button
              variant="outline"
              size="toolbar"
              onClick={onNavigateUp}
              disabled={!canNavigateUp}
              aria-label="Nazaj na nadrejeno kategorijo"
              title="Nazaj"
              className="inline-flex h-8 w-8 items-center justify-center rounded-xl px-0"
            >
              <svg
                viewBox="0 0 640 640"
                className="h-5 w-5 shrink-0"
                fill="currentColor"
                stroke="currentColor"
                strokeWidth="1.5"
                xmlns="http://www.w3.org/2000/svg"
                aria-hidden="true"
              >
                <path d="M73.4 297.4C60.9 309.9 60.9 330.2 73.4 342.7L233.4 502.7C245.9 515.2 266.2 515.2 278.7 502.7C291.2 490.2 291.2 469.9 278.7 457.4L173.3 352L544 352C561.7 352 576 337.7 576 320C576 302.3 561.7 288 544 288L173.3 288L278.7 182.6C291.2 170.1 291.2 149.8 278.7 137.3C266.2 124.8 245.9 124.8 233.4 137.3L73.4 297.3z" />
              </svg>
            </Button>
            <Button
              variant="primary"
              size="toolbar"
              onClick={() => {
                if (hasActiveEditChanges) onCommitEdit();
                onRequestSave();
              }}
              disabled={(!tableDirty && !hasActiveEditChanges) || saving}
            >
              Shrani
            </Button>
          </div>
        </div>

        {selectedContext && visibleContent.length > 0 ? (
          <DndContext
            sensors={previewSensors}
            collisionDetection={closestCenter}
            onDragEnd={onBottomReorder}
          >
            <SortableContext
              items={visibleContent.map((item) => item.id)}
              strategy={rectSortingStrategy}
            >
              <div
                className="grid gap-3"
                style={{
                  gridTemplateColumns: `repeat(${Math.min(8, Math.max(3, lowerViewCount))}, minmax(0, 1fr))`,
                }}
              >
                {visibleContent.map((item) => (
                  <div key={item.id} className="h-full">
                    {renderSortableItem(
                      item.id,
                      ({ dragHandleProps, setNodeRef, style }) => (
                        <CategoryPreviewCard
                          dragHandleProps={dragHandleProps}
                          setNodeRef={setNodeRef}
                          style={style}
                          item={item}
                          uploadRefs={uploadRefs}
                          onSetImageDeleteTarget={onSetImageDeleteTarget}
                          onImageUpload={onImageUpload}
                          editingRow={editingRow}
                          onStartEdit={onStartEdit}
                          onEditingRowTitleChange={onEditingRowTitleChange}
                          onEditingRowDescriptionChange={
                            onEditingRowDescriptionChange
                          }
                          onCommitEdit={onCommitEdit}
                          onCancelEdit={onCancelEdit}
                          onOpenNode={onOpenNode}
                          onStageStatusChange={onStageStatusChange}
                        />
                      ),
                    )}
                  </div>
                ))}
                {selectedContext.kind === "root" ? (
                  <CreateCategoryCard onClick={onRequestCreateCategory} />
                ) : null}
              </div>
            </SortableContext>
          </DndContext>
        ) : selectedContext?.kind === "root" ? (
          <div
            className="grid gap-3"
            style={{
              gridTemplateColumns: `repeat(${Math.min(8, Math.max(3, lowerViewCount))}, minmax(0, 1fr))`,
            }}
          >
            <CreateCategoryCard onClick={onRequestCreateCategory} />
          </div>
        ) : null}

        {selectedContext?.kind === "category" &&
        selectedContext.category.subcategories.length === 0 ? (
          <LeafProductsView
            title={`${selectedContext.category.title} — izdelki`}
            category={selectedContext.category}
            items={sortCatalogItems(selectedContext.category.items ?? [])}
            onDragEnd={onLeafProductsDragEnd}
          />
        ) : null}

        {selectedContext?.kind === "subcategory" &&
        selectedSubcategoryChildren.length === 0 ? (
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

function CutCornerFocusOutline() {
  return (
    <svg
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 h-full w-full"
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
    >
      <polygon
        points="8,1 92,1 99,8 99,92 92,99 8,99 1,92 1,8"
        fill="none"
        stroke="#3e67d6"
        strokeWidth="1"
      />
    </svg>
  );
}

const CategoryPreviewCard = memo(function CategoryPreviewCard({
  dragHandleProps,
  setNodeRef,
  style,
  item,
  uploadRefs,
  onSetImageDeleteTarget,
  onImageUpload,
  editingRow,
  onStartEdit,
  onEditingRowTitleChange,
  onEditingRowDescriptionChange,
  onCommitEdit,
  onCancelEdit,
  onOpenNode,
  onStageStatusChange,
}: {
  dragHandleProps: Record<string, unknown>;
  setNodeRef: (node: HTMLElement | null) => void;
  style: CSSProperties;
  item: ContentCard;
  uploadRefs: MutableRefObject<Record<string, HTMLInputElement | null>>;
  onSetImageDeleteTarget: (target: {
    kind: "category" | "subcategory";
    categorySlug: string;
    subcategorySlug?: string;
  }) => void;
  onImageUpload: (
    file: File | null,
    item: ContentCard,
    categorySlug?: string,
  ) => Promise<void>;
  editingRow: EditingRowDraft | null;
  onStartEdit: (item: ContentCard) => void;
  onEditingRowTitleChange: (value: string) => void;
  onEditingRowDescriptionChange: (value: string) => void;
  onCommitEdit: () => void;
  onCancelEdit: () => void;
  onOpenNode: (item: ContentCard) => void;
  onStageStatusChange: (rowId: string, status: CategoryStatus) => void;
}) {
  const [focusedField, setFocusedField] = useState<"title" | "description" | null>(null);
  const editingDraft = editingRow?.id === item.id ? editingRow : null;
  const isEditing = Boolean(editingDraft);
  const isTitleEditing = isEditing && focusedField === "title";
  const isDescriptionEditing = isEditing && focusedField === "description";
  useEffect(() => {
    if (isEditing && focusedField === null) {
      setFocusedField("title");
      return;
    }
    if (!isEditing && focusedField !== null) {
      setFocusedField(null);
    }
  }, [focusedField, isEditing]);
  const isHidden = item.isInactive;
  const titlePreview = item.title || "—";
  const descriptionPreview = item.description || "—";
  const shouldShowHoverDetails =
    titlePreview.length > 50 || descriptionPreview.length > 75;
  const triggerImagePicker = () => {
    const input = uploadRefs.current[item.id];
    if (!input) return;
    input.value = "";
    if (typeof input.showPicker === "function") {
      try {
        input.showPicker();
        return;
      } catch {
        // fall back to click when showPicker is unavailable/restricted
      }
    }
    input.click();
  };

  const handleCardEditBlur = (event: FocusEvent<HTMLElement>) => {
    const nextTarget = event.relatedTarget as Element | null;
    if (nextTarget?.closest('[data-inline-edit-field="true"]')) return;
    onCommitEdit();
  };
  const hoverStackButtons = [
    item.image
      ? {
          key: "delete-image",
          label: "Odstrani sliko",
          onClick: (event: React.MouseEvent<HTMLButtonElement>) => {
            event.stopPropagation();
            onSetImageDeleteTarget({
              kind: item.kind,
              categorySlug: item.categorySlug,
              subcategorySlug:
                item.kind === "subcategory"
                  ? item.subcategoryPath.at(-1)
                  : undefined,
            });
          },
          icon: (
            <span aria-hidden="true" className="text-sm leading-none">
              ✕
            </span>
          ),
          tone: "light" as const,
        }
      : null,
    {
      key: "upload-image",
      label: "Dodaj ali zamenjaj sliko",
      onClick: (event: React.MouseEvent<HTMLButtonElement>) => {
        event.stopPropagation();
        triggerImagePicker();
      },
      icon: (
        <svg
          viewBox="0 0 24 24"
          className="block h-[17.6px] w-[17.6px] shrink-0"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <rect x="3" y="4" width="18" height="16" rx="2.8" />
          <path d="m6.5 15.5 3.7-3.8a1 1 0 0 1 1.42 0L15 15l2-2a1 1 0 0 1 1.42 0l2.08 2.08" />
          <circle cx="15.5" cy="9.3" r="1.5" />
        </svg>
      ),
      tone: "light" as const,
    },
    {
      key: "edit",
      label: isEditing ? "Zapri urejanje" : "Uredi",
      onClick: (event: React.MouseEvent<HTMLButtonElement>) => {
        event.stopPropagation();
        if (isEditing) {
          onCancelEdit();
          return;
        }
        onStartEdit(item);
      },
      icon: (
        <svg
          viewBox="0 0 20 20"
          className="block h-[15.4px] w-[15.4px] shrink-0"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          aria-hidden="true"
        >
          <path d="M4 14.5l.5-3L13.5 2.5l3 3L7.5 14.5z" />
          <path d="M11.5 4.5l3 3" />
        </svg>
      ),
      tone: "light" as const,
    },
    {
      key: "visibility",
      label: isHidden ? "Prikaži kategorijo" : "Skrij kategorijo",
      onClick: (event: React.MouseEvent<HTMLButtonElement>) => {
        event.stopPropagation();
        onStageStatusChange(item.id, isHidden ? "active" : "inactive");
      },
      icon: isHidden ? (
        <EyeOffIcon className="h-4 w-4 text-[#d2554a]" />
      ) : (
        <EyeIcon className="h-4 w-4" />
      ),
      tone: isHidden ? ("danger" as const) : ("light" as const),
    },
    {
      key: "drag",
      label: "Premakni kategorijo",
      icon: <DragHandleIcon className="h-4 w-4" />,
      tone: "light" as const,
      dragHandle: true,
    },
  ].filter(Boolean) as Array<{
    key: string;
    label: string;
    onClick?: (event: React.MouseEvent<HTMLButtonElement>) => void;
    icon: React.ReactNode;
    tone: "light" | "danger";
    dragHandle?: boolean;
  }>;

  return (
    <article
      ref={setNodeRef}
      style={style}
      className="group flex h-full min-h-[225px] flex-col overflow-hidden rounded-[18px] border border-slate-200 bg-white shadow-[0_2px_8px_rgba(15,23,42,0.04)]"
    >
      <div className="group/image relative h-[170px] shrink-0 overflow-hidden">
        <div
          className={`absolute inset-0 ${item.image ? "bg-slate-100" : "bg-[#323538]"}`}
          aria-hidden="true"
        >
          {item.image ? (
            <Image
              src={item.image}
              alt={titlePreview}
              fill
              sizes="(min-width: 1536px) 18vw, (min-width: 1280px) 22vw, (min-width: 1024px) 28vw, (min-width: 768px) 33vw, 50vw"
              className={`object-cover transition duration-200 ${isHidden ? "scale-[1.02] blur-[2px]" : ""}`}
            />
          ) : null}
        </div>

        <div
          className={`pointer-events-none absolute inset-0 ${isHidden ? "bg-[linear-gradient(180deg,rgba(15,23,42,0.18)_0%,rgba(15,23,42,0.42)_42%,rgba(15,23,42,0.6)_76%,rgba(15,23,42,0.72)_100%)]" : "bg-[linear-gradient(180deg,rgba(15,23,42,0.02)_0%,rgba(15,23,42,0.08)_48%,rgba(15,23,42,0.18)_100%)]"}`}
          aria-hidden="true"
        />

        <div className="absolute inset-y-0 right-3 z-20 flex flex-col items-end justify-center gap-2 opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100">
          {hoverStackButtons.map((action) => (
            <button
              key={action.key}
              type="button"
              className={`inline-flex h-[25px] min-w-[1.6rem] items-center justify-center rounded-md border px-0 leading-none shadow-[0_6px_18px_rgba(15,23,42,0.12)] transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 ${action.tone === "danger" ? "border-[#f1c1bd] bg-white text-[#d2554a] hover:bg-[#fff7f6]" : "border-slate-200 bg-white text-slate-900 hover:bg-slate-50"} ${action.dragHandle ? "cursor-grab active:cursor-grabbing" : ""}`}
              onPointerDown={(event) => {
                if (!action.dragHandle) {
                  event.stopPropagation();
                  event.preventDefault();
                }
              }}
              onClick={action.dragHandle ? undefined : action.onClick}
              aria-label={action.label}
              title={action.label}
              {...(action.dragHandle ? dragHandleProps : {})}
            >
              <span className="inline-flex h-full w-full items-center justify-center">
                {action.icon}
              </span>
            </button>
          ))}
        </div>

        {isHidden ? (
          <div className="absolute left-1/2 top-[44%] z-20 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#d2554a] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-white shadow-sm">
            SKRITO
          </div>
        ) : null}
      </div>

      <div className="relative flex h-[121px] flex-none flex-col px-3 pb-3 pt-2.5">
        <div
          className="absolute inset-x-0 top-0 h-5 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.9),rgba(255,255,255,0)_72%)]"
          aria-hidden="true"
        />
        <div className="relative flex h-full flex-col">
          <div className="relative min-h-[40px]">
            <div
              className={`min-h-[40px] min-w-0 ${isTitleEditing ? "invisible" : ""}`}
            >
              {item.hasChildren ? (
                <button
                  type="button"
                  className="w-full text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3e67d6]/30"
                  onPointerDown={(event) => {
                    event.stopPropagation();
                    event.preventDefault();
                  }}
                  onClick={() => onOpenNode(item)}
                  aria-label={`Odpri ${titlePreview}`}
                  title={item.openLabel}
                >
                  <p className="line-clamp-2 min-h-[40px] text-[0.92rem] font-semibold leading-5 text-slate-950">
                    {titlePreview}
                  </p>
                </button>
              ) : (
                <p className="line-clamp-2 min-h-[40px] text-[0.92rem] font-semibold leading-5 text-slate-950">
                  {titlePreview}
                </p>
              )}
            </div>
            {isTitleEditing ? (
              <div className="absolute inset-x-0 top-0 h-[40px]">
                {focusedField === "title" ? (
                  <CutCornerFocusOutline />
                ) : null}
                <InlineEditableText
                  id={`preview-title-${item.id}`}
                  aria-label="Naziv kategorije"
                  value={editingDraft?.title ?? titlePreview}
                  onChange={onEditingRowTitleChange}
                  onFocus={() => setFocusedField("title")}
                  onBlur={(event) => {
                    setFocusedField((current) => (current === "title" ? null : current));
                    handleCardEditBlur(event);
                  }}
                  autoFocus
                  placeCaretAtEndOnFocus
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && !event.shiftKey) {
                      event.preventDefault();
                      onCommitEdit();
                    }
                    if (event.key === "Escape") onCancelEdit();
                  }}
                  className="h-[40px] w-full overflow-hidden whitespace-pre-wrap bg-transparent px-0 py-0 font-['Inter',system-ui,sans-serif] text-[0.92rem] font-semibold leading-5 tracking-normal text-slate-950"
                />
              </div>
            ) : null}
          </div>

          <div className="relative mt-2 min-h-[66px] flex-1 overflow-hidden">
            <p
              className={`line-clamp-3 min-h-[60px] whitespace-pre-wrap text-[12px] leading-5 text-slate-950 ${isDescriptionEditing ? "invisible" : ""}`}
              onClick={() => {
                if (!isEditing || isDescriptionEditing) return;
                setFocusedField("description");
              }}
            >
              {descriptionPreview}
            </p>
            {isDescriptionEditing ? (
              <div className="relative min-h-[60px]">
                {focusedField === "description" ? (
                  <CutCornerFocusOutline />
                ) : null}
                <InlineEditableText
                  id={`preview-description-${item.id}`}
                  aria-label="Opis kategorije"
                  value={editingDraft?.description ?? descriptionPreview}
                  onChange={onEditingRowDescriptionChange}
                  onFocus={() => setFocusedField("description")}
                  onBlur={(event) => {
                    setFocusedField((current) => (current === "description" ? null : current));
                    handleCardEditBlur(event);
                  }}
                  onKeyDown={(event) => {
                    if (
                      (event.metaKey || event.ctrlKey) &&
                      event.key === "Enter"
                    ) {
                      event.preventDefault();
                      onCommitEdit();
                    }
                    if (event.key === "Escape") onCancelEdit();
                  }}
                  className="max-h-full min-h-[60px] w-full overflow-y-auto whitespace-pre-wrap bg-transparent px-0 py-0 font-['Inter',system-ui,sans-serif] text-[12px] leading-5 tracking-normal text-slate-950"
                />
              </div>
            ) : null}
          </div>

          {shouldShowHoverDetails && !isEditing ? (
            <div className="pointer-events-none absolute inset-x-4 bottom-4 z-10 rounded-xl border border-slate-200 bg-white/95 p-3 opacity-0 shadow-lg transition duration-150 group-hover:opacity-100 group-focus-within:opacity-100">
              <p className="whitespace-pre-wrap text-sm font-semibold leading-5 text-slate-950">
                {titlePreview}
              </p>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-5 text-slate-700">
                {descriptionPreview}
              </p>
            </div>
          ) : null}
        </div>
      </div>

      <input
        id={`preview-image-upload-${item.id}`}
        name={`previewImageUpload-${item.id}`}
        ref={(element) => {
          uploadRefs.current[item.id] = element;
        }}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(event) =>
          void onImageUpload(event.target.files?.[0] ?? null, item)
        }
      />
    </article>
  );
}, (prev, next) => {
  const prevEditingDraft = prev.editingRow?.id === prev.item.id ? prev.editingRow : null;
  const nextEditingDraft = next.editingRow?.id === next.item.id ? next.editingRow : null;

  return prev.item === next.item
    && prev.onSetImageDeleteTarget === next.onSetImageDeleteTarget
    && prev.onImageUpload === next.onImageUpload
    && prev.onStartEdit === next.onStartEdit
    && prev.onEditingRowTitleChange === next.onEditingRowTitleChange
    && prev.onEditingRowDescriptionChange === next.onEditingRowDescriptionChange
    && prev.onCommitEdit === next.onCommitEdit
    && prev.onCancelEdit === next.onCancelEdit
    && prev.onOpenNode === next.onOpenNode
    && prev.onStageStatusChange === next.onStageStatusChange
    && prev.uploadRefs === next.uploadRefs
    && prev.style.transform === next.style.transform
    && prev.style.transition === next.style.transition
    && prevEditingDraft?.title === nextEditingDraft?.title
    && prevEditingDraft?.description === nextEditingDraft?.description
    && prevEditingDraft?.status === nextEditingDraft?.status;
});

function CreateCategoryCard({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex min-h-[225px] flex-col items-center justify-center rounded-[18px] border border-dashed border-slate-300 bg-[color:var(--ui-neutral-bg)] px-6 text-center transition hover:border-slate-400 hover:bg-[color:var(--ui-neutral-bg-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3e67d6]/40"
      aria-label="Ustvari novo kategorijo"
    >
      <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-white text-slate-600 shadow-sm">
        <svg
          viewBox="0 0 24 24"
          className="h-5 w-5"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M12 5v14M5 12h14" />
        </svg>
      </span>
      <span className="mt-6 text-lg font-semibold text-slate-700">
        Ustvari kategorijo
      </span>
    </button>
  );
}

function EyeIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M1.5 12s3.75-6.75 10.5-6.75S22.5 12 22.5 12s-3.75 6.75-10.5 6.75S1.5 12 1.5 12Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function EyeOffIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
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
  onDragEnd,
}: {
  title: string;
  category: CatalogCategory;
  subcategory?: CatalogSubcategory;
  items: CatalogItem[];
  onDragEnd: (event: DragEndEvent) => void;
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
  );

  return (
    <div>
      <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
      <p className="mt-1 text-sm text-slate-600">
        Storefront-like pogled izdelkov iz izbrane kategorije.
      </p>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={onDragEnd}
      >
        <SortableContext
          items={items.map((item) => item.slug)}
          strategy={rectSortingStrategy}
        >
          <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {items.map((item) => {
              const sku = subcategory
                ? getCatalogItemSku(category.slug, subcategory.slug, item.slug)
                : getCatalogCategoryItemSku(category.slug, item.slug);
              const listPrice = subcategory
                ? getCatalogItemPrice(
                    category.slug,
                    subcategory.slug,
                    item.slug,
                  )
                : getCatalogCategoryItemPrice(category.slug, item.slug);
              const salePrice = getDiscountedPrice(listPrice, item.discountPct);
              const hasDiscount =
                typeof salePrice === "number" && salePrice < listPrice;

              return (
                <div
                  key={item.slug}
                  className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
                >
                  <div className="aspect-[4/3] rounded-xl bg-slate-50">
                    {item.image ? (
                      <Image
                        src={item.image}
                        alt={item.name}
                        width={640}
                        height={480}
                        className="h-full w-full rounded-xl object-cover"
                      />
                    ) : null}
                  </div>
                  <div className="mt-4 space-y-1">
                    <p className="text-sm font-semibold text-slate-900">
                      {item.name}
                    </p>
                    <p className="text-xs text-slate-500">SKU: {sku}</p>
                    <div className="flex items-center gap-2 text-sm">
                      <span className="font-semibold text-slate-900">
                        {formatCatalogPrice(
                          hasDiscount ? salePrice : listPrice,
                        )}
                      </span>
                      {hasDiscount ? (
                        <span className="text-xs text-slate-400 line-through">
                          {formatCatalogPrice(listPrice)}
                        </span>
                      ) : null}
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

function DragHandleIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="currentColor"
      aria-hidden="true"
    >
      <circle cx="7" cy="7" r="1.5" />
      <circle cx="12" cy="7" r="1.5" />
      <circle cx="17" cy="7" r="1.5" />
      <circle cx="7" cy="12" r="1.5" />
      <circle cx="12" cy="12" r="1.5" />
      <circle cx="17" cy="12" r="1.5" />
      <circle cx="7" cy="17" r="1.5" />
      <circle cx="12" cy="17" r="1.5" />
      <circle cx="17" cy="17" r="1.5" />
    </svg>
  );
}
