import { describe, expect, it } from 'vitest'

import {
  isReceiptRef,
  normalizeAttachmentForStorage,
  parseReceiptRef,
  toReceiptRef,
} from '~/features/upload/receiptRef'

describe('receiptRef', () => {
  it('round-trips receipt refs', () => {
    const key = 'receipts/user-1/abc-receipt.jpg'
    const ref = toReceiptRef(key)
    expect(isReceiptRef(ref)).toBe(true)
    expect(parseReceiptRef(ref)).toBe(key)
  })

  it('keeps existing receipt ref when client posts a signed url', () => {
    const existing = toReceiptRef('receipts/user-1/abc.jpg')
    expect(
      normalizeAttachmentForStorage('https://signed.example/abc.jpg?X=1', existing),
    ).toBe(existing)
  })

  it('stores new receipt refs as-is', () => {
    const ref = toReceiptRef('receipts/user-1/new.jpg')
    expect(normalizeAttachmentForStorage(ref, null)).toBe(ref)
  })
})
