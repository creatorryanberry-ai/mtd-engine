import { ensureAuth } from '~/features/auth/server/ensureAuth'
import { uploadPrivateReceipt } from '~/features/upload/receiptStorage'

export default async function handler(req: Request) {
  if (req.method !== 'POST') {
    return Response.json({ error: 'Method not allowed' }, { status: 405 })
  }

  const session = await ensureAuth(req)
  const userId = session.user.id

  const formData = (await req.formData()) as unknown as FormData
  const file = formData.get('file')
  if (!file || !(file instanceof File)) {
    return Response.json({ error: 'Failed to parse the form' }, { status: 400 })
  }

  try {
    const arrayBuffer = await file.arrayBuffer()
    const result = await uploadPrivateReceipt({
      userId,
      fileName: file.name || 'receipt.jpg',
      body: new Uint8Array(arrayBuffer),
      contentType: file.type || 'application/octet-stream',
    })

    return Response.json({
      message: 'Receipt uploaded successfully',
      url: result.url,
      key: result.key,
      attachmentRef: result.attachmentRef,
    })
  } catch (error) {
    return Response.json(
      { error: 'Failed to upload receipt', details: `${error}` },
      { status: 500 },
    )
  }
}
