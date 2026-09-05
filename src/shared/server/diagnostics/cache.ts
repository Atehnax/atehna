import 'server-only';
import { revalidatePath as invalidatePath, revalidateTag as invalidateTag } from 'next/cache';
import { recordCatalogInvalidation } from './instrumentation';
export function revalidateTag(...args: Parameters<typeof invalidateTag>) {
  invalidateTag(...args);
  recordCatalogInvalidation({ context: 'cache', tags: [args[0]] });
}
export function revalidatePath(...args: Parameters<typeof invalidatePath>) {
  invalidatePath(...args);
  recordCatalogInvalidation({ context: args[0], tags: [], revalidatedPaths: 1 });
}
