import { single } from 'itertools-ts';

import { Dict } from './Dict';
import { Grammar, GrammarJSON } from './Grammar';
import { elipsizeString, enumerate } from './junk_drawer';
import { isNotNullish } from './predicates';
import { TSNode } from './reexports';
import { Rule } from './Rule';
import { RuleJSON, Stub } from './RuleJSON';
import { Terminality } from './Terminality';

// export function nextNonExtraPseudoTerminalNode(node_: TSNode, grammar: QueryGrammar): TSNode[] {
//     let nodes = TSNode.nextPseudoTerminalSiblings(node_);
//     // let extras: TSNode[] = [];
//     // let nonExtras: TSNode[] = [];
//     let [extras, nonExtras] = divy(nodes, node => grammar.isExtra(node));
//     let max = new MaxIterations(100);
//     while (!!extras.length && max.ok) {
//         let [extras_, nonExtras_] = divy(extras, node => grammar.isExtra(node));
//         extras.push(...extras_);
//         nonExtras.push(...nonExtras_);
//     }
//     if (!max.ok) {
//         console.warn(`max reached for Node of type '${node_.type}'`);
//     }
//     return nonExtras;
// }

export type RuleContext = { stack: Rule[] };
export namespace RuleContext {
    export function popAndCopy(context: RuleContext): [Rule | undefined, RuleContext];
    export function popAndCopy(context: undefined): [undefined, undefined];
    export function popAndCopy(context?: RuleContext): [undefined, undefined] | [Rule | undefined, RuleContext];
    export function popAndCopy(context?: RuleContext): [undefined, undefined] | [Rule | undefined, RuleContext] {
        if (!context) {
            return [undefined, undefined];
        }
        let rule: Rule | undefined = context?.stack.at(-1);
        let copy: RuleContext = { ...context, stack: context.stack.slice(0, -1) };
        return [rule, copy];
    }

    export function push(rule: Rule, context?: RuleContext): RuleContext {
        return { ...(context ?? {}), stack: [...(context?.stack ?? []), rule] };
    }
}

export type Identifiable<T = unknown> = T & { id: number };
export namespace Identifiable {
    export function from<T extends {}>(object: T, id: number): Identifiable<T> {
        return { ...object, id };
    }

    export function tryFrom<T extends {}>(object: T | undefined, id: number | undefined): Identifiable<T> | undefined {
        return object === undefined || id === undefined ? undefined : from(object, id);
    }

    export function reduce<T extends {}>(object: undefined): undefined;
    export function reduce<T extends {}>(object: number | Identifiable<T>): number;
    // export function reduce<T extends {}>(object: undefined | number | Identifiable<T>): number | undefined;
    // export function reduce<T>(
    //     object: undefined | number | Identifiable<T>
    // ): typeof object extends undefined ? undefined : number;
    export function reduce<T extends {}>(object: undefined | number | Identifiable<T>): number | undefined;
    export function reduce<T extends {}>(object: undefined | number | Identifiable<T>): number | undefined {
        if (typeof object === 'number') {
            return object satisfies number;
        } else if (object) {
            return object.id;
        }
        return object as undefined;
    }
}

export type IdentifiableStub = Identifiable<Stub>;
export namespace IdentifiableStub {
    export function from(rule: RuleJSON, id: number): IdentifiableStub {
        return Identifiable.from(Stub.fromRuleJSON(rule), id);
    }
}

export function CartesianSpread<T>(a: T[][], b: T[][]): T[][] {
    if (!a.length && !b.length) {
        return [];
    } else if (!a.length) {
        return b;
    } else if (!b.length) {
        return a;
    }
    return a.flatMap(a_ => b.map(b_ => [...a_, ...b_]));
}

export type Error = NonDescript | UnrecognizedNode;

export type NonDescript = {
    type: 'NonDescript';
    message?: string;
    context?: any;
};

export type UnrecognizedNode = {
    type: 'UnrecognizedNode';
    node: TSNode;
};

// export class FlatGrammar {
//     stubs: Identifiable<Stub>[] = [];
//     nextSiblingMap = new Dict<number, number>();
//     childToParent = new Dict<number, number>();
//     parentToChildren = new Dict<number, Set<number>>();
//     nameMap = new Dict<string, number>();
//     constructor(grammar: GrammarJSON) {
//         let count = 0;
//         let queue: Identifiable<RuleJSON>[] = [];
//         for (let [name, rule] of Object.entries(grammar.rules)) {
//             this.nameMap.set(name, count);
//             queue.push(Identifiable.from(rule, count));
//             count += 1;
//         }
//         let current = queue.shift();
//         while (!!current) {
//             this.stubs.push(IdentifiableStub.from(current, current.id));

