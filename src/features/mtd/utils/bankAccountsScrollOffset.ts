let scrollOffsetY = 0

export function getBankAccountsScrollOffsetY(): number {
  return scrollOffsetY
}

export function setBankAccountsScrollOffsetY(y: number): void {
  scrollOffsetY = Math.max(0, y)
}
