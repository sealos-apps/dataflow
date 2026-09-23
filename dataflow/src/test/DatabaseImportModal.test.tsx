import { ApolloError } from '@apollo/client'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { DatabaseImportModal } from '@/components/database/import/DatabaseImportModal'
import { I18nProvider } from '@/i18n/I18nProvider'
import { useConnectionStore, type Connection } from '@/stores/useConnectionStore'

const { importSql } = vi.hoisted(() => ({ importSql: vi.fn() }))

vi.mock('@graphql', async (importOriginal) => ({
  ...await importOriginal<typeof import('@graphql')>(),
  useImportSqlMutation: () => [importSql],
  useImportPreviewMutation: () => [vi.fn(), { loading: false }],
  useImportTableFileMutation: () => [vi.fn()],
  useGetDatabaseMetadataQuery: () => ({ loading: false }),
}))

const connection: Connection = {
  id: 'postgres-1',
  name: 'PostgreSQL @ localhost',
  type: 'POSTGRES',
  host: 'localhost',
  port: '5432',
  user: 'postgres',
  password: '',
  database: 'analytics',
  createdAt: '2026-04-02T00:00:00.000Z',
}

const originalState = useConnectionStore.getState()
const script = 'SELECT 1;'
const tooLargeMessage = '导入内容过大，请减小 SQL 文件或文本后重试。'

async function prepareSqlImport(source: 'file' | 'text') {
  render(
    <I18nProvider locale="zh">
      <DatabaseImportModal
        open
        onOpenChange={vi.fn()}
        connectionId={connection.id}
        databaseName="analytics"
      />
    </I18nProvider>,
  )
  fireEvent.click(screen.getByRole('button', { name: /SQL 脚本/ }))

  if (source === 'file') {
    const file = new File([script], 'query.sql', { type: 'application/sql' })
    // jsdom does not implement File.text().
    Object.defineProperty(file, 'text', { value: async () => script })
    fireEvent.change(screen.getByLabelText('上传 SQL 文件'), { target: { files: [file] } })
  } else {
    fireEvent.click(screen.getByRole('button', { name: '文本' }))
    fireEvent.change(screen.getByLabelText('SQL 文本输入'), { target: { value: script } })
  }

  await waitFor(() => expect(screen.getByRole('button', { name: '执行导入' })).toBeEnabled())
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: '执行导入' }))
  })
}

describe('DatabaseImportModal SQL errors', () => {
  beforeEach(() => {
    importSql.mockReset()
    useConnectionStore.setState({
      ...originalState,
      connections: [connection],
      fetchDatabases: vi.fn().mockResolvedValue(['analytics']),
    })
  })

  afterEach(() => {
    cleanup()
    useConnectionStore.setState(originalState)
  })

  it.each(['file', 'text'] as const)('explains HTTP 413 for a SQL %s import', async (source) => {
    importSql.mockRejectedValue(new ApolloError({
      networkError: Object.assign(new Error('Received status code 413'), { statusCode: 413 }),
    }))

    await prepareSqlImport(source)

    expect(await screen.findByText(tooLargeMessage)).toBeInTheDocument()
    expect(screen.queryByText('Received status code 413')).not.toBeInTheDocument()
    expect(importSql).toHaveBeenCalledOnce()
  })

  it('preserves ordinary SQL errors even when their message contains 413', async () => {
    const message = 'SQL syntax error near column_413'
    importSql.mockRejectedValue(new ApolloError({ errorMessage: message }))

    await prepareSqlImport('text')

    expect(await screen.findByText(message)).toBeInTheDocument()
    expect(screen.queryByText(tooLargeMessage)).not.toBeInTheDocument()
  })
})
