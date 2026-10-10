export const MILEAGE_LIST_PAGE_SIZE = 40
export const MILEAGE_LIST_MAX_PAGE_SIZE = 100

export function parseMileageListPage(search: URLSearchParams) {
  const rawLimit = search.get('limit')
  if (rawLimit == null || rawLimit === '') return null

  const parsedLimit = Number.parseInt(rawLimit, 10)
  const parsedOffset = Number.parseInt(search.get('offset') ?? '0', 10)
  const limit = Math.min(
    MILEAGE_LIST_MAX_PAGE_SIZE,
    Math.max(1, Number.isFinite(parsedLimit) ? parsedLimit : MILEAGE_LIST_PAGE_SIZE),
  )
  const offset = Math.max(0, Number.isFinite(parsedOffset) ? parsedOffset : 0)

  return { limit, offset }
}

export function pageMileageEntries<T extends { claim: { claimPounds: number } }>(
  dtos: T[],
  offset: number,
  limit: number,
) {
  const entries = dtos.slice(offset, offset + limit)
  return {
    entries,
    totalCount: dtos.length,
    totalClaimPounds: dtos.reduce((sum, entry) => sum + entry.claim.claimPounds, 0),
    hasMore: offset + entries.length < dtos.length,
  }
}
