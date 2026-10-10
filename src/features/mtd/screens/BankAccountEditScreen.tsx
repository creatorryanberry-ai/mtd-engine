import { router, useParams } from 'one'
import { useCallback, useEffect, useState } from 'react'
import { Keyboard } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { isWeb, SizableText, Spinner, YStack } from 'tamagui'

import { authFetch } from '~/features/auth/client/authFetch'
import { notifyMtdTransactionsChanged } from '~/features/bankAccounts/client/mtdTransactionsEmitter'
import { isSystemBankAccount } from '~/features/bankAccounts/defaultBankAccounts'
import { MtdActionButton } from '~/features/mtd/components/MtdActionButton'
import { MTD_ROUTES, MTD_TAB_BAR_HEIGHT } from '~/features/mtd/constants'
import { MTD_TOKENS } from '~/features/mtd/mtdTokens'
import { mtdInputProps } from '~/features/mtd/mtdFormStyles'
import { formatSubmissionAmount } from '~/features/mtd/utils/formatAmount'
import { formatLastUpdated } from '~/features/mtd/utils/formatLastUpdated'
import { dialogConfirm } from '~/interface/dialogs/actions'
import { Input } from '~/interface/forms/Input'
import { KeyboardAwareScrollView } from '~/interface/keyboard/KeyboardAwareScrollView'
import { TrashIcon } from '~/interface/icons/phosphor/TrashIcon'
import { showToast } from '~/interface/toast/helpers'

import type { BankAccountDto } from '~/features/bankAccounts/client/useMtdBankAccounts'

function ReadOnlyField({ label, value }: { label: string; value: string }) {
  return (
    <YStack gap="$1.5">
      <SizableText fontSize={12} fontWeight="600" color={MTD_TOKENS.textMuted}>
        {label}
      </SizableText>
      <SizableText fontSize={15} color={MTD_TOKENS.text}>
        {value}
      </SizableText>
    </YStack>
  )
}

