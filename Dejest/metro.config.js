const path = require('path')
const fs = require('fs')
const { getDefaultConfig } = require('expo/metro-config')
const { resolve } = require('metro-resolver')

const config = getDefaultConfig(__dirname)

// Force Metro to rebuild transforms so stale absolute async-require paths are purged.
config.cacheVersion = 'async-require-fix-1'

config.transformer = {
  ...config.transformer,
  // Ensure Metro resolves async-require from the current workspace.
  asyncRequireModulePath: require.resolve(
    '@expo/metro-config/build/async-require'
  ),
}

// Use package "exports" so Metro resolves to compiled JS instead of TS sources.
config.resolver.unstable_enablePackageExports = true
// Force ox/* to resolve to compiled ESM output (avoids TS sources importing .js files).
config.resolver.extraNodeModules = {
  ...(config.resolver.extraNodeModules || {}),
  ox: path.resolve(__dirname, 'node_modules/ox/_esm'),
}

config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (
    path.isAbsolute(moduleName) &&
    moduleName.includes('/@expo/metro-config/build/async-require')
  ) {
    return {
      type: 'sourceFile',
      filePath: require.resolve('@expo/metro-config/build/async-require'),
    }
  }

  if (moduleName === 'viem' || moduleName.startsWith('viem/')) {
    const subpath = moduleName === 'viem' ? 'index' : moduleName.slice(5)
    const basePath = path.join(__dirname, 'node_modules/viem/_cjs', subpath)
    const filePath = fs.existsSync(`${basePath}.js`)
      ? `${basePath}.js`
      : path.join(basePath, 'index.js')
    return { type: 'sourceFile', filePath }
  }

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
