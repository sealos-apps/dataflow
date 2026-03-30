import { Edit2, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/Button'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { useRedisView } from './RedisViewProvider'
import type { RedisKey } from './types'

/** Color classes for Redis type badges. */
const TYPE_COLORS: Record<string, string> = {
  string: 'bg-blue-100 text-blue-700',
  hash: 'bg-purple-100 text-purple-700',
  list: 'bg-emerald-100 text-emerald-700',
  set: 'bg-orange-100 text-orange-700',
  zset: 'bg-pink-100 text-pink-700',
  stream: 'bg-cyan-100 text-cyan-700',
}

/** A single row in the Redis key list table. */
export function RedisViewKeyRow({ redisKey }: { redisKey: RedisKey }) {
  const { actions } = useRedisView()
  const canEdit = redisKey.type === 'string'

  return (
    <tr className="group transition-colors hover:bg-muted/30">
      <td
        className="px-6 py-2 border-r border-b border-border/50 font-medium text-foreground min-w-[200px] max-w-[400px] truncate"
        title={redisKey.key}
      >
        {redisKey.key}
      </td>
      <td className="px-6 py-2 border-r border-b border-border/50">
        <span className={cn(
          "px-2 py-0.5 rounded text-[10px] uppercase font-bold tracking-wider inline-block min-w-[50px] text-center",
          TYPE_COLORS[redisKey.type],
        )}>
          {redisKey.type}
        </span>
      </td>
      <td className="px-6 py-2 border-r border-b border-border/50 text-muted-foreground text-xs tabular-nums">
        {redisKey.size}
      </td>
      <td className="px-6 py-2 text-right whitespace-nowrap sticky right-0 bg-background group-hover:bg-muted/30 transition-colors z-20 shadow-[-1px_0_0_0_rgba(0,0,0,0.05)] border-b border-border/50">
        <div className="flex items-center justify-end gap-1">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-muted-foreground hover:text-primary"
                    onClick={() => actions.handleEditKey(redisKey)}
                    disabled={!canEdit}
                  >
                    <Edit2 className="h-3.5 w-3.5" />
                  </Button>
                </span>
              </TooltipTrigger>
              {!canEdit && (
                <TooltipContent side="top">
                  Editing is currently supported only for string keys
                </TooltipContent>
              )}
            </Tooltip>
          </TooltipProvider>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-muted-foreground hover:text-destructive"
            onClick={() => actions.setDeletingKey(redisKey)}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </td>
    </tr>
  )
}
