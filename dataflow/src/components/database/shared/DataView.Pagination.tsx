import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip'
import { Input } from '@/components/ui/Input'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select'
import { useI18n } from '@/i18n/useI18n'
import type { PaginationProps } from './types'

/** Shared pagination controls for detail views. */
export function DataViewPagination({
  currentPage, totalPages, pageSize, total, loading, itemLabel, onPageChange, onPageSizeChange,
}: PaginationProps) {
  const { t } = useI18n()
  const startRow = (currentPage - 1) * pageSize + 1
  const endRow = Math.min(currentPage * pageSize, total)
  const label = itemLabel ? ` ${itemLabel}` : ''
  const safeTotalPages = totalPages || 1

  return (
    <div className="flex items-center justify-between border-t border-border/50 bg-muted/20 px-4 py-3">
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">
          {t('common.pagination.range', { startRow, endRow, total, label })}
        </span>
      </div>
      <div className="flex items-center gap-6">
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground whitespace-nowrap">{t('common.pagination.rowsPerPage')}</span>
          <Select value={String(pageSize)} onValueChange={(v) => onPageSizeChange(Number(v))}>
            <SelectTrigger size="sm" className="w-auto gap-1 bg-transparent border-border/50">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="10">10</SelectItem>
              <SelectItem value="20">20</SelectItem>
              <SelectItem value="50">50</SelectItem>
              <SelectItem value="100">100</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-1">
          <Tooltip>
            <TooltipTrigger asChild>
              <span>
                <Button variant="outline" size="icon" className="h-7 w-7"
                  disabled={currentPage === 1 || loading} onClick={() => onPageChange(1)}>
                  <ChevronsLeft className="h-3.5 w-3.5" />
                </Button>
              </span>
            </TooltipTrigger>
            <TooltipContent>{t('common.pagination.firstPage')}</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <span>
                <Button variant="outline" size="icon" className="h-7 w-7"
                  disabled={currentPage === 1 || loading} onClick={() => onPageChange(Math.max(1, currentPage - 1))}>
                  <ChevronLeft className="h-3.5 w-3.5" />
                </Button>
              </span>
            </TooltipTrigger>
            <TooltipContent>{t('common.pagination.previousPage')}</TooltipContent>
          </Tooltip>
          <div className="flex items-center gap-1 mx-2">
            <span className="text-sm text-muted-foreground">{t('common.pagination.page')}</span>
            <Input className="h-7 w-12 px-1 text-center" value={currentPage} type="number"
              min={1} max={safeTotalPages}
              onChange={(e) => {
                const val = parseInt(e.target.value)
                if (!isNaN(val) && val >= 1) onPageChange(Math.min(val, safeTotalPages))
              }}
            />
            <span className="text-sm text-muted-foreground">{t('common.pagination.of')} {safeTotalPages}</span>
          </div>
          <Tooltip>
            <TooltipTrigger asChild>
              <span>
                <Button variant="outline" size="icon" className="h-7 w-7"
                  disabled={currentPage >= safeTotalPages || loading} onClick={() => onPageChange(Math.min(safeTotalPages, currentPage + 1))}>
                  <ChevronRight className="h-3.5 w-3.5" />
                </Button>
              </span>
            </TooltipTrigger>
            <TooltipContent>{t('common.pagination.nextPage')}</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <span>
                <Button variant="outline" size="icon" className="h-7 w-7"
                  disabled={currentPage >= safeTotalPages || loading} onClick={() => onPageChange(safeTotalPages)}>
                  <ChevronsRight className="h-3.5 w-3.5" />
                </Button>
              </span>
            </TooltipTrigger>
            <TooltipContent>{t('common.pagination.lastPage')}</TooltipContent>
          </Tooltip>
        </div>
      </div>
    </div>
  )
}
