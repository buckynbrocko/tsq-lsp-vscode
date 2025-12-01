import { Language, Parser, Query, Tree } from 'web-tree-sitter';
import { NodeType, NodeTypes } from '../../src/node_types';
import { isNotNullish } from '../../src/predicates';
import { QueryGrammar } from '../../src/QueryGrammar';
import { TSNode } from '../../src/reexports/TSNode';
import { Rule } from '../../src/Rule';
// import * as  from '../../src/RuleJSON';
import { Grammar, GrammarJSON } from '../../src/Grammar';
import { firstOf, uniqueByID } from '../../src/itertools';
import Definition, { QueryFile } from '../../src/MetaNode';
import RuleJSON from '../../src/RuleJSON';
import { Terminality } from '../../src/Terminality';
// import { FlatGrammar } from '../../src/untitled';
import { Issue } from '../../src/Issue';
import * as luaGrammarJSON from '../resources/lua/grammar.json';
import * as luaNodeTypesJSON from '../resources/lua/node-types.json';
import * as TSQGrammarJSON from '../resources/tree-sitter-query/grammar.json';
import * as TSQNodeTypesJSON from '../resources/tree-sitter-query/node-types.json';
import { initializeLanguage, readTestingResource, readTestingResource as readTestingResourceSync } from '../shared';

type Shit = {
    nodeTypes: NodeTypes.Categorized;
    grammarJSON: GrammarJSON;
    grammar: Grammar;
    queryGrammar: QueryGrammar;
    language: Language;
    parser: Parser;
};

let LUA: Shit;
let TSQ: Shit;

async function loadShit(grammarJSON: GrammarJSON, nodeTypes_: NodeType[], wasmFileName: string) {
    await Parser.init();
    let nodeTypes = new NodeTypes.Categorized(nodeTypes_);
    let language = await initializeLanguage(wasmFileName);
    let parser = new Parser();
    parser.setLanguage(language);
    let shit: Shit = {
        nodeTypes,
        grammarJSON,
        grammar: new Grammar(grammarJSON, nodeTypes),
        queryGrammar: new QueryGrammar(grammarJSON),
        language,
        parser,
    };
    return shit;
}

