import { createStorage } from '@mtd/helpers'

import type { ReviewWizardStepId } from './reviewWizardSteps'

export type ReviewWizardChoiceAnswer = 'yes' | 'no'

export type ReviewWizardProgress = {
  answeredStepIds: ReviewWizardStepId[]
  stepAnswers: Partial<Record<ReviewWizardStepId, ReviewWizardChoiceAnswer>>
}

const EMPTY_PROGRESS: ReviewWizardProgress = {
  answeredStepIds: [],
  stepAnswers: {},
}

const storage = createStorage<string, ReviewWizardProgress>('review-wizard-progress')

function storageKey(userId: string, taxYearStart: string, quarterId: string) {
  return `${userId}:${taxYearStart}:${quarterId}`
}

function normalizeProgress(
  progress: ReviewWizardProgress | null | undefined,
): ReviewWizardProgress {
  if (!progress) return EMPTY_PROGRESS
  return {
    answeredStepIds: progress.answeredStepIds ?? [],
    stepAnswers: progress.stepAnswers ?? {},
  }
}

export function loadReviewWizardProgress(
  userId: string,
  taxYearStart: string,
  quarterId: string,
): ReviewWizardProgress {
  return normalizeProgress(storage.get(storageKey(userId, taxYearStart, quarterId)))
}

export function saveReviewWizardProgress(
  userId: string,
  taxYearStart: string,
  quarterId: string,
  progress: ReviewWizardProgress,
) {
  storage.set(storageKey(userId, taxYearStart, quarterId), normalizeProgress(progress))
}

export function markReviewWizardStepAnswered(
  userId: string,
  taxYearStart: string,
  quarterId: string,
  stepId: ReviewWizardStepId,
  answer?: ReviewWizardChoiceAnswer,
): ReviewWizardProgress {
  const current = loadReviewWizardProgress(userId, taxYearStart, quarterId)
  const alreadyAnswered = current.answeredStepIds.includes(stepId)
  const answerUnchanged = answer == null || current.stepAnswers[stepId] === answer
  if (alreadyAnswered && answerUnchanged) return current
  const next: ReviewWizardProgress = {
    answeredStepIds: alreadyAnswered
      ? current.answeredStepIds
      : [...current.answeredStepIds, stepId],
    stepAnswers:
      answer == null ? current.stepAnswers : { ...current.stepAnswers, [stepId]: answer },
  }
  saveReviewWizardProgress(userId, taxYearStart, quarterId, next)
  return next
}

export function markAllReviewWizardStepsAnswered(
  userId: string,
  taxYearStart: string,
  quarterId: string,
  stepIds: readonly ReviewWizardStepId[],
): ReviewWizardProgress {
  const current = loadReviewWizardProgress(userId, taxYearStart, quarterId)
  const answered = new Set(current.answeredStepIds)
  let changed = false
  for (const stepId of stepIds) {
    if (!answered.has(stepId)) {
      answered.add(stepId)
      changed = true
    }
  }
  if (!changed && current.answeredStepIds.length === stepIds.length) {
    return current
  }
  const next: ReviewWizardProgress = {
    answeredStepIds: stepIds.filter((stepId) => answered.has(stepId)),
    stepAnswers: current.stepAnswers,
  }
  saveReviewWizardProgress(userId, taxYearStart, quarterId, next)
  return next
}

export function clearReviewWizardProgressForUser(userId: string) {
  const prefix = `${userId}:`
  for (const key of storage.keys()) {
    if (key.startsWith(prefix)) {
      storage.remove(key)
    }
  }
}