//             switch (current.type) {
//                 case 'SEQ':
//                 case 'CHOICE':
//                     let mappedMembers = current.members.map(member => {
//                         if (!current) {
//                             throw 'Current is somehow impossibly undefined';
//                         }
//                         let child = Identifiable.from(member, count);
//                         this._addParentChildEntry(current.id, count);
//                         queue.push(child);
//                         count += 1;
//                         return child;
//                     });
//                     for (let [elder, younger] of single.pairwise(mappedMembers)) {
//                         this.nextSiblingMap.set(elder.id, younger.id);
//                     }
//                     break;
//                 case 'ALIAS':
//                 case 'REPEAT':
//                 case 'REPEAT1':
//                 case 'RESERVED':
//                 case 'TOKEN':
//                 case 'IMMEDIATE_TOKEN':
//                 case 'FIELD':
//                 case 'PREC':
//                 case 'PREC_LEFT':
//                 case 'PREC_RIGHT':
//                 case 'PREC_DYNAMIC':
//                     queue.push(Identifiable.from(current.content, count));
//                     count += 1;
//                     this._addParentChildEntry(current.id, count);
//             }
//             current = queue.shift();
//             // count += 1;
//         }

//         // for (let [name, topLevelRule] of Object.entries(grammar.rules)) {
//         //     this.stubs.push(IdentifiableStub.from(topLevelRule, count));
//         //     this.nameMap.set(name, count);
//         //     let parentID = count;
//         //     let queue: Identifiable<Rule>[] = [];
//         //     switch (topLevelRule.type) {
//         //         case 'SEQ':
//         //         case 'CHOICE':
//         //             let mappedMembers = topLevelRule.members.map(member => {
//         //                 count += 1;
//         //                 this._addParentChildEntry(parentID, count);
//         //                 return Identifiable.from(member, count);
//         //             });
//         //             for (let [elder, younger] of single.pairwise(mappedMembers)) {
//         //                 this.nextSiblingMap.set(elder.id, younger.id);
//         //             }
//         //             queue.push(...mappedMembers);
//         //             break;
//         //         case 'ALIAS':
//         //         case 'REPEAT':
//         //         case 'REPEAT1':
//         //         case 'RESERVED':
//         //         case 'TOKEN':
//         //         case 'IMMEDIATE_TOKEN':
//         //         case 'FIELD':
//         //         case 'PREC':
//         //         case 'PREC_LEFT':
//         //         case 'PREC_RIGHT':
//         //         case 'PREC_DYNAMIC':
//         //             count += 1;
//         //             queue.push(Identifiable.from(topLevelRule.content, count));
//         //             this._addParentChildEntry(parentID, count);
//         //     }
//         // let current = queue.shift();
//         // while (current !== undefined) {
//         //     // let [id, rule] = current;
//         //     this.stubs.push(current);

//         //     switch (current.type) {
//         //         case 'SEQ':
//         //         case 'CHOICE':
//         //             let mappedMembers = current.members.map(member => {
//         //                 count += 1;
//         //                 // this.childToParent.set(count, current.id);
//         //                 if (!current) {
//         //                     throw 'Current is somehow impossibly undefined';
//         //                 }
//         //                 this._addParentChildEntry(current.id, count);
//         //                 return IdentifiableStub.from(member, count);
//         //             });
//         //             for (let [elder, younger] of single.pairwise(mappedMembers)) {
//         //                 this.nextSiblingMap.set(elder.id, younger.id);
//         //             }
//         //             break;
//         //         case 'ALIAS':
//         //         case 'REPEAT':
//         //         case 'REPEAT1':
//         //         case 'RESERVED':
//         //         case 'TOKEN':
//         //         case 'IMMEDIATE_TOKEN':
//         //         case 'FIELD':
//         //         case 'PREC':
//         //         case 'PREC_LEFT':
//         //         case 'PREC_RIGHT':
//         //         case 'PREC_DYNAMIC':
//         //             count += 1;
//         //             queue.push(Identifiable.from(current.content, count));
//         //             this._addParentChildEntry(current.id, count);
//         //     }
//         //     current = queue.shift();
//         // }
//         // count += 1;
//         // }
//     }

