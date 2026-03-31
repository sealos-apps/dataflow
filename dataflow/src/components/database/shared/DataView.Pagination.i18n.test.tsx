import { screen } from '@testing-library/react'
import { DataViewPagination } from '@/components/database/shared/DataView.Pagination'
import { renderWithI18n } from '@/test/renderWithI18n'

it('renders zh pagination labels', () => {
  renderWithI18n(
    <DataViewPagination
      currentPage={1}
      totalPages={5}
      pageSize={10}
      total={42}
      loading={false}
      onPageChange={() => {}}
      onPageSizeChange={() => {}}
    />,
    'zh',
  )

  expect(screen.getByText('每页行数：')).toBeInTheDocument()
  expect(screen.getByText('第')).toBeInTheDocument()
  expect(screen.getByText('显示 1 - 10 / 共 42')).toBeInTheDocument()
  expect(screen.getByText('共 5')).toBeInTheDocument()
  expect(screen.getByTitle('第一页')).toBeInTheDocument()
  expect(screen.getByTitle('上一页')).toBeInTheDocument()
  expect(screen.getByTitle('下一页')).toBeInTheDocument()
  expect(screen.getByTitle('最后一页')).toBeInTheDocument()
})

it('falls back to safe total pages when totalPages is falsy', () => {
  renderWithI18n(
    <DataViewPagination
      currentPage={1}
      totalPages={0}
      pageSize={10}
      total={5}
      loading={false}
      onPageChange={() => {}}
      onPageSizeChange={() => {}}
    />,
    'zh',
  )

  expect(screen.getByText('共 1')).toBeInTheDocument()
  expect(screen.getByTitle('下一页')).toBeDisabled()
  expect(screen.getByTitle('最后一页')).toBeDisabled()
  expect(screen.getByRole('spinbutton')).toHaveAttribute('max', '1')
})
