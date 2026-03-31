import { createContext, use, useState, type ReactNode } from 'react'
import { Filter, Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { Separator } from '@/components/ui/separator'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog'
import { useI18n } from '@/i18n/useI18n'
import type { FilterCondition } from './TableView/types'

// ---------------------------------------------------------------------------
// Internal context
// ---------------------------------------------------------------------------

interface FilterTableContextValue {
  columns: string[]
  selectedColumns: Set<string>
  conditions: FilterCondition[]
  toggleColumn: (col: string) => void
  toggleAllColumns: () => void
  addCondition: () => void
  removeCondition: (id: string) => void
  updateCondition: (id: string, field: keyof FilterCondition, value: string) => void
}

const FilterTableCtx = createContext<FilterTableContextValue | null>(null)

function useFilterTable(): FilterTableContextValue {
  const ctx = use(FilterTableCtx)
  if (!ctx) throw new Error('useFilterTable must be used within FilterTableProvider')
  return ctx
}

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

interface FilterTableProviderProps {
  columns: string[]
  initialSelectedColumns: string[] | undefined
  initialConditions: FilterCondition[] | undefined
  children: ReactNode
}

function FilterTableProvider({ columns, initialSelectedColumns, initialConditions, children }: FilterTableProviderProps) {
  const [selectedColumns, setSelectedColumns] = useState<Set<string>>(() => {
    if (initialSelectedColumns && initialSelectedColumns.length > 0) return new Set(initialSelectedColumns)
    return new Set(columns)
  })
  const [conditions, setConditions] = useState<FilterCondition[]>(initialConditions ?? [])

  const toggleColumn = (col: string) => {
    setSelectedColumns(prev => {
      const next = new Set(prev)
      if (next.has(col)) next.delete(col)
      else next.add(col)
      return next
    })
  }

  const toggleAllColumns = () => {
    setSelectedColumns(prev =>
      prev.size === columns.length ? new Set() : new Set(columns),
    )
  }

  const addCondition = () => {
    setConditions(prev => [
      ...prev,
      {
        id: Math.random().toString(36).substring(7),
        column: columns[0] || '',
        operator: '=',
        value: '',
      },
    ])
  }

  const removeCondition = (id: string) => {
    setConditions(prev => prev.filter(c => c.id !== id))
  }

  const updateCondition = (id: string, field: keyof FilterCondition, value: string) => {
    setConditions(prev => prev.map(c => (c.id === id ? { ...c, [field]: value } : c)))
  }

  return (
    <FilterTableCtx value={{
      columns,
      selectedColumns,
      conditions,
      toggleColumn,
      toggleAllColumns,
      addCondition,
      removeCondition,
      updateCondition,
    }}>
      {children}
    </FilterTableCtx>
  )
}

// ---------------------------------------------------------------------------
// Subcomponents
// ---------------------------------------------------------------------------

function ColumnSelector() {
  const { t } = useI18n()
  const { columns, selectedColumns, toggleColumn, toggleAllColumns } = useFilterTable()

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
          {t('sql.filter.visibleColumns')}
        </h3>
        <Button variant="ghost" size="sm" onClick={toggleAllColumns} className="h-6 text-xs">
          {selectedColumns.size === columns.length ? t('sql.filter.deselectAll') : t('sql.filter.selectAll')}
        </Button>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {columns.map(col => (
          <div
            key={col}
            className={`flex items-center gap-2 p-2 rounded-md border cursor-pointer transition-colors ${selectedColumns.has(col) ? 'bg-primary/5 border-primary/30 text-foreground' : 'bg-muted/30 border-transparent text-muted-foreground hover:bg-muted/50'}`}
            onClick={() => toggleColumn(col)}
          >
            <Checkbox checked={selectedColumns.has(col)} tabIndex={-1} className="pointer-events-none" />
            <span className="text-sm truncate" title={col}>{col}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function ConditionList() {
  const { t } = useI18n()
  const { columns, conditions, addCondition, removeCondition, updateCondition } = useFilterTable()

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
          {t('sql.filter.conditions')}
        </h3>
        <Button onClick={addCondition} size="sm" variant="outline" className="h-7 text-xs gap-1">
          <Plus className="h-3 w-3" />
          {t('sql.filter.addCondition')}
        </Button>
      </div>

      {conditions.length === 0 ? (
        <div className="text-center py-8 border border-dashed rounded-lg text-muted-foreground text-sm">
          {t('sql.filter.emptyState')}
        </div>
      ) : (
        <div className="space-y-2">
          {conditions.map((condition) => (
            <div key={condition.id} className="flex items-center gap-2">
              <Select value={condition.column} onValueChange={(v) => updateCondition(condition.id, 'column', v)}>
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {columns.map(col => <SelectItem key={col} value={col}>{col}</SelectItem>)}
                </SelectContent>
              </Select>

              <Select value={condition.operator} onValueChange={(v) => updateCondition(condition.id, 'operator', v)}>
                <SelectTrigger className="h-9 w-24">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="=">=</SelectItem>
                  <SelectItem value="!=">!=</SelectItem>
                  <SelectItem value=">">&gt;</SelectItem>
                  <SelectItem value=">=">&gt;=</SelectItem>
                  <SelectItem value="<">&lt;</SelectItem>
                  <SelectItem value="<=">&lt;=</SelectItem>
                  <SelectItem value="LIKE">LIKE</SelectItem>
                  <SelectItem value="NOT LIKE">NOT LIKE</SelectItem>
                  <SelectItem value="IN">IN</SelectItem>
                  <SelectItem value="IS NULL">IS NULL</SelectItem>
                  <SelectItem value="IS NOT NULL">IS NOT NULL</SelectItem>
                </SelectContent>
              </Select>

              <Input
                className="flex-1 h-9"
                placeholder={t('sql.filter.valuePlaceholder')}
                value={condition.value}
                onChange={(e) => updateCondition(condition.id, 'value', e.target.value)}
                disabled={['IS NULL', 'IS NOT NULL'].includes(condition.operator)}
              />

              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9 text-muted-foreground hover:text-red-500"
                onClick={() => removeCondition(condition.id)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function ApplyButton({ onApply, onClose }: { onApply: (cols: string[], conditions: FilterCondition[]) => void; onClose: () => void }) {
  const { t } = useI18n()
  const { selectedColumns, conditions } = useFilterTable()

  const handleApply = () => {
    onApply(Array.from(selectedColumns), conditions)
    onClose()
  }

  return (
    <Button onClick={handleApply} className="bg-primary text-primary-foreground hover:bg-primary/90">
      {t('sql.filter.apply')}
    </Button>
  )
}

// ---------------------------------------------------------------------------
// Public component
// ---------------------------------------------------------------------------

interface FilterTableModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  columns: string[]
  onApply: (selectedColumns: string[], conditions: FilterCondition[]) => void
  initialSelectedColumns?: string[]
  initialConditions?: FilterCondition[]
}

export function FilterTableModal({
  open,
  onOpenChange,
  columns,
  onApply,
  initialSelectedColumns,
  initialConditions,
}: FilterTableModalProps) {
  const { t } = useI18n()

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col" showCloseButton={false}>
        <FilterTableProvider
          columns={columns}
          initialSelectedColumns={initialSelectedColumns}
          initialConditions={initialConditions}
        >
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Filter className="h-5 w-5 text-primary" />
              {t('sql.filter.title')}
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto space-y-6">
            <ColumnSelector />
            <Separator />
            <ConditionList />
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="ghost">{t('common.actions.cancel')}</Button>
            </DialogClose>
            <ApplyButton onApply={onApply} onClose={() => onOpenChange(false)} />
          </DialogFooter>
        </FilterTableProvider>
      </DialogContent>
    </Dialog>
  )
}
