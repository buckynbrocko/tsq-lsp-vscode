import { single } from 'itertools-ts';

import { Dict } from './Dict';
import { firstOf } from './itertools';
import { elipsizeString, enumerate, IntegerRange as exclusiveRange, Identifier, nameOfNamedNode } from './junk_drawer';
import {
    AnonymousNode,
    Definition,
    DefinitionChild,
    flattenChildIdentity,
    isNotAnchor,
    List,
    MaxIterations,
    NamedNode,
    NegatedField,
    Pattern,
    PseudoTerminalChild,
    StructuralDiagnostic,
} from './lints/StructuralLinting';
import * as MetaNode from './MetaNode';
import { NamedNode as MetaNamedNode } from './MetaNode';
import { NodeTypes } from './node_types';
import { isNotNullish } from './predicates';
import { TSNode } from './reexports';
import { TSNodes } from './reexports/TSNode';
import { Literal } from './typeChecking';

function nodeIsRulable(node: TSNode): boolean {
    switch (node.type) {
        case 'named_node':
        case 'anonymous_node':
        case 'field_definition':
        case 'missing_node':
        case 'grouping':
        case 'list':
            return true;
        default:
            return false;
    }
}

type Trilean = 'yes' | 'no' | 'maybe';

// export function namedNodeIsValid(node_: TSNode, grammar: ReGrammar): boolean {
//     let name = nameOfNamedNode(node_);
//     if (!name) {
//         return false; // no name found for node
//     }
//     const rootRule = grammar.topLevelRules.get(name);
//     let rules_: TSQRule[];
//     if (rootRule) {
//         rules_ = rootRule.terminalDescendants();
//     } else {
//         rules_ = grammar.getAlias(name).filter(a => a.matchesTerminalNode(node_));
//         let aliased = grammar.getAlias(name);
//         let content = aliased
//             .map(alias => (alias.content instanceof TSQRule.Symbol ? grammar.get(alias.content.name) : alias.content))
//             .filter(isNotNullish);
//         let descendants = content.flatMap(r => r.thisOrTerminalDescendants());
//         rules_ = descendants;
//     }

//     let nodes = TSNode.firstPseudoTerminalDescendants(node_);
//     if (!nodes.length) {
//         return true; // named_node has no children to validate
//     }
//     let sets = nodes.map(node => [node, ...rules_.filter(r => r.matchesTerminalNode(node))] satisfies [TSNode, ...TSQRule[]]);
//     let nextSets: [TSNode, ...TSQRule[]][] = [];
//     let max = new MaxIterations(100);
//     while (!!sets.length && max.ok) {
//         for (let [node, ...rules] of sets) {
//             let matchingRules = rules.filter(r => r.matchesTerminalNode(node));
//             if (!matchingRules.length) {
//                 return false; // no rules matched
//             }

//             let nextNodes = TSNode.nextPseudoTerminalSiblings(node);
//             if (!nextNodes.length) {
//                 continue;
//             }
//             let nextRules = matchingRules.flatMap(rule => rule.subsequentTerminals());
//             if (!nextRules.length) {
//                 return false; // no subsequent rules
//             }
//             let nexts = nextNodes.map(
//                 n => [n, ...nextRules.filter(rule => rule.matchesTerminalNode(n))] satisfies [TSNode, ...TSQRule[]]
//             );
//             nextSets.push(...nexts);
//         }
//         sets = [...nextSets];
//         nextSets = [];
//     }
//     // let pairs = nodes.flatMap(node => rule.allTerminalSubrulesMatchingTerminalNode(node));
//     return true;
// }

function nodeToSubrules(node: TSNode, rule: TSQRule): [TSNode, ...TSQRule[]] {
    return [node, ...rule.allTerminalSubrulesMatchingTerminalNode(node)];
}

function getNextPairs(pairs: [TSNode, TSQRule][]): [TSNode, TSQRule][] {
    let nodes: TSNode[] = pairs.map(([node, _]) => node);
    let rules: TSQRule[] = pairs.map(([_, rule]) => rule);
    let uniqueNodeIDs = new Set(nodes.map(node => node.id));
    let uniqueRuleIDs = new Set(rules.map(rule => rule.id));
    let nextNodes: TSNode[] = TSNodes.unique(TSNodes.unique(nodes).flatMap(node => TSNode.nextPseudoTerminalSiblings(node)));

    if (!nextNodes.length) {
        return []; // All good - no more nodes left to match
    }
    let nextRules: TSQRule[] = TSQRule.deduplicate(TSQRule.deduplicate(rules).flatMap(rule => rule.nextTerminals()));
    if (!nextRules.length) {
        return []; // child nodes did not match anymore rules :(
    }

    if (uniqueNodeIDs.size === 1 && uniqueRuleIDs.size === 1) {
        if (!nextNodes.length) {
            return []; // All good - no more nodes left to match
        }

        nextRules = rules[0]!.nextTerminals();
        if (!nextRules.length) {
            return []; // child nodes did not match anymore rules :c
        }

        pairs = nextNodes.flatMap(node => hmhmhm(node, nextRules));
    } else if (uniqueNodeIDs.size === 1 && uniqueRuleIDs.size > 1) {
        nextNodes = TSNode.nextPseudoTerminalSiblings(pairs[0]![0]);
        if (!nextNodes.length) {
            return []; // All good - no more nodes left to match
        }
        nextRules = rules.flatMap(rule => rule.nextTerminals());
        if (!nextRules.length) {
            return []; // child nodes did not match anymore rules :c
        }
    } else if (uniqueNodeIDs.size > 1 && uniqueRuleIDs.size === 1) {
        // nextNodes =
    }

    return [];
}

function hmhmhm(node: TSNode, rules: TSQRule[]): [TSNode, TSQRule][] {
    return rules.filter(rule => rule.matchesTerminalNode(node)).map(rule => [node, rule]);
}

// function beebooboobop(node: TSNode, rule: TSQRule) {
//     if (!nodeIsRulable(node)) {
//         return false;
//     }
// }

// find every matching pseudo-terminal Subrule for starting Definitions as pairs
// get next Subrule-Definition pair
// remove duplicates

export type TSQRule =
    | TSQRule.Blank
    | TSQRule.String
    | TSQRule.Pattern
    | TSQRule.Symbol
    | TSQRule.Sequence
    | TSQRule.Choice
    | TSQRule.Alias
    | TSQRule.Repeat
    | TSQRule.Repeat1
    | TSQRule.Reserved
    | TSQRule.Token
    | TSQRule.Field
    | TSQRule.Precedence;

type TSQRuleType = TSQRule['type'];
class Counter {
    count = 0;
    next(): number {
        let next_ = this.count;
        this.count += 1;
        return next_;
    }
}

function divy<T>(iterable: Iterable<T>, fn: (arg: T) => boolean): [T[], T[]] {
    let trues: T[] = [];
    let falses: T[] = [];
    for (let item of iterable) {
        (fn(item) && trues.push(item)) || falses.push(item);
    }
    return [trues, falses];
}

export function nextNonExtraPseudoTerminalNode(node_: TSNode, grammar: ReGrammar): TSNode[] {
    let nodes = TSNode.nextPseudoTerminalSiblings(node_);
    // let extras: TSNode[] = [];
    // let nonExtras: TSNode[] = [];
    let [extras, nonExtras] = divy(nodes, node => grammar.isExtra(node));
    let max = new MaxIterations(100);
    while (!!extras.length && max.ok) {
        let [extras_, nonExtras_] = divy(extras, node => grammar.isExtra(node));
        extras.push(...extras_);
        nonExtras.push(...nonExtras_);
    }
    if (!max.ok) {
        console.warn(`max reached for Node of type '${node_.type}'`);
    }
    return nonExtras;
}

export class ReGrammar {
    supertypeNames: Set<string>;
    supertypes: TSQRule[];
    IDRuleMap: Dict<number, TSQRule> = new Dict();
    topLevelRules: Dict<string, TSQRule> = new Dict();
    aliases: Dict<string, TSQRule.Alias[]> = new Dict();
    extras: TSQRule[] = [];
    extrasNames: Set<string>;
    constructor(public grammar: Grammar) {
        this.supertypeNames = new Set(grammar.supertypes ?? []);
        this.extrasNames = new Set((grammar.extras ?? []).filter(e => e.type === 'SYMBOL').map(e => e.name));
        let IDs = new Counter();
        for (let [name, topLevelRule_] of Object.entries(grammar.rules)) {
            let topLevelRule = TSQRule.fromRule(topLevelRule_, IDs, this, name);
        }
        this.supertypes = [...this.supertypeNames].map(name => this.get(name)).filter(isNotNullish);
    }

    diagnoseNamedNode(node__: TSNode): any[] {
        let node_ = MetaNamedNode.tryFrom(node__, this);
        if (!node_) {
            return ['no name found for node']; // no name found for node
        }
        let rules_: TSQRule[] = this.rulesForMetaNamedNode(node_);

        // NOTE tree-sitter itself seems not to alloq extras as the first child of a named_node, so this is to match it's behavior
        // Maybe it assumes that if there's an extra it would instead always belong to the previous/enclosing definition?
        let nodes = node_.firstTerminalChildren(false);
        if (!nodes.length) {
            return []; // named_node has no children to validate
        }
        let sets = nodes.map(
            node => [node, ...rules_.filter(r => r.matchesTerminalNode(node.node))] satisfies [MetaNode.MetaNode, ...TSQRule[]]
        );
        let nextSets: [MetaNode.MetaNode, ...TSQRule[]][] = [];
        let max = new MaxIterations(100);
        while (!!sets.length && max.ok) {
            for (let [node, ...rules] of sets) {
                let matchingRules = rules.filter(r => r.matchesTerminalNode(node.node));
                if (!matchingRules.length) {
                    return [`No matching rules for node of type '${node.nodeType}'`]; // no rules matched
                }
                let nextNodes = node.nextTerminals();
                if (!nextNodes.length) {
                    continue;
                }
                let nextRules = matchingRules.flatMap(rule => rule.subsequentTerminals());
                if (!nextRules.length) {
                    return [`Unexpected node of type '${node.nodeType}'`]; // no subsequent rules
                }
                let nexts = nextNodes.map(
                    n =>
                        [n, ...nextRules.filter(rule => rule.matchesTerminalNode(n.node))] satisfies [
                            MetaNode.MetaNode,
                            ...TSQRule[]
                        ]
                );
                // let nexts = nextNodes.map(
                //     n => [n, ...nextRules.filter(rule => rule.matchesTerminalNode(n))] satisfies [TSNode, ...TSQRule[]]
                // );
                nextSets.push(...nexts);
            }
            sets = [...nextSets];
            nextSets = [];
        }
        // let pairs = nodes.flatMap(node => rule.allTerminalSubrulesMatchingTerminalNode(node));
        return [];
    }
    namedNodeIsValid(node: TSNode): boolean {
        return !this.diagnoseNamedNode(node).length;
    }

