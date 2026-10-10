import { formatDisplayTaxYear } from '~/features/mtd/utils/quarterPeriods'
import type { TaxJurisdiction, TaxYearRules } from '../taxYearRules'
import {
  taxYear2025_26England,
  taxYear2025_26Scotland,
  taxYear2026_27England,
  taxYear2026_27Scotland,
} from './catalog'

export type TaxYearRulesProvider = {
  getRules(taxYearStart: string, jurisdiction: TaxJurisdiction): TaxYearRules
  isSupported(taxYearStart: string, jurisdiction: TaxJurisdiction): boolean
}

const RULES: Record<string, Partial<Record<TaxJurisdiction, TaxYearRules>>> = {
  '2025-04-06': {
    england: taxYear2025_26England,
    wales: { ...taxYear2025_26England, jurisdiction: 'wales' },
    northern_ireland: { ...taxYear2025_26England, jurisdiction: 'northern_ireland' },
    scotland: taxYear2025_26Scotland,
  },
  '2026-04-06': {
    england: taxYear2026_27England,
    wales: { ...taxYear2026_27England, jurisdiction: 'wales' },
    northern_ireland: { ...taxYear2026_27England, jurisdiction: 'northern_ireland' },
    scotland: taxYear2026_27Scotland,
  },
}

function cloneForYear(rules: TaxYearRules, taxYearStart: string): TaxYearRules {
  return {
    ...rules,
    taxYearStart,
    taxYearLabel: formatDisplayTaxYear(taxYearStart),
  }
}

export class StaticTaxYearRulesProvider implements TaxYearRulesProvider {
  getRules(taxYearStart: string, jurisdiction: TaxJurisdiction): TaxYearRules {
    const exact = RULES[taxYearStart]?.[jurisdiction]
    if (exact) return exact

    const years = Object.keys(RULES).sort()
    const closest = [...years].reverse().find((year) => year <= taxYearStart) ?? years[0]
    const fallback = closest ? RULES[closest]?.[jurisdiction] : undefined
    if (!fallback) {
      throw new Error(
        `No tax year rules for ${taxYearStart} (${jurisdiction}). Add a TaxYearRules catalog entry.`,
      )
    }
    return cloneForYear(fallback, taxYearStart)
  }

  isSupported(taxYearStart: string, jurisdiction: TaxJurisdiction): boolean {
    return Boolean(RULES[taxYearStart]?.[jurisdiction])
  }
}

export const defaultTaxYearRulesProvider = new StaticTaxYearRulesProvider()

export function getTaxYearRules(
  taxYearStart: string,
  jurisdiction: TaxJurisdiction = 'england',
): TaxYearRules {
  return defaultTaxYearRulesProvider.getRules(taxYearStart, jurisdiction)
}
