/**
 * Splits a Redis input into individual commands on newlines.
 * Each non-empty, trimmed line becomes one command.
 */
export function splitRedisCommands(input: string): string[] {
  return input.split('\n').map((line) => line.trim()).filter(Boolean);
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
      if (trimmed) statements.push(trimmed);
      current = '';
      i++;
      continue;
    }

    current += ch;
    i++;
  }

  const trimmed = current.trim();
  if (trimmed) statements.push(trimmed);

  return statements;
}