    rulesForMetaNamedNode(node: MetaNode.NamedNode): TSQRule[] {
        let rules: TSQRule[];
        let rule = this.get(node.name);
        if (!!rule) {
            return rule.terminalDescendants();
        }
        return this.getAlias(node.name)
            .map(alias => (alias.content instanceof TSQRule.Symbol ? this.get(alias.content.name) : alias.content))
            .filter(isNotNullish)
            .flatMap(r => r.thisOrTerminalDescendants());
    }

    hasAlias(name: string): boolean {
        return this.aliases.has(name);
    }

    rulesForAlias(name: string): TSQRule[] {
        return TSQRule.deduplicate((this.aliases.get(name) ?? []).flatMap(a => a.follow()));
    }

    getAlias(name: string): TSQRule.Alias[] {
        return this.aliases.get(name) ?? [];
    }

    isExtra(node: TSNode) {
        return this.extras.some(rule => rule.matchesTerminalNode(node));
    }

    addRule(rule: TSQRule, name?: string) {
        if (this.IDRuleMap.has(rule.id)) {
            throw `ReGrammar already has node with ID '${rule.id}'`;
        }
        this.IDRuleMap.set(rule.id, rule);

        if (rule instanceof TSQRule.Alias) {
            if (rule.named) {
                this.aliases.get(rule.value)?.push(rule) || this.aliases.set(rule.value, [rule]);
            } else {
            }
        }
        if (name === undefined) {
            return;
        }
        if (this.extrasNames.has(name)) {
            this.extras.push(rule);
        }
        if (this.topLevelRules.has(name)) {
            throw `ReGrammar already has node with name "${name}"`;
        }
        this.topLevelRules.set(name, rule);
    }

    get(name: string, ...indices: number[]): TSQRule | undefined {
        let rule = this.topLevelRules.get(name);
        for (let index of indices) {
            if (!rule) break;
            rule = rule?.children.at(index);
        }
        return rule;
    }
}

export type RuleContext = { stack: TSQRule[] };
export namespace RuleContext {
    export function popAndCopy(context: RuleContext): [TSQRule | undefined, RuleContext];
    export function popAndCopy(context: undefined): [undefined, undefined];
    export function popAndCopy(context?: RuleContext): [undefined, undefined] | [TSQRule | undefined, RuleContext];
    export function popAndCopy(context?: RuleContext): [undefined, undefined] | [TSQRule | undefined, RuleContext] {
        if (!context) {
            return [undefined, undefined];
        }
        let rule: TSQRule | undefined = context?.stack.at(-1);
        let copy: RuleContext = { ...context, stack: context.stack.slice(0, -1) };
        return [rule, copy];
    }

    export function push(rule: TSQRule, context?: RuleContext): RuleContext {
        return { ...(context ?? {}), stack: [...(context?.stack ?? []), rule] };
    }
}

abstract class AbstractRule {
    public parent?: TSQRule;
    public previousSibling?: TSQRule;
    public nextSibling?: TSQRule;
    abstract readonly id: number;
    abstract readonly grammar: ReGrammar;
    abstract terminality: Terminality;
    abstract readonly type: string;
    *yieldAncestorsAscending() {
        let ancestor = this.parent;
        while (!!ancestor) {
            yield ancestor;
            ancestor = ancestor.parent;
        }
        return;
    }

    get isSupertype(): boolean {
        return false;
    }

    get nextAncester(): TSQRule | undefined {
        return this.parent?.nextSibling ?? this.parent?.nextAncester;
    }

    allTerminalSubrulesMatchingTerminalNode(node: TSNode): TSQRule[] {
        return this.terminalDescendants().filter(rule => rule.matchesTerminalNode(node));
    }

    thisOrFirstTerminals(context?: RuleContext): TSQRule[] {
        switch (this.terminality) {
            case Terminality.Terminal:
            case Terminality.PseudoTerminal:
                return [this as unknown as TSQRule];
            case Terminality.NonTerminal:
                return this.firstTerminalDescendants(context);
        }
        // return this.terminality !== Terminality.NonTerminal ? [this as unknown as TSQRule] : this.firstTerminalDescendants();
    }

    thisOrTerminalDescendants(context?: RuleContext): TSQRule[] {
        return this.terminality !== Terminality.NonTerminal ? [this as unknown as TSQRule] : this.terminalDescendants();
    }

    terminalDescendants(context?: RuleContext): TSQRule[] {
        return this.children.flatMap(child => child.thisOrTerminalDescendants(context));
    }

    *yieldNextSiblings() {
        let nextSibling = this.nextSibling;
        while (!!nextSibling) {
            yield nextSibling;
            nextSibling = nextSibling.nextSibling;
        }
        return;
    }

    subsequentTerminals(seen: Set<number> = new Set()): TSQRule[] {
        let terminals: TSQRule[] = [];
        if (!(this.parent instanceof TSQRule.Choice)) {
            for (let sibling of this.yieldNextSiblings()) {
                terminals.push(...sibling.thisOrTerminalDescendants());
            }
        }
        terminals.push(...(this.parent?.subsequentTerminals() ?? []));
        // let queue: TSQRule[] = this.nextTerminals();
        // let terminal = queue.shift();
        // while (terminal) {
        //     if (!seen.has(terminal.id)) {
        //         seen.add(terminal.id);
        //         terminals.push(terminal);
        //         let subsequent = terminal.subsequentTerminals(seen);
        //         queue.push(...subsequent);
        //     }
        //     terminal = queue.shift();
        // }
        return terminals;
    }

    nextTerminals(context?: RuleContext): TSQRule[] {
        if (!this.parent) {
            let [parent, newContext] = RuleContext.popAndCopy(context);
            if (!parent) {
                return [];
            }
            return parent.nextTerminals(newContext);
        }
        if (!this.nextSibling || this.parent instanceof TSQRule.Choice) {
            return this.parent.nextTerminals(context);
        }
        return this.nextSibling.thisOrFirstTerminals(context);
    }

    matchesOrContainsTerminalDefinition(node: TSNode, context?: RuleContext): boolean {
        return this.matchesTerminalNode(node, context) || this.canContainTerminalNode(node, context);
    }

    canContainTerminalNode(node: TSNode, context?: RuleContext): boolean {
        return this.children.some(child => child.matchesOrContainsTerminalDefinition(node, context));
    }

    abstract matchesTerminalNode(node: TSNode, context?: RuleContext): boolean;

    abstract firstTerminalDescendants(context?: RuleContext): TSQRule[];

    abstract get children(): TSQRule[];
}

export namespace TSQRule {
    export function fromRule(rule_: Rule, IDs: Counter, grammar: ReGrammar, name?: string): TSQRule {
        let rule = _fromRule(rule_, IDs, grammar);
        grammar.addRule(rule, name);
        return rule;
    }
    export function _fromRule(rule_: Rule, IDs: Counter, grammar: ReGrammar): TSQRule {
        switch (rule_.type) {
            case 'BLANK':
                return Blank.fromRule(rule_, IDs, grammar);
            case 'STRING':
                return String.fromRule(rule_, IDs, grammar);
            case 'PATTERN':
                return Pattern.fromRule(rule_, IDs, grammar);
            case 'SYMBOL':
                return Symbol.fromRule(rule_, IDs, grammar);
            case 'SEQ':
                return Sequence.fromRule(rule_, IDs, grammar);
            case 'CHOICE':
                return Choice.fromRule(rule_, IDs, grammar);
            case 'ALIAS':
                return Alias.fromRule(rule_, IDs, grammar);
            case 'REPEAT':
                return Repeat.fromRule(rule_, IDs, grammar);
            case 'REPEAT1':
                return Repeat1.fromRule(rule_, IDs, grammar);
            case 'RESERVED':
                return Reserved.fromRule(rule_, IDs, grammar);
            case 'TOKEN':
            case 'IMMEDIATE_TOKEN':
                return Token.fromRule(rule_, IDs, grammar);
            case 'FIELD':
                return Field.fromRule(rule_, IDs, grammar);
            case 'PREC':
            case 'PREC_LEFT':
            case 'PREC_RIGHT':
            case 'PREC_DYNAMIC':
                return Precedence.fromRule(rule_, IDs, grammar);
        }
    }

    export function deduplicate(rules: TSQRule[]): TSQRule[] {
        let seen = new Set<number>();
        return rules.filter(rule => seen.has(rule.id) || seen.add(rule.id) || true);
    }
    abstract class StubbyRule extends AbstractRule {
        readonly terminality = Terminality.Terminal;
        readonly isPopulated = true;
        firstTerminalDescendants(context?: RuleContext): TSQRule[] {
            return [];
        }
        get children(): TSQRule[] {
            return [];
        }
    }
    export class Blank extends StubbyRule {
        readonly type = 'BLANK';
        constructor(
            public readonly id: number, //
            public readonly grammar: ReGrammar
        ) {
            super();
        }

        matchesTerminalNode(node: TSNode): boolean {
            switch (TSNode.quantifier(node)) {
                case '?':
                case '*':
                    return true;
                default:
                    return false;
            }
        }

        static fromRule(rule: Rule.Blank, IDs: Counter, grammar: ReGrammar): Blank {
            return new Blank(IDs.next(), grammar);
        }
    }
    export class String extends StubbyRule {
        readonly type = 'STRING';
        constructor(
            public readonly id: number, //
            public readonly grammar: ReGrammar,
            public value: string
        ) {
            super();
        }
        static fromRule(rule: Rule.String, IDs: Counter, grammar: ReGrammar): String {
            return new String(IDs.next(), grammar, rule.value);
        }

