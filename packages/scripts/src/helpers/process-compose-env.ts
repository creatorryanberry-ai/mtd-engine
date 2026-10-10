import fs from 'node:fs'

/** prefix for json/array env values that must survive uncloud/yaml round-trips */
export const COMPOSE_ENV_B64_PREFIX = 'b64:'

/**
 * uncloud/yaml treats bare `{...}` as a flow mapping. even when we double-quote
 * the value, some deploy paths still collapse it to `{`. base64 keeps the
 * payload alphanumeric so container env stays intact.
 */
export function encodeComposeEnvValue(value: string): string {
  const trimmed = value.trim()
  if (
    (trimmed.startsWith('{') && trimmed.endsWith('}')) ||
    (trimmed.startsWith('[') && trimmed.endsWith(']'))
  ) {
    return `${COMPOSE_ENV_B64_PREFIX}${Buffer.from(value, 'utf8').toString('base64')}`
  }
  return value
}

// make values safe for yaml map syntax (KEY: value)
// handles multi-line values, special chars that break yaml parsing
function yamlSafe(value: string): string {
  const needsQuoting =
    value.includes('\n') ||
    value.includes(':') ||
    value.includes('#') ||
    value.startsWith('-') ||
    value.startsWith('{') ||
    value.startsWith('[') ||
    value.startsWith('"') ||
    value.startsWith("'")

  if (!needsQuoting) return value

  // escape backslashes and double quotes, collapse newlines
  const escaped = value.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n')

  return `"${escaped}"`
}

function substituteValue(value: string): string {
  return yamlSafe(encodeComposeEnvValue(value))
}

/**
 * processes docker-compose file, replacing ${VAR:-default} with actual env values.
 * handles multi-line values (PEM keys etc) by escaping newlines for yaml.
 */
export function processComposeEnv(
  composeFile: string,
  outputFile: string,
  envVars: Record<string, string | undefined>,
): void {
  let content = fs.readFileSync(composeFile, 'utf-8')

  // replace all ${VAR:-default} patterns with actual env values
  content = content.replace(
    /\$\{([A-Z_][A-Z0-9_]*):-([^}]*)\}/g,
    (_match, varName, defaultValue) => {
      const value = envVars[varName]
      if (value) {
        const encoded = encodeComposeEnvValue(value)
        console.info(
          `  ${varName}: ${encoded.slice(0, 50)}${encoded.length > 50 ? '...' : ''}`,
        )
      }
      return value ? substituteValue(value) : defaultValue
    },
  )

  // replace standalone ${VAR} patterns
  content = content.replace(/\$\{([A-Z_][A-Z0-9_]*)\}/g, (_match, varName) => {
    const value = envVars[varName]
    return value ? substituteValue(value) : _match
  })

  fs.writeFileSync(outputFile, content)
  console.info(`✅ processed compose file: ${outputFile}`)
}
