import { fireEvent, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { CreateDatabaseModal } from '@/components/database/CreateDatabaseModal'
import { renderWithI18n } from '@/test/renderWithI18n'
import { useConnectionStore, type Connection } from '@/stores/useConnectionStore'

const originalState = useConnectionStore.getState()

const mongoConnection: Connection = {
  id: 'mongo-1',
  name: 'MongoDB @ localhost',
  type: 'MONGODB',
  host: 'localhost',
  port: '27017',
  user: 'root',
  password: '',
  database: 'admin',
  createdAt: '2026-04-02T00:00:00.000Z',
}

describe('CreateDatabaseModal', () => {
  beforeEach(() => {
    useConnectionStore.setState(originalState)
  })

  it('creates a MongoDB database by seeding its first collection', async () => {
    const createDatabase = vi.fn().mockResolvedValue({ success: true })
    const createTable = vi.fn().mockResolvedValue({ success: true })
    const onSuccess = vi.fn()
    const onOpenChange = vi.fn()

    useConnectionStore.setState({
      ...useConnectionStore.getState(),
      connections: [mongoConnection],
      createDatabase,
      createTable,
    })

    renderWithI18n(
      <CreateDatabaseModal
        open
        onOpenChange={onOpenChange}
        connectionId={mongoConnection.id}
        onSuccess={onSuccess}
      />,
    )

    fireEvent.change(screen.getByPlaceholderText('输入数据库名称'), {
      target: { value: 'analytics' },
    })
    fireEvent.change(screen.getByPlaceholderText('例如：users'), {
      target: { value: 'events' },
    })
    fireEvent.click(screen.getByRole('button', { name: '创建数据库' }))

    await waitFor(() => {
      expect(createTable).toHaveBeenCalledWith('analytics', 'analytics', 'events', [])
    })

    expect(createDatabase).not.toHaveBeenCalled()
    expect(onSuccess).toHaveBeenCalled()
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })
})
