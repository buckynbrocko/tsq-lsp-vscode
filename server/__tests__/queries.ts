import { readFileSync } from 'fs';
import * as path from 'path';
import { Language, Parser, Query } from 'web-tree-sitter';
import { newLanguage } from '../src/junk_drawer';

test('hmmmm', () => {
    return Parser.init()
        .then(() => {
            return Language.load('resources/tree-sitter-query.wasm');
        })
        .then(language => {
            let parser = new Parser();
            parser.setLanguage(language);
            const queryContents = readFileSync('resources/queries/highlighting.scm', { encoding: 'utf-8' });
            const query = new Query(language, queryContents);
            return query;
        })
        .then(query => {
            expect(query).toBeTruthy();
        });
});
let language: Language;

export async function initializeLanguage() {
    let languagePath: string = path.resolve(path.join('resources', 'tree-sitter-query.wasm'));
    language = await newLanguage(languagePath);
    return;
}

describe('queries', () => {
    beforeAll(() => {
        return initializeLanguage();
    });

    test.each(['linting', 'highlighting'])("'%s' query compilation", (name: string) => {
        let contents = readFileSync(path.join('resources', 'queries', name + '.scm'), { encoding: 'utf-8' });
        let query = new Query(language, contents);
        expect(query).toBeTruthy();
        // let initialized = (query as UninitializedQuery).initialize(language);
        // expect(initialized).toBeDefined();

        // try {
        //     let languagePath: string = path.resolve(path.join('..', 'resources', 'tree-sitter-query.wasm'));
        //     Parser.init().then(_ => {
        //         Language.load(languagePath)
        //             .then(language => {
        //                 Object.entries(queries).forEach(([name, query]) => {
        //                     try {
        //                         (query as UninitializedQuery).initialize(language);
        //                     } catch {

        //                     }
        //                     expect(isUninitializedQuery(query)).toBeTruthy();

        //                 })
        //                 Object.values(queries).forEach(query => {
        //                     if (isUninitializedQuery(query)) {
        //                         let initializedQuery = query.initialize(language);
        //                         expect(isUninitializedQuery(initializedQuery)).toBeFalsy();
        //                     } else {
        //                         fail();
        //                     }
        //                 });
        //                 done();
        //             })
        //             .catch(reason => {
        //                 console.error(reason);
        //             });
        //     });
        // } catch (error) {
        //     console.error(error);
        // }
    });
});
