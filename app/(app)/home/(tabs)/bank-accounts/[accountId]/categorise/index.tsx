import { Redirect, createRoute } from 'one'

import { BankAccountTransactionsScreen } from '~/features/mtd/screens/BankAccountTransactionsScreen'
import { MTD_ROUTES } from '~/features/mtd/constants'

const route = createRoute<'/(app)/home/(tabs)/bank-accounts/[accountId]/categorise'>()

export default function AccountCategoriseRoute() {
  const { accountId } = route.useParams()

  if (!accountId) {
    return <Redirect href={MTD_ROUTES.bankAccounts} />
  }

  return <BankAccountTransactionsScreen bankAccountId={accountId} />
}