async function asyncSetup() {
    LUA = await loadShit(luaGrammarJSON as GrammarJSON, luaNodeTypesJSON as NodeType[], 'tree-sitter-lua.wasm');
    TSQ = await loadShit(TSQGrammarJSON as GrammarJSON, TSQNodeTypesJSON as NodeType[], 'tree-sitter-query.wasm');
    return;
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

let LANGUAGE: Shit;
describe.each(LANGUAGES.map(o => [o.name, o]))('%s', (name: string, testInfo: LanguageTestInfo) => {
    beforeAll(() => {
        return (async () => {
            LANGUAGE = await loadShit(testInfo.grammarJSON, testInfo.nodeTypes, testInfo.wasmFileName);
            if (name === 'tree-sitter-query') {
                TSQ = LANGUAGE;
            } else {
                TSQ = await loadShit(TSQ_LANGUAGE_INFO.grammarJSON, TSQ_LANGUAGE_INFO.nodeTypes, 'tree-sitter-query.wasm');
            }
        })();
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
                            let issues = LANGUAGE.queryGrammar.diagnoseMetaNode(node);
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
                            let issues = LANGUAGE.queryGrammar.diagnoseMetaNode(node);
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

describe.skip('lua - old', () => {
    beforeAll(() => {
        return asyncSetup();
    });

    describe('Grammar', () => {
        test('.ruleNames', () => {
            let names = LUA.grammar.ruleNames;
            expect(names.length).toBeGreaterThan(0);
        });

        test.each<[string, number, RuleJSON['type'] | undefined]>([
            ['chunk', 0, 'CHOICE'],
            ['chunk', 1, 'REPEAT'],
            ['chunk', 2, 'CHOICE'],
            ['chunk', 3, undefined],
            ['hash_bang_line', 1, undefined],
        ])('%s[%i] = %s', (name: string, index: number, expectation: RuleJSON['type'] | undefined) => {
            let rule = LUA.grammar.ruleFor(name);
            expect(rule).toBeDefined();
            let indexed = LUA.grammar.subStateFromIndex(rule!, index);
            expect(indexed?.type).toStrictEqual(expectation);
        });

        test.each<[string, [number, ...number[]], RuleJSON['type'] | string | undefined]>([
            ['chunk', [0], 'CHOICE'],
            ['chunk', [1], 'REPEAT'],
            ['chunk', [2], 'CHOICE'],
            ['chunk', [3], undefined],
            ['chunk', [0, 0], 'SYMBOL'],
            ['chunk', [0, 1], 'BLANK'],
            ['chunk', [1, 0], 'SYMBOL'],
            ['chunk', [1, 0, 0], 'SYMBOL'],
            ['chunk', [1, 0, 11, 0], 'function_declaration'],
            ['chunk', [1, 0, 11, 0, 0], 'STRING'],
            ['hash_bang_line', [1], undefined],
            ['_block', [0, 1, 0], 'SYMBOL'],
            ['_block', [0, 1, 1], 'BLANK'],
        ])('%s%j = %s', (name: string, indices: [number, ...number[]], expectation: RuleJSON['type'] | string | undefined) => {
            let rule = LUA.grammar.ruleFor(name);
            expect(rule).toBeDefined();
            let indexed = LUA.grammar.subStateFromIndices(rule!, indices);
            if (!!indexed && !!expectation && indexed.type !== expectation) {
                console.error(indexed);
            }
            if (!!expectation && !RuleJSON.TYPES.includes(expectation as RuleJSON['type']) && !!indexed && 'name' in indexed) {
                expect(indexed?.type).toStrictEqual('SYMBOL');
                expect(indexed.name as string).toStrictEqual(expectation);
            } else {
                expect(indexed?.type).toStrictEqual(expectation);
            }
        });

        test.each<[string, [number, ...number[]], string]>([
            ['chunk', [0, 0], 'hash_bang_line'],
            ['chunk', [1, 0], 'statement'],
            ['chunk', [1, 0, 0], 'empty_statement'],
            ['chunk', [1, 0, 1], 'assignment_statement'],
        ])("%s%j.name = '%s'", (name: string, indices: [number, ...number[]], expectation: string) => {
            let rule = LUA.grammar.ruleFor(name);
            expect(rule).toBeDefined();
            let indexed = LUA.grammar.subStateFromIndices(rule!, indices);
            if (!indexed) {
                return;
            }
            expect(indexed.type).toStrictEqual('SYMBOL');
            if (indexed.type !== 'SYMBOL') {
                return;
            }
            if (!!indexed && !!expectation && indexed.name !== expectation) {
                console.error(indexed);
            }
            expect(indexed?.name).toStrictEqual(expectation);
        });
    });

    // let fg: FlatGrammar;
    // describe.skip('FlatGrammar', () => {
    //     test('FlatGrammar.get(%i)', () => {
    //         // let fg = new FlatGrammar(lua.grammar);
    //         for (let id of IntegerRange(fg.stubs.length)) {
    //             let node = fg.get(id);
    //             expect(node).toBeDefined();
    //             expect(node!.id).toEqual(id);
    //         }
    //     });
    //     test.each([
    //         //
    //         [0, [66, 67, 68]],
    //     ])('FlatGrammar.getChildrenOf(%i) -> %o', (id: number, expectation: number[]) => {
    //         // let fg = new FlatGrammar(lua.grammar);
    //         let node = fg.get(id);
    //         expect(node).toBeDefined();
    //         let result = fg.getChildrenOf(node).map(child => child.id);
    //         expect(result).toEqual(expectation);
    //     });
    //     test.each([
    //         //
    //         [0, undefined],
    //         [66, 67],
    //         [67, 68],
    //         [68, undefined],
    //     ])('FlatGrammar.getNextSibling(%i) -> %o', (id: number, expectation: number | undefined) => {
    //         // let fg = new FlatGrammar(lua.grammar);
    //         let node = fg.get(id);
    //         expect(node).toBeDefined();
    //         let result = fg.getNextSibling(node);
    //         expect(result?.id).toEqual(expectation);
    //     });
    //     test.each([
    //         //
    //         [0, []],
    //         [67, [266, 267]],
    //     ])('nextTerminals(%i)', (id: number, expectation: number[]) => {
    //         // let fg = new FlatGrammar(lua.grammar);
    //         let node = fg.get(id);
    //         expect(node).toBeDefined();
    //         let result = fg.nextPseudoTerminals(node).map(child => child.id);
    //         expect(result).toEqual(expectation);
    //     });
    // });

    describe('QueryGrammar', () => {
        // test('getByID', () => {
        //     let failures: number[] = [];
        //     for (let id of LUA.queryGrammar.IDs) {
        //         if (id !== LUA.queryGrammar.getByID(id)?.id) {
        //             failures.push(id);
        //         }
        //     }
        //     expect(failures).toHaveLength(0);
        // });

        // test('parent.id = child.parent.id', () => {
        //     let failures: [number, number][] = [];
        //     for (let rule of LUA.queryGrammar.rules) {
        //         if (rule.parent && !rule.parent.directChildren.map(c => c.id).includes(rule.id)) {
        //             failures.push([rule.parent.id, rule.id]);
        //         }
        //         for (let child of rule.directChildren) {
        //             if (rule.id !== child.parent?.id) {
        //                 failures.push([rule.id, child.id]);
        //             }
        //         }
        //     }
        //     expect(failures).toHaveLength(0);
        // });

        test.each<[number, string, ...number[]]>([
            [3, 'chunk', 0, 0], //
            [3, 'chunk', 0, 1],
            [3, 'chunk', 1, 0],
            [0, 'chunk', 2, 0],
            [0, 'chunk', 2, 1],
            [0, 'hash_bang_line'],
        ])('subsequentTerminals %$', (expectedLength: number, ...path: [string, ...number[]]) => {
            // let path: [string, ...number[]] = ['chunk', 0];
            // let expectedLength: number = 2;

            let rule = LUA.queryGrammar.getTopLevelRule(...path);
            expect(rule).toBeDefined();

            let subsequent = rule!.subsequentTerminals();
            expect(subsequent).toHaveLength(expectedLength);
        });

        describe('Validation & Parity', () => {
            const HANDLED_TYPES = ['named_node', 'list', 'anonymous_node', 'field_definition'];
            const UNHANDLED_TYPES = ['grouping', 'missing_node'];
            const IGNORED_TYPES = ['comment'];
            let queryFile: QueryFile;
            let nodes: Definition[] = [];
            async function initializeQueryFile(...pathParts: [string, ...string[]]) {
                let tree = TSQ.parser.parse(readTestingResourceSync(...pathParts));
                if (!tree) {
                    fail(`Failed to load query file at ${pathParts.join('/')}`);
                    // throw '';
                }
                queryFile = QueryFile.fromTree(tree, LUA.queryGrammar);
                nodes = queryFile?.topLevelNodes ?? [];
            }
            describe('lets try this again', () => {
                beforeAll(() => {
                    return initializeQueryFile('lua', 'queries', 'invalid.scm');
                });
                test('----- baseline', () => {
                    expect(queryFile.topLevelNodes).not.toHaveLength(0);
                    let failures: string[] = [];
                    for (let node of queryFile.topLevelNodes) {
                        let query: Query | undefined;
                        try {
                            query = new Query(LUA.language, node.node.text);
                        } catch {}
                        if (!!query) {
                            failures.push(`line ${node.node.startPosition.row + 1} -> ${node.format()}`);
                        }
                    }
                    expect(failures).toHaveLength(0);
                });

                // describe.each([...nodes])('hmmm %$', (node: MetaNode) => {
                //     test('uhhhh %$', () => {
                //         expect(node).toBeDefined();
                //     });
                // });
            });
            // describe('invalid.scm', () => {
            //     // let nodes: MetaNode[] = [];
            //     let queryFile: QueryFile | undefined;
            //     beforeAll(() => {
            //         queryFile = QueryFile.tryFromTree(
            //             LUA.parser.parse(readTestingResourceSync('lua', 'queries', 'invalid.scm')) ?? undefined,
            //             LUA.queryGrammar
            //         );
            //         nodes = queryFile?.topLevelNodes ?? [];
            //     });
            //     // let chunks: string[] = readTestingResourceSync('lua', 'queries', 'invalid.scm').split('\n\n');
            //     describe('baseline', () => {
            //         beforeAll(() => {});
            //         test.each([...nodes])('#%$ baseline', (node: MetaNode) => {
            //             let query: Query | undefined;
            //             try {
            //                 query = new Query(LUA.language, node.node.text);
            //             } catch {}
            //             expect(query).not.toBeDefined();
            //         });
            //     });
            //     describe('parity', () => {
            //         test.each([...nodes])('#%$ parity', (node: MetaNode) => {
            //             // let node = TSQ.parser.parse(node)?.rootNode?.firstChild ?? undefined;
            //             // if (!node) {
            //             //     fail("'node' is undefined");
            //             // }
            //             if (HANDLED_TYPES.includes(node.nodeType)) {
            //                 let issues = LUA.queryGrammar.diagnoseMetaNode(node);
            //                 let strings = issues.map(i => i.toString());
            //                 expect(strings).not.toHaveLength(0);
            //             } else if (!UNHANDLED_TYPES.includes(node.nodeType) && !IGNORED_TYPES.includes(node.nodeType)) {
            //                 fail(`Unhandled node of type "${node.nodeType}"`);
            //             }
            //         });
            //     });
            // });
            describe.each(['highlights', 'injections', 'locals', 'tags', 'etc'])(`%s.scm`, fileBaseName => {
                let chunks: string[] = readTestingResourceSync('lua', 'queries', fileBaseName + '.scm').split('\n\n');
                describe('baseline', () => {
                    test.each([...chunks])('%$', (chunk: string) => {
                        let query = new Query(LUA.language, chunk);
                        expect(query).toBeDefined;
                    });
                });

                describe('parity', () => {
                    test.each([...chunks])('%$', (chunk: string) => {
                        let node = TSQ.parser.parse(chunk)?.rootNode?.firstChild ?? undefined;
                        if (!node) {
                            fail("'node' is undefined");
                        }
                        if (HANDLED_TYPES.includes(node.type)) {
                            let issues = LUA.queryGrammar.diagnoseTopLevelTSNode(node);
                            expect(issues.map(i => i.toString())).toHaveLength(0);
                        } else if (!UNHANDLED_TYPES.includes(node.type) && !IGNORED_TYPES.includes(node.type)) {
                            fail(`Unhandled node of type "${node.type}"`);
                        }
                    });
                });
                const VALID_QUERIES = [
                    ['(chunk (hash_bang_line))'], //
                    ['(chunk (hash_bang_line) (statement) (return_statement))'], //
                    ['(chunk (hash_bang_line) (statement) (statement) (return_statement))'], //
                    ['(chunk (hash_bang_line)+)'], //
                    ['(chunk (statement) (return_statement))'],
                    ['(chunk (hash_bang_line) (statement) (return_statement))'],
                    ['(return_statement "return" ";")'],
                    ['(variable_list (attribute "<" @punctuation.bracket (identifier) @attribute ">" @punctuation.bracket))'],
                    // [
                    //     '(assignment_statement (variable_list . name: [(identifier) @function (dot_index_expression field: (identifier) @function) ]) (expression_list . value: (function_definition)))',
                    // ],
                    ['(attribute "<" ">")'],
                    ['(chunk (empty_statement))'],
                    ['(chunk (function_declaration))'],
                    ['(chunk (hash_bang_line) (comment))'],
                ];
                test.each(VALID_QUERIES)('Valid Query - tree-sitter %$', (source: string) => {
                    let query = new Query(LUA.language, source);
                    expect(query).toBeDefined();
                });

                test.each(VALID_QUERIES)('Valid Parity Check %$', (source: string) => {
                    let tree: Tree | null = TSQ.parser.parse(source);
                    expect(tree).not.toBeNull();

                    let pattern: TSNode | undefined = tree?.rootNode.firstChild ?? undefined;
                    expect(pattern).toBeDefined();

                    // let passes: boolean = LUA.queryGrammar.namedNodeIsValid(pattern!);
                    // expect(passes).toBeTruthy();
                });

                const INVALID_QUERIES = [
                    ['(chunk (hash_bang_line) (hash_bang_line))'], //
                    ['(chunk (statement) (hash_bang_line))'],
                    ['(chunk (return_statement) (statement))'],
                    ['(chunk (return_statement) (hash_bang_line))'],
                    ['(chunk (return_statement) (return_statement))'],
                    ['(return_statement ";" "return")'],
                    ['(return_statement ";" ";")'],
                    ['(attribute ">" "<")'],
                    ['(attribute _ "<")'],
                    ['(chunk (comment) (hash_bang_line))'],
                ];
                test.each(INVALID_QUERIES)('Invalid Query - tree-sitter %$', (source: string) => {
                    expect(() => new Query(LUA.language, source)).toThrow();
                });

                test.each(INVALID_QUERIES)('Invalid Parity Check %$', (source: string) => {
                    let tree: Tree | null = TSQ.parser.parse(source);
                    expect(tree).not.toBeNull();

                    let pattern: TSNode | undefined = tree?.rootNode.firstChild ?? undefined;
                    expect(pattern).toBeDefined();

                    // let passes: boolean = LUA.queryGrammar.namedNodeIsValid(pattern!);
                    // expect(passes).toBeFalsy();
                });
            });

            test.each<[string, number] | [string, number, number]>([
                ['chunk', 5], //
                ['hash_bang_line', 1, 0],
                ['_block', 5],
                ['statement', 12],
                ['return_statement', 5],
                ['empty_statement', 1, 0],
                ['assignment_statement', 3],
            ])(
                '(thisOr)terminalDescendants: %s %i %i',
                (name: string, expectedThisOr: number, expectedTerminalDescendants: number | undefined = undefined) => {
                    let rule = LUA.queryGrammar.topLevelRules.get(name);
                    expect(rule).toBeDefined();

                    expectedTerminalDescendants = expectedTerminalDescendants ?? expectedThisOr;
                    expect(typeof expectedTerminalDescendants).toEqual('number');

                    let thisOr = rule?.thisOrTerminalDescendants() ?? [];
                    expect(thisOr).toHaveLength(expectedThisOr);
                    for (let terminal of thisOr) {
                        expect(terminal.terminality).not.toStrictEqual(Terminality.NonTerminal);
                    }

                    let TerminalDescendants: Rule[] = rule?.terminalDescendants() ?? [];
                    expect(typeof TerminalDescendants).toEqual('object');
                    expect(TerminalDescendants).toHaveLength(expectedTerminalDescendants);
                    for (let terminal of TerminalDescendants) {
                        expect(terminal.terminality).not.toEqual(Terminality.NonTerminal);
                    }
                }
            );
        });

        describe('Rule', () => {
            test.each([
                ['_?', 0], //
                ['_*', 0],
            ])('match Blank "%s"', (source: string, ...indices: number[]) => {
                let tree = TSQ.parser.parse(source) ?? undefined;
                expect(tree).toBeDefined();

                let node: TSNode | undefined = tree!.rootNode ?? undefined;
                for (let index of indices) {
                    node = (node?.children ?? []).filter(isNotNullish).at(index);
                }
                expect(node).toBeDefined();

                const rule = LUA.queryGrammar.getTopLevelRule('chunk')?.children.at(0)?.children.at(1) ?? undefined;
                expect(rule).toBeDefined();
                expect(rule!.type).toStrictEqual('BLANK');

                let result = rule!.matchesTerminalNode(node!);
                expect(result).toBeTruthy();
            });
            test.each([
                ['_', 0], //
                ['_+', 0],
            ])('!match Blank "%s"', (source: string, ...indices: number[]) => {
                let tree = TSQ.parser.parse(source) ?? undefined;
                expect(tree).toBeDefined();

                let node: TSNode | undefined = tree!.rootNode ?? undefined;
                for (let index of indices) {
                    node = (node?.children ?? []).filter(isNotNullish).at(index);
                }
                expect(node).toBeDefined();

                const rule = LUA.queryGrammar.topLevelRules.get('chunk')?.children.at(0)?.children.at(1) ?? undefined;
                expect(rule).toBeDefined();
                expect(rule!.type).toStrictEqual('BLANK');

                let result = rule!.matchesTerminalNode(node!);
                expect(result).toBeFalsy();
            });

            test('Underscore shenanegans', () => {
                let tsNode =
                    TSQ.parser
                        .parse(
                            `(variable_list
                                        (attribute
                                            "<" @punctuation.bracket
                                            (identifier) @attribute
                                            ">" @punctuation.bracket))`
                        )
                        ?.rootNode?.child(0) ?? undefined;
                expect(tsNode).toBeDefined();
                let variableList = Definition.NamedNode.tryFrom(tsNode!, LUA.queryGrammar);
                expect(variableList).toBeDefined();
                let attribute = firstOf(variableList?.children() ?? []);
                expect(attribute).toBeDefined;
                if (attribute?.nodeType !== 'named_node') {
                    fail(attribute?.nodeType);
                }
                expect(attribute!.name).toStrictEqual('attribute');
                let rules = LUA.queryGrammar.getByName('variable_list') ?? [];
                let allTerminals: Rule[] = [];
                for (let rule of rules) {
                    let terminals = rule.terminalDescendants();
                    allTerminals.push(...terminals);
                }
                // rules.flatMap(r => r.terminalDescendants());
                allTerminals = uniqueByID(allTerminals);
                expect(allTerminals).not.toHaveLength(0);
                let matching = allTerminals.filter(rule => rule.matchesMetaNode(attribute!));
                expect(matching).not.toHaveLength(0);
            });

            test.each([
                ['"return"', 'return_statement', [0], [0]], //
                ['"return" ";"', 'return_statement', [1], [2, 0]],
                ['";"', 'empty_statement', [0], []],
                ['"="', 'assignment_statement', [0], [1]],
            ])('match String %s', (source: string, ruleName: string, nodeIndices: number[], ruleIndices: number[]) => {
                let tree = TSQ.parser.parse(source) ?? undefined;
                expect(tree).toBeDefined();

                let node: TSNode | undefined = tree!.rootNode ?? undefined;
                for (let index of nodeIndices) {
                    node = (node?.children ?? []).filter(isNotNullish).at(index);
                }
                expect(node).toBeDefined();

                let rule = LUA.queryGrammar.topLevelRules.get(ruleName);
                for (let index of ruleIndices) {
                    rule = rule?.children.at(index);
                }

                expect(rule).toBeDefined();
                expect(rule!.type).toStrictEqual('STRING');

                let result = rule!.matchesTerminalNode(node!);
                expect(result).toBeTruthy();
            });
            test.each([
                ['"#bee-boo-boo-bop"', 'hash_bang_line', [0], []], //
                ['"ull"', 'number', [0], [0, 0, 0, 1]],
                ['"ULL"', 'number', [0], [0, 0, 0, 1]],
                ['"uLl"', 'number', [0], [0, 0, 0, 1]],
                ['"UlL"', 'number', [0], [0, 0, 0, 1]],
                ['"ulL"', 'number', [0], [0, 0, 0, 1]],
                ['"Ull"', 'number', [0], [0, 0, 0, 1]],
            ])('match Pattern %s', (source: string, ruleName: string, nodeIndices: number[], ruleIndices: number[]) => {
                let tree = TSQ.parser.parse(source) ?? undefined;
                expect(tree).toBeDefined();

                let node: TSNode | undefined = tree!.rootNode ?? undefined;
                for (let index of nodeIndices) {
                    node = (node?.children ?? []).filter(isNotNullish).at(index);
                }
                expect(node).toBeDefined();

                let rule = LUA.queryGrammar.topLevelRules.get(ruleName);
                for (let index of ruleIndices) {
                    rule = rule?.children.at(index);
                }

                expect(rule).toBeDefined();
                expect(rule!.type).toStrictEqual('PATTERN');

                let result = rule!.matchesTerminalNode(node!);
                expect(result).toBeTruthy();
            });
            test.each([
                ['(hash_bang_line)', 'chunk', [0], [0, 0]], //
                ['(statement)', 'chunk', [0], [1, 0]],
                ['(return_statement)', 'chunk', [0], [2, 0]],
            ])('match Symbol %s', (source: string, ruleName: string, nodeIndices: number[], ruleIndices: number[]) => {
                let tree = TSQ.parser.parse(source) ?? undefined;
                expect(tree).toBeDefined();

                let node: TSNode | undefined = tree!.rootNode ?? undefined;
                for (let index of nodeIndices) {
                    node = (node?.children ?? []).filter(isNotNullish).at(index);
                }
                expect(node).toBeDefined();

                let rule = LUA.queryGrammar.topLevelRules.get(ruleName);
                for (let index of ruleIndices) {
                    rule = rule?.children.at(index);
                }

                expect(rule).toBeDefined();
                expect(rule!.type).toStrictEqual('SYMBOL');

                let result = rule!.matchesTerminalNode(node!);
                expect(result).toBeTruthy();
            });
            test.each([
                ['chunk', '(chunk (hash_bang_line) (statement) (return_statement))'], //
            ])('match Symbol %s', (ruleName: string, source: string) => {
                let tree = TSQ.parser.parse(source) ?? undefined;
                expect(tree).toBeDefined();

                let node: TSNode | undefined = tree!.rootNode.children?.at(0) ?? undefined;
                // for (let index of nodeIndices) {
                //     node = (node?.children ?? []).filter(isNotNullish).at(index);
                // }
                expect(node).toBeDefined();

                let rule = LUA.queryGrammar.topLevelRules.get(ruleName);
                // for (let index of ruleIndices) {
                //     rule = rule?.children.at(index);
                // }
                expect(rule).toBeDefined();

                // expect(rule!.type).toStrictEqual('SYMBOL');

                // let result = rule!.matchesTerminalNode(node!);
                // expect(result).toBeTruthy();
            });
        });
    });
});

describe('terminals', () => {
    let queryGrammar: QueryGrammar;
    beforeAll(() => {
        queryGrammar = new QueryGrammar(luaGrammarJSON as GrammarJSON);
    });
    type RuleNames = keyof (typeof luaGrammarJSON)['rules'];
    describe('.terminalDescendants', () => {
        const EXPECTATIONS: { [Key in RuleNames]?: number } = {
            assignment_statement: 6,
            chunk: 5,
            empty_statement: 0,
            hash_bang_line: 0,
            label_statement: 3,
            return_statement: 5,
            statement: 12,
            break_statement: 0,
            goto_statement: 2,
            do_statement: 3,
        };
        test.each(Object.entries(EXPECTATIONS))('%s -> %i', (name: string, expectedTerminals: number) => {
            let rules = queryGrammar.getByName(name);
            expect(rules).not.toHaveLength(0);
            let terminals = uniqueByID(rules.flatMap(rule => rule.terminalDescendants()));
            expect(terminals).toHaveLength(expectedTerminals);
        });
    });
});
