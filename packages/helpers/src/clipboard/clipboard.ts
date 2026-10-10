export const getClipboardText = async (): Promise<string | null> => {
  try {
    const text = await navigator.clipboard.readText()
    return text
  } catch {
    return null
  }
}

export const setClipboardText = async (text: string): Promise<boolean> => {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    return false
  }
}
