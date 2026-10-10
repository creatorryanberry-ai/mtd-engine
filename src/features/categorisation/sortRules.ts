export function getRuleSortLabel(rule: {
  friendlyName: string | null
  matchValue: string
}) {
  return (rule.friendlyName?.trim() || rule.matchValue).toLowerCase()
}

export function sortRulesAlphabetically<
  T extends { friendlyName: string | null; matchValue: string },
>(rules: T[]) {
  return [...rules].sort((left, right) =>
    getRuleSortLabel(left).localeCompare(getRuleSortLabel(right), 'en-GB', {
      sensitivity: 'base',
    }),
  )
}
