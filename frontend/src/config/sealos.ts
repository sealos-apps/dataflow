/**
 * Sealos integration helpers.
 *
 * Detects Sealos dbprovider context, maps language codes, maps KubeBlocks
 * database types to WhoDB plugin types, and decrypts AES-encrypted credentials.
 */

/** Sealos Desktop language code → WhoDB i18n locale */
const langMap: Record<string, string> = {
  zh: 'zh_CN',
  en: 'en_US',
};

/**
 * Detect whether the current URL was opened by the Sealos dbprovider.
 * Sealos passes `dbType` (KubeBlocks type name); WhoDB natively uses `type`.
 */
export function isSealosContext(params: URLSearchParams): boolean {
  return params.has('dbType');
}

/** Map a Sealos language code to a WhoDB locale. */
export function mapSealosLang(lang: string | null): string {
  return langMap[lang ?? ''] ?? 'en_US';
}

/** Maps KubeBlocks database type names to WhoDB DatabaseType ids. */
const typeMap: Record<string, string> = {
  postgresql: 'Postgres',
  'apecloud-mysql': 'MySQL',
  mongodb: 'MongoDB',
  redis: 'Redis',
  clickhouse: 'ClickHouse',
};

/** Maps KubeBlocks database types to their default database names. */
const defaultDB: Record<string, string> = {
  postgresql: 'postgres',
  'apecloud-mysql': '',
  mongodb: 'admin',
  redis: '',
  clickhouse: 'default',
};

/** Map a KubeBlocks dbType to a WhoDB plugin type. Returns undefined if unsupported. */
export function mapSealosDbType(dbType: string): string | undefined {
  return typeMap[dbType];
}

/** Get the default database name for a KubeBlocks dbType. */
export function getDefaultDatabase(dbType: string): string {
  return defaultDB[dbType] ?? '';
}

/**
 * Decrypt an AES-256-CBC encrypted credential from the Sealos dbprovider.
 *
 * Input: base64(IV_16bytes + ciphertext), PKCS#7 padded.
 * Key: 32 ASCII characters (256 bits), injected at build time via VITE_WHODB_AES_KEY.
 *
 * Uses the Web Crypto API — browser-native, no external dependencies.
 * Web Crypto automatically strips PKCS#7 padding for AES-CBC.
 */
export async function decryptSealosCredential(
  ciphertextB64: string,
  key: string,
): Promise<{ username: string; password: string }> {
  const raw = Uint8Array.from(atob(ciphertextB64), (c) => c.charCodeAt(0));
  const iv = raw.slice(0, 16);
  const ciphertext = raw.slice(16);

  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(key),
    'AES-CBC',
    false,
    ['decrypt'],
  );

  const plainBuf = await crypto.subtle.decrypt(
    { name: 'AES-CBC', iv },
    cryptoKey,
    ciphertext,
  );

  return JSON.parse(new TextDecoder().decode(plainBuf));
}
