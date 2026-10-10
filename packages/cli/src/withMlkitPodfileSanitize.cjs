const { withDangerousMod } = require('@expo/config-plugins')
const fs = require('node:fs')
const path = require('node:path')

const FMT_MARKER = '# workaround: fmt 11.x + Xcode 26 consteval'
const MLKIT_MARKER = '# expo-mlkit-ocr: iOS Simulator MLKit handling'

/**
 * expo-mlkit-ocr's strip regex stops at the first inner `end`, then re-injects
 * the full patch. leftover extra `end`s and a duplicate aggregate_targets loop
 * sit between the fmt workaround and the new mlkit block.
 */
function stripLeftoverBetweenFmtAndMlkit(podfile) {
  const fmtIdx = podfile.indexOf(FMT_MARKER)
  const mlkitIdx = podfile.indexOf(MLKIT_MARKER)
  if (fmtIdx === -1 || mlkitIdx === -1 || mlkitIdx <= fmtIdx) {
    return podfile
  }

  const between = podfile.slice(fmtIdx, mlkitIdx)
  const fmtEnd = between.match(
    /^([\s\S]*CLANG_CXX_LANGUAGE_STANDARD'\] = 'c\+\+17'\n(?:[ \t]*end\n){3})([\s\S]*)$/,
  )
  if (!fmtEnd) {
    return podfile
  }

  const leftover = fmtEnd[2]
  if (!leftover.trim()) {
    return podfile
  }

  const mlkitLineStart = podfile.lastIndexOf('\n', mlkitIdx)
  return podfile.slice(0, fmtIdx) + fmtEnd[1] + podfile.slice(mlkitLineStart)
}

function withMlkitPodfileSanitize(config) {
  return withDangerousMod(config, [
    'ios',
    async (config) => {
      const podfilePath = path.join(config.modRequest.platformProjectRoot, 'Podfile')

      if (!fs.existsSync(podfilePath)) {
        return config
      }

      const podfile = fs.readFileSync(podfilePath, 'utf8')
      const updated = stripLeftoverBetweenFmtAndMlkit(podfile)
      if (updated !== podfile) {
        fs.writeFileSync(podfilePath, updated)
      }

      return config
    },
  ])
}

module.exports = withMlkitPodfileSanitize
module.exports.stripLeftoverBetweenFmtAndMlkit = stripLeftoverBetweenFmtAndMlkit
