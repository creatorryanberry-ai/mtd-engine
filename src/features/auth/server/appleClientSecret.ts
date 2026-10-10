import { importPKCS8, SignJWT } from 'jose'

type AppleClientSecretOptions = {
  clientId: string
  teamId: string
  keyId: string
  privateKey: string
}

export function normalizeApplePrivateKey(pem: string) {
  return pem.includes('-----BEGIN') ? pem.replace(/\\n/g, '\n') : pem
}

export async function generateAppleClientSecret(opts: AppleClientSecretOptions) {
  const key = await importPKCS8(normalizeApplePrivateKey(opts.privateKey), 'ES256')
  const now = Math.floor(Date.now() / 1000)

  return new SignJWT({})
    .setProtectedHeader({ alg: 'ES256', kid: opts.keyId })
    .setIssuer(opts.teamId)
    .setSubject(opts.clientId)
    .setAudience('https://appleid.apple.com')
    .setIssuedAt(now)
    .setExpirationTime(now + 180 * 24 * 60 * 60)
    .sign(key)
}
