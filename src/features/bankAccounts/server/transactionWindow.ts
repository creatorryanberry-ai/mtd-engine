import { server } from '~/env'

import { getWindowStartDate } from '../constants'

export function getTransactionWindowStartDate() {
  return getWindowStartDate(Number(server.TRANSACTION_WINDOW_DAYS))
}
