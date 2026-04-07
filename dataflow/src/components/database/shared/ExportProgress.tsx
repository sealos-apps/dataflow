import { CheckCircle, Download, Loader2 } from 'lucide-react'
import { DialogClose, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/Button'
import { useModalForm } from '@/components/ui/ModalForm'
import { useI18n } from '@/i18n/useI18n'

// ---------------------------------------------------------------------------
// ExportProgress — spinner / success status display
// ---------------------------------------------------------------------------

interface ExportProgressProps {
  /** Whether an export operation is currently running. */
  isExporting: boolean
  /** Whether the export completed successfully. */
  isSuccess: boolean
  /** Descriptive text shown alongside the spinner (e.g., "Exporting table 2 of 5..."). */
  statusText?: string
}

/** Displays export status: spinner during export, success message on completion. Returns `null` when idle. */
export function ExportProgress({ isExporting, isSuccess, statusText }: ExportProgressProps) {
  const { t } = useI18n()

  if (!isExporting && !isSuccess) return null

  return (
    <div className="flex items-center gap-2 text-sm pt-2">
      {isExporting && (
        <>
          <Loader2 className="h-4 w-4 animate-spin text-primary" />
          <span className="text-muted-foreground">{statusText ?? t('common.status.exporting')}</span>
        </>
      )}
      {!isExporting && isSuccess && (
        <>
          <CheckCircle className="h-4 w-4 text-success" />
          <span className="text-success font-medium">{t('common.status.exportComplete')}</span>
        </>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// ExportFooter — Start Export / Exporting... / Close button logic
// ---------------------------------------------------------------------------

interface ExportFooterProps {
  /** When true, shows only a Close button. When false, shows Cancel + Start Export. */
  isSuccess: boolean
  /** Click handler for the export button. Falls back to `actions.submit` from ModalForm context. */
  onClick?: () => void
}

/**
 * Footer for export modals. Reads `isSubmitting` from ModalForm context.
 * Shows "Start Export" when idle, spinner when exporting, "Close" after success.
 */
export function ExportFooter({ isSuccess, onClick }: ExportFooterProps) {
  const { t } = useI18n()
  const { state, actions } = useModalForm()
  const handleClick = onClick ?? actions.submit

  if (isSuccess) {
    return (
      <DialogFooter>
        <DialogClose asChild>
          <Button variant="outline">{t('common.actions.close')}</Button>
        </DialogClose>
      </DialogFooter>
    )
  }

  return (
    <DialogFooter>
      <DialogClose asChild>
        <Button type="button" variant="outline" disabled={state.isSubmitting}>
          {t('common.actions.cancel')}
        </Button>
      </DialogClose>
      <Button onClick={handleClick} disabled={state.isSubmitting} className="gap-2">
        {state.isSubmitting ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Download className="h-4 w-4" />
        )}
        {state.isSubmitting ? t('common.status.exporting') : t('common.actions.startExport')}
      </Button>
    </DialogFooter>
  )
}
