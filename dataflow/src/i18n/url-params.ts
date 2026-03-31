const BOOTSTRAP_KEYS = ['dbType', 'credential', 'host', 'port', 'dbName'] as const

export function removeBootstrapParams(search: string): string {
  const params = new URLSearchParams(search)

  for (const key of BOOTSTRAP_KEYS) {
    params.delete(key)
  }

  const next = params.toString()
  return next ? `?${next}` : ''
}

export function replaceBootstrapUrl(search: string): void {
  const nextSearch = removeBootstrapParams(search)
  const nextUrl = `${window.location.pathname}${nextSearch}${window.location.hash}`
  window.history.replaceState({}, '', nextUrl)
}
