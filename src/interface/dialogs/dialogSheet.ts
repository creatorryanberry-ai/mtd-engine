import { IS_WEB } from '@mtd/helpers'
import { useEffect, useState } from 'react'

/** Extra space so sheet content clears the home indicator / tab bar. */
const SHEET_EXTRA_PADDING = 20
/** Lifts the sheet slightly above the screen bottom edge. */
const SHEET_BOTTOM_LIFT = 16

/** Snap height for touch bottom-sheet dialogs (confirms, discard prompts, etc.). */
export function getDialogSheetSnapPoint(minH: number, bottomInset = 0) {
  return Math.max(minH + bottomInset + SHEET_EXTRA_PADDING + SHEET_BOTTOM_LIFT, 240)
}

/** Padding below dialog actions inside the sheet frame. */
export function getDialogSheetFramePadding(_bottomInset = 0) {
  return 20
}

export function getDialogSheetBottomLift() {
  return SHEET_BOTTOM_LIFT
}

/**
 * Touch layouts use a bottom sheet. Desktop web keeps the centred modal.
 * All `dialogConfirm()` calls and inline `<Dialog>` confirms share this.
 */
export function getDialogAdaptWhen(): boolean | 'max-md' {
  return IS_WEB ? 'max-md' : true
}

export function usesDialogBottomSheet(media: { 'max-md'?: boolean }) {
  return getDialogAdaptWhen() === true || Boolean(media['max-md'])
}

/** Android often delivers the opening tap to the sheet overlay and dismisses it. */
const SHEET_OVERLAY_ARM_MS = 400

export function useSheetOverlayArmed(open: boolean) {
  const [armed, setArmed] = useState(false)

  useEffect(() => {
    if (!open) {
      setArmed(false)
      return
    }
    const t = setTimeout(() => setArmed(true), SHEET_OVERLAY_ARM_MS)
    return () => clearTimeout(t)
  }, [open])

  return armed
}
