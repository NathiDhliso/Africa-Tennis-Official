/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  // Automatically clear mock calls and instances between every test
  clearMocks: true,
  // The directory where Jest should output its coverage files
  coverageDirectory: 'coverage',
  // A map from regular expressions to paths to transformers
  transform: {
    '^.+\\.ts?$': 'ts-jest',
  },
  // Only find tests in the source __tests__ directory
  testMatch: [
    "**/lambdas/__tests__/**/*.test.ts"
  ],
};