import type { InferSelectModel } from 'drizzle-orm'

import type {
  mtdTransaction,
  notification,
  userPublic,
  userState,
} from '~/database/schema'

export type User = InferSelectModel<typeof userPublic>
export type UserState = InferSelectModel<typeof userState>
export type MtdTransaction = InferSelectModel<typeof mtdTransaction>
export type Notification = InferSelectModel<typeof notification>

export type UserWithState = User & {
  state?: UserState
}

export type MtdTransactionWithUser = MtdTransaction & {
  user?: User
}
