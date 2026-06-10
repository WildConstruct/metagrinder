/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/*.test.ts'],
  transform: {
    '^.+\\.ts$': [
      'ts-jest',
      {
        tsconfig: '<rootDir>/src/tsconfig.test.json'
      }
    ]
  },
  moduleFileExtensions: ['ts', 'js', 'json'],
  clearMocks: true
};
