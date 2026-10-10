export const SYSTEM_ACCOUNT_PREFIX = 'system:'

export const SYSTEM_ACCOUNT_IDS = {
  manualEntry: `${SYSTEM_ACCOUNT_PREFIX}manual-entry`,
  cis: `${SYSTEM_ACCOUNT_PREFIX}cis`,
  landlord: `${SYSTEM_ACCOUNT_PREFIX}landlord`,
} as const

export type SystemAccountId = (typeof SYSTEM_ACCOUNT_IDS)[keyof typeof SYSTEM_ACCOUNT_IDS]

export const DEFAULT_BANK_ACCOUNT_ORDER: SystemAccountId[] = [
  SYSTEM_ACCOUNT_IDS.manualEntry,
  SYSTEM_ACCOUNT_IDS.cis,
  SYSTEM_ACCOUNT_IDS.landlord,
]

export const DEFAULT_BANK_ACCOUNT_DEFINITIONS = {
  [SYSTEM_ACCOUNT_IDS.manualEntry]: {
    institutionName: 'Manual Entry',
    accountName: null,
  },
  [SYSTEM_ACCOUNT_IDS.cis]: {
    institutionName: 'Construction Industry Scheme (CIS)',
    accountName: null,
  },
  [SYSTEM_ACCOUNT_IDS.landlord]: {
    institutionName: 'Landlord',
    accountName: null,
  },
} as const

export type DefaultBankAccountContext = {
  cisRegistered?: boolean | null
  businessType?: 'self-employed' | 'landlord' | null
}

export function getDefaultBankAccountContext(
  settings?: {
    cisRegistered?: boolean | null
    businessType?: string | null
  } | null,
): DefaultBankAccountContext {
  const businessType =
    settings?.businessType === 'self-employed' || settings?.businessType === 'landlord'
      ? settings.businessType
      : null

  return {
    businessType,
    cisRegistered: businessType === 'self-employed' ? settings?.cisRegistered : null,
  }
}

export type SystemBankAccountKind = 'manual-entry' | 'cis' | 'landlord'

export function getSystemBankAccountKind(
  externalAccountId: string,
): SystemBankAccountKind | null {
  if (externalAccountId === SYSTEM_ACCOUNT_IDS.manualEntry) return 'manual-entry'
  if (externalAccountId === SYSTEM_ACCOUNT_IDS.cis) return 'cis'
  if (externalAccountId === SYSTEM_ACCOUNT_IDS.landlord) return 'landlord'
  return null
}

export function isSystemBankAccount(externalAccountId: string) {
  return externalAccountId.startsWith(SYSTEM_ACCOUNT_PREFIX)
}

export function getRequiredSystemAccountIds(context?: DefaultBankAccountContext) {
  const required: SystemAccountId[] = [SYSTEM_ACCOUNT_IDS.manualEntry]

  if (context?.businessType === 'self-employed' && context.cisRegistered === true) {
    required.push(SYSTEM_ACCOUNT_IDS.cis)
  }

  if (context?.businessType === 'landlord') {
    required.push(SYSTEM_ACCOUNT_IDS.landlord)
  }

  return required
}

export function filterBankAccountsForContext<T extends { externalAccountId: string }>(
  accounts: T[],
  context?: DefaultBankAccountContext,
) {
  const required = new Set(getRequiredSystemAccountIds(context))

  return accounts.filter(
    (account) =>
      !isSystemBankAccount(account.externalAccountId) ||
      required.has(account.externalAccountId as SystemAccountId),
  )
}

export function sortBankAccounts<
  T extends {
    externalAccountId: string
    institutionName?: string | null
    accountName?: string | null
  },
>(accounts: T[]) {
  const systemOrder = new Map(
    DEFAULT_BANK_ACCOUNT_ORDER.map((externalAccountId, index) => [
      externalAccountId,
      index,
    ]),
  )

  return [...accounts].sort((left, right) => {
    const leftIsSystem = isSystemBankAccount(left.externalAccountId)
    const rightIsSystem = isSystemBankAccount(right.externalAccountId)

    if (leftIsSystem && rightIsSystem) {
      return (
        (systemOrder.get(left.externalAccountId as SystemAccountId) ?? 99) -
        (systemOrder.get(right.externalAccountId as SystemAccountId) ?? 99)
      )
    }

    if (leftIsSystem) return -1
    if (rightIsSystem) return 1

    const leftLabel = `${left.institutionName ?? ''}\0${left.accountName ?? ''}`
    const rightLabel = `${right.institutionName ?? ''}\0${right.accountName ?? ''}`
    return leftLabel.localeCompare(rightLabel)
  })
}

export function partitionBankAccounts<T extends { externalAccountId: string }>(
  accounts: T[],
) {
  const sorted = sortBankAccounts(accounts)
  const systemAccounts: T[] = []
  const connectedAccounts: T[] = []

  for (const account of sorted) {
    if (isSystemBankAccount(account.externalAccountId)) {
      systemAccounts.push(account)
    } else {
      connectedAccounts.push(account)
    }
  }

  return { systemAccounts, connectedAccounts }
}
