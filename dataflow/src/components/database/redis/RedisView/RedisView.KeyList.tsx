import { Loader2 } from 'lucide-react'
import { useRedisView } from './RedisViewProvider'
import { RedisViewKeyRow } from './RedisView.KeyRow'

/** Table listing Redis keys with type badges and action buttons. */
export function RedisViewKeyList() {
  const { state } = useRedisView()

  return (
    <div className="flex-1 overflow-hidden bg-muted/5 p-6 flex flex-col">
      <div className="bg-background rounded-xl shadow-sm border border-border/50 overflow-hidden flex-1 flex flex-col">
        {state.loading && state.keys.length === 0 ? (
          <div className="flex flex-1 items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <div className="overflow-auto flex-1">
            <table className="min-w-full divide-y divide-border/50 border-collapse">
              <thead className="bg-background border-b border-border/50">
                <tr>
                  <th className="px-6 py-3 text-left font-medium text-xs text-muted-foreground uppercase tracking-wider border-r border-border/50 w-[300px] sticky top-0 bg-background z-40">Key</th>
                  <th className="px-6 py-3 text-left font-medium text-xs text-muted-foreground uppercase tracking-wider border-r border-border/50 w-[100px] sticky top-0 bg-background z-40">Type</th>
                  <th className="px-6 py-3 text-left font-medium text-xs text-muted-foreground uppercase tracking-wider border-r border-border/50 w-[150px] sticky top-0 bg-background z-40">Size</th>
                  <th className="px-6 py-3 text-right font-medium text-xs text-muted-foreground uppercase tracking-wider sticky top-0 right-0 bg-background z-50 shadow-[-1px_0_0_0_rgba(0,0,0,0.05)] w-[100px]">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50 bg-background">
                {state.keys.map((key) => (
                  <RedisViewKeyRow key={key.key} redisKey={key} />
                ))}
                {state.keys.length === 0 && !state.loading && (
                  <tr>
                    <td colSpan={4} className="py-12 text-center text-muted-foreground">
                      No keys found matching your criteria.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
