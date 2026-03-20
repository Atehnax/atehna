import type { AdminCategoriesPayload } from './types';

let cachedPayload: AdminCategoriesPayload | null = null;

export const getAdminCategoriesSessionPayload = () => cachedPayload;

export const setAdminCategoriesSessionPayload = (payload: AdminCategoriesPayload) => {
  cachedPayload = {
    categories: payload.categories,
    statuses: payload.statuses ? { ...payload.statuses } : undefined
  };
};

export const clearAdminCategoriesSessionPayload = () => {
  cachedPayload = null;
};
