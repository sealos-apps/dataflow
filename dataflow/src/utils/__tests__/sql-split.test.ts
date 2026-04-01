import { splitSQLStatements } from '../sql-split';

describe('splitSQLStatements', () => {
  it('splits simple statements', () => {
    expect(splitSQLStatements('SELECT 1; SELECT 2')).toEqual(['SELECT 1', 'SELECT 2']);
  });

  it('returns single statement as-is', () => {
    expect(splitSQLStatements('SELECT 1')).toEqual(['SELECT 1']);
  });

  it('ignores trailing semicolon', () => {
    expect(splitSQLStatements('SELECT 1;')).toEqual(['SELECT 1']);
  });

  it('ignores empty input', () => {
    expect(splitSQLStatements('')).toEqual([]);
    expect(splitSQLStatements('   ')).toEqual([]);
  });

  it('ignores empty statements between semicolons', () => {
    expect(splitSQLStatements('SELECT 1;; SELECT 2')).toEqual(['SELECT 1', 'SELECT 2']);
  });

  it('preserves semicolons inside single-quoted strings', () => {
    expect(splitSQLStatements("SELECT 'a;b'; SELECT 2")).toEqual(["SELECT 'a;b'", 'SELECT 2']);
  });

  it('preserves semicolons inside double-quoted identifiers', () => {
    expect(splitSQLStatements('SELECT "col;name"; SELECT 2')).toEqual(['SELECT "col;name"', 'SELECT 2']);
  });

  it('handles escaped single quotes', () => {
    expect(splitSQLStatements("SELECT 'it''s'; SELECT 2")).toEqual(["SELECT 'it''s'", 'SELECT 2']);
  });

  it('preserves semicolons inside single-line comments', () => {
    expect(splitSQLStatements('SELECT 1 -- comment; still comment\n; SELECT 2')).toEqual([
      'SELECT 1 -- comment; still comment',
      'SELECT 2',
    ]);
  });

  it('preserves semicolons inside block comments', () => {
    expect(splitSQLStatements('SELECT 1 /* comment; */ ; SELECT 2')).toEqual([
      'SELECT 1 /* comment; */',
      'SELECT 2',
    ]);
  });

  it('handles multi-line statements', () => {
    const sql = `
      SELECT *
      FROM users
      WHERE id = 1;

      UPDATE users
      SET name = 'test'
      WHERE id = 1;
    `;
    const result = splitSQLStatements(sql);
    expect(result).toHaveLength(2);
    expect(result[0]).toContain('SELECT *');
    expect(result[1]).toContain('UPDATE users');
  });

  it('handles backslash-escaped quotes when enabled in MySQL', () => {
    expect(splitSQLStatements("SELECT 'it\\'s'; SELECT 2")).toEqual(["SELECT 'it\\'s'", 'SELECT 2']);
  });

  it('preserves semicolons inside backtick-quoted identifiers', () => {
    expect(splitSQLStatements('SELECT `col;name`; SELECT 2')).toEqual(['SELECT `col;name`', 'SELECT 2']);
  });
});
