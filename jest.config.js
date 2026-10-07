export default {
  testEnvironment: 'node',
  transform: {},
  collectCoverageFrom: ['app.js'],
  coverageThreshold: {
    global: { statements: 70, functions: 70, lines: 70 }
  }
};