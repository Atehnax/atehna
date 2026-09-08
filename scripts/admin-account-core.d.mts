export interface AdminSetupClient {
  query(text: string, values?: unknown[]): Promise<{ rows: Record<string, unknown>[] }>;
  release(): void;
}
export interface AdminSetupPool {
  connect(): Promise<AdminSetupClient>;
}
export interface AdminAccountInitializationOptions {
  legacyImport?: boolean;
}
export class AdminAccountSetupError extends Error {}
export function validateAdminCredentials(username: unknown, password: unknown, options?: AdminAccountInitializationOptions): { username: string; password: string };
export function initializeAdminAccount(pool: AdminSetupPool, input: { username: unknown; password: unknown }, options?: AdminAccountInitializationOptions): Promise<void>;