        matchesTerminalNode(node: TSNode): boolean {
            if (node.type !== 'anonymous_node') {
                return false;
            }
            let nameField = node.childForFieldName('name') ?? undefined;
            if (!nameField) {
                return false;
            }
            switch (nameField.isNamed) {
                case undefined:
                    return false;
                case false:
                    return nameField.type === '_';
                case true:
                    return this.value === TSNode.stringContent(node);
            }
        }
    }
    export class Pattern extends StubbyRule {
        readonly type = 'PATTERN';
        private _regex?: RegExp;
        constructor(
            public readonly id: number, //
            public readonly grammar: ReGrammar,
            public value: string,
            public flags?: string
        ) {
            super();
        }

        get regex(): RegExp | undefined {
            if (!this._regex) {
                try {
                    let _regex = new RegExp(this.value, this.flags);
                    this._regex = _regex;
                } catch (e) {
                    console.error(e);
                }
            }
            return this._regex;
        }

        static fromRule(rule: Rule.Pattern, IDs: Counter, grammar: ReGrammar): Pattern {
            return new Pattern(IDs.next(), grammar, rule.value, rule.flags);
        }

        matchesTerminalNode(node: TSNode): boolean {
            let content = TSNode.stringContent(node);
            return !!content && !!this.regex && this.regex.test(content); // TODO ?
        }
    }
    export class Symbol extends AbstractRule {
        readonly type = 'SYMBOL';
        terminality: Terminality = Terminality.PseudoTerminal;
        readonly isPopulated: boolean = true;
        constructor(
            public readonly id: number, //
            public readonly grammar: ReGrammar,
            public name: string
        ) {
            super();
        }

        firstTerminalDescendants(context?: RuleContext): TSQRule[] {
            if (this.isHidden) {
                return this.grammar.topLevelRules.get(this.name)?.firstTerminalDescendants(context) ?? [];
            }
            return [];
        }

        get children(): TSQRule[] {
            return [];
        }

        get isSupertype(): boolean {
            return this.grammar.supertypeNames.has(this.name);
        }

        get isHidden(): boolean {
            return this.name.startsWith('_') || this.isSupertype;
        }

        matchesTerminalNode(node: TSNode): boolean {
            let name: string | undefined = nameOfNamedNode(node);
            if (!name) {
                return false;
            }
            if (name === '_' || name === this.name) {
                return true;
            }
            if (this.isSupertype) {
                let subtypes = this.grammar.get(this.name)?.thisOrTerminalDescendants() || [];
                return !!subtypes.length && subtypes.some(st => st.matchesTerminalNode(node));
            }
            return false;
        }

        static fromRule(rule: Rule.Symbol, IDs: Counter, grammar: ReGrammar): Symbol {
            return new Symbol(IDs.next(), grammar, rule.name);
        }
    }
    abstract class RuleWithMembers extends AbstractRule {
        terminality: Terminality = Terminality.NonTerminal;
        constructor(public readonly id: number, public readonly grammar: ReGrammar, public members: TSQRule[]) {
            super();
            for (let member of members) {
                member.parent = this as TSQRule;
            }
            for (let [elder, younger] of single.pairwise(this.members)) {
                elder.nextSibling = younger;
                younger.previousSibling = elder;
            }
        }

        matchesTerminalNode(node: TSNode): boolean {
            return false;
        }

        get children(): TSQRule[] {
            return this.members;
        }
    }

    export class Sequence extends RuleWithMembers {
        readonly type = 'SEQ';

        firstTerminalDescendants(): TSQRule[] {
            return firstOf(this.children)?.thisOrFirstTerminals() ?? [];
        }

        static fromRule(rule: Rule.Sequence, IDs: Counter, grammar: ReGrammar): Sequence {
            return new Sequence(
                IDs.next(),
                grammar,
                rule.members.map(member => fromRule(member, IDs, grammar))
            );
        }
    }
    export class Choice extends RuleWithMembers {
        readonly type = 'CHOICE';

        firstTerminalDescendants(): TSQRule[] {
            return this.members.flatMap(member => member.thisOrFirstTerminals());
        }

        // nextTerminals(): TSQRule[] {
        //     return this.children.flatMap(child => child.thisOrFirstTerminals());
        // }

        static fromRule(rule: Rule.Choice, IDs: Counter, grammar: ReGrammar): Choice {
            return new Choice(
                IDs.next(),
                grammar,
                rule.members.map(member => fromRule(member, IDs, grammar))
            );
        }
    }

    abstract class RuleWithContent extends AbstractRule {
        // content: TSQRule;
        terminality: Terminality = Terminality.NonTerminal;
        constructor(public content: TSQRule) {
            super();
            this.content.parent = this as TSQRule;
        }

        get children(): TSQRule[] {
            return [this.content];
        }

        firstTerminalDescendants(): TSQRule[] {
            return this.content.thisOrFirstTerminals();
        }

        matchesTerminalNode(node: TSNode): boolean {
            return false;
        }
    }

    export class Alias extends RuleWithContent {
        readonly type = 'ALIAS';
        terminality = Terminality.PseudoTerminal;
        constructor(
            public readonly id: number, //
            public readonly grammar: ReGrammar,
            public value: string,
            public named: boolean,
            public content: TSQRule
        ) {
            super(content);
        }

        static fromRule(rule: Rule.Alias, IDs: Counter, grammar: ReGrammar): Alias {
            return new Alias(IDs.next(), grammar, rule.value, rule.named, TSQRule.fromRule(rule.content, IDs, grammar));
        }

        follow(): TSQRule[] {
            switch (this.content.type) {
                case 'SYMBOL':
                    let rule = this.grammar.get(this.content.name);
                    return !!rule ? [rule] : [];
                default:
                    return [this.content];
            }
        }

        matchesValue(node: TSNode): boolean {
            if (this.named) {
                return node.type === 'named_node' && nameOfNamedNode(node) === this.value;
            }
            return TSNode.stringContent(node) === this.value;
        }

        matchesTerminalNode(node: TSNode): boolean {
            return this.matchesValue(node) || this.content.matchesTerminalNode(node);
        }
    }

    export class Repeat extends RuleWithContent {
        readonly type = 'REPEAT';
        constructor(
            public readonly id: number, //
            public readonly grammar: ReGrammar,
            public content: TSQRule
        ) {
            super(content);
        }
        static fromRule(rule: Rule.Repeat, IDs: Counter, grammar: ReGrammar): Repeat {
            return new Repeat(IDs.next(), grammar, TSQRule.fromRule(rule.content, IDs, grammar));
        }
    }
    export class Repeat1 extends RuleWithContent {
        readonly type = 'REPEAT1';
        constructor(
            public readonly id: number, //
            public readonly grammar: ReGrammar,
            public content: TSQRule
        ) {
            super(content);
        }
        static fromRule(rule: Rule.Repeat1, IDs: Counter, grammar: ReGrammar): Repeat1 {
            return new Repeat1(IDs.next(), grammar, TSQRule.fromRule(rule.content, IDs, grammar));
        }
    }
    export class Reserved extends RuleWithContent {
        readonly type = 'RESERVED';
        constructor(
            public readonly id: number, //
            public readonly grammar: ReGrammar,
            public readonly context_name: string,
            public content: TSQRule
        ) {
            super(content);
        }
        static fromRule(rule: Rule.Reserved, IDs: Counter, grammar: ReGrammar): Reserved {
            return new Reserved(IDs.next(), grammar, rule.context_name, TSQRule.fromRule(rule.content, IDs, grammar));
        }
    }
    export class Token extends RuleWithContent {
        // readonly type: 'TOKEN' | 'IMMEDIATE_TOKEN' = 'TOKEN';
        constructor(
            public readonly id: number, //
            public readonly grammar: ReGrammar,
            public readonly type: 'TOKEN' | 'IMMEDIATE_TOKEN',
            public content: TSQRule
        ) {
            super(content);
        }
        static fromRule(rule: Rule.Token, IDs: Counter, grammar: ReGrammar): Field {
            return new Field(IDs.next(), grammar, rule.type, TSQRule.fromRule(rule.content, IDs, grammar));
        }
    }
    export class Field extends RuleWithContent {
        readonly type = 'FIELD';
        constructor(
            public readonly id: number, //
            public readonly grammar: ReGrammar,
            public readonly name: string,
            public content: TSQRule
        ) {
            super(content);
        }
        static fromRule(rule: Rule.Field, IDs: Counter, grammar: ReGrammar): Field {
            return new Field(IDs.next(), grammar, rule.name, TSQRule.fromRule(rule.content, IDs, grammar));
        }
    }
    export class Precedence extends RuleWithContent {
        constructor(
            public readonly id: number, //
            public readonly grammar: ReGrammar,
            public readonly type: 'PREC' | 'PREC_LEFT' | 'PREC_RIGHT' | 'PREC_DYNAMIC',
            public content: TSQRule
        ) {
            super(content);
        }
        static fromRule(rule: Rule.Precedence, IDs: Counter, grammar: ReGrammar): Precedence {
            return new Precedence(IDs.next(), grammar, rule.type, TSQRule.fromRule(rule.content, IDs, grammar));
        }
    }
}

export type Identifiable<T = any> = T & { id: number };
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

export type IdentifiableStub = Identifiable<RuleStub>;
export namespace IdentifiableStub {
    export function from(rule: Rule, id: number): IdentifiableStub {
        return Identifiable.from(RuleStub.fromRule(rule), id);
    }
}

export type Grammar<R extends string = string> = {
    name: string;
    rules: Record<R, Rule>;
    inherits?: string;
    extras?: Rule[];
    precedences?: R[][];
    reserved?: Record<string, Rule[]>;
    externals?: Rule[];
    inline?: R[];
    conflicts?: R[][];
    word?: R;
    supertypes?: R[];
};

type Numbers = [number, ...number[]];

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

function matchesAnonymousNode(rule: Rule, node: AnonymousNode): boolean {
    return (Rule.isAnonymous(rule) && node.isWildcard) || (rule.type === 'STRING' && node.name === rule.value);
}

type Error = NonDescript | UnrecognizedNode;

type NonDescript = {
    type: 'NonDescript';
    message?: string;
    context?: any;
};

type UnrecognizedNode = {
    type: 'UnrecognizedNode';
    node: TSNode;
};

