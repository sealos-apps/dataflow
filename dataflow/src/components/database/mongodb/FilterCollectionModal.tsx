import { Plus, Search, Trash2 } from 'lucide-react'
import { Dialog, DialogContent, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ModalForm, useModalForm } from '@/components/database/modals/ModalForm'
import {
  FilterCollectionProvider,
  useFilterCollectionCtx,
} from './FilterCollectionProvider'
import type {
  FlatMongoFilter,
  MongoFilterOperator,
} from './filter-collection.types'

interface FilterCollectionModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onApply: (filter: FlatMongoFilter) => void
  fields: string[]
  initialFilter?: FlatMongoFilter
}

const OPERATOR_OPTIONS: Array<{ value: MongoFilterOperator; label: string }> = [
  { value: '$eq', label: 'Equals (=)' },
  { value: '$ne', label: 'Not Equals (!=)' },
  { value: '$regex', label: 'Contains' },
  { value: '$gt', label: 'Greater Than (>)' },
  { value: '$lt', label: 'Less Than (<)' },
  { value: '$gte', label: 'Greater/Equal (>=)' },
  { value: '$lte', label: 'Less/Equal (<=)' },
  { value: '$in', label: 'In (comma separated)' },
]

/** Modal for building flat MongoDB collection filters. */
export function FilterCollectionModal({
  open,
  onOpenChange,
  onApply,
  fields,
  initialFilter,
}: FilterCollectionModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl">
        <FilterCollectionProvider
          open={open}
          fields={fields}
          initialFilter={initialFilter}
          onApply={onApply}
          onOpenChange={onOpenChange}
        >
          <ModalForm.Header />
          <FilterConditionList />
          <FilterModalAlert />
          <FilterCollectionFooter />
        </FilterCollectionProvider>
      </DialogContent>
    </Dialog>
  )
}

function FilterConditionList() {
  const { conditions, fields, addCondition, removeCondition, updateCondition } = useFilterCollectionCtx()
  const { state } = useModalForm()
  const usedFields = new Set(conditions.map((condition) => condition.field.trim()).filter(Boolean))
  const canAddCondition = fields.some((field) => !usedFields.has(field))

  if (conditions.length === 0) {
    return (
      <div className="rounded-lg border border-dashed p-6 text-center">
        <p className="text-sm text-muted-foreground">No filters applied</p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={addCondition}
          disabled={state.isSubmitting || !canAddCondition}
          className="mt-4"
        >
          <Plus className="h-4 w-4" />
          Add Condition
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {conditions.map((condition) => {
        const fieldOptions = fields.filter(
          (field) => field === condition.field || !usedFields.has(field),
        )

        return (
          <div key={condition.id} className="rounded-lg border p-4">
            <div className="grid grid-cols-12 gap-3">
              <div className="col-span-4 space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Field</label>
                <Select
                  value={condition.field}
                  onValueChange={(value) => updateCondition(condition.id, { field: value })}
                  disabled={state.isSubmitting}
                >
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="Select field" />
                  </SelectTrigger>
                  <SelectContent>
                    {fieldOptions.map((field) => (
                      <SelectItem key={field} value={field}>
                        {field}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="col-span-3 space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Operator</label>
                <Select
                  value={condition.operator}
                  onValueChange={(value) =>
                    updateCondition(condition.id, { operator: value as MongoFilterOperator })
                  }
                  disabled={state.isSubmitting}
                >
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {OPERATOR_OPTIONS.map((operator) => (
                      <SelectItem key={operator.value} value={operator.value}>
                        {operator.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="col-span-4 space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Value</label>
                <Input
                  value={condition.value}
                  onChange={(event) => updateCondition(condition.id, { value: event.target.value })}
                  placeholder={condition.operator === '$in' ? 'e.g. foo, bar' : 'Value'}
                  className="h-9"
                  disabled={state.isSubmitting}
                />
              </div>

              <div className="col-span-1 flex items-end">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => removeCondition(condition.id)}
                  disabled={state.isSubmitting}
                  className="h-9 w-9 text-muted-foreground hover:text-destructive"
                  title="Remove condition"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        )
      })}

      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={addCondition}
        disabled={state.isSubmitting || !canAddCondition}
        className="w-full border-dashed"
      >
        <Plus className="h-4 w-4" />
        Add Another Condition
      </Button>
    </div>
  )
}

function FilterModalAlert() {
  const { state } = useModalForm()
  if (!state.alert) return null
  return <ModalForm.Alert />
}

function FilterCollectionFooter() {
  const { clearConditions } = useFilterCollectionCtx()
  const { state, actions } = useModalForm()

  return (
    <DialogFooter className="justify-between gap-2 sm:justify-between">
      <Button type="button" variant="ghost" onClick={clearConditions} disabled={state.isSubmitting}>
        Clear Filters
      </Button>
      <div className="flex items-center gap-2">
        <ModalForm.CancelButton />
        <Button type="button" onClick={actions.submit} disabled={state.isSubmitting}>
          {state.isSubmitting ? null : <Search className="h-4 w-4" />}
          Apply
        </Button>
      </div>
    </DialogFooter>
  )
}
