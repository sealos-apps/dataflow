import { Dialog, DialogContent } from '@/components/ui/dialog'
import { ModalForm, useModalForm } from '@/components/database/modals/ModalForm'
import { FormatSelector } from '@/components/database/modals/FormatSelector'
import { ExportFooter, ExportProgress } from '@/components/database/modals/ExportProgress'
import { ExportRedisProvider, useExportRedisCtx } from './ExportRedisProvider'

interface ExportRedisModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  connectionId: string
  databaseName: string
  initialPattern?: string
  initialTypes?: string[]
}

export function ExportRedisModal({
  open,
  onOpenChange,
  connectionId,
  databaseName,
  initialPattern = '*',
  initialTypes = [],
}: ExportRedisModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <ExportRedisProvider
          open={open}
          connectionId={connectionId}
          databaseName={databaseName}
          initialPattern={initialPattern}
          initialTypes={initialTypes}
        >
          <ModalForm.Header />
          <ExportRedisFields />
          <ModalForm.Alert />
          <ExportRedisFooterBridge />
        </ExportRedisProvider>
      </DialogContent>
    </Dialog>
  )
}

function ExportRedisFields() {
  const { format, setFormat, formatOptions, patternSummary, typesSummary, isSuccess, statusText } =
    useExportRedisCtx()
  const { state } = useModalForm()
  const disabled = state.isSubmitting || isSuccess

  return (
    <div className="space-y-6">
      <FormatSelector options={formatOptions} value={format} onChange={setFormat} disabled={disabled} />

      <div className="space-y-3">
        <label className="text-sm font-medium">Current Key Pattern</label>
        <div className="rounded-md border bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
          {patternSummary}
        </div>
        <p className="text-xs text-muted-foreground">
          Redis export currently shows the active filter for reference only. The backend still exports all keys.
        </p>
      </div>

      <div className="space-y-3">
        <label className="text-sm font-medium">Current Type Filter</label>
        <div className="rounded-md border bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
          {typesSummary}
        </div>
      </div>

      <ExportProgress isExporting={state.isSubmitting} isSuccess={isSuccess} statusText={statusText} />
    </div>
  )
}

function ExportRedisFooterBridge() {
  const { isSuccess } = useExportRedisCtx()
  return <ExportFooter isSuccess={isSuccess} />
}