export class FlatGrammar {
    stubs: Identifiable<RuleStub>[] = [];
    nextSiblingMap = new Dict<number, number>();
    childToParent = new Dict<number, number>();
    parentToChildren = new Dict<number, Set<number>>();
    nameMap = new Dict<string, number>();
    constructor(grammar: Grammar) {
        let count = 0;
        let queue: Identifiable<Rule>[] = [];
        for (let [name, rule] of Object.entries(grammar.rules)) {
            this.nameMap.set(name, count);
            queue.push(Identifiable.from(rule, count));
            count += 1;
        }
        let current = queue.shift();
        while (!!current) {
            this.stubs.push(IdentifiableStub.from(current, current.id));

            switch (current.type) {
                case 'SEQ':
                case 'CHOICE':
                    let mappedMembers = current.members.map(member => {
                        if (!current) {
                            throw 'Current is somehow impossibly undefined';
                        }
                        let child = Identifiable.from(member, count);
                        this._addParentChildEntry(current.id, count);
                        queue.push(child);
                        count += 1;
                        return child;
                    });
                    for (let [elder, younger] of single.pairwise(mappedMembers)) {
                        this.nextSiblingMap.set(elder.id, younger.id);
                    }
                    break;
                case 'ALIAS':
                case 'REPEAT':
                case 'REPEAT1':
                case 'RESERVED':
                case 'TOKEN':
                case 'IMMEDIATE_TOKEN':
                case 'FIELD':
                case 'PREC':
                case 'PREC_LEFT':
                case 'PREC_RIGHT':
                case 'PREC_DYNAMIC':
                    queue.push(Identifiable.from(current.content, count));
                    count += 1;
                    this._addParentChildEntry(current.id, count);
            }
            current = queue.shift();
            // count += 1;
        }

        // for (let [name, topLevelRule] of Object.entries(grammar.rules)) {
        //     this.stubs.push(IdentifiableStub.from(topLevelRule, count));
        //     this.nameMap.set(name, count);
        //     let parentID = count;
        //     let queue: Identifiable<Rule>[] = [];
        //     switch (topLevelRule.type) {
        //         case 'SEQ':
        //         case 'CHOICE':
        //             let mappedMembers = topLevelRule.members.map(member => {
        //                 count += 1;
        //                 this._addParentChildEntry(parentID, count);
        //                 return Identifiable.from(member, count);
        //             });
        //             for (let [elder, younger] of single.pairwise(mappedMembers)) {
        //                 this.nextSiblingMap.set(elder.id, younger.id);
        //             }
        //             queue.push(...mappedMembers);
        //             break;
        //         case 'ALIAS':
        //         case 'REPEAT':
        //         case 'REPEAT1':
        //         case 'RESERVED':
        //         case 'TOKEN':
        //         case 'IMMEDIATE_TOKEN':
        //         case 'FIELD':
        //         case 'PREC':
        //         case 'PREC_LEFT':
        //         case 'PREC_RIGHT':
        //         case 'PREC_DYNAMIC':
        //             count += 1;
        //             queue.push(Identifiable.from(topLevelRule.content, count));
        //             this._addParentChildEntry(parentID, count);
        //     }
        // let current = queue.shift();
        // while (current !== undefined) {
        //     // let [id, rule] = current;
        //     this.stubs.push(current);

        //     switch (current.type) {
        //         case 'SEQ':
        //         case 'CHOICE':
        //             let mappedMembers = current.members.map(member => {
        //                 count += 1;
        //                 // this.childToParent.set(count, current.id);
        //                 if (!current) {
        //                     throw 'Current is somehow impossibly undefined';
        //                 }
        //                 this._addParentChildEntry(current.id, count);
        //                 return IdentifiableStub.from(member, count);
        //             });
        //             for (let [elder, younger] of single.pairwise(mappedMembers)) {
        //                 this.nextSiblingMap.set(elder.id, younger.id);
        //             }
        //             break;
        //         case 'ALIAS':
        //         case 'REPEAT':
        //         case 'REPEAT1':
        //         case 'RESERVED':
        //         case 'TOKEN':
        //         case 'IMMEDIATE_TOKEN':
        //         case 'FIELD':
        //         case 'PREC':
        //         case 'PREC_LEFT':
        //         case 'PREC_RIGHT':
        //         case 'PREC_DYNAMIC':
        //             count += 1;
        //             queue.push(Identifiable.from(current.content, count));
        //             this._addParentChildEntry(current.id, count);
        //     }
        //     current = queue.shift();
        // }
        // count += 1;
        // }
    }

    isTerminal(stub: IdentifiableStub): boolean {
        return Terminality.ofRule(stub) === Terminality.Terminal;
    }

    isPseudoTerminal(stub: IdentifiableStub): boolean {
        return Terminality.ofRule(stub) === Terminality.PseudoTerminal;
    }

    isNonTerminal(stub: IdentifiableStub): boolean {
        return Terminality.ofRule(stub) === Terminality.NonTerminal;
    }

    isTerminalish(stub: IdentifiableStub): boolean {
        return Terminality.ofRule(stub) !== Terminality.NonTerminal;
    }

    _nextAncestor(arg: IdentifiableStub | number | undefined): IdentifiableStub | undefined {
        let current = this.get(arg);
        if (!current) {
            return;
        }
        for (let ancestor of this.yieldLineageAscending(current)) {
        }
        let parent = this.getParent(current);
        while (!parent) {
            let pibling = this.getNextSibling(parent);
            if (!!pibling) {
                return pibling;
            }
            current = parent;
            parent = this.getParent(parent);
        }
        return;
    }

    *yieldLineageAscending(arg: Identifiable | number | undefined) {
        let parent = this.getParent(arg);
        while (!!parent) {
            yield parent;
            parent = this.getParent(parent);
        }
        return;
    }

    nextPseudoTerminals(node: Identifiable): IdentifiableStub[];
    nextPseudoTerminals(id: number): IdentifiableStub[];
    nextPseudoTerminals(arg: Identifiable | number): IdentifiableStub[];
    nextPseudoTerminals(arg: Identifiable | number): IdentifiableStub[] {
        let current = this.get(arg);
        if (!current) {
            return [];
        }

        for (let ancestor of this.yieldLineageAscending(current)) {
            let next: IdentifiableStub | undefined =
                ancestor.type === 'CHOICE' ? this.getNextSibling(ancestor) : this.getNextSibling(current);
            switch (Terminality.ofRule(next)) {
                case Terminality.Terminal:
                case Terminality.PseudoTerminal:
                    return [next!];
                case Terminality.NonTerminal:
                    let nexts = this.firstTerminalChildrenOf(next);
                    if (!!nexts.length) {
                        return nexts;
                    }
                case undefined:
                    break;
            }
            current = ancestor;
        }

        return [];
    }

    getNextSibling(arg: Identifiable | number): IdentifiableStub | undefined {
        let siblingID = this._getNextSiblingID(arg);
        return siblingID === undefined ? undefined : this.get(siblingID);
    }

    _getNextSiblingID(arg: Identifiable | number): number | undefined {
        return this.nextSiblingMap.get(Identifiable.reduce(arg));
    }

    _addParentChildEntry(parent: IdentifiableStub | number, child: IdentifiableStub | number) {
        let parentID = Identifiable.reduce(parent);
        let childID = Identifiable.reduce(child);
        this.childToParent.set(childID, parentID);
        if (!this.parentToChildren.has(parentID)) {
            this.parentToChildren.set(parentID, new Set([childID]));
        } else {
            this.parentToChildren.get(parentID)?.add(childID);
        }
    }

    firstChildOf(parent: Identifiable): Identifiable<RuleStub> | undefined;
    firstChildOf(parentID: number): Identifiable<RuleStub> | undefined;
    firstChildOf(arg: number): Identifiable<RuleStub> | undefined;
    firstChildOf(arg: Identifiable | number): Identifiable<RuleStub> | undefined {
        const id = Identifiable.reduce(arg);
        const firstID = [...(this.parentToChildren.get(id) ?? [])].at(0);
        if (!firstID) {
            return;
        }
        const first = this.stubs.at(firstID);
        return !first ? undefined : { ...first, id: firstID };
    }

    get(arg: IdentifiableStub | number | undefined): IdentifiableStub | undefined {
        if (typeof arg !== 'number') {
            return arg;
        }
        return this._getByID(arg);
    }
    _getParentID(arg: IdentifiableStub | number | undefined): number | undefined {
        return arg === undefined ? undefined : this.childToParent.get(Identifiable.reduce(arg));
    }

    getParent(arg: IdentifiableStub | number | undefined): IdentifiableStub | undefined {
        let parentID = this._getParentID(arg);
        return parentID === undefined ? undefined : this.get(parentID);
    }

    _getByID(id: number | undefined): IdentifiableStub | undefined {
        return id === undefined ? undefined : this.stubs.at(id);
    }

    _typeOf(rule: Identifiable<RuleStub>): RuleStub['type'];
    _typeOf(id: number): RuleStub['type'] | undefined;
    _typeOf(undefined_: undefined): undefined;
    _typeOf(arg: Identifiable<RuleStub> | number): RuleStub['type'] | undefined;
    _typeOf(arg: Identifiable<RuleStub> | number | undefined): RuleStub['type'] | undefined {
        if (typeof arg !== 'number') {
            return arg?.type;
        }
        return this._getByID(arg)?.type;
    }

    firstTerminalChildrenOf(parent: Identifiable): Identifiable<RuleStub>[];
    firstTerminalChildrenOf(parentID: number): Identifiable<RuleStub>[];
    firstTerminalChildrenOf(arg: Identifiable | number): Identifiable<RuleStub>[];
    firstTerminalChildrenOf(arg: Identifiable | number): Identifiable<RuleStub>[] {
        if (this._typeOf(arg) === 'CHOICE') {
            return this.getChildrenOf(arg).flatMap(child => {
                if (Terminality.ofRule(child) !== Terminality.NonTerminal) {
                    return child;
                }
                return this.firstTerminalChildrenOf(child);
            });
            // return child
        }

        for (let child of this.yieldTerminalChildren(arg)) {
            return [child];
        }
        return [];
    }

    *yieldTerminalChildren(arg: Identifiable | number): Generator<Identifiable<RuleStub>, undefined, unknown> {
        let children = this.getChildrenOf(arg);
        let child = children.shift();
        while (!!child) {
            if (Terminality.ofRule(child) !== Terminality.NonTerminal) {
                children.unshift(...this.getChildrenOf(child));
            } else {
                yield child;
            }
            child = children.shift();
        }
        return;
    }

