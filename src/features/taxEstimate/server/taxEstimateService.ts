import { and, eq } from 'drizzle-orm'

import { drizzle } from '~/database/db'
import { taxEstimateProfile } from '~/database/schema'
import { emptyTaxEstimateAnswers } from '~/features/taxEstimate/answers'
import {
  estimateTax,
  toTaxEstimatePoundsResult,
} from '~/features/taxEstimate/taxEstimator'
import type { TaxJurisdiction } from '~/features/taxEstimate/taxYearRules'
import type { TaxEstimateAnswers } from '~/features/taxEstimate/types'
import { getTaxableBusinessProfit } from './businessProfitProvider'

const JURISDICTIONS: TaxJurisdiction[] = [
  'england',
  'wales',
  'northern_ireland',
  'scotland',
]

function isJurisdiction(value: string): value is TaxJurisdiction {
  return JURISDICTIONS.includes(value as TaxJurisdiction)
}

function parseAnswers(json: string): TaxEstimateAnswers {
  try {
    const parsed = JSON.parse(json) as Partial<TaxEstimateAnswers>
    return {
      ...emptyTaxEstimateAnswers(),
      ...parsed,
      employment: {
        ...emptyTaxEstimateAnswers().employment,
        ...parsed.employment,
        jobs: parsed.employment?.jobs?.length
          ? parsed.employment.jobs
          : emptyTaxEstimateAnswers().employment.jobs,
      },
      savings: { ...emptyTaxEstimateAnswers().savings, ...parsed.savings },
      investments: { ...emptyTaxEstimateAnswers().investments, ...parsed.investments },
      property: { ...emptyTaxEstimateAnswers().property, ...parsed.property },
      pensions: { ...emptyTaxEstimateAnswers().pensions, ...parsed.pensions },
      family: { ...emptyTaxEstimateAnswers().family, ...parsed.family },
      studentLoan: { ...emptyTaxEstimateAnswers().studentLoan, ...parsed.studentLoan },
      reliefs: { ...emptyTaxEstimateAnswers().reliefs, ...parsed.reliefs },
      capitalGains: { ...emptyTaxEstimateAnswers().capitalGains, ...parsed.capitalGains },
      foreignIncome: {
        ...emptyTaxEstimateAnswers().foreignIncome,
        ...parsed.foreignIncome,
      },
      otherIncome: { ...emptyTaxEstimateAnswers().otherIncome, ...parsed.otherIncome },
    }
  } catch {
    return emptyTaxEstimateAnswers()
  }
}

function mergeAnswers(
  current: TaxEstimateAnswers,
  patch: Partial<TaxEstimateAnswers>,
): TaxEstimateAnswers {
  return {
    ...current,
    ...patch,
    employment: patch.employment
      ? { ...current.employment, ...patch.employment }
      : current.employment,
    savings: patch.savings ? { ...current.savings, ...patch.savings } : current.savings,
    investments: patch.investments
      ? { ...current.investments, ...patch.investments }
      : current.investments,
    property: patch.property
      ? { ...current.property, ...patch.property }
      : current.property,
    pensions: patch.pensions
      ? { ...current.pensions, ...patch.pensions }
      : current.pensions,
    family: patch.family ? { ...current.family, ...patch.family } : current.family,
    studentLoan: patch.studentLoan
      ? { ...current.studentLoan, ...patch.studentLoan }
      : current.studentLoan,
    reliefs: patch.reliefs ? { ...current.reliefs, ...patch.reliefs } : current.reliefs,
    capitalGains: patch.capitalGains
      ? { ...current.capitalGains, ...patch.capitalGains }
      : current.capitalGains,
    foreignIncome: patch.foreignIncome
      ? { ...current.foreignIncome, ...patch.foreignIncome }
      : current.foreignIncome,
    otherIncome: patch.otherIncome
      ? { ...current.otherIncome, ...patch.otherIncome }
      : current.otherIncome,
  }
}

async function loadOrCreateProfile(userId: string, taxYearStart: string) {
  const whereProfile = and(
    eq(taxEstimateProfile.userId, userId),
    eq(taxEstimateProfile.taxYearStart, taxYearStart),
  )

  const [existing] = await drizzle
    .select()
    .from(taxEstimateProfile)
    .where(whereProfile)
    .limit(1)

  if (existing) return existing

  const now = new Date().toISOString()
  await drizzle
    .insert(taxEstimateProfile)
    .values({
      id: crypto.randomUUID(),
      userId,
      taxYearStart,
      answersJson: JSON.stringify(emptyTaxEstimateAnswers()),
      useProjection: true,
      jurisdiction: 'england',
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoNothing({
      target: [taxEstimateProfile.userId, taxEstimateProfile.taxYearStart],
    })

  const [row] = await drizzle
    .select()
    .from(taxEstimateProfile)
    .where(whereProfile)
    .limit(1)

  if (!row) {
    throw new Error('Failed to load tax estimate profile')
  }

  return row
}

export async function getTaxEstimate(userId: string, taxYearStart: string) {
  const profile = await loadOrCreateProfile(userId, taxYearStart)
  const answers = parseAnswers(profile.answersJson)
  const jurisdiction = isJurisdiction(profile.jurisdiction)
    ? profile.jurisdiction
    : 'england'
  const business = await getTaxableBusinessProfit(
    userId,
    taxYearStart,
    profile.useProjection,
  )
  const calculation = toTaxEstimatePoundsResult(
    estimateTax({
      taxYearStart,
      jurisdiction,
      answers,
      business,
      useProjection: profile.useProjection,
    }),
  )

  return {
    taxYearStart,
    jurisdiction,
    useProjection: profile.useProjection,
    answers,
    business,
    calculation,
    updatedAt: profile.updatedAt,
  }
}

export async function updateTaxEstimate(
  userId: string,
  input: {
    taxYearStart: string
    jurisdiction?: string
    useProjection?: boolean
    answers?: Partial<TaxEstimateAnswers>
  },
) {
  const profile = await loadOrCreateProfile(userId, input.taxYearStart)
  const currentAnswers = parseAnswers(profile.answersJson)
  const nextAnswers = input.answers
    ? mergeAnswers(currentAnswers, input.answers)
    : currentAnswers
  const nextJurisdiction =
    input.jurisdiction && isJurisdiction(input.jurisdiction)
      ? input.jurisdiction
      : isJurisdiction(profile.jurisdiction)
        ? profile.jurisdiction
        : 'england'
  const nextProjection = input.useProjection ?? profile.useProjection
  const now = new Date().toISOString()

  await drizzle
    .update(taxEstimateProfile)
    .set({
      answersJson: JSON.stringify(nextAnswers),
      jurisdiction: nextJurisdiction,
      useProjection: nextProjection,
      updatedAt: now,
    })
    .where(
      and(eq(taxEstimateProfile.id, profile.id), eq(taxEstimateProfile.userId, userId)),
    )

  return getTaxEstimate(userId, input.taxYearStart)
}
