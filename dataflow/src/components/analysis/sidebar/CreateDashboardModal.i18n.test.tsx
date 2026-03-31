import { screen } from '@testing-library/react'
import { renderWithI18n } from '@/test/renderWithI18n'
import { CreateDashboardModal } from '@/components/analysis/sidebar/CreateDashboardModal'

it('renders zh dashboard copy', () => {
  renderWithI18n(<CreateDashboardModal open onOpenChange={() => {}} />, 'zh')
  expect(screen.getByText('新建仪表盘')).toBeInTheDocument()
})
