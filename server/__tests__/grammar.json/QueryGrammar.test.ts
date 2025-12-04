import { Language, Parser, Query } from 'web-tree-sitter';
import { Grammar } from '../../src/Grammar';
import { NodeType, NodeTypes } from '../../src/node_types';
import { QueryDiagnostician } from '../../src/QueryDiagnostician';
// import * as  from '../../src/RuleJSON';
import { GrammarJSON } from '../../src/Grammar';
import { QueryFile } from '../../src/QueryFile';
// import { FlatGrammar } from '../../src/untitled';
import { Issue } from '../../src/Issue';
import * as luaGrammarJSON from '../resources/lua/grammar.json';
import * as luaNodeTypesJSON from '../resources/lua/node-types.json';
import * as TSQGrammarJSON from '../resources/tree-sitter-query/grammar.json';
import * as TSQNodeTypesJSON from '../resources/tree-sitter-query/node-types.json';
import { initializeLanguage, readTestingResource } from '../shared';

type Thing = {
    nodeTypes: NodeTypes.Categorized;
    grammarJSON: GrammarJSON;
    queryGrammar: Grammar;
    language: Language;
    parser: Parser;
    diagnostician: QueryDiagnostician;
};

let TSQ: Thing;

async function loadThing(grammarJSON: GrammarJSON, nodeTypes_: NodeType[], wasmFileName: string) {
    await Parser.init();
    let nodeTypes = new NodeTypes.Categorized(nodeTypes_);
    let language = await initializeLanguage(wasmFileName);
    let parser = new Parser();
    parser.setLanguage(language);
    let queryGrammar = new Grammar(grammarJSON);
    let shit: Thing = {
        nodeTypes,
        grammarJSON,
        queryGrammar,
        language,
        parser,
        diagnostician: new QueryDiagnostician(queryGrammar),
    };
    return shit;
}

type LanguageTestInfo = {
    name: string;
    wasmFileName: string;
    validQueryFileBasenames?: [string, ...string[]];
    invalidQueryFileBasenames?: [string, ...string[]];
    grammarJSON: GrammarJSON;
    nodeTypes: NodeType[];
};

const TSQ_LANGUAGE_INFO: LanguageTestInfo = {
    name: 'tree-sitter-query',
    wasmFileName: 'tree-sitter-query.wasm',
    validQueryFileBasenames: ['highlights', 'injections'],
    invalidQueryFileBasenames: ['invalid'],
    grammarJSON: TSQGrammarJSON as GrammarJSON,
    nodeTypes: TSQNodeTypesJSON as NodeType[],
};

let LANGUAGES: LanguageTestInfo[] = [
    TSQ_LANGUAGE_INFO,
    {
        name: 'lua', //
        wasmFileName: 'tree-sitter-lua.wasm',
        validQueryFileBasenames: ['highlights', 'etc', 'injections', 'locals', 'tags'],
        invalidQueryFileBasenames: ['invalid'],
        grammarJSON: luaGrammarJSON as GrammarJSON,
        nodeTypes: luaNodeTypesJSON as NodeType[],
    },
];

