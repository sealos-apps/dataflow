#!/usr/bin/env node

/**
 * Generate a Sealos dbprovider URL for local testing.
 *
 * Usage:
 *   node dev/generate-sealos-url.mjs
 *   node dev/generate-sealos-url.mjs --resourceName my-db --host localhost --port 5432 --dbType postgresql
 *
 * The generated URL intentionally carries only non-secret bootstrap metadata.
 */

import { parseArgs } from 'node:util';

const { values } = parseArgs({
  options: {
    resourceName: { type: 'string', default: 'my-db' },
    host:     { type: 'string', default: 'localhost' },
    port:     { type: 'string', default: '5432' },
    databaseName: { type: 'string', default: 'postgres' },
    dbType:   { type: 'string', default: 'postgresql' },
    base:     { type: 'string', default: 'http://localhost:3000' },
    lang:     { type: 'string', default: 'zh' },
    theme:    { type: 'string', default: 'dark' },
  },
});

const params = new URLSearchParams({
  dbType: values.dbType,
  resourceName: values.resourceName,
  host: values.host,
  port: values.port,
  databaseName: values.databaseName,
  lang: values.lang,
  theme: values.theme,
});

const url = `${values.base}?${params}`;

console.log('\n--- Sealos Test URL ---\n');
console.log(url);
console.log('\n--- Start commands ---\n');
console.log(`# 1. Start test PostgreSQL (if not running):`);
console.log(`docker compose -f dev/docker-compose.yml up -d postgres\n`);
console.log(`# 2. Start Core backend:`);
console.log(`cd core && go run .\n`);
console.log(`# 3. Start DataFlow frontend:`);
console.log(`cd dataflow && pnpm dev\n`);
console.log(`# 4. Open the URL above in browser`);
console.log();
