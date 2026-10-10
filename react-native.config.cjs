const variant = process.env.APP_VARIANT
if (variant !== 'preview' && variant !== 'production') {
  throw new Error(
    `APP_VARIANT must be preview or production (got ${variant ? `'${variant}'` : 'unset'}). Native builds use tax.straightup.preview or tax.straightup.app — there is no .dev identity. Example: APP_VARIANT=preview bun ios`,
  )
}

const androidPackageByVariant = {
  preview: 'tax.straightup.preview',
  production: 'tax.straightup.app',
}

module.exports = {
  commands: [...require('vxrn/react-native-commands')],
  // pin packageName so RN entrypoint codegen cannot fall back to a sanitized
  // display-name package when autolinking cache is stale.
  project: {
    android: {
      packageName: androidPackageByVariant[variant],
    },
  },
}
