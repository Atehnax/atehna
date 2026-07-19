'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  cloneDefaultCategoryShowcaseMediaSettings,
  normalizeCategoryShowcaseMediaSettings,
  type CategoryShowcaseItem,
  type CategoryShowcaseMediaSettings
} from './categoryShowcaseSchema';
import { publishCategoryDataChange } from './categoryShowcaseSync';

export type CategoryShowcasePersistedUpdate = {
  categoryId?: string;
  categorySlug: string;
  image?: string | null;
  presentation: CategoryShowcaseMediaSettings;
  revision?: string;
};

type CategoryShowcaseSubmittedUpdate = CategoryShowcasePersistedUpdate & {
  expectedRevision?: string;
};

type PendingCategoryShowcaseEdit = {
  revision: number;
  file?: File | null;
  objectUrl?: string | null;
  imageTouched: boolean;
  presentation: CategoryShowcaseMediaSettings;
};

type UseCategoryShowcaseEditorOptions = {
  items: CategoryShowcaseItem[];
  onPersisted?: (updates: CategoryShowcasePersistedUpdate[]) => void;
  endpoint?: string;
};

function itemKey(item: Pick<CategoryShowcaseItem, 'id' | 'slug'>) {
  return item.id || item.slug;
}

function revokeObjectUrl(value: string | null | undefined) {
  if (value?.startsWith('blob:')) URL.revokeObjectURL(value);
}

function presentationsEqual(
  left: CategoryShowcaseMediaSettings,
  right: CategoryShowcaseMediaSettings
): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

