import { SyncTransformer } from '@jest/transform';
import * as path from 'path';

const SCMTransformer: SyncTransformer = {
    process(sourceText, sourcePath, options) {
        const basename = path.basename(sourcePath);
        return {
            code:
`"use strict";
//Object.defineProperty(exports, "__esModule", { value: true });
const fs_1 = require("fs");
const web_tree_sitter_1 = require("web-tree-sitter");
test('${basename}', () => {
    return web_tree_sitter_1.Parser.init()
        .then(() => {
        return web_tree_sitter_1.Language.load('resources/tree-sitter-query.wasm');
    })
        .then(language => {
        let parser = new web_tree_sitter_1.Parser();
        parser.setLanguage(language);
        const queryContents = (0, fs_1.readFileSync)('${sourcePath}', { encoding: 'utf-8' });
        const query = new web_tree_sitter_1.Query(language, queryContents);
        return query;
    })
        .then(query => {
        expect(query).toBeTruthy();
    });
});`,
            // code: '',
        };
    },
};

// `import { Parser, Language, Query } from 'web-tree-sitter';
// import { readFileSync } from 'fs';

// test('${basename}', () => {
//     return Parser.init()
//         .then(() => {
//             return Language.load('resources/tree-sitter-query.wasm');
//         })
//         .then(language => {
//             let parser = new Parser();
//             parser.setLanguage(language);
//             const queryContents = readFileSync('${sourcePath}', { encoding: 'utf-8' });
//             const query = new Query(language, queryContents);
//             return query;
//         })
//         .then(query => {
//             expect(query).toBeTruthy();
//         });
// });`

// import { Language, Query } from 'web-tree-sitter'

// test('hmmmm', () => {
//     const hmm = new Language('resources/tree-sitter-query.wasm').then(language => {
//         const contents = readFileSync('resources/queries/highlighting.scm', { encoding: 'utf-8' });
//         const query = new Query(language, contents);
//         expect(query).toBeTruthy();
//     });
// });

module.exports = SCMTransformer;
