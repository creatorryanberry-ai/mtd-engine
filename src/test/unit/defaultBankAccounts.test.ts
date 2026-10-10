import { describe, expect, it } from 'vitest'

import {
  DEFAULT_BANK_ACCOUNT_DEFINITIONS,
  SYSTEM_ACCOUNT_IDS,
  filterBankAccountsForContext,
  getDefaultBankAccountContext,
  getRequiredSystemAccountIds,
  getSystemBankAccountKind,
  isSystemBankAccount,
  partitionBankAccounts,
  sortBankAccounts,
} from '~/features/bankAccounts/defaultBankAccounts'

describe('defaultBankAccounts', () => {
  it('identifies system bank accounts by the system account id prefix', () => {
    expect(isSystemBankAccount(SYSTEM_ACCOUNT_IDS.manualEntry)).toBe(true)
    expect(isSystemBankAccount('acct-12345678')).toBe(false)
  })

  it('maps system bank account ids to list kinds', () => {
    expect(getSystemBankAccountKind(SYSTEM_ACCOUNT_IDS.manualEntry)).toBe('manual-entry')
    expect(getSystemBankAccountKind(SYSTEM_ACCOUNT_IDS.cis)).toBe('cis')
    expect(getSystemBankAccountKind(SYSTEM_ACCOUNT_IDS.landlord)).toBe('landlord')
    expect(getSystemBankAccountKind('acct-12345678')).toBeNull()
  })

  it('maps business setup answers to bank account context', () => {
    expect(getDefaultBankAccountContext(null)).toEqual({
      businessType: null,
      cisRegistered: null,
    })

    expect(
      getDefaultBankAccountContext({
        businessType: 'self-employed',
        cisRegistered: true,
      }),
    ).toEqual({
      businessType: 'self-employed',
      cisRegistered: true,
    })

    expect(
      getDefaultBankAccountContext({
        businessType: 'landlord',
        cisRegistered: true,
      }),
    ).toEqual({
      businessType: 'landlord',
      cisRegistered: null,
    })
  })

  it('always requires manual entry and conditionally requires cis and landlord accounts', () => {
    expect(getRequiredSystemAccountIds()).toEqual([SYSTEM_ACCOUNT_IDS.manualEntry])

    expect(
      getRequiredSystemAccountIds({
        businessType: 'self-employed',
        cisRegistered: true,
      }),
    ).toEqual([SYSTEM_ACCOUNT_IDS.manualEntry, SYSTEM_ACCOUNT_IDS.cis])

    expect(
      getRequiredSystemAccountIds({
        businessType: 'self-employed',
        cisRegistered: false,
      }),
    ).toEqual([SYSTEM_ACCOUNT_IDS.manualEntry])

    expect(
      getRequiredSystemAccountIds({
        businessType: 'landlord',
        cisRegistered: null,
      }),
    ).toEqual([SYSTEM_ACCOUNT_IDS.manualEntry, SYSTEM_ACCOUNT_IDS.landlord])

    expect(
      getRequiredSystemAccountIds({
        businessType: 'landlord',
        cisRegistered: true,
      }),
    ).toEqual([SYSTEM_ACCOUNT_IDS.manualEntry, SYSTEM_ACCOUNT_IDS.landlord])
  })

  it('filters out conditional system accounts that are not required', () => {
    const accounts = [
      {
        externalAccountId: SYSTEM_ACCOUNT_IDS.manualEntry,
        institutionName: 'Manual Entry',
        accountName: null,
      },
      {
        externalAccountId: SYSTEM_ACCOUNT_IDS.cis,
        institutionName: 'Construction Industry Scheme (CIS)',
        accountName: null,
      },
      {
        externalAccountId: SYSTEM_ACCOUNT_IDS.landlord,
        institutionName: 'Landlord',
        accountName: null,
      },
      {
        externalAccountId: 'acct-1',
        institutionName: 'Barclays',
        accountName: 'Business',
      },
    ]

    expect(
      filterBankAccountsForContext(accounts, {
        businessType: 'self-employed',
        cisRegistered: false,
      }),
    ).toEqual([accounts[0], accounts[3]])

    expect(
      filterBankAccountsForContext(accounts, {
        businessType: 'landlord',
        cisRegistered: null,
      }),
    ).toEqual([accounts[0], accounts[2], accounts[3]])
  })

  it('sorts system accounts before connected accounts in a fixed order', () => {
    const sorted = sortBankAccounts([
      {
        externalAccountId: 'acct-1',
        institutionName: 'Barclays',
        accountName: 'Business',
      },
      {
        externalAccountId: SYSTEM_ACCOUNT_IDS.landlord,
        institutionName:
          DEFAULT_BANK_ACCOUNT_DEFINITIONS[SYSTEM_ACCOUNT_IDS.landlord].institutionName,
        accountName: null,
      },
      {
        externalAccountId: SYSTEM_ACCOUNT_IDS.manualEntry,
        institutionName:
          DEFAULT_BANK_ACCOUNT_DEFINITIONS[SYSTEM_ACCOUNT_IDS.manualEntry]
            .institutionName,
        accountName:
          DEFAULT_BANK_ACCOUNT_DEFINITIONS[SYSTEM_ACCOUNT_IDS.manualEntry].accountName,
      },
      {
        externalAccountId: 'acct-2',
        institutionName: 'NatWest',
        accountName: 'Current',
      },
    ])

    expect(sorted.map((account) => account.externalAccountId)).toEqual([
      SYSTEM_ACCOUNT_IDS.manualEntry,
      SYSTEM_ACCOUNT_IDS.landlord,
      'acct-1',
      'acct-2',
    ])
  })

  it('partitions accounts into system and connected groups', () => {
    const accounts = [
      {
        externalAccountId: 'acct-1',
        institutionName: 'Barclays',
        accountName: 'Business',
      },
      {
        externalAccountId: SYSTEM_ACCOUNT_IDS.manualEntry,
        institutionName: 'Manual Entry',
        accountName: null,
      },
    ]

    expect(partitionBankAccounts(accounts)).toEqual({
      systemAccounts: [accounts[1]],
      connectedAccounts: [accounts[0]],
    })
  })
})
