export * from '@/commercial/pages/page';
export { default } from '@/commercial/pages/page';

// Only complete public output may enter the route cache.
export const dynamic = 'error';
export const revalidate = 60;
