import { enCommonMessages } from './common'
import { enLayoutMessages } from './layout'
import { enSqlMessages } from './sql'
import { enSidebarMessages } from './sidebar'

export const enMessages = {
  ...enCommonMessages,
  ...enLayoutMessages,
  ...enSqlMessages,
  ...enSidebarMessages,
} as const
