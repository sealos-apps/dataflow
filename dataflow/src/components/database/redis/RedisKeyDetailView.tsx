import { useCallback, useEffect, useState } from 'react'
import { useConnectionStore } from '@/stores/useConnectionStore'
import { useGetStorageUnitRowsLazyQuery } from '@graphql'
import { resolveSchemaParam } from '@/utils/database-features'
import { useI18n } from '@/i18n/useI18n'
import { Loader2, RefreshCw } from 'lucide-react'

interface RedisKeyDetailViewProps {
  connectionId: string
  databaseName: string
  keyName: string
}

/** Displays the contents of a single Redis key in a simple table. */
export function RedisKeyDetailView({ connectionId, databaseName, keyName }: RedisKeyDetailViewProps) {
  const { connections } = useConnectionStore()
  const { t } = useI18n()
  const [getRows] = useGetStorageUnitRowsLazyQuery()

  const [columns, setColumns] = useState<string[]>([])
  const [rows, setRows] = useState<string[][]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    const conn = connections.find(c => c.id === connectionId)
    if (!conn) return

    const schema = resolveSchemaParam(conn.type, databaseName)
    setLoading(true)
    setError(null)

    try {
      const { data, error: gqlError } = await getRows({
        variables: {
          schema,
          storageUnit: keyName,
          pageSize: 10000,
          pageOffset: 0,
        },
        context: { database: databaseName },
        fetchPolicy: 'no-cache',
      })

      if (gqlError) throw new Error(gqlError.message)

      const result = data?.Row
      if (result) {
        setColumns(result.Columns.map(c => c.Name))
        setRows(result.Rows)
      }
    } catch (err) {
      const message = err instanceof Error ? err.message.trim() : ''
      setError(message || t('redis.detail.fetchFailed'))
    } finally {
      setLoading(false)
    }
  }, [connections, connectionId, databaseName, keyName, getRows, t])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex-1 flex items-center justify-center text-destructive">
        {error}
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Toolbar */}
      <div className="flex items-center gap-1 px-2 py-1.5 border-b border-border shrink-0">
        <button
          onClick={fetchData}
          className="inline-flex items-center justify-center rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
          title={t('common.actions.refresh')}
        >
          <RefreshCw className="h-4 w-4" />
        </button>
        <span className="text-sm text-muted-foreground ml-2">{keyName}</span>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        <table className="min-w-full border-collapse text-sm">
          <thead className="border-b border-border bg-background">
            <tr>
              <th
                className="sticky top-0 left-0 z-50 border-b border-r border-border/50 bg-background px-2 py-2 text-center text-xs font-semibold text-muted-foreground"
                style={{ width: 64, minWidth: 64, maxWidth: 64 }}
              > </th>
              {columns.map((col) => (
                <th
                  key={col}
                  className="px-6 py-2 text-left font-medium text-sm text-muted-foreground whitespace-nowrap relative border-r border-border/50 select-none sticky top-0 bg-background z-40"
                >
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-background">
            {rows.map((row, rowIdx) => (
              <tr key={rowIdx} className="group transition-colors hover:bg-muted/50">
                <td
                  className="sticky left-0 z-30 border-b border-r border-border/50 bg-background px-2 py-2 text-center text-xs font-medium"
                  style={{ width: 64, minWidth: 64, maxWidth: 64 }}
                >
                  {rowIdx + 1}
                </td>
                {row.map((cell, cellIdx) => (
                  <td
                    key={cellIdx}
                    className="relative border-b border-r border-border/50 px-6 py-2 text-sm text-foreground/80"
                  >
                    <span className="block truncate" title={cell}>
                      {cell}
                    </span>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>

        {rows.length === 0 && (
          <div className="flex items-center justify-center py-12 text-muted-foreground text-sm">
            {t('redis.detail.empty')}
          </div>
        )}
      </div>
    </div>
  )
}
