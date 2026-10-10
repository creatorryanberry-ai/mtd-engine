import { useCallback, useEffect, useState } from 'react'

import { authFetch } from '~/features/auth/client/authFetch'
import { useAuth } from '~/features/auth/client/authClient'
import type {
  MerchantFingerprintSignalType,
  UserMerchantFingerprint,
} from '~/features/mtd/receipt/merchant/extractDocumentFingerprints'
import type { MerchantProcessKind } from '~/features/mtd/receipt/merchant/matchFingerprint'

export type MerchantFingerprintDto = {
  id: string
  signalType: MerchantFingerprintSignalType
  signalValue: string
  canonicalName: string
  sourceSuggestedName: string | null
  processKind: MerchantProcessKind | null
  privateUsePercent: number | null
  hitCount: number
  updatedAt: string
}

type Listener = (fingerprints: MerchantFingerprintDto[]) => void

let cachedFingerprints: MerchantFingerprintDto[] = []
let refreshGeneration = 0
const listeners = new Set<Listener>()

function setCachedFingerprints(next: MerchantFingerprintDto[]) {
  cachedFingerprints = next
  for (const listener of listeners) listener(next)
}

function mergeFingerprints(
  previous: MerchantFingerprintDto[],
  updates: MerchantFingerprintDto[],
) {
  const byKey = new Map(
    previous.map((item) => [`${item.signalType}:${item.signalValue}`, item]),
  )
  for (const item of updates) {
    byKey.set(`${item.signalType}:${item.signalValue}`, item)
  }
  return [...byKey.values()]
}

export function getCachedMerchantFingerprints(): UserMerchantFingerprint[] {
  return cachedFingerprints.map((item) => ({
    signalType: item.signalType,
    signalValue: item.signalValue,
    canonicalName: item.canonicalName,
    processKind: item.processKind,
    privateUsePercent: item.privateUsePercent,
  }))
}

export function useMerchantFingerprints() {
  const auth = useAuth()
  const userId = auth?.user?.id

  const [fingerprints, setFingerprints] =
    useState<MerchantFingerprintDto[]>(cachedFingerprints)
  const [isLoading, setIsLoading] = useState(cachedFingerprints.length === 0)

  useEffect(() => {
    const listener: Listener = (next) => setFingerprints(next)
    listeners.add(listener)
    return () => {
      listeners.delete(listener)
    }
  }, [])

  const refresh = useCallback(async (): Promise<MerchantFingerprintDto[]> => {
    if (!userId) {
      setIsLoading(false)
      return cachedFingerprints
    }

    const generation = ++refreshGeneration

    try {
      const response = await authFetch<{ fingerprints: MerchantFingerprintDto[] }>(
        '/api/merchant-fingerprints',
      )
      if (response.error) {
        throw new Error(response.error.message || 'Failed to load merchant fingerprints')
      }
      // ignore stale responses so an older GET cannot wipe a newer learn
      if (generation !== refreshGeneration) {
        return cachedFingerprints
      }
      setCachedFingerprints(response.data.fingerprints)
      return response.data.fingerprints
    } catch (error) {
      console.info('[merchant-fingerprint] load failed', error)
      return cachedFingerprints
    } finally {
      if (generation === refreshGeneration) {
        setIsLoading(false)
      }
    }
  }, [userId])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const learnFromSave = useCallback(
    async (input: {
      canonicalName: string
      processKind: MerchantProcessKind
      sourceSuggestedName?: string | null
      privateUsePercent?: number | null
      ocrText: string
    }) => {
      // invalidate in-flight GETs so they cannot overwrite this learn
      refreshGeneration += 1
      const response = await authFetch<{ fingerprints: MerchantFingerprintDto[] }>(
        '/api/merchant-fingerprints',
        {
          method: 'POST',
          body: {
            canonicalName: input.canonicalName,
            processKind: input.processKind,
            sourceSuggestedName: input.sourceSuggestedName,
            privateUsePercent: input.privateUsePercent ?? null,
            ocrText: input.ocrText,
          },
        },
      )
      if (response.error) {
        console.info('[merchant-fingerprint] learn failed', response.error)
        return []
      }
      if (response.data.fingerprints.length === 0) {
        console.info('[merchant-fingerprint] learn returned no signals')
        return []
      }
      setCachedFingerprints(
        mergeFingerprints(cachedFingerprints, response.data.fingerprints),
      )
      console.info('[merchant-fingerprint] cache size', cachedFingerprints.length)
      return response.data.fingerprints
    },
    [],
  )

  const asResolverInput = useCallback((): UserMerchantFingerprint[] => {
    return getCachedMerchantFingerprints()
  }, [fingerprints])

  return {
    fingerprints,
    isLoading,
    refresh,
    learnFromSave,
    /** @deprecated use learnFromSave */
    learnFromCorrection: learnFromSave,
    asResolverInput,
  }
}
