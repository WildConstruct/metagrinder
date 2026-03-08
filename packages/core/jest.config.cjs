/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: 'jsdom',
  roots: ['<rootDir>/tests', '<rootDir>/components'],
  testMatch: ['**/*.test.ts', '**/*.test.tsx'],
  transform: {
    '^.+\\.[tj]sx?$': [
      'babel-jest',
      {
        rootMode: 'upward'
      }
    ]
  },
  transformIgnorePatterns: [
    '/node_modules/(?!.*(react-dnd|dnd-core|react-markdown|remark|rehype|unist|mdast|hast|micromark|mdurl|vfile|is-plain-obj|bail|devlop|trough|space-separated-tokens|comma-separated-tokens|property-information|decode-named-character-reference|character-entities|estree-util|html-url-attributes|trim-lines|unified))'
  ],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],
  moduleNameMapper: {
    '\\.(css|less|scss|sass)$': 'identity-obj-proxy',
    '^@/(.*)$': '<rootDir>/$1'
  },
  clearMocks: true,
  setupFilesAfterEnv: ['<rootDir>/tests/setupTests.ts']
};
