import { createStorageValue } from '@mtd/helpers'

import type { User } from '~/data/types'

let user: User | null | undefined

const userCache = createStorageValue<User | null>('user-cache')

export const getUser = () => {
  return user === undefined ? userCache.get() : user
}

export const setUser = (next: User | null) => {
  userCache.set(next)
  user = next
}
