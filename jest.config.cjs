/** @type {import('jest').Config} */
module.exports = {
    verbose: true,
    // cache: false,
    // watchPlugins: [['<rootDir>/server/out/__tests__/watchQueries', {}]],

    transform: {
        '\\.ts$': 'ts-jest',
        // '\\.scm$': '<rootDir>/server/out/__tests__/transformQueries.js',
    },
    testEnvironment: 'node',
    testPathIgnorePatterns: ['out/*', 'NODE_TYPES.ts'],

    testMatch: ['**/server/__tests__/**/**.test.ts'],
    moduleDirectories: ['node_modules', 'server/node_modules'],
    onlyChanged: true,
    watch: true,
    watchAll: false,

    moduleFileExtensions: [
        'ts',
        'tsx',
        'js',
        'jsx',
        'json',
        'node',
        'wasm',
        // 'scm', 'source', 'expectation'
    ],
};
