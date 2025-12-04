import { single } from 'itertools-ts';
import { AnonymousNode, FieldDefinition, NamedNode } from './Definition';
import { DefinitionChild } from './DefinitionChild';
import { Grammar } from './Grammar';
import { Counter, firstOf } from './itertools';
import { Identifiable, nameOfNamedNode } from './junk_drawer';
import { TSNode } from './reexports';
import { RuleJSON } from './RuleJSON';
import { HasTerminality, KindaTerminal, Terminality } from './Terminality';
import { RuleContext } from './untitled';

export type Type = Rule['type'];
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

class SeenRule {
    set: Set<number> = new Set();
    filter(arg: Rule | number): boolean {
        if (this.has(arg)) {
            return false;
        }
        this.add(arg);
        return true;
    }

    add(arg: Rule | number) {
        this.set.add(Identifiable.reduce(arg));
    }

    has(arg: Rule | number): boolean {
        return this.set.has(Identifiable.reduce(arg));
    }
}

export namespace Rule {
    export function fromRuleJSON(ruleJSON: RuleJSON, IDs: Counter, grammar: Grammar, name?: string): Rule {
        let rule = _fromRuleJSON(ruleJSON, IDs, grammar);
        grammar.addRule(rule, name);
        return rule;
    }

    export function isType<T extends Rule['type']>(rule: Rule, ...types: [T, ...T[]]): rule is Rule & { type: T } {
        return types.includes(rule.type as T);
    }

    export function isNotType<T extends Rule['type']>(
        rule: Rule,
        ...types: [T, ...T[]]
    ): rule is Exclude<Rule, Rule & { type: T }> {
        return !isType(rule, ...types);
    }

    export function _fromRuleJSON(ruleJSON: RuleJSON, IDs: Counter, grammar: Grammar): Rule {
        switch (ruleJSON.type) {
            case 'BLANK':
                return Blank.fromRuleJSON(ruleJSON, IDs, grammar);
            case 'STRING':
                return String.fromRuleJSON(ruleJSON, IDs, grammar);
            case 'PATTERN':
                return Pattern.fromRuleJSON(ruleJSON, IDs, grammar);
            case 'SYMBOL':
                return Symbol.fromRuleJSON(ruleJSON, IDs, grammar);
            case 'SEQ':
                return Sequence.fromRuleJSON(ruleJSON, IDs, grammar);
            case 'CHOICE':
                return Choice.fromRuleJSON(ruleJSON, IDs, grammar);
            case 'ALIAS':
                return Alias.fromRuleJSON(ruleJSON, IDs, grammar);
            case 'REPEAT':
                return Repeat.fromRuleJSON(ruleJSON, IDs, grammar);
            case 'REPEAT1':
                return Repeat1.fromRuleJSON(ruleJSON, IDs, grammar);
            case 'RESERVED':
                return Reserved.fromRuleJSON(ruleJSON, IDs, grammar);
            case 'TOKEN':
            case 'IMMEDIATE_TOKEN':
                return Token.fromRuleJSON(ruleJSON, IDs, grammar);
            case 'FIELD':
                return Field.fromRuleJSON(ruleJSON, IDs, grammar);
            case 'PREC':
            case 'PREC_LEFT':
            case 'PREC_RIGHT':
            case 'PREC_DYNAMIC':
                return Precedence.fromRuleJSON(ruleJSON, IDs, grammar);
        }
    }

    export function deduplicate(rules: Rule[]): Rule[] {
        let seen = new Set<number>();
        return rules.filter(rule => seen.has(rule.id) || seen.add(rule.id) || true);
    }

    namespace ABCs {
        export abstract class AbstractRule extends HasTerminality {
            public parent?: Rule;
            public previousSibling?: Rule;
            public nextSibling?: Rule;
            abstract readonly id: number;
            abstract readonly grammar: Grammar;
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

            abstract matchesTerminalNode(node: TSNode, context?: RuleContext): boolean;
            abstract matchesDefinition(node: DefinitionChild): boolean;

            abstract firstTerminalDescendants(seen?: SeenRule): KindaTerminal<Rule>[];

            abstract get children(): Rule[];

            get directChildren(): Rule[] {
                return this.children;
            }

            get asRule(): Rule {
                return this as unknown as Rule;
            }

            get isSupertype(): boolean {
                return false;
            }

            get inArray() {
                return [this];
            }

            get nextAncester(): Rule | undefined {
                return this.parent?.nextSibling ?? this.parent?.nextAncester;
            }

            get isTopLevel(): boolean {
                return this.grammar.topLevelRules
                    .valuesArray()
                    .map(rule => rule.id)
                    .includes(this.id);
            }

