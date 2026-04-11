export function pruneChanges<TChange>(changes: Map<string, TChange>, rowKeys: Set<string>) {
  if (rowKeys.size === 0) return new Map(changes)

  const nextChanges = new Map(changes)
  for (const rowKey of rowKeys) {
    nextChanges.delete(rowKey)
  }
  return nextChanges
}

export function pruneNewRowOrder(newRowOrder: string[], rowKeys: Set<string>) {
  if (rowKeys.size === 0) return [...newRowOrder]
  return newRowOrder.filter((rowKey) => !rowKeys.has(rowKey))
}

export function pruneSelectedRowKeys(selectedRowKeys: Set<string>, rowKeys: Set<string>) {
  if (rowKeys.size === 0) return new Set(selectedRowKeys)
  return new Set([...selectedRowKeys].filter((rowKey) => !rowKeys.has(rowKey)))
}
