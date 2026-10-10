#!/usr/bin/env bun

import { readdir, readFile, stat } from 'node:fs/promises'
import { join, relative } from 'node:path'

import { cmd } from '@mtd/cli'

import { findDuplicateCharacterClassChars } from '../helpers/duplicateCharacterClass'

const ROOTS = ['app', 'src', 'packages', 'scripts']
const SKIP_DIR = new Set([
  'node_modules',
  'dist',
  '.dist',
  '.output',
  '.build',
  '.tamagui',
  '.docker',
  'ios',
  'android',
  'coverage',
])

async function walk(dir: string, files: string[]) {
  let entries
  try {
    entries = await readdir(dir)
  } catch {
    return
  }
  await Promise.all(
    entries.map(async (entry) => {
      if (SKIP_DIR.has(entry)) return
      const full = join(dir, entry)
      const info = await stat(full)
      if (info.isDirectory()) {
        await walk(full, files)
        return
      }
      if (/\.(ts|tsx|js|jsx)$/.test(entry) && !entry.endsWith('.d.ts')) {
        files.push(full)
      }
    }),
  )
}

await cmd`Catch unused locals and duplicate regex character-class chars`.run(
  async ({ $ }) => {
    await $`oxlint -c .oxlintrc.quality.json --quiet`

    const files: string[] = []
    await Promise.all(ROOTS.map((root) => walk(root, files)))

    const findings = (
      await Promise.all(
        files.map(async (file) => {
          const source = await readFile(file, 'utf8')
          return findDuplicateCharacterClassChars(source, relative('.', file))
        }),
      )
    ).flat()

    if (findings.length > 0) {
      for (const finding of findings) {
        console.error(
          `${finding.path}:${finding.line}:${finding.column} duplicate '${finding.char}' in regex character class`,
        )
      }
      process.exit(1)
    }

    console.info('[check] quality ok')
  },
)
