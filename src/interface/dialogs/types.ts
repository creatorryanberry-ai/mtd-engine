import type { TabsContentProps } from 'tamagui'

export type DialogClosedType = {
  type: 'closed'
}

export type DialogConfirmType = {
  type: 'confirm'
  title: string
  description: string
  extraConfirm?: boolean
  confirmText?: string
  cancelText?: string
  /** shows a bright-red exclamation on a dark-red circle above the title */
  icon?: 'warning'
}

export type DialogCreatePostType = {
  type: 'create-post'
}

export type DialogErrorType = {
  type: 'error'
  title: string
  description: string
  dismissText?: string
}

export type DialogType =
  | DialogConfirmType
  | DialogClosedType
  | DialogCreatePostType
  | DialogErrorType

export type DialogLayer2 = DialogConfirmType | DialogClosedType | DialogErrorType

export type DialogProps = TabsContentProps
