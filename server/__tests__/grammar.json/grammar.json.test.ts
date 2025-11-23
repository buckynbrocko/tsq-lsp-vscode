import { Language, Parser, Query, Tree } from 'web-tree-sitter';
import { IntegerRange } from '../../src/junk_drawer';
import { NodeTypes } from '../../src/node_types';
import { isNotNullish } from '../../src/predicates';
import { TSNode } from '../../src/reexports/TSNode';
import { FlatGrammar, Grammar, ReGrammar, Rule, Terminality, TSQGrammar, TSQRule } from '../../src/untitled';
import { hmm as luaGrammarJSON } from '../resources/tree-sitter-lua.grammar.json';
import { initializeLanguage } from '../shared';

let luaLanguage: Language;
let luaGrammar: TSQGrammar;
let luaParser: Parser;
let rg: ReGrammar = new ReGrammar(luaGrammarJSON as Grammar);
let TSQLanguage: Language;
let TSQParser: Parser;

describe('lua grammar.json', () => {
    beforeAll(() => {
        luaGrammar = new TSQGrammar(luaGrammarJSON as Grammar, NodeTypes.Categorized.empty());
        fg = new FlatGrammar(luaGrammar.grammar);
        rg = new ReGrammar(luaGrammar.grammar);
    });

    test('.ruleNames', () => {
        let names = luaGrammar.ruleNames;
        expect(names.length).toBeGreaterThan(0);
    });

    test.each<[string, number, Rule['type'] | undefined]>([
        ['chunk', 0, 'CHOICE'],
        ['chunk', 1, 'REPEAT'],
        ['chunk', 2, 'CHOICE'],
        ['chunk', 3, undefined],
        ['hash_bang_line', 1, undefined],
    ])('%s[%i] = %s', (name: string, index: number, expectation: Rule['type'] | undefined) => {
        let rule = luaGrammar.ruleFor(name);
        expect(rule).toBeDefined();
        let indexed = luaGrammar.subStateFromIndex(rule!, index);
        expect(indexed?.type).toStrictEqual(expectation);
    });

    test.each<[string, [number, ...number[]], Rule['type'] | string | undefined]>([
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
    ])('%s%j = %s', (name: string, indices: [number, ...number[]], expectation: Rule['type'] | string | undefined) => {
        let rule = luaGrammar.ruleFor(name);
        expect(rule).toBeDefined();
        let indexed = luaGrammar.subStateFromIndices(rule!, indices);
        if (!!indexed && !!expectation && indexed.type !== expectation) {
            console.error(indexed);
        }
        if (!!expectation && !Rule.TYPES.includes(expectation as Rule['type']) && !!indexed && 'name' in indexed) {
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
        let rule = luaGrammar.ruleFor(name);
        expect(rule).toBeDefined();
        let indexed = luaGrammar.subStateFromIndices(rule!, indices);
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

    // test.each([['chunk']])("iterateRuleIndices '%s'", (name: string) => {
    //     let rule = lua.ruleFor(name);
    //     expect(rule).toBeDefined();
    //     let indices = lua.iterateRuleIndices(rule!);
    //     for (let index of indices) {
    //         let result = lua.subStateFromIndices(rule!, index);
    //         if (!result) {
    //             let states = lua.statesFromIndices(rule!, index).map(state => Rule.format(state));
    //             expect(true).toBeTruthy();
    //         }
    //         expect(result).toBeDefined();
    //     }
    // });
    let fg: FlatGrammar;
    describe('FlatGrammar', () => {
        beforeAll(() => {});
        test('FlatGrammar.get(%i)', () => {
            // let fg = new FlatGrammar(lua.grammar);
            for (let id of IntegerRange(fg.stubs.length)) {
                let node = fg.get(id);
                expect(node).toBeDefined();
                expect(node!.id).toEqual(id);
            }
        });
        test.each([
            //
            [0, [66, 67, 68]],
        ])('FlatGrammar.getChildrenOf(%i) -> %o', (id: number, expectation: number[]) => {
            // let fg = new FlatGrammar(lua.grammar);
            let node = fg.get(id);
            expect(node).toBeDefined();
            let result = fg.getChildrenOf(node).map(child => child.id);
            expect(result).toEqual(expectation);
        });
        test.each([
            //
            [0, undefined],
            [66, 67],
            [67, 68],
            [68, undefined],
        ])('FlatGrammar.getNextSibling(%i) -> %o', (id: number, expectation: number | undefined) => {
            // let fg = new FlatGrammar(lua.grammar);
            let node = fg.get(id);
            expect(node).toBeDefined();
            let result = fg.getNextSibling(node);
            expect(result?.id).toEqual(expectation);
        });
        test.each([
            //
            [0, []],
            [67, [266, 267]],
        ])('nextTerminals(%i)', (id: number, expectation: number[]) => {
            // let fg = new FlatGrammar(lua.grammar);
            let node = fg.get(id);
            expect(node).toBeDefined();
            let result = fg.nextPseudoTerminals(node).map(child => child.id);
            expect(result).toEqual(expectation);
        });
    });

    describe('ReGrammar', () => {
        beforeAll(async () => {
            luaLanguage = await initializeLanguage('tree-sitter-lua.wasm');
            luaParser = new Parser();
            luaParser.setLanguage(luaLanguage);
            TSQLanguage = await initializeLanguage('tree-sitter-query.wasm');
            TSQParser = new Parser();
            TSQParser.setLanguage(TSQLanguage);
            // rg = new ReGrammar(lua.grammar);
        });

        test('defined', () => {
            expect(rg).toBeDefined();
        });

        test.each<[number, string, ...number[]]>([
            [3, 'chunk', 0, 0], //
            [3, 'chunk', 0, 1],
            [2, 'chunk', 1, 0],
            [0, 'chunk', 2, 0],
            [0, 'chunk', 2, 1],
            [0, 'hash_bang_line'],
        ])('subsequentTerminals %$', (expectedLength: number, ...path: [string, ...number[]]) => {
            // let path: [string, ...number[]] = ['chunk', 0];
            // let expectedLength: number = 2;

            let rule = rg.get(...path);
            expect(rule).toBeDefined();

            let subsequent = rule!.subsequentTerminals();
            expect(subsequent).toHaveLength(expectedLength);
        });

        describe('Validation & Parity', () =>{const VALID_QUERIES = [
            ['(chunk (hash_bang_line))'], //
            ['(chunk (hash_bang_line) (statement) (return_statement))'], //
            ['(chunk (hash_bang_line)+)'], //
            ['(chunk (statement) (return_statement))'],
            ['(chunk (hash_bang_line) (statement) (return_statement))'],
            ['(return_statement "return" ";")'],
            ['(variable_list (attribute "<" @punctuation.bracket (identifier) @attribute ">" @punctuation.bracket))'],
            [
                '(assignment_statement (variable_list . name: [(identifier) @function (dot_index_expression field: (identifier) @function) ]) (expression_list . value: (function_definition)))',
            ],
            ['(attribute "<" ">")'],
            ['(chunk (empty_statement))'],
            ['(chunk (function_declaration))'],
            ['(chunk (hash_bang_line) (comment))'],
        ];
        test.each(VALID_QUERIES)('Valid Query - tree-sitter %$', (source: string) => {
            let query = new Query(luaLanguage, source);
            expect(query).toBeDefined();
        });

        test.each(VALID_QUERIES)('Valid Parity Check %$', (source: string) => {
            let tree: Tree | null = TSQParser.parse(source);
            expect(tree).not.toBeNull();

            let pattern: TSNode | undefined = tree?.rootNode.firstChild ?? undefined;
            expect(pattern).toBeDefined();

            let passes: boolean = rg.namedNodeIsValid(pattern!);
            expect(passes).toBeTruthy();
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
            expect(() => new Query(luaLanguage, source)).toThrow();
        });

        test.each(INVALID_QUERIES)('Invalid Parity Check %$', (source: string) => {
            let tree: Tree | null = TSQParser.parse(source);
            expect(tree).not.toBeNull();

            let pattern: TSNode | undefined = tree?.rootNode.firstChild ?? undefined;
            expect(pattern).toBeDefined();

            let passes: boolean = rg.namedNodeIsValid(pattern!);
            expect(passes).toBeFalsy();
        });})

        test.concurrent.each<[string, number] | [string, number, number]>([
            ['chunk', 5], //
            ['hash_bang_line', 1, 0],
            ['_block', 5],
            ['statement', 12],
            ['return_statement', 5],
            ['empty_statement', 1, 0],
            ['assignment_statement', 3],
        ])('(thisOr)terminalDescendants: %s', (name: string, expectedThisOr: number, expectedTerminalDescendants?: number) => {
            let rule = rg.topLevelRules.get(name);
            expect(rule).toBeDefined();

            expectedTerminalDescendants = expectedTerminalDescendants ?? expectedThisOr;

            let thisOr = rule?.thisOrTerminalDescendants() ?? [];
            expect(thisOr).toHaveLength(expectedThisOr);
            for (let terminal of thisOr) {
                expect(terminal.terminality).not.toStrictEqual(Terminality.NonTerminal);
            }

            let TerminalDescendants = rule?.terminalDescendants() ?? [];
            expect(TerminalDescendants).toHaveLength(expectedTerminalDescendants);
            for (let terminal of TerminalDescendants) {
                expect(terminal.terminality).not.toEqual(Terminality.NonTerminal);
            }
        });
        test('new', () => {
            let grammar = new ReGrammar(luaGrammarJSON as Grammar);
            expect(grammar).toBeDefined();
        });
        test.concurrent.skip.each(rg.IDRuleMap.entriesArray())('%i', (id: number, rule: TSQRule) => {
            expect(id).toEqual(rule.id);
            for (let child of rule.children) {
                expect(child.parent).toBeDefined();
                expect(child.parent?.id).toEqual(id);
            }
        });
    });
    describe('TSQRule matching', () => {
        beforeAll(async () => {
            TSQLanguage = await initializeLanguage();
            TSQParser = new Parser();
            TSQParser.setLanguage(TSQLanguage);
        });

        test.each([
            ['_?', 0], //
            ['_*', 0],
        ])('Blank match "%s"', (source: string, ...indices: number[]) => {
            let tree = TSQParser.parse(source) ?? undefined;
            expect(tree).toBeDefined();

            let node: TSNode | undefined = tree!.rootNode ?? undefined;
            for (let index of indices) {
                node = (node?.children ?? []).filter(isNotNullish).at(index);
            }
            expect(node).toBeDefined();

            const rule = rg.topLevelRules.get('chunk')?.children.at(0)?.children.at(1) ?? undefined;
            expect(rule).toBeDefined();
            expect(rule!.type).toStrictEqual('BLANK');

            let result = rule!.matchesTerminalNode(node!);
            expect(result).toBeTruthy();
        });
        test.each([
            ['_', 0], //
            ['_+', 0],
        ])('Blank !match "%s"', (source: string, ...indices: number[]) => {
            let tree = TSQParser.parse(source) ?? undefined;
            expect(tree).toBeDefined();

            let node: TSNode | undefined = tree!.rootNode ?? undefined;
            for (let index of indices) {
                node = (node?.children ?? []).filter(isNotNullish).at(index);
            }
            expect(node).toBeDefined();

            const rule = rg.topLevelRules.get('chunk')?.children.at(0)?.children.at(1) ?? undefined;
            expect(rule).toBeDefined();
            expect(rule!.type).toStrictEqual('BLANK');

            let result = rule!.matchesTerminalNode(node!);
            expect(result).toBeFalsy();
        });

        test.each([
            ['"return"', 'return_statement', [0], [0]], //
            ['"return" ";"', 'return_statement', [1], [2, 0]],
            ['";"', 'empty_statement', [0], []],
            ['"="', 'assignment_statement', [0], [1]],
        ])('String %s', (source: string, ruleName: string, nodeIndices: number[], ruleIndices: number[]) => {
            let tree = TSQParser.parse(source) ?? undefined;
            expect(tree).toBeDefined();

            let node: TSNode | undefined = tree!.rootNode ?? undefined;
            for (let index of nodeIndices) {
                node = (node?.children ?? []).filter(isNotNullish).at(index);
            }
            expect(node).toBeDefined();

            let rule = rg.topLevelRules.get(ruleName);
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
        ])('Pattern %s', (source: string, ruleName: string, nodeIndices: number[], ruleIndices: number[]) => {
            let tree = TSQParser.parse(source) ?? undefined;
            expect(tree).toBeDefined();

            let node: TSNode | undefined = tree!.rootNode ?? undefined;
            for (let index of nodeIndices) {
                node = (node?.children ?? []).filter(isNotNullish).at(index);
            }
            expect(node).toBeDefined();

            let rule = rg.topLevelRules.get(ruleName);
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
        ])('Symbol %s', (source: string, ruleName: string, nodeIndices: number[], ruleIndices: number[]) => {
            let tree = TSQParser.parse(source) ?? undefined;
            expect(tree).toBeDefined();

            let node: TSNode | undefined = tree!.rootNode ?? undefined;
            for (let index of nodeIndices) {
                node = (node?.children ?? []).filter(isNotNullish).at(index);
            }
            expect(node).toBeDefined();

            let rule = rg.topLevelRules.get(ruleName);
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
        ])('Symbol %s', (ruleName: string, source: string) => {
            let tree = TSQParser.parse(source) ?? undefined;
            expect(tree).toBeDefined();

            let node: TSNode | undefined = tree!.rootNode.children?.at(0) ?? undefined;
            // for (let index of nodeIndices) {
            //     node = (node?.children ?? []).filter(isNotNullish).at(index);
            // }
            expect(node).toBeDefined();

            let rule = rg.topLevelRules.get(ruleName);
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
