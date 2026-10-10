import { createStorage } from '@mtd/helpers'

import { APP_SCHEME } from '../constants'
import { createWriteEpochStorage } from './writeEpochStorage'

const expoAuthWrites = createWriteEpochStorage(createStorage('expo-auth-client'))

export function createExpoAuthStorage() {
  return expoAuthWrites.fork()
}

export function clearExpoAuthStorage() {
  expoAuthWrites.invalidate()
  const storage = expoAuthWrites.fork()
  storage.setItem(`${APP_SCHEME}_cookie`, '{}')
  storage.setItem(`${APP_SCHEME}_session_data`, '{}')
}
