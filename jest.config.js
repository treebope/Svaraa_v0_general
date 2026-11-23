/** @type {import('jest').Config} */
module.exports = {
  preset: 'jest-expo',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  moduleNameMapper: { '^@/(.*)$': '<rootDir>/$1' },
  testPathIgnorePatterns: ['/node_modules/', '/dist/'],
  // The default 5 s is too short for the heavier screens on a busy laptop or a CI runner (tests passed alone, timed out in a full run).
  testTimeout: 20000,
  // .mjs files (msw dependencies such as rettime) must also go through Babel.
  transform: {
    '\\.mjs$': [
      'babel-jest',
      { presets: [require.resolve('babel-preset-expo', { paths: [require.resolve('expo/package.json')] })] },
    ],
  },
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|msw|@open-draft/.*|@mswjs/.*|until-async|rettime|@bundled-es-modules/.*))',
  ],
};
