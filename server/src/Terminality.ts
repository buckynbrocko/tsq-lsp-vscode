import RuleJSON, { Stub } from './RuleJSON';

// const TERMINALTIES = ['Terminal', 'PseudoTerminal', 'NonTerminal'] satisfies Terminality[];

export enum Terminality {
    Terminal = 'Terminal',
    PseudoTerminal = 'PseudoTerminal',
    NonTerminal = 'NonTerminal',
}

export type HasTerminality<T extends Terminality = Terminality> = { terminality: T };

export type Terminal<T> = Extract<T, HasTerminality<Terminality.Terminal>>;
export type PseudoTerminal<T> = Extract<T, HasTerminality<Terminality.PseudoTerminal>>;
export type NonTerminal<T> = Extract<T, HasTerminality<Terminality.NonTerminal>>;

export type KindaTerminal<T> = Terminal<T> | PseudoTerminal<T>;
export type KindaNonTerminal<T> = NonTerminal<T> | PseudoTerminal<T>;

export namespace Terminality {
    export function isTerminal<T extends HasTerminality>(object: T): object is Terminal<T> {
        return object.terminality === Terminality.Terminal;
    }
    export function isPseudoTerminal<T extends HasTerminality>(object: T): object is PseudoTerminal<T> {
        return object.terminality === Terminality.PseudoTerminal;
    }
    export function isNonTerminal<T extends HasTerminality>(object: T): object is NonTerminal<T> {
        return object.terminality === Terminality.NonTerminal;
    }
    export function isKindaTerminal<T extends HasTerminality>(object: T): object is KindaTerminal<T> {
        return isTerminal(object) || isPseudoTerminal(object);
    }
    export function isKindaNonTerminal<T extends HasTerminality>(object: T): object is KindaNonTerminal<T> {
        return isNonTerminal(object) || isPseudoTerminal(object);
    }
}

export namespace Terminality {
    export function ofRule(
        rule:
            | RuleJSON.Sequence
            | RuleJSON.Choice
            | RuleJSON.Alias
            | RuleJSON.Repeat
            | RuleJSON.Repeat1
            | RuleJSON.Reserved
            | RuleJSON.Precedence
    ): Terminality.NonTerminal;
    export function ofRule(rule: RuleJSON.Symbol | RuleJSON.Token | RuleJSON.Field): Terminality.PseudoTerminal;
    export function ofRule(rule: RuleJSON.Blank | RuleJSON.String | RuleJSON.Pattern): Terminality.Terminal;
    export function ofRule(rule: Stub | undefined): Terminality | undefined;
    export function ofRule(rule: Stub | undefined): Terminality | undefined {
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
