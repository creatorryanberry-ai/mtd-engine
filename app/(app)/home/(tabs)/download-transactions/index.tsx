import { Redirect } from 'one'

import { MTD_ROUTES } from '~/features/mtd/constants'

export default function DownloadTransactionsRedirect() {
  return <Redirect href={MTD_ROUTES.bankAccounts} />
}
