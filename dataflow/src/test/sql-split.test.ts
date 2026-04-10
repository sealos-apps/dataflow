import {
  splitRedisCommands,
  splitSQLStatements,
  splitMongoStatements,
  isLikelyMongoCommand,
  isStandaloneTransactionStatement,
} from '@/utils/sql-split';

describe('splitRedisCommands', () => {
  it('splits commands by newline', () => {
    expect(splitRedisCommands('GET key1\nSET key2 value')).toEqual(['GET key1', 'SET key2 value']);
  });

  it('returns single command as-is', () => {
    expect(splitRedisCommands('GET key1')).toEqual(['GET key1']);
  });

  it('ignores empty lines', () => {
    expect(splitRedisCommands('GET key1\n\n\nSET key2 value')).toEqual(['GET key1', 'SET key2 value']);
  });

  it('ignores empty input', () => {
    expect(splitRedisCommands('')).toEqual([]);
    expect(splitRedisCommands('   ')).toEqual([]);
  });

  it('trims whitespace from each command', () => {
    expect(splitRedisCommands('  GET key1  \n  HGETALL myhash  ')).toEqual(['GET key1', 'HGETALL myhash']);
  });

  it('skips # comment lines', () => {
    expect(splitRedisCommands('# set a key\nSET foo bar\n# another comment\nGET foo'))
      .toEqual(['SET foo bar', 'GET foo']);
  });

  it('skips // comment lines', () => {
    expect(splitRedisCommands('// header\nSET foo bar\n// trailing')).toEqual(['SET foo bar']);
  });

  it('skips comment lines with leading whitespace', () => {
    expect(splitRedisCommands('   # indented\nSET foo bar')).toEqual(['SET foo bar']);
  });

  it('does not strip # inside a command payload', () => {
    expect(splitRedisCommands('SET foo "bar#baz"')).toEqual(['SET foo "bar#baz"']);
  });
});

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

  it('treats unclosed block comment as part of the statement', () => {
    expect(splitSQLStatements('SELECT 1; /* unclosed comment ; SELECT 2')).toEqual([
      'SELECT 1',
      '/* unclosed comment ; SELECT 2',
    ]);
  });

  it('drops pure line-comment statements', () => {
    expect(splitSQLStatements('-- just a comment')).toEqual([]);
    expect(splitSQLStatements('-- one\n-- two')).toEqual([]);
  });

  it('drops pure block-comment statements', () => {
    expect(splitSQLStatements('/* just a comment */')).toEqual([]);
  });

  it('drops comment-only statements between real statements', () => {
    expect(splitSQLStatements('SELECT 1; -- noise\n; SELECT 2')).toEqual(['SELECT 1', 'SELECT 2']);
  });

  it('keeps strings that happen to contain comment markers', () => {
    expect(splitSQLStatements("SELECT '--' AS x")).toEqual(["SELECT '--' AS x"]);
  });

  it('merges BEGIN...COMMIT into a single statement', () => {
    const sql = 'BEGIN; INSERT INTO t VALUES (1); COMMIT;';
    expect(splitSQLStatements(sql)).toEqual([
      'BEGIN;\nINSERT INTO t VALUES (1);\nCOMMIT;',
    ]);
  });

  it('merges BEGIN...ROLLBACK into a single statement', () => {
    const sql = 'BEGIN; INSERT INTO t VALUES (1); ROLLBACK;';
    expect(splitSQLStatements(sql)).toEqual([
      'BEGIN;\nINSERT INTO t VALUES (1);\nROLLBACK;',
    ]);
  });

  it('merges case-insensitive BEGIN TRANSACTION...COMMIT', () => {
    const sql = 'begin transaction; SELECT 1; commit;';
    expect(splitSQLStatements(sql)).toEqual([
      'begin transaction;\nSELECT 1;\ncommit;',
    ]);
  });

  it('merges START TRANSACTION...COMMIT', () => {
    const sql = 'START TRANSACTION; UPDATE t SET x=1; COMMIT;';
    expect(splitSQLStatements(sql)).toEqual([
      'START TRANSACTION;\nUPDATE t SET x=1;\nCOMMIT;',
    ]);
  });

  it('handles statements before and after a transaction block', () => {
    const sql = 'SELECT 1; BEGIN; INSERT INTO t VALUES (1); COMMIT; SELECT 2;';
    expect(splitSQLStatements(sql)).toEqual([
      'SELECT 1',
      'BEGIN;\nINSERT INTO t VALUES (1);\nCOMMIT;',
      'SELECT 2',
    ]);
  });

  it('handles unclosed transaction block (no COMMIT)', () => {
    const sql = 'BEGIN; INSERT INTO t VALUES (1);';
    expect(splitSQLStatements(sql)).toEqual([
      'BEGIN;\nINSERT INTO t VALUES (1);',
    ]);
  });

  it('handles BEGIN WORK...END WORK', () => {
    const sql = 'BEGIN WORK; SELECT 1; END WORK;';
    expect(splitSQLStatements(sql)).toEqual([
      'BEGIN WORK;\nSELECT 1;\nEND WORK;',
    ]);
  });

  it('handles ABORT as transaction end', () => {
    const sql = 'BEGIN; SELECT 1; ABORT;';
    expect(splitSQLStatements(sql)).toEqual([
      'BEGIN;\nSELECT 1;\nABORT;',
    ]);
  });

  it('handles two consecutive transaction blocks', () => {
    const sql = 'BEGIN; SELECT 1; COMMIT; BEGIN; SELECT 2; ROLLBACK;';
    expect(splitSQLStatements(sql)).toEqual([
      'BEGIN;\nSELECT 1;\nCOMMIT;',
      'BEGIN;\nSELECT 2;\nROLLBACK;',
    ]);
  });

  it('merges BEGIN with extra internal whitespace', () => {
    const sql = 'BEGIN  TRANSACTION; SELECT 1; COMMIT;';
    expect(splitSQLStatements(sql)).toEqual([
      'BEGIN  TRANSACTION;\nSELECT 1;\nCOMMIT;',
    ]);
  });

  it('merges transaction block when BEGIN is preceded by line comments', () => {
    const sql = `-- Mock Data Generator
-- PostgreSQL — run as a single script

BEGIN;

CREATE TABLE t (id int);
INSERT INTO t VALUES (1);

COMMIT;`;
    const result = splitSQLStatements(sql);
    expect(result).toHaveLength(1);
    expect(result[0]).toContain('BEGIN');
    expect(result[0]).toContain('CREATE TABLE');
    expect(result[0]).toContain('INSERT INTO');
    expect(result[0]).toContain('COMMIT');
  });

  it('merges transaction block when BEGIN is preceded by block comment', () => {
    const sql = '/* header */ BEGIN; SELECT 1; COMMIT;';
    const result = splitSQLStatements(sql);
    expect(result).toHaveLength(1);
    expect(result[0]).toContain('BEGIN');
    expect(result[0]).toContain('COMMIT');
  });

  it('merges transaction block with inline comment after COMMIT keyword', () => {
    const sql = 'BEGIN; SELECT 1; COMMIT -- done\n;';
    const result = splitSQLStatements(sql);
    expect(result).toHaveLength(1);
    expect(result[0]).toContain('BEGIN');
    expect(result[0]).toContain('COMMIT');
  });

  it('merges transaction block with inline comment between statements', () => {
    const sql = 'BEGIN; -- start\nSELECT 1; COMMIT;';
    const result = splitSQLStatements(sql);
    expect(result).toHaveLength(1);
  });
});

