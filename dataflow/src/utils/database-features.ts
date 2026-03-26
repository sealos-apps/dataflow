/**
 * Database type feature detection utilities.
 *
 * Ported from frontend/src/utils/database-features.ts.
 * Accepts both DataFlow uppercase types ('POSTGRES', 'MYSQL', ...)
 * and WhoDB mixed-case types ('Postgres', 'MySQL', ...).
 */

// Accepts both DataFlow uppercase types ('MYSQL') and WhoDB mixed-case types ('MySQL')
const TYPES_USING_DATABASE_AS_SCHEMA: ReadonlySet<string> = new Set([
  'MYSQL', 'MONGODB', 'REDIS', 'CLICKHOUSE',
  'MySQL', 'MariaDb', 'MongoDB', 'Redis', 'ClickHouse',
]);

const TYPES_WITH_SCHEMA_SUPPORT: ReadonlySet<string> = new Set([
  'POSTGRES', 'Postgres',
]);

const TYPES_WITH_DATABASE_SWITCHING: ReadonlySet<string> = new Set([
  'POSTGRES', 'MYSQL', 'MONGODB', 'REDIS', 'CLICKHOUSE',
  'Postgres', 'MySQL', 'MariaDb', 'MongoDB', 'Redis', 'ClickHouse',
]);

/**
 * Returns true if this database type uses the database name as the
 * `schema` parameter in GraphQL queries (StorageUnit, Row, etc.).
 *
 * - Postgres: false (uses actual schema names like "public")
 * - MySQL/MongoDB/Redis/ClickHouse: true (schema param = database name)
 */
export function usesDatabaseAsSchema(dbType: string | undefined): boolean {
  return dbType != null && TYPES_USING_DATABASE_AS_SCHEMA.has(dbType);
}

/**
 * Returns true if this database type supports a schema hierarchy
 * (separate from the database level). Currently only Postgres.
 */
export function supportsSchema(dbType: string | undefined): boolean {
  return dbType != null && TYPES_WITH_SCHEMA_SUPPORT.has(dbType);
}

/**
 * Returns true if this database type supports switching between databases.
 */
export function supportsDatabaseSwitching(dbType: string | undefined): boolean {
  return dbType != null && TYPES_WITH_DATABASE_SWITCHING.has(dbType);
}

const NOSQL_TYPES: ReadonlySet<string> = new Set([
  'MONGODB', 'MongoDB', 'MongoDb',
  'REDIS', 'Redis',
  'ELASTICSEARCH', 'ElasticSearch',
]);

/**
 * Returns true if this database type is a NoSQL database (MongoDB, Redis, ElasticSearch).
 */
export function isNoSQL(dbType: string | undefined): boolean {
  return dbType != null && NOSQL_TYPES.has(dbType);
}

/**
 * Resolve the `schema` GraphQL parameter for a given context.
 *
 * - Postgres table in schema "public", database "mydb" → "public"
 * - MySQL table in database "mydb" → "mydb"
 */
export function resolveSchemaParam(
  dbType: string | undefined,
  databaseName: string,
  schemaName?: string,
): string {
  if (schemaName && !usesDatabaseAsSchema(dbType)) {
    return schemaName;
  }
  return databaseName;
}
