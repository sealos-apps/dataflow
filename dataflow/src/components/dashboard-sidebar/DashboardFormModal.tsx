import { createContext, use, useState, useCallback, type ReactNode } from 'react'
import { Plus, Settings } from 'lucide-react'
import { useAnalysisDefinitionStore } from '@/stores/analysisDefinitionStore'
import type { DashboardDefinition as Dashboard, RefreshRule } from '@/stores/analysisDefinitionStore'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { Input } from '@/components/ui/Input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ModalForm, useModalForm } from '@/components/ui/ModalForm'
import { useI18n } from '@/i18n/useI18n'

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

interface DashboardFormCtxValue {
  name: string
  setName: (v: string) => void
  description: string
  setDescription: (v: string) => void
  refreshRule: RefreshRule
  setRefreshRule: (v: RefreshRule) => void
  isEditMode: boolean
  originalName: string
}

const DashboardFormCtx = createContext<DashboardFormCtxValue | null>(null)

function useDashboardFormCtx(): DashboardFormCtxValue {
  const ctx = use(DashboardFormCtx)
  if (!ctx) throw new Error('useDashboardFormCtx must be used within DashboardFormProvider')
  return ctx
}

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

/** Owns business logic for creating or editing a dashboard. */
function DashboardFormProvider({
  dashboard,
  onSuccess,
  children,
}: {
  dashboard?: Dashboard
  onSuccess?: () => void
  children: ReactNode
}) {
  const { t } = useI18n()
  const createDashboard = useAnalysisDefinitionStore(state => state.createDashboard)
  const updateDashboard = useAnalysisDefinitionStore(state => state.updateDashboard)
  const isDashboardNameExists = useAnalysisDefinitionStore(state => state.isDashboardNameExists)
  const isEditMode = !!dashboard

  const [name, setName] = useState(dashboard?.name ?? '')
  const [description, setDescription] = useState(dashboard?.description ?? '')
  const [refreshRule, setRefreshRule] = useState<RefreshRule>(dashboard?.refreshRule ?? 'on-demand')

  const handleSubmit = useCallback(async () => {
    if (!name.trim()) return
    if (isDashboardNameExists(name, dashboard?.id)) {
      throw new Error(t('analysis.dashboard.nameExists'))
    }
    if (isEditMode) {
      await updateDashboard(dashboard.id, { name, description: description || '', refreshRule })
    } else {
      await createDashboard(name, description || undefined, refreshRule)
    }
    onSuccess?.()
  }, [name, description, refreshRule, isDashboardNameExists, dashboard, isEditMode, createDashboard, updateDashboard, onSuccess, t])

  const title = isEditMode ? t('analysis.dashboard.edit') : t('analysis.dashboard.create')
  const icon = isEditMode ? Settings : Plus

  return (
    <DashboardFormCtx value={{ name, setName, description, setDescription, refreshRule, setRefreshRule, isEditMode, originalName: dashboard?.name ?? '' }}>
      <ModalForm.Provider onSubmit={handleSubmit} meta={{ title, icon }}>
        {children}
      </ModalForm.Provider>
    </DashboardFormCtx>
  )
}

// ---------------------------------------------------------------------------
// Subcomponents
// ---------------------------------------------------------------------------

/** Form fields for dashboard name, description, and refresh rule. */
function DashboardFormFields() {
  const { t } = useI18n()
  const { name, setName, description, setDescription, refreshRule, setRefreshRule } = useDashboardFormCtx()
  const { state, actions } = useModalForm()

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label>
          <span className="text-destructive">*</span>
          {t('analysis.dashboard.nameLabel')}
          <span className="text-muted-foreground font-normal">（{t('analysis.dashboard.nameRequired')}）</span>
        </Label>
        <Input
          value={name}
          onChange={(e) => { setName(e.target.value); actions.closeAlert() }}
          placeholder={t('analysis.dashboard.namePlaceholder')}
          maxLength={15}
          disabled={state.isSubmitting}
          autoFocus
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label>
          {t('analysis.dashboard.descriptionLabel')}
          <span className="text-muted-foreground font-normal">（{t('analysis.dashboard.descriptionOptional')}）</span>
        </Label>
        <Input
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder={t('analysis.dashboard.descriptionPlaceholder')}
          disabled={state.isSubmitting}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label>{t('analysis.dashboard.refreshRuleLabel')}</Label>
        <Select
          value={refreshRule}
          onValueChange={(v) => setRefreshRule(v as RefreshRule)}
          disabled={state.isSubmitting}
        >
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="on-demand">{t('analysis.dashboard.refreshRule.onDemand')}</SelectItem>
            <SelectItem value="by-minute">{t('analysis.dashboard.refreshRule.byMinute')}</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  )
}

/** Submit button disabled when name is empty (or unchanged in edit mode). */
function DashboardFormSubmitButton() {
  const { t } = useI18n()
  const { name } = useDashboardFormCtx()
  return <ModalForm.SubmitButton label={t('analysis.dashboard.confirmAction')} disabled={!name.trim()} />
}

// ---------------------------------------------------------------------------
// Modal
// ---------------------------------------------------------------------------

interface DashboardFormModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** When provided, the modal operates in edit mode. */
  dashboard?: Dashboard
}

/** Unified modal for creating or editing a dashboard. */
export function DashboardFormModal({ open, onOpenChange, dashboard }: DashboardFormModalProps) {
  const handleSuccess = useCallback(() => {
    onOpenChange(false)
  }, [onOpenChange])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DashboardFormProvider dashboard={dashboard} onSuccess={handleSuccess}>
          <ModalForm.Header />
          <DashboardFormFields />
          <ModalForm.Alert />
          <ModalForm.Footer>
            <ModalForm.CancelButton />
            <DashboardFormSubmitButton />
          </ModalForm.Footer>
        </DashboardFormProvider>
      </DialogContent>
    </Dialog>
  )
}
