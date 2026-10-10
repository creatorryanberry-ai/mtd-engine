import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { createStorage } from '@mtd/helpers'

import { useAuth } from '~/features/auth/client/authClient'
import {
  getTaxYearStart,
  listAvailableTaxYears,
  parseQuarterId,
  type QuarterId,
  type TaxYear,
} from '~/features/mtd/utils/quarterPeriods'
import { getActiveQuarter } from '~/features/mtd/utils/quarterStatus'

type TaxYearContextValue = {
  taxYearStart: string
  taxYear: TaxYear
  availableTaxYears: TaxYear[]
  activeQuarterId: QuarterId
  selectedQuarterId: QuarterId | null
  setTaxYearStart: (taxYearStart: string) => void
  setSelectedQuarterId: (quarterId: QuarterId | null) => void
}

const TaxYearContext = createContext<TaxYearContextValue | null>(null)

const taxYearStorage = createStorage<string, string>('mtd-selected-tax-year')
const quarterStorage = createStorage<string, QuarterId>('mtd-selected-quarter')

function storageKey(userId: string) {
  return userId
}

export function TaxYearProvider({ children }: { children: ReactNode }) {
  const auth = useAuth()
  const userId = auth?.user?.id
  const defaultTaxYearStart = getTaxYearStart()

  const [taxYearStart, setTaxYearStartState] = useState(() => {
    if (!userId) return defaultTaxYearStart
    return taxYearStorage.get(storageKey(userId)) ?? defaultTaxYearStart
  })

  const [selectedQuarterId, setSelectedQuarterIdState] = useState<QuarterId | null>(
    () => {
      if (!userId) return null
      return parseQuarterId(quarterStorage.get(storageKey(userId)))
    },
  )

  const setTaxYearStart = useCallback(
    (nextTaxYearStart: string) => {
      setTaxYearStartState(nextTaxYearStart)
      setSelectedQuarterIdState(null)
      if (userId) {
        taxYearStorage.set(storageKey(userId), nextTaxYearStart)
        quarterStorage.remove(storageKey(userId))
      }
    },
    [userId],
  )

  const setSelectedQuarterId = useCallback(
    (quarterId: QuarterId | null) => {
      if (quarterId == null) {
        setSelectedQuarterIdState(null)
        if (userId) {
          quarterStorage.remove(storageKey(userId))
        }
        return
      }
      const parsed = parseQuarterId(quarterId)
      setSelectedQuarterIdState(parsed)
      if (userId && parsed) {
        // sync write so the next screen can read it before react re-renders
        quarterStorage.set(storageKey(userId), parsed)
      }
    },
    [userId],
  )

  const availableTaxYears = useMemo(() => listAvailableTaxYears(), [])

  const taxYear = useMemo(
    () =>
      availableTaxYears.find((year) => year.start === taxYearStart) ?? {
        start: taxYearStart,
        end: `${Number.parseInt(taxYearStart.slice(0, 4), 10) + 1}-04-05`,
        label: `${taxYearStart.slice(0, 4)}/${String(Number.parseInt(taxYearStart.slice(0, 4), 10) + 1).slice(2)}`,
      },
    [availableTaxYears, taxYearStart],
  )

  const activeQuarterId = useMemo(
    () => getActiveQuarter({ taxYearStart }).id,
    [taxYearStart],
  )

  const value = useMemo(
    () => ({
      taxYearStart,
      taxYear,
      availableTaxYears,
      activeQuarterId,
      selectedQuarterId,
      setTaxYearStart,
      setSelectedQuarterId,
    }),
    [
      activeQuarterId,
      availableTaxYears,
      selectedQuarterId,
      setSelectedQuarterId,
      setTaxYearStart,
      taxYear,
      taxYearStart,
    ],
  )

  return <TaxYearContext.Provider value={value}>{children}</TaxYearContext.Provider>
}

export function useTaxYearContext() {
  const context = useContext(TaxYearContext)
  if (!context) {
    throw new Error('useTaxYearContext must be used within TaxYearProvider')
  }
  return context
}

export function useSelectedTaxYear() {
  return useTaxYearContext()
}

export function readStoredSelectedQuarterId(userId: string | undefined | null) {
  if (!userId) return null
  return parseQuarterId(quarterStorage.get(storageKey(userId)))
}

export function useSubmissionPeriod(quarterIdOverride?: QuarterId | null) {
  const auth = useAuth()
  const { taxYearStart, activeQuarterId, selectedQuarterId } = useTaxYearContext()
  const storedQuarterId = readStoredSelectedQuarterId(auth?.user?.id)
  const quarterId =
    quarterIdOverride ?? selectedQuarterId ?? storedQuarterId ?? activeQuarterId

  return { taxYearStart, quarterId }
}