    getTerminalChildrenOf(arg: Identifiable | number): Identifiable<RuleStub>[] {
        // let id = Identifiable.reduce(arg);
        let terminals: Identifiable<RuleStub>[] = [];
        let children = this.getChildrenOf(arg);
        let child = children.shift();
        while (!!child) {
            if (Terminality.ofRule(child) === Terminality.NonTerminal) {
                children.unshift(...this.getChildrenOf(child));
            } else {
                terminals.push(child);
            }

            child = children.shift();
        }
        return terminals;
    }

    getChildrenOf(parentID: Identifiable): Identifiable<RuleStub>[];
    getChildrenOf(id: number): Identifiable<RuleStub>[];
    getChildrenOf(arg: Identifiable | number): Identifiable<RuleStub>[];
    getChildrenOf(arg: Identifiable | number): Identifiable<RuleStub>[] {
        let parentID = Identifiable.reduce(arg);
        let childrenIDs = this.parentToChildren.get(parentID);
        if (!childrenIDs) {
            return [];
        }
        return [...childrenIDs].map(id => Identifiable.tryFrom(this.stubs.at(id), id)).filter(isNotNullish);
    }

    *yieldChildrenIDs(arg: Identifiable | number) {
        let parentID = Identifiable.reduce(arg);
        let childrenIDs = this.parentToChildren.get(parentID ?? -1);
        for (let childID of childrenIDs ?? []) {
            yield childID;
        }
        return undefined;
    }

    *yieldChildrenOf(arg: Identifiable | number) {
        for (let childID of this.yieldChildrenIDs(arg)) {
            let child = this.stubs.at(childID);
            if (!!child) {
                yield child;
            }
        }
        return;
    }
}

export class TSQGrammar {
    constructor(public grammar: Grammar, public types: NodeTypes.Categorized) {}

    mcguffinNamedNodeRule(node: TSNode): Error[] {
        if (node.type !== 'named_node' || !node.isNamed) {
            return [];
        }
        let identifier = Identifier.ofNode(node);
        if (!identifier) {
            return [{ type: 'NonDescript', message: 'named_node has no name', context: node } satisfies NonDescript];
        }
        let name = identifier.text;
        let rule = this.resolveRuleFor(name);
        if (!rule) {
            return [{ type: 'UnrecognizedNode', node: identifier } satisfies UnrecognizedNode];
        }
        switch (rule.type) {
            case 'BLANK':
            case 'STRING':
            case 'PATTERN':
                let children = node.children.filter(isNotNullish).filter(TSNode.isDefinitionChild);
                return children.map(child => {
                    return {
                        type: 'NonDescript',
                        message: `"${rule.type}"-type Rule "${name}" cannot have child definitions`,
                    } satisfies NonDescript;
                });
            case 'SEQ':

            case 'CHOICE':
            case 'REPEAT':
            case 'REPEAT1':
            case 'FIELD':
                return [];
            default:
                rule satisfies never;
                throw `Unhandled Rule type "${rule['type']}"`;
        }
    }

    // matchThingy(node: TSNode, rule: PathedRule): TSNode[] {
    //     let nodes = TSNode.firstPseudoTerminalDescendants(node);
    //     if (!nodes.length) {
    //         return [];
    //     }
    //     let map = new Dict<number, Set<string>>();
    //     let pairs = nodes.map(node_ => ...this.matchingNodePathableRulePairs(node_, rule));
    // }

    matchingPathableRules(node: TSNode, rule: PathedRule): PathedRule[] {
        let matching: PathedRule[] = [];
        for (let subrule of PathedRule.walkTerminals(rule, this)) {
            this.terminalNodeMatchesTerminalRule(node, subrule) && matching.push(subrule);
        }
        return matching;
    }

    terminalNodeMatchesTerminalRule(node: TSNode, rule: PathedRule): boolean {
        switch (rule.type) {
            case 'BLANK':
                return false;
            case 'STRING':
                return node.type === 'anonymous_node' && (node.text === '_' || node.text.slice(1, -2) === rule.value);
            case 'PATTERN':
                return false;
            case 'SYMBOL':
                return node.type === 'named_node' && nameOfNamedNode(node) === rule.name;
            case 'SEQ':
            case 'CHOICE':
            case 'ALIAS':
            case 'REPEAT':
            case 'REPEAT1':
            case 'RESERVED':
            case 'TOKEN':
            case 'IMMEDIATE_TOKEN':
            case 'FIELD':
            case 'PREC':
            case 'PREC_LEFT':
            case 'PREC_RIGHT':
            case 'PREC_DYNAMIC':
                return false;
        }
    }

    matchingNodePathableRulePairs(node: TSNode, rule: PathedRule): [TSNode, PathedRule][] {
        return this.matchingPathableRules(node, rule).map(subrule => [node, subrule]);
    }

    // matchSequence(node: TSNode, rule: Rule.Sequence): boolean {
    //     // if () {}
    // }

    mcguffinNamedNodeChildren(node: TSNode, name: string, rule: Rule) {
        let round = TSNode.firstPseudoTerminalDescendants(node);
        while (!!round.length) {}
    }

    mcguffinTerminalRule(node: TSNode, rule: Rule) {}

    hmm(pattern: Pattern, rule: Rule, seen: Set<string> = new Set()) {
        if (Pattern.hasMembers(pattern) && Rule.hasMembers(rule)) {
        } else if (Pattern.hasMembers(pattern)) {
            return;
        } else if (Rule.hasMembers(rule)) {
        } else {
            switch (pattern.type) {
                case 'AnonymousNode':
                    return (
                        Rule.isAnonymous(rule) &&
                        (pattern.name === '_' || (rule.type === 'STRING' && pattern.name === rule.value))
                    );
                case 'FieldDefinition':
                case 'MissingNode':
                case 'NamedNode':
                case 'Predicate':
                case 'NegatedField':
            }
        }
        return undefined;
    }

    // nextImmediateRules(rule: Rule, seen: Set<string> = new Set()): [Rule, number[]][] {
    //     switch () {}
    // }

    canIGetUhhh(pattern: Pattern, rule: Rule) {}

    *generateNextPossibleRules(rules: Rule[], seen: Set<string> = new Set()) {
        return rules.flatMap(rule => {});
        // switch (rules.type) {
        //     case 'BLANK':
        //     case 'STRING':
        //     case 'PATTERN':
        //         yield [rules];
        //         return [];
        //     case 'SYMBOL':
        //         if (seen.has(rules.name)) {
        //             return [];
        //         }
        //         yield [rules];
        //         let newRule = this.ruleFor(rules);
        //         yield* this.generateNextRule(newRule, seen);
        //         return;
        //     case 'SEQ':
        //         for (let member of rules.members) {
        //             yield* this.generateNextRule(member);
        //         }
        //     case 'CHOICE':
        //     case 'ALIAS':
        //     case 'REPEAT':
        //     case 'REPEAT1':
        //     case 'RESERVED':
        //     case 'TOKEN':
        //     case 'IMMEDIATE_TOKEN':
        //     case 'FIELD':
        //     case 'PREC':
        //     case 'PREC_LEFT':
        //     case 'PREC_RIGHT':
        //     case 'PREC_DYNAMIC':
        // }
    }

    hasLiteral(literal: string): boolean {
        return this.types.literals.map(node => node.type).includes(literal as Literal);
    }

    hasAnonymousNode(node: AnonymousNode): boolean {
        return node.isWildcard || this.hasLiteral(node.name);
    }

    hasNamedNode(node: NamedNode): boolean {
        return node.name === '_' || this.hasRule(node.name);
    }

    get ruleNames(): string[] {
        return Object.getOwnPropertyNames(this.grammar.rules);
    }

    iterateRulePaths(): RulePath[] {
        let paths: RulePath[] = [];
        for (let [name, rule] of Object.entries(this.grammar.rules)) {
            let path: RulePath = [name];
            let indices = Rule.index(rule);
            paths.push(...indices.map(i => [name, ...i] satisfies RulePath));
        }

        return paths;
    }

    hasHidden(rule: Rule.Symbol): boolean;
    hasHidden(name: string): boolean;
    hasHidden(arg: Rule.Symbol | string): boolean {
        let name = Rule.nameFrom(arg);
        return name.startsWith('_') || this.hasSupertype(name);
    }

    getHidden(arg: Rule.Symbol | string) {
        let name = Rule.nameFrom(arg);
        return name.startsWith('_') ? this.ruleFor(name) : this.getSupertype(name);
    }

    hasSupertype(name: string): boolean;
    hasSupertype(symbol: Rule.Symbol): boolean;
    // hasSupertype(arg: Rule.Symbol | string): boolean;
    hasSupertype(arg: Rule.Symbol | string): boolean {
        let name = typeof arg === 'string' ? arg : arg.name;
        return !!this.grammar.supertypes && this.grammar.supertypes.includes(name);
    }

    getSupertype(arg: Rule.Symbol | string): Rule.Choice | undefined {
        return this._getSupertype(arg);
    }

    _getSupertype(arg: Rule.Symbol | string, emitWarnings: boolean = true): Rule.Choice | undefined {
        const name = Rule.nameFrom(arg);
        if (!this.hasSupertype(name)) {
            emitWarnings && console.warn(`Attempted to get non-supertype supertype "${name}"`);
            return;
        }
        let supertype = this.ruleFor(name);
        if (!supertype) {
            emitWarnings && console.warn(`Unable to find supertype "${name}"`);
            return;
        }
        if (supertype.type !== 'CHOICE') {
            emitWarnings && console.warn(`Supertype "${name}" was not type "CHOICE": "${supertype.type}"`);
            return;
        }
        return supertype;
    }

