// Phase 0 tests cover pure logic only (design tokens). UI/snapshot tests with
// the full RN runtime are wired in Phase 4+ with the `jest-expo` preset.
module.exports = {
  testEnvironment: 'node',
  testPathIgnorePatterns: ['/node_modules/', '/dist/', '/.expo/'],
  testMatch: ['**/?(*.)+(test).ts?(x)'],
  transform: {
    '^.+\\.(ts|tsx|js|jsx)$': [
      'babel-jest',
      {
        babelrc: false,
        configFile: false,
        presets: ['@babel/preset-env', '@babel/preset-typescript'],
      },
    ],
  },
};
