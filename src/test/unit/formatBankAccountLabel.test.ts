import { describe, expect, it } from 'vitest'

import {
  formatBankAccountSelectorLabel,
  formatRuleBankAccountsLabel,
  isRuleForBankAccount,
  resolveInitialRuleBankAccountIds,
} from '~/features/mtd/utils/formatBankAccountLabel'

import type { BankAccountDto } from '~/features/bankAccounts/client/useMtdBankAccounts'

function sampleAccount(
  overrides: Partial<BankAccountDto> & Pick<BankAccountDto, 'id'>,
): BankAccountDto {
  return {
    userId: 'user-1',
    bankLinkItemId: 'item-1',
    externalAccountId: 'acct-1',
    institutionName: 'Barclays',
    accountName: 'Current',
    sortCode: '20-00-00',
    accountNumber: '12345678',
    accountType: 'current',
    balance: 100,
    currency: 'GBP',
    lastSyncedAt: null,
    syncError: null,
    transactionCount: 1,
    unreviewedCount: 0,
    ...overrides,
  }
}

describe('formatBankAccountLabel helpers', () => {
  it('defaults new rules to the creating account', () => {
    expect(
      resolveInitialRuleBankAccountIds(undefined, 'account-a', [
        'account-a',
        'account-b',
      ]),
    ).toEqual(['account-a'])
  })

  it('uses saved account ids when editing', () => {
    expect(
      resolveInitialRuleBankAccountIds(['account-b'], 'account-a', [
        'account-a',
        'account-b',
      ]),
    ).toEqual(['account-b'])
  })

  it('treats legacy empty account ids as all accounts in the picker', () => {
    expect(
      resolveInitialRuleBankAccountIds([], 'account-a', ['account-a', 'account-b']),
    ).toEqual(['account-a', 'account-b'])
  })

  it('formats bank selectors as bank name and account name', () => {
    expect(formatBankAccountSelectorLabel(sampleAccount({ id: 'account-a' }))).toBe(
      'Barclays, Current',
    )
    expect(
      formatBankAccountSelectorLabel(
        sampleAccount({
          id: 'account-a',
          institutionName: null,
          accountName: 'Business Account',
        }),
      ),
    ).toBe('Business Account')
  })

  it('identifies rules that apply to a bank account', () => {
    expect(isRuleForBankAccount({ bankAccountIds: ['account-a'] }, 'account-a')).toBe(
      true,
    )
    expect(isRuleForBankAccount({ bankAccountIds: ['account-a'] }, 'account-b')).toBe(
      false,
    )
    expect(
      isRuleForBankAccount({ bankAccountIds: ['account-a', 'account-b'] }, 'account-a'),
    ).toBe(true)
    expect(isRuleForBankAccount({ bankAccountIds: [] }, 'account-a')).toBe(true)
  })

  it('formats selected account labels', () => {
    const accounts = [
      sampleAccount({ id: 'account-a', accountName: 'Business' }),
      sampleAccount({ id: 'account-b', accountName: 'Current' }),
    ]

    expect(formatRuleBankAccountsLabel(['account-a'], accounts)).toBe('Business')
    expect(formatRuleBankAccountsLabel(['account-a', 'account-b'], accounts)).toBe(
      'All accounts',
    )
    expect(
      formatRuleBankAccountsLabel(['account-a', 'account-b', 'system-account'], accounts),
    ).toBe('All accounts')
  })
})
