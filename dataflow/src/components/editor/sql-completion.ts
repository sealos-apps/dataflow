import type * as Monaco from 'monaco-editor';

/** Column metadata used by the SQL completion provider. */
export interface ColumnInfo {
  name: string;
  type: string;
  isPrimary: boolean;
  isForeignKey: boolean;
}

/** Schema metadata (tables and their columns) passed to the SQL completion provider. */
export interface SQLCompletionData {
  tables: string[];
  columns: Map<string, ColumnInfo[]>;
}

const SQL_KEYWORDS = [
  'SELECT', 'FROM', 'WHERE', 'JOIN', 'LEFT', 'RIGHT', 'INNER', 'OUTER',
  'FULL', 'CROSS', 'ON', 'GROUP', 'BY', 'ORDER', 'HAVING', 'INSERT',
  'INTO', 'UPDATE', 'DELETE', 'CREATE', 'ALTER', 'DROP', 'TRUNCATE',
  'AS', 'AND', 'OR', 'NOT', 'IN', 'BETWEEN', 'LIKE', 'ILIKE', 'IS',
  'NULL', 'LIMIT', 'OFFSET', 'DISTINCT', 'COUNT', 'SUM', 'AVG', 'MIN',
  'MAX', 'CASE', 'WHEN', 'THEN', 'ELSE', 'END', 'EXISTS', 'UNION',
  'ALL', 'VALUES', 'SET', 'ASC', 'DESC', 'TRUE', 'FALSE', 'DEFAULT',
  'PRIMARY', 'KEY', 'FOREIGN', 'REFERENCES', 'INDEX', 'UNIQUE',
  'CONSTRAINT', 'CASCADE', 'CHECK', 'COALESCE', 'CAST', 'EXTRACT',
  'SUBSTRING', 'TRIM', 'UPPER', 'LOWER', 'CONCAT', 'LENGTH', 'REPLACE',
  'ROUND', 'CEIL', 'FLOOR', 'ABS', 'NOW', 'CURRENT_TIMESTAMP',
  'CURRENT_DATE', 'CURRENT_TIME', 'DATE', 'TIME', 'TIMESTAMP',
  'INTERVAL', 'INTEGER', 'INT', 'BIGINT', 'SMALLINT', 'DECIMAL',
  'NUMERIC', 'REAL', 'FLOAT', 'DOUBLE', 'VARCHAR', 'CHAR', 'TEXT',
  'BOOLEAN', 'SERIAL', 'BIGSERIAL', 'UUID', 'JSON', 'JSONB', 'ARRAY',
  'BYTEA', 'BLOB', 'CLOB', 'XML',
];

/** Keywords after which we suggest table names. */
const TABLE_CONTEXT_KEYWORDS = new Set([
  'FROM', 'JOIN', 'INTO', 'UPDATE', 'TABLE',
  'INNER', 'LEFT', 'RIGHT', 'OUTER', 'FULL', 'CROSS',
]);

/** Keywords after which we suggest columns from referenced tables. */
const COLUMN_CONTEXT_KEYWORDS = new Set([
  'SELECT', 'WHERE', 'SET', 'ON', 'AND', 'OR',
  'GROUP', 'ORDER', 'HAVING', 'BY',
]);

/**
 * Scan backwards from cursor to find the nearest SQL context keyword,
 * skipping over identifiers, commas, operators, literals, etc.
 * This handles cases like `SELECT col1, col2, |` where the nearest
 * keyword is SELECT, not col2.
 */
function getPrecedingKeyword(textBeforeCursor: string): string {
  const withoutPartial = textBeforeCursor.replace(/\w+$/, '').trimEnd();
  const tokens = withoutPartial.match(/\w+/g);
  if (!tokens) return '';
  for (let i = tokens.length - 1; i >= 0; i--) {
    const upper = tokens[i].toUpperCase();
    if (TABLE_CONTEXT_KEYWORDS.has(upper) || COLUMN_CONTEXT_KEYWORDS.has(upper)) {
      return upper;
    }
  }
  return '';
}

/**
 * Check if the cursor is after "tablename." and return the table name.
 * Handles: tablename.  "tablename".  "schema"."tablename".  schema.tablename.
 */
function getDotTableName(
  textBeforeCursor: string,
  knownTables: Set<string>,
): string | null {
  // Match: optional_schema_part. then tablename (quoted or unquoted) then dot then optional partial word
  // We want the last identifier before the final dot.
  // Patterns: word.\w*$  |  "word".\w*$  |  word.word.\w*$  |  "word"."word".\w*$
  const match = textBeforeCursor.match(/(?:"([^"]+)"|(\w+))\.(?:"[^"]*"?|\w*)$/);
  if (!match) return null;
  const candidate = match[1] ?? match[2]; // match[1] = quoted, match[2] = unquoted
  for (const table of knownTables) {
    if (table.toLowerCase() === candidate.toLowerCase()) return table;
  }
  return null;
}

/**
 * Scan the full query text for tables referenced after FROM/JOIN keywords.
 * Handles: FROM t1, t2  |  FROM "t1"  |  FROM "schema"."t1"  |  JOIN t2
 */
