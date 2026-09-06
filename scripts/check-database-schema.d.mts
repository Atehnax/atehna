import type { PoolClient } from 'pg';
export type DatabaseSchemaManifest = {
  contractId: string;
  contractSha256: string;
  requirements: Record<string, unknown>;
};
export function canonicalize(value: unknown): unknown;
export function requirementsSha256(requirements: unknown): string;
export function validateManifest(value: unknown): DatabaseSchemaManifest;
export function loadManifest(): Promise<DatabaseSchemaManifest>;
export function verifyRepositoryContract(manifest: DatabaseSchemaManifest): Promise<void>;
export function verifyDatabaseContract(client: Pick<PoolClient, 'query'>, manifest: DatabaseSchemaManifest): Promise<void>;
