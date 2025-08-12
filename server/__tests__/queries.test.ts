import { readFileSync } from 'fs';
import * as path from 'path';
import { Language, Parser, Query, QueryCapture } from 'web-tree-sitter';
import { newLanguage } from '../src/junk_drawer';
import { isNotNullish } from '../src/predicates';
import { TSNode } from '../src/reexports';
import { LSPRange } from '../src/reexports/LSPRange';
import { Capture } from '../src/TreeSitter';

let language: Language;

export async function initializeLanguage() {
    let languagePath: string = path.resolve(path.join('resources', 'tree-sitter-query.wasm'));
    language = await newLanguage(languagePath);
    return;
}

describe('Sanity', () => {
    beforeAll(() => {
        return initializeLanguage();
    });
    test.each([
        //
        'linting',
        'highlighting',
        'formatting',
    ])('%s.scm', (name: string) => {
        let contents = readFileSync(path.join('resources', 'queries', name + '.scm'), { encoding: 'utf-8' });
        let query = new Query(language, contents);
        expect(query).toBeTruthy();
        let parser = new Parser();
        parser.setLanguage(language);
        const tree = parser.parse(contents);
        expect(tree).not.toBeNull();
        const matches = query.matches(tree!.rootNode, { timeoutMicros: 5000 }); //.filter(match => !!match.captures.length);
        expect(matches.length).toBeGreaterThan(0);
    });

    test.failing('invalid.scm', () => {
        let queryContents = readFileSync(path.join('server', '__tests__', 'resources', 'invalid.scm'), { encoding: 'utf-8' });
        let query: Query = new Query(language, queryContents);
        expect(query).toBeDefined();
    });
});

describe.skip('queries', () => {
    beforeAll(() => {
        return initializeLanguage();
    });

    test.skip('scratch', () => {
        let queryContents = readFileSync(path.join('resources', 'queries', 'formatting3' + '.scm'), { encoding: 'utf-8' });
        let query = new Query(language, queryContents);
        expect(query).toBeTruthy();
        const parser = new Parser();
        parser.setLanguage(language);
        let highlightingContents = readFileSync(path.join('resources', 'queries', 'highlighting' + '.scm'), {
            encoding: 'utf-8',
        });
        const root = parser.parse(highlightingContents)?.rootNode;
        expect(root).toBeTruthy();
        let matches = query.matches(root!, { timeoutMicros: 5000 });
        expect(matches.length).toBeGreaterThan(0);

        for (let match of matches) {
            let parent = Capture.withName(match.captures, 'parent')?.node;
            let former = Capture.withName(match.captures, 'former')?.node;
            let latter = Capture.withName(match.captures, 'latter')?.node;
            match;
        }
        const triads: [QueryCapture, TSNode, TSNode][] = matches
            .map(match => match.captures)
            .map(captures => {
                let a: TSNode | undefined;
                let b: TSNode | undefined;
                let group = captures.at(0);
                switch (group?.name) {
                    case undefined:
                        return;
                    case 'contextual-pair':
                    case 'top-level-pair':
                        a = Capture.withName(captures, 'former')?.node;
                        b = Capture.withName(captures, 'latter')?.node;
                        break;
                    case 'connect-pair':
                    case 'space-pair':
                        a = Capture.withName(captures, 'from')?.node;
                        b = Capture.withName(captures, 'to')?.node;
                        break;
                    case 'comment.trailing':
                        a = Capture.withName(captures, 'before.comment')?.node;
                        b = Capture.withName(captures, 'comment')?.node;
                        break;
                    case 'comment.leading':
                        a = Capture.withName(captures, 'comment')?.node;
                        b = Capture.withName(captures, 'after.comment')?.node;
                        break;
                    default:
                        console.debug(`Forgot case "${group?.name}"`);
                }

                if (group?.node && !!a && !!b) {
                    return [group, a, b] as [QueryCapture, TSNode, TSNode];
                }
                return;
            })
            .filter(isNotNullish);

        for (let [g, a, b] of triads) {
            let summary = `${g.name}: ${TSNode.presentType(a)} · ${TSNode.presentType(b)}`;
            let range = LSPRange.present(LSPRange.betweenNodes(a, b));
            triads;
        }

        let summaries = triads.map(([g, a, b]) => `${g.name}: ${TSNode.presentType(a)} · ${TSNode.presentType(b)}`);
        expect(summaries.length).toBeGreaterThan(0);
    });
});
