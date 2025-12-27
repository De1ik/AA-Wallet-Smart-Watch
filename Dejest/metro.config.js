const path = require('path')
const { getDefaultConfig } = require('expo/metro-config')
const { resolve } = require('metro-resolver')

const config = getDefaultConfig(__dirname)

// Use package "exports" so Metro resolves to compiled JS instead of TS sources.
config.resolver.unstable_enablePackageExports = true
// Force ox/* to resolve to compiled ESM output (avoids TS sources importing .js files).
config.resolver.extraNodeModules = {
  ...(config.resolver.extraNodeModules || {}),
  ox: path.resolve(__dirname, 'node_modules/ox/_esm'),
}

config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName.startsWith('ox/tempo/')) {
    const subpath = moduleName.replace(/^ox\//, '')
    const filePath = path.join(
      __dirname,
      'node_modules/ox/_esm',
      `${subpath}.js`
    )
    return { type: 'sourceFile', filePath }
  }

  return resolve(context, moduleName, platform)
}

module.exports = config
