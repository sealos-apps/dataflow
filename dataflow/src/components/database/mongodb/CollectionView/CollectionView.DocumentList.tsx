import { FileJson, Edit2, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/utils'
import { useCollectionView } from './CollectionViewProvider'
import { useI18n } from '@/i18n/useI18n'

/** List of MongoDB document cards with hover actions. */
export function CollectionViewDocumentList() {
  const { t } = useI18n()
  const { state, actions } = useCollectionView()

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
      {state.documents.map((doc, idx) => (
        <div
          key={idx}
          onClick={() => actions.setSelectedDocIndex(idx)}
          className={cn(
            'rounded-xl border p-4 group relative transition-all duration-200 cursor-pointer',
            state.selectedDocIndex === idx
              ? 'bg-blue-50 border-blue-100 shadow-sm'
              : 'bg-background border-border/50 hover:bg-muted/30 hover:shadow-sm',
          )}
        >
          <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-2">
            <Button
              onClick={(e) => { e.stopPropagation(); actions.handleEditClick(doc) }}
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground hover:text-primary"
              title={t('mongodb.document.editAction')}
            >
              <Edit2 className="h-4 w-4" />
            </Button>
            <Button
              onClick={(e) => { e.stopPropagation(); actions.handleDeleteClick(doc._id) }}
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground hover:text-destructive"
              title={t('mongodb.document.deleteAction')}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
          <pre className="text-sm overflow-x-auto font-mono text-foreground/80">
            {JSON.stringify(doc, null, 2).replace(/^\{\n/, '').replace(/\n\}$/, '')}
          </pre>
        </div>
      ))}
    </>
  )
}
