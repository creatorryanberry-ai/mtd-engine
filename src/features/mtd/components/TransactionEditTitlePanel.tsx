import { useCallback } from 'react'
import { Modal, Pressable, StyleSheet } from 'react-native'
import { isWeb, SizableText, XStack, YStack } from 'tamagui'

import { useCategorisationRules } from '~/features/categorisation/client/useCategorisationRules'
import { MTD_TOKENS } from '~/features/mtd/mtdTokens'
import { mtdInputProps } from '~/features/mtd/mtdFormStyles'
import { Input } from '~/interface/forms/Input'
import { MtdActionButton } from './MtdActionButton'

import type { TransactionRuleDraft } from '../utils/transactionEditRules'

type TransactionEditTitlePanelProps = {
  merchant: string
  friendlyName: string
  ruleDrafts: TransactionRuleDraft[]
  selectedHmrcCategory: string | null
  onFriendlyNameChange: (value: string) => void
  onRuleDraftsChange: (drafts: TransactionRuleDraft[]) => void
  onDone: () => void | Promise<void>
  onClose: () => void
  isSaving?: boolean
  saveError?: string | null
}

function TransactionEditTitlePanelContent({
  merchant,
  friendlyName,
  ruleDrafts,
  selectedHmrcCategory,
  onFriendlyNameChange,
  onRuleDraftsChange,
  onDone,
  onClose,
  isSaving = false,
  saveError,
}: TransactionEditTitlePanelProps) {
  const visibleDrafts = ruleDrafts.filter((draft) => !draft.deleted)
  const primaryDraft = visibleDrafts[0]
  const originalText = primaryDraft?.matchValue ?? merchant

  const updateDraft = (clientId: string, next: TransactionRuleDraft) => {
    onRuleDraftsChange(
      ruleDrafts.map((draft) => (draft.clientId === clientId ? next : draft)),
    )
  }

  const handleFriendlyNameChange = (value: string) => {
    onFriendlyNameChange(value)
    if (primaryDraft) {
      updateDraft(primaryDraft.clientId, { ...primaryDraft, friendlyName: value })
    }
  }

  const handleOriginalTextChange = (value: string) => {
    if (primaryDraft) {
      updateDraft(primaryDraft.clientId, { ...primaryDraft, matchValue: value })
      return
    }

    const hmrcCategory = selectedHmrcCategory ?? 'uncategorised'
    onRuleDraftsChange([
      {
        clientId: crypto.randomUUID(),
        matchValue: value,
        friendlyName,
        hmrcCategory,
        matchType: 'contains',
      },
      ...ruleDrafts,
    ])
  }

  return (
    <YStack
      bg={MTD_TOKENS.card}
      borderWidth={1}
      borderColor={MTD_TOKENS.cardBorder}
      rounded="$5"
      p="$4"
      gap="$3"
      width="100%"
      maxW={560}
    >
      <XStack items="center" justify="space-between">
        <SizableText fontSize={18} fontWeight="700" color={MTD_TOKENS.text}>
          Edit friendly name
        </SizableText>
        <SizableText
          fontSize={14}
          color={MTD_TOKENS.textMuted}
          cursor="pointer"
          pressStyle={{ opacity: 0.8 }}
          onPress={onClose}
        >
          Cancel
        </SizableText>
      </XStack>

      <SizableText fontSize={13} color={MTD_TOKENS.textMuted} lineHeight={18}>
        Set a friendly name and original text. Changes are saved when you tap Save.
      </SizableText>

      <YStack gap="$2">
        <SizableText fontSize={12} fontWeight="600" color={MTD_TOKENS.textMuted}>
          Friendly name
        </SizableText>
        <Input
          value={friendlyName}
          onChangeText={handleFriendlyNameChange}
          placeholder="e.g. PayPal"
          {...mtdInputProps}
        />
      </YStack>

      <YStack gap="$2">
        <SizableText fontSize={12} fontWeight="600" color={MTD_TOKENS.textMuted}>
          Original text
        </SizableText>
        <Input
          value={originalText}
          onChangeText={handleOriginalTextChange}
          placeholder="Original merchant text"
          autoCapitalize="characters"
          autoCorrect={false}
          {...mtdInputProps}
        />
      </YStack>

      {saveError ? (
        <SizableText fontSize={12} color={MTD_TOKENS.orange}>
          {saveError}
        </SizableText>
      ) : null}

      <MtdActionButton
        width="100%"
        loading={isSaving}
        disabled={isSaving}
        onPress={() => void onDone()}
      >
        {isSaving ? 'Saving...' : 'Save'}
      </MtdActionButton>
    </YStack>
  )
}

export function TransactionEditTitlePanel(props: TransactionEditTitlePanelProps) {
  if (isWeb) {
    return (
      <YStack
        position="fixed"
        t={0}
        l={0}
        r={0}
        b={0}
        bg="rgba(0,0,0,0.6)"
        z={1100}
        items="center"
        justify="center"
        px="$4"
        onPress={props.onClose}
      >
        <YStack width="100%" maxW={560} onPress={(event) => event.stopPropagation()}>
          <TransactionEditTitlePanelContent {...props} />
        </YStack>
      </YStack>
    )
  }

  return (
    <Modal visible transparent animationType="fade" onRequestClose={props.onClose}>
      <Pressable style={styles.overlay} onPress={props.onClose}>
        <Pressable style={styles.sheet} onPress={(event) => event.stopPropagation()}>
          <TransactionEditTitlePanelContent {...props} />
        </Pressable>
      </Pressable>
    </Modal>
  )
}

export function usePersistTransactionRuleDrafts(bankAccountId?: string) {
  const { createRule, updateRule, deleteRule } = useCategorisationRules()

  return useCallback(
    async (drafts: TransactionRuleDraft[]) => {
      for (const draft of drafts) {
        if (draft.deleted) {
          if (draft.serverId) {
            await deleteRule(draft.serverId)
          }
          continue
        }

        if (!draft.matchValue.trim()) continue

        const payload = {
          matchValue: draft.matchValue.trim(),
          friendlyName: draft.friendlyName.trim() || null,
          hmrcCategory: draft.hmrcCategory,
          matchType: draft.matchType,
          privateUsePercent: draft.privateUsePercent ?? null,
        }

        if (draft.serverId) {
          await updateRule(draft.serverId, payload)
        } else {
          await createRule({
            ...payload,
            bankAccountIds: bankAccountId ? [bankAccountId] : undefined,
            upsert: true,
          })
        }
      }
    },
    [bankAccountId, createRule, deleteRule, updateRule],
  )
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  sheet: {
    width: '100%',
    maxWidth: 560,
  },
})
