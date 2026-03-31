import { screen } from '@testing-library/react'
import { renderWithI18n } from '@/test/renderWithI18n'
import { SQLEditorView } from '@/components/editor/SQLEditorView'

vi.mock('@graphql', () => ({
  useRawExecuteLazyQuery: () => [vi.fn()],
}))

vi.mock('@monaco-editor/react', () => ({
  loader: { config: vi.fn() },
  default: () => <div data-testid="monaco-editor" />,
}))

it('renders zh SQL editor shell labels', () => {
  renderWithI18n(
    <SQLEditorView
      tabId="tab-sql-editor"
      context={{ connectionId: 'conn-1' }}
      initialSql="select 1"
    />,
    'zh',
  )

  expect(screen.getByRole('button', { name: '运行' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: '格式化' })).toBeInTheDocument()
  expect(screen.getByText('选择数据库')).toBeInTheDocument()
  expect(screen.getByText('选择 Schema')).toBeInTheDocument()
})
