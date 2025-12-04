import { GrammarJSON } from './Grammar';
import { Identifiable } from './junk_drawer';
import { Terminality } from './Terminality';
import { CartesianSpread } from './untitled';

export type RuleJSON =
    | RuleJSON.Blank
    | RuleJSON.String
    | RuleJSON.Pattern
    | RuleJSON.Symbol
    | RuleJSON.Sequence
    | RuleJSON.Choice
    | RuleJSON.Alias
    | RuleJSON.Repeat
    | RuleJSON.Repeat1
    | RuleJSON.Reserved
    | RuleJSON.Token
    | RuleJSON.Field
    | RuleJSON.Precedence;

export namespace RuleJSON {
    export const TYPES: RuleJSON['type'][] = [
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
    ] as const;

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
        members: RuleJSON[];
    };

    export type Choice = {
        type: 'CHOICE';
        members: RuleJSON[];
    };

    export type Alias = {
        type: 'ALIAS';
        value: string;
        named: boolean;
        content: RuleJSON;
    };

    export type Repeat = {
        type: 'REPEAT';
        content: RuleJSON;
    };

    export type Repeat1 = {
        type: 'REPEAT1';
        content: RuleJSON;
    };

    export type Reserved = {
        type: 'RESERVED';
        context_name: string;
        content: RuleJSON;
    };

    export type Token = {
        type: 'TOKEN' | 'IMMEDIATE_TOKEN';
        content: RuleJSON;
    };

    export type Field = {
        name: string;
        type: 'FIELD';
        content: RuleJSON;
    };

    export type Precedence = {
        type: 'PREC' | 'PREC_LEFT' | 'PREC_RIGHT' | 'PREC_DYNAMIC';
        value: number | string;
        content: RuleJSON;
    };
}
export type HasRuleType<T extends RuleJSON['type'] = RuleJSON['type']> = { type: T };
export namespace HasRuleType {
    export function terminalityOf(rule?: HasRuleType): Terminality | undefined {
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

export namespace RuleJSON {
    const DEFAULT_FORMAT_OPTIONS = {
        childLimit: 40,
    };

    export function format(rule: RuleJSON, options = DEFAULT_FORMAT_OPTIONS): string {
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

    export function hasName(rule: RuleJSON): rule is Symbol | Field {
        return 'name' in rule;
    }

    export function isAnonymous(rule: RuleJSON): rule is String | Pattern {
        return rule.type === 'STRING' || rule.type === 'PATTERN';
    }

    export function nameFrom(arg: RuleJSON.Symbol | RuleJSON.Field | string): string {
        return typeof arg === 'string' ? arg : arg.name;
    }

    export function hasMembers(rule: RuleJSON): rule is Sequence | Choice {
        return rule.type === 'SEQ' || rule.type === 'CHOICE';
    }

    export function isSupertype(grammar: GrammarJSON, rule: RuleJSON): boolean {
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

    export function isHidden(grammar: GrammarJSON, rule: RuleJSON): boolean {
        return (hasName(rule) && rule.name.startsWith('_')) || isSupertype(grammar, rule);
    }

    export function withName(name: string | undefined, grammar: GrammarJSON): RuleJSON | undefined {
        return !!name && name in grammar.rules ? grammar.rules[name] : undefined;
    }

    export function index(rule: RuleJSON): number[][] {
        let indices = index(rule);
        let subIndices = RuleJSON.subIndices(rule);
        return CartesianSpread(indices, subIndices);
    }

    export function indices(rule: RuleJSON): number[] {
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

    export function subIndices(rule: RuleJSON): number[][] {
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

export type Stub =
    | RuleJSON.Blank
    | RuleJSON.String
    | RuleJSON.Pattern
    | RuleJSON.Symbol
    | Omit<RuleJSON.Sequence | RuleJSON.Choice, 'members'>
    | Omit<RuleJSON.Repeat | RuleJSON.Repeat1, 'content'>
    | Omit<RuleJSON.Token, 'content'>
    | Omit<RuleJSON.Alias, 'content'>
    | Omit<RuleJSON.Reserved, 'content'>
    | Omit<RuleJSON.Field, 'content'>
    | Omit<RuleJSON.Precedence, 'content'>;

export namespace Stub {
    export function fromRuleJSON(ruleJSON: RuleJSON): Stub {
        switch (ruleJSON.type) {
            case 'BLANK':
            case 'STRING':
            case 'PATTERN':
            case 'SYMBOL':
                return ruleJSON;
            case 'SEQ':
            case 'CHOICE':
            case 'REPEAT':
            case 'REPEAT1':
            case 'TOKEN':
            case 'IMMEDIATE_TOKEN':
                return { type: ruleJSON.type };
            case 'ALIAS':
                return { type: ruleJSON.type, value: ruleJSON.value, named: ruleJSON.named };
            case 'RESERVED':
                return { type: ruleJSON.type, context_name: ruleJSON.context_name };
            case 'FIELD':
                return { type: ruleJSON.type, name: ruleJSON.name };
            case 'PREC':
            case 'PREC_LEFT':
            case 'PREC_RIGHT':
            case 'PREC_DYNAMIC':
                return { type: ruleJSON.type, value: ruleJSON.value };
        }
    }
}
export default RuleJSON;
export type IdentifiableStub = Identifiable<Stub>;
export namespace IdentifiableStub {
    export function from(rule: RuleJSON, id: number): IdentifiableStub {
        return Identifiable.from(Stub.fromRuleJSON(rule), id);
    }
}