    indexIntoRule(rule: Rule, index: number): Rule | undefined {
        switch (rule.type) {
            case 'BLANK':
                console.warn(`${rule.type} rule cannot be indexed`);
                return;
            case 'STRING':
            case 'PATTERN':
                console.warn(`${rule.type} rule "${rule.value}" cannot be indexed`);
                return;
            case 'SYMBOL':
                if (index !== 0) {
                    console.warn(`Invalid index for ${rule.type} ${rule.name}: '${index}'`);
                    return;
                }
                return this.ruleFor(rule);
            case 'SEQ':
            case 'CHOICE':
                return rule.members.at(index);
            case 'ALIAS':
                if (index !== 0) {
                    console.warn(`Invalid index for ${rule.type} '${rule.value}': '${index}'`);
                    return;
                }
                return rule.content;

            case 'FIELD':
            case 'REPEAT':
            case 'RESERVED':
            case 'TOKEN':
            case 'IMMEDIATE_TOKEN':
            case 'PREC':
            case 'PREC_LEFT':
            case 'PREC_RIGHT':
            case 'PREC_DYNAMIC':
                if (index !== 0) {
                    console.warn(`Invalid index for ${Rule.format(rule)}: '${index}'`);
                    return;
                }
                return rule.content;
            case 'REPEAT1':
                if (index !== 0 && index !== 1) {
                    console.warn(`Invalid index for ${rule.type}: '${index}'`);
                    return;
                }
                return rule.content;
                break;
            default:
                console.error(`Supposedly impossible state is definitiely possible ...`);
                return;
        }
    }

    rulesInPath(name: string, indices: number[]): Rule[] {
        const first = this.ruleFor(name);
        if (!first) {
            return [];
        }
        let rules: Rule[] = [];
        let rule: Rule | undefined = first;
        for (let index of indices) {
            if (!rule) {
                break;
            }
            rules.push(rule);
            rule = this.indexIntoRule(rule, index);
        }

        return rules;
    }

    ruleFromPath(name: string, path_: number[]): Rule | undefined {
        let rule: Rule | undefined = this.ruleFor(name);
        let path = [...path_];
        // let index: number | undefined = path.shift();
        for (let index of path_) {
            if (!rule) {
                break;
            }
            rule = this.indexIntoRule(rule, index);
        }
        return rule;
    }

    ruleCanContainPseudoTerminalChild(rule: Rule, child: PseudoTerminalChild): boolean {
        switch (rule.type) {
            case 'BLANK':
                return child.type === 'NegatedField';
            case 'STRING':
                return child.type === 'AnonymousNode' && (child.isWildcard || rule.value === child.name);
            case 'PATTERN':
                console.debug(
                    `PATTERN '${rule.value} w PseudoTerminalChild of type '${child.type}'` + !!rule.flags
                        ? `' w flags '${rule.flags}'`
                        : ''
                );
                return false; // TODO ?
            case 'SYMBOL':
                if (!Rule.isHidden(this.grammar, rule)) {
                    return child.type === 'NamedNode' && rule.name === child.name;
                } else {
                    let resolved = this.resolveRuleFor(rule.name);
                    return !!resolved && this.ruleCanContainPseudoTerminalChild(resolved, child);
                }
            case 'SEQ':
            case 'CHOICE':
                return rule.members.some(member => this.ruleCanContainPseudoTerminalChild(member, child));
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
                return this.ruleCanContainPseudoTerminalChild(rule.content, child);
            case 'FIELD':
                return child.type === 'FieldDefinition' && rule.name === child.name;
        }
    }

    hasDefinition(definition: Definition | NegatedField): boolean {
        switch (definition.type) {
            case 'AnonymousNode':
                return this.hasAnonymousNode(definition);
            case 'FieldDefinition':
                break; // TODO
            case 'Grouping':
                return definition.members.filter(isNotAnchor).every(member => this.hasDefinition(member));
            case 'List':
                return definition.members.every(member => this.hasDefinition(member));
            case 'MissingNode':
                break;
            case 'NamedNode':
                return this.hasRule(definition.name);
            case 'Predicate':
                break;
        }
        return false;
    }

    hasRule(name: string): boolean {
        return name in this.grammar.rules;
    }

    ruleFor(arg: TSNode | string | Rule.Symbol | undefined): Rule | undefined {
        if (typeof arg === 'string') {
            return !(arg in this.grammar.rules) ? undefined : this.grammar.rules[arg];
        }
        if (typeof arg !== 'object') {
            return arg;
        }
        if ('name' in arg) {
            return this.ruleFor(arg.name);
        }
        if (arg.type === 'named_node') {
            return this.ruleFor(nameOfNamedNode(arg));
        }
        // if (!arg) {
        //     typeof arg;
        //     //       ^?
        //     return arg;
        // }
        return undefined;
    }

    getRuleByName(name: string): Rule | undefined {
        return !(name in this.grammar.rules) ? undefined : this.grammar.rules[name];
    }

    getPathedRuleByName(name: string): PathedRule | undefined {
        let rule = this.getRuleByName(name);
        return !rule ? undefined : { ...rule, path: [name] };
    }

    matchingSubRules(node: TSNode, rule: PathedRule): PathedRule[] {
        return []; // TODO;
    }

    resolveRuleFor(arg: TSNode | string | undefined): ResolvedRule | undefined {
        let rule = this.ruleFor(arg);
        const MAX_DEPTH = 1000;
        for (let _iteration of exclusiveRange(MAX_DEPTH)) {
            switch (rule?.type) {
                case undefined:
                    return undefined;
                case 'SYMBOL':
                    rule = this.ruleFor(rule);
                    continue;
                case 'ALIAS':
                case 'PREC':
                case 'PREC_LEFT':
                case 'PREC_RIGHT':
                case 'PREC_DYNAMIC':
                case 'RESERVED':
                case 'TOKEN':
                case 'IMMEDIATE_TOKEN':
                    rule = rule.content;
                    continue;
                case 'FIELD':
                case 'REPEAT':
                case 'REPEAT1':
                case 'BLANK':
                case 'STRING':
                case 'PATTERN':
                case 'SEQ':
                case 'CHOICE':
                    return rule;
                default:
                    rule satisfies never;
                // throw `unhandled case "${rule?.type}"`;
            }
        }
        throw `Max resolution depth of '${MAX_DEPTH}' reached`;
    }

    ruleIsHidden(symbol: Rule.Symbol): boolean | undefined;
    ruleIsHidden(name: string): boolean | undefined;
    ruleIsHidden(arg: string | Rule.Symbol): boolean | undefined;
    ruleIsHidden(arg: string | Rule.Symbol): boolean | undefined {
        arg = typeof arg === 'string' ? arg : arg.name;
        if (!this.hasRule(arg)) {
            return;
        }
        return arg.startsWith('_') || arg in (this.grammar.supertypes ?? []);
    }

    // pseudoTerminalChildCanBelongToRule(child: PseudoTerminalChild): boolean {

    // }

    definitionCanBeChildOfRule(definition: Definition | NegatedField, rule: Rule): boolean {
        if (definition.type === 'Grouping' || definition.type === 'List') {
            return definition.members.every(
                (member: Definition | '.') => member === '.' || this.definitionCanBeChildOfRule(member, rule)
            );
        }
        switch (rule.type) {
            case 'BLANK':
                return definition.type === 'NegatedField';
            case 'STRING':
                return definition.type === 'AnonymousNode' && (definition.isWildcard || definition.name === rule.value);
            case 'PATTERN':
                return true; // TODO
            case 'SYMBOL':
                if (definition.type === 'NamedNode' && definition.name === rule.name) {
                    return true;
                }
                let resolved: ResolvedRule | undefined = this.resolveRuleFor(rule.name);
                return !!resolved && this.definitionCanBeChildOfRule(definition, resolved);
            case 'SEQ':
            case 'CHOICE':
                return rule.members.some(member => this.definitionCanBeChildOfRule(definition, member));
            case 'ALIAS':
            case 'REPEAT':
            case 'REPEAT1':
            case 'TOKEN':
            case 'IMMEDIATE_TOKEN':
            case 'PREC':
            case 'PREC_LEFT':
            case 'PREC_RIGHT':
            case 'PREC_DYNAMIC':
            case 'RESERVED':
                return this.definitionCanBeChildOfRule(definition, rule.content);
            case 'FIELD':
                return definition.type === 'FieldDefinition' && definition.name === rule.name;
        }
    }

    identifyPseudoTerminalOrphan(orphan: PseudoTerminalChild): StructuralDiagnostic[] {
        switch (orphan.type) {
            case 'AnonymousNode':
                return this.hasAnonymousNode(orphan) ? [] : [`Unrecognized AnonymousNode "${orphan.name}"`];
            case 'FieldDefinition':
                return []; // TODO
            case 'MissingNode':
                return []; // TODO
            case 'NamedNode':
                return this.hasNamedNode(orphan) ? [] : [`Unrecognized NamedNode "${orphan.name}"`];
            case 'NegatedField':
                return []; // TODO
        }
    }

    identifyOrphan(orphan: Definition | NegatedField | '.'): StructuralDiagnostic[] {
        if (orphan === '.') {
            return [];
        }
        return flattenChildIdentity(orphan).flatMap(child => this.identifyPseudoTerminalOrphan(child));
    }

    // identifyPseudoTerminalChild(parent: NamedNode, child: PseudoTerminalChild): StructuralDiagnostic[] {
    //     let asOrphan = this.identifyPseudoTerminalOrphan(child);
    //     if (!!asOrphan.length) {
    //         return asOrphan;
    //     }
    // }

    identifyChild(parent: NamedNode, child: DefinitionChild, rule: Rule): StructuralDiagnostic[] {
        let terminals = flattenChildIdentity(child);
        return terminals.flatMap(terminal => {
            let asOrphan = this.identifyPseudoTerminalOrphan(terminal);
            if (!!asOrphan.length) {
                return asOrphan;
            }
            if (this.ruleCanContainPseudoTerminalChild(rule, terminal)) {
                return [];
            }
            return `NamedNode '${parent.name}' has no child of type `;
        });
    }

    OrphanList(list: List) {
        list.members.flatMap(member => !this.hasDefinition(member));
    }

    nextMatchingIndex(rule: Rule, child: DefinitionChild, index: number[]) {
        if (!index.length) {
            return;
        }
        let current = this.subStateFromIndices(rule, index as Indices);
        if (!current) return undefined;
    }

    theThing(rule: Rule, children: DefinitionChild[]) {
        let child = children.shift();
        while (!!child) {}
    }

