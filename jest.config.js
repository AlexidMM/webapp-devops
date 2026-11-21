export default {
  testEnvironment: 'node',
  transform: {},
  collectCoverageFrom: ['app.js'],
  testPathIgnorePatterns: ['/node_modules/', '<rootDir>/e2e/'],
  coverageThreshold: {
    global: { statements: 70, functions: 70, lines: 70 }
  }
};