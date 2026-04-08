import { use } from 'react'
import { FileJson, Edit2, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import { useCollectionView } from './CollectionViewProvider'
import { useI18n } from '@/i18n/useI18n'
import { FindBarContext } from '@/components/database/shared/FindBar.Provider'

/** List of MongoDB document cards with hover actions. */
export function CollectionViewDocumentList() {
  const { t } = useI18n()
  const { state, actions } = useCollectionView()
  const findBar = use(FindBarContext)

  if (state.documents.length === 0) {
    return (
      <div className="text-center py-12">
        <FileJson className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
        <p className="text-sm text-muted-foreground">{t('mongodb.collection.noDocuments')}</p>
      </div>
    )
  }

  return (
    <>
      {state.documents.map((doc, idx) => {
        const hasMatch = findBar?.state.total
          ? findBar.state.matches.some((m) => m.rowIndex === idx)
          : false
        const hasCurrentMatch = findBar?.state.total
          ? findBar.state.matches[findBar.state.currentMatchIndex]?.rowIndex === idx
          : false
        return (
        <div
          key={idx}
          data-find-current={hasCurrentMatch ? 'true' : undefined}
          onClick={(e) => { e.stopPropagation(); actions.setSelectedDocIndex(idx) }}
          className={cn(
            'rounded-xl border p-4 group relative transition-all duration-200 cursor-pointer',
            hasCurrentMatch
              ? 'bg-blue-100 border-blue-300 shadow-sm '
              : hasMatch
                ? 'bg-blue-50/60 border-blue-200'
                : state.selectedDocIndex === idx
                  ? 'bg-blue-50 border-blue-100 shadow-sm'
                  : 'bg-background border-border/50 hover:bg-muted/30 hover:shadow-sm',
          )}
        >
          <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-2">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  onClick={(e) => { e.stopPropagation(); actions.handleEditClick(doc) }}
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground hover:text-primary"
                >
                  <Edit2 className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>{t('mongodb.document.editAction')}</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  onClick={(e) => { e.stopPropagation(); actions.handleDeleteClick(doc._id) }}
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>{t('mongodb.document.deleteAction')}</TooltipContent>
            </Tooltip>
          </div>
          <pre className="text-sm overflow-x-auto font-mono text-foreground/80">
            {JSON.stringify(doc, null, 2).replace(/^\{\n/, '').replace(/\n\}$/, '')}
          </pre>
        </div>
        )
      })}
    </>
  )
}