describe('splitMongoStatements', () => {
  it('returns single command as-is when no semicolons', () => {
    expect(splitMongoStatements('db.users.find({})')).toEqual(['db.users.find({})']);
  });

  it('strips trailing semicolon from a single command', () => {
    expect(splitMongoStatements('db.users.find({});')).toEqual(['db.users.find({})']);
  });

  it('splits multiple commands on top-level semicolons', () => {
    const input = 'db.users.find({}); db.orders.find({})';
    expect(splitMongoStatements(input)).toEqual(['db.users.find({})', 'db.orders.find({})']);
  });

  it('preserves semicolons inside object literals', () => {
    const input = 'db.users.insertOne({ note: "a;b" }); db.users.find({})';
    expect(splitMongoStatements(input)).toEqual([
      'db.users.insertOne({ note: "a;b" })',
      'db.users.find({})',
    ]);
  });

  it('preserves semicolons inside single-quoted strings', () => {
    const input = "db.users.insertOne({ note: 'a;b' }); db.users.find({})";
    expect(splitMongoStatements(input)).toEqual([
      "db.users.insertOne({ note: 'a;b' })",
      'db.users.find({})',
    ]);
  });

  it('preserves semicolons inside template literals', () => {
    const input = 'db.users.insertOne({ note: `a;b` }); db.users.find({})';
    expect(splitMongoStatements(input)).toEqual([
      'db.users.insertOne({ note: `a;b` })',
      'db.users.find({})',
    ]);
  });

  it('handles escaped quotes inside strings', () => {
    const input = 'db.users.insertOne({ note: "a\\"b;c" }); db.users.find({})';
    expect(splitMongoStatements(input)).toEqual([
      'db.users.insertOne({ note: "a\\"b;c" })',
      'db.users.find({})',
    ]);
  });

  it('preserves semicolons inside line comments', () => {
    const input = 'db.users.find({}) // a;b\n; db.users.find({})';
    expect(splitMongoStatements(input)).toEqual([
      'db.users.find({}) // a;b',
      'db.users.find({})',
    ]);
  });

  it('preserves semicolons inside block comments', () => {
    const input = 'db.users.find({}) /* a;b */; db.users.find({})';
    expect(splitMongoStatements(input)).toEqual([
      'db.users.find({}) /* a;b */',
      'db.users.find({})',
    ]);
  });

  it('handles multi-line commands with nested objects', () => {
    const input = `db.users.insertMany([
  { name: "Alice", age: 30 },
  { name: "Bob", age: 25 }
]);
db.users.createIndex({ email: 1 }, { unique: true });`;
    const result = splitMongoStatements(input);
    expect(result).toHaveLength(2);
    expect(result[0]).toContain('insertMany');
    expect(result[1]).toContain('createIndex');
  });

  it('returns only non-empty statements', () => {
    expect(splitMongoStatements('db.users.find({});;')).toEqual(['db.users.find({})']);
  });

  it('returns empty array for empty input', () => {
    expect(splitMongoStatements('')).toEqual([]);
    expect(splitMongoStatements('   ')).toEqual([]);
  });

  it('skips pure-comment statements', () => {
    const input = '// a comment\n; db.users.find({})';
    expect(splitMongoStatements(input)).toEqual(['db.users.find({})']);
  });

  it('keeps non-command statements so caller can show a clear error', () => {
    const input = 'const x = 1; db.users.find({})';
    expect(splitMongoStatements(input)).toEqual(['const x = 1', 'db.users.find({})']);
  });

  it('handles leading file-level comment block before a single command', () => {
    const input = `// =====\n// Header\n// =====\ndb.users.find({})`;
    expect(splitMongoStatements(input)).toEqual([input.trim()]);
  });
});

