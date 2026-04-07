#!/usr/bin/env node

/**
 * Generate a Sealos dbprovider URL for local testing.
 *
 * Usage:
 *   node dev/generate-sealos-url.mjs
 *   node dev/generate-sealos-url.mjs --user myuser --password mypass --host localhost --port 5432 --db test_db --dbType postgresql
 *
 * The AES key defaults to a 32-char test key. Override with --key <32chars>.
 * Frontend must be started with the same key: VITE_WHODB_AES_KEY=<key> pnpm dev
 */

import { webcrypto } from 'node:crypto';
import { parseArgs } from 'node:util';

const { values } = parseArgs({
  options: {
    user:     { type: 'string', default: 'postgres' },
    password: { type: 'string', default: 'sealos123' },
    host:     { type: 'string', default: 'localhost' },
    port:     { type: 'string', default: '5432' },
    db:       { type: 'string', default: 'postgres' },
    dbType:   { type: 'string', default: 'postgresql' },
    key:      { type: 'string', default: 'whodb-local-test-aes-key-32ch!!!' },
    base:     { type: 'string', default: 'http://localhost:3000' },
    lang:     { type: 'string', default: 'zh' },
    theme:    { type: 'string', default: 'dark' },
  },
});

// AES-256-CBC encrypt: output = base64(IV + ciphertext), PKCS#7 padded
async function encrypt(plaintext, keyStr) {
  const iv = webcrypto.getRandomValues(new Uint8Array(16));
  const keyBytes = new TextEncoder().encode(keyStr);
  const cryptoKey = await webcrypto.subtle.importKey('raw', keyBytes, 'AES-CBC', false, ['encrypt']);
  const cipherBuf = await webcrypto.subtle.encrypt({ name: 'AES-CBC', iv }, cryptoKey, new TextEncoder().encode(plaintext));
  const combined = new Uint8Array(iv.length + cipherBuf.byteLength);
  combined.set(iv);
  combined.set(new Uint8Array(cipherBuf), iv.length);
  return Buffer.from(combined).toString('base64');
}

const credential = await encrypt(JSON.stringify({
  username: values.user,
  password: values.password,
}), values.key);

const params = new URLSearchParams({
  dbType: values.dbType,
  credential,
  host: values.host,
  port: values.port,
  dbName: values.db,
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
console.log(`# 3. Start DataFlow frontend (use same AES key):`);
console.log(`cd dataflow && VITE_WHODB_AES_KEY='${values.key}' pnpm dev\n`);
console.log(`# 4. Open the URL above in browser`);
console.log();