//     isTerminal(stub: IdentifiableStub): boolean {
//         return Terminality.ofRule(stub) === Terminality.Terminal;
//     }

//     isPseudoTerminal(stub: IdentifiableStub): boolean {
//         return Terminality.ofRule(stub) === Terminality.PseudoTerminal;
//     }

//     isNonTerminal(stub: IdentifiableStub): boolean {
//         return Terminality.ofRule(stub) === Terminality.NonTerminal;
//     }

//     isTerminalish(stub: IdentifiableStub): boolean {
//         return Terminality.ofRule(stub) !== Terminality.NonTerminal;
//     }

//     _nextAncestor(arg: IdentifiableStub | number | undefined): IdentifiableStub | undefined {
//         let current = this.get(arg);
//         if (!current) {
//             return;
//         }
//         for (let ancestor of this.yieldLineageAscending(current)) {
//         }
//         let parent = this.getParent(current);
//         while (!parent) {
//             let pibling = this.getNextSibling(parent);
//             if (!!pibling) {
//                 return pibling;
//             }
//             current = parent;
//             parent = this.getParent(parent);
//         }
//         return;
//     }

//     *yieldLineageAscending(arg: Identifiable | number | undefined) {
//         let parent = this.getParent(arg);
//         while (!!parent) {
//             yield parent;
//             parent = this.getParent(parent);
//         }
//         return;
//     }

//     nextPseudoTerminals(node: Identifiable): IdentifiableStub[];
//     nextPseudoTerminals(id: number): IdentifiableStub[];
//     nextPseudoTerminals(arg: Identifiable | number): IdentifiableStub[];
//     nextPseudoTerminals(arg: Identifiable | number): IdentifiableStub[] {
//         let current = this.get(arg);
//         if (!current) {
//             return [];
//         }

//         for (let ancestor of this.yieldLineageAscending(current)) {
//             let next: IdentifiableStub | undefined =
//                 ancestor.type === 'CHOICE' ? this.getNextSibling(ancestor) : this.getNextSibling(current);
//             switch (Terminality.ofRule(next)) {
//                 case Terminality.Terminal:
//                 case Terminality.PseudoTerminal:
//                     return [next!];
//                 case Terminality.NonTerminal:
//                     let nexts = this.firstTerminalChildrenOf(next);
//                     if (!!nexts.length) {
//                         return nexts;
//                     }
//                 case undefined:
//                     break;
//             }
//             current = ancestor;
//         }

//         return [];
//     }

//     getNextSibling(arg: Identifiable | number): IdentifiableStub | undefined {
//         let siblingID = this._getNextSiblingID(arg);
//         return siblingID === undefined ? undefined : this.get(siblingID);
//     }

//     _getNextSiblingID(arg: Identifiable | number): number | undefined {
//         return this.nextSiblingMap.get(Identifiable.reduce(arg));
//     }

//     _addParentChildEntry(parent: IdentifiableStub | number, child: IdentifiableStub | number) {
//         let parentID = Identifiable.reduce(parent);
//         let childID = Identifiable.reduce(child);
//         this.childToParent.set(childID, parentID);
//         if (!this.parentToChildren.has(parentID)) {
//             this.parentToChildren.set(parentID, new Set([childID]));
//         } else {
//             this.parentToChildren.get(parentID)?.add(childID);
//         }
//     }

//     firstChildOf(parent: Identifiable): Identifiable<Stub> | undefined;
//     firstChildOf(parentID: number): Identifiable<Stub> | undefined;
//     firstChildOf(arg: number): Identifiable<Stub> | undefined;
//     firstChildOf(arg: Identifiable | number): Identifiable<Stub> | undefined {
//         const id = Identifiable.reduce(arg);
//         const firstID = [...(this.parentToChildren.get(id) ?? [])].at(0);
//         if (!firstID) {
//             return;
//         }
//         const first = this.stubs.at(firstID);
//         return !first ? undefined : { ...first, id: firstID };
//     }