            // get canBeLastRule(): boolean {
            //     // todo
            //     return this.nextTerminals().filter(rule => Rule.i)
            // }

            thisOrFirstTerminals(seen: SeenRule = new SeenRule()): KindaTerminal<Rule>[] {
                if (!seen.filter(this.asRule)) {
                    return [];
                }
                switch (this.terminality) {
                    case Terminality.Terminal:
                    // return [this.asRule as KindaTerminal<Rule>];
                    case Terminality.PseudoTerminal:
                        return [this.asRule as KindaTerminal<Rule>];
                    case Terminality.NonTerminal:
                        return this.firstTerminalDescendants(seen);
                }
                // return this.terminality !== Terminality.NonTerminal ? [this as unknown as TSQRule] : this.firstTerminalDescendants();
            }

            thisOrTerminalDescendants(seen: SeenRule = new SeenRule()): KindaTerminal<Rule>[] {
                if (!seen.filter(this.asRule)) {
                    return [];
                }
                switch (this.asRule.terminality) {
                    case Terminality.Terminal:
                        return [this.asRule as KindaTerminal<Rule>];
                    case Terminality.PseudoTerminal:
                        switch (this.asRule.type) {
                            case 'ALIAS':
                                return this.asRule.inArray;
                            case 'FIELD':
                                return this.parent ? this.asRule.inArray : this.terminalDescendants(seen);
                            case 'SYMBOL':
                        }
                        return [this.asRule as KindaTerminal<Rule>, ...this.terminalDescendants(seen)];
                    case Terminality.NonTerminal:
                        return this.terminalDescendants(seen);
                }
            }

            terminalDescendants(seen: SeenRule = new SeenRule()): KindaTerminal<Rule>[] {
                let result = this.children.flatMap(child => child.thisOrTerminalDescendants(seen));
                return result;
            }

            *yieldNextSiblings() {
                let nextSibling = this.nextSibling;
                while (!!nextSibling) {
                    yield nextSibling;
                    nextSibling = nextSibling.nextSibling;
                }
                return;
            }

            subsequentTerminals(seen: SeenRule = new SeenRule()): KindaTerminal<Rule>[] {
                let terminals: KindaTerminal<Rule>[] = [];
                if (this instanceof Repeat || this instanceof Repeat1) {
                    let terminalDescendants = this.terminalDescendants().filter(rule => seen.filter(rule));
                    terminals.push(...terminalDescendants);
                }
                if (!(this.parent instanceof Choice)) {
                    for (let sibling of this.yieldNextSiblings()) {
                        let siblingTerminalDescendants = (
                            sibling.asKindaTerminal?.inArray ?? sibling.terminalDescendants()
                        ).filter(rule => seen.filter(rule));
                        terminals.push(...siblingTerminalDescendants);
                    }
                }
                terminals.push(...(this.parent?.subsequentTerminals(seen) ?? []));
                return terminals;
            }

            nextTerminals(seen: SeenRule = new SeenRule()): KindaTerminal<Rule>[] {
                if (!this.nextSibling || this.parent instanceof Choice) {
                    return this.parent?.nextTerminals(seen) ?? [];
                }
                return this.nextSibling.thisOrFirstTerminals(seen);
            }

            hasAncestorOfType<T extends Rule['type']>(...types: T[]): boolean {
                for (let ancestor of this.yieldAncestorsAscending()) {
                    if (types.includes(ancestor.type as T)) {
                        return true;
                    }
                }
                return false;
            }
        }

        export abstract class StubbyRule extends AbstractRule {
            readonly terminality = Terminality.Terminal;
            readonly isPopulated = true;
            firstTerminalDescendants(seen: SeenRule = new SeenRule()): KindaTerminal<Rule>[] {
                return [];
            }
            get children(): Rule[] {
                return [];
            }
        }

        export abstract class RuleWithMembers extends AbstractRule {
            readonly terminality = Terminality.NonTerminal;
            constructor(public readonly id: number, public readonly grammar: Grammar, public members: Rule[]) {
                super();
                for (let member of members) {
                    member.parent = this as Rule;
                }
                for (let [elder, younger] of single.pairwise(this.members)) {
                    elder.nextSibling = younger;
                    younger.previousSibling = elder;
                }
            }

            matchesDefinition(node: DefinitionChild): boolean {
                return false;
            }

            matchesTerminalNode(node: TSNode): boolean {
                return false;
            }

