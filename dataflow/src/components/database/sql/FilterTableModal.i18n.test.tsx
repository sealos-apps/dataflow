import { screen } from '@testing-library/react'
import { renderWithI18n } from '@/test/renderWithI18n'
import { FilterTableModal } from '@/components/database/sql/FilterTableModal'

it('renders zh filter modal labels', () => {
  renderWithI18n(
    <FilterTableModal
      open
      onOpenChange={() => {}}
      columns={['id', 'name']}
      initialSelectedColumns={['id', 'name']}
      initialConditions={[]}
      onApply={() => {}}
    />,
    'zh',
  )

  expect(screen.getByText('筛选数据表')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: '应用筛选' })).toBeInTheDocument()
})