//     get(arg: IdentifiableStub | number | undefined): IdentifiableStub | undefined {
//         if (typeof arg !== 'number') {
//             return arg;
//         }
//         return this._getByID(arg);
//     }
//     _getParentID(arg: IdentifiableStub | number | undefined): number | undefined {
//         return arg === undefined ? undefined : this.childToParent.get(Identifiable.reduce(arg));
//     }

//     getParent(arg: IdentifiableStub | number | undefined): IdentifiableStub | undefined {
//         let parentID = this._getParentID(arg);
//         return parentID === undefined ? undefined : this.get(parentID);
//     }

//     _getByID(id: number | undefined): IdentifiableStub | undefined {
//         return id === undefined ? undefined : this.stubs.at(id);
//     }

//     _typeOf(rule: Identifiable<Stub>): Stub['type'];
//     _typeOf(id: number): Stub['type'] | undefined;
//     _typeOf(undefined_: undefined): undefined;
//     _typeOf(arg: Identifiable<Stub> | number): Stub['type'] | undefined;
//     _typeOf(arg: Identifiable<Stub> | number | undefined): Stub['type'] | undefined {
//         if (typeof arg !== 'number') {
//             return arg?.type;
//         }
//         return this._getByID(arg)?.type;
//     }

//     firstTerminalChildrenOf(parent: Identifiable): Identifiable<Stub>[];
//     firstTerminalChildrenOf(parentID: number): Identifiable<Stub>[];
//     firstTerminalChildrenOf(arg: Identifiable | number): Identifiable<Stub>[];
//     firstTerminalChildrenOf(arg: Identifiable | number): Identifiable<Stub>[] {
//         if (this._typeOf(arg) === 'CHOICE') {
//             return this.getChildrenOf(arg).flatMap(child => {
//                 if (Terminality.ofRule(child) !== Terminality.NonTerminal) {
//                     return child;
//                 }
//                 return this.firstTerminalChildrenOf(child);
//             });
//             // return child
//         }

//         for (let child of this.yieldTerminalChildren(arg)) {
//             return [child];
//         }
//         return [];
//     }

//     *yieldTerminalChildren(arg: Identifiable | number): Generator<Identifiable<Stub>, undefined, unknown> {
//         let children = this.getChildrenOf(arg);
//         let child = children.shift();
//         while (!!child) {
//             if (Terminality.ofRule(child) !== Terminality.NonTerminal) {
//                 children.unshift(...this.getChildrenOf(child));
//             } else {
//                 yield child;
//             }
//             child = children.shift();
//         }
//         return;
//     }

//     getTerminalChildrenOf(arg: Identifiable | number): Identifiable<Stub>[] {
//         // let id = Identifiable.reduce(arg);
//         let terminals: Identifiable<Stub>[] = [];
//         let children = this.getChildrenOf(arg);
//         let child = children.shift();
//         while (!!child) {
//             if (Terminality.ofRule(child) === Terminality.NonTerminal) {
//                 children.unshift(...this.getChildrenOf(child));
//             } else {
//                 terminals.push(child);
//             }

//             child = children.shift();
//         }
//         return terminals;
//     }

//     getChildrenOf(parentID: Identifiable): Identifiable<Stub>[];
//     getChildrenOf(id: number): Identifiable<Stub>[];
//     getChildrenOf(arg: Identifiable | number): Identifiable<Stub>[];
//     getChildrenOf(arg: Identifiable | number): Identifiable<Stub>[] {
//         let parentID = Identifiable.reduce(arg);
//         let childrenIDs = this.parentToChildren.get(parentID);
//         if (!childrenIDs) {
//             return [];
//         }
//         return [...childrenIDs].map(id => Identifiable.tryFrom(this.stubs.at(id), id)).filter(isNotNullish);
//     }

//     *yieldChildrenIDs(arg: Identifiable | number) {
//         let parentID = Identifiable.reduce(arg);
//         let childrenIDs = this.parentToChildren.get(parentID ?? -1);
//         for (let childID of childrenIDs ?? []) {
//             yield childID;
//         }
//         return undefined;
//     }

//     *yieldChildrenOf(arg: Identifiable | number) {
//         for (let childID of this.yieldChildrenIDs(arg)) {
//             let child = this.stubs.at(childID);
//             if (!!child) {
//                 yield child;
//             }
//         }
//         return;
//     }
// }

export type RuleState = Indices;

type HasRulePath = {
    path: RulePath;
};

