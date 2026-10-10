let scrollOffsetY = 0

export function getEstimatedTaxScrollOffsetY(): number {
  return scrollOffsetY
}

export function setEstimatedTaxScrollOffsetY(y: number): void {
  scrollOffsetY = Math.max(0, y)
}
