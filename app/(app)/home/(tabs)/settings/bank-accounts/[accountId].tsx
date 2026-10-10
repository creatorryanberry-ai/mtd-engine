import { createRoute } from 'one'

const route = createRoute<'/(app)/home/(tabs)/settings/bank-accounts/[accountId]'>()

export { BankAccountEditScreen as default } from '~/features/mtd/screens/BankAccountEditScreen'
export { route }