export type PathedRule = RuleJSON & HasRulePath;
export namespace PathedRule {
    export function* walk(rule: PathedRule, grammar: Grammar) {
        if (Terminality.ofRule(rule) === Terminality.Terminal) {
            return undefined;
        }
        let seen = new Set<string>();
        let queue: PathedRule[] = [];
        let current: PathedRule | undefined = rule;
        while (!!current) {
            let asString = RulePath.toString(current.path);
            if (seen.has(asString)) {
                current = queue.shift();
                continue;
            }
            seen.add(asString);
            switch (current.type) {
                case 'BLANK':
                case 'STRING':
                case 'PATTERN':
                    yield current;
                    break;
                case 'SYMBOL':
                    if (!grammar.hasHidden(current.name)) {
                        yield current;
                    } else {
                        let resolved = grammar.getPathedRuleByName(current.name);
                        resolved && queue.push(resolved);
                    }
                    break;
                case 'SEQ':
                case 'CHOICE':
                    yield current;
                    for (let [index, member] of enumerate(current.members)) {
                        queue.push({ ...member, path: [...current.path, index] });
                    }
                    break;
                case 'ALIAS':
                case 'REPEAT':
                case 'REPEAT1':
                case 'RESERVED':
                case 'TOKEN':
                case 'IMMEDIATE_TOKEN':
                case 'PREC':
                case 'PREC_LEFT':
                case 'PREC_RIGHT':
                case 'PREC_DYNAMIC':
                case 'FIELD':
                    yield current;
                    queue.push({ ...current.content, path: [...current.path, 0] });
                    break;
            }
            current = queue.shift();
        }
        return;
    }

    export function* walkTerminals(rule: PathedRule, grammar: Grammar) {
        for (let subrule of walk(rule, grammar)) {
            if (Terminality.ofRule(subrule) !== Terminality.Terminal) {
                yield subrule;
            }
        }
        return;
    }

    export function parentPath(rule: PathedRule): RulePath | undefined {
        return RulePath.parentPath(rule.path);
    }

    export function isTerminal(rule: PathedRule): boolean {
        switch (rule.type) {
            case 'BLANK':
            case 'STRING':
            case 'PATTERN':
            case 'TOKEN':
            case 'IMMEDIATE_TOKEN':
                return true;
            case 'SYMBOL':
            case 'SEQ':
            case 'CHOICE':
            case 'ALIAS':
            case 'REPEAT':
            case 'REPEAT1':
            case 'RESERVED':
            case 'FIELD':
            case 'PREC':
            case 'PREC_LEFT':
            case 'PREC_RIGHT':
            case 'PREC_DYNAMIC':
                return false;
        }
    }

    export function isPseudoTerminal(rule: PathedRule): boolean {
        switch (rule.type) {
            case 'BLANK':
            case 'STRING':
            case 'PATTERN':
            case 'SYMBOL':
            case 'TOKEN':
            case 'IMMEDIATE_TOKEN':
                return true;
            case 'SEQ':
            case 'CHOICE':
            case 'ALIAS':
            case 'REPEAT':
            case 'REPEAT1':
            case 'RESERVED':
            case 'FIELD':
            case 'PREC':
            case 'PREC_LEFT':
            case 'PREC_RIGHT':
            case 'PREC_DYNAMIC':
                return false;
        }
    }

    // export function isNonTerminal(rule: PathedRule): boolean {
    //     switch (rule.type) {
    //     }
    // }
}

export type RulePath = [string, ...number[]];
export namespace RulePath {
    export function copy(path: RulePath): RulePath {
        return [...path];
    }

    export function toString(path: RulePath): string {
        return [...path].join('-');
    }

    export function parentPath(path: RulePath): RulePath | undefined {
        if (path.length === 1) {
            return;
        }
        let [name, ...indices] = path;
        return [name, ...indices.slice(0, -2)];
    }

    export function fromString(string_: string): RulePath | undefined {
        let parts = string_.split('-');
        let name: string | undefined = parts.shift();
        if (!name) {
            return;
        }
        try {
            return [name, ...parts.map(Number.parseInt)];
        } catch (e) {
            console.warn(`Failed to parse RulePath from string "${elipsizeString(string_, 20)}"`);
        }
        return;
    }
    export function name(path: RulePath): string {
        return path[0];
    }
}

export type Indices = [number, ...number[]];
export namespace Indices {
    const SEPARATOR = '/';