let LANGUAGE: Thing;
describe.each(LANGUAGES.map(o => [o.name, o]))('%s', (name: string, testInfo: LanguageTestInfo) => {
    beforeAll(() => {
        return (async () => {
            LANGUAGE = await loadThing(testInfo.grammarJSON, testInfo.nodeTypes, testInfo.wasmFileName);
            if (name === 'tree-sitter-query') {
                TSQ = LANGUAGE;
            } else {
                TSQ = await loadThing(TSQ_LANGUAGE_INFO.grammarJSON, TSQ_LANGUAGE_INFO.nodeTypes, 'tree-sitter-query.wasm');
            }
        })();
    });

    describe('grammar/node-types parity', () => {
        test('strings', () => {
            let grammar = LANGUAGE.queryGrammar.literals;
            let nodeTypes = new Set(LANGUAGE.nodeTypes.literals.map(node => node.type));
            expect(grammar).toEqual(nodeTypes);
        });
    });
    test('getByID', () => {
        expect(LANGUAGE.queryGrammar.IDs).not.toHaveLength(0);
        let failures: number[] = [];
        for (let id of LANGUAGE.queryGrammar.IDs) {
            if (id !== LANGUAGE.queryGrammar.getByID(id)?.id) {
                failures.push(id);
            }
        }
        expect(failures).toHaveLength(0);
    });
    test('parent.id = child.parent.id', () => {
        expect(LANGUAGE.queryGrammar.rules).not.toHaveLength(0);

        let failures: [number, number][] = [];
        for (let rule of LANGUAGE.queryGrammar.rules) {
            if (rule.parent && !rule.parent.directChildren.map(c => c.id).includes(rule.id)) {
                failures.push([rule.parent.id, rule.id]);
            }
            for (let child of rule.directChildren) {
                if (rule.id !== child.parent?.id) {
                    failures.push([rule.id, child.id]);
                }
            }
        }
        expect(failures).toHaveLength(0);
    });

    if (!!testInfo.validQueryFileBasenames || !!testInfo.invalidQueryFileBasenames) {
        describe('Validation/Parity', () => {
            let queryFile: QueryFile;
            if (!!testInfo.validQueryFileBasenames) {
                describe.each(testInfo.validQueryFileBasenames)('valid - %s.scm', (basename: string) => {
                    beforeAll(() => {
                        let contents = readTestingResource(testInfo.name, 'queries', basename + '.scm');
                        let tree = TSQ.parser.parse(contents)!;
                        queryFile = QueryFile.fromTree(tree, LANGUAGE.queryGrammar);
                        return (async () => {})();
                    });
                    test('baseline', () => {
                        expect(LANGUAGE.queryGrammar.rules).not.toHaveLength(0);
                        let failures: string[] = [];
                        for (let node of queryFile.topLevelNodes) {
                            let query;
                            try {
                                query = new Query(LANGUAGE.language, node.node.text);
                            } catch {}
                            if (query === undefined) {
                                failures.push(`line ${node.node.startPosition.row + 1}`);
                            }
                            query = undefined;
                        }
                        expect(failures).toHaveLength(0);
                    });
                    test('parity', () => {
                        expect(LANGUAGE.queryGrammar.rules).not.toHaveLength(0);
                        let failures: Issue[] = [];
                        for (let node of queryFile.yieldNodes()) {
                            let issues = LANGUAGE.diagnostician.diagnoseDefinition(node);
                            // let issues = LANGUAGE.queryGrammar.diagnoseMetaNode(node);
                            failures.push(...issues);
                        }
                        let failureStrings = failures.map(issue => issue.toString());
                        expect(failureStrings).toHaveLength(0);
                    });
                });
            }
            if (!!testInfo.invalidQueryFileBasenames) {
                describe.each(testInfo.invalidQueryFileBasenames)('invalid - %s.scm', (basename: string) => {
                    beforeAll(() => {
                        let contents = readTestingResource(testInfo.name, 'queries', basename + '.scm');
                        let tree = TSQ.parser.parse(contents)!;
                        queryFile = QueryFile.fromTree(tree, LANGUAGE.queryGrammar);
                        return (async () => {})();
                    });
                    test('baseline', () => {
                        expect(LANGUAGE.queryGrammar.rules).not.toHaveLength(0);
                        let invalidSuccesses: string[] = [];
                        for (let node of queryFile.topLevelNodes) {
                            let query;
                            try {
                                query = new Query(LANGUAGE.language, node.node.text);
                            } catch {}
                            if (query !== undefined) {
                                invalidSuccesses.push(`line ${node.node.startPosition.row + 1}`);
                            }
                            query = undefined;
                        }
                        expect(invalidSuccesses).toHaveLength(0);
                    });
                    test('parity', () => {
                        expect(LANGUAGE.queryGrammar.rules).not.toHaveLength(0);
                        let invalidSuccesses: string[] = [];
                        for (let node of queryFile.topLevelNodes) {
                            let issues = LANGUAGE.diagnostician.diagnoseDefinition(node);
                            if (!issues.length) {
                                invalidSuccesses.push(`line ${node.node.startPosition.row + 1} -> ${node.format()}`);
                            }
                        }
                        expect(invalidSuccesses).toHaveLength(0);
                    });
                });
            }
        });
    }
});
