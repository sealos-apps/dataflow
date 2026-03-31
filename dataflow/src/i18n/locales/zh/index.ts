import { zhAnalysisMessages } from './analysis'
import { zhCommonMessages } from './common'
import { zhLayoutMessages } from './layout'
import { zhMongodbMessages } from './mongodb'
import { zhRedisMessages } from './redis'
import { zhSqlMessages } from './sql'
import { zhSidebarMessages } from './sidebar'

export const zhMessages = {
  ...zhAnalysisMessages,
  ...zhCommonMessages,
  ...zhLayoutMessages,
  ...zhMongodbMessages,
  ...zhRedisMessages,
  ...zhSqlMessages,
  ...zhSidebarMessages,
} as const
