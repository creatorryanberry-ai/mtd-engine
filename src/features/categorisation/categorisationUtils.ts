export function needsReview(
  confidence: string,
  reviewedAt: string | number | null | undefined,
) {
  return confidence === 'low' && reviewedAt == null
}
