import { screen } from '@testing-library/react'
import { renderWithI18n } from '@/test/renderWithI18n'
import { useI18n } from '@/i18n/useI18n'

function Probe() {
  const { locale, t } = useI18n()
  return (
    <>
      <span data-testid="locale">{locale}</span>
      <span>{t('layout.activity.connections')}</span>
    </>
  )
}

it('provides locale and translated messages', () => {
  renderWithI18n(<Probe />, 'en')
  expect(screen.getByTestId('locale')).toHaveTextContent('en')
  expect(screen.getByText('Database Connections')).toBeInTheDocument()
})
