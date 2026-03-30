import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select'
import type { PaginationProps } from './types'

/** Shared pagination controls for detail views. */
export function DataViewPagination({
  currentPage, totalPages, pageSize, total, loading, itemLabel, onPageChange, onPageSizeChange,
}: PaginationProps) {
  const startRow = (currentPage - 1) * pageSize + 1
  const endRow = Math.min(currentPage * pageSize, total)
  const label = itemLabel ? ` ${itemLabel}` : ''

  return (
    <div className="flex items-center justify-between border-t border-border/50 bg-muted/20 px-4 py-3">
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">
          Showing {startRow} - {endRow} of {total}{label}
        </span>
      </div>
      <div className="flex items-center gap-6">
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground whitespace-nowrap">Rows per page:</span>
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
          <Button variant="outline" size="icon" className="h-7 w-7"
            disabled={currentPage === 1 || loading} onClick={() => onPageChange(1)} title="First Page">
            <ChevronsLeft className="h-3.5 w-3.5" />
          </Button>
          <Button variant="outline" size="icon" className="h-7 w-7"
            disabled={currentPage === 1 || loading} onClick={() => onPageChange(Math.max(1, currentPage - 1))} title="Previous Page">
            <ChevronLeft className="h-3.5 w-3.5" />
          </Button>
          <div className="flex items-center gap-1 mx-2">
            <span className="text-sm text-muted-foreground">Page</span>
            <Input className="h-7 w-12 px-1 text-center" value={currentPage} type="number"
              min={1} max={totalPages || 1}
              onChange={(e) => {
                const val = parseInt(e.target.value)
                if (!isNaN(val) && val >= 1) onPageChange(Math.min(val, totalPages || 1))
              }}
            />
            <span className="text-sm text-muted-foreground">of {totalPages || 1}</span>
          </div>
          <Button variant="outline" size="icon" className="h-7 w-7"
            disabled={currentPage >= totalPages || loading} onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))} title="Next Page">
            <ChevronRight className="h-3.5 w-3.5" />
          </Button>
          <Button variant="outline" size="icon" className="h-7 w-7"
            disabled={currentPage >= totalPages || loading} onClick={() => onPageChange(totalPages)} title="Last Page">
            <ChevronsRight className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </div>
  )
}
