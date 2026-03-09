/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  testMatch: ['**/metagrinder.test.ts'],
  collectCoverageFrom: [
    '<rootDir>/scripts/lib/metagrinder-mvp.js',
    '<rootDir>/scripts/lib/research-brief-preparser.js',
    '<rootDir>/services/researchIngest/index.js',
    '<rootDir>/services/researchReview/index.js',
    '<rootDir>/services/researchExtract/index.js',
    '<rootDir>/services/researchClassify/index.js',
    '<rootDir>/services/researchSynthesize/index.js',
    '<rootDir>/services/researchMutation/index.js',
    '<rootDir>/services/researchScore/index.js',
    '<rootDir>/services/researchPackage/index.js',
    '<rootDir>/services/researchPipeline/index.js'
  ],
  coverageThreshold: {
    global: {
      statements: 90,
      branches: 75,
      functions: 90,
      lines: 90
    }
  },
  transform: {
    '^.+\\.ts$': [
      'ts-jest',
      {
        tsconfig: '<rootDir>/tsconfig.json'
      }
    ]
  },
  moduleFileExtensions: ['ts', 'js', 'json'],
  clearMocks: true
};
