import { readFileSync, writeFileSync } from 'node:fs';
import * as path from 'node:path';
import { Language, Parser, Query } from 'web-tree-sitter';
import { formatMatches } from '../../src/formatting/formatMatches';
import { FormattingStyle } from '../../src/formatting/Style';
import { attemptEdits } from '../../src/TextEditSimulator';
import { initializeLanguage, loadQuery } from '../shared';

const corpusPath = path.join('server', '__tests__', 'formatting', 'corpus');
let language: Language;
let formattingQuery: Query;

function readCorpusSync(name: string): string {
    return readFileSync(path.join(corpusPath, name), { encoding: 'utf-8' });
}

function writeActualSync(name: string, content: string) {
    const actualPath = path.join(corpusPath, name + '.actual');
    writeFileSync(actualPath, content);
}

// describe('Parametric formatting', () => {

// })

describe('formatting', () => {
    beforeAll(async () => {
        language = await initializeLanguage();
        formattingQuery = loadQuery(language, 'formatting');
    });
    test.each(['0'])('default %s', name => {
        let initial = readCorpusSync(name + '.source');
        let expectation = readCorpusSync(name + '.expectation');
        // let formattingQuery = loadQuery(language, 'formatting');

        let parser = new Parser();
        parser.setLanguage(language);

        let rootNode = parser.parse(initial)?.rootNode;
        if (!rootNode) {
            throw 'tree was null';
        }

        let matches = formattingQuery.matches(rootNode);
        let captureNames = new Set(matches.flatMap(m => m.captures).map(c => c.name));
        expect(captureNames).toContain('program');
        expect(captureNames).toContain('field-definition');
        expect(captureNames).toContain('grouping');
        expect(captureNames).toContain('list');
        expect(captureNames).toContain('capture');
        expect(captureNames).toContain('list');
        expect(captureNames).toContain('list');

        // let edits = formatMatches(matches, indentationMap, FormattingStyle({ tabSize: 2 }));
        let edits = formatMatches(matches, FormattingStyle.default());
        expect(edits.length).toBeGreaterThan(0);

        let result = attemptEdits(initial, ...edits);
        expect(result).toBeDefined();

        !!result && writeActualSync(name, result);
        expect(result).toEqual(expectation);
    });
});