describe('isLikelyMongoCommand', () => {
  it('accepts db.collection.method() form', () => {
    expect(isLikelyMongoCommand('db.users.find({})')).toBe(true);
  });

  it('accepts db.getCollection("name").method() form', () => {
    expect(isLikelyMongoCommand('db.getCollection("weird name").find({})')).toBe(true);
  });

  it('accepts db.method() form (e.g., dropDatabase)', () => {
    expect(isLikelyMongoCommand('db.dropDatabase()')).toBe(true);
  });

  it('accepts commands preceded by comments', () => {
    expect(isLikelyMongoCommand('// header\ndb.users.find({})')).toBe(true);
    expect(isLikelyMongoCommand('/* block */ db.users.find({})')).toBe(true);
  });

  it('rejects variable declarations', () => {
    expect(isLikelyMongoCommand('const x = 1')).toBe(false);
    expect(isLikelyMongoCommand('let y = 2')).toBe(false);
    expect(isLikelyMongoCommand('var z = 3')).toBe(false);
  });

  it('rejects function definitions', () => {
    expect(isLikelyMongoCommand('function foo() { return 1 }')).toBe(false);
  });

  it('rejects for loops', () => {
    expect(isLikelyMongoCommand('for (let i = 0; i < 10; i++) {}')).toBe(false);
  });

  it('rejects print calls', () => {
    expect(isLikelyMongoCommand('print("hello")')).toBe(false);
  });

  it('rejects empty input', () => {
    expect(isLikelyMongoCommand('')).toBe(false);
    expect(isLikelyMongoCommand('   ')).toBe(false);
  });

  it('rejects pure comment input', () => {
    expect(isLikelyMongoCommand('// just a comment')).toBe(false);
    expect(isLikelyMongoCommand('/* block */')).toBe(false);
  });

  it('does not misread comment markers inside string literals', () => {
    // Leading comment is fine, but the // inside the double-quoted string
    // must not be treated as a line comment when determining whether this is
    // a valid command.
    expect(isLikelyMongoCommand('db.users.insertOne({ note: "use // syntax" })')).toBe(true);
    expect(isLikelyMongoCommand('db.users.insertOne({ note: "/* block */ inside" })')).toBe(true);
  });
});

