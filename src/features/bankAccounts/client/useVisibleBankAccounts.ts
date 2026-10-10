import { useMemo } from 'react'

import { useBusinessSettings } from '~/features/business/useBusinessSettings'
import {
  filterBankAccountsForContext,
  getDefaultBankAccountContext,
  partitionBankAccounts,
} from '~/features/bankAccounts/defaultBankAccounts'

import type { BankAccountDto } from '~/features/bankAccounts/client/useMtdBankAccounts'

export function useVisibleBankAccounts(accounts: BankAccountDto[]) {
  const { settings, isLoading: isSettingsLoading } = useBusinessSettings()

  const visibleAccounts = useMemo(() => {
    return filterBankAccountsForContext(accounts, getDefaultBankAccountContext(settings))
  }, [accounts, settings])

  const { systemAccounts, connectedAccounts } = useMemo(
    () => partitionBankAccounts(visibleAccounts),
    [visibleAccounts],
  )

  return {
    accounts: visibleAccounts,
    systemAccounts,
    connectedAccounts,
    isSettingsLoading,
  }
}