function getReferencedTables(
  fullText: string,
  knownTables: Set<string>,
): Set<string> {
  const referenced = new Set<string>();

  const addIfKnown = (candidate: string) => {
    for (const table of knownTables) {
      if (table.toLowerCase() === candidate.toLowerCase()) {
        referenced.add(table);
      }
    }
  };

  // Extract the last identifier (table name) from a possibly schema-qualified reference
  const extractTableName = (ref: string): string | null => {
    const m = ref.trim().match(/(?:(?:"[^"]+"|[\w]+)\.)*(?:"([^"]+)"|(\w+))/);
    return m ? (m[1] ?? m[2]) : null;
  };

  // 1. FROM clauses — capture everything up to the next clause keyword, then split by comma
  const fromPattern = /\bFROM\s+([\s\S]+?)(?=\b(?:WHERE|JOIN|INNER|LEFT|RIGHT|FULL|CROSS|ORDER|GROUP|HAVING|LIMIT|UNION|ON|SET|VALUES|INTO)\b|;|$)/gi;
  let fromMatch;
  while ((fromMatch = fromPattern.exec(fullText)) !== null) {
    for (const part of fromMatch[1].split(',')) {
      const name = extractTableName(part);
      if (name) addIfKnown(name);
    }
  }

  // 2. JOIN clauses — single table per JOIN
  const joinPattern = /\bJOIN\s+(?:(?:"[^"]+"|[\w]+)\.)*(?:"([^"]+)"|(\w+))/gi;
  let joinMatch;
  while ((joinMatch = joinPattern.exec(fullText)) !== null) {
    const candidate = joinMatch[1] ?? joinMatch[2];
    addIfKnown(candidate);
  }

  return referenced;
}

/** Format PK/FK badge suffix for a column (e.g. ` [PK, FK]`). */
function formatColumnBadge(col: ColumnInfo): string {
  const badges: string[] = [];
  if (col.isPrimary) badges.push('PK');
  if (col.isForeignKey) badges.push('FK');
  return badges.length > 0 ? ` [${badges.join(', ')}]` : '';
}

/**
 * Register a SQL completion provider with the given metadata.
 * Returns a Disposable to unregister the provider.
 */
export function registerSQLCompletionProvider(
  monaco: typeof Monaco,
  data: SQLCompletionData,
): Monaco.IDisposable {
  const knownTables = new Set(data.tables);

  return monaco.languages.registerCompletionItemProvider('sql', {
    triggerCharacters: ['.'],

    provideCompletionItems(
      model: Monaco.editor.ITextModel,
      position: Monaco.Position,
    ): Monaco.languages.CompletionList {
      const textBeforeCursor = model.getValueInRange({
        startLineNumber: 1,
        startColumn: 1,
        endLineNumber: position.lineNumber,
        endColumn: position.column,
      });

      const word = model.getWordUntilPosition(position);
      const range: Monaco.IRange = {
        startLineNumber: position.lineNumber,
        endLineNumber: position.lineNumber,
        startColumn: word.startColumn,
        endColumn: word.endColumn,
      };

      const suggestions: Monaco.languages.CompletionItem[] = [];

      // Context 1: After "tablename." -> columns of that table
      const dotTable = getDotTableName(textBeforeCursor, knownTables);
      if (dotTable) {
        const cols = data.columns.get(dotTable) ?? [];
        for (const col of cols) {
          suggestions.push({
            label: col.name,
            kind: monaco.languages.CompletionItemKind.Field,
            detail: `${col.type}${formatColumnBadge(col)}`,
            sortText: `1_${col.name}`,
            insertText: col.name,
            range,
          });
        }
        return { suggestions };
      }

      const precedingKeyword = getPrecedingKeyword(textBeforeCursor);

      // Context 2: After FROM/JOIN/INTO/UPDATE/TABLE -> table names
      if (TABLE_CONTEXT_KEYWORDS.has(precedingKeyword)) {
        for (const table of data.tables) {
          suggestions.push({
            label: table,
            kind: monaco.languages.CompletionItemKind.Struct,
            sortText: `0_${table}`,
            insertText: table,
            range,
          });
        }
        return { suggestions };
      }

      // Context 3: After SELECT/WHERE/ON/AND/OR/GROUP/ORDER/HAVING/BY
      // -> columns from referenced tables + keywords
      if (COLUMN_CONTEXT_KEYWORDS.has(precedingKeyword)) {
        const fullText = model.getValue();
        const referenced = getReferencedTables(fullText, knownTables);

        for (const tableName of referenced) {
          const cols = data.columns.get(tableName) ?? [];
          for (const col of cols) {
            suggestions.push({
              label: col.name,
              kind: monaco.languages.CompletionItemKind.Field,
              detail: `${tableName}.${col.type}${formatColumnBadge(col)}`,
              sortText: `1_${col.name}`,
              insertText: col.name,
              range,
            });
          }
        }

        for (const kw of SQL_KEYWORDS) {
          suggestions.push({
            label: kw,
            kind: monaco.languages.CompletionItemKind.Keyword,
            sortText: `2_${kw}`,
            insertText: kw,
            range,
          });
        }
        return { suggestions };
      }

      // Context 4: Default -> keywords + table names
      for (const table of data.tables) {
        suggestions.push({
          label: table,
          kind: monaco.languages.CompletionItemKind.Struct,
          sortText: `0_${table}`,
          insertText: table,
          range,
        });
      }
      for (const kw of SQL_KEYWORDS) {
        suggestions.push({
          label: kw,
          kind: monaco.languages.CompletionItemKind.Keyword,
          sortText: `2_${kw}`,
          insertText: kw,
          range,
        });
      }

      return { suggestions };
    },
  });
}
