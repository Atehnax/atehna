'use client';
import { createContext, useContext, useEffect } from 'react';
export type ArticleNavigationGuard = (label: string, navigate: () => void) => void;
export const ArticleNavigationGuardContext = createContext<(guard: ArticleNavigationGuard | null) => void>(() => {});
export function useArticleNavigationGuard(guard: ArticleNavigationGuard) {
  const register = useContext(ArticleNavigationGuardContext);
  useEffect(() => { register(guard); return () => register(null); }, [guard, register]);
}
