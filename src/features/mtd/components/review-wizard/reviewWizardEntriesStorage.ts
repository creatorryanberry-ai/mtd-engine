import { createStorage } from '@mtd/helpers'

import type {
  ReviewCisVoucherSummary,
  ReviewManualEntrySummary,
} from '~/features/submission/reviewFinancialEstimates'

export type ReviewWizardMileageEntry = {
  id: string
  label: string
  miles: number
  claimPounds: number
}

export type ReviewWizardStoredEntries = {
  income: ReviewManualEntrySummary[]
  expenses: ReviewManualEntrySummary[]
  cis: ReviewCisVoucherSummary[]
  mileage: ReviewWizardMileageEntry[]
}

const EMPTY_ENTRIES: ReviewWizardStoredEntries = {
  income: [],
  expenses: [],
  cis: [],
  mileage: [],
}

const storage = createStorage<string, ReviewWizardStoredEntries>('review-wizard-entries')

function storageKey(userId: string, taxYearStart: string, quarterId: string) {
  return `${userId}:${taxYearStart}:${quarterId}`
}

function legacyStorageKey(userId: string, taxYearStart: string) {
  return `${userId}:${taxYearStart}`
}

function readEntries(userId: string, taxYearStart: string, quarterId: string) {
  return (
    storage.get(storageKey(userId, taxYearStart, quarterId)) ??
    storage.get(legacyStorageKey(userId, taxYearStart)) ??
    EMPTY_ENTRIES
  )
}

function appendUniqueById<T extends { id: string }>(items: T[], next: T) {
  if (items.some((item) => item.id === next.id)) {
    return items.map((item) => (item.id === next.id ? next : item))
  }
  return [...items, next]
}

export function loadReviewWizardEntries(
  userId: string,
  taxYearStart: string,
  quarterId: string,
): ReviewWizardStoredEntries {
  return readEntries(userId, taxYearStart, quarterId)
}

/** Income/expense/CIS ids added via the review wizard — hide these from account lists. */
export function getReviewWizardManualEntryIds(
  userId: string,
  taxYearStart: string,
  quarterId: string,
): Set<string> {
  const entries = loadReviewWizardEntries(userId, taxYearStart, quarterId)
  return new Set([
    ...entries.income.map((entry) => entry.id),
    ...entries.expenses.map((entry) => entry.id),
    ...entries.cis.map((entry) => entry.id),
  ])
}

export function saveReviewWizardEntries(
  userId: string,
  taxYearStart: string,
  quarterId: string,
  entries: ReviewWizardStoredEntries,
) {
  storage.set(storageKey(userId, taxYearStart, quarterId), entries)
}

export function addReviewWizardIncome(
  userId: string,
  taxYearStart: string,
  quarterId: string,
  entry: ReviewManualEntrySummary,
) {
  const current = loadReviewWizardEntries(userId, taxYearStart, quarterId)
  const next = {
    ...current,
    income: appendUniqueById(current.income, entry),
  }
  saveReviewWizardEntries(userId, taxYearStart, quarterId, next)
  return next
}

export function addReviewWizardExpense(
  userId: string,
  taxYearStart: string,
  quarterId: string,
  entry: ReviewManualEntrySummary,
) {
  const current = loadReviewWizardEntries(userId, taxYearStart, quarterId)
  const next = {
    ...current,
    expenses: appendUniqueById(current.expenses, entry),
  }
  saveReviewWizardEntries(userId, taxYearStart, quarterId, next)
  return next
}

export function addReviewWizardCis(
  userId: string,
  taxYearStart: string,
  quarterId: string,
  entry: ReviewCisVoucherSummary,
) {
  const current = loadReviewWizardEntries(userId, taxYearStart, quarterId)
  const next = {
    ...current,
    cis: appendUniqueById(current.cis, entry),
  }
  saveReviewWizardEntries(userId, taxYearStart, quarterId, next)
  return next
}

export function addReviewWizardMileage(
  userId: string,
  taxYearStart: string,
  quarterId: string,
  entry: ReviewWizardMileageEntry,
) {
  const current = loadReviewWizardEntries(userId, taxYearStart, quarterId)
  const next = {
    ...current,
    mileage: appendUniqueById(current.mileage, entry),
  }
  saveReviewWizardEntries(userId, taxYearStart, quarterId, next)
  return next
}

export function removeReviewWizardIncome(
  userId: string,
  taxYearStart: string,
  quarterId: string,
  entryId: string,
) {
  const current = loadReviewWizardEntries(userId, taxYearStart, quarterId)
  const next = {
    ...current,
    income: current.income.filter((entry) => entry.id !== entryId),
  }
  saveReviewWizardEntries(userId, taxYearStart, quarterId, next)
  return next
}

export function removeReviewWizardExpense(
  userId: string,
  taxYearStart: string,
  quarterId: string,
  entryId: string,
) {
  const current = loadReviewWizardEntries(userId, taxYearStart, quarterId)
  const next = {
    ...current,
    expenses: current.expenses.filter((entry) => entry.id !== entryId),
  }
  saveReviewWizardEntries(userId, taxYearStart, quarterId, next)
  return next
}

export function removeReviewWizardMileage(
  userId: string,
  taxYearStart: string,
  quarterId: string,
  entryId: string,
) {
  const current = loadReviewWizardEntries(userId, taxYearStart, quarterId)
  const next = {
    ...current,
    mileage: current.mileage.filter((entry) => entry.id !== entryId),
  }
  saveReviewWizardEntries(userId, taxYearStart, quarterId, next)
  return next
}

export function getReviewWizardMileageIds(
  userId: string,
  taxYearStart: string,
  quarterId: string,
): Set<string> {
  const entries = loadReviewWizardEntries(userId, taxYearStart, quarterId)
  return new Set(entries.mileage.map((entry) => entry.id))
}

export function clearReviewWizardEntriesForUser(userId: string) {
  const prefix = `${userId}:`
  for (const key of storage.keys()) {
    if (key.startsWith(prefix)) {
      storage.remove(key)
    }
  }
}