    subStateFromIndex(rule: Rule, index: number): Rule | undefined {
        switch (rule.type) {
            case 'SYMBOL': {
                let subRule = this.ruleFor(rule);
                return !subRule ? undefined : this.subStateFromIndex(subRule, index);
            }
            case 'SEQ':
            case 'CHOICE': {
                let result = rule.members.at(index);
                result || console.error(`Out-of-bounds index ${rule.type}[${index}] for ${rule.members.length}-length members`);
                return result;
            }
            case 'REPEAT':
                if (index === 0) {
                    return rule.content;
                }
                console.error(`Invalid REPEAT index '${index}'`);
                return undefined;
            case 'REPEAT1':
                switch (index) {
                    case 0: // First item
                    case 1: //(n + 1)th item
                        return rule.content;
                    default:
                        console.error(`Invalid REPEAT1 index '${index}'`);
                        return undefined;
                }

            case 'BLANK':
            case 'STRING':
            case 'PATTERN':
                if (index === 0) {
                    return rule;
                }
                console.error(`Invalid index: ${rule.type}[${index}]`);
                return undefined;
            case 'ALIAS':
            case 'RESERVED':
            case 'TOKEN':
            case 'IMMEDIATE_TOKEN':
            case 'FIELD':
            case 'PREC':
            case 'PREC_LEFT':
            case 'PREC_RIGHT':
            case 'PREC_DYNAMIC':
                return this.subStateFromIndex(rule.content, index);
        }
    }

    statesFromIndices(rule: Rule, indices: Indices): Rule[] {
        let states: Rule[] = [rule];
        let current: Rule | undefined = rule;
        for (let index of indices) {
            current = this.subStateFromIndex(current, index);
            if (!current) {
                break;
            }
            states.push(current);
        }
        return states;
    }

    subStateFromIndices(rule: Rule, indices: Indices): Rule | undefined {
        let current: Rule | undefined = rule;
        for (let index of indices) {
            if (!!current) {
                current = this.subStateFromIndex(current, index);
            }
        }
        return current;
    }

    iterateRuleIndices(rule: Rule, seen: string | Set<string> = new Set(), stack: Indices | [] = []): Indices[] {
        if (typeof seen === 'string') {
            seen = new Set(seen);
        }
        switch (rule.type) {
            case 'BLANK':
            case 'STRING':
            case 'PATTERN':
                return [[...(stack as Indices)]];
            case 'SEQ':
            case 'CHOICE':
                return rule.members.flatMap((member, index, _) => this.iterateRuleIndices(member, seen, [...stack, index]));
            case 'SYMBOL':
                if (seen.has(rule.name)) {
                    return [];
                }
                seen.add(rule.name);
                let subrule = this.ruleFor(rule);
                if (!subrule) {
                    return [];
                }
                // return [[...stack, 0], ...this.iterateRuleIndices(subrule, seen, [...stack, 0])];
                return [[...stack, 0], ...this.iterateRuleIndices(subrule, seen, [...stack, 0])];
            case 'ALIAS':
            case 'RESERVED':
            case 'TOKEN':
            case 'IMMEDIATE_TOKEN':
            case 'PREC':
            case 'PREC_LEFT':
            case 'PREC_RIGHT':
            case 'PREC_DYNAMIC':
                return this.iterateRuleIndices(rule.content, seen, [...stack]);
            case 'REPEAT':
                return this.iterateRuleIndices(rule.content, seen).map(inner => [...stack, ...inner]);
            case 'REPEAT1':
                return this.iterateRuleIndices(rule.content, seen).flatMap(
                    inner =>
                        [
                            [...stack, 0, ...inner],
                            [...stack, 1, ...inner],
                        ] satisfies [Indices, Indices]
                );
            case 'FIELD':
                return [[...stack, 0], ...this.iterateRuleIndices(rule.content, seen, [...stack, 0])];
        }
    }

    matchingSubstates(rule: Rule, child?: DefinitionChild): RuleState[] {
        return []; // TODO
    }

    nextPossibleStates(rule: Rule, child: DefinitionChild, currentStates: RuleState[]): RuleState[] {
        return []; // TODO
    }

    mcguffinDefinitionIdentityAndLineage(definition: Pattern, parent?: Rule): any[] {
        switch (definition.type) {
            case 'AnonymousNode':
                if (!this.hasAnonymousNode(definition)) {
                    return [`Unrecognized AnonymousNode "${definition.name}"`];
                }
                if (!!parent && !this.definitionCanBeChildOfRule(definition, parent)) {
                    return [`Invalid child-parent pair: {${Pattern.format(definition)} · ${Rule.format(parent)}}`];
                }
                return [];
            case 'FieldDefinition':
                return this.hasField(definition.name) ? [] : [`Unrecognized FieldDefinition "${definition.name}"`];
            case 'Grouping':
                let hmm = definition.members.filter(isNotAnchor); //.flatMap(member => this.mcguffinDefinitionIdentity(member));
            case 'List':
            case 'MissingNode':
            case 'NamedNode':
            case 'Predicate':
            case 'NegatedField':
        }
        return [];
    }
    hasField(name: string): boolean {
        throw new Error('Method not implemented.');
    }

    mcguffinNamedNode(rule: Rule, children: Pattern[]) {
        let unrecognized: any[] = [];
        let nonChildren: any[] = [];

        let errors: any[] = [];

        let current: RuleState[] = this.matchingSubstates(rule, children.shift());
        let checkStructure: boolean = true;
        if (!current.length) return;
        let next: RuleState[] = [];
        for (let child of children) {
            if (checkStructure) {
                next = this.nextPossibleStates(rule, child, current);
                if (!!next.length) {
                    current = next;
                    continue;
                }
                checkStructure = false;
            }
            if (this.definitionCanBeChildOfRule(child, rule)) {
                errors;
            } else {
            }
        }
    }

    ruleFromRulePath(path: RulePath): Rule | undefined {
        let [name, ...indices] = path;
        indices.slice;
        let rule = this.ruleFor(name);
        if (!rule || !Indices.is(indices)) {
            return;
        }
        return this.subStateFromIndices(rule, indices);
    }

    pathedRuleFromRulePath(path: RulePath): PathedRule | undefined {
        let rule = this.ruleFromRulePath(path);
        if (!rule) {
            return;
        }
        return {
            path,
            ...rule,
        };
    }

    parentFromPathedRule(rule: PathedRule): PathedRule | undefined {
        let path: RulePath | undefined = RulePath.parentPath(rule.path);
        return !path ? undefined : this.pathedRuleFromRulePath(path);
    }

    nextSibling(rule: PathedRule): PathedRule | undefined {
        if (rule.path.length === 1) {
            return;
        }
        let [name, ...indices] = RulePath.copy(rule.path);
        indices.push(indices.pop()! + 1);
        return this.pathedRuleFromRulePath([name, ...indices]);
    }

    nextPseudoTerminalSiblings(rule: PathedRule): PathedRule[] {
        let parent = this.parentFromPathedRule(rule);
        if (parent?.type === 'CHOICE') {
            return this.nextPseudoTerminalSiblings(parent);
        }

        let next: PathedRule | undefined = this.nextSibling(rule);
        while (!!next) {
            switch (Terminality.ofRule(next)) {
                case Terminality.Terminal:
                case Terminality.PseudoTerminal:
                    return [next];
                case Terminality.NonTerminal:
            }
        }
        switch (rule.type) {
            case 'CHOICE':
            // next = this.pseudoTerminalDescendants(rule);
            case 'BLANK':
            case 'STRING':
            case 'PATTERN':
            case 'SYMBOL':
            case 'SEQ':
            case 'ALIAS':
            case 'REPEAT':
            case 'REPEAT1':
            case 'RESERVED':
            case 'TOKEN':
            case 'IMMEDIATE_TOKEN':
            case 'FIELD':
            case 'PREC':
            case 'PREC_LEFT':
            case 'PREC_RIGHT':
            case 'PREC_DYNAMIC':
        }
        // if (!next)
        // if (!next.length && !parent) {
        //     return [];
        // }
        return []; // TODO
    }
    firstPseudoTerminalDescendants(rule: PathedRule): PathedRule[] {
        return []; // TODO
    }

    pseudoTerminalDescendants(rule: PathedRule): PathedRule[] {
        switch (rule.type) {
            case 'BLANK':
            case 'STRING':
            case 'PATTERN':
                return [];
            case 'SYMBOL':
            case 'SEQ':

            case 'CHOICE':
            case 'ALIAS':
            case 'REPEAT':
            case 'REPEAT1':
            case 'RESERVED':
            case 'TOKEN':
            case 'IMMEDIATE_TOKEN':
            case 'FIELD':
            case 'PREC':
            case 'PREC_LEFT':
            case 'PREC_RIGHT':
            case 'PREC_DYNAMIC':
        }
        return []; // TODO
    }

    mcguffin(rule: Rule, children: Pattern[]) {}
}

export type RuleState = Indices;

// type TSRule = TSRule.All;
// abstract class AbstractRule {
//     parent: AbstractRule | undefined;
//     nextSibling: AbstractRule | undefined;
//     static readonly isTerminal: boolean;
//     static readonly isPseudoTerminal: boolean;

//     get isSubRule(): boolean {
//         return !this.parent;
//     }

//     get nextSiblings(): AbstractRule[] {
//         if (this.parent instanceof TSRule.Choice) {
//             return this.parent?.nextSiblings ?? [];
//         }
//         return !!this.nextSibling ? [this.nextSibling] : [];
//     }
// }

// export namespace TSRule {
//     export type All = Blank | Choice;
//     export class Blank extends AbstractRule {
//         static readonly type = 'BLANK';
//         static readonly isTerminal = true;
//         static readonly isPseudoTerminal = true;
//     }

//     export class String extends AbstractRule {
//         static readonly type = 'STRING';
//         static readonly isTerminal = true;
//         static readonly isPseudoTerminal = true;
//         constructor(public readonly value: string) {
//             super();
//         }
//     }

//     export class Pattern extends AbstractRule {
//         static readonly isTerminal = true;
//         static readonly isPseudoTerminal = true;
//         constructor(public readonly value: string, public readonly flags?: string) {
//             super();
//         }
//     }

//     export class Symbol extends AbstractRule {
//         static readonly isTerminal = false;
//         static readonly isPseudoTerminal = false;
//     }

//     export class Choice extends AbstractRule {
//         static readonly isTerminal = false;
//         static readonly isPseudoTerminal = false;
//         constructor(public members: TSRule[]) {
//             super();
//         }
//     }
// }

type HasRulePath = {
    path: RulePath;
};

type PathedRule = Rule & HasRulePath;

// const TERMINALTIES = ['Terminal', 'PseudoTerminal', 'NonTerminal'] satisfies Terminality[];

