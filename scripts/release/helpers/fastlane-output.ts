import { homedir } from 'node:os'
import { join } from 'node:path'

/** pull the real failure out of a huge fastlane/xcode dump */
export function summarizeFastlaneFailure(output: string, maxLines = 40): string {
  const plain = output.replace(/\u001B\[[0-9;]*m/g, '')
  const lines = plain.split(/\r?\n/)

  const hit = (line: string) =>
    /error Unable to resolve|Error: |Unable to resolve module|Command PhaseScriptExecution failed|ARCHIVE FAILED|error: |❌|BUILD FAILED|Execution failed for task/i.test(
      line,
    ) && !/warning:|deprecated|Sendable|ignoring duplicate/i.test(line)

  const interesting = lines
    .filter(hit)
    .map((l) => l.trim())
    .filter(Boolean)
  if (interesting.length > 0) {
    return [...new Set(interesting)].slice(-maxLines).join('\n')
  }

  // fall back to the last non-empty lines (still capped)
  return lines
    .map((l) => l.trim())
    .filter(Boolean)
    .slice(-Math.min(20, maxLines))
    .join('\n')
}

export function gymLogHint(scheme?: string): string {
  const logDir = join(homedir(), 'Library', 'Logs', 'gym')
  if (scheme) {
    return `full log: ${join(logDir, `${scheme}-${scheme}.log`)} (or latest in ${logDir})`
  }
  return `full log: ${logDir}`
}
