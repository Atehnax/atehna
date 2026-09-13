import type { Pool } from 'pg';
import type { DatabaseSchemaManifest } from './check-database-schema.mjs';
export function previousAuthContract(manifest: DatabaseSchemaManifest): DatabaseSchemaManifest;
export function resolveAdminAuthMigrationContract(manifest: DatabaseSchemaManifest): DatabaseSchemaManifest;
export function migrateAdminAuth(pool: Pool): Promise<void>;