    export function is(indices: number[]): indices is Indices {
        return !!indices.length;
    }
    export function toString(index: Indices): string {
        return index.map(i => i.toString()).join(SEPARATOR);
    }

    export function attemptFromNumbers(numbers: number[]): Indices | undefined {
        return !numbers.length ? undefined : (numbers as Indices);
    }

    export function fromString(string_: string): Indices {
        return string_.split(SEPARATOR).map(digits => Number.parseInt(digits)) as Indices;
    }

    export function attemptFromString(string_: string): Indices | undefined {
        try {
            const result = fromString(string_);
            if (result.length < 1) {
                throw `Attempted to create empty RuleIndex with string "${string_}"`;
            }
            return result as Indices;
        } catch (e) {
            console.error(e);
        }
        return undefined;
    }
}

export type ResolvedRule =
    | RuleJSON.Blank
    | RuleJSON.String
    | RuleJSON.Pattern
    | RuleJSON.Sequence
    | RuleJSON.Choice
    | RuleJSON.Field
    | RuleJSON.Repeat
    | RuleJSON.Repeat1;
export type NamedRule = Extends<RuleJSON, { name: string }>;
export type Extends<T, E> = T extends E ? T : never;
export type TerminalRule = RuleJSON.Blank | RuleJSON.String | RuleJSON.Pattern;
export type PseudoTerminalRule = TerminalRule | RuleJSON.Symbol | RuleJSON.Field;
export type RuleOf<G extends GrammarJSON> = keyof G['rules'];