            get children(): Rule[] {
                return this.members;
            }
        }
        export abstract class RuleWithContent extends AbstractRule {
            // content: TSQRule;
            // readonly terminality = Terminality.NonTerminal;
            constructor(public content: Rule) {
                super();
                this.content.parent = this.asRule;
            }

            get children(): Rule[] {
                return [this.content];
            }

            firstTerminalDescendants(seen: SeenRule = new SeenRule()): KindaTerminal<Rule>[] {
                return this.content.thisOrFirstTerminals(seen);
            }

            matchesDefinition(node: DefinitionChild): boolean {
                return false;
            }

            matchesTerminalNode(node: TSNode): boolean {
                return false;
            }
        }

        export abstract class RepeatRule extends RuleWithContent {}
    }

    export class Blank extends ABCs.StubbyRule {
        readonly type = 'BLANK';
        constructor(
            public readonly id: number, //
            public readonly grammar: Grammar
        ) {
            super();
        }

        matchesDefinition(node: DefinitionChild): boolean {
            return this.matchesTerminalNode(node.node);
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

        static fromRuleJSON(_ruleJSON: RuleJSON.Blank, IDs: Counter, grammar: Grammar): Blank {
            return new Blank(IDs.next(), grammar);
        }
    }
    export class String extends ABCs.StubbyRule {
        readonly type = 'STRING';
        constructor(
            public readonly id: number, //
            public readonly grammar: Grammar,
            public value: string
        ) {
            super();
        }
        static fromRuleJSON(string_: RuleJSON.String, IDs: Counter, grammar: Grammar): String {
            return new String(IDs.next(), grammar, string_.value);
        }

        matchesValue(value: string) {
            return value === this.value; // || value === JSON.parse(value);
        }

