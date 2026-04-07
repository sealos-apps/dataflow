/**
 * DDL SQL generation utility.
 * Handles identifier quoting and cross-database syntax differences.
 */

export type SqlDialect = 'MYSQL' | 'POSTGRES' | 'SQLITE3' | 'CLICKHOUSE';

/** Resolve a frontend/backend connection type to a supported SQL dialect. */
export function resolveSqlDialect(dbType: string | undefined): SqlDialect {
  switch (dbType?.toUpperCase()) {
    case 'MYSQL':
      return 'MYSQL';
    case 'CLICKHOUSE':
      return 'CLICKHOUSE';
    case 'SQLITE3':
      return 'SQLITE3';
    default:
      return 'POSTGRES';
  }
}

/** Quote an identifier for the target database dialect. */
export function quoteId(name: string, dialect: SqlDialect): string {
  if (dialect === 'MYSQL' || dialect === 'CLICKHOUSE') {
    return `\`${name.replace(/`/g, '``')}\``;
  }
  return `"${name.replace(/"/g, '""')}"`;
}

/** Build a schema-qualified table reference. Only Postgres uses real schemas. */
export function qualifiedTable(dialect: SqlDialect, table: string, schema?: string): string {
  const q = quoteId(table, dialect);
  if (schema && dialect === 'POSTGRES') {
    return `${quoteId(schema, dialect)}.${q}`;
  }
  return q;
}

/** Build a quoted storage-unit reference directly from a connection type. */
export function buildStorageUnitReference(dbType: string | undefined, table: string, schema?: string): string {
  return qualifiedTable(resolveSqlDialect(dbType), table, schema);
}

// ---------------------------------------------------------------------------
// Database-level DDL
// ---------------------------------------------------------------------------

export function createDatabaseSQL(dialect: SqlDialect, name: string): string {
  return `CREATE DATABASE ${quoteId(name, dialect)}`;
}

export function dropDatabaseSQL(dialect: SqlDialect, name: string): string {
  return `DROP DATABASE ${quoteId(name, dialect)}`;
}

/**
 * Rename database. Postgres and ClickHouse support this natively.
 * Returns null if the dialect does not support it.
 */
