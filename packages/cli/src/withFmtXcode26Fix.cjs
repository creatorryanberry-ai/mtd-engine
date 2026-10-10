const { withDangerousMod } = require('@expo/config-plugins')
const fs = require('node:fs')
const path = require('node:path')

/**
 * fmt 11.0.2 (via RCT-Folly) fails to compile under Xcode 26 / Apple Clang 21
 * because consteval format-string checks are stricter. Compile only the fmt pod
 * as C++17 so consteval is unavailable and fmt falls back to runtime checks.
 * see: https://github.com/fmtlib/fmt/issues/4740
 * remove when RN ships fmt >= 12.1.0
 */
function withFmtXcode26Fix(config) {
  return withDangerousMod(config, [
    'ios',
    async (config) => {
      const podfilePath = path.join(config.modRequest.platformProjectRoot, 'Podfile')

      if (!fs.existsSync(podfilePath)) {
        return config
      }

      let podfile = fs.readFileSync(podfilePath, 'utf8')

      if (podfile.includes('# workaround: fmt 11.x + Xcode 26 consteval')) {
        return config
      }

      const workaround = `
    # workaround: fmt 11.x + Xcode 26 consteval
    # must run AFTER react_native_post_install (which sets pods to c++20).
    # Apple Clang 21 rejects FMT_STRING consteval in format-inl.h.
    # C++17 disables consteval so fmt uses runtime format checks.
    installer.pods_project.targets.each do |target|
      if target.name == 'fmt'
        target.build_configurations.each do |build_config|
          build_config.build_settings['CLANG_CXX_LANGUAGE_STANDARD'] = 'c++17'
        end
      end
    end
`
      // insert after react_native_post_install(...) so RN does not overwrite c++17
      const updated = podfile.replace(
        /(react_native_post_install\([\s\S]*?\)\s*\n)/,
        `$1${workaround}`,
      )

      if (updated !== podfile) {
        fs.writeFileSync(podfilePath, updated)
      }

      return config
    },
  ])
}

module.exports = withFmtXcode26Fix
