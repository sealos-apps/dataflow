import { screen } from '@testing-library/react'
import { TabContent } from '@/components/layout/TabContent'
import { useTabStore } from '@/stores/useTabStore'
import { renderWithI18n } from '@/test/renderWithI18n'

afterEach(() => {
  useTabStore.setState({ tabs: [], activeTabId: null })
})

it('renders the zh empty state', () => {
  useTabStore.setState({ tabs: [], activeTabId: null })
  renderWithI18n(<TabContent />, 'zh')
  expect(screen.getByText('暂无打开的标签页')).toBeInTheDocument()
})

it('renders the zh invalid table configuration state', () => {
  useTabStore.setState({
    tabs: [{ id: 'tab-invalid', type: 'table', title: 'Broken Table', connectionId: 'conn-1', databaseName: 'db' }],
    activeTabId: 'tab-invalid',
  })
  renderWithI18n(<TabContent />, 'zh')
  expect(screen.getByText('无效的数据表配置')).toBeInTheDocument()
})