        matchesDefinition(node: DefinitionChild): boolean {
            return node instanceof AnonymousNode && (node.isWildcard || this.matchesValue(node.name));
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
    export class Pattern extends ABCs.StubbyRule {
        readonly type = 'PATTERN';
        private _regex?: RegExp;
        constructor(
            public readonly id: number, //
            public readonly grammar: Grammar,
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

        static fromRuleJSON(pattern: RuleJSON.Pattern, IDs: Counter, grammar: Grammar): Pattern {
            return new Pattern(IDs.next(), grammar, pattern.value, pattern.flags);
        }

        matchesValue(value: string): boolean {
            return this.regex?.test(value) ?? false;
        }

        matchesDefinition(node: DefinitionChild): boolean {
            return node instanceof AnonymousNode && (node.isWildcard || this.matchesValue(node.name));
        }

        matchesTerminalNode(node: TSNode): boolean {
            let content = TSNode.stringContent(node);
            return !!content && !!this.regex && this.regex.test(content); // TODO ?
        }
    }
    export class Symbol extends ABCs.AbstractRule {
        readonly type = 'SYMBOL';
        readonly terminality = Terminality.PseudoTerminal;
        readonly isPopulated: boolean = true;
        constructor(
            public readonly id: number, //
            public readonly grammar: Grammar,
            public name: string
        ) {
            super();
        }

        // thisOrFirstTerminals(context?: RuleContext): KindaTerminal<Rule>[] {
        //     switch (true) {
        //         case this.isSupertype:
        //             return [this, ...this.firstTerminalDescendants()];
        //         case this.isUnderscoreHidden:
        //             return this.firstTerminalDescendants();
        //         default:
        //             return [this];
        //     }
        // }

        thisOrTerminalDescendants(seen: SeenRule = new SeenRule()): KindaTerminal<Rule>[] {
            if (!seen.filter(this)) {
                return [];
            }
            if (this.isSupertype) {
                return this.inArray;
                // return this.terminalDescendants();
                return [this, ...this.terminalDescendants(seen)];
            } else if (this.isUnderscoreHidden) {
                return this.terminalDescendants(seen);
            }
            return [this];
        }

        firstTerminalDescendants(seen: SeenRule = new SeenRule()): KindaTerminal<Rule>[] {
            if (this.isHidden) {
                let result = this.grammar.getByName(this.name)?.flatMap(rule => rule.firstTerminalDescendants(seen)) ?? [];
                return result;
            }
            return [];
        }

        get directChildren(): Rule[] {
            return [];
        }

        get children(): Rule[] {
            if (this.isHidden) {
                return this.grammar.getByName(this.name);
            }
            return [];
        }

        get isSupertype(): boolean {
            return this.grammar.supertypeNames.has(this.name);
        }

        get isUnderscoreHidden(): boolean {
            return this.name.startsWith('_');
        }

        get isHidden(): boolean {
            return this.isUnderscoreHidden || this.isSupertype;
        }

        matchesDefinition(node: DefinitionChild): boolean {
            if (this.isUnderscoreHidden) {
                return this.children.some(child => child.matchesDefinition(node));
            }
            return (
                node instanceof NamedNode &&
                (node.isWildcard || node.name === this.name || this.subtypes.some(st => st.matchesDefinition(node)))
            );
        }

        matchesTerminalNode(node: TSNode): boolean {
            let name: string | undefined = nameOfNamedNode(node);
            if (!name) {
                return false;
            }
            if (name === '_' || name === this.name) {
                return true;
            }
            return !!this.subtypes.length && this.subtypes.some(st => st.matchesTerminalNode(node));
            // if (this.isSupertype) {
            //     let subtypes = this.grammar.get(this.name)?.thisOrTerminalDescendants() || [];
            //     return !!subtypes.length && subtypes.some(st => st.matchesTerminalNode(node));
            // }
            // return false;
        }

        get subtypes(): Rule[] {
            return !this.isSupertype ? [] : this.grammar.getTopLevelRule(this.name)?.thisOrTerminalDescendants() || [];
        }

        static fromRuleJSON(symbol_: RuleJSON.Symbol, IDs: Counter, grammar: Grammar): Symbol {
            return new Symbol(IDs.next(), grammar, symbol_.name);
        }
    }

    export class Sequence extends ABCs.RuleWithMembers {
        readonly type = 'SEQ';

        firstTerminalDescendants(seen: SeenRule = new SeenRule()): KindaTerminal<Rule>[] {
            return firstOf(this.children)?.thisOrFirstTerminals() ?? [];
        }

        static fromRuleJSON(sequence: RuleJSON.Sequence, IDs: Counter, grammar: Grammar): Sequence {
            return new Sequence(
                IDs.next(),
                grammar,
                sequence.members.map(member => Rule.fromRuleJSON(member, IDs, grammar))
            );
        }
    }
    export class Choice extends ABCs.RuleWithMembers {
        readonly type = 'CHOICE';

        firstTerminalDescendants(seen: SeenRule = new SeenRule()): KindaTerminal<Rule>[] {
            return this.members.flatMap(member => member.thisOrFirstTerminals(seen));
        }

        // matchesMetaNode(node: MetaNode): boolean {
        //     return this.terminalDescendants().some(rule => rule.matchesMetaNode(node));
        // }

        // nextTerminals(): TSQRule[] {
        //     return this.children.flatMap(child => child.thisOrFirstTerminals());
        // }
        static fromRuleJSON(choice: RuleJSON.Choice, IDs: Counter, grammar: Grammar): Choice {
            return new Choice(
                IDs.next(),
                grammar,
                choice.members.map(member => Rule.fromRuleJSON(member, IDs, grammar))
            );
        }
    }

    export class Alias extends ABCs.RuleWithContent {
        readonly type = 'ALIAS';
        readonly terminality = Terminality.PseudoTerminal;
        constructor(
            public readonly id: number, //
            public readonly grammar: Grammar,
            public value: string,
            public named: boolean,
            public content: Rule
        ) {
            super(content);
        }

        static fromRuleJSON(alias: RuleJSON.Alias, IDs: Counter, grammar: Grammar): Alias {
            return new Alias(IDs.next(), grammar, alias.value, alias.named, Rule.fromRuleJSON(alias.content, IDs, grammar));
        }

        // _pseudoTerminalThisOrTerminalDescendants(context?: RuleContext): KindaTerminal<Rule>[] {}

        thisOrFirstTerminals(seen: SeenRule = new SeenRule()): KindaTerminal<Rule>[] {
            if (seen.filter(this)) {
                return [];
            }
            if (this.content.type === 'SYMBOL') {
                return this.content.firstTerminalDescendants(seen);
            }
            return [this];
        }

        follow(): Rule[] {
            switch (this.content.type) {
                case 'SYMBOL':
                    return this.grammar.getByName(this.content.name);
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

        matchesDefinition(node: DefinitionChild): boolean {
            return (
                (this.named && node instanceof NamedNode && node.name === this.value) ||
                (!this.named && node instanceof AnonymousNode && (node.isWildcard || node.name === this.value)) ||
                this.content.matchesDefinition(node)
            );
        }

        matchesTerminalNode(node: TSNode): boolean {
            return this.matchesValue(node) || this.content.matchesTerminalNode(node);
        }
    }

    export class Repeat extends ABCs.RepeatRule {
        readonly type = 'REPEAT';
        readonly terminality = Terminality.NonTerminal;
        constructor(
            public readonly id: number, //
            public readonly grammar: Grammar,
            public content: Rule
        ) {
            super(content);
        }
        static fromRuleJSON(repeat: RuleJSON.Repeat, IDs: Counter, grammar: Grammar): Repeat {
            return new Repeat(IDs.next(), grammar, Rule.fromRuleJSON(repeat.content, IDs, grammar));
        }
    }
    export class Repeat1 extends ABCs.RepeatRule {
        readonly type = 'REPEAT1';
        readonly terminality = Terminality.NonTerminal;
        constructor(
            public readonly id: number, //
            public readonly grammar: Grammar,
            public content: Rule
        ) {
            super(content);
        }
        static fromRuleJSON(repeat1: RuleJSON.Repeat1, IDs: Counter, grammar: Grammar): Repeat1 {
            return new Repeat1(IDs.next(), grammar, Rule.fromRuleJSON(repeat1.content, IDs, grammar));
        }
    }
    export class Reserved extends ABCs.RuleWithContent {
        readonly type = 'RESERVED';
        readonly terminality = Terminality.NonTerminal;
        constructor(
            public readonly id: number, //
            public readonly grammar: Grammar,
            public readonly context_name: string,
            public content: Rule
        ) {
            super(content);
        }
        static fromRuleJSON(reserved: RuleJSON.Reserved, IDs: Counter, grammar: Grammar): Reserved {
            return new Reserved(IDs.next(), grammar, reserved.context_name, Rule.fromRuleJSON(reserved.content, IDs, grammar));
        }
    }
    export class Token extends ABCs.RuleWithContent {
        // readonly type: 'TOKEN' | 'IMMEDIATE_TOKEN' = 'TOKEN';
        readonly terminality = Terminality.NonTerminal;
        constructor(
            public readonly id: number, //
            public readonly grammar: Grammar,
            public readonly type: 'TOKEN' | 'IMMEDIATE_TOKEN',
            public content: Rule
        ) {
            super(content);
        }
        static fromRuleJSON(token: RuleJSON.Token, IDs: Counter, grammar: Grammar): Token {
            return new Token(IDs.next(), grammar, token.type, Rule.fromRuleJSON(token.content, IDs, grammar));
        }
    }
    export class Field extends ABCs.RuleWithContent {
        readonly type = 'FIELD';
        readonly terminality = Terminality.PseudoTerminal;

        constructor(
            public readonly id: number, //
            public readonly grammar: Grammar,
            public readonly name: string,
            public content: Rule
        ) {
            super(content);
        }
        static fromRuleJSON(field: RuleJSON.Field, IDs: Counter, grammar: Grammar): Field {
            return new Field(IDs.next(), grammar, field.name, Rule.fromRuleJSON(field.content, IDs, grammar));
        }

        matchesName(node: DefinitionChild): boolean {
            return node instanceof FieldDefinition && node.name === this.name;
        }

        matchesContent(node?: DefinitionChild): boolean {
            let value = node instanceof FieldDefinition ? node.value : node;
            if (!value) {
                return false;
            }
            return !!value && this.content.thisOrTerminalDescendants().some(rule => rule.matchesDefinition(value));
        }

        matchesDefinition(node: DefinitionChild): boolean {
            if (node instanceof FieldDefinition) {
                return this.matchesName(node) && !!node.value && this.matchesContent(node.value);
            }
            return this.matchesContent(node);
        }
    }
    export class Precedence extends ABCs.RuleWithContent {
        readonly terminality = Terminality.NonTerminal;
        constructor(
            public readonly id: number, //
            public readonly grammar: Grammar,
            public readonly type: 'PREC' | 'PREC_LEFT' | 'PREC_RIGHT' | 'PREC_DYNAMIC',
            public content: Rule
        ) {
            super(content);
        }
        static fromRuleJSON(precedence: RuleJSON.Precedence, IDs: Counter, grammar: Grammar): Precedence {
            return new Precedence(IDs.next(), grammar, precedence.type, Rule.fromRuleJSON(precedence.content, IDs, grammar));
        }
    }
}
// export const Blank = Rule.Blank;
// export const String = Rule.String;
// export const Pattern = Rule.Pattern;
// export const Symbol = Rule.Symbol;
// export const Sequence = Rule.Sequence;
// export const Choice = Rule.Choice;
// export const Alias = Rule.Alias;
// export const Repeat = Rule.Repeat;
// export const Repeat1 = Rule.Repeat1;
// export const Reserved = Rule.Reserved;
// export const Token = Rule.Token;
// export const Field = Rule.Field;
// export const Precedence = Rule.Precedence;

export default Rule;
