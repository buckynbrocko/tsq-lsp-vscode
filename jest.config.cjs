/** @type {import('jest').Config} */
module.exports = {
    verbose: true,
    // cache: false,
    // watchPlugins: ['./server/out/src/query_watch_plugin.js'],

    transform: {
        '\\.ts$': 'ts-jest',
        // '\\.scm$': '<rootDir>/server/out/__tests__/transformQueries.js',
    },
    testEnvironment: 'node',
    testPathIgnorePatterns: ['out/*', 'NODE_TYPES.ts'],

    testMatch: ['**/server/__tests__/**/**.test.ts'],
    moduleDirectories: ['node_modules', 'server/node_modules'],
    onlyChanged: true,
    testTimeout: 1000,
    // watchAll: true,
    watch: true,

    moduleFileExtensions: [
        'ts',
        'tsx',
        'js',
        'jsx',
        'json',
        'node',
        'wasm',
        'scm',
        // 'scm', 'source', 'expectation'
    ],
};
