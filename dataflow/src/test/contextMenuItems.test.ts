import { describe, expect, it, vi } from 'vitest'

import {
  getConnectionMenuItems,
  getDatabaseMenuItems,
} from '@/components/sidebar/contextMenuItems'
import type { ContextMenuItem } from '@/components/ui/ContextMenu'

function labels(items: ContextMenuItem[]) {
  return items.flatMap((item) => ('label' in item ? [item.label] : []))
}

describe('MongoDB context menu items', () => {
  const callbacks = {
    onAction: vi.fn(),
    t: (key: string) => key,
  }

  it('does not expose unsupported MongoDB database creation from the connection menu', () => {
    const items = getConnectionMenuItems('MONGODB', callbacks)

    expect(labels(items)).toContain('sidebar.menu.newDatabase')
  })

  it('keeps collection actions and only exposes supported database-level MongoDB actions', () => {
    const items = getDatabaseMenuItems('MONGODB', callbacks)
    const itemLabels = labels(items)

    expect(itemLabels).toContain('sidebar.menu.newCollection')
    expect(itemLabels).toContain('sidebar.menu.deleteDatabase')
    expect(itemLabels).not.toContain('sidebar.menu.renameDatabase')
  })
})

describe('SQL database context menu items', () => {
  const callbacks = {
    onAction: vi.fn(),
    t: (key: string) => key,
  }

  it('still exposes Postgres database rename support', () => {
    const items = getDatabaseMenuItems('POSTGRES', callbacks)

    expect(labels(items)).toContain('sidebar.menu.renameDatabase')
  })
})
