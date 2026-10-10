import { describe, expect, it } from 'vitest'

import { guessInboxDocumentKind } from '~/features/inbox/guessInboxDocumentKind'

const ALL = ['receipt', 'invoice', 'cis', 'landlord'] as const

describe('guessInboxDocumentKind', () => {
  it('guesses invoice from a tax invoice and filename', () => {
    const guess = guessInboxDocumentKind({
      fileName: 'Tim_Neale_Invoice_1479_August_2026.pdf',
      text: 'TAX INVOICE\nInvoice no 1479\nBill to Curator\nAmount due 1200.00',
      allowed: [...ALL],
    })
    expect(guess).toEqual({ kind: 'invoice', confidence: 'high' })
  })

  it('guesses invoice from filename alone', () => {
    const guess = guessInboxDocumentKind({
      fileName: 'Tim_Neale_Invoice_1479_August_2026.pdf',
      allowed: ['receipt', 'invoice'],
    })
    expect(guess).toEqual({ kind: 'invoice', confidence: 'high' })
  })

  it('guesses a shop receipt', () => {
    const guess = guessInboxDocumentKind({
      fileName: 'scan.jpg',
      text: 'TESCO STORES\nVAT receipt\nThank you\nCard payment 12.50',
      allowed: ['receipt', 'invoice'],
    })
    expect(guess.kind).toBe('receipt')
    expect(guess.confidence).toBe('high')
  })

  it('guesses a cis voucher when cis is allowed', () => {
    const guess = guessInboxDocumentKind({
      text: 'Construction Industry Scheme\nGross amount paid 2000.00\nCIS tax deducted 400.00',
      allowed: [...ALL],
    })
    expect(guess).toEqual({ kind: 'cis', confidence: 'high' })
  })

  it('does not guess cis when the user is not cis registered', () => {
    const guess = guessInboxDocumentKind({
      text: 'Construction Industry Scheme\nCIS tax deducted 400.00',
      allowed: ['receipt', 'invoice'],
    })
    expect(guess.kind).not.toBe('cis')
  })

  it('guesses a landlord statement', () => {
    const guess = guessInboxDocumentKind({
      text: 'Landlord statement\nPayment to landlord\nGross rent 1850.00\nHarris Shields Client Account',
      allowed: [...ALL],
    })
    expect(guess).toEqual({ kind: 'landlord', confidence: 'high' })
  })

  it('prefers landlord over incidental invoice wording', () => {
    const guess = guessInboxDocumentKind({
      fileName: 'Statement LS4650.pdf',
      text: [
        'STATEMENT: 26 May 2026',
        'Rent 23/05/2026 - 22/06/2026  £800.00',
        'Management Fee (9%) 23/05/2026 - 22/06/2026  £72.00',
        'Error with invoice and not including the VAT £22.00',
        'BALANCE  £706.00',
        'FLEX RESIDENTIAL LTD CLIENT ACCOUNT',
      ].join('\n'),
      allowed: [...ALL],
    })
    expect(guess).toEqual({ kind: 'landlord', confidence: 'high' })
  })

  it('boosts invoice when the title appears at the top', () => {
    const guess = guessInboxDocumentKind({
      text: [
        'TAX INVOICE',
        'Reference: May 2026',
        'Rent collected for period 01/05/2026 - 31/05/2026',
        'Management fee £75.00',
      ].join('\n'),
      allowed: [...ALL],
    })
    expect(guess).toEqual({ kind: 'invoice', confidence: 'high' })
  })

  it('treats a supplier invoice billed to the user as a receipt', () => {
    const guess = guessInboxDocumentKind({
      fileName: 'invoice.pdf',
      selfNames: ['Tim Neale', 'Tim Neale ltd'],
      text: [
        'Invoice',
        'Invoice number 86350697-0027',
        'Date of issue 10 August 2026',
        'Driversnote ApS',
        'Skelbækgade 4 3th',
        '1717 Copenhagen V',
        'Denmark',
        'Bill to',
        'Tim Neale ltd',
        '3 hartshaw, 35 Moorgate road',
        'Rotherham',
        '£10.80 due',
      ].join('\n'),
      allowed: ['receipt', 'invoice'],
    })
    expect(guess).toEqual({ kind: 'receipt', confidence: 'high' })
  })

  it('still guesses sales invoices when bill to is a customer', () => {
    const guess = guessInboxDocumentKind({
      fileName: 'Tim_Neale_Invoice_1479_August_2026.pdf',
      selfNames: ['Tim Neale', 'Tim Neale ltd'],
      text: [
        'TAX INVOICE',
        'Invoice no 1479',
        'Bill to',
        'Creator Scaffold Designs Ltd',
        'Amount due 3000.00',
      ].join('\n'),
      allowed: ['receipt', 'invoice'],
    })
    expect(guess).toEqual({ kind: 'invoice', confidence: 'high' })
  })

  it('stays low confidence when the document is ambiguous', () => {
    const guess = guessInboxDocumentKind({
      fileName: 'document.pdf',
      text: 'Total 40.00',
      allowed: ['receipt', 'invoice'],
    })
    expect(guess.confidence).toBe('low')
  })
})
