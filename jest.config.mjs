export default {
  moduleNameMapper: {
    "^package.json$": "<rootDir>/package.json",

    // workaround: jest doesn't work well with lodash-es,
    // so map to cjs lodash during test
    "^lodash-es$": "lodash"
  },
  preset: 'ts-jest',
  testEnvironment: "node",
  transform: {},
}
