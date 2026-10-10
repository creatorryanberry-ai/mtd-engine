#!/usr/bin/env bun

import { cmd } from '@mtd/cli'

await cmd`Setup Android release secrets for Play Store deployment`.run(
  async ({ prompt, colors, fs, os, path }) => {
    const clack = prompt
    const pc = colors

    interface AndroidSecret {
      key: string
      description: string
      sensitive: boolean
      multiline?: boolean
    }

    const ANDROID_SECRETS: AndroidSecret[] = [
      {
        key: 'ANDROID_KEYSTORE_PATH',
        description:
          'Path to upload keystore (.jks/.keystore), relative to repo root (preferred for local)',
        sensitive: false,
      },
      {
        key: 'ANDROID_KEYSTORE_BASE64',
        description: 'Base64-encoded keystore (optional alternative to PATH)',
        sensitive: true,
        multiline: true,
      },
      {
        key: 'ANDROID_KEYSTORE_PASSWORD',
        description: 'Keystore password',
        sensitive: true,
      },
      {
        key: 'ANDROID_KEY_ALIAS',
        description: 'Key alias inside the keystore',
        sensitive: false,
      },
      {
        key: 'ANDROID_KEY_PASSWORD',
        description: 'Key password',
        sensitive: true,
      },
      {
        key: 'GOOGLE_PLAY_SERVICE_ACCOUNT_JSON_PATH',
        description:
          'Path to Play Console service account JSON (preferred for local)',
        sensitive: false,
      },
      {
        key: 'GOOGLE_PLAY_SERVICE_ACCOUNT_JSON',
        description: 'Raw service account JSON (optional alternative to PATH)',
        sensitive: true,
        multiline: true,
      },
      {
        key: 'ANDROID_PACKAGE_PREVIEW',
        description: 'Android package for preview (e.g. tax.straightup.preview)',
        sensitive: false,
      },
      {
        key: 'ANDROID_PACKAGE_PRODUCTION',
        description: 'Android package for production (e.g. tax.straightup.app)',
        sensitive: false,
      },
    ]

    const cwd = process.cwd()
    const cliArgs = process.argv.slice(2)
    const dryRun = cliArgs.includes('--dry-run')
    const yes = cliArgs.includes('--yes') || cliArgs.includes('-y')
    const showHelp = cliArgs.includes('--help') || cliArgs.includes('-h')
    const syncOnly = cliArgs.includes('--sync')
    const checkOnly = cliArgs.includes('--check')

    if (showHelp) {
      console.info(`
${pc.bold('Android Release Setup')}

Setup Android signing + Play Console credentials for local Fastlane releases.

${pc.bold('Usage:')}
  bun tko android setup-release [options]

${pc.bold('Options:')}
  --sync       Only sync existing secrets to GitHub (optional; CI deferred)
  --check      Check which secrets are configured on GitHub
  --dry-run    Show what would be synced without making changes
  --yes, -y    Skip confirmation prompts
  --help, -h   Show this help message

${pc.bold('Secrets managed:')}
${ANDROID_SECRETS.map((s) => `  ${pc.cyan(s.key.padEnd(42))} ${pc.gray(s.description)}`).join('\n')}

${pc.bold('Getting credentials:')}
  1. Upload keystore:
     - Create with keytool if you do not have one yet
     - Prefer ANDROID_KEYSTORE_PATH for local builds

  2. Play Console service account:
     - Play Console → Setup → API access → create/link service account
     - Grant release permissions; download JSON key
     - Prefer GOOGLE_PLAY_SERVICE_ACCOUNT_JSON_PATH for local builds
`)
      return
    }

    clack.intro(pc.bgMagenta(pc.black(' Android Release Setup ')))

    const secretsFilePath = path.resolve(cwd, '.env.android')
    const existingSecrets = await loadSecretsFile(secretsFilePath)

    if (checkOnly) {
      await checkSecrets()
      return
    }

    if (syncOnly) {
      if (Object.keys(existingSecrets).length === 0) {
        clack.cancel('No secrets found. Run without --sync to configure first.')
        process.exit(1)
      }
      await syncToGitHub(existingSecrets, dryRun, yes)
      return
    }

    console.info()
    clack.note(
      `Configure Android release secrets.
Stored in ${pc.cyan('.env.android')} (gitignored).

Prefer file paths for local use; base64/JSON inline values are for CI later.`,
      'Setup',
    )

    const secrets: Array<{ key: string; value: string }> = []

    for (const secret of ANDROID_SECRETS) {
      const existingValue = existingSecrets[secret.key]
      const hasExisting = existingValue && existingValue.length > 0

      if (hasExisting) {
        const displayValue = secret.sensitive
          ? `${'*'.repeat(Math.min(existingValue.length, 20))}...`
          : existingValue.length > 40
            ? existingValue.substring(0, 37) + '...'
            : existingValue

        const keepExisting = await clack.confirm({
          message: `${pc.cyan(secret.key)}: Keep existing value? (${pc.gray(displayValue)})`,
          initialValue: true,
        })

        if (clack.isCancel(keepExisting)) {
          clack.cancel('Setup cancelled')
          return
        }

        if (keepExisting) {
          secrets.push({ key: secret.key, value: existingValue })
          continue
        }
      }

      console.info()
      console.info(pc.gray(`  ${secret.description}`))

      let value: string
      if (secret.sensitive && !secret.multiline) {
        const result = await clack.password({ message: secret.key })
        if (clack.isCancel(result)) {
          clack.cancel('Setup cancelled')
          return
        }
        value = result
      } else {
        const result = await clack.text({
          message: secret.key,
          placeholder: existingValue || 'Enter value (or leave empty to skip)...',
        })
        if (clack.isCancel(result)) {
          clack.cancel('Setup cancelled')
          return
        }
        value = result
      }

      if (!value || value.trim() === '') {
        clack.log.warning(`Skipping ${secret.key} (empty value)`)
        continue
      }

      secrets.push({ key: secret.key, value: value.trim() })
    }

    if (secrets.length === 0) {
      clack.outro(pc.yellow('No secrets configured'))
      return
    }

    const spinner = clack.spinner()
    spinner.start('Saving secrets locally...')

    const envContent = secrets
      .map(({ key, value }) => {
        if (value.includes('\n')) {
          return `${key}="${value.replace(/"/g, '\\"')}"`
        }
        return `${key}=${value}`
      })
      .join('\n')

    await fs.promises.writeFile(secretsFilePath, envContent + '\n')
    spinner.stop('Secrets saved to .env.android')

    await ensureGitignore(cwd, '.env.android')

    console.info()
    const shouldSync = await clack.confirm({
      message: 'Sync secrets to GitHub now? (optional — CI deferred)',
      initialValue: false,
    })

    if (clack.isCancel(shouldSync)) {
      clack.cancel('Setup cancelled')
      return
    }

    if (shouldSync) {
      const secretsMap: Record<string, string> = {}
      for (const s of secrets) {
        secretsMap[s.key] = s.value
      }
      await syncToGitHub(secretsMap, dryRun, yes)
    } else {
      clack.outro(pc.green('Secrets saved locally'))
      console.info()
      console.info(pc.gray('Next: bun tko release preview --skip-upload'))
    }

    async function loadSecretsFile(filePath: string): Promise<Record<string, string>> {
      if (!fs.existsSync(filePath)) {
        return {}
      }

      const content = await fs.promises.readFile(filePath, 'utf-8')
      const secrets: Record<string, string> = {}
      const lines = content.split('\n')
      let currentKey: string | null = null
      let currentValue: string[] = []
      let inMultiline = false

      const saveCurrentKey = () => {
        if (currentKey) {
          let value = currentValue.join('\n')
          if (
            (value.startsWith('"') && value.endsWith('"')) ||
            (value.startsWith("'") && value.endsWith("'"))
          ) {
            value = value.slice(1, -1)
          }
          value = value.replace(/\\"/g, '"')
          secrets[currentKey] = value
        }
        currentKey = null
        currentValue = []
        inMultiline = false
      }

      for (const line of lines) {
        if (inMultiline) {
          currentValue.push(line)
          if (line.trim().endsWith('"') || line.trim().endsWith("'")) {
            saveCurrentKey()
          }
          continue
        }

        const trimmed = line.trim()
        if (!trimmed || trimmed.startsWith('#')) continue

        const match = trimmed.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/)
        if (match?.[1]) {
          if (currentKey) saveCurrentKey()
          currentKey = match[1]
          const valueStart = match[2] || ''
          if (
            (valueStart.startsWith('"') && !valueStart.endsWith('"')) ||
            (valueStart.startsWith("'") && !valueStart.endsWith("'"))
          ) {
            inMultiline = true
            currentValue = [valueStart]
          } else {
            currentValue = [valueStart]
            saveCurrentKey()
          }
        }
      }
      if (currentKey) saveCurrentKey()
      return secrets
    }

    async function syncToGitHub(
      secrets: Record<string, string>,
      dryRun: boolean,
      skipConfirm: boolean,
    ) {
      try {
        await Bun.$`gh --version`.quiet()
      } catch {
        clack.cancel('GitHub CLI (gh) not found — skipping sync')
        return
      }

      const varsToSync = Object.entries(secrets).filter(([_, value]) => value && value.length > 0)
      if (varsToSync.length === 0) {
        clack.outro(pc.yellow('No secrets to sync'))
        return
      }

      console.info()
      console.info(pc.bold('Secrets to sync to GitHub:'))
      for (const [key] of varsToSync) {
        console.info(`  ${pc.cyan(key)}`)
      }

      if (dryRun) {
        clack.outro(pc.yellow('Dry run - no changes made'))
        return
      }

      if (!skipConfirm) {
        const confirm = await clack.confirm({
          message: `Sync ${varsToSync.length} secrets to GitHub?`,
          initialValue: true,
        })
        if (clack.isCancel(confirm) || !confirm) {
          clack.cancel('Sync cancelled')
          return
        }
      }

      const spinner = clack.spinner()
      spinner.start('Syncing to GitHub...')

      for (const [key, value] of varsToSync) {
        const tmpFile = path.join(os.tmpdir(), `gh-secret-${key}-${Date.now()}`)
        await Bun.write(tmpFile, value)
        await Bun.$`gh secret set ${key} < ${tmpFile}`.quiet()
        await fs.promises.unlink(tmpFile).catch(() => {})
      }

      spinner.stop('Sync complete')
      clack.outro(pc.green('Secrets synced to GitHub'))
    }

    async function checkSecrets() {
      try {
        await Bun.$`gh --version`.quiet()
      } catch {
        clack.cancel('GitHub CLI (gh) not found')
        return
      }

      const spinner = clack.spinner()
      spinner.start('Fetching secrets from GitHub...')

      let existing: string[] = []
      try {
        const result = await Bun.$`gh secret list --json name -q '.[].name'`.text()
        existing = result.trim().split('\n').filter(Boolean)
      } catch {
        spinner.stop('Failed to fetch secrets')
        clack.cancel('Could not fetch GitHub secrets')
        return
      }

      spinner.stop('Secrets fetched')
      console.info()
      let missing = 0
      for (const secret of ANDROID_SECRETS) {
        const has = existing.includes(secret.key)
        console.info(
          `  ${has ? pc.green('✓') : pc.red('✗')} ${pc.cyan(secret.key.padEnd(42))} ${has ? pc.green('configured') : pc.red('missing')}`,
        )
        if (!has) missing++
      }
      clack.outro(
        missing === 0 ? pc.green('All secrets configured!') : pc.yellow(`${missing} secrets missing`),
      )
    }

    async function ensureGitignore(cwd: string, filename: string) {
      const gitignorePath = path.resolve(cwd, '.gitignore')
      if (!fs.existsSync(gitignorePath)) return
      const content = await fs.promises.readFile(gitignorePath, 'utf-8')
      if (!content.includes(filename)) {
        await fs.promises.writeFile(gitignorePath, content.trimEnd() + '\n' + filename + '\n')
        clack.log.info(`Added ${filename} to .gitignore`)
      }
    }
  },
)
