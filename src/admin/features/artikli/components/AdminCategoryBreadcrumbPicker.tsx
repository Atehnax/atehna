'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import AdminBreadcrumbPath from '@/shared/ui/admin-breadcrumb-path';

type CategoryNodeEntry = {
  key: string;
  path: string[];
  title: string;
  fullPath: string;
  depth: number;
  parentKey: string;
  isLeaf: boolean;
};

const normalizeSearch = (value: string) =>
  value
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .trim();

const isSlugLikeTitle = (value: string) => /^[a-z0-9]+(?:-[a-z0-9]+)+$/.test(value.trim().toLowerCase());

const toPathParts = (value: string) =>
  value
    .split('/')
    .map((entry) => entry.trim())
    .filter(Boolean);

const pathKeyFromParts = (path: string[]) => path.join(' / ');

const buildCategoryIndex = (paths: string[]) => {
  const childrenByParent = new Map<string, Set<string>>();
  const entriesByKey = new Map<string, CategoryNodeEntry>();

  const ensureEntry = (path: string[]) => {
    const key = pathKeyFromParts(path);
    if (entriesByKey.has(key)) return;

    entriesByKey.set(key, {
      key,
      path,
      title: path[path.length - 1] ?? '',
      fullPath: path.join(' → '),
      depth: path.length,
      parentKey: pathKeyFromParts(path.slice(0, -1)),
      isLeaf: true
    });
  };

  paths.forEach((pathValue) => {
    const parts = toPathParts(pathValue);
    if (parts.length === 0) return;

    parts.forEach((_, index) => {
      const parent = parts.slice(0, index);
      const current = parts.slice(0, index + 1);
      const parentKey = pathKeyFromParts(parent);
      const currentKey = pathKeyFromParts(current);

      ensureEntry(current);
      if (!childrenByParent.has(parentKey)) childrenByParent.set(parentKey, new Set());
      childrenByParent.get(parentKey)?.add(currentKey);

      if (parent.length > 0) {
        const parentEntry = entriesByKey.get(parentKey);
        if (parentEntry) parentEntry.isLeaf = false;
      }
    });
  });

  const entries = Array.from(entriesByKey.values()).sort((a, b) => a.fullPath.localeCompare(b.fullPath, 'sl'));
  return {
    entries,
    entryMap: entriesByKey,
    childrenByParent
  };
};

