import { createStorage } from '@mtd/helpers'

import type { YearEndReviewStepId } from './yearEndReviewSteps'

export type YearEndReviewProgress = {
  answeredStepIds: YearEndReviewStepId[]
  completed: boolean
}

const EMPTY_PROGRESS: YearEndReviewProgress = {
  answeredStepIds: [],
  completed: false,
}

const storage = createStorage<string, YearEndReviewProgress>(
  'year-end-review-progress-v2',
)

function storageKey(userId: string, taxYearStart: string) {
  return `${userId}:${taxYearStart}:YE`
}

export function loadYearEndReviewProgress(
  userId: string,
  taxYearStart: string,
): YearEndReviewProgress {
  return storage.get(storageKey(userId, taxYearStart)) ?? EMPTY_PROGRESS
}

export function saveYearEndReviewProgress(
  userId: string,
  taxYearStart: string,
  progress: YearEndReviewProgress,
) {
  storage.set(storageKey(userId, taxYearStart), progress)
}

export function markYearEndReviewStepAnswered(
  userId: string,
  taxYearStart: string,
  stepId: YearEndReviewStepId,
): YearEndReviewProgress {
  const current = loadYearEndReviewProgress(userId, taxYearStart)
  if (current.answeredStepIds.includes(stepId)) return current
  const next = {
    ...current,
    answeredStepIds: [...current.answeredStepIds, stepId],
  }
  saveYearEndReviewProgress(userId, taxYearStart, next)
  return next
}

export function markYearEndReviewCompleted(
  userId: string,
  taxYearStart: string,
): YearEndReviewProgress {
  const current = loadYearEndReviewProgress(userId, taxYearStart)
  const next = {
    ...current,
    completed: true,
  }
  saveYearEndReviewProgress(userId, taxYearStart, next)
  return next
}

export function isYearEndReviewCompleted(userId: string, taxYearStart: string): boolean {
  return loadYearEndReviewProgress(userId, taxYearStart).completed
}

export function clearYearEndReviewProgressForUser(userId: string) {
  const prefix = `${userId}:`
  for (const key of storage.keys()) {
    if (key.startsWith(prefix)) {
      storage.remove(key)
    }
  }
}
