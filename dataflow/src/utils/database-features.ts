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
  'MySQL', 'MongoDB', 'Redis', 'ClickHouse',
]);

const TYPES_WITH_SCHEMA_SUPPORT: ReadonlySet<string> = new Set([
  'POSTGRES', 'Postgres',
]);

const TYPES_WITH_DATABASE_SWITCHING: ReadonlySet<string> = new Set([
  'POSTGRES', 'MYSQL', 'MONGODB', 'REDIS', 'CLICKHOUSE',
  'Postgres', 'MySQL', 'MongoDB', 'Redis', 'ClickHouse',
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
  if (usesDatabaseAsSchema(dbType)) {
    return databaseName;
  }
  // Postgres-like: use provided schema or default to "public"
  return schemaName || 'public';
}

/**
 * Returns the Monaco editor language identifier for a given database type.
 *
 * - MongoDB → 'javascript'
 * - Redis   → 'plaintext'
 * - Others  → 'sql'
 */
export function getEditorLanguage(dbType: string): string {
  const upper = dbType.toUpperCase();
  if (upper === 'MONGODB') return 'javascript';
  if (upper === 'REDIS') return 'plaintext';
  return 'sql';
}

/**
 * Returns a placeholder hint string for the editor based on the database type.
 *
 * - MongoDB → 'db.collection.find({ })'
 * - Redis   → 'GET key'
 * - Others  → 'SELECT * FROM table_name'
 */
export function getEditorPlaceholder(dbType: string): string {
  const upper = dbType.toUpperCase();
  if (upper === 'MONGODB') return 'db.collection.find({ })';
  if (upper === 'REDIS') return 'GET key';
  return 'SELECT * FROM table_name';
}

const REDIS_READ_COMMANDS: ReadonlySet<string> = new Set([
  'GET', 'MGET', 'HGET', 'HGETALL', 'HMGET', 'HKEYS', 'HVALS', 'HLEN',
  'LRANGE', 'LLEN', 'LINDEX',
  'SMEMBERS', 'SCARD', 'SISMEMBER',
  'ZRANGE', 'ZREVRANGE', 'ZRANGEBYSCORE', 'ZSCORE', 'ZCARD',
  'KEYS', 'SCAN', 'EXISTS', 'TYPE', 'TTL', 'PTTL', 'DBSIZE', 'INFO',
  'STRLEN', 'PING', 'ECHO', 'CONFIG',
]);

const MONGODB_READ_PATTERN = /\.(find|findOne|countDocuments|aggregate|distinct|getIndexes)\s*\(/;

const SQL_READ_PATTERN = /^\s*(SELECT|WITH|VALUES|SHOW|EXPLAIN|DESCRIBE)\b/i;
const SQL_COMMENT_PATTERN = /\/\*[\s\S]*?\*\/|--[^\n]*/g;

/**
 * Detects whether a query is a read (non-mutating) operation.
 *
 * - MongoDB: matches `.find()`, `.findOne()`, `.countDocuments()`, `.aggregate()`,
 *   `.distinct()`, or `.getIndexes()` call patterns.
 * - Redis: checks if the first token is a known read command.
 * - SQL: strips comments then checks if the statement starts with SELECT, WITH,
 *   VALUES, SHOW, EXPLAIN, or DESCRIBE.
 */
export function isReadOperation(dbType: string, query: string): boolean {
  const upper = dbType.toUpperCase();
  if (upper === 'MONGODB') {
    return MONGODB_READ_PATTERN.test(query);
  }
  if (upper === 'REDIS') {
    const firstToken = query.trim().split(/\s+/)[0]?.toUpperCase() ?? '';
    return REDIS_READ_COMMANDS.has(firstToken);
  }
  // SQL: strip comments then check leading keyword
  const stripped = query.replace(SQL_COMMENT_PATTERN, '').trimStart();
  return SQL_READ_PATTERN.test(stripped);
}
