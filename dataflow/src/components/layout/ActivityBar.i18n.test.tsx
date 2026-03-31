import { screen } from '@testing-library/react'
import { ActivityBar } from '@/components/layout/ActivityBar'
import { renderWithI18n } from '@/test/renderWithI18n'

it('renders translated activity labels in zh', () => {
  renderWithI18n(<ActivityBar activeTab="connections" onTabChange={() => {}} />, 'zh')
  expect(screen.getByTitle('数据库连接')).toBeInTheDocument()
  expect(screen.getByTitle('数据分析')).toBeInTheDocument()
})

it('renders translated activity labels in en', () => {
  renderWithI18n(<ActivityBar activeTab="analysis" onTabChange={() => {}} />, 'en')
  expect(screen.getByTitle('Database Connections')).toBeInTheDocument()
  expect(screen.getByTitle('Data Analysis')).toBeInTheDocument()
})
