import { zhSidebarMessages } from '../zh/sidebar'

type MessageShape<T extends Record<string, unknown>> = {
  [K in keyof T]: string
}

export const enSidebarMessages = {
  'sidebar.menu.newQuery': 'New Query',
  'sidebar.menu.newDatabase': 'New Database',
  'sidebar.menu.newTable': 'New Table',
  'sidebar.menu.newCollection': 'New Collection',
  'sidebar.menu.exportData': 'Export Data',
  'sidebar.menu.clearData': 'Clear Data',
  'sidebar.menu.duplicateTable': 'Duplicate Table',
  'sidebar.menu.exportDatabase': 'Export Database',
  'sidebar.menu.renameDatabase': 'Rename Database',
  'sidebar.menu.deleteDatabase': 'Delete Database',
  'sidebar.menu.designTable': 'Design Table',
  'sidebar.menu.renameTable': 'Rename Table',
  'sidebar.menu.deleteTable': 'Delete Table',
  'sidebar.menu.exportCollection': 'Export Collection',
  'sidebar.menu.dropCollection': 'Drop Collection',
  'sidebar.menu.refresh': 'Refresh',
  'sidebar.menu.showSystemObjects': 'Show System Objects',
  'sidebar.menu.hideSystemObjects': 'Hide System Objects',
  'sidebar.alert.connectionFailedTitle': 'Connection Failed',
  'sidebar.alert.connectionFailedMessage':
    'Failed to connect to the database. Please check the connection settings.',
  'sidebar.tab.queryWithDatabase': 'Query - {database}',
  'sidebar.tab.queryWithConnection': 'Query - {connection}',
  'sidebar.tab.redisKeys': '{database} Keys',
  'sidebar.redis.allData': 'All Data',
} satisfies MessageShape<typeof zhSidebarMessages>
