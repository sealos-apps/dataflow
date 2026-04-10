/**
 * Splits a Redis input into individual commands on newlines.
 * Each non-empty, trimmed line becomes one command. Lines whose first
 * non-whitespace character starts a comment (`#` or `//`) are dropped —
 * these are documentation-style markers users commonly copy from examples
 * and must not be forwarded as commands. Inline `#` inside a command payload
 * is preserved because Redis values can legitimately contain `#`.
 */
export function splitRedisCommands(input: string): string[] {
  return input
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith('#') && !line.startsWith('//'));
}

/** Set of keywords (uppercase) that start a transaction block. */
const TRANSACTION_START = new Set([
  'BEGIN', 'BEGIN WORK', 'BEGIN TRANSACTION', 'START TRANSACTION',
]);

/** Set of keywords (uppercase) that end a transaction block. */
const TRANSACTION_END = new Set([
  'COMMIT', 'COMMIT WORK', 'COMMIT TRANSACTION',
  'ROLLBACK', 'ROLLBACK WORK', 'ROLLBACK TRANSACTION',
  'END', 'END WORK', 'END TRANSACTION',
  'ABORT', 'ABORT WORK', 'ABORT TRANSACTION',
]);

/** Keywords that should be blocked when sent as standalone statements (excludes ROLLBACK variants). */
const TRANSACTION_BLOCKED_STANDALONE = new Set([
  ...TRANSACTION_START,
  'COMMIT', 'COMMIT WORK', 'COMMIT TRANSACTION',
  'END', 'END WORK', 'END TRANSACTION',
  'ABORT', 'ABORT WORK', 'ABORT TRANSACTION',
]);

/**
 * Strips SQL comments (-- line and block) and normalizes whitespace/case
 * for transaction keyword matching. The original text is preserved elsewhere
 * — this is only used for equality checks against keyword sets.
 */
