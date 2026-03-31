import { screen } from '@testing-library/react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { renderWithI18n } from '@/test/renderWithI18n'

it('renders zh close defaults in content and footer', () => {
  renderWithI18n(
    <Dialog open>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>标题</DialogTitle>
          <DialogDescription>描述</DialogDescription>
        </DialogHeader>
        <DialogFooter showCloseButton />
      </DialogContent>
    </Dialog>,
    'zh',
  )

  expect(screen.getAllByRole('button', { name: '关闭' })).toHaveLength(2)
})
