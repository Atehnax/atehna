'use client';

import { createContext, useContext, type Dispatch, type SetStateAction } from 'react';
import type { CatalogBrowserFilters, CatalogBrowserSort } from '@/commercial/catalog/catalogBrowserFilters';
import type { CatalogBrowserNavigation, CatalogBrowserProps } from '@/commercial/catalog/catalogBrowserTypes';

type CatalogBrowserState = {
  filters: CatalogBrowserFilters;
  setSort: (sort: CatalogBrowserSort) => void;
  isFiltering: boolean;
  hasFilters: boolean;
  collapsed: Set<string>;
  setCollapsed: Dispatch<SetStateAction<Set<string>>>;
  resetFilters: () => void;
  toggle: (id: string) => void;
  navigation: CatalogBrowserNavigation[];
};

export const CatalogBrowserContext = createContext<CatalogBrowserState | null>(null);
export const useCatalogBrowserContext = () => useContext(CatalogBrowserContext);
export function useCatalogBrowserState() {
  const context = useCatalogBrowserContext();
  if (!context) throw new Error('Catalog results require the shared catalog layout.');
  return context;
}

export const CatalogBrowserDataContext = createContext<{
  publishPage: (page: CatalogBrowserProps) => void;
  invalidatePage: (href: string) => void;
} | null>(null);
export const useCatalogBrowserDataContext = () => useContext(CatalogBrowserDataContext);