function normalizeForKeywordMatch(sql: string): string {
  const noLineComments = sql.replace(/--[^\n]*/g, ' ');
  const noBlockComments = noLineComments.replace(/\/\*[\s\S]*?\*\//g, ' ');
  return noBlockComments.trim().replace(/\s+/g, ' ').toUpperCase();
}

/**
 * Returns true if the statement is a standalone transaction control keyword
 * that should NOT be sent to the backend individually.
 * ROLLBACK variants are excluded — they are harmless and useful for recovery.
 */
export function isStandaloneTransactionStatement(sql: string): boolean {
  return TRANSACTION_BLOCKED_STANDALONE.has(normalizeForKeywordMatch(sql));
}

/**
 * Splits a MongoDB shell input into individual statements on top-level
 * semicolons. Respects JS string literals (single, double, backtick with
 * escapes), `//` line comments, `/* *\/` block comments, and brace/bracket/
 * paren nesting depth so semicolons inside `{ ... }`, `[ ... ]`, `( ... )`,
 * strings, or comments are not treated as separators.
 *
 * Statements whose only meaningful content is comments or whitespace are
 * dropped. Non-command statements (e.g., `const x = 1`) are kept so the
 * caller can surface a clear, targeted error instead of silently ignoring.
 */
export function splitMongoStatements(input: string): string[] {
  const statements: string[] = [];
  let current = '';
  let i = 0;
  let depth = 0;

  while (i < input.length) {
    const ch = input[i];

    // Line comment: consume until newline (exclusive)
    if (ch === '/' && input[i + 1] === '/') {
      const end = input.indexOf('\n', i);
      if (end === -1) {
        current += input.slice(i);
        i = input.length;
        break;
      }
      current += input.slice(i, end);
      i = end;
      continue;
    }

    // Block comment: consume until closing */
    if (ch === '/' && input[i + 1] === '*') {
      const end = input.indexOf('*/', i + 2);
      if (end === -1) {
        current += input.slice(i);
        i = input.length;
        break;
      }
      current += input.slice(i, end + 2);
      i = end + 2;
      continue;
    }

    // String literal: consume until matching unescaped close quote
    if (ch === '"' || ch === "'" || ch === '`') {
      const quote = ch;
      current += ch;
      i++;
      while (i < input.length) {
        const c = input[i];
        if (c === '\\' && i + 1 < input.length) {
          current += input.slice(i, i + 2);
          i += 2;
          continue;
        }
        if (c === quote) {
          current += c;
          i++;
          break;
        }
        current += c;
        i++;
      }
      continue;
    }

    // Track nesting depth so semicolons inside braces/brackets/parens are kept
    if (ch === '{' || ch === '[' || ch === '(') {
      depth++;
      current += ch;
      i++;
      continue;
    }
    if (ch === '}' || ch === ']' || ch === ')') {
      if (depth > 0) depth--;
      current += ch;
      i++;
      continue;
    }

    if (ch === ';' && depth === 0) {
      pushMongoStatement(statements, current);
      current = '';
      i++;
      continue;
    }

    current += ch;
    i++;
  }

  pushMongoStatement(statements, current);
  return statements;
}

/**
 * Push a statement into the result slice if it has meaningful content.
 * Statements that are empty or consist only of comments/whitespace are dropped.
 */
function pushMongoStatement(statements: string[], raw: string): void {
  const trimmed = raw.trim();
  if (!trimmed) return;
  if (!hasNonCommentContent(trimmed)) return;
  statements.push(trimmed);
}

/**
 * Strip `//` and `/* *\/` comments from s and return the remaining text.
 * Tracks single, double, and backtick string literals (with `\` escape) so
 * comment markers inside strings are preserved. Used for detecting whether
 * a statement has any non-comment content and for `isLikelyMongoCommand`'s
 * prefix check.
 */
function stripJSComments(s: string): string {
  let out = '';
  let i = 0;
  while (i < s.length) {
    const ch = s[i];

    // Preserve string literals verbatim — comment markers inside must be ignored.
    if (ch === '"' || ch === "'" || ch === '`') {
      const quote = ch;
      out += ch;
      i++;
      while (i < s.length) {
        const c = s[i];
        if (c === '\\' && i + 1 < s.length) {
          out += s.slice(i, i + 2);
          i += 2;
          continue;
        }
        if (c === quote) {
          out += c;
          i++;
          break;
        }
        out += c;
        i++;
      }
      continue;
    }

    if (ch === '/' && s[i + 1] === '/') {
      const end = s.indexOf('\n', i);
      if (end === -1) break;
      i = end;
      continue;
    }
    if (ch === '/' && s[i + 1] === '*') {
      const end = s.indexOf('*/', i + 2);
      if (end === -1) break;
      i = end + 2;
      continue;
    }
    out += ch;
    i++;
  }
  return out;
}

function hasNonCommentContent(s: string): boolean {
  return stripJSComments(s).trim().length > 0;
}

const MONGO_COMMAND_PREFIX = /^db\s*(\.|\()/;

/**
 * Returns true if the statement looks like a MongoDB shell command that the
 * backend parser can handle: `db.collection.method(...)`,
 * `db.getCollection("name").method(...)`, or `db.method(...)`. Comments and
 * leading whitespace are stripped before the prefix check. Anything else
 * (variable declarations, functions, loops, plain expressions) returns false.
 */
export function isLikelyMongoCommand(s: string): boolean {
  const stripped = stripJSComments(s).trim();
  if (!stripped) return false;
  return MONGO_COMMAND_PREFIX.test(stripped);
}

/**
 * Splits a SQL string into individual statements on semicolons,
 * respecting single-quoted strings, double-quoted identifiers,
 * backtick-quoted identifiers (MySQL), single-line comments (--),
 * and block comments.
 *
 * Returns trimmed, non-empty statements (no trailing semicolons).
 */
export function splitSQLStatements(sql: string): string[] {
  const statements: string[] = [];
  let current = '';
  let i = 0;
  let inTransaction = false;
  let transactionBlock = '';

  while (i < sql.length) {
    const ch = sql[i];

    // Single-line comment: skip to end of line
    if (ch === '-' && sql[i + 1] === '-') {
      const end = sql.indexOf('\n', i);
      if (end === -1) {
        current += sql.slice(i);
        break;
      }
      current += sql.slice(i, end);
      i = end;
      continue;
    }

    // Block comment: skip to closing */
    if (ch === '/' && sql[i + 1] === '*') {
      const end = sql.indexOf('*/', i + 2);
      if (end === -1) {
        current += sql.slice(i);
        break;
      }
      current += sql.slice(i, end + 2);
      i = end + 2;
      continue;
    }

    // Quoted string or identifier: consume until matching close quote
    if (ch === "'" || ch === '"' || ch === '`') {
      const quote = ch;
      current += ch;
      i++;
      while (i < sql.length) {
        const c = sql[i];
        if (c === '\\') {
          // Backslash escape (MySQL style)
          current += sql.slice(i, i + 2);
          i += 2;
          continue;
        }
        if (c === quote) {
          current += c;
          i++;
          // Doubled quote escape (SQL standard)
          if (i < sql.length && sql[i] === quote) {
            current += sql[i];
            i++;
            continue;
          }
          break;
        }
        current += c;
        i++;
      }
      continue;
    }

    // Semicolon delimiter: flush current statement
    if (ch === ';') {
      const trimmed = current.trim();
      current = '';
      i++;

      if (!trimmed) continue;

      const normalized = normalizeForKeywordMatch(trimmed);
      if (inTransaction) {
        // Preserve every sub-statement inside a transaction block — even
        // pure-comment ones — so the script's original structure is intact.
        transactionBlock += trimmed + ';\n';
        if (TRANSACTION_END.has(normalized)) {
          statements.push(transactionBlock.trim());
          transactionBlock = '';
          inTransaction = false;
        }
      } else if (TRANSACTION_START.has(normalized)) {
        inTransaction = true;
        transactionBlock = trimmed + ';\n';
      } else if (normalized.length === 0) {
        // Pure-comment statement at the top level — drop instead of forwarding
        // an empty query that most engines would reject.
        continue;
      } else {
        statements.push(trimmed);
      }
      continue;
    }

    current += ch;
    i++;
  }

  const trimmed = current.trim();
  if (trimmed) {
    if (inTransaction) {
      transactionBlock += trimmed;
      statements.push(transactionBlock.trim());
    } else if (normalizeForKeywordMatch(trimmed).length > 0) {
      statements.push(trimmed);
    }
  } else if (inTransaction && transactionBlock.trim()) {
    statements.push(transactionBlock.trim());
  }

  return statements;
}