export function renameDatabaseSQL(dialect: SqlDialect, oldName: string, newName: string): string | null {
  if (dialect === 'POSTGRES') {
    return `ALTER DATABASE ${quoteId(oldName, dialect)} RENAME TO ${quoteId(newName, dialect)}`;
  }
  if (dialect === 'CLICKHOUSE') {
    return `RENAME DATABASE ${quoteId(oldName, dialect)} TO ${quoteId(newName, dialect)}`;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Table-level DDL
// ---------------------------------------------------------------------------

export function dropTableSQL(dialect: SqlDialect, table: string, schema?: string): string {
  return `DROP TABLE ${qualifiedTable(dialect, table, schema)}`;
}

export function truncateTableSQL(dialect: SqlDialect, table: string, schema?: string): string {
  return `TRUNCATE TABLE ${qualifiedTable(dialect, table, schema)}`;
}

export function deleteAllRowsSQL(dialect: SqlDialect, table: string, schema?: string): string {
  if (dialect === 'CLICKHOUSE') {
    return `ALTER TABLE ${qualifiedTable(dialect, table, schema)} DELETE WHERE 1=1`;
  }
  return `DELETE FROM ${qualifiedTable(dialect, table, schema)}`;
}

export function renameTableSQL(dialect: SqlDialect, oldName: string, newName: string, schema?: string): string {
  const from = qualifiedTable(dialect, oldName, schema);
  if (dialect === 'MYSQL') {
    return `RENAME TABLE ${from} TO ${quoteId(newName, dialect)}`;
  }
  return `ALTER TABLE ${from} RENAME TO ${quoteId(newName, dialect)}`;
}

export function copyTableStructureSQL(dialect: SqlDialect, source: string, target: string, schema?: string): string {
  const src = qualifiedTable(dialect, source, schema);
  const tgt = qualifiedTable(dialect, target, schema);
  if (dialect === 'MYSQL') {
    return `CREATE TABLE ${tgt} LIKE ${src}`;
  }
  if (dialect === 'POSTGRES') {
    return `CREATE TABLE ${tgt} (LIKE ${src} INCLUDING ALL)`;
  }
  return `CREATE TABLE ${tgt} AS SELECT * FROM ${src} WHERE false`;
}

export function copyTableWithDataSQL(dialect: SqlDialect, source: string, target: string, schema?: string): string {
  const src = qualifiedTable(dialect, source, schema);
  const tgt = qualifiedTable(dialect, target, schema);
  if (dialect === 'MYSQL') {
    return `CREATE TABLE ${tgt} LIKE ${src};\nINSERT INTO ${tgt} SELECT * FROM ${src}`;
  }
  if (dialect === 'POSTGRES') {
    return `CREATE TABLE ${tgt} (LIKE ${src} INCLUDING ALL);\nINSERT INTO ${tgt} SELECT * FROM ${src}`;
  }
  return `CREATE TABLE ${tgt} AS SELECT * FROM ${src}`;
}

// ---------------------------------------------------------------------------
// ALTER TABLE — Column operations
// ---------------------------------------------------------------------------

export function addColumnSQL(
  dialect: SqlDialect, table: string, colName: string, colType: string,
  nullable: boolean, schema?: string,
): string {
  const tbl = qualifiedTable(dialect, table, schema);
  const nullClause = nullable ? 'NULL' : 'NOT NULL';
  return `ALTER TABLE ${tbl} ADD COLUMN ${quoteId(colName, dialect)} ${colType} ${nullClause}`;
}

export function dropColumnSQL(dialect: SqlDialect, table: string, colName: string, schema?: string): string {
  return `ALTER TABLE ${qualifiedTable(dialect, table, schema)} DROP COLUMN ${quoteId(colName, dialect)}`;
}

export function modifyColumnSQL(
  dialect: SqlDialect, table: string, colName: string, colType: string,
  nullable: boolean, schema?: string,
): string {
  const tbl = qualifiedTable(dialect, table, schema);
  const nullClause = nullable ? 'NULL' : 'NOT NULL';
  if (dialect === 'MYSQL') {
    return `ALTER TABLE ${tbl} MODIFY COLUMN ${quoteId(colName, dialect)} ${colType} ${nullClause}`;
  }
  const alterType = `ALTER TABLE ${tbl} ALTER COLUMN ${quoteId(colName, dialect)} TYPE ${colType}`;
  const alterNull = nullable
    ? `ALTER TABLE ${tbl} ALTER COLUMN ${quoteId(colName, dialect)} DROP NOT NULL`
    : `ALTER TABLE ${tbl} ALTER COLUMN ${quoteId(colName, dialect)} SET NOT NULL`;
  return `${alterType};\n${alterNull}`;
}

// ---------------------------------------------------------------------------
// ALTER TABLE — Index operations
// ---------------------------------------------------------------------------

export function createIndexSQL(
  dialect: SqlDialect, table: string, indexName: string,
  columns: string[], unique: boolean, schema?: string,
): string {
  const tbl = qualifiedTable(dialect, table, schema);
  const prefix = unique ? 'CREATE UNIQUE INDEX' : 'CREATE INDEX';
  const cols = columns.map(c => quoteId(c, dialect)).join(', ');
  return `${prefix} ${quoteId(indexName, dialect)} ON ${tbl} (${cols})`;
}

export function dropIndexSQL(dialect: SqlDialect, table: string, indexName: string, schema?: string): string {
  if (dialect === 'MYSQL') {
    return `DROP INDEX ${quoteId(indexName, dialect)} ON ${qualifiedTable(dialect, table, schema)}`;
  }
  if (schema && dialect === 'POSTGRES') {
    return `DROP INDEX ${quoteId(schema, dialect)}.${quoteId(indexName, dialect)}`;
  }
  return `DROP INDEX ${quoteId(indexName, dialect)}`;
}

// ---------------------------------------------------------------------------
// ALTER TABLE — Foreign key operations
// ---------------------------------------------------------------------------

export function addForeignKeySQL(
  dialect: SqlDialect, table: string, constraintName: string,
  column: string, refTable: string, refColumn: string,
  onDelete: string, onUpdate: string, schema?: string,
): string {
  const tbl = qualifiedTable(dialect, table, schema);
  const refTbl = qualifiedTable(dialect, refTable, schema);
  return `ALTER TABLE ${tbl} ADD CONSTRAINT ${quoteId(constraintName, dialect)} ` +
    `FOREIGN KEY (${quoteId(column, dialect)}) REFERENCES ${refTbl}(${quoteId(refColumn, dialect)}) ` +
    `ON DELETE ${onDelete} ON UPDATE ${onUpdate}`;
}

export function dropForeignKeySQL(dialect: SqlDialect, table: string, constraintName: string, schema?: string): string {
  const tbl = qualifiedTable(dialect, table, schema);
  if (dialect === 'MYSQL') {
    return `ALTER TABLE ${tbl} DROP FOREIGN KEY ${quoteId(constraintName, dialect)}`;
  }
  return `ALTER TABLE ${tbl} DROP CONSTRAINT ${quoteId(constraintName, dialect)}`;
}

// ---------------------------------------------------------------------------
// Schema introspection queries (used by EditTableModal)
// ---------------------------------------------------------------------------

/** Escape a string literal value for use in SQL WHERE clauses. */
function escLit(value: string): string {
  return value.replace(/'/g, "''");
}

export function columnsQuery(dialect: SqlDialect, database: string, table: string, schema?: string): string {
  if (dialect === 'MYSQL') {
    return `SELECT COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE, COLUMN_KEY ` +
      `FROM INFORMATION_SCHEMA.COLUMNS ` +
      `WHERE TABLE_SCHEMA = '${escLit(database)}' AND TABLE_NAME = '${escLit(table)}' ` +
      `ORDER BY ORDINAL_POSITION`;
  }
  if (dialect === 'POSTGRES') {
    const s = schema || 'public';
    return `SELECT c.column_name, c.data_type, c.is_nullable, ` +
      `CASE WHEN pk.column_name IS NOT NULL THEN 'PRI' ELSE '' END AS column_key ` +
      `FROM information_schema.columns c ` +
      `LEFT JOIN (` +
      `SELECT kcu.column_name FROM information_schema.table_constraints tc ` +
      `JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name ` +
      `AND tc.table_schema = kcu.table_schema ` +
      `WHERE tc.constraint_type = 'PRIMARY KEY' AND tc.table_schema = '${escLit(s)}' AND tc.table_name = '${escLit(table)}'` +
      `) pk ON c.column_name = pk.column_name ` +
      `WHERE c.table_schema = '${escLit(s)}' AND c.table_name = '${escLit(table)}' ` +
      `ORDER BY c.ordinal_position`;
  }
  return `PRAGMA table_info('${escLit(table)}')`;
}

export function indexesQuery(dialect: SqlDialect, database: string, table: string, schema?: string): string {
  if (dialect === 'MYSQL') {
    return `SELECT INDEX_NAME, GROUP_CONCAT(COLUMN_NAME ORDER BY SEQ_IN_INDEX) AS COLUMNS, ` +
      `NON_UNIQUE, INDEX_TYPE ` +
      `FROM INFORMATION_SCHEMA.STATISTICS ` +
      `WHERE TABLE_SCHEMA = '${escLit(database)}' AND TABLE_NAME = '${escLit(table)}' ` +
      `GROUP BY INDEX_NAME, NON_UNIQUE, INDEX_TYPE`;
  }
  if (dialect === 'POSTGRES') {
    const s = schema || 'public';
    return `SELECT i.relname AS index_name, ` +
      `array_to_string(ARRAY(SELECT a.attname FROM pg_attribute a WHERE a.attrelid = t.oid AND a.attnum = ANY(ix.indkey) ORDER BY a.attnum), ',') AS columns, ` +
      `ix.indisunique AS is_unique, am.amname AS index_type ` +
      `FROM pg_index ix ` +
      `JOIN pg_class t ON t.oid = ix.indrelid ` +
      `JOIN pg_class i ON i.oid = ix.indexrelid ` +
      `JOIN pg_am am ON am.oid = i.relam ` +
      `JOIN pg_namespace n ON n.oid = t.relnamespace ` +
      `WHERE t.relname = '${escLit(table)}' AND n.nspname = '${escLit(s)}' ` +
      `AND NOT ix.indisprimary`;
  }
  return `PRAGMA index_list('${escLit(table)}')`;
}

export function foreignKeysQuery(dialect: SqlDialect, database: string, table: string, schema?: string): string {
  if (dialect === 'MYSQL') {
    return `SELECT kcu.CONSTRAINT_NAME, kcu.COLUMN_NAME, kcu.REFERENCED_TABLE_NAME, kcu.REFERENCED_COLUMN_NAME, ` +
      `rc.UPDATE_RULE, rc.DELETE_RULE ` +
      `FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE kcu ` +
      `JOIN INFORMATION_SCHEMA.REFERENTIAL_CONSTRAINTS rc ON kcu.CONSTRAINT_NAME = rc.CONSTRAINT_NAME ` +
      `AND kcu.TABLE_SCHEMA = rc.CONSTRAINT_SCHEMA ` +
      `WHERE kcu.TABLE_SCHEMA = '${escLit(database)}' AND kcu.TABLE_NAME = '${escLit(table)}' ` +
      `AND kcu.REFERENCED_TABLE_NAME IS NOT NULL`;
  }
  if (dialect === 'POSTGRES') {
    const s = schema || 'public';
    return `SELECT tc.constraint_name, kcu.column_name, ccu.table_name AS referenced_table_name, ` +
      `ccu.column_name AS referenced_column_name, rc.update_rule, rc.delete_rule ` +
      `FROM information_schema.table_constraints tc ` +
      `JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name ` +
      `AND tc.table_schema = kcu.table_schema ` +
      `JOIN information_schema.constraint_column_usage ccu ON tc.constraint_name = ccu.constraint_name ` +
      `AND tc.table_schema = ccu.table_schema ` +
      `JOIN information_schema.referential_constraints rc ON tc.constraint_name = rc.constraint_name ` +
      `AND tc.constraint_schema = rc.constraint_schema ` +
      `WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_schema = '${escLit(s)}' AND tc.table_name = '${escLit(table)}'`;
  }
  return `PRAGMA foreign_key_list('${escLit(table)}')`;
}