export function useCategoryShowcaseEditor({
  items,
  onPersisted,
  endpoint = '/api/admin/categories/images'
}: UseCategoryShowcaseEditorOptions) {
  const [pending, setPending] = useState<Record<string, PendingCategoryShowcaseEdit>>({});
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const revisionRef = useRef(0);
  const pendingRef = useRef(pending);

  useEffect(() => {
    pendingRef.current = pending;
  }, [pending]);

  useEffect(() => () => {
    Object.values(pendingRef.current).forEach((edit) => revokeObjectUrl(edit.objectUrl));
  }, []);

  const displayedItems = useMemo(() => items.map((item) => {
    const draft = pending[itemKey(item)];
    if (!draft) {
      return {
        ...item,
        presentation: normalizeCategoryShowcaseMediaSettings(item.presentation)
      };
    }

    return {
      ...item,
      image: draft.imageTouched ? draft.objectUrl ?? null : item.image,
      presentation: draft.presentation
    };
  }), [items, pending]);

  const selectedItem = useMemo(
    () => displayedItems.find((item) => item.slug === selectedSlug) ?? null,
    [displayedItems, selectedSlug]
  );

  const updatePresentation = useCallback((categorySlug: string, updates: Partial<CategoryShowcaseMediaSettings>) => {
    const source = items.find((item) => item.slug === categorySlug);
    if (!source) return;
    const key = itemKey(source);

    setPending((current) => {
      const existing = current[key];
      const base = existing?.presentation ?? normalizeCategoryShowcaseMediaSettings(source.presentation);
      const nextPresentation = normalizeCategoryShowcaseMediaSettings({
        ...base,
        ...updates,
        crop: updates.crop ? { ...base.crop, ...updates.crop } : base.crop,
        focalPoint: updates.focalPoint ? { ...base.focalPoint, ...updates.focalPoint } : base.focalPoint
      });
      const persistedPresentation = normalizeCategoryShowcaseMediaSettings(source.presentation);
      if (!existing?.imageTouched && presentationsEqual(nextPresentation, persistedPresentation)) {
        if (!existing) return current;
        const next = { ...current };
        delete next[key];
        return next;
      }
      revisionRef.current += 1;
      return {
        ...current,
        [key]: {
          revision: revisionRef.current,
          file: existing?.file,
          objectUrl: existing?.objectUrl,
          imageTouched: existing?.imageTouched ?? false,
          presentation: nextPresentation
        }
      };
    });
  }, [items]);

  const stageImage = useCallback((categorySlug: string, file: File | null) => {
    const source = items.find((item) => item.slug === categorySlug);
    if (!source) return;
    const key = itemKey(source);
    const objectUrl = file ? URL.createObjectURL(file) : null;

    setPending((current) => {
      const existing = current[key];
      revokeObjectUrl(existing?.objectUrl);
      revisionRef.current += 1;
      return {
        ...current,
        [key]: {
          revision: revisionRef.current,
          file,
          objectUrl,
          imageTouched: true,
          presentation: existing?.presentation ?? normalizeCategoryShowcaseMediaSettings(source.presentation)
        }
      };
    });
  }, [items]);

  const resetItem = useCallback((categorySlug: string) => {
    const source = items.find((item) => item.slug === categorySlug);
    if (!source) return;
    const key = itemKey(source);
    setPending((current) => {
      const edit = current[key];
      if (!edit) return current;
      revokeObjectUrl(edit.objectUrl);
      const next = { ...current };
      delete next[key];
      return next;
    });
  }, [items]);

  const resetPresentation = useCallback((categorySlug: string) => {
    updatePresentation(categorySlug, cloneDefaultCategoryShowcaseMediaSettings());
  }, [updatePresentation]);

  const resetAll = useCallback(() => {
    setPending((current) => {
      Object.values(current).forEach((edit) => revokeObjectUrl(edit.objectUrl));
      return {};
    });
  }, []);

  const save = useCallback(async () => {
    const snapshot = pendingRef.current;
    const entries = Object.entries(snapshot);
    if (entries.length === 0) return [] as CategoryShowcasePersistedUpdate[];

    setIsSaving(true);
    try {
      const updates = await Promise.all(entries.map(async ([key, edit]) => {
        const item = items.find((candidate) => itemKey(candidate) === key);
        if (!item) throw new Error('Kategorija za shranjevanje ne obstaja.');

        let image: string | null | undefined;
        if (edit.imageTouched) {
          if (edit.file) {
            const formData = new FormData();
            formData.append('file', edit.file);
            formData.append('categorySlug', item.slug);
            const uploadResponse = await fetch(endpoint, { method: 'POST', body: formData });
            const uploadBody = await uploadResponse.json().catch(() => ({})) as { url?: string; message?: string };
            if (!uploadResponse.ok || !uploadBody.url) {
              throw new Error(uploadBody.message || 'Nalaganje slike kategorije ni uspelo.');
            }
            image = uploadBody.url;
          } else {
            image = null;
          }
        }

        return {
          categoryId: item.id || undefined,
          categorySlug: item.slug,
          ...(item.revision ? { expectedRevision: item.revision } : {}),
          ...(edit.imageTouched ? { image } : {}),
          presentation: edit.presentation
        } satisfies CategoryShowcaseSubmittedUpdate;
      }));

      const response = await fetch(endpoint, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ updates })
      });
      const body = await response.json().catch(() => ({})) as { message?: string; updates?: unknown[] };
      if (!response.ok) {
        throw new Error(
          body.message || (response.status === 409
            ? 'Kategorija je bila med urejanjem spremenjena. Osvežite podatke in poskusite znova.'
            : 'Shranjevanje predstavitve kategorij ni uspelo.')
        );
      }

      const persistedUpdates = updates.map((submitted, index): CategoryShowcasePersistedUpdate => {
        const rawSaved = body.updates?.[index];
        const saved = rawSaved && typeof rawSaved === 'object' && !Array.isArray(rawSaved)
          ? rawSaved as Record<string, unknown>
          : {};
        const hasSavedImage = Object.prototype.hasOwnProperty.call(saved, 'image');
        const savedPresentation = saved.presentation && typeof saved.presentation === 'object'
          ? normalizeCategoryShowcaseMediaSettings(saved.presentation)
          : submitted.presentation;

        return {
          categoryId:
            (typeof saved.categoryId === 'string' && saved.categoryId) ||
            (typeof saved.id === 'string' && saved.id) ||
            submitted.categoryId,
          categorySlug:
            (typeof saved.categorySlug === 'string' && saved.categorySlug) ||
            (typeof saved.slug === 'string' && saved.slug) ||
            submitted.categorySlug,
          ...(hasSavedImage
            ? { image: saved.image === null ? null : typeof saved.image === 'string' ? saved.image : undefined }
            : Object.prototype.hasOwnProperty.call(submitted, 'image') ? { image: submitted.image } : {}),
          presentation: savedPresentation,
          ...(typeof saved.revision === 'string' ? { revision: saved.revision } : {})
        };
      });

      setPending((current) => {
        const next = { ...current };
        entries.forEach(([key, submitted]) => {
          if (next[key]?.revision !== submitted.revision) return;
          revokeObjectUrl(next[key]?.objectUrl);
          delete next[key];
        });
        return next;
      });
      onPersisted?.(persistedUpdates);
      publishCategoryDataChange('showcase');
      return persistedUpdates;
    } finally {
      setIsSaving(false);
    }
  }, [endpoint, items, onPersisted]);

  return {
    items: displayedItems,
    selectedItem,
    selectedSlug,
    setSelectedSlug,
    updatePresentation,
    stageImage,
    resetItem,
    resetPresentation,
    resetAll,
    save,
    isSaving,
    isDirty: Object.keys(pending).length > 0,
    pendingCount: Object.keys(pending).length
  };
}
