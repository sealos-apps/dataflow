import { zhCommonMessages } from './common'
import { zhLayoutMessages } from './layout'
import { zhSqlMessages } from './sql'
import { zhSidebarMessages } from './sidebar'

export const zhMessages = {
  ...zhCommonMessages,
  ...zhLayoutMessages,
  ...zhSqlMessages,
  ...zhSidebarMessages,
} as const