export default function AdminCategoryBreadcrumbPicker({
  value,
  onChange,
  categoryPaths,
  disabled,
  placeholder = 'Izberi kategorijo',
  className = 'col-span-2'
}: {
  value: string[];
  onChange: (path: string[]) => void;
  categoryPaths: string[];
  disabled?: boolean;
  placeholder?: string;
  className?: string;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [drillPath, setDrillPath] = useState<string[]>(value);
  const [activeIndex, setActiveIndex] = useState(0);

  const allPaths = useMemo(() => {
    const selectedPath = value.join(' / ');
    return Array.from(new Set(selectedPath ? [...categoryPaths, selectedPath] : categoryPaths));
  }, [categoryPaths, value]);

  const categoryIndex = useMemo(() => buildCategoryIndex(allPaths), [allPaths]);

  const drillChildren = useMemo(() => {
    const key = pathKeyFromParts(drillPath);
    const childKeys = Array.from(categoryIndex.childrenByParent.get(key) ?? []);

    return childKeys
      .map((childKey) => categoryIndex.entryMap.get(childKey))
      .filter((entry): entry is CategoryNodeEntry => {
        if (!entry) return false;
        return !isSlugLikeTitle(entry.title);
      })
      .sort((a, b) => a.title.localeCompare(b.title, 'sl'));
  }, [categoryIndex.childrenByParent, categoryIndex.entryMap, drillPath]);

  const searchResults = useMemo(() => {
    const normalizedQuery = normalizeSearch(query);
    if (!normalizedQuery) return drillChildren;

    return categoryIndex.entries
      .filter((entry) => {
        if (isSlugLikeTitle(entry.title)) return false;
        const normalizedTitle = normalizeSearch(entry.title);
        return normalizedTitle.includes(normalizedQuery);
      })
      .slice(0, 60);
  }, [categoryIndex.entries, drillChildren, query]);

  useEffect(() => {
    setDrillPath(value);
  }, [value]);

  useEffect(() => {
    if (!isOpen) return;

    const handleOutsideClick = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsOpen(false);
    };

    document.addEventListener('mousedown', handleOutsideClick);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query, drillPath]);

  const assignPath = (path: string[]) => {
    onChange(path);
    setDrillPath(path);
    setIsOpen(false);
    setQuery('');
  };

  const breadcrumbItems =
    value.length === 0
      ? [
          {
            key: 'categories-root',
            label: 'Kategorije',
            isCurrent: false,
            onClick: disabled ? undefined : () => {
              setDrillPath([]);
              setQuery('');
              setIsOpen(true);
            }
          },
          {
            key: 'categories-placeholder',
            label: placeholder,
            isCurrent: false,
            onClick: disabled ? undefined : () => setIsOpen(true),
            labelClassName: `font-semibold ${disabled ? 'text-slate-900' : 'text-[#1982bf] underline decoration-[#1982bf]/70 underline-offset-2'}`
          }
        ]
      : [
          {
            key: 'categories-root',
            label: 'Kategorije',
            isCurrent: false,
            onClick: disabled ? undefined : () => {
              setDrillPath([]);
              setQuery('');
              setIsOpen(true);
            }
          },
          ...value.map((segment, index) => ({
            label: segment,
            key: `${segment}-${index}`,
            title: value.slice(0, index + 1).join(' / '),
            isCurrent: false,
            onClick: disabled ? undefined : () => {
              setDrillPath(value.slice(0, index + 1));
              setQuery('');
              setIsOpen(true);
            },
            labelClassName: index === value.length - 1 ? 'inline-block max-w-[260px] truncate align-bottom font-semibold text-slate-900' : undefined
          }))
        ];

  return (
    <div ref={containerRef} className={`relative ${className}`.trim()}>
      <label className="sr-only">Kategorija</label>
      <div
        className="flex h-full min-h-7 w-full items-center text-left"
        role="group"
        aria-label="Izbira poti kategorije"
      >
        <span className="min-w-0 truncate text-sm text-slate-700" onClick={() => {
          if (disabled || isOpen || value.length === 0) return;
          setDrillPath(value);
          setQuery('');
          setIsOpen(true);
        }}>
          <span className="inline-flex items-center gap-1">
            <AdminBreadcrumbPath
              items={breadcrumbItems}
              className="truncate whitespace-nowrap text-sm text-slate-700"
            />
            {!disabled ? <span className="text-slate-400">›</span> : null}
          </span>
        </span>
      </div>

      {isOpen ? (
        <div className="absolute z-30 mt-1 w-full rounded-md border border-slate-200 bg-white p-2 shadow-lg">
          <div className="rounded-md border border-slate-300 bg-white transition-colors focus-within:border-[#3e67d6]">
            <input
              autoFocus
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Escape') {
                  setIsOpen(false);
                  return;
                }
                if (event.key === 'ArrowDown') {
                  event.preventDefault();
                  setActiveIndex((current) => Math.min(current + 1, Math.max(0, searchResults.length - 1)));
                  return;
                }
                if (event.key === 'ArrowUp') {
                  event.preventDefault();
                  setActiveIndex((current) => Math.max(current - 1, 0));
                  return;
                }
                if (event.key === 'Enter') {
                  event.preventDefault();
                  const current = searchResults[activeIndex];
                  if (!current) return;
                  if (current.isLeaf) {
                    assignPath(current.path);
                  } else {
                    setDrillPath(current.path);
                    setQuery('');
                  }
                }
              }}
              placeholder="Išči po naslovu kategorije"
              aria-label="Išči kategorijo"
              className="h-8 w-full rounded-md border-0 bg-transparent px-2 text-xs text-slate-700 outline-none focus:outline-none focus:ring-0"
            />
          </div>

          {query.length === 0 && drillPath.length > 0 ? (
            <div className="mt-1 flex items-center justify-between rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] text-slate-600">
              <span className="truncate">{drillPath.join(' → ')}</span>
              <button
                type="button"
                className="ml-2 text-[#1f3f93] hover:text-[#19316f] disabled:text-slate-300"
                onClick={() => {
                  const current = categoryIndex.entryMap.get(pathKeyFromParts(drillPath));
                  if (current?.isLeaf) assignPath(drillPath);
                }}
                disabled={!categoryIndex.entryMap.get(pathKeyFromParts(drillPath))?.isLeaf}
              >
                Izberi
              </button>
            </div>
          ) : null}

          <div className="mt-1 max-h-56 overflow-y-auto" role="listbox" aria-label="Rezultati kategorij">
            {searchResults.length === 0 ? <p className="px-2 py-2 text-xs text-slate-500">Ni zadetkov.</p> : null}
            {searchResults.map((entry, index) => (
              <button
                key={entry.key}
                type="button"
                role="option"
                aria-selected={index === activeIndex}
                className={`flex w-full items-start justify-between gap-2 rounded-md px-2 py-1.5 text-left text-xs ${
                  index === activeIndex ? 'bg-[#f0f4ff] text-[#1f3f93]' : 'hover:bg-slate-50 text-slate-700'
                }`}
                onMouseEnter={() => setActiveIndex(index)}
                onClick={() => {
                  if (entry.isLeaf) {
                    assignPath(entry.path);
                  } else {
                    setDrillPath(entry.path);
                    setQuery('');
                  }
                }}
              >
                <span className="min-w-0">
                  <span className="block truncate font-medium">{entry.title}</span>
                </span>
                <span className="shrink-0 text-[10px] text-slate-400">{entry.isLeaf ? 'končna' : 'odpri'}</span>
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
