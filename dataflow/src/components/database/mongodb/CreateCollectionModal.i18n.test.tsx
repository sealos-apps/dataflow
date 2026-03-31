import { screen } from '@testing-library/react'
import { renderWithI18n } from '@/test/renderWithI18n'
import { CreateCollectionModal } from '@/components/database/mongodb/CreateCollectionModal'

it('renders zh create-collection copy', () => {
  renderWithI18n(
    <CreateCollectionModal open onOpenChange={() => {}} connectionId="c1" databaseName="admin" />,
    'zh',
  )

  expect(screen.getByText('新建集合')).toBeInTheDocument()
})
