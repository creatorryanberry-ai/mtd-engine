import { IS_WEB } from '@mtd/helpers'

import { API_BASE_URL } from '~/constants/urls'
import { authState } from '~/features/auth/client/authClient'
import { isNativeUploadFile } from '~/interface/upload/nativeUploadFile'
import { postHog } from '~/posthog/posthog'

export type ReceiptUploadSource =
  | 'scan_early'
  | 'save_background'
  | 'upload_files'
  | 'unknown'

function baseProps(source: ReceiptUploadSource, file?: File | Blob) {
  return {
    source,
    apiHost: API_BASE_URL,
    platform: IS_WEB ? 'web' : 'native',
    transport: !IS_WEB && file && isNativeUploadFile(file) ? 'expo_filesystem' : 'xhr',
    hasSessionToken: Boolean(authState.value?.session?.token),
  }
}

export function reportReceiptStabilizeFailed(
  error: unknown,
  source: ReceiptUploadSource,
) {
  const message = error instanceof Error ? error.message : String(error)
  console.info('[receipt-scan] stabilize image failed', error)
  void postHog.capture('receipt_stabilize_failed', {
    ...baseProps(source),
    message,
  })
  void postHog.captureException(error instanceof Error ? error : new Error(message), {
    feature: 'receipt_upload',
    stage: 'stabilize',
    source,
  })
}

export function reportReceiptUploadStarted(
  source: ReceiptUploadSource,
  file?: File | Blob,
) {
  void postHog.capture('receipt_upload_started', baseProps(source, file))
}

export function reportReceiptUploadSucceeded(
  source: ReceiptUploadSource,
  details: {
    hasAttachmentRef: boolean
    hasUrl: boolean
    durationMs: number
    file?: File | Blob
  },
) {
  void postHog.capture('receipt_upload_succeeded', {
    ...baseProps(source, details.file),
    hasAttachmentRef: details.hasAttachmentRef,
    hasUrl: details.hasUrl,
    durationMs: details.durationMs,
  })
}

export function reportReceiptUploadFailed(
  source: ReceiptUploadSource,
  error: unknown,
  details?: { durationMs?: number; file?: File | Blob },
) {
  const message = error instanceof Error ? error.message : String(error)
  console.info('[receipt-scan] upload failed', { source, message, error })
  void postHog.capture('receipt_upload_failed', {
    ...baseProps(source, details?.file),
    message,
    durationMs: details?.durationMs,
  })
  void postHog.captureException(error instanceof Error ? error : new Error(message), {
    feature: 'receipt_upload',
    stage: 'upload',
    source,
  })
}
