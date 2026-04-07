import { Plus, Search, Trash2 } from 'lucide-react'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ModalForm, useModalForm } from '@/components/ui/ModalForm'
import { useI18n } from '@/i18n/useI18n'
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

function getOperatorOptions(
  t: ReturnType<typeof useI18n>['t'],
): Array<{ value: MongoFilterOperator; label: string }> {
  return [
    { value: '$eq', label: t('mongodb.filter.operator.eq') },
    { value: '$ne', label: t('mongodb.filter.operator.ne') },
    { value: '$regex', label: t('mongodb.filter.operator.regex') },
    { value: '$gt', label: t('mongodb.filter.operator.gt') },
    { value: '$lt', label: t('mongodb.filter.operator.lt') },
    { value: '$gte', label: t('mongodb.filter.operator.gte') },
    { value: '$lte', label: t('mongodb.filter.operator.lte') },
    { value: '$in', label: t('mongodb.filter.operator.in') },
  ]
}

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
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
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
  const { t } = useI18n()
  const { conditions, fields, addCondition, removeCondition, updateCondition } = useFilterCollectionCtx()
  const { state } = useModalForm()
  const operatorOptions = getOperatorOptions(t)
  const usedFields = new Set(conditions.map((condition) => condition.field.trim()).filter(Boolean))
  const canAddCondition = fields.some((field) => !usedFields.has(field))

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-muted-foreground">
          {t('mongodb.filter.conditions')}
        </h3>
        {conditions.length > 0 && (
          <Button
            type="button"
            onClick={addCondition}
            size="sm"
            variant="outline"
            disabled={state.isSubmitting || !canAddCondition}
            className="h-7 text-xs gap-1"
          >
            <Plus className="h-3 w-3" />
            {t('mongodb.filter.addCondition')}
          </Button>
        )}
      </div>

      {conditions.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-8 border border-dashed rounded-lg">
          <Button
            type="button"
            size="sm"
            onClick={addCondition}
            disabled={state.isSubmitting || !canAddCondition}
            className="gap-1"
          >
            <Plus className="h-3.5 w-3.5" />
            {t('mongodb.filter.addCondition')}
          </Button>
          <p className="text-sm text-muted-foreground">{t('mongodb.filter.noFilters')}</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {conditions.map((condition) => {
            const fieldOptions = fields.filter(
              (field) => field === condition.field || !usedFields.has(field),
            )

            return (
              <div key={condition.id} className="flex items-center gap-2">
                <Select
                  value={condition.field}
                  onValueChange={(value) => updateCondition(condition.id, { field: value })}
                  disabled={state.isSubmitting}
                >
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder={t('mongodb.filter.selectField')} />
                  </SelectTrigger>
                  <SelectContent>
                    {fieldOptions.map((field) => (
                      <SelectItem key={field} value={field}>
                        {field}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select
                  value={condition.operator}
                  onValueChange={(value) =>
                    updateCondition(condition.id, { operator: value as MongoFilterOperator })
                  }
                  disabled={state.isSubmitting}
                >
                  <SelectTrigger className="h-9 w-28">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {operatorOptions.map((operator) => (
                      <SelectItem key={operator.value} value={operator.value}>
                        {operator.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Input
                  value={condition.value}
                  onChange={(event) => updateCondition(condition.id, { value: event.target.value })}
                  placeholder={
                    condition.operator === '$in'
                      ? t('mongodb.filter.valueInPlaceholder')
                      : t('mongodb.filter.valuePlaceholder')
                  }
                  className="flex-1 h-9"
                  disabled={state.isSubmitting}
                />

                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => removeCondition(condition.id)}
                  disabled={state.isSubmitting}
                  className="h-9 w-9 text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function FilterModalAlert() {
  const { state } = useModalForm()
  if (!state.alert) return null
  return <ModalForm.Alert />
}

function FilterCollectionFooter() {
  const { t } = useI18n()
  const { clearAndClose } = useFilterCollectionCtx()
  const { state, actions } = useModalForm()

  return (
    <ModalForm.Footer className="justify-between gap-2 sm:justify-between">
      <Button type="button" variant="ghost" onClick={clearAndClose} disabled={state.isSubmitting}>
        {t('mongodb.filter.clear')}
      </Button>
      <div className="flex items-center gap-2">
        <ModalForm.CancelButton />
        <Button type="button" onClick={actions.submit} disabled={state.isSubmitting}>
          {state.isSubmitting ? null : <Search className="h-4 w-4" />}
          {t('mongodb.filter.apply')}
        </Button>
      </div>
    </ModalForm.Footer>
  )
}
