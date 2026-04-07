import { Dialog, DialogContent } from '@/components/ui/dialog'
import { ModalForm, useModalForm } from '@/components/ui/ModalForm'
import { FormatSelector } from '@/components/database/shared/FormatSelector'
import { ExportFooter, ExportProgress } from '@/components/database/shared/ExportProgress'
import { useI18n } from '@/i18n/useI18n'
import { ExportRedisProvider, useExportRedisCtx } from './ExportRedisProvider'
import type { RedisKey } from './RedisView/types'

interface ExportRedisModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  connectionId: string
  databaseName: string
  keys: RedisKey[]
  initialPattern?: string
  initialTypes?: string[]
}

export function ExportRedisModal({
  open,
  onOpenChange,
  connectionId,
  databaseName,
  keys,
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
          keys={keys}
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
  const { t } = useI18n()
  const { format, setFormat, formatOptions, patternSummary, typesSummary, isSuccess, statusText } =
    useExportRedisCtx()
  const { state } = useModalForm()
  const disabled = state.isSubmitting || isSuccess

  return (
    <div className="flex flex-col gap-4">
      <FormatSelector options={formatOptions} value={format} onChange={setFormat} disabled={disabled} />

      <div className="flex flex-col gap-2">
        <label className="text-sm font-medium text-foreground">{t('redis.export.patternLabel')}</label>
        <div className="rounded-md border bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
          {patternSummary}
        </div>
        <p className="text-xs text-muted-foreground">
          {t('redis.filter.exportHint')}
        </p>
      </div>

      <div className="flex flex-col gap-2">
        <label className="text-sm font-medium text-foreground">{t('redis.export.typesLabel')}</label>
        <div className="rounded-md border bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
          {typesSummary}
        </div>
      </div>

      <ExportProgress isExporting={state.isSubmitting} isSuccess={isSuccess} statusText={statusText} />
    </div>
  )
}

function ExportRedisFooterBridge() {
  const { isSuccess, handleExport } = useExportRedisCtx()
  return <ExportFooter isSuccess={isSuccess} onClick={handleExport} />
}
