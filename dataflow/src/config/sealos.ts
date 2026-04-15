/**
 * Sealos integration helpers.
 *
 * Detects Sealos dbprovider context, maps KubeBlocks database types to
 * WhoDB plugin types, and parses bootstrap metadata.
 */

/**
 * Detect whether the current URL was opened by the Sealos dbprovider.
 * Sealos passes `dbType` (KubeBlocks type name); WhoDB natively uses `type`.
 */
export function isSealosContext(params: URLSearchParams): boolean {
  return params.has('dbType') && params.has('resourceName');
}

/** Maps KubeBlocks database type names to WhoDB DatabaseType ids. */
const typeMap: Record<string, string> = {
  postgresql: 'Postgres',
  'apecloud-mysql': 'MySQL',
  mongodb: 'MongoDB',
  redis: 'Redis',
  clickhouse: 'ClickHouse',
};

/** Maps KubeBlocks database types to their default database names. */
const defaultDB: Record<string, string> = {
  postgresql: 'postgres',
  'apecloud-mysql': '',
  mongodb: 'admin',
  redis: '',
  clickhouse: 'default',
};

/** Map a KubeBlocks dbType to a WhoDB plugin type. Returns undefined if unsupported. */
export function mapSealosDbType(dbType: string): string | undefined {
  return typeMap[dbType];
}

/** Get the default database name for a KubeBlocks dbType. */
export function getDefaultDatabase(dbType: string): string {
  return defaultDB[dbType] ?? '';
}
