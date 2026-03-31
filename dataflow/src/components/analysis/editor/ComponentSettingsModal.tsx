import { useAnalysisStore } from '@/stores/useAnalysisStore'
import { Dialog, DialogClose, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { useI18n } from '@/i18n/useI18n'

interface ComponentSettingsModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

/** Modal for editing dashboard component settings (title, description, stats fields). */
export function ComponentSettingsModal({ open, onOpenChange }: ComponentSettingsModalProps) {
  const { t } = useI18n()
  const { activeDashboardId, selectedComponentId, dashboards, updateComponent } = useAnalysisStore()
  const dashboard = dashboards.find(d => d.id === activeDashboardId)
  const selectedComponent = dashboard?.components.find(c => c.id === selectedComponentId)

  return (
    <Dialog open={open && !!selectedComponent} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[400px]">
        {selectedComponent && (
          <>
            <DialogHeader>
              <DialogTitle>{t('analysis.widget.editTitle')}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-1.5 block">{t('analysis.widget.title')}</label>
                <Input
                  value={selectedComponent.title}
                  onChange={(e) => updateComponent(selectedComponent.id, { title: e.target.value })}
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-1.5 block">{t('analysis.widget.description')}</label>
                <textarea
                  value={selectedComponent.description || ''}
                  onChange={(e) => updateComponent(selectedComponent.id, { description: e.target.value })}
                  className="w-full px-3 py-2 rounded-md border bg-background text-sm resize-none h-20"
                  placeholder={t('analysis.widget.descriptionPlaceholder')}
                />
              </div>
              {selectedComponent.type === 'stats' && (
                <>
                  <div>
                    <label className="text-sm font-medium mb-1.5 block">{t('analysis.widget.value')}</label>
                    <Input
                      value={selectedComponent.data?.value || ''}
                      onChange={(e) => updateComponent(selectedComponent.id, {
                        data: { ...selectedComponent.data, value: e.target.value }
                      })}
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1.5 block">{t('analysis.widget.trend')}</label>
                    <Input
                      value={selectedComponent.data?.trend || ''}
                      onChange={(e) => updateComponent(selectedComponent.id, {
                        data: { ...selectedComponent.data, trend: e.target.value }
                      })}
                      placeholder="+10%"
                    />
                  </div>
                </>
              )}
            </div>
            <div className="flex justify-end">
              <DialogClose asChild>
                <Button>{t('analysis.widget.done')}</Button>
              </DialogClose>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
