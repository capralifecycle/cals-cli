module.exports = {
  moduleNameMapper: {
    'package.json': '<rootDir>/package.json',
  },
  preset: 'ts-jest',
  testEnvironment: 'node',
  testResultsProcessor: 'jest-sonar-reporter',
}
