import { readFileSync } from 'fs';
import * as path from 'path';
import { Language, Parser, Query, QueryMatch, Tree } from 'web-tree-sitter';
import { ALL, LintName } from '../../src/lints';
import { TypeEnvironment } from '../../src/TypeEnvironment';

// let language: Language;
let parser: Parser;
let query: Query;
const RESOURCES_PATH: string = 'resources';

describe('Nominal lints', () => {
    beforeAll(async () => {
        await Parser.init();
        parser = new Parser();
        let language: Language = await Language.load(path.join(RESOURCES_PATH, 'tree-sitter-query.wasm'));
        parser.setLanguage(language);

        const queryString: string = readFileSync(path.join(RESOURCES_PATH, 'queries', 'linting.scm'), { encoding: 'utf-8' });
        query = new Query(language, queryString);
        return;
    }, 1000);
    test.each<[number, LintName, string]>([
        [0, 'empty-container', '[_ (_)]'],
        [0, 'empty-container', '([_ (_)])'],
        [1, 'empty-container', '[]'],
        [1, 'empty-container', '()'],
        [0, 'hanging-capture', '_ @capture'],
        [1, 'hanging-capture', '@'],
        [2, 'hanging-capture', '@@'],
        [1, 'missing-field-value', '(_ name:)'],
        [0, 'missing-parameters', '(#eq? @capture)'],
        [0, 'missing-parameters', '(#set! name)'],
        [1, 'missing-parameters', '(_(#eq?))'],
        [1, 'missing-parameters', '(_(#set!))'],
    ])(
        '%i %s',
        (expected, name, source) => {
            const lintClass = ALL.find(l => l.lintName === name);
            expect(lintClass).toBeDefined();
            let tree: Tree | null = parser.parse(source + '\n');
            expect(tree).not.toBeNull();
            let matches: QueryMatch[] = query.matches(tree!.rootNode);
            const lint = new lintClass!(TypeEnvironment.empty());
            const diagnostics = lint.lintMatches(matches);
            expect(diagnostics.length).toEqual(expected);
        },
        1000
    );
});
