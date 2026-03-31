import { screen } from '@testing-library/react'
import { renderWithI18n } from '@/test/renderWithI18n'
import { RedisFilterModal } from '@/components/database/redis/RedisFilterModal'

it('renders zh redis filter labels', () => {
  renderWithI18n(
    <RedisFilterModal
      open
      onOpenChange={() => {}}
      initialPattern="*"
      initialTypes={[]}
      onApply={() => {}}
    />,
    'zh'
  )

  expect(screen.getByText('筛选 Redis 键')).toBeInTheDocument()
})