describe('isStandaloneTransactionStatement', () => {
  it('detects BEGIN', () => {
    expect(isStandaloneTransactionStatement('BEGIN')).toBe(true);
  });

  it('detects begin transaction (case insensitive)', () => {
    expect(isStandaloneTransactionStatement('begin transaction')).toBe(true);
  });

  it('detects COMMIT', () => {
    expect(isStandaloneTransactionStatement('COMMIT')).toBe(true);
  });

  it('returns false for ROLLBACK (allowed through)', () => {
    expect(isStandaloneTransactionStatement('ROLLBACK')).toBe(false);
  });

  it('returns false for ROLLBACK WORK (allowed through)', () => {
    expect(isStandaloneTransactionStatement('ROLLBACK WORK')).toBe(false);
  });

  it('returns false for ROLLBACK TRANSACTION (allowed through)', () => {
    expect(isStandaloneTransactionStatement('ROLLBACK TRANSACTION')).toBe(false);
  });

  it('returns false for regular statements', () => {
    expect(isStandaloneTransactionStatement('SELECT 1')).toBe(false);
  });

  it('returns false for BEGIN inside a larger statement', () => {
    expect(isStandaloneTransactionStatement('BEGIN; INSERT INTO t VALUES (1); COMMIT;')).toBe(false);
  });

  it('trims whitespace', () => {
    expect(isStandaloneTransactionStatement('  BEGIN  ')).toBe(true);
  });

  it('returns false for BEGIN with trailing semicolon', () => {
    expect(isStandaloneTransactionStatement('BEGIN;')).toBe(false);
  });

  it('detects BEGIN preceded by a line comment', () => {
    expect(isStandaloneTransactionStatement('-- start transaction\nBEGIN')).toBe(true);
  });

  it('detects COMMIT followed by a line comment', () => {
    expect(isStandaloneTransactionStatement('COMMIT -- done')).toBe(true);
  });

  it('detects BEGIN preceded by a block comment', () => {
    expect(isStandaloneTransactionStatement('/* header */ BEGIN')).toBe(true);
  });
});
