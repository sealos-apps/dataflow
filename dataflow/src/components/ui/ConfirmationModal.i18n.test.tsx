import { fireEvent, screen } from '@testing-library/react'
import { ConfirmationModal } from '@/components/ui/ConfirmationModal'
import { renderWithI18n } from '@/test/renderWithI18n'

it('renders zh defaults for confirm and cancel', () => {
  renderWithI18n(
    <ConfirmationModal isOpen onClose={() => {}} onConfirm={() => {}} title="删除" message="确认删除？" />,
    'zh',
  )

  expect(screen.getByRole('button', { name: '取消' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: '确认' })).toBeInTheDocument()
})

it('renders zh fallback verification label when verificationLabel is omitted', () => {
  renderWithI18n(
    <ConfirmationModal
      isOpen
      onClose={() => {}}
      onConfirm={() => {}}
      title="删除"
      message="确认删除？"
      verificationText="DELETE"
    />,
    'zh',
  )

  expect(screen.getByText('输入 "DELETE" 以确认')).toBeInTheDocument()
})

it('renders zh processing label while confirming', () => {
  renderWithI18n(
    <ConfirmationModal
      isOpen
      onClose={() => {}}
      onConfirm={() => new Promise(() => {})}
      title="删除"
      message="确认删除？"
    />,
    'zh',
  )

  fireEvent.click(screen.getByRole('button', { name: '确认' }))

  expect(screen.getByText('处理中...')).toBeInTheDocument()
})
