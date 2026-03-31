import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/Button'

export interface DocumentEditorDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  submitLabel: string
  description?: string
  placeholder?: string
  content: string
  onContentChange: (content: string) => void
  onSave: () => Promise<void>
}

/** Shared dialog shell for document add/edit modals. Owns layout, not behavior. */
export function DocumentEditorDialog({
  open,
  onOpenChange,
  title,
  submitLabel,
  description,
  placeholder,
  content,
  onContentChange,
  onSave,
}: DocumentEditorDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className={`flex-1 overflow-hidden${description ? ' flex flex-col gap-2' : ''}`}>
          {description && (
            <p className="text-sm text-muted-foreground">{description}</p>
          )}
          <textarea
            className="w-full h-full min-h-[300px] p-4 font-mono text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary bg-muted/30 resize-none"
            value={content}
            onChange={(e) => onContentChange(e.target.value)}
            placeholder={placeholder}
          />
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="ghost">Cancel</Button>
          </DialogClose>
          <Button onClick={onSave}>{submitLabel}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
