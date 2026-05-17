/** @type {import('jest').Config} */
module.exports = {
  preset: 'jest-preset-angular',
  setupFilesAfterEnv: ['<rootDir>/setup-jest.ts'],
  roots: ['<rootDir>/src'],
  modulePaths: ['<rootDir>'],
  collectCoverageFrom: ['src/app/**/*.ts', '!src/app/**/*.module.ts', '!src/main.ts'],
};
