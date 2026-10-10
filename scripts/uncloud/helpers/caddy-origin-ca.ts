import fs from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'

import { run } from '@mtd/scripts/helpers/run'

const CADDY_DIR = '/var/lib/uncloud/caddy'
const CADDYFILE_PATH = `${CADDY_DIR}/Caddyfile`
const ORIGIN_CERT = '/config/certs/origin.pem'
const ORIGIN_KEY = '/config/certs/origin.key'
const TLS_DIRECTIVE = `\ttls ${ORIGIN_CERT} ${ORIGIN_KEY}`

export function getSSHCmd(host: string, sshKey: string): string {
  return `ssh -i ${sshKey} -o StrictHostKeyChecking=no ${host}`
}

/** prefix with sudo when deploying as a non-root user (e.g. gcp/aws default accounts) */
export function elevated(deployUser: string, command: string): string {
  return deployUser === 'root' ? command : `sudo ${command}`
}

export async function uploadOriginCACerts(
  host: string,
  sshKey: string,
  deployUser: string,
  resolvedCert: string,
  resolvedKey: string,
): Promise<void> {
  const ssh = getSSHCmd(host, sshKey)
  const mkdir = elevated(
    deployUser,
    'mkdir -p /etc/uncloud/certs /var/lib/uncloud/caddy/certs',
  )
  const copyEtc = elevated(
    deployUser,
    'cp /tmp/origin.pem /tmp/origin.key /etc/uncloud/certs/',
  )
  const copyCaddy = elevated(
    deployUser,
    `cp /tmp/origin.pem /tmp/origin.key ${CADDY_DIR}/certs/`,
  )
  const chmodCert = elevated(
    deployUser,
    'chmod 644 /etc/uncloud/certs/origin.pem /var/lib/uncloud/caddy/certs/origin.pem',
  )
  const chmodKey = elevated(
    deployUser,
    'chmod 600 /etc/uncloud/certs/origin.key /var/lib/uncloud/caddy/certs/origin.key',
  )

  await run(`${ssh} "${mkdir}"`, { silent: true })

  await run(
    `scp -i ${sshKey} -o StrictHostKeyChecking=no ${resolvedCert} ${host}:/tmp/origin.pem`,
    { silent: true },
  )
  await run(
    `scp -i ${sshKey} -o StrictHostKeyChecking=no ${resolvedKey} ${host}:/tmp/origin.key`,
    { silent: true },
  )

  await run(
    `${ssh} "${copyEtc} && ${copyCaddy} && ${chmodCert} && ${chmodKey} && rm -f /tmp/origin.pem /tmp/origin.key"`,
    { silent: true },
  )
}

export function patchCaddyfileForOriginCA(content: string, domains: string[]): string {
  let result = content
  for (const domain of domains) {
    const header = `https://${domain} {`
    const idx = result.indexOf(header)
    if (idx === -1) continue

    const afterHeader = idx + header.length
    const nextChunk = result.slice(afterHeader, afterHeader + 120)
    if (nextChunk.includes(`tls ${ORIGIN_CERT}`)) continue

    result = `${result.slice(0, afterHeader)}\n${TLS_DIRECTIVE}${result.slice(afterHeader)}`
  }
  return result
}

export async function patchRemoteCaddyfile(
  host: string,
  sshKey: string,
  deployUser: string,
  domains: string[],
): Promise<void> {
  const ssh = getSSHCmd(host, sshKey)
  const localFile = path.join(tmpdir(), 'mtd-caddyfile')
  const readCaddy = elevated(deployUser, `cat ${CADDYFILE_PATH}`)
  const writeCaddy = elevated(deployUser, `cp /tmp/Caddyfile ${CADDYFILE_PATH}`)

  await run(`${ssh} "${readCaddy}" > ${localFile}`, { silent: true })

  const original = await fs.promises.readFile(localFile, 'utf-8')
  const patched = patchCaddyfileForOriginCA(original, domains)
  if (patched === original) return

  await fs.promises.writeFile(localFile, patched)
  await run(
    `scp -i ${sshKey} -o StrictHostKeyChecking=no ${localFile} ${host}:/tmp/Caddyfile`,
    {
      silent: true,
    },
  )
  await run(`${ssh} "${writeCaddy} && rm -f /tmp/Caddyfile"`, { silent: true })
  await fs.promises.unlink(localFile).catch(() => {})
}

export async function restartCaddy(
  host: string,
  sshKey: string,
  deployUser: string,
): Promise<void> {
  const ssh = getSSHCmd(host, sshKey)
  const restart = elevated(deployUser, 'docker restart $(docker ps -qf name=caddy)')
  await run(`${ssh} "${restart}"`, { silent: true })
}

export function buildOriginCACaddyfile(domains: string[]): string {
  return [
    '# origin ca certificates for cloudflare proxied domains',
    '# auto-generated during deploy from VITE_WEB_HOSTNAME env vars',
    '',
    ...domains.map((domain) => `${domain} {\n${TLS_DIRECTIVE}\n}`),
    '',
  ].join('\n')
}