const SCHEMA = {
    $schema: 'http://json-schema.org/draft-07/schema#',
    title: 'Tree-sitter grammar specification',
    type: 'object',
    required: ['name', 'rules'],
    additionalProperties: false,
    properties: {
        $schema: {
            type: 'string',
        },
        name: {
            description: 'The name of the grammar',
            type: 'string',
            pattern: '^[a-zA-Z_]\\w*',
        },
        inherits: {
            description: 'The name of the parent grammar',
            type: 'string',
            pattern: '^[a-zA-Z_]\\w*',
        },
        rules: {
            type: 'object',
            patternProperties: {
                '^[a-zA-Z_]\\w*$': {
                    $ref: '#/definitions/rule',
                },
            },
            additionalProperties: false,
        },
        extras: {
            type: 'array',
            uniqueItems: true,
            items: {
                $ref: '#/definitions/rule',
            },
        },
        precedences: {
            type: 'array',
            uniqueItems: true,
            items: {
                type: 'array',
                uniqueItems: true,
                items: {
                    oneOf: [
                        {
                            type: 'string',
                        },
                        {
                            $ref: '#/definitions/symbol-rule',
                        },
                    ],
                },
            },
        },
        reserved: {
            type: 'object',
            patternProperties: {
                '^[a-zA-Z_]\\w*$': {
                    type: 'array',
                    uniqueItems: true,
                    items: {
                        $ref: '#/definitions/rule',
                    },
                },
            },
            additionalProperties: false,
        },
        externals: {
            type: 'array',
            uniqueItems: true,
            items: {
                $ref: '#/definitions/rule',
            },
        },
        inline: {
            type: 'array',
            uniqueItems: true,
            items: {
                type: 'string',
                pattern: '^[a-zA-Z_]\\w*$',
            },
        },
        conflicts: {
            type: 'array',
            uniqueItems: true,
            items: {
                type: 'array',
                uniqueItems: true,
                items: {
                    type: 'string',
                    pattern: '^[a-zA-Z_]\\w*$',
                },
            },
        },
        word: {
            type: 'string',
            pattern: '^[a-zA-Z_]\\w*',
        },
        supertypes: {
            description:
                'A list of hidden rule names that should be considered supertypes in the generated node types file. See https://tree-sitter.github.io/tree-sitter/using-parsers/6-static-node-types.',
            type: 'array',
            uniqueItems: true,
            items: {
                description: 'The name of a rule in `rules` or `extras`',
                type: 'string',
            },
        },
    },
    definitions: {
        'blank-rule': {
            type: 'object',
            properties: {
                type: {
                    type: 'string',
                    const: 'BLANK',
                },
            },
            required: ['type'],
        },
        'string-rule': {
            type: 'object',
            properties: {
                type: {
                    type: 'string',
                    const: 'STRING',
                },
                value: {
                    type: 'string',
                },
            },
            required: ['type', 'value'],
        },
        'pattern-rule': {
            type: 'object',
            properties: {
                type: {
                    type: 'string',
                    const: 'PATTERN',
                },
                value: {
                    type: 'string',
                },
                flags: {
                    type: 'string',
                },
            },
            required: ['type', 'value'],
        },
        'symbol-rule': {
            type: 'object',
            properties: {
                type: {
                    type: 'string',
                    const: 'SYMBOL',
                },
                name: {
                    type: 'string',
                },
            },
            required: ['type', 'name'],
        },
        'seq-rule': {
            type: 'object',
            properties: {
                type: {
                    type: 'string',
                    const: 'SEQ',
                },
                members: {
                    type: 'array',
                    items: {
                        $ref: '#/definitions/rule',
                    },
                },
            },
            required: ['type', 'members'],
        },
        'choice-rule': {
            type: 'object',
            properties: {
                type: {
                    type: 'string',
                    const: 'CHOICE',
                },
                members: {
                    type: 'array',
                    items: {
                        $ref: '#/definitions/rule',
                    },
                },
            },
            required: ['type', 'members'],
        },
        'alias-rule': {
            type: 'object',
            properties: {
                type: {
                    type: 'string',
                    const: 'ALIAS',
                },
                value: {
                    type: 'string',
                },
                named: {
                    type: 'boolean',
                },
                content: {
                    $ref: '#/definitions/rule',
                },
            },
            required: ['type', 'named', 'content', 'value'],
        },
        'repeat-rule': {
            type: 'object',
            properties: {
                type: {
                    type: 'string',
                    const: 'REPEAT',
                },
                content: {
                    $ref: '#/definitions/rule',
                },
            },
            required: ['type', 'content'],
        },
        'repeat1-rule': {
            type: 'object',
            properties: {
                type: {
                    type: 'string',
                    const: 'REPEAT1',
                },
                content: {
                    $ref: '#/definitions/rule',
                },
            },
            required: ['type', 'content'],
        },
        'reserved-rule': {
            type: 'object',
            properties: {
                type: {
                    type: 'string',
                    const: 'RESERVED',
                },
                context_name: {
                    type: 'string',
                },
                content: {
                    $ref: '#/definitions/rule',
                },
            },
            required: ['type', 'context_name', 'content'],
        },
        'token-rule': {
            type: 'object',
            properties: {
                type: {
                    type: 'string',
                    enum: ['TOKEN', 'IMMEDIATE_TOKEN'],
                },
                content: {
                    $ref: '#/definitions/rule',
                },
            },
            required: ['type', 'content'],
        },
        'field-rule': {
            properties: {
                name: {
                    type: 'string',
                },
                type: {
                    type: 'string',
                    const: 'FIELD',
                },
                content: {
                    $ref: '#/definitions/rule',
                },
            },
            required: ['name', 'type', 'content'],
        },
        'prec-rule': {
            type: 'object',
            properties: {
                type: {
                    type: 'string',
                    enum: ['PREC', 'PREC_LEFT', 'PREC_RIGHT', 'PREC_DYNAMIC'],
                },
                value: {
                    oneof: [
                        {
                            type: 'integer',
                        },
                        {
                            type: 'string',
                        },
                    ],
                },
                content: {
                    $ref: '#/definitions/rule',
                },
            },
            required: ['type', 'content', 'value'],
        },
        rule: {
            oneOf: [
                {
                    $ref: '#/definitions/alias-rule',
                },
                {
                    $ref: '#/definitions/blank-rule',
                },
                {
                    $ref: '#/definitions/string-rule',
                },
                {
                    $ref: '#/definitions/pattern-rule',
                },
                {
                    $ref: '#/definitions/symbol-rule',
                },
                {
                    $ref: '#/definitions/seq-rule',
                },
                {
                    $ref: '#/definitions/choice-rule',
                },
                {
                    $ref: '#/definitions/repeat1-rule',
                },
                {
                    $ref: '#/definitions/repeat-rule',
                },
                {
                    $ref: '#/definitions/reserved-rule',
                },
                {
                    $ref: '#/definitions/token-rule',
                },
                {
                    $ref: '#/definitions/field-rule',
                },
                {
                    $ref: '#/definitions/prec-rule',
                },
            ],
        },
    },
};
