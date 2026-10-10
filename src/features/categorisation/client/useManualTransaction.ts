import { useCallback } from 'react'

import { authFetch } from '~/features/auth/client/authFetch'
import { notifyMtdTransactionsChanged } from '~/features/bankAccounts/client/mtdTransactionsEmitter'

import type { MtdTransactionDto } from '~/features/bankAccounts/types'

type ManualTransactionPayload = {
  bankAccountId: string
  name: string
  details?: string | null
  date: string
  amount: number
  attachmentUrl?: string | null
  hmrcCategory?: string
}

type ManualTransactionUpdatePayload = Omit<ManualTransactionPayload, 'bankAccountId'> & {
  id: string
}

type ManualMutationOptions = {
  /** default true — set false when caller will notify after related rule saves */
  notify?: boolean
}

export function useManualTransaction() {
  const createManualTransaction = useCallback(
    async (payload: ManualTransactionPayload, options?: ManualMutationOptions) => {
      const response = await authFetch<{ transaction: MtdTransactionDto }>(
        '/api/transactions/manual',
        {
          method: 'POST',
          body: payload,
        },
      )

      if (response.error) {
        throw new Error(response.error.message || 'Failed to create manual transaction')
      }

      if (options?.notify !== false) {
        notifyMtdTransactionsChanged()
      }
      return response.data!.transaction
    },
    [],
  )

  const updateManualTransaction = useCallback(
    async (payload: ManualTransactionUpdatePayload, options?: ManualMutationOptions) => {
      const response = await authFetch<{ transaction: MtdTransactionDto }>(
        '/api/transactions/manual',
        {
          method: 'PATCH',
          body: payload,
        },
      )

      if (response.error) {
        throw new Error(response.error.message || 'Failed to update manual transaction')
      }

      if (options?.notify !== false) {
        notifyMtdTransactionsChanged()
      }
      return response.data!.transaction
    },
    [],
  )

  const deleteManualTransaction = useCallback(async (id: string) => {
    const response = await authFetch<{ deleted: boolean }>('/api/transactions/manual', {
      method: 'DELETE',
      body: { id },
    })

    if (response.error) {
      throw new Error(response.error.message || 'Failed to delete manual transaction')
    }

    notifyMtdTransactionsChanged()
  }, [])

  return {
    createManualTransaction,
    updateManualTransaction,
    deleteManualTransaction,
  }
}
