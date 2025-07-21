// electron-builder configuration
const { join } = require('path');

module.exports = {
  appId: 'com.schichtplan.desktop',
  productName: 'Schichtplan',
  directories: {
    output: 'dist',
    buildResources: 'resources'
  },
  files: [
    'src/**/*',
    'resources/**/*',
    'node_modules/**/*',
    '!**/*.md',
    '!**/*.map',
    '!**/test/**',
    '!**/tests/**',
    '!**/*.spec.js',
    '!**/*.test.js'
  ],
  extraResources: [
    {
      from: 'resources/backend/',
      to: 'backend/'
    },
    {
      from: 'resources/frontend/',
      to: 'frontend/'
    }
  ],
  win: {
    target: [
      {
        target: 'nsis',
        arch: ['x64', 'ia32']
      }
    ],
    icon: 'resources/icon.ico',
    publisherName: 'Schichtplan',
    verifyUpdateCodeSignature: false,
    requestedExecutionLevel: 'asInvoker'
  },
  mac: {
    target: [
      {
        target: 'dmg',
        arch: ['x64', 'arm64']
      }
    ],
    icon: 'resources/icon.icns',
    category: 'public.app-category.business',
    hardenedRuntime: true,
    gatekeeperAssess: false,
    entitlements: 'resources/entitlements.mac.plist',
    entitlementsInherit: 'resources/entitlements.mac.plist'
  },
  linux: {
    target: [
      {
        target: 'AppImage',
        arch: ['x64']
      },
      {
        target: 'deb',
        arch: ['x64']
      },
      {
        target: 'rpm',
        arch: ['x64']
      }
    ],
    icon: 'resources/icon.png',
    category: 'Office',
    synopsis: 'Schedule management system for efficient workforce planning',
    description: 'Schichtplan is a comprehensive schedule management system designed for efficient workforce planning and scheduling.'
  },
  nsis: {
    oneClick: false,
    allowToChangeInstallationDirectory: true,
    allowElevation: true,
    installerIcon: 'resources/icon.ico',
    uninstallerIcon: 'resources/icon.ico',
    installerHeaderIcon: 'resources/icon.ico',
    createDesktopShortcut: true,
    createStartMenuShortcut: true,
    shortcutName: 'Schichtplan'
  },
  dmg: {
    contents: [
      {
        x: 110,
        y: 150
      },
      {
        x: 240,
        y: 150,
        type: 'link',
        path: '/Applications'
      }
    ]
  },
  publish: [
    {
      provider: 'github',
      owner: 'jango-blockchained',
      repo: 'schichtplan'
    }
  ]
};
