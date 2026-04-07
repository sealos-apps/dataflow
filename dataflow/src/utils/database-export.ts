type ConnectionType = 'MYSQL' | 'POSTGRES' | 'MONGODB' | 'REDIS' | 'CLICKHOUSE'
type ExportFormat = 'csv' | 'json' | 'sql' | 'excel'

interface BuildDatabaseExportPlanOptions {
  connectionType: ConnectionType | undefined
  fallbackSchema: string
  allSchemas: string[]
  systemSchemas: string[]
  includeSystemSchemas: boolean
}

/** Resolve which logical schema buckets should be exported for a database export. */
export function buildDatabaseExportPlan({
  connectionType,
  fallbackSchema,
  allSchemas,
  systemSchemas,
  includeSystemSchemas,
}: BuildDatabaseExportPlanOptions): string[] {
  if (connectionType === 'POSTGRES') {
    const filteredSchemas = includeSystemSchemas
      ? allSchemas
      : allSchemas.filter((schema) => !systemSchemas.includes(schema))
    return [...new Set(filteredSchemas)]
  }

  return fallbackSchema ? [fallbackSchema] : []
}

/** Build the ZIP entry path for a storage unit export. */
export function formatDatabaseExportEntryName(
  connectionType: ConnectionType | undefined,
  schema: string,
  tableName: string,
  format: ExportFormat,
): string {
  const filename = `${tableName}.${format === 'excel' ? 'xlsx' : format}`
  if (connectionType === 'POSTGRES') {
    return `${schema}/${filename}`
  }
  return filename
}

/** Human-readable label for progress and partial failure messages. */
export function formatDatabaseExportTargetName(
  connectionType: ConnectionType | undefined,
  schema: string,
  tableName: string,
): string {
  if (connectionType === 'POSTGRES') {
    return `${schema}.${tableName}`
  }
  return tableName
}
