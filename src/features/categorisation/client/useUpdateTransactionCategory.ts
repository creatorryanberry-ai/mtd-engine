import { useCallback } from 'react'

import { authFetch } from '~/features/auth/client/authFetch'
import { notifyMtdTransactionsChanged } from '~/features/bankAccounts/client/mtdTransactionsEmitter'

import type { MtdTransactionDto } from '~/features/bankAccounts/types'

type MutationOptions = {
  notify?: boolean
}

/** Categorise screen reads via REST — always persist through REST for consistency. */
export function useUpdateTransactionCategory() {
  const updateCategory = useCallback(
    async (
      transactionId: string,
      hmrcCategory: string,
      options: MutationOptions = { notify: true },
    ) => {
      const response = await authFetch<{ transaction: MtdTransactionDto }>(
        '/api/transactions',
        {
          method: 'PATCH',
          body: { id: transactionId, hmrcCategory },
        },
      )

      if (response.error) {
        throw new Error(response.error.message || 'Failed to update category')
      }

      if (options.notify !== false) {
        notifyMtdTransactionsChanged()
      }

      return response.data.transaction
    },
    [],
  )

  const approveTransaction = useCallback(
    async (transactionId: string, options: MutationOptions = { notify: true }) => {
      const response = await authFetch<{ transaction: MtdTransactionDto }>(
        '/api/transactions/approve',
        {
          method: 'POST',
          body: { id: transactionId },
        },
      )

      if (response.error) {
        throw new Error(response.error.message || 'Failed to approve transaction')
      }

      if (options.notify !== false) {
        notifyMtdTransactionsChanged()
      }

      return response.data.transaction
    },
    [],
  )

  const approveTransactions = useCallback(
    async (transactionIds: string[], options: MutationOptions = { notify: true }) => {
      const response = await authFetch<{ transactions: MtdTransactionDto[] }>(
        '/api/transactions/approve',
        {
          method: 'POST',
          body: { ids: transactionIds },
        },
      )

      if (response.error) {
        throw new Error(response.error.message || 'Failed to approve transactions')
      }

      if (options.notify !== false) {
        notifyMtdTransactionsChanged()
      }

      return response.data.transactions
    },
    [],
  )

  return {
    updateCategory,
    approveTransaction,
    approveTransactions,
  }
}
