import * as Clipboard from 'expo-clipboard'

export const getClipboardText = async (): Promise<string | null> => {
  try {
    const text = await Clipboard.getStringAsync()
    return text
  } catch {
    return null
  }
}

export const setClipboardText = async (text: string): Promise<boolean> => {
  try {
    await Clipboard.setStringAsync(text)
    return true
  } catch {
    return false
  }
}
