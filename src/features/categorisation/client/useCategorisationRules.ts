import { useCallback, useEffect, useState } from 'react'

import { authFetch } from '~/features/auth/client/authFetch'
import { useAuth } from '~/features/auth/client/authClient'
import { notifyMtdTransactionsChanged } from '~/features/bankAccounts/client/mtdTransactionsEmitter'

import type { RuleMatchType } from '~/features/categorisation/categorisationMatching'

export type CategorisationRuleDto = {
  id: string
  matchField: string
  matchType: string
  matchValue: string
  friendlyName: string | null
  hmrcCategory: string
  hmrcCategoryLabel: string
  privateUsePercent: number | null
  bankAccountIds: string[]
  priority: number
  createdAt: string
}

export function useCategorisationRules() {
  const auth = useAuth()
  const userId = auth?.user?.id

  const [rules, setRules] = useState<CategorisationRuleDto[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async (): Promise<CategorisationRuleDto[]> => {
    if (!userId) {
      setIsLoading(false)
      return []
    }

    setError(null)

    try {
      const response = await authFetch<{ rules: CategorisationRuleDto[] }>(
        '/api/categorisation/rules',
      )

      if (response.error) {
        throw new Error(response.error.message || 'Failed to load categorisation rules')
      }

      setRules(response.data.rules)
      return response.data.rules
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load categorisation rules')
      return []
    } finally {
      setIsLoading(false)
    }
  }, [userId])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const createRule = useCallback(
    async (input: {
      matchValue: string
      hmrcCategory: string
      friendlyName?: string | null
      matchType?: RuleMatchType
      upsert?: boolean
      bankAccountIds?: string[]
      privateUsePercent?: number | null
    }) => {
      const response = await authFetch<{ rule: CategorisationRuleDto }>(
        '/api/categorisation/rules',
        {
          method: 'POST',
          body: input,
        },
      )

      if (response.error) {
        throw new Error(response.error.message || 'Failed to create rule')
      }

      notifyMtdTransactionsChanged()
      await refresh()
      return response.data.rule
    },
    [refresh],
  )

  const updateRule = useCallback(
    async (
      ruleId: string,
      input: {
        matchValue?: string
        hmrcCategory?: string
        friendlyName?: string | null
        matchType?: RuleMatchType
        priority?: number
        bankAccountIds?: string[]
        privateUsePercent?: number | null
      },
    ) => {
      const response = await authFetch<{ rule: CategorisationRuleDto }>(
        '/api/categorisation/rules',
        {
          method: 'PATCH',
          body: { id: ruleId, ...input },
        },
      )

      if (response.error) {
        throw new Error(response.error.message || 'Failed to update rule')
      }

      notifyMtdTransactionsChanged()
      await refresh()
      return response.data.rule
    },
    [refresh],
  )

  const deleteRule = useCallback(
    async (ruleId: string) => {
      const response = await authFetch<{ success: boolean }>(
        `/api/categorisation/rules?id=${encodeURIComponent(ruleId)}`,
        { method: 'DELETE' },
      )

      if (response.error) {
        throw new Error(response.error.message || 'Failed to delete rule')
      }

      notifyMtdTransactionsChanged()
      await refresh()
    },
    [refresh],
  )

  return {
    rules,
    isLoading,
    error,
    refresh,
    createRule,
    updateRule,
    deleteRule,
  }
}
