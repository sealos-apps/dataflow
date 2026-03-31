import { enAnalysisMessages } from './analysis'
import { enCommonMessages } from './common'
import { enLayoutMessages } from './layout'
import { enMongodbMessages } from './mongodb'
import { enRedisMessages } from './redis'
import { enSqlMessages } from './sql'
import { enSidebarMessages } from './sidebar'

export const enMessages = {
  ...enAnalysisMessages,
  ...enCommonMessages,
  ...enLayoutMessages,
  ...enMongodbMessages,
  ...enRedisMessages,
  ...enSqlMessages,
  ...enSidebarMessages,
} as const
