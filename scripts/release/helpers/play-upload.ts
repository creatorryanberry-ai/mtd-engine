#!/usr/bin/env bun

import { createSign } from 'node:crypto'
import { closeSync, fstatSync, openSync, readFileSync, readSync } from 'node:fs'

type ServiceAccount = {
  client_email: string
  private_key: string
}

type UploadOpts = {
  packageName: string
  aabPath: string
  jsonKeyPath: string
  track?: string
  releaseStatus?: string
  /** google requires multiples of 256 KiB; default 2 MiB */
  chunkBytes?: number
}

async function accessToken(key: ServiceAccount): Promise<string> {
  const now = Math.floor(Date.now() / 1000)
  const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString(
    'base64url',
  )
  const claim = Buffer.from(
    JSON.stringify({
      iss: key.client_email,
      scope: 'https://www.googleapis.com/auth/androidpublisher',
      aud: 'https://oauth2.googleapis.com/token',
      iat: now,
      exp: now + 3600,
    }),
  ).toString('base64url')
  const unsigned = `${header}.${claim}`
  const sign = createSign('RSA-SHA256')
  sign.update(unsigned)
  const jwt = `${unsigned}.${sign.sign(key.private_key, 'base64url')}`

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=${encodeURIComponent('urn:ietf:params:oauth:grant-type:jwt-bearer')}&assertion=${jwt}`,
  })
  const body = (await res.json()) as { access_token?: string; error?: string }
  if (!body.access_token) {
    throw new Error(`play oauth failed: ${JSON.stringify(body)}`)
  }
  return body.access_token
}

async function putChunk(
  uploadUrl: string,
  auth: string,
  start: number,
  buf: Buffer,
  size: number,
): Promise<Record<string, unknown> | null> {
  const end = start + buf.byteLength - 1
  const contentRange = `bytes ${start}-${end}/${size}`
  for (let attempt = 1; attempt <= 6; attempt++) {
    try {
      console.info(`  → ${contentRange} (attempt ${attempt})`)
      const res = await fetch(uploadUrl, {
        method: 'PUT',
        headers: {
          Authorization: auth,
          'Content-Type': 'application/octet-stream',
          'Content-Length': String(buf.byteLength),
          'Content-Range': contentRange,
        },
        body: Uint8Array.from(buf),
      })
      if (res.status === 308) return null
      if (!res.ok) {
        const text = await res.text()
        throw new Error(`HTTP ${res.status}: ${text.slice(0, 400)}`)
      }
      return (await res.json()) as Record<string, unknown>
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.info(`  ✗ ${msg}`)
      if (attempt === 6) throw err
      await Bun.sleep(1000 * attempt)
    }
  }
  return null
}

/**
 * upload an aab via the android publisher api using chunked resumable upload.
 * fastlane supply often dies mid-transfer on flaky ssl (SSL_read eof / ECONNRESET);
 * small chunks + retries get a 70mb+ aab through.
 */
export async function uploadAabToPlay(opts: UploadOpts): Promise<void> {
  const track = opts.track || 'internal'
  const releaseStatus = opts.releaseStatus || 'completed'
  const chunkBytes = opts.chunkBytes || 2 * 1024 * 1024

  const key = JSON.parse(readFileSync(opts.jsonKeyPath, 'utf-8')) as ServiceAccount
  const token = await accessToken(key)
  const auth = `Bearer ${token}`
  const base = `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${opts.packageName}`

  const editRes = await fetch(`${base}/edits`, {
    method: 'POST',
    headers: { Authorization: auth, 'Content-Type': 'application/json' },
    body: '{}',
  })
  const edit = (await editRes.json()) as { id?: string }
  if (!edit.id) throw new Error(`play create edit failed: ${JSON.stringify(edit)}`)
  console.info(`play edit ${edit.id}`)

  const fd = openSync(opts.aabPath, 'r')
  const size = fstatSync(fd).size
  try {
    const initRes = await fetch(
      `https://androidpublisher.googleapis.com/upload/androidpublisher/v3/applications/${opts.packageName}/edits/${edit.id}/bundles?uploadType=resumable`,
      {
        method: 'POST',
        headers: {
          Authorization: auth,
          'Content-Type': 'application/json',
          'X-Upload-Content-Type': 'application/octet-stream',
          'X-Upload-Content-Length': String(size),
        },
        body: '{}',
      },
    )
    const uploadUrl = initRes.headers.get('location')
    if (!uploadUrl) {
      throw new Error(
        `play resumable init failed: ${initRes.status} ${await initRes.text()}`,
      )
    }
    console.info(`uploading ${size} bytes in ${chunkBytes}-byte chunks`)

    let offset = 0
    let bundle: Record<string, unknown> | null = null
    while (offset < size) {
      const len = Math.min(chunkBytes, size - offset)
      const buf = Buffer.alloc(len)
      const n = readSync(fd, buf, 0, len, offset)
      if (n !== len) throw new Error(`short read ${n}/${len} at ${offset}`)
      const result = await putChunk(uploadUrl, auth, offset, buf, size)
      offset += len
      if (result) {
        bundle = result
        break
      }
    }

    if (!bundle) {
      throw new Error('play upload finished without bundle metadata')
    }
    const versionCode = bundle.versionCode
    console.info(`bundle uploaded versionCode=${versionCode}`)

    const trackRes = await fetch(`${base}/edits/${edit.id}/tracks/${track}`, {
      method: 'PUT',
      headers: { Authorization: auth, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        track,
        releases: [
          {
            versionCodes: [String(versionCode)],
            status: releaseStatus,
          },
        ],
      }),
    })
    const trackBody = await trackRes.json()
    if (!trackRes.ok) {
      throw new Error(`play track update failed: ${JSON.stringify(trackBody)}`)
    }

    // google keeps processing the bundle briefly after the last chunk lands;
    // committing too early returns 400 "uploads are not completed yet"
    for (let attempt = 1; ; attempt++) {
      const commitRes = await fetch(`${base}/edits/${edit.id}:commit`, {
        method: 'POST',
        headers: { Authorization: auth },
      })
      const commitBody = (await commitRes.json()) as {
        error?: { message?: string }
      }
      if (commitRes.ok) break
      const msg = commitBody.error?.message || JSON.stringify(commitBody)
      if (attempt >= 10 || !/not completed yet/i.test(msg)) {
        throw new Error(`play commit failed: ${msg}`)
      }
      console.info(`  commit not ready (${msg}) — retrying in ${attempt * 10}s`)
      await Bun.sleep(attempt * 10_000)
    }
    console.info(`play committed to ${track} (${releaseStatus})`)
  } finally {
    closeSync(fd)
  }
}
