import { Dialog, DialogContent } from '@/components/ui/dialog'
import { Input } from '@/components/ui/Input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ModalForm, useModalForm } from '@/components/database/modals/ModalForm'
import { RedisKeyProvider, useRedisKeyCtx } from './RedisKeyProvider'
import { RedisKeyStringEditor } from './RedisKey.StringEditor'
import { RedisKeyHashEditor } from './RedisKey.HashEditor'
import { RedisKeyListEditor } from './RedisKey.ListEditor'
import { RedisKeySetEditor } from './RedisKey.SetEditor'
import { RedisKeyZSetEditor } from './RedisKey.ZSetEditor'
import type { RedisKeyDraft, RedisKeyType } from './redis-key.types'

interface RedisKeyModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSave: (draft: RedisKeyDraft) => Promise<void>
  initialData?: RedisKeyDraft | null
}

const REDIS_TYPES: RedisKeyType[] = ['string', 'hash', 'list', 'set', 'zset']

/** Modal for creating Redis keys and editing existing string-key values. */
export function RedisKeyModal({
  open,
  onOpenChange,
  onSave,
  initialData,
}: RedisKeyModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <RedisKeyProvider open={open} onSave={onSave} initialData={initialData}>
          <ModalForm.Header />
          <RedisKeyIdentityFields />
          <RedisKeyEditorSwitch />
          <ModalForm.Alert />
          <RedisKeyFooter />
        </RedisKeyProvider>
      </DialogContent>
    </Dialog>
  )
}

/** Shared key identity fields with create-only type/name editing. */
function RedisKeyIdentityFields() {
  const { draft, setKey, setType, canEditKeyName, canEditType, isEditMode } = useRedisKeyCtx()
  const { state } = useModalForm()

  return (
    <div className="grid gap-4 md:grid-cols-[2fr_1fr]">
      <div className="space-y-1.5">
        <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Key Name
        </label>
        <Input
          value={draft.key}
          onChange={(event) => setKey(event.target.value)}
          placeholder="e.g., users:1001"
          disabled={state.isSubmitting || !canEditKeyName}
          className={!canEditKeyName ? 'border-blue-200 bg-blue-50/20' : undefined}
        />
        {isEditMode && !canEditKeyName && (
          <p className="text-xs text-muted-foreground">Existing key names are read-only in edit mode.</p>
        )}
      </div>

      <div className="space-y-1.5">
        <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Type
        </label>
        <Select value={draft.type} onValueChange={(value) => setType(value as RedisKeyType)} disabled={state.isSubmitting || !canEditType}>
          <SelectTrigger className={!canEditType ? 'border-blue-200 bg-blue-50/20' : undefined}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {REDIS_TYPES.map((type) => (
              <SelectItem key={type} value={type}>
                {type.toUpperCase()}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {isEditMode && !canEditType && (
          <p className="text-xs text-muted-foreground">Existing key types are read-only in edit mode.</p>
        )}
      </div>
    </div>
  )
}

function RedisKeyEditorSwitch() {
  const { draft, isEditMode, isStringEdit } = useRedisKeyCtx()

  if (isEditMode && !isStringEdit) {
    return (
      <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
        Editing is currently supported only for string keys.
      </div>
    )
  }

  switch (draft.type) {
    case 'string':
      return <RedisKeyStringEditor />
    case 'hash':
      return <RedisKeyHashEditor />
    case 'list':
      return <RedisKeyListEditor />
    case 'set':
      return <RedisKeySetEditor />
    case 'zset':
      return <RedisKeyZSetEditor />
    default:
      return null
  }
}

function RedisKeyFooter() {
  const { draft, isEditMode, isStringEdit } = useRedisKeyCtx()
  const { state } = useModalForm()
  const submitLabel = draft.mode === 'edit' ? 'Save Value' : 'Create Key'
  const isSubmitDisabled = !draft.key.trim() || state.isSubmitting || (isEditMode && !isStringEdit)

  return (
    <ModalForm.Footer>
      <ModalForm.CancelButton />
      <ModalForm.SubmitButton label={submitLabel} disabled={isSubmitDisabled} />
    </ModalForm.Footer>
  )
}
