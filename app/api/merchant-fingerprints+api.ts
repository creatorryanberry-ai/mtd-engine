import { jsonError, requireAuth } from '~/server/apiHelpers'
import {
  extractDocumentFingerprints,
  isMerchantFingerprintSignalType,
  pickBestFingerprintSignal,
  type DocumentFingerprintSignal,
} from '~/features/mtd/receipt/merchant/extractDocumentFingerprints'
import { isMerchantProcessKind } from '~/features/mtd/receipt/merchant/matchFingerprint'
import {
  clearWeakMerchantFingerprints,
  listMerchantFingerprints,
  upsertMerchantFingerprint,
} from '~/features/mtd/receipt/server/merchantFingerprintService'

import type { Endpoint } from 'one'

function normalizeOcrRaw(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export const GET: Endpoint = async (request) => {
  try {
    const authData = await requireAuth(request)
    // drop legacy customer phone/postcode fingerprints that matched every invoice
    await clearWeakMerchantFingerprints(authData.id)
    const fingerprints = await listMerchantFingerprints(authData.id)
    return Response.json({ fingerprints })
  } catch (error) {
    if (error instanceof Response) return error
    console.error('[merchant-fingerprint] list error', error)
    return jsonError(
      error instanceof Error ? error.message : 'Failed to load merchant fingerprints',
      500,
    )
  }
}

export const POST: Endpoint = async (request) => {
  try {
    const authData = await requireAuth(request)
    const body = (await request.json()) as {
      canonicalName?: string
      sourceSuggestedName?: string | null
      processKind?: string
      privateUsePercent?: number | null
      ocrText?: string
      signals?: Array<{ type?: string; value?: string }>
    }

    const canonicalName = body.canonicalName?.trim()
    if (!canonicalName) {
      return jsonError('canonicalName is required')
    }

    const processKind = body.processKind?.trim() ?? ''
    if (!isMerchantProcessKind(processKind)) {
      return jsonError('processKind must be receipt, invoice, cis, or landlord')
    }

    await clearWeakMerchantFingerprints(authData.id)

    const signals: DocumentFingerprintSignal[] = []

    for (const signal of body.signals ?? []) {
      const type = signal.type?.trim() ?? ''
      const value = signal.value?.trim() ?? ''
      if (!isMerchantFingerprintSignalType(type) || !value) continue
      if (type === 'phone' || type === 'postcode' || type === 'address_norm') continue
      signals.push({ type, value })
    }

    if (body.ocrText?.trim()) {
      signals.push(
        ...extractDocumentFingerprints(body.ocrText, {
          scope: 'supplier',
          strongOnly: true,
        }),
      )
    }

    // rematch key from the wrong suggestion when corrected
    const suggested = body.sourceSuggestedName?.trim()
    if (suggested && normalizeOcrRaw(suggested) !== normalizeOcrRaw(canonicalName)) {
      signals.push({ type: 'ocr_raw_norm', value: normalizeOcrRaw(suggested) })
    }

    // every save: also fingerprint the accepted name so the same OCR rematches processKind
    const savedNorm = normalizeOcrRaw(canonicalName)
    if (savedNorm) {
      signals.push({ type: 'ocr_raw_norm', value: savedNorm })
    }

    const best = pickBestFingerprintSignal(
      signals.map((signal) =>
        signal.type === 'ocr_raw_norm'
          ? { type: signal.type, value: normalizeOcrRaw(signal.value) }
          : signal,
      ),
    )

    if (!best) {
      return jsonError('No usable fingerprint signals from this save', 400)
    }

    const fingerprint = await upsertMerchantFingerprint(authData.id, {
      canonicalName,
      sourceSuggestedName: body.sourceSuggestedName,
      processKind,
      privateUsePercent: body.privateUsePercent,
      signal: best,
    })

    return Response.json({ fingerprints: fingerprint ? [fingerprint] : [] })
  } catch (error) {
    if (error instanceof Response) return error
    console.error('[merchant-fingerprint] upsert error', error)
    return jsonError(
      error instanceof Error ? error.message : 'Failed to save merchant fingerprints',
      500,
    )
  }
}