export function BankAccountEditScreen() {
  const { accountId } = useParams<{ accountId: string }>()
  const insets = useSafeAreaInsets()

  const [account, setAccount] = useState<BankAccountDto | null>(null)
  const [institutionName, setInstitutionName] = useState('')
  const [accountName, setAccountName] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadAccount = useCallback(async () => {
    if (!accountId) return

    setIsLoading(true)
    setError(null)

    try {
      const response = await authFetch<{ accounts: BankAccountDto[] }>(
        '/api/bank-accounts',
      )
      if (response.error) {
        throw new Error(response.error.message || 'Failed to load bank account')
      }

      const found = response.data?.accounts.find((row) => row.id === accountId) ?? null
      if (!found) {
        throw new Error('Bank account not found')
      }

      setAccount(found)
      setInstitutionName(found.institutionName ?? '')
      setAccountName(found.accountName ?? '')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load bank account')
    } finally {
      setIsLoading(false)
    }
  }, [accountId])

  useEffect(() => {
    void loadAccount()
  }, [loadAccount])

  const hasChanges =
    account != null &&
    (institutionName.trim() !== (account.institutionName ?? '').trim() ||
      accountName.trim() !== (account.accountName ?? '').trim())

  const canSave =
    account != null &&
    !isSystemBankAccount(account.externalAccountId) &&
    hasChanges &&
    institutionName.trim().length > 0 &&
    !isSaving &&
    !isDeleting

  const handleSave = async () => {
    if (!accountId || !canSave) return

    Keyboard.dismiss()
    setIsSaving(true)

    try {
      const response = await authFetch<{ account: BankAccountDto }>(
        `/api/bank-accounts/${accountId}`,
        {
          method: 'PATCH',
          body: JSON.stringify({
            institutionName: institutionName.trim(),
            accountName: accountName.trim() || null,
          }),
        },
      )

      if (response.error) {
        throw new Error(response.error.message || 'Failed to save bank account')
      }

      if (response.data?.account) {
        setAccount({
          ...response.data.account,
          transactionCount: account?.transactionCount ?? 0,
          unreviewedCount: account?.unreviewedCount ?? 0,
        })
      }

      showToast('Bank account updated', { type: 'success' })
      router.back()
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to save bank account', {
        type: 'error',
      })
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!accountId || !account || isDeleting) return

    const confirmed = await dialogConfirm({
      title: 'Remove bank account?',
      description: `This removes ${account.institutionName || 'this account'} and deletes ${account.transactionCount} linked transaction${account.transactionCount === 1 ? '' : 's'}. This cannot be undone.`,
    })
    if (!confirmed) return

    setIsDeleting(true)

    try {
      const response = await authFetch<{ deleted: boolean }>(
        `/api/bank-accounts/${accountId}`,
        { method: 'DELETE' },
      )

      if (response.error) {
        throw new Error(response.error.message || 'Failed to remove bank account')
      }

      notifyMtdTransactionsChanged()
      showToast('Bank account removed', { type: 'success' })
      router.replace(MTD_ROUTES.settingsBankAccounts as any)
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to remove bank account', {
        type: 'error',
      })
    } finally {
      setIsDeleting(false)
    }
  }

  const saveButton = (
    <MtdActionButton
      width="100%"
      size="large"
      disabled={!canSave}
      loading={isSaving}
      onPress={() => void handleSave()}
    >
      {isSaving ? 'Saving…' : 'Save'}
    </MtdActionButton>
  )

  const scrollContent = (
    <YStack
      gap="$5"
      px="$4"
      pt="$4"
      pb={isWeb ? '$8' : insets.bottom + MTD_TAB_BAR_HEIGHT + 24}
      maxW={480}
      width="100%"
      mx="auto"
      $lg={{ px: '$6', pt: '$6' }}
    >
      <YStack gap="$1">
        <SizableText fontSize={14} color={MTD_TOKENS.textMuted} lineHeight={20}>
          Update how this account appears in your records.
        </SizableText>
      </YStack>

      {isLoading ? (
        <YStack py="$8" items="center">
          <Spinner size="large" color={MTD_TOKENS.orange} />
        </YStack>
      ) : error ? (
        <SizableText fontSize={14} color="#EF4444">
          {error}
        </SizableText>
      ) : account ? (
        <>
          {isSystemBankAccount(account.externalAccountId) ? (
            <SizableText fontSize={14} color={MTD_TOKENS.textMuted} lineHeight={20}>
              This default account is always available for manual entries and cannot be
              edited or removed.
            </SizableText>
          ) : null}

          <YStack
            bg={MTD_TOKENS.card}
            borderWidth={1}
            borderColor={MTD_TOKENS.cardBorder}
            rounded="$5"
            p="$4"
            gap="$4"
          >
            {isSystemBankAccount(account.externalAccountId) ? (
              <>
                <ReadOnlyField
                  label="Account"
                  value={account.institutionName || 'Bank account'}
                />
                {account.accountName ? (
                  <ReadOnlyField label="Description" value={account.accountName} />
                ) : null}
              </>
            ) : (
              <>
                <YStack gap="$2">
                  <SizableText
                    fontSize={12}
                    fontWeight="600"
                    color={MTD_TOKENS.textMuted}
                  >
                    Bank name
                  </SizableText>
                  <Input
                    width="100%"
                    placeholder="e.g. NatWest"
                    value={institutionName}
                    onChangeText={setInstitutionName}
                    autoCapitalize="words"
                    autoCorrect="off"
                    {...mtdInputProps}
                  />
                </YStack>

                <YStack gap="$2">
                  <SizableText
                    fontSize={12}
                    fontWeight="600"
                    color={MTD_TOKENS.textMuted}
                  >
                    Account name
                  </SizableText>
                  <Input
                    width="100%"
                    placeholder="e.g. Business current account"
                    value={accountName}
                    onChangeText={setAccountName}
                    autoCapitalize="words"
                    autoCorrect="off"
                    {...mtdInputProps}
                  />
                </YStack>
              </>
            )}

            {account.sortCode || account.accountNumber ? (
              <ReadOnlyField
                label="Account details"
                value={[account.sortCode, account.accountNumber]
                  .filter(Boolean)
                  .join(' · ')}
              />
            ) : null}

            {account.balance != null ? (
              <ReadOnlyField
                label="Account balance"
                value={`${formatSubmissionAmount(account.balance)} · from bank statement`}
              />
            ) : null}

            <ReadOnlyField
              label="Last synced"
              value={formatLastUpdated(account.lastSyncedAt)}
            />
          </YStack>

          {!isSystemBankAccount(account.externalAccountId) ? saveButton : null}

          {!isSystemBankAccount(account.externalAccountId) ? (
            <MtdActionButton
              size="large"
              width="100%"
              variant="secondary"
              disabled={isSaving || isDeleting}
              loading={isDeleting}
              icon={
                !isDeleting ? (
                  <TrashIcon size={18} color={MTD_TOKENS.orange} />
                ) : undefined
              }
              onPress={() => void handleDelete()}
            >
              {isDeleting ? 'Removing…' : 'Remove bank account'}
            </MtdActionButton>
          ) : null}
        </>
      ) : null}
    </YStack>
  )

  if (isWeb) {
    return (
      <YStack flex={1} minH={0} overflow="scroll">
        {scrollContent}
      </YStack>
    )
  }

  return (
    <YStack flex={1}>
      <KeyboardAwareScrollView
        showsVerticalScrollIndicator={false}
        bottomOffset={100}
        keyboardShouldPersistTaps="handled"
        contentInsetAdjustmentBehavior="automatic"
      >
        {scrollContent}
      </KeyboardAwareScrollView>
    </YStack>
  )
}
