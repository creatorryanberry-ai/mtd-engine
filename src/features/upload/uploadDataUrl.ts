import { randomId } from '@mtd/helpers'

import { uploadObject } from './storage'

const folder = 'avatars'

export async function uploadDataUrl(dataUrl: string): Promise<string> {
  if (!dataUrl.startsWith('data:')) {
    return dataUrl
  }

  const matches = dataUrl.match(/^data:(.+?);base64,(.+)$/)
  if (!matches) {
    throw new Error('Invalid data URL format')
  }

  const [, mimeType, base64Data] = matches

  const buffer = Buffer.from(base64Data!, 'base64')

  const ext = mimeType === 'image/png' ? 'png' : mimeType === 'image/jpeg' ? 'jpg' : 'png'
  const key = `${folder}/${randomId()}.${ext}`

  const result = await uploadObject({
    key,
    body: buffer,
    contentType: mimeType,
    isPublic: true,
  })

  return result.url
}
