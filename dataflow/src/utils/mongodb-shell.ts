const DOT_NOTATION_COLLECTION_PATTERN = /^[A-Za-z_][\w.]*$/

/** Build a MongoDB shell collection accessor, falling back to getCollection for unsafe names. */
export function buildMongoCollectionAccessor(collectionName: string): string {
  if (DOT_NOTATION_COLLECTION_PATTERN.test(collectionName)) {
    return `db.${collectionName}`
  }

  return `db.getCollection(${JSON.stringify(collectionName)})`
}

/** Build a MongoDB shell command against a collection. */
export function buildMongoCollectionCommand(
  collectionName: string,
  method: string,
  rawArgs = '',
): string {
  return `${buildMongoCollectionAccessor(collectionName)}.${method}(${rawArgs})`
}

/** Parse strict JSON document input from the UI and reject non-object payloads. */
export function parseMongoDocumentInput(content: string): Record<string, unknown> {
  const parsed = JSON.parse(content)

  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('MongoDB document input must be a JSON object')
  }

  return parsed as Record<string, unknown>
}

/** Build an insertOne command for a parsed MongoDB document payload. */
export function buildMongoInsertOneCommand(
  collectionName: string,
  document: Record<string, unknown>,
): string {
  return buildMongoCollectionCommand(collectionName, 'insertOne', JSON.stringify(document))
}

/** Build a MongoDB shell command that drops the current database. */
export function buildMongoDropDatabaseCommand(): string {
  return 'db.dropDatabase()'
}
