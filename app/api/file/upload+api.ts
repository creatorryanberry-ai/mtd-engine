import { randomId } from '@mtd/helpers'

import { ensureAuth } from '~/features/auth/server/ensureAuth'
import { uploadObject } from '~/features/upload/storage'

const folder = 'uploads'

export default async function handler(req: Request) {
  if (req.method !== 'POST') {
    return Response.json({ error: 'Method not allowed' }, { status: 405 })
  }

  await ensureAuth(req)

  const formData = (await req.formData()) as unknown as FormData
  const file = formData.get('file')
  if (!file || !(file instanceof File)) {
    return Response.json({ error: 'Failed to parse the form' }, { status: 500 })
  }

  try {
    const key = `${folder}/${randomId()}-${file.name}`

    if (file.type.startsWith('image/')) {
      const arrayBuffer = await file.arrayBuffer()
      const imageBytes = new Uint8Array(arrayBuffer)

      const result = await uploadObject({
        key,
        body: imageBytes,
        contentType: file.type,
        isPublic: true,
      })

      return Response.json({ message: 'File uploaded successfully', ...result })
    }

    const result = await uploadObject({
      key,
      body: file.stream(),
      contentType: file.type,
      isPublic: true,
    })

    return Response.json({ message: 'File uploaded successfully', ...result })
  } catch (error) {
    return Response.json(
      { error: 'Failed to upload file', details: `${error}` },
      { status: 500 },
    )
  }
}
