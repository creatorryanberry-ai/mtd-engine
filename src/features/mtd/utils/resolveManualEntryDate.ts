import { authFetch } from '~/features/auth/client/authFetch'
import { assessManualEntryDate } from '~/features/mtd/utils/assessManualEntryDate'
import {
  getQuarterForDate,
  isDateInQuarter,
  type QuarterInfo,
} from '~/features/mtd/utils/quarterPeriods'
import { dialogConfirm } from '~/interface/dialogs/actions'

import type { QuarterlySummary } from '~/features/submission/server/submissionService'

async function isQuarterSubmitted(quarter: QuarterInfo): Promise<boolean> {
  const params = new URLSearchParams({
    quarter: quarter.id,
    taxYearStart: quarter.taxYearStart,
  })
  const response = await authFetch<QuarterlySummary>(
    `/api/submissions/quarterly-summary?${params.toString()}`,
  )
  return Boolean(response.data?.existingSubmission)
}

export type ResolveManualEntryDateResult = { ok: true; date: string } | { ok: false }
export type ResolveManualEntryDatePresenter = {
  alert: (title: string, description: string) => Promise<void> | void
  confirm: (title: string, description: string, confirmText: string) => Promise<boolean>
}
export type ResolveManualEntryDateOptions = {
  /** when editing, allow unchanged out-of-quarter dates without prompting again */
  skipOutsideQuarterPromptIfUnchangedFrom?: string | null
}

/** warn / confirm when a manual entry date is outside the current quarter */
export async function resolveManualEntryDate(
  isoDate: string,
  currentQuarter: QuarterInfo,
  presenter?: ResolveManualEntryDatePresenter,
  options?: ResolveManualEntryDateOptions,
): Promise<ResolveManualEntryDateResult> {
  if (isDateInQuarter(isoDate, currentQuarter)) {
    return { ok: true, date: isoDate }
  }
  if (
    options?.skipOutsideQuarterPromptIfUnchangedFrom &&
    isoDate === options.skipOutsideQuarterPromptIfUnchangedFrom
  ) {
    return { ok: true, date: isoDate }
  }

  const quarter = getQuarterForDate(isoDate)
  let dateQuarterSubmitted = false
  let dateQuarterLookupFailed = false
  try {
    dateQuarterSubmitted = await isQuarterSubmitted(quarter)
  } catch (error) {
    dateQuarterLookupFailed = true
    console.info('[manual-entry-date] submission lookup failed', error)
  }

  if (dateQuarterLookupFailed) {
    const title = 'Could not verify period'
    const description =
      'We could not verify whether this period has already been submitted. Please try again, or use a date in the current period.'
    if (presenter) {
      await presenter.alert(title, description)
    } else {
      await dialogConfirm({
        title,
        description,
        confirmText: 'OK',
        cancelText: 'Cancel',
        icon: 'warning',
      })
    }
    return { ok: false }
  }

  const assessment = assessManualEntryDate(isoDate, {
    currentQuarter,
    dateQuarterSubmitted,
  })

  if (assessment.action === 'allow') {
    return { ok: true, date: isoDate }
  }

  if (assessment.action === 'block') {
    if (presenter) {
      await presenter.alert(assessment.title, assessment.description)
    } else {
      await dialogConfirm({
        title: assessment.title,
        description: assessment.description,
        confirmText: 'OK',
        cancelText: 'Cancel',
        icon: 'warning',
      })
    }
    return { ok: false }
  }

  const confirmed = presenter
    ? await presenter.confirm(assessment.title, assessment.description, 'Add anyway')
    : await dialogConfirm({
        title: assessment.title,
        description: assessment.description,
        confirmText: 'Add anyway',
        cancelText: 'Cancel',
        icon: 'warning',
      })

  if (!confirmed) {
    return { ok: false }
  }

  return { ok: true, date: isoDate }
}
