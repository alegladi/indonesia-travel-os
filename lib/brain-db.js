import { neon } from '@neondatabase/serverless';

export function databaseUrl() {
  return process.env.DATABASE_URL || process.env.NEON_DATABASE_URL || process.env.POSTGRES_URL || process.env.STORAGE_URL || '';
}

export function getDb() {
  const url = databaseUrl();
  if (!url) throw new Error('DATABASE_NOT_CONFIGURED');
  return neon(url);
}