export enum Terminality {
    Terminal = 'Terminal',
    PseudoTerminal = 'PseudoTerminal',
    NonTerminal = 'NonTerminal',
}

export namespace Terminality {
    export function ofRule(
        rule:
            | Rule.Sequence
            | Rule.Choice
            | Rule.Alias
            | Rule.Repeat
            | Rule.Repeat1
            | Rule.Reserved
            | Rule.Field
            | Rule.Precedence
    ): Terminality.NonTerminal;
    export function ofRule(rule: Rule.Symbol | Rule.Token): Terminality.PseudoTerminal;
    export function ofRule(rule: Rule.Blank | Rule.String | Rule.Pattern): Terminality.Terminal;
    export function ofRule(rule: RuleStub | undefined): Terminality | undefined;
    export function ofRule(rule: RuleStub | undefined): Terminality | undefined {
        switch (rule?.type) {
            case undefined:
                return undefined;
            case 'BLANK':
            case 'STRING':
            case 'PATTERN':
                return Terminality.Terminal;
            case 'SYMBOL':
            case 'TOKEN':
            case 'IMMEDIATE_TOKEN':
                return Terminality.PseudoTerminal;
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
                return Terminality.NonTerminal;
        }
    }
}

export namespace PathedRule {
    export function* walk(rule: PathedRule, grammar: TSQGrammar) {
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

    export function* walkTerminals(rule: PathedRule, grammar: TSQGrammar) {
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
    | Rule.Blank
    | Rule.String
    | Rule.Pattern
    | Rule.Sequence
    | Rule.Choice
    | Rule.Field
    | Rule.Repeat
    | Rule.Repeat1;
export type NamedRule = Extends<Rule, { name: string }>;
export type Extends<T, E> = T extends E ? T : never;
export type TerminalRule = Rule.Blank | Rule.String | Rule.Pattern;
export type PseudoTerminalRule = TerminalRule | Rule.Symbol | Rule.Field;
export type RuleOf<G extends Grammar> = keyof G['rules'];

export type Rule =
    | Rule.Blank
    | Rule.String
    | Rule.Pattern
    | Rule.Symbol
    | Rule.Sequence
    | Rule.Choice
    | Rule.Alias
    | Rule.Repeat
    | Rule.Repeat1
    | Rule.Reserved
    | Rule.Token
    | Rule.Field
    | Rule.Precedence;

export namespace Rule {
    export type Blank = {
        type: 'BLANK';
    };

    export type String = {
        type: 'STRING';
        value: string;
    };

    export type Pattern = {
        type: 'PATTERN';
        value: string;
        flags?: string;
    };

    export type Symbol = {
        type: 'SYMBOL';
        name: string;
    };

    export type Sequence = {
        type: 'SEQ';
        members: Rule[];
    };

    export type Choice = {
        type: 'CHOICE';
        members: Rule[];
    };

    export type Alias = {
        type: 'ALIAS';
        value: string;
        named: boolean;
        content: Rule;
    };

    export type Repeat = {
        type: 'REPEAT';
        content: Rule;
    };

    export type Repeat1 = {
        type: 'REPEAT1';
        content: Rule;
    };

    export type Reserved = {
        type: 'RESERVED';
        context_name: string;
        content: Rule;
    };

    export type Token = {
        type: 'TOKEN' | 'IMMEDIATE_TOKEN';
        content: Rule;
    };

    export type Field = {
        name: string;
        type: 'FIELD';
        content: Rule;
    };

    export type Precedence = {
        type: 'PREC' | 'PREC_LEFT' | 'PREC_RIGHT' | 'PREC_DYNAMIC';
        value: number | string;
        content: Rule;
    };
}

export namespace Rule {
    export const TYPES: Rule['type'][] = [
        'BLANK',
        'STRING',
        'PATTERN',
        'SYMBOL',
        'SEQ',
        'CHOICE',
        'ALIAS',
        'REPEAT',
        'REPEAT1',
        'RESERVED',
        'TOKEN',
        'IMMEDIATE_TOKEN',
        'FIELD',
        'PREC',
        'PREC_LEFT',
        'PREC_RIGHT',
        'PREC_DYNAMIC',
    ];

    const DEFAULT_FORMAT_OPTIONS = {
        childLimit: 40,
    };

    export function format(rule: Rule, options = DEFAULT_FORMAT_OPTIONS): string {
        switch (rule.type) {
            case 'BLANK':
                return rule.type;
            case 'STRING':
                return `"${rule.value}"`;
            case 'PATTERN':
                return `/${rule.value}/`;
            case 'SYMBOL':
                return `(${rule.name})`;
            case 'SEQ':
            case 'CHOICE':
                let inner: string = '...';
                let members = rule.members.map(member => format(member, options));
                let joined = members.join(' ');
                if (joined.length < options.childLimit) {
                    inner = joined;
                } else if (members.at(0) && members.at(0)!.length < options.childLimit) {
                    inner = `${members[0]!} ...`;
                }
                return rule.type === 'SEQ' ? `(${inner})` : `[${inner}]`;
            case 'ALIAS':
                let content = format(rule.content, options);
                let value = rule.named ? `(${rule.value})` : `"${rule.value}"`;
                return `${content} as ${value}`;
            case 'REPEAT':
            case 'REPEAT1':
            case 'RESERVED':
            case 'TOKEN':
            case 'IMMEDIATE_TOKEN':
            case 'PREC':
            case 'PREC_LEFT':
            case 'PREC_RIGHT':
            case 'PREC_DYNAMIC':
                return `${rule.type} { ${format(rule.content)} }`;
            case 'FIELD':
                return `${rule.name}: ${format(rule.content)}`;
        }
    }

    export function hasName(rule: Rule): rule is Symbol | Field {
        return 'name' in rule;
    }

    export function isAnonymous(rule: Rule): rule is String | Pattern {
        return rule.type === 'STRING' || rule.type === 'PATTERN';
    }

    export function nameFrom(arg: Rule.Symbol | Rule.Field | string): string {
        return typeof arg === 'string' ? arg : arg.name;
    }

    export function hasMembers(rule: Rule): rule is Sequence | Choice {
        return rule.type === 'SEQ' || rule.type === 'CHOICE';
    }

    export function isSupertype(grammar: Grammar, rule: Rule): boolean {
        switch (rule.type) {
            // case "BLANK":
            // case "STRING":
            // case "PATTERN":
            case 'SYMBOL':
                return rule.name in (grammar.supertypes ?? []);
            // case "SEQ":
            // case "CHOICE":
            case 'ALIAS':
            // case "REPEAT":
            case 'RESERVED':
            case 'TOKEN':
            case 'IMMEDIATE_TOKEN':
            case 'FIELD':
            case 'PREC':
            case 'PREC_LEFT':
            case 'PREC_RIGHT':
            case 'PREC_DYNAMIC':
                return isSupertype(grammar, rule.content);
            default:
                return false;
        }
    }

    export function isHidden(grammar: Grammar, rule: Rule): boolean {
        return (hasName(rule) && rule.name.startsWith('_')) || isSupertype(grammar, rule);
    }

    export function isTerminal(rule: Rule): rule is TerminalRule {
        switch (rule.type) {
            case 'BLANK':
            case 'STRING':
            case 'PATTERN':
                return true;
        }
        return false;
    }

    export function withName(name: string | undefined, grammar: Grammar): Rule | undefined {
        return !!name && name in grammar.rules ? grammar.rules[name] : undefined;
    }

    export function index(rule: Rule): number[][] {
        let indices = index(rule);
        let subIndices = Rule.subIndices(rule);
        return CartesianSpread(indices, subIndices);
    }

    export function indices(rule: Rule): number[] {
        switch (rule.type) {
            case 'BLANK':
            case 'STRING':
            case 'PATTERN':
            case 'SYMBOL':
            case 'ALIAS':
            case 'REPEAT':
            case 'RESERVED':
            case 'TOKEN':
            case 'IMMEDIATE_TOKEN':
            case 'FIELD':
            case 'PREC':
            case 'PREC_LEFT':
            case 'PREC_RIGHT':
            case 'PREC_DYNAMIC':
            case 'SEQ':
            case 'CHOICE':
                return [0];
            case 'REPEAT1':
                return [0, 1];
        }
    }

    export function subIndices(rule: Rule): number[][] {
        switch (rule.type) {
            case 'BLANK':
            case 'STRING':
            case 'PATTERN':
            case 'SYMBOL':
                return [];
            case 'SEQ':
            case 'CHOICE':
                return rule.members.flatMap((member, index_, _) => CartesianSpread([[index_]], index(member)));
            case 'ALIAS':
            case 'REPEAT':
            case 'RESERVED':
            case 'TOKEN':
            case 'IMMEDIATE_TOKEN':
            case 'FIELD':
            case 'PREC':
            case 'PREC_LEFT':
            case 'PREC_RIGHT':
            case 'PREC_DYNAMIC':
            case 'REPEAT1':
                return index(rule.content);
        }
    }
}

export type RuleStub =
    | Rule.Blank
    | Rule.String
    | Rule.Pattern
    | Rule.Symbol
    | Omit<Rule.Sequence | Rule.Choice, 'members'>
    | Omit<Rule.Repeat | Rule.Repeat1, 'content'>
    | Omit<Rule.Token, 'content'>
    | Omit<Rule.Alias, 'content'>
    | Omit<Rule.Reserved, 'content'>
    | Omit<Rule.Field, 'content'>
    | Omit<Rule.Precedence, 'content'>;

export namespace RuleStub {
    export function fromRule(rule: Rule): RuleStub {
        switch (rule.type) {
            case 'BLANK':
            case 'STRING':
            case 'PATTERN':
            case 'SYMBOL':
                return rule;
            case 'SEQ':
            case 'CHOICE':
            case 'REPEAT':
            case 'REPEAT1':
            case 'TOKEN':
            case 'IMMEDIATE_TOKEN':
                return { type: rule.type };
            case 'ALIAS':
                return { type: rule.type, value: rule.value, named: rule.named };
            case 'RESERVED':
                return { type: rule.type, context_name: rule.context_name };
            case 'FIELD':
                return { type: rule.type, name: rule.name };
            case 'PREC':
            case 'PREC_LEFT':
            case 'PREC_RIGHT':
            case 'PREC_DYNAMIC':
                return { type: rule.type, value: rule.value };
        }
    }
}

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
