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
const CATEGORY_PICKER_MENU_BASE_WIDTH_PX = 470;
const CHILD_PLACEHOLDER_LABEL = 'Izberi podkategorijo';

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
  const [focusedSegmentIndex, setFocusedSegmentIndex] = useState<number | null>(null);
  const [expandedCollapsedSegments, setExpandedCollapsedSegments] = useState<Set<number>>(new Set());
  const [menuWidthPx, setMenuWidthPx] = useState<number | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  const allPaths = useMemo(() => {
    const selectedPath = value.join(' / ');
    return Array.from(new Set(selectedPath ? [...categoryPaths, selectedPath] : categoryPaths));
  }, [categoryPaths, value]);

  const categoryIndex = useMemo(() => buildCategoryIndex(allPaths), [allPaths]);

  function resolveVisibleChildren(path: string[]) {
    const key = pathKeyFromParts(path);
    const childKeys = Array.from(categoryIndex.childrenByParent.get(key) ?? []);

    return childKeys
      .map((childKey) => categoryIndex.entryMap.get(childKey))
      .filter((entry): entry is CategoryNodeEntry => {
        if (!entry) return false;
        return !isSlugLikeTitle(entry.title);
      })
      .sort((a, b) => a.title.localeCompare(b.title, 'sl'));
  }

  const drillChildren = useMemo(() => {
    return resolveVisibleChildren(drillPath);
  }, [categoryIndex.childrenByParent, categoryIndex.entryMap, drillPath]);

  const searchResults = useMemo(() => {
    const normalizedQuery = normalizeSearch(query);
    if (focusedSegmentIndex !== null) {
      if (!normalizedQuery) return drillChildren;

      return drillChildren
        .filter((entry) => normalizeSearch(entry.title).includes(normalizedQuery))
        .slice(0, 60);
    }

    if (!normalizedQuery) return drillChildren;

    return categoryIndex.entries
      .filter((entry) => {
        if (isSlugLikeTitle(entry.title)) return false;
        const normalizedTitle = normalizeSearch(entry.title);
        return normalizedTitle.includes(normalizedQuery);
      })
      .slice(0, 60);
  }, [categoryIndex.entries, drillChildren, focusedSegmentIndex, query]);

  useEffect(() => {
    setDrillPath(value);
  }, [value]);

  useEffect(() => {
    if (!isOpen) {
      setFocusedSegmentIndex(null);
      setExpandedCollapsedSegments(new Set());
      setMenuWidthPx(null);
      return;
    }
    if (menuWidthPx !== null) return;
    const nextWidth = Math.max(320, Math.min(window.innerWidth - 24, CATEGORY_PICKER_MENU_BASE_WIDTH_PX));
    if (nextWidth > 0) setMenuWidthPx(nextWidth);
  }, [isOpen, menuWidthPx]);

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

  const displayedPath = value.length > 0 ? value : isOpen ? drillPath : value;
  const displayedPathChildren = useMemo(() => {
    if (displayedPath.length === 0) return [];
    return resolveVisibleChildren(displayedPath);
  }, [categoryIndex.childrenByParent, categoryIndex.entryMap, displayedPath]);
  const hasDisplayedPathChildren = displayedPathChildren.length > 0;

  const assignFocusedPath = (path: string[]) => {
    if (focusedSegmentIndex === null) {
      assignPath(path);
      return;
    }

    const currentSegmentPath = displayedPath.slice(0, focusedSegmentIndex + 1);
    const nextPath = pathKeyFromParts(path) === pathKeyFromParts(currentSegmentPath) ? displayedPath : path;
    assignPath(nextPath);
  };

  const isCollapsibleIndex = (index: number) =>
    displayedPath.length >= 4 && index > 0 && index < displayedPath.length - 2;

  const baseBreadcrumbItems =
    displayedPath.length === 0
      ? [
          {
            key: 'categories-placeholder',
            label: placeholder,
            isCurrent: false,
            onClick: disabled ? undefined : () => {
              setFocusedSegmentIndex(null);
              setDrillPath([]);
              setQuery('');
              setIsOpen(true);
            },
            labelClassName: `font-semibold ${disabled ? 'text-slate-900' : 'text-[#1982bf]'}`
          }
        ]
      : displayedPath.map((segment, index) => {
            const isCollapsed = isCollapsibleIndex(index);
            const isFocused = focusedSegmentIndex === index;
            const isRightMostVisibleCrumb = index === displayedPath.length - 1 && !hasDisplayedPathChildren;
            const shouldShowNeighbor =
              focusedSegmentIndex !== null && Math.abs(focusedSegmentIndex - index) === 1 && isCollapsed;
            const isUserExpanded = expandedCollapsedSegments.has(index);
            const isExpanded = isUserExpanded || shouldShowNeighbor;
            const showCollapsedToken = isCollapsed && !isExpanded && !isFocused;
            return {
              label: showCollapsedToken ? '··' : segment,
              key: `${segment}-${index}`,
              title: displayedPath.slice(0, index + 1).join(' / '),
              isCurrent: false,
              onClick:
                disabled
                  ? undefined
                  : () => {
                      setFocusedSegmentIndex(index);
                      setExpandedCollapsedSegments((current) => {
                        if (showCollapsedToken) {
                          const next = new Set(Array.from(current).filter((item) => Math.abs(item - index) <= 1));
                          if (next.has(index)) next.delete(index);
                          else next.add(index);
                          return next;
                        }
                        return new Set(Array.from(current).filter((item) => Math.abs(item - index) === 1));
                      });
                      if (showCollapsedToken) {
                        return;
                      }
                      setDrillPath(displayedPath.slice(0, index));
                      setQuery('');
                      setIsOpen(true);
                    },
              labelClassName:
                isRightMostVisibleCrumb
                  ? `inline-block max-w-[260px] truncate align-bottom font-semibold text-[#1982bf] ${isFocused ? 'underline decoration-[#1982bf]/70 underline-offset-2' : ''}`.trim()
                  : showCollapsedToken
                    ? 'text-slate-500'
                    : isFocused
                      ? 'underline decoration-slate-500/70 underline-offset-2'
                      : undefined
            };
          });

  const breadcrumbItems =
    hasDisplayedPathChildren && displayedPath.length > 0
      ? [
          ...baseBreadcrumbItems,
          {
            key: `${pathKeyFromParts(displayedPath)}-child-placeholder`,
            label: CHILD_PLACEHOLDER_LABEL,
            title: 'Izberi podkategorijo',
            isCurrent: false,
            onClick:
              disabled
                ? undefined
                : () => {
                    setFocusedSegmentIndex(displayedPath.length);
                    setExpandedCollapsedSegments(new Set());
                    setDrillPath(displayedPath);
                    setQuery('');
                    setIsOpen(true);
                  },
            labelClassName: `font-semibold text-[#1982bf] ${
              focusedSegmentIndex === displayedPath.length ? 'underline decoration-[#1982bf]/70 underline-offset-2' : ''
            }`.trim()
          }
        ]
      : baseBreadcrumbItems;

  return (
    <div ref={containerRef} className={`relative ${className}`.trim()}>
      <label className="sr-only">Kategorija</label>
      <div
        className="flex h-full min-h-7 w-full items-center text-left"
        role="group"
        aria-label="Izbira poti kategorije"
      >
        <span className="min-w-0 truncate text-xs text-slate-700" onClick={(event) => {
          if (disabled || isOpen || displayedPath.length === 0) return;
          const target = event.target as HTMLElement;
          if (target.closest('button')) return;
          setFocusedSegmentIndex(null);
          setDrillPath(displayedPath);
          setQuery('');
          setIsOpen(true);
        }}>
          <span className="inline-flex items-center gap-1">
            <AdminBreadcrumbPath
              items={breadcrumbItems}
              className="truncate whitespace-nowrap text-xs text-slate-700"
            />
            {!disabled ? <span className="text-slate-400">›</span> : null}
          </span>
        </span>
      </div>

      {isOpen ? (
        <div
          data-ignore-edit-shortcuts="true"
          className="absolute left-0 top-full z-30 mt-1 rounded-md border border-slate-200 bg-white p-2 shadow-lg"
          style={{ width: menuWidthPx ? `${menuWidthPx}px` : `${CATEGORY_PICKER_MENU_BASE_WIDTH_PX}px` }}
        >
          <div className="rounded-md border border-slate-300 bg-white transition-colors focus-within:border-[#3e67d6]">
            <input
              data-ignore-edit-shortcuts="true"
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
                  if (focusedSegmentIndex !== null) {
                    assignFocusedPath(current.path);
                  } else if (current.isLeaf) {
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

          {query.length === 0 && drillPath.length > 0 && focusedSegmentIndex === null ? (
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
                  if (focusedSegmentIndex !== null) {
                    assignFocusedPath(entry.path);
                  } else if (entry.isLeaf) {
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
