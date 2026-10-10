import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import {
  COMPOSE_ENV_B64_PREFIX,
  encodeComposeEnvValue,
  processComposeEnv,
} from '@mtd/scripts/helpers/process-compose-env'

describe('encodeComposeEnvValue', () => {
  it('base64-encodes json objects so yaml cannot treat them as flow maps', () => {
    const json = JSON.stringify({ type: 'service_account', project_id: 'x' })
    const encoded = encodeComposeEnvValue(json)
    expect(encoded.startsWith(COMPOSE_ENV_B64_PREFIX)).toBe(true)
    expect(
      Buffer.from(encoded.slice(COMPOSE_ENV_B64_PREFIX.length), 'base64').toString(
        'utf8',
      ),
    ).toBe(json)
  })

  it('leaves non-json values unchanged', () => {
    expect(encodeComposeEnvValue('plain-secret')).toBe('plain-secret')
    expect(encodeComposeEnvValue('-----BEGIN PRIVATE KEY-----')).toBe(
      '-----BEGIN PRIVATE KEY-----',
    )
  })
})

describe('processComposeEnv', () => {
  it('embeds gcs json as b64 in the processed compose file', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'compose-env-'))
    const input = path.join(dir, 'in.yml')
    const output = path.join(dir, 'out.yml')
    const json = JSON.stringify({ type: 'service_account', private_key: 'k\\n' })
    fs.writeFileSync(
      input,
      `x-app-env: &app-env\n  GCS_SERVICE_ACCOUNT_JSON: \${GCS_SERVICE_ACCOUNT_JSON:-}\n`,
    )

    processComposeEnv(input, output, { GCS_SERVICE_ACCOUNT_JSON: json })

    const out = fs.readFileSync(output, 'utf8')
    expect(out).toContain(COMPOSE_ENV_B64_PREFIX)
    expect(out).not.toContain('service_account')
  })
})
