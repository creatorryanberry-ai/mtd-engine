import type { BankAccountDto } from '~/features/bankAccounts/client/useMtdBankAccounts'

export function formatBankAccountName(account: BankAccountDto) {
  return account.accountName || account.institutionName || 'Bank account'
}

export function formatBankAccountSelectorLabel(account: BankAccountDto) {
  const bankName = account.institutionName?.trim()
  const accountName = account.accountName?.trim()

  if (bankName && accountName) {
    return `${bankName}, ${accountName}`
  }

  return bankName || accountName || 'Bank account'
}

export function formatBankAccountLabel(account: BankAccountDto) {
  return formatBankAccountSelectorLabel(account)
}

export function formatRuleBankAccountsLabel(
  bankAccountIds: string[],
  accounts: BankAccountDto[],
) {
  if (
    bankAccountIds.length === 0 ||
    (accounts.length > 0 &&
      accounts.every((account) => bankAccountIds.includes(account.id)))
  ) {
    return 'All accounts'
  }

  const labels = bankAccountIds
    .map((id) => accounts.find((account) => account.id === id))
    .filter((account): account is BankAccountDto => account != null)
    .map(formatBankAccountName)

  return labels.length > 0 ? labels.join(', ') : 'Selected accounts'
}

export function isRuleForBankAccount(
  rule: { bankAccountIds: string[] },
  bankAccountId: string,
) {
  if (rule.bankAccountIds.length === 0) return true
  return rule.bankAccountIds.includes(bankAccountId)
}

export function resolveInitialRuleBankAccountIds(
  initialBankAccountIds: string[] | undefined,
  contextBankAccountId: string | undefined,
  allAccountIds: string[],
) {
  if (initialBankAccountIds !== undefined) {
    if (initialBankAccountIds.length === 0) {
      return allAccountIds
    }

    return initialBankAccountIds
  }

  if (contextBankAccountId) {
    return [contextBankAccountId]
  }

  return allAccountIds
}
